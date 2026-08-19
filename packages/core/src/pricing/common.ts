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
export const USD_CNY_RATE_MICRO_CNY = 7_200_000n;
export const USD_CNY_EXCHANGE_RATE_LABEL = "1 USD = ¥7.20";

export function usdToMicroCny(usdPerMillionTokens: number): MoneyMicroCny {
  const usdMicro = BigInt(Math.round(usdPerMillionTokens * 1_000_000));
  return (usdMicro * USD_CNY_RATE_MICRO_CNY + 500_000n) / 1_000_000n;
}

/** Convert a published USD rate to exact micro-USD per million tokens. */
export function usdToMicroUsd(usdPerMillionTokens: number): MoneyMinor {
  return BigInt(Math.round(usdPerMillionTokens * 1_000_000));
}

export function usdRatesToMicroUsd(rates: UsdTokenRates): UsdTokenRatesInMinor {
  return {
    cacheHitMinorPerMillionTokens: usdToMicroUsd(rates.cachedInput),
    cacheMissMinorPerMillionTokens: usdToMicroUsd(rates.input),
    outputMinorPerMillionTokens: usdToMicroUsd(rates.output),
    ...(rates.cacheWrite !== undefined
      ? { cacheWriteMinorPerMillionTokens: usdToMicroUsd(rates.cacheWrite) }
      : {}),
  };
}

export function usdRatesToCny(rates: UsdTokenRates): CnyTokenRates {
  return {
    cacheHitMicroCnyPerMillionTokens: usdToMicroCny(rates.cachedInput),
    cacheMissMicroCnyPerMillionTokens: usdToMicroCny(rates.input),
    outputMicroCnyPerMillionTokens: usdToMicroCny(rates.output),
    ...(rates.cacheWrite !== undefined
      ? { cacheWriteMicroCnyPerMillionTokens: usdToMicroCny(rates.cacheWrite) }
      : {}),
  };
}
