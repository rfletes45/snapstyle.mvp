/**
 * ChatGameInvites.tsx
 *
 * A collapsible section for displaying game invites within chat screens.
 * Shows universal game invites for a specific conversation.
 *
 * Spectating is handled via Colyseus — when a user spectates an active
 * multiplayer game, they navigate to the game screen with spectatorMode=true
 * and join the same Colyseus room as a spectator.
 *
 * @module components/chat/ChatGameInvites
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { UniversalInviteCard } from "@/components/games";
import {
  cancelUniversalInvite,
  claimInviteSlot,
  cleanupCompletedGameInvites,
  startGameEarly,
  subscribeToConversationInvites,
  unclaimInviteSlot,
} from "@/services/gameInvites";
import { getFullProfileData } from "@/services/profileService";
import type { UniversalGameInvite } from "@/types/turnBased";

import { BorderRadius, Spacing } from "@/constants/theme";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/chat/ChatGameInvites");
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
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);
  const [resolvedAvatar, setResolvedAvatar] = useState<string | undefined>(
    currentUserAvatar,
  );

  // Total invite count for badge
  const totalInviteCount = invites.length;

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
        logger.warn("[ChatGameInvites] Failed to fetch profile picture:", err);
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
      logger.error("[ChatGameInvites] Cleanup error:", error);
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
        logger.error("[ChatGameInvites] Subscription error:", error);
        setLoading(false);
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
    (invite: UniversalGameInvite) => {
      if (!invite.gameId) return;

      // Navigate to game screen with spectatorMode — the game screen will
      // join the Colyseus room as a spectator automatically
      onNavigateToGame(invite.gameId, invite.gameType, {
        inviteId: invite.id,
        spectatorMode: true,
      });
    },
    [onNavigateToGame],
  );

  const handleStartEarly = useCallback(
    async (invite: UniversalGameInvite) => {
      if (!currentUserId) return;

      const result = await startGameEarly(invite.id, currentUserId);

      if (result.success && result.gameId) {
        onNavigateToGame(result.gameId, invite.gameType);
      } else if (result.error) {
        logger.error("[ChatGameInvites] Start early failed:", result.error);
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
        logger.error("[ChatGameInvites] Cancel failed:", result.error);
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
  invitesList: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
});

export default ChatGameInvites;
