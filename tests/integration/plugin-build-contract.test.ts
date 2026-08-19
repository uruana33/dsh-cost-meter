import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../..");

test("plugin manifest exposes dsh client services and built entry exports", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "packages/plugin/package.json"), "utf8")) as {
    name: string;
    private?: boolean;
    types?: string;
    publishConfig?: { access?: string };
    exports: Record<string, { default?: string; types?: string } | string>;
    dsh: { client: { inject: string[]; platform: string } };
    files: string[];
  };

  expect(manifest.name).toBe("@mymeter/dsh-cost-meter");
  expect(manifest.private).not.toBe(true);
  expect(manifest.publishConfig).toEqual({ access: "public" });
  expect(manifest.types).toMatch(/^\.\/lib\/types\/.+\.d\.ts$/);
  expect(manifest.exports["."]).toMatchObject({
    default: "./lib/index.js",
    types: expect.stringMatching(/^\.\/lib\/types\/.+\.d\.ts$/),
  });
  expect(manifest.exports["./invariant"]).toMatchObject({
    default: "./lib/invariant.js",
    types: expect.stringMatching(/^\.\/lib\/types\/.+\.d\.ts$/),
  });
  expect(manifest.exports["./client"]).toMatchObject({
    default: "./lib/client.js",
    types: expect.stringMatching(/^\.\/lib\/types\/.+\.d\.ts$/),
  });
  expect(manifest.exports["./remote"]).toMatchObject({
    default: "./lib/remote.js",
    types: expect.stringMatching(/^\.\/lib\/types\/.+\.d\.ts$/),
  });
  expect(manifest.files).toContain("lib/types/**/*.d.ts");
  expect(manifest.files.some((entry) => entry.startsWith("src/"))).toBe(false);
  expect(manifest.files.some((entry) => entry.endsWith(".map"))).toBe(false);
  expect(manifest.dsh.client).toEqual({
    inject: [
      "@deepseek-ai/dsh-client-runtime",
      "@deepseek-ai/dsh-api-remotes",
      "@deepseek-ai/dsh-client-ui-layout",
      "@deepseek-ai/dsh-client-ui-settings-plugins",
      "@deepseek-ai/dsh-client-ui-conversation",
    ],
    platform: "web",
  });
});

test("production bundle does not mount the test-only invariant entry", () => {
  const patch = readFileSync(resolve(root, "packages/plugin/cordis.patch.yml"), "utf8");

  expect(patch).toContain("name: '@mymeter/dsh-cost-meter'");
  expect(patch).not.toContain("@mymeter/dsh-cost-meter/invariant");
  expect(patch).not.toContain("ledgerFormat");
  expect(patch).not.toMatch(/\bappend\b/);
});

test("plugin client bundle is emitted for dsh ModuleLoader instead of ESM top-level imports", () => {
  const buildScript = readFileSync(resolve(root, "scripts/build-plugin.mjs"), "utf8");
  expect(buildScript).toContain("window.__ModuleLoader__.load");
  expect(buildScript).toContain('format: "cjs"');
  expect(buildScript).toContain('external: ["react", "react/jsx-runtime"]');

  const clientBundle = resolve(root, "packages/plugin/lib/client.js");
  expect(existsSync(clientBundle)).toBe(true);

  const client = readFileSync(clientBundle, "utf8");
  expect(client.startsWith('window.__ModuleLoader__.load({ id: "@mymeter/dsh-cost-meter"')).toBe(true);
  expect(client).not.toMatch(/^import\s/m);
  expect(client).toContain('require("react")');
  expect(client).toContain('require("react/jsx-runtime")');
  expect(client).not.toContain("DEEPSEEK_API_KEY");
  expect(client).not.toContain("Authorization");
  expect(client).not.toContain("sourceMappingURL");
  expect(client).not.toContain("setOverlayCollapsed(!isCollapsed)");
  expect(client).not.toContain('width: isCollapsed ? "fit-content" : 400');
});

test("plugin host bundle preserves the optional session projections injection boundary", () => {
  const hostBundle = resolve(root, "packages/plugin/lib/index.js");
  expect(existsSync(hostBundle)).toBe(true);

  const host = readFileSync(hostBundle, "utf8");
  expect(host).toContain('ctx.inject(["sessionProjections"]');
  expect(host).toContain("captureOptionalProjectionService(ctx");
});

test("plugin host bundle exposes the session cost tree helper", () => {
  const hostBundle = resolve(root, "packages/plugin/lib/index.js");
  const hostTypes = resolve(root, "packages/plugin/lib/types/plugin/src/cordis-host.d.ts");
  expect(existsSync(hostBundle)).toBe(true);
  expect(existsSync(hostTypes)).toBe(true);

  const host = readFileSync(hostBundle, "utf8");
  const types = readFileSync(hostTypes, "utf8");
  expect(host).toContain("buildSessionCostTree");
  expect(types).toContain("buildSessionCostTree");
});
