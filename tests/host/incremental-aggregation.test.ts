import { expect, test } from "vitest";

import { createIncrementalLedgerAggregator } from "../../packages/host/src/incremental-aggregation.js";
import { createLedgerAggregator } from "../../packages/host/src/ledger.js";
import type { CostEventInput, CostEventRecord } from "../../packages/host/src";

function baseEvent(overrides: Partial<CostEventInput> & { id: string }): CostEventInput {
  return {
    sessionId: "sess-1",
    turnId: "turn-1",
    stepId: "step-1",
    attemptId: "attempt-1",
    requestStartedAt: "2026-08-17T04:00:00.000Z",
    status: "settled",
    source: "final_usage",
    amountMicroCny: 1_000,
    provider: "deepseek",
    model: "deepseek-v4-flash",
    pricingZone: "offpeak",
    cacheHitTokens: 10,
    cacheMissTokens: 20,
    outputTokens: 30,
    reasoningTokens: 5,
    ...overrides,
  };
}

function expectSameAggregation(
  actual: ReturnType<ReturnType<typeof createLedgerAggregator>["aggregate"]>,
  expected: ReturnType<ReturnType<typeof createLedgerAggregator>["aggregate"]>,
  message: string,
): void {
  const pick = (summary: CostEventRecord | typeof expected.global) => summary;
  expect(pick(actual.global), `${message} (global)`).toEqual(expected.global);
  expect(actual.sessions.size, `${message} (session count)`).toBe(expected.sessions.size);
  for (const [sessionId, summary] of expected.sessions) {
    expect(actual.sessions.get(sessionId), `${message} (session ${sessionId})`).toEqual(summary);
  }
  expect(actual.days.size, `${message} (day count)`).toBe(expected.days.size);
  for (const [dayKey, summary] of expected.days) {
    expect(actual.days.get(dayKey), `${message} (day ${dayKey})`).toEqual(summary);
  }
}

test("incremental aggregation matches a full replay for fresh inserts", () => {
  const incremental = createIncrementalLedgerAggregator();
  const full = createLedgerAggregator();
  // Distinct canonical identities (session-turn-step-attempt), mirroring what
  // a journal can actually hold simultaneously.
  const events = [
    baseEvent({ id: "evt-1" }),
    baseEvent({ id: "evt-2", sessionId: "sess-2", turnId: "turn-2", requestStartedAt: "2026-08-18T09:30:00.000Z", pricingZone: "peak", amountMicroCny: 2_500 }),
    baseEvent({ id: "evt-3", status: "estimated", source: "stream", attemptId: "attempt-2", requestStartedAt: "2026-08-17T23:59:00.000Z" }),
    baseEvent({ id: "evt-4", status: "unknown", amountMicroCny: 0, model: undefined, attemptId: "attempt-3" }),
  ];

  for (const event of events) {
    incremental.apply(undefined, event);
  }
  expectSameAggregation(incremental.snapshot(), full.aggregate(events), "fresh inserts");
});

test("incremental aggregation matches a full replay when estimates are replaced by final usage", () => {
  const incremental = createIncrementalLedgerAggregator();
  const full = createLedgerAggregator();
  const estimate = baseEvent({
    id: "req-1",
    status: "estimated",
    source: "stream",
    amountMicroCny: 300,
    outputTokens: 100,
  });
  const settled = baseEvent({
    id: "req-1:final",
    status: "settled",
    source: "final_usage",
    amountMicroCny: 4_200,
    cacheHitTokens: 500,
    cacheMissTokens: 900,
    outputTokens: 700,
    reasoningTokens: 200,
  });

  incremental.apply(undefined, estimate);
  incremental.apply(estimate, settled);

  // The journal keeps one logical event per identity after replacement; the
  // full aggregator replays exactly that surviving set.
  expectSameAggregation(incremental.snapshot(), full.aggregate([settled]), "estimate replaced");
});

test("incremental aggregation matches a full replay under a randomized mutation sequence", () => {
  const seededRandom = createSeededRandom(20260822);
  const incremental = createIncrementalLedgerAggregator();
  const sessions = ["sess-a", "sess-b", "sess-c"];
  const statuses: CostEventInput["status"][] = ["estimated", "settled", "failed", "unknown"];
  const zones: NonNullable<CostEventInput["pricingZone"]>[] = ["peak", "offpeak", "unknown"];

  const live = new Map<string, CostEventInput>();
  const replay: CostEventInput[] = [];

  for (let step = 0; step < 400; step += 1) {
    const index = Math.floor(seededRandom() * 60);
    const id = `evt-${index}`;
    // Identity fields (session-turn-step-attempt) are fixed per index, the
    // way a journal enforces canonical uniqueness; replacements then target
    // the same identity, exactly like projection -> final usage corrections.
    const next: CostEventInput = {
      ...baseEvent({
        id,
        sessionId: sessions[index % sessions.length]!,
        turnId: `turn-${index}`,
        attemptId: `attempt-${index}`,
        requestStartedAt: new Date(Date.UTC(2026, 7, 1 + Math.floor(seededRandom() * 20), Math.floor(seededRandom() * 24))).toISOString(),
        status: statuses[Math.floor(seededRandom() * statuses.length)]!,
        pricingZone: zones[Math.floor(seededRandom() * zones.length)]!,
        amountMicroCny: Math.floor(seededRandom() * 50_000),
        cacheHitTokens: Math.floor(seededRandom() * 5_000),
        cacheMissTokens: Math.floor(seededRandom() * 5_000),
        outputTokens: Math.floor(seededRandom() * 5_000),
        reasoningTokens: Math.floor(seededRandom() * 2_000),
      }),
    };

    const previous = live.get(id);
    incremental.apply(previous, next);
    live.set(id, next);

    replay.length = 0;
    for (const event of live.values()) replay.push(event);

    if (step % 25 === 0 || step === 399) {
      expectSameAggregation(
        incremental.snapshot(),
        createLedgerAggregator().aggregate(replay),
        `step ${step}`,
      );
    }
  }
});

test("boundary metadata survives replacing the newest event and removing whole timestamps", () => {
  const incremental = createIncrementalLedgerAggregator();
  const first = baseEvent({ id: "evt-old", requestStartedAt: "2026-08-17T01:00:00.000Z", model: "deepseek-v4-flash" });
  const newest = baseEvent({ id: "evt-new", requestStartedAt: "2026-08-17T05:00:00.000Z", model: "deepseek-v4-pro" });

  incremental.apply(undefined, first);
  incremental.apply(undefined, newest);
  expect(incremental.snapshot().global.lastSeenAt).toBe("2026-08-17T05:00:00.000Z");
  expect(incremental.snapshot().global.model).toBe("deepseek-v4-pro");

  // Replace the newest event with another at the same timestamp.
  const replacement = { ...newest, id: "evt-new-2", outputTokens: 999 };
  incremental.apply(newest, replacement);
  expect(incremental.snapshot().global.lastSeenAt).toBe("2026-08-17T05:00:00.000Z");
  expect(incremental.snapshot().global.model).toBe("deepseek-v4-pro");

  // Remove every participant of the boundary timestamp: boundaries retreat.
  incremental.apply(replacement, undefined);
  const snapshot = incremental.snapshot();
  expect(snapshot.global.lastSeenAt).toBe("2026-08-17T01:00:00.000Z");
  expect(snapshot.global.model).toBe("deepseek-v4-flash");
  expect(snapshot.global.requestCount).toBe(1);
  expect(snapshot.global.outputTokens).toBe(first.outputTokens);
});

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
