/**
 * Games V4 — Lobby Screen
 *
 * Displays the game lobby for a V4 invite.
 * Shows:
 * - Game info (icon, name, settings)
 * - Player list
 * - Join/spectate buttons (for non-members)
 * - Start button (host only, when enough players)
 * - Live updates via Firestore subscription
 *
 * Auto-navigates to the game when session becomes active.
 *
 * @module gamesV4/screens/GameLobbyScreenV4
 */

import LobbySettingsPanel from "@/gamesV4/components/LobbySettingsPanel";
import UserAvatar from "@/gamesV4/components/UserAvatar";
import { GAME_METADATA, IMPLEMENTED_GAME_IDS } from "@/gamesV4/constants";
import { useGameLobbyV4 } from "@/gamesV4/hooks/useGameLobbyV4";
import {
  adminClearGame,
  updateLobbySettings,
} from "@/gamesV4/services/gameServiceV4";
import { isCancelledInvite } from "@/gamesV4/utils/inviteState";
import { getUserProfileByUid } from "@/services/friends";
import { markGameNotificationsRead } from "@/services/userNotifications";
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Nav = NativeStackNavigationProp<MainStackParamList>;

// =============================================================================
// Component
// =============================================================================

export default function GameLobbyScreenV4() {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const { setCurrentGameInviteId } = useInAppNotifications();
  const navigation = useNavigation<Nav>();
  const route = useRoute<{
    key: string;
    name: "GameLobbyV4";
    params: { inviteId: string };
  }>();

  const { inviteId } = route.params;
  const lobby = useGameLobbyV4(inviteId);
  const {
    invite,
    session,
    isHost,
    isStarted,
    navReady,
    actionLoading,
    actionError,
    isOptimisticallyJoined,
    optimisticRole,
    joinAsPlayer,
    joinAsSpectator,
    leaveLobby,
    cancelInvite,
    startGame,
  } = lobby;

  const uid = currentFirebaseUser?.uid;
  const hasAutoNavigated = useRef(false);
  const [lobbySettings, setLobbySettings] = useState<Record<string, unknown>>(
    {},
  );
  const hadInvite = useRef(false);
  if (invite) hadInvite.current = true;
  const meta = invite ? GAME_METADATA[invite.gameId] : null;
  const isParticipant = !!(
    uid &&
    (invite?.participantIds.includes(uid) ||
      (isOptimisticallyJoined && optimisticRole === "player"))
  );
  const isSpectator = !!(
    uid &&
    (invite?.spectatorIds.includes(uid) ||
      (isOptimisticallyJoined && optimisticRole === "spectator"))
  );
  const canJoin = !isParticipant && !isSpectator && !isOptimisticallyJoined;
  const isGameImplemented = !!(
    invite && IMPLEMENTED_GAME_IDS.has(invite.gameId)
  );
  const canStart =
    isHost &&
    !isStarted &&
    isGameImplemented &&
    (invite?.participantIds.length ?? 0) >= (meta?.minPlayers ?? 2);

  // Build a lookup map from participantSummaries for O(1) access by UID.
  // Gracefully handles legacy invites that don't have summaries yet.
  const participantMap = useMemo(() => {
    const map = new Map<
      string,
      { displayName: string; profilePictureUrl: string | null }
    >();
    for (const s of invite?.participantSummaries ?? []) {
      map.set(s.uid, {
        displayName: s.displayName,
        profilePictureUrl: s.profilePictureUrl,
      });
    }
    return map;
  }, [invite?.participantSummaries]);

  const spectatorMap = useMemo(() => {
    const map = new Map<
      string,
      { displayName: string; profilePictureUrl: string | null }
    >();
    for (const s of invite?.spectatorSummaries ?? []) {
      map.set(s.uid, {
        displayName: s.displayName,
        profilePictureUrl: s.profilePictureUrl,
      });
    }
    return map;
  }, [invite?.spectatorSummaries]);

  // Player list with optimistic entry appended when joining
  const displayPlayerIds = useMemo(() => {
    const ids = invite?.participantIds ?? [];
    if (
      uid &&
      isOptimisticallyJoined &&
      optimisticRole === "player" &&
      !ids.includes(uid)
    ) {
      return [...ids, uid];
    }
    return ids;
  }, [invite?.participantIds, uid, isOptimisticallyJoined, optimisticRole]);

  // Client-side profile enrichment: fetch real profiles for any participant
  // whose summary is missing a profilePictureUrl (backend may not have it yet).
  const [fetchedProfiles, setFetchedProfiles] = useState<
    Map<string, { displayName: string; profilePictureUrl: string | null }>
  >(new Map());

  useEffect(() => {
    if (!invite) return;
    const allIds = [...invite.participantIds, ...invite.spectatorIds];
    const needsFetch = allIds.filter((id) => {
      const summary = participantMap.get(id) ?? spectatorMap.get(id);
      // Fetch if no summary at all, or summary has no pfp URL
      return !summary || !summary.profilePictureUrl;
    });
    if (needsFetch.length === 0) return;

    let cancelled = false;
    Promise.all(
      needsFetch.map(async (id) => {
        const profile = await getUserProfileByUid(id);
        if (!profile) return null;
        return {
          uid: id,
          displayName: profile.displayName || profile.username || "Player",
          profilePictureUrl: profile.profilePicture?.url ?? null,
        };
      }),
    ).then((results) => {
      if (cancelled) return;
      const map = new Map(fetchedProfiles);
      for (const r of results) {
        if (r)
          map.set(r.uid, {
            displayName: r.displayName,
            profilePictureUrl: r.profilePictureUrl,
          });
      }
      setFetchedProfiles(map);
    });

    return () => {
      cancelled = true;
    };
  }, [
    invite?.participantIds,
    invite?.spectatorIds,
    participantMap,
    spectatorMap,
  ]);

  // Merged lookup: prefer server summary, fall back to client-fetched profile
  const getPlayerInfo = useCallback(
    (playerId: string) => {
      const summary =
        participantMap.get(playerId) ?? spectatorMap.get(playerId);
      const fetched = fetchedProfiles.get(playerId);
      return {
        displayName: summary?.displayName || fetched?.displayName || "Player",
        profilePictureUrl:
          summary?.profilePictureUrl || fetched?.profilePictureUrl || null,
      };
    },
    [participantMap, spectatorMap, fetchedProfiles],
  );

  useEffect(() => {
    setCurrentGameInviteId(inviteId);
    return () => setCurrentGameInviteId(null);
  }, [inviteId, setCurrentGameInviteId]);

  useEffect(() => {
    if (!uid) return;
    markGameNotificationsRead(uid, { inviteId }).catch((error) => {
      console.warn("[gamesV4] Failed to mark lobby notifications read:", error);
    });
  }, [uid, inviteId]);

  // Auto-navigate to game screen when session becomes active
  useEffect(() => {
    if (navReady && session && invite) {
      hasAutoNavigated.current = true;
      navigation.replace("GamePlayV4", {
        sessionId: session.sessionId,
        gameId: invite.gameId,
      });
    }
  }, [navReady, session, invite, navigation]);

  // Navigate to result if resolved (with session → game over screen)
  useEffect(() => {
    if (hasAutoNavigated.current) return;
    if (invite?.status === "resolved" && invite.sessionId) {
      hasAutoNavigated.current = true;
      navigation.replace("GameOverV4", {
        sessionId: invite.sessionId,
      });
    }
  }, [invite?.status, invite?.sessionId, navigation]);

  // ── Game started without us detection ──────────────────────────────
  // If the invite transitions to "active" but we're NOT a participant
  // (race condition: host started before our join completed), show a
  // message and navigate back so the user isn't stuck.
  useEffect(() => {
    if (hasAutoNavigated.current) return;
    if (!invite || !uid) return;
    if (
      invite.status === "active" &&
      !invite.participantIds.includes(uid) &&
      !invite.spectatorIds.includes(uid) &&
      !isOptimisticallyJoined
    ) {
      hasAutoNavigated.current = true;
      Alert.alert(
        "Game Already Started",
        "The host started the game before you could join. Try asking for a new invite.",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    }
  }, [invite, uid, navigation, isOptimisticallyJoined]);

  // ── Cancelled/deleted invite detection ─────────────────────────────
  // If the invite disappears (hard-deleted) or becomes resolved without
  // a session (cancelled), auto-navigate back so users aren't stuck.
  useEffect(() => {
    if (hasAutoNavigated.current) return;

    // Invite was hard-deleted after we had loaded it
    if (invite === null && hadInvite.current) {
      hasAutoNavigated.current = true;
      Alert.alert("Invite Cancelled", "This game invite was cancelled.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
      return;
    }

    if (invite && isCancelledInvite(invite)) {
      hasAutoNavigated.current = true;
      Alert.alert("Invite Cancelled", "This game invite was cancelled.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [invite, navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      "Cancel Invite",
      "Are you sure you want to cancel this game invite? All players will be removed.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Invite",
          style: "destructive",
          onPress: async () => {
            const ok = await cancelInvite();
            if (ok) navigation.goBack();
          },
        },
      ],
    );
  }, [cancelInvite, navigation]);

  const handleLeave = useCallback(() => {
    Alert.alert("Leave Lobby", "Are you sure you want to leave this lobby?", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          const ok = await leaveLobby();
          if (ok) navigation.goBack();
        },
      },
    ]);
  }, [leaveLobby, navigation]);

  // ── Overflow menu (host cancel + admin clear) ─────────────────────
  const handleHeaderMenu = useCallback(() => {
    if (!invite) return;
    const actions: {
      text: string;
      style?: "destructive" | "cancel";
      onPress?: () => void;
    }[] = [];

    // Host cancel (pre-start only)
    if (isHost && !isStarted) {
      actions.push({
        text: "Cancel Invite",
        style: "destructive",
        onPress: () => handleCancel(),
      });
    }

    // Admin/owner clear (DM participants always, group owner/admin server-checked)
    const scope = invite.conversationScope;
    const isDm = scope === "dm";
    const canClear = isDm || isHost;
    if (canClear) {
      actions.push({
        text: "Clear Game",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Clear Game",
            "This will force-close this game for all participants. This cannot be undone.",
            [
              { text: "Keep", style: "cancel" },
              {
                text: "Clear Game",
                style: "destructive",
                onPress: async () => {
                  try {
                    await adminClearGame({ inviteId: invite.inviteId });
                    navigation.goBack();
                  } catch (err: unknown) {
                    Alert.alert(
                      "Error",
                      (err as Error)?.message ?? "Failed to clear game.",
                    );
                  }
                },
              },
            ],
          );
        },
      });
    }

    if (actions.length === 0) return;

    Alert.alert("Lobby Actions", undefined, [
      ...actions,
      { text: "Dismiss", style: "cancel" },
    ]);
  }, [invite, isHost, isStarted, handleCancel, navigation]);

  const colors = theme.colors;

  // Loading: invite not yet loaded
  if (!invite) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.isDark ? "#000" : colors.background },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: theme.isDark ? "#AAA" : "#666" },
            ]}
          >
            Loading lobby...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Transitioning: game started and we're a participant, waiting for session to load
  if (isStarted && (isParticipant || isSpectator) && !navReady) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.isDark ? "#000" : colors.background },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: theme.isDark ? "#AAA" : "#666" },
            ]}
          >
            Joining game...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.isDark ? "#000" : colors.background },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.isDark ? "#FFF" : "#000"}
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: theme.isDark ? "#FFF" : "#000" },
          ]}
        >
          Game Lobby
        </Text>
        <TouchableOpacity onPress={handleHeaderMenu} style={styles.backButton}>
          <MaterialCommunityIcons
            name="dots-vertical"
            size={24}
            color={theme.isDark ? "#FFF" : "#000"}
          />
        </TouchableOpacity>
      </View>

      {/* Game Info */}
      <View
        style={[
          styles.gameInfoCard,
          { backgroundColor: theme.isDark ? "#1C1C1E" : "#F2F2F7" },
        ]}
      >
        <MaterialCommunityIcons
          name={
            (meta?.icon ??
              "gamepad-variant") as keyof typeof MaterialCommunityIcons.glyphMap
          }
          size={48}
          color={colors.primary}
        />
        <Text
          style={[styles.gameName, { color: theme.isDark ? "#FFF" : "#000" }]}
        >
          {meta?.displayName ?? invite.gameId}
        </Text>
        <Text
          style={[
            styles.gameSubtitle,
            { color: theme.isDark ? "#AAA" : "#666" },
          ]}
        >
          {invite.participantIds.length}/{invite.maxPlayers} players
          {invite.allowSpectators
            ? ` · ${invite.spectatorIds.length} spectating`
            : ""}
        </Text>
        {isStarted && (
          <View
            style={[styles.statusBadge, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.statusBadgeText}>Game Started</Text>
          </View>
        )}
      </View>

      {/* Player List */}
      <Text
        style={[styles.sectionTitle, { color: theme.isDark ? "#AAA" : "#666" }]}
      >
        PLAYERS
      </Text>
      <FlatList
        data={displayPlayerIds}
        keyExtractor={(item) => item}
        renderItem={({ item: playerId }) => {
          const isOptimisticEntry =
            isOptimisticallyJoined &&
            playerId === uid &&
            !invite.participantIds.includes(playerId);
          const info = getPlayerInfo(playerId);
          const displayName = isOptimisticEntry
            ? "You (joining...)"
            : playerId === uid
              ? "You"
              : info.displayName;
          const pfpUrl = isOptimisticEntry ? null : info.profilePictureUrl;

          return (
            <View
              style={[
                styles.playerRow,
                {
                  backgroundColor: theme.isDark ? "#1C1C1E" : "#FFF",
                  borderBottomColor: theme.isDark ? "#333" : "#E0E0E0",
                  opacity: isOptimisticEntry ? 0.6 : 1,
                },
              ]}
            >
              <UserAvatar
                profilePictureUrl={pfpUrl}
                displayName={isOptimisticEntry ? "You" : info.displayName}
                uid={playerId}
                size={32}
              />
              <Text
                style={[
                  styles.playerName,
                  { color: theme.isDark ? "#FFF" : "#000" },
                ]}
              >
                {displayName}
              </Text>
              {playerId === invite.hostId && (
                <View
                  style={[
                    styles.hostBadge,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Text
                    style={[styles.hostBadgeText, { color: colors.primary }]}
                  >
                    Host
                  </Text>
                </View>
              )}
            </View>
          );
        }}
        style={styles.playerList}
        scrollEnabled={false}
      />

      {/* Spectators (if any) */}
      {invite.spectatorIds.length > 0 && (
        <>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.isDark ? "#AAA" : "#666" },
            ]}
          >
            SPECTATORS
          </Text>
          {invite.spectatorIds.map((specId) => {
            const specInfo = getPlayerInfo(specId);
            const displayName =
              specId === uid ? "You (spectating)" : specInfo.displayName;
            const pfpUrl = specInfo.profilePictureUrl;

            return (
              <View
                key={specId}
                style={[
                  styles.playerRow,
                  {
                    backgroundColor: theme.isDark ? "#1C1C1E" : "#FFF",
                    borderBottomColor: theme.isDark ? "#333" : "#E0E0E0",
                  },
                ]}
              >
                <UserAvatar
                  profilePictureUrl={pfpUrl}
                  displayName={specInfo.displayName}
                  uid={specId}
                  size={32}
                  fallbackIcon="eye"
                />
                <Text
                  style={[
                    styles.playerName,
                    { color: theme.isDark ? "#AAA" : "#666" },
                  ]}
                >
                  {displayName}
                </Text>
              </View>
            );
          })}
        </>
      )}

      {/* Error Display */}
      {actionError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{actionError}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {canJoin && !isStarted && (
          <>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={joinAsPlayer}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Join Game</Text>
              )}
            </TouchableOpacity>
            {invite.allowSpectators && (
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  { borderColor: colors.primary },
                ]}
                onPress={joinAsSpectator}
                disabled={actionLoading}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: colors.primary },
                  ]}
                >
                  Watch
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {isHost && !isStarted && !isGameImplemented && (
          <View
            style={[
              styles.comingSoonBanner,
              { backgroundColor: theme.isDark ? "#2C2C2E" : "#FFF3CD" },
            ]}
          >
            <MaterialCommunityIcons
              name="clock-outline"
              size={18}
              color="#FF9500"
            />
            <Text
              style={[
                styles.comingSoonText,
                { color: theme.isDark ? "#FFD60A" : "#856404" },
              ]}
            >
              This game is coming soon and can&apos;t be started yet.
            </Text>
          </View>
        )}

        {/* Settings panel — shown to host (editable) and non-host (read-only) */}
        {!isStarted && invite && (isHost || isParticipant || isSpectator) && (
          <LobbySettingsPanel
            gameId={invite.gameId}
            onSettingsChange={(s) => {
              setLobbySettings(s);
              // Persist to backend so non-host participants see updates
              if (isHost && inviteId) {
                updateLobbySettings({
                  inviteId,
                  settingsPatch: s,
                }).catch((err) =>
                  console.warn(
                    "[gamesV4] Failed to persist lobby settings:",
                    err,
                  ),
                );
              }
            }}
            readOnly={!isHost}
            externalValues={
              !isHost
                ? (((invite as unknown as Record<string, unknown>)
                    .lobbySettings as Record<string, unknown>) ?? undefined)
                : undefined
            }
          />
        )}

        {canStart && (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: "#34C759" }]}
            onPress={() => startGame(lobbySettings)}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Start Game</Text>
            )}
          </TouchableOpacity>
        )}

        {isParticipant && !isHost && !isStarted && (
          <Text
            style={[
              styles.waitingText,
              { color: theme.isDark ? "#AAA" : "#666" },
            ]}
          >
            Waiting for host to start...
          </Text>
        )}

        {/* Cancel (host) or Leave (non-host) — only before game starts */}
        {isHost && !isStarted && (
          <TouchableOpacity
            style={[styles.dangerButton]}
            onPress={handleCancel}
            disabled={actionLoading}
          >
            <Text style={styles.dangerButtonText}>Cancel Invite</Text>
          </TouchableOpacity>
        )}

        {isParticipant && !isHost && !isStarted && (
          <TouchableOpacity
            style={[styles.dangerButton]}
            onPress={handleLeave}
            disabled={actionLoading}
          >
            <Text style={styles.dangerButtonText}>Leave Lobby</Text>
          </TouchableOpacity>
        )}

        {isSpectator && !isStarted && (
          <TouchableOpacity
            style={[styles.dangerButton]}
            onPress={handleLeave}
            disabled={actionLoading}
          >
            <Text style={styles.dangerButtonText}>Stop Watching</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  headerSpacer: {
    width: 32,
  },
  gameInfoCard: {
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 24,
    borderRadius: 16,
    gap: 8,
  },
  gameName: {
    fontSize: 22,
    fontWeight: "700",
  },
  gameSubtitle: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  playerList: {
    flexGrow: 0,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  playerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  hostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  hostBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  errorContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#FF3B300F",
    borderRadius: 8,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 13,
    textAlign: "center",
  },
  actionsContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  waitingText: {
    textAlign: "center",
    fontSize: 14,
    fontStyle: "italic",
  },
  dangerButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FF3B30",
  },
  dangerButtonText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "600",
  },
  comingSoonBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  comingSoonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
});
