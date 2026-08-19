import type { UsdTokenRates } from "./common";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const OPENAI_PROVIDER = "openai" as const;
export const OPENAI_PRICE_VERSION = PRICING_CATALOG_VERSIONS.openai;
export const OPENAI_PRICING_SOURCE = "https://developers.openai.com/api/docs/pricing";

export const OPENAI_MODEL_ALIASES: Record<string, string> = {
  "gpt-5-latest": "gpt-5.4",
  "gpt-5.4-latest": "gpt-5.4",
  "gpt-5-mini-latest": "gpt-5-mini",
  "gpt-5-codex": "gpt-5.3-codex",
};

/** USD per 1M tokens; snapshot sourced from the dsh/pi-ai model catalog. */
export const OPENAI_PRICE_TABLE_USD: Record<string, UsdTokenRates> = {
  "gpt-4": { input: 30, cachedInput: 0, output: 60 },
  "gpt-4-turbo": { input: 10, cachedInput: 0, output: 30 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, cachedInput: 0.025, output: 0.4 },
  "gpt-5.6-luna": {
    input: 1,
    cachedInput: 0.1,
    output: 6,
    cacheWrite: 1.25,
    tiers: [{ inputTokensAbove: 272_000, input: 2, cachedInput: 0.2, output: 9, cacheWrite: 2.5 }],
  },
  "gpt-5.6-sol": {
    input: 5,
    cachedInput: 0.5,
    output: 30,
    cacheWrite: 6.25,
    tiers: [{ inputTokensAbove: 272_000, input: 10, cachedInput: 1, output: 45, cacheWrite: 12.5 }],
  },
  "gpt-5.6-terra": {
    input: 2.5,
    cachedInput: 0.25,
    output: 15,
    cacheWrite: 3.125,
    tiers: [{ inputTokensAbove: 272_000, input: 5, cachedInput: 0.5, output: 22.5, cacheWrite: 6.25 }],
  },
  "gpt-5.4": {
    input: 2.5,
    cachedInput: 0.25,
    output: 15,
    tiers: [{ inputTokensAbove: 272_000, input: 5, cachedInput: 0.5, output: 22.5 }],
  },
  "gpt-5.4-nano": { input: 0.2, cachedInput: 0.02, output: 1.25 },
  "gpt-5.4-pro": {
    input: 30,
    cachedInput: 0,
    output: 180,
    tiers: [{ inputTokensAbove: 272_000, input: 60, cachedInput: 0, output: 270 }],
  },
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5.5": {
    input: 5,
    cachedInput: 0.5,
    output: 30,
    tiers: [{ inputTokensAbove: 272_000, input: 10, cachedInput: 1, output: 45 }],
  },
  "gpt-5.5-pro": {
    input: 30,
    cachedInput: 0,
    output: 180,
    tiers: [{ inputTokensAbove: 272_000, input: 60, cachedInput: 0, output: 270 }],
  },
  "gpt-5.3-codex": { input: 1.75, cachedInput: 0.175, output: 14 },
  "gpt-5.3-codex-spark": { input: 1.75, cachedInput: 0.175, output: 14 },
  "gpt-5.3-chat-latest": { input: 1.75, cachedInput: 0.175, output: 14 },
  "gpt-5.2": { input: 1.75, cachedInput: 0.175, output: 14 },
  "gpt-5.2-chat-latest": { input: 1.75, cachedInput: 0.175, output: 14 },
  "gpt-5.2-pro": { input: 21, cachedInput: 0, output: 168 },
  "gpt-5.1": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gpt-5-chat-latest": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gpt-5": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2 },
  "gpt-5-nano": { input: 0.05, cachedInput: 0.005, output: 0.4 },
  "gpt-5-pro": { input: 15, cachedInput: 0, output: 120 },
  "gpt-realtime-2.1": { input: 4, cachedInput: 0.4, output: 24 },
  o1: { input: 15, cachedInput: 7.5, output: 60 },
  "o1-pro": { input: 150, cachedInput: 0, output: 600 },
  o3: { input: 2, cachedInput: 0.5, output: 8 },
  "o3-mini": { input: 1.1, cachedInput: 0.55, output: 4.4 },
  "o3-pro": { input: 20, cachedInput: 0, output: 80 },
  "o4-mini": { input: 1.1, cachedInput: 0.275, output: 4.4 },
  "gpt-4.1": { input: 2, cachedInput: 0.5, output: 8 },
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10 },
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
};
