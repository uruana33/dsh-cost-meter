import { waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import {
  createCordisHistoryRecoverySource,
  createHistoryRecovery,
  type HistoryRecoveryStatus,
  type HistoryReplaySession,
} from "../../packages/plugin/src/history-recovery";
import type { MyMeterCordisContext } from "../../packages/plugin/src/cordis-host";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("history recovery batches cold sessions by count and yields after each batch", async () => {
  const batchCalls: string[][] = [];
  const yieldToEventLoop = vi.fn(async () => {});
  const readSession = vi.fn(async (sessionId: string) => ({
    session: { id: sessionId },
    events: [{ type: "step/start" }],
  }));
  const statuses: HistoryRecoveryStatus[] = [];
  const recovery = createHistoryRecovery({
    source: createCordisHistoryRecoverySource({
      sessionQuery: {
        listSessions: async () =>
          Array.from({ length: 9 }, (_, index) => ({
            header: { id: `sess-${index}` },
            live: false,
            persisted: true,
          })),
        readSession,
      },
    } as unknown as MyMeterCordisContext),
    target: {
      replayBatch(sessions: readonly HistoryReplaySession[]) {
        batchCalls.push(sessions.map((session) => session.id));
        return {
          replayedSessions: sessions.length,
          skippedUnchangedSessions: 0,
          eventsSeen: sessions.reduce((total, session) => total + session.events.length, 0),
        };
      },
    },
    yieldToEventLoop,
    onStatus: (status) => statuses.push(status),
  });

  recovery.start();
  await waitFor(() => expect(statuses.at(-1)?.state).toBe("completed"));

  expect(batchCalls).toEqual([["sess-0", "sess-1", "sess-2", "sess-3", "sess-4", "sess-5", "sess-6", "sess-7"], ["sess-8"]]);
  expect(yieldToEventLoop).toHaveBeenCalledTimes(2);
  expect(readSession).toHaveBeenCalledTimes(9);
});

test("history recovery drops a cold session when it becomes live before replay", async () => {
  const replayBatch = vi.fn((sessions: readonly HistoryReplaySession[]) => ({
    replayedSessions: sessions.length,
    skippedUnchangedSessions: 0,
    eventsSeen: sessions.reduce((total, session) => total + session.events.length, 0),
  }));
  const readDeferred = createDeferred<{ session: { id: string }; events: unknown[] }>();
  const readSession = vi.fn(async () => readDeferred.promise);
  const statuses: HistoryRecoveryStatus[] = [];
  const recovery = createHistoryRecovery({
    source: createCordisHistoryRecoverySource({
      sessionQuery: {
        listSessions: async () => [{ header: { id: "sess-live-race" }, live: false, persisted: true }],
        readSession,
      },
    } as unknown as MyMeterCordisContext),
    target: { replayBatch },
    onStatus: (status) => statuses.push(status),
  });

  recovery.start();
  await waitFor(() => expect(readSession).toHaveBeenCalledTimes(1));
  recovery.markLive("sess-live-race");
  readDeferred.resolve({
    session: { id: "sess-live-race" },
    events: [{ type: "step/start" }],
  });

  await waitFor(() => expect(statuses.at(-1)?.state).toBe("completed"));
  expect(replayBatch).not.toHaveBeenCalled();
  expect(statuses.at(-1)?.skippedLiveSessions).toBe(1);
});

test("history recovery honors cancellation and session read failures stay isolated", async () => {
  const replayBatch = vi.fn((sessions: readonly HistoryReplaySession[]) => ({
    replayedSessions: sessions.length,
    skippedUnchangedSessions: 0,
    eventsSeen: sessions.reduce((total, session) => total + session.events.length, 0),
  }));
  const inspect = vi.fn(async (sessionId: string) => {
    if (sessionId === "sess-bad") {
      throw new Error("boom");
    }
    return {
      meta: { id: sessionId },
      events: [{ type: "step/start" }],
    };
  });
  const statuses: HistoryRecoveryStatus[] = [];
  const recovery = createHistoryRecovery({
    source: createCordisHistoryRecoverySource({
      sessionPersistence: {
        list: async () => [
          { header: { id: "sess-ok-1" }, live: false, persisted: true },
          { header: { id: "sess-bad" }, live: false, persisted: true },
          { header: { id: "sess-ok-2" }, live: false, persisted: true },
        ],
        inspect,
      },
    } as unknown as MyMeterCordisContext),
    target: { replayBatch },
    onStatus: (status) => statuses.push(status),
  });

  recovery.start();
  await waitFor(() => expect(statuses.at(-1)?.state).toBe("completed"));
  expect(inspect).toHaveBeenCalledTimes(3);
  expect(replayBatch).toHaveBeenCalledTimes(1);
  expect(replayBatch.mock.calls[0]?.[0].map((session) => session.id)).toEqual(["sess-ok-1", "sess-ok-2"]);
  expect(statuses.at(-1)?.failedReads).toBe(1);

  const cancelListDeferred = createDeferred<readonly unknown[]>();
  const cancelReplayBatch = vi.fn((sessions: readonly HistoryReplaySession[]) => ({
    replayedSessions: sessions.length,
    skippedUnchangedSessions: 0,
    eventsSeen: sessions.reduce((total, session) => total + session.events.length, 0),
  }));
  const cancelReadSession = vi.fn();
  const cancelStatuses: HistoryRecoveryStatus[] = [];
  const cancelRecovery = createHistoryRecovery({
    source: createCordisHistoryRecoverySource({
      sessionQuery: {
        listSessions: async () => cancelListDeferred.promise,
        readSession: cancelReadSession,
      },
    } as unknown as MyMeterCordisContext),
    target: { replayBatch: cancelReplayBatch },
    onStatus: (status) => cancelStatuses.push(status),
  });

  cancelRecovery.start();
  cancelRecovery.cancel("uninstall");
  cancelListDeferred.resolve([{ header: { id: "sess-cancelled" }, live: false, persisted: true }]);

  await waitFor(() => expect(cancelStatuses.at(-1)?.state).toBe("cancelled"));
  expect(cancelReadSession).not.toHaveBeenCalled();
  expect(cancelReplayBatch).not.toHaveBeenCalled();
});

test("history recovery rechecks live sessions at commit and stops after commit failure", async () => {
  const secondRead = createDeferred<{ session: { id: string }; events: unknown[] }>();
  const replayBatch = vi.fn(() => {
    throw new Error("ledger commit failed");
  });
  const statuses: HistoryRecoveryStatus[] = [];
  const recovery = createHistoryRecovery({
    source: createCordisHistoryRecoverySource({
      sessionQuery: {
        listSessions: async () => [
          { header: { id: "queued-live" }, live: false, persisted: true },
          { header: { id: "commit-failure" }, live: false, persisted: true },
        ],
        readSession: async (sessionId: string) => sessionId === "queued-live"
          ? { session: { id: sessionId }, events: [{ type: "step/start" }] }
          : secondRead.promise,
      },
    } as unknown as MyMeterCordisContext),
    target: { replayBatch },
    onStatus: (status) => statuses.push(status),
  });

  recovery.start();
  await waitFor(() => expect(recovery.status().readSessions).toBe(1));
  recovery.markLive("queued-live");
  secondRead.resolve({ session: { id: "commit-failure" }, events: [{ type: "step/start" }] });

  await waitFor(() => expect(statuses.at(-1)?.state).toBe("failed"));
  expect(replayBatch).toHaveBeenCalledWith([
    expect.objectContaining({ id: "commit-failure" }),
  ]);
  expect(statuses.at(-1)?.skippedLiveSessions).toBe(1);
  expect(statuses.at(-1)?.lastError).toBe("ledger commit failed");
});

test("history recovery skips unchanged listSnapshots revisions and saves after successful replay", async () => {
  const sequence: string[] = [];
  const inspect = vi.fn(async (sessionId: string) => ({
    meta: { id: sessionId },
    events: [{ type: "step/start" }],
  }));
  const saveCheckpoint = vi.fn((sessionRevisions: Record<string, string>) => {
    sequence.push(`checkpoint:${Object.keys(sessionRevisions).join(",")}`);
  });
  const statuses: HistoryRecoveryStatus[] = [];
  const recovery = createHistoryRecovery({
    source: createCordisHistoryRecoverySource({
      sessionPersistence: {
        list: async () => {
          throw new Error("list fallback should not be used");
        },
        inspect,
        listSnapshots: async () => [
          { header: { id: "unchanged" }, revision: "rev-1" },
          { header: { id: "changed" }, revision: "rev-2" },
        ],
      },
    } as unknown as MyMeterCordisContext),
    checkpoint: {
      sessionRevisions: { unchanged: "rev-1", changed: "rev-old", removed: "rev-gone" },
      save: saveCheckpoint,
    },
    target: {
      replayBatch(sessions: readonly HistoryReplaySession[]) {
        sequence.push(`ledger:${sessions.map((session) => session.id).join(",")}`);
        return {
          replayedSessions: sessions.length,
          skippedUnchangedSessions: 0,
          eventsSeen: sessions.reduce((total, session) => total + session.events.length, 0),
        };
      },
    },
    onStatus: (status) => statuses.push(status),
  });

  recovery.start();
  await waitFor(() => expect(statuses.at(-1)?.state).toBe("completed"));

  expect(inspect).toHaveBeenCalledTimes(1);
  expect(inspect).toHaveBeenCalledWith("changed", expect.any(AbortSignal));
  expect(statuses.at(-1)).toMatchObject({
    readSessions: 1,
    replayedSessions: 1,
    skippedUnchangedSessions: 1,
  });
  expect(sequence[0]).toBe("ledger:changed");
  expect(saveCheckpoint).toHaveBeenLastCalledWith({
    unchanged: "rev-1",
    changed: "rev-2",
  });
  expect(saveCheckpoint.mock.calls.at(-1)?.[0]).not.toHaveProperty("removed");
});

test("history recovery fully replays listSnapshots sessions when checkpoint metadata is unavailable", async () => {
  const inspect = vi.fn(async (sessionId: string) => ({
    meta: { id: sessionId },
    events: [{ type: "step/start" }],
  }));
  const replayBatch = vi.fn((sessions: readonly HistoryReplaySession[]) => ({
    replayedSessions: sessions.length,
    skippedUnchangedSessions: 0,
    eventsSeen: sessions.reduce((total, session) => total + session.events.length, 0),
  }));
  const statuses: HistoryRecoveryStatus[] = [];
  const recovery = createHistoryRecovery({
    source: createCordisHistoryRecoverySource({
      sessionPersistence: {
        list: async () => [],
        inspect,
        listSnapshots: async () => [
          { header: { id: "session-a" }, revision: "rev-1" },
          { header: { id: "session-b" }, revision: "rev-2" },
        ],
      },
    } as unknown as MyMeterCordisContext),
    checkpoint: {
      sessionRevisions: {},
      save: vi.fn(),
    },
    target: { replayBatch },
    onStatus: (status) => statuses.push(status),
  });

  recovery.start();
  await waitFor(() => expect(statuses.at(-1)?.state).toBe("completed"));

  expect(inspect).toHaveBeenCalledTimes(2);
  expect(replayBatch).toHaveBeenCalledWith([
    expect.objectContaining({ id: "session-a", revision: "rev-1" }),
    expect.objectContaining({ id: "session-b", revision: "rev-2" }),
  ]);
  expect(statuses.at(-1)?.skippedUnchangedSessions).toBe(0);
});

test("Cordis history source prefers persistence listSnapshots revisions when query is also present", async () => {
  const queryListSessions = vi.fn(async () => [{ header: { id: "query-only" } }]);
  const queryReadSession = vi.fn(async () => ({
    session: { id: "query-only" },
    events: [{ type: "step/start" }],
  }));
  const inspect = vi.fn(async (sessionId: string) => ({
    meta: { id: sessionId },
    events: [{ type: "step/start" }],
  }));
  const source = createCordisHistoryRecoverySource({
    sessionQuery: {
      listSessions: queryListSessions,
      readSession: queryReadSession,
    },
    sessionPersistence: {
      list: async () => [],
      inspect,
      listSnapshots: async () => [{ header: { id: "snapshot-session" }, revision: "rev-snapshot" }],
    },
  } as unknown as MyMeterCordisContext);

  const refs = await source.list(new AbortController().signal);
  expect(refs).toEqual([
    expect.objectContaining({ id: "snapshot-session", source: "persistence", revision: "rev-snapshot" }),
  ]);
  expect(queryListSessions).not.toHaveBeenCalled();
  expect(queryReadSession).not.toHaveBeenCalled();
  expect(inspect).not.toHaveBeenCalled();
});

test("Cordis history source keeps listSnapshots revisions but reads exact query history first", async () => {
  const queryReadSession = vi.fn(async (sessionId: string) => ({
    session: { id: sessionId },
    events: [{ type: "step/start", source: "query" }],
  }));
  const inspect = vi.fn(async (sessionId: string) => ({
    meta: { id: sessionId },
    events: [{ type: "step/start", source: "persistence" }],
  }));
  const source = createCordisHistoryRecoverySource({
    sessionQuery: {
      listSessions: async () => [{ header: { id: "query-only" } }],
      readSession: queryReadSession,
    },
    sessionPersistence: {
      list: async () => [],
      inspect,
      listSnapshots: async () => [{ header: { id: "snapshot-session" }, revision: "rev-snapshot" }],
    },
  } as unknown as MyMeterCordisContext);

  const refs = await source.list(new AbortController().signal);
  const session = await source.read(refs[0]!, new AbortController().signal);

  expect(refs[0]).toMatchObject({ id: "snapshot-session", revision: "rev-snapshot" });
  expect(queryReadSession).toHaveBeenCalledWith("snapshot-session");
  expect(inspect).not.toHaveBeenCalled();
  expect(session?.events).toEqual([{ type: "step/start", source: "query" }]);
});

test("history recovery treats non-string revisions as uncheckpointed", async () => {
  const inspect = vi.fn(async (sessionId: string) => ({
    meta: { id: sessionId },
    events: [{ type: "step/start" }],
  }));
  const save = vi.fn();
  const statuses: HistoryRecoveryStatus[] = [];
  const recovery = createHistoryRecovery({
    source: createCordisHistoryRecoverySource({
      sessionPersistence: {
        list: async () => [],
        inspect,
        listSnapshots: async () => [{ header: { id: "opaque-object" }, revision: { cursor: 1 } }],
      },
    } as unknown as MyMeterCordisContext),
    checkpoint: {
      sessionRevisions: { "opaque-object": "rev-old" },
      save,
    },
    target: {
      replayBatch(sessions: readonly HistoryReplaySession[]) {
        return {
          replayedSessions: sessions.length,
          skippedUnchangedSessions: 0,
          eventsSeen: sessions.reduce((total, session) => total + session.events.length, 0),
        };
      },
    },
    onStatus: (status) => statuses.push(status),
  });

  recovery.start();
  await waitFor(() => expect(statuses.at(-1)?.state).toBe("completed"));

  expect(inspect).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenLastCalledWith({});
});

test("history recovery rejects read results whose session id differs from the listed ref", async () => {
  const save = vi.fn();
  const replayBatch = vi.fn();
  const statuses: HistoryRecoveryStatus[] = [];
  const recovery = createHistoryRecovery({
    source: createCordisHistoryRecoverySource({
      sessionPersistence: {
        list: async () => [],
        inspect: async () => ({
          meta: { id: "different-session" },
          events: [{ type: "step/start" }],
        }),
        listSnapshots: async () => [{ header: { id: "listed-session" }, revision: "rev-1" }],
      },
    } as unknown as MyMeterCordisContext),
    checkpoint: {
      sessionRevisions: {},
      save,
    },
    target: {
      replayBatch,
    },
    onStatus: (status) => statuses.push(status),
  });

  recovery.start();
  await waitFor(() => expect(statuses.at(-1)?.state).toBe("completed"));

  expect(replayBatch).not.toHaveBeenCalled();
  expect(save).toHaveBeenLastCalledWith({});
  expect(statuses.at(-1)).toMatchObject({
    failedReads: 1,
    lastError: "listed-session: snapshot id mismatch",
  });
});

test("history recovery does not save checkpoint when replay commit fails", async () => {
  const save = vi.fn();
  const statuses: HistoryRecoveryStatus[] = [];
  const recovery = createHistoryRecovery({
    source: createCordisHistoryRecoverySource({
      sessionPersistence: {
        list: async () => [],
        inspect: async (sessionId: string) => ({
          meta: { id: sessionId },
          events: [{ type: "step/start" }],
        }),
        listSnapshots: async () => [{ header: { id: "commit-fails" }, revision: "rev-1" }],
      },
    } as unknown as MyMeterCordisContext),
    checkpoint: {
      sessionRevisions: {},
      save,
    },
    target: {
      replayBatch() {
        throw new Error("ledger commit failed");
      },
    },
    onStatus: (status) => statuses.push(status),
  });

  recovery.start();
  await waitFor(() => expect(statuses.at(-1)?.state).toBe("failed"));

  expect(save).not.toHaveBeenCalled();
  expect(statuses.at(-1)?.lastError).toBe("ledger commit failed");
});
