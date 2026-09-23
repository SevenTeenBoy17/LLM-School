"use client";

import { ReactNode, useCallback, useSyncExternalStore } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { PanelResizeHandle, usePersistentPanelWidth } from "@/components/shell/PanelResizeHandle";

const RIGHT_RAIL_PREFERENCE_EVENT = "eduai:right-rail-preference";
const rightRailPreferenceMemory = new Map<string, boolean>();

function subscribeRightRailPreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(RIGHT_RAIL_PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(RIGHT_RAIL_PREFERENCE_EVENT, onChange);
  };
}

function readRightRailPreference(key: string) {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === "collapsed") return true;
    if (stored === "expanded") return false;
  } catch {
    // 受限浏览器中退回当前页面内存态。
  }
  return rightRailPreferenceMemory.get(key) ?? false;
}

function writeRightRailPreference(key: string, collapsed: boolean) {
  rightRailPreferenceMemory.set(key, collapsed);
  try {
    window.localStorage.setItem(key, collapsed ? "collapsed" : "expanded");
  } catch {
    // 本地存储不可用时，当前页面仍可正常折叠和恢复。
  }
  window.dispatchEvent(new Event(RIGHT_RAIL_PREFERENCE_EVENT));
}

interface RightRailProps {
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  preferenceKey?: string;
  panelId?: string;
  label?: string;
  compactContent?: ReactNode;
  resizable?: boolean;
}

export function RightRail({
  children,
  className,
  collapsible = false,
  preferenceKey = "eduai.right-rail.v1.default",
  panelId = "right-context-rail",
  label = "右侧信息面板",
  compactContent,
  resizable,
}: RightRailProps) {
  const readPreference = useCallback(
    () => readRightRailPreference(preferenceKey),
    [preferenceKey]
  );
  const collapsed = useSyncExternalStore(
    subscribeRightRailPreference,
    readPreference,
    () => false
  );
  const setCollapsed = useCallback(
    (value: boolean) => writeRightRailPreference(preferenceKey, value),
    [preferenceKey]
  );
  const isCollapsed = collapsible && collapsed;
  const isResizable = resizable ?? collapsible;
  const panelWidth = usePersistentPanelWidth({
    storageKey: `${preferenceKey}.width`,
    defaultWidth: 320,
    minWidth: 272,
    maxWidth: 440,
  });
  const contentId = `${panelId}-content`;

  return (
    <aside
      id={panelId}
      data-testid={collapsible ? "chat-context-rail" : undefined}
      data-collapsed={isCollapsed ? "true" : "false"}
      aria-label={isCollapsed ? `${label}图标坞` : label}
      style={{
        width: isCollapsed ? 64 : panelWidth.width,
        flexBasis: isCollapsed ? 64 : panelWidth.width,
      }}
      className={cn(
        "relative hidden shrink-0 border-l border-[var(--border-2)] bg-[var(--rail-bg)] backdrop-blur-sm xl:flex",
        isCollapsed ? "flex-col items-center p-2.5" : "flex-col gap-4 p-5",
        className
      )}
    >
      {isResizable && !isCollapsed && (
        <PanelResizeHandle
          testId="chat-context-rail-resize-handle"
          label={`调整${label}宽度`}
          edge="start"
          width={panelWidth.width}
          minWidth={panelWidth.minWidth}
          maxWidth={panelWidth.maxWidth}
          onResize={panelWidth.resize}
          onCommit={panelWidth.commit}
          onReset={panelWidth.reset}
        />
      )}
      {collapsible && (
        <button
          type="button"
          data-testid="chat-context-rail-toggle"
          onClick={() => setCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? `展开${label}` : `收起${label}为图标坞`}
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          title={isCollapsed ? `展开${label}` : `收起${label}`}
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[var(--border-2)] bg-[var(--rg-control-bg)] text-[var(--text-2)] shadow-[0_3px_10px_rgba(56,76,110,0.08)] transition-colors hover:bg-[var(--rg-control-hover)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-focus)]",
            !isCollapsed && "absolute right-3 top-3 z-10"
          )}
        >
          {isCollapsed ? <PanelRightOpen size={18} aria-hidden /> : <PanelRightClose size={18} aria-hidden />}
        </button>
      )}
      {isCollapsed && compactContent && (
        <div className="mt-4 flex flex-col items-center gap-3" aria-hidden="true">
          {compactContent}
        </div>
      )}
      <div
        id={contentId}
        hidden={isCollapsed}
        aria-hidden={isCollapsed}
        className={cn("min-w-0 space-y-4", collapsible && "pt-9")}
      >
        {children}
      </div>
    </aside>
  );
}

interface RailSectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function RailSection({ title, children, action }: RailSectionProps) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">{title}</h4>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
