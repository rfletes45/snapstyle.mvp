/**
 * HeaderIconButton
 *
 * A reusable icon button component for headers with optional badge.
 * Used in the Play screen header for navigation shortcuts.
 *
 * Features:
 * - 40x40px touch target
 * - Spring animation on press
 * - Optional notification badge (dot or count)
 * - Haptic feedback
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 1
 */

import { useAppTheme } from "@/store/ThemeContext";
import { HeaderIconButtonProps } from "@/types/playScreen";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { PLAY_SCREEN_TOKENS } from "@/constants/gamesTheme";

const { spacing, borderRadius, iconSizes, typography, animation, colors } =
  PLAY_SCREEN_TOKENS;

/**
 * HeaderIconButton Component
 *
 * @example
 * <HeaderIconButton
 *   icon="trophy"
 *   color="#FFD700"
 *   onPress={() => navigation.navigate('Leaderboard')}
 *   showBadge={hasNewAchievements}
 * />
 */
export function HeaderIconButton({
  icon,
  color,
  onPress,
  showBadge = false,
  badgeCount = 0,
  size = iconSizes.headerIcon,
  accessibilityLabel,
}: HeaderIconButtonProps) {
  const { colors: themeColors } = useAppTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(animation.pressScale, animation.pressSpring);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animation.pressSpring);
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const iconColor = color || themeColors.text;
  const shouldShowBadge = showBadge || badgeCount > 0;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.button}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={size}
          color={iconColor}
        />

        {/* Badge */}
        {shouldShowBadge && (
          <View
            style={[
              styles.badge,
              badgeCount > 0 ? styles.badgeWithCount : styles.badgeDot,
              { backgroundColor: colors.yourTurnAccent },
            ]}
          >
            {badgeCount > 0 && (
              <Text style={styles.badgeText}>
                {badgeCount > 99 ? "99+" : badgeCount}
              </Text>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: borderRadius.icon,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badgeWithCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: typography.badgeText.fontSize,
    fontWeight: typography.badgeText.fontWeight,
    lineHeight: typography.badgeText.lineHeight,
  },
});

export default HeaderIconButton;
