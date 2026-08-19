import type { MoneyMicroCny, PricingZone } from "../../../shared/src/index";
export declare const DEEPSEEK_PROVIDER: "deepseek";
export declare const DEEPSEEK_PRICE_VERSION: "deepseek-official-pricing-2026-08-17";
export declare const DEEPSEEK_PRICING_SOURCE = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";
export type DeepSeekModelId = "deepseek-v4-flash" | "deepseek-v4-pro";
export declare const DEEPSEEK_MODEL_ALIASES: Record<string, DeepSeekModelId>;
export type DeepSeekTokenRates = {
    cacheHitMicroCnyPerMillionTokens: MoneyMicroCny;
    cacheMissMicroCnyPerMillionTokens: MoneyMicroCny;
    outputMicroCnyPerMillionTokens: MoneyMicroCny;
};
export declare const DEEPSEEK_PRICE_TABLE: Record<DeepSeekModelId, Record<Exclude<PricingZone, "unknown">, DeepSeekTokenRates>>;
export declare function resolveDeepSeekModelId(model: string): DeepSeekModelId | null;
