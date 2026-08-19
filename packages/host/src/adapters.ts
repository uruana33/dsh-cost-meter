import {
  asNumber,
  asText,
  normalizeTokenUsage,
  type HostMetadataInput,
  type HostMetadataRecord,
  type TokenProjectionRecord,
  type TokenUsageInput,
  type TokenUsageRecord,
} from "./types.js";

export interface HostMetadataAdapter {
  fromRequest(input: HostMetadataInput): HostMetadataRecord;
}

export function createHostMetadataAdapter(): HostMetadataAdapter {
  return {
    fromRequest(input) {
      return {
        provider: asText(input.provider),
        model: asText(input.model),
        reasoningEffort: asText(input.reasoningEffort),
        agentPreset: asText(input.agentPreset),
      };
    },
  };
}

export interface HostUsageAdapter {
  fromAssistantUsage(input: TokenUsageInput): TokenUsageRecord;
}

export function createHostUsageAdapter(): HostUsageAdapter {
  return {
    fromAssistantUsage(input) {
      return normalizeTokenUsage(input);
    },
  };
}

export interface HostProjectionAdapter {
  fromTokenMeter(input: TokenUsageInput & { reliability?: unknown; reliable?: unknown }): TokenProjectionRecord | null;
}

export function createHostProjectionAdapter(): HostProjectionAdapter {
  return {
    fromTokenMeter(input) {
      const usage = normalizeTokenUsage(input);
      const hasAnyTokens =
        usage.cacheHitTokens !== 0 ||
        usage.cacheMissTokens !== 0 ||
        usage.outputTokens !== 0 ||
        (usage.cacheWriteTokens ?? 0) !== 0 ||
        usage.reasoningTokens !== 0 ||
        usage.totalTokens !== 0;

      if (!hasAnyTokens) {
        return null;
      }

      return {
        ...usage,
        isReliable: isReliable(input.reliable ?? input.reliability),
      };
    },
  };
}

function isReliable(value: unknown): boolean {
  return value !== false && asNumber(value, 1) > 0;
}
