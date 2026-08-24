export type CostEventStatus = "estimated" | "settled" | "unknown" | "failed";
export type CostCurrency = "CNY" | "USD" | (string & {});
export type CostEventSource = "stream" | "final_usage" | "restored" | "projection";
export type PricingZone = "peak" | "offpeak" | "unknown";
export type CostRequestOutcome = "success" | "failed" | "aborted";
export interface CostEventInput {
    id: string;
    sessionId: string;
    requestStartedAt: string;
    status: CostEventStatus;
    amountMicroCny: number;
    currency?: CostCurrency | undefined;
    amountMinor?: number | undefined;
    cacheHitMinor?: number | undefined;
    cacheMissMinor?: number | undefined;
    outputMinor?: number | undefined;
    cacheHitRateMinorPerMillionTokens?: number | undefined;
    cacheMissRateMinorPerMillionTokens?: number | undefined;
    outputRateMinorPerMillionTokens?: number | undefined;
    source: CostEventSource;
    turnId?: string | undefined;
    stepId?: string | undefined;
    attemptId?: string | undefined;
    parentSessionId?: string | undefined;
    provider?: string | undefined;
    model?: string | undefined;
    reasoningEffort?: string | undefined;
    agentPreset?: string | undefined;
    completedAt?: string | undefined;
    requestOutcome?: CostRequestOutcome | undefined;
    pricingZone?: PricingZone | undefined;
    cacheHitTokens?: number | undefined;
    cacheMissTokens?: number | undefined;
    cacheWriteTokens?: number | undefined;
    outputTokens?: number | undefined;
    reasoningTokens?: number | undefined;
    hitRateMicroCny?: number | undefined;
    missRateMicroCny?: number | undefined;
    outputRateMicroCny?: number | undefined;
    cacheHitRateMicroCnyPerMillionTokens?: number | undefined;
    cacheMissRateMicroCnyPerMillionTokens?: number | undefined;
    outputRateMicroCnyPerMillionTokens?: number | undefined;
    priceVersion?: string | undefined;
}
export interface CostEventRecord {
    id: string;
    eventKey: string;
    sessionId: string;
    requestStartedAt: string;
    status: CostEventStatus;
    amountMicroCny: number;
    currency: CostCurrency;
    amountMinor: number;
    cacheHitMinor: number;
    cacheMissMinor: number;
    outputMinor: number;
    cacheHitRateMinorPerMillionTokens: number;
    cacheMissRateMinorPerMillionTokens: number;
    outputRateMinorPerMillionTokens: number;
    source: CostEventSource;
    turnId: string;
    stepId: string;
    attemptId: string;
    parentSessionId?: string;
    provider: string;
    model: string;
    reasoningEffort: string;
    agentPreset: string;
    completedAt: string;
    requestOutcome?: CostRequestOutcome | undefined;
    pricingZone: PricingZone;
    cacheHitTokens: number;
    cacheMissTokens: number;
    cacheWriteTokens?: number | undefined;
    outputTokens: number;
    reasoningTokens: number;
    hitRateMicroCny: number;
    missRateMicroCny: number;
    outputRateMicroCny: number;
    cacheHitRateMicroCnyPerMillionTokens: number;
    cacheMissRateMicroCnyPerMillionTokens: number;
    outputRateMicroCnyPerMillionTokens: number;
    priceVersion: string;
}
export interface TokenUsageInput {
    cacheHitTokens?: number;
    cache_hit_tokens?: number;
    cacheMissTokens?: number;
    cache_miss_tokens?: number;
    cacheWriteTokens?: number;
    cache_write_tokens?: number;
    outputTokens?: number;
    output_tokens?: number;
    reasoningTokens?: number;
    reasoning_tokens?: number;
    promptTokens?: number;
    prompt_tokens?: number;
    completionTokens?: number;
    completion_tokens?: number;
    cachedTokens?: number;
    promptCacheHitTokens?: number;
    prompt_cache_hit_tokens?: number;
    promptCacheMissTokens?: number;
    prompt_cache_miss_tokens?: number;
    prompt_tokens_details?: {
        cached_tokens?: number;
    };
    completion_tokens_details?: {
        reasoning_tokens?: number;
    };
    totalTokens?: number;
    total_tokens?: number;
}
export interface TokenUsageRecord {
    cacheHitTokens: number;
    cacheMissTokens: number;
    cacheWriteTokens?: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
}
export interface TokenProjectionRecord extends TokenUsageRecord {
    isReliable: boolean;
}
export interface HostMetadataInput {
    provider?: unknown;
    model?: unknown;
    reasoningEffort?: unknown;
    agentPreset?: unknown;
    prompt?: unknown;
    completion?: unknown;
}
export interface HostMetadataRecord {
    provider: string;
    model: string;
    reasoningEffort: string;
    agentPreset: string;
}
export interface LedgerSummary {
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
export interface LedgerAggregation {
    global: LedgerSummary;
    sessions: Map<string, LedgerSummary>;
    days: Map<string, LedgerSummary>;
}
export interface BalanceSnapshot {
    status: "fresh" | "stale" | "unavailable";
    currency?: string;
    isAvailable?: boolean;
    unit?: "microCny";
    totalMicroCny?: number | null;
    grantedMicroCny?: number | null;
    toppedUpMicroCny?: number | null;
    total: number | null;
    granted: number | null;
    toppedUp: number | null;
    fetchedAt: number;
    updatedAt?: string;
    expiresAt: number;
    isExpired: boolean;
    error?: string;
}
export declare const UNKNOWN_TEXT = "unknown";
export declare function asText(value: unknown, fallback?: string): string;
export declare function asNumber(value: unknown, fallback?: number): number;
export declare function asRecord(value: unknown): Record<string, unknown>;
export declare function normalizeTokenUsage(input: TokenUsageInput): TokenUsageRecord;
export interface HostCostEventIdentity {
    sessionId: string;
    turnId?: string | undefined;
    stepId?: string | undefined;
    attemptId?: string | undefined;
}
export declare function createHostCostEventKey(identity: HostCostEventIdentity): string;
export declare function normalizeCostEvent(input: CostEventInput): CostEventRecord;
export declare function createEmptySummary(): LedgerSummary;
export declare function updateSummary(summary: LedgerSummary, event: CostEventRecord): LedgerSummary;
export declare function finalizeSummary(summary: LedgerSummary): LedgerSummary;
export declare function dayKeyFromTimestamp(timestamp: string): string;
