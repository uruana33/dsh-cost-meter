import type { AmountView, MeterStatusCode, MeterTone } from "./view-model";
export declare function formatMicroCny(microCny: number, decimals?: number): string;
export declare function formatCurrencyMinor(amountMinor: number, currency?: string, decimals?: number): string;
export declare function formatTokenCount(tokens: number): string;
/**
 * Compact token formatting for tight layouts (the floating meter rows). Keeps
 * the full grouped form under 100k and switches to 万/亿 scales above it, so a
 * multi-million-token session still fits a narrow column without overflow.
 */
export declare function formatTokenCountCompact(tokens: number): string;
/**
 * Compact currency formatting for tight layouts: keeps full precision below
 * one unit, two decimals below 100 units, and rounds to integers above that,
 * so large totals stop widening fixed-width meter rows.
 */
export declare function formatCurrencyMinorCompact(amountMinor: number, currency?: string, decimals?: number): string;
export declare function formatTokenBucketLabel(label: string): string;
export declare function createAmountView(microCny: number, decimals?: number, currency?: string): AmountView;
export declare function createUnknownAmountView(label?: string): AmountView;
export declare function createUnavailableAmountView(label?: string): AmountView;
export declare function formatStatusLabel(code: MeterStatusCode): string;
export declare function formatTone(code: MeterStatusCode): MeterTone;
