import type { AsyncResourceView, CostAnalyticsView, LedgerExportView, MeterStatusCode, MyMeterSettings, MyMeterViewModel, PricingZone, SessionCostTreeView } from "./view-model";
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
        missingParents: Array<{
            sessionId: string;
            parentSessionId: string;
        }>;
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
}
export interface MyMeterRemote {
    getSnapshot(): MyMeterRemoteSnapshot;
    subscribe(listener: (snapshot: MyMeterRemoteSnapshot) => void): () => void;
    refreshExchangeRate?(): Promise<RemoteExchangeRateSnapshot | void>;
    getSessionCostTree?(): Promise<RemoteSessionCostTree>;
    getCostAnalytics?(): Promise<RemoteCostAnalyticsReport>;
    exportLedger?(format: RemoteLedgerExportFormat): Promise<string>;
}
export type SessionSort = "recent" | "amount" | "status";
export type StatusFilter = MeterStatusCode | "all";
export type ClientPanel = "compact" | "sessions" | "detail" | "settings" | "costTree" | "analytics";
export interface MyMeterStoreUiState {
    selectedSessionId: string | null;
    activePanel: ClientPanel;
    overlayVisible: boolean;
    searchQuery: string;
    sortBy: SessionSort;
    filterStatus: StatusFilter;
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
    ledgerExport: LedgerExportView;
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
    setSettings(patch: Partial<MyMeterSettings>): void;
    resetSettings(): void;
    setReducedMotion(reducedMotion: boolean): void;
    setMuted(muted: boolean): void;
    setRefreshIntervalMs(refreshIntervalMs: number): void;
    setBudgetThresholdMicroCny(budgetThresholdMicroCny: number): void;
    setPinnedSessionId(sessionId: string | null): void;
    setOverlayPosition(position: {
        x: number;
        y: number;
    }): void;
    setOverlayEnabled(enabled: boolean): void;
    /** @deprecated The overlay is receipt-only and can no longer be expanded. */
    setOverlayCollapsed(collapsed: boolean): void;
    setOverlayVisible(visible: boolean): void;
    refreshExchangeRate(): Promise<void>;
    loadSessionCostTree(): Promise<void>;
    loadCostAnalytics(): Promise<void>;
    exportLedger(format: RemoteLedgerExportFormat): Promise<void>;
}
export declare const DEFAULT_STORAGE_KEY = "mymeter.settings";
export declare const DEFAULT_SETTINGS: MyMeterSettings;
export declare function loadPersistedSettings(storage: StorageLike | null | undefined, key?: string): MyMeterSettings;
export declare function savePersistedSettings(storage: StorageLike | null | undefined, settings: MyMeterSettings, key?: string): void;
export declare function clearPersistedSettings(storage: StorageLike | null | undefined, key?: string): void;
export declare function normalizeSettings(input: Partial<MyMeterSettings> | null | undefined): MyMeterSettings;
export declare function resolvePrimaryStatus(requestStatus: MeterStatusCode, balanceStatus: BalanceStatus, activeStatus: MeterStatusCode | null): MeterStatusCode;
export interface SnappedOverlayPosition {
    position: {
        x: number;
        y: number;
    };
    dockedEdge: "left" | "right" | "top" | "bottom" | null;
}
export declare function snapOverlayPosition(position: {
    x: number;
    y: number;
}, viewport?: {
    width: number;
    height: number;
}, panelSize?: {
    width: number;
    height: number;
}, snapThreshold?: number): SnappedOverlayPosition;
export declare function buildViewModel(snapshot: MyMeterRemoteSnapshot, settings: MyMeterSettings, ui: MyMeterStoreUiState, asyncState?: MyMeterAsyncState): MyMeterViewModel;
export declare function createMyMeterStore(options?: {
    remote?: MyMeterRemote;
    storage?: StorageLike | null;
    storageKey?: string;
}): MyMeterStore;
export declare function statusPriority(status: MeterStatusCode): number;
