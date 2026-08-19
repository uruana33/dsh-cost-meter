import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const MYMETER_UPDATE_PACKAGE_NAME = "@mymeter/dsh-cost-meter";
export const MYMETER_UPDATE_RPC_CHANNEL = "/mymeter-update";

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
    getManifest?(
      packageName: typeof MYMETER_UPDATE_PACKAGE_NAME,
      version: string,
    ): Promise<MyMeterPackageManifest>;
  };
  readonly installer: {
    installExact(request: MyMeterPluginInstallRequest): Promise<void>;
  };
}

export type MyMeterUpdateRpcResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error:
        | { readonly code: "bad-request"; readonly message: string; readonly details: { readonly issues: readonly unknown[] } }
        | { readonly code: "internal"; readonly message: string; readonly details: object };
    };

export interface MyMeterUpdateRpcContext {
  readonly baseUrl?: string | undefined;
  readonly connection?: {
    readonly rpc?: {
      handle(
        channel: typeof MYMETER_UPDATE_RPC_CHANNEL,
        handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<MyMeterUpdateRpcResult<unknown>>,
        options: { readonly authority: "loopback" },
      ): () => Promise<void> | void;
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

export type PnpmExecFile = (
  file: string,
  args: readonly string[],
  options: { readonly cwd: string },
) => Promise<unknown>;

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

type ParsedVersion = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly string[];
};

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function createMyMeterPluginUpdater(dependencies: MyMeterPluginUpdateDependencies): MyMeterPluginUpdater {
  const profileDir = requireNonEmptyString(dependencies.profileDir, "profileDir");
  let installQueue: Promise<void> = Promise.resolve();

  async function checkForUpdate(): Promise<MyMeterPluginUpdateCheck> {
    const current = await readCurrentPluginVersion(dependencies);
    const latestManifest = await dependencies.registry.getLatestManifest(MYMETER_UPDATE_PACKAGE_NAME);
    validateManifestPackageName(latestManifest, "registry");
    validateDshManifest(latestManifest);
    const latestVersion = readVersion(latestManifest, "registry version");
    return {
      packageName: MYMETER_UPDATE_PACKAGE_NAME,
      currentVersion: current.version,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, current.version) > 0,
      restartRequired: compareVersions(latestVersion, current.version) > 0,
    };
  }

  async function installUpdate(targetVersion: string): Promise<MyMeterPluginInstallResult> {
    const version = parseVersionText(targetVersion, "target version");
    let result!: MyMeterPluginInstallResult;
    installQueue = installQueue.catch(() => {}).then(async () => {
      const current = await readCurrentPluginVersion(dependencies);
      if (compareVersions(version, current.version) <= 0) {
        throw new Error("mymeter update: target version must be newer than current version");
      }
      const manifest = await readTargetManifest(dependencies, version);
      validateManifestPackageName(manifest, "registry");
      validateDshManifest(manifest);
      const manifestVersion = readVersion(manifest, "registry version");
      if (manifestVersion !== version) {
        throw new Error("mymeter update: registry manifest version does not match target version");
      }
      await dependencies.installer.installExact({
        profileDir,
        packageName: MYMETER_UPDATE_PACKAGE_NAME,
        version,
      });
      result = {
        packageName: MYMETER_UPDATE_PACKAGE_NAME,
        installedVersion: version,
        restartRequired: true,
      };
    });
    await installQueue;
    return result;
  }

  return { checkForUpdate, installUpdate };
}

export function createMyMeterProductionUpdateDependencies(
  baseUrl: string,
  options: MyMeterProductionUpdateOptions = {},
): MyMeterPluginUpdateDependencies {
  return {
    profileDir: profileDirFromCordisBaseUrl(baseUrl),
    readCurrentManifest: options.readCurrentManifest ?? createCurrentMyMeterManifestReader(),
    registry: options.registry ?? createMyMeterNpmRegistry({
      fetchImpl: options.fetchImpl,
      registryUrl: options.registryUrl,
      timeoutMs: options.registryTimeoutMs,
    }),
    installer: options.installer ?? createPnpmMyMeterPluginInstaller({ execFile: options.execFile }),
  };
}

export function registerMyMeterUpdateRpc(
  ctx: MyMeterUpdateRpcContext,
  options: MyMeterProductionUpdateOptions = {},
): (() => Promise<void> | void) | null {
  if (!ctx.connection?.rpc || !ctx.baseUrl) return null;
  const updater = createMyMeterPluginUpdater(createMyMeterProductionUpdateDependencies(ctx.baseUrl, options));
  return ctx.connection.rpc.handle(
    MYMETER_UPDATE_RPC_CHANNEL,
    async (endpoint, payload) => dispatchUpdateRpc(updater, endpoint, payload),
    { authority: "loopback" },
  );
}

export function profileDirFromCordisBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== "file:") {
    throw new Error("mymeter update: ctx.baseUrl must be a file baseUrl");
  }
  return stripTrailingSeparator(normalize(fileURLToPath(new URL(".", url))));
}

export function createCurrentMyMeterManifestReader(
  packageJsonUrl: URL | string = new URL("../package.json", import.meta.url),
): () => Promise<MyMeterPackageManifest> {
  return async () => JSON.parse(await readFile(packageJsonUrl, "utf8")) as MyMeterPackageManifest;
}

export function createMyMeterNpmRegistry(options: MyMeterNpmRegistryOptions = {}): MyMeterPluginUpdateDependencies["registry"] {
  const fetchImpl = options.fetchImpl ?? fetch;
  const registryUrl = (options.registryUrl ?? "https://registry.npmjs.org").replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? 5_000;
  return {
    getLatestManifest: (packageName) => readRegistryManifest(fetchImpl, registryUrl, packageName, "latest", timeoutMs),
    getManifest: (packageName, version) => readRegistryManifest(fetchImpl, registryUrl, packageName, version, timeoutMs),
  };
}

export function createPnpmMyMeterPluginInstaller(
  options: PnpmMyMeterPluginInstallerOptions = {},
): MyMeterPluginUpdateDependencies["installer"] {
  const execFile = options.execFile ?? defaultPnpmExecFile;
  return {
    async installExact(request) {
      if (request.packageName !== MYMETER_UPDATE_PACKAGE_NAME) {
        throw new Error("mymeter update: invalid install package name");
      }
      const profileDir = requireNonEmptyString(request.profileDir, "profileDir");
      const version = parseVersionText(request.version, "target version");
      try {
        await execFile("pnpm", ["add", "--save-exact", `${MYMETER_UPDATE_PACKAGE_NAME}@${version}`], { cwd: profileDir });
      } catch {
        throw new Error("mymeter update: plugin installation failed");
      }
    },
  };
}

async function dispatchUpdateRpc(
  updater: MyMeterPluginUpdater,
  endpoint: string,
  payload: unknown,
): Promise<MyMeterUpdateRpcResult<unknown>> {
  try {
    if (endpoint === "check") return { ok: true, value: await updater.checkForUpdate() };
    if (endpoint === "install") {
      const request = asRecord(payload);
      if (typeof request?.version !== "string") {
        return badRequest("mymeter update: install requires an exact version");
      }
      return { ok: true, value: await updater.installUpdate(request.version) };
    }
    return badRequest("mymeter update: unknown endpoint");
  } catch (error) {
    return internalError(error instanceof Error ? error.message : "mymeter update failed");
  }
}

async function readRegistryManifest(
  fetchImpl: typeof fetch,
  registryUrl: string,
  packageName: typeof MYMETER_UPDATE_PACKAGE_NAME,
  version: string,
  timeoutMs: number,
): Promise<MyMeterPackageManifest> {
  const timeout = createTimeoutSignal(timeoutMs);
  try {
    const response = await fetchImpl(`${registryUrl}/${encodeURIComponent(packageName)}/${version}`, {
      headers: { accept: "application/json" },
      signal: timeout.signal,
    });
    if (!response.ok) {
      throw new Error("status");
    }
    return await response.json() as MyMeterPackageManifest;
  } catch (error) {
    if (timeout.signal.aborted || isAbortError(error)) {
      throw new Error("mymeter update: registry request timed out");
    }
    throw new Error("mymeter update: registry request failed");
  } finally {
    timeout.dispose();
  }
}

function createTimeoutSignal(timeoutMs: number): { readonly signal: AbortSignal; dispose(): void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
    },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

const execFileAsync = promisify(execFileCallback);

const defaultPnpmExecFile: PnpmExecFile = async (file, args, options) => {
  await execFileAsync(file, [...args], options);
};

function badRequest(message: string): MyMeterUpdateRpcResult<never> {
  return { ok: false, error: { code: "bad-request", message, details: { issues: [] } } };
}

function internalError(message: string): MyMeterUpdateRpcResult<never> {
  return { ok: false, error: { code: "internal", message, details: {} } };
}

async function readCurrentPluginVersion(
  dependencies: MyMeterPluginUpdateDependencies,
): Promise<{ readonly version: string }> {
  const currentManifest = await dependencies.readCurrentManifest();
  validateManifestPackageName(currentManifest, "current");
  validateDshManifest(currentManifest);
  return {
    version: readVersion(currentManifest, "current version"),
  };
}

async function readTargetManifest(
  dependencies: MyMeterPluginUpdateDependencies,
  version: string,
): Promise<MyMeterPackageManifest> {
  if (dependencies.registry.getManifest) {
    return dependencies.registry.getManifest(MYMETER_UPDATE_PACKAGE_NAME, version);
  }
  const manifest = await dependencies.registry.getLatestManifest(MYMETER_UPDATE_PACKAGE_NAME);
  const latestVersion = readVersion(manifest, "registry version");
  if (latestVersion !== version) {
    throw new Error("mymeter update: registry cannot verify target version");
  }
  return manifest;
}

function validateManifestPackageName(manifest: MyMeterPackageManifest, source: "current" | "registry"): void {
  if (manifest.name !== undefined && manifest.name !== MYMETER_UPDATE_PACKAGE_NAME) {
    throw new Error(`mymeter update: invalid ${source} package name`);
  }
}

function validateDshManifest(manifest: MyMeterPackageManifest): void {
  const dsh = asRecord(manifest.dsh);
  const client = asRecord(dsh?.client);
  const bundle = asRecord(dsh?.bundle);
  if (!client) throw new Error("mymeter update: missing dsh.client");
  if (!bundle) throw new Error("mymeter update: missing dsh.bundle");
  if (typeof client.platform !== "string" || client.platform.length === 0) {
    throw new Error("mymeter update: invalid dsh.client");
  }
  if (typeof bundle.patch !== "string" || bundle.patch.length === 0) {
    throw new Error("mymeter update: invalid dsh.bundle");
  }
}

function readVersion(manifest: MyMeterPackageManifest, label: string): string {
  if (typeof manifest.version !== "string") {
    throw new Error(`mymeter update: invalid ${label}`);
  }
  return parseVersionText(manifest.version, label);
}

function parseVersionText(version: string, label: string): string {
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`mymeter update: invalid ${label}`);
  }
  return version;
}

function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  return (
    compareNumber(a.major, b.major)
    || compareNumber(a.minor, b.minor)
    || compareNumber(a.patch, b.patch)
    || comparePrerelease(a.prerelease, b.prerelease)
  );
}

function parseVersion(version: string): ParsedVersion {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) throw new Error("mymeter update: invalid version");
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split(".") ?? [],
  };
}

function compareNumber(left: number, right: number): number {
  return left === right ? 0 : left > right ? 1 : -1;
}

function comparePrerelease(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    const comparison = comparePrereleaseIdentifier(a, b);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function comparePrereleaseIdentifier(left: string, right: string): number {
  const leftNumber = /^\d+$/.test(left) ? Number(left) : null;
  const rightNumber = /^\d+$/.test(right) ? Number(right) : null;
  if (leftNumber !== null && rightNumber !== null) return compareNumber(leftNumber, rightNumber);
  if (leftNumber !== null) return -1;
  if (rightNumber !== null) return 1;
  return left === right ? 0 : left > right ? 1 : -1;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: string, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`mymeter update: invalid ${label}`);
  }
  return value;
}

function stripTrailingSeparator(value: string): string {
  if (value.length <= 1) return value;
  return value.replace(/[\\/]+$/, "");
}
