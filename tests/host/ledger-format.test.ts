import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test, vi } from "vitest";

import {
  createCostEventRepositoryForFormat,
  type CostEventLedgerFormat,
} from "../../packages/host/src";

const supportsCaseInsensitiveAliases = (() => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-format-case-probe-"));
  try {
    const canonicalPath = join(directory, "ledger.json");
    writeFileSync(canonicalPath, "probe");
    return existsSync(join(directory, "LEDGER.JSON"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
})();

const identity = {
  sessionId: "format-session",
  turnId: "turn-1",
  stepId: "step-1",
  attemptId: "attempt-1",
};

function event(id: string, amountMicroCny: number, sessionId = identity.sessionId) {
  return {
    id,
    ...identity,
    sessionId,
    status: "settled" as const,
    amountMicroCny,
    requestStartedAt: "2026-08-19T01:00:00.000Z",
    completedAt: "2026-08-19T01:00:01.000Z",
    source: "final_usage" as const,
  };
}

async function createLedgerPath(prefix: string): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), prefix)), "ledger.json");
}

async function createSymlinkOrSkip(target: string, path: string): Promise<boolean> {
  try {
    await symlink(target, path);
    return true;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP" || code === "EOPNOTSUPP") return false;
    throw error;
  }
}

test("ledger format factory defaults to the JSON repository", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-json-default-");
  const repository = createCostEventRepositoryForFormat({ ledgerPath, format: undefined });

  repository.upsert(event("json-default", 100));

  const persisted = JSON.parse(await readFile(ledgerPath, "utf8")) as {
    schemaVersion?: number;
    events?: Array<{ id?: string }>;
    generation?: unknown;
  };
  expect(persisted).toMatchObject({ schemaVersion: 1, events: [{ id: "json-default" }] });
  expect(persisted.generation).toBeUndefined();

  const restarted = createCostEventRepositoryForFormat({ ledgerPath });
  expect(restarted.list().map((item) => item.id)).toEqual(["json-default"]);
});

test("ledger format factory default JSON mode can read a final symlink to a schema-v1 JSON ledger", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-json-symlink-default-");
  const aliasPath = join(join(ledgerPath, ".."), "alias-ledger.json");
  await writeFile(ledgerPath, JSON.stringify({
    schemaVersion: 1,
    events: [event("json-symlink-default", 110)],
  }));
  if (!await createSymlinkOrSkip(ledgerPath, aliasPath)) return;

  const repository = createCostEventRepositoryForFormat({ ledgerPath: aliasPath });

  expect(repository.list().map((item) => item.id)).toEqual(["json-symlink-default"]);
  expect(lstatSync(aliasPath).isSymbolicLink()).toBe(true);
});

test("ledger format factory rejects blank paths without creating files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mymeter-format-blank-path-"));
  const blankFilePath = "   ";

  expect(existsSync(blankFilePath)).toBe(false);

  expect(() => createCostEventRepositoryForFormat({ ledgerPath: blankFilePath })).toThrow(/ledgerPath is required/i);

  expect(await readdir(directory)).toEqual([]);
  expect(existsSync(blankFilePath)).toBe(false);
});

test("ledger format factory imports an existing schema-v1 JSON ledger when append is selected", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-append-import-");
  await writeFile(ledgerPath, JSON.stringify({ schemaVersion: 1, events: [event("legacy-json", 200)] }));

  const repository = createCostEventRepositoryForFormat({ ledgerPath, format: "append" });

  expect(repository.list().map((item) => item.id)).toEqual(["legacy-json"]);
  repository.commit?.([event("append-after-import", 201, "format-session-2")]);
  const manifest = JSON.parse(await readFile(ledgerPath, "utf8")) as {
    schemaVersion?: number;
    generation?: number;
    snapshotFile?: string;
    logFile?: string;
  };
  expect(manifest).toMatchObject({
    schemaVersion: 1,
    generation: 1,
    snapshotFile: expect.stringContaining("ledger.json.g1.snapshot.json"),
    logFile: expect.stringContaining("ledger.json.g1.log"),
  });
  expect(existsSync(`${ledgerPath}.legacy.json`)).toBe(true);

  const restarted = createCostEventRepositoryForFormat({ ledgerPath, format: "append" });
  expect(restarted.list().map((item) => item.id)).toEqual(["legacy-json", "append-after-import"]);
});

test("ledger format factory append mode refuses a final symlink to a schema-v1 JSON ledger", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-append-symlink-json-");
  const aliasPath = join(join(ledgerPath, ".."), "alias-ledger.json");
  await writeFile(ledgerPath, JSON.stringify({
    schemaVersion: 1,
    events: [event("append-symlink-json", 250)],
  }));
  if (!await createSymlinkOrSkip(ledgerPath, aliasPath)) return;

  expect(() => createCostEventRepositoryForFormat({ ledgerPath: aliasPath, format: "append" }))
    .toThrow(/symlink|symbolic link/i);

  expect(JSON.parse(await readFile(ledgerPath, "utf8"))).toMatchObject({
    schemaVersion: 1,
    events: [{ id: "append-symlink-json" }],
  });
  expect(lstatSync(aliasPath).isSymbolicLink()).toBe(true);
});

test("ledger format factory restarts append ledgers without losing deltas", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-append-restart-");
  const repository = createCostEventRepositoryForFormat({ ledgerPath, format: "append" });
  repository.commit?.([event("append-first", 300)]);
  repository.commit?.([event("append-second", 301, "format-session-2")]);

  const restarted = createCostEventRepositoryForFormat({ ledgerPath, format: "append" });

  expect(restarted.list().map((item) => item.id)).toEqual(["append-first", "append-second"]);
  const files = await readdir(join(ledgerPath, ".."));
  expect(files).toContain("ledger.json.g1.snapshot.json");
  expect(files).toContain("ledger.json.g1.log");
});

test("ledger format factory exports an append manifest before opening it as JSON and keeps writing", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-json-downgrade-");
  const appendRepository = createCostEventRepositoryForFormat({ ledgerPath, format: "append" });
  appendRepository.commit?.([event("append-before-json", 400)]);

  const jsonRecovery = vi.fn();
  const appendRecovery = vi.fn();
  const jsonRepository = createCostEventRepositoryForFormat({
    ledgerPath,
    format: "json",
    onJsonRecovery: jsonRecovery,
    onAppendRecovery: appendRecovery,
  });

  expect(jsonRepository.list().map((item) => item.id)).toEqual(["append-before-json"]);
  expect(jsonRecovery).not.toHaveBeenCalled();
  expect(appendRecovery).not.toHaveBeenCalled();
  const exported = JSON.parse(await readFile(ledgerPath, "utf8")) as {
    schemaVersion?: number;
    events?: Array<{ id?: string }>;
    generation?: unknown;
  };
  expect(exported).toMatchObject({ schemaVersion: 1, events: [{ id: "append-before-json" }] });
  expect(exported.generation).toBeUndefined();

  jsonRepository.upsert(event("json-after-downgrade", 401, "format-session-2"));

  const restarted = createCostEventRepositoryForFormat({ ledgerPath, format: "json" });
  expect(restarted.list().map((item) => item.id)).toEqual([
    "append-before-json",
    "json-after-downgrade",
  ]);
});

test.skipIf(!supportsCaseInsensitiveAliases)(
  "ledger format factory downgrades append ledgers through a case-only path alias",
  async () => {
    const ledgerPath = await createLedgerPath("mymeter-format-json-downgrade-alias-");
    const aliasPath = join(join(ledgerPath, ".."), "LEDGER.JSON");
    const appendRepository = createCostEventRepositoryForFormat({ ledgerPath, format: "append" });
    appendRepository.commit?.([event("append-before-alias-json", 450)]);

    const jsonRecovery = vi.fn();
    const appendRecovery = vi.fn();
    const jsonRepository = createCostEventRepositoryForFormat({
      ledgerPath: aliasPath,
      format: "json",
      onJsonRecovery: jsonRecovery,
      onAppendRecovery: appendRecovery,
    });

    expect(jsonRepository.list().map((item) => item.id)).toEqual(["append-before-alias-json"]);
    expect(jsonRecovery).not.toHaveBeenCalled();
    expect(appendRecovery).not.toHaveBeenCalled();
    const exported = JSON.parse(await readFile(ledgerPath, "utf8")) as {
      schemaVersion?: number;
      events?: Array<{ id?: string }>;
      generation?: unknown;
    };
    expect(exported).toMatchObject({ schemaVersion: 1, events: [{ id: "append-before-alias-json" }] });
    expect(exported.generation).toBeUndefined();
  },
);

test("ledger format factory refuses JSON downgrade through a final symlink to an append manifest", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-json-downgrade-symlink-");
  const appendRepository = createCostEventRepositoryForFormat({ ledgerPath, format: "append" });
  appendRepository.commit?.([event("append-before-symlink-json", 475)]);
  const aliasPath = join(join(ledgerPath, ".."), "alias-ledger.json");
  try {
    await symlink(ledgerPath, aliasPath);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP" || code === "EOPNOTSUPP") return;
    throw error;
  }
  const manifestBefore = await readFile(ledgerPath, "utf8");
  const snapshotBefore = await readFile(`${ledgerPath}.g1.snapshot.json`, "utf8");
  const logBefore = await readFile(`${ledgerPath}.g1.log`, "utf8");
  const filesBefore = await readdir(join(ledgerPath, ".."));
  const jsonRecovery = vi.fn();
  const appendRecovery = vi.fn();

  expect(() => createCostEventRepositoryForFormat({
    ledgerPath: aliasPath,
    format: "json",
    onJsonRecovery: jsonRecovery,
    onAppendRecovery: appendRecovery,
  })).toThrow(/symlink|symbolic link/i);

  expect(jsonRecovery).not.toHaveBeenCalled();
  expect(appendRecovery).not.toHaveBeenCalled();
  expect(await readFile(ledgerPath, "utf8")).toBe(manifestBefore);
  expect(await readFile(`${ledgerPath}.g1.snapshot.json`, "utf8")).toBe(snapshotBefore);
  expect(await readFile(`${ledgerPath}.g1.log`, "utf8")).toBe(logBefore);
  expect(lstatSync(aliasPath).isSymbolicLink()).toBe(true);
  expect(await readdir(join(ledgerPath, ".."))).toEqual(filesBefore);
});

test("ledger format factory rejects a missing append manifest when generation sidecars remain", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-missing-manifest-");
  const repository = createCostEventRepositoryForFormat({ ledgerPath, format: "append" });
  repository.commit?.([event("sidecar-kept", 500)]);
  await unlink(ledgerPath);

  const jsonRecovery = vi.fn();
  const appendRecovery = vi.fn();
  expect(() => createCostEventRepositoryForFormat({
    ledgerPath,
    onJsonRecovery: jsonRecovery,
    onAppendRecovery: appendRecovery,
  })).toThrow(/append manifest.*missing|generation files/i);

  expect(jsonRecovery).not.toHaveBeenCalled();
  expect(appendRecovery).toHaveBeenCalledWith({ filePath: ledgerPath, reason: "corrupt-manifest" });
  expect(readFileSync(`${ledgerPath}.g1.log`, "utf8")).toContain("sidecar-kept");
});

test("ledger format factory rejects an append-shaped damaged manifest before JSON recovery can empty it", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-damaged-manifest-");
  const repository = createCostEventRepositoryForFormat({ ledgerPath, format: "append" });
  repository.commit?.([event("damaged-kept", 600)]);
  await writeFile(ledgerPath, JSON.stringify({
    schemaVersion: 1,
    generation: 1,
    snapshotFile: 17,
    logFile: "ledger.json.g1.log",
  }));

  const jsonRecovery = vi.fn();
  const appendRecovery = vi.fn();
  expect(() => createCostEventRepositoryForFormat({
    ledgerPath,
    format: "json",
    onJsonRecovery: jsonRecovery,
    onAppendRecovery: appendRecovery,
  })).toThrow(/append manifest.*invalid|damaged/i);

  expect(jsonRecovery).not.toHaveBeenCalled();
  expect(appendRecovery).toHaveBeenCalledWith({ filePath: ledgerPath, reason: "corrupt-manifest" });
  expect(readFileSync(`${ledgerPath}.g1.log`, "utf8")).toContain("damaged-kept");
});

test("ledger format factory rejects a schema-v1 object without events when append sidecars remain", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-events-missing-");
  const repository = createCostEventRepositoryForFormat({ ledgerPath, format: "append" });
  repository.commit?.([event("events-missing-kept", 650)]);
  await writeFile(ledgerPath, JSON.stringify({ schemaVersion: 1 }));

  const jsonRecovery = vi.fn();
  const appendRecovery = vi.fn();
  expect(() => createCostEventRepositoryForFormat({
    ledgerPath,
    format: "json",
    onJsonRecovery: jsonRecovery,
    onAppendRecovery: appendRecovery,
  })).toThrow(/append manifest.*missing|events.*missing|generation files/i);

  expect(jsonRecovery).not.toHaveBeenCalled();
  expect(appendRecovery).toHaveBeenCalledWith({ filePath: ledgerPath, reason: "corrupt-manifest" });
  expect(readFileSync(`${ledgerPath}.g1.log`, "utf8")).toContain("events-missing-kept");
});

test("ledger format factory routes JSON recovery notices separately from append recovery notices", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-json-recovery-");
  await writeFile(ledgerPath, JSON.stringify({
    schemaVersion: 1,
    events: [
      event("valid-json-event", 700),
      { ...event("invalid-json-event", 701), requestStartedAt: "not-a-date" },
    ],
  }));

  const jsonRecovery = vi.fn();
  const appendRecovery = vi.fn();
  const repository = createCostEventRepositoryForFormat({
    ledgerPath,
    onJsonRecovery: jsonRecovery,
    onAppendRecovery: appendRecovery,
  });

  expect(repository.list().map((item) => item.id)).toEqual(["valid-json-event"]);
  expect(jsonRecovery).toHaveBeenCalledWith(expect.objectContaining({
    filePath: ledgerPath,
    reason: "invalid-events",
    recoveredEventCount: 1,
    rejectedEventCount: 1,
  }));
  expect(appendRecovery).not.toHaveBeenCalled();
});

test("ledger format factory rejects unknown formats explicitly", async () => {
  const ledgerPath = await createLedgerPath("mymeter-format-unknown-");

  expect(() => createCostEventRepositoryForFormat({
    ledgerPath,
    format: "sqlite" as CostEventLedgerFormat,
  })).toThrow(/unknown cost event ledger format: sqlite/i);
});
