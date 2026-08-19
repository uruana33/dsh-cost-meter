import { expect, test } from "vitest";

import {
  createHostCostAnalyticsReport,
  createInMemoryCostEventRepository,
  type CostEventInput,
} from "../../packages/host/src/index";

test("host analytics accepts normalized ledger inputs without depending on Remote DTOs", () => {
  const report = createHostCostAnalyticsReport([
    event("evt-1", "sess-a", "2026-08-17T01:00:00.000Z", 100),
    event("evt-1", "sess-a", "2026-08-17T01:00:00.000Z", 100),
    event("evt-2", "sess-b", "2026-08-18T01:00:00.000Z", 500),
  ], { recentBucketLimit: 10 });

  expect(report.dailyTrend.map((bucket) => [bucket.key, bucket.amountMicroCny])).toEqual([
    ["2026-08-17", 100],
    ["2026-08-18", 500],
  ]);
  expect(report.global.totalMicroCny).toBe(600);
  expect(report.global.requestCount).toBe(2);
  expect(report.sessions.map((session) => session.sessionId).sort()).toEqual(["sess-a", "sess-b"]);
});

test("host analytics can read from a repository boundary", () => {
  const repository = createInMemoryCostEventRepository([
    event("evt-1", "sess-a", "2026-08-17T01:00:00.000Z", 100),
    event("evt-2", "sess-b", "2026-08-18T00:00:00.000Z", 1_700),
    event("evt-3", "sess-b", "2026-08-18T09:00:00.000Z", 100, { status: "failed" }),
    event("evt-4", "sess-b", "2026-08-18T10:00:00.000Z", 100, { status: "unknown" }),
  ]);

  const report = createHostCostAnalyticsReport(repository, {
    dailySpikeBaselineBuckets: 1,
    dailySpikeRatio: 4,
    dailySpikeMinDeltaMicroCny: 1_000,
    minimumRequestsForRateAnomaly: 2,
    failedRateThreshold: 0.3,
    unknownRateThreshold: 0.2,
  });

  expect(report.global.totalMicroCny).toBe(1_900);
  expect(report.dailyTrend.at(-1)?.statusCounts).toMatchObject({ failed: 1, unknown: 1 });
  expect(report.anomalies.some((anomaly) => anomaly.ruleId === "daily_spend_spike")).toBe(true);
  expect(report.anomalies.some((anomaly) => anomaly.ruleId === "hourly_spend_concentration")).toBe(true);
  expect(report.anomalies.some((anomaly) => anomaly.ruleId === "unknown_rate_high")).toBe(true);
  expect(report.anomalies.some((anomaly) => anomaly.ruleId === "failed_rate_high")).toBe(true);
});

function event(
  id: string,
  sessionId: string,
  requestStartedAt: string,
  amountMicroCny: number,
  patch: Partial<CostEventInput> = {},
): CostEventInput {
  return {
    id,
    sessionId,
    requestStartedAt,
    amountMicroCny,
    status: patch.status ?? "settled",
    source: patch.source ?? "final_usage",
    pricingZone: patch.pricingZone ?? "peak",
    turnId: patch.turnId ?? id,
    stepId: patch.stepId ?? "step",
    attemptId: patch.attemptId ?? "attempt",
    provider: patch.provider ?? "deepseek",
    model: patch.model ?? "deepseek-v4-flash",
    reasoningEffort: patch.reasoningEffort ?? "high",
    agentPreset: patch.agentPreset ?? "Coding",
    cacheHitTokens: patch.cacheHitTokens ?? 0,
    cacheMissTokens: patch.cacheMissTokens ?? 0,
    outputTokens: patch.outputTokens ?? 0,
    reasoningTokens: patch.reasoningTokens ?? 0,
  };
}
