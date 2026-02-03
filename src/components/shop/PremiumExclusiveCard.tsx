/**
 * PremiumExclusiveCard Component
 *
 * Displays a premium exclusive item for purchase in the shop.
 * These items can only be purchased with real money (not tokens).
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 7
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import type { PremiumExclusiveItem } from "@/types/shop";
import { RARITY_COLORS, SHOP_COLORS } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

export interface PremiumExclusiveCardProps {
  /** The exclusive item to display */
  item: PremiumExclusiveItem;
  /** Handler for purchase */
  onPress: () => void;
  /** Whether purchase is in progress */
  purchasing?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Rarity gradients
const RARITY_GRADIENTS: Record<string, readonly [string, string, ...string[]]> =
  {
    legendary: ["#FF9800", "#E65100", "#FF9800"],
    mythic: ["#E91E63", "#9C27B0", "#E91E63"],
  };

// =============================================================================
// Component
// =============================================================================

function PremiumExclusiveCardBase({
  item,
  onPress,
  purchasing = false,
}: PremiumExclusiveCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);

  // Get gradient based on rarity
  const gradientColors =
    RARITY_GRADIENTS[item.rarity] || RARITY_GRADIENTS.legendary;
  const rarityColor = RARITY_COLORS[item.rarity] || RARITY_COLORS.legendary;

  // Start glow animation for mythic items
  React.useEffect(() => {
    if (item.rarity === "mythic") {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 }),
          withTiming(0.5, { duration: 1000 }),
        ),
        -1,
        true,
      );
    }
  }, [item.rarity, glowOpacity]);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Handle press in/out for animation
  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  // Format price
  const formatPrice = (price: number) =>
    item.localizedPrice || `$${price.toFixed(2)}`;

  // Calculate remaining for limited edition
  const remainingText =
    item.limitedEdition && item.totalSupply && item.remaining !== undefined
      ? `${item.remaining}/${item.totalSupply} left`
      : null;

  return (
    <AnimatedPressable
      style={[styles.card, animatedStyle, { borderColor: rarityColor + "60" }]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={purchasing || item.owned}
    >
      {/* Glow effect for mythic */}
      {item.rarity === "mythic" && (
        <Animated.View
          style={[
            styles.glowEffect,
            { backgroundColor: rarityColor },
            glowStyle,
          ]}
        />
      )}

      {/* Background gradient */}
      <LinearGradient
        colors={[rarityColor + "30", rarityColor + "10"]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Badges */}
        <View style={styles.badgesContainer}>
          {/* Premium exclusive badge */}
          <View
            style={[
              styles.badge,
              { backgroundColor: SHOP_COLORS.premium.primary },
            ]}
          >
            <MaterialCommunityIcons name="diamond" size={10} color="#fff" />
            <Text style={styles.badgeText}>Premium</Text>
          </View>

          {/* Rarity badge */}
          <View style={[styles.badge, { backgroundColor: rarityColor }]}>
            <Text style={styles.badgeText}>
              {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
            </Text>
          </View>
        </View>

        {/* Limited edition badge */}
        {item.limitedEdition && (
          <View style={styles.limitedBadge}>
            <MaterialCommunityIcons
              name="timer-sand"
              size={12}
              color="#FF9800"
            />
            <Text style={styles.limitedText}>Limited Edition</Text>
          </View>
        )}

        {/* Owned badge */}
        {item.owned && (
          <View style={styles.ownedOverlay}>
            <MaterialCommunityIcons
              name="check-circle"
              size={32}
              color="#4CAF50"
            />
            <Text style={styles.ownedText}>Owned</Text>
          </View>
        )}

        {/* Item image */}
        <View style={styles.imageContainer}>
          <Text style={styles.itemEmoji}>{item.imagePath || "💎"}</Text>
        </View>

        {/* Item info */}
        <Text
          style={[styles.itemName, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>

        <Text
          style={[
            styles.itemDescription,
            { color: theme.colors.onSurfaceVariant },
          ]}
          numberOfLines={2}
        >
          {item.description}
        </Text>

        {/* Slot indicator */}
        <View style={styles.slotContainer}>
          <MaterialCommunityIcons
            name={getSlotIcon(item.slot)}
            size={14}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            style={[styles.slotText, { color: theme.colors.onSurfaceVariant }]}
          >
            {formatSlotName(item.slot)}
          </Text>
        </View>

        {/* Remaining count for limited editions */}
        {remainingText && (
          <View style={styles.remainingContainer}>
            <Text style={styles.remainingText}>{remainingText}</Text>
          </View>
        )}

        {/* Price */}
        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: rarityColor }]}>
            {formatPrice(item.basePriceUSD)}
          </Text>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function getSlotIcon(
  slot: string,
): keyof typeof MaterialCommunityIcons.glyphMap {
  const iconMap: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> =
    {
      hat: "hat-fedora",
      glasses: "glasses",
      background: "image",
      clothing_top: "tshirt-crew",
      clothing_bottom: "hanger",
      accessory_neck: "necklace",
      accessory_ear: "earbuds",
      accessory_hand: "hand-extended",
      profile_frame: "card-account-details-outline",
      profile_banner: "flag-variant",
      profile_theme: "palette",
      chat_bubble: "message",
      name_effect: "format-color-text",
    };
  return iconMap[slot] || "help-circle-outline";
}

function formatSlotName(slot: string): string {
  const nameMap: Record<string, string> = {
    hat: "Hat",
    glasses: "Glasses",
    background: "Background",
    clothing_top: "Top",
    clothing_bottom: "Bottom",
    accessory_neck: "Neck",
    accessory_ear: "Ear",
    accessory_hand: "Hand",
    profile_frame: "Frame",
    profile_banner: "Banner",
    profile_theme: "Theme",
    chat_bubble: "Bubble",
    name_effect: "Name Effect",
  };
  return nameMap[slot] || slot;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    width: 160,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  glowEffect: {
    position: "absolute",
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 36,
  },
  gradient: {
    padding: 12,
    position: "relative",
  },
  badgesContainer: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  limitedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  limitedText: {
    color: "#FF9800",
    fontSize: 9,
    fontWeight: "600",
  },
  ownedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    borderRadius: 14,
  },
  ownedText: {
    color: "#4CAF50",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  itemEmoji: {
    fontSize: 48,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  itemDescription: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    marginBottom: 8,
    minHeight: 28,
  },
  slotContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 8,
  },
  slotText: {
    fontSize: 10,
    fontWeight: "500",
  },
  remainingContainer: {
    backgroundColor: "rgba(255,152,0,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "center",
    marginBottom: 8,
  },
  remainingText: {
    color: "#FF9800",
    fontSize: 10,
    fontWeight: "600",
  },
  priceContainer: {
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
  },
});

export const PremiumExclusiveCard = memo(PremiumExclusiveCardBase);
export default PremiumExclusiveCard;
