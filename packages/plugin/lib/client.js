window.__ModuleLoader__.load({ id: "@mymeter/dsh-cost-meter", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/plugin/src/cordis-client.tsx
var cordis_client_exports = {};
__export(cordis_client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(cordis_client_exports);
var import_react6 = require("react");

// packages/client/src/format.ts
function formatCurrencyMinor(amountMinor, currency = "CNY", decimals = 3) {
  if (amountMinor === 0) {
    return currencySymbol(currency) + `0.${"0".repeat(decimals)}`;
  }
  const value = amountMinor / 1e6;
  const rounded = value.toFixed(decimals);
  if (Number(rounded) === 0) {
    return `<${currencySymbol(currency)}0.${"0".repeat(Math.max(1, decimals - 1))}1`;
  }
  return `${currencySymbol(currency)}${rounded}`;
}
function currencySymbol(currency) {
  const normalized = currency.trim().toUpperCase();
  return normalized === "USD" ? "$" : normalized === "CNY" || normalized === "" ? "\xA5" : `${normalized} `;
}
function formatTokenCount(tokens) {
  return new Intl.NumberFormat("en-US").format(tokens);
}
function formatTokenBucketLabel(label) {
  if (label === "\u7F13\u5B58\u672A\u547D\u4E2D") {
    return "\u8F93\u5165 Token(\u65E0\u7F13\u5B58)";
  }
  if (label === "\u7F13\u5B58\u547D\u4E2D") {
    return "\u8F93\u5165 Token(\u7F13\u5B58)";
  }
  if (label === "\u8F93\u51FA") {
    return "\u8F93\u51FA Token";
  }
  return label;
}
function createAmountView(microCny, decimals = 3, currency = "CNY") {
  return {
    microCny,
    label: formatCurrencyMinor(microCny, currency, decimals),
    detailLabel: formatCurrencyMinor(microCny, currency, 6),
    ...currency.trim().toUpperCase() !== "CNY" ? { currency: currency.trim().toUpperCase() } : {}
  };
}
function createUnavailableAmountView(label = "\u4E0D\u53EF\u7528") {
  return {
    microCny: 0,
    label,
    detailLabel: label
  };
}
function formatStatusLabel(code) {
  const labels = {
    idle: "\u7A7A\u95F2",
    billing: "\u8BA1\u8D39\u4E2D",
    settled: "\u5DF2\u7ED3\u7B97",
    unknown: "\u8D39\u7528\u4F30\u7B97",
    balance_expired: "\u4F59\u989D\u8FC7\u671F",
    balance_insufficient: "\u4F59\u989D\u4E0D\u8DB3",
    failed: "\u5931\u8D25",
    aborted: "\u5DF2\u4E2D\u6B62"
  };
  return labels[code];
}
function formatTone(code) {
  if (code === "failed" || code === "aborted") {
    return "danger";
  }
  if (code === "balance_expired" || code === "balance_insufficient" || code === "unknown") {
    return "warning";
  }
  if (code === "billing") {
    return "info";
  }
  if (code === "settled") {
    return "success";
  }
  return "neutral";
}

// packages/shared/src/index.ts
var MYMETER_GOLDEN_FIXTURES = {
  version: "mymeter-golden-2026-08-17",
  price: {
    priceVersion: "deepseek-official-pricing-2026-08-17",
    source: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/"
  },
  usage: {
    offpeakFlashWithReasoning: {
      model: "deepseek-v4-flash",
      requestStartedAt: "2026-08-17T12:00:00+08:00",
      usage: {
        cacheHitTokens: 1e6,
        cacheMissTokens: 1e6,
        outputTokens: 1e6,
        reasoningTokens: 4e5
      },
      expectedPricingZone: "offpeak",
      expectedAmountMicroCny: 6050000n
    },
    peakBoundary: {
      model: "deepseek-v4-pro",
      requestStartedAt: "2026-08-17T09:00:00+08:00",
      usage: {
        cacheHitTokens: 1e6,
        cacheMissTokens: 0,
        outputTokens: 0
      },
      expectedPricingZone: "peak",
      expectedAmountMicroCny: 300000n
    },
    unknownModel: {
      model: "deepseek-unknown",
      requestStartedAt: "2026-08-17T12:00:00+08:00",
      usage: {
        cacheHitTokens: 0,
        cacheMissTokens: 1e4,
        outputTokens: 1e3
      },
      expectedStatus: "unknown"
    },
    failureWithUsage: {
      outcome: "failed",
      expectedStatus: "failed",
      usage: {
        cacheHitTokens: 1e6,
        cacheMissTokens: 0,
        outputTokens: 0
      }
    },
    abortedWithoutUsage: {
      outcome: "aborted",
      expectedStatus: "unknown",
      expectedReason: "missing_usage"
    },
    duplicateUsage: {
      identity: {
        sessionId: "sess-dup",
        turnId: "turn-1",
        stepId: "step-1",
        attemptId: "attempt-1"
      },
      projection: {
        cacheHitTokens: 10,
        cacheMissTokens: 20,
        outputTokens: 30,
        reasoningTokens: 5
      },
      finalUsage: {
        cacheHitTokens: 10,
        cacheMissTokens: 20,
        outputTokens: 30,
        reasoningTokens: 5
      }
    }
  },
  balance: {
    stale: {
      status: "stale",
      totalMicroCny: 47517000n,
      grantedMicroCny: 40000000n,
      toppedUpMicroCny: 7517000n,
      updatedAt: "2026-08-17T00:00:00.000Z",
      staleAfterMs: 3e5
    }
  },
  sessions: [
    {
      id: "sess-mock-1",
      title: "Mock billing session",
      currentModel: "deepseek-v4-flash",
      reasoningEffort: "high",
      agentPreset: "coding",
      summary: createFixtureBucket({
        totalMicroCny: 6050000n,
        settledMicroCny: 6050000n,
        cacheHitTokens: 1000000n,
        cacheMissTokens: 1000000n,
        outputTokens: 1000000n,
        reasoningTokens: 400000n,
        offpeakMicroCny: 6050000n,
        eventCount: 1
      })
    },
    {
      id: "sess-mock-unknown",
      title: "Mock unknown cost session",
      currentModel: "deepseek-unknown",
      summary: createFixtureBucket({
        unknownCount: 1,
        eventCount: 1
      })
    }
  ]
};
function createEmptyAggregateBucket() {
  return {
    totalMicroCny: 0n,
    settledMicroCny: 0n,
    estimatedMicroCny: 0n,
    failedMicroCny: 0n,
    unknownCount: 0,
    eventCount: 0,
    peakMicroCny: 0n,
    offpeakMicroCny: 0n,
    cacheHitTokens: 0n,
    cacheMissTokens: 0n,
    outputTokens: 0n,
    reasoningTokens: 0n
  };
}
function createFixtureBucket(values) {
  return {
    ...createEmptyAggregateBucket(),
    ...values
  };
}

// packages/core/src/pricing/versions.ts
var PRICING_CATALOG_VERSIONS = {
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
  cerebras: "cerebras-official-pricing-2026-08-18-usd"
};

// packages/core/src/pricing/anthropic.ts
var ANTHROPIC_PRICE_VERSION = PRICING_CATALOG_VERSIONS.anthropic;

// packages/core/src/pricing/cerebras.ts
var CEREBRAS_PRICE_VERSION = PRICING_CATALOG_VERSIONS.cerebras;

// packages/core/src/pricing/fireworks.ts
var FIREWORKS_PRICE_VERSION = PRICING_CATALOG_VERSIONS.fireworks;

// packages/core/src/pricing/groq.ts
var GROQ_PRICE_VERSION = PRICING_CATALOG_VERSIONS.groq;

// packages/core/src/pricing/google.ts
var GOOGLE_PRICE_VERSION = PRICING_CATALOG_VERSIONS.google;

// packages/core/src/pricing/minimax.ts
var MINIMAX_PRICE_VERSION = PRICING_CATALOG_VERSIONS.minimax;

// packages/core/src/pricing/mistral.ts
var MISTRAL_PRICE_VERSION = PRICING_CATALOG_VERSIONS.mistral;

// packages/core/src/pricing/moonshotai.ts
var MOONSHOTAI_PRICE_VERSION = PRICING_CATALOG_VERSIONS.moonshotai;

// packages/core/src/pricing/openai.ts
var OPENAI_PRICE_VERSION = PRICING_CATALOG_VERSIONS.openai;

// packages/core/src/pricing/together.ts
var TOGETHER_PRICE_VERSION = PRICING_CATALOG_VERSIONS.together;

// packages/core/src/pricing/deepseek.ts
var DEEPSEEK_PRICE_VERSION = PRICING_CATALOG_VERSIONS.deepseek;

// packages/core/src/pricing/xai.ts
var XAI_PRICE_VERSION = PRICING_CATALOG_VERSIONS.xai;

// packages/core/src/pricing-zone-countdown.ts
var BEIJING_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});
var PEAK_WINDOWS = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60]
];
function resolveDeepSeekPricingZoneCountdown(input) {
  if (input.pricingZone === "unknown") {
    return {
      currentZone: "unknown",
      currentZoneLabel: pricingZoneLabel("unknown"),
      nextZone: null,
      nextZoneLabel: null,
      transitionAt: null,
      transitionTimeLabel: null,
      remainingMs: null,
      remainingLabel: null
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
    remainingLabel: formatDuration(remainingMs)
  };
}
function nextDeepSeekPricingZoneTransition(now, parts) {
  const candidates = [
    transitionFor(parts, 0, 9, "peak"),
    transitionFor(parts, 0, 12, "offpeak"),
    transitionFor(parts, 0, 14, "peak"),
    transitionFor(parts, 0, 18, "offpeak"),
    transitionFor(parts, 1, 9, "peak")
  ];
  const transition = candidates.find((item) => item.at.getTime() > now.getTime());
  if (!transition) {
    return transitionFor(parts, 1, 9, "peak");
  }
  return transition;
}
function transitionFor(parts, dayOffset, hour, nextZone) {
  return {
    at: beijingLocalDate(parts, dayOffset, hour, 0, 0),
    nextZone,
    timeLabel: `${dayOffset === 0 ? "" : "\u660E\u65E5 "}${String(hour).padStart(2, "0")}:00`
  };
}
function resolveDeepSeekZoneFromBeijingParts(parts) {
  const minutes = parts.hour * 60 + parts.minute;
  return PEAK_WINDOWS.some(([start, end]) => minutes >= start && minutes < end) ? "peak" : "offpeak";
}
function getBeijingClockParts(date) {
  const parts = BEIJING_CLOCK.formatToParts(date);
  return {
    year: numberPart(parts, "year"),
    month: numberPart(parts, "month"),
    day: numberPart(parts, "day"),
    hour: numberPart(parts, "hour"),
    minute: numberPart(parts, "minute"),
    second: numberPart(parts, "second")
  };
}
function numberPart(parts, type) {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`missing Beijing clock part: ${type}`);
  return Number(value);
}
function beijingLocalDate(parts, dayOffset, hour, minute, second) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, hour - 8, minute, second, 0));
}
function pricingZoneLabel(zone) {
  if (zone === "peak") return "\u9AD8\u5CF0\u65F6\u6BB5";
  if (zone === "offpeak") return "\u7A7A\u95F2\u65F6\u6BB5";
  return "\u4E0D\u9002\u7528";
}
function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1e3));
  if (totalSeconds < 60) return `${totalSeconds}\u79D2`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}\u5C0F\u65F6`);
  if (minutes > 0) parts.push(`${minutes}\u5206\u949F`);
  if (hours === 0 && seconds > 0) parts.push(`${seconds}\u79D2`);
  return parts.join("");
}
function toValidDate(input) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid date input");
  }
  return date;
}

// packages/client/src/billing-insights.ts
function deriveBillingInsights(input) {
  return {
    cacheSavings: deriveCacheSavings(input.tokenBuckets ?? []),
    budget: deriveBudgetInsight({
      spent: input.spent,
      budgetThresholdMicroCny: input.budgetThresholdMicroCny,
      available: input.budgetAvailable,
      scopeLabel: input.scopeLabel
    }),
    pricingZoneCountdown: derivePricingZoneCountdown(input.pricingZone, input.now ?? /* @__PURE__ */ new Date())
  };
}
function deriveCacheSavings(tokenBuckets) {
  const cacheHit = tokenBuckets.find((bucket) => bucket.label === "\u7F13\u5B58\u547D\u4E2D");
  const cacheMiss = tokenBuckets.find((bucket) => bucket.label === "\u7F13\u5B58\u672A\u547D\u4E2D");
  const currency = cacheHit?.unitPrice?.currency ?? cacheMiss?.unitPrice?.currency ?? "CNY";
  const unavailable = {
    available: false,
    tokens: cacheHit?.tokens ?? 0,
    amount: null,
    label: "\u6682\u4E0D\u53EF\u7528"
  };
  if (!cacheHit || !cacheMiss || cacheHit.tokens <= 0) return unavailable;
  if (!cacheHit.unitPrice || !cacheMiss.unitPrice || cacheHit.unitPriceMixed || cacheMiss.unitPriceMixed) {
    return unavailable;
  }
  if ((cacheHit.unitPrice.currency ?? "CNY") !== (cacheMiss.unitPrice.currency ?? "CNY")) {
    return unavailable;
  }
  const savedPerMillionTokens = Math.max(0, cacheMiss.unitPrice.microCny - cacheHit.unitPrice.microCny);
  const savedMinor = Math.round(cacheHit.tokens * savedPerMillionTokens / 1e6);
  const amount = createAmountView(savedMinor, 3, currency);
  return {
    available: true,
    tokens: cacheHit.tokens,
    amount,
    label: amount.label
  };
}
function deriveBudgetInsight(input) {
  const threshold = createAmountView(input.budgetThresholdMicroCny);
  const comparableCurrency = !input.spent.currency || input.spent.currency === "CNY";
  const available = input.available ?? comparableCurrency;
  if (!available || !comparableCurrency) {
    return {
      level: "unavailable",
      available: false,
      spent: input.spent,
      threshold,
      ratio: null,
      percentLabel: null,
      message: null
    };
  }
  if (input.budgetThresholdMicroCny <= 0) {
    return {
      level: "off",
      available: true,
      spent: input.spent,
      threshold,
      ratio: null,
      percentLabel: null,
      message: null
    };
  }
  const ratio = input.spent.microCny / input.budgetThresholdMicroCny;
  const percentLabel = `${Math.round(ratio * 100)}%`;
  const level = ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : ratio >= 0.5 ? "notice" : "ok";
  const message = level === "danger" ? `${input.scopeLabel}\u5DF2\u8D85\u8FC7\u9884\u7B97\u9608\u503C ${threshold.label}\u3002` : level === "warning" ? `${input.scopeLabel}\u5DF2\u8FBE\u5230\u9884\u7B97\u9608\u503C ${percentLabel}\u3002` : level === "notice" ? `${input.scopeLabel}\u5DF2\u8FBE\u5230\u9884\u7B97\u9608\u503C ${percentLabel}\u3002` : null;
  return {
    level,
    available: true,
    spent: input.spent,
    threshold,
    ratio,
    percentLabel,
    message
  };
}
function derivePricingZoneCountdown(pricingZone, now) {
  const countdown = resolveDeepSeekPricingZoneCountdown({ now, pricingZone });
  return {
    currentZone: countdown.currentZone,
    currentZoneLabel: countdown.currentZoneLabel,
    nextZone: countdown.nextZone,
    nextZoneLabel: countdown.nextZoneLabel,
    transitionAt: countdown.transitionAt?.toISOString() ?? null,
    transitionTimeLabel: countdown.transitionTimeLabel,
    remainingMs: countdown.remainingMs,
    remainingLabel: countdown.remainingLabel
  };
}

// packages/client/src/store.ts
var DEFAULT_STORAGE_KEY = "mymeter.settings";
var SETTINGS_CHANGE_EVENT = "mymeter:settings-change";
var DEFAULT_SETTINGS = {
  reducedMotion: false,
  muted: true,
  refreshIntervalMs: 3e4,
  budgetThresholdMicroCny: 5e7,
  pinnedSessionId: null,
  overlayPosition: { x: 24, y: 24 },
  overlayEnabled: true,
  // The overlay is receipt-only. Full details live in the Token计费 page.
  overlayCollapsed: true
};
var STATUS_PRIORITY = {
  idle: 10,
  settled: 20,
  billing: 30,
  unknown: 40,
  balance_expired: 50,
  balance_insufficient: 60,
  aborted: 70,
  failed: 80
};
function loadPersistedSettings(storage, key = DEFAULT_STORAGE_KEY) {
  if (!storage) {
    return { ...DEFAULT_SETTINGS, overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return { ...DEFAULT_SETTINGS, overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
    }
    const parsed = JSON.parse(raw);
    return { ...normalizeSettings(parsed), overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
  } catch {
    return { ...DEFAULT_SETTINGS, overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
  }
}
function savePersistedSettings(storage, settings, key = DEFAULT_STORAGE_KEY) {
  if (!storage) {
    return;
  }
  storage.setItem(key, JSON.stringify({
    ...settings,
    overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition }
  }));
}
function clearPersistedSettings(storage, key = DEFAULT_STORAGE_KEY) {
  storage?.removeItem(key);
}
function normalizeSettings(input) {
  const base = { ...DEFAULT_SETTINGS, overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
  if (!input) {
    return base;
  }
  const overlayPosition = isPosition(input.overlayPosition) ? input.overlayPosition : base.overlayPosition;
  const refreshIntervalMs = typeof input.refreshIntervalMs === "number" && input.refreshIntervalMs >= 5e3 ? input.refreshIntervalMs : base.refreshIntervalMs;
  const budgetThresholdMicroCny = typeof input.budgetThresholdMicroCny === "number" && input.budgetThresholdMicroCny >= 0 ? input.budgetThresholdMicroCny : base.budgetThresholdMicroCny;
  return {
    reducedMotion: typeof input.reducedMotion === "boolean" ? input.reducedMotion : base.reducedMotion,
    muted: typeof input.muted === "boolean" ? input.muted : base.muted,
    refreshIntervalMs,
    budgetThresholdMicroCny,
    pinnedSessionId: typeof input.pinnedSessionId === "string" || input.pinnedSessionId === null ? input.pinnedSessionId : base.pinnedSessionId,
    overlayPosition,
    overlayEnabled: typeof input.overlayEnabled === "boolean" ? input.overlayEnabled : base.overlayEnabled,
    // Migrate legacy expanded-overlay preferences to the receipt-only UI.
    overlayCollapsed: true
  };
}
function resolvePrimaryStatus(requestStatus, balanceStatus, activeStatus) {
  const candidates = [requestStatus];
  if (activeStatus) {
    candidates.push(activeStatus);
  }
  if (balanceStatus === "expired" || balanceStatus === "stale") {
    candidates.push("balance_expired");
  }
  if (balanceStatus === "insufficient") {
    candidates.push("balance_insufficient");
  }
  return candidates.sort((a, b) => statusPriority(b) - statusPriority(a))[0] ?? "idle";
}
var RECEIPT_OVERLAY_SIZE = { width: 155, height: 280 };
function snapOverlayPosition(position, viewport = getViewportSize(), panelSize = RECEIPT_OVERLAY_SIZE, snapThreshold = 24) {
  const safeX = Number.isFinite(position.x) ? position.x : DEFAULT_SETTINGS.overlayPosition.x;
  const safeY = Number.isFinite(position.y) ? position.y : DEFAULT_SETTINGS.overlayPosition.y;
  const clampedX = clamp(Math.round(safeX), 0, Math.max(0, viewport.width - panelSize.width));
  const clampedY = clamp(Math.round(safeY), 0, Math.max(0, viewport.height - panelSize.height));
  let x = clampedX;
  let y = clampedY;
  let dockedEdge = null;
  if (x <= snapThreshold) {
    x = 0;
    dockedEdge = "left";
  } else if (viewport.width - (x + panelSize.width) <= snapThreshold) {
    x = Math.max(0, viewport.width - panelSize.width);
    dockedEdge = "right";
  } else if (y <= snapThreshold) {
    y = 0;
    dockedEdge = "top";
  } else if (viewport.height - (y + panelSize.height) <= snapThreshold) {
    y = Math.max(0, viewport.height - panelSize.height);
    dockedEdge = "bottom";
  }
  return { position: { x, y }, dockedEdge };
}
function buildViewModel(snapshot, settings, ui, asyncState = createIdleAsyncState({ treeAvailable: false, analyticsAvailable: false, usageAvailable: false, exportAvailable: false })) {
  const activeId = ui.selectedSessionId ?? settings.pinnedSessionId ?? snapshot.currentSessionId;
  const activeSession = activeId ? snapshot.sessions.find((session) => session.id === activeId) ?? null : null;
  const rawDetail = activeId ? snapshot.details[activeId] ?? null : null;
  const detail = rawDetail ? mapDetail(rawDetail, settings) : null;
  const activeStatus = detail?.status ?? activeSession?.status ?? null;
  const provider = activeId ? detail?.provider ?? activeSession?.provider ?? "unknown" : snapshot.summary.provider;
  const balances = mapBalances(snapshot, provider);
  const balance = selectBalance(balances, provider) ?? mapBalance(snapshot.balance, provider, formatProviderName(provider), isDeepSeekProvider(provider));
  const primaryBalanceStatus = balances.filter((candidate) => candidate.supported).map((candidate) => candidate.status).sort((left, right) => balanceStatusPriority(right) - balanceStatusPriority(left))[0] ?? "unavailable";
  const statusCode = resolvePrimaryStatus(
    snapshot.summary.status.code,
    primaryBalanceStatus,
    activeStatus
  );
  const currentRequest = detail?.currentRequest ?? createRequestAmountView(snapshot.summary.currentRequestMicroCny, snapshot.summary.status.code);
  const sessionTotal = detail?.sessionTotal ?? createAmountView(snapshot.summary.sessionTotalMicroCny);
  const settledTotal = detail?.settledTotal ?? createAmountView(snapshot.summary.settledTotalMicroCny);
  const estimatedTotal = detail?.estimatedTotal ?? createRequestAmountView(snapshot.summary.estimatedTotalMicroCny, snapshot.summary.status.code);
  const pricingZone = detail?.pricingZone ?? snapshot.summary.pricingZone;
  const scopeLabel = activeId ? `${activeSession?.title ?? rawDetail?.title ?? "\u4F1A\u8BDD"} (${activeId})` : "\u5168\u90E8\u4F1A\u8BDD";
  const snapped = snapOverlayPosition(settings.overlayPosition);
  const sessions = snapshot.sessions.map((session) => {
    return {
      id: session.id,
      title: session.title,
      provider: session.provider,
      model: session.model,
      reasoningEffort: session.reasoningEffort,
      agentPreset: session.agentPreset,
      status: session.status,
      currentRequest: session.currentRequestMinor !== void 0 ? createAmountView(session.currentRequestMinor, 3, session.currency ?? "CNY") : createRequestAmountView(session.currentRequestMicroCny, session.status),
      sessionTotal: session.sessionTotalMinor !== void 0 ? createAmountView(session.sessionTotalMinor, 3, session.currency ?? "CNY") : session.cnyEquivalentMicroCny !== null && session.cnyEquivalentMicroCny !== void 0 ? createAmountView(session.cnyEquivalentMicroCny) : createAmountView(session.sessionTotalMicroCny),
      unknownCount: session.unknownCount,
      lastActivityAt: session.lastActivityAt,
      isPinned: settings.pinnedSessionId === session.id,
      isActive: activeId === session.id
    };
  });
  const statusLabel2 = formatStatusLabel(statusCode);
  const hasGlobalMixedCurrency = (snapshot.summary.currencyTotals?.length ?? 0) > 1;
  const globalBudgetSpent = snapshot.summary.currencyTotals?.length === 1 && snapshot.summary.sessionTotalMinor !== void 0 ? createAmountView(snapshot.summary.sessionTotalMinor, 3, snapshot.summary.currency ?? "CNY") : snapshot.summary.currencyTotals && snapshot.summary.currencyTotals.length > 1 && snapshot.summary.cnyEquivalentMicroCny !== null && snapshot.summary.cnyEquivalentMicroCny !== void 0 ? createAmountView(snapshot.summary.cnyEquivalentMicroCny) : createAmountView(snapshot.summary.localTotalMicroCny);
  const insights = deriveBillingInsights({
    spent: globalBudgetSpent,
    budgetThresholdMicroCny: settings.budgetThresholdMicroCny,
    budgetAvailable: !hasGlobalMixedCurrency && (globalBudgetSpent.currency ?? "CNY") === "CNY",
    pricingZone,
    scopeLabel: "\u672C\u5730\u7D2F\u8BA1"
  });
  return {
    appName: "Token\u8BA1\u8D39",
    scope: {
      kind: activeId ? "session" : "global",
      label: scopeLabel,
      sessionId: activeId
    },
    status: {
      code: statusCode,
      label: statusLabel2,
      tone: formatTone(statusCode)
    },
    headline: statusLabel2,
    subheadline: `${snapshot.summary.model} \xB7 ${snapshot.summary.reasoningEffort} \xB7 ${snapshot.summary.agentPreset}`,
    provider,
    model: detail?.model ?? activeSession?.model ?? snapshot.summary.model,
    reasoningEffort: detail?.reasoningEffort ?? activeSession?.reasoningEffort ?? snapshot.summary.reasoningEffort,
    agentPreset: detail?.agentPreset ?? activeSession?.agentPreset ?? snapshot.summary.agentPreset,
    pricingZone,
    pricingZoneLabel: formatPricingZone(pricingZone),
    currentRequest,
    sessionTotal,
    settledTotal,
    estimatedTotal,
    currencyTotals: detail?.currencyTotals ?? (snapshot.summary.currencyTotals ? mapCurrencyTotals(snapshot.summary.currencyTotals) : []),
    cnyEquivalent: detail?.cnyEquivalent ?? (snapshot.summary.cnyEquivalentMicroCny === void 0 ? null : snapshot.summary.cnyEquivalentMicroCny === null ? null : createAmountView(snapshot.summary.cnyEquivalentMicroCny)),
    exchangeRate: snapshot.exchangeRate ? {
      status: snapshot.exchangeRate.status,
      rate: snapshot.exchangeRate.rate,
      fetchedAt: snapshot.exchangeRate.fetchedAt,
      source: snapshot.exchangeRate.source,
      error: snapshot.exchangeRate.error
    } : { status: "idle", rate: null, fetchedAt: null, source: null, error: null },
    localTotal: snapshot.summary.currencyTotals?.length === 1 && snapshot.summary.sessionTotalMinor !== void 0 ? createAmountView(snapshot.summary.sessionTotalMinor, 3, snapshot.summary.currency ?? "CNY") : snapshot.summary.currencyTotals && snapshot.summary.currencyTotals.length > 1 && snapshot.summary.cnyEquivalentMicroCny !== null && snapshot.summary.cnyEquivalentMicroCny !== void 0 ? createAmountView(snapshot.summary.cnyEquivalentMicroCny) : createAmountView(snapshot.summary.localTotalMicroCny),
    balance,
    balances,
    sessions,
    detail,
    overlay: {
      collapsed: true,
      pinnedSessionId: settings.pinnedSessionId,
      position: snapped.position,
      dockedEdge: snapped.dockedEdge,
      narrow: true
    },
    settings,
    insights,
    sessionCostTree: asyncState.sessionCostTree,
    costAnalytics: asyncState.costAnalytics,
    usageOverview: asyncState.usageOverview,
    ledgerExport: asyncState.ledgerExport,
    alerts: createAlerts(snapshot, statusCode, balances, insights.budget.message)
  };
}
function createMyMeterStore(options = {}) {
  const storage = options.storage === void 0 ? getDefaultStorage() : options.storage;
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const remote = options.remote ?? createStaticRemote(createEmptySnapshot());
  const settingsSource = {};
  let remoteSnapshot = remote.getSnapshot();
  let settings = loadPersistedSettings(storage, storageKey);
  let asyncState = createIdleAsyncState({
    treeAvailable: Boolean(remote.getSessionCostTree),
    analyticsAvailable: Boolean(remote.getCostAnalytics),
    usageAvailable: Boolean(remote.getUsageOverview),
    exportAvailable: Boolean(remote.exportLedger)
  });
  let sessionCostTreeRequestId = 0;
  let costAnalyticsRequestId = 0;
  let usageOverviewRequestId = 0;
  const usageOverviewCache = /* @__PURE__ */ new Map();
  let ledgerExportRequestId = 0;
  let ui = {
    selectedSessionId: settings.pinnedSessionId,
    activePanel: "compact",
    overlayVisible: true,
    searchQuery: "",
    sortBy: "recent",
    filterStatus: "all",
    analyticsRange: "today"
  };
  let lastSyncedSessionId = remoteSnapshot.currentSessionId;
  let lastLedgerGeneration = remoteSnapshot.ledgerGeneration;
  let lastOverviewDayKey = usageOverviewDayKey();
  let usageOverviewRefreshTimer = null;
  let state = recompute(remoteSnapshot, settings, ui, asyncState);
  const listeners = /* @__PURE__ */ new Set();
  const persistAndEmit = (nextSettings = settings) => {
    settings = normalizeSettings(nextSettings);
    state = recompute(remoteSnapshot, settings, ui, asyncState);
    emit();
    try {
      savePersistedSettings(storage, settings, storageKey);
    } catch {
    }
    publishSettingsChange(storage, storageKey, settings, settingsSource);
  };
  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };
  const unsubscribeRemote = remote.subscribe((snapshot) => {
    const ledgerChanged = snapshot.ledgerGeneration !== void 0 && snapshot.ledgerGeneration !== lastLedgerGeneration;
    const currentOverviewDayKey = usageOverviewDayKey();
    const dayChanged = currentOverviewDayKey !== lastOverviewDayKey;
    lastOverviewDayKey = currentOverviewDayKey;
    lastLedgerGeneration = snapshot.ledgerGeneration;
    remoteSnapshot = snapshot;
    state = recompute(remoteSnapshot, settings, ui, asyncState);
    emit();
    if ((ledgerChanged || dayChanged) && remote.getUsageOverview && asyncState.usageOverview.data) {
      usageOverviewCache.clear();
      if (usageOverviewRefreshTimer === null) {
        usageOverviewRefreshTimer = setTimeout(() => {
          usageOverviewRefreshTimer = null;
          void store.loadUsageOverview(ui.analyticsRange);
        }, 500);
      }
    }
  });
  const unsubscribeSettings = subscribeToSettingsChanges(
    storage,
    storageKey,
    settingsSource,
    (nextSettings) => {
      settings = {
        ...normalizeSettings(nextSettings),
        overlayPosition: { ...settings.overlayPosition }
      };
      state = recompute(remoteSnapshot, settings, ui, asyncState);
      emit();
    }
  );
  const setUi = (patch) => {
    ui = { ...ui, ...patch };
    state = recompute(remoteSnapshot, settings, ui, asyncState);
    emit();
  };
  const setAsyncState = (patch) => {
    asyncState = { ...asyncState, ...patch };
    state = recompute(remoteSnapshot, settings, ui, asyncState);
    emit();
  };
  const store = {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      unsubscribeRemote();
      unsubscribeSettings();
      if (usageOverviewRefreshTimer !== null) clearTimeout(usageOverviewRefreshTimer);
      usageOverviewRefreshTimer = null;
      listeners.clear();
    },
    selectSession(sessionId) {
      setUi({ selectedSessionId: sessionId, activePanel: sessionId ? "detail" : "sessions" });
    },
    syncCurrentSession(sessionId) {
      if (settings.pinnedSessionId !== null) {
        lastSyncedSessionId = sessionId;
        return;
      }
      const hasExplicitSelection = ui.selectedSessionId !== null && ui.selectedSessionId !== lastSyncedSessionId;
      if (hasExplicitSelection || ui.selectedSessionId === sessionId) {
        lastSyncedSessionId = sessionId;
        return;
      }
      lastSyncedSessionId = sessionId;
      setUi({ selectedSessionId: sessionId });
    },
    setActivePanel(panel) {
      setUi({ activePanel: panel });
    },
    setSearchQuery(query) {
      setUi({ searchQuery: query });
    },
    setSortBy(sortBy) {
      setUi({ sortBy });
    },
    setFilterStatus(status) {
      setUi({ filterStatus: status });
    },
    setAnalyticsRange(range) {
      setUi({ analyticsRange: range });
      void store.loadUsageOverview(range);
    },
    setSettings(patch) {
      persistAndEmit({ ...settings, ...patch });
    },
    resetSettings() {
      settings = { ...DEFAULT_SETTINGS, overlayPosition: { ...DEFAULT_SETTINGS.overlayPosition } };
      ui = { ...ui, selectedSessionId: null };
      state = recompute(remoteSnapshot, settings, ui, asyncState);
      emit();
      try {
        clearPersistedSettings(storage, storageKey);
      } catch {
      }
      publishSettingsChange(storage, storageKey, settings, settingsSource);
    },
    setReducedMotion(reducedMotion) {
      persistAndEmit({ ...settings, reducedMotion });
    },
    setMuted(muted) {
      persistAndEmit({ ...settings, muted });
    },
    setRefreshIntervalMs(refreshIntervalMs) {
      persistAndEmit({ ...settings, refreshIntervalMs });
    },
    setBudgetThresholdMicroCny(budgetThresholdMicroCny) {
      persistAndEmit({ ...settings, budgetThresholdMicroCny });
    },
    setPinnedSessionId(sessionId) {
      persistAndEmit({ ...settings, pinnedSessionId: sessionId });
      setUi({ selectedSessionId: sessionId });
    },
    setOverlayPosition(position) {
      const snapped = snapOverlayPosition(position);
      settings = normalizeSettings({ ...settings, overlayPosition: snapped.position });
      state = recompute(remoteSnapshot, settings, ui, asyncState);
      emit();
    },
    setOverlayEnabled(enabled) {
      persistAndEmit({ ...settings, overlayEnabled: enabled });
    },
    setOverlayCollapsed(_collapsed) {
    },
    setOverlayVisible(visible) {
      setUi({ overlayVisible: visible });
    },
    async refreshExchangeRate() {
      if (!remote.refreshExchangeRate) return;
      await remote.refreshExchangeRate();
    },
    async refreshBalance() {
      if (!remote.refreshBalance) return;
      await remote.refreshBalance();
    },
    async loadSessionCostTree() {
      if (!remote.getSessionCostTree) return;
      const requestId = ++sessionCostTreeRequestId;
      setAsyncState({ sessionCostTree: { ...asyncState.sessionCostTree, status: "loading", error: null } });
      try {
        const tree = await remote.getSessionCostTree();
        if (requestId !== sessionCostTreeRequestId) return;
        setAsyncState({ sessionCostTree: { status: "ready", data: mapSessionCostTree(tree), error: null } });
      } catch (error) {
        if (requestId !== sessionCostTreeRequestId) return;
        setAsyncState({ sessionCostTree: { status: "error", data: asyncState.sessionCostTree.data, error: errorMessage(error) } });
      }
    },
    async loadCostAnalytics() {
      if (!remote.getCostAnalytics) return;
      const requestId = ++costAnalyticsRequestId;
      setAsyncState({ costAnalytics: { ...asyncState.costAnalytics, status: "loading", error: null } });
      try {
        const report = await remote.getCostAnalytics();
        if (requestId !== costAnalyticsRequestId) return;
        setAsyncState({ costAnalytics: { status: "ready", data: mapCostAnalytics(report), error: null } });
      } catch (error) {
        if (requestId !== costAnalyticsRequestId) return;
        setAsyncState({ costAnalytics: { status: "error", data: asyncState.costAnalytics.data, error: errorMessage(error) } });
      }
    },
    async loadUsageOverview(range = ui.analyticsRange) {
      if (!remote.getUsageOverview) return;
      const currentRange = range;
      const cached = usageOverviewCache.get(currentRange);
      if (cached?.dayKey === usageOverviewDayKey()) {
        setAsyncState({ usageOverview: { status: "ready", data: cached.data, error: null } });
        return;
      }
      if (cached) {
        usageOverviewCache.delete(currentRange);
      }
      const requestId = ++usageOverviewRequestId;
      const previousData = asyncState.usageOverview.data?.range === currentRange ? asyncState.usageOverview.data : null;
      setAsyncState({ usageOverview: { status: "loading", data: previousData, error: null } });
      try {
        const report = await remote.getUsageOverview({ range: currentRange });
        if (requestId !== usageOverviewRequestId || ui.analyticsRange !== currentRange) return;
        const mapped = mapUsageOverview(report);
        usageOverviewCache.set(currentRange, { dayKey: usageOverviewDayKey(mapped.timeZone), data: mapped });
        setAsyncState({ usageOverview: { status: "ready", data: mapped, error: null } });
      } catch (error) {
        if (requestId !== usageOverviewRequestId || ui.analyticsRange !== currentRange) return;
        setAsyncState({ usageOverview: { status: "error", data: previousData, error: errorMessage(error) } });
      }
    },
    async exportLedger(format) {
      if (!remote.exportLedger) return;
      const requestId = ++ledgerExportRequestId;
      setAsyncState({ ledgerExport: { ...asyncState.ledgerExport, status: "loading", format, error: null } });
      try {
        const content = await remote.exportLedger(format);
        if (requestId !== ledgerExportRequestId) return;
        downloadLedgerExport({ format, content });
        setAsyncState({
          ledgerExport: {
            status: "ready",
            format,
            error: null,
            lastDownloadedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
      } catch (error) {
        if (requestId !== ledgerExportRequestId) return;
        setAsyncState({ ledgerExport: { ...asyncState.ledgerExport, status: "error", format, error: errorMessage(error) } });
      }
    }
  };
  return store;
}
function publishSettingsChange(storage, storageKey, settings, source) {
  if (!storage || typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT, {
    detail: { storage, storageKey, settings, source }
  }));
}
function subscribeToSettingsChanges(storage, storageKey, source, listener) {
  if (!storage || typeof window === "undefined") {
    return () => {
    };
  }
  const handleSettingsChange = (event) => {
    const detail = event.detail;
    if (detail?.storage !== storage || detail.storageKey !== storageKey || detail.source === source) {
      return;
    }
    listener(detail.settings);
  };
  const handleStorage = (event) => {
    if (event.key !== storageKey || event.storageArea !== storage) {
      return;
    }
    listener(loadPersistedSettings(storage, storageKey));
  };
  window.addEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
    window.removeEventListener("storage", handleStorage);
  };
}
function recompute(remote, settings, ui, asyncState) {
  return {
    remote,
    settings,
    ui,
    viewModel: buildViewModel(remote, settings, ui, asyncState)
  };
}
function mapDetail(detail, settings) {
  const tokenBuckets = mapTokenBuckets(detail.tokenBuckets);
  const turns = mapTurns(detail.turns);
  const stages = detail.stages.map(mapStage);
  const currencyTotals = detail.currencyTotals ? mapCurrencyTotals(detail.currencyTotals) : [];
  const singleCurrency = currencyTotals.length === 1 ? currencyTotals[0] : null;
  const settledTotal = singleCurrency?.settled ?? createAmountView(detail.settledTotalMicroCny);
  const estimatedTotal = singleCurrency?.estimated ?? createRequestAmountView(detail.estimatedTotalMicroCny, detail.status);
  const sessionTotal = singleCurrency?.amount ?? (detail.cnyEquivalentMicroCny !== null && detail.cnyEquivalentMicroCny !== void 0 ? createAmountView(detail.cnyEquivalentMicroCny) : createAmountView(detail.sessionTotalMicroCny));
  return {
    id: detail.id,
    title: detail.title,
    provider: detail.provider,
    model: detail.model,
    reasoningEffort: detail.reasoningEffort,
    agentPreset: detail.agentPreset,
    status: detail.status,
    pricingZone: detail.pricingZone,
    pricingZoneLabel: formatPricingZone(detail.pricingZone),
    currentRequest: createRequestAmountView(detail.currentRequestMicroCny, detail.status),
    sessionTotal,
    settledTotal,
    estimatedTotal,
    unknownCount: detail.unknownCount,
    tokenBuckets,
    contextBreakdown: mapContextBreakdown(detail.contextBreakdown),
    turns,
    stages,
    insights: deriveBillingInsights({
      tokenBuckets,
      spent: createAmountView(detail.settledTotalMicroCny + detail.estimatedTotalMicroCny),
      budgetThresholdMicroCny: settings.budgetThresholdMicroCny,
      budgetAvailable: currencyTotals.length <= 1 && (!singleCurrency || singleCurrency.currency === "CNY"),
      pricingZone: detail.pricingZone,
      scopeLabel: "\u4F1A\u8BDD\u8D39\u7528"
    }),
    timeline: turns.map((turn) => ({
      label: turn.label,
      at: turn.completedAt ?? turn.startedAt,
      status: turn.status,
      amount: turn.amount
    })),
    currencyTotals,
    cnyEquivalent: detail.cnyEquivalentMicroCny === void 0 || detail.cnyEquivalentMicroCny === null ? null : createAmountView(detail.cnyEquivalentMicroCny)
  };
}
function mapStage(stage) {
  return {
    id: stage.id,
    index: stage.index,
    isCurrent: stage.isCurrent,
    startedAt: stage.startedAt,
    completedAt: stage.completedAt,
    lastActivityAt: stage.lastActivityAt,
    status: stage.status,
    model: stage.model,
    reasoningEffort: stage.reasoningEffort,
    agentPreset: stage.agentPreset,
    pricingZone: stage.pricingZone,
    pricingZoneLabel: formatPricingZone(stage.pricingZone),
    priceVersion: stage.priceVersion,
    exchangeRateLabel: stage.exchangeRateLabel ?? null,
    currentRequest: createAmountView(stage.currentRequestMinor ?? stage.currentRequestMicroCny, 3, stage.currency ?? "CNY"),
    sessionTotal: createAmountView(stage.totalMinor ?? stage.totalMicroCny, 3, stage.currency ?? "CNY"),
    settledTotal: createAmountView(stage.settledTotalMinor ?? stage.settledTotalMicroCny, 3, stage.currency ?? "CNY"),
    estimatedTotal: createAmountView(stage.estimatedTotalMinor ?? stage.estimatedTotalMicroCny, 3, stage.currency ?? "CNY"),
    unknownCount: stage.unknownCount,
    tokenBuckets: mapTokenBuckets(stage.tokenBuckets),
    turns: mapTurns(stage.turns),
    contextBreakdown: mapContextBreakdown(stage.contextBreakdown),
    ...stage.currency ? { currency: stage.currency } : {}
  };
}
function mapTokenBuckets(buckets) {
  return buckets.map((bucket) => {
    return {
      label: bucket.label,
      tokens: bucket.tokens,
      amount: createAmountView(bucket.amountMinor ?? bucket.amountMicroCny, 3, bucket.currency ?? "CNY"),
      unitPrice: typeof (bucket.unitPriceMinorPerMillionTokens ?? bucket.unitPriceMicroCnyPerMillionTokens) === "number" ? createAmountView(bucket.unitPriceMinorPerMillionTokens ?? bucket.unitPriceMicroCnyPerMillionTokens, 3, bucket.currency ?? "CNY") : null,
      unitPriceMixed: bucket.unitPriceMixed === true
    };
  });
}
function mapTurns(turns) {
  return turns.map((turn) => {
    return {
      id: turn.id,
      label: turn.label,
      startedAt: turn.startedAt,
      completedAt: turn.completedAt,
      status: turn.status,
      pricingZone: turn.pricingZone,
      cacheHitTokens: turn.cacheHitTokens,
      cacheMissTokens: turn.cacheMissTokens,
      outputTokens: turn.outputTokens,
      reasoningTokens: turn.reasoningTokens,
      amount: createAmountView(turn.amountMinor ?? turn.amountMicroCny, 3, turn.currency ?? "CNY"),
      note: turn.note
    };
  });
}
function mapCurrencyTotals(totals) {
  return totals.map((total) => ({
    currency: total.currency,
    amount: createAmountView(total.amountMinor, 3, total.currency),
    settled: createAmountView(total.settledMinor, 3, total.currency),
    estimated: createAmountView(total.estimatedMinor, 3, total.currency),
    failed: createAmountView(total.failedMinor, 3, total.currency)
  }));
}
function mapContextBreakdown(contextBreakdown) {
  return contextBreakdown ? {
    systemTokens: contextBreakdown.systemTokens,
    toolsTokens: contextBreakdown.toolsTokens,
    messageTokens: contextBreakdown.messageTokens
  } : null;
}
function createIdleAsyncState(input) {
  return {
    sessionCostTree: {
      status: input.treeAvailable ? "idle" : "unavailable",
      data: null,
      error: null
    },
    costAnalytics: {
      status: input.analyticsAvailable ? "idle" : "unavailable",
      data: null,
      error: null
    },
    usageOverview: {
      status: input.usageAvailable ? "idle" : "unavailable",
      data: null,
      error: null
    },
    ledgerExport: {
      status: input.exportAvailable ? "idle" : "unavailable",
      format: null,
      error: null,
      lastDownloadedAt: null
    }
  };
}
function mapSessionCostTree(tree) {
  return {
    total: createAmountView(tree.summary.totalMicroCny),
    requestCount: tree.summary.requestCount,
    roots: tree.roots.map((node) => mapSessionCostTreeNode(node, tree.nodes)),
    anomalyLabels: [
      ...tree.anomalies.missingParents.map((item) => `${item.sessionId} \u7F3A\u5C11\u7236\u4F1A\u8BDD ${item.parentSessionId}`),
      ...tree.anomalies.cycles.map((cycle) => `\u5FAA\u73AF\u5173\u7CFB ${cycle.join(" -> ")}`)
    ]
  };
}
function mapSessionCostTreeNode(node, nodes) {
  const anomalyLabels = [
    ...node.orphaned ? ["\u7236\u4F1A\u8BDD\u7F3A\u5931"] : [],
    ...node.cyclic ? ["\u5FAA\u73AF\u65AD\u5F00"] : []
  ];
  return {
    id: node.id,
    title: node.title,
    depth: node.depth,
    total: createAmountView(node.summary.totalMicroCny),
    subtreeTotal: createAmountView(node.subtreeSummary.totalMicroCny),
    requestCount: node.summary.requestCount,
    childCount: node.childSessionIds.length,
    anomalyLabels,
    children: node.childSessionIds.map((childId) => nodes[childId]).filter((child) => Boolean(child)).map((child) => mapSessionCostTreeNode(child, nodes))
  };
}
function mapCostAnalytics(report) {
  return {
    generatedAt: report.generatedAt,
    total: createAmountView(report.global.totalMicroCny),
    requestCount: report.global.requestCount,
    dailyTrend: report.dailyTrend.map(mapTrendBucket),
    hourlyTrend: report.hourlyTrend.map(mapTrendBucket),
    anomalies: report.anomalies.map((anomaly) => ({
      ruleId: anomaly.ruleId,
      severity: anomaly.severity,
      bucketKey: anomaly.bucketKey,
      explanation: anomaly.explanation
    }))
  };
}
function mapUsageOverview(report) {
  return {
    range: report.range,
    timeZone: report.timeZone,
    generatedAt: report.generatedAt,
    total: createAmountView(report.totals.amountMicroCny),
    totalTokens: report.totals.totalTokens,
    requestCount: report.totals.requestCount,
    pricedRequestCount: report.totals.pricedRequestCount,
    unknownRequestCount: report.totals.unknownRequestCount,
    coverage: report.totals.coverage,
    trend: report.trend.map((bucket) => ({
      key: bucket.key,
      startAt: bucket.startAt,
      endAt: bucket.endAt,
      amount: createAmountView(bucket.amountMicroCny),
      totalTokens: bucket.totalTokens,
      requestCount: bucket.requestCount,
      coverage: bucket.coverage,
      models: (bucket.models ?? []).map((model) => ({
        provider: model.provider,
        model: model.model,
        amount: createAmountView(model.amountMicroCny),
        totalTokens: model.totalTokens,
        requestCount: model.requestCount,
        pricedRequestCount: model.pricedRequestCount,
        unknownRequestCount: model.unknownRequestCount,
        coverage: model.coverage
      }))
    })),
    topModels: report.topModels.map((model) => ({
      provider: model.provider,
      model: model.model,
      amount: createAmountView(model.amountMicroCny),
      totalTokens: model.totalTokens,
      requestCount: model.requestCount,
      pricedRequestCount: model.pricedRequestCount,
      unknownRequestCount: model.unknownRequestCount,
      coverage: model.coverage
    }))
  };
}
function usageOverviewDayKey(timeZone = "Asia/Shanghai", value = Date.now()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(value));
  } catch {
    return new Date(value).toISOString().slice(0, 10);
  }
}
function mapTrendBucket(bucket) {
  return {
    key: bucket.key,
    amount: createAmountView(bucket.amountMicroCny),
    previousAmount: bucket.previousAmountMicroCny === null ? null : createAmountView(bucket.previousAmountMicroCny),
    deltaLabel: formatDelta(bucket.deltaMicroCny, bucket.deltaRatio),
    requestCount: bucket.requestCount,
    statusLabel: `\u7ED3\u7B97 ${bucket.statusCounts.settled} \xB7 \u4F30\u7B97 ${bucket.statusCounts.estimated} \xB7 \u672A\u77E5 ${bucket.statusCounts.unknown} \xB7 \u5931\u8D25 ${bucket.statusCounts.failed}`
  };
}
function formatDelta(deltaMicroCny, deltaRatio) {
  if (deltaMicroCny === null || deltaRatio === null) return "\u65E0\u524D\u503C";
  const amount = createAmountView(Math.abs(deltaMicroCny)).label;
  const percent = `${Math.round(Math.abs(deltaRatio - 1) * 100)}%`;
  if (deltaMicroCny > 0) return `+${amount} / +${percent}`;
  if (deltaMicroCny < 0) return `-${amount} / -${percent}`;
  return "\u65E0\u53D8\u5316";
}
function downloadLedgerExport(exported) {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") {
    return;
  }
  const type = exported.format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8";
  const blob = new Blob([exported.content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `mymeter-ledger-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.${exported.format}`;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
var DEEPSEEK_RECHARGE_URL = "https://platform.deepseek.com/top_up";
var BALANCE_WARNING_THRESHOLD_MICROS = 5e6;
function mapBalances(snapshot, activeProvider) {
  const remoteBalances = snapshot.balances ?? [];
  if (remoteBalances.length > 0) {
    return remoteBalances.filter((balance) => balance.supported && isDeepSeekProvider(balance.provider)).map((balance) => mapBalance(
      balance.supported && isDeepSeekProvider(balance.provider) ? { ...balance, ...snapshot.balance } : balance,
      balance.provider,
      balance.providerName,
      balance.supported
    ));
  }
  const providers = uniqueProviders([
    activeProvider,
    snapshot.summary.provider,
    ...snapshot.sessions.map((session) => session.provider),
    ...Object.values(snapshot.details).map((detail) => detail.provider)
  ]);
  return providers.filter(isDeepSeekProvider).map((provider) => mapBalance(
    snapshot.balance,
    provider,
    formatProviderName(provider),
    true
  ));
}
function mapBalance(balance, provider, providerName, supported) {
  const currency = supported ? normalizeBalanceCurrency(balance.currency) : null;
  const totalMicro = supported ? balance.totalMicroCny : null;
  const grantedMicro = supported ? balance.grantedMicroCny : null;
  const toppedUpMicro = supported ? balance.toppedUpMicroCny : null;
  const needsRecharge = supported && (currency === "CNY" || currency === "USD") && totalMicro !== null && totalMicro < BALANCE_WARNING_THRESHOLD_MICROS;
  const status = supported ? needsRecharge && balance.status === "fresh" ? "insufficient" : balance.status : "unavailable";
  const statusLabel2 = status === "expired" ? `${providerName}\u8D26\u6237\u4F59\u989D\uFF08\u8FC7\u671F\uFF09` : status === "stale" ? `${providerName}\u8D26\u6237\u4F59\u989D\uFF08\u8FC7\u671F\uFF09` : status === "insufficient" ? `${providerName}\u8D26\u6237\u4F59\u989D\uFF08\u4E0D\u8DB3\uFF09` : status === "unavailable" ? `${providerName}\u8D26\u6237\u4F59\u989D\uFF08\u4E0D\u53EF\u7528\uFF09` : `${providerName}\u8D26\u6237\u4F59\u989D`;
  return {
    provider,
    providerName,
    label: statusLabel2,
    status,
    supported,
    currency,
    total: nullableBalanceAmount(totalMicro, currency, needsRecharge),
    granted: nullableBalanceAmount(grantedMicro, currency),
    toppedUp: nullableBalanceAmount(toppedUpMicro, currency),
    refreshedAt: supported ? balance.refreshedAt : null,
    rechargeUrl: supported && isDeepSeekProvider(provider) ? DEEPSEEK_RECHARGE_URL : null,
    needsRecharge,
    rechargeThresholdLabel: supported && currency ? formatBalanceThreshold(currency) : null
  };
}
function selectBalance(balances, provider) {
  const normalized = normalizeProviderId(provider);
  const exact = balances.find((balance) => normalizeProviderId(balance.provider) === normalized);
  if (exact) return exact;
  if (isDeepSeekProvider(provider)) {
    const deepSeek = balances.find((balance) => isDeepSeekProvider(balance.provider));
    if (deepSeek) return deepSeek;
  }
  if (normalized === "unknown") return balances.find((balance) => balance.supported) ?? balances[0] ?? null;
  return null;
}
function uniqueProviders(providers) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const provider of providers) {
    const normalized = normalizeProviderId(provider);
    if (normalized === "unknown" || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(provider);
  }
  return result;
}
function normalizeProviderId(provider) {
  return provider.trim().toLowerCase() || "unknown";
}
function formatProviderName(provider) {
  const normalized = normalizeProviderId(provider);
  if (isDeepSeekProvider(normalized)) return "DeepSeek";
  if (normalized === "openai") return "OpenAI";
  if (normalized === "anthropic") return "Anthropic";
  if (normalized === "google" || normalized === "gemini") return "Google Gemini";
  return provider.trim() || "\u672A\u77E5\u5382\u5546";
}
function nullableBalanceAmount(micros, currency, preserveLowBalanceBoundary = false) {
  if (micros === null) return null;
  const roundedToThreshold = Math.round(micros / 1e3) === 5e3;
  const amount = createAmountView(micros, preserveLowBalanceBoundary && roundedToThreshold ? 6 : 3);
  const symbol = currency === "USD" ? "$" : currency === "CNY" ? "\xA5" : currency ? `${currency} ` : "\xA5";
  return {
    ...amount,
    label: amount.label.replace("\xA5", symbol),
    detailLabel: amount.detailLabel.replace("\xA5", symbol)
  };
}
function normalizeBalanceCurrency(currency) {
  const normalized = currency?.trim().toUpperCase();
  return normalized || "CNY";
}
function isDeepSeekProvider(provider) {
  const normalized = normalizeProviderId(provider);
  return normalized === "deepseek" || normalized === "deepseek-official";
}
function balanceStatusPriority(status) {
  if (status === "insufficient") return 3;
  if (status === "expired" || status === "stale") return 2;
  if (status === "fresh") return 1;
  return 0;
}
function formatBalanceThreshold(currency) {
  return currency === "USD" ? "$5" : currency === "CNY" ? "\xA55" : `${currency} 5`;
}
function createRequestAmountView(microCny, status) {
  if (status !== "unknown" && status !== "aborted") {
    return createAmountView(microCny);
  }
  const estimate = createAmountView(microCny);
  return {
    ...estimate,
    label: `${estimate.label}\uFF08\u4F30\u7B97\uFF09`,
    detailLabel: `${estimate.detailLabel}\uFF08\u4F30\u7B97\uFF09`
  };
}
function createAlerts(snapshot, statusCode, balances, budgetMessage) {
  const alerts = [];
  if (snapshot.connection.status === "stale") {
    alerts.push("Remote \u8FDE\u63A5\u5DF2\u8FC7\u671F\uFF0C\u6B63\u5728\u663E\u793A\u6700\u8FD1\u5FEB\u7167\u3002");
  }
  if (snapshot.connection.status === "error" && snapshot.connection.message) {
    alerts.push(snapshot.connection.message);
  }
  if (balances.some((balance) => balance.supported && (balance.status === "expired" || balance.status === "stale"))) {
    alerts.push("\u4F59\u989D\u5FEB\u7167\u5DF2\u8FC7\u671F\uFF0C\u4E0D\u5F71\u54CD DSH \u672C\u5730\u7D2F\u8BA1\u3002");
  }
  for (const balance of balances) {
    if (balance.needsRecharge) {
      alerts.push(`${balance.providerName} \u8D26\u6237\u4F59\u989D\u4F4E\u4E8E ${balance.rechargeThresholdLabel ?? "5"}\uFF0C\u8BF7\u53CA\u65F6\u5145\u503C\u3002`);
    }
  }
  if (statusCode === "unknown") {
    alerts.push("\u672C\u8F6E\u8D39\u7528\u4E3A\u4F30\u7B97\u503C\uFF0C\u5DF2\u6309\u53EF\u7528 Token \u8BA1\u7B97\u3002");
  }
  if (statusCode === "failed") {
    alerts.push("\u8BF7\u6C42\u5931\u8D25\uFF0C\u5DF2\u6309\u53EF\u7528 usage \u8BA1\u7B97\u4F30\u7B97\u8D39\u7528\u3002");
  }
  if (statusCode === "aborted") {
    alerts.push("\u8BF7\u6C42\u5DF2\u4E2D\u6B62\uFF0C\u8D39\u7528\u6309\u53EF\u7528 Token \u4F30\u7B97\u3002");
  }
  if (budgetMessage) {
    alerts.push(budgetMessage);
  }
  return alerts;
}
function formatPricingZone(zone) {
  if (zone === "peak") {
    return "\u9AD8\u5CF0\u65F6\u6BB5";
  }
  if (zone === "offpeak") {
    return "\u7A7A\u95F2\u65F6\u6BB5";
  }
  return "\u4E0D\u9002\u7528";
}
function isPosition(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value;
  return typeof candidate.x === "number" && typeof candidate.y === "number";
}
function getDefaultStorage() {
  try {
    const maybeGlobal = globalThis;
    const storage = maybeGlobal.localStorage;
    if (storage && typeof storage.getItem === "function" && typeof storage.setItem === "function" && typeof storage.removeItem === "function") {
      return storage;
    }
  } catch {
    return null;
  }
  return null;
}
function getViewportSize() {
  const maybeWindow = globalThis;
  const w = maybeWindow.innerWidth;
  const h = maybeWindow.innerHeight;
  return {
    width: typeof w === "number" && w > 0 ? w : 1024,
    height: typeof h === "number" && h > 0 ? h : 768
  };
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function statusPriority(status) {
  return STATUS_PRIORITY[status];
}
function createStaticRemote(snapshot) {
  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe() {
      return () => {
      };
    }
  };
}
function createEmptySnapshot() {
  return {
    connection: { status: "connected", message: null },
    currentSessionId: null,
    summary: {
      status: { code: "idle" },
      provider: "unknown",
      model: "unknown",
      reasoningEffort: "unknown",
      agentPreset: "unknown",
      currentRequestMicroCny: 0,
      sessionTotalMicroCny: 0,
      settledTotalMicroCny: 0,
      estimatedTotalMicroCny: 0,
      localTotalMicroCny: 0,
      pricingZone: "unknown"
    },
    balance: {
      status: "unavailable",
      currency: null,
      totalMicroCny: null,
      grantedMicroCny: null,
      toppedUpMicroCny: null,
      refreshedAt: null
    },
    balances: [],
    sessions: [],
    details: {}
  };
}

// packages/client/src/components.tsx
var import_react4 = require("react");

// packages/client/src/analytics-chart.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var DSH_COLORS = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  tertiary: "var(--dsw-alias-label-tertiary, #6b7280)",
  layer1: "var(--dsw-alias-bg-layer-1, #ffffff)",
  layer2: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)",
  brand: "var(--dsw-alias-brand-primary, #2563eb)"
};
var shellStyle = {
  display: "grid",
  gap: 6,
  padding: "8px 8px 6px",
  border: `1px solid ${DSH_COLORS.border1}`,
  borderRadius: 6,
  background: DSH_COLORS.layer1
};
var emptyStyle = {
  margin: 0,
  padding: "16px 4px",
  color: DSH_COLORS.tertiary,
  fontSize: 11,
  textAlign: "center"
};
var labelRowStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(42px, 1fr))",
  gap: 4,
  color: DSH_COLORS.secondary,
  fontSize: 9,
  fontVariantNumeric: "tabular-nums"
};
var MODEL_COLORS = [
  "var(--dsw-alias-brand-primary, #2563eb)",
  "var(--dsw-alias-state-success-primary, #059669)",
  "var(--dsw-alias-state-warning-primary, #d97706)",
  "var(--dsw-alias-state-error-primary, #dc2626)",
  "var(--dsw-alias-state-info-primary, #0891b2)",
  "var(--dsw-alias-label-secondary, #7c3aed)"
];
function chartBuckets(range, trend) {
  return range === "today" ? trend.slice(-24) : trend.slice(range === "7d" ? -7 : -30);
}
function chartLabel(range) {
  if (range === "today") return "\u4ECA\u65E5\u6309\u5C0F\u65F6\u8D39\u7528\u8D8B\u52BF";
  return range === "7d" ? "7\u5929\u6309\u5929\u8D39\u7528\u8D8B\u52BF" : "30\u5929\u6309\u5929\u8D39\u7528\u8D8B\u52BF";
}
function bucketLabel(range, key) {
  if (range !== "today") {
    const date = key.match(/^\d{4}-(\d{2})-(\d{2})$/u);
    return date ? `${date[1]}-${date[2]}` : key;
  }
  const hour = key.match(/T(\d{2})$/u)?.[1] ?? key.slice(-2);
  return `${hour}:00`;
}
function bucketTooltipLabel(range, key) {
  if (range === "today") return bucketLabel(range, key);
  return key;
}
function modelKey(model) {
  return `${model.provider}\0${model.model}`;
}
function modelLabel(model) {
  return model.provider && model.provider !== "unknown" ? `${model.provider} \xB7 ${model.model}` : model.model;
}
function axisLabelStep(range, bucketCount) {
  if (bucketCount <= 8) return 1;
  if (range === "today") return 3;
  if (range === "7d") return 1;
  return Math.max(1, Math.ceil(bucketCount / 8));
}
function bucketAmount(bucket) {
  return bucket.coverage === "unavailable" ? "\u2014" : bucket.amount.label;
}
function AnalyticsChart({
  range,
  trend
}) {
  const buckets = chartBuckets(range, trend);
  const [selectedKey, setSelectedKey] = (0, import_react.useState)(null);
  const label = chartLabel(range);
  if (buckets.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { "aria-label": label, style: shellStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: emptyStyle, children: "\u6682\u65E0\u8D8B\u52BF\u6570\u636E\u3002" }) });
  }
  const width = 640;
  const height = 132;
  const padX = 8;
  const padTop = 10;
  const padBottom = 22;
  const plotHeight = height - padTop - padBottom;
  const slot = (width - padX * 2) / buckets.length;
  const barWidth = Math.max(4, Math.min(32, slot * 0.58));
  const maxAmount = Math.max(1, ...buckets.map((bucket) => bucket.amount.microCny));
  const labelStep = axisLabelStep(range, buckets.length);
  const modelLegend = [...new Map(
    buckets.flatMap((bucket) => bucket.models).filter((model) => model.amount.microCny > 0).map((model) => [modelKey(model), model])
  ).values()].sort((left, right) => modelKey(left).localeCompare(modelKey(right)));
  const modelColors = new Map(modelLegend.map((model, index) => [modelKey(model), MODEL_COLORS[index % MODEL_COLORS.length]]));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { "aria-label": label, style: shellStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { minWidth: 0 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { role: "img", "aria-label": label, viewBox: `0 0 ${width} ${height}`, style: { display: "block", width: "100%", height: "auto", aspectRatio: `${width} / ${height}` }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: padX, x2: width - padX, y1: height - padBottom, y2: height - padBottom, stroke: DSH_COLORS.border1 }),
      buckets.map((bucket, index) => {
        const value = bucket.amount.microCny;
        const barHeight = value > 0 ? Math.max(2, value / maxAmount * plotHeight) : 2;
        const x = padX + index * slot + (slot - barWidth) / 2;
        const y = height - padBottom - barHeight;
        const displayLabel = bucketLabel(range, bucket.key);
        const modelSegments = bucket.models.filter((model) => model.amount.microCny > 0 && modelColors.has(modelKey(model)));
        const modelTotal = modelSegments.reduce((sum, model) => sum + model.amount.microCny, 0);
        const scale = modelTotal > value && modelTotal > 0 ? value / modelTotal : 1;
        let segmentBottom = height - padBottom;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: `${bucketTooltipLabel(range, bucket.key)} \xB7 ${bucketAmount(bucket)} \xB7 ${bucket.requestCount} \u6B21` }),
          modelSegments.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "rect",
            {
              x,
              y,
              width: barWidth,
              height: barHeight,
              rx: 2,
              fill: selectedKey === bucket.key ? DSH_COLORS.primary : DSH_COLORS.brand,
              tabIndex: 0,
              role: "img",
              "aria-label": `${displayLabel} ${bucketAmount(bucket)}\uFF0C${bucket.totalTokens} Token\uFF0C${bucket.requestCount} \u6B21\u8BF7\u6C42`,
              onFocus: () => setSelectedKey(bucket.key),
              onClick: () => setSelectedKey(bucket.key)
            }
          ) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            modelTotal < value ? (() => {
              const remainderHeight = (value - modelTotal) / maxAmount * plotHeight;
              segmentBottom -= remainderHeight;
              return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "rect",
                {
                  x,
                  y: segmentBottom,
                  width: barWidth,
                  height: remainderHeight,
                  rx: 2,
                  fill: selectedKey === bucket.key ? DSH_COLORS.primary : DSH_COLORS.brand,
                  tabIndex: -1,
                  "aria-hidden": "true",
                  onFocus: () => setSelectedKey(bucket.key),
                  onClick: () => setSelectedKey(bucket.key)
                }
              );
            })() : null,
            modelSegments.map((model, segmentIndex) => {
              const segmentHeight = Math.max(1, model.amount.microCny * scale / maxAmount * plotHeight);
              segmentBottom -= segmentHeight;
              const modelName = modelLabel(model);
              return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "rect",
                {
                  x,
                  y: segmentBottom,
                  width: barWidth,
                  height: segmentHeight,
                  rx: segmentIndex === modelSegments.length - 1 ? 2 : 0,
                  fill: selectedKey === bucket.key ? DSH_COLORS.primary : modelColors.get(modelKey(model)),
                  tabIndex: segmentIndex === 0 ? 0 : -1,
                  role: segmentIndex === 0 ? "img" : void 0,
                  "aria-label": segmentIndex === 0 ? `${displayLabel} ${modelName} ${bucketAmount(bucket)}\uFF0C${bucket.totalTokens} Token\uFF0C${bucket.requestCount} \u6B21\u8BF7\u6C42` : void 0,
                  onFocus: () => setSelectedKey(bucket.key),
                  onClick: () => setSelectedKey(bucket.key)
                },
                modelKey(model)
              );
            })
          ] }),
          index === buckets.length - 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: x + barWidth / 2, cy: y, r: 2.5, fill: DSH_COLORS.primary }) : null,
          index % labelStep === 0 || range !== "today" && index === buckets.length - 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", { x: x + barWidth / 2, y: height - 6, textAnchor: "middle", fill: DSH_COLORS.tertiary, fontSize: "9", children: displayLabel }) : null
        ] }, bucket.key);
      })
    ] }) }),
    modelLegend.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "list", "aria-label": "\u6A21\u578B\u56FE\u4F8B", style: { display: "flex", flexWrap: "wrap", gap: "4px 10px", color: DSH_COLORS.secondary, fontSize: 10 }, children: modelLegend.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { role: "listitem", style: { display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", style: { width: 8, height: 8, flex: "0 0 auto", borderRadius: 2, background: modelColors.get(modelKey(model)) } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: modelLabel(model) })
    ] }, modelKey(model))) }) : null,
    selectedKey ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: 0, color: DSH_COLORS.secondary, fontSize: 10, fontVariantNumeric: "tabular-nums" }, children: (() => {
      const bucket = buckets.find((item) => item.key === selectedKey);
      return bucket ? `${bucketLabel(range, bucket.key)} \xB7 ${bucketAmount(bucket)} \xB7 ${formatTokenLabel(bucket.totalTokens)} \xB7 ${bucket.requestCount} \u6B21\u8BF7\u6C42` : "";
    })() }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: labelRowStyle, children: buckets.slice(-3).map((bucket) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
      bucketLabel(range, bucket.key),
      " ",
      bucketAmount(bucket)
    ] }, bucket.key)) })
  ] });
}
function formatTokenLabel(tokens) {
  return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(tokens)} Token`;
}

// packages/client/src/session-stages.tsx
var import_react2 = require("react");

// packages/client/src/token-breakdown.ts
function buildTokenCostBreakdown(buckets) {
  const cacheMiss = findBucket(buckets, "\u7F13\u5B58\u672A\u547D\u4E2D");
  const cacheHit = findBucket(buckets, "\u7F13\u5B58\u547D\u4E2D");
  const output = findBucket(buckets, "\u8F93\u51FA");
  const reasoning = findBucket(buckets, "\u5176\u4E2D\u63A8\u7406");
  const nonReasoningTokens = reasoning.tokens <= output.tokens ? output.tokens - reasoning.tokens : null;
  return {
    hasData: buckets.some((bucket) => bucket.label === "\u7F13\u5B58\u672A\u547D\u4E2D" || bucket.label === "\u7F13\u5B58\u547D\u4E2D" || bucket.label === "\u8F93\u51FA" || bucket.label === "\u5176\u4E2D\u63A8\u7406"),
    cacheMiss,
    cacheHit,
    output,
    reasoning,
    nonReasoningTokens,
    totalTokens: cacheMiss.tokens + cacheHit.tokens + output.tokens
  };
}
function findBucket(buckets, label) {
  return buckets.find((bucket) => bucket.label === label) ?? {
    label,
    tokens: 0,
    amount: createUnavailableAmountView(),
    unitPrice: null
  };
}

// packages/client/src/session-stages.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var DSH_COLORS2 = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  tertiary: "var(--dsw-alias-label-tertiary, #6b7280)",
  base: "var(--dsw-alias-bg-base, #ffffff)",
  layer2: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)",
  border2: "var(--dsw-alias-border-l2, #e5e7eb)",
  brand: "var(--dsw-alias-brand-primary, #2563eb)"
};
var CURRENT_STAGE_COLOR = "#2563eb";
var PRICING_COLORS = {
  peak: "var(--dsw-alias-state-warn-primary, #b45309)",
  offpeak: "var(--dsw-alias-state-success-primary, #0f766e)",
  unknown: DSH_COLORS2.brand
};
function SessionStageTabs({
  detail,
  children,
  idPrefix = `mymeter-stage-${detail.id}`
}) {
  const stages = (0, import_react2.useMemo)(() => getSessionStages(detail), [detail]);
  const currentStageId = selectedDefaultStageId(stages);
  const [selectedStageId, setSelectedStageId] = (0, import_react2.useState)(currentStageId);
  const [helpPinned, setHelpPinned] = (0, import_react2.useState)(false);
  const [helpHovered, setHelpHovered] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => setSelectedStageId(currentStageId), [currentStageId]);
  (0, import_react2.useEffect)(() => {
    if (!stages.some((stage) => stage.id === selectedStageId)) {
      setSelectedStageId(currentStageId);
    }
  }, [currentStageId, selectedStageId, stages]);
  const selectedStage = stages.find((stage) => stage.id === selectedStageId) ?? stages.at(-1);
  if (!selectedStage) return null;
  const panelId = `${idPrefix}-panel-${selectedStage.id}`;
  const tabId = `${idPrefix}-tab-${selectedStage.id}`;
  const helpId = `${idPrefix}-help`;
  const helpOpen = helpPinned || helpHovered;
  const selectStageByKeyboard = (event, index) => {
    let nextIndex = null;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + stages.length) % stages.length;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % stages.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = stages.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextStage = stages[nextIndex];
    if (!nextStage) return;
    setSelectedStageId(nextStage.id);
    event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "grid", gap: 6, minWidth: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "flex-start", gap: 4, minWidth: 0, position: "relative" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          role: "tablist",
          "aria-label": "\u8BA1\u8D39\u5206\u6BB5",
          style: {
            display: "flex",
            flex: "1 1 auto",
            gap: 4,
            minWidth: 0,
            overflowX: "auto",
            overflowY: "hidden",
            paddingBottom: 2,
            scrollbarWidth: "thin",
            touchAction: "pan-x"
          },
          children: stages.map((stage, index) => {
            const selected = stage.id === selectedStage.id;
            const accent = PRICING_COLORS[stage.pricingZone];
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                id: `${idPrefix}-tab-${stage.id}`,
                type: "button",
                role: "tab",
                "aria-label": stageTabLabel(stage),
                "aria-selected": selected,
                "aria-controls": `${idPrefix}-panel-${stage.id}`,
                tabIndex: selected ? 0 : -1,
                onClick: () => setSelectedStageId(stage.id),
                onKeyDown: (event) => selectStageByKeyboard(event, index),
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  flex: "0 0 auto",
                  maxWidth: 220,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: selected ? `1px solid ${accent}` : `1px solid ${DSH_COLORS2.border1}`,
                  background: selected ? `color-mix(in srgb, ${accent} 16%, ${DSH_COLORS2.layer2})` : DSH_COLORS2.layer2,
                  color: DSH_COLORS2.primary,
                  fontSize: 10,
                  fontWeight: selected ? 800 : 650,
                  fontVariantNumeric: "tabular-nums",
                  cursor: "pointer"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: `\u8BA1\u8D39\u6BB5 #${stage.index}` }),
                  stage.isCurrent ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "span",
                    {
                      "aria-hidden": "true",
                      style: {
                        padding: "2px 5px",
                        borderRadius: 4,
                        background: CURRENT_STAGE_COLOR,
                        color: DSH_COLORS2.base,
                        fontSize: 9,
                        fontWeight: 800,
                        lineHeight: 1
                      },
                      children: "\u5F53\u524D"
                    }
                  ) : null
                ]
              },
              stage.id
            );
          })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { flex: "0 0 22px", position: "relative" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            "aria-label": "\u4E86\u89E3\u8BA1\u8D39\u5206\u6BB5",
            "aria-controls": helpId,
            "aria-expanded": helpOpen,
            "aria-describedby": helpOpen ? helpId : void 0,
            onMouseEnter: () => setHelpHovered(true),
            onMouseLeave: () => setHelpHovered(false),
            onFocus: () => setHelpHovered(true),
            onBlur: () => {
              setHelpHovered(false);
              setHelpPinned(false);
            },
            onClick: () => setHelpPinned((open) => !open),
            onKeyDown: (event) => {
              if (event.key !== "Escape") return;
              setHelpHovered(false);
              setHelpPinned(false);
            },
            style: {
              display: "inline-grid",
              placeItems: "center",
              width: 22,
              height: 22,
              padding: 0,
              borderRadius: "50%",
              border: `1px solid ${DSH_COLORS2.border1}`,
              background: DSH_COLORS2.layer2,
              color: DSH_COLORS2.secondary,
              fontSize: 12,
              fontWeight: 800,
              cursor: "help"
            },
            children: "?"
          }
        ),
        helpOpen ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            id: helpId,
            role: "tooltip",
            style: {
              position: "absolute",
              zIndex: 20,
              top: 28,
              right: 0,
              width: "min(280px, calc(100vw - 40px))",
              boxSizing: "border-box",
              padding: "8px 10px",
              borderRadius: 6,
              border: `1px solid ${DSH_COLORS2.border1}`,
              background: DSH_COLORS2.base,
              color: DSH_COLORS2.primary,
              boxShadow: "0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 18%, transparent)",
              fontSize: 11,
              lineHeight: 1.5
            },
            children: "\u8D39\u7528\u4F1A\u6309\u8FDE\u7EED\u4E14\u76F8\u540C\u7684\u8BA1\u8D39\u914D\u7F6E\u5206\u6BB5\u6C47\u603B\u3002\u6A21\u578B\u3001\u63A8\u7406\u5F3A\u5EA6\u3001Agent \u9884\u8BBE\u3001\u8BA1\u8D39\u65F6\u6BB5\u6216\u4EF7\u683C\u7248\u672C\u53D1\u751F\u53D8\u5316\u65F6\uFF0C\u4F1A\u65B0\u5EFA\u8BA1\u8D39\u6BB5\uFF1B\u5BF9\u8BDD\u8F6E\u6B21\u548C\u7A7A\u95F2\u65F6\u95F4\u4E0D\u4F1A\u5355\u72EC\u5206\u6BB5\u3002"
          }
        ) : null
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { id: panelId, role: "tabpanel", "aria-labelledby": tabId, "aria-label": stageTabLabel(selectedStage), style: { minWidth: 0 }, children: children(selectedStage, !selectedStage.isCurrent) })
  ] });
}
function StageMetadataPanel({ stage }) {
  const accent = PRICING_COLORS[stage.pricingZone];
  const rates = buildTokenCostBreakdown(stage.tokenBuckets);
  const items = [
    ["\u6A21\u578B", displayStageMetadata(stage.model)],
    ["\u63A8\u7406\u5F3A\u5EA6", displayStageMetadata(stage.reasoningEffort)],
    ["Agent\u9884\u8BBE", displayStageMetadata(stage.agentPreset)],
    ["\u4EF7\u683C\u7248\u672C", formatStagePriceVersion(stage.priceVersion)],
    ...stage.exchangeRateLabel && !stage.currency ? [["\u8BA1\u4EF7\u6C47\u7387", stage.exchangeRateLabel]] : []
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "section",
    {
      "aria-label": "\u8BA1\u8D39\u6BB5\u4FE1\u606F",
      style: {
        display: "grid",
        gap: 8,
        minWidth: 0,
        padding: "10px 11px 9px",
        background: DSH_COLORS2.layer2,
        border: `1px solid ${DSH_COLORS2.border2}`,
        borderRadius: 8,
        color: DSH_COLORS2.primary
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { style: { color: DSH_COLORS2.brand, fontSize: 12 }, children: "\u8BA1\u8D39\u6BB5\u4FE1\u606F" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "span",
            {
              style: {
                padding: "3px 6px",
                borderRadius: 4,
                background: stage.isCurrent ? CURRENT_STAGE_COLOR : "transparent",
                color: stage.isCurrent ? DSH_COLORS2.base : DSH_COLORS2.tertiary,
                fontSize: 10,
                fontWeight: 800,
                lineHeight: 1
              },
              children: stage.isCurrent ? "\u5F53\u524D" : "\u5DF2\u7ED3\u675F"
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "dl",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
              gap: "8px 14px",
              minWidth: 0,
              margin: 0,
              paddingTop: 8,
              borderTop: `1px solid ${DSH_COLORS2.border1}`
            },
            children: [
              items.map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "grid", gap: 3, minWidth: 0 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { style: { color: DSH_COLORS2.tertiary, fontSize: 10 }, children: label }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { style: { margin: 0, color: DSH_COLORS2.primary, fontSize: 11, fontWeight: 700, overflowWrap: "anywhere" }, children: value })
              ] }, label)),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "grid", gap: 6, minWidth: 0, gridColumn: "1 / -1" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("dt", { style: { display: "flex", alignItems: "center", gap: 6, minWidth: 0 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: DSH_COLORS2.tertiary, fontSize: 10 }, children: "\u5F53\u524D\u8D39\u7387" }),
                  stage.pricingZone !== "unknown" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "span",
                    {
                      style: {
                        padding: "2px 5px",
                        borderRadius: 4,
                        background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                        color: accent,
                        fontSize: 9,
                        fontWeight: 800,
                        lineHeight: 1
                      },
                      children: stage.pricingZoneLabel
                    }
                  ) : null,
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { marginLeft: "auto", color: DSH_COLORS2.tertiary, fontSize: 9 }, children: [
                    stage.currency === "USD" ? "\u7F8E\u5143" : stage.currency === "CNY" || !stage.currency ? "\u5143" : stage.currency,
                    " / \u767E\u4E07 Token"
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "dd",
                  {
                    style: {
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 6,
                      margin: 0
                    },
                    children: [
                      ["\u8F93\u5165", formatStageRate(rates.cacheMiss)],
                      ["\u7F13\u5B58", formatStageRate(rates.cacheHit)],
                      ["\u8F93\u51FA", formatStageRate(rates.output)]
                    ].map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                      "span",
                      {
                        style: {
                          display: "grid",
                          gap: 2,
                          minWidth: 0,
                          padding: "5px 6px",
                          borderRadius: 4,
                          border: `1px solid ${DSH_COLORS2.border2}`,
                          background: DSH_COLORS2.base
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: DSH_COLORS2.tertiary, fontSize: 9 }, children: label }),
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { style: { color: DSH_COLORS2.primary, fontSize: 11, overflowWrap: "anywhere" }, children: value })
                        ]
                      },
                      label
                    ))
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    gridColumn: "1 / -1",
                    paddingTop: 8,
                    borderTop: `1px solid ${DSH_COLORS2.border2}`
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { style: { color: DSH_COLORS2.tertiary, fontSize: 10 }, children: "\u65F6\u95F4\u8303\u56F4" }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { style: { margin: 0, color: DSH_COLORS2.secondary, fontSize: 11, fontWeight: 650, fontVariantNumeric: "tabular-nums" }, children: formatStageTimeRange(stage) })
                  ]
                }
              )
            ]
          }
        )
      ]
    }
  );
}
function contextBreakdownRows(contextBreakdown, unavailableLabel = "\u6682\u4E0D\u53EF\u7528") {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      style: {
        display: "grid",
        gap: 4,
        minWidth: 0,
        marginTop: 6,
        paddingTop: 8,
        borderTop: `1px solid ${DSH_COLORS2.border2}`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { style: { fontSize: 10, color: DSH_COLORS2.secondary }, children: "\u4E0A\u4E0B\u6587\u6784\u6210\uFF08\u4F30\u7B97\uFF09" }),
        contextBreakdown ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          infoLine("\u7CFB\u7EDF\u63D0\u793A\u8BCD", `${formatTokenCount(contextBreakdown.systemTokens)} Token`),
          infoLine("\u5DE5\u5177\u5B9A\u4E49", `${formatTokenCount(contextBreakdown.toolsTokens)} Token`),
          infoLine("\u4F1A\u8BDD\u6D88\u606F", `${formatTokenCount(contextBreakdown.messageTokens)} Token`),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 9, color: DSH_COLORS2.tertiary }, children: "\u4F30\u7B97\u503C\uFF0C\u4E0D\u53C2\u4E0E\u8D39\u7528\u8BA1\u7B97" })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 10, color: DSH_COLORS2.tertiary }, children: unavailableLabel })
      ]
    }
  );
}
function infoLine(label, value) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, minWidth: 0, fontSize: 11 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: DSH_COLORS2.secondary }, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { style: { color: DSH_COLORS2.primary, textAlign: "right", fontVariantNumeric: "tabular-nums" }, children: value })
  ] });
}
function getSessionStages(detail) {
  return detail.stages.length > 0 ? detail.stages : [stageFromDetail(detail)];
}
function stageTabLabel(stage) {
  return `\u8BA1\u8D39\u6BB5 #${stage.index}${stage.isCurrent ? " \u5F53\u524D" : ""}`;
}
function selectedDefaultStageId(stages) {
  return (stages.find((stage) => stage.isCurrent) ?? stages.at(-1))?.id ?? "stage-1";
}
function displayStageMetadata(value) {
  return value.trim().toLowerCase() === "unknown" || value.trim() === "" ? "\u5F85\u786E\u8BA4" : value;
}
function formatStagePriceVersion(value) {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "unknown" ? "-" : value;
}
function formatStageRate(bucket) {
  if (bucket.unitPriceMixed) return "\u6DF7\u5408";
  return bucket.unitPrice?.label ?? "-";
}
function formatStageTimeRange(stage) {
  return `${formatStageClock(stage.startedAt)} - ${stage.completedAt ? formatStageClock(stage.completedAt) : "\u5F53\u524D"}`;
}
function formatStageClock(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "\u65F6\u95F4\u4E0D\u53EF\u7528";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).format(date);
}
function stageFromDetail(detail) {
  const lastTurn = detail.turns.at(-1);
  return {
    id: `${detail.id}-stage-current`,
    index: 1,
    isCurrent: true,
    startedAt: detail.turns[0]?.startedAt ?? "",
    completedAt: lastTurn?.completedAt ?? null,
    lastActivityAt: lastTurn?.completedAt ?? lastTurn?.startedAt ?? "",
    status: detail.status,
    model: detail.model,
    reasoningEffort: detail.reasoningEffort,
    agentPreset: detail.agentPreset,
    pricingZone: detail.pricingZone,
    pricingZoneLabel: detail.pricingZoneLabel,
    priceVersion: "",
    exchangeRateLabel: null,
    currentRequest: detail.currentRequest,
    sessionTotal: detail.sessionTotal,
    settledTotal: detail.settledTotal,
    estimatedTotal: detail.estimatedTotal,
    unknownCount: detail.unknownCount,
    tokenBuckets: detail.tokenBuckets,
    turns: detail.turns,
    contextBreakdown: detail.contextBreakdown,
    currency: detail.sessionTotal.currency ?? "CNY"
  };
}

// packages/client/src/update-ui.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var COLORS = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  tertiary: "var(--dsw-alias-label-tertiary, #6b7280)",
  base: "var(--dsw-alias-bg-base, #ffffff)",
  layer1: "var(--dsw-alias-bg-layer-1, #ffffff)",
  layer2: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)",
  border2: "var(--dsw-alias-border-l2, #e5e7eb)",
  brand: "var(--dsw-alias-brand-primary, #2563eb)",
  danger: "var(--dsw-alias-state-danger-primary, #b91c1c)"
};
function MyMeterUpdateControl({ controller, isLoopback }) {
  const state = (0, import_react3.useSyncExternalStore)(controller.subscribe, controller.getState, controller.getState);
  if (!isLoopback) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      "aria-label": "MyMeter \u66F4\u65B0",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        minWidth: 0,
        flexWrap: "wrap"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(UpdateStatusText, { state }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(UpdateActions, { controller, state }),
        state.status === "failed" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { role: "alert", style: { color: COLORS.danger, fontSize: 11, overflowWrap: "anywhere" }, children: state.error }) : null,
        state.status === "restartRequired" && !state.restartPromptDismissed ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RestartRequiredDialog, { state, onDismiss: controller.dismissRestartPrompt }) : null
      ]
    }
  );
}
function UpdateActions({ controller, state }) {
  if (state.status === "updateAvailable") {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", onClick: () => void controller.install(), style: primaryButtonStyle, children: "\u66F4\u65B0\u63D2\u4EF6" });
  }
  if (state.status === "restartRequired") return null;
  const disabled = state.status === "checking" || state.status === "installing";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "button",
    {
      type: "button",
      disabled,
      onClick: () => void controller.check(),
      style: {
        ...secondaryButtonStyle,
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.72 : 1
      },
      children: state.status === "checking" ? "\u68C0\u67E5\u4E2D..." : state.status === "installing" ? "\u5B89\u88C5\u4E2D..." : "\u68C0\u67E5\u66F4\u65B0"
    }
  );
}
function UpdateStatusText({ state }) {
  const label = statusLabel(state);
  if (!label) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: statusColor(state), fontSize: 11, fontWeight: 600, overflowWrap: "anywhere" }, children: label });
}
function RestartRequiredDialog({
  state,
  onDismiss
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      role: "dialog",
      "aria-modal": "false",
      "aria-labelledby": "mymeter-update-dialog-title",
      style: {
        position: "fixed",
        inset: "auto 16px 16px auto",
        width: "min(360px, calc(100vw - 32px))",
        display: "grid",
        gap: 8,
        padding: 14,
        color: COLORS.primary,
        background: COLORS.layer1,
        border: `1px solid ${COLORS.border1}`,
        borderRadius: 8,
        boxShadow: "0 12px 30px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 18%, transparent)",
        zIndex: 2147483647
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("strong", { id: "mymeter-update-dialog-title", style: { fontSize: 13 }, children: [
          "MyMeter v",
          state.installedVersion,
          " \u5DF2\u5B89\u88C5"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: COLORS.secondary, fontSize: 12, lineHeight: 1.5 }, children: "\u9700\u8981\u91CD\u542F dsh \u624D\u80FD\u4F7F\u7528\u65B0\u7248\u672C\u3002\u8BF7\u56DE\u5230\u8FD0\u884C dsh \u7684\u7EC8\u7AEF\u624B\u52A8\u91CD\u542F\uFF0C\u91CD\u542F\u540E\u672C\u9875\u4F1A\u81EA\u52A8\u6062\u590D\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: COLORS.tertiary, fontSize: 11 }, children: restartPhaseLabel(state.restartPhase) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", onClick: onDismiss, style: secondaryButtonStyle, children: "\u77E5\u9053\u4E86" }) })
      ]
    }
  );
}
function statusLabel(state) {
  switch (state.status) {
    case "idle":
    case "checking":
      return null;
    case "upToDate":
      return `\u5F53\u524D\u5DF2\u662F\u6700\u65B0\u7248 v${state.currentVersion}`;
    case "updateAvailable":
      return `\u53D1\u73B0 MyMeter v${state.latestVersion}`;
    case "installing":
      return `\u6B63\u5728\u5B89\u88C5 v${state.latestVersion}`;
    case "restartRequired":
      return `v${state.installedVersion} \u5DF2\u5B89\u88C5\uFF0C\u7B49\u5F85\u91CD\u542F`;
    case "failed":
      return `${operationLabel(state.operation)}\u5931\u8D25`;
  }
}
function statusColor(state) {
  if (state.status === "failed") return COLORS.danger;
  if (state.status === "updateAvailable") return COLORS.brand;
  return COLORS.secondary;
}
function operationLabel(operation) {
  if (operation === "install") return "\u5B89\u88C5";
  if (operation === "restart-watch") return "\u7B49\u5F85\u91CD\u542F";
  return "\u68C0\u67E5\u66F4\u65B0";
}
function restartPhaseLabel(phase) {
  if (phase === "offlineObserved") return "\u5DF2\u68C0\u6D4B\u5230 dsh \u79BB\u7EBF\uFF0C\u6B63\u5728\u7B49\u5F85\u6062\u590D\u3002";
  if (phase === "recovered") return "dsh \u5DF2\u6062\u590D\uFF0C\u6B63\u5728\u5237\u65B0\u9875\u9762\u3002";
  return "\u6B63\u5728\u7B49\u5F85 dsh \u91CD\u542F\u3002";
}
var baseButtonStyle = {
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap"
};
var secondaryButtonStyle = {
  ...baseButtonStyle,
  color: COLORS.brand,
  background: COLORS.base,
  border: `1px solid ${COLORS.border1}`,
  cursor: "pointer"
};
var primaryButtonStyle = {
  ...baseButtonStyle,
  color: "#ffffff",
  background: COLORS.brand,
  border: `1px solid ${COLORS.brand}`,
  cursor: "pointer"
};

// packages/client/src/usage-overview.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var DSH_COLORS3 = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  layer1: "var(--dsw-alias-bg-layer-1, #ffffff)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)"
};
var sectionStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 6
};
var itemStyle = {
  minWidth: 0,
  padding: "7px 8px",
  border: `1px solid ${DSH_COLORS3.border1}`,
  borderRadius: 6,
  background: DSH_COLORS3.layer1
};
var labelStyle = {
  display: "block",
  color: DSH_COLORS3.secondary,
  fontSize: 10,
  fontWeight: 700
};
var valueStyle = {
  display: "block",
  marginTop: 2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: DSH_COLORS3.primary,
  fontSize: 12,
  fontWeight: 750,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap"
};
function UsageOverview({ overview }) {
  const items = [
    ["\u8D39\u7528", overview.coverage === "unavailable" ? "\u2014" : overview.total.label],
    ["Token", formatTokenCount(overview.totalTokens)],
    ["\u8BF7\u6C42\u6570", formatTokenCount(overview.requestCount)],
    ["Coverage", overview.coverage === "complete" ? "\u5B8C\u6574" : overview.coverage === "partial" ? "\u90E8\u5206\u8BA1\u4EF7" : "\u4E0D\u53EF\u7528"]
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { "aria-label": "\u7528\u91CF\u6982\u89C8", style: { display: "grid", gap: 6 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: sectionStyle, children: items.map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: itemStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: labelStyle, children: label }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { style: valueStyle, children: value })
    ] }, label)) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "grid", gap: 3 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { style: { color: DSH_COLORS3.primary, fontSize: 11 }, children: "\u4E3B\u8981\u6A21\u578B" }),
      overview.topModels.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: DSH_COLORS3.secondary, fontSize: 11 }, children: "\u6682\u65E0\u6A21\u578B\u7528\u91CF\u3002" }) : overview.topModels.slice(0, 3).map((model) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, minWidth: 0, fontSize: 11 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: DSH_COLORS3.secondary }, children: [
          model.model,
          " \xB7 ",
          formatTokenCount(model.totalTokens),
          " Token"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: DSH_COLORS3.primary, fontVariantNumeric: "tabular-nums" }, children: model.coverage === "unavailable" ? "\u2014" : model.amount.label })
      ] }, `${model.provider}:${model.model}`))
    ] })
  ] });
}

// packages/client/src/components.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var STATUS_FILTER_OPTIONS = [
  "idle",
  "billing",
  "settled",
  "unknown",
  "balance_expired",
  "balance_insufficient",
  "failed",
  "aborted"
];
var DSH_COLORS4 = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  tertiary: "var(--dsw-alias-label-tertiary, #6b7280)",
  base: "var(--dsw-alias-bg-base, #ffffff)",
  layer1: "var(--dsw-alias-bg-layer-1, #ffffff)",
  layer2: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)",
  border2: "var(--dsw-alias-border-l2, #e5e7eb)",
  brand: "var(--dsw-alias-brand-primary, #2563eb)"
};
var ACTION_LINK_COLOR = "#2563eb";
var TOKEN_DETAIL_COLORS = {
  accent: "#2563eb",
  accentBorder: "#bfdbfe",
  derivedBorder: "#dbeafe",
  cacheMiss: "#b45309",
  cacheHit: "#0f766e",
  output: "#2563eb",
  total: "#1d4ed8",
  note: "#64748b",
  anomaly: "#b91c1c"
};
var conversationOverlayLeases = /* @__PURE__ */ new WeakMap();
function acquireConversationOverlay(store) {
  const lease = conversationOverlayLeases.get(store) ?? { activeViews: 0, restoreQueued: false };
  lease.activeViews += 1;
  lease.restoreQueued = false;
  conversationOverlayLeases.set(store, lease);
  store.setOverlayVisible(false);
}
function releaseConversationOverlay(store) {
  const lease = conversationOverlayLeases.get(store);
  if (!lease) {
    store.setOverlayVisible(true);
    return;
  }
  lease.activeViews = Math.max(0, lease.activeViews - 1);
  if (lease.activeViews > 0 || lease.restoreQueued) return;
  lease.restoreQueued = true;
  queueMicrotask(() => {
    lease.restoreQueued = false;
    if (lease.activeViews > 0) return;
    conversationOverlayLeases.delete(store);
    store.setOverlayVisible(true);
  });
}
function useMyMeterStoreState(store) {
  return (0, import_react4.useSyncExternalStore)(store.subscribe, store.getState, store.getState);
}
function CompactMeter({
  store,
  onOpenTokenBilling
}) {
  const state = useMyMeterStoreState(store);
  (0, import_react4.useEffect)(() => {
    if (state.viewModel.usageOverview.status === "idle") {
      void store.loadUsageOverview("today");
    }
  }, [state.viewModel.usageOverview.status, store]);
  const opensPage = Boolean(onOpenTokenBilling);
  const isBilling = state.viewModel.status.code === "billing";
  const inProgressLabel = "\u751F\u6210\u4E2D";
  const { detail, currentRequest, sessionTotal } = state.viewModel;
  const [expandedReceiptKey, setExpandedReceiptKey] = (0, import_react4.useState)(null);
  const breakdown = detail ? buildTokenCostBreakdown(detail.tokenBuckets) : null;
  const turns = detail?.turns && detail.turns.length > 0 ? detail.turns : null;
  const showReceipt = Boolean(turns);
  const hiddenTurnCount = turns ? Math.floor(Math.max(0, turns.length - 1) / 10) * 10 : 0;
  const receiptExpansionKey = detail && hiddenTurnCount > 0 ? `${detail.id}:${hiddenTurnCount}` : null;
  const receiptTurnsExpanded = receiptExpansionKey !== null && expandedReceiptKey === receiptExpansionKey;
  const visibleTurnStartIndex = receiptTurnsExpanded ? 0 : hiddenTurnCount;
  const receiptStatusLabel = isBilling ? "\u25B2 \u6B63\u5728\u751F\u6210" : `\u25A0 ${formatStatusLabel(state.viewModel.status.code)}`;
  const cacheBucket = breakdown?.cacheHit;
  const inputBucket = breakdown?.cacheMiss;
  const outputBucket = breakdown?.output;
  const hasUnknownCost = Boolean(detail && (detail.unknownCount > 0 || detail.status === "unknown"));
  const cacheTokens = cacheBucket ? formatTokenCount(cacheBucket.tokens) : "0";
  const cacheCost = cacheBucket ? formatTokenCostAmount(cacheBucket.amount.label, cacheBucket.amount.microCny, hasUnknownCost) : "\u4E0D\u53EF\u7528";
  const inputTokens = inputBucket ? formatTokenCount(inputBucket.tokens) : "0";
  const inputCost = inputBucket ? formatTokenCostAmount(inputBucket.amount.label, inputBucket.amount.microCny, hasUnknownCost) : "\u4E0D\u53EF\u7528";
  const outputTokens = outputBucket ? formatTokenCount(outputBucket.tokens) : "0";
  const outputCost = outputBucket ? formatTokenCostAmount(outputBucket.amount.label, outputBucket.amount.microCny, hasUnknownCost) : "\u4E0D\u53EF\u7528";
  const badgeStyle = (bg, border, color) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "1.5px 5px",
    borderRadius: 4,
    background: bg,
    border: `1px solid ${border}`,
    color,
    fontSize: 11,
    fontWeight: 600
  });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("style", { children: `
          @keyframes thermalLaserScan {
            0% { transform: translateX(-100%); opacity: 0; }
            30% { opacity: 1; }
            70% { opacity: 1; }
            100% { transform: translateX(100%); opacity: 0; }
          }
          @keyframes receiptPaperFeed {
            0% { transform: translateY(-2px); }
            50% { transform: translateY(1px); }
            100% { transform: translateY(-2px); }
          }
          @keyframes printHeadPulse {
            0% { opacity: 0.6; transform: scale(0.95); }
            50% { opacity: 1; transform: scale(1.05); }
            100% { opacity: 0.6; transform: scale(0.95); }
          }
        ` }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "button",
      {
        type: "button",
        "aria-label": opensPage ? "\u6253\u5F00 Token\u8BA1\u8D39\u9875\u9762" : "Token\u8BA1\u8D39\u5C0F\u7968",
        onClick: (event) => {
          if (event.detail === 0) onOpenTokenBilling?.();
        },
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 5,
          width: 172,
          border: isBilling ? "1px solid var(--dsw-alias-brand-primary, #3964fe)" : "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
          borderRadius: showReceipt ? "10px 10px 4px 4px" : 10,
          padding: "7px 9px",
          background: "var(--dsw-alias-bg-layer-1, #ffffff)",
          color: "var(--dsw-alias-label-primary, #111827)",
          boxShadow: "0 10px 24px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 16%, transparent)",
          cursor: "grab",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          transition: "all 0.2s ease",
          outline: "none",
          zIndex: 2,
          userSelect: "none"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              "data-testid": "mymeter-today-summary",
              "aria-label": "\u4ECA\u65E5\u7528\u91CF\u6458\u8981",
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 3,
                paddingBottom: 4,
                borderBottom: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
                fontSize: 8.5,
                fontVariantNumeric: "tabular-nums"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
                  "\u4ECA\u65E5 ",
                  state.viewModel.usageOverview.data?.coverage === "unavailable" ? "\u2014" : state.viewModel.usageOverview.data?.total.label ?? "\u540C\u6B65\u4E2D"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
                  "Token ",
                  state.viewModel.usageOverview.data ? formatTokenCount(state.viewModel.usageOverview.data.totalTokens) : "\u2014"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: state.viewModel.balance.supported ? `\u4F59\u989D ${state.viewModel.balance.total?.label ?? "\u4E0D\u53EF\u7528"}` : state.viewModel.balance.status === "unavailable" ? "\u4F59\u989D\u672A\u63A5\u5165" : "\u540C\u6B65\u4E2D" })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                borderBottom: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
                paddingBottom: 4
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 5 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "span",
                    {
                      style: {
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: isBilling ? "var(--dsw-alias-brand-primary, #3964fe)" : "var(--dsw-alias-state-success-primary, #16a34a)",
                        boxShadow: "0 0 8px color-mix(in srgb, var(--dsw-alias-brand-primary, #3964fe) 45%, transparent)",
                        flexShrink: 0,
                        animation: isBilling ? "printHeadPulse 1s infinite ease-in-out" : "none"
                      }
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { fontSize: 11, fontWeight: 700, letterSpacing: "-0.01em", opacity: 0.9 }, children: "Token\u8BA1\u8D39" })
                ] }),
                isBilling ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "span",
                  {
                    style: {
                      fontSize: 8.5,
                      color: "var(--dsw-alias-brand-primary, #3964fe)",
                      background: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
                      border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
                      padding: "0.5px 4px",
                      borderRadius: 3,
                      fontWeight: 700,
                      letterSpacing: "0.02em"
                    },
                    children: [
                      "\u26A1 ",
                      inProgressLabel
                    ]
                  }
                ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "span",
                  {
                    style: {
                      fontSize: 8.5,
                      color: "var(--dsw-alias-label-secondary, #6b7280)",
                      letterSpacing: "0.02em",
                      opacity: 0.8
                    },
                    children: formatStatusLabel(state.viewModel.status.code)
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: 3,
                width: "100%",
                fontSize: 10.5,
                fontVariantNumeric: "tabular-nums"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "div",
                  {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "2px 5px",
                      background: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
                      border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
                      borderRadius: 4,
                      color: "var(--dsw-alias-label-primary, #111827)",
                      fontWeight: 600
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { display: "inline-flex", gap: 3 }, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { opacity: 0.85 }, children: "\u7F13:" }),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: cacheTokens })
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontWeight: 700 }, children: cacheCost })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "div",
                  {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "2px 5px",
                      background: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
                      border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
                      borderRadius: 4,
                      color: "var(--dsw-alias-label-primary, #111827)",
                      fontWeight: 600
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { display: "inline-flex", gap: 3 }, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { opacity: 0.85 }, children: "\u5165:" }),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: inputTokens })
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontWeight: 700 }, children: inputCost })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "div",
                  {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "2px 5px",
                      background: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
                      border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)",
                      borderRadius: 4,
                      color: "var(--dsw-alias-label-primary, #111827)",
                      fontWeight: 600
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { display: "inline-flex", gap: 3 }, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { opacity: 0.85 }, children: "\u51FA:" }),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: outputTokens })
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontWeight: 700 }, children: outputCost })
                    ]
                  }
                )
              ]
            }
          )
        ]
      }
    ),
    showReceipt ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        "data-testid": "mymeter-receipt",
        title: opensPage ? "\u70B9\u51FB\u6253\u5F00 Token\u8BA1\u8D39\u9875\u9762" : "Token\u8BA1\u8D39\u5C0F\u7968",
        style: {
          position: "relative",
          width: 160,
          marginTop: -2,
          padding: "5px 8px 7px",
          background: "var(--dsw-alias-bg-layer-1, #ffffff)",
          color: "var(--dsw-alias-label-primary, #111827)",
          fontFamily: 'ui-monospace, "SF Mono", Monaco, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, monospace',
          fontSize: 9.5,
          borderRadius: "0 0 3px 3px",
          boxShadow: "0 10px 22px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 14%, transparent)",
          cursor: "grab",
          animation: isBilling ? "receiptPaperFeed 1.2s infinite ease-in-out" : "none",
          overflow: "hidden",
          zIndex: 1,
          clipPath: "polygon(0% 0%, 100% 0%, 100% calc(100% - 3px), 94% 100%, 88% calc(100% - 3px), 82% 100%, 76% calc(100% - 3px), 70% 100%, 64% calc(100% - 3px), 58% 100%, 52% calc(100% - 3px), 46% 100%, 40% calc(100% - 3px), 34% 100%, 28% calc(100% - 3px), 22% 100%, 16% calc(100% - 3px), 10% 100%, 4% calc(100% - 3px), 0% 100%)"
        },
        children: [
          isBilling ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "100%",
                background: "color-mix(in srgb, var(--dsw-alias-brand-primary, #3964fe) 20%, transparent)",
                animation: "thermalLaserScan 1.8s infinite linear",
                pointerEvents: "none"
              }
            }
          ) : null,
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px dashed var(--dsw-alias-border-l1, #e5e7eb)",
                paddingBottom: 2,
                marginBottom: 3,
                fontSize: 8.5
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontWeight: 800, letterSpacing: "0.04em", color: isBilling ? "var(--dsw-alias-brand-primary, #3964fe)" : "var(--dsw-alias-state-success-primary, #16a34a)" }, children: receiptStatusLabel }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 8, color: "var(--dsw-alias-label-secondary, #6b7280)" }, children: turns ? `\u5171 ${turns.length} \u8F6E` : "\u7B2C 1 \u8F6E" })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: 2,
                marginBottom: 3,
                maxHeight: 120,
                overflowY: "auto"
              },
              children: [
                hiddenTurnCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "button",
                  {
                    type: "button",
                    "aria-expanded": receiptTurnsExpanded,
                    "aria-label": `${receiptTurnsExpanded ? "\u9690\u85CF" : "\u5C55\u5F00"}\u524D ${hiddenTurnCount} \u8F6E\u8D39\u7528`,
                    title: `${receiptTurnsExpanded ? "\u9690\u85CF" : "\u5C55\u5F00"}\u524D ${hiddenTurnCount} \u8F6E\u8D39\u7528`,
                    onPointerDown: (event) => event.stopPropagation(),
                    onClick: () => {
                      if (receiptExpansionKey !== null) {
                        setExpandedReceiptKey(receiptTurnsExpanded ? null : receiptExpansionKey);
                      }
                    },
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      margin: "0 0 2px",
                      padding: "2px 3px",
                      border: "1px dashed var(--dsw-alias-border-l1, #d1d5db)",
                      borderRadius: 3,
                      background: "transparent",
                      color: "var(--dsw-alias-label-secondary, #6b7280)",
                      fontSize: 8,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      cursor: "pointer"
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: receiptTurnsExpanded ? `\u9690\u85CF\u524D ${hiddenTurnCount} \u8F6E\u8D39\u7528` : `\u5C55\u5F00\u524D ${hiddenTurnCount} \u8F6E\u8D39\u7528` }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { "aria-hidden": "true", children: receiptTurnsExpanded ? "\u25B4" : "\u25BE" })
                    ]
                  }
                ) : null,
                turns && turns.length > 0 ? turns.slice(visibleTurnStartIndex).map((turn, visibleIndex) => {
                  const index = visibleTurnStartIndex + visibleIndex;
                  const isActive = turn.completedAt === null && (turn.status === "billing" || isBilling && index === turns.length - 1);
                  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                    "div",
                    {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 8.5,
                        fontVariantNumeric: "tabular-nums",
                        color: isActive ? "var(--dsw-alias-brand-primary, #3964fe)" : "var(--dsw-alias-label-primary, #111827)",
                        fontWeight: isActive ? 700 : 500
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: 3 }, children: [
                          isActive ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                            "span",
                            {
                              style: {
                                width: 3.5,
                                height: 3.5,
                                borderRadius: "50%",
                                background: "var(--dsw-alias-brand-primary, #3964fe)",
                                animation: "printHeadPulse 1s infinite ease-in-out"
                              }
                            }
                          ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { width: 3.5, height: 3.5, borderRadius: "50%", background: "var(--dsw-alias-label-tertiary, #9ca3af)" } }),
                          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
                            "#",
                            index + 1,
                            " \u8F6E",
                            isActive ? ` (${inProgressLabel})` : ""
                          ] })
                        ] }),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: isActive ? "var(--dsw-alias-state-error-primary, #dc2626)" : "var(--dsw-alias-label-primary, #111827)", fontWeight: 700 }, children: isActive && currentRequest.microCny > 0 ? currentRequest.label : turn.amount.label })
                      ]
                    },
                    turn.id || index
                  );
                }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "div",
                  {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 8.5,
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--dsw-alias-brand-primary, #3964fe)",
                      fontWeight: 700
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: 3 }, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                          "span",
                          {
                            style: {
                              width: 3.5,
                              height: 3.5,
                              borderRadius: "50%",
                              background: "var(--dsw-alias-brand-primary, #3964fe)",
                              animation: "printHeadPulse 1s infinite ease-in-out"
                            }
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
                          "#1 \u8F6E (",
                          inProgressLabel,
                          ")"
                        ] })
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: "var(--dsw-alias-state-error-primary, #dc2626)", fontWeight: 700 }, children: currentRequest.label })
                    ]
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px dashed var(--dsw-alias-border-l1, #e5e7eb)",
                paddingTop: 2,
                fontSize: 8.5,
                color: "var(--dsw-alias-label-secondary, #6b7280)",
                fontVariantNumeric: "tabular-nums"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontWeight: 600 }, children: "\u5408\u8BA1\u652F\u51FA" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontWeight: 800, color: "var(--dsw-alias-label-primary, #111827)" }, children: sessionTotal.label })
              ]
            }
          )
        ]
      }
    ) : null
  ] });
}
function GlobalSessionList({
  store,
  showViewTabs = true
}) {
  const state = useMyMeterStoreState(store);
  const hasGlobalMixedCurrency = state.viewModel.currencyTotals.length > 1;
  const sessions = (0, import_react4.useMemo)(() => {
    const query = state.ui.searchQuery.trim().toLowerCase();
    const filtered = state.viewModel.sessions.filter((session) => {
      const matchesQuery = !query || [session.title, session.id, session.model, session.agentPreset].some(
        (value) => value.toLowerCase().includes(query)
      );
      const matchesStatus = state.ui.filterStatus === "all" || session.status === state.ui.filterStatus;
      return matchesQuery && matchesStatus;
    });
    return filtered.sort((a, b) => {
      if (state.ui.sortBy === "amount") {
        return b.sessionTotal.microCny - a.sessionTotal.microCny;
      }
      if (state.ui.sortBy === "status") {
        return statusPriority(b.status) - statusPriority(a.status);
      }
      return b.lastActivityAt.localeCompare(a.lastActivityAt);
    });
  }, [state.ui.filterStatus, state.ui.searchQuery, state.ui.sortBy, state.viewModel.sessions]);
  const activePanel = state.ui.activePanel === "costTree" || state.ui.activePanel === "analytics" ? state.ui.activePanel : "sessions";
  (0, import_react4.useEffect)(() => {
    if (activePanel === "costTree" && state.viewModel.sessionCostTree.status === "idle") {
      void store.loadSessionCostTree();
    }
    if (activePanel === "analytics") {
      if (state.viewModel.costAnalytics.status === "idle") void store.loadCostAnalytics();
      if (state.viewModel.usageOverview.status === "idle") void store.loadUsageOverview(state.ui.analyticsRange);
    }
  }, [
    activePanel,
    state.ui.analyticsRange,
    state.viewModel.costAnalytics.status,
    state.viewModel.sessionCostTree.status,
    state.viewModel.usageOverview.status,
    store
  ]);
  if (state.remote.connection.status === "loading") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: { margin: 0, padding: 12, color: DSH_COLORS4.secondary, fontSize: 13 }, children: "\u52A0\u8F7D\u4F1A\u8BDD\u4E2D..." });
  }
  if (state.remote.connection.status === "error") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { role: "alert", style: { margin: 0, padding: 12, color: "var(--dsw-alias-state-error-primary, #dc2626)", fontSize: 13 }, children: state.remote.connection.message ?? "Remote \u8FDE\u63A5\u5931\u8D25" });
  }
  const controlStyle = {
    padding: "6px 10px",
    background: DSH_COLORS4.layer1,
    border: `1px solid ${DSH_COLORS4.border1}`,
    borderRadius: 6,
    color: DSH_COLORS4.primary,
    fontSize: 12,
    outline: "none"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { "aria-label": "\u5168\u5C40\u4F1A\u8BDD\u5217\u8868", style: { display: "grid", gap: 10 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "header",
      {
        style: {
          display: "grid",
          gap: 6,
          padding: "8px 12px",
          background: DSH_COLORS4.layer1,
          borderRadius: 8,
          border: `1px solid ${DSH_COLORS4.border1}`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }, children: "Token\u8BA1\u8D39" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 10, color: DSH_COLORS4.brand, fontWeight: 600 }, children: "\u4F1A\u8BDD\u6982\u89C8" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { fontSize: 11, color: DSH_COLORS4.secondary, fontVariantNumeric: "tabular-nums" }, children: [
            state.viewModel.balance.supported && state.viewModel.balance.provider !== "unknown" ? `${state.viewModel.balance.providerName}\u4F59\u989D ${state.viewModel.balance.total?.label ?? "\u4E0D\u53EF\u7528"} \xB7 ` : "",
            "DSH\u672C\u5730\u7D2F\u8BA1 ",
            hasGlobalMixedCurrency ? state.viewModel.cnyEquivalent?.label ?? "\u591A\u5E01\u79CD\uFF08\u5F85\u67E5\u8BE2\u6C47\u7387\uFF09" : state.viewModel.localTotal.label,
            hasGlobalMixedCurrency ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "button",
              {
                type: "button",
                onClick: () => {
                  void store.refreshExchangeRate();
                },
                disabled: state.viewModel.exchangeRate.status === "loading",
                style: { marginLeft: 6, padding: "1px 5px", borderRadius: 4, border: `1px solid ${DSH_COLORS4.border1}`, background: DSH_COLORS4.base, color: DSH_COLORS4.brand, fontSize: 9, cursor: "pointer" },
                children: state.viewModel.exchangeRate.status === "loading" ? "\u67E5\u8BE2\u4E2D" : "\u67E5\u8BE2\u6C47\u7387"
              }
            ) : null,
            state.viewModel.balance.supported ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "button",
              {
                type: "button",
                "aria-label": "\u5237\u65B0\u4F59\u989D",
                title: "\u5237\u65B0\u4F59\u989D",
                onClick: () => {
                  void store.refreshBalance();
                },
                style: { marginLeft: 6, padding: "1px 5px", borderRadius: 4, border: `1px solid ${DSH_COLORS4.border1}`, background: DSH_COLORS4.base, color: DSH_COLORS4.brand, fontSize: 9, cursor: "pointer" },
                children: "\u5237\u65B0"
              }
            ) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            BillingInsightsStrip,
            {
              ariaLabel: "\u5168\u5C40\u8D39\u7528\u6D1E\u5BDF",
              insights: state.viewModel.insights,
              showCacheSavings: false
            }
          )
        ]
      }
    ),
    showViewTabs ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(BillingViewTabs, { store, state, activePanel }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(LedgerExportToolbar, { store, state }),
    activePanel === "costTree" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SessionCostTreePanel, { store, state }) : activePanel === "analytics" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CostAnalyticsPanel, { store, state }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            "aria-label": "\u641C\u7D22\u4F1A\u8BDD",
            value: state.ui.searchQuery,
            placeholder: "\u641C\u7D22\u4F1A\u8BDD",
            onChange: (event) => store.setSearchQuery(event.target.value),
            style: controlStyle
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "select",
          {
            "aria-label": "\u6392\u5E8F",
            value: state.ui.sortBy,
            onChange: (event) => store.setSortBy(event.target.value),
            style: controlStyle,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "recent", children: "\u6700\u8FD1" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "amount", children: "\u91D1\u989D" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "status", children: "\u72B6\u6001" })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "select",
          {
            "aria-label": "\u7B5B\u9009\u72B6\u6001",
            value: state.ui.filterStatus,
            onChange: (event) => store.setFilterStatus(event.target.value),
            style: controlStyle,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "all", children: "\u5168\u90E8" }),
              STATUS_FILTER_OPTIONS.map((status) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: status, children: formatStatusLabel(status) }, status))
            ]
          }
        )
      ] }),
      sessions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: { margin: 0, padding: "16px 8px", textAlign: "center", color: DSH_COLORS4.secondary, fontSize: 12 }, children: "\u6682\u65E0\u5339\u914D\u4F1A\u8BDD\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { display: "grid", gap: 6, maxHeight: 320, overflowY: "auto", paddingRight: 2 }, children: sessions.map((session) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "button",
        {
          type: "button",
          onClick: () => store.selectSession(session.id),
          style: {
            display: "grid",
            gap: 4,
            textAlign: "left",
            padding: "8px 12px",
            borderRadius: 8,
            border: session.isActive ? `1px solid ${DSH_COLORS4.brand}` : `1px solid ${DSH_COLORS4.border1}`,
            background: session.isActive ? DSH_COLORS4.layer2 : DSH_COLORS4.layer1,
            boxShadow: "none",
            cursor: "pointer",
            color: DSH_COLORS4.primary,
            transition: "all 0.15s ease"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { fontSize: 13, fontWeight: 600 }, children: session.title }),
              session.isActive ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "span",
                {
                  style: {
                    fontSize: 9,
                    padding: "1px 6px",
                    background: DSH_COLORS4.layer2,
                    border: `1px solid ${DSH_COLORS4.border1}`,
                    borderRadius: 4,
                    color: DSH_COLORS4.brand,
                    fontWeight: 700
                  },
                  children: "ACTIVE"
                }
              ) : null
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { fontSize: 11, color: DSH_COLORS4.secondary }, children: [
              session.model,
              " \xB7 ",
              session.reasoningEffort,
              " \xB7 ",
              session.agentPreset
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { fontSize: 11, color: DSH_COLORS4.primary, fontVariantNumeric: "tabular-nums" }, children: [
              formatStatusLabel(session.status),
              session.status === "billing" ? ` ${session.currentRequest.label}` : "",
              " \xB7 \u4F1A\u8BDD\u7D2F\u8BA1",
              " ",
              session.sessionTotal.label
            ] })
          ]
        },
        session.id
      )) })
    ] })
  ] });
}
function BillingViewTabs({
  store,
  state,
  activePanel,
  includeCurrentSession = false
}) {
  const panels = includeCurrentSession ? [
    ["detail", "\u5F53\u524D\u4F1A\u8BDD"],
    ["sessions", "\u5168\u90E8\u4F1A\u8BDD"],
    ["costTree", "\u8D39\u7528\u6811"],
    ["analytics", "\u8D8B\u52BF/\u5F02\u5E38"]
  ] : [
    ["sessions", "\u4F1A\u8BDD"],
    ["costTree", "\u8D39\u7528\u6811"],
    ["analytics", "\u8D8B\u52BF/\u5F02\u5E38"]
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { role: "tablist", "aria-label": "\u8D39\u7528\u89C6\u56FE", style: { display: "flex", gap: 4, overflowX: "auto", touchAction: "pan-x" }, children: panels.map(([panel, label]) => {
    const unavailable = panel === "costTree" ? state.viewModel.sessionCostTree.status === "unavailable" : panel === "analytics" ? state.viewModel.costAnalytics.status === "unavailable" && state.viewModel.usageOverview.status === "unavailable" : false;
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": activePanel === panel,
        disabled: unavailable,
        onClick: () => store.setActivePanel(panel),
        style: {
          minHeight: 28,
          padding: "4px 10px",
          borderRadius: 6,
          border: activePanel === panel ? `1px solid ${DSH_COLORS4.brand}` : `1px solid ${DSH_COLORS4.border1}`,
          background: activePanel === panel ? DSH_COLORS4.layer2 : DSH_COLORS4.layer1,
          color: activePanel === panel ? DSH_COLORS4.brand : DSH_COLORS4.secondary,
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: "nowrap",
          cursor: unavailable ? "not-allowed" : "pointer",
          opacity: unavailable ? 0.55 : 1
        },
        children: label
      },
      panel
    );
  }) });
}
function LedgerExportToolbar({ store, state }) {
  const exportState = state.viewModel.ledgerExport;
  const unavailable = exportState.status === "unavailable";
  const isLoading = exportState.status === "loading";
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { "aria-label": "\u8D26\u672C\u5BFC\u51FA", style: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }, children: [
    ["json", "csv"].map((format) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "button",
      {
        type: "button",
        "aria-label": `\u4E0B\u8F7D${format.toUpperCase()}\u8D26\u672C`,
        disabled: unavailable || isLoading,
        onClick: () => {
          void store.exportLedger(format);
        },
        style: {
          minHeight: 28,
          padding: "4px 9px",
          borderRadius: 6,
          border: `1px solid ${DSH_COLORS4.border1}`,
          background: DSH_COLORS4.layer1,
          color: unavailable ? DSH_COLORS4.tertiary : DSH_COLORS4.brand,
          fontSize: 11,
          fontWeight: 700,
          cursor: unavailable || isLoading ? "not-allowed" : "pointer"
        },
        children: [
          "\u2193 ",
          format.toUpperCase()
        ]
      },
      format
    )),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { role: exportState.status === "error" ? "alert" : void 0, style: { color: exportState.status === "error" ? TOKEN_DETAIL_COLORS.anomaly : DSH_COLORS4.tertiary, fontSize: 10 }, children: exportState.status === "unavailable" ? "\u5F53\u524D dsh \u7248\u672C\u4E0D\u652F\u6301\u5BFC\u51FA" : exportState.status === "loading" ? `\u6B63\u5728\u751F\u6210 ${exportState.format?.toUpperCase() ?? ""}` : exportState.status === "ready" ? `${exportState.format?.toUpperCase()} \u5DF2\u4E0B\u8F7D` : exportState.status === "error" ? exportState.error ?? "\u5BFC\u51FA\u5931\u8D25" : "\u5BFC\u51FA\u4E0D\u5305\u542B\u63D0\u793A\u8BCD\u3001\u56DE\u590D\u6B63\u6587\u548C API Key" })
  ] });
}
function SessionCostTreePanel({ store, state }) {
  const resource = state.viewModel.sessionCostTree;
  if (resource.status === "unavailable") return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyToolState, { label: "\u5F53\u524D dsh \u7248\u672C\u4E0D\u652F\u6301\u8D39\u7528\u6811\u3002" });
  if (resource.status === "loading") return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyToolState, { label: "\u6B63\u5728\u52A0\u8F7D\u8D39\u7528\u6811..." });
  if (resource.status === "error") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ToolErrorState, { label: resource.error ?? "\u8D39\u7528\u6811\u52A0\u8F7D\u5931\u8D25", onRetry: () => {
      void store.loadSessionCostTree();
    } });
  }
  if (resource.status === "idle") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ToolRetryState, { label: "\u52A0\u8F7D\u8D39\u7528\u6811", onClick: () => {
      void store.loadSessionCostTree();
    } });
  }
  const tree = resource.data;
  if (!tree) return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyToolState, { label: "\u6682\u65E0\u5B50 Agent \u8D39\u7528\u5173\u7CFB\u3002" });
  const roots = tree.roots.filter((node) => node.children.length > 0 || node.anomalyLabels.length > 0);
  if (roots.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyToolState, { label: "\u6682\u65E0\u5B50 Agent \u8D39\u7528\u5173\u7CFB\u3002\u666E\u901A\u4F1A\u8BDD\u8BF7\u5728\u4F1A\u8BDD\u5217\u8868\u4E2D\u67E5\u770B\u3002" });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { "aria-label": "\u8D39\u7528\u6811", style: { display: "grid", gap: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { fontSize: 11, color: DSH_COLORS4.secondary }, children: [
      roots.length,
      " \u4E2A\u5B50 Agent \u4EFB\u52A1\u6811"
    ] }),
    tree.anomalyLabels.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { role: "alert", style: { margin: 0, color: TOKEN_DETAIL_COLORS.anomaly, fontSize: 11 }, children: tree.anomalyLabels.join("\uFF1B") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ol", { style: { display: "grid", gap: 4, margin: 0, padding: 0, listStyle: "none" }, children: roots.map((node) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SessionCostTreeNodeRow, { node }, node.id)) })
  ] });
}
function SessionCostTreeNodeRow({ node }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("li", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 8,
          padding: "6px 8px",
          marginLeft: Math.min(node.depth * 12, 48),
          background: DSH_COLORS4.layer1,
          border: `1px solid ${node.anomalyLabels.length > 0 ? "color-mix(in srgb, var(--dsw-alias-state-error-primary, #dc2626) 45%, transparent)" : DSH_COLORS4.border1}`,
          borderRadius: 6,
          fontSize: 11,
          minWidth: 0
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { minWidth: 0, overflowWrap: "anywhere", color: DSH_COLORS4.primary }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: node.title }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { color: DSH_COLORS4.tertiary }, children: [
              " \xB7 ",
              node.id
            ] }),
            node.anomalyLabels.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { color: TOKEN_DETAIL_COLORS.anomaly }, children: [
              " \xB7 ",
              node.anomalyLabels.join("/")
            ] }) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { textAlign: "right", color: DSH_COLORS4.secondary, fontVariantNumeric: "tabular-nums" }, children: node.children.length > 0 ? `\u81EA\u8EAB ${node.total.label} \xB7 \u542B\u5B50 Agent ${node.subtreeTotal.label}` : `\u8D39\u7528 ${node.total.label}` })
        ]
      }
    ),
    node.children.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ol", { style: { display: "grid", gap: 4, margin: "4px 0 0", padding: 0, listStyle: "none" }, children: node.children.map((child) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SessionCostTreeNodeRow, { node: child }, child.id)) }) : null
  ] });
}
function CostAnalyticsPanel({ store, state }) {
  const resource = state.viewModel.costAnalytics;
  const overviewResource = state.viewModel.usageOverview;
  if (overviewResource.status === "unavailable" && resource.status === "unavailable") return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyToolState, { label: "\u5F53\u524D dsh \u7248\u672C\u4E0D\u652F\u6301\u8D8B\u52BF\u5206\u6790\u3002" });
  if (overviewResource.status === "loading" && !overviewResource.data) return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyToolState, { label: "\u6B63\u5728\u52A0\u8F7D\u8D8B\u52BF\u5206\u6790..." });
  if (overviewResource.status === "error" && !overviewResource.data && resource.status !== "ready") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ToolErrorState, { label: "\u7528\u91CF\u6982\u89C8\u52A0\u8F7D\u5931\u8D25", onRetry: () => {
      void store.loadUsageOverview(state.ui.analyticsRange);
    } });
  }
  if (resource.status === "error") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ToolErrorState, { label: resource.error ?? "\u8D8B\u52BF\u5206\u6790\u52A0\u8F7D\u5931\u8D25", onRetry: () => {
      void store.loadCostAnalytics();
    } });
  }
  if (resource.status === "idle" && !overviewResource.data) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ToolRetryState, { label: "\u52A0\u8F7D\u8D8B\u52BF/\u5F02\u5E38", onClick: () => {
      void store.loadCostAnalytics();
      void store.loadUsageOverview(state.ui.analyticsRange);
    } });
  }
  const analytics = resource.data;
  const overview = overviewResource.data;
  if (!overview && (!analytics || analytics.dailyTrend.length === 0 && analytics.hourlyTrend.length === 0 && analytics.anomalies.length === 0)) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyToolState, { label: "\u6682\u65E0\u8D8B\u52BF\u6570\u636E\u3002" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CostAnalyticsReportView, { store, state, overview, analytics });
}
function CostAnalyticsReportView({
  store,
  state,
  overview,
  analytics
}) {
  const range = state.ui.analyticsRange;
  const rangeOptions = [
    ["today", "\u4ECA\u65E5"],
    ["7d", "7\u5929"],
    ["30d", "30\u5929"]
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { "aria-label": "\u8D8B\u52BF\u548C\u5F02\u5E38", style: { display: "grid", gap: 8 }, children: [
    state.viewModel.usageOverview.status === "error" && overview ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { role: "status", style: { margin: 0, color: DSH_COLORS4.secondary, fontSize: 10 }, children: "\u7528\u91CF\u6982\u89C8\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u663E\u793A\u6700\u8FD1\u4E00\u6B21\u540C\u6B65\u7ED3\u679C\u3002" }) : null,
    overview ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(UsageOverview, { overview }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { fontSize: 11, color: DSH_COLORS4.primary }, children: "\u8D39\u7528\u8D8B\u52BF" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { role: "group", "aria-label": "\u8D8B\u52BF\u8303\u56F4", style: { display: "inline-flex", padding: 2, border: `1px solid ${DSH_COLORS4.border1}`, borderRadius: 6, background: DSH_COLORS4.layer1 }, children: rangeOptions.map(([value, label]) => {
        const selected = range === value;
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            type: "button",
            "aria-pressed": selected,
            onClick: () => store.setAnalyticsRange(value),
            style: {
              minHeight: 24,
              padding: "2px 8px",
              border: 0,
              borderRadius: 4,
              background: selected ? DSH_COLORS4.layer2 : "transparent",
              color: selected ? DSH_COLORS4.brand : DSH_COLORS4.secondary,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer"
            },
            children: label
          },
          value
        );
      }) })
    ] }),
    overview ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AnalyticsChart, { range, trend: overview.trend }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "grid", gap: 4 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { fontSize: 11, color: DSH_COLORS4.primary }, children: "\u5F02\u5E38" }),
      !analytics || analytics.anomalies.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: DSH_COLORS4.tertiary, fontSize: 11 }, children: "\u6682\u65E0\u5F02\u5E38\u3002" }) : analytics.anomalies.map((anomaly) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { padding: "6px 8px", border: `1px solid ${anomaly.severity === "warning" ? "color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 45%, transparent)" : DSH_COLORS4.border1}`, borderRadius: 6, background: DSH_COLORS4.layer1, color: DSH_COLORS4.secondary, fontSize: 11 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { color: anomaly.severity === "warning" ? "var(--dsw-alias-state-warn-primary, #b45309)" : DSH_COLORS4.brand }, children: anomaly.bucketKey }),
        " \xB7 ",
        anomaly.explanation
      ] }, `${anomaly.ruleId}:${anomaly.bucketKey}`))
    ] })
  ] });
}
function EmptyToolState({ label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: { margin: 0, padding: "16px 8px", textAlign: "center", color: DSH_COLORS4.secondary, fontSize: 12 }, children: label });
}
function ToolRetryState({ label, onClick }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick, style: { padding: "7px 10px", borderRadius: 6, border: `1px solid ${DSH_COLORS4.border1}`, background: DSH_COLORS4.layer1, color: DSH_COLORS4.brand, fontSize: 12, fontWeight: 700, cursor: "pointer" }, children: label });
}
function ToolErrorState({ label, onRetry }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { role: "alert", style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: "8px 10px", border: `1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #dc2626) 45%, transparent)`, borderRadius: 6, background: DSH_COLORS4.layer1, color: TOKEN_DETAIL_COLORS.anomaly, fontSize: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: onRetry, style: { padding: "3px 8px", borderRadius: 5, border: `1px solid ${DSH_COLORS4.border1}`, background: DSH_COLORS4.base, color: DSH_COLORS4.brand, fontSize: 11, fontWeight: 700, cursor: "pointer" }, children: "\u91CD\u8BD5" })
  ] });
}
function SessionDetailPanel({ store, showNavigation = true }) {
  const state = useMyMeterStoreState(store);
  const detail = state.viewModel.detail;
  const backBtnStyle = {
    padding: "3px 8px",
    background: DSH_COLORS4.layer2,
    border: `1px solid ${DSH_COLORS4.border1}`,
    borderRadius: 6,
    color: DSH_COLORS4.primary,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer"
  };
  if (!detail) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "section",
      {
        "aria-label": "\u4F1A\u8BDD\u8BE6\u60C5",
        style: { display: "grid", gap: 10, padding: 4, color: DSH_COLORS4.primary, background: DSH_COLORS4.base },
        children: [
          showNavigation ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: () => store.selectSession(null), style: backBtnStyle, children: "\u5168\u90E8\u4F1A\u8BDD" }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: { margin: 0, color: DSH_COLORS4.tertiary, fontSize: 12 }, children: "\u8BF7\u9009\u62E9\u4E00\u4E2A\u4F1A\u8BDD\u3002" })
        ]
      }
    );
  }
  const sessionHasUnknownCost = detail.unknownCount > 0 || detail.status === "unknown";
  const sessionTotalLabel = formatUnknownTotalLabel(detail.sessionTotal.label, detail.sessionTotal.microCny, sessionHasUnknownCost);
  const currencyTotals = detail.currencyTotals ?? [];
  const isMixedCurrency = currencyTotals.length > 1;
  const nativeSessionTotalLabel = currencyTotals.length === 1 ? formatUnknownTotalLabel(currencyTotals[0].amount.label, currencyTotals[0].amount.microCny, sessionHasUnknownCost) : isMixedCurrency ? "\u591A\u5E01\u79CD" : sessionTotalLabel;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "section",
    {
      "aria-label": "\u4F1A\u8BDD\u8BE6\u60C5",
      style: { display: "grid", gap: 10, color: DSH_COLORS4.primary, background: DSH_COLORS4.base },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { style: { display: "grid", gap: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }, children: [
            showNavigation ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: () => store.selectSession(null), style: backBtnStyle, children: "\u5168\u90E8\u4F1A\u8BDD" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { "aria-hidden": "true", style: { width: 1 } }),
            state.viewModel.status.code === "failed" ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "span",
              {
                style: {
                  fontSize: 10,
                  padding: "2px 8px",
                  background: `color-mix(in srgb, ${DSH_COLORS4.brand} 15%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${DSH_COLORS4.brand} 35%, transparent)`,
                  borderRadius: 999,
                  color: DSH_COLORS4.brand,
                  fontWeight: 600
                },
                children: state.viewModel.status.label
              }
            )
          ] }),
          detail.title !== detail.id ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", textAlign: "left" }, children: detail.title }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              "aria-label": "\u4F1A\u8BDDID",
              style: {
                display: "flex",
                alignItems: "baseline",
                gap: 6,
                minWidth: 0,
                textAlign: "left"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { flexShrink: 0, fontSize: 11, fontWeight: 600, color: DSH_COLORS4.secondary }, children: "\u4F1A\u8BDDID" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "code",
                  {
                    style: {
                      minWidth: 0,
                      overflowWrap: "anywhere",
                      fontSize: 11,
                      color: DSH_COLORS4.secondary,
                      fontVariantNumeric: "tabular-nums"
                    },
                    children: detail.id
                  }
                )
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            style: {
              display: "grid",
              gap: 2,
              padding: "10px 12px",
              background: DSH_COLORS4.layer1,
              borderRadius: 8,
              border: `1px solid ${DSH_COLORS4.border2}`
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 10, fontWeight: 700, color: DSH_COLORS4.brand, letterSpacing: "0.05em" }, children: "\u4F1A\u8BDD\u603B\u8D39\u7528" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "strong",
                {
                  style: {
                    fontSize: 24,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                    color: DSH_COLORS4.primary
                  },
                  children: nativeSessionTotalLabel
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 11, color: DSH_COLORS4.secondary, fontVariantNumeric: "tabular-nums" }, children: currencyTotals.length === 1 ? `\u5DF2\u7ED3\u7B97 ${currencyTotals[0].settled.label} + \u4F30\u7B97 ${currencyTotals[0].estimated.label}` : `\u5DF2\u7ED3\u7B97 ${detail.settledTotal.label} + \u4F30\u7B97 ${detail.estimatedTotal.label}` })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          BillingInsightsStrip,
          {
            ariaLabel: "\u4F1A\u8BDD\u8D39\u7528\u6D1E\u5BDF",
            insights: detail.insights,
            showCacheSavings: true
          }
        ),
        currencyTotals.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          CurrencyConversionPanel,
          {
            totals: currencyTotals,
            cnyEquivalent: detail.cnyEquivalent ?? null,
            exchangeRate: state.viewModel.exchangeRate,
            onRefresh: () => {
              void store.refreshExchangeRate();
            }
          }
        ) : null,
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SessionStageTabs, { detail, children: (stage, isHistorical) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(NativeSessionStagePanel, { stage, isHistorical }) })
      ]
    }
  );
}
function BillingInsightsStrip({
  ariaLabel,
  insights,
  showCacheSavings
}) {
  const budgetTone = insights.budget.level === "danger" ? "var(--dsw-alias-state-error-primary, #dc2626)" : insights.budget.level === "warning" ? "var(--dsw-alias-state-warn-primary, #b45309)" : insights.budget.level === "notice" ? "var(--dsw-alias-state-warn-primary, #b45309)" : insights.budget.level === "unavailable" ? DSH_COLORS4.tertiary : DSH_COLORS4.brand;
  const budgetLabel = insights.budget.level === "danger" ? "\u5DF2\u8D85\u8FC7" : insights.budget.level === "warning" ? "\u63A5\u8FD1" : insights.budget.level === "notice" ? "\u7559\u610F" : insights.budget.level === "unavailable" ? "\u4E0D\u9002\u7528" : insights.budget.level === "off" ? "\u672A\u542F\u7528" : "\u6B63\u5E38";
  const countdown = insights.pricingZoneCountdown;
  const items = [
    ...showCacheSavings ? [{
      label: "\u7F13\u5B58\u8282\u7701",
      value: insights.cacheSavings.amount?.label ?? insights.cacheSavings.label,
      meta: insights.cacheSavings.available ? `${formatTokenCount(insights.cacheSavings.tokens)} Token` : "\u7F3A\u5C11\u7F13\u5B58\u5355\u4EF7",
      color: "var(--dsw-alias-state-success-primary, #0f766e)"
    }] : [],
    {
      label: "\u9884\u7B97",
      value: budgetLabel,
      meta: insights.budget.percentLabel ? `${insights.budget.percentLabel} \xB7 \u9608\u503C ${insights.budget.threshold.label}` : insights.budget.available ? `\u9608\u503C ${insights.budget.threshold.label}` : "\u591A\u5E01\u79CD\u9884\u7B97\u6682\u4E0D\u6BD4\u8F83",
      color: budgetTone
    },
    {
      label: "\u5CF0\u8C37",
      value: countdown.currentZoneLabel,
      meta: countdown.remainingLabel && countdown.nextZoneLabel && countdown.transitionTimeLabel ? `${countdown.remainingLabel}\u540E\u8FDB\u5165${countdown.nextZoneLabel}\uFF08${countdown.transitionTimeLabel}\uFF09` : "\u6682\u4E0D\u9002\u7528",
      color: countdown.currentZone === "peak" ? "var(--dsw-alias-state-warn-primary, #b45309)" : countdown.currentZone === "offpeak" ? "var(--dsw-alias-state-success-primary, #0f766e)" : DSH_COLORS4.tertiary
    }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "section",
    {
      "aria-label": ariaLabel,
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 6,
        minWidth: 0,
        padding: "7px 8px",
        background: DSH_COLORS4.layer2,
        border: `1px solid ${DSH_COLORS4.border2}`,
        borderRadius: 8
      },
      children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "grid", gap: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: DSH_COLORS4.tertiary, fontSize: 9, fontWeight: 700 }, children: item.label }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "strong",
          {
            style: {
              color: item.color,
              fontSize: 11,
              lineHeight: 1.25,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              overflowWrap: "anywhere"
            },
            children: item.value
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "span",
          {
            style: {
              color: DSH_COLORS4.secondary,
              fontSize: 9,
              lineHeight: 1.35,
              fontVariantNumeric: "tabular-nums",
              overflowWrap: "anywhere"
            },
            children: item.meta
          }
        )
      ] }, item.label))
    }
  );
}
function CurrencyConversionPanel({
  totals,
  cnyEquivalent,
  exchangeRate,
  onRefresh
}) {
  const mixed = totals.length > 1;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "section",
    {
      "aria-label": "\u5E01\u79CD\u8D39\u7528",
      style: {
        display: "grid",
        gap: 6,
        padding: "8px 10px",
        background: DSH_COLORS4.layer2,
        border: `1px solid ${DSH_COLORS4.border2}`,
        borderRadius: 8
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { fontSize: 11, color: DSH_COLORS4.primary }, children: "\u539F\u5E01\u8D39\u7528" }),
          mixed ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              onClick: onRefresh,
              disabled: exchangeRate.status === "loading",
              style: {
                padding: "3px 7px",
                borderRadius: 5,
                border: `1px solid ${DSH_COLORS4.border1}`,
                background: DSH_COLORS4.base,
                color: DSH_COLORS4.brand,
                fontSize: 10,
                fontWeight: 700,
                cursor: exchangeRate.status === "loading" ? "wait" : "pointer"
              },
              children: exchangeRate.status === "loading" ? "\u67E5\u8BE2\u4E2D..." : "\u67E5\u8BE2\u6700\u65B0\u6C47\u7387"
            }
          ) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { display: "grid", gap: 3 }, children: totals.map((total) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: DSH_COLORS4.secondary }, children: total.currency }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { color: DSH_COLORS4.primary, fontVariantNumeric: "tabular-nums" }, children: total.amount.label })
        ] }, total.currency)) }),
        mixed ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "grid", gap: 3, borderTop: `1px solid ${DSH_COLORS4.border1}`, paddingTop: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: DSH_COLORS4.secondary }, children: "\u4EBA\u6C11\u5E01\u6298\u7B97" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { color: DSH_COLORS4.primary, fontVariantNumeric: "tabular-nums" }, children: cnyEquivalent?.label ?? "\u67E5\u8BE2\u6C47\u7387\u540E\u663E\u793A" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: DSH_COLORS4.tertiary, fontSize: 9 }, children: exchangeRate.status === "fresh" && exchangeRate.rate ? `\u6309 1 USD = \xA5${exchangeRate.rate.toFixed(4)} \xB7 ${exchangeRate.fetchedAt ? formatFxTimestamp(exchangeRate.fetchedAt) : "\u5F53\u5929\u6700\u65B0"}` : exchangeRate.error ?? "\u4EBA\u6C11\u5E01\u6298\u7B97\u4EC5\u7528\u4E8E\u6C47\u603B\u5C55\u793A\uFF0C\u4E0D\u6539\u53D8\u539F\u5E01\u8BA1\u8D39" })
        ] }) : null
      ]
    }
  );
}
function formatFxTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "\u5F53\u5929\u6700\u65B0";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
function MyMeterConversationView({
  store,
  sessionId,
  updateController,
  showUpdateControl = false
}) {
  const state = useMyMeterStoreState(store);
  const overlayEnabled = state.settings.overlayEnabled;
  const activePanel = state.ui.activePanel === "sessions" || state.ui.activePanel === "costTree" || state.ui.activePanel === "analytics" ? state.ui.activePanel : "detail";
  (0, import_react4.useLayoutEffect)(() => {
    acquireConversationOverlay(store);
    return () => releaseConversationOverlay(store);
  }, [store]);
  (0, import_react4.useEffect)(() => {
    store.selectSession(sessionId);
  }, [sessionId, store]);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "section",
    {
      "aria-label": "Token\u8BA1\u8D39",
      "data-testid": "mymeter-conversation-view",
      style: {
        minWidth: 0,
        padding: 12,
        color: "var(--dsw-alias-label-primary, #111827)",
        background: "var(--dsw-alias-bg-base, #ffffff)",
        border: "1px solid var(--dsw-alias-border-l1, #d1d5db)",
        borderRadius: 8
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              paddingBottom: 10,
              borderBottom: "1px solid var(--dsw-alias-border-l2, #e5e7eb)"
            },
            children: [
              updateController ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MyMeterUpdateControl, { controller: updateController, isLoopback: showUpdateControl }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "inline-flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-label-secondary, #4b5563)" }, children: "\u8BA1\u8D39\u6D6E\u7A97" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "button",
                  {
                    type: "button",
                    role: "switch",
                    "aria-label": "\u663E\u793A\u8BA1\u8D39\u6D6E\u7A97",
                    "aria-checked": overlayEnabled,
                    onClick: () => store.setOverlayEnabled(!overlayEnabled),
                    style: {
                      position: "relative",
                      width: 36,
                      height: 20,
                      padding: 0,
                      flexShrink: 0,
                      border: overlayEnabled ? "1px solid var(--dsw-alias-brand-primary, #2563eb)" : "1px solid var(--dsw-alias-border-l1, #d1d5db)",
                      borderRadius: 10,
                      background: overlayEnabled ? "var(--dsw-alias-brand-primary, #2563eb)" : "var(--dsw-alias-bg-layer-2, #f3f4f6)",
                      cursor: "pointer",
                      transition: state.settings.reducedMotion ? "none" : "background 0.15s ease, border-color 0.15s ease"
                    },
                    children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "span",
                      {
                        "aria-hidden": "true",
                        style: {
                          position: "absolute",
                          top: 2,
                          left: 2,
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: "var(--dsw-alias-bg-layer-1, #ffffff)",
                          boxShadow: "0 1px 2px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 24%, transparent)",
                          transform: overlayEnabled ? "translateX(16px)" : "translateX(0)",
                          transition: state.settings.reducedMotion ? "none" : "transform 0.15s ease"
                        }
                      }
                    )
                  }
                )
              ] })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { marginBottom: 10 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(BillingViewTabs, { store, state, activePanel, includeCurrentSession: true }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { color: DSH_COLORS4.primary, background: DSH_COLORS4.base }, children: activePanel === "detail" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AccountBalancesPanel, { balances: state.viewModel.balances }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SessionDetailPanel, { store, showNavigation: false })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GlobalSessionList, { store, showViewTabs: false }) })
      ]
    }
  );
}
function AccountBalancesPanel({ balances }) {
  const visibleBalances = balances.filter((balance) => balance.supported);
  if (visibleBalances.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "section",
    {
      "aria-label": "\u8D26\u6237\u4F59\u989D",
      style: {
        display: "grid",
        gap: 8,
        marginBottom: 10,
        minWidth: 0
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 11, fontWeight: 700, color: DSH_COLORS4.secondary }, children: "\u8D26\u6237\u4F59\u989D" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
              gap: 8,
              minWidth: 0
            },
            children: visibleBalances.map((balance) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AccountBalanceItem, { balance }, balance.provider))
          }
        )
      ]
    }
  );
}
function AccountBalanceItem({ balance }) {
  const warning = balance.needsRecharge;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "article",
    {
      "aria-label": `${balance.providerName}\u8D26\u6237\u4F59\u989D`,
      style: {
        display: "grid",
        gridTemplateColumns: balance.supported ? "minmax(0, 1fr) auto" : "minmax(0, 1fr)",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: warning ? "color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 9%, var(--dsw-alias-bg-layer-1, #ffffff))" : DSH_COLORS4.layer1,
        border: warning ? "1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 42%, transparent)" : `1px solid ${DSH_COLORS4.border1}`,
        borderRadius: 8,
        minWidth: 0
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "grid", gap: 2, minWidth: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 10, fontWeight: 700, color: DSH_COLORS4.secondary }, children: balance.providerName }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "strong",
            {
              style: {
                color: warning ? "var(--dsw-alias-state-warn-primary, #b45309)" : DSH_COLORS4.primary,
                fontSize: balance.supported ? 20 : 13,
                lineHeight: 1.35,
                fontWeight: 750,
                fontVariantNumeric: "tabular-nums",
                overflowWrap: "anywhere"
              },
              children: balance.total?.label ?? "\u6682\u4E0D\u53EF\u7528"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 10, color: DSH_COLORS4.secondary, overflowWrap: "anywhere" }, children: warning ? `\u4F4E\u4E8E ${balance.rechargeThresholdLabel ?? "5"}\uFF0C\u8BF7\u53CA\u65F6\u5145\u503C` : balance.status === "stale" || balance.status === "expired" ? "\u4F59\u989D\u5FEB\u7167\u5DF2\u8FC7\u671F" : "API \u8D26\u6237" })
        ] }),
        balance.rechargeUrl ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "a",
          {
            href: balance.rechargeUrl,
            target: "_blank",
            rel: "noreferrer",
            style: {
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 28,
              padding: "0 2px",
              color: ACTION_LINK_COLOR,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "underline",
              textUnderlineOffset: 2,
              whiteSpace: "nowrap"
            },
            children: "\u53BB\u5145\u503C"
          }
        ) : null
      ]
    }
  );
}
function NativeSessionStagePanel({ stage, isHistorical }) {
  const tokenBreakdown = buildTokenCostBreakdown(stage.tokenBuckets);
  const hasUnknownCost = stage.unknownCount > 0 || stage.status === "unknown";
  const stageTotalLabel = formatUnknownTotalLabel(stage.sessionTotal.label, stage.sessionTotal.microCny, hasUnknownCost);
  const priceCurrencyLabel = stage.currency === "USD" ? "\u7F8E\u5143" : stage.currency === "CNY" || !stage.currency ? "\u5143" : stage.currency;
  const tokenRows = [
    { bucket: tokenBreakdown.cacheMiss, accent: TOKEN_DETAIL_COLORS.cacheMiss },
    { bucket: tokenBreakdown.cacheHit, accent: TOKEN_DETAIL_COLORS.cacheHit },
    { bucket: tokenBreakdown.output, accent: TOKEN_DETAIL_COLORS.output }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "grid", gap: 10, minWidth: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(StageMetadataPanel, { stage }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          background: DSH_COLORS4.layer1,
          borderRadius: 8,
          border: `1px solid ${DSH_COLORS4.border2}`,
          borderTop: `2px solid ${TOKEN_DETAIL_COLORS.accentBorder}`,
          padding: "8px 9px 7px",
          overflow: "hidden",
          minWidth: 0
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("table", { style: { width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: 11 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "caption",
              {
                style: {
                  textAlign: "left",
                  fontSize: 10,
                  fontWeight: 700,
                  color: TOKEN_DETAIL_COLORS.accent,
                  padding: "1px 0 6px",
                  letterSpacing: "0.04em"
                },
                children: [
                  "Token \u8BA1\u8D39\u660E\u7EC6 \xB7 ",
                  stage.pricingZoneLabel
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("colgroup", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("col", { style: { width: "38%" } }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("col", { style: { width: "18%" } }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("col", { style: { width: "24%" } }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("col", { style: { width: "20%" } })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tr", { style: { color: DSH_COLORS4.tertiary, background: DSH_COLORS4.layer1, fontSize: 9 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "col", style: { textAlign: "left", padding: "2px 0", fontWeight: 600 }, children: "\u8BA1\u8D39\u9879" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "col", style: { textAlign: "right", padding: "2px 4px", fontWeight: 600 }, children: "Token" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "th",
                {
                  scope: "col",
                  "aria-label": `\u5355\u4EF7\uFF08${priceCurrencyLabel}/\u767E\u4E07 Token\uFF09`,
                  style: { textAlign: "right", padding: "2px 4px", fontWeight: 600, lineHeight: 1.2 },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { display: "block" }, children: "\u5355\u4EF7" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { "aria-hidden": "true", style: { display: "block", fontSize: 8, fontWeight: 500 }, children: [
                      priceCurrencyLabel,
                      "/\u767E\u4E07 Token"
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "col", style: { textAlign: "right", padding: "2px 0", fontWeight: 600 }, children: "\u8D39\u7528" })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tbody", { children: [
              tokenRows.map(({ bucket, accent }) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tr", { style: { background: DSH_COLORS4.layer1, borderBottom: `1px solid ${DSH_COLORS4.border2}` }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("th", { scope: "row", style: { textAlign: "left", padding: "4px 0", fontWeight: 600, color: DSH_COLORS4.secondary }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "span",
                    {
                      "aria-hidden": "true",
                      style: {
                        display: "inline-block",
                        width: 3,
                        height: 12,
                        marginRight: 6,
                        borderRadius: 2,
                        background: accent,
                        verticalAlign: "-2px"
                      }
                    }
                  ),
                  formatTokenBucketLabel(bucket.label)
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { style: { textAlign: "right", padding: "4px", fontVariantNumeric: "tabular-nums", color: DSH_COLORS4.secondary }, children: bucket.tokens.toLocaleString("en-US") }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "td",
                  {
                    style: {
                      textAlign: "right",
                      padding: "4px",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                      color: DSH_COLORS4.secondary
                    },
                    children: bucket.unitPriceMixed ? "\u6DF7\u5408" : bucket.unitPrice?.label ?? "--"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "td",
                  {
                    style: {
                      textAlign: "right",
                      padding: "4px 0",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      color: DSH_COLORS4.primary
                    },
                    children: formatTokenCostAmount(bucket.amount.label, bucket.amount.microCny, hasUnknownCost)
                  }
                )
              ] }, bucket.label)),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tr", { style: { color: DSH_COLORS4.secondary, background: DSH_COLORS4.layer1, borderTop: `1px solid ${TOKEN_DETAIL_COLORS.derivedBorder}` }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "row", style: { textAlign: "left", padding: "4px 0 4px 8px", fontWeight: 500 }, children: "\u63A8\u7406 Token" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { style: { textAlign: "right", padding: "4px", fontVariantNumeric: "tabular-nums" }, children: formatTokenCount(tokenBreakdown.reasoning.tokens) }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { style: { textAlign: "right", padding: "4px", fontSize: 10, whiteSpace: "nowrap" }, children: "\u540C\u8F93\u51FA" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { style: { textAlign: "right", padding: "4px 0", fontSize: 10, color: DSH_COLORS4.tertiary }, children: "\u5DF2\u5305\u542B" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tr", { style: { color: DSH_COLORS4.secondary, background: DSH_COLORS4.layer1, borderBottom: `1px solid ${TOKEN_DETAIL_COLORS.derivedBorder}` }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "row", style: { textAlign: "left", padding: "4px 0 4px 8px", fontWeight: 500 }, children: "\u975E\u63A8\u7406 Token" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { style: { textAlign: "right", padding: "4px", fontVariantNumeric: "tabular-nums" }, children: tokenBreakdown.nonReasoningTokens === null ? "\u65E0\u6CD5\u63A8\u5BFC" : formatTokenCount(tokenBreakdown.nonReasoningTokens) }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { style: { textAlign: "right", padding: "4px", fontSize: 10, whiteSpace: "nowrap" }, children: tokenBreakdown.nonReasoningTokens === null ? "--" : "\u540C\u8F93\u51FA" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "td",
                  {
                    style: {
                      textAlign: "right",
                      padding: "4px 0",
                      fontSize: 10,
                      color: tokenBreakdown.nonReasoningTokens === null ? TOKEN_DETAIL_COLORS.anomaly : DSH_COLORS4.tertiary,
                      fontWeight: tokenBreakdown.nonReasoningTokens === null ? 700 : 500
                    },
                    children: tokenBreakdown.nonReasoningTokens === null ? "\u6570\u636E\u5F02\u5E38" : "\u63A8\u5BFC\u503C"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("tfoot", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tr", { style: { borderTop: `1px solid ${TOKEN_DETAIL_COLORS.accentBorder}`, background: DSH_COLORS4.layer1 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "row", style: { textAlign: "left", padding: "6px 0", fontWeight: 700, color: DSH_COLORS4.primary }, children: "\u603B Token" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { style: { textAlign: "right", padding: "6px 4px", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: DSH_COLORS4.primary }, children: formatTokenCount(tokenBreakdown.totalTokens) }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { style: { textAlign: "right", padding: "6px 4px", fontSize: 10, color: TOKEN_DETAIL_COLORS.note }, children: "\u6DF7\u5408" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { style: { textAlign: "right", padding: "6px 0", fontWeight: 800, color: TOKEN_DETAIL_COLORS.total }, children: stageTotalLabel })
            ] }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: { margin: "6px 0 1px", paddingLeft: 7, borderLeft: `2px solid ${TOKEN_DETAIL_COLORS.accentBorder}`, fontSize: 9, color: TOKEN_DETAIL_COLORS.note }, children: "\u63A8\u7406 Token \u5DF2\u5305\u542B\u5728\u8F93\u51FA\u8D39\u7528\u4E2D\uFF0C\u4E0D\u91CD\u590D\u8BA1\u8D39" })
        ]
      }
    ),
    contextBreakdownRows(stage.contextBreakdown, isHistorical ? "\u5386\u53F2\u5FEB\u7167\u6682\u4E0D\u53EF\u7528" : "\u6682\u4E0D\u53EF\u7528"),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { fontSize: 10, color: DSH_COLORS4.secondary }, children: "\u8F6E\u6B21\u660E\u7EC6" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "ol",
      {
        style: {
          display: "grid",
          gap: 4,
          margin: 0,
          padding: 0,
          listStyle: "none",
          maxHeight: 140,
          overflowY: "auto"
        },
        children: stage.turns.length > 0 ? stage.turns.map((turn) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "li",
          {
            style: {
              padding: "4px 8px",
              background: DSH_COLORS4.layer2,
              borderRadius: 4,
              border: `1px solid ${DSH_COLORS4.border2}`,
              fontSize: 10,
              fontVariantNumeric: "tabular-nums",
              color: DSH_COLORS4.secondary
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, minWidth: 0 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { color: DSH_COLORS4.primary, minWidth: 0, overflowWrap: "anywhere" }, children: formatTurnSequenceLabel(turn.label) }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { minWidth: 0, textAlign: "right", overflowWrap: "anywhere" }, children: [
                  formatTurnPricingZone(turn.pricingZone),
                  " \xB7 ",
                  formatStatusLabel(turn.status),
                  " \xB7 ",
                  turn.amount.label
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { marginTop: 3, lineHeight: 1.5 }, children: [
                "\u65E0\u7F13\u5B58 ",
                formatTokenCount(turn.cacheMissTokens),
                " \xB7 \u7F13\u5B58 ",
                formatTokenCount(turn.cacheHitTokens),
                " \xB7 \u8F93\u51FA",
                " ",
                formatTokenCount(turn.outputTokens),
                " \xB7 \u63A8\u7406 ",
                formatTokenCount(turn.reasoningTokens)
              ] })
            ]
          },
          turn.id
        )) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "li",
          {
            style: {
              padding: "4px 8px",
              background: DSH_COLORS4.layer2,
              borderRadius: 4,
              border: `1px solid ${DSH_COLORS4.border2}`,
              fontSize: 10,
              color: DSH_COLORS4.secondary
            },
            children: "\u6682\u65E0\u8BF7\u6C42\u660E\u7EC6\u3002"
          }
        )
      }
    )
  ] });
}
function formatTurnPricingZone(zone) {
  if (zone === "peak") return "\u9AD8\u5CF0\u65F6\u6BB5";
  if (zone === "offpeak") return "\u7A7A\u95F2\u65F6\u6BB5";
  return "\u4E0D\u9002\u7528";
}
function formatTurnSequenceLabel(label) {
  const normalized = label.trim();
  const sequence = /^(?:#|轮次\s*|turn[-_\s]*)?(\d+)$/i.exec(normalized)?.[1];
  if (sequence) return `#${sequence}`;
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}
function formatTokenCostAmount(label, microCny, hasUnknownCost) {
  if (!hasUnknownCost) return label;
  return microCny > 0 ? `${label}\uFF08\u4F30\u7B97\uFF09` : "\xA50.000\uFF08\u4F30\u7B97\uFF09";
}
function formatUnknownTotalLabel(label, microCny, hasUnknownCost) {
  if (!hasUnknownCost) return label;
  return microCny > 0 ? `${label}\uFF08\u4F30\u7B97\uFF09` : "\xA50.000\uFF08\u4F30\u7B97\uFF09";
}
function SettingsPanel({
  store
}) {
  const state = useMyMeterStoreState(store);
  const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 10px",
    background: DSH_COLORS4.layer1,
    border: `1px solid ${DSH_COLORS4.border1}`,
    borderRadius: 8,
    fontSize: 12,
    color: DSH_COLORS4.primary
  };
  const inputStyle = {
    padding: "4px 8px",
    background: DSH_COLORS4.layer2,
    border: `1px solid ${DSH_COLORS4.border1}`,
    borderRadius: 6,
    color: DSH_COLORS4.primary,
    fontSize: 12,
    outline: "none"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { "aria-label": "\u8BBE\u7F6E", style: { display: "grid", gap: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { style: rowStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontWeight: 500 }, children: "\u51CF\u5C11\u52A8\u753B" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          type: "checkbox",
          checked: state.settings.reducedMotion,
          onChange: (event) => store.setReducedMotion(event.target.checked),
          style: { width: 16, height: 16, cursor: "pointer", accentColor: DSH_COLORS4.brand }
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { style: rowStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontWeight: 500 }, children: "\u9ED8\u8BA4\u9759\u97F3" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          type: "checkbox",
          checked: state.settings.muted,
          onChange: (event) => store.setMuted(event.target.checked),
          style: { width: 16, height: 16, cursor: "pointer", accentColor: DSH_COLORS4.brand }
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { style: rowStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontWeight: 500 }, children: "\u4F59\u989D\u5237\u65B0" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            type: "number",
            min: 5,
            step: 5,
            value: state.settings.refreshIntervalMs / 1e3,
            onChange: (event) => store.setRefreshIntervalMs(Number(event.target.value) * 1e3),
            style: { ...inputStyle, width: 64, textAlign: "right" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: DSH_COLORS4.secondary }, children: "\u79D2" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { style: rowStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontWeight: 500 }, children: "\u9884\u7B97\u9608\u503C" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            type: "number",
            min: 0,
            step: 1e-3,
            value: state.settings.budgetThresholdMicroCny / 1e6,
            onChange: (event) => store.setBudgetThresholdMicroCny(Math.round(Number(event.target.value) * 1e6)),
            style: { ...inputStyle, width: 80, textAlign: "right" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: DSH_COLORS4.secondary }, children: "\u5143" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "button",
      {
        type: "button",
        onClick: () => store.resetSettings(),
        style: {
          marginTop: 4,
          padding: "8px 12px",
          background: "color-mix(in srgb, var(--dsw-alias-state-error-primary, #dc2626) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #dc2626) 30%, transparent)",
          borderRadius: 8,
          color: "var(--dsw-alias-state-error-primary, #dc2626)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease"
        },
        children: "\u6062\u590D\u9ED8\u8BA4"
      }
    )
  ] });
}
function MyMeterSettingsCard({ store }) {
  const [open, setOpen] = (0, import_react4.useState)(false);
  const action = open ? "\u6536\u8D77" : "\u5C55\u5F00";
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "li",
    {
      "data-testid": "mymeter-settings-card",
      style: {
        listStyle: "none",
        overflow: "hidden",
        border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
        borderRadius: 10,
        background: "var(--dsw-alias-bg-layer-2, #ffffff)",
        color: "var(--dsw-alias-label-primary, #111827)",
        boxShadow: "0 2px 8px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 8%, transparent)"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "button",
          {
            type: "button",
            "aria-expanded": open,
            "aria-label": `${action} Token\u8BA1\u8D39 \u914D\u7F6E`,
            onClick: () => setOpen((value) => !value),
            style: {
              width: "100%",
              minHeight: 64,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              border: 0,
              background: "transparent",
              color: "inherit",
              font: "inherit",
              textAlign: "left",
              cursor: "pointer"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { flex: 1, minWidth: 0, display: "grid", gap: 3 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { fontSize: 15, lineHeight: 1.4 }, children: "Token\u8BA1\u8D39" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 13, lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary, #6b7280)" }, children: "\u8DDF\u968F DSH \u5168\u5C40\u4E3B\u9898\uFF0C\u914D\u7F6E\u52A8\u6548\u3001\u5237\u65B0\u4E0E\u9884\u7B97\u504F\u597D" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "span",
                {
                  "aria-hidden": "true",
                  style: {
                    width: 8,
                    height: 8,
                    flex: "0 0 auto",
                    borderRight: "2px solid currentColor",
                    borderBottom: "2px solid currentColor",
                    transform: open ? "rotate(225deg)" : "rotate(45deg)",
                    transition: "transform 160ms ease"
                  }
                }
              )
            ]
          }
        ),
        open ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              margin: "0 16px",
              padding: "14px 0 16px",
              borderTop: "1px solid var(--dsw-alias-border-l2, #d1d5db)"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SettingsPanel, { store })
          }
        ) : null
      ]
    }
  );
}

// packages/client/src/update-controller.ts
var MYMETER_UPDATE_RPC_PATH = "/mymeter-update";
var MYMETER_UPDATE_RPC_ENDPOINTS = Object.freeze({
  checkLatest: "check",
  installVersion: "install"
});
var DEFAULT_RESTART_POLL_INTERVAL_MS = 1e3;
var DEFAULT_RESTART_MAX_ATTEMPTS = 600;
var initialState = {
  status: "idle",
  currentVersion: null,
  latestVersion: null
};
function createMyMeterUpdateController({
  service,
  healthProbe = createSameOriginHealthProbe(),
  delay = defaultDelay,
  reload = defaultReload,
  restartPollIntervalMs = DEFAULT_RESTART_POLL_INTERVAL_MS,
  restartMaxAttempts = DEFAULT_RESTART_MAX_ATTEMPTS,
  now = () => /* @__PURE__ */ new Date()
}) {
  let state = initialState;
  let disposed = false;
  let runId = 0;
  const listeners = /* @__PURE__ */ new Set();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const setState = (next) => {
    if (disposed) return;
    state = next;
    emit();
  };
  const controller = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async check() {
      if (state.status === "checking" || state.status === "installing") return;
      const previous = state;
      setState({
        status: "checking",
        currentVersion: previous.currentVersion,
        latestVersion: previous.latestVersion
      });
      try {
        const result = await service.checkLatest();
        if (result.updateAvailable) {
          setState({
            status: "updateAvailable",
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
            releaseUrl: result.releaseUrl,
            checkedAt: now().toISOString()
          });
          return;
        }
        setState({
          status: "upToDate",
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          checkedAt: now().toISOString()
        });
      } catch (error) {
        setState(failedState("check", error, previous));
      }
    },
    async install() {
      if (state.status !== "updateAvailable") return;
      const update = state;
      setState({
        status: "installing",
        currentVersion: update.currentVersion,
        latestVersion: update.latestVersion,
        releaseUrl: update.releaseUrl
      });
      try {
        const result = await service.installVersion(update.latestVersion);
        const currentRun = ++runId;
        setState({
          status: "restartRequired",
          currentVersion: update.currentVersion,
          latestVersion: update.latestVersion,
          installedVersion: result.installedVersion,
          restartPhase: "waitingForOffline",
          restartPromptDismissed: false
        });
        void waitForDshRestartCycle({
          probe: healthProbe,
          delay,
          reload,
          intervalMs: restartPollIntervalMs,
          maxAttempts: restartMaxAttempts,
          shouldContinue: () => currentRun === runId && !disposed,
          onPhase: (phase) => {
            if (currentRun !== runId || disposed) return;
            if (state.status !== "restartRequired") return;
            setState({ ...state, restartPhase: phase });
          }
        }).catch((error) => {
          if (currentRun !== runId || disposed) return;
          setState(failedState("restart-watch", error, state));
        });
      } catch (error) {
        setState(failedState("install", error, update));
      }
    },
    dismissRestartPrompt() {
      if (state.status !== "restartRequired") return;
      setState({ ...state, restartPromptDismissed: true });
    },
    reset() {
      runId += 1;
      setState(initialState);
    },
    setAvailableUpdate(update) {
      setState({
        status: "updateAvailable",
        currentVersion: update.currentVersion,
        latestVersion: update.latestVersion,
        releaseUrl: update.releaseUrl,
        checkedAt: now().toISOString()
      });
    },
    dispose() {
      disposed = true;
      runId += 1;
      listeners.clear();
    }
  };
  return controller;
}
async function waitForDshRestartCycle({
  probe,
  delay,
  reload,
  shouldContinue = () => true,
  onPhase,
  intervalMs = DEFAULT_RESTART_POLL_INTERVAL_MS,
  maxAttempts = DEFAULT_RESTART_MAX_ATTEMPTS
}) {
  if (!shouldContinue()) return;
  onPhase?.("waitingForOffline");
  let attempts = 0;
  let sawOffline = false;
  while (attempts < maxAttempts) {
    if (!shouldContinue()) return;
    attempts += 1;
    if (!await isHealthy(probe)) {
      sawOffline = true;
      break;
    }
    await delay(intervalMs);
  }
  if (!shouldContinue()) return;
  if (!sawOffline) {
    throw new Error("\u7B49\u5F85 dsh \u9000\u51FA\u8D85\u65F6\uFF0C\u8BF7\u624B\u52A8\u5237\u65B0\u9875\u9762");
  }
  onPhase?.("offlineObserved");
  attempts = 0;
  while (attempts < maxAttempts) {
    if (!shouldContinue()) return;
    attempts += 1;
    if (await isHealthy(probe)) {
      if (!shouldContinue()) return;
      onPhase?.("recovered");
      reload();
      return;
    }
    await delay(intervalMs);
  }
  if (!shouldContinue()) return;
  throw new Error("\u7B49\u5F85 dsh \u6062\u590D\u8D85\u65F6\uFF0C\u8BF7\u624B\u52A8\u5237\u65B0\u9875\u9762");
}
function createSameOriginHealthProbe({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  location = globalThis.location,
  path = "/"
} = {}) {
  return async () => {
    if (!fetchImpl || !location?.origin) return false;
    try {
      const response = await fetchImpl(new URL(path, location.origin), {
        cache: "no-store",
        method: "GET"
      });
      return response.ok;
    } catch {
      return false;
    }
  };
}
function createConnectionRpcUpdateService(connection, path = MYMETER_UPDATE_RPC_PATH, endpoints = MYMETER_UPDATE_RPC_ENDPOINTS) {
  return {
    async checkLatest() {
      return parseVersionCheck(unwrapRpcResult(await connection.rpc.call(path, endpoints.checkLatest, {})));
    },
    async installVersion(version) {
      return parseInstallResult(unwrapRpcResult(await connection.rpc.call(path, endpoints.installVersion, { version })));
    }
  };
}
function failedState(operation, error, previous) {
  return {
    status: "failed",
    operation,
    error: error instanceof Error ? error.message : String(error),
    currentVersion: previous.currentVersion,
    latestVersion: previous.latestVersion
  };
}
async function isHealthy(probe) {
  try {
    return await probe();
  } catch {
    return false;
  }
}
function parseVersionCheck(value) {
  const record = objectRecord(value, "MyMeterVersionCheck");
  const currentVersion = stringField(record.currentVersion, "currentVersion");
  const latestVersion = stringField(record.latestVersion, "latestVersion");
  return {
    currentVersion,
    latestVersion,
    updateAvailable: booleanField(record.updateAvailable, "updateAvailable"),
    releaseUrl: optionalStringField(record.releaseUrl, "releaseUrl")
  };
}
function unwrapRpcResult(value) {
  const record = objectRecord(value, "RpcResult");
  if (record.ok === true) return record.value;
  if (record.ok === false) {
    const error = objectRecord(record.error, "RpcResult.error");
    throw new Error(optionalStringField(error.message, "error.message") ?? "MyMeter \u66F4\u65B0\u8BF7\u6C42\u5931\u8D25");
  }
  throw new Error("RpcResult.ok \u5FC5\u987B\u662F\u5E03\u5C14\u503C");
}
function parseInstallResult(value) {
  const record = objectRecord(value, "MyMeterInstallResult");
  return { installedVersion: stringField(record.installedVersion, "installedVersion") };
}
function objectRecord(value, name2) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name2} \u5FC5\u987B\u662F\u5BF9\u8C61`);
  }
  return value;
}
function stringField(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
  }
  return value;
}
function optionalStringField(value, field) {
  if (value === void 0 || value === null) return void 0;
  return stringField(value, field);
}
function booleanField(value, field) {
  if (typeof value !== "boolean") {
    throw new Error(`${field} \u5FC5\u987B\u662F\u5E03\u5C14\u503C`);
  }
  return value;
}
function defaultDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function defaultReload() {
  globalThis.location?.reload();
}

// packages/client/src/shell-overlay.tsx
var import_react5 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
var useEmptySessions = (selector) => selector({});
var DEFAULT_TOP_GAP = 50;
var DEFAULT_RIGHT_GAP = 50;
var RECEIPT_OVERLAY_VISUAL_WIDTH = 155;
function resolveOverlayAnchor() {
  if (typeof document === "undefined") return null;
  const scrollBody = document.querySelector(
    '[class~="wSkVaW_scrollBody"], [data-conversation-scroll]'
  );
  if (scrollBody) return scrollBody;
  const viewSlot = document.querySelector('[data-slot="conversation.view"]');
  const viewArea = viewSlot?.parentElement ?? null;
  return viewArea;
}
function readOverlayAnchorBounds(anchor) {
  const viewportWidth = typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 1024;
  const displayRect = anchor?.getBoundingClientRect();
  return {
    right: displayRect && displayRect.width > 0 && Number.isFinite(displayRect.right) ? displayRect.right : viewportWidth,
    top: displayRect && Number.isFinite(displayRect.top) ? displayRect.top : 0
  };
}
function readOverlayVisualWidth(element) {
  const width = element?.getBoundingClientRect().width ?? 0;
  if (width > 0 && Number.isFinite(width)) return width;
  return RECEIPT_OVERLAY_VISUAL_WIDTH;
}
function resolveDefaultOverlayPosition(bounds, visualWidth) {
  return {
    x: Math.max(0, Math.round(bounds.right - DEFAULT_RIGHT_GAP - visualWidth)),
    y: Math.max(0, Math.round(bounds.top + DEFAULT_TOP_GAP))
  };
}
function ShellOverlay({
  store,
  useSessions,
  onOpenTokenBilling
}) {
  const selectSessions = useSessions ?? useEmptySessions;
  const currentSessionId = selectSessions((state2) => state2.current ?? null);
  const state = useMyMeterStoreState(store);
  const hasBillableCurrentSession = !useSessions || currentSessionId !== null && state.remote.details[currentSessionId] !== void 0;
  (0, import_react5.useEffect)(() => {
    if (!useSessions) return;
    store.syncCurrentSession(currentSessionId);
  }, [currentSessionId, store, useSessions]);
  const shellRef = (0, import_react5.useRef)(null);
  const userDraggedRef = (0, import_react5.useRef)(false);
  (0, import_react5.useLayoutEffect)(() => {
    if (!hasBillableCurrentSession || !state.settings.overlayEnabled || !state.ui.overlayVisible) return;
    let anchorBounds = null;
    let overlayWidth = 0;
    let anchorElement = null;
    let mutationObserver = null;
    let resizeObserver = null;
    const syncPosition = () => {
      if (userDraggedRef.current) return;
      const nextAnchor = resolveOverlayAnchor();
      const nextBounds = readOverlayAnchorBounds(nextAnchor);
      const nextWidth = readOverlayVisualWidth(shellRef.current);
      if (anchorBounds === null) {
        store.setOverlayPosition(resolveDefaultOverlayPosition(nextBounds, nextWidth));
      } else {
        const current = store.getState().settings.overlayPosition;
        store.setOverlayPosition({
          x: current.x + nextBounds.right - anchorBounds.right - (nextWidth - overlayWidth),
          y: current.y + nextBounds.top - anchorBounds.top
        });
      }
      anchorBounds = nextBounds;
      overlayWidth = nextWidth;
      if (nextAnchor !== anchorElement) {
        anchorElement = nextAnchor;
        resizeObserver?.disconnect();
        resizeObserver = null;
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(scheduleSync);
          if (anchorElement) resizeObserver.observe(anchorElement);
          if (shellRef.current) resizeObserver.observe(shellRef.current);
        }
        if (anchorElement) mutationObserver?.disconnect();
      }
    };
    const scheduleSync = () => {
      syncPosition();
    };
    const initialAnchor = resolveOverlayAnchor();
    if (!initialAnchor && typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(scheduleSync);
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
    syncPosition();
    window.addEventListener("resize", scheduleSync);
    return () => {
      window.removeEventListener("resize", scheduleSync);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [hasBillableCurrentSession, state.settings.overlayEnabled, state.ui.overlayVisible, store]);
  if (!hasBillableCurrentSession || !state.settings.overlayEnabled || !state.ui.overlayVisible) return null;
  const { viewModel } = state;
  const position = viewModel.overlay.position;
  const handlePointerDown = (event) => {
    event.preventDefault();
    let moved = false;
    const startX = event.clientX ?? 0;
    const startY = event.clientY ?? 0;
    const initialPosX = position.x;
    const initialPosY = position.y;
    const handlePointerMove = (moveEvent) => {
      const clientX = moveEvent.clientX ?? startX;
      const clientY = moveEvent.clientY ?? startY;
      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        moved = true;
        userDraggedRef.current = true;
      }
      store.setOverlayPosition({
        x: initialPosX + deltaX,
        y: initialPosY + deltaY
      });
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (!moved) {
        onOpenTokenBilling?.();
      }
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      ref: shellRef,
      "data-testid": "mymeter-shell",
      "data-slot": "shell.overlay",
      "data-collapsed": "true",
      "data-docked-edge": viewModel.overlay.dockedEdge ?? "none",
      onPointerDown: handlePointerDown,
      style: {
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 2147483e3,
        width: "fit-content",
        maxWidth: "calc(100vw - 16px)",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
        borderRadius: 12,
        background: "transparent",
        boxShadow: "none",
        outline: "none",
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        color: "var(--dsw-alias-label-primary, #111827)",
        userSelect: "none",
        cursor: "grab",
        touchAction: "none"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "button",
          {
            type: "button",
            "aria-label": "\u5173\u95ED\u8BA1\u8D39\u6D6E\u7A97",
            title: "\u5173\u95ED\u8BA1\u8D39\u6D6E\u7A97",
            onPointerDown: (event) => event.stopPropagation(),
            onClick: () => store.setOverlayEnabled(false),
            style: {
              position: "absolute",
              top: -7,
              right: -7,
              zIndex: 4,
              display: "grid",
              placeItems: "center",
              width: 22,
              height: 22,
              padding: 0,
              border: "1px solid var(--dsw-alias-border-l1, #d1d5db)",
              borderRadius: 6,
              background: "var(--dsw-alias-bg-layer-1, #ffffff)",
              boxShadow: "0 2px 8px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 18%, transparent)",
              color: "var(--dsw-alias-label-secondary, #6b7280)",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { "aria-hidden": "true", children: "\xD7" })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            "data-testid": "mymeter-shell-body",
            style: {
              flex: "1 1 auto",
              minHeight: 0,
              borderRadius: 12,
              overflow: "visible"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              CompactMeter,
              {
                store,
                ...onOpenTokenBilling ? { onOpenTokenBilling } : {}
              }
            )
          }
        )
      ]
    }
  );
}

// packages/plugin/src/typert-remote.ts
var MYMETER_SERVICE_KEY = "mymeter";
var MYMETER_PACKAGE_NAME = "@mymeter/dsh-cost-meter";
var stringSchema = schema("string", (value) => {
  if (typeof value !== "string") throw new Error("expected string");
  return value;
});
var ledgerExportFormatSchema = schema(
  "LedgerExportFormat",
  (value) => oneOf(value, ["json", "csv"], "ledgerExportFormat")
);
var sessionIdSchema = schema("SessionId", (value) => {
  if (typeof value !== "string" || value.length === 0) throw new Error("expected non-empty session id");
  return value;
});
var snapshotSchema = schema("MyMeterRemoteSnapshot", parseSnapshot);
var sessionsSchema = schema("RemoteSessionSummaryArray", (value) => {
  if (!Array.isArray(value)) throw new Error("expected session array");
  return value.map(parseSessionSummary);
});
var sessionDetailOrNullSchema = schema("RemoteSessionDetailOrNull", (value) => {
  if (value === null) return null;
  return parseSessionDetail(value);
});
var balanceSchema = schema("RemoteBalanceSnapshot", parseBalance);
var settingsSchema = schema("RemoteSettings", (value) => {
  if (!isRecord(value)) throw new Error("expected settings object");
  return value;
});
var exchangeRateSchema = schema("RemoteExchangeRateSnapshot", parseExchangeRate);
var sessionCostTreeSchema = schema("RemoteSessionCostTree", parseSessionCostTree);
var costAnalyticsSchema = schema("RemoteCostAnalyticsReport", parseCostAnalyticsReport);
var usageOverviewQuerySchema = schema("RemoteUsageOverviewQuery", parseUsageOverviewQuery);
var usageOverviewSchema = schema("RemoteUsageOverviewReport", parseUsageOverviewReport);
var getSnapshotDescriptor = descriptor("getSnapshot", [], snapshotSchema);
var listSessionsDescriptor = descriptor("listSessions", [], sessionsSchema);
var getSessionDetailDescriptor = descriptor(
  "getSessionDetail",
  [{ name: "sessionId", wire: "sessionId", source: "json", codec: codec("SessionId", sessionIdSchema) }],
  sessionDetailOrNullSchema
);
var getBalanceDescriptor = descriptor("getBalance", [], balanceSchema);
var refreshBalanceDescriptor = descriptor("refreshBalance", [], balanceSchema);
var getSettingsDescriptor = descriptor("getSettings", [], settingsSchema);
var refreshExchangeRateDescriptor = descriptor("refreshExchangeRate", [], exchangeRateSchema);
var getSessionCostTreeDescriptor = descriptor("getSessionCostTree", [], sessionCostTreeSchema);
var getCostAnalyticsDescriptor = descriptor("getCostAnalytics", [], costAnalyticsSchema);
var getUsageOverviewDescriptor = descriptor(
  "getUsageOverview",
  [{ name: "query", wire: "query", source: "json", codec: codec("RemoteUsageOverviewQuery", usageOverviewQuerySchema) }],
  usageOverviewSchema
);
var exportLedgerDescriptor = descriptor(
  "exportLedger",
  [{ name: "format", wire: "format", source: "json", codec: codec("LedgerExportFormat", ledgerExportFormatSchema) }],
  stringSchema
);
var MYMETER_REMOTE_DESCRIPTORS = [
  getSnapshotDescriptor,
  listSessionsDescriptor,
  getSessionDetailDescriptor,
  getBalanceDescriptor,
  refreshBalanceDescriptor,
  getSettingsDescriptor,
  refreshExchangeRateDescriptor,
  getSessionCostTreeDescriptor,
  getCostAnalyticsDescriptor,
  getUsageOverviewDescriptor,
  exportLedgerDescriptor
];
var MYMETER_REMOTE_CONTRIBUTION = Object.freeze({
  package: MYMETER_PACKAGE_NAME,
  descriptors: MYMETER_REMOTE_DESCRIPTORS
});
var MYMETER_LOCAL_TYPERT_CONTRIBUTION = Object.freeze({
  package: MYMETER_PACKAGE_NAME,
  face: "host",
  schemas: [
    { name: "MyMeterRemoteSnapshot", schema: snapshotSchema },
    { name: "RemoteSessionSummaryArray", schema: sessionsSchema },
    { name: "RemoteSessionDetailOrNull", schema: sessionDetailOrNullSchema },
    { name: "RemoteBalanceSnapshot", schema: balanceSchema },
    { name: "RemoteSettings", schema: settingsSchema },
    { name: "RemoteExchangeRateSnapshot", schema: exchangeRateSchema },
    { name: "RemoteSessionCostTree", schema: sessionCostTreeSchema },
    { name: "RemoteCostAnalyticsReport", schema: costAnalyticsSchema },
    { name: "RemoteUsageOverviewQuery", schema: usageOverviewQuerySchema },
    { name: "RemoteUsageOverviewReport", schema: usageOverviewSchema },
    { name: "LedgerExportFormat", schema: ledgerExportFormatSchema }
  ],
  model: {
    services: [{
      key: MYMETER_SERVICE_KEY,
      exportName: "MyMeterRemote",
      summary: "MyMeter cost-meter Remote service.",
      tags: [],
      members: MYMETER_REMOTE_DESCRIPTORS.map((entry) => ({
        kind: "method",
        name: entry.method,
        signature: `${entry.method}(...): Promise<unknown>`
      })),
      types: []
    }],
    events: [],
    objects: []
  },
  invocations: MYMETER_REMOTE_DESCRIPTORS
});
async function createMyMeterRemoteFromTypert(namespace, options = {}) {
  const listeners = /* @__PURE__ */ new Set();
  let snapshot = await readSnapshot(namespace, false);
  let disposed = false;
  let refreshing = false;
  let refreshingBalance = false;
  let initialBalanceRequested = false;
  const pollIntervalMs = options.pollIntervalMs ?? 200;
  const balancePollIntervalMs = options.balancePollIntervalMs ?? 5 * 6e4;
  async function refresh() {
    if (disposed || refreshing) return;
    refreshing = true;
    try {
      snapshot = await readSnapshot(namespace, false);
    } catch (error) {
      snapshot = {
        ...snapshot,
        connection: {
          status: "stale",
          message: error instanceof Error ? error.message.replace(/^mymeter: getSnapshot failed: /, "") : "Remote \u8FDE\u63A5\u5931\u8D25"
        }
      };
    } finally {
      refreshing = false;
    }
    if (disposed) return;
    for (const listener of listeners) listener(snapshot);
    if (!initialBalanceRequested) {
      initialBalanceRequested = true;
      void updateBalance().then((balance) => {
        if (!balance || disposed) return;
        for (const listener of listeners) listener(snapshot);
      });
    }
  }
  async function updateBalance(force = false) {
    if (disposed || refreshingBalance) return null;
    refreshingBalance = true;
    try {
      const result = force && namespace.refreshBalance ? await namespace.refreshBalance() : await namespace.getBalance();
      if (!result.ok || disposed) return null;
      const balance = balanceSchema.parse(result.value);
      snapshot = {
        ...snapshot,
        balance,
        balances: refreshSupportedBalances(snapshot.balances, balance)
      };
      return balance;
    } catch {
      return null;
    } finally {
      refreshingBalance = false;
    }
  }
  const interval = pollIntervalMs > 0 ? setInterval(() => {
    void refresh();
  }, pollIntervalMs) : null;
  if (interval?.unref) interval.unref();
  const balanceInterval = balancePollIntervalMs > 0 ? setInterval(() => {
    void updateBalance().then((balance) => {
      if (!balance || disposed) return;
      for (const listener of listeners) listener(snapshot);
    });
  }, balancePollIntervalMs) : null;
  if (balanceInterval?.unref) balanceInterval.unref();
  const handleVisibilityChange = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      void updateBalance().then((balance) => {
        if (!balance || disposed) return;
        for (const listener of listeners) listener(snapshot);
      });
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (interval) clearInterval(interval);
    if (balanceInterval) clearInterval(balanceInterval);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    listeners.clear();
  }
  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      if (disposed) return () => {
      };
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    async refreshBalance() {
      const balance = await updateBalance(true);
      if (!balance) return snapshot.balance;
      for (const listener of listeners) listener(snapshot);
      return balance;
    },
    async refreshExchangeRate() {
      if (!namespace.refreshExchangeRate) return;
      const result = await namespace.refreshExchangeRate();
      if (!result.ok) throw new Error(`mymeter: refreshExchangeRate failed: ${result.error.message}`);
      snapshot = { ...snapshot, exchangeRate: exchangeRateSchema.parse(result.value) };
      for (const listener of listeners) listener(snapshot);
    },
    async getSessionCostTree() {
      if (!namespace.getSessionCostTree) {
        throw new Error("mymeter: getSessionCostTree failed: method unavailable");
      }
      const result = await namespace.getSessionCostTree();
      if (!result.ok) throw new Error(`mymeter: getSessionCostTree failed: ${result.error.message}`);
      return sessionCostTreeSchema.parse(result.value);
    },
    async getCostAnalytics() {
      if (!namespace.getCostAnalytics) {
        throw new Error("mymeter: getCostAnalytics failed: method unavailable");
      }
      const result = await namespace.getCostAnalytics();
      if (!result.ok) throw new Error(`mymeter: getCostAnalytics failed: ${result.error.message}`);
      return costAnalyticsSchema.parse(result.value);
    },
    async getUsageOverview(query) {
      if (!namespace.getUsageOverview) {
        throw new Error("mymeter: getUsageOverview failed: method unavailable");
      }
      const parsedQuery = usageOverviewQuerySchema.parse(query);
      const result = await namespace.getUsageOverview(parsedQuery);
      if (!result.ok) throw new Error(`mymeter: getUsageOverview failed: ${result.error.message}`);
      return usageOverviewSchema.parse(result.value);
    },
    async exportLedger(format) {
      if (!namespace.exportLedger) {
        throw new Error("mymeter: exportLedger failed: method unavailable");
      }
      const result = await namespace.exportLedger(format);
      if (!result.ok) throw new Error(`mymeter: exportLedger failed: ${result.error.message}`);
      return stringSchema.parse(result.value);
    },
    dispose
  };
}
async function readSnapshot(namespace, includeBalance = true) {
  const result = await namespace.getSnapshot();
  if (!result.ok) {
    throw new Error(`mymeter: getSnapshot failed: ${result.error.message}`);
  }
  const snapshot = snapshotSchema.parse(result.value);
  if (!includeBalance) {
    return snapshot;
  }
  const balanceResult = await namespace.getBalance().catch(() => null);
  if (!balanceResult?.ok) {
    return snapshot;
  }
  return {
    ...snapshot,
    balance: balanceSchema.parse(balanceResult.value),
    balances: refreshSupportedBalances(snapshot.balances, balanceSchema.parse(balanceResult.value))
  };
}
function descriptor(method, parameters, resultSchema) {
  return Object.freeze({
    id: `${MYMETER_PACKAGE_NAME}#${MYMETER_SERVICE_KEY}/${method}`,
    service: MYMETER_SERVICE_KEY,
    namespace: MYMETER_SERVICE_KEY,
    method,
    invocation: { kind: "direct" },
    parameters,
    result: codec(resultSchemaName(resultSchema), resultSchema)
  });
}
function codec(typeName, valueSchema) {
  return { mode: "strict", typeSymbol: `${MYMETER_PACKAGE_NAME}#${typeName}`, schema: valueSchema };
}
function schema(name2, parse) {
  return Object.freeze({ typeName: name2, parse });
}
function resultSchemaName(valueSchema) {
  return "typeName" in valueSchema && typeof valueSchema.typeName === "string" ? valueSchema.typeName : "Unknown";
}
function parseSnapshot(value) {
  const record = object(value, "snapshot");
  const sessions = array(record.sessions, "sessions").map(parseSessionSummary);
  const rawDetails = object(record.details, "details");
  const details = {};
  for (const [key, detail] of Object.entries(rawDetails)) details[key] = parseSessionDetail(detail);
  const summary = parseSummary(record.summary);
  const balance = parseBalance(record.balance);
  const balances = record.balances === void 0 ? legacyProviderBalances(summary.provider, balance) : array(record.balances, "balances").map(parseProviderBalance);
  return {
    connection: parseConnection(record.connection),
    currentSessionId: nullableString(record.currentSessionId, "currentSessionId"),
    summary,
    balance,
    balances,
    sessions,
    details,
    ...record.exchangeRate === void 0 ? {} : { exchangeRate: parseExchangeRate(record.exchangeRate) },
    ...record.ledgerGeneration === void 0 ? {} : { ledgerGeneration: nonNegativeInteger(record.ledgerGeneration, "ledgerGeneration") }
  };
}
function parseSessionCostTree(value) {
  const record = object(value, "sessionCostTree");
  const rawNodes = object(record.nodes, "sessionCostTree.nodes");
  const nodes = {};
  for (const [key, node] of Object.entries(rawNodes)) {
    nodes[key] = parseSessionCostTreeNode(node, `sessionCostTree.nodes.${key}`);
  }
  const anomalies = object(record.anomalies, "sessionCostTree.anomalies");
  return {
    roots: array(record.roots, "sessionCostTree.roots").map(
      (node) => parseSessionCostTreeNode(node, "sessionCostTree.roots")
    ),
    nodes,
    summary: parseLedgerSummary(record.summary, "sessionCostTree.summary"),
    anomalies: {
      missingParents: array(anomalies.missingParents, "sessionCostTree.anomalies.missingParents").map((item) => {
        const missing = object(item, "sessionCostTree.anomalies.missingParents");
        return {
          sessionId: requiredString(missing.sessionId, "missingParent.sessionId"),
          parentSessionId: requiredString(missing.parentSessionId, "missingParent.parentSessionId")
        };
      }),
      cycles: array(anomalies.cycles, "sessionCostTree.anomalies.cycles").map(
        (cycle) => array(cycle, "sessionCostTree.anomalies.cycles[]").map(
          (sessionId) => requiredString(sessionId, "cycle.sessionId")
        )
      )
    }
  };
}
function parseSessionCostTreeNode(value, field) {
  const record = object(value, field);
  return {
    id: requiredString(record.id, `${field}.id`),
    title: requiredString(record.title, `${field}.title`),
    ...record.parentSessionId === void 0 ? {} : { parentSessionId: requiredString(record.parentSessionId, `${field}.parentSessionId`) },
    childSessionIds: array(record.childSessionIds, `${field}.childSessionIds`).map(
      (item) => requiredString(item, `${field}.childSessionIds[]`)
    ),
    depth: nonNegativeNumber(record.depth, `${field}.depth`),
    path: array(record.path, `${field}.path`).map((item) => requiredString(item, `${field}.path[]`)),
    summary: parseLedgerSummary(record.summary, `${field}.summary`),
    subtreeSummary: parseLedgerSummary(record.subtreeSummary, `${field}.subtreeSummary`),
    ...record.detail === void 0 ? {} : { detail: parseSessionDetail(record.detail) },
    orphaned: boolean(record.orphaned, `${field}.orphaned`),
    cyclic: boolean(record.cyclic, `${field}.cyclic`)
  };
}
function parseLedgerSummary(value, field) {
  const record = object(value, field);
  return {
    requestCount: finiteNumber(record.requestCount, `${field}.requestCount`),
    totalMicroCny: finiteNumber(record.totalMicroCny, `${field}.totalMicroCny`),
    estimatedMicroCny: finiteNumber(record.estimatedMicroCny, `${field}.estimatedMicroCny`),
    settledMicroCny: finiteNumber(record.settledMicroCny, `${field}.settledMicroCny`),
    unknownMicroCny: finiteNumber(record.unknownMicroCny, `${field}.unknownMicroCny`),
    failedMicroCny: finiteNumber(record.failedMicroCny, `${field}.failedMicroCny`),
    unknownCount: finiteNumber(record.unknownCount, `${field}.unknownCount`),
    estimatedCount: finiteNumber(record.estimatedCount, `${field}.estimatedCount`),
    settledCount: finiteNumber(record.settledCount, `${field}.settledCount`),
    failedCount: finiteNumber(record.failedCount, `${field}.failedCount`),
    cacheHitTokens: finiteNumber(record.cacheHitTokens, `${field}.cacheHitTokens`),
    cacheMissTokens: finiteNumber(record.cacheMissTokens, `${field}.cacheMissTokens`),
    outputTokens: finiteNumber(record.outputTokens, `${field}.outputTokens`),
    reasoningTokens: finiteNumber(record.reasoningTokens, `${field}.reasoningTokens`),
    peakMicroCny: finiteNumber(record.peakMicroCny, `${field}.peakMicroCny`),
    offpeakMicroCny: finiteNumber(record.offpeakMicroCny, `${field}.offpeakMicroCny`),
    firstSeenAt: requiredString(record.firstSeenAt, `${field}.firstSeenAt`),
    lastSeenAt: requiredString(record.lastSeenAt, `${field}.lastSeenAt`),
    provider: requiredString(record.provider, `${field}.provider`),
    model: requiredString(record.model, `${field}.model`),
    reasoningEffort: requiredString(record.reasoningEffort, `${field}.reasoningEffort`),
    agentPreset: requiredString(record.agentPreset, `${field}.agentPreset`)
  };
}
function parseCostAnalyticsReport(value) {
  const record = object(value, "costAnalytics");
  return {
    generatedAt: requiredString(record.generatedAt, "costAnalytics.generatedAt"),
    global: parseAnalyticsTotal(record.global, "costAnalytics.global"),
    sessions: array(record.sessions, "costAnalytics.sessions").map((item) => {
      const session = object(item, "costAnalytics.sessions");
      return {
        sessionId: requiredString(session.sessionId, "costAnalytics.sessions.sessionId"),
        ...parseAnalyticsTotal(session, "costAnalytics.sessions")
      };
    }),
    dailyTrend: array(record.dailyTrend, "costAnalytics.dailyTrend").map(
      (item) => parseAnalyticsTrendBucket(item, "costAnalytics.dailyTrend")
    ),
    hourlyTrend: array(record.hourlyTrend, "costAnalytics.hourlyTrend").map(
      (item) => parseAnalyticsTrendBucket(item, "costAnalytics.hourlyTrend")
    ),
    anomalies: array(record.anomalies, "costAnalytics.anomalies").map(parseAnalyticsAnomaly)
  };
}
function parseUsageOverviewQuery(value) {
  const record = object(value, "usageOverviewQuery");
  const range = oneOf(record.range, ["today", "7d", "30d"], "usageOverviewQuery.range");
  if (record.timeZone === void 0) return { range };
  const timeZone = boundedString(record.timeZone, "usageOverviewQuery.timeZone", 100);
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
  } catch {
    throw new Error("usageOverviewQuery.timeZone: expected valid IANA time zone");
  }
  return { range, timeZone };
}
function parseUsageOverviewReport(value) {
  const record = object(value, "usageOverview");
  const range = oneOf(record.range, ["today", "7d", "30d"], "usageOverview.range");
  const expectedBuckets = range === "today" ? 24 : range === "7d" ? 7 : 30;
  const trend = array(record.trend, "usageOverview.trend");
  const topModels = array(record.topModels, "usageOverview.topModels");
  if (trend.length !== expectedBuckets) {
    throw new Error(`usageOverview.trend: expected ${expectedBuckets} buckets`);
  }
  if (topModels.length > 10) throw new Error("usageOverview.topModels: expected at most 10 models");
  const timeZone = parseTimeZone(record.timeZone, "usageOverview.timeZone");
  return {
    range,
    timeZone,
    generatedAt: timestamp(record.generatedAt, "usageOverview.generatedAt"),
    startAt: timestamp(record.startAt, "usageOverview.startAt"),
    endAt: timestamp(record.endAt, "usageOverview.endAt"),
    totals: parseUsageOverviewTotal(record.totals, "usageOverview.totals"),
    trend: trend.map((item, index) => {
      const bucket = object(item, `usageOverview.trend[${index}]`);
      return {
        key: boundedString(bucket.key, `usageOverview.trend[${index}].key`, 32),
        startAt: timestamp(bucket.startAt, `usageOverview.trend[${index}].startAt`),
        endAt: timestamp(bucket.endAt, `usageOverview.trend[${index}].endAt`),
        ...parseUsageOverviewTotal(bucket, `usageOverview.trend[${index}]`),
        models: bucket.models === void 0 ? [] : parseUsageOverviewModels(bucket.models, `usageOverview.trend[${index}].models`)
      };
    }),
    topModels: topModels.map((item, index) => {
      const model = object(item, `usageOverview.topModels[${index}]`);
      return {
        provider: boundedString(model.provider, `usageOverview.topModels[${index}].provider`, 120),
        model: boundedString(model.model, `usageOverview.topModels[${index}].model`, 240),
        ...parseUsageOverviewTotal(model, `usageOverview.topModels[${index}]`)
      };
    })
  };
}
function parseUsageOverviewModels(value, field) {
  return array(value, field).map((item, index) => {
    const model = object(item, `${field}[${index}]`);
    return {
      provider: boundedString(model.provider, `${field}[${index}].provider`, 120),
      model: boundedString(model.model, `${field}[${index}].model`, 240),
      ...parseUsageOverviewTotal(model, `${field}[${index}]`)
    };
  });
}
function parseUsageOverviewTotal(value, field) {
  const record = object(value, field);
  const requestCount = nonNegativeInteger(record.requestCount, `${field}.requestCount`);
  const pricedRequestCount = nonNegativeInteger(record.pricedRequestCount, `${field}.pricedRequestCount`);
  const unknownRequestCount = nonNegativeInteger(record.unknownRequestCount, `${field}.unknownRequestCount`);
  if (pricedRequestCount + unknownRequestCount !== requestCount) {
    throw new Error(`${field}: request coverage counts do not add up`);
  }
  return {
    amountMicroCny: nonNegativeInteger(record.amountMicroCny, `${field}.amountMicroCny`),
    totalTokens: nonNegativeInteger(record.totalTokens, `${field}.totalTokens`),
    requestCount,
    pricedRequestCount,
    unknownRequestCount,
    coverage: oneOf(record.coverage, ["complete", "partial", "unavailable"], `${field}.coverage`)
  };
}
function parseAnalyticsTotal(value, field) {
  const record = object(value, field);
  return {
    totalMicroCny: finiteNumber(record.totalMicroCny, `${field}.totalMicroCny`),
    requestCount: finiteNumber(record.requestCount, `${field}.requestCount`),
    statusCounts: parseAnalyticsStatusCounts(record.statusCounts, `${field}.statusCounts`),
    peakMicroCny: finiteNumber(record.peakMicroCny, `${field}.peakMicroCny`),
    offpeakMicroCny: finiteNumber(record.offpeakMicroCny, `${field}.offpeakMicroCny`)
  };
}
function parseAnalyticsTrendBucket(value, field) {
  const record = object(value, field);
  return {
    key: requiredString(record.key, `${field}.key`),
    startAt: requiredString(record.startAt, `${field}.startAt`),
    endAt: requiredString(record.endAt, `${field}.endAt`),
    amountMicroCny: finiteNumber(record.amountMicroCny, `${field}.amountMicroCny`),
    requestCount: finiteNumber(record.requestCount, `${field}.requestCount`),
    statusCounts: parseAnalyticsStatusCounts(record.statusCounts, `${field}.statusCounts`),
    peakMicroCny: finiteNumber(record.peakMicroCny, `${field}.peakMicroCny`),
    offpeakMicroCny: finiteNumber(record.offpeakMicroCny, `${field}.offpeakMicroCny`),
    previousAmountMicroCny: nullableNumber(record.previousAmountMicroCny, `${field}.previousAmountMicroCny`),
    deltaMicroCny: nullableNumber(record.deltaMicroCny, `${field}.deltaMicroCny`),
    deltaRatio: nullableNumber(record.deltaRatio, `${field}.deltaRatio`)
  };
}
function parseAnalyticsStatusCounts(value, field) {
  const record = object(value, field);
  return {
    estimated: finiteNumber(record.estimated, `${field}.estimated`),
    settled: finiteNumber(record.settled, `${field}.settled`),
    unknown: finiteNumber(record.unknown, `${field}.unknown`),
    failed: finiteNumber(record.failed, `${field}.failed`)
  };
}
function parseAnalyticsAnomaly(value) {
  const record = object(value, "costAnalytics.anomalies");
  return {
    ruleId: requiredString(record.ruleId, "costAnalytics.anomalies.ruleId"),
    severity: oneOf(record.severity, ["info", "warning"], "costAnalytics.anomalies.severity"),
    bucketKey: requiredString(record.bucketKey, "costAnalytics.anomalies.bucketKey"),
    ...record.observedMicroCny === void 0 ? {} : { observedMicroCny: finiteNumber(record.observedMicroCny, "costAnalytics.anomalies.observedMicroCny") },
    ...record.baselineMicroCny === void 0 ? {} : { baselineMicroCny: finiteNumber(record.baselineMicroCny, "costAnalytics.anomalies.baselineMicroCny") },
    ...record.observedCount === void 0 ? {} : { observedCount: finiteNumber(record.observedCount, "costAnalytics.anomalies.observedCount") },
    ...record.baselineCount === void 0 ? {} : { baselineCount: finiteNumber(record.baselineCount, "costAnalytics.anomalies.baselineCount") },
    ...record.ratio === void 0 ? {} : { ratio: finiteNumber(record.ratio, "costAnalytics.anomalies.ratio") },
    threshold: finiteNumber(record.threshold, "costAnalytics.anomalies.threshold"),
    explanation: requiredString(record.explanation, "costAnalytics.anomalies.explanation")
  };
}
function parseExchangeRate(value) {
  const record = object(value, "exchangeRate");
  return {
    status: oneOf(record.status, ["idle", "loading", "fresh", "error"], "exchangeRate.status"),
    baseCurrency: oneOf(record.baseCurrency, ["USD"], "exchangeRate.baseCurrency"),
    quoteCurrency: oneOf(record.quoteCurrency, ["CNY"], "exchangeRate.quoteCurrency"),
    rate: nullableNumber(record.rate, "exchangeRate.rate"),
    fetchedAt: nullableString(record.fetchedAt, "exchangeRate.fetchedAt"),
    source: nullableString(record.source, "exchangeRate.source"),
    error: nullableString(record.error, "exchangeRate.error")
  };
}
function parseConnection(value) {
  const record = object(value, "connection");
  const status = oneOf(record.status, ["connected", "stale", "loading", "error"], "connection.status");
  return { status, message: nullableString(record.message, "connection.message") };
}
function parseSummary(value) {
  const record = object(value, "summary");
  const status = object(record.status, "summary.status");
  const model = requiredString(record.model, "summary.model");
  return {
    status: { code: meterStatus(status.code, "summary.status.code") },
    provider: parseProvider(record.provider, model, "summary.provider"),
    model,
    reasoningEffort: requiredString(record.reasoningEffort, "summary.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "summary.agentPreset"),
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "summary.currentRequestMicroCny"),
    sessionTotalMicroCny: finiteNumber(record.sessionTotalMicroCny, "summary.sessionTotalMicroCny"),
    settledTotalMicroCny: finiteNumber(record.settledTotalMicroCny, "summary.settledTotalMicroCny"),
    estimatedTotalMicroCny: finiteNumber(record.estimatedTotalMicroCny, "summary.estimatedTotalMicroCny"),
    localTotalMicroCny: finiteNumber(record.localTotalMicroCny, "summary.localTotalMicroCny"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "summary.pricingZone"),
    ...record.currencyTotals === void 0 ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "summary.currencyTotals") },
    ...record.cnyEquivalentMicroCny === void 0 ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "summary.cnyEquivalentMicroCny") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "summary.currency") },
    ...record.currentRequestMinor === void 0 ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "summary.currentRequestMinor") },
    ...record.sessionTotalMinor === void 0 ? {} : { sessionTotalMinor: finiteNumber(record.sessionTotalMinor, "summary.sessionTotalMinor") }
  };
}
function parseCurrencyTotals(value, field) {
  return array(value, field).map((item) => {
    const record = object(item, field);
    return {
      currency: nonEmptyString(record.currency, `${field}.currency`),
      amountMinor: finiteNumber(record.amountMinor, `${field}.amountMinor`),
      settledMinor: finiteNumber(record.settledMinor, `${field}.settledMinor`),
      estimatedMinor: finiteNumber(record.estimatedMinor, `${field}.estimatedMinor`),
      failedMinor: finiteNumber(record.failedMinor, `${field}.failedMinor`)
    };
  });
}
function parseBalance(value) {
  const record = object(value, "balance");
  return {
    status: oneOf(record.status, ["fresh", "stale", "expired", "insufficient", "unavailable"], "balance.status"),
    currency: record.currency === void 0 ? "CNY" : nullableString(record.currency, "balance.currency"),
    totalMicroCny: nullableNumber(record.totalMicroCny, "balance.totalMicroCny"),
    grantedMicroCny: nullableNumber(record.grantedMicroCny, "balance.grantedMicroCny"),
    toppedUpMicroCny: nullableNumber(record.toppedUpMicroCny, "balance.toppedUpMicroCny"),
    refreshedAt: nullableString(record.refreshedAt, "balance.refreshedAt")
  };
}
function parseProviderBalance(value) {
  const record = object(value, "providerBalance");
  const balance = parseBalance(record);
  return {
    provider: nonEmptyString(record.provider, "providerBalance.provider"),
    providerName: nonEmptyString(record.providerName, "providerBalance.providerName"),
    supported: boolean(record.supported, "providerBalance.supported"),
    ...balance
  };
}
function legacyProviderBalances(provider, balance) {
  const normalized = provider.trim().toLowerCase();
  const inferredProvider = normalized === "unknown" && balance.totalMicroCny !== null ? "deepseek" : provider;
  const inferredNormalized = inferredProvider.trim().toLowerCase();
  if (!inferredProvider.trim() || inferredNormalized === "unknown") return [];
  const supported = inferredNormalized === "deepseek" || inferredNormalized === "deepseek-official";
  return [{
    provider: inferredProvider,
    providerName: supported ? "DeepSeek" : inferredProvider,
    supported,
    ...supported ? balance : unavailableBalance()
  }];
}
function refreshSupportedBalances(balances, balance) {
  const officialDeepSeek = balances.findIndex(
    (providerBalance) => providerBalance.supported && providerBalance.provider.trim().toLowerCase() === "deepseek-official"
  );
  const supported = balances.map((providerBalance, index) => providerBalance.supported ? index : -1).filter((index) => index >= 0);
  const target = officialDeepSeek >= 0 ? officialDeepSeek : supported.length === 1 ? supported[0] : -1;
  return balances.map((providerBalance, index) => index === target ? { ...providerBalance, ...balance } : providerBalance);
}
function unavailableBalance() {
  return {
    status: "unavailable",
    currency: null,
    totalMicroCny: null,
    grantedMicroCny: null,
    toppedUpMicroCny: null,
    refreshedAt: null
  };
}
function parseSessionSummary(value) {
  const record = object(value, "session");
  const model = requiredString(record.model, "session.model");
  return {
    id: requiredString(record.id, "session.id"),
    title: requiredString(record.title, "session.title"),
    provider: parseProvider(record.provider, model, "session.provider"),
    model,
    reasoningEffort: requiredString(record.reasoningEffort, "session.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "session.agentPreset"),
    status: meterStatus(record.status, "session.status"),
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "session.currentRequestMicroCny"),
    sessionTotalMicroCny: finiteNumber(record.sessionTotalMicroCny, "session.sessionTotalMicroCny"),
    unknownCount: finiteNumber(record.unknownCount, "session.unknownCount"),
    lastActivityAt: requiredString(record.lastActivityAt, "session.lastActivityAt"),
    ...record.currencyTotals === void 0 ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "session.currencyTotals") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "session.currency") },
    ...record.currentRequestMinor === void 0 ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "session.currentRequestMinor") },
    ...record.sessionTotalMinor === void 0 ? {} : { sessionTotalMinor: finiteNumber(record.sessionTotalMinor, "session.sessionTotalMinor") },
    ...record.cnyEquivalentMicroCny === void 0 ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "session.cnyEquivalentMicroCny") }
  };
}
function parseSessionDetail(value) {
  const record = object(value, "detail");
  const model = requiredString(record.model, "detail.model");
  return {
    id: requiredString(record.id, "detail.id"),
    title: requiredString(record.title, "detail.title"),
    provider: parseProvider(record.provider, model, "detail.provider"),
    model,
    reasoningEffort: requiredString(record.reasoningEffort, "detail.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "detail.agentPreset"),
    status: meterStatus(record.status, "detail.status"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "detail.pricingZone"),
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "detail.currentRequestMicroCny"),
    sessionTotalMicroCny: finiteNumber(record.sessionTotalMicroCny, "detail.sessionTotalMicroCny"),
    settledTotalMicroCny: finiteNumber(record.settledTotalMicroCny, "detail.settledTotalMicroCny"),
    estimatedTotalMicroCny: finiteNumber(record.estimatedTotalMicroCny, "detail.estimatedTotalMicroCny"),
    unknownCount: finiteNumber(record.unknownCount, "detail.unknownCount"),
    tokenBuckets: array(record.tokenBuckets, "detail.tokenBuckets").map(parseTokenBucket),
    contextBreakdown: parseContextBreakdown(record.contextBreakdown),
    turns: array(record.turns, "detail.turns").map(parseTurn),
    stages: array(record.stages, "detail.stages").map(parseStage),
    ...record.currencyTotals === void 0 ? {} : { currencyTotals: parseCurrencyTotals(record.currencyTotals, "detail.currencyTotals") },
    ...record.cnyEquivalentMicroCny === void 0 ? {} : { cnyEquivalentMicroCny: nullableNumber(record.cnyEquivalentMicroCny, "detail.cnyEquivalentMicroCny") }
  };
}
function parseStage(value) {
  const record = object(value, "stage");
  return {
    id: requiredString(record.id, "stage.id"),
    index: positiveInteger(record.index, "stage.index"),
    isCurrent: boolean(record.isCurrent, "stage.isCurrent"),
    startedAt: requiredString(record.startedAt, "stage.startedAt"),
    completedAt: nullableString(record.completedAt, "stage.completedAt"),
    lastActivityAt: requiredString(record.lastActivityAt, "stage.lastActivityAt"),
    status: meterStatus(record.status, "stage.status"),
    model: requiredString(record.model, "stage.model"),
    reasoningEffort: requiredString(record.reasoningEffort, "stage.reasoningEffort"),
    agentPreset: requiredString(record.agentPreset, "stage.agentPreset"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "stage.pricingZone"),
    priceVersion: requiredString(record.priceVersion, "stage.priceVersion"),
    ...record.exchangeRateLabel === void 0 ? {} : { exchangeRateLabel: nullableString(record.exchangeRateLabel, "stage.exchangeRateLabel") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "stage.currency") },
    ...record.currentRequestMinor === void 0 ? {} : { currentRequestMinor: finiteNumber(record.currentRequestMinor, "stage.currentRequestMinor") },
    ...record.totalMinor === void 0 ? {} : { totalMinor: finiteNumber(record.totalMinor, "stage.totalMinor") },
    ...record.settledTotalMinor === void 0 ? {} : { settledTotalMinor: finiteNumber(record.settledTotalMinor, "stage.settledTotalMinor") },
    ...record.estimatedTotalMinor === void 0 ? {} : { estimatedTotalMinor: finiteNumber(record.estimatedTotalMinor, "stage.estimatedTotalMinor") },
    currentRequestMicroCny: finiteNumber(record.currentRequestMicroCny, "stage.currentRequestMicroCny"),
    totalMicroCny: finiteNumber(record.totalMicroCny, "stage.totalMicroCny"),
    settledTotalMicroCny: finiteNumber(record.settledTotalMicroCny, "stage.settledTotalMicroCny"),
    estimatedTotalMicroCny: finiteNumber(record.estimatedTotalMicroCny, "stage.estimatedTotalMicroCny"),
    unknownCount: finiteNumber(record.unknownCount, "stage.unknownCount"),
    tokenBuckets: array(record.tokenBuckets, "stage.tokenBuckets").map(parseTokenBucket),
    turns: array(record.turns, "stage.turns").map(parseTurn),
    contextBreakdown: parseContextBreakdown(record.contextBreakdown, "stage.contextBreakdown")
  };
}
function parseContextBreakdown(value, field = "detail.contextBreakdown") {
  if (value === void 0 || value === null) return null;
  const record = object(value, field);
  return {
    systemTokens: nonNegativeNumber(record.systemTokens, `${field}.systemTokens`),
    toolsTokens: nonNegativeNumber(record.toolsTokens, `${field}.toolsTokens`),
    messageTokens: nonNegativeNumber(record.messageTokens, `${field}.messageTokens`)
  };
}
function parseTokenBucket(value) {
  const record = object(value, "tokenBucket");
  const unitPrice = record.unitPriceMicroCnyPerMillionTokens;
  const unitPriceMixed = record.unitPriceMixed;
  return {
    label: requiredString(record.label, "tokenBucket.label"),
    tokens: finiteNumber(record.tokens, "tokenBucket.tokens"),
    amountMicroCny: finiteNumber(record.amountMicroCny, "tokenBucket.amountMicroCny"),
    ...unitPrice === void 0 ? {} : {
      unitPriceMicroCnyPerMillionTokens: nullableNumber(
        unitPrice,
        "tokenBucket.unitPriceMicroCnyPerMillionTokens"
      )
    },
    ...unitPriceMixed === void 0 ? {} : { unitPriceMixed: boolean(unitPriceMixed, "tokenBucket.unitPriceMixed") },
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "tokenBucket.currency") },
    ...record.amountMinor === void 0 ? {} : { amountMinor: finiteNumber(record.amountMinor, "tokenBucket.amountMinor") },
    ...record.unitPriceMinorPerMillionTokens === void 0 ? {} : { unitPriceMinorPerMillionTokens: nullableNumber(record.unitPriceMinorPerMillionTokens, "tokenBucket.unitPriceMinorPerMillionTokens") }
  };
}
function parseTurn(value) {
  const record = object(value, "turn");
  return {
    id: requiredString(record.id, "turn.id"),
    label: requiredString(record.label, "turn.label"),
    startedAt: requiredString(record.startedAt, "turn.startedAt"),
    completedAt: nullableString(record.completedAt, "turn.completedAt"),
    status: meterStatus(record.status, "turn.status"),
    pricingZone: oneOf(record.pricingZone, ["peak", "offpeak", "unknown"], "turn.pricingZone"),
    cacheHitTokens: finiteNumber(record.cacheHitTokens, "turn.cacheHitTokens"),
    cacheMissTokens: finiteNumber(record.cacheMissTokens, "turn.cacheMissTokens"),
    outputTokens: finiteNumber(record.outputTokens, "turn.outputTokens"),
    reasoningTokens: finiteNumber(record.reasoningTokens, "turn.reasoningTokens"),
    amountMicroCny: finiteNumber(record.amountMicroCny, "turn.amountMicroCny"),
    note: nullableString(record.note, "turn.note"),
    ...record.currency === void 0 ? {} : { currency: nonEmptyString(record.currency, "turn.currency") },
    ...record.amountMinor === void 0 ? {} : { amountMinor: finiteNumber(record.amountMinor, "turn.amountMinor") }
  };
}
function object(value, field) {
  if (!isRecord(value)) throw new Error(`${field}: expected object`);
  return value;
}
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function array(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field}: expected array`);
  return value;
}
function requiredString(value, field) {
  if (typeof value !== "string") throw new Error(`${field}: expected string`);
  return value;
}
function nonEmptyString(value, field) {
  const parsed = requiredString(value, field);
  if (!parsed.trim()) throw new Error(`${field}: expected non-empty string`);
  return parsed;
}
function boundedString(value, field, maximumLength) {
  const parsed = nonEmptyString(value, field);
  if (parsed.length > maximumLength) throw new Error(`${field}: string is too long`);
  return parsed;
}
function parseTimeZone(value, field) {
  const timeZone = boundedString(value, field, 100);
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
  } catch {
    throw new Error(`${field}: expected valid IANA time zone`);
  }
  return timeZone;
}
function timestamp(value, field) {
  const parsed = boundedString(value, field, 64);
  if (!Number.isFinite(Date.parse(parsed))) throw new Error(`${field}: expected timestamp`);
  return parsed;
}
function nullableString(value, field) {
  if (value === null) return null;
  return requiredString(value, field);
}
function parseProvider(value, model, field) {
  if (value === void 0) {
    return model.trim().toLowerCase().startsWith("deepseek-") ? "deepseek" : "unknown";
  }
  return requiredString(value, field);
}
function boolean(value, field) {
  if (typeof value !== "boolean") throw new Error(`${field}: expected boolean`);
  return value;
}
function finiteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field}: expected finite number`);
  return value;
}
function nonNegativeNumber(value, field) {
  const number = finiteNumber(value, field);
  if (number < 0) throw new Error(`${field}: expected non-negative number`);
  return number;
}
function positiveInteger(value, field) {
  const number = finiteNumber(value, field);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${field}: expected positive integer`);
  return number;
}
function nonNegativeInteger(value, field) {
  const number = nonNegativeNumber(value, field);
  if (!Number.isSafeInteger(number)) throw new Error(`${field}: expected safe integer`);
  return number;
}
function nullableNumber(value, field) {
  if (value === null) return null;
  return finiteNumber(value, field);
}
function meterStatus(value, field) {
  return oneOf(
    value,
    ["idle", "billing", "settled", "unknown", "balance_expired", "balance_insufficient", "failed", "aborted"],
    field
  );
}
function oneOf(value, values, field) {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`${field}: expected one of ${values.join(", ")}`);
  }
  return value;
}

// packages/plugin/src/cordis-client.tsx
var name = "mymeter";
var inject = ["remote", "connection"];
var TOKEN_BILLING_VIEW_LABEL = "Token\u8BA1\u8D39";
async function apply(ctx) {
  const cleanups = [];
  try {
    cleanups.push(await ctx.remote.$mount(MYMETER_REMOTE_CONTRIBUTION));
    const uiFiber = ctx.inject(
      ["slots", "remote", "remote.mymeter", "connection"],
      mountMyMeterUi
    );
    await uiFiber;
    cleanups.push(() => uiFiber.dispose());
  } catch (error) {
    for (const cleanup of cleanups.reverse()) await cleanup();
    throw error;
  }
  return async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  };
}
async function mountMyMeterUi(ctx) {
  const namespace = ctx.remote.mymeter;
  if (!namespace) {
    throw new Error("mymeter: remote.mymeter is unavailable after mounting the Host contribution");
  }
  const remote = await createMyMeterRemoteFromTypert(namespace);
  const store = createMyMeterStore({ remote });
  const updateController = createMyMeterUpdateController({
    service: createConnectionRpcUpdateService(ctx.connection)
  });
  const cleanups = [
    () => remote.dispose(),
    () => store.destroy(),
    () => updateController.dispose(),
    ctx.slots.inject("shell.overlay", () => ctx.slots.register(
      { name: "shell.overlay", id: "mymeter", order: 100 },
      (props) => (0, import_react6.createElement)(ShellOverlay, {
        store,
        ...props,
        onOpenTokenBilling: openTokenBillingView
      })
    )),
    ctx.slots.inject("settings.plugin.item", () => ctx.slots.register(
      { name: "settings.plugin.item", id: "mymeter", key: "mymeter", order: 30, label: "Token\u8BA1\u8D39" },
      () => (0, import_react6.createElement)(MyMeterSettingsCard, { store })
    )),
    ctx.slots.inject("conversation.view", () => ctx.slots.register(
      { name: "conversation.view", id: "mymeter", order: 20, label: "Token\u8BA1\u8D39" },
      (props) => (0, import_react6.createElement)(MyMeterConversationView, {
        store,
        sessionId: props.sessionId,
        updateController,
        showUpdateControl: ctx.connection.isLoopback
      })
    ))
  ];
  return async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  };
}
function openTokenBillingView() {
  if (typeof document === "undefined") return;
  const tab = Array.from(document.querySelectorAll('button[role="tab"]')).find((button) => button.textContent?.trim() === TOKEN_BILLING_VIEW_LABEL);
  tab?.click();
}
return module.exports; } });
