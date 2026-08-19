import type { UsdTokenRates } from "./common";
export declare const GOOGLE_PROVIDER: "google";
export declare const GOOGLE_PRICE_VERSION: "google-official-pricing-2026-08-18-usd";
export declare const GOOGLE_PRICING_SOURCE = "https://ai.google.dev/gemini-api/docs/pricing";
export declare const GOOGLE_MODEL_ALIASES: Record<string, string>;
/** USD per 1M tokens for the standard text tier. */
export declare const GOOGLE_PRICE_TABLE_USD: Record<string, UsdTokenRates>;
