/**
 * ActiveGameCard Component
 *
 * Enhanced card for displaying an active game with:
 * - Game icon and type
 * - Opponent info with avatar
 * - Turn indicator (prominent for "Your Turn")
 * - 3-dot menu for quick actions (archive, rematch, resign)
 * - Conversation context badge
 *
 * @see Phase 2 of GAME_SYSTEM_OVERHAUL_PLAN
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Card,
  Divider,
  Menu,
  Avatar as PaperAvatar,
  Text,
  useTheme,
} from "react-native-paper";

import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import { AnyMatch, TurnBasedGameType } from "@/types/turnBased";
import { GAME_CATEGORY_COLORS } from "@/constants/gamesTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface ActiveGameCardProps {
  /** The game match data */
  game: AnyMatch;
  /** Current user's ID */
  currentUserId: string;
  /** Called when the card is pressed */
  onPress: () => void;
  /** Called when archive is requested */
  onArchive?: (gameId: string) => void;
  /** Called when resign is requested */
  onResign?: (gameId: string) => void;
  /** Called when rematch is requested */
  onRematch?: (game: AnyMatch) => void;
  /** Whether to show conversation context */
  showConversationContext?: boolean;
  /** Conversation name if available */
  conversationName?: string;
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
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getOpponentInfo(game: AnyMatch, currentUserId: string) {
  const isPlayer1 = game.players.player1.userId === currentUserId;
  const opponent = isPlayer1 ? game.players.player2 : game.players.player1;
  const currentPlayer = isPlayer1 ? game.players.player1 : game.players.player2;
  const isMyTurn = game.currentTurn === currentUserId;

  return {
    opponent,
    currentPlayer,
    isMyTurn,
    isPlayer1,
  };
}

function getGamePalette(gameType: TurnBasedGameType) {
  // Use multiplayer category colors for turn-based games
  return {
    primary: GAME_CATEGORY_COLORS.multiplayer.light,
    secondary: GAME_CATEGORY_COLORS.multiplayer.dark,
    background: "#eef2ff",
    accent: "#4f46e5",
  };
}

// =============================================================================
// Component
// =============================================================================

export function ActiveGameCard({
  game,
  currentUserId,
  onPress,
  onArchive,
  onResign,
  onRematch,
  showConversationContext = false,
  conversationName,
}: ActiveGameCardProps) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  const gameInfo = getGameInfo(game.gameType);
  const { opponent, isMyTurn } = getOpponentInfo(game, currentUserId);
  const lastActivity = game.lastMoveAt || game.updatedAt;
  const palette = getGamePalette(game.gameType);

  const isGameOver = game.status === "completed" || game.status === "abandoned";
  const isWinner = game.winnerId === currentUserId;
  const isDraw = game.status === "completed" && !game.winnerId;

  const handleMenuOpen = useCallback(() => {
    setMenuVisible(true);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const handleArchive = useCallback(() => {
    handleMenuClose();

    // Use window.confirm on web, Alert.alert on native
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Archive Game?\n\nThis game will be hidden from your active games list. You can find it later in archived games.",
      );
      if (confirmed) {
        onArchive?.(game.id);
      }
    } else {
      Alert.alert(
        "Archive Game",
        "This game will be hidden from your active games list. You can find it later in archived games.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Archive",
            onPress: () => onArchive?.(game.id),
          },
        ],
      );
    }
  }, [game.id, onArchive, handleMenuClose]);

  const handleResign = useCallback(() => {
    handleMenuClose();

    // Use window.confirm on web, Alert.alert on native
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Resign Game?\n\nAre you sure you want to resign? This will count as a loss.",
      );
      if (confirmed) {
        onResign?.(game.id);
      }
    } else {
      Alert.alert(
        "Resign Game",
        "Are you sure you want to resign? This will count as a loss.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Resign",
            style: "destructive",
            onPress: () => onResign?.(game.id),
          },
        ],
      );
    }
  }, [game.id, onResign, handleMenuClose]);

  const handleRematch = useCallback(() => {
    handleMenuClose();
    onRematch?.(game);
  }, [game, onRematch, handleMenuClose]);

  // Render game status indicator
  const renderStatusIndicator = () => {
    if (isGameOver) {
      if (isDraw) {
        return (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: theme.colors.outline },
            ]}
          >
            <Text style={styles.statusBadgeText}>Draw</Text>
          </View>
        );
      }
      return (
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isWinner ? "#4CAF50" : theme.colors.error },
          ]}
        >
          <Text style={styles.statusBadgeText}>
            {isWinner ? "Won" : "Lost"}
          </Text>
        </View>
      );
    }

    if (isMyTurn) {
      return (
        <View
          style={[styles.statusBadge, { backgroundColor: palette.primary }]}
        >
          <Text style={styles.statusBadgeText}>Your Turn</Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <Text
          style={[
            styles.statusBadgeText,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Waiting
        </Text>
      </View>
    );
  };

  return (
    <Card
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface },
        isMyTurn &&
          !isGameOver && {
            borderLeftColor: palette.primary,
            borderLeftWidth: 4,
          },
      ]}
      onPress={onPress}
    >
      <Card.Content style={styles.content}>
        {/* Game Icon */}
        <View
          style={[styles.gameIcon, { backgroundColor: `${palette.primary}20` }]}
        >
          <Text style={styles.gameEmoji}>{gameInfo.icon}</Text>
        </View>

        {/* Game Info */}
        <View style={styles.info}>
          {/* Top row: Game name + Status */}
          <View style={styles.titleRow}>
            <Text
              style={[styles.gameName, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {gameInfo.name}
            </Text>
            {renderStatusIndicator()}
          </View>

          {/* Opponent info */}
          <View style={styles.opponentRow}>
            {opponent.avatarUrl ? (
              <PaperAvatar.Image
                size={20}
                source={{ uri: opponent.avatarUrl }}
                style={styles.opponentAvatar}
              />
            ) : (
              <PaperAvatar.Text
                size={20}
                label={opponent.displayName.charAt(0).toUpperCase()}
                style={styles.opponentAvatar}
              />
            )}
            <Text
              style={[
                styles.opponentName,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              vs {opponent.displayName}
            </Text>
          </View>

          {/* Meta row: Move count + Time */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons
                name="swap-horizontal"
                size={14}
                color={theme.colors.outline}
              />
              <Text style={[styles.metaText, { color: theme.colors.outline }]}>
                Move {game.turnNumber}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={14}
                color={theme.colors.outline}
              />
              <Text style={[styles.metaText, { color: theme.colors.outline }]}>
                {getTimeAgo(lastActivity)}
              </Text>
            </View>
            {showConversationContext && conversationName && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons
                  name="chat-outline"
                  size={14}
                  color={theme.colors.outline}
                />
                <Text
                  style={[styles.metaText, { color: theme.colors.outline }]}
                  numberOfLines={1}
                >
                  {conversationName}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 3-dot Menu */}
        <Menu
          visible={menuVisible}
          onDismiss={handleMenuClose}
          anchor={
            <TouchableOpacity
              onPress={handleMenuOpen}
              style={styles.menuButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name="dots-vertical"
                size={24}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          }
          contentStyle={{ backgroundColor: theme.colors.surface }}
        >
          {!isGameOver && (
            <>
              <Menu.Item
                leadingIcon="flag-outline"
                onPress={handleResign}
                title="Resign"
                titleStyle={{ color: theme.colors.error }}
              />
              <Divider />
            </>
          )}
          {isGameOver && onRematch && (
            <>
              <Menu.Item
                leadingIcon="refresh"
                onPress={handleRematch}
                title="Rematch"
              />
              <Divider />
            </>
          )}
          <Menu.Item
            leadingIcon="archive-outline"
            onPress={handleArchive}
            title="Archive"
          />
        </Menu>
      </Card.Content>
    </Card>
  );
}

// =============================================================================
// Compact Card Variant
// =============================================================================

export interface CompactActiveGameCardProps {
  game: AnyMatch;
  currentUserId: string;
  onPress: () => void;
}

export function CompactActiveGameCard({
  game,
  currentUserId,
  onPress,
}: CompactActiveGameCardProps) {
  const theme = useTheme();
  const gameInfo = getGameInfo(game.gameType);
  const { opponent, isMyTurn } = getOpponentInfo(game, currentUserId);
  const palette = getGamePalette(game.gameType);

  return (
    <TouchableOpacity
      style={[
        styles.compactCard,
        { backgroundColor: theme.colors.surface },
        isMyTurn && { borderColor: palette.primary, borderWidth: 2 },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.compactEmoji}>{gameInfo.icon}</Text>
      <Text
        style={[styles.compactName, { color: theme.colors.onSurface }]}
        numberOfLines={1}
      >
        {opponent.displayName}
      </Text>
      {isMyTurn && (
        <View style={[styles.turnDot, { backgroundColor: palette.primary }]} />
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    elevation: 2,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  gameIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  gameEmoji: {
    fontSize: 26,
  },
  info: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  gameName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  opponentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  opponentAvatar: {
    marginRight: Spacing.xs,
  },
  opponentName: {
    fontSize: 14,
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  menuButton: {
    padding: Spacing.xs,
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
});
