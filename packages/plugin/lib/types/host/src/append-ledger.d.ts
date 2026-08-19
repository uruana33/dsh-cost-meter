import { type CostEventRepository } from "./ledger.js";
export interface AppendOnlyLedgerRecoveryNotice {
    filePath: string;
    reason: "tail-truncated" | "corrupt-manifest" | "corrupt-snapshot" | "corrupt-log";
}
export interface AppendOnlyCostEventRepositoryOptions {
    /** Manifest path. Generation snapshot and log files live beside it. */
    filePath: string;
    /** Optional legacy JSON ledger to import on first startup. */
    legacyFilePath?: string | undefined;
    compactionHooks?: AppendOnlyLedgerCompactionHooks | undefined;
    onRecovery?: ((notice: AppendOnlyLedgerRecoveryNotice) => void) | undefined;
}
export interface AppendOnlyCostEventRepository extends CostEventRepository {
    compact(): void;
    /**
     * Export the current append generation as a complete schema-v1 JSON ledger.
     * The default same-path rollback is terminal: later writes are rejected and
     * ledgerFingerprint() reports the exported JSON fingerprint.
     */
    exportToJson(options?: AppendOnlyJsonExportOptions): string;
    /** Alias for exportToJson() used by migration/rollback callers. */
    compactToJson(options?: AppendOnlyJsonExportOptions): string;
}
export interface AppendOnlyJsonExportOptions {
    /** Destination schema-v1 JSON ledger path. Defaults to the manifest path. */
    filePath?: string | undefined;
    /** Optional candidate check that runs before the destination is replaced. */
    verifyCandidate?: ((candidateFilePath: string) => void) | undefined;
}
export type AppendOnlyLedgerCompactionStage = "snapshot-write" | "log-write" | "candidate-validation" | "manifest-switch" | "old-generation-cleanup";
export interface AppendOnlyLedgerCompactionManifest {
    readonly generation: number;
    readonly snapshotFile: string;
    readonly logFile: string;
}
export interface AppendOnlyLedgerCompactionContext {
    readonly filePath: string;
    readonly currentManifest: AppendOnlyLedgerCompactionManifest;
    readonly nextManifest: AppendOnlyLedgerCompactionManifest;
}
export interface AppendOnlyLedgerCompactionHooks {
    failAt?(stage: AppendOnlyLedgerCompactionStage, context: AppendOnlyLedgerCompactionContext): void;
}
/**
 * Experimental append-only adapter. It is deliberately opt-in and keeps the
 * public runtime contract at CostEventRepository.
 */
export declare function createAppendOnlyCostEventRepository({ filePath, legacyFilePath, compactionHooks, onRecovery, }: AppendOnlyCostEventRepositoryOptions): AppendOnlyCostEventRepository;
