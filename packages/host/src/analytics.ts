import {
  createCostAnalyticsReport,
  type CostAnalyticsAnomaly,
  type CostAnalyticsEventInput,
  type CostAnalyticsOptions,
  type CostAnalyticsReport,
  type CostAnalyticsTrendBucket,
} from "../../core/src/index";
import {
  createInMemoryCostEventRepository,
  type CostEventRepository,
} from "./ledger.js";
import type { CostEventInput } from "./types.js";

export type {
  CostAnalyticsAnomaly,
  CostAnalyticsOptions,
  CostAnalyticsReport,
  CostAnalyticsTrendBucket,
};

export function createHostCostAnalyticsReport(
  source: readonly CostEventInput[] | CostEventRepository,
  options: CostAnalyticsOptions = {},
): CostAnalyticsReport {
  if (isCostEventInputArray(source)) {
    return createCostAnalyticsReport(
      createInMemoryCostEventRepository(source).list().map(toAnalyticsEvent),
      options,
    );
  }

  return createCostAnalyticsReport(source.list().map(toAnalyticsEvent), options);
}

function isCostEventInputArray(
  source: readonly CostEventInput[] | CostEventRepository,
): source is readonly CostEventInput[] {
  return Array.isArray(source);
}

function toAnalyticsEvent(event: CostEventInput): CostAnalyticsEventInput {
  return {
    id: event.id,
    sessionId: event.sessionId,
    requestStartedAt: event.requestStartedAt,
    amountMicroCny: event.amountMicroCny,
    status: event.status,
    pricingZone: event.pricingZone,
  };
}
