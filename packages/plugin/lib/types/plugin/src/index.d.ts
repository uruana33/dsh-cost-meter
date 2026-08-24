import { type ReactNode } from "react";
import { type CostEvent } from "../../core/src/index";
import { type BalanceSnapshot, type CostEventRepository, type LedgerAggregation, type LedgerSummary } from "../../host/src/index";
import type { MyMeterBalanceDto } from "../../shared/src/index";
import { type MyMeterRemote, type MyMeterRemoteSnapshot, type RemoteCostAnalyticsReport, type RemoteContextBreakdown, type RemoteExchangeRateSnapshot, type RemoteLedgerExportFormat, type RemoteSessionCostTree, type RemoteSessionDetail, type RemoteSessionSummary, type RemoteUsageOverviewQuery, type RemoteUsageOverviewReport, type StorageLike } from "../../client/src/index";
export interface DshEventContext {
    on(event: string, listener: (payload: unknown) => void): () => void;
}
/** Structural subset of a real Cordis host context used by the runtime bridge. */
export interface MyMeterCordisContext {
    on(event: "session/event" | (string & {}), listener: (session: unknown, event: unknown) => void): () => void;
    effect?(factory: () => (() => void | Promise<void>) | void, label?: string): unknown;
    inject?(services: readonly string[], callback: (ctx: MyMeterCordisContext) => void | (() => void)): unknown;
    get?(key: string): unknown;
    logger?: {
        warn(message: string): void;
    };
    sessions?: {
        list(): readonly unknown[];
    };
    sessionQuery?: MyMeterSessionQueryService;
    sessionPersistence?: MyMeterSessionPersistenceService;
    sessionProjections?: {
        snapshot(session: unknown): {
            values?: Record<string, unknown>;
        };
    };
}
/** Structural subset of dsh's exact logical session-history reader. */
export interface MyMeterSessionQueryService {
    listSessions(signal?: AbortSignal): Promise<readonly unknown[]>;
    readSession(sessionId: string): Promise<unknown>;
}
/** Structural fallback for dsh deployments without the session-query service. */
export interface MyMeterSessionPersistenceService {
    list(signal?: AbortSignal): Promise<readonly unknown[]>;
    inspect(sessionId: string, signal?: AbortSignal): Promise<unknown>;
    listSnapshots?(signal?: AbortSignal): Promise<readonly unknown[]>;
}
export interface MyMeterSlotContext {
    register(slot: "shell.overlay" | (string & {}), contribution: ReactNode): () => void;
}
export type MyMeterBalanceProvider = (options?: {
    forceRefresh?: boolean;
}) => Promise<MyMeterBalanceDto | BalanceSnapshot>;
export interface MyMeterProviderDescriptor {
    id: string;
    name: string;
    balanceSupported: boolean;
}
export interface MyMeterHostRuntimeOptions {
    dsh: DshEventContext;
    balance?: MyMeterBalanceProvider | undefined;
    providers?: (() => readonly MyMeterProviderDescriptor[]) | undefined;
    contextBreakdown?: ((sessionId: string) => RemoteContextBreakdown | null) | undefined;
    repository?: CostEventRepository | undefined;
    now?: () => Date | undefined;
    exchangeRate?: ExchangeRateProvider | undefined;
    afterLedgerCommit?: (() => void) | undefined;
    onAfterLedgerCommitError?: ((error: unknown) => void) | undefined;
    /** Durable session-header parent links (sessionId -> parentSessionId). */
    observedSessionParents?: () => Readonly<Record<string, string>> | undefined;
}
export type ExchangeRateProvider = () => Promise<{
    rate: number;
    fetchedAt?: string | undefined;
    source?: string | undefined;
}>;
export interface MyMeterClientPluginOptions {
    slots: MyMeterSlotContext;
    remote: MyMeterRemote;
    storage?: StorageLike | null | undefined;
    storageKey?: string | undefined;
}
export interface MyMeterHostRemoteContribution extends MyMeterRemote {
    listSessions(): Promise<RemoteSessionSummary[]>;
    getSessionDetail(sessionId: string): Promise<RemoteSessionDetail | null>;
    getSessionCostTree(): Promise<RemoteSessionCostTree>;
    getCostAnalytics(): Promise<RemoteCostAnalyticsReport>;
    getUsageOverview(query: RemoteUsageOverviewQuery): Promise<RemoteUsageOverviewReport>;
    exportLedger(format: RemoteLedgerExportFormat): Promise<string>;
    getBalance(): Promise<MyMeterRemoteSnapshot["balance"]>;
    refreshBalance(): Promise<MyMeterRemoteSnapshot["balance"]>;
    getSettings(): Promise<Record<string, unknown>>;
    refreshExchangeRate(): Promise<RemoteExchangeRateSnapshot>;
}
export interface MyMeterHostRuntime {
    readonly remote: MyMeterHostRemoteContribution;
    events(): CostEvent[];
    ledger(): LedgerSummary;
    aggregation(): LedgerAggregation;
    batch<T>(callback: () => T): T;
    uninstall(): void;
}
export interface MyMeterClientPlugin {
    uninstall(): void;
}
export declare function createMyMeterHostRuntime({ dsh, balance, providers, contextBreakdown, repository: configuredRepository, exchangeRate: configuredExchangeRate, now: configuredNow, afterLedgerCommit, onAfterLedgerCommitError, observedSessionParents, }: MyMeterHostRuntimeOptions): MyMeterHostRuntime;
export declare function createMyMeterClientPlugin({ slots, remote, storage, storageKey, }: MyMeterClientPluginOptions): MyMeterClientPlugin;
export { apply, apply as applyCordisHost, createMyMeterCordisHostRuntime, inject, name, } from "./cordis-host";
export type { MyMeterCordisHostConfig, MyMeterCordisHostOptions, MyMeterTypertHostContext } from "./cordis-host";
export { buildSessionCostTree, } from "./session-cost-tree";
export type { BuildSessionCostTreeOptions, MissingParentSession, SessionCostTree, SessionCostTreeEvent, SessionCostTreeNode, } from "./session-cost-tree";
export { MYMETER_LOCAL_TYPERT_CONTRIBUTION, MYMETER_REMOTE_CONTRIBUTION, MYMETER_REMOTE_DESCRIPTORS, MYMETER_SERVICE_KEY, bindMyMeterTypertRemote, createMyMeterRemoteFromTypert, } from "./typert-remote";
export type { InvocationDescriptor, MyMeterTypertRemoteNamespace, MyMeterTypertRemoteRoot, RemoteResult, TypertLocalContribution, TypertRemoteContribution, } from "./typert-remote";
