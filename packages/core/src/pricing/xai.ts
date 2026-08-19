import { USD_CNY_EXCHANGE_RATE_LABEL, usdToMicroCny } from "./common";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const XAI_PROVIDER = "xai" as const;
export const XAI_PRICE_VERSION = PRICING_CATALOG_VERSIONS.xai;
export const XAI_PRICING_SOURCE = "https://docs.x.ai/developers/pricing";
export const XAI_USD_CNY_RATE_MICRO_CNY = 7_200_000n;
export const XAI_EXCHANGE_RATE_LABEL = USD_CNY_EXCHANGE_RATE_LABEL;

export type XaiModelId = "grok-4.6" | "grok-4.5" | "grok-4.3" | "grok-build-0.1" | "grok-4.20";
export type XaiUsdRates = { input: number; cachedInput: number; output: number };

export const XAI_MODEL_ALIASES: Record<string, XaiModelId> = {
  "grok-4.5-latest": "grok-4.5",
  "grok-4.3-latest": "grok-4.3",
  "grok-code-fast": "grok-build-0.1",
  "grok-code-fast-1": "grok-build-0.1",
  "grok-4.20-reasoning": "grok-4.20",
  "grok-4.20-0309": "grok-4.20",
  "grok-4.20-beta": "grok-4.20",
};

/** USD per 1M tokens from xAI's Text API pricing page. */
export const XAI_PRICE_TABLE_USD: Record<
  XaiModelId,
  { short: XaiUsdRates; long: XaiUsdRates; longContextThresholdTokens: number }
> = {
  "grok-4.6": {
    short: { input: 2, cachedInput: 0.5, output: 6 },
    long: { input: 4, cachedInput: 1, output: 12 },
    longContextThresholdTokens: 200_000,
  },
  "grok-4.5": {
    short: { input: 2, cachedInput: 0.3, output: 6 },
    long: { input: 4, cachedInput: 0.6, output: 12 },
    longContextThresholdTokens: 200_000,
  },
  "grok-4.3": {
    short: { input: 1.25, cachedInput: 0.2, output: 2.5 },
    long: { input: 2.5, cachedInput: 0.4, output: 5 },
    longContextThresholdTokens: 200_000,
  },
  "grok-build-0.1": {
    short: { input: 1, cachedInput: 0.2, output: 2 },
    long: { input: 2, cachedInput: 0.4, output: 4 },
    longContextThresholdTokens: 200_000,
  },
  "grok-4.20": {
    short: { input: 1.25, cachedInput: 0.2, output: 2.5 },
    long: { input: 2.5, cachedInput: 0.4, output: 5 },
    longContextThresholdTokens: 200_000,
  },
};

export function resolveXaiModelId(model: string): XaiModelId | null {
  const normalized = model.trim().toLowerCase();
  const candidates = [normalized, normalized.includes("/") ? normalized.slice(normalized.lastIndexOf("/") + 1) : ""]
    .filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(XAI_PRICE_TABLE_USD, candidate)) return candidate as XaiModelId;
    if (Object.prototype.hasOwnProperty.call(XAI_MODEL_ALIASES, candidate)) return XAI_MODEL_ALIASES[candidate]!;
  }
  return null;
}

export { usdToMicroCny };
