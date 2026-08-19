import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import { createLedgerFingerprintFromContents } from "./recovery-checkpoint.js";
import {
  createHostCostEventKey,
  createInMemoryCostEventRepository,
  restoreLedgerEvent,
  type CostEventRepository,
} from "./ledger.js";
import type { CostEventInput } from "./types.js";

const APPEND_SCHEMA_VERSION = 1;
const FRAME_SCHEMA_VERSION = 1;
const EMPTY_DIGEST = "sha256:0";

export interface AppendOnlyLedgerRecoveryNotice {
  filePath: string;
  reason: "tail-truncated" | "corrupt-manifest" | "corrupt-snapshot" | "corrupt-log";
}

export interface AppendOnlyCostEventRepositoryOptions {
  /** Manifest path. Generation snapshot and log files live beside it. */
  filePath: string;
  /** Optional legacy JSON ledger to import on first startup. */
  legacyFilePath?: string | undefined;
  compactionHooks?: AppendOnlyLedgerCompactionHooks | undefined;
  onRecovery?: ((notice: AppendOnlyLedgerRecoveryNotice) => void) | undefined;
}

export interface AppendOnlyCostEventRepository extends CostEventRepository {
  compact(): void;
  /**
   * Export the current append generation as a complete schema-v1 JSON ledger.
   * The default same-path rollback is terminal: later writes are rejected and
   * ledgerFingerprint() reports the exported JSON fingerprint.
   */
  exportToJson(options?: AppendOnlyJsonExportOptions): string;
  /** Alias for exportToJson() used by migration/rollback callers. */
  compactToJson(options?: AppendOnlyJsonExportOptions): string;
}

export interface AppendOnlyJsonExportOptions {
  /** Destination schema-v1 JSON ledger path. Defaults to the manifest path. */
  filePath?: string | undefined;
  /** Optional candidate check that runs before the destination is replaced. */
  verifyCandidate?: ((candidateFilePath: string) => void) | undefined;
}

export type AppendOnlyLedgerCompactionStage =
  | "snapshot-write"
  | "log-write"
  | "candidate-validation"
  | "manifest-switch"
  | "old-generation-cleanup";

export interface AppendOnlyLedgerCompactionManifest {
  readonly generation: number;
  readonly snapshotFile: string;
  readonly logFile: string;
}

export interface AppendOnlyLedgerCompactionContext {
  readonly filePath: string;
  readonly currentManifest: AppendOnlyLedgerCompactionManifest;
  readonly nextManifest: AppendOnlyLedgerCompactionManifest;
}

export interface AppendOnlyLedgerCompactionHooks {
  failAt?(
    stage: AppendOnlyLedgerCompactionStage,
    context: AppendOnlyLedgerCompactionContext,
  ): void;
}

interface Manifest {
  schemaVersion: typeof APPEND_SCHEMA_VERSION;
  generation: number;
  snapshotFile: string;
  logFile: string;
}

interface Snapshot {
  schemaVersion: typeof APPEND_SCHEMA_VERSION;
  events: readonly CostEventInput[];
}

interface DecodedLog {
  events: readonly CostEventInput[];
  sequence: number;
  digest: string;
}

interface LogState {
  readonly bytes: number;
  readonly mtimeNs: bigint;
}

interface ManifestState {
  readonly mtimeNs: bigint;
}

interface FileIdentity {
  readonly dev: bigint;
  readonly ino: bigint;
}

interface LoadedGeneration {
  repository: ReturnType<typeof createInMemoryCostEventRepository>;
  snapshotDigest: string;
}

/**
 * Experimental append-only adapter. It is deliberately opt-in and keeps the
 * public runtime contract at CostEventRepository.
 */
export function createAppendOnlyCostEventRepository({
  filePath,
  legacyFilePath,
  compactionHooks,
  onRecovery,
}: AppendOnlyCostEventRepositoryOptions): AppendOnlyCostEventRepository {
  if (filePath.trim().length === 0) throw new Error("append ledger: filePath is required");
  assertLedgerPathIsNotFinalSymlink(filePath);
  mkdirSync(dirname(filePath), { recursive: true });
  filePath = resolveActiveLedgerPath(filePath);

  let manifest = loadOrCreateManifest(filePath, legacyFilePath, onRecovery);
  let loadedGeneration = loadGeneration(manifest, filePath, onRecovery);
  let repository = loadedGeneration.repository;
  let snapshotDigest = loadedGeneration.snapshotDigest;
  let sequence = 0;
  let digest = EMPTY_DIGEST;
  let exportedJsonFingerprint: string | null = null;
  const loadedLog = readLog(manifest, filePath, onRecovery);
  try {
    for (const event of loadedLog.events) repository.commit?.([event]);
  } catch (error) {
    quarantineFile(manifest.logFile, "corrupt-log");
    onRecovery?.({ filePath, reason: "corrupt-log" });
    throw error;
  }
  sequence = loadedLog.sequence;
  digest = loadedLog.digest;
  let logState = readLogState(manifest.logFile);
  let manifestState = readManifestState(filePath);

  const fingerprint = (): string => exportedJsonFingerprint ?? createLedgerFingerprintFromContents(
    filePath,
    JSON.stringify({ format: "append-v1", generation: manifest.generation, snapshotDigest, sequence, digest }),
  );

  const assertWritable = (): void => {
    if (exportedJsonFingerprint !== null) {
      throw new Error("append ledger: repository has been exported to JSON and is now read-only");
    }
  };

  const compactTo = (events: readonly CostEventInput[]): void => {
    assertWritable();
    const validatedEvents = restoreLedgerEvents(events);
    assertManifestStateUnchanged(filePath, manifest, manifestState);
    assertLogStateUnchanged(manifest.logFile, logState);
    const previous = manifest;
    const nextGeneration = previous.generation + 1;
    const nextManifest: Manifest = {
      schemaVersion: APPEND_SCHEMA_VERSION,
      generation: nextGeneration,
      snapshotFile: generationSnapshotFile(filePath, nextGeneration),
      logFile: generationLogFile(filePath, nextGeneration),
    };
    const compactionContext = { filePath, currentManifest: previous, nextManifest };
    const createdSidecars: string[] = [];
    let candidate: LoadedGeneration;
    assertGenerationSidecarsAvailable(nextManifest);
    try {
      compactionHooks?.failAt?.("snapshot-write", compactionContext);
      writeSnapshot(nextManifest, validatedEvents, filePath);
      createdSidecars.push(nextManifest.snapshotFile);
      compactionHooks?.failAt?.("log-write", compactionContext);
      writeFileDurably(nextManifest.logFile, "", { overwrite: false });
      createdSidecars.push(nextManifest.logFile);
      compactionHooks?.failAt?.("candidate-validation", compactionContext);
      candidate = loadGeneration(nextManifest, filePath, undefined, { quarantineOnError: false });
      readLog(nextManifest, filePath, undefined, { quarantineOnError: false });
      compactionHooks?.failAt?.("manifest-switch", compactionContext);
      assertManifestStateUnchanged(filePath, manifest, manifestState);
      assertLogStateUnchanged(manifest.logFile, logState);
      writeManifest(filePath, nextManifest);
    } catch (error) {
      cleanupCreatedSidecars(createdSidecars);
      throw error;
    }

    manifest = nextManifest;
    loadedGeneration = candidate;
    repository = loadedGeneration.repository;
    snapshotDigest = loadedGeneration.snapshotDigest;
    sequence = 0;
    digest = EMPTY_DIGEST;
    logState = readLogState(manifest.logFile);
    manifestState = readManifestState(filePath);
    if (previous.generation !== nextGeneration) {
      try {
        compactionHooks?.failAt?.("old-generation-cleanup", compactionContext);
        safeRemove(previous.snapshotFile);
        safeRemove(previous.logFile);
      } catch {
        // Old generations are cleanup-only; the active manifest has already switched.
      }
    }
  };

  const commit = (events: readonly CostEventInput[]): void => {
    assertWritable();
    if (events.length === 0) return;
    const validatedEvents = restoreLedgerEvents(events);
    assertManifestStateUnchanged(filePath, manifest, manifestState);
    assertLogStateUnchanged(manifest.logFile, logState);
    const nextRepository = createInMemoryCostEventRepository(repository.list());
    nextRepository.commit?.(validatedEvents);
    const frame = createFrame(validatedEvents, sequence + 1, digest);
    appendFrame(manifest.logFile, frame.serialized);
    repository = nextRepository;
    sequence = frame.sequence;
    digest = frame.digest;
    logState = readLogState(manifest.logFile);
  };

  const exportToJson = (options: AppendOnlyJsonExportOptions = {}): string => {
    const targetFilePath = options.filePath ?? filePath;
    if (targetFilePath.trim().length === 0) {
      throw new Error("append ledger: JSON export filePath is required");
    }
    assertWritable();
    assertJsonExportTargetAllowed(filePath, manifest, targetFilePath);
    assertManifestStateUnchanged(filePath, manifest, manifestState);
    assertLogStateUnchanged(manifest.logFile, logState);
    const contents = createLegacyJsonContents(repository.list());
    writeLegacyJsonAtomically(targetFilePath, contents, options.verifyCandidate, () => {
      assertManifestStateUnchanged(filePath, manifest, manifestState);
      assertLogStateUnchanged(manifest.logFile, logState);
    });
    const jsonFingerprint = createLedgerFingerprintFromContents(targetFilePath, contents);
    if (isSamePath(targetFilePath, filePath)) {
      exportedJsonFingerprint = jsonFingerprint;
    }
    return jsonFingerprint;
  };

  return {
    upsert(event) {
      commit([event]);
      const events = repository.list();
      const eventKey = createHostCostEventKey(event);
      return repository.getById(event.id)
        ?? events.find((record) => record.eventKey === eventKey)
        ?? events.at(-1)!;
    },
    commit,
    list() {
      return repository.list();
    },
    getById(id) {
      return repository.getById(id);
    },
    replaceAll(events) {
      compactTo(events);
    },
    clear() {
      compactTo([]);
    },
    compact() {
      compactTo(repository.list());
    },
    exportToJson,
    compactToJson: exportToJson,
    ledgerFingerprint: fingerprint,
  };
}

function loadOrCreateManifest(
  filePath: string,
  legacyFilePath: string | undefined,
  onRecovery: ((notice: AppendOnlyLedgerRecoveryNotice) => void) | undefined,
): Manifest {
  if (existsSync(filePath)) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    } catch {
      quarantineFile(filePath, "corrupt-manifest");
      onRecovery?.({ filePath, reason: "corrupt-manifest" });
      throw new Error("append ledger: active manifest is corrupt");
    }

    const manifest = parseManifest(raw, filePath);
    if (manifest) return manifest;

    if (hasAppendManifestFields(raw) || !isLegacyLedgerPayload(raw)) {
      quarantineFile(filePath, "corrupt-manifest");
      onRecovery?.({ filePath, reason: "corrupt-manifest" });
      throw new Error("append ledger: active manifest is invalid");
    }

    const legacy = readLegacyEvents(legacyFilePath ?? filePath, onRecovery);
    const nextManifest = createManifest(filePath, 1);
    assertGenerationSidecarsAvailable(nextManifest);
    preserveLegacyFile(filePath, legacyFilePath, legacy);
    const createdSidecars = writeNewGenerationSidecars(nextManifest, legacy, filePath);
    try {
      writeManifest(filePath, nextManifest);
    } catch (error) {
      cleanupCreatedSidecars(createdSidecars);
      throw error;
    }
    return nextManifest;
  }

  if (hasGenerationFiles(filePath)) {
    onRecovery?.({ filePath, reason: "corrupt-manifest" });
    throw new Error("append ledger: active manifest is missing while generation files remain");
  }

  const legacy = legacyFilePath && existsSync(legacyFilePath)
    ? readLegacyEvents(legacyFilePath, onRecovery)
    : [];
  const manifest = createManifest(filePath, 1);
  const createdSidecars = writeNewGenerationSidecars(manifest, legacy, filePath);
  try {
    writeManifest(filePath, manifest);
  } catch (error) {
    cleanupCreatedSidecars(createdSidecars);
    throw error;
  }
  return manifest;
}

function createManifest(filePath: string, generation: number): Manifest {
  return {
    schemaVersion: APPEND_SCHEMA_VERSION,
    generation,
    snapshotFile: generationSnapshotFile(filePath, generation),
    logFile: generationLogFile(filePath, generation),
  };
}

function preserveLegacyFile(
  filePath: string,
  legacyFilePath: string | undefined,
  events: readonly CostEventInput[],
): void {
  if (legacyFilePath !== undefined || !existsSync(filePath)) return;
  const backupPath = `${filePath}.legacy.json`;
  try {
    if (existsSync(backupPath)) {
      validateLegacyJsonFile(backupPath);
      return;
    }
    writeLegacyJsonAtomically(backupPath, createLegacyJsonContents(events), undefined, undefined, {
      overwrite: false,
    });
  } catch (error) {
    throw new Error(`append ledger: failed to preserve legacy JSON backup ${backupPath}`, { cause: error });
  }
}

function generationSnapshotFile(filePath: string, generation: number): string {
  return join(dirname(filePath), `${basename(filePath)}.g${generation}.snapshot.json`);
}

function generationLogFile(filePath: string, generation: number): string {
  return join(dirname(filePath), `${basename(filePath)}.g${generation}.log`);
}

function resolveAdjacent(filePath: string, value: string): string {
  if (value.trim().length === 0) throw new Error("append ledger: manifest path is required");
  return isAbsolute(value) ? value : join(dirname(filePath), value);
}

function assertJsonExportTargetAllowed(filePath: string, manifest: Manifest, targetFilePath: string): void {
  if (isFinalSymlinkToExistingFile(targetFilePath, filePath)) {
    throw new Error("append ledger: JSON export target cannot be a final symlink to the active manifest");
  }
  if (isSamePath(targetFilePath, filePath)) return;
  const targetDirectory = resolveRealDirectory(dirname(targetFilePath));
  const manifestDirectory = resolveRealDirectory(dirname(filePath));
  const activeGenerationPrefix = `${basename(filePath)}.g${manifest.generation}.`;
  if (
    targetDirectory === manifestDirectory
    && basename(targetFilePath).startsWith(activeGenerationPrefix)
  ) {
    throw new Error("append ledger: JSON export target cannot be inside the active generation sidecar");
  }
  if (
    isSameExistingFile(targetFilePath, manifest.snapshotFile)
    || isSameExistingFile(targetFilePath, manifest.logFile)
  ) {
    throw new Error("append ledger: JSON export target cannot be inside the active generation sidecar");
  }
}

function isSamePath(left: string, right: string): boolean {
  return resolveRenameTargetPath(left) === resolveRenameTargetPath(right);
}

function isFinalSymlinkToExistingFile(left: string, right: string): boolean {
  try {
    return lstatSync(left).isSymbolicLink() && isSameExistingFile(left, right);
  } catch {
    return false;
  }
}

function assertLedgerPathIsNotFinalSymlink(filePath: string): void {
  try {
    if (lstatSync(filePath).isSymbolicLink()) {
      throw new Error("append ledger: ledgerPath cannot be a symbolic link");
    }
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code === "ENOENT") return;
    throw error;
  }
}

function resolveActiveLedgerPath(filePath: string): string {
  try {
    const stats = lstatSync(filePath, { bigint: true });
    if (stats.isSymbolicLink()) {
      const linkTarget = readlinkSync(filePath);
      const targetFilePath = isAbsolute(linkTarget) ? linkTarget : join(dirname(filePath), linkTarget);
      return resolveActiveLedgerPath(targetFilePath);
    }
    const directoryPath = resolve(dirname(filePath));
    return join(directoryPath, canonicalDirectoryEntry(directoryPath, basename(filePath), stats));
  } catch {
    return filePath;
  }
}

function resolveRenameTargetPath(filePath: string): string {
  const directoryPath = resolveRealDirectory(dirname(filePath));
  const name = basename(filePath);
  try {
    const stats = lstatSync(filePath, { bigint: true });
    if (!stats.isSymbolicLink()) return join(directoryPath, canonicalDirectoryEntry(directoryPath, name, stats));
  } catch {
    // Fall back to the path rename would create when the target does not exist.
  }
  return join(directoryPath, name);
}

function resolveRealDirectory(directoryPath: string): string {
  try {
    return realpathSync(directoryPath);
  } catch {
    return resolve(directoryPath);
  }
}

function canonicalDirectoryEntry(
  directoryPath: string,
  name: string,
  stats: FileIdentity,
): string {
  for (const entry of readdirSync(directoryPath)) {
    if (entry === name) return entry;
    if (entry.toLowerCase() !== name.toLowerCase()) continue;
    try {
      const entryStats = lstatSync(join(directoryPath, entry), { bigint: true });
      if (entryStats.dev === stats.dev && entryStats.ino === stats.ino) return entry;
    } catch {
      // Ignore entries that disappear during canonicalization.
    }
  }
  return name;
}

function isSameExistingFile(left: string, right: string): boolean {
  try {
    const leftStats = statSync(left, { bigint: true });
    const rightStats = statSync(right, { bigint: true });
    return leftStats.dev === rightStats.dev && leftStats.ino === rightStats.ino;
  } catch {
    return false;
  }
}

function assertGenerationSidecarsAvailable(manifest: Manifest): void {
  assertNewGenerationSidecarPathAvailable(manifest.snapshotFile);
  assertNewGenerationSidecarPathAvailable(manifest.logFile);
}

function assertNewGenerationSidecarPathAvailable(filePath: string): void {
  try {
    lstatSync(filePath);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code === "ENOENT") return;
    throw error;
  }
  throw new Error(`append ledger: generation sidecar already exists ${filePath}`);
}

function writeNewGenerationSidecars(
  manifest: Manifest,
  events: readonly CostEventInput[],
  filePath: string,
): string[] {
  const createdSidecars: string[] = [];
  assertGenerationSidecarsAvailable(manifest);
  try {
    writeSnapshot(manifest, events, filePath);
    createdSidecars.push(manifest.snapshotFile);
    writeFileDurably(manifest.logFile, "", { overwrite: false });
    createdSidecars.push(manifest.logFile);
    return createdSidecars;
  } catch (error) {
    cleanupCreatedSidecars(createdSidecars);
    throw error;
  }
}

function cleanupCreatedSidecars(filePaths: readonly string[]): void {
  const changedDirectories = new Set<string>();
  for (const filePath of filePaths) {
    try {
      const stats = lstatSync(filePath);
      if (stats.isFile() || stats.isSymbolicLink()) {
        rmSync(filePath, { force: true });
        changedDirectories.add(dirname(filePath));
      }
    } catch {
      // Best-effort rollback for sidecars created by the current attempt.
    }
  }
  for (const directoryPath of changedDirectories) fsyncDirectory(directoryPath);
}

function loadGeneration(
  manifest: Manifest,
  filePath: string,
  onRecovery: ((notice: AppendOnlyLedgerRecoveryNotice) => void) | undefined,
  options: { quarantineOnError?: boolean } = {},
): LoadedGeneration {
  if (!existsSync(manifest.snapshotFile)) {
    onRecovery?.({ filePath, reason: "corrupt-snapshot" });
    throw new Error("append ledger: generation snapshot is missing");
  }
  try {
    const snapshot = JSON.parse(readFileSync(manifest.snapshotFile, "utf8")) as Snapshot;
    if (snapshot.schemaVersion !== APPEND_SCHEMA_VERSION || !Array.isArray(snapshot.events)) {
      throw new Error("invalid snapshot");
    }
    const events = restoreLedgerEvents(snapshot.events);
    return {
      repository: createInMemoryCostEventRepository(events),
      snapshotDigest: createSnapshotDigest(events),
    };
  } catch (error) {
    if (options.quarantineOnError !== false) {
      quarantineFile(manifest.snapshotFile, "corrupt-snapshot");
      onRecovery?.({ filePath, reason: "corrupt-snapshot" });
    }
    throw error;
  }
}

function readLegacyEvents(
  filePath: string,
  onRecovery: ((notice: AppendOnlyLedgerRecoveryNotice) => void) | undefined,
): readonly CostEventInput[] {
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    const record = raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : null;
    if (record && typeof record.schemaVersion === "number" && record.schemaVersion !== 1) {
      throw new Error(`unsupported legacy ledger schema ${record.schemaVersion}`);
    }
    const events = Array.isArray(raw)
      ? raw
      : record && Array.isArray(record.events)
        ? record.events
        : null;
    if (events === null) throw new Error("legacy ledger events are missing");
    return events.map((event) => restoreLedgerEvent(event));
  } catch (error) {
    onRecovery?.({ filePath, reason: "corrupt-snapshot" });
    throw error;
  }
}

function readLogState(filePath: string): LogState {
  const stats = statSync(filePath, { bigint: true });
  return { bytes: Number(stats.size), mtimeNs: stats.mtimeNs };
}

function assertLogStateUnchanged(filePath: string, expected: LogState): void {
  let current: LogState;
  try {
    current = readLogState(filePath);
  } catch {
    throw new Error("append ledger: active generation changed; reopen before committing");
  }
  if (current.bytes !== expected.bytes || current.mtimeNs !== expected.mtimeNs) {
    throw new Error("append ledger: active generation changed; reopen before committing");
  }
}

function readManifestState(filePath: string): ManifestState {
  return { mtimeNs: statSync(filePath, { bigint: true }).mtimeNs };
}

function assertManifestStateUnchanged(filePath: string, expected: Manifest, state: ManifestState): void {
  let currentState: ManifestState;
  try {
    currentState = readManifestState(filePath);
  } catch {
    throw new Error("append ledger: active manifest changed; reopen before committing");
  }
  if (currentState.mtimeNs !== state.mtimeNs) {
    throw new Error("append ledger: active manifest changed; reopen before committing");
  }
  let current: Manifest | null;
  try {
    current = parseManifest(JSON.parse(readFileSync(filePath, "utf8")) as unknown, filePath);
  } catch {
    current = null;
  }
  if (
    current === null
    || current.generation !== expected.generation
    || current.snapshotFile !== expected.snapshotFile
    || current.logFile !== expected.logFile
  ) {
    throw new Error("append ledger: active manifest changed; reopen before committing");
  }
}

function readLog(
  manifest: Manifest,
  filePath: string,
  onRecovery: ((notice: AppendOnlyLedgerRecoveryNotice) => void) | undefined,
  options: { quarantineOnError?: boolean } = {},
): DecodedLog {
  if (!existsSync(manifest.logFile)) {
    onRecovery?.({ filePath, reason: "corrupt-log" });
    throw new Error("append ledger: active generation log is missing");
  }
  const bytes = readFileSync(manifest.logFile);
  const fail = (message: string): never => {
    if (options.quarantineOnError !== false) {
      quarantineFile(manifest.logFile, "corrupt-log");
      onRecovery?.({ filePath, reason: "corrupt-log" });
    }
    throw new Error(message);
  };
  let offset = 0;
  let sequence = 0;
  let digest = EMPTY_DIGEST;
  const events: CostEventInput[] = [];
  while (offset < bytes.length) {
    const frameStart = offset;
    const lengthEnd = bytes.indexOf(10, offset);
    if (lengthEnd < 0) break;
    const bodyLength = Number(bytes.subarray(offset, lengthEnd).toString("ascii"));
    if (!Number.isInteger(bodyLength) || bodyLength < 0) {
      return fail("append ledger: invalid frame length");
    }
    const bodyStart = lengthEnd + 1;
    const bodyEnd = bodyStart + bodyLength;
    const digestStart = bodyEnd + 1;
    const digestEnd = bytes.indexOf(10, digestStart);
    if (bodyEnd >= bytes.length || bytes[bodyEnd] !== 10 || digestEnd < 0) break;
    if (digestEnd <= digestStart) {
      return fail("append ledger: invalid frame digest");
    }
    const body = bytes.subarray(bodyStart, bodyEnd).toString("utf8");
    const frameDigest = bytes.subarray(digestStart, digestEnd).toString("ascii");
    const expectedDigest = hashBody(body);
    if (frameDigest !== expectedDigest) {
      return fail("append ledger: hash chain mismatch");
    }
    let frame: { schemaVersion: number; sequence: number; previousDigest: string; events: CostEventInput[] };
    try {
      frame = JSON.parse(body) as typeof frame;
    } catch {
      return fail("append ledger: invalid frame JSON");
    }
    if (
      frame.schemaVersion !== FRAME_SCHEMA_VERSION ||
      frame.sequence !== sequence + 1 ||
      frame.previousDigest !== digest ||
      !Array.isArray(frame.events)
    ) {
      return fail("append ledger: invalid hash chain metadata");
    }
    try {
      events.push(...restoreLedgerEvents(frame.events));
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid event";
      return fail(`append ledger: invalid frame events: ${message}`);
    }
    sequence = frame.sequence;
    digest = frameDigest;
    offset = digestEnd + 1;
    if (offset <= frameStart) throw new Error("append ledger: parser did not advance");
  }
  if (offset < bytes.length) {
    truncateSync(manifest.logFile, offset);
    fsyncFile(manifest.logFile);
    onRecovery?.({ filePath, reason: "tail-truncated" });
  }
  return { events, sequence, digest };
}

function createFrame(
  events: readonly CostEventInput[],
  sequence: number,
  previousDigest: string,
): { sequence: number; digest: string; serialized: string } {
  const body = JSON.stringify({
    schemaVersion: FRAME_SCHEMA_VERSION,
    sequence,
    previousDigest,
    events,
  });
  const digest = hashBody(body);
  return {
    sequence,
    digest,
    serialized: `${Buffer.byteLength(body, "utf8")}\n${body}\n${digest}\n`,
  };
}

function hashBody(body: string): string {
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
}

function appendFrame(filePath: string, serialized: string): void {
  const descriptor = openSync(filePath, "a");
  try {
    writeFileSync(descriptor, serialized);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function writeSnapshot(manifest: Manifest, events: readonly CostEventInput[], filePath: string): void {
  try {
    writeJsonAtomically(manifest.snapshotFile, createSnapshotContents(restoreLedgerEvents(events)), {
      overwrite: false,
    });
  } catch (error) {
    throw new Error(`append ledger: failed to write snapshot ${filePath}`, { cause: error });
  }
}

function parseManifest(raw: unknown, filePath: string): Manifest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Partial<Manifest>;
  if (!hasAppendManifestFields(raw)) return null;
  const generation = typeof record.generation === "number" ? record.generation : null;
  if (
    record.schemaVersion !== APPEND_SCHEMA_VERSION ||
    generation === null ||
    !Number.isInteger(generation) ||
    generation < 1 ||
    typeof record.snapshotFile !== "string" ||
    typeof record.logFile !== "string"
  ) {
    return null;
  }
  const expectedSnapshotFile = generationSnapshotFile(filePath, generation);
  const expectedLogFile = generationLogFile(filePath, generation);
  const snapshotFile = resolveGenerationPath(filePath, record.snapshotFile, expectedSnapshotFile);
  const logFile = resolveGenerationPath(filePath, record.logFile, expectedLogFile);
  if (snapshotFile === null || logFile === null) return null;
  return {
    schemaVersion: APPEND_SCHEMA_VERSION,
    generation,
    snapshotFile,
    logFile,
  };
}

function hasAppendManifestFields(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return "generation" in raw || "snapshotFile" in raw || "logFile" in raw;
}

function resolveGenerationPath(filePath: string, value: string, expected: string): string | null {
  if (value.trim().length === 0) return null;
  const expectedAbsolute = resolve(expected);
  const candidates = isAbsolute(value)
    ? [value]
    : [resolveAdjacent(filePath, value), value];
  return candidates.some((candidate) => resolve(candidate) === expectedAbsolute) ? expected : null;
}

function hasGenerationFiles(filePath: string): boolean {
  const prefix = `${basename(filePath)}.g`;
  try {
    return readdirSync(dirname(filePath)).some((name) =>
      name.startsWith(prefix) && (name.endsWith(".snapshot.json") || name.endsWith(".log"))
    );
  } catch {
    return false;
  }
}

function isLegacyLedgerPayload(raw: unknown): boolean {
  if (Array.isArray(raw)) return true;
  if (!raw || typeof raw !== "object") return false;
  const record = raw as Record<string, unknown>;
  return record.schemaVersion === APPEND_SCHEMA_VERSION && Array.isArray(record.events);
}

function restoreLedgerEvents(events: readonly unknown[]): CostEventInput[] {
  return events.map((event) => restoreLedgerEvent(event));
}

function createSnapshotDigest(events: readonly CostEventInput[]): string {
  return hashBody(createSnapshotContents(events));
}

function createSnapshotContents(events: readonly CostEventInput[]): string {
  return createLegacyJsonContents(events);
}

function createLegacyJsonContents(events: readonly CostEventInput[]): string {
  return JSON.stringify({
    schemaVersion: APPEND_SCHEMA_VERSION,
    events,
  }, null, 2);
}

function validateLegacyJsonFile(filePath: string): void {
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("append ledger: exported JSON must be an object");
  }
  const record = raw as Partial<Snapshot>;
  if (record.schemaVersion !== APPEND_SCHEMA_VERSION || !Array.isArray(record.events)) {
    throw new Error("append ledger: exported JSON must be schema v1 with events");
  }
  restoreLedgerEvents(record.events);
}

function writeManifest(filePath: string, manifest: Manifest): void {
  writeJsonAtomically(filePath, JSON.stringify(serializeManifest(filePath, manifest), null, 2));
}

function serializeManifest(filePath: string, manifest: Manifest): Manifest {
  return {
    ...manifest,
    snapshotFile: serializeAdjacentPath(filePath, manifest.snapshotFile),
    logFile: serializeAdjacentPath(filePath, manifest.logFile),
  };
}

function serializeAdjacentPath(filePath: string, value: string): string {
  const relativePath = relative(dirname(filePath), value);
  return relativePath.length > 0 ? relativePath : value;
}

function writeFileDurably(
  filePath: string,
  contents: string,
  options: { overwrite?: boolean } = {},
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  if (options.overwrite === false) assertNewGenerationSidecarPathAvailable(filePath);
  let descriptor: number | null = null;
  let createdByThisCall = false;
  try {
    descriptor = openSync(filePath, options.overwrite === false ? "wx" : "w");
    createdByThisCall = options.overwrite === false;
    writeFileSync(descriptor, contents);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
  } catch (error) {
    if (descriptor !== null) {
      try { closeSync(descriptor); } catch { /* already closed */ }
    }
    if (createdByThisCall) cleanupCreatedSidecars([filePath]);
    throw error;
  }
}

function writeJsonAtomically(
  filePath: string,
  contents: string,
  options: { overwrite?: boolean } = {},
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  if (options.overwrite === false) assertNewGenerationSidecarPathAvailable(filePath);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const descriptor = openSync(tmpPath, "w");
  try {
    writeFileSync(descriptor, contents);
    fsyncSync(descriptor);
    closeSync(descriptor);
    if (options.overwrite === false) {
      linkSync(tmpPath, filePath);
      rmSync(tmpPath, { force: true });
    } else {
      renameSync(tmpPath, filePath);
    }
    fsyncDirectory(dirname(filePath));
  } catch (error) {
    try { closeSync(descriptor); } catch { /* already closed */ }
    if (existsSync(tmpPath)) rmSync(tmpPath, { force: true });
    throw error;
  }
}

function writeLegacyJsonAtomically(
  filePath: string,
  contents: string,
  verifyCandidate: ((candidateFilePath: string) => void) | undefined,
  assertBeforeRename: (() => void) | undefined,
  options: { overwrite?: boolean } = {},
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  if (options.overwrite === false && existsSync(filePath)) {
    throw new Error(`append ledger: JSON file already exists ${filePath}`);
  }
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(tmpPath, "w");
    writeFileSync(descriptor, contents);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    verifyCandidate?.(tmpPath);
    validateLegacyJsonFile(tmpPath);
    assertBeforeRename?.();
    if (options.overwrite === false) {
      linkSync(tmpPath, filePath);
      rmSync(tmpPath, { force: true });
    } else {
      renameSync(tmpPath, filePath);
    }
    fsyncDirectory(dirname(filePath));
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(tmpPath)) rmSync(tmpPath, { force: true });
    throw error;
  }
}

function fsyncDirectory(directoryPath: string): void {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(directoryPath, "r");
    fsyncSync(descriptor);
  } catch {
    // Directory fsync is unavailable on some filesystems.
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function fsyncFile(filePath: string): void {
  const descriptor = openSync(filePath, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function quarantineFile(filePath: string, reason: string): string | null {
  if (!existsSync(filePath)) return null;
  const quarantinePath = `${filePath}.${reason}-${Date.now()}-${process.pid}`;
  try {
    renameSync(filePath, quarantinePath);
    return quarantinePath;
  } catch {
    return null;
  }
}

function safeRemove(filePath: string): void {
  try {
    if (existsSync(filePath) && statSync(filePath).isFile()) rmSync(filePath, { force: true });
  } catch {
    // Old generations are cleanup-only; the active manifest remains durable.
  }
}
