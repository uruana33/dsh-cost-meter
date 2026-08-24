import { expect, test } from "vitest";

import {
  HISTORY_BACKFILL_SIZES,
  type HistoryBackfillMetrics,
  measureHistoryBackfill,
} from "./history-backfill.fixture";

test.each(HISTORY_BACKFILL_SIZES)("measures %d cold sessions without blocking apply", async (sessionCount) => {
  const metrics = await measureHistoryBackfill(sessionCount);
  console.log("mymeter history baseline", JSON.stringify(metrics));

  expectCommonMetrics(metrics, sessionCount);
  expect(metrics.applyMs).toBeLessThan(250);
  expect(metrics.replaceAllCalls).toBeLessThanOrEqual(Math.ceil(sessionCount / 8) + 2);
}, 20_000);

test("measures persistence fallback at the representative 100-session size", async () => {
  const metrics = await measureHistoryBackfill(100, "persistence");
  console.log("mymeter history baseline", JSON.stringify(metrics));
  expectCommonMetrics(metrics, 100);
}, 20_000);

test("waits for completed cold reads before reporting backfill timing", async () => {
  const metrics = await measureHistoryBackfill(4, "query", { readDelayMs: 2 });

  expectCommonMetrics(metrics, 4);
  expect(metrics.backfillMs).toBeGreaterThanOrEqual(4);
}, 20_000);

function expectCommonMetrics(metrics: HistoryBackfillMetrics, sessionCount: number): void {
  expect(metrics.sessionListCalls).toBeGreaterThan(0);
  expect(metrics.sessionReadCalls).toBe(sessionCount);
  expect(metrics.liveEventCount).toBe(1);
  expect(metrics.liveLatencyMs).toBeGreaterThan(0);
  expect(Number.isFinite(metrics.eventLoopLagMs)).toBe(true);
  expect(metrics.eventLoopLagMs).toBeGreaterThanOrEqual(0);
  expect(metrics.ledgerFinalBytes).toBeGreaterThan(0);
  expect(metrics.ledgerWriteBytes).toBeGreaterThanOrEqual(metrics.ledgerFinalBytes);
  expect(metrics.snapshotSessionCount).toBe(expectedBillableSessionCount(sessionCount) + metrics.liveEventCount);
  // Slim snapshot contract: summaries for every session, exactly one embedded detail.
  expect(metrics.snapshotDetailCount).toBe(1);
}

function expectedBillableSessionCount(sessionCount: number): number {
  const idleCount = Math.max(1, Math.floor(sessionCount * 0.14));
  return sessionCount - idleCount;
}
