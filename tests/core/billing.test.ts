import { strict as assert } from "node:assert";
import {
  aggregateCostEvents,
  calculateDeepSeekUsageCost,
  calculateProviderUsageCost,
  createCostEventKey,
  createCostEventJournal,
  createDeepSeekPriceDirectory,
  createXaiPriceDirectory,
  createMockMyMeterRemote,
  createUnknownCostEvent,
  dedupeCostEvents,
  estimateDeepSeekCostEvent,
  finalizeDeepSeekCostEvent,
  formatMoneyMicroCny,
  getCostStatusMessageKey,
  MYMETER_GOLDEN_FIXTURES,
  resolveDeepSeekPricingZone,
  listPriceCatalogProviders,
  resolvePricingCatalogKind,
} from "../../packages/core/src/index";

test("deepseek peak and offpeak zones lock on Beijing request start", () => {
  assert.equal(resolveDeepSeekPricingZone("2026-08-17T08:59:59+08:00"), "offpeak");
  assert.equal(resolveDeepSeekPricingZone("2026-08-17T09:00:00+08:00"), "peak");
  assert.equal(resolveDeepSeekPricingZone("2026-08-17T11:59:59+08:00"), "peak");
  assert.equal(resolveDeepSeekPricingZone("2026-08-17T12:00:00+08:00"), "offpeak");
  assert.equal(resolveDeepSeekPricingZone("2026-08-17T13:59:59+08:00"), "offpeak");
  assert.equal(resolveDeepSeekPricingZone("2026-08-17T14:00:00+08:00"), "peak");
  assert.equal(resolveDeepSeekPricingZone("2026-08-17T17:59:59+08:00"), "peak");
  assert.equal(resolveDeepSeekPricingZone("2026-08-17T18:00:00+08:00"), "offpeak");
});

test("price directory exposes the current deepseek-v4-flash and deepseek-v4-pro rates", () => {
  const directory = createDeepSeekPriceDirectory();

  const flashPeak = directory.lookup({
    model: "deepseek-v4-flash",
    requestStartedAt: "2026-08-17T09:00:00+08:00",
  });
  assert.equal(flashPeak.ok, true);
  if (flashPeak.ok) {
    assert.equal(flashPeak.quote.pricingZone, "peak");
    assert.equal(flashPeak.quote.priceVersion, directory.priceVersion);
    assert.equal(flashPeak.quote.cacheHitMicroCnyPerMillionTokens, 100000n);
    assert.equal(flashPeak.quote.cacheMissMicroCnyPerMillionTokens, 3000000n);
    assert.equal(flashPeak.quote.outputMicroCnyPerMillionTokens, 9000000n);
  }

  const proOffpeak = directory.lookup({
    model: "deepseek-v4-pro",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
  });
  assert.equal(proOffpeak.ok, true);
  if (proOffpeak.ok) {
    assert.equal(proOffpeak.quote.pricingZone, "offpeak");
    assert.equal(proOffpeak.quote.cacheHitMicroCnyPerMillionTokens, 150000n);
    assert.equal(proOffpeak.quote.cacheMissMicroCnyPerMillionTokens, 4500000n);
    assert.equal(proOffpeak.quote.outputMicroCnyPerMillionTokens, 13500000n);
  }
});

test("DeepSeek V4 Flash Vision Exp uses the official Flash rates in both pricing zones", () => {
  const directory = createDeepSeekPriceDirectory();
  const peak = directory.lookup({
    model: "DeepSeek-V4-Flash-Vision-Exp",
    requestStartedAt: "2026-08-21T09:00:00+08:00",
  });
  const offpeak = directory.lookup({
    model: "deepseek-v4-flash-vision-exp",
    requestStartedAt: "2026-08-21T12:00:00+08:00",
  });

  assert.equal(directory.priceVersion, "deepseek-official-pricing-2026-08-21");
  assert.ok(directory.listModels().includes("deepseek-v4-flash-vision-exp"));
  assert.equal(peak.ok, true);
  assert.equal(offpeak.ok, true);
  if (peak.ok && offpeak.ok) {
    assert.deepEqual(
      [
        peak.quote.cacheHitMicroCnyPerMillionTokens,
        peak.quote.cacheMissMicroCnyPerMillionTokens,
        peak.quote.outputMicroCnyPerMillionTokens,
      ],
      [100_000n, 3_000_000n, 9_000_000n],
    );
    assert.deepEqual(
      [
        offpeak.quote.cacheHitMicroCnyPerMillionTokens,
        offpeak.quote.cacheMissMicroCnyPerMillionTokens,
        offpeak.quote.outputMicroCnyPerMillionTokens,
      ],
      [50_000n, 1_500_000n, 4_500_000n],
    );
  }
});

test("xAI price directory uses the official Grok rates without peak/offpeak pricing", () => {
  const directory = createXaiPriceDirectory();
  const result = directory.lookup({ model: "grok-4.6" });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.quote.rateTier, "short_context");
    assert.equal(result.quote.pricingZone, "unknown");
    assert.equal(result.quote.priceVersion, "xai-official-pricing-2026-08-18-usd");
    assert.equal(result.quote.cacheMissMicroCnyPerMillionTokens, 14_400_000n);
    assert.equal(result.quote.cacheHitMicroCnyPerMillionTokens, 3_600_000n);
    assert.equal(result.quote.outputMicroCnyPerMillionTokens, 43_200_000n);
    assert.equal(result.quote.currency, "USD");
    assert.equal(result.quote.cacheHitMinorPerMillionTokens, 500_000n);
    assert.equal(result.quote.cacheMissMinorPerMillionTokens, 2_000_000n);
    assert.equal(result.quote.outputMinorPerMillionTokens, 6_000_000n);
  }

  const longContext = directory.lookup({ model: "grok-4.6", inputTokens: 200_000 });
  assert.equal(longContext.ok, true);
  if (longContext.ok) {
    assert.equal(longContext.quote.rateTier, "long_context");
    assert.equal(longContext.quote.cacheMissMicroCnyPerMillionTokens, 28_800_000n);
    assert.equal(longContext.quote.cacheHitMicroCnyPerMillionTokens, 7_200_000n);
    assert.equal(longContext.quote.outputMicroCnyPerMillionTokens, 86_400_000n);
  }
});

test("additional provider price catalogs use their own snapshots and USD conversion", () => {
  const result = calculateProviderUsageCost({
    provider: "openai",
    model: "gpt-5.4",
    usage: {
      cacheHitTokens: 100_000,
      cacheMissTokens: 100_000,
      outputTokens: 100_000,
    },
  });

  assert.equal(resolvePricingCatalogKind("openai", "gpt-5.4"), "openai");
  assert.equal(result.status, "settled");
  assert.equal(result.pricingZone, "unknown");
  assert.equal(result.priceVersion, "openai-official-pricing-2026-08-18-usd");
  assert.equal(result.cacheHitRateMicroCnyPerMillionTokens, 1_800_000n);
  assert.equal(result.cacheMissRateMicroCnyPerMillionTokens, 18_000_000n);
  assert.equal(result.outputRateMicroCnyPerMillionTokens, 108_000_000n);
  assert.equal(result.amountMicroCny, 12_780_000n);
  assert.equal(result.currency, "USD");
  assert.equal(result.amountMinor, 1_775_000n);
  assert.ok(listPriceCatalogProviders().includes("anthropic"));
  assert.ok(listPriceCatalogProviders().includes("google"));
});

test("Kimi Code usage is estimated with the corresponding Kimi API price", () => {
  const result = calculateProviderUsageCost({
    provider: "kimi-coding",
    model: "k3-256k",
    usage: {
      cacheHitTokens: 25_120_512,
      cacheMissTokens: 696_881,
      outputTokens: 176_201,
    },
  });

  assert.equal(result.provider, "kimi-coding");
  assert.equal(result.model, "k3-256k");
  assert.equal(result.status, "settled");
  assert.equal(result.priceVersion, "moonshotai-official-pricing-2026-08-18-usd");
  assert.equal(result.currency, "USD");
  assert.equal(result.cacheHitRateMinorPerMillionTokens, 300_000n);
  assert.equal(result.cacheMissRateMinorPerMillionTokens, 3_000_000n);
  assert.equal(result.outputRateMinorPerMillionTokens, 15_000_000n);
  assert.equal(result.amountMinor, 12_269_812n);
  assert.ok(result.amountMicroCny > 0n);
});

test("custom proxy usage is estimated by the uniquely matching model vendor API", () => {
  const result = calculateProviderUsageCost({
    provider: "nexita",
    model: "gpt-5.6-sol",
    usage: { cacheMissTokens: 1_000_000 },
  });

  assert.equal(result.provider, "nexita");
  assert.equal(result.status, "settled");
  assert.equal(result.priceVersion, "openai-official-pricing-2026-08-18-usd");
  assert.equal(result.currency, "USD");
  assert.equal(result.cacheMissRateMinorPerMillionTokens, 10_000_000n);
  assert.equal(result.amountMinor, 10_000_000n);
});

test("provider catalogs apply long-context tiers at the documented threshold", () => {
  const result = calculateProviderUsageCost({
    provider: "openai",
    model: "gpt-5.4",
    usage: { cacheMissTokens: 272_001, outputTokens: 1 },
  });

  assert.equal(result.status, "settled");
  assert.equal(result.cacheMissRateMicroCnyPerMillionTokens, 36_000_000n);
  assert.equal(result.outputRateMicroCnyPerMillionTokens, 162_000_000n);
});

test("calculation uses exact micro-cny arithmetic and does not double count reasoning tokens", () => {
  const result = calculateDeepSeekUsageCost({
    model: "deepseek-v4-flash",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    usage: {
      cacheHitTokens: 1_000_000,
      cacheMissTokens: 1_000_000,
      outputTokens: 1_000_000,
      reasoningTokens: 400_000,
    },
  });

  assert.equal(result.status, "settled");
  assert.equal(result.pricingZone, "offpeak");
  assert.equal(result.priceVersion, "deepseek-official-pricing-2026-08-21");
  assert.equal(result.amountMicroCny, 6_050_000n);
  assert.equal(result.currency, "CNY");
  assert.equal(result.amountMinor, 6_050_000n);
  assert.equal(result.cacheHitMicroCny, 50_000n);
  assert.equal(result.cacheMissMicroCny, 1_500_000n);
  assert.equal(result.outputMicroCny, 4_500_000n);
  assert.equal(result.cacheHitRateMicroCnyPerMillionTokens, 50_000n);
  assert.equal(result.cacheMissRateMicroCnyPerMillionTokens, 1_500_000n);
  assert.equal(result.outputRateMicroCnyPerMillionTokens, 4_500_000n);
  assert.equal(result.reasoningTokens, 400_000n);
  assert.equal(result.reasoningTokensIncludedInOutput, true);
});

test("status helpers format a missing projection as an explicit estimate", () => {
  const estimate = estimateDeepSeekCostEvent({
    id: "evt-estimate",
    sessionId: "sess-1",
    turnId: "turn-1",
    stepId: "step-1",
    attemptId: "attempt-1",
    model: "deepseek-v4-flash",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
  });

  assert.equal(estimate.status, "estimated");
  assert.equal(getCostStatusMessageKey(estimate.status), "mymeter.cost.status.estimated");
  assert.equal(formatMoneyMicroCny(estimate.amountMicroCny, { status: estimate.status }), "¥0.000");
});

test("unknown models, failed requests and aborted requests use explicit cost states", () => {
  const unknownModel = calculateDeepSeekUsageCost({
    model: "deepseek-unknown",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    usage: {
      cacheHitTokens: 0,
      cacheMissTokens: 10_000,
      outputTokens: 1_000,
    },
  });
  assert.equal(unknownModel.status, "estimated");
  assert.equal(unknownModel.amountMicroCny, 19_500n);
  assert.equal(formatMoneyMicroCny(unknownModel.amountMicroCny, { status: unknownModel.status }), "¥0.020");

  const failedWithUsage = finalizeDeepSeekCostEvent({
    id: "evt-failed",
    sessionId: "sess-1",
    turnId: "turn-2",
    stepId: "step-1",
    attemptId: "attempt-1",
    model: "deepseek-v4-pro",
    requestStartedAt: "2026-08-17T09:00:00+08:00",
    requestOutcome: "failed",
    usage: {
      cacheHitTokens: 1_000_000,
      cacheMissTokens: 0,
      outputTokens: 0,
    },
  });
  assert.equal(failedWithUsage.status, "failed");
  assert.equal(failedWithUsage.amountMicroCny, 300_000n);

  const abortedWithoutUsage = finalizeDeepSeekCostEvent({
    id: "evt-aborted",
    sessionId: "sess-1",
    turnId: "turn-3",
    stepId: "step-1",
    attemptId: "attempt-1",
    model: "deepseek-v4-flash",
    requestStartedAt: "2026-08-17T09:00:00+08:00",
    requestOutcome: "aborted",
  });
  assert.equal(abortedWithoutUsage.status, "failed");
  assert.equal(abortedWithoutUsage.amountMicroCny, 0n);
});

test("unsupported providers keep usage unknown without inheriting DeepSeek pricing", () => {
  const event = createUnknownCostEvent({
    id: "grok-final",
    provider: "cpa",
    sessionId: "sess-grok",
    turnId: "turn-1",
    stepId: "step-1",
    attemptId: "attempt-1",
    model: "grok-4.6",
    requestStartedAt: "2026-08-18T14:00:00+08:00",
  }, {
    source: "final_usage",
    usage: { cacheMissTokens: 886, outputTokens: 409, cacheHitTokens: 192 },
  });

  assert.equal(event.provider, "cpa");
  assert.equal(event.model, "grok-4.6");
  assert.equal(event.status, "unknown");
  assert.equal(event.pricingZone, "unknown");
  assert.equal(event.priceVersion, "");
  assert.equal(event.amountMicroCny, 0n);
  assert.equal(event.cacheMissTokens, 886n);
  assert.equal(event.outputTokens, 409n);
  assert.equal(event.cacheHitTokens, 192n);
  assert.equal(event.cacheMissRateMicroCnyPerMillionTokens, 0n);
});

test("final usage replaces the estimate and dedupe keeps only one canonical event", () => {
  const key = createCostEventKey({
    sessionId: "sess-1",
    turnId: "turn-1",
    stepId: "step-1",
    attemptId: "attempt-1",
  });

  const estimate = estimateDeepSeekCostEvent({
    id: "evt-stream",
    sessionId: "sess-1",
    turnId: "turn-1",
    stepId: "step-1",
    attemptId: "attempt-1",
    model: "deepseek-v4-flash",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    usageProjection: {
      cacheHitTokens: 10,
      cacheMissTokens: 20,
      outputTokens: 30,
      reasoningTokens: 5,
    },
  });
  const settled = finalizeDeepSeekCostEvent({
    id: "evt-final",
    sessionId: "sess-1",
    turnId: "turn-1",
    stepId: "step-1",
    attemptId: "attempt-1",
    model: "deepseek-v4-flash",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    usage: {
      cacheHitTokens: 10,
      cacheMissTokens: 20,
      outputTokens: 30,
      reasoningTokens: 5,
    },
    previousEvent: estimate,
    requestOutcome: "success",
  });

  assert.equal(key, estimate.eventKey);
  assert.equal(settled.status, "settled");
  assert.equal(settled.correctionOfEventId, "evt-stream");
  assert.equal(settled.eventKey, key);

  const deduped = dedupeCostEvents([estimate, settled]);
  assert.equal(deduped.length, 1);
  const canonical = deduped[0];
  assert.ok(canonical);
  assert.equal(canonical.id, "evt-final");
  assert.equal(canonical.status, "settled");
});

test("finalization without usage keeps the last reliable estimate", () => {
  const estimate = estimateDeepSeekCostEvent({
    id: "evt-stream-no-final-usage",
    sessionId: "sess-1",
    turnId: "turn-1",
    stepId: "step-1",
    attemptId: "attempt-1",
    model: "deepseek-v4-flash",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    usageProjection: {
      cacheHitTokens: 10_000,
      cacheMissTokens: 20_000,
      outputTokens: 30_000,
      reasoningTokens: 5_000,
    },
  });

  const finalized = finalizeDeepSeekCostEvent({
    id: "evt-final-no-usage",
    sessionId: "sess-1",
    turnId: "turn-1",
    stepId: "step-1",
    attemptId: "attempt-1",
    model: "deepseek-v4-flash",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    requestOutcome: "success",
    previousEvent: estimate,
  });

  assert.equal(finalized.status, "estimated");
  assert.equal(finalized.amountMicroCny, estimate.amountMicroCny);
  assert.equal(finalized.cacheMissTokens, estimate.cacheMissTokens);
  assert.equal(finalized.correctionOfEventId, estimate.id);
});

test("legacy DeepSeek chat model names resolve to estimable price quotes", () => {
  const chat = calculateDeepSeekUsageCost({
    model: "deepseek-chat",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    usage: { outputTokens: 1_000_000 },
  });
  const reasoner = calculateDeepSeekUsageCost({
    model: "deepseek-reasoner",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    usage: { outputTokens: 1_000_000 },
  });

  assert.equal(chat.status, "settled");
  assert.equal(chat.amountMicroCny, 4_500_000n);
  assert.equal(reasoner.status, "settled");
  assert.equal(reasoner.amountMicroCny, 13_500_000n);
});

test("aggregation splits session, day, global and unknown totals without double counting", () => {
  const aggregate = aggregateCostEvents([
    {
      id: "evt-1",
      eventKey: "sess-1:turn-1:step-1:attempt-1",
      sessionId: "sess-1",
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-1",
      status: "estimated",
      source: "stream",
      amountMicroCny: 100n,
      requestStartedAt: "2026-08-17T01:00:00.000Z",
      completedAt: "2026-08-17T01:00:01.000Z",
      pricingZone: "peak",
      priceVersion: "deepseek-official-pricing-2026-08-17",
      model: "deepseek-v4-flash",
      provider: "deepseek",
      cacheHitTokens: 0n,
      cacheMissTokens: 0n,
      outputTokens: 1n,
      reasoningTokens: 0n,
      cacheHitMicroCny: 0n,
      cacheMissMicroCny: 0n,
      outputMicroCny: 100n,
      requestOutcome: "success",
      correctionOfEventId: undefined,
    },
    {
      id: "evt-2",
      eventKey: "sess-1:turn-1:step-1:attempt-1",
      sessionId: "sess-1",
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-1",
      status: "settled",
      source: "final_usage",
      amountMicroCny: 300n,
      requestStartedAt: "2026-08-17T01:00:00.000Z",
      completedAt: "2026-08-17T01:00:02.000Z",
      pricingZone: "peak",
      priceVersion: "deepseek-official-pricing-2026-08-17",
      model: "deepseek-v4-flash",
      provider: "deepseek",
      cacheHitTokens: 0n,
      cacheMissTokens: 0n,
      outputTokens: 1n,
      reasoningTokens: 0n,
      cacheHitMicroCny: 0n,
      cacheMissMicroCny: 0n,
      outputMicroCny: 300n,
      requestOutcome: "success",
      correctionOfEventId: "evt-1",
    },
    {
      id: "evt-3",
      eventKey: "sess-2:turn-1:step-1:attempt-1",
      sessionId: "sess-2",
      turnId: "turn-1",
      stepId: "step-1",
      attemptId: "attempt-1",
      status: "unknown",
      source: "stream",
      amountMicroCny: 0n,
      requestStartedAt: "2026-08-17T02:00:00.000Z",
      completedAt: undefined,
      pricingZone: "unknown",
      priceVersion: "deepseek-official-pricing-2026-08-17",
      model: "deepseek-v4-flash",
      provider: "deepseek",
      cacheHitTokens: 0n,
      cacheMissTokens: 0n,
      outputTokens: 0n,
      reasoningTokens: 0n,
      cacheHitMicroCny: 0n,
      cacheMissMicroCny: 0n,
      outputMicroCny: 0n,
      requestOutcome: undefined,
      correctionOfEventId: undefined,
    },
  ]);

  assert.equal(aggregate.global.totalMicroCny, 300n);
  assert.equal(aggregate.global.unknownCount, 1);
  assert.equal(aggregate.sessions.get("sess-1")?.totalMicroCny, 300n);
  assert.equal(aggregate.sessions.get("sess-2")?.unknownCount, 1);
  assert.equal(aggregate.days.get("2026-08-17")?.totalMicroCny, 300n);
});

test("journal and golden fixtures cover repeated final usage, stale balance and safe mock DTOs", async () => {
  assert.equal(MYMETER_GOLDEN_FIXTURES.version, "mymeter-golden-2026-08-17");
  assert.equal(MYMETER_GOLDEN_FIXTURES.usage.offpeakFlashWithReasoning.expectedAmountMicroCny, 6_050_000n);
  assert.equal(MYMETER_GOLDEN_FIXTURES.balance.stale.status, "stale");

  const estimate = estimateDeepSeekCostEvent({
    id: "evt-stream",
    sessionId: "sess-dup",
    turnId: "turn-1",
    stepId: "step-1",
    attemptId: "attempt-1",
    model: "deepseek-v4-flash",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    usageProjection: MYMETER_GOLDEN_FIXTURES.usage.duplicateUsage.projection,
  });
  const final = finalizeDeepSeekCostEvent({
    id: "evt-final",
    sessionId: "sess-dup",
    turnId: "turn-1",
    stepId: "step-1",
    attemptId: "attempt-1",
    model: "deepseek-v4-flash",
    requestStartedAt: "2026-08-17T12:00:00+08:00",
    usage: MYMETER_GOLDEN_FIXTURES.usage.duplicateUsage.finalUsage,
    previousEvent: estimate,
  });
  const journal = createCostEventJournal([estimate]);
  journal.upsert(final);
  journal.upsert(final);
  assert.equal(journal.list().length, 1);
  assert.equal(journal.list()[0]?.status, "settled");

  const remote = createMockMyMeterRemote();
  const sessions = await remote.listSessions();
  assert.equal("apiKey" in sessions[0]!, false);
  assert.equal("prompt" in sessions[0]!, false);
  assert.equal("completion" in sessions[0]!, false);
  assert.equal((await remote.getBalance()).status, "stale");
});
