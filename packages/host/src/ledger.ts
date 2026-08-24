import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

import { createLedgerFingerprintFromContents } from "./recovery-checkpoint.js";
import {
  asRecord,
  createHostCostEventKey,
  createEmptySummary,
  dayKeyFromTimestamp,
  finalizeSummary,
  normalizeCostEvent,
  type CostEventInput,
  type CostEventRecord,
  type LedgerAggregation,
  type LedgerSummary,
  updateSummary,
} from "./types.js";

export interface CostEventRepository {
  upsert(event: CostEventInput): CostEventRecord;
  commit?(events: readonly CostEventInput[]): void;
  list(): readonly CostEventRecord[];
  getById(id: string): CostEventRecord | undefined;
  replaceAll(events: readonly CostEventInput[]): void;
  clear(): void;
  ledgerFingerprint?(): string;
}

export interface FileCostEventRepositoryOptions {
  filePath: string;
  onRecovery?: ((notice: LedgerRecoveryNotice) => void) | undefined;
}

export interface LedgerRecoveryNotice {
  filePath: string;
  quarantinePath: string | null;
  reason: "corrupt" | `schema-${number}` | "invalid-events";
  recoveredEventCount: number;
  rejectedEventCount: number;
}

const LEDGER_SCHEMA_VERSION = 1;
const COST_EVENT_STATUSES = new Set<CostEventInput["status"]>(["estimated", "settled", "unknown", "failed"]);
const COST_EVENT_SOURCES = new Set<CostEventInput["source"]>(["stream", "final_usage", "restored", "projection"]);
const COST_REQUEST_OUTCOMES = new Set<NonNullable<CostEventInput["requestOutcome"]>>([
  "success",
  "failed",
  "aborted",
]);
const PRICING_ZONES = new Set<NonNullable<CostEventInput["pricingZone"]>>(["peak", "offpeak", "unknown"]);

export function createInMemoryCostEventRepository(
  initialEvents: readonly CostEventInput[] = [],
): CostEventRepository {
  const events = new Map<string, CostEventRecord>();
  const idsByEventKey = new Map<string, string>();

  const insert = (event: CostEventInput): CostEventRecord => {
    const normalized = normalizeCostEvent(event);

    const existingById = events.get(normalized.id);
    if (existingById) {
      return existingById;
    }

    const dedupeKey = completeHostCostEventKey(normalized);
    if (dedupeKey) {
      const existingId = idsByEventKey.get(dedupeKey);
      const existingByKey = existingId ? events.get(existingId) : undefined;
      if (existingByKey) {
        if (!shouldReplaceHostCostEvent(existingByKey, normalized)) {
          return existingByKey;
        }
        events.delete(existingByKey.id);
      }
    }

    events.set(normalized.id, normalized);
    if (dedupeKey) {
      idsByEventKey.set(dedupeKey, normalized.id);
    }
    return normalized;
  };

  for (const event of initialEvents) {
    insert(event);
  }

  return {
    upsert(event) {
      return insert(event);
    },
    commit(events) {
      for (const event of events) {
        insert(event);
      }
    },
    list() {
      return Object.freeze([...events.values()]);
    },
    getById(id) {
      return events.get(id);
    },
    replaceAll(nextEvents) {
      events.clear();
      idsByEventKey.clear();
      for (const event of nextEvents) {
        insert(event);
      }
    },
    clear() {
      events.clear();
      idsByEventKey.clear();
    },
  };
}

export function dedupeHostCostEvents(events: readonly CostEventInput[]): CostEventRecord[] {
  return [...createInMemoryCostEventRepository(events).list()];
}

export function createFileCostEventRepository({
  filePath,
  onRecovery,
}: FileCostEventRepositoryOptions): CostEventRepository {
  const initial = readLedgerFile(filePath, onRecovery);
  const repository = createInMemoryCostEventRepository(initial.events);
  let ledgerFingerprint = initial.fingerprint;
  // Every mutating call persists synchronously, so after each completed call
  // the on-memory events equal the durable file contents. Re-reading the file
  // (O(file size) read + JSON.parse) is therefore only necessary when another
  // writer touched it since this repository last read or wrote it.
  let lastSyncedDiskStat = statLedgerFile(filePath);
  let lastSeenWriteGeneration = pathWriteGeneration(filePath);

  const syncFromDisk = (): void => {
    const stat = statLedgerFile(filePath);
    const generation = pathWriteGeneration(filePath);
    if (
      stat !== null
      && lastSyncedDiskStat !== null
      && stat.mtimeMs === lastSyncedDiskStat.mtimeMs
      && stat.size === lastSyncedDiskStat.size
      && generation === lastSeenWriteGeneration
    ) {
      return;
    }
    const disk = readLedgerFile(filePath, onRecovery);
    ledgerFingerprint = disk.fingerprint;
    repository.replaceAll(disk.events);
    lastSyncedDiskStat = statLedgerFile(filePath);
    lastSeenWriteGeneration = pathWriteGeneration(filePath);
  };

  const persist = () => {
    const payload = {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      events: repository.list(),
    };
    const contents = JSON.stringify(payload);
    mkdirSync(dirname(filePath), { recursive: true });
    writeLedgerFileAtomically(filePath, contents);
    ledgerFingerprint = createLedgerFingerprintFromContents(filePath, contents);
    lastSyncedDiskStat = statLedgerFile(filePath);
    lastSeenWriteGeneration = pathWriteGeneration(filePath);
  };

  return {
    upsert(event) {
      syncFromDisk();
      const result = repository.upsert(event);
      persist();
      return result;
    },
    commit(events) {
      syncFromDisk();
      for (const event of events) {
        repository.upsert(event);
      }
      persist();
    },
    list() {
      return repository.list();
    },
    getById(id) {
      return repository.getById(id);
    },
    replaceAll(events) {
      syncFromDisk();
      // Matches the historical merge semantics: disk events are the base and
      // the incoming batch is upserted on top of them.
      for (const event of events) {
        repository.upsert(event);
      }
      persist();
    },
    clear() {
      repository.clear();
      persist();
    },
    ledgerFingerprint() {
      return ledgerFingerprint;
    },
  };
}

interface LedgerDiskStat {
  mtimeMs: number;
  size: number;
}

function statLedgerFile(filePath: string): LedgerDiskStat | null {
  try {
    const stat = statSync(filePath);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch {
    return null;
  }
}

// Process-wide monotonic counter per normalized ledger path. Sibling
// repository instances for the same path bump it on every persist, which lets
// syncFromDisk() trust the stat fast path even when a same-tick write keeps
// mtime and size identical.
const ledgerWriteGenerations = new Map<string, number>();

function pathWriteGeneration(filePath: string): number {
  return ledgerWriteGenerations.get(`${process.pid}:${filePath}`) ?? 0;
}

function bumpPathWriteGeneration(filePath: string): void {
  const key = `${process.pid}:${filePath}`;
  ledgerWriteGenerations.set(key, (ledgerWriteGenerations.get(key) ?? 0) + 1);
}

export { createHostCostEventKey };

export interface LedgerAggregator {
  aggregate(events: readonly CostEventInput[]): LedgerAggregation;
}

export function createLedgerAggregator(): LedgerAggregator {
  return {
    aggregate(events) {
      const global = createEmptySummary();
      const sessions = new Map<string, LedgerSummary>();
      const days = new Map<string, LedgerSummary>();

      for (const eventInput of dedupeHostCostEvents(events)) {
        const event = normalizeCostEvent(eventInput);
        updateSummary(global, event);

        const sessionSummary = sessions.get(event.sessionId) ?? createEmptySummary();
        updateSummary(sessionSummary, event);
        sessions.set(event.sessionId, sessionSummary);

        const dayKey = dayKeyFromTimestamp(event.requestStartedAt);
        const daySummary = days.get(dayKey) ?? createEmptySummary();
        updateSummary(daySummary, event);
        days.set(dayKey, daySummary);
      }

      finalizeSummary(global);
      for (const summary of sessions.values()) {
        finalizeSummary(summary);
      }
      for (const summary of days.values()) {
        finalizeSummary(summary);
      }

      return { global, sessions, days };
    },
  };
}

function readLedgerFile(
  filePath: string,
  onRecovery?: ((notice: LedgerRecoveryNotice) => void) | undefined,
): { events: CostEventInput[]; fingerprint: string } {
  if (!existsSync(filePath)) {
    return { events: [], fingerprint: createLedgerFingerprintFromContents(filePath, null) };
  }

  let raw: unknown;
  let contents: string;
  try {
    contents = readFileSync(filePath, "utf8");
    raw = JSON.parse(contents) as unknown;
  } catch {
    const quarantinePath = quarantineLedgerFile(filePath, "corrupt");
    onRecovery?.({ filePath, quarantinePath, reason: "corrupt", recoveredEventCount: 0, rejectedEventCount: 0 });
    return { events: [], fingerprint: createLedgerFingerprintFromContents(filePath, null) };
  }
  const data = asRecord(raw);
  const schemaVersion = data.schemaVersion;
  if (typeof schemaVersion === "number" && schemaVersion !== LEDGER_SCHEMA_VERSION) {
    const reason = `schema-${schemaVersion}` as const;
    const quarantinePath = quarantineLedgerFile(filePath, reason);
    onRecovery?.({ filePath, quarantinePath, reason, recoveredEventCount: 0, rejectedEventCount: 0 });
    return { events: [], fingerprint: createLedgerFingerprintFromContents(filePath, null) };
  }
  if (schemaVersion === LEDGER_SCHEMA_VERSION && !Array.isArray(data.events)) {
    throw new Error("Ledger schema v1 file must contain an events array");
  }
  const events = Array.isArray(data.events) ? data.events : Array.isArray(raw) ? raw : [];
  let rejectedEventCount = 0;

  const restored = events.flatMap((event): CostEventInput[] => {
    try {
      return [restoreLedgerEvent(event)];
    } catch {
      rejectedEventCount += 1;
      return [];
    }
  });

  if (rejectedEventCount > 0) {
    const quarantinePath = quarantineLedgerFile(filePath, "invalid-events");
    contents = JSON.stringify({ schemaVersion: LEDGER_SCHEMA_VERSION, events: restored });
    writeLedgerFileAtomically(filePath, contents);
    onRecovery?.({
      filePath,
      quarantinePath,
      reason: "invalid-events",
      recoveredEventCount: restored.length,
      rejectedEventCount,
    });
  }

  return { events: restored, fingerprint: createLedgerFingerprintFromContents(filePath, contents) };
}

export function restoreLedgerEvent(event: unknown): CostEventRecord {
  const record = asRecord(event);
  const id = restoreRequiredText(record.id, "id");
  const sessionId = restoreRequiredText(record.sessionId, "sessionId");
  const requestStartedAt = restoreRequiredTimestamp(record.requestStartedAt, "requestStartedAt");
  const completedAt = restoreOptionalTimestamp(record.completedAt, "completedAt");
  const currency = typeof record.currency === "string" ? record.currency : undefined;
  const legacyUsdCnyRate = currency === "USD" ? readLegacyUsdCnyRate(record.priceVersion) : null;
  const restoreNativeMinor = (nativeValue: unknown, compatibilityValue: unknown): number | undefined => {
    if (nativeValue !== undefined) return validateOptionalNonNegativeInteger(nativeValue, "native currency amount");
    return legacyUsdCnyRate !== null && typeof compatibilityValue === "number"
      ? Math.round(compatibilityValue / legacyUsdCnyRate)
      : undefined;
  };
  const cacheHitMinor = restoreNativeMinor(record.cacheHitMinor, record.hitRateMicroCny);
  const cacheMissMinor = restoreNativeMinor(record.cacheMissMinor, record.missRateMicroCny);
  const outputMinor = restoreNativeMinor(record.outputMinor, record.outputRateMicroCny);
  const compatibilityBuckets = [record.hitRateMicroCny, record.missRateMicroCny, record.outputRateMicroCny];
  const amountMinor = record.amountMinor !== undefined
    ? validateOptionalNonNegativeInteger(record.amountMinor, "amountMinor")
    : legacyUsdCnyRate !== null
      && compatibilityBuckets.every((value) => typeof value === "number")
      && compatibilityBuckets.reduce<number>((sum, value) => sum + Number(value), 0) === record.amountMicroCny
      ? (cacheHitMinor ?? 0) + (cacheMissMinor ?? 0) + (outputMinor ?? 0)
      : restoreNativeMinor(record.amountMinor, record.amountMicroCny);
  return normalizeCostEvent({
    id,
    sessionId,
    requestStartedAt,
    status: restoreEnum(record.status, COST_EVENT_STATUSES, "unknown", "status"),
    amountMicroCny: restoreNonNegativeInteger(record.amountMicroCny, 0, "amountMicroCny"),
    currency,
    amountMinor,
    cacheHitMinor,
    cacheMissMinor,
    outputMinor,
    cacheHitRateMinorPerMillionTokens: restoreNativeMinor(
      record.cacheHitRateMinorPerMillionTokens,
      record.cacheHitRateMicroCnyPerMillionTokens,
    ),
    cacheMissRateMinorPerMillionTokens: restoreNativeMinor(
      record.cacheMissRateMinorPerMillionTokens,
      record.cacheMissRateMicroCnyPerMillionTokens,
    ),
    outputRateMinorPerMillionTokens: restoreNativeMinor(
      record.outputRateMinorPerMillionTokens,
      record.outputRateMicroCnyPerMillionTokens,
    ),
    source: restoreEnum(record.source, COST_EVENT_SOURCES, "restored", "source"),
    turnId: typeof record.turnId === "string" ? record.turnId : undefined,
    stepId: typeof record.stepId === "string" ? record.stepId : undefined,
    attemptId: typeof record.attemptId === "string" ? record.attemptId : undefined,
    // Older ledgers stamped the "unknown" sentinel for parent-less events;
    // treat it as absent so it cannot leak back into memory or exports.
    parentSessionId: typeof record.parentSessionId === "string" && record.parentSessionId !== "unknown"
      ? record.parentSessionId
      : undefined,
    provider: typeof record.provider === "string" ? record.provider : undefined,
    model: typeof record.model === "string" ? record.model : undefined,
    reasoningEffort: typeof record.reasoningEffort === "string" ? record.reasoningEffort : undefined,
    agentPreset: typeof record.agentPreset === "string" ? record.agentPreset : undefined,
    completedAt,
    requestOutcome: restoreOptionalEnum(record.requestOutcome, COST_REQUEST_OUTCOMES, "requestOutcome"),
    pricingZone: restoreEnum(record.pricingZone, PRICING_ZONES, "unknown", "pricingZone"),
    cacheHitTokens: restoreNonNegativeInteger(record.cacheHitTokens, 0, "cacheHitTokens"),
    cacheMissTokens: restoreNonNegativeInteger(record.cacheMissTokens, 0, "cacheMissTokens"),
    cacheWriteTokens: restoreOptionalNonNegativeInteger(record.cacheWriteTokens, "cacheWriteTokens"),
    outputTokens: restoreNonNegativeInteger(record.outputTokens, 0, "outputTokens"),
    reasoningTokens: restoreNonNegativeInteger(record.reasoningTokens, 0, "reasoningTokens"),
    hitRateMicroCny: restoreNonNegativeInteger(record.hitRateMicroCny, 0, "hitRateMicroCny"),
    missRateMicroCny: restoreNonNegativeInteger(record.missRateMicroCny, 0, "missRateMicroCny"),
    outputRateMicroCny: restoreNonNegativeInteger(record.outputRateMicroCny, 0, "outputRateMicroCny"),
    cacheHitRateMicroCnyPerMillionTokens: restoreNonNegativeInteger(
      record.cacheHitRateMicroCnyPerMillionTokens,
      0,
      "cacheHitRateMicroCnyPerMillionTokens",
    ),
    cacheMissRateMicroCnyPerMillionTokens: restoreNonNegativeInteger(
      record.cacheMissRateMicroCnyPerMillionTokens,
      0,
      "cacheMissRateMicroCnyPerMillionTokens",
    ),
    outputRateMicroCnyPerMillionTokens: restoreNonNegativeInteger(
      record.outputRateMicroCnyPerMillionTokens,
      0,
      "outputRateMicroCnyPerMillionTokens",
    ),
    priceVersion: typeof record.priceVersion === "string" ? record.priceVersion : undefined,
  });
}

function restoreRequiredText(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

function restoreRequiredTimestamp(value: unknown, fieldName: string): string {
  const text = restoreRequiredText(value, fieldName);
  if (!Number.isFinite(Date.parse(text))) {
    throw new Error(`${fieldName} must be a valid timestamp`);
  }
  return text;
}

function restoreOptionalTimestamp(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  const text = restoreRequiredText(value, fieldName);
  if (text === "unknown") return text;
  if (!Number.isFinite(Date.parse(text))) {
    throw new Error(`${fieldName} must be a valid timestamp`);
  }
  return text;
}

function restoreEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  fallback: T,
  fieldName: string,
): T {
  if (value === undefined) return fallback;
  if (typeof value === "string" && allowed.has(value as T)) return value as T;
  throw new Error(`${fieldName} must be a supported value`);
}

function restoreOptionalEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  fieldName: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && allowed.has(value as T)) return value as T;
  throw new Error(`${fieldName} must be a supported value`);
}

function restoreNonNegativeInteger(value: unknown, fallback: number, fieldName: string): number {
  if (value === undefined) return fallback;
  return validateOptionalNonNegativeInteger(value, fieldName);
}

function restoreOptionalNonNegativeInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  return validateOptionalNonNegativeInteger(value, fieldName);
}

function validateOptionalNonNegativeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a finite non-negative integer`);
  }
  return value;
}

function readLegacyUsdCnyRate(priceVersion: unknown): number | null {
  if (typeof priceVersion !== "string") return null;
  const fixedRate = /-usd-cny-(\d+(?:\.\d+)?)$/.exec(priceVersion);
  if (fixedRate) {
    const rate = Number(fixedRate[1]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }
  return priceVersion.endsWith("-usd") ? 7.2 : null;
}

function quarantineLedgerFile(filePath: string, reason: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const quarantinePath = `${filePath}.${reason}-${Date.now()}-${process.pid}`;
  try {
    renameSync(filePath, quarantinePath);
    return quarantinePath;
  } catch {
    // Keep the original file in place when the filesystem cannot rename it.
    return null;
  }
}

function writeLedgerFileAtomically(filePath: string, contents: string): void {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(tmpPath, "w");
    writeFileSync(descriptor, contents);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    renameSync(tmpPath, filePath);
    fsyncDirectory(dirname(filePath));
    bumpPathWriteGeneration(filePath);
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(tmpPath)) {
      rmSync(tmpPath, { force: true });
    }
    throw error;
  }
}

function fsyncDirectory(directoryPath: string): void {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(directoryPath, "r");
    fsyncSync(descriptor);
  } catch {
    // Some filesystems and Windows hosts do not permit syncing directories.
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function completeHostCostEventKey(event: CostEventRecord): string | null {
  if (
    event.sessionId === "unknown" ||
    event.turnId === "unknown" ||
    event.stepId === "unknown" ||
    event.attemptId === "unknown"
  ) {
    return null;
  }
  return event.eventKey;
}

function shouldReplaceHostCostEvent(existing: CostEventRecord, next: CostEventRecord): boolean {
  const statusDelta = statusPriority(next.status) - statusPriority(existing.status);
  if (statusDelta !== 0) {
    return statusDelta > 0;
  }

  const sourceDelta = sourcePriority(next.source) - sourcePriority(existing.source);
  if (sourceDelta !== 0) {
    return sourceDelta > 0;
  }

  if (next.status === "estimated" && next.amountMicroCny !== existing.amountMicroCny) {
    return next.amountMicroCny > existing.amountMicroCny;
  }

  const existingTime = Date.parse(existing.completedAt !== "unknown" ? existing.completedAt : existing.requestStartedAt);
  const nextTime = Date.parse(next.completedAt !== "unknown" ? next.completedAt : next.requestStartedAt);
  if (Number.isFinite(existingTime) && Number.isFinite(nextTime) && existingTime !== nextTime) {
    return nextTime > existingTime;
  }

  return true;
}

function statusPriority(status: CostEventRecord["status"]): number {
  switch (status) {
    case "settled":
      return 4;
    case "failed":
      return 3;
    case "estimated":
      return 2;
    case "unknown":
      return 1;
  }
}

function sourcePriority(source: CostEventRecord["source"]): number {
  switch (source) {
    case "final_usage":
      return 4;
    case "restored":
      return 3;
    case "projection":
      return 2;
    case "stream":
      return 1;
  }
}
