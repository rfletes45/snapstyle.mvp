/**
 * Idle Animation Component
 *
 * Provides subtle idle animations for avatars including
 * gentle floating motion and slight rotation.
 */

import React, { memo, useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface IdleAnimationProps {
  /** Whether animation is enabled */
  enabled: boolean;
  /** Animation intensity (0-1, default: 0.5) */
  intensity?: number;
  /** Children to animate */
  children: React.ReactNode;
}

/**
 * Idle Animation Component
 *
 * Wraps avatar content and provides subtle ambient motion
 * for a more lifelike appearance.
 */
function IdleAnimationBase({
  enabled,
  intensity = 0.5,
  children,
}: IdleAnimationProps) {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!enabled) {
      translateY.value = withTiming(0, { duration: 300 });
      rotate.value = withTiming(0, { duration: 300 });
      scale.value = withTiming(1, { duration: 300 });
      return;
    }

    // Calculate animation values based on intensity
    const floatDistance = 3 * intensity;
    const rotationAmount = 1 * intensity;
    const scaleAmount = 0.02 * intensity;

    // Subtle floating motion
    translateY.value = withRepeat(
      withSequence(
        withTiming(-floatDistance, {
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(floatDistance * 0.5, {
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, {
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1, // Infinite repeat
      false, // Don't reverse
    );

    // Subtle rotation
    rotate.value = withRepeat(
      withSequence(
        withTiming(-rotationAmount, {
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(rotationAmount, {
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      true, // Reverse
    );

    // Subtle breathing/scale effect
    scale.value = withRepeat(
      withSequence(
        withTiming(1 + scaleAmount, {
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1 - scaleAmount * 0.5, {
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      true,
    );
  }, [enabled, intensity, translateY, rotate, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  if (!enabled) {
    return <>{children}</>;
  }

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

/**
 * Hook for idle animation state
 * Use this when you need more control over the animation
 */
export function useIdleAnimation(enabled: boolean, intensity: number = 0.5) {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!enabled) {
      translateY.value = withTiming(0, { duration: 300 });
      rotate.value = withTiming(0, { duration: 300 });
      scale.value = withTiming(1, { duration: 300 });
      return;
    }

    const floatDistance = 3 * intensity;
    const rotationAmount = 1 * intensity;
    const scaleAmount = 0.02 * intensity;

    translateY.value = withRepeat(
      withSequence(
        withTiming(-floatDistance, {
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(floatDistance * 0.5, {
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    rotate.value = withRepeat(
      withSequence(
        withTiming(-rotationAmount, {
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(rotationAmount, {
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      true,
    );

    scale.value = withRepeat(
      withSequence(
        withTiming(1 + scaleAmount, {
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1 - scaleAmount * 0.5, {
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      true,
    );
  }, [enabled, intensity, translateY, rotate, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return {
    translateY,
    rotate,
    scale,
    animatedStyle,
  };
}

export const IdleAnimation = memo(IdleAnimationBase);
