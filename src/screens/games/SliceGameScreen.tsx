/**
 * SliceGameScreen — Fruit Ninja / Slice Game
 *
 * How to play:
 * 1. Shapes are tossed from the bottom of the screen
 * 2. Swipe across them to slice!
 * 3. Slice combos for bonus points
 * 4. Avoid bombs — they end the game!
 *
 * Supports: Single-player quick play, Colyseus multiplayer
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
  RadialGradient,
  RoundedRect,
  Circle as SkiaCircle,
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
import { Gesture, GestureDetector } from "react-native-gesture-handler";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const GAME_TYPE = "slice_game";
const GRAVITY = 0.25;
const SPAWN_INTERVAL = 900; // ms base
const SHAPE_SIZE = 50;
const TOP_OFFSET = Platform.OS === "ios" ? 100 : 80;

type GameState = "menu" | "playing" | "result";

interface FlyingShape {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isBomb: boolean;
  sliced: boolean;
  color: string;
  icon: string;
  size: number;
}

const SHAPE_CONFIGS = [
  { icon: "apple", color: "#e74c3c" },
  { icon: "food-apple", color: "#27ae60" },
  { icon: "fruit-watermelon", color: "#2ecc71" },
  { icon: "fruit-grapes", color: "#8e44ad" },
  { icon: "fruit-cherries", color: "#c0392b" },
  { icon: "fruit-citrus", color: "#f39c12" },
];

// =============================================================================
// Component
// =============================================================================

function SliceGameScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const __codexGameCompletion = useGameCompletion({ gameType: "slice" });
  void __codexGameCompletion;

  useGameBackHandler({ gameType: "slice", isGameOver: false });
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
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "slice",
  });

  const shapesRef = useRef<FlyingShape[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const comboRef = useRef(0);
  const nextIdRef = useRef(0);
  const loopRef = useRef<number>(null!);
  const spawnRef = useRef<ReturnType<typeof setInterval>>(null!);
  const [renderShapes, setRenderShapes] = useState<FlyingShape[]>([]);
  const sliceTrailRef = useRef<{ x: number; y: number }[]>([]);
  const [sliceTrail, setSliceTrail] = useState<{ x: number; y: number }[]>([]);
  const startTimeRef = useRef(0);

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
        shapes: shapesRef.current.map((shape) => ({
          x: shape.x,
          y: shape.y,
          isBomb: shape.isBomb,
          sliced: shape.sliced,
        })),
        combo,
      }),
      score,
      1,
      lives,
    );
  }, [combo, gameState, lives, score, spectatorHost.updateGameState]);

  const endGame = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    setScore(scoreRef.current);
    setGameState("result");
    spectatorHost.endHosting(scoreRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (mp.isMultiplayer) mp.reportFinished();
    if (currentFirebaseUser) {
      const duration = Date.now() - startTimeRef.current;
      recordGameSession(currentFirebaseUser.uid, {
        gameId: GAME_TYPE,
        score: scoreRef.current,
        duration,
      });
    }
  }, [currentFirebaseUser, mp, spectatorHost.endHosting]);

  const spawnShape = useCallback(() => {
    const isBomb = Math.random() < 0.15;
    const shape =
      SHAPE_CONFIGS[Math.floor(Math.random() * SHAPE_CONFIGS.length)];
    const x = SCREEN_WIDTH * 0.2 + Math.random() * SCREEN_WIDTH * 0.6;
    const vx = (Math.random() - 0.5) * 4;
    const vy = -(8 + Math.random() * 4);

    shapesRef.current.push({
      id: nextIdRef.current++,
      x,
      y: SCREEN_HEIGHT,
      vx,
      vy,
      isBomb,
      sliced: false,
      color: isBomb ? "#333" : shape.color,
      icon: isBomb ? "bomb" : shape.icon,
      size: SHAPE_SIZE,
    });
  }, []);

  const startGame = useCallback(() => {
    shapesRef.current = [];
    scoreRef.current = 0;
    livesRef.current = 3;
    comboRef.current = 0;
    nextIdRef.current = 0;
    startTimeRef.current = Date.now();
    setScore(0);
    setLives(3);
    setCombo(0);
    setGameState("playing");
    spectatorHost.startHosting();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Spawn timer
    spawnRef.current = setInterval(() => {
      spawnShape();
      // Occasionally spawn multiple
      if (Math.random() < 0.3) spawnShape();
      if (Math.random() < 0.1) spawnShape();
    }, SPAWN_INTERVAL);

    const loop = () => {
      // Physics
      for (const shape of shapesRef.current) {
        shape.x += shape.vx;
        shape.y += shape.vy;
        shape.vy += GRAVITY;
      }

      // Check for unsliced shapes that fell off bottom
      const fallen = shapesRef.current.filter(
        (s) => !s.sliced && !s.isBomb && s.y > SCREEN_HEIGHT + 50 && s.vy > 0,
      );
      if (fallen.length > 0) {
        livesRef.current -= fallen.length;
        if (mp.isMultiplayer) {
          for (let i = 0; i < fallen.length; i++) mp.reportLifeLost();
        }
        setLives(Math.max(0, livesRef.current));
        comboRef.current = 0;
        setCombo(0);
        if (livesRef.current <= 0) {
          endGame();
          return;
        }
      }

      // Remove off-screen shapes
      shapesRef.current = shapesRef.current.filter(
        (s) => s.y < SCREEN_HEIGHT + 100 || s.vy < 0,
      );

      setRenderShapes([...shapesRef.current]);
      loopRef.current = requestAnimationFrame(loop);
    };

    loopRef.current = requestAnimationFrame(loop);
  }, [endGame, spawnShape, spectatorHost.startHosting]);

  const handleSliceStart = useCallback((x: number, y: number) => {
    sliceTrailRef.current = [{ x, y }];
    setSliceTrail([{ x, y }]);
  }, []);

  const handleSliceMove = useCallback(
    (x: number, y: number) => {
      sliceTrailRef.current.push({ x, y });
      if (sliceTrailRef.current.length > 20) sliceTrailRef.current.shift();
      setSliceTrail([...sliceTrailRef.current]);

      // Check intersections with shapes
      for (const shape of shapesRef.current) {
        if (shape.sliced) continue;
        const dist = Math.hypot(x - shape.x, y - shape.y);
        if (dist < shape.size) {
          shape.sliced = true;
          if (shape.isBomb) {
            endGame();
            return;
          }
          comboRef.current++;
          if (mp.isMultiplayer) mp.reportCombo(comboRef.current);
          const comboBonus = comboRef.current > 1 ? comboRef.current : 0;
          scoreRef.current += 1 + comboBonus;
          setScore(scoreRef.current);
          if (mp.isMultiplayer) mp.reportScore(scoreRef.current);
          setCombo(comboRef.current);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },
    [endGame, mp],
  );

  const handleSliceEnd = useCallback(() => {
    sliceTrailRef.current = [];
    setSliceTrail([]);
    comboRef.current = 0;
    setCombo(0);
  }, []);

  const sliceGesture = useRef(
    Gesture.Pan()
      .runOnJS(true)
      .onStart((event) => {
        handleSliceStart(event.absoluteX, event.absoluteY);
      })
      .onUpdate((event) => {
        handleSliceMove(event.absoluteX, event.absoluteY);
      })
      .onEnd(() => {
        handleSliceEnd();
      }),
  ).current;

  useEffect(() => {
    return () => {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
      if (spawnRef.current) clearInterval(spawnRef.current);
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.backBtn}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
            onPress={() => {
              if (loopRef.current) cancelAnimationFrame(loopRef.current);
              if (spawnRef.current) clearInterval(spawnRef.current);
              navigation.goBack();
            }}
          />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>🍉 Slice</Text>
        {gameState === "playing" ? (
          <View style={styles.headerRight}>
            <Text style={[styles.scoreText, { color: colors.primary }]}>
              {score}
            </Text>
          </View>
        ) : spectatorHost.spectatorRoomId ? (
          <TouchableOpacity
            onPress={() => setShowSpectatorInvitePicker(true)}
            style={styles.backBtn}
            accessibilityLabel="Invite spectators"
          >
            <MaterialCommunityIcons name="eye" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>Slice</Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Swipe to slice fruit. Avoid bombs! 💣
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
            Start Slicing
          </Button>
          {mp.isAvailable && (
            <Button
              mode="outlined"
              onPress={() => {
                mp.startMultiplayer().then(() => mp.sendReady());
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
        <GestureDetector gesture={sliceGesture}>
          <View style={styles.playArea}>
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
          {/* Skia gradient background */}
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <RoundedRect
              x={0}
              y={0}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT}
              r={0}
            >
              <LinearGradient
                start={vec(SCREEN_WIDTH / 2, 0)}
                end={vec(SCREEN_WIDTH / 2, SCREEN_HEIGHT)}
                colors={["#1A0A2E", "#16213E", "#0F3460"]}
              />
            </RoundedRect>
          </Canvas>

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
            {combo > 1 && (
              <Text style={[styles.comboText, { color: colors.primary }]}>
                {combo}x COMBO!
              </Text>
            )}
          </View>

          {/* Shapes with Skia glow */}
          {renderShapes.map((shape) => (
            <View
              key={shape.id}
              style={[
                styles.shape,
                {
                  left: shape.x - shape.size / 2,
                  top: shape.y - shape.size / 2,
                  opacity: shape.sliced ? 0.3 : 1,
                },
              ]}
            >
              <Canvas
                style={{ width: shape.size, height: shape.size }}
                pointerEvents="none"
              >
                <SkiaCircle
                  cx={shape.size / 2}
                  cy={shape.size / 2}
                  r={shape.size / 2}
                >
                  <RadialGradient
                    c={vec(shape.size / 2, shape.size / 2)}
                    r={shape.size / 2}
                    colors={[
                      shape.isBomb ? "#66666680" : shape.color + "90",
                      shape.isBomb ? "#33333300" : shape.color + "00",
                    ]}
                  />
                </SkiaCircle>
              </Canvas>
              <View style={{ position: "absolute", top: 0, left: 0 }}>
                <MaterialCommunityIcons
                  name={shape.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={shape.size}
                  color={shape.color}
                />
              </View>
              {shape.sliced && (
                <View style={styles.sliceMark}>
                  <View
                    style={[styles.sliceLine, { backgroundColor: "#fff" }]}
                  />
                </View>
              )}
            </View>
          ))}

          {/* Skia slice trail with glow */}
          {sliceTrail.length > 1 &&
            sliceTrail.slice(-10).map((pt, i, arr) => {
              if (i === 0) return null;
              const pct = i / arr.length;
              const dotSize = 6 + pct * 8;
              return (
                <Canvas
                  key={i}
                  style={[
                    styles.trailDot,
                    {
                      left: pt.x - dotSize / 2,
                      top: pt.y - dotSize / 2,
                      width: dotSize,
                      height: dotSize,
                      opacity: pct,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <SkiaCircle cx={dotSize / 2} cy={dotSize / 2} r={dotSize / 2}>
                    <RadialGradient
                      c={vec(dotSize / 2, dotSize / 2)}
                      r={dotSize / 2}
                      colors={[
                        "#FFFFFF",
                        colors.primary,
                        colors.primary + "00",
                      ]}
                    />
                  </SkiaCircle>
                </Canvas>
              );
            })}
          </View>
        </GestureDetector>
      )}

      {/* Result */}
      <Portal>
        <Dialog
          visible={gameState === "result"}
          onDismiss={() => {}}
          style={{ backgroundColor: colors.surface }}
        >
          <Dialog.Title style={{ color: colors.text, textAlign: "center" }}>
            🍉 Game Over!
          </Dialog.Title>
          <Dialog.Content>
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                fontSize: 16,
              }}
            >
              Score: {score}
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
                gameType: "slice",
                hostName: profile?.displayName || profile?.username || "Player",
              }
            : null
        }
        onInviteRef={(ref) => spectatorHost.registerInviteMessage(ref)}
        onSent={(name) => showSuccess(`Spectator invite sent to ${name}!`)}
        onError={showError}
      />

      <WaitingOverlay
        visible={mp.isMultiplayer && mp.phase === "waiting"}
        onCancel={mp.cancelMultiplayer}
        colors={{
          primary: colors.primary,
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        }}
      />
      <CountdownOverlay
        visible={mp.isMultiplayer && mp.phase === "countdown"}
        count={mp.countdown}
        colors={{
          primary: colors.primary,
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        }}
      />
      <ReconnectingOverlay
        visible={mp.isMultiplayer && mp.phase === "reconnecting"}
        colors={{
          primary: colors.primary,
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        }}
      />
      <GameOverOverlay
        visible={mp.isMultiplayer && mp.phase === "gameOver"}
        isWinner={mp.isWinner}
        isTie={mp.isTie}
        winnerName={mp.winnerName}
        myScore={score}
        opponentScore={mp.opponentScore}
        opponentName={mp.opponentName}
        rematchRequested={mp.rematchRequested}
        onPlayAgain={startGame}
        onRematch={mp.requestRematch}
        onAcceptRematch={mp.acceptRematch}
        onMenu={() => {
          mp.cancelMultiplayer();
          setGameState("menu");
        }}
        onShare={() => setShowFriendPicker(true)}
        colors={{
          primary: colors.primary,
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        }}
      />
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
    zIndex: 10,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center" },
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
  playArea: { flex: 1, position: "relative" },
  livesRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    zIndex: 10,
  },
  comboText: {
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 12,
  },
  shape: { position: "absolute" },
  sliceMark: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  sliceLine: { width: "100%", height: 2, transform: [{ rotate: "-30deg" }] },
  trailDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dialogActions: { justifyContent: "center" },
});

export default withGameErrorBoundary(SliceGameScreen, "slice");
