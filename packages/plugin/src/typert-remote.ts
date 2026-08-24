import type {
  MyMeterRemote,
  MyMeterRemoteSnapshot,
  RemoteCostAnalyticsReport,
  RemoteProviderBalanceSnapshot,
  RemoteCurrencyTotal,
  RemoteExchangeRateSnapshot,
  RemoteLedgerExportFormat,
  RemoteLedgerSummary,
  RemoteSessionCostTree,
  RemoteSessionCostTreeNode,
  RemoteSessionDetail,
  RemoteSessionSummary,
  RemoteUsageOverviewQuery,
  RemoteUsageOverviewReport,
} from "../../client/src/index";
import type { RemoteSessionStage } from "../../client/src/store";

export type RemoteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly details: object } };

export interface TypertSchema<T = unknown> {
  parse(value: unknown): T;
}

export interface TypertCodec<T = unknown> {
  readonly mode: "strict";
  readonly typeSymbol: string;
  readonly schema: TypertSchema<T>;
}

export interface InvocationDescriptor {
  readonly id: string;
  readonly service: string;
  readonly namespace: string;
  readonly method: string;
  readonly invocation: { readonly kind: "direct" };
  readonly parameters: readonly {
    readonly name: string;
    readonly wire: string;
    readonly source: "json";
    readonly codec: TypertCodec;
  }[];
  readonly result: TypertCodec;
}

export interface TypertRemoteContribution {
  readonly package: string;
  readonly descriptors: readonly InvocationDescriptor[];
}

export interface TypertLocalContribution {
  readonly package: string;
  readonly face: "host";
  readonly schemas: readonly { readonly name: string; readonly schema: TypertSchema }[];
  readonly model: {
    readonly services: readonly unknown[];
    readonly events: readonly unknown[];
    readonly objects: readonly unknown[];
  };
  readonly invocations: readonly InvocationDescriptor[];
}

export interface MyMeterTypertRemoteNamespace {
  getSnapshot(): Promise<RemoteResult<MyMeterRemoteSnapshot>>;
  listSessions(): Promise<RemoteResult<RemoteSessionSummary[]>>;
  getSessionDetail(sessionId: string): Promise<RemoteResult<RemoteSessionDetail | null>>;
  getSessionCostTree?(): Promise<RemoteResult<RemoteSessionCostTree>>;
  getCostAnalytics?(): Promise<RemoteResult<RemoteCostAnalyticsReport>>;
  getUsageOverview?(query: RemoteUsageOverviewQuery): Promise<RemoteResult<RemoteUsageOverviewReport>>;
  exportLedger?(format: RemoteLedgerExportFormat): Promise<RemoteResult<string>>;
  getBalance(): Promise<RemoteResult<MyMeterRemoteSnapshot["balance"]>>;
  refreshBalance?(): Promise<RemoteResult<MyMeterRemoteSnapshot["balance"]>>;
  getSettings(): Promise<RemoteResult<Record<string, unknown>>>;
  refreshExchangeRate?(): Promise<RemoteResult<RemoteExchangeRateSnapshot>>;
}

export interface MyMeterTypertRemoteRoot {
  $mount(contribution: TypertRemoteContribution): Promise<() => Promise<void>>;
  mymeter?: MyMeterTypertRemoteNamespace;
}

export interface MyMeterTypertRemoteAdapter extends MyMeterRemote {
  refresh(): Promise<void>;
  getSessionCostTree(): Promise<RemoteSessionCostTree>;
  getCostAnalytics(): Promise<RemoteCostAnalyticsReport>;
  getUsageOverview(query: RemoteUsageOverviewQuery): Promise<RemoteUsageOverviewReport>;
  exportLedger(format: RemoteLedgerExportFormat): Promise<string>;
  refreshBalance(): Promise<MyMeterRemoteSnapshot["balance"]>;
  dispose(): void;
}

export interface MyMeterTypertRemoteAdapterOptions {
  pollIntervalMs?: number;
  /** Poll cadence while `document.visibilityState === "hidden"`. Defaults to `max(pollIntervalMs, 2000)`. */
  hiddenPollIntervalMs?: number;
  balancePollIntervalMs?: number;
}

export const MYMETER_SERVICE_KEY = "mymeter";
export const MYMETER_PACKAGE_NAME = "@mymeter/dsh-cost-meter";

const stringSchema = schema<string>("string", (value) => {
  if (typeof value !== "string") throw new Error("expected string");
  return value;
});
const ledgerExportFormatSchema = schema<RemoteLedgerExportFormat>("LedgerExportFormat", (value) =>
  oneOf(value, ["json", "csv"], "ledgerExportFormat")
);
const sessionIdSchema = schema<string>("SessionId", (value) => {
  if (typeof value !== "string" || value.length === 0) throw new Error("expected non-empty session id");
  return value;
});
const snapshotSchema = schema<MyMeterRemoteSnapshot>("MyMeterRemoteSnapshot", parseSnapshot);
const sessionsSchema = schema<RemoteSessionSummary[]>("RemoteSessionSummaryArray", (value) => {
  if (!Array.isArray(value)) throw new Error("expected session array");
  return value.map(parseSessionSummary);
});
const sessionDetailOrNullSchema = schema<RemoteSessionDetail | null>("RemoteSessionDetailOrNull", (value) => {
  if (value === null) return null;
  return parseSessionDetail(value);
});
const balanceSchema = schema<MyMeterRemoteSnapshot["balance"]>("RemoteBalanceSnapshot", parseBalance);
const settingsSchema = schema<Record<string, unknown>>("RemoteSettings", (value) => {
  if (!isRecord(value)) throw new Error("expected settings object");
  return value;
});
const exchangeRateSchema = schema<RemoteExchangeRateSnapshot>("RemoteExchangeRateSnapshot", parseExchangeRate);
const sessionCostTreeSchema = schema<RemoteSessionCostTree>("RemoteSessionCostTree", parseSessionCostTree);
const costAnalyticsSchema = schema<RemoteCostAnalyticsReport>("RemoteCostAnalyticsReport", parseCostAnalyticsReport);
const usageOverviewQuerySchema = schema<RemoteUsageOverviewQuery>("RemoteUsageOverviewQuery", parseUsageOverviewQuery);
const usageOverviewSchema = schema<RemoteUsageOverviewReport>("RemoteUsageOverviewReport", parseUsageOverviewReport);

const getSnapshotDescriptor = descriptor("getSnapshot", [], snapshotSchema);
const listSessionsDescriptor = descriptor("listSessions", [], sessionsSchema);
const getSessionDetailDescriptor = descriptor(
  "getSessionDetail",
  [{ name: "sessionId", wire: "sessionId", source: "json", codec: codec("SessionId", sessionIdSchema) }],
  sessionDetailOrNullSchema,
);
const getBalanceDescriptor = descriptor("getBalance", [], balanceSchema);
const refreshBalanceDescriptor = descriptor("refreshBalance", [], balanceSchema);
const getSettingsDescriptor = descriptor("getSettings", [], settingsSchema);
const refreshExchangeRateDescriptor = descriptor("refreshExchangeRate", [], exchangeRateSchema);
const getSessionCostTreeDescriptor = descriptor("getSessionCostTree", [], sessionCostTreeSchema);
const getCostAnalyticsDescriptor = descriptor("getCostAnalytics", [], costAnalyticsSchema);
const getUsageOverviewDescriptor = descriptor(
  "getUsageOverview",
  [{ name: "query", wire: "query", source: "json", codec: codec("RemoteUsageOverviewQuery", usageOverviewQuerySchema) }],
  usageOverviewSchema,
);
const exportLedgerDescriptor = descriptor(
  "exportLedger",
  [{ name: "format", wire: "format", source: "json", codec: codec("LedgerExportFormat", ledgerExportFormatSchema) }],
  stringSchema,
);

export const MYMETER_REMOTE_DESCRIPTORS: readonly InvocationDescriptor[] = [
  getSnapshotDescriptor,
  listSessionsDescriptor,
  getSessionDetailDescriptor,
  getBalanceDescriptor,
  refreshBalanceDescriptor,
  getSettingsDescriptor,
  refreshExchangeRateDescriptor,
  getSessionCostTreeDescriptor,
  getCostAnalyticsDescriptor,
  getUsageOverviewDescriptor,
  exportLedgerDescriptor,
];

export const MYMETER_REMOTE_CONTRIBUTION: TypertRemoteContribution = Object.freeze({
  package: MYMETER_PACKAGE_NAME,
  descriptors: MYMETER_REMOTE_DESCRIPTORS,
});

export const MYMETER_LOCAL_TYPERT_CONTRIBUTION: TypertLocalContribution = Object.freeze({
  package: MYMETER_PACKAGE_NAME,
  face: "host",
  schemas: [
    { name: "MyMeterRemoteSnapshot", schema: snapshotSchema },
    { name: "RemoteSessionSummaryArray", schema: sessionsSchema },
    { name: "RemoteSessionDetailOrNull", schema: sessionDetailOrNullSchema },
    { name: "RemoteBalanceSnapshot", schema: balanceSchema },
    { name: "RemoteSettings", schema: settingsSchema },
    { name: "RemoteExchangeRateSnapshot", schema: exchangeRateSchema },
    { name: "RemoteSessionCostTree", schema: sessionCostTreeSchema },
    { name: "RemoteCostAnalyticsReport", schema: costAnalyticsSchema },
    { name: "RemoteUsageOverviewQuery", schema: usageOverviewQuerySchema },
    { name: "RemoteUsageOverviewReport", schema: usageOverviewSchema },
    { name: "LedgerExportFormat", schema: ledgerExportFormatSchema },
  ],
  model: {
    services: [{
      key: MYMETER_SERVICE_KEY,
      exportName: "MyMeterRemote",
      summary: "MyMeter cost-meter Remote service.",
      tags: [],
      members: MYMETER_REMOTE_DESCRIPTORS.map((entry) => ({
        kind: "method",
        name: entry.method,
        signature: `${entry.method}(...): Promise<unknown>`,
      })),
      types: [],
    }],
    events: [],
    objects: [],
  },
  invocations: MYMETER_REMOTE_DESCRIPTORS,
});

export function bindMyMeterTypertRemote<Service extends object>(service: Service): Service & {
  readonly typertRemote: { readonly service: Service; readonly serviceKey: string; readonly namespace: string };
} {
  return Object.assign(service, {
    typertRemote: Object.freeze({
      service,
      serviceKey: MYMETER_SERVICE_KEY,
      namespace: MYMETER_SERVICE_KEY,
    }),
  });
}

export async function createMyMeterRemoteFromTypert(
  namespace: MyMeterTypertRemoteNamespace,
  options: MyMeterTypertRemoteAdapterOptions = {},
): Promise<MyMeterTypertRemoteAdapter> {
  const listeners = new Set<(snapshot: MyMeterRemoteSnapshot) => void>();
  let snapshot = await readSnapshot(namespace, false);
  let disposed = false;
  let refreshing = false;
  let refreshingBalance = false;
  let initialBalanceRequested = false;
  // DeepSeek usage lands only at stream completion. Poll frequently enough
  // to expose the output-delta estimates before final settlement replaces them.
  const pollIntervalMs = options.pollIntervalMs ?? 200;
  // Background tabs cannot see the meter; slow the poll down to keep idle
  // CPU/RPC cost near zero without freezing balance or connection recovery.
  const hiddenPollIntervalMs = options.hiddenPollIntervalMs ?? Math.max(pollIntervalMs, 2_000);
  const balancePollIntervalMs = options.balancePollIntervalMs ?? 5 * 60_000;

  async function refresh(): Promise<void> {
    if (disposed || refreshing) return;
    refreshing = true;
    let unchanged = false;
    try {
      const next = await readSnapshot(namespace, false);
      // The host bumps `snapshotVersion` only when content actually changed,
      // so equal versions mean this poll is a no-op for subscribers.
      unchanged = next.snapshotVersion !== undefined
        && snapshot.snapshotVersion !== undefined
        && next.snapshotVersion === snapshot.snapshotVersion
        && snapshot.connection.status === "connected";
      snapshot = next;
    } catch (error) {
      snapshot = {
        ...snapshot,
        connection: {
          status: "stale",
          message: error instanceof Error ? error.message.replace(/^mymeter: getSnapshot failed: /, "") : "Remote 连接失败",
        },
      };
    } finally {
      refreshing = false;
    }
    if (disposed) return;
    if (!unchanged) {
      for (const listener of listeners) listener(snapshot);
    }
    if (!initialBalanceRequested) {
      initialBalanceRequested = true;
      void updateBalance().then((balance) => {
        if (!balance || disposed) return;
        for (const listener of listeners) listener(snapshot);
      });
    }
  }

  async function updateBalance(force = false): Promise<MyMeterRemoteSnapshot["balance"] | null> {
    if (disposed || refreshingBalance) return null;
    refreshingBalance = true;
    try {
      const result = force && namespace.refreshBalance
        ? await namespace.refreshBalance()
        : await namespace.getBalance();
      if (!result.ok || disposed) return null;
      const balance = balanceSchema.parse(result.value);
      snapshot = {
        ...snapshot,
        balance,
        balances: refreshSupportedBalances(snapshot.balances, balance),
      };
      return balance;
    } catch {
      return null;
    } finally {
      refreshingBalance = false;
    }
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const startPollInterval = (delayMs: number): void => {
    if (pollTimer !== null) clearInterval(pollTimer);
    pollTimer = delayMs > 0
      ? setInterval(() => {
        void refresh();
      }, delayMs)
      : null;
    if (pollTimer?.unref) pollTimer.unref();
  };
  const pollingEnabled = pollIntervalMs > 0;
  startPollInterval(pollIntervalMs);

  const balanceInterval = balancePollIntervalMs > 0
    ? setInterval(() => {
      void updateBalance().then((balance) => {
        if (!balance || disposed) return;
        for (const listener of listeners) listener(snapshot);
      });
    }, balancePollIntervalMs)
    : null;
  if (balanceInterval?.unref) balanceInterval.unref();

  const handleVisibilityChange = (): void => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "visible") {
      // Catch up immediately after a hidden slow-poll period, then resume the
      // fast cadence for live output-delta estimates.
      if (pollingEnabled && !disposed) startPollInterval(pollIntervalMs);
      void refresh();
      void updateBalance().then((balance) => {
        if (!balance || disposed) return;
        for (const listener of listeners) listener(snapshot);
      });
    } else if (pollingEnabled && !disposed) {
      startPollInterval(hiddenPollIntervalMs);
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (pollTimer !== null) clearInterval(pollTimer);
    pollTimer = null;
    if (balanceInterval) clearInterval(balanceInterval);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    listeners.clear();
  }

  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    async getSessionDetail(sessionId: string) {
      const result = await namespace.getSessionDetail(sessionId);
      if (!result.ok) throw new Error(`mymeter: getSessionDetail failed: ${result.error.message}`);
      return sessionDetailOrNullSchema.parse(result.value);
    },
    async refreshBalance() {
      const balance = await updateBalance(true);
      if (!balance) return snapshot.balance;
      for (const listener of listeners) listener(snapshot);
      return balance;
    },
    async refreshExchangeRate() {
      if (!namespace.refreshExchangeRate) return;
      const result = await namespace.refreshExchangeRate();
      if (!result.ok) throw new Error(`mymeter: refreshExchangeRate failed: ${result.error.message}`);
      snapshot = { ...snapshot, exchangeRate: exchangeRateSchema.parse(result.value) };
      for (const listener of listeners) listener(snapshot);
    },
    async getSessionCostTree() {
      if (!namespace.getSessionCostTree) {
        throw new Error("mymeter: getSessionCostTree failed: method unavailable");
      }
      const result = await namespace.getSessionCostTree();
      if (!result.ok) throw new Error(`mymeter: getSessionCostTree failed: ${result.error.message}`);
      return sessionCostTreeSchema.parse(result.value);
    },
    async getCostAnalytics() {
      if (!namespace.getCostAnalytics) {
        throw new Error("mymeter: getCostAnalytics failed: method unavailable");
      }
      const result = await namespace.getCostAnalytics();
      if (!result.ok) throw new Error(`mymeter: getCostAnalytics failed: ${result.error.message}`);
      return costAnalyticsSchema.parse(result.value);
    },
    async getUsageOverview(query) {
      if (!namespace.getUsageOverview) {
        throw new Error("mymeter: getUsageOverview failed: method unavailable");
      }
      const parsedQuery = usageOverviewQuerySchema.parse(query);
      const result = await namespace.getUsageOverview(parsedQuery);
      if (!result.ok) throw new Error(`mymeter: getUsageOverview failed: ${result.error.message}`);
      return usageOverviewSchema.parse(result.value);
    },
    async exportLedger(format) {
      if (!namespace.exportLedger) {
        throw new Error("mymeter: exportLedger failed: method unavailable");
      }
      const result = await namespace.exportLedger(format);
      if (!result.ok) throw new Error(`mymeter: exportLedger failed: ${result.error.message}`);
      return stringSchema.parse(result.value);
    },
    dispose,
  };
}

async function readSnapshot(
  namespace: MyMeterTypertRemoteNamespace,
  includeBalance = true,
): Promise<MyMeterRemoteSnapshot> {
  const result = await namespace.getSnapshot();
  if (!result.ok) {
    throw new Error(`mymeter: getSnapshot failed: ${result.error.message}`);
  }
  const snapshot = snapshotSchema.parse(result.value);
  if (!includeBalance) {
    return snapshot;
  }
  const balanceResult = await namespace.getBalance().catch(() => null);
  if (!balanceResult?.ok) {
    return snapshot;
  }
  return {
    ...snapshot,
    balance: balanceSchema.parse(balanceResult.value),
    balances: refreshSupportedBalances(snapshot.balances, balanceSchema.parse(balanceResult.value)),
  };
}

function descriptor(
  method: string,
  parameters: InvocationDescriptor["parameters"],
  resultSchema: TypertSchema,
): InvocationDescriptor {
  return Object.freeze({
    id: `${MYMETER_PACKAGE_NAME}#${MYMETER_SERVICE_KEY}/${method}`,
    service: MYMETER_SERVICE_KEY,
    namespace: MYMETER_SERVICE_KEY,
    method,
    invocation: { kind: "direct" as const },
    parameters,
    result: codec(resultSchemaName(resultSchema), resultSchema),
  });
}

function codec(typeName: string, valueSchema: TypertSchema): TypertCodec {
  return { mode: "strict", typeSymbol: `${MYMETER_PACKAGE_NAME}#${typeName}`, schema: valueSchema };
}

function schema<T>(name: string, parse: (value: unknown) => T): TypertSchema<T> & { readonly typeName: string } {
  return Object.freeze({ typeName: name, parse });
}

function resultSchemaName(valueSchema: TypertSchema): string {
  return "typeName" in valueSchema && typeof valueSchema.typeName === "string" ? valueSchema.typeName : "Unknown";
}

function parseSnapshot(value: unknown): MyMeterRemoteSnapshot {
  const record = object(value, "snapshot");
  const sessions = array(record.sessions, "sessions").map(parseSessionSummary);
  const rawDetails = object(record.details, "details");
  const details: Record<string, RemoteSessionDetail> = {};
  for (const [key, detail] of Object.entries(rawDetails)) details[key] = parseSessionDetail(detail);
  const summary = parseSummary(record.summary);
  const balance = parseBalance(record.balance);
  const balances = record.balances === undefined
    ? legacyProviderBalances(summary.provider, balance)
    : array(record.balances, "balances").map(parseProviderBalance);

  return {
    connection: parseConnection(record.connection),
    currentSessionId: nullableString(record.currentSessionId, "currentSessionId"),
    summary,
    balance,
    balances,
    sessions,
    details,
    ...(record.exchangeRate === undefined ? {} : { exchangeRate: parseExchangeRate(record.exchangeRate) }),
    ...(record.ledgerGeneration === undefined
      ? {}
      : { ledgerGeneration: nonNegativeInteger(record.ledgerGeneration, "ledgerGeneration") }),
    ...(record.snapshotVersion === undefined
      ? {}
      : { snapshotVersion: nonNegativeInteger(record.snapshotVersion, "snapshotVersion") }),
  };
}

function parseSessionCostTree(value: unknown): RemoteSessionCostTree {
  const record = object(value, "sessionCostTree");
  const rawNodes = object(record.nodes, "sessionCostTree.nodes");
  const nodes: Record<string, RemoteSessionCostTreeNode> = {};
  for (const [key, node] of Object.entries(rawNodes)) {
    nodes[key] = parseSessionCostTreeNode(node, `sessionCostTree.nodes.${key}`);
  }
  const anomalies = object(record.anomalies, "sessionCostTree.anomalies");
  return {
    roots: array(record.roots, "sessionCostTree.roots").map((node) =>
      parseSessionCostTreeNode(node, "sessionCostTree.roots")
    ),
    nodes,
    summary: parseLedgerSummary(record.summary, "sessionCostTree.summary"),
    anomalies: {
      missingParents: array(anomalies.missingParents, "sessionCostTree.anomalies.missingParents").map((item) => {
        const missing = object(item, "sessionCostTree.anomalies.missingParents");
        return {
          sessionId: requiredString(missing.sessionId, "missingParent.sessionId"),
          parentSessionId: requiredString(missing.parentSessionId, "missingParent.parentSessionId"),
        };
      }),
      cycles: array(anomalies.cycles, "sessionCostTree.anomalies.cycles").map((cycle) =>
        array(cycle, "sessionCostTree.anomalies.cycles[]").map((sessionId) =>
          requiredString(sessionId, "cycle.sessionId")
        )
      ),
    },
  };
}

function parseSessionCostTreeNode(value: unknown, field: string): RemoteSessionCostTreeNode {
  const record = object(value, field);
  return {
    id: requiredString(record.id, `${field}.id`),
    title: requiredString(record.title, `${field}.title`),
    ...(record.parentSessionId === undefined
      ? {}
      : { parentSessionId: requiredString(record.parentSessionId, `${field}.parentSessionId`) }),
    childSessionIds: array(record.childSessionIds, `${field}.childSessionIds`).map((item) =>
      requiredString(item, `${field}.childSessionIds[]`)
    ),
    depth: nonNegativeNumber(record.depth, `${field}.depth`),
    path: array(record.path, `${field}.path`).map((item) => requiredString(item, `${field}.path[]`)),
    summary: parseLedgerSummary(record.summary, `${field}.summary`),
    subtreeSummary: parseLedgerSummary(record.subtreeSummary, `${field}.subtreeSummary`),
    ...(record.detail === undefined ? {} : { detail: parseSessionDetail(record.detail) }),
    orphaned: boolean(record.orphaned, `${field}.orphaned`),
    cyclic: boolean(record.cyclic, `${field}.cyclic`),
  };
}

function parseLedgerSummary(value: unknown, field: string): RemoteLedgerSummary {
  const record = object(value, field);
  return {
    requestCount: finiteNumber(record.requestCount, `${field}.requestCount`),
    totalMicroCny: finiteNumber(record.totalMicroCny, `${field}.totalMicroCny`),
    estimatedMicroCny: finiteNumber(record.estimatedMicroCny, `${field}.estimatedMicroCny`),
    settledMicroCny: finiteNumber(record.settledMicroCny, `${field}.settledMicroCny`),
    unknownMicroCny: finiteNumber(record.unknownMicroCny, `${field}.unknownMicroCny`),
    failedMicroCny: finiteNumber(record.failedMicroCny, `${field}.failedMicroCny`),
    unknownCount: finiteNumber(record.unknownCount, `${field}.unknownCount`),
    estimatedCount: finiteNumber(record.estimatedCount, `${field}.estimatedCount`),
    settledCount: finiteNumber(record.settledCount, `${field}.settledCount`),
    failedCount: finiteNumber(record.failedCount, `${field}.failedCount`),
    cacheHitTokens: finiteNumber(record.cacheHitTokens, `${field}.cacheHitTokens`),
    cacheMissTokens: finiteNumber(record.cacheMissTokens, `${field}.cacheMissTokens`),
    outputTokens: finiteNumber(record.outputTokens, `${field}.outputTokens`),
    reasoningTokens: finiteNumber(record.reasoningTokens, `${field}.reasoningTokens`),
    peakMicroCny: finiteNumber(record.peakMicroCny, `${field}.peakMicroCny`),
    offpeakMicroCny: finiteNumber(record.offpeakMicroCny, `${field}.offpeakMicroCny`),
    firstSeenAt: requiredString(record.firstSeenAt, `${field}.firstSeenAt`),
    lastSeenAt: requiredString(record.lastSeenAt, `${field}.lastSeenAt`),
    provider: requiredString(record.provider, `${field}.provider`),
    model: requiredString(record.model, `${field}.model`),
    reasoningEffort: requiredString(record.reasoningEffort, `${field}.reasoningEffort`),
    agentPreset: requiredString(record.agentPreset, `${field}.agentPreset`),
  };
}

function parseCostAnalyticsReport(value: unknown): RemoteCostAnalyticsReport {
  const record = object(value, "costAnalytics");
  return {
    generatedAt: requiredString(record.generatedAt, "costAnalytics.generatedAt"),
    global: parseAnalyticsTotal(record.global, "costAnalytics.global"),
    sessions: array(record.sessions, "costAnalytics.sessions").map((item) => {
      const session = object(item, "costAnalytics.sessions");
      return {
        sessionId: requiredString(session.sessionId, "costAnalytics.sessions.sessionId"),
        ...parseAnalyticsTotal(session, "costAnalytics.sessions"),
      };
    }),
    dailyTrend: array(record.dailyTrend, "costAnalytics.dailyTrend").map((item) =>
      parseAnalyticsTrendBucket(item, "costAnalytics.dailyTrend")
    ),
    hourlyTrend: array(record.hourlyTrend, "costAnalytics.hourlyTrend").map((item) =>
      parseAnalyticsTrendBucket(item, "costAnalytics.hourlyTrend")
    ),
    anomalies: array(record.anomalies, "costAnalytics.anomalies").map(parseAnalyticsAnomaly),
  };
}

function parseUsageOverviewQuery(value: unknown): RemoteUsageOverviewQuery {
  const record = object(value, "usageOverviewQuery");
  const range = oneOf(record.range, ["today", "7d", "30d"], "usageOverviewQuery.range");
  if (record.timeZone === undefined) return { range };
  const timeZone = boundedString(record.timeZone, "usageOverviewQuery.timeZone", 100);
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
  } catch {
    throw new Error("usageOverviewQuery.timeZone: expected valid IANA time zone");
  }
  return { range, timeZone };
}

function parseUsageOverviewReport(value: unknown): RemoteUsageOverviewReport {
  const record = object(value, "usageOverview");
  const range = oneOf(record.range, ["today", "7d", "30d"], "usageOverview.range");
  const expectedBuckets = range === "today" ? 24 : range === "7d" ? 7 : 30;
  const trend = array(record.trend, "usageOverview.trend");
  const topModels = array(record.topModels, "usageOverview.topModels");
  if (trend.length !== expectedBuckets) {
    throw new Error(`usageOverview.trend: expected ${expectedBuckets} buckets`);
  }
  if (topModels.length > 10) throw new Error("usageOverview.topModels: expected at most 10 models");
  const timeZone = parseTimeZone(record.timeZone, "usageOverview.timeZone");
  return {
    range,
    timeZone,
    generatedAt: timestamp(record.generatedAt, "usageOverview.generatedAt"),
    startAt: timestamp(record.startAt, "usageOverview.startAt"),
    endAt: timestamp(record.endAt, "usageOverview.endAt"),
    totals: parseUsageOverviewTotal(record.totals, "usageOverview.totals"),
    trend: trend.map((item, index) => {
      const bucket = object(item, `usageOverview.trend[${index}]`);
      return {
        key: boundedString(bucket.key, `usageOverview.trend[${index}].key`, 32),
        startAt: timestamp(bucket.startAt, `usageOverview.trend[${index}].startAt`),
        endAt: timestamp(bucket.endAt, `usageOverview.trend[${index}].endAt`),
        ...parseUsageOverviewTotal(bucket, `usageOverview.trend[${index}]`),
        models: bucket.models === undefined
          ? []
          : parseUsageOverviewModels(bucket.models, `usageOverview.trend[${index}].models`),
      };
    }),
    topModels: topModels.map((item, index) => {
      const model = object(item, `usageOverview.topModels[${index}]`);
      return {
        provider: boundedString(model.provider, `usageOverview.topModels[${index}].provider`, 120),
        model: boundedString(model.model, `usageOverview.topModels[${index}].model`, 240),
        ...parseUsageOverviewTotal(model, `usageOverview.topModels[${index}]`),
      };
    }),
  };
}

function parseUsageOverviewModels(value: unknown, field: string): RemoteUsageOverviewReport["trend"][number]["models"] {
  return array(value, field).map((item, index) => {
    const model = object(item, `${field}[${index}]`);
    return {
      provider: boundedString(model.provider, `${field}[${index}].provider`, 120),
      model: boundedString(model.model, `${field}[${index}].model`, 240),
      ...parseUsageOverviewTotal(model, `${field}[${index}]`),
    };
  });
}

function parseUsageOverviewTotal(value: unknown, field: string): RemoteUsageOverviewReport["totals"] {
  const record = object(value, field);
  const requestCount = nonNegativeInteger(record.requestCount, `${field}.requestCount`);
  const pricedRequestCount = nonNegativeInteger(record.pricedRequestCount, `${field}.pricedRequestCount`);
  const unknownRequestCount = nonNegativeInteger(record.unknownRequestCount, `${field}.unknownRequestCount`);
  if (pricedRequestCount + unknownRequestCount !== requestCount) {
    throw new Error(`${field}: request coverage counts do not add up`);
  }
  return {
    amountMicroCny: nonNegativeInteger(record.amountMicroCny, `${field}.amountMicroCny`),
    totalTokens: nonNegativeInteger(record.totalTokens, `${field}.totalTokens`),
    requestCount,
    pricedRequestCount,
    unknownRequestCount,
    coverage: oneOf(record.coverage, ["complete", "partial", "unavailable"], `${field}.coverage`),
  };
}

function parseAnalyticsTotal(value: unknown, field: string): RemoteCostAnalyticsReport["global"] {
  const record = object(value, field);
  return {
    totalMicroCny: finiteNumber(record.totalMicroCny, `${field}.totalMicroCny`),
    requestCount: finiteNumber(record.requestCount, `${field}.requestCount`),
    statusCounts: parseAnalyticsStatusCounts(record.statusCounts, `${field}.statusCounts`),
    peakMicroCny: finiteNumber(record.peakMicroCny, `${field}.peakMicroCny`),
    offpeakMicroCny: finiteNumber(record.offpeakMicroCny, `${field}.offpeakMicroCny`),
  };
}

function parseAnalyticsTrendBucket(value: unknown, field: string): RemoteCostAnalyticsReport["dailyTrend"][number] {
  const record = object(value, field);
  return {
    key: requiredString(record.key, `${field}.key`),
    startAt: requiredString(record.startAt, `${field}.startAt`),
    endAt: requiredString(record.endAt, `${field}.endAt`),
    amountMicroCny: finiteNumber(record.amountMicroCny, `${field}.amountMicroCny`),
    requestCount: finiteNumber(record.requestCount, `${field}.requestCount`),
    statusCounts: parseAnalyticsStatusCounts(record.statusCounts, `${field}.statusCounts`),
    peakMicroCny: finiteNumber(record.peakMicroCny, `${field}.peakMicroCny`),
    offpeakMicroCny: finiteNumber(record.offpeakMicroCny, `${field}.offpeakMicroCny`),
    previousAmountMicroCny: nullableNumber(record.previousAmountMicroCny, `${field}.previousAmountMicroCny`),
    deltaMicroCny: nullableNumber(record.deltaMicroCny, `${field}.deltaMicroCny`),
    deltaRatio: nullableNumber(record.deltaRatio, `${field}.deltaRatio`),
  };
}

function parseAnalyticsStatusCounts(value: unknown, field: string): RemoteCostAnalyticsReport["global"]["statusCounts"] {
  const record = object(value, field);
  return {
    estimated: finiteNumber(record.estimated, `${field}.estimated`),
    settled: finiteNumber(record.settled, `${field}.settled`),
    unknown: finiteNumber(record.unknown, `${field}.unknown`),
    failed: finiteNumber(record.failed, `${field}.failed`),
  };
}

function parseAnalyticsAnomaly(value: unknown): RemoteCostAnalyticsReport["anomalies"][number] {
  const record = object(value, "costAnalytics.anomalies");
  return {
    ruleId: requiredString(record.ruleId, "costAnalytics.anomalies.ruleId"),
    severity: oneOf(record.severity, ["info", "warning"], "costAnalytics.anomalies.severity"),
    bucketKey: requiredString(record.bucketKey, "costAnalytics.anomalies.bucketKey"),
    ...(record.observedMicroCny === undefined ? {} : { observedMicroCny: finiteNumber(record.observedMicroCny, "costAnalytics.anomalies.observedMicroCny") }),
    ...(record.baselineMicroCny === undefined ? {} : { baselineMicroCny: finiteNumber(record.baselineMicroCny, "costAnalytics.anomalies.baselineMicroCny") }),
    ...(record.observedCount === undefined ? {} : { observedCount: finiteNumber(record.observedCount, "costAnalytics.anomalies.observedCount") }),
    ...(record.baselineCount === undefined ? {} : { baselineCount: finiteNumber(record.baselineCount, "costAnalytics.anomalies.baselineCount") }),
    ...(record.ratio === undefined ? {} : { ratio: finiteNumber(record.ratio, "costAnalytics.anomalies.ratio") }),
    threshold: finiteNumber(record.threshold, "costAnalytics.anomalies.threshold"),
    explanation: requiredString(record.explanation, "costAnalytics.anomalies.explanation"),
  };
}

function parseExchangeRate(value: unknown): RemoteExchangeRateSnapshot {
  const record = object(value, "exchangeRate");
  return {
    status: oneOf(record.status, ["idle", "loading", "fresh", "error"], "exchangeRate.status"),
    baseCurrency: oneOf(record.baseCurrency, ["USD"], "exchangeRate.baseCurrency"),
    quoteCurrency: oneOf(record.quoteCurrency, ["CNY"], "exchangeRate.quoteCurrency"),
    rate: nullableNumber(record.rate, "exchangeRate.rate"),
    fetchedAt: nullableString(record.fetchedAt, "exchangeRate.fetchedAt"),
    source: nullableString(record.source, "exchangeRate.source"),
    error: nullableString(record.error, "exchangeRate.error"),
  };
}

function parseConnection(value: unknown): MyMeterRemoteSnapshot["connection"] {
  const record = object(value, "connection");
  const status = oneOf(record.status, ["connected", "stale", "loading", "error"], "connection.status");
  return { status, message: nullableString(record.message, "connection.message") };
}

function parseSummary(value: unknown): MyMeterRemoteSnapshot["summary"] {
  const record = object(value, "summary");
  const status = object(record.status, "summary.status");
  const model = requiredString(record.model, "summary.model");
  return {
    status: { code: meterStatus(status.code, "summary.status.code") },
    provider: parseProvider(record.provider, model, "summary.provider"),
    model,
    reasoningEffort: requiredString(record.reasoningEffort, "summary.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "summary.agentPreset"),
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "summary.currentRequestMicroCny"),
    sessionTotalMicroCny: finiteNumber(record.sessionTotalMicroCny, "summary.sessionTotalMicroCny"),
    settledTotalMicroCny: finiteNumber(record.settledTotalMicroCny, "summary.settledTotalMicroCny"),
    estimatedTotalMicroCny: finiteNumber(record.estimatedTotalMicroCny, "summary.estimatedTotalMicroCny"),
    localTotalMicroCny: finiteNumber(record.localTotalMicroCny, "summary.localTotalMicroCny"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "summary.pricingZone"),
    ...(record.currencyTotals === undefined ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "summary.currencyTotals") }),
    ...(record.cnyEquivalentMicroCny === undefined ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "summary.cnyEquivalentMicroCny") }),
    ...(record.currency === undefined ? {} : { currency: nonEmptyString(record.currency, "summary.currency") }),
    ...(record.currentRequestMinor === undefined ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "summary.currentRequestMinor") }),
    ...(record.sessionTotalMinor === undefined ? {} : { sessionTotalMinor: finiteNumber(record.sessionTotalMinor, "summary.sessionTotalMinor") }),
  };
}

function parseCurrencyTotals(value: unknown, field: string): RemoteCurrencyTotal[] {
  return array(value, field).map((item) => {
    const record = object(item, field);
    return {
      currency: nonEmptyString(record.currency, `${field}.currency`),
      amountMinor: finiteNumber(record.amountMinor, `${field}.amountMinor`),
      settledMinor: finiteNumber(record.settledMinor, `${field}.settledMinor`),
      estimatedMinor: finiteNumber(record.estimatedMinor, `${field}.estimatedMinor`),
      failedMinor: finiteNumber(record.failedMinor, `${field}.failedMinor`),
    };
  });
}

function parseBalance(value: unknown): MyMeterRemoteSnapshot["balance"] {
  const record = object(value, "balance");
  return {
    status: oneOf(record.status, ["fresh", "stale", "expired", "insufficient", "unavailable"], "balance.status"),
    currency: record.currency === undefined ? "CNY" : nullableString(record.currency, "balance.currency"),
    totalMicroCny: nullableNumber(record.totalMicroCny, "balance.totalMicroCny"),
    grantedMicroCny: nullableNumber(record.grantedMicroCny, "balance.grantedMicroCny"),
    toppedUpMicroCny: nullableNumber(record.toppedUpMicroCny, "balance.toppedUpMicroCny"),
    refreshedAt: nullableString(record.refreshedAt, "balance.refreshedAt"),
  };
}

function parseProviderBalance(value: unknown): RemoteProviderBalanceSnapshot {
  const record = object(value, "providerBalance");
  const balance = parseBalance(record);
  return {
    provider: nonEmptyString(record.provider, "providerBalance.provider"),
    providerName: nonEmptyString(record.providerName, "providerBalance.providerName"),
    supported: boolean(record.supported, "providerBalance.supported"),
    ...balance,
  };
}

function legacyProviderBalances(
  provider: string,
  balance: MyMeterRemoteSnapshot["balance"],
): RemoteProviderBalanceSnapshot[] {
  const normalized = provider.trim().toLowerCase();
  const inferredProvider = normalized === "unknown" && balance.totalMicroCny !== null ? "deepseek" : provider;
  const inferredNormalized = inferredProvider.trim().toLowerCase();
  if (!inferredProvider.trim() || inferredNormalized === "unknown") return [];
  const supported = inferredNormalized === "deepseek" || inferredNormalized === "deepseek-official";
  return [{
    provider: inferredProvider,
    providerName: supported ? "DeepSeek" : inferredProvider,
    supported,
    ...(supported ? balance : unavailableBalance()),
  }];
}

function refreshSupportedBalances(
  balances: RemoteProviderBalanceSnapshot[],
  balance: MyMeterRemoteSnapshot["balance"],
): RemoteProviderBalanceSnapshot[] {
  const officialDeepSeek = balances.findIndex((providerBalance) =>
    providerBalance.supported && providerBalance.provider.trim().toLowerCase() === "deepseek-official"
  );
  const supported = balances
    .map((providerBalance, index) => providerBalance.supported ? index : -1)
    .filter((index) => index >= 0);
  const target = officialDeepSeek >= 0
    ? officialDeepSeek
    : supported.length === 1
      ? supported[0]!
      : -1;
  return balances.map((providerBalance, index) => index === target
    ? { ...providerBalance, ...balance }
    : providerBalance);
}

function unavailableBalance(): MyMeterRemoteSnapshot["balance"] {
  return {
    status: "unavailable",
    currency: null,
    totalMicroCny: null,
    grantedMicroCny: null,
    toppedUpMicroCny: null,
    refreshedAt: null,
  };
}

function parseSessionSummary(value: unknown): RemoteSessionSummary {
  const record = object(value, "session");
  const model = requiredString(record.model, "session.model");
  return {
    id: requiredString(record.id, "session.id"),
    title: requiredString(record.title, "session.title"),
    provider: parseProvider(record.provider, model, "session.provider"),
    model,
    reasoningEffort: requiredString(record.reasoningEffort, "session.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "session.agentPreset"),
    status: meterStatus(record.status, "session.status"),
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "session.currentRequestMicroCny"),
    sessionTotalMicroCny: finiteNumber(record.sessionTotalMicroCny, "session.sessionTotalMicroCny"),
    unknownCount: finiteNumber(record.unknownCount, "session.unknownCount"),
    lastActivityAt: requiredString(record.lastActivityAt, "session.lastActivityAt"),
    ...(record.currencyTotals === undefined ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "session.currencyTotals") }),
    ...(record.currency === undefined ? {} : { currency: nonEmptyString(record.currency, "session.currency") }),
    ...(record.currentRequestMinor === undefined ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "session.currentRequestMinor") }),
    ...(record.sessionTotalMinor === undefined ? {} : { sessionTotalMinor: finiteNumber(record.sessionTotalMinor, "session.sessionTotalMinor") }),
    ...(record.cnyEquivalentMicroCny === undefined ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "session.cnyEquivalentMicroCny") }),
  };
}

function parseSessionDetail(value: unknown): RemoteSessionDetail {
  const record = object(value, "detail");
  const model = requiredString(record.model, "detail.model");
  return {
    id: requiredString(record.id, "detail.id"),
    title: requiredString(record.title, "detail.title"),
    provider: parseProvider(record.provider, model, "detail.provider"),
    model,
    reasoningEffort: requiredString(record.reasoningEffort, "detail.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "detail.agentPreset"),
    status: meterStatus(record.status, "detail.status"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "detail.pricingZone"),
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "detail.currentRequestMicroCny"),
    sessionTotalMicroCny: finiteNumber(record.sessionTotalMicroCny, "detail.sessionTotalMicroCny"),
    settledTotalMicroCny: finiteNumber(record.settledTotalMicroCny, "detail.settledTotalMicroCny"),
    estimatedTotalMicroCny: finiteNumber(record.estimatedTotalMicroCny, "detail.estimatedTotalMicroCny"),
    unknownCount: finiteNumber(record.unknownCount, "detail.unknownCount"),
    tokenBuckets: array(record.tokenBuckets, "detail.tokenBuckets").map(parseTokenBucket),
    contextBreakdown: parseContextBreakdown(record.contextBreakdown),
    turns: array(record.turns, "detail.turns").map(parseTurn),
    stages: array(record.stages, "detail.stages").map(parseStage),
    ...(record.currencyTotals === undefined ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "detail.currencyTotals") }),
    ...(record.cnyEquivalentMicroCny === undefined ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "detail.cnyEquivalentMicroCny") }),
  };
}

function parseStage(value: unknown): RemoteSessionStage {
  const record = object(value, "stage");
  return {
    id: requiredString(record.id, "stage.id"),
    index: positiveInteger(record.index, "stage.index"),
    isCurrent: boolean(record.isCurrent, "stage.isCurrent"),
    startedAt: requiredString(record.startedAt, "stage.startedAt"),
    completedAt: nullableString(record.completedAt, "stage.completedAt"),
    lastActivityAt: requiredString(record.lastActivityAt, "stage.lastActivityAt"),
    status: meterStatus(record.status, "stage.status"),
    model: requiredString(record.model, "stage.model"),
    reasoningEffort: requiredString(record.reasoningEffort, "stage.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "stage.agentPreset"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "stage.pricingZone"),
    priceVersion: requiredString(record.priceVersion, "stage.priceVersion"),
    ...(record.exchangeRateLabel === undefined
      ? {}
      : { exchangeRateLabel: nullableString(record.exchangeRateLabel, "stage.exchangeRateLabel") }),
    ...(record.currency === undefined ? {} : { currency: nonEmptyString(record.currency, "stage.currency") }),
    ...(record.currentRequestMinor === undefined ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "stage.currentRequestMinor") }),
    ...(record.totalMinor === undefined ? {} : { totalMinor: finiteNumber(record.totalMinor, "stage.totalMinor") }),
    ...(record.settledTotalMinor === undefined ? {} : { settledTotalMinor: finiteNumber(record.settledTotalMinor, "stage.settledTotalMinor") }),
    ...(record.estimatedTotalMinor === undefined ? {} : { estimatedTotalMinor: finiteNumber(record.estimatedTotalMinor, "stage.estimatedTotalMinor") }),
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "stage.currentRequestMicroCny"),
    totalMicroCny: finiteNumber(record.totalMicroCny, "stage.totalMicroCny"),
    settledTotalMicroCny: finiteNumber(record.settledTotalMicroCny, "stage.settledTotalMicroCny"),
    estimatedTotalMicroCny: finiteNumber(record.estimatedTotalMicroCny, "stage.estimatedTotalMicroCny"),
    unknownCount: finiteNumber(record.unknownCount, "stage.unknownCount"),
    tokenBuckets: array(record.tokenBuckets, "stage.tokenBuckets").map(parseTokenBucket),
    turns: array(record.turns, "stage.turns").map(parseTurn),
    contextBreakdown: parseContextBreakdown(record.contextBreakdown, "stage.contextBreakdown"),
  };
}

function parseContextBreakdown(
  value: unknown,
  field = "detail.contextBreakdown",
): RemoteSessionDetail["contextBreakdown"] {
  if (value === undefined || value === null) return null;
  const record = object(value, field);
  return {
    systemTokens: nonNegativeNumber(record.systemTokens, `${field}.systemTokens`),
    toolsTokens: nonNegativeNumber(record.toolsTokens, `${field}.toolsTokens`),
    messageTokens: nonNegativeNumber(record.messageTokens, `${field}.messageTokens`),
  };
}

function parseTokenBucket(value: unknown): RemoteSessionDetail["tokenBuckets"][number] {
  const record = object(value, "tokenBucket");
  const unitPrice = record.unitPriceMicroCnyPerMillionTokens;
  const unitPriceMixed = record.unitPriceMixed;
  return {
    label: requiredString(record.label, "tokenBucket.label"),
    tokens: finiteNumber(record.tokens, "tokenBucket.tokens"),
    amountMicroCny: finiteNumber(record.amountMicroCny, "tokenBucket.amountMicroCny"),
    ...(unitPrice === undefined
      ? {}
      : {
        unitPriceMicroCnyPerMillionTokens: nullableNumber(
          unitPrice,
          "tokenBucket.unitPriceMicroCnyPerMillionTokens",
        ),
      }),
    ...(unitPriceMixed === undefined
      ? {}
      : { unitPriceMixed: boolean(unitPriceMixed, "tokenBucket.unitPriceMixed") }),
    ...(record.currency === undefined ? {} : { currency: nonEmptyString(record.currency, "tokenBucket.currency") }),
    ...(record.amountMinor === undefined ? {} : { amountMinor: finiteNumber(record.amountMinor, "tokenBucket.amountMinor") }),
    ...(record.unitPriceMinorPerMillionTokens === undefined ? {} : { unitPriceMinorPerMillionTokens: nullableNumber(record.unitPriceMinorPerMillionTokens, "tokenBucket.unitPriceMinorPerMillionTokens") }),
  };
}

function parseTurn(value: unknown): RemoteSessionDetail["turns"][number] {
  const record = object(value, "turn");
  return {
    id: requiredString(record.id, "turn.id"),
    label: requiredString(record.label, "turn.label"),
    startedAt: requiredString(record.startedAt, "turn.startedAt"),
    completedAt: nullableString(record.completedAt, "turn.completedAt"),
    status: meterStatus(record.status, "turn.status"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "turn.pricingZone"),
    cacheHitTokens: finiteNumber(record.cacheHitTokens, "turn.cacheHitTokens"),
    cacheMissTokens: finiteNumber(record.cacheMissTokens, "turn.cacheMissTokens"),
    outputTokens: finiteNumber(record.outputTokens, "turn.outputTokens"),
    reasoningTokens: finiteNumber(record.reasoningTokens, "turn.reasoningTokens"),
    amountMicroCny: finiteNumber(record.amountMicroCny, "turn.amountMicroCny"),
    note: nullableString(record.note, "turn.note"),
    ...(record.currency === undefined ? {} : { currency: nonEmptyString(record.currency, "turn.currency") }),
    ...(record.amountMinor === undefined ? {} : { amountMinor: finiteNumber(record.amountMinor, "turn.amountMinor") }),
  };
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${field}: expected object`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field}: expected array`);
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field}: expected string`);
  return value;
}

function nonEmptyString(value: unknown, field: string): string {
  const parsed = requiredString(value, field);
  if (!parsed.trim()) throw new Error(`${field}: expected non-empty string`);
  return parsed;
}

function boundedString(value: unknown, field: string, maximumLength: number): string {
  const parsed = nonEmptyString(value, field);
  if (parsed.length > maximumLength) throw new Error(`${field}: string is too long`);
  return parsed;
}

function parseTimeZone(value: unknown, field: string): string {
  const timeZone = boundedString(value, field, 100);
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
  } catch {
    throw new Error(`${field}: expected valid IANA time zone`);
  }
  return timeZone;
}

function timestamp(value: unknown, field: string): string {
  const parsed = boundedString(value, field, 64);
  if (!Number.isFinite(Date.parse(parsed))) throw new Error(`${field}: expected timestamp`);
  return parsed;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field);
}

function parseProvider(value: unknown, model: string, field: string): string {
  if (value === undefined) {
    return model.trim().toLowerCase().startsWith("deepseek-") ? "deepseek" : "unknown";
  }
  return requiredString(value, field);
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${field}: expected boolean`);
  return value;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field}: expected finite number`);
  return value;
}

function nonNegativeNumber(value: unknown, field: string): number {
  const number = finiteNumber(value, field);
  if (number < 0) throw new Error(`${field}: expected non-negative number`);
  return number;
}

function positiveInteger(value: unknown, field: string): number {
  const number = finiteNumber(value, field);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${field}: expected positive integer`);
  return number;
}

function nonNegativeInteger(value: unknown, field: string): number {
  const number = nonNegativeNumber(value, field);
  if (!Number.isSafeInteger(number)) throw new Error(`${field}: expected safe integer`);
  return number;
}

function nullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  return finiteNumber(value, field);
}

function meterStatus(value: unknown, field: string): MyMeterRemoteSnapshot["summary"]["status"]["code"] {
  return oneOf(
    value,
    ["idle", "billing", "settled", "unknown", "balance_expired", "balance_insufficient", "failed", "aborted"],
    field,
  );
}

function oneOf<const Values extends readonly string[]>(value: unknown, values: Values, field: string): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`${field}: expected one of ${values.join(", ")}`);
  }
  return value;
}
