/**
 * ActiveGamesList Component
 *
 * Displays a list of active games the user is participating in.
 * Shows turn indicator, opponent info, and game preview.
 *
 * @see docs/07_GAMES_ARCHITECTURE.md
 * @see src/types/turnBased.ts
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";

import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import { AnyMatch, TurnBasedGameType } from "@/types/turnBased";
import { BorderRadius, Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

interface ActiveGamesListProps {
  games: AnyMatch[];
  currentUserId: string;
  onSelectGame: (game: AnyMatch) => void;
  emptyMessage?: string;
  horizontal?: boolean;
}

interface ActiveGameCardProps {
  game: AnyMatch;
  currentUserId: string;
  onPress: () => void;
  compact?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getGameInfo(gameType: TurnBasedGameType) {
  const metadata = GAME_METADATA[gameType as ExtendedGameType];
  if (metadata) {
    return {
      name: metadata.name,
      shortName: metadata.shortName,
      icon: metadata.icon,
    };
  }

  return {
    name: gameType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    shortName: gameType.slice(0, 4),
    icon: "🎮",
  };
}

function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

function getOpponentInfo(game: AnyMatch, currentUserId: string) {
  const isPlayer1 = game.players.player1.userId === currentUserId;
  const opponent = isPlayer1 ? game.players.player2 : game.players.player1;
  const isMyTurn = game.currentTurn === currentUserId;

  return {
    name: opponent.displayName,
    avatarUrl: opponent.avatarUrl,
    isMyTurn,
  };
}

// =============================================================================
// ActiveGameCard Component
// =============================================================================

export function ActiveGameCard({
  game,
  currentUserId,
  onPress,
  compact = false,
}: ActiveGameCardProps) {
  const theme = useTheme();
  const gameInfo = getGameInfo(game.gameType);
  const { name: opponentName, isMyTurn } = getOpponentInfo(game, currentUserId);
  const lastActivity = game.lastMoveAt || game.updatedAt;

  if (compact) {
    return (
      <TouchableOpacity
        style={[
          styles.compactCard,
          { backgroundColor: theme.colors.surface },
          isMyTurn && { borderColor: theme.colors.primary, borderWidth: 2 },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.compactEmoji}>{gameInfo.icon}</Text>
        <Text
          style={[styles.compactName, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {opponentName}
        </Text>
        {isMyTurn && (
          <View
            style={[styles.turnDot, { backgroundColor: theme.colors.primary }]}
          />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Card
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface },
        isMyTurn && styles.myTurnCard,
      ]}
      onPress={onPress}
    >
      <Card.Content style={styles.content}>
        {/* Game Icon */}
        <View
          style={[
            styles.gameIcon,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text style={styles.gameEmoji}>{gameInfo.icon}</Text>
        </View>

        {/* Game Info */}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.gameName, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {gameInfo.name}
            </Text>
            {isMyTurn && (
              <View
                style={[
                  styles.turnBadge,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text style={styles.turnBadgeText}>Your Turn</Text>
              </View>
            )}
          </View>

          <Text
            style={[
              styles.opponentName,
              { color: theme.colors.onSurfaceVariant },
            ]}
            numberOfLines={1}
          >
            vs {opponentName}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.moveCount, { color: theme.colors.outline }]}>
              Move {game.turnNumber}
            </Text>
            <Text style={[styles.timeText, { color: theme.colors.outline }]}>
              {getTimeAgo(lastActivity)}
            </Text>
          </View>
        </View>

        {/* Arrow */}
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={theme.colors.onSurfaceVariant}
        />
      </Card.Content>
    </Card>
  );
}

// =============================================================================
// ActiveGamesList Component
// =============================================================================

export function ActiveGamesList({
  games,
  currentUserId,
  onSelectGame,
  emptyMessage = "No active games",
  horizontal = false,
}: ActiveGamesListProps) {
  const theme = useTheme();

  if (games.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="gamepad-variant"
          size={48}
          color={theme.colors.outline}
        />
        <Text
          style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
        >
          {emptyMessage}
        </Text>
      </View>
    );
  }

  // Sort games: my turn first, then by last activity
  const sortedGames = [...games].sort((a, b) => {
    const aIsMyTurn = a.currentTurn === currentUserId;
    const bIsMyTurn = b.currentTurn === currentUserId;

    if (aIsMyTurn && !bIsMyTurn) return -1;
    if (!aIsMyTurn && bIsMyTurn) return 1;

    const aTime = a.lastMoveAt || a.updatedAt;
    const bTime = b.lastMoveAt || b.updatedAt;
    return bTime - aTime;
  });

  if (horizontal) {
    return (
      <FlatList
        data={sortedGames}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={({ item }) => (
          <ActiveGameCard
            game={item}
            currentUserId={currentUserId}
            onPress={() => onSelectGame(item)}
            compact
          />
        )}
      />
    );
  }

  return (
    <View style={styles.listContainer}>
      {sortedGames.map((game) => (
        <ActiveGameCard
          key={game.id}
          game={game}
          currentUserId={currentUserId}
          onPress={() => onSelectGame(game)}
        />
      ))}
    </View>
  );
}

// =============================================================================
// ActiveGamesSection Component (for GamesHub)
// =============================================================================

interface ActiveGamesSectionProps {
  games: AnyMatch[];
  currentUserId: string;
  onSelectGame: (game: AnyMatch) => void;
  onViewAll?: () => void;
}

export function ActiveGamesSection({
  games,
  currentUserId,
  onSelectGame,
  onViewAll,
}: ActiveGamesSectionProps) {
  const theme = useTheme();

  if (games.length === 0) {
    return null;
  }

  const myTurnCount = games.filter(
    (g) => g.currentTurn === currentUserId,
  ).length;

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
          >
            🎮 Active Games
          </Text>
          {myTurnCount > 0 && (
            <View
              style={[
                styles.countBadge,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Text style={styles.countBadgeText}>{myTurnCount}</Text>
            </View>
          )}
        </View>
        {onViewAll && games.length > 3 && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ActiveGamesList
        games={games.slice(0, 3)}
        currentUserId={currentUserId}
        onSelectGame={onSelectGame}
        horizontal
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  myTurnCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  gameIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  gameEmoji: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  gameName: {
    fontSize: 16,
    fontWeight: "600",
  },
  turnBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  turnBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  opponentName: {
    fontSize: 14,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  moveCount: {
    fontSize: 12,
  },
  timeText: {
    fontSize: 12,
  },
  // Compact card styles
  compactCard: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
    padding: Spacing.sm,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  compactEmoji: {
    fontSize: 32,
    marginBottom: Spacing.xs,
  },
  compactName: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  turnDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // List styles
  listContainer: {
    paddingHorizontal: Spacing.md,
  },
  horizontalList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  // Section styles
  sectionContainer: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
