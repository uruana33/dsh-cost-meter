export * from "./common";
export * from "./catalog";
export * from "./anthropic";
export * from "./cerebras";
export * from "./deepseek";
export * from "./fireworks";
export * from "./google";
export * from "./groq";
export * from "./minimax";
export * from "./mistral";
export * from "./moonshotai";
export * from "./openai";
export * from "./together";
export * from "./xai";
export * from "./versions";
export * from "./remote-update";
import { resolveAdditionalPricingCatalogKind } from "./catalog";
import type { AdditionalPricingCatalogKind } from "./catalog";
import { resolveDeepSeekModelId } from "./deepseek";
import { resolveXaiModelId } from "./xai";

export type PricingCatalogKind = "deepseek" | "xai" | AdditionalPricingCatalogKind;

/** Resolve the rate-card owner without treating gateway route ids as price sources. */
export function resolvePricingCatalogKind(provider: string | undefined, model: string): PricingCatalogKind | null {
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
