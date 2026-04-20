/**
 * AnimatedMessageRow — One-shot slide-in animation for new chat messages.
 *
 * Uses manual Reanimated shared values (translateY + opacity) driven by
 * `withTiming` instead of the `entering` layout-animation prop.
 *
 * WHY NOT `entering`?
 * The `entering` prop is a Reanimated layout animation whose lifecycle is
 * tied to the prop reference. If any re-render changes or removes the prop
 * during the native setup window, the animation is cancelled before the
 * first frame paints. In DMs, receipt-watermark subscriptions trigger
 * extra recomputes right after a send, reliably hitting this window.
 *
 * Manual shared values are immune to this because `withTiming` dispatches
 * work to the UI thread on mount and completes regardless of subsequent
 * JS-side re-renders. The `transform: [{translateY}]` is purely visual
 * (does not affect layout), so it cooperates cleanly with
 * `maintainVisibleContentPosition` and inverted FlatList scroll mechanics.
 *
 * LIFECYCLE:
 * - `queueAnimation(id)` adds the message ID to a `Set<string>` (sync mutation).
 * - On first render, `shouldAnimateOnMount(id)` reads the Set.
 * - The ID is **not** consumed eagerly — it stays in the Set until the
 *   conversation-level `clear()` fires on navigation.  This makes the
 *   decision resilient to cell remounts caused by FlatList recycling or
 *   unstable `renderItem` callback deps.
 * - A `requestAnimationFrame` wrapper ensures the native view is laid out
 *   (visible in the hierarchy) before Reanimated dispatches the opacity +
 *   translateY transitions on the UI thread.
 */

import React, { useEffect, useRef } from "react";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** Subtle slide distance in pixels — start below, animate up */
const SLIDE_PX = 8;
/** Animation duration in milliseconds */
const DURATION_MS = 120;

const TIMING_CONFIG = {
  duration: DURATION_MS,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.Never,
};

export interface AnimatedMessageRowProps {
  children: React.ReactNode;
  messageId: string;
  shouldAnimateOnMount: (id: string) => boolean;
}

/**
 * Wraps a chat message row. If the message was queued for enter animation,
 * mounts a `SlideInAnimator` that drives a one-shot translateY + opacity
 * animation. Otherwise returns children directly (zero overhead — no hooks
 * allocated, no Animated.View wrapper).
 */
export function AnimatedMessageRow({
  children,
  messageId,
  shouldAnimateOnMount,
}: AnimatedMessageRowProps) {
  // Capture the "should animate" decision once on first render.
  // useRef ensures this is evaluated exactly once — subsequent re-renders
  // (receipt updates, display-mode changes, timeline recomputes, etc.)
  // cannot flip it.
  const shouldAnimate = useRef(shouldAnimateOnMount(messageId)).current;

  if (!shouldAnimate) {
    return <>{children}</>;
  }

  return <SlideInAnimator messageId={messageId}>{children}</SlideInAnimator>;
}

AnimatedMessageRow.displayName = "AnimatedMessageRow";

/**
 * Inner component that owns the Reanimated shared values and drives the
 * slide-up + fade-in animation. Separated from the outer gate so that
 * hooks are only allocated for messages that actually animate.
 */
function SlideInAnimator({
  children,
  messageId,
}: {
  children: React.ReactNode;
  messageId: string;
}) {
  const translateY = useSharedValue(SLIDE_PX);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Use requestAnimationFrame to ensure the native view is laid out
    // and visible in the hierarchy before Reanimated dispatches the
    // transitions on the UI thread. Without this, removeClippedSubviews
    // or inverted-FlatList scroll adjustments can clip the view during
    // the animation's first frames, making it invisible.
    requestAnimationFrame(() => {
      translateY.value = withTiming(0, TIMING_CONFIG);
      opacity.value = withTiming(1, TIMING_CONFIG);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
