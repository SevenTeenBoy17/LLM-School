"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { cn } from "@/lib/utils";

type ResizeEdge = "start" | "end";

type PersistentPanelWidthOptions = {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
};

const panelWidthMemory = new Map<string, number>();
const PANEL_WIDTH_EVENT = "eduai:panel-width-change";

function clampPanelWidth(value: number, minWidth: number, maxWidth: number) {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(value)));
}

function readPanelWidth({ storageKey, defaultWidth, minWidth, maxWidth }: PersistentPanelWidthOptions) {
  const memoryValue = panelWidthMemory.get(storageKey);
  if (Number.isFinite(memoryValue)) {
    return clampPanelWidth(memoryValue as number, minWidth, maxWidth);
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    const stored = rawValue === null ? Number.NaN : Number(rawValue);
    if (Number.isFinite(stored)) {
      const width = clampPanelWidth(stored, minWidth, maxWidth);
      panelWidthMemory.set(storageKey, width);
      return width;
    }
  } catch {
    // 受限浏览器中保持当前页面内存态。
  }

  return clampPanelWidth(defaultWidth, minWidth, maxWidth);
}

function announcePanelWidth(storageKey: string) {
  window.dispatchEvent(new CustomEvent(PANEL_WIDTH_EVENT, { detail: { storageKey } }));
}

function persistPanelWidth(storageKey: string, width: number) {
  panelWidthMemory.set(storageKey, width);
  try {
    window.localStorage.setItem(storageKey, String(width));
  } catch {
    // 本地存储不可用时，当前页面内的调宽仍然有效。
  }
  announcePanelWidth(storageKey);
}

export function usePersistentPanelWidth(options: PersistentPanelWidthOptions) {
  const { storageKey, defaultWidth, minWidth, maxWidth } = options;
  const subscribe = useCallback((onChange: () => void) => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        panelWidthMemory.delete(storageKey);
        onChange();
      }
    };
    const handleWidthChange = (event: Event) => {
      if ((event as CustomEvent<{ storageKey?: string }>).detail?.storageKey === storageKey) {
        onChange();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(PANEL_WIDTH_EVENT, handleWidthChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(PANEL_WIDTH_EVENT, handleWidthChange);
    };
  }, [storageKey]);
  const getSnapshot = useCallback(
    () => readPanelWidth({ storageKey, defaultWidth, minWidth, maxWidth }),
    [defaultWidth, maxWidth, minWidth, storageKey]
  );
  const width = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => clampPanelWidth(defaultWidth, minWidth, maxWidth)
  );

  const resize = useCallback((nextWidth: number) => {
    const clamped = clampPanelWidth(nextWidth, minWidth, maxWidth);
    panelWidthMemory.set(storageKey, clamped);
    announcePanelWidth(storageKey);
  }, [maxWidth, minWidth, storageKey]);

  const commit = useCallback((nextWidth: number) => {
    const clamped = clampPanelWidth(nextWidth, minWidth, maxWidth);
    persistPanelWidth(storageKey, clamped);
  }, [maxWidth, minWidth, storageKey]);

  const reset = useCallback(() => {
    const clamped = clampPanelWidth(defaultWidth, minWidth, maxWidth);
    persistPanelWidth(storageKey, clamped);
  }, [defaultWidth, maxWidth, minWidth, storageKey]);

  return { width, minWidth, maxWidth, resize, commit, reset };
}

interface PanelResizeHandleProps {
  label: string;
  edge: ResizeEdge;
  width: number;
  minWidth: number;
  maxWidth: number;
  onResize: (width: number) => void;
  onCommit: (width: number) => void;
  onReset: () => void;
  testId?: string;
  className?: string;
}

type DragState = {
  pointerId: number;
  startX: number;
  startWidth: number;
  latestWidth: number;
};

export function PanelResizeHandle({
  label,
  edge,
  width,
  minWidth,
  maxWidth,
  onResize,
  onCommit,
  onReset,
  testId,
  className,
}: PanelResizeHandleProps) {
  const dragRef = useRef<DragState | null>(null);
  const bodyStyleRef = useRef<{ cursor: string; userSelect: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  const nextWidthFromPointer = useCallback((clientX: number, drag: DragState) => {
    const pointerDelta = clientX - drag.startX;
    const widthDelta = edge === "end" ? pointerDelta : -pointerDelta;
    return clampPanelWidth(drag.startWidth + widthDelta, minWidth, maxWidth);
  }, [edge, maxWidth, minWidth]);

  const restoreBody = useCallback(() => {
    if (!bodyStyleRef.current) return;
    document.body.style.cursor = bodyStyleRef.current.cursor;
    document.body.style.userSelect = bodyStyleRef.current.userSelect;
    bodyStyleRef.current = null;
  }, []);

  useEffect(() => restoreBody, [restoreBody]);

  const finishDrag = useCallback((event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
    restoreBody();
    if (commit) onCommit(drag.latestWidth);
    else onResize(drag.startWidth);
  }, [onCommit, onResize, restoreBody]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: width,
      latestWidth: width,
    };
    bodyStyleRef.current = {
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const nextWidth = nextWidthFromPointer(event.clientX, drag);
    drag.latestWidth = nextWidth;
    onResize(nextWidth);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 24 : 8;
    let nextWidth: number | null = null;

    if (event.key === "Home") nextWidth = minWidth;
    if (event.key === "End") nextWidth = maxWidth;
    if (event.key === "ArrowLeft") nextWidth = width + (edge === "start" ? step : -step);
    if (event.key === "ArrowRight") nextWidth = width + (edge === "end" ? step : -step);
    if (nextWidth === null) return;

    event.preventDefault();
    onCommit(clampPanelWidth(nextWidth, minWidth, maxWidth));
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      data-testid={testId}
      data-edge={edge}
      data-resizing={dragging ? "true" : "false"}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={Math.round(width)}
      aria-valuetext={`${Math.round(width)} 像素`}
      title="拖动调整宽度，双击复位"
      className={cn("panel-resize-handle", className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishDrag(event, true)}
      onPointerCancel={(event) => finishDrag(event, false)}
      onDoubleClick={(event) => {
        event.preventDefault();
        onReset();
      }}
      onKeyDown={handleKeyDown}
    >
      <span className="panel-resize-handle__line" aria-hidden="true" />
      <span className="panel-resize-handle__grip" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
