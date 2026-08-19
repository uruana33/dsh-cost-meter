import { createElement, type ReactNode } from "react";

import {
  DEEPSEEK_PRICE_VERSION,
  USD_CNY_EXCHANGE_RATE_LABEL,
  calculateDeepSeekUsageCost,
  calculateXaiUsageCost,
  calculateProviderUsageCost,
  createCostEventKey,
  createCostEventJournal,
  createUnknownCostEvent,
  createXaiPriceDirectory,
  estimateDeepSeekCostEvent,
  estimateXaiCostEvent,
  estimateProviderCostEvent,
  finalizeDeepSeekCostEvent,
  finalizeXaiCostEvent,
  finalizeProviderCostEvent,
  resolveDeepSeekPricingZone,
  resolvePricingCatalogKind,
  listPriceCatalogProviders,
  type CostEvent,
  type CostEventIdentity,
  type CostRequestOutcome,
  type DateInput,
  type EstimateDeepSeekCostEventInput,
  type FinalizeDeepSeekCostEventInput,
  type EstimateXaiCostEventInput,
  type EstimateProviderCostEventInput,
  type FinalizeXaiCostEventInput,
  type FinalizeProviderCostEventInput,
  type PricingCatalogKind,
  type UsageProjectionInput,
} from "../../core/src/index";
import { lookupAdditionalPrice } from "../../core/src/pricing/index";
import {
  createHostMetadataAdapter,
  createHostProjectionAdapter,
  createHostUsageAdapter,
  createBillingReadModel,
  createHostCostAnalyticsReport,
  createInMemoryCostEventRepository,
  createLedgerAggregator,
  exportCostEventLedger,
  type BalanceSnapshot,
  type CostEventRecord as HostCostEventRecord,
  type CostEventInput as HostCostEventInput,
  type CostEventRepository,
  type LedgerAggregation,
  type LedgerSummary,
  type TokenProjectionRecord,
  type TokenUsageRecord,
} from "../../host/src/index";
import type { MyMeterBalanceDto } from "../../shared/src/index";
import {
  ShellOverlay,
  createMyMeterStore,
  type MyMeterRemote,
  type MyMeterRemoteSnapshot,
  type RemoteCostAnalyticsReport,
  type RemoteContextBreakdown,
  type RemoteCurrencyTotal,
  type RemoteExchangeRateSnapshot,
  type RemoteLedgerExportFormat,
  type RemoteProviderBalanceSnapshot,
  type RemoteSessionCostTree,
  type RemoteSessionDetail,
  type RemoteSessionSummary,
  type RemoteTurn,
  type StorageLike,
} from "../../client/src/index";
import type { RemoteSessionStage } from "../../client/src/store";
import { buildSessionCostTree } from "./session-cost-tree";

export interface DshEventContext {
  on(event: string, listener: (payload: unknown) => void): () => void;
}

/** Structural subset of a real Cordis host context used by the runtime bridge. */
export interface MyMeterCordisContext {
  on(event: "session/event" | (string & {}), listener: (session: unknown, event: unknown) => void): () => void;
  effect?(factory: () => (() => void | Promise<void>) | void, label?: string): unknown;
  inject?(
    services: readonly string[],
    callback: (ctx: MyMeterCordisContext) => void | (() => void),
  ): unknown;
  get?(key: string): unknown;
  logger?: {
    warn(message: string): void;
  };
  sessions?: {
    list(): readonly unknown[];
  };
  sessionQuery?: MyMeterSessionQueryService;
  sessionPersistence?: MyMeterSessionPersistenceService;
  sessionProjections?: {
    snapshot(session: unknown): {
      values?: Record<string, unknown>;
    };
  };
}

/** Structural subset of dsh's exact logical session-history reader. */
export interface MyMeterSessionQueryService {
  listSessions(signal?: AbortSignal): Promise<readonly unknown[]>;
  readSession(sessionId: string): Promise<unknown>;
}

/** Structural fallback for dsh deployments without the session-query service. */
export interface MyMeterSessionPersistenceService {
  list(signal?: AbortSignal): Promise<readonly unknown[]>;
  inspect(sessionId: string, signal?: AbortSignal): Promise<unknown>;
  listSnapshots?(signal?: AbortSignal): Promise<readonly unknown[]>;
}

export interface MyMeterSlotContext {
  register(slot: "shell.overlay" | (string & {}), contribution: ReactNode): () => void;
}

export type MyMeterBalanceProvider = () => Promise<MyMeterBalanceDto | BalanceSnapshot>;

export interface MyMeterProviderDescriptor {
  id: string;
  name: string;
  balanceSupported: boolean;
}

export interface MyMeterHostRuntimeOptions {
  dsh: DshEventContext;
  balance?: MyMeterBalanceProvider | undefined;
  providers?: (() => readonly MyMeterProviderDescriptor[]) | undefined;
  contextBreakdown?: ((sessionId: string) => RemoteContextBreakdown | null) | undefined;
  repository?: CostEventRepository | undefined;
  now?: () => Date | undefined;
  exchangeRate?: ExchangeRateProvider | undefined;
  afterLedgerCommit?: (() => void) | undefined;
  onAfterLedgerCommitError?: ((error: unknown) => void) | undefined;
}

export interface ExchangeRateProvider {
  (): Promise<{ rate: number; fetchedAt?: string | undefined; source?: string | undefined }>;
}

export interface MyMeterClientPluginOptions {
  slots: MyMeterSlotContext;
  remote: MyMeterRemote;
  storage?: StorageLike | null | undefined;
  storageKey?: string | undefined;
}

export interface MyMeterHostRemoteContribution extends MyMeterRemote {
  listSessions(): Promise<RemoteSessionSummary[]>;
  getSessionDetail(sessionId: string): Promise<RemoteSessionDetail | null>;
  getSessionCostTree(): Promise<RemoteSessionCostTree>;
  getCostAnalytics(): Promise<RemoteCostAnalyticsReport>;
  exportLedger(format: RemoteLedgerExportFormat): Promise<string>;
  getBalance(): Promise<MyMeterRemoteSnapshot["balance"]>;
  getSettings(): Promise<Record<string, unknown>>;
  refreshExchangeRate(): Promise<RemoteExchangeRateSnapshot>;
}

export interface MyMeterHostRuntime {
  readonly remote: MyMeterHostRemoteContribution;
  events(): CostEvent[];
  ledger(): LedgerSummary;
  aggregation(): LedgerAggregation;
  batch<T>(callback: () => T): T;
  uninstall(): void;
}

export interface MyMeterClientPlugin {
  uninstall(): void;
}

type DshPayload = Record<string, unknown>;
type LedgerCommitRepository = CostEventRepository & {
  commit?(events: readonly HostCostEventInput[]): void;
};

const PROJECTION_EVENT = "mymeter:projection";
const FINAL_USAGE_EVENT = "mymeter:final_usage";
const ACTIVE_REQUEST_EVENT = "mymeter:active_request";

interface ActiveRequestState extends CostEventIdentity {
  eventKey: string;
  requestStartedAt: string;
  lastActivityAt: string;
  provider: string;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
}

export function createMyMeterHostRuntime({
  dsh,
  balance,
  providers,
  contextBreakdown,
  repository: configuredRepository,
  exchangeRate: configuredExchangeRate,
  afterLedgerCommit,
  onAfterLedgerCommitError,
}: MyMeterHostRuntimeOptions): MyMeterHostRuntime {
  const metadataAdapter = createHostMetadataAdapter();
  const projectionAdapter = createHostProjectionAdapter();
  const usageAdapter = createHostUsageAdapter();
  const repository = (configuredRepository ?? createInMemoryCostEventRepository()) as LedgerCommitRepository;
  const journal = createCostEventJournal(
    repository.list().map(toCoreCostEvent).filter((event): event is CostEvent => event !== null),
  );
  const readModel = createBillingReadModel<CostEvent>({ equals: sameCostEvent });
  readModel.rebuild(journal.list());
  const aggregator = createLedgerAggregator();
  const activeRequests = new Map<string, ActiveRequestState>();
  const listeners = new Set<(snapshot: MyMeterRemoteSnapshot) => void>();
  const cleanups: Array<() => void> = [];
  const dirtyEventKeys = new Set<string>();
  let batchDepth = 0;
  let ledgerDirty = false;
  let snapshotDirty = false;
  let installed = true;
  let lastBalance: MyMeterRemoteSnapshot["balance"] = {
    status: "unavailable",
    currency: null,
    totalMicroCny: null,
    grantedMicroCny: null,
    toppedUpMicroCny: null,
    refreshedAt: null,
  };
  let latestExchangeRate: RemoteExchangeRateSnapshot = {
    status: "idle",
    baseCurrency: "USD",
    quoteCurrency: "CNY",
    rate: null,
    fetchedAt: null,
    source: null,
    error: null,
  };
  const readProviders = (): readonly MyMeterProviderDescriptor[] => {
    if (providers) return providers();
    return balance ? [{ id: "deepseek", name: "DeepSeek", balanceSupported: true }] : [];
  };

  let cachedSnapshot: MyMeterRemoteSnapshot | null = null;
  let cachedProviderFingerprint = "";
  let cachedContextFingerprint = "";
  let exchangeRateGeneration = 0;
  const activeRequestGenerations = new Map<string, number>();
  const detailCache = new Map<string, { readonly key: string; readonly detail: RemoteSessionDetail }>();
  const readSessionContext = (sessionId: string): RemoteContextBreakdown | null =>
    cloneRemoteContextBreakdown(contextBreakdown?.(sessionId) ?? null);
  const bumpActiveRequestGeneration = (sessionId: string): void => {
    activeRequestGenerations.set(sessionId, (activeRequestGenerations.get(sessionId) ?? 0) + 1);
  };
  const getCachedSessionDetail = (
    sessionId: string,
    configuredProviders: readonly MyMeterProviderDescriptor[] = readProviders(),
  ): RemoteSessionDetail | null => {
    const sessionEvents = readModel.getSessionEvents(sessionId);
    const latestActive = latestActiveRequest([...activeRequests.values()].filter(isSupportedPricingRequest));
    const active = latestActive?.sessionId === sessionId ? latestActive : null;
    if (sessionEvents.length === 0 && !active) {
      detailCache.delete(sessionId);
      return null;
    }
    const context = readSessionContext(sessionId);
    const providerKey = providerFingerprint(configuredProviders);
    const cacheKey = JSON.stringify([
      readModel.getGeneration(sessionId),
      context,
      exchangeRateGeneration,
      providerKey,
      active ? activeRequestGenerations.get(sessionId) ?? 0 : "inactive",
    ]);
    const cached = detailCache.get(sessionId);
    if (cached?.key === cacheKey) return cached.detail;

    const detail = createRemoteSessionDetail(
      sessionId,
      sessionEvents.length > 0 ? aggregator.aggregate(sessionEvents.map(toHostCostEventInput)).global : undefined,
      sessionEvents,
      latestExchangeRate,
      context,
      active,
    );
    if (!detail) {
      detailCache.delete(sessionId);
      return null;
    }
    const frozen = deepFreeze(detail);
    detailCache.set(sessionId, { key: cacheKey, detail: frozen });
    return frozen;
  };
  const rebuildSnapshot = (
    configuredProviders: readonly MyMeterProviderDescriptor[] = readProviders(),
  ): MyMeterRemoteSnapshot => {
    const observedContext = new Map<string, RemoteContextBreakdown | null>();
    const readContext = contextBreakdown
      ? (sessionId: string): RemoteContextBreakdown | null => {
          if (observedContext.has(sessionId)) return observedContext.get(sessionId) ?? null;
          const value = cloneRemoteContextBreakdown(contextBreakdown(sessionId));
          observedContext.set(sessionId, value);
          return value;
        }
      : undefined;
    cachedProviderFingerprint = providerFingerprint(configuredProviders);
    cachedSnapshot = deepFreeze(createRemoteSnapshot(
      journal.list(),
      aggregateLedger(),
      lastBalance,
      latestExchangeRate,
      readContext,
      activeRequests,
      configuredProviders,
      (sessionId) => readModel.getSessionEvents(sessionId),
    ));
    cachedContextFingerprint = contextBreakdown
      ? contextFingerprint(
          Object.keys(cachedSnapshot.details),
          (sessionId) => observedContext.get(sessionId) ?? null,
        )
      : "";
    return cachedSnapshot;
  };

  const emitSnapshot = (): void => {
    cachedSnapshot = null;
    if (listeners.size === 0) return;
    const snapshot = rebuildSnapshot();
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const collectDirtyLedgerEvents = (): HostCostEventInput[] =>
    [...dirtyEventKeys]
      .map((eventKey) => journal.getByKey(eventKey))
      .filter((event): event is CostEvent => event !== undefined)
      .map(toHostCostEventInput);

  const syncLedger = (): void => {
    if (repository.commit) {
      repository.commit?.(collectDirtyLedgerEvents());
      return;
    }
    repository.replaceAll(journal.list().map(toHostCostEventInput));
  };

  const flushPending = (): void => {
    if (batchDepth > 0) return;
    if (ledgerDirty) {
      syncLedger();
      try {
        afterLedgerCommit?.();
      } catch (error) {
        onAfterLedgerCommitError?.(error);
      }
      ledgerDirty = false;
      dirtyEventKeys.clear();
    }
    if (snapshotDirty) {
      emitSnapshot();
      snapshotDirty = false;
    }
  };

  const upsert = (event: CostEvent): boolean => {
    const previous = journal.getByKey(event.eventKey);
    const current = journal.upsert(event);
    if (sameCostEvent(previous, current)) return false;
    readModel.upsert(current);
    ledgerDirty = true;
    dirtyEventKeys.add(current.eventKey);
    snapshotDirty = true;
    flushPending();
    return true;
  };

  const handleProjection = (payload: unknown): void => {
    if (!installed) {
      return;
    }

    const input = parsePayload(payload);
    const projection = projectionAdapter.fromTokenMeter(input.projection);
    const eventInput = createEstimateInput(input, metadataAdapter.fromRequest(input.metadata), projection);
    if (!eventInput) {
      return;
    }

    const outcome = normalizeOutcome(input.raw.requestOutcome ?? input.raw.outcome);
    const kind = pricingKind(eventInput.provider, eventInput.model);
    const event = kind === "deepseek"
      ? estimateDeepSeekCostEvent(eventInput)
      : kind === "xai"
        ? estimateXaiCostEvent(eventInput as EstimateXaiCostEventInput)
        : kind
          ? estimateProviderCostEvent({ ...eventInput, provider: eventInput.provider ?? kind } as EstimateProviderCostEventInput)
        : createUnknownCostEvent(eventInput, {
          source: "stream",
          usage: projection ? toCoreProjection(projection) : undefined,
          requestOutcome: outcome,
        });
    upsert(outcome === "failed" || outcome === "aborted"
      ? { ...event, status: "failed", requestOutcome: outcome }
      : event);
  };

  const handleFinalUsage = (payload: unknown): void => {
    if (!installed) {
      return;
    }

    const input = parsePayload(payload);
    const usage = input.hasUsage ? usageAdapter.fromAssistantUsage(input.usage) : undefined;
    const activeRequestCleared = clearActiveRequest(input.metadata);
    const eventInput = createFinalizeInput(input, metadataAdapter.fromRequest(input.metadata), usage, journal.list());
    if (!eventInput) {
      emitSnapshot();
      return;
    }

    const kind = pricingKind(eventInput.provider, eventInput.model);
    const event = kind === "deepseek"
      ? finalizeDeepSeekCostEvent(eventInput)
      : kind === "xai"
        ? finalizeXaiCostEvent(eventInput as FinalizeXaiCostEventInput)
        : kind
          ? finalizeProviderCostEvent({ ...eventInput, provider: eventInput.provider ?? kind } as FinalizeProviderCostEventInput)
        : createUnknownCostEvent(eventInput, {
          source: "final_usage",
          usage: usage ? toCoreUsage(usage) : undefined,
          requestOutcome: eventInput.requestOutcome,
          previousEvent: eventInput.previousEvent,
        });
    const eventChanged = upsert(event);
    if (activeRequestCleared && !eventChanged) {
      snapshotDirty = true;
      flushPending();
    }
  };

  const handleActiveRequest = (payload: unknown): void => {
    if (!installed) {
      return;
    }

    const active = parseActiveRequest(payload, metadataAdapter);
    if (!active) {
      return;
    }

    if (active.action === "clear") {
      const previous = activeRequests.get(active.eventKey);
      if (activeRequests.delete(active.eventKey) && previous) bumpActiveRequestGeneration(previous.sessionId);
    } else {
      const previous = activeRequests.get(active.eventKey);
      activeRequests.set(active.eventKey, active.request);
      if (previous?.sessionId && previous.sessionId !== active.request.sessionId) {
        bumpActiveRequestGeneration(previous.sessionId);
      }
      bumpActiveRequestGeneration(active.request.sessionId);
    }
    snapshotDirty = true;
    flushPending();
  };

  const clearActiveRequest = (metadata: DshPayload): boolean => {
    const identity = createIdentity(metadata);
    if (!identity) {
      return false;
    }
    const eventKey = createCostEventKey(identity);
    const previous = activeRequests.get(eventKey);
    const deleted = activeRequests.delete(eventKey);
    if (deleted && previous) bumpActiveRequestGeneration(previous.sessionId);
    return deleted;
  };

  cleanups.push(dsh.on(PROJECTION_EVENT, handleProjection));
  cleanups.push(dsh.on(FINAL_USAGE_EVENT, handleFinalUsage));
  cleanups.push(dsh.on(ACTIVE_REQUEST_EVENT, handleActiveRequest));

  function aggregateLedger(): LedgerAggregation {
    return aggregator.aggregate(journal.list().map(toHostCostEventInput));
  }

  const remote: MyMeterHostRemoteContribution = {
    getSnapshot() {
      const configuredProviders = readProviders();
      const currentContextFingerprint = cachedSnapshot && contextBreakdown
        ? contextFingerprint(Object.keys(cachedSnapshot.details), contextBreakdown)
        : "";
      if (
        cachedSnapshot === null
        || cachedProviderFingerprint !== providerFingerprint(configuredProviders)
        || cachedContextFingerprint !== currentContextFingerprint
      ) {
        return rebuildSnapshot(configuredProviders);
      }
      return cachedSnapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async listSessions() {
      return deepFreeze(createRemoteSessionSummaries(
        journal.list(),
        aggregateLedger(),
        latestExchangeRate,
        activeRequests,
        (sessionId) => readModel.getSessionEvents(sessionId),
      ));
    },
    async getSessionDetail(sessionId) {
      return getCachedSessionDetail(sessionId);
    },
    async getSessionCostTree() {
      return deepFreeze(buildSessionCostTree({
        aggregation: aggregateLedger(),
        events: journal.list(),
        details: remote.getSnapshot().details,
      })) as RemoteSessionCostTree;
    },
    async getCostAnalytics() {
      return deepFreeze(createHostCostAnalyticsReport(journal.list().map(toHostCostEventInput)));
    },
    async exportLedger(format) {
      return exportCostEventLedger({
        format,
        events: journal.list().map(toHostCostEventInput),
      });
    },
    async getBalance() {
      if (balance) {
        const nextBalance = toRemoteBalance(await balance());
        if (!sameRemoteBalance(lastBalance, nextBalance)) {
          lastBalance = nextBalance;
          emitSnapshot();
        }
      }
      return lastBalance;
    },
    async refreshExchangeRate() {
      latestExchangeRate = { ...latestExchangeRate, status: "loading", error: null };
      exchangeRateGeneration += 1;
      emitSnapshot();
      try {
        const result = await (configuredExchangeRate ?? fetchLatestUsdCnyRate)();
        if (!Number.isFinite(result.rate) || result.rate <= 0) {
          throw new Error("汇率接口返回了无效汇率");
        }
        latestExchangeRate = {
          status: "fresh",
          baseCurrency: "USD",
          quoteCurrency: "CNY",
          rate: result.rate,
          fetchedAt: result.fetchedAt ?? new Date().toISOString(),
          source: result.source ?? "Frankfurter ECB",
          error: null,
        };
      } catch (error) {
        latestExchangeRate = {
          ...latestExchangeRate,
          status: "error",
          error: error instanceof Error ? error.message : "查询汇率失败",
        };
      }
      exchangeRateGeneration += 1;
      emitSnapshot();
      return latestExchangeRate;
    },
    async getSettings() {
      return {
        priceProvider: "catalog",
        priceProviders: [...listPriceCatalogProviders()],
        remoteDtoVersion: "dsh-cost-meter-0.1",
      };
    },
  };

  return {
    remote,
    events() {
      return journal.list();
    },
    ledger() {
      return aggregateLedger().global;
    },
    aggregation: aggregateLedger,
    batch(callback) {
      batchDepth += 1;
      try {
        return callback();
      } finally {
        batchDepth -= 1;
        flushPending();
      }
    },
    uninstall() {
      if (!installed) {
        return;
      }
      installed = false;
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
      activeRequests.clear();
      listeners.clear();
    },
  };
}

function sameCostEvent(left: CostEvent | undefined, right: CostEvent): boolean {
  if (!left) return false;
  const keys = new Set<keyof CostEvent>([
    ...Object.keys(left) as Array<keyof CostEvent>,
    ...Object.keys(right) as Array<keyof CostEvent>,
  ]);
  return [...keys].every((key) => Object.is(left[key], right[key]));
}

export function createMyMeterClientPlugin({
  slots,
  remote,
  storage,
  storageKey,
}: MyMeterClientPluginOptions): MyMeterClientPlugin {
  const store = createMyMeterStore({
    remote,
    ...(storage !== undefined ? { storage } : {}),
    ...(storageKey !== undefined ? { storageKey } : {}),
  });
  const unregister = slots.register("shell.overlay", createElement(ShellOverlay, { store }));
  let installed = true;

  return {
    uninstall() {
      if (!installed) {
        return;
      }
      installed = false;
      unregister();
      store.destroy();
    },
  };
}

function parsePayload(payload: unknown): {
  raw: DshPayload;
  metadata: DshPayload;
  projection: DshPayload;
  usage: DshPayload;
  hasUsage: boolean;
} {
  const raw = asRecord(payload);
  const usage = raw.usage ?? raw.finalUsage ?? raw.assistantUsage;
  return {
    raw,
    metadata: asRecord(raw.metadata ?? raw.request ?? raw),
    projection: asRecord(raw.projection ?? raw.tokenProjection ?? raw.tokenMeter ?? raw.usageProjection),
    usage: asRecord(usage),
    hasUsage: usage !== undefined && usage !== null,
  };
}

function parseActiveRequest(
  payload: unknown,
  metadataAdapter: ReturnType<typeof createHostMetadataAdapter>,
): { action: "clear"; eventKey: string } | { action: "upsert"; eventKey: string; request: ActiveRequestState } | null {
  const raw = asRecord(payload);
  const metadata = asRecord(raw.metadata ?? raw.request ?? raw);
  const identity = createIdentity(metadata);
  if (!identity) {
    return null;
  }

  const eventKey = createCostEventKey(identity);
  const action = asText(raw.action);
  if (action === "clear") {
    return { action, eventKey };
  }

  const startedAt = toIsoDateInput(asDateInput(
    raw.requestStartedAt ??
      raw.request_started_at ??
      raw.startedAt ??
      raw.started_at ??
      metadata.requestStartedAt ??
      metadata.request_started_at,
  ));
  if (!startedAt) {
    return null;
  }

  const lastActivityAt = toIsoDateInput(asDateInput(raw.lastActivityAt ?? raw.last_activity_at)) ?? startedAt;
  const requestMetadata = metadataAdapter.fromRequest(metadata);
  return {
    action: "upsert",
    eventKey,
    request: {
      ...identity,
      eventKey,
      requestStartedAt: startedAt,
      lastActivityAt,
      provider: requestMetadata.provider,
      model: requestMetadata.model,
      reasoningEffort: requestMetadata.reasoningEffort,
      agentPreset: requestMetadata.agentPreset,
    },
  };
}

function createEstimateInput(
  input: ReturnType<typeof parsePayload>,
  metadata: ReturnType<ReturnType<typeof createHostMetadataAdapter>["fromRequest"]>,
  projection: TokenProjectionRecord | null,
): EstimateDeepSeekCostEventInput | null {
  const base = createBaseCostInput(input, metadata, "estimate");
  if (!base) {
    return null;
  }

  return {
    ...base,
    completedAt: asDateInput(input.raw.completedAt ?? input.raw.completed_at) ?? undefined,
    usageProjection: projection ? toCoreProjection(projection) : undefined,
  };
}

function createFinalizeInput(
  input: ReturnType<typeof parsePayload>,
  metadata: ReturnType<ReturnType<typeof createHostMetadataAdapter>["fromRequest"]>,
  usage: TokenUsageRecord | undefined,
  previousEvents: readonly CostEvent[],
): FinalizeDeepSeekCostEventInput | null {
  const base = createBaseCostInput(input, metadata, "final");
  if (!base) {
    return null;
  }

  const key = createCostEventKey(base);
  const previousEvent = previousEvents.find((event) => event.eventKey === key);
  return {
    ...base,
    completedAt: asDateInput(input.raw.completedAt ?? input.raw.completed_at) ?? undefined,
    ...(usage ? { usage: toCoreUsage(usage) } : {}),
    previousEvent: previousEvent?.source === "stream" ? previousEvent : undefined,
    requestOutcome: normalizeOutcome(input.raw.requestOutcome ?? input.raw.outcome),
  };
}

function createBaseCostInput(
  input: ReturnType<typeof parsePayload>,
  metadata: ReturnType<ReturnType<typeof createHostMetadataAdapter>["fromRequest"]>,
  phase: "estimate" | "final",
): (CostEventIdentity & {
  id: string;
  provider: string;
  model: string;
  requestStartedAt: DateInput;
  reasoningEffort?: string | undefined;
  agentPreset?: string | undefined;
  parentSessionId?: string | undefined;
}) | null {
  const identity = createIdentity(input.metadata);
  if (!identity) {
    return null;
  }

  const requestStartedAt = asDateInput(
    input.raw.requestStartedAt ??
      input.raw.request_started_at ??
      input.raw.startedAt ??
      input.raw.started_at ??
      input.raw.createdAt ??
      input.raw.created_at ??
      input.metadata.requestStartedAt ??
      input.metadata.request_started_at,
  );
  if (requestStartedAt === null) {
    return null;
  }

  const eventKey = createCostEventKey(identity);
  return {
    ...identity,
    id: `${asText(input.raw.id ?? input.raw.requestId ?? eventKey, eventKey)}:${phase}`,
    provider: metadata.provider,
    model: metadata.model,
    requestStartedAt,
    reasoningEffort: metadata.reasoningEffort,
    agentPreset: metadata.agentPreset,
    parentSessionId: asOptionalText(input.metadata.parentSessionId ?? input.metadata.parent_session_id),
  };
}

function createIdentity(metadata: DshPayload): CostEventIdentity | null {
  const sessionId = asOptionalText(metadata.sessionId ?? metadata.session_id);
  const turnId = asOptionalText(metadata.turnId ?? metadata.turn_id);
  const stepId = asOptionalText(metadata.stepId ?? metadata.step_id);
  const attemptId = asOptionalText(metadata.attemptId ?? metadata.attempt_id);

  if (!sessionId || !turnId || !stepId || !attemptId) {
    return null;
  }

  return { sessionId, turnId, stepId, attemptId };
}

function pricingKind(provider: string | undefined, model: string): PricingCatalogKind | null {
  return resolvePricingCatalogKind(provider, model);
}

function toCoreProjection(projection: TokenProjectionRecord): UsageProjectionInput {
  return {
    cacheHitTokens: projection.cacheHitTokens,
    cacheMissTokens: projection.cacheMissTokens,
    outputTokens: projection.outputTokens,
    reasoningTokens: projection.reasoningTokens,
    ...(projection.cacheWriteTokens !== undefined ? { cacheWriteTokens: projection.cacheWriteTokens } : {}),
    reliable: projection.isReliable,
  };
}

function toCoreUsage(usage: TokenUsageRecord) {
  return {
    cacheHitTokens: usage.cacheHitTokens,
    cacheMissTokens: usage.cacheMissTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    ...(usage.cacheWriteTokens !== undefined ? { cacheWriteTokens: usage.cacheWriteTokens } : {}),
  };
}

function toHostCostEventInput(event: CostEvent): HostCostEventInput {
  return {
    id: event.id,
    sessionId: event.sessionId,
    turnId: event.turnId,
    stepId: event.stepId,
    attemptId: event.attemptId,
    parentSessionId: event.parentSessionId,
    requestStartedAt: event.requestStartedAt,
    completedAt: event.completedAt,
    status: event.status,
    ...(event.requestOutcome ? { requestOutcome: event.requestOutcome } : {}),
    amountMicroCny: toNumber(event.amountMicroCny),
    currency: event.currency ?? "CNY",
    ...(event.amountMinor !== undefined ? { amountMinor: toNumber(event.amountMinor) } : {}),
    ...(event.cacheHitMinor !== undefined ? { cacheHitMinor: toNumber(event.cacheHitMinor) } : {}),
    ...(event.cacheMissMinor !== undefined ? { cacheMissMinor: toNumber(event.cacheMissMinor) } : {}),
    ...(event.outputMinor !== undefined ? { outputMinor: toNumber(event.outputMinor) } : {}),
    ...(event.cacheHitRateMinorPerMillionTokens !== undefined ? { cacheHitRateMinorPerMillionTokens: toNumber(event.cacheHitRateMinorPerMillionTokens) } : {}),
    ...(event.cacheMissRateMinorPerMillionTokens !== undefined ? { cacheMissRateMinorPerMillionTokens: toNumber(event.cacheMissRateMinorPerMillionTokens) } : {}),
    ...(event.outputRateMinorPerMillionTokens !== undefined ? { outputRateMinorPerMillionTokens: toNumber(event.outputRateMinorPerMillionTokens) } : {}),
    source: event.source,
    provider: event.provider,
    model: event.model,
    reasoningEffort: event.reasoningEffort,
    agentPreset: event.agentPreset,
    pricingZone: event.pricingZone,
    cacheHitTokens: toNumber(event.cacheHitTokens),
    cacheMissTokens: toNumber(event.cacheMissTokens),
    ...(event.cacheWriteTokens !== undefined ? { cacheWriteTokens: toNumber(event.cacheWriteTokens) } : {}),
    outputTokens: toNumber(event.outputTokens),
    reasoningTokens: toNumber(event.reasoningTokens),
    hitRateMicroCny: toNumber(event.cacheHitMicroCny),
    missRateMicroCny: toNumber(event.cacheMissMicroCny),
    outputRateMicroCny: toNumber(event.outputMicroCny),
    cacheHitRateMicroCnyPerMillionTokens: toNumber(event.cacheHitRateMicroCnyPerMillionTokens ?? 0n),
    cacheMissRateMicroCnyPerMillionTokens: toNumber(event.cacheMissRateMicroCnyPerMillionTokens ?? 0n),
    outputRateMicroCnyPerMillionTokens: toNumber(event.outputRateMicroCnyPerMillionTokens ?? 0n),
    priceVersion: event.priceVersion,
  };
}

function toCoreCostEvent(event: HostCostEventRecord): CostEvent | null {
  if (isLegacyZeroTokenArtifact(event)) {
    return null;
  }

  const kind = pricingKind(event.provider, event.model);
  if (!kind) {
    return createUnknownCostEvent({
      id: event.id,
      provider: event.provider,
      sessionId: event.sessionId,
      turnId: event.turnId,
      stepId: event.stepId,
      attemptId: event.attemptId,
      model: event.model,
      reasoningEffort: event.reasoningEffort,
      agentPreset: event.agentPreset,
      parentSessionId: event.parentSessionId !== "unknown" ? event.parentSessionId : undefined,
      requestStartedAt: event.requestStartedAt,
      completedAt: event.completedAt !== "unknown" ? event.completedAt : undefined,
    }, {
      source: "restored",
      usage: {
        cacheHitTokens: event.cacheHitTokens,
        cacheMissTokens: event.cacheMissTokens,
        ...(event.cacheWriteTokens !== undefined ? { cacheWriteTokens: event.cacheWriteTokens } : {}),
        outputTokens: event.outputTokens,
        reasoningTokens: event.reasoningTokens,
      },
      requestOutcome: event.requestOutcome,
    });
  }

  const restoredUnitPrices = resolveRestoredUnitPrices(event);
  const legacyXaiNativeFields = restoreLegacyXaiNativeFields(event, kind);
  const coreEvent: CostEvent = {
    id: event.id,
    eventKey: event.eventKey,
    sessionId: event.sessionId,
    turnId: event.turnId,
    stepId: event.stepId,
    attemptId: event.attemptId,
    provider: event.provider,
    model: event.model,
    reasoningEffort: event.reasoningEffort,
    agentPreset: event.agentPreset,
    ...(event.parentSessionId !== "unknown" ? { parentSessionId: event.parentSessionId } : {}),
    requestStartedAt: event.requestStartedAt,
    ...(event.completedAt !== "unknown" ? { completedAt: event.completedAt } : {}),
    status: event.status,
    source: event.source === "projection" ? "stream" : event.source,
    ...(event.requestOutcome ? { requestOutcome: event.requestOutcome } : {}),
    pricingZone: event.pricingZone,
    priceVersion: legacyXaiNativeFields?.priceVersion ?? event.priceVersion,
    amountMicroCny: BigInt(event.amountMicroCny),
    currency: legacyXaiNativeFields?.currency ?? event.currency ?? "CNY",
    amountMinor: BigInt(Math.round(legacyXaiNativeFields?.amountMinor ?? event.amountMinor ?? event.amountMicroCny)),
    cacheHitMinor: BigInt(Math.round(legacyXaiNativeFields?.cacheHitMinor ?? event.cacheHitMinor ?? event.hitRateMicroCny)),
    cacheMissMinor: BigInt(Math.round(legacyXaiNativeFields?.cacheMissMinor ?? event.cacheMissMinor ?? event.missRateMicroCny)),
    outputMinor: BigInt(Math.round(legacyXaiNativeFields?.outputMinor ?? event.outputMinor ?? event.outputRateMicroCny)),
    cacheHitRateMinorPerMillionTokens: BigInt(Math.round(legacyXaiNativeFields?.cacheHitRate ?? event.cacheHitRateMinorPerMillionTokens ?? event.cacheHitRateMicroCnyPerMillionTokens)),
    cacheMissRateMinorPerMillionTokens: BigInt(Math.round(legacyXaiNativeFields?.cacheMissRate ?? event.cacheMissRateMinorPerMillionTokens ?? event.cacheMissRateMicroCnyPerMillionTokens)),
    outputRateMinorPerMillionTokens: BigInt(Math.round(legacyXaiNativeFields?.outputRate ?? event.outputRateMinorPerMillionTokens ?? event.outputRateMicroCnyPerMillionTokens)),
    cacheHitMicroCny: BigInt(event.hitRateMicroCny),
    cacheMissMicroCny: BigInt(event.missRateMicroCny),
    outputMicroCny: BigInt(event.outputRateMicroCny),
    cacheHitRateMicroCnyPerMillionTokens: restoredUnitPrices.cacheHit,
    cacheMissRateMicroCnyPerMillionTokens: restoredUnitPrices.cacheMiss,
    outputRateMicroCnyPerMillionTokens: restoredUnitPrices.output,
    cacheHitTokens: BigInt(event.cacheHitTokens),
    cacheMissTokens: BigInt(event.cacheMissTokens),
    ...(event.cacheWriteTokens !== undefined ? { cacheWriteTokens: BigInt(event.cacheWriteTokens) } : {}),
    outputTokens: BigInt(event.outputTokens),
    reasoningTokens: BigInt(event.reasoningTokens),
    reasoningTokensIncludedInOutput: true,
  };

  // Reprice non-settled legacy/projection events with the current model API
  // catalog. Settled events retain their recorded price snapshot for replay.
  if (event.status === "settled") {
    return coreEvent;
  }

  const estimate = kind === "xai"
    ? calculateXaiUsageCost({
      model: coreEvent.model,
      usage: {
        cacheHitTokens: coreEvent.cacheHitTokens,
        cacheMissTokens: coreEvent.cacheMissTokens,
        ...(coreEvent.cacheWriteTokens !== undefined ? { cacheWriteTokens: coreEvent.cacheWriteTokens } : {}),
        outputTokens: coreEvent.outputTokens,
        reasoningTokens: coreEvent.reasoningTokens,
      },
      requestOutcome: coreEvent.requestOutcome,
    })
    : kind !== "deepseek"
      ? calculateProviderUsageCost({
        provider: event.provider,
        model: coreEvent.model,
        usage: {
          cacheHitTokens: coreEvent.cacheHitTokens,
          cacheMissTokens: coreEvent.cacheMissTokens,
          ...(coreEvent.cacheWriteTokens !== undefined ? { cacheWriteTokens: coreEvent.cacheWriteTokens } : {}),
          outputTokens: coreEvent.outputTokens,
          reasoningTokens: coreEvent.reasoningTokens,
        },
        requestOutcome: coreEvent.requestOutcome,
      })
      : calculateDeepSeekUsageCost({
      model: coreEvent.model,
      requestStartedAt: coreEvent.requestStartedAt,
      pricingZone: coreEvent.pricingZone,
      usage: {
        cacheHitTokens: coreEvent.cacheHitTokens,
        cacheMissTokens: coreEvent.cacheMissTokens,
        ...(coreEvent.cacheWriteTokens !== undefined ? { cacheWriteTokens: coreEvent.cacheWriteTokens } : {}),
        outputTokens: coreEvent.outputTokens,
        reasoningTokens: coreEvent.reasoningTokens,
      },
      requestOutcome: coreEvent.requestOutcome,
    });
  return {
    ...coreEvent,
    pricingZone: estimate.pricingZone,
    priceVersion: estimate.priceVersion,
    amountMicroCny: estimate.amountMicroCny,
    cacheHitMicroCny: estimate.cacheHitMicroCny,
    cacheMissMicroCny: estimate.cacheMissMicroCny,
    outputMicroCny: estimate.outputMicroCny,
    cacheHitRateMicroCnyPerMillionTokens: estimate.cacheHitRateMicroCnyPerMillionTokens,
    cacheMissRateMicroCnyPerMillionTokens: estimate.cacheMissRateMicroCnyPerMillionTokens,
    outputRateMicroCnyPerMillionTokens: estimate.outputRateMicroCnyPerMillionTokens,
    ...(estimate.currency ? { currency: estimate.currency } : {}),
    ...(estimate.amountMinor !== undefined ? { amountMinor: estimate.amountMinor } : {}),
    ...(estimate.cacheHitMinor !== undefined ? { cacheHitMinor: estimate.cacheHitMinor } : {}),
    ...(estimate.cacheMissMinor !== undefined ? { cacheMissMinor: estimate.cacheMissMinor } : {}),
    ...(estimate.outputMinor !== undefined ? { outputMinor: estimate.outputMinor } : {}),
    ...(estimate.cacheHitRateMinorPerMillionTokens !== undefined ? { cacheHitRateMinorPerMillionTokens: estimate.cacheHitRateMinorPerMillionTokens } : {}),
    ...(estimate.cacheMissRateMinorPerMillionTokens !== undefined ? { cacheMissRateMinorPerMillionTokens: estimate.cacheMissRateMinorPerMillionTokens } : {}),
    ...(estimate.outputRateMinorPerMillionTokens !== undefined ? { outputRateMinorPerMillionTokens: estimate.outputRateMinorPerMillionTokens } : {}),
    status: estimate.status === "failed" ? "failed" : "estimated",
    unknownReason: undefined,
  };
}

const LEGACY_XAI_FIXED_RATE_VERSION = /^(xai-official-pricing-\d{4}-\d{2}-\d{2}-usd)-cny-(\d+(?:\.\d+)?)$/;

function restoreLegacyXaiNativeFields(event: HostCostEventRecord, kind: string): {
  currency: "USD";
  priceVersion: string;
  amountMinor: number;
  cacheHitMinor: number;
  cacheMissMinor: number;
  outputMinor: number;
  cacheHitRate: number;
  cacheMissRate: number;
  outputRate: number;
} | null {
  if (kind !== "xai" || event.currency !== "CNY") return null;

  const match = LEGACY_XAI_FIXED_RATE_VERSION.exec(event.priceVersion);
  const exchangeRate = Number(match?.[2]);
  if (!match || !Number.isFinite(exchangeRate) || exchangeRate <= 0) return null;

  const toUsdMinor = (microCny: number) => Math.round(microCny / exchangeRate);
  const cacheHitMinor = toUsdMinor(event.hitRateMicroCny);
  const cacheMissMinor = toUsdMinor(event.missRateMicroCny);
  const outputMinor = toUsdMinor(event.outputRateMicroCny);
  const compatibilityBucketTotal = event.hitRateMicroCny + event.missRateMicroCny + event.outputRateMicroCny;
  return {
    currency: "USD",
    priceVersion: match[1]!,
    amountMinor: compatibilityBucketTotal === event.amountMicroCny
      ? cacheHitMinor + cacheMissMinor + outputMinor
      : toUsdMinor(event.amountMicroCny),
    cacheHitMinor,
    cacheMissMinor,
    outputMinor,
    cacheHitRate: toUsdMinor(event.cacheHitRateMicroCnyPerMillionTokens),
    cacheMissRate: toUsdMinor(event.cacheMissRateMicroCnyPerMillionTokens),
    outputRate: toUsdMinor(event.outputRateMicroCnyPerMillionTokens),
  };
}

function isLegacyZeroTokenArtifact(event: HostCostEventRecord): boolean {
  return (event.status === "unknown" || event.status === "estimated")
    && event.source === "final_usage"
    && event.completedAt === "unknown"
    && event.requestOutcome === undefined
    && event.amountMicroCny === 0
    && event.cacheHitTokens === 0
    && event.cacheMissTokens === 0
    && event.outputTokens === 0
    && event.reasoningTokens === 0;
}

function resolveRestoredUnitPrices(event: HostCostEventRecord): {
  cacheHit: bigint;
  cacheMiss: bigint;
  output: bigint;
} {
  const current = calculateUnitPrices(
    event.provider,
    event.model,
    event.requestStartedAt,
    event.pricingZone,
    providerQuoteInputTokens(event.cacheHitTokens, event.cacheMissTokens),
  );
  const usesCurrentPriceVersion = event.priceVersion === current.priceVersion;
  return {
    cacheHit: restoreUnitPrice(
      event.cacheHitRateMicroCnyPerMillionTokens,
      event.hitRateMicroCny,
      event.cacheHitTokens,
      usesCurrentPriceVersion ? current.cacheHit : 0n,
    ),
    cacheMiss: restoreUnitPrice(
      event.cacheMissRateMicroCnyPerMillionTokens,
      event.missRateMicroCny,
      event.cacheMissTokens,
      usesCurrentPriceVersion ? current.cacheMiss : 0n,
    ),
    output: restoreUnitPrice(
      event.outputRateMicroCnyPerMillionTokens,
      event.outputRateMicroCny,
      event.outputTokens,
      usesCurrentPriceVersion ? current.output : 0n,
    ),
  };
}

function restoreUnitPrice(stored: number, amount: number, tokens: number, current: bigint): bigint {
  if (stored > 0) return BigInt(stored);
  if (current > 0n) return current;
  if (amount <= 0 || tokens <= 0) return 0n;
  return (BigInt(amount) * 1_000_000n + BigInt(tokens) / 2n) / BigInt(tokens);
}

function providerQuoteInputTokens(cacheHitTokens: number | bigint, cacheMissTokens: number | bigint): bigint {
  // Provider cost events expose cacheMissTokens as the displayed input bucket,
  // which already includes cache-write tokens when the provider supports them.
  return BigInt(cacheHitTokens) + BigInt(cacheMissTokens);
}

function calculateUnitPrices(
  provider: string | undefined,
  model: string,
  requestStartedAt: DateInput,
  pricingZone: CostEvent["pricingZone"],
  inputTokens: bigint = 0n,
): {
  priceVersion: string;
  cacheHit: bigint;
  cacheMiss: bigint;
  output: bigint;
} {
  if (pricingKind(provider, model) === "xai") {
    const result = createXaiPriceDirectory().lookup({ model, inputTokens });
    return result.ok
      ? {
        priceVersion: result.quote.priceVersion,
        cacheHit: result.quote.cacheHitMicroCnyPerMillionTokens,
        cacheMiss: result.quote.cacheMissMicroCnyPerMillionTokens,
        output: result.quote.outputMicroCnyPerMillionTokens,
      }
      : { priceVersion: result.priceVersion, cacheHit: 0n, cacheMiss: 0n, output: 0n };
  }
  const kind = pricingKind(provider, model);
  if (!kind) {
    return { priceVersion: "", cacheHit: 0n, cacheMiss: 0n, output: 0n };
  }
  if (kind && kind !== "deepseek") {
    const quote = lookupAdditionalPrice(provider ?? kind, model, inputTokens);
    return quote
      ? {
        priceVersion: quote.priceVersion,
        cacheHit: quote.rates.cacheHitMicroCnyPerMillionTokens,
        cacheMiss: quote.rates.cacheMissMicroCnyPerMillionTokens,
        output: quote.rates.outputMicroCnyPerMillionTokens,
      }
      : { priceVersion: "", cacheHit: 0n, cacheMiss: 0n, output: 0n };
  }
  const quote = calculateDeepSeekUsageCost({
    model,
    requestStartedAt,
    pricingZone,
    usage: {
      cacheHitTokens: 1_000_000,
      cacheMissTokens: 1_000_000,
      outputTokens: 1_000_000,
      reasoningTokens: 0,
    },
  });
  return {
    priceVersion: quote.priceVersion,
    cacheHit: quote.cacheHitRateMicroCnyPerMillionTokens,
    cacheMiss: quote.cacheMissRateMicroCnyPerMillionTokens,
    output: quote.outputRateMicroCnyPerMillionTokens,
  };
}

function unitPricesForEvent(event: CostEvent): {
  cacheHit: number | null;
  cacheMiss: number | null;
  output: number | null;
} {
  const current = calculateUnitPrices(
    event.provider,
    event.model,
    event.requestStartedAt,
    event.pricingZone,
    providerQuoteInputTokens(event.cacheHitTokens, event.cacheMissTokens),
  );
  const mayUseCurrent = event.priceVersion === current.priceVersion;
  return {
    cacheHit: toRemoteUnitPrice(
      mayUseCurrent ? current.cacheHit : event.cacheHitRateMicroCnyPerMillionTokens ?? 0n,
    ),
    cacheMiss: toRemoteUnitPrice(
      mayUseCurrent ? current.cacheMiss : event.cacheMissRateMicroCnyPerMillionTokens ?? 0n,
    ),
    output: toRemoteUnitPrice(
      mayUseCurrent ? current.output : event.outputRateMicroCnyPerMillionTokens ?? 0n,
    ),
  };
}

function unitPricesForEvents(events: readonly CostEvent[]): {
  cacheHit: number | null;
  cacheMiss: number | null;
  output: number | null;
} {
  const resolved: ReturnType<typeof unitPricesForEvent> = {
    cacheHit: null,
    cacheMiss: null,
    output: null,
  };

  for (const event of events) {
    const candidate = unitPricesForEvent(event);
    resolved.cacheHit ??= candidate.cacheHit;
    resolved.cacheMiss ??= candidate.cacheMiss;
    resolved.output ??= candidate.output;
    if (resolved.cacheHit !== null && resolved.cacheMiss !== null && resolved.output !== null) break;
  }

  return resolved;
}

function toRemoteUnitPrice(value: bigint): number | null {
  return value > 0n ? toNumber(value) : null;
}

function eventCurrency(event: CostEvent): string {
  if (event.currency) return event.currency;
  return pricingKind(event.provider, event.model) && pricingKind(event.provider, event.model) !== "deepseek" ? "USD" : "CNY";
}

function eventMinor(event: CostEvent): bigint {
  return event.amountMinor ?? event.amountMicroCny;
}

function eventBucketMinor(event: CostEvent, bucket: "hit" | "miss" | "output"): bigint {
  if (bucket === "hit") return event.cacheHitMinor ?? event.cacheHitMicroCny;
  if (bucket === "miss") return event.cacheMissMinor ?? event.cacheMissMicroCny;
  return event.outputMinor ?? event.outputMicroCny;
}

function eventRateMinor(event: CostEvent, bucket: "hit" | "miss" | "output"): bigint {
  if (bucket === "hit") return event.cacheHitRateMinorPerMillionTokens ?? event.cacheHitRateMicroCnyPerMillionTokens ?? 0n;
  if (bucket === "miss") return event.cacheMissRateMinorPerMillionTokens ?? event.cacheMissRateMicroCnyPerMillionTokens ?? 0n;
  return event.outputRateMinorPerMillionTokens ?? event.outputRateMicroCnyPerMillionTokens ?? 0n;
}

function aggregateCurrencyTotals(events: readonly CostEvent[]): RemoteCurrencyTotal[] {
  const totals = new Map<string, RemoteCurrencyTotal>();
  for (const event of events) {
    const currency = eventCurrency(event);
    const current = totals.get(currency) ?? { currency, amountMinor: 0, settledMinor: 0, estimatedMinor: 0, failedMinor: 0 };
    const amount = toNumber(eventMinor(event));
    if (amount === 0 && event.status === "unknown") continue;
    current.amountMinor += amount;
    if (event.status === "settled") current.settledMinor += amount;
    if (event.status === "estimated") current.estimatedMinor += amount;
    if (event.status === "failed") current.failedMinor += amount;
    totals.set(currency, current);
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

function aggregateNativeStage(events: readonly CostEvent[]): {
  currency: string;
  totalMinor: number;
  settledMinor: number;
  estimatedMinor: number;
  cacheHitMinor: number;
  cacheMissMinor: number;
  outputMinor: number;
  cacheHitRate: number | null;
  cacheMissRate: number | null;
  outputRate: number | null;
} {
  const currency = eventCurrency(events[0]!);
  const sameCurrency = events.every((event) => eventCurrency(event) === currency);
  const relevant = sameCurrency ? events : events.filter((event) => eventCurrency(event) === currency);
  const totalMinor = relevant.reduce((sum, event) => sum + toNumber(eventMinor(event)), 0);
  const settledMinor = relevant.filter((event) => event.status === "settled").reduce((sum, event) => sum + toNumber(eventMinor(event)), 0);
  const estimatedMinor = relevant.filter((event) => event.status === "estimated").reduce((sum, event) => sum + toNumber(eventMinor(event)), 0);
  const bucketRate = (bucket: "hit" | "miss" | "output"): number | null => {
    const rates = relevant.filter((event) => (bucket === "hit" ? event.cacheHitTokens : bucket === "miss" ? event.cacheMissTokens : event.outputTokens) > 0n)
      .map((event) => toNumber(eventRateMinor(event, bucket)));
    return rates.length === 0 || new Set(rates).size > 1 ? null : rates[0] ?? null;
  };
  return {
    currency,
    totalMinor,
    settledMinor,
    estimatedMinor,
    cacheHitMinor: relevant.reduce((sum, event) => sum + toNumber(eventBucketMinor(event, "hit")), 0),
    cacheMissMinor: relevant.reduce((sum, event) => sum + toNumber(eventBucketMinor(event, "miss")), 0),
    outputMinor: relevant.reduce((sum, event) => sum + toNumber(eventBucketMinor(event, "output")), 0),
    cacheHitRate: bucketRate("hit"),
    cacheMissRate: bucketRate("miss"),
    outputRate: bucketRate("output"),
  };
}

function nativeRemoteFields(currency: string, amountMinor: number, unitPriceMinorPerMillionTokens: number | null): {
  currency?: string;
  amountMinor?: number;
  unitPriceMinorPerMillionTokens?: number | null;
} {
  return currency === "CNY"
    ? {}
    : { currency, amountMinor, unitPriceMinorPerMillionTokens };
}

function legacyCnyToUsdMinor(value: number): number {
  return Math.round(value * 1_000_000 / 7_200_000);
}

function cnyEquivalentMicroCny(
  totals: readonly RemoteCurrencyTotal[],
  exchangeRate: RemoteExchangeRateSnapshot,
): number | null {
  if (totals.length === 0) return 0;
  if (totals.some((total) => total.currency === "USD") && !exchangeRate.rate) return null;
  const cny = totals.reduce((sum, total) => {
    if (total.currency === "CNY") return sum + total.amountMinor;
    if (total.currency === "USD") return sum + total.amountMinor * (exchangeRate.rate ?? 0);
    return sum;
  }, 0);
  return Math.round(cny);
}

function providerFingerprint(providers: readonly MyMeterProviderDescriptor[]): string {
  return JSON.stringify(providers.map((provider) => [
    provider.id,
    provider.name,
    provider.balanceSupported,
  ]));
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value) as T;
}

function contextFingerprint(
  sessionIds: readonly string[],
  readContext: (sessionId: string) => RemoteContextBreakdown | null,
): string {
  return JSON.stringify([...sessionIds]
    .sort()
    .map((sessionId) => [sessionId, readContext(sessionId)]));
}

function cloneRemoteContextBreakdown(value: RemoteContextBreakdown | null): RemoteContextBreakdown | null {
  return value
    ? {
      systemTokens: value.systemTokens,
      toolsTokens: value.toolsTokens,
      messageTokens: value.messageTokens,
    }
    : null;
}

function createRemoteSnapshot(
  events: readonly CostEvent[],
  aggregation: LedgerAggregation,
  balance: MyMeterRemoteSnapshot["balance"],
  exchangeRate: RemoteExchangeRateSnapshot,
  contextBreakdown?: ((sessionId: string) => RemoteContextBreakdown | null) | undefined,
  activeRequests: ReadonlyMap<string, ActiveRequestState> = new Map(),
  configuredProviders: readonly MyMeterProviderDescriptor[] = [],
  eventsBySession?: ((sessionId: string) => readonly CostEvent[]) | undefined,
): MyMeterRemoteSnapshot {
  const latest = [...events].sort(compareEventActivity).at(-1) ?? null;
  const currentSession = latest ? aggregation.sessions.get(latest.sessionId) : undefined;
  const globalCurrencyTotals = aggregateCurrencyTotals(events);
  const sessions = createRemoteSessionSummaries(events, aggregation, exchangeRate, activeRequests, eventsBySession);
  const details: Record<string, RemoteSessionDetail> = {};

  for (const [sessionId, summary] of aggregation.sessions.entries()) {
    details[sessionId] = toRemoteSessionDetail(
      sessionId,
      summary,
      eventsBySession?.(sessionId) ?? events.filter((event) => event.sessionId === sessionId),
      contextBreakdown?.(sessionId) ?? null,
      exchangeRate,
    );
  }

  const snapshot: MyMeterRemoteSnapshot = {
    connection: { status: "connected", message: null },
    currentSessionId: latest?.sessionId ?? null,
    summary: {
      status: { code: latest ? toMeterStatus(latest) : "idle" },
      provider: latest?.provider ?? aggregation.global.provider,
      model: latest?.model ?? aggregation.global.model,
      reasoningEffort: latest?.reasoningEffort ?? aggregation.global.reasoningEffort,
      agentPreset: latest?.agentPreset ?? aggregation.global.agentPreset,
      currentRequestMicroCny: latest?.status === "estimated" ? toNumber(latest.amountMicroCny) : 0,
      sessionTotalMicroCny: currentSession?.totalMicroCny ?? 0,
      settledTotalMicroCny: aggregation.global.settledMicroCny,
      estimatedTotalMicroCny: aggregation.global.estimatedMicroCny,
      localTotalMicroCny: aggregation.global.totalMicroCny,
      pricingZone: latest?.pricingZone ?? "unknown",
      currencyTotals: globalCurrencyTotals,
      cnyEquivalentMicroCny: cnyEquivalentMicroCny(globalCurrencyTotals, exchangeRate),
      ...(globalCurrencyTotals.length === 1 ? {
        currency: globalCurrencyTotals[0]!.currency,
        currentRequestMinor: latest?.status === "estimated" ? toNumber(eventMinor(latest)) : 0,
        sessionTotalMinor: globalCurrencyTotals[0]!.amountMinor,
      } : {}),
    },
    exchangeRate,
    balance,
    balances: createRemoteProviderBalances(configuredProviders, events, balance),
    sessions,
    details,
  };

  return withActiveRequestSnapshot(snapshot, events, aggregation, contextBreakdown, activeRequests);
}

function createRemoteSessionSummaries(
  events: readonly CostEvent[],
  aggregation: LedgerAggregation,
  exchangeRate: RemoteExchangeRateSnapshot,
  activeRequests: ReadonlyMap<string, ActiveRequestState> = new Map(),
  eventsBySession?: ((sessionId: string) => readonly CostEvent[]) | undefined,
): RemoteSessionSummary[] {
  const sessions = [...aggregation.sessions.entries()].map(([sessionId, summary]) =>
    toRemoteSessionSummary(
      sessionId,
      summary,
      eventsBySession?.(sessionId) ?? events.filter((event) => event.sessionId === sessionId),
      exchangeRate,
    ),
  );
  return withActiveRequestSessionSummaries(sessions, events, aggregation, activeRequests);
}

function createRemoteSessionDetail(
  sessionId: string,
  summary: LedgerSummary | undefined,
  sessionEvents: readonly CostEvent[],
  exchangeRate: RemoteExchangeRateSnapshot,
  contextBreakdown: RemoteContextBreakdown | null,
  active: ActiveRequestState | null,
): RemoteSessionDetail | null {
  const detail = summary
    ? toRemoteSessionDetail(sessionId, summary, sessionEvents, contextBreakdown, exchangeRate)
    : null;
  if (!active) return detail;
  const activeEvent = sessionEvents.find((event) => event.eventKey === active.eventKey) ?? null;
  return toActiveSessionDetail(active, activeEvent, detail, summary, contextBreakdown);
}

function createRemoteProviderBalances(
  configuredProviders: readonly MyMeterProviderDescriptor[],
  events: readonly CostEvent[],
  balance: MyMeterRemoteSnapshot["balance"],
): RemoteProviderBalanceSnapshot[] {
  const providers = configuredProviders.length > 0
    ? configuredProviders
    : uniqueEventProviders(events);
  const seen = new Set<string>();
  const balances: RemoteProviderBalanceSnapshot[] = [];
  for (const provider of providers) {
    const id = provider.id.trim();
    const normalized = id.toLowerCase();
    if (!id || normalized === "unknown" || seen.has(normalized)) continue;
    seen.add(normalized);
    balances.push({
      provider: id,
      providerName: provider.name.trim() || id,
      supported: provider.balanceSupported,
      ...(provider.balanceSupported ? balance : unavailableRemoteBalance()),
    });
  }
  return balances;
}

function uniqueEventProviders(events: readonly CostEvent[]): MyMeterProviderDescriptor[] {
  const seen = new Set<string>();
  const providers: MyMeterProviderDescriptor[] = [];
  for (const event of events) {
    const id = event.provider.trim();
    const normalized = id.toLowerCase();
    if (!id || normalized === "unknown" || seen.has(normalized)) continue;
    seen.add(normalized);
    providers.push({
      id,
      name: id,
      balanceSupported: false,
    });
  }
  return providers;
}

function unavailableRemoteBalance(): MyMeterRemoteSnapshot["balance"] {
  return {
    status: "unavailable",
    currency: null,
    totalMicroCny: null,
    grantedMicroCny: null,
    toppedUpMicroCny: null,
    refreshedAt: null,
  };
}

function withActiveRequestSessionSummaries(
  baseSessions: readonly RemoteSessionSummary[],
  events: readonly CostEvent[],
  aggregation: LedgerAggregation,
  activeRequests: ReadonlyMap<string, ActiveRequestState>,
): RemoteSessionSummary[] {
  const active = latestActiveRequest([...activeRequests.values()].filter(isSupportedPricingRequest));
  if (!active) {
    return [...baseSessions];
  }

  const activeEvent = events.find((event) => event.eventKey === active.eventKey) ?? null;
  const sessionSummary = aggregation.sessions.get(active.sessionId);
  const currentRequestMicroCny = activeEvent?.status === "estimated" ? toNumber(activeEvent.amountMicroCny) : 0;
  const sessionTotalMicroCny = sessionSummary?.totalMicroCny ?? currentRequestMicroCny;
  const existingSession = baseSessions.find((session) => session.id === active.sessionId);
  const sessions = baseSessions.filter((session) => session.id !== active.sessionId);
  sessions.push({
    id: active.sessionId,
    title: existingSession?.title ?? active.sessionId,
    provider: active.provider,
    model: active.model,
    reasoningEffort: active.reasoningEffort,
    agentPreset: active.agentPreset,
    status: "billing",
    currentRequestMicroCny,
    sessionTotalMicroCny,
    unknownCount: existingSession?.unknownCount ?? sessionSummary?.unknownCount ?? 0,
    lastActivityAt: active.lastActivityAt,
    ...(existingSession?.currencyTotals ? { currencyTotals: existingSession.currencyTotals } : {}),
    ...(existingSession?.currency ? { currency: existingSession.currency } : {}),
    ...(existingSession?.currentRequestMinor !== undefined ? { currentRequestMinor: existingSession.currentRequestMinor } : {}),
    ...(existingSession?.sessionTotalMinor !== undefined ? { sessionTotalMinor: existingSession.sessionTotalMinor } : {}),
    ...(existingSession?.cnyEquivalentMicroCny !== undefined ? { cnyEquivalentMicroCny: existingSession.cnyEquivalentMicroCny } : {}),
  });
  sessions.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  return sessions;
}

function withActiveRequestSnapshot(
  snapshot: MyMeterRemoteSnapshot,
  events: readonly CostEvent[],
  aggregation: LedgerAggregation,
  contextBreakdown: ((sessionId: string) => RemoteContextBreakdown | null) | undefined,
  activeRequests: ReadonlyMap<string, ActiveRequestState>,
): MyMeterRemoteSnapshot {
  const active = latestActiveRequest([...activeRequests.values()].filter(isSupportedPricingRequest));
  if (!active) {
    return snapshot;
  }

  const activeEvent = events.find((event) => event.eventKey === active.eventKey) ?? null;
  const sessionSummary = aggregation.sessions.get(active.sessionId);
  const currentRequestMicroCny = activeEvent?.status === "estimated" ? toNumber(activeEvent.amountMicroCny) : 0;
  const sessionTotalMicroCny = sessionSummary?.totalMicroCny ?? currentRequestMicroCny;
  const pricingZone = activeEvent?.pricingZone ?? "unknown";
  const existingSession = snapshot.sessions.find((session) => session.id === active.sessionId);
  const sessions = snapshot.sessions.filter((session) => session.id !== active.sessionId);
  sessions.push({
    id: active.sessionId,
    title: existingSession?.title ?? active.sessionId,
    provider: active.provider,
    model: active.model,
    reasoningEffort: active.reasoningEffort,
    agentPreset: active.agentPreset,
    status: "billing",
    currentRequestMicroCny,
    sessionTotalMicroCny,
    unknownCount: existingSession?.unknownCount ?? sessionSummary?.unknownCount ?? 0,
    lastActivityAt: active.lastActivityAt,
    ...(existingSession?.currencyTotals ? { currencyTotals: existingSession.currencyTotals } : {}),
    ...(existingSession?.currency ? { currency: existingSession.currency } : {}),
    ...(existingSession?.currentRequestMinor !== undefined ? { currentRequestMinor: existingSession.currentRequestMinor } : {}),
    ...(existingSession?.sessionTotalMinor !== undefined ? { sessionTotalMinor: existingSession.sessionTotalMinor } : {}),
    ...(existingSession?.cnyEquivalentMicroCny !== undefined ? { cnyEquivalentMicroCny: existingSession.cnyEquivalentMicroCny } : {}),
  });
  sessions.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

  const details = { ...snapshot.details };
  details[active.sessionId] = toActiveSessionDetail(
    active,
    activeEvent,
    details[active.sessionId] ?? null,
    sessionSummary,
    contextBreakdown?.(active.sessionId) ?? null,
  );

  return {
    ...snapshot,
    currentSessionId: active.sessionId,
    summary: {
      ...snapshot.summary,
      status: { code: "billing" },
      provider: active.provider,
      model: active.model,
      reasoningEffort: active.reasoningEffort,
      agentPreset: active.agentPreset,
      currentRequestMicroCny,
      sessionTotalMicroCny,
      pricingZone,
    },
    sessions,
    details,
  };
}

function latestActiveRequest(activeRequests: readonly ActiveRequestState[]): ActiveRequestState | null {
  return [...activeRequests].sort((a, b) => Date.parse(a.lastActivityAt) - Date.parse(b.lastActivityAt)).at(-1) ?? null;
}

function isSupportedPricingRequest(request: ActiveRequestState): boolean {
  return pricingKind(request.provider, request.model) !== null;
}

function toActiveSessionDetail(
  active: ActiveRequestState,
  activeEvent: CostEvent | null,
  existing: RemoteSessionDetail | null,
  summary: LedgerSummary | undefined,
  liveContextBreakdown: RemoteContextBreakdown | null,
): RemoteSessionDetail {
  const currentRequestMicroCny = activeEvent?.status === "estimated" ? toNumber(activeEvent.amountMicroCny) : 0;
  const sessionTotalMicroCny = summary?.totalMicroCny ?? currentRequestMicroCny;
  const tokenBuckets = existing?.tokenBuckets ?? emptyTokenBuckets();
  const turns = activeEvent
    ? existing?.turns ?? [toAggregatedRemoteTurn([activeEvent])]
    : mergeActiveRemoteTurn(existing?.turns ?? [], active, currentRequestMicroCny);
  const stages = activeEvent
    ? existing?.stages ?? [toActiveRemoteStage(active, currentRequestMicroCny, tokenBuckets, liveContextBreakdown)]
    : mergeActiveRemoteStage(existing?.stages ?? [], active, currentRequestMicroCny, liveContextBreakdown);

  return {
    id: active.sessionId,
    title: existing?.title ?? active.sessionId,
    provider: active.provider,
    model: active.model,
    reasoningEffort: active.reasoningEffort,
    agentPreset: active.agentPreset,
    status: "billing",
    pricingZone: activeEvent?.pricingZone ?? "unknown",
    currentRequestMicroCny,
    sessionTotalMicroCny,
    settledTotalMicroCny: existing?.settledTotalMicroCny ?? summary?.settledMicroCny ?? 0,
    estimatedTotalMicroCny: existing?.estimatedTotalMicroCny ?? summary?.estimatedMicroCny ?? currentRequestMicroCny,
    unknownCount: existing?.unknownCount ?? summary?.unknownCount ?? 0,
    tokenBuckets,
    contextBreakdown: liveContextBreakdown ?? existing?.contextBreakdown ?? null,
    turns,
    stages,
    currencyTotals: existing?.currencyTotals ?? [],
    cnyEquivalentMicroCny: existing?.cnyEquivalentMicroCny ?? null,
  };
}

function toActiveRemoteTurn(active: ActiveRequestState, currentRequestMicroCny: number): RemoteTurn {
  const currency = pricingKind(active.provider, active.model) && pricingKind(active.provider, active.model) !== "deepseek" ? "USD" : "CNY";
  return {
    id: active.eventKey,
    label: active.turnId,
    startedAt: active.requestStartedAt,
    completedAt: null,
    status: "billing",
    pricingZone: "unknown",
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    amountMicroCny: currentRequestMicroCny,
    note: "等待 usage",
    ...(currency === "USD" ? { currency, amountMinor: legacyCnyToUsdMinor(currentRequestMicroCny) } : {}),
  };
}

function toActiveRemoteStage(
  active: ActiveRequestState,
  currentRequestMicroCny: number,
  tokenBuckets: RemoteSessionDetail["tokenBuckets"],
  contextBreakdown: RemoteContextBreakdown | null,
  index = 1,
): RemoteSessionStage {
  const kind = pricingKind(active.provider, active.model);
  const supportsPricing = kind !== null;
  const nativeCurrency = kind && kind !== "deepseek" ? "USD" : "CNY";
  const toNative = (value: number | null): number | null => nativeCurrency === "USD" && value !== null ? legacyCnyToUsdMinor(value) : value;
  const pricingZone = kind === "deepseek" ? resolveDeepSeekPricingZone(active.requestStartedAt) : "unknown";
  const unitPrices = supportsPricing ? calculateUnitPrices(active.provider, active.model, active.requestStartedAt, pricingZone) : null;
  return {
    id: `${active.sessionId}-active-${active.turnId}-${active.stepId}-${active.attemptId}`,
    index,
    isCurrent: true,
    startedAt: active.requestStartedAt,
    completedAt: null,
    lastActivityAt: active.lastActivityAt,
    status: "billing",
    model: active.model,
    reasoningEffort: active.reasoningEffort,
    agentPreset: active.agentPreset,
    pricingZone,
    priceVersion: supportsPricing ? unitPrices?.priceVersion ?? "" : "",
    exchangeRateLabel: kind && kind !== "deepseek" ? USD_CNY_EXCHANGE_RATE_LABEL : null,
    ...(nativeCurrency === "USD" ? { currency: nativeCurrency } : {}),
    ...(nativeCurrency === "USD" ? {
      currentRequestMinor: toNative(currentRequestMicroCny) ?? 0,
      totalMinor: toNative(currentRequestMicroCny) ?? 0,
      settledTotalMinor: 0,
      estimatedTotalMinor: toNative(currentRequestMicroCny) ?? 0,
    } : {}),
    currentRequestMicroCny,
    totalMicroCny: currentRequestMicroCny,
    settledTotalMicroCny: 0,
    estimatedTotalMicroCny: currentRequestMicroCny,
    unknownCount: 0,
    tokenBuckets: tokenBuckets.map((bucket) => ({
      ...bucket,
      unitPriceMicroCnyPerMillionTokens: unitPrices === null
        ? null
        : bucket.label === "缓存命中"
          ? toRemoteUnitPrice(unitPrices.cacheHit)
          : bucket.label === "缓存未命中"
            ? toRemoteUnitPrice(unitPrices.cacheMiss)
            : toRemoteUnitPrice(unitPrices.output),
      ...nativeRemoteFields(
        nativeCurrency,
        0,
        toNative(bucket.label === "缓存命中"
          ? toRemoteUnitPrice(unitPrices?.cacheHit ?? 0n)
          : bucket.label === "缓存未命中"
            ? toRemoteUnitPrice(unitPrices?.cacheMiss ?? 0n)
            : toRemoteUnitPrice(unitPrices?.output ?? 0n)),
      ),
    })),
    turns: [toActiveRemoteTurn(active, currentRequestMicroCny)],
    contextBreakdown,
  };
}

function emptyTokenBuckets(): RemoteSessionDetail["tokenBuckets"] {
  return [
    { label: "缓存命中", tokens: 0, amountMicroCny: 0 },
    { label: "缓存未命中", tokens: 0, amountMicroCny: 0 },
    { label: "输出", tokens: 0, amountMicroCny: 0 },
    { label: "其中推理", tokens: 0, amountMicroCny: 0 },
  ];
}

function toRemoteSessionSummary(
  sessionId: string,
  summary: LedgerSummary,
  events: readonly CostEvent[],
  exchangeRate: RemoteExchangeRateSnapshot,
): RemoteSessionSummary {
  const latest = latestEvent(events.filter((event) => event.sessionId === sessionId));
  const sessionEvents = events.filter((event) => event.sessionId === sessionId);
  const currencyTotals = aggregateCurrencyTotals(sessionEvents);
  const native = latest ? eventCurrency(latest) : currencyTotals[0]?.currency ?? "CNY";
  const nativeTotal = currencyTotals.length === 1 ? currencyTotals[0]?.amountMinor ?? 0 : undefined;
  const nativeCurrent = latest?.status === "estimated" ? toNumber(eventMinor(latest)) : 0;
  return {
    id: sessionId,
    title: sessionId,
    provider: summary.provider,
    model: summary.model,
    reasoningEffort: summary.reasoningEffort,
    agentPreset: summary.agentPreset,
    status: latest ? toMeterStatus(latest) : "idle",
    currentRequestMicroCny: latest?.status === "estimated" ? toNumber(latest.amountMicroCny) : 0,
    sessionTotalMicroCny: summary.totalMicroCny,
    unknownCount: summary.unknownCount,
    lastActivityAt: summary.lastSeenAt,
    currencyTotals,
    ...(currencyTotals.length === 1 ? { currency: native, currentRequestMinor: nativeCurrent, sessionTotalMinor: nativeTotal ?? 0 } : {}),
    ...(currencyTotals.length > 1 ? { cnyEquivalentMicroCny: cnyEquivalentMicroCny(currencyTotals, exchangeRate) } : {}),
  };
}

function toRemoteSessionDetail(
  sessionId: string,
  summary: LedgerSummary,
  events: readonly CostEvent[],
  contextBreakdown: RemoteContextBreakdown | null,
  exchangeRate: RemoteExchangeRateSnapshot,
): RemoteSessionDetail {
  const latest = latestEvent(events);
  const tokenBucketCosts = aggregateTokenBucketCosts(events);
  const native = aggregateNativeStage(events);
  const unitPrices = summarizeSessionUnitPrices(groupSessionStageEvents(events));
  return {
    id: sessionId,
    title: sessionId,
    provider: summary.provider,
    model: summary.model,
    reasoningEffort: summary.reasoningEffort,
    agentPreset: summary.agentPreset,
    status: latest ? toMeterStatus(latest) : "idle",
    pricingZone: latest?.pricingZone ?? "unknown",
    currentRequestMicroCny: latest?.status === "estimated" ? toNumber(latest.amountMicroCny) : 0,
    sessionTotalMicroCny: summary.totalMicroCny,
    settledTotalMicroCny: summary.settledMicroCny,
    estimatedTotalMicroCny: summary.estimatedMicroCny,
    unknownCount: summary.unknownCount,
    tokenBuckets: [
      {
        label: "缓存命中",
        tokens: summary.cacheHitTokens,
        amountMicroCny: toNumber(tokenBucketCosts.cacheHitMicroCny),
        unitPriceMicroCnyPerMillionTokens: unitPrices.cacheHit.value,
        ...nativeRemoteFields(native.currency, native.cacheHitMinor, native.cacheHitRate),
        ...(unitPrices.cacheHit.mixed ? { unitPriceMixed: true } : {}),
      },
      {
        label: "缓存未命中",
        tokens: summary.cacheMissTokens,
        amountMicroCny: toNumber(tokenBucketCosts.cacheMissMicroCny),
        unitPriceMicroCnyPerMillionTokens: unitPrices.cacheMiss.value,
        ...nativeRemoteFields(native.currency, native.cacheMissMinor, native.cacheMissRate),
        ...(unitPrices.cacheMiss.mixed ? { unitPriceMixed: true } : {}),
      },
      {
        label: "输出",
        tokens: summary.outputTokens,
        amountMicroCny: toNumber(tokenBucketCosts.outputMicroCny),
        unitPriceMicroCnyPerMillionTokens: unitPrices.output.value,
        ...nativeRemoteFields(native.currency, native.outputMinor, native.outputRate),
        ...(unitPrices.output.mixed ? { unitPriceMixed: true } : {}),
      },
      {
        label: "其中推理",
        tokens: summary.reasoningTokens,
        amountMicroCny: 0,
        unitPriceMicroCnyPerMillionTokens: unitPrices.output.value,
        ...nativeRemoteFields(native.currency, 0, native.outputRate),
      },
    ],
    contextBreakdown,
    turns: toRemoteTurns(events),
    stages: buildRemoteSessionStages(sessionId, events, contextBreakdown),
    currencyTotals: aggregateCurrencyTotals(events),
    cnyEquivalentMicroCny: cnyEquivalentMicroCny(aggregateCurrencyTotals(events), exchangeRate),
  };
}

function buildRemoteSessionStages(
  sessionId: string,
  events: readonly CostEvent[],
  liveContextBreakdown: RemoteContextBreakdown | null,
): RemoteSessionStage[] {
  const grouped = groupSessionStageEvents(events);

  return grouped.map((stageEvents, index): RemoteSessionStage => {
    const isCurrent = index === grouped.length - 1;
    const latest = latestEvent(stageEvents);
    const first = stageEvents[0]!;
    const tokenBucketCosts = aggregateTokenBucketCosts(stageEvents);
    const summary = aggregateStageSummary(stageEvents);
    const native = aggregateNativeStage(stageEvents);
    const unitPrices = unitPricesForEvents(stageEvents);

    return {
      id: `${sessionId}-stage-${index + 1}`,
      index: index + 1,
      isCurrent,
      startedAt: first.requestStartedAt,
      // A stage describes the requests that were actually billed under one
      // configuration. Its end is the last request activity, rather than the
      // next stage's start, so idle gaps are not shown as active stage time.
      completedAt: isCurrent ? null : latest ? eventActivityIso(latest) : first.requestStartedAt,
      lastActivityAt: latest ? eventActivityIso(latest) : first.requestStartedAt,
      status: latest ? toMeterStatus(latest) : "idle",
      model: first.model,
      reasoningEffort: first.reasoningEffort ?? "unknown",
      agentPreset: first.agentPreset ?? "unknown",
      pricingZone: first.pricingZone,
      priceVersion: first.priceVersion,
      exchangeRateLabel: pricingKind(first.provider, first.model) !== "deepseek" && pricingKind(first.provider, first.model) !== null
        ? USD_CNY_EXCHANGE_RATE_LABEL
        : null,
      ...(native.currency === "CNY" ? {} : {
        currency: native.currency,
        currentRequestMinor: latest?.status === "estimated" ? toNumber(eventMinor(latest)) : 0,
        totalMinor: native.totalMinor,
        settledTotalMinor: native.settledMinor,
        estimatedTotalMinor: native.estimatedMinor,
      }),
      currentRequestMicroCny: latest?.status === "estimated" ? toNumber(latest.amountMicroCny) : 0,
      totalMicroCny: summary.totalMicroCny,
      settledTotalMicroCny: summary.settledTotalMicroCny,
      estimatedTotalMicroCny: summary.estimatedTotalMicroCny,
      unknownCount: summary.unknownCount,
      tokenBuckets: [
        {
          label: "缓存命中",
          tokens: summary.cacheHitTokens,
          amountMicroCny: toNumber(tokenBucketCosts.cacheHitMicroCny),
          unitPriceMicroCnyPerMillionTokens: unitPrices.cacheHit,
          ...nativeRemoteFields(native.currency, native.cacheHitMinor, native.cacheHitRate),
        },
        {
          label: "缓存未命中",
          tokens: summary.cacheMissTokens,
          amountMicroCny: toNumber(tokenBucketCosts.cacheMissMicroCny),
          unitPriceMicroCnyPerMillionTokens: unitPrices.cacheMiss,
          ...nativeRemoteFields(native.currency, native.cacheMissMinor, native.cacheMissRate),
        },
        {
          label: "输出",
          tokens: summary.outputTokens,
          amountMicroCny: toNumber(tokenBucketCosts.outputMicroCny),
          unitPriceMicroCnyPerMillionTokens: unitPrices.output,
          ...nativeRemoteFields(native.currency, native.outputMinor, native.outputRate),
        },
        {
          label: "其中推理",
          tokens: summary.reasoningTokens,
          amountMicroCny: 0,
          unitPriceMicroCnyPerMillionTokens: unitPrices.output,
          ...nativeRemoteFields(native.currency, 0, native.outputRate),
        },
      ],
      turns: toRemoteTurns(stageEvents),
      contextBreakdown: stageContextBreakdown(stageEvents, isCurrent, liveContextBreakdown),
    };
  });
}

function groupSessionStageEvents(events: readonly CostEvent[]): CostEvent[][] {
  const grouped: CostEvent[][] = [];
  for (const event of [...events].sort(compareEventStart)) {
    const current = grouped.at(-1);
    if (!current || stageBoundaryKey(current[0]!) !== stageBoundaryKey(event)) {
      grouped.push([event]);
    } else {
      current.push(event);
    }
  }
  return grouped;
}

function summarizeSessionUnitPrices(groups: readonly (readonly CostEvent[])[]): {
  cacheHit: { value: number | null; mixed: boolean };
  cacheMiss: { value: number | null; mixed: boolean };
  output: { value: number | null; mixed: boolean };
} {
  return {
    cacheHit: summarizeBucketUnitPrice(groups, "cacheHit", (event) => event.cacheHitTokens),
    cacheMiss: summarizeBucketUnitPrice(groups, "cacheMiss", (event) => event.cacheMissTokens),
    output: summarizeBucketUnitPrice(groups, "output", (event) => event.outputTokens),
  };
}

function summarizeBucketUnitPrice(
  groups: readonly (readonly CostEvent[])[],
  bucket: keyof ReturnType<typeof unitPricesForEvent>,
  tokensForEvent: (event: CostEvent) => bigint,
): { value: number | null; mixed: boolean } {
  const consumingGroups = groups.filter((group) => group.some((event) => tokensForEvent(event) > 0n));
  if (consumingGroups.length === 0) return { value: null, mixed: false };

  const values = consumingGroups.map((group) => unitPricesForEvents(group)[bucket]);
  if (values.length === 0 || values.some((value) => value === null)) {
    return { value: null, mixed: false };
  }

  const distinct = new Set(values as number[]);
  return distinct.size === 1
    ? { value: values[0]!, mixed: false }
    : { value: null, mixed: true };
}

function stageBoundaryKey(event: CostEvent): string {
  const kind = pricingKind(event.provider, event.model);
  const providerRateTier = kind !== null && kind !== "deepseek"
    ? (() => {
      const unitPrices = calculateUnitPrices(
        event.provider,
        event.model,
        event.requestStartedAt,
        event.pricingZone,
        providerQuoteInputTokens(event.cacheHitTokens, event.cacheMissTokens),
      );
      return [unitPrices.cacheHit, unitPrices.cacheMiss, unitPrices.output].map(String).join(":");
    })()
    : "";
  return [
    event.model,
    event.reasoningEffort ?? "unknown",
    event.agentPreset ?? "unknown",
    event.pricingZone,
    event.priceVersion,
    providerRateTier,
  ].join("\u001f");
}

function aggregateStageSummary(events: readonly CostEvent[]): {
  totalMicroCny: number;
  settledTotalMicroCny: number;
  estimatedTotalMicroCny: number;
  unknownCount: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  outputTokens: number;
  reasoningTokens: number;
} {
  return events.reduce(
    (summary, event) => {
      const amountMicroCny = toNumber(event.amountMicroCny);
      summary.cacheHitTokens += toNumber(event.cacheHitTokens);
      summary.cacheMissTokens += toNumber(event.cacheMissTokens);
      summary.outputTokens += toNumber(event.outputTokens);
      summary.reasoningTokens += toNumber(event.reasoningTokens);

      if (event.status === "settled") {
        summary.settledTotalMicroCny += amountMicroCny;
        summary.totalMicroCny += amountMicroCny;
      } else if (event.status === "failed") {
        summary.totalMicroCny += amountMicroCny;
      } else if (event.status === "estimated") {
        summary.estimatedTotalMicroCny += amountMicroCny;
        summary.totalMicroCny += amountMicroCny;
      } else if (event.status === "unknown") {
        summary.unknownCount += 1;
      }

      return summary;
    },
    {
      totalMicroCny: 0,
      settledTotalMicroCny: 0,
      estimatedTotalMicroCny: 0,
      unknownCount: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
    },
  );
}

function stageContextBreakdown(
  events: readonly CostEvent[],
  isCurrent: boolean,
  liveContextBreakdown: RemoteContextBreakdown | null,
): RemoteContextBreakdown | null {
  const latest = latestEvent(events);
  const eventContext = latest ? readEventContextBreakdown(latest) : null;
  if (eventContext) {
    return eventContext;
  }
  return isCurrent ? liveContextBreakdown : null;
}

function readEventContextBreakdown(event: CostEvent): RemoteContextBreakdown | null {
  const value = (event as CostEvent & { contextBreakdown?: unknown }).contextBreakdown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Partial<RemoteContextBreakdown>;
  return isNonNegativeNumber(candidate.systemTokens) &&
    isNonNegativeNumber(candidate.toolsTokens) &&
    isNonNegativeNumber(candidate.messageTokens)
    ? {
      systemTokens: candidate.systemTokens,
      toolsTokens: candidate.toolsTokens,
      messageTokens: candidate.messageTokens,
    }
    : null;
}

function aggregateTokenBucketCosts(events: readonly CostEvent[]): {
  cacheHitMicroCny: bigint;
  cacheMissMicroCny: bigint;
  outputMicroCny: bigint;
} {
  return events.reduce(
    (bucket, event) => ({
      cacheHitMicroCny: bucket.cacheHitMicroCny + event.cacheHitMicroCny,
      cacheMissMicroCny: bucket.cacheMissMicroCny + event.cacheMissMicroCny,
      outputMicroCny: bucket.outputMicroCny + event.outputMicroCny,
    }),
    {
      cacheHitMicroCny: 0n,
      cacheMissMicroCny: 0n,
      outputMicroCny: 0n,
    },
  );
}

function toRemoteTurns(events: readonly CostEvent[]): RemoteTurn[] {
  const grouped = new Map<string, CostEvent[]>();
  for (const event of [...events].sort(compareEventStart)) {
    const key = event.turnId === "unknown" ? event.eventKey : event.turnId;
    const turnEvents = grouped.get(key) ?? [];
    turnEvents.push(event);
    grouped.set(key, turnEvents);
  }
  return [...grouped.values()].map(toAggregatedRemoteTurn);
}

function toAggregatedRemoteTurn(events: readonly CostEvent[]): RemoteTurn {
  const sorted = [...events].sort(compareEventStart);
  const first = sorted[0]!;
  const latest = latestEvent(sorted) ?? first;
  const hasActiveEstimatedRequest = sorted.some(
    (event) => event.status === "estimated" && (!event.completedAt || event.completedAt === "unknown"),
  );
  const completedAt = hasActiveEstimatedRequest
    ? null
    : latest.completedAt && latest.completedAt !== "unknown" ? latest.completedAt : null;
  const pricingZones = new Set(sorted.map((event) => event.pricingZone));
  return {
    id: first.turnId === "unknown" ? first.eventKey : `${first.sessionId}:turn:${first.turnId}`,
    label: first.turnId,
    startedAt: first.requestStartedAt,
    completedAt,
    status: hasActiveEstimatedRequest ? "billing" : toMeterStatus(latest),
    pricingZone: pricingZones.size === 1 ? latest.pricingZone : "unknown",
    cacheHitTokens: sumEventValues(sorted, (event) => event.cacheHitTokens),
    cacheMissTokens: sumEventValues(sorted, (event) => event.cacheMissTokens),
    outputTokens: sumEventValues(sorted, (event) => event.outputTokens),
    reasoningTokens: sumEventValues(sorted, (event) => event.reasoningTokens),
    amountMicroCny: sumEventValues(sorted, (event) => event.amountMicroCny),
    note: latest.unknownReason ?? null,
    currency: eventCurrency(first),
    amountMinor: toNumber(sorted.reduce((sum, event) => sum + eventMinor(event), 0n)),
  };
}

function mergeActiveRemoteTurn(
  turns: readonly RemoteTurn[],
  active: ActiveRequestState,
  currentRequestMicroCny: number,
): RemoteTurn[] {
  const activeTurn = toActiveRemoteTurn(active, currentRequestMicroCny);
  const existingIndex = turns.findIndex((turn) => turn.label === active.turnId);
  if (existingIndex < 0) {
    return [...turns, activeTurn];
  }

  return turns.map((turn, index) => index === existingIndex
    ? {
      ...turn,
      completedAt: null,
      status: "billing",
      amountMicroCny: turn.amountMicroCny + currentRequestMicroCny,
      note: activeTurn.note,
    }
    : turn);
}

function mergeActiveRemoteStage(
  stages: readonly RemoteSessionStage[],
  active: ActiveRequestState,
  currentRequestMicroCny: number,
  contextBreakdown: RemoteContextBreakdown | null,
): RemoteSessionStage[] {
  const currentIndex = stages.length - 1;
  const current = stages[currentIndex];
  if (current && isSameActiveStage(current, active)) {
    return stages.map((stage, index) => index === currentIndex
      ? {
        ...stage,
        isCurrent: true,
        completedAt: null,
        lastActivityAt: active.lastActivityAt,
        status: "billing",
        currentRequestMicroCny,
        totalMicroCny: stage.totalMicroCny + currentRequestMicroCny,
        estimatedTotalMicroCny: stage.estimatedTotalMicroCny + currentRequestMicroCny,
        turns: mergeActiveRemoteTurn(stage.turns, active, currentRequestMicroCny),
        contextBreakdown: contextBreakdown ?? stage.contextBreakdown,
      }
      : stage);
  }

  const historicalStages = stages.map((stage) => ({
    ...stage,
    isCurrent: false,
    completedAt: stage.completedAt ?? active.requestStartedAt,
  }));
  return [
    ...historicalStages,
    toActiveRemoteStage(
      active,
      currentRequestMicroCny,
      emptyTokenBuckets(),
      contextBreakdown,
      historicalStages.length + 1,
    ),
  ];
}

function isSameActiveStage(stage: RemoteSessionStage, active: ActiveRequestState): boolean {
  const sameMetadata = stage.model === active.model
    && stage.reasoningEffort === active.reasoningEffort
    && stage.agentPreset === active.agentPreset;
  if (!sameMetadata) return false;
  const kind = pricingKind(active.provider, active.model);
  if (kind !== "deepseek") {
    const currentPriceVersion = calculateUnitPrices(active.provider, active.model, active.requestStartedAt, "unknown").priceVersion;
    return stage.pricingZone === "unknown" && stage.priceVersion === currentPriceVersion;
  }
  return stage.pricingZone === resolveDeepSeekPricingZone(active.requestStartedAt)
    && stage.priceVersion === DEEPSEEK_PRICE_VERSION;
}

function sumEventValues(events: readonly CostEvent[], select: (event: CostEvent) => bigint): number {
  return toNumber(events.reduce((total, event) => total + select(event), 0n));
}

function latestEvent(events: readonly CostEvent[]): CostEvent | null {
  return [...events].sort(compareEventActivity).at(-1) ?? null;
}

function compareEventActivity(a: CostEvent, b: CostEvent): number {
  return activityTime(a) - activityTime(b);
}

function compareEventStart(a: CostEvent, b: CostEvent): number {
  const startDelta = Date.parse(a.requestStartedAt) - Date.parse(b.requestStartedAt);
  if (startDelta !== 0) {
    return startDelta;
  }
  return a.eventKey.localeCompare(b.eventKey);
}

function activityTime(event: CostEvent): number {
  return Date.parse(event.completedAt ?? event.requestStartedAt);
}

function eventActivityIso(event: CostEvent): string {
  return event.completedAt ?? event.requestStartedAt;
}

function toMeterStatus(event: CostEvent): MyMeterRemoteSnapshot["summary"]["status"]["code"] {
  if (event.requestOutcome === "aborted") {
    return "aborted";
  }
  if (event.status === "unknown") {
    return "unknown";
  }
  if (event.status === "estimated") {
    return event.completedAt ? "unknown" : "billing";
  }
  return event.status;
}

type BalanceWithExplicitMicroCny = (MyMeterBalanceDto | BalanceSnapshot) & {
  totalMicroCny?: bigint | number | null | undefined;
  grantedMicroCny?: bigint | number | null | undefined;
  toppedUpMicroCny?: bigint | number | null | undefined;
  updatedAt?: string | undefined;
};

function sameRemoteBalance(
  left: MyMeterRemoteSnapshot["balance"],
  right: MyMeterRemoteSnapshot["balance"],
): boolean {
  const sameValues = left.status === right.status
    && left.currency === right.currency
    && left.totalMicroCny === right.totalMicroCny
    && left.grantedMicroCny === right.grantedMicroCny
    && left.toppedUpMicroCny === right.toppedUpMicroCny;
  if (!sameValues) return false;
  const emptyUnavailable = left.status === "unavailable"
    && left.totalMicroCny === null
    && left.grantedMicroCny === null
    && left.toppedUpMicroCny === null;
  return emptyUnavailable || left.refreshedAt === right.refreshedAt;
}

function toRemoteBalance(balance: MyMeterBalanceDto | BalanceSnapshot): MyMeterRemoteSnapshot["balance"] {
  const balanceWithMicro = balance as BalanceWithExplicitMicroCny;

  if (hasExplicitMicroCnyBalance(balanceWithMicro)) {
    return {
      status: balanceWithMicro.status,
      currency: normalizeRemoteBalanceCurrency(balanceWithMicro.currency),
      totalMicroCny: toNullableNumber(balanceWithMicro.totalMicroCny),
      grantedMicroCny: toNullableNumber(balanceWithMicro.grantedMicroCny),
      toppedUpMicroCny: toNullableNumber(balanceWithMicro.toppedUpMicroCny),
      refreshedAt: toBalanceRefreshedAt(balanceWithMicro),
    };
  }

  if (isLegacyBalanceSnapshot(balance)) {
    return {
      status: balance.status,
      currency: normalizeRemoteBalanceCurrency(balance.currency),
      totalMicroCny: cnyToMicroCny(balance.total),
      grantedMicroCny: cnyToMicroCny(balance.granted),
      toppedUpMicroCny: cnyToMicroCny(balance.toppedUp),
      refreshedAt: toBalanceRefreshedAt(balance),
    };
  }

  return {
    status: balance.status,
    currency: null,
    totalMicroCny: null,
    grantedMicroCny: null,
    toppedUpMicroCny: null,
    refreshedAt: null,
  };
}

function normalizeRemoteBalanceCurrency(currency: unknown): string | null {
  return typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "CNY";
}

async function fetchLatestUsdCnyRate(): Promise<{ rate: number; fetchedAt?: string; source?: string }> {
  if (typeof fetch !== "function") {
    throw new Error("当前运行环境不支持查询汇率");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=CNY", {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`汇率接口请求失败（HTTP ${response.status}）`);
    }
    const payload = await response.json() as { date?: unknown; rates?: { CNY?: unknown } };
    const rate = typeof payload.rates?.CNY === "number" ? payload.rates.CNY : Number(payload.rates?.CNY);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("汇率接口未返回 USD/CNY 汇率");
    }
    return {
      rate,
      fetchedAt: typeof payload.date === "string" ? `${payload.date}T23:59:59Z` : new Date().toISOString(),
      source: "Frankfurter ECB",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function hasExplicitMicroCnyBalance(balance: BalanceWithExplicitMicroCny): boolean {
  return "totalMicroCny" in balance || "grantedMicroCny" in balance || "toppedUpMicroCny" in balance;
}

function isLegacyBalanceSnapshot(balance: MyMeterBalanceDto | BalanceSnapshot): balance is BalanceSnapshot {
  return "total" in balance || "granted" in balance || "toppedUp" in balance || "fetchedAt" in balance;
}

function toBalanceRefreshedAt(balance: BalanceWithExplicitMicroCny | BalanceSnapshot): string | null {
  if ("updatedAt" in balance && typeof balance.updatedAt === "string" && balance.updatedAt.trim()) {
    return balance.updatedAt;
  }

  if ("fetchedAt" in balance && typeof balance.fetchedAt === "number" && Number.isFinite(balance.fetchedAt)) {
    return new Date(balance.fetchedAt).toISOString();
  }

  return null;
}

function cnyToMicroCny(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const microCny = Math.round(value * 1_000_000);
  if (!Number.isSafeInteger(microCny)) {
    throw new Error("CNY balance value exceeds safe micro-CNY integer range");
  }
  return microCny;
}

function normalizeOutcome(value: unknown): CostRequestOutcome | undefined {
  return value === "success" || value === "failed" || value === "aborted" ? value : undefined;
}

function asRecord(value: unknown): DshPayload {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as DshPayload) : {};
}

function asDateInput(value: unknown): DateInput | null {
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    return value;
  }
  return null;
}

function toIsoDateInput(value: DateInput | null): string | null {
  if (value === null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? date.toISOString() : null;
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asOptionalText(value: unknown): string | undefined {
  const text = asText(value);
  return text.length > 0 ? text : undefined;
}

function toNullableNumber(value: bigint | number | null | undefined): number | null {
  return value === null || value === undefined ? null : toNumber(value);
}

function toNumber(value: bigint | number): number {
  if (typeof value === "number") {
    return value;
  }
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) {
    throw new Error("micro-CNY or token value exceeds safe integer range");
  }
  return numberValue;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export {
  apply,
  apply as applyCordisHost,
  createMyMeterCordisHostRuntime,
  inject,
  name,
} from "./cordis-host";
export type { MyMeterCordisHostConfig, MyMeterCordisHostOptions, MyMeterTypertHostContext } from "./cordis-host";
export {
  buildSessionCostTree,
} from "./session-cost-tree";
export type {
  BuildSessionCostTreeOptions,
  MissingParentSession,
  SessionCostTree,
  SessionCostTreeEvent,
  SessionCostTreeNode,
} from "./session-cost-tree";
export {
  MYMETER_LOCAL_TYPERT_CONTRIBUTION,
  MYMETER_REMOTE_CONTRIBUTION,
  MYMETER_REMOTE_DESCRIPTORS,
  MYMETER_SERVICE_KEY,
  bindMyMeterTypertRemote,
  createMyMeterRemoteFromTypert,
} from "./typert-remote";
export type {
  InvocationDescriptor,
  MyMeterTypertRemoteNamespace,
  MyMeterTypertRemoteRoot,
  RemoteResult,
  TypertLocalContribution,
  TypertRemoteContribution,
} from "./typert-remote";
