import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = resolve(root, "packages/plugin");
const outDir = resolve(pluginRoot, "lib");
const execFileAsync = promisify(execFile);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await Promise.all([
  build({
    absWorkingDir: root,
    entryPoints: [resolve(pluginRoot, "src/cordis-host.ts")],
    outfile: resolve(outDir, "index.js"),
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    sourcemap: false,
    external: ["react", "react/jsx-runtime"],
    logLevel: "info",
  }),
  build({
    absWorkingDir: root,
    entryPoints: [resolve(pluginRoot, "src/cordis-client.tsx")],
    outfile: resolve(outDir, "client.js"),
    bundle: true,
    format: "cjs",
    platform: "browser",
    target: ["es2022"],
    sourcemap: false,
    external: ["react", "react/jsx-runtime"],
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
    },
    banner: {
      js: 'window.__ModuleLoader__.load({ id: "@mymeter/dsh-cost-meter", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
    },
    footer: {
      js: "return module.exports; } });",
    },
    logLevel: "info",
  }),
  build({
    absWorkingDir: root,
    entryPoints: [resolve(pluginRoot, "src/invariant.ts")],
    outfile: resolve(outDir, "invariant.js"),
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    sourcemap: false,
    logLevel: "info",
  }),
  build({
    absWorkingDir: root,
    entryPoints: [resolve(pluginRoot, "src/typert-remote.ts")],
    outfile: resolve(outDir, "remote.js"),
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: ["es2022"],
    sourcemap: false,
    logLevel: "info",
  }),
]);

await execFileAsync(process.execPath, [
  resolve(root, "node_modules/typescript/bin/tsc"),
  "--project",
  resolve(root, "tsconfig.types.json"),
]);
