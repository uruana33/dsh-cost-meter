import { type ReactNode } from "react";
import type { UsageOverviewView } from "./view-model";
export type AnalyticsRange = "today" | "7d" | "30d";
type TrendBucket = UsageOverviewView["trend"][number];
export declare function AnalyticsChart({ range, trend, }: {
    range: AnalyticsRange;
    trend: readonly TrendBucket[];
}): ReactNode;
export {};
