/**
 * PongGameScreen — Classic Pong with AI + Friend Invite Multiplayer
 *
 * Modes:
 * - AI: Single-player against computer (easy/medium/hard)
 * - Friend Invite: Real-time 1v1 via Colyseus (invite a friend to play)
 *
 * How to play:
 * 1. Drag your paddle (bottom) to hit the ball
 * 2. Score when the ball passes the opponent's paddle
 * 3. First to 7 wins!
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { GameOverModal } from "@/components/games/GameOverModal";
import { MultiplayerLobbyOverlay } from "@/components/games/MultiplayerLobbyOverlay";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import InvitePickerModal, {
  type FriendItem,
  type GroupItem,
} from "@/components/InvitePickerModal";
import ScoreRaceOverlay, {
  ScoreRaceScoreBar,
  type ScoreRaceOverlayPhase,
} from "@/components/ScoreRaceOverlay";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { useGameLobbyController } from "@/hooks/useGameLobbyController";
import { usePhysicsGame } from "@/hooks/usePhysicsGame";
import { useSpectator } from "@/hooks/useSpectator";
import { onGameResultNotification } from "@/services/gameResultEvents";
import {
  buildGameResultEvent,
  submitGameResult,
} from "@/services/gameResultService";
import {
  getPersonalBest,
  PersonalBest,
  recordGameSession,
  sendScorecard,
} from "@/services/games";
import { getGroupMembers } from "@/services/groups";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useColors } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Canvas,
  Circle,
  DashPathEffect,
  LinearGradient,
  Path,
  RadialGradient,
  RoundedRect,
  Shadow,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const COURT_W = SCREEN_WIDTH - 32;
const COURT_H = SCREEN_HEIGHT * 0.65;
const PADDLE_W = 80;
const PADDLE_H = 14;
const BALL_R = 10;
const WIN_SCORE = 7;
const GAME_TYPE = "pong_game";

type GameState =
  | "menu"
  | "lobby"
  | "playing"
  | "paused"
  | "result"
  | "colyseus";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  speed: number;
}

interface PowerUp {
  x: number;
  y: number;
  type: "speed" | "big" | "shrink";
  active: boolean;
}

// =============================================================================
// Component
// =============================================================================

function PongGameScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const __codexGameCompletion = useGameCompletion({ gameType: "pong" });
  void __codexGameCompletion;

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

  // Spectator mode — passed from chat invite "Spectate" button
  const isSpectatorMode = route?.params?.spectatorMode === true;

  // Colyseus multiplayer hook
  const mp = usePhysicsGame({ gameType: GAME_TYPE });

  // Determine initial mode: lobby (from invite) or menu
  const initialMode: GameState = route?.params?.inviteId ? "lobby" : "menu";
  const [gameState, setGameState] = useState<GameState>(initialMode);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  // ── Lobby Controller (invite-only multiplayer) ──────────────────────
  const lobbyController = useGameLobbyController({
    gameType: "pong_game",
    inviteId: route?.params?.inviteId,
    entryPoint: route?.params?.entryPoint,
    isTurnBased: false,
    onGameReady: (gameId: string) => {
      setGameState("colyseus");
      mp.startMultiplayer({
        firestoreGameId: gameId,
        spectator: isSpectatorMode,
        inviteId: route?.params?.inviteId,
      });
    },
    onLeaveLobby: () => {
      setGameState("menu");
    },
    // Bridge Colyseus room state into controller
    room: mp.room,
    roomPhase: mp.phase,
    roomReconnecting: mp.reconnecting,
    roomOpponentDisconnected: mp.opponentDisconnected,
    roomError: mp.error,
  });

  // Also support direct matchId joins (from chat "Play" button on existing invite)
  const { resolvedMode, firestoreGameId } = useGameConnection(
    GAME_TYPE,
    route?.params?.matchId,
  );
  useEffect(() => {
    // Skip when lobby is handling the invite flow
    if (route?.params?.inviteId) return;
    if (resolvedMode === "colyseus" && firestoreGameId) {
      setGameState("colyseus");
      mp.startMultiplayer({ firestoreGameId });
    }
  }, [resolvedMode, firestoreGameId, route?.params?.inviteId]);

  // Auto-send ready once connected in multiplayer — Pong starts immediately
  // when both players are present (no lobby/ready-up screen needed)
  // Spectators never send ready.
  useEffect(() => {
    if (
      gameState === "colyseus" &&
      mp.phase === "waiting" &&
      mp.connected &&
      !isSpectatorMode
    ) {
      mp.sendReady();
    }
  }, [gameState, mp.phase, mp.connected, isSpectatorMode]);

  // ── Invite handlers ─────────────────────────────────────────────────
  const handleInviteFriend = () => {
    setGameState("lobby");
  };

  const handleSelectInviteFriend = async (friend: FriendItem) => {
    setShowInvitePicker(false);
    if (!currentFirebaseUser || !profile) return;
    setInviteLoading(true);
    try {
      await lobbyController.lobby.sendFriendInvite(
        friend.friendUid,
        friend.displayName || friend.username,
        undefined,
      );
    } catch (error: any) {
      showError(
        error?.message || "Failed to send game invite. Please try again.",
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSelectInviteGroup = async (group: GroupItem) => {
    setShowInvitePicker(false);
    if (!currentFirebaseUser || !profile) return;
    setInviteLoading(true);
    try {
      const members = await getGroupMembers(group.groupId);
      const memberIds = members.map((m) => m.uid);
      await lobbyController.lobby.sendGroupInvite(
        group.groupId,
        group.name,
        memberIds,
      );
    } catch (error: any) {
      showError(
        error?.message || "Failed to send group game invite. Please try again.",
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [wins, setWins] = useState(0);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // XP state (populated via GameResult notification)
  const [xpEarned, setXpEarned] = useState(0);
  const [didLevelUp, setDidLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);

  // Listen for game result notifications (XP + achievements)
  useEffect(() => {
    const unsub = onGameResultNotification((n) => {
      if (n.gameId === "pong_game") {
        setXpEarned(n.xpEarned);
        setDidLevelUp(n.didLevelUp);
        setNewLevel(n.newLevel);
      }
    });
    return unsub;
  }, []);

  // Spectator hosting (only for SP host mode — skip when joining as spectator)
  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "pong_game",
  });
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  // Auto-start spectator hosting for single-player AI mode only.
  // Skip when:
  //  - joining as a spectator (isSpectatorMode)
  //  - joining via a multiplayer invite (inviteId present)
  //  - joining via a direct matchId
  const isMultiplayerJoin = !!(
    route?.params?.inviteId || route?.params?.matchId
  );
  useEffect(() => {
    if (!isSpectatorMode && !isMultiplayerJoin) {
      spectatorHost.startHosting();
    }
  }, [isSpectatorMode, isMultiplayerJoin]);

  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium",
  );

  // Pre-built Skia path for the dashed center line (avoids the
  // undefined-at-runtime <Line> component from react-native-skia v2)
  const centerLinePath = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(16, COURT_H / 2);
    p.lineTo(COURT_W - 16, COURT_H / 2);
    return p;
  }, []);

  const playerX = useRef(COURT_W / 2 - PADDLE_W / 2);
  const aiX = useRef(COURT_W / 2 - PADDLE_W / 2);
  const ball = useRef<Ball>({
    x: COURT_W / 2,
    y: COURT_H / 2,
    vx: 3,
    vy: 4,
    r: BALL_R,
    speed: 5,
  });
  const powerUp = useRef<PowerUp | null>(null);
  const playerPaddleW = useRef(PADDLE_W);
  const frameId = useRef<number>(0);
  const lastTime = useRef(0);
  const spectatorFrameCount = useRef(0);
  const gameStartTime = useRef<number>(0);

  // Reanimated values for high-frequency render updates
  const ballX = useSharedValue(COURT_W / 2);
  const ballY = useSharedValue(COURT_H / 2);
  const playerPaddleX = useSharedValue(COURT_W / 2 - PADDLE_W / 2);
  const aiPaddleX = useSharedValue(COURT_W / 2 - PADDLE_W / 2);

  const playerScoreRef = useRef(0);
  const aiScoreRef = useRef(0);
  const gameStateRef = useRef<GameState>("menu");

  useEffect(() => {
    playerScoreRef.current = playerScore;
  }, [playerScore]);
  useEffect(() => {
    aiScoreRef.current = aiScore;
  }, [aiScore]);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const aiPaddleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: aiPaddleX.value }],
  }));

  const playerPaddleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playerPaddleX.value }],
  }));

  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ballX.value - BALL_R },
      { translateY: ballY.value - BALL_R },
    ],
  }));

  // Load personal best
  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  const resetBall = useCallback(() => {
    const angle = (Math.random() * Math.PI) / 3 + Math.PI / 6;
    const dir = Math.random() > 0.5 ? 1 : -1;
    const speed = 5;
    ball.current = {
      x: COURT_W / 2,
      y: COURT_H / 2,
      vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
      vy: Math.sin(angle) * speed * dir,
      r: BALL_R,
      speed,
    };
    ballX.value = COURT_W / 2;
    ballY.value = COURT_H / 2;
    playerPaddleW.current = PADDLE_W;
  }, [ballX, ballY]);

  const spawnPowerUp = useCallback(() => {
    if (Math.random() > 0.3) return;
    const types: PowerUp["type"][] = ["speed", "big", "shrink"];
    powerUp.current = {
      x: Math.random() * (COURT_W - 40) + 20,
      y: COURT_H * 0.3 + Math.random() * COURT_H * 0.4,
      type: types[Math.floor(Math.random() * types.length)],
      active: true,
    };
  }, []);

  const update = useCallback(() => {
    if (gameStateRef.current !== "playing") return;

    const b = ball.current;
    const aiSpeed =
      difficulty === "easy" ? 2.5 : difficulty === "medium" ? 4 : 6;

    // Move ball
    b.x += b.vx;
    b.y += b.vy;

    // Wall bounces (left/right)
    if (b.x - b.r <= 0 || b.x + b.r >= COURT_W) {
      b.vx *= -1;
      b.x = Math.max(b.r, Math.min(COURT_W - b.r, b.x));
    }

    // Paddle collision (player — bottom)
    const pX = playerX.current;
    const pW = playerPaddleW.current;
    if (
      b.y + b.r >= COURT_H - PADDLE_H - 10 &&
      b.y + b.r <= COURT_H - 10 &&
      b.x >= pX &&
      b.x <= pX + pW &&
      b.vy > 0
    ) {
      b.vy *= -1;
      // Angle based on where ball hits paddle
      const hitPos = (b.x - pX) / pW - 0.5;
      b.vx += hitPos * 3;
      b.speed = Math.min(b.speed + 0.15, 12);
      const mag = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      b.vx = (b.vx / mag) * b.speed;
      b.vy = (b.vy / mag) * b.speed;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Paddle collision (AI — top)
    const aX = aiX.current;
    if (
      b.y - b.r <= PADDLE_H + 10 &&
      b.y - b.r >= 10 &&
      b.x >= aX &&
      b.x <= aX + PADDLE_W &&
      b.vy < 0
    ) {
      b.vy *= -1;
      const hitPos = (b.x - aX) / PADDLE_W - 0.5;
      b.vx += hitPos * 2;
    }

    // Power-up collision
    const pu = powerUp.current;
    if (pu && pu.active) {
      const dx = b.x - pu.x;
      const dy = b.y - pu.y;
      if (Math.sqrt(dx * dx + dy * dy) < b.r + 15) {
        pu.active = false;
        if (pu.type === "speed") {
          b.speed = Math.min(b.speed + 2, 14);
        } else if (pu.type === "big") {
          playerPaddleW.current = Math.min(playerPaddleW.current + 30, 150);
        } else if (pu.type === "shrink") {
          playerPaddleW.current = Math.max(playerPaddleW.current - 20, 40);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }

    // Score — ball past bottom
    if (b.y + b.r > COURT_H) {
      aiScoreRef.current += 1;
      setAiScore(aiScoreRef.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (aiScoreRef.current >= WIN_SCORE) {
        setGameState("result");
        spectatorHost.endHosting(playerScoreRef.current);
        // Submit loss to XP pipeline
        if (currentFirebaseUser) {
          submitGameResult(
            buildGameResultEvent({
              gameId: "pong_game",
              mode: "solo",
              outcome: "lose",
              score: playerScoreRef.current,
              durationMs: Date.now() - gameStartTime.current,
              userId: currentFirebaseUser.uid,
              displayName: currentFirebaseUser.displayName || "Player",
            }),
          ).catch(() => {});
        }
        return;
      }
      resetBall();
      spawnPowerUp();
      // Update animated values after reset, then schedule next frame
      ballX.value = ball.current.x;
      ballY.value = ball.current.y;
      frameId.current = requestAnimationFrame(update);
      return;
    }

    // Score — ball past top
    if (b.y - b.r < 0) {
      playerScoreRef.current += 1;
      setPlayerScore(playerScoreRef.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (playerScoreRef.current >= WIN_SCORE) {
        setGameState("result");
        spectatorHost.endHosting(playerScoreRef.current);
        const newWins = wins + 1;
        setWins(newWins);
        if (currentFirebaseUser) {
          recordGameSession(currentFirebaseUser.uid, {
            gameId: GAME_TYPE,
            score: newWins,
            duration: Math.round((Date.now() - gameStartTime.current) / 1000),
          });
          // Submit win to XP pipeline
          submitGameResult(
            buildGameResultEvent({
              gameId: "pong_game",
              mode: "solo",
              outcome: "win",
              score: newWins,
              durationMs: Date.now() - gameStartTime.current,
              userId: currentFirebaseUser.uid,
              displayName: currentFirebaseUser.displayName || "Player",
            }),
          ).catch(() => {});
        }
        return;
      }
      resetBall();
      spawnPowerUp();
      // Update animated values after reset, then schedule next frame
      ballX.value = ball.current.x;
      ballY.value = ball.current.y;
      frameId.current = requestAnimationFrame(update);
      return;
    }

    // AI paddle movement
    const aiTarget = b.x - PADDLE_W / 2;
    const aiDiff = aiTarget - aiX.current;
    aiX.current += Math.sign(aiDiff) * Math.min(Math.abs(aiDiff), aiSpeed);
    aiX.current = Math.max(0, Math.min(COURT_W - PADDLE_W, aiX.current));

    // Update animated values
    ballX.value = b.x;
    ballY.value = b.y;
    aiPaddleX.value = aiX.current;

    // Broadcast to spectators every ~4 frames (~15fps) for smooth viewing
    spectatorFrameCount.current += 1;
    if (spectatorFrameCount.current % 4 === 0) {
      spectatorHost.updateGameState(
        JSON.stringify({
          playerScore: playerScoreRef.current,
          aiScore: aiScoreRef.current,
          gameState: "playing",
          ballX: b.x,
          ballY: b.y,
          playerPaddleX: playerX.current,
          aiPaddleX: aiX.current,
          courtWidth: COURT_W,
          courtHeight: COURT_H,
        }),
        playerScoreRef.current,
        undefined,
        undefined,
      );
    }

    frameId.current = requestAnimationFrame(update);
  }, [
    difficulty,
    wins,
    currentFirebaseUser,
    resetBall,
    spawnPowerUp,
    aiPaddleX,
    ballX,
    ballY,
  ]);

  const startGame = useCallback(
    (diff: "easy" | "medium" | "hard") => {
      setDifficulty(diff);
      setPlayerScore(0);
      setAiScore(0);
      playerScoreRef.current = 0;
      aiScoreRef.current = 0;
      setXpEarned(0);
      setDidLevelUp(false);
      setNewLevel(0);
      playerX.current = COURT_W / 2 - PADDLE_W / 2;
      aiX.current = COURT_W / 2 - PADDLE_W / 2;
      playerPaddleX.value = playerX.current;
      aiPaddleX.value = aiX.current;
      playerPaddleW.current = PADDLE_W;
      powerUp.current = null;
      resetBall();
      setGameState("playing");
      gameStartTime.current = Date.now();
      spectatorHost.startHosting();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [aiPaddleX, playerPaddleX, resetBall],
  );

  useEffect(() => {
    if (gameState === "playing") {
      frameId.current = requestAnimationFrame(update);
    }
    return () => {
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, [gameState, update]);

  const handlePaddleMove = useCallback(
    (moveX: number) => {
      const newX = Math.max(
        0,
        Math.min(
          COURT_W - playerPaddleW.current,
          moveX - 16 - playerPaddleW.current / 2,
        ),
      );
      playerX.current = newX;
      playerPaddleX.value = newX;
      // In multiplayer, send normalised position to server
      if (gameStateRef.current === "colyseus" || gameState === "colyseus") {
        mp.sendInput(newX / COURT_W);
      }
    },
    [gameState, mp, playerPaddleX],
  );

  // Pan gesture for player paddle
  const paddleGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(
          (gameState === "playing" ||
            (gameState === "colyseus" && mp.phase === "playing")) &&
            !isSpectatorMode,
        )
        .onBegin((event) => {
          handlePaddleMove(event.absoluteX);
        })
        .onUpdate((event) => {
          handlePaddleMove(event.absoluteX);
        }),
    [gameState, handlePaddleMove],
  );

  const playerWon = playerScore >= WIN_SCORE;

  // Back navigation with confirmation
  const { handleBack } = useGameBackHandler({
    gameType: "pong_game",
    isGameOver: gameState === "result" || gameState === "menu",
    isInLobby: gameState === "lobby",
    entryPoint: route?.params?.entryPoint,
  });

  // ── Lobby Screen ──────────────────────────────────────────────────────
  if (gameState === "lobby") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <MultiplayerLobbyOverlay
          controller={lobbyController}
          gameTitle="Pong"
          gameIcon="🏓"
          onInvitePress={() => setShowInvitePicker(true)}
          onLeave={() => {
            lobbyController.lobby.leaveLobby();
            setGameState("menu");
          }}
          showReadyButton={false}
        >
          <View style={{ flex: 1 }} />
        </MultiplayerLobbyOverlay>

        <InvitePickerModal
          visible={showInvitePicker}
          onDismiss={() => setShowInvitePicker(false)}
          onSelectFriend={handleSelectInviteFriend}
          onSelectGroup={handleSelectInviteGroup}
          currentUserId={currentFirebaseUser?.uid || ""}
          title="Challenge a Friend"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>🏓 Pong</Text>
        {spectatorHost.spectatorRoomId ? (
          <TouchableOpacity
            onPress={() => setShowSpectatorInvitePicker(true)}
            style={{ padding: 8 }}
          >
            <MaterialCommunityIcons name="eye" size={24} color="#9C27B0" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>Pong</Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            First to {WIN_SCORE} wins!
          </Text>
          {personalBest && (
            <Text style={[styles.bestText, { color: colors.primary }]}>
              Best: {personalBest.bestScore} wins
            </Text>
          )}

          {/* Invite Friend */}
          <Button
            mode="contained"
            onPress={handleInviteFriend}
            style={[styles.onlineBtn, { backgroundColor: "#9C27B0" }]}
            labelStyle={{ color: "#fff", fontWeight: "700", fontSize: 16 }}
            icon="account-plus"
            loading={inviteLoading}
          >
            Invite Friend
          </Button>

          <Text
            style={[
              styles.sectionLabel,
              { color: colors.textSecondary, marginTop: 24 },
            ]}
          >
            — or play vs AI —
          </Text>

          <View style={styles.diffButtons}>
            {(["easy", "medium", "hard"] as const).map((d) => (
              <Button
                key={d}
                mode="contained"
                onPress={() => startGame(d)}
                style={[styles.diffBtn, { backgroundColor: colors.primary }]}
                labelStyle={{ color: "#fff", textTransform: "capitalize" }}
              >
                {d}
              </Button>
            ))}
          </View>
        </View>
      )}

      {(gameState === "playing" || gameState === "paused") && (
        <View style={styles.courtContainer}>
          {/* Score */}
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreText, { color: colors.textSecondary }]}>
              AI: {aiScore}
            </Text>
            <Text style={[styles.scoreText, { color: colors.primary }]}>
              You: {playerScore}
            </Text>
          </View>

          {/* Court */}
          <GestureDetector gesture={paddleGesture}>
            <View
              style={[styles.court, { borderColor: "rgba(255,255,255,0.15)" }]}
            >
              {/* Skia court background + center line */}
              <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                {/* Court gradient */}
                <RoundedRect
                  x={0}
                  y={0}
                  width={COURT_W}
                  height={COURT_H}
                  r={10}
                >
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(0, COURT_H)}
                    colors={["#1A2332", "#0F1923", "#0A1118"]}
                  />
                  <Shadow
                    dx={0}
                    dy={2}
                    blur={8}
                    color="rgba(0,0,0,0.5)"
                    inner
                  />
                </RoundedRect>
                {/* Top/bottom goal zone highlights */}
                <RoundedRect x={4} y={4} width={COURT_W - 8} height={30} r={6}>
                  <LinearGradient
                    start={vec(0, 4)}
                    end={vec(0, 34)}
                    colors={["rgba(231,76,60,0.12)", "rgba(231,76,60,0)"]}
                  />
                </RoundedRect>
                <RoundedRect
                  x={4}
                  y={COURT_H - 34}
                  width={COURT_W - 8}
                  height={30}
                  r={6}
                >
                  <LinearGradient
                    start={vec(0, COURT_H - 4)}
                    end={vec(0, COURT_H - 34)}
                    colors={["rgba(52,152,219,0.12)", "rgba(52,152,219,0)"]}
                  />
                </RoundedRect>
                {/* Center dashed line */}
                <Path
                  path={centerLinePath}
                  color="rgba(255,255,255,0.15)"
                  strokeWidth={2}
                  style="stroke"
                >
                  <DashPathEffect intervals={[8, 8]} />
                </Path>
                {/* Center circle */}
                <Circle
                  cx={COURT_W / 2}
                  cy={COURT_H / 2}
                  r={30}
                  color="rgba(255,255,255,0.06)"
                  style="stroke"
                  strokeWidth={1.5}
                />
              </Canvas>

              {/* AI paddle — Skia metallic */}
              <Animated.View
                style={[
                  styles.paddle,
                  {
                    width: PADDLE_W,
                    top: 10,
                  },
                  aiPaddleStyle,
                ]}
              >
                <Canvas style={{ width: PADDLE_W, height: PADDLE_H }}>
                  <RoundedRect
                    x={0}
                    y={0}
                    width={PADDLE_W}
                    height={PADDLE_H}
                    r={7}
                  >
                    <LinearGradient
                      start={vec(0, 0)}
                      end={vec(0, PADDLE_H)}
                      colors={["#FF6B6B", "#E74C3C", "#C0392B"]}
                    />
                    <Shadow
                      dx={0}
                      dy={2}
                      blur={6}
                      color="rgba(231,76,60,0.5)"
                    />
                  </RoundedRect>
                  {/* Top highlight */}
                  <RoundedRect
                    x={2}
                    y={1}
                    width={PADDLE_W - 4}
                    height={3}
                    r={1.5}
                  >
                    <LinearGradient
                      start={vec(0, 1)}
                      end={vec(0, 4)}
                      colors={["rgba(255,255,255,0.4)", "rgba(255,255,255,0)"]}
                    />
                  </RoundedRect>
                </Canvas>
              </Animated.View>

              {/* Ball — Skia glowing sphere */}
              <Animated.View
                style={[
                  styles.ball,
                  {
                    width: ball.current.r * 2,
                    height: ball.current.r * 2,
                  },
                  ballStyle,
                ]}
              >
                <Canvas
                  style={{
                    width: ball.current.r * 2,
                    height: ball.current.r * 2,
                  }}
                >
                  {/* Glow halo */}
                  <Circle
                    cx={ball.current.r}
                    cy={ball.current.r}
                    r={ball.current.r}
                  >
                    <RadialGradient
                      c={vec(ball.current.r, ball.current.r)}
                      r={ball.current.r}
                      colors={[
                        colors.primary,
                        `${colors.primary}44`,
                        `${colors.primary}00`,
                      ]}
                    />
                  </Circle>
                  {/* Ball body */}
                  <Circle
                    cx={ball.current.r}
                    cy={ball.current.r}
                    r={ball.current.r * 0.75}
                  >
                    <RadialGradient
                      c={vec(ball.current.r * 0.7, ball.current.r * 0.6)}
                      r={ball.current.r * 0.75}
                      colors={[
                        "#FFFFFF",
                        colors.primary,
                        `${colors.primary}CC`,
                      ]}
                    />
                    <Shadow
                      dx={0}
                      dy={1}
                      blur={4}
                      color={`${colors.primary}88`}
                    />
                  </Circle>
                </Canvas>
              </Animated.View>

              {/* Power-up */}
              {powerUp.current?.active && (
                <View
                  style={[
                    styles.powerUp,
                    {
                      left: powerUp.current.x - 15,
                      top: powerUp.current.y - 15,
                    },
                  ]}
                >
                  <Canvas style={{ width: 30, height: 30 }}>
                    {/* Glow */}
                    <Circle cx={15} cy={15} r={15}>
                      <RadialGradient
                        c={vec(15, 15)}
                        r={15}
                        colors={[
                          powerUp.current.type === "speed"
                            ? "rgba(243,156,18,0.6)"
                            : powerUp.current.type === "big"
                              ? "rgba(46,204,113,0.6)"
                              : "rgba(231,76,60,0.6)",
                          "rgba(0,0,0,0)",
                        ]}
                      />
                    </Circle>
                    {/* Body */}
                    <Circle cx={15} cy={15} r={12}>
                      <RadialGradient
                        c={vec(12, 10)}
                        r={12}
                        colors={
                          powerUp.current.type === "speed"
                            ? ["#FFC048", "#F39C12", "#D68910"]
                            : powerUp.current.type === "big"
                              ? ["#5DFFBA", "#2ECC71", "#1E8449"]
                              : ["#FF7979", "#E74C3C", "#C0392B"]
                        }
                      />
                      <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.3)" />
                    </Circle>
                  </Canvas>
                  <Text style={styles.powerUpText}>
                    {powerUp.current.type === "speed"
                      ? "⚡"
                      : powerUp.current.type === "big"
                        ? "📏"
                        : "🔻"}
                  </Text>
                </View>
              )}

              {/* Player paddle — Skia metallic */}
              <Animated.View
                style={[
                  styles.paddle,
                  {
                    width: playerPaddleW.current,
                    bottom: 10,
                    position: "absolute",
                  },
                  playerPaddleStyle,
                ]}
              >
                <Canvas
                  style={{ width: playerPaddleW.current, height: PADDLE_H }}
                >
                  <RoundedRect
                    x={0}
                    y={0}
                    width={playerPaddleW.current}
                    height={PADDLE_H}
                    r={7}
                  >
                    <LinearGradient
                      start={vec(0, 0)}
                      end={vec(0, PADDLE_H)}
                      colors={["#5DADE2", colors.primary, "#2471A3"]}
                    />
                    <Shadow
                      dx={0}
                      dy={2}
                      blur={6}
                      color={`${colors.primary}88`}
                    />
                  </RoundedRect>
                  {/* Top highlight */}
                  <RoundedRect
                    x={2}
                    y={1}
                    width={playerPaddleW.current - 4}
                    height={3}
                    r={1.5}
                  >
                    <LinearGradient
                      start={vec(0, 1)}
                      end={vec(0, 4)}
                      colors={["rgba(255,255,255,0.4)", "rgba(255,255,255,0)"]}
                    />
                  </RoundedRect>
                </Canvas>
              </Animated.View>
            </View>
          </GestureDetector>
        </View>
      )}

      {/* Colyseus multiplayer court — renders for ALL multiplayer phases */}
      {gameState === "colyseus" && (
        <View style={styles.courtContainer}>
          {/* Score bar during playing phase */}
          {mp.phase === "playing" && (
            <ScoreRaceScoreBar
              opponentName={mp.opponentName}
              opponentScore={mp.opponentScore}
              myScore={mp.myScore}
              opponentDisconnected={mp.opponentDisconnected}
            />
          )}

          {/* Court — always visible so overlays have a background */}
          <GestureDetector gesture={paddleGesture}>
            <View
              style={[styles.court, { borderColor: "rgba(255,255,255,0.15)" }]}
            >
              {/* Court background */}
              <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                <RoundedRect
                  x={0}
                  y={0}
                  width={COURT_W}
                  height={COURT_H}
                  r={10}
                >
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(0, COURT_H)}
                    colors={["#1A2332", "#0F1923", "#0A1118"]}
                  />
                  <Shadow
                    dx={0}
                    dy={2}
                    blur={8}
                    color="rgba(0,0,0,0.5)"
                    inner
                  />
                </RoundedRect>
                <Path
                  path={centerLinePath}
                  color="rgba(255,255,255,0.15)"
                  strokeWidth={2}
                  style="stroke"
                >
                  <DashPathEffect intervals={[8, 8]} />
                </Path>
                <Circle
                  cx={COURT_W / 2}
                  cy={COURT_H / 2}
                  r={30}
                  color="rgba(255,255,255,0.06)"
                  style="stroke"
                  strokeWidth={1.5}
                />

                {/* Opponent paddle (top) — scale from server 400x600 → court */}
                <RoundedRect
                  x={(mp.opponentPaddle.x / mp.fieldWidth) * COURT_W}
                  y={10}
                  width={(mp.opponentPaddle.width / mp.fieldWidth) * COURT_W}
                  height={PADDLE_H}
                  r={7}
                >
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(0, PADDLE_H)}
                    colors={["#FF6B6B", "#E74C3C", "#C0392B"]}
                  />
                  <Shadow dx={0} dy={2} blur={6} color="rgba(231,76,60,0.5)" />
                </RoundedRect>

                {/* My paddle (bottom) — scale from server */}
                <RoundedRect
                  x={(mp.myPaddle.x / mp.fieldWidth) * COURT_W}
                  y={COURT_H - PADDLE_H - 10}
                  width={(mp.myPaddle.width / mp.fieldWidth) * COURT_W}
                  height={PADDLE_H}
                  r={7}
                >
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(0, PADDLE_H)}
                    colors={["#5DADE2", colors.primary, "#2471A3"]}
                  />
                  <Shadow
                    dx={0}
                    dy={2}
                    blur={6}
                    color={`${colors.primary}88`}
                  />
                </RoundedRect>

                {/* Ball — scale from server (only during active play) */}
                {(mp.phase === "playing" ||
                  mp.phase === "countdown" ||
                  mp.phase === "finished") && (
                  <Circle
                    cx={(mp.ball.x / mp.fieldWidth) * COURT_W}
                    cy={(mp.ball.y / mp.fieldHeight) * COURT_H}
                    r={(mp.ball.radius / mp.fieldWidth) * COURT_W}
                  >
                    <RadialGradient
                      c={vec(
                        (mp.ball.x / mp.fieldWidth) * COURT_W,
                        (mp.ball.y / mp.fieldHeight) * COURT_H,
                      )}
                      r={(mp.ball.radius / mp.fieldWidth) * COURT_W}
                      colors={[
                        "#FFFFFF",
                        colors.primary,
                        `${colors.primary}CC`,
                      ]}
                    />
                    <Shadow
                      dx={0}
                      dy={1}
                      blur={4}
                      color={`${colors.primary}88`}
                    />
                  </Circle>
                )}
              </Canvas>
            </View>
          </GestureDetector>
        </View>
      )}

      {/* Result dialog */}
      <Portal>
        <Dialog
          visible={gameState === "result"}
          onDismiss={() => {}}
          style={{ backgroundColor: colors.surface }}
        >
          <Dialog.Title style={{ color: colors.text, textAlign: "center" }}>
            {playerWon ? "🎉 You Win!" : "😢 AI Wins"}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
              {playerScore} — {aiScore}
            </Text>
            {xpEarned > 0 && (
              <Text
                style={{ color: "#fbbf24", textAlign: "center", marginTop: 8 }}
              >
                ⭐ +{xpEarned} XP
                {didLevelUp ? ` — Level Up! Level ${newLevel}!` : ""}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => startGame(difficulty)}>Play Again</Button>
            <Button
              onPress={() => {
                setShowFriendPicker(true);
              }}
            >
              Share
            </Button>
            <Button onPress={() => setGameState("menu")}>Menu</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Colyseus multiplayer overlays */}
      {gameState === "colyseus" && (
        <ScoreRaceOverlay
          phase={mp.phase as ScoreRaceOverlayPhase}
          countdown={mp.countdown}
          myScore={mp.myScore}
          opponentScore={mp.opponentScore}
          opponentName={mp.opponentName}
          isWinner={mp.isWinner}
          isTie={mp.isTie}
          winnerName={mp.isTie ? "" : mp.isWinner ? mp.myName : mp.opponentName}
          onReady={() => mp.sendReady()}
          onRematch={() => mp.sendRematch()}
          onAcceptRematch={() => mp.acceptRematch()}
          onLeave={async () => {
            await mp.leave();
            setGameState("menu");
          }}
          rematchRequested={mp.rematchRequested}
          reconnecting={mp.reconnecting}
          opponentDisconnected={mp.opponentDisconnected}
          isSpectator={isSpectatorMode}
          spectatorCount={mp.spectatorCount}
          myName={mp.myName}
        />
      )}

      {/* Spectator overlay — shows count (SP host or MP Colyseus) */}
      {(gameState === "colyseus"
        ? mp.spectatorCount > 0
        : spectatorHost.spectatorCount > 0) && (
        <SpectatorOverlay
          spectatorCount={
            gameState === "colyseus"
              ? mp.spectatorCount
              : spectatorHost.spectatorCount
          }
        />
      )}

      {/* Friend picker for sharing score */}
      <FriendPickerModal
        key="scorecard-picker"
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={async (friend) => {
          if (!currentFirebaseUser || isSending) return;
          setIsSending(true);
          try {
            await sendScorecard(currentFirebaseUser.uid, friend.friendUid, {
              gameId: GAME_TYPE,
              score: playerScore,
              playerName: profile?.displayName || "Player",
            });
            showSuccess("Score sent!");
          } catch {
            showError("Failed to send score");
          }
          setIsSending(false);
          setShowFriendPicker(false);
        }}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Send Score To"
      />

      {/* Spectator Invite Picker (Friends + Groups) */}
      <SpectatorInviteModal
        visible={showSpectatorInvitePicker}
        onDismiss={() => setShowSpectatorInvitePicker(false)}
        currentUserId={currentFirebaseUser?.uid || ""}
        inviteData={
          spectatorHost.spectatorRoomId
            ? {
                roomId: spectatorHost.spectatorRoomId,
                gameType: "pong_game",
                hostName: profile?.displayName || "Player",
              }
            : null
        }
        onInviteRef={(ref) => spectatorHost.registerInviteMessage(ref)}
        onSent={(name) => showSuccess(`Spectator invite sent to ${name}!`)}
        onError={showError}
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
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  menuContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuTitle: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  menuSub: { fontSize: 16, marginBottom: 16 },
  bestText: { fontSize: 14, fontWeight: "600", marginBottom: 24 },
  onlineBtn: { minWidth: 200, borderRadius: 24, paddingVertical: 4 },
  sectionLabel: { fontSize: 14, fontWeight: "500", marginBottom: 12 },
  diffButtons: { flexDirection: "row", gap: 12 },
  diffBtn: { minWidth: 90 },
  courtContainer: { flex: 1, alignItems: "center", paddingTop: 8 },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: COURT_W,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  scoreText: { fontSize: 18, fontWeight: "700" },
  court: {
    width: COURT_W,
    height: COURT_H,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    position: "relative",
  },
  centerLine: {
    position: "absolute",
    top: COURT_H / 2 - 1,
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 2,
    borderStyle: "dashed",
  },
  paddle: {
    height: PADDLE_H,
    borderRadius: 7,
    position: "absolute",
  },
  ball: {
    position: "absolute",
  },
  powerUp: {
    position: "absolute",
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  powerUpText: { fontSize: 14, position: "absolute" },
  dialogActions: { justifyContent: "center" },
});

export default withGameErrorBoundary(PongGameScreen, "pong");
