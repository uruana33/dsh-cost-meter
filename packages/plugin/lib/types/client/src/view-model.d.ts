export type MeterStatusCode = "idle" | "billing" | "settled" | "unknown" | "balance_expired" | "balance_insufficient" | "failed" | "aborted";
export type MeterTone = "neutral" | "info" | "success" | "warning" | "danger";
export type PricingZone = "peak" | "offpeak" | "unknown";
export interface AmountView {
    microCny: number;
    label: string;
    detailLabel: string;
    currency?: string | undefined;
}
export interface CurrencyTotalView {
    currency: string;
    amount: AmountView;
    settled: AmountView;
    estimated: AmountView;
    failed: AmountView;
}
export interface ExchangeRateView {
    status: "idle" | "loading" | "fresh" | "error";
    rate: number | null;
    fetchedAt: string | null;
    source: string | null;
    error: string | null;
}
export interface TokenBucketView {
    label: string;
    tokens: number;
    amount: AmountView;
    unitPrice: AmountView | null;
    unitPriceMixed?: boolean | undefined;
}
export interface CacheSavingsInsightView {
    available: boolean;
    tokens: number;
    amount: AmountView | null;
    label: string;
}
export interface BudgetInsightView {
    level: "off" | "unavailable" | "ok" | "notice" | "warning" | "danger";
    available: boolean;
    spent: AmountView;
    threshold: AmountView;
    ratio: number | null;
    percentLabel: string | null;
    message: string | null;
}
export interface PricingZoneCountdownView {
    currentZone: PricingZone;
    currentZoneLabel: string;
    nextZone: PricingZone | null;
    nextZoneLabel: string | null;
    transitionAt: string | null;
    transitionTimeLabel: string | null;
    remainingMs: number | null;
    remainingLabel: string | null;
}
export interface BillingInsightsView {
    cacheSavings: CacheSavingsInsightView;
    budget: BudgetInsightView;
    pricingZoneCountdown: PricingZoneCountdownView;
}
export interface ContextBreakdownView {
    systemTokens: number;
    toolsTokens: number;
    messageTokens: number;
}
export interface SessionTurnView {
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
    amount: AmountView;
    note: string | null;
}
export interface SessionStageView {
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
    pricingZoneLabel: string;
    priceVersion: string;
    exchangeRateLabel?: string | null | undefined;
    currentRequest: AmountView;
    sessionTotal: AmountView;
    settledTotal: AmountView;
    estimatedTotal: AmountView;
    unknownCount: number;
    tokenBuckets: TokenBucketView[];
    turns: SessionTurnView[];
    contextBreakdown: ContextBreakdownView | null;
    currency?: string | undefined;
}
export interface SessionSummaryView {
    id: string;
    title: string;
    provider: string;
    model: string;
    reasoningEffort: string;
    agentPreset: string;
    status: MeterStatusCode;
    currentRequest: AmountView;
    sessionTotal: AmountView;
    unknownCount: number;
    lastActivityAt: string;
    isPinned: boolean;
    isActive: boolean;
}
export interface SessionDetailView {
    id: string;
    title: string;
    provider: string;
    model: string;
    reasoningEffort: string;
    agentPreset: string;
    status: MeterStatusCode;
    pricingZone: PricingZone;
    pricingZoneLabel: string;
    currentRequest: AmountView;
    sessionTotal: AmountView;
    settledTotal: AmountView;
    estimatedTotal: AmountView;
    unknownCount: number;
    tokenBuckets: TokenBucketView[];
    contextBreakdown: ContextBreakdownView | null;
    turns: SessionTurnView[];
    stages: SessionStageView[];
    insights: BillingInsightsView;
    timeline: Array<{
        label: string;
        at: string;
        status: MeterStatusCode;
        amount: AmountView;
    }>;
    currencyTotals: CurrencyTotalView[];
    cnyEquivalent: AmountView | null;
}
export interface AsyncResourceView<T> {
    status: "unavailable" | "idle" | "loading" | "ready" | "error";
    data: T | null;
    error: string | null;
}
export interface SessionCostTreeNodeView {
    id: string;
    title: string;
    depth: number;
    total: AmountView;
    subtreeTotal: AmountView;
    requestCount: number;
    childCount: number;
    anomalyLabels: string[];
    children: SessionCostTreeNodeView[];
}
export interface SessionCostTreeView {
    total: AmountView;
    requestCount: number;
    roots: SessionCostTreeNodeView[];
    anomalyLabels: string[];
}
export interface CostTrendBucketView {
    key: string;
    amount: AmountView;
    previousAmount: AmountView | null;
    deltaLabel: string;
    requestCount: number;
    statusLabel: string;
}
export interface CostAnalyticsAnomalyView {
    ruleId: string;
    severity: "info" | "warning";
    bucketKey: string;
    explanation: string;
}
export interface UsageOverviewView {
    range: "today" | "7d" | "30d";
    timeZone: string;
    generatedAt: string;
    total: AmountView;
    totalTokens: number;
    requestCount: number;
    pricedRequestCount: number;
    unknownRequestCount: number;
    coverage: "complete" | "partial" | "unavailable";
    trend: Array<{
        key: string;
        startAt: string;
        endAt: string;
        amount: AmountView;
        totalTokens: number;
        requestCount: number;
        coverage: "complete" | "partial" | "unavailable";
        models: Array<{
            provider: string;
            model: string;
            amount: AmountView;
            totalTokens: number;
            requestCount: number;
            pricedRequestCount: number;
            unknownRequestCount: number;
            coverage: "complete" | "partial" | "unavailable";
        }>;
    }>;
    topModels: Array<{
        provider: string;
        model: string;
        amount: AmountView;
        totalTokens: number;
        requestCount: number;
        pricedRequestCount: number;
        unknownRequestCount: number;
        coverage: "complete" | "partial" | "unavailable";
    }>;
}
export interface CostAnalyticsView {
    generatedAt: string;
    total: AmountView;
    requestCount: number;
    dailyTrend: CostTrendBucketView[];
    hourlyTrend: CostTrendBucketView[];
    anomalies: CostAnalyticsAnomalyView[];
}
export interface LedgerExportView {
    status: "unavailable" | "idle" | "loading" | "ready" | "error";
    format: "json" | "csv" | null;
    error: string | null;
    lastDownloadedAt: string | null;
}
export interface BalanceView {
    provider: string;
    providerName: string;
    label: string;
    status: "fresh" | "stale" | "expired" | "insufficient" | "unavailable";
    supported: boolean;
    currency: string | null;
    total: AmountView | null;
    granted: AmountView | null;
    toppedUp: AmountView | null;
    refreshedAt: string | null;
    rechargeUrl: string | null;
    needsRecharge: boolean;
    rechargeThresholdLabel: string | null;
}
export interface OverlayView {
    collapsed: boolean;
    pinnedSessionId: string | null;
    position: {
        x: number;
        y: number;
    };
    dockedEdge: "left" | "right" | "top" | "bottom" | null;
    narrow: boolean;
}
export interface MyMeterSettings {
    reducedMotion: boolean;
    muted: boolean;
    refreshIntervalMs: number;
    budgetThresholdMicroCny: number;
    pinnedSessionId: string | null;
    overlayPosition: {
        x: number;
        y: number;
    };
    overlayEnabled: boolean;
    /** Compatibility field. Always true because the overlay is receipt-only. */
    overlayCollapsed: boolean;
}
export interface MyMeterViewModel {
    appName: "Token计费";
    scope: {
        kind: "global" | "session";
        label: string;
        sessionId: string | null;
    };
    status: {
        code: MeterStatusCode;
        label: string;
        tone: MeterTone;
    };
    headline: string;
    subheadline: string;
    provider: string;
    model: string;
    reasoningEffort: string;
    agentPreset: string;
    pricingZone: PricingZone;
    pricingZoneLabel: string;
    currentRequest: AmountView;
    sessionTotal: AmountView;
    settledTotal: AmountView;
    currencyTotals: CurrencyTotalView[];
    cnyEquivalent: AmountView | null;
    exchangeRate: ExchangeRateView;
    estimatedTotal: AmountView;
    localTotal: AmountView;
    balance: BalanceView;
    balances: BalanceView[];
    sessions: SessionSummaryView[];
    detail: SessionDetailView | null;
    overlay: OverlayView;
    settings: MyMeterSettings;
    insights: BillingInsightsView;
    sessionCostTree: AsyncResourceView<SessionCostTreeView>;
    costAnalytics: AsyncResourceView<CostAnalyticsView>;
    usageOverview: AsyncResourceView<UsageOverviewView>;
    ledgerExport: LedgerExportView;
    alerts: string[];
}
