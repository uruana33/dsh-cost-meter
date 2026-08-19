export type RemoteConnectionState = "disconnected" | "connecting" | "connected";

export interface RemoteBalanceSnapshot {
  status: "fresh" | "stale" | "unavailable";
  total: number | null;
  granted?: number | null;
  toppedUp?: number | null;
  fetchedAt?: number;
  expiresAt?: number;
  isExpired?: boolean;
  error?: string;
}

export interface RemoteHostContribution {
  host: {
    listSessions: () => Promise<readonly unknown[]>;
    getSessionDetail: (sessionId: string) => Promise<unknown>;
    getBalance: () => Promise<RemoteBalanceSnapshot>;
    getSettings: () => Promise<unknown>;
    subscribe?: (listener: (event: unknown) => void) => Promise<() => void> | (() => void);
  };
}

export interface RemoteContribution {
  listSessions(): Promise<readonly unknown[]>;
  getSessionDetail(sessionId: string): Promise<unknown>;
  getBalance(): Promise<RemoteBalanceSnapshot>;
  getSettings(): Promise<unknown>;
  onUpdate(listener: (event: unknown) => void): Promise<() => void>;
}

export interface RemoteTransport {
  on(event: string, handler: (event: unknown) => void): () => void;
  close?: () => void | Promise<void>;
}

export interface RemoteFacadeOptions {
  mount: () => Promise<RemoteTransport>;
}

export interface RemoteFacade {
  readonly state: RemoteConnectionState;
  on(event: string, handler: (event: unknown) => void): Promise<() => void>;
  disconnect(): Promise<void>;
}

const SENSITIVE_KEYS = new Set([
  "apikey",
  "authorization",
  "prompt",
  "completion",
  "messages",
  "input",
  "output",
  "content",
  "requestbody",
  "responsebody",
  "accesstoken",
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[_.-]/g, "").toLowerCase();
  return SENSITIVE_KEYS.has(normalized) || normalized.endsWith("apikey") || normalized.endsWith("token");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stripSensitiveFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSensitiveFields(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      continue;
    }

    result[key] = stripSensitiveFields(nested);
  }

  return result as T;
}

function onceCleanup(cleanup: () => void | Promise<void>): () => Promise<void> {
  let done = false;

  return async () => {
    if (done) {
      return;
    }

    done = true;
    await cleanup();
  };
}

export function createClientSafeEvent<T>(event: T): T {
  return stripSensitiveFields(event);
}

export function createMyMeterRemoteContribution({
  host,
}: RemoteHostContribution): RemoteContribution {
  return {
    async listSessions() {
      return stripSensitiveFields(await host.listSessions());
    },
    async getSessionDetail(sessionId: string) {
      return stripSensitiveFields(await host.getSessionDetail(sessionId));
    },
    async getBalance() {
      return host.getBalance();
    },
    async getSettings() {
      return stripSensitiveFields(await host.getSettings());
    },
    async onUpdate(listener: (event: unknown) => void) {
      if (!host.subscribe) {
        return async () => {};
      }

      const cleanup = await host.subscribe((event) => {
        listener(stripSensitiveFields(event));
      });

      return onceCleanup(cleanup);
    },
  };
}

export function createMyMeterRemoteFacade({ mount }: RemoteFacadeOptions): RemoteFacade {
  let transport: RemoteTransport | null = null;
  let transportPromise: Promise<RemoteTransport> | null = null;
  let state: RemoteConnectionState = "disconnected";
  const activeCleanups = new Set<() => Promise<void>>();

  async function ensureTransport(): Promise<RemoteTransport> {
    if (transport) {
      return transport;
    }

    if (!transportPromise) {
      state = "connecting";
      transportPromise = mount()
        .then((nextTransport) => {
          transport = nextTransport;
          state = "connected";
          transportPromise = null;
          return nextTransport;
        })
        .catch((error) => {
          state = "disconnected";
          transportPromise = null;
          throw error;
        });
    }

    return transportPromise;
  }

  async function disconnect(): Promise<void> {
    const cleanups = [...activeCleanups];
    activeCleanups.clear();
    await Promise.all(cleanups.map((cleanup) => cleanup()));

    if (transport?.close) {
      await transport.close();
    }

    transport = null;
    state = "disconnected";
  }

  return {
    get state() {
      return state;
    },
    async on(event: string, handler: (event: unknown) => void) {
      const currentTransport = await ensureTransport();
      const cleanup = onceCleanup(currentTransport.on(event, handler));
      activeCleanups.add(cleanup);

      return async () => {
        activeCleanups.delete(cleanup);
        await cleanup();
      };
    },
    disconnect,
  };
}
