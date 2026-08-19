import { asNumber, asRecord, type BalanceSnapshot } from "./types.js";

export interface DeepSeekBalanceServiceOptions {
  baseUrl: string;
  apiKey?: string;
  resolveApiKey?: () => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  cacheTtlMs?: number;
}

export interface BalanceRequestOptions {
  forceRefresh?: boolean;
}

export interface DeepSeekBalanceService {
  getSnapshot(options?: BalanceRequestOptions): Promise<BalanceSnapshot>;
  clearCache(): void;
}

type FetchResponse = {
  ok: boolean;
  json(): Promise<unknown>;
  text?(): Promise<string>;
};

export function createDeepSeekBalanceService({
  baseUrl,
  apiKey,
  resolveApiKey,
  fetchImpl = fetch,
  now = () => Date.now(),
  cacheTtlMs = 5 * 60_000,
}: DeepSeekBalanceServiceOptions): DeepSeekBalanceService {
  let cache: BalanceSnapshot | null = null;

  async function requestBalance(): Promise<BalanceSnapshot> {
    const currentApiKey = resolveApiKey ? await resolveApiKey() : apiKey;
    if (!currentApiKey?.trim()) {
      throw new Error("DeepSeek API credential is not configured");
    }
    const init: RequestInit = { headers: { Authorization: `Bearer ${currentApiKey}` } };
    const response = (await fetchImpl(new URL("/user/balance", baseUrl), init)) as FetchResponse;

    if (!response.ok) {
      const status = (response as { status?: number }).status ?? "unknown";
      throw new Error(`DeepSeek balance request failed (HTTP ${status})`);
    }

    const body = asRecord(await response.json());
    const balanceInfo = selectCurrencyBalance(body);
    const fetchedAt = now();
    const updatedAt = new Date(fetchedAt).toISOString();
    const snapshot: BalanceSnapshot = {
      status: body.is_available === false ? "unavailable" : "fresh",
      isAvailable: body.is_available !== false,
      unit: "microCny",
      totalMicroCny: asNullableMicroCny(balanceInfo.total ?? body.total),
      grantedMicroCny: asNullableMicroCny(balanceInfo.granted ?? body.granted),
      toppedUpMicroCny: asNullableMicroCny(balanceInfo.toppedUp ?? body.topped_up ?? body.toppedUp),
      total: asNullableNumber(balanceInfo.total ?? body.total),
      granted: asNullableNumber(balanceInfo.granted ?? body.granted),
      toppedUp: asNullableNumber(balanceInfo.toppedUp ?? body.topped_up ?? body.toppedUp),
      fetchedAt,
      updatedAt,
      expiresAt: fetchedAt + cacheTtlMs,
      isExpired: body.is_available === false,
    };
    if (balanceInfo.currency) {
      snapshot.currency = balanceInfo.currency;
    }

    cache = snapshot;
    return snapshot;
  }

  return {
    async getSnapshot(options = {}) {
      const currentTime = now();

      if (cache && currentTime <= cache.expiresAt && !options.forceRefresh) {
        const { error: _error, ...freshCache } = cache;
        return {
          ...freshCache,
          status: cache.status,
          isExpired: cache.status === "unavailable",
        };
      }

      try {
        return await requestBalance();
      } catch (error) {
        if (cache) {
          return {
            ...cache,
            status: "stale",
            isExpired: currentTime > cache.expiresAt,
            error: error instanceof Error ? error.message : "balance request failed",
          };
        }

        return {
          status: "unavailable",
          isAvailable: false,
          unit: "microCny",
          totalMicroCny: null,
          grantedMicroCny: null,
          toppedUpMicroCny: null,
          total: null,
          granted: null,
          toppedUp: null,
          fetchedAt: currentTime,
          expiresAt: currentTime,
          isExpired: true,
          error: error instanceof Error ? error.message : "balance request failed",
        };
      }
    },
    clearCache() {
      cache = null;
    },
  };
}

function asNullableNumber(value: unknown): number | null {
  const parsed = asNumber(value, Number.NaN);
  return Number.isNaN(parsed) ? null : parsed;
}

function asNullableMicroCny(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 1_000_000);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const whole = BigInt(match[1] ?? "0") * 1_000_000n;
  const fraction = match[2] ?? "";
  const padded = `${fraction}0000000`;
  const microFraction = BigInt(padded.slice(0, 6));
  const rounded = padded[6] && Number(padded[6]) >= 5 ? 1n : 0n;
  const total = whole + microFraction + rounded;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  return Number(total);
}

function selectCurrencyBalance(body: Record<string, unknown>): {
  currency?: string;
  total?: unknown;
  granted?: unknown;
  toppedUp?: unknown;
} {
  const infos = Array.isArray(body.balance_infos) ? body.balance_infos : [];
  const records = infos.filter((value): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  });
  const selected =
    records.find((record) => String(record.currency ?? "").toUpperCase() === "CNY") ??
    records[0];

  if (!selected) {
    return {};
  }

  const result: {
    currency?: string;
    total?: unknown;
    granted?: unknown;
    toppedUp?: unknown;
  } = {
    total: selected.total_balance ?? selected.total,
    granted: selected.granted_balance ?? selected.granted,
    toppedUp: selected.topped_up_balance ?? selected.toppedUp,
  };
  if (typeof selected.currency === "string") {
    result.currency = selected.currency;
  }
  return result;
}
