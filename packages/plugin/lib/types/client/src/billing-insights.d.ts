import type { AmountView, BillingInsightsView, BudgetInsightView, CacheSavingsInsightView, PricingZone, PricingZoneCountdownView, TokenBucketView } from "./view-model";
export declare function deriveBillingInsights(input: {
    tokenBuckets?: readonly TokenBucketView[] | undefined;
    spent: AmountView;
    budgetThresholdMicroCny: number;
    budgetAvailable?: boolean | undefined;
    pricingZone: PricingZone;
    scopeLabel: "本地累计" | "会话费用";
    now?: Date | undefined;
}): BillingInsightsView;
export declare function deriveCacheSavings(tokenBuckets: readonly TokenBucketView[]): CacheSavingsInsightView;
export declare function deriveBudgetInsight(input: {
    spent: AmountView;
    budgetThresholdMicroCny: number;
    available?: boolean | undefined;
    scopeLabel: "本地累计" | "会话费用";
}): BudgetInsightView;
export declare function derivePricingZoneCountdown(pricingZone: PricingZone, now: Date): PricingZoneCountdownView;
