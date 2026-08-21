import { expect, test } from "vitest";

import {
  createHostUsageOverview,
  createInMemoryCostEventRepository,
  type CostEventInput,
} from "../../packages/host/src/index";

test("host usage overview accepts normalized arrays and deduplicates event identities", () => {
  const duplicate = event("evt-1", "2026-08-20T01:00:00.000Z", 100);
  const report = createHostUsageOverview([duplicate, duplicate], {
    range: "today",
    now: "2026-08-20T06:00:00.000Z",
  });

  expect(report.totals).toMatchObject({ requestCount: 1, amountMicroCny: 100, totalTokens: 10 });
});

test("host usage overview reads through the repository boundary", () => {
  const repository = createInMemoryCostEventRepository([
    event("evt-1", "2026-08-19T01:00:00.000Z", 100),
    event("evt-2", "2026-08-20T01:00:00.000Z", 200, { model: "deepseek-reasoner" }),
  ]);
  const report = createHostUsageOverview(repository, {
    range: "7d",
    now: "2026-08-20T06:00:00.000Z",
  });

  expect(report.trend).toHaveLength(7);
  expect(report.totals.amountMicroCny).toBe(300);
  expect(report.topModels[0]?.model).toBe("deepseek-reasoner");
});

function event(
  id: string,
  requestStartedAt: string,
  amountMicroCny: number,
  patch: Partial<CostEventInput> = {},
): CostEventInput {
  return {
    id,
    sessionId: "sess-usage",
    requestStartedAt,
    amountMicroCny,
    status: patch.status ?? "settled",
    source: "final_usage",
    turnId: id,
    stepId: "step",
    attemptId: "attempt",
    provider: patch.provider ?? "deepseek",
    model: patch.model ?? "deepseek-chat",
    cacheHitTokens: patch.cacheHitTokens ?? 1,
    cacheMissTokens: patch.cacheMissTokens ?? 2,
    cacheWriteTokens: patch.cacheWriteTokens ?? 3,
    outputTokens: patch.outputTokens ?? 4,
    reasoningTokens: patch.reasoningTokens ?? 2,
  };
}
