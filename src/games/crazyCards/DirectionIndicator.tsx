/**
 * DirectionIndicator — Shows current play direction (CW / CCW)
 *
 * Compact animated arrow that rotates when direction changes.
 * Sits near the discard pile to indicate flow of play.
 */

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { CARD_COLORS } from "@/games/crazyCards/CrazyCardsConfig";
import type { DirectionIndicatorProps } from "./CrazyCardsTypes";

// =============================================================================
// DirectionIndicator Component
// =============================================================================

export const DirectionIndicator = React.memo(function DirectionIndicator({
  direction,
}: DirectionIndicatorProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    // CW = 0°, CCW = 180° to flip the arrow
    rotation.value = withSpring(direction === 1 ? 0 : 180, {
      damping: 12,
      stiffness: 120,
    });
  }, [direction, rotation]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.arrowContainer, animStyle]}>
        <Text style={styles.arrow}>⟳</Text>
      </Animated.View>
      <Text style={styles.label}>{direction === 1 ? "CW" : "CCW"}</Text>
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  arrowContainer: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  arrow: {
    fontSize: 22,
    color: CARD_COLORS.green,
  },
  label: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 2,
  },
});

export default DirectionIndicator;
