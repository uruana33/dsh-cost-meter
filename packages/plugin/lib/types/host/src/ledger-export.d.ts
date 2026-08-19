export type CostEventLedgerExportFormat = "json" | "csv";
export interface CostEventLedgerExportOptions {
    format: CostEventLedgerExportFormat;
    events: readonly unknown[];
}
export declare function exportCostEventLedger({ format, events, }: CostEventLedgerExportOptions): string;
