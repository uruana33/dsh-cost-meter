import type { MyMeterRemote, MyMeterRemoteSnapshot } from "./store";
export type MockScenarioName = "idle" | "billing" | "settled" | "unknown" | "balance_expired" | "balance_insufficient" | "failed" | "aborted";
export interface MyMeterMockRemote extends MyMeterRemote {
    setSnapshot(snapshot: MyMeterRemoteSnapshot): void;
    setScenario(scenario: MockScenarioName): void;
}
export declare function createMockRemote(initial?: MockScenarioName | MyMeterRemoteSnapshot): MyMeterMockRemote;
export declare function createMockRemoteFixtures(): Record<MockScenarioName, MyMeterRemoteSnapshot>;
