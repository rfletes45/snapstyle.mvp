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

export function useGroupedCardLayout({
  messageId,
  cardWidthTracker,
  groupPrevMessageId,
  groupNextMessageId,
  isGroupStart,
  isGroupEnd,
}: UseGroupedCardLayoutArgs) {
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
  }, [
    cardWidthTracker,
    messageId,
    groupPrevMessageId,
    groupNextMessageId,
  ]);

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

  return {
    handleCardLayout,
    groupCardRadius,
    snapMinWidth,
  };
}
