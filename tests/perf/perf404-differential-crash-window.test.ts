import { access, mkdtemp, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { waitFor } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  RECOVERY_CHECKPOINT_SCHEMA_VERSION,
  createAppendOnlyCostEventRepository,
  createFileCostEventRepository,
  createLedgerAggregator,
  createRecoveryCheckpointPath,
  loadRecoveryCheckpoint,
  saveRecoveryCheckpoint,
  type CostEventInput,
  type CostEventRecord,
  type CostEventRepository,
  type LedgerSummary,
  type RecoveryCheckpoint,
  type RecoveryCheckpointExpectations,
} from "../../packages/host/src/index";
import {
  createHistoryRecovery,
  type HistoryReplaySession,
  type HistoryRecoveryStatus,
} from "../../packages/plugin/src/history-recovery";

const SOURCE_KEY = "perf404-history";
const PROJECTION_VERSION = "perf404-differential-v1";

const SESSION_A = "perf404-session-a";
const SESSION_B = "perf404-session-b";
const SESSION_C = "perf404-session-c";

const HISTORY_FIXTURE: readonly HistoryReplaySession[] = [
  replaySession(SESSION_A, "rev-a-1", [
    event({
      id: "perf404-a-estimate",
      sessionId: SESSION_A,
      status: "estimated",
      source: "stream",
      amountMicroCny: 4_000_000,
      cacheHitTokens: 900_000,
      cacheMissTokens: 800_000,
      outputTokens: 700_000,
      reasoningTokens: 300_000,
    }),
    event({
      id: "perf404-a-final",
      sessionId: SESSION_A,
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
  replaySession(SESSION_B, "rev-b-1", [
    event({
      id: "perf404-b-failed",
      sessionId: SESSION_B,
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
  replaySession(SESSION_C, "rev-c-1", [
    event({
      id: "perf404-c-estimate",
      sessionId: SESSION_C,
      turnId: "3",
      stepId: "1",
      status: "estimated",
      source: "stream",
      amountMicroCny: 222,
      cacheHitTokens: 19,
      cacheMissTokens: 23,
      outputTokens: 29,
      reasoningTokens: 31,
    }),
  ]),
];

test("PERF-404: JSON and append-log ledgers replay the same events through checkpoint crash windows", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-perf404-differential-"));
  const jsonHarness = createHarness("json", join(tmp, "json-ledger.json"));
  const appendHarness = createHarness("append-log", join(tmp, "append-ledger.json"));

  const beforeCommit = await Promise.all([
    jsonHarness.run({ failMode: "before-ledger-commit" }),
    appendHarness.run({ failMode: "before-ledger-commit" }),
  ]);

  for (const result of beforeCommit) {
    expect(result.status.state).toBe("failed");
    expect(result.status.lastError).toBe("simulated crash before ledger commit");
    expect(result.events).toEqual([]);
    expect(result.sessionReadCalls).toBe(3);
    expect(result.ledgerCommitCalls).toBe(0);
    await expectMissing(result.checkpointPath);
  }

  const afterBeforeCommitRestart = await Promise.all([jsonHarness.run(), appendHarness.run()]);
  expectCompletedAndEquivalent(afterBeforeCommitRestart);

  const secondStartup = await Promise.all([jsonHarness.run(), appendHarness.run()]);
  expectSkippedAndEquivalent(secondStartup);

  const crashTmp = await mkdtemp(join(tmpdir(), "mymeter-perf404-after-commit-"));
  const crashingJsonHarness = createHarness("json", join(crashTmp, "json-ledger.json"));
  const crashingAppendHarness = createHarness("append-log", join(crashTmp, "append-ledger.json"));

  const afterCommit = await Promise.all([
    crashingJsonHarness.run({ failMode: "after-ledger-commit-before-checkpoint" }),
    crashingAppendHarness.run({ failMode: "after-ledger-commit-before-checkpoint" }),
  ]);

  for (const result of afterCommit) {
    expect(result.status.state).toBe("failed");
    expect(result.status.lastError).toBe("simulated crash after ledger commit before checkpoint save");
    expect(result.events).toHaveLength(3);
    expect(result.sessionReadCalls).toBe(3);
    expect(result.ledgerCommitCalls).toBe(1);
    await expectMissing(result.checkpointPath);
  }
  expectLedgerEquivalence(afterCommit);

  const afterCommitRestart = await Promise.all([crashingJsonHarness.run(), crashingAppendHarness.run()]);
  expectCompletedAndEquivalent(afterCommitRestart);

  const duplicateStartup = await Promise.all([crashingJsonHarness.run(), crashingAppendHarness.run()]);
  expectSkippedAndEquivalent(duplicateStartup);
});

type LedgerKind = "json" | "append-log";
type FailureMode = "before-ledger-commit" | "after-ledger-commit-before-checkpoint";

interface HarnessResult {
  kind: LedgerKind;
  ledgerPath: string;
  checkpointPath: string;
  status: HistoryRecoveryStatus;
  events: readonly EventProjection[];
  summary: Pick<LedgerSummary, "requestCount" | "totalMicroCny" | "settledMicroCny" | "estimatedMicroCny" | "failedMicroCny" | "settledCount" | "estimatedCount" | "failedCount" | "cacheHitTokens" | "cacheMissTokens" | "outputTokens" | "reasoningTokens">;
  ledgerFingerprint: string;
  checkpoint: RecoveryCheckpoint | null;
  sessionReadCalls: number;
  ledgerCommitCalls: number;
}

function createHarness(kind: LedgerKind, ledgerPath: string): {
  run(options?: { failMode?: FailureMode | undefined }): Promise<HarnessResult>;
} {
  const checkpointPath = createRecoveryCheckpointPath(ledgerPath);
  const createRepository = (): CostEventRepository => kind === "json"
    ? createFileCostEventRepository({ filePath: ledgerPath })
    : createAppendOnlyCostEventRepository({ filePath: ledgerPath });

  return {
    async run(options = {}) {
      const repository = createRepository();
      const expectations = (): RecoveryCheckpointExpectations => ({
        sourceKey: SOURCE_KEY,
        projectionVersion: PROJECTION_VERSION,
        ledgerFingerprint: repository.ledgerFingerprint?.() ?? "",
      });
      const loadedCheckpoint = loadRecoveryCheckpoint(checkpointPath, expectations());
      let failedBeforeCommit = false;
      let sessionReadCalls = 0;
      let ledgerCommitCalls = 0;
      const recovery = createHistoryRecovery({
        source: {
          list: async () => HISTORY_FIXTURE.map((session) => ({
            id: session.id,
            header: session.header,
            ...(session.revision !== undefined ? { revision: session.revision } : {}),
            source: "query" as const,
            persisted: true,
          })),
          read: async (ref) => {
            sessionReadCalls += 1;
            return HISTORY_FIXTURE.find((session) => session.id === ref.id) ?? null;
          },
        },
        checkpoint: {
          sessionRevisions: { ...(loadedCheckpoint?.sessionRevisions ?? {}) },
          save(sessionRevisions) {
            if (options.failMode === "after-ledger-commit-before-checkpoint") {
              throw new Error("simulated crash after ledger commit before checkpoint save");
            }
            saveRecoveryCheckpoint(checkpointPath, {
              schemaVersion: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
              ...expectations(),
              sessionRevisions: stringSessionRevisions(sessionRevisions),
            });
          },
        },
        target: {
          replayBatch(sessions) {
            if (options.failMode === "before-ledger-commit" && !failedBeforeCommit) {
              failedBeforeCommit = true;
              throw new Error("simulated crash before ledger commit");
            }
            const events = sessions.flatMap((session) => session.events as CostEventInput[]);
            ledgerCommitCalls += 1;
            repository.commit?.(events);
            return {
              replayedSessions: sessions.length,
              skippedUnchangedSessions: 0,
              eventsSeen: events.length,
            };
          },
        },
        batchSizeSessions: 100,
        batchSizeEvents: 100,
      });

      recovery.start();
      await waitFor(() => expect(["completed", "failed", "cancelled"]).toContain(recovery.status().state));
      const restartedRepository = createRepository();
      const events = projectEvents(restartedRepository.list());
      const aggregation = createLedgerAggregator().aggregate(restartedRepository.list());
      const ledgerFingerprint = restartedRepository.ledgerFingerprint?.() ?? "";
      const checkpoint = await readCheckpointIfPresent(checkpointPath);
      if (checkpoint) {
        expect(checkpoint.ledgerFingerprint).toBe(ledgerFingerprint);
      }
      return {
        kind,
        ledgerPath,
        checkpointPath,
        status: recovery.status(),
        events,
        summary: projectSummary(aggregation.global),
        ledgerFingerprint,
        checkpoint,
        sessionReadCalls,
        ledgerCommitCalls,
      };
    },
  };
}

function expectCompletedAndEquivalent(results: readonly HarnessResult[]): void {
  for (const result of results) {
    expect(result.status.state).toBe("completed");
    expect(result.status.replayedSessions).toBe(3);
    expect(result.status.skippedUnchangedSessions).toBe(0);
    expect(result.sessionReadCalls).toBe(3);
    expect(result.ledgerCommitCalls).toBe(1);
    expect(result.checkpoint?.sessionRevisions).toEqual({
      [SESSION_A]: "rev-a-1",
      [SESSION_B]: "rev-b-1",
      [SESSION_C]: "rev-c-1",
    });
  }
  expectLedgerEquivalence(results);
}

function expectSkippedAndEquivalent(results: readonly HarnessResult[]): void {
  for (const result of results) {
    expect(result.status.state).toBe("completed");
    expect(result.status.replayedSessions).toBe(0);
    expect(result.status.skippedUnchangedSessions).toBe(3);
    expect(result.sessionReadCalls).toBe(0);
    expect(result.ledgerCommitCalls).toBe(0);
    expect(result.checkpoint?.ledgerFingerprint).toBe(result.ledgerFingerprint);
  }
  expectLedgerEquivalence(results);
}

function expectLedgerEquivalence(results: readonly HarnessResult[]): void {
  const [json, append] = results;
  expect(json?.kind).toBe("json");
  expect(append?.kind).toBe("append-log");
  expect(append?.events).toEqual(json?.events);
  expect(append?.summary).toEqual(json?.summary);
  expect(json?.events.map((event) => event.status)).toEqual(["settled", "failed", "estimated"]);
  expect(json?.summary).toEqual({
    requestCount: 3,
    totalMicroCny: 6_050_543,
    settledMicroCny: 6_050_000,
    estimatedMicroCny: 222,
    failedMicroCny: 321,
    settledCount: 1,
    estimatedCount: 1,
    failedCount: 1,
    cacheHitTokens: 1_000_026,
    cacheMissTokens: 1_000_034,
    outputTokens: 1_000_042,
    reasoningTokens: 400_048,
  });
}

type EventProjection = Pick<
  CostEventRecord,
  | "id"
  | "eventKey"
  | "sessionId"
  | "turnId"
  | "stepId"
  | "attemptId"
  | "requestStartedAt"
  | "completedAt"
  | "status"
  | "source"
  | "requestOutcome"
  | "amountMicroCny"
  | "amountMinor"
  | "cacheHitTokens"
  | "cacheMissTokens"
  | "cacheWriteTokens"
  | "outputTokens"
  | "reasoningTokens"
  | "hitRateMicroCny"
  | "missRateMicroCny"
  | "outputRateMicroCny"
  | "cacheHitRateMicroCnyPerMillionTokens"
  | "cacheMissRateMicroCnyPerMillionTokens"
  | "outputRateMicroCnyPerMillionTokens"
  | "priceVersion"
>;

function projectEvents(events: readonly CostEventRecord[]): readonly EventProjection[] {
  return events.map((record) => ({
    id: record.id,
    eventKey: record.eventKey,
    sessionId: record.sessionId,
    turnId: record.turnId,
    stepId: record.stepId,
    attemptId: record.attemptId,
    requestStartedAt: record.requestStartedAt,
    completedAt: record.completedAt,
    status: record.status,
    source: record.source,
    requestOutcome: record.requestOutcome,
    amountMicroCny: record.amountMicroCny,
    amountMinor: record.amountMinor,
    cacheHitTokens: record.cacheHitTokens,
    cacheMissTokens: record.cacheMissTokens,
    cacheWriteTokens: record.cacheWriteTokens,
    outputTokens: record.outputTokens,
    reasoningTokens: record.reasoningTokens,
    hitRateMicroCny: record.hitRateMicroCny,
    missRateMicroCny: record.missRateMicroCny,
    outputRateMicroCny: record.outputRateMicroCny,
    cacheHitRateMicroCnyPerMillionTokens: record.cacheHitRateMicroCnyPerMillionTokens,
    cacheMissRateMicroCnyPerMillionTokens: record.cacheMissRateMicroCnyPerMillionTokens,
    outputRateMicroCnyPerMillionTokens: record.outputRateMicroCnyPerMillionTokens,
    priceVersion: record.priceVersion,
  }));
}

function projectSummary(summary: LedgerSummary): HarnessResult["summary"] {
  return {
    requestCount: summary.requestCount,
    totalMicroCny: summary.totalMicroCny,
    settledMicroCny: summary.settledMicroCny,
    estimatedMicroCny: summary.estimatedMicroCny,
    failedMicroCny: summary.failedMicroCny,
    settledCount: summary.settledCount,
    estimatedCount: summary.estimatedCount,
    failedCount: summary.failedCount,
    cacheHitTokens: summary.cacheHitTokens,
    cacheMissTokens: summary.cacheMissTokens,
    outputTokens: summary.outputTokens,
    reasoningTokens: summary.reasoningTokens,
  };
}

function replaySession(id: string, revision: string, events: readonly CostEventInput[]): HistoryReplaySession {
  return {
    id,
    revision,
    header: { id, revision },
    events,
  };
}

function event(input: Partial<CostEventInput> & Pick<CostEventInput, "id" | "sessionId" | "status" | "source" | "amountMicroCny">): CostEventInput {
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
    priceVersion: "perf404-fixture",
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

function stringSessionRevisions(sessionRevisions: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sessionRevisions).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

async function readCheckpointIfPresent(filePath: string): Promise<RecoveryCheckpoint | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as RecoveryCheckpoint;
  } catch {
    return null;
  }
}

async function expectMissing(filePath: string): Promise<void> {
  await expect(access(filePath, constants.F_OK)).rejects.toMatchObject({ code: "ENOENT" });
}
