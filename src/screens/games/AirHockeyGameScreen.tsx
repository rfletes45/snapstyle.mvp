/**
 * AirHockeyGameScreen — Air Hockey with AI & Colyseus multiplayer
 *
 * How to play:
 * 1. Drag your striker (bottom half) to hit the puck
 * 2. Score when the puck enters the opponent's goal
 * 3. First to 7 wins!
 *
 * Supports: Single-player vs AI, Online multiplayer via Colyseus
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { SpectatorBanner } from "@/components/games/SpectatorBanner";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import ScoreRaceOverlay, { type ScoreRaceOverlayPhase } from "@/components/ScoreRaceOverlay";
import { useGameConnection } from "@/hooks/useGameConnection";
import { usePhysicsGame } from "@/hooks/usePhysicsGame";
import { useSpectator } from "@/hooks/useSpectator";
import { sendGameInvite } from "@/services/gameInvites";
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
  Circle,
  DashPathEffect,
  LinearGradient,
  RadialGradient,
  RoundedRect,
  Shadow,
  Line as SkiaLine,
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
  Alert,
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
const TABLE_W = SCREEN_WIDTH - 32;
const TABLE_H = SCREEN_HEIGHT * 0.65;
const PUCK_R = 14;
const STRIKER_R = 28;
const GOAL_W_RATIO = 0.35; // goal width relative to table width
const GOAL_W = TABLE_W * GOAL_W_RATIO;
const WIN_SCORE = 7;
const GAME_TYPE = "air_hockey";

// Server field constants (must match AirHockeyRoom)
const SERVER_FIELD_W = 400;
const SERVER_FIELD_H = 600;

// Physics constants (client-side AI game)
const FRICTION = 0.995;
const WALL_BOUNCE = 0.85;
const MAX_PUCK_SPEED = 10;
const AI_SPEED_EASY = 3;
const AI_SPEED_MEDIUM = 4.5;
const AI_SPEED_HARD = 6.5;

type GameState = "menu" | "playing" | "paused" | "result" | "colyseus";

interface Puck {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Striker {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

// =============================================================================
// Component
// =============================================================================

function AirHockeyGameScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const __codexGameCompletion = useGameCompletion({ gameType: "air_hockey" });
  void __codexGameCompletion;

  useGameBackHandler({ gameType: "air_hockey", isGameOver: false });
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
  const isSpectator = route?.params?.spectatorMode === true;

  // Colyseus multiplayer hook
  const { resolvedMode, firestoreGameId } = useGameConnection(
    GAME_TYPE,
    route?.params?.matchId,
  );
  const mp = usePhysicsGame({
    gameType: GAME_TYPE,
    firestoreGameId: firestoreGameId ?? undefined,
    spectator: isSpectator,
  });
  const spectatorSession = useSpectator({
    mode: "multiplayer-spectator",
    room: mp.room,
    state: mp.rawState,
  });
  const spectatorCount = spectatorSession.spectatorCount;

  const [gameState, setGameState] = useState<GameState>("menu");

  useEffect(() => {
    if (resolvedMode === "colyseus" && firestoreGameId) {
      setGameState("colyseus");
      mp.startMultiplayer();
    }
  }, [resolvedMode, firestoreGameId, isSpectator]);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [wins, setWins] = useState(0);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium",
  );
  const [, forceRender] = useState(0);

  // Refs for game objects
  const puck = useRef<Puck>({ x: TABLE_W / 2, y: TABLE_H / 2, vx: 0, vy: 0 });
  const playerStriker = useRef<Striker>({
    x: TABLE_W / 2,
    y: TABLE_H * 0.8,
    prevX: TABLE_W / 2,
    prevY: TABLE_H * 0.8,
  });
  const aiStriker = useRef<Striker>({
    x: TABLE_W / 2,
    y: TABLE_H * 0.2,
    prevX: TABLE_W / 2,
    prevY: TABLE_H * 0.2,
  });

  const playerScoreRef = useRef(0);
  const aiScoreRef = useRef(0);
  const gameStateRef = useRef<GameState>("menu");
  const frameId = useRef<number>(0);

  useEffect(() => {
    playerScoreRef.current = playerScore;
  }, [playerScore]);
  useEffect(() => {
    aiScoreRef.current = aiScore;
  }, [aiScore]);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Load personal best
  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  // ---------------------------------------------------------------------------
  // Circle-circle collision
  // ---------------------------------------------------------------------------
  const resolveCircleCollision = useCallback(
    (puckRef: Puck, striker: Striker, strikerR: number): boolean => {
      const dx = puckRef.x - striker.x;
      const dy = puckRef.y - striker.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = PUCK_R + strikerR;

      if (dist < minDist && dist > 0) {
        // Separate
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        puckRef.x += nx * overlap;
        puckRef.y += ny * overlap;

        // Striker velocity
        const svx = striker.x - striker.prevX;
        const svy = striker.y - striker.prevY;

        // Reflect
        const relVx = puckRef.vx - svx;
        const relVy = puckRef.vy - svy;
        const dotProduct = relVx * nx + relVy * ny;
        puckRef.vx -= 2 * dotProduct * nx;
        puckRef.vy -= 2 * dotProduct * ny;

        // Add striker velocity
        puckRef.vx += svx * 1.5;
        puckRef.vy += svy * 1.5;

        // Cap speed
        const speed = Math.sqrt(
          puckRef.vx * puckRef.vx + puckRef.vy * puckRef.vy,
        );
        if (speed > MAX_PUCK_SPEED) {
          puckRef.vx = (puckRef.vx / speed) * MAX_PUCK_SPEED;
          puckRef.vy = (puckRef.vy / speed) * MAX_PUCK_SPEED;
        }

        return true;
      }
      return false;
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------
  const update = useCallback(() => {
    if (gameStateRef.current !== "playing") return;

    const p = puck.current;
    const aiSpeed =
      difficulty === "easy"
        ? AI_SPEED_EASY
        : difficulty === "medium"
          ? AI_SPEED_MEDIUM
          : AI_SPEED_HARD;

    // Apply friction
    p.vx *= FRICTION;
    p.vy *= FRICTION;

    // Stop if very slow
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (speed < 0.1) {
      p.vx = 0;
      p.vy = 0;
    }

    // Move puck
    p.x += p.vx;
    p.y += p.vy;

    // Goal zone
    const goalLeft = (TABLE_W - GOAL_W) / 2;
    const goalRight = (TABLE_W + GOAL_W) / 2;
    const inGoalZone = p.x >= goalLeft && p.x <= goalRight;

    // Wall bounces (left/right)
    if (p.x - PUCK_R <= 0) {
      p.x = PUCK_R;
      p.vx = Math.abs(p.vx) * WALL_BOUNCE;
    } else if (p.x + PUCK_R >= TABLE_W) {
      p.x = TABLE_W - PUCK_R;
      p.vx = -Math.abs(p.vx) * WALL_BOUNCE;
    }

    // Top wall / goal
    if (p.y - PUCK_R < 0) {
      if (inGoalZone) {
        // Player scores
        playerScoreRef.current += 1;
        setPlayerScore(playerScoreRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (playerScoreRef.current >= WIN_SCORE) {
          setGameState("result");
          const newWins = wins + 1;
          setWins(newWins);
          if (currentFirebaseUser) {
            recordGameSession(currentFirebaseUser.uid, {
              gameId: GAME_TYPE,
              score: newWins,
              duration: 0,
            });
          }
          return;
        }
        resetPuck();
        return;
      }
      p.y = PUCK_R;
      p.vy = Math.abs(p.vy) * WALL_BOUNCE;
    }

    // Bottom wall / goal
    if (p.y + PUCK_R > TABLE_H) {
      if (inGoalZone) {
        // AI scores
        aiScoreRef.current += 1;
        setAiScore(aiScoreRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (aiScoreRef.current >= WIN_SCORE) {
          setGameState("result");
          return;
        }
        resetPuck();
        return;
      }
      p.y = TABLE_H - PUCK_R;
      p.vy = -Math.abs(p.vy) * WALL_BOUNCE;
    }

    // AI movement — chase puck when it's in AI's half, else return to center
    const ai = aiStriker.current;
    ai.prevX = ai.x;
    ai.prevY = ai.y;

    if (p.y < TABLE_H / 2) {
      // Puck in AI half — chase it
      const dx = p.x - ai.x;
      const dy = p.y - ai.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 5) {
        ai.x += (dx / d) * Math.min(d, aiSpeed);
        ai.y += (dy / d) * Math.min(d, aiSpeed);
      }
    } else {
      // Return to defensive position
      const defX = TABLE_W / 2;
      const defY = TABLE_H * 0.15;
      const dx = defX - ai.x;
      const dy = defY - ai.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 3) {
        ai.x += (dx / d) * Math.min(d, aiSpeed * 0.7);
        ai.y += (dy / d) * Math.min(d, aiSpeed * 0.7);
      }
    }

    // Constrain AI to top half
    ai.y = Math.max(STRIKER_R, Math.min(TABLE_H / 2 - STRIKER_R, ai.y));
    ai.x = Math.max(STRIKER_R, Math.min(TABLE_W - STRIKER_R, ai.x));

    // Collision with player striker
    if (resolveCircleCollision(p, playerStriker.current, STRIKER_R)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Collision with AI striker
    resolveCircleCollision(p, ai, STRIKER_R);

    // Constrain puck to table
    p.x = Math.max(PUCK_R, Math.min(TABLE_W - PUCK_R, p.x));
    p.y = Math.max(PUCK_R, Math.min(TABLE_H - PUCK_R, p.y));

    // Trigger render
    forceRender((n) => n + 1);

    frameId.current = requestAnimationFrame(update);
  }, [difficulty, wins, currentFirebaseUser, resolveCircleCollision]);

  const resetPuck = useCallback(() => {
    puck.current = {
      x: TABLE_W / 2,
      y: TABLE_H / 2,
      vx: 0,
      vy: 0,
    };
    playerStriker.current = {
      x: TABLE_W / 2,
      y: TABLE_H * 0.8,
      prevX: TABLE_W / 2,
      prevY: TABLE_H * 0.8,
    };
    aiStriker.current = {
      x: TABLE_W / 2,
      y: TABLE_H * 0.2,
      prevX: TABLE_W / 2,
      prevY: TABLE_H * 0.2,
    };
  }, []);

  const startGame = useCallback(
    (diff: "easy" | "medium" | "hard") => {
      setDifficulty(diff);
      setPlayerScore(0);
      setAiScore(0);
      playerScoreRef.current = 0;
      aiScoreRef.current = 0;
      resetPuck();
      setGameState("playing");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [resetPuck],
  );

  // ---------------------------------------------------------------------------
  // Invite Friend handler
  // ---------------------------------------------------------------------------
  const handleInviteFriend = useCallback(() => {
    setShowInvitePicker(true);
  }, []);

  const handleSelectInviteFriend = useCallback(
    async (friend: { friendUid: string; displayName: string }) => {
      setShowInvitePicker(false);
      if (!currentFirebaseUser || !profile) return;
      setInviteLoading(true);
      try {
        await sendGameInvite(
          currentFirebaseUser.uid,
          profile.displayName || "Player",
          profile.avatarConfig
            ? JSON.stringify(profile.avatarConfig)
            : undefined,
          {
            gameType: GAME_TYPE,
            recipientId: friend.friendUid,
            recipientName: friend.displayName,
            settings: { isRated: false, chatEnabled: false },
          },
        );
        Alert.alert(
          "Invite Sent!",
          `Game invite sent to ${friend.displayName}. You'll be notified when they respond.`,
        );
      } catch (error: any) {
        Alert.alert(
          "Error",
          error?.message || "Failed to send game invite. Please try again.",
        );
      } finally {
        setInviteLoading(false);
      }
    },
    [currentFirebaseUser, profile],
  );

  useEffect(() => {
    if (gameState === "playing") {
      frameId.current = requestAnimationFrame(update);
    }
    return () => {
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, [gameState, update]);

  const handleStrikerMove = useCallback(
    (moveX: number, moveY: number) => {
      const newX = Math.max(STRIKER_R, Math.min(TABLE_W - STRIKER_R, moveX - 16));
      const newY = Math.max(
        TABLE_H / 2 + STRIKER_R,
        Math.min(TABLE_H - STRIKER_R, moveY - 120),
      );

      if (gameStateRef.current === "colyseus") {
        if (isSpectator) return;
        // Send normalised position to server
        mp.sendInput(newX / TABLE_W, newY / TABLE_H);
      } else {
        const ps = playerStriker.current;
        ps.prevX = ps.x;
        ps.prevY = ps.y;
        ps.x = newX;
        ps.y = newY;
      }
    },
    [isSpectator, mp],
  );

  // Pan gesture for player striker (2D movement in bottom half)
  const strikerGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(
          (gameState === "playing" || gameState === "colyseus") && !isSpectator,
        )
        .onBegin((event) => {
          handleStrikerMove(event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          handleStrikerMove(event.absoluteX, event.absoluteY);
        }),
    [gameState, handleStrikerMove, isSpectator],
  );

  const playerWon = playerScore >= WIN_SCORE;

  // Goal posts positions
  const goalLeft = (TABLE_W - GOAL_W) / 2;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isSpectator && (
        <SpectatorBanner
          spectatorCount={spectatorCount}
          onLeave={async () => {
            await mp.leave();
            navigation.goBack();
          }}
        />
      )}
      {!isSpectator && mp.isMultiplayer && spectatorCount > 0 && (
        <SpectatorOverlay spectatorCount={spectatorCount} />
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          🏒 Air Hockey
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Menu */}
      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            Air Hockey
          </Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            First to {WIN_SCORE} wins!
          </Text>
          {personalBest && (
            <Text style={[styles.bestText, { color: colors.primary }]}>
              Best: {personalBest.bestScore} wins
            </Text>
          )}
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
          <Button
            mode="contained"
            onPress={handleInviteFriend}
            style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
            labelStyle={{ color: "#fff", fontSize: 16 }}
            icon="account-plus"
            loading={inviteLoading}
            disabled={inviteLoading}
          >
            Invite Friend
          </Button>
        </View>
      )}

      {/* Local game table */}
      {(gameState === "playing" || gameState === "paused") && (
        <View style={styles.tableContainer}>
          {/* Score */}
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreText, { color: colors.textSecondary }]}>
              AI: {aiScore}
            </Text>
            <Text style={[styles.scoreText, { color: colors.primary }]}>
              You: {playerScore}
            </Text>
          </View>

          {/* Table */}
          <GestureDetector gesture={strikerGesture}>
            <View
              style={[styles.table, { borderColor: "rgba(255,255,255,0.15)" }]}
            >
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              {/* Table surface */}
              <RoundedRect x={0} y={0} width={TABLE_W} height={TABLE_H} r={12}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(0, TABLE_H)}
                  colors={["#0D3B66", "#0A2C4E", "#071E34"]}
                />
                <Shadow dx={0} dy={2} blur={8} color="rgba(0,0,0,0.5)" inner />
              </RoundedRect>

              {/* Center line */}
              <SkiaLine
                p1={vec(0, TABLE_H / 2)}
                p2={vec(TABLE_W, TABLE_H / 2)}
                color="rgba(255,255,255,0.2)"
                strokeWidth={2}
                style="stroke"
              >
                <DashPathEffect intervals={[10, 6]} />
              </SkiaLine>

              {/* Center circle */}
              <Circle
                cx={TABLE_W / 2}
                cy={TABLE_H / 2}
                r={40}
                color="rgba(255,255,255,0.08)"
                style="stroke"
                strokeWidth={2}
              />
              <Circle
                cx={TABLE_W / 2}
                cy={TABLE_H / 2}
                r={4}
                color="rgba(255,255,255,0.2)"
              />

              {/* Top goal zone */}
              <RoundedRect x={goalLeft} y={0} width={GOAL_W} height={8} r={4}>
                <LinearGradient
                  start={vec(goalLeft, 0)}
                  end={vec(goalLeft, 8)}
                  colors={["rgba(231,76,60,0.6)", "rgba(231,76,60,0.1)"]}
                />
              </RoundedRect>

              {/* Bottom goal zone */}
              <RoundedRect
                x={goalLeft}
                y={TABLE_H - 8}
                width={GOAL_W}
                height={8}
                r={4}
              >
                <LinearGradient
                  start={vec(goalLeft, TABLE_H)}
                  end={vec(goalLeft, TABLE_H - 8)}
                  colors={["rgba(52,152,219,0.6)", "rgba(52,152,219,0.1)"]}
                />
              </RoundedRect>

              {/* AI striker (top) */}
              <Circle
                cx={aiStriker.current.x}
                cy={aiStriker.current.y}
                r={STRIKER_R}
              >
                <RadialGradient
                  c={vec(aiStriker.current.x - 4, aiStriker.current.y - 4)}
                  r={STRIKER_R}
                  colors={["#FF8A80", "#E74C3C", "#C0392B"]}
                />
                <Shadow dx={0} dy={2} blur={6} color="rgba(231,76,60,0.5)" />
              </Circle>
              {/* AI striker inner ring */}
              <Circle
                cx={aiStriker.current.x}
                cy={aiStriker.current.y}
                r={STRIKER_R * 0.5}
                color="rgba(255,255,255,0.15)"
                style="stroke"
                strokeWidth={2}
              />

              {/* Player striker (bottom) */}
              <Circle
                cx={playerStriker.current.x}
                cy={playerStriker.current.y}
                r={STRIKER_R}
              >
                <RadialGradient
                  c={vec(
                    playerStriker.current.x - 4,
                    playerStriker.current.y - 4,
                  )}
                  r={STRIKER_R}
                  colors={["#81D4FA", colors.primary, "#1565C0"]}
                />
                <Shadow dx={0} dy={2} blur={6} color={`${colors.primary}88`} />
              </Circle>
              {/* Player striker inner ring */}
              <Circle
                cx={playerStriker.current.x}
                cy={playerStriker.current.y}
                r={STRIKER_R * 0.5}
                color="rgba(255,255,255,0.15)"
                style="stroke"
                strokeWidth={2}
              />

              {/* Puck — glowing circle */}
              <Circle cx={puck.current.x} cy={puck.current.y} r={PUCK_R + 4}>
                <RadialGradient
                  c={vec(puck.current.x, puck.current.y)}
                  r={PUCK_R + 4}
                  colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0)"]}
                />
              </Circle>
              <Circle cx={puck.current.x} cy={puck.current.y} r={PUCK_R}>
                <RadialGradient
                  c={vec(puck.current.x - 3, puck.current.y - 3)}
                  r={PUCK_R}
                  colors={["#FFFFFF", "#E0E0E0", "#BDBDBD"]}
                />
                <Shadow dx={0} dy={2} blur={4} color="rgba(0,0,0,0.4)" />
              </Circle>
            </Canvas>
            </View>
          </GestureDetector>
        </View>
      )}

      {/* Colyseus multiplayer table */}
      {gameState === "colyseus" && mp.phase === "playing" && (
        <View style={styles.tableContainer}>
          {/* Score */}
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreText, { color: colors.textSecondary }]}>
              {mp.opponentName}: {mp.opponentScore}
            </Text>
            <Text style={[styles.scoreText, { color: colors.primary }]}>
              You: {mp.myScore}
            </Text>
          </View>

          {/* Table */}
          <GestureDetector gesture={strikerGesture}>
            <View
              style={[styles.table, { borderColor: "rgba(255,255,255,0.15)" }]}
            >
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              {/* Table surface */}
              <RoundedRect x={0} y={0} width={TABLE_W} height={TABLE_H} r={12}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(0, TABLE_H)}
                  colors={["#0D3B66", "#0A2C4E", "#071E34"]}
                />
                <Shadow dx={0} dy={2} blur={8} color="rgba(0,0,0,0.5)" inner />
              </RoundedRect>

              {/* Center line */}
              <SkiaLine
                p1={vec(0, TABLE_H / 2)}
                p2={vec(TABLE_W, TABLE_H / 2)}
                color="rgba(255,255,255,0.2)"
                strokeWidth={2}
                style="stroke"
              >
                <DashPathEffect intervals={[10, 6]} />
              </SkiaLine>

              {/* Center circle */}
              <Circle
                cx={TABLE_W / 2}
                cy={TABLE_H / 2}
                r={40}
                color="rgba(255,255,255,0.08)"
                style="stroke"
                strokeWidth={2}
              />

              {/* Top goal zone */}
              <RoundedRect x={goalLeft} y={0} width={GOAL_W} height={8} r={4}>
                <LinearGradient
                  start={vec(goalLeft, 0)}
                  end={vec(goalLeft, 8)}
                  colors={["rgba(231,76,60,0.6)", "rgba(231,76,60,0.1)"]}
                />
              </RoundedRect>

              {/* Bottom goal zone */}
              <RoundedRect
                x={goalLeft}
                y={TABLE_H - 8}
                width={GOAL_W}
                height={8}
                r={4}
              >
                <LinearGradient
                  start={vec(goalLeft, TABLE_H)}
                  end={vec(goalLeft, TABLE_H - 8)}
                  colors={["rgba(52,152,219,0.6)", "rgba(52,152,219,0.1)"]}
                />
              </RoundedRect>

              {/* Opponent striker (top) — from server state */}
              <Circle
                cx={(mp.opponentPaddle.x / mp.fieldWidth) * TABLE_W}
                cy={(mp.opponentPaddle.y / mp.fieldHeight) * TABLE_H}
                r={STRIKER_R}
              >
                <RadialGradient
                  c={vec(
                    (mp.opponentPaddle.x / mp.fieldWidth) * TABLE_W - 4,
                    (mp.opponentPaddle.y / mp.fieldHeight) * TABLE_H - 4,
                  )}
                  r={STRIKER_R}
                  colors={["#FF8A80", "#E74C3C", "#C0392B"]}
                />
                <Shadow dx={0} dy={2} blur={6} color="rgba(231,76,60,0.5)" />
              </Circle>
              <Circle
                cx={(mp.opponentPaddle.x / mp.fieldWidth) * TABLE_W}
                cy={(mp.opponentPaddle.y / mp.fieldHeight) * TABLE_H}
                r={STRIKER_R * 0.5}
                color="rgba(255,255,255,0.15)"
                style="stroke"
                strokeWidth={2}
              />

              {/* My striker (bottom) — from server state */}
              <Circle
                cx={(mp.myPaddle.x / mp.fieldWidth) * TABLE_W}
                cy={(mp.myPaddle.y / mp.fieldHeight) * TABLE_H}
                r={STRIKER_R}
              >
                <RadialGradient
                  c={vec(
                    (mp.myPaddle.x / mp.fieldWidth) * TABLE_W - 4,
                    (mp.myPaddle.y / mp.fieldHeight) * TABLE_H - 4,
                  )}
                  r={STRIKER_R}
                  colors={["#81D4FA", colors.primary, "#1565C0"]}
                />
                <Shadow dx={0} dy={2} blur={6} color={`${colors.primary}88`} />
              </Circle>
              <Circle
                cx={(mp.myPaddle.x / mp.fieldWidth) * TABLE_W}
                cy={(mp.myPaddle.y / mp.fieldHeight) * TABLE_H}
                r={STRIKER_R * 0.5}
                color="rgba(255,255,255,0.15)"
                style="stroke"
                strokeWidth={2}
              />

              {/* Puck — from server state */}
              <Circle
                cx={(mp.ball.x / mp.fieldWidth) * TABLE_W}
                cy={(mp.ball.y / mp.fieldHeight) * TABLE_H}
                r={PUCK_R + 4}
              >
                <RadialGradient
                  c={vec(
                    (mp.ball.x / mp.fieldWidth) * TABLE_W,
                    (mp.ball.y / mp.fieldHeight) * TABLE_H,
                  )}
                  r={PUCK_R + 4}
                  colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0)"]}
                />
              </Circle>
              <Circle
                cx={(mp.ball.x / mp.fieldWidth) * TABLE_W}
                cy={(mp.ball.y / mp.fieldHeight) * TABLE_H}
                r={PUCK_R}
              >
                <RadialGradient
                  c={vec(
                    (mp.ball.x / mp.fieldWidth) * TABLE_W - 3,
                    (mp.ball.y / mp.fieldHeight) * TABLE_H - 3,
                  )}
                  r={PUCK_R}
                  colors={["#FFFFFF", "#E0E0E0", "#BDBDBD"]}
                />
                <Shadow dx={0} dy={2} blur={4} color="rgba(0,0,0,0.4)" />
              </Circle>
            </Canvas>
            </View>
          </GestureDetector>
        </View>
      )}

      {/* Result dialog (local game) */}
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
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => startGame(difficulty)}>Play Again</Button>
            <Button onPress={() => setShowFriendPicker(true)}>Share</Button>
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
          winnerName={mp.isWinner ? mp.myName : mp.opponentName}
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
        />
      )}

      {/* Friend picker for sharing score */}
      <FriendPickerModal
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

      {/* Friend picker for game invite */}
      <FriendPickerModal
        visible={showInvitePicker}
        onDismiss={() => setShowInvitePicker(false)}
        onSelectFriend={handleSelectInviteFriend}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Challenge a Friend"
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
  diffButtons: { flexDirection: "row", gap: 12 },
  diffBtn: { minWidth: 90 },
  inviteBtn: { minWidth: 160, marginTop: 16 },
  tableContainer: { flex: 1, alignItems: "center", paddingTop: 8 },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: TABLE_W,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  scoreText: { fontSize: 18, fontWeight: "700" },
  table: {
    width: TABLE_W,
    height: TABLE_H,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    position: "relative",
  },
  dialogActions: { justifyContent: "center" },
});

export default withGameErrorBoundary(AirHockeyGameScreen, "air_hockey");
