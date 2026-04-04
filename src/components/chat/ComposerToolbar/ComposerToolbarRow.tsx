/**
 * ComposerToolbarRow
 *
 * Horizontal row orchestrator for the customizable composer toolbar.
 * Manages the full drag-and-drop reorder lifecycle using a three-phase model:
 *
 * 1. **Drag start** — Snapshots the current item order and pixel-accurate slot
 *    layouts. The dragged item is tracked via `draggingId`.
 *
 * 2. **Drag update (hover)** — Uses leading-edge center-crossing
 *    (`findTargetSlot`) to determine which position the dragged item is
 *    hovering over. A 750 ms dwell timer (`PREVIEW_DWELL_MS`) gates the
 *    visual shift: non-dragged items only animate aside after the user
 *    holds over a target for ≥ 750 ms. Once confirmed, returning to the
 *    same target re-applies offsets instantly (no second dwell).
 *
 * 3. **Drop** — Commits the reorder via `onMoveItem` and computes per-item
 *    settle offsets so every item (dragged and non-dragged) smoothly
 *    animates from its current visual position to its new layout position.
 *
 * Key design decisions:
 * - **Leading-edge crossing**: Uses the right edge when dragging right and
 *   the left edge when dragging left, so the wide message bar can still
 *   push narrow buttons without unreachable center-to-center distances.
 * - **Pixel-accurate slot layouts**: `computeSlotLayouts` measures each
 *   slot's actual width (message bar gets remaining flex space; buttons
 *   get `TOOLBAR_BUTTON_SIZE`), preventing off-by-one slot jumps.
 * - **Settle offsets for all items**: On drop, both the dragged item and
 *   displaced items receive offsets that bridge the gap between their
 *   old visual position and new layout position, eliminating teleport.
 *
 * Architecture mirrors the profile WidgetBoard (WidgetWrapper / useBoardState):
 * - Frozen-origin + gesture translateX for the dragged item
 * - Reanimated spring-driven preview offsets for passive items
 * - Snapshot-based drag state (no stale closures)
 *
 * @module components/chat/ComposerToolbar/ComposerToolbarRow
 */

import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";

import { Spacing } from "@/constants/theme";

import { ComposerToolbarItem } from "./ComposerToolbarItem";
import { getToolbarItemDefinition } from "./ComposerToolbarRegistry";
import type { ComposerToolbarItemId } from "./types";
import { TOOLBAR_BUTTON_SIZE } from "./types";

// =============================================================================
// Constants
// =============================================================================

/** How long (ms) the user must hover over a target before items visually shift aside. */
const PREVIEW_DWELL_MS = 750;

// =============================================================================
// Slot Layout
// =============================================================================

interface SlotLayout {
  left: number;
  width: number;
  center: number;
}

/**
 * Compute pixel-accurate left/width/center for each slot in a toolbar layout.
 *
 * The message bar receives all remaining horizontal space after fixed-width
 * buttons and inter-item gaps are subtracted. All other items use
 * `TOOLBAR_BUTTON_SIZE` (40 px). Gap between items is `Spacing.sm` (8 px).
 *
 * @param items  - Ordered toolbar items (only `id` is inspected).
 * @param rowWidth - Measured width of the containing row in pixels.
 * @returns Array of `SlotLayout` objects parallel to `items`.
 */
function computeSlotLayouts(
  items: { id: ComposerToolbarItemId; flexWeight?: number }[],
  rowWidth: number,
): SlotLayout[] {
  if (rowWidth === 0) return [];

  const numButtons = items.filter((i) => i.id !== "message-bar").length;
  const hasMessageBar = items.some((i) => i.id === "message-bar");
  const totalGaps = Math.max(0, items.length - 1) * Spacing.sm;
  const messageBarWidth = hasMessageBar
    ? rowWidth - numButtons * TOOLBAR_BUTTON_SIZE - totalGaps
    : 0;

  const layouts: SlotLayout[] = [];
  let x = 0;
  for (const item of items) {
    const w = item.id === "message-bar" ? messageBarWidth : TOOLBAR_BUTTON_SIZE;
    layouts.push({ left: x, width: w, center: x + w / 2 });
    x += w + Spacing.sm;
  }
  return layouts;
}

/**
 * Determine which position the dragged item is hovering over.
 *
 * Uses the **leading edge** of the dragged item (right edge when moving
 * right, left edge when moving left) and counts how many non-dragged
 * items have their center to the left of that reference point.
 *
 * This approach lets wide items (message bar) cross narrow ones without
 * requiring impractical center-to-center travel. For narrow buttons, the
 * difference vs. pure center-crossing is only ~20 px and feels natural.
 *
 * The message bar's "50 % rule" — requiring the dragged item to cross
 * past the bar's midpoint before it counts — is a natural consequence:
 * the bar's center is far from its edges, so only deep crossings register.
 *
 * @param dragIdx      - Index of the dragged item in the snapshotted layout.
 * @param translationX - Gesture translation in pixels from drag start.
 * @param layouts      - Snapshotted `SlotLayout[]` captured at drag start.
 * @returns Target position index (0-based, clamped to valid range).
 */
function findTargetSlot(
  dragIdx: number,
  translationX: number,
  layouts: SlotLayout[],
): number {
  if (layouts.length === 0) return dragIdx;

  // Use the leading edge of the dragged item:
  // dragging right → right edge, dragging left → left edge.
  // This allows wide items (message bar) to cross narrow items
  // without needing to drag the full center-to-center distance.
  const dragLayout = layouts[dragIdx];
  const dragLeft = dragLayout.left + translationX;
  const dragRight = dragLeft + dragLayout.width;
  const dragRef = translationX >= 0 ? dragRight : dragLeft;

  let count = 0;
  for (let i = 0; i < layouts.length; i++) {
    if (i === dragIdx) continue;
    if (layouts[i].center < dragRef) count++;
  }

  return Math.max(0, Math.min(count, layouts.length - 1));
}

// =============================================================================
// Types
// =============================================================================

export interface ComposerToolbarRowProps {
  /** Ordered list of toolbar item IDs to render. */
  items: { id: ComposerToolbarItemId; position: number; flexWeight?: number }[];
  /** Whether the toolbar is in edit mode. */
  isEditing: boolean;
  /** Called when an item is moved to a new position. */
  onMoveItem?: (itemId: ComposerToolbarItemId, toPosition: number) => void;
  /** Called when an item is removed. */
  onRemoveItem?: (itemId: ComposerToolbarItemId) => void;
  /** Called when long-press triggers edit mode entry. */
  onEnterEditMode?: () => void;
  /** Content renderer: maps each toolbar item ID to its React content. */
  renderItem: (itemId: ComposerToolbarItemId) => React.ReactNode;
}

// =============================================================================
// Component
// =============================================================================

function ComposerToolbarRowBase({
  items,
  isEditing,
  onMoveItem,
  onRemoveItem,
  onEnterEditMode,
  renderItem,
}: ComposerToolbarRowProps) {
  const [rowWidth, setRowWidth] = useState(0);
  const [draggingId, setDraggingId] = useState<ComposerToolbarItemId | null>(
    null,
  );

  // Drag state refs (stable across renders, no stale closure issues)
  const dragStartIdxRef = useRef<number>(-1);
  const latestTargetSlotRef = useRef<number>(-1);

  // Preview dwell timer refs
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTargetSlotRef = useRef<number>(-1);
  const confirmedSlotRef = useRef<number>(-1);

  // Snapshot of items at drag start — stable reference for all drag callbacks
  const dragItemsSnapshotRef = useRef<
    { id: ComposerToolbarItemId; position: number; flexWeight?: number }[]
  >([]);

  // Snapshot of slot layouts at drag start
  const dragSlotLayoutsRef = useRef<SlotLayout[]>([]);

  // Preview offsets: { [itemId]: pixelOffset } — updated during drag
  // to show non-dragged items sliding aside
  const [previewOffsets, setPreviewOffsets] = useState<Record<string, number>>(
    {},
  );

  // Settle offsets for all items on drop — enables smooth animation to new positions
  const [settleOffsets, setSettleOffsets] = useState<Record<string, number>>(
    {},
  );

  // Measure row width for slot calculations
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setRowWidth(e.nativeEvent.layout.width);
  }, []);

  // Calculate slot width for non-flex items
  const slotWidth = useMemo(() => {
    if (rowWidth === 0) return TOOLBAR_BUTTON_SIZE;
    if (!items.some((i) => i.id === "message-bar")) {
      const gaps = (items.length - 1) * Spacing.sm;
      return Math.floor((rowWidth - gaps) / items.length);
    }
    return TOOLBAR_BUTTON_SIZE;
  }, [rowWidth, items]);

  // ── Slot Layouts (actual pixel positions for each item) ───────────────

  const slotLayouts = useMemo(
    () => computeSlotLayouts(items, rowWidth),
    [rowWidth, items],
  );

  // Keep a ref for stable callback access
  const slotLayoutsRef = useRef<SlotLayout[]>([]);
  slotLayoutsRef.current = slotLayouts;

  // ── Preview Offset Calculator ─────────────────────────────────────────

  /**
   * Compute pixel offsets for all non-dragged items so they visually
   * "make room" for the dragged item at `targetSlot`.
   *
   * Items between the drag origin and target shift by one slot-width
   * in the appropriate direction (left if dragging right, right if left).
   * The shift amount equals the **dragged item's** actual width + gap,
   * so dragging the wide message bar leaves a correctly-sized hole.
   *
   * @param dragIdx    - Original index of the dragged item.
   * @param targetSlot - The slot the dragged item is hovering over.
   * @returns Map of `{ [itemId]: pixelOffset }` for each non-dragged item.
   */
  const computePreviewOffsets = useCallback(
    (dragIdx: number, targetSlot: number): Record<string, number> => {
      const snapshot = dragItemsSnapshotRef.current;
      const layouts = dragSlotLayoutsRef.current;
      if (snapshot.length === 0 || layouts.length === 0) return {};

      const offsets: Record<string, number> = {};
      // Shift by the dragged item's actual width + gap
      const shiftAmount =
        (layouts[dragIdx]?.width ?? TOOLBAR_BUTTON_SIZE) + Spacing.sm;

      for (let i = 0; i < snapshot.length; i++) {
        if (i === dragIdx) continue; // dragged item — no offset

        if (dragIdx < targetSlot && i > dragIdx && i <= targetSlot) {
          offsets[snapshot[i].id] = -shiftAmount;
        } else if (dragIdx > targetSlot && i >= targetSlot && i < dragIdx) {
          offsets[snapshot[i].id] = shiftAmount;
        } else {
          offsets[snapshot[i].id] = 0;
        }
      }
      return offsets;
    },
    [],
  );

  // ── Drag Handlers ─────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (itemId: ComposerToolbarItemId) => {
      setDraggingId(itemId);
      const idx = items.findIndex((i) => i.id === itemId);
      dragStartIdxRef.current = idx;
      previewTargetSlotRef.current = idx;
      latestTargetSlotRef.current = idx;
      dragItemsSnapshotRef.current = [...items];
      dragSlotLayoutsRef.current = [...slotLayoutsRef.current];
      setPreviewOffsets({});
      setSettleOffsets({});
      confirmedSlotRef.current = -1;
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    },
    [items],
  );

  const handleDragUpdate = useCallback(
    (itemId: ComposerToolbarItemId, translationX: number) => {
      if (!onMoveItem || dragStartIdxRef.current === -1) return;

      const dragIdx = dragStartIdxRef.current;
      const layouts = dragSlotLayoutsRef.current;

      // Compute target slot using leading-edge center-crossing
      const targetSlot = findTargetSlot(dragIdx, translationX, layouts);

      // Always update latest target for drop fallback
      latestTargetSlotRef.current = targetSlot;

      // If target didn't change, let existing preview timer run
      if (targetSlot === previewTargetSlotRef.current) return;

      // Target changed — update tracking and reset preview timer
      previewTargetSlotRef.current = targetSlot;
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }

      // If back to original position, clear preview offsets
      if (targetSlot === dragIdx) {
        setPreviewOffsets({});
        return;
      }

      // If returning to a previously confirmed target, re-apply immediately
      if (targetSlot === confirmedSlotRef.current) {
        setPreviewOffsets(computePreviewOffsets(dragIdx, targetSlot));
        return;
      }

      // New unconfirmed target — start dwell timer
      previewTimerRef.current = setTimeout(() => {
        if (previewTargetSlotRef.current !== targetSlot) return;
        confirmedSlotRef.current = targetSlot;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPreviewOffsets(computePreviewOffsets(dragIdx, targetSlot));
      }, PREVIEW_DWELL_MS);
    },
    [onMoveItem, computePreviewOffsets],
  );

  const handleDragEnd = useCallback(
    (itemId: ComposerToolbarItemId, translationX: number) => {
      // Clear preview timer
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }

      // Commit: use the latest computed target slot
      const dragIdx = dragStartIdxRef.current;
      const targetSlot = latestTargetSlotRef.current;
      const origLayouts = dragSlotLayoutsRef.current;
      const snapshot = dragItemsSnapshotRef.current;

      if (
        onMoveItem &&
        dragIdx !== -1 &&
        targetSlot !== dragIdx &&
        origLayouts.length > 0 &&
        snapshot.length > 0
      ) {
        // Compute the reordered layout to calculate settle offsets
        const reordered = [...snapshot];
        const [moved] = reordered.splice(dragIdx, 1);
        reordered.splice(targetSlot, 0, moved);
        const newLayouts = computeSlotLayouts(reordered, rowWidth);

        // Get current preview offsets for non-dragged items
        const confirmedTarget = confirmedSlotRef.current;
        const currentPreview =
          confirmedTarget !== -1
            ? computePreviewOffsets(dragIdx, confirmedTarget)
            : {};

        // Compute settle offsets for ALL items so each animates smoothly
        // from its current visual position to its new layout position
        const settles: Record<string, number> = {};

        // Dragged item: from visual drag position to new layout position
        const visualDragX = origLayouts[dragIdx].left + translationX;
        const newDragX = newLayouts[targetSlot].left;
        settles[itemId] = visualDragX - newDragX;

        // Non-dragged items: from (old layout + preview offset) to new layout
        for (let i = 0; i < snapshot.length; i++) {
          if (i === dragIdx) continue;
          const id = snapshot[i].id;
          const newIdx = reordered.findIndex((r) => r.id === id);
          if (newIdx === -1) continue;
          const previewOff = currentPreview[id] ?? 0;
          settles[id] =
            origLayouts[i].left + previewOff - newLayouts[newIdx].left;
        }

        setSettleOffsets(settles);
        onMoveItem(itemId, targetSlot);
      } else {
        setSettleOffsets({});
      }

      // Clear all drag state
      setPreviewOffsets({});
      setDraggingId(null);
      dragStartIdxRef.current = -1;
      previewTargetSlotRef.current = -1;
      latestTargetSlotRef.current = -1;
      confirmedSlotRef.current = -1;
      dragItemsSnapshotRef.current = [];
      dragSlotLayoutsRef.current = [];
    },
    [onMoveItem, rowWidth, computePreviewOffsets],
  );

  const handleRemove = useCallback(
    (itemId: ComposerToolbarItemId) => {
      onRemoveItem?.(itemId);
    },
    [onRemoveItem],
  );

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onEnterEditMode?.();
  }, [onEnterEditMode]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <View style={styles.row} onLayout={handleLayout}>
      {items.map((item) => {
        const definition = getToolbarItemDefinition(item.id);
        const canRemove = definition?.canRemove ?? true;
        const isMessageBar = item.id === "message-bar";

        return (
          <ComposerToolbarItem
            key={item.id}
            itemId={item.id}
            position={item.position}
            isEditing={isEditing}
            isDragging={draggingId === item.id}
            canRemove={canRemove}
            isMessageBar={isMessageBar}
            flexWeight={item.flexWeight}
            slotWidth={slotWidth}
            previewOffset={previewOffsets[item.id] ?? 0}
            settleOffset={settleOffsets[item.id]}
            onDragStart={handleDragStart}
            onDragUpdate={handleDragUpdate}
            onDragEnd={handleDragEnd}
            onRemove={canRemove ? handleRemove : undefined}
            onLongPress={handleLongPress}
          >
            {renderItem(item.id)}
          </ComposerToolbarItem>
        );
      })}
    </View>
  );
}

export const ComposerToolbarRow = memo(ComposerToolbarRowBase);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
});
