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
export type RemotePricingManifestUpdateRejectReason = "not-newer" | "below-minimum-version" | "explicitly-rejected" | "expired";
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
export declare function createRemotePricingManifestSigningPayload(manifest: RemotePricingManifestPayload): string;
export declare function validateSignedRemotePricingManifest(input: unknown, options: RemotePricingManifestVerificationOptions): VerifiedRemotePricingManifest;
export declare function compareRemotePricingManifestVersions(left: string, right: string): -1 | 0 | 1;
export declare function decideRemotePricingManifestUpdate(candidate: VerifiedRemotePricingManifest, options: RemotePricingManifestUpdateDecisionOptions): RemotePricingManifestUpdateDecision;
export declare function settleRemotePricingManifestUpdate(decision: RemotePricingManifestUpdateDecision, result: {
    ok: true;
} | {
    ok: false;
    reason: string;
}): {
    action: "committed";
    activeManifestVersion: string;
    previousManifestVersion: string;
} | {
    action: "rolled-back";
    activeManifestVersion: string;
    rejectedManifestVersion: string;
    reason: string;
} | {
    action: "not-applied";
    activeManifestVersion: string;
    reason: RemotePricingManifestUpdateRejectReason;
};
