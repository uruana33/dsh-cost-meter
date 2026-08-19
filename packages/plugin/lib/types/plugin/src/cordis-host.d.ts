import { type MyMeterBalanceProvider, type MyMeterCordisContext, type MyMeterHostRuntime, type MyMeterProviderDescriptor, type ExchangeRateProvider } from "./index";
import { type CostEventLedgerFormat, type CostEventRepository } from "../../host/src/index";
import { type TypertLocalContribution } from "./typert-remote";
import { type MyMeterProductionUpdateOptions, type MyMeterUpdateRpcContext } from "./self-update";
export type { MyMeterCordisContext } from "./index";
export interface MyMeterCordisHostOptions {
    ctx: MyMeterCordisContext;
    balance?: MyMeterBalanceProvider | undefined;
    providers?: (() => readonly MyMeterProviderDescriptor[]) | undefined;
    repository?: CostEventRepository | undefined;
    exchangeRate?: ExchangeRateProvider | undefined;
    ledgerPath?: string | undefined;
    ledgerFormat?: CostEventLedgerFormat | undefined;
}
export interface MyMeterTypertHostContext extends MyMeterCordisContext {
    baseUrl?: string;
    connection?: MyMeterUpdateRpcContext["connection"];
    credentials?: {
        resolve(ref: string): Promise<{
            value: string;
            source: string;
        } | undefined>;
    };
    settings?: {
        get(namespace: string): unknown;
        register?(namespace: string, schema: ((value: unknown) => Record<string, unknown>) & {
            toJSON(): unknown;
        }, options?: {
            base?: Record<string, unknown>;
        }): unknown;
    };
    llm?: {
        listProviders(): readonly {
            id: string;
            name: string;
        }[];
        listConfigurableProviders?(): readonly {
            provider: string;
            displayName: string;
            settingsNs: string;
            settingsPath: readonly string[];
        }[];
    };
    reflect?: {
        provide(key: "mymeter" | (string & {}), service: object): (() => void) | void;
    };
    typert?: {
        register(contribution: TypertLocalContribution): (() => Promise<void>) | (() => void);
    };
}
export interface MyMeterCordisHostConfig {
    ledgerPath?: string;
    ledgerFormat?: CostEventLedgerFormat;
    balanceEnabled?: boolean;
    apiKeyEnv?: string;
    baseUrl?: string;
    balanceCacheTtlMs?: number;
    update?: MyMeterProductionUpdateOptions;
}
/**
 * Adapt dsh's durable `session/event` stream to MyMeter's provider-neutral
 * event envelope. Stream text is reduced immediately to UTF-8 byte counts;
 * message content and request bodies never enter the ledger or runtime state.
 */
export declare function createMyMeterCordisHostRuntime({ ctx, balance, providers, repository, exchangeRate, ledgerPath, ledgerFormat, }: MyMeterCordisHostOptions): MyMeterHostRuntime;
export declare const name = "mymeter";
export declare const inject: readonly ["typert", "sessions", "credentials", "settings", "llm", "connection"];
/** Host-side Cordis entry point for a dsh package/bundle row. */
export declare function apply(ctx: MyMeterTypertHostContext, config?: MyMeterCordisHostConfig): () => Promise<void>;
export { buildSessionCostTree } from "./session-cost-tree";
export type { BuildSessionCostTreeOptions, MissingParentSession, SessionCostTree, SessionCostTreeEvent, SessionCostTreeNode, } from "./session-cost-tree";
