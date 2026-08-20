import { expect, test } from "vitest";

import {
  createUsageOverview,
  type UsageOverviewEventInput,
} from "../../packages/core/src/index";

test("usage overview groups today by Shanghai hour and fills all 24 buckets", () => {
  const report = createUsageOverview([
    event("2026-08-19T16:30:00.000Z", { amountMicroCny: 120, cacheHitTokens: 2, cacheMissTokens: 3, cacheWriteTokens: 5, outputTokens: 7 }),
  ], {
    range: "today",
    now: "2026-08-20T06:00:00.000Z",
    timeZone: "Asia/Shanghai",
  });

  expect(report.timeZone).toBe("Asia/Shanghai");
  expect(report.trend).toHaveLength(24);
  expect(report.trend[0]).toMatchObject({ key: "00", requestCount: 1, totalTokens: 17, amountMicroCny: 120 });
  expect(report.trend[1]).toMatchObject({ key: "01", requestCount: 0, coverage: "unavailable" });
  expect(report.totals).toMatchObject({ requestCount: 1, totalTokens: 17, coverage: "complete" });
});

test.each([
  ["7d" as const, 7],
  ["30d" as const, 30],
])("usage overview fills %s natural-day buckets", (range, expectedLength) => {
  const report = createUsageOverview([
    event("2026-08-14T18:00:00.000Z", { amountMicroCny: 40 }),
    event("2026-08-19T18:00:00.000Z", { amountMicroCny: 60 }),
  ], { range, now: "2026-08-20T06:00:00.000Z" });

  expect(report.trend).toHaveLength(expectedLength);
  expect(report.trend.at(-1)).toMatchObject({ key: "2026-08-20", amountMicroCny: 60 });
  expect(report.trend.some((bucket) => bucket.requestCount === 0)).toBe(true);
});

test("usage overview exposes partial pricing coverage and stable top-model ordering", () => {
  const report = createUsageOverview([
    event("2026-08-20T01:00:00.000Z", { model: "model-b", amountMicroCny: 100, outputTokens: 10 }),
    event("2026-08-20T02:00:00.000Z", { model: "model-a", amountMicroCny: 100, outputTokens: 20 }),
    event("2026-08-20T03:00:00.000Z", { model: "model-x", status: "unknown", amountMicroCny: 999, outputTokens: 50 }),
  ], { range: "today", now: "2026-08-20T06:00:00.000Z" });

  expect(report.totals).toMatchObject({
    amountMicroCny: 200,
    requestCount: 3,
    pricedRequestCount: 2,
    unknownRequestCount: 1,
    coverage: "partial",
  });
  expect(report.topModels.map((model) => model.model)).toEqual(["model-a", "model-b", "model-x"]);
  expect(report.topModels[2]).toMatchObject({ amountMicroCny: 0, coverage: "unavailable", totalTokens: 50 });
});

test("usage overview rejects malformed timestamps and falls back from invalid time zones", () => {
  const report = createUsageOverview([
    event("not-a-timestamp", { amountMicroCny: 999 }),
    event("2026-08-20T01:00:00.000Z", { amountMicroCny: 1 }),
  ], { range: "today", now: "2026-08-20T06:00:00.000Z", timeZone: "Invalid/Zone" });

  expect(report.timeZone).toBe("Asia/Shanghai");
  expect(report.totals.requestCount).toBe(1);
  expect(report.totals.amountMicroCny).toBe(1);
});

function event(
  requestStartedAt: string,
  patch: Partial<UsageOverviewEventInput> = {},
): UsageOverviewEventInput {
  return {
    requestStartedAt,
    provider: patch.provider ?? "deepseek",
    model: patch.model ?? "deepseek-chat",
    status: patch.status ?? "settled",
    amountMicroCny: patch.amountMicroCny ?? 0,
    cacheHitTokens: patch.cacheHitTokens ?? 0,
    cacheMissTokens: patch.cacheMissTokens ?? 0,
    cacheWriteTokens: patch.cacheWriteTokens ?? 0,
    outputTokens: patch.outputTokens ?? 0,
  };
}
