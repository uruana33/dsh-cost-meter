import { createHash } from "node:crypto";

import {
  decideRemotePricingManifestUpdate,
  settleRemotePricingManifestUpdate,
  validateSignedRemotePricingManifest,
  type RemotePricingCatalogDescriptor,
  type RemotePricingManifestPayload,
  type RemotePricingManifestUpdateDecisionOptions,
  type RemotePricingTrustedKey,
  type VerifiedRemotePricingManifest,
} from "../../core/src/pricing/remote-update";

export interface RemotePricingFetchResponse {
  ok: boolean;
  status?: number | undefined;
  url?: string | undefined;
  body?: ReadableStream<Uint8Array> | null | undefined;
  headers?: Pick<Headers, "get"> | undefined;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface RemotePricingDownloadedCatalog extends RemotePricingCatalogDescriptor {
  bytes: Uint8Array;
  text: string;
  json: unknown;
}

export interface RemotePricingCatalogBundle {
  manifest: RemotePricingManifestPayload;
  verifiedBy: VerifiedRemotePricingManifest["verifiedBy"];
  catalogs: readonly RemotePricingDownloadedCatalog[];
}

export type RemotePricingUpdateResult = ReturnType<typeof settleRemotePricingManifestUpdate>;

export interface RemotePricingUpdateOptions extends RemotePricingManifestUpdateDecisionOptions {
  manifestUrl: string;
  trustedKeys: readonly RemotePricingTrustedKey[];
  verifySignature(input: {
    payload: string;
    signature: string;
    key: RemotePricingTrustedKey;
  }): boolean;
  fetchImpl(url: string): Promise<RemotePricingFetchResponse>;
  activate(bundle: RemotePricingCatalogBundle): void | Promise<void>;
  maxManifestBytes?: number | undefined;
  maxCatalogBytes?: number | undefined;
}

const DEFAULT_MAX_MANIFEST_BYTES = 256 * 1024;
const DEFAULT_MAX_CATALOG_BYTES = 1024 * 1024;

export async function runRemotePricingUpdate(
  options: RemotePricingUpdateOptions,
): Promise<RemotePricingUpdateResult> {
  const manifestUrl = normalizeHttpsUrl(options.manifestUrl, "remote pricing manifest url");
  const manifestBytes = await fetchBytes(
    options.fetchImpl,
    manifestUrl,
    options.maxManifestBytes ?? DEFAULT_MAX_MANIFEST_BYTES,
    "remote pricing manifest",
  );
  const verified = validateSignedRemotePricingManifest(parseJson(manifestBytes, "remote pricing manifest"), {
    trustedKeys: options.trustedKeys,
    verifySignature: options.verifySignature,
  });
  const decision = decideRemotePricingManifestUpdate(verified, {
    activeManifestVersion: options.activeManifestVersion,
    minimumManifestVersion: options.minimumManifestVersion,
    rejectedManifestVersions: options.rejectedManifestVersions,
    now: options.now,
  });

  if (decision.action !== "accept" || !decision.manifest) {
    return settleRemotePricingManifestUpdate(decision, { ok: true });
  }

  let catalogs: readonly RemotePricingDownloadedCatalog[];
  try {
    catalogs = await Promise.all(
      decision.manifest.catalogs.map((catalog) =>
        downloadCatalog(options.fetchImpl, catalog, options.maxCatalogBytes ?? DEFAULT_MAX_CATALOG_BYTES)
      ),
    );
  } catch (error) {
    return settleRemotePricingManifestUpdate(decision, { ok: false, reason: errorMessage(error) });
  }

  try {
    await options.activate({
      manifest: decision.manifest,
      verifiedBy: verified.verifiedBy,
      catalogs,
    });
  } catch (error) {
    return settleRemotePricingManifestUpdate(decision, { ok: false, reason: errorMessage(error) });
  }

  return settleRemotePricingManifestUpdate(decision, { ok: true });
}

async function downloadCatalog(
  fetchImpl: RemotePricingUpdateOptions["fetchImpl"],
  descriptor: RemotePricingCatalogDescriptor,
  maxBytes: number,
): Promise<RemotePricingDownloadedCatalog> {
  const url = normalizeHttpsUrl(descriptor.url, `remote pricing catalog ${descriptor.provider} url`);
  const bytes = await fetchBytes(fetchImpl, url, maxBytes, `remote pricing catalog ${descriptor.provider}`);
  const actualDigest = createHash("sha256").update(bytes).digest("hex");
  if (actualDigest !== descriptor.sha256) {
    throw new Error(`remote pricing catalog ${descriptor.provider} sha256 mismatch`);
  }
  const text = new TextDecoder().decode(bytes);
  return {
    ...descriptor,
    url,
    bytes,
    text,
    json: JSON.parse(text),
  };
}

async function fetchBytes(
  fetchImpl: RemotePricingUpdateOptions["fetchImpl"],
  url: string,
  maxBytes: number,
  label: string,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error(`${label} size limit must be a positive integer`);
  }
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`${label} download failed (HTTP ${response.status ?? "unknown"})`);
  }
  if (response.url) {
    normalizeHttpsUrl(response.url, `${label} final url`);
  }
  const contentLength = response.headers?.get("content-length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength > maxBytes) {
      throw new Error(`${label} response exceeds size limit`);
    }
  }
  const bytes = response.body
    ? await readStreamBytes(response.body, maxBytes, label)
    : new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new Error(`${label} response exceeds size limit`);
  }
  return bytes;
}

async function readStreamBytes(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  label: string,
): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value ?? new Uint8Array();
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`${label} response exceeds size limit`);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseJson(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

function normalizeHttpsUrl(value: string, field: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${field} must be a valid HTTPS URL`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${field} must use HTTPS`);
  }
  return url.toString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "remote pricing update failed";
}
