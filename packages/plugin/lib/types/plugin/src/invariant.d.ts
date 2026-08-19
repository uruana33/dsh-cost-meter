interface InvariantContext {
    invariants: {
        register(packageName: string, install: () => void): (() => void) | Promise<() => void>;
    };
}
export declare const name = "mymeter-invariant";
export declare const inject: readonly ["invariants"];
export declare function apply(ctx: InvariantContext): Promise<() => void>;
export {};
