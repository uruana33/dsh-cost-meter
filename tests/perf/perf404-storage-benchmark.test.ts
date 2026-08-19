import { expect, test } from "vitest";

import {
  STORAGE_BENCHMARK_SIZES,
  type StorageBenchmarkMetrics,
  expectedStoredEventCount,
  measureRepositoryMutation,
  measureStorageBenchmark,
} from "./storage-benchmark.fixture";

test.each(STORAGE_BENCHMARK_SIZES)("PERF-404: compares JSON ledger and append-log storage for %d cold sessions", async (sessionCount) => {
  const json = await measureStorageBenchmark(sessionCount, "json-ledger");
  const append = await measureStorageBenchmark(sessionCount, "append-log");

  console.log("mymeter perf404 storage benchmark", JSON.stringify({
    sessionCount,
    json: printableMetrics(json),
    append: printableMetrics(append),
  }));

  expectStorageMetrics(json, sessionCount);
  expectStorageMetrics(append, sessionCount);
  expect(append.storedEventCount).toBe(json.storedEventCount);
  expect(append.storedEvents).toEqual(json.storedEvents);
  expect(append.coldRestoreEventCount).toBe(json.coldRestoreEventCount);
  expect(append.coldRestoreEvents).toEqual(json.coldRestoreEvents);
  expect(append.commitCount).toBe(json.commitCount);
  expect(append.cumulativeWriteBytes).toBeLessThan(json.cumulativeWriteBytes);
  expect(append.commitCount).toBeLessThanOrEqual(Math.ceil(expectedStoredEventCount(sessionCount) / 8) + 1);
  if (sessionCount === 1_000) {
    expect(append.cumulativeWriteBytes).toBeLessThanOrEqual(json.cumulativeWriteBytes * 0.2);
    expect(append.fsyncCount).toBeLessThan(json.fsyncCount);
  }
  expect(append.finalStorageBytes).toBeGreaterThan(0);
  expect(json.finalStorageBytes).toBeGreaterThan(0);
}, 60_000);

test.each([
  ["json-ledger", "replaceAll"],
  ["json-ledger", "clear"],
  ["append-log", "replaceAll"],
  ["append-log", "clear"],
] as const)("PERF-404: storage instrumentation counts %s %s mutations", async (kind, mutation) => {
  const metrics = await measureRepositoryMutation(kind, mutation);

  expect(metrics.mutationCount).toBe(1);
  expect(metrics.writeBytes).toBeGreaterThan(0);
  expect(metrics.fsyncCount).toBeGreaterThan(0);
});

function expectStorageMetrics(metrics: StorageBenchmarkMetrics, sessionCount: number): void {
  expect(metrics.sessionCount).toBe(sessionCount);
  expect(metrics.replayedSessionCount).toBe(sessionCount);
  expect(metrics.sessionEventCount).toBeGreaterThan(metrics.storedEventCount);
  expect(metrics.storedEventCount).toBe(expectedStoredEventCount(sessionCount));
  expect(metrics.coldRestoreEventCount).toBe(metrics.storedEventCount);
  expect(metrics.coldRestoreEvents).toEqual(metrics.storedEvents);
  expect(metrics.checkpointSessionRevisionCount).toBe(sessionCount);
  expect(metrics.checkpointStableRevisionCount).toBe(sessionCount);
  expect(metrics.commitCount).toBeGreaterThan(0);
  expect(metrics.cumulativeWriteBytes).toBeGreaterThanOrEqual(metrics.finalStorageBytes);
  expect(metrics.fsyncCount).toBeGreaterThan(0);
  expect(metrics.compactionWriteBytes).toBeGreaterThan(0);
  expect(metrics.compactionFsyncCount).toBeGreaterThan(0);
  expect(metrics.postCompactionWriteBytes).toBeGreaterThan(0);
  expect(metrics.postCompactionFsyncCount).toBeGreaterThan(0);
  expect(metrics.postCompactionStorageBytes).toBeGreaterThan(0);
  expect(metrics.checkpointHitReadCount).toBe(0);
  expect(metrics.checkpointHitCommitCount).toBe(0);
  expect(metrics.checkpointHitLedgerWriteBytes).toBe(0);
  expect(metrics.checkpointHitFsyncCount).toBe(0);
  expectFiniteNonNegative([
    metrics.backfillMs,
    metrics.commitP50Ms,
    metrics.commitP95Ms,
    metrics.commitMaxMs,
    metrics.coldRestoreMs,
    metrics.checkpointHitMs,
    metrics.compactionMs,
    metrics.postCompactionCommitMs,
  ]);
  expect(metrics.commitP95Ms).toBeGreaterThanOrEqual(metrics.commitP50Ms);
  expect(metrics.commitMaxMs).toBeGreaterThanOrEqual(metrics.commitP95Ms);
}

function printableMetrics(metrics: StorageBenchmarkMetrics): Omit<
  StorageBenchmarkMetrics,
  "storedEvents" | "coldRestoreEvents"
> {
  const { storedEvents: _storedEvents, coldRestoreEvents: _coldRestoreEvents, ...printable } = metrics;
  return printable;
}

function expectFiniteNonNegative(values: readonly number[]): void {
  for (const value of values) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }
}
