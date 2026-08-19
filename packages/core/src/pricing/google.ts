import type { UsdTokenRates } from "./common";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const GOOGLE_PROVIDER = "google" as const;
export const GOOGLE_PRICE_VERSION = PRICING_CATALOG_VERSIONS.google;
export const GOOGLE_PRICING_SOURCE = "https://ai.google.dev/gemini-api/docs/pricing";

export const GOOGLE_MODEL_ALIASES: Record<string, string> = {
  "gemini-pro-latest": "gemini-3.1-pro-preview",
  "gemini-flash-latest": "gemini-3-flash-preview",
};

/** USD per 1M tokens for the standard text tier. */
export const GOOGLE_PRICE_TABLE_USD: Record<string, UsdTokenRates> = {
  "deep-research-max-preview-04-2026": { input: 2, cachedInput: 0.2, output: 12 },
  "deep-research-preview-04-2026": { input: 2, cachedInput: 0.2, output: 12 },
  "gemini-2.0-flash": { input: 0.1, cachedInput: 0.025, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.075, cachedInput: 0, output: 0.3 },
  "gemini-3.1-pro-preview": { input: 2, cachedInput: 0.2, output: 12 },
  "gemini-3-pro-preview": { input: 2, cachedInput: 0.2, output: 12 },
  "gemini-3-flash-preview": { input: 0.5, cachedInput: 0.05, output: 3 },
  "gemini-3.1-flash-lite": { input: 0.25, cachedInput: 0.025, output: 1.5 },
  "gemini-3.1-flash-lite-preview": { input: 0.25, cachedInput: 0.025, output: 1.5 },
  "gemini-3.1-flash-live-preview": { input: 0.75, cachedInput: 0, output: 4.5 },
  "gemini-3.1-flash-lite-image": { input: 0.25, cachedInput: 0, output: 30 },
  "gemini-3.1-pro-preview-customtools": { input: 2, cachedInput: 0.2, output: 12 },
  "gemini-3.5-flash": { input: 1.5, cachedInput: 0.15, output: 9 },
  "gemini-3.5-flash-lite": { input: 0.3, cachedInput: 0.03, output: 2.5 },
  "gemini-3.6-flash": { input: 1.5, cachedInput: 0.15, output: 7.5 },
  "gemini-2.5-pro": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gemini-2.5-flash": { input: 0.3, cachedInput: 0.03, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, cachedInput: 0.01, output: 0.4 },
  "gemini-2.5-computer-use-preview-10-2025": { input: 1.25, cachedInput: 0, output: 10 },
  "gemini-flash-latest": { input: 1.5, cachedInput: 0.15, output: 9 },
  "gemini-flash-lite-latest": { input: 0.25, cachedInput: 0.025, output: 1.5 },
  "gemini-robotics-er-1.6-preview": { input: 1, cachedInput: 0, output: 5 },
  "gemma-4-26b-a4b-it": { input: 0, cachedInput: 0, output: 0 },
  "gemma-4-31b-it": { input: 0, cachedInput: 0, output: 0 },
};
