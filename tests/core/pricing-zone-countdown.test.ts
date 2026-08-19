import { describe, expect, test } from "vitest";

import { resolveDeepSeekPricingZoneCountdown } from "../../packages/core/src/index";

describe("DeepSeek pricing zone countdown", () => {
  test.each([
    {
      now: "2026-08-17T08:59:59+08:00",
      currentZone: "offpeak",
      nextZone: "peak",
      remainingMs: 1_000,
      transitionAt: "2026-08-17T01:00:00.000Z",
      transitionTimeLabel: "09:00",
      remainingLabel: "1秒",
    },
    {
      now: "2026-08-17T09:00:00+08:00",
      currentZone: "peak",
      nextZone: "offpeak",
      remainingMs: 10_800_000,
      transitionAt: "2026-08-17T04:00:00.000Z",
      transitionTimeLabel: "12:00",
      remainingLabel: "3小时",
    },
    {
      now: "2026-08-17T11:59:59+08:00",
      currentZone: "peak",
      nextZone: "offpeak",
      remainingMs: 1_000,
      transitionAt: "2026-08-17T04:00:00.000Z",
      transitionTimeLabel: "12:00",
      remainingLabel: "1秒",
    },
    {
      now: "2026-08-17T12:00:00+08:00",
      currentZone: "offpeak",
      nextZone: "peak",
      remainingMs: 7_200_000,
      transitionAt: "2026-08-17T06:00:00.000Z",
      transitionTimeLabel: "14:00",
      remainingLabel: "2小时",
    },
    {
      now: "2026-08-17T13:59:59+08:00",
      currentZone: "offpeak",
      nextZone: "peak",
      remainingMs: 1_000,
      transitionAt: "2026-08-17T06:00:00.000Z",
      transitionTimeLabel: "14:00",
      remainingLabel: "1秒",
    },
    {
      now: "2026-08-17T14:00:00+08:00",
      currentZone: "peak",
      nextZone: "offpeak",
      remainingMs: 14_400_000,
      transitionAt: "2026-08-17T10:00:00.000Z",
      transitionTimeLabel: "18:00",
      remainingLabel: "4小时",
    },
    {
      now: "2026-08-17T17:59:59+08:00",
      currentZone: "peak",
      nextZone: "offpeak",
      remainingMs: 1_000,
      transitionAt: "2026-08-17T10:00:00.000Z",
      transitionTimeLabel: "18:00",
      remainingLabel: "1秒",
    },
    {
      now: "2026-08-17T18:00:00+08:00",
      currentZone: "offpeak",
      nextZone: "peak",
      remainingMs: 54_000_000,
      transitionAt: "2026-08-18T01:00:00.000Z",
      transitionTimeLabel: "明日 09:00",
      remainingLabel: "15小时",
    },
  ])("resolves the next boundary from $now", (item) => {
    const result = resolveDeepSeekPricingZoneCountdown({ now: item.now });

    expect(result.currentZone).toBe(item.currentZone);
    expect(result.nextZone).toBe(item.nextZone);
    expect(result.remainingMs).toBe(item.remainingMs);
    expect(result.remainingLabel).toBe(item.remainingLabel);
    expect(result.transitionAt?.toISOString()).toBe(item.transitionAt);
    expect(result.transitionTimeLabel).toBe(item.transitionTimeLabel);
  });

  test("counts down across midnight to the next morning peak window", () => {
    const result = resolveDeepSeekPricingZoneCountdown({ now: "2026-08-17T23:30:00+08:00" });

    expect(result.currentZone).toBe("offpeak");
    expect(result.nextZone).toBe("peak");
    expect(result.remainingMs).toBe(34_200_000);
    expect(result.remainingLabel).toBe("9小时30分钟");
    expect(result.transitionAt?.toISOString()).toBe("2026-08-18T01:00:00.000Z");
    expect(result.transitionTimeLabel).toBe("明日 09:00");
  });

  test("returns no countdown for unknown pricing zones", () => {
    const result = resolveDeepSeekPricingZoneCountdown({
      now: "2026-08-17T10:00:00+08:00",
      pricingZone: "unknown",
    });

    expect(result).toEqual({
      currentZone: "unknown",
      currentZoneLabel: "不适用",
      nextZone: null,
      nextZoneLabel: null,
      transitionAt: null,
      transitionTimeLabel: null,
      remainingMs: null,
      remainingLabel: null,
    });
  });
});
