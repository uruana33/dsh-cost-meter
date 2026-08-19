import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = resolve(root, "packages/plugin");
const manifest = JSON.parse(await readFile(resolve(pluginRoot, "package.json"), "utf8"));
const requiredPublishedFiles = [
  "LICENSE",
  "README.md",
  "cordis.patch.yml",
  "lib/types/plugin/src/cordis-host.d.ts",
  "lib/types/plugin/src/cordis-client.d.ts",
  "lib/types/plugin/src/typert-remote.d.ts",
  "lib/types/plugin/src/invariant.d.ts",
  "lib/types/plugin/src/history-recovery.d.ts",
  "lib/types/host/src/index.d.ts",
  "lib/types/host/src/ledger-format.d.ts",
  "lib/types/host/src/recovery-checkpoint.d.ts",
  "lib/types/client/src/index.d.ts",
  "lib/types/shared/src/index.d.ts",
  "lib/types/core/src/index.d.ts",
];

if (manifest.name !== "@mymeter/dsh-cost-meter") throw new Error("unexpected plugin package name");
if (manifest.private === true) throw new Error("publishable plugin is marked private");
if (manifest.publishConfig?.access !== "public") throw new Error("public access is not declared");

for (const target of exportTargets(manifest)) {
  if (!existsSync(resolve(pluginRoot, target))) throw new Error(`missing exported artifact: ${target}`);
}

const rootTarball = resolve(root, packageTarballFileName(manifest));
if (!existsSync(rootTarball)) {
  throw new Error(`missing current root tarball: ${packageTarballFileName(manifest)}`);
}

const temporary = await mkdtemp(resolve(tmpdir(), "dsh-cost-meter-package-"));
try {
  const { stdout } = await execFileAsync("npm", [
    "pack",
    pluginRoot,
    "--ignore-scripts",
    "--pack-destination",
    temporary,
    "--json",
  ], { cwd: root });
  const packed = JSON.parse(stdout)[0];
  if (!packed?.filename) throw new Error("npm pack did not return a tarball");
  const paths = packed.files.map((entry) => entry.path);
  if (paths.some((entry) => entry.startsWith("src/") || entry.endsWith(".map"))) {
    throw new Error("tarball contains source files or source maps");
  }
  for (const requiredPath of requiredPackagePaths(manifest)) {
    if (!paths.includes(requiredPath)) {
      throw new Error(`tarball missing required published file: ${requiredPath}`);
    }
  }

  const currentPack = resolve(temporary, packed.filename);
  await assertTarballContentsMatch(rootTarball, currentPack, temporary);

  const unpackRoot = resolve(temporary, "unpacked");
  await mkdir(unpackRoot);
  await execFileAsync("tar", ["-xzf", currentPack, "-C", unpackRoot]);
  const consumer = resolve(temporary, "consumer");
  const modules = resolve(consumer, "node_modules");
  await mkdir(resolve(modules, "@mymeter"), { recursive: true });
  await symlink(resolve(unpackRoot, "package"), resolve(modules, "@mymeter/dsh-cost-meter"));
  await symlink(resolve(root, "node_modules/react"), resolve(modules, "react"));
  await mkdir(resolve(modules, "@types"), { recursive: true });
  await symlink(resolve(root, "node_modules/@types/react"), resolve(modules, "@types/react"));
  if (existsSync(resolve(root, "node_modules/@types/prop-types"))) {
    await symlink(resolve(root, "node_modules/@types/prop-types"), resolve(modules, "@types/prop-types"));
  }
  if (existsSync(resolve(root, "node_modules/csstype"))) {
    await symlink(resolve(root, "node_modules/csstype"), resolve(modules, "csstype"));
  }
  await writeFile(resolve(consumer, "index.ts"), [
    'import type { MyMeterCordisContext, MyMeterCordisHostConfig } from "@mymeter/dsh-cost-meter";',
    'import type { MyMeterCordisHostConfig as HostEntryConfig, MyMeterCordisHostOptions } from "@mymeter/dsh-cost-meter/host";',
    'import type {} from "@mymeter/dsh-cost-meter/client";',
    'import type {} from "@mymeter/dsh-cost-meter/remote";',
    "declare const ctx: MyMeterCordisContext;",
    "const appendPluginConfig = {",
    '  ledgerPath: "ledger.json",',
    '  ledgerFormat: "append",',
    "  balanceEnabled: false,",
    "} satisfies MyMeterCordisHostConfig;",
    "const defaultJsonPluginConfig = {",
    '  ledgerPath: "ledger.json",',
    "  balanceEnabled: false,",
    "} satisfies MyMeterCordisHostConfig;",
    "const appendHostConfig = {",
    '  ledgerPath: "ledger.json",',
    '  ledgerFormat: "append",',
    "} satisfies HostEntryConfig;",
    "const defaultJsonHostOptions = {",
    "  ctx,",
    '  ledgerPath: "ledger.json",',
    "} satisfies MyMeterCordisHostOptions;",
    "void appendPluginConfig;",
    "void defaultJsonPluginConfig;",
    "void appendHostConfig;",
    "void defaultJsonHostOptions;",
    "export {};",
  ].join("\n"));
  await execFileAsync(process.execPath, [
    resolve(root, "node_modules/typescript/bin/tsc"),
    "--noEmit",
    "--preserveSymlinks",
    "--target",
    "ES2022",
    "--module",
    "ESNext",
    "--moduleResolution",
    "Bundler",
    resolve(consumer, "index.ts"),
  ], { cwd: consumer });
  await execFileAsync(process.execPath, [
    "--preserve-symlinks",
    "--input-type=module",
    "--eval",
    'await import("@mymeter/dsh-cost-meter")',
  ], { cwd: consumer });
} finally {
  await rm(temporary, { recursive: true, force: true });
}

function requiredPackagePaths(packageJson) {
  const paths = new Set(requiredPublishedFiles);
  for (const target of exportTargets(packageJson)) {
    paths.add(target.replace(/^\.\//, ""));
  }
  return [...paths].sort();
}

function exportTargets(packageJson) {
  const targets = new Set([packageJson.main, packageJson.types]);
  for (const value of Object.values(packageJson.exports ?? {})) {
    if (typeof value === "string") targets.add(value);
    else {
      if (value.default) targets.add(value.default);
      if (value.types) targets.add(value.types);
    }
  }
  return [...targets].filter((value) => typeof value === "string" && value.startsWith("./"));
}

function packageTarballFileName(packageJson) {
  const name = String(packageJson.name ?? "");
  const version = String(packageJson.version ?? "");
  if (!name || !version) throw new Error("package name/version missing");
  const baseName = name.startsWith("@") ? name.slice(1).replace("/", "-") : name;
  return `${baseName}-${version}.tgz`;
}

async function assertTarballContentsMatch(expectedTarball, actualTarball, temporaryRoot) {
  const expectedRoot = resolve(temporaryRoot, "root-tarball");
  const actualRoot = resolve(temporaryRoot, "temporary-pack");
  await mkdir(expectedRoot);
  await mkdir(actualRoot);
  await execFileAsync("tar", ["-xzf", expectedTarball, "-C", expectedRoot]);
  await execFileAsync("tar", ["-xzf", actualTarball, "-C", actualRoot]);

  const expectedFiles = await packageFileHashes(resolve(expectedRoot, "package"));
  const actualFiles = await packageFileHashes(resolve(actualRoot, "package"));
  const expectedPaths = [...expectedFiles.keys()].sort();
  const actualPaths = [...actualFiles.keys()].sort();

  const missing = actualPaths.filter((entry) => !expectedFiles.has(entry));
  const extra = expectedPaths.filter((entry) => !actualFiles.has(entry));
  const changed = actualPaths.filter((entry) =>
    expectedFiles.has(entry) && expectedFiles.get(entry) !== actualFiles.get(entry));
  if (missing.length > 0 || extra.length > 0 || changed.length > 0) {
    throw new Error([
      `root tarball ${packageTarballFileName(manifest)} does not match current npm pack output`,
      missing.length ? `missing from root tarball: ${missing.join(", ")}` : null,
      extra.length ? `extra in root tarball: ${extra.join(", ")}` : null,
      changed.length ? `content differs: ${changed.join(", ")}` : null,
    ].filter(Boolean).join("\n"));
  }
}

async function packageFileHashes(directory) {
  const files = new Map();
  await collectFileHashes(directory, "", files);
  return files;
}

async function collectFileHashes(directory, prefix, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFileHashes(absolutePath, relativePath, files);
    } else if (entry.isFile()) {
      const contents = await readFile(absolutePath);
      files.set(relativePath, createHash("sha256").update(contents).digest("hex"));
    }
  }
}
