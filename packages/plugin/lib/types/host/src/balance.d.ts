import { type BalanceSnapshot } from "./types.js";
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
export declare function createDeepSeekBalanceService({ baseUrl, apiKey, resolveApiKey, fetchImpl, now, cacheTtlMs, }: DeepSeekBalanceServiceOptions): DeepSeekBalanceService;
