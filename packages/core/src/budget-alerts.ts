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

const THRESHOLDS = [
  { percent: 100 as const, level: "critical" as const },
  { percent: 80 as const, level: "warning" as const },
  { percent: 50 as const, level: "notice" as const },
];

export function evaluateBudgetAlert(input: EvaluateBudgetAlertInput): BudgetAlertResult {
  assertNonNegative(input);
  if (input.budgetMinor === 0n) {
    const state: BudgetAlertState = {
      level: "none",
      thresholdPercent: 0,
      notificationKey: null,
    };
    return {
      ...state,
      spentMinor: spentForBasis(input),
      percentageBasisPoints: 0,
      shouldNotify: false,
      state,
    };
  }

  const spentMinor = spentForBasis(input);
  const percentageBasisPoints = Number((spentMinor * 10_000n) / input.budgetMinor);
  const threshold = THRESHOLDS.find((candidate) => percentageBasisPoints >= candidate.percent * 100);
  const thresholdPercent = threshold?.percent ?? 0;
  const level = threshold?.level ?? "none";
  const notificationKey = threshold
    ? `${input.scopeId}:${input.basis}:${threshold.percent}`
    : null;
  const previousThreshold = input.previous?.thresholdPercent ?? 0;
  const shouldNotify = Boolean(threshold && threshold.percent > previousThreshold);

  const state: BudgetAlertState = { level, thresholdPercent, notificationKey };
  return {
    ...state,
    spentMinor,
    percentageBasisPoints,
    shouldNotify,
    state,
  };
}

function spentForBasis(input: EvaluateBudgetAlertInput): MoneyMinor {
  if (input.basis === "settled") return input.settledMinor;
  if (input.basis === "estimated") return input.estimatedMinor;
  return input.settledMinor + input.estimatedMinor;
}

function assertNonNegative(input: EvaluateBudgetAlertInput): void {
  if (input.budgetMinor < 0n || input.settledMinor < 0n || input.estimatedMinor < 0n) {
    throw new RangeError("budget alert values must be non-negative");
  }
}
