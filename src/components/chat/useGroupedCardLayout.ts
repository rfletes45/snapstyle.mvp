import React from "react";
import type { LayoutChangeEvent } from "react-native";

import type {
  CardWidthSnapshot,
  CardWidthTracker,
} from "@/components/chat/CardWidthTracker";
import {
  buildGroupedCardRadii,
  getGroupedCardMinWidth,
  normalizeGroupedCardWidth,
} from "@/components/chat/groupedCardLayout";

const EMPTY_CARD_SNAPSHOT: CardWidthSnapshot = Object.freeze({});

/**
 * Shallow-compare the subset of CardWidthSnapshot fields that drive visual
 * output (border radii + snap min-width).  Neighbor message IDs are ignored
 * because they only affect tracker graph structure, not render output.
 */
function snapshotWidthsEqual(
  a: CardWidthSnapshot,
  b: CardWidthSnapshot,
): boolean {
  return (
    a.rawWidth === b.rawWidth &&
    a.snappedWidth === b.snappedWidth &&
    a.prevSnappedWidth === b.prevSnappedWidth &&
    a.nextSnappedWidth === b.nextSnappedWidth
  );
}

export interface UseGroupedCardLayoutArgs {
  messageId: string;
  cardWidthTracker?: CardWidthTracker;
  groupPrevMessageId?: string;
  groupNextMessageId?: string;
  isGroupStart: boolean;
  isGroupEnd: boolean;
}

export function useGroupedCardLayout({
  messageId,
  cardWidthTracker,
  groupPrevMessageId,
  groupNextMessageId,
  isGroupStart,
  isGroupEnd,
}: UseGroupedCardLayoutArgs) {
  // ── Initial snapshot: pre-seed from tracker (which reads width cache) ──
  const [layoutSnapshot, setLayoutSnapshot] = React.useState<CardWidthSnapshot>(
    () => cardWidthTracker?.getSnapshot(messageId) ?? EMPTY_CARD_SNAPSHOT,
  );

  // DEV: log first-mount width source for diagnosing cold-row estimation
  if (__DEV__) {
    const mountRef = React.useRef(true);
    if (mountRef.current) {
      mountRef.current = false;
      const src =
        layoutSnapshot.rawWidth == null
          ? "none"
          : cardWidthTracker?.isEstimated(messageId)
            ? "estimated"
            : "cached";
      if (src !== "cached") {
        // Only log non-cached (interesting) cases to reduce noise
        console.debug(
          `[GroupedCard] mount ${messageId.slice(0, 8)} width-src=${src}`,
        );
      }
    }
  }

  // Stable setter that skips state updates when visual-relevant width fields
  // are unchanged, preventing cascading re-renders from group-wide tracker
  // notifications where THIS message's snapshot data didn't actually change.
  const stableSetSnapshot = React.useCallback((next: CardWidthSnapshot) => {
    setLayoutSnapshot((prev) =>
      snapshotWidthsEqual(prev, next) ? prev : next,
    );
  }, []);

  // ── useLayoutEffect: runs BEFORE first paint ──────────────────────────
  // Registering neighbors and reading the snapshot before paint ensures the
  // very first visible frame reflects any cached neighbor widths (warm-cache
  // conversations) instead of rendering with EMPTY_CARD_SNAPSHOT and then
  // visibly correcting on the next frame.
  //
  // The stableSetSnapshot comparison prevents a re-render when the snapshot
  // data is identical (common for cold-cache rows where all widths are
  // undefined in both the initial state and the post-setGroupNeighbors
  // snapshot).
  React.useLayoutEffect(() => {
    if (!cardWidthTracker) {
      setLayoutSnapshot((prev) => {
        const next: CardWidthSnapshot = {
          rawWidth: prev.rawWidth,
          snappedWidth: prev.rawWidth,
          prevMessageId: groupPrevMessageId,
          nextMessageId: groupNextMessageId,
        };
        return snapshotWidthsEqual(prev, next) ? prev : next;
      });
      return;
    }

    cardWidthTracker.setGroupNeighbors(
      messageId,
      groupPrevMessageId,
      groupNextMessageId,
    );
    stableSetSnapshot(cardWidthTracker.getSnapshot(messageId));
    return cardWidthTracker.subscribe(messageId, stableSetSnapshot);
  }, [
    cardWidthTracker,
    messageId,
    groupPrevMessageId,
    groupNextMessageId,
    stableSetSnapshot,
  ]);

  const handleCardLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      const width = normalizeGroupedCardWidth(e.nativeEvent.layout.width);

      if (cardWidthTracker) {
        if (__DEV__ && cardWidthTracker.isEstimated(messageId)) {
          const prev = cardWidthTracker.getSnapshot(messageId);
          const delta =
            prev.rawWidth != null ? Math.abs(width - prev.rawWidth) : -1;
          if (delta > 2) {
            console.debug(
              `[GroupedCard] refine ${messageId.slice(0, 8)} est=${prev.rawWidth} meas=${width} Δ=${delta}`,
            );
          }
        }
        cardWidthTracker.report(messageId, width);
        return;
      }

      setLayoutSnapshot((prev) => {
        if (prev.rawWidth === width && prev.snappedWidth === width) {
          return prev;
        }

        return {
          ...prev,
          rawWidth: width,
          snappedWidth: width,
        };
      });
    },
    [cardWidthTracker, messageId],
  );

  const groupCardRadius = React.useMemo(
    () =>
      buildGroupedCardRadii({
        isGroupStart,
        isGroupEnd,
        currentWidth: layoutSnapshot.snappedWidth,
        prevWidth: layoutSnapshot.prevSnappedWidth,
        nextWidth: layoutSnapshot.nextSnappedWidth,
      }),
    [
      isGroupEnd,
      isGroupStart,
      layoutSnapshot.nextSnappedWidth,
      layoutSnapshot.prevSnappedWidth,
      layoutSnapshot.snappedWidth,
    ],
  );

  const snapMinWidth = React.useMemo(
    () =>
      getGroupedCardMinWidth(
        layoutSnapshot.rawWidth,
        layoutSnapshot.snappedWidth,
      ),
    [layoutSnapshot.rawWidth, layoutSnapshot.snappedWidth],
  );

  return {
    handleCardLayout,
    groupCardRadius,
    snapMinWidth,
  };
}
