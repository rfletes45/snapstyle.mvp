/**
 * ScrollReturnButton Component
 *
 * A floating action button that appears after navigating to a replied message.
 * Allows users to quickly return to their original scroll position.
 *
 * Features:
 * - Smooth fade-in/fade-out animations
 * - Auto-hides after configurable timeout
 * - Haptic feedback on press
 * - Accessible touch target
 *
 * @module components/chat/ScrollReturnButton
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, TouchableOpacity } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

interface ScrollReturnButtonProps {
  /** Whether the button should be visible */
  visible: boolean;
  /** Called when button is pressed */
  onPress: () => void;
  /** Auto-hide after this many milliseconds (0 to disable) */
  autoHideDelay?: number;
  /** Called when auto-hide triggers */
  onAutoHide?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function ScrollReturnButton({
  visible,
  onPress,
  autoHideDelay = 5000,
  onAutoHide,
}: ScrollReturnButtonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Auto-hide timer
  const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subtle pulse animation for the arrow
  const pulseValue = useSharedValue(1);

  // Start pulse animation when visible
  useEffect(() => {
    if (visible) {
      pulseValue.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 600 }),
          withTiming(1, { duration: 600 }),
        ),
        -1, // Infinite repeat
        true, // Reverse
      );
    } else {
      pulseValue.value = 1;
    }
  }, [visible, pulseValue]);

  // Auto-hide timer
  useEffect(() => {
    if (visible && autoHideDelay > 0) {
      autoHideTimeoutRef.current = setTimeout(() => {
        onAutoHide?.();
      }, autoHideDelay);

      return () => {
        if (autoHideTimeoutRef.current) {
          clearTimeout(autoHideTimeoutRef.current);
        }
      };
    }
  }, [visible, autoHideDelay, onAutoHide]);

  // Animated style for arrow icon
  const arrowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseValue.value }],
  }));

  // Handle press with haptic feedback
  const handlePress = () => {
    // Provide haptic feedback on native
    if (Platform.OS !== "web") {
      try {
        const { impactAsync, ImpactFeedbackStyle } =
          require("expo-haptics") as typeof import("expo-haptics");
        impactAsync(ImpactFeedbackStyle.Light);
      } catch (e) {
        // Haptics not available
      }
    }

    onPress();
  };

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[
        styles.container,
        {
          bottom: insets.bottom + 80, // Above composer
        },
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[
          styles.button,
          {
            backgroundColor: theme.dark
              ? "rgba(45, 45, 45, 0.95)"
              : "rgba(255, 255, 255, 0.98)",
            borderColor: theme.dark
              ? "rgba(80, 80, 80, 0.5)"
              : "rgba(200, 200, 200, 0.8)",
          },
        ]}
      >
        <Animated.View style={arrowAnimatedStyle}>
          <Ionicons
            name="return-down-back"
            size={18}
            color={theme.colors.primary}
            style={styles.icon}
          />
        </Animated.View>
        <Text
          style={[
            styles.text,
            {
              color: theme.colors.onSurface,
            },
          ]}
        >
          Back to reply
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    // Shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 4,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ScrollReturnButton;
