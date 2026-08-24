import {
  createEmptySummary,
  dayKeyFromTimestamp,
  finalizeSummary,
  normalizeCostEvent,
  type CostEventInput,
  type CostEventRecord,
  type LedgerAggregation,
  type LedgerSummary,
  updateSummary,
} from "./types.js";

/**
 * Incremental counterpart to `createLedgerAggregator`. The full aggregator
 * replays every journal event (O(total history)) per call; this one keeps
 * per-scope summaries up to date under the runtime's single mutation pattern:
 * an event is inserted fresh, or replaces its previous projection version —
 * same identity, same `requestStartedAt`.
 *
 * Additive counters are subtracted/re-added directly. `firstSeenAt` /
 * `lastSeenAt` and the provider/model metadata attributed to the latest
 * timestamp use per-scope participant lists keyed by timestamp; a replacement
 * that keeps its timestamp costs O(1). Genuine boundary changes fall back to
 * a rescan over distinct timestamps, which is rare because replacements do
 * not move boundaries.
 */
export interface IncrementalLedgerAggregator {
  seed(events: readonly CostEventInput[]): void;
  /** Applies one journal mutation: removes the previous version, adds the next. */
  apply(previous: CostEventInput | undefined, next: CostEventInput | undefined): void;
  reset(): void;
  snapshot(): LedgerAggregation;
}

interface Participant {
  eventId: string;
  event: CostEventRecord;
}

interface ScopeState {
  summary: LedgerSummary;
  // requestStartedAt -> participants in insertion order. The full aggregator
  // attributes boundary metadata to the first event seen at the maximal
  // timestamp (its strict `>` comparison), so order matters here.
  readonly byTimestamp: Map<string, Participant[]>;
  readonly timestampByEventId: Map<string, string>;
}

const UNKNOWN_TEXT = "unknown";

export function createIncrementalLedgerAggregator(): IncrementalLedgerAggregator {
  const globalScope = createScopeState();
  const sessionScopes = new Map<string, ScopeState>();
  const dayScopes = new Map<string, ScopeState>();

  const scopeForSession = (sessionId: string): ScopeState => {
    let scope = sessionScopes.get(sessionId);
    if (!scope) {
      scope = createScopeState();
      sessionScopes.set(sessionId, scope);
    }
    return scope;
  };

  const scopeForDay = (timestamp: string): ScopeState => {
    const dayKey = dayKeyFromTimestamp(timestamp);
    let scope = dayScopes.get(dayKey);
    if (!scope) {
      scope = createScopeState();
      dayScopes.set(dayKey, scope);
    }
    return scope;
  };

  const add = (scope: ScopeState, event: CostEventRecord): void => {
    updateSummary(scope.summary, event);
    const bucket = scope.byTimestamp.get(event.requestStartedAt);
    const participant: Participant = { eventId: event.id, event };
    if (bucket) {
      bucket.push(participant);
    } else {
      scope.byTimestamp.set(event.requestStartedAt, [participant]);
    }
    scope.timestampByEventId.set(event.id, event.requestStartedAt);
  };

  const remove = (scope: ScopeState | undefined, eventId: string): void => {
    if (!scope) return;
    const timestamp = scope.timestampByEventId.get(eventId);
    if (timestamp === undefined) return;
    scope.timestampByEventId.delete(eventId);

    const bucket = scope.byTimestamp.get(timestamp);
    if (!bucket) return;
    const index = bucket.findIndex((participant) => participant.eventId === eventId);
    if (index === -1) return;
    const removed = bucket.splice(index, 1)[0];
    if (!removed) return;
    subtractEvent(scope.summary, removed.event);
    if (bucket.length === 0) {
      scope.byTimestamp.delete(timestamp);
      retractBoundary(scope, timestamp);
    }
  };

  const addEverywhere = (event: CostEventRecord): void => {
    add(globalScope, event);
    add(scopeForSession(event.sessionId), event);
    add(scopeForDay(event.requestStartedAt), event);
  };

  const removeEverywhere = (event: CostEventRecord): void => {
    remove(globalScope, event.id);
    const sessionScope = sessionScopes.get(event.sessionId);
    remove(sessionScope, event.id);
    // Empty scopes must disappear so snapshot() matches the full aggregator,
    // which never materializes summaries without events.
    if (sessionScope && sessionScope.summary.requestCount === 0) {
      sessionScopes.delete(event.sessionId);
    }
    const dayKey = dayKeyFromTimestamp(event.requestStartedAt);
    const dayScope = dayScopes.get(dayKey);
    remove(dayScope, event.id);
    if (dayScope && dayScope.summary.requestCount === 0) {
      dayScopes.delete(dayKey);
    }
  };

  return {
    seed(events) {
      this.reset();
      for (const input of events) {
        addEverywhere(normalizeCostEvent(input));
      }
    },
    apply(previous, next) {
      if (previous) removeEverywhere(normalizeCostEvent(previous));
      if (next) addEverywhere(normalizeCostEvent(next));
    },
    reset() {
      resetScope(globalScope);
      sessionScopes.clear();
      dayScopes.clear();
    },
    snapshot() {
      finalizeSummary(globalScope.summary);
      for (const scope of sessionScopes.values()) {
        finalizeSummary(scope.summary);
      }
      for (const scope of dayScopes.values()) {
        finalizeSummary(scope.summary);
      }
      return {
        global: { ...globalScope.summary },
        sessions: new Map([...sessionScopes].map(([id, scope]) => [id, { ...scope.summary }])),
        days: new Map([...dayScopes].map(([dayKey, scope]) => [dayKey, { ...scope.summary }])),
      };
    },
  };
}

function createScopeState(): ScopeState {
  return {
    summary: createEmptySummary(),
    byTimestamp: new Map(),
    timestampByEventId: new Map(),
  };
}

function resetScope(scope: ScopeState): void {
  scope.summary = createEmptySummary();
  scope.byTimestamp.clear();
  scope.timestampByEventId.clear();
}

/**
 * Drops a boundary timestamp from a scope. Cheap while another participant
 * shares the timestamp (the streaming replace pattern); otherwise rescans the
 * remaining distinct timestamps once to restore min/max and metadata.
 */
function retractBoundary(scope: ScopeState, removedTimestamp: string): void {
  const summary = scope.summary;
  if (summary.firstSeenAt !== removedTimestamp && summary.lastSeenAt !== removedTimestamp) {
    return;
  }
  let minTimestamp: string | null = null;
  let maxTimestamp: string | null = null;
  for (const timestamp of scope.byTimestamp.keys()) {
    if (minTimestamp === null || timestamp < minTimestamp) minTimestamp = timestamp;
    if (maxTimestamp === null || timestamp > maxTimestamp) maxTimestamp = timestamp;
  }
  summary.firstSeenAt = minTimestamp ?? "";
  summary.lastSeenAt = maxTimestamp ?? "";
  restoreBoundaryMetadata(
    summary,
    maxTimestamp === null ? undefined : scope.byTimestamp.get(maxTimestamp),
  );
}

function restoreBoundaryMetadata(
  summary: LedgerSummary,
  bucket: Participant[] | undefined,
): void {
  const owner = bucket?.[0]?.event;
  if (!owner) {
    summary.provider = UNKNOWN_TEXT;
    summary.model = UNKNOWN_TEXT;
    summary.reasoningEffort = UNKNOWN_TEXT;
    summary.agentPreset = UNKNOWN_TEXT;
    return;
  }
  summary.provider = owner.provider !== UNKNOWN_TEXT ? owner.provider : UNKNOWN_TEXT;
  summary.model = owner.model !== UNKNOWN_TEXT ? owner.model : UNKNOWN_TEXT;
  summary.reasoningEffort = owner.reasoningEffort !== UNKNOWN_TEXT ? owner.reasoningEffort : UNKNOWN_TEXT;
  summary.agentPreset = owner.agentPreset !== UNKNOWN_TEXT ? owner.agentPreset : UNKNOWN_TEXT;
}

function subtractEvent(summary: LedgerSummary, event: CostEventRecord): void {
  summary.requestCount -= 1;
  summary.cacheHitTokens -= event.cacheHitTokens;
  summary.cacheMissTokens -= event.cacheMissTokens;
  summary.outputTokens -= event.outputTokens;
  summary.reasoningTokens -= event.reasoningTokens;

  switch (event.status) {
    case "estimated":
      summary.estimatedCount -= 1;
      summary.estimatedMicroCny -= event.amountMicroCny;
      summary.totalMicroCny -= event.amountMicroCny;
      break;
    case "settled":
      summary.settledCount -= 1;
      summary.settledMicroCny -= event.amountMicroCny;
      summary.totalMicroCny -= event.amountMicroCny;
      break;
    case "failed":
      summary.failedCount -= 1;
      summary.failedMicroCny -= event.amountMicroCny;
      summary.totalMicroCny -= event.amountMicroCny;
      break;
    case "unknown":
      summary.unknownCount -= 1;
      summary.unknownMicroCny -= event.amountMicroCny;
      break;
  }

  if (event.pricingZone === "peak") {
    summary.peakMicroCny -= event.amountMicroCny;
  } else if (event.pricingZone === "offpeak") {
    summary.offpeakMicroCny -= event.amountMicroCny;
  }
}
