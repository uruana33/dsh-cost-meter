import type { UsdTokenRates } from "./common";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const MISTRAL_PROVIDER = "mistral" as const;
export const MISTRAL_PRICE_VERSION = PRICING_CATALOG_VERSIONS.mistral;
export const MISTRAL_PRICING_SOURCE = "https://docs.mistral.ai/inference/pricing";

export const MISTRAL_PRICE_TABLE_USD: Record<string, UsdTokenRates> = {
  "mistral-large-latest": { input: 0.5, cachedInput: 0.05, output: 1.5 },
  "mistral-large-2411": { input: 2, cachedInput: 0.2, output: 6 },
  "mistral-large-2512": { input: 0.5, cachedInput: 0.05, output: 1.5 },
  "mistral-medium-latest": { input: 1.5, cachedInput: 0.15, output: 7.5 },
  "mistral-medium-2505": { input: 0.4, cachedInput: 0.04, output: 2 },
  "mistral-medium-2508": { input: 0.4, cachedInput: 0.04, output: 2 },
  "mistral-medium-2604": { input: 1.5, cachedInput: 0.15, output: 7.5 },
  "mistral-medium-3.5": { input: 1.5, cachedInput: 0, output: 7.5 },
  "mistral-small-latest": { input: 0.15, cachedInput: 0.015, output: 0.6 },
  "mistral-small-2506": { input: 0.1, cachedInput: 0.01, output: 0.3 },
  "mistral-small-2603": { input: 0.15, cachedInput: 0.015, output: 0.6 },
  "codestral-latest": { input: 0.3, cachedInput: 0.03, output: 0.9 },
  "devstral-latest": { input: 0.4, cachedInput: 0.04, output: 2 },
  "devstral-2512": { input: 0.4, cachedInput: 0.04, output: 2 },
  "devstral-medium-2507": { input: 0.4, cachedInput: 0.04, output: 2 },
  "devstral-medium-latest": { input: 0.4, cachedInput: 0.04, output: 2 },
  "devstral-small-2505": { input: 0.1, cachedInput: 0.01, output: 0.3 },
  "devstral-small-2507": { input: 0.1, cachedInput: 0.01, output: 0.3 },
  "labs-devstral-small-2512": { input: 0, cachedInput: 0, output: 0 },
  "magistral-medium-latest": { input: 2, cachedInput: 0.2, output: 5 },
  "magistral-small": { input: 0.5, cachedInput: 0.05, output: 1.5 },
  "ministral-3b-latest": { input: 0.04, cachedInput: 0.004, output: 0.04 },
  "ministral-8b-latest": { input: 0.1, cachedInput: 0.01, output: 0.1 },
  "mistral-nemo": { input: 0.15, cachedInput: 0.015, output: 0.15 },
  "open-mistral-7b": { input: 0.25, cachedInput: 0.025, output: 0.25 },
  "open-mistral-nemo": { input: 0.15, cachedInput: 0.015, output: 0.15 },
  "open-mixtral-8x22b": { input: 2, cachedInput: 0.2, output: 6 },
  "open-mixtral-8x7b": { input: 0.7, cachedInput: 0.07, output: 0.7 },
  "pixtral-12b": { input: 0.15, cachedInput: 0.015, output: 0.15 },
  "pixtral-large-latest": { input: 2, cachedInput: 0.2, output: 6 },
};
