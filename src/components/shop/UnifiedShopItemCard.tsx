/**
 * UnifiedShopItemCard
 *
 * Item card for the unified Shop screen. Shows preview, name, rarity,
 * token price, and an action button reflecting owned/equipped/buy state.
 *
 * @module components/shop/UnifiedShopItemCard
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CosmeticImage } from "@/components/CosmeticImage";
import {
  BubbleColorPreviewSurface,
  ThemeModeBadge,
  ThemePreviewSurface,
  getBubblePreviewColor,
  getThemePreviewMeta,
} from "@/components/customization/CosmeticPreviewSurfaces";
import { BorderRadius, Spacing } from "@/constants/theme";
import { getCosmeticAsset } from "@/cosmetics/assetRegistry";
import type { CosmeticDefinition, CosmeticRarity } from "@/cosmetics/types";
import type { ThemeColors } from "@/store/ThemeContext";

// =============================================================================
// Constants
// =============================================================================

const RARITY_COLORS: Record<CosmeticRarity, string> = {
  common: "#95A5A6",
  uncommon: "#27AE60",
  rare: "#3498DB",
  epic: "#9B59B6",
  legendary: "#FFD700",
  mythic: "#FF4081",
};

const RARITY_LABELS: Record<CosmeticRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

const IMAGE_LABEL_SURFACE_ALPHA = "E6";
const IMAGE_ACTION_SURFACE_ALPHA = "E8";

function withColorAlpha(color: string, alphaHex: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return `${color}${alphaHex}`;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const [, r, g, b] = color;
    return `#${r}${r}${g}${g}${b}${b}${alphaHex}`;
  }
  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch[1].split(",").map((part) => part.trim());
    const alpha = Math.round((parseInt(alphaHex, 16) / 255) * 100) / 100;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

// =============================================================================
// Types
// =============================================================================

export type ItemActionState =
  | "buy"
  | "owned"
  | "equipped"
  | "insufficient"
  | "loading";

export interface UnifiedShopItemCardProps {
  item: CosmeticDefinition;
  state: ItemActionState;
  colors: ThemeColors;
  onPress: (item: CosmeticDefinition) => void;
  /** Optional badge (e.g., "LIMITED", "NEW") */
  badge?: string;
}

// =============================================================================
// Component
// =============================================================================

function ShopItemImageLabel({
  name,
  rarityLabel,
  rarityColor,
  colors,
}: {
  name: string;
  rarityLabel: string;
  rarityColor: string;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[
        styles.imageLabel,
        {
          backgroundColor: withColorAlpha(
            colors.surfaceElevated ?? colors.surface,
            IMAGE_LABEL_SURFACE_ALPHA,
          ),
          borderColor: colors.border,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.imageLabelName, { color: colors.text }]}
      >
        {name}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.imageLabelRarity, { color: rarityColor }]}
      >
        {rarityLabel}
      </Text>
    </View>
  );
}

function UnifiedShopItemCardImpl({
  item,
  state,
  colors,
  onPress,
  badge,
}: UnifiedShopItemCardProps) {
  const isTheme = item.type === "theme";
  const isBubbleColor = item.type === "chat_bubble_color";
  const asset = getCosmeticAsset(item.type, item.assetKey ?? item.id);
  const isDecoration = item.type === "decoration";
  const themeMeta = isTheme ? getThemePreviewMeta(item.id) : null;
  const bubbleColorHex = isBubbleColor ? getBubblePreviewColor(item) : null;
  const rarity = item.rarity;
  const rarityColor = RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
  const isOwnedLike = state === "owned" || state === "equipped";
  const usesCustomizePreview = isTheme || isBubbleColor;

  const actionLabel = (() => {
    switch (state) {
      case "owned":
        return "Equip";
      case "equipped":
        return "Equipped";
      case "insufficient":
        return "Need more";
      case "loading":
        return "...";
      case "buy":
      default:
        return `Buy`;
    }
  })();

  const actionIcon = (() => {
    switch (state) {
      case "equipped":
        return "check-circle";
      case "owned":
        return "check";
      case "insufficient":
        return "lock";
      case "buy":
      default:
        return "star-circle";
    }
  })();

  const actionBg = (() => {
    if (state === "equipped") return colors.primary + "18";
    if (state === "owned") return colors.primary;
    if (state === "insufficient") return colors.surfaceVariant;
    return colors.primary;
  })();

  const actionFg = (() => {
    if (state === "equipped") return colors.primary;
    if (state === "owned") return colors.onPrimary ?? "#fff";
    if (state === "insufficient") return colors.textMuted;
    return colors.onPrimary ?? "#fff";
  })();

  const actionBorder =
    state === "equipped" ? colors.primary + "35" : colors.border;
  const cardBorderColor = isOwnedLike
    ? colors.primary
    : usesCustomizePreview
      ? colors.border
      : rarityColor + "33";
  const previewBackgroundColor = colors.surfaceVariant ?? colors.surface;

  return (
    <Pressable
      onPress={() => onPress(item)}
      android_ripple={{ color: colors.surfaceVariant }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: cardBorderColor,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${RARITY_LABELS[rarity]}, ${
        item.priceTokens ?? 0
      } tokens, ${actionLabel}`}
    >
      {/* Preview */}
      <View
        style={[styles.previewBox, { backgroundColor: previewBackgroundColor }]}
      >
        {isOwnedLike ? (
          <View
            style={[styles.statusBadge, { backgroundColor: colors.primary }]}
          >
            <MaterialCommunityIcons
              name={state === "equipped" ? "check-circle" : "check"}
              size={11}
              color="#fff"
            />
          </View>
        ) : null}

        {themeMeta ? (
          <ThemePreviewSurface meta={themeMeta} variant="shopCard" />
        ) : bubbleColorHex ? (
          <BubbleColorPreviewSurface colorHex={bubbleColorHex} />
        ) : asset ? (
          <View
            style={[
              styles.previewMedia,
              isDecoration && styles.previewMediaDecoration,
            ]}
          >
            <CosmeticImage
              source={asset}
              style={styles.previewImage}
              contentFit={isDecoration ? "contain" : "cover"}
              recyclingKey={item.id}
              debugLabel={`shop-card-${item.id}`}
            />
          </View>
        ) : (
          <View style={styles.previewMedia}>
            <MaterialCommunityIcons
              name="image-off-outline"
              size={28}
              color={colors.textMuted}
            />
          </View>
        )}

        {/* Badge */}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: rarityColor }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}

        <ShopItemImageLabel
          name={item.name}
          rarityLabel={RARITY_LABELS[rarity]}
          rarityColor={rarityColor}
          colors={colors}
        />

        {/* Price + action */}
        <View style={styles.actionRow}>
          <View
            style={[
              styles.priceRow,
              {
                backgroundColor: withColorAlpha(
                  colors.surfaceVariant ?? colors.surface,
                  IMAGE_ACTION_SURFACE_ALPHA,
                ),
              },
            ]}
          >
            <MaterialCommunityIcons
              name="star-circle"
              size={14}
              color="#FFD700"
            />
            <Text style={[styles.price, { color: colors.text }]}>
              {(item.priceTokens ?? 0).toLocaleString()}
            </Text>
          </View>
          <View
            style={[
              styles.actionPill,
              {
                backgroundColor: actionBg,
                borderColor: actionBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={actionIcon as any}
              size={12}
              color={actionFg}
            />
            <Text style={[styles.actionText, { color: actionFg }]}>
              {actionLabel}
            </Text>
          </View>
        </View>
      </View>

      {themeMeta ? (
        <View style={styles.themeModeRow}>
          <ThemeModeBadge isDark={themeMeta.isDark} colors={colors} />
        </View>
      ) : null}
    </Pressable>
  );
}

export const UnifiedShopItemCard = memo(UnifiedShopItemCardImpl);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  previewBox: {
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  previewMedia: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  previewMediaDecoration: {
    padding: Spacing.sm,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  imageLabel: {
    position: "absolute",
    top: 0,
    left: 0,
    maxWidth: "72%",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: BorderRadius.md,
    zIndex: 3,
  },
  imageLabelName: {
    fontSize: 12,
    fontWeight: "700",
  },
  imageLabelRarity: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  badge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  themeModeRow: {
    minHeight: 22,
    justifyContent: "center",
  },
  actionRow: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.xs,
    zIndex: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  price: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
