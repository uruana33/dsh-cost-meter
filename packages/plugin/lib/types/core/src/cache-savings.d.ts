import { type MoneyMinor, type TokenCount } from "../../shared/src/index";
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
export declare function calculateCacheHitSavings(input: CacheHitSavingsInput): CacheHitSavingsResult;
