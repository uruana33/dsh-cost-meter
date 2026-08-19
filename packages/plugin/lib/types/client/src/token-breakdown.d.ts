import type { TokenBucketView } from "./view-model";
export interface TokenCostBreakdown {
    hasData: boolean;
    cacheMiss: TokenBucketView;
    cacheHit: TokenBucketView;
    output: TokenBucketView;
    reasoning: TokenBucketView;
    nonReasoningTokens: number | null;
    totalTokens: number;
}
export declare function buildTokenCostBreakdown(buckets: readonly TokenBucketView[]): TokenCostBreakdown;
