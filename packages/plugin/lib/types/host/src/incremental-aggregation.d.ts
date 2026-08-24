import { type CostEventInput, type LedgerAggregation } from "./types.js";
/**
 * Incremental counterpart to `createLedgerAggregator`. The full aggregator
 * replays every journal event (O(total history)) per call; this one keeps
 * per-scope summaries up to date under the runtime's single mutation pattern:
 * an event is inserted fresh, or replaces its previous projection version —
 * same identity, same `requestStartedAt`.
 *
 * Additive counters are subtracted/re-added directly. `firstSeenAt` /
 * `lastSeenAt` and the provider/model metadata attributed to the latest
 * timestamp use per-scope participant lists keyed by timestamp; a replacement
 * that keeps its timestamp costs O(1). Genuine boundary changes fall back to
 * a rescan over distinct timestamps, which is rare because replacements do
 * not move boundaries.
 */
export interface IncrementalLedgerAggregator {
    seed(events: readonly CostEventInput[]): void;
    /** Applies one journal mutation: removes the previous version, adds the next. */
    apply(previous: CostEventInput | undefined, next: CostEventInput | undefined): void;
    reset(): void;
    snapshot(): LedgerAggregation;
}
export declare function createIncrementalLedgerAggregator(): IncrementalLedgerAggregator;
