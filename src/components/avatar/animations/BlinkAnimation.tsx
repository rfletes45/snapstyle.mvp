/**
 * Blink Animation Component
 *
 * Provides periodic blinking animation for avatar eyes.
 * Uses react-native-reanimated for smooth 60fps animations.
 */

import React, { memo, useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface BlinkAnimationProps {
  /** Whether blinking is enabled */
  enabled: boolean;
  /** Base interval between blinks in ms (default: 4000) */
  blinkInterval?: number;
  /** Random variation to add to interval in ms (default: 2000) */
  intervalVariation?: number;
  /** Duration of the blink in ms (default: 150) */
  blinkDuration?: number;
  /** Children to render (the eyes) */
  children: React.ReactNode;
}

/**
 * Blink Animation Component
 *
 * Wraps eye content and animates eyelid overlay for realistic blinking.
 * The blink occurs at random intervals for a natural look.
 */
function BlinkAnimationBase({
  enabled,
  blinkInterval = 4000,
  intervalVariation = 2000,
  blinkDuration = 150,
  children,
}: BlinkAnimationProps) {
  // Shared value for eyelid position (0 = open, 1 = closed)
  const eyelidPosition = useSharedValue(0);

  // Function to trigger a single blink
  const triggerBlink = useCallback(() => {
    "worklet";
    eyelidPosition.value = withSequence(
      // Close eyes
      withTiming(1, {
        duration: blinkDuration * 0.4,
        easing: Easing.out(Easing.ease),
      }),
      // Open eyes
      withTiming(0, {
        duration: blinkDuration * 0.6,
        easing: Easing.in(Easing.ease),
      }),
    );
  }, [eyelidPosition, blinkDuration]);

  // Schedule next blink with random timing
  const scheduleNextBlink = useCallback(() => {
    if (!enabled) return;

    const randomDelay = blinkInterval + Math.random() * intervalVariation;

    const timeoutId = setTimeout(() => {
      triggerBlink();
      scheduleNextBlink();
    }, randomDelay);

    return timeoutId;
  }, [enabled, blinkInterval, intervalVariation, triggerBlink]);

  // Start/stop blink scheduling based on enabled prop
  useEffect(() => {
    if (!enabled) {
      eyelidPosition.value = 0;
      return;
    }

    // Initial delay before first blink
    const initialDelay = 1000 + Math.random() * 2000;
    let timeoutId: ReturnType<typeof setTimeout>;

    const startBlinking = () => {
      timeoutId = setTimeout(() => {
        triggerBlink();
        scheduleNextBlink();
      }, initialDelay);
    };

    startBlinking();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, triggerBlink, scheduleNextBlink, eyelidPosition]);

  // Animated style for eyelid overlay
  const eyelidStyle = useAnimatedStyle(() => {
    return {
      opacity: eyelidPosition.value,
      transform: [{ scaleY: eyelidPosition.value }],
    };
  });

  return (
    <View style={styles.container}>
      {children}
      {enabled && (
        <Animated.View
          style={[styles.eyelidOverlay, eyelidStyle]}
          pointerEvents="none"
        >
          {/* Eyelid shapes will be rendered by the parent Eyes component */}
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Hook for blink animation state
 * Use this when you need more control over the blink animation
 */
export function useBlinkAnimation(options: {
  enabled: boolean;
  blinkInterval?: number;
  intervalVariation?: number;
  blinkDuration?: number;
}) {
  const {
    enabled,
    blinkInterval = 4000,
    intervalVariation = 2000,
    blinkDuration = 150,
  } = options;

  const eyelidPosition = useSharedValue(0);
  const isBlinking = useSharedValue(false);

  const triggerBlink = useCallback(() => {
    "worklet";
    if (isBlinking.value) return;

    isBlinking.value = true;
    eyelidPosition.value = withSequence(
      withTiming(1, {
        duration: blinkDuration * 0.4,
        easing: Easing.out(Easing.ease),
      }),
      withTiming(
        0,
        {
          duration: blinkDuration * 0.6,
          easing: Easing.in(Easing.ease),
        },
        () => {
          isBlinking.value = false;
        },
      ),
    );
  }, [eyelidPosition, isBlinking, blinkDuration]);

  useEffect(() => {
    if (!enabled) {
      eyelidPosition.value = 0;
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNextBlink = () => {
      const randomDelay = blinkInterval + Math.random() * intervalVariation;
      timeoutId = setTimeout(() => {
        triggerBlink();
        scheduleNextBlink();
      }, randomDelay);
    };

    // Initial delay
    const initialDelay = 1000 + Math.random() * 2000;
    timeoutId = setTimeout(() => {
      triggerBlink();
      scheduleNextBlink();
    }, initialDelay);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, blinkInterval, intervalVariation, triggerBlink, eyelidPosition]);

  const eyelidStyle = useAnimatedStyle(() => ({
    opacity: eyelidPosition.value,
  }));

  return {
    /** Shared value for eyelid position (0 = open, 1 = closed) - alias for blinkValue */
    eyelidPosition,
    /** Same as eyelidPosition, for compatibility */
    blinkValue: eyelidPosition,
    eyelidStyle,
    triggerBlink,
    isBlinking,
  };
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  eyelidOverlay: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: "center top",
  },
});

export const BlinkAnimation = memo(BlinkAnimationBase);
