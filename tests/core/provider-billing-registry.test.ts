import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import {
  createProviderBillingRegistry,
  type ProviderBillingAdapter,
} from "../../packages/core/src/provider-billing-registry";
import { createProviderBillingRegistry as createProviderBillingRegistryFromIndex } from "../../packages/core/src/index";

test("provider registry is exported from core without an index-module cycle", () => {
  const coreEntry = readFileSync("packages/core/src/index.ts", "utf8");
  expect(coreEntry).not.toMatch(/from ["']\.\/provider-billing-registry["']/);
  expect(createProviderBillingRegistryFromIndex).toBe(createProviderBillingRegistry);
  expect(createProviderBillingRegistryFromIndex().listAdapters().map((adapter) => adapter.id)).toEqual([
    "deepseek",
    "xai",
    "catalog",
  ]);
});

test("provider registry routes DeepSeek, xAI, additional catalogs and route aliases", () => {
  const registry = createProviderBillingRegistry();

  const deepseek = registry.calculate({
    provider: "deepseek",
    model: "deepseek-v4-flash",
    requestStartedAt: "2026-08-19T09:00:00+08:00",
    usage: { cacheMissTokens: 1_000_000 },
  });
  assert.equal(deepseek.status, "settled");
  assert.equal(deepseek.provider, "deepseek");
  assert.equal(deepseek.pricingZone, "peak");

  const xai = registry.calculate({
    provider: "cpa",
    model: "grok-4.6",
    requestStartedAt: "2026-08-19T09:00:00+08:00",
    usage: { cacheMissTokens: 1_000_000 },
  });
  assert.equal(xai.status, "settled");
  assert.equal(xai.provider, "cpa");
  assert.equal(xai.priceVersion, "xai-official-pricing-2026-08-18-usd");

  const routed = registry.calculate({
    provider: "openai-codex",
    model: "gpt-5.3-codex",
    requestStartedAt: "2026-08-19T09:00:00+08:00",
    usage: { cacheMissTokens: 1_000_000 },
  });
  assert.equal(routed.status, "settled");
  assert.equal(routed.provider, "openai-codex");
  assert.equal(routed.priceVersion, "openai-official-pricing-2026-08-18-usd");
});

test("provider registry keeps unknown providers unknown", () => {
  const result = createProviderBillingRegistry().calculate({
    provider: "private-gateway",
    model: "private-model",
    requestStartedAt: "2026-08-19T09:00:00+08:00",
    usage: { cacheMissTokens: 123 },
  });

  assert.equal(result.status, "unknown");
  assert.equal(result.provider, "private-gateway");
  assert.equal(result.unknownReason, "model_not_found");
  assert.equal(result.cacheMissTokens, 123n);
});

test("custom provider adapters take precedence without modifying built-in catalogs", () => {
  const custom: ProviderBillingAdapter = {
    id: "private",
    supports: ({ provider }) => provider === "private-gateway",
    calculate: (input) => ({
      provider: input.provider,
      model: input.model,
      status: "settled",
      source: "final_usage",
      priceSource: "local-test",
      pricingZone: "unknown",
      priceVersion: "private-v1",
      amountMicroCny: 7n,
      cacheHitMicroCny: 0n,
      cacheMissMicroCny: 7n,
      outputMicroCny: 0n,
      cacheHitRateMicroCnyPerMillionTokens: 0n,
      cacheMissRateMicroCnyPerMillionTokens: 7n,
      outputRateMicroCnyPerMillionTokens: 0n,
      currency: "CNY",
      amountMinor: 7n,
      cacheHitMinor: 0n,
      cacheMissMinor: 7n,
      outputMinor: 0n,
      cacheHitRateMinorPerMillionTokens: 0n,
      cacheMissRateMinorPerMillionTokens: 7n,
      outputRateMinorPerMillionTokens: 0n,
      cacheHitTokens: 0n,
      cacheMissTokens: 1_000_000n,
      outputTokens: 0n,
      reasoningTokens: 0n,
      reasoningTokensIncludedInOutput: true,
      requestOutcome: "success",
    }),
  };

  const registry = createProviderBillingRegistry({ adapters: [custom] });
  assert.equal(registry.resolve({ provider: "private-gateway", model: "m" })?.id, "private");
  assert.equal(registry.calculate({
    provider: "private-gateway",
    model: "m",
    requestStartedAt: "2026-08-19T09:00:00+08:00",
    usage: { cacheMissTokens: 1_000_000 },
  }).amountMicroCny, 7n);
});
