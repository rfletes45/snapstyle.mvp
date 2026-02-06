/**
 * ChatGameInvites.tsx
 *
 * A collapsible section for displaying game invites within chat screens.
 * Shows universal game invites AND spectator invites for a specific conversation.
 *
 * @module components/chat/ChatGameInvites
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { UniversalInviteCard } from "@/components/games";
import { SpectatorInviteCard } from "@/components/games/SpectatorInviteCard";
import {
  cancelSpectatorInvite,
  cancelUniversalInvite,
  claimInviteSlot,
  cleanupCompletedGameInvites,
  cleanupSpectatorInvites,
  joinAsSpectator,
  joinSpectatorInvite,
  leaveSpectatorInvite,
  SpectatorInvite,
  startGameEarly,
  startSpectatorInvite,
  subscribeToConversationInvites,
  subscribeToConversationSpectatorInvites,
  unclaimInviteSlot,
} from "@/services/gameInvites";
import {
  createLiveSession,
  startLiveSession,
} from "@/services/liveSpectatorSession";
import { getFullProfileData } from "@/services/profileService";
import { SinglePlayerGameType } from "@/types/games";
import type { UniversalGameInvite } from "@/types/turnBased";

import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface ChatGameInvitesProps {
  /** The conversation ID (chatId or groupId) */
  conversationId: string;
  /** Current user's ID */
  currentUserId: string;
  /** Current user's display name */
  currentUserName: string;
  /** Current user's avatar config (optional) */
  currentUserAvatar?: string;
  /** Callback when user wants to navigate to a game */
  onNavigateToGame: (
    gameId: string,
    gameType: string,
    options?: {
      inviteId?: string;
      spectatorMode?: boolean;
      liveSessionId?: string;
    },
  ) => void;
  /** Whether the section starts expanded (default: true) */
  defaultExpanded?: boolean;
  /** Compact mode for smaller display */
  compact?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function ChatGameInvites({
  conversationId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onNavigateToGame,
  defaultExpanded = true,
  compact = false,
}: ChatGameInvitesProps) {
  const theme = useTheme();

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [invites, setInvites] = useState<UniversalGameInvite[]>([]);
  const [spectatorInvites, setSpectatorInvites] = useState<SpectatorInvite[]>(
    [],
  );
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);
  const [resolvedAvatar, setResolvedAvatar] = useState<string | undefined>(
    currentUserAvatar,
  );

  // Total invite count for badge
  const totalInviteCount = invites.length + spectatorInvites.length;

  // -------------------------------------------------------------------------
  // Fetch current user's profile picture URL if not provided via prop
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (currentUserAvatar) {
      setResolvedAvatar(currentUserAvatar);
      return;
    }
    if (!currentUserId) return;

    let cancelled = false;
    getFullProfileData(currentUserId)
      .then((profile) => {
        if (!cancelled && profile?.profilePicture?.url) {
          setResolvedAvatar(profile.profilePicture.url);
        }
      })
      .catch((err) => {
        console.warn("[ChatGameInvites] Failed to fetch profile picture:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, currentUserAvatar]);

  // -------------------------------------------------------------------------
  // Cleanup completed game invites on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    // Clean up any invites for games that have already completed
    // This handles the case where the Cloud Function didn't update the invite
    cleanupCompletedGameInvites(conversationId).catch((error) => {
      console.error("[ChatGameInvites] Cleanup error:", error);
    });

    // Also clean up stale spectator invites (expired, old cancelled/completed)
    cleanupSpectatorInvites(conversationId, currentUserId).catch((error) => {
      console.error("[ChatGameInvites] Spectator cleanup error:", error);
    });
  }, [conversationId, currentUserId]);

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  // Subscribe to universal (multiplayer) game invites
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const unsubscribe = subscribeToConversationInvites(
      conversationId,
      currentUserId,
      (updatedInvites) => {
        setInvites(updatedInvites);
        setLoading(false);
      },
      (error) => {
        console.error("[ChatGameInvites] Subscription error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [conversationId, currentUserId]);

  // Subscribe to spectator (single-player) invites
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const unsubscribe = subscribeToConversationSpectatorInvites(
      conversationId,
      currentUserId,
      (updatedInvites) => {
        setSpectatorInvites(updatedInvites);
      },
      (error) => {
        // Only log non-index-building errors (index building is handled with retries)
        const errorMessage = error.message || "";
        if (
          !errorMessage.includes("index") ||
          !errorMessage.includes("building")
        ) {
          console.error(
            "[ChatGameInvites] Spectator subscription error:",
            error,
          );
        }
      },
    );

    return () => unsubscribe();
  }, [conversationId, currentUserId]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleJoin = useCallback(
    async (invite: UniversalGameInvite) => {
      await claimInviteSlot(
        invite.id,
        currentUserId,
        currentUserName,
        resolvedAvatar,
      );
    },
    [currentUserId, currentUserName, resolvedAvatar],
  );

  const handleLeave = useCallback(
    async (invite: UniversalGameInvite) => {
      await unclaimInviteSlot(invite.id, currentUserId);
    },
    [currentUserId],
  );

  const handleSpectate = useCallback(
    async (invite: UniversalGameInvite) => {
      const result = await joinAsSpectator(
        invite.id,
        currentUserId,
        currentUserName,
        resolvedAvatar,
      );

      if (result.success && result.gameId) {
        onNavigateToGame(result.gameId, invite.gameType, {
          inviteId: invite.id,
          spectatorMode: true,
        });
      } else if (result.error) {
        console.error("[ChatGameInvites] Spectate failed:", result.error);
        // The invite subscription will update state if needed
      }
    },
    [currentUserId, currentUserName, resolvedAvatar, onNavigateToGame],
  );

  const handleStartEarly = useCallback(
    async (invite: UniversalGameInvite) => {
      if (!currentUserId) return;

      const result = await startGameEarly(invite.id, currentUserId);

      if (result.success && result.gameId) {
        onNavigateToGame(result.gameId, invite.gameType);
      } else if (result.error) {
        console.error("[ChatGameInvites] Start early failed:", result.error);
        // Invite will update via subscription if there's an error
      }
    },
    [currentUserId, onNavigateToGame],
  );

  const handleCancel = useCallback(
    async (invite: UniversalGameInvite) => {
      if (!currentUserId) return;

      const result = await cancelUniversalInvite(invite.id, currentUserId);

      if (!result.success) {
        console.error("[ChatGameInvites] Cancel failed:", result.error);
        // Invite will update via subscription
      }
    },
    [currentUserId],
  );

  const handlePlay = useCallback(
    (gameId: string, gameType: string) => {
      onNavigateToGame(gameId, gameType);
    },
    [onNavigateToGame],
  );

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // -------------------------------------------------------------------------
  // Spectator Invite Handlers
  // -------------------------------------------------------------------------

  const handleJoinSpectate = useCallback(
    async (invite: SpectatorInvite) => {
      try {
        await joinSpectatorInvite(
          invite.id,
          currentUserId,
          currentUserName,
          resolvedAvatar,
        );
      } catch (error) {
        console.error("[ChatGameInvites] Join spectate failed:", error);
      }
    },
    [currentUserId, currentUserName, resolvedAvatar],
  );

  const handleLeaveSpectate = useCallback(
    async (invite: SpectatorInvite) => {
      try {
        await leaveSpectatorInvite(invite.id, currentUserId);
      } catch (error) {
        console.error("[ChatGameInvites] Leave spectate failed:", error);
      }
    },
    [currentUserId],
  );

  const handleSpectatorStart = useCallback(
    async (invite: SpectatorInvite) => {
      try {
        // 1. Create a live spectator session
        const result = await createLiveSession({
          gameType: invite.gameType as SinglePlayerGameType,
          hostId: currentUserId,
          hostName: currentUserName,
          hostAvatar: resolvedAvatar,
          invitedUserIds: invite.eligibleUserIds,
          conversationId: invite.conversationId,
          conversationType: invite.context === "group" ? "group" : "dm",
          maxSpectators: invite.maxSpectators,
        });

        if (!result.success || !result.sessionId) {
          console.error(
            "[ChatGameInvites] Failed to create live session:",
            result.error,
          );
          return;
        }

        // 2. Update the spectator invite to "active" with the session ID
        await startSpectatorInvite(invite.id, result.sessionId);

        // 3. Start the live session so spectators see "active" status
        await startLiveSession(result.sessionId);

        // 4. Navigate to the game screen with the live session
        onNavigateToGame(invite.gameType, invite.gameType, {
          inviteId: invite.id,
          spectatorMode: false, // Host is playing, not spectating
          liveSessionId: result.sessionId,
        });
      } catch (error) {
        console.error(
          "[ChatGameInvites] Failed to start spectator game:",
          error,
        );
      }
    },
    [onNavigateToGame, currentUserId, currentUserName, resolvedAvatar],
  );

  const handleSpectatorCancel = useCallback(
    async (invite: SpectatorInvite) => {
      try {
        await cancelSpectatorInvite(invite.id);
      } catch (error) {
        console.error(
          "[ChatGameInvites] Cancel spectator invite failed:",
          error,
        );
      }
    },
    [currentUserId],
  );

  const handleWatch = useCallback(
    (invite: SpectatorInvite) => {
      if (!invite.liveSessionId) {
        console.warn("[ChatGameInvites] No liveSessionId for spectator invite");
        return;
      }
      // Navigate to spectator view screen
      onNavigateToGame(invite.liveSessionId, invite.gameType, {
        inviteId: invite.id,
        spectatorMode: true,
        liveSessionId: invite.liveSessionId,
      });
    },
    [onNavigateToGame],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Don't render if no invites of either type
  if (totalInviteCount === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.outline,
        },
      ]}
    >
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="gamepad-square"
            size={20}
            color={theme.colors.primary}
          />
          <Text
            style={[styles.headerTitle, { color: theme.colors.onSurface }]}
            variant="titleSmall"
          >
            Game Invites
          </Text>
          <View
            style={[styles.badge, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.badgeText}>{totalInviteCount}</Text>
          </View>
          {/* Show spectator count if any */}
          {spectatorInvites.length > 0 && (
            <View
              style={[
                styles.spectatorBadge,
                { backgroundColor: theme.colors.tertiary },
              ]}
            >
              <MaterialCommunityIcons name="eye" size={12} color="#fff" />
              <Text style={styles.spectatorBadgeText}>
                {spectatorInvites.length}
              </Text>
            </View>
          )}
        </View>
        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={24}
          color={theme.colors.onSurfaceVariant}
        />
      </TouchableOpacity>

      {/* Invites List */}
      {expanded && (
        <View style={styles.invitesList}>
          {/* Spectator invites first (single-player, more time-sensitive) */}
          {spectatorInvites.map((invite) => (
            <SpectatorInviteCard
              key={`spectator-${invite.id}`}
              invite={invite}
              currentUserId={currentUserId}
              onJoinSpectate={handleJoinSpectate}
              onLeaveSpectate={handleLeaveSpectate}
              onStartGame={handleSpectatorStart}
              onCancel={handleSpectatorCancel}
              onWatch={handleWatch}
              compact={compact}
            />
          ))}
          {/* Universal/Multiplayer invites */}
          {invites.map((invite) => (
            <UniversalInviteCard
              key={invite.id}
              invite={invite}
              currentUserId={currentUserId}
              onJoin={() => handleJoin(invite)}
              onLeave={() => handleLeave(invite)}
              onSpectate={() => handleSpectate(invite)}
              onStartEarly={() => handleStartEarly(invite)}
              onCancel={() => handleCancel(invite)}
              onPlay={handlePlay}
              compact={compact}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerTitle: {
    fontWeight: "600",
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  spectatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  spectatorBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  invitesList: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
});

export default ChatGameInvites;
