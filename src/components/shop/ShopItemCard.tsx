/**
 * Shop Item Card Component
 *
 * Displays a single shop item with:
 * - Item image/preview
 * - Name and rarity badge
 * - Price (with discount display)
 * - Status badges (NEW, SALE, LIMITED, etc.)
 * - Owned/Can't Afford states
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useAppTheme } from "@/store/ThemeContext";
import type { PointsShopItem, ShopItemRarity } from "@/types/shop";
import { RARITY_COLORS, SHOP_COLORS } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

interface ShopItemCardProps {
  /** The shop item to display */
  item: PointsShopItem;
  /** User's current token balance */
  balance: number;
  /** Whether the item is currently owned */
  owned?: boolean;
  /** Called when the card is pressed */
  onPress?: (item: PointsShopItem) => void;
  /** Card size variant */
  size?: "small" | "medium" | "large";
  /** Whether to show compact layout */
  compact?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

const SIZE_CONFIG = {
  small: {
    width: 120,
    height: 160,
    imageHeight: 90,
    fontSize: 12,
    iconSize: 14,
  },
  medium: {
    width: 160,
    height: 200,
    imageHeight: 120,
    fontSize: 14,
    iconSize: 16,
  },
  large: {
    width: 200,
    height: 260,
    imageHeight: 160,
    fontSize: 16,
    iconSize: 18,
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the color for a rarity level
 */
export function getRarityColor(rarity: ShopItemRarity): string {
  return RARITY_COLORS[rarity] || RARITY_COLORS.common;
}

/**
 * Get the gradient colors for a rarity level
 */
function getRarityGradient(rarity: ShopItemRarity): [string, string] {
  const baseColor = getRarityColor(rarity);
  // Create a darker shade for the gradient
  return [baseColor, adjustColorBrightness(baseColor, -20)];
}

/**
 * Adjust color brightness
 */
function adjustColorBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Check if an item is new (within newUntil date)
 */
function isItemNew(item: PointsShopItem): boolean {
  if (!item.newUntil) return false;
  return new Date(item.newUntil) > new Date();
}

/**
 * Check if an item has a discount
 */
function hasDiscount(item: PointsShopItem): boolean {
  return (
    item.discountPercent !== undefined &&
    item.discountPercent > 0 &&
    item.originalPrice !== undefined
  );
}

/**
 * Check if an item is limited (has stock or time limit)
 */
function isLimited(item: PointsShopItem): boolean {
  return (
    (item.stock !== undefined && item.stock > 0) ||
    item.availableTo !== undefined
  );
}

// =============================================================================
// Component
// =============================================================================

function ShopItemCardComponent({
  item,
  balance,
  owned = false,
  onPress,
  size = "medium",
  compact = false,
}: ShopItemCardProps) {
  const { colors, isDark } = useAppTheme();
  const scale = useSharedValue(1);

  const sizeConfig = SIZE_CONFIG[size];
  const canAfford = balance >= item.priceTokens;
  const isOwned = owned || item.owned;
  const isNew = isItemNew(item);
  const onSale = hasDiscount(item);
  const limited = isLimited(item);
  const rarityColor = getRarityColor(item.rarity);

  // Animation styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Handle press in/out
  const handlePressIn = () => {
    scale.value = withSpring(0.95, SPRING_CONFIG);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  // Handle press
  const handlePress = () => {
    if (!isOwned) {
      onPress?.(item);
    }
  };

  // Render status badges
  const renderBadges = () => {
    const badges: Array<{
      label: string;
      color: string;
      icon?: keyof typeof MaterialCommunityIcons.glyphMap;
    }> = [];

    if (isNew) {
      badges.push({
        label: "NEW",
        color: SHOP_COLORS.badges.new,
        icon: "star",
      });
    }
    if (onSale) {
      badges.push({
        label: `-${item.discountPercent}%`,
        color: SHOP_COLORS.badges.sale,
        icon: "tag",
      });
    }
    if (limited) {
      badges.push({
        label: "LIMITED",
        color: SHOP_COLORS.badges.limited,
        icon: "clock-outline",
      });
    }
    if (item.shopExclusive) {
      badges.push({
        label: "EXCLUSIVE",
        color: SHOP_COLORS.badges.exclusive,
        icon: "diamond",
      });
    }

    if (badges.length === 0) return null;

    return (
      <View style={styles.badgesContainer}>
        {badges.slice(0, 2).map((badge, index) => (
          <View
            key={badge.label}
            style={[styles.badge, { backgroundColor: badge.color }]}
          >
            {badge.icon && (
              <MaterialCommunityIcons
                name={badge.icon}
                size={10}
                color="#FFF"
              />
            )}
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Render rarity indicator
  const renderRarityIndicator = () => (
    <View
      style={[styles.rarityIndicator, { backgroundColor: rarityColor + "30" }]}
    >
      <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
      <Text style={[styles.rarityText, { color: rarityColor }]}>
        {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
      </Text>
    </View>
  );

  // Render price
  const renderPrice = () => {
    if (isOwned) {
      return (
        <View style={styles.ownedContainer}>
          <MaterialCommunityIcons
            name="check-circle"
            size={sizeConfig.iconSize}
            color={SHOP_COLORS.badges.new}
          />
          <Text style={[styles.ownedText, { color: SHOP_COLORS.badges.new }]}>
            Owned
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.priceContainer}>
        {onSale && item.originalPrice && (
          <Text
            style={[
              styles.originalPrice,
              { color: colors.textMuted, fontSize: sizeConfig.fontSize - 2 },
            ]}
          >
            {item.originalPrice.toLocaleString()}
          </Text>
        )}
        <View style={[styles.priceRow, !canAfford && styles.priceRowDisabled]}>
          <MaterialCommunityIcons
            name="star-circle"
            size={sizeConfig.iconSize}
            color={canAfford ? "#FFD700" : colors.textMuted}
          />
          <Text
            style={[
              styles.priceText,
              {
                color: canAfford ? colors.text : colors.textMuted,
                fontSize: sizeConfig.fontSize,
              },
            ]}
          >
            {item.priceTokens.toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isOwned}
        style={[
          styles.container,
          {
            width: sizeConfig.width,
            backgroundColor: colors.surface,
            borderColor: isOwned
              ? SHOP_COLORS.badges.new + "50"
              : colors.border,
          },
          isOwned && styles.containerOwned,
        ]}
      >
        {/* Image/Preview Section */}
        <View
          style={[
            styles.imageContainer,
            {
              height: sizeConfig.imageHeight,
              backgroundColor: colors.surfaceVariant,
            },
          ]}
        >
          {/* Rarity gradient overlay */}
          <LinearGradient
            colors={[`${rarityColor}10`, `${rarityColor}30`]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Placeholder for actual item image */}
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons
              name={getItemIcon(item.slot)}
              size={sizeConfig.imageHeight * 0.5}
              color={rarityColor}
            />
          </View>

          {/* Badges */}
          {renderBadges()}

          {/* Owned overlay */}
          {isOwned && (
            <View style={styles.ownedOverlay}>
              <MaterialCommunityIcons
                name="check-circle"
                size={32}
                color="#FFF"
              />
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoContainer}>
          {/* Name */}
          <Text
            numberOfLines={compact ? 1 : 2}
            style={[
              styles.name,
              { color: colors.text, fontSize: sizeConfig.fontSize },
            ]}
          >
            {item.name}
          </Text>

          {/* Rarity indicator */}
          {!compact && renderRarityIndicator()}

          {/* Price */}
          {renderPrice()}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Get icon for item slot
 */
function getItemIcon(
  slot: string,
): keyof typeof MaterialCommunityIcons.glyphMap {
  const icons: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
    hat: "hat-fedora",
    glasses: "glasses",
    background: "image",
    clothing_top: "tshirt-crew",
    clothing_bottom: "human-male-height",
    accessory_neck: "necklace",
    accessory_ear: "earbuds",
    accessory_hand: "hand-back-right",
    profile_frame: "card-bulleted-outline",
    profile_banner: "flag-variant",
    profile_theme: "palette",
    chat_bubble: "message-text",
    name_effect: "text-shadow",
  };
  return icons[slot] || "help-circle-outline";
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    margin: 6,
  },
  containerOwned: {
    borderWidth: 2,
    opacity: 0.85,
  },
  imageContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  badgesContainer: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "column",
    gap: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  badgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "700",
  },
  ownedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 200, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  infoContainer: {
    padding: 10,
    gap: 6,
  },
  name: {
    fontWeight: "600",
    lineHeight: 18,
  },
  rarityIndicator: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  rarityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  priceContainer: {
    gap: 2,
  },
  originalPrice: {
    textDecorationLine: "line-through",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priceRowDisabled: {
    opacity: 0.6,
  },
  priceText: {
    fontWeight: "700",
  },
  ownedContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ownedText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

// =============================================================================
// Export
// =============================================================================

export const ShopItemCard = memo(ShopItemCardComponent);
