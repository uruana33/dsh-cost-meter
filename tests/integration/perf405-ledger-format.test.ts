import { waitFor } from "@testing-library/react";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import { expect, test, vi } from "vitest";

import {
  apply as applyCordisHost,
  createMyMeterCordisHostRuntime,
  type MyMeterCordisContext,
  type MyMeterTypertHostContext,
} from "../../packages/plugin/src/cordis-host";
import {
  createCostEventRepositoryForFormat,
  createInMemoryCostEventRepository,
  createLedgerFingerprint,
  createRecoveryCheckpointPath,
  type CostEventRepository,
} from "../../packages/host/src";

type Listener = (session: unknown, event: unknown) => void;

class FakeTypertHostContext implements MyMeterTypertHostContext {
  private readonly listeners = new Map<string, Set<Listener>>();
  readonly services = new Map<string, object>();
  readonly existingSessions: unknown[] = [];
  readonly warn = vi.fn();
  sessionPersistence?: NonNullable<MyMeterCordisContext["sessionPersistence"]>;

  readonly logger = {
    warn: this.warn,
  };

  readonly sessions = {
    list: () => this.existingSessions,
  };

  readonly settings = {
    get: () => ({}),
    register: () => ({}),
  };

  readonly llm = {
    listProviders: () => [],
    listConfigurableProviders: () => [],
  };

  readonly reflect = {
    provide: (key: string, service: object) => {
      this.services.set(key, service);
      return () => {
        this.services.delete(key);
      };
    },
  };

  readonly typert = {
    register: () => () => {},
  };

  on(event: string, listener: Listener): () => void {
    const listeners = this.listeners.get(event) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }

  emit(session: unknown, event: unknown): void {
    for (const listener of this.listeners.get("session/event") ?? []) {
      listener(session, event);
    }
  }
}

function createCordisSettledEvents(startedAt: number): unknown[] {
  return [
    { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } },
    {
      type: "request/header",
      seq: 2,
      time: startedAt + 1,
      data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
    },
    {
      type: "assistant/message",
      seq: 3,
      time: startedAt + 1_000,
      data: {
        turn: 1,
        step: 1,
        message: { role: "assistant", content: [] },
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 },
      },
    },
  ];
}

function emitSettledUsage(ctx: FakeTypertHostContext, sessionId: string, startedAt: number): void {
  const session = { id: sessionId };
  for (const event of createCordisSettledEvents(startedAt)) {
    ctx.emit(session, event);
  }
}

function serviceSnapshot(ctx: FakeTypertHostContext): {
  summary: { settledTotalMicroCny: number };
  sessions: readonly unknown[];
} {
  const service = ctx.services.get("mymeter") as { getSnapshot(): unknown } | undefined;
  if (!service) throw new Error("missing mymeter service");
  return service.getSnapshot() as {
    summary: { settledTotalMicroCny: number };
    sessions: readonly unknown[];
  };
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function expectJsonLedger(filePath: string, expectedEventCount: number): void {
  const ledger = readJson(filePath);
  expect(ledger.schemaVersion).toBe(1);
  expect(ledger.events).toHaveLength(expectedEventCount);
  expect(ledger).not.toHaveProperty("generation");
  expect(ledger).not.toHaveProperty("snapshotFile");
  expect(ledger).not.toHaveProperty("logFile");
}

function expectAppendManifest(filePath: string): void {
  const manifest = readJson(filePath);
  const resolveLedgerSidecar = (value: unknown): string =>
    isAbsolute(String(value)) ? String(value) : join(dirname(filePath), String(value));
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.generation).toBeGreaterThanOrEqual(1);
  expect(typeof manifest.snapshotFile).toBe("string");
  expect(typeof manifest.logFile).toBe("string");
  expect(existsSync(resolveLedgerSidecar(manifest.snapshotFile))).toBe(true);
  expect(existsSync(resolveLedgerSidecar(manifest.logFile))).toBe(true);
}

function readRecoveryCheckpointFile(ledgerPath: string): {
  ledgerFingerprint: string;
  sessionRevisions: Record<string, string>;
} {
  return JSON.parse(readFileSync(createRecoveryCheckpointPath(ledgerPath), "utf8")) as {
    ledgerFingerprint: string;
    sessionRevisions: Record<string, string>;
  };
}

function expectSettledTotal(snapshot: { summary: { settledTotalMicroCny: number } }): void {
  expect(snapshot.summary.settledTotalMicroCny).toBeGreaterThan(0);
}

function appendRepositorySnapshot(ledgerPath: string): {
  fingerprint: string;
  eventCount: number;
} {
  const repository = createCostEventRepositoryForFormat({ ledgerPath, format: "append" });
  const fingerprint = repository.ledgerFingerprint?.();
  if (!fingerprint) throw new Error("append repository is missing ledgerFingerprint");
  return {
    fingerprint,
    eventCount: repository.list().length,
  };
}

test("Cordis ledgerPath defaults to JSON format", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-perf405-json-default-"));
  const ledgerPath = join(directory, "ledger.json");

  try {
    const ctx = new FakeTypertHostContext();
    const uninstall = applyCordisHost(ctx, { ledgerPath, balanceEnabled: false });
    emitSettledUsage(ctx, "perf405-json-default", Date.UTC(2026, 7, 19, 1));

    expectSettledTotal(serviceSnapshot(ctx));
    expectJsonLedger(ledgerPath, 1);
    expect(existsSync(`${ledgerPath}.g1.log`)).toBe(false);
    await uninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Cordis ledgerPath can opt into append format", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-perf405-append-"));
  const ledgerPath = join(directory, "ledger.json");

  try {
    const ctx = new FakeTypertHostContext();
    const uninstall = applyCordisHost(ctx, { ledgerPath, ledgerFormat: "append", balanceEnabled: false });
    emitSettledUsage(ctx, "perf405-append", Date.UTC(2026, 7, 19, 2));

    expectSettledTotal(serviceSnapshot(ctx));
    expectAppendManifest(ledgerPath);
    expect(ctx.warn).not.toHaveBeenCalled();
    await uninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Cordis restarts a JSON ledger in append format without losing events", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-perf405-json-to-append-"));
  const ledgerPath = join(directory, "ledger.json");

  try {
    const firstCtx = new FakeTypertHostContext();
    const firstUninstall = applyCordisHost(firstCtx, { ledgerPath, balanceEnabled: false });
    emitSettledUsage(firstCtx, "perf405-json-to-append", Date.UTC(2026, 7, 19, 3));
    const firstTotal = serviceSnapshot(firstCtx).summary.settledTotalMicroCny;
    expectJsonLedger(ledgerPath, 1);
    await firstUninstall();

    const secondCtx = new FakeTypertHostContext();
    const secondUninstall = applyCordisHost(secondCtx, {
      ledgerPath,
      ledgerFormat: "append",
      balanceEnabled: false,
    });

    expect(serviceSnapshot(secondCtx).summary.settledTotalMicroCny).toBe(firstTotal);
    expect(serviceSnapshot(secondCtx).sessions).toHaveLength(1);
    expectAppendManifest(ledgerPath);
    expect(existsSync(`${ledgerPath}.legacy.json`)).toBe(true);
    await secondUninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Cordis JSON to append checkpoint switch replays once then hits append checkpoint", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-perf405-json-append-checkpoint-"));
  const ledgerPath = join(directory, "ledger.json");
  const sessionId = "perf405-json-append-checkpoint";
  const events = createCordisSettledEvents(Date.UTC(2026, 7, 19, 3, 30));

  try {
    const firstInspect = vi.fn(async () => ({ meta: { id: sessionId }, events }));
    const firstCtx = new FakeTypertHostContext();
    firstCtx.sessionPersistence = {
      list: async () => [],
      inspect: firstInspect,
      listSnapshots: async () => [{ header: { id: sessionId }, revision: "rev-1" }],
    };
    const firstUninstall = applyCordisHost(firstCtx, { ledgerPath, balanceEnabled: false });
    await waitFor(() => {
      const checkpoint = readRecoveryCheckpointFile(ledgerPath);
      expect(checkpoint.sessionRevisions).toEqual({ [sessionId]: "rev-1" });
      expect(checkpoint.ledgerFingerprint).toBe(createLedgerFingerprint(ledgerPath));
    });
    await waitFor(() => expect(firstInspect).toHaveBeenCalledTimes(1));
    const jsonTotal = serviceSnapshot(firstCtx).summary.settledTotalMicroCny;
    expectJsonLedger(ledgerPath, 1);
    await firstUninstall();

    const secondInspect = vi.fn(async () => ({ meta: { id: sessionId }, events }));
    const secondCtx = new FakeTypertHostContext();
    secondCtx.sessionPersistence = {
      list: async () => [],
      inspect: secondInspect,
      listSnapshots: async () => [{ header: { id: sessionId }, revision: "rev-1" }],
    };
    const secondUninstall = applyCordisHost(secondCtx, {
      ledgerPath,
      ledgerFormat: "append",
      balanceEnabled: false,
    });

    await waitFor(() => expect(secondInspect).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const appendSnapshot = appendRepositorySnapshot(ledgerPath);
      const checkpoint = readRecoveryCheckpointFile(ledgerPath);
      expect(checkpoint.sessionRevisions).toEqual({ [sessionId]: "rev-1" });
      expect(checkpoint.ledgerFingerprint).toBe(appendSnapshot.fingerprint);
      expect(checkpoint.ledgerFingerprint).not.toBe(createLedgerFingerprint(ledgerPath));
      expect(appendSnapshot.eventCount).toBe(1);
    });
    expect(serviceSnapshot(secondCtx).summary.settledTotalMicroCny).toBe(jsonTotal);
    expect(serviceSnapshot(secondCtx).sessions).toHaveLength(1);
    await secondUninstall();

    const thirdInspect = vi.fn(async () => {
      throw new Error("append checkpoint hit should skip unchanged revision inspect");
    });
    const thirdListSnapshots = vi.fn(async () => [{ header: { id: sessionId }, revision: "rev-1" }]);
    const thirdCtx = new FakeTypertHostContext();
    thirdCtx.sessionPersistence = {
      list: async () => [],
      inspect: thirdInspect,
      listSnapshots: thirdListSnapshots,
    };
    const thirdUninstall = applyCordisHost(thirdCtx, {
      ledgerPath,
      ledgerFormat: "append",
      balanceEnabled: false,
    });

    await waitFor(() => expect(thirdListSnapshots).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(readRecoveryCheckpointFile(ledgerPath).ledgerFingerprint)
        .toBe(appendRepositorySnapshot(ledgerPath).fingerprint);
    });
    expect(thirdInspect).not.toHaveBeenCalled();
    expect(serviceSnapshot(thirdCtx).summary.settledTotalMicroCny).toBe(jsonTotal);
    expect(appendRepositorySnapshot(ledgerPath).eventCount).toBe(1);
    await thirdUninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Cordis automatically rolls an append ledger back to JSON when restarted as JSON", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-perf405-append-to-json-"));
  const ledgerPath = join(directory, "ledger.json");

  try {
    const firstCtx = new FakeTypertHostContext();
    const firstUninstall = applyCordisHost(firstCtx, {
      ledgerPath,
      ledgerFormat: "append",
      balanceEnabled: false,
    });
    emitSettledUsage(firstCtx, "perf405-append-to-json", Date.UTC(2026, 7, 19, 4));
    const firstTotal = serviceSnapshot(firstCtx).summary.settledTotalMicroCny;
    expectAppendManifest(ledgerPath);
    await firstUninstall();

    const secondCtx = new FakeTypertHostContext();
    const secondUninstall = applyCordisHost(secondCtx, { ledgerPath, balanceEnabled: false });

    expect(serviceSnapshot(secondCtx).summary.settledTotalMicroCny).toBe(firstTotal);
    expectJsonLedger(ledgerPath, 1);
    await secondUninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Cordis format switch invalidates the old checkpoint fingerprint and refreshes after replay", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-perf405-checkpoint-format-"));
  const ledgerPath = join(directory, "ledger.json");
  const sessionId = "perf405-checkpoint-format";
  const events = createCordisSettledEvents(Date.UTC(2026, 7, 19, 5));

  try {
    const firstCtx = new FakeTypertHostContext();
    firstCtx.sessionPersistence = {
      list: async () => [],
      inspect: vi.fn(async () => ({ meta: { id: sessionId }, events })),
      listSnapshots: async () => [{ header: { id: sessionId }, revision: "rev-1" }],
    };
    const firstUninstall = applyCordisHost(firstCtx, {
      ledgerPath,
      ledgerFormat: "append",
      balanceEnabled: false,
    });
    await waitFor(() => {
      expect(readRecoveryCheckpointFile(ledgerPath).sessionRevisions).toEqual({ [sessionId]: "rev-1" });
    });
    const appendCheckpoint = readRecoveryCheckpointFile(ledgerPath);
    expect(appendCheckpoint.ledgerFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    const checkpointMtimeBeforeSwitch = statSync(createRecoveryCheckpointPath(ledgerPath), { bigint: true }).mtimeNs;
    await firstUninstall();

    const secondInspect = vi.fn(async () => ({ meta: { id: sessionId }, events }));
    const secondCtx = new FakeTypertHostContext();
    secondCtx.sessionPersistence = {
      list: async () => [],
      inspect: secondInspect,
      listSnapshots: async () => [{ header: { id: sessionId }, revision: "rev-1" }],
    };
    const secondUninstall = applyCordisHost(secondCtx, { ledgerPath, balanceEnabled: false });

    await waitFor(() => expect(secondInspect).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const checkpoint = readRecoveryCheckpointFile(ledgerPath);
      expect(checkpoint.sessionRevisions).toEqual({ [sessionId]: "rev-1" });
      expect(checkpoint.ledgerFingerprint).toBe(createLedgerFingerprint(ledgerPath));
      expect(checkpoint.ledgerFingerprint).not.toBe(appendCheckpoint.ledgerFingerprint);
      expect(statSync(createRecoveryCheckpointPath(ledgerPath), { bigint: true }).mtimeNs)
        .toBeGreaterThan(checkpointMtimeBeforeSwitch);
    });
    expect(serviceSnapshot(secondCtx).sessions).toHaveLength(1);
    expectJsonLedger(ledgerPath, 1);
    await secondUninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Cordis runtime keeps an injected repository ahead of ledgerPath format creation", () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-perf405-injected-repo-"));
  const ledgerPath = join(directory, "ledger.json");
  const repository = createInMemoryCostEventRepository() as CostEventRepository;

  try {
    const ctx = new FakeTypertHostContext();
    const runtime = createMyMeterCordisHostRuntime({
      ctx,
      repository,
      ledgerPath,
      ledgerFormat: "append",
    });
    emitSettledUsage(ctx, "perf405-injected-repo", Date.UTC(2026, 7, 19, 6));

    expect(runtime.ledger().settledMicroCny).toBeGreaterThan(0);
    expect(repository.list()).toHaveLength(1);
    expect(existsSync(ledgerPath)).toBe(false);
    runtime.uninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
