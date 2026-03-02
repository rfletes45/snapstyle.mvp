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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { InviteListSheet } from "@/components/chat/InviteListSheet";
import { InvitePillRow } from "@/components/chat/InvitePillRow";
import { UniversalInviteCard } from "@/components/games";
import { GAME_SESSIONS_V3 } from "@/constants/featureFlags";
import {
  cancelUniversalInvite,
  claimInviteSlot,
  cleanupCompletedGameInvites,
  completeGameInvite,
  startGameEarly,
  subscribeToConversationInvites,
  unclaimInviteSlot,
} from "@/services/gameInvites";
import {
  joinSession,
  subscribeToConversationSessions,
} from "@/services/gameSessions";
import { getFullProfileData } from "@/services/profileService";
import type { GameSessionV3, SessionParticipant } from "@/types/gameSessionV3";
import type { UniversalGameInvite } from "@/types/turnBased";

import { BorderRadius, Spacing } from "@/constants/theme";

import { createLogger } from "@/utils/log";
const logger = createLogger("components/chat/ChatGameInvites");

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert a v3-tagged GameInvites doc into a synthetic GameSessionV3 object
 * so it can be rendered by InvitePillRow / SessionPill alongside real sessions.
 *
 * The receiver isn't in the session's `participantUids`, so
 * `subscribeToConversationSessions` can't find it. The invite doc IS visible
 * to the receiver via `subscribeToConversationInvites` (eligibleUserIds).
 * This bridge converts that invite into a renderable session pill.
 */
function inviteToSyntheticSession(invite: UniversalGameInvite): GameSessionV3 {
  const hostParticipant: SessionParticipant = {
    uid: invite.senderId,
    displayName: invite.senderName || "Host",
    avatarUrl: invite.senderAvatar || "",
    role: "host",
    status: "joined",
    joinedAt: invite.createdAt,
  };

  return {
    id: invite.v3SessionId!,
    gameType: invite.gameType,
    runtimeType: "turnBased",
    visibility: "private",
    phase: "lobby",
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
    hostUid: invite.senderId,
    participants: [hostParticipant],
    maxParticipants: invite.maxPlayers || 2,
    maxSpectators: 10,
  };
}

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
  /**
   * v3: Navigate to SessionLobbyScreen for a session.
   * Only used when GAME_SESSIONS_V3.COMPACT_CHAT_PILLS is enabled.
   */
  onNavigateToLobby?: (sessionId: string) => void;
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
  onNavigateToLobby,
  defaultExpanded = true,
  compact = false,
}: ChatGameInvitesProps) {
  const theme = useTheme();

  // -------------------------------------------------------------------------
  // v3 feature flag check
  // -------------------------------------------------------------------------

  const useV3Pills =
    GAME_SESSIONS_V3.ENABLED && GAME_SESSIONS_V3.COMPACT_CHAT_PILLS;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [invites, setInvites] = useState<UniversalGameInvite[]>([]);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);
  const [resolvedAvatar, setResolvedAvatar] = useState<string | undefined>(
    currentUserAvatar,
  );

  // Optimistic hide: invite IDs locally marked as resolved.
  // Once completeGameInvite / cancelUniversalInvite fires, the ID is added
  // here so the card disappears immediately without waiting for the Firestore
  // snapshot round-trip.
  const optimisticHiddenRef = useRef<Set<string>>(new Set());

  // v3: sessions for compact pill rendering
  const [v3Sessions, setV3Sessions] = useState<GameSessionV3[]>([]);
  const [v3SheetVisible, setV3SheetVisible] = useState(false);

  // -------------------------------------------------------------------------
  // v3: Merge real sessions + synthetic sessions from GameInvites
  // -------------------------------------------------------------------------

  const mergedSessions = useMemo(() => {
    if (!useV3Pills) return [];

    // Start with real sessions (already discovered via participantUids)
    const sessionMap = new Map<string, GameSessionV3>();
    for (const s of v3Sessions) {
      sessionMap.set(s.id, s);
    }

    // Add synthetic sessions from v3-tagged GameInvites that aren't
    // already represented. This makes invite pills visible to receivers
    // who aren't in the session's participantUids yet.
    const v3Invites = invites.filter(
      (inv) => inv.v3SessionId && !sessionMap.has(inv.v3SessionId),
    );

    for (const inv of v3Invites) {
      sessionMap.set(inv.v3SessionId!, inviteToSyntheticSession(inv));
    }

    logger.info("[ChatGameInvites] mergedSessions computed", {
      realSessions: v3Sessions.length,
      v3Invites: v3Invites.length,
      merged: sessionMap.size,
      inviteIds: v3Invites.map((i) => i.id).join(","),
    });

    return [...sessionMap.values()];
  }, [useV3Pills, v3Sessions, invites]);

  // Total invite count: v3 pills use merged count, v2 uses invites count.
  const totalInviteCount = useV3Pills ? mergedSessions.length : invites.length;

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

  // Subscribe to GameInvites (the pointer docs that show invite pills in chat).
  // In v3, this is the PRIMARY source for pending invite pills because
  // inviteToSessionV3 no longer modifies session.participants, meaning the
  // GameSessions query won't match recipients until they explicitly join.
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const unsubscribe = subscribeToConversationInvites(
      conversationId,
      currentUserId,
      (updatedInvites) => {
        logger.info(
          `[ChatGameInvites] CHATINV.LIST.RECEIVED count=${updatedInvites.length} conversationId=${conversationId}`,
          {
            ids: updatedInvites.map((i) => i.id),
            v3Ids: updatedInvites
              .filter((i) => i.v3SessionId)
              .map((i) => i.v3SessionId),
            statuses: updatedInvites.map((i) => i.status),
          },
        );
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
  // v3: Subscribe to GameSessions (behind feature flag)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!useV3Pills || !conversationId || !currentUserId) return;

    const unsub = subscribeToConversationSessions(
      conversationId,
      currentUserId,
      (sessions) => {
        logger.info(
          `[V3] ChatGameInvites sessions update: count=${sessions.length}, phases=${sessions.map((s) => s.phase).join(",")}`,
        );
        setV3Sessions(sessions);
      },
      (error) => {
        logger.error("[ChatGameInvites] V3 sessions sub error:", error);
      },
    );

    return () => unsub();
  }, [conversationId, currentUserId, useV3Pills]);

  // -------------------------------------------------------------------------
  // Phase 2: Leak guard — auto-resolve invites stuck "active" for >3 hours
  // -------------------------------------------------------------------------

  const leakGuardFiredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (useV3Pills) return; // leak guard only applies to v2 invites
    if (invites.length === 0) return;

    const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

    const sweep = () => {
      const now = Date.now();
      for (const inv of invites) {
        if (
          inv.status === "active" &&
          now - inv.createdAt > THREE_HOURS_MS &&
          !leakGuardFiredRef.current.has(inv.id)
        ) {
          leakGuardFiredRef.current.add(inv.id);
          logger.warn(
            `[ChatGameInvites] Leak guard: invite ${inv.id} stuck active for >3h, auto-resolving`,
          );
          // Optimistic hide: don't wait for Firestore snapshot
          optimisticHiddenRef.current.add(inv.id);
          completeGameInvite(inv.id).catch((err) =>
            logger.error(
              `[ChatGameInvites] Leak guard failed for ${inv.id}:`,
              err,
            ),
          );
        }
      }
    };

    // Run immediately on invites change, then every 60s
    sweep();
    const interval = setInterval(sweep, 60_000);
    return () => clearInterval(interval);
  }, [invites]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleJoin = useCallback(
    async (invite: UniversalGameInvite) => {
      // v3: pre-join the session, then navigate to the lobby.
      // The lobby has an auto-join fallback, but calling joinSession
      // here means the user is already a participant by the time the
      // lobby screen renders, giving instant feedback to both players.
      if (
        invite.v3SessionId &&
        GAME_SESSIONS_V3.ENABLED &&
        GAME_SESSIONS_V3.SESSION_LOBBY &&
        onNavigateToLobby
      ) {
        logger.info(
          `[ChatGameInvites] v3 handleJoin → pre-join + lobby sessionId=${invite.v3SessionId}`,
        );
        // Fire-and-forget: joinSession is idempotent, so even if the
        // lobby auto-join also fires, it won't double-add.
        joinSession({ sessionId: invite.v3SessionId }).catch((err) =>
          logger.warn("[ChatGameInvites] pre-join failed (lobby will retry)", {
            error: String(err),
          }),
        );
        onNavigateToLobby(invite.v3SessionId);
        return;
      }

      const result = await claimInviteSlot(
        invite.id,
        currentUserId,
        currentUserName,
        resolvedAvatar,
      );

      // Always navigate the joiner into the game's built-in lobby with
      // inviteId.  The lobby hook subscribes to the invite doc and waits
      // for the host to start the game.  Previously this only navigated
      // when colyseusRoomKey or gameId were set, which meant turn-based
      // invites created from chat (no roomKey, no gameId yet) left the
      // joiner stranded in chat instead of entering the lobby.
      //
      // IMPORTANT: Do NOT pass matchId when inviteId is present — the
      // lobby hook should enter queue mode (subscribe to invite doc) and
      // resolve the correct firestoreGameId from inv.gameId when the
      // invite becomes active.  Passing both matchId + inviteId would
      // skip queue mode and use the stale colyseusRoomKey, which breaks
      // invite finalization for external Colyseus games.
      if (result.success) {
        onNavigateToGame("", invite.gameType, {
          inviteId: invite.id,
        });
      }
    },
    [currentUserId, currentUserName, resolvedAvatar, onNavigateToGame],
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

      // Do NOT navigate here — the UniversalInviteCard auto-navigate effect
      // detects the invite transitioning to "active" and navigates ALL
      // participants (host included) via onPlay with the inviteId.
      // Navigating here as well caused a double-navigation bug where the
      // second (auto-navigate) call overwrote the first and the host lost
      // the inviteId param, bypassing the lobby and ending up in a
      // different Colyseus room than the opponent.
      if (!result.success && result.error) {
        logger.error("[ChatGameInvites] Start early failed:", result.error);
      }
    },
    [currentUserId],
  );

  const handleCancel = useCallback(
    async (invite: UniversalGameInvite) => {
      if (!currentUserId) return;

      // Optimistic hide: remove from UI immediately
      optimisticHiddenRef.current.add(invite.id);
      // Force re-render so the filter picks up the new set
      setInvites((prev) => [...prev]);

      const result = await cancelUniversalInvite(invite.id, currentUserId);

      if (!result.success) {
        // Rollback optimistic hide on failure
        optimisticHiddenRef.current.delete(invite.id);
        setInvites((prev) => [...prev]);
        logger.error("[ChatGameInvites] Cancel failed:", result.error);
        // Invite will update via subscription
      }
    },
    [currentUserId],
  );

  const handlePlay = useCallback(
    (
      gameId: string,
      gameType: string,
      inviteId?: string,
      v3SessionId?: string,
    ) => {
      // v3: route through SessionLobbyScreen when session ID is present
      if (
        v3SessionId &&
        GAME_SESSIONS_V3.ENABLED &&
        GAME_SESSIONS_V3.SESSION_LOBBY &&
        onNavigateToLobby
      ) {
        logger.info(
          `[ChatGameInvites] v3 handlePlay → lobby sessionId=${v3SessionId}`,
        );
        onNavigateToLobby(v3SessionId);
        return;
      }
      // v2 fallback
      onNavigateToGame(gameId, gameType, inviteId ? { inviteId } : undefined);
    },
    [onNavigateToGame, onNavigateToLobby],
  );

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // -------------------------------------------------------------------------
  // CHATINV filter + trace logging
  // -------------------------------------------------------------------------
  const TERMINAL_SET = new Set([
    "completed",
    "declined",
    "expired",
    "cancelled",
  ]);
  const visibleInvites = invites.filter(
    (inv) =>
      inv.chatVisibility !== "hidden" &&
      !TERMINAL_SET.has(inv.status) &&
      !inv.resolvedAt && // extra safety: resolvedAt present → game is done
      !optimisticHiddenRef.current.has(inv.id), // optimistic local hide
  );

  // Log filter results for stuck-invite diagnosis
  if (invites.length > 0) {
    logger.debug(
      `[ChatGameInvites] CHATINV.LIST.FILTERED before=${invites.length} after=${visibleInvites.length}`,
    );
    for (const inv of visibleInvites) {
      const reason = !inv.chatVisibility
        ? "fallback_missing_chatVisibility"
        : "status_nonterminal_and_not_hidden";
      logger.debug(
        `[ChatGameInvites] CHATINV.CARD.VISIBLE inviteId=${inv.id} status=${inv.status} chatVisibility=${inv.chatVisibility ?? "undefined"} reason=${reason}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Don't render if no invites of either type
  if (totalInviteCount === 0) {
    return null;
  }

  // v3: ALWAYS render compact pill row when v3 pills are enabled.
  // Never fall through to legacy tall cards.
  if (useV3Pills) {
    return (
      <>
        <InvitePillRow
          sessions={mergedSessions}
          currentUserId={currentUserId}
          onNavigateToLobby={(sessionId) => {
            logger.info("[ChatInvites] navigateToLobby", {
              sessionId,
              hasHandler: !!onNavigateToLobby,
            });
            if (onNavigateToLobby) {
              onNavigateToLobby(sessionId);
            } else {
              logger.error("[ChatInvites] onNavigateToLobby prop is UNDEFINED");
            }
          }}
          onShowMore={() => setV3SheetVisible(true)}
        />
        <InviteListSheet
          visible={v3SheetVisible}
          sessions={mergedSessions}
          currentUserId={currentUserId}
          onNavigateToLobby={(sessionId) => {
            logger.info("[ChatInvites] InviteListSheet → navigateToLobby", {
              sessionId,
            });
            onNavigateToLobby?.(sessionId);
          }}
          onClose={() => setV3SheetVisible(false)}
        />
      </>
    );
  }

  // v2: Legacy tall cards (only reachable when v3 flags are OFF)
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
            size={18}
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
          size={20}
          color={theme.colors.onSurfaceVariant}
        />
      </TouchableOpacity>

      {/* Invites List */}
      {expanded && (
        <View style={styles.invitesList}>
          {visibleInvites.map((invite) => (
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
    marginVertical: Spacing.xs,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  headerTitle: {
    fontWeight: "600",
    fontSize: 13,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  invitesList: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
});

export default ChatGameInvites;
