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

interface BeijingClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface PricingZoneTransition {
  at: Date;
  nextZone: Exclude<PricingZone, "unknown">;
  timeLabel: string;
}

const BEIJING_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const PEAK_WINDOWS = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60],
] as const;

export function resolveDeepSeekPricingZoneCountdown(
  input: DeepSeekPricingZoneCountdownInput,
): DeepSeekPricingZoneCountdown {
  if (input.pricingZone === "unknown") {
    return {
      currentZone: "unknown",
      currentZoneLabel: pricingZoneLabel("unknown"),
      nextZone: null,
      nextZoneLabel: null,
      transitionAt: null,
      transitionTimeLabel: null,
      remainingMs: null,
      remainingLabel: null,
    };
  }

  const now = toValidDate(input.now);
  const parts = getBeijingClockParts(now);
  const currentZone = resolveDeepSeekZoneFromBeijingParts(parts);
  const transition = nextDeepSeekPricingZoneTransition(now, parts);
  const remainingMs = Math.max(0, transition.at.getTime() - now.getTime());

  return {
    currentZone,
    currentZoneLabel: pricingZoneLabel(currentZone),
    nextZone: transition.nextZone,
    nextZoneLabel: pricingZoneLabel(transition.nextZone),
    transitionAt: transition.at,
    transitionTimeLabel: transition.timeLabel,
    remainingMs,
    remainingLabel: formatDuration(remainingMs),
  };
}

function nextDeepSeekPricingZoneTransition(now: Date, parts: BeijingClockParts): PricingZoneTransition {
  const candidates: PricingZoneTransition[] = [
    transitionFor(parts, 0, 9, "peak"),
    transitionFor(parts, 0, 12, "offpeak"),
    transitionFor(parts, 0, 14, "peak"),
    transitionFor(parts, 0, 18, "offpeak"),
    transitionFor(parts, 1, 9, "peak"),
  ];

  const transition = candidates.find((item) => item.at.getTime() > now.getTime());
  if (!transition) {
    return transitionFor(parts, 1, 9, "peak");
  }
  return transition;
}

function transitionFor(
  parts: BeijingClockParts,
  dayOffset: number,
  hour: number,
  nextZone: Exclude<PricingZone, "unknown">,
): PricingZoneTransition {
  return {
    at: beijingLocalDate(parts, dayOffset, hour, 0, 0),
    nextZone,
    timeLabel: `${dayOffset === 0 ? "" : "明日 "}${String(hour).padStart(2, "0")}:00`,
  };
}

function resolveDeepSeekZoneFromBeijingParts(parts: BeijingClockParts): Exclude<PricingZone, "unknown"> {
  const minutes = parts.hour * 60 + parts.minute;
  return PEAK_WINDOWS.some(([start, end]) => minutes >= start && minutes < end) ? "peak" : "offpeak";
}

function getBeijingClockParts(date: Date): BeijingClockParts {
  const parts = BEIJING_CLOCK.formatToParts(date);
  return {
    year: numberPart(parts, "year"),
    month: numberPart(parts, "month"),
    day: numberPart(parts, "day"),
    hour: numberPart(parts, "hour"),
    minute: numberPart(parts, "minute"),
    second: numberPart(parts, "second"),
  };
}

function numberPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`missing Beijing clock part: ${type}`);
  return Number(value);
}

function beijingLocalDate(
  parts: BeijingClockParts,
  dayOffset: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, hour - 8, minute, second, 0));
}

function pricingZoneLabel(zone: PricingZone): string {
  if (zone === "peak") return "高峰时段";
  if (zone === "offpeak") return "空闲时段";
  return "不适用";
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1_000));
  if (totalSeconds < 60) return `${totalSeconds}秒`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  if (hours === 0 && seconds > 0) parts.push(`${seconds}秒`);
  return parts.join("");
}

function toValidDate(input: DateInput): Date {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid date input");
  }
  return date;
}
