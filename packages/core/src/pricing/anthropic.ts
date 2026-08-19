import type { UsdTokenRates } from "./common";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const ANTHROPIC_PROVIDER = "anthropic" as const;
export const ANTHROPIC_PRICE_VERSION = PRICING_CATALOG_VERSIONS.anthropic;
export const ANTHROPIC_PRICING_SOURCE = "https://platform.claude.com/docs/en/about-claude/pricing";

export const ANTHROPIC_MODEL_ALIASES: Record<string, string> = {
  "claude-opus-latest": "claude-opus-4-6",
  "claude-sonnet-latest": "claude-sonnet-4-6",
  "claude-haiku-latest": "claude-haiku-4-5",
};

/** USD per 1M tokens; cacheRead is the prompt-cache hit rate. */
export const ANTHROPIC_PRICE_TABLE_USD: Record<string, UsdTokenRates> = {
  "claude-haiku-4-5-20251001": { input: 1, cachedInput: 0.1, output: 5, cacheWrite: 1.25 },
  "claude-opus-4-1": { input: 15, cachedInput: 1.5, output: 75, cacheWrite: 18.75 },
  "claude-opus-4-1-20250805": { input: 15, cachedInput: 1.5, output: 75, cacheWrite: 18.75 },
  "claude-opus-4-5": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-opus-4-5-20251101": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-opus-5": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-opus-4-6": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-opus-4-7": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-sonnet-4-6": { input: 3, cachedInput: 0.3, output: 15, cacheWrite: 3.75 },
  "claude-sonnet-4-5": { input: 3, cachedInput: 0.3, output: 15, cacheWrite: 3.75 },
  "claude-sonnet-4-5-20250929": { input: 3, cachedInput: 0.3, output: 15, cacheWrite: 3.75 },
  "claude-haiku-4-5": { input: 1, cachedInput: 0.1, output: 5, cacheWrite: 1.25 },
  "claude-sonnet-5": { input: 2, cachedInput: 0.2, output: 10, cacheWrite: 2.5 },
  "claude-fable-5": { input: 10, cachedInput: 1, output: 50, cacheWrite: 12.5 },
};
