/**
 * DecorationPicker - Grid picker for selecting avatar decorations
 *
 * Displays all available/owned decorations in a grid format.
 * Allows users to preview and select decorations to equip.
 *
 * @module components/profile/ProfilePicture/DecorationPicker
 */

import {
  AVATAR_DECORATIONS,
  getDecorationsByCategory,
} from "@/data/avatarDecorations";
import type { AvatarDecoration, DecorationCategory } from "@/types/userProfile";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";

export interface DecorationPickerProps {
  /** IDs of decorations the user owns */
  ownedDecorationIds: string[];
  /** Currently equipped decoration ID */
  equippedDecorationId: string | null;
  /** Called when a decoration is selected */
  onSelect: (decorationId: string | null) => void;
  /** Whether selection is in progress (loading state) */
  isSelecting?: boolean;
  /** Preview size for decoration items */
  itemSize?: number;
  /** Number of columns in grid */
  numColumns?: number;
}

/**
 * Category labels for display
 */
const CATEGORY_LABELS: Record<DecorationCategory, string> = {
  basic: "Basic",
  achievement: "Achievements",
  premium: "Premium",
  seasonal: "Seasonal",
  exclusive: "Exclusive",
};

/**
 * Rarity colors
 */
const RARITY_COLORS = {
  common: "#9CA3AF",
  rare: "#3B82F6",
  epic: "#A855F7",
  legendary: "#F59E0B",
  mythic: "#EC4899",
} as const;

/**
 * Rarity labels
 */
const RARITY_LABELS = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
} as const;

interface DecorationItemProps {
  decoration: AvatarDecoration;
  isOwned: boolean;
  isEquipped: boolean;
  onPress: () => void;
  size: number;
  colors: any;
}

function DecorationItem({
  decoration,
  isOwned,
  isEquipped,
  onPress,
  size,
  colors,
}: DecorationItemProps) {
  const rarityColor = RARITY_COLORS[decoration.rarity];

  return (
    <Pressable
      onPress={onPress}
      disabled={!isOwned}
      style={({ pressed }) => [
        styles.itemContainer,
        {
          width: size,
          height: size + 40, // Extra space for name
          opacity: isOwned ? 1 : 0.4,
        },
        pressed && styles.itemPressed,
      ]}
    >
      {/* Decoration preview */}
      <View
        style={[
          styles.itemPreview,
          {
            width: size - 16,
            height: size - 16,
            backgroundColor: colors.surfaceVariant,
            borderColor: isEquipped ? colors.primary : rarityColor,
            borderWidth: isEquipped ? 3 : 1,
          },
        ]}
      >
        {decoration.assetPath ? (
          <Image
            source={decoration.assetPath}
            style={{
              width: size - 24,
              height: size - 24,
            }}
            resizeMode="contain"
          />
        ) : (
          <Ionicons
            name="sparkles-outline"
            size={size * 0.3}
            color={colors.textSecondary}
          />
        )}

        {/* Equipped checkmark */}
        {isEquipped && (
          <View
            style={[styles.equippedBadge, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          </View>
        )}

        {/* Lock icon for unowned */}
        {!isOwned && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
          </View>
        )}

        {/* Animated indicator */}
        {decoration.animated && (
          <View style={styles.animatedBadge}>
            <Ionicons name="play-circle" size={16} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Name */}
      <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
        {decoration.name}
      </Text>

      {/* Rarity indicator */}
      <View style={styles.rarityContainer}>
        <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
        <Text style={[styles.rarityText, { color: colors.textSecondary }]}>
          {RARITY_LABELS[decoration.rarity]}
        </Text>
      </View>
    </Pressable>
  );
}

export function DecorationPicker({
  ownedDecorationIds,
  equippedDecorationId,
  onSelect,
  isSelecting = false,
  itemSize = 100,
  numColumns = 3,
}: DecorationPickerProps) {
  const theme = useTheme();
  // Map MD3 colors to simpler names for convenience
  const colors = {
    primary: theme.colors.primary,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceVariant,
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    border: theme.colors.outline,
    error: theme.colors.error,
  };
  const [selectedCategory, setSelectedCategory] = useState<
    DecorationCategory | "all"
  >("all");

  // Get decorations based on selected category
  const decorations = useMemo(() => {
    if (selectedCategory === "all") {
      return AVATAR_DECORATIONS;
    }
    return getDecorationsByCategory(selectedCategory);
  }, [selectedCategory]);

  // Categories that have items
  const availableCategories = useMemo(() => {
    const categories = new Set<DecorationCategory>();
    AVATAR_DECORATIONS.forEach((d) => categories.add(d.category));
    return Array.from(categories);
  }, []);

  const handleDecorationPress = useCallback(
    (decoration: AvatarDecoration) => {
      if (isSelecting) return;

      // If already equipped, unequip
      if (equippedDecorationId === decoration.id) {
        onSelect(null);
      } else {
        onSelect(decoration.id);
      }
    },
    [equippedDecorationId, onSelect, isSelecting],
  );

  const renderDecoration = useCallback(
    ({ item }: { item: AvatarDecoration }) => {
      // Free decorations with an available asset are always treated as owned
      const isFreeAndAvailable =
        item.obtainMethod.type === "free" && item.available;
      const isOwned =
        isFreeAndAvailable || ownedDecorationIds.includes(item.id);
      const isEquipped = equippedDecorationId === item.id;

      return (
        <DecorationItem
          decoration={item}
          isOwned={isOwned}
          isEquipped={isEquipped}
          onPress={() => handleDecorationPress(item)}
          size={itemSize}
          colors={colors}
        />
      );
    },
    [
      ownedDecorationIds,
      equippedDecorationId,
      handleDecorationPress,
      itemSize,
      colors,
    ],
  );

  return (
    <View style={styles.container}>
      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        {/* All filter */}
        <Pressable
          onPress={() => setSelectedCategory("all")}
          style={[
            styles.categoryChip,
            {
              backgroundColor:
                selectedCategory === "all"
                  ? colors.primary
                  : colors.surfaceVariant,
            },
          ]}
        >
          <Text
            style={[
              styles.categoryChipText,
              {
                color: selectedCategory === "all" ? "#FFFFFF" : colors.text,
              },
            ]}
          >
            All
          </Text>
        </Pressable>

        {/* Category chips */}
        {availableCategories.map((category) => (
          <Pressable
            key={category}
            onPress={() => setSelectedCategory(category)}
            style={[
              styles.categoryChip,
              {
                backgroundColor:
                  selectedCategory === category
                    ? colors.primary
                    : colors.surfaceVariant,
              },
            ]}
          >
            <Text
              style={[
                styles.categoryChipText,
                {
                  color:
                    selectedCategory === category ? "#FFFFFF" : colors.text,
                },
              ]}
            >
              {CATEGORY_LABELS[category]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* "None" option to unequip */}
      <Pressable
        onPress={() => onSelect(null)}
        style={[
          styles.noneOption,
          {
            backgroundColor: colors.surfaceVariant,
            borderColor: !equippedDecorationId ? colors.primary : "transparent",
            borderWidth: !equippedDecorationId ? 2 : 0,
          },
        ]}
      >
        <Ionicons
          name="close-circle-outline"
          size={24}
          color={colors.textSecondary}
        />
        <Text style={[styles.noneText, { color: colors.text }]}>
          No Decoration
        </Text>
        {!equippedDecorationId && (
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        )}
      </Pressable>

      {/* Decorations grid */}
      <FlatList
        data={decorations}
        renderItem={renderDecoration}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="sparkles-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No decorations in this category
            </Text>
          </View>
        }
      />

      {/* Owned count */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.ownedText, { color: colors.textSecondary }]}>
          Owned: {ownedDecorationIds.length} / {AVATAR_DECORATIONS.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categoryScroll: {
    maxHeight: 48,
    marginBottom: 12,
  },
  categoryContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  noneOption: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  noneText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  gridRow: {
    justifyContent: "flex-start",
    gap: 8,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  itemContainer: {
    alignItems: "center",
    padding: 8,
  },
  itemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  itemPreview: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  equippedBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  animatedBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 8,
    padding: 2,
  },
  itemName: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
  },
  rarityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  rarityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rarityText: {
    fontSize: 10,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  footer: {
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ownedText: {
    fontSize: 12,
    textAlign: "center",
  },
});

export default DecorationPicker;
