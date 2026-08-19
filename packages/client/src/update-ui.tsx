import { useSyncExternalStore, type CSSProperties } from "react";

import type { DshRestartPhase, MyMeterUpdateController, MyMeterUpdateState } from "./update-controller";

const COLORS = {
  primary: "var(--dsw-alias-label-primary, #111827)",
  secondary: "var(--dsw-alias-label-secondary, #4b5563)",
  tertiary: "var(--dsw-alias-label-tertiary, #6b7280)",
  base: "var(--dsw-alias-bg-base, #ffffff)",
  layer1: "var(--dsw-alias-bg-layer-1, #ffffff)",
  layer2: "var(--dsw-alias-bg-layer-2, #f3f4f6)",
  border1: "var(--dsw-alias-border-l1, #d1d5db)",
  border2: "var(--dsw-alias-border-l2, #e5e7eb)",
  brand: "var(--dsw-alias-brand-primary, #2563eb)",
  danger: "var(--dsw-alias-state-danger-primary, #b91c1c)",
} as const;

export interface MyMeterUpdateControlProps {
  controller: MyMeterUpdateController;
  isLoopback: boolean;
}

export function MyMeterUpdateControl({ controller, isLoopback }: MyMeterUpdateControlProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  if (!isLoopback) return null;

  return (
    <div
      aria-label="MyMeter 更新"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        minWidth: 0,
        flexWrap: "wrap",
      }}
    >
      <UpdateStatusText state={state} />
      <UpdateActions controller={controller} state={state} />
      {state.status === "failed" ? (
        <span role="alert" style={{ color: COLORS.danger, fontSize: 11, overflowWrap: "anywhere" }}>
          {state.error}
        </span>
      ) : null}
      {state.status === "restartRequired" && !state.restartPromptDismissed ? (
        <RestartRequiredDialog state={state} onDismiss={controller.dismissRestartPrompt} />
      ) : null}
    </div>
  );
}

function UpdateActions({ controller, state }: { controller: MyMeterUpdateController; state: MyMeterUpdateState }) {
  if (state.status === "updateAvailable") {
    return (
      <button type="button" onClick={() => void controller.install()} style={primaryButtonStyle}>
        更新插件
      </button>
    );
  }

  if (state.status === "restartRequired") return null;

  const disabled = state.status === "checking" || state.status === "installing";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void controller.check()}
      style={{
        ...secondaryButtonStyle,
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.72 : 1,
      }}
    >
      {state.status === "checking" ? "检查中..." : state.status === "installing" ? "安装中..." : "检查更新"}
    </button>
  );
}

function UpdateStatusText({ state }: { state: MyMeterUpdateState }) {
  const label = statusLabel(state);
  if (!label) return null;

  return (
    <span style={{ color: statusColor(state), fontSize: 11, fontWeight: 600, overflowWrap: "anywhere" }}>
      {label}
    </span>
  );
}

function RestartRequiredDialog({
  state,
  onDismiss,
}: {
  state: Extract<MyMeterUpdateState, { status: "restartRequired" }>;
  onDismiss: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="mymeter-update-dialog-title"
      style={{
        position: "fixed",
        inset: "auto 16px 16px auto",
        width: "min(360px, calc(100vw - 32px))",
        display: "grid",
        gap: 8,
        padding: 14,
        color: COLORS.primary,
        background: COLORS.layer1,
        border: `1px solid ${COLORS.border1}`,
        borderRadius: 8,
        boxShadow: "0 12px 30px color-mix(in srgb, var(--dsw-alias-label-primary, #111827) 18%, transparent)",
        zIndex: 2_147_483_647,
      }}
    >
      <strong id="mymeter-update-dialog-title" style={{ fontSize: 13 }}>
        MyMeter v{state.installedVersion} 已安装
      </strong>
      <span style={{ color: COLORS.secondary, fontSize: 12, lineHeight: 1.5 }}>
        需要重启 dsh 才能使用新版本。请回到运行 dsh 的终端手动重启，重启后本页会自动恢复。
      </span>
      <span style={{ color: COLORS.tertiary, fontSize: 11 }}>{restartPhaseLabel(state.restartPhase)}</span>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={onDismiss} style={secondaryButtonStyle}>
          知道了
        </button>
      </div>
    </div>
  );
}

function statusLabel(state: MyMeterUpdateState): string | null {
  switch (state.status) {
    case "idle":
    case "checking":
      return null;
    case "upToDate":
      return `当前已是最新版 v${state.currentVersion}`;
    case "updateAvailable":
      return `发现 MyMeter v${state.latestVersion}`;
    case "installing":
      return `正在安装 v${state.latestVersion}`;
    case "restartRequired":
      return `v${state.installedVersion} 已安装，等待重启`;
    case "failed":
      return `${operationLabel(state.operation)}失败`;
  }
}

function statusColor(state: MyMeterUpdateState): string {
  if (state.status === "failed") return COLORS.danger;
  if (state.status === "updateAvailable") return COLORS.brand;
  return COLORS.secondary;
}

function operationLabel(operation: MyMeterUpdateState extends infer S
  ? S extends { status: "failed"; operation: infer O }
    ? O
    : never
  : never): string {
  if (operation === "install") return "安装";
  if (operation === "restart-watch") return "等待重启";
  return "检查更新";
}

function restartPhaseLabel(phase: DshRestartPhase): string {
  if (phase === "offlineObserved") return "已检测到 dsh 离线，正在等待恢复。";
  if (phase === "recovered") return "dsh 已恢复，正在刷新页面。";
  return "正在等待 dsh 重启。";
}

const baseButtonStyle = {
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
} satisfies CSSProperties;

const secondaryButtonStyle = {
  ...baseButtonStyle,
  color: COLORS.brand,
  background: COLORS.base,
  border: `1px solid ${COLORS.border1}`,
  cursor: "pointer",
} satisfies CSSProperties;

const primaryButtonStyle = {
  ...baseButtonStyle,
  color: "#ffffff",
  background: COLORS.brand,
  border: `1px solid ${COLORS.brand}`,
  cursor: "pointer",
} satisfies CSSProperties;
