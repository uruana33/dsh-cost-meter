import { createAmountView, formatStatusLabel, formatTone } from "./format";
import { deriveBillingInsights } from "./billing-insights";
import type {
  AmountView,
  AsyncResourceView,
  CostAnalyticsView,
  CostTrendBucketView,
  LedgerExportView,
  MeterStatusCode,
  MyMeterSettings,
  MyMeterViewModel,
  PricingZone,
  SessionCostTreeNodeView,
  SessionCostTreeView,
  SessionDetailView,
  SessionSummaryView,
  SessionTurnView,
  TokenBucketView,
  UsageOverviewView,
} from "./view-model";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type BalanceStatus = "fresh" | "stale" | "expired" | "insufficient" | "unavailable";
export type ConnectionStatus = "connected" | "stale" | "loading" | "error";
export type { PricingZone };

export interface RemoteAmountSummary {
  microCny: number;
}

export interface RemoteCurrencyTotal {
  currency: string;
  amountMinor: number;
  settledMinor: number;
  estimatedMinor: number;
  failedMinor: number;
}

export interface RemoteExchangeRateSnapshot {
  status: "idle" | "loading" | "fresh" | "error";
  baseCurrency: "USD";
  quoteCurrency: "CNY";
  rate: number | null;
  fetchedAt: string | null;
  source: string | null;
  error: string | null;
}

export interface RemoteBalanceSnapshot {
  status: BalanceStatus;
  currency: string | null;
  totalMicroCny: number | null;
  grantedMicroCny: number | null;
  toppedUpMicroCny: number | null;
  refreshedAt: string | null;
}

export interface RemoteProviderBalanceSnapshot extends RemoteBalanceSnapshot {
  provider: string;
  providerName: string;
  supported: boolean;
}

export interface RemoteSummarySnapshot {
  status: {
    code: MeterStatusCode;
  };
  provider: string;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
  currentRequestMicroCny: number;
  sessionTotalMicroCny: number;
  settledTotalMicroCny: number;
  estimatedTotalMicroCny: number;
  localTotalMicroCny: number;
  pricingZone: PricingZone;
  currencyTotals?: RemoteCurrencyTotal[];
  cnyEquivalentMicroCny?: number | null;
  currency?: string;
  currentRequestMinor?: number;
  sessionTotalMinor?: number;
}

export interface RemoteSessionSummary {
  id: string;
  title: string;
  provider: string;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
  status: MeterStatusCode;
  currentRequestMicroCny: number;
  sessionTotalMicroCny: number;
  unknownCount: number;
  lastActivityAt: string;
  currencyTotals?: RemoteCurrencyTotal[];
  currency?: string;
  currentRequestMinor?: number;
  sessionTotalMinor?: number;
  cnyEquivalentMicroCny?: number | null;
}

export interface RemoteTokenBucket {
  label: string;
  tokens: number;
  amountMicroCny: number;
  unitPriceMicroCnyPerMillionTokens?: number | null | undefined;
  unitPriceMixed?: boolean | undefined;
  currency?: string | undefined;
  amountMinor?: number | undefined;
  unitPriceMinorPerMillionTokens?: number | null | undefined;
}

export interface RemoteContextBreakdown {
  systemTokens: number;
  toolsTokens: number;
  messageTokens: number;
}

export interface RemoteTurn {
  id: string;
  label: string;
  startedAt: string;
  completedAt: string | null;
  status: MeterStatusCode;
  pricingZone: PricingZone;
  cacheHitTokens: number;
  cacheMissTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  amountMicroCny: number;
  note: string | null;
  currency?: string | undefined;
  amountMinor?: number | undefined;
}

export interface RemoteSessionStage {
  id: string;
  index: number;
  isCurrent: boolean;
  startedAt: string;
  completedAt: string | null;
  lastActivityAt: string;
  status: MeterStatusCode;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
  pricingZone: PricingZone;
  priceVersion: string;
  exchangeRateLabel?: string | null | undefined;
  currentRequestMicroCny: number;
  totalMicroCny: number;
  settledTotalMicroCny: number;
  estimatedTotalMicroCny: number;
  unknownCount: number;
  tokenBuckets: RemoteTokenBucket[];
  turns: RemoteTurn[];
  contextBreakdown: RemoteContextBreakdown | null;
  currency?: string | undefined;
  currentRequestMinor?: number | undefined;
  totalMinor?: number | undefined;
  settledTotalMinor?: number | undefined;
  estimatedTotalMinor?: number | undefined;
}

export interface RemoteSessionDetail {
  id: string;
  title: string;
  provider: string;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
  status: MeterStatusCode;
  pricingZone: PricingZone;
  currentRequestMicroCny: number;
  sessionTotalMicroCny: number;
  settledTotalMicroCny: number;
  estimatedTotalMicroCny: number;
  unknownCount: number;
  tokenBuckets: RemoteTokenBucket[];
  contextBreakdown: RemoteContextBreakdown | null;
  turns: RemoteTurn[];
  stages: RemoteSessionStage[];
  currencyTotals?: RemoteCurrencyTotal[];
  cnyEquivalentMicroCny?: number | null;
}

export type RemoteLedgerExportFormat = "json" | "csv";

export interface RemoteLedgerSummary {
  requestCount: number;
  totalMicroCny: number;
  estimatedMicroCny: number;
  settledMicroCny: number;
  unknownMicroCny: number;
  failedMicroCny: number;
  unknownCount: number;
  estimatedCount: number;
  settledCount: number;
  failedCount: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  peakMicroCny: number;
  offpeakMicroCny: number;
  firstSeenAt: string;
  lastSeenAt: string;
  provider: string;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
}

export interface RemoteSessionCostTreeNode<Detail = RemoteSessionDetail> {
  id: string;
  title: string;
  parentSessionId?: string | undefined;
  childSessionIds: string[];
  depth: number;
  path: string[];
  summary: RemoteLedgerSummary;
  subtreeSummary: RemoteLedgerSummary;
  detail?: Detail | undefined;
  orphaned: boolean;
  cyclic: boolean;
}

export interface RemoteSessionCostTree<Detail = RemoteSessionDetail> {
  roots: RemoteSessionCostTreeNode<Detail>[];
  nodes: Record<string, RemoteSessionCostTreeNode<Detail>>;
  summary: RemoteLedgerSummary;
  anomalies: {
    missingParents: Array<{ sessionId: string; parentSessionId: string }>;
    cycles: string[][];
  };
}

export interface RemoteCostAnalyticsStatusCounts {
  estimated: number;
  settled: number;
  unknown: number;
  failed: number;
}

export interface RemoteCostAnalyticsTrendBucket {
  key: string;
  startAt: string;
  endAt: string;
  amountMicroCny: number;
  requestCount: number;
  statusCounts: RemoteCostAnalyticsStatusCounts;
  peakMicroCny: number;
  offpeakMicroCny: number;
  previousAmountMicroCny: number | null;
  deltaMicroCny: number | null;
  deltaRatio: number | null;
}

export interface RemoteCostAnalyticsTotal {
  totalMicroCny: number;
  requestCount: number;
  statusCounts: RemoteCostAnalyticsStatusCounts;
  peakMicroCny: number;
  offpeakMicroCny: number;
}

export interface RemoteCostAnalyticsSessionSummary extends RemoteCostAnalyticsTotal {
  sessionId: string;
}

export interface RemoteCostAnalyticsAnomaly {
  ruleId: string;
  severity: "info" | "warning";
  bucketKey: string;
  observedMicroCny?: number | undefined;
  baselineMicroCny?: number | undefined;
  observedCount?: number | undefined;
  baselineCount?: number | undefined;
  ratio?: number | undefined;
  threshold: number;
  explanation: string;
}

export interface RemoteCostAnalyticsReport {
  generatedAt: string;
  global: RemoteCostAnalyticsTotal;
  sessions: RemoteCostAnalyticsSessionSummary[];
  dailyTrend: RemoteCostAnalyticsTrendBucket[];
  hourlyTrend: RemoteCostAnalyticsTrendBucket[];
  anomalies: RemoteCostAnalyticsAnomaly[];
}

export type UsageOverviewRange = "today" | "7d" | "30d";
export type UsageOverviewCoverage = "complete" | "partial" | "unavailable";

export interface RemoteUsageOverviewQuery {
  range: UsageOverviewRange;
  timeZone?: string | undefined;
}

export interface RemoteUsageOverviewTotal {
  amountMicroCny: number;
  totalTokens: number;
  requestCount: number;
  pricedRequestCount: number;
  unknownRequestCount: number;
  coverage: UsageOverviewCoverage;
}

export interface RemoteUsageOverviewTrendBucket extends RemoteUsageOverviewTotal {
  key: string;
  startAt: string;
  endAt: string;
  models?: RemoteUsageOverviewModelSummary[] | undefined;
}

export interface RemoteUsageOverviewModelSummary extends RemoteUsageOverviewTotal {
  provider: string;
  model: string;
}

export interface RemoteUsageOverviewReport {
  range: UsageOverviewRange;
  timeZone: string;
  generatedAt: string;
  startAt: string;
  endAt: string;
  totals: RemoteUsageOverviewTotal;
  trend: RemoteUsageOverviewTrendBucket[];
  topModels: RemoteUsageOverviewModelSummary[];
}

export interface MyMeterRemoteSnapshot {
  connection: {
    status: ConnectionStatus;
    message: string | null;
  };
  currentSessionId: string | null;
  summary: RemoteSummarySnapshot;
  balance: RemoteBalanceSnapshot;
  balances: RemoteProviderBalanceSnapshot[];
  sessions: RemoteSessionSummary[];
  details: Record<string, RemoteSessionDetail>;
  exchangeRate?: RemoteExchangeRateSnapshot;
  ledgerGeneration?: number;
  /**
   * Monotonic counter bumped by the host whenever snapshot content actually
   * changes. Remote adapters compare it between polls to skip redundant
   * listener notifications; `undefined` means the host predates the field,
   * so adapters must keep notifying on every poll.
   */
  snapshotVersion?: number;
}

export interface MyMeterRemote {
  getSnapshot(): MyMeterRemoteSnapshot;
  subscribe(listener: (snapshot: MyMeterRemoteSnapshot) => void): () => void;
  /** On-demand full detail for one session; the polled snapshot embeds only the current session's. */
  getSessionDetail?(sessionId: string): Promise<RemoteSessionDetail | null>;
  refreshExchangeRate?(): Promise<RemoteExchangeRateSnapshot | void>;
  refreshBalance?(): Promise<RemoteBalanceSnapshot | void>;
  getSessionCostTree?(): Promise<RemoteSessionCostTree>;
  getCostAnalytics?(): Promise<RemoteCostAnalyticsReport>;
  getUsageOverview?(query: RemoteUsageOverviewQuery): Promise<RemoteUsageOverviewReport>;
  exportLedger?(format: RemoteLedgerExportFormat): Promise<string>;
}

export type SessionSort = "recent" | "amount" | "status";
export type StatusFilter = MeterStatusCode | "all";
export type ClientPanel = "compact" | "sessions" | "detail" | "settings" | "costTree" | "analytics";
export type AnalyticsRange = UsageOverviewRange;

export interface MyMeterStoreUiState {
  selectedSessionId: string | null;
  activePanel: ClientPanel;
  overlayVisible: boolean;
  searchQuery: string;
  sortBy: SessionSort;
  filterStatus: StatusFilter;
  analyticsRange: AnalyticsRange;
}

export interface MyMeterStoreState {
  remote: MyMeterRemoteSnapshot;
  settings: MyMeterSettings;
  ui: MyMeterStoreUiState;
  viewModel: MyMeterViewModel;
}

interface MyMeterAsyncState {
  sessionCostTree: AsyncResourceView<SessionCostTreeView>;
  costAnalytics: AsyncResourceView<CostAnalyticsView>;
  usageOverview: AsyncResourceView<UsageOverviewView>;
  ledgerExport: LedgerExportView;
}

interface SerializedLedgerExport {
  format: RemoteLedgerExportFormat;
  content: string;
}

export interface MyMeterStore {
  getState(): MyMeterStoreState;
  subscribe(listener: () => void): () => void;
  destroy(): void;
  selectSession(sessionId: string | null): void;
  /** Synchronize the floating meter with dsh's currently opened session. */
  syncCurrentSession(sessionId: string | null): void;
  setActivePanel(panel: ClientPanel): void;
  setSearchQuery(query: string): void;
  setSortBy(sortBy: SessionSort): void;
  setFilterStatus(status: StatusFilter): void;
  setAnalyticsRange(range: AnalyticsRange): void;
  setSettings(patch: Partial<MyMeterSettings>): void;
  resetSettings(): void;
  setReducedMotion(reducedMotion: boolean): void;
  setMuted(muted: boolean): void;
  setRefreshIntervalMs(refreshIntervalMs: number): void;
  setBudgetThresholdMicroCny(budgetThresholdMicroCny: number): void;
  setPinnedSessionId(sessionId: string | null): void;
  setOverlayPosition(position: { x: number; y: number }): void;
  setOverlayEnabled(enabled: boolean): void;
  /** @deprecated The overlay is receipt-only and can no longer be expanded. */
  setOverlayCollapsed(collapsed: boolean): void;
  setOverlayVisible(visible: boolean): void;
  refreshExchangeRate(): Promise<void>;
  refreshBalance(): Promise<void>;
  loadSessionCostTree(): Promise<void>;
  loadCostAnalytics(): Promise<void>;
  loadUsageOverview(range?: AnalyticsRange): Promise<void>;
  exportLedger(format: RemoteLedgerExportFormat): Promise<void>;
}

export const DEFAULT_STORAGE_KEY = "mymeter.settings";

const SETTINGS_CHANGE_EVENT = "mymeter:settings-change";

export const DEFAULT_SETTINGS: MyMeterSettings = {
  reducedMotion: false,
  muted: true,
  refreshIntervalMs: 30_000,
  budgetThresholdMicroCny: 50_000_000,
  pinnedSessionId: null,
  overlayPosition: { x: 24, y: 24 },
  overlayEnabled: true,
  // The overlay is receipt-only. Full details live in the Token计费 page.
  overlayCollapsed: true,
};

const STATUS_PRIORITY: Record<MeterStatusCode, number> = {
  idle: 10,
  settled: 20,
  billing: 30,
  unknown: 40,
  balance_expired: 50,
  balance_insufficient: 60,
  aborted: 70,
  failed: 80,
};

export function loadPersistedSettings(
  storage: StorageLike | null | undefined,
  key = DEFAULT_STORAGE_KEY,
): MyMeterSettings {
  if (!storage) {
    return { ...DEFAULT_SETTINGS, overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return { ...DEFAULT_SETTINGS, overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
    }
    const parsed = JSON.parse(raw) as Partial<MyMeterSettings>;
    // The floating window is anchored to the current conversation view on
    // every page load. Keep the field in the settings shape for compatibility,
    // but never restore a position from a previous page.
    return { ...normalizeSettings(parsed), overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
  } catch {
    return { ...DEFAULT_SETTINGS, overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
  }
}

export function savePersistedSettings(
  storage: StorageLike | null | undefined,
  settings: MyMeterSettings,
  key = DEFAULT_STORAGE_KEY,
): void {
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify({
    ...settings,
    overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition },
  }));
}

export function clearPersistedSettings(storage: StorageLike | null | undefined, key = DEFAULT_STORAGE_KEY): void {
  storage?.removeItem(key);
}

export function normalizeSettings(input: Partial<MyMeterSettings> | null | undefined): MyMeterSettings {
  const base = { ...DEFAULT_SETTINGS, overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
  if (!input) {
    return base;
  }

  const overlayPosition = isPosition(input.overlayPosition) ? input.overlayPosition : base.overlayPosition;
  const refreshIntervalMs =
    typeof input.refreshIntervalMs === "number" && input.refreshIntervalMs >= 5_000
      ? input.refreshIntervalMs
      : base.refreshIntervalMs;
  const budgetThresholdMicroCny =
    typeof input.budgetThresholdMicroCny === "number" && input.budgetThresholdMicroCny >= 0
      ? input.budgetThresholdMicroCny
      : base.budgetThresholdMicroCny;

  return {
    reducedMotion: typeof input.reducedMotion === "boolean" ? input.reducedMotion : base.reducedMotion,
    muted: typeof input.muted === "boolean" ? input.muted : base.muted,
    refreshIntervalMs,
    budgetThresholdMicroCny,
    pinnedSessionId:
      typeof input.pinnedSessionId === "string" || input.pinnedSessionId === null
        ? input.pinnedSessionId
        : base.pinnedSessionId,
    overlayPosition,
    overlayEnabled:
      typeof input.overlayEnabled === "boolean" ? input.overlayEnabled : base.overlayEnabled,
    // Migrate legacy expanded-overlay preferences to the receipt-only UI.
    overlayCollapsed: true,
  };
}

export function resolvePrimaryStatus(
  requestStatus: MeterStatusCode,
  balanceStatus: BalanceStatus,
  activeStatus: MeterStatusCode | null,
): MeterStatusCode {
  const candidates = [requestStatus];

  if (activeStatus) {
    candidates.push(activeStatus);
  }

  if (balanceStatus === "expired" || balanceStatus === "stale") {
    candidates.push("balance_expired");
  }

  if (balanceStatus === "insufficient") {
    candidates.push("balance_insufficient");
  }

  return candidates.sort((a, b) => statusPriority(b) - statusPriority(a))[0] ?? "idle";
}

export interface SnappedOverlayPosition {
  position: {
    x: number;
    y: number;
  };
  dockedEdge: "left" | "right" | "top" | "bottom" | null;
}

const RECEIPT_OVERLAY_SIZE = { width: 188, height: 280 };

export function snapOverlayPosition(
  position: { x: number; y: number },
  viewport = getViewportSize(),
  panelSize = RECEIPT_OVERLAY_SIZE,
  snapThreshold = 24,
): SnappedOverlayPosition {
  const safeX = Number.isFinite(position.x) ? position.x : DEFAULT_SETTINGS.overlayPosition.x;
  const safeY = Number.isFinite(position.y) ? position.y : DEFAULT_SETTINGS.overlayPosition.y;
  const clampedX = clamp(Math.round(safeX), 0, Math.max(0, viewport.width - panelSize.width));
  const clampedY = clamp(Math.round(safeY), 0, Math.max(0, viewport.height - panelSize.height));
  let x = clampedX;
  let y = clampedY;
  let dockedEdge: SnappedOverlayPosition["dockedEdge"] = null;

  if (x <= snapThreshold) {
    x = 0;
    dockedEdge = "left";
  } else if (viewport.width - (x + panelSize.width) <= snapThreshold) {
    x = Math.max(0, viewport.width - panelSize.width);
    dockedEdge = "right";
  } else if (y <= snapThreshold) {
    y = 0;
    dockedEdge = "top";
  } else if (viewport.height - (y + panelSize.height) <= snapThreshold) {
    y = Math.max(0, viewport.height - panelSize.height);
    dockedEdge = "bottom";
  }

  return { position: { x, y }, dockedEdge };
}

export function buildViewModel(
  snapshot: MyMeterRemoteSnapshot,
  settings: MyMeterSettings,
  ui: MyMeterStoreUiState,
  asyncState = createIdleAsyncState({ treeAvailable: false, analyticsAvailable: false, usageAvailable: false, exportAvailable: false }),
  fetchedDetails: ReadonlyMap<string, RemoteSessionDetail> = new Map(),
): MyMeterViewModel {
  const activeId = ui.selectedSessionId ?? settings.pinnedSessionId ?? snapshot.currentSessionId;
  const activeSession = activeId ? snapshot.sessions.find((session) => session.id === activeId) ?? null : null;
  // The polled snapshot embeds only the current session's detail. Explicitly
  // selected sessions are resolved through the on-demand detail cache.
  const rawDetail = (activeId
    ? snapshot.details[activeId] ?? fetchedDetails.get(activeId) ?? null
    : null);
  const detail = rawDetail ? mapDetail(rawDetail, settings) : null;
  const activeStatus = detail?.status ?? activeSession?.status ?? null;
  const provider = activeId
    ? detail?.provider ?? activeSession?.provider ?? "unknown"
    : snapshot.summary.provider;
  const balances = mapBalances(snapshot, provider);
  const balance = selectBalance(balances, provider)
    ?? mapBalance(snapshot.balance, provider, formatProviderName(provider), isDeepSeekProvider(provider));
  const primaryBalanceStatus = balances
    .filter((candidate) => candidate.supported)
    .map((candidate) => candidate.status)
    .sort((left, right) => balanceStatusPriority(right) - balanceStatusPriority(left))[0]
    ?? "unavailable";
  const statusCode = resolvePrimaryStatus(
    snapshot.summary.status.code,
    primaryBalanceStatus,
    activeStatus,
  );
  const currentRequest =
    detail?.currentRequest ??
    createRequestAmountView(snapshot.summary.currentRequestMicroCny, snapshot.summary.status.code);
  const sessionTotal = detail?.sessionTotal ?? createAmountView(snapshot.summary.sessionTotalMicroCny);
  const settledTotal = detail?.settledTotal ?? createAmountView(snapshot.summary.settledTotalMicroCny);
  const estimatedTotal =
    detail?.estimatedTotal ??
    createRequestAmountView(snapshot.summary.estimatedTotalMicroCny, snapshot.summary.status.code);
  const pricingZone = detail?.pricingZone ?? snapshot.summary.pricingZone;
  const scopeLabel = activeId
    ? `${activeSession?.title ?? rawDetail?.title ?? "会话"} (${activeId})`
    : "全部会话";
  const snapped = snapOverlayPosition(settings.overlayPosition);
  const sessions = snapshot.sessions.map((session): SessionSummaryView => {
    return {
      id: session.id,
      title: session.title,
      provider: session.provider,
      model: session.model,
      reasoningEffort: session.reasoningEffort,
      agentPreset: session.agentPreset,
      status: session.status,
      currentRequest: session.currentRequestMinor !== undefined
        ? createAmountView(session.currentRequestMinor, 3, session.currency ?? "CNY")
        : createRequestAmountView(session.currentRequestMicroCny, session.status),
      sessionTotal: session.sessionTotalMinor !== undefined
        ? createAmountView(session.sessionTotalMinor, 3, session.currency ?? "CNY")
        : session.cnyEquivalentMicroCny !== null && session.cnyEquivalentMicroCny !== undefined
          ? createAmountView(session.cnyEquivalentMicroCny)
          : createAmountView(session.sessionTotalMicroCny),
      unknownCount: session.unknownCount,
      lastActivityAt: session.lastActivityAt,
      isPinned: settings.pinnedSessionId === session.id,
      isActive: activeId === session.id,
    };
  });
  const statusLabel = formatStatusLabel(statusCode);
  const hasGlobalMixedCurrency = (snapshot.summary.currencyTotals?.length ?? 0) > 1;
  const globalBudgetSpent = snapshot.summary.currencyTotals?.length === 1 && snapshot.summary.sessionTotalMinor !== undefined
    ? createAmountView(snapshot.summary.sessionTotalMinor, 3, snapshot.summary.currency ?? "CNY")
    : snapshot.summary.currencyTotals && snapshot.summary.currencyTotals.length > 1 && snapshot.summary.cnyEquivalentMicroCny !== null && snapshot.summary.cnyEquivalentMicroCny !== undefined
      ? createAmountView(snapshot.summary.cnyEquivalentMicroCny)
      : createAmountView(snapshot.summary.localTotalMicroCny);
  const insights = deriveBillingInsights({
    spent: globalBudgetSpent,
    budgetThresholdMicroCny: settings.budgetThresholdMicroCny,
    budgetAvailable: !hasGlobalMixedCurrency && (globalBudgetSpent.currency ?? "CNY") === "CNY",
    pricingZone,
    scopeLabel: "本地累计",
  });

  return {
    appName: "Token计费",
    scope: {
      kind: activeId ? "session" : "global",
      label: scopeLabel,
      sessionId: activeId,
    },
    status: {
      code: statusCode,
      label: statusLabel,
      tone: formatTone(statusCode),
    },
    headline: statusLabel,
    subheadline: `${snapshot.summary.model} · ${snapshot.summary.reasoningEffort} · ${snapshot.summary.agentPreset}`,
    provider,
    model: detail?.model ?? activeSession?.model ?? snapshot.summary.model,
    reasoningEffort: detail?.reasoningEffort ?? activeSession?.reasoningEffort ?? snapshot.summary.reasoningEffort,
    agentPreset: detail?.agentPreset ?? activeSession?.agentPreset ?? snapshot.summary.agentPreset,
    pricingZone,
    pricingZoneLabel: formatPricingZone(pricingZone),
    currentRequest,
    sessionTotal,
    settledTotal,
    estimatedTotal,
    currencyTotals: detail?.currencyTotals ?? (snapshot.summary.currencyTotals ? mapCurrencyTotals(snapshot.summary.currencyTotals) : []),
    cnyEquivalent: detail?.cnyEquivalent ?? (snapshot.summary.cnyEquivalentMicroCny === undefined
      ? null
      : snapshot.summary.cnyEquivalentMicroCny === null
        ? null
        : createAmountView(snapshot.summary.cnyEquivalentMicroCny)),
    exchangeRate: snapshot.exchangeRate
      ? {
        status: snapshot.exchangeRate.status,
        rate: snapshot.exchangeRate.rate,
        fetchedAt: snapshot.exchangeRate.fetchedAt,
        source: snapshot.exchangeRate.source,
        error: snapshot.exchangeRate.error,
      }
      : { status: "idle", rate: null, fetchedAt: null, source: null, error: null },
    localTotal: snapshot.summary.currencyTotals?.length === 1 && snapshot.summary.sessionTotalMinor !== undefined
      ? createAmountView(snapshot.summary.sessionTotalMinor, 3, snapshot.summary.currency ?? "CNY")
      : snapshot.summary.currencyTotals && snapshot.summary.currencyTotals.length > 1 && snapshot.summary.cnyEquivalentMicroCny !== null && snapshot.summary.cnyEquivalentMicroCny !== undefined
        ? createAmountView(snapshot.summary.cnyEquivalentMicroCny)
        : createAmountView(snapshot.summary.localTotalMicroCny),
    balance,
    balances,
    sessions,
    detail,
    overlay: {
      collapsed: true,
      pinnedSessionId: settings.pinnedSessionId,
      position: snapped.position,
      dockedEdge: snapped.dockedEdge,
      narrow: true,
    },
    settings,
    insights,
    sessionCostTree: asyncState.sessionCostTree,
    costAnalytics: asyncState.costAnalytics,
    usageOverview: asyncState.usageOverview,
    ledgerExport: asyncState.ledgerExport,
    alerts: createAlerts(snapshot, statusCode, balances, insights.budget.message),
  };
}

export function createMyMeterStore(options: {
  remote?: MyMeterRemote;
  storage?: StorageLike | null;
  storageKey?: string;
} = {}): MyMeterStore {
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const remote = options.remote ?? createStaticRemote(createEmptySnapshot());
  const settingsSource = {};
  let remoteSnapshot = remote.getSnapshot();
  let settings = loadPersistedSettings(storage, storageKey);
  let asyncState = createIdleAsyncState({
    treeAvailable: Boolean(remote.getSessionCostTree),
    analyticsAvailable: Boolean(remote.getCostAnalytics),
    usageAvailable: Boolean(remote.getUsageOverview),
    exportAvailable: Boolean(remote.exportLedger),
  });
  let sessionCostTreeRequestId = 0;
  let costAnalyticsRequestId = 0;
  let usageOverviewRequestId = 0;
  const usageOverviewCache = new Map<AnalyticsRange, { dayKey: string; data: UsageOverviewView }>();
  let ledgerExportRequestId = 0;
  let ui: MyMeterStoreUiState = {
    selectedSessionId: settings.pinnedSessionId,
    activePanel: "compact",
    overlayVisible: true,
    searchQuery: "",
    sortBy: "recent",
    filterStatus: "all",
    analyticsRange: "today",
  };
  // `selectedSessionId` is also used for the dsh-following mode. Keep the
  // last host value separately so an explicit MyMeter session selection is
  // not overwritten by the next render of the global shell slot.
  let lastSyncedSessionId = remoteSnapshot.currentSessionId;
  let lastLedgerGeneration = remoteSnapshot.ledgerGeneration;
  let lastOverviewDayKey = usageOverviewDayKey();
  let usageOverviewRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let state = recompute(remoteSnapshot, settings, ui, asyncState);
  const listeners = new Set<() => void>();

  const persistAndEmit = (nextSettings = settings): void => {
    settings = normalizeSettings(nextSettings);
    state = recompute(remoteSnapshot, settings, ui, asyncState);
    emit();
    try {
      savePersistedSettings(storage, settings, storageKey);
    } catch {
      // Browser privacy modes and quota limits must not block live UI updates.
    }
    publishSettingsChange(storage, storageKey, settings, settingsSource);
  };

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  // On-demand detail cache. The polled snapshot embeds only the current
  // session's detail; explicitly selected (or pinned) sessions are fetched
  // once per ledger generation through `getSessionDetail`.
  const fetchedDetails = new Map<string, RemoteSessionDetail>();
  let fetchedDetailsGeneration = remoteSnapshot.ledgerGeneration;
  let detailRequestId = 0;
  let inFlightDetailSessionId: string | null = null;
  let disposed = false;

  const resolveDesiredDetailId = (): string | null => {
    return ui.selectedSessionId ?? settings.pinnedSessionId ?? remoteSnapshot.currentSessionId;
  };

  const ensureActiveDetailLoaded = (): void => {
    const sessionId = resolveDesiredDetailId();
    if (!sessionId || !remote.getSessionDetail) return;
    // The current session's detail rides the polled snapshot; no RPC needed.
    if (remoteSnapshot.details[sessionId] !== undefined) return;
    if (inFlightDetailSessionId === sessionId && fetchedDetailsGeneration === remoteSnapshot.ledgerGeneration) return;
    if (fetchedDetails.has(sessionId) && fetchedDetailsGeneration === remoteSnapshot.ledgerGeneration) return;

    const requestId = ++detailRequestId;
    inFlightDetailSessionId = sessionId;
    void remote.getSessionDetail(sessionId).then((detail) => {
      inFlightDetailSessionId = null;
      if (disposed || requestId !== detailRequestId) return;
      if (!detail) return;
      if (fetchedDetailsGeneration !== remoteSnapshot.ledgerGeneration) return;
      fetchedDetails.set(sessionId, detail);
      state = recompute(remoteSnapshot, settings, ui, asyncState, fetchedDetails);
      emit();
    }).catch(() => {
      inFlightDetailSessionId = null;
    });
  };

  const unsubscribeRemote = remote.subscribe((snapshot) => {
    const ledgerChanged = snapshot.ledgerGeneration !== undefined
      && snapshot.ledgerGeneration !== lastLedgerGeneration;
    const currentOverviewDayKey = usageOverviewDayKey();
    const dayChanged = currentOverviewDayKey !== lastOverviewDayKey;
    lastOverviewDayKey = currentOverviewDayKey;
    lastLedgerGeneration = snapshot.ledgerGeneration;
    remoteSnapshot = snapshot;
    if (ledgerChanged && snapshot.ledgerGeneration !== fetchedDetailsGeneration) {
      fetchedDetails.clear();
      fetchedDetailsGeneration = snapshot.ledgerGeneration;
    }
    state = recompute(remoteSnapshot, settings, ui, asyncState, fetchedDetails);
    emit();
    ensureActiveDetailLoaded();
    if ((ledgerChanged || dayChanged) && remote.getUsageOverview && asyncState.usageOverview.data) {
      usageOverviewCache.clear();
      if (usageOverviewRefreshTimer === null) {
        usageOverviewRefreshTimer = setTimeout(() => {
          usageOverviewRefreshTimer = null;
          void store.loadUsageOverview(ui.analyticsRange);
        }, 500);
      }
    }
  });
  const unsubscribeSettings = subscribeToSettingsChanges(
    storage,
    storageKey,
    settingsSource,
    (nextSettings) => {
      // Position is local to this page instance. A settings update from a
      // sibling store must not move an already-anchored floating window.
      settings = {
        ...normalizeSettings(nextSettings),
        overlayPosition: { ...settings.overlayPosition },
      };
      state = recompute(remoteSnapshot, settings, ui, asyncState);
      emit();
    },
  );

  const setUi = (patch: Partial<MyMeterStoreUiState>): void => {
    ui = { ...ui, ...patch };
    state = recompute(remoteSnapshot, settings, ui, asyncState);
    emit();
  };

  const setAsyncState = (patch: Partial<MyMeterAsyncState>): void => {
    asyncState = { ...asyncState, ...patch };
    state = recompute(remoteSnapshot, settings, ui, asyncState);
    emit();
  };

  const store: MyMeterStore = {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      disposed = true;
      unsubscribeRemote();
      unsubscribeSettings();
      if (usageOverviewRefreshTimer !== null) clearTimeout(usageOverviewRefreshTimer);
      usageOverviewRefreshTimer = null;
      listeners.clear();
    },
    selectSession(sessionId) {
      setUi({ selectedSessionId: sessionId, activePanel: sessionId ? "detail" : "sessions" });
      ensureActiveDetailLoaded();
    },
    syncCurrentSession(sessionId) {
      if (settings.pinnedSessionId !== null) {
        lastSyncedSessionId = sessionId;
        return;
      }
      const hasExplicitSelection =
        ui.selectedSessionId !== null && ui.selectedSessionId !== lastSyncedSessionId;
      if (hasExplicitSelection || ui.selectedSessionId === sessionId) {
        lastSyncedSessionId = sessionId;
        return;
      }
      lastSyncedSessionId = sessionId;
      setUi({ selectedSessionId: sessionId });
    },
    setActivePanel(panel) {
      setUi({ activePanel: panel });
    },
    setSearchQuery(query) {
      setUi({ searchQuery: query });
    },
    setSortBy(sortBy) {
      setUi({ sortBy });
    },
    setFilterStatus(status) {
      setUi({ filterStatus: status });
    },
    setAnalyticsRange(range) {
      setUi({ analyticsRange: range });
      void store.loadUsageOverview(range);
    },
    setSettings(patch) {
      persistAndEmit({ ...settings, ...patch });
    },
    resetSettings() {
      settings = { ...DEFAULT_SETTINGS, overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
      ui = { ...ui, selectedSessionId: null };
      state = recompute(remoteSnapshot, settings, ui, asyncState);
      emit();
      try {
        clearPersistedSettings(storage, storageKey);
      } catch {
        // Keep the reset effective for this page even when persistence is unavailable.
      }
      publishSettingsChange(storage, storageKey, settings, settingsSource);
    },
    setReducedMotion(reducedMotion) {
      persistAndEmit({ ...settings, reducedMotion });
    },
    setMuted(muted) {
      persistAndEmit({ ...settings, muted });
    },
    setRefreshIntervalMs(refreshIntervalMs) {
      persistAndEmit({ ...settings, refreshIntervalMs });
    },
    setBudgetThresholdMicroCny(budgetThresholdMicroCny) {
      persistAndEmit({ ...settings, budgetThresholdMicroCny });
    },
    setPinnedSessionId(sessionId) {
      persistAndEmit({ ...settings, pinnedSessionId: sessionId });
      setUi({ selectedSessionId: sessionId });
    },
    setOverlayPosition(position) {
      const snapped = snapOverlayPosition(position);
      // Dragging is intentionally ephemeral. Refreshing the page restores the
      // anchor computed from the current conversation/trajectory display area.
      settings = normalizeSettings({ ...settings, overlayPosition: snapped.position });
      state = recompute(remoteSnapshot, settings, ui, asyncState);
      emit();
    },
    setOverlayEnabled(enabled) {
      persistAndEmit({ ...settings, overlayEnabled: enabled });
    },
    setOverlayCollapsed(_collapsed) {
      // Kept as a compatibility no-op for callers built against older clients.
    },
    setOverlayVisible(visible) {
      setUi({ overlayVisible: visible });
    },
    async refreshExchangeRate() {
      if (!remote.refreshExchangeRate) return;
      await remote.refreshExchangeRate();
    },
    async refreshBalance() {
      if (!remote.refreshBalance) return;
      await remote.refreshBalance();
    },
    async loadSessionCostTree() {
      if (!remote.getSessionCostTree) return;
      const requestId = ++sessionCostTreeRequestId;
      setAsyncState({ sessionCostTree: { ...asyncState.sessionCostTree, status: "loading", error: null } });
      try {
        const tree = await remote.getSessionCostTree();
        if (requestId !== sessionCostTreeRequestId) return;
        setAsyncState({ sessionCostTree: { status: "ready", data: mapSessionCostTree(tree), error: null } });
      } catch (error) {
        if (requestId !== sessionCostTreeRequestId) return;
        setAsyncState({ sessionCostTree: { status: "error", data: asyncState.sessionCostTree.data, error: errorMessage(error) } });
      }
    },
    async loadCostAnalytics() {
      if (!remote.getCostAnalytics) return;
      const requestId = ++costAnalyticsRequestId;
      setAsyncState({ costAnalytics: { ...asyncState.costAnalytics, status: "loading", error: null } });
      try {
        const report = await remote.getCostAnalytics();
        if (requestId !== costAnalyticsRequestId) return;
        setAsyncState({ costAnalytics: { status: "ready", data: mapCostAnalytics(report), error: null } });
      } catch (error) {
        if (requestId !== costAnalyticsRequestId) return;
        setAsyncState({ costAnalytics: { status: "error", data: asyncState.costAnalytics.data, error: errorMessage(error) } });
      }
    },
    async loadUsageOverview(range = ui.analyticsRange) {
      if (!remote.getUsageOverview) return;
      const currentRange = range;
      const cached = usageOverviewCache.get(currentRange);
      if (cached?.dayKey === usageOverviewDayKey()) {
        setAsyncState({ usageOverview: { status: "ready", data: cached.data, error: null } });
        return;
      }
      if (cached) {
        usageOverviewCache.delete(currentRange);
      }
      const requestId = ++usageOverviewRequestId;
      const previousData = asyncState.usageOverview.data?.range === currentRange
        ? asyncState.usageOverview.data
        : null;
      setAsyncState({ usageOverview: { status: "loading", data: previousData, error: null } });
      try {
        const report = await remote.getUsageOverview({ range: currentRange });
        if (requestId !== usageOverviewRequestId || ui.analyticsRange !== currentRange) return;
        const mapped = mapUsageOverview(report);
        usageOverviewCache.set(currentRange, { dayKey: usageOverviewDayKey(mapped.timeZone), data: mapped });
        setAsyncState({ usageOverview: { status: "ready", data: mapped, error: null } });
      } catch (error) {
        if (requestId !== usageOverviewRequestId || ui.analyticsRange !== currentRange) return;
        setAsyncState({ usageOverview: { status: "error", data: previousData, error: errorMessage(error) } });
      }
    },
    async exportLedger(format) {
      if (!remote.exportLedger) return;
      const requestId = ++ledgerExportRequestId;
      setAsyncState({ ledgerExport: { ...asyncState.ledgerExport, status: "loading", format, error: null } });
      try {
        const content = await remote.exportLedger(format);
        if (requestId !== ledgerExportRequestId) return;
        downloadLedgerExport({ format, content });
        setAsyncState({
          ledgerExport: {
            status: "ready",
            format,
            error: null,
            lastDownloadedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        if (requestId !== ledgerExportRequestId) return;
        setAsyncState({ ledgerExport: { ...asyncState.ledgerExport, status: "error", format, error: errorMessage(error) } });
      }
    },
  };

  return store;
}

interface SettingsChangeDetail {
  storage: StorageLike;
  storageKey: string;
  settings: MyMeterSettings;
  source: object;
}

function publishSettingsChange(
  storage: StorageLike | null,
  storageKey: string,
  settings: MyMeterSettings,
  source: object,
): void {
  if (!storage || typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<SettingsChangeDetail>(SETTINGS_CHANGE_EVENT, {
    detail: { storage, storageKey, settings, source },
  }));
}

function subscribeToSettingsChanges(
  storage: StorageLike | null,
  storageKey: string,
  source: object,
  listener: (settings: MyMeterSettings) => void,
): () => void {
  if (!storage || typeof window === "undefined") {
    return () => {};
  }

  const handleSettingsChange = (event: Event): void => {
    const detail = (event as CustomEvent<SettingsChangeDetail>).detail;
    if (detail?.storage !== storage || detail.storageKey !== storageKey || detail.source === source) {
      return;
    }
    listener(detail.settings);
  };
  const handleStorage = (event: StorageEvent): void => {
    if (event.key !== storageKey || event.storageArea !== storage) {
      return;
    }
    listener(loadPersistedSettings(storage, storageKey));
  };

  window.addEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function recompute(
  remote: MyMeterRemoteSnapshot,
  settings: MyMeterSettings,
  ui: MyMeterStoreUiState,
  asyncState: MyMeterAsyncState,
  fetchedDetails: ReadonlyMap<string, RemoteSessionDetail> = new Map(),
): MyMeterStoreState {
  return {
    remote,
    settings,
    ui,
    viewModel: buildViewModel(remote, settings, ui, asyncState, fetchedDetails),
  };
}

function mapDetail(detail: RemoteSessionDetail, settings: MyMeterSettings): SessionDetailView {
  const tokenBuckets = mapTokenBuckets(detail.tokenBuckets);
  const turns = mapTurns(detail.turns);
  const stages = detail.stages.map(mapStage);
  const currencyTotals = detail.currencyTotals ? mapCurrencyTotals(detail.currencyTotals) : [];
  const singleCurrency = currencyTotals.length === 1 ? currencyTotals[0]! : null;
  const settledTotal = singleCurrency?.settled ?? createAmountView(detail.settledTotalMicroCny);
  const estimatedTotal = singleCurrency?.estimated ?? createRequestAmountView(detail.estimatedTotalMicroCny, detail.status);
  const sessionTotal = singleCurrency?.amount ?? (detail.cnyEquivalentMicroCny !== null && detail.cnyEquivalentMicroCny !== undefined
    ? createAmountView(detail.cnyEquivalentMicroCny)
    : createAmountView(detail.sessionTotalMicroCny));

  return {
    id: detail.id,
    title: detail.title,
    provider: detail.provider,
    model: detail.model,
    reasoningEffort: detail.reasoningEffort,
    agentPreset: detail.agentPreset,
    status: detail.status,
    pricingZone: detail.pricingZone,
    pricingZoneLabel: formatPricingZone(detail.pricingZone),
    currentRequest: createRequestAmountView(detail.currentRequestMicroCny, detail.status),
    sessionTotal,
    settledTotal,
    estimatedTotal,
    unknownCount: detail.unknownCount,
    tokenBuckets,
    contextBreakdown: mapContextBreakdown(detail.contextBreakdown),
    turns,
    stages,
    insights: deriveBillingInsights({
      tokenBuckets,
      spent: createAmountView(detail.settledTotalMicroCny + detail.estimatedTotalMicroCny),
      budgetThresholdMicroCny: settings.budgetThresholdMicroCny,
      budgetAvailable: currencyTotals.length <= 1 && (!singleCurrency || singleCurrency.currency === "CNY"),
      pricingZone: detail.pricingZone,
      scopeLabel: "会话费用",
    }),
    timeline: turns.map((turn) => ({
      label: turn.label,
      at: turn.completedAt ?? turn.startedAt,
      status: turn.status,
      amount: turn.amount,
    })),
    currencyTotals,
    cnyEquivalent: detail.cnyEquivalentMicroCny === undefined || detail.cnyEquivalentMicroCny === null
      ? null
      : createAmountView(detail.cnyEquivalentMicroCny),
  };
}

function mapStage(stage: RemoteSessionStage): SessionDetailView["stages"][number] {
  return {
    id: stage.id,
    index: stage.index,
    isCurrent: stage.isCurrent,
    startedAt: stage.startedAt,
    completedAt: stage.completedAt,
    lastActivityAt: stage.lastActivityAt,
    status: stage.status,
    model: stage.model,
    reasoningEffort: stage.reasoningEffort,
    agentPreset: stage.agentPreset,
    pricingZone: stage.pricingZone,
    pricingZoneLabel: formatPricingZone(stage.pricingZone),
    priceVersion: stage.priceVersion,
    exchangeRateLabel: stage.exchangeRateLabel ?? null,
    currentRequest: createAmountView(stage.currentRequestMinor ?? stage.currentRequestMicroCny, 3, stage.currency ?? "CNY"),
    sessionTotal: createAmountView(stage.totalMinor ?? stage.totalMicroCny, 3, stage.currency ?? "CNY"),
    settledTotal: createAmountView(stage.settledTotalMinor ?? stage.settledTotalMicroCny, 3, stage.currency ?? "CNY"),
    estimatedTotal: createAmountView(stage.estimatedTotalMinor ?? stage.estimatedTotalMicroCny, 3, stage.currency ?? "CNY"),
    unknownCount: stage.unknownCount,
    tokenBuckets: mapTokenBuckets(stage.tokenBuckets),
    turns: mapTurns(stage.turns),
    contextBreakdown: mapContextBreakdown(stage.contextBreakdown),
    ...(stage.currency ? { currency: stage.currency } : {}),
  };
}

function mapTokenBuckets(buckets: RemoteTokenBucket[]): TokenBucketView[] {
  return buckets.map((bucket): TokenBucketView => {
    return {
      label: bucket.label,
      tokens: bucket.tokens,
      amount: createAmountView(bucket.amountMinor ?? bucket.amountMicroCny, 3, bucket.currency ?? "CNY"),
      unitPrice: typeof (bucket.unitPriceMinorPerMillionTokens ?? bucket.unitPriceMicroCnyPerMillionTokens) === "number"
        ? createAmountView(bucket.unitPriceMinorPerMillionTokens ?? bucket.unitPriceMicroCnyPerMillionTokens!, 3, bucket.currency ?? "CNY")
        : null,
      unitPriceMixed: bucket.unitPriceMixed === true,
    };
  });
}

function mapTurns(turns: RemoteTurn[]): SessionTurnView[] {
  return turns.map((turn): SessionTurnView => {
    return {
      id: turn.id,
      label: turn.label,
      startedAt: turn.startedAt,
      completedAt: turn.completedAt,
      status: turn.status,
      pricingZone: turn.pricingZone,
      cacheHitTokens: turn.cacheHitTokens,
      cacheMissTokens: turn.cacheMissTokens,
      outputTokens: turn.outputTokens,
      reasoningTokens: turn.reasoningTokens,
      amount: createAmountView(turn.amountMinor ?? turn.amountMicroCny, 3, turn.currency ?? "CNY"),
      note: turn.note,
    };
  });
}

function mapCurrencyTotals(totals: RemoteCurrencyTotal[]): NonNullable<SessionDetailView["currencyTotals"]> {
  return totals.map((total) => ({
    currency: total.currency,
    amount: createAmountView(total.amountMinor, 3, total.currency),
    settled: createAmountView(total.settledMinor, 3, total.currency),
    estimated: createAmountView(total.estimatedMinor, 3, total.currency),
    failed: createAmountView(total.failedMinor, 3, total.currency),
  }));
}

function mapContextBreakdown(contextBreakdown: RemoteContextBreakdown | null): SessionDetailView["contextBreakdown"] {
  return contextBreakdown
    ? {
      systemTokens: contextBreakdown.systemTokens,
      toolsTokens: contextBreakdown.toolsTokens,
      messageTokens: contextBreakdown.messageTokens,
    }
    : null;
}

function createIdleAsyncState(input: {
  treeAvailable: boolean;
  analyticsAvailable: boolean;
  usageAvailable: boolean;
  exportAvailable: boolean;
}): MyMeterAsyncState {
  return {
    sessionCostTree: {
      status: input.treeAvailable ? "idle" : "unavailable",
      data: null,
      error: null,
    },
    costAnalytics: {
      status: input.analyticsAvailable ? "idle" : "unavailable",
      data: null,
      error: null,
    },
    usageOverview: {
      status: input.usageAvailable ? "idle" : "unavailable",
      data: null,
      error: null,
    },
    ledgerExport: {
      status: input.exportAvailable ? "idle" : "unavailable",
      format: null,
      error: null,
      lastDownloadedAt: null,
    },
  };
}

function mapSessionCostTree(tree: RemoteSessionCostTree): SessionCostTreeView {
  return {
    total: createAmountView(tree.summary.totalMicroCny),
    requestCount: tree.summary.requestCount,
    roots: tree.roots.map((node) => mapSessionCostTreeNode(node, tree.nodes)),
    anomalyLabels: [
      ...tree.anomalies.missingParents.map((item) => `${item.sessionId} 缺少父会话 ${item.parentSessionId}`),
      ...tree.anomalies.cycles.map((cycle) => `循环关系 ${cycle.join(" -> ")}`),
    ],
  };
}

function mapSessionCostTreeNode(
  node: RemoteSessionCostTreeNode,
  nodes: Record<string, RemoteSessionCostTreeNode>,
): SessionCostTreeNodeView {
  const anomalyLabels = [
    ...(node.orphaned ? ["父会话缺失"] : []),
    ...(node.cyclic ? ["循环断开"] : []),
  ];
  return {
    id: node.id,
    title: node.title,
    depth: node.depth,
    total: createAmountView(node.summary.totalMicroCny),
    subtreeTotal: createAmountView(node.subtreeSummary.totalMicroCny),
    requestCount: node.summary.requestCount,
    childCount: node.childSessionIds.length,
    anomalyLabels,
    children: node.childSessionIds
      .map((childId) => nodes[childId])
      .filter((child): child is RemoteSessionCostTreeNode => Boolean(child))
      .map((child) => mapSessionCostTreeNode(child, nodes)),
  };
}

function mapCostAnalytics(report: RemoteCostAnalyticsReport): CostAnalyticsView {
  return {
    generatedAt: report.generatedAt,
    total: createAmountView(report.global.totalMicroCny),
    requestCount: report.global.requestCount,
    dailyTrend: report.dailyTrend.map(mapTrendBucket),
    hourlyTrend: report.hourlyTrend.map(mapTrendBucket),
    anomalies: report.anomalies.map((anomaly) => ({
      ruleId: anomaly.ruleId,
      severity: anomaly.severity,
      bucketKey: anomaly.bucketKey,
      explanation: anomaly.explanation,
    })),
  };
}

function mapUsageOverview(report: RemoteUsageOverviewReport): UsageOverviewView {
  return {
    range: report.range,
    timeZone: report.timeZone,
    generatedAt: report.generatedAt,
    total: createAmountView(report.totals.amountMicroCny),
    totalTokens: report.totals.totalTokens,
    requestCount: report.totals.requestCount,
    pricedRequestCount: report.totals.pricedRequestCount,
    unknownRequestCount: report.totals.unknownRequestCount,
    coverage: report.totals.coverage,
    trend: report.trend.map((bucket) => ({
      key: bucket.key,
      startAt: bucket.startAt,
      endAt: bucket.endAt,
      amount: createAmountView(bucket.amountMicroCny),
      totalTokens: bucket.totalTokens,
      requestCount: bucket.requestCount,
      coverage: bucket.coverage,
      models: (bucket.models ?? []).map((model) => ({
        provider: model.provider,
        model: model.model,
        amount: createAmountView(model.amountMicroCny),
        totalTokens: model.totalTokens,
        requestCount: model.requestCount,
        pricedRequestCount: model.pricedRequestCount,
        unknownRequestCount: model.unknownRequestCount,
        coverage: model.coverage,
      })),
    })),
    topModels: report.topModels.map((model) => ({
      provider: model.provider,
      model: model.model,
      amount: createAmountView(model.amountMicroCny),
      totalTokens: model.totalTokens,
      requestCount: model.requestCount,
      pricedRequestCount: model.pricedRequestCount,
      unknownRequestCount: model.unknownRequestCount,
      coverage: model.coverage,
    })),
  };
}

function usageOverviewDayKey(timeZone = "Asia/Shanghai", value = Date.now()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Date(value).toISOString().slice(0, 10);
  }
}

function mapTrendBucket(bucket: RemoteCostAnalyticsTrendBucket): CostTrendBucketView {
  return {
    key: bucket.key,
    amount: createAmountView(bucket.amountMicroCny),
    previousAmount: bucket.previousAmountMicroCny === null ? null : createAmountView(bucket.previousAmountMicroCny),
    deltaLabel: formatDelta(bucket.deltaMicroCny, bucket.deltaRatio),
    requestCount: bucket.requestCount,
    statusLabel: `结算 ${bucket.statusCounts.settled} · 估算 ${bucket.statusCounts.estimated} · 未知 ${bucket.statusCounts.unknown} · 失败 ${bucket.statusCounts.failed}`,
  };
}

function formatDelta(deltaMicroCny: number | null, deltaRatio: number | null): string {
  if (deltaMicroCny === null || deltaRatio === null) return "无前值";
  const amount = createAmountView(Math.abs(deltaMicroCny)).label;
  const percent = `${Math.round(Math.abs(deltaRatio - 1) * 100)}%`;
  if (deltaMicroCny > 0) return `+${amount} / +${percent}`;
  if (deltaMicroCny < 0) return `-${amount} / -${percent}`;
  return "无变化";
}

function downloadLedgerExport(exported: SerializedLedgerExport): void {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") {
    return;
  }

  const type = exported.format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8";
  const blob = new Blob([exported.content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `mymeter-ledger-${new Date().toISOString().replace(/[:.]/g, "-")}.${exported.format}`;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const DEEPSEEK_RECHARGE_URL = "https://platform.deepseek.com/top_up";
const BALANCE_WARNING_THRESHOLD_MICROS = 5_000_000;

function mapBalances(snapshot: MyMeterRemoteSnapshot, activeProvider: string): MyMeterViewModel["balances"] {
  const remoteBalances = snapshot.balances ?? [];
  if (remoteBalances.length > 0) {
    return remoteBalances
      .filter((balance) => balance.supported && isDeepSeekProvider(balance.provider))
      .map((balance) => mapBalance(
        balance.supported && isDeepSeekProvider(balance.provider)
          ? { ...balance, ...snapshot.balance }
          : balance,
        balance.provider,
        balance.providerName,
        balance.supported,
      ));
  }

  const providers = uniqueProviders([
    activeProvider,
    snapshot.summary.provider,
    // Session summaries cover every billable session; the slim snapshot only
    // embeds one detail, so providers must not be sourced from details.
    ...snapshot.sessions.map((session) => session.provider),
  ]);
  return providers
    .filter(isDeepSeekProvider)
    .map((provider) => mapBalance(
      snapshot.balance,
      provider,
      formatProviderName(provider),
      true,
    ));
}

function mapBalance(
  balance: RemoteBalanceSnapshot,
  provider: string,
  providerName: string,
  supported: boolean,
): MyMeterViewModel["balance"] {
  const currency = supported ? normalizeBalanceCurrency(balance.currency) : null;
  const totalMicro = supported ? balance.totalMicroCny : null;
  const grantedMicro = supported ? balance.grantedMicroCny : null;
  const toppedUpMicro = supported ? balance.toppedUpMicroCny : null;
  const needsRecharge = supported
    && (currency === "CNY" || currency === "USD")
    && totalMicro !== null
    && totalMicro < BALANCE_WARNING_THRESHOLD_MICROS;
  const status = supported
    ? needsRecharge && balance.status === "fresh" ? "insufficient" : balance.status
    : "unavailable";
  const statusLabel =
    status === "expired"
      ? `${providerName}账户余额（过期）`
      : status === "stale"
        ? `${providerName}账户余额（过期）`
        : status === "insufficient"
          ? `${providerName}账户余额（不足）`
          : status === "unavailable"
            ? `${providerName}账户余额（不可用）`
            : `${providerName}账户余额`;

  return {
    provider,
    providerName,
    label: statusLabel,
    status,
    supported,
    currency,
    total: nullableBalanceAmount(totalMicro, currency, needsRecharge),
    granted: nullableBalanceAmount(grantedMicro, currency),
    toppedUp: nullableBalanceAmount(toppedUpMicro, currency),
    refreshedAt: supported ? balance.refreshedAt : null,
    rechargeUrl: supported && isDeepSeekProvider(provider) ? DEEPSEEK_RECHARGE_URL : null,
    needsRecharge,
    rechargeThresholdLabel: supported && currency ? formatBalanceThreshold(currency) : null,
  };
}

function selectBalance(
  balances: MyMeterViewModel["balances"],
  provider: string,
): MyMeterViewModel["balance"] | null {
  const normalized = normalizeProviderId(provider);
  const exact = balances.find((balance) => normalizeProviderId(balance.provider) === normalized);
  if (exact) return exact;
  if (isDeepSeekProvider(provider)) {
    const deepSeek = balances.find((balance) => isDeepSeekProvider(balance.provider));
    if (deepSeek) return deepSeek;
  }
  if (normalized === "unknown") return balances.find((balance) => balance.supported) ?? balances[0] ?? null;
  return null;
}

function uniqueProviders(providers: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const provider of providers) {
    const normalized = normalizeProviderId(provider);
    if (normalized === "unknown" || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(provider);
  }
  return result;
}

function normalizeProviderId(provider: string): string {
  return provider.trim().toLowerCase() || "unknown";
}

function formatProviderName(provider: string): string {
  const normalized = normalizeProviderId(provider);
  if (isDeepSeekProvider(normalized)) return "DeepSeek";
  if (normalized === "openai") return "OpenAI";
  if (normalized === "anthropic") return "Anthropic";
  if (normalized === "google" || normalized === "gemini") return "Google Gemini";
  return provider.trim() || "未知厂商";
}

function nullableBalanceAmount(
  micros: number | null,
  currency: string | null,
  preserveLowBalanceBoundary = false,
): AmountView | null {
  if (micros === null) return null;
  const roundedToThreshold = Math.round(micros / 1_000) === 5_000;
  const amount = createAmountView(micros, preserveLowBalanceBoundary && roundedToThreshold ? 6 : 3);
  const symbol = currency === "USD" ? "$" : currency === "CNY" ? "¥" : currency ? `${currency} ` : "¥";
  return {
    ...amount,
    label: amount.label.replace("¥", symbol),
    detailLabel: amount.detailLabel.replace("¥", symbol),
  };
}

function normalizeBalanceCurrency(currency: string | null): string | null {
  const normalized = currency?.trim().toUpperCase();
  return normalized || "CNY";
}

function isDeepSeekProvider(provider: string): boolean {
  const normalized = normalizeProviderId(provider);
  return normalized === "deepseek" || normalized === "deepseek-official";
}

function balanceStatusPriority(status: BalanceStatus): number {
  if (status === "insufficient") return 3;
  if (status === "expired" || status === "stale") return 2;
  if (status === "fresh") return 1;
  return 0;
}

function formatBalanceThreshold(currency: string): string {
  return currency === "USD" ? "$5" : currency === "CNY" ? "¥5" : `${currency} 5`;
}

function createRequestAmountView(microCny: number, status: MeterStatusCode): AmountView {
  if (status !== "unknown" && status !== "aborted") {
    return createAmountView(microCny);
  }

  const estimate = createAmountView(microCny);
  return {
    ...estimate,
    label: `${estimate.label}（估算）`,
    detailLabel: `${estimate.detailLabel}（估算）`,
  };
}

function createAlerts(
  snapshot: MyMeterRemoteSnapshot,
  statusCode: MeterStatusCode,
  balances: MyMeterViewModel["balances"],
  budgetMessage: string | null,
): string[] {
  const alerts: string[] = [];
  if (snapshot.connection.status === "stale") {
    alerts.push("Remote 连接已过期，正在显示最近快照。");
  }
  if (snapshot.connection.status === "error" && snapshot.connection.message) {
    alerts.push(snapshot.connection.message);
  }
  if (balances.some((balance) => balance.supported && (balance.status === "expired" || balance.status === "stale"))) {
    alerts.push("余额快照已过期，不影响 DSH 本地累计。");
  }
  for (const balance of balances) {
    if (balance.needsRecharge) {
      alerts.push(`${balance.providerName} 账户余额低于 ${balance.rechargeThresholdLabel ?? "5"}，请及时充值。`);
    }
  }
  if (statusCode === "unknown") {
    alerts.push("本轮费用为估算值，已按可用 Token 计算。");
  }
  if (statusCode === "failed") {
    alerts.push("请求失败，已按可用 usage 计算估算费用。");
  }
  if (statusCode === "aborted") {
    alerts.push("请求已中止，费用按可用 Token 估算。");
  }
  if (budgetMessage) {
    alerts.push(budgetMessage);
  }
  return alerts;
}

function formatPricingZone(zone: PricingZone): string {
  if (zone === "peak") {
    return "高峰时段";
  }
  if (zone === "offpeak") {
    return "空闲时段";
  }
  return "不适用";
}

function isPosition(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { x?: unknown; y?: unknown };
  return typeof candidate.x === "number" && typeof candidate.y === "number";
}

function getDefaultStorage(): StorageLike | null {
  try {
    const maybeGlobal = globalThis as typeof globalThis & { localStorage?: StorageLike };
    const storage = maybeGlobal.localStorage;
    if (
      storage &&
      typeof storage.getItem === "function" &&
      typeof storage.setItem === "function" &&
      typeof storage.removeItem === "function"
    ) {
      return storage;
    }
  } catch {
    return null;
  }
  return null;
}

function getViewportSize(): { width: number; height: number } {
  const maybeWindow = globalThis as typeof globalThis & { innerWidth?: number; innerHeight?: number };
  const w = maybeWindow.innerWidth;
  const h = maybeWindow.innerHeight;
  return {
    width: typeof w === "number" && w > 0 ? w : 1024,
    height: typeof h === "number" && h > 0 ? h : 768,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function statusPriority(status: MeterStatusCode): number {
  return STATUS_PRIORITY[status];
}

function createStaticRemote(snapshot: MyMeterRemoteSnapshot): MyMeterRemote {
  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe() {
      return () => {};
    },
  };
}

function createEmptySnapshot(): MyMeterRemoteSnapshot {
  return {
    connection: { status: "connected", message: null },
    currentSessionId: null,
    summary: {
      status: { code: "idle" },
      provider: "unknown",
      model: "unknown",
      reasoningEffort: "unknown",
      agentPreset: "unknown",
      currentRequestMicroCny: 0,
      sessionTotalMicroCny: 0,
      settledTotalMicroCny: 0,
      estimatedTotalMicroCny: 0,
      localTotalMicroCny: 0,
      pricingZone: "unknown",
    },
    balance: {
      status: "unavailable",
      currency: null,
      totalMicroCny: null,
      grantedMicroCny: null,
      toppedUpMicroCny: null,
      refreshedAt: null,
    },
    balances: [],
    sessions: [],
    details: {},
  };
}
