import { type HostMetadataInput, type HostMetadataRecord, type TokenProjectionRecord, type TokenUsageInput, type TokenUsageRecord } from "./types.js";
export interface HostMetadataAdapter {
    fromRequest(input: HostMetadataInput): HostMetadataRecord;
}
export declare function createHostMetadataAdapter(): HostMetadataAdapter;
export interface HostUsageAdapter {
    fromAssistantUsage(input: TokenUsageInput): TokenUsageRecord;
}
export declare function createHostUsageAdapter(): HostUsageAdapter;
export interface HostProjectionAdapter {
    fromTokenMeter(input: TokenUsageInput & {
        reliability?: unknown;
        reliable?: unknown;
    }): TokenProjectionRecord | null;
}
export declare function createHostProjectionAdapter(): HostProjectionAdapter;
