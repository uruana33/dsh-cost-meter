import { type CostAnalyticsAnomaly, type CostAnalyticsOptions, type CostAnalyticsReport, type CostAnalyticsTrendBucket } from "../../core/src/index";
import { type CostEventRepository } from "./ledger.js";
import type { CostEventInput } from "./types.js";
export type { CostAnalyticsAnomaly, CostAnalyticsOptions, CostAnalyticsReport, CostAnalyticsTrendBucket, };
export declare function createHostCostAnalyticsReport(source: readonly CostEventInput[] | CostEventRepository, options?: CostAnalyticsOptions): CostAnalyticsReport;
