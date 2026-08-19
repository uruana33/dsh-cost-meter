import { strict as assert } from "node:assert";

import {
  compareRemotePricingManifestVersions,
  createRemotePricingManifestSigningPayload,
  decideRemotePricingManifestUpdate,
  settleRemotePricingManifestUpdate,
  validateSignedRemotePricingManifest,
  type RemotePricingManifestPayload,
} from "../../packages/core/src/pricing/remote-update";

const validPayload: RemotePricingManifestPayload = {
  schemaVersion: 1,
  manifestVersion: "1.2.0",
  issuedAt: "2026-08-19T00:00:00.000Z",
  catalogs: [
    {
      provider: "deepseek",
      priceVersion: "deepseek-official-pricing-2026-08-19",
      url: "https://prices.example.test/deepseek-2026-08-19.json",
      sha256: "a".repeat(64),
    },
  ],
};

test("validates a signed remote pricing manifest against the canonical payload and trusted key", () => {
  const expectedPayload = createRemotePricingManifestSigningPayload(validPayload);
  const calls: string[] = [];

  const result = validateSignedRemotePricingManifest({
    ...validPayload,
    signatures: [{ keyId: "primary", algorithm: "ed25519", value: "mock-signature" }],
  }, {
    trustedKeys: [{ keyId: "primary", algorithm: "ed25519", publicKey: "mock-public-key" }],
    verifySignature({ payload, signature, key }) {
      calls.push(`${key.keyId}:${signature}:${payload}`);
      return payload === expectedPayload;
    },
  });

  assert.equal(result.manifest.manifestVersion, "1.2.0");
  assert.deepEqual(result.verifiedBy, { keyId: "primary", algorithm: "ed25519" });
  assert.deepEqual(calls, [`primary:mock-signature:${expectedPayload}`]);
});

test("rejects unsigned, untrusted, or unverifiable pricing manifests", () => {
  assert.throws(() => validateSignedRemotePricingManifest(validPayload, {
    trustedKeys: [{ keyId: "primary", algorithm: "ed25519", publicKey: "mock-public-key" }],
    verifySignature: () => true,
  }), /signature/i);

  assert.throws(() => validateSignedRemotePricingManifest({
    ...validPayload,
    signatures: [{ keyId: "other", algorithm: "ed25519", value: "mock-signature" }],
  }, {
    trustedKeys: [{ keyId: "primary", algorithm: "ed25519", publicKey: "mock-public-key" }],
    verifySignature: () => true,
  }), /trusted/i);

  assert.throws(() => validateSignedRemotePricingManifest({
    ...validPayload,
    signatures: [{ keyId: "primary", algorithm: "ed25519", value: "mock-signature" }],
  }, {
    trustedKeys: [{ keyId: "primary", algorithm: "ed25519", publicKey: "mock-public-key" }],
    verifySignature: () => false,
  }), /signature/i);
});

test("ignores malformed untrusted signatures when a later trusted signature verifies", () => {
  const result = validateSignedRemotePricingManifest({
    ...validPayload,
    signatures: [
      { keyId: "untrusted", algorithm: "rsa" as never, value: "" },
      { keyId: "primary", algorithm: "ed25519", value: "" },
      { keyId: "primary", algorithm: "ed25519", value: "valid" },
    ],
  }, {
    trustedKeys: [{ keyId: "primary", algorithm: "ed25519", publicKey: "mock-public-key" }],
    verifySignature: ({ signature }) => signature === "valid",
  });

  assert.equal(result.verifiedBy.keyId, "primary");
});

test("rejects malformed manifest payloads before any update decision is made", () => {
  const baseSigned = {
    ...validPayload,
    signatures: [{ keyId: "primary", algorithm: "ed25519", value: "mock-signature" }],
  };
  const trustAll = {
    trustedKeys: [{ keyId: "primary", algorithm: "ed25519", publicKey: "mock-public-key" }],
    verifySignature: () => true,
  } as const;

  assert.throws(() => validateSignedRemotePricingManifest({
    ...baseSigned,
    manifestVersion: "2026-08-19",
  }, trustAll), /manifestVersion/i);

  assert.throws(() => validateSignedRemotePricingManifest({
    ...baseSigned,
    catalogs: [{ ...validPayload.catalogs[0]!, sha256: "not-a-digest" }],
  }, trustAll), /sha256/i);

  assert.throws(() => validateSignedRemotePricingManifest({
    ...baseSigned,
    catalogs: [{ ...validPayload.catalogs[0]!, url: "http://prices.example.test/insecure.json" }],
  }, trustAll), /https/i);

  assert.throws(() => validateSignedRemotePricingManifest({
    ...baseSigned,
    issuedAt: "2026-08-19T00:00:00",
  }, trustAll), /issuedAt/i);
  assert.throws(() => validateSignedRemotePricingManifest({
    ...baseSigned,
    issuedAt: "08/19/2026",
  }, trustAll), /issuedAt/i);
  assert.throws(() => validateSignedRemotePricingManifest({
    ...baseSigned,
    issuedAt: "2026-02-30T00:00:00.000Z",
  }, trustAll), /issuedAt/i);
  assert.throws(() => validateSignedRemotePricingManifest({
    ...baseSigned,
    expiresAt: "2026-08-18T00:00:00.000Z",
  }, trustAll), /expiresAt/i);
});

test("compares remote pricing manifest versions numerically", () => {
  assert.equal(compareRemotePricingManifestVersions("1.10.0", "1.2.9"), 1);
  assert.equal(compareRemotePricingManifestVersions("1.2.0", "1.2.0"), 0);
  assert.equal(compareRemotePricingManifestVersions("1.2.0", "2.0.0"), -1);
  assert.throws(() => compareRemotePricingManifestVersions("1.2", "1.2.0"), /version/i);
});

test("accepts only newer manifests that are not expired, below floor, or explicitly rejected", () => {
  const candidate = validateSignedRemotePricingManifest({
    ...validPayload,
    signatures: [{ keyId: "primary", algorithm: "ed25519", value: "mock-signature" }],
  }, {
    trustedKeys: [{ keyId: "primary", algorithm: "ed25519", publicKey: "mock-public-key" }],
    verifySignature: () => true,
  });

  assert.deepEqual(decideRemotePricingManifestUpdate(candidate, {
    activeManifestVersion: "1.1.9",
    now: "2026-08-19T01:00:00.000Z",
  }), {
    action: "accept",
    manifest: candidate.manifest,
    previousManifestVersion: "1.1.9",
  });

  assert.equal(decideRemotePricingManifestUpdate(candidate, {
    activeManifestVersion: "1.2.0",
  }).reason, "not-newer");
  assert.equal(decideRemotePricingManifestUpdate(candidate, {
    activeManifestVersion: "1.1.0",
    minimumManifestVersion: "1.3.0",
  }).reason, "below-minimum-version");
  assert.equal(decideRemotePricingManifestUpdate(candidate, {
    activeManifestVersion: "1.1.0",
    rejectedManifestVersions: ["1.2.0"],
  }).reason, "explicitly-rejected");
});

test("settles accepted updates by committing or rolling back to the previous active version", () => {
  const candidate = validateSignedRemotePricingManifest({
    ...validPayload,
    signatures: [{ keyId: "primary", algorithm: "ed25519", value: "mock-signature" }],
  }, {
    trustedKeys: [{ keyId: "primary", algorithm: "ed25519", publicKey: "mock-public-key" }],
    verifySignature: () => true,
  });
  const decision = decideRemotePricingManifestUpdate(candidate, {
    activeManifestVersion: "1.1.0",
  });

  assert.deepEqual(settleRemotePricingManifestUpdate(decision, { ok: true }), {
    action: "committed",
    activeManifestVersion: "1.2.0",
    previousManifestVersion: "1.1.0",
  });
  assert.deepEqual(settleRemotePricingManifestUpdate(decision, {
    ok: false,
    reason: "candidate catalog failed validation",
  }), {
    action: "rolled-back",
    activeManifestVersion: "1.1.0",
    rejectedManifestVersion: "1.2.0",
    reason: "candidate catalog failed validation",
  });
});
