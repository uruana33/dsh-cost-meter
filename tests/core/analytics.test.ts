import { expect, test } from "vitest";

import { createCostAnalyticsReport, type CostAnalyticsEventInput } from "../../packages/core/src/index";

test("builds daily and hourly trend buckets with explainable deltas", () => {
  const report = createCostAnalyticsReport([
    event("evt-1", "2026-08-17T01:00:00.000Z", 100),
    event("evt-2", "2026-08-17T01:20:00.000Z", 50),
    event("evt-3", "2026-08-18T01:00:00.000Z", 300),
    event("evt-4", "2026-08-18T09:00:00.000Z", 100),
  ], { recentBucketLimit: 10 });

  expect(report.dailyTrend.map((bucket) => ({
    key: bucket.key,
    amountMicroCny: bucket.amountMicroCny,
    previousAmountMicroCny: bucket.previousAmountMicroCny,
    deltaMicroCny: bucket.deltaMicroCny,
    deltaRatio: bucket.deltaRatio,
  }))).toEqual([
    {
      key: "2026-08-17",
      amountMicroCny: 150,
      previousAmountMicroCny: null,
      deltaMicroCny: null,
      deltaRatio: null,
    },
    {
      key: "2026-08-18",
      amountMicroCny: 400,
      previousAmountMicroCny: 150,
      deltaMicroCny: 250,
      deltaRatio: 400 / 150,
    },
  ]);
  expect(report.hourlyTrend.map((bucket) => [bucket.key, bucket.amountMicroCny])).toEqual([
    ["2026-08-17T01", 150],
    ["2026-08-18T01", 300],
    ["2026-08-18T09", 100],
  ]);
  expect(report.generatedAt).toBe("2026-08-18T09:00:00.000Z");
});

test("flags daily spend spikes, hourly concentration, and quality-rate anomalies with evidence", () => {
  const report = createCostAnalyticsReport([
    event("day-1-a", "2026-08-17T00:00:00.000Z", 100, { status: "settled" }),
    event("day-1-b", "2026-08-17T01:00:00.000Z", 100, { status: "settled" }),
    event("day-2-a", "2026-08-18T00:00:00.000Z", 120, { status: "settled" }),
    event("day-2-b", "2026-08-18T01:00:00.000Z", 120, { status: "settled" }),
    event("day-3-a", "2026-08-19T00:00:00.000Z", 110, { status: "settled" }),
    event("day-3-b", "2026-08-19T01:00:00.000Z", 110, { status: "settled" }),
    event("day-4-spike", "2026-08-20T00:00:00.000Z", 1_400, { status: "settled" }),
    event("day-4-unknown", "2026-08-20T00:10:00.000Z", 0, { status: "unknown" }),
    event("day-4-failed", "2026-08-20T00:20:00.000Z", 400, { status: "failed" }),
    event("day-4-ok", "2026-08-20T09:00:00.000Z", 100, { status: "settled" }),
  ], {
    dailySpikeBaselineBuckets: 3,
    dailySpikeRatio: 4,
    dailySpikeMinDeltaMicroCny: 1_000,
    hourlyConcentrationRatio: 0.7,
    minimumRequestsForRateAnomaly: 3,
    unknownRateThreshold: 0.25,
    failedRateThreshold: 0.25,
  });

  expect(report.anomalies.map((anomaly) => anomaly.ruleId).sort()).toEqual([
    "daily_spend_spike",
    "failed_rate_high",
    "hourly_spend_concentration",
    "unknown_rate_high",
  ]);
  expect(report.anomalies.find((anomaly) => anomaly.ruleId === "daily_spend_spike")).toMatchObject({
    bucketKey: "2026-08-20",
    observedMicroCny: 1_900,
    baselineMicroCny: 220,
    severity: "warning",
  });
  expect(report.anomalies.find((anomaly) => anomaly.ruleId === "hourly_spend_concentration")).toMatchObject({
    bucketKey: "2026-08-20T00",
    observedMicroCny: 1_800,
    baselineMicroCny: 1_900,
    severity: "info",
  });
  expect(report.anomalies.find((anomaly) => anomaly.ruleId === "unknown_rate_high")).toMatchObject({
    bucketKey: "2026-08-20",
    observedCount: 1,
    baselineCount: 4,
  });
  expect(report.anomalies.every((anomaly) => anomaly.explanation.length > 0)).toBe(true);
});

test("skips malformed event timestamps instead of assigning them to the Unix epoch", () => {
  const report = createCostAnalyticsReport([
    event("bad", "not-a-timestamp", 999),
    event("good", "2026-08-20T00:00:00.000Z", 100),
  ], { now: "2026-08-20T01:00:00.000Z" });

  expect(report.global.totalMicroCny).toBe(100);
  expect(report.global.requestCount).toBe(1);
  expect(report.dailyTrend.map((bucket) => bucket.key)).toEqual(["2026-08-20"]);
});

function event(
  id: string,
  requestStartedAt: string,
  amountMicroCny: number,
  patch: Partial<CostAnalyticsEventInput> = {},
): CostAnalyticsEventInput {
  return {
    id,
    requestStartedAt,
    amountMicroCny,
    status: patch.status ?? "settled",
    pricingZone: patch.pricingZone ?? "peak",
    sessionId: patch.sessionId ?? "sess-analytics",
  };
}
