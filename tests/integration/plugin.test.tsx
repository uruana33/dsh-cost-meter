import { act, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MYMETER_LOCAL_TYPERT_CONTRIBUTION,
  MYMETER_REMOTE_CONTRIBUTION,
  createMyMeterClientPlugin,
  createMyMeterRemoteFromTypert,
  createMyMeterHostRuntime,
  type DshEventContext,
  type MyMeterSlotContext,
  type TypertLocalContribution,
  type MyMeterTypertRemoteNamespace,
  type MyMeterTypertRemoteRoot,
} from "../../packages/plugin/src/index";
import {
  apply as applyCordisHost,
  createMyMeterCordisHostRuntime,
  inject as cordisHostInject,
  type MyMeterCordisContext,
  type MyMeterTypertHostContext,
} from "../../packages/plugin/src/cordis-host";
import {
  apply as applyCordisClient,
  inject as cordisClientInject,
  type MyMeterCordisClientContext,
  type MyMeterCordisClientFiber,
} from "../../packages/plugin/src/cordis-client";
import {
  ShellOverlay,
  createMockRemote,
  createMyMeterStore,
  type MyMeterStore,
  type MyMeterRemote,
  type MyMeterRemoteSnapshot,
} from "../../packages/client/src";
import {
  createFileCostEventRepository,
  createInMemoryCostEventRepository,
  createLedgerFingerprint,
  createRecoveryCheckpointPath,
  type CostEventInput as HostCostEventInput,
  type CostEventRepository,
} from "../../packages/host/src";

type Listener = (payload: unknown) => void;

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class FakeDshContext implements DshEventContext {
  private readonly listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): () => void {
    const listeners = this.listeners.get(event) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => {
      listeners.delete(listener);
    };
  }

  emit(event: string, payload: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload);
    }
  }

  listenerCount(): number {
    let total = 0;
    for (const listeners of this.listeners.values()) {
      total += listeners.size;
    }
    return total;
  }
}

class FakeSlotContext implements MyMeterSlotContext {
  readonly contributions = new Map<string, ReactNode>();

  register(slot: string, contribution: ReactNode): () => void {
    this.contributions.set(slot, contribution);
    return () => {
      this.contributions.delete(slot);
    };
  }
}

class FakeCordisContext implements MyMeterCordisContext {
  private readonly listeners = new Map<string, Set<(first: unknown, second: unknown) => void>>();
  private readonly contextBreakdowns = new Map<string, { systemTokens: number; toolsTokens: number; messageTokens: number }>();
  readonly existingSessions: Array<{ id: string; events: unknown[] }> = [];
  sessionQuery?: NonNullable<MyMeterCordisContext["sessionQuery"]>;
  sessionPersistence?: NonNullable<MyMeterCordisContext["sessionPersistence"]>;
  readonly sessions = {
    list: () => this.existingSessions,
  };
  readonly sessionProjections = {
    snapshot: (session: unknown) => ({
      asOfSeq: 0,
      values: {
        contextBreakdown: this.contextBreakdowns.get(String((session as { id?: unknown })?.id))
      },
    }),
  };

  setContextBreakdown(
    sessionId: string,
    value: { systemTokens: number; toolsTokens: number; messageTokens: number },
  ): void {
    this.contextBreakdowns.set(sessionId, value);
  }

  on(event: string, listener: (session: unknown, payload: unknown) => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }

  emit(session: unknown, event: unknown): void {
    this.emitEvent("session/event", session, event);
  }

  emitEvent(event: string, first: unknown, second?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(first, second);
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

class FakeTypertHostContext extends FakeCordisContext implements MyMeterTypertHostContext {
  readonly services = new Map<string, object>();
  readonly registeredSettingsNamespaces: string[] = [];
  registeredContribution: TypertLocalContribution | null = null;
  credentialValue: string | undefined;
  readonly resolvedCredentialRefs: string[] = [];
  settingsSection: Record<string, unknown> = {};
  llmProviders: Array<{ id: string; name: string }> = [];
  llmDirectory: Array<{ provider: string; displayName: string; settingsNs: string; settingsPath: string[] }> = [];
  typertDisposeBarrier: Promise<void> = Promise.resolve();

  readonly llm = {
    listProviders: () => this.llmProviders,
    listConfigurableProviders: () => this.llmDirectory,
  };

  readonly credentials = {
    resolve: async (ref: string) => {
      this.resolvedCredentialRefs.push(ref);
      return this.credentialValue
        ? { value: this.credentialValue, source: "memory" }
        : undefined;
    },
  };

  readonly settings = {
    get: (_namespace: string) => this.settingsSection,
    register: (namespace: string) => {
      this.registeredSettingsNamespaces.push(namespace);
      return { get: () => ({}) };
    },
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
    register: (contribution: TypertLocalContribution) => {
      this.registeredContribution = contribution;
      return async () => {
        await this.typertDisposeBarrier;
        this.registeredContribution = null;
      };
    },
  };
}

function createDeltaCommitRepository(options: { failFirstCommit?: boolean; enableCommit?: boolean } = {}) {
  const backing = createInMemoryCostEventRepository();
  const commitCalls: HostCostEventInput[][] = [];
  const replaceAllCalls: HostCostEventInput[][] = [];
  let failFirstCommit = options.failFirstCommit ?? false;
  const repository: CostEventRepository & {
    commit?: (events: readonly HostCostEventInput[]) => void;
  } = {
    upsert(event) {
      return backing.upsert(event);
    },
    list() {
      return backing.list();
    },
    getById(id) {
      return backing.getById(id);
    },
    replaceAll(events) {
      replaceAllCalls.push([...events]);
      backing.replaceAll(events);
    },
    clear() {
      backing.clear();
    },
  };

  if (options.enableCommit !== false) {
    repository.commit = (events) => {
      commitCalls.push([...events]);
      if (failFirstCommit) {
        failFirstCommit = false;
        throw new Error("delta commit failed");
      }
      backing.replaceAll([...backing.list(), ...events]);
    };
  }

  return { repository, commitCalls, replaceAllCalls };
}

type NoCommitCostEventRepository = CostEventRepository & {
  commit: undefined;
};

class FakeClientSlotContext {
  readonly contributions = new Map<string, unknown>();
  readonly registrationOptions = new Map<string, { name: string; id?: string; key?: string; order?: number; label?: string }>();
  injectCount = 0;
  unregisterCount = 0;

  inject(slot: string, callback: () => (() => void) | Iterable<() => void>): () => void {
    this.injectCount += 1;
    const cleanup = callback();
    const cleanups = typeof cleanup === "function" ? [cleanup] : [...cleanup];
    return () => {
      for (const dispose of cleanups.reverse()) dispose();
    };
  }

  register(options: { name: string; id?: string; key?: string; order?: number; label?: string }, component: unknown): () => void {
    if (options.name === "settings.plugin.item" && !options.key) {
      throw new Error('keyed slot "settings.plugin.item" requires options.key');
    }
    const key = `${options.name}:${options.id ?? options.key}`;
    this.contributions.set(key, component);
    this.registrationOptions.set(key, options);
    return () => {
      this.unregisterCount += 1;
      this.contributions.delete(key);
      this.registrationOptions.delete(key);
    };
  }
}

class FakeTypertClientRemote implements MyMeterTypertRemoteRoot {
  mymeter: MyMeterTypertRemoteNamespace;
  mountedContribution: unknown = null;
  mountDisposeCount = 0;
  snapshotReads = 0;
  balanceReads = 0;
  snapshotError: string | null = null;
  snapshot: MyMeterRemoteSnapshot;

  constructor(snapshot: MyMeterRemoteSnapshot) {
    this.snapshot = snapshot;
    this.mymeter = {
      getSnapshot: async () => {
        this.snapshotReads += 1;
        if (this.snapshotError) {
          return {
            ok: false as const,
            error: { code: "REMOTE_UNAVAILABLE", message: this.snapshotError, details: {} },
          };
        }
        return { ok: true, value: this.snapshot };
      },
      listSessions: async () => ({ ok: true, value: this.snapshot.sessions }),
      getSessionDetail: async (sessionId: string) => ({ ok: true, value: this.snapshot.details[sessionId] ?? null }),
      getBalance: async () => {
        this.balanceReads += 1;
        return { ok: true, value: this.snapshot.balance };
      },
      getSettings: async () => ({ ok: true, value: { remoteDtoVersion: "fixture" } }),
    };
  }

  async $mount(contribution: unknown): Promise<() => Promise<void>> {
    this.mountedContribution = contribution;
    return async () => {
      this.mountDisposeCount += 1;
      this.mountedContribution = null;
    };
  }
}

class FakeClientConnection {
  isLoopback = true;
  readonly rpc = {
    call: vi.fn(async (path: string, endpoint: string, payload?: unknown) => {
      if (path !== "/mymeter-update") {
        throw new Error(`unexpected path ${path}`);
      }
      if (endpoint === "check") {
        return {
          ok: true,
          value: {
            currentVersion: "0.1.0",
            latestVersion: "0.1.1",
            updateAvailable: true,
          },
        };
      }
      if (endpoint === "install") {
        return {
          ok: true,
          value: { installedVersion: (payload as { version?: string } | undefined)?.version ?? "0.1.1" },
        };
      }
      throw new Error(`unexpected endpoint ${endpoint}`);
    }),
  };
}

function createRemoteSnapshot(): MyMeterRemoteSnapshot {
  return {
    connection: { status: "connected", message: null },
    currentSessionId: null,
    summary: {
      status: { code: "idle" },
      provider: "unknown",
      model: "unknown",
      reasoningEffort: "unknown",
      agentPreset: "unknown",
      currentRequestMicroCny: 0,
      sessionTotalMicroCny: 0,
      settledTotalMicroCny: 0,
      estimatedTotalMicroCny: 0,
      localTotalMicroCny: 0,
      pricingZone: "unknown",
    },
    balance: {
      status: "fresh",
      currency: "CNY",
      totalMicroCny: 47_517_000,
      grantedMicroCny: 40_000_000,
      toppedUpMicroCny: 7_517_000,
      refreshedAt: "2026-08-17T00:00:00.000Z",
    },
    balances: [{
      provider: "deepseek",
      providerName: "DeepSeek",
      supported: true,
      status: "fresh",
      currency: "CNY",
      totalMicroCny: 47_517_000,
      grantedMicroCny: 40_000_000,
      toppedUpMicroCny: 7_517_000,
      refreshedAt: "2026-08-17T00:00:00.000Z",
    }],
    sessions: [],
    details: {},
  };
}

test("host runtime connects dsh projection and final usage without double settlement or sensitive DTO fields", () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({
    dsh,
    balance: async () => ({
      status: "fresh",
      totalMicroCny: 47_517_000n,
      grantedMicroCny: 40_000_000n,
      toppedUpMicroCny: 7_517_000n,
      updatedAt: "2026-08-17T00:00:00.000Z",
    }),
  });

  const common = {
    id: "req-1",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    metadata: {
      sessionId: "sess-1",
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-1",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
      apiKey: "sk-secret",
      prompt: "hidden prompt",
      completion: "hidden completion",
    },
  };

  dsh.emit("mymeter:projection", {
    ...common,
    projection: {
      cacheHitTokens: 1_000_000,
      cacheMissTokens: 1_000_000,
      outputTokens: 1_000_000,
      reasoningTokens: 400_000,
      reliability: 1,
    },
  });

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]?.status).toBe("estimated");
  expect(runtime.remote.getSnapshot().summary.status.code).toBe("billing");

  dsh.emit("mymeter:final_usage", {
    ...common,
    completedAt: "2026-08-17T04:00:05.000Z",
    usage: {
      cacheHitTokens: 1_000_000,
      cacheMissTokens: 1_000_000,
      outputTokens: 1_000_000,
      reasoningTokens: 400_000,
    },
    requestOutcome: "success",
  });
  dsh.emit("mymeter:final_usage", {
    ...common,
    completedAt: "2026-08-17T04:00:06.000Z",
    usage: {
      cacheHitTokens: 1_000_000,
      cacheMissTokens: 1_000_000,
      outputTokens: 1_000_000,
      reasoningTokens: 400_000,
    },
    requestOutcome: "success",
  });

  const events = runtime.events();
  const snapshot = runtime.remote.getSnapshot();
  const serialized = JSON.stringify(snapshot);

  expect(events).toHaveLength(1);
  expect(events[0]?.status).toBe("settled");
  expect(snapshot.summary.status.code).toBe("settled");
  expect(snapshot.summary.settledTotalMicroCny).toBe(6_050_000);
  expect(snapshot.summary.estimatedTotalMicroCny).toBe(0);
  expect(snapshot.sessions).toHaveLength(1);
  expect(snapshot.details["sess-1"]?.tokenBuckets).toEqual([
    {
      label: "缓存命中",
      tokens: 1_000_000,
      amountMicroCny: 50_000,
      unitPriceMicroCnyPerMillionTokens: 50_000,
    },
    {
      label: "缓存未命中",
      tokens: 1_000_000,
      amountMicroCny: 1_500_000,
      unitPriceMicroCnyPerMillionTokens: 1_500_000,
    },
    {
      label: "输出",
      tokens: 1_000_000,
      amountMicroCny: 4_500_000,
      unitPriceMicroCnyPerMillionTokens: 4_500_000,
    },
    {
      label: "其中推理",
      tokens: 400_000,
      amountMicroCny: 0,
      unitPriceMicroCnyPerMillionTokens: 4_500_000,
    },
  ]);
  expect(snapshot.details["sess-1"]?.stages).toEqual([
    expect.objectContaining({
      id: "sess-1-stage-1",
      index: 1,
      isCurrent: true,
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
      pricingZone: "offpeak",
      priceVersion: "deepseek-official-pricing-2026-08-21",
      totalMicroCny: 6_050_000,
      settledTotalMicroCny: 6_050_000,
      estimatedTotalMicroCny: 0,
      unknownCount: 0,
      contextBreakdown: null,
    }),
  ]);
  expect(snapshot.details["sess-1"]?.stages[0]?.tokenBuckets).toEqual([
    {
      label: "缓存命中",
      tokens: 1_000_000,
      amountMicroCny: 50_000,
      unitPriceMicroCnyPerMillionTokens: 50_000,
    },
    {
      label: "缓存未命中",
      tokens: 1_000_000,
      amountMicroCny: 1_500_000,
      unitPriceMicroCnyPerMillionTokens: 1_500_000,
    },
    {
      label: "输出",
      tokens: 1_000_000,
      amountMicroCny: 4_500_000,
      unitPriceMicroCnyPerMillionTokens: 4_500_000,
    },
    {
      label: "其中推理",
      tokens: 400_000,
      amountMicroCny: 0,
      unitPriceMicroCnyPerMillionTokens: 4_500_000,
    },
  ]);
  expect(serialized).not.toContain("sk-secret");
  expect(serialized).not.toContain("hidden prompt");
  expect(serialized).not.toContain("hidden completion");
  expect(serialized).not.toContain("apiKey");
  expect(runtime.ledger().settledCount).toBe(1);

  runtime.uninstall();
  expect(dsh.listenerCount()).toBe(0);

  dsh.emit("mymeter:projection", {
    ...common,
    id: "req-after-uninstall",
    metadata: { ...common.metadata, attemptId: "attempt-2" },
    projection: { outputTokens: 1_000_000, reliability: 1 },
  });
  expect(runtime.events()).toHaveLength(1);
});

test("host runtime reuses an unchanged remote snapshot between client polls", () => {
  const dsh = new FakeDshContext();
  const contextBreakdown = vi.fn(() => ({ systemTokens: 10, toolsTokens: 20, messageTokens: 30 }));
  const runtime = createMyMeterHostRuntime({ dsh, contextBreakdown });

  dsh.emit("mymeter:final_usage", {
    id: "req-cached-snapshot",
    requestStartedAt: "2026-08-17T00:00:00.000Z",
    completedAt: "2026-08-17T00:00:01.000Z",
    metadata: {
      sessionId: "sess-cached-snapshot",
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-1",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
    },
    usage: { cacheHitTokens: 100, cacheMissTokens: 10, outputTokens: 5 },
    requestOutcome: "success",
  });

  const first = runtime.remote.getSnapshot();
  const second = runtime.remote.getSnapshot();

  expect(second).toBe(first);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.summary)).toBe(true);
  runtime.uninstall();
});

test("host runtime keeps the ledger committed when an after-ledger-commit hook fails", () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-after-ledger-hook-"));
  const filePath = join(directory, "ledger.json");
  const dsh = new FakeDshContext();
  const onAfterLedgerCommitError = vi.fn();
  const runtime = createMyMeterHostRuntime({
    dsh,
    repository: createFileCostEventRepository({ filePath }),
    afterLedgerCommit() {
      throw new Error("sidecar write failed");
    },
    onAfterLedgerCommitError,
  });

  try {
    dsh.emit("mymeter:final_usage", {
      id: "req-sidecar-failure",
      requestStartedAt: "2026-08-17T00:00:00.000Z",
      completedAt: "2026-08-17T00:00:01.000Z",
      metadata: {
        sessionId: "sess-sidecar-failure",
        turnId: "turn-1",
        stepId: "step-1",
        attemptId: "attempt-1",
        provider: "deepseek",
        model: "deepseek-v4-flash",
      },
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      requestOutcome: "success",
    });

    const ledger = JSON.parse(readFileSync(filePath, "utf8")) as { events: unknown[] };
    expect(ledger.events).toHaveLength(1);
    expect(runtime.ledger().settledCount).toBe(1);
    expect(onAfterLedgerCommitError).toHaveBeenCalledWith(expect.any(Error));
  } finally {
    runtime.uninstall();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("host runtime commits only the dirty delta when the repository supports commit", () => {
  const dsh = new FakeDshContext();
  const { repository, commitCalls, replaceAllCalls } = createDeltaCommitRepository();
  const runtime = createMyMeterHostRuntime({ dsh, repository });

  runtime.batch(() => {
    dsh.emit("mymeter:projection", {
      id: "req-delta",
      requestStartedAt: "2026-08-17T00:00:00.000Z",
      metadata: {
        sessionId: "sess-delta",
        turnId: "turn-1",
        stepId: "step-1",
        attemptId: "attempt-1",
        provider: "deepseek",
        model: "deepseek-v4-flash",
        reasoningEffort: "high",
        agentPreset: "Coding",
      },
      projection: {
        cacheHitTokens: 1_000_000,
        cacheMissTokens: 1_000_000,
        outputTokens: 1_000_000,
        reasoningTokens: 400_000,
        reliability: 1,
      },
    });
    dsh.emit("mymeter:final_usage", {
      id: "req-delta",
      requestStartedAt: "2026-08-17T00:00:00.000Z",
      completedAt: "2026-08-17T00:00:05.000Z",
      metadata: {
        sessionId: "sess-delta",
        turnId: "turn-1",
        stepId: "step-1",
        attemptId: "attempt-1",
        provider: "deepseek",
        model: "deepseek-v4-flash",
        reasoningEffort: "high",
        agentPreset: "Coding",
      },
      usage: {
        cacheHitTokens: 1_000_000,
        cacheMissTokens: 1_000_000,
        outputTokens: 1_000_000,
        reasoningTokens: 400_000,
      },
      requestOutcome: "success",
    });
  });

  expect(commitCalls).toHaveLength(1);
  expect(commitCalls[0]).toHaveLength(1);
  expect(commitCalls[0]?.[0]).toMatchObject({ id: "req-delta:final", status: "settled", source: "final_usage" });
  expect(replaceAllCalls).toHaveLength(0);
  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]?.status).toBe("settled");

  runtime.uninstall();
});

test("host runtime falls back to replaceAll when commit is unavailable", () => {
  const dsh = new FakeDshContext();
  const { repository, replaceAllCalls } = createDeltaCommitRepository({ enableCommit: false });
  const runtime = createMyMeterHostRuntime({ dsh, repository });

  dsh.emit("mymeter:final_usage", {
    id: "req-fallback-a",
    requestStartedAt: "2026-08-17T00:00:00.000Z",
    completedAt: "2026-08-17T00:00:01.000Z",
    metadata: {
      sessionId: "sess-fallback-a",
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-1",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
    },
    usage: { cacheHitTokens: 1_000_000, cacheMissTokens: 1_000_000, outputTokens: 1_000_000, reasoningTokens: 400_000 },
    requestOutcome: "success",
  });
  dsh.emit("mymeter:final_usage", {
    id: "req-fallback-b",
    requestStartedAt: "2026-08-17T00:01:00.000Z",
    completedAt: "2026-08-17T00:01:01.000Z",
    metadata: {
      sessionId: "sess-fallback-b",
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-1",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
    },
    usage: { cacheHitTokens: 1_000_000, cacheMissTokens: 1_000_000, outputTokens: 1_000_000, reasoningTokens: 400_000 },
    requestOutcome: "success",
  });

  expect(replaceAllCalls).toHaveLength(2);
  const lastReplaceAll = replaceAllCalls.at(-1) ?? [];
  expect(lastReplaceAll).toHaveLength(2);
  expect(lastReplaceAll.map((event) => event.id).sort()).toEqual(["req-fallback-a:final", "req-fallback-b:final"]);

  runtime.uninstall();
});

test("host runtime retries a dirty delta when a commit fails", () => {
  const dsh = new FakeDshContext();
  const { repository, commitCalls } = createDeltaCommitRepository({ failFirstCommit: true });
  const runtime = createMyMeterHostRuntime({ dsh, repository });

  expect(() => {
    dsh.emit("mymeter:final_usage", {
      id: "req-retry-a",
      requestStartedAt: "2026-08-17T00:00:00.000Z",
      completedAt: "2026-08-17T00:00:01.000Z",
      metadata: {
        sessionId: "sess-retry",
        turnId: "turn-1",
        stepId: "step-1",
        attemptId: "attempt-1",
        provider: "deepseek",
        model: "deepseek-v4-flash",
        reasoningEffort: "high",
        agentPreset: "Coding",
      },
      usage: { cacheHitTokens: 1_000_000, cacheMissTokens: 1_000_000, outputTokens: 1_000_000, reasoningTokens: 400_000 },
      requestOutcome: "success",
    });
  }).toThrow("delta commit failed");

  dsh.emit("mymeter:final_usage", {
    id: "req-retry-b",
    requestStartedAt: "2026-08-17T00:01:00.000Z",
    completedAt: "2026-08-17T00:01:01.000Z",
    metadata: {
      sessionId: "sess-retry",
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-2",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
    },
    usage: { cacheHitTokens: 1_000_000, cacheMissTokens: 1_000_000, outputTokens: 1_000_000, reasoningTokens: 400_000 },
    requestOutcome: "success",
  });

  expect(commitCalls).toHaveLength(2);
  expect(commitCalls[0]?.map((event) => event.id)).toEqual(["req-retry-a:final"]);
  expect(commitCalls[1]?.map((event) => event.id).sort()).toEqual(["req-retry-a:final", "req-retry-b:final"]);
  expect(runtime.events().map((event) => event.id).sort()).toEqual(["req-retry-a:final", "req-retry-b:final"]);

  runtime.uninstall();
});

test("host runtime ignores timestamp churn from an unavailable balance", async () => {
  let fetchedAt = 1;
  const runtime = createMyMeterHostRuntime({
    dsh: new FakeDshContext(),
    balance: async () => ({
      status: "unavailable",
      total: null,
      granted: null,
      toppedUp: null,
      fetchedAt: fetchedAt++,
      expiresAt: fetchedAt,
      isExpired: true,
    }),
  });

  await runtime.remote.getBalance();
  const first = runtime.remote.getSnapshot();
  await runtime.remote.getBalance();
  const second = runtime.remote.getSnapshot();

  expect(second).toBe(first);
  runtime.uninstall();
});

test("host runtime invalidates a cached billing snapshot when duplicate final usage clears the active request", () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });
  const finalUsage = {
    id: "req-active-cache",
    requestStartedAt: "2026-08-17T00:00:00.000Z",
    completedAt: "2026-08-17T00:00:01.000Z",
    metadata: {
      sessionId: "sess-active-cache",
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-1",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
    },
    usage: { cacheHitTokens: 100, cacheMissTokens: 10, outputTokens: 5 },
    requestOutcome: "success",
  };

  dsh.emit("mymeter:final_usage", finalUsage);
  dsh.emit("mymeter:active_request", {
    requestStartedAt: finalUsage.requestStartedAt,
    lastActivityAt: finalUsage.completedAt,
    metadata: finalUsage.metadata,
  });
  const billing = runtime.remote.getSnapshot();
  expect(billing.summary.status.code).toBe("billing");

  dsh.emit("mymeter:final_usage", finalUsage);
  const settled = runtime.remote.getSnapshot();

  expect(settled).not.toBe(billing);
  expect(settled.summary.status.code).toBe("settled");
  runtime.uninstall();
});

test("host runtime groups multiple model requests under their conversation turn", () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });
  const emitUsage = (turnId: string, stepId: string, offsetMinutes: number): void => {
    const requestStartedAt = new Date(Date.UTC(2026, 7, 17, 0, offsetMinutes)).toISOString();
    dsh.emit("mymeter:final_usage", {
      id: `req-${turnId}-${stepId}`,
      requestStartedAt,
      completedAt: new Date(Date.parse(requestStartedAt) + 1_000).toISOString(),
      metadata: {
        sessionId: "sess-multi-step-turns",
        turnId,
        stepId,
        attemptId: "attempt-0",
        provider: "deepseek",
        model: "deepseek-v4-flash",
        reasoningEffort: "high",
        agentPreset: "Coding",
      },
      usage: {
        cacheHitTokens: 100,
        cacheMissTokens: 10,
        outputTokens: 5,
        reasoningTokens: 2,
      },
      requestOutcome: "success",
    });
  };

  emitUsage("1", "1", 0);
  emitUsage("1", "2", 1);
  emitUsage("2", "1", 2);

  const detail = runtime.remote.getSnapshot().details["sess-multi-step-turns"];
  expect(runtime.events()).toHaveLength(3);
  expect(detail?.turns).toHaveLength(2);
  expect(detail?.turns[0]).toMatchObject({
    label: "1",
    cacheHitTokens: 200,
    cacheMissTokens: 20,
    outputTokens: 10,
    reasoningTokens: 4,
  });
  expect(detail?.turns[0]?.amountMicroCny).toBe(detail?.turns[1]?.amountMicroCny ? detail.turns[1].amountMicroCny * 2 : -1);
  expect(detail?.stages).toHaveLength(1);
  expect(detail?.stages[0]?.turns).toHaveLength(2);

  runtime.uninstall();
});

test("an aggregated turn remains billing while any request in that turn is still estimated", () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });
  const metadata = {
    sessionId: "sess-mixed-turn-status",
    turnId: "1",
    attemptId: "attempt-0",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    reasoningEffort: "high",
    agentPreset: "Coding",
  };

  dsh.emit("mymeter:projection", {
    id: "req-estimated",
    requestStartedAt: "2026-08-17T00:00:00.000Z",
    metadata: { ...metadata, stepId: "1" },
    projection: { cacheHitTokens: 100, outputTokens: 10, reliability: 1 },
  });
  dsh.emit("mymeter:final_usage", {
    id: "req-settled",
    requestStartedAt: "2026-08-17T00:01:00.000Z",
    completedAt: "2026-08-17T00:01:01.000Z",
    metadata: { ...metadata, stepId: "2" },
    usage: { cacheHitTokens: 200, outputTokens: 20 },
    requestOutcome: "success",
  });

  const turn = runtime.remote.getSnapshot().details[metadata.sessionId]?.turns[0];
  expect(turn).toMatchObject({
    label: "1",
    status: "billing",
    completedAt: null,
    cacheHitTokens: 300,
    outputTokens: 30,
  });

  runtime.uninstall();
});

test("host runtime groups continuous billing stages by model effort preset zone and price version", () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({
    dsh,
    contextBreakdown: (sessionId) =>
      sessionId === "sess-stages"
        ? { systemTokens: 10, toolsTokens: 20, messageTokens: 30 }
        : null,
  });
  const emitUsage = (input: {
    id: string;
    turnId: string;
    requestStartedAt: string;
    model: string;
    reasoningEffort: string;
    agentPreset: string;
    completedAt: string;
  }): void => {
    dsh.emit("mymeter:final_usage", {
      id: input.id,
      requestStartedAt: input.requestStartedAt,
      completedAt: input.completedAt,
      metadata: {
        sessionId: "sess-stages",
        turnId: input.turnId,
        stepId: "step-1",
        attemptId: "attempt-1",
        provider: "deepseek",
        model: input.model,
        reasoningEffort: input.reasoningEffort,
        agentPreset: input.agentPreset,
      },
      usage: {
        cacheHitTokens: 1_000_000,
        cacheMissTokens: 0,
        outputTokens: 0,
      },
      requestOutcome: "success",
    });
  };

  emitUsage({
    id: "req-2",
    turnId: "turn-2",
    requestStartedAt: "2026-08-17T09:10:00+08:00",
    completedAt: "2026-08-17T01:10:05.000Z",
    model: "deepseek-v4-pro",
    reasoningEffort: "high",
    agentPreset: "Coding",
  });
  emitUsage({
    id: "req-1",
    turnId: "turn-1",
    requestStartedAt: "2026-08-17T08:10:00+08:00",
    completedAt: "2026-08-17T00:10:05.000Z",
    model: "deepseek-v4-flash",
    reasoningEffort: "medium",
    agentPreset: "Coding",
  });
  emitUsage({
    id: "req-3",
    turnId: "turn-3",
    requestStartedAt: "2026-08-17T19:10:00+08:00",
    completedAt: "2026-08-17T11:10:05.000Z",
    model: "deepseek-v4-flash",
    reasoningEffort: "medium",
    agentPreset: "Coding",
  });

  const detail = runtime.remote.getSnapshot().details["sess-stages"];
  const stages = detail?.stages;
  expect(stages).toHaveLength(3);
  expect(detail?.tokenBuckets.find((bucket) => bucket.label === "缓存命中")).toMatchObject({
    unitPriceMicroCnyPerMillionTokens: null,
    unitPriceMixed: true,
  });
  const zeroTokenBucket = detail?.tokenBuckets.find((bucket) => bucket.label === "缓存未命中");
  expect(zeroTokenBucket).toMatchObject({
    tokens: 0,
    unitPriceMicroCnyPerMillionTokens: null,
  });
  expect(zeroTokenBucket).not.toHaveProperty("unitPriceMixed");
  expect(stages?.map((stage) => ({
    index: stage.index,
    isCurrent: stage.isCurrent,
    model: stage.model,
    reasoningEffort: stage.reasoningEffort,
    pricingZone: stage.pricingZone,
    startedAt: stage.startedAt,
    completedAt: stage.completedAt,
    contextBreakdown: stage.contextBreakdown,
  }))).toEqual([
    {
      index: 1,
      isCurrent: false,
      model: "deepseek-v4-flash",
      reasoningEffort: "medium",
      pricingZone: "offpeak",
      startedAt: "2026-08-17T00:10:00.000Z",
      completedAt: "2026-08-17T00:10:05.000Z",
      contextBreakdown: null,
    },
    {
      index: 2,
      isCurrent: false,
      model: "deepseek-v4-pro",
      reasoningEffort: "high",
      pricingZone: "peak",
      startedAt: "2026-08-17T01:10:00.000Z",
      completedAt: "2026-08-17T01:10:05.000Z",
      contextBreakdown: null,
    },
    {
      index: 3,
      isCurrent: true,
      model: "deepseek-v4-flash",
      reasoningEffort: "medium",
      pricingZone: "offpeak",
      startedAt: "2026-08-17T11:10:00.000Z",
      completedAt: null,
      contextBreakdown: { systemTokens: 10, toolsTokens: 20, messageTokens: 30 },
    },
  ]);
  expect(stages?.map((stage) => stage.id)).toEqual([
    "sess-stages-stage-1",
    "sess-stages-stage-2",
    "sess-stages-stage-3",
  ]);
  expect(stages?.flatMap((stage) => stage.turns.map((turn) => turn.label))).toEqual(["turn-1", "turn-2", "turn-3"]);

  runtime.uninstall();
});

test("Kimi requests with one price card stay in one billing stage", () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });
  const emitUsage = (input: {
    id: string;
    turnId: string;
    requestStartedAt: string;
    cacheMissTokens: number;
  }): void => {
    dsh.emit("mymeter:final_usage", {
      id: input.id,
      requestStartedAt: input.requestStartedAt,
      completedAt: new Date(Date.parse(input.requestStartedAt) + 1_000).toISOString(),
      metadata: {
        sessionId: "sess-kimi-rounding",
        turnId: input.turnId,
        stepId: "step-1",
        attemptId: "attempt-1",
        provider: "kimi-coding",
        model: "k3-256k",
        reasoningEffort: "max",
        agentPreset: "code",
      },
      usage: {
        cacheHitTokens: 0,
        cacheMissTokens: input.cacheMissTokens,
        outputTokens: 0,
      },
      requestOutcome: "success",
    });
  };

  emitUsage({
    id: "kimi-rounding-1",
    turnId: "turn-1",
    requestStartedAt: "2026-08-19T00:00:00.000Z",
    cacheMissTokens: 696_881,
  });
  emitUsage({
    id: "kimi-rounding-2",
    turnId: "turn-2",
    requestStartedAt: "2026-08-19T00:01:00.000Z",
    cacheMissTokens: 1,
  });

  const detail = runtime.remote.getSnapshot().details["sess-kimi-rounding"];
  expect(detail?.stages).toHaveLength(1);
  expect(detail?.stages[0]?.tokenBuckets[1]?.unitPriceMicroCnyPerMillionTokens).toBe(21_600_000);
  expect(detail?.stages[0]?.turns).toHaveLength(2);

  runtime.uninstall();
});

test("provider stage tiers do not double count displayed cache-write tokens", () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });
  const emitUsage = (input: {
    id: string;
    turnId: string;
    requestStartedAt: string;
    cacheMissTokens: number;
    cacheWriteTokens?: number;
  }): void => {
    dsh.emit("mymeter:final_usage", {
      id: input.id,
      requestStartedAt: input.requestStartedAt,
      completedAt: new Date(Date.parse(input.requestStartedAt) + 1_000).toISOString(),
      metadata: {
        sessionId: "sess-cache-write-tier",
        turnId: input.turnId,
        stepId: "step-1",
        attemptId: "attempt-1",
        provider: "openai",
        model: "gpt-5.4",
        reasoningEffort: "max",
        agentPreset: "code",
      },
      usage: {
        cacheHitTokens: 0,
        cacheMissTokens: input.cacheMissTokens,
        ...(input.cacheWriteTokens !== undefined ? { cacheWriteTokens: input.cacheWriteTokens } : {}),
        outputTokens: 0,
      },
      requestOutcome: "success",
    });
  };

  emitUsage({
    id: "cache-write-tier-1",
    turnId: "turn-1",
    requestStartedAt: "2026-08-19T01:00:00.000Z",
    cacheMissTokens: 271_000,
    cacheWriteTokens: 1_000,
  });
  emitUsage({
    id: "cache-write-tier-2",
    turnId: "turn-2",
    requestStartedAt: "2026-08-19T01:01:00.000Z",
    cacheMissTokens: 100,
  });

  const detail = runtime.remote.getSnapshot().details["sess-cache-write-tier"];
  expect(detail?.stages).toHaveLength(1);
  expect(detail?.stages[0]?.tokenBuckets[1]?.unitPriceMicroCnyPerMillionTokens).toBe(18_000_000);

  runtime.uninstall();
});

test("failed usage contributes to stage total without being reported as settled", () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });

  dsh.emit("mymeter:final_usage", {
    id: "req-failed",
    requestStartedAt: "2026-08-17T08:10:00+08:00",
    completedAt: "2026-08-17T00:10:05.000Z",
    metadata: {
      sessionId: "sess-failed",
      turnId: "turn-failed",
      stepId: "step-1",
      attemptId: "attempt-1",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
    },
    usage: {
      cacheHitTokens: 1_000_000,
      cacheMissTokens: 0,
      outputTokens: 0,
    },
    requestOutcome: "failed",
  });

  const detail = runtime.remote.getSnapshot().details["sess-failed"];
  expect(detail).toMatchObject({
    status: "failed",
    sessionTotalMicroCny: 50_000,
    settledTotalMicroCny: 0,
    estimatedTotalMicroCny: 0,
  });
  expect(detail?.stages).toEqual([
    expect.objectContaining({
      status: "failed",
      totalMicroCny: 50_000,
      settledTotalMicroCny: 0,
      estimatedTotalMicroCny: 0,
    }),
  ]);

  runtime.uninstall();
});

test("client plugin registers ShellOverlay into shell.overlay and cleans slot plus remote subscription on uninstall", () => {
  const slots = new FakeSlotContext();
  let listenerCount = 0;
  const remote: MyMeterRemote = {
    getSnapshot: createRemoteSnapshot,
    subscribe() {
      listenerCount += 1;
      return () => {
        listenerCount -= 1;
      };
    },
  };

  const plugin = createMyMeterClientPlugin({ slots, remote, storage: null });

  expect(slots.contributions.has("shell.overlay")).toBe(true);
  expect(listenerCount).toBe(1);

  plugin.uninstall();
  expect(slots.contributions.has("shell.overlay")).toBe(false);
  expect(listenerCount).toBe(0);

  plugin.uninstall();
  expect(listenerCount).toBe(0);
});

test("Typert Remote descriptor is strict and rejects malformed snapshots", () => {
  expect(MYMETER_REMOTE_CONTRIBUTION.package).toBe("@mymeter/dsh-cost-meter");
  expect(MYMETER_REMOTE_CONTRIBUTION.descriptors.map((descriptor) => descriptor.method)).toEqual([
    "getSnapshot",
    "listSessions",
    "getSessionDetail",
    "getBalance",
    "refreshBalance",
    "getSettings",
    "refreshExchangeRate",
    "getSessionCostTree",
    "getCostAnalytics",
    "getUsageOverview",
    "exportLedger",
  ]);
  expect(MYMETER_REMOTE_CONTRIBUTION.descriptors.every((descriptor) => descriptor.result.mode === "strict")).toBe(true);
  expect(MYMETER_REMOTE_CONTRIBUTION.descriptors.flatMap((descriptor) => descriptor.parameters)
    .every((parameter) => parameter.codec.mode === "strict")).toBe(true);

  const getSnapshot = MYMETER_REMOTE_CONTRIBUTION.descriptors.find((descriptor) => descriptor.method === "getSnapshot");
  const parsed = getSnapshot?.result.schema.parse(createRemoteSnapshot()) as MyMeterRemoteSnapshot | undefined;
  expect(parsed?.connection.status).toBe("connected");
  expect(parsed?.balances).toEqual([
    expect.objectContaining({ provider: "deepseek", providerName: "DeepSeek", supported: true }),
  ]);

  const mixedPriceSnapshot = createMockRemote("billing").getSnapshot();
  Object.assign(mixedPriceSnapshot.details["sess-1"]!.tokenBuckets[0]!, {
    unitPriceMicroCnyPerMillionTokens: null,
    unitPriceMixed: true,
  });
  const parsedMixedPrice = getSnapshot?.result.schema.parse(mixedPriceSnapshot) as MyMeterRemoteSnapshot | undefined;
  expect(parsedMixedPrice?.details["sess-1"]?.tokenBuckets[0]).toMatchObject({
    unitPriceMicroCnyPerMillionTokens: null,
    unitPriceMixed: true,
  });

  const invalidMixedPriceSnapshot = createMockRemote("billing").getSnapshot();
  Object.assign(invalidMixedPriceSnapshot.details["sess-1"]!.tokenBuckets[0]!, { unitPriceMixed: "yes" });
  expect(() => getSnapshot?.result.schema.parse(invalidMixedPriceSnapshot)).toThrow("tokenBucket.unitPriceMixed");

  const legacySnapshot = createRemoteSnapshot();
  delete (legacySnapshot.summary as Partial<typeof legacySnapshot.summary>).provider;
  delete (legacySnapshot.balance as Partial<typeof legacySnapshot.balance>).currency;
  delete (legacySnapshot as Partial<typeof legacySnapshot>).balances;
  const parsedLegacy = getSnapshot?.result.schema.parse(legacySnapshot) as MyMeterRemoteSnapshot | undefined;
  expect(parsedLegacy?.summary.provider).toBe("unknown");
  expect(parsedLegacy?.balance.currency).toBe("CNY");
  expect(parsedLegacy?.balances).toEqual([
    expect.objectContaining({ provider: "deepseek", providerName: "DeepSeek", supported: true }),
  ]);

  const invalidProviderBalance = createRemoteSnapshot();
  Object.assign(invalidProviderBalance.balances[0]!, { supported: "yes" });
  expect(() => getSnapshot?.result.schema.parse(invalidProviderBalance)).toThrow("providerBalance.supported");

  expect(() => getSnapshot?.result.schema.parse({ connection: { status: "connected", message: null } }))
    .toThrow("sessions");
});

test("host Cordis apply awaits Typert withdrawal before completing uninstall", async () => {
  expect(cordisHostInject).toEqual(["typert", "sessions", "credentials", "settings", "llm", "connection"]);
  const ctx = new FakeTypertHostContext();
  const uninstall = applyCordisHost(ctx);

  const service = ctx.services.get("mymeter") as
    | { typertRemote?: { serviceKey: string; namespace: string }; getSnapshot(): MyMeterRemoteSnapshot }
    | undefined;
  expect(service?.typertRemote).toMatchObject({ serviceKey: "mymeter", namespace: "mymeter" });
  expect(service?.getSnapshot().connection.status).toBe("connected");
  expect(ctx.registeredContribution).toBe(MYMETER_LOCAL_TYPERT_CONTRIBUTION);
  expect(ctx.registeredContribution?.invocations.map((descriptor) => descriptor.method)).toContain("getSnapshot");
  expect(ctx.registeredSettingsNamespaces).toEqual(["mymeter"]);

  let releaseTypertDispose: (() => void) | undefined;
  ctx.typertDisposeBarrier = new Promise<void>((resolve) => {
    releaseTypertDispose = resolve;
  });
  const disposing = uninstall();
  await Promise.resolve();
  expect(ctx.services.has("mymeter")).toBe(true);

  releaseTypertDispose?.();
  await disposing;
  expect(ctx.services.has("mymeter")).toBe(false);
  expect(ctx.registeredContribution).toBeNull();
});

test("host snapshot lists configured providers and only enables the verified DeepSeek balance route", async () => {
  const ctx = new FakeTypertHostContext();
  ctx.llmProviders = [
    { id: "deepseek-official", name: "DeepSeek" },
    { id: "openai", name: "OpenAI" },
    { id: "anthropic", name: "Anthropic" },
  ];
  ctx.llmDirectory = [
    { provider: "deepseek-official", displayName: "DeepSeek", settingsNs: "llm-deepseek", settingsPath: [] },
    { provider: "openai", displayName: "OpenAI", settingsNs: "llm-pi-ai", settingsPath: ["providers", "openai"] },
    { provider: "anthropic", displayName: "Anthropic", settingsNs: "llm-pi-ai", settingsPath: ["providers", "anthropic"] },
  ];
  const uninstall = applyCordisHost(ctx, { balanceEnabled: false });
  const service = ctx.services.get("mymeter") as { getSnapshot(): MyMeterRemoteSnapshot };

  expect(service.getSnapshot().balances).toEqual([
    expect.objectContaining({ provider: "deepseek-official", providerName: "DeepSeek", supported: true }),
    expect.objectContaining({ provider: "openai", providerName: "OpenAI", supported: false, totalMicroCny: null }),
    expect.objectContaining({ provider: "anthropic", providerName: "Anthropic", supported: false, totalMicroCny: null }),
  ]);

  await uninstall();
});

test("host snapshot does not infer balance support from a DeepSeek-like provider id", async () => {
  const ctx = new FakeTypertHostContext();
  ctx.llmProviders = [
    { id: "deepseek", name: "DeepSeek via pi-ai" },
    { id: "deepseek-official", name: "Unlisted DeepSeek" },
  ];
  ctx.llmDirectory = [
    { provider: "deepseek", displayName: "DeepSeek via pi-ai", settingsNs: "llm-pi-ai", settingsPath: ["providers", "deepseek"] },
  ];
  const uninstall = applyCordisHost(ctx, { balanceEnabled: false });
  const service = ctx.services.get("mymeter") as { getSnapshot(): MyMeterRemoteSnapshot };

  expect(service.getSnapshot().balances).toEqual([
    expect.objectContaining({ provider: "deepseek", supported: false, totalMicroCny: null }),
    expect.objectContaining({ provider: "deepseek-official", supported: false, totalMicroCny: null }),
  ]);

  await uninstall();
});

test("host Cordis apply persists ledgerPath events and restores aggregation after reapply", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-cordis-ledger-"));
  const ledgerPath = join(directory, "ledger.json");
  const preservedService = {};
  const emitSettledUsage = (ctx: FakeTypertHostContext): void => {
    const session = { id: "cordis-apply-ledger" };
    ctx.emit(session, {
      type: "request/header",
      seq: 1,
      time: Date.UTC(2026, 7, 17, 4) - 1,
      data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
    });
    ctx.emit(session, {
      type: "step/start",
      seq: 2,
      time: Date.UTC(2026, 7, 17, 4),
      data: { turn: 1, step: 1 },
    });
    ctx.emit(session, {
      type: "assistant/message",
      seq: 3,
      time: Date.UTC(2026, 7, 17, 4, 0, 1),
      data: {
        turn: 1,
        step: 1,
        message: { role: "assistant", content: [] },
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 },
      },
    });
  };

  try {
    const firstCtx = new FakeTypertHostContext();
    firstCtx.services.set("user.custom", preservedService);
    const firstUninstall = applyCordisHost(firstCtx, { ledgerPath });
    emitSettledUsage(firstCtx);

    const firstService = firstCtx.services.get("mymeter") as
      | { getSnapshot(): MyMeterRemoteSnapshot }
      | undefined;
    expect(firstService?.getSnapshot().summary.settledTotalMicroCny).toBe(6_050_000);
    expect(existsSync(ledgerPath)).toBe(true);
    const persisted = JSON.parse(readFileSync(ledgerPath, "utf8")) as { events?: unknown[] };
    expect(persisted.events).toHaveLength(1);

    await firstUninstall();
    expect(firstCtx.services.has("mymeter")).toBe(false);
    expect(firstCtx.services.get("user.custom")).toBe(preservedService);

    const secondCtx = new FakeTypertHostContext();
    const secondUninstall = applyCordisHost(secondCtx, { ledgerPath });
    const secondService = secondCtx.services.get("mymeter") as
      | { getSnapshot(): MyMeterRemoteSnapshot }
      | undefined;
    const secondSnapshot = secondService?.getSnapshot();

    expect(secondSnapshot?.summary.settledTotalMicroCny).toBe(6_050_000);
    expect(secondSnapshot?.sessions).toHaveLength(1);
    expect(secondSnapshot?.details["cordis-apply-ledger"]?.sessionTotalMicroCny).toBe(6_050_000);
    await secondUninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("client Cordis apply mounts Typert Remote, contributes overlay, settings, and MyMeter view tab", async () => {
  const slots = new FakeClientSlotContext();
  const remote = new FakeTypertClientRemote(createRemoteSnapshot());
  const connection = new FakeClientConnection();
  let injectedServices: string[] = [];
  let childCleanup: (() => void | Promise<void>) | undefined;
  let childDisposeCount = 0;
  const ctx: MyMeterCordisClientContext = {
    connection,
    remote,
    slots,
    inject(services, callback) {
      injectedServices = services;
      const ready = Promise.resolve(callback(ctx)).then((cleanup) => {
        childCleanup = typeof cleanup === "function" ? cleanup : undefined;
      });
      return {
        then: ready.then.bind(ready),
        async dispose() {
          await ready;
          childDisposeCount += 1;
          await childCleanup?.();
          childCleanup = undefined;
        },
      } as MyMeterCordisClientFiber;
    },
  };

  const uninstall = await applyCordisClient(ctx);

  expect(cordisClientInject).toEqual(["remote", "connection"]);
  expect(injectedServices).toEqual(["slots", "remote", "remote.mymeter", "connection"]);
  expect(remote.mountedContribution).toBe(MYMETER_REMOTE_CONTRIBUTION);
  expect(slots.injectCount).toBe(3);
  expect(slots.contributions.has("shell.overlay:mymeter")).toBe(true);
  expect(slots.contributions.has("settings.plugin.item:mymeter")).toBe(true);
  expect(slots.contributions.has("conversation.view:mymeter")).toBe(true);
  expect(slots.registrationOptions.get("conversation.view:mymeter")).toMatchObject({ order: 20, label: "Token计费" });
  expect(slots.registrationOptions.get("settings.plugin.item:mymeter")).toMatchObject({
    id: "mymeter",
    key: "mymeter",
    label: "Token计费",
  });

  const useSessions = (): null => null;
  const overlay = slots.contributions.get("shell.overlay:mymeter") as
    | ((props: { useSessions: unknown }) => ReactNode)
    | undefined;
  const overlayElement = overlay?.({ useSessions });
  expect(isValidElement(overlayElement)).toBe(true);
  const overlayProps = (overlayElement as {
    props?: { store?: MyMeterStore; useSessions?: unknown; onOpenTokenBilling?: () => void };
  }).props;
  expect(overlayProps?.useSessions).toBe(useSessions);
  expect(overlayProps?.store?.getState().ui.activePanel).toBe("compact");

  const tokenBillingTab = document.createElement("button");
  tokenBillingTab.setAttribute("role", "tab");
  tokenBillingTab.textContent = "Token计费";
  const openTab = vi.fn();
  tokenBillingTab.addEventListener("click", openTab);
  document.body.append(tokenBillingTab);
  overlayProps?.onOpenTokenBilling?.();
  expect(openTab).toHaveBeenCalledTimes(1);
  await Promise.resolve();
  expect(overlayProps?.store?.getState().ui.activePanel).toBe("compact");
  tokenBillingTab.remove();

  const conversationView = slots.contributions.get("conversation.view:mymeter") as
    | ((props: { sessionId: string }) => ReactNode)
    | undefined;
  const conversationViewElement = conversationView?.({ sessionId: "sess-1" });
  expect(isValidElement(conversationViewElement)).toBe(true);
  const conversationProps = (conversationViewElement as {
    props?: { sessionId?: string; updateController?: unknown; showUpdateControl?: boolean };
  }).props;
  expect(conversationProps?.sessionId).toBe("sess-1");
  expect(conversationProps?.updateController).toBeDefined();
  expect(conversationProps?.showUpdateControl).toBe(true);

  await uninstall();
  expect(slots.contributions.has("shell.overlay:mymeter")).toBe(false);
  expect(slots.contributions.has("settings.plugin.item:mymeter")).toBe(false);
  expect(slots.contributions.has("conversation.view:mymeter")).toBe(false);
  expect(slots.unregisterCount).toBe(3);
  expect(childDisposeCount).toBe(1);
  expect(remote.mountDisposeCount).toBe(1);

  await uninstall();
  expect(remote.mountDisposeCount).toBe(1);
});

test("Typert Remote adapter polls snapshots and stops polling after dispose", async () => {
  vi.useFakeTimers();
  try {
    const client = new FakeTypertClientRemote(createRemoteSnapshot());
    const remote = await createMyMeterRemoteFromTypert(client.mymeter, { pollIntervalMs: 100 });
    const snapshots: MyMeterRemoteSnapshot[] = [];
    const unsubscribe = remote.subscribe((snapshot) => {
      snapshots.push(snapshot);
    });

    const next = createRemoteSnapshot();
    next.summary.status.code = "billing";
    client.snapshot = next;
    await vi.advanceTimersByTimeAsync(100);

    expect(client.snapshotReads).toBe(2);
    expect(client.balanceReads).toBe(1);
    expect(snapshots.at(-1)?.summary.status.code).toBe("billing");

    unsubscribe();
    remote.dispose();
    await vi.advanceTimersByTimeAsync(300);
    expect(client.snapshotReads).toBe(2);
    expect(client.balanceReads).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});

test("Typert Remote adapter binds the legacy balance response only to DeepSeek", async () => {
  vi.useFakeTimers();
  try {
    const snapshot = createRemoteSnapshot();
    snapshot.balance.totalMicroCny = 3_500_000;
    snapshot.balances = [
      {
        ...snapshot.balances[0]!,
        provider: "deepseek-official",
        totalMicroCny: 47_517_000,
      },
      {
        ...snapshot.balances[0]!,
        provider: "openrouter",
        providerName: "OpenRouter",
        totalMicroCny: 12_000_000,
      },
    ];
    const client = new FakeTypertClientRemote(snapshot);
    const remote = await createMyMeterRemoteFromTypert(client.mymeter, { pollIntervalMs: 100 });

    await vi.advanceTimersByTimeAsync(100);

    expect(remote.getSnapshot().balances).toEqual([
      expect.objectContaining({ provider: "deepseek-official", totalMicroCny: 3_500_000 }),
      expect.objectContaining({ provider: "openrouter", totalMicroCny: 12_000_000 }),
    ]);
    remote.dispose();
  } finally {
    vi.useRealTimers();
  }
});

test("Typert Remote adapter observes live values within 200ms by default", async () => {
  vi.useFakeTimers();
  try {
    const client = new FakeTypertClientRemote(createRemoteSnapshot());
    const remote = await createMyMeterRemoteFromTypert(client.mymeter);
    const snapshots: MyMeterRemoteSnapshot[] = [];
    remote.subscribe((snapshot) => snapshots.push(snapshot));

    client.snapshot.summary.status.code = "billing";
    client.snapshot.summary.currentRequestMicroCny = 4_000;
    await vi.advanceTimersByTimeAsync(199);
    expect(snapshots).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(snapshots.at(-1)?.summary.currentRequestMicroCny).toBe(4_000);
    remote.dispose();
  } finally {
    vi.useRealTimers();
  }
});

test("Typert Remote adapter does not block its initial snapshot on a pending balance request", async () => {
  const client = new FakeTypertClientRemote(createRemoteSnapshot());
  let remote: Awaited<ReturnType<typeof createMyMeterRemoteFromTypert>> | undefined;
  client.mymeter.getBalance = async () => new Promise(() => {});

  void createMyMeterRemoteFromTypert(client.mymeter, { pollIntervalMs: 0 }).then((value) => {
    remote = value;
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  expect(remote?.getSnapshot().connection.status).toBe("connected");
  remote?.dispose();
});

test("Typert Remote adapter keeps polling cost snapshots while balance is pending", async () => {
  vi.useFakeTimers();
  try {
    const client = new FakeTypertClientRemote(createRemoteSnapshot());
    client.mymeter.getBalance = async () => new Promise(() => {});
    const remote = await createMyMeterRemoteFromTypert(client.mymeter, { pollIntervalMs: 100 });
    const snapshots: MyMeterRemoteSnapshot[] = [];
    remote.subscribe((snapshot) => snapshots.push(snapshot));

    client.snapshot.summary.status.code = "billing";
    client.snapshot.summary.currentRequestMicroCny = 4_000;
    await vi.advanceTimersByTimeAsync(100);

    expect(snapshots.at(-1)?.summary.currentRequestMicroCny).toBe(4_000);
    await vi.advanceTimersByTimeAsync(100);
    expect(client.snapshotReads).toBe(3);
    remote.dispose();
  } finally {
    vi.useRealTimers();
  }
});

test("host Cordis apply resolves the DeepSeek credential only on the Host balance path", async () => {
  const ctx = new FakeTypertHostContext();
  ctx.credentialValue = "sk-host-secret";
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      is_available: true,
      balance_infos: [{
        currency: "CNY",
        total_balance: "47.517",
        granted_balance: "40.000",
        topped_up_balance: "7.517",
      }],
    }),
  } as Response);

  try {
    const uninstall = applyCordisHost(ctx, { baseUrl: "https://api.deepseek.com" });
    const service = ctx.services.get("mymeter") as
      | { getBalance(): Promise<MyMeterRemoteSnapshot["balance"]> }
      | undefined;

    await expect(service?.getBalance()).resolves.toMatchObject({
      status: "fresh",
      totalMicroCny: 47_517_000,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(ctx.resolvedCredentialRefs).toEqual(["DEEPSEEK_API_KEY"]);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL("https://api.deepseek.com/user/balance"));
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("Authorization"))
      .toBe("Bearer sk-host-secret");
    expect(JSON.stringify(await service?.getBalance())).not.toContain("sk-host-secret");

    await uninstall();
    expect(ctx.listenerCount("session/event")).toBe(0);
    expect(ctx.listenerCount("credentials/updated")).toBe(0);
    expect(ctx.listenerCount("settings/updated")).toBe(0);
  } finally {
    fetchMock.mockRestore();
  }
});

test("host balance inherits llm-deepseek settings, rotates credentials, and skips HTTP without a key", async () => {
  const ctx = new FakeTypertHostContext();
  ctx.settingsSection = {
    apiKeyEnv: "MY_DEEPSEEK_KEY",
    baseURL: "https://deepseek.internal.example/v1",
  };
  ctx.credentialValue = "sk-first";
  vi.stubEnv("MY_DEEPSEEK_KEY", "sk-ambient-must-not-use");
  const authorization: string[] = [];
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    expect(url).toEqual(new URL("https://deepseek.internal.example/user/balance"));
    authorization.push(new Headers(init?.headers).get("Authorization") ?? "");
    return {
      ok: true,
      json: async () => ({
        is_available: true,
        balance_infos: [{ currency: "CNY", total_balance: "10.000" }],
      }),
    } as Response;
  });

  try {
    const uninstall = applyCordisHost(ctx);
    const service = ctx.services.get("mymeter") as
      | { getBalance(): Promise<MyMeterRemoteSnapshot["balance"]> }
      | undefined;

    await service?.getBalance();
    ctx.credentialValue = "sk-second";
    ctx.emitEvent("credentials/updated", "MY_DEEPSEEK_KEY");
    await service?.getBalance();
    expect(ctx.resolvedCredentialRefs).toEqual(["MY_DEEPSEEK_KEY", "MY_DEEPSEEK_KEY"]);
    expect(authorization).toEqual(["Bearer sk-first", "Bearer sk-second"]);

    ctx.credentialValue = undefined;
    ctx.emitEvent("credentials/updated", "MY_DEEPSEEK_KEY");
    await expect(service?.getBalance()).resolves.toMatchObject({ status: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await uninstall();
  } finally {
    fetchMock.mockRestore();
    vi.unstubAllEnvs();
  }
});

test("Typert Remote adapter marks poll failures stale and recovers on the next snapshot", async () => {
  vi.useFakeTimers();
  try {
    const client = new FakeTypertClientRemote(createRemoteSnapshot());
    const remote = await createMyMeterRemoteFromTypert(client.mymeter, { pollIntervalMs: 100 });
    const snapshots: MyMeterRemoteSnapshot[] = [];
    remote.subscribe((snapshot) => snapshots.push(snapshot));

    client.snapshotError = "connection lost";
    await vi.advanceTimersByTimeAsync(100);
    expect(snapshots.at(-1)?.connection).toEqual({ status: "stale", message: "connection lost" });

    client.snapshotError = null;
    client.snapshot.summary.status.code = "billing";
    await vi.advanceTimersByTimeAsync(100);
    expect(snapshots.at(-1)?.connection.status).toBe("connected");
    expect(snapshots.at(-1)?.summary.status.code).toBe("billing");
    remote.dispose();
  } finally {
    vi.useRealTimers();
  }
});

test("host runtime maps host CNY balance snapshots to remote micro-CNY without using CNY values as micro", async () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({
    dsh,
    balance: async () =>
      ({
        status: "fresh",
        currency: "CNY",
        total: 47.517,
        granted: 40,
        toppedUp: 7.517,
        fetchedAt: Date.UTC(2026, 7, 17, 0, 0, 0),
        expiresAt: Date.UTC(2026, 7, 17, 0, 5, 0),
        isExpired: false,
      }) as never,
  });

  await expect(runtime.remote.getBalance()).resolves.toMatchObject({
    status: "fresh",
    totalMicroCny: 47_517_000,
    grantedMicroCny: 40_000_000,
    toppedUpMicroCny: 7_517_000,
    refreshedAt: "2026-08-17T00:00:00.000Z",
  });
});

test("host runtime restores a settled ledger across restarts without double counting replayed usage", () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-ledger-"));
  const filePath = join(directory, "ledger.json");
  const common = {
    id: "req-restored",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    metadata: {
      sessionId: "sess-restored",
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-1",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "Coding",
    },
    completedAt: "2026-08-17T04:00:05.000Z",
    usage: {
      cacheHitTokens: 1_000_000,
      cacheMissTokens: 1_000_000,
      outputTokens: 1_000_000,
      reasoningTokens: 400_000,
    },
    requestOutcome: "success",
  };

  try {
    const firstDsh = new FakeDshContext();
    const firstRuntime = createMyMeterHostRuntime({
      dsh: firstDsh,
      repository: createFileCostEventRepository({ filePath }),
    });
    firstDsh.emit("mymeter:final_usage", common);
    expect(firstRuntime.ledger().settledMicroCny).toBe(6_050_000);
    firstRuntime.uninstall();

    const secondDsh = new FakeDshContext();
    const secondRuntime = createMyMeterHostRuntime({
      dsh: secondDsh,
      repository: createFileCostEventRepository({ filePath }),
    });
    expect(secondRuntime.events()).toHaveLength(1);
    expect(secondRuntime.remote.getSnapshot().details["sess-restored"]?.tokenBuckets).toEqual([
      {
        label: "缓存命中",
        tokens: 1_000_000,
        amountMicroCny: 50_000,
        unitPriceMicroCnyPerMillionTokens: 50_000,
      },
      {
        label: "缓存未命中",
        tokens: 1_000_000,
        amountMicroCny: 1_500_000,
        unitPriceMicroCnyPerMillionTokens: 1_500_000,
      },
      {
        label: "输出",
        tokens: 1_000_000,
        amountMicroCny: 4_500_000,
        unitPriceMicroCnyPerMillionTokens: 4_500_000,
      },
      {
        label: "其中推理",
        tokens: 400_000,
        amountMicroCny: 0,
        unitPriceMicroCnyPerMillionTokens: 4_500_000,
      },
    ]);

    secondDsh.emit("mymeter:final_usage", common);
    expect(secondRuntime.events()).toHaveLength(1);
    expect(secondRuntime.ledger().settledMicroCny).toBe(6_050_000);
    secondRuntime.uninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("host runtime converts legacy unknown ledger entries into estimated amounts", () => {
  const repository = createInMemoryCostEventRepository([
    {
      id: "legacy-unknown",
      sessionId: "legacy-session",
      turnId: "1",
      stepId: "1",
      attemptId: "attempt-0",
      requestStartedAt: "2026-08-17T12:00:00.000Z",
      completedAt: "2026-08-17T12:00:01.000Z",
      status: "unknown",
      source: "final_usage",
      amountMicroCny: 0,
      provider: "deepseek",
      model: "deepseek-chat",
      pricingZone: "offpeak",
      cacheMissTokens: 1_000_000,
      outputTokens: 1_000_000,
    },
  ]);
  const runtime = createMyMeterHostRuntime({ dsh: new FakeDshContext(), repository });
  const snapshot = runtime.remote.getSnapshot();

  expect(runtime.events()[0]).toMatchObject({ status: "estimated", amountMicroCny: 6_000_000n });
  expect(snapshot.summary.estimatedTotalMicroCny).toBe(6_000_000);
  expect(snapshot.details["legacy-session"]?.unknownCount).toBe(0);
  expect(snapshot.details["legacy-session"]?.sessionTotalMicroCny).toBe(6_000_000);

  runtime.uninstall();
});

test("host runtime reprices legacy Kimi Code usage with the Kimi API snapshot", () => {
  const repository = createInMemoryCostEventRepository([
    {
      id: "legacy-kimi-code",
      sessionId: "legacy-kimi-session",
      turnId: "1",
      stepId: "1",
      attemptId: "attempt-0",
      requestStartedAt: "2026-08-19T02:39:28.000Z",
      completedAt: "2026-08-19T02:40:00.000Z",
      status: "unknown",
      source: "final_usage",
      amountMicroCny: 0,
      provider: "kimi-coding",
      model: "k3-256k",
      pricingZone: "unknown",
      priceVersion: "unknown",
      cacheHitTokens: 25_120_512,
      cacheMissTokens: 696_881,
      outputTokens: 176_201,
    },
  ]);
  const runtime = createMyMeterHostRuntime({ dsh: new FakeDshContext(), repository });
  const event = runtime.events()[0];
  const detail = runtime.remote.getSnapshot().details["legacy-kimi-session"];

  expect(event).toMatchObject({
    provider: "kimi-coding",
    model: "k3-256k",
    status: "estimated",
    priceVersion: "moonshotai-official-pricing-2026-08-18-usd",
    currency: "USD",
    amountMinor: 12_269_812n,
  });
  expect(detail?.unknownCount).toBe(0);
  expect(detail?.stages[0]).toMatchObject({
    priceVersion: "moonshotai-official-pricing-2026-08-18-usd",
    currency: "USD",
    unknownCount: 0,
  });
  expect(detail?.stages[0]?.tokenBuckets.map((bucket) => bucket.unitPriceMinorPerMillionTokens)).toEqual([
    300_000,
    3_000_000,
    15_000_000,
    15_000_000,
  ]);

  runtime.uninstall();
});

test("host runtime restores legacy Grok fixed-rate events in native USD", () => {
  const sessionId = "legacy-grok-fixed-rate";
  const repository = createInMemoryCostEventRepository([
    {
      id: "legacy-grok-settled",
      sessionId,
      turnId: "1",
      stepId: "1",
      attemptId: "attempt-0",
      requestStartedAt: "2026-08-18T14:51:19.000Z",
      completedAt: "2026-08-18T14:52:06.000Z",
      status: "settled",
      source: "final_usage",
      amountMicroCny: 31_118,
      provider: "cpa",
      model: "grok-4.6",
      pricingZone: "unknown",
      priceVersion: "xai-official-pricing-2026-08-18-usd-cny-7.2",
      cacheHitTokens: 192,
      cacheMissTokens: 886,
      outputTokens: 409,
      hitRateMicroCny: 691,
      missRateMicroCny: 12_758,
      outputRateMicroCny: 17_669,
      cacheHitRateMicroCnyPerMillionTokens: 3_600_000,
      cacheMissRateMicroCnyPerMillionTokens: 14_400_000,
      outputRateMicroCnyPerMillionTokens: 43_200_000,
    },
  ]);
  const runtime = createMyMeterHostRuntime({ dsh: new FakeDshContext(), repository });
  const event = runtime.events()[0];
  const detail = runtime.remote.getSnapshot().details[sessionId];

  expect(event).toMatchObject({
    currency: "USD",
    amountMinor: 4_322n,
    cacheHitMinor: 96n,
    cacheMissMinor: 1_772n,
    outputMinor: 2_454n,
    cacheHitRateMinorPerMillionTokens: 500_000n,
    cacheMissRateMinorPerMillionTokens: 2_000_000n,
    outputRateMinorPerMillionTokens: 6_000_000n,
    priceVersion: "xai-official-pricing-2026-08-18-usd",
  });
  expect(detail?.currencyTotals).toEqual([
    { currency: "USD", amountMinor: 4_322, settledMinor: 4_322, estimatedMinor: 0, failedMinor: 0 },
  ]);
  expect(detail?.stages[0]).toMatchObject({
    currency: "USD",
    totalMinor: 4_322,
    priceVersion: "xai-official-pricing-2026-08-18-usd",
  });

  runtime.uninstall();
});

test("host runtime keeps reconstructed Grok totals equal to the rounded USD buckets", () => {
  const repository = createInMemoryCostEventRepository([
    {
      id: "legacy-grok-rounding",
      sessionId: "legacy-grok-rounding",
      requestStartedAt: "2026-08-18T14:51:19.000Z",
      status: "settled",
      source: "final_usage",
      amountMicroCny: 12,
      provider: "cpa",
      model: "grok-4.6",
      priceVersion: "xai-official-pricing-2026-08-18-usd-cny-7.2",
      cacheHitTokens: 1,
      cacheMissTokens: 1,
      outputTokens: 1,
      hitRateMicroCny: 4,
      missRateMicroCny: 4,
      outputRateMicroCny: 4,
    },
  ]);
  const runtime = createMyMeterHostRuntime({ dsh: new FakeDshContext(), repository });
  const event = runtime.events()[0]!;

  expect(event.amountMinor).toBe(3n);
  expect(event.amountMinor).toBe(event.cacheHitMinor! + event.cacheMissMinor! + event.outputMinor!);

  runtime.uninstall();
});

test("host runtime restores each legacy stage unit price from an event that used that bucket", () => {
  const sessionId = "legacy-stage-unit-prices";
  const priceVersion = "legacy-rate-card";
  const repository = createInMemoryCostEventRepository([
    {
      id: "legacy-first",
      sessionId,
      turnId: "1",
      stepId: "1",
      attemptId: "attempt-0",
      requestStartedAt: "2026-08-17T12:00:00.000Z",
      completedAt: "2026-08-17T12:00:01.000Z",
      status: "settled",
      source: "final_usage",
      amountMicroCny: 2_500,
      provider: "deepseek",
      model: "deepseek-v4-flash",
      pricingZone: "offpeak",
      priceVersion,
      cacheMissTokens: 1_000,
      outputTokens: 100,
      missRateMicroCny: 2_000,
      outputRateMicroCny: 500,
    },
    {
      id: "legacy-second",
      sessionId,
      turnId: "1",
      stepId: "2",
      attemptId: "attempt-0",
      requestStartedAt: "2026-08-17T12:01:00.000Z",
      completedAt: "2026-08-17T12:01:01.000Z",
      status: "settled",
      source: "final_usage",
      amountMicroCny: 100,
      provider: "deepseek",
      model: "deepseek-v4-flash",
      pricingZone: "offpeak",
      priceVersion,
      cacheHitTokens: 1_000,
      hitRateMicroCny: 100,
    },
  ]);
  const runtime = createMyMeterHostRuntime({ dsh: new FakeDshContext(), repository });
  const detail = runtime.remote.getSnapshot().details[sessionId];

  expect(detail?.stages).toHaveLength(1);
  expect(detail?.stages[0]?.tokenBuckets).toEqual([
    {
      label: "缓存命中",
      tokens: 1_000,
      amountMicroCny: 100,
      unitPriceMicroCnyPerMillionTokens: 100_000,
    },
    {
      label: "缓存未命中",
      tokens: 1_000,
      amountMicroCny: 2_000,
      unitPriceMicroCnyPerMillionTokens: 2_000_000,
    },
    {
      label: "输出",
      tokens: 100,
      amountMicroCny: 500,
      unitPriceMicroCnyPerMillionTokens: 5_000_000,
    },
    {
      label: "其中推理",
      tokens: 0,
      amountMicroCny: 0,
      unitPriceMicroCnyPerMillionTokens: 5_000_000,
    },
  ]);
  expect(detail?.tokenBuckets).toEqual(detail?.stages[0]?.tokenBuckets);

  runtime.uninstall();
});

test("host runtime drops legacy zero-token artifacts instead of making a settled stage estimated", () => {
  const sessionId = "session-two-stage-legacy";
  const repository = createInMemoryCostEventRepository([
    {
      id: "stage-1-estimate",
      sessionId,
      turnId: "1",
      stepId: "1",
      attemptId: "attempt-0",
      requestStartedAt: "2026-08-17T12:00:00.000Z",
      status: "unknown",
      source: "final_usage",
      amountMicroCny: 0,
      provider: "deepseek",
      model: "unknown",
      pricingZone: "offpeak",
      cacheMissTokens: 1_000,
      outputTokens: 100,
    },
    {
      id: "stage-2-settled",
      sessionId,
      turnId: "1",
      stepId: "2",
      attemptId: "attempt-0",
      requestStartedAt: "2026-08-17T12:01:00.000Z",
      completedAt: "2026-08-17T12:01:01.000Z",
      status: "settled",
      source: "final_usage",
      amountMicroCny: 1_050,
      provider: "deepseek",
      model: "deepseek-v4-flash",
      pricingZone: "offpeak",
      cacheHitTokens: 1_000,
      outputTokens: 100,
      hitRateMicroCny: 50,
      outputRateMicroCny: 1_000,
    },
    {
      id: "stage-2-phantom",
      sessionId,
      turnId: "1",
      stepId: "3",
      attemptId: "attempt-0",
      requestStartedAt: "2026-08-17T12:02:00.000Z",
      status: "unknown",
      source: "final_usage",
      amountMicroCny: 0,
      provider: "deepseek",
      model: "deepseek-v4-flash",
      pricingZone: "offpeak",
    },
    {
      id: "stage-2-migrated-phantom",
      sessionId,
      turnId: "1",
      stepId: "4",
      attemptId: "attempt-0",
      requestStartedAt: "2026-08-17T12:03:00.000Z",
      status: "estimated",
      source: "final_usage",
      amountMicroCny: 0,
      provider: "deepseek",
      model: "deepseek-v4-flash",
      pricingZone: "offpeak",
    },
  ]);
  const runtime = createMyMeterHostRuntime({ dsh: new FakeDshContext(), repository });
  const detail = runtime.remote.getSnapshot().details[sessionId];

  expect(runtime.events()).toHaveLength(2);
  expect(detail?.stages).toHaveLength(2);
  expect(detail?.stages[0]).toMatchObject({ status: "billing" });
  expect(detail?.stages[0]?.estimatedTotalMicroCny).toBeGreaterThan(0);
  expect(detail?.stages[1]).toMatchObject({
    status: "settled",
    settledTotalMicroCny: 1_050,
    estimatedTotalMicroCny: 0,
  });
  expect(detail?.stages[1]?.turns).toEqual([
    expect.objectContaining({ status: "settled", amountMicroCny: 1_050 }),
  ]);

  runtime.uninstall();
});

test("host runtime replaces legacy provider pricing with the model vendor API price", () => {
  const sessionId = "legacy-grok-fallback";
  const repository = createInMemoryCostEventRepository([{
    id: "legacy-grok-event",
    sessionId,
    turnId: "1",
    stepId: "1",
    attemptId: "attempt-0",
    requestStartedAt: "2026-08-18T14:00:00.000Z",
    completedAt: "2026-08-18T14:00:01.000Z",
    status: "estimated",
    source: "final_usage",
    amountMicroCny: 12_345,
    provider: "deepseek",
    model: "grok-4.6",
    pricingZone: "peak",
    priceVersion: "deepseek-official-pricing-2026-08-17",
    cacheMissTokens: 886,
    outputTokens: 409,
  }]);

  const runtime = createMyMeterHostRuntime({ dsh: new FakeDshContext(), repository });
  const event = runtime.events()[0];
  const stage = runtime.remote.getSnapshot().details[sessionId]?.stages[0];

  expect(event).toMatchObject({
    model: "grok-4.6",
    status: "estimated",
    pricingZone: "unknown",
    priceVersion: "xai-official-pricing-2026-08-18-usd",
    amountMicroCny: 30_427n,
    amountMinor: 4_226n,
  });
  expect(stage).toMatchObject({
    model: "grok-4.6",
    status: "unknown",
    pricingZone: "unknown",
    priceVersion: "xai-official-pricing-2026-08-18-usd",
    totalMicroCny: 30_427,
  });

  runtime.uninstall();
});

test("host runtime drops events without a request start timestamp instead of assigning processing time", () => {
  const dsh = new FakeDshContext();
  const runtime = createMyMeterHostRuntime({ dsh });

  dsh.emit("mymeter:final_usage", {
    metadata: {
      sessionId: "sess-no-start",
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-1",
      model: "deepseek-v4-flash",
    },
    usage: { outputTokens: 1_000_000 },
  });

  expect(runtime.events()).toHaveLength(0);
  runtime.uninstall();
});

test("Cordis bridge maps request headers and assistant usage into the billing runtime", () => {
  const ctx = new FakeCordisContext();
  const session = { id: "cordis-session" };
  ctx.setContextBreakdown(session.id, {
    systemTokens: 1_240,
    toolsTokens: 3_680,
    messageTokens: 8_920,
  });
  const runtime = createMyMeterCordisHostRuntime({ ctx });

  ctx.emit(session, {
    type: "agent-preset/selected",
    time: 1,
    data: { agentPreset: "Coding" },
  });
  ctx.emit(session, {
    type: "request/header",
    time: 2,
    data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash", reasoningEffort: "high" } } },
  });
  ctx.emit(session, { type: "step/start", time: Date.UTC(2026, 7, 17, 4), data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 4,
    time: Date.UTC(2026, 7, 17, 4, 0, 1),
    data: {
      turn: 1,
      step: 1,
      chunk: {
        type: "usage",
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, reasoningTokens: 400_000 },
      },
    },
  });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 5,
    time: Date.UTC(2026, 7, 17, 4, 0, 2),
    data: {
      turn: 1,
      step: 1,
      message: { role: "assistant", content: [] },
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, reasoningTokens: 400_000 },
    },
  });

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]).toMatchObject({
    sessionId: "cordis-session",
    turnId: "1",
    stepId: "1",
    attemptId: "attempt-0",
    model: "deepseek-v4-flash",
    reasoningEffort: "high",
    agentPreset: "Coding",
    status: "settled",
  });
  expect(runtime.remote.getSnapshot().details[session.id]?.contextBreakdown).toEqual({
    systemTokens: 1_240,
    toolsTokens: 3_680,
    messageTokens: 8_920,
  });
  ctx.setContextBreakdown(session.id, {
    systemTokens: -1,
    toolsTokens: 3_680,
    messageTokens: 8_920,
  });
  expect(runtime.remote.getSnapshot().details[session.id]?.contextBreakdown).toBeNull();
  expect(runtime.ledger().settledMicroCny).toBe(6_050_000);
  runtime.uninstall();
});

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

function readRecoveryCheckpointFile(ledgerPath: string): {
  ledgerFingerprint: string;
  sessionRevisions: Record<string, string>;
} {
  return JSON.parse(readFileSync(createRecoveryCheckpointPath(ledgerPath), "utf8")) as {
    ledgerFingerprint: string;
    sessionRevisions: Record<string, string>;
  };
}

test("Cordis host checkpoints durable history revisions and skips unchanged snapshots on restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-cordis-history-"));
  const ledgerPath = join(directory, "ledger.json");
  const sessionId = "cordis-history-cold";
  const events = createCordisSettledEvents(Date.UTC(2026, 7, 17, 4));

  try {
    const firstCtx = new FakeTypertHostContext();
    const firstInspect = vi.fn(async () => ({ meta: { id: sessionId }, events }));
    firstCtx.sessionPersistence = {
      list: async () => [],
      inspect: firstInspect,
      listSnapshots: async () => [{ header: { id: sessionId }, revision: "rev-1" }],
    };
    const firstUninstall = applyCordisHost(firstCtx, { ledgerPath });
    await waitFor(() => {
      const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as { events: unknown[] };
      expect(ledger.events).toHaveLength(1);
    });
    await waitFor(() => {
      const checkpoint = JSON.parse(readFileSync(createRecoveryCheckpointPath(ledgerPath), "utf8")) as {
        sessionRevisions: Record<string, string>;
      };
      expect(checkpoint.sessionRevisions).toEqual({ [sessionId]: "rev-1" });
    });
    await firstUninstall();
    expect(firstInspect).toHaveBeenCalledTimes(1);

    const secondCtx = new FakeTypertHostContext();
    const secondInspect = vi.fn(async () => {
      throw new Error("unchanged snapshot should not be inspected");
    });
    const secondListSnapshots = vi.fn(async () => [{ header: { id: sessionId }, revision: "rev-1" }]);
    secondCtx.sessionPersistence = {
      list: async () => [],
      inspect: secondInspect,
      listSnapshots: secondListSnapshots,
    };
    const secondUninstall = applyCordisHost(secondCtx, { ledgerPath });
    await waitFor(() => expect(secondListSnapshots).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const checkpoint = JSON.parse(readFileSync(createRecoveryCheckpointPath(ledgerPath), "utf8")) as {
        sessionRevisions: Record<string, string>;
      };
      expect(checkpoint.sessionRevisions).toEqual({ [sessionId]: "rev-1" });
    });
    expect(secondInspect).not.toHaveBeenCalled();
    await secondUninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Cordis host runtime persists ledgerPath history when no repository is provided", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-cordis-runtime-ledger-"));
  const ledgerPath = join(directory, "ledger.json");
  const sessionId = "cordis-runtime-ledger-cold";
  const events = createCordisSettledEvents(Date.UTC(2026, 7, 17, 4));

  try {
    const firstCtx = new FakeTypertHostContext();
    firstCtx.sessionPersistence = {
      list: async () => [],
      inspect: async () => ({ meta: { id: sessionId }, events }),
      listSnapshots: async () => [{ header: { id: sessionId }, revision: "rev-1" }],
    };
    const firstRuntime = createMyMeterCordisHostRuntime({ ctx: firstCtx, ledgerPath });
    await waitFor(() => {
      const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as { events?: unknown[] };
      expect(ledger.events).toHaveLength(1);
    });
    await waitFor(() => {
      expect(readRecoveryCheckpointFile(ledgerPath).sessionRevisions).toEqual({ [sessionId]: "rev-1" });
    });
    firstRuntime.uninstall();

    const secondCtx = new FakeTypertHostContext();
    const secondInspect = vi.fn(async () => {
      throw new Error("unchanged snapshot should be served from the durable ledger");
    });
    secondCtx.sessionPersistence = {
      list: async () => [],
      inspect: secondInspect,
      listSnapshots: async () => [{ header: { id: sessionId }, revision: "rev-1" }],
    };
    const secondRuntime = createMyMeterCordisHostRuntime({ ctx: secondCtx, ledgerPath });

    await waitFor(() => {
      expect(secondRuntime.remote.getSnapshot().summary.settledTotalMicroCny).toBe(6_050_000);
    });
    expect(secondInspect).not.toHaveBeenCalled();
    secondRuntime.uninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test.each(["deleted", "replaced"] as const)(
  "Cordis host fully replays unchanged revisions when the durable ledger was %s",
  async (mode) => {
    const directory = mkdtempSync(join(tmpdir(), `mymeter-cordis-history-${mode}-`));
    const ledgerPath = join(directory, "ledger.json");
    const sessionId = `cordis-history-${mode}`;

    try {
      const firstCtx = new FakeTypertHostContext();
      firstCtx.sessionPersistence = {
        list: async () => [],
        inspect: async () => ({
          meta: { id: sessionId },
          events: createCordisSettledEvents(Date.UTC(2026, 7, 17, 4)),
        }),
        listSnapshots: async () => [{ header: { id: sessionId }, revision: "rev-1" }],
      };
      const firstUninstall = applyCordisHost(firstCtx, { ledgerPath });
      await waitFor(() => {
        const checkpoint = JSON.parse(readFileSync(createRecoveryCheckpointPath(ledgerPath), "utf8")) as {
          sessionRevisions: Record<string, string>;
        };
        expect(checkpoint.sessionRevisions).toEqual({ [sessionId]: "rev-1" });
      });
      await firstUninstall();

      if (mode === "deleted") {
        rmSync(ledgerPath, { force: true });
      } else {
        writeFileSync(ledgerPath, JSON.stringify({ schemaVersion: 1, events: [] }, null, 2));
      }

      const secondCtx = new FakeTypertHostContext();
      const inspect = vi.fn(async () => ({
        meta: { id: sessionId },
        events: createCordisSettledEvents(Date.UTC(2026, 7, 17, 4)),
      }));
      secondCtx.sessionPersistence = {
        list: async () => [],
        inspect,
        listSnapshots: async () => [{ header: { id: sessionId }, revision: "rev-1" }],
      };
      const secondUninstall = applyCordisHost(secondCtx, { ledgerPath });

      await waitFor(() => expect(inspect).toHaveBeenCalledTimes(1));
      await secondUninstall();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test("Cordis host refreshes checkpoint fingerprint after live ledger commits", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mymeter-cordis-history-live-fp-"));
  const ledgerPath = join(directory, "ledger.json");
  const coldSessionId = "cordis-history-cold-before-live";
  const changedSessionId = "cordis-history-changed-after-live";

  try {
    const firstCtx = new FakeTypertHostContext();
    firstCtx.sessionPersistence = {
      list: async () => [],
      inspect: async () => ({
        meta: { id: coldSessionId },
        events: createCordisSettledEvents(Date.UTC(2026, 7, 17, 4)),
      }),
      listSnapshots: async () => [{ header: { id: coldSessionId }, revision: "rev-1" }],
    };
    const firstUninstall = applyCordisHost(firstCtx, { ledgerPath });
    await waitFor(() => {
      const checkpoint = readRecoveryCheckpointFile(ledgerPath);
      expect(checkpoint.sessionRevisions).toEqual({ [coldSessionId]: "rev-1" });
    });
    const fingerprintBeforeLive = readRecoveryCheckpointFile(ledgerPath).ledgerFingerprint;
    const checkpointPath = createRecoveryCheckpointPath(ledgerPath);
    const checkpointMtimeBeforeLive = statSync(checkpointPath, { bigint: true }).mtimeNs;

    const liveSession = { id: "cordis-history-live-after-checkpoint" };
    for (const event of createCordisSettledEvents(Date.UTC(2026, 7, 17, 5))) {
      firstCtx.emit(liveSession, event);
    }
    const secondLiveSession = { id: "cordis-history-second-live-after-checkpoint" };
    for (const event of createCordisSettledEvents(Date.UTC(2026, 7, 17, 5, 1))) {
      firstCtx.emit(secondLiveSession, event);
    }
    await waitFor(() => {
      const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as { events: unknown[] };
      expect(ledger.events).toHaveLength(3);
    });
    expect(readRecoveryCheckpointFile(ledgerPath).ledgerFingerprint).toBe(fingerprintBeforeLive);
    expect(statSync(checkpointPath, { bigint: true }).mtimeNs).toBe(checkpointMtimeBeforeLive);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await waitFor(() => {
      const checkpoint = readRecoveryCheckpointFile(ledgerPath);
      expect(checkpoint.ledgerFingerprint).toBe(createLedgerFingerprint(ledgerPath));
      expect(checkpoint.ledgerFingerprint).not.toBe(fingerprintBeforeLive);
    });
    await firstUninstall();

    const secondCtx = new FakeTypertHostContext();
    const readSession = vi.fn(async (sessionId: string) => ({
      session: { id: sessionId },
      events: createCordisSettledEvents(Date.UTC(2026, 7, 17, 6)),
    }));
    const inspect = vi.fn(async () => {
      throw new Error("query read should be used before persistence inspect");
    });
    secondCtx.sessionQuery = {
      listSessions: async () => [],
      readSession,
    };
    secondCtx.sessionPersistence = {
      list: async () => [],
      inspect,
      listSnapshots: async () => [
        { header: { id: coldSessionId }, revision: "rev-1" },
        { header: { id: changedSessionId }, revision: "rev-2" },
      ],
    };
    const secondUninstall = applyCordisHost(secondCtx, { ledgerPath });

    await waitFor(() => expect(readSession).toHaveBeenCalledTimes(1));
    expect(readSession).toHaveBeenCalledWith(changedSessionId);
    expect(inspect).not.toHaveBeenCalled();
    await secondUninstall();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Cordis bridge replays persistence history for created sessions without exposed events", async () => {
  const ctx = new FakeCordisContext();
  const sessionId = "created-without-events";
  const listDeferred = createDeferred<readonly unknown[]>();
  ctx.sessionPersistence = {
    list: async () => [],
    inspect: async () => ({
      meta: { id: sessionId },
      events: createCordisSettledEvents(Date.UTC(2026, 7, 17, 4)),
    }),
    listSnapshots: async () => listDeferred.promise,
  };
  const runtime = createMyMeterCordisHostRuntime({ ctx });

  ctx.emitEvent("session/created", { id: sessionId });
  listDeferred.resolve([{ header: { id: sessionId }, revision: "rev-1" }]);

  await waitFor(() => expect(runtime.events()).toHaveLength(1));
  expect(runtime.events()[0]?.sessionId).toBe(sessionId);
  runtime.uninstall();
});

test("Cordis bridge lets cold replay restore headers when a live event has no exposed session events", async () => {
  const ctx = new FakeCordisContext();
  const sessionId = "event-without-history-array";
  const listDeferred = createDeferred<readonly unknown[]>();
  ctx.sessionPersistence = {
    list: async () => [],
    inspect: async () => ({
      meta: { id: sessionId },
      events: createCordisSettledEvents(Date.UTC(2026, 7, 17, 4)),
    }),
    listSnapshots: async () => listDeferred.promise,
  };
  const runtime = createMyMeterCordisHostRuntime({ ctx });

  ctx.emit({ id: sessionId }, {
    type: "assistant/message",
    seq: 3,
    time: Date.UTC(2026, 7, 17, 4, 0, 1),
    data: {
      turn: 1,
      step: 1,
      message: { role: "assistant", content: [] },
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 },
    },
  });
  listDeferred.resolve([{ header: { id: sessionId }, revision: "rev-1" }]);

  await waitFor(() => expect(runtime.events()).toHaveLength(1));
  expect(runtime.events()[0]).toMatchObject({
    sessionId,
    model: "deepseek-v4-flash",
    status: "settled",
  });
  runtime.uninstall();
});

test("Cordis bridge does not bill a step that never reaches model activity", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-aborted-before-request" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
  });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 3,
    time: startedAt + 1_000,
    data: {
      turn: 1,
      step: 1,
      message: { role: "assistant", content: [] },
      usage: { inputTokens: 1_000, outputTokens: 100, cacheReadTokens: 1_000 },
    },
  });
  ctx.emit(session, { type: "step/end", seq: 4, time: startedAt + 1_001, data: { turn: 1, step: 1 } });
  ctx.emit(session, { type: "step/start", seq: 5, time: startedAt + 2_000, data: { turn: 1, step: 2 } });
  ctx.emit(session, {
    type: "turn/end",
    seq: 6,
    time: startedAt + 2_500,
    data: { turn: 1, reason: { kind: "aborted", reason: { kind: "user" } } },
  });

  const detail = runtime.remote.getSnapshot().details[session.id];
  expect(runtime.events()).toHaveLength(1);
  expect(detail?.estimatedTotalMicroCny).toBe(0);
  expect(detail?.stages).toEqual([
    expect.objectContaining({ status: "settled", estimatedTotalMicroCny: 0 }),
  ]);

  runtime.uninstall();
});

test("Cordis bridge reads optional session projections only inside an injected scope", () => {
  const base = new FakeCordisContext();
  const session = { id: "cordis-strict-injection" };
  base.setContextBreakdown(session.id, {
    systemTokens: 120,
    toolsTokens: 340,
    messageTokens: 560,
  });
  const ctx = new Proxy(base, {
    get(target, property) {
      if (property === "sessionProjections") {
        throw new Error('cannot get property "sessionProjections" without inject');
      }
      if (property === "inject") {
        return (services: readonly string[], callback: (scope: FakeCordisContext) => unknown) => {
          expect(services).toEqual(["sessionProjections"]);
          return callback(target);
        };
      }
      return Reflect.get(target, property, target);
    },
  }) as MyMeterCordisContext;
  const runtime = createMyMeterCordisHostRuntime({ ctx });

  base.emit(session, { type: "step/start", time: Date.UTC(2026, 7, 17, 4), data: { turn: 1, step: 1 } });
  base.emit(session, {
    type: "request/header",
    time: Date.UTC(2026, 7, 17, 4, 0, 0, 1),
    data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
  });
  base.emit(session, {
    type: "assistant/chunk",
    seq: 3,
    time: Date.UTC(2026, 7, 17, 4, 0, 1),
    data: { turn: 1, step: 1, chunk: { type: "usage", usage: { outputTokens: 100 } } },
  });

  expect(runtime.remote.getSnapshot().details[session.id]?.contextBreakdown).toEqual({
    systemTokens: 120,
    toolsTokens: 340,
    messageTokens: 560,
  });
  runtime.uninstall();
});

test("Cordis bridge accepts official snake-case usage fields", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-official-usage" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
  });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 3,
    time: startedAt + 1_000,
    data: {
      turn: 1,
      step: 1,
      message: { role: "assistant", content: [] },
      usage: {
        prompt_tokens: 2_000_000,
        completion_tokens: 1_000_000,
        prompt_tokens_details: { cached_tokens: 1_000_000 },
        completion_tokens_details: { reasoning_tokens: 400_000 },
      },
    },
  });

  expect(runtime.events()[0]).toMatchObject({
    status: "settled",
    cacheHitTokens: 1_000_000n,
    cacheMissTokens: 1_000_000n,
    outputTokens: 1_000_000n,
    reasoningTokens: 400_000n,
    amountMicroCny: 6_050_000n,
  });

  runtime.uninstall();
});

test("Cordis bridge settles a Grok request with the official xAI rates", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-fallback-completed" };
  const startedAt = Date.UTC(2026, 7, 18, 14);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: { header: { config: { provider: "cpa", model: "grok-4.6" } } },
  });
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 3,
    time: startedAt + 1_000,
    data: {
      turn: 1,
      step: 1,
      chunk: { type: "usage", usage: { inputTokens: 886, outputTokens: 409, cacheReadTokens: 192 } },
    },
  });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 4,
    time: startedAt + 1_100,
    data: {
      turn: 1,
      step: 1,
      message: { role: "assistant", content: [] },
      usage: { inputTokens: 886, outputTokens: 409, cacheReadTokens: 192 },
    },
  });
  ctx.emit(session, {
    type: "turn/end",
    seq: 5,
    time: startedAt + 1_200,
    data: { turn: 1, reason: { kind: "completed" } },
  });

  const snapshot = runtime.remote.getSnapshot();
  const detail = snapshot.details[session.id];
  expect(snapshot.summary.status.code).toBe("settled");
  expect(detail?.status).toBe("settled");
  expect(runtime.events()[0]).toMatchObject({
    provider: "cpa",
    model: "grok-4.6",
    status: "settled",
    pricingZone: "unknown",
    priceVersion: "xai-official-pricing-2026-08-18-usd",
    amountMicroCny: 31_118n,
  });
  expect(detail?.turns[0]).toMatchObject({ status: "settled", amountMicroCny: 31_118, completedAt: new Date(startedAt + 1_100).toISOString() });
  expect(detail?.stages[0]).toMatchObject({
    status: "settled",
    model: "grok-4.6",
    pricingZone: "unknown",
    priceVersion: "xai-official-pricing-2026-08-18-usd",
    exchangeRateLabel: "1 USD = ¥7.20",
  });
  expect(detail?.stages[0]?.tokenBuckets.slice(0, 3)).toEqual([
    { label: "缓存命中", tokens: 192, amountMicroCny: 691, unitPriceMicroCnyPerMillionTokens: 3_600_000, currency: "USD", amountMinor: 96, unitPriceMinorPerMillionTokens: 500_000 },
    { label: "缓存未命中", tokens: 886, amountMicroCny: 12_758, unitPriceMicroCnyPerMillionTokens: 14_400_000, currency: "USD", amountMinor: 1_772, unitPriceMinorPerMillionTokens: 2_000_000 },
    { label: "输出", tokens: 409, amountMicroCny: 17_669, unitPriceMicroCnyPerMillionTokens: 43_200_000, currency: "USD", amountMinor: 2_454, unitPriceMinorPerMillionTokens: 6_000_000 },
  ]);

  runtime.uninstall();
});

test("Cordis bridge settles an OpenAI request from the provider price catalog", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-openai-completed" };
  const startedAt = Date.UTC(2026, 7, 18, 14);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: { header: { config: { provider: "openai", model: "gpt-5.4" } } },
  });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 3,
    time: startedAt + 1_100,
    data: {
      turn: 1,
      step: 1,
      message: { role: "assistant", content: [] },
      usage: { inputTokens: 886, outputTokens: 409, cacheReadTokens: 192 },
    },
  });
  ctx.emit(session, {
    type: "turn/end",
    seq: 4,
    time: startedAt + 1_200,
    data: { turn: 1, reason: { kind: "completed" } },
  });

  const detail = runtime.remote.getSnapshot().details[session.id];
  expect(runtime.events()[0]).toMatchObject({
    provider: "openai",
    model: "gpt-5.4",
    status: "settled",
    pricingZone: "unknown",
    priceVersion: "openai-official-pricing-2026-08-18-usd",
    amountMicroCny: 60_466n,
  });
  expect(detail?.stages[0]).toMatchObject({
    model: "gpt-5.4",
    pricingZone: "unknown",
    priceVersion: "openai-official-pricing-2026-08-18-usd",
    exchangeRateLabel: "1 USD = ¥7.20",
  });

  runtime.uninstall();
});

test("mixed-currency sessions keep native totals and expose a latest-rate refresh action", async () => {
  const ctx = new FakeCordisContext();
  let rateFetchCount = 0;
  const runtime = createMyMeterCordisHostRuntime({
    ctx,
    exchangeRate: async () => {
      rateFetchCount += 1;
      if (rateFetchCount > 1) throw new Error("rate service unavailable");
      return { rate: 7.25, fetchedAt: "2026-08-19T00:00:00.000Z", source: "test-rate" };
    },
  });
  const session = { id: "mixed-currency-session" };
  const startedAt = Date.UTC(2026, 7, 19, 10);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
  });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 3,
    time: startedAt + 100,
    data: { turn: 1, step: 1, message: { role: "assistant", content: [] }, usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } },
  });

  ctx.emit(session, { type: "step/start", seq: 4, time: startedAt + 200, data: { turn: 2, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 5,
    time: startedAt + 201,
    data: { header: { config: { provider: "cpa", model: "grok-4.6" } } },
  });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 6,
    time: startedAt + 300,
    data: { turn: 2, step: 1, message: { role: "assistant", content: [] }, usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } },
  });

  const before = runtime.remote.getSnapshot();
  expect(before.details[session.id]?.currencyTotals).toEqual([
    { currency: "CNY", amountMinor: 6_000_000, settledMinor: 6_000_000, estimatedMinor: 0, failedMinor: 0 },
    { currency: "USD", amountMinor: 16_000_000, settledMinor: 16_000_000, estimatedMinor: 0, failedMinor: 0 },
  ]);
  expect(before.details[session.id]?.cnyEquivalentMicroCny).toBeNull();

  const refreshedRate = await runtime.remote.refreshExchangeRate();
  const after = runtime.remote.getSnapshot();
  expect(refreshedRate).toMatchObject({ status: "fresh", rate: 7.25, source: "test-rate" });
  expect(after.exchangeRate).toMatchObject({ status: "fresh", rate: 7.25, source: "test-rate" });
  expect(after.details[session.id]?.cnyEquivalentMicroCny).toBe(122_000_000);

  await runtime.remote.refreshExchangeRate();
  const failedRefresh = runtime.remote.getSnapshot();
  expect(failedRefresh.exchangeRate).toMatchObject({
    status: "error",
    rate: 7.25,
    error: "rate service unavailable",
  });
  expect(failedRefresh.details[session.id]?.cnyEquivalentMicroCny).toBe(122_000_000);
  runtime.uninstall();
});

test("OpenAI long-context tier starts a new billing segment", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-openai-tier-boundary" };
  const startedAt = Date.UTC(2026, 7, 18, 14);

  const emitRequest = (step: number, time: number, inputTokens: number): void => {
    ctx.emit(session, { type: "step/start", seq: step * 10 + 1, time, data: { turn: step, step: 1 } });
    ctx.emit(session, {
      type: "request/header",
      seq: step * 10 + 2,
      time: time + 1,
      data: { header: { config: { provider: "openai", model: "gpt-5.4" } } },
    });
    ctx.emit(session, {
      type: "assistant/message",
      seq: step * 10 + 3,
      time: time + 100,
      data: {
        turn: step,
        step: 1,
        message: { role: "assistant", content: [] },
        usage: { inputTokens, outputTokens: 1, cacheReadTokens: 0 },
      },
    });
    ctx.emit(session, {
      type: "turn/end",
      seq: step * 10 + 4,
      time: time + 200,
      data: { turn: step, reason: { kind: "completed" } },
    });
  };

  emitRequest(1, startedAt, 100);
  emitRequest(2, startedAt + 1_000, 272_001);

  const stages = runtime.remote.getSnapshot().details[session.id]?.stages ?? [];
  expect(stages).toHaveLength(2);
  expect(stages[0]?.tokenBuckets[1]?.unitPriceMicroCnyPerMillionTokens).toBe(18_000_000);
  expect(stages[1]?.tokenBuckets[1]?.unitPriceMicroCnyPerMillionTokens).toBe(36_000_000);

  runtime.uninstall();
});

test("real dsh event order renders the collapsed live receipt before usage arrives", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-real-order" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: {
      header: {
        config: {
          provider: "deepseek",
          model: "deepseek-v4-flash",
          reasoningEffort: "high",
        },
      },
    },
  });

  const store = createMyMeterStore({ remote: runtime.remote, storage: null });
  store.setOverlayCollapsed(true);
  render(<ShellOverlay store={store} />);

  expect(runtime.events()).toHaveLength(0);
  expect(runtime.remote.getSnapshot().summary.status.code).toBe("billing");
  expect(screen.getByText("▲ 正在生成")).toBeTruthy();

  act(() => {
    ctx.emit(session, {
      type: "assistant/chunk",
      seq: 3,
      time: startedAt + 1_000,
      data: {
        turn: 1,
        step: 1,
        chunk: {
          type: "usage",
          usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        },
      },
    });
  });

  expect(runtime.events()[0]).toMatchObject({ model: "deepseek-v4-flash", status: "estimated" });
  expect(runtime.remote.getSnapshot().summary.status.code).toBe("billing");
  expect(screen.getByText("▲ 正在生成")).toBeTruthy();

  act(() => {
    ctx.emit(session, {
      type: "assistant/message",
      seq: 4,
      time: startedAt + 1_001,
      data: {
        turn: 1,
        step: 1,
        message: { role: "assistant", content: [] },
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      },
    });
  });
  expect(runtime.remote.getSnapshot().summary.status.code).toBe("settled");

  act(() => {
    ctx.emit(session, { type: "step/start", seq: 5, time: startedAt + 2_000, data: { turn: 1, step: 2 } });
  });
  const secondStepSnapshot = runtime.remote.getSnapshot();
  expect(secondStepSnapshot.summary.status.code).toBe("billing");
  expect(secondStepSnapshot.details[session.id]?.status).toBe("billing");
  expect(secondStepSnapshot.details[session.id]?.turns).toHaveLength(1);
  expect(secondStepSnapshot.details[session.id]?.turns[0]).toMatchObject({
    label: "1",
    status: "billing",
    cacheMissTokens: 1_000_000,
    outputTokens: 1_000_000,
  });
  expect(secondStepSnapshot.details[session.id]?.stages).toHaveLength(1);
  expect(secondStepSnapshot.details[session.id]?.stages[0]).toMatchObject({
    status: "billing",
    model: "deepseek-v4-flash",
    reasoningEffort: "high",
  });
  expect(secondStepSnapshot.details[session.id]?.stages[0]?.turns).toHaveLength(1);

  store.destroy();
  runtime.uninstall();
});

test("live receipt values increase while DeepSeek output chunks are streaming", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-live-values" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: {
      header: {
        config: {
          provider: "deepseek",
          model: "deepseek-v4-flash",
          reasoningEffort: "high",
        },
      },
    },
  });

  const before = runtime.remote.getSnapshot();
  expect(before.summary.currentRequestMicroCny).toBe(0);

  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 3,
    time: startedAt + 100,
    data: {
      turn: 1,
      step: 1,
      chunk: { type: "reasoning-delta", index: 0, text: "分析过程".repeat(400) },
    },
  });

  const afterReasoning = runtime.remote.getSnapshot();
  const reasoningOutput = afterReasoning.details[session.id]?.tokenBuckets.find((bucket) => bucket.label === "输出");
  expect(afterReasoning.summary.currentRequestMicroCny).toBeGreaterThan(0);
  expect(reasoningOutput?.tokens).toBeGreaterThan(0);

  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 4,
    time: startedAt + 200,
    data: {
      turn: 1,
      step: 1,
      chunk: { type: "text-delta", index: 1, text: "最终回答".repeat(400) },
    },
  });

  const afterText = runtime.remote.getSnapshot();
  const textOutput = afterText.details[session.id]?.tokenBuckets.find((bucket) => bucket.label === "输出");
  expect(afterText.summary.currentRequestMicroCny).toBeGreaterThan(afterReasoning.summary.currentRequestMicroCny);
  expect(textOutput?.tokens).toBeGreaterThan(reasoningOutput?.tokens ?? 0);

  runtime.uninstall();
});

test("Cordis streaming estimate does not double count a block-end after deltas for the same block", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-block-end-dedupe" };
  const startedAt = Date.UTC(2026, 7, 17, 4);
  const content = "推理片段".repeat(20);
  const expectedTokens = Math.ceil(Buffer.byteLength(content, "utf8") / 4);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: {
      header: {
        config: {
          provider: "deepseek",
          model: "deepseek-v4-flash",
          reasoningEffort: "high",
        },
      },
    },
  });
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 3,
    time: startedAt + 100,
    data: {
      turn: 1,
      step: 1,
      chunk: { type: "reasoning-delta", index: 0, text: content },
    },
  });
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 4,
    time: startedAt + 200,
    data: {
      turn: 1,
      step: 1,
      chunk: { type: "block-end", index: 0, block: { type: "reasoning", text: content } },
    },
  });

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]?.outputTokens).toBe(BigInt(expectedTokens));
  expect(runtime.events()[0]?.reasoningTokens).toBe(BigInt(expectedTokens));

  runtime.uninstall();
});

test("Cordis streaming estimate counts tool call argument deltas", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-tool-call-delta" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
  });
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 3,
    time: startedAt + 100,
    data: {
      turn: 1,
      step: 1,
      chunk: {
        type: "tool-call-delta",
        index: 0,
        id: "call-1",
        name: "write",
        argumentsDelta: JSON.stringify({ content: "工具参数".repeat(200) }),
      },
    },
  });

  expect(runtime.events()[0]?.outputTokens).toBeGreaterThan(0n);
  expect(runtime.remote.getSnapshot().summary.currentRequestMicroCny).toBeGreaterThan(0);

  runtime.uninstall();
});

test("Cordis streaming estimates cap ledger writes during high-frequency deltas", () => {
  const ctx = new FakeCordisContext();
  const backing = createInMemoryCostEventRepository();
  let replacementCount = 0;
  const repository = {
    ...backing,
    commit: undefined,
    replaceAll(events: Parameters<typeof backing.replaceAll>[0]) {
      replacementCount += 1;
      backing.replaceAll(events);
    },
  } as unknown as NoCommitCostEventRepository;
  const runtime = createMyMeterCordisHostRuntime({
    ctx,
    repository,
  });
  const session = { id: "cordis-stream-throttle" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
  });
  for (let index = 0; index < 1_000; index += 1) {
    ctx.emit(session, {
      type: "assistant/chunk",
      seq: index + 3,
      time: startedAt + index + 2,
      data: {
        turn: 1,
        step: 1,
        chunk: { type: "text-delta", index: 0, text: "x" },
      },
    });
  }

  expect(replacementCount).toBeGreaterThanOrEqual(5);
  expect(replacementCount).toBeLessThanOrEqual(11);
  expect(runtime.events()).toHaveLength(1);

  runtime.uninstall();
});

test("Cordis startup replay batches persistence and skips unchanged settled history", () => {
  const startedAt = Date.UTC(2026, 7, 17, 4);
  const session = { id: "cordis-replay-persistence", events: [] as unknown[] };
  session.events.push(
    { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } },
    {
      type: "request/header",
      seq: 2,
      time: startedAt + 1,
      data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
    },
  );
  for (let index = 0; index < 1_000; index += 1) {
    session.events.push({
      type: "assistant/chunk",
      seq: index + 3,
      time: startedAt + index + 2,
      data: {
        turn: 1,
        step: 1,
        chunk: { type: "text-delta", index: 0, text: "x" },
      },
    });
  }
  session.events.push({
    type: "assistant/message",
    seq: 1_003,
    time: startedAt + 2_000,
    data: {
      turn: 1,
      step: 1,
      message: { role: "assistant", content: [] },
      usage: { inputTokens: 1_000, outputTokens: 250 },
    },
  });

  const backing = createInMemoryCostEventRepository();
  let replacementCount = 0;
  const repository = {
    ...backing,
    commit: undefined,
    replaceAll(events: Parameters<typeof backing.replaceAll>[0]) {
      replacementCount += 1;
      backing.replaceAll(events);
    },
  } as unknown as NoCommitCostEventRepository;
  const firstCtx = new FakeCordisContext();
  firstCtx.existingSessions.push(session);
  const firstRuntime = createMyMeterCordisHostRuntime({ ctx: firstCtx, repository });

  expect(firstRuntime.events()).toHaveLength(1);
  expect(firstRuntime.events()[0]?.status).toBe("settled");
  expect(replacementCount).toBe(1);
  firstRuntime.uninstall();

  replacementCount = 0;
  const restartedCtx = new FakeCordisContext();
  restartedCtx.existingSessions.push(session);
  const restartedRuntime = createMyMeterCordisHostRuntime({ ctx: restartedCtx, repository });

  expect(restartedRuntime.events()).toHaveLength(1);
  expect(replacementCount).toBe(0);
  restartedRuntime.uninstall();
});

test("Cordis bridge estimates replayed durable sessions from block-end content without deltas", () => {
  const ctx = new FakeCordisContext();
  const session = { id: "cordis-replay-block-end", events: [] as unknown[] };
  const startedAt = Date.UTC(2026, 7, 17, 4);
  const content = "压缩日志输出".repeat(30);
  const expectedTokens = Math.ceil(Buffer.byteLength(content, "utf8") / 4);
  session.events.push(
    { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } },
    {
      type: "request/header",
      seq: 2,
      time: startedAt + 1,
      data: {
        header: {
          config: {
            provider: "deepseek",
            model: "deepseek-v4-flash",
            reasoningEffort: "high",
          },
        },
      },
    },
    {
      type: "assistant/chunk",
      seq: 3,
      time: startedAt + 100,
      data: {
        turn: 1,
        step: 1,
        chunk: { type: "block-end", index: 0, block: { type: "text", text: content } },
      },
    },
  );
  ctx.existingSessions.push(session);

  const runtime = createMyMeterCordisHostRuntime({ ctx });

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]?.outputTokens).toBe(BigInt(expectedTokens));
  expect(runtime.remote.getSnapshot().summary.currentRequestMicroCny).toBeGreaterThan(0);

  runtime.uninstall();
});

test("Cordis final usage corrects streaming estimates to provider tokens and amount", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-final-corrects-estimate" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: {
      header: {
        config: {
          provider: "deepseek",
          model: "deepseek-v4-flash",
          reasoningEffort: "high",
        },
      },
    },
  });
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 3,
    time: startedAt + 100,
    data: {
      turn: 1,
      step: 1,
      chunk: { type: "text-delta", index: 0, text: "估算输出".repeat(200) },
    },
  });

  expect(runtime.events()[0]).toMatchObject({ status: "estimated", cacheHitTokens: 0n, cacheMissTokens: 0n });

  ctx.emit(session, {
    type: "assistant/message",
    seq: 4,
    time: startedAt + 1_000,
    data: {
      turn: 1,
      step: 1,
      message: { role: "assistant", content: [] },
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, reasoningTokens: 400_000 },
    },
  });

  const event = runtime.events()[0];
  const snapshot = runtime.remote.getSnapshot();
  expect(event).toMatchObject({
    status: "settled",
    cacheHitTokens: 1_000_000n,
    cacheMissTokens: 1_000_000n,
    outputTokens: 1_000_000n,
    reasoningTokens: 400_000n,
    amountMicroCny: 6_050_000n,
  });
  expect(snapshot.summary.status.code).toBe("settled");
  expect(snapshot.summary.settledTotalMicroCny).toBe(6_050_000);
  expect(snapshot.summary.estimatedTotalMicroCny).toBe(0);
  expect(snapshot.details[session.id]?.tokenBuckets).toEqual([
    {
      label: "缓存命中",
      tokens: 1_000_000,
      amountMicroCny: 50_000,
      unitPriceMicroCnyPerMillionTokens: 50_000,
    },
    {
      label: "缓存未命中",
      tokens: 1_000_000,
      amountMicroCny: 1_500_000,
      unitPriceMicroCnyPerMillionTokens: 1_500_000,
    },
    {
      label: "输出",
      tokens: 1_000_000,
      amountMicroCny: 4_500_000,
      unitPriceMicroCnyPerMillionTokens: 4_500_000,
    },
    {
      label: "其中推理",
      tokens: 400_000,
      amountMicroCny: 0,
      unitPriceMicroCnyPerMillionTokens: 4_500_000,
    },
  ]);

  runtime.uninstall();
});

test("Cordis keeps failed byte-based estimates marked as unfinalized stream data", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-heuristic-failure" };
  const startedAt = Date.UTC(2026, 7, 17, 4);
  const completedAt = startedAt + 200;

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
  });
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 3,
    time: startedAt + 100,
    data: {
      turn: 1,
      step: 1,
      chunk: { type: "text-delta", index: 0, text: "partial output".repeat(200) },
    },
  });
  expect(runtime.events()[0]).toMatchObject({ status: "estimated" });

  ctx.emit(session, {
    type: "turn/end",
    seq: 4,
    time: completedAt,
    data: { turn: 1, reason: { kind: "error" } },
  });

  expect(runtime.events()[0]).toMatchObject({
    status: "failed",
    source: "stream",
    requestOutcome: "failed",
    completedAt: new Date(completedAt).toISOString(),
  });
  expect(runtime.events()[0]?.outputTokens).toBeGreaterThan(0n);
  expect(runtime.events()[0]?.amountMicroCny).toBeGreaterThan(0n);
  expect(runtime.remote.getSnapshot().details[session.id]?.turns[0]?.completedAt).toBe(
    new Date(completedAt).toISOString(),
  );
  expect(runtime.remote.getSnapshot().details[session.id]?.stages[0]?.lastActivityAt).toBe(
    new Date(completedAt).toISOString(),
  );

  runtime.uninstall();
});

test("unsupported active models do not present a billable live receipt", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-unsupported-active" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    seq: 2,
    time: startedAt + 1,
    data: { header: { config: { provider: "unknown-route", model: "unknown-model" } } },
  });
  ctx.emit(session, {
    type: "assistant/chunk",
    seq: 3,
    time: startedAt + 2,
    data: {
      turn: 1,
      step: 1,
      chunk: { type: "text-delta", index: 0, text: "unsupported output".repeat(100) },
    },
  });

  expect(runtime.events()).toHaveLength(0);
  expect(runtime.remote.getSnapshot().summary.status.code).toBe("idle");

  const deepSeekSession = { id: "cordis-supported-active" };
  ctx.emit(deepSeekSession, { type: "step/start", seq: 4, time: startedAt + 3, data: { turn: 1, step: 1 } });
  ctx.emit(deepSeekSession, {
    type: "request/header",
    seq: 5,
    time: startedAt + 4,
    data: { header: { config: { provider: "deepseek-official", model: "deepseek-v4-flash" } } },
  });
  ctx.emit(session, {
    type: "request/header",
    seq: 6,
    time: startedAt + 5,
    data: { header: { config: { provider: "unknown-route", model: "unknown-model" } } },
  });

  const mixedSnapshot = runtime.remote.getSnapshot();
  expect(mixedSnapshot.summary.status.code).toBe("billing");
  expect(mixedSnapshot.currentSessionId).toBe(deepSeekSession.id);

  runtime.uninstall();
});

test("Cordis bridge replays existing durable sessions when the plugin hot-loads", () => {
  const ctx = new FakeCordisContext();
  const startedAt = Date.UTC(2026, 7, 17, 4);
  ctx.existingSessions.push({
    id: "cordis-restored",
    events: [
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
          usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        },
      },
    ],
  });

  const runtime = createMyMeterCordisHostRuntime({ ctx });
  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]).toMatchObject({ sessionId: "cordis-restored", status: "settled" });
  expect(runtime.ledger().settledMicroCny).toBe(6_000_000);
  runtime.uninstall();
});

test("Cordis bridge backfills cold persisted sessions through session query", async () => {
  const ctx = new FakeCordisContext();
  const startedAt = Date.UTC(2026, 7, 17, 4);
  const sessionId = "cordis-cold-query";
  const snapshot = {
    session: { id: sessionId },
    events: [
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
          usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        },
      },
    ],
  };
  ctx.sessionQuery = {
    listSessions: async () => [{ header: { id: sessionId }, live: false, persisted: true }],
    readSession: async (id) => id === sessionId ? snapshot : { session: { id }, events: [] },
  };

  const runtime = createMyMeterCordisHostRuntime({ ctx });
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]).toMatchObject({ sessionId, status: "settled" });
  expect(runtime.ledger().settledMicroCny).toBe(6_000_000);
  runtime.uninstall();
});

test("Cordis cold-history backfill yields to the event loop between sessions", async () => {
  const ctx = new FakeCordisContext();
  const order: string[] = [];
  let secondReadComplete: (() => void) | undefined;
  const secondRead = new Promise<void>((resolve) => {
    secondReadComplete = resolve;
  });
  ctx.sessionQuery = {
    listSessions: async () => [
      { header: { id: "cold-yield-1" }, live: false, persisted: true },
      { header: { id: "cold-yield-2" }, live: false, persisted: true },
    ],
    readSession: async (sessionId) => {
      order.push(`read:${sessionId}`);
      if (sessionId === "cold-yield-2") secondReadComplete?.();
      return { session: { id: sessionId }, events: [] };
    },
  };
  setTimeout(() => order.push("timer"), 0);

  const runtime = createMyMeterCordisHostRuntime({ ctx });
  await secondRead;

  expect(order).toEqual(["read:cold-yield-1", "timer", "read:cold-yield-2"]);
  runtime.uninstall();
});

test("Cordis bridge falls back to session persistence for cold history", async () => {
  const ctx = new FakeCordisContext();
  const startedAt = Date.UTC(2026, 7, 17, 4);
  const sessionId = "cordis-cold-persistence";
  const events = [
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
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      },
    },
  ];
  ctx.sessionPersistence = {
    list: async () => [{ id: sessionId }],
    inspect: async () => ({ meta: { id: sessionId }, events }),
  };

  const runtime = createMyMeterCordisHostRuntime({ ctx });
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  expect(runtime.events()).toHaveLength(1);
  expect(runtime.events()[0]).toMatchObject({ sessionId, status: "settled" });
  runtime.uninstall();
});

test("Cordis bridge does not finalize an unobserved attempt when retry starts", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-retry-before-request" };
  const startedAt = Date.UTC(2026, 7, 17, 4);

  ctx.emit(session, { type: "step/start", seq: 1, time: startedAt, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "llm/retry-started",
    seq: 2,
    time: startedAt + 1_000,
    data: { retryId: "retry-1", turn: 1, step: 1, retry: 1 },
  });

  expect(runtime.events()).toHaveLength(0);
  expect(runtime.remote.getSnapshot().summary.status.code).toBe("idle");

  runtime.uninstall();
});

test("Cordis bridge bills a retry under the retry attempt and locks its actual start time", () => {
  const ctx = new FakeCordisContext();
  const runtime = createMyMeterCordisHostRuntime({ ctx });
  const session = { id: "cordis-retry" };
  const initialStart = Date.UTC(2026, 7, 17, 3, 59, 59);
  const retryStart = Date.UTC(2026, 7, 17, 4, 0, 1);

  ctx.emit(session, { type: "step/start", time: initialStart, data: { turn: 1, step: 1 } });
  ctx.emit(session, {
    type: "request/header",
    time: initialStart + 1,
    data: { header: { config: { provider: "deepseek", model: "deepseek-v4-flash" } } },
  });
  ctx.emit(session, {
    type: "llm/retry",
    time: initialStart + 500,
    data: { retryId: "retry-1", turn: 1, step: 1, retry: 1 },
  });
  ctx.emit(session, {
    type: "llm/retry-started",
    time: retryStart,
    data: { retryId: "retry-1", turn: 1, step: 1, retry: 1 },
  });
  ctx.emit(session, {
    type: "request/header",
    time: retryStart + 1,
    data: { header: { config: { provider: "deepseek", model: "deepseek-v4-pro" } } },
  });
  ctx.emit(session, {
    type: "assistant/message",
    seq: 5,
    time: retryStart + 1_000,
    data: {
      turn: 1,
      step: 1,
      message: { role: "assistant", content: [] },
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
    },
  });

  expect(runtime.events()).toHaveLength(2);
  expect(runtime.events()[0]).toMatchObject({
    attemptId: "attempt-0",
    status: "failed",
    requestOutcome: "failed",
  });
  expect(runtime.events()[1]).toMatchObject({
    attemptId: "retry-1",
    requestStartedAt: new Date(retryStart).toISOString(),
    model: "deepseek-v4-pro",
    pricingZone: "offpeak",
  });
  runtime.uninstall();
});
