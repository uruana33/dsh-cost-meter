import { settleRemotePricingManifestUpdate, type RemotePricingCatalogDescriptor, type RemotePricingManifestPayload, type RemotePricingManifestUpdateDecisionOptions, type RemotePricingTrustedKey, type VerifiedRemotePricingManifest } from "../../core/src/pricing/remote-update";
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
export declare function runRemotePricingUpdate(options: RemotePricingUpdateOptions): Promise<RemotePricingUpdateResult>;
