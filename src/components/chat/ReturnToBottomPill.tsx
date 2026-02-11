/**
 * ReturnToBottomPill Component
 *
 * Floating button that appears when user scrolls away from latest messages.
 * Shows unread count and provides quick jump to bottom.
 *
 * @module components/chat/ReturnToBottomPill
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Text } from "react-native-paper";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";

// =============================================================================
// Types
// =============================================================================

export interface ReturnToBottomPillProps {
  /** Whether to show the pill */
  visible: boolean;
  /** Number of new/unread messages */
  unreadCount?: number;
  /** Callback when pill is pressed */
  onPress: () => void;
  /** Bottom offset for positioning (above composer) */
  bottomOffset?: number;
  /** Custom style */
  style?: StyleProp<ViewStyle>;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_BOTTOM_OFFSET = 80;

// =============================================================================
// Component
// =============================================================================

export function ReturnToBottomPill({
  visible,
  unreadCount = 0,
  onPress,
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
  style,
}: ReturnToBottomPillProps): React.JSX.Element | null {
  const colors = useColors();
  // Animated style for bounce effect on press
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(1) }],
    };
  }, []);

  if (!visible) {
    return null;
  }

  const label =
    unreadCount > 0
      ? unreadCount === 1
        ? "1 new message"
        : `${unreadCount > 99 ? "99+" : unreadCount} new messages`
      : "Return to bottom";

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[styles.container, { bottom: bottomOffset }, animatedStyle, style]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityHint="Scrolls to the latest messages"
      >
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={colors.primary}
        />
        <Text style={styles.text}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 100,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    gap: Spacing.xs,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  pillPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  text: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },
});

export default ReturnToBottomPill;
