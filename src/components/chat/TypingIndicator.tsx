/**
 * TypingIndicator Components
 *
 * Two display modes:
 *
 * 1. **TypingBar** (stacked mode) — Discord-style bar at the bottom of
 *    the chat showing "Username is typing..." with animated dots.
 *
 * 2. **TypingBubble** (bubble mode) — An incoming-style chat bubble with
 *    an animated three-dot indicator, appearing where the next message would.
 *
 * Both components share the same bouncing-dot animation and
 * accept the same data shape.
 *
 * @module components/chat/TypingIndicator
 */

import { Spacing } from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

// =============================================================================
// Shared Types
// =============================================================================

export interface TypingIndicatorProps {
  /** Name(s) of the user(s) who are typing. String for single, array for multiple. */
  userName?: string | string[];
  /** Whether to show the indicator */
  visible: boolean;
}

// =============================================================================
// Typing Label Formatter
// =============================================================================

/**
 * Format typing label from user name(s).
 *
 * Returns structured parts so the UI can bold the name(s).
 *
 * - Single: { names: "Alice", verb: "is typing..." }
 * - Two: { names: "Alice and Bob", verb: "are typing..." }
 * - Three+: { names: "Alice and 2 others", verb: "are typing..." }
 */
function formatTypingParts(
  userName?: string | string[],
): { names: string; verb: string } | null {
  if (!userName) return null;

  if (typeof userName === "string") {
    return { names: userName, verb: "is typing..." };
  }

  if (userName.length === 0) return null;
  if (userName.length === 1)
    return { names: userName[0], verb: "is typing..." };
  if (userName.length === 2)
    return {
      names: `${userName[0]} and ${userName[1]}`,
      verb: "are typing...",
    };
  return {
    names: `${userName[0]} and ${userName.length - 1} others`,
    verb: "are typing...",
  };
}

// =============================================================================
// Shared Animated Dots
// =============================================================================

interface AnimatedDotsProps {
  color: string;
  size?: number;
}

const AnimatedDots: React.FC<AnimatedDotsProps> = React.memo(
  ({ color, size = 6 }) => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const bounce = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
        );

      const animation = Animated.parallel([
        bounce(dot1, 0),
        bounce(dot2, 150),
        bounce(dot3, 300),
      ]);
      animation.start();

      return () => {
        animation.stop();
        dot1.setValue(0);
        dot2.setValue(0);
        dot3.setValue(0);
      };
    }, [dot1, dot2, dot3]);

    const dotStyle = (anim: Animated.Value) => ({
      width: size,
      height: size,
      borderRadius: size / 2,
      marginHorizontal: 2,
      backgroundColor: color,
      transform: [
        {
          translateY: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -4],
          }),
        },
      ],
      opacity: anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.4, 1],
      }),
    });

    return (
      <View style={dotsStyles.container}>
        <Animated.View style={dotStyle(dot1)} />
        <Animated.View style={dotStyle(dot2)} />
        <Animated.View style={dotStyle(dot3)} />
      </View>
    );
  },
);
AnimatedDots.displayName = "AnimatedDots";

const dotsStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
});

// =============================================================================
// TypingBar — Stacked Mode (Discord-style bar)
// =============================================================================

/**
 * A compact bar below the message list showing "**Username** is typing…"
 *
 * Designed for stacked (feed) display mode.
 */
export const TypingBar: React.FC<TypingIndicatorProps> = React.memo(
  ({ userName, visible }) => {
    const theme = useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, [visible, fadeAnim]);

    if (!visible) return null;

    const parts = formatTypingParts(userName);

    return (
      <Animated.View style={[barStyles.container, { opacity: fadeAnim }]}>
        <AnimatedDots color={theme.colors.primary} />
        {parts && (
          <Text
            variant="labelSmall"
            style={[barStyles.text, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            <Text
              style={[barStyles.textBold, { color: theme.colors.onSurface }]}
            >
              {parts.names}
            </Text>{" "}
            {parts.verb}
          </Text>
        )}
      </Animated.View>
    );
  },
);
TypingBar.displayName = "TypingBar";

const barStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    marginTop: 6,
    minHeight: 28,
  },
  text: {
    marginLeft: Spacing.xs,
    flexShrink: 1,
  },
  textBold: {
    fontWeight: "700",
  },
});

// =============================================================================
// TypingBubble — Bubble Mode (Discord-style bubble)
// =============================================================================

/**
 * An incoming-style chat bubble with animated dots.
 *
 * Designed for bubble display mode — appears where the next
 * incoming message would be rendered.
 */
export const TypingBubble: React.FC<TypingIndicatorProps> = React.memo(
  ({ userName, visible }) => {
    const theme = useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, [visible, fadeAnim]);

    if (!visible) return null;

    const parts = formatTypingParts(userName);

    return (
      <Animated.View style={[bubbleStyles.wrapper, { opacity: fadeAnim }]}>
        {parts && (
          <Text
            variant="labelSmall"
            style={[
              bubbleStyles.nameLabel,
              { color: theme.colors.onSurfaceVariant },
            ]}
            numberOfLines={1}
          >
            {parts.names}
          </Text>
        )}
        <View
          style={[
            bubbleStyles.bubble,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <AnimatedDots color={theme.colors.onSurfaceVariant} size={7} />
        </View>
      </Animated.View>
    );
  },
);
TypingBubble.displayName = "TypingBubble";

const bubbleStyles = StyleSheet.create({
  wrapper: {
    alignSelf: "flex-start",
    marginLeft: Spacing.md,
    marginBottom: Spacing.xs,
  },
  nameLabel: {
    marginBottom: 2,
    marginLeft: 4,
    fontSize: 11,
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    minWidth: 60,
  },
});

// =============================================================================
// Legacy-compatible TypingIndicator
// =============================================================================

/**
 * Default typing indicator — uses the bar style.
 * Kept for backward compatibility with existing imports.
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = TypingBar;
TypingIndicator.displayName = "TypingIndicator";

// =============================================================================
// Inline Typing Preview (for inbox / conversation list)
// =============================================================================

export interface TypingPreviewProps {
  /** Whether someone is typing in this conversation */
  visible: boolean;
}

/**
 * Tiny inline "typing..." text for use inside conversation row previews.
 */
export const TypingPreview: React.FC<TypingPreviewProps> = React.memo(
  ({ visible }) => {
    const theme = useTheme();

    if (!visible) return null;

    return (
      <View style={previewStyles.container}>
        <AnimatedDots color={theme.colors.primary} size={4} />
        <Text
          variant="bodySmall"
          style={[previewStyles.text, { color: theme.colors.primary }]}
          numberOfLines={1}
        >
          typing...
        </Text>
      </View>
    );
  },
);
TypingPreview.displayName = "TypingPreview";

const previewStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    marginLeft: 4,
    fontStyle: "italic",
  },
});
