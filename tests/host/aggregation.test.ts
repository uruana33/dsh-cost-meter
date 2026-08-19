import { expect, test } from "vitest";

import { createLedgerAggregator } from "../../packages/host/src/index";

test("aggregator splits session, day, global, and unknown totals", () => {
  const aggregate = createLedgerAggregator().aggregate([
    {
      id: "evt-1",
      sessionId: "sess-1",
      status: "estimated",
      amountMicroCny: 100,
      requestStartedAt: "2026-08-17T01:00:00.000Z",
      pricingZone: "peak",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
      source: "stream",
    },
    {
      id: "evt-2",
      sessionId: "sess-1",
      status: "settled",
      amountMicroCny: 300,
      requestStartedAt: "2026-08-17T01:30:00.000Z",
      pricingZone: "offpeak",
      model: "deepseek-v4-pro",
      reasoningEffort: "medium",
      agentPreset: "Research",
      source: "final_usage",
    },
    {
      id: "evt-3",
      sessionId: "sess-2",
      status: "unknown",
      amountMicroCny: 0,
      requestStartedAt: "2026-08-17T02:00:00.000Z",
      pricingZone: "unknown",
      model: "unknown",
      reasoningEffort: "unknown",
      agentPreset: "unknown",
      source: "projection",
    },
  ]);

  expect(aggregate.global.totalMicroCny).toBe(400);
  expect(aggregate.global.estimatedMicroCny).toBe(100);
  expect(aggregate.global.settledMicroCny).toBe(300);
  expect(aggregate.global.unknownCount).toBe(1);
  expect(aggregate.global.peakMicroCny).toBe(100);
  expect(aggregate.global.offpeakMicroCny).toBe(300);
  expect(aggregate.global.model).toBe("deepseek-v4-pro");
  expect(aggregate.sessions.get("sess-1")?.totalMicroCny).toBe(400);
  expect(aggregate.sessions.get("sess-1")?.model).toBe("deepseek-v4-pro");
  expect(aggregate.sessions.get("sess-2")?.unknownCount).toBe(1);
  expect(aggregate.days.get("2026-08-17")?.totalMicroCny).toBe(400);
});
