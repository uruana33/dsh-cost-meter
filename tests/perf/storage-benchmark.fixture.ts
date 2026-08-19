import { readFileSync, readdirSync, statSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import {
  createAppendOnlyCostEventRepository,
  createFileCostEventRepository,
  createRecoveryCheckpointPath,
  type AppendOnlyCostEventRepository,
  type CostEventInput,
  type CostEventRecord,
  type CostEventRepository,
} from "../../packages/host/src";
import { createMyMeterCordisHostRuntime } from "../../packages/plugin/src/cordis-host";
import {
  HISTORY_BACKFILL_SIZES,
  createHistoryBackfillPerfContext,
} from "./history-backfill.fixture";

export const STORAGE_BENCHMARK_SIZES = HISTORY_BACKFILL_SIZES;

export type StorageLedgerKind = "json-ledger" | "append-log";
export type StorageLedgerMutation = "replaceAll" | "clear";

export interface StorageMutationMetrics {
  readonly kind: StorageLedgerKind;
  readonly mutation: StorageLedgerMutation;
  readonly mutationCount: number;
  readonly writeBytes: number;
  readonly fsyncCount: number;
}

export interface StorageBenchmarkMetrics {
  readonly kind: StorageLedgerKind;
  readonly sessionCount: number;
  readonly replayedSessionCount: number;
  readonly sessionEventCount: number;
  readonly storedEventCount: number;
  readonly storedEvents: readonly CostEventRecord[];
  readonly commitCount: number;
  readonly backfillMs: number;
  readonly startupWriteBytes: number;
  readonly startupFsyncCount: number;
  readonly backfillWriteBytes: number;
  readonly cumulativeWriteBytes: number;
  readonly finalStorageBytes: number;
  readonly fsyncCount: number;
  readonly commitP50Ms: number;
  readonly commitP95Ms: number;
  readonly commitMaxMs: number;
  readonly coldRestoreMs: number;
  readonly coldRestoreEventCount: number;
  readonly coldRestoreEvents: readonly CostEventRecord[];
  readonly checkpointSessionRevisionCount: number;
  readonly checkpointStableRevisionCount: number;
  readonly checkpointHitMs: number;
  readonly checkpointHitReadCount: number;
  readonly checkpointHitCommitCount: number;
  readonly checkpointHitLedgerWriteBytes: number;
  readonly checkpointHitFsyncCount: number;
  readonly compactionMs: number;
  readonly compactionWriteBytes: number;
  readonly compactionFsyncCount: number;
  readonly postCompactionCommitMs: number;
  readonly postCompactionWriteBytes: number;
  readonly postCompactionFsyncCount: number;
  readonly postCompactionStorageBytes: number;
}

interface CommitMeasurement {
  readonly durationMs: number;
  readonly writeBytes: number;
  readonly fsyncCount: number;
}

export async function measureStorageBenchmark(
  sessionCount: number,
  kind: StorageLedgerKind,
): Promise<StorageBenchmarkMetrics> {
  const directory = await mkdtemp(join(tmpdir(), `mymeter-perf404-${kind}-${sessionCount}-`));
  const filePath = join(directory, "ledger.json");
  const repository = new MeasuringRepository(filePath, kind);
  const fixture = createHistoryBackfillPerfContext(sessionCount, "query", { withStableRevisions: true });

  const backfillStartedAt = performance.now();
  const runtime = createMyMeterCordisHostRuntime({
    ctx: fixture.context,
    repository,
    ledgerPath: filePath,
  });
  await waitForStorageBackfill(repository, () => fixture.context.completedReadCalls, sessionCount, fixture.billableSessionCount);
  const backfillMs = performance.now() - backfillStartedAt;
  const finalStorageBytes = ledgerStorageBytes(filePath);
  const storedEventCount = repository.list().length;
  const storedEvents = repository.list();
  const backfillWriteBytes = sumWriteBytes(repository.measurements);

  runtime.uninstall();

  const coldRestoreStartedAt = performance.now();
  const restored = createRepository(filePath, kind);
  const coldRestoreEventCount = restored.list().length;
  const coldRestoreEvents = restored.list();
  const coldRestoreMs = performance.now() - coldRestoreStartedAt;

  const checkpointPath = createRecoveryCheckpointPath(filePath);
  const checkpointSessionRevisions = readCheckpointSessionRevisions(checkpointPath);
  const checkpointModifiedAt = statSync(checkpointPath, { bigint: true }).mtimeNs;
  const checkpointRepository = new MeasuringRepository(filePath, kind);
  const checkpointFixture = createHistoryBackfillPerfContext(sessionCount, "query", { withStableRevisions: true });
  const checkpointHitStartedAt = performance.now();
  const checkpointRuntime = createMyMeterCordisHostRuntime({
    ctx: checkpointFixture.context,
    repository: checkpointRepository,
    ledgerPath: filePath,
  });
  await waitForCheckpointHit(checkpointPath, checkpointModifiedAt, checkpointFixture.context);
  const checkpointHitMs = performance.now() - checkpointHitStartedAt;
  checkpointRuntime.uninstall();

  const beforeCompaction = ledgerFileSnapshot(filePath);
  const compactionStartedAt = performance.now();
  compactRepository(restored);
  const compactionMs = performance.now() - compactionStartedAt;
  const afterCompaction = ledgerFileSnapshot(filePath);
  const compactionIo = estimateCompactionIo(kind, beforeCompaction, afterCompaction);

  const tailSession = tailCostEvent(sessionCount);
  const beforeTailCommit = ledgerFileSnapshot(filePath);
  const tailCommitStartedAt = performance.now();
  restored.commit?.([tailSession]);
  const postCompactionCommitMs = performance.now() - tailCommitStartedAt;
  const afterTailCommit = ledgerFileSnapshot(filePath);
  const tailIo = estimateCommitIo(kind, beforeTailCommit, afterTailCommit, true);

  return {
    kind,
    sessionCount,
    replayedSessionCount: sessionCount,
    sessionEventCount: fixture.sessionEventCount,
    storedEventCount,
    storedEvents,
    commitCount: repository.measurements.length,
    backfillMs,
    startupWriteBytes: repository.startup.writeBytes,
    startupFsyncCount: repository.startup.fsyncCount,
    backfillWriteBytes,
    cumulativeWriteBytes: repository.startup.writeBytes + backfillWriteBytes,
    finalStorageBytes,
    fsyncCount: repository.startup.fsyncCount + sumFsyncCount(repository.measurements),
    commitP50Ms: percentile(repository.measurements.map((item) => item.durationMs), 0.5),
    commitP95Ms: percentile(repository.measurements.map((item) => item.durationMs), 0.95),
    commitMaxMs: Math.max(0, ...repository.measurements.map((item) => item.durationMs)),
    coldRestoreMs,
    coldRestoreEventCount,
    coldRestoreEvents,
    checkpointSessionRevisionCount: Object.keys(checkpointSessionRevisions).length,
    checkpointStableRevisionCount: Object.values(checkpointSessionRevisions)
      .filter((revision) => revision.startsWith("revision:")).length,
    checkpointHitMs,
    checkpointHitReadCount: checkpointFixture.context.sessionReadCalls,
    checkpointHitCommitCount: checkpointRepository.measurements.length,
    checkpointHitLedgerWriteBytes: checkpointRepository.startup.writeBytes + sumWriteBytes(checkpointRepository.measurements),
    checkpointHitFsyncCount: checkpointRepository.startup.fsyncCount + sumFsyncCount(checkpointRepository.measurements),
    compactionMs,
    compactionWriteBytes: compactionIo.writeBytes,
    compactionFsyncCount: compactionIo.fsyncCount,
    postCompactionCommitMs,
    postCompactionWriteBytes: tailIo.writeBytes,
    postCompactionFsyncCount: tailIo.fsyncCount,
    postCompactionStorageBytes: ledgerStorageBytes(filePath),
  };
}

export function expectedStoredEventCount(sessionCount: number): number {
  const idleCount = Math.max(1, Math.floor(sessionCount * 0.14));
  return sessionCount - idleCount;
}

export async function measureRepositoryMutation(
  kind: StorageLedgerKind,
  mutation: StorageLedgerMutation,
): Promise<StorageMutationMetrics> {
  const directory = await mkdtemp(join(tmpdir(), `mymeter-perf404-${kind}-${mutation}-`));
  const filePath = join(directory, "ledger.json");
  const repository = new MeasuringRepository(filePath, kind);

  if (mutation === "replaceAll") {
    repository.replaceAll([tailCostEvent(1)]);
  } else {
    repository.clear();
  }

  return {
    kind,
    mutation,
    mutationCount: repository.measurements.length,
    writeBytes: sumWriteBytes(repository.measurements),
    fsyncCount: sumFsyncCount(repository.measurements),
  };
}

class MeasuringRepository implements CostEventRepository {
  private readonly repository: CostEventRepository;
  readonly measurements: CommitMeasurement[] = [];
  readonly startup: { readonly writeBytes: number; readonly fsyncCount: number };

  constructor(
    private readonly filePath: string,
    private readonly kind: StorageLedgerKind,
  ) {
    const before = ledgerFileSnapshot(filePath);
    this.repository = createRepository(filePath, kind);
    const after = ledgerFileSnapshot(filePath);
    this.startup = estimateStartupIo(kind, before, after);
  }

  upsert(event: CostEventInput) {
    this.commit([event]);
    return this.repository.getById(event.id) ?? this.repository.list().at(-1)!;
  }

  commit(events: readonly CostEventInput[]): void {
    if (events.length === 0) {
      this.repository.commit?.(events);
      return;
    }
    this.measureMutation(
      () => this.repository.commit?.(events),
      (before, after) => estimateCommitIo(this.kind, before, after, true),
    );
  }

  list() {
    return this.repository.list();
  }

  getById(id: string) {
    return this.repository.getById(id);
  }

  replaceAll(events: readonly CostEventInput[]): void {
    this.measureMutation(
      () => this.repository.replaceAll(events),
      (before, after) => estimateReplacementIo(this.kind, before, after),
    );
  }

  clear(): void {
    this.measureMutation(
      () => this.repository.clear(),
      (before, after) => estimateReplacementIo(this.kind, before, after),
    );
  }

  ledgerFingerprint(): string {
    return this.repository.ledgerFingerprint?.() ?? "";
  }

  private measureMutation(
    mutate: () => void,
    estimate: (
      before: ReadonlyMap<string, number>,
      after: ReadonlyMap<string, number>,
    ) => { readonly writeBytes: number; readonly fsyncCount: number },
  ): void {
    const before = ledgerFileSnapshot(this.filePath);
    const startedAt = performance.now();
    mutate();
    const durationMs = performance.now() - startedAt;
    const after = ledgerFileSnapshot(this.filePath);
    this.measurements.push({
      durationMs,
      ...estimate(before, after),
    });
  }
}

function createRepository(filePath: string, kind: StorageLedgerKind): CostEventRepository {
  return kind === "append-log"
    ? createAppendOnlyCostEventRepository({ filePath })
    : createFileCostEventRepository({ filePath });
}

async function waitForStorageBackfill(
  repository: CostEventRepository,
  completedReads: () => number,
  expectedReads: number,
  expectedStoredEvents: number,
): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (
      repository.list().length >= expectedStoredEvents
      && completedReads() >= expectedReads
    ) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(
    `storage backfill did not complete ${expectedReads} reads and store ${expectedStoredEvents} events`
    + ` (completed ${completedReads()}, stored ${repository.list().length})`,
  );
}

async function waitForCheckpointHit(
  checkpointPath: string,
  previousModifiedAt: bigint,
  context: { readonly sessionListCalls: number; readonly sessionReadCalls: number },
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (
      context.sessionListCalls > 0
      && context.sessionReadCalls === 0
      && statSync(checkpointPath, { bigint: true }).mtimeNs !== previousModifiedAt
    ) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("checkpoint-hit restart did not finish without reading session contents");
}

function compactRepository(repository: CostEventRepository): void {
  const maybeAppend = repository as Partial<AppendOnlyCostEventRepository>;
  if (typeof maybeAppend.compact === "function") {
    maybeAppend.compact();
    return;
  }
  repository.replaceAll(repository.list());
}

function ledgerStorageBytes(filePath: string): number {
  return [...ledgerFileSnapshot(filePath).values()].reduce((total, bytes) => total + bytes, 0);
}

function readCheckpointSessionRevisions(checkpointPath: string): Record<string, string> {
  const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8")) as {
    sessionRevisions?: unknown;
  };
  const revisions = checkpoint.sessionRevisions;
  if (revisions === null || typeof revisions !== "object" || Array.isArray(revisions)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(revisions).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function ledgerFileSnapshot(filePath: string): Map<string, number> {
  const directory = dirname(filePath);
  const prefix = basename(filePath);
  const entries = readdirSync(directory)
    .filter((name) => isLedgerStorageFile(prefix, name))
    .map((name): readonly [string, number] => [name, statSync(join(directory, name)).size]);
  return new Map(entries);
}

function isLedgerStorageFile(prefix: string, name: string): boolean {
  return name === prefix
    || (name.startsWith(`${prefix}.g`) && (name.endsWith(".snapshot.json") || name.endsWith(".log")));
}

function estimateStartupIo(
  kind: StorageLedgerKind,
  before: ReadonlyMap<string, number>,
  after: ReadonlyMap<string, number>,
): { writeBytes: number; fsyncCount: number } {
  const writeBytes = [...after].reduce(
    (total, [name, bytes]) => total + Math.max(0, bytes - (before.get(name) ?? 0)),
    0,
  );
  if (writeBytes === 0) return { writeBytes: 0, fsyncCount: 0 };
  return { writeBytes, fsyncCount: kind === "append-log" ? 5 : 2 };
}

function estimateCommitIo(
  kind: StorageLedgerKind,
  before: ReadonlyMap<string, number>,
  after: ReadonlyMap<string, number>,
  didWrite: boolean,
): { writeBytes: number; fsyncCount: number } {
  if (!didWrite) return { writeBytes: 0, fsyncCount: 0 };
  if (kind === "json-ledger") {
    return { writeBytes: after.get("ledger.json") ?? 0, fsyncCount: 2 };
  }
  const generation = currentGeneration(after);
  const logName = `ledger.json.g${generation}.log`;
  const logDeltaBytes = Math.max(0, (after.get(logName) ?? 0) - (before.get(logName) ?? 0));
  return {
    writeBytes: logDeltaBytes,
    fsyncCount: 1,
  };
}

function estimateReplacementIo(
  kind: StorageLedgerKind,
  before: ReadonlyMap<string, number>,
  after: ReadonlyMap<string, number>,
): { writeBytes: number; fsyncCount: number } {
  return kind === "json-ledger"
    ? estimateCommitIo(kind, before, after, true)
    : estimateCompactionIo(kind, before, after);
}

function sumWriteBytes(measurements: readonly CommitMeasurement[]): number {
  return measurements.reduce((total, item) => total + item.writeBytes, 0);
}

function sumFsyncCount(measurements: readonly CommitMeasurement[]): number {
  return measurements.reduce((total, item) => total + item.fsyncCount, 0);
}

function estimateCompactionIo(
  kind: StorageLedgerKind,
  before: ReadonlyMap<string, number>,
  after: ReadonlyMap<string, number>,
): { writeBytes: number; fsyncCount: number } {
  if (kind === "json-ledger") {
    return { writeBytes: after.get("ledger.json") ?? 0, fsyncCount: 2 };
  }
  const generation = currentGeneration(after);
  const logName = `ledger.json.g${generation}.log`;
  return {
    writeBytes:
      (after.get(`ledger.json.g${generation}.snapshot.json`) ?? 0)
      + Math.max(0, (after.get(logName) ?? 0) - (before.get(logName) ?? 0))
      + (after.get("ledger.json") ?? 0),
    fsyncCount: 5,
  };
}

function currentGeneration(snapshot: ReadonlyMap<string, number>): number {
  const generations = [...snapshot.keys()].flatMap((name) => {
    const match = /^ledger\.json\.g(\d+)\./.exec(name);
    return match ? [Number(match[1])] : [];
  });
  return Math.max(1, ...generations);
}

function tailCostEvent(sessionCount: number): CostEventInput {
  return {
    id: `${sessionCount}-tail-after-compaction`,
    sessionId: `${sessionCount}-tail-after-compaction`,
    requestStartedAt: "2026-08-17T09:00:00.000Z",
    completedAt: "2026-08-17T09:00:01.000Z",
    status: "settled",
    amountMicroCny: 777,
    source: "final_usage",
    turnId: "1",
    stepId: "1",
    attemptId: "attempt-0",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    reasoningEffort: "medium",
    agentPreset: "Coding",
    pricingZone: "peak",
    requestOutcome: "success",
    cacheHitTokens: 10,
    cacheMissTokens: 20,
    outputTokens: 30,
    reasoningTokens: 5,
    hitRateMicroCny: 70,
    missRateMicroCny: 300,
    outputRateMicroCny: 407,
    cacheHitRateMicroCnyPerMillionTokens: 50_000,
    cacheMissRateMicroCnyPerMillionTokens: 1_500_000,
    outputRateMicroCnyPerMillionTokens: 4_500_000,
    priceVersion: "perf404-tail",
  };
}

function percentile(samples: readonly number[], fraction: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index] ?? 0;
}
