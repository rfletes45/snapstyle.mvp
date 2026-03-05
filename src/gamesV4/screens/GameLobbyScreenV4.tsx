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
import { GAME_METADATA, IMPLEMENTED_GAME_IDS } from "@/gamesV4/constants";
import { useGameLobbyV4 } from "@/gamesV4/hooks/useGameLobbyV4";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
    joinAsPlayer,
    joinAsSpectator,
    leaveLobby,
    cancelInvite,
    startGame,
  } = lobby;

  const uid = currentFirebaseUser?.uid;
  const hasAutoNavigated = useRef(false);
  const [lobbySettings, setLobbySettings] = useState<Record<string, unknown>>({});
  const hadInvite = useRef(false);
  if (invite) hadInvite.current = true;
  const meta = invite ? GAME_METADATA[invite.gameId] : null;
  const isParticipant = !!(uid && invite?.participantIds.includes(uid));
  const isSpectator = !!(uid && invite?.spectatorIds.includes(uid));
  const canJoin = !isParticipant && !isSpectator;
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

  // Auto-navigate to game screen when session becomes active
  useEffect(() => {
    if (navReady && session && invite) {
      navigation.replace("GamePlayV4", {
        sessionId: session.sessionId,
        gameId: invite.gameId,
      });
    }
  }, [navReady, session, invite, navigation]);

  // Navigate to result if resolved (with session → game over screen)
  useEffect(() => {
    if (invite?.status === "resolved" && invite.sessionId) {
      navigation.replace("GameOverV4", {
        sessionId: invite.sessionId,
      });
    }
  }, [invite?.status, invite?.sessionId, navigation]);

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

    if (invite && invite.status === "resolved" && !invite.sessionId) {
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

  const colors = theme.colors;

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
        <View style={styles.headerSpacer} />
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
        data={invite.participantIds}
        keyExtractor={(item) => item}
        renderItem={({ item: playerId }) => {
          const summary = participantMap.get(playerId);
          const displayName =
            playerId === uid ? "You" : (summary?.displayName ?? "Player");
          const pfpUrl = summary?.profilePictureUrl;

          return (
            <View
              style={[
                styles.playerRow,
                {
                  backgroundColor: theme.isDark ? "#1C1C1E" : "#FFF",
                  borderBottomColor: theme.isDark ? "#333" : "#E0E0E0",
                },
              ]}
            >
              {pfpUrl ? (
                <Image source={{ uri: pfpUrl }} style={styles.playerAvatar} />
              ) : (
                <View
                  style={[
                    styles.playerAvatarFallback,
                    { backgroundColor: theme.isDark ? "#333" : "#DDD" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="account"
                    size={18}
                    color={theme.isDark ? "#AAA" : "#666"}
                  />
                </View>
              )}
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
            const summary = spectatorMap.get(specId);
            const displayName =
              specId === uid
                ? "You (spectating)"
                : (summary?.displayName ?? "Spectator");
            const pfpUrl = summary?.profilePictureUrl;

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
                {pfpUrl ? (
                  <Image source={{ uri: pfpUrl }} style={styles.playerAvatar} />
                ) : (
                  <View
                    style={[
                      styles.playerAvatarFallback,
                      { backgroundColor: theme.isDark ? "#333" : "#DDD" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="eye"
                      size={18}
                      color={theme.isDark ? "#AAA" : "#666"}
                    />
                  </View>
                )}
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
              This game is coming soon and can't be started yet.
            </Text>
          </View>
        )}

        {/* Settings panel — shown to host when game has configurable settings */}
        {isHost && !isStarted && invite && (
          <LobbySettingsPanel
            gameId={invite.gameId}
            onSettingsChange={setLobbySettings}
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
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DDD",
  },
  playerAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
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
