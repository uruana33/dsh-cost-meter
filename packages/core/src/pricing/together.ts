import type { UsdTokenRates } from "./common";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const TOGETHER_PROVIDER = "together" as const;
export const TOGETHER_PRICE_VERSION = PRICING_CATALOG_VERSIONS.together;
export const TOGETHER_PRICING_SOURCE = "https://www.together.ai/pricing";

export const TOGETHER_PRICE_TABLE_USD: Record<string, UsdTokenRates> = {
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
  "zai-org/GLM-5.2": { input: 1.4, cachedInput: 0.26, output: 4.4 },
};
