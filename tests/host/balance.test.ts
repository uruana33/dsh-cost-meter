import { expect, test, vi } from "vitest";

import { createDeepSeekBalanceService } from "../../packages/host/src/index";

test("balance service caches fresh snapshots and falls back to stale data", async () => {
  let calls = 0;
  const requests: HeadersInit[] = [];

  const service = createDeepSeekBalanceService({
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-host-only",
    fetchImpl: async (_url, init) => {
      calls += 1;
      requests.push(init?.headers ?? {});
      if (calls === 1) {
        return {
          ok: true,
          json: async () => ({
            is_available: true,
            balance_infos: [
              {
                currency: "CNY",
                total_balance: "100.125",
                granted_balance: "80.000",
                topped_up_balance: "20.125",
              },
            ],
          }),
        } as Response;
      }

      throw new Error("network down");
    },
    now: () => 1_000,
    cacheTtlMs: 10_000,
  });

  const first = await service.getSnapshot();
  expect(first.status).toBe("fresh");
  expect(first.total).toBe(100.125);
  expect(first.granted).toBe(80);
  expect(first.toppedUp).toBe(20.125);
  expect(first.currency).toBe("CNY");
  expect(requests[0]).toMatchObject({
    Authorization: "Bearer sk-host-only",
  });

  const second = await service.getSnapshot();
  expect(second.status).toBe("fresh");
  expect(calls).toBe(1);

  const stale = await service.getSnapshot({ forceRefresh: true });
  expect(stale.status).toBe("stale");
  expect(stale.total).toBe(100.125);
  expect(stale.totalMicroCny).toBe(100_125_000);
});

test("balance service exposes official CNY balances as explicit micro-CNY fields", async () => {
  const service = createDeepSeekBalanceService({
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-host-only",
    fetchImpl: async () =>
      ({
        ok: true,
        json: async () => ({
          is_available: true,
          balance_infos: [
            {
              currency: "USD",
              total_balance: "1.00",
              granted_balance: "0.00",
              topped_up_balance: "1.00",
            },
            {
              currency: "CNY",
              total_balance: "100.125",
              granted_balance: "80",
              topped_up_balance: "20.125001",
            },
          ],
        }),
      }) as Response,
    now: () => Date.UTC(2026, 7, 17, 1, 2, 3),
  });

  const snapshot = await service.getSnapshot();

  expect(snapshot.status).toBe("fresh");
  expect(snapshot.isAvailable).toBe(true);
  expect(snapshot.currency).toBe("CNY");
  expect(snapshot.totalMicroCny).toBe(100_125_000);
  expect(snapshot.grantedMicroCny).toBe(80_000_000);
  expect(snapshot.toppedUpMicroCny).toBe(20_125_001);
  expect(snapshot.updatedAt).toBe("2026-08-17T01:02:03.000Z");
  expect(snapshot.total).toBe(100.125);
  expect(snapshot.granted).toBe(80);
  expect(snapshot.toppedUp).toBe(20.125001);
});

test("balance service preserves USD currency while converting the selected amount to micros", async () => {
  const service = createDeepSeekBalanceService({
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-host-only",
    fetchImpl: async () =>
      ({
        ok: true,
        json: async () => ({
          is_available: true,
          balance_infos: [
            {
              currency: "USD",
              total_balance: "4.999999",
              granted_balance: "1.250000",
              topped_up_balance: "3.749999",
            },
          ],
        }),
      }) as Response,
  });

  const snapshot = await service.getSnapshot();

  expect(snapshot.currency).toBe("USD");
  expect(snapshot.totalMicroCny).toBe(4_999_999);
  expect(snapshot.grantedMicroCny).toBe(1_250_000);
  expect(snapshot.toppedUpMicroCny).toBe(3_749_999);
});

test("balance service resolves the current API key for every uncached request", async () => {
  let apiKey: string | undefined = "sk-first";
  const authorization: string[] = [];
  const service = createDeepSeekBalanceService({
    baseUrl: "https://api.deepseek.com",
    resolveApiKey: async () => apiKey,
    fetchImpl: async (_url, init) => {
      authorization.push(new Headers(init?.headers).get("Authorization") ?? "");
      return {
        ok: true,
        json: async () => ({
          is_available: true,
          balance_infos: [{ currency: "CNY", total_balance: "1.000" }],
        }),
      } as Response;
    },
  });

  await service.getSnapshot();
  apiKey = "sk-second";
  service.clearCache();
  await service.getSnapshot();

  expect(authorization).toEqual(["Bearer sk-first", "Bearer sk-second"]);

  apiKey = undefined;
  service.clearCache();
  const unavailable = await service.getSnapshot();
  expect(unavailable.status).toBe("unavailable");
  expect(authorization).toHaveLength(2);
  expect(unavailable.error).not.toContain("sk-first");
  expect(unavailable.error).not.toContain("sk-second");
});

test("balance service keeps an unavailable DeepSeek snapshot unavailable while cached", async () => {
  let calls = 0;
  const service = createDeepSeekBalanceService({
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-host-only",
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        json: async () => ({ is_available: false, balance_infos: [] }),
      } as Response;
    },
  });

  const first = await service.getSnapshot();
  const cached = await service.getSnapshot();

  expect(first.status).toBe("unavailable");
  expect(cached.status).toBe("unavailable");
  expect(cached.isExpired).toBe(true);
  expect(calls).toBe(1);
});

test("balance service does not expose provider response bodies in client-facing errors", async () => {
  const service = createDeepSeekBalanceService({
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-host-only",
    fetchImpl: vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => "credential sk-provider-secret rejected",
    })) as unknown as typeof fetch,
  });

  const snapshot = await service.getSnapshot();

  expect(snapshot.status).toBe("unavailable");
  expect(snapshot.error).toBe("DeepSeek balance request failed (HTTP 401)");
  expect(snapshot.error).not.toContain("sk-provider-secret");
});

test("balance service deduplicates concurrent uncached requests", async () => {
  let calls = 0;
  let resolveResponse: ((value: Response) => void) | undefined;
  const response = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  const service = createDeepSeekBalanceService({
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-host-only",
    fetchImpl: vi.fn(async () => {
      calls += 1;
      return response;
    }) as unknown as typeof fetch,
  });

  const first = service.getSnapshot();
  const second = service.getSnapshot();
  resolveResponse?.({
    ok: true,
    json: async () => ({
      is_available: true,
      balance_infos: [{ currency: "CNY", total_balance: "3.5" }],
    }),
  } as Response);

  await expect(Promise.all([first, second])).resolves.toMatchObject([
    { status: "fresh", totalMicroCny: 3_500_000 },
    { status: "fresh", totalMicroCny: 3_500_000 },
  ]);
  expect(calls).toBe(1);
});

test("force refresh bypasses a fresh balance TTL", async () => {
  let calls = 0;
  const service = createDeepSeekBalanceService({
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-host-only",
    cacheTtlMs: 60 * 60_000,
    fetchImpl: vi.fn(async () => {
      calls += 1;
      return {
        ok: true,
        json: async () => ({
          is_available: true,
          balance_infos: [{ currency: "CNY", total_balance: String(calls) }],
        }),
      } as Response;
    }) as unknown as typeof fetch,
  });

  await expect(service.getSnapshot()).resolves.toMatchObject({ total: 1 });
  await expect(service.getSnapshot()).resolves.toMatchObject({ total: 1 });
  await expect(service.getSnapshot({ forceRefresh: true })).resolves.toMatchObject({ total: 2 });
  expect(calls).toBe(2);
});

test("balance service times out without leaking credentials and keeps the last successful snapshot", async () => {
  vi.useFakeTimers();
  try {
    let calls = 0;
    const service = createDeepSeekBalanceService({
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-timeout-secret",
      fetchImpl: vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return {
            ok: true,
            json: async () => ({
              is_available: true,
              balance_infos: [{ currency: "CNY", total_balance: "8" }],
            }),
          } as Response;
        }
        return new Promise<Response>(() => {});
      }) as unknown as typeof fetch,
      requestTimeoutMs: 50,
    });

    await expect(service.getSnapshot()).resolves.toMatchObject({ status: "fresh", total: 8 });
    const timedOut = service.getSnapshot({ forceRefresh: true });
    await vi.advanceTimersByTimeAsync(50);

    await expect(timedOut).resolves.toMatchObject({
      status: "stale",
      total: 8,
      error: "DeepSeek balance request timed out",
    });
    expect((await timedOut).error).not.toContain("sk-timeout-secret");
  } finally {
    vi.useRealTimers();
  }
});

test("balance service backs off after failures and recovers after the retry window", async () => {
  let currentTime = 1_000;
  let calls = 0;
  const service = createDeepSeekBalanceService({
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-host-only",
    now: () => currentTime,
    failureBackoffMs: [100, 200],
    fetchImpl: vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("network contains sk-host-only");
      return {
        ok: true,
        json: async () => ({
          is_available: true,
          balance_infos: [{ currency: "CNY", total_balance: "6" }],
        }),
      } as Response;
    }) as unknown as typeof fetch,
  });

  const failed = await service.getSnapshot();
  expect(failed).toMatchObject({ status: "unavailable", error: "DeepSeek balance request failed" });
  expect(failed.error).not.toContain("sk-host-only");

  currentTime = 1_050;
  await expect(service.getSnapshot()).resolves.toMatchObject({ status: "unavailable" });
  expect(calls).toBe(1);

  currentTime = 1_100;
  await expect(service.getSnapshot()).resolves.toMatchObject({ status: "fresh", total: 6 });
  expect(calls).toBe(2);
});
