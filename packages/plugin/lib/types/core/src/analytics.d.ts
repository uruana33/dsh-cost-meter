export type CostAnalyticsStatus = "estimated" | "settled" | "unknown" | "failed";
export type CostAnalyticsPricingZone = "peak" | "offpeak" | "unknown";
export type CostAnalyticsAnomalySeverity = "info" | "warning";
export type CostAnalyticsAnomalyRuleId = "daily_spend_spike" | "hourly_spend_concentration" | "unknown_rate_high" | "failed_rate_high";
export interface CostAnalyticsEventInput {
    readonly id?: string | undefined;
    readonly sessionId?: string | undefined;
    readonly requestStartedAt: string;
    readonly amountMicroCny: number;
    readonly status?: CostAnalyticsStatus | undefined;
    readonly pricingZone?: CostAnalyticsPricingZone | undefined;
}
export interface CostAnalyticsOptions {
    readonly now?: string | (() => string);
    readonly recentBucketLimit?: number;
    readonly dailySpikeBaselineBuckets?: number;
    readonly dailySpikeRatio?: number;
    readonly dailySpikeMinDeltaMicroCny?: number;
    readonly hourlyConcentrationRatio?: number;
    readonly minimumRequestsForRateAnomaly?: number;
    readonly unknownRateThreshold?: number;
    readonly failedRateThreshold?: number;
}
export interface CostAnalyticsStatusCounts {
    readonly estimated: number;
    readonly settled: number;
    readonly unknown: number;
    readonly failed: number;
}
export interface CostAnalyticsTrendBucket {
    readonly key: string;
    readonly startAt: string;
    readonly endAt: string;
    readonly amountMicroCny: number;
    readonly requestCount: number;
    readonly statusCounts: CostAnalyticsStatusCounts;
    readonly peakMicroCny: number;
    readonly offpeakMicroCny: number;
    readonly previousAmountMicroCny: number | null;
    readonly deltaMicroCny: number | null;
    readonly deltaRatio: number | null;
}
export interface CostAnalyticsTotal {
    readonly totalMicroCny: number;
    readonly requestCount: number;
    readonly statusCounts: CostAnalyticsStatusCounts;
    readonly peakMicroCny: number;
    readonly offpeakMicroCny: number;
}
export interface CostAnalyticsSessionSummary extends CostAnalyticsTotal {
    readonly sessionId: string;
}
export interface CostAnalyticsAnomaly {
    readonly ruleId: CostAnalyticsAnomalyRuleId;
    readonly severity: CostAnalyticsAnomalySeverity;
    readonly bucketKey: string;
    readonly observedMicroCny?: number | undefined;
    readonly baselineMicroCny?: number | undefined;
    readonly observedCount?: number | undefined;
    readonly baselineCount?: number | undefined;
    readonly ratio?: number | undefined;
    readonly threshold: number;
    readonly explanation: string;
}
export interface CostAnalyticsReport {
    readonly generatedAt: string;
    readonly global: CostAnalyticsTotal;
    readonly sessions: CostAnalyticsSessionSummary[];
    readonly dailyTrend: CostAnalyticsTrendBucket[];
    readonly hourlyTrend: CostAnalyticsTrendBucket[];
    readonly anomalies: CostAnalyticsAnomaly[];
}
export declare function createCostAnalyticsReport(events: readonly CostAnalyticsEventInput[], options?: CostAnalyticsOptions): CostAnalyticsReport;
