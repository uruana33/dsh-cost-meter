import { expect, test } from "vitest";

import {
  createMyMeterCordisHostRuntime,
  type MyMeterCordisContext,
} from "../../packages/plugin/src/cordis-host";
import { restoreLedgerEvent } from "../../packages/host/src/ledger";

// Mirrors dsh-session-query readSession(): { session: <storage header>, events }
function makeQueryCtx(sessions: Array<{ header: Record<string, unknown>; events: unknown[] }>): MyMeterCordisContext {
  return {
    on: () => () => {},
    sessions: { list: () => [] },
    sessionQuery: {
      async listSessions() {
        return sessions.map((s) => ({ header: s.header, revision: "rev-1" }));
      },
      async readSession(id: string) {
        const found = sessions.find((s) => s.header.id === id);
        if (!found) throw new Error(`not found ${id}`);
        return { session: structuredClone(found.header), events: found.events };
      },
    },
  } as unknown as MyMeterCordisContext;
}

function requestEvents(seqStart: number) {
  const time = Date.UTC(2026, 7, 23, 2);
  return [
    { type: "step/start", seq: seqStart, time, data: { turn: 1, step: 1 } },
    { type: "request/header", seq: seqStart + 1, time: time + 1, data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } } },
    { type: "assistant/message", seq: seqStart + 2, time: time + 2, data: { turn: 1, step: 1, message: { role: "assistant", content: [] }, usage: { inputTokens: 1000, outputTokens: 1000 } } },
  ];
}

test("recovery via query service stamps parentSessionId from the storage header", async () => {
  const ctx = makeQueryCtx([
    {
      header: { id: "main-hist", createdAt: 1 },
      events: requestEvents(10),
    },
    {
      // Exactly what dsh persists for a subagent child (verified on disk):
      header: { id: "sub-hist", createdAt: 2, parentSession: "main-hist", origin: "subagent", delegationDepth: 1 },
      events: requestEvents(20),
    },
  ]);

  const runtime = createMyMeterCordisHostRuntime({ ctx });
  await new Promise((r) => setTimeout(r, 50));
  const events = runtime.events().filter((e) => e.sessionId === "sub-hist");
  expect(events.length).toBeGreaterThan(0);
  console.log("sub-hist parents:", [...new Set(events.map((e) => e.parentSessionId))]);
  expect(events.every((e) => e.parentSessionId === "main-hist")).toBe(true);
  runtime.uninstall();
});

test("tree nests subagents from listed headers even when session reads fail", async () => {
  // Mirrors the field failure mode: the recovery listing exposes durable
  // headers, but per-session reads never produce usable request metadata
  // (or fail outright). The header registry alone must nest the tree.
  const ctx: MyMeterCordisContext = {
    on: () => () => {},
    sessions: { list: () => [] },
    sessionQuery: {
      async listSessions() {
        return [
          { header: { id: "main-l", createdAt: 1 }, revision: "r1" },
          { header: { id: "sub-l", createdAt: 2, parentSession: "main-l", origin: "subagent", delegationDepth: 1 }, revision: "r2" },
        ];
      },
      async readSession() {
        throw new Error("history read failed");
      },
    },
  } as unknown as MyMeterCordisContext;

  const runtime = createMyMeterCordisHostRuntime({ ctx });
  await new Promise((r) => setTimeout(r, 50));

  const tree = await runtime.remote.getSessionCostTree();
  expect(tree.roots.map((node) => node.id)).toEqual(["main-l"]);
  expect(tree.roots[0]?.childSessionIds).toEqual(["sub-l"]);

  runtime.uninstall();
});

test("ledger restore treats the legacy unknown sentinel as no parent", () => {
  // Regression guard for the "unknown" poisoning: restored events must not
  // carry a parent id that the tree builder would have to filter out.
  const legacyUnknown = restoreLedgerEvent({
    id: "e1", eventKey: "k1", sessionId: "s1", turnId: "t", stepId: "s", attemptId: "a",
    model: "m", requestStartedAt: "2026-08-24T00:00:00.000Z", source: "final_usage",
    status: "settled", pricingZone: "unknown", parentSessionId: "unknown",
  });
  expect(legacyUnknown.parentSessionId).toBeUndefined();
  const realParent = restoreLedgerEvent({
    id: "e2", eventKey: "k2", sessionId: "s1", turnId: "t", stepId: "s", attemptId: "b",
    model: "m", requestStartedAt: "2026-08-24T00:00:01.000Z", source: "final_usage",
    status: "settled", pricingZone: "unknown", parentSessionId: "p1",
  });
  expect(realParent.parentSessionId).toBe("p1");
});
