/**
 * Profile Animations
 *
 * Shared animation configurations for profile components.
 * Provides consistent animations and transitions.
 *
 * @module components/profile/ProfileAnimations
 */

import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  FadeOutLeft,
  FadeOutRight,
  FadeOutUp,
  Layout,
  ReduceMotion,
  SlideInDown,
  SlideInUp,
  SlideOutDown,
  ZoomIn,
  ZoomOut,
  withSpring,
  withTiming,
  type WithSpringConfig,
  type WithTimingConfig,
} from "react-native-reanimated";

// =============================================================================
// Animation Durations
// =============================================================================

export const DURATIONS = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  verySlow: 800,
} as const;

// =============================================================================
// Spring Configurations
// =============================================================================

export const SPRING_CONFIGS = {
  // Snappy spring for buttons and small elements
  snappy: {
    damping: 15,
    stiffness: 150,
    mass: 0.5,
    reduceMotion: ReduceMotion.System,
  } as WithSpringConfig,

  // Bouncy spring for playful animations
  bouncy: {
    damping: 10,
    stiffness: 100,
    mass: 0.8,
    reduceMotion: ReduceMotion.System,
  } as WithSpringConfig,

  // Gentle spring for cards and panels
  gentle: {
    damping: 20,
    stiffness: 80,
    mass: 1,
    reduceMotion: ReduceMotion.System,
  } as WithSpringConfig,

  // Smooth spring for transitions
  smooth: {
    damping: 25,
    stiffness: 120,
    mass: 1,
    reduceMotion: ReduceMotion.System,
  } as WithSpringConfig,
} as const;

// =============================================================================
// Timing Configurations
// =============================================================================

export const TIMING_CONFIGS = {
  // Quick ease out for exits
  quickEaseOut: {
    duration: DURATIONS.fast,
    easing: Easing.out(Easing.cubic),
    reduceMotion: ReduceMotion.System,
  } as WithTimingConfig,

  // Smooth ease in-out for transitions
  smooth: {
    duration: DURATIONS.normal,
    easing: Easing.inOut(Easing.cubic),
    reduceMotion: ReduceMotion.System,
  } as WithTimingConfig,

  // Slow entrance for emphasis
  emphasize: {
    duration: DURATIONS.slow,
    easing: Easing.out(Easing.exp),
    reduceMotion: ReduceMotion.System,
  } as WithTimingConfig,
} as const;

// =============================================================================
// Pre-configured Entering Animations
// =============================================================================

/** Fade in with slight upward movement */
export const enterFadeUp = FadeInUp.duration(DURATIONS.normal).springify();

/** Fade in with slight downward movement */
export const enterFadeDown = FadeInDown.duration(DURATIONS.normal).springify();

/** Fade in from left */
export const enterFadeLeft = FadeInLeft.duration(DURATIONS.normal).springify();

/** Fade in from right */
export const enterFadeRight = FadeInRight.duration(
  DURATIONS.normal,
).springify();

/** Simple fade in */
export const enterFade = FadeIn.duration(DURATIONS.normal);

/** Zoom in with spring */
export const enterZoom = ZoomIn.duration(DURATIONS.fast).springify();

/** Slide in from bottom */
export const enterSlideUp = SlideInDown.duration(DURATIONS.normal).springify();

/** Slide in from top */
export const enterSlideDown = SlideInUp.duration(DURATIONS.normal).springify();

// =============================================================================
// Pre-configured Exiting Animations
// =============================================================================

/** Fade out upward */
export const exitFadeUp = FadeOutUp.duration(DURATIONS.fast);

/** Fade out downward */
export const exitFadeDown = FadeOutDown.duration(DURATIONS.fast);

/** Fade out to left */
export const exitFadeLeft = FadeOutLeft.duration(DURATIONS.fast);

/** Fade out to right */
export const exitFadeRight = FadeOutRight.duration(DURATIONS.fast);

/** Simple fade out */
export const exitFade = FadeOut.duration(DURATIONS.fast);

/** Zoom out */
export const exitZoom = ZoomOut.duration(DURATIONS.fast);

/** Slide out to bottom */
export const exitSlideDown = SlideOutDown.duration(DURATIONS.fast);

// =============================================================================
// Staggered Animations
// =============================================================================

/**
 * Create a staggered fade-in-up animation
 * @param index Item index for stagger delay
 * @param baseDelay Base delay before animation starts
 * @param staggerDelay Delay between each item
 */
export function staggeredFadeInUp(
  index: number,
  baseDelay = 0,
  staggerDelay = 50,
) {
  return FadeInUp.delay(baseDelay + index * staggerDelay)
    .duration(DURATIONS.normal)
    .springify();
}

/**
 * Create a staggered fade-in-right animation
 * @param index Item index for stagger delay
 * @param baseDelay Base delay before animation starts
 * @param staggerDelay Delay between each item
 */
export function staggeredFadeInRight(
  index: number,
  baseDelay = 0,
  staggerDelay = 50,
) {
  return FadeInRight.delay(baseDelay + index * staggerDelay)
    .duration(DURATIONS.normal)
    .springify();
}

/**
 * Create a staggered zoom-in animation
 * @param index Item index for stagger delay
 * @param baseDelay Base delay before animation starts
 * @param staggerDelay Delay between each item
 */
export function staggeredZoomIn(
  index: number,
  baseDelay = 0,
  staggerDelay = 80,
) {
  return ZoomIn.delay(baseDelay + index * staggerDelay)
    .duration(DURATIONS.fast)
    .springify();
}

// =============================================================================
// Layout Animations
// =============================================================================

/** Spring layout animation for list items */
export const layoutSpring = Layout.springify();

/** Quick layout animation for responsive updates */
export const layoutQuick = Layout.duration(DURATIONS.fast);

// =============================================================================
// Animation Helpers
// =============================================================================

/**
 * Create a spring animation with shared value
 * @param toValue Target value
 * @param config Spring configuration (optional)
 */
export function springTo(
  toValue: number,
  config: WithSpringConfig = SPRING_CONFIGS.smooth,
) {
  return withSpring(toValue, config);
}

/**
 * Create a timed animation with shared value
 * @param toValue Target value
 * @param config Timing configuration (optional)
 */
export function timingTo(
  toValue: number,
  config: WithTimingConfig = TIMING_CONFIGS.smooth,
) {
  return withTiming(toValue, config);
}

// =============================================================================
// Profile-specific Animation Presets
// =============================================================================

export const PROFILE_ANIMATIONS = {
  // Header animations
  headerEnter: FadeInDown.duration(DURATIONS.slow).springify(),
  avatarEnter: ZoomIn.delay(150).duration(DURATIONS.normal).springify(),
  statsEnter: FadeInUp.delay(200).duration(DURATIONS.normal).springify(),

  // Bio section
  bioEnter: FadeInUp.delay(250).duration(DURATIONS.normal).springify(),

  // Game scores
  scoresHeaderEnter: FadeIn.delay(300).duration(DURATIONS.fast),
  scoreCardEnter: (index: number) =>
    FadeInRight.delay(350 + index * 80)
      .duration(DURATIONS.normal)
      .springify(),

  // Badges
  badgesEnter: FadeIn.delay(400).duration(DURATIONS.fast),
  badgeItemEnter: (index: number) =>
    ZoomIn.delay(450 + index * 60)
      .duration(DURATIONS.fast)
      .springify(),

  // Theme section
  themeEnter: FadeInUp.delay(300).duration(DURATIONS.normal).springify(),
  colorSwatchEnter: (index: number) =>
    ZoomIn.delay(350 + index * 40)
      .duration(DURATIONS.fast)
      .springify(),

  // Actions
  actionButtonEnter: (index: number) =>
    FadeInUp.delay(500 + index * 100)
      .duration(DURATIONS.normal)
      .springify(),

  // Modal animations
  modalBackdrop: FadeIn.duration(DURATIONS.fast),
  modalContent: SlideInDown.duration(DURATIONS.normal).springify(),
  modalExit: SlideOutDown.duration(DURATIONS.fast),

  // Editor animations
  editorItemEnter: (index: number) =>
    FadeInDown.delay(index * 50)
      .duration(DURATIONS.fast)
      .springify(),

  // Settings animations
  settingsSectionEnter: (index: number) =>
    FadeIn.delay(index * 100).duration(DURATIONS.fast),
  settingsRowEnter: (index: number) =>
    FadeInDown.delay(index * 40)
      .duration(DURATIONS.fast)
      .springify(),
} as const;

// =============================================================================
// Transition Helpers
// =============================================================================

/**
 * Apply a smooth scale transition
 * @param pressed Whether the element is pressed
 */
export function pressedScale(pressed: boolean) {
  return {
    transform: [
      { scale: withSpring(pressed ? 0.95 : 1, SPRING_CONFIGS.snappy) },
    ],
  };
}

/**
 * Apply a smooth opacity transition
 * @param visible Whether the element is visible
 */
export function visibilityOpacity(visible: boolean) {
  return {
    opacity: withTiming(visible ? 1 : 0, TIMING_CONFIGS.smooth),
  };
}

/**
 * Apply a smooth height collapse animation
 * @param expanded Whether the element is expanded
 * @param maxHeight Maximum height when expanded
 */
export function collapseHeight(expanded: boolean, maxHeight: number) {
  return {
    height: withSpring(expanded ? maxHeight : 0, SPRING_CONFIGS.gentle),
    opacity: withTiming(expanded ? 1 : 0, TIMING_CONFIGS.quickEaseOut),
  };
}
