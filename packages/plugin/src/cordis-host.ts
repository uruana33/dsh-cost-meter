import {
  createMyMeterHostRuntime,
  type DshEventContext,
  type MyMeterBalanceProvider,
  type MyMeterCordisContext,
  type MyMeterHostRuntime,
  type MyMeterProviderDescriptor,
  type ExchangeRateProvider,
} from "./index";
import {
  createCordisHistoryRecoverySource,
  createHistoryRecovery,
  type HistoryRecoveryCheckpoint,
  type HistoryReplaySession,
} from "./history-recovery";
import { resolvePricingCatalogKind } from "../../core/src/index";
import type { RemoteContextBreakdown } from "../../client/src/index";
import {
  RECOVERY_CHECKPOINT_SCHEMA_VERSION,
  createLedgerFingerprint,
  createDeepSeekBalanceService,
  createCostEventRepositoryForFormat,
  createRecoveryCheckpointPath,
  type CostEventLedgerFormat,
  type CostEventRepository,
  type DeepSeekBalanceService,
  loadRecoveryCheckpoint,
  saveRecoveryCheckpoint,
} from "../../host/src/index";
import {
  MYMETER_LOCAL_TYPERT_CONTRIBUTION,
  bindMyMeterTypertRemote,
  type TypertLocalContribution,
} from "./typert-remote";
import {
  registerMyMeterUpdateRpc,
  type MyMeterProductionUpdateOptions,
  type MyMeterUpdateRpcContext,
} from "./self-update";

export type { MyMeterCordisContext } from "./index";

const ACTIVE_REQUEST_EVENT = "mymeter:active_request";
const STREAMING_ESTIMATE_MIN_TOKEN_STEP = 8;
const STREAMING_ESTIMATE_MIN_INTERVAL_MS = 100;
const HISTORY_RECOVERY_SOURCE_KEY = "dsh-session-history";
const HISTORY_RECOVERY_PROJECTION_VERSION = "cordis-history-v2";
const HISTORY_CHECKPOINT_REFRESH_DEBOUNCE_MS = 250;

export interface MyMeterCordisHostOptions {
  ctx: MyMeterCordisContext;
  balance?: MyMeterBalanceProvider | undefined;
  providers?: (() => readonly MyMeterProviderDescriptor[]) | undefined;
  repository?: CostEventRepository | undefined;
  exchangeRate?: ExchangeRateProvider | undefined;
  ledgerPath?: string | undefined;
  ledgerFormat?: CostEventLedgerFormat | undefined;
}

export interface MyMeterTypertHostContext extends MyMeterCordisContext {
  baseUrl?: string;
  connection?: MyMeterUpdateRpcContext["connection"];
  credentials?: {
    resolve(ref: string): Promise<{ value: string; source: string } | undefined>;
  };
  settings?: {
    get(namespace: string): unknown;
    register?(
      namespace: string,
      schema: ((value: unknown) => Record<string, unknown>) & { toJSON(): unknown },
      options?: { base?: Record<string, unknown> },
    ): unknown;
  };
  llm?: {
    listProviders(): readonly { id: string; name: string }[];
    listConfigurableProviders?(): readonly {
      provider: string;
      displayName: string;
      settingsNs: string;
      settingsPath: readonly string[];
    }[];
  };
  reflect?: {
    provide(key: "mymeter" | (string & {}), service: object): (() => void) | void;
  };
  typert?: {
    register(contribution: TypertLocalContribution): (() => Promise<void>) | (() => void);
  };
}

export interface MyMeterCordisHostConfig {
  ledgerPath?: string;
  ledgerFormat?: CostEventLedgerFormat;
  balanceEnabled?: boolean;
  apiKeyEnv?: string;
  baseUrl?: string;
  balanceCacheTtlMs?: number;
  update?: MyMeterProductionUpdateOptions;
}

/**
 * Adapt dsh's durable `session/event` stream to MyMeter's provider-neutral
 * event envelope. Stream text is reduced immediately to UTF-8 byte counts;
 * message content and request bodies never enter the ledger or runtime state.
 */
export function createMyMeterCordisHostRuntime({
  ctx,
  balance,
  providers,
  repository,
  exchangeRate,
  ledgerPath,
  ledgerFormat,
}: MyMeterCordisHostOptions): MyMeterHostRuntime {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const sessionRefs = new Map<string, unknown>();
  const effectiveRepository = repository ?? (ledgerPath
    ? createCordisLedgerRepository(ctx, ledgerPath, ledgerFormat)
    : undefined);
  const checkpointController = ledgerPath && effectiveRepository?.ledgerFingerprint
    ? createCordisHistoryCheckpoint(ctx, ledgerPath, () => effectiveRepository.ledgerFingerprint?.() ?? createLedgerFingerprint(ledgerPath))
    : undefined;
  let projectionService: SessionProjectionService | null = null;
  captureOptionalProjectionService(ctx, (service) => {
    projectionService = service;
  });
  const emit = (event: string, payload: unknown): void => {
    for (const listener of listeners.get(event) ?? []) {
      listener(payload);
    }
  };
  const dsh: DshEventContext = {
    on(event, listener) {
      const set = listeners.get(event) ?? new Set<(payload: unknown) => void>();
      set.add(listener);
      listeners.set(event, set);
      return () => set.delete(listener);
    },
  };

  // Durable subagent parent links observed from session headers anywhere —
  // live events, startup listing, and history-recovery list/read. The cost
  // tree merges these at build time so nesting does not depend on per-request
  // metadata surviving the whole ingest pipeline.
  const observedParentLinks = new Map<string, string>();
  const noteSessionHeader = (session: unknown): void => {
    const record = asRecord(session);
    // Accepted shapes: the session object itself, {header}, a persistence
    // snapshot ref, or the query read payload {session: <storage header>}.
    const header = asRecord(record.header ?? record.session ?? record);
    const id = text(record.id ?? header.id);
    if (!id) return;
    if (observedParentLinks.has(id)) return;
    const parent = sessionParentLink({ id, header });
    if (parent && parent !== id) observedParentLinks.set(id, parent);
  };

  const runtime = createMyMeterHostRuntime({
    dsh,
    balance,
    providers,
    repository: effectiveRepository,
    exchangeRate,
    afterLedgerCommit: checkpointController
      ? () => checkpointController.refreshFingerprint()
      : undefined,
    onAfterLedgerCommitError: (error) => {
      ctx.logger?.warn(`mymeter: history checkpoint refresh failed (${errorMessage(error)})`);
    },
    contextBreakdown: (sessionId) => readContextBreakdown(projectionService, sessionRefs.get(sessionId)),
    observedSessionParents: () => Object.fromEntries(observedParentLinks),
  });
  const sessions = new Map<string, SessionState>();
  const seededEventCounts = new Map<string, number>();
  const liveSessionIds = new Set<string>();
  const seedSession = (session: unknown): boolean => {
    rememberSession(sessionRefs, session);
    const sessionId = text((session as SessionLike)?.id ?? (session as SessionLike)?.sessionId);
    const events = (session as { events?: unknown }).events;
    if (!sessionId || !Array.isArray(events) || events.length === 0) {
      // Header-only sightings still contribute their parent link.
      noteSessionHeader(session);
      return false;
    }
    noteSessionHeader(session);
    const seededCount = seededEventCounts.get(sessionId) ?? 0;
    if (seededEventCounts.has(sessionId) && events.length <= seededCount) return true;
    runtime.batch(() => {
      for (const event of events.slice(seededCount)) {
        bridgeSessionEvent(sessions, emit, session, event);
      }
      seededEventCounts.set(sessionId, events.length);
    });
    return true;
  };
  const history = createHistoryRecovery({
    source: createCordisHistoryRecoverySource(ctx, noteSessionHeader),
    checkpoint: checkpointController,
    target: {
      replayBatch(historySessions: readonly HistoryReplaySession[]) {
        let replayedSessions = 0;
        let eventsSeen = 0;
        runtime.batch(() => {
          for (const session of historySessions) {
            if (liveSessionIds.has(session.id)) continue;
            seedSession({ id: session.id, header: session.header, events: session.events });
            replayedSessions += 1;
            eventsSeen += session.events.length;
          }
        });
        return { replayedSessions, skippedUnchangedSessions: 0, eventsSeen };
      },
    },
    onStatus: (status) => {
      if (status.state === "failed" && status.lastError) {
        ctx.logger?.warn(`mymeter: history recovery failed (${status.lastError})`);
      }
    },
  });
  const stopEvent = ctx.on("session/event", (session, event) => {
    const seeded = seedSession(session);
    if (seeded) {
      markLiveSession(liveSessionIds, session);
      history.markLive(text((session as SessionLike)?.id ?? (session as SessionLike)?.sessionId));
    } else {
      rememberSession(sessionRefs, session);
      noteSessionHeader(session);
    }
    const sessionId = text((session as SessionLike)?.id ?? (session as SessionLike)?.sessionId);
    const events = (session as { events?: unknown }).events;
    if (sessionId && Array.isArray(events) && seeded) {
      // Some session implementations publish the event before appending it
      // to the exposed history array. In that case seeding alone would drop
      // the first live event (including a preset selection), so process it
      // when it is not already part of the seeded history.
      if (eventIsInHistory(events, event)) return;
      bridgeSessionEvent(sessions, emit, session, event);
      return;
    }
    bridgeSessionEvent(sessions, emit, session, event);
    if (sessionId && Array.isArray(events)) {
      seededEventCounts.set(sessionId, events.length);
    }
  });
  const stopCreated = ctx.on("session/created", (session) => {
    if (seedSession(session)) {
      markLiveSession(liveSessionIds, session);
      history.markLive(text((session as SessionLike)?.id ?? (session as SessionLike)?.sessionId));
    }
  });
  for (const session of ctx.sessions?.list() ?? []) {
    if (seedSession(session)) {
      markLiveSession(liveSessionIds, session);
      history.markLive(text((session as SessionLike)?.id ?? (session as SessionLike)?.sessionId));
    }
  }
  history.start();

  const uninstall = runtime.uninstall;
  return {
    ...runtime,
    uninstall() {
      history.cancel("runtime uninstall");
      stopCreated();
      stopEvent();
      sessions.clear();
      seededEventCounts.clear();
      liveSessionIds.clear();
      sessionRefs.clear();
      listeners.clear();
      uninstall();
      checkpointController?.flush();
    },
  };
}

export const name = "mymeter";
export const inject = ["typert", "sessions", "credentials", "settings", "llm", "connection"] as const;

/** Host-side Cordis entry point for a dsh package/bundle row. */
export function apply(ctx: MyMeterTypertHostContext, config: MyMeterCordisHostConfig = {}): () => Promise<void> {
  registerSettingsNamespace(ctx);
  const repository = config.ledgerPath
    ? createCordisLedgerRepository(ctx, config.ledgerPath, config.ledgerFormat)
    : undefined;
  const balanceRuntime = config.balanceEnabled === false
    ? undefined
    : createCordisBalanceProvider(ctx, config);
  const runtime = createMyMeterCordisHostRuntime({
    ctx,
    repository,
    balance: balanceRuntime?.provider,
    providers: () => readConfiguredProviders(ctx),
    ledgerPath: config.ledgerPath,
    ledgerFormat: config.ledgerFormat,
  });
  const service = bindMyMeterTypertRemote(runtime.remote);
  const cleanups: Array<() => void | Promise<void>> = [
    runtime.uninstall,
    balanceRuntime?.dispose ?? (() => {}),
  ];
  const unregisterUpdateRpc = registerMyMeterUpdateRpc(ctx, config.update);
  if (unregisterUpdateRpc) cleanups.push(unregisterUpdateRpc);
  const unprovide = ctx.reflect?.provide("mymeter", service);
  if (typeof unprovide === "function") cleanups.push(unprovide);
  cleanups.push(ctx.typert?.register(MYMETER_LOCAL_TYPERT_CONTRIBUTION) ?? (() => {}));

  const uninstall = async (): Promise<void> => {
    let firstError: unknown;
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        await cleanup();
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError !== undefined) throw firstError;
  };
  if (ctx.effect) {
    ctx.effect(() => uninstall, "mymeter: host runtime");
  }
  return uninstall;
}

function createCordisLedgerRepository(
  ctx: MyMeterCordisContext,
  ledgerPath: string,
  ledgerFormat: CostEventLedgerFormat = "json",
): CostEventRepository {
  return createCostEventRepositoryForFormat({
    ledgerPath,
    format: ledgerFormat,
    onJsonRecovery: ({ reason, quarantinePath, recoveredEventCount, rejectedEventCount }) => {
      const quarantine = quarantinePath ? `，原文件已移动到 ${quarantinePath}` : "";
      ctx.logger?.warn(
        `mymeter: 账本恢复（${reason}），保留 ${recoveredEventCount} 条、忽略 ${rejectedEventCount} 条${quarantine}`,
      );
    },
    onAppendRecovery: ({ reason }) => {
      ctx.logger?.warn(`mymeter: append ledger recovery (${reason})`);
    },
  });
}

function registerSettingsNamespace(ctx: MyMeterTypertHostContext): void {
  if (!ctx.settings?.register) return;
  const schema = ((value: unknown) => ({ ...asRecord(value) })) as
    ((value: unknown) => Record<string, unknown>) & { toJSON(): unknown };
  schema.toJSON = () => ({
    uid: 0,
    refs: { 0: { type: "object", meta: { default: {} }, dict: {} } },
  });
  ctx.settings.register("mymeter", schema, { base: {} });
}

function createCordisHistoryCheckpoint(
  ctx: MyMeterCordisContext,
  ledgerPath: string,
  ledgerFingerprint: () => string,
): HistoryRecoveryCheckpoint & { refreshFingerprint(): void; flush(): void } {
  const filePath = createRecoveryCheckpointPath(ledgerPath);
  const expectations = () => ({
    sourceKey: HISTORY_RECOVERY_SOURCE_KEY,
    projectionVersion: HISTORY_RECOVERY_PROJECTION_VERSION,
    ledgerFingerprint: ledgerFingerprint(),
  });
  const checkpoint = loadRecoveryCheckpoint(filePath, expectations(), (notice) => {
    const quarantine = notice.quarantinePath ? `，原文件已移动到 ${notice.quarantinePath}` : "";
    ctx.logger?.warn(`mymeter: history checkpoint recovery (${notice.reason})${quarantine}`);
  });
  let sessionRevisions = { ...(checkpoint?.sessionRevisions ?? {}) };
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  const save = (): void => {
    if (refreshTimer !== null) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    saveRecoveryCheckpoint(filePath, {
      schemaVersion: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
      ...expectations(),
      sessionRevisions,
    });
  };

  return {
    sessionRevisions,
    save(nextSessionRevisions) {
      sessionRevisions = { ...nextSessionRevisions };
      save();
    },
    refreshFingerprint() {
      if (refreshTimer !== null) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        try {
          save();
        } catch (error) {
          ctx.logger?.warn(`mymeter: history checkpoint refresh failed (${errorMessage(error)})`);
        }
      }, HISTORY_CHECKPOINT_REFRESH_DEBOUNCE_MS);
    },
    flush() {
      if (refreshTimer === null) return;
      try {
        save();
      } catch (error) {
        ctx.logger?.warn(`mymeter: history checkpoint flush failed (${errorMessage(error)})`);
      }
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readConfiguredProviders(ctx: MyMeterTypertHostContext): MyMeterProviderDescriptor[] {
  const registered = ctx.llm?.listProviders() ?? [];
  const configurable = ctx.llm?.listConfigurableProviders?.() ?? [];
  const directory = new Map(configurable.map((entry) => [entry.provider, entry]));
  return registered.map((provider) => {
    const entry = directory.get(provider.id);
    return {
      id: provider.id,
      name: entry?.displayName || provider.name || provider.id,
      balanceSupported: entry?.settingsNs === "llm-deepseek",
    };
  });
}

function createCordisBalanceProvider(
  ctx: MyMeterTypertHostContext,
  config: MyMeterCordisHostConfig,
): { provider: MyMeterBalanceProvider; dispose(): void } {
  let service: DeepSeekBalanceService | null = null;
  let serviceBaseUrl = "";

  const connection = (): { apiKeyEnv: string; baseUrl: string } => {
    const settings = asRecord(ctx.settings?.get("llm-deepseek"));
    const launchEnvironment = ctx.get?.("launchEnvironment") as
      | { get(name: string): { value: string } | undefined }
      | undefined;
    const environmentValue = (name: string): string | undefined =>
      launchEnvironment?.get(name)?.value ?? process.env[name];
    return {
      apiKeyEnv: text(config.apiKeyEnv) || text(settings.apiKeyEnv) || "DEEPSEEK_API_KEY",
      baseUrl: text(config.baseUrl)
        || text(settings.baseURL)
        || text(environmentValue("DEEPSEEK_BASE_URL"))
        || "https://api.deepseek.com",
    };
  };

  const provider: MyMeterBalanceProvider = async (options) => {
    const current = connection();
    if (!service || serviceBaseUrl !== current.baseUrl) {
      serviceBaseUrl = current.baseUrl;
      service = createDeepSeekBalanceService({
        baseUrl: current.baseUrl,
        ...(config.balanceCacheTtlMs !== undefined
          ? { cacheTtlMs: config.balanceCacheTtlMs }
          : {}),
        resolveApiKey: async () => {
          const ref = connection().apiKeyEnv;
          const credentials = ctx.credentials
            ?? ctx.get?.("credentials") as MyMeterTypertHostContext["credentials"];
          if (credentials) {
            const resolved = await credentials.resolve(ref);
            return resolved?.value.trim() ? resolved.value : undefined;
          }
          const launchEnvironment = ctx.get?.("launchEnvironment") as
            | { get(name: string): { value: string } | undefined }
            | undefined;
          const ambient = launchEnvironment?.get(ref)?.value ?? process.env[ref];
          return ambient?.trim() ? ambient : undefined;
        },
      });
    }
    return service.getSnapshot(options);
  };

  const invalidate = (): void => service?.clearCache();
  const cleanups = [
    ctx.on("credentials/updated", () => invalidate()),
    ctx.on("settings/updated", () => invalidate()),
  ];
  return {
    provider,
    dispose() {
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
      service?.clearCache();
      service = null;
    },
  };
}

interface SessionState {
  provider: string;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
  parentSessionId: string | undefined;
  startedAt: number | string | null;
  turn: number | null;
  step: number | null;
  attemptId: string;
  pendingRequestActivity: boolean;
  retryIds: Map<string, string>;
  requests: Map<string, RequestMetadataSnapshot>;
}

interface RequestMetadataSnapshot {
  provider: string;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
  parentSessionId?: string | undefined;
  startedAt: number | string | null;
  attemptId: string;
  metadataLocked: boolean;
  requestActivityObserved: boolean;
  latestUsage?: UnknownRecord;
  latestUsageAuthoritative?: boolean;
  latestEstimate?: UnknownRecord;
  streamingEstimate?: StreamingEstimateState;
  finalized?: boolean;
}

interface StreamingEstimateState {
  blockBytes: Map<string, StreamingBlockBytes>;
  outputBytes: number;
  reasoningBytes: number;
  lastEmittedOutputTokens: number;
  lastEmittedAt: number | null;
}

interface StreamingBlockBytes {
  outputBytes: number;
  reasoningBytes: number;
}

interface SessionLike {
  id?: unknown;
  sessionId?: unknown;
  agentPreset?: unknown;
  header?: unknown;
}

interface SessionProjectionService {
  snapshot(session: unknown): {
    values?: Record<string, unknown>;
  };
}

type UnknownRecord = Record<string, unknown>;

function rememberSession(sessionRefs: Map<string, unknown>, session: unknown): void {
  const sessionId = text((session as SessionLike)?.id ?? (session as SessionLike)?.sessionId);
  if (sessionId) {
    sessionRefs.set(sessionId, session);
  }
}

function captureOptionalProjectionService(
  ctx: MyMeterCordisContext,
  update: (service: SessionProjectionService | null) => void,
): void {
  if (typeof ctx.inject === "function") {
    ctx.inject(["sessionProjections"], (projectionCtx) => {
      update(asProjectionService(projectionCtx.sessionProjections));
      return () => update(null);
    });
    return;
  }

  // Lightweight test and embedding contexts may expose services directly.
  try {
    update(asProjectionService(ctx.sessionProjections ?? ctx.get?.("sessionProjections")));
  } catch {
    update(null);
  }
}

function markLiveSession(liveSessionIds: Set<string>, session: unknown): void {
  const sessionId = text((session as SessionLike)?.id ?? (session as SessionLike)?.sessionId);
  if (sessionId) liveSessionIds.add(sessionId);
}

function readContextBreakdown(
  projections: SessionProjectionService | null,
  session: unknown,
): RemoteContextBreakdown | null {
  if (!session || !projections) {
    return null;
  }

  try {
    const values = projections.snapshot(session).values;
    return normalizeContextBreakdown(values?.contextBreakdown);
  } catch {
    return null;
  }
}

function asProjectionService(value: unknown): SessionProjectionService | null {
  return value && typeof value === "object" && typeof (value as SessionProjectionService).snapshot === "function"
    ? value as SessionProjectionService
    : null;
}

function normalizeContextBreakdown(value: unknown): RemoteContextBreakdown | null {
  const record = asRecord(value);
  const systemTokens = nonNegativeFiniteNumber(record.systemTokens);
  const toolsTokens = nonNegativeFiniteNumber(record.toolsTokens);
  const messageTokens = nonNegativeFiniteNumber(record.messageTokens);
  if (systemTokens === null || toolsTokens === null || messageTokens === null) {
    return null;
  }
  return { systemTokens, toolsTokens, messageTokens };
}

function bridgeSessionEvent(
  sessions: Map<string, SessionState>,
  emit: (event: string, payload: unknown) => void,
  session: unknown,
  event: unknown,
): void {
  const sessionId = text((session as SessionLike)?.id ?? (session as SessionLike)?.sessionId);
  const record = asRecord(event);
  const type = text(record.type);
  if (!sessionId || !type) return;

  const state = sessions.get(sessionId) ?? createSessionState();
  sessions.set(sessionId, state);
  if (state.agentPreset === "unknown") {
    state.agentPreset = sessionAgentPreset(session) || state.agentPreset;
  }
  if (state.parentSessionId === undefined) {
    state.parentSessionId = sessionParentLink(session);
  }
  const data = asRecord(record.data);
  const time = finiteTime(record.time);

  if (type === "agent-preset/selected") {
    const agentPreset = text(data.agentPreset);
    if (agentPreset) {
      state.agentPreset = agentPreset;
      const request = currentRequest(state);
      if (request && !request.metadataLocked && !request.requestActivityObserved && !request.finalized) {
        request.agentPreset = agentPreset;
      }
    }
    return;
  }
  if (type === "request/header") {
    const header = asRecord(data.header);
    const config = asRecord(header.config);
    state.provider = text(config.provider) || state.provider;
    state.model = text(config.model) || state.model;
    state.reasoningEffort = text(config.reasoningEffort) || state.reasoningEffort;
    completeActiveRequestMetadata(state);
    markRequestActivity(state);
    emitActiveRequest(emit, sessionId, state, time);
    return;
  }
  if (type === "request/context") {
    state.provider = text(data.provider) || state.provider;
    state.model = text(data.model) || state.model;
    completeActiveRequestMetadata(state);
    markRequestActivity(state);
    emitActiveRequest(emit, sessionId, state, time);
    return;
  }
  if (type === "llm/retry") {
    const turn = integer(data.turn);
    const step = integer(data.step);
    const retryId = text(data.retryId);
    if (turn !== null && step !== null && retryId) state.retryIds.set(requestKey(turn, step), retryId);
    return;
  }
  if (type === "llm/retry-started") {
    const turn = integer(data.turn);
    const step = integer(data.step);
    const retryId = text(data.retryId);
    if (turn === null || step === null || !retryId) return;

    const previousRequest = state.requests.get(requestKey(turn, step));
    clearActiveRequest(emit, sessionId, turn, step, previousRequest);
    if (previousRequest && previousRequest.startedAt !== null && !previousRequest.finalized) {
      if (previousRequest.requestActivityObserved) {
        const previousPayload = {
          id: `${sessionId}:${String(record.seq ?? type)}:previous-attempt`,
          requestStartedAt: previousRequest.startedAt,
          completedAt: time,
          metadata: requestMetadata(sessionId, turn, step, previousRequest),
          requestOutcome: "failed",
        };
        if (!previousRequest.latestUsageAuthoritative && previousRequest.latestEstimate) {
          emit("mymeter:projection", {
            ...previousPayload,
            projection: toProjection(previousRequest.latestEstimate),
          });
        } else {
          emit("mymeter:final_usage", {
            ...previousPayload,
            ...(previousRequest.latestUsageAuthoritative && previousRequest.latestUsage
              ? { usage: toUsage(previousRequest.latestUsage) }
              : {}),
          });
        }
      }
      previousRequest.finalized = true;
    }
    state.retryIds.set(`${String(turn)}:${String(step)}`, retryId);
    if (turn === state.turn && step === state.step) {
      state.attemptId = retryId;
      state.startedAt = time;
    }
    freezeRequestMetadata(state, turn, step, retryId, time);
    emitActiveRequestFor(emit, sessionId, turn, step, state.requests.get(requestKey(turn, step)), time);
    return;
  }
  if (type === "step/start") {
    clearActiveRequest(emit, sessionId, state.turn, state.step, currentRequest(state));
    state.turn = integer(data.turn);
    state.step = integer(data.step);
    state.startedAt = time;
    state.attemptId = state.turn !== null && state.step !== null
      ? state.retryIds.get(requestKey(state.turn, state.step)) ?? "attempt-0"
      : "attempt-0";
    if (state.turn !== null && state.step !== null) {
      freezeRequestMetadata(state, state.turn, state.step, state.attemptId, state.startedAt);
      state.pendingRequestActivity = false;
      emitActiveRequest(emit, sessionId, state, time);
    }
    return;
  }
  if (type === "turn/end") {
    const turn = integer(data.turn);
    const outcome = turnEndOutcome(data.reason);
    if (turn === null || !outcome || turn !== state.turn || state.step === null) return;
    const request = state.requests.get(requestKey(turn, state.step));
    if (!request || request.startedAt === null || request.finalized) return;

    if (!request.requestActivityObserved) {
      clearActiveRequest(emit, sessionId, turn, state.step, request);
      request.finalized = true;
      return;
    }

    if (outcome !== "success" && !request.latestUsageAuthoritative && request.latestEstimate) {
      clearActiveRequest(emit, sessionId, turn, state.step, request);
      emit("mymeter:projection", {
        id: `${sessionId}:${String(record.seq ?? type)}`,
        requestStartedAt: request.startedAt,
        completedAt: time,
        metadata: requestMetadata(sessionId, turn, state.step, request),
        projection: toProjection(request.latestEstimate),
        requestOutcome: outcome,
      });
      request.finalized = true;
      return;
    }

    emit("mymeter:final_usage", {
      id: `${sessionId}:${String(record.seq ?? type)}`,
      requestStartedAt: request.startedAt,
      completedAt: time,
      metadata: requestMetadata(sessionId, turn, state.step, request),
      ...(outcome !== "success" && request.latestUsageAuthoritative && request.latestUsage
        ? { usage: toUsage(request.latestUsage) }
        : {}),
      requestOutcome: outcome,
    });
    request.finalized = true;
    return;
  }
  if (type !== "assistant/chunk" && type !== "assistant/message") return;

  const turn = integer(data.turn) ?? state.turn;
  const step = integer(data.step) ?? state.step;
  if (turn === null || step === null) return;
  const request = state.requests.get(requestKey(turn, step));
  if (!request || request.startedAt === null) return;
  request.requestActivityObserved = true;

  const usage = type === "assistant/message"
    ? asRecord(data.usage)
    : usageFromChunk(data.chunk);
  if (type === "assistant/message") {
    completeRequestMetadataFromAssistantMessage(request, data);
  }
  const metadata = requestMetadata(sessionId, turn, step, request);
  const common = {
    id: `${sessionId}:${String(record.seq ?? type)}`,
    requestStartedAt: request.startedAt,
    metadata,
  };

  if (type === "assistant/chunk") {
    if (Object.keys(usage).length > 0) {
      request.metadataLocked = true;
      request.latestUsage = usage;
      request.latestUsageAuthoritative = true;
      emit("mymeter:projection", { ...common, projection: toProjection(usage) });
      return;
    }

    if (request.latestUsageAuthoritative || !supportsStreamingEstimate(request)) return;
    const estimate = updateStreamingEstimate(request, data.chunk, time);
    if (!estimate) return;
    request.metadataLocked = true;
    request.latestEstimate = estimate;
    emit("mymeter:projection", { ...common, projection: toProjection(estimate) });
    return;
  }

  // Some finalized assistant messages omit usage. Keep the reliable projection
  // open so a later turn/end can preserve the estimate or classify a failure.
  if (data.usage === undefined || data.usage === null) return;

  request.metadataLocked = true;
  emit("mymeter:final_usage", {
    ...common,
    completedAt: time,
    usage: toUsage(usage),
    requestOutcome: "success",
  });
  request.latestUsage = usage;
  request.latestUsageAuthoritative = true;
  request.finalized = true;
}

function createSessionState(): SessionState {
  return {
    provider: "unknown",
    model: "unknown",
    reasoningEffort: "unknown",
    agentPreset: "unknown",
    parentSessionId: undefined,
    startedAt: null,
    turn: null,
    step: null,
    attemptId: "attempt-0",
    pendingRequestActivity: false,
    retryIds: new Map(),
    requests: new Map(),
  };
}

function sessionAgentPreset(session: unknown): string {
  const record = asRecord(session);
  return text(asRecord(record.header).agentPreset) || text(record.agentPreset);
}

/**
 * dsh marks subagent child sessions on their durable header: `origin` is
 * "subagent", `delegationDepth` is positive, and `parentSession` names the
 * delegating session. Forked sessions also carry `parentSession` (seed
 * lineage) but are NOT subagents, so the origin/depth signals gate the link.
 */
function sessionParentLink(session: unknown): string | undefined {
  const record = asRecord(session);
  const header = asRecord(record.header);
  const origin = text(header.origin) || text(record.origin);
  const rawDepth = header.delegationDepth ?? record.delegationDepth;
  const delegated = origin === "subagent"
    || (typeof rawDepth === "number" && Number.isSafeInteger(rawDepth) && rawDepth > 0);
  if (!delegated) return undefined;
  return text(header.parentSession)
    || text(record.parentSession)
    || text(asRecord(record.session).parentSession)
    || undefined;
}

function eventIsInHistory(events: readonly unknown[], event: unknown): boolean {
  if (events.includes(event)) return true;
  const sequence = asRecord(event).seq;
  if (typeof sequence !== "number" || !Number.isSafeInteger(sequence)) return false;
  return events.some((entry) => {
    const entrySequence = asRecord(entry).seq;
    return typeof entrySequence === "number"
      && Number.isSafeInteger(entrySequence)
      && entrySequence === sequence;
  });
}

function freezeRequestMetadata(
  state: SessionState,
  turn: number,
  step: number,
  attemptId: string,
  startedAt: number | string | null,
): void {
  state.requests.set(requestKey(turn, step), {
    provider: state.provider,
    model: state.model,
    reasoningEffort: state.reasoningEffort,
    agentPreset: state.agentPreset,
    parentSessionId: state.parentSessionId,
    startedAt,
    attemptId,
    metadataLocked: false,
    requestActivityObserved: state.pendingRequestActivity,
  });
}

function markRequestActivity(state: SessionState): void {
  const request = currentRequest(state);
  if (request && !request.finalized) {
    request.requestActivityObserved = true;
    return;
  }
  state.pendingRequestActivity = true;
}

function completeActiveRequestMetadata(state: SessionState): void {
  if (state.turn === null || state.step === null) return;
  const request = state.requests.get(requestKey(state.turn, state.step));
  if (!request || request.metadataLocked || request.finalized) return;

  request.provider = state.provider;
  request.model = state.model;
  request.reasoningEffort = state.reasoningEffort;
  if (request.parentSessionId === undefined && state.parentSessionId !== undefined) {
    request.parentSessionId = state.parentSessionId;
  }
}

function completeRequestMetadataFromAssistantMessage(request: RequestMetadataSnapshot, data: UnknownRecord): void {
  const message = asRecord(data.message);
  const source = asRecord(message.source);
  const provider = text(source.provider);
  const model = text(source.model);
  const reasoningEffort = text(source.reasoningEffort);

  if (provider && request.provider === "unknown") request.provider = provider;
  if (model && request.model === "unknown") request.model = model;
  if (reasoningEffort && request.reasoningEffort === "unknown") request.reasoningEffort = reasoningEffort;
}

function currentRequest(state: SessionState): RequestMetadataSnapshot | undefined {
  return state.turn === null || state.step === null ? undefined : state.requests.get(requestKey(state.turn, state.step));
}

function emitActiveRequest(
  emit: (event: string, payload: unknown) => void,
  sessionId: string,
  state: SessionState,
  lastActivityAt: number | string | null,
): void {
  if (state.turn === null || state.step === null) return;
  emitActiveRequestFor(emit, sessionId, state.turn, state.step, currentRequest(state), lastActivityAt);
}

function emitActiveRequestFor(
  emit: (event: string, payload: unknown) => void,
  sessionId: string,
  turn: number,
  step: number,
  request: RequestMetadataSnapshot | undefined,
  lastActivityAt: number | string | null,
): void {
  if (!request || request.startedAt === null || request.finalized) return;

  emit(ACTIVE_REQUEST_EVENT, {
    action: "upsert",
    requestStartedAt: request.startedAt,
    lastActivityAt: lastActivityAt ?? request.startedAt,
    metadata: requestMetadata(sessionId, turn, step, request),
  });
}

function clearActiveRequest(
  emit: (event: string, payload: unknown) => void,
  sessionId: string,
  turn: number | null,
  step: number | null,
  request: RequestMetadataSnapshot | undefined,
): void {
  if (turn === null || step === null || !request || request.startedAt === null || request.finalized) return;

  emit(ACTIVE_REQUEST_EVENT, {
    action: "clear",
    requestStartedAt: request.startedAt,
    metadata: requestMetadata(sessionId, turn, step, request),
  });
}

function requestKey(turn: number, step: number): string {
  return `${String(turn)}:${String(step)}`;
}

function requestMetadata(
  sessionId: string,
  turn: number,
  step: number,
  request: RequestMetadataSnapshot,
): UnknownRecord {
  return {
    sessionId,
    turnId: String(turn),
    stepId: String(step),
    attemptId: request.attemptId,
    provider: request.provider,
    model: request.model,
    reasoningEffort: request.reasoningEffort,
    agentPreset: request.agentPreset,
    ...(request.parentSessionId ? { parentSessionId: request.parentSessionId } : {}),
  };
}

function turnEndOutcome(reason: unknown): "success" | "failed" | "aborted" | null {
  const kind = text(asRecord(reason).kind);
  if (kind === "completed" || kind === "max-tokens") return "success";
  if (kind === "aborted" || kind === "interrupted") return "aborted";
  if (kind === "error" || kind === "blocked") return "failed";
  return null;
}

function usageFromChunk(chunk: unknown): UnknownRecord {
  const record = asRecord(chunk);
  return record.type === "usage" ? asRecord(record.usage) : {};
}

function supportsStreamingEstimate(request: RequestMetadataSnapshot): boolean {
  return resolvePricingCatalogKind(request.provider, request.model) !== null;
}

function updateStreamingEstimate(
  request: RequestMetadataSnapshot,
  chunk: unknown,
  activityAt: number | null,
): UnknownRecord | null {
  const record = asRecord(chunk);
  const type = text(record.type);
  if (!type) return null;

  if (type === "reasoning-delta" || type === "text-delta" || type === "tool-call-delta") {
    const bytes = contentByteLength(record);
    if (bytes <= 0) return null;
    addStreamingBlockBytes(request, streamingBlockKey(record), bytes, type === "reasoning-delta" ? bytes : 0);
    return streamingEstimateUsage(request, false, activityAt);
  }

  if (type !== "block-end") return null;
  const bytes = blockEndContentByteLength(record);
  if (bytes > 0) {
    const state = streamingEstimateState(request);
    const key = streamingBlockKey(record);
    const block = state.blockBytes.get(key) ?? { outputBytes: 0, reasoningBytes: 0 };
    const outputBytes = Math.max(block.outputBytes, bytes);
    const reasoningBytes = isReasoningBlockEnd(record) ? Math.max(block.reasoningBytes, bytes) : block.reasoningBytes;
    state.outputBytes += outputBytes - block.outputBytes;
    state.reasoningBytes += reasoningBytes - block.reasoningBytes;
    state.blockBytes.set(key, { outputBytes, reasoningBytes });
  }
  return streamingEstimateUsage(request, true, activityAt);
}

function addStreamingBlockBytes(
  request: RequestMetadataSnapshot,
  key: string,
  outputBytes: number,
  reasoningBytes: number,
): void {
  const state = streamingEstimateState(request);
  const block = state.blockBytes.get(key) ?? { outputBytes: 0, reasoningBytes: 0 };
  block.outputBytes += outputBytes;
  block.reasoningBytes += reasoningBytes;
  state.outputBytes += outputBytes;
  state.reasoningBytes += reasoningBytes;
  state.blockBytes.set(key, block);
}

function streamingEstimateState(request: RequestMetadataSnapshot): StreamingEstimateState {
  request.streamingEstimate ??= {
    blockBytes: new Map(),
    outputBytes: 0,
    reasoningBytes: 0,
    lastEmittedOutputTokens: 0,
    lastEmittedAt: null,
  };
  return request.streamingEstimate;
}

function streamingEstimateUsage(
  request: RequestMetadataSnapshot,
  forceEmit: boolean,
  activityAt: number | null,
): UnknownRecord | null {
  const state = request.streamingEstimate;
  if (!state) return null;

  const outputTokens = estimateTokensFromBytes(state.outputBytes);
  if (outputTokens <= 0) return null;
  if (
    !forceEmit
      && state.lastEmittedOutputTokens > 0
      && (
        outputTokens - state.lastEmittedOutputTokens < STREAMING_ESTIMATE_MIN_TOKEN_STEP
        || (activityAt !== null
          && state.lastEmittedAt !== null
          && activityAt - state.lastEmittedAt < STREAMING_ESTIMATE_MIN_INTERVAL_MS)
      )
  ) {
    return null;
  }

  state.lastEmittedOutputTokens = outputTokens;
  if (activityAt !== null) state.lastEmittedAt = activityAt;
  return {
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens,
    reasoningTokens: Math.min(estimateTokensFromBytes(state.reasoningBytes), outputTokens),
  };
}

function estimateTokensFromBytes(bytes: number): number {
  return Math.ceil(bytes / 4);
}

function streamingBlockKey(record: UnknownRecord): string {
  const block = asRecord(record.block);
  const index = record.index ?? record.blockIndex ?? record.block_index ?? block.index;
  if (typeof index === "number" && Number.isSafeInteger(index)) return String(index);
  if (typeof index === "string" && index.trim()) return index.trim();
  return `unknown:${text(record.type) || "block"}`;
}

function blockEndContentByteLength(record: UnknownRecord): number {
  const block = record.block ?? record.item ?? record.message ?? record.content ?? record;
  return contentByteLength(block);
}

function isReasoningBlockEnd(record: UnknownRecord): boolean {
  const block = asRecord(record.block ?? record.item ?? record.message ?? record.content);
  const type = text(block.type ?? block.kind ?? record.blockType ?? record.block_type);
  return type.includes("reasoning") || typeof block.reasoning === "string" || typeof record.reasoning === "string";
}

function contentByteLength(value: unknown): number {
  if (typeof value === "string") return Buffer.byteLength(value, "utf8");
  if (Array.isArray(value)) return value.reduce((total, item) => total + contentByteLength(item), 0);
  if (!value || typeof value !== "object") return 0;

  const record = asRecord(value);
  const keys = [
    "text",
    "content",
    "delta",
    "argumentsDelta",
    "arguments",
    "args",
    "input",
    "value",
    "reasoning",
    "reasoningText",
    "reasoning_content",
  ];
  for (const key of keys) {
    const bytes = contentByteLength(record[key]);
    if (bytes > 0) return bytes;
  }
  return 0;
}

function toProjection(usage: UnknownRecord): UnknownRecord {
  const normalized = normalizeBridgeUsage(usage);
  return {
    ...normalized,
    reliability: 1,
  };
}

function toUsage(usage: UnknownRecord): UnknownRecord {
  return normalizeBridgeUsage(usage);
}

function normalizeBridgeUsage(usage: UnknownRecord): UnknownRecord {
  const promptDetails = asRecord(usage.promptTokensDetails ?? usage.prompt_tokens_details);
  const completionDetails = asRecord(usage.completionTokensDetails ?? usage.completion_tokens_details);
  const cacheHitTokens = firstTokenNumber(
    usage.cacheReadTokens,
    usage.cache_read_tokens,
    usage.cacheHitTokens,
    usage.cache_hit_tokens,
    usage.cachedTokens,
    usage.cached_tokens,
    promptDetails.cachedTokens,
    promptDetails.cached_tokens,
  ) ?? 0;
  const cacheWriteTokens = firstTokenNumber(usage.cacheWriteTokens, usage.cache_write_tokens) ?? 0;
  const explicitCacheMissTokens = firstTokenNumber(usage.cacheMissTokens, usage.cache_miss_tokens);
  const disjointInputTokens = firstTokenNumber(usage.inputTokens, usage.input_tokens);
  const promptTokens = firstTokenNumber(usage.promptTokens, usage.prompt_tokens);
  const cacheMissTokens = explicitCacheMissTokens
    ?? (disjointInputTokens !== null
      ? disjointInputTokens
      : promptTokens !== null
        ? Math.max(promptTokens - cacheHitTokens - cacheWriteTokens, 0)
        : 0);
  return {
    cacheHitTokens,
    cacheMissTokens,
    ...(cacheWriteTokens > 0 ? { cacheWriteTokens } : {}),
    outputTokens: firstTokenNumber(
      usage.outputTokens,
      usage.output_tokens,
      usage.completionTokens,
      usage.completion_tokens,
    ) ?? 0,
    reasoningTokens: firstTokenNumber(
      usage.reasoningTokens,
      usage.reasoning_tokens,
      completionDetails.reasoningTokens,
      completionDetails.reasoning_tokens,
    ) ?? 0,
  };
}

function firstTokenNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  }
  return null;
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function nonNegativeFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function finiteTime(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export { buildSessionCostTree } from "./session-cost-tree";
export type {
  BuildSessionCostTreeOptions,
  MissingParentSession,
  SessionCostTree,
  SessionCostTreeEvent,
  SessionCostTreeNode,
} from "./session-cost-tree";
