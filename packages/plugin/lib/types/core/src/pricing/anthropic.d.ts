import type { UsdTokenRates } from "./common";
export declare const ANTHROPIC_PROVIDER: "anthropic";
export declare const ANTHROPIC_PRICE_VERSION: "anthropic-official-pricing-2026-08-18-usd";
export declare const ANTHROPIC_PRICING_SOURCE = "https://platform.claude.com/docs/en/about-claude/pricing";
export declare const ANTHROPIC_MODEL_ALIASES: Record<string, string>;
/** USD per 1M tokens; cacheRead is the prompt-cache hit rate. */
export declare const ANTHROPIC_PRICE_TABLE_USD: Record<string, UsdTokenRates>;
