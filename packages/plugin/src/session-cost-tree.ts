import {
  createEmptySummary,
  type LedgerAggregation,
  type LedgerSummary,
} from "../../host/src/index";

export interface SessionCostTreeEvent {
  readonly sessionId: string;
  readonly parentSessionId?: string | undefined;
  readonly requestStartedAt?: string | undefined;
  readonly completedAt?: string | undefined;
}

export interface BuildSessionCostTreeOptions<Detail = unknown> {
  readonly aggregation: LedgerAggregation;
  readonly events: readonly SessionCostTreeEvent[];
  readonly details?: Readonly<Record<string, Detail>> | undefined;
}

export interface MissingParentSession {
  readonly sessionId: string;
  readonly parentSessionId: string;
}

export interface SessionCostTreeNode<Detail = unknown> {
  readonly id: string;
  readonly title: string;
  readonly parentSessionId?: string | undefined;
  readonly childSessionIds: readonly string[];
  readonly depth: number;
  readonly path: readonly string[];
  readonly summary: LedgerSummary;
  readonly subtreeSummary: LedgerSummary;
  readonly detail?: Detail | undefined;
  readonly orphaned: boolean;
  readonly cyclic: boolean;
}

export interface SessionCostTree<Detail = unknown> {
  readonly roots: readonly SessionCostTreeNode<Detail>[];
  readonly nodes: Readonly<Record<string, SessionCostTreeNode<Detail>>>;
  readonly summary: LedgerSummary;
  readonly anomalies: {
    readonly missingParents: readonly MissingParentSession[];
    readonly cycles: readonly (readonly string[])[];
  };
}

interface MutableNode<Detail> {
  id: string;
  title: string;
  parentSessionId?: string | undefined;
  childSessionIds: string[];
  depth: number;
  path: string[];
  summary: LedgerSummary;
  subtreeSummary: LedgerSummary;
  detail?: Detail | undefined;
  orphaned: boolean;
  cyclic: boolean;
}

interface ParentObservation {
  parentSessionId: string;
  activity: string;
  sequence: number;
}

export function buildSessionCostTree<Detail = unknown>({
  aggregation,
  events,
  details = {},
}: BuildSessionCostTreeOptions<Detail>): SessionCostTree<Detail> {
  const sessionIds = orderedSessionIds(aggregation, events, details);
  const parentBySession = observeParents(events);
  const nodes = createNodes(sessionIds, aggregation, details, parentBySession);
  const parentForTree = new Map<string, string>();
  const missingParents: MissingParentSession[] = [];

  for (const node of nodes.values()) {
    const parentSessionId = node.parentSessionId;
    if (!parentSessionId) continue;
    if (!nodes.has(parentSessionId)) {
      node.orphaned = true;
      missingParents.push({ sessionId: node.id, parentSessionId });
      continue;
    }
    parentForTree.set(node.id, parentSessionId);
  }

  const cycles = detectCycles(sessionIds, parentForTree);
  for (const cycle of cycles) {
    for (const sessionId of cycle) {
      const node = nodes.get(sessionId);
      if (!node) continue;
      node.cyclic = true;
      parentForTree.delete(sessionId);
    }
  }

  for (const [sessionId, parentSessionId] of parentForTree.entries()) {
    nodes.get(parentSessionId)?.childSessionIds.push(sessionId);
  }

  const roots = [...nodes.values()]
    .filter((node) => !parentForTree.has(node.id))
    .sort(compareNodes);
  for (const root of roots) {
    assignPath(root, [], nodes);
  }
  for (const root of roots) {
    rollupSubtreeSummary(root, nodes);
  }

  const finalizedNodes = Object.fromEntries(
    [...nodes.entries()].map(([id, node]) => [id, freezeNode(node)]),
  ) as Record<string, SessionCostTreeNode<Detail>>;

  return Object.freeze({
    roots: Object.freeze(roots.map((node) => finalizedNodes[node.id]!)),
    nodes: Object.freeze(finalizedNodes),
    summary: cloneSummary(aggregation.global),
    anomalies: Object.freeze({
      missingParents: Object.freeze(missingParents),
      cycles: Object.freeze(cycles),
    }),
  });
}

function orderedSessionIds<Detail>(
  aggregation: LedgerAggregation,
  events: readonly SessionCostTreeEvent[],
  details: Readonly<Record<string, Detail>>,
): string[] {
  const ids = new Set<string>();
  for (const id of aggregation.sessions.keys()) ids.add(id);
  for (const event of events) {
    const sessionId = normalizeSessionId(event.sessionId);
    if (sessionId) ids.add(sessionId);
  }
  for (const id of Object.keys(details)) {
    if (normalizeSessionId(id)) ids.add(id);
  }
  return [...ids].sort();
}

function observeParents(events: readonly SessionCostTreeEvent[]): Map<string, ParentObservation> {
  const observed = new Map<string, ParentObservation>();
  events.forEach((event, sequence) => {
    const sessionId = normalizeSessionId(event.sessionId);
    const parentSessionId = normalizeSessionId(event.parentSessionId);
    if (!sessionId || !parentSessionId) return;

    const activity = eventActivity(event);
    const previous = observed.get(sessionId);
    if (
      !previous ||
      activity > previous.activity ||
      (activity === previous.activity && sequence > previous.sequence)
    ) {
      observed.set(sessionId, { parentSessionId, activity, sequence });
    }
  });
  return observed;
}

function createNodes<Detail>(
  sessionIds: readonly string[],
  aggregation: LedgerAggregation,
  details: Readonly<Record<string, Detail>>,
  parentBySession: ReadonlyMap<string, ParentObservation>,
): Map<string, MutableNode<Detail>> {
  const nodes = new Map<string, MutableNode<Detail>>();
  for (const sessionId of sessionIds) {
    const detail = details[sessionId];
    nodes.set(sessionId, {
      id: sessionId,
      title: titleForSession(sessionId, detail),
      parentSessionId: parentBySession.get(sessionId)?.parentSessionId,
      childSessionIds: [],
      depth: 0,
      path: [sessionId],
      summary: cloneSummary(aggregation.sessions.get(sessionId) ?? createEmptySummary()),
      subtreeSummary: createEmptySummary(),
      ...(detail !== undefined ? { detail } : {}),
      orphaned: false,
      cyclic: false,
    });
  }
  return nodes;
}

function detectCycles(
  sessionIds: readonly string[],
  parentForTree: ReadonlyMap<string, string>,
): string[][] {
  const cycles: string[][] = [];
  const seenCycleKeys = new Set<string>();

  for (const start of sessionIds) {
    const path: string[] = [];
    const pathIndex = new Map<string, number>();
    let current: string | undefined = start;
    while (current) {
      const existing = pathIndex.get(current);
      if (existing !== undefined) {
        const cycle = path.slice(existing);
        const key = [...cycle].sort().join("\0");
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key);
          cycles.push(cycle);
        }
        break;
      }
      if (path.includes(current)) break;
      pathIndex.set(current, path.length);
      path.push(current);
      current = parentForTree.get(current);
    }
  }

  return cycles.sort((left, right) => left[0]!.localeCompare(right[0]!));
}

function assignPath<Detail>(
  node: MutableNode<Detail>,
  ancestors: readonly string[],
  nodes: ReadonlyMap<string, MutableNode<Detail>>,
): void {
  node.depth = ancestors.length;
  node.path = [...ancestors, node.id];
  for (const childId of node.childSessionIds) {
    const child = nodes.get(childId);
    if (child) assignPath(child, node.path, nodes);
  }
}

function rollupSubtreeSummary<Detail>(
  node: MutableNode<Detail>,
  nodes: ReadonlyMap<string, MutableNode<Detail>>,
): LedgerSummary {
  let summary = cloneSummary(node.summary);
  for (const childId of node.childSessionIds) {
    const child = nodes.get(childId);
    if (!child) continue;
    summary = addSummary(summary, rollupSubtreeSummary(child, nodes));
  }
  node.subtreeSummary = summary;
  return summary;
}

function addSummary(left: LedgerSummary, right: LedgerSummary): LedgerSummary {
  const result = cloneSummary(left);
  result.requestCount += right.requestCount;
  result.totalMicroCny += right.totalMicroCny;
  result.estimatedMicroCny += right.estimatedMicroCny;
  result.settledMicroCny += right.settledMicroCny;
  result.unknownMicroCny += right.unknownMicroCny;
  result.failedMicroCny += right.failedMicroCny;
  result.unknownCount += right.unknownCount;
  result.estimatedCount += right.estimatedCount;
  result.settledCount += right.settledCount;
  result.failedCount += right.failedCount;
  result.cacheHitTokens += right.cacheHitTokens;
  result.cacheMissTokens += right.cacheMissTokens;
  result.outputTokens += right.outputTokens;
  result.reasoningTokens += right.reasoningTokens;
  result.peakMicroCny += right.peakMicroCny;
  result.offpeakMicroCny += right.offpeakMicroCny;
  if (result.firstSeenAt === "" || (right.firstSeenAt !== "" && right.firstSeenAt < result.firstSeenAt)) {
    result.firstSeenAt = right.firstSeenAt;
  }
  if (right.lastSeenAt !== "" && (result.lastSeenAt === "" || right.lastSeenAt > result.lastSeenAt)) {
    result.lastSeenAt = right.lastSeenAt;
    result.provider = right.provider;
    result.model = right.model;
    result.reasoningEffort = right.reasoningEffort;
    result.agentPreset = right.agentPreset;
  }
  return result;
}

function cloneSummary(summary: LedgerSummary): LedgerSummary {
  return { ...summary };
}

function freezeNode<Detail>(node: MutableNode<Detail>): SessionCostTreeNode<Detail> {
  return Object.freeze({
    ...node,
    childSessionIds: Object.freeze([...node.childSessionIds]),
    path: Object.freeze([...node.path]),
    summary: Object.freeze(cloneSummary(node.summary)),
    subtreeSummary: Object.freeze(cloneSummary(node.subtreeSummary)),
  });
}

function compareNodes<Detail>(left: MutableNode<Detail>, right: MutableNode<Detail>): number {
  const leftSeen = left.summary.firstSeenAt || left.summary.lastSeenAt;
  const rightSeen = right.summary.firstSeenAt || right.summary.lastSeenAt;
  if (leftSeen !== rightSeen) return leftSeen.localeCompare(rightSeen);
  return left.id.localeCompare(right.id);
}

function eventActivity(event: SessionCostTreeEvent): string {
  return event.completedAt || event.requestStartedAt || "";
}

function normalizeSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== "unknown" ? trimmed : null;
}

function titleForSession<Detail>(sessionId: string, detail: Detail | undefined): string {
  if (detail && typeof detail === "object" && "title" in detail) {
    const title = (detail as { title?: unknown }).title;
    if (typeof title === "string" && title.trim().length > 0) return title;
  }
  return sessionId;
}
