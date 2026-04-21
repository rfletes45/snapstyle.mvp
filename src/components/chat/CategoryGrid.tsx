/**
 * CategoryGrid — Two-column category tile browser for GIF/Sticker pickers.
 *
 * Displays browseable categories as rectangular preview cards in a 2-column
 * layout. Each card has a muted/greyed-out preview image with a dark overlay
 * and centered category name text, similar to Discord's GIF category browser.
 *
 * Tapping a tile fires `onSelect` — it does NOT send media. The parent picker
 * is responsible for transitioning into the category's result view.
 *
 * @module components/chat/CategoryGrid
 */

import { AppImage } from "@/components/AppImage";
import { buildRemoteImageSource } from "@/utils/remoteImageSource";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface CategoryTile {
  /** Display name shown centered on the card */
  name: string;
  /** Optional preview image URL used as the card background */
  imageUrl?: string;
}

export interface CategoryGridProps {
  /** Available categories */
  categories: CategoryTile[];
  /** Whether categories are still loading */
  loading?: boolean;
  /** Called when a category tile is tapped */
  onSelect: (categoryName: string) => void;
  /** Theme colors */
  colors: {
    surface: string;
    surfaceVariant: string;
    text: string;
  };
}

// =============================================================================
// Layout
// =============================================================================

const GRID_PADDING = 8;
const GRID_GAP = 8;
const NUM_COLUMNS = 2;
const SCREEN_WIDTH = Dimensions.get("window").width;
const TILE_WIDTH =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;
const TILE_HEIGHT = TILE_WIDTH * 0.55; // landscape-ish aspect ratio
const SKELETON_COUNT = 8;

// =============================================================================
// Category Card
// =============================================================================

const CategoryCard = memo(function CategoryCard({
  tile,
  onPress,
  surfaceVariant,
}: {
  tile: CategoryTile;
  onPress: (name: string) => void;
  surfaceVariant: string;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress(tile.name);
  }, [onPress, tile.name]);
  const previewSource = buildRemoteImageSource(tile.imageUrl);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          width: TILE_WIDTH,
          height: TILE_HEIGHT,
          backgroundColor: surfaceVariant,
        },
        pressed && styles.cardPressed,
      ]}
      accessibilityLabel={`${tile.name} category`}
      accessibilityRole="button"
      accessibilityHint={`Browse ${tile.name}`}
    >
      {previewSource ? (
        <AppImage
          source={previewSource}
          style={StyleSheet.absoluteFill}
          transition={0}
          cachePolicy="memory-disk"
          contentFit="cover"
        />
      ) : null}
      {/* Dark overlay for text legibility */}
      <View style={styles.overlay} />
      <Text style={styles.cardLabel} numberOfLines={1}>
        {tile.name}
      </Text>
    </Pressable>
  );
});

// =============================================================================
// Skeleton Card
// =============================================================================

const SkeletonCard = memo(function SkeletonCard({
  surfaceVariant,
}: {
  surfaceVariant: string;
}) {
  return (
    <View
      style={[
        styles.card,
        styles.skeletonCard,
        {
          width: TILE_WIDTH,
          height: TILE_HEIGHT,
          backgroundColor: surfaceVariant,
        },
      ]}
    />
  );
});

// =============================================================================
// Main Component
// =============================================================================

export const CategoryGrid = memo(function CategoryGrid({
  categories,
  loading,
  onSelect,
  colors,
}: CategoryGridProps) {
  // Show skeleton while loading
  if (loading && categories.length === 0) {
    return (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <SkeletonCard
            key={`sk-${i}`}
            surfaceVariant={colors.surfaceVariant}
          />
        ))}
      </View>
    );
  }

  if (categories.length === 0) return null;

  return (
    <FlatList
      data={categories}
      keyExtractor={(item) => item.name}
      numColumns={NUM_COLUMNS}
      style={styles.flexFill}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.gridContent}
      columnWrapperStyle={styles.columnWrapper}
      renderItem={({ item }) => (
        <CategoryCard
          tile={item}
          onPress={onSelect}
          surfaceVariant={colors.surfaceVariant}
        />
      )}
    />
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
    minHeight: 0,
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 560,
  },
  columnWrapper: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  skeletonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    paddingHorizontal: GRID_PADDING,
    flex: 1,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  cardLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    zIndex: 1,
  },
  skeletonCard: {
    opacity: 0.25,
  },
});

export default CategoryGrid;
