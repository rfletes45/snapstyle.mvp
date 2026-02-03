/**
 * PremiumBundleCard Component
 *
 * Displays a premium bundle for purchase in the shop.
 * Shows included items, value savings, and price.
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
  withSpring,
} from "react-native-reanimated";

import type { PremiumBundle } from "@/types/shop";
import { RARITY_COLORS } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

export interface PremiumBundleCardProps {
  /** The bundle to display */
  bundle: PremiumBundle;
  /** Handler for purchase */
  onPress: () => void;
  /** Whether purchase is in progress */
  purchasing?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Theme gradients for bundles
const BUNDLE_THEMES: Record<string, readonly [string, string, ...string[]]> = {
  starter: ["#4CAF50", "#2E7D32"],
  premium: ["#9C27B0", "#6A1B9A"],
  legendary: ["#FF9800", "#E65100"],
  mythic: ["#E91E63", "#880E4F"],
  default: ["#2196F3", "#1565C0"],
};

// =============================================================================
// Component
// =============================================================================

function PremiumBundleCardBase({
  bundle,
  onPress,
  purchasing = false,
}: PremiumBundleCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  // Get gradient based on bundle theme
  const gradientColors = BUNDLE_THEMES[bundle.theme] || BUNDLE_THEMES.default;

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Handle press in/out for animation
  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  // Format price
  const formatPrice = (price: number) =>
    bundle.localizedPrice || `$${price.toFixed(2)}`;

  return (
    <AnimatedPressable
      style={[styles.card, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={purchasing || bundle.owned}
    >
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Badge */}
        {bundle.featured && (
          <View style={styles.featuredBadge}>
            <MaterialCommunityIcons name="star" size={12} color="#FFD700" />
            <Text style={styles.badgeText}>Featured</Text>
          </View>
        )}

        {/* Owned badge */}
        {bundle.owned && (
          <View style={[styles.featuredBadge, styles.ownedBadge]}>
            <MaterialCommunityIcons
              name="check-circle"
              size={12}
              color="#fff"
            />
            <Text style={styles.badgeText}>Owned</Text>
          </View>
        )}

        {/* Limited time badge */}
        {bundle.limitedTime && !bundle.owned && (
          <View style={[styles.featuredBadge, styles.limitedBadge]}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={12}
              color="#fff"
            />
            <Text style={styles.badgeText}>Limited</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.bundleName}>{bundle.name}</Text>
            <Text style={styles.bundleDescription} numberOfLines={2}>
              {bundle.description}
            </Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{formatPrice(bundle.basePriceUSD)}</Text>
            {bundle.savingsPercent > 0 && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>
                  Save {bundle.savingsPercent}%
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Items preview */}
        <View style={styles.itemsContainer}>
          <Text style={styles.itemsTitle}>Includes:</Text>
          <View style={styles.itemsList}>
            {bundle.items.slice(0, 4).map((item, index) => (
              <View
                key={item.itemId}
                style={[
                  styles.itemPreview,
                  { borderColor: RARITY_COLORS[item.rarity] || "#9E9E9E" },
                ]}
              >
                <Text style={styles.itemEmoji}>{item.imagePath || "🎁"}</Text>
              </View>
            ))}
            {bundle.items.length > 4 && (
              <View style={styles.moreItems}>
                <Text style={styles.moreItemsText}>
                  +{bundle.items.length - 4}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bonus tokens */}
        {bundle.bonusTokens > 0 && (
          <View style={styles.bonusContainer}>
            <MaterialCommunityIcons name="gold" size={16} color="#FFD700" />
            <Text style={styles.bonusText}>
              +{bundle.bonusTokens.toLocaleString()} Bonus Tokens
            </Text>
          </View>
        )}

        {/* Value indicator */}
        <View style={styles.valueContainer}>
          <Text style={styles.valueLabel}>Value:</Text>
          <Text style={styles.valueAmount}>${bundle.valueUSD.toFixed(2)}</Text>
          {bundle.savingsPercent > 0 && (
            <Text style={styles.valueSavings}>
              (Save ${(bundle.valueUSD - bundle.basePriceUSD).toFixed(2)})
            </Text>
          )}
        </View>

        {/* Purchase button */}
        <View style={styles.buttonContainer}>
          <View
            style={[
              styles.purchaseButton,
              bundle.owned && styles.purchaseButtonDisabled,
            ]}
          >
            {purchasing ? (
              <Text style={styles.buttonText}>Purchasing...</Text>
            ) : bundle.owned ? (
              <Text style={styles.buttonText}>Purchased</Text>
            ) : (
              <Text style={styles.buttonText}>
                Buy Now • {formatPrice(bundle.basePriceUSD)}
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  gradient: {
    padding: 16,
    position: "relative",
  },
  featuredBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ownedBadge: {
    backgroundColor: "rgba(76,175,80,0.8)",
  },
  limitedBadge: {
    backgroundColor: "rgba(255,152,0,0.8)",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  bundleName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  bundleDescription: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 18,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  price: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
  },
  savingsBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  savingsText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 12,
  },
  itemsContainer: {
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
    fontWeight: "600",
  },
  itemsList: {
    flexDirection: "row",
    gap: 8,
  },
  itemPreview: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  itemEmoji: {
    fontSize: 20,
  },
  moreItems: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreItemsText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  bonusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginBottom: 12,
  },
  bonusText: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "600",
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  valueLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  valueAmount: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "line-through",
    textDecorationStyle: "solid",
  },
  valueSavings: {
    color: "#4CAF50",
    fontSize: 12,
    fontWeight: "600",
  },
  buttonContainer: {
    marginTop: 4,
  },
  purchaseButton: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  purchaseButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export const PremiumBundleCard = memo(PremiumBundleCardBase);
export default PremiumBundleCard;
