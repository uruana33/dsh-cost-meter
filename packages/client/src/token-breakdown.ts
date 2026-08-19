import type { TokenBucketView } from "./view-model";
import { createUnavailableAmountView } from "./format";

export interface TokenCostBreakdown {
  hasData: boolean;
  cacheMiss: TokenBucketView;
  cacheHit: TokenBucketView;
  output: TokenBucketView;
  reasoning: TokenBucketView;
  nonReasoningTokens: number | null;
  totalTokens: number;
}

export function buildTokenCostBreakdown(buckets: readonly TokenBucketView[]): TokenCostBreakdown {
  const cacheMiss = findBucket(buckets, "缓存未命中");
  const cacheHit = findBucket(buckets, "缓存命中");
  const output = findBucket(buckets, "输出");
  const reasoning = findBucket(buckets, "其中推理");
  const nonReasoningTokens = reasoning.tokens <= output.tokens
    ? output.tokens - reasoning.tokens
    : null;

  return {
    hasData: buckets.some((bucket) =>
      bucket.label === "缓存未命中"
      || bucket.label === "缓存命中"
      || bucket.label === "输出"
      || bucket.label === "其中推理"),
    cacheMiss,
    cacheHit,
    output,
    reasoning,
    nonReasoningTokens,
    totalTokens: cacheMiss.tokens + cacheHit.tokens + output.tokens,
  };
}

function findBucket(buckets: readonly TokenBucketView[], label: string): TokenBucketView {
  return buckets.find((bucket) => bucket.label === label) ?? {
    label,
    tokens: 0,
    amount: createUnavailableAmountView(),
    unitPrice: null,
  };
}
