/**
 * DrawDiscardPiles — Center area with draw pile and discard pile
 *
 * Layout: [ Draw Pile ] — [ color ring ] — [ Discard Pile ]
 * - Draw pile: face-down card stack, tappable when canDraw
 * - Discard pile: face-up top card with current color ring
 * - Badge showing deck count and pending draw count
 */

import {
  Canvas,
  Circle,
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import {
  CARD_COLORS,
  CARD_HEIGHT,
  CARD_RADIUS,
  CARD_WIDTH,
} from "@/games/crazyCards/CrazyCardsConfig";
import type { CrazyCardColor } from "@/types/turnBased";
import { CardFace } from "./CardFace";
import type { DrawDiscardPilesProps } from "./CrazyCardsTypes";

// =============================================================================
// Constants
// =============================================================================

const PILE_GAP = 24;
const DECK_BADGE_SIZE = 28;
const COLOR_RING_SIZE = 20;

// =============================================================================
// CurrentColorRing — ring around the discard pile showing active color
// =============================================================================

const CurrentColorRing = React.memo(function CurrentColorRing({
  color,
  size,
}: {
  color: CrazyCardColor;
  size: number;
}) {
  const ringColor = CARD_COLORS[color] ?? CARD_COLORS.wild;
  const r = size / 2;

  return (
    <Canvas style={{ width: size, height: size }}>
      <Circle cx={r} cy={r} r={r} color={ringColor}>
        <Shadow dx={0} dy={0} blur={6} color={ringColor} />
      </Circle>
      <Circle cx={r} cy={r} r={r - 3} color="#121420" />
      <Circle cx={r} cy={r} r={r - 5} color={ringColor} opacity={0.3} />
    </Canvas>
  );
});

// =============================================================================
// DrawPileStack — face-down cards with count badge
// =============================================================================

const DrawPileStack = React.memo(function DrawPileStack({
  deckSize,
  canDraw,
  onDraw,
  pendingDrawCount,
}: {
  deckSize: number;
  canDraw: boolean;
  onDraw: () => void;
  pendingDrawCount: number;
}) {
  const w = CARD_WIDTH;
  const h = CARD_HEIGHT;

  return (
    <TouchableOpacity
      activeOpacity={canDraw ? 0.7 : 1}
      onPress={canDraw ? onDraw : undefined}
      style={styles.pileContainer}
    >
      {/* Stacked card shadows (offset cards beneath) */}
      {deckSize > 2 && (
        <View style={[styles.stackShadow, { top: -3, left: -3 }]}>
          <CardFace card={null} faceDown width={w} height={h} />
        </View>
      )}
      {deckSize > 1 && (
        <View style={[styles.stackShadow, { top: -1.5, left: -1.5 }]}>
          <CardFace card={null} faceDown width={w} height={h} />
        </View>
      )}

      {/* Top card */}
      <CardFace card={null} faceDown width={w} height={h} />

      {/* Deck count badge */}
      <View style={styles.deckBadge}>
        <Text style={styles.deckBadgeText}>{deckSize}</Text>
      </View>

      {/* Pending draw overlay */}
      {pendingDrawCount > 0 && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>+{pendingDrawCount}</Text>
        </View>
      )}

      {/* "DRAW" label */}
      {canDraw && (
        <View style={styles.drawLabel}>
          <Text style={styles.drawLabelText}>DRAW</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// =============================================================================
// Main DrawDiscardPiles Component
// =============================================================================

export const DrawDiscardPiles = React.memo(function DrawDiscardPiles({
  topCard,
  deckSize,
  currentColor,
  canDraw,
  onDraw,
  onPlaySelected,
  isMyTurn = false,
  hasPlayableSelection = false,
  actionInFlight = false,
  pendingDrawCount = 0,
}: DrawDiscardPilesProps) {
  const discardTappable = isMyTurn && hasPlayableSelection && !actionInFlight;

  return (
    <View style={styles.container}>
      {/* Draw pile */}
      <DrawPileStack
        deckSize={deckSize}
        canDraw={canDraw && !actionInFlight}
        onDraw={onDraw}
        pendingDrawCount={pendingDrawCount}
      />

      {/* Color indicator */}
      <View style={styles.colorRingContainer}>
        <CurrentColorRing color={currentColor} size={COLOR_RING_SIZE} />
      </View>

      {/* Discard pile — tappable to confirm play */}
      <TouchableOpacity
        activeOpacity={discardTappable ? 0.7 : 1}
        onPress={discardTappable ? onPlaySelected : undefined}
        style={styles.pileContainer}
      >
        {topCard ? (
          <CardFace card={topCard} renderState="playable" />
        ) : (
          <View
            style={[
              styles.emptyDiscard,
              { width: CARD_WIDTH, height: CARD_HEIGHT },
            ]}
          >
            <Canvas style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
              <RoundedRect
                x={0}
                y={0}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                r={CARD_RADIUS}
                color="rgba(255,255,255,0.05)"
              >
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(CARD_WIDTH, CARD_HEIGHT)}
                  colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"]}
                />
              </RoundedRect>
            </Canvas>
          </View>
        )}

        {/* "PLAY" label when a valid card is selected */}
        {discardTappable && (
          <View style={styles.drawLabel}>
            <Text style={[styles.drawLabelText, { color: "#3DE57A" }]}>
              PLAY
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: PILE_GAP,
    paddingVertical: 12,
  },
  pileContainer: {
    position: "relative",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  stackShadow: {
    position: "absolute",
    opacity: 0.6,
  },
  deckBadge: {
    position: "absolute",
    bottom: -6,
    right: -6,
    width: DECK_BADGE_SIZE,
    height: DECK_BADGE_SIZE,
    borderRadius: DECK_BADGE_SIZE / 2,
    backgroundColor: "#1B1E2B",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  deckBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  pendingBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#FF4D5A",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  drawLabel: {
    position: "absolute",
    bottom: -22,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  drawLabelText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  emptyDiscard: {
    position: "relative",
  },
  colorRingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default DrawDiscardPiles;
