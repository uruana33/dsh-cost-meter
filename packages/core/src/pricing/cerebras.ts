import type { UsdTokenRates } from "./common";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const CEREBRAS_PROVIDER = "cerebras" as const;
export const CEREBRAS_PRICE_VERSION = PRICING_CATALOG_VERSIONS.cerebras;
export const CEREBRAS_PRICING_SOURCE = "https://inference-docs.cerebras.ai/support/pricing.md";

export const CEREBRAS_PRICE_TABLE_USD: Record<string, UsdTokenRates> = {
  "gemma-4-31b": { input: 0.99, cachedInput: 0, output: 1.49 },
  "gpt-oss-120b": { input: 0.35, cachedInput: 0, output: 0.75 },
  "zai-glm-4.7": { input: 2.25, cachedInput: 2.25, output: 2.75 },
};
