import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { AnalyticsChart, type AnalyticsRange } from "./analytics-chart";
import {
  formatCurrencyMinorCompact,
  formatStatusLabel,
  formatTokenBucketLabel,
  formatTokenCount,
  formatTokenCountCompact,
} from "./format";
import { contextBreakdownRows, SessionStageTabs, StageMetadataPanel } from "./session-stages";
import { buildTokenCostBreakdown } from "./token-breakdown";
import { MyMeterUpdateControl } from "./update-ui";
import { UsageOverview } from "./usage-overview";
import type { MyMeterUpdateController } from "./update-controller";
import type {
  BalanceView,
  BillingInsightsView,
  CostAnalyticsView,
  MeterStatusCode,
  SessionCostTreeNodeView,
  SessionDetailView,
  SessionStageView,
} from "./view-model";

import { statusPriority, type ClientPanel, type MyMeterStore, type MyMeterStoreState, type StatusFilter } from "./store";

const STATUS_FILTER_OPTIONS: MeterStatusCode[] = [
  "idle",
  "billing",
  "settled",
  "unknown",
  "balance_expired",
  "balance_insufficient",
  "failed",
  "aborted",
];

const DSH_COLORS = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  tertiary: "var(--dsw-alias-label-tertiary, #6b7280)",
  base: "var(--dsw-alias-bg-base, #ffffff)",
  layer1: "var(--dsw-alias-bg-layer-1, #ffffff)",
  layer2: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)",
  border2: "var(--dsw-alias-border-l2, #e5e7eb)",
  brand: "var(--dsw-alias-brand-primary, #2563eb)",
} as const;

const ACTION_LINK_COLOR = "#2563eb";

const TOKEN_DETAIL_COLORS = {
  accent: "#2563eb",
  accentBorder: "#bfdbfe",
  derivedBorder: "#dbeafe",
  cacheMiss: "#b45309",
  cacheHit: "#0f766e",
  output: "#2563eb",
  total: "#1d4ed8",
  note: "#64748b",
  anomaly: "#b91c1c",
} as const;

interface ConversationOverlayLease {
  activeViews: number;
  restoreQueued: boolean;
}

const conversationOverlayLeases = new WeakMap<MyMeterStore, ConversationOverlayLease>();

function acquireConversationOverlay(store: MyMeterStore): void {
  const lease = conversationOverlayLeases.get(store) ?? { activeViews: 0, restoreQueued: false };
  lease.activeViews += 1;
  lease.restoreQueued = false;
  conversationOverlayLeases.set(store, lease);
  store.setOverlayVisible(false);
}

function releaseConversationOverlay(store: MyMeterStore): void {
  const lease = conversationOverlayLeases.get(store);
  if (!lease) {
    store.setOverlayVisible(true);
    return;
  }

  lease.activeViews = Math.max(0, lease.activeViews - 1);
  if (lease.activeViews > 0 || lease.restoreQueued) return;

  lease.restoreQueued = true;
  queueMicrotask(() => {
    lease.restoreQueued = false;
    if (lease.activeViews > 0) return;
    conversationOverlayLeases.delete(store);
    store.setOverlayVisible(true);
  });
}

export function useMyMeterStoreState(store: MyMeterStore): MyMeterStoreState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function CompactMeter({
  store,
  onOpenTokenBilling,
}: {
  store: MyMeterStore;
  onOpenTokenBilling?: () => void;
}) {
  const state = useMyMeterStoreState(store);
  useEffect(() => {
    if (state.viewModel.usageOverview.status === "idle") {
      void store.loadUsageOverview("today");
    }
  }, [state.viewModel.usageOverview.status, store]);
  const opensPage = Boolean(onOpenTokenBilling);
  const isBilling = state.viewModel.status.code === "billing";
  const inProgressLabel = "生成中";
  const { detail, currentRequest, sessionTotal } = state.viewModel;
  const [expandedReceiptKey, setExpandedReceiptKey] = useState<string | null>(null);

  const breakdown = detail ? buildTokenCostBreakdown(detail.tokenBuckets) : null;
    const turns = detail?.turns && detail.turns.length > 0 ? detail.turns : null;
    const showReceipt = Boolean(turns);
    const hiddenTurnCount = turns ? Math.floor(Math.max(0, turns.length - 1) / 10) * 10 : 0;
    const receiptExpansionKey = detail && hiddenTurnCount > 0 ? `${detail.id}:${hiddenTurnCount}` : null;
    const receiptTurnsExpanded = receiptExpansionKey !== null && expandedReceiptKey === receiptExpansionKey;
    const visibleTurnStartIndex = receiptTurnsExpanded ? 0 : hiddenTurnCount;
    const receiptStatusLabel = isBilling ? "▲ 正在生成" : `■ ${formatStatusLabel(state.viewModel.status.code)}`;
    const cacheBucket = breakdown?.cacheHit;
    const inputBucket = breakdown?.cacheMiss;
    const outputBucket = breakdown?.output;
    const hasUnknownCost = Boolean(detail && (detail.unknownCount > 0 || detail.status === "unknown"));

    const cacheTokens = cacheBucket ? formatTokenCountCompact(cacheBucket.tokens) : "0";
    const cacheCost = cacheBucket
      ? formatTokenCostAmount(
          formatCurrencyMinorCompact(cacheBucket.amount.microCny, cacheBucket.amount.currency ?? "CNY"),
          cacheBucket.amount.microCny,
          hasUnknownCost,
        )
      : "不可用";

    const inputTokens = inputBucket ? formatTokenCountCompact(inputBucket.tokens) : "0";
    const inputCost = inputBucket
      ? formatTokenCostAmount(
          formatCurrencyMinorCompact(inputBucket.amount.microCny, inputBucket.amount.currency ?? "CNY"),
          inputBucket.amount.microCny,
          hasUnknownCost,
        )
      : "不可用";

    const outputTokens = outputBucket ? formatTokenCountCompact(outputBucket.tokens) : "0";
    const outputCost = outputBucket
      ? formatTokenCostAmount(
          formatCurrencyMinorCompact(outputBucket.amount.microCny, outputBucket.amount.currency ?? "CNY"),
          outputBucket.amount.microCny,
          hasUnknownCost,
        )
      : "不可用";

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
        {/* CSS Keyframes for Receipt Feed and Laser Scan */}
        <style>{`
          @keyframes thermalLaserScan {
            0% { transform: translateX(-100%); opacity: 0; }
            30% { opacity: 1; }
            70% { opacity: 1; }
            100% { transform: translateX(100%); opacity: 0; }
          }
          @keyframes receiptPaperFeed {
            0% { transform: translateY(-2px); }
            50% { transform: translateY(1px); }
            100% { transform: translateY(-2px); }
          }
          @keyframes printHeadPulse {
            0% { opacity: 0.6; transform: scale(0.95); }
            50% { opacity: 1; transform: scale(1.05); }
            100% { opacity: 0.6; transform: scale(0.95); }
          }
        `}</style>

        {/* 顶部主微缩纵向卡片 (Vertical Mini Meter Card) */}
        <button
          type="button"
          aria-label={opensPage ? "打开 Token计费页面" : "Token计费小票"}
          onClick={(event) => {
            // Pointer activation is handled by the draggable shell. A zero
            // detail click is keyboard/programmatic activation.
            if (event.detail === 0) onOpenTokenBilling?.();
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 5,
            width: 190,
            border: isBilling
              ? "1px solid var(--dsw-alias-brand-primary, #3964fe)"
              : "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
            borderRadius: showReceipt ? "10px 10px 4px 4px" : 10,
            padding: "7px 9px",
            background: "var(--dsw-alias-bg-layer-1, #ffffff)",
            color: "var(--dsw-alias-label-primary, #111827)",
            boxShadow: "0 10px 24px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 16%, transparent)",
            cursor: "grab",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            transition: "all 0.2s ease",
            outline: "none",
            zIndex: 2,
            userSelect: "none",
          }}
        >
          {/* 顶栏：标题与状态 */}
          <div
            data-testid="mymeter-today-summary"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 3,
              paddingBottom: 4,
              borderBottom: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
              fontSize: 8.5,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              今日 {state.viewModel.usageOverview.data?.coverage === "unavailable" ? "—" : state.viewModel.usageOverview.data ? formatCurrencyMinorCompact(state.viewModel.usageOverview.data.total.microCny, state.viewModel.usageOverview.data.total.currency ?? "CNY") : "同步中"}
            </span>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Token {state.viewModel.usageOverview.data ? formatTokenCountCompact(state.viewModel.usageOverview.data.totalTokens) : "—"}
            </span>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {state.viewModel.balance.supported
                ? `余额 ${state.viewModel.balance.total ? formatCurrencyMinorCompact(state.viewModel.balance.total.microCny, state.viewModel.balance.total.currency ?? "CNY") : "不可用"}`
                : state.viewModel.balance.status === "unavailable" ? "余额未接入" : "同步中"}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              borderBottom: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
              paddingBottom: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: isBilling
                    ? "var(--dsw-alias-brand-primary, #3964fe)"
                    : "var(--dsw-alias-state-success-primary, #16a34a)",
                  boxShadow: "0 0 8px color-mix(in srgb, var(--dsw-alias-brand-primary, #3964fe) 45%, transparent)",
                  flexShrink: 0,
                  animation: isBilling ? "printHeadPulse 1s infinite ease-in-out" : "none",
                }}
              />
              <strong style={{ fontSize: 11, fontWeight: 700, letterSpacing: "-0.01em", opacity: 0.9 }}>
                Token计费
              </strong>
            </div>

            {isBilling ? (
              <span
                style={{
                  fontSize: 8.5,
                  color: "var(--dsw-alias-brand-primary, #3964fe)",
                  background: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
                  border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
                  padding: "0.5px 4px",
                  borderRadius: 3,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                }}
              >
                ⚡ {inProgressLabel}
              </span>
            ) : (
              <span
                style={{
                  fontSize: 8.5,
                  color: "var(--dsw-alias-label-secondary, #6b7280)",
                  letterSpacing: "0.02em",
                  opacity: 0.8,
                }}
              >
                {formatStatusLabel(state.viewModel.status.code)}
              </span>
            )}
          </div>

          {/* 纵向三行分项明细 (Vertical 3-Row Token & Cost Breakdown) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              width: "100%",
              fontSize: 10.5,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {/* 缓存行 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "2px 5px",
                background: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
                border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
                borderRadius: 4,
                color: "var(--dsw-alias-label-primary, #111827)",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  gap: 3,
                  minWidth: 0,
                  flexShrink: 1,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
                title={cacheTokens}
              >
                <span style={{ opacity: 0.85, flexShrink: 0 }}>缓:</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{cacheTokens}</span>
              </span>
              <span style={{ fontWeight: 700, flexShrink: 0, marginLeft: "auto" }}>{cacheCost}</span>
            </div>

            {/* 输入行 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "2px 5px",
                background: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
                border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
                borderRadius: 4,
                color: "var(--dsw-alias-label-primary, #111827)",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  gap: 3,
                  minWidth: 0,
                  flexShrink: 1,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
                title={inputTokens}
              >
                <span style={{ opacity: 0.85, flexShrink: 0 }}>入:</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{inputTokens}</span>
              </span>
              <span style={{ fontWeight: 700, flexShrink: 0, marginLeft: "auto" }}>{inputCost}</span>
            </div>

            {/* 输出行 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "2px 5px",
                background: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
                border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
                borderRadius: 4,
                color: "var(--dsw-alias-label-primary, #111827)",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  gap: 3,
                  minWidth: 0,
                  flexShrink: 1,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
                title={outputTokens}
              >
                <span style={{ opacity: 0.85, flexShrink: 0 }}>出:</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{outputTokens}</span>
              </span>
              <span style={{ fontWeight: 700, flexShrink: 0, marginLeft: "auto" }}>{outputCost}</span>
            </div>
          </div>
        </button>

        {/* 运行时吐小票出账单动效 */}
        {showReceipt ? (
          <div
            data-testid="mymeter-receipt"
            title={opensPage ? "点击打开 Token计费页面" : "Token计费小票"}
            style={{
              position: "relative",
              width: 178,
              marginTop: -2,
              padding: "5px 8px 7px",
              background: "var(--dsw-alias-bg-layer-1, #ffffff)",
              color: "var(--dsw-alias-label-primary, #111827)",
              fontFamily:
                'ui-monospace, "SF Mono", Monaco, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, monospace',
              fontSize: 9.5,
              borderRadius: "0 0 3px 3px",
              boxShadow: "0 10px 22px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 14%, transparent)",
              cursor: "grab",
              animation: isBilling ? "receiptPaperFeed 1.2s infinite ease-in-out" : "none",
              overflow: "hidden",
              zIndex: 1,
              clipPath:
                "polygon(0% 0%, 100% 0%, 100% calc(100% - 3px), 94% 100%, 88% calc(100% - 3px), 82% 100%, 76% calc(100% - 3px), 70% 100%, 64% calc(100% - 3px), 58% 100%, 52% calc(100% - 3px), 46% 100%, 40% calc(100% - 3px), 34% 100%, 28% calc(100% - 3px), 22% 100%, 16% calc(100% - 3px), 10% 100%, 4% calc(100% - 3px), 0% 100%)",
            }}
          >
            {/* 激光打印扫描线仅在生成期间运行。 */}
            {isBilling ? (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "100%",
                  background: "color-mix(in srgb, var(--dsw-alias-brand-primary, #3964fe) 20%, transparent)",
                  animation: "thermalLaserScan 1.8s infinite linear",
                  pointerEvents: "none",
                }}
              />
            ) : null}

            {/* 小票头部 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px dashed var(--dsw-alias-border-l1, #e5e7eb)",
                paddingBottom: 2,
                marginBottom: 3,
                fontSize: 8.5,
              }}
            >
              <span style={{ fontWeight: 800, letterSpacing: "0.04em", color: isBilling ? "var(--dsw-alias-brand-primary, #3964fe)" : "var(--dsw-alias-state-success-primary, #16a34a)" }}>
                {receiptStatusLabel}
              </span>
              <span style={{ fontSize: 8, color: "var(--dsw-alias-label-secondary, #6b7280)" }}>
                {turns ? `共 ${turns.length} 轮` : "第 1 轮"}
              </span>
            </div>

            {/* 逐轮追加打印流水行 (Turn-by-turn Continuous Feed) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                marginBottom: 3,
                maxHeight: 120,
                overflowY: "auto",
              }}
            >
              {hiddenTurnCount > 0 ? (
                <button
                  type="button"
                  aria-expanded={receiptTurnsExpanded}
                  aria-label={`${receiptTurnsExpanded ? "隐藏" : "展开"}前 ${hiddenTurnCount} 轮费用`}
                  title={`${receiptTurnsExpanded ? "隐藏" : "展开"}前 ${hiddenTurnCount} 轮费用`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    if (receiptExpansionKey !== null) {
                      setExpandedReceiptKey(receiptTurnsExpanded ? null : receiptExpansionKey);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    margin: "0 0 2px",
                    padding: "2px 3px",
                    border: "1px dashed var(--dsw-alias-border-l1, #d1d5db)",
                    borderRadius: 3,
                    background: "transparent",
                    color: "var(--dsw-alias-label-secondary, #6b7280)",
                    fontSize: 8,
                    fontWeight: 600,
                    lineHeight: 1.2,
                    cursor: "pointer",
                  }}
                >
                  <span>{receiptTurnsExpanded ? `隐藏前 ${hiddenTurnCount} 轮费用` : `展开前 ${hiddenTurnCount} 轮费用`}</span>
                  <span aria-hidden="true">{receiptTurnsExpanded ? "▴" : "▾"}</span>
                </button>
              ) : null}
              {turns && turns.length > 0 ? (
                turns.slice(visibleTurnStartIndex).map((turn, visibleIndex) => {
                  const index = visibleTurnStartIndex + visibleIndex;
                  const isActive = turn.completedAt === null
                    && (turn.status === "billing" || (isBilling && index === turns.length - 1));
                  return (
                    <div
                      key={turn.id || index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 8.5,
                        fontVariantNumeric: "tabular-nums",
                        color: isActive ? "var(--dsw-alias-brand-primary, #3964fe)" : "var(--dsw-alias-label-primary, #111827)",
                        fontWeight: isActive ? 700 : 500,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          minWidth: 0,
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isActive ? (
                          <span
                            style={{
                              width: 3.5,
                              height: 3.5,
                              borderRadius: "50%",
                              background: "var(--dsw-alias-brand-primary, #3964fe)",
                              animation: "printHeadPulse 1s infinite ease-in-out",
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <span style={{ width: 3.5, height: 3.5, borderRadius: "50%", background: "var(--dsw-alias-label-tertiary, #9ca3af)", flexShrink: 0 }} />
                        )}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>#{index + 1} 轮{isActive ? ` (${inProgressLabel})` : ""}</span>
                      </span>
                      <span style={{ color: isActive ? "var(--dsw-alias-state-error-primary, #dc2626)" : "var(--dsw-alias-label-primary, #111827)", fontWeight: 700, flexShrink: 0, marginLeft: "auto" }}>
                        {isActive && currentRequest.microCny > 0
                          ? formatCurrencyMinorCompact(currentRequest.microCny, currentRequest.currency ?? "CNY")
                          : formatCurrencyMinorCompact(turn.amount.microCny, turn.amount.currency ?? "CNY")}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 8.5,
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--dsw-alias-brand-primary, #3964fe)",
                    fontWeight: 700,
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <span
                      style={{
                        width: 3.5,
                        height: 3.5,
                        borderRadius: "50%",
                        background: "var(--dsw-alias-brand-primary, #3964fe)",
                        animation: "printHeadPulse 1s infinite ease-in-out",
                      }}
                    />
                    <span>#1 轮 ({inProgressLabel})</span>
                  </span>
                  <span style={{ color: "var(--dsw-alias-state-error-primary, #dc2626)", fontWeight: 700, flexShrink: 0, marginLeft: "auto" }}>
                    {formatCurrencyMinorCompact(currentRequest.microCny, currentRequest.currency ?? "CNY")}
                  </span>
                </div>
              )}
            </div>

            {/* 底部合计汇总 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px dashed var(--dsw-alias-border-l1, #e5e7eb)",
                paddingTop: 2,
                fontSize: 8.5,
                color: "var(--dsw-alias-label-secondary, #6b7280)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span style={{ fontWeight: 600, flexShrink: 0 }}>合计支出</span>
              <span style={{ fontWeight: 800, color: "var(--dsw-alias-label-primary, #111827)", flexShrink: 0, marginLeft: "auto" }}>
                {formatCurrencyMinorCompact(sessionTotal.microCny, sessionTotal.currency ?? "CNY")}
              </span>
            </div>
          </div>
        ) : null}
      </div>
  );
}

export function GlobalSessionList({
  store,
  showViewTabs = true,
}: {
  store: MyMeterStore;
  showViewTabs?: boolean | undefined;
}) {
  const state = useMyMeterStoreState(store);
  const hasGlobalMixedCurrency = state.viewModel.currencyTotals.length > 1;
  const sessions = useMemo(() => {
    const query = state.ui.searchQuery.trim().toLowerCase();
    const filtered = state.viewModel.sessions.filter((session) => {
      const matchesQuery =
        !query ||
        [session.title, session.id, session.model, session.agentPreset].some((value) =>
          value.toLowerCase().includes(query),
        );
      const matchesStatus = state.ui.filterStatus === "all" || session.status === state.ui.filterStatus;
      return matchesQuery && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (state.ui.sortBy === "amount") {
        return b.sessionTotal.microCny - a.sessionTotal.microCny;
      }
      if (state.ui.sortBy === "status") {
        return statusPriority(b.status) - statusPriority(a.status);
      }
      return b.lastActivityAt.localeCompare(a.lastActivityAt);
    });
  }, [state.ui.filterStatus, state.ui.searchQuery, state.ui.sortBy, state.viewModel.sessions]);
  const activePanel = state.ui.activePanel === "costTree" || state.ui.activePanel === "analytics"
    ? state.ui.activePanel
    : "sessions";

  useEffect(() => {
    if (activePanel === "costTree" && state.viewModel.sessionCostTree.status === "idle") {
      void store.loadSessionCostTree();
    }
    if (activePanel === "analytics") {
      if (state.viewModel.costAnalytics.status === "idle") void store.loadCostAnalytics();
      if (state.viewModel.usageOverview.status === "idle") void store.loadUsageOverview(state.ui.analyticsRange);
    }
  }, [
    activePanel,
    state.ui.analyticsRange,
    state.viewModel.costAnalytics.status,
    state.viewModel.sessionCostTree.status,
    state.viewModel.usageOverview.status,
    store,
  ]);

  if (state.remote.connection.status === "loading") {
    return <p style={{ margin: 0, padding: 12, color: DSH_COLORS.secondary, fontSize: 13 }}>加载会话中...</p>;
  }

  if (state.remote.connection.status === "error") {
    return (
      <p role="alert" style={{ margin: 0, padding: 12, color: "var(--dsw-alias-state-error-primary, #dc2626)", fontSize: 13 }}>
        {state.remote.connection.message ?? "Remote 连接失败"}
      </p>
    );
  }

  const controlStyle = {
    padding: "6px 10px",
    background: DSH_COLORS.layer1,
    border: `1px solid ${DSH_COLORS.border1}`,
    borderRadius: 6,
    color: DSH_COLORS.primary,
    fontSize: 12,
    outline: "none",
  };

  return (
    <section aria-label="全局会话列表" style={{ display: "grid", gap: 10 }}>
      <header
        style={{
          display: "grid",
          gap: 6,
          padding: "8px 12px",
          background: DSH_COLORS.layer1,
          borderRadius: 8,
          border: `1px solid ${DSH_COLORS.border1}`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>Token计费</strong>
          <span style={{ fontSize: 10, color: DSH_COLORS.brand, fontWeight: 600 }}>会话概览</span>
        </div>
        <span style={{ fontSize: 11, color: DSH_COLORS.secondary, fontVariantNumeric: "tabular-nums" }}>
          {state.viewModel.balance.supported && state.viewModel.balance.provider !== "unknown"
            ? `${state.viewModel.balance.providerName}余额 ${state.viewModel.balance.total?.label ?? "不可用"} · `
            : ""}
          DSH本地累计 {hasGlobalMixedCurrency
            ? state.viewModel.cnyEquivalent?.label ?? "多币种（待查询汇率）"
            : state.viewModel.localTotal.label}
          {hasGlobalMixedCurrency ? (
            <button
              type="button"
              onClick={() => { void store.refreshExchangeRate(); }}
              disabled={state.viewModel.exchangeRate.status === "loading"}
              style={{ marginLeft: 6, padding: "1px 5px", borderRadius: 4, border: `1px solid ${DSH_COLORS.border1}`, background: DSH_COLORS.base, color: DSH_COLORS.brand, fontSize: 9, cursor: "pointer" }}
            >
              {state.viewModel.exchangeRate.status === "loading" ? "查询中" : "查询汇率"}
            </button>
          ) : null}
          {state.viewModel.balance.supported ? (
            <button
              type="button"
              aria-label="刷新余额"
              title="刷新余额"
              onClick={() => { void store.refreshBalance(); }}
              style={{ marginLeft: 6, padding: "1px 5px", borderRadius: 4, border: `1px solid ${DSH_COLORS.border1}`, background: DSH_COLORS.base, color: DSH_COLORS.brand, fontSize: 9, cursor: "pointer" }}
            >
              刷新
            </button>
          ) : null}
        </span>
        <BillingInsightsStrip
          ariaLabel="全局费用洞察"
          insights={state.viewModel.insights}
          showCacheSavings={false}
        />
      </header>

      {showViewTabs ? <BillingViewTabs store={store} state={state} activePanel={activePanel} /> : null}

      <LedgerExportToolbar store={store} state={state} />

      {activePanel === "costTree" ? (
        <SessionCostTreePanel store={store} state={state} />
      ) : activePanel === "analytics" ? (
        <CostAnalyticsPanel store={store} state={state} />
      ) : (
        <>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 6 }}>
        <input
          aria-label="搜索会话"
          value={state.ui.searchQuery}
          placeholder="搜索会话"
          onChange={(event) => store.setSearchQuery(event.target.value)}
          style={controlStyle}
        />
        <select
          aria-label="排序"
          value={state.ui.sortBy}
          onChange={(event) => store.setSortBy(event.target.value as MyMeterStoreState["ui"]["sortBy"])}
          style={controlStyle}
        >
          <option value="recent">最近</option>
          <option value="amount">金额</option>
          <option value="status">状态</option>
        </select>
        <select
          aria-label="筛选状态"
          value={state.ui.filterStatus}
          onChange={(event) => store.setFilterStatus(event.target.value as StatusFilter)}
          style={controlStyle}
        >
          <option value="all">全部</option>
          {STATUS_FILTER_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {formatStatusLabel(status)}
            </option>
          ))}
        </select>
      </div>

      {sessions.length === 0 ? (
        <p style={{ margin: 0, padding: "16px 8px", textAlign: "center", color: DSH_COLORS.secondary, fontSize: 12 }}>
          暂无匹配会话。
        </p>
      ) : (
        <div style={{ display: "grid", gap: 6, maxHeight: 320, overflowY: "auto", paddingRight: 2 }}>
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => store.selectSession(session.id)}
              style={{
                display: "grid",
                gap: 4,
                textAlign: "left",
                padding: "8px 12px",
                borderRadius: 8,
                border: session.isActive ? `1px solid ${DSH_COLORS.brand}` : `1px solid ${DSH_COLORS.border1}`,
                background: session.isActive ? DSH_COLORS.layer2 : DSH_COLORS.layer1,
                boxShadow: "none",
                cursor: "pointer",
                color: DSH_COLORS.primary,
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 13, fontWeight: 600 }}>{session.title}</strong>
                {session.isActive ? (
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 6px",
                      background: DSH_COLORS.layer2,
                      border: `1px solid ${DSH_COLORS.border1}`,
                      borderRadius: 4,
                      color: DSH_COLORS.brand,
                      fontWeight: 700,
                    }}
                  >
                    ACTIVE
                  </span>
                ) : null}
              </div>
              <span style={{ fontSize: 11, color: DSH_COLORS.secondary }}>
                {session.model} · {session.reasoningEffort} · {session.agentPreset}
              </span>
              <span style={{ fontSize: 11, color: DSH_COLORS.primary, fontVariantNumeric: "tabular-nums" }}>
                {formatStatusLabel(session.status)}
                {session.status === "billing" ? ` ${session.currentRequest.label}` : ""} · 会话累计{" "}
                {session.sessionTotal.label}
              </span>
            </button>
          ))}
        </div>
      )}
        </>
      )}
    </section>
  );
}

function BillingViewTabs({
  store,
  state,
  activePanel,
  includeCurrentSession = false,
}: {
  store: MyMeterStore;
  state: MyMeterStoreState;
  activePanel: ClientPanel;
  includeCurrentSession?: boolean | undefined;
}): ReactNode {
  const panels: Array<[ClientPanel, string]> = includeCurrentSession
    ? [
        ["detail", "当前会话"],
        ["sessions", "全部会话"],
        ["costTree", "费用树"],
        ["analytics", "趋势/异常"],
      ]
    : [
        ["sessions", "会话"],
        ["costTree", "费用树"],
        ["analytics", "趋势/异常"],
      ];

  return (
    <div role="tablist" aria-label="费用视图" style={{ display: "flex", gap: 4, overflowX: "auto", touchAction: "pan-x" }}>
      {panels.map(([panel, label]) => {
        const unavailable = panel === "costTree"
          ? state.viewModel.sessionCostTree.status === "unavailable"
          : panel === "analytics"
            ? state.viewModel.costAnalytics.status === "unavailable"
              && state.viewModel.usageOverview.status === "unavailable"
            : false;
        return <button
          key={panel}
          type="button"
          role="tab"
          aria-selected={activePanel === panel}
          disabled={unavailable}
          onClick={() => store.setActivePanel(panel)}
          style={{
            minHeight: 28,
            padding: "4px 10px",
            borderRadius: 6,
            border: activePanel === panel ? `1px solid ${DSH_COLORS.brand}` : `1px solid ${DSH_COLORS.border1}`,
            background: activePanel === panel ? DSH_COLORS.layer2 : DSH_COLORS.layer1,
            color: activePanel === panel ? DSH_COLORS.brand : DSH_COLORS.secondary,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
            cursor: unavailable ? "not-allowed" : "pointer",
            opacity: unavailable ? 0.55 : 1,
          }}
        >
          {label}
        </button>;
      })}
    </div>
  );
}

function LedgerExportToolbar({ store, state }: { store: MyMeterStore; state: MyMeterStoreState }): ReactNode {
  const exportState = state.viewModel.ledgerExport;
  const unavailable = exportState.status === "unavailable";
  const isLoading = exportState.status === "loading";
  return (
    <section aria-label="账本导出" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {(["json", "csv"] as const).map((format) => (
        <button
          key={format}
          type="button"
          aria-label={`下载${format.toUpperCase()}账本`}
          disabled={unavailable || isLoading}
          onClick={() => { void store.exportLedger(format); }}
          style={{
            minHeight: 28,
            padding: "4px 9px",
            borderRadius: 6,
            border: `1px solid ${DSH_COLORS.border1}`,
            background: DSH_COLORS.layer1,
            color: unavailable ? DSH_COLORS.tertiary : DSH_COLORS.brand,
            fontSize: 11,
            fontWeight: 700,
            cursor: unavailable || isLoading ? "not-allowed" : "pointer",
          }}
        >
          ↓ {format.toUpperCase()}
        </button>
      ))}
      <span role={exportState.status === "error" ? "alert" : undefined} style={{ color: exportState.status === "error" ? TOKEN_DETAIL_COLORS.anomaly : DSH_COLORS.tertiary, fontSize: 10 }}>
        {exportState.status === "unavailable"
          ? "当前 dsh 版本不支持导出"
          : exportState.status === "loading"
            ? `正在生成 ${exportState.format?.toUpperCase() ?? ""}`
            : exportState.status === "ready"
              ? `${exportState.format?.toUpperCase()} 已下载`
              : exportState.status === "error"
                ? exportState.error ?? "导出失败"
                : "导出不包含提示词、回复正文和 API Key"}
      </span>
    </section>
  );
}

function SessionCostTreePanel({ store, state }: { store: MyMeterStore; state: MyMeterStoreState }): ReactNode {
  const resource = state.viewModel.sessionCostTree;
  if (resource.status === "unavailable") return <EmptyToolState label="当前 dsh 版本不支持费用树。" />;
  if (resource.status === "loading") return <EmptyToolState label="正在加载费用树..." />;
  if (resource.status === "error") {
    return <ToolErrorState label={resource.error ?? "费用树加载失败"} onRetry={() => { void store.loadSessionCostTree(); }} />;
  }
  if (resource.status === "idle") {
    return <ToolRetryState label="加载费用树" onClick={() => { void store.loadSessionCostTree(); }} />;
  }
  const tree = resource.data;
  if (!tree) return <EmptyToolState label="暂无子 Agent 费用关系。" />;
  const roots = tree.roots.filter((node) => node.children.length > 0 || node.anomalyLabels.length > 0);
  if (roots.length === 0) return <EmptyToolState label="暂无子 Agent 费用关系。普通会话请在会话列表中查看。" />;
  return (
    <section aria-label="费用树" style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 11, color: DSH_COLORS.secondary }}>{roots.length} 个子 Agent 任务树</span>
      {tree.anomalyLabels.length > 0 ? (
        <p role="alert" style={{ margin: 0, color: TOKEN_DETAIL_COLORS.anomaly, fontSize: 11 }}>
          {tree.anomalyLabels.join("；")}
        </p>
      ) : null}
      <ol style={{ display: "grid", gap: 4, margin: 0, padding: 0, listStyle: "none" }}>
        {roots.map((node) => <SessionCostTreeNodeRow key={node.id} node={node} />)}
      </ol>
    </section>
  );
}

function SessionCostTreeNodeRow({ node }: { node: SessionCostTreeNodeView }): ReactNode {
  return (
    <li>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 8,
          padding: "6px 8px",
          marginLeft: Math.min(node.depth * 12, 48),
          background: DSH_COLORS.layer1,
          border: `1px solid ${node.anomalyLabels.length > 0 ? "color-mix(in srgb, var(--dsw-alias-state-error-primary, #dc2626) 45%, transparent)" : DSH_COLORS.border1}`,
          borderRadius: 6,
          fontSize: 11,
          minWidth: 0,
        }}
      >
        <span style={{ minWidth: 0, overflowWrap: "anywhere", color: DSH_COLORS.primary }}>
          <strong>{node.title}</strong>
          <span style={{ color: DSH_COLORS.tertiary }}> · {node.id}</span>
          {node.anomalyLabels.length > 0 ? <span style={{ color: TOKEN_DETAIL_COLORS.anomaly }}> · {node.anomalyLabels.join("/")}</span> : null}
        </span>
        <span style={{ textAlign: "right", color: DSH_COLORS.secondary, fontVariantNumeric: "tabular-nums" }}>
          {node.children.length > 0 ? `自身 ${node.total.label} · 含子 Agent ${node.subtreeTotal.label}` : `费用 ${node.total.label}`}
        </span>
      </div>
      {node.children.length > 0 ? (
        <ol style={{ display: "grid", gap: 4, margin: "4px 0 0", padding: 0, listStyle: "none" }}>
          {node.children.map((child) => <SessionCostTreeNodeRow key={child.id} node={child} />)}
        </ol>
      ) : null}
    </li>
  );
}

function CostAnalyticsPanel({ store, state }: { store: MyMeterStore; state: MyMeterStoreState }): ReactNode {
  const resource = state.viewModel.costAnalytics;
  const overviewResource = state.viewModel.usageOverview;
  if (overviewResource.status === "unavailable" && resource.status === "unavailable") return <EmptyToolState label="当前 dsh 版本不支持趋势分析。" />;
  if (overviewResource.status === "loading" && !overviewResource.data) return <EmptyToolState label="正在加载趋势分析..." />;
  if (overviewResource.status === "error" && !overviewResource.data && resource.status !== "ready") {
    return <ToolErrorState label="用量概览加载失败" onRetry={() => { void store.loadUsageOverview(state.ui.analyticsRange); }} />;
  }
  if (resource.status === "error") {
    return <ToolErrorState label={resource.error ?? "趋势分析加载失败"} onRetry={() => { void store.loadCostAnalytics(); }} />;
  }
  if (resource.status === "idle" && !overviewResource.data) {
    return <ToolRetryState label="加载趋势/异常" onClick={() => {
      void store.loadCostAnalytics();
      void store.loadUsageOverview(state.ui.analyticsRange);
    }} />;
  }
  const analytics = resource.data;
  const overview = overviewResource.data;
  if (!overview && (!analytics || (analytics.dailyTrend.length === 0 && analytics.hourlyTrend.length === 0 && analytics.anomalies.length === 0))) {
    return <EmptyToolState label="暂无趋势数据。" />;
  }
  return <CostAnalyticsReportView store={store} state={state} overview={overview} analytics={analytics} />;
}

function CostAnalyticsReportView({
  store,
  state,
  overview,
  analytics,
}: {
  store: MyMeterStore;
  state: MyMeterStoreState;
  overview: NonNullable<MyMeterStoreState["viewModel"]["usageOverview"]["data"]> | null;
  analytics: CostAnalyticsView | null;
}): ReactNode {
  const range = state.ui.analyticsRange;
  const rangeOptions: Array<[AnalyticsRange, string]> = [
    ["today", "今日"],
    ["7d", "7天"],
    ["30d", "30天"],
  ];

  return (
    <section aria-label="趋势和异常" style={{ display: "grid", gap: 8 }}>
      {state.viewModel.usageOverview.status === "error" && overview ? (
        <p role="status" style={{ margin: 0, color: DSH_COLORS.secondary, fontSize: 10 }}>
          用量概览暂时不可用，显示最近一次同步结果。
        </p>
      ) : null}
      {overview ? <UsageOverview overview={overview} /> : null}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <strong style={{ fontSize: 11, color: DSH_COLORS.primary }}>费用趋势</strong>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would alter the compact toolbar layout; role="group" keeps the range switcher labelled. */}
        <div role="group" aria-label="趋势范围" style={{ display: "inline-flex", padding: 2, border: `1px solid ${DSH_COLORS.border1}`, borderRadius: 6, background: DSH_COLORS.layer1 }}>
          {rangeOptions.map(([value, label]) => {
            const selected = range === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => store.setAnalyticsRange(value)}
                style={{
                  minHeight: 24,
                  padding: "2px 8px",
                  border: 0,
                  borderRadius: 4,
                  background: selected ? DSH_COLORS.layer2 : "transparent",
                  color: selected ? DSH_COLORS.brand : DSH_COLORS.secondary,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {overview ? <AnalyticsChart range={range} trend={overview.trend} /> : null}
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ fontSize: 11, color: DSH_COLORS.primary }}>异常</strong>
        {!analytics || analytics.anomalies.length === 0 ? (
          <span style={{ color: DSH_COLORS.tertiary, fontSize: 11 }}>暂无异常。</span>
        ) : analytics.anomalies.map((anomaly) => (
          <div key={`${anomaly.ruleId}:${anomaly.bucketKey}`} style={{ padding: "6px 8px", border: `1px solid ${anomaly.severity === "warning" ? "color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 45%, transparent)" : DSH_COLORS.border1}`, borderRadius: 6, background: DSH_COLORS.layer1, color: DSH_COLORS.secondary, fontSize: 11 }}>
            <strong style={{ color: anomaly.severity === "warning" ? "var(--dsw-alias-state-warn-primary, #b45309)" : DSH_COLORS.brand }}>{anomaly.bucketKey}</strong> · {anomaly.explanation}
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyToolState({ label }: { label: string }): ReactNode {
  return <p style={{ margin: 0, padding: "16px 8px", textAlign: "center", color: DSH_COLORS.secondary, fontSize: 12 }}>{label}</p>;
}

function ToolRetryState({ label, onClick }: { label: string; onClick: () => void }): ReactNode {
  return <button type="button" onClick={onClick} style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${DSH_COLORS.border1}`, background: DSH_COLORS.layer1, color: DSH_COLORS.brand, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{label}</button>;
}

function ToolErrorState({ label, onRetry }: { label: string; onRetry: () => void }): ReactNode {
  return (
    <div role="alert" style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: "8px 10px", border: `1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #dc2626) 45%, transparent)`, borderRadius: 6, background: DSH_COLORS.layer1, color: TOKEN_DETAIL_COLORS.anomaly, fontSize: 12 }}>
      <span>{label}</span>
      <button type="button" onClick={onRetry} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${DSH_COLORS.border1}`, background: DSH_COLORS.base, color: DSH_COLORS.brand, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>重试</button>
    </div>
  );
}

export function SessionDetailPanel({ store, showNavigation = true }: { store: MyMeterStore; showNavigation?: boolean }) {
  const state = useMyMeterStoreState(store);
  const detail = state.viewModel.detail;

  const backBtnStyle = {
    padding: "3px 8px",
    background: DSH_COLORS.layer2,
    border: `1px solid ${DSH_COLORS.border1}`,
    borderRadius: 6,
    color: DSH_COLORS.primary,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  };

  if (!detail) {
    return (
      <section
        aria-label="会话详情"
        style={{ display: "grid", gap: 10, padding: 4, color: DSH_COLORS.primary, background: DSH_COLORS.base }}
      >
        {showNavigation ? (
          <button type="button" onClick={() => store.selectSession(null)} style={backBtnStyle}>
            全部会话
          </button>
        ) : null}
        <p style={{ margin: 0, color: DSH_COLORS.tertiary, fontSize: 12 }}>请选择一个会话。</p>
      </section>
    );
  }

  const sessionHasUnknownCost = detail.unknownCount > 0 || detail.status === "unknown";
  const sessionTotalLabel = formatUnknownTotalLabel(detail.sessionTotal.label, detail.sessionTotal.microCny, sessionHasUnknownCost);
  const currencyTotals = detail.currencyTotals ?? [];
  const isMixedCurrency = currencyTotals.length > 1;
  const nativeSessionTotalLabel = currencyTotals.length === 1
    ? formatUnknownTotalLabel(currencyTotals[0]!.amount.label, currencyTotals[0]!.amount.microCny, sessionHasUnknownCost)
    : isMixedCurrency ? "多币种" : sessionTotalLabel;

  return (
    <section
      aria-label="会话详情"
      style={{ display: "grid", gap: 10, color: DSH_COLORS.primary, background: DSH_COLORS.base }}
    >
      <header style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          {showNavigation ? (
            <button type="button" onClick={() => store.selectSession(null)} style={backBtnStyle}>
              全部会话
            </button>
          ) : <span aria-hidden="true" style={{ width: 1 }} />}
          {state.viewModel.status.code === "failed" ? null : (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                background: `color-mix(in srgb, ${DSH_COLORS.brand} 15%, transparent)`,
                border: `1px solid color-mix(in srgb, ${DSH_COLORS.brand} 35%, transparent)`,
                borderRadius: 999,
                color: DSH_COLORS.brand,
                fontWeight: 600,
              }}
            >
              {state.viewModel.status.label}
            </span>
          )}
        </div>
        {detail.title !== detail.id ? (
          <strong style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", textAlign: "left" }}>
            {detail.title}
          </strong>
        ) : null}
        {/* biome-ignore lint/a11y/useSemanticElements: tests and screen readers address this row as a labelled group; a fieldset would change header layout. */}
        <div
          role="group"
          aria-label="会话ID"
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            minWidth: 0,
            textAlign: "left",
          }}
        >
          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: DSH_COLORS.secondary }}>会话ID</span>
          <code
            style={{
              minWidth: 0,
              overflowWrap: "anywhere",
              fontSize: 11,
              color: DSH_COLORS.secondary,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {detail.id}
          </code>
        </div>
      </header>

      {/* 主金额展示 */}
      <div
        style={{
          display: "grid",
          gap: 2,
          padding: "10px 12px",
          background: DSH_COLORS.layer1,
          borderRadius: 8,
          border: `1px solid ${DSH_COLORS.border2}`,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: DSH_COLORS.brand, letterSpacing: "0.05em" }}>
          会话总费用
        </span>
        <strong
          style={{
            fontSize: 24,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
            color: DSH_COLORS.primary,
          }}
        >
          {nativeSessionTotalLabel}
        </strong>
        <span style={{ fontSize: 11, color: DSH_COLORS.secondary, fontVariantNumeric: "tabular-nums" }}>
          {currencyTotals.length === 1
            ? `已结算 ${currencyTotals[0]!.settled.label} + 估算 ${currencyTotals[0]!.estimated.label}`
            : `已结算 ${detail.settledTotal.label} + 估算 ${detail.estimatedTotal.label}`}
        </span>
      </div>
      <BillingInsightsStrip
        ariaLabel="会话费用洞察"
        insights={detail.insights}
        showCacheSavings
      />
      {currencyTotals.length > 0 ? (
        <CurrencyConversionPanel
          totals={currencyTotals}
          cnyEquivalent={detail.cnyEquivalent ?? null}
          exchangeRate={state.viewModel.exchangeRate}
          onRefresh={() => { void store.refreshExchangeRate(); }}
        />
      ) : null}
      <SessionStageTabs detail={detail}>
        {(stage, isHistorical) => <NativeSessionStagePanel stage={stage} isHistorical={isHistorical} />}
      </SessionStageTabs>
    </section>
  );
}

function BillingInsightsStrip({
  ariaLabel,
  insights,
  showCacheSavings,
}: {
  ariaLabel: string;
  insights: BillingInsightsView;
  showCacheSavings: boolean;
}): ReactNode {
  const budgetTone = insights.budget.level === "danger"
    ? "var(--dsw-alias-state-error-primary, #dc2626)"
    : insights.budget.level === "warning"
      ? "var(--dsw-alias-state-warn-primary, #b45309)"
      : insights.budget.level === "notice"
        ? "var(--dsw-alias-state-warn-primary, #b45309)"
        : insights.budget.level === "unavailable"
          ? DSH_COLORS.tertiary
          : DSH_COLORS.brand;
  const budgetLabel = insights.budget.level === "danger"
    ? "已超过"
    : insights.budget.level === "warning"
      ? "接近"
      : insights.budget.level === "notice"
        ? "留意"
        : insights.budget.level === "unavailable"
          ? "不适用"
      : insights.budget.level === "off"
        ? "未启用"
        : "正常";
  const countdown = insights.pricingZoneCountdown;
  const items = [
    ...(showCacheSavings
      ? [{
        label: "缓存节省",
        value: insights.cacheSavings.amount?.label ?? insights.cacheSavings.label,
        meta: insights.cacheSavings.available
          ? `${formatTokenCount(insights.cacheSavings.tokens)} Token`
          : "缺少缓存单价",
        color: "var(--dsw-alias-state-success-primary, #0f766e)",
      }]
      : []),
    {
      label: "预算",
      value: budgetLabel,
      meta: insights.budget.percentLabel
        ? `${insights.budget.percentLabel} · 阈值 ${insights.budget.threshold.label}`
        : insights.budget.available
          ? `阈值 ${insights.budget.threshold.label}`
          : "多币种预算暂不比较",
      color: budgetTone,
    },
    {
      label: "峰谷",
      value: countdown.currentZoneLabel,
      meta: countdown.remainingLabel && countdown.nextZoneLabel && countdown.transitionTimeLabel
        ? `${countdown.remainingLabel}后进入${countdown.nextZoneLabel}（${countdown.transitionTimeLabel}）`
        : "暂不适用",
      color: countdown.currentZone === "peak"
        ? "var(--dsw-alias-state-warn-primary, #b45309)"
        : countdown.currentZone === "offpeak"
          ? "var(--dsw-alias-state-success-primary, #0f766e)"
          : DSH_COLORS.tertiary,
    },
  ];

  return (
    <section
      aria-label={ariaLabel}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 6,
        minWidth: 0,
        padding: "7px 8px",
        background: DSH_COLORS.layer2,
        border: `1px solid ${DSH_COLORS.border2}`,
        borderRadius: 8,
      }}
    >
      {items.map((item) => (
        <div key={item.label} style={{ display: "grid", gap: 1, minWidth: 0 }}>
          <span style={{ color: DSH_COLORS.tertiary, fontSize: 9, fontWeight: 700 }}>{item.label}</span>
          <strong
            style={{
              color: item.color,
              fontSize: 11,
              lineHeight: 1.25,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              overflowWrap: "anywhere",
            }}
          >
            {item.value}
          </strong>
          <span
            style={{
              color: DSH_COLORS.secondary,
              fontSize: 9,
              lineHeight: 1.35,
              fontVariantNumeric: "tabular-nums",
              overflowWrap: "anywhere",
            }}
          >
            {item.meta}
          </span>
        </div>
      ))}
    </section>
  );
}

function CurrencyConversionPanel({
  totals,
  cnyEquivalent,
  exchangeRate,
  onRefresh,
}: {
  totals: NonNullable<SessionDetailView["currencyTotals"]>;
  cnyEquivalent: SessionDetailView["cnyEquivalent"];
  exchangeRate: MyMeterStoreState["viewModel"]["exchangeRate"];
  onRefresh: () => void;
}): ReactNode {
  const mixed = totals.length > 1;
  return (
    <section
      aria-label="币种费用"
      style={{
        display: "grid",
        gap: 6,
        padding: "8px 10px",
        background: DSH_COLORS.layer2,
        border: `1px solid ${DSH_COLORS.border2}`,
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <strong style={{ fontSize: 11, color: DSH_COLORS.primary }}>原币费用</strong>
        {mixed ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={exchangeRate.status === "loading"}
            style={{
              padding: "3px 7px",
              borderRadius: 5,
              border: `1px solid ${DSH_COLORS.border1}`,
              background: DSH_COLORS.base,
              color: DSH_COLORS.brand,
              fontSize: 10,
              fontWeight: 700,
              cursor: exchangeRate.status === "loading" ? "wait" : "pointer",
            }}
          >
            {exchangeRate.status === "loading" ? "查询中..." : "查询最新汇率"}
          </button>
        ) : null}
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        {totals.map((total) => (
          <div key={total.currency} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
            <span style={{ color: DSH_COLORS.secondary }}>{total.currency}</span>
            <strong style={{ color: DSH_COLORS.primary, fontVariantNumeric: "tabular-nums" }}>{total.amount.label}</strong>
          </div>
        ))}
      </div>
      {mixed ? (
        <div style={{ display: "grid", gap: 3, borderTop: `1px solid ${DSH_COLORS.border1}`, paddingTop: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
            <span style={{ color: DSH_COLORS.secondary }}>人民币折算</span>
            <strong style={{ color: DSH_COLORS.primary, fontVariantNumeric: "tabular-nums" }}>
              {cnyEquivalent?.label ?? "查询汇率后显示"}
            </strong>
          </div>
          <span style={{ color: DSH_COLORS.tertiary, fontSize: 9 }}>
            {exchangeRate.status === "fresh" && exchangeRate.rate
              ? `按 1 USD = ¥${exchangeRate.rate.toFixed(4)} · ${exchangeRate.fetchedAt ? formatFxTimestamp(exchangeRate.fetchedAt) : "当天最新"}`
              : exchangeRate.error ?? "人民币折算仅用于汇总展示，不改变原币计费"}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function formatFxTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "当天最新";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

/**
 * Conversation-tab projection for dsh. The tab owns the current session
 * selection and temporarily suppresses the floating overlay while active.
 */
export function MyMeterConversationView({
  store,
  sessionId,
  updateController,
  showUpdateControl = false,
}: {
  store: MyMeterStore;
  sessionId: string;
  updateController?: MyMeterUpdateController | undefined;
  showUpdateControl?: boolean | undefined;
}) {
  const state = useMyMeterStoreState(store);
  const overlayEnabled = state.settings.overlayEnabled;
  const activePanel = state.ui.activePanel === "sessions" || state.ui.activePanel === "costTree" || state.ui.activePanel === "analytics"
    ? state.ui.activePanel
    : "detail";

  useLayoutEffect(() => {
    acquireConversationOverlay(store);
    return () => releaseConversationOverlay(store);
  }, [store]);

  useEffect(() => {
    store.selectSession(sessionId);
  }, [sessionId, store]);

  return (
    <section
      aria-label="Token计费"
      data-testid="mymeter-conversation-view"
      style={{
        minWidth: 0,
        padding: 12,
        color: "var(--dsw-alias-label-primary, #111827)",
        background: "var(--dsw-alias-bg-base, #ffffff)",
        border: "1px solid var(--dsw-alias-border-l1, #d1d5db)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          paddingBottom: 10,
          borderBottom: "1px solid var(--dsw-alias-border-l2, #e5e7eb)",
        }}
      >
        {updateController ? (
          <MyMeterUpdateControl controller={updateController} isLoopback={showUpdateControl} />
        ) : null}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-label-secondary, #4b5563)" }}>
            计费浮窗
          </span>
          <button
            type="button"
            role="switch"
            aria-label="显示计费浮窗"
            aria-checked={overlayEnabled}
            onClick={() => store.setOverlayEnabled(!overlayEnabled)}
            style={{
              position: "relative",
              width: 36,
              height: 20,
              padding: 0,
              flexShrink: 0,
              border: overlayEnabled
                ? "1px solid var(--dsw-alias-brand-primary, #2563eb)"
                : "1px solid var(--dsw-alias-border-l1, #d1d5db)",
              borderRadius: 10,
              background: overlayEnabled
                ? "var(--dsw-alias-brand-primary, #2563eb)"
                : "var(--dsw-alias-bg-layer-2, #f3f4f6)",
              cursor: "pointer",
              transition: state.settings.reducedMotion
                ? "none"
                : "background 0.15s ease, border-color 0.15s ease",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 2,
                left: 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "var(--dsw-alias-bg-layer-1, #ffffff)",
                boxShadow: "0 1px 2px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 24%, transparent)",
                transform: overlayEnabled ? "translateX(16px)" : "translateX(0)",
                transition: state.settings.reducedMotion ? "none" : "transform 0.15s ease",
              }}
            />
          </button>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <BillingViewTabs store={store} state={state} activePanel={activePanel} includeCurrentSession />
      </div>
      <div style={{ color: DSH_COLORS.primary, background: DSH_COLORS.base }}>
        {activePanel === "detail" ? (
          <>
            <AccountBalancesPanel balances={state.viewModel.balances} />
            <SessionDetailPanel store={store} showNavigation={false} />
          </>
        ) : (
          <GlobalSessionList store={store} showViewTabs={false} />
        )}
      </div>
    </section>
  );
}

function AccountBalancesPanel({ balances }: { balances: BalanceView[] }) {
  const visibleBalances = balances.filter((balance) => balance.supported);
  if (visibleBalances.length === 0) return null;

  return (
    <section
      aria-label="账户余额"
      style={{
        display: "grid",
        gap: 8,
        marginBottom: 10,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: DSH_COLORS.secondary }}>账户余额</span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
          gap: 8,
          minWidth: 0,
        }}
      >
        {visibleBalances.map((balance) => <AccountBalanceItem key={balance.provider} balance={balance} />)}
      </div>
    </section>
  );
}

function AccountBalanceItem({ balance }: { balance: BalanceView }) {
  const warning = balance.needsRecharge;
  return (
    <article
      aria-label={`${balance.providerName}账户余额`}
      style={{
        display: "grid",
        gridTemplateColumns: balance.supported ? "minmax(0, 1fr) auto" : "minmax(0, 1fr)",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: warning
          ? "color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 9%, var(--dsw-alias-bg-layer-1, #ffffff))"
          : DSH_COLORS.layer1,
        border: warning
          ? "1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 42%, transparent)"
          : `1px solid ${DSH_COLORS.border1}`,
        borderRadius: 8,
        minWidth: 0,
      }}
    >
      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: DSH_COLORS.secondary }}>
          {balance.providerName}
        </span>
        <strong
          style={{
            color: warning ? "var(--dsw-alias-state-warn-primary, #b45309)" : DSH_COLORS.primary,
            fontSize: balance.supported ? 20 : 13,
            lineHeight: 1.35,
            fontWeight: 750,
            fontVariantNumeric: "tabular-nums",
            overflowWrap: "anywhere",
          }}
        >
          {balance.total?.label ?? "暂不可用"}
        </strong>
        <span style={{ fontSize: 10, color: DSH_COLORS.secondary, overflowWrap: "anywhere" }}>
          {warning
            ? `低于 ${balance.rechargeThresholdLabel ?? "5"}，请及时充值`
            : balance.status === "stale" || balance.status === "expired"
              ? "余额快照已过期"
              : "API 账户"}
        </span>
      </div>
      {balance.rechargeUrl ? (
        <a
          href={balance.rechargeUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 28,
            padding: "0 2px",
            color: ACTION_LINK_COLOR,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "underline",
            textUnderlineOffset: 2,
            whiteSpace: "nowrap",
          }}
        >
          去充值
        </a>
      ) : null}
    </article>
  );
}

function NativeSessionStagePanel({ stage, isHistorical }: { stage: SessionStageView; isHistorical: boolean }) {
  const tokenBreakdown = buildTokenCostBreakdown(stage.tokenBuckets);
  const hasUnknownCost = stage.unknownCount > 0 || stage.status === "unknown";
  const stageTotalLabel = formatUnknownTotalLabel(stage.sessionTotal.label, stage.sessionTotal.microCny, hasUnknownCost);
  const priceCurrencyLabel = stage.currency === "USD"
    ? "美元"
    : stage.currency === "CNY" || !stage.currency
      ? "元"
      : stage.currency;
  const tokenRows = [
    { bucket: tokenBreakdown.cacheMiss, accent: TOKEN_DETAIL_COLORS.cacheMiss },
    { bucket: tokenBreakdown.cacheHit, accent: TOKEN_DETAIL_COLORS.cacheHit },
    { bucket: tokenBreakdown.output, accent: TOKEN_DETAIL_COLORS.output },
  ] as const;

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      <StageMetadataPanel stage={stage} />

      <div
        style={{
          background: DSH_COLORS.layer1,
          borderRadius: 8,
          border: `1px solid ${DSH_COLORS.border2}`,
          borderTop: `2px solid ${TOKEN_DETAIL_COLORS.accentBorder}`,
          padding: "8px 9px 7px",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: 11 }}>
          <caption
            style={{
              textAlign: "left",
              fontSize: 10,
              fontWeight: 700,
              color: TOKEN_DETAIL_COLORS.accent,
              padding: "1px 0 6px",
              letterSpacing: "0.04em",
            }}
          >
            Token 计费明细 · {stage.pricingZoneLabel}
          </caption>
          <colgroup>
            <col style={{ width: "38%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr style={{ color: DSH_COLORS.tertiary, background: DSH_COLORS.layer1, fontSize: 9 }}>
              <th scope="col" style={{ textAlign: "left", padding: "2px 0", fontWeight: 600 }}>计费项</th>
              <th scope="col" style={{ textAlign: "right", padding: "2px 4px", fontWeight: 600 }}>Token</th>
              <th
                scope="col"
                aria-label={`单价（${priceCurrencyLabel}/百万 Token）`}
                style={{ textAlign: "right", padding: "2px 4px", fontWeight: 600, lineHeight: 1.2 }}
              >
                <span style={{ display: "block" }}>单价</span>
                <span aria-hidden="true" style={{ display: "block", fontSize: 8, fontWeight: 500 }}>{priceCurrencyLabel}/百万 Token</span>
              </th>
              <th scope="col" style={{ textAlign: "right", padding: "2px 0", fontWeight: 600 }}>费用</th>
            </tr>
          </thead>
          <tbody>
            {tokenRows.map(({ bucket, accent }) => (
              <tr key={bucket.label} style={{ background: DSH_COLORS.layer1, borderBottom: `1px solid ${DSH_COLORS.border2}` }}>
                <th scope="row" style={{ textAlign: "left", padding: "4px 0", fontWeight: 600, color: DSH_COLORS.secondary }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 3,
                      height: 12,
                      marginRight: 6,
                      borderRadius: 2,
                      background: accent,
                      verticalAlign: "-2px",
                    }}
                  />
                  {formatTokenBucketLabel(bucket.label)}
                </th>
                <td style={{ textAlign: "right", padding: "4px", fontVariantNumeric: "tabular-nums", color: DSH_COLORS.secondary }}>
                  {bucket.tokens.toLocaleString("en-US")}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "4px",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                    color: DSH_COLORS.secondary,
                  }}
                >
                  {bucket.unitPriceMixed ? "混合" : bucket.unitPrice?.label ?? "--"}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "4px 0",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    color: DSH_COLORS.primary,
                  }}
                >
                  {formatTokenCostAmount(bucket.amount.label, bucket.amount.microCny, hasUnknownCost)}
                </td>
              </tr>
            ))}
            <tr style={{ color: DSH_COLORS.secondary, background: DSH_COLORS.layer1, borderTop: `1px solid ${TOKEN_DETAIL_COLORS.derivedBorder}` }}>
              <th scope="row" style={{ textAlign: "left", padding: "4px 0 4px 8px", fontWeight: 500 }}>
                推理 Token
              </th>
              <td style={{ textAlign: "right", padding: "4px", fontVariantNumeric: "tabular-nums" }}>
                {formatTokenCount(tokenBreakdown.reasoning.tokens)}
              </td>
              <td style={{ textAlign: "right", padding: "4px", fontSize: 10, whiteSpace: "nowrap" }}>同输出</td>
              <td style={{ textAlign: "right", padding: "4px 0", fontSize: 10, color: DSH_COLORS.tertiary }}>已包含</td>
            </tr>
            <tr style={{ color: DSH_COLORS.secondary, background: DSH_COLORS.layer1, borderBottom: `1px solid ${TOKEN_DETAIL_COLORS.derivedBorder}` }}>
              <th scope="row" style={{ textAlign: "left", padding: "4px 0 4px 8px", fontWeight: 500 }}>
                非推理 Token
              </th>
              <td style={{ textAlign: "right", padding: "4px", fontVariantNumeric: "tabular-nums" }}>
                {tokenBreakdown.nonReasoningTokens === null
                  ? "无法推导"
                  : formatTokenCount(tokenBreakdown.nonReasoningTokens)}
              </td>
              <td style={{ textAlign: "right", padding: "4px", fontSize: 10, whiteSpace: "nowrap" }}>
                {tokenBreakdown.nonReasoningTokens === null ? "--" : "同输出"}
              </td>
              <td
                style={{
                  textAlign: "right",
                  padding: "4px 0",
                  fontSize: 10,
                  color: tokenBreakdown.nonReasoningTokens === null ? TOKEN_DETAIL_COLORS.anomaly : DSH_COLORS.tertiary,
                  fontWeight: tokenBreakdown.nonReasoningTokens === null ? 700 : 500,
                }}
              >
                {tokenBreakdown.nonReasoningTokens === null ? "数据异常" : "推导值"}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `1px solid ${TOKEN_DETAIL_COLORS.accentBorder}`, background: DSH_COLORS.layer1 }}>
              <th scope="row" style={{ textAlign: "left", padding: "6px 0", fontWeight: 700, color: DSH_COLORS.primary }}>总 Token</th>
              <td style={{ textAlign: "right", padding: "6px 4px", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: DSH_COLORS.primary }}>
                {formatTokenCount(tokenBreakdown.totalTokens)}
              </td>
              <td style={{ textAlign: "right", padding: "6px 4px", fontSize: 10, color: TOKEN_DETAIL_COLORS.note }}>混合</td>
              <td style={{ textAlign: "right", padding: "6px 0", fontWeight: 800, color: TOKEN_DETAIL_COLORS.total }}>{stageTotalLabel}</td>
            </tr>
          </tfoot>
        </table>
        <p style={{ margin: "6px 0 1px", paddingLeft: 7, borderLeft: `2px solid ${TOKEN_DETAIL_COLORS.accentBorder}`, fontSize: 9, color: TOKEN_DETAIL_COLORS.note }}>
          推理 Token 已包含在输出费用中，不重复计费
        </p>
      </div>

      {contextBreakdownRows(stage.contextBreakdown, isHistorical ? "历史快照暂不可用" : "暂不可用")}

      <strong style={{ fontSize: 10, color: DSH_COLORS.secondary }}>轮次明细</strong>
      <ol
        style={{
          display: "grid",
          gap: 4,
          margin: 0,
          padding: 0,
          listStyle: "none",
          maxHeight: 140,
          overflowY: "auto",
        }}
      >
        {stage.turns.length > 0 ? (
          stage.turns.map((turn) => (
            <li
              key={turn.id}
              style={{
                padding: "4px 8px",
                background: DSH_COLORS.layer2,
                borderRadius: 4,
                border: `1px solid ${DSH_COLORS.border2}`,
                fontSize: 10,
                fontVariantNumeric: "tabular-nums",
                color: DSH_COLORS.secondary,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
                <strong style={{ color: DSH_COLORS.primary, minWidth: 0, overflowWrap: "anywhere" }}>
                  {formatTurnSequenceLabel(turn.label)}
                </strong>
                <span style={{ minWidth: 0, textAlign: "right", overflowWrap: "anywhere" }}>
                  {formatTurnPricingZone(turn.pricingZone)} · {formatStatusLabel(turn.status)} · {turn.amount.label}
                </span>
              </div>
              <div style={{ marginTop: 3, lineHeight: 1.5 }}>
                无缓存 {formatTokenCount(turn.cacheMissTokens)} · 缓存 {formatTokenCount(turn.cacheHitTokens)} · 输出{" "}
                {formatTokenCount(turn.outputTokens)} · 推理 {formatTokenCount(turn.reasoningTokens)}
              </div>
            </li>
          ))
        ) : (
          <li
            style={{
              padding: "4px 8px",
              background: DSH_COLORS.layer2,
              borderRadius: 4,
              border: `1px solid ${DSH_COLORS.border2}`,
              fontSize: 10,
              color: DSH_COLORS.secondary,
            }}
          >
            暂无请求明细。
          </li>
        )}
      </ol>
    </div>
  );
}

function formatTurnPricingZone(zone: "peak" | "offpeak" | "unknown"): string {
  if (zone === "peak") return "高峰时段";
  if (zone === "offpeak") return "空闲时段";
  return "不适用";
}

function formatTurnSequenceLabel(label: string): string {
  const normalized = label.trim();
  const sequence = /^(?:#|轮次\s*|turn[-_\s]*)?(\d+)$/i.exec(normalized)?.[1];
  if (sequence) return `#${sequence}`;
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}

function formatTokenCostAmount(label: string, microCny: number, hasUnknownCost: boolean): string {
  if (!hasUnknownCost) return label;
  return microCny > 0 ? `${label}（估算）` : "¥0.000（估算）";
}

function formatUnknownTotalLabel(label: string, microCny: number, hasUnknownCost: boolean): string {
  if (!hasUnknownCost) return label;
  return microCny > 0 ? `${label}（估算）` : "¥0.000（估算）";
}

export function SettingsPanel({
  store,
}: {
  store: MyMeterStore;
  onClose?: () => void;
}) {
  const state = useMyMeterStoreState(store);

  const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 10px",
    background: DSH_COLORS.layer1,
    border: `1px solid ${DSH_COLORS.border1}`,
    borderRadius: 8,
    fontSize: 12,
    color: DSH_COLORS.primary,
  };

  const inputStyle = {
    padding: "4px 8px",
    background: DSH_COLORS.layer2,
    border: `1px solid ${DSH_COLORS.border1}`,
    borderRadius: 6,
    color: DSH_COLORS.primary,
    fontSize: 12,
    outline: "none",
  };

  return (
    <section aria-label="设置" style={{ display: "grid", gap: 8 }}>
      <label style={rowStyle}>
        <span style={{ fontWeight: 500 }}>减少动画</span>
        <input
          type="checkbox"
          checked={state.settings.reducedMotion}
          onChange={(event) => store.setReducedMotion(event.target.checked)}
          style={{ width: 16, height: 16, cursor: "pointer", accentColor: DSH_COLORS.brand }}
        />
      </label>

      <label style={rowStyle}>
        <span style={{ fontWeight: 500 }}>默认静音</span>
        <input
          type="checkbox"
          checked={state.settings.muted}
          onChange={(event) => store.setMuted(event.target.checked)}
          style={{ width: 16, height: 16, cursor: "pointer", accentColor: DSH_COLORS.brand }}
        />
      </label>

      <label style={rowStyle}>
        <span style={{ fontWeight: 500 }}>余额刷新</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="number"
            min={5}
            step={5}
            value={state.settings.refreshIntervalMs / 1000}
            onChange={(event) => store.setRefreshIntervalMs(Number(event.target.value) * 1000)}
            style={{ ...inputStyle, width: 64, textAlign: "right" }}
          />
          <span style={{ color: DSH_COLORS.secondary }}>秒</span>
        </div>
      </label>

      <label style={rowStyle}>
        <span style={{ fontWeight: 500 }}>预算阈值</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="number"
            min={0}
            step={0.001}
            value={state.settings.budgetThresholdMicroCny / 1_000_000}
            onChange={(event) =>
              store.setBudgetThresholdMicroCny(Math.round(Number(event.target.value) * 1_000_000))
            }
            style={{ ...inputStyle, width: 80, textAlign: "right" }}
          />
          <span style={{ color: DSH_COLORS.secondary }}>元</span>
        </div>
      </label>

      <button
        type="button"
        onClick={() => store.resetSettings()}
        style={{
          marginTop: 4,
          padding: "8px 12px",
          background: "color-mix(in srgb, var(--dsw-alias-state-error-primary, #dc2626) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #dc2626) 30%, transparent)",
          borderRadius: 8,
          color: "var(--dsw-alias-state-error-primary, #dc2626)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        恢复默认
      </button>
    </section>
  );
}

export function MyMeterSettingsCard({ store }: { store: MyMeterStore }) {
  const [open, setOpen] = useState(false);
  const action = open ? "收起" : "展开";

  return (
    <li
      data-testid="mymeter-settings-card"
      style={{
        listStyle: "none",
        overflow: "hidden",
        border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
        borderRadius: 10,
        background: "var(--dsw-alias-bg-layer-2, #ffffff)",
        color: "var(--dsw-alias-label-primary, #111827)",
        boxShadow: "0 2px 8px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 8%, transparent)",
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${action} Token计费 配置`}
        onClick={() => setOpen((value) => !value)}
        style={{
          width: "100%",
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          border: 0,
          background: "transparent",
          color: "inherit",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
          <strong style={{ fontSize: 15, lineHeight: 1.4 }}>Token计费</strong>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary, #6b7280)" }}>
            跟随 DSH 全局主题，配置动效、刷新与预算偏好
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            flex: "0 0 auto",
            borderRight: "2px solid currentColor",
            borderBottom: "2px solid currentColor",
            transform: open ? "rotate(225deg)" : "rotate(45deg)",
            transition: "transform 160ms ease",
          }}
        />
      </button>
      {open ? (
        <div
          style={{
            margin: "0 16px",
            padding: "14px 0 16px",
            borderTop: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
          }}
        >
          <SettingsPanel store={store} />
        </div>
      ) : null}
    </li>
  );
}
