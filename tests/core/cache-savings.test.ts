import { strict as assert } from "node:assert";

import { calculateCacheHitSavings } from "../../packages/core/src/cache-savings";

test("cache savings compares actual input cost with an uncached baseline", () => {
  const result = calculateCacheHitSavings({
    cacheHitTokens: 1_000_000n,
    cacheMissTokens: 500_000n,
    cacheHitRateMinorPerMillionTokens: 100_000n,
    cacheMissRateMinorPerMillionTokens: 2_000_000n,
  });

  assert.deepEqual(result, {
    actualMinor: 1_100_000n,
    uncachedBaselineMinor: 3_000_000n,
    savedMinor: 1_900_000n,
    savingsRateBasisPoints: 6_333,
  });
});

test("cache savings uses exact rounded bigint pricing and never reports negative savings", () => {
  assert.deepEqual(calculateCacheHitSavings({
    cacheHitTokens: 1n,
    cacheMissTokens: 0n,
    cacheHitRateMinorPerMillionTokens: 500_000n,
    cacheMissRateMinorPerMillionTokens: 1_000_000n,
  }), {
    actualMinor: 1n,
    uncachedBaselineMinor: 1n,
    savedMinor: 0n,
    savingsRateBasisPoints: 0,
  });

  assert.equal(calculateCacheHitSavings({
    cacheHitTokens: 100n,
    cacheMissTokens: 0n,
    cacheHitRateMinorPerMillionTokens: 2_000_000n,
    cacheMissRateMinorPerMillionTokens: 1_000_000n,
  }).savedMinor, 0n);
});

test("cache savings rejects negative tokens and rates", () => {
  assert.throws(() => calculateCacheHitSavings({
    cacheHitTokens: -1n,
    cacheMissTokens: 0n,
    cacheHitRateMinorPerMillionTokens: 0n,
    cacheMissRateMinorPerMillionTokens: 0n,
  }), /non-negative/);
});
