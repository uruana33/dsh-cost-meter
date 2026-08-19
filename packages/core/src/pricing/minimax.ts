import type { UsdTokenRates } from "./common";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const MINIMAX_PROVIDER = "minimax" as const;
export const MINIMAX_PRICE_VERSION = PRICING_CATALOG_VERSIONS.minimax;
export const MINIMAX_PRICING_SOURCE = "https://platform.minimax.io/docs/guides/pricing-paygo";

export const MINIMAX_PRICE_TABLE_USD: Record<string, UsdTokenRates> = {
  "MiniMax-M2.7": { input: 0.3, cachedInput: 0.06, output: 1.2, cacheWrite: 0.375 },
  "MiniMax-M2.7-highspeed": { input: 0.6, cachedInput: 0.06, output: 2.4, cacheWrite: 0.375 },
  "MiniMax-M3": { input: 0.3, cachedInput: 0.06, output: 1.2 },
};
