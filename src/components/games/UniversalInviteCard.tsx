/**
 * UniversalInviteCard Component
 *
 * Displays a universal game invite with:
 * - Game type info (icon, name)
 * - Player slots visualization
 * - Join/Leave/Spectate actions
 * - Status indicators
 * - Spectator count
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Chip, Text, useTheme } from "react-native-paper";

import { GAME_METADATA, type ExtendedGameType } from "@/types/games";
import type { UniversalGameInvite } from "@/types/turnBased";
import { BorderRadius, Spacing } from "../../../constants/theme";
import { PlayerSlots } from "./PlayerSlots";

// =============================================================================
// Types
// =============================================================================

export interface UniversalInviteCardProps {
  /** The universal invite to display */
  invite: UniversalGameInvite;
  /** Current user's ID */
  currentUserId: string;
  /** Called when user wants to join the game */
  onJoin: () => Promise<void>;
  /** Called when user wants to leave (before game starts) */
  onLeave: () => Promise<void>;
  /** Called when user wants to spectate */
  onSpectate: () => Promise<void>;
  /** Called when host wants to cancel the invite */
  onCancel: () => Promise<void>;
  /** Called when user wants to play (game is active) */
  onPlay?: (gameId: string, gameType: string) => void;
  /** Use compact layout */
  compact?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get game metadata with fallback
 */
function getGameInfo(gameType: string): { name: string; icon: string } {
  const metadata = GAME_METADATA[gameType as ExtendedGameType];
  if (metadata) {
    return { name: metadata.name, icon: metadata.icon };
  }
  return { name: gameType, icon: "🎮" };
}

// =============================================================================
// Component
// =============================================================================

export function UniversalInviteCard({
  invite,
  currentUserId,
  onJoin,
  onLeave,
  onSpectate,
  onCancel,
  onPlay,
  compact = false,
}: UniversalInviteCardProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState<string | null>(null);

  // Computed state
  const isHost = invite.claimedSlots[0]?.playerId === currentUserId;
  const hasJoined = invite.claimedSlots.some(
    (s) => s.playerId === currentUserId,
  );
  const isSpectating = invite.spectators.some(
    (s) => s.userId === currentUserId,
  );
  const isFull = invite.claimedSlots.length >= invite.requiredPlayers;
  const slotsRemaining = invite.requiredPlayers - invite.claimedSlots.length;
  const isExpired = Date.now() > invite.expiresAt;

  // Determine what actions are available
  const canJoin =
    !hasJoined &&
    !isFull &&
    !isExpired &&
    ["pending", "filling"].includes(invite.status);
  const canLeave =
    hasJoined && !isHost && ["pending", "filling"].includes(invite.status);
  const canSpectate =
    !hasJoined &&
    !isSpectating &&
    invite.spectatingEnabled &&
    ["ready", "active"].includes(invite.status);
  const canCancel = isHost && ["pending", "filling"].includes(invite.status);
  const canPlay = hasJoined && invite.gameId && invite.status === "active";

  // Game info
  const { name: gameName, icon: gameIcon } = getGameInfo(invite.gameType);

  // Action handler with loading state
  const handleAction = useCallback(
    async (action: string, fn: () => Promise<void>) => {
      setLoading(action);
      try {
        await fn();
      } catch (error) {
        console.error(`[UniversalInviteCard] ${action} error:`, error);
      } finally {
        setLoading(null);
      }
    },
    [],
  );

  // Status color based on invite status
  const getStatusColor = useCallback(() => {
    switch (invite.status) {
      case "pending":
        return theme.colors.primary;
      case "filling":
        return "#FFA500"; // Orange
      case "ready":
        return "#4CAF50"; // Green
      case "active":
        return "#2196F3"; // Blue
      case "completed":
        return theme.colors.outline;
      case "expired":
        return theme.colors.error;
      case "cancelled":
        return theme.colors.error;
      default:
        return theme.colors.outline;
    }
  }, [invite.status, theme]);

  // Status text
  const getStatusText = useCallback(() => {
    switch (invite.status) {
      case "pending":
        return slotsRemaining === 1
          ? "1 spot left"
          : `${slotsRemaining} spots left`;
      case "filling":
        return `${slotsRemaining} more needed`;
      case "ready":
        return "Starting...";
      case "active":
        return "In Progress";
      case "completed":
        return "Finished";
      case "expired":
        return "Expired";
      case "cancelled":
        return "Cancelled";
      default:
        return invite.status;
    }
  }, [invite.status, slotsRemaining]);

  // Compact layout
  if (compact) {
    return (
      <Card
        style={[styles.cardCompact, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.compactContent}>
          <Text style={styles.gameIconCompact}>{gameIcon}</Text>
          <View style={styles.compactInfo}>
            <Text
              style={[
                styles.gameNameCompact,
                { color: theme.colors.onSurface },
              ]}
            >
              {gameName}
            </Text>
            <Text style={[styles.statusCompact, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>
          <PlayerSlots
            slots={invite.claimedSlots}
            requiredPlayers={invite.requiredPlayers}
            maxPlayers={invite.maxPlayers}
            currentUserId={currentUserId}
            compact
          />
          {canJoin && (
            <Button
              mode="contained"
              compact
              onPress={() => handleAction("join", onJoin)}
              loading={loading === "join"}
              disabled={loading !== null}
            >
              Join
            </Button>
          )}
          {canPlay && onPlay && (
            <Button
              mode="contained"
              compact
              onPress={() => onPlay(invite.gameId!, invite.gameType)}
            >
              Play
            </Button>
          )}
        </View>
      </Card>
    );
  }

  // Full layout
  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.gameInfo}>
            <Text style={styles.gameIcon}>{gameIcon}</Text>
            <View>
              <Text
                style={[styles.gameName, { color: theme.colors.onSurface }]}
              >
                {gameName}
              </Text>
              <Text
                style={[
                  styles.hostText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Hosted by {invite.senderName}
              </Text>
            </View>
          </View>
          <Chip
            mode="flat"
            compact
            style={{ backgroundColor: getStatusColor() + "20" }}
            textStyle={{ color: getStatusColor(), fontSize: 11 }}
          >
            {getStatusText()}
          </Chip>
        </View>

        {/* Player Slots */}
        <View style={styles.slotsSection}>
          <Text
            style={[
              styles.slotsLabel,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Players ({invite.claimedSlots.length}/{invite.requiredPlayers})
          </Text>
          <PlayerSlots
            slots={invite.claimedSlots}
            requiredPlayers={invite.requiredPlayers}
            maxPlayers={invite.maxPlayers}
            currentUserId={currentUserId}
          />
        </View>

        {/* Spectators */}
        {invite.spectators.length > 0 && (
          <View style={styles.spectatorsRow}>
            <MaterialCommunityIcons
              name="eye"
              size={16}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.spectatorsText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {invite.spectators.length} watching
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {canJoin && (
            <Button
              mode="contained"
              onPress={() => handleAction("join", onJoin)}
              loading={loading === "join"}
              disabled={loading !== null}
              style={styles.actionButton}
            >
              Join Game
            </Button>
          )}

          {canLeave && (
            <Button
              mode="outlined"
              onPress={() => handleAction("leave", onLeave)}
              loading={loading === "leave"}
              disabled={loading !== null}
              style={styles.actionButton}
            >
              Leave
            </Button>
          )}

          {canSpectate && (
            <Button
              mode="outlined"
              onPress={() => handleAction("spectate", onSpectate)}
              loading={loading === "spectate"}
              disabled={loading !== null}
              icon="eye"
              style={styles.actionButton}
            >
              Spectate
            </Button>
          )}

          {canCancel && (
            <Button
              mode="outlined"
              textColor={theme.colors.error}
              onPress={() => handleAction("cancel", onCancel)}
              loading={loading === "cancel"}
              disabled={loading !== null}
              style={styles.actionButton}
            >
              Cancel
            </Button>
          )}

          {canPlay && onPlay && (
            <Button
              mode="contained"
              onPress={() => onPlay(invite.gameId!, invite.gameType)}
              icon="play"
              style={styles.actionButton}
            >
              Play Now
            </Button>
          )}

          {hasJoined && !canLeave && !canPlay && (
            <Text
              style={[
                styles.waitingMessage,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Waiting for other players...
            </Text>
          )}

          {isSpectating && (
            <Text
              style={[
                styles.spectatingMessage,
                { color: theme.colors.primary },
              ]}
            >
              👁 You&apos;re spectating
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  cardCompact: {
    marginVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  compactContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  compactInfo: {
    flex: 1,
  },
  gameIconCompact: {
    fontSize: 24,
  },
  gameNameCompact: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusCompact: {
    fontSize: 11,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  gameInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  gameIcon: {
    fontSize: 36,
  },
  gameName: {
    fontSize: 18,
    fontWeight: "600",
  },
  hostText: {
    fontSize: 12,
  },
  slotsSection: {
    marginBottom: Spacing.md,
  },
  slotsLabel: {
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  spectatorsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  spectatorsText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionButton: {
    minWidth: 100,
  },
  waitingMessage: {
    fontSize: 13,
    fontStyle: "italic",
  },
  spectatingMessage: {
    fontSize: 13,
    fontWeight: "500",
  },
});

export default UniversalInviteCard;
