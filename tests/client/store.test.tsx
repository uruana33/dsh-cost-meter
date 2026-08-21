import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  GlobalSessionList,
  MyMeterConversationView,
  ShellOverlay,
  createMockRemote,
  createMyMeterStore,
  formatMicroCny,
  resolvePrimaryStatus,
  type StorageLike,
} from "../../packages/client/src";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
});

afterEach(() => {
  storage.clear();
  vi.useRealTimers();
});

describe("MyMeter store and mock remote", () => {
  test("resolves remote priority, selection, and persisted settings", () => {
    const remote = createMockRemote("billing");
    const store = createMyMeterStore({
      remote,
      storage,
      storageKey: "mymeter.settings",
    });

    expect(store.getState().viewModel.status.code).toBe("billing");
    expect(store.getState().viewModel.currentRequest.label).toBe("¥0.004");

    remote.setScenario("balance_expired");
    expect(store.getState().viewModel.status.code).toBe("balance_expired");

    remote.setScenario("failed");
    expect(store.getState().viewModel.status.code).toBe("failed");

    store.setOverlayPosition({ x: 320, y: 180 });
    store.setPinnedSessionId("sess-2");
    store.selectSession("sess-2");

    const nextStore = createMyMeterStore({
      remote: createMockRemote("idle"),
      storage,
      storageKey: "mymeter.settings",
    });

    expect(nextStore.getState().settings.overlayPosition).toEqual({ x: 24, y: 24 });
    expect(nextStore.getState().settings.pinnedSessionId).toBe("sess-2");
    expect(nextStore.getState().viewModel.scope.label).toContain("sess-2");
  });

  test("starts with defaults when browser persistence cannot be read", () => {
    const unreadableStorage: StorageLike = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {},
      removeItem: () => {},
    };

    const store = createMyMeterStore({ remote: createMockRemote("idle"), storage: unreadableStorage });

    expect(store.getState().settings).toEqual(expect.objectContaining({
      reducedMotion: false,
      muted: true,
      overlayCollapsed: true,
    }));

    store.destroy();
  });

  test("drops legacy skin preferences instead of persisting a plugin theme", () => {
    storage.setItem("legacy.settings", JSON.stringify({
      skinId: "fuel",
      reducedMotion: true,
    }));
    const store = createMyMeterStore({
      remote: createMockRemote("idle"),
      storage,
      storageKey: "legacy.settings",
    });

    expect(store.getState().settings).not.toHaveProperty("skinId");
    expect(store.getState().settings.reducedMotion).toBe(true);

    store.setMuted(false);
    expect(JSON.parse(storage.getItem("legacy.settings") ?? "{}")).not.toHaveProperty("skinId");

    store.destroy();
  });

  test("keeps estimated amounts distinct from real zero costs", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("unknown"),
      storage,
      storageKey: "mymeter.settings",
    });
    const viewModel = store.getState().viewModel;

    expect(viewModel.status.code).toBe("unknown");
    expect(viewModel.currentRequest.label).toBe("¥0.003（估算）");
    expect(viewModel.currentRequest.detailLabel).not.toBe("¥0.000000");
    expect(viewModel.estimatedTotal.label).toBe("¥0.003（估算）");
    expect(viewModel.detail?.currentRequest.label).toBe("¥0.003（估算）");
    expect(viewModel.detail?.turns.at(-1)?.amount.label).toBe("¥0.003");
  });

  test("maps session stages without reusing live context for historical stages", () => {
    const remote = createMockRemote("billing");
    const store = createMyMeterStore({
      remote,
      storage,
      storageKey: "mymeter.settings",
    });
    const detail = store.getState().viewModel.detail;

    expect(detail?.stages).toHaveLength(2);
    expect(detail?.stages.map((stage) => stage.index)).toEqual([1, 2]);
    expect(detail?.stages.map((stage) => stage.isCurrent)).toEqual([false, true]);
    expect(detail?.stages[0]?.model).toBe("deepseek-chat");
    expect(detail?.stages[0]?.contextBreakdown).toBeNull();
    expect(detail?.stages[1]?.model).toBe("deepseek-reasoner");
    expect(detail?.stages[1]?.contextBreakdown).toEqual(detail?.contextBreakdown);
    expect(detail?.stages[1]?.currentRequest.label).toBe("¥0.004");
  });

  test("derives cache savings, budget status, and pricing-zone countdown in the client view model", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T11:30:00+08:00"));
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    const detail = snapshot.details["sess-1"]!;
    detail.tokenBuckets = detail.tokenBuckets.map((bucket) => ({
      ...bucket,
      unitPriceMicroCnyPerMillionTokens: bucket.label === "缓存命中"
        ? 100_000
        : bucket.label === "缓存未命中"
          ? 3_000_000
          : 9_000_000,
    }));
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage, storageKey: "mymeter.settings" });

    store.setBudgetThresholdMicroCny(100_000);

    const viewModel = store.getState().viewModel;
    expect(viewModel.insights.budget.level).toBe("danger");
    expect(viewModel.insights.budget.percentLabel).toBe("2483%");
    expect(viewModel.insights.budget.message).toBe("本地累计已超过预算阈值 ¥0.100。");
    expect(viewModel.insights.pricingZoneCountdown.currentZone).toBe("peak");
    expect(viewModel.insights.pricingZoneCountdown.nextZone).toBe("offpeak");
    expect(viewModel.insights.pricingZoneCountdown.remainingLabel).toBe("30分钟");
    expect(viewModel.insights.pricingZoneCountdown.transitionTimeLabel).toBe("12:00");
    expect(viewModel.detail?.insights.cacheSavings.available).toBe(true);
    expect(viewModel.detail?.insights.cacheSavings.tokens).toBe(18_420);
    expect(viewModel.detail?.insights.cacheSavings.amount?.label).toBe("¥0.053");
    expect(viewModel.detail?.insights.budget.level).toBe("danger");
    expect(viewModel.detail?.insights.budget.message).toBe("会话费用已超过预算阈值 ¥0.100。");
    expect(viewModel.alerts).toContain("本地累计已超过预算阈值 ¥0.100。");

    store.destroy();
  });

  test("uses 50/80/100 budget levels and does not compare non-CNY budgets", () => {
    const remote = createMockRemote("billing");
    const store = createMyMeterStore({ remote, storage, storageKey: "budget-levels.settings" });

    store.setBudgetThresholdMicroCny(4_000_000);
    expect(store.getState().viewModel.insights.budget.level).toBe("notice");
    expect(store.getState().viewModel.alerts).toContain("本地累计已达到预算阈值 62%。");

    store.setBudgetThresholdMicroCny(3_000_000);
    expect(store.getState().viewModel.insights.budget.level).toBe("warning");

    store.setBudgetThresholdMicroCny(2_000_000);
    expect(store.getState().viewModel.insights.budget.level).toBe("danger");

    const snapshot = remote.getSnapshot();
    snapshot.summary.currency = "USD";
    snapshot.summary.currencyTotals = [{
      currency: "USD",
      amountMinor: 2_483_000,
      settledMinor: 2_479_000,
      estimatedMinor: 4_000,
      failedMinor: 0,
    }];
    snapshot.summary.sessionTotalMinor = 2_483_000;
    remote.setSnapshot(snapshot);

    expect(store.getState().viewModel.insights.budget.level).toBe("unavailable");
    expect(store.getState().viewModel.insights.budget.message).toBeNull();
    expect(store.getState().viewModel.alerts.some((alert) => alert.includes("预算阈值"))).toBe(false);

    store.destroy();
  });

  test("loads session cost tree, analytics, and downloads exported ledgers from optional remote methods", async () => {
    const remote = createMockRemote("billing");
    const getSessionCostTree = vi.fn(async () => ({
      summary: ledgerSummary("all", 300),
      anomalies: {
        missingParents: [{ sessionId: "orphan", parentSessionId: "missing" }],
        cycles: [["cycle-a", "cycle-b"]],
      },
      nodes: {
        root: {
          id: "root",
          title: "Root",
          childSessionIds: ["child"],
          depth: 0,
          path: ["root"],
          summary: ledgerSummary("root", 100),
          subtreeSummary: ledgerSummary("root", 150),
          orphaned: false,
          cyclic: false,
        },
        child: {
          id: "child",
          title: "Child",
          parentSessionId: "root",
          childSessionIds: [],
          depth: 1,
          path: ["root", "child"],
          summary: ledgerSummary("child", 50),
          subtreeSummary: ledgerSummary("child", 50),
          orphaned: false,
          cyclic: true,
        },
      },
      roots: [] as unknown[],
    }));
    const getCostAnalytics = vi.fn(async () => ({
      generatedAt: "2026-08-19T00:00:00.000Z",
      global: {
        totalMicroCny: 300,
        requestCount: 2,
        statusCounts: { estimated: 0, settled: 2, unknown: 0, failed: 0 },
        peakMicroCny: 300,
        offpeakMicroCny: 0,
      },
      sessions: [],
      dailyTrend: [{
        key: "2026-08-19",
        startAt: "2026-08-19T00:00:00.000Z",
        endAt: "2026-08-20T00:00:00.000Z",
        amountMicroCny: 300,
        requestCount: 2,
        statusCounts: { estimated: 0, settled: 2, unknown: 0, failed: 0 },
        peakMicroCny: 300,
        offpeakMicroCny: 0,
        previousAmountMicroCny: 100,
        deltaMicroCny: 200,
        deltaRatio: 3,
      }],
      hourlyTrend: [],
      anomalies: [{
        ruleId: "daily_spend_spike",
        severity: "warning" as const,
        bucketKey: "2026-08-19",
        threshold: 4,
        explanation: "单日费用突增",
      }],
    }));
    const exportLedger = vi.fn(async (format: "json" | "csv") => format === "json" ? "{\"schemaVersion\":1}" : "id,total");
    Object.assign(remote, {
      getSessionCostTree: async () => {
        const tree = await getSessionCostTree();
        return { ...tree, roots: [tree.nodes.root] };
      },
      getCostAnalytics,
      exportLedger,
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const createObjectURL = vi.mocked(URL.createObjectURL);
    const revokeObjectURL = vi.mocked(URL.revokeObjectURL);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const store = createMyMeterStore({ remote, storage, storageKey: "remote-tools.settings" });

    await act(async () => {
      await store.loadSessionCostTree();
      await store.loadCostAnalytics();
      await store.exportLedger("csv");
    });

    const viewModel = store.getState().viewModel;
    expect(viewModel.sessionCostTree.status).toBe("ready");
    expect(viewModel.sessionCostTree.data?.roots[0]?.children[0]?.anomalyLabels).toEqual(["循环断开"]);
    expect(viewModel.sessionCostTree.data?.anomalyLabels).toContain("orphan 缺少父会话 missing");
    expect(viewModel.costAnalytics.status).toBe("ready");
    expect(viewModel.costAnalytics.data?.dailyTrend[0]?.deltaLabel).toBe("+<¥0.001 / +200%");
    expect(viewModel.costAnalytics.data?.anomalies[0]?.explanation).toBe("单日费用突增");
    expect(exportLedger).toHaveBeenCalledWith("csv");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    expect(store.getState().viewModel.ledgerExport.status).toBe("ready");
    expect(store.getState().viewModel.ledgerExport.format).toBe("csv");

    click.mockRestore();
    store.destroy();
  });

  test("loads usage overview by range, caches each range, and ignores stale responses", async () => {
    const remote = createMockRemote("billing");
    const getUsageOverview = vi.fn(async ({ range }: { range: "today" | "7d" | "30d" }) => usageOverviewReport(range));
    Object.assign(remote, { getUsageOverview });
    const store = createMyMeterStore({ remote, storage, storageKey: "usage-overview.settings" });

    await act(async () => {
      await store.loadUsageOverview("today");
    });
    expect(store.getState().viewModel.usageOverview.status).toBe("ready");
    expect(store.getState().viewModel.usageOverview.data?.range).toBe("today");
    expect(store.getState().viewModel.usageOverview.data?.trend.at(-1)?.models).toEqual([
      expect.objectContaining({
        provider: "deepseek",
        model: "deepseek-chat",
      }),
    ]);
    expect(getUsageOverview).toHaveBeenCalledTimes(1);

    await act(async () => {
      await store.loadUsageOverview("today");
    });
    expect(getUsageOverview).toHaveBeenCalledTimes(1);

    await act(async () => {
      store.setAnalyticsRange("7d");
      await Promise.resolve();
    });
    expect(store.getState().ui.analyticsRange).toBe("7d");
    expect(store.getState().viewModel.usageOverview.data?.range).toBe("7d");
    expect(getUsageOverview).toHaveBeenCalledTimes(2);

    store.destroy();
  });

  test("keeps the last overview visible when a refreshed report fails", async () => {
    vi.useFakeTimers();
    const remote = createMockRemote("billing");
    let shouldFail = false;
    const getUsageOverview = vi.fn(async ({ range }: { range: "today" | "7d" | "30d" }) => {
      if (shouldFail) throw new Error("overview unavailable");
      return usageOverviewReport(range);
    });
    Object.assign(remote, { getUsageOverview });
    const store = createMyMeterStore({ remote, storage, storageKey: "usage-overview-stale.settings" });

    await act(async () => {
      await store.loadUsageOverview("today");
    });
    const previous = store.getState().viewModel.usageOverview.data;
    shouldFail = true;
    const snapshot = remote.getSnapshot();
    snapshot.ledgerGeneration = 1;
    remote.setSnapshot(snapshot);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(getUsageOverview).toHaveBeenCalledTimes(2);
    expect(store.getState().viewModel.usageOverview.status).toBe("error");
    expect(store.getState().viewModel.usageOverview.data).toBe(previous);
    expect(store.getState().viewModel.usageOverview.error).toBe("overview unavailable");
    store.destroy();
  });

  test("refreshes the current overview when the ledger generation changes", async () => {
    vi.useFakeTimers();
    const remote = createMockRemote("billing");
    const initial = remote.getSnapshot();
    initial.ledgerGeneration = 1;
    remote.setSnapshot(initial);
    const getUsageOverview = vi.fn(async ({ range }: { range: "today" | "7d" | "30d" }) => usageOverviewReport(range));
    Object.assign(remote, { getUsageOverview });
    const store = createMyMeterStore({ remote, storage, storageKey: "usage-overview-generation.settings" });

    await act(async () => {
      await store.loadUsageOverview("today");
    });
    const next = remote.getSnapshot();
    next.ledgerGeneration = 2;
    remote.setSnapshot(next);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(getUsageOverview).toHaveBeenCalledTimes(2);
    expect(store.getState().viewModel.usageOverview.status).toBe("ready");
    store.destroy();
  });

  test("resolves and filters balance status states", () => {
    expect(resolvePrimaryStatus("billing", "expired", "billing")).toBe("balance_expired");
    expect(resolvePrimaryStatus("billing", "insufficient", "billing")).toBe("balance_insufficient");

    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    snapshot.sessions[0]!.status = "balance_insufficient";
    snapshot.sessions[1]!.status = "balance_expired";
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage, storageKey: "mymeter.settings" });

    render(<GlobalSessionList store={store} />);
    expect(screen.getByRole("option", { name: "余额过期" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "余额不足" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("筛选状态"), { target: { value: "balance_insufficient" } });

    expect(screen.getByText("修复登录超时")).toBeTruthy();
    expect(screen.queryByText("API 文档整理")).toBeNull();
  });

  test.each([
    ["USD", "$"],
    ["CNY", "¥"],
  ] as const)("formats %s balance and warns below five units", (currency, symbol) => {
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    Object.assign(snapshot.summary, { provider: "deepseek" });
    Object.assign(snapshot.details["sess-1"]!, { provider: "deepseek" });
    Object.assign(snapshot.balance, {
      currency,
      totalMicroCny: 4_500_000,
    });
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage, storageKey: "mymeter.settings" });

    expect(store.getState().viewModel.balance.supported).toBe(true);
    expect(store.getState().viewModel.balance.total?.label).toBe(`${symbol}4.500`);
    expect(store.getState().viewModel.balance.status).toBe("insufficient");
    expect(store.getState().viewModel.alerts).toContain(`DeepSeek 账户余额低于 ${symbol}5，请及时充值。`);

    render(<MyMeterConversationView store={store} sessionId="sess-1" />);
    expect(screen.getByText("账户余额")).toBeTruthy();
    expect(screen.getByRole("link", { name: "去充值" })).toHaveAttribute(
      "href",
      "https://platform.deepseek.com/top_up",
    );
  });

  test("only lists the supported DeepSeek balance", () => {
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    Object.assign(snapshot, {
      balances: [
        {
          provider: "deepseek-official",
          providerName: "DeepSeek",
          supported: true,
          ...snapshot.balance,
        },
        {
          provider: "openai",
          providerName: "OpenAI",
          supported: false,
          status: "unavailable",
          currency: null,
          totalMicroCny: null,
          grantedMicroCny: null,
          toppedUpMicroCny: null,
          refreshedAt: null,
        },
        {
          provider: "anthropic",
          providerName: "Anthropic",
          supported: false,
          status: "unavailable",
          currency: null,
          totalMicroCny: null,
          grantedMicroCny: null,
          toppedUpMicroCny: null,
          refreshedAt: null,
        },
      ],
    });
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage, storageKey: "mymeter.settings" });

    expect(store.getState().viewModel.balances).toEqual([
      expect.objectContaining({ provider: "deepseek-official", providerName: "DeepSeek", supported: true }),
    ]);

    render(<MyMeterConversationView store={store} sessionId="sess-1" />);
    expect(screen.getByText("DeepSeek")).toBeTruthy();
    expect(screen.queryByText("OpenAI")).toBeNull();
    expect(screen.queryByText("Anthropic")).toBeNull();
    expect(screen.queryByText("暂不支持显示余额")).toBeNull();
    expect(screen.getByText("¥47.517")).toBeTruthy();
  });

  test.each(["CNY", "USD"] as const)("does not warn for %s at the exact five-unit boundary", (currency) => {
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    Object.assign(snapshot.summary, { provider: "deepseek" });
    Object.assign(snapshot.details["sess-1"]!, { provider: "deepseek" });
    Object.assign(snapshot.balance, { currency, totalMicroCny: 5_000_000 });
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage, storageKey: "mymeter.settings" });

    expect(store.getState().viewModel.balance.status).toBe("fresh");
    expect(store.getState().viewModel.balance.needsRecharge).toBe(false);

    render(<MyMeterConversationView store={store} sessionId="sess-1" />);
    expect(screen.getByRole("link", { name: "去充值" })).toHaveAttribute(
      "href",
      "https://platform.deepseek.com/top_up",
    );
  });

  test("keeps the recharge link beside a healthy supported balance", () => {
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    Object.assign(snapshot.summary, { provider: "deepseek" });
    Object.assign(snapshot.details["sess-1"]!, { provider: "deepseek" });
    Object.assign(snapshot.balance, { currency: "CNY", totalMicroCny: 12_000_000 });
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage, storageKey: "mymeter.settings" });

    render(<MyMeterConversationView store={store} sessionId="sess-1" />);

    expect(screen.getByRole("link", { name: "去充值" })).toHaveAttribute(
      "href",
      "https://platform.deepseek.com/top_up",
    );
  });

  test("preserves precision when a sub-five balance would otherwise display as five", () => {
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    Object.assign(snapshot.summary, { provider: "deepseek" });
    Object.assign(snapshot.details["sess-1"]!, { provider: "deepseek" });
    Object.assign(snapshot.balance, { currency: "USD", totalMicroCny: 4_999_999 });
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage, storageKey: "mymeter.settings" });

    expect(store.getState().viewModel.balance.needsRecharge).toBe(true);
    expect(store.getState().viewModel.balance.total?.label).toBe("$4.999999");
  });

  test("hides the balance area for an unsupported model provider", () => {
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    Object.assign(snapshot.summary, { provider: "openai" });
    Object.assign(snapshot.details["sess-1"]!, { provider: "openai" });
    Object.assign(snapshot, {
      balances: [{
        provider: "openai",
        providerName: "OpenAI",
        supported: false,
        status: "unavailable",
        currency: null,
        totalMicroCny: null,
        grantedMicroCny: null,
        toppedUpMicroCny: null,
        refreshedAt: null,
      }],
    });
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage, storageKey: "mymeter.settings" });

    expect(store.getState().viewModel.balance.supported).toBe(false);

    render(<MyMeterConversationView store={store} sessionId="sess-1" />);
    expect(screen.queryByText("账户余额")).toBeNull();
    expect(screen.queryByText("OpenAI")).toBeNull();
    expect(screen.queryByText("暂不支持显示余额")).toBeNull();
    expect(screen.queryByRole("link", { name: "去充值" })).toBeNull();
  });

  test("does not emit DeepSeek balance alerts for unsupported providers", () => {
    const remote = createMockRemote("balance_expired");
    const snapshot = remote.getSnapshot();
    Object.assign(snapshot.summary, { provider: "openai" });
    Object.assign(snapshot.details["sess-1"]!, { provider: "openai" });
    Object.assign(snapshot, {
      balances: [{
        provider: "openai",
        providerName: "OpenAI",
        supported: false,
        status: "unavailable",
        currency: null,
        totalMicroCny: null,
        grantedMicroCny: null,
        toppedUpMicroCny: null,
        refreshedAt: null,
      }],
    });
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage, storageKey: "mymeter.settings" });

    expect(store.getState().viewModel.alerts).not.toContain("余额快照已过期，不影响 DSH 本地累计。");
  });

  test("mock remote notifies and unsubscribes cleanly", () => {
    const remote = createMockRemote("idle");
    const seen: string[] = [];

    const unsubscribe = remote.subscribe((snapshot) => {
      seen.push(snapshot.summary.status.code);
    });

    remote.setScenario("settled");
    unsubscribe();
    remote.setScenario("failed");

    expect(seen).toEqual(["settled"]);
  });

  test("receipt overlay keeps its dragged position only for the current page", async () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage,
      storageKey: "mymeter.settings",
    });
    render(<ShellOverlay store={store} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("mymeter-shell")).toHaveAttribute("data-collapsed", "true");

    act(() => {
      store.setOverlayPosition({ x: 180, y: 220 });
    });

    expect(store.getState().settings.overlayPosition).toEqual({ x: 180, y: 220 });
    expect(storage.getItem("mymeter.settings")).toBeNull();
    store.destroy();
  });

  test("persists whether the floating billing overlay is enabled", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage,
      storageKey: "mymeter.settings",
    });

    expect(store.getState().settings.overlayEnabled).toBe(true);

    act(() => store.setOverlayEnabled(false));

    expect(JSON.parse(storage.getItem("mymeter.settings") ?? "{}").overlayEnabled).toBe(false);

    const nextStore = createMyMeterStore({
      remote: createMockRemote("idle"),
      storage,
      storageKey: "mymeter.settings",
    });
    expect(nextStore.getState().settings.overlayEnabled).toBe(false);

    store.destroy();
    nextStore.destroy();
  });

  test("keeps the floating overlay enabled when loading legacy settings", () => {
    storage.setItem("legacy-mymeter.settings", JSON.stringify({
      overlayPosition: { x: 80, y: 96 },
      overlayCollapsed: true,
    }));

    const store = createMyMeterStore({
      remote: createMockRemote("idle"),
      storage,
      storageKey: "legacy-mymeter.settings",
    });

    expect(store.getState().settings.overlayEnabled).toBe(true);
    expect(store.getState().settings.overlayCollapsed).toBe(true);
    expect(store.getState().settings.overlayPosition).toEqual({ x: 24, y: 24 });

    store.destroy();
  });

  test("follows the dsh current session when the host selection changes", () => {
    const remote = createMockRemote("billing");
    const store = createMyMeterStore({
      remote,
      storage,
      storageKey: "mymeter.settings",
    });
    let currentSessionId = "sess-1";
    const useSessions = <T,>(selector: (state: { current: string }) => T): T =>
      selector({ current: currentSessionId });

    const { rerender } = render(<ShellOverlay store={store} useSessions={useSessions} />);

    expect(store.getState().viewModel.scope.sessionId).toBe("sess-1");
    expect(store.getState().viewModel.detail?.id).toBe("sess-1");

    act(() => {
      currentSessionId = "sess-2";
      rerender(<ShellOverlay store={store} useSessions={useSessions} />);
    });

    expect(store.getState().viewModel.scope.sessionId).toBe("sess-2");
    expect(store.getState().viewModel.detail?.id).toBe("sess-2");
    expect(store.getState().viewModel.model).toBe("deepseek-chat");
    expect(store.getState().ui.activePanel).toBe("compact");

    act(() => {
      const staleRemoteSnapshot = remote.getSnapshot();
      staleRemoteSnapshot.currentSessionId = "sess-1";
      remote.setSnapshot(staleRemoteSnapshot);
    });
    expect(store.getState().viewModel.scope.sessionId).toBe("sess-2");

    store.destroy();
  });

  test("hides the floating overlay until the host has a billable session", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage,
      storageKey: "mymeter.settings",
    });
    let currentSessionId: string | undefined;
    const useSessions = <T,>(selector: (state: { current?: string }) => T): T =>
      selector(currentSessionId === undefined ? {} : { current: currentSessionId });

    const { rerender } = render(<ShellOverlay store={store} useSessions={useSessions} />);

    expect(screen.queryByTestId("mymeter-shell")).toBeNull();

    act(() => {
      currentSessionId = "new-session-draft";
      rerender(<ShellOverlay store={store} useSessions={useSessions} />);
    });
    expect(screen.queryByTestId("mymeter-shell")).toBeNull();

    act(() => {
      currentSessionId = "sess-1";
      rerender(<ShellOverlay store={store} useSessions={useSessions} />);
    });
    expect(screen.getByTestId("mymeter-shell")).toBeTruthy();

    act(() => {
      currentSessionId = undefined;
      rerender(<ShellOverlay store={store} useSessions={useSessions} />);
    });
    expect(screen.queryByTestId("mymeter-shell")).toBeNull();

    store.destroy();
  });

  test("does not let the host render loop overwrite an explicit meter selection", () => {
    const remote = createMockRemote("billing");
    const store = createMyMeterStore({ remote, storage, storageKey: "mymeter.settings" });
    let currentSessionId = "sess-1";
    const useSessions = <T,>(selector: (state: { current: string }) => T): T =>
      selector({ current: currentSessionId });
    const { rerender } = render(<ShellOverlay store={store} useSessions={useSessions} />);

    act(() => {
      store.selectSession("sess-2");
      rerender(<ShellOverlay store={store} useSessions={useSessions} />);
    });

    expect(store.getState().viewModel.scope.sessionId).toBe("sess-2");
    store.destroy();
  });
});

describe("formatting", () => {
  test("formats micro-CNY without floating point drift", () => {
    expect(formatMicroCny(1234)).toBe("¥0.001");
    expect(formatMicroCny(9876543)).toBe("¥9.877");
    expect(formatMicroCny(321)).toBe("<¥0.001");
  });
});

function ledgerSummary(agentPreset: string, totalMicroCny: number) {
  return {
    requestCount: 1,
    totalMicroCny,
    estimatedMicroCny: 0,
    settledMicroCny: totalMicroCny,
    unknownMicroCny: 0,
    failedMicroCny: 0,
    unknownCount: 0,
    estimatedCount: 0,
    settledCount: 1,
    failedCount: 0,
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    peakMicroCny: totalMicroCny,
    offpeakMicroCny: 0,
    firstSeenAt: "2026-08-19T00:00:00.000Z",
    lastSeenAt: "2026-08-19T00:00:00.000Z",
    provider: "deepseek",
    model: "deepseek-chat",
    reasoningEffort: "standard",
    agentPreset,
  };
}

function usageOverviewReport(range: "today" | "7d" | "30d") {
  const count = range === "today" ? 24 : range === "7d" ? 7 : 30;
  const trend = Array.from({ length: count }, (_, index) => ({
    key: range === "today" ? String(index).padStart(2, "0") : `2026-08-${String(index + 1).padStart(2, "0")}`,
    startAt: "2026-08-20T00:00:00.000Z",
    endAt: "2026-08-20T01:00:00.000Z",
    amountMicroCny: index === count - 1 ? 120_000 : 0,
    totalTokens: index === count - 1 ? 12_000 : 0,
    requestCount: index === count - 1 ? 1 : 0,
    pricedRequestCount: index === count - 1 ? 1 : 0,
    unknownRequestCount: 0,
    coverage: index === count - 1 ? "complete" as const : "unavailable" as const,
    models: index === count - 1 ? [{
      provider: "deepseek",
      model: "deepseek-chat",
      amountMicroCny: 120_000,
      totalTokens: 12_000,
      requestCount: 1,
      pricedRequestCount: 1,
      unknownRequestCount: 0,
      coverage: "complete" as const,
    }] : [],
  }));
  return {
    range,
    timeZone: "Asia/Shanghai",
    generatedAt: "2026-08-20T00:00:00.000Z",
    startAt: "2026-08-20T00:00:00.000Z",
    endAt: "2026-08-21T00:00:00.000Z",
    totals: {
      amountMicroCny: 120_000,
      totalTokens: 12_000,
      requestCount: 1,
      pricedRequestCount: 1,
      unknownRequestCount: 0,
      coverage: "complete" as const,
    },
    trend,
    topModels: [{
      provider: "deepseek",
      model: "deepseek-chat",
      amountMicroCny: 120_000,
      totalTokens: 12_000,
      requestCount: 1,
      pricedRequestCount: 1,
      unknownRequestCount: 0,
      coverage: "complete" as const,
    }],
  };
}
