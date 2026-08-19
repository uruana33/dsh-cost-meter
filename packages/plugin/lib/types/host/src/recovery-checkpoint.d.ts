export declare const RECOVERY_CHECKPOINT_SCHEMA_VERSION = 1;
export interface RecoveryCheckpoint {
    schemaVersion: typeof RECOVERY_CHECKPOINT_SCHEMA_VERSION;
    sourceKey: string;
    projectionVersion: string;
    ledgerFingerprint: string;
    sessionRevisions: Record<string, string>;
}
export interface RecoveryCheckpointExpectations {
    sourceKey: string;
    projectionVersion: string;
    ledgerFingerprint: string;
}
export interface RecoveryCheckpointRecoveryNotice {
    filePath: string;
    quarantinePath: string | null;
    reason: "corrupt" | `schema-${number}`;
}
export declare function createRecoveryCheckpointPath(ledgerPath: string): string;
export declare function createLedgerFingerprint(ledgerPath: string): string;
export declare function createLedgerFingerprintFromContents(ledgerPath: string, contents: string | null): string;
export declare function loadRecoveryCheckpoint(filePath: string, expectations: RecoveryCheckpointExpectations, onRecovery?: ((notice: RecoveryCheckpointRecoveryNotice) => void) | undefined): RecoveryCheckpoint | null;
export declare function saveRecoveryCheckpoint(filePath: string, checkpoint: RecoveryCheckpoint): void;
