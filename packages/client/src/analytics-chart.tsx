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
type TrendModel = TrendBucket["models"][number];

const MODEL_COLORS = [
  "var(--dsw-alias-brand-primary, #2563eb)",
  "var(--dsw-alias-state-success-primary, #059669)",
  "var(--dsw-alias-state-warning-primary, #d97706)",
  "var(--dsw-alias-state-error-primary, #dc2626)",
  "var(--dsw-alias-state-info-primary, #0891b2)",
  "var(--dsw-alias-label-secondary, #7c3aed)",
] as const;

function chartBuckets(range: AnalyticsRange, trend: readonly TrendBucket[]): readonly TrendBucket[] {
  return range === "today" ? trend.slice(-24) : trend.slice(range === "7d" ? -7 : -30);
}

function chartLabel(range: AnalyticsRange): string {
  if (range === "today") return "今日按小时费用趋势";
  return range === "7d" ? "7天按天费用趋势" : "30天按天费用趋势";
}

function bucketLabel(range: AnalyticsRange, key: string): string {
  if (range !== "today") {
    const date = key.match(/^\d{4}-(\d{2})-(\d{2})$/u);
    return date ? `${date[1]}-${date[2]}` : key;
  }
  const hour = key.match(/T(\d{2})$/u)?.[1] ?? key.slice(-2);
  return `${hour}:00`;
}

function bucketTooltipLabel(range: AnalyticsRange, key: string): string {
  if (range === "today") return bucketLabel(range, key);
  return key;
}

function modelKey(model: Pick<TrendModel, "provider" | "model">): string {
  return `${model.provider}\u0000${model.model}`;
}

function modelLabel(model: Pick<TrendModel, "provider" | "model">): string {
  return model.provider && model.provider !== "unknown" ? `${model.provider} · ${model.model}` : model.model;
}

function axisLabelStep(range: AnalyticsRange, bucketCount: number): number {
  if (bucketCount <= 8) return 1;
  if (range === "today") return 3;
  if (range === "7d") return 1;
  return Math.max(1, Math.ceil(bucketCount / 8));
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

  // Keep the drawing surface stable while the bucket count changes by range.
  const width = 640;
  const height = 132;
  const padX = 8;
  const padTop = 10;
  const padBottom = 22;
  const plotHeight = height - padTop - padBottom;
  const slot = (width - padX * 2) / buckets.length;
  const barWidth = Math.max(4, Math.min(32, slot * 0.58));
  const maxAmount = Math.max(1, ...buckets.map((bucket) => bucket.amount.microCny));
  const labelStep = axisLabelStep(range, buckets.length);
  const modelLegend = [...new Map(
    buckets
      .flatMap((bucket) => bucket.models)
      .filter((model) => model.amount.microCny > 0)
      .map((model) => [modelKey(model), model] as const),
  ).values()].sort((left, right) => modelKey(left).localeCompare(modelKey(right)));
  const modelColors = new Map(modelLegend.map((model, index) => [modelKey(model), MODEL_COLORS[index % MODEL_COLORS.length]]));

  return (
    <section aria-label={label} style={shellStyle}>
      <div style={{ minWidth: 0 }}>
      <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", width: "100%", height: "auto", aspectRatio: `${width} / ${height}` }}>
        <line x1={padX} x2={width - padX} y1={height - padBottom} y2={height - padBottom} stroke={DSH_COLORS.border1} />
        {buckets.map((bucket, index) => {
          const value = bucket.amount.microCny;
          const barHeight = value > 0 ? Math.max(2, (value / maxAmount) * plotHeight) : 2;
          const x = padX + index * slot + (slot - barWidth) / 2;
          const y = height - padBottom - barHeight;
          const displayLabel = bucketLabel(range, bucket.key);
          const modelSegments = bucket.models.filter((model) => model.amount.microCny > 0 && modelColors.has(modelKey(model)));
          const modelTotal = modelSegments.reduce((sum, model) => sum + model.amount.microCny, 0);
          const scale = modelTotal > value && modelTotal > 0 ? value / modelTotal : 1;
          let segmentBottom = height - padBottom;
          return (
            <g key={bucket.key}>
              <title>{`${bucketTooltipLabel(range, bucket.key)} · ${bucketAmount(bucket)} · ${bucket.requestCount} 次`}</title>
              {modelSegments.length === 0 ? (
                // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: SVG bar acts as an image with label; focus already selects the bucket for keyboard users.
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
              ) : (
                <>
                  {modelTotal < value ? (() => {
                    const remainderHeight = ((value - modelTotal) / maxAmount) * plotHeight;
                    segmentBottom -= remainderHeight;
                    return (
                      <rect
                        x={x}
                        y={segmentBottom}
                        width={barWidth}
                        height={remainderHeight}
                        rx={2}
                        fill={selectedKey === bucket.key ? DSH_COLORS.primary : DSH_COLORS.brand}
                        tabIndex={-1}
                        aria-hidden="true"
                        onFocus={() => setSelectedKey(bucket.key)}
                        onClick={() => setSelectedKey(bucket.key)}
                      />
                    );
                  })() : null}
                  {modelSegments.map((model, segmentIndex) => {
                    const segmentHeight = Math.max(1, ((model.amount.microCny * scale) / maxAmount) * plotHeight);
                    segmentBottom -= segmentHeight;
                    const modelName = modelLabel(model);
                    return (
                      // biome-ignore lint/a11y/noStaticElementInteractions: mouse-only hit area; keyboard users focus the labelled segment via tabIndex above.
                      <rect
                        key={modelKey(model)}
                        x={x}
                        y={segmentBottom}
                        width={barWidth}
                        height={segmentHeight}
                        rx={segmentIndex === modelSegments.length - 1 ? 2 : 0}
                        fill={selectedKey === bucket.key ? DSH_COLORS.primary : modelColors.get(modelKey(model))}
                        tabIndex={segmentIndex === 0 ? 0 : -1}
                        role={segmentIndex === 0 ? "img" : undefined}
                        aria-label={segmentIndex === 0 ? `${displayLabel} ${modelName} ${bucketAmount(bucket)}，${bucket.totalTokens} Token，${bucket.requestCount} 次请求` : undefined}
                        onFocus={() => setSelectedKey(bucket.key)}
                        onClick={() => setSelectedKey(bucket.key)}
                      />
                    );
                  })}
                </>
              )}
              {index === buckets.length - 1 ? (
                <circle cx={x + barWidth / 2} cy={y} r={2.5} fill={DSH_COLORS.primary} />
              ) : null}
              {index % labelStep === 0 || (range !== "today" && index === buckets.length - 1) ? (
                <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" fill={DSH_COLORS.tertiary} fontSize="9">
                  {displayLabel}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      </div>
      {modelLegend.length > 1 ? (
        <ul aria-label="模型图例" style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", margin: 0, padding: 0, listStyle: "none", color: DSH_COLORS.secondary, fontSize: 10 }}>
          {modelLegend.map((model) => (
            <li key={modelKey(model)} style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, flex: "0 0 auto", borderRadius: 2, background: modelColors.get(modelKey(model)) }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modelLabel(model)}</span>
            </li>
          ))}
        </ul>
      ) : null}
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
