import type {
  MyMeterCordisContext,
  MyMeterSessionPersistenceService,
  MyMeterSessionQueryService,
} from "./index";

export interface HistoryRecoveryStatus {
  state: "idle" | "listing" | "running" | "cancelled" | "completed" | "failed";
  listedSessions: number;
  readSessions: number;
  replayedSessions: number;
  skippedLiveSessions: number;
  skippedUnchangedSessions: number;
  failedReads: number;
  batches: number;
  eventsSeen: number;
  currentSessionId: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  lastError: string | null;
  cancelReason: string | null;
  batchSizeSessions: number;
  batchSizeEvents: number;
}

export interface HistoryRecovery {
  start(): void;
  markLive(sessionId: string): void;
  cancel(reason?: string): void;
  status(): HistoryRecoveryStatus;
}

export interface HistoryRecoveryOptions {
  source: HistoryRecoverySource;
  target: HistoryRecoveryTarget;
  checkpoint?: HistoryRecoveryCheckpoint | undefined;
  batchSizeSessions?: number;
  batchSizeEvents?: number;
  onStatus?: (status: HistoryRecoveryStatus) => void;
  yieldToEventLoop?: () => Promise<void>;
}

export interface HistoryRecoveryCheckpoint {
  sessionRevisions: Record<string, string>;
  save(sessionRevisions: Record<string, string>): void;
}

export interface HistoryRecoverySource {
  list(signal: AbortSignal): Promise<readonly HistorySessionRef[]>;
  read(ref: HistorySessionRef, signal: AbortSignal): Promise<HistoryReplaySession | null>;
}

export interface HistoryRecoveryTarget {
  replayBatch(sessions: readonly HistoryReplaySession[]): HistoryReplayBatchResult;
}

export interface HistoryReplayBatchResult {
  replayedSessions: number;
  skippedUnchangedSessions: number;
  eventsSeen: number;
}

export interface HistorySessionRef {
  id: string;
  source: "query" | "persistence";
  header?: Record<string, unknown>;
  revision?: string;
  live?: boolean;
  persisted?: boolean;
}

export interface HistoryReplaySession {
  id: string;
  header: Record<string, unknown>;
  revision?: string;
  events: readonly unknown[];
}

const DEFAULT_BATCH_SIZE_SESSIONS = 8;
const DEFAULT_BATCH_SIZE_EVENTS = 5_000;

export function createHistoryRecovery(options: HistoryRecoveryOptions): HistoryRecovery {
  const batchSizeSessions = options.batchSizeSessions ?? DEFAULT_BATCH_SIZE_SESSIONS;
  const batchSizeEvents = options.batchSizeEvents ?? DEFAULT_BATCH_SIZE_EVENTS;
  const yieldToEventLoop = options.yieldToEventLoop ?? defaultYieldToEventLoop;
  const onStatus = options.onStatus ?? (() => {});
  const liveSessionIds = new Set<string>();
  const controller = new AbortController();
  let started = false;
  let settled = false;
  let cancelReason: string | null = null;
  let snapshot = createStatus(batchSizeSessions, batchSizeEvents);

  const emit = (next: Partial<HistoryRecoveryStatus> = {}): void => {
    snapshot = { ...snapshot, ...next };
    try { onStatus({ ...snapshot }); } catch { /* observers are non-critical */ }
  };

  const finish = (state: HistoryRecoveryStatus["state"], next: Partial<HistoryRecoveryStatus> = {}): void => {
    settled = true;
    emit({ state, finishedAt: Date.now(), ...next });
  };

  async function run(): Promise<void> {
    emit({ state: "listing", startedAt: Date.now(), finishedAt: null, lastError: null, cancelReason: null });
    let refs: readonly HistorySessionRef[];
    try {
      refs = await options.source.list(controller.signal);
    } catch (error) {
      if (controller.signal.aborted) finish("cancelled", { cancelReason });
      else finish("failed", { lastError: errorMessage(error) });
      return;
    }
    if (controller.signal.aborted) { finish("cancelled", { cancelReason }); return; }
    emit({ state: "running", listedSessions: refs.length });
    const batch: HistoryReplaySession[] = [];
    const previousSessionRevisions = createSessionRevisionAccumulator(options.checkpoint?.sessionRevisions);
    const committedSessionRevisions: Record<string, string> = {};
    let eventCount = 0;

    const flush = async (): Promise<void> => {
      if (batch.length === 0) return;
      const queued = batch.splice(0, batch.length);
      const payload = queued.filter((session) => !liveSessionIds.has(session.id));
      const skippedLive = queued.length - payload.length;
      eventCount = 0;
      if (skippedLive > 0) {
        emit({ skippedLiveSessions: snapshot.skippedLiveSessions + skippedLive });
      }
      if (payload.length === 0) {
        await yieldToEventLoop();
        return;
      }
      const result = options.target.replayBatch(payload);
      commitSessionRevisions(committedSessionRevisions, payload);
      options.checkpoint?.save(committedSessionRevisions);
      emit({
        currentSessionId: payload.at(-1)?.id ?? null,
        replayedSessions: snapshot.replayedSessions + result.replayedSessions,
        skippedUnchangedSessions: snapshot.skippedUnchangedSessions + result.skippedUnchangedSessions,
        eventsSeen: snapshot.eventsSeen + result.eventsSeen,
        batches: snapshot.batches + 1,
      });
      await yieldToEventLoop();
    };

    for (const [refIndex, ref] of refs.entries()) {
      if (controller.signal.aborted) { finish("cancelled", { cancelReason }); return; }
      if (ref.live === true || ref.persisted === false) {
        emit({ currentSessionId: ref.id, skippedLiveSessions: snapshot.skippedLiveSessions + 1 });
        continue;
      }
      if (liveSessionIds.has(ref.id)) {
        emit({ currentSessionId: ref.id, skippedLiveSessions: snapshot.skippedLiveSessions + 1 });
        continue;
      }
      if (revisionMatches(previousSessionRevisions, ref.id, ref.revision)) {
        rememberSessionRevision(committedSessionRevisions, ref.id, ref.revision);
        emit({
          currentSessionId: ref.id,
          skippedUnchangedSessions: snapshot.skippedUnchangedSessions + 1,
        });
        continue;
      }
      let session: HistoryReplaySession | null;
      try {
        session = await options.source.read(ref, controller.signal);
        emit({ currentSessionId: ref.id, readSessions: snapshot.readSessions + 1 });
      } catch (error) {
        if (controller.signal.aborted) { finish("cancelled", { cancelReason }); return; }
        emit({ currentSessionId: ref.id, failedReads: snapshot.failedReads + 1, lastError: errorMessage(error) });
        continue;
      }
      if (controller.signal.aborted) { finish("cancelled", { cancelReason }); return; }
      if (!session) {
        emit({ currentSessionId: ref.id, failedReads: snapshot.failedReads + 1, lastError: `${ref.id}: empty snapshot` });
        continue;
      }
      if (session.id !== ref.id) {
        emit({ currentSessionId: ref.id, failedReads: snapshot.failedReads + 1, lastError: `${ref.id}: snapshot id mismatch` });
        continue;
      }
      if (liveSessionIds.has(session.id)) {
        emit({ currentSessionId: session.id, skippedLiveSessions: snapshot.skippedLiveSessions + 1 });
        continue;
      }
      if (ref.revision !== undefined) {
        session = { ...session, revision: ref.revision };
      }
      if (batch.length > 0 && (batch.length >= batchSizeSessions || eventCount + session.events.length > batchSizeEvents)) {
        try { await flush(); } catch (error) { finish("failed", { lastError: errorMessage(error) }); return; }
        if (controller.signal.aborted) { finish("cancelled", { cancelReason }); return; }
      }
      batch.push(session);
      eventCount += session.events.length;
      if (batch.length >= batchSizeSessions || eventCount >= batchSizeEvents) {
        try { await flush(); } catch (error) { finish("failed", { lastError: errorMessage(error) }); return; }
      } else if (refs.length < batchSizeSessions && refIndex + 1 < refs.length) {
        await yieldToEventLoop();
      }
    }
    try { await flush(); } catch (error) { finish("failed", { lastError: errorMessage(error) }); return; }
    try {
      options.checkpoint?.save(committedSessionRevisions);
    } catch (error) {
      finish("failed", { lastError: errorMessage(error) });
      return;
    }
    if (controller.signal.aborted) finish("cancelled", { cancelReason });
    else finish("completed");
  }

  return {
    start() { if (!started && !settled) { started = true; void run(); } },
    markLive(sessionId) { if (sessionId) liveSessionIds.add(sessionId); },
    cancel(reason) {
      if (settled) return;
      cancelReason = reason ?? cancelReason;
      controller.abort(reason);
      if (!started) finish("cancelled", { cancelReason });
    },
    status() { return { ...snapshot }; },
  };
}

export function createCordisHistoryRecoverySource(ctx: MyMeterCordisContext): HistoryRecoverySource {
  return {
    async list(signal) {
      const services = resolveServices(ctx);
      if (services.persistence) {
        const persistence = services.persistence as MyMeterSessionPersistenceService & {
          listSnapshots?: (signal?: AbortSignal) => Promise<readonly unknown[]>;
        };
        try {
          if (typeof persistence.listSnapshots === "function") {
            const records = await persistence.listSnapshots(signal);
            return records.flatMap((record) => {
              const ref = normalizeRef(record, "persistence");
              return ref ? [ref] : [];
            });
          }
        } catch { /* fallback below */ }
      }
      if (services.query) {
        try {
          const records = await services.query.listSessions(signal);
          return records.flatMap((record) => {
            const ref = normalizeRef(record, "query");
            return ref ? [ref] : [];
          });
        } catch { /* fallback below */ }
      }
      if (services.persistence) {
        const persistence = services.persistence;
        const records = await persistence.list(signal);
        return records.flatMap((record) => {
          const ref = normalizeRef(record, "persistence");
          return ref ? [ref] : [];
        });
      }
      return [];
    },
    async read(ref, signal) {
      const services = resolveServices(ctx);
      let raw: unknown;
      if (services.query) {
        try { raw = await services.query.readSession(ref.id); }
        catch { if (services.persistence) raw = await services.persistence.inspect(ref.id, signal); else throw new Error(`history read failed for ${ref.id}`); }
      } else if (services.persistence) raw = await services.persistence.inspect(ref.id, signal);
      else return null;
      return normalizeReplaySession(raw);
    },
  };
}

function resolveServices(ctx: MyMeterCordisContext): {
  query?: MyMeterSessionQueryService;
  persistence?: MyMeterSessionPersistenceService;
} {
  let query: unknown;
  let persistence: unknown;
  try { query = ctx.sessionQuery; persistence = ctx.sessionPersistence; } catch { /* guarded context */ }
  try { query ??= ctx.get?.("sessionQuery"); } catch { /* optional */ }
  try { persistence ??= ctx.get?.("sessionPersistence"); } catch { /* optional */ }
  return {
    ...(isQuery(query) ? { query } : {}),
    ...(isPersistence(persistence) ? { persistence } : {}),
  };
}

function isQuery(value: unknown): value is MyMeterSessionQueryService {
  return Boolean(value) && typeof value === "object" && typeof (value as MyMeterSessionQueryService).listSessions === "function" && typeof (value as MyMeterSessionQueryService).readSession === "function";
}
function isPersistence(value: unknown): value is MyMeterSessionPersistenceService {
  return Boolean(value) && typeof value === "object" && typeof (value as MyMeterSessionPersistenceService).list === "function" && typeof (value as MyMeterSessionPersistenceService).inspect === "function";
}
function normalizeRef(value: unknown, source: HistorySessionRef["source"]): HistorySessionRef | null {
  const record = asRecord(value);
  const header = asRecord(record.header ?? record.meta ?? record);
  const id = text(header.id ?? record.id);
  return id ? {
    id,
    source,
    ...(Object.keys(header).length > 0 ? { header } : {}),
    ...(text(record.revision) ? { revision: text(record.revision) } : {}),
    ...(record.live !== undefined ? { live: record.live === true } : {}),
    ...(record.persisted !== undefined ? { persisted: record.persisted !== false } : {}),
  } : null;
}
function normalizeReplaySession(value: unknown): HistoryReplaySession | null {
  const record = asRecord(value);
  const header = asRecord(record.session ?? record.meta ?? record.header);
  const id = text(header.id ?? record.id);
  return id && Array.isArray(record.events) ? { id, header, events: record.events } : null;
}
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown): string { return typeof value === "string" && value.trim() ? value.trim() : ""; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function createStatus(batchSizeSessions: number, batchSizeEvents: number): HistoryRecoveryStatus { return { state: "idle", listedSessions: 0, readSessions: 0, replayedSessions: 0, skippedLiveSessions: 0, skippedUnchangedSessions: 0, failedReads: 0, batches: 0, eventsSeen: 0, currentSessionId: null, startedAt: null, finishedAt: null, lastError: null, cancelReason: null, batchSizeSessions, batchSizeEvents }; }
async function defaultYieldToEventLoop(): Promise<void> { await new Promise<void>((resolve) => setTimeout(resolve, 0)); }

function createSessionRevisionAccumulator(previous: Record<string, string> | undefined): Record<string, string> {
  const revisions: Record<string, string> = {};
  for (const [sessionId, revision] of Object.entries(previous ?? {})) {
    if (text(revision)) revisions[sessionId] = revision;
  }
  return revisions;
}

function revisionMatches(sessionRevisions: Record<string, string>, sessionId: string, revision: string | undefined): boolean {
  return revision !== undefined
    && Object.hasOwn(sessionRevisions, sessionId)
    && sessionRevisions[sessionId] === revision;
}

function commitSessionRevisions(
  sessionRevisions: Record<string, string>,
  sessions: readonly HistoryReplaySession[],
): void {
  for (const session of sessions) {
    rememberSessionRevision(sessionRevisions, session.id, session.revision);
  }
}

function rememberSessionRevision(sessionRevisions: Record<string, string>, sessionId: string, revision: string | undefined): void {
  if (revision !== undefined && text(revision)) {
    sessionRevisions[sessionId] = revision;
  }
}
