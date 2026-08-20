import { MYMETER_GOLDEN_FIXTURES, createCostEventKey, createMockMyMeterRemote, formatMoneyMicroCny, getCostStatusMessageKey, isBillableCostEvent, type CostAggregate, type CostBreakdown, type CostEvent, type CostEventIdentity, type CostEventSource, type CostEventStatus, type CostRequestOutcome, type CostUnknownReason, type DateInput, type MoneyMicroCny, type MoneyMinor, type PricingZone } from "../../shared/src/index";
import { DEEPSEEK_PROVIDER, XAI_PROVIDER } from "./pricing/index";
import type { DeepSeekModelId, XaiModelId } from "./pricing/index";
export { resolveDeepSeekPricingZoneCountdown, } from "./pricing-zone-countdown";
export type { DeepSeekPricingZoneCountdown, DeepSeekPricingZoneCountdownInput, } from "./pricing-zone-countdown";
export { createCostEventKey, createMockMyMeterRemote, formatMoneyMicroCny, getCostStatusMessageKey, isBillableCostEvent, MYMETER_GOLDEN_FIXTURES, };
export type { CostAggregate, CostAggregateBucket, CostBreakdown, CostEvent, CostEventIdentity, CostEventSource, CostEventStatus, CostRequestOutcome, CostTokenUsage, CostUnknownReason, DateInput, CostCurrency, MoneyMicroCny, MoneyMinor, PricingZone, TokenCount, } from "../../shared/src/index";
export type DeepSeekPriceLookupMissReason = "model_not_found" | "rate_not_found";
export { DEEPSEEK_PRICE_VERSION, DEEPSEEK_PRICING_SOURCE, DEEPSEEK_PROVIDER, XAI_PRICE_VERSION, XAI_PRICING_SOURCE, XAI_PROVIDER, XAI_EXCHANGE_RATE_LABEL, USD_CNY_EXCHANGE_RATE_LABEL, PRICING_CATALOG_VERSIONS, resolveDeepSeekModelId, resolvePricingCatalogKind, resolveXaiModelId, listPriceCatalogProviders, } from "./pricing/index";
export type { DeepSeekModelId, PricingCatalogKind, PricingCatalogVersion, XaiModelId } from "./pricing/index";
export { createCostAnalyticsReport, } from "./analytics";
export { createUsageOverview } from "./usage-overview";
export type { UsageOverviewCostStatus, UsageOverviewCoverage, UsageOverviewEventInput, UsageOverviewModelSummary, UsageOverviewOptions, UsageOverviewQuery, UsageOverviewRange, UsageOverviewReport, UsageOverviewTotal, UsageOverviewTrendBucket, } from "./usage-overview";
export type { CostAnalyticsAnomaly, CostAnalyticsAnomalyRuleId, CostAnalyticsAnomalySeverity, CostAnalyticsEventInput, CostAnalyticsOptions, CostAnalyticsPricingZone, CostAnalyticsReport, CostAnalyticsSessionSummary, CostAnalyticsStatus, CostAnalyticsStatusCounts, CostAnalyticsTotal, CostAnalyticsTrendBucket, } from "./analytics";
export { calculateCacheHitSavings, type CacheHitSavingsInput, type CacheHitSavingsResult, } from "./cache-savings";
export { evaluateBudgetAlert, type BudgetAlertBasis, type BudgetAlertLevel, type BudgetAlertResult, type BudgetAlertState, type EvaluateBudgetAlertInput, } from "./budget-alerts";
export interface TokenUsageInput {
    cacheHitTokens?: number | bigint | undefined;
    cacheMissTokens?: number | bigint | undefined;
    cacheWriteTokens?: number | bigint | undefined;
    cache_write_tokens?: number | bigint | undefined;
    outputTokens?: number | bigint | undefined;
    reasoningTokens?: number | bigint | undefined;
    promptTokens?: number | bigint | undefined;
    completionTokens?: number | bigint | undefined;
    cachedTokens?: number | bigint | undefined;
    promptCacheHitTokens?: number | bigint | undefined;
    promptCacheMissTokens?: number | bigint | undefined;
    prompt_cache_hit_tokens?: number | bigint | undefined;
    prompt_cache_miss_tokens?: number | bigint | undefined;
    prompt_tokens?: number | bigint | undefined;
    completion_tokens?: number | bigint | undefined;
    reasoning_tokens?: number | bigint | undefined;
    prompt_tokens_details?: {
        cached_tokens?: number | bigint | undefined;
    } | undefined;
    completion_tokens_details?: {
        reasoning_tokens?: number | bigint | undefined;
    } | undefined;
}
export interface UsageProjectionInput extends TokenUsageInput {
    reliable?: boolean | undefined;
}
export interface DeepSeekRateQuote {
    provider: typeof DEEPSEEK_PROVIDER;
    model: string;
    pricingZone: Exclude<PricingZone, "unknown">;
    priceVersion: string;
    source: string;
    cacheHitMicroCnyPerMillionTokens: MoneyMicroCny;
    cacheMissMicroCnyPerMillionTokens: MoneyMicroCny;
    outputMicroCnyPerMillionTokens: MoneyMicroCny;
    currency: "CNY";
    cacheHitMinorPerMillionTokens: MoneyMinor;
    cacheMissMinorPerMillionTokens: MoneyMinor;
    outputMinorPerMillionTokens: MoneyMinor;
}
export type DeepSeekPriceLookupResult = {
    ok: true;
    quote: DeepSeekRateQuote;
} | {
    ok: false;
    reason: DeepSeekPriceLookupMissReason;
    model: string;
    pricingZone: PricingZone;
    priceVersion: string;
    source: string;
};
export interface DeepSeekPriceLookupInput {
    model: string;
    requestStartedAt: DateInput;
    pricingZone?: PricingZone | undefined;
}
export interface DeepSeekPriceDirectory {
    provider: typeof DEEPSEEK_PROVIDER;
    priceVersion: string;
    source: string;
    listModels(): DeepSeekModelId[];
    lookup(input: DeepSeekPriceLookupInput): DeepSeekPriceLookupResult;
}
export interface CalculateDeepSeekUsageCostInput {
    model: string;
    requestStartedAt: DateInput;
    usage?: TokenUsageInput | undefined;
    pricingZone?: PricingZone | undefined;
    priceDirectory?: DeepSeekPriceDirectory | undefined;
    requestOutcome?: CostRequestOutcome | undefined;
}
export interface DeepSeekUsageCostResult extends CostBreakdown {
    provider: typeof DEEPSEEK_PROVIDER;
    model: string;
    status: CostEventStatus;
    source: "final_usage";
    priceSource: string;
    cacheHitRateMicroCnyPerMillionTokens: MoneyMicroCny;
    cacheMissRateMicroCnyPerMillionTokens: MoneyMicroCny;
    outputRateMicroCnyPerMillionTokens: MoneyMicroCny;
    requestOutcome?: CostRequestOutcome | undefined;
    unknownReason?: CostUnknownReason | undefined;
}
export interface XaiRateQuote {
    provider: typeof XAI_PROVIDER;
    model: string;
    pricingZone: "unknown";
    priceVersion: string;
    source: string;
    rateTier: "short_context" | "long_context";
    cacheHitMicroCnyPerMillionTokens: MoneyMicroCny;
    cacheMissMicroCnyPerMillionTokens: MoneyMicroCny;
    outputMicroCnyPerMillionTokens: MoneyMicroCny;
    currency: "USD";
    cacheHitMinorPerMillionTokens: MoneyMinor;
    cacheMissMinorPerMillionTokens: MoneyMinor;
    outputMinorPerMillionTokens: MoneyMinor;
}
export type XaiPriceLookupResult = {
    ok: true;
    quote: XaiRateQuote;
} | {
    ok: false;
    reason: "model_not_found";
    model: string;
    pricingZone: "unknown";
    priceVersion: string;
    source: string;
};
export interface XaiPriceDirectory {
    provider: typeof XAI_PROVIDER;
    priceVersion: string;
    source: string;
    listModels(): XaiModelId[];
    lookup(input: {
        model: string;
        inputTokens?: number | bigint | undefined;
    }): XaiPriceLookupResult;
}
export interface CalculateXaiUsageCostInput {
    model: string;
    usage?: TokenUsageInput | undefined;
    priceDirectory?: XaiPriceDirectory | undefined;
    requestOutcome?: CostRequestOutcome | undefined;
}
export interface XaiUsageCostResult extends CostBreakdown {
    provider: typeof XAI_PROVIDER;
    model: string;
    status: CostEventStatus;
    source: "final_usage";
    priceSource: string;
    cacheHitRateMicroCnyPerMillionTokens: MoneyMicroCny;
    cacheMissRateMicroCnyPerMillionTokens: MoneyMicroCny;
    outputRateMicroCnyPerMillionTokens: MoneyMicroCny;
    requestOutcome?: CostRequestOutcome | undefined;
    unknownReason?: CostUnknownReason | undefined;
}
export interface CalculateProviderUsageCostInput {
    provider: string;
    model: string;
    usage?: TokenUsageInput | undefined;
    requestOutcome?: CostRequestOutcome | undefined;
}
export interface ProviderUsageCostResult extends CostBreakdown {
    provider: string;
    model: string;
    status: CostEventStatus;
    source: "final_usage";
    priceSource: string;
    cacheHitRateMicroCnyPerMillionTokens: MoneyMicroCny;
    cacheMissRateMicroCnyPerMillionTokens: MoneyMicroCny;
    outputRateMicroCnyPerMillionTokens: MoneyMicroCny;
    requestOutcome?: CostRequestOutcome | undefined;
    unknownReason?: CostUnknownReason | undefined;
}
export interface ProviderBillingRequest {
    provider: string;
    model: string;
    requestStartedAt: DateInput;
    usage?: TokenUsageInput | undefined;
    requestOutcome?: "success" | "failed" | "aborted" | undefined;
}
export interface ProviderBillingMatch {
    provider: string;
    model: string;
}
export interface ProviderBillingAdapter {
    id: string;
    supports(input: ProviderBillingMatch): boolean;
    calculate(input: ProviderBillingRequest): ProviderUsageCostResult;
}
export interface ProviderBillingRegistry {
    resolve(input: ProviderBillingMatch): ProviderBillingAdapter | undefined;
    calculate(input: ProviderBillingRequest): ProviderUsageCostResult;
    listAdapters(): readonly ProviderBillingAdapter[];
}
export declare function createProviderBillingRegistry(options?: {
    adapters?: readonly ProviderBillingAdapter[] | undefined;
}): ProviderBillingRegistry;
export interface BuildCostEventInput extends CostEventIdentity {
    id: string;
    provider?: string | undefined;
    model: string;
    requestStartedAt: DateInput;
    completedAt?: DateInput | undefined;
    reasoningEffort?: string | undefined;
    agentPreset?: string | undefined;
    parentSessionId?: string | undefined;
    priceDirectory?: DeepSeekPriceDirectory | undefined;
}
export interface EstimateXaiCostEventInput extends Omit<BuildCostEventInput, "priceDirectory"> {
    priceDirectory?: XaiPriceDirectory | undefined;
    usageProjection?: UsageProjectionInput | undefined;
}
export interface FinalizeXaiCostEventInput extends Omit<BuildCostEventInput, "priceDirectory"> {
    priceDirectory?: XaiPriceDirectory | undefined;
    usage?: TokenUsageInput | undefined;
    previousEvent?: CostEvent | undefined;
    requestOutcome?: CostRequestOutcome | undefined;
}
export interface EstimateProviderCostEventInput extends Omit<BuildCostEventInput, "priceDirectory"> {
    provider: string;
    usageProjection?: UsageProjectionInput | undefined;
}
export interface FinalizeProviderCostEventInput extends Omit<BuildCostEventInput, "priceDirectory"> {
    provider: string;
    usage?: TokenUsageInput | undefined;
    previousEvent?: CostEvent | undefined;
    requestOutcome?: CostRequestOutcome | undefined;
}
export interface EstimateDeepSeekCostEventInput extends BuildCostEventInput {
    usageProjection?: UsageProjectionInput | undefined;
}
export interface FinalizeDeepSeekCostEventInput extends BuildCostEventInput {
    usage?: TokenUsageInput | undefined;
    previousEvent?: CostEvent | undefined;
    requestOutcome?: CostRequestOutcome | undefined;
}
export interface CostEventJournal {
    upsert(event: CostEvent): CostEvent;
    getByKey(eventKey: string): CostEvent | undefined;
    list(): CostEvent[];
    aggregate(): CostAggregate;
}
export declare function createDeepSeekPriceDirectory(options?: {
    priceVersion?: string | undefined;
    source?: string | undefined;
}): DeepSeekPriceDirectory;
/**
 * xAI official Text API snapshot. The legacy CNY fields are retained for
 * compatibility, while native USD rates are exposed for source-currency UI.
 */
export declare function createXaiPriceDirectory(options?: {
    priceVersion?: string | undefined;
    source?: string | undefined;
}): XaiPriceDirectory;
export declare const createPriceDirectory: typeof createDeepSeekPriceDirectory;
export declare const createDeepSeekPricingDirectory: typeof createDeepSeekPriceDirectory;
export declare function resolveDeepSeekPricingZone(requestStartedAt: DateInput): Exclude<PricingZone, "unknown">;
export declare const resolvePricingZone: typeof resolveDeepSeekPricingZone;
export declare const getPricingZone: typeof resolveDeepSeekPricingZone;
export declare function calculateDeepSeekUsageCost(input: CalculateDeepSeekUsageCostInput): DeepSeekUsageCostResult;
export declare const calculateCostBreakdown: typeof calculateDeepSeekUsageCost;
export declare const calculateUsageCost: typeof calculateDeepSeekUsageCost;
export declare function calculateXaiUsageCost(input: CalculateXaiUsageCostInput): XaiUsageCostResult;
/** Calculate a usage cost from one of the additional provider snapshots. */
export declare function calculateProviderUsageCost(input: CalculateProviderUsageCostInput): ProviderUsageCostResult;
export declare function estimateProviderCostEvent(input: EstimateProviderCostEventInput): CostEvent;
export declare function finalizeProviderCostEvent(input: FinalizeProviderCostEventInput): CostEvent;
export declare function estimateXaiCostEvent(input: EstimateXaiCostEventInput): CostEvent;
export declare function finalizeXaiCostEvent(input: FinalizeXaiCostEventInput): CostEvent;
export declare function classifyDeepSeekRequestCostStatus(input: {
    hasFinalUsage: boolean;
    hasReliableProjection: boolean;
    hasRate: boolean;
    requestOutcome?: CostRequestOutcome | undefined;
}): CostEventStatus;
export declare const decideCostEventStatus: typeof classifyDeepSeekRequestCostStatus;
export declare const decideRequestCostStatus: typeof classifyDeepSeekRequestCostStatus;
export declare function estimateDeepSeekCostEvent(input: EstimateDeepSeekCostEventInput): CostEvent;
export declare const estimateStreamingCostEvent: typeof estimateDeepSeekCostEvent;
export declare const estimateCostEvent: typeof estimateDeepSeekCostEvent;
export declare function finalizeDeepSeekCostEvent(input: FinalizeDeepSeekCostEventInput): CostEvent;
/** Preserve usage for providers without a configured price directory without applying DeepSeek rates. */
export declare function createUnknownCostEvent(input: BuildCostEventInput, options: {
    source: CostEventSource;
    usage?: TokenUsageInput | undefined;
    requestOutcome?: CostRequestOutcome | undefined;
    previousEvent?: CostEvent | undefined;
    unknownReason?: CostUnknownReason | undefined;
}): CostEvent;
export declare const settleDeepSeekCostEvent: typeof finalizeDeepSeekCostEvent;
export declare const finalizeCostEvent: typeof finalizeDeepSeekCostEvent;
export declare function dedupeCostEvents(events: readonly CostEvent[]): CostEvent[];
export declare const dedupeByCostEventKey: typeof dedupeCostEvents;
export declare const collapseCostEvents: typeof dedupeCostEvents;
export declare function aggregateCostEvents(events: readonly CostEvent[]): CostAggregate;
export declare function createCostEventJournal(initialEvents?: readonly CostEvent[]): CostEventJournal;
