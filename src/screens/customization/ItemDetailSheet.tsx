/**
 * ItemDetailSheet
 *
 * Modal overlay that displays details for a single cosmetic item.
 * Shows:
 *   - Preview image (if asset-backed)
 *   - Name, description, rarity
 *   - Ownership status
 *   - Equip / Unequip button (if owned)
 *   - Achievement hint (if source === "achievement")
 *
 * All purchasing is handled in the Shop tab — this sheet is equip-only.
 *
 * @module screens/customization/ItemDetailSheet
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Chip, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Spacing } from "@/constants/theme";
import { getCosmeticAsset, hasCosmeticAsset } from "@/cosmetics/assetRegistry";
import type { CosmeticDefinition, CosmeticType } from "@/cosmetics/types";
import { useColors } from "@/store/ThemeContext";

// =============================================================================
// Types
// =============================================================================

export interface ItemDetailSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** The cosmetic item to display */
  item: CosmeticDefinition | null;
  /** Whether the current user owns this item */
  isOwned: boolean;
  /** Whether this item is currently equipped */
  isEquipped: boolean;
  /** Close handler */
  onClose: () => void;
  /** Equip handler */
  onEquip: (item: CosmeticDefinition) => void;
  /** Unequip handler */
  onUnequip: (type: CosmeticType) => void;
  /** Preview (try-on) handler */
  onPreview: (item: CosmeticDefinition) => void;
}

// =============================================================================
// Rarity Config
// =============================================================================

const RARITY_COLORS: Record<string, string> = {
  common: "#9E9E9E",
  uncommon: "#4CAF50",
  rare: "#2196F3",
  epic: "#9C27B0",
  legendary: "#FF9800",
  mythic: "#F44336",
};

const SOURCE_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  shop: "Shop",
  achievement: "Achievement",
  milestone: "Milestone",
  event: "Event",
  exclusive: "Exclusive",
  grant: "Admin Grant",
};

// =============================================================================
// Component
// =============================================================================

function ItemDetailSheetBase({
  visible,
  item,
  isOwned,
  isEquipped,
  onClose,
  onEquip,
  onUnequip,
  onPreview,
}: ItemDetailSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (!item) return null;

  const hasAsset = hasCosmeticAsset(item.type, item.assetKey ?? item.id);
  const assetSource = hasAsset
    ? getCosmeticAsset(item.type, item.assetKey ?? item.id)
    : null;

  const rarityColor = RARITY_COLORS[item.rarity] ?? colors.textSecondary;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              maxHeight: Dimensions.get("window").height * 0.8,
            },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View
              style={[
                styles.handle,
                { backgroundColor: colors.textSecondary + "40" },
              ]}
            />
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: insets.bottom + Spacing.lg,
            }}
          >
            {/* Item Preview */}
            <View style={styles.previewSection}>
              {assetSource ? (
                <Image
                  source={assetSource}
                  style={[
                    styles.previewImage,
                    item.type === "background" && styles.previewImageWide,
                  ]}
                  resizeMode="contain"
                />
              ) : (
                <View
                  style={[
                    styles.previewPlaceholder,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      item.type === "badge"
                        ? "shield-star"
                        : item.type === "theme"
                          ? "palette"
                          : "image"
                    }
                    size={48}
                    color={colors.textSecondary}
                  />
                </View>
              )}
            </View>

            {/* Item Info */}
            <View style={styles.infoSection}>
              <Text
                style={[styles.itemName, { color: colors.text }]}
                numberOfLines={2}
              >
                {item.name}
              </Text>

              <View style={styles.chipRow}>
                <Chip
                  compact
                  textStyle={{
                    color: rarityColor,
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                  style={[
                    styles.rarityChip,
                    { backgroundColor: rarityColor + "18" },
                  ]}
                >
                  {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                </Chip>
                <Chip
                  compact
                  textStyle={{ color: colors.textSecondary, fontSize: 11 }}
                  style={[
                    styles.sourceChip,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  {SOURCE_LABELS[item.source] ?? item.source}
                </Chip>
              </View>

              <Text
                style={[styles.description, { color: colors.textSecondary }]}
                numberOfLines={3}
              >
                {item.description}
              </Text>

              {/* Achievement hint */}
              {item.source === "achievement" && !isOwned && (
                <View
                  style={[
                    styles.hintRow,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="trophy-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.hintText, { color: colors.textSecondary }]}
                  >
                    Earn this by completing an achievement
                  </Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actionsSection}>
              {/* Try-On button (for decorations and backgrounds) */}
              {(item.type === "decoration" || item.type === "background") && (
                <Button
                  mode="outlined"
                  onPress={() => {
                    onPreview(item);
                    onClose();
                  }}
                  style={styles.actionButton}
                >
                  Try On
                </Button>
              )}

              {isOwned ? (
                isEquipped ? (
                  <Button
                    mode="outlined"
                    onPress={() => onUnequip(item.type)}
                    style={styles.actionButton}
                    textColor={colors.error}
                  >
                    Unequip
                  </Button>
                ) : (
                  <Button
                    mode="contained"
                    onPress={() => onEquip(item)}
                    style={styles.actionButton}
                  >
                    Equip
                  </Button>
                )
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropTouch: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
  },
  handleRow: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  previewSection: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.md,
  },
  previewImageWide: {
    width: 200,
    height: 120,
    borderRadius: BorderRadius.md,
  },
  previewPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  infoSection: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  itemName: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  rarityChip: {
    // Let Chip auto-size vertically to avoid text clipping
  },
  sourceChip: {
    // Let Chip auto-size vertically to avoid text clipping
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  hintText: {
    fontSize: 13,
  },
  actionsSection: {
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  actionButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
  },
});

// =============================================================================
// Export
// =============================================================================

export const ItemDetailSheet = memo(ItemDetailSheetBase);
export default ItemDetailSheet;
