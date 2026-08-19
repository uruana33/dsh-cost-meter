import type { MyMeterRemote, MyMeterRemoteSnapshot, RemoteCostAnalyticsReport, RemoteExchangeRateSnapshot, RemoteLedgerExportFormat, RemoteSessionCostTree, RemoteSessionDetail, RemoteSessionSummary } from "../../client/src/index";
export type RemoteResult<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details: object;
    };
};
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
    readonly invocation: {
        readonly kind: "direct";
    };
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
    readonly schemas: readonly {
        readonly name: string;
        readonly schema: TypertSchema;
    }[];
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
    exportLedger?(format: RemoteLedgerExportFormat): Promise<RemoteResult<string>>;
    getBalance(): Promise<RemoteResult<MyMeterRemoteSnapshot["balance"]>>;
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
    exportLedger(format: RemoteLedgerExportFormat): Promise<string>;
    dispose(): void;
}
export interface MyMeterTypertRemoteAdapterOptions {
    pollIntervalMs?: number;
}
export declare const MYMETER_SERVICE_KEY = "mymeter";
export declare const MYMETER_PACKAGE_NAME = "@mymeter/dsh-cost-meter";
export declare const MYMETER_REMOTE_DESCRIPTORS: readonly InvocationDescriptor[];
export declare const MYMETER_REMOTE_CONTRIBUTION: TypertRemoteContribution;
export declare const MYMETER_LOCAL_TYPERT_CONTRIBUTION: TypertLocalContribution;
export declare function bindMyMeterTypertRemote<Service extends object>(service: Service): Service & {
    readonly typertRemote: {
        readonly service: Service;
        readonly serviceKey: string;
        readonly namespace: string;
    };
};
export declare function createMyMeterRemoteFromTypert(namespace: MyMeterTypertRemoteNamespace, options?: MyMeterTypertRemoteAdapterOptions): Promise<MyMeterTypertRemoteAdapter>;
