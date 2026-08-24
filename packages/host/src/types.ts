export type CostEventStatus = "estimated" | "settled" | "unknown" | "failed";
export type CostCurrency = "CNY" | "USD" | (string & {});
export type CostEventSource = "stream" | "final_usage" | "restored" | "projection";
export type PricingZone = "peak" | "offpeak" | "unknown";
export type CostRequestOutcome = "success" | "failed" | "aborted";

export interface CostEventInput {
  id: string;
  sessionId: string;
  requestStartedAt: string;
  status: CostEventStatus;
  amountMicroCny: number;
  currency?: CostCurrency | undefined;
  amountMinor?: number | undefined;
  cacheHitMinor?: number | undefined;
  cacheMissMinor?: number | undefined;
  outputMinor?: number | undefined;
  cacheHitRateMinorPerMillionTokens?: number | undefined;
  cacheMissRateMinorPerMillionTokens?: number | undefined;
  outputRateMinorPerMillionTokens?: number | undefined;
  source: CostEventSource;
  turnId?: string | undefined;
  stepId?: string | undefined;
  attemptId?: string | undefined;
  parentSessionId?: string | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  reasoningEffort?: string | undefined;
  agentPreset?: string | undefined;
  completedAt?: string | undefined;
  requestOutcome?: CostRequestOutcome | undefined;
  pricingZone?: PricingZone | undefined;
  cacheHitTokens?: number | undefined;
  cacheMissTokens?: number | undefined;
  cacheWriteTokens?: number | undefined;
  outputTokens?: number | undefined;
  reasoningTokens?: number | undefined;
  hitRateMicroCny?: number | undefined;
  missRateMicroCny?: number | undefined;
  outputRateMicroCny?: number | undefined;
  cacheHitRateMicroCnyPerMillionTokens?: number | undefined;
  cacheMissRateMicroCnyPerMillionTokens?: number | undefined;
  outputRateMicroCnyPerMillionTokens?: number | undefined;
  priceVersion?: string | undefined;
}

export interface CostEventRecord {
  id: string;
  eventKey: string;
  sessionId: string;
  requestStartedAt: string;
  status: CostEventStatus;
  amountMicroCny: number;
  currency: CostCurrency;
  amountMinor: number;
  cacheHitMinor: number;
  cacheMissMinor: number;
  outputMinor: number;
  cacheHitRateMinorPerMillionTokens: number;
  cacheMissRateMinorPerMillionTokens: number;
  outputRateMinorPerMillionTokens: number;
  source: CostEventSource;
  turnId: string;
  stepId: string;
  attemptId: string;
  parentSessionId?: string;
  provider: string;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
  completedAt: string;
  requestOutcome?: CostRequestOutcome | undefined;
  pricingZone: PricingZone;
  cacheHitTokens: number;
  cacheMissTokens: number;
  cacheWriteTokens?: number | undefined;
  outputTokens: number;
  reasoningTokens: number;
  hitRateMicroCny: number;
  missRateMicroCny: number;
  outputRateMicroCny: number;
  cacheHitRateMicroCnyPerMillionTokens: number;
  cacheMissRateMicroCnyPerMillionTokens: number;
  outputRateMicroCnyPerMillionTokens: number;
  priceVersion: string;
}

export interface TokenUsageInput {
  cacheHitTokens?: number;
  cache_hit_tokens?: number;
  cacheMissTokens?: number;
  cache_miss_tokens?: number;
  cacheWriteTokens?: number;
  cache_write_tokens?: number;
  outputTokens?: number;
  output_tokens?: number;
  reasoningTokens?: number;
  reasoning_tokens?: number;
  promptTokens?: number;
  prompt_tokens?: number;
  completionTokens?: number;
  completion_tokens?: number;
  cachedTokens?: number;
  promptCacheHitTokens?: number;
  prompt_cache_hit_tokens?: number;
  promptCacheMissTokens?: number;
  prompt_cache_miss_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
  totalTokens?: number;
  total_tokens?: number;
}

export interface TokenUsageRecord {
  cacheHitTokens: number;
  cacheMissTokens: number;
  cacheWriteTokens?: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export interface TokenProjectionRecord extends TokenUsageRecord {
  isReliable: boolean;
}

export interface HostMetadataInput {
  provider?: unknown;
  model?: unknown;
  reasoningEffort?: unknown;
  agentPreset?: unknown;
  prompt?: unknown;
  completion?: unknown;
}

export interface HostMetadataRecord {
  provider: string;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
}

export interface LedgerSummary {
  requestCount: number;
  totalMicroCny: number;
  estimatedMicroCny: number;
  settledMicroCny: number;
  unknownMicroCny: number;
  failedMicroCny: number;
  unknownCount: number;
  estimatedCount: number;
  settledCount: number;
  failedCount: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  peakMicroCny: number;
  offpeakMicroCny: number;
  firstSeenAt: string;
  lastSeenAt: string;
  provider: string;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
}

export interface LedgerAggregation {
  global: LedgerSummary;
  sessions: Map<string, LedgerSummary>;
  days: Map<string, LedgerSummary>;
}

export interface BalanceSnapshot {
  status: "fresh" | "stale" | "unavailable";
  currency?: string;
  isAvailable?: boolean;
  unit?: "microCny";
  totalMicroCny?: number | null;
  grantedMicroCny?: number | null;
  toppedUpMicroCny?: number | null;
  total: number | null;
  granted: number | null;
  toppedUp: number | null;
  fetchedAt: number;
  updatedAt?: string;
  expiresAt: number;
  isExpired: boolean;
  error?: string;
}

export const UNKNOWN_TEXT = "unknown";

export function asText(value: unknown, fallback = UNKNOWN_TEXT): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function normalizeTokenUsage(input: TokenUsageInput): TokenUsageRecord {
  const cacheHitTokens =
    firstNumber([
      input.cacheHitTokens,
      input.cache_hit_tokens,
      input.promptCacheHitTokens,
      input.prompt_cache_hit_tokens,
      input.cachedTokens,
      input.prompt_tokens_details?.cached_tokens,
    ]) ?? 0;
  const explicitCacheMissTokens = firstNumber([
    input.cacheMissTokens,
    input.cache_miss_tokens,
    input.promptCacheMissTokens,
    input.prompt_cache_miss_tokens,
  ]);
  const cacheWriteTokens = firstNumber([input.cacheWriteTokens, input.cache_write_tokens]) ?? 0;
  const promptTokens = firstNumber([input.promptTokens, input.prompt_tokens]);
  const cacheMissTokens =
    explicitCacheMissTokens ??
    (promptTokens !== undefined ? Math.max(promptTokens - cacheHitTokens - cacheWriteTokens, 0) : 0);
  const outputTokens =
    firstNumber([
      input.outputTokens,
      input.output_tokens,
      input.completionTokens,
      input.completion_tokens,
    ]) ?? 0;
  const reasoningTokens =
    firstNumber([
      input.reasoningTokens,
      input.reasoning_tokens,
      input.completion_tokens_details?.reasoning_tokens,
    ]) ?? 0;
  const totalTokens =
    firstNumber([input.totalTokens, input.total_tokens]) ??
    (promptTokens !== undefined ? promptTokens : cacheHitTokens + cacheMissTokens) + outputTokens;

  return {
    cacheHitTokens,
    cacheMissTokens,
    ...(cacheWriteTokens > 0 ? { cacheWriteTokens } : {}),
    outputTokens,
    reasoningTokens,
    totalTokens,
  };
}

export interface HostCostEventIdentity {
  sessionId: string;
  turnId?: string | undefined;
  stepId?: string | undefined;
  attemptId?: string | undefined;
}

export function createHostCostEventKey(identity: HostCostEventIdentity): string {
  return [
    normalizeHostKeyPart(identity.sessionId, "sessionId"),
    normalizeHostKeyPart(identity.turnId, "turnId"),
    normalizeHostKeyPart(identity.stepId, "stepId"),
    normalizeHostKeyPart(identity.attemptId, "attemptId"),
  ].join(":");
}

export function normalizeCostEvent(input: CostEventInput): CostEventRecord {
  return Object.freeze({
    id: input.id,
    eventKey: createHostCostEventKey(input),
    sessionId: input.sessionId,
    requestStartedAt: input.requestStartedAt,
    status: input.status,
    amountMicroCny: asNumber(input.amountMicroCny),
    currency: input.currency ?? "CNY",
    amountMinor: asNumber(input.amountMinor ?? input.amountMicroCny),
    cacheHitMinor: asNumber(input.cacheHitMinor ?? input.hitRateMicroCny),
    cacheMissMinor: asNumber(input.cacheMissMinor ?? input.missRateMicroCny),
    outputMinor: asNumber(input.outputMinor ?? input.outputRateMicroCny),
    cacheHitRateMinorPerMillionTokens: asNumber(input.cacheHitRateMinorPerMillionTokens ?? input.cacheHitRateMicroCnyPerMillionTokens),
    cacheMissRateMinorPerMillionTokens: asNumber(input.cacheMissRateMinorPerMillionTokens ?? input.cacheMissRateMicroCnyPerMillionTokens),
    outputRateMinorPerMillionTokens: asNumber(input.outputRateMinorPerMillionTokens ?? input.outputRateMicroCnyPerMillionTokens),
    source: input.source,
    turnId: asText(input.turnId),
    stepId: asText(input.stepId),
    attemptId: asText(input.attemptId),
    // Absent stays absent: stamping the "unknown" sentinel here poisoned the
    // ledger (the cost-tree builder treats "unknown" as "no parent").
    ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
    provider: asText(input.provider),
    model: asText(input.model),
    reasoningEffort: asText(input.reasoningEffort),
    agentPreset: asText(input.agentPreset),
    completedAt: asText(input.completedAt),
    ...(input.requestOutcome ? { requestOutcome: input.requestOutcome } : {}),
    pricingZone: input.pricingZone ?? "unknown",
    cacheHitTokens: asNumber(input.cacheHitTokens),
    cacheMissTokens: asNumber(input.cacheMissTokens),
    ...(input.cacheWriteTokens !== undefined ? { cacheWriteTokens: asNumber(input.cacheWriteTokens) } : {}),
    outputTokens: asNumber(input.outputTokens),
    reasoningTokens: asNumber(input.reasoningTokens),
    hitRateMicroCny: asNumber(input.hitRateMicroCny),
    missRateMicroCny: asNumber(input.missRateMicroCny),
    outputRateMicroCny: asNumber(input.outputRateMicroCny),
    cacheHitRateMicroCnyPerMillionTokens: asNumber(input.cacheHitRateMicroCnyPerMillionTokens),
    cacheMissRateMicroCnyPerMillionTokens: asNumber(input.cacheMissRateMicroCnyPerMillionTokens),
    outputRateMicroCnyPerMillionTokens: asNumber(input.outputRateMicroCnyPerMillionTokens),
    priceVersion: asText(input.priceVersion),
  });
}

function firstNumber(values: Array<unknown>): number | undefined {
  for (const value of values) {
    const parsed = asNumber(value, Number.NaN);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeHostKeyPart(value: unknown, name: string): string {
  const normalized = asText(value, UNKNOWN_TEXT).trim();
  const part = normalized.length > 0 ? normalized : UNKNOWN_TEXT;
  if (part.includes(":")) {
    throw new Error(`${name} must not contain ':'`);
  }
  return part;
}

export function createEmptySummary(): LedgerSummary {
  return {
    requestCount: 0,
    totalMicroCny: 0,
    estimatedMicroCny: 0,
    settledMicroCny: 0,
    unknownMicroCny: 0,
    failedMicroCny: 0,
    unknownCount: 0,
    estimatedCount: 0,
    settledCount: 0,
    failedCount: 0,
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    peakMicroCny: 0,
    offpeakMicroCny: 0,
    firstSeenAt: "",
    lastSeenAt: "",
    provider: UNKNOWN_TEXT,
    model: UNKNOWN_TEXT,
    reasoningEffort: UNKNOWN_TEXT,
    agentPreset: UNKNOWN_TEXT,
  };
}

export function updateSummary(summary: LedgerSummary, event: CostEventRecord): LedgerSummary {
  summary.requestCount += 1;
  summary.cacheHitTokens += event.cacheHitTokens;
  summary.cacheMissTokens += event.cacheMissTokens;
  summary.outputTokens += event.outputTokens;
  summary.reasoningTokens += event.reasoningTokens;

  if (summary.firstSeenAt === "" || event.requestStartedAt < summary.firstSeenAt) {
    summary.firstSeenAt = event.requestStartedAt;
  }

  if (summary.lastSeenAt === "" || event.requestStartedAt > summary.lastSeenAt) {
    summary.lastSeenAt = event.requestStartedAt;
    if (event.provider !== UNKNOWN_TEXT) {
      summary.provider = event.provider;
    }
    if (event.model !== UNKNOWN_TEXT) {
      summary.model = event.model;
    }
    if (event.reasoningEffort !== UNKNOWN_TEXT) {
      summary.reasoningEffort = event.reasoningEffort;
    }
    if (event.agentPreset !== UNKNOWN_TEXT) {
      summary.agentPreset = event.agentPreset;
    }
  }

  switch (event.status) {
    case "estimated":
      summary.estimatedCount += 1;
      summary.estimatedMicroCny += event.amountMicroCny;
      summary.totalMicroCny += event.amountMicroCny;
      break;
    case "settled":
      summary.settledCount += 1;
      summary.settledMicroCny += event.amountMicroCny;
      summary.totalMicroCny += event.amountMicroCny;
      break;
    case "failed":
      summary.failedCount += 1;
      summary.failedMicroCny += event.amountMicroCny;
      summary.totalMicroCny += event.amountMicroCny;
      break;
    case "unknown":
      summary.unknownCount += 1;
      summary.unknownMicroCny += event.amountMicroCny;
      break;
  }

  if (event.pricingZone === "peak") {
    summary.peakMicroCny += event.amountMicroCny;
  } else if (event.pricingZone === "offpeak") {
    summary.offpeakMicroCny += event.amountMicroCny;
  }

  return summary;
}

export function finalizeSummary(summary: LedgerSummary): LedgerSummary {
  if (summary.firstSeenAt === "") {
    summary.firstSeenAt = "";
  }

  if (summary.lastSeenAt === "") {
    summary.lastSeenAt = "";
  }

  return summary;
}

export function dayKeyFromTimestamp(timestamp: string): string {
  if (timestamp.length >= 10) {
    return timestamp.slice(0, 10);
  }

  const parsed = new Date(timestamp);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "1970-01-01";
}
