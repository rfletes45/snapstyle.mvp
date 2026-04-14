import React from "react";
import type { LayoutChangeEvent } from "react-native";

import {
  buildGroupedCardRadii,
  normalizeGroupedCardWidth,
} from "@/components/chat/groupedCardLayout";

// ---------------------------------------------------------------------------
// Lightweight corner-width store with subscriber notifications
// ---------------------------------------------------------------------------

/** Callback invoked when any card writes a new width. */
type CornerWidthListener = (changedMessageId: string) => void;

/**
 * Shared width store for corner-only neighbor comparisons.
 *
 * Each mounted card writes its measured natural width here via onLayout.
 * Neighbors subscribe so they re-render when a relevant width changes.
 * No equalization, no minWidth — purely informational for corner shape.
 */
export interface CardCornerWidthStore {
  get(messageId: string): number | undefined;
  set(messageId: string, width: number): void;
  subscribe(listener: CornerWidthListener): () => void;
}

/** Create a new CardCornerWidthStore. */
export function createCardCornerWidthStore(): CardCornerWidthStore {
  const widths = new Map<string, number>();
  const listeners = new Set<CornerWidthListener>();

  return {
    get(messageId: string) {
      return widths.get(messageId);
    },
    set(messageId: string, width: number) {
      const prev = widths.get(messageId);
      if (prev === width) return; // no change, no notification
      widths.set(messageId, width);
      for (const fn of listeners) {
        fn(messageId);
      }
    },
    subscribe(listener: CornerWidthListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseGroupedCardLayoutArgs {
  messageId: string;
  isGroupStart: boolean;
  isGroupEnd: boolean;
  /** Shared width store for corner comparison (created per screen). */
  cornerWidthStore?: CardCornerWidthStore;
  /** Previous neighbor in same group (for corner comparison). */
  groupPrevMessageId?: string;
  /** Next neighbor in same group (for corner comparison). */
  groupNextMessageId?: string;
}

/**
 * Grouped-card layout hook with width-aware right-side corners.
 *
 * Corner radii are determined by:
 * - Left side: pure group-position (flush through run)
 * - Right side: group-position + neighbor width comparison
 *
 * No width adjustment, no snap equalization, no minWidth.
 * Cards always render at their natural content width.
 */
export function useGroupedCardLayout({
  messageId,
  isGroupStart,
  isGroupEnd,
  cornerWidthStore,
  groupPrevMessageId,
  groupNextMessageId,
}: UseGroupedCardLayoutArgs) {
  // Snapshot of own + neighbor widths, kept in a single state to batch updates
  const [widthSnapshot, setWidthSnapshot] = React.useState<{
    own: number | undefined;
    prev: number | undefined;
    next: number | undefined;
  }>(() => ({
    own: cornerWidthStore?.get(messageId),
    prev: groupPrevMessageId
      ? cornerWidthStore?.get(groupPrevMessageId)
      : undefined,
    next: groupNextMessageId
      ? cornerWidthStore?.get(groupNextMessageId)
      : undefined,
  }));

  // Keep neighbor IDs in a ref so the subscription callback sees current values
  const prevIdRef = React.useRef(groupPrevMessageId);
  prevIdRef.current = groupPrevMessageId;
  const nextIdRef = React.useRef(groupNextMessageId);
  nextIdRef.current = groupNextMessageId;

  // Subscribe to width changes so we re-render when a neighbor stores its width
  React.useEffect(() => {
    if (!cornerWidthStore) return;

    const unsubscribe = cornerWidthStore.subscribe((changedId) => {
      const prevId = prevIdRef.current;
      const nextId = nextIdRef.current;

      // Only re-render if the changed ID is a current neighbor
      if (changedId !== prevId && changedId !== nextId) return;

      setWidthSnapshot((prev) => {
        const newPrev = prevId ? cornerWidthStore.get(prevId) : undefined;
        const newNext = nextId ? cornerWidthStore.get(nextId) : undefined;
        // Avoid spurious re-renders if values haven't actually changed
        if (prev.prev === newPrev && prev.next === newNext) return prev;
        return { ...prev, prev: newPrev, next: newNext };
      });
    });

    return unsubscribe;
  }, [cornerWidthStore]);

  // When neighbor IDs change (e.g. new message added to group), re-read widths
  React.useEffect(() => {
    if (!cornerWidthStore) return;
    setWidthSnapshot((prev) => {
      const newPrev = groupPrevMessageId
        ? cornerWidthStore.get(groupPrevMessageId)
        : undefined;
      const newNext = groupNextMessageId
        ? cornerWidthStore.get(groupNextMessageId)
        : undefined;
      if (prev.prev === newPrev && prev.next === newNext) return prev;
      return { ...prev, prev: newPrev, next: newNext };
    });
  }, [cornerWidthStore, groupPrevMessageId, groupNextMessageId]);

  const groupCardRadius = React.useMemo(
    () =>
      buildGroupedCardRadii({
        isGroupStart,
        isGroupEnd,
        currentWidth: widthSnapshot.own,
        prevWidth: widthSnapshot.prev,
        nextWidth: widthSnapshot.next,
      }),
    [isGroupStart, isGroupEnd, widthSnapshot],
  );

  const handleCardLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      const width = normalizeGroupedCardWidth(e.nativeEvent.layout.width);
      if (cornerWidthStore) {
        // Write to shared store — this notifies neighbor subscribers
        cornerWidthStore.set(messageId, width);
      }
      // Update own width in local state
      setWidthSnapshot((prev) => {
        if (prev.own === width) return prev;
        // Also snapshot current neighbor widths while we're here
        const prevId = prevIdRef.current;
        const nextId = nextIdRef.current;
        return {
          own: width,
          prev: prevId ? cornerWidthStore?.get(prevId) : undefined,
          next: nextId ? cornerWidthStore?.get(nextId) : undefined,
        };
      });
    },
    [cornerWidthStore, messageId],
  );

  return {
    groupCardRadius,
    handleCardLayout,
  };
}
