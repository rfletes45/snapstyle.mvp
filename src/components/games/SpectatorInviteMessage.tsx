/**
 * SpectatorInviteMessage
 *
 * A chat message component that displays a spectator invite for a single-player game.
 * Shows the game info, host info, and allows users to join as spectators.
 *
 * @file src/components/games/SpectatorInviteMessage.tsx
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";

import {
  joinSpectatorInvite,
  SpectatorInvite,
  SpectatorInviteStatus,
} from "@/services/gameInvites";
import { useAuth } from "@/store/AuthContext";
import { GAME_METADATA } from "@/types/games";
import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface SpectatorInviteMessageProps {
  /** The spectator invite data */
  invite: SpectatorInvite;
  /** Called when user wants to watch the game */
  onWatch: (liveSessionId: string) => void;
  /** Called on error */
  onError?: (error: string) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusText(status: SpectatorInviteStatus): string {
  switch (status) {
    case "pending":
      return "Waiting to start...";
    case "active":
      return "Live now!";
    case "completed":
      return "Game ended";
    case "expired":
      return "Invite expired";
    case "cancelled":
      return "Cancelled";
    default:
      return "";
  }
}

function getStatusColor(
  status: SpectatorInviteStatus,
  theme: { colors: { tertiary: string; primary: string; outline: string } },
): string {
  switch (status) {
    case "pending":
      return theme.colors.tertiary;
    case "active":
      return theme.colors.primary;
    case "completed":
    case "expired":
    case "cancelled":
      return theme.colors.outline;
    default:
      return theme.colors.outline;
  }
}

// =============================================================================
// Component
// =============================================================================

export function SpectatorInviteMessage({
  invite,
  onWatch,
  onError,
}: SpectatorInviteMessageProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);

  // Get game info
  const gameMetadata = GAME_METADATA[invite.gameType];
  const gameName = gameMetadata?.name || invite.gameType;
  const gameIcon = gameMetadata?.icon || "🎮";

  // Check if current user is host
  const isHost = currentFirebaseUser?.uid === invite.hostId;

  // Check if current user is already a spectator
  const isSpectator = useMemo(
    () => invite.spectators.some((s) => s.userId === currentFirebaseUser?.uid),
    [invite.spectators, currentFirebaseUser?.uid],
  );

  // Determine if user can join
  const canJoin = useMemo(() => {
    if (!currentFirebaseUser) return false;
    if (isHost) return false;
    if (isSpectator) return true; // Can watch again
    if (invite.status !== "pending" && invite.status !== "active") return false;
    if (Date.now() > invite.expiresAt) return false;
    if (
      invite.maxSpectators !== undefined &&
      invite.spectators.length >= invite.maxSpectators
    ) {
      return false;
    }
    return invite.eligibleUserIds.includes(currentFirebaseUser.uid);
  }, [invite, currentFirebaseUser, isHost, isSpectator]);

  // Handle watch button press
  const handleWatch = useCallback(async () => {
    if (!currentFirebaseUser) {
      onError?.("Not authenticated");
      return;
    }

    setLoading(true);

    try {
      const result = await joinSpectatorInvite(
        invite.id,
        currentFirebaseUser.uid,
        currentFirebaseUser.displayName || "Spectator",
        undefined,
      );

      if (result.success) {
        if (result.liveSessionId) {
          onWatch(result.liveSessionId);
        } else {
          // Game hasn't started yet
          onError?.(
            "Game hasn't started yet. Please wait for the host to begin.",
          );
        }
      } else {
        onError?.(result.error || "Failed to join as spectator");
      }
    } catch (error: any) {
      console.error("[SpectatorInviteMessage] Error joining:", error);
      onError?.(error.message || "Failed to join as spectator");
    } finally {
      setLoading(false);
    }
  }, [invite.id, currentFirebaseUser, onWatch, onError]);

  const statusColor = getStatusColor(invite.status, theme);
  const isActive = invite.status === "active";
  const isEnded = ["completed", "expired", "cancelled"].includes(invite.status);

  return (
    <Surface
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceVariant,
        },
      ]}
      elevation={1}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.gameInfo}>
          <Text style={styles.gameIcon}>{gameIcon}</Text>
          <View>
            <Text style={[styles.gameName, { color: theme.colors.onSurface }]}>
              {gameName}
            </Text>
            <Text
              style={[
                styles.hostName,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Hosted by {isHost ? "you" : invite.hostName}
            </Text>
          </View>
        </View>

        {/* Status Badge */}
        <View
          style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}
        >
          {isActive && (
            <View
              style={[styles.liveDot, { backgroundColor: theme.colors.error }]}
            />
          )}
          <Text style={[styles.statusText, { color: statusColor }]}>
            {getStatusText(invite.status)}
          </Text>
        </View>
      </View>

      {/* Spectator count */}
      <View style={styles.spectatorInfo}>
        <MaterialCommunityIcons
          name="eye"
          size={16}
          color={theme.colors.onSurfaceVariant}
        />
        <Text
          style={[
            styles.spectatorCount,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {invite.spectators.length}{" "}
          {invite.spectators.length === 1 ? "spectator" : "spectators"}
          {invite.maxSpectators ? ` / ${invite.maxSpectators} max` : ""}
        </Text>
      </View>

      {/* Actions */}
      {!isEnded && (
        <View style={styles.actions}>
          {isHost ? (
            <Text
              style={[
                styles.hostHint,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {invite.status === "pending"
                ? "Start the game and others can watch!"
                : "You're playing - spectators can watch your game!"}
            </Text>
          ) : canJoin ? (
            <Button
              mode={isActive ? "contained" : "outlined"}
              onPress={handleWatch}
              loading={loading}
              disabled={
                loading ||
                (invite.status === "pending" && !invite.liveSessionId)
              }
              icon={isActive ? "eye" : "clock-outline"}
              compact
            >
              {isActive
                ? "Watch Now"
                : isSpectator
                  ? "Waiting..."
                  : "Join to Watch"}
            </Button>
          ) : (
            <Text style={[styles.notEligible, { color: theme.colors.outline }]}>
              {invite.maxSpectators &&
              invite.spectators.length >= invite.maxSpectators
                ? "Max spectators reached"
                : "Not available"}
            </Text>
          )}
        </View>
      )}

      {/* Ended message */}
      {isEnded && (
        <View style={styles.endedContainer}>
          <MaterialCommunityIcons
            name="check-circle"
            size={20}
            color={theme.colors.outline}
          />
          <Text style={[styles.endedText, { color: theme.colors.outline }]}>
            {invite.status === "completed"
              ? "Game has ended"
              : invite.status === "expired"
                ? "This invite has expired"
                : "This invite was cancelled"}
          </Text>
        </View>
      )}
    </Surface>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginVertical: Spacing.xs,
    maxWidth: 300,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  gameInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  gameIcon: {
    fontSize: 32,
    marginRight: Spacing.sm,
  },
  gameName: {
    fontSize: 16,
    fontWeight: "600",
  },
  hostName: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  spectatorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  spectatorCount: {
    fontSize: 12,
  },
  actions: {
    marginTop: Spacing.xs,
  },
  hostHint: {
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
  },
  notEligible: {
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
  endedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.xs,
  },
  endedText: {
    fontSize: 12,
  },
});

export default SpectatorInviteMessage;
