import { Buffer } from "node:buffer";

import { createInMemoryCostEventRepository, type CostEventRepository } from "../../packages/host/src";
import { createMyMeterCordisHostRuntime, type MyMeterCordisContext } from "../../packages/plugin/src/cordis-host";

export const HISTORY_BACKFILL_SIZES = [100, 500, 1000] as const;

export type HistoryBackfillSourceMode = "query" | "persistence";

export interface HistoryBackfillMetrics {
  readonly sourceMode: HistoryBackfillSourceMode;
  readonly sessionCount: number;
  readonly sessionEventCount: number;
  readonly liveEventCount: number;
  readonly applyMs: number;
  readonly backfillMs: number;
  readonly liveLatencyMs: number;
  readonly sessionListCalls: number;
  readonly sessionReadCalls: number;
  readonly replaceAllCalls: number;
  readonly ledgerWriteBytes: number;
  readonly ledgerFinalBytes: number;
  readonly snapshotMs: number;
  readonly snapshotBytes: number;
  readonly eventLoopLagMs: number;
  readonly peakHeapBytes: number;
  readonly snapshotSessionCount: number;
  readonly snapshotDetailCount: number;
}

export interface HistoryBackfillMeasureOptions {
  readonly readDelayMs?: number;
  readonly timeoutMs?: number;
  readonly withStableRevisions?: boolean;
}

interface HistorySessionFixture {
  readonly id: string;
  readonly events: readonly HistoryEvent[];
  readonly kind: "short" | "idle" | "failed" | "long";
}

interface HistoryEvent {
  readonly type: string;
  readonly seq: number;
  readonly time: number;
  readonly data: Record<string, unknown>;
}

interface HistorySessionListEntry {
  readonly header: { readonly id: string };
  readonly revision?: string;
  readonly live: false;
  readonly persisted: true;
}

export function createHistoryBackfillPerfContext(
  sessionCount: number,
  sourceMode: HistoryBackfillSourceMode = "query",
  options: HistoryBackfillMeasureOptions = {},
): {
  readonly context: PerfCordisContext;
  readonly sessionEventCount: number;
  readonly billableSessionCount: number;
} {
  const fixture = buildHistoryBackfillFixture(sessionCount);
  return {
    context: new PerfCordisContext(fixture, sourceMode, options),
    sessionEventCount: fixture.sessionEventCount,
    billableSessionCount: fixture.billableSessionCount,
  };
}

export async function measureHistoryBackfill(
  sessionCount: number,
  sourceMode: HistoryBackfillSourceMode = "query",
  options: HistoryBackfillMeasureOptions = {},
): Promise<HistoryBackfillMetrics> {
  const fixture = buildHistoryBackfillFixture(sessionCount);
  const timeoutMs = options.timeoutMs ?? 10_000;
  const context = new PerfCordisContext(fixture, sourceMode, options);
  const repository = new CountingRepository();
  const liveSession = {
    id: `${sourceMode}-live-${sessionCount}`,
    events: [
      {
        type: "step/start",
        seq: 1,
        time: fixture.baseTimeMs + 999_999,
        data: { turn: 1, step: 1 },
      },
      {
        type: "request/header",
        seq: 2,
        time: fixture.baseTimeMs + 999_999 + 1,
        data: {
          header: {
            config: {
              provider: "deepseek",
              model: "deepseek-v4-flash",
              reasoningEffort: "medium",
            },
          },
        },
      },
    ] as HistoryEvent[],
  };

  const eventLoopLag = new EventLoopLagMonitor();

  const sampleHeap = (): number => {
    const memory = typeof process !== "undefined" && typeof process.memoryUsage === "function"
      ? process.memoryUsage().heapUsed
      : 0;
    return memory;
  };

  let peakHeapBytes = sampleHeap();
  const noteHeap = (): void => {
    peakHeapBytes = Math.max(peakHeapBytes, sampleHeap());
  };

  eventLoopLag.start();

  const applyStartedAt = performance.now();
  const runtime = createMyMeterCordisHostRuntime({
    ctx: context,
    repository: repository as CostEventRepository,
  });
  const applyMs = performance.now() - applyStartedAt;
  noteHeap();

  const liveMeasurementPromise = new Promise<{ latencyMs: number; eventCount: number }>((resolve, reject) => {
    setTimeout(() => {
      void (async () => {
        const liveEmittedAt = performance.now();
        context.emit(liveSession, {
          type: "assistant/message",
          seq: 3,
          time: fixture.baseTimeMs + 999_999 + 2,
          data: {
            turn: 1,
            step: 1,
            message: { role: "assistant", content: [] },
            usage: { inputTokens: 1_024, outputTokens: 256 },
          },
        });
        const liveObservedAt = await waitForRuntimeEventCount(runtime, liveSession.id, 1, timeoutMs);
        resolve({
          latencyMs: liveObservedAt - liveEmittedAt,
          eventCount: runtime.events().filter((event) => event.sessionId === liveSession.id).length,
        });
      })().catch(reject);
    }, 0);
  });

  const backfillStartedAt = performance.now();
  await waitForBackfillComplete(runtime, context, fixture.billableSessionCount, liveSession.id, sessionCount, timeoutMs);
  const backfillMs = performance.now() - backfillStartedAt;
  noteHeap();

  const liveMeasurement = await liveMeasurementPromise;
  await waitForMacrotask();
  const eventLoopLagMs = eventLoopLag.stop();
  noteHeap();

  const snapshotStartedAt = performance.now();
  const snapshot = runtime.remote.getSnapshot();
  const snapshotMs = performance.now() - snapshotStartedAt;
  noteHeap();

  const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot));

  runtime.uninstall();

  return {
    sourceMode,
    sessionCount,
    sessionEventCount: fixture.sessionEventCount,
    liveEventCount: liveMeasurement.eventCount,
    applyMs,
    backfillMs,
    liveLatencyMs: liveMeasurement.latencyMs,
    sessionListCalls: context.sessionListCalls,
    sessionReadCalls: context.sessionReadCalls,
    replaceAllCalls: repository.replaceAllCalls,
    ledgerWriteBytes: repository.ledgerWriteBytes,
    ledgerFinalBytes: repository.ledgerFinalBytes,
    snapshotMs,
    snapshotBytes,
    eventLoopLagMs,
    peakHeapBytes,
    snapshotSessionCount: snapshot.sessions.length,
    snapshotDetailCount: Object.keys(snapshot.details).length,
  };
}

function buildHistoryBackfillFixture(sessionCount: number): {
  readonly baseTimeMs: number;
  readonly sessions: readonly HistorySessionFixture[];
  readonly sessionEventCount: number;
  readonly billableSessionCount: number;
} {
  const longCount = 1;
  const idleCount = Math.max(1, Math.floor(sessionCount * 0.14));
  const failedCount = Math.max(1, Math.floor(sessionCount * 0.14));
  const shortCount = sessionCount - longCount - idleCount - failedCount;
  if (shortCount < 0) {
    throw new Error(`unsupported backfill fixture size: ${sessionCount}`);
  }

  const baseTimeMs = Date.UTC(2026, 7, 17, 4, 0, 0);
  const sessions: HistorySessionFixture[] = [
    buildLongSession(`${sessionCount}-long-000`, baseTimeMs),
    ...Array.from({ length: shortCount }, (_, index) =>
      buildShortSession(`${sessionCount}-short-${String(index + 1).padStart(3, "0")}`, baseTimeMs + (index + 1) * 10_000, index)),
    ...Array.from({ length: idleCount }, (_, index) =>
      buildIdleSession(`${sessionCount}-idle-${String(index + 1).padStart(3, "0")}`, baseTimeMs + (shortCount + index + 1) * 10_000, index)),
    ...Array.from({ length: failedCount }, (_, index) =>
      buildFailedSession(`${sessionCount}-failed-${String(index + 1).padStart(3, "0")}`, baseTimeMs + (shortCount + idleCount + index + 1) * 10_000, index)),
  ];

  return {
    baseTimeMs,
    sessions,
    sessionEventCount: sessions.reduce((total, session) => total + session.events.length, 0),
    billableSessionCount: sessions.filter((session) => session.kind !== "idle").length,
  };
}

function buildShortSession(sessionId: string, startedAt: number, index: number): HistorySessionFixture {
  const events = [
    stepStart(1, 1, startedAt),
    requestHeader(startedAt + 1, index),
    assistantMessage(startedAt + 1_050, 1, 1, {
      inputTokens: 1_024,
      outputTokens: 256,
    }),
    turnEnd(startedAt + 1_100, 1, "completed"),
  ];
  return { id: sessionId, events, kind: "short" };
}

function buildIdleSession(sessionId: string, startedAt: number, index: number): HistorySessionFixture {
  const events = [
    stepStart(1, 1, startedAt),
    turnEnd(startedAt + 300, 1, index % 2 === 0 ? "completed" : "aborted"),
  ];
  return { id: sessionId, events, kind: "idle" };
}

function buildFailedSession(sessionId: string, startedAt: number, index: number): HistorySessionFixture {
  const events = [
    stepStart(1, 1, startedAt),
    requestHeader(startedAt + 1, index + 100),
    assistantChunk(startedAt + 200, 1, 1, "partial output ".repeat(32)),
    turnEnd(startedAt + 600, 1, index % 2 === 0 ? "error" : "blocked"),
  ];
  return { id: sessionId, events, kind: "failed" };
}

function buildLongSession(sessionId: string, startedAt: number): HistorySessionFixture {
  const events: HistoryEvent[] = [
    stepStart(1, 1, startedAt),
    requestHeader(startedAt + 1, 0),
  ];

  for (let index = 0; index < 996; index += 1) {
    events.push(assistantChunk(startedAt + 2 + index, 1, 1, `delta-${String(index).padStart(3, "0")}-${"x".repeat(16)}`));
  }

  events.push(assistantMessage(startedAt + 1_100, 1, 1, {
    inputTokens: 1_024_000,
    outputTokens: 256_000,
  }));
  events.push(turnEnd(startedAt + 1_120, 1, "completed"));

  return { id: sessionId, events, kind: "long" };
}

function stepStart(turn: number, step: number, time: number): HistoryEvent {
  return { type: "step/start", seq: time, time, data: { turn, step } };
}

function requestHeader(time: number, seed: number): HistoryEvent {
  return {
    type: "request/header",
    seq: time,
    time,
    data: {
      header: {
        config: {
          provider: "deepseek",
          model: seed % 2 === 0 ? "deepseek-v4-flash" : "deepseek-v4-pro",
          reasoningEffort: seed % 2 === 0 ? "medium" : "high",
        },
      },
    },
  };
}

function assistantChunk(time: number, turn: number, step: number, text: string): HistoryEvent {
  return {
    type: "assistant/chunk",
    seq: time,
    time,
    data: {
      turn,
      step,
      chunk: { type: "text-delta", index: 0, text },
    },
  };
}

function assistantMessage(time: number, turn: number, step: number, usage: Record<string, number>): HistoryEvent {
  return {
    type: "assistant/message",
    seq: time,
    time,
    data: {
      turn,
      step,
      message: { role: "assistant", content: [] },
      usage,
    },
  };
}

function turnEnd(time: number, turn: number, kind: "completed" | "aborted" | "error" | "blocked"): HistoryEvent {
  return {
    type: "turn/end",
    seq: time,
    time,
    data: {
      turn,
      reason: { kind },
    },
  };
}

async function waitForMacrotask(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function waitForBackfillComplete(
  runtime: { events(): readonly { sessionId: string }[] },
  context: PerfCordisContext,
  expectedBillableSessions: number,
  liveSessionId: string,
  expectedReads: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const coldEventCount = runtime.events().filter((event) => event.sessionId !== liveSessionId).length;
    if (
      context.completedReadCalls >= expectedReads
      && context.inFlightReadCalls === 0
      && coldEventCount >= expectedBillableSessions
    ) {
      return;
    }
    await waitForMacrotask();
  }
  const coldEventCount = runtime.events().filter((event) => event.sessionId !== liveSessionId).length;
  throw new Error(
    `history backfill did not complete ${expectedReads} reads and ${expectedBillableSessions} billable sessions`
    + ` (listed ${context.sessionListCalls}, started ${context.sessionReadCalls}, completed ${context.completedReadCalls},`
    + ` in-flight ${context.inFlightReadCalls}, billable ${coldEventCount})`,
  );
}

async function waitForRuntimeEventCount(
  runtime: { events(): readonly { sessionId: string }[] },
  sessionId: string,
  expected: number,
  timeoutMs: number,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (runtime.events().filter((event) => event.sessionId === sessionId).length >= expected) {
      return performance.now();
    }
    await waitForMacrotask();
  }
  throw new Error(`live event did not reach MyMeter ledger for ${sessionId}`);
}

class EventLoopLagMonitor {
  private readonly intervalMs = 1;
  private active = false;
  private lastScheduledAt = 0;
  private maxLagMs = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  start(): void {
    this.active = true;
    this.schedule();
  }

  stop(): number {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    return this.maxLagMs;
  }

  private schedule(): void {
    this.lastScheduledAt = performance.now();
    this.timer = setTimeout(() => {
      const observedAt = performance.now();
      this.maxLagMs = Math.max(this.maxLagMs, Math.max(0, observedAt - this.lastScheduledAt - this.intervalMs));
      if (this.active) this.schedule();
    }, this.intervalMs);
  }
}

class CountingRepository implements CostEventRepository {
  private readonly repository = createInMemoryCostEventRepository();

  replaceAllCalls = 0;
  ledgerWriteBytes = 0;
  ledgerFinalBytes = 0;

  upsert(event: Parameters<CostEventRepository["upsert"]>[0]) {
    const result = this.repository.upsert(event);
    return result;
  }

  list() {
    return this.repository.list();
  }

  getById(id: string) {
    return this.repository.getById(id);
  }

  replaceAll(events: Parameters<CostEventRepository["replaceAll"]>[0]) {
    this.replaceAllCalls += 1;
    this.repository.replaceAll(events);
    this.ledgerFinalBytes = Buffer.byteLength(JSON.stringify({ schemaVersion: 1, events }, null, 2));
    this.ledgerWriteBytes += this.ledgerFinalBytes;
  }

  clear() {
    this.repository.clear();
    this.replaceAllCalls += 1;
    this.ledgerFinalBytes = Buffer.byteLength(JSON.stringify({ schemaVersion: 1, events: [] }, null, 2));
    this.ledgerWriteBytes += this.ledgerFinalBytes;
  }
}

export class PerfCordisContext implements MyMeterCordisContext {
  private readonly listeners = new Map<string, Set<(session: unknown, event: unknown) => void>>();
  private listCalls = 0;
  private readCalls = 0;
  private completedReads = 0;
  private inFlightReads = 0;

  readonly sessions = {
    list: (): readonly unknown[] => [],
  };

  sessionQuery?: {
    listSessions(signal?: AbortSignal): Promise<readonly unknown[]>;
    readSession(sessionId: string): Promise<unknown>;
  };

  sessionPersistence?: {
    listSnapshots?(signal?: AbortSignal): Promise<readonly unknown[]>;
    list(signal?: AbortSignal): Promise<readonly unknown[]>;
    inspect(sessionId: string, signal?: AbortSignal): Promise<unknown>;
  };

  private readonly refs: HistorySessionListEntry[];

  constructor(
    private readonly fixture: ReturnType<typeof buildHistoryBackfillFixture>,
    mode: HistoryBackfillSourceMode,
    private readonly options: HistoryBackfillMeasureOptions,
  ) {
    this.refs = fixture.sessions.map((session) => ({
      header: { id: session.id },
      ...(options.withStableRevisions ? { revision: `revision:${session.id}` } : {}),
      live: false as const,
      persisted: true as const,
    }));
    if (mode === "query") {
      this.sessionQuery = {
        listSessions: async (_signal?: AbortSignal) => {
          this.listCalls += 1;
          return this.refs;
        },
        readSession: async (sessionId: string) => {
          return this.readTrackedSnapshot(sessionId);
        },
      };
      if (!options.withStableRevisions) return;
    }
    this.sessionPersistence = {
      ...(options.withStableRevisions
        ? {
            listSnapshots: async (_signal?: AbortSignal) => {
              this.listCalls += 1;
              return this.refs;
            },
          }
        : {}),
      list: async (_signal?: AbortSignal) => {
        this.listCalls += 1;
        return this.refs;
      },
      inspect: async (sessionId: string, _signal?: AbortSignal) => {
        return this.readTrackedSnapshot(sessionId);
      },
    };
  }

  get sessionListCalls(): number {
    return this.listCalls;
  }

  get sessionReadCalls(): number {
    return this.readCalls;
  }

  get completedReadCalls(): number {
    return this.completedReads;
  }

  get inFlightReadCalls(): number {
    return this.inFlightReads;
  }

  on(event: string, listener: (session: unknown, event: unknown) => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set<(session: unknown, event: unknown) => void>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => {
      listeners.delete(listener);
    };
  }

  emit(session: unknown, event: unknown): void {
    for (const listener of this.listeners.get("session/event") ?? []) {
      listener(session, event);
    }
  }

  private async readTrackedSnapshot(
    sessionId: string,
  ): Promise<{ readonly session: { readonly id: string }; readonly events: readonly HistoryEvent[] }> {
    this.readCalls += 1;
    this.inFlightReads += 1;
    try {
      if (this.options.readDelayMs && this.options.readDelayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, this.options.readDelayMs));
      }
      return this.readSnapshot(sessionId);
    } finally {
      this.completedReads += 1;
      this.inFlightReads -= 1;
    }
  }

  private readSnapshot(sessionId: string): { readonly session: { readonly id: string }; readonly events: readonly HistoryEvent[] } {
    const session = this.fixture.sessions.find((entry) => entry.id === sessionId);
    if (!session) {
      throw new Error(`missing fixture session: ${sessionId}`);
    }
    return {
      session: { id: session.id },
      events: session.events,
    };
  }
}
