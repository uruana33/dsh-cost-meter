import type { AmountView, MeterStatusCode, MeterTone } from "./view-model";

export function formatMicroCny(microCny: number, decimals = 3): string {
  return formatCurrencyMinor(microCny, "CNY", decimals);
}

export function formatCurrencyMinor(amountMinor: number, currency = "CNY", decimals = 3): string {
  if (amountMinor === 0) {
    return `${currencySymbol(currency)}0.${"0".repeat(decimals)}`;
  }

  const value = amountMinor / 1_000_000;
  const rounded = value.toFixed(decimals);
  if (Number(rounded) === 0) {
    return `<${currencySymbol(currency)}0.${"0".repeat(Math.max(1, decimals - 1))}1`;
  }

  return `${currencySymbol(currency)}${rounded}`;
}

function currencySymbol(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  return normalized === "USD" ? "$" : normalized === "CNY" || normalized === "" ? "¥" : `${normalized} `;
}

export function formatTokenCount(tokens: number): string {
  return new Intl.NumberFormat("en-US").format(tokens);
}

/**
 * Compact token formatting for tight layouts (the floating meter rows). Keeps
 * the full grouped form under 100k and switches to 万/亿 scales above it, so a
 * multi-million-token session still fits a narrow column without overflow.
 */
export function formatTokenCountCompact(tokens: number): string {
  if (!Number.isFinite(tokens)) return "0";
  const absolute = Math.abs(tokens);
  if (absolute < 100_000) {
    return formatTokenCount(tokens);
  }
  if (absolute < 100_000_000) {
    return `${trimTrailingZero((tokens / 10_000).toFixed(1))}万`;
  }
  return `${trimTrailingZero((tokens / 100_000_000).toFixed(2))}亿`;
}

function trimTrailingZero(value: string): string {
  let result = value;
  while (result.endsWith("0")) {
    result = result.slice(0, -1);
  }
  return result.endsWith(".") ? result.slice(0, -1) : result;
}

/**
 * Compact currency formatting for tight layouts: keeps full precision below
 * one unit, two decimals below 100 units, and rounds to integers above that,
 * so large totals stop widening fixed-width meter rows.
 */
export function formatCurrencyMinorCompact(amountMinor: number, currency = "CNY", decimals = 3): string {
  const value = Math.abs(amountMinor) / 1_000_000;
  const compactDecimals = value >= 100 ? 0 : value >= 1 ? Math.min(2, decimals) : decimals;
  return formatCurrencyMinor(amountMinor, currency, compactDecimals);
}

export function formatTokenBucketLabel(label: string): string {
  if (label === "缓存未命中") {
    return "输入 Token(无缓存)";
  }
  if (label === "缓存命中") {
    return "输入 Token(缓存)";
  }
  if (label === "输出") {
    return "输出 Token";
  }
  return label;
}

export function createAmountView(microCny: number, decimals = 3, currency = "CNY"): AmountView {
  return {
    microCny,
    label: formatCurrencyMinor(microCny, currency, decimals),
    detailLabel: formatCurrencyMinor(microCny, currency, 6),
    ...(currency.trim().toUpperCase() !== "CNY" ? { currency: currency.trim().toUpperCase() } : {}),
  };
}

export function createUnknownAmountView(label = "¥0.000（估算）"): AmountView {
  return {
    microCny: 0,
    label,
    detailLabel: "¥0.000000（估算）",
  };
}

export function createUnavailableAmountView(label = "不可用"): AmountView {
  return {
    microCny: 0,
    label,
    detailLabel: label,
  };
}

export function formatStatusLabel(code: MeterStatusCode): string {
  const labels: Record<MeterStatusCode, string> = {
    idle: "空闲",
    billing: "计费中",
    settled: "已结算",
    unknown: "费用估算",
    balance_expired: "余额过期",
    balance_insufficient: "余额不足",
    failed: "失败",
    aborted: "已中止",
  };

  return labels[code];
}

export function formatTone(code: MeterStatusCode): MeterTone {
  if (code === "failed" || code === "aborted") {
    return "danger";
  }

  if (code === "balance_expired" || code === "balance_insufficient" || code === "unknown") {
    return "warning";
  }

  if (code === "billing") {
    return "info";
  }

  if (code === "settled") {
    return "success";
  }

  return "neutral";
}
