import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

import { asRecord } from "./types.js";

export const RECOVERY_CHECKPOINT_SCHEMA_VERSION = 1;

export interface RecoveryCheckpoint {
  schemaVersion: typeof RECOVERY_CHECKPOINT_SCHEMA_VERSION;
  sourceKey: string;
  projectionVersion: string;
  ledgerFingerprint: string;
  sessionRevisions: Record<string, string>;
}

export interface RecoveryCheckpointExpectations {
  sourceKey: string;
  projectionVersion: string;
  ledgerFingerprint: string;
}

export interface RecoveryCheckpointRecoveryNotice {
  filePath: string;
  quarantinePath: string | null;
  reason: "corrupt" | `schema-${number}`;
}

export function createRecoveryCheckpointPath(ledgerPath: string): string {
  return `${requireNonEmptyText(ledgerPath, "ledgerPath")}.recovery.json`;
}

export function createLedgerFingerprint(ledgerPath: string): string {
  const filePath = requireNonEmptyText(ledgerPath, "ledgerPath");
  if (!existsSync(filePath)) {
    return createLedgerFingerprintFromContents(filePath, null);
  }
  return createLedgerFingerprintFromContents(filePath, readFileSync(filePath, "utf8"));
}

export function createLedgerFingerprintFromContents(
  ledgerPath: string,
  contents: string | null,
): string {
  const filePath = resolve(requireNonEmptyText(ledgerPath, "ledgerPath"));
  const hash = createHash("sha256");
  hash.update(filePath);
  hash.update("\0");
  if (contents === null) {
    hash.update("missing");
  } else {
    hash.update("file");
    hash.update("\0");
    hash.update(contents);
  }
  return `sha256:${hash.digest("hex")}`;
}

export function loadRecoveryCheckpoint(
  filePath: string,
  expectations: RecoveryCheckpointExpectations,
  onRecovery?: ((notice: RecoveryCheckpointRecoveryNotice) => void) | undefined,
): RecoveryCheckpoint | null {
  const expectedSourceKey = requireNonEmptyText(expectations.sourceKey, "expectations.sourceKey");
  const expectedProjectionVersion = requireNonEmptyText(
    expectations.projectionVersion,
    "expectations.projectionVersion",
  );
  const expectedLedgerFingerprint = requireNonEmptyText(
    expectations.ledgerFingerprint,
    "expectations.ledgerFingerprint",
  );

  if (!existsSync(filePath)) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  } catch {
    const quarantinePath = quarantineRecoveryCheckpointFile(filePath, "corrupt");
    onRecovery?.({ filePath, quarantinePath, reason: "corrupt" });
    return null;
  }

  const record = asRecord(raw);
  const schemaVersion = record.schemaVersion;
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    const quarantinePath = quarantineRecoveryCheckpointFile(filePath, "corrupt");
    onRecovery?.({ filePath, quarantinePath, reason: "corrupt" });
    return null;
  }
  if (schemaVersion !== RECOVERY_CHECKPOINT_SCHEMA_VERSION) {
    const quarantinePath = quarantineRecoveryCheckpointFile(filePath, `schema-${schemaVersion}`);
    onRecovery?.({ filePath, quarantinePath, reason: `schema-${schemaVersion}` });
    return null;
  }

  const checkpoint = normalizeRecoveryCheckpoint(record);
  if (checkpoint === null) {
    const quarantinePath = quarantineRecoveryCheckpointFile(filePath, "corrupt");
    onRecovery?.({ filePath, quarantinePath, reason: "corrupt" });
    return null;
  }

  if (
    checkpoint.sourceKey !== expectedSourceKey ||
    checkpoint.projectionVersion !== expectedProjectionVersion ||
    checkpoint.ledgerFingerprint !== expectedLedgerFingerprint
  ) {
    return null;
  }

  return checkpoint;
}

export function saveRecoveryCheckpoint(filePath: string, checkpoint: RecoveryCheckpoint): void {
  const normalized = normalizeRecoveryCheckpoint(checkpoint);
  if (normalized === null) {
    throw new Error("recovery checkpoint: invalid checkpoint record");
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeJsonAtomically(filePath, JSON.stringify(normalized, null, 2));
}

function normalizeRecoveryCheckpoint(value: unknown): RecoveryCheckpoint | null {
  const record = asRecord(value);
  const schemaVersion = record.schemaVersion;
  if (schemaVersion !== RECOVERY_CHECKPOINT_SCHEMA_VERSION) {
    return null;
  }

  const sourceKey = textOrNull(record.sourceKey);
  const projectionVersion = textOrNull(record.projectionVersion);
  const ledgerFingerprint = textOrNull(record.ledgerFingerprint);
  const sessionRevisions = normalizeSessionRevisions(record.sessionRevisions);
  if (!sourceKey || !projectionVersion || !ledgerFingerprint || sessionRevisions === null) {
    return null;
  }

  return {
    schemaVersion: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
    sourceKey,
    projectionVersion,
    ledgerFingerprint,
    sessionRevisions,
  };
}

function quarantineRecoveryCheckpointFile(filePath: string, reason: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const quarantinePath = `${filePath}.${reason}-${Date.now()}-${process.pid}`;
  try {
    renameSync(filePath, quarantinePath);
    return quarantinePath;
  } catch {
    return null;
  }
}

function writeJsonAtomically(filePath: string, contents: string): void {
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
    // Directory syncing is not supported on every filesystem.
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function requireNonEmptyText(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`recovery checkpoint: invalid ${name}`);
  }
  return value;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeSessionRevisions(value: unknown): Record<string, string> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const revisions: Record<string, string> = {};
  for (const [sessionId, revision] of Object.entries(value)) {
    const normalizedSessionId = textOrNull(sessionId);
    const normalizedRevision = textOrNull(revision);
    if (normalizedSessionId && normalizedRevision) {
      revisions[normalizedSessionId] = normalizedRevision;
    }
  }
  return revisions;
}
