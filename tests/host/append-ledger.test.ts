import { createHash } from "node:crypto";
import { appendFile, link, mkdir, mkdtemp, readFile, readdir, symlink, unlink, writeFile } from "node:fs/promises";
import { existsSync, lstatSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative } from "node:path";

import { expect, test, vi } from "vitest";

import { createAppendOnlyCostEventRepository, createFileCostEventRepository } from "../../packages/host/src";
import type { AppendOnlyLedgerCompactionStage } from "../../packages/host/src";

const identity = {
  sessionId: "append-session",
  turnId: "turn-1",
  stepId: "step-1",
  attemptId: "attempt-1",
};

function event(id: string, status: "estimated" | "settled", amountMicroCny: number) {
  return {
    id,
    ...identity,
    status,
    amountMicroCny,
    requestStartedAt: "2026-08-19T01:00:00.000Z",
    completedAt: status === "settled" ? "2026-08-19T01:00:01.000Z" : undefined,
    source: status === "settled" ? "final_usage" as const : "stream" as const,
  };
}

function expectRestartedIds(filePath: string, ids: readonly string[]): void {
  const restarted = createAppendOnlyCostEventRepository({ filePath });
  expect(restarted.list().map((item) => item.id)).toEqual(ids);
}

function createCompactFailureFixture(
  stage: AppendOnlyLedgerCompactionStage,
) {
  return async () => {
    const directory = await mkdtemp(join(tmpdir(), "mymeter-append-compact-failure-"));
    const filePath = join(directory, "ledger.json");
    let failed = false;
    const repository = createAppendOnlyCostEventRepository({
      filePath,
      compactionHooks: {
        failAt(currentStage, context) {
          if (currentStage !== stage || failed) return;
          failed = true;
          if (stage === "candidate-validation") {
            writeFileSync(context.nextManifest.snapshotFile, "{not-json");
            return;
          }
          throw new Error(`injected ${stage} failure`);
        },
      },
    });
    repository.commit?.([event(`${stage}-old`, "settled", 1400)]);
    const filesBefore = await readLedgerFiles(directory);

    expect(() => repository.compact()).toThrow(new RegExp(`injected ${stage} failure|json`, "i"));

    expect(await readLedgerFiles(directory)).toEqual(filesBefore);
    expectRestartedIds(filePath, [`${stage}-old`]);

    repository.compact();
    expect(JSON.parse(readFileSync(filePath, "utf8"))).toMatchObject({ generation: 2 });
    expectRestartedIds(filePath, [`${stage}-old`]);
  };
}

async function readLedgerFiles(directory: string): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  for (const name of await readdir(directory)) {
    if (!name.startsWith("ledger.json")) continue;
    snapshot[name] = await readFile(join(directory, name), "utf8");
  }
  return snapshot;
}

async function createDirectorySymlinkOrSkip(target: string, path: string): Promise<boolean> {
  try {
    await symlink(target, path, "dir");
    return true;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP" || code === "EOPNOTSUPP") {
      return false;
    }
    throw error;
  }
}

async function createFileLinkOrSkip(kind: "symlink" | "hardlink", target: string, path: string): Promise<boolean> {
  try {
    if (kind === "symlink") {
      await symlink(target, path);
    } else {
      await link(target, path);
    }
    return true;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP" || code === "EOPNOTSUPP") {
      return false;
    }
    throw error;
  }
}

test("append ledger commits deltas and restores replacement state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-ledger-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });

  repository.commit?.([event("stream-event", "estimated", 120)]);
  repository.commit?.([event("final-event", "settled", 180)]);
  expect(repository.list()).toHaveLength(1);
  expect(repository.list()[0]).toMatchObject({ id: "final-event", status: "settled", amountMicroCny: 180 });

  const restarted = createAppendOnlyCostEventRepository({ filePath });
  expect(restarted.list()).toEqual(repository.list());
  expect(restarted.ledgerFingerprint?.()).toBe(repository.ledgerFingerprint?.());
});

test("append ledger upsert returns the canonical event when a lower-priority id is rejected", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-upsert-canonical-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });

  const canonical = repository.upsert(event("canonical-final", "settled", 180));
  repository.upsert({ ...event("session-b-final", "settled", 240), sessionId: "append-session-b" });

  const result = repository.upsert(event("late-stream", "estimated", 120));

  expect(result).toEqual(canonical);
  expect(repository.getById("late-stream")).toBeUndefined();
  expect(repository.list().map((item) => item.id)).toEqual(["canonical-final", "session-b-final"]);
});

test("append ledger truncates an incomplete tail without losing committed frames", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-tail-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("tail-event", "settled", 200)]);
  const logPath = `${filePath}.g1.log`;
  await appendFile(logPath, "17\n{\"partial\":");

  const onRecovery = vi.fn();
  const restarted = createAppendOnlyCostEventRepository({ filePath, onRecovery });
  expect(restarted.list()).toHaveLength(1);
  expect(onRecovery).toHaveBeenCalledWith({ filePath, reason: "tail-truncated" });
  expect((await readFile(logPath)).toString().endsWith("{\"partial\":")).toBe(false);
});

test("append ledger fsyncs a truncated tail and remains stable without another commit", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-tail-durable-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("durable-tail-event", "settled", 205)]);
  const logPath = `${filePath}.g1.log`;
  await appendFile(logPath, "17\n{\"partial\":");

  const recovered = createAppendOnlyCostEventRepository({ filePath });

  expect(recovered.list().map((item) => item.id)).toEqual(["durable-tail-event"]);
  const restarted = createAppendOnlyCostEventRepository({ filePath });
  expect(restarted.list().map((item) => item.id)).toEqual(["durable-tail-event"]);
  expect((await readFile(logPath)).toString().endsWith("{\"partial\":")).toBe(false);
});

test("append ledger rejects a corrupted middle frame", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-corrupt-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("corrupt-a", "settled", 200)]);
  repository.commit?.([event("corrupt-b", "settled", 300)]);
  const logPath = `${filePath}.g1.log`;
  const bytes = readFileSync(logPath);
  const bodyOffset = bytes.indexOf(10) + 1;
  bytes[bodyOffset] = bytes[bodyOffset] === 123 ? 124 : 123;
  writeFileSync(logPath, bytes);

  const onRecovery = vi.fn();
  expect(() => createAppendOnlyCostEventRepository({ filePath, onRecovery })).toThrow(/hash chain|invalid frame/i);
  expect(onRecovery).toHaveBeenCalledWith({ filePath, reason: "corrupt-log" });
});

test("append ledger imports legacy JSON and compacts to a new generation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-legacy-"));
  const filePath = join(directory, "ledger.json");
  const legacyEvents = [event("legacy", "settled", 400)];
  await writeFile(filePath, JSON.stringify({ schemaVersion: 1, events: legacyEvents }));

  const repository = createAppendOnlyCostEventRepository({ filePath });
  const legacyBackupPath = `${filePath}.legacy.json`;
  expect(repository.list().map((item) => item.id)).toEqual(["legacy"]);
  expect(createFileCostEventRepository({ filePath: legacyBackupPath }).list()).toEqual(repository.list());
  repository.compact();
  expect(repository.list().map((item) => item.id)).toEqual(["legacy"]);
  expect(await readdir(directory)).toContain("ledger.json.g2.snapshot.json");
  expect(await readdir(directory)).not.toContain("ledger.json.g1.snapshot.json");
  expect(await readdir(directory)).toContain("ledger.json.legacy.json");
});

test("append ledger refuses same-path legacy migration when the backup target cannot be replaced", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-legacy-backup-blocked-"));
  const filePath = join(directory, "ledger.json");
  const backupPath = `${filePath}.legacy.json`;
  const legacyContents = JSON.stringify({ schemaVersion: 1, events: [event("legacy-blocked", "settled", 405)] });
  await writeFile(filePath, legacyContents);
  await mkdir(backupPath);

  expect(() => createAppendOnlyCostEventRepository({ filePath })).toThrow(/backup|legacy/i);

  expect(await readFile(filePath, "utf8")).toBe(legacyContents);
  expect(await readdir(directory)).not.toContain("ledger.json.g1.snapshot.json");
  expect(await readdir(directory)).not.toContain("ledger.json.g1.log");
});

test("append ledger keeps a valid existing same-path legacy backup without overwriting it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-legacy-backup-existing-"));
  const filePath = join(directory, "ledger.json");
  const backupPath = `${filePath}.legacy.json`;
  const legacyContents = JSON.stringify({ schemaVersion: 1, events: [event("legacy-existing", "settled", 406)] });
  const existingBackup = JSON.stringify({ schemaVersion: 1, events: [event("backup-existing", "settled", 407)] });
  await writeFile(filePath, legacyContents);
  await writeFile(backupPath, existingBackup);

  const repository = createAppendOnlyCostEventRepository({ filePath });

  expect(repository.list().map((item) => item.id)).toEqual(["legacy-existing"]);
  expect(await readFile(backupPath, "utf8")).toBe(existingBackup);
  expect(await readdir(directory)).toContain("ledger.json.g1.snapshot.json");
  expect(await readdir(directory)).toContain("ledger.json.g1.log");
});

test("append ledger refuses legacy import when the first generation log is a pre-existing link", async () => {
  for (const kind of ["symlink", "hardlink"] as const) {
    const directory = await mkdtemp(join(tmpdir(), `mymeter-append-legacy-${kind}-g1-log-`));
    const filePath = join(directory, "ledger.json");
    const logPath = join(directory, "ledger.json.g1.log");
    const victimPath = join(directory, "victim.log");
    const legacyContents = JSON.stringify({
      schemaVersion: 1,
      events: [event(`${kind}-legacy-import`, "settled", 409)],
    }, null, 2);
    const victimContents = `pre-existing ${kind} victim`;
    await writeFile(filePath, legacyContents);
    await writeFile(victimPath, victimContents);
    if (!await createFileLinkOrSkip(kind, victimPath, logPath)) continue;
    const filesBefore = await readLedgerFiles(directory);

    expect(() => createAppendOnlyCostEventRepository({ filePath })).toThrow(/sidecar|exist|link/i);

    expect(await readFile(filePath, "utf8")).toBe(legacyContents);
    expect(await readFile(victimPath, "utf8")).toBe(victimContents);
    expect(await readLedgerFiles(directory)).toEqual(filesBefore);
    expect(await readdir(directory)).not.toContain("ledger.json.g1.snapshot.json");
    expect(lstatSync(logPath).isSymbolicLink()).toBe(kind === "symlink");
  }
});

test("append ledger refuses same-path legacy migration when an existing backup is invalid", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-legacy-backup-invalid-"));
  const filePath = join(directory, "ledger.json");
  const backupPath = `${filePath}.legacy.json`;
  const legacyContents = JSON.stringify({ schemaVersion: 1, events: [event("legacy-invalid-backup", "settled", 408)] });
  const invalidBackup = JSON.stringify({ schemaVersion: 1, events: [{ id: "invalid-backup" }] });
  await writeFile(filePath, legacyContents);
  await writeFile(backupPath, invalidBackup);

  expect(() => createAppendOnlyCostEventRepository({ filePath })).toThrow(/backup|legacy|sessionId/i);

  expect(await readFile(filePath, "utf8")).toBe(legacyContents);
  expect(await readFile(backupPath, "utf8")).toBe(invalidBackup);
  expect(await readdir(directory)).not.toContain("ledger.json.g1.snapshot.json");
  expect(await readdir(directory)).not.toContain("ledger.json.g1.log");
});

test("append ledger exports a rollback JSON readable by the file ledger", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-export-json-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("export-stream", "estimated", 120)]);
  repository.commit?.([event("export-final", "settled", 180)]);
  const expectedEvents = repository.list();

  repository.exportToJson();

  const exported = JSON.parse(await readFile(filePath, "utf8")) as { schemaVersion: number; events: unknown[] };
  expect(exported.schemaVersion).toBe(1);
  expect(exported.events).toEqual(expectedEvents);
  expect(createFileCostEventRepository({ filePath }).list()).toEqual(expectedEvents);
  expect(await readdir(directory)).toContain("ledger.json.g1.snapshot.json");
  expect(await readdir(directory)).toContain("ledger.json.g1.log");
});

test("append ledger becomes read-only after default rollback JSON export", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-export-terminal-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("terminal-export", "settled", 190)]);
  const expectedEvents = repository.list();

  const exportedFingerprint = repository.exportToJson();

  expect(repository.ledgerFingerprint?.()).toBe(exportedFingerprint);
  expect(repository.ledgerFingerprint?.()).toBe(createFileCostEventRepository({ filePath }).ledgerFingerprint?.());
  expect(repository.list()).toEqual(expectedEvents);
  expect(repository.getById("terminal-export")).toEqual(expectedEvents[0]);
  expect(() => repository.commit?.([event("terminal-commit", "settled", 191)])).toThrow(/exported|read-only/i);
  expect(() => repository.upsert(event("terminal-upsert", "settled", 192))).toThrow(/exported|read-only/i);
  expect(() => repository.replaceAll([event("terminal-replace", "settled", 193)])).toThrow(/exported|read-only/i);
  expect(() => repository.clear()).toThrow(/exported|read-only/i);
  expect(() => repository.compact()).toThrow(/exported|read-only/i);
});

test("append ledger rejects JSON export targets inside the active generation sidecar", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-export-sidecar-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("sidecar-kept", "settled", 200)]);
  const manifest = JSON.parse(await readFile(filePath, "utf8")) as {
    generation: number;
    snapshotFile: string;
    logFile: string;
  };
  const snapshotPath = isAbsolute(manifest.snapshotFile)
    ? manifest.snapshotFile
    : join(dirname(filePath), manifest.snapshotFile);
  const logPath = isAbsolute(manifest.logFile)
    ? manifest.logFile
    : join(dirname(filePath), manifest.logFile);

  for (const targetFilePath of [
    snapshotPath,
    logPath,
    join(directory, `ledger.json.g${manifest.generation}.rollback.json`),
  ]) {
    const filesBefore = await readLedgerFiles(directory);

    expect(() => repository.exportToJson({ filePath: targetFilePath })).toThrow(/active generation sidecar/i);

    expect(await readLedgerFiles(directory)).toEqual(filesBefore);
    expectRestartedIds(filePath, ["sidecar-kept"]);
  }
});

test("append ledger rejects JSON export targets inside the active generation through a symlinked directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-export-sidecar-symlink-"));
  const filePath = join(directory, "ledger.json");
  const aliasDirectory = join(dirname(directory), `${basename(directory)}-alias`);
  if (!await createDirectorySymlinkOrSkip(directory, aliasDirectory)) return;
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("sidecar-symlink-kept", "settled", 201)]);
  const manifest = JSON.parse(await readFile(filePath, "utf8")) as {
    generation: number;
    snapshotFile: string;
    logFile: string;
  };

  for (const targetFilePath of [
    join(aliasDirectory, basename(manifest.snapshotFile)),
    join(aliasDirectory, basename(manifest.logFile)),
    join(aliasDirectory, `ledger.json.g${manifest.generation}.rollback.json`),
  ]) {
    const filesBefore = await readLedgerFiles(directory);

    expect(() => repository.exportToJson({ filePath: targetFilePath })).toThrow(/active generation sidecar/i);

    expect(await readLedgerFiles(directory)).toEqual(filesBefore);
    expectRestartedIds(filePath, ["sidecar-symlink-kept"]);
  }
});

test("append ledger treats a symlinked directory alias to the manifest as terminal same-path JSON export", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-export-manifest-symlink-"));
  const filePath = join(directory, "ledger.json");
  const aliasDirectory = join(dirname(directory), `${basename(directory)}-alias`);
  if (!await createDirectorySymlinkOrSkip(directory, aliasDirectory)) return;
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("manifest-symlink-export", "settled", 202)]);
  const expectedEvents = repository.list();

  const exportedFingerprint = repository.exportToJson({ filePath: join(aliasDirectory, "ledger.json") });

  expect(repository.ledgerFingerprint?.()).toBe(exportedFingerprint);
  expect(createFileCostEventRepository({ filePath }).list()).toEqual(expectedEvents);
  expect(() => repository.commit?.([event("manifest-symlink-write", "settled", 203)])).toThrow(/exported|read-only/i);
});

test("append ledger rejects JSON export through a final symlink to the active manifest without freezing the repository", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-export-final-symlink-"));
  const filePath = join(directory, "ledger.json");
  const aliasPath = join(directory, "alias-ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([{
    ...event("manifest-final-symlink-before", "settled", 203),
    sessionId: "manifest-final-symlink-before",
  }]);
  try {
    await symlink(filePath, aliasPath);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP" || code === "EOPNOTSUPP") return;
    throw error;
  }
  const manifestBefore = await readFile(filePath, "utf8");
  const snapshotBefore = await readFile(`${filePath}.g1.snapshot.json`, "utf8");
  const logBefore = await readFile(`${filePath}.g1.log`, "utf8");
  const filesBefore = await readdir(directory);

  expect(() => repository.exportToJson({ filePath: aliasPath })).toThrow(/symlink|active manifest/i);

  expect(await readFile(filePath, "utf8")).toBe(manifestBefore);
  expect(await readFile(`${filePath}.g1.snapshot.json`, "utf8")).toBe(snapshotBefore);
  expect(await readFile(`${filePath}.g1.log`, "utf8")).toBe(logBefore);
  expect(lstatSync(aliasPath).isSymbolicLink()).toBe(true);
  expect(await readdir(directory)).toEqual(filesBefore);
  repository.commit?.([{
    ...event("manifest-final-symlink-after", "settled", 204),
    sessionId: "manifest-final-symlink-after",
  }]);
  expectRestartedIds(filePath, ["manifest-final-symlink-before", "manifest-final-symlink-after"]);
});

test("append ledger treats a case-only manifest alias as terminal same-path JSON export on case-insensitive filesystems", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-export-manifest-case-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  const caseAliasPath = join(directory, "LEDGER.JSON");
  if (!existsSync(caseAliasPath)) return;
  repository.commit?.([event("manifest-case-export", "settled", 204)]);
  const expectedEvents = repository.list();

  const exportedFingerprint = repository.exportToJson({ filePath: caseAliasPath });

  expect(repository.ledgerFingerprint?.()).toBe(exportedFingerprint);
  expect(createFileCostEventRepository({ filePath }).list()).toEqual(expectedEvents);
  expect(() => repository.commit?.([event("manifest-case-write", "settled", 205)])).toThrow(/exported|read-only/i);
});

test("append ledger reopens a case-only manifest alias without quarantining on case-insensitive filesystems", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-reopen-manifest-case-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([{ ...event("manifest-case-reopen-before", "settled", 206), sessionId: "manifest-case-before" }]);
  const caseAliasPath = join(directory, "LEDGER.JSON");
  if (!existsSync(caseAliasPath)) return;

  const onRecovery = vi.fn();
  const reopened = createAppendOnlyCostEventRepository({ filePath: caseAliasPath, onRecovery });
  reopened.commit?.([{ ...event("manifest-case-reopen-after", "settled", 207), sessionId: "manifest-case-after" }]);

  expect(onRecovery).not.toHaveBeenCalled();
  expect(reopened.list().map((item) => item.id)).toEqual([
    "manifest-case-reopen-before",
    "manifest-case-reopen-after",
  ]);
  expect((await readdir(directory)).some((name) => name.includes("corrupt-manifest"))).toBe(false);
  expectRestartedIds(filePath, ["manifest-case-reopen-before", "manifest-case-reopen-after"]);
});

test("append ledger refuses a final symlink ledgerPath before migrating a JSON target", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-symlink-json-target-"));
  const filePath = join(directory, "ledger.json");
  const aliasPath = join(directory, "alias-ledger.json");
  const targetContents = JSON.stringify({
    schemaVersion: 1,
    events: [event("symlink-json-target", "settled", 208)],
  });
  await writeFile(filePath, targetContents);
  try {
    await symlink(filePath, aliasPath);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP" || code === "EOPNOTSUPP") return;
    throw error;
  }
  const filesBefore = await readdir(directory);

  expect(() => createAppendOnlyCostEventRepository({ filePath: aliasPath })).toThrow(/symlink|symbolic link/i);

  expect(await readFile(filePath, "utf8")).toBe(targetContents);
  expect(lstatSync(aliasPath).isSymbolicLink()).toBe(true);
  expect(await readdir(directory)).toEqual(filesBefore);
});

test("append ledger keeps old JSON and append generation when JSON export validation fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-export-validation-fail-"));
  const filePath = join(directory, "ledger.json");
  const legacyFilePath = join(directory, "legacy.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("append-kept", "settled", 220)]);
  await writeFile(legacyFilePath, JSON.stringify({
    schemaVersion: 1,
    events: [event("old-json", "settled", 210)],
  }, null, 2));
  const oldJson = await readFile(legacyFilePath, "utf8");
  const manifestBefore = await readFile(filePath, "utf8");
  const snapshotBefore = await readFile(join(directory, "ledger.json.g1.snapshot.json"), "utf8");
  const logBefore = await readFile(join(directory, "ledger.json.g1.log"), "utf8");

  expect(() => repository.exportToJson({
    filePath: legacyFilePath,
    verifyCandidate() {
      throw new Error("injected validation failure");
    },
  })).toThrow(/validation failure/);

  expect(await readFile(legacyFilePath, "utf8")).toBe(oldJson);
  expect(await readFile(filePath, "utf8")).toBe(manifestBefore);
  expect(await readFile(join(directory, "ledger.json.g1.snapshot.json"), "utf8")).toBe(snapshotBefore);
  expect(await readFile(join(directory, "ledger.json.g1.log"), "utf8")).toBe(logBefore);
  expectRestartedIds(filePath, ["append-kept"]);
});

test("append ledger rejects stale JSON export after candidate verification", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-export-stale-verify-"));
  const filePath = join(directory, "ledger.json");
  const targetFilePath = join(directory, "legacy.json");
  const current = createAppendOnlyCostEventRepository({ filePath });
  current.commit?.([{ ...event("export-current-before", "settled", 225), sessionId: "export-current-before" }]);
  const exporter = createAppendOnlyCostEventRepository({ filePath });
  await writeFile(targetFilePath, JSON.stringify({
    schemaVersion: 1,
    events: [event("export-target-before", "settled", 224)],
  }, null, 2));
  const targetBefore = await readFile(targetFilePath, "utf8");
  const manifestBefore = await readFile(filePath, "utf8");

  expect(() => exporter.exportToJson({
    filePath: targetFilePath,
    verifyCandidate() {
      current.commit?.([{ ...event("export-current-after", "settled", 226), sessionId: "export-current-after" }]);
    },
  })).toThrow(/reopen/i);

  expect(await readFile(targetFilePath, "utf8")).toBe(targetBefore);
  expect(await readFile(filePath, "utf8")).toBe(manifestBefore);
  expectRestartedIds(filePath, ["export-current-before", "export-current-after"]);
});

test("append ledger keeps append generation when JSON export cannot write the candidate", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-export-write-fail-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("write-failure-kept", "settled", 230)]);
  const blockedParent = join(directory, "blocked");
  await writeFile(blockedParent, "not a directory");
  const manifestBefore = await readFile(filePath, "utf8");
  const snapshotBefore = await readFile(join(directory, "ledger.json.g1.snapshot.json"), "utf8");
  const logBefore = await readFile(join(directory, "ledger.json.g1.log"), "utf8");

  expect(() => repository.exportToJson({ filePath: join(blockedParent, "ledger.json") })).toThrow();

  expect(await readFile(filePath, "utf8")).toBe(manifestBefore);
  expect(await readFile(join(directory, "ledger.json.g1.snapshot.json"), "utf8")).toBe(snapshotBefore);
  expect(await readFile(join(directory, "ledger.json.g1.log"), "utf8")).toBe(logBefore);
  expectRestartedIds(filePath, ["write-failure-kept"]);
});

test("append ledger keeps the old generation when compaction snapshot writing fails", createCompactFailureFixture("snapshot-write"));

test("append ledger keeps the old generation when compaction log writing fails", createCompactFailureFixture("log-write"));

test("append ledger keeps the old generation when compaction candidate validation fails", createCompactFailureFixture("candidate-validation"));

test("append ledger keeps the old generation when compaction manifest switch fails", createCompactFailureFixture("manifest-switch"));

test("append ledger refuses compaction when the next generation log is a pre-existing link", async () => {
  for (const kind of ["symlink", "hardlink"] as const) {
    const directory = await mkdtemp(join(tmpdir(), `mymeter-append-compact-${kind}-next-log-`));
    const filePath = join(directory, "ledger.json");
    const repository = createAppendOnlyCostEventRepository({ filePath });
    repository.commit?.([event(`${kind}-next-log-victim`, "settled", 1430)]);
    const manifestBefore = await readFile(filePath, "utf8");
    const activeLogPath = join(directory, "ledger.json.g1.log");
    const activeLogBefore = await readFile(activeLogPath, "utf8");
    const nextLogPath = join(directory, "ledger.json.g2.log");
    if (!await createFileLinkOrSkip(kind, activeLogPath, nextLogPath)) continue;
    const filesBefore = await readLedgerFiles(directory);

    expect(() => repository.compact()).toThrow(/sidecar|exist|link/i);

    expect(await readFile(filePath, "utf8")).toBe(manifestBefore);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toMatchObject({ generation: 1 });
    expect(await readFile(activeLogPath, "utf8")).toBe(activeLogBefore);
    expect(await readLedgerFiles(directory)).toEqual(filesBefore);
    expectRestartedIds(filePath, [`${kind}-next-log-victim`]);
  }
});

test("append ledger rejects compaction when the active log changes after candidate validation starts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-compact-stale-candidate-"));
  const filePath = join(directory, "ledger.json");
  const current = createAppendOnlyCostEventRepository({ filePath });
  current.commit?.([{ ...event("compact-current-before", "settled", 1440), sessionId: "compact-current-before" }]);
  let injected = false;
  const compacting = createAppendOnlyCostEventRepository({
    filePath,
    compactionHooks: {
      failAt(stage) {
        if (stage !== "candidate-validation" || injected) return;
        injected = true;
        current.commit?.([{ ...event("compact-current-after", "settled", 1441), sessionId: "compact-current-after" }]);
      },
    },
  });
  const manifestBefore = await readFile(filePath, "utf8");
  const filesBefore = await readLedgerFiles(directory);

  expect(() => compacting.compact()).toThrow(/reopen/i);

  expect(await readFile(filePath, "utf8")).toBe(manifestBefore);
  expect(await readLedgerFiles(directory)).toEqual({
    ...filesBefore,
    "ledger.json.g1.log": await readFile(join(directory, "ledger.json.g1.log"), "utf8"),
  });
  expect(await readdir(directory)).not.toContain("ledger.json.g2.snapshot.json");
  expect(await readdir(directory)).not.toContain("ledger.json.g2.log");
  expectRestartedIds(filePath, ["compact-current-before", "compact-current-after"]);
});

test("append ledger survives old generation cleanup failure after switching manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-compact-cleanup-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({
    filePath,
    compactionHooks: {
      failAt(stage) {
        if (stage === "old-generation-cleanup") throw new Error("injected cleanup failure");
      },
    },
  });
  repository.commit?.([event("cleanup-kept", "settled", 1450)]);

  repository.compact();

  expect(JSON.parse(readFileSync(filePath, "utf8"))).toMatchObject({ generation: 2 });
  expect(existsSync(join(directory, "ledger.json.g1.snapshot.json"))).toBe(true);
  expect(existsSync(join(directory, "ledger.json.g1.log"))).toBe(true);
  expectRestartedIds(filePath, ["cleanup-kept"]);
});

test("append ledger rejects a damaged active manifest instead of creating an empty generation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-manifest-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.replaceAll([event("manifest-active", "settled", 500)]);
  await writeFile(filePath, JSON.stringify({
    schemaVersion: 1,
    generation: 1,
    snapshotFile: 17,
    logFile: "x",
    events: [],
  }));

  const onRecovery = vi.fn();
  expect(() => createAppendOnlyCostEventRepository({ filePath, onRecovery })).toThrow(/manifest/i);
  expect(onRecovery).toHaveBeenCalledWith({ filePath, reason: "corrupt-manifest" });
  expect((await readdir(directory)).some((name) => name.startsWith("ledger.json.corrupt-manifest-"))).toBe(true);
});

test("append ledger rejects a missing active manifest when generation files remain", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-missing-manifest-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("missing-manifest", "settled", 550)]);
  await unlink(filePath);

  const onRecovery = vi.fn();
  expect(() => createAppendOnlyCostEventRepository({ filePath, onRecovery })).toThrow(/manifest/i);
  expect(onRecovery).toHaveBeenCalledWith({ filePath, reason: "corrupt-manifest" });
  expect(await readFile(join(directory, "ledger.json.g1.log"), "utf8")).toContain("missing-manifest");
});

test("append ledger rejects manifest generation paths outside the ledger family", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-adjacent-path-"));
  const filePath = join(directory, "ledger.json");
  createAppendOnlyCostEventRepository({ filePath });
  const manifest = JSON.parse(await readFile(filePath, "utf8")) as {
    schemaVersion: number;
    generation: number;
    snapshotFile: string;
    logFile: string;
  };
  const foreignSnapshot = join(directory, "foreign.snapshot.json");
  await writeFile(foreignSnapshot, JSON.stringify({ schemaVersion: 1, events: [event("foreign", "settled", 575)] }));
  await writeFile(filePath, JSON.stringify({ ...manifest, snapshotFile: foreignSnapshot }));

  const onRecovery = vi.fn();
  expect(() => createAppendOnlyCostEventRepository({ filePath, onRecovery })).toThrow(/manifest/i);
  expect(onRecovery).toHaveBeenCalledWith({ filePath, reason: "corrupt-manifest" });
  expect(await readFile(foreignSnapshot, "utf8")).toContain("foreign");
});

test("append ledger rejects a missing active log instead of restoring an empty log", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-missing-log-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.commit?.([event("missing-log", "settled", 600)]);
  await unlink(join(directory, "ledger.json.g1.log"));

  const onRecovery = vi.fn();
  expect(() => createAppendOnlyCostEventRepository({ filePath, onRecovery })).toThrow(/log/i);
  expect(onRecovery).toHaveBeenCalledWith({ filePath, reason: "corrupt-log" });
});

test("append ledger fingerprint covers canonical snapshot contents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-fingerprint-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.replaceAll([event("snapshot-original", "settled", 700)]);
  const originalFingerprint = repository.ledgerFingerprint?.();
  const manifest = JSON.parse(readFileSync(filePath, "utf8")) as { snapshotFile: string };
  const snapshotPath = isAbsolute(manifest.snapshotFile)
    ? manifest.snapshotFile
    : join(dirname(filePath), manifest.snapshotFile);
  await writeFile(snapshotPath, JSON.stringify({
    schemaVersion: 1,
    events: [event("snapshot-replaced", "settled", 701)],
  }));

  const restarted = createAppendOnlyCostEventRepository({ filePath });
  expect(restarted.list().map((item) => item.id)).toEqual(["snapshot-replaced"]);
  expect(restarted.ledgerFingerprint?.()).not.toBe(originalFingerprint);
});

test("append ledger keeps the old generation when replaceAll receives invalid events", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-invalid-replace-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.replaceAll([event("replace-old", "settled", 800)]);
  const manifestBefore = readFileSync(filePath, "utf8");

  expect(() => repository.replaceAll([{ ...event("replace-bad", "settled", 801), status: "bogus" as never }]))
    .toThrow(/status/i);

  expect(readFileSync(filePath, "utf8")).toBe(manifestBefore);
  const restarted = createAppendOnlyCostEventRepository({ filePath });
  expect(restarted.list().map((item) => item.id)).toEqual(["replace-old"]);
});

test("append ledger strictly validates snapshot events during recovery", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-invalid-snapshot-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  repository.replaceAll([event("snapshot-valid", "settled", 900)]);
  await writeFile(join(directory, "ledger.json.g2.snapshot.json"), JSON.stringify({
    schemaVersion: 1,
    events: [{ ...event("snapshot-invalid", "settled", 901), requestStartedAt: "not-a-date" }],
  }));

  const onRecovery = vi.fn();
  expect(() => createAppendOnlyCostEventRepository({ filePath, onRecovery })).toThrow(/timestamp/i);
  expect(onRecovery).toHaveBeenCalledWith({ filePath, reason: "corrupt-snapshot" });
});

test("append ledger strictly validates frame events during recovery", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-invalid-frame-"));
  const filePath = join(directory, "ledger.json");
  createAppendOnlyCostEventRepository({ filePath });
  const body = JSON.stringify({
    schemaVersion: 1,
    sequence: 1,
    previousDigest: "sha256:0",
    events: [{ ...event("frame-invalid", "settled", 1000), amountMicroCny: -1 }],
  });
  const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
  await writeFile(join(directory, "ledger.json.g1.log"), `${Buffer.byteLength(body, "utf8")}\n${body}\n${digest}\n`);

  const onRecovery = vi.fn();
  expect(() => createAppendOnlyCostEventRepository({ filePath, onRecovery })).toThrow(/amountMicroCny/i);
  expect(onRecovery).toHaveBeenCalledWith({ filePath, reason: "corrupt-log" });
});

test("append ledger restarts when a relative filePath includes directories", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-relative-"));
  const filePath = join(directory, "nested", "ledger.json");
  const relativeFilePath = relative(process.cwd(), filePath);
  const repository = createAppendOnlyCostEventRepository({ filePath: relativeFilePath });
  repository.commit?.([event("relative-path", "settled", 1100)]);

  const restarted = createAppendOnlyCostEventRepository({ filePath: relativeFilePath });
  expect(restarted.list().map((item) => item.id)).toEqual(["relative-path"]);
});

test("append ledger commit appends only the frame without rewriting an unchanged manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-no-manifest-rewrite-"));
  const filePath = join(directory, "ledger.json");
  const repository = createAppendOnlyCostEventRepository({ filePath });
  const manifestModifiedAt = statSync(filePath).mtimeMs;
  await new Promise((resolve) => setTimeout(resolve, 20));

  repository.commit?.([event("append-only-frame", "settled", 1200)]);

  expect(statSync(filePath).mtimeMs).toBe(manifestModifiedAt);
  const restarted = createAppendOnlyCostEventRepository({ filePath });
  expect(restarted.list().map((item) => item.id)).toEqual(["append-only-frame"]);
});

test("append ledger rejects a stale second repository instead of forking the hash chain", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-stale-owner-"));
  const filePath = join(directory, "ledger.json");
  const first = createAppendOnlyCostEventRepository({ filePath });
  const second = createAppendOnlyCostEventRepository({ filePath });

  first.commit?.([event("first-owner", "settled", 1300)]);
  expect(() => second.commit?.([event("stale-owner", "settled", 1301)])).toThrow(/reopen/i);

  const afterFirstCommit = createAppendOnlyCostEventRepository({ filePath });
  first.compact();
  expect(() => afterFirstCommit.commit?.([event("stale-generation", "settled", 1302)])).toThrow(/manifest|reopen/i);

  const restarted = createAppendOnlyCostEventRepository({ filePath });
  expect(restarted.list().map((item) => item.id)).toEqual(["first-owner"]);
});

test("append ledger rejects stale compaction operations without changing disk state", async () => {
  const cases = [
    {
      name: "compact",
      mutate: (repository: ReturnType<typeof createAppendOnlyCostEventRepository>) => repository.compact(),
    },
    {
      name: "replaceAll",
      mutate: (repository: ReturnType<typeof createAppendOnlyCostEventRepository>) => {
        repository.replaceAll([event("stale-replacement", "settled", 1401)]);
      },
    },
    {
      name: "clear",
      mutate: (repository: ReturnType<typeof createAppendOnlyCostEventRepository>) => repository.clear(),
    },
  ] as const;

  for (const item of cases) {
    const directory = await mkdtemp(join(tmpdir(), `mymeter-append-stale-${item.name}-`));
    const filePath = join(directory, "ledger.json");
    const current = createAppendOnlyCostEventRepository({ filePath });
    const stale = createAppendOnlyCostEventRepository({ filePath });

    current.commit?.([event(`current-${item.name}`, "settled", 1400)]);
    const diskBefore = await readLedgerFiles(directory);

    expect(() => item.mutate(stale)).toThrow(/reopen/i);
    expect(await readLedgerFiles(directory)).toEqual(diskBefore);

    const restarted = createAppendOnlyCostEventRepository({ filePath });
    expect(restarted.list().map((ledgerEvent) => ledgerEvent.id)).toEqual([`current-${item.name}`]);
  }
});

test("append ledger refuses a corrupt explicit legacy source instead of importing an empty ledger", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-append-corrupt-legacy-source-"));
  const filePath = join(directory, "append-manifest.json");
  const legacyFilePath = join(directory, "legacy.json");
  await writeFile(legacyFilePath, "{not-json");

  const onRecovery = vi.fn();
  expect(() => createAppendOnlyCostEventRepository({ filePath, legacyFilePath, onRecovery }))
    .toThrow(/legacy|json|corrupt/i);
  expect(onRecovery).toHaveBeenCalledWith({ filePath: legacyFilePath, reason: "corrupt-snapshot" });
  await expect(readFile(filePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
});
