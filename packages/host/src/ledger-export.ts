import { restoreLedgerEvent } from "./ledger.js";
import type { CostEventRecord } from "./types.js";

const LEDGER_EXPORT_SCHEMA_VERSION = 1;

export type CostEventLedgerExportFormat = "json" | "csv";

export interface CostEventLedgerExportOptions {
  format: CostEventLedgerExportFormat;
  events: readonly unknown[];
}

type ExportableCostEvent = Omit<CostEventRecord, "eventKey">;
type ExportField = keyof ExportableCostEvent;

const EXPORT_FIELDS: readonly ExportField[] = [
  "id",
  "sessionId",
  "turnId",
  "stepId",
  "attemptId",
  "parentSessionId",
  "requestStartedAt",
  "completedAt",
  "requestOutcome",
  "status",
  "source",
  "provider",
  "model",
  "reasoningEffort",
  "agentPreset",
  "currency",
  "amountMicroCny",
  "amountMinor",
  "cacheHitMinor",
  "cacheMissMinor",
  "outputMinor",
  "cacheHitTokens",
  "cacheMissTokens",
  "cacheWriteTokens",
  "outputTokens",
  "reasoningTokens",
  "hitRateMicroCny",
  "missRateMicroCny",
  "outputRateMicroCny",
  "cacheHitRateMicroCnyPerMillionTokens",
  "cacheMissRateMicroCnyPerMillionTokens",
  "outputRateMicroCnyPerMillionTokens",
  "cacheHitRateMinorPerMillionTokens",
  "cacheMissRateMinorPerMillionTokens",
  "outputRateMinorPerMillionTokens",
  "pricingZone",
  "priceVersion",
];

export function exportCostEventLedger({
  format,
  events,
}: CostEventLedgerExportOptions): string {
  const safeEvents = events.map((event) => toExportableCostEvent(restoreLedgerEvent(event)));

  switch (format) {
    case "json":
      return JSON.stringify({
        schemaVersion: LEDGER_EXPORT_SCHEMA_VERSION,
        events: safeEvents,
      }, null, 2);
    case "csv":
      return serializeCsv(safeEvents);
    default:
      throw new Error(`unknown cost event ledger export format: ${String(format)}`);
  }
}

function toExportableCostEvent(event: CostEventRecord): ExportableCostEvent {
  const exported = {} as ExportableCostEvent;
  for (const field of EXPORT_FIELDS) {
    const value = event[field];
    if (value !== undefined) {
      exported[field] = value as never;
    }
  }
  return exported;
}

function serializeCsv(events: readonly ExportableCostEvent[]): string {
  const lines = [
    EXPORT_FIELDS.join(","),
    ...events.map((event) => EXPORT_FIELDS.map((field) => escapeCsvCell(event[field])).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

function escapeCsvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(value)
    ? `'${value}`
    : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}
