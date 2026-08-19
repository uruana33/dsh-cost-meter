import type { UsdTokenRates } from "./common";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const MOONSHOTAI_PROVIDER = "moonshotai" as const;
export const MOONSHOTAI_PRICE_VERSION = PRICING_CATALOG_VERSIONS.moonshotai;
export const MOONSHOTAI_PRICING_SOURCE = "https://platform.kimi.ai/docs/pricing/chat";

export const MOONSHOTAI_MODEL_ALIASES: Record<string, string> = {
  k3: "kimi-k3",
  "k3-256k": "kimi-k3",
  "kimi-for-coding": "kimi-k2.7-code",
  "kimi-for-coding-highspeed": "kimi-k2.7-code-highspeed",
};

/** USD per 1M tokens for Moonshot's international API. */
export const MOONSHOTAI_PRICE_TABLE_USD: Record<string, UsdTokenRates> = {
  "kimi-k2-0711-preview": { input: 0.6, cachedInput: 0.15, output: 2.5 },
  "kimi-k2-0905-preview": { input: 0.6, cachedInput: 0.15, output: 2.5 },
  "kimi-k2.6": { input: 0.95, cachedInput: 0.16, output: 4 },
  "kimi-k2.5": { input: 0.6, cachedInput: 0.1, output: 3 },
  "kimi-k2-thinking": { input: 0.6, cachedInput: 0.15, output: 2.5 },
  "kimi-k2-thinking-turbo": { input: 1.15, cachedInput: 0.15, output: 8 },
  "kimi-k2-turbo-preview": { input: 2.4, cachedInput: 0.6, output: 10 },
  "kimi-k2.7-code": { input: 0.95, cachedInput: 0.19, output: 4 },
  "kimi-k2.7-code-highspeed": { input: 1.9, cachedInput: 0.38, output: 8 },
  "kimi-k3": { input: 3, cachedInput: 0.3, output: 15 },
};
