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
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

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

function UnifiedShopItemCardImpl({
  item,
  state,
  colors,
  onPress,
  badge,
}: UnifiedShopItemCardProps) {
  const asset = getCosmeticAsset(item.type, item.assetKey ?? item.id);
  const rarity = item.rarity;
  const rarityColor = RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
  const swatchColor =
    typeof item.metadata?.bubbleColorValue === "string"
      ? (item.metadata.bubbleColorValue as string)
      : null;

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
    if (state === "equipped") return colors.surfaceVariant;
    if (state === "owned") return colors.primary;
    if (state === "insufficient") return colors.surfaceVariant;
    return colors.primary;
  })();

  const actionFg = (() => {
    if (state === "equipped") return colors.textSecondary;
    if (state === "owned") return colors.onPrimary ?? "#fff";
    if (state === "insufficient") return colors.textMuted;
    return colors.onPrimary ?? "#fff";
  })();

  return (
    <Pressable
      onPress={() => onPress(item)}
      android_ripple={{ color: colors.surfaceVariant }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${RARITY_LABELS[rarity]}, ${
        item.priceTokens ?? 0
      } tokens, ${actionLabel}`}
    >
      {/* Preview */}
      <View
        style={[
          styles.previewBox,
          { backgroundColor: colors.surfaceVariant, borderColor: rarityColor },
        ]}
      >
        {swatchColor ? (
          <View style={[styles.swatch, { backgroundColor: swatchColor }]} />
        ) : asset ? (
          <Image
            source={asset}
            style={styles.previewImage}
            resizeMode="cover"
          />
        ) : (
          <MaterialCommunityIcons
            name="image-off-outline"
            size={28}
            color={colors.textMuted}
          />
        )}

        {/* Badge */}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: rarityColor }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}

        {/* Equipped overlay */}
        {state === "equipped" ? (
          <View style={styles.equippedOverlay}>
            <MaterialCommunityIcons
              name="check-circle"
              size={28}
              color="#fff"
            />
          </View>
        ) : null}
      </View>

      {/* Name + rarity */}
      <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
        {item.name}
      </Text>
      <Text numberOfLines={1} style={[styles.rarity, { color: rarityColor }]}>
        {RARITY_LABELS[rarity]}
      </Text>

      {/* Price + action */}
      <View style={styles.actionRow}>
        <View style={styles.priceRow}>
          <MaterialCommunityIcons
            name="star-circle"
            size={14}
            color="#FFD700"
          />
          <Text style={[styles.price, { color: colors.text }]}>
            {(item.priceTokens ?? 0).toLocaleString()}
          </Text>
        </View>
        <View style={[styles.actionPill, { backgroundColor: actionBg }]}>
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
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 6,
  },
  previewBox: {
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  swatch: {
    width: "70%",
    height: "70%",
    borderRadius: 12,
  },
  badge: {
    position: "absolute",
    top: 6,
    left: 6,
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
  equippedOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  rarity: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  price: {
    fontSize: 13,
    fontWeight: "700",
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  actionText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
