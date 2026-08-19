import { createHash } from "node:crypto";
import { expect, test, vi } from "vitest";

import { runRemotePricingUpdate } from "../../packages/host/src";
import type { RemotePricingTrustedKey } from "../../packages/core/src/pricing/remote-update";

const trustedKeys: readonly RemotePricingTrustedKey[] = [
  { keyId: "primary", algorithm: "ed25519", publicKey: "mock-public-key" },
];

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function signedManifest(options: {
  manifestVersion?: string;
  catalogBody?: string;
  catalogUrl?: string;
  signature?: string;
} = {}) {
  const catalogBody = options.catalogBody ?? JSON.stringify({ provider: "deepseek", models: {} });
  return {
    schemaVersion: 1,
    manifestVersion: options.manifestVersion ?? "1.1.0",
    issuedAt: "2026-08-19T00:00:00.000Z",
    catalogs: [
      {
        provider: "deepseek",
        priceVersion: "deepseek-remote-2026-08-19",
        url: options.catalogUrl ?? "https://prices.example.test/deepseek.json",
        sha256: digest(catalogBody),
      },
    ],
    signatures: [{ keyId: "primary", algorithm: "ed25519", value: options.signature ?? "valid" }],
  };
}

test("downloads, verifies, and activates a newer remote pricing catalog bundle", async () => {
  const catalogBody = JSON.stringify({ provider: "deepseek", priceVersion: "remote-v1" });
  const requests: string[] = [];
  const activate = vi.fn();

  const result = await runRemotePricingUpdate({
    manifestUrl: "https://prices.example.test/manifest.json",
    activeManifestVersion: "1.0.0",
    trustedKeys,
    verifySignature: ({ signature }) => signature === "valid",
    fetchImpl: async (url) => {
      requests.push(String(url));
      if (String(url) === "https://prices.example.test/manifest.json") {
        return new Response(JSON.stringify(signedManifest({ catalogBody })));
      }
      return new Response(catalogBody);
    },
    activate,
  });

  expect(result.action).toBe("committed");
  expect(requests).toEqual([
    "https://prices.example.test/manifest.json",
    "https://prices.example.test/deepseek.json",
  ]);
  expect(activate).toHaveBeenCalledTimes(1);
  expect(activate.mock.calls[0]?.[0]).toMatchObject({
    manifest: { manifestVersion: "1.1.0" },
    catalogs: [{ provider: "deepseek", priceVersion: "deepseek-remote-2026-08-19" }],
  });
});

test("does not activate when a catalog digest does not match the manifest descriptor", async () => {
  const activate = vi.fn();

  const result = await runRemotePricingUpdate({
    manifestUrl: "https://prices.example.test/manifest.json",
    activeManifestVersion: "1.0.0",
    trustedKeys,
    verifySignature: ({ signature }) => signature === "valid",
    fetchImpl: async (url) => {
      if (String(url) === "https://prices.example.test/manifest.json") {
        return new Response(JSON.stringify(signedManifest({ catalogBody: "expected" })));
      }
      return new Response("tampered");
    },
    activate,
  });

  expect(result).toMatchObject({
    action: "rolled-back",
    activeManifestVersion: "1.0.0",
    rejectedManifestVersion: "1.1.0",
  });
  expect(result.action === "rolled-back" ? result.reason : "").toMatch(/sha256/i);
  expect(activate).not.toHaveBeenCalled();
});

test("does not download catalogs when the verified manifest is rejected by version policy", async () => {
  const requests: string[] = [];
  const activate = vi.fn();

  const result = await runRemotePricingUpdate({
    manifestUrl: "https://prices.example.test/manifest.json",
    activeManifestVersion: "1.1.0",
    trustedKeys,
    verifySignature: ({ signature }) => signature === "valid",
    fetchImpl: async (url) => {
      requests.push(String(url));
      return new Response(JSON.stringify(signedManifest()));
    },
    activate,
  });

  expect(result).toEqual({
    action: "not-applied",
    activeManifestVersion: "1.1.0",
    reason: "not-newer",
  });
  expect(requests).toEqual(["https://prices.example.test/manifest.json"]);
  expect(activate).not.toHaveBeenCalled();
});

test("rolls back when activation fails after every catalog has been verified", async () => {
  const catalogBody = JSON.stringify({ provider: "deepseek" });

  const result = await runRemotePricingUpdate({
    manifestUrl: "https://prices.example.test/manifest.json",
    activeManifestVersion: "1.0.0",
    trustedKeys,
    verifySignature: ({ signature }) => signature === "valid",
    fetchImpl: async (url) => {
      if (String(url) === "https://prices.example.test/manifest.json") {
        return new Response(JSON.stringify(signedManifest({ catalogBody })));
      }
      return new Response(catalogBody);
    },
    activate: () => {
      throw new Error("registry refused catalog");
    },
  });

  expect(result).toEqual({
    action: "rolled-back",
    activeManifestVersion: "1.0.0",
    rejectedManifestVersion: "1.1.0",
    reason: "registry refused catalog",
  });
});

test("enforces HTTPS URLs and response size limits before activation", async () => {
  await expect(runRemotePricingUpdate({
    manifestUrl: "http://prices.example.test/manifest.json",
    activeManifestVersion: "1.0.0",
    trustedKeys,
    verifySignature: ({ signature }) => signature === "valid",
    fetchImpl: async () => new Response("{}"),
    activate: vi.fn(),
  })).rejects.toThrow(/https/i);

  const oversized = "x".repeat(20);
  const activate = vi.fn();
  const result = await runRemotePricingUpdate({
    manifestUrl: "https://prices.example.test/manifest.json",
    activeManifestVersion: "1.0.0",
    trustedKeys,
    verifySignature: ({ signature }) => signature === "valid",
    maxCatalogBytes: 10,
    fetchImpl: async (url) => {
      if (String(url) === "https://prices.example.test/manifest.json") {
        return new Response(JSON.stringify(signedManifest({ catalogBody: oversized })));
      }
      return new Response(oversized);
    },
    activate,
  });

  expect(result).toMatchObject({
    action: "rolled-back",
    activeManifestVersion: "1.0.0",
    rejectedManifestVersion: "1.1.0",
  });
  expect(result.action === "rolled-back" ? result.reason : "").toMatch(/size/i);
  expect(activate).not.toHaveBeenCalled();
});

test("stops streaming an oversized catalog without buffering the full response", async () => {
  const catalogBody = "x".repeat(20);
  const arrayBuffer = vi.fn(async () => {
    throw new Error("the streaming response must not be fully buffered");
  });
  const activate = vi.fn();

  const result = await runRemotePricingUpdate({
    manifestUrl: "https://prices.example.test/manifest.json",
    activeManifestVersion: "1.0.0",
    trustedKeys,
    verifySignature: ({ signature }) => signature === "valid",
    maxCatalogBytes: 10,
    fetchImpl: async (url) => {
      if (String(url) === "https://prices.example.test/manifest.json") {
        return new Response(JSON.stringify(signedManifest({ catalogBody })));
      }
      return {
        ok: true,
        url: "https://prices.example.test/deepseek.json",
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("12345678"));
            controller.enqueue(new TextEncoder().encode("90123456"));
            controller.close();
          },
        }),
        arrayBuffer,
      };
    },
    activate,
  });

  expect(result.action).toBe("rolled-back");
  expect(result.action === "rolled-back" ? result.reason : "").toMatch(/size/i);
  expect(arrayBuffer).not.toHaveBeenCalled();
  expect(activate).not.toHaveBeenCalled();
});

test("rejects responses that resolve to a non-https final url", async () => {
  const activate = vi.fn();

  const result = await runRemotePricingUpdate({
    manifestUrl: "https://prices.example.test/manifest.json",
    activeManifestVersion: "1.0.0",
    trustedKeys,
    verifySignature: ({ signature }) => signature === "valid",
    fetchImpl: async (url) => {
      if (String(url) === "https://prices.example.test/manifest.json") {
        return new Response(JSON.stringify(signedManifest()));
      }
      return {
        ok: true,
        url: "http://prices.example.test/deepseek.json",
        body: null,
        arrayBuffer: async () => new TextEncoder().encode("{}").buffer,
      };
    },
    activate,
  });

  expect(result).toMatchObject({
    action: "rolled-back",
    activeManifestVersion: "1.0.0",
    rejectedManifestVersion: "1.1.0",
  });
  expect(result.action === "rolled-back" ? result.reason : "").toMatch(/https/i);
  expect(activate).not.toHaveBeenCalled();
});
