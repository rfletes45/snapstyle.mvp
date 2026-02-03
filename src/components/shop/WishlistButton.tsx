/**
 * WishlistButton Component
 *
 * Heart-shaped button for adding/removing items from wishlist.
 * Provides visual feedback for wishlisted state with animations.
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.1
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useAppTheme } from "@/store/ThemeContext";
import type { ShopType } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

export interface WishlistButtonProps {
  /** Item ID */
  itemId: string;

  /** Whether item is currently wishlisted */
  isWishlisted: boolean;

  /** Shop type */
  shopType: ShopType;

  /** Item price (for tracking) */
  price: number;

  /** Toggle wishlist callback */
  onToggle: (
    itemId: string,
    shopType: ShopType,
    price: number,
  ) => Promise<boolean>;

  /** Optional size (default: 24) */
  size?: number;

  /** Optional custom colors */
  activeColor?: string;
  inactiveColor?: string;

  /** Whether button is disabled */
  disabled?: boolean;

  /** Loading state */
  loading?: boolean;

  /** Test ID for testing */
  testID?: string;
}

// =============================================================================
// Component
// =============================================================================

function WishlistButtonBase({
  itemId,
  isWishlisted,
  shopType,
  price,
  onToggle,
  size = 24,
  activeColor,
  inactiveColor,
  disabled = false,
  loading = false,
  testID,
}: WishlistButtonProps) {
  const { colors } = useAppTheme();

  // Animation values
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  // Determine colors
  const heartActiveColor = activeColor || "#FF4B6E";
  const heartInactiveColor = inactiveColor || colors.textSecondary;

  // Handle press
  const handlePress = useCallback(async () => {
    if (disabled || loading) return;

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Animate
    if (!isWishlisted) {
      // Adding to wishlist - bounce animation
      scale.value = withSequence(
        withSpring(1.3, { damping: 10, stiffness: 400 }),
        withSpring(1, { damping: 10, stiffness: 400 }),
      );
      rotation.value = withSequence(
        withTiming(-15, { duration: 100 }),
        withTiming(15, { duration: 100 }),
        withTiming(0, { duration: 100 }),
      );
    } else {
      // Removing from wishlist - subtle shrink
      scale.value = withSequence(
        withTiming(0.8, { duration: 100 }),
        withSpring(1, { damping: 10, stiffness: 400 }),
      );
    }

    // Call toggle
    await onToggle(itemId, shopType, price);
  }, [
    disabled,
    loading,
    isWishlisted,
    itemId,
    shopType,
    price,
    onToggle,
    scale,
    rotation,
  ]);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  // Determine icon
  const iconName = isWishlisted ? "heart" : "heart-outline";
  const iconColor = isWishlisted ? heartActiveColor : heartInactiveColor;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      testID={testID}
      accessibilityLabel={
        isWishlisted ? "Remove from wishlist" : "Add to wishlist"
      }
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: isWishlisted }}
    >
      <Animated.View style={animatedStyle}>
        <MaterialCommunityIcons name={iconName} size={size} color={iconColor} />
      </Animated.View>
    </Pressable>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  button: {
    padding: 4,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});

// =============================================================================
// Export
// =============================================================================

export const WishlistButton = memo(WishlistButtonBase);
export default WishlistButton;
