/**
 * CardHand — Horizontal scrollable hand layout for Crazy Cards
 *
 * Features:
 * - Overlapping cards (HAND_OVERLAP)
 * - Selected card lifts vertically (SELECTED_LIFT_Y)
 * - Playable cards glow, non-playable cards dim
 * - Tap to select, tap-again to confirm play
 * - Auto-sorts by color → type → value
 */

import React, { useCallback, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import {
  CARD_HEIGHT,
  CARD_WIDTH,
  HAND_OVERLAP,
  SELECTED_LIFT_Y,
} from "@/games/crazyCards/CrazyCardsConfig";
import { sortHand } from "@/games/crazyCards/CrazyCardsEngine";
import type { CrazyCard } from "@/types/turnBased";
import { CardFace } from "./CardFace";
import type { CardHandProps, CardRenderState } from "./CrazyCardsTypes";

// =============================================================================
// Animated Card Wrapper
// =============================================================================

const AnimatedCardSlot = React.memo(function AnimatedCardSlot({
  card,
  isSelected,
  renderState,
  index,
  totalCards,
  onPress,
}: {
  card: CrazyCard;
  isSelected: boolean;
  renderState: CardRenderState;
  index: number;
  totalCards: number;
  onPress: (card: CrazyCard) => void;
}) {
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    translateY.value = withSpring(isSelected ? SELECTED_LIFT_Y : 0, {
      damping: 15,
      stiffness: 180,
    });
  }, [isSelected, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Last card gets no negative margin
  const marginRight = index < totalCards - 1 ? -HAND_OVERLAP : 0;

  return (
    <Animated.View
      style={[
        styles.cardSlot,
        { marginRight, zIndex: isSelected ? 100 : index },
        animStyle,
      ]}
    >
      <CardFace card={card} renderState={renderState} onPress={onPress} />
    </Animated.View>
  );
});

// =============================================================================
// CardHand Component
// =============================================================================

export const CardHand = React.memo(function CardHand({
  hand,
  selectedCardId,
  playableCardIds,
  isMyTurn,
  onCardSelect,
  onCardPlay,
}: CardHandProps) {
  const scrollRef = useRef<ScrollView>(null);

  const sortedHand = React.useMemo(() => sortHand(hand), [hand]);

  const handleCardPress = useCallback(
    (card: CrazyCard) => {
      if (!isMyTurn) return;

      // Always route through onCardSelect — parent toggles selection
      onCardSelect(card);
    },
    [isMyTurn, onCardSelect],
  );

  const getRenderState = useCallback(
    (card: CrazyCard): CardRenderState => {
      if (!isMyTurn) return "not_playable";
      if (selectedCardId === card.id) return "selected";
      if (playableCardIds.has(card.id)) return "playable";
      return "not_playable";
    },
    [isMyTurn, selectedCardId, playableCardIds],
  );

  // Calculate content width for centering when hand is small
  const contentWidth =
    sortedHand.length > 0
      ? CARD_WIDTH + (sortedHand.length - 1) * (CARD_WIDTH - HAND_OVERLAP)
      : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          contentWidth < CARD_WIDTH * 4 && styles.scrollContentCentered,
        ]}
        bounces={false}
      >
        {sortedHand.map((card, i) => (
          <AnimatedCardSlot
            key={card.id}
            card={card}
            isSelected={selectedCardId === card.id}
            renderState={getRenderState(card)}
            index={i}
            totalCards={sortedHand.length}
            onPress={handleCardPress}
          />
        ))}
      </ScrollView>
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingVertical: 8,
    paddingBottom: 16,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    // Extra bottom padding for selected lift
    paddingTop: Math.abs(SELECTED_LIFT_Y) + 8,
    minHeight: CARD_HEIGHT + Math.abs(SELECTED_LIFT_Y) + 16,
  },
  scrollContentCentered: {
    flex: 1,
    justifyContent: "center",
  },
  cardSlot: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
});

export default CardHand;
