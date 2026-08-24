import type { MyMeterCordisContext } from "./index";
export interface HistoryRecoveryStatus {
    state: "idle" | "listing" | "running" | "cancelled" | "completed" | "failed";
    listedSessions: number;
    readSessions: number;
    replayedSessions: number;
    skippedLiveSessions: number;
    skippedUnchangedSessions: number;
    failedReads: number;
    batches: number;
    eventsSeen: number;
    currentSessionId: string | null;
    startedAt: number | null;
    finishedAt: number | null;
    lastError: string | null;
    cancelReason: string | null;
    batchSizeSessions: number;
    batchSizeEvents: number;
}
export interface HistoryRecovery {
    start(): void;
    markLive(sessionId: string): void;
    cancel(reason?: string): void;
    status(): HistoryRecoveryStatus;
}
export interface HistoryRecoveryOptions {
    source: HistoryRecoverySource;
    target: HistoryRecoveryTarget;
    checkpoint?: HistoryRecoveryCheckpoint | undefined;
    batchSizeSessions?: number;
    batchSizeEvents?: number;
    onStatus?: (status: HistoryRecoveryStatus) => void;
    yieldToEventLoop?: () => Promise<void>;
}
export interface HistoryRecoveryCheckpoint {
    sessionRevisions: Record<string, string>;
    save(sessionRevisions: Record<string, string>): void;
}
export interface HistoryRecoverySource {
    list(signal: AbortSignal): Promise<readonly HistorySessionRef[]>;
    read(ref: HistorySessionRef, signal: AbortSignal): Promise<HistoryReplaySession | null>;
}
export interface HistoryRecoveryTarget {
    replayBatch(sessions: readonly HistoryReplaySession[]): HistoryReplayBatchResult;
}
export interface HistoryReplayBatchResult {
    replayedSessions: number;
    skippedUnchangedSessions: number;
    eventsSeen: number;
}
export interface HistorySessionRef {
    id: string;
    source: "query" | "persistence";
    header?: Record<string, unknown>;
    revision?: string;
    live?: boolean;
    persisted?: boolean;
}
export interface HistoryReplaySession {
    id: string;
    header: Record<string, unknown>;
    revision?: string;
    events: readonly unknown[];
}
export declare function createHistoryRecovery(options: HistoryRecoveryOptions): HistoryRecovery;
export declare function createCordisHistoryRecoverySource(ctx: MyMeterCordisContext, onSessionHeader?: (record: unknown) => void): HistoryRecoverySource;
