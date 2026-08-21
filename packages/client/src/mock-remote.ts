import type {
  MyMeterRemote,
  MyMeterRemoteSnapshot,
  RemoteSessionDetail,
  RemoteSessionSummary,
  RemoteTokenBucket,
} from "./store";

export type MockScenarioName =
  | "idle"
  | "billing"
  | "settled"
  | "unknown"
  | "balance_expired"
  | "balance_insufficient"
  | "failed"
  | "aborted";

export interface MyMeterMockRemote extends MyMeterRemote {
  setSnapshot(snapshot: MyMeterRemoteSnapshot): void;
  setScenario(scenario: MockScenarioName): void;
}

export function createMockRemote(initial: MockScenarioName | MyMeterRemoteSnapshot = "idle"): MyMeterMockRemote {
  let snapshot = typeof initial === "string" ? createMockRemoteFixtures()[initial] : cloneSnapshot(initial);
  const listeners = new Set<(snapshot: MyMeterRemoteSnapshot) => void>();

  const emit = (): void => {
    const current = cloneSnapshot(snapshot);
    for (const listener of listeners) {
      listener(current);
    }
  };

  return {
    getSnapshot() {
      return cloneSnapshot(snapshot);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSnapshot(nextSnapshot) {
      snapshot = cloneSnapshot(nextSnapshot);
      emit();
    },
    setScenario(scenario) {
      snapshot = createMockRemoteFixtures()[scenario];
      emit();
    },
  };
}

export function createMockRemoteFixtures(): Record<MockScenarioName, MyMeterRemoteSnapshot> {
  const base = createBaseSnapshot();

  return {
    idle: withScenario(base, {
      currentSessionId: "sess-2",
      status: "idle",
      currentRequestMicroCny: 0,
      estimatedTotalMicroCny: 0,
      sessionOneStatus: "settled",
    }),
    billing: withScenario(base, {
      status: "billing",
      currentRequestMicroCny: 4_000,
      estimatedTotalMicroCny: 4_000,
      sessionOneStatus: "billing",
    }),
    settled: withScenario(base, {
      status: "settled",
      currentRequestMicroCny: 0,
      estimatedTotalMicroCny: 0,
      sessionOneStatus: "settled",
    }),
    unknown: withScenario(base, {
      status: "unknown",
      currentRequestMicroCny: 2_500,
      estimatedTotalMicroCny: 2_500,
      sessionOneStatus: "unknown",
      unknownCount: 0,
    }),
    balance_expired: withScenario(base, {
      status: "billing",
      currentRequestMicroCny: 4_000,
      estimatedTotalMicroCny: 4_000,
      balanceStatus: "expired",
      sessionOneStatus: "billing",
    }),
    balance_insufficient: withScenario(base, {
      status: "billing",
      currentRequestMicroCny: 4_000,
      estimatedTotalMicroCny: 4_000,
      balanceStatus: "insufficient",
      balanceTotalMicroCny: 500,
      sessionOneStatus: "billing",
    }),
    failed: withScenario(base, {
      status: "failed",
      currentRequestMicroCny: 0,
      estimatedTotalMicroCny: 0,
      sessionOneStatus: "failed",
    }),
    aborted: withScenario(base, {
      status: "aborted",
      currentRequestMicroCny: 0,
      estimatedTotalMicroCny: 0,
      sessionOneStatus: "aborted",
    }),
  };
}

interface ScenarioPatch {
  currentSessionId?: string;
  status: MyMeterRemoteSnapshot["summary"]["status"]["code"];
  currentRequestMicroCny: number;
  estimatedTotalMicroCny: number;
  sessionOneStatus: RemoteSessionSummary["status"];
  balanceStatus?: MyMeterRemoteSnapshot["balance"]["status"];
  balanceTotalMicroCny?: number;
  unknownCount?: number;
}

function withScenario(snapshot: MyMeterRemoteSnapshot, patch: ScenarioPatch): MyMeterRemoteSnapshot {
  const next = cloneSnapshot(snapshot);
  next.currentSessionId = patch.currentSessionId ?? "sess-1";
  next.summary.status.code = patch.status;
  next.summary.currentRequestMicroCny = patch.currentRequestMicroCny;
  next.summary.estimatedTotalMicroCny = patch.estimatedTotalMicroCny;
  next.balance.status = patch.balanceStatus ?? "fresh";
  next.balance.totalMicroCny = patch.balanceTotalMicroCny ?? 47_517_000;
  const deepSeekBalance = next.balances.find((balance) => balance.supported);
  if (deepSeekBalance) {
    deepSeekBalance.status = next.balance.status;
    deepSeekBalance.totalMicroCny = next.balance.totalMicroCny;
  }

  const sessionOne = next.sessions.find((session) => session.id === "sess-1");
  if (sessionOne) {
    sessionOne.status = patch.sessionOneStatus;
    sessionOne.currentRequestMicroCny = patch.currentRequestMicroCny;
    sessionOne.unknownCount = patch.unknownCount ?? 0;
  }

  const detailOne = next.details["sess-1"];
  if (detailOne) {
    detailOne.status = patch.sessionOneStatus;
    detailOne.currentRequestMicroCny = patch.currentRequestMicroCny;
    detailOne.estimatedTotalMicroCny = patch.estimatedTotalMicroCny;
    detailOne.unknownCount = patch.unknownCount ?? 0;
    const activeTurn = detailOne.turns.at(-1);
    if (activeTurn) {
      activeTurn.status = patch.currentRequestMicroCny > 0 ? "billing" : patch.sessionOneStatus;
      activeTurn.completedAt =
        patch.currentRequestMicroCny > 0 ? null : "2026-08-17T09:24:30.000+08:00";
      activeTurn.amountMicroCny = patch.currentRequestMicroCny;
      activeTurn.note = patch.currentRequestMicroCny > 0 ? "估算中" : null;
    }
  }

  return next;
}

function createBaseSnapshot(): MyMeterRemoteSnapshot {
  const sessions: RemoteSessionSummary[] = [
    {
      id: "sess-1",
      title: "修复登录超时",
      provider: "deepseek",
      model: "deepseek-reasoner",
      reasoningEffort: "High",
      agentPreset: "Coding",
      status: "billing",
      currentRequestMicroCny: 4_000,
      sessionTotalMicroCny: 126_000,
      unknownCount: 0,
      lastActivityAt: "2026-08-17T09:24:30.000+08:00",
    },
    {
      id: "sess-2",
      title: "API 文档整理",
      provider: "deepseek",
      model: "deepseek-chat",
      reasoningEffort: "Medium",
      agentPreset: "Research",
      status: "settled",
      currentRequestMicroCny: 0,
      sessionTotalMicroCny: 83_000,
      unknownCount: 0,
      lastActivityAt: "2026-08-17T08:52:00.000+08:00",
    },
  ];

  const detailOne = createDetail({
    id: "sess-1",
    title: "修复登录超时",
    model: "deepseek-reasoner",
    reasoningEffort: "High",
    agentPreset: "Coding",
    status: "billing",
    currentRequestMicroCny: 4_000,
    sessionTotalMicroCny: 126_000,
  });
  const detailTwo = createDetail({
    id: "sess-2",
    title: "API 文档整理",
    model: "deepseek-chat",
    reasoningEffort: "Medium",
    agentPreset: "Research",
    status: "settled",
    currentRequestMicroCny: 0,
    sessionTotalMicroCny: 83_000,
  });

  return {
    connection: { status: "connected", message: null },
    currentSessionId: "sess-1",
    summary: {
      status: { code: "billing" },
      provider: "deepseek",
      model: "deepseek-reasoner",
      reasoningEffort: "High",
      agentPreset: "Coding",
      currentRequestMicroCny: 4_000,
      sessionTotalMicroCny: 126_000,
      settledTotalMicroCny: 122_000,
      estimatedTotalMicroCny: 4_000,
      localTotalMicroCny: 2_483_000,
      pricingZone: "peak",
    },
    balance: {
      status: "fresh",
      currency: "CNY",
      totalMicroCny: 47_517_000,
      grantedMicroCny: 17_517_000,
      toppedUpMicroCny: 30_000_000,
      refreshedAt: "2026-08-17T09:25:00.000+08:00",
    },
    balances: [{
      provider: "deepseek",
      providerName: "DeepSeek",
      supported: true,
      status: "fresh",
      currency: "CNY",
      totalMicroCny: 47_517_000,
      grantedMicroCny: 17_517_000,
      toppedUpMicroCny: 30_000_000,
      refreshedAt: "2026-08-17T09:25:00.000+08:00",
    }],
    sessions,
    details: {
      "sess-1": detailOne,
      "sess-2": detailTwo,
    },
  };
}

function createDetail(input: {
  id: string;
  title: string;
  model: string;
  reasoningEffort: string;
  agentPreset: string;
  status: RemoteSessionDetail["status"];
  currentRequestMicroCny: number;
  sessionTotalMicroCny: number;
}): RemoteSessionDetail {
  const firstStageAmount = Math.max(0, input.sessionTotalMicroCny - input.currentRequestMicroCny);
  const contextBreakdown = {
    systemTokens: 1_240,
    toolsTokens: 3_680,
    messageTokens: 8_920,
  };
  const turns: RemoteSessionDetail["turns"] = [
    {
      id: `${input.id}-turn-1`,
      label: "轮次 1",
      startedAt: "2026-08-17T09:01:00.000+08:00",
      completedAt: "2026-08-17T09:01:42.000+08:00",
      status: "settled",
      pricingZone: "peak",
      cacheHitTokens: 9_100,
      cacheMissTokens: 16_200,
      outputTokens: 6_400,
      reasoningTokens: 4_100,
      amountMicroCny: firstStageAmount,
      note: "reasoning 已包含在输出费用中",
    },
    {
      id: `${input.id}-turn-2`,
      label: "轮次 2",
      startedAt: "2026-08-17T09:24:00.000+08:00",
      completedAt: input.currentRequestMicroCny > 0 ? null : "2026-08-17T09:24:30.000+08:00",
      status: input.currentRequestMicroCny > 0 ? "billing" : input.status,
      pricingZone: "peak",
      cacheHitTokens: 9_320,
      cacheMissTokens: 15_480,
      outputTokens: 6_130,
      reasoningTokens: 4_110,
      amountMicroCny: input.currentRequestMicroCny,
      note: input.currentRequestMicroCny > 0 ? "估算中" : null,
    },
  ];
  const tokenBuckets = [
    { label: "缓存命中", tokens: 18_420, amountMicroCny: 3_000 },
    { label: "缓存未命中", tokens: 31_680, amountMicroCny: 28_000 },
    { label: "输出", tokens: 12_530, amountMicroCny: Math.max(0, input.sessionTotalMicroCny - 31_000) },
    { label: "其中推理", tokens: 8_210, amountMicroCny: 0 },
  ];
  const hasCurrentStage = input.currentRequestMicroCny > 0 || input.model === "deepseek-reasoner";
  return {
    id: input.id,
    title: input.title,
    provider: "deepseek",
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    agentPreset: input.agentPreset,
    status: input.status,
    pricingZone: "peak",
    currentRequestMicroCny: input.currentRequestMicroCny,
    sessionTotalMicroCny: input.sessionTotalMicroCny,
    settledTotalMicroCny: Math.max(0, input.sessionTotalMicroCny - input.currentRequestMicroCny),
    estimatedTotalMicroCny: input.currentRequestMicroCny,
    unknownCount: 0,
    tokenBuckets,
    contextBreakdown,
    turns,
    stages: hasCurrentStage
      ? [
        {
          id: `${input.id}-stage-1`,
          index: 1,
          isCurrent: false,
          startedAt: "2026-08-17T09:01:00.000+08:00",
          completedAt: "2026-08-17T09:01:42.000+08:00",
          lastActivityAt: "2026-08-17T09:01:42.000+08:00",
          status: "settled",
          model: "deepseek-chat",
          reasoningEffort: "Medium",
          agentPreset: input.agentPreset,
          pricingZone: "peak",
          priceVersion: "deepseek-official-pricing-2026-08-21",
          currentRequestMicroCny: 0,
          totalMicroCny: firstStageAmount,
          settledTotalMicroCny: firstStageAmount,
          estimatedTotalMicroCny: 0,
          unknownCount: 0,
          tokenBuckets: [
            { label: "缓存命中", tokens: 9_100, amountMicroCny: 1_500, unitPriceMicroCnyPerMillionTokens: 100_000 },
            { label: "缓存未命中", tokens: 16_200, amountMicroCny: 14_000, unitPriceMicroCnyPerMillionTokens: 3_000_000 },
            { label: "输出", tokens: 6_400, amountMicroCny: Math.max(0, firstStageAmount - 15_500), unitPriceMicroCnyPerMillionTokens: 9_000_000 },
            { label: "其中推理", tokens: 4_100, amountMicroCny: 0, unitPriceMicroCnyPerMillionTokens: 9_000_000 },
          ],
          turns: [turns[0]!],
          contextBreakdown: null,
        },
        {
          id: `${input.id}-stage-2`,
          index: 2,
          isCurrent: true,
          startedAt: "2026-08-17T09:24:00.000+08:00",
          completedAt: input.currentRequestMicroCny > 0 ? null : "2026-08-17T09:24:30.000+08:00",
          lastActivityAt: input.currentRequestMicroCny > 0
            ? "2026-08-17T09:24:00.000+08:00"
            : "2026-08-17T09:24:30.000+08:00",
          status: input.currentRequestMicroCny > 0 ? "billing" : input.status,
          model: input.model,
          reasoningEffort: input.reasoningEffort,
          agentPreset: input.agentPreset,
          pricingZone: "peak",
          priceVersion: "deepseek-official-pricing-2026-08-21",
          currentRequestMicroCny: input.currentRequestMicroCny,
          totalMicroCny: input.currentRequestMicroCny,
          settledTotalMicroCny: input.currentRequestMicroCny > 0 ? 0 : input.currentRequestMicroCny,
          estimatedTotalMicroCny: input.currentRequestMicroCny,
          unknownCount: 0,
          tokenBuckets: [
            { label: "缓存命中", tokens: 9_320, amountMicroCny: 1_500, unitPriceMicroCnyPerMillionTokens: 300_000 },
            { label: "缓存未命中", tokens: 15_480, amountMicroCny: 14_000, unitPriceMicroCnyPerMillionTokens: 9_000_000 },
            { label: "输出", tokens: 6_130, amountMicroCny: Math.max(0, input.currentRequestMicroCny - 15_500), unitPriceMicroCnyPerMillionTokens: 27_000_000 },
            { label: "其中推理", tokens: 4_110, amountMicroCny: 0, unitPriceMicroCnyPerMillionTokens: 27_000_000 },
          ],
          turns: [turns[1]!],
          contextBreakdown,
        },
      ]
      : [
        {
          id: `${input.id}-stage-1`,
          index: 1,
          isCurrent: true,
          startedAt: "2026-08-17T09:01:00.000+08:00",
          completedAt: "2026-08-17T09:24:30.000+08:00",
          lastActivityAt: "2026-08-17T09:24:30.000+08:00",
          status: input.status,
          model: input.model,
          reasoningEffort: input.reasoningEffort,
          agentPreset: input.agentPreset,
          pricingZone: "peak",
          priceVersion: "deepseek-official-pricing-2026-08-21",
          currentRequestMicroCny: input.currentRequestMicroCny,
          totalMicroCny: input.sessionTotalMicroCny,
          settledTotalMicroCny: Math.max(0, input.sessionTotalMicroCny - input.currentRequestMicroCny),
          estimatedTotalMicroCny: input.currentRequestMicroCny,
          unknownCount: 0,
          tokenBuckets: withMockUnitPrices(tokenBuckets, input.model),
          turns,
          contextBreakdown,
        },
      ],
  };
}

function withMockUnitPrices(buckets: RemoteTokenBucket[], model: string): RemoteTokenBucket[] {
  const isReasoner = /reasoner|pro/i.test(model);
  const rates = isReasoner
    ? { cacheHit: 300_000, cacheMiss: 9_000_000, output: 27_000_000 }
    : { cacheHit: 100_000, cacheMiss: 3_000_000, output: 9_000_000 };
  return buckets.map((bucket) => ({
    ...bucket,
    unitPriceMicroCnyPerMillionTokens: bucket.label === "缓存命中"
      ? rates.cacheHit
      : bucket.label === "缓存未命中"
        ? rates.cacheMiss
        : rates.output,
  }));
}

function cloneSnapshot(snapshot: MyMeterRemoteSnapshot): MyMeterRemoteSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as MyMeterRemoteSnapshot;
}
