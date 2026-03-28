/**
 * Board State Hook
 *
 * Central state management for the widget board. Separates:
 * 1. Persisted layout state (via useBoardPersistence)
 * 2. Derived board layout state (occupancy, compacted positions)
 * 3. Transient interaction state (mode, drag, resize)
 *
 * @module components/profile/WidgetBoard/useBoardState
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addWidget as addWidgetToBoard,
  buildOccupancyMap,
  compactWidgets,
  hideWidget,
  moveWidget,
  resizeWidget,
  resolveConflicts,
  resolveResize,
  restoreWidget,
} from "./BoardLayoutEngine";
import type {
  BoardMode,
  OccupancyCell,
  WidgetInstance,
  WidgetSizeKey,
  WidgetTypeId,
} from "./types";
import {
  useBoardPersistence,
  type UseBoardPersistenceOptions,
} from "./useBoardPersistence";
import { getWidgetDefinition, isValidSize } from "./WidgetRegistry";

// =============================================================================
// Types
// =============================================================================

export interface BoardStateActions {
  /** Enter customize mode. */
  enterCustomize: () => void;
  /** Exit customize mode and persist changes. */
  exitCustomize: () => void;
  /** Cancel customize mode, discarding unsaved changes. */
  cancelCustomize: () => void;
  /** Move a widget to a new grid position. */
  moveWidget: (instanceId: string, x: number, y: number) => boolean;
  /** Resize a widget to a new size key. */
  resizeWidget: (instanceId: string, newSize: WidgetSizeKey) => boolean;
  /** Hide (remove from board) a widget. */
  hideWidget: (instanceId: string) => boolean;
  /** Restore a hidden widget. */
  restoreWidget: (instanceId: string) => boolean;
  /** Add a new widget to the board. */
  addWidget: (widgetType: WidgetTypeId, size?: WidgetSizeKey) => boolean;
  /** Update the drag preview layout (called continuously during drag). */
  updateDragPreview: (instanceId: string, x: number, y: number) => void;
  /** Commit the current preview as working state and clear preview. */
  commitPreview: () => void;
  /** Clear the preview without committing. */
  clearPreview: () => void;
  /** Update the resize preview layout (called during resize drag). */
  updateResizePreview: (instanceId: string, newSize: WidgetSizeKey) => void;
}

export interface BoardState {
  /** Current mode: view or customize. */
  mode: BoardMode;
  /** All widget instances (visible + hidden). */
  widgets: WidgetInstance[];
  /** Only visible widgets, position-sorted. */
  visibleWidgets: WidgetInstance[];
  /** Hidden widgets available for restoration. */
  hiddenWidgets: WidgetInstance[];
  /** Current occupancy map. */
  occupancy: OccupancyCell[];
  /** Whether initial data has loaded. */
  loaded: boolean;
  /** Whether a save operation is in flight. */
  saving: boolean;
  /** The instanceId of the widget currently being dragged, or null. */
  dragActiveId: string | null;
  /** Actions to modify state. */
  actions: BoardStateActions;
}

// =============================================================================
// Hook
// =============================================================================

export function useBoardState(
  userId: string | undefined,
  options?: UseBoardPersistenceOptions,
): BoardState {
  const persistence = useBoardPersistence(userId, options);
  const [mode, setMode] = useState<BoardMode>("view");

  // Working copy of widgets during customize mode
  const [workingWidgets, setWorkingWidgets] = useState<WidgetInstance[] | null>(
    null,
  );
  // Transient preview layout during drag/resize (not persisted until commit)
  const [previewWidgets, setPreviewWidgets] = useState<WidgetInstance[] | null>(
    null,
  );
  // Track which widget is being dragged for rendering purposes
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  // Snapshot before entering customize mode (for cancel/revert)
  const snapshotRef = useRef<WidgetInstance[] | null>(null);
  // Throttle ref for preview updates (~60ms debounce to avoid jitter)
  const previewThrottleRef = useRef<number>(0);
  // ── Dwell-based hover confirmation ────────────────────────────────────
  // Track the current hover target slot so we only reflow the board after
  // the dragged widget has hovered over the same candidate for DWELL_MS.
  const DWELL_MS = 500;
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellTargetRef = useRef<{ id: string; x: number; y: number } | null>(
    null,
  );
  // Store the latest hover target for commit-on-drop (even if dwell hasn't fired)
  const latestHoverRef = useRef<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  // The active widget list: preview > working > persisted
  const activeWidgets = previewWidgets ?? workingWidgets ?? persistence.widgets;

  // Clean up dwell timer on unmount or mode change
  useEffect(() => {
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [mode]);

  // ── Derived State ─────────────────────────────────────────────────────

  const visibleWidgets = useMemo(
    () =>
      activeWidgets
        .filter((w) => w.visible)
        .sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x)),
    [activeWidgets],
  );

  const hiddenWidgets = useMemo(
    () => activeWidgets.filter((w) => !w.visible),
    [activeWidgets],
  );

  const occupancy = useMemo(
    () => buildOccupancyMap(activeWidgets),
    [activeWidgets],
  );

  // ── Actions ───────────────────────────────────────────────────────────

  const enterCustomize = useCallback(() => {
    if (mode === "customize") return; // already in customize mode
    snapshotRef.current = [...persistence.widgets];
    setWorkingWidgets([...persistence.widgets]);
    setMode("customize");
  }, [mode, persistence.widgets]);

  const exitCustomize = useCallback(async () => {
    setPreviewWidgets(null);
    setDragActiveId(null);
    if (workingWidgets) {
      const compacted = compactWidgets(workingWidgets);
      await persistence.save(compacted);
      setWorkingWidgets(null);
    }
    setMode("view");
  }, [workingWidgets, persistence]);

  const cancelCustomize = useCallback(() => {
    setPreviewWidgets(null);
    setDragActiveId(null);
    setWorkingWidgets(null);
    setMode("view");
  }, []);

  const doMoveWidget = useCallback(
    (instanceId: string, x: number, y: number): boolean => {
      if (mode !== "customize" || !workingWidgets) return false;
      // Safety: validate inputs are finite numbers
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      if (x < 0 || y < 0) return false;
      const result = moveWidget(workingWidgets, instanceId, x, y);
      if (!result) return false;
      setWorkingWidgets(result);
      return true;
    },
    [mode, workingWidgets],
  );

  const doResizeWidget = useCallback(
    (instanceId: string, newSize: WidgetSizeKey): boolean => {
      if (mode !== "customize" || !workingWidgets) return false;
      const widget = workingWidgets.find((w) => w.instanceId === instanceId);
      if (!widget) return false;
      if (!isValidSize(widget.widgetType, newSize)) return false;
      const result = resizeWidget(workingWidgets, instanceId, newSize);
      if (!result) return false;
      setWorkingWidgets(result);
      return true;
    },
    [mode, workingWidgets],
  );

  const doHideWidget = useCallback(
    (instanceId: string): boolean => {
      if (mode !== "customize" || !workingWidgets) return false;
      const widget = workingWidgets.find((w) => w.instanceId === instanceId);
      if (!widget) return false;
      // Check registry — non-removable widgets (e.g. profile-header) can't be hidden
      const def = getWidgetDefinition(widget.widgetType);
      if (def && !def.canRemove) return false;
      const result = hideWidget(workingWidgets, instanceId);
      if (!result) return false;
      setWorkingWidgets(result);
      return true;
    },
    [mode, workingWidgets],
  );

  const doRestoreWidget = useCallback(
    (instanceId: string): boolean => {
      if (mode !== "customize" || !workingWidgets) return false;
      const result = restoreWidget(workingWidgets, instanceId);
      if (!result) return false;
      setWorkingWidgets(result);
      return true;
    },
    [mode, workingWidgets],
  );

  const doAddWidget = useCallback(
    (widgetType: WidgetTypeId, size?: WidgetSizeKey): boolean => {
      if (mode !== "customize" || !workingWidgets) return false;
      const def = getWidgetDefinition(widgetType);
      if (!def) return false;
      const resolvedSize = size ?? def.defaultSize;
      const result = addWidgetToBoard(workingWidgets, widgetType, resolvedSize);
      setWorkingWidgets(result);
      return true;
    },
    [mode, workingWidgets],
  );

  // ── Preview Actions (live reflow during drag/resize) ──────────────────

  const updateDragPreview = useCallback(
    (instanceId: string, x: number, y: number) => {
      if (mode !== "customize" || !workingWidgets) return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      // Throttle: skip if called within 50ms of last update
      const now = Date.now();
      if (now - previewThrottleRef.current < 50) return;
      previewThrottleRef.current = now;

      setDragActiveId(instanceId);

      const clampedX = Math.max(0, x);
      const clampedY = Math.max(0, y);

      // Always store the latest hover target for commit-on-drop
      latestHoverRef.current = { id: instanceId, x: clampedX, y: clampedY };

      // Check whether the hover target changed
      const prev = dwellTargetRef.current;
      const targetChanged =
        !prev ||
        prev.id !== instanceId ||
        prev.x !== clampedX ||
        prev.y !== clampedY;

      if (targetChanged) {
        // New candidate target — reset the dwell timer
        if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
        dwellTargetRef.current = { id: instanceId, x: clampedX, y: clampedY };

        // Start dwell timer — reflow will fire after DWELL_MS of stability
        dwellTimerRef.current = setTimeout(() => {
          // Guard: only fire if still in customize mode with working widgets
          // and the target hasn't changed since the timer was set
          const current = dwellTargetRef.current;
          if (
            !current ||
            current.id !== instanceId ||
            current.x !== clampedX ||
            current.y !== clampedY
          ) {
            return;
          }
          const result = resolveConflicts(
            workingWidgets,
            instanceId,
            clampedX,
            clampedY,
          );
          if (result) {
            setPreviewWidgets(result);
          }
        }, DWELL_MS);
      }
      // If target hasn't changed, do nothing — wait for the existing timer
    },
    [mode, workingWidgets],
  );

  const updateResizePreview = useCallback(
    (instanceId: string, newSize: WidgetSizeKey) => {
      if (mode !== "customize" || !workingWidgets) return;
      const widget = workingWidgets.find((w) => w.instanceId === instanceId);
      if (!widget) return;
      if (!isValidSize(widget.widgetType, newSize)) return;

      const now = Date.now();
      if (now - previewThrottleRef.current < 50) return;
      previewThrottleRef.current = now;

      setDragActiveId(instanceId);
      const result = resolveResize(workingWidgets, instanceId, newSize);
      if (result) {
        setPreviewWidgets(result);
      }
    },
    [mode, workingWidgets],
  );

  const commitPreview = useCallback(() => {
    // Cancel any pending dwell timer
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    dwellTimerRef.current = null;
    dwellTargetRef.current = null;

    if (previewWidgets) {
      // Dwell-confirmed preview exists — commit it
      setWorkingWidgets(previewWidgets);
    } else if (latestHoverRef.current && workingWidgets) {
      // No dwell-confirmed preview yet — compute final layout at drop position
      const { id, x, y } = latestHoverRef.current;
      const result = resolveConflicts(workingWidgets, id, x, y);
      if (result) {
        setWorkingWidgets(result);
      }
    }
    latestHoverRef.current = null;
    setPreviewWidgets(null);
    setDragActiveId(null);
  }, [previewWidgets, workingWidgets]);

  const clearPreview = useCallback(() => {
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    dwellTimerRef.current = null;
    dwellTargetRef.current = null;
    latestHoverRef.current = null;
    setPreviewWidgets(null);
    setDragActiveId(null);
  }, []);

  // ── Return ────────────────────────────────────────────────────────────

  const actions: BoardStateActions = useMemo(
    () => ({
      enterCustomize,
      exitCustomize,
      cancelCustomize,
      moveWidget: doMoveWidget,
      resizeWidget: doResizeWidget,
      hideWidget: doHideWidget,
      restoreWidget: doRestoreWidget,
      addWidget: doAddWidget,
      updateDragPreview,
      commitPreview,
      clearPreview,
      updateResizePreview,
    }),
    [
      enterCustomize,
      exitCustomize,
      cancelCustomize,
      doMoveWidget,
      doResizeWidget,
      doHideWidget,
      doRestoreWidget,
      doAddWidget,
      updateDragPreview,
      commitPreview,
      clearPreview,
      updateResizePreview,
    ],
  );

  return {
    mode,
    widgets: activeWidgets,
    visibleWidgets,
    hiddenWidgets,
    occupancy,
    loaded: persistence.loaded,
    saving: persistence.saving,
    dragActiveId,
    actions,
  };
}
