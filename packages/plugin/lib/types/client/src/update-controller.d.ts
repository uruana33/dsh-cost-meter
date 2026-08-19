export type MyMeterUpdateOperation = "check" | "install" | "restart-watch";
export type DshRestartPhase = "waitingForOffline" | "offlineObserved" | "recovered";
export interface MyMeterVersionCheck {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    releaseUrl?: string | undefined;
}
export interface MyMeterInstallResult {
    installedVersion: string;
}
export interface MyMeterUpdateService {
    checkLatest(): Promise<MyMeterVersionCheck>;
    installVersion(version: string): Promise<MyMeterInstallResult>;
}
export interface ConnectionRpc {
    call(path: string, endpoint: string, payload?: unknown): Promise<unknown>;
}
export interface UpdateRpcConnection {
    rpc: ConnectionRpc;
}
export declare const MYMETER_UPDATE_RPC_PATH = "/mymeter-update";
export declare const MYMETER_UPDATE_RPC_ENDPOINTS: Readonly<{
    checkLatest: "check";
    installVersion: "install";
}>;
export type MyMeterUpdateState = {
    status: "idle";
    currentVersion: string | null;
    latestVersion: string | null;
} | {
    status: "checking";
    currentVersion: string | null;
    latestVersion: string | null;
} | {
    status: "upToDate";
    currentVersion: string;
    latestVersion: string;
    checkedAt: string;
} | {
    status: "updateAvailable";
    currentVersion: string;
    latestVersion: string;
    releaseUrl?: string | undefined;
    checkedAt: string;
} | {
    status: "installing";
    currentVersion: string;
    latestVersion: string;
    releaseUrl?: string | undefined;
} | {
    status: "restartRequired";
    currentVersion: string;
    latestVersion: string;
    installedVersion: string;
    restartPhase: DshRestartPhase;
    restartPromptDismissed: boolean;
} | {
    status: "failed";
    operation: MyMeterUpdateOperation;
    error: string;
    currentVersion: string | null;
    latestVersion: string | null;
};
export interface MyMeterUpdateController {
    getState(): MyMeterUpdateState;
    subscribe(listener: () => void): () => void;
    check(): Promise<void>;
    install(): Promise<void>;
    dismissRestartPrompt(): void;
    reset(): void;
    setAvailableUpdate(update: Omit<MyMeterVersionCheck, "updateAvailable">): void;
    dispose(): void;
}
export interface WaitForDshRestartCycleOptions {
    probe: () => Promise<boolean>;
    delay: (ms: number) => Promise<void>;
    reload: () => void;
    shouldContinue?: () => boolean;
    onPhase?: (phase: DshRestartPhase) => void;
    intervalMs?: number;
    maxAttempts?: number;
}
export interface SameOriginHealthProbeOptions {
    fetchImpl?: typeof fetch;
    location?: Pick<Location, "origin">;
    path?: string;
}
export interface MyMeterUpdateControllerOptions {
    service: MyMeterUpdateService;
    healthProbe?: () => Promise<boolean>;
    delay?: (ms: number) => Promise<void>;
    reload?: () => void;
    restartPollIntervalMs?: number;
    restartMaxAttempts?: number;
    now?: () => Date;
}
export declare function createMyMeterUpdateController({ service, healthProbe, delay, reload, restartPollIntervalMs, restartMaxAttempts, now, }: MyMeterUpdateControllerOptions): MyMeterUpdateController;
export declare function waitForDshRestartCycle({ probe, delay, reload, shouldContinue, onPhase, intervalMs, maxAttempts, }: WaitForDshRestartCycleOptions): Promise<void>;
export declare function createSameOriginHealthProbe({ fetchImpl, location, path, }?: SameOriginHealthProbeOptions): () => Promise<boolean>;
export declare function createConnectionRpcUpdateService(connection: UpdateRpcConnection, path?: string, endpoints?: typeof MYMETER_UPDATE_RPC_ENDPOINTS): MyMeterUpdateService;
