import type { UsdTokenRates } from "./common";
export declare const OPENAI_PROVIDER: "openai";
export declare const OPENAI_PRICE_VERSION: "openai-official-pricing-2026-08-18-usd";
export declare const OPENAI_PRICING_SOURCE = "https://developers.openai.com/api/docs/pricing";
export declare const OPENAI_MODEL_ALIASES: Record<string, string>;
/** USD per 1M tokens; snapshot sourced from the dsh/pi-ai model catalog. */
export declare const OPENAI_PRICE_TABLE_USD: Record<string, UsdTokenRates>;
