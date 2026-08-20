import { createElement } from "react";

import {
  createConnectionRpcUpdateService,
  MyMeterConversationView,
  MyMeterSettingsCard,
  ShellOverlay,
  createMyMeterUpdateController,
  type ShellOverlayProps,
} from "../../client/src/index";
import { createMyMeterStore } from "../../client/src/index";
import {
  MYMETER_REMOTE_CONTRIBUTION,
  createMyMeterRemoteFromTypert,
  type MyMeterTypertRemoteRoot,
} from "./typert-remote";

export interface MyMeterCordisClientContext {
  connection: {
    isLoopback: boolean;
    rpc: {
      call(path: string, endpoint: string, payload?: unknown): Promise<unknown>;
    };
  };
  remote: MyMeterTypertRemoteRoot;
  slots: {
    inject(slot: "shell.overlay" | (string & {}), callback: () => (() => void) | Iterable<() => void>): () => void;
    register(options: { name: string; id?: string; key?: string; order?: number; label?: string }, component: unknown): () => void;
  };
  inject(
    services: string[],
    callback: (ctx: MyMeterCordisClientContext) => void | (() => void | Promise<void>) | Promise<void | (() => void | Promise<void>)>,
  ): MyMeterCordisClientFiber;
  effect?<T>(factory: () => (() => void) | void, label?: string): T;
}

export interface MyMeterCordisClientFiber extends PromiseLike<unknown> {
  dispose(): Promise<void>;
}

export const name = "mymeter";
export const inject = ["remote", "connection"] as const;

const TOKEN_BILLING_VIEW_LABEL = "Token计费";

/** Browser-side Cordis entry point. The Host remote descriptor is mounted as `remote.mymeter`. */
export async function apply(ctx: MyMeterCordisClientContext): Promise<() => Promise<void>> {
  const cleanups: Array<() => void | Promise<void>> = [];
  try {
    cleanups.push(await ctx.remote.$mount(MYMETER_REMOTE_CONTRIBUTION));
    const uiFiber = ctx.inject(
      ["slots", "remote", "remote.mymeter", "connection"],
      mountMyMeterUi,
    );
    await uiFiber;
    cleanups.push(() => uiFiber.dispose());
  } catch (error) {
    for (const cleanup of cleanups.reverse()) await cleanup();
    throw error;
  }

  return async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  };
}

async function mountMyMeterUi(ctx: MyMeterCordisClientContext): Promise<() => Promise<void>> {
  const namespace = ctx.remote.mymeter;
  if (!namespace) {
    throw new Error("mymeter: remote.mymeter is unavailable after mounting the Host contribution");
  }

  const remote = await createMyMeterRemoteFromTypert(namespace);
  const store = createMyMeterStore({ remote });
  const updateController = createMyMeterUpdateController({
    service: createConnectionRpcUpdateService(ctx.connection),
  });
  const cleanups: Array<() => void | Promise<void>> = [
    () => remote.dispose(),
    () => store.destroy(),
    () => updateController.dispose(),
    ctx.slots.inject("shell.overlay", () => ctx.slots.register(
      { name: "shell.overlay", id: "mymeter", order: 100 },
      (props: Omit<ShellOverlayProps, "store" | "onOpenTokenBilling">) => createElement(ShellOverlay, {
        store,
        ...props,
        onOpenTokenBilling: () => openTokenBillingView(store),
      }),
    )),
    ctx.slots.inject("settings.plugin.item", () => ctx.slots.register(
      { name: "settings.plugin.item", id: "mymeter", key: "mymeter", order: 30, label: "Token计费" },
      () => createElement(MyMeterSettingsCard, { store }),
    )),
    ctx.slots.inject("conversation.view", () => ctx.slots.register(
      { name: "conversation.view", id: "mymeter", order: 20, label: "Token计费" },
      (props: { sessionId: string }) => createElement(MyMeterConversationView, {
        store,
        sessionId: props.sessionId,
        updateController,
        showUpdateControl: ctx.connection.isLoopback,
      }),
    )),
  ];

  return async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  };
}

function openTokenBillingView(store: ReturnType<typeof createMyMeterStore>): void {
  if (typeof document === "undefined") return;
  const tab = Array.from(document.querySelectorAll<HTMLButtonElement>('button[role="tab"]'))
    .find((button) => button.textContent?.trim() === TOKEN_BILLING_VIEW_LABEL);
  tab?.click();
  queueMicrotask(() => store.setActivePanel("analytics"));
}
