import { type LedgerAggregation, type LedgerSummary } from "../../host/src/index";
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
export declare function buildSessionCostTree<Detail = unknown>({ aggregation, events, details, }: BuildSessionCostTreeOptions<Detail>): SessionCostTree<Detail>;
