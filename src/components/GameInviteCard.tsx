/**
 * GameInviteCard Component
 *
 * Displays incoming game invitations with accept/decline actions.
 * Used in the Games Hub and notification system.
 *
 * @see docs/07_GAMES_ARCHITECTURE.md
 * @see src/types/turnBased.ts
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";

import { cancelInvite, respondToInvite } from "@/services/turnBasedGames";
import { useColors } from "@/store/ThemeContext";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import {
  GameInvite,
  RealTimeGameType,
  TurnBasedGameType,
} from "@/types/turnBased";
import { BorderRadius, Spacing } from "../../constants/theme";

// =============================================================================
// Types
// =============================================================================

interface GameInviteCardProps {
  invite: GameInvite;
  isOutgoing?: boolean;
  onAccept?: (matchId: string) => void;
  onDecline?: () => void;
  onCancel?: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getGameInfo(gameType: TurnBasedGameType | RealTimeGameType) {
  const metadata = GAME_METADATA[gameType as ExtendedGameType];
  if (metadata) {
    return {
      name: metadata.name,
      icon: metadata.icon,
    };
  }

  // Fallback for unknown game types
  return {
    name: gameType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
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
  return `${days}d ago`;
}

function getExpiresIn(expiresAt: number): string {
  const now = Date.now();
  const diff = expiresAt - now;

  if (diff <= 0) return "Expired";

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 60) return `${minutes}m left`;
  return `${hours}h left`;
}

// =============================================================================
// Main Component
// =============================================================================

export function GameInviteCard({
  invite,
  isOutgoing = false,
  onAccept,
  onDecline,
  onCancel,
}: GameInviteCardProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState<
    "accept" | "decline" | "cancel" | null
  >(null);

  const gameInfo = getGameInfo(invite.gameType);
  const isExpired = invite.expiresAt < Date.now();

  // Debug logging
  console.log("[GameInviteCard] Invite:", invite.id);
  console.log(
    "[GameInviteCard] expiresAt:",
    invite.expiresAt,
    "type:",
    typeof invite.expiresAt,
  );
  console.log("[GameInviteCard] Date.now():", Date.now());
  console.log("[GameInviteCard] isExpired:", isExpired);
  console.log(
    "[GameInviteCard] buttons disabled:",
    loading !== null || isExpired,
  );

  const handleAccept = async () => {
    console.log("[GameInviteCard] handleAccept STARTED for invite:", invite.id);
    console.log(
      "[GameInviteCard] Invite details:",
      JSON.stringify(invite, null, 2),
    );
    setLoading("accept");
    try {
      console.log(
        "[GameInviteCard] Calling respondToInvite with accept=true...",
      );
      const matchId = await respondToInvite(invite.id, true);
      console.log(
        "[GameInviteCard] respondToInvite returned matchId:",
        matchId,
      );
      if (matchId && onAccept) {
        console.log(
          "[GameInviteCard] Calling onAccept callback with matchId:",
          matchId,
        );
        onAccept(matchId);
      } else {
        console.log(
          "[GameInviteCard] No matchId or onAccept. matchId:",
          matchId,
          "onAccept:",
          !!onAccept,
        );
      }
    } catch (error) {
      console.error("[GameInviteCard] Error accepting invite:", error);
      console.error(
        "[GameInviteCard] Error details:",
        JSON.stringify(error, Object.getOwnPropertyNames(error)),
      );
    } finally {
      console.log("[GameInviteCard] handleAccept FINISHED");
      setLoading(null);
    }
  };

  const handleDecline = async () => {
    console.log("[GameInviteCard] handleDecline called for invite:", invite.id);
    setLoading("decline");
    try {
      await respondToInvite(invite.id, false);
      onDecline?.();
    } catch (error) {
      console.error("[GameInviteCard] Error declining invite:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    setLoading("cancel");
    try {
      await cancelInvite(invite.id);
      onCancel?.();
    } catch (error) {
      console.error("[GameInviteCard] Error cancelling invite:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface },
        isExpired && styles.cardExpired,
      ]}
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

        {/* Invite Info */}
        <View style={styles.info}>
          <Text
            style={[styles.gameName, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {gameInfo.name}
          </Text>

          <Text
            style={[
              styles.playerName,
              { color: theme.colors.onSurfaceVariant },
            ]}
            numberOfLines={1}
          >
            {isOutgoing
              ? `To: ${invite.recipientName}`
              : `From: ${invite.senderName}`}
          </Text>

          {invite.message && (
            <Text
              style={[styles.message, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={1}
            >
              "{invite.message}"
            </Text>
          )}

          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: theme.colors.outline }]}>
              {getTimeAgo(invite.createdAt)}
            </Text>
            <Text
              style={[
                styles.expiresText,
                {
                  color: isExpired ? theme.colors.error : theme.colors.outline,
                },
              ]}
            >
              {getExpiresIn(invite.expiresAt)}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {isOutgoing ? (
            <Button
              mode="outlined"
              compact
              onPress={handleCancel}
              loading={loading === "cancel"}
              disabled={loading !== null || isExpired}
              textColor={theme.colors.error}
              style={styles.actionButton}
            >
              Cancel
            </Button>
          ) : (
            <>
              <Pressable
                style={[
                  styles.iconButton,
                  { backgroundColor: theme.colors.error + "20" },
                ]}
                onPressIn={() =>
                  console.log("[GameInviteCard] DECLINE onPressIn")
                }
                onPressOut={() =>
                  console.log("[GameInviteCard] DECLINE onPressOut")
                }
                onPress={() => {
                  console.log(
                    "[GameInviteCard] DECLINE BUTTON PRESSED - invite:",
                    invite.id,
                  );
                  handleDecline();
                }}
                disabled={loading !== null || isExpired}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.colors.error}
                />
              </Pressable>
              <Pressable
                style={[
                  styles.iconButton,
                  { backgroundColor: theme.colors.primary + "20" },
                ]}
                onPressIn={() =>
                  console.log("[GameInviteCard] ACCEPT onPressIn")
                }
                onPressOut={() =>
                  console.log("[GameInviteCard] ACCEPT onPressOut")
                }
                onPress={() => {
                  console.log(
                    "[GameInviteCard] ACCEPT BUTTON PRESSED - invite:",
                    invite.id,
                  );
                  handleAccept();
                }}
                disabled={loading !== null || isExpired}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={24}
                  color={theme.colors.primary}
                />
              </Pressable>
            </>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

// =============================================================================
// GameInvitesList Component
// =============================================================================

interface GameInvitesListProps {
  invites: GameInvite[];
  isOutgoing?: boolean;
  onAccept?: (
    matchId: string,
    gameType: TurnBasedGameType | RealTimeGameType,
  ) => void;
  onRefresh?: () => void;
  emptyMessage?: string;
}

export function GameInvitesList({
  invites,
  isOutgoing = false,
  onAccept,
  onRefresh,
  emptyMessage = "No pending invites",
}: GameInvitesListProps) {
  const theme = useTheme();

  if (invites.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name={isOutgoing ? "send" : "inbox"}
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

  return (
    <View style={styles.listContainer}>
      {invites.map((invite) => (
        <GameInviteCard
          key={invite.id}
          invite={invite}
          isOutgoing={isOutgoing}
          onAccept={(matchId) => onAccept?.(matchId, invite.gameType)}
          onDecline={onRefresh}
          onCancel={onRefresh}
        />
      ))}
    </View>
  );
}

// =============================================================================
// GameInviteBadge Component (for notification count)
// =============================================================================

interface GameInviteBadgeProps {
  count: number;
}

export function GameInviteBadge({ count }: GameInviteBadgeProps) {
  const theme = useTheme();
  const colors = useColors();

  if (count === 0) return null;

  return (
    <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
      <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
        {count > 99 ? "99+" : count}
      </Text>
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
  cardExpired: {
    opacity: 0.6,
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
  gameName: {
    fontSize: 16,
    fontWeight: "600",
  },
  playerName: {
    fontSize: 14,
    marginTop: 2,
  },
  message: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
  },
  expiresText: {
    fontSize: 11,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  actionButton: {
    borderRadius: BorderRadius.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    paddingHorizontal: Spacing.md,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
});
