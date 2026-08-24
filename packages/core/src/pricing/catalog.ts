import type { CnyTokenRates, UsdTokenRates, UsdTokenRatesInMinor } from "./common";
import { usdRatesToCny, usdRatesToMicroUsd } from "./common";
import {
  ANTHROPIC_MODEL_ALIASES,
  ANTHROPIC_PRICE_TABLE_USD,
  ANTHROPIC_PRICING_SOURCE,
  ANTHROPIC_PRICE_VERSION,
  ANTHROPIC_PROVIDER,
} from "./anthropic";
import {
  CEREBRAS_PRICE_TABLE_USD,
  CEREBRAS_PRICING_SOURCE,
  CEREBRAS_PRICE_VERSION,
  CEREBRAS_PROVIDER,
} from "./cerebras";
import {
  FIREWORKS_PRICE_TABLE_USD,
  FIREWORKS_PRICING_SOURCE,
  FIREWORKS_PRICE_VERSION,
  FIREWORKS_PROVIDER,
} from "./fireworks";
import { GROQ_PRICE_TABLE_USD, GROQ_PRICING_SOURCE, GROQ_PRICE_VERSION, GROQ_PROVIDER } from "./groq";
import { GOOGLE_MODEL_ALIASES, GOOGLE_PRICE_TABLE_USD, GOOGLE_PRICING_SOURCE, GOOGLE_PRICE_VERSION, GOOGLE_PROVIDER } from "./google";
import { MINIMAX_PRICE_TABLE_USD, MINIMAX_PRICING_SOURCE, MINIMAX_PRICE_VERSION, MINIMAX_PROVIDER } from "./minimax";
import { MISTRAL_PRICE_TABLE_USD, MISTRAL_PRICING_SOURCE, MISTRAL_PRICE_VERSION, MISTRAL_PROVIDER } from "./mistral";
import {
  MOONSHOTAI_MODEL_ALIASES,
  MOONSHOTAI_PRICE_TABLE_USD,
  MOONSHOTAI_PRICING_SOURCE,
  MOONSHOTAI_PRICE_VERSION,
  MOONSHOTAI_PROVIDER,
} from "./moonshotai";
import { OPENAI_MODEL_ALIASES, OPENAI_PRICE_TABLE_USD, OPENAI_PRICING_SOURCE, OPENAI_PRICE_VERSION, OPENAI_PROVIDER } from "./openai";
import { TOGETHER_PRICE_TABLE_USD, TOGETHER_PRICING_SOURCE, TOGETHER_PRICE_VERSION, TOGETHER_PROVIDER } from "./together";

export const DSH_PROVIDER_IDS = [
  "amazon-bedrock",
  "ant-ling",
  "anthropic",
  "azure-openai-responses",
  "cerebras",
  "cloudflare-ai-gateway",
  "cloudflare-workers-ai",
  "deepseek",
  "fireworks",
  "github-copilot",
  "google",
  "google-vertex",
  "groq",
  "huggingface",
  "kimi-coding",
  "minimax",
  "minimax-cn",
  "mistral",
  "moonshotai",
  "moonshotai-cn",
  "nvidia",
  "openai",
  "openai-codex",
  "opencode",
  "opencode-go",
  "openrouter",
  "qwen-token-plan",
  "qwen-token-plan-cn",
  "together",
  "vercel-ai-gateway",
  "xai",
  "xiaomi",
  "xiaomi-token-plan-ams",
  "xiaomi-token-plan-cn",
  "xiaomi-token-plan-sgp",
  "zai",
  "zai-coding-cn",
] as const;

export type DshProviderId = (typeof DSH_PROVIDER_IDS)[number];

/** Routes that should be estimated with the corresponding vendor's public API price card. */
export const API_PRICING_PROVIDER_ALIASES = {
  "azure-openai-responses": "openai",
  "google-vertex": "google",
  "kimi-coding": "moonshotai",
  "minimax-cn": "minimax",
  "moonshotai-cn": "moonshotai",
  "openai-codex": "openai",
} as const satisfies Partial<Record<DshProviderId, AdditionalPricingCatalogKind>>;

export type AdditionalPricingCatalogKind =
  | typeof ANTHROPIC_PROVIDER
  | typeof CEREBRAS_PROVIDER
  | typeof FIREWORKS_PROVIDER
  | typeof GOOGLE_PROVIDER
  | typeof GROQ_PROVIDER
  | typeof MINIMAX_PROVIDER
  | typeof MISTRAL_PROVIDER
  | typeof MOONSHOTAI_PROVIDER
  | typeof OPENAI_PROVIDER
  | typeof TOGETHER_PROVIDER;

export interface AdditionalPricingCatalog {
  kind: AdditionalPricingCatalogKind;
  displayName: string;
  priceVersion: string;
  source: string;
  models: Record<string, UsdTokenRates>;
  aliases?: Record<string, string>;
}

export const ADDITIONAL_PRICING_CATALOGS: Record<AdditionalPricingCatalogKind, AdditionalPricingCatalog> = {
  anthropic: {
    kind: ANTHROPIC_PROVIDER,
    displayName: "Anthropic",
    priceVersion: ANTHROPIC_PRICE_VERSION,
    source: ANTHROPIC_PRICING_SOURCE,
    models: ANTHROPIC_PRICE_TABLE_USD,
    aliases: ANTHROPIC_MODEL_ALIASES,
  },
  cerebras: {
    kind: CEREBRAS_PROVIDER,
    displayName: "Cerebras",
    priceVersion: CEREBRAS_PRICE_VERSION,
    source: CEREBRAS_PRICING_SOURCE,
    models: CEREBRAS_PRICE_TABLE_USD,
  },
  fireworks: {
    kind: FIREWORKS_PROVIDER,
    displayName: "Fireworks AI",
    priceVersion: FIREWORKS_PRICE_VERSION,
    source: FIREWORKS_PRICING_SOURCE,
    models: FIREWORKS_PRICE_TABLE_USD,
  },
  google: {
    kind: GOOGLE_PROVIDER,
    displayName: "Google Gemini",
    priceVersion: GOOGLE_PRICE_VERSION,
    source: GOOGLE_PRICING_SOURCE,
    models: GOOGLE_PRICE_TABLE_USD,
    aliases: GOOGLE_MODEL_ALIASES,
  },
  groq: {
    kind: GROQ_PROVIDER,
    displayName: "Groq",
    priceVersion: GROQ_PRICE_VERSION,
    source: GROQ_PRICING_SOURCE,
    models: GROQ_PRICE_TABLE_USD,
  },
  minimax: {
    kind: MINIMAX_PROVIDER,
    displayName: "MiniMax",
    priceVersion: MINIMAX_PRICE_VERSION,
    source: MINIMAX_PRICING_SOURCE,
    models: MINIMAX_PRICE_TABLE_USD,
  },
  mistral: {
    kind: MISTRAL_PROVIDER,
    displayName: "Mistral AI",
    priceVersion: MISTRAL_PRICE_VERSION,
    source: MISTRAL_PRICING_SOURCE,
    models: MISTRAL_PRICE_TABLE_USD,
  },
  moonshotai: {
    kind: MOONSHOTAI_PROVIDER,
    displayName: "Moonshot / Kimi",
    priceVersion: MOONSHOTAI_PRICE_VERSION,
    source: MOONSHOTAI_PRICING_SOURCE,
    models: MOONSHOTAI_PRICE_TABLE_USD,
    aliases: MOONSHOTAI_MODEL_ALIASES,
  },
  openai: {
    kind: OPENAI_PROVIDER,
    displayName: "OpenAI",
    priceVersion: OPENAI_PRICE_VERSION,
    source: OPENAI_PRICING_SOURCE,
    models: OPENAI_PRICE_TABLE_USD,
    aliases: OPENAI_MODEL_ALIASES,
  },
  together: {
    kind: TOGETHER_PROVIDER,
    displayName: "Together AI",
    priceVersion: TOGETHER_PRICE_VERSION,
    source: TOGETHER_PRICING_SOURCE,
    models: TOGETHER_PRICE_TABLE_USD,
  },
};

export interface AdditionalPriceQuote {
  provider: AdditionalPricingCatalogKind;
  model: string;
  currency: "USD";
  pricingZone: "unknown";
  priceVersion: string;
  source: string;
  rates: CnyTokenRates;
  nativeRates: UsdTokenRatesInMinor;
}

function findModel(catalog: AdditionalPricingCatalog, model: string): UsdTokenRates | undefined {
  const normalized = model.trim().toLowerCase();
  const candidates = [normalized, normalized.includes("/") ? normalized.slice(normalized.lastIndexOf("/") + 1) : ""]
    .filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  for (const candidate of candidates) {
    const direct = Object.entries(catalog.models).find(([id]) => id.toLowerCase() === candidate)?.[1];
    if (direct) return direct;
    const alias = catalog.aliases && Object.hasOwn(catalog.aliases, candidate)
      ? catalog.aliases[candidate]
      : undefined;
    if (alias && catalog.models[alias]) return catalog.models[alias];
  }
  return undefined;
}

function matchingCatalogs(model: string): AdditionalPricingCatalog[] {
  return Object.values(ADDITIONAL_PRICING_CATALOGS)
    .filter((catalog) => findModel(catalog, model) !== undefined);
}

function uniquelyMatchingCatalog(model: string): AdditionalPricingCatalog | undefined {
  const matches = matchingCatalogs(model);
  return matches.length === 1 ? matches[0] : undefined;
}

export function getAdditionalPricingCatalog(kind: string): AdditionalPricingCatalog | undefined {
  const normalized = kind.trim().toLowerCase();
  const catalogKind = Object.hasOwn(API_PRICING_PROVIDER_ALIASES, normalized)
    ? API_PRICING_PROVIDER_ALIASES[normalized as keyof typeof API_PRICING_PROVIDER_ALIASES]
    : normalized;
  return Object.hasOwn(ADDITIONAL_PRICING_CATALOGS, catalogKind)
    ? ADDITIONAL_PRICING_CATALOGS[catalogKind as AdditionalPricingCatalogKind]
    : undefined;
}

export function lookupAdditionalPrice(
  kind: string,
  model: string,
  inputTokens: number | bigint = 0,
): AdditionalPriceQuote | null {
  // A route id is only a hint. Prefer the model's unique catalog even when
  // the caller passes a custom or otherwise unrelated provider id.
  const routedCatalog = getAdditionalPricingCatalog(kind);
  const routedRates = routedCatalog ? findModel(routedCatalog, model) : undefined;
  const catalog = routedRates ? routedCatalog : uniquelyMatchingCatalog(model);
  const baseRates = routedRates ?? (catalog ? findModel(catalog, model) : undefined);
  if (!catalog) return null;
  if (!baseRates) return null;
  const normalizedInputTokens = typeof inputTokens === "bigint" ? inputTokens : BigInt(inputTokens);
  const tier = [...(baseRates.tiers ?? [])]
    .sort((left, right) => right.inputTokensAbove - left.inputTokensAbove)
    .find((candidate) => normalizedInputTokens > BigInt(candidate.inputTokensAbove));
  const usdRates = tier ?? baseRates;
  return {
    provider: catalog.kind,
    model,
    currency: "USD",
    pricingZone: "unknown",
    priceVersion: catalog.priceVersion,
    source: catalog.source,
    rates: usdRatesToCny(usdRates),
    nativeRates: usdRatesToMicroUsd(usdRates),
  };
}

export function resolveAdditionalPricingCatalogKind(provider: string | undefined, model: string): AdditionalPricingCatalogKind | null {
  const normalizedProvider = provider?.trim().toLowerCase();
  const modelMatches = matchingCatalogs(model).map((catalog) => catalog.kind);
  if (modelMatches.length === 1) return modelMatches[0]!;

  // A known route can disambiguate a model served by multiple API catalogs,
  // but it never creates a price match when the model itself is absent.
  const routed = normalizedProvider ? lookupAdditionalPrice(normalizedProvider, model)?.provider : undefined;
  return routed && modelMatches.includes(routed) ? routed : null;
}

export function listPriceCatalogProviders(): readonly string[] {
  return [
    "deepseek",
    "xai",
    ...Object.keys(ADDITIONAL_PRICING_CATALOGS),
    ...Object.keys(API_PRICING_PROVIDER_ALIASES),
  ];
}
