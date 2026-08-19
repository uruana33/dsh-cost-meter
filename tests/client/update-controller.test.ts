import { describe, expect, test, vi } from "vitest";

import {
  MYMETER_UPDATE_RPC_ENDPOINTS,
  MYMETER_UPDATE_RPC_PATH,
  createConnectionRpcUpdateService,
  createMyMeterUpdateController,
  waitForDshRestartCycle,
  type MyMeterUpdateService,
} from "../../packages/client/src/update-controller";

describe("MyMeter update controller", () => {
  test("checks the latest version and reports an available update", async () => {
    const service: MyMeterUpdateService = {
      checkLatest: vi.fn(async () => ({
        currentVersion: "0.1.0",
        latestVersion: "0.1.1",
        updateAvailable: true,
      })),
      installVersion: vi.fn(),
    };
    const controller = createMyMeterUpdateController({ service });
    const seen: string[] = [];
    const unsubscribe = controller.subscribe(() => seen.push(controller.getState().status));

    await controller.check();

    expect(seen).toEqual(["checking", "updateAvailable"]);
    expect(controller.getState()).toMatchObject({
      status: "updateAvailable",
      currentVersion: "0.1.0",
      latestVersion: "0.1.1",
    });
    unsubscribe();
  });

  test("reports the installed version when the plugin is already current", async () => {
    const service: MyMeterUpdateService = {
      checkLatest: vi.fn(async () => ({
        currentVersion: "0.1.1",
        latestVersion: "0.1.1",
        updateAvailable: false,
      })),
      installVersion: vi.fn(),
    };
    const controller = createMyMeterUpdateController({ service });

    await controller.check();

    expect(controller.getState()).toMatchObject({
      status: "upToDate",
      currentVersion: "0.1.1",
      latestVersion: "0.1.1",
    });
  });

  test("installs the checked exact version and enters restart-required state", async () => {
    const service: MyMeterUpdateService = {
      checkLatest: vi.fn(async () => ({
        currentVersion: "0.1.0",
        latestVersion: "0.1.1",
        updateAvailable: true,
      })),
      installVersion: vi.fn(async (version) => ({ installedVersion: version })),
    };
    const probe = vi.fn(async () => true);
    const reload = vi.fn();
    const controller = createMyMeterUpdateController({
      service,
      healthProbe: probe,
      delay: async () => new Promise(() => {}),
      reload,
    });

    await controller.check();
    await controller.install();

    expect(service.installVersion).toHaveBeenCalledWith("0.1.1");
    expect(controller.getState()).toMatchObject({
      status: "restartRequired",
      currentVersion: "0.1.0",
      installedVersion: "0.1.1",
      restartPhase: "waitingForOffline",
    });
    expect(reload).not.toHaveBeenCalled();
  });

  test("keeps check and install failures visible", async () => {
    const service: MyMeterUpdateService = {
      checkLatest: vi.fn(async () => {
        throw new Error("registry unavailable");
      }),
      installVersion: vi.fn(),
    };
    const controller = createMyMeterUpdateController({ service });

    await controller.check();
    expect(controller.getState()).toMatchObject({
      status: "failed",
      operation: "check",
      error: "registry unavailable",
    });

    controller.setAvailableUpdate({
      currentVersion: "0.1.0",
      latestVersion: "0.1.1",
    });
    service.installVersion = vi.fn(async () => {
      throw new Error("pnpm failed");
    });

    await controller.install();
    expect(controller.getState()).toMatchObject({
      status: "failed",
      operation: "install",
      error: "pnpm failed",
      latestVersion: "0.1.1",
    });
  });

  test("waits for dsh to go offline before reloading after recovery", async () => {
    const results = [true, true, false, false, true];
    const probe = vi.fn(async () => results.shift() ?? true);
    const reload = vi.fn();
    const phases: string[] = [];

    await waitForDshRestartCycle({
      probe,
      delay: async () => {},
      reload,
      onPhase: (phase) => phases.push(phase),
      maxAttempts: 8,
    });

    expect(phases).toEqual(["waitingForOffline", "offlineObserved", "recovered"]);
    expect(probe).toHaveBeenCalledTimes(5);
    expect(reload).toHaveBeenCalledOnce();
  });

  test("uses the dedicated connection.rpc.call update path and unwraps RpcResult", async () => {
    const call = vi.fn(async (path: string, endpoint: string, payload?: unknown) => {
      expect(path).toBe(MYMETER_UPDATE_RPC_PATH);
      if (endpoint === MYMETER_UPDATE_RPC_ENDPOINTS.checkLatest) {
        return {
          ok: true,
          value: {
            currentVersion: "0.1.0",
            latestVersion: "0.1.1",
            updateAvailable: true,
          },
        };
      }
      if (endpoint === MYMETER_UPDATE_RPC_ENDPOINTS.installVersion) {
        expect(payload).toEqual({ version: "0.1.1" });
        return { ok: true, value: { installedVersion: "0.1.1" } };
      }
      throw new Error(`unexpected endpoint ${endpoint}`);
    });
    const service = createConnectionRpcUpdateService({ rpc: { call } });

    await expect(service.checkLatest()).resolves.toMatchObject({
      currentVersion: "0.1.0",
      latestVersion: "0.1.1",
      updateAvailable: true,
    });
    await expect(service.installVersion("0.1.1")).resolves.toEqual({ installedVersion: "0.1.1" });
    expect(call).toHaveBeenCalledWith(MYMETER_UPDATE_RPC_PATH, MYMETER_UPDATE_RPC_ENDPOINTS.checkLatest, {});
    expect(call).toHaveBeenCalledWith(
      MYMETER_UPDATE_RPC_PATH,
      MYMETER_UPDATE_RPC_ENDPOINTS.installVersion,
      { version: "0.1.1" },
    );
  });

  test("surfaces failed update RpcResult messages", async () => {
    const service = createConnectionRpcUpdateService({
      rpc: {
        call: vi.fn(async () => ({
          ok: false,
          error: { code: "UPDATE_FAILED", message: "registry unavailable", details: {} },
        })),
      },
    });

    await expect(service.checkLatest()).rejects.toThrow("registry unavailable");
  });

  test("times out while waiting for restart and allows a fresh check", async () => {
    const service: MyMeterUpdateService = {
      checkLatest: vi.fn(async () => ({
        currentVersion: "0.1.1",
        latestVersion: "0.1.1",
        updateAvailable: false,
      })),
      installVersion: vi.fn(),
    };
    const controller = createMyMeterUpdateController({ service });

    await expect(waitForDshRestartCycle({
      probe: async () => true,
      delay: async () => {},
      reload: vi.fn(),
      maxAttempts: 2,
    })).rejects.toThrow("等待 dsh 退出超时");

    await controller.check();
    expect(controller.getState().status).toBe("upToDate");
  });

  test.each(["dispose", "reset"] as const)("does not reload after controller %s cancels an old restart watcher", async (action) => {
    let releaseDelay!: () => void;
    const delay = vi.fn(async () => new Promise<void>((resolve) => {
      releaseDelay = resolve;
    }));
    const probe = vi.fn(async () => true);
    const reload = vi.fn();
    const controller = createMyMeterUpdateController({
      service: {
        checkLatest: vi.fn(async () => ({
          currentVersion: "0.1.0",
          latestVersion: "0.1.1",
          updateAvailable: true,
        })),
        installVersion: vi.fn(async () => ({ installedVersion: "0.1.1" })),
      },
      delay,
      healthProbe: probe,
      reload,
    });

    await controller.check();
    await controller.install();
    await vi.waitFor(() => expect(delay).toHaveBeenCalledOnce());
    controller[action]();
    releaseDelay();
    await Promise.resolve();
    await Promise.resolve();

    expect(probe).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
  });
});
