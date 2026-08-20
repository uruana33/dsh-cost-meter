import {
  createUsageOverview,
  type UsageOverviewEventInput,
  type UsageOverviewOptions,
  type UsageOverviewReport,
} from "../../core/src/index";
import {
  createInMemoryCostEventRepository,
  type CostEventRepository,
} from "./ledger.js";
import type { CostEventInput } from "./types.js";

export type { UsageOverviewOptions, UsageOverviewReport };

export function createHostUsageOverview(
  source: readonly CostEventInput[] | CostEventRepository,
  options: UsageOverviewOptions = { range: "today" },
): UsageOverviewReport {
  const events = Array.isArray(source)
    ? createInMemoryCostEventRepository(source).list()
    : (source as CostEventRepository).list();
  return createUsageOverview(events.map(toUsageOverviewEvent), options);
}

function toUsageOverviewEvent(event: CostEventInput): UsageOverviewEventInput {
  return {
    requestStartedAt: event.requestStartedAt,
    provider: event.provider,
    model: event.model,
    status: event.status,
    amountMicroCny: event.amountMicroCny,
    cacheHitTokens: event.cacheHitTokens,
    cacheMissTokens: event.cacheMissTokens,
    cacheWriteTokens: event.cacheWriteTokens,
    outputTokens: event.outputTokens,
  };
}
