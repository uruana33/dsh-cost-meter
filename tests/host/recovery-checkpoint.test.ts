import { readFile, readdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test, vi } from "vitest";

import {
  createLedgerFingerprint,
  createRecoveryCheckpointPath,
  loadRecoveryCheckpoint,
  saveRecoveryCheckpoint,
} from "../../packages/host/src/index";

const checkpoint = {
  schemaVersion: 1 as const,
  sourceKey: "session-query",
  projectionVersion: "projection-v1",
  ledgerFingerprint: "ledger-fp-abc123",
  sessionRevisions: {
    "sess-1": "rev-1",
    "sess-2": "rev-2",
  },
};

const expectations = {
  sourceKey: checkpoint.sourceKey,
  projectionVersion: checkpoint.projectionVersion,
  ledgerFingerprint: checkpoint.ledgerFingerprint,
};

test("saves checkpoints atomically and reloads only when metadata matches", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-checkpoint-"));
  const filePath = createRecoveryCheckpointPath(join(tmp, "ledger.json"));

  saveRecoveryCheckpoint(filePath, checkpoint);

  const names = await readdir(tmp);
  expect(names).toEqual(["ledger.json.recovery.json"]);

  const raw = JSON.parse(await readFile(filePath, "utf8")) as typeof checkpoint;
  expect(raw).toMatchObject(checkpoint);
  expect(loadRecoveryCheckpoint(filePath, expectations)).toEqual(checkpoint);
  expect(
    loadRecoveryCheckpoint(filePath, {
      ...expectations,
      projectionVersion: "projection-v2",
    }),
  ).toBeNull();
  expect(
    loadRecoveryCheckpoint(filePath, {
      ...expectations,
      ledgerFingerprint: "ledger-fp-other",
    }),
  ).toBeNull();
});

test("ledger fingerprint changes when the durable ledger state changes", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-checkpoint-fingerprint-"));
  const ledgerPath = join(tmp, "ledger.json");

  const missingFingerprint = createLedgerFingerprint(ledgerPath);
  await writeFile(ledgerPath, JSON.stringify({ schemaVersion: 1, events: [] }));
  const emptyFingerprint = createLedgerFingerprint(ledgerPath);
  await writeFile(ledgerPath, JSON.stringify({ schemaVersion: 1, events: [{ id: "live-write" }] }));
  const writtenFingerprint = createLedgerFingerprint(ledgerPath);

  expect(emptyFingerprint).not.toBe(missingFingerprint);
  expect(writtenFingerprint).not.toBe(emptyFingerprint);
  expect(writtenFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
});

test("quarantines corrupt checkpoint json and reports recovery", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-checkpoint-corrupt-"));
  const filePath = createRecoveryCheckpointPath(join(tmp, "ledger.json"));
  await writeFile(filePath, "{ not valid json");
  const onRecovery = vi.fn();

  expect(loadRecoveryCheckpoint(filePath, expectations, onRecovery)).toBeNull();
  expect(onRecovery).toHaveBeenCalledWith(expect.objectContaining({
    filePath,
    reason: "corrupt",
    quarantinePath: expect.stringContaining("ledger.json.recovery.json.corrupt-"),
  }));

  const names = await readdir(tmp);
  expect(names.some((name) => name.startsWith("ledger.json.recovery.json.corrupt-"))).toBe(true);
  expect(names).not.toContain("ledger.json.recovery.json");
});

test("quarantines unsupported checkpoint schema versions", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-checkpoint-schema-"));
  const filePath = createRecoveryCheckpointPath(join(tmp, "ledger.json"));
  await writeFile(filePath, JSON.stringify({ ...checkpoint, schemaVersion: 2 }));
  const onRecovery = vi.fn();

  expect(loadRecoveryCheckpoint(filePath, expectations, onRecovery)).toBeNull();
  expect(onRecovery).toHaveBeenCalledWith(expect.objectContaining({
    filePath,
    reason: "schema-2",
    quarantinePath: expect.stringContaining("ledger.json.recovery.json.schema-2-"),
  }));

  const names = await readdir(tmp);
  expect(names.some((name) => name.startsWith("ledger.json.recovery.json.schema-2-"))).toBe(true);
  expect(names).not.toContain("ledger.json.recovery.json");
});
