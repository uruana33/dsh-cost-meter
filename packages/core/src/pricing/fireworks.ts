import type { UsdTokenRates } from "./common";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const FIREWORKS_PROVIDER = "fireworks" as const;
export const FIREWORKS_PRICE_VERSION = PRICING_CATALOG_VERSIONS.fireworks;
export const FIREWORKS_PRICING_SOURCE = "https://docs.fireworks.ai/serverless/pricing";

export const FIREWORKS_PRICE_TABLE_USD: Record<string, UsdTokenRates> = {
  "accounts/fireworks/models/deepseek-v4-flash": { input: 0.14, cachedInput: 0.028, output: 0.28 },
  "accounts/fireworks/models/deepseek-v4-pro": { input: 1.74, cachedInput: 0.145, output: 3.48 },
  "accounts/fireworks/models/glm-5p1": { input: 1.4, cachedInput: 0.26, output: 4.4 },
  "accounts/fireworks/models/glm-5p2": { input: 1.4, cachedInput: 0.14, output: 4.4 },
  "accounts/fireworks/models/gpt-oss-120b": { input: 0.15, cachedInput: 0.015, output: 0.6 },
  "accounts/fireworks/models/gpt-oss-20b": { input: 0.07, cachedInput: 0.035, output: 0.3 },
  "accounts/fireworks/models/kimi-k2p6": { input: 0.95, cachedInput: 0.16, output: 4 },
  "accounts/fireworks/models/kimi-k2p7-code": { input: 0.95, cachedInput: 0.19, output: 4 },
  "accounts/fireworks/models/minimax-m3": { input: 0.3, cachedInput: 0.06, output: 1.2 },
  "accounts/fireworks/models/minimax-m2p7": { input: 0.3, cachedInput: 0.06, output: 1.2 },
  "accounts/fireworks/models/qwen3p7-plus": { input: 0.4, cachedInput: 0.08, output: 1.6 },
  "accounts/fireworks/routers/glm-5p1-fast": { input: 2.8, cachedInput: 0.52, output: 8.8 },
  "accounts/fireworks/routers/glm-5p2-fast": { input: 2.1, cachedInput: 0.21, output: 6.6 },
  "accounts/fireworks/routers/kimi-k2p6-fast": { input: 2, cachedInput: 0.3, output: 8 },
  "accounts/fireworks/routers/kimi-k2p6-turbo": { input: 2, cachedInput: 0.3, output: 8 },
  "accounts/fireworks/routers/kimi-k2p7-code-fast": { input: 1.9, cachedInput: 0.38, output: 8 },
};
