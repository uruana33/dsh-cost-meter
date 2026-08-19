import type { DateInput, PricingZone } from "../../shared/src/index";
export interface DeepSeekPricingZoneCountdownInput {
    now: DateInput;
    pricingZone?: PricingZone | undefined;
}
export interface DeepSeekPricingZoneCountdown {
    currentZone: PricingZone;
    currentZoneLabel: string;
    nextZone: Exclude<PricingZone, "unknown"> | null;
    nextZoneLabel: string | null;
    transitionAt: Date | null;
    transitionTimeLabel: string | null;
    remainingMs: number | null;
    remainingLabel: string | null;
}
export declare function resolveDeepSeekPricingZoneCountdown(input: DeepSeekPricingZoneCountdownInput): DeepSeekPricingZoneCountdown;
