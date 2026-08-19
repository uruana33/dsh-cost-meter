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

export const MYMETER_UPDATE_RPC_PATH = "/mymeter-update";
export const MYMETER_UPDATE_RPC_ENDPOINTS = Object.freeze({
  checkLatest: "check",
  installVersion: "install",
});

export type MyMeterUpdateState =
  | {
      status: "idle";
      currentVersion: string | null;
      latestVersion: string | null;
    }
  | {
      status: "checking";
      currentVersion: string | null;
      latestVersion: string | null;
    }
  | {
      status: "upToDate";
      currentVersion: string;
      latestVersion: string;
      checkedAt: string;
    }
  | {
      status: "updateAvailable";
      currentVersion: string;
      latestVersion: string;
      releaseUrl?: string | undefined;
      checkedAt: string;
    }
  | {
      status: "installing";
      currentVersion: string;
      latestVersion: string;
      releaseUrl?: string | undefined;
    }
  | {
      status: "restartRequired";
      currentVersion: string;
      latestVersion: string;
      installedVersion: string;
      restartPhase: DshRestartPhase;
      restartPromptDismissed: boolean;
    }
  | {
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

const DEFAULT_RESTART_POLL_INTERVAL_MS = 1_000;
const DEFAULT_RESTART_MAX_ATTEMPTS = 600;

const initialState: MyMeterUpdateState = {
  status: "idle",
  currentVersion: null,
  latestVersion: null,
};

export function createMyMeterUpdateController({
  service,
  healthProbe = createSameOriginHealthProbe(),
  delay = defaultDelay,
  reload = defaultReload,
  restartPollIntervalMs = DEFAULT_RESTART_POLL_INTERVAL_MS,
  restartMaxAttempts = DEFAULT_RESTART_MAX_ATTEMPTS,
  now = () => new Date(),
}: MyMeterUpdateControllerOptions): MyMeterUpdateController {
  let state: MyMeterUpdateState = initialState;
  let disposed = false;
  let runId = 0;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const setState = (next: MyMeterUpdateState) => {
    if (disposed) return;
    state = next;
    emit();
  };

  const controller: MyMeterUpdateController = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async check() {
      if (state.status === "checking" || state.status === "installing") return;
      const previous = state;
      setState({
        status: "checking",
        currentVersion: previous.currentVersion,
        latestVersion: previous.latestVersion,
      });

      try {
        const result = await service.checkLatest();
        if (result.updateAvailable) {
          setState({
            status: "updateAvailable",
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
            releaseUrl: result.releaseUrl,
            checkedAt: now().toISOString(),
          });
          return;
        }

        setState({
          status: "upToDate",
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          checkedAt: now().toISOString(),
        });
      } catch (error) {
        setState(failedState("check", error, previous));
      }
    },
    async install() {
      if (state.status !== "updateAvailable") return;
      const update = state;
      setState({
        status: "installing",
        currentVersion: update.currentVersion,
        latestVersion: update.latestVersion,
        releaseUrl: update.releaseUrl,
      });

      try {
        const result = await service.installVersion(update.latestVersion);
        const currentRun = ++runId;
        setState({
          status: "restartRequired",
          currentVersion: update.currentVersion,
          latestVersion: update.latestVersion,
          installedVersion: result.installedVersion,
          restartPhase: "waitingForOffline",
          restartPromptDismissed: false,
        });
        void waitForDshRestartCycle({
          probe: healthProbe,
          delay,
          reload,
          intervalMs: restartPollIntervalMs,
          maxAttempts: restartMaxAttempts,
          shouldContinue: () => currentRun === runId && !disposed,
          onPhase: (phase) => {
            if (currentRun !== runId || disposed) return;
            if (state.status !== "restartRequired") return;
            setState({ ...state, restartPhase: phase });
          },
        }).catch((error) => {
          if (currentRun !== runId || disposed) return;
          setState(failedState("restart-watch", error, state));
        });
      } catch (error) {
        setState(failedState("install", error, update));
      }
    },
    dismissRestartPrompt() {
      if (state.status !== "restartRequired") return;
      setState({ ...state, restartPromptDismissed: true });
    },
    reset() {
      runId += 1;
      setState(initialState);
    },
    setAvailableUpdate(update) {
      setState({
        status: "updateAvailable",
        currentVersion: update.currentVersion,
        latestVersion: update.latestVersion,
        releaseUrl: update.releaseUrl,
        checkedAt: now().toISOString(),
      });
    },
    dispose() {
      disposed = true;
      runId += 1;
      listeners.clear();
    },
  };

  return controller;
}

export async function waitForDshRestartCycle({
  probe,
  delay,
  reload,
  shouldContinue = () => true,
  onPhase,
  intervalMs = DEFAULT_RESTART_POLL_INTERVAL_MS,
  maxAttempts = DEFAULT_RESTART_MAX_ATTEMPTS,
}: WaitForDshRestartCycleOptions): Promise<void> {
  if (!shouldContinue()) return;
  onPhase?.("waitingForOffline");

  let attempts = 0;
  let sawOffline = false;
  while (attempts < maxAttempts) {
    if (!shouldContinue()) return;
    attempts += 1;
    if (!(await isHealthy(probe))) {
      sawOffline = true;
      break;
    }
    await delay(intervalMs);
  }
  if (!shouldContinue()) return;
  if (!sawOffline) {
    throw new Error("等待 dsh 退出超时，请手动刷新页面");
  }

  onPhase?.("offlineObserved");
  attempts = 0;
  while (attempts < maxAttempts) {
    if (!shouldContinue()) return;
    attempts += 1;
    if (await isHealthy(probe)) {
      if (!shouldContinue()) return;
      onPhase?.("recovered");
      reload();
      return;
    }
    await delay(intervalMs);
  }

  if (!shouldContinue()) return;

  throw new Error("等待 dsh 恢复超时，请手动刷新页面");
}

export function createSameOriginHealthProbe({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  location = globalThis.location,
  path = "/",
}: SameOriginHealthProbeOptions = {}): () => Promise<boolean> {
  return async () => {
    if (!fetchImpl || !location?.origin) return false;
    try {
      const response = await fetchImpl(new URL(path, location.origin), {
        cache: "no-store",
        method: "GET",
      });
      return response.ok;
    } catch {
      return false;
    }
  };
}

export function createConnectionRpcUpdateService(
  connection: UpdateRpcConnection,
  path = MYMETER_UPDATE_RPC_PATH,
  endpoints: typeof MYMETER_UPDATE_RPC_ENDPOINTS = MYMETER_UPDATE_RPC_ENDPOINTS,
): MyMeterUpdateService {
  return {
    async checkLatest() {
      return parseVersionCheck(unwrapRpcResult(await connection.rpc.call(path, endpoints.checkLatest, {})));
    },
    async installVersion(version) {
      return parseInstallResult(unwrapRpcResult(await connection.rpc.call(path, endpoints.installVersion, { version })));
    },
  };
}

function failedState(
  operation: MyMeterUpdateOperation,
  error: unknown,
  previous: Pick<MyMeterUpdateState, "currentVersion" | "latestVersion">,
): MyMeterUpdateState {
  return {
    status: "failed",
    operation,
    error: error instanceof Error ? error.message : String(error),
    currentVersion: previous.currentVersion,
    latestVersion: previous.latestVersion,
  };
}

async function isHealthy(probe: () => Promise<boolean>): Promise<boolean> {
  try {
    return await probe();
  } catch {
    return false;
  }
}

function parseVersionCheck(value: unknown): MyMeterVersionCheck {
  const record = objectRecord(value, "MyMeterVersionCheck");
  const currentVersion = stringField(record.currentVersion, "currentVersion");
  const latestVersion = stringField(record.latestVersion, "latestVersion");
  return {
    currentVersion,
    latestVersion,
    updateAvailable: booleanField(record.updateAvailable, "updateAvailable"),
    releaseUrl: optionalStringField(record.releaseUrl, "releaseUrl"),
  };
}

function unwrapRpcResult(value: unknown): unknown {
  const record = objectRecord(value, "RpcResult");
  if (record.ok === true) return record.value;
  if (record.ok === false) {
    const error = objectRecord(record.error, "RpcResult.error");
    throw new Error(optionalStringField(error.message, "error.message") ?? "MyMeter 更新请求失败");
  }
  throw new Error("RpcResult.ok 必须是布尔值");
}

function parseInstallResult(value: unknown): MyMeterInstallResult {
  const record = objectRecord(value, "MyMeterInstallResult");
  return { installedVersion: stringField(record.installedVersion, "installedVersion") };
}

function objectRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function stringField(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} 必须是非空字符串`);
  }
  return value;
}

function optionalStringField(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return stringField(value, field);
}

function booleanField(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} 必须是布尔值`);
  }
  return value;
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultReload(): void {
  globalThis.location?.reload();
}
