import { existsSync, lstatSync, readFileSync, readlinkSync, readdirSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import {
  createAppendOnlyCostEventRepository,
  type AppendOnlyLedgerRecoveryNotice,
} from "./append-ledger.js";
import {
  createFileCostEventRepository,
  type CostEventRepository,
  type LedgerRecoveryNotice,
} from "./ledger.js";

export type CostEventLedgerFormat = "json" | "append";

export interface CostEventRepositoryForFormatOptions {
  ledgerPath: string;
  format?: CostEventLedgerFormat | undefined;
  onJsonRecovery?: ((notice: LedgerRecoveryNotice) => void) | undefined;
  onAppendRecovery?: ((notice: AppendOnlyLedgerRecoveryNotice) => void) | undefined;
}

interface AppendManifest {
  readonly schemaVersion: 1;
  readonly generation: number;
  readonly snapshotFile: string;
  readonly logFile: string;
}

interface AppendState {
  readonly ledgerPath: string;
  readonly manifest: AppendManifest;
}

export function createCostEventRepositoryForFormat({
  ledgerPath,
  format = "json",
  onJsonRecovery,
  onAppendRecovery,
}: CostEventRepositoryForFormatOptions): CostEventRepository {
  if (ledgerPath.trim().length === 0) {
    throw new Error("cost event ledger format: ledgerPath is required");
  }

  switch (format) {
    case "json":
      exportAppendManifestToJsonIfPresent(ledgerPath, onAppendRecovery);
      return createFileCostEventRepository({ filePath: ledgerPath, onRecovery: onJsonRecovery });
    case "append":
      assertLedgerPathIsNotFinalSymlink(ledgerPath);
      return createAppendOnlyCostEventRepository({ filePath: ledgerPath, onRecovery: onAppendRecovery });
    default:
      throw new Error(`unknown cost event ledger format: ${String(format)}`);
  }
}

function assertLedgerPathIsNotFinalSymlink(ledgerPath: string): void {
  try {
    if (lstatSync(ledgerPath).isSymbolicLink()) {
      throw new Error("cost event ledger format: ledgerPath cannot be a symbolic link");
    }
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code === "ENOENT") return;
    throw error;
  }
}

function exportAppendManifestToJsonIfPresent(
  ledgerPath: string,
  onAppendRecovery: ((notice: AppendOnlyLedgerRecoveryNotice) => void) | undefined,
): void {
  const appendState = inspectAppendState(ledgerPath, onAppendRecovery);
  if (appendState === null) return;

  createAppendOnlyCostEventRepository({
    filePath: appendState.ledgerPath,
    onRecovery: onAppendRecovery,
  }).exportToJson();
}

function inspectAppendState(
  ledgerPath: string,
  onAppendRecovery: ((notice: AppendOnlyLedgerRecoveryNotice) => void) | undefined,
): AppendState | null {
  if (isFinalSymlink(ledgerPath)) {
    const targetPath = resolveSymlinkTargetPath(ledgerPath);
    if (isAppendStateTarget(targetPath)) {
      throw new Error("cost event ledger format: append ledgerPath cannot be a symbolic link");
    }
    return null;
  }

  if (!existsSync(ledgerPath)) {
    if (hasAdjacentGenerationFiles(ledgerPath)) {
      notifyCorruptManifest(ledgerPath, onAppendRecovery);
      throw new Error("cost event ledger format: append manifest is missing while generation files remain");
    }
    return null;
  }

  const canonicalLedgerPath = resolveExistingLedgerPath(ledgerPath);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(canonicalLedgerPath, "utf8")) as unknown;
  } catch (error) {
    if (hasAdjacentGenerationFiles(canonicalLedgerPath)) {
      notifyCorruptManifest(ledgerPath, onAppendRecovery);
      throw new Error("cost event ledger format: append manifest is corrupt", { cause: error });
    }
    return null;
  }

  const manifest = parseAppendManifest(raw, canonicalLedgerPath);
  if (manifest) return { ledgerPath: canonicalLedgerPath, manifest };

  if (hasAppendManifestFields(raw)) {
    notifyCorruptManifest(ledgerPath, onAppendRecovery);
    throw new Error("cost event ledger format: append manifest is invalid");
  }

  if (hasAdjacentGenerationFiles(canonicalLedgerPath) && isSchemaOneObjectWithoutEventsArray(raw)) {
    notifyCorruptManifest(ledgerPath, onAppendRecovery);
    throw new Error("cost event ledger format: append manifest is missing while generation files remain");
  }

  return null;
}

function isAppendStateTarget(ledgerPath: string): boolean {
  const canonicalLedgerPath = resolveExistingLedgerPath(ledgerPath);
  if (!existsSync(canonicalLedgerPath)) return hasAdjacentGenerationFiles(canonicalLedgerPath);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(canonicalLedgerPath, "utf8")) as unknown;
  } catch {
    return hasAdjacentGenerationFiles(canonicalLedgerPath);
  }

  if (parseAppendManifest(raw, canonicalLedgerPath)) return true;
  if (hasAppendManifestFields(raw)) return true;
  return hasAdjacentGenerationFiles(canonicalLedgerPath) && isSchemaOneObjectWithoutEventsArray(raw);
}

function isFinalSymlink(ledgerPath: string): boolean {
  try {
    return lstatSync(ledgerPath).isSymbolicLink();
  } catch {
    return false;
  }
}

function resolveSymlinkTargetPath(ledgerPath: string): string {
  const target = readlinkSync(ledgerPath);
  return isAbsolute(target) ? target : join(dirname(ledgerPath), target);
}

function parseAppendManifest(raw: unknown, ledgerPath: string): AppendManifest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!hasAppendManifestFields(raw)) return null;

  const record = raw as Partial<AppendManifest>;
  const generation = typeof record.generation === "number" ? record.generation : null;
  if (
    record.schemaVersion !== 1 ||
    generation === null ||
    !Number.isInteger(generation) ||
    generation < 1 ||
    typeof record.snapshotFile !== "string" ||
    typeof record.logFile !== "string"
  ) {
    return null;
  }

  const expectedSnapshotFile = generationSnapshotFile(ledgerPath, generation);
  const expectedLogFile = generationLogFile(ledgerPath, generation);
  const snapshotFile = resolveGenerationPath(ledgerPath, record.snapshotFile, expectedSnapshotFile);
  const logFile = resolveGenerationPath(ledgerPath, record.logFile, expectedLogFile);
  if (snapshotFile === null || logFile === null) return null;

  return {
    schemaVersion: 1,
    generation,
    snapshotFile,
    logFile,
  };
}

function hasAppendManifestFields(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return "generation" in raw || "snapshotFile" in raw || "logFile" in raw;
}

function resolveExistingLedgerPath(ledgerPath: string): string {
  let names: string[];
  try {
    names = readdirSync(dirname(ledgerPath));
  } catch {
    return ledgerPath;
  }

  const requestedName = basename(ledgerPath);
  if (names.includes(requestedName)) return ledgerPath;

  const existingName = names.find((name) => name.toLocaleLowerCase() === requestedName.toLocaleLowerCase());
  return existingName ? join(dirname(ledgerPath), existingName) : ledgerPath;
}

function isSchemaOneObjectWithoutEventsArray(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const record = raw as { schemaVersion?: unknown; events?: unknown };
  return record.schemaVersion === 1 && !Array.isArray(record.events);
}

function hasAdjacentGenerationFiles(ledgerPath: string): boolean {
  let names: string[];
  try {
    names = readdirSync(dirname(ledgerPath));
  } catch {
    return false;
  }

  const sidecarPattern = new RegExp(`^${escapeRegExp(basename(ledgerPath))}\\.g\\d+\\.(?:snapshot\\.json|log)$`);
  return names.some((name) => sidecarPattern.test(name));
}

function generationSnapshotFile(ledgerPath: string, generation: number): string {
  return join(dirname(ledgerPath), `${basename(ledgerPath)}.g${generation}.snapshot.json`);
}

function generationLogFile(ledgerPath: string, generation: number): string {
  return join(dirname(ledgerPath), `${basename(ledgerPath)}.g${generation}.log`);
}

function resolveGenerationPath(ledgerPath: string, value: string, expected: string): string | null {
  if (value.trim().length === 0) return null;
  const resolved = isAbsolute(value) ? value : join(dirname(ledgerPath), value);
  return resolve(resolved) === resolve(expected) ? expected : null;
}

function notifyCorruptManifest(
  ledgerPath: string,
  onAppendRecovery: ((notice: AppendOnlyLedgerRecoveryNotice) => void) | undefined,
): void {
  onAppendRecovery?.({ filePath: ledgerPath, reason: "corrupt-manifest" });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
