/**
 * MessageHighlightOverlay Component
 *
 * A simple animated overlay that pulses to highlight a message.
 * Used for visual feedback when navigating to replied messages.
 *
 * @module components/chat/MessageHighlightOverlay
 */

import React, { useEffect } from "react";
import { useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface MessageHighlightOverlayProps {
  /** Whether this message should be highlighted */
  isHighlighted: boolean;
}

export function MessageHighlightOverlay({
  isHighlighted,
}: MessageHighlightOverlayProps) {
  const theme = useTheme();
  const highlightOpacity = useSharedValue(0);

  useEffect(() => {
    if (isHighlighted) {
      // Animate: fade in → hold → fade out
      highlightOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(1500, withTiming(0, { duration: 400 })),
      );
    } else {
      highlightOpacity.value = 0;
    }
  }, [isHighlighted, highlightOpacity]);

  const highlightStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    top: -4,
    left: -8,
    right: -8,
    bottom: -4,
    backgroundColor: theme.colors.primary,
    opacity: highlightOpacity.value * 0.15,
    borderRadius: 12,
    zIndex: -1,
  }));

  if (!isHighlighted) {
    return null;
  }

  return <Animated.View style={highlightStyle} pointerEvents="none" />;
}

export default MessageHighlightOverlay;
