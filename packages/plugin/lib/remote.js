// packages/plugin/src/typert-remote.ts
var MYMETER_SERVICE_KEY = "mymeter";
var MYMETER_PACKAGE_NAME = "@mymeter/dsh-cost-meter";
var stringSchema = schema("string", (value) => {
  if (typeof value !== "string") throw new Error("expected string");
  return value;
});
var ledgerExportFormatSchema = schema(
  "LedgerExportFormat",
  (value) => oneOf(value, ["json", "csv"], "ledgerExportFormat")
);
var sessionIdSchema = schema("SessionId", (value) => {
  if (typeof value !== "string" || value.length === 0) throw new Error("expected non-empty session id");
  return value;
});
var snapshotSchema = schema("MyMeterRemoteSnapshot", parseSnapshot);
var sessionsSchema = schema("RemoteSessionSummaryArray", (value) => {
  if (!Array.isArray(value)) throw new Error("expected session array");
  return value.map(parseSessionSummary);
});
var sessionDetailOrNullSchema = schema("RemoteSessionDetailOrNull", (value) => {
  if (value === null) return null;
  return parseSessionDetail(value);
});
var balanceSchema = schema("RemoteBalanceSnapshot", parseBalance);
var settingsSchema = schema("RemoteSettings", (value) => {
  if (!isRecord(value)) throw new Error("expected settings object");
  return value;
});
var exchangeRateSchema = schema("RemoteExchangeRateSnapshot", parseExchangeRate);
var sessionCostTreeSchema = schema("RemoteSessionCostTree", parseSessionCostTree);
var costAnalyticsSchema = schema("RemoteCostAnalyticsReport", parseCostAnalyticsReport);
var usageOverviewQuerySchema = schema("RemoteUsageOverviewQuery", parseUsageOverviewQuery);
var usageOverviewSchema = schema("RemoteUsageOverviewReport", parseUsageOverviewReport);
var getSnapshotDescriptor = descriptor("getSnapshot", [], snapshotSchema);
var listSessionsDescriptor = descriptor("listSessions", [], sessionsSchema);
var getSessionDetailDescriptor = descriptor(
  "getSessionDetail",
  [{ name: "sessionId", wire: "sessionId", source: "json", codec: codec("SessionId", sessionIdSchema) }],
  sessionDetailOrNullSchema
);
var getBalanceDescriptor = descriptor("getBalance", [], balanceSchema);
var refreshBalanceDescriptor = descriptor("refreshBalance", [], balanceSchema);
var getSettingsDescriptor = descriptor("getSettings", [], settingsSchema);
var refreshExchangeRateDescriptor = descriptor("refreshExchangeRate", [], exchangeRateSchema);
var getSessionCostTreeDescriptor = descriptor("getSessionCostTree", [], sessionCostTreeSchema);
var getCostAnalyticsDescriptor = descriptor("getCostAnalytics", [], costAnalyticsSchema);
var getUsageOverviewDescriptor = descriptor(
  "getUsageOverview",
  [{ name: "query", wire: "query", source: "json", codec: codec("RemoteUsageOverviewQuery", usageOverviewQuerySchema) }],
  usageOverviewSchema
);
var exportLedgerDescriptor = descriptor(
  "exportLedger",
  [{ name: "format", wire: "format", source: "json", codec: codec("LedgerExportFormat", ledgerExportFormatSchema) }],
  stringSchema
);
var MYMETER_REMOTE_DESCRIPTORS = [
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
  exportLedgerDescriptor
];
var MYMETER_REMOTE_CONTRIBUTION = Object.freeze({
  package: MYMETER_PACKAGE_NAME,
  descriptors: MYMETER_REMOTE_DESCRIPTORS
});
var MYMETER_LOCAL_TYPERT_CONTRIBUTION = Object.freeze({
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
    { name: "LedgerExportFormat", schema: ledgerExportFormatSchema }
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
        signature: `${entry.method}(...): Promise<unknown>`
      })),
      types: []
    }],
    events: [],
    objects: []
  },
  invocations: MYMETER_REMOTE_DESCRIPTORS
});
function bindMyMeterTypertRemote(service) {
  return Object.assign(service, {
    typertRemote: Object.freeze({
      service,
      serviceKey: MYMETER_SERVICE_KEY,
      namespace: MYMETER_SERVICE_KEY
    })
  });
}
async function createMyMeterRemoteFromTypert(namespace, options = {}) {
  const listeners = /* @__PURE__ */ new Set();
  let snapshot = await readSnapshot(namespace, false);
  let disposed = false;
  let refreshing = false;
  let refreshingBalance = false;
  let initialBalanceRequested = false;
  const pollIntervalMs = options.pollIntervalMs ?? 200;
  const balancePollIntervalMs = options.balancePollIntervalMs ?? 5 * 6e4;
  async function refresh() {
    if (disposed || refreshing) return;
    refreshing = true;
    try {
      snapshot = await readSnapshot(namespace, false);
    } catch (error) {
      snapshot = {
        ...snapshot,
        connection: {
          status: "stale",
          message: error instanceof Error ? error.message.replace(/^mymeter: getSnapshot failed: /, "") : "Remote \u8FDE\u63A5\u5931\u8D25"
        }
      };
    } finally {
      refreshing = false;
    }
    if (disposed) return;
    for (const listener of listeners) listener(snapshot);
    if (!initialBalanceRequested) {
      initialBalanceRequested = true;
      void updateBalance().then((balance) => {
        if (!balance || disposed) return;
        for (const listener of listeners) listener(snapshot);
      });
    }
  }
  async function updateBalance(force = false) {
    if (disposed || refreshingBalance) return null;
    refreshingBalance = true;
    try {
      const result = force && namespace.refreshBalance ? await namespace.refreshBalance() : await namespace.getBalance();
      if (!result.ok || disposed) return null;
      const balance = balanceSchema.parse(result.value);
      snapshot = {
        ...snapshot,
        balance,
        balances: refreshSupportedBalances(snapshot.balances, balance)
      };
      return balance;
    } catch {
      return null;
    } finally {
      refreshingBalance = false;
    }
  }
  const interval = pollIntervalMs > 0 ? setInterval(() => {
    void refresh();
  }, pollIntervalMs) : null;
  if (interval?.unref) interval.unref();
  const balanceInterval = balancePollIntervalMs > 0 ? setInterval(() => {
    void updateBalance().then((balance) => {
      if (!balance || disposed) return;
      for (const listener of listeners) listener(snapshot);
    });
  }, balancePollIntervalMs) : null;
  if (balanceInterval?.unref) balanceInterval.unref();
  const handleVisibilityChange = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      void updateBalance().then((balance) => {
        if (!balance || disposed) return;
        for (const listener of listeners) listener(snapshot);
      });
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (interval) clearInterval(interval);
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
      if (disposed) return () => {
      };
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
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
    dispose
  };
}
async function readSnapshot(namespace, includeBalance = true) {
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
    balances: refreshSupportedBalances(snapshot.balances, balanceSchema.parse(balanceResult.value))
  };
}
function descriptor(method, parameters, resultSchema) {
  return Object.freeze({
    id: `${MYMETER_PACKAGE_NAME}#${MYMETER_SERVICE_KEY}/${method}`,
    service: MYMETER_SERVICE_KEY,
    namespace: MYMETER_SERVICE_KEY,
    method,
    invocation: { kind: "direct" },
    parameters,
    result: codec(resultSchemaName(resultSchema), resultSchema)
  });
}
function codec(typeName, valueSchema) {
  return { mode: "strict", typeSymbol: `${MYMETER_PACKAGE_NAME}#${typeName}`, schema: valueSchema };
}
function schema(name, parse) {
  return Object.freeze({ typeName: name, parse });
}
function resultSchemaName(valueSchema) {
  return "typeName" in valueSchema && typeof valueSchema.typeName === "string" ? valueSchema.typeName : "Unknown";
}
function parseSnapshot(value) {
  const record = object(value, "snapshot");
  const sessions = array(record.sessions, "sessions").map(parseSessionSummary);
  const rawDetails = object(record.details, "details");
  const details = {};
  for (const [key, detail] of Object.entries(rawDetails)) details[key] = parseSessionDetail(detail);
  const summary = parseSummary(record.summary);
  const balance = parseBalance(record.balance);
  const balances = record.balances === void 0 ? legacyProviderBalances(summary.provider, balance) : array(record.balances, "balances").map(parseProviderBalance);
  return {
    connection: parseConnection(record.connection),
    currentSessionId: nullableString(record.currentSessionId, "currentSessionId"),
    summary,
    balance,
    balances,
    sessions,
    details,
    ...record.exchangeRate === void 0 ? {} : { exchangeRate: parseExchangeRate(record.exchangeRate) },
    ...record.ledgerGeneration === void 0 ? {} : { ledgerGeneration: nonNegativeInteger(record.ledgerGeneration, "ledgerGeneration") }
  };
}
function parseSessionCostTree(value) {
  const record = object(value, "sessionCostTree");
  const rawNodes = object(record.nodes, "sessionCostTree.nodes");
  const nodes = {};
  for (const [key, node] of Object.entries(rawNodes)) {
    nodes[key] = parseSessionCostTreeNode(node, `sessionCostTree.nodes.${key}`);
  }
  const anomalies = object(record.anomalies, "sessionCostTree.anomalies");
  return {
    roots: array(record.roots, "sessionCostTree.roots").map(
      (node) => parseSessionCostTreeNode(node, "sessionCostTree.roots")
    ),
    nodes,
    summary: parseLedgerSummary(record.summary, "sessionCostTree.summary"),
    anomalies: {
      missingParents: array(anomalies.missingParents, "sessionCostTree.anomalies.missingParents").map((item) => {
        const missing = object(item, "sessionCostTree.anomalies.missingParents");
        return {
          sessionId: requiredString(missing.sessionId, "missingParent.sessionId"),
          parentSessionId: requiredString(missing.parentSessionId, "missingParent.parentSessionId")
        };
      }),
      cycles: array(anomalies.cycles, "sessionCostTree.anomalies.cycles").map(
        (cycle) => array(cycle, "sessionCostTree.anomalies.cycles[]").map(
          (sessionId) => requiredString(sessionId, "cycle.sessionId")
        )
      )
    }
  };
}
function parseSessionCostTreeNode(value, field) {
  const record = object(value, field);
  return {
    id: requiredString(record.id, `${field}.id`),
    title: requiredString(record.title, `${field}.title`),
    ...record.parentSessionId === void 0 ? {} : { parentSessionId: requiredString(record.parentSessionId, `${field}.parentSessionId`) },
    childSessionIds: array(record.childSessionIds, `${field}.childSessionIds`).map(
      (item) => requiredString(item, `${field}.childSessionIds[]`)
    ),
    depth: nonNegativeNumber(record.depth, `${field}.depth`),
    path: array(record.path, `${field}.path`).map((item) => requiredString(item, `${field}.path[]`)),
    summary: parseLedgerSummary(record.summary, `${field}.summary`),
    subtreeSummary: parseLedgerSummary(record.subtreeSummary, `${field}.subtreeSummary`),
    ...record.detail === void 0 ? {} : { detail: parseSessionDetail(record.detail) },
    orphaned: boolean(record.orphaned, `${field}.orphaned`),
    cyclic: boolean(record.cyclic, `${field}.cyclic`)
  };
}
function parseLedgerSummary(value, field) {
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
    agentPreset: requiredString(record.agentPreset, `${field}.agentPreset`)
  };
}
function parseCostAnalyticsReport(value) {
  const record = object(value, "costAnalytics");
  return {
    generatedAt: requiredString(record.generatedAt, "costAnalytics.generatedAt"),
    global: parseAnalyticsTotal(record.global, "costAnalytics.global"),
    sessions: array(record.sessions, "costAnalytics.sessions").map((item) => {
      const session = object(item, "costAnalytics.sessions");
      return {
        sessionId: requiredString(session.sessionId, "costAnalytics.sessions.sessionId"),
        ...parseAnalyticsTotal(session, "costAnalytics.sessions")
      };
    }),
    dailyTrend: array(record.dailyTrend, "costAnalytics.dailyTrend").map(
      (item) => parseAnalyticsTrendBucket(item, "costAnalytics.dailyTrend")
    ),
    hourlyTrend: array(record.hourlyTrend, "costAnalytics.hourlyTrend").map(
      (item) => parseAnalyticsTrendBucket(item, "costAnalytics.hourlyTrend")
    ),
    anomalies: array(record.anomalies, "costAnalytics.anomalies").map(parseAnalyticsAnomaly)
  };
}
function parseUsageOverviewQuery(value) {
  const record = object(value, "usageOverviewQuery");
  const range = oneOf(record.range, ["today", "7d", "30d"], "usageOverviewQuery.range");
  if (record.timeZone === void 0) return { range };
  const timeZone = boundedString(record.timeZone, "usageOverviewQuery.timeZone", 100);
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
  } catch {
    throw new Error("usageOverviewQuery.timeZone: expected valid IANA time zone");
  }
  return { range, timeZone };
}
function parseUsageOverviewReport(value) {
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
        ...parseUsageOverviewTotal(bucket, `usageOverview.trend[${index}]`)
      };
    }),
    topModels: topModels.map((item, index) => {
      const model = object(item, `usageOverview.topModels[${index}]`);
      return {
        provider: boundedString(model.provider, `usageOverview.topModels[${index}].provider`, 120),
        model: boundedString(model.model, `usageOverview.topModels[${index}].model`, 240),
        ...parseUsageOverviewTotal(model, `usageOverview.topModels[${index}]`)
      };
    })
  };
}
function parseUsageOverviewTotal(value, field) {
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
    coverage: oneOf(record.coverage, ["complete", "partial", "unavailable"], `${field}.coverage`)
  };
}
function parseAnalyticsTotal(value, field) {
  const record = object(value, field);
  return {
    totalMicroCny: finiteNumber(record.totalMicroCny, `${field}.totalMicroCny`),
    requestCount: finiteNumber(record.requestCount, `${field}.requestCount`),
    statusCounts: parseAnalyticsStatusCounts(record.statusCounts, `${field}.statusCounts`),
    peakMicroCny: finiteNumber(record.peakMicroCny, `${field}.peakMicroCny`),
    offpeakMicroCny: finiteNumber(record.offpeakMicroCny, `${field}.offpeakMicroCny`)
  };
}
function parseAnalyticsTrendBucket(value, field) {
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
    deltaRatio: nullableNumber(record.deltaRatio, `${field}.deltaRatio`)
  };
}
function parseAnalyticsStatusCounts(value, field) {
  const record = object(value, field);
  return {
    estimated: finiteNumber(record.estimated, `${field}.estimated`),
    settled: finiteNumber(record.settled, `${field}.settled`),
    unknown: finiteNumber(record.unknown, `${field}.unknown`),
    failed: finiteNumber(record.failed, `${field}.failed`)
  };
}
function parseAnalyticsAnomaly(value) {
  const record = object(value, "costAnalytics.anomalies");
  return {
    ruleId: requiredString(record.ruleId, "costAnalytics.anomalies.ruleId"),
    severity: oneOf(record.severity, ["info", "warning"], "costAnalytics.anomalies.severity"),
    bucketKey: requiredString(record.bucketKey, "costAnalytics.anomalies.bucketKey"),
    ...record.observedMicroCny === void 0 ? {} : { observedMicroCny: finiteNumber(record.observedMicroCny, "costAnalytics.anomalies.observedMicroCny") },
    ...record.baselineMicroCny === void 0 ? {} : { baselineMicroCny: finiteNumber(record.baselineMicroCny, "costAnalytics.anomalies.baselineMicroCny") },
    ...record.observedCount === void 0 ? {} : { observedCount: finiteNumber(record.observedCount, "costAnalytics.anomalies.observedCount") },
    ...record.baselineCount === void 0 ? {} : { baselineCount: finiteNumber(record.baselineCount, "costAnalytics.anomalies.baselineCount") },
    ...record.ratio === void 0 ? {} : { ratio: finiteNumber(record.ratio, "costAnalytics.anomalies.ratio") },
    threshold: finiteNumber(record.threshold, "costAnalytics.anomalies.threshold"),
    explanation: requiredString(record.explanation, "costAnalytics.anomalies.explanation")
  };
}
function parseExchangeRate(value) {
  const record = object(value, "exchangeRate");
  return {
    status: oneOf(record.status, ["idle", "loading", "fresh", "error"], "exchangeRate.status"),
    baseCurrency: oneOf(record.baseCurrency, ["USD"], "exchangeRate.baseCurrency"),
    quoteCurrency: oneOf(record.quoteCurrency, ["CNY"], "exchangeRate.quoteCurrency"),
    rate: nullableNumber(record.rate, "exchangeRate.rate"),
    fetchedAt: nullableString(record.fetchedAt, "exchangeRate.fetchedAt"),
    source: nullableString(record.source, "exchangeRate.source"),
    error: nullableString(record.error, "exchangeRate.error")
  };
}
function parseConnection(value) {
  const record = object(value, "connection");
  const status = oneOf(record.status, ["connected", "stale", "loading", "error"], "connection.status");
  return { status, message: nullableString(record.message, "connection.message") };
}
function parseSummary(value) {
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
    ...record.currencyTotals === void 0 ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "summary.currencyTotals") },
    ...record.cnyEquivalentMicroCny === void 0 ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "summary.cnyEquivalentMicroCny") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "summary.currency") },
    ...record.currentRequestMinor === void 0 ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "summary.currentRequestMinor") },
    ...record.sessionTotalMinor === void 0 ? {} : { sessionTotalMinor: finiteNumber(record.sessionTotalMinor, "summary.sessionTotalMinor") }
  };
}
function parseCurrencyTotals(value, field) {
  return array(value, field).map((item) => {
    const record = object(item, field);
    return {
      currency: nonEmptyString(record.currency, `${field}.currency`),
      amountMinor: finiteNumber(record.amountMinor, `${field}.amountMinor`),
      settledMinor: finiteNumber(record.settledMinor, `${field}.settledMinor`),
      estimatedMinor: finiteNumber(record.estimatedMinor, `${field}.estimatedMinor`),
      failedMinor: finiteNumber(record.failedMinor, `${field}.failedMinor`)
    };
  });
}
function parseBalance(value) {
  const record = object(value, "balance");
  return {
    status: oneOf(record.status, ["fresh", "stale", "expired", "insufficient", "unavailable"], "balance.status"),
    currency: record.currency === void 0 ? "CNY" : nullableString(record.currency, "balance.currency"),
    totalMicroCny: nullableNumber(record.totalMicroCny, "balance.totalMicroCny"),
    grantedMicroCny: nullableNumber(record.grantedMicroCny, "balance.grantedMicroCny"),
    toppedUpMicroCny: nullableNumber(record.toppedUpMicroCny, "balance.toppedUpMicroCny"),
    refreshedAt: nullableString(record.refreshedAt, "balance.refreshedAt")
  };
}
function parseProviderBalance(value) {
  const record = object(value, "providerBalance");
  const balance = parseBalance(record);
  return {
    provider: nonEmptyString(record.provider, "providerBalance.provider"),
    providerName: nonEmptyString(record.providerName, "providerBalance.providerName"),
    supported: boolean(record.supported, "providerBalance.supported"),
    ...balance
  };
}
function legacyProviderBalances(provider, balance) {
  const normalized = provider.trim().toLowerCase();
  const inferredProvider = normalized === "unknown" && balance.totalMicroCny !== null ? "deepseek" : provider;
  const inferredNormalized = inferredProvider.trim().toLowerCase();
  if (!inferredProvider.trim() || inferredNormalized === "unknown") return [];
  const supported = inferredNormalized === "deepseek" || inferredNormalized === "deepseek-official";
  return [{
    provider: inferredProvider,
    providerName: supported ? "DeepSeek" : inferredProvider,
    supported,
    ...supported ? balance : unavailableBalance()
  }];
}
function refreshSupportedBalances(balances, balance) {
  const officialDeepSeek = balances.findIndex(
    (providerBalance) => providerBalance.supported && providerBalance.provider.trim().toLowerCase() === "deepseek-official"
  );
  const supported = balances.map((providerBalance, index) => providerBalance.supported ? index : -1).filter((index) => index >= 0);
  const target = officialDeepSeek >= 0 ? officialDeepSeek : supported.length === 1 ? supported[0] : -1;
  return balances.map((providerBalance, index) => index === target ? { ...providerBalance, ...balance } : providerBalance);
}
function unavailableBalance() {
  return {
    status: "unavailable",
    currency: null,
    totalMicroCny: null,
    grantedMicroCny: null,
    toppedUpMicroCny: null,
    refreshedAt: null
  };
}
function parseSessionSummary(value) {
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
    ...record.currencyTotals === void 0 ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "session.currencyTotals") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "session.currency") },
    ...record.currentRequestMinor === void 0 ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "session.currentRequestMinor") },
    ...record.sessionTotalMinor === void 0 ? {} : { sessionTotalMinor: finiteNumber(record.sessionTotalMinor, "session.sessionTotalMinor") },
    ...record.cnyEquivalentMicroCny === void 0 ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "session.cnyEquivalentMicroCny") }
  };
}
function parseSessionDetail(value) {
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
    ...record.currencyTotals === void 0 ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "detail.currencyTotals") },
    ...record.cnyEquivalentMicroCny === void 0 ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "detail.cnyEquivalentMicroCny") }
  };
}
function parseStage(value) {
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
    ...record.exchangeRateLabel === void 0 ? {} : { exchangeRateLabel: nullableString(record.exchangeRateLabel, "stage.exchangeRateLabel") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "stage.currency") },
    ...record.currentRequestMinor === void 0 ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "stage.currentRequestMinor") },
    ...record.totalMinor === void 0 ? {} : { totalMinor: finiteNumber(record.totalMinor, "stage.totalMinor") },
    ...record.settledTotalMinor === void 0 ? {} : { settledTotalMinor: finiteNumber(record.settledTotalMinor, "stage.settledTotalMinor") },
    ...record.estimatedTotalMinor === void 0 ? {} : { estimatedTotalMinor: finiteNumber(record.estimatedTotalMinor, "stage.estimatedTotalMinor") },
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "stage.currentRequestMicroCny"),
    totalMicroCny: finiteNumber(record.totalMicroCny, "stage.totalMicroCny"),
    settledTotalMicroCny: finiteNumber(record.settledTotalMicroCny, "stage.settledTotalMicroCny"),
    estimatedTotalMicroCny: finiteNumber(record.estimatedTotalMicroCny, "stage.estimatedTotalMicroCny"),
    unknownCount: finiteNumber(record.unknownCount, "stage.unknownCount"),
    tokenBuckets: array(record.tokenBuckets, "stage.tokenBuckets").map(parseTokenBucket),
    turns: array(record.turns, "stage.turns").map(parseTurn),
    contextBreakdown: parseContextBreakdown(record.contextBreakdown, "stage.contextBreakdown")
  };
}
function parseContextBreakdown(value, field = "detail.contextBreakdown") {
  if (value === void 0 || value === null) return null;
  const record = object(value, field);
  return {
    systemTokens: nonNegativeNumber(record.systemTokens, `${field}.systemTokens`),
    toolsTokens: nonNegativeNumber(record.toolsTokens, `${field}.toolsTokens`),
    messageTokens: nonNegativeNumber(record.messageTokens, `${field}.messageTokens`)
  };
}
function parseTokenBucket(value) {
  const record = object(value, "tokenBucket");
  const unitPrice = record.unitPriceMicroCnyPerMillionTokens;
  const unitPriceMixed = record.unitPriceMixed;
  return {
    label: requiredString(record.label, "tokenBucket.label"),
    tokens: finiteNumber(record.tokens, "tokenBucket.tokens"),
    amountMicroCny: finiteNumber(record.amountMicroCny, "tokenBucket.amountMicroCny"),
    ...unitPrice === void 0 ? {} : {
      unitPriceMicroCnyPerMillionTokens: nullableNumber(
        unitPrice,
        "tokenBucket.unitPriceMicroCnyPerMillionTokens"
      )
    },
    ...unitPriceMixed === void 0 ? {} : { unitPriceMixed: boolean(unitPriceMixed, "tokenBucket.unitPriceMixed") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "tokenBucket.currency") },
    ...record.amountMinor === void 0 ? {} : { amountMinor: finiteNumber(record.amountMinor, "tokenBucket.amountMinor") },
    ...record.unitPriceMinorPerMillionTokens === void 0 ? {} : { unitPriceMinorPerMillionTokens: nullableNumber(record.unitPriceMinorPerMillionTokens, "tokenBucket.unitPriceMinorPerMillionTokens") }
  };
}
function parseTurn(value) {
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
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "turn.currency") },
    ...record.amountMinor === void 0 ? {} : { amountMinor: finiteNumber(record.amountMinor, "turn.amountMinor") }
  };
}
function object(value, field) {
  if (!isRecord(value)) throw new Error(`${field}: expected object`);
  return value;
}
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function array(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field}: expected array`);
  return value;
}
function requiredString(value, field) {
  if (typeof value !== "string") throw new Error(`${field}: expected string`);
  return value;
}
function nonEmptyString(value, field) {
  const parsed = requiredString(value, field);
  if (!parsed.trim()) throw new Error(`${field}: expected non-empty string`);
  return parsed;
}
function boundedString(value, field, maximumLength) {
  const parsed = nonEmptyString(value, field);
  if (parsed.length > maximumLength) throw new Error(`${field}: string is too long`);
  return parsed;
}
function parseTimeZone(value, field) {
  const timeZone = boundedString(value, field, 100);
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
  } catch {
    throw new Error(`${field}: expected valid IANA time zone`);
  }
  return timeZone;
}
function timestamp(value, field) {
  const parsed = boundedString(value, field, 64);
  if (!Number.isFinite(Date.parse(parsed))) throw new Error(`${field}: expected timestamp`);
  return parsed;
}
function nullableString(value, field) {
  if (value === null) return null;
  return requiredString(value, field);
}
function parseProvider(value, model, field) {
  if (value === void 0) {
    return model.trim().toLowerCase().startsWith("deepseek-") ? "deepseek" : "unknown";
  }
  return requiredString(value, field);
}
function boolean(value, field) {
  if (typeof value !== "boolean") throw new Error(`${field}: expected boolean`);
  return value;
}
function finiteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field}: expected finite number`);
  return value;
}
function nonNegativeNumber(value, field) {
  const number = finiteNumber(value, field);
  if (number < 0) throw new Error(`${field}: expected non-negative number`);
  return number;
}
function positiveInteger(value, field) {
  const number = finiteNumber(value, field);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${field}: expected positive integer`);
  return number;
}
function nonNegativeInteger(value, field) {
  const number = nonNegativeNumber(value, field);
  if (!Number.isSafeInteger(number)) throw new Error(`${field}: expected safe integer`);
  return number;
}
function nullableNumber(value, field) {
  if (value === null) return null;
  return finiteNumber(value, field);
}
function meterStatus(value, field) {
  return oneOf(
    value,
    ["idle", "billing", "settled", "unknown", "balance_expired", "balance_insufficient", "failed", "aborted"],
    field
  );
}
function oneOf(value, values, field) {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`${field}: expected one of ${values.join(", ")}`);
  }
  return value;
}
export {
  MYMETER_LOCAL_TYPERT_CONTRIBUTION,
  MYMETER_PACKAGE_NAME,
  MYMETER_REMOTE_CONTRIBUTION,
  MYMETER_REMOTE_DESCRIPTORS,
  MYMETER_SERVICE_KEY,
  bindMyMeterTypertRemote,
  createMyMeterRemoteFromTypert
};
