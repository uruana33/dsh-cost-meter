import { describe, expect, test } from "vitest";

import type { CostEventInput } from "../../packages/host/src";
import { createLedgerAggregator } from "../../packages/host/src";
import { createCostEventJournal, estimateDeepSeekCostEvent } from "../../packages/core/src";
import {
  createMockRemoteFixtures,
  createMyMeterStore,
  type MyMeterRemote,
  type MyMeterRemoteSnapshot,
} from "../../packages/client/src";

class PushRemote implements MyMeterRemote {
  private snapshot: MyMeterRemoteSnapshot;
  private readonly listeners = new Set<(snapshot: MyMeterRemoteSnapshot) => void>();

  constructor(snapshot: MyMeterRemoteSnapshot) {
    this.snapshot = snapshot;
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  getSnapshot(): MyMeterRemoteSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  subscribe(listener: (snapshot: MyMeterRemoteSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  push(snapshot: MyMeterRemoteSnapshot): void {
    this.snapshot = cloneSnapshot(snapshot);
    const current = cloneSnapshot(this.snapshot);
    for (const listener of this.listeners) {
      listener(current);
    }
  }
}

describe("MyMeter 性能和长时间运行契约", () => {
  test("费用 journal 对大量唯一请求保持索引化 upsert", () => {
    const template = estimateDeepSeekCostEvent({
      id: "event-0",
      sessionId: "session-0",
      turnId: "turn-0",
      stepId: "step-1",
      attemptId: "attempt-1",
      model: "deepseek-v4-flash",
      requestStartedAt: "2026-08-17T12:00:00+08:00",
      usageProjection: { outputTokens: 1 },
    });
    const journal = createCostEventJournal();
    const startedAt = performance.now();

    for (let index = 0; index < 5_000; index += 1) {
      const identity = {
        sessionId: `session-${index % 200}`,
        turnId: `turn-${index}`,
        stepId: "step-1",
        attemptId: "attempt-1",
      };
      journal.upsert({
        ...template,
        ...identity,
        id: `event-${index}`,
        eventKey: `${identity.sessionId}:${identity.turnId}:${identity.stepId}:${identity.attemptId}`,
      });
    }

    const durationMs = performance.now() - startedAt;
    expect(journal.list()).toHaveLength(5_000);
    expect(durationMs).toBeLessThan(750);
  });

  test("高频 projection 更新只替换当前快照，不让会话和轮次数组无界增长", () => {
    const base = createMockRemoteFixtures().billing;
    const remote = new PushRemote(base);
    const store = createMyMeterStore({ remote, storage: null });
    let subscriberCalls = 0;
    let maxSessionCount = 0;
    let maxTurnCount = 0;

    const unsubscribe = store.subscribe(() => {
      subscriberCalls += 1;
      const viewModel = store.getState().viewModel;
      maxSessionCount = Math.max(maxSessionCount, viewModel.sessions.length);
      maxTurnCount = Math.max(maxTurnCount, viewModel.detail?.turns.length ?? 0);
    });

    for (let index = 1; index <= 1_000; index += 1) {
      remote.push(createProjectionSnapshot(base, index));
    }

    const state = store.getState();
    expect(subscriberCalls).toBe(1_000);
    expect(maxSessionCount).toBe(2);
    expect(maxTurnCount).toBe(2);
    expect(state.viewModel.sessions).toHaveLength(2);
    expect(state.viewModel.detail?.turns).toHaveLength(2);
    expect(state.viewModel.currentRequest.microCny).toBe(25_000);
    expect(state.viewModel.detail?.tokenBuckets.find((bucket) => bucket.label === "输出")?.tokens).toBe(4_000);
    expect(remote.listenerCount).toBe(1);

    unsubscribe();
    store.destroy();
    remote.push(createProjectionSnapshot(base, 1_001));

    expect(remote.listenerCount).toBe(0);
    expect(subscriberCalls).toBe(1_000);
  });

  test("大账本聚合在重放估算和最终结算时保持有界分组并得出最终累计", () => {
    const logicalRequestCount = 10_000;
    const sessionCount = 200;
    const events = createLargeLedgerEvents(logicalRequestCount, sessionCount);
    const aggregate = createLedgerAggregator().aggregate(events);

    expect(events).toHaveLength(logicalRequestCount * 2);
    expect(aggregate.global.requestCount).toBe(logicalRequestCount);
    expect(aggregate.global.estimatedCount).toBe(0);
    expect(aggregate.global.settledCount).toBe(logicalRequestCount);
    expect(aggregate.sessions.size).toBe(sessionCount);
    expect(aggregate.days.size).toBe(3);
    expect(aggregate.global.totalMicroCny).toBe(sumArithmeticSeries(logicalRequestCount, 2));
    expect(aggregate.global.peakMicroCny).toBe(sumByParity(logicalRequestCount, "even"));
    expect(aggregate.global.offpeakMicroCny).toBe(sumByParity(logicalRequestCount, "odd"));
    expect(aggregate.global.cacheHitTokens).toBe(sumModulo(logicalRequestCount, 7));
    expect(aggregate.global.cacheMissTokens).toBe(logicalRequestCount * 3);
    expect(aggregate.global.outputTokens).toBe(logicalRequestCount * 5);
    expect(aggregate.global.reasoningTokens).toBe(logicalRequestCount * 2);

    const sessionZero = aggregate.sessions.get("sess-0");
    expect(sessionZero?.requestCount).toBe(logicalRequestCount / sessionCount);
    expect(sessionZero?.settledMicroCny).toBe(sumSessionTotals(logicalRequestCount, sessionCount, 0));
  });
});

function createProjectionSnapshot(base: MyMeterRemoteSnapshot, index: number): MyMeterRemoteSnapshot {
  const snapshot = cloneSnapshot(base);
  const amountMicroCny = index * 25;
  const outputTokens = index * 4;
  snapshot.summary.currentRequestMicroCny = amountMicroCny;
  snapshot.summary.estimatedTotalMicroCny = amountMicroCny;
  snapshot.summary.localTotalMicroCny = 2_483_000 + amountMicroCny;

  const session = snapshot.sessions.find((item) => item.id === "sess-1");
  if (session) {
    session.status = "billing";
    session.currentRequestMicroCny = amountMicroCny;
    session.sessionTotalMicroCny = 122_000 + amountMicroCny;
  }

  const detail = snapshot.details["sess-1"];
  if (detail) {
    detail.status = "billing";
    detail.currentRequestMicroCny = amountMicroCny;
    detail.sessionTotalMicroCny = 122_000 + amountMicroCny;
    detail.estimatedTotalMicroCny = amountMicroCny;
    const outputBucket = detail.tokenBuckets.find((bucket) => bucket.label === "输出");
    if (outputBucket) {
      outputBucket.tokens = outputTokens;
      outputBucket.amountMicroCny = amountMicroCny;
    }
    const activeTurn = detail.turns.at(-1);
    if (activeTurn) {
      activeTurn.outputTokens = outputTokens;
      activeTurn.amountMicroCny = amountMicroCny;
      activeTurn.completedAt = null;
      activeTurn.status = "billing";
    }
  }

  return snapshot;
}

function createLargeLedgerEvents(logicalRequestCount: number, sessionCount: number): CostEventInput[] {
  const events: CostEventInput[] = [];
  for (let index = 0; index < logicalRequestCount; index += 1) {
    const sessionId = `sess-${index % sessionCount}`;
    const turnId = `turn-${index}`;
    const requestStartedAt = `2026-08-${String(17 + (index % 3)).padStart(2, "0")}T${String(
      index % 24,
    ).padStart(2, "0")}:00:00.000Z`;
    const common = {
      sessionId,
      turnId,
      stepId: "step-1",
      attemptId: "attempt-1",
      requestStartedAt,
      provider: "deepseek",
      model: index % 2 === 0 ? "deepseek-chat" : "deepseek-reasoner",
      reasoningEffort: index % 2 === 0 ? "medium" : "high",
      agentPreset: index % 5 === 0 ? "Research" : "Coding",
      pricingZone: index % 2 === 0 ? "peak" : "offpeak",
      cacheHitTokens: index % 7,
      cacheMissTokens: 3,
      outputTokens: 5,
      reasoningTokens: 2,
      hitRateMicroCny: 1,
      missRateMicroCny: 2,
      outputRateMicroCny: 3,
      priceVersion: "deepseek-official-pricing-2026-08-17",
    } as const;

    events.push({
      ...common,
      id: `estimate-${index}`,
      status: "estimated",
      source: "projection",
      amountMicroCny: index + 1,
    });
    events.push({
      ...common,
      id: `settled-${index}`,
      status: "settled",
      source: "final_usage",
      amountMicroCny: index + 2,
      completedAt: requestStartedAt,
    });
  }
  return events;
}

function sumArithmeticSeries(count: number, offset: number): number {
  return (count * (count - 1)) / 2 + count * offset;
}

function sumByParity(count: number, parity: "even" | "odd"): number {
  let total = 0;
  for (let index = parity === "even" ? 0 : 1; index < count; index += 2) {
    total += index + 2;
  }
  return total;
}

function sumModulo(count: number, divisor: number): number {
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    total += index % divisor;
  }
  return total;
}

function sumSessionTotals(count: number, sessionCount: number, sessionIndex: number): number {
  let total = 0;
  for (let index = sessionIndex; index < count; index += sessionCount) {
    total += index + 2;
  }
  return total;
}

function cloneSnapshot(snapshot: MyMeterRemoteSnapshot): MyMeterRemoteSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as MyMeterRemoteSnapshot;
}
