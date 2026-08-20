export type UsageOverviewRange = "today" | "7d" | "30d";
export type UsageOverviewCoverage = "complete" | "partial" | "unavailable";
export type UsageOverviewCostStatus = "estimated" | "settled" | "unknown" | "failed";
export interface UsageOverviewQuery {
    readonly range: UsageOverviewRange;
    readonly timeZone?: string | undefined;
}
export interface UsageOverviewOptions extends UsageOverviewQuery {
    readonly now?: string | Date | (() => string | Date) | undefined;
    readonly topModelLimit?: number | undefined;
}
export interface UsageOverviewEventInput {
    readonly requestStartedAt: string;
    readonly provider?: string | undefined;
    readonly model?: string | undefined;
    readonly status?: UsageOverviewCostStatus | undefined;
    readonly amountMicroCny?: number | undefined;
    readonly cacheHitTokens?: number | undefined;
    readonly cacheMissTokens?: number | undefined;
    readonly cacheWriteTokens?: number | undefined;
    readonly outputTokens?: number | undefined;
}
export interface UsageOverviewTotal {
    readonly amountMicroCny: number;
    readonly totalTokens: number;
    readonly requestCount: number;
    readonly pricedRequestCount: number;
    readonly unknownRequestCount: number;
    readonly coverage: UsageOverviewCoverage;
}
export interface UsageOverviewTrendBucket extends UsageOverviewTotal {
    readonly key: string;
    readonly startAt: string;
    readonly endAt: string;
}
export interface UsageOverviewModelSummary extends UsageOverviewTotal {
    readonly provider: string;
    readonly model: string;
}
export interface UsageOverviewReport {
    readonly range: UsageOverviewRange;
    readonly timeZone: string;
    readonly generatedAt: string;
    readonly startAt: string;
    readonly endAt: string;
    readonly totals: UsageOverviewTotal;
    readonly trend: UsageOverviewTrendBucket[];
    readonly topModels: UsageOverviewModelSummary[];
}
export declare function createUsageOverview(events: readonly UsageOverviewEventInput[], options?: UsageOverviewOptions): UsageOverviewReport;
