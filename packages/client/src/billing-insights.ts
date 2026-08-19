import { resolveDeepSeekPricingZoneCountdown } from "@mymeter/core";

import { createAmountView } from "./format";
import type {
  AmountView,
  BillingInsightsView,
  BudgetInsightView,
  CacheSavingsInsightView,
  PricingZone,
  PricingZoneCountdownView,
  TokenBucketView,
} from "./view-model";

export function deriveBillingInsights(input: {
  tokenBuckets?: readonly TokenBucketView[] | undefined;
  spent: AmountView;
  budgetThresholdMicroCny: number;
  budgetAvailable?: boolean | undefined;
  pricingZone: PricingZone;
  scopeLabel: "本地累计" | "会话费用";
  now?: Date | undefined;
}): BillingInsightsView {
  return {
    cacheSavings: deriveCacheSavings(input.tokenBuckets ?? []),
    budget: deriveBudgetInsight({
      spent: input.spent,
      budgetThresholdMicroCny: input.budgetThresholdMicroCny,
      available: input.budgetAvailable,
      scopeLabel: input.scopeLabel,
    }),
    pricingZoneCountdown: derivePricingZoneCountdown(input.pricingZone, input.now ?? new Date()),
  };
}

export function deriveCacheSavings(
  tokenBuckets: readonly TokenBucketView[],
): CacheSavingsInsightView {
  const cacheHit = tokenBuckets.find((bucket) => bucket.label === "缓存命中");
  const cacheMiss = tokenBuckets.find((bucket) => bucket.label === "缓存未命中");
  const currency = cacheHit?.unitPrice?.currency ?? cacheMiss?.unitPrice?.currency ?? "CNY";
  const unavailable = {
    available: false,
    tokens: cacheHit?.tokens ?? 0,
    amount: null,
    label: "暂不可用",
  } satisfies CacheSavingsInsightView;

  if (!cacheHit || !cacheMiss || cacheHit.tokens <= 0) return unavailable;
  if (!cacheHit.unitPrice || !cacheMiss.unitPrice || cacheHit.unitPriceMixed || cacheMiss.unitPriceMixed) {
    return unavailable;
  }
  if ((cacheHit.unitPrice.currency ?? "CNY") !== (cacheMiss.unitPrice.currency ?? "CNY")) {
    return unavailable;
  }

  const savedPerMillionTokens = Math.max(0, cacheMiss.unitPrice.microCny - cacheHit.unitPrice.microCny);
  const savedMinor = Math.round((cacheHit.tokens * savedPerMillionTokens) / 1_000_000);
  const amount = createAmountView(savedMinor, 3, currency);

  return {
    available: true,
    tokens: cacheHit.tokens,
    amount,
    label: amount.label,
  };
}

export function deriveBudgetInsight(input: {
  spent: AmountView;
  budgetThresholdMicroCny: number;
  available?: boolean | undefined;
  scopeLabel: "本地累计" | "会话费用";
}): BudgetInsightView {
  const threshold = createAmountView(input.budgetThresholdMicroCny);
  const comparableCurrency = !input.spent.currency || input.spent.currency === "CNY";
  const available = input.available ?? comparableCurrency;
  if (!available || !comparableCurrency) {
    return {
      level: "unavailable",
      available: false,
      spent: input.spent,
      threshold,
      ratio: null,
      percentLabel: null,
      message: null,
    };
  }

  if (input.budgetThresholdMicroCny <= 0) {
    return {
      level: "off",
      available: true,
      spent: input.spent,
      threshold,
      ratio: null,
      percentLabel: null,
      message: null,
    };
  }

  const ratio = input.spent.microCny / input.budgetThresholdMicroCny;
  const percentLabel = `${Math.round(ratio * 100)}%`;
  const level = ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : ratio >= 0.5 ? "notice" : "ok";
  const message =
    level === "danger"
      ? `${input.scopeLabel}已超过预算阈值 ${threshold.label}。`
      : level === "warning"
        ? `${input.scopeLabel}已达到预算阈值 ${percentLabel}。`
        : level === "notice"
          ? `${input.scopeLabel}已达到预算阈值 ${percentLabel}。`
          : null;

  return {
    level,
    available: true,
    spent: input.spent,
    threshold,
    ratio,
    percentLabel,
    message,
  };
}

export function derivePricingZoneCountdown(
  pricingZone: PricingZone,
  now: Date,
): PricingZoneCountdownView {
  const countdown = resolveDeepSeekPricingZoneCountdown({ now, pricingZone });
  return {
    currentZone: countdown.currentZone,
    currentZoneLabel: countdown.currentZoneLabel,
    nextZone: countdown.nextZone,
    nextZoneLabel: countdown.nextZoneLabel,
    transitionAt: countdown.transitionAt?.toISOString() ?? null,
    transitionTimeLabel: countdown.transitionTimeLabel,
    remainingMs: countdown.remainingMs,
    remainingLabel: countdown.remainingLabel,
  };
}
