import {
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { CompactMeter, useMyMeterStoreState } from "./components";
import type { MyMeterStore } from "./store";

export interface SessionListSnapshot {
  current?: string;
}

export type UseSessions = <T>(selector: (state: SessionListSnapshot) => T) => T;
export interface ShellOverlayProps {
  store: MyMeterStore;
  /** Injected by dsh's global slot standard kit. Optional for standalone use/tests. */
  useSessions?: UseSessions;
  /** Opens the full Token billing conversation view when the overlay is clicked. */
  onOpenTokenBilling?: () => void;
}

const useEmptySessions: UseSessions = (selector) => selector({});

// The conversation/trajectory/Token计费 tabs end at the top edge of the
// active view area (the divider sits immediately above it). Keep the floating
// window clear of that divider and the right edge of the same content column.
const DEFAULT_TOP_GAP = 50;
const DEFAULT_RIGHT_GAP = 50;
const RECEIPT_OVERLAY_VISUAL_WIDTH = 188;

interface OverlayAnchorBounds {
  right: number;
  top: number;
}

/**
 * The conversation scroll body is the stable box shared by chat, trajectory,
 * and other session tabs. Prefer its host class/data marker over the active
 * view slot, whose contents and dimensions change while sessions switch.
 */
function resolveOverlayAnchor(): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const scrollBody = document.querySelector<HTMLElement>(
    '[class~="wSkVaW_scrollBody"], [data-conversation-scroll]',
  );
  if (scrollBody) return scrollBody;

  // Older hosts may not expose the scroll-body marker. The slot parent is
  // still a useful last-resort anchor until the stable body is mounted.
  const viewSlot = document.querySelector<HTMLElement>('[data-slot="conversation.view"]');
  const viewArea = viewSlot?.parentElement ?? null;

  return viewArea;
}

function readOverlayAnchorBounds(anchor: HTMLElement | null): OverlayAnchorBounds {
  const viewportWidth = typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 1024;
  const displayRect = anchor?.getBoundingClientRect();
  return {
    right: displayRect && displayRect.width > 0 && Number.isFinite(displayRect.right)
      ? displayRect.right
      : viewportWidth,
    top: displayRect && Number.isFinite(displayRect.top) ? displayRect.top : 0,
  };
}

function readOverlayVisualWidth(element: HTMLElement | null): number {
  const width = element?.getBoundingClientRect().width ?? 0;
  if (width > 0 && Number.isFinite(width)) return width;
  return RECEIPT_OVERLAY_VISUAL_WIDTH;
}

function resolveDefaultOverlayPosition(
  bounds: OverlayAnchorBounds,
  visualWidth: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.round(bounds.right - DEFAULT_RIGHT_GAP - visualWidth)),
    y: Math.max(0, Math.round(bounds.top + DEFAULT_TOP_GAP)),
  };
}

export function ShellOverlay({
  store,
  useSessions,
  onOpenTokenBilling,
}: ShellOverlayProps) {
  const selectSessions = useSessions ?? useEmptySessions;
  const currentSessionId = selectSessions((state) => state.current ?? null);
  const state = useMyMeterStoreState(store);
  const hasBillableCurrentSession = !useSessions || (
    currentSessionId !== null && state.remote.details[currentSessionId] !== undefined
  );
  useEffect(() => {
    if (!useSessions) return;
    store.syncCurrentSession(currentSessionId);
  }, [currentSessionId, store, useSessions]);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const userDraggedRef = useRef(false);

  useLayoutEffect(() => {
    if (!hasBillableCurrentSession || !state.settings.overlayEnabled || !state.ui.overlayVisible) return;

    let anchorBounds: OverlayAnchorBounds | null = null;
    let overlayWidth = 0;
    let anchorElement: HTMLElement | null = null;
    let mutationObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const syncPosition = (): void => {
      // Once the user has chosen a position, the coordinate is page-scoped.
      // Session/view changes may resize or replace the anchor, but must not
      // silently move a window the user already placed.
      if (userDraggedRef.current) return;

      const nextAnchor = resolveOverlayAnchor();
      const nextBounds = readOverlayAnchorBounds(nextAnchor);
      const nextWidth = readOverlayVisualWidth(shellRef.current);

      if (anchorBounds === null) {
        store.setOverlayPosition(resolveDefaultOverlayPosition(nextBounds, nextWidth));
      } else {
        const current = store.getState().settings.overlayPosition;
        store.setOverlayPosition({
          x: current.x + nextBounds.right - anchorBounds.right - (nextWidth - overlayWidth),
          y: current.y + nextBounds.top - anchorBounds.top,
        });
      }
      anchorBounds = nextBounds;
      overlayWidth = nextWidth;

      if (nextAnchor !== anchorElement) {
        anchorElement = nextAnchor;
        resizeObserver?.disconnect();
        resizeObserver = null;
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(scheduleSync);
          if (anchorElement) resizeObserver.observe(anchorElement);
          if (shellRef.current) resizeObserver.observe(shellRef.current);
        }
        if (anchorElement) mutationObserver?.disconnect();
      }
    };

    const scheduleSync = (): void => {
      syncPosition();
    };

    const initialAnchor = resolveOverlayAnchor();
    if (!initialAnchor && typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(scheduleSync);
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
    syncPosition();
    window.addEventListener("resize", scheduleSync);

    return () => {
      window.removeEventListener("resize", scheduleSync);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [hasBillableCurrentSession, state.settings.overlayEnabled, state.ui.overlayVisible, store]);

  if (!hasBillableCurrentSession || !state.settings.overlayEnabled || !state.ui.overlayVisible) return null;
  const { viewModel } = state;
  const position = viewModel.overlay.position;

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    event.preventDefault();

    let moved = false;
    const startX = event.clientX ?? 0;
    const startY = event.clientY ?? 0;
    const initialPosX = position.x;
    const initialPosY = position.y;

    const handlePointerMove = (moveEvent: PointerEvent): void => {
      const clientX = moveEvent.clientX ?? startX;
      const clientY = moveEvent.clientY ?? startY;
      const deltaX = clientX - startX;
      const deltaY = clientY - startY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        moved = true;
        userDraggedRef.current = true;
      }

      store.setOverlayPosition({
        x: initialPosX + deltaX,
        y: initialPosY + deltaY,
      });
    };

    const handlePointerUp = (): void => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (!moved) {
        onOpenTokenBilling?.();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div
      ref={shellRef}
      data-testid="mymeter-shell"
      data-slot="shell.overlay"
      data-collapsed="true"
      data-docked-edge={viewModel.overlay.dockedEdge ?? "none"}
      onPointerDown={handlePointerDown}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 2147483000,
        width: "fit-content",
        maxWidth: "calc(100vw - 16px)",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
        borderRadius: 12,
        background: "transparent",
        boxShadow: "none",
        outline: "none",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        color: "var(--dsw-alias-label-primary, #111827)",
        userSelect: "none",
        cursor: "grab",
        touchAction: "none",
      }}
    >
      <button
        type="button"
        aria-label="关闭计费浮窗"
        title="关闭计费浮窗"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => store.setOverlayEnabled(false)}
        style={{
          position: "absolute",
          top: -7,
          right: -7,
          zIndex: 4,
          display: "grid",
          placeItems: "center",
          width: 22,
          height: 22,
          padding: 0,
          border: "1px solid var(--dsw-alias-border-l1, #d1d5db)",
          borderRadius: 6,
          background: "var(--dsw-alias-bg-layer-1, #ffffff)",
          boxShadow: "0 2px 8px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 18%, transparent)",
          color: "var(--dsw-alias-label-secondary, #6b7280)",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        <span aria-hidden="true">&#215;</span>
      </button>
      <div
        data-testid="mymeter-shell-body"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          borderRadius: 12,
          overflow: "visible",
        }}
      >
        <CompactMeter
          store={store}
          {...(onOpenTokenBilling ? { onOpenTokenBilling } : {})}
        />
      </div>
    </div>
  );
}
