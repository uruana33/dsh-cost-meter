import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  GlobalSessionList,
  ShellOverlay,
  MyMeterConversationView,
  MyMeterSettingsCard,
  SessionDetailPanel,
  createMockRemote,
  createMyMeterStore,
  snapOverlayPosition,
  type StorageLike,
} from "../../packages/client/src";
const NARROW_VIEWPORT = { width: 320, height: 480 };

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
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("overlay visual contract", () => {
  test("renders Token计费 details with dsh theme tokens and without overlay navigation", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    render(<MyMeterConversationView store={store} sessionId="sess-1" />);

    expect(screen.getByRole("region", { name: "Token计费" })).toBeTruthy();
    expect(screen.queryByText("液晶")).toBeNull();
    expect(screen.getByText(/Token 计费明细/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "全部会话" })).toBeNull();
    expect(store.getState().ui.selectedSessionId).toBe("sess-1");

    const region = screen.getByRole("region", { name: "Token计费" });
    expect(region.getAttribute("style")).toContain("var(--dsw-alias-bg-base");
    expect(region.getAttribute("style")).toContain("var(--dsw-alias-label-primary");

    store.destroy();
  });

  test("labels the session ID and keeps it left aligned when the session has no separate title", () => {
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    const sessionId = "session-5a4e3139-fe8c-4d09-9082-3b65fa3e58eb";
    const detail = snapshot.details["sess-1"]!;
    detail.id = sessionId;
    detail.title = sessionId;
    remote.setSnapshot(snapshot);

    const store = createMyMeterStore({ remote, storage: new MemoryStorage() });
    store.selectSession("sess-1");
    render(<SessionDetailPanel store={store} showNavigation={false} />);

    const sessionIdRow = screen.getByLabelText("会话ID");
    expect(sessionIdRow).toHaveTextContent(`会话ID${sessionId}`);
    expect(sessionIdRow.style.textAlign).toBe("left");
    expect(screen.getByText(sessionId)).toBeTruthy();
    store.destroy();
  });

  test("hides the redundant failed status badge from session detail", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("failed"),
      storage: new MemoryStorage(),
    });
    store.selectSession("sess-1");
    render(<SessionDetailPanel store={store} showNavigation={false} />);

    expect(screen.queryByText("失败", { exact: true })).toBeNull();
    expect(store.getState().viewModel.status.code).toBe("failed");
    store.destroy();
  });

  test("hides the floating overlay while the Token计费 conversation view is mounted", async () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });

    const view = render(
      <>
        <ShellOverlay store={store} />
        <MyMeterConversationView store={store} sessionId="sess-1" />
      </>,
    );

    expect(store.getState().ui.overlayVisible).toBe(false);
    expect(screen.queryByTestId("mymeter-shell")).toBeNull();

    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(store.getState().ui.overlayVisible).toBe(true);
    store.destroy();
  });

  test("does not briefly show and reposition the overlay when switching conversation sessions", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    const visibility: boolean[] = [];
    const unsubscribe = store.subscribe(() => {
      visibility.push(store.getState().ui.overlayVisible);
    });

    const view = render(
      <>
        <ShellOverlay store={store} />
        <MyMeterConversationView store={store} sessionId="sess-1" />
      </>,
    );
    visibility.length = 0;

    act(() => {
      view.rerender(
        <>
          <ShellOverlay store={store} />
          <MyMeterConversationView store={store} sessionId="sess-2" />
        </>,
      );
    });

    expect(store.getState().ui.overlayVisible).toBe(false);
    expect(visibility).not.toContain(true);

    unsubscribe();
    view.unmount();
    store.destroy();
  });

  test("keeps the overlay hidden across a conversation view remount", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    const visibility: boolean[] = [];
    const unsubscribe = store.subscribe(() => {
      visibility.push(store.getState().ui.overlayVisible);
    });

    const firstView = render(<MyMeterConversationView store={store} sessionId="sess-1" />);
    visibility.length = 0;
    firstView.unmount();
    const secondView = render(<MyMeterConversationView store={store} sessionId="sess-2" />);

    expect(store.getState().ui.overlayVisible).toBe(false);
    expect(visibility).not.toContain(true);

    unsubscribe();
    secondView.unmount();
    store.destroy();
  });

  test("keeps the floating overlay suppressed while persisting its enabled state from Token计费", async () => {
    const storage = new MemoryStorage();
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage,
      storageKey: "conversation-overlay.settings",
    });

    const overlayView = render(<ShellOverlay store={store} />);
    const conversationView = render(<MyMeterConversationView store={store} sessionId="sess-1" />);

    const overlaySwitch = screen.getByRole("switch", { name: "显示计费浮窗" });
    expect(overlaySwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("mymeter-shell")).toBeNull();

    fireEvent.click(overlaySwitch);
    expect(overlaySwitch).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("mymeter-shell")).toBeNull();
    expect(store.getState().settings.overlayEnabled).toBe(false);
    expect(JSON.parse(storage.getItem("conversation-overlay.settings") ?? "{}").overlayEnabled).toBe(false);

    fireEvent.click(overlaySwitch);
    expect(overlaySwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("mymeter-shell")).toBeNull();
    expect(store.getState().settings.overlayEnabled).toBe(true);
    expect(JSON.parse(storage.getItem("conversation-overlay.settings") ?? "{}").overlayEnabled).toBe(true);

    conversationView.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(store.getState().ui.overlayVisible).toBe(true);
    expect(screen.getByTestId("mymeter-shell")).toBeTruthy();

    const reopenedConversationView = render(<MyMeterConversationView store={store} sessionId="sess-1" />);
    expect(screen.getByRole("switch", { name: "显示计费浮窗" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("mymeter-shell")).toBeNull();

    reopenedConversationView.unmount();
    overlayView.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    store.destroy();
  });

  test("shows the overlay switch as off after the overlay is closed outside Token计费", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });

    const overlayView = render(<ShellOverlay store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "关闭计费浮窗" }));

    const conversationView = render(<MyMeterConversationView store={store} sessionId="sess-1" />);
    expect(screen.getByRole("switch", { name: "显示计费浮窗" })).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("mymeter-shell")).toBeNull();

    conversationView.unmount();
    overlayView.unmount();
    store.destroy();
  });

  test("uses the same concise token bucket labels in session detail", async () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    store.selectSession("sess-1");

    render(<SessionDetailPanel store={store} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("输入 Token(无缓存)")).toBeTruthy();
    expect(screen.getByText("输入 Token(缓存)")).toBeTruthy();
    expect(screen.getByText("输出 Token")).toBeTruthy();
    expect(screen.getByText("推理 Token")).toBeTruthy();
    expect(screen.getByText("非推理 Token")).toBeTruthy();
    expect(screen.queryByText(/其中：/)).toBeNull();
    expect(screen.getByText("2,020")).toBeTruthy();
    expect(screen.getByText("上下文构成（估算）")).toBeTruthy();
    expect(screen.getByText("系统提示词")).toBeTruthy();
    expect(screen.getByText("工具定义")).toBeTruthy();
    expect(screen.getByText("会话消息")).toBeTruthy();
    expect(screen.getByText("估算值，不参与费用计算")).toBeTruthy();
    expect(screen.queryByText("缓存未命中")).toBeNull();
    store.destroy();
  });

  test("renders native session stages in tabs and keeps totals outside the selected stage", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    store.selectSession("sess-1");
    Object.assign(store.getState().viewModel.detail!, { stages: createUiStages() });
    const sessionTotal = store.getState().viewModel.detail!.sessionTotal.label;

    render(<div style={{ width: NARROW_VIEWPORT.width }}><SessionDetailPanel store={store} /></div>);

    const tabList = screen.getByRole("tablist", { name: "计费分段" });
    expect(tabList).toBeTruthy();
    expect(tabList.style.overflowX).toBe("auto");
    expect(tabList.style.touchAction).toBe("pan-x");
    expect(screen.getByRole("tab", { name: "计费段 #2 当前" })).toHaveAttribute("aria-selected", "true");
    const stageMetadata = screen.getByRole("region", { name: "计费段信息" });
    expect(stageMetadata).toHaveTextContent("计费段信息");
    expect(stageMetadata).toHaveTextContent("价格版本");
    expect(stageMetadata).toHaveTextContent("时间范围");
    expect(screen.getByText("会话总费用").parentElement?.textContent).toContain(sessionTotal);
    expect(screen.queryByText("SESSION TOTAL")).toBeNull();
    expect(stageMetadata).toHaveTextContent("当前费率");
    expect(stageMetadata).toHaveTextContent("空闲时段");
    expect(stageMetadata).toHaveTextContent("输入¥4.500");
    expect(stageMetadata).toHaveTextContent("缓存¥0.150");
    expect(stageMetadata).toHaveTextContent("输出¥13.500");
    expect(stageMetadata).toHaveTextContent("元 / 百万 Token");
    expect(screen.getByRole("columnheader", { name: "单价（元/百万 Token）" })).toBeTruthy();
    expect(screen.getByRole("row", { name: "输入 Token(无缓存) 10,600 ¥4.500 ¥0.382" })).toBeTruthy();
    expect(screen.getByRole("row", { name: "输入 Token(缓存) 12,300 ¥0.150 ¥0.044" })).toBeTruthy();
    expect(screen.getByRole("row", { name: "输出 Token 8,780 ¥13.500 ¥0.642" })).toBeTruthy();
    expect(screen.getByRole("row", { name: "推理 Token 6,240 同输出 已包含" })).toBeTruthy();
    expect(screen.getByRole("row", { name: "非推理 Token 2,540 同输出 推导值" })).toBeTruthy();

    const tokenTableBackground = "var(--dsw-alias-bg-layer-1, #ffffff)";
    expect(screen.getByRole("columnheader", { name: "计费项" }).parentElement?.style.background).toBe(tokenTableBackground);
    expect(screen.getByRole("row", { name: "推理 Token 6,240 同输出 已包含" }).style.background).toBe(tokenTableBackground);
    expect(screen.getByRole("row", { name: "非推理 Token 2,540 同输出 推导值" }).style.background).toBe(tokenTableBackground);
    expect(screen.getByRole("row", { name: /总 Token/ }).style.background).toBe(tokenTableBackground);

    fireEvent.click(screen.getByRole("tab", { name: "计费段 #1" }));

    const historicalMetadata = screen.getByRole("region", { name: "计费段信息" });
    expect(historicalMetadata).toHaveTextContent("模型");
    expect(historicalMetadata).toHaveTextContent("deepseek-chat");
    expect(historicalMetadata.innerHTML).toContain("--dsw-alias-state-warn-primary");
    expect(screen.getByText("会话总费用").parentElement?.textContent).toContain(sessionTotal);
    expect(screen.getByText("历史快照暂不可用")).toBeTruthy();

    store.destroy();
  });

  test("supports roving keyboard navigation across session stage tabs", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    store.selectSession("sess-1");
    Object.assign(store.getState().viewModel.detail!, { stages: createUiKeyboardStages() });

    render(<SessionDetailPanel store={store} />);

    const stageOneTab = () => screen.getByRole("tab", { name: "计费段 #1" });
    const stageTwoTab = () => screen.getByRole("tab", { name: "计费段 #2 当前" });
    const stageThreeTab = () => screen.getByRole("tab", { name: "计费段 #3" });
    const expectSelectedStage = (tab: HTMLElement, panelName: string): void => {
      const panel = screen.getByRole("tabpanel", { name: panelName });
      expect(tab).toHaveFocus();
      expect(tab).toHaveAttribute("aria-selected", "true");
      expect(tab).toHaveAttribute("aria-controls", panel.id);
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
      expect(panel).toHaveAttribute("aria-label", panelName);
      for (const item of [stageOneTab(), stageTwoTab(), stageThreeTab()]) {
        expect(item).toHaveAttribute("aria-selected", item.id === tab.id ? "true" : "false");
      }
    };

    stageTwoTab().focus();
    expectSelectedStage(stageTwoTab(), "计费段 #2 当前");

    fireEvent.keyDown(stageTwoTab(), { key: "ArrowRight" });
    expectSelectedStage(stageThreeTab(), "计费段 #3");

    fireEvent.click(stageTwoTab());
    stageTwoTab().focus();
    expectSelectedStage(stageTwoTab(), "计费段 #2 当前");

    fireEvent.keyDown(stageTwoTab(), { key: "ArrowLeft" });
    expectSelectedStage(stageOneTab(), "计费段 #1");

    fireEvent.keyDown(stageOneTab(), { key: "ArrowLeft" });
    expectSelectedStage(stageThreeTab(), "计费段 #3");

    fireEvent.keyDown(stageThreeTab(), { key: "ArrowRight" });
    expectSelectedStage(stageOneTab(), "计费段 #1");

    fireEvent.click(stageTwoTab());
    stageTwoTab().focus();
    expectSelectedStage(stageTwoTab(), "计费段 #2 当前");

    fireEvent.keyDown(stageTwoTab(), { key: "Home" });
    expectSelectedStage(stageOneTab(), "计费段 #1");

    fireEvent.click(stageTwoTab());
    stageTwoTab().focus();
    expectSelectedStage(stageTwoTab(), "计费段 #2 当前");

    fireEvent.keyDown(stageTwoTab(), { key: "End" });
    expectSelectedStage(stageThreeTab(), "计费段 #3");

    store.destroy();
  });

  test("opens and closes the stage help tooltip from focus, click, and Escape", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    store.selectSession("sess-1");
    Object.assign(store.getState().viewModel.detail!, { stages: createUiStages() });

    render(<SessionDetailPanel store={store} />);

    const helpButton = screen.getByRole("button", { name: "了解计费分段" });
    expect(helpButton).toHaveAttribute("aria-expanded", "false");
    expect(helpButton).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("tooltip")).toBeNull();

    act(() => {
      helpButton.focus();
    });
    let tooltip = screen.getByRole("tooltip");
    expect(helpButton).toHaveFocus();
    expect(helpButton).toHaveAttribute("aria-expanded", "true");
    expect(helpButton).toHaveAttribute("aria-controls", tooltip.id);
    expect(helpButton).toHaveAttribute("aria-describedby", tooltip.id);
    expect(tooltip).toHaveTextContent("费用会按连续且相同的计费配置分段汇总");

    fireEvent.keyDown(helpButton, { key: "Escape" });
    expect(helpButton).toHaveAttribute("aria-expanded", "false");
    expect(helpButton).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.click(helpButton);
    tooltip = screen.getByRole("tooltip");
    expect(helpButton).toHaveAttribute("aria-expanded", "true");
    expect(helpButton).toHaveAttribute("aria-controls", tooltip.id);
    expect(helpButton).toHaveAttribute("aria-describedby", tooltip.id);

    fireEvent.keyDown(helpButton, { key: "Escape" });
    expect(helpButton).toHaveAttribute("aria-expanded", "false");
    expect(helpButton).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("tooltip")).toBeNull();

    store.destroy();
  });

  test("uses dsh warning tokens for a low account balance", () => {
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    snapshot.balance.totalMicroCny = 4_000_000;
    snapshot.balances[0]!.totalMicroCny = 4_000_000;
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage: new MemoryStorage() });

    render(<MyMeterConversationView store={store} sessionId="sess-1" />);

    const balance = screen.getByRole("article", { name: "DeepSeek账户余额" });
    expect(balance.getAttribute("style")).toContain("--dsw-alias-state-warn-primary");

    store.destroy();
  });

  test("shows the official xAI rates without DeepSeek peak/offpeak metadata for a Grok stage", () => {
    const remote = createMockRemote("unknown");
    const snapshot = remote.getSnapshot();
    const detail = snapshot.details["sess-1"]!;
    Object.assign(detail, {
      provider: "cpa",
      model: "grok-4.6",
      reasoningEffort: "unknown",
      agentPreset: "minimal",
      pricingZone: "unknown",
    });
    detail.stages = [{
      ...detail.stages.at(-1)!,
      id: "stage-grok",
      index: 1,
      isCurrent: true,
      model: "grok-4.6",
      reasoningEffort: "unknown",
      agentPreset: "minimal",
      pricingZone: "unknown",
      priceVersion: "xai-official-pricing-2026-08-18-usd",
      exchangeRateLabel: "1 USD = ¥7.20",
      currency: "USD",
      currentRequestMinor: 4_322,
      totalMinor: 4_322,
      settledTotalMinor: 4_322,
      estimatedTotalMinor: 0,
      tokenBuckets: detail.tokenBuckets.map((bucket) => ({
        ...bucket,
        currency: "USD",
        amountMinor: Math.round(bucket.amountMicroCny / 7.2),
        unitPriceMinorPerMillionTokens: bucket.label === "缓存命中"
          ? 500_000
          : bucket.label === "缓存未命中"
            ? 2_000_000
            : 6_000_000,
        unitPriceMicroCnyPerMillionTokens: bucket.label === "缓存命中"
          ? 3_600_000
          : bucket.label === "缓存未命中"
            ? 14_400_000
            : 43_200_000,
      })),
    }];
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage: new MemoryStorage() });
    store.selectSession("sess-1");

    render(<SessionDetailPanel store={store} />);

    const stageMetadata = screen.getByRole("region", { name: "计费段信息" });
    expect(stageMetadata).toHaveTextContent("grok-4.6");
    expect(stageMetadata).toHaveTextContent("xai-official-pricing-2026-08-18-usd");
    expect(stageMetadata).toHaveTextContent("当前费率");
    expect(stageMetadata).toHaveTextContent("输入$2.000");
    expect(stageMetadata).toHaveTextContent("缓存$0.500");
    expect(stageMetadata).toHaveTextContent("输出$6.000");
    expect(stageMetadata).toHaveTextContent("美元 / 百万 Token");
    expect(screen.getByRole("columnheader", { name: "单价（美元/百万 Token）" })).toBeTruthy();
    expect(stageMetadata).not.toHaveTextContent("deepseek-official-pricing");
    expect(stageMetadata).not.toHaveTextContent("高峰时段");
    expect(stageMetadata).not.toHaveTextContent("空闲时段");

    store.destroy();
  });

  test("formats turn numbers with a hash in session detail", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    store.selectSession("sess-1");

    render(<SessionDetailPanel store={store} />);

    expect(screen.getByText("#2", { exact: true })).toBeTruthy();
    expect(screen.queryByText("轮次 2", { exact: true })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /计费段 #1/ }));

    expect(screen.getByText("#1", { exact: true })).toBeTruthy();
    expect(screen.queryByText("轮次 1", { exact: true })).toBeNull();

    store.destroy();
  });

  test("labels a mixed session-level unit price without presenting an inferred rate", () => {
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    const detail = snapshot.details["sess-1"]!;
    detail.stages = [];
    const cacheMiss = detail.tokenBuckets.find((bucket) => bucket.label === "缓存未命中")!;
    Object.assign(cacheMiss, {
      unitPriceMicroCnyPerMillionTokens: null,
      unitPriceMixed: true,
    });
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage: new MemoryStorage() });
    store.selectSession("sess-1");

    render(<SessionDetailPanel store={store} />);

    expect(screen.getByRole("row", { name: /输入 Token\(无缓存\).*混合/ })).toBeTruthy();
    store.destroy();
  });

  test("does not present unknown session token costs as free", async () => {
    const remote = createMockRemote("unknown");
    const snapshot = remote.getSnapshot();
    const detail = snapshot.details["sess-1"]!;
    detail.status = "unknown";
    detail.unknownCount = 1;
    detail.sessionTotalMicroCny = 0;
    for (const bucket of detail.tokenBuckets) bucket.amountMicroCny = 0;
    const currentStage = detail.stages.find((stage) => stage.isCurrent) ?? detail.stages.at(-1)!;
    currentStage.status = "unknown";
    currentStage.unknownCount = 1;
    currentStage.totalMicroCny = 0;
    currentStage.settledTotalMicroCny = 0;
    currentStage.estimatedTotalMicroCny = 0;
    for (const bucket of currentStage.tokenBuckets) bucket.amountMicroCny = 0;
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage: new MemoryStorage() });
    store.selectSession("sess-1");

    render(<SessionDetailPanel store={store} />);
    await act(async () => {
      await Promise.resolve();
    });

    const table = screen.getByRole("table");
    expect(table.textContent).toContain("¥0.000（估算）");
    expect(table.textContent).not.toContain("费用未知");
    expect(table.textContent).not.toContain("待核算");
    expect(screen.queryByText("¥0.000 + 未知")).toBeNull();
    store.destroy();
  });

  test("shows compact billing insights in the session detail panel", () => {
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
    const store = createMyMeterStore({ remote, storage: new MemoryStorage() });
    store.selectSession("sess-1");
    store.setBudgetThresholdMicroCny(100_000);

    render(<SessionDetailPanel store={store} />);

    const insights = screen.getByRole("region", { name: "会话费用洞察" });
    expect(insights.getAttribute("style")).toContain("var(--dsw-alias-bg-layer-2");
    expect(insights).toHaveTextContent("缓存节省¥0.053");
    expect(insights).toHaveTextContent("18,420 Token");
    expect(insights).toHaveTextContent("预算已超过");
    expect(insights).toHaveTextContent("126%");
    expect(insights).toHaveTextContent("峰谷高峰时段");
    expect(insights).toHaveTextContent("30分钟后进入空闲时段");
    expect(insights).toHaveTextContent("12:00");

    store.destroy();
  });

  test("shows budget and pricing-zone insights in the global overview", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T11:30:00+08:00"));
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    store.setBudgetThresholdMicroCny(1_000_000);

    render(<GlobalSessionList store={store} />);

    const insights = screen.getByRole("region", { name: "全局费用洞察" });
    expect(insights.getAttribute("style")).toContain("var(--dsw-alias-bg-layer-2");
    expect(insights).toHaveTextContent("预算已超过");
    expect(insights).toHaveTextContent("248%");
    expect(insights).toHaveTextContent("峰谷高峰时段");
    expect(insights).toHaveTextContent("30分钟后进入空闲时段");
    expect(insights).toHaveTextContent("12:00");

    store.destroy();
  });

  test("opens on-demand cost tree and analytics views from the global tool tabs", async () => {
    const remote = createMockRemote("billing");
    const rootSummary = toolLedgerSummary("root", 150_000);
    Object.assign(remote, {
      getSessionCostTree: async () => ({
        roots: [{
          id: "root",
          title: "主会话",
          childSessionIds: [],
          depth: 0,
          path: ["root"],
          summary: rootSummary,
          subtreeSummary: rootSummary,
          orphaned: false,
          cyclic: false,
        }],
        nodes: {},
        summary: rootSummary,
        anomalies: { missingParents: [], cycles: [] },
      }),
      getCostAnalytics: async () => ({
        generatedAt: "2026-08-19T00:00:00.000Z",
        global: {
          totalMicroCny: 150_000,
          requestCount: 1,
          statusCounts: { estimated: 0, settled: 1, unknown: 0, failed: 0 },
          peakMicroCny: 150_000,
          offpeakMicroCny: 0,
        },
        sessions: [],
        dailyTrend: [{
          key: "2026-08-19",
          startAt: "2026-08-19T00:00:00.000Z",
          endAt: "2026-08-19T23:59:59.999Z",
          amountMicroCny: 150_000,
          requestCount: 1,
          statusCounts: { estimated: 0, settled: 1, unknown: 0, failed: 0 },
          peakMicroCny: 150_000,
          offpeakMicroCny: 0,
          previousAmountMicroCny: null,
          deltaMicroCny: null,
          deltaRatio: null,
        }],
        hourlyTrend: [],
        anomalies: [{
          ruleId: "daily_spend_spike",
          severity: "warning" as const,
          bucketKey: "2026-08-19",
          threshold: 3,
          explanation: "单日费用突增",
        }],
      }),
      exportLedger: async () => "{}",
    });
    const store = createMyMeterStore({ remote, storage: new MemoryStorage() });

    render(<GlobalSessionList store={store} />);
    expect(screen.getByRole("button", { name: "下载JSON账本" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下载CSV账本" })).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "费用树" }));
    });
    expect(await screen.findByRole("region", { name: "费用树" })).toHaveTextContent("主会话");
    expect(screen.getByRole("region", { name: "费用树" })).toHaveTextContent("子树 ¥0.150");

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "趋势/异常" }));
    });
    const analytics = await screen.findByRole("region", { name: "趋势和异常" });
    expect(analytics).toHaveTextContent("2026-08-19");
    expect(analytics).toHaveTextContent("单日费用突增");

    store.destroy();
  });

  test("clamps floating overlay inside narrow viewport edges", () => {
    const cases = [
      {
        viewport: { width: 320, height: 480 },
        panelSize: { width: 280, height: 220 },
        input: { x: -80, y: -40 },
        expected: { x: 0, y: 0, edge: "left" },
      },
      {
        viewport: { width: 320, height: 480 },
        panelSize: { width: 280, height: 220 },
        input: { x: 900, y: 900 },
        expected: { x: 40, y: 260, edge: "right" },
      },
      {
        viewport: { width: 600, height: 480 },
        panelSize: { width: 280, height: 220 },
        input: { x: 128, y: 12 },
        expected: { x: 128, y: 0, edge: "top" },
      },
      {
        viewport: { width: 600, height: 480 },
        panelSize: { width: 280, height: 220 },
        input: { x: 128, y: 470 },
        expected: { x: 128, y: 260, edge: "bottom" },
      },
    ] as const;

    for (const item of cases) {
      const snapped = snapOverlayPosition(
        item.input,
        item.viewport,
        item.panelSize,
        24,
      );

      expect(snapped.position).toEqual({ x: item.expected.x, y: item.expected.y });
      expect(snapped.dockedEdge).toBe(item.expected.edge);
    }

    expect(snapOverlayPosition({ x: 999, y: 12 }, { width: 600, height: 480 }, { width: 420, height: 220 })).toEqual({
      position: { x: 180, y: 12 },
      dockedEdge: "right",
    });
  });

  test("clamps the collapsed overlay using its visual dimensions", () => {
    setViewport(320, 480);
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });

    store.setOverlayCollapsed(true);
    act(() => store.setOverlayPosition({ x: 999, y: 999 }));

    expect(store.getState().settings.overlayPosition).toEqual({ x: 165, y: 200 });
    expect(store.getState().viewModel.overlay.position).toEqual({ x: 165, y: 200 });

    store.destroy();
  });

  test("anchors to the left model-response area with 50px gaps", () => {
    setViewport(1440, 900);
    let viewAreaRight = 1200;
    const center = document.createElement("div");
    const conversationSlot = document.createElement("div");
    conversationSlot.dataset.slot = "conversation";
    const viewArea = document.createElement("section");
    const viewSlot = document.createElement("div");
    viewSlot.dataset.slot = "conversation.view";
    viewArea.append(viewSlot);
    conversationSlot.append(viewArea);
    center.append(conversationSlot);
    document.body.append(center);

    vi.spyOn(center, "getBoundingClientRect").mockImplementation(() => rect({
      left: 280,
      right: 1440,
      top: 0,
      bottom: 900,
    }));
    vi.spyOn(viewArea, "getBoundingClientRect").mockImplementation(() => rect({
      left: 280,
      right: viewAreaRight,
      top: 76,
      bottom: 900,
    }));

    let notifyResize: (() => void) | undefined;
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver);
      }

      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);

    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    render(<ShellOverlay store={store} />);

    expect(screen.getByTestId("mymeter-shell")).toHaveStyle({
      left: "995px",
      top: "126px",
    });

    act(() => {
      viewAreaRight = 840;
      notifyResize?.();
    });

    expect(screen.getByTestId("mymeter-shell")).toHaveStyle({
      left: "635px",
      top: "126px",
    });

    store.destroy();
    vi.unstubAllGlobals();
  });

  test("uses the conversation display region when the active view slot is not mounted", () => {
    setViewport(1440, 900);
    const conversation = document.createElement("div");
    const scrollBody = document.createElement("div");
    scrollBody.dataset.conversationScroll = "";
    conversation.append(scrollBody);
    document.body.append(conversation);

    let scrollRight = 1200;
    vi.spyOn(scrollBody, "getBoundingClientRect").mockImplementation(() => rect({
      left: 280,
      right: scrollRight,
      top: 76,
      bottom: 900,
    }));

    let notifyResize: (() => void) | undefined;
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver);
      }

      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);

    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    render(<ShellOverlay store={store} />);

    expect(screen.getByTestId("mymeter-shell")).toHaveStyle({
      left: "995px",
      top: "126px",
    });

    act(() => {
      scrollRight = 840;
      notifyResize?.();
    });

    expect(screen.getByTestId("mymeter-shell")).toHaveStyle({
      left: "635px",
      top: "126px",
    });

    store.destroy();
    vi.unstubAllGlobals();
  });

  test("keeps a dragged overlay position when the conversation anchor changes", () => {
    setViewport(1440, 900);
    const scrollBody = document.createElement("div");
    scrollBody.className = "wSkVaW_scrollBody";
    document.body.append(scrollBody);

    let scrollRight = 1200;
    let scrollTop = 76;
    vi.spyOn(scrollBody, "getBoundingClientRect").mockImplementation(() => rect({
      left: 280,
      right: scrollRight,
      top: scrollTop,
      bottom: 900,
    }));

    let notifyResize: (() => void) | undefined;
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver);
      }

      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);

    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    render(<ShellOverlay store={store} />);

    expect(screen.getByTestId("mymeter-shell")).toHaveStyle({
      left: "995px",
      top: "126px",
    });

    const receipt = screen.getByRole("button", { name: "Token计费小票" });
    act(() => {
      fireEvent.pointerDown(receipt);
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 200, clientY: 140 }));
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 200, clientY: 140 }));
    });

    const draggedPosition = store.getState().settings.overlayPosition;
    expect(draggedPosition).toEqual({ x: 1195, y: 266 });

    act(() => {
      scrollRight = 840;
      scrollTop = 120;
      notifyResize?.();
    });

    expect(store.getState().settings.overlayPosition).toEqual(draggedPosition);
    expect(screen.getByTestId("mymeter-shell")).toHaveStyle({
      left: "1195px",
      top: "266px",
    });

    act(() => {
      store.setOverlayVisible(false);
      scrollRight = 700;
      scrollTop = 180;
      store.setOverlayVisible(true);
    });

    expect(screen.getByTestId("mymeter-shell")).toHaveStyle({
      left: "1195px",
      top: "266px",
    });

    store.destroy();
    vi.unstubAllGlobals();
  });

  test("keeps the receipt compact on narrow screens even when expansion is requested", async () => {
    setViewport(NARROW_VIEWPORT.width, NARROW_VIEWPORT.height);
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    store.setOverlayCollapsed(false);

    render(<ShellOverlay store={store} />);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => store.setOverlayPosition({ x: 999, y: 999 }));

    const shell = screen.getByTestId("mymeter-shell");
    expect(shell).toHaveStyle({
      position: "fixed",
      left: "165px",
      top: "200px",
      maxWidth: "calc(100vw - 16px)",
      overflow: "visible",
    });
    expect(screen.getByTestId("mymeter-shell-body")).toHaveStyle({ overflow: "visible" });
    expect(shell).toHaveAttribute("data-collapsed", "true");
    expect(shell).toHaveAttribute("data-docked-edge", "right");
    expect(screen.getByTestId("mymeter-receipt")).toBeTruthy();
    expect(screen.queryByLabelText("会话ID")).toBeNull();
    store.destroy();
  });

  test("opens the Token计费 page from the receipt without ever expanding the overlay", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    const onOpenTokenBilling = vi.fn();

    render(<ShellOverlay store={store} onOpenTokenBilling={onOpenTokenBilling} />);
    const receipt = screen.getByRole("button", { name: "打开 Token计费页面" });

    fireEvent.pointerDown(receipt, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(window, { clientX: 100, clientY: 100 });

    expect(onOpenTokenBilling).toHaveBeenCalledTimes(1);
    expect(store.getState().settings.overlayCollapsed).toBe(true);
    expect(screen.getByTestId("mymeter-shell")).toHaveAttribute("data-collapsed", "true");
    expect(screen.queryByLabelText("会话ID")).toBeNull();

    fireEvent.click(receipt, { detail: 0 });
    expect(onOpenTokenBilling).toHaveBeenCalledTimes(2);

    act(() => store.setOverlayCollapsed(false));
    const shell = screen.getByTestId("mymeter-shell");
    fireEvent.pointerDown(shell, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(window, { clientX: 100, clientY: 100 });
    expect(onOpenTokenBilling).toHaveBeenCalledTimes(3);
    expect(store.getState().settings.overlayCollapsed).toBe(true);

    store.destroy();
  });

  test("closes and persistently hides the floating overlay from its close button", () => {
    const storage = new MemoryStorage();
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage,
      storageKey: "close-overlay.settings",
    });
    const onOpenTokenBilling = vi.fn();

    render(<ShellOverlay store={store} onOpenTokenBilling={onOpenTokenBilling} />);
    fireEvent.click(screen.getByRole("button", { name: "关闭计费浮窗" }));

    expect(screen.queryByTestId("mymeter-shell")).toBeNull();
    expect(store.getState().settings.overlayEnabled).toBe(false);
    expect(JSON.parse(storage.getItem("close-overlay.settings") ?? "{}").overlayEnabled).toBe(false);
    expect(onOpenTokenBilling).not.toHaveBeenCalled();

    store.destroy();
  });

  test.each([
    {
      label: "keyboard activation",
      activate: (button: HTMLButtonElement) => {
        button.focus();
        fireEvent.click(button, { detail: 0 });
      },
    },
    {
      label: "programmatic activation",
      activate: (button: HTMLButtonElement) => {
        act(() => {
          button.click();
        });
      },
    },
  ])("closes and persistently hides the floating overlay from $label", ({ activate }) => {
    const storage = new MemoryStorage();
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage,
      storageKey: "close-overlay-activation.settings",
    });
    const onOpenTokenBilling = vi.fn();

    render(<ShellOverlay store={store} onOpenTokenBilling={onOpenTokenBilling} />);

    const closeButton = screen.getByRole("button", { name: "关闭计费浮窗" }) as HTMLButtonElement;
    activate(closeButton);

    expect(screen.queryByTestId("mymeter-shell")).toBeNull();
    expect(store.getState().settings.overlayEnabled).toBe(false);
    expect(JSON.parse(storage.getItem("close-overlay-activation.settings") ?? "{}").overlayEnabled).toBe(false);
    expect(onOpenTokenBilling).not.toHaveBeenCalled();

    store.destroy();
  });

  test("always renders the compact receipt even when legacy settings requested the large overlay", () => {
    const storage = new MemoryStorage();
    storage.setItem("receipt-only.settings", JSON.stringify({ overlayCollapsed: false }));
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage,
      storageKey: "receipt-only.settings",
    });

    render(<ShellOverlay store={store} />);

    const shell = screen.getByTestId("mymeter-shell");
    expect(shell).toHaveStyle({
      width: "fit-content",
      background: "transparent",
      overflow: "visible",
    });
    expect(shell).toHaveAttribute("data-collapsed", "true");
    expect(store.getState().settings.overlayCollapsed).toBe(true);
    expect(screen.getByTestId("mymeter-receipt")).toBeTruthy();
    expect(screen.queryByLabelText("会话ID")).toBeNull();

    act(() => store.setSettings({ overlayCollapsed: false }));
    expect(store.getState().settings.overlayCollapsed).toBe(true);
    expect(shell).toHaveAttribute("data-collapsed", "true");
    expect(screen.queryByLabelText("会话ID")).toBeNull();
    expect(
      snapOverlayPosition({ x: 999, y: 12 }, { width: 600, height: 480 }),
    ).toEqual({
      position: { x: 445, y: 12 },
      dockedEdge: "right",
    });

    store.destroy();
  });

  test("starts drag listeners on receipt pointerdown", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    const addEventListener = vi.spyOn(window, "addEventListener");

    render(<ShellOverlay store={store} />);
    const receipt = screen.getByRole("button", { name: "Token计费小票" });

    fireEvent.pointerDown(receipt);
    expect(addEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith("pointerup", expect.any(Function));

    addEventListener.mockRestore();
    store.destroy();
  });

  test("allows dragging the floating window in collapsed mode", async () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    store.setOverlayCollapsed(true);

    render(<ShellOverlay store={store} />);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => store.setOverlayPosition({ x: 100, y: 100 }));
    const shell = screen.getByTestId("mymeter-shell");

    act(() => {
      fireEvent.pointerDown(shell, { clientX: 50, clientY: 50 });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 150, clientY: 120 }));
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 150, clientY: 120 }));
    });

    expect(store.getState().settings.overlayPosition).toEqual({ x: 165, y: 200 });
    expect(store.getState().settings.overlayCollapsed).toBe(true);

    store.destroy();
  });

  test("renders dynamic token breakdown in collapsed mode", () => {
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    snapshot.details["sess-1"]!.tokenBuckets.sort((left, right) =>
      left.label === "缓存未命中" ? -1 : right.label === "缓存未命中" ? 1 : 0,
    );
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({
      remote,
      storage: new MemoryStorage(),
    });
    store.setOverlayCollapsed(true);

    render(<ShellOverlay store={store} />);

    const shell = screen.getByTestId("mymeter-shell");
    expect(shell).toHaveAttribute("data-collapsed", "true");
    expect(screen.getByText("Token计费")).toBeTruthy();
    expect(screen.getByText("缓:")).toBeTruthy();
    expect(screen.getByText("18,420")).toBeTruthy();
    expect(screen.getByText("¥0.003")).toBeTruthy();
    expect(screen.getByText("入:")).toBeTruthy();
    expect(screen.getByText("31,680")).toBeTruthy();
    expect(screen.getByText("¥0.028")).toBeTruthy();
    expect(screen.getByText("出:")).toBeTruthy();
    expect(screen.getByText("12,530")).toBeTruthy();

    store.destroy();
  });

  test("keeps the receipt visible after the active request settles", () => {
    const remote = createMockRemote("billing");
    const store = createMyMeterStore({
      remote,
      storage: new MemoryStorage(),
    });
    store.setOverlayCollapsed(true);

    render(<ShellOverlay store={store} />);

    expect(screen.getByText("▲ 正在生成")).toBeTruthy();

    act(() => {
      remote.setScenario("settled");
    });

    expect(screen.getByTestId("mymeter-receipt")).toBeTruthy();
    expect(screen.getByText("■ 已结算")).toBeTruthy();
    expect(screen.queryByText("▲ 正在生成")).toBeNull();

    store.destroy();
  });

  test("uses clear and consistent in-progress copy in the floating receipt", () => {
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage: new MemoryStorage(),
    });
    store.setOverlayCollapsed(true);

    render(<ShellOverlay store={store} />);

    expect(screen.getByText("⚡ 生成中")).toBeTruthy();
    expect(screen.getAllByText(/生成中/)).toHaveLength(2);
    expect(screen.queryByText(/LIVE FEED/)).toBeNull();
    expect(screen.queryByText(/吐票|吐单/)).toBeNull();

    store.destroy();
  });

  test.each([
    { turnCount: 11, hiddenTurnCount: 10 },
    { turnCount: 20, hiddenTurnCount: 10 },
    { turnCount: 21, hiddenTurnCount: 20 },
  ])(
    "hides the previous $hiddenTurnCount turns after $turnCount turns and lets users reveal them",
    ({ turnCount, hiddenTurnCount }) => {
      const remote = createMockRemote("billing");
      const snapshot = remote.getSnapshot();
      const detail = snapshot.details["sess-1"]!;
      const template = detail.turns[0]!;
      detail.turns = Array.from({ length: turnCount }, (_, index) => {
        const isActive = index === turnCount - 1;
        return {
          ...template,
          id: `sess-1-turn-${index + 1}`,
          label: `轮次 ${index + 1}`,
          status: isActive ? "billing" : "settled",
          completedAt: isActive ? null : "2026-08-17T09:01:42.000+08:00",
          amountMicroCny: (index + 1) * 1_000,
        };
      });
      remote.setSnapshot(snapshot);
      const store = createMyMeterStore({ remote, storage: new MemoryStorage() });
      const onOpenTokenBilling = vi.fn();
      store.setOverlayCollapsed(true);

      render(<ShellOverlay store={store} onOpenTokenBilling={onOpenTokenBilling} />);

      expect(screen.queryByText("#1 轮", { exact: true })).toBeNull();
      expect(screen.queryByText(`#${hiddenTurnCount} 轮`, { exact: true })).toBeNull();
      expect(screen.getByText(new RegExp(`^#${hiddenTurnCount + 1} 轮`))).toBeTruthy();
      expect(screen.getByText(`#${turnCount} 轮 (生成中)`, { exact: true })).toBeTruthy();

      const expandButton = screen.getByRole("button", { name: `展开前 ${hiddenTurnCount} 轮费用` });
      expect(expandButton).toHaveAttribute("aria-expanded", "false");
      fireEvent.pointerDown(expandButton, { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(window, { clientX: 100, clientY: 100 });
      fireEvent.click(expandButton);

      expect(screen.getByText("#1 轮", { exact: true })).toBeTruthy();
      expect(screen.getByText(`#${hiddenTurnCount} 轮`, { exact: true })).toBeTruthy();
      const collapseButton = screen.getByRole("button", { name: `隐藏前 ${hiddenTurnCount} 轮费用` });
      expect(collapseButton).toHaveAttribute("aria-expanded", "true");
      fireEvent.pointerDown(collapseButton, { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(window, { clientX: 100, clientY: 100 });
      fireEvent.click(collapseButton);

      expect(screen.queryByText("#1 轮", { exact: true })).toBeNull();
      expect(onOpenTokenBilling).not.toHaveBeenCalled();
      store.destroy();
    },
  );

  test("keeps all turn costs visible until the receipt exceeds ten turns", () => {
    const remote = createMockRemote("billing");
    const snapshot = remote.getSnapshot();
    const detail = snapshot.details["sess-1"]!;
    const template = detail.turns[0]!;
    detail.turns = Array.from({ length: 10 }, (_, index) => ({
      ...template,
      id: `sess-1-turn-${index + 1}`,
      label: `轮次 ${index + 1}`,
      amountMicroCny: (index + 1) * 1_000,
    }));
    remote.setSnapshot(snapshot);
    const store = createMyMeterStore({ remote, storage: new MemoryStorage() });
    store.setOverlayCollapsed(true);

    render(<ShellOverlay store={store} />);

    expect(screen.getByText("#1 轮", { exact: true })).toBeTruthy();
    expect(screen.getByText("#10 轮", { exact: true })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /前 10 轮费用/ })).toBeNull();
    store.destroy();
  });
});

describe("dsh plugin settings card", () => {
  test("shares browser preferences with the floating meter and persists theme-safe settings", () => {
    const storage = new MemoryStorage();
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage,
      storageKey: "plugin-card.settings",
    });

    render(<MyMeterSettingsCard store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "展开 Token计费 配置" }));
    fireEvent.change(screen.getByDisplayValue("30"), { target: { value: "45" } });

    expect(store.getState().settings.refreshIntervalMs).toBe(45_000);
    expect(JSON.parse(storage.getItem("plugin-card.settings") ?? "{}").refreshIntervalMs).toBe(45_000);
    expect(screen.getByText("跟随 DSH 全局主题，配置动效、刷新与预算偏好")).toBeTruthy();
    expect(screen.getByRole("button", { name: "收起 Token计费 配置" })).toHaveAttribute("aria-expanded", "true");

    store.destroy();
  });

  test("keeps settings form controls labeled, reachable, persisted, and resettable", () => {
    const storage = new MemoryStorage();
    const store = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage,
      storageKey: "settings-form.settings",
    });

    render(<MyMeterSettingsCard store={store} />);

    const expandButton = screen.getByRole("button", { name: "展开 Token计费 配置" });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    expandButton.focus();
    expect(expandButton).toHaveFocus();
    fireEvent.click(expandButton, { detail: 0 });

    const collapseButton = screen.getByRole("button", { name: "收起 Token计费 配置" });
    expect(collapseButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "设置" })).toBeTruthy();

    const reducedMotion = screen.getByRole("checkbox", { name: "减少动画" }) as HTMLInputElement;
    reducedMotion.focus();
    expect(reducedMotion).toHaveFocus();
    fireEvent.click(reducedMotion);
    expect(reducedMotion).toBeChecked();
    expect(store.getState().settings.reducedMotion).toBe(true);
    expect(JSON.parse(storage.getItem("settings-form.settings") ?? "{}").reducedMotion).toBe(true);

    const muted = screen.getByRole("checkbox", { name: "默认静音" }) as HTMLInputElement;
    muted.focus();
    expect(muted).toHaveFocus();
    expect(muted).toBeChecked();
    fireEvent.click(muted);
    expect(muted).not.toBeChecked();
    expect(store.getState().settings.muted).toBe(false);
    expect(JSON.parse(storage.getItem("settings-form.settings") ?? "{}").muted).toBe(false);

    const refreshInterval = screen.getByRole("spinbutton", { name: /余额刷新/ }) as HTMLInputElement;
    refreshInterval.focus();
    expect(refreshInterval).toHaveFocus();
    fireEvent.change(refreshInterval, { target: { value: "45" } });
    expect(refreshInterval).toHaveValue(45);
    expect(store.getState().settings.refreshIntervalMs).toBe(45_000);
    expect(JSON.parse(storage.getItem("settings-form.settings") ?? "{}").refreshIntervalMs).toBe(45_000);

    const budgetThreshold = screen.getByRole("spinbutton", { name: /预算阈值/ }) as HTMLInputElement;
    budgetThreshold.focus();
    expect(budgetThreshold).toHaveFocus();
    fireEvent.change(budgetThreshold, { target: { value: "12.345" } });
    expect(budgetThreshold).toHaveValue(12.345);
    expect(store.getState().settings.budgetThresholdMicroCny).toBe(12_345_000);
    expect(JSON.parse(storage.getItem("settings-form.settings") ?? "{}").budgetThresholdMicroCny).toBe(12_345_000);

    const resetButton = screen.getByRole("button", { name: "恢复默认" });
    resetButton.focus();
    expect(resetButton).toHaveFocus();
    fireEvent.click(resetButton, { detail: 0 });

    expect(screen.getByRole("button", { name: "收起 Token计费 配置" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("checkbox", { name: "减少动画" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "默认静音" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: /余额刷新/ })).toHaveValue(30);
    expect(screen.getByRole("spinbutton", { name: /预算阈值/ })).toHaveValue(50);
    expect(store.getState().settings.reducedMotion).toBe(false);
    expect(store.getState().settings.muted).toBe(true);
    expect(store.getState().settings.refreshIntervalMs).toBe(30_000);
    expect(store.getState().settings.budgetThresholdMicroCny).toBe(50_000_000);
    expect(storage.getItem("settings-form.settings")).toBeNull();

    store.destroy();
  });

  test("keeps the floating meter on dsh theme tokens when legacy settings are present", () => {
    const storage = new MemoryStorage();
    storage.setItem("shared-plugin.settings", JSON.stringify({ skinId: "fuel" }));
    const overlayStore = createMyMeterStore({
      remote: createMockRemote("billing"),
      storage,
      storageKey: "shared-plugin.settings",
    });
    overlayStore.setOverlayCollapsed(false);
    const { container } = render(<ShellOverlay store={overlayStore} />);
    const shell = container.querySelector<HTMLElement>("[data-docked-edge]");
    const receipt = screen.getByRole("button", { name: "Token计费小票" });

    expect(overlayStore.getState().settings).not.toHaveProperty("skinId");
    expect(overlayStore.getState().settings.overlayCollapsed).toBe(true);
    expect(shell?.getAttribute("style")).toContain("var(--dsw-alias-label-primary");
    expect(receipt.getAttribute("style")).toContain("var(--dsw-alias-bg-layer-1");

    overlayStore.destroy();
  });
});

function createUiStages() {
  return [
    {
      id: "stage-chat",
      index: 1,
      isCurrent: false,
      startedAt: "2026-08-17T10:02:00.000+08:00",
      completedAt: "2026-08-17T10:18:00.000+08:00",
      lastActivityAt: "2026-08-17T10:18:00.000+08:00",
      status: "settled",
      model: "deepseek-chat",
      reasoningEffort: "标准",
      agentPreset: "Coding",
      pricingZone: "peak",
      pricingZoneLabel: "高峰时段",
      priceVersion: "2026-08-17",
      currentRequest: { microCny: 0, label: "¥0.000", detailLabel: "¥0.000000" },
      sessionTotal: { microCny: 216_000, label: "¥0.216", detailLabel: "¥0.216000" },
      settledTotal: { microCny: 216_000, label: "¥0.216", detailLabel: "¥0.216000" },
      estimatedTotal: { microCny: 0, label: "¥0.000", detailLabel: "¥0.000000" },
      unknownCount: 0,
      tokenBuckets: [
        { label: "缓存未命中", tokens: 8_200, amount: { microCny: 110_000, label: "¥0.110", detailLabel: "¥0.110000" }, unitPrice: { microCny: 3_000_000, label: "¥3.000", detailLabel: "¥3.000000" } },
        { label: "缓存命中", tokens: 6_400, amount: { microCny: 9_000, label: "¥0.009", detailLabel: "¥0.009000" }, unitPrice: { microCny: 100_000, label: "¥0.100", detailLabel: "¥0.100000" } },
        { label: "输出", tokens: 3_820, amount: { microCny: 97_000, label: "¥0.097", detailLabel: "¥0.097000" }, unitPrice: { microCny: 9_000_000, label: "¥9.000", detailLabel: "¥9.000000" } },
        { label: "其中推理", tokens: 0, amount: { microCny: 0, label: "¥0.000", detailLabel: "¥0.000000" }, unitPrice: { microCny: 9_000_000, label: "¥9.000", detailLabel: "¥9.000000" } },
      ],
      turns: [],
      contextBreakdown: null,
    },
    {
      id: "stage-reasoner",
      index: 2,
      isCurrent: true,
      startedAt: "2026-08-17T10:18:00.000+08:00",
      completedAt: null,
      lastActivityAt: "2026-08-17T10:26:00.000+08:00",
      status: "billing",
      model: "deepseek-reasoner",
      reasoningEffort: "高",
      agentPreset: "Coding",
      pricingZone: "offpeak",
      pricingZoneLabel: "空闲时段",
      priceVersion: "2026-08-17",
      currentRequest: { microCny: 642_000, label: "¥0.642", detailLabel: "¥0.642000" },
      sessionTotal: { microCny: 1_068_000, label: "¥1.068", detailLabel: "¥1.068000" },
      settledTotal: { microCny: 426_000, label: "¥0.426", detailLabel: "¥0.426000" },
      estimatedTotal: { microCny: 642_000, label: "¥0.642", detailLabel: "¥0.642000" },
      unknownCount: 0,
      tokenBuckets: [
        { label: "缓存未命中", tokens: 10_600, amount: { microCny: 382_000, label: "¥0.382", detailLabel: "¥0.382000" }, unitPrice: { microCny: 4_500_000, label: "¥4.500", detailLabel: "¥4.500000" } },
        { label: "缓存命中", tokens: 12_300, amount: { microCny: 44_000, label: "¥0.044", detailLabel: "¥0.044000" }, unitPrice: { microCny: 150_000, label: "¥0.150", detailLabel: "¥0.150000" } },
        { label: "输出", tokens: 8_780, amount: { microCny: 642_000, label: "¥0.642", detailLabel: "¥0.642000" }, unitPrice: { microCny: 13_500_000, label: "¥13.500", detailLabel: "¥13.500000" } },
        { label: "其中推理", tokens: 6_240, amount: { microCny: 0, label: "¥0.000", detailLabel: "¥0.000000" }, unitPrice: { microCny: 13_500_000, label: "¥13.500", detailLabel: "¥13.500000" } },
      ],
      turns: [],
      contextBreakdown: null,
    },
  ];
}

function createUiKeyboardStages() {
  const [firstStage, currentStage] = createUiStages();
  return [
    firstStage!,
    currentStage!,
    {
      ...firstStage!,
      id: "stage-followup",
      index: 3,
      startedAt: "2026-08-17T10:26:00.000+08:00",
      completedAt: "2026-08-17T10:34:00.000+08:00",
      lastActivityAt: "2026-08-17T10:34:00.000+08:00",
    },
  ];
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(globalThis, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(globalThis, "innerHeight", { configurable: true, value: height });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

function toolLedgerSummary(agentPreset: string, totalMicroCny: number) {
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
    cacheMissTokens: 1,
    outputTokens: 0,
    reasoningTokens: 0,
    peakMicroCny: totalMicroCny,
    offpeakMicroCny: 0,
    firstSeenAt: "2026-08-19T00:00:00.000Z",
    lastSeenAt: "2026-08-19T00:00:01.000Z",
    provider: "deepseek",
    model: "deepseek-chat",
    reasoningEffort: "high",
    agentPreset,
  };
}

function rect(values: Partial<DOMRect>): DOMRect {
  const left = values.left ?? 0;
  const top = values.top ?? 0;
  const right = values.right ?? left;
  const bottom = values.bottom ?? top;
  return {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({}),
  } as DOMRect;
}
