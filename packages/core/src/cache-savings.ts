import { TOKENS_PER_MILLION, type MoneyMinor, type TokenCount } from "../../shared/src/index";

export interface CacheHitSavingsInput {
  cacheHitTokens: TokenCount;
  cacheMissTokens: TokenCount;
  cacheHitRateMinorPerMillionTokens: MoneyMinor;
  cacheMissRateMinorPerMillionTokens: MoneyMinor;
}

export interface CacheHitSavingsResult {
  actualMinor: MoneyMinor;
  uncachedBaselineMinor: MoneyMinor;
  savedMinor: MoneyMinor;
  /** Saved share of the uncached baseline, where 10_000 is 100%. */
  savingsRateBasisPoints: number;
}

export function calculateCacheHitSavings(input: CacheHitSavingsInput): CacheHitSavingsResult {
  assertNonNegative(input);
  const actualMinor = priceTokens(input.cacheHitTokens, input.cacheHitRateMinorPerMillionTokens)
    + priceTokens(input.cacheMissTokens, input.cacheMissRateMinorPerMillionTokens);
  const uncachedBaselineMinor = priceTokens(
    input.cacheHitTokens + input.cacheMissTokens,
    input.cacheMissRateMinorPerMillionTokens,
  );
  const savedMinor = uncachedBaselineMinor > actualMinor ? uncachedBaselineMinor - actualMinor : 0n;
  const savingsRateBasisPoints = uncachedBaselineMinor === 0n
    ? 0
    : Number((savedMinor * 10_000n + uncachedBaselineMinor / 2n) / uncachedBaselineMinor);

  return { actualMinor, uncachedBaselineMinor, savedMinor, savingsRateBasisPoints };
}

function priceTokens(tokens: TokenCount, rate: MoneyMinor): MoneyMinor {
  return (tokens * rate + TOKENS_PER_MILLION / 2n) / TOKENS_PER_MILLION;
}

function assertNonNegative(input: CacheHitSavingsInput): void {
  for (const value of Object.values(input)) {
    if (value < 0n) throw new RangeError("cache savings values must be non-negative");
  }
}
