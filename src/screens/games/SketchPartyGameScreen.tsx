/**
 * SketchPartyGameScreen — Multiplayer drawing & guessing game (skribbl-style)
 *
 * Full UI: lobby, countdown, drawing canvas, chat/guessing, scoreboard,
 * word-choice modal, game-over modal, spectator mode, invite flow.
 *
 * Supports an "invite_queue" entry mode where the screen waits for an invite
 * to become active before joining the Colyseus room.
 */

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Button, Chip, IconButton, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import InvitePickerModal, {
  type FriendItem,
  type GroupItem,
} from "@/components/InvitePickerModal";
import { GameOverModal, type GameResult } from "@/components/games";
import { MultiplayerLobbyOverlay } from "@/components/games/MultiplayerLobbyOverlay";
import {
  SketchCanvas,
  SketchPartyChat,
  SketchToolbar,
  type SketchCanvasRef,
} from "@/components/games/sketch-party";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameLobbyController } from "@/hooks/useGameLobbyController";
import { useSketchPartyGame } from "@/hooks/useSketchPartyGame";
import { onGameResultNotification } from "@/services/gameResultEvents";
import {
  buildGameResultEvent,
  submitGameResult,
} from "@/services/gameResultService";
import { getGroupMembers } from "@/services/groups";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import type { PlayStackParamList } from "@/types/navigation/root";

// =============================================================================
// Types
// =============================================================================

type Props = NativeStackScreenProps<
  PlayStackParamList,
  "SketchPartyGameScreen"
>;

interface RouteParamsShape {
  matchId?: string;
  inviteId?: string;
  entryPoint?: string;
  spectator?: boolean;
}

function asRouteParams(value: unknown): RouteParamsShape {
  if (!value || typeof value !== "object") return {};
  const params = value as Record<string, unknown>;
  return {
    matchId:
      typeof params.matchId === "string" && params.matchId
        ? params.matchId
        : undefined,
    inviteId:
      typeof params.inviteId === "string" && params.inviteId
        ? params.inviteId
        : undefined,
    entryPoint:
      typeof params.entryPoint === "string" ? params.entryPoint : undefined,
    spectator: typeof params.spectator === "boolean" ? params.spectator : false,
  };
}

const GAME_TYPE = "sketch_party_game";

// =============================================================================
// Screen
// =============================================================================

export default function SketchPartyGameScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const routeParams = asRouteParams(route.params);
  const {
    matchId: routeMatchId,
    inviteId,
    spectator: routeSpectator,
  } = routeParams;

  // Auth + profile (for invite flow)
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // ---------------------------------------------------------------------------
  // Game state: "lobby" = overlay is visible (invite queue for joiners),
  //             "game"  = game content visible (incl. Colyseus waiting phase).
  // Hosts start directly in "game"; joiners start in "lobby" until the
  // invite resolves and onGameReady fires.
  // ---------------------------------------------------------------------------
  const [gameState, setGameState] = useState<"lobby" | "game">(
    inviteId ? "lobby" : "game",
  );

  // The Colyseus firestoreGameId, set from the lobby controller.
  // For hosts: set via the lobby's auto-generated hostRoomKey.
  // For joiners: set when onGameReady fires with the resolved ID.
  const [gameId, setGameId] = useState<string | undefined>(routeMatchId);

  // ---------------------------------------------------------------------------
  // Sketch Party Colyseus hook (declared before lobbyController so room is
  // available to bridge into the controller).
  // ---------------------------------------------------------------------------
  const sp = useSketchPartyGame({
    firestoreGameId: gameId,
    autoJoin: false, // We control joining via effects below
    spectator: !!routeSpectator,
  });

  // ---------------------------------------------------------------------------
  // Lobby controller — composes useGameLobby + watchdog + recovery.
  // Handles invite subscription, player tracking, error surfacing.
  // ---------------------------------------------------------------------------
  const lobbyController = useGameLobbyController({
    gameType: "sketch_party",
    matchId: routeMatchId,
    inviteId,
    entryPoint: routeParams.entryPoint,
    isTurnBased: true, // Prevent auto-ready; SketchParty uses manual ready + host start
    roomKeyPrefix: "sp",
    onGameReady: (resolvedId: string) => {
      setGameId(resolvedId);
      setGameState("game");
    },
    onLeaveLobby: () => navigation.goBack(),
    room: sp.room,
    roomPhase: sp.phase,
    roomReconnecting: sp.reconnecting,
    roomError: sp.error,
  });

  // Sync the lobby's hostRoomKey as the gameId for the host.
  // In host mode (no inviteId) useGameLobby generates an effectiveGameId
  // immediately; we propagate it into our local state so sp picks it up.
  useEffect(() => {
    const lobbyGameId = lobbyController.lobby.effectiveGameId;
    if (lobbyGameId && !gameId) {
      setGameId(lobbyGameId);
    }
  }, [lobbyController.lobby.effectiveGameId, gameId]);

  // Auto-join Colyseus room once gameId is available and we're not connected.
  useEffect(() => {
    if (gameId && !sp.connected && !sp.error && !sp.reconnecting) {
      sp.joinRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, sp.connected, sp.error, sp.reconnecting]);

  // Back handler
  const isGameOver = sp.phase === "finished";
  const { handleBack } = useGameBackHandler({
    gameType: GAME_TYPE,
    isGameOver,
  });

  // Local state
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushWidth, setBrushWidth] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);

  // XP state (populated via GameResult notification)
  const [xpEarned, setXpEarned] = useState(0);
  const [didLevelUp, setDidLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);

  // Listen for game result notifications (XP + achievements)
  useEffect(() => {
    const unsub = onGameResultNotification((n) => {
      if (n.gameId === "sketch_party_game") {
        setXpEarned(n.xpEarned);
        setDidLevelUp(n.didLevelUp);
        setNewLevel(n.newLevel);
      }
    });
    return unsub;
  }, []);

  const canvasRef = useRef<SketchCanvasRef>(null);

  // Responsive breakpoint
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = windowWidth < 768;
  const [activeTab, setActiveTab] = useState<"players" | "chat">("chat");

  // Show game over when phase changes
  useEffect(() => {
    if (sp.phase === "finished" && sp.gameOverData) {
      setShowGameOver(true);
      // Submit to XP pipeline
      if (currentFirebaseUser) {
        const myScore =
          sp.players.find((p) => p.sessionId === sp.mySessionId)?.score ?? 0;
        submitGameResult(
          buildGameResultEvent({
            gameId: "sketch_party_game",
            mode: "realtime",
            outcome: sp.gameOverData.winnerId === myUid ? "win" : "lose",
            score: myScore,
            durationMs: 0,
            userId: currentFirebaseUser.uid,
            displayName: currentFirebaseUser.displayName || "Player",
          }),
        ).catch(() => {});
      }
    }
  }, [sp.phase, sp.gameOverData]);

  // Sorted players by score (desc)
  const sortedPlayers = useMemo(
    () => [...sp.players].sort((a, b) => b.score - a.score),
    [sp.players],
  );

  // ---------------------------------------------------------------------------
  // Invite handlers — delegate to lobby controller
  // ---------------------------------------------------------------------------
  const handleSelectFriend = useCallback(
    async (friend: FriendItem) => {
      if (!currentFirebaseUser) return;
      try {
        await lobbyController.lobby.sendFriendInvite(
          friend.friendUid,
          friend.displayName || "Friend",
          undefined,
        );
        showSuccess("Invite sent!");
      } catch {
        showError("Failed to send invite");
      }
      setShowInviteModal(false);
    },
    [currentFirebaseUser, lobbyController.lobby, showSuccess, showError],
  );

  const handleSelectGroup = useCallback(
    async (group: GroupItem) => {
      if (!currentFirebaseUser) return;
      try {
        const members = await getGroupMembers(group.groupId);
        const memberIds = members.map((m: any) => m.uid);
        await lobbyController.lobby.sendGroupInvite(
          group.groupId,
          group.name,
          memberIds,
        );
        showSuccess(`Invite sent to ${group.name}!`);
      } catch {
        showError("Failed to send group invite");
      }
      setShowInviteModal(false);
    },
    [currentFirebaseUser, lobbyController.lobby, showSuccess, showError],
  );

  // ---------------------------------------------------------------------------
  // Canvas callbacks
  // ---------------------------------------------------------------------------
  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
    sp.sendDrawUndo();
  }, [sp]);

  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
    sp.sendDrawClear();
  }, [sp]);

  // ---------------------------------------------------------------------------
  // Game over helpers
  // ---------------------------------------------------------------------------
  const myUid = sp.players.find((p) => p.sessionId === sp.mySessionId)?.uid;
  const gameResult: GameResult =
    sp.gameOverData?.winnerId === myUid ? "win" : "loss";
  const winnerPlayer = sp.gameOverData?.finalScores?.[0];

  // ---------------------------------------------------------------------------
  // Error / connecting views
  // ---------------------------------------------------------------------------

  // =========================================================================
  // RENDER: LOBBY OVERLAY (joiner invite queue)
  // =========================================================================
  if (gameState === "lobby") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <MultiplayerLobbyOverlay
          controller={lobbyController}
          gameTitle="Sketch Party"
          gameIcon="🎨"
          onInvitePress={() => setShowInviteModal(true)}
          onLeave={() => {
            lobbyController.lobby.leaveLobby();
            navigation.goBack();
          }}
          showReadyButton={false}
        >
          <View style={{ flex: 1 }} />
        </MultiplayerLobbyOverlay>

        {/* Invite modal (used from overlay's Invite button) */}
        <InvitePickerModal
          visible={showInviteModal}
          onDismiss={() => setShowInviteModal(false)}
          onSelectFriend={handleSelectFriend}
          onSelectGroup={handleSelectGroup}
          currentUserId={currentFirebaseUser?.uid || ""}
          title="Invite to Sketch Party"
        />
      </SafeAreaView>
    );
  }

  // =========================================================================
  // RENDER: CONNECTING / ERROR (before Colyseus room is joined)
  // =========================================================================
  if (sp.error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.center}>
          <Text variant="headlineSmall" style={{ color: theme.colors.error }}>
            Connection Error
          </Text>
          <Text style={{ color: theme.colors.onSurface, marginTop: 8 }}>
            {sp.error}
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 16 }}
          >
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!sp.connected) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.center}>
          <Text
            variant="headlineSmall"
            style={{ color: theme.colors.onSurface }}
          >
            Connecting to Sketch Party...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // RENDER: WAITING PHASE (Colyseus room joined, configuring game)
  // =========================================================================
  if (sp.phase === "waiting") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.lobbyHeader}>
          <Button compact onPress={handleBack} icon="arrow-left">
            Back
          </Button>
          <Text
            variant="headlineSmall"
            style={{ color: theme.colors.onSurface }}
          >
            🎨 Sketch Party
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Spectator banner */}
        {sp.isSpectator && (
          <View
            style={[
              styles.spectatorBanner,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Text style={{ color: theme.colors.onPrimaryContainer }}>
              👁 Watching as spectator
            </Text>
          </View>
        )}

        {/* Settings summary / editor */}
        <View style={styles.settingsSummary}>
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onSurface, marginBottom: 8 }}
          >
            Room Settings
          </Text>
          {sp.isHost ? (
            <View style={{ gap: 8 }}>
              {/* Rounds stepper */}
              <View style={styles.settingRow}>
                <Text style={{ color: theme.colors.onSurface, flex: 1 }}>
                  Rounds
                </Text>
                <View style={styles.stepper}>
                  <IconButton
                    icon="minus"
                    size={18}
                    onPress={() =>
                      sp.sendUpdateSettings({
                        rounds: Math.max(1, sp.rounds - 1),
                      })
                    }
                    disabled={sp.rounds <= 1}
                  />
                  <Text
                    style={{
                      color: theme.colors.onSurface,
                      minWidth: 24,
                      textAlign: "center",
                    }}
                  >
                    {sp.rounds}
                  </Text>
                  <IconButton
                    icon="plus"
                    size={18}
                    onPress={() =>
                      sp.sendUpdateSettings({
                        rounds: Math.min(10, sp.rounds + 1),
                      })
                    }
                    disabled={sp.rounds >= 10}
                  />
                </View>
              </View>
              {/* Draw time stepper */}
              <View style={styles.settingRow}>
                <Text style={{ color: theme.colors.onSurface, flex: 1 }}>
                  Draw Time (sec)
                </Text>
                <View style={styles.stepper}>
                  <IconButton
                    icon="minus"
                    size={18}
                    onPress={() =>
                      sp.sendUpdateSettings({
                        drawTimeSec: Math.max(30, sp.drawTimeSec - 10),
                      })
                    }
                    disabled={sp.drawTimeSec <= 30}
                  />
                  <Text
                    style={{
                      color: theme.colors.onSurface,
                      minWidth: 32,
                      textAlign: "center",
                    }}
                  >
                    {sp.drawTimeSec}
                  </Text>
                  <IconButton
                    icon="plus"
                    size={18}
                    onPress={() =>
                      sp.sendUpdateSettings({
                        drawTimeSec: Math.min(180, sp.drawTimeSec + 10),
                      })
                    }
                    disabled={sp.drawTimeSec >= 180}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.chipRow}>
              <Chip icon="repeat">{sp.rounds} Rounds</Chip>
              <Chip icon="timer-outline">{sp.drawTimeSec}s Draw Time</Chip>
              <Chip icon="account-group">{sp.players.length} Players</Chip>
            </View>
          )}
        </View>

        {/* Player list */}
        <View style={styles.lobbyPlayerList}>
          <Text
            variant="titleSmall"
            style={{ color: theme.colors.onSurface, marginBottom: 6 }}
          >
            Players
          </Text>
          {sp.players.map((p) => (
            <View
              key={p.sessionId}
              style={[
                styles.lobbyPlayerRow,
                { borderBottomColor: theme.colors.outline },
              ]}
            >
              <Text style={{ color: theme.colors.onSurface }}>
                {p.displayName}
                {p.uid === sp.hostUid ? " (Host)" : ""}
              </Text>
              <Text
                style={{
                  color: p.ready ? "#4CAF50" : theme.colors.onSurfaceVariant,
                }}
              >
                {p.ready ? "Ready ✓" : "Waiting..."}
              </Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        {!sp.isSpectator && (
          <View style={styles.lobbyActions}>
            {!sp.isHost && (
              <Button
                mode="outlined"
                onPress={sp.sendReady}
                icon="check"
                style={{ marginRight: 8 }}
              >
                Ready
              </Button>
            )}
            {sp.isHost && (
              <Button
                mode="contained"
                onPress={sp.sendStartGame}
                icon="play"
                style={{ marginRight: 8 }}
              >
                Start Game
              </Button>
            )}
            <Button
              mode="outlined"
              onPress={() => setShowInviteModal(true)}
              icon="account-plus"
            >
              Invite
            </Button>
          </View>
        )}

        {/* Invite modal */}
        <InvitePickerModal
          visible={showInviteModal}
          onDismiss={() => setShowInviteModal(false)}
          onSelectFriend={handleSelectFriend}
          onSelectGroup={handleSelectGroup}
          currentUserId={currentFirebaseUser?.uid || ""}
          title="Invite to Sketch Party"
        />
      </SafeAreaView>
    );
  }

  // =========================================================================
  // COUNTDOWN VIEW
  // =========================================================================
  if (sp.phase === "countdown") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.center}>
          <Text
            variant="displayLarge"
            style={{ color: theme.colors.primary, fontSize: 72 }}
          >
            {sp.countdown || "GO!"}
          </Text>
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onSurface, marginTop: 12 }}
          >
            Game starting...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // MAIN GAME VIEW (playing + finished)
  // =========================================================================
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* === HEADER === */}
      <View
        style={[styles.header, { borderBottomColor: theme.colors.outline }]}
      >
        <Button compact onPress={handleBack} icon="arrow-left">
          Back
        </Button>

        <View style={styles.headerCenter}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
            Round {sp.roundNumber}/{sp.rounds}
          </Text>
          {sp.turnSubphase === "drawing" && (
            <Text
              variant="titleLarge"
              style={{
                color:
                  sp.turnSecondsLeft <= 10
                    ? theme.colors.error
                    : theme.colors.primary,
                fontWeight: "bold",
              }}
            >
              {sp.turnSecondsLeft}s
            </Text>
          )}
          {sp.turnSubphase === "choosing" && (
            <Text
              variant="titleLarge"
              style={{ color: theme.colors.tertiary, fontWeight: "bold" }}
            >
              {sp.chooseSecondsLeft}s
            </Text>
          )}
        </View>

        <Text
          style={{
            color: theme.colors.onSurfaceVariant,
            fontSize: 11,
          }}
        >
          {sp.latency ?? "?"}ms
        </Text>
      </View>

      {/* === SPECTATOR BANNER === */}
      {sp.isSpectator && (
        <View
          style={[
            styles.spectatorBanner,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <Text
            style={{ color: theme.colors.onPrimaryContainer, fontSize: 12 }}
          >
            👁 Watching as spectator
          </Text>
        </View>
      )}

      {/* === WORD MASK / CHOOSING === */}
      <View style={styles.wordBar}>
        {sp.turnSubphase === "choosing" && sp.isDrawer ? (
          <Text style={{ color: theme.colors.onSurface, fontStyle: "italic" }}>
            Pick a word below!
          </Text>
        ) : sp.turnSubphase === "choosing" ? (
          <Text style={{ color: theme.colors.onSurface, fontStyle: "italic" }}>
            {sp.players.find((p) => p.uid === sp.currentDrawerUid)
              ?.displayName ?? "Drawer"}{" "}
            is choosing a word...
          </Text>
        ) : sp.isDrawer && sp.drawerWord ? (
          <Text
            style={{
              color: theme.colors.primary,
              letterSpacing: 2,
              fontSize: 22,
              fontWeight: "bold",
            }}
          >
            {sp.drawerWord}
          </Text>
        ) : sp.wordMask ? (
          <Text
            style={{
              color: theme.colors.primary,
              letterSpacing: 4,
              fontSize: 22,
              fontWeight: "bold",
              fontFamily: "monospace",
            }}
          >
            {sp.wordMask}
          </Text>
        ) : null}
      </View>

      {/* === WORD CHOICE OVERLAY (drawer only, choosing phase) === */}
      {sp.turnSubphase === "choosing" &&
        sp.isDrawer &&
        sp.wordChoices.length > 0 && (
          <View style={styles.wordChoiceOverlay}>
            {sp.wordChoices.map((word, i) => (
              <Button
                key={word}
                mode="contained"
                onPress={() => sp.sendChooseWord(i)}
                style={styles.wordChoiceBtn}
                labelStyle={{ fontSize: 16 }}
              >
                {word}
              </Button>
            ))}
          </View>
        )}

      {/* === CANVAS + SIDEBAR === */}
      <View style={isCompact ? styles.gameBodyCompact : styles.gameBody}>
        {/* Canvas */}
        <View
          style={isCompact ? styles.canvasColumnCompact : styles.canvasColumn}
        >
          <SketchCanvas
            ref={canvasRef}
            canDraw={sp.canDraw}
            brushColor={brushColor}
            brushWidth={brushWidth}
            isEraser={isEraser}
            drawOps={sp.drawOps}
            canvasSnapshot={sp.canvasSnapshot}
            onDrawBegin={sp.sendDrawBegin}
            onDrawPoints={sp.sendDrawPoints}
            onDrawEnd={sp.sendDrawEnd}
          />

          {/* Toolbar (drawer only) */}
          {sp.canDraw && (
            <SketchToolbar
              selectedColor={brushColor}
              onColorChange={(c) => {
                setBrushColor(c);
                setIsEraser(false);
              }}
              brushWidth={brushWidth}
              onBrushWidthChange={setBrushWidth}
              isEraser={isEraser}
              onEraserToggle={() => setIsEraser((prev) => !prev)}
              onUndo={handleUndo}
              onClear={handleClear}
            />
          )}
        </View>

        {/* Sidebar: scoreboard + chat — desktop only */}
        {!isCompact && (
          <View style={styles.sidebar}>
            {/* Scoreboard */}
            <View style={styles.scoreboard}>
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.onSurface, marginBottom: 4 }}
              >
                Players
              </Text>
              <ScrollView style={{ flex: 1 }}>
                {sortedPlayers.map((p) => (
                  <View
                    key={p.sessionId}
                    style={[
                      styles.playerRow,
                      { borderBottomColor: theme.colors.outlineVariant },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={[
                          {
                            color: theme.colors.onSurface,
                            fontSize: 13,
                          },
                          p.isDrawer && { fontWeight: "bold" },
                          !p.connected && { opacity: 0.4 },
                        ]}
                      >
                        {p.isDrawer ? "🎨 " : ""}
                        {p.hasGuessed ? "✅ " : ""}
                        {p.displayName}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {p.score}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Chat */}
            <SketchPartyChat
              messages={sp.chatMessages}
              canGuess={sp.canGuess}
              onSendGuess={sp.sendGuess}
            />
          </View>
        )}

        {/* Bottom tabs: players / chat — mobile only */}
        {isCompact && (
          <View style={styles.bottomPanel}>
            {/* Tab bar */}
            <View style={styles.bottomTabBar}>
              <Button
                compact
                mode={activeTab === "players" ? "contained-tonal" : "text"}
                onPress={() => setActiveTab("players")}
                icon="account-group"
              >
                Players
              </Button>
              <Button
                compact
                mode={activeTab === "chat" ? "contained-tonal" : "text"}
                onPress={() => setActiveTab("chat")}
                icon="chat"
              >
                Chat
              </Button>
            </View>
            {/* Tab content */}
            {activeTab === "players" ? (
              <ScrollView style={styles.bottomTabContent}>
                {sortedPlayers.map((p) => (
                  <View
                    key={p.sessionId}
                    style={[
                      styles.playerRow,
                      { borderBottomColor: theme.colors.outlineVariant },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={[
                          {
                            color: theme.colors.onSurface,
                            fontSize: 13,
                          },
                          p.isDrawer && { fontWeight: "bold" },
                          !p.connected && { opacity: 0.4 },
                        ]}
                      >
                        {p.isDrawer ? "🎨 " : ""}
                        {p.hasGuessed ? "✅ " : ""}
                        {p.displayName}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {p.score}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.bottomTabContent}>
                <SketchPartyChat
                  messages={sp.chatMessages}
                  canGuess={sp.canGuess}
                  onSendGuess={sp.sendGuess}
                />
              </View>
            )}
          </View>
        )}
      </View>

      {/* === REVEAL OVERLAY === */}
      {sp.turnSubphase === "reveal" && sp.lastReveal && (
        <View style={styles.revealOverlay}>
          <View
            style={[
              styles.revealCard,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurface, marginBottom: 4 }}
            >
              The word was:
            </Text>
            <Text
              variant="headlineMedium"
              style={{
                color: theme.colors.primary,
                fontWeight: "bold",
                marginBottom: 12,
              }}
            >
              {sp.lastReveal.word}
            </Text>
            {sp.lastReveal.deltas
              .filter((d) => d.delta > 0)
              .sort((a, b) => b.delta - a.delta)
              .map((d) => {
                const p = sp.players.find((pl) => pl.uid === d.uid);
                return (
                  <Text
                    key={d.uid}
                    style={{ color: theme.colors.onSurface, fontSize: 13 }}
                  >
                    {p?.displayName ?? d.uid}: +{d.delta}
                  </Text>
                );
              })}
          </View>
        </View>
      )}

      {/* === GAME OVER MODAL === */}
      <GameOverModal
        visible={showGameOver}
        result={gameResult}
        stats={{
          score: sp.players.find((p) => p.sessionId === sp.mySessionId)?.score,
          opponentName: winnerPlayer?.displayName,
          xpEarned: xpEarned || undefined,
          didLevelUp: didLevelUp || undefined,
          newLevel: newLevel || undefined,
        }}
        onExit={() => {
          setShowGameOver(false);
          handleBack();
        }}
        onRematch={() => {
          setShowGameOver(false);
          // Navigate back to games hub or stay for rematch
          handleBack();
        }}
        showRematch={false}
        title={
          gameResult === "win"
            ? "You Won!"
            : `${winnerPlayer?.displayName ?? "Winner"} Wins!`
        }
      />

      {/* Invite modal (accessible from game too) */}
      <InvitePickerModal
        visible={showInviteModal}
        onDismiss={() => setShowInviteModal(false)}
        onSelectFriend={handleSelectFriend}
        onSelectGroup={handleSelectGroup}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Invite to Sketch Party"
      />
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  // --- Header ---
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: {
    alignItems: "center",
  },

  // --- Spectator ---
  spectatorBanner: {
    alignItems: "center",
    paddingVertical: 4,
  },

  // --- Word bar ---
  wordBar: {
    alignItems: "center",
    paddingVertical: 6,
    minHeight: 36,
  },

  // --- Word choice overlay ---
  wordChoiceOverlay: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  wordChoiceBtn: {
    minWidth: 100,
  },

  // --- Game body ---
  gameBody: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 4,
    gap: 4,
  },
  gameBodyCompact: {
    flex: 1,
    flexDirection: "column",
    paddingHorizontal: 4,
    gap: 4,
  },
  canvasColumn: {
    flex: 3,
    gap: 4,
  },
  canvasColumnCompact: {
    flex: 1,
    gap: 4,
    minHeight: 200,
  },
  sidebar: {
    flex: 2,
    gap: 4,
  },

  // --- Bottom panel (mobile) — roughly keyboard-height for comfortable use ---
  bottomPanel: {
    height: 280,
    minHeight: 220,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ccc",
  },
  bottomTabBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 4,
  },
  bottomTabContent: {
    flex: 1,
    paddingHorizontal: 4,
  },

  // --- Scoreboard ---
  scoreboard: {
    flex: 1,
    maxHeight: 160,
  },
  playerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // --- Reveal overlay ---
  revealOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 10,
  },
  revealCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 200,
  },

  // --- Lobby ---
  lobbyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  settingsSummary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
  },
  lobbyPlayerList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  lobbyPlayerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lobbyActions: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});
