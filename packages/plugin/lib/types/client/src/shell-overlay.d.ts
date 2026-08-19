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
export declare function ShellOverlay({ store, useSessions, onOpenTokenBilling, }: ShellOverlayProps): import("react").JSX.Element | null;
