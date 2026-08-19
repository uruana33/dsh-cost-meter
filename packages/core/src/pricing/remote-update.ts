export interface RemotePricingCatalogDescriptor {
  provider: string;
  priceVersion: string;
  url: string;
  sha256: string;
}

export interface RemotePricingManifestPayload {
  schemaVersion: 1;
  manifestVersion: string;
  issuedAt: string;
  expiresAt?: string | undefined;
  catalogs: readonly RemotePricingCatalogDescriptor[];
}

export interface RemotePricingManifestSignature {
  keyId: string;
  algorithm: "ed25519";
  value: string;
}

export interface SignedRemotePricingManifest extends RemotePricingManifestPayload {
  signatures: readonly RemotePricingManifestSignature[];
}

export interface RemotePricingTrustedKey {
  keyId: string;
  algorithm: "ed25519";
  publicKey: string;
}

export interface VerifiedRemotePricingManifest {
  manifest: RemotePricingManifestPayload;
  verifiedBy: Pick<RemotePricingTrustedKey, "keyId" | "algorithm">;
}

export interface RemotePricingManifestVerificationOptions {
  trustedKeys: readonly RemotePricingTrustedKey[];
  verifySignature(input: {
    payload: string;
    signature: string;
    key: RemotePricingTrustedKey;
  }): boolean;
}

export type RemotePricingManifestUpdateRejectReason =
  | "not-newer"
  | "below-minimum-version"
  | "explicitly-rejected"
  | "expired";

export interface RemotePricingManifestUpdateDecision {
  action: "accept" | "reject";
  manifest?: RemotePricingManifestPayload | undefined;
  previousManifestVersion: string;
  manifestVersion?: string | undefined;
  reason?: RemotePricingManifestUpdateRejectReason | undefined;
}

export interface RemotePricingManifestUpdateDecisionOptions {
  activeManifestVersion: string;
  minimumManifestVersion?: string | undefined;
  rejectedManifestVersions?: readonly string[] | undefined;
  now?: string | Date | undefined;
}

export function createRemotePricingManifestSigningPayload(
  manifest: RemotePricingManifestPayload,
): string {
  return canonicalJson(validateManifestPayload(manifest));
}

export function validateSignedRemotePricingManifest(
  input: unknown,
  options: RemotePricingManifestVerificationOptions,
): VerifiedRemotePricingManifest {
  const signed = input as RemotePricingManifestPayload & {
    signatures?: readonly RemotePricingManifestSignature[] | undefined;
  };
  const manifest = validateManifestPayload(signed);
  const signatures = signed.signatures;
  if (!Array.isArray(signatures) || signatures.length === 0) {
    throw new Error("remote pricing manifest requires at least one signature");
  }
  if (!Array.isArray(options.trustedKeys) || options.trustedKeys.length === 0) {
    throw new Error("remote pricing manifest has no trusted keys configured");
  }

  const payload = canonicalJson(manifest);
  let foundTrustedSignature = false;
  for (const signature of signatures) {
    if (!signature || typeof signature !== "object") continue;
    const key = options.trustedKeys.find((candidate) =>
      candidate.keyId === signature.keyId && candidate.algorithm === signature.algorithm);
    if (!key) continue;
    foundTrustedSignature = true;
    try {
      validateSignature(signature);
      if (options.verifySignature({ payload, signature: signature.value, key })) {
        return {
          manifest,
          verifiedBy: { keyId: key.keyId, algorithm: key.algorithm },
        };
      }
    } catch {
      // A bad candidate must not prevent a later trusted signature from verifying.
    }
  }

  if (!foundTrustedSignature) {
    throw new Error("remote pricing manifest is not signed by a trusted key");
  }
  throw new Error("remote pricing manifest signature verification failed");
}

export function compareRemotePricingManifestVersions(left: string, right: string): -1 | 0 | 1 {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index]! > rightParts[index]!) return 1;
    if (leftParts[index]! < rightParts[index]!) return -1;
  }
  return 0;
}

export function decideRemotePricingManifestUpdate(
  candidate: VerifiedRemotePricingManifest,
  options: RemotePricingManifestUpdateDecisionOptions,
): RemotePricingManifestUpdateDecision {
  const version = candidate.manifest.manifestVersion;
  parseVersion(options.activeManifestVersion);
  if (compareRemotePricingManifestVersions(version, options.activeManifestVersion) <= 0) {
    return rejectDecision(version, options.activeManifestVersion, "not-newer");
  }
  if (
    options.minimumManifestVersion
    && compareRemotePricingManifestVersions(version, options.minimumManifestVersion) < 0
  ) {
    return rejectDecision(version, options.activeManifestVersion, "below-minimum-version");
  }
  if (options.rejectedManifestVersions?.includes(version)) {
    return rejectDecision(version, options.activeManifestVersion, "explicitly-rejected");
  }
  if (candidate.manifest.expiresAt) {
    const now = toTimestamp(options.now ?? new Date());
    if (toTimestamp(candidate.manifest.expiresAt) <= now) {
      return rejectDecision(version, options.activeManifestVersion, "expired");
    }
  }
  return {
    action: "accept",
    manifest: candidate.manifest,
    previousManifestVersion: options.activeManifestVersion,
  };
}

export function settleRemotePricingManifestUpdate(
  decision: RemotePricingManifestUpdateDecision,
  result: { ok: true } | { ok: false; reason: string },
):
  | {
    action: "committed";
    activeManifestVersion: string;
    previousManifestVersion: string;
  }
  | {
    action: "rolled-back";
    activeManifestVersion: string;
    rejectedManifestVersion: string;
    reason: string;
  }
  | {
    action: "not-applied";
    activeManifestVersion: string;
    reason: RemotePricingManifestUpdateRejectReason;
  } {
  if (decision.action !== "accept" || !decision.manifest) {
    return {
      action: "not-applied",
      activeManifestVersion: decision.previousManifestVersion,
      reason: decision.reason ?? "not-newer",
    };
  }
  if (result.ok) {
    return {
      action: "committed",
      activeManifestVersion: decision.manifest.manifestVersion,
      previousManifestVersion: decision.previousManifestVersion,
    };
  }
  return {
    action: "rolled-back",
    activeManifestVersion: decision.previousManifestVersion,
    rejectedManifestVersion: decision.manifest.manifestVersion,
    reason: result.reason,
  };
}

function validateManifestPayload(input: RemotePricingManifestPayload): RemotePricingManifestPayload {
  if (!input || typeof input !== "object") throw new Error("remote pricing manifest must be an object");
  if (input.schemaVersion !== 1) throw new Error("remote pricing manifest schemaVersion must be 1");
  parseVersion(input.manifestVersion, "manifestVersion");
  const issuedAt = normalizeTimestamp(input.issuedAt, "issuedAt");
  const expiresAt = input.expiresAt === undefined ? undefined : normalizeTimestamp(input.expiresAt, "expiresAt");
  if (expiresAt && expiresAt <= issuedAt) {
    throw new Error("expiresAt must be later than issuedAt");
  }
  if (!Array.isArray(input.catalogs) || input.catalogs.length === 0) {
    throw new Error("remote pricing manifest catalogs must be a non-empty array");
  }
  const providers = new Set<string>();
  const catalogs = input.catalogs.map((catalog) => {
    if (!catalog || typeof catalog !== "object") throw new Error("remote pricing catalog must be an object");
    const provider = nonEmpty(catalog.provider, "provider").toLowerCase();
    if (providers.has(provider)) throw new Error(`duplicate remote pricing provider: ${provider}`);
    providers.add(provider);
    const priceVersion = nonEmpty(catalog.priceVersion, "priceVersion");
    const url = nonEmpty(catalog.url, "url");
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error("remote pricing catalog url must be a valid HTTPS URL");
    }
    if (parsedUrl.protocol !== "https:") throw new Error("remote pricing catalog url must use HTTPS");
    const sha256 = nonEmpty(catalog.sha256, "sha256").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("remote pricing catalog sha256 must be a 64-character digest");
    return Object.freeze({ provider, priceVersion, url: parsedUrl.toString(), sha256 });
  });
  return Object.freeze({
    schemaVersion: 1,
    manifestVersion: input.manifestVersion,
    issuedAt,
    ...(expiresAt ? { expiresAt } : {}),
    catalogs: Object.freeze(catalogs),
  });
}

function validateSignature(signature: RemotePricingManifestSignature): void {
  if (!signature || typeof signature !== "object") throw new Error("invalid remote pricing signature");
  nonEmpty(signature.keyId, "signature keyId");
  if (signature.algorithm !== "ed25519") throw new Error("unsupported remote pricing signature algorithm");
  nonEmpty(signature.value, "signature value");
}

function rejectDecision(
  manifestVersion: string,
  previousManifestVersion: string,
  reason: RemotePricingManifestUpdateRejectReason,
): RemotePricingManifestUpdateDecision {
  return { action: "reject", manifestVersion, previousManifestVersion, reason };
}

function parseVersion(value: string, field = "version"): readonly [number, number, number] {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${field} must be a numeric semantic version`);
  }
  const parts = value.split(".").map(Number) as [number, number, number];
  if (!parts.every(Number.isSafeInteger)) throw new Error(`${field} exceeds the supported version range`);
  return parts;
}

function normalizeTimestamp(value: string, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a UTC ISO timestamp`);
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!match) throw new Error(`${field} must be a UTC ISO timestamp`);
  const date = new Date(value);
  const canonical = `${match[1]}.${(match[2] ?? "").padEnd(3, "0")}Z`;
  if (Number.isNaN(date.getTime()) || date.toISOString() !== canonical) {
    throw new Error(`${field} must be a valid UTC ISO timestamp`);
  }
  return date.toISOString();
}

function toTimestamp(value: string | Date): number {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("remote pricing update now must be a valid timestamp");
  return date.getTime();
}

function nonEmpty(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be non-empty`);
  return value.trim();
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
