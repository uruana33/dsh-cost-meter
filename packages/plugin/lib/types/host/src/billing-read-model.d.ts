export interface BillingReadModelEvent {
    eventKey: string;
    sessionId: string;
}
export interface BillingReadModel<T extends BillingReadModelEvent> {
    upsert(event: T): boolean;
    remove(eventKey: string): boolean;
    get(eventKey: string): T | undefined;
    getSessionEvents(sessionId: string): readonly T[];
    listSessionIds(): readonly string[];
    getGeneration(sessionId: string): number;
    rebuild(events: readonly T[]): void;
    clear(): void;
}
export interface BillingReadModelOptions<T extends BillingReadModelEvent> {
    equals?: (left: T, right: T) => boolean;
}
export declare function createBillingReadModel<T extends BillingReadModelEvent>(options?: BillingReadModelOptions<T>): BillingReadModel<T>;
