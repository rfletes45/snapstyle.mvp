/**
 * PremiumBundleCard Component
 *
 * Displays a premium bundle for purchase in the shop.
 * Shows included items with larger previews, value savings, and price.
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 7
 */

import AppImage from "@/components/AppImage";
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
  bundle: PremiumBundle;
  onPress: () => void;
  purchasing?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const BUNDLE_THEMES: Record<string, readonly [string, string, ...string[]]> = {
  starter: ["#388E3C", "#1B5E20"],
  premium: ["#8E24AA", "#4A148C"],
  legendary: ["#EF6C00", "#BF360C"],
  mythic: ["#C2185B", "#880E4F"],
  default: ["#1565C0", "#0D47A1"],
};

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

function PremiumBundleCardBase({
  bundle,
  onPress,
  purchasing = false,
}: PremiumBundleCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const gradientColors = BUNDLE_THEMES[bundle.theme] || BUNDLE_THEMES.default;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

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
        {/* Top badges row */}
        <View style={styles.topBadges}>
          {bundle.featured && !bundle.owned && (
            <View style={styles.featuredBadge}>
              <MaterialCommunityIcons name="star" size={12} color="#FFD700" />
              <Text style={styles.badgeText}>Featured</Text>
            </View>
          )}
          {bundle.owned && (
            <View style={[styles.featuredBadge, styles.ownedBadge]}>
              <MaterialCommunityIcons name="check-circle" size={12} color="#fff" />
              <Text style={styles.badgeText}>Owned</Text>
            </View>
          )}
          {bundle.limitedTime && !bundle.owned && (
            <View style={[styles.featuredBadge, styles.limitedBadge]}>
              <MaterialCommunityIcons name="clock-outline" size={12} color="#fff" />
              <Text style={styles.badgeText}>Limited Time</Text>
            </View>
          )}
          {bundle.savingsPercent > 0 && (
            <View style={styles.savingsPill}>
              <Text style={styles.savingsPillText}>Save {bundle.savingsPercent}%</Text>
            </View>
          )}
        </View>

        {/* Header: Name + Price */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.bundleName}>{bundle.name}</Text>
            <Text style={styles.bundleDescription} numberOfLines={2}>
              {bundle.description}
            </Text>
          </View>
          <View style={styles.priceBlock}>
            <Text style={styles.price}>{formatPrice(bundle.basePriceUSD)}</Text>
            {bundle.savingsPercent > 0 && (
              <Text style={styles.valueStrikethrough}>
                ${bundle.valueUSD.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Items showcase */}
        <View style={styles.itemsSection}>
          <Text style={styles.itemsSectionLabel}>
            {bundle.items.length} Items Included
          </Text>
          <View style={styles.itemsGrid}>
            {bundle.items.slice(0, 5).map((item) => {
              const borderColor = RARITY_COLORS[item.rarity] || "#9E9E9E";
              const hasImage = isImageUri(item.imagePath);
              return (
                <View key={item.itemId} style={styles.itemSlot}>
                  <View
                    style={[
                      styles.itemPreviewFrame,
                      { borderColor: borderColor + "70" },
                    ]}
                  >
                    <LinearGradient
                      colors={[borderColor + "20", "rgba(0,0,0,0.2)"]}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                    />
                    {hasImage ? (
                      <AppImage
                        source={{ uri: item.imagePath }}
                        style={styles.itemPreviewImage}
                        contentFit="contain"
                        debugLabel="BundleItem"
                      />
                    ) : (
                      <Text style={styles.itemEmoji}>{item.imagePath || "\u{1F381}"}</Text>
                    )}
                  </View>
                  <Text style={styles.itemSlotName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              );
            })}
            {bundle.items.length > 5 && (
              <View style={styles.itemSlot}>
                <View style={[styles.itemPreviewFrame, styles.moreItemsFrame]}>
                  <Text style={styles.moreItemsText}>
                    +{bundle.items.length - 5}
                  </Text>
                </View>
                <Text style={styles.itemSlotName}>more</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bonus tokens */}
        {bundle.bonusTokens > 0 && (
          <View style={styles.bonusRow}>
            <MaterialCommunityIcons name="gold" size={16} color="#FFD700" />
            <Text style={styles.bonusText}>
              +{bundle.bonusTokens.toLocaleString()} Bonus Tokens
            </Text>
          </View>
        )}

        {/* Purchase CTA */}
        <View style={styles.ctaContainer}>
          <LinearGradient
            colors={
              bundle.owned
                ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.05)"]
                : ["rgba(255,255,255,0.28)", "rgba(255,255,255,0.12)"]
            }
            style={styles.ctaButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {purchasing ? (
              <Text style={styles.ctaText}>Purchasing...</Text>
            ) : bundle.owned ? (
              <>
                <MaterialCommunityIcons name="check" size={18} color="rgba(255,255,255,0.5)" />
                <Text style={[styles.ctaText, { color: "rgba(255,255,255,0.5)" }]}>
                  Purchased
                </Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="diamond-stone" size={16} color="#fff" />
                <Text style={styles.ctaText}>
                  Buy Now {"\u2022"} {formatPrice(bundle.basePriceUSD)}
                </Text>
              </>
            )}
          </LinearGradient>
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gradient: {
    padding: 18,
    position: "relative",
  },

  // Top badges
  topBadges: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  ownedBadge: {
    backgroundColor: "rgba(76,175,80,0.7)",
  },
  limitedBadge: {
    backgroundColor: "rgba(230,81,0,0.7)",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  savingsPill: {
    backgroundColor: "#43A047",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  savingsPillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  bundleName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  bundleDescription: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
  },
  priceBlock: {
    alignItems: "flex-end",
  },
  price: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
  },
  valueStrikethrough: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    textDecorationLine: "line-through",
    marginTop: 2,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 14,
  },

  // Items showcase
  itemsSection: {
    marginBottom: 14,
  },
  itemsSectionLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  itemsGrid: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  itemSlot: {
    alignItems: "center",
    width: 62,
  },
  itemPreviewFrame: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  itemPreviewImage: {
    width: 42,
    height: 42,
  },
  itemEmoji: {
    fontSize: 26,
  },
  itemSlotName: {
    fontSize: 9,
    color: "rgba(255,255,255,0.55)",
    marginTop: 4,
    textAlign: "center",
    fontWeight: "500",
  },
  moreItemsFrame: {
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  moreItemsText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontWeight: "700",
  },

  // Bonus tokens
  bonusRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    gap: 6,
    marginBottom: 14,
  },
  bonusText: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "700",
  },

  // CTA
  ctaContainer: {
    marginTop: 2,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

export const PremiumBundleCard = memo(PremiumBundleCardBase);
export default PremiumBundleCard;
