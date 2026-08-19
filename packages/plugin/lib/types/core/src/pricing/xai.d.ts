import { usdToMicroCny } from "./common";
export declare const XAI_PROVIDER: "xai";
export declare const XAI_PRICE_VERSION: "xai-official-pricing-2026-08-18-usd";
export declare const XAI_PRICING_SOURCE = "https://docs.x.ai/developers/pricing";
export declare const XAI_USD_CNY_RATE_MICRO_CNY = 7200000n;
export declare const XAI_EXCHANGE_RATE_LABEL = "1 USD = \u00A57.20";
export type XaiModelId = "grok-4.6" | "grok-4.5" | "grok-4.3" | "grok-build-0.1" | "grok-4.20";
export type XaiUsdRates = {
    input: number;
    cachedInput: number;
    output: number;
};
export declare const XAI_MODEL_ALIASES: Record<string, XaiModelId>;
/** USD per 1M tokens from xAI's Text API pricing page. */
export declare const XAI_PRICE_TABLE_USD: Record<XaiModelId, {
    short: XaiUsdRates;
    long: XaiUsdRates;
    longContextThresholdTokens: number;
}>;
export declare function resolveXaiModelId(model: string): XaiModelId | null;
export { usdToMicroCny };
