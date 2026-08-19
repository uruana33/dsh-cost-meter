import type { UsdTokenRates } from "./common";
import { PRICING_CATALOG_VERSIONS } from "./versions";

export const GROQ_PROVIDER = "groq" as const;
export const GROQ_PRICE_VERSION = PRICING_CATALOG_VERSIONS.groq;
export const GROQ_PRICING_SOURCE = "https://console.groq.com/docs/models";

export const GROQ_PRICE_TABLE_USD: Record<string, UsdTokenRates> = {
  "llama-3.1-8b-instant": { input: 0.05, cachedInput: 0, output: 0.08 },
  "llama-3.3-70b-versatile": { input: 0.59, cachedInput: 0, output: 0.79 },
  "meta-llama/llama-4-scout-17b-16e-instruct": { input: 0.11, cachedInput: 0, output: 0.34 },
  "openai/gpt-oss-120b": { input: 0.15, cachedInput: 0.075, output: 0.6 },
  "openai/gpt-oss-20b": { input: 0.075, cachedInput: 0.0375, output: 0.3 },
  "openai/gpt-oss-safeguard-20b": { input: 0.075, cachedInput: 0, output: 0.3 },
  "qwen/qwen3-32b": { input: 0.29, cachedInput: 0, output: 0.59 },
};
