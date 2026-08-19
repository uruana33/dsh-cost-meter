import type { CnyTokenRates, UsdTokenRates, UsdTokenRatesInMinor } from "./common";
import { ANTHROPIC_PROVIDER } from "./anthropic";
import { CEREBRAS_PROVIDER } from "./cerebras";
import { FIREWORKS_PROVIDER } from "./fireworks";
import { GROQ_PROVIDER } from "./groq";
import { GOOGLE_PROVIDER } from "./google";
import { MINIMAX_PROVIDER } from "./minimax";
import { MISTRAL_PROVIDER } from "./mistral";
import { MOONSHOTAI_PROVIDER } from "./moonshotai";
import { OPENAI_PROVIDER } from "./openai";
import { TOGETHER_PROVIDER } from "./together";
export declare const DSH_PROVIDER_IDS: readonly ["amazon-bedrock", "ant-ling", "anthropic", "azure-openai-responses", "cerebras", "cloudflare-ai-gateway", "cloudflare-workers-ai", "deepseek", "fireworks", "github-copilot", "google", "google-vertex", "groq", "huggingface", "kimi-coding", "minimax", "minimax-cn", "mistral", "moonshotai", "moonshotai-cn", "nvidia", "openai", "openai-codex", "opencode", "opencode-go", "openrouter", "qwen-token-plan", "qwen-token-plan-cn", "together", "vercel-ai-gateway", "xai", "xiaomi", "xiaomi-token-plan-ams", "xiaomi-token-plan-cn", "xiaomi-token-plan-sgp", "zai", "zai-coding-cn"];
export type DshProviderId = (typeof DSH_PROVIDER_IDS)[number];
/** Routes that should be estimated with the corresponding vendor's public API price card. */
export declare const API_PRICING_PROVIDER_ALIASES: {
    readonly "azure-openai-responses": "openai";
    readonly "google-vertex": "google";
    readonly "kimi-coding": "moonshotai";
    readonly "minimax-cn": "minimax";
    readonly "moonshotai-cn": "moonshotai";
    readonly "openai-codex": "openai";
};
export type AdditionalPricingCatalogKind = typeof ANTHROPIC_PROVIDER | typeof CEREBRAS_PROVIDER | typeof FIREWORKS_PROVIDER | typeof GOOGLE_PROVIDER | typeof GROQ_PROVIDER | typeof MINIMAX_PROVIDER | typeof MISTRAL_PROVIDER | typeof MOONSHOTAI_PROVIDER | typeof OPENAI_PROVIDER | typeof TOGETHER_PROVIDER;
export interface AdditionalPricingCatalog {
    kind: AdditionalPricingCatalogKind;
    displayName: string;
    priceVersion: string;
    source: string;
    models: Record<string, UsdTokenRates>;
    aliases?: Record<string, string>;
}
export declare const ADDITIONAL_PRICING_CATALOGS: Record<AdditionalPricingCatalogKind, AdditionalPricingCatalog>;
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
export declare function getAdditionalPricingCatalog(kind: string): AdditionalPricingCatalog | undefined;
export declare function lookupAdditionalPrice(kind: string, model: string, inputTokens?: number | bigint): AdditionalPriceQuote | null;
export declare function resolveAdditionalPricingCatalogKind(provider: string | undefined, model: string): AdditionalPricingCatalogKind | null;
export declare function listPriceCatalogProviders(): readonly string[];
