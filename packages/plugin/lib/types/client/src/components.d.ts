import type { MyMeterUpdateController } from "./update-controller";
import { type MyMeterStore, type MyMeterStoreState } from "./store";
export declare function useMyMeterStoreState(store: MyMeterStore): MyMeterStoreState;
export declare function CompactMeter({ store, onOpenTokenBilling, }: {
    store: MyMeterStore;
    onOpenTokenBilling?: () => void;
}): import("react").JSX.Element;
export declare function GlobalSessionList({ store, showViewTabs, }: {
    store: MyMeterStore;
    showViewTabs?: boolean | undefined;
}): import("react").JSX.Element;
export declare function SessionDetailPanel({ store, showNavigation }: {
    store: MyMeterStore;
    showNavigation?: boolean;
}): import("react").JSX.Element;
/**
 * Conversation-tab projection for dsh. The tab owns the current session
 * selection and temporarily suppresses the floating overlay while active.
 */
export declare function MyMeterConversationView({ store, sessionId, updateController, showUpdateControl, }: {
    store: MyMeterStore;
    sessionId: string;
    updateController?: MyMeterUpdateController | undefined;
    showUpdateControl?: boolean | undefined;
}): import("react").JSX.Element;
export declare function SettingsPanel({ store, }: {
    store: MyMeterStore;
    onClose?: () => void;
}): import("react").JSX.Element;
export declare function MyMeterSettingsCard({ store }: {
    store: MyMeterStore;
}): import("react").JSX.Element;
