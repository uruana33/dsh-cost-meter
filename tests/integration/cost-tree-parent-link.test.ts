import { expect, test } from "vitest";

import {
  createMyMeterCordisHostRuntime,
  type MyMeterCordisContext,
} from "../../packages/plugin/src/cordis-host";

class FakeCordisContext implements MyMeterCordisContext {
  private readonly listeners = new Map<string, Set<(session: unknown, event: unknown) => void>>();

  on(event: string, listener: (session: unknown, event: unknown) => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }

  emit(session: unknown, event: unknown): void {
    for (const listener of this.listeners.get("session/event") ?? []) {
      listener(session, event);
    }
  }
}

function emitRequestTurn(
  ctx: FakeCordisContext,
  session: unknown,
  input: { turn: number; step: number; seq: number; time: number },
): void {
  ctx.emit(session, {
    type: "step/start",
    time: input.time,
    data: { turn: input.turn, step: input.step },
  });
  ctx.emit(session, {
    type: "request/header",
    time: input.time + 1,
    data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
  });
  ctx.emit(session, {
    type: "assistant/message",
    seq: input.seq,
    time: input.time + 2,
    data: {
      turn: input.turn,
      step: input.step,
      message: { role: "assistant", content: [] },
      usage: { inputTokens: 100_000, outputTokens: 10_000 },
    },
  });
}

test("subagent sessions nest under their parent in the cost tree via the durable header", async () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const base = Date.UTC(2026, 7, 23, 1);

  // Main session: no parent markers on its header.
  const main = { id: "main-session", header: { id: "main-session", createdAt: base } };
  // Subagent child: dsh stamps parentSession + origin + delegationDepth.
  const child = {
    id: "child-session",
    header: {
      id: "child-session",
      createdAt: base + 10,
      parentSession: "main-session",
      origin: "subagent",
      delegationDepth: 1,
      agentPreset: "research",
    },
  };
  // Forked session: carries parentSession (seed lineage) but is NOT a subagent.
  const fork = {
    id: "fork-session",
    header: { id: "fork-session", createdAt: base + 20, parentSession: "main-session" },
  };

  emitRequestTurn(ctx, main, { turn: 1, step: 1, seq: 1, time: base });
  emitRequestTurn(ctx, child, { turn: 1, step: 1, seq: 2, time: base + 100 });
  emitRequestTurn(ctx, fork, { turn: 1, step: 1, seq: 3, time: base + 200 });

  const childEvents = runtime.events().filter((event) => event.sessionId === "child-session");
  expect(childEvents.length).toBeGreaterThan(0);
  for (const event of childEvents) {
    expect(event.parentSessionId).toBe("main-session");
  }
  for (const event of runtime.events().filter((event) => event.sessionId === "fork-session")) {
    expect(event.parentSessionId).toBeUndefined();
  }

  const tree = await runtime.remote.getSessionCostTree();
  // The fork stays a top-level root (seed lineage is not subagent delegation);
  // only the subagent child nests under the main session.
  expect(tree.roots.map((node) => node.id)).toEqual(["main-session", "fork-session"]);
  const mainNode = tree.roots.find((node) => node.id === "main-session");
  if (!mainNode) throw new Error("missing root");
  expect(mainNode.childSessionIds).toEqual(["child-session"]);
  expect(mainNode.subtreeSummary.totalMicroCny).toBeGreaterThan(mainNode.summary.totalMicroCny);

  const childNode = tree.nodes["child-session"];
  if (!childNode) throw new Error("missing child node");
  expect(childNode.depth).toBe(1);
  expect(childNode.path).toEqual(["main-session", "child-session"]);

  runtime.uninstall();
});

test("history recovery replays stamp parentSessionId onto previously unlinked events", async () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const base = Date.UTC(2026, 7, 23, 1);

  // Recovery path: seedSession({id, header, events}) — header-only object
  // without an events array first, then a replay carrying both.
  const child = {
    id: "recovered-child",
    header: {
      id: "recovered-child",
      parentSession: "recovered-main",
      origin: "subagent",
      delegationDepth: 1,
    },
  };
  emitRequestTurn(ctx, child, { turn: 2, step: 1, seq: 5, time: base + 300 });

  const events = runtime.events().filter((event) => event.sessionId === "recovered-child");
  expect(events.length).toBeGreaterThan(0);
  expect(events.every((event) => event.parentSessionId === "recovered-main")).toBe(true);
  // The parent itself has no events yet: it surfaces as a zero-cost node and
  // the child still nests under it instead of being flagged as an orphan.
  const tree = await runtime.remote.getSessionCostTree();
  expect(tree.roots.map((node) => node.id)).toEqual(["recovered-main"]);
  expect(tree.roots[0]?.childSessionIds).toEqual(["recovered-child"]);
  expect(tree.anomalies.missingParents).toEqual([]);

  runtime.uninstall();
});
