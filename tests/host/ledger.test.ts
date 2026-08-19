import { readFile, writeFile, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test, vi } from "vitest";

import {
  createFileCostEventRepository,
  createHostCostEventKey,
  createInMemoryCostEventRepository,
  dedupeHostCostEvents,
} from "../../packages/host/src/index";

const canonicalIdentity = {
  sessionId: "sess-1",
  turnId: "turn-1",
  stepId: "step-1",
  attemptId: "attempt-1",
};

test("in-memory ledger is immutable and idempotent by id", () => {
  const repo = createInMemoryCostEventRepository();
  const first = repo.upsert({
    id: "evt-1",
    sessionId: "sess-1",
    status: "estimated",
    amountMicroCny: 120,
    requestStartedAt: "2026-08-17T01:00:00.000Z",
    source: "stream",
    priceVersion: "v1",
  });
  const second = repo.upsert({
    id: "evt-1",
    sessionId: "sess-1",
    status: "settled",
    amountMicroCny: 180,
    requestStartedAt: "2026-08-17T01:00:00.000Z",
    source: "final_usage",
    priceVersion: "v2",
  });

  expect(first.amountMicroCny).toBe(120);
  expect(second.amountMicroCny).toBe(120);
  expect(second.priceVersion).toBe("v1");
  expect(repo.list()).toHaveLength(1);
  expect(repo.list()[0]?.status).toBe("estimated");
  expect(Object.isFrozen(repo.list()[0]!)).toBe(true);
});

test("in-memory ledger commit appends new events and keeps replacement priority", () => {
  const repo = createInMemoryCostEventRepository();
  repo.commit?.([
    {
      id: "evt-stream",
      ...canonicalIdentity,
      status: "estimated",
      amountMicroCny: 120,
      requestStartedAt: "2026-08-17T01:00:00.000Z",
      source: "stream",
    },
  ]);
  repo.commit?.([
    {
      id: "evt-final",
      ...canonicalIdentity,
      status: "settled",
      amountMicroCny: 180,
      requestStartedAt: "2026-08-17T01:00:00.000Z",
      source: "final_usage",
    },
    {
      id: "evt-second",
      sessionId: "sess-2",
      status: "settled",
      amountMicroCny: 200,
      requestStartedAt: "2026-08-17T01:01:00.000Z",
      source: "final_usage",
    },
  ]);

  expect(repo.list().map((event) => event.id)).toEqual(["evt-final", "evt-second"]);
  expect(repo.list()[0]?.status).toBe("settled");
});

test("file ledger persists events and reloads them", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-"));
  const filePath = `${tmp}/ledger.json`;
  const repo = createFileCostEventRepository({ filePath });

  repo.upsert({
    id: "evt-2",
    sessionId: "sess-2",
    status: "settled",
    amountMicroCny: 999,
    requestStartedAt: "2026-08-17T02:00:00.000Z",
    source: "final_usage",
    cacheHitRateMicroCnyPerMillionTokens: 50_000,
    cacheMissRateMicroCnyPerMillionTokens: 1_500_000,
    outputRateMicroCnyPerMillionTokens: 4_500_000,
  });

  const repo2 = createFileCostEventRepository({ filePath });
  expect(repo2.list()).toHaveLength(1);
  expect(repo2.list()[0]?.amountMicroCny).toBe(999);
  expect(repo2.list()[0]?.cacheHitRateMicroCnyPerMillionTokens).toBe(50_000);
  expect(repo2.list()[0]?.cacheMissRateMicroCnyPerMillionTokens).toBe(1_500_000);
  expect(repo2.list()[0]?.outputRateMicroCnyPerMillionTokens).toBe(4_500_000);
});

test("file ledger rejects schema-v1 objects without an events array without touching append files", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-append-manifest-"));
  const filePath = `${tmp}/ledger.json`;
  const logFile = `${tmp}/ledger.ndjson`;
  const manifest = {
    schemaVersion: 1,
    generation: 7,
    snapshotFile: "ledger.snapshot.json",
    logFile: "ledger.ndjson",
  };
  const sidecar = `${JSON.stringify({ id: "append-event-placeholder" })}\n`;
  await writeFile(filePath, JSON.stringify(manifest, null, 2));
  await writeFile(logFile, sidecar);

  expect(() => createFileCostEventRepository({ filePath })).toThrow(/events array/i);

  expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual(manifest);
  expect(await readFile(logFile, "utf8")).toBe(sidecar);
});

test("file ledger still accepts empty schema-v1 ledgers and legacy top-level arrays", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-json-compat-"));
  const objectPath = `${tmp}/ledger-object.json`;
  const arrayPath = `${tmp}/ledger-array.json`;
  const legacyEvent = {
    id: "legacy-array-event",
    sessionId: "legacy-array-session",
    status: "settled",
    amountMicroCny: 123,
    requestStartedAt: "2026-08-17T01:00:00.000Z",
    source: "final_usage",
  };
  await writeFile(objectPath, JSON.stringify({ schemaVersion: 1, events: [] }));
  await writeFile(arrayPath, JSON.stringify([legacyEvent]));

  expect(createFileCostEventRepository({ filePath: objectPath }).list()).toEqual([]);
  expect(createFileCostEventRepository({ filePath: arrayPath }).list().map((event) => event.id)).toEqual([
    "legacy-array-event",
  ]);
});

test("file ledger commit persists replacement events across restart", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-commit-"));
  const filePath = `${tmp}/ledger.json`;
  const repo = createFileCostEventRepository({ filePath });

  repo.commit?.([
    {
      id: "evt-stream",
      ...canonicalIdentity,
      status: "estimated",
      amountMicroCny: 120,
      requestStartedAt: "2026-08-17T01:00:00.000Z",
      source: "stream",
    },
  ]);
  repo.commit?.([
    {
      id: "evt-final",
      ...canonicalIdentity,
      status: "settled",
      amountMicroCny: 180,
      requestStartedAt: "2026-08-17T01:00:00.000Z",
      source: "final_usage",
    },
  ]);

  const restarted = createFileCostEventRepository({ filePath });
  expect(restarted.list()).toHaveLength(1);
  expect(restarted.list()[0]?.id).toBe("evt-final");
  expect(restarted.list()[0]?.status).toBe("settled");
});

test("file ledger preserves native-currency cost fields across restarts", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-native-currency-"));
  const filePath = `${tmp}/ledger.json`;
  const repo = createFileCostEventRepository({ filePath });

  repo.upsert({
    id: "evt-grok-usd",
    sessionId: "sess-grok-usd",
    status: "settled",
    amountMicroCny: 31_118,
    currency: "USD",
    amountMinor: 4_322,
    cacheHitMinor: 96,
    cacheMissMinor: 1_772,
    outputMinor: 2_454,
    requestStartedAt: "2026-08-18T14:00:00.000Z",
    source: "final_usage",
    provider: "cpa",
    model: "grok-4.6",
    cacheHitTokens: 192,
    cacheMissTokens: 886,
    cacheWriteTokens: 24,
    outputTokens: 409,
    cacheHitRateMinorPerMillionTokens: 500_000,
    cacheMissRateMinorPerMillionTokens: 2_000_000,
    outputRateMinorPerMillionTokens: 6_000_000,
    priceVersion: "xai-official-pricing-2026-08-18-usd",
  });

  const restored = createFileCostEventRepository({ filePath }).list()[0];
  expect(restored).toMatchObject({
    currency: "USD",
    amountMinor: 4_322,
    cacheHitMinor: 96,
    cacheMissMinor: 1_772,
    outputMinor: 2_454,
    cacheWriteTokens: 24,
    cacheHitRateMinorPerMillionTokens: 500_000,
    cacheMissRateMinorPerMillionTokens: 2_000_000,
    outputRateMinorPerMillionTokens: 6_000_000,
  });
});

test("file ledger reconstructs missing USD minor fields from its compatibility amounts", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-partial-usd-"));
  const filePath = `${tmp}/ledger.json`;
  await writeFile(filePath, JSON.stringify({
    schemaVersion: 1,
    events: [{
      id: "evt-partial-grok-usd",
      sessionId: "sess-partial-grok-usd",
      status: "settled",
      amountMicroCny: 31_118,
      currency: "USD",
      requestStartedAt: "2026-08-18T14:00:00.000Z",
      source: "final_usage",
      provider: "cpa",
      model: "grok-4.6",
      hitRateMicroCny: 691,
      missRateMicroCny: 12_758,
      outputRateMicroCny: 17_669,
      cacheHitRateMicroCnyPerMillionTokens: 3_600_000,
      cacheMissRateMicroCnyPerMillionTokens: 14_400_000,
      outputRateMicroCnyPerMillionTokens: 43_200_000,
      priceVersion: "xai-official-pricing-2026-08-18-usd",
    }],
  }));

  const restored = createFileCostEventRepository({ filePath }).list()[0];
  expect(restored).toMatchObject({
    currency: "USD",
    amountMinor: 4_322,
    cacheHitMinor: 96,
    cacheMissMinor: 1_772,
    outputMinor: 2_454,
    cacheHitRateMinorPerMillionTokens: 500_000,
    cacheMissRateMinorPerMillionTokens: 2_000_000,
    outputRateMinorPerMillionTokens: 6_000_000,
  });
});

test("ledger exposes canonical keys and dedupes by session-turn-step-attempt", async () => {
  expect(createHostCostEventKey(canonicalIdentity)).toBe("sess-1:turn-1:step-1:attempt-1");
  expect(
    dedupeHostCostEvents([
      {
        id: "evt-stream",
        ...canonicalIdentity,
        status: "estimated",
        amountMicroCny: 120,
        requestStartedAt: "2026-08-17T01:00:00.000Z",
        source: "stream",
      },
      {
        id: "evt-final",
        ...canonicalIdentity,
        status: "settled",
        amountMicroCny: 180,
        requestStartedAt: "2026-08-17T01:00:00.000Z",
        source: "final_usage",
      },
    ]).map((event) => event.id),
  ).toEqual(["evt-final"]);

  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-"));
  const filePath = `${tmp}/ledger.json`;
  await writeFile(
    filePath,
    JSON.stringify({
      schemaVersion: 1,
      events: [
        {
          id: "evt-stream",
          ...canonicalIdentity,
          status: "estimated",
          amountMicroCny: 120,
          requestStartedAt: "2026-08-17T01:00:00.000Z",
          source: "stream",
        },
        {
          id: "evt-final",
          ...canonicalIdentity,
          status: "settled",
          amountMicroCny: 180,
          requestStartedAt: "2026-08-17T01:00:00.000Z",
          completedAt: "2026-08-17T01:00:02.000Z",
          source: "final_usage",
        },
      ],
    }),
  );

  const repo = createFileCostEventRepository({ filePath });

  expect(repo.list()).toHaveLength(1);
  expect(repo.list()[0]?.id).toBe("evt-final");
  expect(repo.list()[0]?.amountMicroCny).toBe(180);
});

test("file ledger recovers from damaged JSON and persists a valid replacement", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-"));
  const filePath = `${tmp}/ledger.json`;
  await writeFile(filePath, "{ not valid json");
  const onRecovery = vi.fn();

  const repo = createFileCostEventRepository({ filePath, onRecovery });
  expect(repo.list()).toEqual([]);
  expect(onRecovery).toHaveBeenCalledWith(expect.objectContaining({
    filePath,
    reason: "corrupt",
    quarantinePath: expect.stringContaining("ledger.json.corrupt-"),
  }));
  let names = await readdir(tmp);
  expect(names).toHaveLength(1);
  expect(names.some((name) => name.startsWith("ledger.json.corrupt-"))).toBe(true);

  repo.upsert({
    id: "evt-after-damage",
    sessionId: "sess-after-damage",
    status: "settled",
    amountMicroCny: 321,
    requestStartedAt: "2026-08-17T03:00:00.000Z",
    source: "final_usage",
  });

  const restored = JSON.parse(await readFile(filePath, "utf8")) as { events: Array<{ id: string }> };
  expect(restored.events).toHaveLength(1);
  expect(restored.events[0]?.id).toBe("evt-after-damage");
  names = await readdir(tmp);
  expect(names.some((name) => name === "ledger.json")).toBe(true);
  expect(names.some((name) => name.startsWith("ledger.json.corrupt-"))).toBe(true);
});

test("file ledger quarantines unsupported schema versions on startup", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-"));
  const filePath = `${tmp}/ledger.json`;
  await writeFile(
    filePath,
    JSON.stringify({
      schemaVersion: 0,
      events: [
        {
          id: "legacy-evt",
          sessionId: "legacy-sess",
          status: "settled",
          amountMicroCny: 1,
          requestStartedAt: "2026-08-17T01:00:00.000Z",
          source: "restored",
        },
      ],
    }),
  );

  const repo = createFileCostEventRepository({ filePath });

  expect(repo.list()).toEqual([]);
  const names = await readdir(tmp);
  expect(names.includes("ledger.json")).toBe(false);
  expect(names.some((name) => name.startsWith("ledger.json.schema-0-"))).toBe(true);
});

test("file ledger preserves writes made by another repository for the same path", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-shared-"));
  const filePath = `${tmp}/ledger.json`;
  const repoA = createFileCostEventRepository({ filePath });
  const repoB = createFileCostEventRepository({ filePath });

  repoA.upsert({
    id: "evt-a",
    sessionId: "sess-a",
    status: "settled",
    amountMicroCny: 100,
    requestStartedAt: "2026-08-17T01:00:00.000Z",
    source: "final_usage",
  });
  repoB.upsert({
    id: "evt-b",
    sessionId: "sess-b",
    status: "settled",
    amountMicroCny: 200,
    requestStartedAt: "2026-08-17T01:01:00.000Z",
    source: "final_usage",
  });

  expect(createFileCostEventRepository({ filePath }).list().map((event) => event.id).sort()).toEqual([
    "evt-a",
    "evt-b",
  ]);
});

test("file ledger quarantines invalid events while keeping valid history", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-invalid-event-"));
  const filePath = `${tmp}/ledger.json`;
  await writeFile(filePath, JSON.stringify({
    schemaVersion: 1,
    events: [
      {
        id: "valid-event",
        sessionId: "valid-session",
        status: "settled",
        amountMicroCny: 123,
        requestStartedAt: "2026-08-17T01:00:00.000Z",
        source: "final_usage",
      },
      {
        id: "invalid-event",
        sessionId: "invalid:session",
        status: "settled",
        amountMicroCny: 456,
        requestStartedAt: "2026-08-17T01:00:00.000Z",
        source: "final_usage",
      },
    ],
  }));
  const onRecovery = vi.fn();

  const repo = createFileCostEventRepository({ filePath, onRecovery });

  expect(repo.list().map((event) => event.id)).toEqual(["valid-event"]);
  expect(onRecovery).toHaveBeenCalledWith(expect.objectContaining({
    filePath,
    reason: "invalid-events",
    recoveredEventCount: 1,
    rejectedEventCount: 1,
  }));
  expect(createFileCostEventRepository({ filePath }).list().map((event) => event.id)).toEqual(["valid-event"]);
});

test("file ledger rejects restored events with invalid enums or billing numbers", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-invalid-restore-values-"));
  const filePath = `${tmp}/ledger.json`;
  const validEvent = {
    id: "valid-event",
    sessionId: "valid-session",
    status: "settled",
    amountMicroCny: 123,
    requestStartedAt: "2026-08-17T01:00:00.000Z",
    source: "final_usage",
    requestOutcome: "success",
    pricingZone: "unknown",
    cacheHitTokens: 1,
    cacheMissTokens: 2,
    cacheWriteTokens: 3,
    outputTokens: 4,
    reasoningTokens: 5,
    hitRateMicroCny: 6,
    missRateMicroCny: 7,
    outputRateMicroCny: 8,
    cacheHitRateMicroCnyPerMillionTokens: 9,
    cacheMissRateMicroCnyPerMillionTokens: 10,
    outputRateMicroCnyPerMillionTokens: 11,
  };
  await writeFile(filePath, `{
    "schemaVersion": 1,
    "events": [
      ${JSON.stringify(validEvent)},
      ${JSON.stringify({ ...validEvent, id: "bad-status", status: "done" })},
      ${JSON.stringify({ ...validEvent, id: "bad-source", source: "api" })},
      ${JSON.stringify({ ...validEvent, id: "bad-outcome", requestOutcome: "timeout" })},
      ${JSON.stringify({ ...validEvent, id: "bad-zone", pricingZone: "discount" })},
      ${JSON.stringify({ ...validEvent, id: "negative-amount", amountMicroCny: -1 })},
      ${JSON.stringify({ ...validEvent, id: "negative-token", cacheHitTokens: -1 })},
      ${JSON.stringify({ ...validEvent, id: "fractional-rate", outputRateMicroCnyPerMillionTokens: 1.5 })},
      ${JSON.stringify({ ...validEvent, id: "" })},
      ${JSON.stringify({ ...validEvent, id: "bad-session", sessionId: "" })},
      ${JSON.stringify({ ...validEvent, id: "bad-start", requestStartedAt: "not-a-date" })},
      ${JSON.stringify({ ...validEvent, id: "bad-completed", completedAt: "not-a-date" })},
      { ${JSON.stringify("id")}: "overflow-amount",
        ${JSON.stringify("sessionId")}: "valid-session",
        ${JSON.stringify("status")}: "settled",
        ${JSON.stringify("amountMicroCny")}: 1e309,
        ${JSON.stringify("requestStartedAt")}: "2026-08-17T01:00:00.000Z",
        ${JSON.stringify("source")}: "final_usage" }
    ]
  }`);
  const onRecovery = vi.fn();

  const repo = createFileCostEventRepository({ filePath, onRecovery });

  expect(repo.list().map((event) => event.id)).toEqual(["valid-event"]);
  expect(onRecovery).toHaveBeenCalledWith(expect.objectContaining({
    filePath,
    reason: "invalid-events",
    recoveredEventCount: 1,
    rejectedEventCount: 12,
  }));
  expect(createFileCostEventRepository({ filePath }).list().map((event) => event.id)).toEqual(["valid-event"]);
});

test("file ledger dedupes canonical events across restarts", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "mymeter-ledger-"));
  const filePath = `${tmp}/ledger.json`;
  const repo = createFileCostEventRepository({ filePath });

  repo.upsert({
    id: "evt-stream-restart",
    ...canonicalIdentity,
    status: "estimated",
    amountMicroCny: 120,
    requestStartedAt: "2026-08-17T01:00:00.000Z",
    source: "stream",
  });
  repo.upsert({
    id: "evt-final-restart",
    ...canonicalIdentity,
    status: "settled",
    amountMicroCny: 180,
    requestStartedAt: "2026-08-17T01:00:00.000Z",
    completedAt: "2026-08-17T01:00:02.000Z",
    source: "final_usage",
  });

  const restarted = createFileCostEventRepository({ filePath });

  expect(restarted.list()).toHaveLength(1);
  expect(restarted.list()[0]?.id).toBe("evt-final-restart");
  expect(restarted.list()[0]?.status).toBe("settled");
});
