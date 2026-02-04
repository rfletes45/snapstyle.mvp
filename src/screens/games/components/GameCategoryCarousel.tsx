/**
 * GameCategoryCarousel
 *
 * Horizontal scrolling carousel for a game category.
 *
 * Phase 2: Category browsing component
 *
 * Features:
 * - Section header with title, subtitle, and "See All" button
 * - Horizontal scrolling list of CarouselGameTile
 * - Snap-to-card scrolling
 * - Category accent colors
 * - Personal best score display
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 4
 */

import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType } from "@/types/games";
import { CATEGORY_CONFIGS, GameCategoryConfig } from "@/types/playScreen";
import React, { memo, useCallback } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { PLAY_SCREEN_TOKENS } from "../../../../constants/gamesTheme";
import { CarouselGameTile } from "./CarouselGameTile";

const { spacing, typography } = PLAY_SCREEN_TOKENS;

// =============================================================================
// Types
// =============================================================================

export interface GameCategoryCarouselProps {
  /** Category configuration */
  category: GameCategoryConfig;
  /** Map of game type to personal best score (formatted string) */
  highScores?: Map<string, string>;
  /** Called when a game is pressed */
  onGamePress: (gameType: ExtendedGameType) => void;
  /** Called when a game is long-pressed */
  onGameLongPress?: (gameType: ExtendedGameType) => void;
  /** Called when "See All" is pressed */
  onSeeAllPress?: () => void;
  /** Additional container styles */
  style?: ViewStyle;
  /** Whether to show the "See All" button */
  showSeeAll?: boolean;
  /** Tile width override */
  tileWidth?: number;
  /** Tile height override */
  tileHeight?: number;
  /** Test ID for testing */
  testID?: string;
}

// Default tile dimensions
const DEFAULT_TILE_WIDTH = 100;
const DEFAULT_TILE_HEIGHT = 110;
const TILE_GAP = 10;

// =============================================================================
// Component
// =============================================================================

function GameCategoryCarouselComponent({
  category,
  highScores,
  onGamePress,
  onGameLongPress,
  onSeeAllPress,
  style,
  showSeeAll = true,
  tileWidth = DEFAULT_TILE_WIDTH,
  tileHeight = DEFAULT_TILE_HEIGHT,
  testID,
}: GameCategoryCarouselProps) {
  const { colors } = useAppTheme();

  // Render individual game tile
  const renderGameTile = useCallback(
    ({ item: gameType }: ListRenderItemInfo<ExtendedGameType>) => {
      const personalBest = highScores?.get(gameType);

      return (
        <CarouselGameTile
          gameType={gameType}
          personalBest={personalBest}
          onPress={() => onGamePress(gameType)}
          onLongPress={
            onGameLongPress ? () => onGameLongPress(gameType) : undefined
          }
          width={tileWidth}
          height={tileHeight}
          style={styles.tile}
          testID={testID ? `${testID}-tile-${gameType}` : undefined}
        />
      );
    },
    [highScores, onGamePress, onGameLongPress, tileWidth, tileHeight, testID],
  );

  // Key extractor
  const keyExtractor = useCallback((item: ExtendedGameType) => item, []);

  // Item separator
  const ItemSeparator = useCallback(
    () => <View style={{ width: TILE_GAP }} />,
    [],
  );

  // Get snap offsets for smooth scrolling
  const snapToOffsets = category.games.map(
    (_, index) => index * (tileWidth + TILE_GAP),
  );

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={[styles.title, { color: colors.text }]}>
            {category.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {category.subtitle}
          </Text>
        </View>
        {showSeeAll && onSeeAllPress && (
          <Pressable onPress={onSeeAllPress} style={styles.seeAllButton}>
            <Text style={[styles.seeAllText, { color: colors.primary }]}>
              See All &gt;
            </Text>
          </Pressable>
        )}
      </View>

      {/* Carousel */}
      <FlatList
        horizontal
        data={category.games}
        renderItem={renderGameTile}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ItemSeparator}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
        snapToOffsets={snapToOffsets}
        snapToAlignment="start"
        decelerationRate="fast"
        testID={testID ? `${testID}-list` : undefined}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sectionGap,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.horizontalPadding,
    marginBottom: 12,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: typography.sectionTitle.fontSize,
    fontWeight: typography.sectionTitle.fontWeight as "700",
    lineHeight: typography.sectionTitle.lineHeight,
  },
  subtitle: {
    fontSize: typography.sectionSubtitle.fontSize,
    fontWeight: typography.sectionSubtitle.fontWeight as "400",
    lineHeight: typography.sectionSubtitle.lineHeight,
    marginTop: 2,
  },

  // See All
  seeAllButton: {
    paddingVertical: 4,
    paddingLeft: 8,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },

  // Carousel
  carouselContent: {
    paddingHorizontal: spacing.horizontalPadding,
  },
  tile: {
    // Individual tile styles handled in CarouselGameTile
  },
});

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Renders all category carousels
 */
export interface AllCategoriesCarouselsProps {
  highScores?: Map<string, string>;
  onGamePress: (gameType: ExtendedGameType) => void;
  onSeeAllPress?: (categoryId: string) => void;
  excludeCategories?: string[];
}

function AllCategoriesCarouselsComponent({
  highScores,
  onGamePress,
  onSeeAllPress,
  excludeCategories = [],
}: AllCategoriesCarouselsProps) {
  const categoriesToRender = CATEGORY_CONFIGS.filter(
    (cat) => !excludeCategories.includes(cat.id),
  );

  return (
    <>
      {categoriesToRender.map((category) => (
        <GameCategoryCarousel
          key={category.id}
          category={category}
          highScores={highScores}
          onGamePress={onGamePress}
          onSeeAllPress={
            onSeeAllPress ? () => onSeeAllPress(category.id) : undefined
          }
          testID={`category-carousel-${category.id}`}
        />
      ))}
    </>
  );
}

export const AllCategoriesCarousels = memo(AllCategoriesCarouselsComponent);
export const GameCategoryCarousel = memo(GameCategoryCarouselComponent);
export default GameCategoryCarousel;
