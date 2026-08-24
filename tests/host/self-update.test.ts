import { expect, test } from "vitest";
import { pathToFileURL } from "node:url";

import {
  MYMETER_UPDATE_PACKAGE_NAME,
  MYMETER_UPDATE_RPC_CHANNEL,
  createMyMeterNpmRegistry,
  createMyMeterPluginUpdater,
  createPnpmMyMeterPluginInstaller,
  profileDirFromCordisBaseUrl,
  type MyMeterPackageManifest,
  type MyMeterPluginUpdateDependencies,
} from "../../packages/plugin/src/self-update";
import {
  apply as applyCordisHost,
  type MyMeterTypertHostContext,
} from "../../packages/plugin/src/cordis-host";

const currentManifest: MyMeterPackageManifest = {
  name: MYMETER_UPDATE_PACKAGE_NAME,
  version: "0.1.0",
  dsh: {
    client: {
      inject: ["@deepseek-ai/dsh-client-runtime"],
      platform: "web",
    },
    bundle: {
      patch: "./cordis.patch.yml",
    },
  },
};

const latestManifest: MyMeterPackageManifest = {
  ...currentManifest,
  version: "0.2.0",
};

test("checks the fixed MyMeter package and reports a newer valid release", async () => {
  const requestedPackages: string[] = [];
  const updater = createMyMeterPluginUpdater({
    profileDir: "/profiles/main",
    readCurrentManifest: async () => currentManifest,
    registry: {
      getLatestManifest: async (packageName) => {
        requestedPackages.push(packageName);
        return latestManifest;
      },
    },
    installer: neverInstall,
  });

  await expect(updater.checkForUpdate()).resolves.toEqual({
    packageName: MYMETER_UPDATE_PACKAGE_NAME,
    currentVersion: "0.1.0",
    latestVersion: "0.2.0",
    updateAvailable: true,
    restartRequired: true,
  });
  expect(requestedPackages).toEqual([MYMETER_UPDATE_PACKAGE_NAME]);
});

test("reports no update when the registry version is not newer", async () => {
  const updater = createMyMeterPluginUpdater({
    profileDir: "/profiles/main",
    readCurrentManifest: async () => currentManifest,
    registry: {
      getLatestManifest: async () => ({ ...currentManifest }),
    },
    installer: neverInstall,
  });

  await expect(updater.checkForUpdate()).resolves.toMatchObject({
    currentVersion: "0.1.0",
    latestVersion: "0.1.0",
    updateAvailable: false,
    restartRequired: false,
  });
});

test("rejects non-semver current and latest versions", async () => {
  const invalidCurrent = createMyMeterPluginUpdater({
    profileDir: "/profiles/main",
    readCurrentManifest: async () => ({ ...currentManifest, version: "latest" }),
    registry: {
      getLatestManifest: async () => latestManifest,
    },
    installer: neverInstall,
  });
  await expect(invalidCurrent.checkForUpdate()).rejects.toThrow("invalid current version");

  const invalidLatest = createMyMeterPluginUpdater({
    profileDir: "/profiles/main",
    readCurrentManifest: async () => currentManifest,
    registry: {
      getLatestManifest: async () => ({ ...latestManifest, version: "next" }),
    },
    installer: neverInstall,
  });
  await expect(invalidLatest.checkForUpdate()).rejects.toThrow("invalid registry version");
});

test("rejects registry manifests that are not a dsh client and host bundle package", async () => {
  const updater = createMyMeterPluginUpdater({
    profileDir: "/profiles/main",
    readCurrentManifest: async () => currentManifest,
    registry: {
      getLatestManifest: async () => ({
        name: MYMETER_UPDATE_PACKAGE_NAME,
        version: "0.2.0",
        dsh: {
          client: { platform: "web" },
        },
      }),
    },
    installer: neverInstall,
  });

  await expect(updater.checkForUpdate()).rejects.toThrow("missing dsh.bundle");
});

test("installs only the fixed package at an exact validated version into the injected profile directory", async () => {
  const installs: Parameters<MyMeterPluginUpdateDependencies["installer"]["installExact"]>[0][] = [];
  const updater = createMyMeterPluginUpdater({
    profileDir: "/profiles/main",
    readCurrentManifest: async () => currentManifest,
    registry: {
      getLatestManifest: async () => latestManifest,
      getManifest: async () => latestManifest,
    },
    installer: {
      installExact: async (request) => {
        installs.push(request);
      },
    },
  });

  await expect(updater.installUpdate("0.2.0")).resolves.toEqual({
    packageName: MYMETER_UPDATE_PACKAGE_NAME,
    installedVersion: "0.2.0",
    restartRequired: true,
  });
  expect(installs).toEqual([{
    profileDir: "/profiles/main",
    packageName: MYMETER_UPDATE_PACKAGE_NAME,
    version: "0.2.0",
  }]);
});

test("serializes concurrent installs", async () => {
  const order: string[] = [];
  let releaseFirstInstall!: () => void;
  const updater = createMyMeterPluginUpdater({
    profileDir: "/profiles/main",
    readCurrentManifest: async () => currentManifest,
    registry: {
      getLatestManifest: async () => latestManifest,
      getManifest: async () => latestManifest,
    },
    installer: {
      installExact: async () => {
        order.push("start");
        if (order.length === 1) {
          await new Promise<void>((resolve) => {
            releaseFirstInstall = resolve;
          });
        }
        order.push("finish");
      },
    },
  });

  const first = updater.installUpdate("0.2.0");
  await waitFor(() => expect(order).toEqual(["start"]));
  const second = updater.installUpdate("0.2.0");
  await Promise.resolve();
  expect(order).toEqual(["start"]);

  releaseFirstInstall();
  await Promise.all([first, second]);
  expect(order).toEqual(["start", "finish", "start", "finish"]);
});

test("does not invoke the installer for arbitrary version-like command input", async () => {
  const installs: unknown[] = [];
  const updater = createMyMeterPluginUpdater({
    profileDir: "/profiles/main",
    readCurrentManifest: async () => currentManifest,
    registry: {
      getLatestManifest: async () => latestManifest,
      getManifest: async () => latestManifest,
    },
    installer: {
      installExact: async (request) => {
        installs.push(request);
      },
    },
  });

  await expect(updater.installUpdate("0.2.0 && rm -rf /")).rejects.toThrow("invalid target version");
  expect(installs).toEqual([]);
});

test("registers a loopback-only update RPC and derives profileDir from ctx.baseUrl", async () => {
  const profileDir = "/profiles/main";
  const installs: Parameters<MyMeterPluginUpdateDependencies["installer"]["installExact"]>[0][] = [];
  const ctx = new FakeUpdateHostContext(`${pathToFileURL(profileDir).href}/`);

  const uninstall = applyCordisHost(ctx, {
    update: {
      readCurrentManifest: async () => currentManifest,
      registry: {
        getLatestManifest: async () => latestManifest,
        getManifest: async () => latestManifest,
      },
      installer: {
        installExact: async (request) => {
          installs.push(request);
        },
      },
    },
  });

  expect(ctx.registeredRpc).toMatchObject({
    channel: MYMETER_UPDATE_RPC_CHANNEL,
    options: { authority: "loopback" },
  });

  await expect(ctx.call("check", {})).resolves.toMatchObject({
    ok: true,
    value: {
      packageName: MYMETER_UPDATE_PACKAGE_NAME,
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
      updateAvailable: true,
      restartRequired: true,
    },
  });
  await expect(ctx.call("install", { version: "0.2.0" })).resolves.toMatchObject({
    ok: true,
    value: {
      packageName: MYMETER_UPDATE_PACKAGE_NAME,
      installedVersion: "0.2.0",
      restartRequired: true,
    },
  });
  expect(installs).toEqual([{
    profileDir,
    packageName: MYMETER_UPDATE_PACKAGE_NAME,
    version: "0.2.0",
  }]);

  await expect(ctx.call("unknown", {})).resolves.toEqual({
    ok: false,
    error: {
      code: "bad-request",
      message: "mymeter update: unknown endpoint",
      details: { issues: [] },
    },
  });

  await uninstall();
  expect(ctx.rpcDisposed).toBe(true);
});

test("derives the profile directory from Cordis file baseUrl only", () => {
  expect(profileDirFromCordisBaseUrl("file:///tmp/dsh-profile/")).toBe("/tmp/dsh-profile");
  expect(profileDirFromCordisBaseUrl("file:///tmp/dsh-profile/cordis.yml")).toBe("/tmp/dsh-profile");
  expect(() => profileDirFromCordisBaseUrl("https://example.test/profile/")).toThrow("file baseUrl");
});

test("production pnpm installer uses fixed exact package arguments in the injected profile directory", async () => {
  const calls: unknown[] = [];
  const installer = createPnpmMyMeterPluginInstaller({
    execFile: async (file, args, options) => {
      calls.push({ file, args, options });
    },
  });

  await installer.installExact({
    profileDir: "/profiles/main",
    packageName: MYMETER_UPDATE_PACKAGE_NAME,
    version: "0.2.0",
  });

  expect(calls).toEqual([{
    file: "pnpm",
    args: ["add", "--save-exact", "@mymeter/dsh-cost-meter@0.2.0"],
    options: { cwd: "/profiles/main" },
  }]);
});

test("production pnpm installer does not expose raw process errors", async () => {
  const installer = createPnpmMyMeterPluginInstaller({
    execFile: async () => {
      throw new Error("private profile path and pnpm stderr");
    },
  });

  await expect(installer.installExact({
    profileDir: "/profiles/main",
    packageName: MYMETER_UPDATE_PACKAGE_NAME,
    version: "0.2.0",
  })).rejects.toThrow("plugin installation failed");
  await expect(installer.installExact({
    profileDir: "/profiles/main",
    packageName: MYMETER_UPDATE_PACKAGE_NAME,
    version: "0.2.0",
  })).rejects.not.toThrow("private profile path");
});

test("registry adapter folds timeout and fetch errors", async () => {
  const timeoutRegistry = createMyMeterNpmRegistry({
    timeoutMs: 1,
    fetchImpl: async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }),
  });
  await expect(timeoutRegistry.getLatestManifest(MYMETER_UPDATE_PACKAGE_NAME))
    .rejects.toThrow("registry request timed out");

  const failingRegistry = createMyMeterNpmRegistry({
    fetchImpl: async () => {
      throw new Error("raw network details");
    },
  });
  await expect(failingRegistry.getLatestManifest(MYMETER_UPDATE_PACKAGE_NAME))
    .rejects.toThrow("registry request failed");
  await expect(failingRegistry.getLatestManifest(MYMETER_UPDATE_PACKAGE_NAME))
    .rejects.not.toThrow("raw network details");
});

const neverInstall: MyMeterPluginUpdateDependencies["installer"] = {
  installExact: async () => {
    throw new Error("unexpected install");
  },
};

async function waitFor(assertion: () => void): Promise<void> {
  const deadline = Date.now() + 500;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  if (lastError) throw lastError;
}

type RpcResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly details: object } };

class FakeUpdateHostContext implements MyMeterTypertHostContext {
  readonly registeredSettingsNamespaces: string[] = [];
  readonly services = new Map<string, object>();
  registeredContribution = null;
  registeredRpc: {
    channel: string;
    handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RpcResult<unknown>>;
    options: { authority: "trusted-host" | "loopback" };
  } | null = null;
  rpcDisposed = false;

  constructor(readonly baseUrl: string) {}

  readonly connection = {
    rpc: {
      handle: (
        channel: string,
        handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RpcResult<unknown>>,
        options: { authority: "trusted-host" | "loopback" },
      ) => {
        this.registeredRpc = { channel, handler, options };
        return async () => {
          this.rpcDisposed = true;
        };
      },
    },
  };

  readonly settings = {
    get: () => ({}),
    register: (namespace: string) => {
      this.registeredSettingsNamespaces.push(namespace);
    },
  };

  readonly reflect = {
    provide: (key: string, service: object) => {
      this.services.set(key, service);
      return () => {
        this.services.delete(key);
      };
    },
  };

  readonly typert = {
    register: () => () => {},
  };

  readonly llm = {
    listProviders: () => [],
  };

  on(): () => void {
    return () => {};
  }

  async call(endpoint: string, payload: unknown): Promise<RpcResult<unknown>> {
    if (!this.registeredRpc) throw new Error("RPC was not registered");
    return this.registeredRpc.handler(endpoint, payload, new AbortController().signal);
  }
}
