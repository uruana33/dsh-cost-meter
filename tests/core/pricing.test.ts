import { strict as assert } from "node:assert";
import * as pricingShim from "../../packages/core/src/pricing";
import * as pricingDirectory from "../../packages/core/src/pricing/index";

test("pricing subpath keeps the compatibility barrel while exposing provider files", () => {
  assert.equal(pricingShim.OPENAI_PRICE_VERSION, pricingDirectory.OPENAI_PRICE_VERSION);
  assert.equal(pricingShim.ANTHROPIC_PRICE_VERSION, pricingDirectory.ANTHROPIC_PRICE_VERSION);
  assert.equal(pricingShim.resolvePricingCatalogKind("google", "gemini-3-flash-preview"), "google");
  assert.equal(pricingDirectory.getAdditionalPricingCatalog("openai")?.displayName, "OpenAI");
});

test("price versions are maintained in the shared version registry", () => {
  const versions = pricingDirectory.PRICING_CATALOG_VERSIONS;
  assert.equal(pricingDirectory.DEEPSEEK_PRICE_VERSION, versions.deepseek);
  assert.equal(pricingDirectory.XAI_PRICE_VERSION, versions.xai);
  assert.equal(pricingDirectory.OPENAI_PRICE_VERSION, versions.openai);
  assert.equal(pricingDirectory.ANTHROPIC_PRICE_VERSION, versions.anthropic);
  assert.equal(pricingDirectory.GOOGLE_PRICE_VERSION, versions.google);
  assert.equal(pricingDirectory.MOONSHOTAI_PRICE_VERSION, versions.moonshotai);
  assert.equal(pricingDirectory.MINIMAX_PRICE_VERSION, versions.minimax);
  assert.equal(pricingDirectory.MISTRAL_PRICE_VERSION, versions.mistral);
  assert.equal(pricingDirectory.GROQ_PRICE_VERSION, versions.groq);
  assert.equal(pricingDirectory.TOGETHER_PRICE_VERSION, versions.together);
  assert.equal(pricingDirectory.FIREWORKS_PRICE_VERSION, versions.fireworks);
  assert.equal(pricingDirectory.CEREBRAS_PRICE_VERSION, versions.cerebras);
});

test("each registered provider has a resolvable model and non-zero snapshot rates", () => {
  const cases = [
    ["anthropic", "claude-sonnet-4-6"],
    ["cerebras", "gpt-oss-120b"],
    ["fireworks", "accounts/fireworks/models/gpt-oss-120b"],
    ["google", "gemini-3-flash-preview"],
    ["groq", "llama-3.3-70b-versatile"],
    ["minimax", "MiniMax-M2.7"],
    ["mistral", "mistral-large-latest"],
    ["moonshotai", "kimi-k2.5"],
    ["openai", "gpt-5.4"],
    ["together", "MiniMaxAI/MiniMax-M2.7"],
  ] as const;

  for (const [provider, model] of cases) {
    const result = pricingDirectory.lookupAdditionalPrice(provider, model, 1_000_000);
    assert.ok(result, `${provider}/${model} should be present in the price catalog`);
    assert.ok(result.rates.cacheMissMicroCnyPerMillionTokens > 0n);
    assert.ok(result.rates.outputMicroCnyPerMillionTokens > 0n);
    assert.ok(result.priceVersion.length > 0);
  }
});

test("subscription and proxy routes resolve to the matching vendor API price catalog", () => {
  assert.equal(pricingDirectory.resolvePricingCatalogKind("kimi-coding", "k3-256k"), "moonshotai");
  assert.equal(pricingDirectory.resolvePricingCatalogKind("qwen-token-plan", "kimi-k2.5"), "moonshotai");
  assert.equal(pricingDirectory.resolvePricingCatalogKind("openai-codex", "gpt-5.3-codex"), "openai");
  assert.equal(pricingDirectory.resolvePricingCatalogKind("laoma", "grok-4.6"), "xai");
  assert.equal(pricingDirectory.resolvePricingCatalogKind("nexita", "gpt-5.6-sol"), "openai");
  assert.equal(pricingDirectory.resolvePricingCatalogKind("openai", "grok-4.6"), "xai");
  assert.equal(pricingDirectory.resolvePricingCatalogKind("xai", "gpt-5.4"), "openai");

  const kimi = pricingDirectory.lookupAdditionalPrice("kimi-coding", "k3-256k", 1_000_000);
  assert.ok(kimi);
  assert.equal(kimi.provider, "moonshotai");
  assert.equal(kimi.nativeRates.cacheHitMinorPerMillionTokens, 300_000n);
  assert.equal(kimi.nativeRates.cacheMissMinorPerMillionTokens, 3_000_000n);
  assert.equal(kimi.nativeRates.outputMinorPerMillionTokens, 15_000_000n);
  assert.ok(pricingDirectory.listPriceCatalogProviders().includes("kimi-coding"));
  assert.ok(pricingDirectory.listPriceCatalogProviders().includes("openai-codex"));

  const customRoute = pricingDirectory.lookupAdditionalPrice("my-private-proxy", "gpt-5.4", 1_000_000);
  assert.ok(customRoute);
  assert.equal(customRoute.provider, "openai");
});
