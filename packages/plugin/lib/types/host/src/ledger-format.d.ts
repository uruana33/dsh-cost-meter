import { type AppendOnlyLedgerRecoveryNotice } from "./append-ledger.js";
import { type CostEventRepository, type LedgerRecoveryNotice } from "./ledger.js";
export type CostEventLedgerFormat = "json" | "append";
export interface CostEventRepositoryForFormatOptions {
    ledgerPath: string;
    format?: CostEventLedgerFormat | undefined;
    onJsonRecovery?: ((notice: LedgerRecoveryNotice) => void) | undefined;
    onAppendRecovery?: ((notice: AppendOnlyLedgerRecoveryNotice) => void) | undefined;
}
export declare function createCostEventRepositoryForFormat({ ledgerPath, format, onJsonRecovery, onAppendRecovery, }: CostEventRepositoryForFormatOptions): CostEventRepository;
