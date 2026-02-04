/**
 * ShopBundleCard Component
 *
 * Displays a cosmetic bundle in the shop with:
 * - Bundle preview image and items
 * - Original price vs discounted price
 * - Savings percentage badge
 * - Limited-time/quantity indicators
 * - Purchase button
 *
 * @see src/data/cosmeticBundles.ts for bundle definitions
 */

import type { BundleWithStatus } from "@/services/bundles";
import { formatTimeRemaining } from "@/services/shop";
import { useColors } from "@/store/ThemeContext";
import { RARITY_COLORS } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useMemo } from "react";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 32;

export interface ShopBundleCardProps {
  /** Bundle data with user status */
  bundle: BundleWithStatus;
  /** User's token balance */
  tokenBalance: number;
  /** Handler for purchase press */
  onPurchase: (bundleId: string, method: "tokens" | "iap") => void;
  /** Handler for card press (to see details) */
  onPress?: (bundleId: string) => void;
  /** Compact mode for horizontal scroll */
  compact?: boolean;
}

function ShopBundleCardBase({
  bundle,
  tokenBalance,
  onPurchase,
  onPress,
  compact = false,
}: ShopBundleCardProps) {
  const theme = useTheme();
  const colors = useColors();
  const rarityColor = RARITY_COLORS[bundle.rarity] || "#9E9E9E";

  // Format prices
  const priceDisplay = useMemo(() => {
    if (bundle.priceTokens === 0) return "FREE";
    return `${bundle.priceTokens.toLocaleString()} 🪙`;
  }, [bundle.priceTokens]);

  const originalPriceDisplay = useMemo(() => {
    return `${bundle.originalPriceTokens.toLocaleString()} 🪙`;
  }, [bundle.originalPriceTokens]);

  const usdPriceDisplay = useMemo(() => {
    if (!bundle.priceUSD) return null;
    return `$${bundle.priceUSD.toFixed(2)}`;
  }, [bundle.priceUSD]);

  // Determine button state
  const buttonState = useMemo(() => {
    if (bundle.fullyOwned) {
      return {
        disabled: true,
        label: "Owned",
        color: theme.colors.surfaceVariant,
      };
    }
    if (!bundle.meetsRequirements && bundle.unlockRequirement) {
      return {
        disabled: true,
        label: "Locked",
        color: theme.colors.surfaceVariant,
      };
    }
    if (bundle.stockRemaining === 0) {
      return { disabled: true, label: "Sold Out", color: theme.colors.error };
    }
    if (bundle.timeRemaining === 0) {
      return { disabled: true, label: "Expired", color: theme.colors.error };
    }
    if (!bundle.canAffordTokens && !bundle.priceUSD) {
      return {
        disabled: true,
        label: "Not Enough Tokens",
        color: theme.colors.surfaceVariant,
      };
    }
    return {
      disabled: false,
      label: priceDisplay,
      color: theme.colors.primary,
    };
  }, [bundle, priceDisplay, theme]);

  // Get gradient colors based on rarity
  const gradientColors = useMemo((): readonly [string, string, ...string[]] => {
    const baseColor = rarityColor;
    return [baseColor + "40", baseColor + "10"];
  }, [rarityColor]);

  const renderCompact = () => (
    <TouchableOpacity
      style={[styles.compactCard, { borderColor: rarityColor }]}
      onPress={() => onPress?.(bundle.id)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={gradientColors}
        style={styles.compactGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Bundle Image/Emoji */}
        <Text style={styles.compactEmoji}>{bundle.imagePath}</Text>

        {/* Badge */}
        {bundle.badgeText && (
          <View
            style={[
              styles.compactBadge,
              { backgroundColor: bundle.highlightColor || rarityColor },
            ]}
          >
            <Text
              style={[styles.compactBadgeText, { color: colors.onPrimary }]}
            >
              {bundle.badgeText}
            </Text>
          </View>
        )}

        {/* Name */}
        <Text
          style={[styles.compactName, { color: theme.colors.onSurface }]}
          numberOfLines={2}
        >
          {bundle.name}
        </Text>

        {/* Price */}
        <View style={styles.compactPriceRow}>
          {bundle.discountPercent > 0 && (
            <Text
              style={[
                styles.compactOriginalPrice,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {originalPriceDisplay}
            </Text>
          )}
          <Text style={[styles.compactPrice, { color: rarityColor }]}>
            {priceDisplay}
          </Text>
        </View>

        {/* Discount Badge */}
        {bundle.discountPercent > 0 && (
          <View
            style={[styles.discountBadge, { backgroundColor: colors.success }]}
          >
            <Text style={[styles.discountText, { color: colors.onPrimary }]}>
              -{bundle.discountPercent}%
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  if (compact) {
    return renderCompact();
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: rarityColor,
        },
      ]}
      onPress={() => onPress?.(bundle.id)}
      activeOpacity={0.9}
    >
      {/* Header with gradient */}
      <LinearGradient
        colors={gradientColors}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Bundle Emoji/Image */}
        <Text style={styles.bundleEmoji}>{bundle.imagePath}</Text>

        {/* Badge Text */}
        {bundle.badgeText && (
          <View
            style={[
              styles.badge,
              { backgroundColor: bundle.highlightColor || rarityColor },
            ]}
          >
            <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
              {bundle.badgeText}
            </Text>
          </View>
        )}

        {/* Discount Badge */}
        {bundle.discountPercent > 0 && (
          <View
            style={[styles.discountBadge, { backgroundColor: colors.success }]}
          >
            <Text style={[styles.discountText, { color: colors.onPrimary }]}>
              -{bundle.discountPercent}%
            </Text>
          </View>
        )}

        {/* Limited indicators */}
        {(bundle.timeRemaining !== null || bundle.stockRemaining !== null) && (
          <View style={styles.limitedRow}>
            {bundle.timeRemaining !== null && bundle.timeRemaining > 0 && (
              <View style={styles.limitedBadge}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color={colors.onPrimary}
                />
                <Text style={[styles.limitedText, { color: colors.onPrimary }]}>
                  {formatTimeRemaining(bundle.timeRemaining)}
                </Text>
              </View>
            )}
            {bundle.stockRemaining !== null && (
              <View style={styles.limitedBadge}>
                <MaterialCommunityIcons
                  name="package-variant"
                  size={14}
                  color={colors.onPrimary}
                />
                <Text style={[styles.limitedText, { color: colors.onPrimary }]}>
                  {bundle.stockRemaining} left
                </Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {/* Title and Description */}
        <Text style={[styles.name, { color: theme.colors.onSurface }]}>
          {bundle.name}
        </Text>
        <Text
          style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
          numberOfLines={2}
        >
          {bundle.description}
        </Text>

        {/* Items Preview */}
        <View style={styles.itemsRow}>
          <Text
            style={[
              styles.itemsLabel,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Includes {bundle.items.length} items:
          </Text>
          <View style={styles.itemsPreview}>
            {bundle.items.slice(0, 5).map((item, index) => (
              <View
                key={item.cosmeticId}
                style={[
                  styles.itemBubble,
                  {
                    backgroundColor:
                      RARITY_COLORS[item.rarity] + "30" || "#9E9E9E30",
                    borderColor: bundle.ownedItems.includes(item.cosmeticId)
                      ? "#4CAF50"
                      : "transparent",
                  },
                ]}
              >
                <Text style={styles.itemEmoji}>{item.imagePath}</Text>
                {bundle.ownedItems.includes(item.cosmeticId) && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={12}
                    color="#4CAF50"
                    style={styles.ownedCheck}
                  />
                )}
              </View>
            ))}
            {bundle.items.length > 5 && (
              <View
                style={[
                  styles.itemBubble,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <Text
                  style={[
                    styles.moreText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  +{bundle.items.length - 5}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Owned items notice */}
        {bundle.ownedItems.length > 0 && !bundle.fullyOwned && (
          <View style={styles.ownedNotice}>
            <MaterialCommunityIcons
              name="information-outline"
              size={14}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.ownedNoticeText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              You already own {bundle.ownedItems.length} of{" "}
              {bundle.items.length} items
            </Text>
          </View>
        )}

        {/* Unlock requirement notice */}
        {bundle.unlockRequirement && !bundle.meetsRequirements && (
          <View
            style={[
              styles.requirementNotice,
              { backgroundColor: theme.colors.errorContainer },
            ]}
          >
            <MaterialCommunityIcons
              name="lock"
              size={14}
              color={theme.colors.error}
            />
            <Text
              style={[
                styles.requirementText,
                { color: theme.colors.onErrorContainer },
              ]}
            >
              {bundle.unlockRequirement.type === "achievement" &&
                `Requires: ${bundle.unlockRequirement.value}`}
              {bundle.unlockRequirement.type === "streak" &&
                `Requires: ${bundle.unlockRequirement.value}-day streak`}
              {bundle.unlockRequirement.type === "level" &&
                `Requires: Level ${bundle.unlockRequirement.value}`}
            </Text>
          </View>
        )}

        {/* Price Row */}
        <View style={styles.priceRow}>
          <View style={styles.priceColumn}>
            {bundle.discountPercent > 0 && (
              <Text
                style={[
                  styles.originalPrice,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {originalPriceDisplay}
              </Text>
            )}
            <Text style={[styles.price, { color: rarityColor }]}>
              {priceDisplay}
            </Text>
            {usdPriceDisplay && (
              <Text
                style={[
                  styles.usdPrice,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                or {usdPriceDisplay}
              </Text>
            )}
          </View>

          {/* Purchase Buttons */}
          <View style={styles.buttonColumn}>
            {!buttonState.disabled && (
              <>
                <Button
                  mode="contained"
                  onPress={() => onPurchase(bundle.id, "tokens")}
                  style={[styles.purchaseButton]}
                  buttonColor={theme.colors.primary}
                  disabled={!bundle.canAffordTokens}
                  compact
                >
                  Buy with 🪙
                </Button>
                {bundle.priceUSD && (
                  <Button
                    mode="outlined"
                    onPress={() => onPurchase(bundle.id, "iap")}
                    style={[styles.purchaseButton, styles.iapButton]}
                    compact
                  >
                    {usdPriceDisplay}
                  </Button>
                )}
              </>
            )}
            {buttonState.disabled && (
              <Button
                mode="contained"
                disabled
                style={styles.purchaseButton}
                buttonColor={buttonState.color}
                compact
              >
                {buttonState.label}
              </Button>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
    marginBottom: 16,
  },
  header: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bundleEmoji: {
    fontSize: 48,
  },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  discountBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountText: {
    fontSize: 12,
    fontWeight: "700",
  },
  limitedRow: {
    position: "absolute",
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
  },
  limitedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  limitedText: {
    fontSize: 11,
    fontWeight: "600",
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  itemsRow: {
    marginBottom: 12,
  },
  itemsLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  itemsPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  itemBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  itemEmoji: {
    fontSize: 20,
  },
  ownedCheck: {
    position: "absolute",
    bottom: -2,
    right: -2,
  },
  moreText: {
    fontSize: 12,
    fontWeight: "600",
  },
  ownedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  ownedNoticeText: {
    fontSize: 12,
  },
  requirementNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  requirementText: {
    fontSize: 12,
    fontWeight: "500",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  priceColumn: {
    flex: 1,
  },
  originalPrice: {
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  price: {
    fontSize: 22,
    fontWeight: "700",
  },
  usdPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  buttonColumn: {
    gap: 8,
  },
  purchaseButton: {
    minWidth: 120,
  },
  iapButton: {
    marginTop: 4,
  },

  // Compact card styles
  compactCard: {
    width: 140,
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
  },
  compactGradient: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  compactEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  compactBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  compactBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  compactName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  compactPriceRow: {
    alignItems: "center",
  },
  compactOriginalPrice: {
    fontSize: 10,
    textDecorationLine: "line-through",
  },
  compactPrice: {
    fontSize: 14,
    fontWeight: "700",
  },
});

export const ShopBundleCard = memo(ShopBundleCardBase);
export default ShopBundleCard;
