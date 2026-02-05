/**
 * SpectatorInviteCard
 *
 * A card component for displaying spectator invites (single-player games).
 * Shows host info, game type, spectator count, and action buttons.
 *
 * @file src/components/games/SpectatorInviteCard.tsx
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";

import { SpectatorInvite } from "@/services/gameInvites";
import { GAME_METADATA } from "@/types/games";
import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface SpectatorInviteCardProps {
  /** The spectator invite to display */
  invite: SpectatorInvite;
  /** Current user's ID */
  currentUserId: string;
  /** Called when user wants to join as spectator */
  onJoinSpectate: (invite: SpectatorInvite) => void;
  /** Called when user wants to leave spectating */
  onLeaveSpectate: (invite: SpectatorInvite) => void;
  /** Called when host wants to start the game */
  onStartGame: (invite: SpectatorInvite) => void;
  /** Called when host wants to cancel */
  onCancel: (invite: SpectatorInvite) => void;
  /** Called when spectator wants to watch (game already active) */
  onWatch: (invite: SpectatorInvite) => void;
  /** Compact display mode */
  compact?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function SpectatorInviteCard({
  invite,
  currentUserId,
  onJoinSpectate,
  onLeaveSpectate,
  onStartGame,
  onCancel,
  onWatch,
  compact = false,
}: SpectatorInviteCardProps) {
  const theme = useTheme();

  // Computed values
  const isHost = invite.hostId === currentUserId;
  const isSpectator = invite.spectators.some((s) => s.userId === currentUserId);
  const gameMetadata = GAME_METADATA[invite.gameType];
  const gameName = gameMetadata?.name || invite.gameType;
  const gameIcon = gameMetadata?.icon || "🎮";
  const spectatorCount = invite.spectators.length;
  const maxSpectators = invite.maxSpectators || 10;
  const isFull = spectatorCount >= maxSpectators;
  const isActive = invite.status === "active";
  const isPending = invite.status === "pending";

  // Status text
  const getStatusText = () => {
    if (isActive) return "🔴 LIVE";
    if (isPending) return "Waiting to start";
    return invite.status;
  };

  // Status color
  const getStatusColor = () => {
    if (isActive) return theme.colors.error;
    if (isPending) return theme.colors.tertiary;
    return theme.colors.outline;
  };

  return (
    <Surface
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: isActive ? theme.colors.error : theme.colors.primary,
        },
      ]}
      elevation={1}
    >
      {/* Spectator badge - differentiates from regular game invites */}
      <View
        style={[
          styles.spectatorBadge,
          { backgroundColor: theme.colors.tertiary },
        ]}
      >
        <MaterialCommunityIcons name="eye" size={12} color="#fff" />
        <Text style={styles.spectatorBadgeText}>SPECTATE</Text>
      </View>

      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.gameIcon}>{gameIcon}</Text>
        <View style={styles.headerInfo}>
          <Text
            style={[styles.gameName, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {gameName}
          </Text>
          <Text
            style={[styles.hostText, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {isHost ? "You are hosting" : `Hosted by ${invite.hostName}`}
          </Text>
        </View>
        <View
          style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}
        >
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>

      {/* Spectator Info */}
      <View style={styles.spectatorInfo}>
        <MaterialCommunityIcons
          name="eye-outline"
          size={16}
          color={theme.colors.onSurfaceVariant}
        />
        <Text
          style={[
            styles.spectatorCountText,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {spectatorCount}/{maxSpectators} spectators
        </Text>
        {isSpectator && (
          <View
            style={[
              styles.joinedBadge,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Text
              style={[
                styles.joinedBadgeText,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              Joined
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {isHost ? (
          // Host actions
          <>
            {isPending && (
              <>
                <Button
                  mode="contained"
                  onPress={() => onStartGame(invite)}
                  style={styles.actionButton}
                  icon="play"
                  compact={compact}
                >
                  Start Game
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => onCancel(invite)}
                  style={styles.actionButton}
                  compact={compact}
                >
                  Cancel
                </Button>
              </>
            )}
            {isActive && (
              <Button
                mode="contained"
                onPress={() => onWatch(invite)}
                style={styles.actionButton}
                icon="play"
                compact={compact}
              >
                Resume Game
              </Button>
            )}
          </>
        ) : isSpectator ? (
          // Spectator who has joined
          <>
            {isActive && (
              <Button
                mode="contained"
                onPress={() => onWatch(invite)}
                style={styles.actionButton}
                icon="eye"
                compact={compact}
              >
                Watch Live
              </Button>
            )}
            <Button
              mode="outlined"
              onPress={() => onLeaveSpectate(invite)}
              style={styles.actionButton}
              compact={compact}
            >
              Leave
            </Button>
          </>
        ) : (
          // User who hasn't joined yet
          <>
            {isActive && (
              <Button
                mode="contained"
                onPress={() => onWatch(invite)}
                style={styles.actionButton}
                icon="eye"
                disabled={isFull}
                compact={compact}
              >
                Watch Live
              </Button>
            )}
            {isPending && (
              <Button
                mode="contained"
                onPress={() => onJoinSpectate(invite)}
                style={styles.actionButton}
                icon="eye-plus"
                disabled={isFull}
                compact={compact}
              >
                {isFull ? "Full" : "Join to Watch"}
              </Button>
            )}
          </>
        )}
      </View>
    </Surface>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    padding: Spacing.md,
    position: "relative",
  },
  spectatorBadge: {
    position: "absolute",
    top: -8,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  spectatorBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  gameIcon: {
    fontSize: 32,
  },
  headerInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 16,
    fontWeight: "600",
  },
  hostText: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  spectatorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  spectatorCountText: {
    fontSize: 13,
    flex: 1,
  },
  joinedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  joinedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});

export default SpectatorInviteCard;
