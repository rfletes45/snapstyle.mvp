/**
 * UnoCallButton — Pulsing "Call!" button
 *
 * Appears at the start of the player's turn when they have 2 cards
 * and a valid play. Must be pressed BEFORE playing to avoid a +2 penalty.
 * Pulses with a spring animation to draw attention.
 */

import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { UNO_CALL_TIMEOUT_MS } from "@/games/crazyCards/CrazyCardsConfig";
import type { UnoCallButtonProps } from "./CrazyCardsTypes";

// =============================================================================
// Constants
// =============================================================================

const BUTTON_SIZE = 80;
const PULSE_SCALE = 1.08;
const PULSE_DURATION = 400;

// =============================================================================
// UnoCallButton Component
// =============================================================================

export const UnoCallButton = React.memo(function UnoCallButton({
  visible,
  onCall,
  timeoutMs = UNO_CALL_TIMEOUT_MS,
}: UnoCallButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      // Fade in
      opacity.value = withTiming(1, { duration: 200 });
      // Pulse loop
      scale.value = withRepeat(
        withSequence(
          withTiming(PULSE_SCALE, {
            duration: PULSE_DURATION,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, {
            duration: PULSE_DURATION,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(scale);
      scale.value = 1;
      opacity.value = withTiming(0, { duration: 150 });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, scale, opacity, timeoutMs]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onCall}
        style={styles.button}
      >
        <View style={styles.innerRing}>
          <Text style={styles.text}>Call!</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 180,
    right: 20,
    zIndex: 50,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: "#FF4D5A",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#FF4D5A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  innerRing: {
    width: BUTTON_SIZE - 8,
    height: BUTTON_SIZE - 8,
    borderRadius: (BUTTON_SIZE - 8) / 2,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
});

export default UnoCallButton;
