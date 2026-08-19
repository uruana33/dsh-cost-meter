import { type MyMeterTypertRemoteRoot } from "./typert-remote";
export interface MyMeterCordisClientContext {
    connection: {
        isLoopback: boolean;
        rpc: {
            call(path: string, endpoint: string, payload?: unknown): Promise<unknown>;
        };
    };
    remote: MyMeterTypertRemoteRoot;
    slots: {
        inject(slot: "shell.overlay" | (string & {}), callback: () => (() => void) | Iterable<() => void>): () => void;
        register(options: {
            name: string;
            id?: string;
            key?: string;
            order?: number;
            label?: string;
        }, component: unknown): () => void;
    };
    inject(services: string[], callback: (ctx: MyMeterCordisClientContext) => void | (() => void | Promise<void>) | Promise<void | (() => void | Promise<void>)>): MyMeterCordisClientFiber;
    effect?<T>(factory: () => (() => void) | void, label?: string): T;
}
export interface MyMeterCordisClientFiber extends PromiseLike<unknown> {
    dispose(): Promise<void>;
}
export declare const name = "mymeter";
export declare const inject: readonly ["remote", "connection"];
/** Browser-side Cordis entry point. The Host remote descriptor is mounted as `remote.mymeter`. */
export declare function apply(ctx: MyMeterCordisClientContext): Promise<() => Promise<void>>;
