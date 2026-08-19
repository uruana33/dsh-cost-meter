import { expect, test } from "vitest";

import { createBillingReadModel, type BillingReadModelEvent } from "../../packages/host/src/index";

interface Event extends BillingReadModelEvent {
  amount: number;
}

const event = (eventKey: string, sessionId: string, amount: number): Event => ({ eventKey, sessionId, amount });

test("indexes events by session and only advances generation for changes", () => {
  const model = createBillingReadModel<Event>();
  const first = event("a", "session-a", 1);

  expect(model.upsert(first)).toBe(true);
  expect(model.getGeneration("session-a")).toBe(1);
  expect(model.upsert({ ...first })).toBe(false);
  expect(model.getGeneration("session-a")).toBe(1);
  expect(model.getSessionEvents("session-a")).toEqual([first]);

  expect(model.upsert(event("b", "session-a", 2))).toBe(true);
  expect(model.getGeneration("session-a")).toBe(2);
  expect(model.getSessionEvents("session-a").map((item) => item.eventKey)).toEqual(["a", "b"]);
});

test("replacement moves an event between sessions and invalidates both generations", () => {
  const model = createBillingReadModel<Event>();
  model.upsert(event("a", "session-a", 1));
  const beforeA = model.getGeneration("session-a");

  model.upsert(event("a", "session-b", 3));

  expect(model.getSessionEvents("session-a")).toEqual([]);
  expect(model.getSessionEvents("session-b")).toEqual([event("a", "session-b", 3)]);
  expect(model.getGeneration("session-a")).toBe(beforeA + 1);
  expect(model.getGeneration("session-b")).toBe(1);
});

test("remove, rebuild, and clear preserve an isolated index", () => {
  const model = createBillingReadModel<Event>();
  model.rebuild([event("a", "session-a", 1), event("b", "session-b", 2)]);

  expect(model.listSessionIds()).toEqual(["session-a", "session-b"]);
  expect(model.getGeneration("session-a")).toBe(1);
  expect(model.remove("a")).toBe(true);
  expect(model.get("a")).toBeUndefined();
  expect(model.getSessionEvents("session-a")).toEqual([]);
  expect(model.remove("missing")).toBe(false);

  model.clear();
  expect(model.listSessionIds()).toEqual([]);
  expect(model.getGeneration("session-b")).toBe(0);
});
