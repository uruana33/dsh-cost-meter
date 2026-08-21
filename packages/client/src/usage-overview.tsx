import type { CSSProperties, ReactNode } from "react";

import { formatTokenCount } from "./format";
import type { UsageOverviewView } from "./view-model";

const DSH_COLORS = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  layer1: "var(--dsw-alias-bg-layer-1, #ffffff)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)",
} as const;

const sectionStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 6,
};

const itemStyle: CSSProperties = {
  minWidth: 0,
  padding: "7px 8px",
  border: `1px solid ${DSH_COLORS.border1}`,
  borderRadius: 6,
  background: DSH_COLORS.layer1,
};

const labelStyle: CSSProperties = {
  display: "block",
  color: DSH_COLORS.secondary,
  fontSize: 10,
  fontWeight: 700,
};

const valueStyle: CSSProperties = {
  display: "block",
  marginTop: 2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: DSH_COLORS.primary,
  fontSize: 12,
  fontWeight: 750,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

export function UsageOverview({ overview }: { overview: UsageOverviewView }): ReactNode {
  const items = [
    ["费用", overview.coverage === "unavailable" ? "—" : overview.total.label],
    ["Token", formatTokenCount(overview.totalTokens)],
    ["请求数", formatTokenCount(overview.requestCount)],
    ["Coverage", overview.coverage === "complete" ? "完整" : overview.coverage === "partial" ? "部分计价" : "不可用"],
  ] as const;

  return (
    <section aria-label="用量概览" style={{ display: "grid", gap: 6 }}>
      <div style={sectionStyle}>
        {items.map(([label, value]) => (
          <div key={label} style={itemStyle}>
            <span style={labelStyle}>{label}</span>
            <strong style={valueStyle}>{value}</strong>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        <strong style={{ color: DSH_COLORS.primary, fontSize: 11 }}>主要模型</strong>
        {overview.topModels.length === 0 ? (
          <span style={{ color: DSH_COLORS.secondary, fontSize: 11 }}>暂无模型用量。</span>
        ) : overview.topModels.slice(0, 3).map((model) => (
          <div key={`${model.provider}:${model.model}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, minWidth: 0, fontSize: 11 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: DSH_COLORS.secondary }}>
              {model.model} · {formatTokenCount(model.totalTokens)} Token
            </span>
            <span style={{ color: DSH_COLORS.primary, fontVariantNumeric: "tabular-nums" }}>
              {model.coverage === "unavailable" ? "—" : model.amount.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
