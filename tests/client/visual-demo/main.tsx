import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  MyMeterConversationView,
  ShellOverlay,
  createMockRemote,
  createMyMeterStore,
  useMyMeterStoreState,
  type MyMeterStore,
  type StorageLike,
} from "../../../packages/client/src";

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

declare global {
  interface Window {
    __MYMETER_VISUAL__?: {
      store: MyMeterStore;
      getState: () => ReturnType<MyMeterStore["getState"]>;
    };
  }
}

function VisualDemo() {
  const mode = new URLSearchParams(window.location.search).get("mode");
  const pageOnly = mode === "page";
  const remote = useMemo(() => {
    const next = createMockRemote("billing");
    if (pageOnly) {
      const snapshot = next.getSnapshot();
      snapshot.balance.currency = "USD";
      snapshot.balance.totalMicroCny = 4_500_000;
      snapshot.balances = [
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
      ];
      next.setSnapshot(snapshot);
    }
    return next;
  }, [pageOnly]);
  const store = useMemo(() => {
    const s = createMyMeterStore({
      remote,
      storage: new MemoryStorage(),
    });
    s.setOverlayPosition({ x: 32, y: 32 });
    return s;
  }, [remote]);

  const state = useMyMeterStoreState(store);
  const [isStreaming, setIsStreaming] = useState(true);
  // 模拟真实大模型 Token 流式递增跳动
  useEffect(() => {
    if (!isStreaming || state.viewModel.status.code !== "billing") return;

    const interval = setInterval(() => {
      const snap = remote.getSnapshot();
      const currentId = snap.currentSessionId ?? "sess-1";
      const detail = snap.details[currentId];
      if (detail && detail.status === "billing") {
        const outBucket = detail.tokenBuckets.find((b) => b.label === "输出");
        if (outBucket) {
          outBucket.tokens += Math.floor(Math.random() * 80) + 30;
          outBucket.amountMicroCny += 280;
        }
        detail.currentRequestMicroCny += 280;
        detail.sessionTotalMicroCny += 280;
        remote.setSnapshot(snap);
      }
    }, 350);

    return () => clearInterval(interval);
  }, [isStreaming, remote, state.viewModel.status.code]);

  window.__MYMETER_VISUAL__ = {
    store,
    getState: store.getState,
  };

  if (pageOnly) {
    return (
      <main style={{ width: "min(720px, calc(100% - 24px))", margin: "24px auto" }}>
        <MyMeterConversationView store={store} sessionId="sess-1" />
      </main>
    );
  }

  return (
    <>
      <ShellOverlay store={store} />
      <main>
        {/* 顶部实时控制台 */}
        <section className="demo-status" aria-label="视觉验证状态">
          <strong style={{ color: "#38bdf8", fontSize: 14 }}>Token计费 动态调试台</strong>

          <button
            type="button"
            onClick={() => {
              if (state.viewModel.status.code === "billing") {
                remote.setScenario("settled");
              } else {
                remote.setScenario("billing");
              }
            }}
            style={{
              padding: "5px 12px",
              background: state.viewModel.status.code === "billing" ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.4)",
              borderRadius: 6,
              color: state.viewModel.status.code === "billing" ? "#4ade80" : "#94a3b8",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {state.viewModel.status.code === "billing" ? "⚡ 模拟结算已完成 (Settled)" : "▶ 模拟开始打单生成 (Billing)"}
          </button>

          <button
            type="button"
            onClick={() => {
              const snap = remote.getSnapshot();
              const currentId = snap.currentSessionId ?? "sess-1";
              const detail = snap.details[currentId];
              if (detail) {
                const nextIndex = detail.turns.length + 1;
                const lastTurn = detail.turns.at(-1);
                if (lastTurn && lastTurn.status === "billing") {
                  lastTurn.status = "settled";
                  lastTurn.completedAt = new Date().toISOString();
                }
                detail.turns.push({
                  id: `${currentId}-turn-${nextIndex}`,
                  label: `轮次 ${nextIndex}`,
                  startedAt: new Date().toISOString(),
                  completedAt: null,
                  status: "billing",
                  pricingZone: "peak",
                  cacheHitTokens: 6000,
                  cacheMissTokens: 10000,
                  outputTokens: 3500,
                  reasoningTokens: 2000,
                  amountMicroCny: 3200,
                  note: "新轮次生成中",
                });
                detail.status = "billing";
                detail.currentRequestMicroCny = 3200;
                detail.sessionTotalMicroCny += 3200;
                snap.summary.status.code = "billing";
                snap.summary.currentRequestMicroCny = 3200;
                snap.summary.sessionTotalMicroCny += 3200;
                remote.setSnapshot(snap);
              }
            }}
            style={{
              padding: "5px 12px",
              background: "rgba(147, 51, 234, 0.2)",
              border: "1px solid rgba(147, 51, 234, 0.4)",
              borderRadius: 6,
              color: "#c084fc",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ➕ 模拟进入下一轮对话 (追加小票)
          </button>

          <button
            type="button"
            onClick={() => setIsStreaming(!isStreaming)}
            style={{
              padding: "5px 10px",
              background: isStreaming ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              borderRadius: 6,
              color: isStreaming ? "#fbbf24" : "#94a3b8",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {isStreaming ? "⏸ 暂停数据流跳动" : "▶ 恢复数据流跳动"}
          </button>

          <span data-testid="viewport-marker" style={{ fontSize: 11, opacity: 0.8 }}>
            悬浮窗形态: 紧凑小票
          </span>
          <span data-testid="reduced-motion-state" data-reduced-motion={String(state.settings.reducedMotion)}>
            reduced motion: {String(state.settings.reducedMotion)}
          </span>
        </section>
      </main>
    </>
  );
}

const style = document.createElement("style");
style.textContent = `
  * {
    box-sizing: border-box;
  }

  body {
    overflow-x: hidden;
    background: var(--dsw-alias-bg-base, Canvas);
    color: var(--dsw-alias-label-primary, CanvasText);
  }

  main {
    width: min(1180px, 100%);
    margin: 0 auto;
    padding: 220px 16px 48px;
  }

  .demo-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    color: #e5eefb;
    font-size: 13px;
    padding: 12px 16px;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    backdrop-filter: blur(12px);
  }

  .demo-status span {
    border: 1px solid rgba(148, 163, 184, 0.36);
    border-radius: 6px;
    padding: 4px 8px;
    background: rgba(15, 23, 42, 0.72);
  }

  @media (max-width: 340px) {
    main {
      padding-inline: 8px;
    }
  }
`;
document.head.append(style);

createRoot(document.getElementById("root")!).render(<VisualDemo />);
