export type CostAnalyticsStatus = "estimated" | "settled" | "unknown" | "failed";
export type CostAnalyticsPricingZone = "peak" | "offpeak" | "unknown";
export type CostAnalyticsAnomalySeverity = "info" | "warning";
export type CostAnalyticsAnomalyRuleId =
  | "daily_spend_spike"
  | "hourly_spend_concentration"
  | "unknown_rate_high"
  | "failed_rate_high";

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

interface MutableBucket {
  key: string;
  startAt: string;
  endAt: string;
  amountMicroCny: number;
  requestCount: number;
  statusCounts: MutableStatusCounts;
  peakMicroCny: number;
  offpeakMicroCny: number;
}

interface MutableStatusCounts {
  estimated: number;
  settled: number;
  unknown: number;
  failed: number;
}

const DEFAULT_RECENT_BUCKET_LIMIT = 90;
const DEFAULT_DAILY_SPIKE_BASELINE_BUCKETS = 3;
const DEFAULT_DAILY_SPIKE_RATIO = 3;
const DEFAULT_DAILY_SPIKE_MIN_DELTA_MICRO_CNY = 1_000_000;
const DEFAULT_HOURLY_CONCENTRATION_RATIO = 0.85;
const DEFAULT_MINIMUM_REQUESTS_FOR_RATE_ANOMALY = 5;
const DEFAULT_UNKNOWN_RATE_THRESHOLD = 0.25;
const DEFAULT_FAILED_RATE_THRESHOLD = 0.25;

export function createCostAnalyticsReport(
  events: readonly CostAnalyticsEventInput[],
  options: CostAnalyticsOptions = {},
): CostAnalyticsReport {
  const normalized = events
    .filter((event) =>
      isFiniteNonNegative(event.amountMicroCny)
      && isValidTimestamp(event.requestStartedAt)
    )
    .map((event) => ({
      sessionId: event.sessionId?.trim() || "unknown",
      requestStartedAt: normalizeTimestamp(event.requestStartedAt),
      amountMicroCny: Math.round(event.amountMicroCny),
      status: normalizeStatus(event.status),
      pricingZone: normalizePricingZone(event.pricingZone),
    }))
    .sort((left, right) => left.requestStartedAt.localeCompare(right.requestStartedAt));

  const global = createMutableBucket("global", "", "");
  const sessions = new Map<string, MutableBucket>();
  const days = new Map<string, MutableBucket>();
  const hours = new Map<string, MutableBucket>();

  for (const event of normalized) {
    addToBucket(global, event);

    const session = sessions.get(event.sessionId) ?? createMutableBucket(event.sessionId, "", "");
    addToBucket(session, event);
    sessions.set(event.sessionId, session);

    const dayKey = event.requestStartedAt.slice(0, 10);
    const day = days.get(dayKey) ?? createMutableBucket(
      dayKey,
      `${dayKey}T00:00:00.000Z`,
      `${dayKey}T23:59:59.999Z`,
    );
    addToBucket(day, event);
    days.set(dayKey, day);

    const hourKey = event.requestStartedAt.slice(0, 13);
    const hour = hours.get(hourKey) ?? createMutableBucket(
      hourKey,
      `${hourKey}:00:00.000Z`,
      `${hourKey}:59:59.999Z`,
    );
    addToBucket(hour, event);
    hours.set(hourKey, hour);
  }

  const recentBucketLimit = positiveInteger(options.recentBucketLimit, DEFAULT_RECENT_BUCKET_LIMIT);
  const dailyTrend = withDeltas([...days.values()].sort(compareBucket).slice(-recentBucketLimit));
  const hourlyTrend = withDeltas([...hours.values()].sort(compareBucket).slice(-recentBucketLimit));
  const sessionSummaries = [...sessions.values()]
    .sort((left, right) => right.amountMicroCny - left.amountMicroCny || left.key.localeCompare(right.key))
    .map((bucket) => ({
      sessionId: bucket.key,
      ...toTotal(bucket),
    }));

  return {
    generatedAt: resolveGeneratedAt(options.now, normalized.at(-1)?.requestStartedAt),
    global: toTotal(global),
    sessions: sessionSummaries,
    dailyTrend,
    hourlyTrend,
    anomalies: detectAnomalies(dailyTrend, hourlyTrend, options),
  };
}

function detectAnomalies(
  dailyTrend: readonly CostAnalyticsTrendBucket[],
  hourlyTrend: readonly CostAnalyticsTrendBucket[],
  options: CostAnalyticsOptions,
): CostAnalyticsAnomaly[] {
  return [
    ...detectDailySpendSpikes(dailyTrend, options),
    ...detectHourlyConcentration(dailyTrend, hourlyTrend, options),
    ...detectRateAnomalies(dailyTrend, options),
  ];
}

function detectDailySpendSpikes(
  dailyTrend: readonly CostAnalyticsTrendBucket[],
  options: CostAnalyticsOptions,
): CostAnalyticsAnomaly[] {
  const baselineBuckets = positiveInteger(options.dailySpikeBaselineBuckets, DEFAULT_DAILY_SPIKE_BASELINE_BUCKETS);
  const ratioThreshold = positiveNumber(options.dailySpikeRatio, DEFAULT_DAILY_SPIKE_RATIO);
  const minimumDelta = nonNegativeNumber(
    options.dailySpikeMinDeltaMicroCny,
    DEFAULT_DAILY_SPIKE_MIN_DELTA_MICRO_CNY,
  );
  const anomalies: CostAnalyticsAnomaly[] = [];

  for (let index = baselineBuckets; index < dailyTrend.length; index += 1) {
    const bucket = dailyTrend[index]!;
    const baseline = dailyTrend.slice(index - baselineBuckets, index);
    const baselineAverage = average(baseline.map((entry) => entry.amountMicroCny));
    const delta = bucket.amountMicroCny - baselineAverage;
    if (baselineAverage <= 0 || bucket.amountMicroCny < baselineAverage * ratioThreshold || delta < minimumDelta) {
      continue;
    }
    const ratio = bucket.amountMicroCny / baselineAverage;
    anomalies.push({
      ruleId: "daily_spend_spike",
      severity: "warning",
      bucketKey: bucket.key,
      observedMicroCny: bucket.amountMicroCny,
      baselineMicroCny: baselineAverage,
      ratio,
      threshold: ratioThreshold,
      explanation:
        `${bucket.key} cost ${bucket.amountMicroCny} microCNY is ${formatRatio(ratio)}x`
        + ` the prior ${baselineBuckets}-day average ${baselineAverage} microCNY.`,
    });
  }

  return anomalies;
}

function detectHourlyConcentration(
  dailyTrend: readonly CostAnalyticsTrendBucket[],
  hourlyTrend: readonly CostAnalyticsTrendBucket[],
  options: CostAnalyticsOptions,
): CostAnalyticsAnomaly[] {
  const ratioThreshold = positiveNumber(options.hourlyConcentrationRatio, DEFAULT_HOURLY_CONCENTRATION_RATIO);
  const dayTotals = new Map(dailyTrend.map((bucket) => [bucket.key, bucket.amountMicroCny]));
  const anomalies: CostAnalyticsAnomaly[] = [];

  for (const hour of hourlyTrend) {
    const dayKey = hour.key.slice(0, 10);
    const dayTotal = dayTotals.get(dayKey) ?? 0;
    if (dayTotal <= 0) continue;
    const ratio = hour.amountMicroCny / dayTotal;
    if (ratio < ratioThreshold) continue;
    anomalies.push({
      ruleId: "hourly_spend_concentration",
      severity: "info",
      bucketKey: hour.key,
      observedMicroCny: hour.amountMicroCny,
      baselineMicroCny: dayTotal,
      ratio,
      threshold: ratioThreshold,
      explanation:
        `${hour.key}:00Z accounts for ${formatRatio(ratio)} of ${dayKey}'s cost`
        + ` (${hour.amountMicroCny}/${dayTotal} microCNY).`,
    });
  }

  return anomalies;
}

function detectRateAnomalies(
  dailyTrend: readonly CostAnalyticsTrendBucket[],
  options: CostAnalyticsOptions,
): CostAnalyticsAnomaly[] {
  const minimumRequests = positiveInteger(
    options.minimumRequestsForRateAnomaly,
    DEFAULT_MINIMUM_REQUESTS_FOR_RATE_ANOMALY,
  );
  const unknownThreshold = positiveNumber(options.unknownRateThreshold, DEFAULT_UNKNOWN_RATE_THRESHOLD);
  const failedThreshold = positiveNumber(options.failedRateThreshold, DEFAULT_FAILED_RATE_THRESHOLD);
  const anomalies: CostAnalyticsAnomaly[] = [];

  for (const bucket of dailyTrend) {
    if (bucket.requestCount < minimumRequests) continue;
    const unknownRate = bucket.statusCounts.unknown / bucket.requestCount;
    if (unknownRate >= unknownThreshold) {
      anomalies.push({
        ruleId: "unknown_rate_high",
        severity: "warning",
        bucketKey: bucket.key,
        observedCount: bucket.statusCounts.unknown,
        baselineCount: bucket.requestCount,
        ratio: unknownRate,
        threshold: unknownThreshold,
        explanation:
          `${bucket.key} has ${bucket.statusCounts.unknown}/${bucket.requestCount}`
          + ` unknown-cost requests (${formatRatio(unknownRate)}).`,
      });
    }

    const failedRate = bucket.statusCounts.failed / bucket.requestCount;
    if (failedRate >= failedThreshold) {
      anomalies.push({
        ruleId: "failed_rate_high",
        severity: "warning",
        bucketKey: bucket.key,
        observedCount: bucket.statusCounts.failed,
        baselineCount: bucket.requestCount,
        ratio: failedRate,
        threshold: failedThreshold,
        explanation:
          `${bucket.key} has ${bucket.statusCounts.failed}/${bucket.requestCount}`
          + ` failed-cost requests (${formatRatio(failedRate)}).`,
      });
    }
  }

  return anomalies;
}

function withDeltas(buckets: readonly MutableBucket[]): CostAnalyticsTrendBucket[] {
  return buckets.map((bucket, index) => {
    const previous = index > 0 ? buckets[index - 1]! : null;
    const previousAmount = previous?.amountMicroCny ?? null;
    const delta = previousAmount === null ? null : bucket.amountMicroCny - previousAmount;
    const deltaRatio = previousAmount && previousAmount > 0 ? bucket.amountMicroCny / previousAmount : null;
    return {
      key: bucket.key,
      startAt: bucket.startAt,
      endAt: bucket.endAt,
      amountMicroCny: bucket.amountMicroCny,
      requestCount: bucket.requestCount,
      statusCounts: freezeCounts(bucket.statusCounts),
      peakMicroCny: bucket.peakMicroCny,
      offpeakMicroCny: bucket.offpeakMicroCny,
      previousAmountMicroCny: previousAmount,
      deltaMicroCny: delta,
      deltaRatio,
    };
  });
}

function addToBucket(
  bucket: MutableBucket,
  event: {
    requestStartedAt: string;
    amountMicroCny: number;
    status: CostAnalyticsStatus;
    pricingZone: CostAnalyticsPricingZone;
  },
): void {
  bucket.amountMicroCny += event.status === "unknown" ? 0 : event.amountMicroCny;
  bucket.requestCount += 1;
  bucket.statusCounts[event.status] += 1;
  if (event.status === "unknown") {
    // Unknown amounts remain visible as counts but never enter monetary totals.
  } else if (event.pricingZone === "peak") {
    bucket.peakMicroCny += event.amountMicroCny;
  } else if (event.pricingZone === "offpeak") {
    bucket.offpeakMicroCny += event.amountMicroCny;
  }
  if (bucket.startAt === "" || event.requestStartedAt < bucket.startAt) bucket.startAt = event.requestStartedAt;
  if (bucket.endAt === "" || event.requestStartedAt > bucket.endAt) bucket.endAt = event.requestStartedAt;
}

function createMutableBucket(key: string, startAt: string, endAt: string): MutableBucket {
  return {
    key,
    startAt,
    endAt,
    amountMicroCny: 0,
    requestCount: 0,
    statusCounts: { estimated: 0, settled: 0, unknown: 0, failed: 0 },
    peakMicroCny: 0,
    offpeakMicroCny: 0,
  };
}

function toTotal(bucket: MutableBucket): CostAnalyticsTotal {
  return {
    totalMicroCny: bucket.amountMicroCny,
    requestCount: bucket.requestCount,
    statusCounts: freezeCounts(bucket.statusCounts),
    peakMicroCny: bucket.peakMicroCny,
    offpeakMicroCny: bucket.offpeakMicroCny,
  };
}

function freezeCounts(counts: MutableStatusCounts): CostAnalyticsStatusCounts {
  return {
    estimated: counts.estimated,
    settled: counts.settled,
    unknown: counts.unknown,
    failed: counts.failed,
  };
}

function compareBucket(left: MutableBucket, right: MutableBucket): number {
  return left.key.localeCompare(right.key);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function resolveGeneratedAt(now: CostAnalyticsOptions["now"], latestEventAt: string | undefined): string {
  if (typeof now === "function") return normalizeTimestamp(now());
  if (typeof now === "string") return normalizeTimestamp(now);
  return latestEventAt ?? new Date(0).toISOString();
}

function normalizeTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  return new Date(0).toISOString();
}

function isValidTimestamp(value: string): boolean {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function normalizeStatus(status: CostAnalyticsStatus | undefined): CostAnalyticsStatus {
  return status === "estimated" || status === "settled" || status === "unknown" || status === "failed"
    ? status
    : "unknown";
}

function normalizePricingZone(zone: CostAnalyticsPricingZone | undefined): CostAnalyticsPricingZone {
  return zone === "peak" || zone === "offpeak" || zone === "unknown" ? zone : "unknown";
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function formatRatio(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
