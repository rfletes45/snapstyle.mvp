/**
 * ChatGameInvites.tsx
 *
 * A collapsible section for displaying game invites within chat screens.
 * Shows universal game invites for a specific conversation.
 *
 * @module components/chat/ChatGameInvites
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { UniversalInviteCard } from "@/components/games";
import {
  cancelGameInvite,
  claimInviteSlot,
  joinAsSpectator,
  subscribeToConversationInvites,
  unclaimInviteSlot,
} from "@/services/gameInvites";
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
  onNavigateToGame: (gameId: string, gameType: string) => void;
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

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleJoin = useCallback(
    async (invite: UniversalGameInvite) => {
      await claimInviteSlot(
        invite.id,
        currentUserId,
        currentUserName,
        currentUserAvatar,
      );
    },
    [currentUserId, currentUserName, currentUserAvatar],
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
        currentUserAvatar,
      );

      if (result.success && result.gameId) {
        onNavigateToGame(result.gameId, invite.gameType);
      }
    },
    [currentUserId, currentUserName, currentUserAvatar, onNavigateToGame],
  );

  const handleCancel = useCallback(
    async (invite: UniversalGameInvite) => {
      await cancelGameInvite(invite.id, currentUserId);
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

  // Don't render if no invites
  if (invites.length === 0) {
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
            <Text style={styles.badgeText}>{invites.length}</Text>
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
