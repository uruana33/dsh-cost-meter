import { type ReactNode } from "react";
import type { ContextBreakdownView, SessionDetailView, SessionStageView } from "./view-model";
export declare function SessionStageTabs({ detail, children, idPrefix, }: {
    detail: SessionDetailView;
    children: (stage: SessionStageView, isHistorical: boolean) => ReactNode;
    idPrefix?: string;
}): ReactNode;
export declare function StageMetadataPanel({ stage }: {
    stage: SessionStageView;
}): ReactNode;
export declare function contextBreakdownRows(contextBreakdown: ContextBreakdownView | null, unavailableLabel?: string): ReactNode;
