/**
 * SessionLobbyScreen — Universal v3 Multiplayer Lobby
 *
 * The single entry point for ALL multiplayer games in the v3 session-first
 * architecture. This screen:
 *
 *   1. Subscribes to `GameSessions/{sessionId}` in real-time
 *   2. Shows a lobby UI with participants, game info, and action buttons
 *   3. Gates navigation to the actual game screen until the session
 *      transitions to "starting" or "active"
 *   4. Handles host start, participant join/leave, and error states
 *
 * Route params:
 *   - sessionId: The v3 session document ID
 *   - source: How the user got here ("chat" | "play" | "recovery" | etc.)
 *
 * @module screens/games/SessionLobbyScreen
 */

import InvitePickerModal, {
  type FriendItem,
  type GroupItem,
} from "@/components/InvitePickerModal";
import { GAME_SCREEN_MAP } from "@/config/gameCategories";
import { Spacing } from "@/constants/theme";
import { useSessionLobby } from "@/hooks/useSessionLobby";
import { buildDmConversationId } from "@/services/gameInvites";
import { inviteToSession } from "@/services/gameSessions";
import { useAuth } from "@/store/AuthContext";
import type { SessionParticipant } from "@/types/gameSessionV3";
import { isSessionTerminal } from "@/types/gameSessionV3";
import type { PlayStackParamList } from "@/types/navigation/root";
import { createLogger } from "@/utils/log";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

const logger = createLogger("screens/games/SessionLobbyScreen");

// =============================================================================
// Props
// =============================================================================

type Props = NativeStackScreenProps<PlayStackParamList, "SessionLobbyScreen">;

// =============================================================================
// Component
// =============================================================================

export default function SessionLobbyScreen({ route, navigation }: Props) {
  const { sessionId, source } = route.params;
  const theme = useTheme();
  const navigatedRef = useRef(false);
  const { currentFirebaseUser } = useAuth();

  // ---------------------------------------------------------------------------
  // Delegate ALL lobby logic to the shared hook
  // ---------------------------------------------------------------------------

  const {
    phase,
    session,
    isHost,
    isInSession,
    isInvited,
    canJoin,
    myParticipant,
    lobbyFull,
    canStart,
    gameDisplayName,
    error,
    actionLoading,
    handleJoin,
    handleStart,
    handleLeave,
    handleBack,
    navReady,
    trace,
  } = useSessionLobby(sessionId, source, GAME_SCREEN_MAP, navigation.dispatch);

  const uid = myParticipant?.uid;

  // ---------------------------------------------------------------------------
  // Debug panel state (DEV only — tap phase badge 5x to toggle)
  // ---------------------------------------------------------------------------

  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const debugTapCount = useRef(0);
  const debugTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePhaseBadgeTap = useCallback(() => {
    if (!__DEV__) return;
    debugTapCount.current += 1;
    if (debugTapTimer.current) clearTimeout(debugTapTimer.current);
    if (debugTapCount.current >= 5) {
      setShowDebugPanel((prev) => !prev);
      debugTapCount.current = 0;
    } else {
      debugTapTimer.current = setTimeout(() => {
        debugTapCount.current = 0;
      }, 1500);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Invite picker state
  // ---------------------------------------------------------------------------

  const [showInvitePicker, setShowInvitePicker] = useState(false);

  const currentUid = currentFirebaseUser?.uid ?? "";

  const handleSelectFriend = useCallback(
    async (friend: FriendItem) => {
      setShowInvitePicker(false);
      if (!currentUid) return;
      // Compute deterministic DM conversation ID
      const conversationId = buildDmConversationId(
        currentUid,
        friend.friendUid,
      );
      trace.info("LOBBY.INVITE.SEND.PRESS", {
        sessionId,
        recipientUid: friend.friendUid,
        conversationId,
      });
      const result = await inviteToSession(
        { sessionId, recipientUid: friend.friendUid, conversationId },
        trace,
      );
      if (!result.success) {
        logger.warn("[SessionLobby] invite failed", {
          error: result.error,
          friendUid: friend.friendUid,
        });
      }
    },
    [sessionId, trace, currentUid],
  );

  const handleSelectGroup = useCallback(
    async (group: GroupItem) => {
      setShowInvitePicker(false);
      if (!currentUid) return;
      // For group invites, the conversationId IS the groupId
      const conversationId = group.groupId;
      trace.info("LOBBY.INVITE.SEND.PRESS", {
        sessionId,
        conversationId,
        groupId: group.groupId,
        memberCount: group.memberIds.length,
      });
      // Pass all group member UIDs as eligibleUserIds — the CF uses them
      // for the GameInvites doc so every member's chat sees the pill.
      // No recipientUid for group invites.
      const result = await inviteToSession(
        {
          sessionId,
          conversationId,
          eligibleUserIds: group.memberIds,
        },
        trace,
      );
      if (!result.success) {
        logger.warn("[SessionLobby] group invite failed", {
          error: result.error,
          groupId: group.groupId,
        });
      }
    },
    [sessionId, trace, currentUid],
  );

  // ---------------------------------------------------------------------------
  // Auto-navigate when the hook signals readiness
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!navReady || navigatedRef.current) return;
    navigatedRef.current = true;

    logger.info("[SessionLobby] auto-navigate", {
      screen: navReady.screenName,
      sessionId,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigation as any).replace(navReady.screenName, navReady.params);
  }, [navReady, navigation, sessionId]);

  // Navigate to game-over when session is resolved
  useEffect(() => {
    if (!session || navigatedRef.current) return;
    if (session.phase === "resolved") {
      navigatedRef.current = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigation as any).replace("SessionGameOverScreen", { sessionId });
    }
  }, [session, navigation, sessionId]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (phase === "loading") {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text
          style={[styles.loadingText, { color: theme.colors.onBackground }]}
        >
          Loading session...
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state (no session loaded)
  // ---------------------------------------------------------------------------

  if (phase === "error" && !session) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={48}
          color={theme.colors.error}
        />
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleBack}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!session) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.colors.onBackground}
          />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: theme.colors.onBackground }]}
          variant="titleMedium"
          numberOfLines={1}
        >
          {gameDisplayName}
        </Text>
        <TouchableOpacity
          style={styles.phaseBadge}
          onPress={handlePhaseBadgeTap}
          activeOpacity={0.8}
        >
          <Text style={[styles.phaseText, { color: theme.colors.primary }]}>
            {session.phase.toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {error && (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: theme.colors.errorContainer },
          ]}
        >
          <Text style={{ color: theme.colors.onErrorContainer }}>{error}</Text>
        </View>
      )}

      {/* DEV-ONLY: Debug panel — tap phase badge 5x to toggle */}
      {__DEV__ && showDebugPanel && (
        <View
          style={[
            styles.debugPanel,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text style={styles.debugTitle}>Debug Info</Text>
          <Text style={styles.debugText}>
            sessionId: {sessionId?.slice(0, 12)}...{"\n"}
            uid: {currentFirebaseUser?.uid?.slice(0, 12)}...{"\n"}
            phase: {session.phase} | lobbyPhase: {phase}
            {"\n"}
            isHost: {String(isHost)} | isInSession: {String(isInSession)}
            {"\n"}
            isInvited: {String(isInvited)} | canJoin: {String(canJoin)}
            {"\n"}
            canStart: {String(canStart)} | lobbyFull: {String(lobbyFull)}
            {"\n"}
            participants: {session.participants.length} / max:{" "}
            {session.maxParticipants}
            {"\n"}
            participantUids: [{session.participantUids?.join(", ")}]{"\n"}
            players:{" "}
            {session.participants
              .map((p) => `${p.displayName}(${p.status})`)
              .join(", ")}
          </Text>
        </View>
      )}

      {/* Participants list */}
      <ScrollView
        style={styles.participantsContainer}
        contentContainerStyle={styles.participantsContent}
      >
        {(() => {
          // Only show actually-joined players (exclude invited stubs & left)
          const joinedPlayers = session.participants.filter(
            (p) =>
              p.role !== "spectator" &&
              p.status !== "invited" &&
              p.status !== "left",
          );
          const emptySlotCount = Math.max(
            0,
            session.maxParticipants - joinedPlayers.length,
          );

          return (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.onBackground },
                ]}
                variant="titleSmall"
              >
                Players ({joinedPlayers.length}/{session.maxParticipants})
              </Text>

              {joinedPlayers.map((participant) => (
                <ParticipantRow
                  key={participant.uid}
                  participant={participant}
                  isHost={participant.role === "host"}
                  isCurrentUser={participant.uid === uid}
                />
              ))}

              {/* Empty slots — tap to invite */}
              {!lobbyFull &&
                Array.from({ length: emptySlotCount }).map((_, i) => (
                  <TouchableOpacity
                    key={`empty-${i}`}
                    style={[
                      styles.participantRow,
                      {
                        borderColor: theme.colors.outline,
                        borderStyle: "dashed",
                      },
                    ]}
                    onPress={() => {
                      trace.info("LOBBY.INVITE.ROW.PRESS", { sessionId });
                      setShowInvitePicker(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.emptySlotText,
                        { color: theme.colors.primary, flex: 1 },
                      ]}
                    >
                      Tap to invite a friend
                    </Text>
                    <MaterialCommunityIcons
                      name="account-plus-outline"
                      size={24}
                      color={theme.colors.primary}
                    />
                  </TouchableOpacity>
                ))}
            </>
          );
        })()}

        {/* Spectators */}
        {session.participants.filter((p) => p.role === "spectator").length >
          0 && (
          <>
            <Text
              style={[
                styles.sectionTitle,
                styles.spectatorTitle,
                { color: theme.colors.onBackground },
              ]}
              variant="titleSmall"
            >
              Spectators
            </Text>
            {session.participants
              .filter((p) => p.role === "spectator")
              .map((spectator) => (
                <ParticipantRow
                  key={spectator.uid}
                  participant={spectator}
                  isHost={false}
                  isCurrentUser={spectator.uid === uid}
                />
              ))}
          </>
        )}
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actions}>
        {/* Invited / eligible user: show Join button */}
        {canJoin && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={handleJoin}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Join Game</Text>
            )}
          </TouchableOpacity>
        )}

        {isHost && session.phase === "lobby" && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              {
                backgroundColor: canStart
                  ? theme.colors.primary
                  : theme.colors.surfaceDisabled,
              },
            ]}
            onPress={handleStart}
            disabled={!canStart || actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {canStart ? "Start Game" : "Waiting for players..."}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {isInSession && !isSessionTerminal(session.phase) && (
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.colors.errorContainer },
            ]}
            onPress={handleLeave}
            disabled={actionLoading}
          >
            <Text
              style={[
                styles.buttonText,
                { color: theme.colors.onErrorContainer },
              ]}
            >
              Leave
            </Text>
          </TouchableOpacity>
        )}

        {/* Show "Go Back" when the session is terminal, or when the
            user isn't a participant and can't join. */}
        {(isSessionTerminal(session.phase) || (!isInSession && !canJoin)) && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={handleBack}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Invite picker modal */}
      <InvitePickerModal
        visible={showInvitePicker}
        onDismiss={() => setShowInvitePicker(false)}
        onSelectFriend={handleSelectFriend}
        onSelectGroup={handleSelectGroup}
        currentUserId={currentFirebaseUser?.uid ?? ""}
        title={`Invite to ${gameDisplayName}`}
      />
    </View>
  );
}

// =============================================================================
// Participant Row Sub-Component
// =============================================================================

function ParticipantRow({
  participant,
  isHost,
  isCurrentUser,
}: {
  participant: SessionParticipant;
  isHost: boolean;
  isCurrentUser: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.participantRow,
        {
          borderColor: isCurrentUser
            ? theme.colors.primary
            : theme.colors.outline,
          backgroundColor: isCurrentUser
            ? theme.colors.primaryContainer
            : theme.colors.surface,
        },
      ]}
    >
      <View style={styles.participantInfo}>
        <MaterialCommunityIcons
          name={
            isHost
              ? "crown"
              : participant.role === "spectator"
                ? "eye"
                : "account"
          }
          size={20}
          color={
            isHost
              ? "#FFD700"
              : isCurrentUser
                ? theme.colors.primary
                : theme.colors.onSurface
          }
        />
        <Text
          style={[
            styles.participantName,
            { color: theme.colors.onSurface },
            isCurrentUser && { fontWeight: "700" },
          ]}
          numberOfLines={1}
        >
          {participant.displayName}
          {isCurrentUser ? " (You)" : ""}
        </Text>
      </View>
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor:
              participant.status === "ready"
                ? "#4CAF50"
                : participant.status === "disconnected"
                  ? theme.colors.error
                  : theme.colors.surfaceVariant,
          },
        ]}
      >
        <Text style={styles.statusText}>
          {participant.status.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
  },
  errorText: {
    marginTop: Spacing.md,
    fontSize: 16,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: 56,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontWeight: "700",
  },
  phaseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  phaseText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  errorBanner: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: 8,
  },
  participantsContainer: {
    flex: 1,
  },
  participantsContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontWeight: "700",
    marginBottom: 4,
  },
  spectatorTitle: {
    marginTop: Spacing.md,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  participantInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flex: 1,
  },
  participantName: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  emptySlotText: {
    fontSize: 14,
    fontStyle: "italic",
    marginLeft: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  actions: {
    padding: Spacing.md,
    paddingBottom: 34,
    gap: Spacing.sm,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    minHeight: 50,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  // DEV debug panel
  debugPanel: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#888",
  },
  debugTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#888",
    marginBottom: 4,
  },
  debugText: {
    fontSize: 10,
    fontFamily: "monospace" as const,
    color: "#666",
    lineHeight: 14,
  },
});
