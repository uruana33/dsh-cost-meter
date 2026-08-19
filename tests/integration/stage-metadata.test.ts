import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";

import {
  createMyMeterCordisHostRuntime,
  type MyMeterCordisContext,
} from "../../packages/plugin/src/cordis-host";
import { ShellOverlay, createMyMeterStore } from "../../packages/client/src";

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

  emitCreated(session: unknown): void {
    for (const listener of this.listeners.get("session/created") ?? []) {
      listener(session, undefined);
    }
  }
}

function emitPreset(ctx: FakeCordisContext, session: unknown, agentPreset: string, time: number): void {
  ctx.emit(session, {
    type: "agent-preset/selected",
    time,
    data: { agentPreset },
  });
}

function emitHeader(
  ctx: FakeCordisContext,
  session: unknown,
  config: { model: string; reasoningEffort: string },
  time: number,
): void {
  ctx.emit(session, {
    type: "request/header",
    time,
    data: {
      header: {
        config: {
          provider: "deepseek",
          model: config.model,
          reasoningEffort: config.reasoningEffort,
        },
      },
    },
  });
}

function emitFinalUsage(
  ctx: FakeCordisContext,
  session: unknown,
  input: { turn: number; step: number; seq: number; time: number },
): void {
  ctx.emit(session, {
    type: "assistant/message",
    seq: input.seq,
    time: input.time,
    data: {
      turn: input.turn,
      step: input.step,
      message: { role: "assistant", content: [] },
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
    },
  });
}

function emitUsageChunk(
  ctx: FakeCordisContext,
  session: unknown,
  input: { turn: number; step: number; seq: number; time: number },
): void {
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: input.seq,
    time: input.time,
    data: {
      turn: input.turn,
      step: input.step,
      chunk: { type: "usage", usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } },
    },
  });
}

test("Cordis bridge completes metadata from the post-start header and locks it at first usage", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "stage-freeze" };
  const firstStart = Date.UTC(2026, 7, 17, 4);
  const secondStart = Date.UTC(2026, 7, 17, 4, 0, 5);

  emitPreset(ctx, session, "Coding", firstStart - 2);
  ctx.emit(session, { type: "step/start", time: firstStart, data: { turn: 1, step: 1 } });
  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "medium" }, firstStart + 1);
  emitPreset(ctx, session, "Research", firstStart + 250);
  emitUsageChunk(ctx, session, { turn: 1, step: 1, seq: 9, time: firstStart + 500 });

  emitHeader(ctx, session, { model: "deepseek-v4-pro", reasoningEffort: "high" }, firstStart + 2_000);
  emitFinalUsage(ctx, session, { turn: 1, step: 1, seq: 10, time: firstStart + 3_000 });

  ctx.emit(session, { type: "step/start", time: secondStart, data: { turn: 1, step: 2 } });
  emitFinalUsage(ctx, session, { turn: 1, step: 2, seq: 11, time: secondStart + 1_000 });

  expect(runtime.events()).toHaveLength(2);
  expect(runtime.events()[0]).toMatchObject({
    sessionId: "stage-freeze",
    turnId: "1",
    stepId: "1",
    attemptId: "attempt-0",
    model: "deepseek-v4-flash",
    reasoningEffort: "medium",
    agentPreset: "Coding",
  });
  expect(runtime.events()[1]).toMatchObject({
    sessionId: "stage-freeze",
    turnId: "1",
    stepId: "2",
    attemptId: "attempt-0",
    model: "deepseek-v4-pro",
    reasoningEffort: "high",
    agentPreset: "Research",
  });

  runtime.uninstall();
});

test("Cordis bridge seeds the agent preset from the durable session header", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = {
    id: "session-header-preset",
    header: { agentPreset: "standard" },
  };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", time: startedAt, data: { turn: 1, step: 1 } });
  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "high" }, startedAt + 1);
  emitFinalUsage(ctx, session, { turn: 1, step: 1, seq: 2, time: startedAt + 1_000 });

  expect(runtime.events()[0]).toMatchObject({ agentPreset: "standard" });
  expect(runtime.remote.getSnapshot().details[session.id]?.stages[0]).toMatchObject({
    agentPreset: "standard",
  });

  runtime.uninstall();
});

test("Cordis bridge adopts a restored session created after plugin startup", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const startedAt = Date.UTC(2026, 7, 17, 4);
  const session = {
    id: "late-restored-session",
    header: { agentPreset: "standard" },
    events: [
      { type: "step/start", time: startedAt, data: { turn: 1, step: 1 } },
      {
        type: "request/header",
        time: startedAt + 1,
        data: {
          header: {
            config: {
              provider: "deepseek",
              model: "deepseek-v4-flash",
              reasoningEffort: "high",
            },
          },
        },
      },
      {
        type: "assistant/message",
        seq: 2,
        time: startedAt + 1_000,
        data: {
          turn: 1,
          step: 1,
          message: { role: "assistant", content: [] },
          usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        },
      },
    ],
  };

  ctx.emitCreated(session);

  expect(runtime.events()[0]).toMatchObject({ agentPreset: "standard" });
  expect(runtime.remote.getSnapshot().details[session.id]?.stages[0]).toMatchObject({
    agentPreset: "standard",
  });

  let duplicateReplayUpdates = 0;
  const stopListening = runtime.remote.subscribe(() => {
    duplicateReplayUpdates += 1;
  });
  ctx.emitCreated(session);
  expect(duplicateReplayUpdates).toBe(0);
  stopListening();

  runtime.uninstall();
});

test("Cordis bridge seeds missed history before handling the first live event", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const startedAt = Date.UTC(2026, 7, 17, 4);
  const session = {
    id: "missed-created-session",
    header: { agentPreset: "standard" },
    events: [
      { type: "step/start", seq: 0, time: startedAt, data: { turn: 1, step: 1 } },
      {
        type: "request/header",
        seq: 1,
        time: startedAt + 1,
        data: {
          header: {
            config: {
              provider: "deepseek",
              model: "deepseek-v4-flash",
              reasoningEffort: "high",
            },
          },
        },
      },
      {
        type: "assistant/message",
        seq: 2,
        time: startedAt + 1_000,
        data: {
          turn: 1,
          step: 1,
          message: { role: "assistant", content: [] },
          usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        },
      },
    ],
  };

  ctx.emit(session, session.events.at(-1));

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]).toMatchObject({
    sessionId: session.id,
    agentPreset: "standard",
    status: "settled",
  });

  runtime.uninstall();
});

test("Cordis bridge handles a live event that is emitted before it is appended to session history", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const startedAt = Date.UTC(2026, 7, 17, 4);
  const session = {
    id: "live-event-before-append",
    header: { agentPreset: "standard" },
    events: [
      { type: "step/start", seq: 0, time: startedAt, data: { turn: 1, step: 1 } },
    ],
  };

  ctx.emit(session, {
    type: "agent-preset/selected",
    seq: 1,
    time: startedAt + 1,
    data: { agentPreset: "minimal" },
  });
  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "high" }, startedAt + 2);
  emitFinalUsage(ctx, session, { turn: 1, step: 1, seq: 3, time: startedAt + 1_000 });

  expect(runtime.events()[0]).toMatchObject({ agentPreset: "minimal" });
  runtime.uninstall();
});

test("Cordis bridge applies a preset selected before the active request is locked", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "preset-before-request-header" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", time: startedAt, data: { turn: 1, step: 1 } });
  emitPreset(ctx, session, "minimal", startedAt + 1);
  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "high" }, startedAt + 2);
  emitFinalUsage(ctx, session, { turn: 1, step: 1, seq: 3, time: startedAt + 1_000 });

  expect(runtime.events()[0]).toMatchObject({ agentPreset: "minimal" });
  runtime.uninstall();
});

test("Cordis bridge recovers model metadata from an assistant message source", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "assistant-source-metadata" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 2,
    time: startedAt + 1_000,
    data: {
      turn: 1,
      step: 1,
      message: {
        role: "assistant",
        content: [],
        source: { kind: "model", provider: "deepseek-official", model: "deepseek-v4-flash" },
      },
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
    },
  });

  expect(runtime.events()[0]).toMatchObject({
    provider: "deepseek",
    model: "deepseek-v4-flash",
    status: "settled",
  });
  expect(runtime.remote.getSnapshot().details[session.id]?.stages[0]).toMatchObject({
    model: "deepseek-v4-flash",
    status: "settled",
  });

  runtime.uninstall();
});

test("historical stage ends at its last request activity", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "stage-time-boundary" };
  const firstStart = Date.UTC(2026, 7, 17, 4);
  const firstEnd = firstStart + 1_000;
  const secondStart = firstStart + 10_000;

  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "medium" }, firstStart - 1);
  ctx.emit(session, { type: "step/start", time: firstStart, data: { turn: 1, step: 1 } });
  emitFinalUsage(ctx, session, { turn: 1, step: 1, seq: 2, time: firstEnd });
  emitHeader(ctx, session, { model: "deepseek-v4-pro", reasoningEffort: "high" }, secondStart - 1);
  ctx.emit(session, { type: "step/start", time: secondStart, data: { turn: 1, step: 2 } });
  emitFinalUsage(ctx, session, { turn: 1, step: 2, seq: 4, time: secondStart + 1_000 });

  const stages = runtime.remote.getSnapshot().details[session.id]?.stages ?? [];
  expect(stages).toHaveLength(2);
  expect(stages[0]?.startedAt).toBe(new Date(firstStart).toISOString());
  expect(stages[0]?.completedAt).toBe(new Date(firstEnd).toISOString());
  expect(stages[0]?.completedAt).not.toBe(new Date(secondStart).toISOString());

  runtime.uninstall();
});

test("Cordis bridge completes retry metadata from its header and locks it at first usage", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "retry-freeze" };
  const initialStart = Date.UTC(2026, 7, 17, 4);
  const retryStart = Date.UTC(2026, 7, 17, 4, 0, 3);

  emitPreset(ctx, session, "Coding", initialStart - 2);
  ctx.emit(session, { type: "step/start", time: initialStart, data: { turn: 1, step: 1 } });
  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "medium" }, initialStart + 1);

  emitPreset(ctx, session, "Research", retryStart - 2);
  emitHeader(ctx, session, { model: "deepseek-v4-pro", reasoningEffort: "high" }, retryStart - 1);
  ctx.emit(session, {
    type: "llm/retry-started",
    time: retryStart,
    data: { retryId: "retry-1", turn: 1, step: 1, retry: 1 },
  });
  emitHeader(ctx, session, { model: "deepseek-v4-pro", reasoningEffort: "high" }, retryStart + 1);
  emitUsageChunk(ctx, session, { turn: 1, step: 1, seq: 19, time: retryStart + 500 });

  emitPreset(ctx, session, "Chat", retryStart + 1_000);
  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "low" }, retryStart + 2_000);
  emitFinalUsage(ctx, session, { turn: 1, step: 1, seq: 20, time: retryStart + 3_000 });

  expect(runtime.events()).toHaveLength(2);
  expect(runtime.events()[0]).toMatchObject({
    attemptId: "attempt-0",
    status: "failed",
    requestOutcome: "failed",
  });
  expect(runtime.events()[1]).toMatchObject({
    sessionId: "retry-freeze",
    turnId: "1",
    stepId: "1",
    attemptId: "retry-1",
    requestStartedAt: new Date(retryStart).toISOString(),
    model: "deepseek-v4-pro",
    reasoningEffort: "high",
    agentPreset: "Research",
  });

  runtime.uninstall();
});

test("Cordis bridge closes a projected failed attempt before billing its retry", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "retry-after-projection" };
  const initialStart = Date.UTC(2026, 7, 17, 4);
  const retryStart = initialStart + 2_000;

  ctx.emit(session, { type: "step/start", time: initialStart, data: { turn: 1, step: 1 } });
  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "medium" }, initialStart + 1);
  emitUsageChunk(ctx, session, { turn: 1, step: 1, seq: 1, time: initialStart + 1_000 });
  ctx.emit(session, {
    type: "llm/retry-started",
    time: retryStart,
    data: { retryId: "retry-1", turn: 1, step: 1, retry: 1 },
  });
  emitHeader(ctx, session, { model: "deepseek-v4-pro", reasoningEffort: "high" }, retryStart + 1);
  emitFinalUsage(ctx, session, { turn: 1, step: 1, seq: 2, time: retryStart + 1_000 });

  expect(runtime.events()).toHaveLength(2);
  expect(runtime.events()[0]).toMatchObject({ attemptId: "attempt-0", status: "failed", requestOutcome: "failed" });
  expect(runtime.events()[1]).toMatchObject({ attemptId: "retry-1", status: "settled", requestOutcome: "success" });
  expect(runtime.remote.getSnapshot().summary.status.code).toBe("settled");

  runtime.uninstall();
});

test("Cordis bridge finalizes a failed request from its last reliable usage projection", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "failed-request" };
  const startedAt = Date.UTC(2026, 7, 17, 4);
  const completedAt = startedAt + 2_000;

  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "high" }, startedAt - 1);
  ctx.emit(session, { type: "step/start", time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 2,
    time: startedAt + 1_000,
    data: {
      turn: 1,
      step: 1,
      chunk: { type: "usage", usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } },
    },
  });
  ctx.emit(session, {
    type: "turn/end",
    seq: 3,
    time: completedAt,
    data: { turn: 1, reason: { kind: "error", error: { message: "provider failed", code: "UNKNOWN" } } },
  });

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]).toMatchObject({
    status: "failed",
    requestOutcome: "failed",
    completedAt: new Date(completedAt).toISOString(),
  });
  expect(runtime.remote.getSnapshot().details[session.id]?.stages[0]).toMatchObject({
    status: "failed",
    lastActivityAt: new Date(completedAt).toISOString(),
    totalMicroCny: 6_000_000,
    settledTotalMicroCny: 0,
  });
  expect(runtime.remote.getSnapshot().details[session.id]?.turns[0]?.completedAt).toBe(
    new Date(completedAt).toISOString(),
  );

  runtime.uninstall();
});

test("Cordis bridge estimates an aborted request without usage", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "aborted-without-usage" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "high" }, startedAt - 1);
  ctx.emit(session, { type: "step/start", time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "turn/end",
    seq: 2,
    time: startedAt + 1_000,
    data: { turn: 1, reason: { kind: "aborted", reason: { kind: "user" } } },
  });

  const event = runtime.events()[0];
  const detail = runtime.remote.getSnapshot().details[session.id];
  expect(event).toMatchObject({ status: "failed", requestOutcome: "aborted", amountMicroCny: 0n });
  expect(detail).toMatchObject({ status: "aborted", unknownCount: 0 });
  expect(detail?.turns[0]).toMatchObject({ status: "aborted", amountMicroCny: 0 });

  runtime.uninstall();
});

test("Cordis bridge does not reclassify a completed model request when a later tool fails the turn", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "tool-failure-after-model" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "high" }, startedAt - 1);
  ctx.emit(session, { type: "step/start", time: startedAt, data: { turn: 1, step: 1 } });
  emitFinalUsage(ctx, session, { turn: 1, step: 1, seq: 2, time: startedAt + 1_000 });
  ctx.emit(session, {
    type: "turn/end",
    seq: 3,
    time: startedAt + 2_000,
    data: { turn: 1, reason: { kind: "error", error: { message: "tool failed", code: "UNKNOWN" } } },
  });

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]).toMatchObject({ status: "settled", requestOutcome: "success" });

  runtime.uninstall();
});

test("Cordis bridge leaves a usage-less assistant message open for a later aborted turn", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "usage-less-message-aborted" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "high" }, startedAt - 1);
  ctx.emit(session, { type: "step/start", time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 2,
    time: startedAt + 500,
    data: {
      turn: 1,
      step: 1,
      chunk: { type: "usage", usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } },
    },
  });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 3,
    time: startedAt + 1_000,
    data: { turn: 1, step: 1, message: { role: "assistant", content: [] } },
  });
  ctx.emit(session, {
    type: "turn/end",
    seq: 4,
    time: startedAt + 1_500,
    data: { turn: 1, reason: { kind: "aborted", reason: { kind: "user" } } },
  });

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]).toMatchObject({ status: "failed", requestOutcome: "aborted" });

  runtime.uninstall();
});

test("Cordis bridge preserves a reliable estimate when a completed turn has no final usage", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "usage-less-message-completed" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "high" }, startedAt - 1);
  ctx.emit(session, { type: "step/start", time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 2,
    time: startedAt + 500,
    data: {
      turn: 1,
      step: 1,
      chunk: { type: "usage", usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } },
    },
  });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 3,
    time: startedAt + 1_000,
    data: { turn: 1, step: 1, message: { role: "assistant", content: [] } },
  });
  ctx.emit(session, {
    type: "turn/end",
    seq: 4,
    time: startedAt + 1_500,
    data: { turn: 1, reason: { kind: "completed" } },
  });

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]).toMatchObject({ status: "estimated", source: "stream" });
  expect(runtime.events()[0]?.completedAt).not.toBeUndefined();
  expect(runtime.remote.getSnapshot().summary.status.code).toBe("unknown");
  expect(runtime.remote.getSnapshot().details[session.id]?.turns[0]?.completedAt).not.toBeNull();

  const store = createMyMeterStore({ remote: runtime.remote, storage: null });
  store.setOverlayCollapsed(true);
  render(createElement(ShellOverlay, { store }));
  expect(screen.queryByText("#1 轮 (生成中)")).toBeNull();
  expect(screen.getByText("#1 轮", { exact: true })).toBeTruthy();

  store.destroy();

  runtime.uninstall();
});

test("Cordis bridge estimates a completed request with no usage or projection", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "completed-without-any-usage" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  emitHeader(ctx, session, { model: "deepseek-v4-flash", reasoningEffort: "high" }, startedAt - 1);
  ctx.emit(session, { type: "step/start", time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 2,
    time: startedAt + 500,
    data: { turn: 1, step: 1, message: { role: "assistant", content: [] } },
  });
  ctx.emit(session, {
    type: "turn/end",
    seq: 3,
    time: startedAt + 1_000,
    data: { turn: 1, reason: { kind: "completed" } },
  });

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]).toMatchObject({
    status: "estimated",
    requestOutcome: "success",
    amountMicroCny: 0n,
  });
  expect(runtime.remote.getSnapshot().details[session.id]).toMatchObject({ status: "unknown", unknownCount: 0 });

  runtime.uninstall();
});
