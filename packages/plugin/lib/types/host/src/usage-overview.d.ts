import { type UsageOverviewOptions, type UsageOverviewReport } from "../../core/src/index";
import { type CostEventRepository } from "./ledger.js";
import type { CostEventInput } from "./types.js";
export type { UsageOverviewOptions, UsageOverviewReport };
export declare function createHostUsageOverview(source: readonly CostEventInput[] | CostEventRepository, options?: UsageOverviewOptions): UsageOverviewReport;
