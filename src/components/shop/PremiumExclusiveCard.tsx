/**
 * PremiumExclusiveCard Component
 *
 * Displays a premium exclusive item for purchase in the shop.
 * Large, showcase-quality preview with premium framing.
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 7
 */

import AppImage from "@/components/AppImage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useState } from "react";
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
  item: PremiumExclusiveItem;
  onPress: () => void;
  purchasing?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const RARITY_GRADIENTS: Record<string, readonly [string, string, ...string[]]> = {
  common: ["#78909C", "#546E7A", "#78909C"],
  rare: ["#42A5F5", "#1565C0", "#42A5F5"],
  epic: ["#AB47BC", "#6A1B9A", "#AB47BC"],
  legendary: ["#FFA726", "#E65100", "#FFA726"],
  mythic: ["#EC407A", "#880E4F", "#EC407A"],
};

/** Check if a path looks like an actual image URI vs an emoji */
function isImageUri(path?: string): boolean {
  if (!path) return false;
  return (
    path.startsWith("http") ||
    path.startsWith("/") ||
    path.startsWith("file") ||
    path.includes(".png") ||
    path.includes(".jpg") ||
    path.includes(".webp") ||
    path.includes(".svg")
  );
}

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
  const glowOpacity = useSharedValue(0.4);
  const [imageError, setImageError] = useState(false);

  const gradientColors = RARITY_GRADIENTS[item.rarity] || RARITY_GRADIENTS.legendary;
  const rarityColor = RARITY_COLORS[item.rarity] || RARITY_COLORS.legendary;
  const hasRealImage = isImageUri(item.imagePath) && !imageError;

  // Glow animation for mythic/legendary items
  React.useEffect(() => {
    if (item.rarity === "mythic" || item.rarity === "legendary") {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1200 }),
          withTiming(0.3, { duration: 1200 }),
        ),
        -1,
        true,
      );
    }
  }, [item.rarity, glowOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const formatPrice = (price: number) =>
    item.localizedPrice || `$${price.toFixed(2)}`;

  const remainingText =
    item.limitedEdition && item.totalSupply && item.remaining !== undefined
      ? `${item.remaining}/${item.totalSupply} left`
      : null;

  return (
    <AnimatedPressable
      style={[styles.card, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={purchasing || item.owned}
    >
      {/* Outer glow for rare+ items */}
      {(item.rarity === "mythic" || item.rarity === "legendary") && (
        <Animated.View
          style={[styles.outerGlow, { backgroundColor: rarityColor }, glowStyle]}
        />
      )}

      {/* Card body with gradient */}
      <LinearGradient
        colors={[rarityColor + "20", "#0D0D1A"]}
        style={styles.cardGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        {/* === Preview showcase area === */}
        <View style={styles.previewArea}>
          {/* Ambient background glow */}
          <View style={[styles.previewGlow, { backgroundColor: rarityColor + "25" }]} />

          {/* Rarity ring */}
          <View style={[styles.previewRing, { borderColor: rarityColor + "40" }]}>
            {hasRealImage ? (
              <AppImage
                source={{ uri: item.imagePath }}
                style={styles.previewImage}
                contentFit="contain"
                debugLabel="PremiumExclusive"
                onError={() => setImageError(true)}
              />
            ) : (
              <Text style={styles.previewEmoji}>
                {item.imagePath || "\u{1F48E}"}
              </Text>
            )}
          </View>

          {/* Badges - top left */}
          <View style={styles.badgeRow}>
            <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
              <Text style={styles.rarityBadgeText}>
                {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
              </Text>
            </View>
          </View>

          {/* Limited edition badge - top right */}
          {item.limitedEdition && (
            <View style={styles.limitedBadge}>
              <MaterialCommunityIcons name="timer-sand" size={10} color="#FFA726" />
              <Text style={styles.limitedText}>Limited</Text>
            </View>
          )}

          {/* Owned overlay */}
          {item.owned && (
            <View style={styles.ownedOverlay}>
              <View style={styles.ownedBadge}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#66BB6A" />
                <Text style={styles.ownedText}>Owned</Text>
              </View>
            </View>
          )}
        </View>

        {/* === Item details === */}
        <View style={styles.detailsArea}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>

          <View style={styles.slotRow}>
            <MaterialCommunityIcons
              name={getSlotIcon(item.slot)}
              size={12}
              color="rgba(255,255,255,0.4)"
            />
            <Text style={styles.slotText}>{formatSlotName(item.slot)}</Text>
          </View>

          {remainingText && (
            <View style={styles.remainingPill}>
              <Text style={styles.remainingText}>{remainingText}</Text>
            </View>
          )}

          {/* Price row */}
          <View style={styles.priceRow}>
            <MaterialCommunityIcons name="diamond-stone" size={14} color={rarityColor} />
            <Text style={[styles.priceText, { color: rarityColor }]}>
              {formatPrice(item.basePriceUSD)}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getSlotIcon(slot: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const iconMap: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
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
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  outerGlow: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 28,
  },
  cardGradient: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },

  // Preview area
  previewArea: {
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  previewGlow: {
    position: "absolute",
    width: "80%",
    height: "80%",
    borderRadius: 999,
  },
  previewRing: {
    width: "70%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.04)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  previewImage: {
    width: "85%",
    height: "85%",
  },
  previewEmoji: {
    fontSize: 48,
  },

  // Badges
  badgeRow: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    gap: 4,
  },
  rarityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rarityBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  limitedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  limitedText: {
    color: "#FFA726",
    fontSize: 9,
    fontWeight: "700",
  },

  // Owned
  ownedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  ownedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(76,175,80,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(76,175,80,0.3)",
  },
  ownedText: {
    color: "#66BB6A",
    fontSize: 13,
    fontWeight: "700",
  },

  // Details
  detailsArea: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 4,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  slotText: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
  },
  remainingPill: {
    backgroundColor: "rgba(255,167,38,0.15)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  remainingText: {
    color: "#FFA726",
    fontSize: 10,
    fontWeight: "600",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  priceText: {
    fontSize: 16,
    fontWeight: "800",
  },
});

export const PremiumExclusiveCard = memo(PremiumExclusiveCardBase);
export default PremiumExclusiveCard;
