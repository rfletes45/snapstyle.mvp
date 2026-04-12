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

export interface UseGroupedCardLayoutArgs {
  messageId: string;
  cardWidthTracker?: CardWidthTracker;
  groupPrevMessageId?: string;
  groupNextMessageId?: string;
  isGroupStart: boolean;
  isGroupEnd: boolean;
}

/**
 * Determines whether a card's geometry is "settled" — i.e. the card has
 * its own width measured AND all grouped neighbors' widths are known so
 * that corner rounding + snap width won't change on subsequent frames.
 *
 * Solo messages (both group-start AND group-end) only need their own
 * width. Messages with neighbors need those neighbors' snapped widths
 * to be resolved too.
 */
function isGeometrySettled(
  snapshot: CardWidthSnapshot,
  isGroupStart: boolean,
  isGroupEnd: boolean,
): boolean {
  // Own width must be known
  if (snapshot.rawWidth === undefined) return false;

  const isSolo = isGroupStart && isGroupEnd;
  if (isSolo) return true;

  // Non-solo: neighbors whose snapped width we need for rounding
  if (!isGroupStart && snapshot.prevSnappedWidth === undefined) {
    // Has a previous neighbor in the group but its width isn't known yet.
    // However, if prevMessageId is undefined it means we ARE the logical
    // start (no neighbor above in group), so prevSnappedWidth being
    // undefined is expected/correct.
    if (snapshot.prevMessageId !== undefined) return false;
  }
  if (!isGroupEnd && snapshot.nextSnappedWidth === undefined) {
    if (snapshot.nextMessageId !== undefined) return false;
  }
  return true;
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

  React.useEffect(() => {
    if (!cardWidthTracker) {
      setLayoutSnapshot((prev) => ({
        rawWidth: prev.rawWidth,
        snappedWidth: prev.rawWidth,
        prevMessageId: groupPrevMessageId,
        nextMessageId: groupNextMessageId,
      }));
      return;
    }

    cardWidthTracker.setGroupNeighbors(
      messageId,
      groupPrevMessageId,
      groupNextMessageId,
    );
    setLayoutSnapshot(cardWidthTracker.getSnapshot(messageId));
    return cardWidthTracker.subscribe(messageId, setLayoutSnapshot);
  }, [cardWidthTracker, messageId, groupPrevMessageId, groupNextMessageId]);

  const handleCardLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      const width = normalizeGroupedCardWidth(e.nativeEvent.layout.width);

      if (cardWidthTracker) {
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

  // ── Opacity gate ──────────────────────────────────────────────────────
  // Cards that haven't settled their geometry yet render at opacity 0 so
  // the user never sees intermediate corners / widths. Once all required
  // widths are known, opacity flips to 1 on the same frame (thanks to the
  // synchronous first-report path in CardWidthTracker.report()).
  //
  // Cards whose width is already in the cross-instance cache will have
  // rawWidth pre-seeded on mount, so they start settled → opacity 1.
  const isSettled = isGeometrySettled(layoutSnapshot, isGroupStart, isGroupEnd);

  // Once settled, never go back to hidden — this prevents flicker if a
  // neighbor remounts or snap cluster changes slightly.
  const wasSettledRef = React.useRef(isSettled);
  if (isSettled && !wasSettledRef.current) {
    wasSettledRef.current = true;
  }

  const cardOpacity = wasSettledRef.current ? 1 : 0;

  return {
    handleCardLayout,
    groupCardRadius,
    snapMinWidth,
    /** 0 while geometry is settling, 1 once final. Apply to cardWrapper. */
    cardOpacity,
  };
}
