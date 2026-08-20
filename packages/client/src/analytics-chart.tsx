import { useState, type CSSProperties, type ReactNode } from "react";

import type { UsageOverviewView } from "./view-model";

export type AnalyticsRange = "today" | "7d" | "30d";

const DSH_COLORS = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  tertiary: "var(--dsw-alias-label-tertiary, #6b7280)",
  layer1: "var(--dsw-alias-bg-layer-1, #ffffff)",
  layer2: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)",
  brand: "var(--dsw-alias-brand-primary, #2563eb)",
} as const;

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "8px 8px 6px",
  border: `1px solid ${DSH_COLORS.border1}`,
  borderRadius: 6,
  background: DSH_COLORS.layer1,
};

const emptyStyle: CSSProperties = {
  margin: 0,
  padding: "16px 4px",
  color: DSH_COLORS.tertiary,
  fontSize: 11,
  textAlign: "center",
};

const labelRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(42px, 1fr))",
  gap: 4,
  color: DSH_COLORS.secondary,
  fontSize: 9,
  fontVariantNumeric: "tabular-nums",
};

type TrendBucket = UsageOverviewView["trend"][number];

function chartBuckets(range: AnalyticsRange, trend: readonly TrendBucket[]): readonly TrendBucket[] {
  return range === "today" ? trend.slice(-24) : trend.slice(range === "7d" ? -7 : -30);
}

function chartLabel(range: AnalyticsRange): string {
  if (range === "today") return "今日按小时费用趋势";
  return range === "7d" ? "7天按天费用趋势" : "30天按天费用趋势";
}

function bucketLabel(range: AnalyticsRange, key: string): string {
  if (range !== "today") return key;
  const hour = key.match(/T(\d{2})$/u)?.[1] ?? key.slice(-2);
  return `${hour}:00`;
}

function bucketAmount(bucket: TrendBucket): string {
  return bucket.coverage === "unavailable" ? "—" : bucket.amount.label;
}

export function AnalyticsChart({
  range,
  trend,
}: {
  range: AnalyticsRange;
  trend: readonly TrendBucket[];
}): ReactNode {
  const buckets = chartBuckets(range, trend);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const label = chartLabel(range);
  if (buckets.length === 0) {
    return (
      <section aria-label={label} style={shellStyle}>
        <p style={emptyStyle}>暂无趋势数据。</p>
      </section>
    );
  }

  const width = Math.max(320, buckets.length * 22);
  const height = 118;
  const padX = 8;
  const padTop = 10;
  const padBottom = 20;
  const plotHeight = height - padTop - padBottom;
  const slot = (width - padX * 2) / buckets.length;
  const barWidth = Math.max(4, Math.min(18, slot * 0.58));
  const maxAmount = Math.max(1, ...buckets.map((bucket) => bucket.amount.microCny));

  return (
    <section aria-label={label} style={shellStyle}>
      <div style={{ minWidth: 0, overflowX: "auto" }}>
      <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", width, minWidth: width, height: "auto" }}>
        <line x1={padX} x2={width - padX} y1={height - padBottom} y2={height - padBottom} stroke={DSH_COLORS.border1} />
        {buckets.map((bucket, index) => {
          const value = bucket.amount.microCny;
          const barHeight = Math.max(2, (value / maxAmount) * plotHeight);
          const x = padX + index * slot + (slot - barWidth) / 2;
          const y = height - padBottom - barHeight;
          const displayLabel = bucketLabel(range, bucket.key);
          return (
            <g key={bucket.key}>
              <title>{`${displayLabel} · ${bucketAmount(bucket)} · ${bucket.requestCount} 次`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={2}
                fill={selectedKey === bucket.key ? DSH_COLORS.primary : DSH_COLORS.brand}
                tabIndex={0}
                role="img"
                aria-label={`${displayLabel} ${bucketAmount(bucket)}，${bucket.totalTokens} Token，${bucket.requestCount} 次请求`}
                onFocus={() => setSelectedKey(bucket.key)}
                onClick={() => setSelectedKey(bucket.key)}
              />
              {index === buckets.length - 1 ? (
                <circle cx={x + barWidth / 2} cy={y} r={2.5} fill={DSH_COLORS.primary} />
              ) : null}
              <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" fill={DSH_COLORS.tertiary} fontSize="9">
                {displayLabel}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
      {selectedKey ? (
        <p style={{ margin: 0, color: DSH_COLORS.secondary, fontSize: 10, fontVariantNumeric: "tabular-nums" }}>
          {(() => {
            const bucket = buckets.find((item) => item.key === selectedKey);
            return bucket ? `${bucketLabel(range, bucket.key)} · ${bucketAmount(bucket)} · ${formatTokenLabel(bucket.totalTokens)} · ${bucket.requestCount} 次请求` : "";
          })()}
      </p>
      ) : null}
      <div style={labelRowStyle}>
        {buckets.slice(-3).map((bucket) => (
          <span key={bucket.key} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bucketLabel(range, bucket.key)} {bucketAmount(bucket)}
          </span>
        ))}
      </div>
    </section>
  );
}

function formatTokenLabel(tokens: number): string {
  return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(tokens)} Token`;
}
