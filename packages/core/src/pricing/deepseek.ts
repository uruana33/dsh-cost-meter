import type { MoneyMicroCny, PricingZone } from "../../../shared/src/index";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const DEEPSEEK_PROVIDER = "deepseek" as const;
export const DEEPSEEK_PRICE_VERSION = PRICING_CATALOG_VERSIONS.deepseek;
export const DEEPSEEK_PRICING_SOURCE = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";

export type DeepSeekModelId =
  | "deepseek-v4-flash"
  | "deepseek-v4-pro"
  | "deepseek-v4-flash-vision-exp";

export const DEEPSEEK_MODEL_ALIASES: Record<string, DeepSeekModelId> = {
  "deepseek-chat": "deepseek-v4-flash",
  "deepseek-reasoner": "deepseek-v4-pro",
};

export type DeepSeekTokenRates = {
  cacheHitMicroCnyPerMillionTokens: MoneyMicroCny;
  cacheMissMicroCnyPerMillionTokens: MoneyMicroCny;
  outputMicroCnyPerMillionTokens: MoneyMicroCny;
};

export const DEEPSEEK_PRICE_TABLE: Record<
  DeepSeekModelId,
  Record<Exclude<PricingZone, "unknown">, DeepSeekTokenRates>
> = {
  "deepseek-v4-flash": {
    peak: {
      cacheHitMicroCnyPerMillionTokens: 100_000n,
      cacheMissMicroCnyPerMillionTokens: 3_000_000n,
      outputMicroCnyPerMillionTokens: 9_000_000n,
    },
    offpeak: {
      cacheHitMicroCnyPerMillionTokens: 50_000n,
      cacheMissMicroCnyPerMillionTokens: 1_500_000n,
      outputMicroCnyPerMillionTokens: 4_500_000n,
    },
  },
  "deepseek-v4-pro": {
    peak: {
      cacheHitMicroCnyPerMillionTokens: 300_000n,
      cacheMissMicroCnyPerMillionTokens: 9_000_000n,
      outputMicroCnyPerMillionTokens: 27_000_000n,
    },
    offpeak: {
      cacheHitMicroCnyPerMillionTokens: 150_000n,
      cacheMissMicroCnyPerMillionTokens: 4_500_000n,
      outputMicroCnyPerMillionTokens: 13_500_000n,
    },
  },
  "deepseek-v4-flash-vision-exp": {
    peak: {
      cacheHitMicroCnyPerMillionTokens: 100_000n,
      cacheMissMicroCnyPerMillionTokens: 3_000_000n,
      outputMicroCnyPerMillionTokens: 9_000_000n,
    },
    offpeak: {
      cacheHitMicroCnyPerMillionTokens: 50_000n,
      cacheMissMicroCnyPerMillionTokens: 1_500_000n,
      outputMicroCnyPerMillionTokens: 4_500_000n,
    },
  },
};

export function resolveDeepSeekModelId(model: string): DeepSeekModelId | null {
  const normalized = model.trim().toLowerCase();
  const candidates = [normalized, normalized.includes("/") ? normalized.slice(normalized.lastIndexOf("/") + 1) : ""]
    .filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  for (const candidate of candidates) {
    if (Object.hasOwn(DEEPSEEK_PRICE_TABLE, candidate)) return candidate as DeepSeekModelId;
    if (Object.hasOwn(DEEPSEEK_MODEL_ALIASES, candidate)) return DEEPSEEK_MODEL_ALIASES[candidate]!;
  }
  return null;
}
