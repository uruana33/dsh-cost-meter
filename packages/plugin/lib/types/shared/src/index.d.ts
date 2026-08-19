export declare const MICRO_CNY_PER_CNY = 1000000n;
export declare const TOKENS_PER_MILLION = 1000000n;
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
export type CostUnknownReason = "missing_usage" | "missing_projection" | "unreliable_projection" | "model_not_found" | "rate_not_found" | "invalid_usage";
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
export declare const MYMETER_GOLDEN_FIXTURES: {
    readonly version: "mymeter-golden-2026-08-17";
    readonly price: {
        readonly priceVersion: "deepseek-official-pricing-2026-08-17";
        readonly source: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";
    };
    readonly usage: {
        readonly offpeakFlashWithReasoning: {
            readonly model: "deepseek-v4-flash";
            readonly requestStartedAt: "2026-08-17T12:00:00+08:00";
            readonly usage: {
                readonly cacheHitTokens: 1000000;
                readonly cacheMissTokens: 1000000;
                readonly outputTokens: 1000000;
                readonly reasoningTokens: 400000;
            };
            readonly expectedPricingZone: "offpeak";
            readonly expectedAmountMicroCny: 6050000n;
        };
        readonly peakBoundary: {
            readonly model: "deepseek-v4-pro";
            readonly requestStartedAt: "2026-08-17T09:00:00+08:00";
            readonly usage: {
                readonly cacheHitTokens: 1000000;
                readonly cacheMissTokens: 0;
                readonly outputTokens: 0;
            };
            readonly expectedPricingZone: "peak";
            readonly expectedAmountMicroCny: 300000n;
        };
        readonly unknownModel: {
            readonly model: "deepseek-unknown";
            readonly requestStartedAt: "2026-08-17T12:00:00+08:00";
            readonly usage: {
                readonly cacheHitTokens: 0;
                readonly cacheMissTokens: 10000;
                readonly outputTokens: 1000;
            };
            readonly expectedStatus: "unknown";
        };
        readonly failureWithUsage: {
            readonly outcome: "failed";
            readonly expectedStatus: "failed";
            readonly usage: {
                readonly cacheHitTokens: 1000000;
                readonly cacheMissTokens: 0;
                readonly outputTokens: 0;
            };
        };
        readonly abortedWithoutUsage: {
            readonly outcome: "aborted";
            readonly expectedStatus: "unknown";
            readonly expectedReason: "missing_usage";
        };
        readonly duplicateUsage: {
            readonly identity: {
                readonly sessionId: "sess-dup";
                readonly turnId: "turn-1";
                readonly stepId: "step-1";
                readonly attemptId: "attempt-1";
            };
            readonly projection: {
                readonly cacheHitTokens: 10;
                readonly cacheMissTokens: 20;
                readonly outputTokens: 30;
                readonly reasoningTokens: 5;
            };
            readonly finalUsage: {
                readonly cacheHitTokens: 10;
                readonly cacheMissTokens: 20;
                readonly outputTokens: 30;
                readonly reasoningTokens: 5;
            };
        };
    };
    readonly balance: {
        readonly stale: {
            readonly status: "stale";
            readonly totalMicroCny: 47517000n;
            readonly grantedMicroCny: 40000000n;
            readonly toppedUpMicroCny: 7517000n;
            readonly updatedAt: "2026-08-17T00:00:00.000Z";
            readonly staleAfterMs: 300000;
        };
    };
    readonly sessions: readonly [{
        readonly id: "sess-mock-1";
        readonly title: "Mock billing session";
        readonly currentModel: "deepseek-v4-flash";
        readonly reasoningEffort: "high";
        readonly agentPreset: "coding";
        readonly summary: CostAggregateBucket;
    }, {
        readonly id: "sess-mock-unknown";
        readonly title: "Mock unknown cost session";
        readonly currentModel: "deepseek-unknown";
        readonly summary: CostAggregateBucket;
    }];
};
export declare function createCostEventKey(identity: CostEventIdentity): string;
export declare function getCostStatusMessageKey(status: CostDisplayStatus): string;
export declare function isBillableCostEvent(status: CostEventStatus): boolean;
export declare function formatMoneyMicroCny(amountMicroCny: MoneyMicroCny, options?: {
    status?: CostDisplayStatus | undefined;
    precision?: 3 | 6 | undefined;
    unknownLabel?: string | undefined;
}): string;
export declare function createEmptyAggregateBucket(): CostAggregateBucket;
export declare function createMyMeterViewModel(remote: MyMeterRemoteDto): MyMeterViewModel;
export declare function createMockMyMeterRemote(): MyMeterMockRemote;
