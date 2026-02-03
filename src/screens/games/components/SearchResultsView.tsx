/**
 * SearchResultsView
 *
 * Displays search results when the user is searching for games.
 *
 * Phase 2: Search results display
 *
 * Features:
 * - Shows matching games as ModernGameCard list
 * - "No results" empty state
 * - Result count header
 * - Animated entrance
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 2
 */

import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType } from "@/types/games";
import React, { memo, useCallback } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { PLAY_SCREEN_TOKENS } from "../../../../constants/gamesTheme";
import { ModernGameCard } from "./ModernGameCard";

const { spacing, typography } = PLAY_SCREEN_TOKENS;

// =============================================================================
// Types
// =============================================================================

export interface SearchResultsViewProps {
  /** Search query (for display in header) */
  query: string;
  /** Array of matching game types */
  results: ExtendedGameType[];
  /** Map of game type to personal best score (formatted string) */
  highScores?: Map<string, string>;
  /** Called when a game is pressed */
  onGamePress: (gameType: ExtendedGameType) => void;
  /** Whether search is in progress */
  isSearching?: boolean;
  /** Additional container styles */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

// =============================================================================
// Component
// =============================================================================

function SearchResultsViewComponent({
  query,
  results,
  highScores,
  onGamePress,
  isSearching = false,
  style,
  testID,
}: SearchResultsViewProps) {
  const { colors } = useAppTheme();

  // Render game card
  const renderGameCard = useCallback(
    ({ item: gameType }: ListRenderItemInfo<ExtendedGameType>) => {
      const personalBest = highScores?.get(gameType);

      return (
        <ModernGameCard
          gameType={gameType}
          personalBest={personalBest}
          onPress={() => onGamePress(gameType)}
          variant="default"
          showPlayButton={true}
          style={styles.gameCard}
          testID={testID ? `${testID}-card-${gameType}` : undefined}
        />
      );
    },
    [highScores, onGamePress, testID],
  );

  // Key extractor
  const keyExtractor = useCallback((item: ExtendedGameType) => item, []);

  // Item separator
  const ItemSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  // List header with results count
  const ListHeader = useCallback(() => {
    if (!query) return null;

    return (
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: colors.textSecondary }]}>
          {isSearching
            ? "Searching..."
            : results.length === 0
              ? `No results for "${query}"`
              : `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`}
        </Text>
      </View>
    );
  }, [query, results.length, isSearching, colors.textSecondary]);

  // Empty state component
  const EmptyComponent = useCallback(() => {
    if (isSearching) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🔍</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No games found
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Try a different search term or filter
        </Text>
      </View>
    );
  }, [isSearching, colors.text, colors.textSecondary]);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[styles.container, style]}
      testID={testID}
    >
      <FlatList
        data={results}
        renderItem={renderGameCard}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          results.length === 0 && styles.listContentEmpty,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        testID={testID ? `${testID}-list` : undefined}
      />
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: spacing.horizontalPadding,
    paddingVertical: 12,
  },
  headerText: {
    fontSize: typography.sectionSubtitle.fontSize,
    fontWeight: "500" as const,
    lineHeight: typography.sectionSubtitle.lineHeight,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.horizontalPadding,
    paddingBottom: 100, // Extra space for tab bar
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  gameCard: {
    // Styles handled by ModernGameCard
  },
  separator: {
    height: spacing.cardGap,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: "400" as const,
    textAlign: "center",
    lineHeight: 20,
  },
});

export const SearchResultsView = memo(SearchResultsViewComponent);
export default SearchResultsView;
