/**
 * Animation Utilities
 *
 * Reusable animation configurations and utilities for the inbox:
 * - Layout animations for list reordering
 * - Badge pop animations
 * - Swipe threshold animations
 * - Fade and slide transitions
 *
 * @module utils/animations
 */

import {
  Animated,
  Easing,
  LayoutAnimation,
  LayoutAnimationConfig,
  Platform,
  UIManager,
} from "react-native";

// =============================================================================
// Enable LayoutAnimation on Android
// =============================================================================

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =============================================================================
// Layout Animation Configs
// =============================================================================

/**
 * Predefined layout animation configurations
 */
export const layoutAnimations = {
  /**
   * For list item reordering (pin/unpin operations)
   * Smooth easing for position changes with fade for additions/removals
   */
  listReorder: {
    duration: 300,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  } as LayoutAnimationConfig,

  /**
   * For badge count changes
   * Spring animation for a "pop" effect
   */
  badgePop: {
    duration: 200,
    create: {
      type: LayoutAnimation.Types.spring,
      property: LayoutAnimation.Properties.scaleXY,
      springDamping: 0.7,
    },
    update: {
      type: LayoutAnimation.Types.spring,
      springDamping: 0.7,
    },
    delete: {
      type: LayoutAnimation.Types.easeOut,
      property: LayoutAnimation.Properties.opacity,
    },
  } as LayoutAnimationConfig,

  /**
   * Fast fade for showing/hiding elements
   */
  quickFade: {
    duration: 150,
    create: {
      type: LayoutAnimation.Types.easeIn,
      property: LayoutAnimation.Properties.opacity,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      type: LayoutAnimation.Types.easeOut,
      property: LayoutAnimation.Properties.opacity,
    },
  } as LayoutAnimationConfig,

  /**
   * For expanding/collapsing sections
   */
  expandCollapse: {
    duration: 250,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.scaleY,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.scaleY,
    },
  } as LayoutAnimationConfig,
};

// =============================================================================
// Animated Value Factories
// =============================================================================

/**
 * Create a badge pop animation
 * Scales up briefly then springs back to normal size
 *
 * @param scaleValue - Animated.Value to animate (should start at 1)
 * @returns Animated.CompositeAnimation
 */
export function createBadgePopAnimation(
  scaleValue: Animated.Value,
): Animated.CompositeAnimation {
  return Animated.sequence([
    Animated.timing(scaleValue, {
      toValue: 1.3,
      duration: 100,
      easing: Easing.ease,
      useNativeDriver: true,
    }),
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }),
  ]);
}

/**
 * Create a shake animation for error feedback
 *
 * @param translateX - Animated.Value for horizontal translation
 * @returns Animated.CompositeAnimation
 */
export function createShakeAnimation(
  translateX: Animated.Value,
): Animated.CompositeAnimation {
  return Animated.sequence([
    Animated.timing(translateX, {
      toValue: 10,
      duration: 50,
      useNativeDriver: true,
    }),
    Animated.timing(translateX, {
      toValue: -10,
      duration: 50,
      useNativeDriver: true,
    }),
    Animated.timing(translateX, {
      toValue: 10,
      duration: 50,
      useNativeDriver: true,
    }),
    Animated.timing(translateX, {
      toValue: 0,
      duration: 50,
      useNativeDriver: true,
    }),
  ]);
}

/**
 * Create a fade-in animation
 *
 * @param opacity - Animated.Value for opacity (should start at 0)
 * @param duration - Animation duration in ms
 * @returns Animated.CompositeAnimation
 */
export function createFadeInAnimation(
  opacity: Animated.Value,
  duration: number = 200,
): Animated.CompositeAnimation {
  return Animated.timing(opacity, {
    toValue: 1,
    duration,
    easing: Easing.ease,
    useNativeDriver: true,
  });
}

/**
 * Create a fade-out animation
 *
 * @param opacity - Animated.Value for opacity (should start at 1)
 * @param duration - Animation duration in ms
 * @returns Animated.CompositeAnimation
 */
export function createFadeOutAnimation(
  opacity: Animated.Value,
  duration: number = 200,
): Animated.CompositeAnimation {
  return Animated.timing(opacity, {
    toValue: 0,
    duration,
    easing: Easing.ease,
    useNativeDriver: true,
  });
}

/**
 * Create a slide-up animation (for modals/sheets)
 *
 * @param translateY - Animated.Value for vertical translation
 * @param startValue - Starting Y position (offscreen)
 * @returns Animated.CompositeAnimation
 */
export function createSlideUpAnimation(
  translateY: Animated.Value,
  startValue: number = 300,
): Animated.CompositeAnimation {
  translateY.setValue(startValue);
  return Animated.spring(translateY, {
    toValue: 0,
    friction: 8,
    tension: 65,
    useNativeDriver: true,
  });
}

/**
 * Create a slide-down animation (for dismissing modals)
 *
 * @param translateY - Animated.Value for vertical translation
 * @param endValue - Ending Y position (offscreen)
 * @returns Animated.CompositeAnimation
 */
export function createSlideDownAnimation(
  translateY: Animated.Value,
  endValue: number = 300,
): Animated.CompositeAnimation {
  return Animated.timing(translateY, {
    toValue: endValue,
    duration: 250,
    easing: Easing.ease,
    useNativeDriver: true,
  });
}

// =============================================================================
// Interpolation Helpers
// =============================================================================

/**
 * Create swipe threshold opacity interpolation
 * Makes action icons more visible as swipe approaches threshold
 *
 * @param dragX - Animated interpolation from gesture handler
 * @param threshold - Swipe threshold distance
 * @returns Interpolated animated value
 */
export function createSwipeOpacityInterpolation(
  dragX: Animated.AnimatedInterpolation<number>,
  threshold: number,
): Animated.AnimatedInterpolation<number> {
  return dragX.interpolate({
    inputRange: [-threshold * 1.5, -threshold, 0, threshold, threshold * 1.5],
    outputRange: [1, 0.8, 0, 0.8, 1],
    extrapolate: "clamp",
  });
}

/**
 * Create swipe threshold scale interpolation
 * Makes action icons "pop" when threshold is reached
 *
 * @param dragX - Animated interpolation from gesture handler
 * @param threshold - Swipe threshold distance
 * @returns Interpolated animated value
 */
export function createSwipeScaleInterpolation(
  dragX: Animated.AnimatedInterpolation<number>,
  threshold: number,
): Animated.AnimatedInterpolation<number> {
  return dragX.interpolate({
    inputRange: [
      -threshold * 1.5,
      -threshold,
      -threshold * 0.9,
      0,
      threshold * 0.9,
      threshold,
      threshold * 1.5,
    ],
    outputRange: [1, 1.2, 0.9, 0.5, 0.9, 1.2, 1],
    extrapolate: "clamp",
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Trigger a layout animation before state update
 *
 * @param config - LayoutAnimationConfig or use a preset
 */
export function animateLayout(
  config: LayoutAnimationConfig = layoutAnimations.listReorder,
): void {
  LayoutAnimation.configureNext(config);
}

/**
 * Create a staggered animation for list items
 *
 * @param items - Array of Animated.Values to animate
 * @param duration - Duration per item
 * @param stagger - Delay between each item
 * @returns Animated.CompositeAnimation
 */
export function createStaggeredFadeIn(
  items: Animated.Value[],
  duration: number = 200,
  stagger: number = 50,
): Animated.CompositeAnimation {
  return Animated.stagger(
    stagger,
    items.map((item) =>
      Animated.timing(item, {
        toValue: 1,
        duration,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ),
  );
}

/**
 * Reset an animated value to its initial state
 *
 * @param value - Animated.Value to reset
 * @param initialValue - Value to reset to
 */
export function resetAnimatedValue(
  value: Animated.Value,
  initialValue: number = 0,
): void {
  value.setValue(initialValue);
}
