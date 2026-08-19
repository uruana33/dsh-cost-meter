import { expect, test } from "vitest";

import {
  createMyMeterHostRuntime,
  type DshEventContext,
} from "../../packages/plugin/src/index";
import {
  buildSessionCostTree,
  type SessionCostTreeEvent,
} from "../../packages/plugin/src/session-cost-tree";
import { createEmptySummary, type LedgerAggregation, type LedgerSummary } from "../../packages/host/src";

test("builds a session cost tree and rolls child costs into subtree summaries", () => {
  const aggregation = aggregationFrom([
    summary("root", 100),
    summary("child-a", 30),
    summary("child-b", 20),
    summary("grandchild", 5),
  ]);
  const tree = buildSessionCostTree({
    aggregation,
    events: [
      event("root", undefined, "2026-08-19T00:00:00.000Z"),
      event("child-a", "root", "2026-08-19T00:01:00.000Z"),
      event("child-b", "root", "2026-08-19T00:02:00.000Z"),
      event("grandchild", "child-a", "2026-08-19T00:03:00.000Z"),
    ],
    details: { root: { id: "root" }, "child-a": { id: "child-a" } },
  });

  expect(tree.roots.map((node) => node.id)).toEqual(["root"]);
  expect(tree.nodes.root?.childSessionIds).toEqual(["child-a", "child-b"]);
  expect(tree.nodes["child-a"]?.childSessionIds).toEqual(["grandchild"]);
  expect(tree.nodes.root?.subtreeSummary.totalMicroCny).toBe(155);
  expect(tree.nodes["child-a"]?.subtreeSummary.totalMicroCny).toBe(35);
  expect(tree.nodes["grandchild"]?.depth).toBe(2);
  expect(tree.nodes["grandchild"]?.path).toEqual(["root", "child-a", "grandchild"]);
  expect(tree.nodes.root?.detail).toEqual({ id: "root" });
  expect(tree.anomalies).toEqual({ missingParents: [], cycles: [] });
});

test("promotes sessions with missing parents to orphan roots without losing totals", () => {
  const tree = buildSessionCostTree({
    aggregation: aggregationFrom([summary("orphan", 42), summary("known-root", 7)]),
    events: [
      event("orphan", "missing-parent", "2026-08-19T00:01:00.000Z"),
      event("known-root", undefined, "2026-08-19T00:00:00.000Z"),
    ],
  });

  expect(tree.roots.map((node) => node.id)).toEqual(["known-root", "orphan"]);
  expect(tree.nodes.orphan?.orphaned).toBe(true);
  expect(tree.nodes.orphan?.parentSessionId).toBe("missing-parent");
  expect(tree.nodes.orphan?.subtreeSummary.totalMicroCny).toBe(42);
  expect(tree.anomalies.missingParents).toEqual([{ sessionId: "orphan", parentSessionId: "missing-parent" }]);
});

test("breaks cyclic parent links and avoids double-counting cycle members", () => {
  const tree = buildSessionCostTree({
    aggregation: aggregationFrom([
      summary("cycle-a", 10),
      summary("cycle-b", 20),
      summary("cycle-child", 3),
    ]),
    events: [
      event("cycle-a", "cycle-b", "2026-08-19T00:00:00.000Z"),
      event("cycle-b", "cycle-a", "2026-08-19T00:01:00.000Z"),
      event("cycle-child", "cycle-a", "2026-08-19T00:02:00.000Z"),
    ],
  });

  expect(tree.roots.map((node) => node.id)).toEqual(["cycle-a", "cycle-b"]);
  expect(tree.nodes["cycle-a"]?.cyclic).toBe(true);
  expect(tree.nodes["cycle-b"]?.cyclic).toBe(true);
  expect(tree.nodes["cycle-a"]?.childSessionIds).toEqual(["cycle-child"]);
  expect(tree.nodes["cycle-a"]?.subtreeSummary.totalMicroCny).toBe(13);
  expect(tree.nodes["cycle-b"]?.subtreeSummary.totalMicroCny).toBe(20);
  expect(tree.anomalies.cycles).toEqual([["cycle-a", "cycle-b"]]);
});

test("uses runtime events, aggregation, and details as the tree inputs", () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });

  dsh.emit("mymeter:final_usage", usagePayload("root-session"));
  dsh.emit("mymeter:final_usage", usagePayload("child-session", "root-session"));

  const snapshot = runtime.remote.getSnapshot();
  const tree = buildSessionCostTree({
    aggregation: runtime.aggregation(),
    events: runtime.events(),
    details: snapshot.details,
  });

  expect(tree.roots.map((node) => node.id)).toEqual(["root-session"]);
  expect(tree.nodes["root-session"]?.childSessionIds).toEqual(["child-session"]);
  expect(tree.nodes["root-session"]?.subtreeSummary.totalMicroCny).toBe(runtime.ledger().totalMicroCny);
  expect(tree.nodes["child-session"]?.detail?.id).toBe("child-session");
  runtime.uninstall();
});

function event(
  sessionId: string,
  parentSessionId: string | undefined,
  requestStartedAt: string,
): SessionCostTreeEvent {
  return {
    sessionId,
    parentSessionId,
    requestStartedAt,
    completedAt: requestStartedAt,
  };
}

function usagePayload(sessionId: string, parentSessionId?: string) {
  return {
    id: `req-${sessionId}`,
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    metadata: {
      sessionId,
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-1",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "standard",
      agentPreset: "perf",
      ...(parentSessionId ? { parentSessionId } : {}),
    },
    completedAt: "2026-08-17T04:00:05.000Z",
    usage: {
      cacheHitTokens: 1_000_000,
      cacheMissTokens: 1_000_000,
      outputTokens: 1_000_000,
      reasoningTokens: 400_000,
    },
    requestOutcome: "success",
  };
}

class FakeDshContext implements DshEventContext {
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();

  on(event: string, listener: (payload: unknown) => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => {
      listeners.delete(listener);
    };
  }

  emit(event: string, payload: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(payload);
  }
}

function summary(sessionId: string, totalMicroCny: number): [string, LedgerSummary] {
  const result = createEmptySummary();
  result.requestCount = 1;
  result.totalMicroCny = totalMicroCny;
  result.settledMicroCny = totalMicroCny;
  result.settledCount = 1;
  result.firstSeenAt = `2026-08-19T00:00:${String(totalMicroCny).padStart(2, "0")}.000Z`;
  result.lastSeenAt = result.firstSeenAt;
  result.provider = "deepseek";
  result.model = "deepseek-v4-flash";
  result.reasoningEffort = "standard";
  result.agentPreset = sessionId;
  return [sessionId, result];
}

function aggregationFrom(summaries: Array<[string, LedgerSummary]>): LedgerAggregation {
  const global = createEmptySummary();
  for (const [, item] of summaries) {
    global.requestCount += item.requestCount;
    global.totalMicroCny += item.totalMicroCny;
    global.settledMicroCny += item.settledMicroCny;
    global.settledCount += item.settledCount;
  }
  return {
    global,
    sessions: new Map(summaries),
    days: new Map(),
  };
}
