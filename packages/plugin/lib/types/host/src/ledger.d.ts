import { createHostCostEventKey, type CostEventInput, type CostEventRecord, type LedgerAggregation } from "./types.js";
export interface CostEventRepository {
    upsert(event: CostEventInput): CostEventRecord;
    commit?(events: readonly CostEventInput[]): void;
    list(): readonly CostEventRecord[];
    getById(id: string): CostEventRecord | undefined;
    replaceAll(events: readonly CostEventInput[]): void;
    clear(): void;
    ledgerFingerprint?(): string;
}
export interface FileCostEventRepositoryOptions {
    filePath: string;
    onRecovery?: ((notice: LedgerRecoveryNotice) => void) | undefined;
}
export interface LedgerRecoveryNotice {
    filePath: string;
    quarantinePath: string | null;
    reason: "corrupt" | `schema-${number}` | "invalid-events";
    recoveredEventCount: number;
    rejectedEventCount: number;
}
export declare function createInMemoryCostEventRepository(initialEvents?: readonly CostEventInput[]): CostEventRepository;
export declare function dedupeHostCostEvents(events: readonly CostEventInput[]): CostEventRecord[];
export declare function createFileCostEventRepository({ filePath, onRecovery, }: FileCostEventRepositoryOptions): CostEventRepository;
export { createHostCostEventKey };
export interface LedgerAggregator {
    aggregate(events: readonly CostEventInput[]): LedgerAggregation;
}
export declare function createLedgerAggregator(): LedgerAggregator;
export declare function restoreLedgerEvent(event: unknown): CostEventRecord;
