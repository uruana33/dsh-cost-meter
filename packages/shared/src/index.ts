export const MICRO_CNY_PER_CNY = 1_000_000n;
export const TOKENS_PER_MILLION = 1_000_000n;

export type MoneyMicroCny = bigint;
/** Monetary units in the source currency. One unit is one millionth of the currency. */
export type MoneyMinor = bigint;
export type CostCurrency = "CNY" | "USD" | (string & {});
export type TokenCount = bigint;
export type DateInput = string | number | Date;

export type PricingZone = "peak" | "offpeak" | "unknown";
export type CostEventStatus = "estimated" | "settled" | "unknown" | "failed";
export type BalanceSnapshotStatus = "fresh" | "stale" | "unavailable";
export type CostDisplayStatus = CostEventStatus | BalanceSnapshotStatus | "idle" | "billing";
export type CostEventSource = "stream" | "final_usage" | "restored";
export type CostRequestOutcome = "success" | "failed" | "aborted";
export type CostUnknownReason =
  | "missing_usage"
  | "missing_projection"
  | "unreliable_projection"
  | "model_not_found"
  | "rate_not_found"
  | "invalid_usage";

export interface CostEventIdentity {
  sessionId: string;
  turnId: string;
  stepId: string;
  attemptId: string;
}

export interface CostTokenUsage {
  cacheHitTokens: TokenCount;
  cacheMissTokens: TokenCount;
  /** Optional provider cache-creation tokens; included in the input cost bucket. */
  cacheWriteTokens?: TokenCount | undefined;
  outputTokens: TokenCount;
  reasoningTokens: TokenCount;
}

export interface CostBreakdown extends CostTokenUsage {
  amountMicroCny: MoneyMicroCny;
  cacheHitMicroCny: MoneyMicroCny;
  cacheMissMicroCny: MoneyMicroCny;
  outputMicroCny: MoneyMicroCny;
  pricingZone: PricingZone;
  priceVersion: string;
  reasoningTokensIncludedInOutput?: true | undefined;
  /** Source-currency breakdown. Legacy CNY fields remain for wire compatibility. */
  currency?: CostCurrency | undefined;
  amountMinor?: MoneyMinor | undefined;
  cacheHitMinor?: MoneyMinor | undefined;
  cacheMissMinor?: MoneyMinor | undefined;
  outputMinor?: MoneyMinor | undefined;
  cacheHitRateMinorPerMillionTokens?: MoneyMinor | undefined;
  cacheMissRateMinorPerMillionTokens?: MoneyMinor | undefined;
  outputRateMinorPerMillionTokens?: MoneyMinor | undefined;
}

export interface CostEvent extends CostEventIdentity, CostBreakdown {
  id: string;
  eventKey: string;
  provider: "deepseek" | (string & {});
  model: string;
  reasoningEffort?: string | undefined;
  agentPreset?: string | undefined;
  parentSessionId?: string | undefined;
  requestStartedAt: string;
  completedAt?: string | undefined;
  status: CostEventStatus;
  source: CostEventSource;
  requestOutcome?: CostRequestOutcome | undefined;
  correctionOfEventId?: string | undefined;
  unknownReason?: CostUnknownReason | undefined;
  cacheHitRateMicroCnyPerMillionTokens?: MoneyMicroCny | undefined;
  cacheMissRateMicroCnyPerMillionTokens?: MoneyMicroCny | undefined;
  outputRateMicroCnyPerMillionTokens?: MoneyMicroCny | undefined;
}

export interface CostAggregateBucket {
  totalMicroCny: MoneyMicroCny;
  settledMicroCny: MoneyMicroCny;
  estimatedMicroCny: MoneyMicroCny;
  failedMicroCny: MoneyMicroCny;
  unknownCount: number;
  eventCount: number;
  peakMicroCny: MoneyMicroCny;
  offpeakMicroCny: MoneyMicroCny;
  cacheHitTokens: TokenCount;
  cacheMissTokens: TokenCount;
  outputTokens: TokenCount;
  reasoningTokens: TokenCount;
  firstActivityAt?: string | undefined;
  lastActivityAt?: string | undefined;
}

export interface CostAggregate {
  global: CostAggregateBucket;
  sessions: Map<string, CostAggregateBucket>;
  days: Map<string, CostAggregateBucket>;
}

export interface MyMeterSessionDto {
  id: string;
  title?: string | undefined;
  parentSessionId?: string | undefined;
  currentModel?: string | undefined;
  reasoningEffort?: string | undefined;
  agentPreset?: string | undefined;
  summary: CostAggregateBucket;
}

export interface MyMeterBalanceDto {
  status: BalanceSnapshotStatus;
  currency?: string | undefined;
  totalMicroCny?: MoneyMicroCny | undefined;
  grantedMicroCny?: MoneyMicroCny | undefined;
  toppedUpMicroCny?: MoneyMicroCny | undefined;
  updatedAt?: string | undefined;
  staleAfterMs?: number | undefined;
  errorMessage?: string | undefined;
}

export interface MyMeterRemoteDto {
  sessions: MyMeterSessionDto[];
  globalSummary: CostAggregateBucket;
  balance?: MyMeterBalanceDto | undefined;
  currentEvent?: CostEvent | undefined;
}

export interface MyMeterDisplayAmount {
  microCny: MoneyMicroCny;
  text: string;
  status: CostDisplayStatus;
}

export interface MyMeterViewModel {
  status: CostDisplayStatus;
  currentRequest: MyMeterDisplayAmount;
  currentSession: MyMeterDisplayAmount;
  localTotal: MyMeterDisplayAmount;
  balance?: MyMeterDisplayAmount | undefined;
  sessions: MyMeterSessionDto[];
  currentEvent?: CostEvent | undefined;
}

export interface MyMeterMockRemote {
  listSessions(): Promise<MyMeterSessionDto[]>;
  getBalance(): Promise<MyMeterBalanceDto>;
  getViewModel(): Promise<MyMeterViewModel>;
}

export const MYMETER_GOLDEN_FIXTURES = {
  version: "mymeter-golden-2026-08-17",
  price: {
    priceVersion: "deepseek-official-pricing-2026-08-17",
    source: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/",
  },
  usage: {
    offpeakFlashWithReasoning: {
      model: "deepseek-v4-flash",
      requestStartedAt: "2026-08-17T12:00:00+08:00",
      usage: {
        cacheHitTokens: 1_000_000,
        cacheMissTokens: 1_000_000,
        outputTokens: 1_000_000,
        reasoningTokens: 400_000,
      },
      expectedPricingZone: "offpeak",
      expectedAmountMicroCny: 6_050_000n,
    },
    peakBoundary: {
      model: "deepseek-v4-pro",
      requestStartedAt: "2026-08-17T09:00:00+08:00",
      usage: {
        cacheHitTokens: 1_000_000,
        cacheMissTokens: 0,
        outputTokens: 0,
      },
      expectedPricingZone: "peak",
      expectedAmountMicroCny: 300_000n,
    },
    unknownModel: {
      model: "deepseek-unknown",
      requestStartedAt: "2026-08-17T12:00:00+08:00",
      usage: {
        cacheHitTokens: 0,
        cacheMissTokens: 10_000,
        outputTokens: 1_000,
      },
      expectedStatus: "unknown",
    },
    failureWithUsage: {
      outcome: "failed",
      expectedStatus: "failed",
      usage: {
        cacheHitTokens: 1_000_000,
        cacheMissTokens: 0,
        outputTokens: 0,
      },
    },
    abortedWithoutUsage: {
      outcome: "aborted",
      expectedStatus: "unknown",
      expectedReason: "missing_usage",
    },
    duplicateUsage: {
      identity: {
        sessionId: "sess-dup",
        turnId: "turn-1",
        stepId: "step-1",
        attemptId: "attempt-1",
      },
      projection: {
        cacheHitTokens: 10,
        cacheMissTokens: 20,
        outputTokens: 30,
        reasoningTokens: 5,
      },
      finalUsage: {
        cacheHitTokens: 10,
        cacheMissTokens: 20,
        outputTokens: 30,
        reasoningTokens: 5,
      },
    },
  },
  balance: {
    stale: {
      status: "stale",
      totalMicroCny: 47_517_000n,
      grantedMicroCny: 40_000_000n,
      toppedUpMicroCny: 7_517_000n,
      updatedAt: "2026-08-17T00:00:00.000Z",
      staleAfterMs: 300_000,
    },
  },
  sessions: [
    {
      id: "sess-mock-1",
      title: "Mock billing session",
      currentModel: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "coding",
      summary: createFixtureBucket({
        totalMicroCny: 6_050_000n,
        settledMicroCny: 6_050_000n,
        cacheHitTokens: 1_000_000n,
        cacheMissTokens: 1_000_000n,
        outputTokens: 1_000_000n,
        reasoningTokens: 400_000n,
        offpeakMicroCny: 6_050_000n,
        eventCount: 1,
      }),
    },
    {
      id: "sess-mock-unknown",
      title: "Mock unknown cost session",
      currentModel: "deepseek-unknown",
      summary: createFixtureBucket({
        unknownCount: 1,
        eventCount: 1,
      }),
    },
  ],
} as const;

export function createCostEventKey(identity: CostEventIdentity): string {
  return [
    normalizeKeyPart(identity.sessionId, "sessionId"),
    normalizeKeyPart(identity.turnId, "turnId"),
    normalizeKeyPart(identity.stepId, "stepId"),
    normalizeKeyPart(identity.attemptId, "attemptId"),
  ].join(":");
}

export function getCostStatusMessageKey(status: CostDisplayStatus): string {
  return `mymeter.cost.status.${status}`;
}

export function isBillableCostEvent(status: CostEventStatus): boolean {
  return status === "estimated" || status === "settled" || status === "failed";
}

export function formatMoneyMicroCny(
  amountMicroCny: MoneyMicroCny,
  options: {
    status?: CostDisplayStatus | undefined;
    precision?: 3 | 6 | undefined;
    unknownLabel?: string | undefined;
  } = {},
): string {
  const status = options.status;
  if (status === "unavailable") {
    return options.unknownLabel ?? "不可用";
  }

  const precision = options.precision ?? 3;
  const sign = amountMicroCny < 0n ? "-" : "";
  const absolute = amountMicroCny < 0n ? -amountMicroCny : amountMicroCny;
  const scale = 10n ** BigInt(6 - precision);
  const rounded = roundDiv(absolute, scale);
  const whole = rounded / 10n ** BigInt(precision);
  const fraction = rounded % 10n ** BigInt(precision);

  if (precision === 3 && absolute > 0n && absolute < 1_000n) {
    const formatted = `${sign}<¥0.001`;
    return status === "unknown" ? `${formatted}（估算）` : formatted;
  }

  const formatted = `${sign}¥${whole.toString()}.${fraction.toString().padStart(precision, "0")}`;
  return status === "unknown" ? `${formatted}（估算）` : formatted;
}

export function createEmptyAggregateBucket(): CostAggregateBucket {
  return {
    totalMicroCny: 0n,
    settledMicroCny: 0n,
    estimatedMicroCny: 0n,
    failedMicroCny: 0n,
    unknownCount: 0,
    eventCount: 0,
    peakMicroCny: 0n,
    offpeakMicroCny: 0n,
    cacheHitTokens: 0n,
    cacheMissTokens: 0n,
    outputTokens: 0n,
    reasoningTokens: 0n,
  };
}

export function createMyMeterViewModel(remote: MyMeterRemoteDto): MyMeterViewModel {
  const current = remote.currentEvent;
  const currentStatus = current?.status ?? "idle";
  return {
    status: currentStatus,
    currentRequest: createDisplayAmount(current?.amountMicroCny ?? 0n, currentStatus),
    currentSession: createDisplayAmount(
      current ? (remote.sessions.find((session) => session.id === current.sessionId)?.summary.totalMicroCny ?? 0n) : 0n,
      currentStatus,
    ),
    localTotal: createDisplayAmount(remote.globalSummary.totalMicroCny, "settled"),
    balance: remote.balance
      ? createDisplayAmount(remote.balance.totalMicroCny ?? 0n, remote.balance.status)
      : undefined,
    sessions: remote.sessions,
    currentEvent: remote.currentEvent,
  };
}

export function createMockMyMeterRemote(): MyMeterMockRemote {
  const listSessions = async (): Promise<MyMeterSessionDto[]> =>
    MYMETER_GOLDEN_FIXTURES.sessions.map((session) => ({
      ...session,
      summary: { ...session.summary },
    }));
  const getBalance = async (): Promise<MyMeterBalanceDto> => ({
    ...MYMETER_GOLDEN_FIXTURES.balance.stale,
  });

  return {
    listSessions,
    getBalance,
    getViewModel: async () => {
      const sessions = await listSessions();
      return createMyMeterViewModel({
        sessions,
        globalSummary: mergeFixtureSummaries(sessions.map((session) => session.summary)),
        balance: await getBalance(),
      });
    },
  };
}

function createDisplayAmount(microCny: MoneyMicroCny, status: CostDisplayStatus): MyMeterDisplayAmount {
  return {
    microCny,
    status,
    text: formatMoneyMicroCny(microCny, { status }),
  };
}

function normalizeKeyPart(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${name} must be a non-empty string`);
  }
  if (normalized.includes(":")) {
    throw new Error(`${name} must not contain ':'`);
  }
  return normalized;
}

function roundDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor / 2n) / divisor;
}

function createFixtureBucket(values: Partial<CostAggregateBucket>): CostAggregateBucket {
  return {
    ...createEmptyAggregateBucket(),
    ...values,
  };
}

function mergeFixtureSummaries(summaries: CostAggregateBucket[]): CostAggregateBucket {
  const merged = createEmptyAggregateBucket();
  for (const summary of summaries) {
    merged.totalMicroCny += summary.totalMicroCny;
    merged.settledMicroCny += summary.settledMicroCny;
    merged.estimatedMicroCny += summary.estimatedMicroCny;
    merged.failedMicroCny += summary.failedMicroCny;
    merged.unknownCount += summary.unknownCount;
    merged.eventCount += summary.eventCount;
    merged.peakMicroCny += summary.peakMicroCny;
    merged.offpeakMicroCny += summary.offpeakMicroCny;
    merged.cacheHitTokens += summary.cacheHitTokens;
    merged.cacheMissTokens += summary.cacheMissTokens;
    merged.outputTokens += summary.outputTokens;
    merged.reasoningTokens += summary.reasoningTokens;
  }
  return merged;
}
