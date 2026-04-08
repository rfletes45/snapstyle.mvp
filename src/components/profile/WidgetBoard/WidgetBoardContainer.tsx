/**
 * Widget Board Container
 *
 * The root component that renders the profile widget board.
 * Manages the grid layout, widget wrappers, customize mode UI,
 * and coordinates between drag gestures, size selector, and gallery.
 *
 * Integrates into OwnProfileScreen by replacing the direct rendering
 * of profile sections with this board.
 *
 * @module components/profile/WidgetBoard/WidgetBoardContainer
 */

import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useMemo, useState } from "react";
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { Spacing } from "@/constants/theme";

import { getWidgetPixelSize } from "./BoardLayoutEngine";
import { WidgetGallery } from "./WidgetGallery";
import { WidgetSizeSelector } from "./WidgetSizeSelector";
import { WidgetWrapper } from "./WidgetWrapper";
import { WIDGET_ADAPTERS, type WidgetAdapterProps } from "./adapters";
import type {
  BoardMode,
  WidgetInstance,
  WidgetSizeKey,
  WidgetTypeId,
} from "./types";
import { CELL_HEIGHT, GRID_GUTTER } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface WidgetBoardContainerProps {
  /** Current board mode. */
  mode: BoardMode;
  /**
   * When true the board is in read-only / viewer mode.
   * Suppresses customize toolbar, widget gallery, size selector,
   * and disables long-press-to-customize on every widget.
   */
  readOnly?: boolean;
  /** All visible widget instances. */
  visibleWidgets: WidgetInstance[];
  /** All widget instances (visible + hidden). */
  allWidgets: WidgetInstance[];
  /** Hidden widgets available for restoration. */
  hiddenWidgets: WidgetInstance[];
  /** Whether a save is in progress. */
  saving: boolean;
  /** Widget-specific data payloads keyed by widgetType. */
  widgetData: Record<string, Record<string, any>>;
  /** The instanceId of the widget currently being dragged (for highlighting). */
  dragActiveId: string | null;
  /** Ref to the parent ScrollView for auto-scrolling during drag. */
  scrollRef?: React.RefObject<ScrollView | null>;
  /** Ref tracking the current scroll offset (updated from onScroll). */
  scrollOffsetRef?: React.RefObject<number>;
  /** Controlled gallery visibility (lifted to parent for overlay toolbar). */
  galleryVisible?: boolean;
  /** Callback to close the gallery. */
  onCloseGallery?: () => void;
  /** Board actions. */
  onMoveWidget: (instanceId: string, x: number, y: number) => boolean;
  onResizeWidget: (instanceId: string, newSize: WidgetSizeKey) => boolean;
  onHideWidget: (instanceId: string) => boolean;
  onRestoreWidget: (instanceId: string) => boolean;
  onAddWidget: (widgetType: WidgetTypeId, size?: WidgetSizeKey) => boolean;
  onDragPreview: (instanceId: string, x: number, y: number) => void;
  onResizePreview: (instanceId: string, newSize: WidgetSizeKey) => void;
  onCommitPreview: () => void;
  onClearPreview: () => void;
  /** Enter customize mode (triggered by long-press on any widget). */
  onEnterCustomize: () => void;
  onDone: () => void;
  onCancel: () => void;
}

// =============================================================================
// Component
// =============================================================================

function WidgetBoardContainerBase({
  mode,
  readOnly = false,
  visibleWidgets,
  allWidgets,
  hiddenWidgets,
  saving,
  widgetData,
  dragActiveId,
  scrollRef,
  scrollOffsetRef,
  galleryVisible: galleryVisibleProp,
  onCloseGallery: onCloseGalleryProp,
  onMoveWidget,
  onResizeWidget,
  onHideWidget,
  onRestoreWidget,
  onAddWidget,
  onDragPreview,
  onResizePreview,
  onCommitPreview,
  onClearPreview,
  onEnterCustomize,
  onDone,
  onCancel,
}: WidgetBoardContainerProps) {
  const isCustomizing = mode === "customize";

  // ── Board Width Measurement ───────────────────────────────────────────

  const [boardWidth, setBoardWidth] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0) setBoardWidth(width);
  }, []);

  // ── Size Selector State ───────────────────────────────────────────────

  const [sizeTarget, setSizeTarget] = useState<WidgetInstance | null>(null);
  const [sizeSheetVisible, setSizeSheetVisible] = useState(false);

  const handleSizeSelect = useCallback(
    (instanceId: string, size: WidgetSizeKey) => {
      onResizeWidget(instanceId, size);
    },
    [onResizeWidget],
  );

  const handleCloseSizeSheet = useCallback(() => {
    setSizeSheetVisible(false);
    setSizeTarget(null);
  }, []);

  // ── Gallery State ─────────────────────────────────────────────────────
  // Use controlled props when available (lifted to parent for overlay toolbar),
  // otherwise fall back to internal state for backwards compatibility.

  const [galleryVisibleInternal, setGalleryVisibleInternal] = useState(false);
  const galleryVisible = galleryVisibleProp ?? galleryVisibleInternal;

  const handleCloseGallery = useCallback(() => {
    if (onCloseGalleryProp) {
      onCloseGalleryProp();
    }
    setGalleryVisibleInternal(false);
  }, [onCloseGalleryProp]);

  // ── Drag Handlers ─────────────────────────────────────────────────────

  const handleDragStart = useCallback((_instanceId: string) => {
    // Drag state is managed inside WidgetWrapper (animated values).
    // No-op here — board-level drag tracking uses dragActiveId from state.
  }, []);

  const handleDragUpdate = useCallback(
    (instanceId: string, gridX: number, gridY: number) => {
      onDragPreview(instanceId, gridX, gridY);
    },
    [onDragPreview],
  );

  const handleDragEnd = useCallback(
    (_instanceId: string) => {
      onCommitPreview();
    },
    [onCommitPreview],
  );

  const handleDragCancel = useCallback(
    (_instanceId: string) => {
      onClearPreview();
    },
    [onClearPreview],
  );

  // ── Resize Handlers ──────────────────────────────────────────────────

  const handleResizeUpdate = useCallback(
    (instanceId: string, newSize: WidgetSizeKey) => {
      onResizePreview(instanceId, newSize);
    },
    [onResizePreview],
  );

  const handleResizeEnd = useCallback(
    (_instanceId: string) => {
      onCommitPreview();
    },
    [onCommitPreview],
  );

  // ── Remove Handler ────────────────────────────────────────────────────

  const handleRemove = useCallback(
    (instanceId: string) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onHideWidget(instanceId);
    },
    [onHideWidget],
  );

  // ── Board Height ──────────────────────────────────────────────────────

  // Extra vertical rows for the board workspace.
  // In customize mode, add generous buffer so widgets can be dragged
  // into lower rows and the board feels like a real workspace.
  // In view mode, keep a tight fit around the content.
  const CUSTOMIZE_EXTRA_ROWS = 6;

  const boardHeight = useMemo(() => {
    if (visibleWidgets.length === 0 || boardWidth === 0) return 0;

    let maxBottom = 0;
    for (const w of visibleWidgets) {
      const size = getWidgetPixelSize(w.size, boardWidth);
      const posY = w.y * (CELL_HEIGHT + GRID_GUTTER);
      const bottom = posY + size.height;
      if (bottom > maxBottom) maxBottom = bottom;
    }

    const contentHeight = maxBottom + GRID_GUTTER;

    if (isCustomizing) {
      // Add buffer rows below the lowest widget for workspace breathing room
      const bufferPx = CUSTOMIZE_EXTRA_ROWS * (CELL_HEIGHT + GRID_GUTTER);
      return contentHeight + bufferPx;
    }

    return contentHeight;
  }, [visibleWidgets, boardWidth, isCustomizing]);

  // ── Render Widgets ────────────────────────────────────────────────────

  const renderedWidgets = useMemo(() => {
    if (boardWidth === 0) return null;

    return visibleWidgets.map((widget) => {
      const Adapter = WIDGET_ADAPTERS[widget.widgetType];
      if (!Adapter) return null;

      const data = widgetData[widget.widgetType] ?? {};
      const adapterProps: WidgetAdapterProps = {
        size: widget.size,
        data,
      };

      return (
        <WidgetWrapper
          key={widget.instanceId}
          widget={widget}
          boardWidth={boardWidth}
          mode={mode}
          readOnly={readOnly}
          isDragActive={dragActiveId === widget.instanceId}
          scrollRef={scrollRef}
          scrollOffsetRef={scrollOffsetRef}
          onDragStart={handleDragStart}
          onDragUpdate={handleDragUpdate}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          onResizeUpdate={handleResizeUpdate}
          onResizeEnd={handleResizeEnd}
          onRemove={handleRemove}
          onEnterCustomize={readOnly ? undefined : onEnterCustomize}
        >
          <Adapter {...adapterProps} />
        </WidgetWrapper>
      );
    });
  }, [
    boardWidth,
    visibleWidgets,
    widgetData,
    mode,
    dragActiveId,
    scrollRef,
    scrollOffsetRef,
    handleDragStart,
    handleDragUpdate,
    handleDragEnd,
    handleDragCancel,
    handleResizeUpdate,
    handleResizeEnd,
    handleRemove,
    onEnterCustomize,
    readOnly,
  ]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Board Surface */}
      <View
        style={[
          styles.board,
          {
            height: boardHeight > 0 ? boardHeight : undefined,
            minHeight: 200,
          },
        ]}
        onLayout={handleLayout}
      >
        {renderedWidgets}
      </View>

      {/* Widget Size Selector — suppressed in readOnly / viewer mode */}
      {!readOnly && (
        <WidgetSizeSelector
          visible={sizeSheetVisible}
          widget={sizeTarget}
          onSelect={handleSizeSelect}
          onClose={handleCloseSizeSheet}
        />
      )}

      {/* Widget Gallery — suppressed in readOnly / viewer mode */}
      {!readOnly && (
        <WidgetGallery
          visible={galleryVisible}
          widgets={allWidgets}
          hiddenWidgets={hiddenWidgets}
          onAddWidget={onAddWidget}
          onRestoreWidget={onRestoreWidget}
          onClose={handleCloseGallery}
        />
      )}
    </GestureHandlerRootView>
  );
}

export const WidgetBoardContainer = memo(WidgetBoardContainerBase);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  root: {
    // No flex: 1 — the board should size to its content, not stretch.
    // Using flex: 1 inside a ScrollView causes an extra white bar.
  },
  board: {
    position: "relative",
    paddingHorizontal: Spacing.sm,
  },
});
