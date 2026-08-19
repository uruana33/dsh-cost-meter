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

function defaultEquals<T>(left: T, right: T): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => Object.is(a[key], b[key]));
}

export function createBillingReadModel<T extends BillingReadModelEvent>(
  options: BillingReadModelOptions<T> = {},
): BillingReadModel<T> {
  const byKey = new Map<string, T>();
  const bySession = new Map<string, Map<string, T>>();
  const generations = new Map<string, number>();
  const equals = options.equals ?? defaultEquals;
  const bump = (sessionId: string): void => {
    generations.set(sessionId, (generations.get(sessionId) ?? 0) + 1);
  };
  const remove = (eventKey: string): boolean => {
    const event = byKey.get(eventKey);
    if (!event) return false;
    byKey.delete(eventKey);
    const events = bySession.get(event.sessionId);
    events?.delete(eventKey);
    if (events && events.size === 0) bySession.delete(event.sessionId);
    bump(event.sessionId);
    return true;
  };
  return {
    upsert(event) {
      const previous = byKey.get(event.eventKey);
      if (previous && equals(previous, event)) return false;
      if (previous && previous.sessionId !== event.sessionId) {
        const oldEvents = bySession.get(previous.sessionId);
        oldEvents?.delete(event.eventKey);
        if (oldEvents && oldEvents.size === 0) bySession.delete(previous.sessionId);
        bump(previous.sessionId);
      }
      byKey.set(event.eventKey, event);
      const events = bySession.get(event.sessionId) ?? new Map<string, T>();
      events.set(event.eventKey, event);
      bySession.set(event.sessionId, events);
      bump(event.sessionId);
      return true;
    },
    remove,
    get: (eventKey) => byKey.get(eventKey),
    getSessionEvents: (sessionId) => [...(bySession.get(sessionId)?.values() ?? [])],
    listSessionIds: () => [...bySession.keys()],
    getGeneration: (sessionId) => generations.get(sessionId) ?? 0,
    rebuild(events) {
      byKey.clear();
      bySession.clear();
      generations.clear();
      for (const event of events) {
        const previous = byKey.get(event.eventKey);
        if (previous) {
          const oldEvents = bySession.get(previous.sessionId);
          oldEvents?.delete(event.eventKey);
        }
        byKey.set(event.eventKey, event);
        const sessionEvents = bySession.get(event.sessionId) ?? new Map<string, T>();
        sessionEvents.set(event.eventKey, event);
        bySession.set(event.sessionId, sessionEvents);
      }
      for (const sessionId of bySession.keys()) generations.set(sessionId, 1);
    },
    clear() {
      byKey.clear();
      bySession.clear();
      generations.clear();
    },
  };
}
