export declare const MYMETER_UPDATE_PACKAGE_NAME = "@mymeter/dsh-cost-meter";
export declare const MYMETER_UPDATE_RPC_CHANNEL = "/mymeter-update";
export interface MyMeterPackageManifest {
    readonly name?: unknown;
    readonly version?: unknown;
    readonly dsh?: unknown;
}
export interface MyMeterPluginInstallRequest {
    readonly profileDir: string;
    readonly packageName: typeof MYMETER_UPDATE_PACKAGE_NAME;
    readonly version: string;
}
export interface MyMeterPluginUpdateDependencies {
    readonly profileDir: string;
    readonly readCurrentManifest: () => Promise<MyMeterPackageManifest>;
    readonly registry: {
        getLatestManifest(packageName: typeof MYMETER_UPDATE_PACKAGE_NAME): Promise<MyMeterPackageManifest>;
        getManifest?(packageName: typeof MYMETER_UPDATE_PACKAGE_NAME, version: string): Promise<MyMeterPackageManifest>;
    };
    readonly installer: {
        installExact(request: MyMeterPluginInstallRequest): Promise<void>;
    };
}
export type MyMeterUpdateRpcResult<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: {
        readonly code: "bad-request";
        readonly message: string;
        readonly details: {
            readonly issues: readonly unknown[];
        };
    } | {
        readonly code: "internal";
        readonly message: string;
        readonly details: object;
    };
};
export interface MyMeterUpdateRpcContext {
    readonly baseUrl?: string | undefined;
    readonly connection?: {
        readonly rpc?: {
            handle(channel: typeof MYMETER_UPDATE_RPC_CHANNEL, handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<MyMeterUpdateRpcResult<unknown>>, options: {
                readonly authority: "loopback";
            }): () => Promise<void> | void;
        } | undefined;
    } | undefined;
}
export interface MyMeterProductionUpdateOptions {
    readonly readCurrentManifest?: (() => Promise<MyMeterPackageManifest>) | undefined;
    readonly registry?: MyMeterPluginUpdateDependencies["registry"] | undefined;
    readonly installer?: MyMeterPluginUpdateDependencies["installer"] | undefined;
    readonly fetchImpl?: typeof fetch | undefined;
    readonly registryUrl?: string | undefined;
    readonly registryTimeoutMs?: number | undefined;
    readonly execFile?: PnpmExecFile | undefined;
}
export interface MyMeterNpmRegistryOptions {
    readonly fetchImpl?: typeof fetch | undefined;
    readonly registryUrl?: string | undefined;
    readonly timeoutMs?: number | undefined;
}
export type PnpmExecFile = (file: string, args: readonly string[], options: {
    readonly cwd: string;
}) => Promise<unknown>;
export interface PnpmMyMeterPluginInstallerOptions {
    readonly execFile?: PnpmExecFile | undefined;
}
export interface MyMeterPluginUpdateCheck {
    readonly packageName: typeof MYMETER_UPDATE_PACKAGE_NAME;
    readonly currentVersion: string;
    readonly latestVersion: string;
    readonly updateAvailable: boolean;
    readonly restartRequired: boolean;
}
export interface MyMeterPluginInstallResult {
    readonly packageName: typeof MYMETER_UPDATE_PACKAGE_NAME;
    readonly installedVersion: string;
    readonly restartRequired: true;
}
export interface MyMeterPluginUpdater {
    checkForUpdate(): Promise<MyMeterPluginUpdateCheck>;
    installUpdate(targetVersion: string): Promise<MyMeterPluginInstallResult>;
}
export declare function createMyMeterPluginUpdater(dependencies: MyMeterPluginUpdateDependencies): MyMeterPluginUpdater;
export declare function createMyMeterProductionUpdateDependencies(baseUrl: string, options?: MyMeterProductionUpdateOptions): MyMeterPluginUpdateDependencies;
export declare function registerMyMeterUpdateRpc(ctx: MyMeterUpdateRpcContext, options?: MyMeterProductionUpdateOptions): (() => Promise<void> | void) | null;
export declare function profileDirFromCordisBaseUrl(baseUrl: string): string;
export declare function createCurrentMyMeterManifestReader(packageJsonUrl?: URL | string): () => Promise<MyMeterPackageManifest>;
export declare function createMyMeterNpmRegistry(options?: MyMeterNpmRegistryOptions): MyMeterPluginUpdateDependencies["registry"];
export declare function createPnpmMyMeterPluginInstaller(options?: PnpmMyMeterPluginInstallerOptions): MyMeterPluginUpdateDependencies["installer"];
