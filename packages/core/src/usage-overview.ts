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
  readonly models: UsageOverviewModelSummary[];
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

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface NormalizedUsageEvent {
  at: Date;
  provider: string;
  model: string;
  knownPrice: boolean;
  amountMicroCny: number;
  totalTokens: number;
}

interface MutableUsageTotal {
  amountMicroCny: number;
  totalTokens: number;
  requestCount: number;
  pricedRequestCount: number;
  unknownRequestCount: number;
}

interface MutableUsageModel extends MutableUsageTotal {
  provider: string;
  model: string;
}

const DEFAULT_TIME_ZONE = "Asia/Shanghai";
const KNOWN_COST_STATUSES = new Set<UsageOverviewCostStatus>(["estimated", "settled", "failed"]);

export function createUsageOverview(
  events: readonly UsageOverviewEventInput[],
  options: UsageOverviewOptions = { range: "today" },
): UsageOverviewReport {
  const range = normalizeRange(options.range);
  const timeZone = normalizeTimeZone(options.timeZone);
  const now = resolveNow(options.now);
  const today = localDayKey(now, timeZone);
  const dayCount = range === "today" ? 1 : range === "7d" ? 7 : 30;
  const dayKeys = createDayKeys(today, dayCount);
  const allowedDays = new Set(dayKeys);
  const bucketKeys = range === "today"
    ? Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"))
    : dayKeys;
  const buckets = new Map(bucketKeys.map((key) => [key, emptyMutableTotal()]));
  const bucketModels = new Map<string, Map<string, MutableUsageModel>>();
  const totals = emptyMutableTotal();
  const models = new Map<string, MutableUsageTotal & { provider: string; model: string }>();

  for (const input of events) {
    const event = normalizeEvent(input);
    if (!event) continue;
    const parts = partsAt(event.at, timeZone);
    const dayKey = dateKey(parts.year, parts.month, parts.day);
    if (!allowedDays.has(dayKey)) continue;
    const bucketKey = range === "today" ? String(parts.hour).padStart(2, "0") : dayKey;
    const bucket = buckets.get(bucketKey);
    if (!bucket) continue;
    addEvent(bucket, event);
    addEvent(totals, event);
    const modelsForBucket = bucketModels.get(bucketKey) ?? new Map<string, MutableUsageModel>();
    const bucketModelKey = `${event.provider}\u0000${event.model}`;
    const bucketModel = modelsForBucket.get(bucketModelKey) ?? {
      provider: event.provider,
      model: event.model,
      ...emptyMutableTotal(),
    };
    addEvent(bucketModel, event);
    modelsForBucket.set(bucketModelKey, bucketModel);
    bucketModels.set(bucketKey, modelsForBucket);
    const modelKey = `${event.provider}\u0000${event.model}`;
    const model = models.get(modelKey) ?? {
      provider: event.provider,
      model: event.model,
      ...emptyMutableTotal(),
    };
    addEvent(model, event);
    models.set(modelKey, model);
  }

  const trend = bucketKeys.map((key): UsageOverviewTrendBucket => {
    const total = toTotal(buckets.get(key) ?? emptyMutableTotal());
    const bounds = range === "today"
      ? hourBounds(today, Number(key), timeZone)
      : dayBounds(key, timeZone);
    return {
      key,
      ...bounds,
      ...total,
      models: sortModelSummaries(bucketModels.get(key)),
    };
  });
  const rangeStart = dayBounds(dayKeys[0]!, timeZone).startAt;
  const rangeEnd = dayBounds(nextDayKey(dayKeys.at(-1)!), timeZone).startAt;
  const topModelLimit = positiveInteger(options.topModelLimit, 10, 10);
  const topModels = [...models.values()]
    .map((model): UsageOverviewModelSummary => ({
      provider: model.provider,
      model: model.model,
      ...toTotal(model),
    }))
    .sort((left, right) =>
      right.amountMicroCny - left.amountMicroCny
      || right.totalTokens - left.totalTokens
      || left.model.localeCompare(right.model)
      || left.provider.localeCompare(right.provider)
    )
    .slice(0, topModelLimit);

  return {
    range,
    timeZone,
    generatedAt: now.toISOString(),
    startAt: rangeStart,
    endAt: rangeEnd,
    totals: toTotal(totals),
    trend,
    topModels,
  };
}

function sortModelSummaries(models: Map<string, MutableUsageModel> | undefined): UsageOverviewModelSummary[] {
  return [...(models?.values() ?? [])]
    .map((model): UsageOverviewModelSummary => ({
      provider: model.provider,
      model: model.model,
      ...toTotal(model),
    }))
    .sort((left, right) =>
      right.amountMicroCny - left.amountMicroCny
      || right.totalTokens - left.totalTokens
      || left.model.localeCompare(right.model)
      || left.provider.localeCompare(right.provider)
    );
}

function normalizeEvent(input: UsageOverviewEventInput): NormalizedUsageEvent | null {
  const at = new Date(input.requestStartedAt);
  if (!Number.isFinite(at.getTime())) return null;
  const status = input.status ?? "unknown";
  const validAmount = Number.isFinite(input.amountMicroCny) && (input.amountMicroCny ?? -1) >= 0;
  const knownPrice = KNOWN_COST_STATUSES.has(status) && validAmount;
  return {
    at,
    provider: normalizedText(input.provider),
    model: normalizedText(input.model),
    knownPrice,
    amountMicroCny: knownPrice ? safeInteger(input.amountMicroCny) : 0,
    totalTokens: safeSum([
      input.cacheHitTokens,
      input.cacheMissTokens,
      input.cacheWriteTokens,
      input.outputTokens,
    ]),
  };
}

function addEvent(total: MutableUsageTotal, event: NormalizedUsageEvent): void {
  total.requestCount = safeAdd(total.requestCount, 1);
  total.totalTokens = safeAdd(total.totalTokens, event.totalTokens);
  if (event.knownPrice) {
    total.pricedRequestCount = safeAdd(total.pricedRequestCount, 1);
    total.amountMicroCny = safeAdd(total.amountMicroCny, event.amountMicroCny);
  } else {
    total.unknownRequestCount = safeAdd(total.unknownRequestCount, 1);
  }
}

function emptyMutableTotal(): MutableUsageTotal {
  return {
    amountMicroCny: 0,
    totalTokens: 0,
    requestCount: 0,
    pricedRequestCount: 0,
    unknownRequestCount: 0,
  };
}

function toTotal(total: MutableUsageTotal): UsageOverviewTotal {
  return {
    amountMicroCny: total.amountMicroCny,
    totalTokens: total.totalTokens,
    requestCount: total.requestCount,
    pricedRequestCount: total.pricedRequestCount,
    unknownRequestCount: total.unknownRequestCount,
    coverage: coverage(total),
  };
}

function coverage(total: MutableUsageTotal): UsageOverviewCoverage {
  if (total.requestCount === 0 || total.pricedRequestCount === 0) return "unavailable";
  if (total.unknownRequestCount > 0) return "partial";
  return "complete";
}

function resolveNow(value: UsageOverviewOptions["now"]): Date {
  const resolved = typeof value === "function" ? value() : value;
  const date = resolved instanceof Date ? new Date(resolved.getTime()) : new Date(resolved ?? Date.now());
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function normalizeRange(value: UsageOverviewRange): UsageOverviewRange {
  return value === "7d" || value === "30d" ? value : "today";
}

function normalizeTimeZone(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function partsAt(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function localDayKey(date: Date, timeZone: string): string {
  const parts = partsAt(date, timeZone);
  return dateKey(parts.year, parts.month, parts.day);
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function createDayKeys(lastDay: string, count: number): string[] {
  const [year, month, day] = lastDay.split("-").map(Number) as [number, number, number];
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - (count - index - 1)));
    return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  });
}

function nextDayKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function dayBounds(key: string, timeZone: string): { startAt: string; endAt: string } {
  const [year, month, day] = key.split("-").map(Number) as [number, number, number];
  return {
    startAt: zonedDateTimeToUtc(year, month, day, 0, timeZone).toISOString(),
    endAt: zonedDateTimeToUtc(...datePartsFromKey(nextDayKey(key)), 0, timeZone).toISOString(),
  };
}

function hourBounds(key: string, hour: number, timeZone: string): { startAt: string; endAt: string } {
  const [year, month, day] = datePartsFromKey(key);
  const startAt = zonedDateTimeToUtc(year, month, day, hour, timeZone);
  const endAt = hour === 23
    ? zonedDateTimeToUtc(...datePartsFromKey(nextDayKey(key)), 0, timeZone)
    : zonedDateTimeToUtc(year, month, day, hour + 1, timeZone);
  return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
}

function datePartsFromKey(key: string): [number, number, number] {
  return key.split("-").map(Number) as [number, number, number];
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const desired = Date.UTC(year, month - 1, day, hour, 0, 0);
  let guess = desired;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const actual = partsAt(new Date(guess), timeZone);
    const comparable = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const difference = desired - comparable;
    if (difference === 0) break;
    guess += difference;
  }
  return new Date(guess);
}

function normalizedText(value: string | undefined): string {
  return value?.trim() || "unknown";
}

function safeInteger(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? -1) < 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.round(value!));
}

function safeSum(values: readonly (number | undefined)[]): number {
  return values.reduce<number>((sum, value) => safeAdd(sum, safeInteger(value)), 0);
}

function safeAdd(left: number, right: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, left + right);
}

function positiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return fallback;
  return Math.min(maximum, Math.max(1, Math.round(value!)));
}
