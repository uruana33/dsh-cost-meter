import type { MoneyMinor } from "../../shared/src/index";
export type BudgetAlertBasis = "settled" | "estimated" | "combined";
export type BudgetAlertLevel = "none" | "notice" | "warning" | "critical";
export interface BudgetAlertState {
    level: BudgetAlertLevel;
    thresholdPercent: 0 | 50 | 80 | 100;
    notificationKey: string | null;
}
export interface EvaluateBudgetAlertInput {
    scopeId: string;
    budgetMinor: MoneyMinor;
    settledMinor: MoneyMinor;
    estimatedMinor: MoneyMinor;
    basis: BudgetAlertBasis;
    previous?: BudgetAlertState | undefined;
}
export interface BudgetAlertResult extends BudgetAlertState {
    spentMinor: MoneyMinor;
    percentageBasisPoints: number;
    shouldNotify: boolean;
    state: BudgetAlertState;
}
export declare function evaluateBudgetAlert(input: EvaluateBudgetAlertInput): BudgetAlertResult;
