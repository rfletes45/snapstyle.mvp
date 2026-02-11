/**
 * ActiveGamesMini Component
 *
 * A compact, streamlined view of active games for the Play Screen.
 * Replaces the full collapsible ActiveGamesSection with a compact mini-card row.
 *
 * Layout (per Phase 6 plan):
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 🎮 Your Games                              View All (8) >   │
 * ├─────────────────────────────────────────────────────────────┤
 * │ ┌───────────────────┐ ┌───────────────────┐                 │
 * │ │ 🔴 Your Turn (3)  │ │ ⏳ Waiting (5)   │                  │
 * │ │ Chess vs Alex     │ │ Checkers vs Sam  │                  │
 * │ │ Tic-Tac vs Mike   │ │                  │                  │
 * │ └───────────────────┘ └───────────────────┘                 │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Visual Specs:
 * - Container: 16px horizontal padding
 * - Two columns: "Your Turn" and "Waiting"
 * - Column width: 50% - 8px gap
 * - Column border radius: 8px
 * - Column background: surface
 * - Column max-height: 120px (show ~3 games)
 * - Your Turn: red accent border/indicator
 * - Waiting: gray accent
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 6
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { useAppTheme } from "@/store/ThemeContext";
import { groupGamesByTurn } from "@/types/gameFilters";
import { AnyMatch } from "@/types/turnBased";
import { PLAY_SCREEN_TOKENS } from "@/constants/gamesTheme";
import { MiniGameItem } from "./MiniGameItem";

// =============================================================================
// Types
// =============================================================================

export interface ActiveGamesMiniProps {
  /** All active games */
  games: AnyMatch[];
  /** Current user's ID */
  currentUserId: string;
  /** Called when a game is selected */
  onGamePress: (game: AnyMatch) => void;
  /** Called when "View All" is pressed */
  onViewAllPress: () => void;
  /** Optional test ID for testing */
  testID?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_GAMES_PER_COLUMN = 3;
const COLUMN_MAX_HEIGHT = 120;

// =============================================================================
// GameColumn Component
// =============================================================================

interface GameColumnProps {
  title: string;
  count: number;
  games: AnyMatch[];
  currentUserId: string;
  onGamePress: (game: AnyMatch) => void;
  accentColor: string;
  isUrgent?: boolean;
  testID?: string;
}

function GameColumn({
  title,
  count,
  games,
  currentUserId,
  onGamePress,
  accentColor,
  isUrgent = false,
  testID,
}: GameColumnProps) {
  const { colors, isDark } = useAppTheme();

  const displayGames = games.slice(0, MAX_GAMES_PER_COLUMN);
  const hasMore = games.length > MAX_GAMES_PER_COLUMN;

  if (games.length === 0) {
    return (
      <View
        style={[
          styles.column,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : "transparent",
          },
        ]}
        testID={testID}
      >
        <View style={styles.columnHeader}>
          <View
            style={[styles.accentIndicator, { backgroundColor: accentColor }]}
          />
          <Text style={[styles.columnTitle, { color: colors.textSecondary }]}>
            {title}
          </Text>
          <View
            style={[
              styles.countBadge,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <Text style={[styles.countText, { color: colors.textSecondary }]}>
              0
            </Text>
          </View>
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No games
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.column,
        {
          backgroundColor: colors.surface,
          borderColor: isDark ? colors.border : "transparent",
        },
        isUrgent && styles.urgentColumn,
        isUrgent && { borderColor: accentColor },
      ]}
      testID={testID}
    >
      {/* Column Header */}
      <View style={styles.columnHeader}>
        <View
          style={[styles.accentIndicator, { backgroundColor: accentColor }]}
        />
        <Text
          style={[
            styles.columnTitle,
            { color: isUrgent ? accentColor : colors.text },
            isUrgent && styles.urgentTitle,
          ]}
        >
          {title}
        </Text>
        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: isUrgent ? accentColor : colors.surfaceVariant,
            },
          ]}
        >
          <Text
            style={[
              styles.countText,
              { color: isUrgent ? "#FFFFFF" : colors.textSecondary },
            ]}
          >
            {count}
          </Text>
        </View>
      </View>

      {/* Games List */}
      <ScrollView
        style={styles.gamesList}
        contentContainerStyle={styles.gamesListContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {displayGames.map((game) => (
          <MiniGameItem
            key={game.id}
            game={game}
            currentUserId={currentUserId}
            onPress={() => onGamePress(game)}
            testID={`mini-game-${game.id}`}
          />
        ))}
        {hasMore && (
          <Text style={[styles.moreText, { color: colors.textSecondary }]}>
            +{games.length - MAX_GAMES_PER_COLUMN} more
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// ActiveGamesMini Component
// =============================================================================

export function ActiveGamesMini({
  games,
  currentUserId,
  onGamePress,
  onViewAllPress,
  testID,
}: ActiveGamesMiniProps) {
  const { colors, isDark } = useAppTheme();

  // Group games by turn status
  const { yourTurn, theirTurn } = useMemo(
    () => groupGamesByTurn(games, currentUserId),
    [games, currentUserId],
  );

  // Handle View All press with haptics
  const handleViewAllPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewAllPress();
  }, [onViewAllPress]);

  // Don't render if no games
  if (games.length === 0) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
      testID={testID}
    >
      {/* Section Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            🎮 Your Games
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleViewAllPress}
          style={styles.viewAllButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.viewAllText, { color: colors.primary }]}>
            View All ({games.length})
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={16}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Two-Column Layout */}
      <View style={styles.columnsContainer}>
        {/* Your Turn Column */}
        <GameColumn
          title="Your Turn"
          count={yourTurn.length}
          games={yourTurn}
          currentUserId={currentUserId}
          onGamePress={onGamePress}
          accentColor={PLAY_SCREEN_TOKENS.colors.yourTurnAccent}
          isUrgent={yourTurn.length > 0}
          testID="your-turn-column"
        />

        {/* Waiting Column */}
        <GameColumn
          title="Waiting"
          count={theirTurn.length}
          games={theirTurn}
          currentUserId={currentUserId}
          onGamePress={onGamePress}
          accentColor={PLAY_SCREEN_TOKENS.colors.waitingAccent}
          testID="waiting-column"
        />
      </View>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: PLAY_SCREEN_TOKENS.spacing.horizontalPadding,
    marginBottom: PLAY_SCREEN_TOKENS.spacing.sectionGap,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: PLAY_SCREEN_TOKENS.typography.sectionTitle.fontSize,
    fontWeight: PLAY_SCREEN_TOKENS.typography.sectionTitle.fontWeight,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  columnsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  column: {
    flex: 1,
    borderRadius: PLAY_SCREEN_TOKENS.borderRadius.cardLarge,
    borderWidth: 1,
    padding: 10,
    maxHeight: COLUMN_MAX_HEIGHT,
    ...PLAY_SCREEN_TOKENS.shadows.card,
  },
  urgentColumn: {
    borderWidth: 2,
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  accentIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  columnTitle: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  urgentTitle: {
    fontWeight: "700",
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
  },
  gamesList: {
    flex: 1,
  },
  gamesListContent: {
    paddingBottom: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
  },
  emptyText: {
    fontSize: 11,
    fontStyle: "italic",
  },
  moreText: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
});
