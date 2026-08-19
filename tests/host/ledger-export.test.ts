import { expect, test } from "vitest";

import {
  createFileCostEventRepository,
  exportCostEventLedger,
} from "../../packages/host/src";

const identity = {
  sessionId: "export-session",
  turnId: "turn-1",
  stepId: "step-1",
  attemptId: "attempt-1",
};

function event(id: string, amountMicroCny: number) {
  return {
    id,
    ...identity,
    status: "settled" as const,
    amountMicroCny,
    requestStartedAt: "2026-08-19T01:00:00.000Z",
    completedAt: "2026-08-19T01:00:01.000Z",
    source: "final_usage" as const,
    provider: "deepseek",
    model: "deepseek-chat",
    reasoningEffort: "standard",
    agentPreset: "coding",
    cacheHitTokens: 10,
    cacheMissTokens: 20,
    outputTokens: 30,
    reasoningTokens: 4,
    priceVersion: "v1",
  };
}

test("exports schema-v1 JSON with only safe ledger fields", () => {
  const exported = exportCostEventLedger({
    format: "json",
    events: [{
      ...event("json-export", 123),
      prompt: "hidden prompt",
      completion: "hidden completion",
      apiKey: "sk-secret",
    } as unknown],
  });

  const payload = JSON.parse(exported) as { schemaVersion?: number; events?: Array<Record<string, unknown>> };
  expect(payload.schemaVersion).toBe(1);
  expect(payload.events).toHaveLength(1);
  expect(payload.events?.[0]).toMatchObject({
    id: "json-export",
    sessionId: "export-session",
    status: "settled",
    amountMicroCny: 123,
    provider: "deepseek",
    model: "deepseek-chat",
  });
  expect(exported).not.toContain("hidden prompt");
  expect(exported).not.toContain("hidden completion");
  expect(exported).not.toContain("sk-secret");
  expect(exported).not.toContain("apiKey");
  expect(createFileCostEventRepository({ filePath: "unused" }).list).toBeTypeOf("function");
});

test("exports CSV with escaped values and no secret-bearing fields", () => {
  const exported = exportCostEventLedger({
    format: "csv",
    events: [{
      ...event("csv-export", 456),
      model: "deepseek, chat",
      agentPreset: "quote \"mode\"",
      prompt: "hidden prompt",
      completion: "hidden completion",
      apiKey: "sk-secret",
    } as unknown],
  });

  const [header, row] = exported.trimEnd().split("\n");
  expect(header).toContain("id,sessionId,turnId,stepId,attemptId");
  expect(header).not.toContain("prompt");
  expect(header).not.toContain("completion");
  expect(header).not.toContain("apiKey");
  expect(row).toContain("csv-export");
  expect(row).toContain("\"deepseek, chat\"");
  expect(row).toContain("\"quote \"\"mode\"\"\"");
  expect(exported).not.toContain("hidden prompt");
  expect(exported).not.toContain("hidden completion");
  expect(exported).not.toContain("sk-secret");
});

test("neutralizes spreadsheet formulas in CSV text fields", () => {
  const exported = exportCostEventLedger({
    format: "csv",
    events: [{
      ...event("formula-export", 1),
      model: "=HYPERLINK(\"https://example.test\")",
      agentPreset: "+SUM(1,1)",
    }],
  });

  const row = exported.trimEnd().split("\n")[1]!;
  expect(row).toContain("'=");
  expect(row).toContain("'+");
});

test("exports legacy schema-v1 and top-level-array ledger events compatibly", () => {
  const legacyObject = exportCostEventLedger({
    format: "json",
    events: [{
      id: "legacy-object",
      sessionId: "legacy-session",
      status: "estimated",
      amountMicroCny: 789,
      requestStartedAt: "2026-08-19T02:00:00.000Z",
      source: "stream",
    }],
  });
  const legacyArrayCsv = exportCostEventLedger({
    format: "csv",
    events: [{
      id: "legacy-array",
      sessionId: "legacy-session",
      status: "settled",
      amountMicroCny: 790,
      requestStartedAt: "2026-08-19T02:00:01.000Z",
      source: "final_usage",
    }],
  });

  expect(JSON.parse(legacyObject)).toMatchObject({
    schemaVersion: 1,
    events: [{ id: "legacy-object", currency: "CNY", model: "unknown" }],
  });
  expect(legacyArrayCsv).toContain("legacy-array");
  expect(legacyArrayCsv).toContain("CNY");
});

test("rejects unknown export formats explicitly", () => {
  expect(() => exportCostEventLedger({
    format: "xml" as never,
    events: [event("bad-format", 1)],
  })).toThrow(/unknown cost event ledger export format: xml/i);
});
