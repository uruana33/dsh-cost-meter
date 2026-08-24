import { expect, test, vi } from "vitest";

import {
  MYMETER_LOCAL_TYPERT_CONTRIBUTION,
  MYMETER_REMOTE_DESCRIPTORS,
  createMyMeterHostRuntime,
  createMyMeterRemoteFromTypert,
  type DshEventContext,
  type MyMeterProviderDescriptor,
  type MyMeterTypertRemoteNamespace,
} from "../../packages/plugin/src/index";

type Listener = (payload: unknown) => void;

class FakeDshContext implements DshEventContext {
  private readonly listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): () => void {
    const listeners = this.listeners.get(event) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }

  emit(event: string, payload: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(payload);
  }
}

test("Remote listSessions skips details and getSessionDetail builds only the requested session", async () => {
  const dsh = new FakeDshContext();
  const contextBreakdown = vi.fn((sessionId: string) => ({
    systemTokens: sessionId === "sess-a" ? 1 : 10,
    toolsTokens: 2,
    messageTokens: 3,
  }));
  const runtime = createMyMeterHostRuntime({ dsh, contextBreakdown });
  emitFinalUsage(dsh, "sess-a", "req-a", "turn-a", 1_000);
  emitFinalUsage(dsh, "sess-b", "req-b", "turn-b", 2_000);

  const sessions = await runtime.remote.listSessions();
  expect(sessions.map((session) => session.id).sort()).toEqual(["sess-a", "sess-b"]);
  expect(contextBreakdown).not.toHaveBeenCalled();

  const detail = await runtime.remote.getSessionDetail("sess-b");
  expect(detail?.id).toBe("sess-b");
  expect(detail?.contextBreakdown).toEqual({ systemTokens: 10, toolsTokens: 2, messageTokens: 3 });
  expect(contextBreakdown).toHaveBeenCalledTimes(1);
  expect(contextBreakdown).toHaveBeenLastCalledWith("sess-b");

  const cached = await runtime.remote.getSessionDetail("sess-b");
  expect(cached).toBe(detail);
  expect(contextBreakdown).toHaveBeenCalledTimes(2);

  const snapshot = runtime.remote.getSnapshot();
  // Slim snapshot contract: only the latest-activity session embeds a detail.
  expect(Object.keys(snapshot.details)).toEqual(["sess-b"]);
  expect(contextBreakdown).not.toHaveBeenCalledWith("sess-a");

  runtime.uninstall();
});

test("Remote detail construction does not aggregate unrelated session events", async () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });
  emitFinalUsage(dsh, "sess-target", "req-target", "turn-target", 1_000);
  emitFinalUsage(dsh, "sess-unrelated", "req-unrelated", "turn-unrelated", 2_000);
  const unrelated = runtime.events().find((event) => event.sessionId === "sess-unrelated");
  expect(unrelated).toBeTruthy();
  Object.defineProperty(unrelated!, "amountMicroCny", {
    configurable: true,
    get() {
      throw new Error("unrelated session was aggregated");
    },
  });

  await expect(runtime.remote.getSessionDetail("sess-target")).resolves.toMatchObject({ id: "sess-target" });

  runtime.uninstall();
});

test("Remote summary and detail split remains DTO-compatible with getSnapshot", async () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({
    dsh,
    contextBreakdown: (sessionId) => ({
      systemTokens: sessionId === "sess-active" ? 5 : 7,
      toolsTokens: sessionId === "sess-active" ? 3 : 11,
      messageTokens: sessionId === "sess-active" ? 13 : 17,
    }),
    exchangeRate: async () => ({ rate: 7.25, fetchedAt: "2026-08-19T00:00:00.000Z", source: "test" }),
  });
  emitFinalUsage(dsh, "sess-active", "req-active-a", "turn-a", 1_000);
  emitFinalUsage(dsh, "sess-mixed", "req-mixed-a", "turn-a", 2_000);
  emitFinalUsage(dsh, "sess-mixed", "req-mixed-b", "turn-b", 2_100, { provider: "cpa", model: "grok-4.6" });
  await runtime.remote.refreshExchangeRate();
  emitActiveRequest(dsh, "sess-active");

  const snapshot = runtime.remote.getSnapshot();
  await expect(runtime.remote.listSessions()).resolves.toEqual(snapshot.sessions);
  // Slim snapshot contract: exactly the current session ships a full detail,
  // and the on-demand RPC reproduces it byte-for-byte.
  expect(Object.keys(snapshot.details)).toEqual([snapshot.currentSessionId]);
  for (const [sessionId, detail] of Object.entries(snapshot.details)) {
    await expect(runtime.remote.getSessionDetail(sessionId)).resolves.toEqual(detail);
  }

  runtime.uninstall();
});

test("Remote detail differential follows getSnapshot when multiple sessions are active", async () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });
  emitFinalUsage(dsh, "sess-active-earlier", "req-earlier", "turn-earlier", 1_000);
  emitFinalUsage(dsh, "sess-active-latest", "req-latest", "turn-latest", 2_000);
  emitActiveRequest(dsh, "sess-active-earlier", { lastActivityAt: "2026-08-17T04:00:04.000Z" });
  emitActiveRequest(dsh, "sess-active-latest", { lastActivityAt: "2026-08-17T04:00:05.000Z" });

  const snapshot = runtime.remote.getSnapshot();
  // Only the latest active request's session rides the polled snapshot; the
  // earlier one stays reachable through the on-demand detail RPC.
  expect(Object.keys(snapshot.details)).toEqual(["sess-active-latest"]);
  expect(snapshot.details["sess-active-latest"]?.status).toBe("billing");
  await expect(runtime.remote.getSessionDetail("sess-active-earlier")).resolves.toMatchObject({
    id: "sess-active-earlier",
    status: "settled",
  });
  await expect(runtime.remote.getSessionDetail("sess-active-latest")).resolves.toEqual(
    snapshot.details["sess-active-latest"],
  );

  runtime.uninstall();
});

test("Remote DTO freezing does not freeze provider or context source objects", async () => {
  const dsh = new FakeDshContext();
  const sourceContext = { systemTokens: 1, toolsTokens: 2, messageTokens: 3 };
  const sourceProvider = { id: "deepseek", name: "DeepSeek", balanceSupported: false };
  const runtime = createMyMeterHostRuntime({
    dsh,
    contextBreakdown: () => sourceContext,
    providers: () => [sourceProvider],
  });
  emitFinalUsage(dsh, "sess-owned-inputs", "req-owned", "turn-owned", 1_000);

  await runtime.remote.getSessionDetail("sess-owned-inputs");
  runtime.remote.getSnapshot();
  await runtime.remote.listSessions();

  expect(Object.isFrozen(sourceContext)).toBe(false);
  expect(Object.isFrozen(sourceProvider)).toBe(false);
  sourceContext.systemTokens = 42;
  sourceProvider.name = "Renamed";
  expect(sourceContext.systemTokens).toBe(42);
  expect(sourceProvider.name).toBe("Renamed");

  runtime.uninstall();
});

test("Remote detail cache invalidates on session, exchange-rate, context, and provider generations", async () => {
  const dsh = new FakeDshContext();
  let context = { systemTokens: 1, toolsTokens: 2, messageTokens: 3 };
  let providers: MyMeterProviderDescriptor[] = [{ id: "deepseek", name: "DeepSeek", balanceSupported: false }];
  const runtime = createMyMeterHostRuntime({
    dsh,
    contextBreakdown: vi.fn(() => context),
    providers: () => providers,
    exchangeRate: async () => ({ rate: 7.25, fetchedAt: "2026-08-19T00:00:00.000Z", source: "test" }),
  });
  emitFinalUsage(dsh, "sess-cache", "req-a", "turn-a", 1_000);
  emitFinalUsage(dsh, "sess-cache", "req-b", "turn-b", 1_100, { provider: "cpa", model: "grok-4.6" });

  const first = await runtime.remote.getSessionDetail("sess-cache");
  const repeated = await runtime.remote.getSessionDetail("sess-cache");
  expect(repeated).toBe(first);
  expect(first?.cnyEquivalentMicroCny).toBeNull();

  await runtime.remote.refreshExchangeRate();
  const afterRate = await runtime.remote.getSessionDetail("sess-cache");
  expect(afterRate).not.toBe(first);
  expect(afterRate?.cnyEquivalentMicroCny).toBe(48_000);

  context = { systemTokens: 9, toolsTokens: 2, messageTokens: 3 };
  const afterContext = await runtime.remote.getSessionDetail("sess-cache");
  expect(afterContext).not.toBe(afterRate);
  expect(afterContext?.contextBreakdown?.systemTokens).toBe(9);

  providers = [{ id: "openai", name: "OpenAI", balanceSupported: false }];
  const afterProvider = await runtime.remote.getSessionDetail("sess-cache");
  expect(afterProvider).not.toBe(afterContext);

  emitActiveRequest(dsh, "sess-other");
  const afterUnrelatedActive = await runtime.remote.getSessionDetail("sess-cache");
  expect(afterUnrelatedActive).toBe(afterProvider);

  emitFinalUsage(dsh, "sess-cache", "req-c", "turn-c", 1_200);
  const afterSessionChange = await runtime.remote.getSessionDetail("sess-cache");
  expect(afterSessionChange).not.toBe(afterProvider);
  expect(afterSessionChange?.turns).toHaveLength(3);

  runtime.uninstall();
});

test("Host Remote exposes session cost tree, analytics, and ledger export without changing snapshots", async () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });
  emitFinalUsage(dsh, "sess-root", "req-root", "turn-root", 1_000);
  emitFinalUsage(dsh, "sess-child", "req-child", "turn-child", 2_000, { parentSessionId: "sess-root" });

  const snapshot = runtime.remote.getSnapshot();
  expect(snapshot).not.toHaveProperty("sessionCostTree");
  expect(snapshot).not.toHaveProperty("analytics");

  const tree = await runtime.remote.getSessionCostTree();
  expect(tree.roots.map((node) => node.id)).toEqual(["sess-root"]);
  expect(tree.nodes["sess-root"]?.childSessionIds).toEqual(["sess-child"]);
  expect(tree.nodes["sess-root"]?.subtreeSummary.totalMicroCny).toBe(snapshot.summary.localTotalMicroCny);
  expect(tree.nodes["sess-child"]?.detail?.id).toBe("sess-child");

  const analytics = await runtime.remote.getCostAnalytics();
  expect(analytics.global.requestCount).toBe(2);
  expect(analytics.sessions.map((session) => session.sessionId).sort()).toEqual(["sess-child", "sess-root"]);

  const jsonExport = await runtime.remote.exportLedger("json");
  const parsed = JSON.parse(jsonExport) as { events?: Array<Record<string, unknown>> };
  expect(parsed.events).toHaveLength(2);
  expect(parsed.events?.find((event) => event.sessionId === "sess-child")).toMatchObject({
    parentSessionId: "sess-root",
  });

  const csvExport = await runtime.remote.exportLedger("csv");
  expect(csvExport.split("\n")[0]).toContain("parentSessionId");
  expect(csvExport).toContain("req-child:final");

  runtime.uninstall();
});

test("Typert Remote facade forwards EXT remote methods through descriptors and schemas", async () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });
  emitFinalUsage(dsh, "sess-root", "req-root", "turn-root", 1_000);
  emitFinalUsage(dsh, "sess-child", "req-child", "turn-child", 2_000, { parentSessionId: "sess-root" });
  const namespace = createTypertNamespace(runtime.remote);
  const facade = await createMyMeterRemoteFromTypert(namespace, { pollIntervalMs: 0 });

  expect(MYMETER_REMOTE_DESCRIPTORS.map((descriptor) => descriptor.method)).toEqual([
    "getSnapshot",
    "listSessions",
    "getSessionDetail",
    "getBalance",
    "refreshBalance",
    "getSettings",
    "refreshExchangeRate",
    "getSessionCostTree",
    "getCostAnalytics",
    "getUsageOverview",
    "exportLedger",
  ]);
  expect(MYMETER_LOCAL_TYPERT_CONTRIBUTION.schemas.map((entry) => entry.name)).toContain("RemoteSessionCostTree");
  expect(MYMETER_LOCAL_TYPERT_CONTRIBUTION.schemas.map((entry) => entry.name)).toContain("RemoteCostAnalyticsReport");
  expect(await facade.getSessionCostTree()).toMatchObject({
    nodes: {
      "sess-child": {
        parentSessionId: "sess-root",
      },
    },
  });
  expect((await facade.getCostAnalytics()).global.requestCount).toBe(2);
  const usageOverview = await facade.getUsageOverview({ range: "7d" });
  expect(usageOverview.trend).toHaveLength(7);
  expect(usageOverview.trend.some((bucket) => (bucket.models ?? []).length > 0)).toBe(true);
  expect(usageOverview.totals.requestCount).toBe(2);
  expect(await facade.exportLedger("csv")).toContain("req-child:final");

  facade.dispose();
  runtime.uninstall();
});

test("Typert Remote defaults missing usage overview bucket models to empty arrays", async () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });
  const namespace = createTypertNamespace(runtime.remote);
  namespace.getUsageOverview = async () => ({
    ok: true,
    value: {
      range: "today",
      timeZone: "Asia/Shanghai",
      generatedAt: "2026-08-20T00:00:00.000Z",
      startAt: "2026-08-20T00:00:00.000Z",
      endAt: "2026-08-21T00:00:00.000Z",
      totals: {
        amountMicroCny: 0,
        totalTokens: 0,
        requestCount: 0,
        pricedRequestCount: 0,
        unknownRequestCount: 0,
        coverage: "unavailable",
      },
      trend: Array.from({ length: 24 }, (_, index) => ({
        key: String(index).padStart(2, "0"),
        startAt: "2026-08-20T00:00:00.000Z",
        endAt: "2026-08-20T01:00:00.000Z",
        amountMicroCny: 0,
        totalTokens: 0,
        requestCount: 0,
        pricedRequestCount: 0,
        unknownRequestCount: 0,
        coverage: "unavailable",
      })),
      topModels: [],
    },
  });
  const facade = await createMyMeterRemoteFromTypert(namespace, { pollIntervalMs: 0 });

  const report = await facade.getUsageOverview({ range: "today" });
  expect(report.trend).toHaveLength(24);
  expect(report.trend.every((bucket) => (bucket.models ?? []).length === 0)).toBe(true);

  facade.dispose();
  runtime.uninstall();
});

test("Typert Remote rejects malformed usage overview responses", async () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });
  const namespace = createTypertNamespace(runtime.remote);
  namespace.getUsageOverview = async () => ({
    ok: true,
    value: {
      range: "today",
      timeZone: "Asia/Shanghai",
      generatedAt: "2026-08-20T00:00:00.000Z",
      startAt: "2026-08-20T00:00:00.000Z",
      endAt: "2026-08-21T00:00:00.000Z",
      totals: {
        amountMicroCny: 0,
        totalTokens: 0,
        requestCount: 0,
        pricedRequestCount: 1,
        unknownRequestCount: 0,
        coverage: "complete",
      },
      trend: [],
      topModels: [],
    },
  });
  const facade = await createMyMeterRemoteFromTypert(namespace, { pollIntervalMs: 0 });

  await expect(facade.getUsageOverview({ range: "today" })).rejects.toThrow(/usageOverview\.trend/);

  facade.dispose();
  runtime.uninstall();
});

function emitFinalUsage(
  dsh: FakeDshContext,
  sessionId: string,
  id: string,
  turnId: string,
  offsetMs: number,
  metadata: { provider?: string; model?: string; parentSessionId?: string } = {},
): void {
  // Anchor to today 00:00 UTC (= 08:00 Asia/Shanghai, deterministic DeepSeek
  // off-peak zone) instead of a hard-coded date: the date ages out of the 7d
  // usage-overview window, and a "now"-based hour would drift across the
  // peak/off-peak boundary.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const anchor = dayStart.getTime();
  dsh.emit("mymeter:final_usage", {
    id,
    requestStartedAt: new Date(anchor + offsetMs).toISOString(),
    completedAt: new Date(anchor + offsetMs + 1_000).toISOString(),
    metadata: {
      sessionId,
      turnId,
      stepId: "step-1",
      attemptId: "attempt-1",
      provider: metadata.provider ?? "deepseek",
      model: metadata.model ?? "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
      ...(metadata.parentSessionId ? { parentSessionId: metadata.parentSessionId } : {}),
    },
    usage: {
      inputTokens: 1_000,
      outputTokens: 1_000,
      cacheReadTokens: 100,
      reasoningTokens: 100,
    },
    requestOutcome: "success",
  });
}

function createTypertNamespace(
  remote: ReturnType<typeof createMyMeterHostRuntime>["remote"],
): MyMeterTypertRemoteNamespace {
  return {
    getSnapshot: async () => ({ ok: true, value: remote.getSnapshot() }),
    listSessions: async () => ({ ok: true, value: await remote.listSessions() }),
    getSessionDetail: async (sessionId: string) => ({ ok: true, value: await remote.getSessionDetail(sessionId) }),
    getBalance: async () => ({ ok: true, value: await remote.getBalance() }),
    getSettings: async () => ({ ok: true, value: await remote.getSettings() }),
    refreshExchangeRate: async () => ({ ok: true, value: await remote.refreshExchangeRate() }),
    getSessionCostTree: async () => ({ ok: true, value: await remote.getSessionCostTree() }),
    getCostAnalytics: async () => ({ ok: true, value: await remote.getCostAnalytics() }),
    getUsageOverview: async (query) => ({ ok: true, value: await remote.getUsageOverview(query) }),
    exportLedger: async (format) => ({ ok: true, value: await remote.exportLedger(format) }),
  };
}

function emitActiveRequest(
  dsh: FakeDshContext,
  sessionId: string,
  options: { lastActivityAt?: string } = {},
): void {
  dsh.emit("mymeter:active_request", {
    requestStartedAt: "2026-08-17T04:00:03.000Z",
    lastActivityAt: options.lastActivityAt ?? "2026-08-17T04:00:04.000Z",
    metadata: {
      sessionId,
      turnId: "turn-active",
      stepId: "step-active",
      attemptId: "attempt-active",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
    },
  });
}
