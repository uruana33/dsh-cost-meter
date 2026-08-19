import {
  TOKENS_PER_MILLION,
  MYMETER_GOLDEN_FIXTURES,
  createCostEventKey,
  createEmptyAggregateBucket,
  createMockMyMeterRemote,
  formatMoneyMicroCny,
  getCostStatusMessageKey,
  isBillableCostEvent,
  type CostAggregate,
  type CostAggregateBucket,
  type CostBreakdown,
  type CostEvent,
  type CostEventIdentity,
  type CostEventSource,
  type CostEventStatus,
  type CostRequestOutcome,
  type CostTokenUsage,
  type CostUnknownReason,
  type DateInput,
  type CostCurrency,
  type MoneyMicroCny,
  type MoneyMinor,
  type PricingZone,
  type TokenCount,
} from "../../shared/src/index";
import {
  DEEPSEEK_PRICE_TABLE,
  XAI_PRICE_TABLE_USD,
  getAdditionalPricingCatalog,
  lookupAdditionalPrice,
  resolveAdditionalPricingCatalogKind,
  resolveDeepSeekModelId,
  resolvePricingCatalogKind,
  resolveXaiModelId,
  usdToMicroCny,
  usdToMicroUsd,
} from "./pricing/index";
import {
  DEEPSEEK_PRICE_VERSION,
  DEEPSEEK_PRICING_SOURCE,
  DEEPSEEK_PROVIDER,
  XAI_PRICE_VERSION,
  XAI_PRICING_SOURCE,
  XAI_PROVIDER,
  XAI_EXCHANGE_RATE_LABEL,
  USD_CNY_EXCHANGE_RATE_LABEL,
  PRICING_CATALOG_VERSIONS,
} from "./pricing/index";
import type { DeepSeekModelId, PricingCatalogKind, XaiModelId } from "./pricing/index";
export {
  resolveDeepSeekPricingZoneCountdown,
} from "./pricing-zone-countdown";
export type {
  DeepSeekPricingZoneCountdown,
  DeepSeekPricingZoneCountdownInput,
} from "./pricing-zone-countdown";

export {
  createCostEventKey,
  createMockMyMeterRemote,
  formatMoneyMicroCny,
  getCostStatusMessageKey,
  isBillableCostEvent,
  MYMETER_GOLDEN_FIXTURES,
};
export type {
  CostAggregate,
  CostAggregateBucket,
  CostBreakdown,
  CostEvent,
  CostEventIdentity,
  CostEventSource,
  CostEventStatus,
  CostRequestOutcome,
  CostTokenUsage,
  CostUnknownReason,
  DateInput,
  CostCurrency,
  MoneyMicroCny,
  MoneyMinor,
  PricingZone,
  TokenCount,
} from "../../shared/src/index";

export type DeepSeekPriceLookupMissReason = "model_not_found" | "rate_not_found";

export {
  DEEPSEEK_PRICE_VERSION,
  DEEPSEEK_PRICING_SOURCE,
  DEEPSEEK_PROVIDER,
  XAI_PRICE_VERSION,
  XAI_PRICING_SOURCE,
  XAI_PROVIDER,
  XAI_EXCHANGE_RATE_LABEL,
  USD_CNY_EXCHANGE_RATE_LABEL,
  PRICING_CATALOG_VERSIONS,
  resolveDeepSeekModelId,
  resolvePricingCatalogKind,
  resolveXaiModelId,
  listPriceCatalogProviders,
} from "./pricing/index";
export type { DeepSeekModelId, PricingCatalogKind, PricingCatalogVersion, XaiModelId } from "./pricing/index";

export {
  createCostAnalyticsReport,
} from "./analytics";
export type {
  CostAnalyticsAnomaly,
  CostAnalyticsAnomalyRuleId,
  CostAnalyticsAnomalySeverity,
  CostAnalyticsEventInput,
  CostAnalyticsOptions,
  CostAnalyticsPricingZone,
  CostAnalyticsReport,
  CostAnalyticsSessionSummary,
  CostAnalyticsStatus,
  CostAnalyticsStatusCounts,
  CostAnalyticsTotal,
  CostAnalyticsTrendBucket,
} from "./analytics";
export {
  calculateCacheHitSavings,
  type CacheHitSavingsInput,
  type CacheHitSavingsResult,
} from "./cache-savings";
export {
  evaluateBudgetAlert,
  type BudgetAlertBasis,
  type BudgetAlertLevel,
  type BudgetAlertResult,
  type BudgetAlertState,
  type EvaluateBudgetAlertInput,
} from "./budget-alerts";

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

export type DeepSeekPriceLookupResult =
  | {
      ok: true;
      quote: DeepSeekRateQuote;
    }
  | {
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

export type XaiPriceLookupResult =
  | { ok: true; quote: XaiRateQuote }
  | { ok: false; reason: "model_not_found"; model: string; pricingZone: "unknown"; priceVersion: string; source: string };

export interface XaiPriceDirectory {
  provider: typeof XAI_PROVIDER;
  priceVersion: string;
  source: string;
  listModels(): XaiModelId[];
  lookup(input: { model: string; inputTokens?: number | bigint | undefined }): XaiPriceLookupResult;
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

export function createProviderBillingRegistry(
  options: { adapters?: readonly ProviderBillingAdapter[] | undefined } = {},
): ProviderBillingRegistry {
  const adapters = Object.freeze([
    ...(options.adapters ?? []),
    createBuiltInProviderBillingAdapter("deepseek"),
    createBuiltInProviderBillingAdapter("xai"),
    createAdditionalCatalogBillingAdapter(),
  ]);
  const resolve = (input: ProviderBillingMatch): ProviderBillingAdapter | undefined =>
    adapters.find((adapter) => adapter.supports(input));

  return {
    resolve,
    calculate(input) {
      const adapter = resolve(input);
      if (adapter) return adapter.calculate(input);
      return calculateProviderUsageCost({
        provider: input.provider,
        model: input.model,
        usage: input.usage,
        requestOutcome: input.requestOutcome,
      });
    },
    listAdapters: () => adapters,
  };
}

function createBuiltInProviderBillingAdapter(kind: "deepseek" | "xai"): ProviderBillingAdapter {
  return {
    id: kind,
    supports: (input) => resolveProviderBillingKind(input) === kind,
    calculate: (input) => {
      const result = kind === "deepseek"
        ? calculateDeepSeekUsageCost({
          model: input.model,
          requestStartedAt: input.requestStartedAt,
          usage: input.usage,
          requestOutcome: input.requestOutcome,
        })
        : calculateXaiUsageCost({
          model: input.model,
          usage: input.usage,
          requestOutcome: input.requestOutcome,
        });
      return { ...result, provider: input.provider };
    },
  };
}

function createAdditionalCatalogBillingAdapter(): ProviderBillingAdapter {
  return {
    id: "catalog",
    supports: (input) => {
      const kind = resolveProviderBillingKind(input);
      return kind !== null && kind !== "deepseek" && kind !== "xai";
    },
    calculate: (input) => calculateProviderUsageCost({
      provider: input.provider,
      model: input.model,
      usage: input.usage,
      requestOutcome: input.requestOutcome,
    }),
  };
}

function resolveProviderBillingKind(input: ProviderBillingMatch): PricingCatalogKind | null {
  return resolvePricingCatalogKind(input.provider, input.model);
}

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

export function createDeepSeekPriceDirectory(
  options: {
    priceVersion?: string | undefined;
    source?: string | undefined;
  } = {},
): DeepSeekPriceDirectory {
  const priceVersion = options.priceVersion ?? DEEPSEEK_PRICE_VERSION;
  const source = options.source ?? DEEPSEEK_PRICING_SOURCE;

  return {
    provider: DEEPSEEK_PROVIDER,
    priceVersion,
    source,
    listModels: () => Object.keys(DEEPSEEK_PRICE_TABLE) as DeepSeekModelId[],
    lookup: (input) => {
      const pricingZone =
        input.pricingZone && input.pricingZone !== "unknown"
          ? input.pricingZone
          : resolveDeepSeekPricingZone(input.requestStartedAt);
      const modelId = resolveDeepSeekModelId(input.model);
      const table = modelId ? DEEPSEEK_PRICE_TABLE[modelId] : undefined;
      if (!table) {
        return {
          ok: false,
          reason: "model_not_found",
          model: input.model,
          pricingZone,
          priceVersion,
          source,
        };
      }
      const rates = table[pricingZone];
      if (!rates) {
        return {
          ok: false,
          reason: "rate_not_found",
          model: input.model,
          pricingZone,
          priceVersion,
          source,
        };
      }
      return {
        ok: true,
        quote: {
          provider: DEEPSEEK_PROVIDER,
          model: input.model,
          pricingZone,
          priceVersion,
          source,
          currency: "CNY",
          cacheHitMinorPerMillionTokens: rates.cacheHitMicroCnyPerMillionTokens,
          cacheMissMinorPerMillionTokens: rates.cacheMissMicroCnyPerMillionTokens,
          outputMinorPerMillionTokens: rates.outputMicroCnyPerMillionTokens,
          ...rates,
        },
      };
    },
  };
}

/**
 * xAI official Text API snapshot. The legacy CNY fields are retained for
 * compatibility, while native USD rates are exposed for source-currency UI.
 */
export function createXaiPriceDirectory(
  options: { priceVersion?: string | undefined; source?: string | undefined } = {},
): XaiPriceDirectory {
  const priceVersion = options.priceVersion ?? XAI_PRICE_VERSION;
  const source = options.source ?? XAI_PRICING_SOURCE;
  return {
    provider: XAI_PROVIDER,
    priceVersion,
    source,
    listModels: () => Object.keys(XAI_PRICE_TABLE_USD) as XaiModelId[],
    lookup: (input) => {
      const model = resolveXaiModelId(input.model);
      const rateCard = model ? XAI_PRICE_TABLE_USD[model] : undefined;
      if (!rateCard) {
        return { ok: false, reason: "model_not_found", model: input.model, pricingZone: "unknown", priceVersion, source };
      }
      const inputTokens = typeof input.inputTokens === "bigint" ? input.inputTokens : BigInt(input.inputTokens ?? 0);
      const longContext = inputTokens >= BigInt(rateCard.longContextThresholdTokens);
      const rates = longContext ? rateCard.long : rateCard.short;
      return {
        ok: true,
        quote: {
          provider: XAI_PROVIDER,
          model: input.model,
          pricingZone: "unknown",
          priceVersion,
          source,
          rateTier: longContext ? "long_context" : "short_context",
          currency: "USD",
          cacheHitMinorPerMillionTokens: usdToMicroUsd(rates.cachedInput),
          cacheMissMinorPerMillionTokens: usdToMicroUsd(rates.input),
          outputMinorPerMillionTokens: usdToMicroUsd(rates.output),
          cacheMissMicroCnyPerMillionTokens: usdToMicroCny(rates.input),
          cacheHitMicroCnyPerMillionTokens: usdToMicroCny(rates.cachedInput),
          outputMicroCnyPerMillionTokens: usdToMicroCny(rates.output),
        },
      };
    },
  };
}

function fallbackDeepSeekModelId(model: string): DeepSeekModelId {
  const normalized = model.trim().toLowerCase();
  return /reasoner|reasoning|think|r1|pro/.test(normalized)
    ? "deepseek-v4-pro"
    : "deepseek-v4-flash";
}

export const createPriceDirectory = createDeepSeekPriceDirectory;
export const createDeepSeekPricingDirectory = createDeepSeekPriceDirectory;

export function resolveDeepSeekPricingZone(requestStartedAt: DateInput): Exclude<PricingZone, "unknown"> {
  const startedAt = toValidDate(requestStartedAt);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(startedAt);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const minutes = hour * 60 + minute;

  if (isInMinutesRange(minutes, 9 * 60, 12 * 60) || isInMinutesRange(minutes, 14 * 60, 18 * 60)) {
    return "peak";
  }
  return "offpeak";
}

export const resolvePricingZone = resolveDeepSeekPricingZone;
export const getPricingZone = resolveDeepSeekPricingZone;

export function calculateDeepSeekUsageCost(input: CalculateDeepSeekUsageCostInput): DeepSeekUsageCostResult {
  const directory = input.priceDirectory ?? createDeepSeekPriceDirectory();
  const quoteResult = directory.lookup({
    model: input.model,
    requestStartedAt: input.requestStartedAt,
    pricingZone: input.pricingZone,
  });

  const normalizedUsage = normalizeTokenUsage(input.usage ?? {});
  const usage = normalizedUsage.ok
    ? normalizedUsage
    : { ok: true as const, usage: emptyTokenUsage() };
  const hasInvalidUsage = !normalizedUsage.ok;

  const quote = quoteResult.ok
    ? quoteResult.quote
    : fallbackQuote(directory, input.model, quoteResult.pricingZone, input.requestStartedAt);
  const hasFallbackRate = !quoteResult.ok;
  const cacheHitMicroCny = priceTokens(usage.usage.cacheHitTokens, quote.cacheHitMicroCnyPerMillionTokens);
  const cacheMissMicroCny = priceTokens(usage.usage.cacheMissTokens, quote.cacheMissMicroCnyPerMillionTokens);
  const outputMicroCny = priceTokens(usage.usage.outputTokens, quote.outputMicroCnyPerMillionTokens);
  const cacheHitMinor = priceTokens(usage.usage.cacheHitTokens, quote.cacheHitMinorPerMillionTokens);
  const cacheMissMinor = priceTokens(usage.usage.cacheMissTokens, quote.cacheMissMinorPerMillionTokens);
  const outputMinor = priceTokens(usage.usage.outputTokens, quote.outputMinorPerMillionTokens);

  return {
    provider: DEEPSEEK_PROVIDER,
    model: input.model,
    status: input.requestOutcome === "failed" || input.requestOutcome === "aborted"
      ? "failed"
      : input.usage && !hasFallbackRate && !hasInvalidUsage
        ? "settled"
        : "estimated",
    source: "final_usage",
    priceSource: quote.source,
    pricingZone: quote.pricingZone,
    priceVersion: quote.priceVersion,
    amountMicroCny: cacheHitMicroCny + cacheMissMicroCny + outputMicroCny,
    cacheHitMicroCny,
    cacheMissMicroCny,
    outputMicroCny,
    cacheHitRateMicroCnyPerMillionTokens: quote.cacheHitMicroCnyPerMillionTokens,
    cacheMissRateMicroCnyPerMillionTokens: quote.cacheMissMicroCnyPerMillionTokens,
    outputRateMicroCnyPerMillionTokens: quote.outputMicroCnyPerMillionTokens,
    currency: quote.currency,
    amountMinor: cacheHitMinor + cacheMissMinor + outputMinor,
    cacheHitMinor,
    cacheMissMinor,
    outputMinor,
    cacheHitRateMinorPerMillionTokens: quote.cacheHitMinorPerMillionTokens,
    cacheMissRateMinorPerMillionTokens: quote.cacheMissMinorPerMillionTokens,
    outputRateMinorPerMillionTokens: quote.outputMinorPerMillionTokens,
    cacheHitTokens: usage.usage.cacheHitTokens,
    cacheMissTokens: usage.usage.cacheMissTokens,
    outputTokens: usage.usage.outputTokens,
    reasoningTokens: usage.usage.reasoningTokens,
    reasoningTokensIncludedInOutput: true,
    requestOutcome: input.requestOutcome ?? "success",
    ...(hasInvalidUsage ? { unknownReason: "invalid_usage" as const } : {}),
  };
}

export const calculateCostBreakdown = calculateDeepSeekUsageCost;
export const calculateUsageCost = calculateDeepSeekUsageCost;

export function calculateXaiUsageCost(input: CalculateXaiUsageCostInput): XaiUsageCostResult {
  const directory = input.priceDirectory ?? createXaiPriceDirectory();
  const normalizedUsage = normalizeTokenUsage(input.usage ?? {});
  const usage = normalizedUsage.ok ? normalizedUsage : { ok: true as const, usage: emptyTokenUsage() };
  const hasInvalidUsage = !normalizedUsage.ok;
  const quoteResult = directory.lookup({
    model: input.model,
    inputTokens: usage.usage.cacheHitTokens + usage.usage.cacheMissTokens,
  });
  if (!quoteResult.ok) {
    return {
      provider: XAI_PROVIDER,
      model: input.model,
      status: input.requestOutcome === "failed" || input.requestOutcome === "aborted" ? "failed" : "unknown",
      source: "final_usage",
      priceSource: quoteResult.source,
      pricingZone: "unknown",
      priceVersion: quoteResult.priceVersion,
      amountMicroCny: 0n,
      cacheHitMicroCny: 0n,
      cacheMissMicroCny: 0n,
      outputMicroCny: 0n,
      cacheHitRateMicroCnyPerMillionTokens: 0n,
      cacheMissRateMicroCnyPerMillionTokens: 0n,
      outputRateMicroCnyPerMillionTokens: 0n,
      currency: "USD",
      amountMinor: 0n,
      cacheHitMinor: 0n,
      cacheMissMinor: 0n,
      outputMinor: 0n,
      cacheHitRateMinorPerMillionTokens: 0n,
      cacheMissRateMinorPerMillionTokens: 0n,
      outputRateMinorPerMillionTokens: 0n,
      cacheHitTokens: usage.usage.cacheHitTokens,
      cacheMissTokens: usage.usage.cacheMissTokens,
      outputTokens: usage.usage.outputTokens,
      reasoningTokens: usage.usage.reasoningTokens,
      reasoningTokensIncludedInOutput: true,
      requestOutcome: input.requestOutcome ?? "success",
      unknownReason: "model_not_found",
    };
  }

  const quote = quoteResult.quote;
  const cacheHitMicroCny = priceTokens(usage.usage.cacheHitTokens, quote.cacheHitMicroCnyPerMillionTokens);
  const cacheMissMicroCny = priceTokens(usage.usage.cacheMissTokens, quote.cacheMissMicroCnyPerMillionTokens);
  const outputMicroCny = priceTokens(usage.usage.outputTokens, quote.outputMicroCnyPerMillionTokens);
  const cacheHitMinor = priceTokens(usage.usage.cacheHitTokens, quote.cacheHitMinorPerMillionTokens);
  const cacheMissMinor = priceTokens(usage.usage.cacheMissTokens, quote.cacheMissMinorPerMillionTokens);
  const outputMinor = priceTokens(usage.usage.outputTokens, quote.outputMinorPerMillionTokens);
  return {
    provider: XAI_PROVIDER,
    model: input.model,
    status: input.requestOutcome === "failed" || input.requestOutcome === "aborted"
      ? "failed"
      : input.usage && !hasInvalidUsage ? "settled" : "estimated",
    source: "final_usage",
    priceSource: quote.source,
    pricingZone: quote.pricingZone,
    priceVersion: quote.priceVersion,
    amountMicroCny: cacheHitMicroCny + cacheMissMicroCny + outputMicroCny,
    cacheHitMicroCny,
    cacheMissMicroCny,
    outputMicroCny,
    cacheHitRateMicroCnyPerMillionTokens: quote.cacheHitMicroCnyPerMillionTokens,
    cacheMissRateMicroCnyPerMillionTokens: quote.cacheMissMicroCnyPerMillionTokens,
    outputRateMicroCnyPerMillionTokens: quote.outputMicroCnyPerMillionTokens,
    currency: quote.currency,
    amountMinor: cacheHitMinor + cacheMissMinor + outputMinor,
    cacheHitMinor,
    cacheMissMinor,
    outputMinor,
    cacheHitRateMinorPerMillionTokens: quote.cacheHitMinorPerMillionTokens,
    cacheMissRateMinorPerMillionTokens: quote.cacheMissMinorPerMillionTokens,
    outputRateMinorPerMillionTokens: quote.outputMinorPerMillionTokens,
    cacheHitTokens: usage.usage.cacheHitTokens,
    cacheMissTokens: usage.usage.cacheMissTokens,
    outputTokens: usage.usage.outputTokens,
    reasoningTokens: usage.usage.reasoningTokens,
    reasoningTokensIncludedInOutput: true,
    requestOutcome: input.requestOutcome ?? "success",
    ...(hasInvalidUsage ? { unknownReason: "invalid_usage" as const } : {}),
  };
}

/** Calculate a usage cost from one of the additional provider snapshots. */
export function calculateProviderUsageCost(input: CalculateProviderUsageCostInput): ProviderUsageCostResult {
  const providerId = input.provider.trim().toLowerCase();
  const normalizedUsage = normalizeTokenUsage(input.usage ?? {});
  const usage = normalizedUsage.ok ? normalizedUsage.usage : emptyTokenUsage();
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0n;
  const pricingProvider = resolveAdditionalPricingCatalogKind(providerId, input.model) ?? providerId;
  const catalog = getAdditionalPricingCatalog(pricingProvider);
  const quote = lookupAdditionalPrice(
    pricingProvider,
    input.model,
    usage.cacheHitTokens + usage.cacheMissTokens + cacheWriteTokens,
  );
  if (!quote) {
    return {
      provider: input.provider,
      model: input.model,
      status: input.requestOutcome === "failed" || input.requestOutcome === "aborted" ? "failed" : "unknown",
      source: "final_usage",
      priceSource: catalog?.source ?? "",
      pricingZone: "unknown",
      priceVersion: catalog?.priceVersion ?? "",
      amountMicroCny: 0n,
      cacheHitMicroCny: 0n,
      cacheMissMicroCny: 0n,
      outputMicroCny: 0n,
      cacheHitRateMicroCnyPerMillionTokens: 0n,
      cacheMissRateMicroCnyPerMillionTokens: 0n,
      outputRateMicroCnyPerMillionTokens: 0n,
      currency: "USD",
      amountMinor: 0n,
      cacheHitMinor: 0n,
      cacheMissMinor: 0n,
      outputMinor: 0n,
      cacheHitRateMinorPerMillionTokens: 0n,
      cacheMissRateMinorPerMillionTokens: 0n,
      outputRateMinorPerMillionTokens: 0n,
      cacheHitTokens: usage.cacheHitTokens,
      cacheMissTokens: usage.cacheMissTokens + cacheWriteTokens,
      ...(cacheWriteTokens > 0n ? { cacheWriteTokens } : {}),
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.reasoningTokens,
      reasoningTokensIncludedInOutput: true,
      requestOutcome: input.requestOutcome ?? "success",
      unknownReason: "model_not_found",
    };
  }

  const cacheHitMicroCny = priceTokens(usage.cacheHitTokens, quote.rates.cacheHitMicroCnyPerMillionTokens);
  const cacheWriteRate = quote.rates.cacheWriteMicroCnyPerMillionTokens ?? quote.rates.cacheMissMicroCnyPerMillionTokens;
  const cacheWriteMicroCny = priceTokens(cacheWriteTokens, cacheWriteRate);
  const cacheMissMicroCny = priceTokens(usage.cacheMissTokens, quote.rates.cacheMissMicroCnyPerMillionTokens) + cacheWriteMicroCny;
  const displayedCacheMissTokens = usage.cacheMissTokens + cacheWriteTokens;
  const displayedCacheMissRate = displayedCacheMissTokens > 0n
    ? (cacheMissMicroCny * 1_000_000n + displayedCacheMissTokens / 2n) / displayedCacheMissTokens
    : quote.rates.cacheMissMicroCnyPerMillionTokens;
  const outputMicroCny = priceTokens(usage.outputTokens, quote.rates.outputMicroCnyPerMillionTokens);
  const cacheHitMinor = priceTokens(usage.cacheHitTokens, quote.nativeRates.cacheHitMinorPerMillionTokens);
  const cacheWriteMinor = priceTokens(
    cacheWriteTokens,
    quote.nativeRates.cacheWriteMinorPerMillionTokens ?? quote.nativeRates.cacheMissMinorPerMillionTokens,
  );
  const cacheMissMinor = priceTokens(usage.cacheMissTokens, quote.nativeRates.cacheMissMinorPerMillionTokens) + cacheWriteMinor;
  const displayedCacheMissMinorTokens = displayedCacheMissTokens;
  const displayedCacheMissRateMinor = displayedCacheMissMinorTokens > 0n
    ? (cacheMissMinor * 1_000_000n + displayedCacheMissMinorTokens / 2n) / displayedCacheMissMinorTokens
    : quote.nativeRates.cacheMissMinorPerMillionTokens;
  const outputMinor = priceTokens(usage.outputTokens, quote.nativeRates.outputMinorPerMillionTokens);
  const hasInvalidUsage = !normalizedUsage.ok;
  return {
    provider: input.provider,
    model: input.model,
    status: input.requestOutcome === "failed" || input.requestOutcome === "aborted"
      ? "failed"
      : input.usage && !hasInvalidUsage ? "settled" : "estimated",
    source: "final_usage",
    priceSource: quote.source,
    pricingZone: quote.pricingZone,
    priceVersion: quote.priceVersion,
    amountMicroCny: cacheHitMicroCny + cacheMissMicroCny + outputMicroCny,
    cacheHitMicroCny,
    cacheMissMicroCny,
    outputMicroCny,
    cacheHitRateMicroCnyPerMillionTokens: quote.rates.cacheHitMicroCnyPerMillionTokens,
    cacheMissRateMicroCnyPerMillionTokens: displayedCacheMissRate,
    outputRateMicroCnyPerMillionTokens: quote.rates.outputMicroCnyPerMillionTokens,
    currency: quote.currency,
    amountMinor: cacheHitMinor + cacheMissMinor + outputMinor,
    cacheHitMinor,
    cacheMissMinor,
    outputMinor,
    cacheHitRateMinorPerMillionTokens: quote.nativeRates.cacheHitMinorPerMillionTokens,
    cacheMissRateMinorPerMillionTokens: displayedCacheMissRateMinor,
    outputRateMinorPerMillionTokens: quote.nativeRates.outputMinorPerMillionTokens,
    cacheHitTokens: usage.cacheHitTokens,
    cacheMissTokens: displayedCacheMissTokens,
    ...(cacheWriteTokens > 0n ? { cacheWriteTokens } : {}),
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    reasoningTokensIncludedInOutput: true,
    requestOutcome: input.requestOutcome ?? "success",
    ...(hasInvalidUsage ? { unknownReason: "invalid_usage" as const } : {}),
  };
}

export function estimateProviderCostEvent(input: EstimateProviderCostEventInput): CostEvent {
  const result = calculateProviderUsageCost({
    provider: input.provider,
    model: input.model,
    usage: input.usageProjection ?? {},
  });
  return buildCostEvent(input, result, "stream", "estimated");
}

export function finalizeProviderCostEvent(input: FinalizeProviderCostEventInput): CostEvent {
  if (!input.usage && input.previousEvent && input.previousEvent.status !== "unknown") {
    const previous = input.previousEvent;
    const outcome = input.requestOutcome ?? previous.requestOutcome;
    return {
      ...previous,
      id: input.id,
      eventKey: createCostEventKey(input),
      sessionId: input.sessionId,
      turnId: input.turnId,
      stepId: input.stepId,
      attemptId: input.attemptId,
      provider: input.provider,
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      agentPreset: input.agentPreset,
      parentSessionId: input.parentSessionId,
      requestStartedAt: toIsoString(input.requestStartedAt),
      completedAt: input.completedAt ? toIsoString(input.completedAt) : previous.completedAt,
      status: outcome === "failed" || outcome === "aborted" ? "failed" : "estimated",
      source: previous.source === "stream" ? "stream" : "final_usage",
      requestOutcome: outcome,
      correctionOfEventId: previous.id,
      unknownReason: undefined,
    };
  }

  const result = calculateProviderUsageCost({
    provider: input.provider,
    model: input.model,
    usage: input.usage,
    requestOutcome: input.requestOutcome,
  });
  const finalEvent = buildCostEvent(
    input,
    !input.usage && result.status === "settled" ? { ...result, status: "estimated" } : result,
    "final_usage",
    !input.usage && result.status === "settled" ? "estimated" : result.status,
  );
  return input.previousEvent ? { ...finalEvent, correctionOfEventId: input.previousEvent.id } : finalEvent;
}

export function estimateXaiCostEvent(input: EstimateXaiCostEventInput): CostEvent {
  const result = calculateXaiUsageCost({
    model: input.model,
    usage: input.usageProjection ?? {},
    priceDirectory: input.priceDirectory,
  });
  return buildCostEvent(input, result, "stream", "estimated");
}

export function finalizeXaiCostEvent(input: FinalizeXaiCostEventInput): CostEvent {
  if (!input.usage && input.previousEvent && input.previousEvent.status !== "unknown") {
    const previous = input.previousEvent;
    const outcome = input.requestOutcome ?? previous.requestOutcome;
    return {
      ...previous,
      id: input.id,
      eventKey: createCostEventKey(input),
      sessionId: input.sessionId,
      turnId: input.turnId,
      stepId: input.stepId,
      attemptId: input.attemptId,
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      agentPreset: input.agentPreset,
      parentSessionId: input.parentSessionId,
      requestStartedAt: toIsoString(input.requestStartedAt),
      completedAt: input.completedAt ? toIsoString(input.completedAt) : previous.completedAt,
      status: outcome === "failed" || outcome === "aborted" ? "failed" : "estimated",
      source: previous.source === "stream" ? "stream" : "final_usage",
      requestOutcome: outcome,
      correctionOfEventId: previous.id,
      unknownReason: undefined,
    };
  }

  const result = calculateXaiUsageCost({
    model: input.model,
    usage: input.usage,
    priceDirectory: input.priceDirectory,
    requestOutcome: input.requestOutcome,
  });
  const finalEvent = buildCostEvent(
    input,
    !input.usage && result.status === "settled" ? { ...result, status: "estimated" } : result,
    "final_usage",
    !input.usage && result.status === "settled" ? "estimated" : result.status,
  );
  return input.previousEvent ? { ...finalEvent, correctionOfEventId: input.previousEvent.id } : finalEvent;
}

export function classifyDeepSeekRequestCostStatus(input: {
  hasFinalUsage: boolean;
  hasReliableProjection: boolean;
  hasRate: boolean;
  requestOutcome?: CostRequestOutcome | undefined;
}): CostEventStatus {
  if (input.hasFinalUsage) {
    return input.requestOutcome === "failed" || input.requestOutcome === "aborted" || !input.hasRate
      ? input.hasRate ? "failed" : "estimated"
      : "settled";
  }
  return input.requestOutcome === "failed" || input.requestOutcome === "aborted" ? "failed" : "estimated";
}

export const decideCostEventStatus = classifyDeepSeekRequestCostStatus;
export const decideRequestCostStatus = classifyDeepSeekRequestCostStatus;

export function estimateDeepSeekCostEvent(input: EstimateDeepSeekCostEventInput): CostEvent {
  const result = calculateDeepSeekUsageCost({
    model: input.model,
    requestStartedAt: input.requestStartedAt,
    usage: input.usageProjection ?? {},
    priceDirectory: input.priceDirectory,
  });

  return buildCostEvent(input, { ...result, status: "estimated" }, "stream", "estimated");
}

export const estimateStreamingCostEvent = estimateDeepSeekCostEvent;
export const estimateCostEvent = estimateDeepSeekCostEvent;

export function finalizeDeepSeekCostEvent(input: FinalizeDeepSeekCostEventInput): CostEvent {
  if (!input.usage && input.previousEvent && input.previousEvent.status !== "unknown") {
    const previous = input.previousEvent;
    const outcome = input.requestOutcome ?? previous.requestOutcome;
    const status: CostEventStatus = outcome === "failed" || outcome === "aborted" ? "failed" : "estimated";
    return {
      ...previous,
      id: input.id,
      eventKey: createCostEventKey(input),
      sessionId: input.sessionId,
      turnId: input.turnId,
      stepId: input.stepId,
      attemptId: input.attemptId,
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      agentPreset: input.agentPreset,
      parentSessionId: input.parentSessionId,
      requestStartedAt: toIsoString(input.requestStartedAt),
      completedAt: input.completedAt ? toIsoString(input.completedAt) : previous.completedAt,
      status,
      source: previous.source === "stream" ? "stream" : "final_usage",
      requestOutcome: outcome,
      correctionOfEventId: previous.id,
      unknownReason: undefined,
    };
  }

  const result = calculateDeepSeekUsageCost({
    model: input.model,
    requestStartedAt: input.requestStartedAt,
    usage: input.usage,
    priceDirectory: input.priceDirectory,
    requestOutcome: input.requestOutcome,
  });

  const finalEvent = buildCostEvent(
    input,
    !input.usage && result.status === "settled" ? { ...result, status: "estimated" } : result,
    "final_usage",
    !input.usage && result.status === "settled" ? "estimated" : result.status,
  );
  if (!input.previousEvent) {
    return finalEvent;
  }

  const finalKey = createCostEventKey(input);
  if (input.previousEvent.eventKey !== finalKey) {
    throw new Error("previousEvent does not match final usage identity");
  }
  return {
    ...finalEvent,
    correctionOfEventId: input.previousEvent.id,
  };
}

/** Preserve usage for providers without a configured price directory without applying DeepSeek rates. */
export function createUnknownCostEvent(
  input: BuildCostEventInput,
  options: {
    source: CostEventSource;
    usage?: TokenUsageInput | undefined;
    requestOutcome?: CostRequestOutcome | undefined;
    previousEvent?: CostEvent | undefined;
    unknownReason?: CostUnknownReason | undefined;
  },
): CostEvent {
  const normalizedUsage = options.usage
    ? normalizeTokenUsage(options.usage)
    : options.previousEvent
      ? {
        ok: true as const,
        usage: {
          cacheHitTokens: options.previousEvent.cacheHitTokens,
          cacheMissTokens: options.previousEvent.cacheMissTokens,
          outputTokens: options.previousEvent.outputTokens,
          reasoningTokens: options.previousEvent.reasoningTokens,
        },
      }
      : { ok: true as const, usage: emptyTokenUsage() };
  const usage = normalizedUsage.ok ? normalizedUsage.usage : emptyTokenUsage();
  const event: CostEvent = {
    id: input.id,
    eventKey: createCostEventKey(input),
    sessionId: input.sessionId,
    turnId: input.turnId,
    stepId: input.stepId,
    attemptId: input.attemptId,
    provider: input.provider ?? "unknown",
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    agentPreset: input.agentPreset,
    parentSessionId: input.parentSessionId,
    requestStartedAt: toIsoString(input.requestStartedAt),
    completedAt: input.completedAt ? toIsoString(input.completedAt) : undefined,
    pricingZone: "unknown",
    priceVersion: "",
    amountMicroCny: 0n,
    cacheHitTokens: usage.cacheHitTokens,
    cacheMissTokens: usage.cacheMissTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    cacheHitMicroCny: 0n,
    cacheMissMicroCny: 0n,
    outputMicroCny: 0n,
    cacheHitRateMicroCnyPerMillionTokens: 0n,
    cacheMissRateMicroCnyPerMillionTokens: 0n,
    outputRateMicroCnyPerMillionTokens: 0n,
    reasoningTokensIncludedInOutput: true,
    status: "unknown",
    source: options.source,
    requestOutcome: options.requestOutcome ?? "success",
    unknownReason: options.unknownReason ?? "rate_not_found",
    ...(options.previousEvent ? { correctionOfEventId: options.previousEvent.id } : {}),
  };
  return event;
}

export const settleDeepSeekCostEvent = finalizeDeepSeekCostEvent;
export const finalizeCostEvent = finalizeDeepSeekCostEvent;

export function dedupeCostEvents(events: readonly CostEvent[]): CostEvent[] {
  const order: string[] = [];
  const byKey = new Map<string, CostEvent>();

  for (const event of events) {
    const key = event.eventKey || createCostEventKey(event);
    const normalized = event.eventKey === key ? event : { ...event, eventKey: key };
    if (!byKey.has(key)) {
      order.push(key);
      byKey.set(key, normalized);
      continue;
    }

    const current = byKey.get(key);
    if (!current || shouldReplaceCostEvent(current, normalized)) {
      byKey.set(key, normalized);
    }
  }

  return order.map((key) => byKey.get(key)).filter((event): event is CostEvent => Boolean(event));
}

export const dedupeByCostEventKey = dedupeCostEvents;
export const collapseCostEvents = dedupeCostEvents;

export function aggregateCostEvents(events: readonly CostEvent[]): CostAggregate {
  const aggregate: CostAggregate = {
    global: createEmptyAggregateBucket(),
    sessions: new Map(),
    days: new Map(),
  };

  for (const event of dedupeCostEvents(events)) {
    applyEventToBucket(aggregate.global, event);
    applyEventToBucket(getOrCreateBucket(aggregate.sessions, event.sessionId), event);
    applyEventToBucket(getOrCreateBucket(aggregate.days, getUtcDayKey(event.requestStartedAt)), event);
  }

  return aggregate;
}

export function createCostEventJournal(initialEvents: readonly CostEvent[] = []): CostEventJournal {
  const order: string[] = [];
  const byKey = new Map<string, CostEvent>();
  for (const event of dedupeCostEvents(initialEvents)) {
    order.push(event.eventKey);
    byKey.set(event.eventKey, event);
  }

  const list = (): CostEvent[] => order
    .map((key) => byKey.get(key))
    .filter((event): event is CostEvent => Boolean(event));

  return {
    upsert: (event) => {
      const key = event.eventKey || createCostEventKey(event);
      const normalized = event.eventKey === key ? event : { ...event, eventKey: key };
      const current = byKey.get(key);
      if (!current) {
        order.push(key);
        byKey.set(key, normalized);
      } else if (shouldReplaceCostEvent(current, normalized)) {
        byKey.set(key, normalized);
      }
      return byKey.get(key)!;
    },
    getByKey: (eventKey) => byKey.get(eventKey),
    list,
    aggregate: () => aggregateCostEvents(list()),
  };
}

function emptyTokenUsage(): CostTokenUsage {
  return {
    cacheHitTokens: 0n,
    cacheMissTokens: 0n,
    outputTokens: 0n,
    reasoningTokens: 0n,
  };
}

function fallbackQuote(
  directory: DeepSeekPriceDirectory,
  model: string,
  pricingZone: PricingZone,
  requestStartedAt: DateInput,
): DeepSeekRateQuote {
  const fallbackModel = fallbackDeepSeekModelId(model);
  const fallbackDirectory = createDeepSeekPriceDirectory();
  const result = fallbackDirectory.lookup({
    model: fallbackModel,
    requestStartedAt,
    pricingZone,
  });
  if (result.ok) {
    return {
      ...result.quote,
      model,
      priceVersion: directory.priceVersion,
      source: directory.source,
    };
  }
  throw new Error("default DeepSeek fallback rate is unavailable");
}

function buildCostEvent(
  input: Omit<BuildCostEventInput, "priceDirectory">,
  result: {
    provider: string;
    status?: CostEventStatus | undefined;
    pricingZone: PricingZone;
    priceVersion: string;
    amountMicroCny: MoneyMicroCny;
    cacheHitTokens: TokenCount;
    cacheMissTokens: TokenCount;
    cacheWriteTokens?: TokenCount | undefined;
    outputTokens: TokenCount;
    reasoningTokens: TokenCount;
    cacheHitMicroCny: MoneyMicroCny;
    cacheMissMicroCny: MoneyMicroCny;
    outputMicroCny: MoneyMicroCny;
    cacheHitRateMicroCnyPerMillionTokens: MoneyMicroCny;
    cacheMissRateMicroCnyPerMillionTokens: MoneyMicroCny;
    outputRateMicroCnyPerMillionTokens: MoneyMicroCny;
    currency?: CostCurrency | undefined;
    amountMinor?: MoneyMinor | undefined;
    cacheHitMinor?: MoneyMinor | undefined;
    cacheMissMinor?: MoneyMinor | undefined;
    outputMinor?: MoneyMinor | undefined;
    cacheHitRateMinorPerMillionTokens?: MoneyMinor | undefined;
    cacheMissRateMinorPerMillionTokens?: MoneyMinor | undefined;
    outputRateMinorPerMillionTokens?: MoneyMinor | undefined;
    requestOutcome?: CostRequestOutcome | undefined;
    unknownReason?: CostUnknownReason | undefined;
  },
  source: CostEventSource,
  status: CostEventStatus,
): CostEvent {
  return {
    id: input.id,
    eventKey: createCostEventKey(input),
    sessionId: input.sessionId,
    turnId: input.turnId,
    stepId: input.stepId,
    attemptId: input.attemptId,
    provider: result.provider === DEEPSEEK_PROVIDER ? DEEPSEEK_PROVIDER : input.provider ?? result.provider,
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    agentPreset: input.agentPreset,
    parentSessionId: input.parentSessionId,
    requestStartedAt: toIsoString(input.requestStartedAt),
    completedAt: input.completedAt ? toIsoString(input.completedAt) : undefined,
    pricingZone: result.pricingZone,
    priceVersion: result.priceVersion,
    amountMicroCny: result.amountMicroCny,
    cacheHitTokens: result.cacheHitTokens,
    cacheMissTokens: result.cacheMissTokens,
    ...(result.cacheWriteTokens !== undefined ? { cacheWriteTokens: result.cacheWriteTokens } : {}),
    outputTokens: result.outputTokens,
    reasoningTokens: result.reasoningTokens,
    cacheHitMicroCny: result.cacheHitMicroCny,
    cacheMissMicroCny: result.cacheMissMicroCny,
    outputMicroCny: result.outputMicroCny,
    cacheHitRateMicroCnyPerMillionTokens: result.cacheHitRateMicroCnyPerMillionTokens,
    cacheMissRateMicroCnyPerMillionTokens: result.cacheMissRateMicroCnyPerMillionTokens,
    outputRateMicroCnyPerMillionTokens: result.outputRateMicroCnyPerMillionTokens,
    ...(result.currency ? { currency: result.currency } : {}),
    ...(result.amountMinor !== undefined ? { amountMinor: result.amountMinor } : {}),
    ...(result.cacheHitMinor !== undefined ? { cacheHitMinor: result.cacheHitMinor } : {}),
    ...(result.cacheMissMinor !== undefined ? { cacheMissMinor: result.cacheMissMinor } : {}),
    ...(result.outputMinor !== undefined ? { outputMinor: result.outputMinor } : {}),
    ...(result.cacheHitRateMinorPerMillionTokens !== undefined ? { cacheHitRateMinorPerMillionTokens: result.cacheHitRateMinorPerMillionTokens } : {}),
    ...(result.cacheMissRateMinorPerMillionTokens !== undefined ? { cacheMissRateMinorPerMillionTokens: result.cacheMissRateMinorPerMillionTokens } : {}),
    ...(result.outputRateMinorPerMillionTokens !== undefined ? { outputRateMinorPerMillionTokens: result.outputRateMinorPerMillionTokens } : {}),
    reasoningTokensIncludedInOutput: true,
    status,
    source,
    requestOutcome: result.requestOutcome,
    unknownReason: result.unknownReason,
  };
}

function normalizeTokenUsage(usage: TokenUsageInput): { ok: true; usage: CostTokenUsage } | { ok: false } {
  try {
    const cacheHitTokens =
      firstTokenCount([
        usage.cacheHitTokens,
        usage.promptCacheHitTokens,
        usage.prompt_cache_hit_tokens,
        usage.cachedTokens,
        usage.prompt_tokens_details?.cached_tokens,
      ]) ?? 0n;
    const explicitCacheMissTokens = firstTokenCount([
      usage.cacheMissTokens,
      usage.promptCacheMissTokens,
      usage.prompt_cache_miss_tokens,
    ]);
    const cacheWriteTokens = firstTokenCount([usage.cacheWriteTokens, usage.cache_write_tokens]) ?? 0n;
    const promptTokens = firstTokenCount([usage.promptTokens, usage.prompt_tokens]);
    const cacheMissTokens =
      explicitCacheMissTokens ??
      (promptTokens !== undefined ? (promptTokens > cacheHitTokens ? promptTokens - cacheHitTokens : 0n) : 0n);
    const outputTokens = firstTokenCount([usage.outputTokens, usage.completionTokens, usage.completion_tokens]) ?? 0n;
    const reasoningTokens =
      firstTokenCount([usage.reasoningTokens, usage.reasoning_tokens, usage.completion_tokens_details?.reasoning_tokens]) ??
      0n;

    return {
      ok: true,
      usage: {
        cacheHitTokens,
        cacheMissTokens,
        ...(cacheWriteTokens > 0n ? { cacheWriteTokens } : {}),
        outputTokens,
        reasoningTokens,
      },
    };
  } catch {
    return { ok: false };
  }
}

function firstTokenCount(values: Array<number | bigint | undefined>): bigint | undefined {
  for (const value of values) {
    if (value !== undefined) {
      return toTokenCount(value);
    }
  }
  return undefined;
}

function toTokenCount(value: number | bigint): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error("token count must not be negative");
    }
    return value;
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("token count must be a non-negative safe integer");
  }
  return BigInt(value);
}

function priceTokens(tokens: TokenCount, microCnyPerMillionTokens: MoneyMicroCny): MoneyMicroCny {
  return roundDiv(tokens * microCnyPerMillionTokens, TOKENS_PER_MILLION);
}

function roundDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor / 2n) / divisor;
}

function isInMinutesRange(value: number, startInclusive: number, endExclusive: number): boolean {
  return value >= startInclusive && value < endExclusive;
}

function toValidDate(input: DateInput): Date {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid date input");
  }
  return date;
}

function toIsoString(input: DateInput): string {
  return toValidDate(input).toISOString();
}

function shouldReplaceCostEvent(existing: CostEvent, next: CostEvent): boolean {
  const statusDelta = statusPriority(next.status) - statusPriority(existing.status);
  if (statusDelta !== 0) {
    return statusDelta > 0;
  }
  const sourceDelta = sourcePriority(next.source) - sourcePriority(existing.source);
  if (sourceDelta !== 0) {
    return sourceDelta > 0;
  }
  if (next.status === "estimated" && next.amountMicroCny !== existing.amountMicroCny) {
    return next.amountMicroCny > existing.amountMicroCny;
  }

  const existingTime = Date.parse(existing.completedAt ?? existing.requestStartedAt);
  const nextTime = Date.parse(next.completedAt ?? next.requestStartedAt);
  if (Number.isFinite(existingTime) && Number.isFinite(nextTime) && existingTime !== nextTime) {
    return nextTime > existingTime;
  }
  return true;
}

function statusPriority(status: CostEventStatus): number {
  switch (status) {
    case "settled":
      return 4;
    case "failed":
      return 3;
    case "estimated":
      return 2;
    case "unknown":
      return 1;
  }
}

function sourcePriority(source: CostEventSource): number {
  switch (source) {
    case "final_usage":
      return 3;
    case "restored":
      return 2;
    case "stream":
      return 1;
  }
}

function getOrCreateBucket(map: Map<string, CostAggregateBucket>, key: string): CostAggregateBucket {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const created = createEmptyAggregateBucket();
  map.set(key, created);
  return created;
}

function applyEventToBucket(bucket: CostAggregateBucket, event: CostEvent): void {
  bucket.eventCount += 1;
  updateActivityRange(bucket, event);
  if (event.status === "unknown") {
    bucket.unknownCount += 1;
    return;
  }

  bucket.totalMicroCny += event.amountMicroCny;
  bucket.cacheHitTokens += event.cacheHitTokens;
  bucket.cacheMissTokens += event.cacheMissTokens;
  bucket.outputTokens += event.outputTokens;
  bucket.reasoningTokens += event.reasoningTokens;

  if (event.status === "settled") {
    bucket.settledMicroCny += event.amountMicroCny;
  } else if (event.status === "estimated") {
    bucket.estimatedMicroCny += event.amountMicroCny;
  } else if (event.status === "failed") {
    bucket.failedMicroCny += event.amountMicroCny;
  }

  if (event.pricingZone === "peak") {
    bucket.peakMicroCny += event.amountMicroCny;
  } else if (event.pricingZone === "offpeak") {
    bucket.offpeakMicroCny += event.amountMicroCny;
  }
}

function updateActivityRange(bucket: CostAggregateBucket, event: CostEvent): void {
  const start = event.requestStartedAt;
  const last = event.completedAt ?? event.requestStartedAt;
  if (!bucket.firstActivityAt || Date.parse(start) < Date.parse(bucket.firstActivityAt)) {
    bucket.firstActivityAt = start;
  }
  if (!bucket.lastActivityAt || Date.parse(last) > Date.parse(bucket.lastActivityAt)) {
    bucket.lastActivityAt = last;
  }
}

function getUtcDayKey(dateInput: DateInput): string {
  return toIsoString(dateInput).slice(0, 10);
}
