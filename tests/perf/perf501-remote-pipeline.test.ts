import { Buffer } from "node:buffer";

import { expect, test } from "vitest";

import { createInMemoryCostEventRepository } from "../../packages/host/src";
import { createMyMeterStore, type MyMeterRemote, type MyMeterRemoteSnapshot } from "../../packages/client/src";
import { createMyMeterCordisHostRuntime } from "../../packages/plugin/src/cordis-host";
import { MYMETER_LOCAL_TYPERT_CONTRIBUTION, type TypertSchema } from "../../packages/plugin/src/typert-remote";
import { createHistoryBackfillPerfContext } from "./history-backfill.fixture";

const PERF501_SESSION_COUNTS = [500, 1000] as const;
const PERF501_SAMPLE_COUNT = 13;
const PERF501_TIMEOUT_MS = 20_000;

interface Percentiles {
  readonly p50: number;
  readonly p95: number;
}

interface Perf501Metrics {
  readonly sessionCount: number;
  readonly eventCount: number;
  readonly snapshotBytes: number;
  readonly jsonStringifyMs: Percentiles;
  readonly jsonParseMs: Percentiles;
  readonly jsonRoundtripMs: Percentiles;
  readonly typertSnapshotSchemaMs: Percentiles;
  readonly clientStoreRecomputeMs: Percentiles;
}

test.each(PERF501_SESSION_COUNTS)(
  "measures the in-process Remote/Typert/client-store pipeline for %d sessions",
  async (sessionCount) => {
    const { runtime, snapshot } = await buildBackfilledRemoteSnapshot(sessionCount);
    try {
      const metrics = await measureRemotePipeline(sessionCount, runtime.events().length, snapshot);
      console.log("mymeter perf501 remote pipeline baseline", JSON.stringify(metrics));

      expect(metrics.sessionCount).toBe(sessionCount);
      expect(metrics.eventCount).toBeGreaterThan(0);
      expect(metrics.snapshotBytes).toBeGreaterThan(0);
      expect(metrics.snapshotBytes).toBeLessThan(80 * 1024 * 1024);
      expect(metrics.jsonStringifyMs.p95).toBeLessThan(5_000);
      expect(metrics.jsonParseMs.p95).toBeLessThan(5_000);
      expect(metrics.jsonRoundtripMs.p95).toBeLessThan(10_000);
      expect(metrics.typertSnapshotSchemaMs.p95).toBeLessThan(10_000);
      expect(metrics.clientStoreRecomputeMs.p95).toBeLessThan(10_000);

      await expect(runtime.remote.listSessions()).resolves.toEqual(snapshot.sessions);
      // Slim snapshot contract: the polled snapshot embeds exactly one detail,
      // for the session it currently points at.
      expect(Object.keys(snapshot.details)).toEqual([snapshot.currentSessionId]);
      const currentSessionId = snapshot.currentSessionId!;
      await expect(runtime.remote.getSessionDetail(currentSessionId)).resolves.toEqual(
        snapshot.details[currentSessionId],
      );
    } finally {
      runtime.uninstall();
    }
  },
  30_000,
);

async function buildBackfilledRemoteSnapshot(sessionCount: number): Promise<{
  readonly runtime: ReturnType<typeof createMyMeterCordisHostRuntime>;
  readonly snapshot: MyMeterRemoteSnapshot;
}> {
  const { context, billableSessionCount } = createHistoryBackfillPerfContext(sessionCount);
  const runtime = createMyMeterCordisHostRuntime({
    ctx: context,
    repository: createInMemoryCostEventRepository(),
  });
  let completed = false;
  try {
    await waitForBackfillComplete(runtime, context, billableSessionCount, sessionCount);
    const snapshot = runtime.remote.getSnapshot();

    expect(context.sessionReadCalls).toBe(sessionCount);
    expect(context.completedReadCalls).toBe(sessionCount);
    expect(snapshot.sessions).toHaveLength(billableSessionCount);
    // The snapshot stays O(1) in history: one embedded detail, N summaries.
    expect(Object.keys(snapshot.details)).toHaveLength(1);

    completed = true;
    return { runtime, snapshot };
  } finally {
    if (!completed) runtime.uninstall();
  }
}

async function measureRemotePipeline(
  sessionCount: number,
  eventCount: number,
  snapshot: MyMeterRemoteSnapshot,
): Promise<Perf501Metrics> {
  const typertSnapshotSchema = findTypertSchema<MyMeterRemoteSnapshot>("MyMeterRemoteSnapshot");
  let retainedBytes = 0;
  let retainedSessionCount = 0;

  const jsonStringifyMs = sample(() => {
    const json = JSON.stringify(snapshot);
    retainedBytes += Buffer.byteLength(json);
  });
  const snapshotJson = JSON.stringify(snapshot);

  const jsonParseMs = sample(() => {
    const parsed = JSON.parse(snapshotJson) as MyMeterRemoteSnapshot;
    retainedSessionCount += parsed.sessions.length;
  });

  const jsonRoundtripMs = sample(() => {
    const parsed = JSON.parse(JSON.stringify(snapshot)) as MyMeterRemoteSnapshot;
    retainedSessionCount += parsed.sessions.length;
  });

  const typertSnapshotSchemaMs = sample(() => {
    const parsed = typertSnapshotSchema.parse(snapshot);
    retainedSessionCount += parsed.sessions.length;
  });

  const clientStoreRecomputeMs = measureClientStoreRecompute(snapshot);
  expect(retainedBytes).toBeGreaterThan(0);
  expect(retainedSessionCount).toBeGreaterThan(0);

  return {
    sessionCount,
    eventCount,
    snapshotBytes: Buffer.byteLength(snapshotJson),
    jsonStringifyMs: percentile(jsonStringifyMs),
    jsonParseMs: percentile(jsonParseMs),
    jsonRoundtripMs: percentile(jsonRoundtripMs),
    typertSnapshotSchemaMs: percentile(typertSnapshotSchemaMs),
    clientStoreRecomputeMs: percentile(clientStoreRecomputeMs),
  };
}

function measureClientStoreRecompute(snapshot: MyMeterRemoteSnapshot): number[] {
  const remote = new MutableRemote(snapshot);
  const store = createMyMeterStore({ remote, storage: null });
  let retainedSessionLength = 0;
  let retainedScopeSessionId: string | null = null;
  try {
    const samples = sample(() => {
      remote.publish(snapshot);
      const state = store.getState();
      retainedSessionLength += state.viewModel.sessions.length;
      retainedScopeSessionId = state.viewModel.scope.sessionId;
    });
    const finalState = store.getState();
    expect(finalState.viewModel.sessions).toHaveLength(snapshot.sessions.length);
    expect(finalState.viewModel.scope.sessionId).toBe(snapshot.currentSessionId);
    expect(retainedSessionLength).toBeGreaterThan(0);
    expect(retainedScopeSessionId).toBe(snapshot.currentSessionId);
    return samples;
  } finally {
    store.destroy();
  }
}

function sample(callback: () => void): number[] {
  const samples: number[] = [];
  for (let index = 0; index < PERF501_SAMPLE_COUNT + 3; index += 1) {
    const startedAt = performance.now();
    callback();
    const elapsedMs = performance.now() - startedAt;
    if (index >= 3) samples.push(elapsedMs);
  }
  return samples;
}

function percentile(samples: readonly number[]): Percentiles {
  expect(samples).toHaveLength(PERF501_SAMPLE_COUNT);
  for (const sample of samples) {
    expect(Number.isFinite(sample)).toBe(true);
    expect(sample).toBeGreaterThanOrEqual(0);
  }

  const sorted = [...samples].sort((left, right) => left - right);
  return {
    p50: sorted[Math.floor((sorted.length - 1) * 0.5)]!,
    p95: sorted[Math.ceil((sorted.length - 1) * 0.95)]!,
  };
}

function findTypertSchema<T>(name: string): TypertSchema<T> {
  const entry = MYMETER_LOCAL_TYPERT_CONTRIBUTION.schemas.find((schema) => schema.name === name);
  if (!entry) throw new Error(`missing Typert schema fixture: ${name}`);
  return entry.schema as TypertSchema<T>;
}

async function waitForBackfillComplete(
  runtime: { events(): readonly { sessionId: string }[] },
  context: {
    readonly completedReadCalls: number;
    readonly inFlightReadCalls: number;
  },
  expectedBillableSessions: number,
  expectedReads: number,
): Promise<void> {
  const deadline = Date.now() + PERF501_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (
      context.completedReadCalls >= expectedReads
      && context.inFlightReadCalls === 0
      && distinctSessionCount(runtime.events()) >= expectedBillableSessions
    ) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  throw new Error(
    `perf501 backfill did not complete ${expectedReads} reads and ${expectedBillableSessions} billable sessions`
    + ` (completed ${context.completedReadCalls}, in-flight ${context.inFlightReadCalls},`
    + ` billable ${distinctSessionCount(runtime.events())})`,
  );
}

function distinctSessionCount(events: readonly { sessionId: string }[]): number {
  return new Set(events.map((event) => event.sessionId)).size;
}

class MutableRemote implements MyMeterRemote {
  private snapshot: MyMeterRemoteSnapshot;
  private readonly listeners = new Set<(snapshot: MyMeterRemoteSnapshot) => void>();

  constructor(snapshot: MyMeterRemoteSnapshot) {
    this.snapshot = snapshot;
  }

  getSnapshot(): MyMeterRemoteSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: MyMeterRemoteSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(snapshot: MyMeterRemoteSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}
