// packages/plugin/src/index.tsx
import { createElement } from "react";

// packages/shared/src/index.ts
var TOKENS_PER_MILLION = 1000000n;
var MYMETER_GOLDEN_FIXTURES = {
  version: "mymeter-golden-2026-08-17",
  price: {
    priceVersion: "deepseek-official-pricing-2026-08-17",
    source: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/"
  },
  usage: {
    offpeakFlashWithReasoning: {
      model: "deepseek-v4-flash",
      requestStartedAt: "2026-08-17T12:00:00+08:00",
      usage: {
        cacheHitTokens: 1e6,
        cacheMissTokens: 1e6,
        outputTokens: 1e6,
        reasoningTokens: 4e5
      },
      expectedPricingZone: "offpeak",
      expectedAmountMicroCny: 6050000n
    },
    peakBoundary: {
      model: "deepseek-v4-pro",
      requestStartedAt: "2026-08-17T09:00:00+08:00",
      usage: {
        cacheHitTokens: 1e6,
        cacheMissTokens: 0,
        outputTokens: 0
      },
      expectedPricingZone: "peak",
      expectedAmountMicroCny: 300000n
    },
    unknownModel: {
      model: "deepseek-unknown",
      requestStartedAt: "2026-08-17T12:00:00+08:00",
      usage: {
        cacheHitTokens: 0,
        cacheMissTokens: 1e4,
        outputTokens: 1e3
      },
      expectedStatus: "unknown"
    },
    failureWithUsage: {
      outcome: "failed",
      expectedStatus: "failed",
      usage: {
        cacheHitTokens: 1e6,
        cacheMissTokens: 0,
        outputTokens: 0
      }
    },
    abortedWithoutUsage: {
      outcome: "aborted",
      expectedStatus: "unknown",
      expectedReason: "missing_usage"
    },
    duplicateUsage: {
      identity: {
        sessionId: "sess-dup",
        turnId: "turn-1",
        stepId: "step-1",
        attemptId: "attempt-1"
      },
      projection: {
        cacheHitTokens: 10,
        cacheMissTokens: 20,
        outputTokens: 30,
        reasoningTokens: 5
      },
      finalUsage: {
        cacheHitTokens: 10,
        cacheMissTokens: 20,
        outputTokens: 30,
        reasoningTokens: 5
      }
    }
  },
  balance: {
    stale: {
      status: "stale",
      totalMicroCny: 47517000n,
      grantedMicroCny: 40000000n,
      toppedUpMicroCny: 7517000n,
      updatedAt: "2026-08-17T00:00:00.000Z",
      staleAfterMs: 3e5
    }
  },
  sessions: [
    {
      id: "sess-mock-1",
      title: "Mock billing session",
      currentModel: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "coding",
      summary: createFixtureBucket({
        totalMicroCny: 6050000n,
        settledMicroCny: 6050000n,
        cacheHitTokens: 1000000n,
        cacheMissTokens: 1000000n,
        outputTokens: 1000000n,
        reasoningTokens: 400000n,
        offpeakMicroCny: 6050000n,
        eventCount: 1
      })
    },
    {
      id: "sess-mock-unknown",
      title: "Mock unknown cost session",
      currentModel: "deepseek-unknown",
      summary: createFixtureBucket({
        unknownCount: 1,
        eventCount: 1
      })
    }
  ]
};
function createCostEventKey(identity) {
  return [
    normalizeKeyPart(identity.sessionId, "sessionId"),
    normalizeKeyPart(identity.turnId, "turnId"),
    normalizeKeyPart(identity.stepId, "stepId"),
    normalizeKeyPart(identity.attemptId, "attemptId")
  ].join(":");
}
function createEmptyAggregateBucket() {
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
    reasoningTokens: 0n
  };
}
function normalizeKeyPart(value, name2) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${name2} must be a non-empty string`);
  }
  if (normalized.includes(":")) {
    throw new Error(`${name2} must not contain ':'`);
  }
  return normalized;
}
function createFixtureBucket(values) {
  return {
    ...createEmptyAggregateBucket(),
    ...values
  };
}

// packages/core/src/pricing/common.ts
var USD_CNY_RATE_MICRO_CNY = 7200000n;
var USD_CNY_EXCHANGE_RATE_LABEL = "1 USD = \xA57.20";
function usdToMicroCny(usdPerMillionTokens) {
  const usdMicro = BigInt(Math.round(usdPerMillionTokens * 1e6));
  return (usdMicro * USD_CNY_RATE_MICRO_CNY + 500000n) / 1000000n;
}
function usdToMicroUsd(usdPerMillionTokens) {
  return BigInt(Math.round(usdPerMillionTokens * 1e6));
}
function usdRatesToMicroUsd(rates) {
  return {
    cacheHitMinorPerMillionTokens: usdToMicroUsd(rates.cachedInput),
    cacheMissMinorPerMillionTokens: usdToMicroUsd(rates.input),
    outputMinorPerMillionTokens: usdToMicroUsd(rates.output),
    ...rates.cacheWrite !== void 0 ? { cacheWriteMinorPerMillionTokens: usdToMicroUsd(rates.cacheWrite) } : {}
  };
}
function usdRatesToCny(rates) {
  return {
    cacheHitMicroCnyPerMillionTokens: usdToMicroCny(rates.cachedInput),
    cacheMissMicroCnyPerMillionTokens: usdToMicroCny(rates.input),
    outputMicroCnyPerMillionTokens: usdToMicroCny(rates.output),
    ...rates.cacheWrite !== void 0 ? { cacheWriteMicroCnyPerMillionTokens: usdToMicroCny(rates.cacheWrite) } : {}
  };
}

// packages/core/src/pricing/versions.ts
var PRICING_CATALOG_VERSIONS = {
  deepseek: "deepseek-official-pricing-2026-08-17",
  xai: "xai-official-pricing-2026-08-18-usd",
  openai: "openai-official-pricing-2026-08-18-usd",
  anthropic: "anthropic-official-pricing-2026-08-18-usd",
  google: "google-official-pricing-2026-08-18-usd",
  moonshotai: "moonshotai-official-pricing-2026-08-18-usd",
  minimax: "minimax-official-pricing-2026-08-18-usd",
  mistral: "mistral-official-pricing-2026-08-18-usd",
  groq: "groq-official-pricing-2026-08-18-usd",
  together: "together-official-pricing-2026-08-18-usd",
  fireworks: "fireworks-official-pricing-2026-08-18-usd",
  cerebras: "cerebras-official-pricing-2026-08-18-usd"
};

// packages/core/src/pricing/anthropic.ts
var ANTHROPIC_PROVIDER = "anthropic";
var ANTHROPIC_PRICE_VERSION = PRICING_CATALOG_VERSIONS.anthropic;
var ANTHROPIC_PRICING_SOURCE = "https://platform.claude.com/docs/en/about-claude/pricing";
var ANTHROPIC_MODEL_ALIASES = {
  "claude-opus-latest": "claude-opus-4-6",
  "claude-sonnet-latest": "claude-sonnet-4-6",
  "claude-haiku-latest": "claude-haiku-4-5"
};
var ANTHROPIC_PRICE_TABLE_USD = {
  "claude-haiku-4-5-20251001": { input: 1, cachedInput: 0.1, output: 5, cacheWrite: 1.25 },
  "claude-opus-4-1": { input: 15, cachedInput: 1.5, output: 75, cacheWrite: 18.75 },
  "claude-opus-4-1-20250805": { input: 15, cachedInput: 1.5, output: 75, cacheWrite: 18.75 },
  "claude-opus-4-5": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-opus-4-5-20251101": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-opus-5": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-opus-4-6": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-opus-4-7": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, cachedInput: 0.5, output: 25, cacheWrite: 6.25 },
  "claude-sonnet-4-6": { input: 3, cachedInput: 0.3, output: 15, cacheWrite: 3.75 },
  "claude-sonnet-4-5": { input: 3, cachedInput: 0.3, output: 15, cacheWrite: 3.75 },
  "claude-sonnet-4-5-20250929": { input: 3, cachedInput: 0.3, output: 15, cacheWrite: 3.75 },
  "claude-haiku-4-5": { input: 1, cachedInput: 0.1, output: 5, cacheWrite: 1.25 },
  "claude-sonnet-5": { input: 2, cachedInput: 0.2, output: 10, cacheWrite: 2.5 },
  "claude-fable-5": { input: 10, cachedInput: 1, output: 50, cacheWrite: 12.5 }
};

// packages/core/src/pricing/cerebras.ts
var CEREBRAS_PROVIDER = "cerebras";
var CEREBRAS_PRICE_VERSION = PRICING_CATALOG_VERSIONS.cerebras;
var CEREBRAS_PRICING_SOURCE = "https://inference-docs.cerebras.ai/support/pricing.md";
var CEREBRAS_PRICE_TABLE_USD = {
  "gemma-4-31b": { input: 0.99, cachedInput: 0, output: 1.49 },
  "gpt-oss-120b": { input: 0.35, cachedInput: 0, output: 0.75 },
  "zai-glm-4.7": { input: 2.25, cachedInput: 2.25, output: 2.75 }
};

// packages/core/src/pricing/fireworks.ts
var FIREWORKS_PROVIDER = "fireworks";
var FIREWORKS_PRICE_VERSION = PRICING_CATALOG_VERSIONS.fireworks;
var FIREWORKS_PRICING_SOURCE = "https://docs.fireworks.ai/serverless/pricing";
var FIREWORKS_PRICE_TABLE_USD = {
  "accounts/fireworks/models/deepseek-v4-flash": { input: 0.14, cachedInput: 0.028, output: 0.28 },
  "accounts/fireworks/models/deepseek-v4-pro": { input: 1.74, cachedInput: 0.145, output: 3.48 },
  "accounts/fireworks/models/glm-5p1": { input: 1.4, cachedInput: 0.26, output: 4.4 },
  "accounts/fireworks/models/glm-5p2": { input: 1.4, cachedInput: 0.14, output: 4.4 },
  "accounts/fireworks/models/gpt-oss-120b": { input: 0.15, cachedInput: 0.015, output: 0.6 },
  "accounts/fireworks/models/gpt-oss-20b": { input: 0.07, cachedInput: 0.035, output: 0.3 },
  "accounts/fireworks/models/kimi-k2p6": { input: 0.95, cachedInput: 0.16, output: 4 },
  "accounts/fireworks/models/kimi-k2p7-code": { input: 0.95, cachedInput: 0.19, output: 4 },
  "accounts/fireworks/models/minimax-m3": { input: 0.3, cachedInput: 0.06, output: 1.2 },
  "accounts/fireworks/models/minimax-m2p7": { input: 0.3, cachedInput: 0.06, output: 1.2 },
  "accounts/fireworks/models/qwen3p7-plus": { input: 0.4, cachedInput: 0.08, output: 1.6 },
  "accounts/fireworks/routers/glm-5p1-fast": { input: 2.8, cachedInput: 0.52, output: 8.8 },
  "accounts/fireworks/routers/glm-5p2-fast": { input: 2.1, cachedInput: 0.21, output: 6.6 },
  "accounts/fireworks/routers/kimi-k2p6-fast": { input: 2, cachedInput: 0.3, output: 8 },
  "accounts/fireworks/routers/kimi-k2p6-turbo": { input: 2, cachedInput: 0.3, output: 8 },
  "accounts/fireworks/routers/kimi-k2p7-code-fast": { input: 1.9, cachedInput: 0.38, output: 8 }
};

// packages/core/src/pricing/groq.ts
var GROQ_PROVIDER = "groq";
var GROQ_PRICE_VERSION = PRICING_CATALOG_VERSIONS.groq;
var GROQ_PRICING_SOURCE = "https://console.groq.com/docs/models";
var GROQ_PRICE_TABLE_USD = {
  "llama-3.1-8b-instant": { input: 0.05, cachedInput: 0, output: 0.08 },
  "llama-3.3-70b-versatile": { input: 0.59, cachedInput: 0, output: 0.79 },
  "meta-llama/llama-4-scout-17b-16e-instruct": { input: 0.11, cachedInput: 0, output: 0.34 },
  "openai/gpt-oss-120b": { input: 0.15, cachedInput: 0.075, output: 0.6 },
  "openai/gpt-oss-20b": { input: 0.075, cachedInput: 0.0375, output: 0.3 },
  "openai/gpt-oss-safeguard-20b": { input: 0.075, cachedInput: 0, output: 0.3 },
  "qwen/qwen3-32b": { input: 0.29, cachedInput: 0, output: 0.59 }
};

// packages/core/src/pricing/google.ts
var GOOGLE_PROVIDER = "google";
var GOOGLE_PRICE_VERSION = PRICING_CATALOG_VERSIONS.google;
var GOOGLE_PRICING_SOURCE = "https://ai.google.dev/gemini-api/docs/pricing";
var GOOGLE_MODEL_ALIASES = {
  "gemini-pro-latest": "gemini-3.1-pro-preview",
  "gemini-flash-latest": "gemini-3-flash-preview"
};
var GOOGLE_PRICE_TABLE_USD = {
  "deep-research-max-preview-04-2026": { input: 2, cachedInput: 0.2, output: 12 },
  "deep-research-preview-04-2026": { input: 2, cachedInput: 0.2, output: 12 },
  "gemini-2.0-flash": { input: 0.1, cachedInput: 0.025, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.075, cachedInput: 0, output: 0.3 },
  "gemini-3.1-pro-preview": { input: 2, cachedInput: 0.2, output: 12 },
  "gemini-3-pro-preview": { input: 2, cachedInput: 0.2, output: 12 },
  "gemini-3-flash-preview": { input: 0.5, cachedInput: 0.05, output: 3 },
  "gemini-3.1-flash-lite": { input: 0.25, cachedInput: 0.025, output: 1.5 },
  "gemini-3.1-flash-lite-preview": { input: 0.25, cachedInput: 0.025, output: 1.5 },
  "gemini-3.1-flash-live-preview": { input: 0.75, cachedInput: 0, output: 4.5 },
  "gemini-3.1-flash-lite-image": { input: 0.25, cachedInput: 0, output: 30 },
  "gemini-3.1-pro-preview-customtools": { input: 2, cachedInput: 0.2, output: 12 },
  "gemini-3.5-flash": { input: 1.5, cachedInput: 0.15, output: 9 },
  "gemini-3.5-flash-lite": { input: 0.3, cachedInput: 0.03, output: 2.5 },
  "gemini-3.6-flash": { input: 1.5, cachedInput: 0.15, output: 7.5 },
  "gemini-2.5-pro": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gemini-2.5-flash": { input: 0.3, cachedInput: 0.03, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, cachedInput: 0.01, output: 0.4 },
  "gemini-2.5-computer-use-preview-10-2025": { input: 1.25, cachedInput: 0, output: 10 },
  "gemini-flash-latest": { input: 1.5, cachedInput: 0.15, output: 9 },
  "gemini-flash-lite-latest": { input: 0.25, cachedInput: 0.025, output: 1.5 },
  "gemini-robotics-er-1.6-preview": { input: 1, cachedInput: 0, output: 5 },
  "gemma-4-26b-a4b-it": { input: 0, cachedInput: 0, output: 0 },
  "gemma-4-31b-it": { input: 0, cachedInput: 0, output: 0 }
};

// packages/core/src/pricing/minimax.ts
var MINIMAX_PROVIDER = "minimax";
var MINIMAX_PRICE_VERSION = PRICING_CATALOG_VERSIONS.minimax;
var MINIMAX_PRICING_SOURCE = "https://platform.minimax.io/docs/guides/pricing-paygo";
var MINIMAX_PRICE_TABLE_USD = {
  "MiniMax-M2.7": { input: 0.3, cachedInput: 0.06, output: 1.2, cacheWrite: 0.375 },
  "MiniMax-M2.7-highspeed": { input: 0.6, cachedInput: 0.06, output: 2.4, cacheWrite: 0.375 },
  "MiniMax-M3": { input: 0.3, cachedInput: 0.06, output: 1.2 }
};

// packages/core/src/pricing/mistral.ts
var MISTRAL_PROVIDER = "mistral";
var MISTRAL_PRICE_VERSION = PRICING_CATALOG_VERSIONS.mistral;
var MISTRAL_PRICING_SOURCE = "https://docs.mistral.ai/inference/pricing";
var MISTRAL_PRICE_TABLE_USD = {
  "mistral-large-latest": { input: 0.5, cachedInput: 0.05, output: 1.5 },
  "mistral-large-2411": { input: 2, cachedInput: 0.2, output: 6 },
  "mistral-large-2512": { input: 0.5, cachedInput: 0.05, output: 1.5 },
  "mistral-medium-latest": { input: 1.5, cachedInput: 0.15, output: 7.5 },
  "mistral-medium-2505": { input: 0.4, cachedInput: 0.04, output: 2 },
  "mistral-medium-2508": { input: 0.4, cachedInput: 0.04, output: 2 },
  "mistral-medium-2604": { input: 1.5, cachedInput: 0.15, output: 7.5 },
  "mistral-medium-3.5": { input: 1.5, cachedInput: 0, output: 7.5 },
  "mistral-small-latest": { input: 0.15, cachedInput: 0.015, output: 0.6 },
  "mistral-small-2506": { input: 0.1, cachedInput: 0.01, output: 0.3 },
  "mistral-small-2603": { input: 0.15, cachedInput: 0.015, output: 0.6 },
  "codestral-latest": { input: 0.3, cachedInput: 0.03, output: 0.9 },
  "devstral-latest": { input: 0.4, cachedInput: 0.04, output: 2 },
  "devstral-2512": { input: 0.4, cachedInput: 0.04, output: 2 },
  "devstral-medium-2507": { input: 0.4, cachedInput: 0.04, output: 2 },
  "devstral-medium-latest": { input: 0.4, cachedInput: 0.04, output: 2 },
  "devstral-small-2505": { input: 0.1, cachedInput: 0.01, output: 0.3 },
  "devstral-small-2507": { input: 0.1, cachedInput: 0.01, output: 0.3 },
  "labs-devstral-small-2512": { input: 0, cachedInput: 0, output: 0 },
  "magistral-medium-latest": { input: 2, cachedInput: 0.2, output: 5 },
  "magistral-small": { input: 0.5, cachedInput: 0.05, output: 1.5 },
  "ministral-3b-latest": { input: 0.04, cachedInput: 4e-3, output: 0.04 },
  "ministral-8b-latest": { input: 0.1, cachedInput: 0.01, output: 0.1 },
  "mistral-nemo": { input: 0.15, cachedInput: 0.015, output: 0.15 },
  "open-mistral-7b": { input: 0.25, cachedInput: 0.025, output: 0.25 },
  "open-mistral-nemo": { input: 0.15, cachedInput: 0.015, output: 0.15 },
  "open-mixtral-8x22b": { input: 2, cachedInput: 0.2, output: 6 },
  "open-mixtral-8x7b": { input: 0.7, cachedInput: 0.07, output: 0.7 },
  "pixtral-12b": { input: 0.15, cachedInput: 0.015, output: 0.15 },
  "pixtral-large-latest": { input: 2, cachedInput: 0.2, output: 6 }
};

// packages/core/src/pricing/moonshotai.ts
var MOONSHOTAI_PROVIDER = "moonshotai";
var MOONSHOTAI_PRICE_VERSION = PRICING_CATALOG_VERSIONS.moonshotai;
var MOONSHOTAI_PRICING_SOURCE = "https://platform.kimi.ai/docs/pricing/chat";
var MOONSHOTAI_MODEL_ALIASES = {
  k3: "kimi-k3",
  "k3-256k": "kimi-k3",
  "kimi-for-coding": "kimi-k2.7-code",
  "kimi-for-coding-highspeed": "kimi-k2.7-code-highspeed"
};
var MOONSHOTAI_PRICE_TABLE_USD = {
  "kimi-k2-0711-preview": { input: 0.6, cachedInput: 0.15, output: 2.5 },
  "kimi-k2-0905-preview": { input: 0.6, cachedInput: 0.15, output: 2.5 },
  "kimi-k2.6": { input: 0.95, cachedInput: 0.16, output: 4 },
  "kimi-k2.5": { input: 0.6, cachedInput: 0.1, output: 3 },
  "kimi-k2-thinking": { input: 0.6, cachedInput: 0.15, output: 2.5 },
  "kimi-k2-thinking-turbo": { input: 1.15, cachedInput: 0.15, output: 8 },
  "kimi-k2-turbo-preview": { input: 2.4, cachedInput: 0.6, output: 10 },
  "kimi-k2.7-code": { input: 0.95, cachedInput: 0.19, output: 4 },
  "kimi-k2.7-code-highspeed": { input: 1.9, cachedInput: 0.38, output: 8 },
  "kimi-k3": { input: 3, cachedInput: 0.3, output: 15 }
};

// packages/core/src/pricing/openai.ts
var OPENAI_PROVIDER = "openai";
var OPENAI_PRICE_VERSION = PRICING_CATALOG_VERSIONS.openai;
var OPENAI_PRICING_SOURCE = "https://developers.openai.com/api/docs/pricing";
var OPENAI_MODEL_ALIASES = {
  "gpt-5-latest": "gpt-5.4",
  "gpt-5.4-latest": "gpt-5.4",
  "gpt-5-mini-latest": "gpt-5-mini",
  "gpt-5-codex": "gpt-5.3-codex"
};
var OPENAI_PRICE_TABLE_USD = {
  "gpt-4": { input: 30, cachedInput: 0, output: 60 },
  "gpt-4-turbo": { input: 10, cachedInput: 0, output: 30 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, cachedInput: 0.025, output: 0.4 },
  "gpt-5.6-luna": {
    input: 1,
    cachedInput: 0.1,
    output: 6,
    cacheWrite: 1.25,
    tiers: [{ inputTokensAbove: 272e3, input: 2, cachedInput: 0.2, output: 9, cacheWrite: 2.5 }]
  },
  "gpt-5.6-sol": {
    input: 5,
    cachedInput: 0.5,
    output: 30,
    cacheWrite: 6.25,
    tiers: [{ inputTokensAbove: 272e3, input: 10, cachedInput: 1, output: 45, cacheWrite: 12.5 }]
  },
  "gpt-5.6-terra": {
    input: 2.5,
    cachedInput: 0.25,
    output: 15,
    cacheWrite: 3.125,
    tiers: [{ inputTokensAbove: 272e3, input: 5, cachedInput: 0.5, output: 22.5, cacheWrite: 6.25 }]
  },
  "gpt-5.4": {
    input: 2.5,
    cachedInput: 0.25,
    output: 15,
    tiers: [{ inputTokensAbove: 272e3, input: 5, cachedInput: 0.5, output: 22.5 }]
  },
  "gpt-5.4-nano": { input: 0.2, cachedInput: 0.02, output: 1.25 },
  "gpt-5.4-pro": {
    input: 30,
    cachedInput: 0,
    output: 180,
    tiers: [{ inputTokensAbove: 272e3, input: 60, cachedInput: 0, output: 270 }]
  },
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5.5": {
    input: 5,
    cachedInput: 0.5,
    output: 30,
    tiers: [{ inputTokensAbove: 272e3, input: 10, cachedInput: 1, output: 45 }]
  },
  "gpt-5.5-pro": {
    input: 30,
    cachedInput: 0,
    output: 180,
    tiers: [{ inputTokensAbove: 272e3, input: 60, cachedInput: 0, output: 270 }]
  },
  "gpt-5.3-codex": { input: 1.75, cachedInput: 0.175, output: 14 },
  "gpt-5.3-codex-spark": { input: 1.75, cachedInput: 0.175, output: 14 },
  "gpt-5.3-chat-latest": { input: 1.75, cachedInput: 0.175, output: 14 },
  "gpt-5.2": { input: 1.75, cachedInput: 0.175, output: 14 },
  "gpt-5.2-chat-latest": { input: 1.75, cachedInput: 0.175, output: 14 },
  "gpt-5.2-pro": { input: 21, cachedInput: 0, output: 168 },
  "gpt-5.1": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gpt-5-chat-latest": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gpt-5": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2 },
  "gpt-5-nano": { input: 0.05, cachedInput: 5e-3, output: 0.4 },
  "gpt-5-pro": { input: 15, cachedInput: 0, output: 120 },
  "gpt-realtime-2.1": { input: 4, cachedInput: 0.4, output: 24 },
  o1: { input: 15, cachedInput: 7.5, output: 60 },
  "o1-pro": { input: 150, cachedInput: 0, output: 600 },
  o3: { input: 2, cachedInput: 0.5, output: 8 },
  "o3-mini": { input: 1.1, cachedInput: 0.55, output: 4.4 },
  "o3-pro": { input: 20, cachedInput: 0, output: 80 },
  "o4-mini": { input: 1.1, cachedInput: 0.275, output: 4.4 },
  "gpt-4.1": { input: 2, cachedInput: 0.5, output: 8 },
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10 },
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 }
};

// packages/core/src/pricing/together.ts
var TOGETHER_PROVIDER = "together";
var TOGETHER_PRICE_VERSION = PRICING_CATALOG_VERSIONS.together;
var TOGETHER_PRICING_SOURCE = "https://www.together.ai/pricing";
var TOGETHER_PRICE_TABLE_USD = {
  "MiniMaxAI/MiniMax-M2.7": { input: 0.3, cachedInput: 0.06, output: 1.2 },
  "MiniMaxAI/MiniMax-M3": { input: 0.3, cachedInput: 0.06, output: 1.2 },
  "Qwen/Qwen2.5-7B-Instruct-Turbo": { input: 0.3, cachedInput: 0, output: 0.3 },
  "Qwen/Qwen3.5-9B": { input: 0.17, cachedInput: 0, output: 0.25 },
  "Qwen/Qwen3.6-Plus": { input: 0.5, cachedInput: 0, output: 3 },
  "Qwen/Qwen3.7-Max": { input: 1.25, cachedInput: 0, output: 3.75 },
  "deepseek-ai/DeepSeek-V4-Pro": { input: 1.74, cachedInput: 0.2, output: 3.48 },
  "google/gemma-4-31B-it": { input: 0.39, cachedInput: 0, output: 0.97 },
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": { input: 1.04, cachedInput: 0, output: 1.04 },
  "moonshotai/Kimi-K2.6": { input: 1.2, cachedInput: 0.2, output: 4.5 },
  "moonshotai/Kimi-K2.7-Code": { input: 0.95, cachedInput: 0.19, output: 4 },
  "nvidia/nemotron-3-ultra-550b-a55b": { input: 0.6, cachedInput: 0.2, output: 3.6 },
  "openai/gpt-oss-120b": { input: 0.15, cachedInput: 0, output: 0.6 },
  "openai/gpt-oss-20b": { input: 0.05, cachedInput: 0, output: 0.2 },
  "thinkingmachines/Inkling": { input: 1, cachedInput: 0.17, output: 4.05 },
  "zai-org/GLM-5.2": { input: 1.4, cachedInput: 0.26, output: 4.4 }
};

// packages/core/src/pricing/catalog.ts
var API_PRICING_PROVIDER_ALIASES = {
  "azure-openai-responses": "openai",
  "google-vertex": "google",
  "kimi-coding": "moonshotai",
  "minimax-cn": "minimax",
  "moonshotai-cn": "moonshotai",
  "openai-codex": "openai"
};
var ADDITIONAL_PRICING_CATALOGS = {
  anthropic: {
    kind: ANTHROPIC_PROVIDER,
    displayName: "Anthropic",
    priceVersion: ANTHROPIC_PRICE_VERSION,
    source: ANTHROPIC_PRICING_SOURCE,
    models: ANTHROPIC_PRICE_TABLE_USD,
    aliases: ANTHROPIC_MODEL_ALIASES
  },
  cerebras: {
    kind: CEREBRAS_PROVIDER,
    displayName: "Cerebras",
    priceVersion: CEREBRAS_PRICE_VERSION,
    source: CEREBRAS_PRICING_SOURCE,
    models: CEREBRAS_PRICE_TABLE_USD
  },
  fireworks: {
    kind: FIREWORKS_PROVIDER,
    displayName: "Fireworks AI",
    priceVersion: FIREWORKS_PRICE_VERSION,
    source: FIREWORKS_PRICING_SOURCE,
    models: FIREWORKS_PRICE_TABLE_USD
  },
  google: {
    kind: GOOGLE_PROVIDER,
    displayName: "Google Gemini",
    priceVersion: GOOGLE_PRICE_VERSION,
    source: GOOGLE_PRICING_SOURCE,
    models: GOOGLE_PRICE_TABLE_USD,
    aliases: GOOGLE_MODEL_ALIASES
  },
  groq: {
    kind: GROQ_PROVIDER,
    displayName: "Groq",
    priceVersion: GROQ_PRICE_VERSION,
    source: GROQ_PRICING_SOURCE,
    models: GROQ_PRICE_TABLE_USD
  },
  minimax: {
    kind: MINIMAX_PROVIDER,
    displayName: "MiniMax",
    priceVersion: MINIMAX_PRICE_VERSION,
    source: MINIMAX_PRICING_SOURCE,
    models: MINIMAX_PRICE_TABLE_USD
  },
  mistral: {
    kind: MISTRAL_PROVIDER,
    displayName: "Mistral AI",
    priceVersion: MISTRAL_PRICE_VERSION,
    source: MISTRAL_PRICING_SOURCE,
    models: MISTRAL_PRICE_TABLE_USD
  },
  moonshotai: {
    kind: MOONSHOTAI_PROVIDER,
    displayName: "Moonshot / Kimi",
    priceVersion: MOONSHOTAI_PRICE_VERSION,
    source: MOONSHOTAI_PRICING_SOURCE,
    models: MOONSHOTAI_PRICE_TABLE_USD,
    aliases: MOONSHOTAI_MODEL_ALIASES
  },
  openai: {
    kind: OPENAI_PROVIDER,
    displayName: "OpenAI",
    priceVersion: OPENAI_PRICE_VERSION,
    source: OPENAI_PRICING_SOURCE,
    models: OPENAI_PRICE_TABLE_USD,
    aliases: OPENAI_MODEL_ALIASES
  },
  together: {
    kind: TOGETHER_PROVIDER,
    displayName: "Together AI",
    priceVersion: TOGETHER_PRICE_VERSION,
    source: TOGETHER_PRICING_SOURCE,
    models: TOGETHER_PRICE_TABLE_USD
  }
};
function findModel(catalog, model) {
  const normalized = model.trim().toLowerCase();
  const candidates = [normalized, normalized.includes("/") ? normalized.slice(normalized.lastIndexOf("/") + 1) : ""].filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  for (const candidate of candidates) {
    const direct = Object.entries(catalog.models).find(([id]) => id.toLowerCase() === candidate)?.[1];
    if (direct) return direct;
    const alias = catalog.aliases && Object.prototype.hasOwnProperty.call(catalog.aliases, candidate) ? catalog.aliases[candidate] : void 0;
    if (alias && catalog.models[alias]) return catalog.models[alias];
  }
  return void 0;
}
function matchingCatalogs(model) {
  return Object.values(ADDITIONAL_PRICING_CATALOGS).filter((catalog) => findModel(catalog, model) !== void 0);
}
function uniquelyMatchingCatalog(model) {
  const matches = matchingCatalogs(model);
  return matches.length === 1 ? matches[0] : void 0;
}
function getAdditionalPricingCatalog(kind) {
  const normalized = kind.trim().toLowerCase();
  const catalogKind = Object.prototype.hasOwnProperty.call(API_PRICING_PROVIDER_ALIASES, normalized) ? API_PRICING_PROVIDER_ALIASES[normalized] : normalized;
  return Object.prototype.hasOwnProperty.call(ADDITIONAL_PRICING_CATALOGS, catalogKind) ? ADDITIONAL_PRICING_CATALOGS[catalogKind] : void 0;
}
function lookupAdditionalPrice(kind, model, inputTokens = 0) {
  const routedCatalog = getAdditionalPricingCatalog(kind);
  const routedRates = routedCatalog ? findModel(routedCatalog, model) : void 0;
  const catalog = routedRates ? routedCatalog : uniquelyMatchingCatalog(model);
  const baseRates = routedRates ?? (catalog ? findModel(catalog, model) : void 0);
  if (!catalog) return null;
  if (!baseRates) return null;
  const normalizedInputTokens = typeof inputTokens === "bigint" ? inputTokens : BigInt(inputTokens);
  const tier = [...baseRates.tiers ?? []].sort((left, right) => right.inputTokensAbove - left.inputTokensAbove).find((candidate) => normalizedInputTokens > BigInt(candidate.inputTokensAbove));
  const usdRates = tier ?? baseRates;
  return {
    provider: catalog.kind,
    model,
    currency: "USD",
    pricingZone: "unknown",
    priceVersion: catalog.priceVersion,
    source: catalog.source,
    rates: usdRatesToCny(usdRates),
    nativeRates: usdRatesToMicroUsd(usdRates)
  };
}
function resolveAdditionalPricingCatalogKind(provider, model) {
  const normalizedProvider = provider?.trim().toLowerCase();
  const modelMatches = matchingCatalogs(model).map((catalog) => catalog.kind);
  if (modelMatches.length === 1) return modelMatches[0];
  const routed = normalizedProvider ? lookupAdditionalPrice(normalizedProvider, model)?.provider : void 0;
  return routed && modelMatches.includes(routed) ? routed : null;
}
function listPriceCatalogProviders() {
  return [
    "deepseek",
    "xai",
    ...Object.keys(ADDITIONAL_PRICING_CATALOGS),
    ...Object.keys(API_PRICING_PROVIDER_ALIASES)
  ];
}

// packages/core/src/pricing/deepseek.ts
var DEEPSEEK_PROVIDER = "deepseek";
var DEEPSEEK_PRICE_VERSION = PRICING_CATALOG_VERSIONS.deepseek;
var DEEPSEEK_PRICING_SOURCE = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";
var DEEPSEEK_MODEL_ALIASES = {
  "deepseek-chat": "deepseek-v4-flash",
  "deepseek-reasoner": "deepseek-v4-pro"
};
var DEEPSEEK_PRICE_TABLE = {
  "deepseek-v4-flash": {
    peak: {
      cacheHitMicroCnyPerMillionTokens: 100000n,
      cacheMissMicroCnyPerMillionTokens: 3000000n,
      outputMicroCnyPerMillionTokens: 9000000n
    },
    offpeak: {
      cacheHitMicroCnyPerMillionTokens: 50000n,
      cacheMissMicroCnyPerMillionTokens: 1500000n,
      outputMicroCnyPerMillionTokens: 4500000n
    }
  },
  "deepseek-v4-pro": {
    peak: {
      cacheHitMicroCnyPerMillionTokens: 300000n,
      cacheMissMicroCnyPerMillionTokens: 9000000n,
      outputMicroCnyPerMillionTokens: 27000000n
    },
    offpeak: {
      cacheHitMicroCnyPerMillionTokens: 150000n,
      cacheMissMicroCnyPerMillionTokens: 4500000n,
      outputMicroCnyPerMillionTokens: 13500000n
    }
  }
};
function resolveDeepSeekModelId(model) {
  const normalized = model.trim().toLowerCase();
  const candidates = [normalized, normalized.includes("/") ? normalized.slice(normalized.lastIndexOf("/") + 1) : ""].filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(DEEPSEEK_PRICE_TABLE, candidate)) return candidate;
    if (Object.prototype.hasOwnProperty.call(DEEPSEEK_MODEL_ALIASES, candidate)) return DEEPSEEK_MODEL_ALIASES[candidate];
  }
  return null;
}

// packages/core/src/pricing/xai.ts
var XAI_PROVIDER = "xai";
var XAI_PRICE_VERSION = PRICING_CATALOG_VERSIONS.xai;
var XAI_PRICING_SOURCE = "https://docs.x.ai/developers/pricing";
var XAI_MODEL_ALIASES = {
  "grok-4.5-latest": "grok-4.5",
  "grok-4.3-latest": "grok-4.3",
  "grok-code-fast": "grok-build-0.1",
  "grok-code-fast-1": "grok-build-0.1",
  "grok-4.20-reasoning": "grok-4.20",
  "grok-4.20-0309": "grok-4.20",
  "grok-4.20-beta": "grok-4.20"
};
var XAI_PRICE_TABLE_USD = {
  "grok-4.6": {
    short: { input: 2, cachedInput: 0.5, output: 6 },
    long: { input: 4, cachedInput: 1, output: 12 },
    longContextThresholdTokens: 2e5
  },
  "grok-4.5": {
    short: { input: 2, cachedInput: 0.3, output: 6 },
    long: { input: 4, cachedInput: 0.6, output: 12 },
    longContextThresholdTokens: 2e5
  },
  "grok-4.3": {
    short: { input: 1.25, cachedInput: 0.2, output: 2.5 },
    long: { input: 2.5, cachedInput: 0.4, output: 5 },
    longContextThresholdTokens: 2e5
  },
  "grok-build-0.1": {
    short: { input: 1, cachedInput: 0.2, output: 2 },
    long: { input: 2, cachedInput: 0.4, output: 4 },
    longContextThresholdTokens: 2e5
  },
  "grok-4.20": {
    short: { input: 1.25, cachedInput: 0.2, output: 2.5 },
    long: { input: 2.5, cachedInput: 0.4, output: 5 },
    longContextThresholdTokens: 2e5
  }
};
function resolveXaiModelId(model) {
  const normalized = model.trim().toLowerCase();
  const candidates = [normalized, normalized.includes("/") ? normalized.slice(normalized.lastIndexOf("/") + 1) : ""].filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(XAI_PRICE_TABLE_USD, candidate)) return candidate;
    if (Object.prototype.hasOwnProperty.call(XAI_MODEL_ALIASES, candidate)) return XAI_MODEL_ALIASES[candidate];
  }
  return null;
}

// packages/core/src/pricing/index.ts
function resolvePricingCatalogKind(provider, model) {
  const normalizedProvider = provider?.trim().toLowerCase();
  if (normalizedProvider === "deepseek" || normalizedProvider === "deepseek-official") {
    const normalizedModel = model.trim().toLowerCase();
    if (normalizedModel === "unknown" || normalizedModel.startsWith("deepseek-") || resolveDeepSeekModelId(model)) return "deepseek";
  }
  if (normalizedProvider === "xai" || normalizedProvider === "cpa") {
    if (resolveXaiModelId(model)) return "xai";
  }
  const additionalKind = resolveAdditionalPricingCatalogKind(provider, model);
  if (additionalKind) return additionalKind;
  if (resolveDeepSeekModelId(model) || model.trim().toLowerCase().startsWith("deepseek-")) return "deepseek";
  if (resolveXaiModelId(model)) return "xai";
  return null;
}

// packages/core/src/pricing-zone-countdown.ts
var BEIJING_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});
var PEAK_WINDOWS = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60]
];

// packages/core/src/analytics.ts
var DEFAULT_RECENT_BUCKET_LIMIT = 90;
var DEFAULT_DAILY_SPIKE_BASELINE_BUCKETS = 3;
var DEFAULT_DAILY_SPIKE_RATIO = 3;
var DEFAULT_DAILY_SPIKE_MIN_DELTA_MICRO_CNY = 1e6;
var DEFAULT_HOURLY_CONCENTRATION_RATIO = 0.85;
var DEFAULT_MINIMUM_REQUESTS_FOR_RATE_ANOMALY = 5;
var DEFAULT_UNKNOWN_RATE_THRESHOLD = 0.25;
var DEFAULT_FAILED_RATE_THRESHOLD = 0.25;
function createCostAnalyticsReport(events, options = {}) {
  const normalized = events.filter(
    (event) => isFiniteNonNegative(event.amountMicroCny) && isValidTimestamp(event.requestStartedAt)
  ).map((event) => ({
    sessionId: event.sessionId?.trim() || "unknown",
    requestStartedAt: normalizeTimestamp(event.requestStartedAt),
    amountMicroCny: Math.round(event.amountMicroCny),
    status: normalizeStatus(event.status),
    pricingZone: normalizePricingZone(event.pricingZone)
  })).sort((left, right) => left.requestStartedAt.localeCompare(right.requestStartedAt));
  const global = createMutableBucket("global", "", "");
  const sessions = /* @__PURE__ */ new Map();
  const days = /* @__PURE__ */ new Map();
  const hours = /* @__PURE__ */ new Map();
  for (const event of normalized) {
    addToBucket(global, event);
    const session = sessions.get(event.sessionId) ?? createMutableBucket(event.sessionId, "", "");
    addToBucket(session, event);
    sessions.set(event.sessionId, session);
    const dayKey = event.requestStartedAt.slice(0, 10);
    const day = days.get(dayKey) ?? createMutableBucket(
      dayKey,
      `${dayKey}T00:00:00.000Z`,
      `${dayKey}T23:59:59.999Z`
    );
    addToBucket(day, event);
    days.set(dayKey, day);
    const hourKey = event.requestStartedAt.slice(0, 13);
    const hour = hours.get(hourKey) ?? createMutableBucket(
      hourKey,
      `${hourKey}:00:00.000Z`,
      `${hourKey}:59:59.999Z`
    );
    addToBucket(hour, event);
    hours.set(hourKey, hour);
  }
  const recentBucketLimit = positiveInteger(options.recentBucketLimit, DEFAULT_RECENT_BUCKET_LIMIT);
  const dailyTrend = withDeltas([...days.values()].sort(compareBucket).slice(-recentBucketLimit));
  const hourlyTrend = withDeltas([...hours.values()].sort(compareBucket).slice(-recentBucketLimit));
  const sessionSummaries = [...sessions.values()].sort((left, right) => right.amountMicroCny - left.amountMicroCny || left.key.localeCompare(right.key)).map((bucket) => ({
    sessionId: bucket.key,
    ...toTotal(bucket)
  }));
  return {
    generatedAt: resolveGeneratedAt(options.now, normalized.at(-1)?.requestStartedAt),
    global: toTotal(global),
    sessions: sessionSummaries,
    dailyTrend,
    hourlyTrend,
    anomalies: detectAnomalies(dailyTrend, hourlyTrend, options)
  };
}
function detectAnomalies(dailyTrend, hourlyTrend, options) {
  return [
    ...detectDailySpendSpikes(dailyTrend, options),
    ...detectHourlyConcentration(dailyTrend, hourlyTrend, options),
    ...detectRateAnomalies(dailyTrend, options)
  ];
}
function detectDailySpendSpikes(dailyTrend, options) {
  const baselineBuckets = positiveInteger(options.dailySpikeBaselineBuckets, DEFAULT_DAILY_SPIKE_BASELINE_BUCKETS);
  const ratioThreshold = positiveNumber(options.dailySpikeRatio, DEFAULT_DAILY_SPIKE_RATIO);
  const minimumDelta = nonNegativeNumber(
    options.dailySpikeMinDeltaMicroCny,
    DEFAULT_DAILY_SPIKE_MIN_DELTA_MICRO_CNY
  );
  const anomalies = [];
  for (let index = baselineBuckets; index < dailyTrend.length; index += 1) {
    const bucket = dailyTrend[index];
    const baseline = dailyTrend.slice(index - baselineBuckets, index);
    const baselineAverage = average(baseline.map((entry) => entry.amountMicroCny));
    const delta = bucket.amountMicroCny - baselineAverage;
    if (baselineAverage <= 0 || bucket.amountMicroCny < baselineAverage * ratioThreshold || delta < minimumDelta) {
      continue;
    }
    const ratio = bucket.amountMicroCny / baselineAverage;
    anomalies.push({
      ruleId: "daily_spend_spike",
      severity: "warning",
      bucketKey: bucket.key,
      observedMicroCny: bucket.amountMicroCny,
      baselineMicroCny: baselineAverage,
      ratio,
      threshold: ratioThreshold,
      explanation: `${bucket.key} cost ${bucket.amountMicroCny} microCNY is ${formatRatio(ratio)}x the prior ${baselineBuckets}-day average ${baselineAverage} microCNY.`
    });
  }
  return anomalies;
}
function detectHourlyConcentration(dailyTrend, hourlyTrend, options) {
  const ratioThreshold = positiveNumber(options.hourlyConcentrationRatio, DEFAULT_HOURLY_CONCENTRATION_RATIO);
  const dayTotals = new Map(dailyTrend.map((bucket) => [bucket.key, bucket.amountMicroCny]));
  const anomalies = [];
  for (const hour of hourlyTrend) {
    const dayKey = hour.key.slice(0, 10);
    const dayTotal = dayTotals.get(dayKey) ?? 0;
    if (dayTotal <= 0) continue;
    const ratio = hour.amountMicroCny / dayTotal;
    if (ratio < ratioThreshold) continue;
    anomalies.push({
      ruleId: "hourly_spend_concentration",
      severity: "info",
      bucketKey: hour.key,
      observedMicroCny: hour.amountMicroCny,
      baselineMicroCny: dayTotal,
      ratio,
      threshold: ratioThreshold,
      explanation: `${hour.key}:00Z accounts for ${formatRatio(ratio)} of ${dayKey}'s cost (${hour.amountMicroCny}/${dayTotal} microCNY).`
    });
  }
  return anomalies;
}
function detectRateAnomalies(dailyTrend, options) {
  const minimumRequests = positiveInteger(
    options.minimumRequestsForRateAnomaly,
    DEFAULT_MINIMUM_REQUESTS_FOR_RATE_ANOMALY
  );
  const unknownThreshold = positiveNumber(options.unknownRateThreshold, DEFAULT_UNKNOWN_RATE_THRESHOLD);
  const failedThreshold = positiveNumber(options.failedRateThreshold, DEFAULT_FAILED_RATE_THRESHOLD);
  const anomalies = [];
  for (const bucket of dailyTrend) {
    if (bucket.requestCount < minimumRequests) continue;
    const unknownRate = bucket.statusCounts.unknown / bucket.requestCount;
    if (unknownRate >= unknownThreshold) {
      anomalies.push({
        ruleId: "unknown_rate_high",
        severity: "warning",
        bucketKey: bucket.key,
        observedCount: bucket.statusCounts.unknown,
        baselineCount: bucket.requestCount,
        ratio: unknownRate,
        threshold: unknownThreshold,
        explanation: `${bucket.key} has ${bucket.statusCounts.unknown}/${bucket.requestCount} unknown-cost requests (${formatRatio(unknownRate)}).`
      });
    }
    const failedRate = bucket.statusCounts.failed / bucket.requestCount;
    if (failedRate >= failedThreshold) {
      anomalies.push({
        ruleId: "failed_rate_high",
        severity: "warning",
        bucketKey: bucket.key,
        observedCount: bucket.statusCounts.failed,
        baselineCount: bucket.requestCount,
        ratio: failedRate,
        threshold: failedThreshold,
        explanation: `${bucket.key} has ${bucket.statusCounts.failed}/${bucket.requestCount} failed-cost requests (${formatRatio(failedRate)}).`
      });
    }
  }
  return anomalies;
}
function withDeltas(buckets) {
  return buckets.map((bucket, index) => {
    const previous = index > 0 ? buckets[index - 1] : null;
    const previousAmount = previous?.amountMicroCny ?? null;
    const delta = previousAmount === null ? null : bucket.amountMicroCny - previousAmount;
    const deltaRatio = previousAmount && previousAmount > 0 ? bucket.amountMicroCny / previousAmount : null;
    return {
      key: bucket.key,
      startAt: bucket.startAt,
      endAt: bucket.endAt,
      amountMicroCny: bucket.amountMicroCny,
      requestCount: bucket.requestCount,
      statusCounts: freezeCounts(bucket.statusCounts),
      peakMicroCny: bucket.peakMicroCny,
      offpeakMicroCny: bucket.offpeakMicroCny,
      previousAmountMicroCny: previousAmount,
      deltaMicroCny: delta,
      deltaRatio
    };
  });
}
function addToBucket(bucket, event) {
  bucket.amountMicroCny += event.status === "unknown" ? 0 : event.amountMicroCny;
  bucket.requestCount += 1;
  bucket.statusCounts[event.status] += 1;
  if (event.status === "unknown") {
  } else if (event.pricingZone === "peak") {
    bucket.peakMicroCny += event.amountMicroCny;
  } else if (event.pricingZone === "offpeak") {
    bucket.offpeakMicroCny += event.amountMicroCny;
  }
  if (bucket.startAt === "" || event.requestStartedAt < bucket.startAt) bucket.startAt = event.requestStartedAt;
  if (bucket.endAt === "" || event.requestStartedAt > bucket.endAt) bucket.endAt = event.requestStartedAt;
}
function createMutableBucket(key, startAt, endAt) {
  return {
    key,
    startAt,
    endAt,
    amountMicroCny: 0,
    requestCount: 0,
    statusCounts: { estimated: 0, settled: 0, unknown: 0, failed: 0 },
    peakMicroCny: 0,
    offpeakMicroCny: 0
  };
}
function toTotal(bucket) {
  return {
    totalMicroCny: bucket.amountMicroCny,
    requestCount: bucket.requestCount,
    statusCounts: freezeCounts(bucket.statusCounts),
    peakMicroCny: bucket.peakMicroCny,
    offpeakMicroCny: bucket.offpeakMicroCny
  };
}
function freezeCounts(counts) {
  return {
    estimated: counts.estimated,
    settled: counts.settled,
    unknown: counts.unknown,
    failed: counts.failed
  };
}
function compareBucket(left, right) {
  return left.key.localeCompare(right.key);
}
function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}
function resolveGeneratedAt(now, latestEventAt) {
  if (typeof now === "function") return normalizeTimestamp(now());
  if (typeof now === "string") return normalizeTimestamp(now);
  return latestEventAt ?? (/* @__PURE__ */ new Date(0)).toISOString();
}
function normalizeTimestamp(value) {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  return (/* @__PURE__ */ new Date(0)).toISOString();
}
function isValidTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}
function normalizeStatus(status) {
  return status === "estimated" || status === "settled" || status === "unknown" || status === "failed" ? status : "unknown";
}
function normalizePricingZone(zone) {
  return zone === "peak" || zone === "offpeak" || zone === "unknown" ? zone : "unknown";
}
function positiveInteger(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
function positiveNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
function nonNegativeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}
function formatRatio(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

// packages/core/src/index.ts
function createDeepSeekPriceDirectory(options = {}) {
  const priceVersion = options.priceVersion ?? DEEPSEEK_PRICE_VERSION;
  const source = options.source ?? DEEPSEEK_PRICING_SOURCE;
  return {
    provider: DEEPSEEK_PROVIDER,
    priceVersion,
    source,
    listModels: () => Object.keys(DEEPSEEK_PRICE_TABLE),
    lookup: (input) => {
      const pricingZone = input.pricingZone && input.pricingZone !== "unknown" ? input.pricingZone : resolveDeepSeekPricingZone(input.requestStartedAt);
      const modelId = resolveDeepSeekModelId(input.model);
      const table = modelId ? DEEPSEEK_PRICE_TABLE[modelId] : void 0;
      if (!table) {
        return {
          ok: false,
          reason: "model_not_found",
          model: input.model,
          pricingZone,
          priceVersion,
          source
        };
      }
      const rates = table[pricingZone];
      if (!rates) {
        return {
          ok: false,
          reason: "rate_not_found",
          model: input.model,
          pricingZone,
          priceVersion,
          source
        };
      }
      return {
        ok: true,
        quote: {
          provider: DEEPSEEK_PROVIDER,
          model: input.model,
          pricingZone,
          priceVersion,
          source,
          currency: "CNY",
          cacheHitMinorPerMillionTokens: rates.cacheHitMicroCnyPerMillionTokens,
          cacheMissMinorPerMillionTokens: rates.cacheMissMicroCnyPerMillionTokens,
          outputMinorPerMillionTokens: rates.outputMicroCnyPerMillionTokens,
          ...rates
        }
      };
    }
  };
}
function createXaiPriceDirectory(options = {}) {
  const priceVersion = options.priceVersion ?? XAI_PRICE_VERSION;
  const source = options.source ?? XAI_PRICING_SOURCE;
  return {
    provider: XAI_PROVIDER,
    priceVersion,
    source,
    listModels: () => Object.keys(XAI_PRICE_TABLE_USD),
    lookup: (input) => {
      const model = resolveXaiModelId(input.model);
      const rateCard = model ? XAI_PRICE_TABLE_USD[model] : void 0;
      if (!rateCard) {
        return { ok: false, reason: "model_not_found", model: input.model, pricingZone: "unknown", priceVersion, source };
      }
      const inputTokens = typeof input.inputTokens === "bigint" ? input.inputTokens : BigInt(input.inputTokens ?? 0);
      const longContext = inputTokens >= BigInt(rateCard.longContextThresholdTokens);
      const rates = longContext ? rateCard.long : rateCard.short;
      return {
        ok: true,
        quote: {
          provider: XAI_PROVIDER,
          model: input.model,
          pricingZone: "unknown",
          priceVersion,
          source,
          rateTier: longContext ? "long_context" : "short_context",
          currency: "USD",
          cacheHitMinorPerMillionTokens: usdToMicroUsd(rates.cachedInput),
          cacheMissMinorPerMillionTokens: usdToMicroUsd(rates.input),
          outputMinorPerMillionTokens: usdToMicroUsd(rates.output),
          cacheMissMicroCnyPerMillionTokens: usdToMicroCny(rates.input),
          cacheHitMicroCnyPerMillionTokens: usdToMicroCny(rates.cachedInput),
          outputMicroCnyPerMillionTokens: usdToMicroCny(rates.output)
        }
      };
    }
  };
}
function fallbackDeepSeekModelId(model) {
  const normalized = model.trim().toLowerCase();
  return /reasoner|reasoning|think|r1|pro/.test(normalized) ? "deepseek-v4-pro" : "deepseek-v4-flash";
}
function resolveDeepSeekPricingZone(requestStartedAt) {
  const startedAt = toValidDate(requestStartedAt);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(startedAt);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const minutes = hour * 60 + minute;
  if (isInMinutesRange(minutes, 9 * 60, 12 * 60) || isInMinutesRange(minutes, 14 * 60, 18 * 60)) {
    return "peak";
  }
  return "offpeak";
}
function calculateDeepSeekUsageCost(input) {
  const directory = input.priceDirectory ?? createDeepSeekPriceDirectory();
  const quoteResult = directory.lookup({
    model: input.model,
    requestStartedAt: input.requestStartedAt,
    pricingZone: input.pricingZone
  });
  const normalizedUsage = normalizeTokenUsage(input.usage ?? {});
  const usage = normalizedUsage.ok ? normalizedUsage : { ok: true, usage: emptyTokenUsage() };
  const hasInvalidUsage = !normalizedUsage.ok;
  const quote = quoteResult.ok ? quoteResult.quote : fallbackQuote(directory, input.model, quoteResult.pricingZone, input.requestStartedAt);
  const hasFallbackRate = !quoteResult.ok;
  const cacheHitMicroCny = priceTokens(usage.usage.cacheHitTokens, quote.cacheHitMicroCnyPerMillionTokens);
  const cacheMissMicroCny = priceTokens(usage.usage.cacheMissTokens, quote.cacheMissMicroCnyPerMillionTokens);
  const outputMicroCny = priceTokens(usage.usage.outputTokens, quote.outputMicroCnyPerMillionTokens);
  const cacheHitMinor = priceTokens(usage.usage.cacheHitTokens, quote.cacheHitMinorPerMillionTokens);
  const cacheMissMinor = priceTokens(usage.usage.cacheMissTokens, quote.cacheMissMinorPerMillionTokens);
  const outputMinor = priceTokens(usage.usage.outputTokens, quote.outputMinorPerMillionTokens);
  return {
    provider: DEEPSEEK_PROVIDER,
    model: input.model,
    status: input.requestOutcome === "failed" || input.requestOutcome === "aborted" ? "failed" : input.usage && !hasFallbackRate && !hasInvalidUsage ? "settled" : "estimated",
    source: "final_usage",
    priceSource: quote.source,
    pricingZone: quote.pricingZone,
    priceVersion: quote.priceVersion,
    amountMicroCny: cacheHitMicroCny + cacheMissMicroCny + outputMicroCny,
    cacheHitMicroCny,
    cacheMissMicroCny,
    outputMicroCny,
    cacheHitRateMicroCnyPerMillionTokens: quote.cacheHitMicroCnyPerMillionTokens,
    cacheMissRateMicroCnyPerMillionTokens: quote.cacheMissMicroCnyPerMillionTokens,
    outputRateMicroCnyPerMillionTokens: quote.outputMicroCnyPerMillionTokens,
    currency: quote.currency,
    amountMinor: cacheHitMinor + cacheMissMinor + outputMinor,
    cacheHitMinor,
    cacheMissMinor,
    outputMinor,
    cacheHitRateMinorPerMillionTokens: quote.cacheHitMinorPerMillionTokens,
    cacheMissRateMinorPerMillionTokens: quote.cacheMissMinorPerMillionTokens,
    outputRateMinorPerMillionTokens: quote.outputMinorPerMillionTokens,
    cacheHitTokens: usage.usage.cacheHitTokens,
    cacheMissTokens: usage.usage.cacheMissTokens,
    outputTokens: usage.usage.outputTokens,
    reasoningTokens: usage.usage.reasoningTokens,
    reasoningTokensIncludedInOutput: true,
    requestOutcome: input.requestOutcome ?? "success",
    ...hasInvalidUsage ? { unknownReason: "invalid_usage" } : {}
  };
}
function calculateXaiUsageCost(input) {
  const directory = input.priceDirectory ?? createXaiPriceDirectory();
  const normalizedUsage = normalizeTokenUsage(input.usage ?? {});
  const usage = normalizedUsage.ok ? normalizedUsage : { ok: true, usage: emptyTokenUsage() };
  const hasInvalidUsage = !normalizedUsage.ok;
  const quoteResult = directory.lookup({
    model: input.model,
    inputTokens: usage.usage.cacheHitTokens + usage.usage.cacheMissTokens
  });
  if (!quoteResult.ok) {
    return {
      provider: XAI_PROVIDER,
      model: input.model,
      status: input.requestOutcome === "failed" || input.requestOutcome === "aborted" ? "failed" : "unknown",
      source: "final_usage",
      priceSource: quoteResult.source,
      pricingZone: "unknown",
      priceVersion: quoteResult.priceVersion,
      amountMicroCny: 0n,
      cacheHitMicroCny: 0n,
      cacheMissMicroCny: 0n,
      outputMicroCny: 0n,
      cacheHitRateMicroCnyPerMillionTokens: 0n,
      cacheMissRateMicroCnyPerMillionTokens: 0n,
      outputRateMicroCnyPerMillionTokens: 0n,
      currency: "USD",
      amountMinor: 0n,
      cacheHitMinor: 0n,
      cacheMissMinor: 0n,
      outputMinor: 0n,
      cacheHitRateMinorPerMillionTokens: 0n,
      cacheMissRateMinorPerMillionTokens: 0n,
      outputRateMinorPerMillionTokens: 0n,
      cacheHitTokens: usage.usage.cacheHitTokens,
      cacheMissTokens: usage.usage.cacheMissTokens,
      outputTokens: usage.usage.outputTokens,
      reasoningTokens: usage.usage.reasoningTokens,
      reasoningTokensIncludedInOutput: true,
      requestOutcome: input.requestOutcome ?? "success",
      unknownReason: "model_not_found"
    };
  }
  const quote = quoteResult.quote;
  const cacheHitMicroCny = priceTokens(usage.usage.cacheHitTokens, quote.cacheHitMicroCnyPerMillionTokens);
  const cacheMissMicroCny = priceTokens(usage.usage.cacheMissTokens, quote.cacheMissMicroCnyPerMillionTokens);
  const outputMicroCny = priceTokens(usage.usage.outputTokens, quote.outputMicroCnyPerMillionTokens);
  const cacheHitMinor = priceTokens(usage.usage.cacheHitTokens, quote.cacheHitMinorPerMillionTokens);
  const cacheMissMinor = priceTokens(usage.usage.cacheMissTokens, quote.cacheMissMinorPerMillionTokens);
  const outputMinor = priceTokens(usage.usage.outputTokens, quote.outputMinorPerMillionTokens);
  return {
    provider: XAI_PROVIDER,
    model: input.model,
    status: input.requestOutcome === "failed" || input.requestOutcome === "aborted" ? "failed" : input.usage && !hasInvalidUsage ? "settled" : "estimated",
    source: "final_usage",
    priceSource: quote.source,
    pricingZone: quote.pricingZone,
    priceVersion: quote.priceVersion,
    amountMicroCny: cacheHitMicroCny + cacheMissMicroCny + outputMicroCny,
    cacheHitMicroCny,
    cacheMissMicroCny,
    outputMicroCny,
    cacheHitRateMicroCnyPerMillionTokens: quote.cacheHitMicroCnyPerMillionTokens,
    cacheMissRateMicroCnyPerMillionTokens: quote.cacheMissMicroCnyPerMillionTokens,
    outputRateMicroCnyPerMillionTokens: quote.outputMicroCnyPerMillionTokens,
    currency: quote.currency,
    amountMinor: cacheHitMinor + cacheMissMinor + outputMinor,
    cacheHitMinor,
    cacheMissMinor,
    outputMinor,
    cacheHitRateMinorPerMillionTokens: quote.cacheHitMinorPerMillionTokens,
    cacheMissRateMinorPerMillionTokens: quote.cacheMissMinorPerMillionTokens,
    outputRateMinorPerMillionTokens: quote.outputMinorPerMillionTokens,
    cacheHitTokens: usage.usage.cacheHitTokens,
    cacheMissTokens: usage.usage.cacheMissTokens,
    outputTokens: usage.usage.outputTokens,
    reasoningTokens: usage.usage.reasoningTokens,
    reasoningTokensIncludedInOutput: true,
    requestOutcome: input.requestOutcome ?? "success",
    ...hasInvalidUsage ? { unknownReason: "invalid_usage" } : {}
  };
}
function calculateProviderUsageCost(input) {
  const providerId = input.provider.trim().toLowerCase();
  const normalizedUsage = normalizeTokenUsage(input.usage ?? {});
  const usage = normalizedUsage.ok ? normalizedUsage.usage : emptyTokenUsage();
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0n;
  const pricingProvider = resolveAdditionalPricingCatalogKind(providerId, input.model) ?? providerId;
  const catalog = getAdditionalPricingCatalog(pricingProvider);
  const quote = lookupAdditionalPrice(
    pricingProvider,
    input.model,
    usage.cacheHitTokens + usage.cacheMissTokens + cacheWriteTokens
  );
  if (!quote) {
    return {
      provider: input.provider,
      model: input.model,
      status: input.requestOutcome === "failed" || input.requestOutcome === "aborted" ? "failed" : "unknown",
      source: "final_usage",
      priceSource: catalog?.source ?? "",
      pricingZone: "unknown",
      priceVersion: catalog?.priceVersion ?? "",
      amountMicroCny: 0n,
      cacheHitMicroCny: 0n,
      cacheMissMicroCny: 0n,
      outputMicroCny: 0n,
      cacheHitRateMicroCnyPerMillionTokens: 0n,
      cacheMissRateMicroCnyPerMillionTokens: 0n,
      outputRateMicroCnyPerMillionTokens: 0n,
      currency: "USD",
      amountMinor: 0n,
      cacheHitMinor: 0n,
      cacheMissMinor: 0n,
      outputMinor: 0n,
      cacheHitRateMinorPerMillionTokens: 0n,
      cacheMissRateMinorPerMillionTokens: 0n,
      outputRateMinorPerMillionTokens: 0n,
      cacheHitTokens: usage.cacheHitTokens,
      cacheMissTokens: usage.cacheMissTokens + cacheWriteTokens,
      ...cacheWriteTokens > 0n ? { cacheWriteTokens } : {},
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.reasoningTokens,
      reasoningTokensIncludedInOutput: true,
      requestOutcome: input.requestOutcome ?? "success",
      unknownReason: "model_not_found"
    };
  }
  const cacheHitMicroCny = priceTokens(usage.cacheHitTokens, quote.rates.cacheHitMicroCnyPerMillionTokens);
  const cacheWriteRate = quote.rates.cacheWriteMicroCnyPerMillionTokens ?? quote.rates.cacheMissMicroCnyPerMillionTokens;
  const cacheWriteMicroCny = priceTokens(cacheWriteTokens, cacheWriteRate);
  const cacheMissMicroCny = priceTokens(usage.cacheMissTokens, quote.rates.cacheMissMicroCnyPerMillionTokens) + cacheWriteMicroCny;
  const displayedCacheMissTokens = usage.cacheMissTokens + cacheWriteTokens;
  const displayedCacheMissRate = displayedCacheMissTokens > 0n ? (cacheMissMicroCny * 1000000n + displayedCacheMissTokens / 2n) / displayedCacheMissTokens : quote.rates.cacheMissMicroCnyPerMillionTokens;
  const outputMicroCny = priceTokens(usage.outputTokens, quote.rates.outputMicroCnyPerMillionTokens);
  const cacheHitMinor = priceTokens(usage.cacheHitTokens, quote.nativeRates.cacheHitMinorPerMillionTokens);
  const cacheWriteMinor = priceTokens(
    cacheWriteTokens,
    quote.nativeRates.cacheWriteMinorPerMillionTokens ?? quote.nativeRates.cacheMissMinorPerMillionTokens
  );
  const cacheMissMinor = priceTokens(usage.cacheMissTokens, quote.nativeRates.cacheMissMinorPerMillionTokens) + cacheWriteMinor;
  const displayedCacheMissMinorTokens = displayedCacheMissTokens;
  const displayedCacheMissRateMinor = displayedCacheMissMinorTokens > 0n ? (cacheMissMinor * 1000000n + displayedCacheMissMinorTokens / 2n) / displayedCacheMissMinorTokens : quote.nativeRates.cacheMissMinorPerMillionTokens;
  const outputMinor = priceTokens(usage.outputTokens, quote.nativeRates.outputMinorPerMillionTokens);
  const hasInvalidUsage = !normalizedUsage.ok;
  return {
    provider: input.provider,
    model: input.model,
    status: input.requestOutcome === "failed" || input.requestOutcome === "aborted" ? "failed" : input.usage && !hasInvalidUsage ? "settled" : "estimated",
    source: "final_usage",
    priceSource: quote.source,
    pricingZone: quote.pricingZone,
    priceVersion: quote.priceVersion,
    amountMicroCny: cacheHitMicroCny + cacheMissMicroCny + outputMicroCny,
    cacheHitMicroCny,
    cacheMissMicroCny,
    outputMicroCny,
    cacheHitRateMicroCnyPerMillionTokens: quote.rates.cacheHitMicroCnyPerMillionTokens,
    cacheMissRateMicroCnyPerMillionTokens: displayedCacheMissRate,
    outputRateMicroCnyPerMillionTokens: quote.rates.outputMicroCnyPerMillionTokens,
    currency: quote.currency,
    amountMinor: cacheHitMinor + cacheMissMinor + outputMinor,
    cacheHitMinor,
    cacheMissMinor,
    outputMinor,
    cacheHitRateMinorPerMillionTokens: quote.nativeRates.cacheHitMinorPerMillionTokens,
    cacheMissRateMinorPerMillionTokens: displayedCacheMissRateMinor,
    outputRateMinorPerMillionTokens: quote.nativeRates.outputMinorPerMillionTokens,
    cacheHitTokens: usage.cacheHitTokens,
    cacheMissTokens: displayedCacheMissTokens,
    ...cacheWriteTokens > 0n ? { cacheWriteTokens } : {},
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    reasoningTokensIncludedInOutput: true,
    requestOutcome: input.requestOutcome ?? "success",
    ...hasInvalidUsage ? { unknownReason: "invalid_usage" } : {}
  };
}
function estimateProviderCostEvent(input) {
  const result = calculateProviderUsageCost({
    provider: input.provider,
    model: input.model,
    usage: input.usageProjection ?? {}
  });
  return buildCostEvent(input, result, "stream", "estimated");
}
function finalizeProviderCostEvent(input) {
  if (!input.usage && input.previousEvent && input.previousEvent.status !== "unknown") {
    const previous = input.previousEvent;
    const outcome = input.requestOutcome ?? previous.requestOutcome;
    return {
      ...previous,
      id: input.id,
      eventKey: createCostEventKey(input),
      sessionId: input.sessionId,
      turnId: input.turnId,
      stepId: input.stepId,
      attemptId: input.attemptId,
      provider: input.provider,
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      agentPreset: input.agentPreset,
      parentSessionId: input.parentSessionId,
      requestStartedAt: toIsoString(input.requestStartedAt),
      completedAt: input.completedAt ? toIsoString(input.completedAt) : previous.completedAt,
      status: outcome === "failed" || outcome === "aborted" ? "failed" : "estimated",
      source: previous.source === "stream" ? "stream" : "final_usage",
      requestOutcome: outcome,
      correctionOfEventId: previous.id,
      unknownReason: void 0
    };
  }
  const result = calculateProviderUsageCost({
    provider: input.provider,
    model: input.model,
    usage: input.usage,
    requestOutcome: input.requestOutcome
  });
  const finalEvent = buildCostEvent(
    input,
    !input.usage && result.status === "settled" ? { ...result, status: "estimated" } : result,
    "final_usage",
    !input.usage && result.status === "settled" ? "estimated" : result.status
  );
  return input.previousEvent ? { ...finalEvent, correctionOfEventId: input.previousEvent.id } : finalEvent;
}
function estimateXaiCostEvent(input) {
  const result = calculateXaiUsageCost({
    model: input.model,
    usage: input.usageProjection ?? {},
    priceDirectory: input.priceDirectory
  });
  return buildCostEvent(input, result, "stream", "estimated");
}
function finalizeXaiCostEvent(input) {
  if (!input.usage && input.previousEvent && input.previousEvent.status !== "unknown") {
    const previous = input.previousEvent;
    const outcome = input.requestOutcome ?? previous.requestOutcome;
    return {
      ...previous,
      id: input.id,
      eventKey: createCostEventKey(input),
      sessionId: input.sessionId,
      turnId: input.turnId,
      stepId: input.stepId,
      attemptId: input.attemptId,
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      agentPreset: input.agentPreset,
      parentSessionId: input.parentSessionId,
      requestStartedAt: toIsoString(input.requestStartedAt),
      completedAt: input.completedAt ? toIsoString(input.completedAt) : previous.completedAt,
      status: outcome === "failed" || outcome === "aborted" ? "failed" : "estimated",
      source: previous.source === "stream" ? "stream" : "final_usage",
      requestOutcome: outcome,
      correctionOfEventId: previous.id,
      unknownReason: void 0
    };
  }
  const result = calculateXaiUsageCost({
    model: input.model,
    usage: input.usage,
    priceDirectory: input.priceDirectory,
    requestOutcome: input.requestOutcome
  });
  const finalEvent = buildCostEvent(
    input,
    !input.usage && result.status === "settled" ? { ...result, status: "estimated" } : result,
    "final_usage",
    !input.usage && result.status === "settled" ? "estimated" : result.status
  );
  return input.previousEvent ? { ...finalEvent, correctionOfEventId: input.previousEvent.id } : finalEvent;
}
function estimateDeepSeekCostEvent(input) {
  const result = calculateDeepSeekUsageCost({
    model: input.model,
    requestStartedAt: input.requestStartedAt,
    usage: input.usageProjection ?? {},
    priceDirectory: input.priceDirectory
  });
  return buildCostEvent(input, { ...result, status: "estimated" }, "stream", "estimated");
}
function finalizeDeepSeekCostEvent(input) {
  if (!input.usage && input.previousEvent && input.previousEvent.status !== "unknown") {
    const previous = input.previousEvent;
    const outcome = input.requestOutcome ?? previous.requestOutcome;
    const status = outcome === "failed" || outcome === "aborted" ? "failed" : "estimated";
    return {
      ...previous,
      id: input.id,
      eventKey: createCostEventKey(input),
      sessionId: input.sessionId,
      turnId: input.turnId,
      stepId: input.stepId,
      attemptId: input.attemptId,
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      agentPreset: input.agentPreset,
      parentSessionId: input.parentSessionId,
      requestStartedAt: toIsoString(input.requestStartedAt),
      completedAt: input.completedAt ? toIsoString(input.completedAt) : previous.completedAt,
      status,
      source: previous.source === "stream" ? "stream" : "final_usage",
      requestOutcome: outcome,
      correctionOfEventId: previous.id,
      unknownReason: void 0
    };
  }
  const result = calculateDeepSeekUsageCost({
    model: input.model,
    requestStartedAt: input.requestStartedAt,
    usage: input.usage,
    priceDirectory: input.priceDirectory,
    requestOutcome: input.requestOutcome
  });
  const finalEvent = buildCostEvent(
    input,
    !input.usage && result.status === "settled" ? { ...result, status: "estimated" } : result,
    "final_usage",
    !input.usage && result.status === "settled" ? "estimated" : result.status
  );
  if (!input.previousEvent) {
    return finalEvent;
  }
  const finalKey = createCostEventKey(input);
  if (input.previousEvent.eventKey !== finalKey) {
    throw new Error("previousEvent does not match final usage identity");
  }
  return {
    ...finalEvent,
    correctionOfEventId: input.previousEvent.id
  };
}
function createUnknownCostEvent(input, options) {
  const normalizedUsage = options.usage ? normalizeTokenUsage(options.usage) : options.previousEvent ? {
    ok: true,
    usage: {
      cacheHitTokens: options.previousEvent.cacheHitTokens,
      cacheMissTokens: options.previousEvent.cacheMissTokens,
      outputTokens: options.previousEvent.outputTokens,
      reasoningTokens: options.previousEvent.reasoningTokens
    }
  } : { ok: true, usage: emptyTokenUsage() };
  const usage = normalizedUsage.ok ? normalizedUsage.usage : emptyTokenUsage();
  const event = {
    id: input.id,
    eventKey: createCostEventKey(input),
    sessionId: input.sessionId,
    turnId: input.turnId,
    stepId: input.stepId,
    attemptId: input.attemptId,
    provider: input.provider ?? "unknown",
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    agentPreset: input.agentPreset,
    parentSessionId: input.parentSessionId,
    requestStartedAt: toIsoString(input.requestStartedAt),
    completedAt: input.completedAt ? toIsoString(input.completedAt) : void 0,
    pricingZone: "unknown",
    priceVersion: "",
    amountMicroCny: 0n,
    cacheHitTokens: usage.cacheHitTokens,
    cacheMissTokens: usage.cacheMissTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    cacheHitMicroCny: 0n,
    cacheMissMicroCny: 0n,
    outputMicroCny: 0n,
    cacheHitRateMicroCnyPerMillionTokens: 0n,
    cacheMissRateMicroCnyPerMillionTokens: 0n,
    outputRateMicroCnyPerMillionTokens: 0n,
    reasoningTokensIncludedInOutput: true,
    status: "unknown",
    source: options.source,
    requestOutcome: options.requestOutcome ?? "success",
    unknownReason: options.unknownReason ?? "rate_not_found",
    ...options.previousEvent ? { correctionOfEventId: options.previousEvent.id } : {}
  };
  return event;
}
function dedupeCostEvents(events) {
  const order = [];
  const byKey = /* @__PURE__ */ new Map();
  for (const event of events) {
    const key = event.eventKey || createCostEventKey(event);
    const normalized = event.eventKey === key ? event : { ...event, eventKey: key };
    if (!byKey.has(key)) {
      order.push(key);
      byKey.set(key, normalized);
      continue;
    }
    const current = byKey.get(key);
    if (!current || shouldReplaceCostEvent(current, normalized)) {
      byKey.set(key, normalized);
    }
  }
  return order.map((key) => byKey.get(key)).filter((event) => Boolean(event));
}
function aggregateCostEvents(events) {
  const aggregate = {
    global: createEmptyAggregateBucket(),
    sessions: /* @__PURE__ */ new Map(),
    days: /* @__PURE__ */ new Map()
  };
  for (const event of dedupeCostEvents(events)) {
    applyEventToBucket(aggregate.global, event);
    applyEventToBucket(getOrCreateBucket(aggregate.sessions, event.sessionId), event);
    applyEventToBucket(getOrCreateBucket(aggregate.days, getUtcDayKey(event.requestStartedAt)), event);
  }
  return aggregate;
}
function createCostEventJournal(initialEvents = []) {
  const order = [];
  const byKey = /* @__PURE__ */ new Map();
  for (const event of dedupeCostEvents(initialEvents)) {
    order.push(event.eventKey);
    byKey.set(event.eventKey, event);
  }
  const list = () => order.map((key) => byKey.get(key)).filter((event) => Boolean(event));
  return {
    upsert: (event) => {
      const key = event.eventKey || createCostEventKey(event);
      const normalized = event.eventKey === key ? event : { ...event, eventKey: key };
      const current = byKey.get(key);
      if (!current) {
        order.push(key);
        byKey.set(key, normalized);
      } else if (shouldReplaceCostEvent(current, normalized)) {
        byKey.set(key, normalized);
      }
      return byKey.get(key);
    },
    getByKey: (eventKey) => byKey.get(eventKey),
    list,
    aggregate: () => aggregateCostEvents(list())
  };
}
function emptyTokenUsage() {
  return {
    cacheHitTokens: 0n,
    cacheMissTokens: 0n,
    outputTokens: 0n,
    reasoningTokens: 0n
  };
}
function fallbackQuote(directory, model, pricingZone, requestStartedAt) {
  const fallbackModel = fallbackDeepSeekModelId(model);
  const fallbackDirectory = createDeepSeekPriceDirectory();
  const result = fallbackDirectory.lookup({
    model: fallbackModel,
    requestStartedAt,
    pricingZone
  });
  if (result.ok) {
    return {
      ...result.quote,
      model,
      priceVersion: directory.priceVersion,
      source: directory.source
    };
  }
  throw new Error("default DeepSeek fallback rate is unavailable");
}
function buildCostEvent(input, result, source, status) {
  return {
    id: input.id,
    eventKey: createCostEventKey(input),
    sessionId: input.sessionId,
    turnId: input.turnId,
    stepId: input.stepId,
    attemptId: input.attemptId,
    provider: result.provider === DEEPSEEK_PROVIDER ? DEEPSEEK_PROVIDER : input.provider ?? result.provider,
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    agentPreset: input.agentPreset,
    parentSessionId: input.parentSessionId,
    requestStartedAt: toIsoString(input.requestStartedAt),
    completedAt: input.completedAt ? toIsoString(input.completedAt) : void 0,
    pricingZone: result.pricingZone,
    priceVersion: result.priceVersion,
    amountMicroCny: result.amountMicroCny,
    cacheHitTokens: result.cacheHitTokens,
    cacheMissTokens: result.cacheMissTokens,
    ...result.cacheWriteTokens !== void 0 ? { cacheWriteTokens: result.cacheWriteTokens } : {},
    outputTokens: result.outputTokens,
    reasoningTokens: result.reasoningTokens,
    cacheHitMicroCny: result.cacheHitMicroCny,
    cacheMissMicroCny: result.cacheMissMicroCny,
    outputMicroCny: result.outputMicroCny,
    cacheHitRateMicroCnyPerMillionTokens: result.cacheHitRateMicroCnyPerMillionTokens,
    cacheMissRateMicroCnyPerMillionTokens: result.cacheMissRateMicroCnyPerMillionTokens,
    outputRateMicroCnyPerMillionTokens: result.outputRateMicroCnyPerMillionTokens,
    ...result.currency ? { currency: result.currency } : {},
    ...result.amountMinor !== void 0 ? { amountMinor: result.amountMinor } : {},
    ...result.cacheHitMinor !== void 0 ? { cacheHitMinor: result.cacheHitMinor } : {},
    ...result.cacheMissMinor !== void 0 ? { cacheMissMinor: result.cacheMissMinor } : {},
    ...result.outputMinor !== void 0 ? { outputMinor: result.outputMinor } : {},
    ...result.cacheHitRateMinorPerMillionTokens !== void 0 ? { cacheHitRateMinorPerMillionTokens: result.cacheHitRateMinorPerMillionTokens } : {},
    ...result.cacheMissRateMinorPerMillionTokens !== void 0 ? { cacheMissRateMinorPerMillionTokens: result.cacheMissRateMinorPerMillionTokens } : {},
    ...result.outputRateMinorPerMillionTokens !== void 0 ? { outputRateMinorPerMillionTokens: result.outputRateMinorPerMillionTokens } : {},
    reasoningTokensIncludedInOutput: true,
    status,
    source,
    requestOutcome: result.requestOutcome,
    unknownReason: result.unknownReason
  };
}
function normalizeTokenUsage(usage) {
  try {
    const cacheHitTokens = firstTokenCount([
      usage.cacheHitTokens,
      usage.promptCacheHitTokens,
      usage.prompt_cache_hit_tokens,
      usage.cachedTokens,
      usage.prompt_tokens_details?.cached_tokens
    ]) ?? 0n;
    const explicitCacheMissTokens = firstTokenCount([
      usage.cacheMissTokens,
      usage.promptCacheMissTokens,
      usage.prompt_cache_miss_tokens
    ]);
    const cacheWriteTokens = firstTokenCount([usage.cacheWriteTokens, usage.cache_write_tokens]) ?? 0n;
    const promptTokens = firstTokenCount([usage.promptTokens, usage.prompt_tokens]);
    const cacheMissTokens = explicitCacheMissTokens ?? (promptTokens !== void 0 ? promptTokens > cacheHitTokens ? promptTokens - cacheHitTokens : 0n : 0n);
    const outputTokens = firstTokenCount([usage.outputTokens, usage.completionTokens, usage.completion_tokens]) ?? 0n;
    const reasoningTokens = firstTokenCount([usage.reasoningTokens, usage.reasoning_tokens, usage.completion_tokens_details?.reasoning_tokens]) ?? 0n;
    return {
      ok: true,
      usage: {
        cacheHitTokens,
        cacheMissTokens,
        ...cacheWriteTokens > 0n ? { cacheWriteTokens } : {},
        outputTokens,
        reasoningTokens
      }
    };
  } catch {
    return { ok: false };
  }
}
function firstTokenCount(values) {
  for (const value of values) {
    if (value !== void 0) {
      return toTokenCount(value);
    }
  }
  return void 0;
}
function toTokenCount(value) {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error("token count must not be negative");
    }
    return value;
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("token count must be a non-negative safe integer");
  }
  return BigInt(value);
}
function priceTokens(tokens, microCnyPerMillionTokens) {
  return roundDiv(tokens * microCnyPerMillionTokens, TOKENS_PER_MILLION);
}
function roundDiv(value, divisor) {
  return (value + divisor / 2n) / divisor;
}
function isInMinutesRange(value, startInclusive, endExclusive) {
  return value >= startInclusive && value < endExclusive;
}
function toValidDate(input) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid date input");
  }
  return date;
}
function toIsoString(input) {
  return toValidDate(input).toISOString();
}
function shouldReplaceCostEvent(existing, next) {
  const statusDelta = statusPriority(next.status) - statusPriority(existing.status);
  if (statusDelta !== 0) {
    return statusDelta > 0;
  }
  const sourceDelta = sourcePriority(next.source) - sourcePriority(existing.source);
  if (sourceDelta !== 0) {
    return sourceDelta > 0;
  }
  if (next.status === "estimated" && next.amountMicroCny !== existing.amountMicroCny) {
    return next.amountMicroCny > existing.amountMicroCny;
  }
  const existingTime = Date.parse(existing.completedAt ?? existing.requestStartedAt);
  const nextTime = Date.parse(next.completedAt ?? next.requestStartedAt);
  if (Number.isFinite(existingTime) && Number.isFinite(nextTime) && existingTime !== nextTime) {
    return nextTime > existingTime;
  }
  return true;
}
function statusPriority(status) {
  switch (status) {
    case "settled":
      return 4;
    case "failed":
      return 3;
    case "estimated":
      return 2;
    case "unknown":
      return 1;
  }
}
function sourcePriority(source) {
  switch (source) {
    case "final_usage":
      return 3;
    case "restored":
      return 2;
    case "stream":
      return 1;
  }
}
function getOrCreateBucket(map, key) {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const created = createEmptyAggregateBucket();
  map.set(key, created);
  return created;
}
function applyEventToBucket(bucket, event) {
  bucket.eventCount += 1;
  updateActivityRange(bucket, event);
  if (event.status === "unknown") {
    bucket.unknownCount += 1;
    return;
  }
  bucket.totalMicroCny += event.amountMicroCny;
  bucket.cacheHitTokens += event.cacheHitTokens;
  bucket.cacheMissTokens += event.cacheMissTokens;
  bucket.outputTokens += event.outputTokens;
  bucket.reasoningTokens += event.reasoningTokens;
  if (event.status === "settled") {
    bucket.settledMicroCny += event.amountMicroCny;
  } else if (event.status === "estimated") {
    bucket.estimatedMicroCny += event.amountMicroCny;
  } else if (event.status === "failed") {
    bucket.failedMicroCny += event.amountMicroCny;
  }
  if (event.pricingZone === "peak") {
    bucket.peakMicroCny += event.amountMicroCny;
  } else if (event.pricingZone === "offpeak") {
    bucket.offpeakMicroCny += event.amountMicroCny;
  }
}
function updateActivityRange(bucket, event) {
  const start = event.requestStartedAt;
  const last = event.completedAt ?? event.requestStartedAt;
  if (!bucket.firstActivityAt || Date.parse(start) < Date.parse(bucket.firstActivityAt)) {
    bucket.firstActivityAt = start;
  }
  if (!bucket.lastActivityAt || Date.parse(last) > Date.parse(bucket.lastActivityAt)) {
    bucket.lastActivityAt = last;
  }
}
function getUtcDayKey(dateInput) {
  return toIsoString(dateInput).slice(0, 10);
}

// packages/host/src/types.ts
var UNKNOWN_TEXT = "unknown";
function asText(value, fallback = UNKNOWN_TEXT) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return fallback;
}
function asNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}
function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}
function normalizeTokenUsage2(input) {
  const cacheHitTokens = firstNumber([
    input.cacheHitTokens,
    input.cache_hit_tokens,
    input.promptCacheHitTokens,
    input.prompt_cache_hit_tokens,
    input.cachedTokens,
    input.prompt_tokens_details?.cached_tokens
  ]) ?? 0;
  const explicitCacheMissTokens = firstNumber([
    input.cacheMissTokens,
    input.cache_miss_tokens,
    input.promptCacheMissTokens,
    input.prompt_cache_miss_tokens
  ]);
  const cacheWriteTokens = firstNumber([input.cacheWriteTokens, input.cache_write_tokens]) ?? 0;
  const promptTokens = firstNumber([input.promptTokens, input.prompt_tokens]);
  const cacheMissTokens = explicitCacheMissTokens ?? (promptTokens !== void 0 ? Math.max(promptTokens - cacheHitTokens - cacheWriteTokens, 0) : 0);
  const outputTokens = firstNumber([
    input.outputTokens,
    input.output_tokens,
    input.completionTokens,
    input.completion_tokens
  ]) ?? 0;
  const reasoningTokens = firstNumber([
    input.reasoningTokens,
    input.reasoning_tokens,
    input.completion_tokens_details?.reasoning_tokens
  ]) ?? 0;
  const totalTokens = firstNumber([input.totalTokens, input.total_tokens]) ?? (promptTokens !== void 0 ? promptTokens : cacheHitTokens + cacheMissTokens) + outputTokens;
  return {
    cacheHitTokens,
    cacheMissTokens,
    ...cacheWriteTokens > 0 ? { cacheWriteTokens } : {},
    outputTokens,
    reasoningTokens,
    totalTokens
  };
}
function createHostCostEventKey(identity) {
  return [
    normalizeHostKeyPart(identity.sessionId, "sessionId"),
    normalizeHostKeyPart(identity.turnId, "turnId"),
    normalizeHostKeyPart(identity.stepId, "stepId"),
    normalizeHostKeyPart(identity.attemptId, "attemptId")
  ].join(":");
}
function normalizeCostEvent(input) {
  return Object.freeze({
    id: input.id,
    eventKey: createHostCostEventKey(input),
    sessionId: input.sessionId,
    requestStartedAt: input.requestStartedAt,
    status: input.status,
    amountMicroCny: asNumber(input.amountMicroCny),
    currency: input.currency ?? "CNY",
    amountMinor: asNumber(input.amountMinor ?? input.amountMicroCny),
    cacheHitMinor: asNumber(input.cacheHitMinor ?? input.hitRateMicroCny),
    cacheMissMinor: asNumber(input.cacheMissMinor ?? input.missRateMicroCny),
    outputMinor: asNumber(input.outputMinor ?? input.outputRateMicroCny),
    cacheHitRateMinorPerMillionTokens: asNumber(input.cacheHitRateMinorPerMillionTokens ?? input.cacheHitRateMicroCnyPerMillionTokens),
    cacheMissRateMinorPerMillionTokens: asNumber(input.cacheMissRateMinorPerMillionTokens ?? input.cacheMissRateMicroCnyPerMillionTokens),
    outputRateMinorPerMillionTokens: asNumber(input.outputRateMinorPerMillionTokens ?? input.outputRateMicroCnyPerMillionTokens),
    source: input.source,
    turnId: asText(input.turnId),
    stepId: asText(input.stepId),
    attemptId: asText(input.attemptId),
    parentSessionId: asText(input.parentSessionId),
    provider: asText(input.provider),
    model: asText(input.model),
    reasoningEffort: asText(input.reasoningEffort),
    agentPreset: asText(input.agentPreset),
    completedAt: asText(input.completedAt),
    ...input.requestOutcome ? { requestOutcome: input.requestOutcome } : {},
    pricingZone: input.pricingZone ?? "unknown",
    cacheHitTokens: asNumber(input.cacheHitTokens),
    cacheMissTokens: asNumber(input.cacheMissTokens),
    ...input.cacheWriteTokens !== void 0 ? { cacheWriteTokens: asNumber(input.cacheWriteTokens) } : {},
    outputTokens: asNumber(input.outputTokens),
    reasoningTokens: asNumber(input.reasoningTokens),
    hitRateMicroCny: asNumber(input.hitRateMicroCny),
    missRateMicroCny: asNumber(input.missRateMicroCny),
    outputRateMicroCny: asNumber(input.outputRateMicroCny),
    cacheHitRateMicroCnyPerMillionTokens: asNumber(input.cacheHitRateMicroCnyPerMillionTokens),
    cacheMissRateMicroCnyPerMillionTokens: asNumber(input.cacheMissRateMicroCnyPerMillionTokens),
    outputRateMicroCnyPerMillionTokens: asNumber(input.outputRateMicroCnyPerMillionTokens),
    priceVersion: asText(input.priceVersion)
  });
}
function firstNumber(values) {
  for (const value of values) {
    const parsed = asNumber(value, Number.NaN);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return void 0;
}
function normalizeHostKeyPart(value, name2) {
  const normalized = asText(value, UNKNOWN_TEXT).trim();
  const part = normalized.length > 0 ? normalized : UNKNOWN_TEXT;
  if (part.includes(":")) {
    throw new Error(`${name2} must not contain ':'`);
  }
  return part;
}
function createEmptySummary() {
  return {
    requestCount: 0,
    totalMicroCny: 0,
    estimatedMicroCny: 0,
    settledMicroCny: 0,
    unknownMicroCny: 0,
    failedMicroCny: 0,
    unknownCount: 0,
    estimatedCount: 0,
    settledCount: 0,
    failedCount: 0,
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    peakMicroCny: 0,
    offpeakMicroCny: 0,
    firstSeenAt: "",
    lastSeenAt: "",
    provider: UNKNOWN_TEXT,
    model: UNKNOWN_TEXT,
    reasoningEffort: UNKNOWN_TEXT,
    agentPreset: UNKNOWN_TEXT
  };
}
function updateSummary(summary, event) {
  summary.requestCount += 1;
  summary.cacheHitTokens += event.cacheHitTokens;
  summary.cacheMissTokens += event.cacheMissTokens;
  summary.outputTokens += event.outputTokens;
  summary.reasoningTokens += event.reasoningTokens;
  if (summary.firstSeenAt === "" || event.requestStartedAt < summary.firstSeenAt) {
    summary.firstSeenAt = event.requestStartedAt;
  }
  if (summary.lastSeenAt === "" || event.requestStartedAt > summary.lastSeenAt) {
    summary.lastSeenAt = event.requestStartedAt;
    if (event.provider !== UNKNOWN_TEXT) {
      summary.provider = event.provider;
    }
    if (event.model !== UNKNOWN_TEXT) {
      summary.model = event.model;
    }
    if (event.reasoningEffort !== UNKNOWN_TEXT) {
      summary.reasoningEffort = event.reasoningEffort;
    }
    if (event.agentPreset !== UNKNOWN_TEXT) {
      summary.agentPreset = event.agentPreset;
    }
  }
  switch (event.status) {
    case "estimated":
      summary.estimatedCount += 1;
      summary.estimatedMicroCny += event.amountMicroCny;
      summary.totalMicroCny += event.amountMicroCny;
      break;
    case "settled":
      summary.settledCount += 1;
      summary.settledMicroCny += event.amountMicroCny;
      summary.totalMicroCny += event.amountMicroCny;
      break;
    case "failed":
      summary.failedCount += 1;
      summary.failedMicroCny += event.amountMicroCny;
      summary.totalMicroCny += event.amountMicroCny;
      break;
    case "unknown":
      summary.unknownCount += 1;
      summary.unknownMicroCny += event.amountMicroCny;
      break;
  }
  if (event.pricingZone === "peak") {
    summary.peakMicroCny += event.amountMicroCny;
  } else if (event.pricingZone === "offpeak") {
    summary.offpeakMicroCny += event.amountMicroCny;
  }
  return summary;
}
function finalizeSummary(summary) {
  if (summary.firstSeenAt === "") {
    summary.firstSeenAt = "";
  }
  if (summary.lastSeenAt === "") {
    summary.lastSeenAt = "";
  }
  return summary;
}
function dayKeyFromTimestamp(timestamp) {
  if (timestamp.length >= 10) {
    return timestamp.slice(0, 10);
  }
  const parsed = new Date(timestamp);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "1970-01-01";
}

// packages/host/src/ledger.ts
import {
  closeSync as closeSync2,
  existsSync as existsSync2,
  fsyncSync as fsyncSync2,
  mkdirSync as mkdirSync2,
  openSync as openSync2,
  readFileSync as readFileSync2,
  renameSync as renameSync2,
  rmSync as rmSync2,
  writeFileSync as writeFileSync2
} from "node:fs";
import { dirname as dirname2 } from "node:path";

// packages/host/src/recovery-checkpoint.ts
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
var RECOVERY_CHECKPOINT_SCHEMA_VERSION = 1;
function createRecoveryCheckpointPath(ledgerPath) {
  return `${requireNonEmptyText(ledgerPath, "ledgerPath")}.recovery.json`;
}
function createLedgerFingerprint(ledgerPath) {
  const filePath = requireNonEmptyText(ledgerPath, "ledgerPath");
  if (!existsSync(filePath)) {
    return createLedgerFingerprintFromContents(filePath, null);
  }
  return createLedgerFingerprintFromContents(filePath, readFileSync(filePath, "utf8"));
}
function createLedgerFingerprintFromContents(ledgerPath, contents) {
  const filePath = resolve(requireNonEmptyText(ledgerPath, "ledgerPath"));
  const hash = createHash("sha256");
  hash.update(filePath);
  hash.update("\0");
  if (contents === null) {
    hash.update("missing");
  } else {
    hash.update("file");
    hash.update("\0");
    hash.update(contents);
  }
  return `sha256:${hash.digest("hex")}`;
}
function loadRecoveryCheckpoint(filePath, expectations, onRecovery) {
  const expectedSourceKey = requireNonEmptyText(expectations.sourceKey, "expectations.sourceKey");
  const expectedProjectionVersion = requireNonEmptyText(
    expectations.projectionVersion,
    "expectations.projectionVersion"
  );
  const expectedLedgerFingerprint = requireNonEmptyText(
    expectations.ledgerFingerprint,
    "expectations.ledgerFingerprint"
  );
  if (!existsSync(filePath)) {
    return null;
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    const quarantinePath = quarantineRecoveryCheckpointFile(filePath, "corrupt");
    onRecovery?.({ filePath, quarantinePath, reason: "corrupt" });
    return null;
  }
  const record = asRecord(raw);
  const schemaVersion = record.schemaVersion;
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    const quarantinePath = quarantineRecoveryCheckpointFile(filePath, "corrupt");
    onRecovery?.({ filePath, quarantinePath, reason: "corrupt" });
    return null;
  }
  if (schemaVersion !== RECOVERY_CHECKPOINT_SCHEMA_VERSION) {
    const quarantinePath = quarantineRecoveryCheckpointFile(filePath, `schema-${schemaVersion}`);
    onRecovery?.({ filePath, quarantinePath, reason: `schema-${schemaVersion}` });
    return null;
  }
  const checkpoint = normalizeRecoveryCheckpoint(record);
  if (checkpoint === null) {
    const quarantinePath = quarantineRecoveryCheckpointFile(filePath, "corrupt");
    onRecovery?.({ filePath, quarantinePath, reason: "corrupt" });
    return null;
  }
  if (checkpoint.sourceKey !== expectedSourceKey || checkpoint.projectionVersion !== expectedProjectionVersion || checkpoint.ledgerFingerprint !== expectedLedgerFingerprint) {
    return null;
  }
  return checkpoint;
}
function saveRecoveryCheckpoint(filePath, checkpoint) {
  const normalized = normalizeRecoveryCheckpoint(checkpoint);
  if (normalized === null) {
    throw new Error("recovery checkpoint: invalid checkpoint record");
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeJsonAtomically(filePath, JSON.stringify(normalized, null, 2));
}
function normalizeRecoveryCheckpoint(value) {
  const record = asRecord(value);
  const schemaVersion = record.schemaVersion;
  if (schemaVersion !== RECOVERY_CHECKPOINT_SCHEMA_VERSION) {
    return null;
  }
  const sourceKey = textOrNull(record.sourceKey);
  const projectionVersion = textOrNull(record.projectionVersion);
  const ledgerFingerprint = textOrNull(record.ledgerFingerprint);
  const sessionRevisions = normalizeSessionRevisions(record.sessionRevisions);
  if (!sourceKey || !projectionVersion || !ledgerFingerprint || sessionRevisions === null) {
    return null;
  }
  return {
    schemaVersion: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
    sourceKey,
    projectionVersion,
    ledgerFingerprint,
    sessionRevisions
  };
}
function quarantineRecoveryCheckpointFile(filePath, reason) {
  if (!existsSync(filePath)) {
    return null;
  }
  const quarantinePath = `${filePath}.${reason}-${Date.now()}-${process.pid}`;
  try {
    renameSync(filePath, quarantinePath);
    return quarantinePath;
  } catch {
    return null;
  }
}
function writeJsonAtomically(filePath, contents) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  let descriptor2 = null;
  try {
    descriptor2 = openSync(tmpPath, "w");
    writeFileSync(descriptor2, contents);
    fsyncSync(descriptor2);
    closeSync(descriptor2);
    descriptor2 = null;
    renameSync(tmpPath, filePath);
    fsyncDirectory(dirname(filePath));
  } catch (error) {
    if (descriptor2 !== null) closeSync(descriptor2);
    if (existsSync(tmpPath)) {
      rmSync(tmpPath, { force: true });
    }
    throw error;
  }
}
function fsyncDirectory(directoryPath) {
  let descriptor2 = null;
  try {
    descriptor2 = openSync(directoryPath, "r");
    fsyncSync(descriptor2);
  } catch {
  } finally {
    if (descriptor2 !== null) closeSync(descriptor2);
  }
}
function requireNonEmptyText(value, name2) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`recovery checkpoint: invalid ${name2}`);
  }
  return value;
}
function textOrNull(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
function normalizeSessionRevisions(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const revisions = {};
  for (const [sessionId, revision] of Object.entries(value)) {
    const normalizedSessionId = textOrNull(sessionId);
    const normalizedRevision = textOrNull(revision);
    if (normalizedSessionId && normalizedRevision) {
      revisions[normalizedSessionId] = normalizedRevision;
    }
  }
  return revisions;
}

// packages/host/src/ledger.ts
var LEDGER_SCHEMA_VERSION = 1;
var COST_EVENT_STATUSES = /* @__PURE__ */ new Set(["estimated", "settled", "unknown", "failed"]);
var COST_EVENT_SOURCES = /* @__PURE__ */ new Set(["stream", "final_usage", "restored", "projection"]);
var COST_REQUEST_OUTCOMES = /* @__PURE__ */ new Set([
  "success",
  "failed",
  "aborted"
]);
var PRICING_ZONES = /* @__PURE__ */ new Set(["peak", "offpeak", "unknown"]);
function createInMemoryCostEventRepository(initialEvents = []) {
  const events = /* @__PURE__ */ new Map();
  const idsByEventKey = /* @__PURE__ */ new Map();
  const insert = (event) => {
    const normalized = normalizeCostEvent(event);
    const existingById = events.get(normalized.id);
    if (existingById) {
      return existingById;
    }
    const dedupeKey = completeHostCostEventKey(normalized);
    if (dedupeKey) {
      const existingId = idsByEventKey.get(dedupeKey);
      const existingByKey = existingId ? events.get(existingId) : void 0;
      if (existingByKey) {
        if (!shouldReplaceHostCostEvent(existingByKey, normalized)) {
          return existingByKey;
        }
        events.delete(existingByKey.id);
      }
    }
    events.set(normalized.id, normalized);
    if (dedupeKey) {
      idsByEventKey.set(dedupeKey, normalized.id);
    }
    return normalized;
  };
  for (const event of initialEvents) {
    insert(event);
  }
  return {
    upsert(event) {
      return insert(event);
    },
    commit(events2) {
      for (const event of events2) {
        insert(event);
      }
    },
    list() {
      return Object.freeze([...events.values()]);
    },
    getById(id) {
      return events.get(id);
    },
    replaceAll(nextEvents) {
      events.clear();
      idsByEventKey.clear();
      for (const event of nextEvents) {
        insert(event);
      }
    },
    clear() {
      events.clear();
      idsByEventKey.clear();
    }
  };
}
function dedupeHostCostEvents(events) {
  return [...createInMemoryCostEventRepository(events).list()];
}
function createFileCostEventRepository({
  filePath,
  onRecovery
}) {
  const initial = readLedgerFile(filePath, onRecovery);
  const repository = createInMemoryCostEventRepository(initial.events);
  let ledgerFingerprint = initial.fingerprint;
  const mergeFromDisk = (events) => {
    const disk = readLedgerFile(filePath, onRecovery);
    ledgerFingerprint = disk.fingerprint;
    return createInMemoryCostEventRepository([
      ...disk.events,
      ...events
    ]).list();
  };
  const persist = () => {
    const payload = {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      events: repository.list()
    };
    const contents = JSON.stringify(payload, null, 2);
    mkdirSync2(dirname2(filePath), { recursive: true });
    writeLedgerFileAtomically(filePath, contents);
    ledgerFingerprint = createLedgerFingerprintFromContents(filePath, contents);
  };
  return {
    upsert(event) {
      repository.replaceAll(mergeFromDisk(repository.list()));
      const result = repository.upsert(event);
      persist();
      return result;
    },
    commit(events) {
      repository.replaceAll(mergeFromDisk([...repository.list(), ...events]));
      persist();
    },
    list() {
      return repository.list();
    },
    getById(id) {
      return repository.getById(id);
    },
    replaceAll(events) {
      repository.replaceAll(mergeFromDisk(events));
      persist();
    },
    clear() {
      repository.clear();
      persist();
    },
    ledgerFingerprint() {
      return ledgerFingerprint;
    }
  };
}
function createLedgerAggregator() {
  return {
    aggregate(events) {
      const global = createEmptySummary();
      const sessions = /* @__PURE__ */ new Map();
      const days = /* @__PURE__ */ new Map();
      for (const eventInput of dedupeHostCostEvents(events)) {
        const event = normalizeCostEvent(eventInput);
        updateSummary(global, event);
        const sessionSummary = sessions.get(event.sessionId) ?? createEmptySummary();
        updateSummary(sessionSummary, event);
        sessions.set(event.sessionId, sessionSummary);
        const dayKey = dayKeyFromTimestamp(event.requestStartedAt);
        const daySummary = days.get(dayKey) ?? createEmptySummary();
        updateSummary(daySummary, event);
        days.set(dayKey, daySummary);
      }
      finalizeSummary(global);
      for (const summary of sessions.values()) {
        finalizeSummary(summary);
      }
      for (const summary of days.values()) {
        finalizeSummary(summary);
      }
      return { global, sessions, days };
    }
  };
}
function readLedgerFile(filePath, onRecovery) {
  if (!existsSync2(filePath)) {
    return { events: [], fingerprint: createLedgerFingerprintFromContents(filePath, null) };
  }
  let raw;
  let contents;
  try {
    contents = readFileSync2(filePath, "utf8");
    raw = JSON.parse(contents);
  } catch {
    const quarantinePath = quarantineLedgerFile(filePath, "corrupt");
    onRecovery?.({ filePath, quarantinePath, reason: "corrupt", recoveredEventCount: 0, rejectedEventCount: 0 });
    return { events: [], fingerprint: createLedgerFingerprintFromContents(filePath, null) };
  }
  const data = asRecord(raw);
  const schemaVersion = data.schemaVersion;
  if (typeof schemaVersion === "number" && schemaVersion !== LEDGER_SCHEMA_VERSION) {
    const reason = `schema-${schemaVersion}`;
    const quarantinePath = quarantineLedgerFile(filePath, reason);
    onRecovery?.({ filePath, quarantinePath, reason, recoveredEventCount: 0, rejectedEventCount: 0 });
    return { events: [], fingerprint: createLedgerFingerprintFromContents(filePath, null) };
  }
  if (schemaVersion === LEDGER_SCHEMA_VERSION && !Array.isArray(data.events)) {
    throw new Error("Ledger schema v1 file must contain an events array");
  }
  const events = Array.isArray(data.events) ? data.events : Array.isArray(raw) ? raw : [];
  let rejectedEventCount = 0;
  const restored = events.flatMap((event) => {
    try {
      return [restoreLedgerEvent(event)];
    } catch {
      rejectedEventCount += 1;
      return [];
    }
  });
  if (rejectedEventCount > 0) {
    const quarantinePath = quarantineLedgerFile(filePath, "invalid-events");
    contents = JSON.stringify({ schemaVersion: LEDGER_SCHEMA_VERSION, events: restored }, null, 2);
    writeLedgerFileAtomically(filePath, contents);
    onRecovery?.({
      filePath,
      quarantinePath,
      reason: "invalid-events",
      recoveredEventCount: restored.length,
      rejectedEventCount
    });
  }
  return { events: restored, fingerprint: createLedgerFingerprintFromContents(filePath, contents) };
}
function restoreLedgerEvent(event) {
  const record = asRecord(event);
  const id = restoreRequiredText(record.id, "id");
  const sessionId = restoreRequiredText(record.sessionId, "sessionId");
  const requestStartedAt = restoreRequiredTimestamp(record.requestStartedAt, "requestStartedAt");
  const completedAt = restoreOptionalTimestamp(record.completedAt, "completedAt");
  const currency = typeof record.currency === "string" ? record.currency : void 0;
  const legacyUsdCnyRate = currency === "USD" ? readLegacyUsdCnyRate(record.priceVersion) : null;
  const restoreNativeMinor = (nativeValue, compatibilityValue) => {
    if (nativeValue !== void 0) return validateOptionalNonNegativeInteger(nativeValue, "native currency amount");
    return legacyUsdCnyRate !== null && typeof compatibilityValue === "number" ? Math.round(compatibilityValue / legacyUsdCnyRate) : void 0;
  };
  const cacheHitMinor = restoreNativeMinor(record.cacheHitMinor, record.hitRateMicroCny);
  const cacheMissMinor = restoreNativeMinor(record.cacheMissMinor, record.missRateMicroCny);
  const outputMinor = restoreNativeMinor(record.outputMinor, record.outputRateMicroCny);
  const compatibilityBuckets = [record.hitRateMicroCny, record.missRateMicroCny, record.outputRateMicroCny];
  const amountMinor = record.amountMinor !== void 0 ? validateOptionalNonNegativeInteger(record.amountMinor, "amountMinor") : legacyUsdCnyRate !== null && compatibilityBuckets.every((value) => typeof value === "number") && compatibilityBuckets.reduce((sum, value) => sum + Number(value), 0) === record.amountMicroCny ? (cacheHitMinor ?? 0) + (cacheMissMinor ?? 0) + (outputMinor ?? 0) : restoreNativeMinor(record.amountMinor, record.amountMicroCny);
  return normalizeCostEvent({
    id,
    sessionId,
    requestStartedAt,
    status: restoreEnum(record.status, COST_EVENT_STATUSES, "unknown", "status"),
    amountMicroCny: restoreNonNegativeInteger(record.amountMicroCny, 0, "amountMicroCny"),
    currency,
    amountMinor,
    cacheHitMinor,
    cacheMissMinor,
    outputMinor,
    cacheHitRateMinorPerMillionTokens: restoreNativeMinor(
      record.cacheHitRateMinorPerMillionTokens,
      record.cacheHitRateMicroCnyPerMillionTokens
    ),
    cacheMissRateMinorPerMillionTokens: restoreNativeMinor(
      record.cacheMissRateMinorPerMillionTokens,
      record.cacheMissRateMicroCnyPerMillionTokens
    ),
    outputRateMinorPerMillionTokens: restoreNativeMinor(
      record.outputRateMinorPerMillionTokens,
      record.outputRateMicroCnyPerMillionTokens
    ),
    source: restoreEnum(record.source, COST_EVENT_SOURCES, "restored", "source"),
    turnId: typeof record.turnId === "string" ? record.turnId : void 0,
    stepId: typeof record.stepId === "string" ? record.stepId : void 0,
    attemptId: typeof record.attemptId === "string" ? record.attemptId : void 0,
    parentSessionId: typeof record.parentSessionId === "string" ? record.parentSessionId : void 0,
    provider: typeof record.provider === "string" ? record.provider : void 0,
    model: typeof record.model === "string" ? record.model : void 0,
    reasoningEffort: typeof record.reasoningEffort === "string" ? record.reasoningEffort : void 0,
    agentPreset: typeof record.agentPreset === "string" ? record.agentPreset : void 0,
    completedAt,
    requestOutcome: restoreOptionalEnum(record.requestOutcome, COST_REQUEST_OUTCOMES, "requestOutcome"),
    pricingZone: restoreEnum(record.pricingZone, PRICING_ZONES, "unknown", "pricingZone"),
    cacheHitTokens: restoreNonNegativeInteger(record.cacheHitTokens, 0, "cacheHitTokens"),
    cacheMissTokens: restoreNonNegativeInteger(record.cacheMissTokens, 0, "cacheMissTokens"),
    cacheWriteTokens: restoreOptionalNonNegativeInteger(record.cacheWriteTokens, "cacheWriteTokens"),
    outputTokens: restoreNonNegativeInteger(record.outputTokens, 0, "outputTokens"),
    reasoningTokens: restoreNonNegativeInteger(record.reasoningTokens, 0, "reasoningTokens"),
    hitRateMicroCny: restoreNonNegativeInteger(record.hitRateMicroCny, 0, "hitRateMicroCny"),
    missRateMicroCny: restoreNonNegativeInteger(record.missRateMicroCny, 0, "missRateMicroCny"),
    outputRateMicroCny: restoreNonNegativeInteger(record.outputRateMicroCny, 0, "outputRateMicroCny"),
    cacheHitRateMicroCnyPerMillionTokens: restoreNonNegativeInteger(
      record.cacheHitRateMicroCnyPerMillionTokens,
      0,
      "cacheHitRateMicroCnyPerMillionTokens"
    ),
    cacheMissRateMicroCnyPerMillionTokens: restoreNonNegativeInteger(
      record.cacheMissRateMicroCnyPerMillionTokens,
      0,
      "cacheMissRateMicroCnyPerMillionTokens"
    ),
    outputRateMicroCnyPerMillionTokens: restoreNonNegativeInteger(
      record.outputRateMicroCnyPerMillionTokens,
      0,
      "outputRateMicroCnyPerMillionTokens"
    ),
    priceVersion: typeof record.priceVersion === "string" ? record.priceVersion : void 0
  });
}
function restoreRequiredText(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}
function restoreRequiredTimestamp(value, fieldName) {
  const text3 = restoreRequiredText(value, fieldName);
  if (!Number.isFinite(Date.parse(text3))) {
    throw new Error(`${fieldName} must be a valid timestamp`);
  }
  return text3;
}
function restoreOptionalTimestamp(value, fieldName) {
  if (value === void 0) return void 0;
  const text3 = restoreRequiredText(value, fieldName);
  if (text3 === "unknown") return text3;
  if (!Number.isFinite(Date.parse(text3))) {
    throw new Error(`${fieldName} must be a valid timestamp`);
  }
  return text3;
}
function restoreEnum(value, allowed, fallback, fieldName) {
  if (value === void 0) return fallback;
  if (typeof value === "string" && allowed.has(value)) return value;
  throw new Error(`${fieldName} must be a supported value`);
}
function restoreOptionalEnum(value, allowed, fieldName) {
  if (value === void 0) return void 0;
  if (typeof value === "string" && allowed.has(value)) return value;
  throw new Error(`${fieldName} must be a supported value`);
}
function restoreNonNegativeInteger(value, fallback, fieldName) {
  if (value === void 0) return fallback;
  return validateOptionalNonNegativeInteger(value, fieldName);
}
function restoreOptionalNonNegativeInteger(value, fieldName) {
  if (value === void 0) return void 0;
  return validateOptionalNonNegativeInteger(value, fieldName);
}
function validateOptionalNonNegativeInteger(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a finite non-negative integer`);
  }
  return value;
}
function readLegacyUsdCnyRate(priceVersion) {
  if (typeof priceVersion !== "string") return null;
  const fixedRate = /-usd-cny-(\d+(?:\.\d+)?)$/.exec(priceVersion);
  if (fixedRate) {
    const rate = Number(fixedRate[1]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }
  return priceVersion.endsWith("-usd") ? 7.2 : null;
}
function quarantineLedgerFile(filePath, reason) {
  if (!existsSync2(filePath)) {
    return null;
  }
  const quarantinePath = `${filePath}.${reason}-${Date.now()}-${process.pid}`;
  try {
    renameSync2(filePath, quarantinePath);
    return quarantinePath;
  } catch {
    return null;
  }
}
function writeLedgerFileAtomically(filePath, contents) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  let descriptor2 = null;
  try {
    descriptor2 = openSync2(tmpPath, "w");
    writeFileSync2(descriptor2, contents);
    fsyncSync2(descriptor2);
    closeSync2(descriptor2);
    descriptor2 = null;
    renameSync2(tmpPath, filePath);
    fsyncDirectory2(dirname2(filePath));
  } catch (error) {
    if (descriptor2 !== null) closeSync2(descriptor2);
    if (existsSync2(tmpPath)) {
      rmSync2(tmpPath, { force: true });
    }
    throw error;
  }
}
function fsyncDirectory2(directoryPath) {
  let descriptor2 = null;
  try {
    descriptor2 = openSync2(directoryPath, "r");
    fsyncSync2(descriptor2);
  } catch {
  } finally {
    if (descriptor2 !== null) closeSync2(descriptor2);
  }
}
function completeHostCostEventKey(event) {
  if (event.sessionId === "unknown" || event.turnId === "unknown" || event.stepId === "unknown" || event.attemptId === "unknown") {
    return null;
  }
  return event.eventKey;
}
function shouldReplaceHostCostEvent(existing, next) {
  const statusDelta = statusPriority2(next.status) - statusPriority2(existing.status);
  if (statusDelta !== 0) {
    return statusDelta > 0;
  }
  const sourceDelta = sourcePriority2(next.source) - sourcePriority2(existing.source);
  if (sourceDelta !== 0) {
    return sourceDelta > 0;
  }
  if (next.status === "estimated" && next.amountMicroCny !== existing.amountMicroCny) {
    return next.amountMicroCny > existing.amountMicroCny;
  }
  const existingTime = Date.parse(existing.completedAt !== "unknown" ? existing.completedAt : existing.requestStartedAt);
  const nextTime = Date.parse(next.completedAt !== "unknown" ? next.completedAt : next.requestStartedAt);
  if (Number.isFinite(existingTime) && Number.isFinite(nextTime) && existingTime !== nextTime) {
    return nextTime > existingTime;
  }
  return true;
}
function statusPriority2(status) {
  switch (status) {
    case "settled":
      return 4;
    case "failed":
      return 3;
    case "estimated":
      return 2;
    case "unknown":
      return 1;
  }
}
function sourcePriority2(source) {
  switch (source) {
    case "final_usage":
      return 4;
    case "restored":
      return 3;
    case "projection":
      return 2;
    case "stream":
      return 1;
  }
}

// packages/host/src/analytics.ts
function createHostCostAnalyticsReport(source, options = {}) {
  if (isCostEventInputArray(source)) {
    return createCostAnalyticsReport(
      createInMemoryCostEventRepository(source).list().map(toAnalyticsEvent),
      options
    );
  }
  return createCostAnalyticsReport(source.list().map(toAnalyticsEvent), options);
}
function isCostEventInputArray(source) {
  return Array.isArray(source);
}
function toAnalyticsEvent(event) {
  return {
    id: event.id,
    sessionId: event.sessionId,
    requestStartedAt: event.requestStartedAt,
    amountMicroCny: event.amountMicroCny,
    status: event.status,
    pricingZone: event.pricingZone
  };
}

// packages/host/src/append-ledger.ts
import { createHash as createHash2 } from "node:crypto";
import {
  closeSync as closeSync3,
  existsSync as existsSync3,
  fsyncSync as fsyncSync3,
  linkSync,
  lstatSync,
  mkdirSync as mkdirSync3,
  openSync as openSync3,
  readFileSync as readFileSync3,
  readlinkSync,
  readdirSync,
  realpathSync,
  renameSync as renameSync3,
  rmSync as rmSync3,
  statSync,
  truncateSync,
  writeFileSync as writeFileSync3
} from "node:fs";
import { basename, dirname as dirname3, isAbsolute, join, relative, resolve as resolve2 } from "node:path";
var APPEND_SCHEMA_VERSION = 1;
var FRAME_SCHEMA_VERSION = 1;
var EMPTY_DIGEST = "sha256:0";
function createAppendOnlyCostEventRepository({
  filePath,
  legacyFilePath,
  compactionHooks,
  onRecovery
}) {
  if (filePath.trim().length === 0) throw new Error("append ledger: filePath is required");
  assertLedgerPathIsNotFinalSymlink(filePath);
  mkdirSync3(dirname3(filePath), { recursive: true });
  filePath = resolveActiveLedgerPath(filePath);
  let manifest = loadOrCreateManifest(filePath, legacyFilePath, onRecovery);
  let loadedGeneration = loadGeneration(manifest, filePath, onRecovery);
  let repository = loadedGeneration.repository;
  let snapshotDigest = loadedGeneration.snapshotDigest;
  let sequence = 0;
  let digest = EMPTY_DIGEST;
  let exportedJsonFingerprint = null;
  const loadedLog = readLog(manifest, filePath, onRecovery);
  try {
    for (const event of loadedLog.events) repository.commit?.([event]);
  } catch (error) {
    quarantineFile(manifest.logFile, "corrupt-log");
    onRecovery?.({ filePath, reason: "corrupt-log" });
    throw error;
  }
  sequence = loadedLog.sequence;
  digest = loadedLog.digest;
  let logState = readLogState(manifest.logFile);
  let manifestState = readManifestState(filePath);
  const fingerprint = () => exportedJsonFingerprint ?? createLedgerFingerprintFromContents(
    filePath,
    JSON.stringify({ format: "append-v1", generation: manifest.generation, snapshotDigest, sequence, digest })
  );
  const assertWritable = () => {
    if (exportedJsonFingerprint !== null) {
      throw new Error("append ledger: repository has been exported to JSON and is now read-only");
    }
  };
  const compactTo = (events) => {
    assertWritable();
    const validatedEvents = restoreLedgerEvents(events);
    assertManifestStateUnchanged(filePath, manifest, manifestState);
    assertLogStateUnchanged(manifest.logFile, logState);
    const previous = manifest;
    const nextGeneration = previous.generation + 1;
    const nextManifest = {
      schemaVersion: APPEND_SCHEMA_VERSION,
      generation: nextGeneration,
      snapshotFile: generationSnapshotFile(filePath, nextGeneration),
      logFile: generationLogFile(filePath, nextGeneration)
    };
    const compactionContext = { filePath, currentManifest: previous, nextManifest };
    const createdSidecars = [];
    let candidate;
    assertGenerationSidecarsAvailable(nextManifest);
    try {
      compactionHooks?.failAt?.("snapshot-write", compactionContext);
      writeSnapshot(nextManifest, validatedEvents, filePath);
      createdSidecars.push(nextManifest.snapshotFile);
      compactionHooks?.failAt?.("log-write", compactionContext);
      writeFileDurably(nextManifest.logFile, "", { overwrite: false });
      createdSidecars.push(nextManifest.logFile);
      compactionHooks?.failAt?.("candidate-validation", compactionContext);
      candidate = loadGeneration(nextManifest, filePath, void 0, { quarantineOnError: false });
      readLog(nextManifest, filePath, void 0, { quarantineOnError: false });
      compactionHooks?.failAt?.("manifest-switch", compactionContext);
      assertManifestStateUnchanged(filePath, manifest, manifestState);
      assertLogStateUnchanged(manifest.logFile, logState);
      writeManifest(filePath, nextManifest);
    } catch (error) {
      cleanupCreatedSidecars(createdSidecars);
      throw error;
    }
    manifest = nextManifest;
    loadedGeneration = candidate;
    repository = loadedGeneration.repository;
    snapshotDigest = loadedGeneration.snapshotDigest;
    sequence = 0;
    digest = EMPTY_DIGEST;
    logState = readLogState(manifest.logFile);
    manifestState = readManifestState(filePath);
    if (previous.generation !== nextGeneration) {
      try {
        compactionHooks?.failAt?.("old-generation-cleanup", compactionContext);
        safeRemove(previous.snapshotFile);
        safeRemove(previous.logFile);
      } catch {
      }
    }
  };
  const commit = (events) => {
    assertWritable();
    if (events.length === 0) return;
    const validatedEvents = restoreLedgerEvents(events);
    assertManifestStateUnchanged(filePath, manifest, manifestState);
    assertLogStateUnchanged(manifest.logFile, logState);
    const nextRepository = createInMemoryCostEventRepository(repository.list());
    nextRepository.commit?.(validatedEvents);
    const frame = createFrame(validatedEvents, sequence + 1, digest);
    appendFrame(manifest.logFile, frame.serialized);
    repository = nextRepository;
    sequence = frame.sequence;
    digest = frame.digest;
    logState = readLogState(manifest.logFile);
  };
  const exportToJson = (options = {}) => {
    const targetFilePath = options.filePath ?? filePath;
    if (targetFilePath.trim().length === 0) {
      throw new Error("append ledger: JSON export filePath is required");
    }
    assertWritable();
    assertJsonExportTargetAllowed(filePath, manifest, targetFilePath);
    assertManifestStateUnchanged(filePath, manifest, manifestState);
    assertLogStateUnchanged(manifest.logFile, logState);
    const contents = createLegacyJsonContents(repository.list());
    writeLegacyJsonAtomically(targetFilePath, contents, options.verifyCandidate, () => {
      assertManifestStateUnchanged(filePath, manifest, manifestState);
      assertLogStateUnchanged(manifest.logFile, logState);
    });
    const jsonFingerprint = createLedgerFingerprintFromContents(targetFilePath, contents);
    if (isSamePath(targetFilePath, filePath)) {
      exportedJsonFingerprint = jsonFingerprint;
    }
    return jsonFingerprint;
  };
  return {
    upsert(event) {
      commit([event]);
      const events = repository.list();
      const eventKey = createHostCostEventKey(event);
      return repository.getById(event.id) ?? events.find((record) => record.eventKey === eventKey) ?? events.at(-1);
    },
    commit,
    list() {
      return repository.list();
    },
    getById(id) {
      return repository.getById(id);
    },
    replaceAll(events) {
      compactTo(events);
    },
    clear() {
      compactTo([]);
    },
    compact() {
      compactTo(repository.list());
    },
    exportToJson,
    compactToJson: exportToJson,
    ledgerFingerprint: fingerprint
  };
}
function loadOrCreateManifest(filePath, legacyFilePath, onRecovery) {
  if (existsSync3(filePath)) {
    let raw;
    try {
      raw = JSON.parse(readFileSync3(filePath, "utf8"));
    } catch {
      quarantineFile(filePath, "corrupt-manifest");
      onRecovery?.({ filePath, reason: "corrupt-manifest" });
      throw new Error("append ledger: active manifest is corrupt");
    }
    const manifest2 = parseManifest(raw, filePath);
    if (manifest2) return manifest2;
    if (hasAppendManifestFields(raw) || !isLegacyLedgerPayload(raw)) {
      quarantineFile(filePath, "corrupt-manifest");
      onRecovery?.({ filePath, reason: "corrupt-manifest" });
      throw new Error("append ledger: active manifest is invalid");
    }
    const legacy2 = readLegacyEvents(legacyFilePath ?? filePath, onRecovery);
    const nextManifest = createManifest(filePath, 1);
    assertGenerationSidecarsAvailable(nextManifest);
    preserveLegacyFile(filePath, legacyFilePath, legacy2);
    const createdSidecars2 = writeNewGenerationSidecars(nextManifest, legacy2, filePath);
    try {
      writeManifest(filePath, nextManifest);
    } catch (error) {
      cleanupCreatedSidecars(createdSidecars2);
      throw error;
    }
    return nextManifest;
  }
  if (hasGenerationFiles(filePath)) {
    onRecovery?.({ filePath, reason: "corrupt-manifest" });
    throw new Error("append ledger: active manifest is missing while generation files remain");
  }
  const legacy = legacyFilePath && existsSync3(legacyFilePath) ? readLegacyEvents(legacyFilePath, onRecovery) : [];
  const manifest = createManifest(filePath, 1);
  const createdSidecars = writeNewGenerationSidecars(manifest, legacy, filePath);
  try {
    writeManifest(filePath, manifest);
  } catch (error) {
    cleanupCreatedSidecars(createdSidecars);
    throw error;
  }
  return manifest;
}
function createManifest(filePath, generation) {
  return {
    schemaVersion: APPEND_SCHEMA_VERSION,
    generation,
    snapshotFile: generationSnapshotFile(filePath, generation),
    logFile: generationLogFile(filePath, generation)
  };
}
function preserveLegacyFile(filePath, legacyFilePath, events) {
  if (legacyFilePath !== void 0 || !existsSync3(filePath)) return;
  const backupPath = `${filePath}.legacy.json`;
  try {
    if (existsSync3(backupPath)) {
      validateLegacyJsonFile(backupPath);
      return;
    }
    writeLegacyJsonAtomically(backupPath, createLegacyJsonContents(events), void 0, void 0, {
      overwrite: false
    });
  } catch (error) {
    throw new Error(`append ledger: failed to preserve legacy JSON backup ${backupPath}`, { cause: error });
  }
}
function generationSnapshotFile(filePath, generation) {
  return join(dirname3(filePath), `${basename(filePath)}.g${generation}.snapshot.json`);
}
function generationLogFile(filePath, generation) {
  return join(dirname3(filePath), `${basename(filePath)}.g${generation}.log`);
}
function resolveAdjacent(filePath, value) {
  if (value.trim().length === 0) throw new Error("append ledger: manifest path is required");
  return isAbsolute(value) ? value : join(dirname3(filePath), value);
}
function assertJsonExportTargetAllowed(filePath, manifest, targetFilePath) {
  if (isFinalSymlinkToExistingFile(targetFilePath, filePath)) {
    throw new Error("append ledger: JSON export target cannot be a final symlink to the active manifest");
  }
  if (isSamePath(targetFilePath, filePath)) return;
  const targetDirectory = resolveRealDirectory(dirname3(targetFilePath));
  const manifestDirectory = resolveRealDirectory(dirname3(filePath));
  const activeGenerationPrefix = `${basename(filePath)}.g${manifest.generation}.`;
  if (targetDirectory === manifestDirectory && basename(targetFilePath).startsWith(activeGenerationPrefix)) {
    throw new Error("append ledger: JSON export target cannot be inside the active generation sidecar");
  }
  if (isSameExistingFile(targetFilePath, manifest.snapshotFile) || isSameExistingFile(targetFilePath, manifest.logFile)) {
    throw new Error("append ledger: JSON export target cannot be inside the active generation sidecar");
  }
}
function isSamePath(left, right) {
  return resolveRenameTargetPath(left) === resolveRenameTargetPath(right);
}
function isFinalSymlinkToExistingFile(left, right) {
  try {
    return lstatSync(left).isSymbolicLink() && isSameExistingFile(left, right);
  } catch {
    return false;
  }
}
function assertLedgerPathIsNotFinalSymlink(filePath) {
  try {
    if (lstatSync(filePath).isSymbolicLink()) {
      throw new Error("append ledger: ledgerPath cannot be a symbolic link");
    }
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : void 0;
    if (code === "ENOENT") return;
    throw error;
  }
}
function resolveActiveLedgerPath(filePath) {
  try {
    const stats = lstatSync(filePath, { bigint: true });
    if (stats.isSymbolicLink()) {
      const linkTarget = readlinkSync(filePath);
      const targetFilePath = isAbsolute(linkTarget) ? linkTarget : join(dirname3(filePath), linkTarget);
      return resolveActiveLedgerPath(targetFilePath);
    }
    const directoryPath = resolve2(dirname3(filePath));
    return join(directoryPath, canonicalDirectoryEntry(directoryPath, basename(filePath), stats));
  } catch {
    return filePath;
  }
}
function resolveRenameTargetPath(filePath) {
  const directoryPath = resolveRealDirectory(dirname3(filePath));
  const name2 = basename(filePath);
  try {
    const stats = lstatSync(filePath, { bigint: true });
    if (!stats.isSymbolicLink()) return join(directoryPath, canonicalDirectoryEntry(directoryPath, name2, stats));
  } catch {
  }
  return join(directoryPath, name2);
}
function resolveRealDirectory(directoryPath) {
  try {
    return realpathSync(directoryPath);
  } catch {
    return resolve2(directoryPath);
  }
}
function canonicalDirectoryEntry(directoryPath, name2, stats) {
  for (const entry of readdirSync(directoryPath)) {
    if (entry === name2) return entry;
    if (entry.toLowerCase() !== name2.toLowerCase()) continue;
    try {
      const entryStats = lstatSync(join(directoryPath, entry), { bigint: true });
      if (entryStats.dev === stats.dev && entryStats.ino === stats.ino) return entry;
    } catch {
    }
  }
  return name2;
}
function isSameExistingFile(left, right) {
  try {
    const leftStats = statSync(left, { bigint: true });
    const rightStats = statSync(right, { bigint: true });
    return leftStats.dev === rightStats.dev && leftStats.ino === rightStats.ino;
  } catch {
    return false;
  }
}
function assertGenerationSidecarsAvailable(manifest) {
  assertNewGenerationSidecarPathAvailable(manifest.snapshotFile);
  assertNewGenerationSidecarPathAvailable(manifest.logFile);
}
function assertNewGenerationSidecarPathAvailable(filePath) {
  try {
    lstatSync(filePath);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : void 0;
    if (code === "ENOENT") return;
    throw error;
  }
  throw new Error(`append ledger: generation sidecar already exists ${filePath}`);
}
function writeNewGenerationSidecars(manifest, events, filePath) {
  const createdSidecars = [];
  assertGenerationSidecarsAvailable(manifest);
  try {
    writeSnapshot(manifest, events, filePath);
    createdSidecars.push(manifest.snapshotFile);
    writeFileDurably(manifest.logFile, "", { overwrite: false });
    createdSidecars.push(manifest.logFile);
    return createdSidecars;
  } catch (error) {
    cleanupCreatedSidecars(createdSidecars);
    throw error;
  }
}
function cleanupCreatedSidecars(filePaths) {
  const changedDirectories = /* @__PURE__ */ new Set();
  for (const filePath of filePaths) {
    try {
      const stats = lstatSync(filePath);
      if (stats.isFile() || stats.isSymbolicLink()) {
        rmSync3(filePath, { force: true });
        changedDirectories.add(dirname3(filePath));
      }
    } catch {
    }
  }
  for (const directoryPath of changedDirectories) fsyncDirectory3(directoryPath);
}
function loadGeneration(manifest, filePath, onRecovery, options = {}) {
  if (!existsSync3(manifest.snapshotFile)) {
    onRecovery?.({ filePath, reason: "corrupt-snapshot" });
    throw new Error("append ledger: generation snapshot is missing");
  }
  try {
    const snapshot = JSON.parse(readFileSync3(manifest.snapshotFile, "utf8"));
    if (snapshot.schemaVersion !== APPEND_SCHEMA_VERSION || !Array.isArray(snapshot.events)) {
      throw new Error("invalid snapshot");
    }
    const events = restoreLedgerEvents(snapshot.events);
    return {
      repository: createInMemoryCostEventRepository(events),
      snapshotDigest: createSnapshotDigest(events)
    };
  } catch (error) {
    if (options.quarantineOnError !== false) {
      quarantineFile(manifest.snapshotFile, "corrupt-snapshot");
      onRecovery?.({ filePath, reason: "corrupt-snapshot" });
    }
    throw error;
  }
}
function readLegacyEvents(filePath, onRecovery) {
  try {
    const raw = JSON.parse(readFileSync3(filePath, "utf8"));
    const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
    if (record && typeof record.schemaVersion === "number" && record.schemaVersion !== 1) {
      throw new Error(`unsupported legacy ledger schema ${record.schemaVersion}`);
    }
    const events = Array.isArray(raw) ? raw : record && Array.isArray(record.events) ? record.events : null;
    if (events === null) throw new Error("legacy ledger events are missing");
    return events.map((event) => restoreLedgerEvent(event));
  } catch (error) {
    onRecovery?.({ filePath, reason: "corrupt-snapshot" });
    throw error;
  }
}
function readLogState(filePath) {
  const stats = statSync(filePath, { bigint: true });
  return { bytes: Number(stats.size), mtimeNs: stats.mtimeNs };
}
function assertLogStateUnchanged(filePath, expected) {
  let current;
  try {
    current = readLogState(filePath);
  } catch {
    throw new Error("append ledger: active generation changed; reopen before committing");
  }
  if (current.bytes !== expected.bytes || current.mtimeNs !== expected.mtimeNs) {
    throw new Error("append ledger: active generation changed; reopen before committing");
  }
}
function readManifestState(filePath) {
  return { mtimeNs: statSync(filePath, { bigint: true }).mtimeNs };
}
function assertManifestStateUnchanged(filePath, expected, state) {
  let currentState;
  try {
    currentState = readManifestState(filePath);
  } catch {
    throw new Error("append ledger: active manifest changed; reopen before committing");
  }
  if (currentState.mtimeNs !== state.mtimeNs) {
    throw new Error("append ledger: active manifest changed; reopen before committing");
  }
  let current;
  try {
    current = parseManifest(JSON.parse(readFileSync3(filePath, "utf8")), filePath);
  } catch {
    current = null;
  }
  if (current === null || current.generation !== expected.generation || current.snapshotFile !== expected.snapshotFile || current.logFile !== expected.logFile) {
    throw new Error("append ledger: active manifest changed; reopen before committing");
  }
}
function readLog(manifest, filePath, onRecovery, options = {}) {
  if (!existsSync3(manifest.logFile)) {
    onRecovery?.({ filePath, reason: "corrupt-log" });
    throw new Error("append ledger: active generation log is missing");
  }
  const bytes = readFileSync3(manifest.logFile);
  const fail = (message) => {
    if (options.quarantineOnError !== false) {
      quarantineFile(manifest.logFile, "corrupt-log");
      onRecovery?.({ filePath, reason: "corrupt-log" });
    }
    throw new Error(message);
  };
  let offset = 0;
  let sequence = 0;
  let digest = EMPTY_DIGEST;
  const events = [];
  while (offset < bytes.length) {
    const frameStart = offset;
    const lengthEnd = bytes.indexOf(10, offset);
    if (lengthEnd < 0) break;
    const bodyLength = Number(bytes.subarray(offset, lengthEnd).toString("ascii"));
    if (!Number.isInteger(bodyLength) || bodyLength < 0) {
      return fail("append ledger: invalid frame length");
    }
    const bodyStart = lengthEnd + 1;
    const bodyEnd = bodyStart + bodyLength;
    const digestStart = bodyEnd + 1;
    const digestEnd = bytes.indexOf(10, digestStart);
    if (bodyEnd >= bytes.length || bytes[bodyEnd] !== 10 || digestEnd < 0) break;
    if (digestEnd <= digestStart) {
      return fail("append ledger: invalid frame digest");
    }
    const body = bytes.subarray(bodyStart, bodyEnd).toString("utf8");
    const frameDigest = bytes.subarray(digestStart, digestEnd).toString("ascii");
    const expectedDigest = hashBody(body);
    if (frameDigest !== expectedDigest) {
      return fail("append ledger: hash chain mismatch");
    }
    let frame;
    try {
      frame = JSON.parse(body);
    } catch {
      return fail("append ledger: invalid frame JSON");
    }
    if (frame.schemaVersion !== FRAME_SCHEMA_VERSION || frame.sequence !== sequence + 1 || frame.previousDigest !== digest || !Array.isArray(frame.events)) {
      return fail("append ledger: invalid hash chain metadata");
    }
    try {
      events.push(...restoreLedgerEvents(frame.events));
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid event";
      return fail(`append ledger: invalid frame events: ${message}`);
    }
    sequence = frame.sequence;
    digest = frameDigest;
    offset = digestEnd + 1;
    if (offset <= frameStart) throw new Error("append ledger: parser did not advance");
  }
  if (offset < bytes.length) {
    truncateSync(manifest.logFile, offset);
    fsyncFile(manifest.logFile);
    onRecovery?.({ filePath, reason: "tail-truncated" });
  }
  return { events, sequence, digest };
}
function createFrame(events, sequence, previousDigest) {
  const body = JSON.stringify({
    schemaVersion: FRAME_SCHEMA_VERSION,
    sequence,
    previousDigest,
    events
  });
  const digest = hashBody(body);
  return {
    sequence,
    digest,
    serialized: `${Buffer.byteLength(body, "utf8")}
${body}
${digest}
`
  };
}
function hashBody(body) {
  return `sha256:${createHash2("sha256").update(body).digest("hex")}`;
}
function appendFrame(filePath, serialized) {
  const descriptor2 = openSync3(filePath, "a");
  try {
    writeFileSync3(descriptor2, serialized);
    fsyncSync3(descriptor2);
  } finally {
    closeSync3(descriptor2);
  }
}
function writeSnapshot(manifest, events, filePath) {
  try {
    writeJsonAtomically2(manifest.snapshotFile, createSnapshotContents(restoreLedgerEvents(events)), {
      overwrite: false
    });
  } catch (error) {
    throw new Error(`append ledger: failed to write snapshot ${filePath}`, { cause: error });
  }
}
function parseManifest(raw, filePath) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw;
  if (!hasAppendManifestFields(raw)) return null;
  const generation = typeof record.generation === "number" ? record.generation : null;
  if (record.schemaVersion !== APPEND_SCHEMA_VERSION || generation === null || !Number.isInteger(generation) || generation < 1 || typeof record.snapshotFile !== "string" || typeof record.logFile !== "string") {
    return null;
  }
  const expectedSnapshotFile = generationSnapshotFile(filePath, generation);
  const expectedLogFile = generationLogFile(filePath, generation);
  const snapshotFile = resolveGenerationPath(filePath, record.snapshotFile, expectedSnapshotFile);
  const logFile = resolveGenerationPath(filePath, record.logFile, expectedLogFile);
  if (snapshotFile === null || logFile === null) return null;
  return {
    schemaVersion: APPEND_SCHEMA_VERSION,
    generation,
    snapshotFile,
    logFile
  };
}
function hasAppendManifestFields(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return "generation" in raw || "snapshotFile" in raw || "logFile" in raw;
}
function resolveGenerationPath(filePath, value, expected) {
  if (value.trim().length === 0) return null;
  const expectedAbsolute = resolve2(expected);
  const candidates = isAbsolute(value) ? [value] : [resolveAdjacent(filePath, value), value];
  return candidates.some((candidate) => resolve2(candidate) === expectedAbsolute) ? expected : null;
}
function hasGenerationFiles(filePath) {
  const prefix = `${basename(filePath)}.g`;
  try {
    return readdirSync(dirname3(filePath)).some(
      (name2) => name2.startsWith(prefix) && (name2.endsWith(".snapshot.json") || name2.endsWith(".log"))
    );
  } catch {
    return false;
  }
}
function isLegacyLedgerPayload(raw) {
  if (Array.isArray(raw)) return true;
  if (!raw || typeof raw !== "object") return false;
  const record = raw;
  return record.schemaVersion === APPEND_SCHEMA_VERSION && Array.isArray(record.events);
}
function restoreLedgerEvents(events) {
  return events.map((event) => restoreLedgerEvent(event));
}
function createSnapshotDigest(events) {
  return hashBody(createSnapshotContents(events));
}
function createSnapshotContents(events) {
  return createLegacyJsonContents(events);
}
function createLegacyJsonContents(events) {
  return JSON.stringify({
    schemaVersion: APPEND_SCHEMA_VERSION,
    events
  }, null, 2);
}
function validateLegacyJsonFile(filePath) {
  const raw = JSON.parse(readFileSync3(filePath, "utf8"));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("append ledger: exported JSON must be an object");
  }
  const record = raw;
  if (record.schemaVersion !== APPEND_SCHEMA_VERSION || !Array.isArray(record.events)) {
    throw new Error("append ledger: exported JSON must be schema v1 with events");
  }
  restoreLedgerEvents(record.events);
}
function writeManifest(filePath, manifest) {
  writeJsonAtomically2(filePath, JSON.stringify(serializeManifest(filePath, manifest), null, 2));
}
function serializeManifest(filePath, manifest) {
  return {
    ...manifest,
    snapshotFile: serializeAdjacentPath(filePath, manifest.snapshotFile),
    logFile: serializeAdjacentPath(filePath, manifest.logFile)
  };
}
function serializeAdjacentPath(filePath, value) {
  const relativePath = relative(dirname3(filePath), value);
  return relativePath.length > 0 ? relativePath : value;
}
function writeFileDurably(filePath, contents, options = {}) {
  mkdirSync3(dirname3(filePath), { recursive: true });
  if (options.overwrite === false) assertNewGenerationSidecarPathAvailable(filePath);
  let descriptor2 = null;
  let createdByThisCall = false;
  try {
    descriptor2 = openSync3(filePath, options.overwrite === false ? "wx" : "w");
    createdByThisCall = options.overwrite === false;
    writeFileSync3(descriptor2, contents);
    fsyncSync3(descriptor2);
    closeSync3(descriptor2);
    descriptor2 = null;
  } catch (error) {
    if (descriptor2 !== null) {
      try {
        closeSync3(descriptor2);
      } catch {
      }
    }
    if (createdByThisCall) cleanupCreatedSidecars([filePath]);
    throw error;
  }
}
function writeJsonAtomically2(filePath, contents, options = {}) {
  mkdirSync3(dirname3(filePath), { recursive: true });
  if (options.overwrite === false) assertNewGenerationSidecarPathAvailable(filePath);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const descriptor2 = openSync3(tmpPath, "w");
  try {
    writeFileSync3(descriptor2, contents);
    fsyncSync3(descriptor2);
    closeSync3(descriptor2);
    if (options.overwrite === false) {
      linkSync(tmpPath, filePath);
      rmSync3(tmpPath, { force: true });
    } else {
      renameSync3(tmpPath, filePath);
    }
    fsyncDirectory3(dirname3(filePath));
  } catch (error) {
    try {
      closeSync3(descriptor2);
    } catch {
    }
    if (existsSync3(tmpPath)) rmSync3(tmpPath, { force: true });
    throw error;
  }
}
function writeLegacyJsonAtomically(filePath, contents, verifyCandidate, assertBeforeRename, options = {}) {
  mkdirSync3(dirname3(filePath), { recursive: true });
  if (options.overwrite === false && existsSync3(filePath)) {
    throw new Error(`append ledger: JSON file already exists ${filePath}`);
  }
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  let descriptor2 = null;
  try {
    descriptor2 = openSync3(tmpPath, "w");
    writeFileSync3(descriptor2, contents);
    fsyncSync3(descriptor2);
    closeSync3(descriptor2);
    descriptor2 = null;
    verifyCandidate?.(tmpPath);
    validateLegacyJsonFile(tmpPath);
    assertBeforeRename?.();
    if (options.overwrite === false) {
      linkSync(tmpPath, filePath);
      rmSync3(tmpPath, { force: true });
    } else {
      renameSync3(tmpPath, filePath);
    }
    fsyncDirectory3(dirname3(filePath));
  } catch (error) {
    if (descriptor2 !== null) closeSync3(descriptor2);
    if (existsSync3(tmpPath)) rmSync3(tmpPath, { force: true });
    throw error;
  }
}
function fsyncDirectory3(directoryPath) {
  let descriptor2 = null;
  try {
    descriptor2 = openSync3(directoryPath, "r");
    fsyncSync3(descriptor2);
  } catch {
  } finally {
    if (descriptor2 !== null) closeSync3(descriptor2);
  }
}
function fsyncFile(filePath) {
  const descriptor2 = openSync3(filePath, "r");
  try {
    fsyncSync3(descriptor2);
  } finally {
    closeSync3(descriptor2);
  }
}
function quarantineFile(filePath, reason) {
  if (!existsSync3(filePath)) return null;
  const quarantinePath = `${filePath}.${reason}-${Date.now()}-${process.pid}`;
  try {
    renameSync3(filePath, quarantinePath);
    return quarantinePath;
  } catch {
    return null;
  }
}
function safeRemove(filePath) {
  try {
    if (existsSync3(filePath) && statSync(filePath).isFile()) rmSync3(filePath, { force: true });
  } catch {
  }
}

// packages/host/src/ledger-format.ts
import { existsSync as existsSync4, lstatSync as lstatSync2, readFileSync as readFileSync4, readlinkSync as readlinkSync2, readdirSync as readdirSync2 } from "node:fs";
import { basename as basename2, dirname as dirname4, isAbsolute as isAbsolute2, join as join2, resolve as resolve3 } from "node:path";
function createCostEventRepositoryForFormat({
  ledgerPath,
  format = "json",
  onJsonRecovery,
  onAppendRecovery
}) {
  if (ledgerPath.trim().length === 0) {
    throw new Error("cost event ledger format: ledgerPath is required");
  }
  switch (format) {
    case "json":
      exportAppendManifestToJsonIfPresent(ledgerPath, onAppendRecovery);
      return createFileCostEventRepository({ filePath: ledgerPath, onRecovery: onJsonRecovery });
    case "append":
      assertLedgerPathIsNotFinalSymlink2(ledgerPath);
      return createAppendOnlyCostEventRepository({ filePath: ledgerPath, onRecovery: onAppendRecovery });
    default:
      throw new Error(`unknown cost event ledger format: ${String(format)}`);
  }
}
function assertLedgerPathIsNotFinalSymlink2(ledgerPath) {
  try {
    if (lstatSync2(ledgerPath).isSymbolicLink()) {
      throw new Error("cost event ledger format: ledgerPath cannot be a symbolic link");
    }
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : void 0;
    if (code === "ENOENT") return;
    throw error;
  }
}
function exportAppendManifestToJsonIfPresent(ledgerPath, onAppendRecovery) {
  const appendState = inspectAppendState(ledgerPath, onAppendRecovery);
  if (appendState === null) return;
  createAppendOnlyCostEventRepository({
    filePath: appendState.ledgerPath,
    onRecovery: onAppendRecovery
  }).exportToJson();
}
function inspectAppendState(ledgerPath, onAppendRecovery) {
  if (isFinalSymlink(ledgerPath)) {
    const targetPath = resolveSymlinkTargetPath(ledgerPath);
    if (isAppendStateTarget(targetPath)) {
      throw new Error("cost event ledger format: append ledgerPath cannot be a symbolic link");
    }
    return null;
  }
  if (!existsSync4(ledgerPath)) {
    if (hasAdjacentGenerationFiles(ledgerPath)) {
      notifyCorruptManifest(ledgerPath, onAppendRecovery);
      throw new Error("cost event ledger format: append manifest is missing while generation files remain");
    }
    return null;
  }
  const canonicalLedgerPath = resolveExistingLedgerPath(ledgerPath);
  let raw;
  try {
    raw = JSON.parse(readFileSync4(canonicalLedgerPath, "utf8"));
  } catch (error) {
    if (hasAdjacentGenerationFiles(canonicalLedgerPath)) {
      notifyCorruptManifest(ledgerPath, onAppendRecovery);
      throw new Error("cost event ledger format: append manifest is corrupt", { cause: error });
    }
    return null;
  }
  const manifest = parseAppendManifest(raw, canonicalLedgerPath);
  if (manifest) return { ledgerPath: canonicalLedgerPath, manifest };
  if (hasAppendManifestFields2(raw)) {
    notifyCorruptManifest(ledgerPath, onAppendRecovery);
    throw new Error("cost event ledger format: append manifest is invalid");
  }
  if (hasAdjacentGenerationFiles(canonicalLedgerPath) && isSchemaOneObjectWithoutEventsArray(raw)) {
    notifyCorruptManifest(ledgerPath, onAppendRecovery);
    throw new Error("cost event ledger format: append manifest is missing while generation files remain");
  }
  return null;
}
function isAppendStateTarget(ledgerPath) {
  const canonicalLedgerPath = resolveExistingLedgerPath(ledgerPath);
  if (!existsSync4(canonicalLedgerPath)) return hasAdjacentGenerationFiles(canonicalLedgerPath);
  let raw;
  try {
    raw = JSON.parse(readFileSync4(canonicalLedgerPath, "utf8"));
  } catch {
    return hasAdjacentGenerationFiles(canonicalLedgerPath);
  }
  if (parseAppendManifest(raw, canonicalLedgerPath)) return true;
  if (hasAppendManifestFields2(raw)) return true;
  return hasAdjacentGenerationFiles(canonicalLedgerPath) && isSchemaOneObjectWithoutEventsArray(raw);
}
function isFinalSymlink(ledgerPath) {
  try {
    return lstatSync2(ledgerPath).isSymbolicLink();
  } catch {
    return false;
  }
}
function resolveSymlinkTargetPath(ledgerPath) {
  const target = readlinkSync2(ledgerPath);
  return isAbsolute2(target) ? target : join2(dirname4(ledgerPath), target);
}
function parseAppendManifest(raw, ledgerPath) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!hasAppendManifestFields2(raw)) return null;
  const record = raw;
  const generation = typeof record.generation === "number" ? record.generation : null;
  if (record.schemaVersion !== 1 || generation === null || !Number.isInteger(generation) || generation < 1 || typeof record.snapshotFile !== "string" || typeof record.logFile !== "string") {
    return null;
  }
  const expectedSnapshotFile = generationSnapshotFile2(ledgerPath, generation);
  const expectedLogFile = generationLogFile2(ledgerPath, generation);
  const snapshotFile = resolveGenerationPath2(ledgerPath, record.snapshotFile, expectedSnapshotFile);
  const logFile = resolveGenerationPath2(ledgerPath, record.logFile, expectedLogFile);
  if (snapshotFile === null || logFile === null) return null;
  return {
    schemaVersion: 1,
    generation,
    snapshotFile,
    logFile
  };
}
function hasAppendManifestFields2(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return "generation" in raw || "snapshotFile" in raw || "logFile" in raw;
}
function resolveExistingLedgerPath(ledgerPath) {
  let names;
  try {
    names = readdirSync2(dirname4(ledgerPath));
  } catch {
    return ledgerPath;
  }
  const requestedName = basename2(ledgerPath);
  if (names.includes(requestedName)) return ledgerPath;
  const existingName = names.find((name2) => name2.toLocaleLowerCase() === requestedName.toLocaleLowerCase());
  return existingName ? join2(dirname4(ledgerPath), existingName) : ledgerPath;
}
function isSchemaOneObjectWithoutEventsArray(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const record = raw;
  return record.schemaVersion === 1 && !Array.isArray(record.events);
}
function hasAdjacentGenerationFiles(ledgerPath) {
  let names;
  try {
    names = readdirSync2(dirname4(ledgerPath));
  } catch {
    return false;
  }
  const sidecarPattern = new RegExp(`^${escapeRegExp(basename2(ledgerPath))}\\.g\\d+\\.(?:snapshot\\.json|log)$`);
  return names.some((name2) => sidecarPattern.test(name2));
}
function generationSnapshotFile2(ledgerPath, generation) {
  return join2(dirname4(ledgerPath), `${basename2(ledgerPath)}.g${generation}.snapshot.json`);
}
function generationLogFile2(ledgerPath, generation) {
  return join2(dirname4(ledgerPath), `${basename2(ledgerPath)}.g${generation}.log`);
}
function resolveGenerationPath2(ledgerPath, value, expected) {
  if (value.trim().length === 0) return null;
  const resolved = isAbsolute2(value) ? value : join2(dirname4(ledgerPath), value);
  return resolve3(resolved) === resolve3(expected) ? expected : null;
}
function notifyCorruptManifest(ledgerPath, onAppendRecovery) {
  onAppendRecovery?.({ filePath: ledgerPath, reason: "corrupt-manifest" });
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// packages/host/src/ledger-export.ts
var LEDGER_EXPORT_SCHEMA_VERSION = 1;
var EXPORT_FIELDS = [
  "id",
  "sessionId",
  "turnId",
  "stepId",
  "attemptId",
  "parentSessionId",
  "requestStartedAt",
  "completedAt",
  "requestOutcome",
  "status",
  "source",
  "provider",
  "model",
  "reasoningEffort",
  "agentPreset",
  "currency",
  "amountMicroCny",
  "amountMinor",
  "cacheHitMinor",
  "cacheMissMinor",
  "outputMinor",
  "cacheHitTokens",
  "cacheMissTokens",
  "cacheWriteTokens",
  "outputTokens",
  "reasoningTokens",
  "hitRateMicroCny",
  "missRateMicroCny",
  "outputRateMicroCny",
  "cacheHitRateMicroCnyPerMillionTokens",
  "cacheMissRateMicroCnyPerMillionTokens",
  "outputRateMicroCnyPerMillionTokens",
  "cacheHitRateMinorPerMillionTokens",
  "cacheMissRateMinorPerMillionTokens",
  "outputRateMinorPerMillionTokens",
  "pricingZone",
  "priceVersion"
];
function exportCostEventLedger({
  format,
  events
}) {
  const safeEvents = events.map((event) => toExportableCostEvent(restoreLedgerEvent(event)));
  switch (format) {
    case "json":
      return JSON.stringify({
        schemaVersion: LEDGER_EXPORT_SCHEMA_VERSION,
        events: safeEvents
      }, null, 2);
    case "csv":
      return serializeCsv(safeEvents);
    default:
      throw new Error(`unknown cost event ledger export format: ${String(format)}`);
  }
}
function toExportableCostEvent(event) {
  const exported = {};
  for (const field of EXPORT_FIELDS) {
    const value = event[field];
    if (value !== void 0) {
      exported[field] = value;
    }
  }
  return exported;
}
function serializeCsv(events) {
  const lines = [
    EXPORT_FIELDS.join(","),
    ...events.map((event) => EXPORT_FIELDS.map((field) => escapeCsvCell(event[field])).join(","))
  ];
  return `${lines.join("\n")}
`;
}
function escapeCsvCell(value) {
  if (value === void 0 || value === null) return "";
  const text3 = typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text3) ? `"${text3.replaceAll('"', '""')}"` : text3;
}

// packages/host/src/remote-pricing-update.ts
var DEFAULT_MAX_MANIFEST_BYTES = 256 * 1024;
var DEFAULT_MAX_CATALOG_BYTES = 1024 * 1024;

// packages/host/src/adapters.ts
function createHostMetadataAdapter() {
  return {
    fromRequest(input) {
      return {
        provider: asText(input.provider),
        model: asText(input.model),
        reasoningEffort: asText(input.reasoningEffort),
        agentPreset: asText(input.agentPreset)
      };
    }
  };
}
function createHostUsageAdapter() {
  return {
    fromAssistantUsage(input) {
      return normalizeTokenUsage2(input);
    }
  };
}
function createHostProjectionAdapter() {
  return {
    fromTokenMeter(input) {
      const usage = normalizeTokenUsage2(input);
      const hasAnyTokens = usage.cacheHitTokens !== 0 || usage.cacheMissTokens !== 0 || usage.outputTokens !== 0 || (usage.cacheWriteTokens ?? 0) !== 0 || usage.reasoningTokens !== 0 || usage.totalTokens !== 0;
      if (!hasAnyTokens) {
        return null;
      }
      return {
        ...usage,
        isReliable: isReliable(input.reliable ?? input.reliability)
      };
    }
  };
}
function isReliable(value) {
  return value !== false && asNumber(value, 1) > 0;
}

// packages/host/src/balance.ts
function createDeepSeekBalanceService({
  baseUrl,
  apiKey,
  resolveApiKey,
  fetchImpl = fetch,
  now = () => Date.now(),
  cacheTtlMs = 5 * 6e4
}) {
  let cache = null;
  async function requestBalance() {
    const currentApiKey = resolveApiKey ? await resolveApiKey() : apiKey;
    if (!currentApiKey?.trim()) {
      throw new Error("DeepSeek API credential is not configured");
    }
    const init = { headers: { Authorization: `Bearer ${currentApiKey}` } };
    const response = await fetchImpl(new URL("/user/balance", baseUrl), init);
    if (!response.ok) {
      const status = response.status ?? "unknown";
      throw new Error(`DeepSeek balance request failed (HTTP ${status})`);
    }
    const body = asRecord(await response.json());
    const balanceInfo = selectCurrencyBalance(body);
    const fetchedAt = now();
    const updatedAt = new Date(fetchedAt).toISOString();
    const snapshot = {
      status: body.is_available === false ? "unavailable" : "fresh",
      isAvailable: body.is_available !== false,
      unit: "microCny",
      totalMicroCny: asNullableMicroCny(balanceInfo.total ?? body.total),
      grantedMicroCny: asNullableMicroCny(balanceInfo.granted ?? body.granted),
      toppedUpMicroCny: asNullableMicroCny(balanceInfo.toppedUp ?? body.topped_up ?? body.toppedUp),
      total: asNullableNumber(balanceInfo.total ?? body.total),
      granted: asNullableNumber(balanceInfo.granted ?? body.granted),
      toppedUp: asNullableNumber(balanceInfo.toppedUp ?? body.topped_up ?? body.toppedUp),
      fetchedAt,
      updatedAt,
      expiresAt: fetchedAt + cacheTtlMs,
      isExpired: body.is_available === false
    };
    if (balanceInfo.currency) {
      snapshot.currency = balanceInfo.currency;
    }
    cache = snapshot;
    return snapshot;
  }
  return {
    async getSnapshot(options = {}) {
      const currentTime = now();
      if (cache && currentTime <= cache.expiresAt && !options.forceRefresh) {
        const { error: _error, ...freshCache } = cache;
        return {
          ...freshCache,
          status: cache.status,
          isExpired: cache.status === "unavailable"
        };
      }
      try {
        return await requestBalance();
      } catch (error) {
        if (cache) {
          return {
            ...cache,
            status: "stale",
            isExpired: currentTime > cache.expiresAt,
            error: error instanceof Error ? error.message : "balance request failed"
          };
        }
        return {
          status: "unavailable",
          isAvailable: false,
          unit: "microCny",
          totalMicroCny: null,
          grantedMicroCny: null,
          toppedUpMicroCny: null,
          total: null,
          granted: null,
          toppedUp: null,
          fetchedAt: currentTime,
          expiresAt: currentTime,
          isExpired: true,
          error: error instanceof Error ? error.message : "balance request failed"
        };
      }
    },
    clearCache() {
      cache = null;
    }
  };
}
function asNullableNumber(value) {
  const parsed = asNumber(value, Number.NaN);
  return Number.isNaN(parsed) ? null : parsed;
}
function asNullableMicroCny(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 1e6);
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const whole = BigInt(match[1] ?? "0") * 1000000n;
  const fraction = match[2] ?? "";
  const padded = `${fraction}0000000`;
  const microFraction = BigInt(padded.slice(0, 6));
  const rounded = padded[6] && Number(padded[6]) >= 5 ? 1n : 0n;
  const total = whole + microFraction + rounded;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  return Number(total);
}
function selectCurrencyBalance(body) {
  const infos = Array.isArray(body.balance_infos) ? body.balance_infos : [];
  const records = infos.filter((value) => {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  });
  const selected = records.find((record) => String(record.currency ?? "").toUpperCase() === "CNY") ?? records[0];
  if (!selected) {
    return {};
  }
  const result = {
    total: selected.total_balance ?? selected.total,
    granted: selected.granted_balance ?? selected.granted,
    toppedUp: selected.topped_up_balance ?? selected.toppedUp
  };
  if (typeof selected.currency === "string") {
    result.currency = selected.currency;
  }
  return result;
}

// packages/host/src/billing-read-model.ts
function defaultEquals(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const a = left;
  const b = right;
  const keys = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => Object.is(a[key], b[key]));
}
function createBillingReadModel(options = {}) {
  const byKey = /* @__PURE__ */ new Map();
  const bySession = /* @__PURE__ */ new Map();
  const generations = /* @__PURE__ */ new Map();
  const equals = options.equals ?? defaultEquals;
  const bump = (sessionId) => {
    generations.set(sessionId, (generations.get(sessionId) ?? 0) + 1);
  };
  const remove = (eventKey) => {
    const event = byKey.get(eventKey);
    if (!event) return false;
    byKey.delete(eventKey);
    const events = bySession.get(event.sessionId);
    events?.delete(eventKey);
    if (events && events.size === 0) bySession.delete(event.sessionId);
    bump(event.sessionId);
    return true;
  };
  return {
    upsert(event) {
      const previous = byKey.get(event.eventKey);
      if (previous && equals(previous, event)) return false;
      if (previous && previous.sessionId !== event.sessionId) {
        const oldEvents = bySession.get(previous.sessionId);
        oldEvents?.delete(event.eventKey);
        if (oldEvents && oldEvents.size === 0) bySession.delete(previous.sessionId);
        bump(previous.sessionId);
      }
      byKey.set(event.eventKey, event);
      const events = bySession.get(event.sessionId) ?? /* @__PURE__ */ new Map();
      events.set(event.eventKey, event);
      bySession.set(event.sessionId, events);
      bump(event.sessionId);
      return true;
    },
    remove,
    get: (eventKey) => byKey.get(eventKey),
    getSessionEvents: (sessionId) => [...bySession.get(sessionId)?.values() ?? []],
    listSessionIds: () => [...bySession.keys()],
    getGeneration: (sessionId) => generations.get(sessionId) ?? 0,
    rebuild(events) {
      byKey.clear();
      bySession.clear();
      generations.clear();
      for (const event of events) {
        const previous = byKey.get(event.eventKey);
        if (previous) {
          const oldEvents = bySession.get(previous.sessionId);
          oldEvents?.delete(event.eventKey);
        }
        byKey.set(event.eventKey, event);
        const sessionEvents = bySession.get(event.sessionId) ?? /* @__PURE__ */ new Map();
        sessionEvents.set(event.eventKey, event);
        bySession.set(event.sessionId, sessionEvents);
      }
      for (const sessionId of bySession.keys()) generations.set(sessionId, 1);
    },
    clear() {
      byKey.clear();
      bySession.clear();
      generations.clear();
    }
  };
}

// packages/client/src/components.tsx
import { useEffect as useEffect2, useLayoutEffect, useMemo as useMemo2, useState as useState2, useSyncExternalStore as useSyncExternalStore2 } from "react";

// packages/client/src/session-stages.tsx
import { useEffect, useMemo, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var DSH_COLORS = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  tertiary: "var(--dsw-alias-label-tertiary, #6b7280)",
  base: "var(--dsw-alias-bg-base, #ffffff)",
  layer2: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)",
  border2: "var(--dsw-alias-border-l2, #e5e7eb)",
  brand: "var(--dsw-alias-brand-primary, #2563eb)"
};
var PRICING_COLORS = {
  peak: "var(--dsw-alias-state-warn-primary, #b45309)",
  offpeak: "var(--dsw-alias-state-success-primary, #0f766e)",
  unknown: DSH_COLORS.brand
};

// packages/client/src/update-ui.tsx
import { useSyncExternalStore } from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var COLORS = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  tertiary: "var(--dsw-alias-label-tertiary, #6b7280)",
  base: "var(--dsw-alias-bg-base, #ffffff)",
  layer1: "var(--dsw-alias-bg-layer-1, #ffffff)",
  layer2: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)",
  border2: "var(--dsw-alias-border-l2, #e5e7eb)",
  brand: "var(--dsw-alias-brand-primary, #2563eb)",
  danger: "var(--dsw-alias-state-danger-primary, #b91c1c)"
};
var baseButtonStyle = {
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap"
};
var secondaryButtonStyle = {
  ...baseButtonStyle,
  color: COLORS.brand,
  background: COLORS.base,
  border: `1px solid ${COLORS.border1}`,
  cursor: "pointer"
};
var primaryButtonStyle = {
  ...baseButtonStyle,
  color: "#ffffff",
  background: COLORS.brand,
  border: `1px solid ${COLORS.brand}`,
  cursor: "pointer"
};

// packages/client/src/components.tsx
import { Fragment as Fragment2, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";

// packages/client/src/update-controller.ts
var MYMETER_UPDATE_RPC_ENDPOINTS = Object.freeze({
  checkLatest: "check",
  installVersion: "install"
});

// packages/client/src/shell-overlay.tsx
import {
  useEffect as useEffect3,
  useLayoutEffect as useLayoutEffect2,
  useRef
} from "react";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";

// packages/plugin/src/session-cost-tree.ts
function buildSessionCostTree({
  aggregation,
  events,
  details = {}
}) {
  const sessionIds = orderedSessionIds(aggregation, events, details);
  const parentBySession = observeParents(events);
  const nodes = createNodes(sessionIds, aggregation, details, parentBySession);
  const parentForTree = /* @__PURE__ */ new Map();
  const missingParents = [];
  for (const node of nodes.values()) {
    const parentSessionId = node.parentSessionId;
    if (!parentSessionId) continue;
    if (!nodes.has(parentSessionId)) {
      node.orphaned = true;
      missingParents.push({ sessionId: node.id, parentSessionId });
      continue;
    }
    parentForTree.set(node.id, parentSessionId);
  }
  const cycles = detectCycles(sessionIds, parentForTree);
  for (const cycle of cycles) {
    for (const sessionId of cycle) {
      const node = nodes.get(sessionId);
      if (!node) continue;
      node.cyclic = true;
      parentForTree.delete(sessionId);
    }
  }
  for (const [sessionId, parentSessionId] of parentForTree.entries()) {
    nodes.get(parentSessionId)?.childSessionIds.push(sessionId);
  }
  const roots = [...nodes.values()].filter((node) => !parentForTree.has(node.id)).sort(compareNodes);
  for (const root of roots) {
    assignPath(root, [], nodes);
  }
  for (const root of roots) {
    rollupSubtreeSummary(root, nodes);
  }
  const finalizedNodes = Object.fromEntries(
    [...nodes.entries()].map(([id, node]) => [id, freezeNode(node)])
  );
  return Object.freeze({
    roots: Object.freeze(roots.map((node) => finalizedNodes[node.id])),
    nodes: Object.freeze(finalizedNodes),
    summary: cloneSummary(aggregation.global),
    anomalies: Object.freeze({
      missingParents: Object.freeze(missingParents),
      cycles: Object.freeze(cycles)
    })
  });
}
function orderedSessionIds(aggregation, events, details) {
  const ids = /* @__PURE__ */ new Set();
  for (const id of aggregation.sessions.keys()) ids.add(id);
  for (const event of events) {
    const sessionId = normalizeSessionId(event.sessionId);
    if (sessionId) ids.add(sessionId);
  }
  for (const id of Object.keys(details)) {
    if (normalizeSessionId(id)) ids.add(id);
  }
  return [...ids].sort();
}
function observeParents(events) {
  const observed = /* @__PURE__ */ new Map();
  events.forEach((event, sequence) => {
    const sessionId = normalizeSessionId(event.sessionId);
    const parentSessionId = normalizeSessionId(event.parentSessionId);
    if (!sessionId || !parentSessionId) return;
    const activity = eventActivity(event);
    const previous = observed.get(sessionId);
    if (!previous || activity > previous.activity || activity === previous.activity && sequence > previous.sequence) {
      observed.set(sessionId, { parentSessionId, activity, sequence });
    }
  });
  return observed;
}
function createNodes(sessionIds, aggregation, details, parentBySession) {
  const nodes = /* @__PURE__ */ new Map();
  for (const sessionId of sessionIds) {
    const detail = details[sessionId];
    nodes.set(sessionId, {
      id: sessionId,
      title: titleForSession(sessionId, detail),
      parentSessionId: parentBySession.get(sessionId)?.parentSessionId,
      childSessionIds: [],
      depth: 0,
      path: [sessionId],
      summary: cloneSummary(aggregation.sessions.get(sessionId) ?? createEmptySummary()),
      subtreeSummary: createEmptySummary(),
      ...detail !== void 0 ? { detail } : {},
      orphaned: false,
      cyclic: false
    });
  }
  return nodes;
}
function detectCycles(sessionIds, parentForTree) {
  const cycles = [];
  const seenCycleKeys = /* @__PURE__ */ new Set();
  for (const start of sessionIds) {
    const path = [];
    const pathIndex = /* @__PURE__ */ new Map();
    let current = start;
    while (current) {
      const existing = pathIndex.get(current);
      if (existing !== void 0) {
        const cycle = path.slice(existing);
        const key = [...cycle].sort().join("\0");
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key);
          cycles.push(cycle);
        }
        break;
      }
      if (path.includes(current)) break;
      pathIndex.set(current, path.length);
      path.push(current);
      current = parentForTree.get(current);
    }
  }
  return cycles.sort((left, right) => left[0].localeCompare(right[0]));
}
function assignPath(node, ancestors, nodes) {
  node.depth = ancestors.length;
  node.path = [...ancestors, node.id];
  for (const childId of node.childSessionIds) {
    const child = nodes.get(childId);
    if (child) assignPath(child, node.path, nodes);
  }
}
function rollupSubtreeSummary(node, nodes) {
  let summary = cloneSummary(node.summary);
  for (const childId of node.childSessionIds) {
    const child = nodes.get(childId);
    if (!child) continue;
    summary = addSummary(summary, rollupSubtreeSummary(child, nodes));
  }
  node.subtreeSummary = summary;
  return summary;
}
function addSummary(left, right) {
  const result = cloneSummary(left);
  result.requestCount += right.requestCount;
  result.totalMicroCny += right.totalMicroCny;
  result.estimatedMicroCny += right.estimatedMicroCny;
  result.settledMicroCny += right.settledMicroCny;
  result.unknownMicroCny += right.unknownMicroCny;
  result.failedMicroCny += right.failedMicroCny;
  result.unknownCount += right.unknownCount;
  result.estimatedCount += right.estimatedCount;
  result.settledCount += right.settledCount;
  result.failedCount += right.failedCount;
  result.cacheHitTokens += right.cacheHitTokens;
  result.cacheMissTokens += right.cacheMissTokens;
  result.outputTokens += right.outputTokens;
  result.reasoningTokens += right.reasoningTokens;
  result.peakMicroCny += right.peakMicroCny;
  result.offpeakMicroCny += right.offpeakMicroCny;
  if (result.firstSeenAt === "" || right.firstSeenAt !== "" && right.firstSeenAt < result.firstSeenAt) {
    result.firstSeenAt = right.firstSeenAt;
  }
  if (right.lastSeenAt !== "" && (result.lastSeenAt === "" || right.lastSeenAt > result.lastSeenAt)) {
    result.lastSeenAt = right.lastSeenAt;
    result.provider = right.provider;
    result.model = right.model;
    result.reasoningEffort = right.reasoningEffort;
    result.agentPreset = right.agentPreset;
  }
  return result;
}
function cloneSummary(summary) {
  return { ...summary };
}
function freezeNode(node) {
  return Object.freeze({
    ...node,
    childSessionIds: Object.freeze([...node.childSessionIds]),
    path: Object.freeze([...node.path]),
    summary: Object.freeze(cloneSummary(node.summary)),
    subtreeSummary: Object.freeze(cloneSummary(node.subtreeSummary))
  });
}
function compareNodes(left, right) {
  const leftSeen = left.summary.firstSeenAt || left.summary.lastSeenAt;
  const rightSeen = right.summary.firstSeenAt || right.summary.lastSeenAt;
  if (leftSeen !== rightSeen) return leftSeen.localeCompare(rightSeen);
  return left.id.localeCompare(right.id);
}
function eventActivity(event) {
  return event.completedAt || event.requestStartedAt || "";
}
function normalizeSessionId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== "unknown" ? trimmed : null;
}
function titleForSession(sessionId, detail) {
  if (detail && typeof detail === "object" && "title" in detail) {
    const title = detail.title;
    if (typeof title === "string" && title.trim().length > 0) return title;
  }
  return sessionId;
}

// packages/plugin/src/typert-remote.ts
var MYMETER_SERVICE_KEY = "mymeter";
var MYMETER_PACKAGE_NAME = "@mymeter/dsh-cost-meter";
var stringSchema = schema("string", (value) => {
  if (typeof value !== "string") throw new Error("expected string");
  return value;
});
var ledgerExportFormatSchema = schema(
  "LedgerExportFormat",
  (value) => oneOf(value, ["json", "csv"], "ledgerExportFormat")
);
var sessionIdSchema = schema("SessionId", (value) => {
  if (typeof value !== "string" || value.length === 0) throw new Error("expected non-empty session id");
  return value;
});
var snapshotSchema = schema("MyMeterRemoteSnapshot", parseSnapshot);
var sessionsSchema = schema("RemoteSessionSummaryArray", (value) => {
  if (!Array.isArray(value)) throw new Error("expected session array");
  return value.map(parseSessionSummary);
});
var sessionDetailOrNullSchema = schema("RemoteSessionDetailOrNull", (value) => {
  if (value === null) return null;
  return parseSessionDetail(value);
});
var balanceSchema = schema("RemoteBalanceSnapshot", parseBalance);
var settingsSchema = schema("RemoteSettings", (value) => {
  if (!isRecord(value)) throw new Error("expected settings object");
  return value;
});
var exchangeRateSchema = schema("RemoteExchangeRateSnapshot", parseExchangeRate);
var sessionCostTreeSchema = schema("RemoteSessionCostTree", parseSessionCostTree);
var costAnalyticsSchema = schema("RemoteCostAnalyticsReport", parseCostAnalyticsReport);
var getSnapshotDescriptor = descriptor("getSnapshot", [], snapshotSchema);
var listSessionsDescriptor = descriptor("listSessions", [], sessionsSchema);
var getSessionDetailDescriptor = descriptor(
  "getSessionDetail",
  [{ name: "sessionId", wire: "sessionId", source: "json", codec: codec("SessionId", sessionIdSchema) }],
  sessionDetailOrNullSchema
);
var getBalanceDescriptor = descriptor("getBalance", [], balanceSchema);
var getSettingsDescriptor = descriptor("getSettings", [], settingsSchema);
var refreshExchangeRateDescriptor = descriptor("refreshExchangeRate", [], exchangeRateSchema);
var getSessionCostTreeDescriptor = descriptor("getSessionCostTree", [], sessionCostTreeSchema);
var getCostAnalyticsDescriptor = descriptor("getCostAnalytics", [], costAnalyticsSchema);
var exportLedgerDescriptor = descriptor(
  "exportLedger",
  [{ name: "format", wire: "format", source: "json", codec: codec("LedgerExportFormat", ledgerExportFormatSchema) }],
  stringSchema
);
var MYMETER_REMOTE_DESCRIPTORS = [
  getSnapshotDescriptor,
  listSessionsDescriptor,
  getSessionDetailDescriptor,
  getBalanceDescriptor,
  getSettingsDescriptor,
  refreshExchangeRateDescriptor,
  getSessionCostTreeDescriptor,
  getCostAnalyticsDescriptor,
  exportLedgerDescriptor
];
var MYMETER_REMOTE_CONTRIBUTION = Object.freeze({
  package: MYMETER_PACKAGE_NAME,
  descriptors: MYMETER_REMOTE_DESCRIPTORS
});
var MYMETER_LOCAL_TYPERT_CONTRIBUTION = Object.freeze({
  package: MYMETER_PACKAGE_NAME,
  face: "host",
  schemas: [
    { name: "MyMeterRemoteSnapshot", schema: snapshotSchema },
    { name: "RemoteSessionSummaryArray", schema: sessionsSchema },
    { name: "RemoteSessionDetailOrNull", schema: sessionDetailOrNullSchema },
    { name: "RemoteBalanceSnapshot", schema: balanceSchema },
    { name: "RemoteSettings", schema: settingsSchema },
    { name: "RemoteExchangeRateSnapshot", schema: exchangeRateSchema },
    { name: "RemoteSessionCostTree", schema: sessionCostTreeSchema },
    { name: "RemoteCostAnalyticsReport", schema: costAnalyticsSchema },
    { name: "LedgerExportFormat", schema: ledgerExportFormatSchema }
  ],
  model: {
    services: [{
      key: MYMETER_SERVICE_KEY,
      exportName: "MyMeterRemote",
      summary: "MyMeter cost-meter Remote service.",
      tags: [],
      members: MYMETER_REMOTE_DESCRIPTORS.map((entry) => ({
        kind: "method",
        name: entry.method,
        signature: `${entry.method}(...): Promise<unknown>`
      })),
      types: []
    }],
    events: [],
    objects: []
  },
  invocations: MYMETER_REMOTE_DESCRIPTORS
});
function bindMyMeterTypertRemote(service) {
  return Object.assign(service, {
    typertRemote: Object.freeze({
      service,
      serviceKey: MYMETER_SERVICE_KEY,
      namespace: MYMETER_SERVICE_KEY
    })
  });
}
function descriptor(method, parameters, resultSchema) {
  return Object.freeze({
    id: `${MYMETER_PACKAGE_NAME}#${MYMETER_SERVICE_KEY}/${method}`,
    service: MYMETER_SERVICE_KEY,
    namespace: MYMETER_SERVICE_KEY,
    method,
    invocation: { kind: "direct" },
    parameters,
    result: codec(resultSchemaName(resultSchema), resultSchema)
  });
}
function codec(typeName, valueSchema) {
  return { mode: "strict", typeSymbol: `${MYMETER_PACKAGE_NAME}#${typeName}`, schema: valueSchema };
}
function schema(name2, parse) {
  return Object.freeze({ typeName: name2, parse });
}
function resultSchemaName(valueSchema) {
  return "typeName" in valueSchema && typeof valueSchema.typeName === "string" ? valueSchema.typeName : "Unknown";
}
function parseSnapshot(value) {
  const record = object(value, "snapshot");
  const sessions = array(record.sessions, "sessions").map(parseSessionSummary);
  const rawDetails = object(record.details, "details");
  const details = {};
  for (const [key, detail] of Object.entries(rawDetails)) details[key] = parseSessionDetail(detail);
  const summary = parseSummary(record.summary);
  const balance = parseBalance(record.balance);
  const balances = record.balances === void 0 ? legacyProviderBalances(summary.provider, balance) : array(record.balances, "balances").map(parseProviderBalance);
  return {
    connection: parseConnection(record.connection),
    currentSessionId: nullableString(record.currentSessionId, "currentSessionId"),
    summary,
    balance,
    balances,
    sessions,
    details,
    ...record.exchangeRate === void 0 ? {} : { exchangeRate: parseExchangeRate(record.exchangeRate) }
  };
}
function parseSessionCostTree(value) {
  const record = object(value, "sessionCostTree");
  const rawNodes = object(record.nodes, "sessionCostTree.nodes");
  const nodes = {};
  for (const [key, node] of Object.entries(rawNodes)) {
    nodes[key] = parseSessionCostTreeNode(node, `sessionCostTree.nodes.${key}`);
  }
  const anomalies = object(record.anomalies, "sessionCostTree.anomalies");
  return {
    roots: array(record.roots, "sessionCostTree.roots").map(
      (node) => parseSessionCostTreeNode(node, "sessionCostTree.roots")
    ),
    nodes,
    summary: parseLedgerSummary(record.summary, "sessionCostTree.summary"),
    anomalies: {
      missingParents: array(anomalies.missingParents, "sessionCostTree.anomalies.missingParents").map((item) => {
        const missing = object(item, "sessionCostTree.anomalies.missingParents");
        return {
          sessionId: requiredString(missing.sessionId, "missingParent.sessionId"),
          parentSessionId: requiredString(missing.parentSessionId, "missingParent.parentSessionId")
        };
      }),
      cycles: array(anomalies.cycles, "sessionCostTree.anomalies.cycles").map(
        (cycle) => array(cycle, "sessionCostTree.anomalies.cycles[]").map(
          (sessionId) => requiredString(sessionId, "cycle.sessionId")
        )
      )
    }
  };
}
function parseSessionCostTreeNode(value, field) {
  const record = object(value, field);
  return {
    id: requiredString(record.id, `${field}.id`),
    title: requiredString(record.title, `${field}.title`),
    ...record.parentSessionId === void 0 ? {} : { parentSessionId: requiredString(record.parentSessionId, `${field}.parentSessionId`) },
    childSessionIds: array(record.childSessionIds, `${field}.childSessionIds`).map(
      (item) => requiredString(item, `${field}.childSessionIds[]`)
    ),
    depth: nonNegativeNumber2(record.depth, `${field}.depth`),
    path: array(record.path, `${field}.path`).map((item) => requiredString(item, `${field}.path[]`)),
    summary: parseLedgerSummary(record.summary, `${field}.summary`),
    subtreeSummary: parseLedgerSummary(record.subtreeSummary, `${field}.subtreeSummary`),
    ...record.detail === void 0 ? {} : { detail: parseSessionDetail(record.detail) },
    orphaned: boolean(record.orphaned, `${field}.orphaned`),
    cyclic: boolean(record.cyclic, `${field}.cyclic`)
  };
}
function parseLedgerSummary(value, field) {
  const record = object(value, field);
  return {
    requestCount: finiteNumber(record.requestCount, `${field}.requestCount`),
    totalMicroCny: finiteNumber(record.totalMicroCny, `${field}.totalMicroCny`),
    estimatedMicroCny: finiteNumber(record.estimatedMicroCny, `${field}.estimatedMicroCny`),
    settledMicroCny: finiteNumber(record.settledMicroCny, `${field}.settledMicroCny`),
    unknownMicroCny: finiteNumber(record.unknownMicroCny, `${field}.unknownMicroCny`),
    failedMicroCny: finiteNumber(record.failedMicroCny, `${field}.failedMicroCny`),
    unknownCount: finiteNumber(record.unknownCount, `${field}.unknownCount`),
    estimatedCount: finiteNumber(record.estimatedCount, `${field}.estimatedCount`),
    settledCount: finiteNumber(record.settledCount, `${field}.settledCount`),
    failedCount: finiteNumber(record.failedCount, `${field}.failedCount`),
    cacheHitTokens: finiteNumber(record.cacheHitTokens, `${field}.cacheHitTokens`),
    cacheMissTokens: finiteNumber(record.cacheMissTokens, `${field}.cacheMissTokens`),
    outputTokens: finiteNumber(record.outputTokens, `${field}.outputTokens`),
    reasoningTokens: finiteNumber(record.reasoningTokens, `${field}.reasoningTokens`),
    peakMicroCny: finiteNumber(record.peakMicroCny, `${field}.peakMicroCny`),
    offpeakMicroCny: finiteNumber(record.offpeakMicroCny, `${field}.offpeakMicroCny`),
    firstSeenAt: requiredString(record.firstSeenAt, `${field}.firstSeenAt`),
    lastSeenAt: requiredString(record.lastSeenAt, `${field}.lastSeenAt`),
    provider: requiredString(record.provider, `${field}.provider`),
    model: requiredString(record.model, `${field}.model`),
    reasoningEffort: requiredString(record.reasoningEffort, `${field}.reasoningEffort`),
    agentPreset: requiredString(record.agentPreset, `${field}.agentPreset`)
  };
}
function parseCostAnalyticsReport(value) {
  const record = object(value, "costAnalytics");
  return {
    generatedAt: requiredString(record.generatedAt, "costAnalytics.generatedAt"),
    global: parseAnalyticsTotal(record.global, "costAnalytics.global"),
    sessions: array(record.sessions, "costAnalytics.sessions").map((item) => {
      const session = object(item, "costAnalytics.sessions");
      return {
        sessionId: requiredString(session.sessionId, "costAnalytics.sessions.sessionId"),
        ...parseAnalyticsTotal(session, "costAnalytics.sessions")
      };
    }),
    dailyTrend: array(record.dailyTrend, "costAnalytics.dailyTrend").map(
      (item) => parseAnalyticsTrendBucket(item, "costAnalytics.dailyTrend")
    ),
    hourlyTrend: array(record.hourlyTrend, "costAnalytics.hourlyTrend").map(
      (item) => parseAnalyticsTrendBucket(item, "costAnalytics.hourlyTrend")
    ),
    anomalies: array(record.anomalies, "costAnalytics.anomalies").map(parseAnalyticsAnomaly)
  };
}
function parseAnalyticsTotal(value, field) {
  const record = object(value, field);
  return {
    totalMicroCny: finiteNumber(record.totalMicroCny, `${field}.totalMicroCny`),
    requestCount: finiteNumber(record.requestCount, `${field}.requestCount`),
    statusCounts: parseAnalyticsStatusCounts(record.statusCounts, `${field}.statusCounts`),
    peakMicroCny: finiteNumber(record.peakMicroCny, `${field}.peakMicroCny`),
    offpeakMicroCny: finiteNumber(record.offpeakMicroCny, `${field}.offpeakMicroCny`)
  };
}
function parseAnalyticsTrendBucket(value, field) {
  const record = object(value, field);
  return {
    key: requiredString(record.key, `${field}.key`),
    startAt: requiredString(record.startAt, `${field}.startAt`),
    endAt: requiredString(record.endAt, `${field}.endAt`),
    amountMicroCny: finiteNumber(record.amountMicroCny, `${field}.amountMicroCny`),
    requestCount: finiteNumber(record.requestCount, `${field}.requestCount`),
    statusCounts: parseAnalyticsStatusCounts(record.statusCounts, `${field}.statusCounts`),
    peakMicroCny: finiteNumber(record.peakMicroCny, `${field}.peakMicroCny`),
    offpeakMicroCny: finiteNumber(record.offpeakMicroCny, `${field}.offpeakMicroCny`),
    previousAmountMicroCny: nullableNumber(record.previousAmountMicroCny, `${field}.previousAmountMicroCny`),
    deltaMicroCny: nullableNumber(record.deltaMicroCny, `${field}.deltaMicroCny`),
    deltaRatio: nullableNumber(record.deltaRatio, `${field}.deltaRatio`)
  };
}
function parseAnalyticsStatusCounts(value, field) {
  const record = object(value, field);
  return {
    estimated: finiteNumber(record.estimated, `${field}.estimated`),
    settled: finiteNumber(record.settled, `${field}.settled`),
    unknown: finiteNumber(record.unknown, `${field}.unknown`),
    failed: finiteNumber(record.failed, `${field}.failed`)
  };
}
function parseAnalyticsAnomaly(value) {
  const record = object(value, "costAnalytics.anomalies");
  return {
    ruleId: requiredString(record.ruleId, "costAnalytics.anomalies.ruleId"),
    severity: oneOf(record.severity, ["info", "warning"], "costAnalytics.anomalies.severity"),
    bucketKey: requiredString(record.bucketKey, "costAnalytics.anomalies.bucketKey"),
    ...record.observedMicroCny === void 0 ? {} : { observedMicroCny: finiteNumber(record.observedMicroCny, "costAnalytics.anomalies.observedMicroCny") },
    ...record.baselineMicroCny === void 0 ? {} : { baselineMicroCny: finiteNumber(record.baselineMicroCny, "costAnalytics.anomalies.baselineMicroCny") },
    ...record.observedCount === void 0 ? {} : { observedCount: finiteNumber(record.observedCount, "costAnalytics.anomalies.observedCount") },
    ...record.baselineCount === void 0 ? {} : { baselineCount: finiteNumber(record.baselineCount, "costAnalytics.anomalies.baselineCount") },
    ...record.ratio === void 0 ? {} : { ratio: finiteNumber(record.ratio, "costAnalytics.anomalies.ratio") },
    threshold: finiteNumber(record.threshold, "costAnalytics.anomalies.threshold"),
    explanation: requiredString(record.explanation, "costAnalytics.anomalies.explanation")
  };
}
function parseExchangeRate(value) {
  const record = object(value, "exchangeRate");
  return {
    status: oneOf(record.status, ["idle", "loading", "fresh", "error"], "exchangeRate.status"),
    baseCurrency: oneOf(record.baseCurrency, ["USD"], "exchangeRate.baseCurrency"),
    quoteCurrency: oneOf(record.quoteCurrency, ["CNY"], "exchangeRate.quoteCurrency"),
    rate: nullableNumber(record.rate, "exchangeRate.rate"),
    fetchedAt: nullableString(record.fetchedAt, "exchangeRate.fetchedAt"),
    source: nullableString(record.source, "exchangeRate.source"),
    error: nullableString(record.error, "exchangeRate.error")
  };
}
function parseConnection(value) {
  const record = object(value, "connection");
  const status = oneOf(record.status, ["connected", "stale", "loading", "error"], "connection.status");
  return { status, message: nullableString(record.message, "connection.message") };
}
function parseSummary(value) {
  const record = object(value, "summary");
  const status = object(record.status, "summary.status");
  const model = requiredString(record.model, "summary.model");
  return {
    status: { code: meterStatus(status.code, "summary.status.code") },
    provider: parseProvider(record.provider, model, "summary.provider"),
    model,
    reasoningEffort: requiredString(record.reasoningEffort, "summary.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "summary.agentPreset"),
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "summary.currentRequestMicroCny"),
    sessionTotalMicroCny: finiteNumber(record.sessionTotalMicroCny, "summary.sessionTotalMicroCny"),
    settledTotalMicroCny: finiteNumber(record.settledTotalMicroCny, "summary.settledTotalMicroCny"),
    estimatedTotalMicroCny: finiteNumber(record.estimatedTotalMicroCny, "summary.estimatedTotalMicroCny"),
    localTotalMicroCny: finiteNumber(record.localTotalMicroCny, "summary.localTotalMicroCny"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "summary.pricingZone"),
    ...record.currencyTotals === void 0 ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "summary.currencyTotals") },
    ...record.cnyEquivalentMicroCny === void 0 ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "summary.cnyEquivalentMicroCny") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "summary.currency") },
    ...record.currentRequestMinor === void 0 ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "summary.currentRequestMinor") },
    ...record.sessionTotalMinor === void 0 ? {} : { sessionTotalMinor: finiteNumber(record.sessionTotalMinor, "summary.sessionTotalMinor") }
  };
}
function parseCurrencyTotals(value, field) {
  return array(value, field).map((item) => {
    const record = object(item, field);
    return {
      currency: nonEmptyString(record.currency, `${field}.currency`),
      amountMinor: finiteNumber(record.amountMinor, `${field}.amountMinor`),
      settledMinor: finiteNumber(record.settledMinor, `${field}.settledMinor`),
      estimatedMinor: finiteNumber(record.estimatedMinor, `${field}.estimatedMinor`),
      failedMinor: finiteNumber(record.failedMinor, `${field}.failedMinor`)
    };
  });
}
function parseBalance(value) {
  const record = object(value, "balance");
  return {
    status: oneOf(record.status, ["fresh", "stale", "expired", "insufficient", "unavailable"], "balance.status"),
    currency: record.currency === void 0 ? "CNY" : nullableString(record.currency, "balance.currency"),
    totalMicroCny: nullableNumber(record.totalMicroCny, "balance.totalMicroCny"),
    grantedMicroCny: nullableNumber(record.grantedMicroCny, "balance.grantedMicroCny"),
    toppedUpMicroCny: nullableNumber(record.toppedUpMicroCny, "balance.toppedUpMicroCny"),
    refreshedAt: nullableString(record.refreshedAt, "balance.refreshedAt")
  };
}
function parseProviderBalance(value) {
  const record = object(value, "providerBalance");
  const balance = parseBalance(record);
  return {
    provider: nonEmptyString(record.provider, "providerBalance.provider"),
    providerName: nonEmptyString(record.providerName, "providerBalance.providerName"),
    supported: boolean(record.supported, "providerBalance.supported"),
    ...balance
  };
}
function legacyProviderBalances(provider, balance) {
  const normalized = provider.trim().toLowerCase();
  const inferredProvider = normalized === "unknown" && balance.totalMicroCny !== null ? "deepseek" : provider;
  const inferredNormalized = inferredProvider.trim().toLowerCase();
  if (!inferredProvider.trim() || inferredNormalized === "unknown") return [];
  const supported = inferredNormalized === "deepseek" || inferredNormalized === "deepseek-official";
  return [{
    provider: inferredProvider,
    providerName: supported ? "DeepSeek" : inferredProvider,
    supported,
    ...supported ? balance : unavailableBalance()
  }];
}
function unavailableBalance() {
  return {
    status: "unavailable",
    currency: null,
    totalMicroCny: null,
    grantedMicroCny: null,
    toppedUpMicroCny: null,
    refreshedAt: null
  };
}
function parseSessionSummary(value) {
  const record = object(value, "session");
  const model = requiredString(record.model, "session.model");
  return {
    id: requiredString(record.id, "session.id"),
    title: requiredString(record.title, "session.title"),
    provider: parseProvider(record.provider, model, "session.provider"),
    model,
    reasoningEffort: requiredString(record.reasoningEffort, "session.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "session.agentPreset"),
    status: meterStatus(record.status, "session.status"),
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "session.currentRequestMicroCny"),
    sessionTotalMicroCny: finiteNumber(record.sessionTotalMicroCny, "session.sessionTotalMicroCny"),
    unknownCount: finiteNumber(record.unknownCount, "session.unknownCount"),
    lastActivityAt: requiredString(record.lastActivityAt, "session.lastActivityAt"),
    ...record.currencyTotals === void 0 ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "session.currencyTotals") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "session.currency") },
    ...record.currentRequestMinor === void 0 ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "session.currentRequestMinor") },
    ...record.sessionTotalMinor === void 0 ? {} : { sessionTotalMinor: finiteNumber(record.sessionTotalMinor, "session.sessionTotalMinor") },
    ...record.cnyEquivalentMicroCny === void 0 ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "session.cnyEquivalentMicroCny") }
  };
}
function parseSessionDetail(value) {
  const record = object(value, "detail");
  const model = requiredString(record.model, "detail.model");
  return {
    id: requiredString(record.id, "detail.id"),
    title: requiredString(record.title, "detail.title"),
    provider: parseProvider(record.provider, model, "detail.provider"),
    model,
    reasoningEffort: requiredString(record.reasoningEffort, "detail.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "detail.agentPreset"),
    status: meterStatus(record.status, "detail.status"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "detail.pricingZone"),
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "detail.currentRequestMicroCny"),
    sessionTotalMicroCny: finiteNumber(record.sessionTotalMicroCny, "detail.sessionTotalMicroCny"),
    settledTotalMicroCny: finiteNumber(record.settledTotalMicroCny, "detail.settledTotalMicroCny"),
    estimatedTotalMicroCny: finiteNumber(record.estimatedTotalMicroCny, "detail.estimatedTotalMicroCny"),
    unknownCount: finiteNumber(record.unknownCount, "detail.unknownCount"),
    tokenBuckets: array(record.tokenBuckets, "detail.tokenBuckets").map(parseTokenBucket),
    contextBreakdown: parseContextBreakdown(record.contextBreakdown),
    turns: array(record.turns, "detail.turns").map(parseTurn),
    stages: array(record.stages, "detail.stages").map(parseStage),
    ...record.currencyTotals === void 0 ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "detail.currencyTotals") },
    ...record.cnyEquivalentMicroCny === void 0 ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "detail.cnyEquivalentMicroCny") }
  };
}
function parseStage(value) {
  const record = object(value, "stage");
  return {
    id: requiredString(record.id, "stage.id"),
    index: positiveInteger2(record.index, "stage.index"),
    isCurrent: boolean(record.isCurrent, "stage.isCurrent"),
    startedAt: requiredString(record.startedAt, "stage.startedAt"),
    completedAt: nullableString(record.completedAt, "stage.completedAt"),
    lastActivityAt: requiredString(record.lastActivityAt, "stage.lastActivityAt"),
    status: meterStatus(record.status, "stage.status"),
    model: requiredString(record.model, "stage.model"),
    reasoningEffort: requiredString(record.reasoningEffort, "stage.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "stage.agentPreset"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "stage.pricingZone"),
    priceVersion: requiredString(record.priceVersion, "stage.priceVersion"),
    ...record.exchangeRateLabel === void 0 ? {} : { exchangeRateLabel: nullableString(record.exchangeRateLabel, "stage.exchangeRateLabel") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "stage.currency") },
    ...record.currentRequestMinor === void 0 ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "stage.currentRequestMinor") },
    ...record.totalMinor === void 0 ? {} : { totalMinor: finiteNumber(record.totalMinor, "stage.totalMinor") },
    ...record.settledTotalMinor === void 0 ? {} : { settledTotalMinor: finiteNumber(record.settledTotalMinor, "stage.settledTotalMinor") },
    ...record.estimatedTotalMinor === void 0 ? {} : { estimatedTotalMinor: finiteNumber(record.estimatedTotalMinor, "stage.estimatedTotalMinor") },
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "stage.currentRequestMicroCny"),
    totalMicroCny: finiteNumber(record.totalMicroCny, "stage.totalMicroCny"),
    settledTotalMicroCny: finiteNumber(record.settledTotalMicroCny, "stage.settledTotalMicroCny"),
    estimatedTotalMicroCny: finiteNumber(record.estimatedTotalMicroCny, "stage.estimatedTotalMicroCny"),
    unknownCount: finiteNumber(record.unknownCount, "stage.unknownCount"),
    tokenBuckets: array(record.tokenBuckets, "stage.tokenBuckets").map(parseTokenBucket),
    turns: array(record.turns, "stage.turns").map(parseTurn),
    contextBreakdown: parseContextBreakdown(record.contextBreakdown, "stage.contextBreakdown")
  };
}
function parseContextBreakdown(value, field = "detail.contextBreakdown") {
  if (value === void 0 || value === null) return null;
  const record = object(value, field);
  return {
    systemTokens: nonNegativeNumber2(record.systemTokens, `${field}.systemTokens`),
    toolsTokens: nonNegativeNumber2(record.toolsTokens, `${field}.toolsTokens`),
    messageTokens: nonNegativeNumber2(record.messageTokens, `${field}.messageTokens`)
  };
}
function parseTokenBucket(value) {
  const record = object(value, "tokenBucket");
  const unitPrice = record.unitPriceMicroCnyPerMillionTokens;
  const unitPriceMixed = record.unitPriceMixed;
  return {
    label: requiredString(record.label, "tokenBucket.label"),
    tokens: finiteNumber(record.tokens, "tokenBucket.tokens"),
    amountMicroCny: finiteNumber(record.amountMicroCny, "tokenBucket.amountMicroCny"),
    ...unitPrice === void 0 ? {} : {
      unitPriceMicroCnyPerMillionTokens: nullableNumber(
        unitPrice,
        "tokenBucket.unitPriceMicroCnyPerMillionTokens"
      )
    },
    ...unitPriceMixed === void 0 ? {} : { unitPriceMixed: boolean(unitPriceMixed, "tokenBucket.unitPriceMixed") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "tokenBucket.currency") },
    ...record.amountMinor === void 0 ? {} : { amountMinor: finiteNumber(record.amountMinor, "tokenBucket.amountMinor") },
    ...record.unitPriceMinorPerMillionTokens === void 0 ? {} : { unitPriceMinorPerMillionTokens: nullableNumber(record.unitPriceMinorPerMillionTokens, "tokenBucket.unitPriceMinorPerMillionTokens") }
  };
}
function parseTurn(value) {
  const record = object(value, "turn");
  return {
    id: requiredString(record.id, "turn.id"),
    label: requiredString(record.label, "turn.label"),
    startedAt: requiredString(record.startedAt, "turn.startedAt"),
    completedAt: nullableString(record.completedAt, "turn.completedAt"),
    status: meterStatus(record.status, "turn.status"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "turn.pricingZone"),
    cacheHitTokens: finiteNumber(record.cacheHitTokens, "turn.cacheHitTokens"),
    cacheMissTokens: finiteNumber(record.cacheMissTokens, "turn.cacheMissTokens"),
    outputTokens: finiteNumber(record.outputTokens, "turn.outputTokens"),
    reasoningTokens: finiteNumber(record.reasoningTokens, "turn.reasoningTokens"),
    amountMicroCny: finiteNumber(record.amountMicroCny, "turn.amountMicroCny"),
    note: nullableString(record.note, "turn.note"),
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "turn.currency") },
    ...record.amountMinor === void 0 ? {} : { amountMinor: finiteNumber(record.amountMinor, "turn.amountMinor") }
  };
}
function object(value, field) {
  if (!isRecord(value)) throw new Error(`${field}: expected object`);
  return value;
}
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function array(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field}: expected array`);
  return value;
}
function requiredString(value, field) {
  if (typeof value !== "string") throw new Error(`${field}: expected string`);
  return value;
}
function nonEmptyString(value, field) {
  const parsed = requiredString(value, field);
  if (!parsed.trim()) throw new Error(`${field}: expected non-empty string`);
  return parsed;
}
function nullableString(value, field) {
  if (value === null) return null;
  return requiredString(value, field);
}
function parseProvider(value, model, field) {
  if (value === void 0) {
    return model.trim().toLowerCase().startsWith("deepseek-") ? "deepseek" : "unknown";
  }
  return requiredString(value, field);
}
function boolean(value, field) {
  if (typeof value !== "boolean") throw new Error(`${field}: expected boolean`);
  return value;
}
function finiteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field}: expected finite number`);
  return value;
}
function nonNegativeNumber2(value, field) {
  const number = finiteNumber(value, field);
  if (number < 0) throw new Error(`${field}: expected non-negative number`);
  return number;
}
function positiveInteger2(value, field) {
  const number = finiteNumber(value, field);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${field}: expected positive integer`);
  return number;
}
function nullableNumber(value, field) {
  if (value === null) return null;
  return finiteNumber(value, field);
}
function meterStatus(value, field) {
  return oneOf(
    value,
    ["idle", "billing", "settled", "unknown", "balance_expired", "balance_insufficient", "failed", "aborted"],
    field
  );
}
function oneOf(value, values, field) {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`${field}: expected one of ${values.join(", ")}`);
  }
  return value;
}

// packages/plugin/src/index.tsx
var PROJECTION_EVENT = "mymeter:projection";
var FINAL_USAGE_EVENT = "mymeter:final_usage";
var ACTIVE_REQUEST_EVENT = "mymeter:active_request";
function createMyMeterHostRuntime({
  dsh,
  balance,
  providers,
  contextBreakdown,
  repository: configuredRepository,
  exchangeRate: configuredExchangeRate,
  afterLedgerCommit,
  onAfterLedgerCommitError
}) {
  const metadataAdapter = createHostMetadataAdapter();
  const projectionAdapter = createHostProjectionAdapter();
  const usageAdapter = createHostUsageAdapter();
  const repository = configuredRepository ?? createInMemoryCostEventRepository();
  const journal = createCostEventJournal(
    repository.list().map(toCoreCostEvent).filter((event) => event !== null)
  );
  const readModel = createBillingReadModel({ equals: sameCostEvent });
  readModel.rebuild(journal.list());
  const aggregator = createLedgerAggregator();
  const activeRequests = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  const cleanups = [];
  const dirtyEventKeys = /* @__PURE__ */ new Set();
  let batchDepth = 0;
  let ledgerDirty = false;
  let snapshotDirty = false;
  let installed = true;
  let lastBalance = {
    status: "unavailable",
    currency: null,
    totalMicroCny: null,
    grantedMicroCny: null,
    toppedUpMicroCny: null,
    refreshedAt: null
  };
  let latestExchangeRate = {
    status: "idle",
    baseCurrency: "USD",
    quoteCurrency: "CNY",
    rate: null,
    fetchedAt: null,
    source: null,
    error: null
  };
  const readProviders = () => {
    if (providers) return providers();
    return balance ? [{ id: "deepseek", name: "DeepSeek", balanceSupported: true }] : [];
  };
  let cachedSnapshot = null;
  let cachedProviderFingerprint = "";
  let cachedContextFingerprint = "";
  let exchangeRateGeneration = 0;
  const activeRequestGenerations = /* @__PURE__ */ new Map();
  const detailCache = /* @__PURE__ */ new Map();
  const readSessionContext = (sessionId) => cloneRemoteContextBreakdown(contextBreakdown?.(sessionId) ?? null);
  const bumpActiveRequestGeneration = (sessionId) => {
    activeRequestGenerations.set(sessionId, (activeRequestGenerations.get(sessionId) ?? 0) + 1);
  };
  const getCachedSessionDetail = (sessionId, configuredProviders = readProviders()) => {
    const sessionEvents = readModel.getSessionEvents(sessionId);
    const latestActive = latestActiveRequest([...activeRequests.values()].filter(isSupportedPricingRequest));
    const active = latestActive?.sessionId === sessionId ? latestActive : null;
    if (sessionEvents.length === 0 && !active) {
      detailCache.delete(sessionId);
      return null;
    }
    const context = readSessionContext(sessionId);
    const providerKey = providerFingerprint(configuredProviders);
    const cacheKey = JSON.stringify([
      readModel.getGeneration(sessionId),
      context,
      exchangeRateGeneration,
      providerKey,
      active ? activeRequestGenerations.get(sessionId) ?? 0 : "inactive"
    ]);
    const cached = detailCache.get(sessionId);
    if (cached?.key === cacheKey) return cached.detail;
    const detail = createRemoteSessionDetail(
      sessionId,
      sessionEvents.length > 0 ? aggregator.aggregate(sessionEvents.map(toHostCostEventInput)).global : void 0,
      sessionEvents,
      latestExchangeRate,
      context,
      active
    );
    if (!detail) {
      detailCache.delete(sessionId);
      return null;
    }
    const frozen = deepFreeze(detail);
    detailCache.set(sessionId, { key: cacheKey, detail: frozen });
    return frozen;
  };
  const rebuildSnapshot = (configuredProviders = readProviders()) => {
    const observedContext = /* @__PURE__ */ new Map();
    const readContext = contextBreakdown ? (sessionId) => {
      if (observedContext.has(sessionId)) return observedContext.get(sessionId) ?? null;
      const value = cloneRemoteContextBreakdown(contextBreakdown(sessionId));
      observedContext.set(sessionId, value);
      return value;
    } : void 0;
    cachedProviderFingerprint = providerFingerprint(configuredProviders);
    cachedSnapshot = deepFreeze(createRemoteSnapshot(
      journal.list(),
      aggregateLedger(),
      lastBalance,
      latestExchangeRate,
      readContext,
      activeRequests,
      configuredProviders,
      (sessionId) => readModel.getSessionEvents(sessionId)
    ));
    cachedContextFingerprint = contextBreakdown ? contextFingerprint(
      Object.keys(cachedSnapshot.details),
      (sessionId) => observedContext.get(sessionId) ?? null
    ) : "";
    return cachedSnapshot;
  };
  const emitSnapshot = () => {
    cachedSnapshot = null;
    if (listeners.size === 0) return;
    const snapshot = rebuildSnapshot();
    for (const listener of listeners) {
      listener(snapshot);
    }
  };
  const collectDirtyLedgerEvents = () => [...dirtyEventKeys].map((eventKey) => journal.getByKey(eventKey)).filter((event) => event !== void 0).map(toHostCostEventInput);
  const syncLedger = () => {
    if (repository.commit) {
      repository.commit?.(collectDirtyLedgerEvents());
      return;
    }
    repository.replaceAll(journal.list().map(toHostCostEventInput));
  };
  const flushPending = () => {
    if (batchDepth > 0) return;
    if (ledgerDirty) {
      syncLedger();
      try {
        afterLedgerCommit?.();
      } catch (error) {
        onAfterLedgerCommitError?.(error);
      }
      ledgerDirty = false;
      dirtyEventKeys.clear();
    }
    if (snapshotDirty) {
      emitSnapshot();
      snapshotDirty = false;
    }
  };
  const upsert = (event) => {
    const previous = journal.getByKey(event.eventKey);
    const current = journal.upsert(event);
    if (sameCostEvent(previous, current)) return false;
    readModel.upsert(current);
    ledgerDirty = true;
    dirtyEventKeys.add(current.eventKey);
    snapshotDirty = true;
    flushPending();
    return true;
  };
  const handleProjection = (payload) => {
    if (!installed) {
      return;
    }
    const input = parsePayload(payload);
    const projection = projectionAdapter.fromTokenMeter(input.projection);
    const eventInput = createEstimateInput(input, metadataAdapter.fromRequest(input.metadata), projection);
    if (!eventInput) {
      return;
    }
    const outcome = normalizeOutcome(input.raw.requestOutcome ?? input.raw.outcome);
    const kind = pricingKind(eventInput.provider, eventInput.model);
    const event = kind === "deepseek" ? estimateDeepSeekCostEvent(eventInput) : kind === "xai" ? estimateXaiCostEvent(eventInput) : kind ? estimateProviderCostEvent({ ...eventInput, provider: eventInput.provider ?? kind }) : createUnknownCostEvent(eventInput, {
      source: "stream",
      usage: projection ? toCoreProjection(projection) : void 0,
      requestOutcome: outcome
    });
    upsert(outcome === "failed" || outcome === "aborted" ? { ...event, status: "failed", requestOutcome: outcome } : event);
  };
  const handleFinalUsage = (payload) => {
    if (!installed) {
      return;
    }
    const input = parsePayload(payload);
    const usage = input.hasUsage ? usageAdapter.fromAssistantUsage(input.usage) : void 0;
    const activeRequestCleared = clearActiveRequest2(input.metadata);
    const eventInput = createFinalizeInput(input, metadataAdapter.fromRequest(input.metadata), usage, journal.list());
    if (!eventInput) {
      emitSnapshot();
      return;
    }
    const kind = pricingKind(eventInput.provider, eventInput.model);
    const event = kind === "deepseek" ? finalizeDeepSeekCostEvent(eventInput) : kind === "xai" ? finalizeXaiCostEvent(eventInput) : kind ? finalizeProviderCostEvent({ ...eventInput, provider: eventInput.provider ?? kind }) : createUnknownCostEvent(eventInput, {
      source: "final_usage",
      usage: usage ? toCoreUsage(usage) : void 0,
      requestOutcome: eventInput.requestOutcome,
      previousEvent: eventInput.previousEvent
    });
    const eventChanged = upsert(event);
    if (activeRequestCleared && !eventChanged) {
      snapshotDirty = true;
      flushPending();
    }
  };
  const handleActiveRequest = (payload) => {
    if (!installed) {
      return;
    }
    const active = parseActiveRequest(payload, metadataAdapter);
    if (!active) {
      return;
    }
    if (active.action === "clear") {
      const previous = activeRequests.get(active.eventKey);
      if (activeRequests.delete(active.eventKey) && previous) bumpActiveRequestGeneration(previous.sessionId);
    } else {
      const previous = activeRequests.get(active.eventKey);
      activeRequests.set(active.eventKey, active.request);
      if (previous?.sessionId && previous.sessionId !== active.request.sessionId) {
        bumpActiveRequestGeneration(previous.sessionId);
      }
      bumpActiveRequestGeneration(active.request.sessionId);
    }
    snapshotDirty = true;
    flushPending();
  };
  const clearActiveRequest2 = (metadata) => {
    const identity = createIdentity(metadata);
    if (!identity) {
      return false;
    }
    const eventKey = createCostEventKey(identity);
    const previous = activeRequests.get(eventKey);
    const deleted = activeRequests.delete(eventKey);
    if (deleted && previous) bumpActiveRequestGeneration(previous.sessionId);
    return deleted;
  };
  cleanups.push(dsh.on(PROJECTION_EVENT, handleProjection));
  cleanups.push(dsh.on(FINAL_USAGE_EVENT, handleFinalUsage));
  cleanups.push(dsh.on(ACTIVE_REQUEST_EVENT, handleActiveRequest));
  function aggregateLedger() {
    return aggregator.aggregate(journal.list().map(toHostCostEventInput));
  }
  const remote = {
    getSnapshot() {
      const configuredProviders = readProviders();
      const currentContextFingerprint = cachedSnapshot && contextBreakdown ? contextFingerprint(Object.keys(cachedSnapshot.details), contextBreakdown) : "";
      if (cachedSnapshot === null || cachedProviderFingerprint !== providerFingerprint(configuredProviders) || cachedContextFingerprint !== currentContextFingerprint) {
        return rebuildSnapshot(configuredProviders);
      }
      return cachedSnapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async listSessions() {
      return deepFreeze(createRemoteSessionSummaries(
        journal.list(),
        aggregateLedger(),
        latestExchangeRate,
        activeRequests,
        (sessionId) => readModel.getSessionEvents(sessionId)
      ));
    },
    async getSessionDetail(sessionId) {
      return getCachedSessionDetail(sessionId);
    },
    async getSessionCostTree() {
      return deepFreeze(buildSessionCostTree({
        aggregation: aggregateLedger(),
        events: journal.list(),
        details: remote.getSnapshot().details
      }));
    },
    async getCostAnalytics() {
      return deepFreeze(createHostCostAnalyticsReport(journal.list().map(toHostCostEventInput)));
    },
    async exportLedger(format) {
      return exportCostEventLedger({
        format,
        events: journal.list().map(toHostCostEventInput)
      });
    },
    async getBalance() {
      if (balance) {
        const nextBalance = toRemoteBalance(await balance());
        if (!sameRemoteBalance(lastBalance, nextBalance)) {
          lastBalance = nextBalance;
          emitSnapshot();
        }
      }
      return lastBalance;
    },
    async refreshExchangeRate() {
      latestExchangeRate = { ...latestExchangeRate, status: "loading", error: null };
      exchangeRateGeneration += 1;
      emitSnapshot();
      try {
        const result = await (configuredExchangeRate ?? fetchLatestUsdCnyRate)();
        if (!Number.isFinite(result.rate) || result.rate <= 0) {
          throw new Error("\u6C47\u7387\u63A5\u53E3\u8FD4\u56DE\u4E86\u65E0\u6548\u6C47\u7387");
        }
        latestExchangeRate = {
          status: "fresh",
          baseCurrency: "USD",
          quoteCurrency: "CNY",
          rate: result.rate,
          fetchedAt: result.fetchedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
          source: result.source ?? "Frankfurter ECB",
          error: null
        };
      } catch (error) {
        latestExchangeRate = {
          ...latestExchangeRate,
          status: "error",
          error: error instanceof Error ? error.message : "\u67E5\u8BE2\u6C47\u7387\u5931\u8D25"
        };
      }
      exchangeRateGeneration += 1;
      emitSnapshot();
      return latestExchangeRate;
    },
    async getSettings() {
      return {
        priceProvider: "catalog",
        priceProviders: [...listPriceCatalogProviders()],
        remoteDtoVersion: "dsh-cost-meter-0.1"
      };
    }
  };
  return {
    remote,
    events() {
      return journal.list();
    },
    ledger() {
      return aggregateLedger().global;
    },
    aggregation: aggregateLedger,
    batch(callback) {
      batchDepth += 1;
      try {
        return callback();
      } finally {
        batchDepth -= 1;
        flushPending();
      }
    },
    uninstall() {
      if (!installed) {
        return;
      }
      installed = false;
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
      activeRequests.clear();
      listeners.clear();
    }
  };
}
function sameCostEvent(left, right) {
  if (!left) return false;
  const keys = /* @__PURE__ */ new Set([
    ...Object.keys(left),
    ...Object.keys(right)
  ]);
  return [...keys].every((key) => Object.is(left[key], right[key]));
}
function parsePayload(payload) {
  const raw = asRecord2(payload);
  const usage = raw.usage ?? raw.finalUsage ?? raw.assistantUsage;
  return {
    raw,
    metadata: asRecord2(raw.metadata ?? raw.request ?? raw),
    projection: asRecord2(raw.projection ?? raw.tokenProjection ?? raw.tokenMeter ?? raw.usageProjection),
    usage: asRecord2(usage),
    hasUsage: usage !== void 0 && usage !== null
  };
}
function parseActiveRequest(payload, metadataAdapter) {
  const raw = asRecord2(payload);
  const metadata = asRecord2(raw.metadata ?? raw.request ?? raw);
  const identity = createIdentity(metadata);
  if (!identity) {
    return null;
  }
  const eventKey = createCostEventKey(identity);
  const action = asText2(raw.action);
  if (action === "clear") {
    return { action, eventKey };
  }
  const startedAt = toIsoDateInput(asDateInput(
    raw.requestStartedAt ?? raw.request_started_at ?? raw.startedAt ?? raw.started_at ?? metadata.requestStartedAt ?? metadata.request_started_at
  ));
  if (!startedAt) {
    return null;
  }
  const lastActivityAt = toIsoDateInput(asDateInput(raw.lastActivityAt ?? raw.last_activity_at)) ?? startedAt;
  const requestMetadata2 = metadataAdapter.fromRequest(metadata);
  return {
    action: "upsert",
    eventKey,
    request: {
      ...identity,
      eventKey,
      requestStartedAt: startedAt,
      lastActivityAt,
      provider: requestMetadata2.provider,
      model: requestMetadata2.model,
      reasoningEffort: requestMetadata2.reasoningEffort,
      agentPreset: requestMetadata2.agentPreset
    }
  };
}
function createEstimateInput(input, metadata, projection) {
  const base = createBaseCostInput(input, metadata, "estimate");
  if (!base) {
    return null;
  }
  return {
    ...base,
    completedAt: asDateInput(input.raw.completedAt ?? input.raw.completed_at) ?? void 0,
    usageProjection: projection ? toCoreProjection(projection) : void 0
  };
}
function createFinalizeInput(input, metadata, usage, previousEvents) {
  const base = createBaseCostInput(input, metadata, "final");
  if (!base) {
    return null;
  }
  const key = createCostEventKey(base);
  const previousEvent = previousEvents.find((event) => event.eventKey === key);
  return {
    ...base,
    completedAt: asDateInput(input.raw.completedAt ?? input.raw.completed_at) ?? void 0,
    ...usage ? { usage: toCoreUsage(usage) } : {},
    previousEvent: previousEvent?.source === "stream" ? previousEvent : void 0,
    requestOutcome: normalizeOutcome(input.raw.requestOutcome ?? input.raw.outcome)
  };
}
function createBaseCostInput(input, metadata, phase) {
  const identity = createIdentity(input.metadata);
  if (!identity) {
    return null;
  }
  const requestStartedAt = asDateInput(
    input.raw.requestStartedAt ?? input.raw.request_started_at ?? input.raw.startedAt ?? input.raw.started_at ?? input.raw.createdAt ?? input.raw.created_at ?? input.metadata.requestStartedAt ?? input.metadata.request_started_at
  );
  if (requestStartedAt === null) {
    return null;
  }
  const eventKey = createCostEventKey(identity);
  return {
    ...identity,
    id: `${asText2(input.raw.id ?? input.raw.requestId ?? eventKey, eventKey)}:${phase}`,
    provider: metadata.provider,
    model: metadata.model,
    requestStartedAt,
    reasoningEffort: metadata.reasoningEffort,
    agentPreset: metadata.agentPreset,
    parentSessionId: asOptionalText(input.metadata.parentSessionId ?? input.metadata.parent_session_id)
  };
}
function createIdentity(metadata) {
  const sessionId = asOptionalText(metadata.sessionId ?? metadata.session_id);
  const turnId = asOptionalText(metadata.turnId ?? metadata.turn_id);
  const stepId = asOptionalText(metadata.stepId ?? metadata.step_id);
  const attemptId = asOptionalText(metadata.attemptId ?? metadata.attempt_id);
  if (!sessionId || !turnId || !stepId || !attemptId) {
    return null;
  }
  return { sessionId, turnId, stepId, attemptId };
}
function pricingKind(provider, model) {
  return resolvePricingCatalogKind(provider, model);
}
function toCoreProjection(projection) {
  return {
    cacheHitTokens: projection.cacheHitTokens,
    cacheMissTokens: projection.cacheMissTokens,
    outputTokens: projection.outputTokens,
    reasoningTokens: projection.reasoningTokens,
    ...projection.cacheWriteTokens !== void 0 ? { cacheWriteTokens: projection.cacheWriteTokens } : {},
    reliable: projection.isReliable
  };
}
function toCoreUsage(usage) {
  return {
    cacheHitTokens: usage.cacheHitTokens,
    cacheMissTokens: usage.cacheMissTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    ...usage.cacheWriteTokens !== void 0 ? { cacheWriteTokens: usage.cacheWriteTokens } : {}
  };
}
function toHostCostEventInput(event) {
  return {
    id: event.id,
    sessionId: event.sessionId,
    turnId: event.turnId,
    stepId: event.stepId,
    attemptId: event.attemptId,
    parentSessionId: event.parentSessionId,
    requestStartedAt: event.requestStartedAt,
    completedAt: event.completedAt,
    status: event.status,
    ...event.requestOutcome ? { requestOutcome: event.requestOutcome } : {},
    amountMicroCny: toNumber(event.amountMicroCny),
    currency: event.currency ?? "CNY",
    ...event.amountMinor !== void 0 ? { amountMinor: toNumber(event.amountMinor) } : {},
    ...event.cacheHitMinor !== void 0 ? { cacheHitMinor: toNumber(event.cacheHitMinor) } : {},
    ...event.cacheMissMinor !== void 0 ? { cacheMissMinor: toNumber(event.cacheMissMinor) } : {},
    ...event.outputMinor !== void 0 ? { outputMinor: toNumber(event.outputMinor) } : {},
    ...event.cacheHitRateMinorPerMillionTokens !== void 0 ? { cacheHitRateMinorPerMillionTokens: toNumber(event.cacheHitRateMinorPerMillionTokens) } : {},
    ...event.cacheMissRateMinorPerMillionTokens !== void 0 ? { cacheMissRateMinorPerMillionTokens: toNumber(event.cacheMissRateMinorPerMillionTokens) } : {},
    ...event.outputRateMinorPerMillionTokens !== void 0 ? { outputRateMinorPerMillionTokens: toNumber(event.outputRateMinorPerMillionTokens) } : {},
    source: event.source,
    provider: event.provider,
    model: event.model,
    reasoningEffort: event.reasoningEffort,
    agentPreset: event.agentPreset,
    pricingZone: event.pricingZone,
    cacheHitTokens: toNumber(event.cacheHitTokens),
    cacheMissTokens: toNumber(event.cacheMissTokens),
    ...event.cacheWriteTokens !== void 0 ? { cacheWriteTokens: toNumber(event.cacheWriteTokens) } : {},
    outputTokens: toNumber(event.outputTokens),
    reasoningTokens: toNumber(event.reasoningTokens),
    hitRateMicroCny: toNumber(event.cacheHitMicroCny),
    missRateMicroCny: toNumber(event.cacheMissMicroCny),
    outputRateMicroCny: toNumber(event.outputMicroCny),
    cacheHitRateMicroCnyPerMillionTokens: toNumber(event.cacheHitRateMicroCnyPerMillionTokens ?? 0n),
    cacheMissRateMicroCnyPerMillionTokens: toNumber(event.cacheMissRateMicroCnyPerMillionTokens ?? 0n),
    outputRateMicroCnyPerMillionTokens: toNumber(event.outputRateMicroCnyPerMillionTokens ?? 0n),
    priceVersion: event.priceVersion
  };
}
function toCoreCostEvent(event) {
  if (isLegacyZeroTokenArtifact(event)) {
    return null;
  }
  const kind = pricingKind(event.provider, event.model);
  if (!kind) {
    return createUnknownCostEvent({
      id: event.id,
      provider: event.provider,
      sessionId: event.sessionId,
      turnId: event.turnId,
      stepId: event.stepId,
      attemptId: event.attemptId,
      model: event.model,
      reasoningEffort: event.reasoningEffort,
      agentPreset: event.agentPreset,
      parentSessionId: event.parentSessionId !== "unknown" ? event.parentSessionId : void 0,
      requestStartedAt: event.requestStartedAt,
      completedAt: event.completedAt !== "unknown" ? event.completedAt : void 0
    }, {
      source: "restored",
      usage: {
        cacheHitTokens: event.cacheHitTokens,
        cacheMissTokens: event.cacheMissTokens,
        ...event.cacheWriteTokens !== void 0 ? { cacheWriteTokens: event.cacheWriteTokens } : {},
        outputTokens: event.outputTokens,
        reasoningTokens: event.reasoningTokens
      },
      requestOutcome: event.requestOutcome
    });
  }
  const restoredUnitPrices = resolveRestoredUnitPrices(event);
  const legacyXaiNativeFields = restoreLegacyXaiNativeFields(event, kind);
  const coreEvent = {
    id: event.id,
    eventKey: event.eventKey,
    sessionId: event.sessionId,
    turnId: event.turnId,
    stepId: event.stepId,
    attemptId: event.attemptId,
    provider: event.provider,
    model: event.model,
    reasoningEffort: event.reasoningEffort,
    agentPreset: event.agentPreset,
    ...event.parentSessionId !== "unknown" ? { parentSessionId: event.parentSessionId } : {},
    requestStartedAt: event.requestStartedAt,
    ...event.completedAt !== "unknown" ? { completedAt: event.completedAt } : {},
    status: event.status,
    source: event.source === "projection" ? "stream" : event.source,
    ...event.requestOutcome ? { requestOutcome: event.requestOutcome } : {},
    pricingZone: event.pricingZone,
    priceVersion: legacyXaiNativeFields?.priceVersion ?? event.priceVersion,
    amountMicroCny: BigInt(event.amountMicroCny),
    currency: legacyXaiNativeFields?.currency ?? event.currency ?? "CNY",
    amountMinor: BigInt(Math.round(legacyXaiNativeFields?.amountMinor ?? event.amountMinor ?? event.amountMicroCny)),
    cacheHitMinor: BigInt(Math.round(legacyXaiNativeFields?.cacheHitMinor ?? event.cacheHitMinor ?? event.hitRateMicroCny)),
    cacheMissMinor: BigInt(Math.round(legacyXaiNativeFields?.cacheMissMinor ?? event.cacheMissMinor ?? event.missRateMicroCny)),
    outputMinor: BigInt(Math.round(legacyXaiNativeFields?.outputMinor ?? event.outputMinor ?? event.outputRateMicroCny)),
    cacheHitRateMinorPerMillionTokens: BigInt(Math.round(legacyXaiNativeFields?.cacheHitRate ?? event.cacheHitRateMinorPerMillionTokens ?? event.cacheHitRateMicroCnyPerMillionTokens)),
    cacheMissRateMinorPerMillionTokens: BigInt(Math.round(legacyXaiNativeFields?.cacheMissRate ?? event.cacheMissRateMinorPerMillionTokens ?? event.cacheMissRateMicroCnyPerMillionTokens)),
    outputRateMinorPerMillionTokens: BigInt(Math.round(legacyXaiNativeFields?.outputRate ?? event.outputRateMinorPerMillionTokens ?? event.outputRateMicroCnyPerMillionTokens)),
    cacheHitMicroCny: BigInt(event.hitRateMicroCny),
    cacheMissMicroCny: BigInt(event.missRateMicroCny),
    outputMicroCny: BigInt(event.outputRateMicroCny),
    cacheHitRateMicroCnyPerMillionTokens: restoredUnitPrices.cacheHit,
    cacheMissRateMicroCnyPerMillionTokens: restoredUnitPrices.cacheMiss,
    outputRateMicroCnyPerMillionTokens: restoredUnitPrices.output,
    cacheHitTokens: BigInt(event.cacheHitTokens),
    cacheMissTokens: BigInt(event.cacheMissTokens),
    ...event.cacheWriteTokens !== void 0 ? { cacheWriteTokens: BigInt(event.cacheWriteTokens) } : {},
    outputTokens: BigInt(event.outputTokens),
    reasoningTokens: BigInt(event.reasoningTokens),
    reasoningTokensIncludedInOutput: true
  };
  if (event.status === "settled") {
    return coreEvent;
  }
  const estimate = kind === "xai" ? calculateXaiUsageCost({
    model: coreEvent.model,
    usage: {
      cacheHitTokens: coreEvent.cacheHitTokens,
      cacheMissTokens: coreEvent.cacheMissTokens,
      ...coreEvent.cacheWriteTokens !== void 0 ? { cacheWriteTokens: coreEvent.cacheWriteTokens } : {},
      outputTokens: coreEvent.outputTokens,
      reasoningTokens: coreEvent.reasoningTokens
    },
    requestOutcome: coreEvent.requestOutcome
  }) : kind !== "deepseek" ? calculateProviderUsageCost({
    provider: event.provider,
    model: coreEvent.model,
    usage: {
      cacheHitTokens: coreEvent.cacheHitTokens,
      cacheMissTokens: coreEvent.cacheMissTokens,
      ...coreEvent.cacheWriteTokens !== void 0 ? { cacheWriteTokens: coreEvent.cacheWriteTokens } : {},
      outputTokens: coreEvent.outputTokens,
      reasoningTokens: coreEvent.reasoningTokens
    },
    requestOutcome: coreEvent.requestOutcome
  }) : calculateDeepSeekUsageCost({
    model: coreEvent.model,
    requestStartedAt: coreEvent.requestStartedAt,
    pricingZone: coreEvent.pricingZone,
    usage: {
      cacheHitTokens: coreEvent.cacheHitTokens,
      cacheMissTokens: coreEvent.cacheMissTokens,
      ...coreEvent.cacheWriteTokens !== void 0 ? { cacheWriteTokens: coreEvent.cacheWriteTokens } : {},
      outputTokens: coreEvent.outputTokens,
      reasoningTokens: coreEvent.reasoningTokens
    },
    requestOutcome: coreEvent.requestOutcome
  });
  return {
    ...coreEvent,
    pricingZone: estimate.pricingZone,
    priceVersion: estimate.priceVersion,
    amountMicroCny: estimate.amountMicroCny,
    cacheHitMicroCny: estimate.cacheHitMicroCny,
    cacheMissMicroCny: estimate.cacheMissMicroCny,
    outputMicroCny: estimate.outputMicroCny,
    cacheHitRateMicroCnyPerMillionTokens: estimate.cacheHitRateMicroCnyPerMillionTokens,
    cacheMissRateMicroCnyPerMillionTokens: estimate.cacheMissRateMicroCnyPerMillionTokens,
    outputRateMicroCnyPerMillionTokens: estimate.outputRateMicroCnyPerMillionTokens,
    ...estimate.currency ? { currency: estimate.currency } : {},
    ...estimate.amountMinor !== void 0 ? { amountMinor: estimate.amountMinor } : {},
    ...estimate.cacheHitMinor !== void 0 ? { cacheHitMinor: estimate.cacheHitMinor } : {},
    ...estimate.cacheMissMinor !== void 0 ? { cacheMissMinor: estimate.cacheMissMinor } : {},
    ...estimate.outputMinor !== void 0 ? { outputMinor: estimate.outputMinor } : {},
    ...estimate.cacheHitRateMinorPerMillionTokens !== void 0 ? { cacheHitRateMinorPerMillionTokens: estimate.cacheHitRateMinorPerMillionTokens } : {},
    ...estimate.cacheMissRateMinorPerMillionTokens !== void 0 ? { cacheMissRateMinorPerMillionTokens: estimate.cacheMissRateMinorPerMillionTokens } : {},
    ...estimate.outputRateMinorPerMillionTokens !== void 0 ? { outputRateMinorPerMillionTokens: estimate.outputRateMinorPerMillionTokens } : {},
    status: estimate.status === "failed" ? "failed" : "estimated",
    unknownReason: void 0
  };
}
var LEGACY_XAI_FIXED_RATE_VERSION = /^(xai-official-pricing-\d{4}-\d{2}-\d{2}-usd)-cny-(\d+(?:\.\d+)?)$/;
function restoreLegacyXaiNativeFields(event, kind) {
  if (kind !== "xai" || event.currency !== "CNY") return null;
  const match = LEGACY_XAI_FIXED_RATE_VERSION.exec(event.priceVersion);
  const exchangeRate = Number(match?.[2]);
  if (!match || !Number.isFinite(exchangeRate) || exchangeRate <= 0) return null;
  const toUsdMinor = (microCny) => Math.round(microCny / exchangeRate);
  const cacheHitMinor = toUsdMinor(event.hitRateMicroCny);
  const cacheMissMinor = toUsdMinor(event.missRateMicroCny);
  const outputMinor = toUsdMinor(event.outputRateMicroCny);
  const compatibilityBucketTotal = event.hitRateMicroCny + event.missRateMicroCny + event.outputRateMicroCny;
  return {
    currency: "USD",
    priceVersion: match[1],
    amountMinor: compatibilityBucketTotal === event.amountMicroCny ? cacheHitMinor + cacheMissMinor + outputMinor : toUsdMinor(event.amountMicroCny),
    cacheHitMinor,
    cacheMissMinor,
    outputMinor,
    cacheHitRate: toUsdMinor(event.cacheHitRateMicroCnyPerMillionTokens),
    cacheMissRate: toUsdMinor(event.cacheMissRateMicroCnyPerMillionTokens),
    outputRate: toUsdMinor(event.outputRateMicroCnyPerMillionTokens)
  };
}
function isLegacyZeroTokenArtifact(event) {
  return (event.status === "unknown" || event.status === "estimated") && event.source === "final_usage" && event.completedAt === "unknown" && event.requestOutcome === void 0 && event.amountMicroCny === 0 && event.cacheHitTokens === 0 && event.cacheMissTokens === 0 && event.outputTokens === 0 && event.reasoningTokens === 0;
}
function resolveRestoredUnitPrices(event) {
  const current = calculateUnitPrices(
    event.provider,
    event.model,
    event.requestStartedAt,
    event.pricingZone,
    providerQuoteInputTokens(event.cacheHitTokens, event.cacheMissTokens)
  );
  const usesCurrentPriceVersion = event.priceVersion === current.priceVersion;
  return {
    cacheHit: restoreUnitPrice(
      event.cacheHitRateMicroCnyPerMillionTokens,
      event.hitRateMicroCny,
      event.cacheHitTokens,
      usesCurrentPriceVersion ? current.cacheHit : 0n
    ),
    cacheMiss: restoreUnitPrice(
      event.cacheMissRateMicroCnyPerMillionTokens,
      event.missRateMicroCny,
      event.cacheMissTokens,
      usesCurrentPriceVersion ? current.cacheMiss : 0n
    ),
    output: restoreUnitPrice(
      event.outputRateMicroCnyPerMillionTokens,
      event.outputRateMicroCny,
      event.outputTokens,
      usesCurrentPriceVersion ? current.output : 0n
    )
  };
}
function restoreUnitPrice(stored, amount, tokens, current) {
  if (stored > 0) return BigInt(stored);
  if (current > 0n) return current;
  if (amount <= 0 || tokens <= 0) return 0n;
  return (BigInt(amount) * 1000000n + BigInt(tokens) / 2n) / BigInt(tokens);
}
function providerQuoteInputTokens(cacheHitTokens, cacheMissTokens) {
  return BigInt(cacheHitTokens) + BigInt(cacheMissTokens);
}
function calculateUnitPrices(provider, model, requestStartedAt, pricingZone, inputTokens = 0n) {
  if (pricingKind(provider, model) === "xai") {
    const result = createXaiPriceDirectory().lookup({ model, inputTokens });
    return result.ok ? {
      priceVersion: result.quote.priceVersion,
      cacheHit: result.quote.cacheHitMicroCnyPerMillionTokens,
      cacheMiss: result.quote.cacheMissMicroCnyPerMillionTokens,
      output: result.quote.outputMicroCnyPerMillionTokens
    } : { priceVersion: result.priceVersion, cacheHit: 0n, cacheMiss: 0n, output: 0n };
  }
  const kind = pricingKind(provider, model);
  if (!kind) {
    return { priceVersion: "", cacheHit: 0n, cacheMiss: 0n, output: 0n };
  }
  if (kind && kind !== "deepseek") {
    const quote2 = lookupAdditionalPrice(provider ?? kind, model, inputTokens);
    return quote2 ? {
      priceVersion: quote2.priceVersion,
      cacheHit: quote2.rates.cacheHitMicroCnyPerMillionTokens,
      cacheMiss: quote2.rates.cacheMissMicroCnyPerMillionTokens,
      output: quote2.rates.outputMicroCnyPerMillionTokens
    } : { priceVersion: "", cacheHit: 0n, cacheMiss: 0n, output: 0n };
  }
  const quote = calculateDeepSeekUsageCost({
    model,
    requestStartedAt,
    pricingZone,
    usage: {
      cacheHitTokens: 1e6,
      cacheMissTokens: 1e6,
      outputTokens: 1e6,
      reasoningTokens: 0
    }
  });
  return {
    priceVersion: quote.priceVersion,
    cacheHit: quote.cacheHitRateMicroCnyPerMillionTokens,
    cacheMiss: quote.cacheMissRateMicroCnyPerMillionTokens,
    output: quote.outputRateMicroCnyPerMillionTokens
  };
}
function unitPricesForEvent(event) {
  const current = calculateUnitPrices(
    event.provider,
    event.model,
    event.requestStartedAt,
    event.pricingZone,
    providerQuoteInputTokens(event.cacheHitTokens, event.cacheMissTokens)
  );
  const mayUseCurrent = event.priceVersion === current.priceVersion;
  return {
    cacheHit: toRemoteUnitPrice(
      mayUseCurrent ? current.cacheHit : event.cacheHitRateMicroCnyPerMillionTokens ?? 0n
    ),
    cacheMiss: toRemoteUnitPrice(
      mayUseCurrent ? current.cacheMiss : event.cacheMissRateMicroCnyPerMillionTokens ?? 0n
    ),
    output: toRemoteUnitPrice(
      mayUseCurrent ? current.output : event.outputRateMicroCnyPerMillionTokens ?? 0n
    )
  };
}
function unitPricesForEvents(events) {
  const resolved = {
    cacheHit: null,
    cacheMiss: null,
    output: null
  };
  for (const event of events) {
    const candidate = unitPricesForEvent(event);
    resolved.cacheHit ??= candidate.cacheHit;
    resolved.cacheMiss ??= candidate.cacheMiss;
    resolved.output ??= candidate.output;
    if (resolved.cacheHit !== null && resolved.cacheMiss !== null && resolved.output !== null) break;
  }
  return resolved;
}
function toRemoteUnitPrice(value) {
  return value > 0n ? toNumber(value) : null;
}
function eventCurrency(event) {
  if (event.currency) return event.currency;
  return pricingKind(event.provider, event.model) && pricingKind(event.provider, event.model) !== "deepseek" ? "USD" : "CNY";
}
function eventMinor(event) {
  return event.amountMinor ?? event.amountMicroCny;
}
function eventBucketMinor(event, bucket) {
  if (bucket === "hit") return event.cacheHitMinor ?? event.cacheHitMicroCny;
  if (bucket === "miss") return event.cacheMissMinor ?? event.cacheMissMicroCny;
  return event.outputMinor ?? event.outputMicroCny;
}
function eventRateMinor(event, bucket) {
  if (bucket === "hit") return event.cacheHitRateMinorPerMillionTokens ?? event.cacheHitRateMicroCnyPerMillionTokens ?? 0n;
  if (bucket === "miss") return event.cacheMissRateMinorPerMillionTokens ?? event.cacheMissRateMicroCnyPerMillionTokens ?? 0n;
  return event.outputRateMinorPerMillionTokens ?? event.outputRateMicroCnyPerMillionTokens ?? 0n;
}
function aggregateCurrencyTotals(events) {
  const totals = /* @__PURE__ */ new Map();
  for (const event of events) {
    const currency = eventCurrency(event);
    const current = totals.get(currency) ?? { currency, amountMinor: 0, settledMinor: 0, estimatedMinor: 0, failedMinor: 0 };
    const amount = toNumber(eventMinor(event));
    if (amount === 0 && event.status === "unknown") continue;
    current.amountMinor += amount;
    if (event.status === "settled") current.settledMinor += amount;
    if (event.status === "estimated") current.estimatedMinor += amount;
    if (event.status === "failed") current.failedMinor += amount;
    totals.set(currency, current);
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
function aggregateNativeStage(events) {
  const currency = eventCurrency(events[0]);
  const sameCurrency = events.every((event) => eventCurrency(event) === currency);
  const relevant = sameCurrency ? events : events.filter((event) => eventCurrency(event) === currency);
  const totalMinor = relevant.reduce((sum, event) => sum + toNumber(eventMinor(event)), 0);
  const settledMinor = relevant.filter((event) => event.status === "settled").reduce((sum, event) => sum + toNumber(eventMinor(event)), 0);
  const estimatedMinor = relevant.filter((event) => event.status === "estimated").reduce((sum, event) => sum + toNumber(eventMinor(event)), 0);
  const bucketRate = (bucket) => {
    const rates = relevant.filter((event) => (bucket === "hit" ? event.cacheHitTokens : bucket === "miss" ? event.cacheMissTokens : event.outputTokens) > 0n).map((event) => toNumber(eventRateMinor(event, bucket)));
    return rates.length === 0 || new Set(rates).size > 1 ? null : rates[0] ?? null;
  };
  return {
    currency,
    totalMinor,
    settledMinor,
    estimatedMinor,
    cacheHitMinor: relevant.reduce((sum, event) => sum + toNumber(eventBucketMinor(event, "hit")), 0),
    cacheMissMinor: relevant.reduce((sum, event) => sum + toNumber(eventBucketMinor(event, "miss")), 0),
    outputMinor: relevant.reduce((sum, event) => sum + toNumber(eventBucketMinor(event, "output")), 0),
    cacheHitRate: bucketRate("hit"),
    cacheMissRate: bucketRate("miss"),
    outputRate: bucketRate("output")
  };
}
function nativeRemoteFields(currency, amountMinor, unitPriceMinorPerMillionTokens) {
  return currency === "CNY" ? {} : { currency, amountMinor, unitPriceMinorPerMillionTokens };
}
function legacyCnyToUsdMinor(value) {
  return Math.round(value * 1e6 / 72e5);
}
function cnyEquivalentMicroCny(totals, exchangeRate) {
  if (totals.length === 0) return 0;
  if (totals.some((total) => total.currency === "USD") && !exchangeRate.rate) return null;
  const cny = totals.reduce((sum, total) => {
    if (total.currency === "CNY") return sum + total.amountMinor;
    if (total.currency === "USD") return sum + total.amountMinor * (exchangeRate.rate ?? 0);
    return sum;
  }, 0);
  return Math.round(cny);
}
function providerFingerprint(providers) {
  return JSON.stringify(providers.map((provider) => [
    provider.id,
    provider.name,
    provider.balanceSupported
  ]));
}
function deepFreeze(value, seen = /* @__PURE__ */ new WeakSet()) {
  if (value === null || typeof value !== "object") return value;
  const object2 = value;
  if (seen.has(object2)) return value;
  seen.add(object2);
  for (const nested of Object.values(value)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
}
function contextFingerprint(sessionIds, readContext) {
  return JSON.stringify([...sessionIds].sort().map((sessionId) => [sessionId, readContext(sessionId)]));
}
function cloneRemoteContextBreakdown(value) {
  return value ? {
    systemTokens: value.systemTokens,
    toolsTokens: value.toolsTokens,
    messageTokens: value.messageTokens
  } : null;
}
function createRemoteSnapshot(events, aggregation, balance, exchangeRate, contextBreakdown, activeRequests = /* @__PURE__ */ new Map(), configuredProviders = [], eventsBySession) {
  const latest = [...events].sort(compareEventActivity).at(-1) ?? null;
  const currentSession = latest ? aggregation.sessions.get(latest.sessionId) : void 0;
  const globalCurrencyTotals = aggregateCurrencyTotals(events);
  const sessions = createRemoteSessionSummaries(events, aggregation, exchangeRate, activeRequests, eventsBySession);
  const details = {};
  for (const [sessionId, summary] of aggregation.sessions.entries()) {
    details[sessionId] = toRemoteSessionDetail(
      sessionId,
      summary,
      eventsBySession?.(sessionId) ?? events.filter((event) => event.sessionId === sessionId),
      contextBreakdown?.(sessionId) ?? null,
      exchangeRate
    );
  }
  const snapshot = {
    connection: { status: "connected", message: null },
    currentSessionId: latest?.sessionId ?? null,
    summary: {
      status: { code: latest ? toMeterStatus(latest) : "idle" },
      provider: latest?.provider ?? aggregation.global.provider,
      model: latest?.model ?? aggregation.global.model,
      reasoningEffort: latest?.reasoningEffort ?? aggregation.global.reasoningEffort,
      agentPreset: latest?.agentPreset ?? aggregation.global.agentPreset,
      currentRequestMicroCny: latest?.status === "estimated" ? toNumber(latest.amountMicroCny) : 0,
      sessionTotalMicroCny: currentSession?.totalMicroCny ?? 0,
      settledTotalMicroCny: aggregation.global.settledMicroCny,
      estimatedTotalMicroCny: aggregation.global.estimatedMicroCny,
      localTotalMicroCny: aggregation.global.totalMicroCny,
      pricingZone: latest?.pricingZone ?? "unknown",
      currencyTotals: globalCurrencyTotals,
      cnyEquivalentMicroCny: cnyEquivalentMicroCny(globalCurrencyTotals, exchangeRate),
      ...globalCurrencyTotals.length === 1 ? {
        currency: globalCurrencyTotals[0].currency,
        currentRequestMinor: latest?.status === "estimated" ? toNumber(eventMinor(latest)) : 0,
        sessionTotalMinor: globalCurrencyTotals[0].amountMinor
      } : {}
    },
    exchangeRate,
    balance,
    balances: createRemoteProviderBalances(configuredProviders, events, balance),
    sessions,
    details
  };
  return withActiveRequestSnapshot(snapshot, events, aggregation, contextBreakdown, activeRequests);
}
function createRemoteSessionSummaries(events, aggregation, exchangeRate, activeRequests = /* @__PURE__ */ new Map(), eventsBySession) {
  const sessions = [...aggregation.sessions.entries()].map(
    ([sessionId, summary]) => toRemoteSessionSummary(
      sessionId,
      summary,
      eventsBySession?.(sessionId) ?? events.filter((event) => event.sessionId === sessionId),
      exchangeRate
    )
  );
  return withActiveRequestSessionSummaries(sessions, events, aggregation, activeRequests);
}
function createRemoteSessionDetail(sessionId, summary, sessionEvents, exchangeRate, contextBreakdown, active) {
  const detail = summary ? toRemoteSessionDetail(sessionId, summary, sessionEvents, contextBreakdown, exchangeRate) : null;
  if (!active) return detail;
  const activeEvent = sessionEvents.find((event) => event.eventKey === active.eventKey) ?? null;
  return toActiveSessionDetail(active, activeEvent, detail, summary, contextBreakdown);
}
function createRemoteProviderBalances(configuredProviders, events, balance) {
  const providers = configuredProviders.length > 0 ? configuredProviders : uniqueEventProviders(events);
  const seen = /* @__PURE__ */ new Set();
  const balances = [];
  for (const provider of providers) {
    const id = provider.id.trim();
    const normalized = id.toLowerCase();
    if (!id || normalized === "unknown" || seen.has(normalized)) continue;
    seen.add(normalized);
    balances.push({
      provider: id,
      providerName: provider.name.trim() || id,
      supported: provider.balanceSupported,
      ...provider.balanceSupported ? balance : unavailableRemoteBalance()
    });
  }
  return balances;
}
function uniqueEventProviders(events) {
  const seen = /* @__PURE__ */ new Set();
  const providers = [];
  for (const event of events) {
    const id = event.provider.trim();
    const normalized = id.toLowerCase();
    if (!id || normalized === "unknown" || seen.has(normalized)) continue;
    seen.add(normalized);
    providers.push({
      id,
      name: id,
      balanceSupported: false
    });
  }
  return providers;
}
function unavailableRemoteBalance() {
  return {
    status: "unavailable",
    currency: null,
    totalMicroCny: null,
    grantedMicroCny: null,
    toppedUpMicroCny: null,
    refreshedAt: null
  };
}
function withActiveRequestSessionSummaries(baseSessions, events, aggregation, activeRequests) {
  const active = latestActiveRequest([...activeRequests.values()].filter(isSupportedPricingRequest));
  if (!active) {
    return [...baseSessions];
  }
  const activeEvent = events.find((event) => event.eventKey === active.eventKey) ?? null;
  const sessionSummary = aggregation.sessions.get(active.sessionId);
  const currentRequestMicroCny = activeEvent?.status === "estimated" ? toNumber(activeEvent.amountMicroCny) : 0;
  const sessionTotalMicroCny = sessionSummary?.totalMicroCny ?? currentRequestMicroCny;
  const existingSession = baseSessions.find((session) => session.id === active.sessionId);
  const sessions = baseSessions.filter((session) => session.id !== active.sessionId);
  sessions.push({
    id: active.sessionId,
    title: existingSession?.title ?? active.sessionId,
    provider: active.provider,
    model: active.model,
    reasoningEffort: active.reasoningEffort,
    agentPreset: active.agentPreset,
    status: "billing",
    currentRequestMicroCny,
    sessionTotalMicroCny,
    unknownCount: existingSession?.unknownCount ?? sessionSummary?.unknownCount ?? 0,
    lastActivityAt: active.lastActivityAt,
    ...existingSession?.currencyTotals ? { currencyTotals: existingSession.currencyTotals } : {},
    ...existingSession?.currency ? { currency: existingSession.currency } : {},
    ...existingSession?.currentRequestMinor !== void 0 ? { currentRequestMinor: existingSession.currentRequestMinor } : {},
    ...existingSession?.sessionTotalMinor !== void 0 ? { sessionTotalMinor: existingSession.sessionTotalMinor } : {},
    ...existingSession?.cnyEquivalentMicroCny !== void 0 ? { cnyEquivalentMicroCny: existingSession.cnyEquivalentMicroCny } : {}
  });
  sessions.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  return sessions;
}
function withActiveRequestSnapshot(snapshot, events, aggregation, contextBreakdown, activeRequests) {
  const active = latestActiveRequest([...activeRequests.values()].filter(isSupportedPricingRequest));
  if (!active) {
    return snapshot;
  }
  const activeEvent = events.find((event) => event.eventKey === active.eventKey) ?? null;
  const sessionSummary = aggregation.sessions.get(active.sessionId);
  const currentRequestMicroCny = activeEvent?.status === "estimated" ? toNumber(activeEvent.amountMicroCny) : 0;
  const sessionTotalMicroCny = sessionSummary?.totalMicroCny ?? currentRequestMicroCny;
  const pricingZone = activeEvent?.pricingZone ?? "unknown";
  const existingSession = snapshot.sessions.find((session) => session.id === active.sessionId);
  const sessions = snapshot.sessions.filter((session) => session.id !== active.sessionId);
  sessions.push({
    id: active.sessionId,
    title: existingSession?.title ?? active.sessionId,
    provider: active.provider,
    model: active.model,
    reasoningEffort: active.reasoningEffort,
    agentPreset: active.agentPreset,
    status: "billing",
    currentRequestMicroCny,
    sessionTotalMicroCny,
    unknownCount: existingSession?.unknownCount ?? sessionSummary?.unknownCount ?? 0,
    lastActivityAt: active.lastActivityAt,
    ...existingSession?.currencyTotals ? { currencyTotals: existingSession.currencyTotals } : {},
    ...existingSession?.currency ? { currency: existingSession.currency } : {},
    ...existingSession?.currentRequestMinor !== void 0 ? { currentRequestMinor: existingSession.currentRequestMinor } : {},
    ...existingSession?.sessionTotalMinor !== void 0 ? { sessionTotalMinor: existingSession.sessionTotalMinor } : {},
    ...existingSession?.cnyEquivalentMicroCny !== void 0 ? { cnyEquivalentMicroCny: existingSession.cnyEquivalentMicroCny } : {}
  });
  sessions.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  const details = { ...snapshot.details };
  details[active.sessionId] = toActiveSessionDetail(
    active,
    activeEvent,
    details[active.sessionId] ?? null,
    sessionSummary,
    contextBreakdown?.(active.sessionId) ?? null
  );
  return {
    ...snapshot,
    currentSessionId: active.sessionId,
    summary: {
      ...snapshot.summary,
      status: { code: "billing" },
      provider: active.provider,
      model: active.model,
      reasoningEffort: active.reasoningEffort,
      agentPreset: active.agentPreset,
      currentRequestMicroCny,
      sessionTotalMicroCny,
      pricingZone
    },
    sessions,
    details
  };
}
function latestActiveRequest(activeRequests) {
  return [...activeRequests].sort((a, b) => Date.parse(a.lastActivityAt) - Date.parse(b.lastActivityAt)).at(-1) ?? null;
}
function isSupportedPricingRequest(request) {
  return pricingKind(request.provider, request.model) !== null;
}
function toActiveSessionDetail(active, activeEvent, existing, summary, liveContextBreakdown) {
  const currentRequestMicroCny = activeEvent?.status === "estimated" ? toNumber(activeEvent.amountMicroCny) : 0;
  const sessionTotalMicroCny = summary?.totalMicroCny ?? currentRequestMicroCny;
  const tokenBuckets = existing?.tokenBuckets ?? emptyTokenBuckets();
  const turns = activeEvent ? existing?.turns ?? [toAggregatedRemoteTurn([activeEvent])] : mergeActiveRemoteTurn(existing?.turns ?? [], active, currentRequestMicroCny);
  const stages = activeEvent ? existing?.stages ?? [toActiveRemoteStage(active, currentRequestMicroCny, tokenBuckets, liveContextBreakdown)] : mergeActiveRemoteStage(existing?.stages ?? [], active, currentRequestMicroCny, liveContextBreakdown);
  return {
    id: active.sessionId,
    title: existing?.title ?? active.sessionId,
    provider: active.provider,
    model: active.model,
    reasoningEffort: active.reasoningEffort,
    agentPreset: active.agentPreset,
    status: "billing",
    pricingZone: activeEvent?.pricingZone ?? "unknown",
    currentRequestMicroCny,
    sessionTotalMicroCny,
    settledTotalMicroCny: existing?.settledTotalMicroCny ?? summary?.settledMicroCny ?? 0,
    estimatedTotalMicroCny: existing?.estimatedTotalMicroCny ?? summary?.estimatedMicroCny ?? currentRequestMicroCny,
    unknownCount: existing?.unknownCount ?? summary?.unknownCount ?? 0,
    tokenBuckets,
    contextBreakdown: liveContextBreakdown ?? existing?.contextBreakdown ?? null,
    turns,
    stages,
    currencyTotals: existing?.currencyTotals ?? [],
    cnyEquivalentMicroCny: existing?.cnyEquivalentMicroCny ?? null
  };
}
function toActiveRemoteTurn(active, currentRequestMicroCny) {
  const currency = pricingKind(active.provider, active.model) && pricingKind(active.provider, active.model) !== "deepseek" ? "USD" : "CNY";
  return {
    id: active.eventKey,
    label: active.turnId,
    startedAt: active.requestStartedAt,
    completedAt: null,
    status: "billing",
    pricingZone: "unknown",
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    amountMicroCny: currentRequestMicroCny,
    note: "\u7B49\u5F85 usage",
    ...currency === "USD" ? { currency, amountMinor: legacyCnyToUsdMinor(currentRequestMicroCny) } : {}
  };
}
function toActiveRemoteStage(active, currentRequestMicroCny, tokenBuckets, contextBreakdown, index = 1) {
  const kind = pricingKind(active.provider, active.model);
  const supportsPricing = kind !== null;
  const nativeCurrency = kind && kind !== "deepseek" ? "USD" : "CNY";
  const toNative = (value) => nativeCurrency === "USD" && value !== null ? legacyCnyToUsdMinor(value) : value;
  const pricingZone = kind === "deepseek" ? resolveDeepSeekPricingZone(active.requestStartedAt) : "unknown";
  const unitPrices = supportsPricing ? calculateUnitPrices(active.provider, active.model, active.requestStartedAt, pricingZone) : null;
  return {
    id: `${active.sessionId}-active-${active.turnId}-${active.stepId}-${active.attemptId}`,
    index,
    isCurrent: true,
    startedAt: active.requestStartedAt,
    completedAt: null,
    lastActivityAt: active.lastActivityAt,
    status: "billing",
    model: active.model,
    reasoningEffort: active.reasoningEffort,
    agentPreset: active.agentPreset,
    pricingZone,
    priceVersion: supportsPricing ? unitPrices?.priceVersion ?? "" : "",
    exchangeRateLabel: kind && kind !== "deepseek" ? USD_CNY_EXCHANGE_RATE_LABEL : null,
    ...nativeCurrency === "USD" ? { currency: nativeCurrency } : {},
    ...nativeCurrency === "USD" ? {
      currentRequestMinor: toNative(currentRequestMicroCny) ?? 0,
      totalMinor: toNative(currentRequestMicroCny) ?? 0,
      settledTotalMinor: 0,
      estimatedTotalMinor: toNative(currentRequestMicroCny) ?? 0
    } : {},
    currentRequestMicroCny,
    totalMicroCny: currentRequestMicroCny,
    settledTotalMicroCny: 0,
    estimatedTotalMicroCny: currentRequestMicroCny,
    unknownCount: 0,
    tokenBuckets: tokenBuckets.map((bucket) => ({
      ...bucket,
      unitPriceMicroCnyPerMillionTokens: unitPrices === null ? null : bucket.label === "\u7F13\u5B58\u547D\u4E2D" ? toRemoteUnitPrice(unitPrices.cacheHit) : bucket.label === "\u7F13\u5B58\u672A\u547D\u4E2D" ? toRemoteUnitPrice(unitPrices.cacheMiss) : toRemoteUnitPrice(unitPrices.output),
      ...nativeRemoteFields(
        nativeCurrency,
        0,
        toNative(bucket.label === "\u7F13\u5B58\u547D\u4E2D" ? toRemoteUnitPrice(unitPrices?.cacheHit ?? 0n) : bucket.label === "\u7F13\u5B58\u672A\u547D\u4E2D" ? toRemoteUnitPrice(unitPrices?.cacheMiss ?? 0n) : toRemoteUnitPrice(unitPrices?.output ?? 0n))
      )
    })),
    turns: [toActiveRemoteTurn(active, currentRequestMicroCny)],
    contextBreakdown
  };
}
function emptyTokenBuckets() {
  return [
    { label: "\u7F13\u5B58\u547D\u4E2D", tokens: 0, amountMicroCny: 0 },
    { label: "\u7F13\u5B58\u672A\u547D\u4E2D", tokens: 0, amountMicroCny: 0 },
    { label: "\u8F93\u51FA", tokens: 0, amountMicroCny: 0 },
    { label: "\u5176\u4E2D\u63A8\u7406", tokens: 0, amountMicroCny: 0 }
  ];
}
function toRemoteSessionSummary(sessionId, summary, events, exchangeRate) {
  const latest = latestEvent(events.filter((event) => event.sessionId === sessionId));
  const sessionEvents = events.filter((event) => event.sessionId === sessionId);
  const currencyTotals = aggregateCurrencyTotals(sessionEvents);
  const native = latest ? eventCurrency(latest) : currencyTotals[0]?.currency ?? "CNY";
  const nativeTotal = currencyTotals.length === 1 ? currencyTotals[0]?.amountMinor ?? 0 : void 0;
  const nativeCurrent = latest?.status === "estimated" ? toNumber(eventMinor(latest)) : 0;
  return {
    id: sessionId,
    title: sessionId,
    provider: summary.provider,
    model: summary.model,
    reasoningEffort: summary.reasoningEffort,
    agentPreset: summary.agentPreset,
    status: latest ? toMeterStatus(latest) : "idle",
    currentRequestMicroCny: latest?.status === "estimated" ? toNumber(latest.amountMicroCny) : 0,
    sessionTotalMicroCny: summary.totalMicroCny,
    unknownCount: summary.unknownCount,
    lastActivityAt: summary.lastSeenAt,
    currencyTotals,
    ...currencyTotals.length === 1 ? { currency: native, currentRequestMinor: nativeCurrent, sessionTotalMinor: nativeTotal ?? 0 } : {},
    ...currencyTotals.length > 1 ? { cnyEquivalentMicroCny: cnyEquivalentMicroCny(currencyTotals, exchangeRate) } : {}
  };
}
function toRemoteSessionDetail(sessionId, summary, events, contextBreakdown, exchangeRate) {
  const latest = latestEvent(events);
  const tokenBucketCosts = aggregateTokenBucketCosts(events);
  const native = aggregateNativeStage(events);
  const unitPrices = summarizeSessionUnitPrices(groupSessionStageEvents(events));
  return {
    id: sessionId,
    title: sessionId,
    provider: summary.provider,
    model: summary.model,
    reasoningEffort: summary.reasoningEffort,
    agentPreset: summary.agentPreset,
    status: latest ? toMeterStatus(latest) : "idle",
    pricingZone: latest?.pricingZone ?? "unknown",
    currentRequestMicroCny: latest?.status === "estimated" ? toNumber(latest.amountMicroCny) : 0,
    sessionTotalMicroCny: summary.totalMicroCny,
    settledTotalMicroCny: summary.settledMicroCny,
    estimatedTotalMicroCny: summary.estimatedMicroCny,
    unknownCount: summary.unknownCount,
    tokenBuckets: [
      {
        label: "\u7F13\u5B58\u547D\u4E2D",
        tokens: summary.cacheHitTokens,
        amountMicroCny: toNumber(tokenBucketCosts.cacheHitMicroCny),
        unitPriceMicroCnyPerMillionTokens: unitPrices.cacheHit.value,
        ...nativeRemoteFields(native.currency, native.cacheHitMinor, native.cacheHitRate),
        ...unitPrices.cacheHit.mixed ? { unitPriceMixed: true } : {}
      },
      {
        label: "\u7F13\u5B58\u672A\u547D\u4E2D",
        tokens: summary.cacheMissTokens,
        amountMicroCny: toNumber(tokenBucketCosts.cacheMissMicroCny),
        unitPriceMicroCnyPerMillionTokens: unitPrices.cacheMiss.value,
        ...nativeRemoteFields(native.currency, native.cacheMissMinor, native.cacheMissRate),
        ...unitPrices.cacheMiss.mixed ? { unitPriceMixed: true } : {}
      },
      {
        label: "\u8F93\u51FA",
        tokens: summary.outputTokens,
        amountMicroCny: toNumber(tokenBucketCosts.outputMicroCny),
        unitPriceMicroCnyPerMillionTokens: unitPrices.output.value,
        ...nativeRemoteFields(native.currency, native.outputMinor, native.outputRate),
        ...unitPrices.output.mixed ? { unitPriceMixed: true } : {}
      },
      {
        label: "\u5176\u4E2D\u63A8\u7406",
        tokens: summary.reasoningTokens,
        amountMicroCny: 0,
        unitPriceMicroCnyPerMillionTokens: unitPrices.output.value,
        ...nativeRemoteFields(native.currency, 0, native.outputRate)
      }
    ],
    contextBreakdown,
    turns: toRemoteTurns(events),
    stages: buildRemoteSessionStages(sessionId, events, contextBreakdown),
    currencyTotals: aggregateCurrencyTotals(events),
    cnyEquivalentMicroCny: cnyEquivalentMicroCny(aggregateCurrencyTotals(events), exchangeRate)
  };
}
function buildRemoteSessionStages(sessionId, events, liveContextBreakdown) {
  const grouped = groupSessionStageEvents(events);
  return grouped.map((stageEvents, index) => {
    const isCurrent = index === grouped.length - 1;
    const latest = latestEvent(stageEvents);
    const first = stageEvents[0];
    const tokenBucketCosts = aggregateTokenBucketCosts(stageEvents);
    const summary = aggregateStageSummary(stageEvents);
    const native = aggregateNativeStage(stageEvents);
    const unitPrices = unitPricesForEvents(stageEvents);
    return {
      id: `${sessionId}-stage-${index + 1}`,
      index: index + 1,
      isCurrent,
      startedAt: first.requestStartedAt,
      // A stage describes the requests that were actually billed under one
      // configuration. Its end is the last request activity, rather than the
      // next stage's start, so idle gaps are not shown as active stage time.
      completedAt: isCurrent ? null : latest ? eventActivityIso(latest) : first.requestStartedAt,
      lastActivityAt: latest ? eventActivityIso(latest) : first.requestStartedAt,
      status: latest ? toMeterStatus(latest) : "idle",
      model: first.model,
      reasoningEffort: first.reasoningEffort ?? "unknown",
      agentPreset: first.agentPreset ?? "unknown",
      pricingZone: first.pricingZone,
      priceVersion: first.priceVersion,
      exchangeRateLabel: pricingKind(first.provider, first.model) !== "deepseek" && pricingKind(first.provider, first.model) !== null ? USD_CNY_EXCHANGE_RATE_LABEL : null,
      ...native.currency === "CNY" ? {} : {
        currency: native.currency,
        currentRequestMinor: latest?.status === "estimated" ? toNumber(eventMinor(latest)) : 0,
        totalMinor: native.totalMinor,
        settledTotalMinor: native.settledMinor,
        estimatedTotalMinor: native.estimatedMinor
      },
      currentRequestMicroCny: latest?.status === "estimated" ? toNumber(latest.amountMicroCny) : 0,
      totalMicroCny: summary.totalMicroCny,
      settledTotalMicroCny: summary.settledTotalMicroCny,
      estimatedTotalMicroCny: summary.estimatedTotalMicroCny,
      unknownCount: summary.unknownCount,
      tokenBuckets: [
        {
          label: "\u7F13\u5B58\u547D\u4E2D",
          tokens: summary.cacheHitTokens,
          amountMicroCny: toNumber(tokenBucketCosts.cacheHitMicroCny),
          unitPriceMicroCnyPerMillionTokens: unitPrices.cacheHit,
          ...nativeRemoteFields(native.currency, native.cacheHitMinor, native.cacheHitRate)
        },
        {
          label: "\u7F13\u5B58\u672A\u547D\u4E2D",
          tokens: summary.cacheMissTokens,
          amountMicroCny: toNumber(tokenBucketCosts.cacheMissMicroCny),
          unitPriceMicroCnyPerMillionTokens: unitPrices.cacheMiss,
          ...nativeRemoteFields(native.currency, native.cacheMissMinor, native.cacheMissRate)
        },
        {
          label: "\u8F93\u51FA",
          tokens: summary.outputTokens,
          amountMicroCny: toNumber(tokenBucketCosts.outputMicroCny),
          unitPriceMicroCnyPerMillionTokens: unitPrices.output,
          ...nativeRemoteFields(native.currency, native.outputMinor, native.outputRate)
        },
        {
          label: "\u5176\u4E2D\u63A8\u7406",
          tokens: summary.reasoningTokens,
          amountMicroCny: 0,
          unitPriceMicroCnyPerMillionTokens: unitPrices.output,
          ...nativeRemoteFields(native.currency, 0, native.outputRate)
        }
      ],
      turns: toRemoteTurns(stageEvents),
      contextBreakdown: stageContextBreakdown(stageEvents, isCurrent, liveContextBreakdown)
    };
  });
}
function groupSessionStageEvents(events) {
  const grouped = [];
  for (const event of [...events].sort(compareEventStart)) {
    const current = grouped.at(-1);
    if (!current || stageBoundaryKey(current[0]) !== stageBoundaryKey(event)) {
      grouped.push([event]);
    } else {
      current.push(event);
    }
  }
  return grouped;
}
function summarizeSessionUnitPrices(groups) {
  return {
    cacheHit: summarizeBucketUnitPrice(groups, "cacheHit", (event) => event.cacheHitTokens),
    cacheMiss: summarizeBucketUnitPrice(groups, "cacheMiss", (event) => event.cacheMissTokens),
    output: summarizeBucketUnitPrice(groups, "output", (event) => event.outputTokens)
  };
}
function summarizeBucketUnitPrice(groups, bucket, tokensForEvent) {
  const consumingGroups = groups.filter((group) => group.some((event) => tokensForEvent(event) > 0n));
  if (consumingGroups.length === 0) return { value: null, mixed: false };
  const values = consumingGroups.map((group) => unitPricesForEvents(group)[bucket]);
  if (values.length === 0 || values.some((value) => value === null)) {
    return { value: null, mixed: false };
  }
  const distinct = new Set(values);
  return distinct.size === 1 ? { value: values[0], mixed: false } : { value: null, mixed: true };
}
function stageBoundaryKey(event) {
  const kind = pricingKind(event.provider, event.model);
  const providerRateTier = kind !== null && kind !== "deepseek" ? (() => {
    const unitPrices = calculateUnitPrices(
      event.provider,
      event.model,
      event.requestStartedAt,
      event.pricingZone,
      providerQuoteInputTokens(event.cacheHitTokens, event.cacheMissTokens)
    );
    return [unitPrices.cacheHit, unitPrices.cacheMiss, unitPrices.output].map(String).join(":");
  })() : "";
  return [
    event.model,
    event.reasoningEffort ?? "unknown",
    event.agentPreset ?? "unknown",
    event.pricingZone,
    event.priceVersion,
    providerRateTier
  ].join("");
}
function aggregateStageSummary(events) {
  return events.reduce(
    (summary, event) => {
      const amountMicroCny = toNumber(event.amountMicroCny);
      summary.cacheHitTokens += toNumber(event.cacheHitTokens);
      summary.cacheMissTokens += toNumber(event.cacheMissTokens);
      summary.outputTokens += toNumber(event.outputTokens);
      summary.reasoningTokens += toNumber(event.reasoningTokens);
      if (event.status === "settled") {
        summary.settledTotalMicroCny += amountMicroCny;
        summary.totalMicroCny += amountMicroCny;
      } else if (event.status === "failed") {
        summary.totalMicroCny += amountMicroCny;
      } else if (event.status === "estimated") {
        summary.estimatedTotalMicroCny += amountMicroCny;
        summary.totalMicroCny += amountMicroCny;
      } else if (event.status === "unknown") {
        summary.unknownCount += 1;
      }
      return summary;
    },
    {
      totalMicroCny: 0,
      settledTotalMicroCny: 0,
      estimatedTotalMicroCny: 0,
      unknownCount: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0
    }
  );
}
function stageContextBreakdown(events, isCurrent, liveContextBreakdown) {
  const latest = latestEvent(events);
  const eventContext = latest ? readEventContextBreakdown(latest) : null;
  if (eventContext) {
    return eventContext;
  }
  return isCurrent ? liveContextBreakdown : null;
}
function readEventContextBreakdown(event) {
  const value = event.contextBreakdown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const candidate = value;
  return isNonNegativeNumber(candidate.systemTokens) && isNonNegativeNumber(candidate.toolsTokens) && isNonNegativeNumber(candidate.messageTokens) ? {
    systemTokens: candidate.systemTokens,
    toolsTokens: candidate.toolsTokens,
    messageTokens: candidate.messageTokens
  } : null;
}
function aggregateTokenBucketCosts(events) {
  return events.reduce(
    (bucket, event) => ({
      cacheHitMicroCny: bucket.cacheHitMicroCny + event.cacheHitMicroCny,
      cacheMissMicroCny: bucket.cacheMissMicroCny + event.cacheMissMicroCny,
      outputMicroCny: bucket.outputMicroCny + event.outputMicroCny
    }),
    {
      cacheHitMicroCny: 0n,
      cacheMissMicroCny: 0n,
      outputMicroCny: 0n
    }
  );
}
function toRemoteTurns(events) {
  const grouped = /* @__PURE__ */ new Map();
  for (const event of [...events].sort(compareEventStart)) {
    const key = event.turnId === "unknown" ? event.eventKey : event.turnId;
    const turnEvents = grouped.get(key) ?? [];
    turnEvents.push(event);
    grouped.set(key, turnEvents);
  }
  return [...grouped.values()].map(toAggregatedRemoteTurn);
}
function toAggregatedRemoteTurn(events) {
  const sorted = [...events].sort(compareEventStart);
  const first = sorted[0];
  const latest = latestEvent(sorted) ?? first;
  const hasActiveEstimatedRequest = sorted.some(
    (event) => event.status === "estimated" && (!event.completedAt || event.completedAt === "unknown")
  );
  const completedAt = hasActiveEstimatedRequest ? null : latest.completedAt && latest.completedAt !== "unknown" ? latest.completedAt : null;
  const pricingZones = new Set(sorted.map((event) => event.pricingZone));
  return {
    id: first.turnId === "unknown" ? first.eventKey : `${first.sessionId}:turn:${first.turnId}`,
    label: first.turnId,
    startedAt: first.requestStartedAt,
    completedAt,
    status: hasActiveEstimatedRequest ? "billing" : toMeterStatus(latest),
    pricingZone: pricingZones.size === 1 ? latest.pricingZone : "unknown",
    cacheHitTokens: sumEventValues(sorted, (event) => event.cacheHitTokens),
    cacheMissTokens: sumEventValues(sorted, (event) => event.cacheMissTokens),
    outputTokens: sumEventValues(sorted, (event) => event.outputTokens),
    reasoningTokens: sumEventValues(sorted, (event) => event.reasoningTokens),
    amountMicroCny: sumEventValues(sorted, (event) => event.amountMicroCny),
    note: latest.unknownReason ?? null,
    currency: eventCurrency(first),
    amountMinor: toNumber(sorted.reduce((sum, event) => sum + eventMinor(event), 0n))
  };
}
function mergeActiveRemoteTurn(turns, active, currentRequestMicroCny) {
  const activeTurn = toActiveRemoteTurn(active, currentRequestMicroCny);
  const existingIndex = turns.findIndex((turn) => turn.label === active.turnId);
  if (existingIndex < 0) {
    return [...turns, activeTurn];
  }
  return turns.map((turn, index) => index === existingIndex ? {
    ...turn,
    completedAt: null,
    status: "billing",
    amountMicroCny: turn.amountMicroCny + currentRequestMicroCny,
    note: activeTurn.note
  } : turn);
}
function mergeActiveRemoteStage(stages, active, currentRequestMicroCny, contextBreakdown) {
  const currentIndex = stages.length - 1;
  const current = stages[currentIndex];
  if (current && isSameActiveStage(current, active)) {
    return stages.map((stage, index) => index === currentIndex ? {
      ...stage,
      isCurrent: true,
      completedAt: null,
      lastActivityAt: active.lastActivityAt,
      status: "billing",
      currentRequestMicroCny,
      totalMicroCny: stage.totalMicroCny + currentRequestMicroCny,
      estimatedTotalMicroCny: stage.estimatedTotalMicroCny + currentRequestMicroCny,
      turns: mergeActiveRemoteTurn(stage.turns, active, currentRequestMicroCny),
      contextBreakdown: contextBreakdown ?? stage.contextBreakdown
    } : stage);
  }
  const historicalStages = stages.map((stage) => ({
    ...stage,
    isCurrent: false,
    completedAt: stage.completedAt ?? active.requestStartedAt
  }));
  return [
    ...historicalStages,
    toActiveRemoteStage(
      active,
      currentRequestMicroCny,
      emptyTokenBuckets(),
      contextBreakdown,
      historicalStages.length + 1
    )
  ];
}
function isSameActiveStage(stage, active) {
  const sameMetadata = stage.model === active.model && stage.reasoningEffort === active.reasoningEffort && stage.agentPreset === active.agentPreset;
  if (!sameMetadata) return false;
  const kind = pricingKind(active.provider, active.model);
  if (kind !== "deepseek") {
    const currentPriceVersion = calculateUnitPrices(active.provider, active.model, active.requestStartedAt, "unknown").priceVersion;
    return stage.pricingZone === "unknown" && stage.priceVersion === currentPriceVersion;
  }
  return stage.pricingZone === resolveDeepSeekPricingZone(active.requestStartedAt) && stage.priceVersion === DEEPSEEK_PRICE_VERSION;
}
function sumEventValues(events, select) {
  return toNumber(events.reduce((total, event) => total + select(event), 0n));
}
function latestEvent(events) {
  return [...events].sort(compareEventActivity).at(-1) ?? null;
}
function compareEventActivity(a, b) {
  return activityTime(a) - activityTime(b);
}
function compareEventStart(a, b) {
  const startDelta = Date.parse(a.requestStartedAt) - Date.parse(b.requestStartedAt);
  if (startDelta !== 0) {
    return startDelta;
  }
  return a.eventKey.localeCompare(b.eventKey);
}
function activityTime(event) {
  return Date.parse(event.completedAt ?? event.requestStartedAt);
}
function eventActivityIso(event) {
  return event.completedAt ?? event.requestStartedAt;
}
function toMeterStatus(event) {
  if (event.requestOutcome === "aborted") {
    return "aborted";
  }
  if (event.status === "unknown") {
    return "unknown";
  }
  if (event.status === "estimated") {
    return event.completedAt ? "unknown" : "billing";
  }
  return event.status;
}
function sameRemoteBalance(left, right) {
  const sameValues = left.status === right.status && left.currency === right.currency && left.totalMicroCny === right.totalMicroCny && left.grantedMicroCny === right.grantedMicroCny && left.toppedUpMicroCny === right.toppedUpMicroCny;
  if (!sameValues) return false;
  const emptyUnavailable = left.status === "unavailable" && left.totalMicroCny === null && left.grantedMicroCny === null && left.toppedUpMicroCny === null;
  return emptyUnavailable || left.refreshedAt === right.refreshedAt;
}
function toRemoteBalance(balance) {
  const balanceWithMicro = balance;
  if (hasExplicitMicroCnyBalance(balanceWithMicro)) {
    return {
      status: balanceWithMicro.status,
      currency: normalizeRemoteBalanceCurrency(balanceWithMicro.currency),
      totalMicroCny: toNullableNumber(balanceWithMicro.totalMicroCny),
      grantedMicroCny: toNullableNumber(balanceWithMicro.grantedMicroCny),
      toppedUpMicroCny: toNullableNumber(balanceWithMicro.toppedUpMicroCny),
      refreshedAt: toBalanceRefreshedAt(balanceWithMicro)
    };
  }
  if (isLegacyBalanceSnapshot(balance)) {
    return {
      status: balance.status,
      currency: normalizeRemoteBalanceCurrency(balance.currency),
      totalMicroCny: cnyToMicroCny(balance.total),
      grantedMicroCny: cnyToMicroCny(balance.granted),
      toppedUpMicroCny: cnyToMicroCny(balance.toppedUp),
      refreshedAt: toBalanceRefreshedAt(balance)
    };
  }
  return {
    status: balance.status,
    currency: null,
    totalMicroCny: null,
    grantedMicroCny: null,
    toppedUpMicroCny: null,
    refreshedAt: null
  };
}
function normalizeRemoteBalanceCurrency(currency) {
  return typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "CNY";
}
async function fetchLatestUsdCnyRate() {
  if (typeof fetch !== "function") {
    throw new Error("\u5F53\u524D\u8FD0\u884C\u73AF\u5883\u4E0D\u652F\u6301\u67E5\u8BE2\u6C47\u7387");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8e3);
  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=CNY", {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`\u6C47\u7387\u63A5\u53E3\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09`);
    }
    const payload = await response.json();
    const rate = typeof payload.rates?.CNY === "number" ? payload.rates.CNY : Number(payload.rates?.CNY);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("\u6C47\u7387\u63A5\u53E3\u672A\u8FD4\u56DE USD/CNY \u6C47\u7387");
    }
    return {
      rate,
      fetchedAt: typeof payload.date === "string" ? `${payload.date}T23:59:59Z` : (/* @__PURE__ */ new Date()).toISOString(),
      source: "Frankfurter ECB"
    };
  } finally {
    clearTimeout(timeout);
  }
}
function hasExplicitMicroCnyBalance(balance) {
  return "totalMicroCny" in balance || "grantedMicroCny" in balance || "toppedUpMicroCny" in balance;
}
function isLegacyBalanceSnapshot(balance) {
  return "total" in balance || "granted" in balance || "toppedUp" in balance || "fetchedAt" in balance;
}
function toBalanceRefreshedAt(balance) {
  if ("updatedAt" in balance && typeof balance.updatedAt === "string" && balance.updatedAt.trim()) {
    return balance.updatedAt;
  }
  if ("fetchedAt" in balance && typeof balance.fetchedAt === "number" && Number.isFinite(balance.fetchedAt)) {
    return new Date(balance.fetchedAt).toISOString();
  }
  return null;
}
function cnyToMicroCny(value) {
  if (value === null || value === void 0) {
    return null;
  }
  const microCny = Math.round(value * 1e6);
  if (!Number.isSafeInteger(microCny)) {
    throw new Error("CNY balance value exceeds safe micro-CNY integer range");
  }
  return microCny;
}
function normalizeOutcome(value) {
  return value === "success" || value === "failed" || value === "aborted" ? value : void 0;
}
function asRecord2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function asDateInput(value) {
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    return value;
  }
  return null;
}
function toIsoDateInput(value) {
  if (value === null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? date.toISOString() : null;
}
function asText2(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function asOptionalText(value) {
  const text3 = asText2(value);
  return text3.length > 0 ? text3 : void 0;
}
function toNullableNumber(value) {
  return value === null || value === void 0 ? null : toNumber(value);
}
function toNumber(value) {
  if (typeof value === "number") {
    return value;
  }
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) {
    throw new Error("micro-CNY or token value exceeds safe integer range");
  }
  return numberValue;
}
function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// packages/plugin/src/history-recovery.ts
var DEFAULT_BATCH_SIZE_SESSIONS = 8;
var DEFAULT_BATCH_SIZE_EVENTS = 5e3;
function createHistoryRecovery(options) {
  const batchSizeSessions = options.batchSizeSessions ?? DEFAULT_BATCH_SIZE_SESSIONS;
  const batchSizeEvents = options.batchSizeEvents ?? DEFAULT_BATCH_SIZE_EVENTS;
  const yieldToEventLoop = options.yieldToEventLoop ?? defaultYieldToEventLoop;
  const onStatus = options.onStatus ?? (() => {
  });
  const liveSessionIds = /* @__PURE__ */ new Set();
  const controller = new AbortController();
  let started = false;
  let settled = false;
  let cancelReason = null;
  let snapshot = createStatus(batchSizeSessions, batchSizeEvents);
  const emit = (next = {}) => {
    snapshot = { ...snapshot, ...next };
    try {
      onStatus({ ...snapshot });
    } catch {
    }
  };
  const finish = (state, next = {}) => {
    settled = true;
    emit({ state, finishedAt: Date.now(), ...next });
  };
  async function run() {
    emit({ state: "listing", startedAt: Date.now(), finishedAt: null, lastError: null, cancelReason: null });
    let refs;
    try {
      refs = await options.source.list(controller.signal);
    } catch (error) {
      if (controller.signal.aborted) finish("cancelled", { cancelReason });
      else finish("failed", { lastError: errorMessage(error) });
      return;
    }
    if (controller.signal.aborted) {
      finish("cancelled", { cancelReason });
      return;
    }
    emit({ state: "running", listedSessions: refs.length });
    const batch = [];
    const previousSessionRevisions = createSessionRevisionAccumulator(options.checkpoint?.sessionRevisions);
    const committedSessionRevisions = {};
    let eventCount = 0;
    const flush = async () => {
      if (batch.length === 0) return;
      const queued = batch.splice(0, batch.length);
      const payload = queued.filter((session) => !liveSessionIds.has(session.id));
      const skippedLive = queued.length - payload.length;
      eventCount = 0;
      if (skippedLive > 0) {
        emit({ skippedLiveSessions: snapshot.skippedLiveSessions + skippedLive });
      }
      if (payload.length === 0) {
        await yieldToEventLoop();
        return;
      }
      const result = options.target.replayBatch(payload);
      commitSessionRevisions(committedSessionRevisions, payload);
      options.checkpoint?.save(committedSessionRevisions);
      emit({
        currentSessionId: payload.at(-1)?.id ?? null,
        replayedSessions: snapshot.replayedSessions + result.replayedSessions,
        skippedUnchangedSessions: snapshot.skippedUnchangedSessions + result.skippedUnchangedSessions,
        eventsSeen: snapshot.eventsSeen + result.eventsSeen,
        batches: snapshot.batches + 1
      });
      await yieldToEventLoop();
    };
    for (const [refIndex, ref] of refs.entries()) {
      if (controller.signal.aborted) {
        finish("cancelled", { cancelReason });
        return;
      }
      if (ref.live === true || ref.persisted === false) {
        emit({ currentSessionId: ref.id, skippedLiveSessions: snapshot.skippedLiveSessions + 1 });
        continue;
      }
      if (liveSessionIds.has(ref.id)) {
        emit({ currentSessionId: ref.id, skippedLiveSessions: snapshot.skippedLiveSessions + 1 });
        continue;
      }
      if (revisionMatches(previousSessionRevisions, ref.id, ref.revision)) {
        rememberSessionRevision(committedSessionRevisions, ref.id, ref.revision);
        emit({
          currentSessionId: ref.id,
          skippedUnchangedSessions: snapshot.skippedUnchangedSessions + 1
        });
        continue;
      }
      let session;
      try {
        session = await options.source.read(ref, controller.signal);
        emit({ currentSessionId: ref.id, readSessions: snapshot.readSessions + 1 });
      } catch (error) {
        if (controller.signal.aborted) {
          finish("cancelled", { cancelReason });
          return;
        }
        emit({ currentSessionId: ref.id, failedReads: snapshot.failedReads + 1, lastError: errorMessage(error) });
        continue;
      }
      if (controller.signal.aborted) {
        finish("cancelled", { cancelReason });
        return;
      }
      if (!session) {
        emit({ currentSessionId: ref.id, failedReads: snapshot.failedReads + 1, lastError: `${ref.id}: empty snapshot` });
        continue;
      }
      if (session.id !== ref.id) {
        emit({ currentSessionId: ref.id, failedReads: snapshot.failedReads + 1, lastError: `${ref.id}: snapshot id mismatch` });
        continue;
      }
      if (liveSessionIds.has(session.id)) {
        emit({ currentSessionId: session.id, skippedLiveSessions: snapshot.skippedLiveSessions + 1 });
        continue;
      }
      if (ref.revision !== void 0) {
        session = { ...session, revision: ref.revision };
      }
      if (batch.length > 0 && (batch.length >= batchSizeSessions || eventCount + session.events.length > batchSizeEvents)) {
        try {
          await flush();
        } catch (error) {
          finish("failed", { lastError: errorMessage(error) });
          return;
        }
        if (controller.signal.aborted) {
          finish("cancelled", { cancelReason });
          return;
        }
      }
      batch.push(session);
      eventCount += session.events.length;
      if (batch.length >= batchSizeSessions || eventCount >= batchSizeEvents) {
        try {
          await flush();
        } catch (error) {
          finish("failed", { lastError: errorMessage(error) });
          return;
        }
      } else if (refs.length < batchSizeSessions && refIndex + 1 < refs.length) {
        await yieldToEventLoop();
      }
    }
    try {
      await flush();
    } catch (error) {
      finish("failed", { lastError: errorMessage(error) });
      return;
    }
    try {
      options.checkpoint?.save(committedSessionRevisions);
    } catch (error) {
      finish("failed", { lastError: errorMessage(error) });
      return;
    }
    if (controller.signal.aborted) finish("cancelled", { cancelReason });
    else finish("completed");
  }
  return {
    start() {
      if (!started && !settled) {
        started = true;
        void run();
      }
    },
    markLive(sessionId) {
      if (sessionId) liveSessionIds.add(sessionId);
    },
    cancel(reason) {
      if (settled) return;
      cancelReason = reason ?? cancelReason;
      controller.abort(reason);
      if (!started) finish("cancelled", { cancelReason });
    },
    status() {
      return { ...snapshot };
    }
  };
}
function createCordisHistoryRecoverySource(ctx) {
  return {
    async list(signal) {
      const services = resolveServices(ctx);
      if (services.persistence) {
        const persistence = services.persistence;
        try {
          if (typeof persistence.listSnapshots === "function") {
            const records = await persistence.listSnapshots(signal);
            return records.flatMap((record) => {
              const ref = normalizeRef(record, "persistence");
              return ref ? [ref] : [];
            });
          }
        } catch {
        }
      }
      if (services.query) {
        try {
          const records = await services.query.listSessions(signal);
          return records.flatMap((record) => {
            const ref = normalizeRef(record, "query");
            return ref ? [ref] : [];
          });
        } catch {
        }
      }
      if (services.persistence) {
        const persistence = services.persistence;
        const records = await persistence.list(signal);
        return records.flatMap((record) => {
          const ref = normalizeRef(record, "persistence");
          return ref ? [ref] : [];
        });
      }
      return [];
    },
    async read(ref, signal) {
      const services = resolveServices(ctx);
      let raw;
      if (services.query) {
        try {
          raw = await services.query.readSession(ref.id);
        } catch {
          if (services.persistence) raw = await services.persistence.inspect(ref.id, signal);
          else throw new Error(`history read failed for ${ref.id}`);
        }
      } else if (services.persistence) raw = await services.persistence.inspect(ref.id, signal);
      else return null;
      return normalizeReplaySession(raw);
    }
  };
}
function resolveServices(ctx) {
  let query;
  let persistence;
  try {
    query = ctx.sessionQuery;
    persistence = ctx.sessionPersistence;
  } catch {
  }
  try {
    query ??= ctx.get?.("sessionQuery");
  } catch {
  }
  try {
    persistence ??= ctx.get?.("sessionPersistence");
  } catch {
  }
  return {
    ...isQuery(query) ? { query } : {},
    ...isPersistence(persistence) ? { persistence } : {}
  };
}
function isQuery(value) {
  return Boolean(value) && typeof value === "object" && typeof value.listSessions === "function" && typeof value.readSession === "function";
}
function isPersistence(value) {
  return Boolean(value) && typeof value === "object" && typeof value.list === "function" && typeof value.inspect === "function";
}
function normalizeRef(value, source) {
  const record = asRecord3(value);
  const header = asRecord3(record.header ?? record.meta ?? record);
  const id = text(header.id ?? record.id);
  return id ? {
    id,
    source,
    ...Object.keys(header).length > 0 ? { header } : {},
    ...text(record.revision) ? { revision: text(record.revision) } : {},
    ...record.live !== void 0 ? { live: record.live === true } : {},
    ...record.persisted !== void 0 ? { persisted: record.persisted !== false } : {}
  } : null;
}
function normalizeReplaySession(value) {
  const record = asRecord3(value);
  const header = asRecord3(record.session ?? record.meta ?? record.header);
  const id = text(header.id ?? record.id);
  return id && Array.isArray(record.events) ? { id, header, events: record.events } : null;
}
function asRecord3(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function createStatus(batchSizeSessions, batchSizeEvents) {
  return { state: "idle", listedSessions: 0, readSessions: 0, replayedSessions: 0, skippedLiveSessions: 0, skippedUnchangedSessions: 0, failedReads: 0, batches: 0, eventsSeen: 0, currentSessionId: null, startedAt: null, finishedAt: null, lastError: null, cancelReason: null, batchSizeSessions, batchSizeEvents };
}
async function defaultYieldToEventLoop() {
  await new Promise((resolve4) => setTimeout(resolve4, 0));
}
function createSessionRevisionAccumulator(previous) {
  const revisions = {};
  for (const [sessionId, revision] of Object.entries(previous ?? {})) {
    if (text(revision)) revisions[sessionId] = revision;
  }
  return revisions;
}
function revisionMatches(sessionRevisions, sessionId, revision) {
  return revision !== void 0 && Object.hasOwn(sessionRevisions, sessionId) && sessionRevisions[sessionId] === revision;
}
function commitSessionRevisions(sessionRevisions, sessions) {
  for (const session of sessions) {
    rememberSessionRevision(sessionRevisions, session.id, session.revision);
  }
}
function rememberSessionRevision(sessionRevisions, sessionId, revision) {
  if (revision !== void 0 && text(revision)) {
    sessionRevisions[sessionId] = revision;
  }
}

// packages/plugin/src/self-update.ts
import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
var MYMETER_UPDATE_PACKAGE_NAME = "@mymeter/dsh-cost-meter";
var MYMETER_UPDATE_RPC_CHANNEL = "/mymeter-update";
var SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
function createMyMeterPluginUpdater(dependencies) {
  const profileDir = requireNonEmptyString(dependencies.profileDir, "profileDir");
  let installQueue = Promise.resolve();
  async function checkForUpdate() {
    const current = await readCurrentPluginVersion(dependencies);
    const latestManifest = await dependencies.registry.getLatestManifest(MYMETER_UPDATE_PACKAGE_NAME);
    validateManifestPackageName(latestManifest, "registry");
    validateDshManifest(latestManifest);
    const latestVersion = readVersion(latestManifest, "registry version");
    return {
      packageName: MYMETER_UPDATE_PACKAGE_NAME,
      currentVersion: current.version,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, current.version) > 0,
      restartRequired: compareVersions(latestVersion, current.version) > 0
    };
  }
  async function installUpdate(targetVersion) {
    const version = parseVersionText(targetVersion, "target version");
    let result;
    installQueue = installQueue.catch(() => {
    }).then(async () => {
      const current = await readCurrentPluginVersion(dependencies);
      if (compareVersions(version, current.version) <= 0) {
        throw new Error("mymeter update: target version must be newer than current version");
      }
      const manifest = await readTargetManifest(dependencies, version);
      validateManifestPackageName(manifest, "registry");
      validateDshManifest(manifest);
      const manifestVersion = readVersion(manifest, "registry version");
      if (manifestVersion !== version) {
        throw new Error("mymeter update: registry manifest version does not match target version");
      }
      await dependencies.installer.installExact({
        profileDir,
        packageName: MYMETER_UPDATE_PACKAGE_NAME,
        version
      });
      result = {
        packageName: MYMETER_UPDATE_PACKAGE_NAME,
        installedVersion: version,
        restartRequired: true
      };
    });
    await installQueue;
    return result;
  }
  return { checkForUpdate, installUpdate };
}
function createMyMeterProductionUpdateDependencies(baseUrl, options = {}) {
  return {
    profileDir: profileDirFromCordisBaseUrl(baseUrl),
    readCurrentManifest: options.readCurrentManifest ?? createCurrentMyMeterManifestReader(),
    registry: options.registry ?? createMyMeterNpmRegistry({
      fetchImpl: options.fetchImpl,
      registryUrl: options.registryUrl,
      timeoutMs: options.registryTimeoutMs
    }),
    installer: options.installer ?? createPnpmMyMeterPluginInstaller({ execFile: options.execFile })
  };
}
function registerMyMeterUpdateRpc(ctx, options = {}) {
  if (!ctx.connection?.rpc || !ctx.baseUrl) return null;
  const updater = createMyMeterPluginUpdater(createMyMeterProductionUpdateDependencies(ctx.baseUrl, options));
  return ctx.connection.rpc.handle(
    MYMETER_UPDATE_RPC_CHANNEL,
    async (endpoint, payload) => dispatchUpdateRpc(updater, endpoint, payload),
    { authority: "loopback" }
  );
}
function profileDirFromCordisBaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  if (url.protocol !== "file:") {
    throw new Error("mymeter update: ctx.baseUrl must be a file baseUrl");
  }
  return stripTrailingSeparator(normalize(fileURLToPath(new URL(".", url))));
}
function createCurrentMyMeterManifestReader(packageJsonUrl = new URL("../package.json", import.meta.url)) {
  return async () => JSON.parse(await readFile(packageJsonUrl, "utf8"));
}
function createMyMeterNpmRegistry(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const registryUrl = (options.registryUrl ?? "https://registry.npmjs.org").replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? 5e3;
  return {
    getLatestManifest: (packageName) => readRegistryManifest(fetchImpl, registryUrl, packageName, "latest", timeoutMs),
    getManifest: (packageName, version) => readRegistryManifest(fetchImpl, registryUrl, packageName, version, timeoutMs)
  };
}
function createPnpmMyMeterPluginInstaller(options = {}) {
  const execFile = options.execFile ?? defaultPnpmExecFile;
  return {
    async installExact(request) {
      if (request.packageName !== MYMETER_UPDATE_PACKAGE_NAME) {
        throw new Error("mymeter update: invalid install package name");
      }
      const profileDir = requireNonEmptyString(request.profileDir, "profileDir");
      const version = parseVersionText(request.version, "target version");
      try {
        await execFile("pnpm", ["add", "--save-exact", `${MYMETER_UPDATE_PACKAGE_NAME}@${version}`], { cwd: profileDir });
      } catch {
        throw new Error("mymeter update: plugin installation failed");
      }
    }
  };
}
async function dispatchUpdateRpc(updater, endpoint, payload) {
  try {
    if (endpoint === "check") return { ok: true, value: await updater.checkForUpdate() };
    if (endpoint === "install") {
      const request = asRecord4(payload);
      if (typeof request?.version !== "string") {
        return badRequest("mymeter update: install requires an exact version");
      }
      return { ok: true, value: await updater.installUpdate(request.version) };
    }
    return badRequest("mymeter update: unknown endpoint");
  } catch (error) {
    return internalError(error instanceof Error ? error.message : "mymeter update failed");
  }
}
async function readRegistryManifest(fetchImpl, registryUrl, packageName, version, timeoutMs) {
  const timeout = createTimeoutSignal(timeoutMs);
  try {
    const response = await fetchImpl(`${registryUrl}/${encodeURIComponent(packageName)}/${version}`, {
      headers: { accept: "application/json" },
      signal: timeout.signal
    });
    if (!response.ok) {
      throw new Error("status");
    }
    return await response.json();
  } catch (error) {
    if (timeout.signal.aborted || isAbortError(error)) {
      throw new Error("mymeter update: registry request timed out");
    }
    throw new Error("mymeter update: registry request failed");
  } finally {
    timeout.dispose();
  }
}
function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
    }
  };
}
function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}
var execFileAsync = promisify(execFileCallback);
var defaultPnpmExecFile = async (file, args, options) => {
  await execFileAsync(file, [...args], options);
};
function badRequest(message) {
  return { ok: false, error: { code: "bad-request", message, details: { issues: [] } } };
}
function internalError(message) {
  return { ok: false, error: { code: "internal", message, details: {} } };
}
async function readCurrentPluginVersion(dependencies) {
  const currentManifest = await dependencies.readCurrentManifest();
  validateManifestPackageName(currentManifest, "current");
  validateDshManifest(currentManifest);
  return {
    version: readVersion(currentManifest, "current version")
  };
}
async function readTargetManifest(dependencies, version) {
  if (dependencies.registry.getManifest) {
    return dependencies.registry.getManifest(MYMETER_UPDATE_PACKAGE_NAME, version);
  }
  const manifest = await dependencies.registry.getLatestManifest(MYMETER_UPDATE_PACKAGE_NAME);
  const latestVersion = readVersion(manifest, "registry version");
  if (latestVersion !== version) {
    throw new Error("mymeter update: registry cannot verify target version");
  }
  return manifest;
}
function validateManifestPackageName(manifest, source) {
  if (manifest.name !== void 0 && manifest.name !== MYMETER_UPDATE_PACKAGE_NAME) {
    throw new Error(`mymeter update: invalid ${source} package name`);
  }
}
function validateDshManifest(manifest) {
  const dsh = asRecord4(manifest.dsh);
  const client = asRecord4(dsh?.client);
  const bundle = asRecord4(dsh?.bundle);
  if (!client) throw new Error("mymeter update: missing dsh.client");
  if (!bundle) throw new Error("mymeter update: missing dsh.bundle");
  if (typeof client.platform !== "string" || client.platform.length === 0) {
    throw new Error("mymeter update: invalid dsh.client");
  }
  if (typeof bundle.patch !== "string" || bundle.patch.length === 0) {
    throw new Error("mymeter update: invalid dsh.bundle");
  }
}
function readVersion(manifest, label) {
  if (typeof manifest.version !== "string") {
    throw new Error(`mymeter update: invalid ${label}`);
  }
  return parseVersionText(manifest.version, label);
}
function parseVersionText(version, label) {
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`mymeter update: invalid ${label}`);
  }
  return version;
}
function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  return compareNumber(a.major, b.major) || compareNumber(a.minor, b.minor) || compareNumber(a.patch, b.patch) || comparePrerelease(a.prerelease, b.prerelease);
}
function parseVersion(version) {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) throw new Error("mymeter update: invalid version");
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split(".") ?? []
  };
}
function compareNumber(left, right) {
  return left === right ? 0 : left > right ? 1 : -1;
}
function comparePrerelease(left, right) {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === void 0) return -1;
    if (b === void 0) return 1;
    const comparison = comparePrereleaseIdentifier(a, b);
    if (comparison !== 0) return comparison;
  }
  return 0;
}
function comparePrereleaseIdentifier(left, right) {
  const leftNumber = /^\d+$/.test(left) ? Number(left) : null;
  const rightNumber = /^\d+$/.test(right) ? Number(right) : null;
  if (leftNumber !== null && rightNumber !== null) return compareNumber(leftNumber, rightNumber);
  if (leftNumber !== null) return -1;
  if (rightNumber !== null) return 1;
  return left === right ? 0 : left > right ? 1 : -1;
}
function asRecord4(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`mymeter update: invalid ${label}`);
  }
  return value;
}
function stripTrailingSeparator(value) {
  if (value.length <= 1) return value;
  return value.replace(/[\\/]+$/, "");
}

// packages/plugin/src/cordis-host.ts
var ACTIVE_REQUEST_EVENT2 = "mymeter:active_request";
var STREAMING_ESTIMATE_MIN_TOKEN_STEP = 8;
var STREAMING_ESTIMATE_MIN_INTERVAL_MS = 100;
var HISTORY_RECOVERY_SOURCE_KEY = "dsh-session-history";
var HISTORY_RECOVERY_PROJECTION_VERSION = "cordis-history-v1";
var HISTORY_CHECKPOINT_REFRESH_DEBOUNCE_MS = 250;
function createMyMeterCordisHostRuntime({
  ctx,
  balance,
  providers,
  repository,
  exchangeRate,
  ledgerPath,
  ledgerFormat
}) {
  const listeners = /* @__PURE__ */ new Map();
  const sessionRefs = /* @__PURE__ */ new Map();
  const effectiveRepository = repository ?? (ledgerPath ? createCordisLedgerRepository(ctx, ledgerPath, ledgerFormat) : void 0);
  const checkpointController = ledgerPath && effectiveRepository?.ledgerFingerprint ? createCordisHistoryCheckpoint(ctx, ledgerPath, () => effectiveRepository.ledgerFingerprint?.() ?? createLedgerFingerprint(ledgerPath)) : void 0;
  let projectionService = null;
  captureOptionalProjectionService(ctx, (service) => {
    projectionService = service;
  });
  const emit = (event, payload) => {
    for (const listener of listeners.get(event) ?? []) {
      listener(payload);
    }
  };
  const dsh = {
    on(event, listener) {
      const set = listeners.get(event) ?? /* @__PURE__ */ new Set();
      set.add(listener);
      listeners.set(event, set);
      return () => set.delete(listener);
    }
  };
  const runtime = createMyMeterHostRuntime({
    dsh,
    balance,
    providers,
    repository: effectiveRepository,
    exchangeRate,
    afterLedgerCommit: checkpointController ? () => checkpointController.refreshFingerprint() : void 0,
    onAfterLedgerCommitError: (error) => {
      ctx.logger?.warn(`mymeter: history checkpoint refresh failed (${errorMessage2(error)})`);
    },
    contextBreakdown: (sessionId) => readContextBreakdown(projectionService, sessionRefs.get(sessionId))
  });
  const sessions = /* @__PURE__ */ new Map();
  const seededEventCounts = /* @__PURE__ */ new Map();
  const liveSessionIds = /* @__PURE__ */ new Set();
  const seedSession = (session) => {
    rememberSession(sessionRefs, session);
    const sessionId = text2(session?.id ?? session?.sessionId);
    const events = session.events;
    if (!sessionId || !Array.isArray(events) || events.length === 0) return false;
    const seededCount = seededEventCounts.get(sessionId) ?? 0;
    if (seededEventCounts.has(sessionId) && events.length <= seededCount) return true;
    runtime.batch(() => {
      for (const event of events.slice(seededCount)) {
        bridgeSessionEvent(sessions, emit, session, event);
      }
      seededEventCounts.set(sessionId, events.length);
    });
    return true;
  };
  const history = createHistoryRecovery({
    source: createCordisHistoryRecoverySource(ctx),
    checkpoint: checkpointController,
    target: {
      replayBatch(historySessions) {
        let replayedSessions = 0;
        let eventsSeen = 0;
        runtime.batch(() => {
          for (const session of historySessions) {
            if (liveSessionIds.has(session.id)) continue;
            seedSession({ id: session.id, header: session.header, events: session.events });
            replayedSessions += 1;
            eventsSeen += session.events.length;
          }
        });
        return { replayedSessions, skippedUnchangedSessions: 0, eventsSeen };
      }
    },
    onStatus: (status) => {
      if (status.state === "failed" && status.lastError) {
        ctx.logger?.warn(`mymeter: history recovery failed (${status.lastError})`);
      }
    }
  });
  const stopEvent = ctx.on("session/event", (session, event) => {
    const seeded = seedSession(session);
    if (seeded) {
      markLiveSession(liveSessionIds, session);
      history.markLive(text2(session?.id ?? session?.sessionId));
    } else {
      rememberSession(sessionRefs, session);
    }
    const sessionId = text2(session?.id ?? session?.sessionId);
    const events = session.events;
    if (sessionId && Array.isArray(events) && seeded) {
      if (eventIsInHistory(events, event)) return;
      bridgeSessionEvent(sessions, emit, session, event);
      return;
    }
    bridgeSessionEvent(sessions, emit, session, event);
    if (sessionId && Array.isArray(events)) {
      seededEventCounts.set(sessionId, events.length);
    }
  });
  const stopCreated = ctx.on("session/created", (session) => {
    if (seedSession(session)) {
      markLiveSession(liveSessionIds, session);
      history.markLive(text2(session?.id ?? session?.sessionId));
    }
  });
  for (const session of ctx.sessions?.list() ?? []) {
    if (seedSession(session)) {
      markLiveSession(liveSessionIds, session);
      history.markLive(text2(session?.id ?? session?.sessionId));
    }
  }
  history.start();
  const uninstall = runtime.uninstall;
  return {
    ...runtime,
    uninstall() {
      history.cancel("runtime uninstall");
      stopCreated();
      stopEvent();
      sessions.clear();
      seededEventCounts.clear();
      liveSessionIds.clear();
      sessionRefs.clear();
      listeners.clear();
      uninstall();
      checkpointController?.flush();
    }
  };
}
var name = "mymeter";
var inject = ["typert", "sessions", "credentials", "settings", "llm", "connection"];
function apply(ctx, config = {}) {
  registerSettingsNamespace(ctx);
  const repository = config.ledgerPath ? createCordisLedgerRepository(ctx, config.ledgerPath, config.ledgerFormat) : void 0;
  const balanceRuntime = config.balanceEnabled === false ? void 0 : createCordisBalanceProvider(ctx, config);
  const runtime = createMyMeterCordisHostRuntime({
    ctx,
    repository,
    balance: balanceRuntime?.provider,
    providers: () => readConfiguredProviders(ctx),
    ledgerPath: config.ledgerPath,
    ledgerFormat: config.ledgerFormat
  });
  const service = bindMyMeterTypertRemote(runtime.remote);
  const cleanups = [
    runtime.uninstall,
    balanceRuntime?.dispose ?? (() => {
    })
  ];
  const unregisterUpdateRpc = registerMyMeterUpdateRpc(ctx, config.update);
  if (unregisterUpdateRpc) cleanups.push(unregisterUpdateRpc);
  const unprovide = ctx.reflect?.provide("mymeter", service);
  if (typeof unprovide === "function") cleanups.push(unprovide);
  cleanups.push(ctx.typert?.register(MYMETER_LOCAL_TYPERT_CONTRIBUTION) ?? (() => {
  }));
  const uninstall = async () => {
    let firstError;
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        await cleanup();
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError !== void 0) throw firstError;
  };
  if (ctx.effect) {
    ctx.effect(() => uninstall, "mymeter: host runtime");
  }
  return uninstall;
}
function createCordisLedgerRepository(ctx, ledgerPath, ledgerFormat = "json") {
  return createCostEventRepositoryForFormat({
    ledgerPath,
    format: ledgerFormat,
    onJsonRecovery: ({ reason, quarantinePath, recoveredEventCount, rejectedEventCount }) => {
      const quarantine = quarantinePath ? `\uFF0C\u539F\u6587\u4EF6\u5DF2\u79FB\u52A8\u5230 ${quarantinePath}` : "";
      ctx.logger?.warn(
        `mymeter: \u8D26\u672C\u6062\u590D\uFF08${reason}\uFF09\uFF0C\u4FDD\u7559 ${recoveredEventCount} \u6761\u3001\u5FFD\u7565 ${rejectedEventCount} \u6761${quarantine}`
      );
    },
    onAppendRecovery: ({ reason }) => {
      ctx.logger?.warn(`mymeter: append ledger recovery (${reason})`);
    }
  });
}
function registerSettingsNamespace(ctx) {
  if (!ctx.settings?.register) return;
  const schema2 = ((value) => ({ ...asRecord5(value) }));
  schema2.toJSON = () => ({
    uid: 0,
    refs: { 0: { type: "object", meta: { default: {} }, dict: {} } }
  });
  ctx.settings.register("mymeter", schema2, { base: {} });
}
function createCordisHistoryCheckpoint(ctx, ledgerPath, ledgerFingerprint) {
  const filePath = createRecoveryCheckpointPath(ledgerPath);
  const expectations = () => ({
    sourceKey: HISTORY_RECOVERY_SOURCE_KEY,
    projectionVersion: HISTORY_RECOVERY_PROJECTION_VERSION,
    ledgerFingerprint: ledgerFingerprint()
  });
  const checkpoint = loadRecoveryCheckpoint(filePath, expectations(), (notice) => {
    const quarantine = notice.quarantinePath ? `\uFF0C\u539F\u6587\u4EF6\u5DF2\u79FB\u52A8\u5230 ${notice.quarantinePath}` : "";
    ctx.logger?.warn(`mymeter: history checkpoint recovery (${notice.reason})${quarantine}`);
  });
  let sessionRevisions = { ...checkpoint?.sessionRevisions ?? {} };
  let refreshTimer = null;
  const save = () => {
    if (refreshTimer !== null) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    saveRecoveryCheckpoint(filePath, {
      schemaVersion: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
      ...expectations(),
      sessionRevisions
    });
  };
  return {
    sessionRevisions,
    save(nextSessionRevisions) {
      sessionRevisions = { ...nextSessionRevisions };
      save();
    },
    refreshFingerprint() {
      if (refreshTimer !== null) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        try {
          save();
        } catch (error) {
          ctx.logger?.warn(`mymeter: history checkpoint refresh failed (${errorMessage2(error)})`);
        }
      }, HISTORY_CHECKPOINT_REFRESH_DEBOUNCE_MS);
    },
    flush() {
      if (refreshTimer === null) return;
      try {
        save();
      } catch (error) {
        ctx.logger?.warn(`mymeter: history checkpoint flush failed (${errorMessage2(error)})`);
      }
    }
  };
}
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}
function readConfiguredProviders(ctx) {
  const registered = ctx.llm?.listProviders() ?? [];
  const configurable = ctx.llm?.listConfigurableProviders?.() ?? [];
  const directory = new Map(configurable.map((entry) => [entry.provider, entry]));
  return registered.map((provider) => {
    const entry = directory.get(provider.id);
    return {
      id: provider.id,
      name: entry?.displayName || provider.name || provider.id,
      balanceSupported: entry?.settingsNs === "llm-deepseek"
    };
  });
}
function createCordisBalanceProvider(ctx, config) {
  let service = null;
  let serviceBaseUrl = "";
  const connection = () => {
    const settings = asRecord5(ctx.settings?.get("llm-deepseek"));
    const launchEnvironment = ctx.get?.("launchEnvironment");
    const environmentValue = (name2) => launchEnvironment?.get(name2)?.value ?? process.env[name2];
    return {
      apiKeyEnv: text2(config.apiKeyEnv) || text2(settings.apiKeyEnv) || "DEEPSEEK_API_KEY",
      baseUrl: text2(config.baseUrl) || text2(settings.baseURL) || text2(environmentValue("DEEPSEEK_BASE_URL")) || "https://api.deepseek.com"
    };
  };
  const provider = async () => {
    const current = connection();
    if (!service || serviceBaseUrl !== current.baseUrl) {
      serviceBaseUrl = current.baseUrl;
      service = createDeepSeekBalanceService({
        baseUrl: current.baseUrl,
        ...config.balanceCacheTtlMs !== void 0 ? { cacheTtlMs: config.balanceCacheTtlMs } : {},
        resolveApiKey: async () => {
          const ref = connection().apiKeyEnv;
          const credentials = ctx.credentials ?? ctx.get?.("credentials");
          if (credentials) {
            const resolved = await credentials.resolve(ref);
            return resolved?.value.trim() ? resolved.value : void 0;
          }
          const launchEnvironment = ctx.get?.("launchEnvironment");
          const ambient = launchEnvironment?.get(ref)?.value ?? process.env[ref];
          return ambient?.trim() ? ambient : void 0;
        }
      });
    }
    return service.getSnapshot();
  };
  const invalidate = () => service?.clearCache();
  const cleanups = [
    ctx.on("credentials/updated", () => invalidate()),
    ctx.on("settings/updated", () => invalidate())
  ];
  return {
    provider,
    dispose() {
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
      service?.clearCache();
      service = null;
    }
  };
}
function rememberSession(sessionRefs, session) {
  const sessionId = text2(session?.id ?? session?.sessionId);
  if (sessionId) {
    sessionRefs.set(sessionId, session);
  }
}
function captureOptionalProjectionService(ctx, update) {
  if (typeof ctx.inject === "function") {
    ctx.inject(["sessionProjections"], (projectionCtx) => {
      update(asProjectionService(projectionCtx.sessionProjections));
      return () => update(null);
    });
    return;
  }
  try {
    update(asProjectionService(ctx.sessionProjections ?? ctx.get?.("sessionProjections")));
  } catch {
    update(null);
  }
}
function markLiveSession(liveSessionIds, session) {
  const sessionId = text2(session?.id ?? session?.sessionId);
  if (sessionId) liveSessionIds.add(sessionId);
}
function readContextBreakdown(projections, session) {
  if (!session || !projections) {
    return null;
  }
  try {
    const values = projections.snapshot(session).values;
    return normalizeContextBreakdown(values?.contextBreakdown);
  } catch {
    return null;
  }
}
function asProjectionService(value) {
  return value && typeof value === "object" && typeof value.snapshot === "function" ? value : null;
}
function normalizeContextBreakdown(value) {
  const record = asRecord5(value);
  const systemTokens = nonNegativeFiniteNumber(record.systemTokens);
  const toolsTokens = nonNegativeFiniteNumber(record.toolsTokens);
  const messageTokens = nonNegativeFiniteNumber(record.messageTokens);
  if (systemTokens === null || toolsTokens === null || messageTokens === null) {
    return null;
  }
  return { systemTokens, toolsTokens, messageTokens };
}
function bridgeSessionEvent(sessions, emit, session, event) {
  const sessionId = text2(session?.id ?? session?.sessionId);
  const record = asRecord5(event);
  const type = text2(record.type);
  if (!sessionId || !type) return;
  const state = sessions.get(sessionId) ?? createSessionState();
  sessions.set(sessionId, state);
  if (state.agentPreset === "unknown") {
    state.agentPreset = sessionAgentPreset(session) || state.agentPreset;
  }
  const data = asRecord5(record.data);
  const time = finiteTime(record.time);
  if (type === "agent-preset/selected") {
    const agentPreset = text2(data.agentPreset);
    if (agentPreset) {
      state.agentPreset = agentPreset;
      const request2 = currentRequest(state);
      if (request2 && !request2.metadataLocked && !request2.requestActivityObserved && !request2.finalized) {
        request2.agentPreset = agentPreset;
      }
    }
    return;
  }
  if (type === "request/header") {
    const header = asRecord5(data.header);
    const config = asRecord5(header.config);
    state.provider = text2(config.provider) || state.provider;
    state.model = text2(config.model) || state.model;
    state.reasoningEffort = text2(config.reasoningEffort) || state.reasoningEffort;
    completeActiveRequestMetadata(state);
    markRequestActivity(state);
    emitActiveRequest(emit, sessionId, state, time);
    return;
  }
  if (type === "request/context") {
    state.provider = text2(data.provider) || state.provider;
    state.model = text2(data.model) || state.model;
    completeActiveRequestMetadata(state);
    markRequestActivity(state);
    emitActiveRequest(emit, sessionId, state, time);
    return;
  }
  if (type === "llm/retry") {
    const turn2 = integer(data.turn);
    const step2 = integer(data.step);
    const retryId = text2(data.retryId);
    if (turn2 !== null && step2 !== null && retryId) state.retryIds.set(requestKey(turn2, step2), retryId);
    return;
  }
  if (type === "llm/retry-started") {
    const turn2 = integer(data.turn);
    const step2 = integer(data.step);
    const retryId = text2(data.retryId);
    if (turn2 === null || step2 === null || !retryId) return;
    const previousRequest = state.requests.get(requestKey(turn2, step2));
    clearActiveRequest(emit, sessionId, turn2, step2, previousRequest);
    if (previousRequest && previousRequest.startedAt !== null && !previousRequest.finalized) {
      if (previousRequest.requestActivityObserved) {
        const previousPayload = {
          id: `${sessionId}:${String(record.seq ?? type)}:previous-attempt`,
          requestStartedAt: previousRequest.startedAt,
          completedAt: time,
          metadata: requestMetadata(sessionId, turn2, step2, previousRequest),
          requestOutcome: "failed"
        };
        if (!previousRequest.latestUsageAuthoritative && previousRequest.latestEstimate) {
          emit("mymeter:projection", {
            ...previousPayload,
            projection: toProjection(previousRequest.latestEstimate)
          });
        } else {
          emit("mymeter:final_usage", {
            ...previousPayload,
            ...previousRequest.latestUsageAuthoritative && previousRequest.latestUsage ? { usage: toUsage(previousRequest.latestUsage) } : {}
          });
        }
      }
      previousRequest.finalized = true;
    }
    state.retryIds.set(`${String(turn2)}:${String(step2)}`, retryId);
    if (turn2 === state.turn && step2 === state.step) {
      state.attemptId = retryId;
      state.startedAt = time;
    }
    freezeRequestMetadata(state, turn2, step2, retryId, time);
    emitActiveRequestFor(emit, sessionId, turn2, step2, state.requests.get(requestKey(turn2, step2)), time);
    return;
  }
  if (type === "step/start") {
    clearActiveRequest(emit, sessionId, state.turn, state.step, currentRequest(state));
    state.turn = integer(data.turn);
    state.step = integer(data.step);
    state.startedAt = time;
    state.attemptId = state.turn !== null && state.step !== null ? state.retryIds.get(requestKey(state.turn, state.step)) ?? "attempt-0" : "attempt-0";
    if (state.turn !== null && state.step !== null) {
      freezeRequestMetadata(state, state.turn, state.step, state.attemptId, state.startedAt);
      state.pendingRequestActivity = false;
      emitActiveRequest(emit, sessionId, state, time);
    }
    return;
  }
  if (type === "turn/end") {
    const turn2 = integer(data.turn);
    const outcome = turnEndOutcome(data.reason);
    if (turn2 === null || !outcome || turn2 !== state.turn || state.step === null) return;
    const request2 = state.requests.get(requestKey(turn2, state.step));
    if (!request2 || request2.startedAt === null || request2.finalized) return;
    if (!request2.requestActivityObserved) {
      clearActiveRequest(emit, sessionId, turn2, state.step, request2);
      request2.finalized = true;
      return;
    }
    if (outcome !== "success" && !request2.latestUsageAuthoritative && request2.latestEstimate) {
      clearActiveRequest(emit, sessionId, turn2, state.step, request2);
      emit("mymeter:projection", {
        id: `${sessionId}:${String(record.seq ?? type)}`,
        requestStartedAt: request2.startedAt,
        completedAt: time,
        metadata: requestMetadata(sessionId, turn2, state.step, request2),
        projection: toProjection(request2.latestEstimate),
        requestOutcome: outcome
      });
      request2.finalized = true;
      return;
    }
    emit("mymeter:final_usage", {
      id: `${sessionId}:${String(record.seq ?? type)}`,
      requestStartedAt: request2.startedAt,
      completedAt: time,
      metadata: requestMetadata(sessionId, turn2, state.step, request2),
      ...outcome !== "success" && request2.latestUsageAuthoritative && request2.latestUsage ? { usage: toUsage(request2.latestUsage) } : {},
      requestOutcome: outcome
    });
    request2.finalized = true;
    return;
  }
  if (type !== "assistant/chunk" && type !== "assistant/message") return;
  const turn = integer(data.turn) ?? state.turn;
  const step = integer(data.step) ?? state.step;
  if (turn === null || step === null) return;
  const request = state.requests.get(requestKey(turn, step));
  if (!request || request.startedAt === null) return;
  request.requestActivityObserved = true;
  const usage = type === "assistant/message" ? asRecord5(data.usage) : usageFromChunk(data.chunk);
  if (type === "assistant/message") {
    completeRequestMetadataFromAssistantMessage(request, data);
  }
  const metadata = requestMetadata(sessionId, turn, step, request);
  const common = {
    id: `${sessionId}:${String(record.seq ?? type)}`,
    requestStartedAt: request.startedAt,
    metadata
  };
  if (type === "assistant/chunk") {
    if (Object.keys(usage).length > 0) {
      request.metadataLocked = true;
      request.latestUsage = usage;
      request.latestUsageAuthoritative = true;
      emit("mymeter:projection", { ...common, projection: toProjection(usage) });
      return;
    }
    if (request.latestUsageAuthoritative || !supportsStreamingEstimate(request)) return;
    const estimate = updateStreamingEstimate(request, data.chunk, time);
    if (!estimate) return;
    request.metadataLocked = true;
    request.latestEstimate = estimate;
    emit("mymeter:projection", { ...common, projection: toProjection(estimate) });
    return;
  }
  if (data.usage === void 0 || data.usage === null) return;
  request.metadataLocked = true;
  emit("mymeter:final_usage", {
    ...common,
    completedAt: time,
    usage: toUsage(usage),
    requestOutcome: "success"
  });
  request.latestUsage = usage;
  request.latestUsageAuthoritative = true;
  request.finalized = true;
}
function createSessionState() {
  return {
    provider: "unknown",
    model: "unknown",
    reasoningEffort: "unknown",
    agentPreset: "unknown",
    startedAt: null,
    turn: null,
    step: null,
    attemptId: "attempt-0",
    pendingRequestActivity: false,
    retryIds: /* @__PURE__ */ new Map(),
    requests: /* @__PURE__ */ new Map()
  };
}
function sessionAgentPreset(session) {
  const record = asRecord5(session);
  return text2(asRecord5(record.header).agentPreset) || text2(record.agentPreset);
}
function eventIsInHistory(events, event) {
  if (events.includes(event)) return true;
  const sequence = asRecord5(event).seq;
  if (typeof sequence !== "number" || !Number.isSafeInteger(sequence)) return false;
  return events.some((entry) => {
    const entrySequence = asRecord5(entry).seq;
    return typeof entrySequence === "number" && Number.isSafeInteger(entrySequence) && entrySequence === sequence;
  });
}
function freezeRequestMetadata(state, turn, step, attemptId, startedAt) {
  state.requests.set(requestKey(turn, step), {
    provider: state.provider,
    model: state.model,
    reasoningEffort: state.reasoningEffort,
    agentPreset: state.agentPreset,
    startedAt,
    attemptId,
    metadataLocked: false,
    requestActivityObserved: state.pendingRequestActivity
  });
}
function markRequestActivity(state) {
  const request = currentRequest(state);
  if (request && !request.finalized) {
    request.requestActivityObserved = true;
    return;
  }
  state.pendingRequestActivity = true;
}
function completeActiveRequestMetadata(state) {
  if (state.turn === null || state.step === null) return;
  const request = state.requests.get(requestKey(state.turn, state.step));
  if (!request || request.metadataLocked || request.finalized) return;
  request.provider = state.provider;
  request.model = state.model;
  request.reasoningEffort = state.reasoningEffort;
}
function completeRequestMetadataFromAssistantMessage(request, data) {
  const message = asRecord5(data.message);
  const source = asRecord5(message.source);
  const provider = text2(source.provider);
  const model = text2(source.model);
  const reasoningEffort = text2(source.reasoningEffort);
  if (provider && request.provider === "unknown") request.provider = provider;
  if (model && request.model === "unknown") request.model = model;
  if (reasoningEffort && request.reasoningEffort === "unknown") request.reasoningEffort = reasoningEffort;
}
function currentRequest(state) {
  return state.turn === null || state.step === null ? void 0 : state.requests.get(requestKey(state.turn, state.step));
}
function emitActiveRequest(emit, sessionId, state, lastActivityAt) {
  if (state.turn === null || state.step === null) return;
  emitActiveRequestFor(emit, sessionId, state.turn, state.step, currentRequest(state), lastActivityAt);
}
function emitActiveRequestFor(emit, sessionId, turn, step, request, lastActivityAt) {
  if (!request || request.startedAt === null || request.finalized) return;
  emit(ACTIVE_REQUEST_EVENT2, {
    action: "upsert",
    requestStartedAt: request.startedAt,
    lastActivityAt: lastActivityAt ?? request.startedAt,
    metadata: requestMetadata(sessionId, turn, step, request)
  });
}
function clearActiveRequest(emit, sessionId, turn, step, request) {
  if (turn === null || step === null || !request || request.startedAt === null || request.finalized) return;
  emit(ACTIVE_REQUEST_EVENT2, {
    action: "clear",
    requestStartedAt: request.startedAt,
    metadata: requestMetadata(sessionId, turn, step, request)
  });
}
function requestKey(turn, step) {
  return `${String(turn)}:${String(step)}`;
}
function requestMetadata(sessionId, turn, step, request) {
  return {
    sessionId,
    turnId: String(turn),
    stepId: String(step),
    attemptId: request.attemptId,
    provider: request.provider,
    model: request.model,
    reasoningEffort: request.reasoningEffort,
    agentPreset: request.agentPreset
  };
}
function turnEndOutcome(reason) {
  const kind = text2(asRecord5(reason).kind);
  if (kind === "completed" || kind === "max-tokens") return "success";
  if (kind === "aborted" || kind === "interrupted") return "aborted";
  if (kind === "error" || kind === "blocked") return "failed";
  return null;
}
function usageFromChunk(chunk) {
  const record = asRecord5(chunk);
  return record.type === "usage" ? asRecord5(record.usage) : {};
}
function supportsStreamingEstimate(request) {
  return resolvePricingCatalogKind(request.provider, request.model) !== null;
}
function updateStreamingEstimate(request, chunk, activityAt) {
  const record = asRecord5(chunk);
  const type = text2(record.type);
  if (!type) return null;
  if (type === "reasoning-delta" || type === "text-delta" || type === "tool-call-delta") {
    const bytes2 = contentByteLength(record);
    if (bytes2 <= 0) return null;
    addStreamingBlockBytes(request, streamingBlockKey(record), bytes2, type === "reasoning-delta" ? bytes2 : 0);
    return streamingEstimateUsage(request, false, activityAt);
  }
  if (type !== "block-end") return null;
  const bytes = blockEndContentByteLength(record);
  if (bytes > 0) {
    const state = streamingEstimateState(request);
    const key = streamingBlockKey(record);
    const block = state.blockBytes.get(key) ?? { outputBytes: 0, reasoningBytes: 0 };
    const outputBytes = Math.max(block.outputBytes, bytes);
    const reasoningBytes = isReasoningBlockEnd(record) ? Math.max(block.reasoningBytes, bytes) : block.reasoningBytes;
    state.outputBytes += outputBytes - block.outputBytes;
    state.reasoningBytes += reasoningBytes - block.reasoningBytes;
    state.blockBytes.set(key, { outputBytes, reasoningBytes });
  }
  return streamingEstimateUsage(request, true, activityAt);
}
function addStreamingBlockBytes(request, key, outputBytes, reasoningBytes) {
  const state = streamingEstimateState(request);
  const block = state.blockBytes.get(key) ?? { outputBytes: 0, reasoningBytes: 0 };
  block.outputBytes += outputBytes;
  block.reasoningBytes += reasoningBytes;
  state.outputBytes += outputBytes;
  state.reasoningBytes += reasoningBytes;
  state.blockBytes.set(key, block);
}
function streamingEstimateState(request) {
  request.streamingEstimate ??= {
    blockBytes: /* @__PURE__ */ new Map(),
    outputBytes: 0,
    reasoningBytes: 0,
    lastEmittedOutputTokens: 0,
    lastEmittedAt: null
  };
  return request.streamingEstimate;
}
function streamingEstimateUsage(request, forceEmit, activityAt) {
  const state = request.streamingEstimate;
  if (!state) return null;
  const outputTokens = estimateTokensFromBytes(state.outputBytes);
  if (outputTokens <= 0) return null;
  if (!forceEmit && state.lastEmittedOutputTokens > 0 && (outputTokens - state.lastEmittedOutputTokens < STREAMING_ESTIMATE_MIN_TOKEN_STEP || activityAt !== null && state.lastEmittedAt !== null && activityAt - state.lastEmittedAt < STREAMING_ESTIMATE_MIN_INTERVAL_MS)) {
    return null;
  }
  state.lastEmittedOutputTokens = outputTokens;
  if (activityAt !== null) state.lastEmittedAt = activityAt;
  return {
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens,
    reasoningTokens: Math.min(estimateTokensFromBytes(state.reasoningBytes), outputTokens)
  };
}
function estimateTokensFromBytes(bytes) {
  return Math.ceil(bytes / 4);
}
function streamingBlockKey(record) {
  const block = asRecord5(record.block);
  const index = record.index ?? record.blockIndex ?? record.block_index ?? block.index;
  if (typeof index === "number" && Number.isSafeInteger(index)) return String(index);
  if (typeof index === "string" && index.trim()) return index.trim();
  return `unknown:${text2(record.type) || "block"}`;
}
function blockEndContentByteLength(record) {
  const block = record.block ?? record.item ?? record.message ?? record.content ?? record;
  return contentByteLength(block);
}
function isReasoningBlockEnd(record) {
  const block = asRecord5(record.block ?? record.item ?? record.message ?? record.content);
  const type = text2(block.type ?? block.kind ?? record.blockType ?? record.block_type);
  return type.includes("reasoning") || typeof block.reasoning === "string" || typeof record.reasoning === "string";
}
function contentByteLength(value) {
  if (typeof value === "string") return Buffer.byteLength(value, "utf8");
  if (Array.isArray(value)) return value.reduce((total, item) => total + contentByteLength(item), 0);
  if (!value || typeof value !== "object") return 0;
  const record = asRecord5(value);
  const keys = [
    "text",
    "content",
    "delta",
    "argumentsDelta",
    "arguments",
    "args",
    "input",
    "value",
    "reasoning",
    "reasoningText",
    "reasoning_content"
  ];
  for (const key of keys) {
    const bytes = contentByteLength(record[key]);
    if (bytes > 0) return bytes;
  }
  return 0;
}
function toProjection(usage) {
  const normalized = normalizeBridgeUsage(usage);
  return {
    ...normalized,
    reliability: 1
  };
}
function toUsage(usage) {
  return normalizeBridgeUsage(usage);
}
function normalizeBridgeUsage(usage) {
  const promptDetails = asRecord5(usage.promptTokensDetails ?? usage.prompt_tokens_details);
  const completionDetails = asRecord5(usage.completionTokensDetails ?? usage.completion_tokens_details);
  const cacheHitTokens = firstTokenNumber(
    usage.cacheReadTokens,
    usage.cache_read_tokens,
    usage.cacheHitTokens,
    usage.cache_hit_tokens,
    usage.cachedTokens,
    usage.cached_tokens,
    promptDetails.cachedTokens,
    promptDetails.cached_tokens
  ) ?? 0;
  const cacheWriteTokens = firstTokenNumber(usage.cacheWriteTokens, usage.cache_write_tokens) ?? 0;
  const explicitCacheMissTokens = firstTokenNumber(usage.cacheMissTokens, usage.cache_miss_tokens);
  const disjointInputTokens = firstTokenNumber(usage.inputTokens, usage.input_tokens);
  const promptTokens = firstTokenNumber(usage.promptTokens, usage.prompt_tokens);
  const cacheMissTokens = explicitCacheMissTokens ?? (disjointInputTokens !== null ? disjointInputTokens : promptTokens !== null ? Math.max(promptTokens - cacheHitTokens - cacheWriteTokens, 0) : 0);
  return {
    cacheHitTokens,
    cacheMissTokens,
    ...cacheWriteTokens > 0 ? { cacheWriteTokens } : {},
    outputTokens: firstTokenNumber(
      usage.outputTokens,
      usage.output_tokens,
      usage.completionTokens,
      usage.completion_tokens
    ) ?? 0,
    reasoningTokens: firstTokenNumber(
      usage.reasoningTokens,
      usage.reasoning_tokens,
      completionDetails.reasoningTokens,
      completionDetails.reasoning_tokens
    ) ?? 0
  };
}
function firstTokenNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  }
  return null;
}
function asRecord5(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function text2(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
function integer(value) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}
function nonNegativeFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function finiteTime(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export {
  apply,
  buildSessionCostTree,
  createMyMeterCordisHostRuntime,
  inject,
  name
};
