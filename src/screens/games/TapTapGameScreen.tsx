/**
 * TapTapGameScreen — Piano Tiles / Rhythm Tap
 *
 * How to play:
 * 1. Tiles scroll down across 4 columns
 * 2. Tap tiles before they pass the bottom
 * 3. Don't tap empty lanes — that's a miss!
 * 4. Speed increases over time
 *
 * Supports: Single-player quick play, Colyseus multiplayer (score race)
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import {
  CountdownOverlay,
  GameOverOverlay,
  OpponentScoreBar,
  ReconnectingOverlay,
  WaitingOverlay,
} from "@/components/games/MultiplayerOverlay";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useMultiplayerGame } from "@/hooks/useMultiplayerGame";
import { useSpectator } from "@/hooks/useSpectator";
import {
  getPersonalBest,
  PersonalBest,
  recordGameSession,
  sendScorecard,
} from "@/services/games";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useColors } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Canvas,
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameCompletion } from "@/hooks/useGameCompletion";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const GAME_TYPE = "tap_tap_game";
const COLS = 4;
const COL_WIDTH = (SCREEN_WIDTH - 32) / COLS;
const TILE_HEIGHT = 100;
const PLAY_HEIGHT = SCREEN_HEIGHT - 200;
const INITIAL_SPEED = 2.5; // px per frame
const SPEED_INCREMENT = 0.003;

type GameState = "menu" | "playing" | "result";

interface Tile {
  id: number;
  col: number;
  y: number;
  tapped: boolean;
  missed: boolean;
}

// =============================================================================
// Component
// =============================================================================

function TapTapGameScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const __codexGameCompletion = useGameCompletion({ gameType: "tap_tap" });
  void __codexGameCompletion;

  useGameBackHandler({ gameType: "tap_tap", isGameOver: false });
  const __codexGameHaptics = useGameHaptics();
  void __codexGameHaptics;
  const __codexGameOverModal = (
    <GameOverModal visible={false} result="loss" stats={{}} onExit={() => {}} />
  );
  void __codexGameOverModal;

  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // Multiplayer
  const { resolvedMode, firestoreGameId } = useGameConnection(
    GAME_TYPE,
    route?.params?.matchId,
  );
  const mp = useMultiplayerGame({
    gameType: GAME_TYPE,
    firestoreGameId: firestoreGameId ?? undefined,
  });

  useEffect(() => {
    if (resolvedMode === "colyseus" && firestoreGameId) {
      mp.startMultiplayer();
    }
  }, [resolvedMode, firestoreGameId]);

  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "tap_tap",
  });

  const tilesRef = useRef<Tile[]>([]);
  const scoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const nextIdRef = useRef(0);
  const frameRef = useRef(0);
  const loopRef = useRef<number>(null!);
  const [renderTiles, setRenderTiles] = useState<Tile[]>([]);
  const [lives, setLives] = useState(3);
  const livesRef = useRef(3);

  useEffect(() => {
    spectatorHost.startHosting();
  }, [spectatorHost.startHosting]);

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  useEffect(() => {
    if (gameState !== "playing") return;
    spectatorHost.updateGameState(
      JSON.stringify({
        phase: gameState,
        tiles: renderTiles.map((tile) => ({
          col: tile.col,
          y: tile.y,
          tapped: tile.tapped,
          missed: tile.missed,
        })),
      }),
      score,
      1,
      lives,
    );
  }, [
    gameState,
    lives,
    renderTiles,
    score,
    spectatorHost.updateGameState,
  ]);

  const endGame = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    setScore(scoreRef.current);
    setGameState("result");
    spectatorHost.endHosting(scoreRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    // Report to multiplayer
    if (mp.isMultiplayer) {
      mp.reportFinished();
    }
    if (currentFirebaseUser) {
      recordGameSession(currentFirebaseUser.uid, {
        gameId: GAME_TYPE,
        score: scoreRef.current,
        duration: (scoreRef.current / (INITIAL_SPEED * 60)) * 1000,
      });
    }
  }, [currentFirebaseUser, mp, spectatorHost.endHosting]);

  const startGame = useCallback(() => {
    tilesRef.current = [];
    scoreRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    nextIdRef.current = 0;
    frameRef.current = 0;
    livesRef.current = 3;
    setLives(3);
    setScore(0);
    setGameState("playing");
    spectatorHost.startHosting();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Spawn first tiles
    for (let i = 0; i < 4; i++) {
      tilesRef.current.push({
        id: nextIdRef.current++,
        col: Math.floor(Math.random() * COLS),
        y: -TILE_HEIGHT * (i + 1) * 1.5,
        tapped: false,
        missed: false,
      });
    }

    const loop = () => {
      frameRef.current++;
      speedRef.current += SPEED_INCREMENT;

      // Move tiles
      for (const tile of tilesRef.current) {
        tile.y += speedRef.current;
      }

      // Check for missed tiles
      const missed = tilesRef.current.filter(
        (t) => !t.tapped && !t.missed && t.y > PLAY_HEIGHT,
      );
      if (missed.length > 0) {
        missed.forEach((t) => (t.missed = true));
        livesRef.current -= missed.length;
        setLives(Math.max(0, livesRef.current));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (mp.isMultiplayer) {
          for (let i = 0; i < missed.length; i++) mp.reportLifeLost();
        }
        if (livesRef.current <= 0) {
          endGame();
          return;
        }
      }

      // Remove tiles that are far off screen
      tilesRef.current = tilesRef.current.filter(
        (t) => t.y < PLAY_HEIGHT + TILE_HEIGHT * 2,
      );

      // Spawn new tiles
      const topTile = tilesRef.current.reduce(
        (min, t) => (t.y < min ? t.y : min),
        Infinity,
      );
      if (topTile > -TILE_HEIGHT) {
        tilesRef.current.push({
          id: nextIdRef.current++,
          col: Math.floor(Math.random() * COLS),
          y: topTile - TILE_HEIGHT * 1.5,
          tapped: false,
          missed: false,
        });
      }

      setRenderTiles([...tilesRef.current]);
      loopRef.current = requestAnimationFrame(loop);
    };

    loopRef.current = requestAnimationFrame(loop);
  }, [endGame, spectatorHost.startHosting]);

  const tapTile = useCallback(
    (col: number) => {
      if (gameState !== "playing") return;

      // Find the lowest untapped tile in this column
      const candidates = tilesRef.current
        .filter(
          (t) =>
            t.col === col &&
            !t.tapped &&
            !t.missed &&
            t.y > 0 &&
            t.y < PLAY_HEIGHT,
        )
        .sort((a, b) => b.y - a.y);

      if (candidates.length > 0) {
        candidates[0].tapped = true;
        scoreRef.current++;
        setScore(scoreRef.current);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Report score to multiplayer
        if (mp.isMultiplayer) mp.reportScore(scoreRef.current);
      } else {
        // Tapped empty — penalty
        livesRef.current--;
        setLives(Math.max(0, livesRef.current));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (mp.isMultiplayer) mp.reportLifeLost();
        if (livesRef.current <= 0) {
          endGame();
        }
      }
    },
    [gameState, endGame],
  );

  useEffect(() => {
    return () => {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (loopRef.current) cancelAnimationFrame(loopRef.current);
            navigation.goBack();
          }}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>🎹 Tap Tap</Text>
        {gameState === "playing" && (
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreText, { color: colors.primary }]}>
              {score}
            </Text>
          </View>
        )}
        {gameState !== "playing" &&
          (spectatorHost.spectatorRoomId ? (
            <TouchableOpacity
              onPress={() => setShowSpectatorInvitePicker(true)}
              style={styles.backBtn}
              accessibilityLabel="Invite spectators"
            >
              <MaterialCommunityIcons
                name="eye"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 50 }} />
          ))}
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            Tap Tap
          </Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Tap the tiles as they scroll down!
          </Text>
          {personalBest && (
            <Text style={[styles.bestText, { color: colors.primary }]}>
              Best: {personalBest.bestScore}
            </Text>
          )}
          <Button
            mode="contained"
            onPress={startGame}
            style={{ backgroundColor: colors.primary, marginTop: 24 }}
            labelStyle={{ color: "#fff" }}
          >
            Start Game
          </Button>
          {mp.isAvailable && (
            <Button
              mode="outlined"
              onPress={() => {
                mp.startMultiplayer().then(() => {
                  mp.sendReady();
                });
              }}
              style={{ borderColor: colors.primary, marginTop: 12 }}
              textColor={colors.primary}
              icon="account-multiple"
            >
              Multiplayer
            </Button>
          )}
        </View>
      )}

      {gameState === "playing" && (
        <View style={styles.playArea}>
          {/* Multiplayer opponent bar */}
          {mp.isMultiplayer && mp.phase === "playing" && (
            <OpponentScoreBar
              opponentName={mp.opponentName}
              opponentScore={mp.opponentScore}
              myScore={score}
              timeRemaining={mp.timeRemaining}
              opponentDisconnected={mp.opponentDisconnected}
              colors={{
                primary: colors.primary,
                background: colors.background,
                surface: colors.surface,
                text: colors.text,
                textSecondary: colors.textSecondary,
                border: colors.border,
              }}
            />
          )}

          {/* Lives */}
          <View style={styles.livesRow}>
            {Array.from({ length: 3 }).map((_, i) => (
              <MaterialCommunityIcons
                key={i}
                name={i < lives ? "heart" : "heart-broken"}
                size={20}
                color={i < lives ? "#e74c3c" : colors.border}
                style={{ marginRight: 4 }}
              />
            ))}
          </View>

          {/* Play field */}
          <View style={[styles.field, { height: PLAY_HEIGHT }]}>
            {/* Column dividers */}
            {Array.from({ length: COLS - 1 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.divider,
                  {
                    left: COL_WIDTH * (i + 1),
                    backgroundColor: colors.border,
                  },
                ]}
              />
            ))}

            {/* Tiles — Skia gradient */}
            {renderTiles.map((tile) => {
              const tileW = COL_WIDTH - 2;
              const tileColor = tile.tapped
                ? "#27ae60"
                : tile.missed
                  ? "#e74c3c"
                  : colors.text;
              const alpha = tile.tapped || tile.missed ? "80" : "FF";
              return (
                <View
                  key={tile.id}
                  style={[
                    styles.tile,
                    {
                      left: tile.col * COL_WIDTH + 1,
                      top: tile.y,
                      width: tileW,
                      height: TILE_HEIGHT,
                    },
                  ]}
                >
                  <Canvas style={{ width: tileW, height: TILE_HEIGHT }}>
                    <RoundedRect
                      x={0}
                      y={0}
                      width={tileW}
                      height={TILE_HEIGHT}
                      r={4}
                    >
                      <LinearGradient
                        start={vec(0, 0)}
                        end={vec(0, TILE_HEIGHT)}
                        colors={[
                          `${tileColor}${alpha}`,
                          `${tileColor}CC`,
                          `${tileColor}${alpha}`,
                        ]}
                      />
                      <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.3)" />
                    </RoundedRect>
                    {/* Top highlight */}
                    <RoundedRect x={2} y={1} width={tileW - 4} height={4} r={2}>
                      <LinearGradient
                        start={vec(0, 1)}
                        end={vec(0, 5)}
                        colors={[
                          "rgba(255,255,255,0.25)",
                          "rgba(255,255,255,0)",
                        ]}
                      />
                    </RoundedRect>
                  </Canvas>
                </View>
              );
            })}

            {/* Tap zones */}
            {Array.from({ length: COLS }).map((_, col) => (
              <TouchableOpacity
                key={col}
                onPress={() => tapTile(col)}
                style={[
                  styles.tapZone,
                  {
                    left: col * COL_WIDTH,
                    width: COL_WIDTH,
                    height: PLAY_HEIGHT,
                  },
                ]}
                activeOpacity={1}
              />
            ))}
          </View>
        </View>
      )}

      {/* Result */}
      <Portal>
        <Dialog
          visible={gameState === "result"}
          onDismiss={() => {}}
          style={{ backgroundColor: colors.surface }}
        >
          <Dialog.Title style={{ color: colors.text, textAlign: "center" }}>
            🎹 Game Over!
          </Dialog.Title>
          <Dialog.Content>
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                fontSize: 16,
              }}
            >
              Tiles tapped: {score}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={startGame}>Play Again</Button>
            <Button onPress={() => setShowFriendPicker(true)}>Share</Button>
            <Button onPress={() => setGameState("menu")}>Menu</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={async (friend) => {
          if (!currentFirebaseUser || isSending) return;
          setIsSending(true);
          try {
            await sendScorecard(currentFirebaseUser.uid, friend.friendUid, {
              gameId: GAME_TYPE,
              score: score,
              playerName: profile?.displayName || "Player",
            });
            showSuccess("Score shared!");
          } catch {
            showError("Failed to share");
          }
          setIsSending(false);
          setShowFriendPicker(false);
        }}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Share Score With"
      />

      {spectatorHost.spectatorCount > 0 && (
        <SpectatorOverlay spectatorCount={spectatorHost.spectatorCount} />
      )}

      <SpectatorInviteModal
        visible={showSpectatorInvitePicker}
        onDismiss={() => setShowSpectatorInvitePicker(false)}
        currentUserId={currentFirebaseUser?.uid || ""}
        inviteData={
          spectatorHost.spectatorRoomId
            ? {
                roomId: spectatorHost.spectatorRoomId,
                gameType: "tap_tap",
                hostName: profile?.displayName || profile?.username || "Player",
              }
            : null
        }
        onInviteRef={(ref) => spectatorHost.registerInviteMessage(ref)}
        onSent={(name) => showSuccess(`Spectator invite sent to ${name}!`)}
        onError={showError}
      />

      {/* Multiplayer Overlays */}
      {mp.isMultiplayer && mp.phase === "waiting" && (
        <WaitingOverlay
          colors={{
            primary: colors.primary,
            background: colors.background,
            surface: colors.surface,
            text: colors.text,
            textSecondary: colors.textSecondary,
            border: colors.border,
          }}
          onCancel={mp.cancelMultiplayer}
        />
      )}
      {mp.isMultiplayer && mp.phase === "countdown" && (
        <CountdownOverlay
          countdown={mp.countdown}
          colors={{
            primary: colors.primary,
            background: colors.background,
            surface: colors.surface,
            text: colors.text,
            textSecondary: colors.textSecondary,
            border: colors.border,
          }}
        />
      )}
      {mp.isMultiplayer && mp.reconnecting && (
        <ReconnectingOverlay
          colors={{
            primary: colors.primary,
            background: colors.background,
            surface: colors.surface,
            text: colors.text,
            textSecondary: colors.textSecondary,
            border: colors.border,
          }}
        />
      )}
      {mp.isMultiplayer && mp.phase === "finished" && (
        <GameOverOverlay
          isWinner={mp.isWinner}
          isTie={mp.isTie}
          winnerName={mp.winnerName}
          myScore={score}
          opponentScore={mp.opponentScore}
          opponentName={mp.opponentName}
          rematchRequested={mp.rematchRequested}
          colors={{
            primary: colors.primary,
            background: colors.background,
            surface: colors.surface,
            text: colors.text,
            textSecondary: colors.textSecondary,
            border: colors.border,
          }}
          onPlayAgain={startGame}
          onRematch={mp.requestRematch}
          onAcceptRematch={mp.acceptRematch}
          onMenu={() => {
            mp.cancelMultiplayer();
            setGameState("menu");
          }}
          onShare={() => setShowFriendPicker(true)}
        />
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  scoreRow: { flexDirection: "row", alignItems: "center" },
  scoreText: { fontSize: 20, fontWeight: "800" },
  menuContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuTitle: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  menuSub: { fontSize: 16, marginBottom: 16 },
  bestText: { fontSize: 14, fontWeight: "600" },
  playArea: { flex: 1, paddingHorizontal: 16 },
  livesRow: { flexDirection: "row", justifyContent: "center", marginBottom: 8 },
  field: { position: "relative", overflow: "hidden", borderRadius: 8 },
  divider: { position: "absolute", top: 0, bottom: 0, width: 1 },
  tile: { position: "absolute" },
  tapZone: { position: "absolute", top: 0 },
  dialogActions: { justifyContent: "center" },
});

export default withGameErrorBoundary(TapTapGameScreen, "tap_tap");
