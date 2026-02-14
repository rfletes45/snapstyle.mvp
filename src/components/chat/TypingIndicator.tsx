/**
 * TypingIndicator Component
 *
 * Displays an animated "typing..." indicator when the other user is typing.
 * Shows three bouncing dots with the user's name.
 *
 * @module components/chat/TypingIndicator
 */

import { Spacing } from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface TypingIndicatorProps {
  /** Name(s) of the user(s) who are typing. String for single user, array for multiple. */
  userName?: string | string[];
  /** Whether to show the indicator */
  visible: boolean;
}

/**
 * Format typing label from user name(s).
 *
 * - Single: "Alice is typing"
 * - Two: "Alice and Bob are typing"
 * - Three+: "3 people are typing"
 */
function formatTypingLabel(userName?: string | string[]): string | null {
  if (!userName) return null;

  if (typeof userName === "string") {
    return `${userName} is typing`;
  }

  if (userName.length === 0) return null;
  if (userName.length === 1) return `${userName[0]} is typing`;
  if (userName.length === 2)
    return `${userName[0]} and ${userName[1]} are typing`;
  return `${userName.length} people are typing`;
}

/**
 * Animated typing indicator with bouncing dots
 *
 * @example
 * ```tsx
 * <TypingIndicator
 *   userName="John"
 *   visible={isOtherUserTyping}
 * />
 * ```
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = React.memo(
  ({ userName, visible }) => {
    const theme = useTheme();

    // Animation values for three dots
    const dot1Anim = useRef(new Animated.Value(0)).current;
    const dot2Anim = useRef(new Animated.Value(0)).current;
    const dot3Anim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Fade in/out animation
    useEffect(() => {
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, [visible, fadeAnim]);

    // Bouncing dots animation
    useEffect(() => {
      if (!visible) return;

      const createBounce = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
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
      };

      const animation = Animated.parallel([
        createBounce(dot1Anim, 0),
        createBounce(dot2Anim, 150),
        createBounce(dot3Anim, 300),
      ]);

      animation.start();

      return () => {
        animation.stop();
        dot1Anim.setValue(0);
        dot2Anim.setValue(0);
        dot3Anim.setValue(0);
      };
    }, [visible, dot1Anim, dot2Anim, dot3Anim]);

    if (!visible) return null;

    const getDotStyle = (anim: Animated.Value) => ({
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
        outputRange: [0.5, 1],
      }),
    });

    return (
      <Animated.View
        style={[
          styles.container,
          { backgroundColor: theme.colors.surfaceVariant, opacity: fadeAnim },
        ]}
      >
        <View style={styles.dotsContainer}>
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: theme.colors.primary },
              getDotStyle(dot1Anim),
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: theme.colors.primary },
              getDotStyle(dot2Anim),
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: theme.colors.primary },
              getDotStyle(dot3Anim),
            ]}
          />
        </View>
        {formatTypingLabel(userName) && (
          <Text
            variant="labelSmall"
            style={[styles.text, { color: theme.colors.onSurfaceVariant }]}
          >
            {formatTypingLabel(userName)}
          </Text>
        )}
      </Animated.View>
    );
  },
);

TypingIndicator.displayName = "TypingIndicator";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
  text: {
    marginLeft: Spacing.xs,
  },
});
