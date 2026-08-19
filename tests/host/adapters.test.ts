import { expect, test } from "vitest";

import {
  createHostMetadataAdapter,
  createHostProjectionAdapter,
  createHostUsageAdapter,
} from "../../packages/host/src/index";

test("host metadata adapter fills unknown fields and ignores body text", () => {
  const adapter = createHostMetadataAdapter();
  const metadata = adapter.fromRequest({
    provider: "deepseek",
    model: "deepseek-v4-flash",
    reasoningEffort: undefined,
    agentPreset: "Coding",
    prompt: "hidden",
    completion: "hidden",
  });

  expect(metadata.provider).toBe("deepseek");
  expect(metadata.model).toBe("deepseek-v4-flash");
  expect(metadata.reasoningEffort).toBe("unknown");
  expect(metadata.agentPreset).toBe("Coding");
  expect("prompt" in metadata).toBe(false);
});

test("usage and projection adapters normalize token names and missing data", () => {
  const usageAdapter = createHostUsageAdapter();
  const projectionAdapter = createHostProjectionAdapter();

  expect(
    usageAdapter.fromAssistantUsage({
      cache_hit_tokens: 18,
      cache_miss_tokens: 24,
      output_tokens: 32,
      reasoning_tokens: 8,
    }),
  ).toEqual({
    cacheHitTokens: 18,
    cacheMissTokens: 24,
    outputTokens: 32,
    reasoningTokens: 8,
    totalTokens: 74,
  });

  expect(projectionAdapter.fromTokenMeter({})).toBeNull();
  expect(
    projectionAdapter.fromTokenMeter({
      cacheHitTokens: 3,
      cacheMissTokens: 5,
      outputTokens: 9,
    }),
  ).toEqual({
    cacheHitTokens: 3,
    cacheMissTokens: 5,
    outputTokens: 9,
    reasoningTokens: 0,
    totalTokens: 17,
      isReliable: true,
    });
});

test("usage adapter accepts official token fields without double counting reasoning", () => {
  const adapter = createHostUsageAdapter();

  expect(
    adapter.fromAssistantUsage({
      prompt_tokens: 120,
      completion_tokens: 50,
      total_tokens: 170,
      prompt_tokens_details: {
        cached_tokens: 20,
      },
      completion_tokens_details: {
        reasoning_tokens: 10,
      },
    }),
  ).toEqual({
    cacheHitTokens: 20,
    cacheMissTokens: 100,
    outputTokens: 50,
    reasoningTokens: 10,
    totalTokens: 170,
  });
});

test("projection adapter aligns with core reliability and snake_case token inputs", () => {
  const adapter = createHostProjectionAdapter();

  expect(
    adapter.fromTokenMeter({
      prompt_tokens: 12,
      prompt_tokens_details: {
        cached_tokens: 5,
      },
      completion_tokens: 8,
      completion_tokens_details: {
        reasoning_tokens: 3,
      },
      reliable: false,
    }),
  ).toEqual({
    cacheHitTokens: 5,
    cacheMissTokens: 7,
    outputTokens: 8,
    reasoningTokens: 3,
    totalTokens: 20,
    isReliable: false,
  });
});
