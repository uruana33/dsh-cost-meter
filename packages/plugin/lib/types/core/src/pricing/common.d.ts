import type { MoneyMicroCny, MoneyMinor } from "../../../shared/src/index";
/** USD per one million tokens as published by provider pricing pages. */
export type UsdTokenRates = {
    input: number;
    cachedInput: number;
    output: number;
    cacheWrite?: number;
    tiers?: Array<{
        inputTokensAbove: number;
        input: number;
        cachedInput: number;
        output: number;
        cacheWrite?: number;
    }>;
};
export type CnyTokenRates = {
    cacheHitMicroCnyPerMillionTokens: MoneyMicroCny;
    cacheMissMicroCnyPerMillionTokens: MoneyMicroCny;
    outputMicroCnyPerMillionTokens: MoneyMicroCny;
    cacheWriteMicroCnyPerMillionTokens?: MoneyMicroCny;
};
export type UsdTokenRatesInMinor = {
    cacheHitMinorPerMillionTokens: MoneyMinor;
    cacheMissMinorPerMillionTokens: MoneyMinor;
    outputMinorPerMillionTokens: MoneyMinor;
    cacheWriteMinorPerMillionTokens?: MoneyMinor;
};
/** Versioned snapshot conversion used to keep the local CNY ledger additive. */
export declare const USD_CNY_RATE_MICRO_CNY = 7200000n;
export declare const USD_CNY_EXCHANGE_RATE_LABEL = "1 USD = \u00A57.20";
export declare function usdToMicroCny(usdPerMillionTokens: number): MoneyMicroCny;
/** Convert a published USD rate to exact micro-USD per million tokens. */
export declare function usdToMicroUsd(usdPerMillionTokens: number): MoneyMinor;
export declare function usdRatesToMicroUsd(rates: UsdTokenRates): UsdTokenRatesInMinor;
export declare function usdRatesToCny(rates: UsdTokenRates): CnyTokenRates;
