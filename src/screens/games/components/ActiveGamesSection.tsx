/**
 * ActiveGamesSection Component
 *
 * Groups active games by turn status:
 * - "Your Turn" section with urgent styling
 * - "Their Turn / Waiting" section
 *
 * Features:
 * - Collapsible sections
 * - Game counts in headers
 * - Empty state handling
 *
 * @see Phase 2 of GAME_SYSTEM_OVERHAUL_PLAN
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

import { groupGamesByTurn } from "@/types/gameFilters";
import { AnyMatch } from "@/types/turnBased";
import { BorderRadius, Spacing } from "@/constants/theme";
import { ActiveGameCard, CompactActiveGameCard } from "./ActiveGameCard";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =============================================================================
// Types
// =============================================================================

export interface ActiveGamesSectionProps {
  /** All active games */
  games: AnyMatch[];
  /** Current user's ID */
  currentUserId: string;
  /** Called when a game is selected */
  onSelectGame: (game: AnyMatch) => void;
  /** Called when archive is requested */
  onArchiveGame?: (gameId: string) => void;
  /** Called when resign is requested */
  onResignGame?: (gameId: string) => void;
  /** Called when rematch is requested */
  onRematchGame?: (game: AnyMatch) => void;
  /** Use compact layout (horizontal scroll) */
  compact?: boolean;
  /** Maximum games to show (optional) */
  maxGames?: number;
  /** Called when "View All" is pressed */
  onViewAll?: () => void;
}

interface GameGroupProps {
  title: string;
  icon: string;
  iconColor: string;
  games: AnyMatch[];
  currentUserId: string;
  onSelectGame: (game: AnyMatch) => void;
  onArchiveGame?: (gameId: string) => void;
  onResignGame?: (gameId: string) => void;
  onRematchGame?: (game: AnyMatch) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isUrgent?: boolean;
}

// =============================================================================
// GameGroup Component
// =============================================================================

function GameGroup({
  title,
  icon,
  iconColor,
  games,
  currentUserId,
  onSelectGame,
  onArchiveGame,
  onResignGame,
  onRematchGame,
  isExpanded,
  onToggleExpand,
  isUrgent = false,
}: GameGroupProps) {
  const theme = useTheme();

  if (games.length === 0) {
    return null;
  }

  return (
    <View style={styles.groupContainer}>
      {/* Group Header */}
      <TouchableOpacity
        style={[
          styles.groupHeader,
          isUrgent && { backgroundColor: `${iconColor}15` },
        ]}
        onPress={onToggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.groupTitleRow}>
          <MaterialCommunityIcons
            name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={20}
            color={iconColor}
          />
          <Text
            style={[
              styles.groupTitle,
              { color: theme.colors.onSurface },
              isUrgent && { color: iconColor, fontWeight: "700" },
            ]}
          >
            {title}
          </Text>
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: isUrgent
                  ? iconColor
                  : theme.colors.surfaceVariant,
              },
            ]}
          >
            <Text
              style={[
                styles.countBadgeText,
                { color: isUrgent ? "#FFFFFF" : theme.colors.onSurfaceVariant },
              ]}
            >
              {games.length}
            </Text>
          </View>
        </View>
        <MaterialCommunityIcons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={24}
          color={theme.colors.onSurfaceVariant}
        />
      </TouchableOpacity>

      {/* Game Cards */}
      {isExpanded && (
        <View style={styles.groupContent}>
          {games.map((game) => (
            <ActiveGameCard
              key={game.id}
              game={game}
              currentUserId={currentUserId}
              onPress={() => onSelectGame(game)}
              onArchive={onArchiveGame}
              onResign={onResignGame}
              onRematch={onRematchGame}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// =============================================================================
// ActiveGamesSection Component
// =============================================================================

export function ActiveGamesSection({
  games,
  currentUserId,
  onSelectGame,
  onArchiveGame,
  onResignGame,
  onRematchGame,
  compact = false,
  maxGames,
  onViewAll,
}: ActiveGamesSectionProps) {
  const theme = useTheme();
  const [yourTurnExpanded, setYourTurnExpanded] = useState(true);
  const [theirTurnExpanded, setTheirTurnExpanded] = useState(true);

  // Group games by turn status
  const { yourTurn, theirTurn } = useMemo(
    () => groupGamesByTurn(games, currentUserId),
    [games, currentUserId],
  );

  const toggleYourTurn = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setYourTurnExpanded((prev) => !prev);
  }, []);

  const toggleTheirTurn = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTheirTurnExpanded((prev) => !prev);
  }, []);

  // Empty state
  if (games.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="gamepad-variant-outline"
          size={48}
          color={theme.colors.outline}
        />
        <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          No Active Games
        </Text>
        <Text
          style={[
            styles.emptySubtitle,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Start a new game with your friends!
        </Text>
      </View>
    );
  }

  // Compact mode - horizontal scroll
  if (compact) {
    const displayGames = maxGames ? games.slice(0, maxGames) : games;
    const hasMore = maxGames && games.length > maxGames;

    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <View style={styles.compactTitleRow}>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.onBackground },
              ]}
            >
              🎮 Active Games
            </Text>
            {yourTurn.length > 0 && (
              <View
                style={[
                  styles.urgentBadge,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text style={styles.urgentBadgeText}>
                  {yourTurn.length} your turn
                </Text>
              </View>
            )}
          </View>
          {hasMore && onViewAll && (
            <TouchableOpacity onPress={onViewAll}>
              <Text
                style={[styles.viewAllText, { color: theme.colors.primary }]}
              >
                View All ({games.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.compactList}>
          {displayGames.map((game) => (
            <CompactActiveGameCard
              key={game.id}
              game={game}
              currentUserId={currentUserId}
              onPress={() => onSelectGame(game)}
            />
          ))}
        </View>
      </View>
    );
  }

  // Full mode - grouped sections
  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text
          style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
        >
          🎮 Active Games
        </Text>
        <Text
          style={[
            styles.sectionSubtitle,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {games.length} game{games.length !== 1 ? "s" : ""} in progress
        </Text>
      </View>

      {/* Your Turn Group */}
      <GameGroup
        title="Your Turn"
        icon="arrow-right-circle"
        iconColor={theme.colors.primary}
        games={yourTurn}
        currentUserId={currentUserId}
        onSelectGame={onSelectGame}
        onArchiveGame={onArchiveGame}
        onResignGame={onResignGame}
        onRematchGame={onRematchGame}
        isExpanded={yourTurnExpanded}
        onToggleExpand={toggleYourTurn}
        isUrgent
      />

      {/* Their Turn Group */}
      <GameGroup
        title="Waiting for Opponent"
        icon="clock-outline"
        iconColor={theme.colors.outline}
        games={theirTurn}
        currentUserId={currentUserId}
        onSelectGame={onSelectGame}
        onArchiveGame={onArchiveGame}
        onResignGame={onResignGame}
        onRematchGame={onRematchGame}
        isExpanded={theirTurnExpanded}
        onToggleExpand={toggleTheirTurn}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  // Group styles
  groupContainer: {
    marginBottom: Spacing.md,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  groupContent: {
    paddingLeft: Spacing.xs,
  },
  // Compact styles
  compactContainer: {
    marginBottom: Spacing.md,
  },
  compactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  compactTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  urgentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  urgentBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  compactList: {
    flexDirection: "row",
    paddingVertical: Spacing.xs,
  },
  // Empty state
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
});
