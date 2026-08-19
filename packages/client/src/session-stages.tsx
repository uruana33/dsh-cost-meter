import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";

import { formatTokenCount } from "./format";
import { buildTokenCostBreakdown } from "./token-breakdown";
import type { ContextBreakdownView, PricingZone, SessionDetailView, SessionStageView } from "./view-model";

const DSH_COLORS = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  tertiary: "var(--dsw-alias-label-tertiary, #6b7280)",
  base: "var(--dsw-alias-bg-base, #ffffff)",
  layer2: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)",
  border2: "var(--dsw-alias-border-l2, #e5e7eb)",
  brand: "var(--dsw-alias-brand-primary, #2563eb)",
} as const;

const CURRENT_STAGE_COLOR = "#2563eb";

const PRICING_COLORS: Record<PricingZone, string> = {
  peak: "var(--dsw-alias-state-warn-primary, #b45309)",
  offpeak: "var(--dsw-alias-state-success-primary, #0f766e)",
  unknown: DSH_COLORS.brand,
};

export function SessionStageTabs({
  detail,
  children,
  idPrefix = `mymeter-stage-${detail.id}`,
}: {
  detail: SessionDetailView;
  children: (stage: SessionStageView, isHistorical: boolean) => ReactNode;
  idPrefix?: string;
}): ReactNode {
  const stages = useMemo(() => getSessionStages(detail), [detail]);
  const currentStageId = selectedDefaultStageId(stages);
  const [selectedStageId, setSelectedStageId] = useState(currentStageId);
  const [helpPinned, setHelpPinned] = useState(false);
  const [helpHovered, setHelpHovered] = useState(false);

  useEffect(() => setSelectedStageId(currentStageId), [currentStageId]);

  useEffect(() => {
    if (!stages.some((stage) => stage.id === selectedStageId)) {
      setSelectedStageId(currentStageId);
    }
  }, [currentStageId, selectedStageId, stages]);

  const selectedStage = stages.find((stage) => stage.id === selectedStageId) ?? stages.at(-1);
  if (!selectedStage) return null;

  const panelId = `${idPrefix}-panel-${selectedStage.id}`;
  const tabId = `${idPrefix}-tab-${selectedStage.id}`;
  const helpId = `${idPrefix}-help`;
  const helpOpen = helpPinned || helpHovered;

  const selectStageByKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + stages.length) % stages.length;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % stages.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = stages.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextStage = stages[nextIndex];
    if (!nextStage) return;
    setSelectedStageId(nextStage.id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[nextIndex]?.focus();
  };

  return (
    <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 4, minWidth: 0, position: "relative" }}>
        <div
          role="tablist"
          aria-label="计费分段"
          style={{
            display: "flex",
            flex: "1 1 auto",
            gap: 4,
            minWidth: 0,
            overflowX: "auto",
            overflowY: "hidden",
            paddingBottom: 2,
            scrollbarWidth: "thin",
            touchAction: "pan-x",
          }}
        >
          {stages.map((stage, index) => {
            const selected = stage.id === selectedStage.id;
            const accent = PRICING_COLORS[stage.pricingZone];
            return (
              <button
                key={stage.id}
                id={`${idPrefix}-tab-${stage.id}`}
                type="button"
                role="tab"
                aria-label={stageTabLabel(stage)}
                aria-selected={selected}
                aria-controls={`${idPrefix}-panel-${stage.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setSelectedStageId(stage.id)}
                onKeyDown={(event) => selectStageByKeyboard(event, index)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  flex: "0 0 auto",
                  maxWidth: 220,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: selected ? `1px solid ${accent}` : `1px solid ${DSH_COLORS.border1}`,
                  background: selected
                    ? `color-mix(in srgb, ${accent} 16%, ${DSH_COLORS.layer2})`
                    : DSH_COLORS.layer2,
                  color: DSH_COLORS.primary,
                  fontSize: 10,
                  fontWeight: selected ? 800 : 650,
                  fontVariantNumeric: "tabular-nums",
                  cursor: "pointer",
                }}
              >
                <span>{`计费段 #${stage.index}`}</span>
                {stage.isCurrent ? (
                  <span
                    aria-hidden="true"
                    style={{
                      padding: "2px 5px",
                      borderRadius: 4,
                      background: CURRENT_STAGE_COLOR,
                      color: DSH_COLORS.base,
                      fontSize: 9,
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    当前
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div style={{ flex: "0 0 22px", position: "relative" }}>
          <button
            type="button"
            aria-label="了解计费分段"
            aria-controls={helpId}
            aria-expanded={helpOpen}
            aria-describedby={helpOpen ? helpId : undefined}
            onMouseEnter={() => setHelpHovered(true)}
            onMouseLeave={() => setHelpHovered(false)}
            onFocus={() => setHelpHovered(true)}
            onBlur={() => {
              setHelpHovered(false);
              setHelpPinned(false);
            }}
            onClick={() => setHelpPinned((open) => !open)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              setHelpHovered(false);
              setHelpPinned(false);
            }}
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 22,
              height: 22,
              padding: 0,
              borderRadius: "50%",
              border: `1px solid ${DSH_COLORS.border1}`,
              background: DSH_COLORS.layer2,
              color: DSH_COLORS.secondary,
              fontSize: 12,
              fontWeight: 800,
              cursor: "help",
            }}
          >
            ?
          </button>
          {helpOpen ? (
            <div
              id={helpId}
              role="tooltip"
              style={{
                position: "absolute",
                zIndex: 20,
                top: 28,
                right: 0,
                width: "min(280px, calc(100vw - 40px))",
                boxSizing: "border-box",
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${DSH_COLORS.border1}`,
                background: DSH_COLORS.base,
                color: DSH_COLORS.primary,
                boxShadow: "0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 18%, transparent)",
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              费用会按连续且相同的计费配置分段汇总。模型、推理强度、Agent 预设、计费时段或价格版本发生变化时，会新建计费段；对话轮次和空闲时间不会单独分段。
            </div>
          ) : null}
        </div>
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={tabId} aria-label={stageTabLabel(selectedStage)} style={{ minWidth: 0 }}>
        {children(selectedStage, !selectedStage.isCurrent)}
      </div>
    </div>
  );
}

export function StageMetadataPanel({ stage }: { stage: SessionStageView }): ReactNode {
  const accent = PRICING_COLORS[stage.pricingZone];
  const rates = buildTokenCostBreakdown(stage.tokenBuckets);
  const items = [
    ["模型", displayStageMetadata(stage.model)],
    ["推理强度", displayStageMetadata(stage.reasoningEffort)],
    ["Agent预设", displayStageMetadata(stage.agentPreset)],
    ["价格版本", formatStagePriceVersion(stage.priceVersion)],
    ...(stage.exchangeRateLabel && !stage.currency ? [["计价汇率", stage.exchangeRateLabel] as const] : []),
  ] as const;

  return (
    <section
      aria-label="计费段信息"
      style={{
        display: "grid",
        gap: 8,
        minWidth: 0,
        padding: "10px 11px 9px",
        background: DSH_COLORS.layer2,
        border: `1px solid ${DSH_COLORS.border2}`,
        borderRadius: 8,
        color: DSH_COLORS.primary,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ color: DSH_COLORS.brand, fontSize: 12 }}>计费段信息</strong>
        <span
          style={{
            padding: "3px 6px",
            borderRadius: 4,
            background: stage.isCurrent ? CURRENT_STAGE_COLOR : "transparent",
            color: stage.isCurrent ? DSH_COLORS.base : DSH_COLORS.tertiary,
            fontSize: 10,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {stage.isCurrent ? "当前" : "已结束"}
        </span>
      </div>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
          gap: "8px 14px",
          minWidth: 0,
          margin: 0,
          paddingTop: 8,
          borderTop: `1px solid ${DSH_COLORS.border1}`,
        }}
      >
        {items.map(([label, value]) => (
          <div key={label} style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <dt style={{ color: DSH_COLORS.tertiary, fontSize: 10 }}>{label}</dt>
            <dd style={{ margin: 0, color: DSH_COLORS.primary, fontSize: 11, fontWeight: 700, overflowWrap: "anywhere" }}>
              {value}
            </dd>
          </div>
        ))}
        <div style={{ display: "grid", gap: 6, minWidth: 0, gridColumn: "1 / -1" }}>
          <dt style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ color: DSH_COLORS.tertiary, fontSize: 10 }}>当前费率</span>
            {stage.pricingZone !== "unknown" ? (
              <span
                style={{
                  padding: "2px 5px",
                  borderRadius: 4,
                  background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: accent,
                  fontSize: 9,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                {stage.pricingZoneLabel}
              </span>
            ) : null}
            <span style={{ marginLeft: "auto", color: DSH_COLORS.tertiary, fontSize: 9 }}>{stage.currency === "USD" ? "美元" : stage.currency === "CNY" || !stage.currency ? "元" : stage.currency} / 百万 Token</span>
          </dt>
          <dd
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 6,
              margin: 0,
            }}
          >
            {[
              ["输入", formatStageRate(rates.cacheMiss)],
              ["缓存", formatStageRate(rates.cacheHit)],
              ["输出", formatStageRate(rates.output)],
            ].map(([label, value]) => (
              <span
                key={label}
                style={{
                  display: "grid",
                  gap: 2,
                  minWidth: 0,
                  padding: "5px 6px",
                  borderRadius: 4,
                  border: `1px solid ${DSH_COLORS.border2}`,
                  background: DSH_COLORS.base,
                }}
              >
                <span style={{ color: DSH_COLORS.tertiary, fontSize: 9 }}>{label}</span>
                <strong style={{ color: DSH_COLORS.primary, fontSize: 11, overflowWrap: "anywhere" }}>{value}</strong>
              </span>
            ))}
          </dd>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            gridColumn: "1 / -1",
            paddingTop: 8,
            borderTop: `1px solid ${DSH_COLORS.border2}`,
          }}
        >
          <dt style={{ color: DSH_COLORS.tertiary, fontSize: 10 }}>时间范围</dt>
          <dd style={{ margin: 0, color: DSH_COLORS.secondary, fontSize: 11, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>
            {formatStageTimeRange(stage)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function contextBreakdownRows(
  contextBreakdown: ContextBreakdownView | null,
  unavailableLabel = "暂不可用",
): ReactNode {
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        minWidth: 0,
        marginTop: 6,
        paddingTop: 8,
        borderTop: `1px solid ${DSH_COLORS.border2}`,
      }}
    >
      <strong style={{ fontSize: 10, color: DSH_COLORS.secondary }}>上下文构成（估算）</strong>
      {contextBreakdown ? (
        <>
          {infoLine("系统提示词", `${formatTokenCount(contextBreakdown.systemTokens)} Token`)}
          {infoLine("工具定义", `${formatTokenCount(contextBreakdown.toolsTokens)} Token`)}
          {infoLine("会话消息", `${formatTokenCount(contextBreakdown.messageTokens)} Token`)}
          <span style={{ fontSize: 9, color: DSH_COLORS.tertiary }}>估算值，不参与费用计算</span>
        </>
      ) : (
        <span style={{ fontSize: 10, color: DSH_COLORS.tertiary }}>{unavailableLabel}</span>
      )}
    </div>
  );
}

function infoLine(label: string, value: string): ReactNode {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, minWidth: 0, fontSize: 11 }}>
      <span style={{ color: DSH_COLORS.secondary }}>{label}</span>
      <strong style={{ color: DSH_COLORS.primary, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}</strong>
    </div>
  );
}

function getSessionStages(detail: SessionDetailView): SessionStageView[] {
  return detail.stages.length > 0 ? detail.stages : [stageFromDetail(detail)];
}

function stageTabLabel(stage: SessionStageView): string {
  return `计费段 #${stage.index}${stage.isCurrent ? " 当前" : ""}`;
}

function selectedDefaultStageId(stages: SessionStageView[]): string {
  return (stages.find((stage) => stage.isCurrent) ?? stages.at(-1))?.id ?? "stage-1";
}

function displayStageMetadata(value: string): string {
  return value.trim().toLowerCase() === "unknown" || value.trim() === "" ? "待确认" : value;
}

function formatStagePriceVersion(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "unknown" ? "-" : value;
}

function formatStageRate(bucket: SessionStageView["tokenBuckets"][number]): string {
  if (bucket.unitPriceMixed) return "混合";
  return bucket.unitPrice?.label ?? "-";
}

function formatStageTimeRange(stage: SessionStageView): string {
  return `${formatStageClock(stage.startedAt)} - ${stage.completedAt ? formatStageClock(stage.completedAt) : "当前"}`;
}

function formatStageClock(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "时间不可用";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function stageFromDetail(detail: SessionDetailView): SessionStageView {
  const lastTurn = detail.turns.at(-1);
  return {
    id: `${detail.id}-stage-current`,
    index: 1,
    isCurrent: true,
    startedAt: detail.turns[0]?.startedAt ?? "",
    completedAt: lastTurn?.completedAt ?? null,
    lastActivityAt: lastTurn?.completedAt ?? lastTurn?.startedAt ?? "",
    status: detail.status,
    model: detail.model,
    reasoningEffort: detail.reasoningEffort,
    agentPreset: detail.agentPreset,
    pricingZone: detail.pricingZone,
    pricingZoneLabel: detail.pricingZoneLabel,
    priceVersion: "",
    exchangeRateLabel: null,
    currentRequest: detail.currentRequest,
    sessionTotal: detail.sessionTotal,
    settledTotal: detail.settledTotal,
    estimatedTotal: detail.estimatedTotal,
    unknownCount: detail.unknownCount,
    tokenBuckets: detail.tokenBuckets,
    turns: detail.turns,
    contextBreakdown: detail.contextBreakdown,
    currency: detail.sessionTotal.currency ?? "CNY",
  };
}
