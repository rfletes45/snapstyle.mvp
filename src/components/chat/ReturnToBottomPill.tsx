/**
 * ReturnToBottomPill Component
 *
 * Floating pill that appears when user scrolls away from latest messages.
 * Shows new-message count and provides quick jump to bottom.
 *
 * Uses Reanimated layout animations for smooth enter/exit.
 *
 * @module components/chat/ReturnToBottomPill
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";
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
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

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

const DEFAULT_BOTTOM_OFFSET = 12;

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

  if (!visible) {
    return null;
  }

  const label =
    unreadCount > 0
      ? unreadCount === 1
        ? "1 new message"
        : `${unreadCount > 99 ? "99+" : unreadCount} new messages`
      : undefined;

  return (
    <Animated.View
      entering={FadeIn.duration(180).springify().damping(18)}
      exiting={FadeOut.duration(120)}
      style={[styles.container, { bottom: bottomOffset }, style]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outline ?? "rgba(128,128,128,0.15)",
          },
          pressed && styles.pillPressed,
        ]}
        accessibilityLabel={label ?? "Jump to latest"}
        accessibilityRole="button"
        accessibilityHint="Scrolls to the latest messages"
      >
        <MaterialCommunityIcons
          name="chevron-double-down"
          size={18}
          color={colors.primary}
        />
        {label != null && (
          <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
            {label}
          </Text>
        )}
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  pillPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
  },
});

export default ReturnToBottomPill;
