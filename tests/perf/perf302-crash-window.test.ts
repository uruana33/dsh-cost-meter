import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import {
  createFileCostEventRepository,
  createLedgerAggregator,
  createRecoveryCheckpointPath,
  loadRecoveryCheckpoint,
  saveRecoveryCheckpoint,
  type CostEventInput,
  type RecoveryCheckpoint,
  type RecoveryCheckpointExpectations,
  type RecoveryCheckpointRecoveryNotice,
} from "../../packages/host/src/index";
import {
  createCordisHistoryRecoverySource,
  createHistoryRecovery,
  type HistoryReplaySession,
  type HistoryRecoveryStatus,
} from "../../packages/plugin/src/history-recovery";
import {
  apply as applyCordisHost,
  type MyMeterCordisContext,
  type MyMeterTypertHostContext,
} from "../../packages/plugin/src/cordis-host";

const EXPECTATIONS: RecoveryCheckpointExpectations = {
  sourceKey: "session-query",
  projectionVersion: "perf302-v1",
  ledgerFingerprint: "perf302-ledger",
};

const FIRST_SESSION_ID = "perf302-session-a";
const SECOND_SESSION_ID = "perf302-session-b";

const HISTORY_FIXTURE = [
  replaySession(FIRST_SESSION_ID, "rev-a-1", [
    costEvent({
      id: "perf302-a-estimate",
      sessionId: FIRST_SESSION_ID,
      status: "estimated",
      source: "stream",
      amountMicroCny: 4_000_000,
      cacheHitTokens: 900_000,
      cacheMissTokens: 800_000,
      outputTokens: 700_000,
      reasoningTokens: 300_000,
    }),
    costEvent({
      id: "perf302-a-final",
      sessionId: FIRST_SESSION_ID,
      status: "settled",
      source: "final_usage",
      amountMicroCny: 6_050_000,
      completedAt: "2026-08-17T04:00:02.000Z",
      cacheHitTokens: 1_000_000,
      cacheMissTokens: 1_000_000,
      outputTokens: 1_000_000,
      reasoningTokens: 400_000,
    }),
  ]),
  replaySession(SECOND_SESSION_ID, "rev-b-1", [
    costEvent({
      id: "perf302-b-failed",
      sessionId: SECOND_SESSION_ID,
      turnId: "2",
      stepId: "1",
      status: "failed",
      source: "final_usage",
      requestOutcome: "failed",
      amountMicroCny: 321,
      cacheHitTokens: 7,
      cacheMissTokens: 11,
      outputTokens: 13,
      reasoningTokens: 17,
    }),
  ]),
];

test("PERF-302: ledger commit survives checkpoint save failure and restart does not double count", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-perf302-save-failure-"));
  const ledgerPath = join(tmp, "ledger.json");
  const checkpointPath = join(tmp, "ledger.json.recovery.json");
  const blockingFile = join(tmp, "not-a-directory");
  await writeFile(blockingFile, "checkpoint parent blocker");
  const failingCheckpointPath = join(blockingFile, "ledger.json.recovery.json");

  const failed = await runRecovery({
    ledgerPath,
    checkpointPath: failingCheckpointPath,
    sessions: HISTORY_FIXTURE,
    failMode: "checkpoint-save-failure",
  });

  expect(failed.status.state).toBe("failed");
  expect(failed.status.lastError).toMatch(/EEXIST|ENOTDIR/);
  await expectFileMissing(checkpointPath);
  expectStableLedgerTotals(ledgerPath);

  const restarted = await runRecovery({
    ledgerPath,
    checkpointPath,
    sessions: HISTORY_FIXTURE,
    startCalls: 2,
  });

  expect(restarted.status.state).toBe("completed");
  expect(restarted.status.replayedSessions).toBe(2);
  expect(restarted.listCalls).toBe(1);
  expectStableLedgerTotals(ledgerPath);
  await expectFileExists(checkpointPath);

  const duplicateStartup = await runRecovery({
    ledgerPath,
    checkpointPath,
    sessions: HISTORY_FIXTURE,
  });

  expect(duplicateStartup.status.state).toBe("completed");
  expect(duplicateStartup.status.replayedSessions).toBe(0);
  expect(duplicateStartup.status.skippedUnchangedSessions).toBe(2);
  expectStableLedgerTotals(ledgerPath);
});

test("PERF-302: crash after ledger commit and before checkpoint save is replay-idempotent", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-perf302-crash-window-"));
  const ledgerPath = join(tmp, "ledger.json");
  const checkpointPath = join(tmp, "ledger.json.recovery.json");

  const crashed = await runRecovery({
    ledgerPath,
    checkpointPath,
    sessions: HISTORY_FIXTURE,
    failMode: "crash-after-ledger",
  });

  expect(crashed.status.state).toBe("failed");
  expect(crashed.status.lastError).toBe("simulated crash after ledger commit before checkpoint save");
  await expectFileMissing(checkpointPath);
  expectStableLedgerTotals(ledgerPath);

  const restarted = await runRecovery({ ledgerPath, checkpointPath, sessions: HISTORY_FIXTURE });

  expect(restarted.status.state).toBe("completed");
  expect(restarted.status.replayedSessions).toBe(2);
  expectStableLedgerTotals(ledgerPath);
  await expectFileExists(checkpointPath);
});

test("PERF-302: Cordis runtime replays fully after checkpoint save failure without double billing", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-perf302-runtime-checkpoint-failure-"));
  const ledgerPath = join(tmp, "ledger.json");
  const checkpointPath = createRecoveryCheckpointPath(ledgerPath);
  const sessionId = "perf302-runtime-cold";
  const events = cordisSettledEvents(Date.UTC(2026, 7, 17, 4));
  const firstListSnapshots = createDeferred<readonly unknown[]>();
  const firstCtx = new Perf302TypertHostContext();
  const firstInspect = vi.fn(async () => ({ meta: { id: sessionId }, events }));
  firstCtx.sessionPersistence = {
    list: async () => [],
    inspect: firstInspect,
    listSnapshots: async () => firstListSnapshots.promise,
  };

  applyCordisHost(firstCtx, { ledgerPath, balanceEnabled: false });
  await mkdir(checkpointPath);
  firstListSnapshots.resolve([{ header: { id: sessionId }, revision: "rev-1" }]);

  await waitFor(() => expectRuntimeLedgerTotals(ledgerPath, sessionId));
  await waitFor(() => {
    expect(firstCtx.warnings.some((warning) => warning.includes("history recovery failed"))).toBe(true);
  });
  expect(firstInspect).toHaveBeenCalledTimes(1);

  const secondCtx = new Perf302TypertHostContext();
  const secondInspect = vi.fn(async () => ({ meta: { id: sessionId }, events }));
  secondCtx.sessionPersistence = {
    list: async () => [],
    inspect: secondInspect,
    listSnapshots: async () => [{ header: { id: sessionId }, revision: "rev-1" }],
  };
  const secondUninstall = applyCordisHost(secondCtx, { ledgerPath, balanceEnabled: false });

  await waitFor(() => expect(secondInspect).toHaveBeenCalledTimes(1));
  expectRuntimeLedgerTotals(ledgerPath, sessionId);
  await waitFor(async () => {
    const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8")) as RecoveryCheckpoint;
    expect(checkpoint.sessionRevisions).toEqual({ [sessionId]: "rev-1" });
  });
  await secondUninstall();
});

test("PERF-302: corrupt checkpoint is quarantined and full replay stays lossless", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-perf302-corrupt-checkpoint-"));
  const ledgerPath = join(tmp, "ledger.json");
  const checkpointPath = join(tmp, "ledger.json.recovery.json");

  const initial = await runRecovery({ ledgerPath, checkpointPath, sessions: HISTORY_FIXTURE });
  expect(initial.status.state).toBe("completed");
  expectStableLedgerTotals(ledgerPath);

  await writeFile(checkpointPath, "{ not valid checkpoint json");
  const recoveryNotices: RecoveryCheckpointRecoveryNotice[] = [];
  const recovered = await runRecovery({
    ledgerPath,
    checkpointPath,
    sessions: HISTORY_FIXTURE,
    onCheckpointRecovery: (notice) => recoveryNotices.push(notice),
  });

  expect(recovered.status.state).toBe("completed");
  expect(recovered.status.replayedSessions).toBe(2);
  expect(recoveryNotices).toEqual([
    expect.objectContaining({
      filePath: checkpointPath,
      reason: "corrupt",
      quarantinePath: expect.stringContaining("ledger.json.recovery.json.corrupt-"),
    }),
  ]);
  expectStableLedgerTotals(ledgerPath);

  const names = await readdir(tmp);
  expect(names.some((name) => name.startsWith("ledger.json.recovery.json.corrupt-"))).toBe(true);
  await expectFileExists(checkpointPath);
});

interface RunRecoveryOptions {
  ledgerPath: string;
  checkpointPath: string;
  sessions: readonly HistoryReplaySession[];
  failMode?: "checkpoint-save-failure" | "crash-after-ledger" | undefined;
  startCalls?: number | undefined;
  onCheckpointRecovery?: ((notice: RecoveryCheckpointRecoveryNotice) => void) | undefined;
}

async function runRecovery(options: RunRecoveryOptions): Promise<{
  status: HistoryRecoveryStatus;
  listCalls: number;
}> {
  const repository = createFileCostEventRepository({ filePath: options.ledgerPath });
  const checkpoint = loadRecoveryCheckpoint(
    options.checkpointPath,
    EXPECTATIONS,
    options.onCheckpointRecovery,
  );
  let listCalls = 0;
  const sessionsById = new Map(options.sessions.map((session) => [session.id, session]));
  const source = createCordisHistoryRecoverySource({
    sessionQuery: {
      listSessions: async () => {
        listCalls += 1;
        return options.sessions.map((session) => ({
          header: session.header,
          revision: revisionOf(session),
          live: false,
          persisted: true,
        }));
      },
      readSession: async (sessionId: string) => sessionsById.get(sessionId) ?? null,
    },
  } as unknown as MyMeterCordisContext);

  const recovery = createHistoryRecovery({
    source,
    checkpoint: {
      sessionRevisions: { ...(checkpoint?.sessionRevisions ?? {}) },
      save(sessionRevisions) {
        if (options.failMode === "crash-after-ledger") {
          throw new Error("simulated crash after ledger commit before checkpoint save");
        }
        saveRecoveryCheckpoint(options.checkpointPath, {
          schemaVersion: 1,
          ...EXPECTATIONS,
          sessionRevisions: stringSessionRevisions(sessionRevisions),
        } satisfies RecoveryCheckpoint);
      },
    },
    target: {
      replayBatch(sessions) {
        for (const session of sessions) {
          for (const event of session.events) {
            repository.upsert(event as CostEventInput);
          }
        }

        return {
          replayedSessions: sessions.length,
          skippedUnchangedSessions: 0,
          eventsSeen: sessions.reduce((total, session) => total + session.events.length, 0),
        };
      },
    },
    batchSizeSessions: 100,
    batchSizeEvents: 100,
  });

  for (let index = 0; index < (options.startCalls ?? 1); index += 1) {
    recovery.start();
  }
  await waitFor(() => expect(["completed", "failed", "cancelled"]).toContain(recovery.status().state));
  return { status: recovery.status(), listCalls };
}

function stringSessionRevisions(sessionRevisions: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sessionRevisions).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function expectRuntimeLedgerTotals(ledgerPath: string, sessionId: string): void {
  const repository = createFileCostEventRepository({ filePath: ledgerPath });
  const events = repository.list();
  const aggregation = createLedgerAggregator().aggregate(events);

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    sessionId,
    status: "settled",
    amountMicroCny: 6_050_000,
    cacheHitTokens: 1_000_000,
    cacheMissTokens: 1_000_000,
    outputTokens: 1_000_000,
    reasoningTokens: 400_000,
  });
  expect(aggregation.global).toMatchObject({
    requestCount: 1,
    totalMicroCny: 6_050_000,
    settledMicroCny: 6_050_000,
    settledCount: 1,
    estimatedCount: 0,
    failedCount: 0,
    cacheHitTokens: 1_000_000,
    cacheMissTokens: 1_000_000,
    outputTokens: 1_000_000,
    reasoningTokens: 400_000,
  });
}

function expectStableLedgerTotals(ledgerPath: string): void {
  const repository = createFileCostEventRepository({ filePath: ledgerPath });
  const events = repository.list();
  const aggregation = createLedgerAggregator().aggregate(events);
  const first = events.find((event) => event.sessionId === FIRST_SESSION_ID);
  const second = events.find((event) => event.sessionId === SECOND_SESSION_ID);

  expect(events).toHaveLength(2);
  expect(first).toMatchObject({
    id: "perf302-a-final",
    status: "settled",
    amountMicroCny: 6_050_000,
    cacheHitTokens: 1_000_000,
    cacheMissTokens: 1_000_000,
    outputTokens: 1_000_000,
    reasoningTokens: 400_000,
  });
  expect(second).toMatchObject({
    id: "perf302-b-failed",
    status: "failed",
    requestOutcome: "failed",
    amountMicroCny: 321,
    cacheHitTokens: 7,
    cacheMissTokens: 11,
    outputTokens: 13,
    reasoningTokens: 17,
  });
  expect(aggregation.global).toMatchObject({
    requestCount: 2,
    totalMicroCny: 6_050_321,
    settledMicroCny: 6_050_000,
    failedMicroCny: 321,
    settledCount: 1,
    failedCount: 1,
    estimatedCount: 0,
    cacheHitTokens: 1_000_007,
    cacheMissTokens: 1_000_011,
    outputTokens: 1_000_013,
    reasoningTokens: 400_017,
  });
}

function replaySession(
  id: string,
  revision: string,
  events: readonly CostEventInput[],
): HistoryReplaySession {
  return {
    id,
    header: { id, revision },
    events,
  };
}

function costEvent(input: Partial<CostEventInput> & Pick<CostEventInput, "id" | "sessionId" | "status" | "source" | "amountMicroCny">): CostEventInput {
  return {
    requestStartedAt: "2026-08-17T04:00:00.000Z",
    turnId: "1",
    stepId: "1",
    attemptId: "attempt-0",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    reasoningEffort: "medium",
    agentPreset: "Coding",
    pricingZone: "peak",
    priceVersion: "perf302-fixture",
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    hitRateMicroCny: 0,
    missRateMicroCny: 0,
    outputRateMicroCny: 0,
    cacheHitRateMicroCnyPerMillionTokens: 50_000,
    cacheMissRateMicroCnyPerMillionTokens: 1_500_000,
    outputRateMicroCnyPerMillionTokens: 4_500_000,
    ...input,
  };
}

function revisionOf(session: HistoryReplaySession): string {
  const revision = session.header.revision;
  return typeof revision === "string" && revision.trim() ? revision : `events:${session.events.length}`;
}

async function expectFileExists(filePath: string): Promise<void> {
  await expect(access(filePath, constants.F_OK)).resolves.toBeUndefined();
}

async function expectFileMissing(filePath: string): Promise<void> {
  await expect(access(filePath, constants.F_OK)).rejects.toMatchObject({ code: "ENOENT" });
}

function cordisSettledEvents(startedAt: number): unknown[] {
  return [
    { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } },
    {
      type: "request/header",
      seq: 2,
      time: startedAt + 1,
      data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash", reasoningEffort: "high" } } },
    },
    {
      type: "assistant/chunk",
      seq: 3,
      time: startedAt + 500,
      data: {
        turn: 1,
        step: 1,
        chunk: {
          type: "usage",
          usage: {
            inputTokens: 1_000_000,
            outputTokens: 1_000_000,
            cacheReadTokens: 1_000_000,
            reasoningTokens: 400_000,
          },
        },
      },
    },
    {
      type: "assistant/message",
      seq: 4,
      time: startedAt + 1_000,
      data: {
        turn: 1,
        step: 1,
        message: { role: "assistant", content: [] },
        usage: {
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          cacheReadTokens: 1_000_000,
          reasoningTokens: 400_000,
        },
      },
    },
  ];
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class Perf302TypertHostContext {
  private readonly listeners = new Map<string, Set<(first: unknown, second: unknown) => void>>();
  readonly warnings: string[] = [];
  sessionPersistence!: NonNullable<MyMeterTypertHostContext["sessionPersistence"]>;

  readonly logger = {
    warn: (message: string) => {
      this.warnings.push(message);
    },
  };

  readonly sessions = {
    list: () => [],
  };

  readonly settings = {
    get: () => ({}),
    register: () => ({}),
  };

  readonly llm = {
    listProviders: () => [],
    listConfigurableProviders: () => [],
  };

  readonly reflect = {
    provide: () => () => {},
  };

  readonly typert = {
    register: () => () => {},
  };

  on(event: string, listener: (first: unknown, second: unknown) => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set<(first: unknown, second: unknown) => void>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }
}
