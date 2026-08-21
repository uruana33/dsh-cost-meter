/**
 * Published price-card identifiers. FX conversion is deliberately managed
 * separately, so changing the daily USD/CNY quote does not invalidate a
 * provider's native price card.
 */
export const PRICING_CATALOG_VERSIONS = {
  deepseek: "deepseek-official-pricing-2026-08-21",
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
  cerebras: "cerebras-official-pricing-2026-08-18-usd",
} as const;

export type PricingCatalogVersion = (typeof PRICING_CATALOG_VERSIONS)[keyof typeof PRICING_CATALOG_VERSIONS];
