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
  hideWidget,
  inferCollisionDisplacementHint,
  moveWidget,
  resizeWidget,
  resolveConflicts,
  resolveResize,
  restoreWidget,
} from "./BoardLayoutEngine";
import {
  isSameDragHoverTarget,
  resolveCommittedPreviewLayout,
  type DragHoverTarget,
  type PreviewDescriptor,
} from "./previewCommitUtils";
import type {
  BoardMode,
  DragHoverProbe,
  OccupancyCell,
  WidgetInstance,
  WidgetSizeKey,
  WidgetTypeId,
} from "./types";
import { GRID_COLUMNS, SIZE_PRESETS } from "./types";
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
  updateDragPreview: (
    instanceId: string,
    x: number,
    y: number,
    hoverProbe: DragHoverProbe,
  ) => void;
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
  // Resize preview resolves the engine continuously, so keep a small throttle.
  const resizePreviewThrottleRef = useRef<number>(0);
  const workingWidgetsRef = useRef<WidgetInstance[] | null>(null);
  const previewWidgetsRef = useRef<WidgetInstance[] | null>(null);
  const modeRef = useRef<BoardMode>(mode);
  // ── Drag hover target tracking ─────────────────────────────────────────
  // Track the current hover target slot so reflow runs once per meaningful
  // grid target change instead of once per raw gesture event.
  const hoverTargetRef = useRef<DragHoverTarget | null>(null);
  const previewDescriptorRef = useRef<PreviewDescriptor | null>(null);
  // Store the latest hover target for commit-on-drop.
  const latestHoverRef = useRef<DragHoverTarget | null>(null);

  // The active widget list: preview > working > persisted
  const activeWidgets = previewWidgets ?? workingWidgets ?? persistence.widgets;

  useEffect(() => {
    workingWidgetsRef.current = workingWidgets;
  }, [workingWidgets]);

  useEffect(() => {
    previewWidgetsRef.current = previewWidgets;
  }, [previewWidgets]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const clearTransientPreviewState = useCallback(() => {
    resizePreviewThrottleRef.current = 0;
    hoverTargetRef.current = null;
    latestHoverRef.current = null;
    previewDescriptorRef.current = null;
    setPreviewWidgets(null);
    setDragActiveId(null);
  }, []);

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
    previewDescriptorRef.current = null;
    latestHoverRef.current = null;
    hoverTargetRef.current = null;
    setMode("customize");
  }, [mode, persistence.widgets]);

  const exitCustomize = useCallback(async () => {
    clearTransientPreviewState();
    const sourceWidgets = workingWidgetsRef.current;
    if (sourceWidgets) {
      // Save the exact packed layout the user sees. Drag, resize, add, remove,
      // and migration paths already normalize through the board engine.
      await persistence.save(sourceWidgets);
      setWorkingWidgets(null);
    }
    setMode("view");
  }, [clearTransientPreviewState, persistence]);

  const cancelCustomize = useCallback(() => {
    clearTransientPreviewState();
    setWorkingWidgets(null);
    setMode("view");
  }, [clearTransientPreviewState]);

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
      if (result === workingWidgets) return false; // no change (already placed)
      setWorkingWidgets(result);
      return true;
    },
    [mode, workingWidgets],
  );

  // ── Preview Actions (live reflow during drag/resize) ──────────────────

  const updateDragPreview = useCallback(
    (instanceId: string, x: number, y: number, hoverProbe: DragHoverProbe) => {
      if (modeRef.current !== "customize" || !workingWidgetsRef.current) return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (
        !Number.isFinite(hoverProbe.col) ||
        !Number.isFinite(hoverProbe.row)
      ) {
        return;
      }

      setDragActiveId(instanceId);

      const sourceWidgets = workingWidgetsRef.current;
      if (!sourceWidgets) return;

      const widget = sourceWidgets.find(
        (candidate) => candidate.instanceId === instanceId,
      );
      if (!widget) return;

      const span = SIZE_PRESETS[widget.size];
      const clampedX = Math.max(0, Math.min(x, GRID_COLUMNS - span.w));
      const clampedY = Math.max(0, y);
      const collisionHint = inferCollisionDisplacementHint(
        sourceWidgets,
        instanceId,
        clampedX,
        clampedY,
        hoverProbe,
      );
      const nextTarget: DragHoverTarget = {
        id: instanceId,
        x: clampedX,
        y: clampedY,
        collisionHint,
      };

      // Always store the latest hover target for commit-on-drop
      latestHoverRef.current = nextTarget;

      // Check whether the hover target changed
      const prev = hoverTargetRef.current;
      const targetChanged = !isSameDragHoverTarget(prev, nextTarget);

      if (targetChanged) {
        // New candidate target: resolve once from canonical working layout.
        hoverTargetRef.current = nextTarget;

        if (previewDescriptorRef.current?.kind === "drag") {
          setPreviewWidgets(null);
          previewDescriptorRef.current = null;
        }

        const result = resolveConflicts(
          sourceWidgets,
          instanceId,
          clampedX,
          clampedY,
          nextTarget.collisionHint,
        );
        if (result) {
          previewDescriptorRef.current = {
            kind: "drag",
            target: nextTarget,
          };
          setPreviewWidgets(result);
        } else {
          previewDescriptorRef.current = null;
          setPreviewWidgets(null);
        }
      }
      // If target hasn't changed, do nothing; preview already reflects it.
    },
    [],
  );

  const updateResizePreview = useCallback(
    (instanceId: string, newSize: WidgetSizeKey) => {
      if (modeRef.current !== "customize") return;
      const sourceWidgets = workingWidgetsRef.current;
      if (!sourceWidgets) return;

      const widget = sourceWidgets.find((w) => w.instanceId === instanceId);
      if (!widget) return;
      if (!isValidSize(widget.widgetType, newSize)) return;

      const now = Date.now();
      if (now - resizePreviewThrottleRef.current < 50) return;
      resizePreviewThrottleRef.current = now;

      setDragActiveId(instanceId);
      latestHoverRef.current = null;
      hoverTargetRef.current = null;
      const result = resolveResize(sourceWidgets, instanceId, newSize);
      if (result) {
        previewDescriptorRef.current = {
          kind: "resize",
          instanceId,
          size: newSize,
        };
        setPreviewWidgets(result);
      }
    },
    [],
  );

  const commitPreview = useCallback(() => {
    hoverTargetRef.current = null;

    // Drag preview is always committed from the canonical working layout plus
    // the latest hover target. This prevents stale preview state from being
    // saved after the user moves elsewhere before dropping.
    const committed = resolveCommittedPreviewLayout(
      workingWidgetsRef.current,
      previewDescriptorRef.current,
      previewWidgetsRef.current,
      latestHoverRef.current,
    );

    if (committed) {
      // Commit the normalized packed result. The hover target influences
      // ordering and preferred column, but final rows obey reversed gravity.
      setWorkingWidgets(committed);
    }

    latestHoverRef.current = null;
    previewDescriptorRef.current = null;
    setPreviewWidgets(null);
    setDragActiveId(null);
  }, []);

  const clearPreview = useCallback(() => {
    clearTransientPreviewState();
  }, [clearTransientPreviewState]);

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
