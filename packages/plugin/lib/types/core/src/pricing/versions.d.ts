/**
 * Published price-card identifiers. FX conversion is deliberately managed
 * separately, so changing the daily USD/CNY quote does not invalidate a
 * provider's native price card.
 */
export declare const PRICING_CATALOG_VERSIONS: {
    readonly deepseek: "deepseek-official-pricing-2026-08-21";
    readonly xai: "xai-official-pricing-2026-08-18-usd";
    readonly openai: "openai-official-pricing-2026-08-18-usd";
    readonly anthropic: "anthropic-official-pricing-2026-08-18-usd";
    readonly google: "google-official-pricing-2026-08-18-usd";
    readonly moonshotai: "moonshotai-official-pricing-2026-08-18-usd";
    readonly minimax: "minimax-official-pricing-2026-08-18-usd";
    readonly mistral: "mistral-official-pricing-2026-08-18-usd";
    readonly groq: "groq-official-pricing-2026-08-18-usd";
    readonly together: "together-official-pricing-2026-08-18-usd";
    readonly fireworks: "fireworks-official-pricing-2026-08-18-usd";
    readonly cerebras: "cerebras-official-pricing-2026-08-18-usd";
};
export type PricingCatalogVersion = (typeof PRICING_CATALOG_VERSIONS)[keyof typeof PRICING_CATALOG_VERSIONS];
