import { expect, test } from "vitest";

import {
  createClientSafeEvent,
  createMyMeterRemoteContribution,
  createMyMeterRemoteFacade,
} from "../../packages/api/src/index";

test("remote contribution only exposes safe DTOs and typed stale states", async () => {
  const contribution = createMyMeterRemoteContribution({
    host: {
      listSessions: async () => [
        {
          id: "sess-1",
          title: "demo",
          apiKey: "secret",
          prompt: "hidden",
          completion: "hidden",
          summary: { totalMicroCny: 42 },
        },
      ],
      getSessionDetail: async () => ({
        id: "sess-1",
        apiKey: "secret",
        prompt: "hidden",
        completion: "hidden",
      }),
      getBalance: async () => ({ status: "stale", total: 12 }),
      getSettings: async () => ({ apiKey: "secret" }),
    },
  });

  const sessions = await contribution.listSessions();
  const session = sessions[0] as {
    apiKey?: unknown;
    prompt?: unknown;
    summary: { totalMicroCny: number };
  };
  expect(session.apiKey).toBeUndefined();
  expect(session.prompt).toBeUndefined();
  expect(session.summary.totalMicroCny).toBe(42);

  const detail = (await contribution.getSessionDetail("sess-1")) as {
    apiKey?: unknown;
    completion?: unknown;
  };
  expect(detail.apiKey).toBeUndefined();
  expect(detail.completion).toBeUndefined();

  const balance = await contribution.getBalance();
  expect(balance.status).toBe("stale");
});

test("client facade subscribes, disconnects, and reconnects cleanly", async () => {
  const listeners = new Set<string>();
  let mounts = 0;
  const facade = createMyMeterRemoteFacade({
    mount: async () => {
      mounts += 1;
      return {
        on: (event, handler) => {
          const key = `${event}:${handler.name || "anon"}`;
          listeners.add(key);
          return () => {
            listeners.delete(key);
          };
        },
      };
    },
  });

  expect(facade.state).toBe("disconnected");
  const unsubscribe = await facade.on("session:update", function handler() {});
  expect(facade.state).toBe("connected");
  expect(listeners.size).toBe(1);

  await facade.disconnect();
  expect(facade.state).toBe("disconnected");
  expect(listeners.size).toBe(0);

  const unsubscribe2 = await facade.on("session:update", function handler2() {});
  expect(mounts).toBe(2);
  expect(facade.state).toBe("connected");

  unsubscribe2();
  expect(listeners.size).toBe(0);

  unsubscribe();
  expect(listeners.size).toBe(0);
});

test("client safe events strip secret-bearing fields", () => {
  const safe = createClientSafeEvent({
    type: "session:update",
    sessionId: "sess-1",
    apiKey: "secret",
    api_key: "secret-snake",
    Authorization: "Bearer secret",
    prompt: "hidden",
    completion: "hidden",
    messages: [{ role: "user", content: "private" }],
    input: "private input",
    output: "private output",
    status: "fresh",
  });

  expect(safe.apiKey).toBeUndefined();
  expect(safe.prompt).toBeUndefined();
  expect(safe.completion).toBeUndefined();
  expect(safe.api_key).toBeUndefined();
  expect(safe.Authorization).toBeUndefined();
  expect(safe.messages).toBeUndefined();
  expect(safe.input).toBeUndefined();
  expect(safe.output).toBeUndefined();
  expect(safe.status).toBe("fresh");
});
