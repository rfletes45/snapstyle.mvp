/**
 * 8-Ball Pool remake (Skia renderer).
 *
 * Rendering decision:
 * - Chosen: Skia.
 * - Reason: aligns with existing game renderer stack and keeps touch/animation
 *   integration simpler and more stable than introducing Three.js for gameplay.
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import { GameOverModal, GameResult } from "@/components/games/GameOverModal";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { SpectatorBanner } from "@/components/games/SpectatorBanner";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import { useColyseus } from "@/hooks/useColyseus";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { useSpectator } from "@/hooks/useSpectator";
import { sendGameInvite } from "@/services/gameInvites";
import {
  getPersonalBest,
  recordGameSession,
  sendScorecard,
} from "@/services/games";
import {
  PoolBall,
  PoolMatchState,
  ShotParams,
  canPlaceCueBall,
  createInitialBalls,
  createInitialMatchState,
  createTable,
  evaluateShot,
  getLegalTargetIds,
  placeCueBall,
  simulateShot,
} from "@/services/games/poolEngine";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useColors } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { getBallColor, getBallType } from "@/types/pool";
import { createLogger } from "@/utils/log";
import {
  Canvas,
  Circle,
  Line,
  LinearGradient,
  RadialGradient,
  RoundedRect,
  vec,
} from "@shopify/react-native-skia";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Button, Chip, Text } from "react-native-paper";

const log = createLogger("PoolGameScreen");
const GAME_TYPE = "8ball_pool";
const TABLE = createTable();
const { width } = Dimensions.get("window");
const CANVAS_W = Math.min(width - 20, 390);
const CANVAS_H = CANVAS_W * (TABLE.height / TABLE.width);
const SX = CANVAS_W / TABLE.width;
const SY = CANVAS_H / TABLE.height;
const BR = TABLE.ballRadius * SX;
const MAX_DRAG = 120;

type ScreenMode = "menu" | "local" | "multiplayer";
type Difficulty = "easy" | "medium" | "hard";

function dx(x: number) {
  return x * SX;
}
function dy(y: number) {
  return y * SY;
}
function lx(x: number) {
  return x / SX;
}
function ly(y: number) {
  return y / SY;
}

function parseBalls(raw: unknown): PoolBall[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.values(raw as Record<string, any>)
    .map((ball) => ({
      id: Number(ball.id ?? 0),
      x: Number(ball.x ?? 0),
      y: Number(ball.y ?? 0),
      vx: Number(ball.vx ?? 0),
      vy: Number(ball.vy ?? 0),
      spin: { x: Number(ball.spin?.x ?? 0), y: Number(ball.spin?.y ?? 0) },
      pocketed: !!ball.pocketed,
    }))
    .sort((a, b) => a.id - b.id);
}

function parseTurnIndex(state: any, mySessionId: string | null): 0 | 1 {
  const players = Object.entries(state?.players ?? {}) as Array<[string, any]>;
  const me = players.find(([sid]) => sid === mySessionId);
  if (!me) return 0;
  return Number(me[1]?.playerIndex ?? 0) === 0 ? 0 : 1;
}

function aiNoise(difficulty: Difficulty) {
  if (difficulty === "easy") return { angle: 15, power: 0.3 };
  if (difficulty === "medium") return { angle: 7, power: 0.15 };
  return { angle: 3, power: 0.08 };
}

function PoolGameScreen({ navigation, route }: { navigation: any; route: any }) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showError, showInfo, showSuccess } = useSnackbar();
  const haptics = useGameHaptics();
  const gameCompletion = useGameCompletion({ gameType: GAME_TYPE });
  void gameCompletion;

  const isSpectatorMode = route?.params?.spectatorMode === true;
  const { resolvedMode, firestoreGameId } = useGameConnection(
    GAME_TYPE,
    route?.params?.matchId,
  );

  const {
    room,
    state: roomState,
    connected,
    error: roomError,
    sendMessage,
    joinRoom,
    leaveRoom,
  } = useColyseus({
    gameType: GAME_TYPE,
    firestoreGameId:
      resolvedMode === "colyseus" ? firestoreGameId ?? undefined : undefined,
    autoJoin: false,
    options: isSpectatorMode ? { spectator: true } : undefined,
  });

  const mpSpectator = useSpectator({
    mode: "multiplayer-spectator",
    room,
    state: roomState,
  });
  const spHost = useSpectator({ mode: "sp-host", gameType: GAME_TYPE });

  const [mode, setMode] = useState<ScreenMode>("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [balls, setBalls] = useState<PoolBall[]>(() => createInitialBalls(TABLE));
  const [renderBalls, setRenderBalls] = useState<PoolBall[]>(() =>
    createInitialBalls(TABLE),
  );
  const [state, setState] = useState<PoolMatchState>(() =>
    createInitialMatchState(),
  );
  const [pb, setPb] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(0);
  const [fouls, setFouls] = useState(0);
  const [startMs, setStartMs] = useState(Date.now());
  const [resultVisible, setResultVisible] = useState(false);
  const [resultType, setResultType] = useState<GameResult>("loss");
  const [resultText, setResultText] = useState("Game over");
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friendPickerMode, setFriendPickerMode] = useState<"challenge" | "share">(
    "challenge",
  );
  const [showSpectatorInvite, setShowSpectatorInvite] = useState(false);
  const [foulBanner, setFoulBanner] = useState<string | null>(null);
  const [aimAngle, setAimAngle] = useState(-Math.PI / 2);
  const [aimPower, setAimPower] = useState(0.45);
  const [english, setEnglish] = useState({ x: 0, y: 0 });
  const [aiming, setAiming] = useState(false);
  const [placingCue, setPlacingCue] = useState(false);
  const [cuePreview, setCuePreview] = useState<{ x: number; y: number; valid: boolean } | null>(null);
  const [mySessionId, setMySessionId] = useState<string | null>(null);

  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foulRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cueBall = useMemo(
    () => renderBalls.find((ball) => ball.id === 0 && !ball.pocketed) ?? null,
    [renderBalls],
  );

  useGameBackHandler({
    gameType: GAME_TYPE,
    isGameOver: resultVisible || state.phase === "game-over",
    onBeforeLeave: async () => {
      if (mode === "multiplayer") await leaveRoom();
      if (mode === "local") await spHost.endHosting(score);
    },
  });

  useEffect(() => {
    if (!currentFirebaseUser) return;
    getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then((best) => {
      setPb(best?.bestScore ?? null);
    });
  }, [currentFirebaseUser]);

  useEffect(() => {
    if (resolvedMode !== "colyseus" || !firestoreGameId) return;
    setMode("multiplayer");
    joinRoom().catch((error) => {
      log.error("Failed to join pool room", error);
      showError("Failed to join pool match");
    });
  }, [resolvedMode, firestoreGameId, joinRoom, showError]);

  useEffect(() => {
    if (!connected || !room) return;
    setMySessionId(room.sessionId);
  }, [connected, room]);

  useEffect(() => {
    if (roomError) showError(String(roomError));
  }, [roomError, showError]);

  useEffect(() => {
    if (mode !== "multiplayer" || !roomState) return;
    const next = parseBalls((roomState as any).balls);
    if (next.length) {
      setBalls(next);
      setRenderBalls(next);
    }
    setState((prev) => ({
      ...prev,
      phase: ((roomState as any).phase as any) ?? prev.phase,
      ballInHand: !!(roomState as any).ballInHand,
      breakShot: !!(roomState as any).breakShot,
      openTable: !!(roomState as any).openTable,
      turnNumber:
        typeof (roomState as any).turnNumber === "number"
          ? Number((roomState as any).turnNumber)
          : prev.turnNumber,
      currentPlayer: parseTurnIndex(roomState, mySessionId),
    }));
  }, [mode, roomState, mySessionId]);

  const stopAnim = useCallback(() => {
    if (animRef.current) clearInterval(animRef.current);
    animRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopAnim();
      if (aiRef.current) clearTimeout(aiRef.current);
      if (foulRef.current) clearTimeout(foulRef.current);
      if (mode === "multiplayer") leaveRoom().catch(() => {});
      if (mode === "local") spHost.endHosting(score).catch(() => {});
    };
  }, [mode, leaveRoom, score, spHost, stopAnim]);

  const isMyTurn =
    mode === "multiplayer"
      ? roomState?.currentTurnPlayerId === mySessionId
      : state.currentPlayer === 0;
  const canShoot =
    !!cueBall &&
    !isSpectatorMode &&
    isMyTurn &&
    !resultVisible &&
    state.phase !== "animating" &&
    state.phase !== "ball-in-hand";
  const canPlace =
    !!cueBall &&
    !isSpectatorMode &&
    isMyTurn &&
    !resultVisible &&
    state.phase === "ball-in-hand";

  const showFoul = useCallback((type: string) => {
    setFoulBanner(type.replace(/_/g, " ").toUpperCase());
    if (foulRef.current) clearTimeout(foulRef.current);
    foulRef.current = setTimeout(() => setFoulBanner(null), 2000);
  }, []);

  const playFrames = useCallback(
    (frames: PoolBall[][], done?: () => void) => {
      stopAnim();
      if (!frames.length) {
        done?.();
        return;
      }
      let idx = 0;
      setState((prev) => ({ ...prev, phase: "animating" }));
      setRenderBalls(frames[0]);
      animRef.current = setInterval(() => {
        idx += 1;
        if (idx >= frames.length) {
          stopAnim();
          setRenderBalls(frames[frames.length - 1]);
          done?.();
          return;
        }
        setRenderBalls(frames[idx]);
      }, 1000 / 60);
    },
    [stopAnim],
  );

  const finishLocal = useCallback(
    async (winner: 0 | 1, message: string, nextState: PoolMatchState) => {
      const win = winner === 0;
      setResultVisible(true);
      setResultType(win ? "win" : "loss");
      setResultText(message);
      setState(nextState);
      haptics.trigger(win ? "win" : "lose");
      AccessibilityInfo.announceForAccessibility(
        win ? "Game over. You won." : "Game over. You lost.",
      );
      if (currentFirebaseUser) {
        const final = win ? 100 + score * 10 : score * 10;
        await recordGameSession(currentFirebaseUser.uid, {
          gameId: GAME_TYPE,
          score: final,
          duration: Math.max(1, Math.round((Date.now() - startMs) / 1000)),
        });
        const best = await getPersonalBest(currentFirebaseUser.uid, GAME_TYPE);
        setPb(best?.bestScore ?? null);
      }
      await spHost.endHosting(score);
    },
    [currentFirebaseUser, haptics, score, startMs, spHost],
  );

  const applyLocalEvaluation = useCallback(
    async (result: ReturnType<typeof simulateShot>) => {
      const evalResult = evaluateShot(state, result);
      setState(evalResult.nextState);
      setBalls(result.finalBalls);
      setRenderBalls(result.finalBalls);
      setShots((v) => v + 1);
      setFouls((v) => v + (evalResult.foulType ? 1 : 0));
      setScore(Math.max(0, 7 - evalResult.nextState.players[0].remaining));
      if (evalResult.foulType) {
        showFoul(evalResult.foulType);
        haptics.trigger("error");
      } else if (result.pocketed.length) {
        haptics.trigger("impact_medium");
      } else {
        haptics.trigger("impact_light");
      }
      if (evalResult.winner !== null) {
        await finishLocal(evalResult.winner, evalResult.message, evalResult.nextState);
      }
    },
    [state, showFoul, haptics, finishLocal],
  );

  const shootLocal = useCallback(
    (shot: ShotParams, sourceBalls?: PoolBall[]) => {
      const base = sourceBalls ?? balls;
      const result = simulateShot(base, shot, TABLE);
      playFrames(result.frames, () => {
        void applyLocalEvaluation(result);
      });
    },
    [balls, playFrames, applyLocalEvaluation],
  );

  useEffect(() => {
    if (mode !== "local") return;
    if (resultVisible || state.currentPlayer !== 1 || state.phase === "animating") return;

    if (aiRef.current) clearTimeout(aiRef.current);
    aiRef.current = setTimeout(() => {
      let base = balls;
      if (state.phase === "ball-in-hand") {
        const px = TABLE.width / 2;
        const py = state.breakShot ? TABLE.height * 0.82 : TABLE.height * 0.55;
        if (canPlaceCueBall(base, px, py, TABLE, state.breakShot)) {
          base = placeCueBall(base, px, py);
          setBalls(base);
          setRenderBalls(base);
          setState((prev) => ({ ...prev, ballInHand: false, phase: "playing" }));
        }
      }
      const cue = base.find((ball) => ball.id === 0 && !ball.pocketed);
      if (!cue) return;
      const legal = getLegalTargetIds(state, base, 1);
      const target =
        base
          .filter((ball) => !ball.pocketed && legal.includes(ball.id))
          .sort(
            (a, b) =>
              Math.hypot(a.x - cue.x, a.y - cue.y) -
              Math.hypot(b.x - cue.x, b.y - cue.y),
          )[0] ??
        base.find((ball) => !ball.pocketed && ball.id !== 0);
      if (!target) return;
      const noise = aiNoise(difficulty);
      const shot: ShotParams = {
        angle:
          Math.atan2(target.y - cue.y, target.x - cue.x) +
          ((Math.random() * noise.angle * 2 - noise.angle) * Math.PI) / 180,
        power: Math.max(0.2, Math.min(0.95, 0.58 + (Math.random() * noise.power * 2 - noise.power))),
        english:
          difficulty === "hard"
            ? { x: Math.random() * 0.4 - 0.2, y: Math.random() * 0.3 - 0.15 }
            : difficulty === "medium"
              ? { x: Math.random() * 0.2 - 0.1, y: Math.random() * 0.16 - 0.08 }
              : { x: 0, y: 0 },
      };
      shootLocal(shot, base);
    }, 900);

    return () => {
      if (aiRef.current) clearTimeout(aiRef.current);
      aiRef.current = null;
    };
  }, [mode, resultVisible, state, balls, difficulty, shootLocal]);

  useEffect(() => {
    if (mode !== "local") return;
    const payload = JSON.stringify({
      balls: renderBalls,
      phase: state.phase,
      currentPlayer: state.currentPlayer,
      players: state.players,
      turnNumber: state.turnNumber,
    });
    spHost.updateGameState(payload, score, 1, 1);
  }, [mode, renderBalls, state, score, spHost]);

  useEffect(() => {
    if (mode !== "multiplayer" || !room) return;
    room.onMessage("shot_result", (payload: any) => {
      const frames = Array.isArray(payload?.frames) ? (payload.frames as PoolBall[][]) : [];
      if (frames.length) playFrames(frames);
      if (payload?.foulType) showFoul(String(payload.foulType));
    });
    room.onMessage("game_over", (payload: any) => {
      const winnerSessionId = String(payload?.winnerSessionId ?? "");
      const win = !!mySessionId && winnerSessionId === mySessionId;
      setResultVisible(true);
      setResultType(win ? "win" : "loss");
      setResultText(String(payload?.reason ?? "Match complete"));
    });
  }, [mode, room, playFrames, showFoul, mySessionId]);

  const submitShot = useCallback(
    (shot: ShotParams) => {
      if (mode === "local") {
        shootLocal(shot);
        return;
      }
      if (!connected) {
        showError("Not connected");
        return;
      }
      sendMessage("shoot", shot);
      haptics.trigger("impact_medium");
    },
    [mode, shootLocal, connected, sendMessage, showError, haptics],
  );

  const startLocal = useCallback(async () => {
    const initialBalls = createInitialBalls(TABLE);
    const initial = createInitialMatchState();
    setMode("local");
    setBalls(initialBalls);
    setRenderBalls(initialBalls);
    setState(initial);
    setScore(0);
    setShots(0);
    setFouls(0);
    setResultVisible(false);
    setResultText("Game over");
    setStartMs(Date.now());
    setAimAngle(-Math.PI / 2);
    setAimPower(0.45);
    setEnglish({ x: 0, y: 0 });
    setFoulBanner(null);
    await spHost.startHosting();
    showInfo("Pool match started");
  }, [spHost, showInfo]);

  const goMenu = useCallback(async () => {
    setMode("menu");
    stopAnim();
    if (mode === "multiplayer") await leaveRoom();
    if (mode === "local") await spHost.endHosting(score);
  }, [mode, leaveRoom, spHost, score, stopAnim]);

  const onBegin = useCallback(
    (x: number, y: number) => {
      if (!cueBall || isSpectatorMode || resultVisible) return;
      const qx = lx(x);
      const qy = ly(y);
      const d = Math.hypot(qx - cueBall.x, qy - cueBall.y);
      if (canPlace && d <= TABLE.ballRadius * 3) {
        setPlacingCue(true);
        setCuePreview({ x: cueBall.x, y: cueBall.y, valid: true });
      } else if (canShoot && d <= TABLE.ballRadius * 4.5) {
        setAiming(true);
      }
    },
    [cueBall, isSpectatorMode, resultVisible, canPlace, canShoot],
  );

  const onUpdate = useCallback(
    (x: number, y: number) => {
      if (!cueBall || isSpectatorMode || resultVisible) return;
      const qx = lx(x);
      const qy = ly(y);
      if (placingCue && canPlace) {
        setCuePreview({
          x: qx,
          y: qy,
          valid: canPlaceCueBall(balls, qx, qy, TABLE, state.breakShot),
        });
        return;
      }
      if (!aiming || !canShoot) return;
      const vx = cueBall.x - qx;
      const vy = cueBall.y - qy;
      setAimAngle(Math.atan2(vy, vx));
      setAimPower(Math.min(1, Math.hypot(vx, vy) / MAX_DRAG));
    },
    [cueBall, isSpectatorMode, resultVisible, placingCue, canPlace, balls, state.breakShot, aiming, canShoot],
  );

  const onEnd = useCallback(() => {
    if (placingCue && canPlace) {
      if (cuePreview?.valid) {
        if (mode === "local") {
          const placed = placeCueBall(balls, cuePreview.x, cuePreview.y);
          setBalls(placed);
          setRenderBalls(placed);
          setState((prev) => ({ ...prev, ballInHand: false, phase: "playing" }));
        } else {
          sendMessage("place_cue", { x: cuePreview?.x, y: cuePreview?.y });
        }
      } else {
        showError("Invalid cue-ball placement");
      }
      setCuePreview(null);
      setPlacingCue(false);
      return;
    }
    if (aiming && canShoot && aimPower > 0.03) {
      submitShot({ angle: aimAngle, power: aimPower, english });
    }
    setAiming(false);
  }, [placingCue, canPlace, cuePreview, mode, balls, sendMessage, showError, aiming, canShoot, aimPower, submitShot, aimAngle, english]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin((e) => onBegin(e.x, e.y))
        .onUpdate((e) => onUpdate(e.x, e.y))
        .onEnd(() => onEnd()),
    [onBegin, onUpdate, onEnd],
  );

  const cue = cuePreview
    ? { ...cueBall, x: cuePreview.x, y: cuePreview.y }
    : cueBall;
  const line = cue && aiming
    ? {
        x1: cue.x,
        y1: cue.y,
        x2: cue.x + Math.cos(aimAngle) * (70 + aimPower * 80),
        y2: cue.y + Math.sin(aimAngle) * (70 + aimPower * 80),
        bx: cue.x - Math.cos(aimAngle) * (22 + aimPower * 38),
        by: cue.y - Math.sin(aimAngle) * (22 + aimPower * 38),
      }
    : null;

  const watcherCount = mode === "local" ? spHost.spectatorCount : mpSpectator.spectatorCount;
  const inviteData =
    spHost.spectatorRoomId && profile
      ? {
          roomId: spHost.spectatorRoomId,
          gameType: GAME_TYPE,
          hostName: profile.displayName || profile.username || "Player",
          currentScore: score,
        }
      : null;

  const onPickFriend = async (friend: any) => {
    if (!currentFirebaseUser) return;
    const uid = String(friend?.friendUid ?? "");
    const name = String(friend?.displayName ?? "Friend");
    if (!uid) return;
    if (friendPickerMode === "challenge") {
      try {
        await sendGameInvite(
          currentFirebaseUser.uid,
          profile?.displayName || profile?.username || "Player",
          undefined,
          { gameType: GAME_TYPE as any, recipientId: uid, recipientName: name },
        );
        showSuccess(`Challenge sent to ${name}`);
      } catch (error) {
        log.error("sendGameInvite failed", error);
        showError("Could not send challenge");
      } finally {
        setShowFriendPicker(false);
      }
      return;
    }
    const ok = await sendScorecard(currentFirebaseUser.uid, uid, {
      gameId: GAME_TYPE,
      score: score * 10,
      playerName: profile?.displayName || profile?.username || "Player",
    });
    if (ok) showSuccess("Score shared");
    else showError("Failed to share score");
    setShowFriendPicker(false);
  };

  if (mode === "menu") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
          <Text variant="headlineMedium" style={{ color: colors.text, fontWeight: "800" }}>
            8-Ball Pool
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            Local AI + online invite matches with spin and foul rules.
          </Text>
          <View style={styles.row}>
            <Chip selected={difficulty === "easy"} onPress={() => setDifficulty("easy")}>Easy</Chip>
            <Chip selected={difficulty === "medium"} onPress={() => setDifficulty("medium")}>Medium</Chip>
            <Chip selected={difficulty === "hard"} onPress={() => setDifficulty("hard")}>Hard</Chip>
          </View>
          <Button mode="contained" onPress={() => void startLocal()}>
            Play vs AI
          </Button>
          <Button
            mode="outlined"
            onPress={() => {
              setFriendPickerMode("challenge");
              setShowFriendPicker(true);
            }}
          >
            Challenge Friend
          </Button>
          <Text style={{ color: colors.textSecondary }}>
            Personal best: {pb ?? "No record"}
          </Text>
        </View>
        <FriendPickerModal
          visible={showFriendPicker}
          onDismiss={() => setShowFriendPicker(false)}
          onSelectFriend={onPickFriend}
          currentUserId={currentFirebaseUser?.uid ?? ""}
          title={friendPickerMode === "challenge" ? "Challenge Friend" : "Share Score"}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {mode === "multiplayer" && isSpectatorMode ? (
        <SpectatorBanner spectatorCount={watcherCount} onLeave={() => void goMenu()} />
      ) : null}

      <View style={styles.topRow}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          {isMyTurn ? "Your shot" : mode === "local" ? "AI shot" : "Opponent shot"}
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          Score {score} | Shots {shots} | Fouls {fouls}
        </Text>
      </View>

      {foulBanner ? (
        <View style={[styles.foul, { backgroundColor: colors.errorContainer }]}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            FOUL: {foulBanner}
          </Text>
        </View>
      ) : null}

      <GestureDetector gesture={gesture}>
        <View style={styles.board}>
          <Canvas style={{ width: CANVAS_W, height: CANVAS_H }}>
            <RoundedRect x={0} y={0} width={CANVAS_W} height={CANVAS_H} r={20}>
              <LinearGradient start={vec(0, 0)} end={vec(CANVAS_W, CANVAS_H)} colors={["#6D4221", "#4A2B13"]} />
            </RoundedRect>
            <RoundedRect x={16} y={16} width={CANVAS_W - 32} height={CANVAS_H - 32} r={14}>
              <LinearGradient start={vec(16, 16)} end={vec(CANVAS_W - 16, CANVAS_H - 16)} colors={["#1E7A46", "#155934"]} />
            </RoundedRect>
            {TABLE.pockets.map((p, i) => (
              <Circle key={`p-${i}`} cx={dx(p.x)} cy={dy(p.y)} r={p.radius * SX} color="#101010" />
            ))}
            <Line p1={vec(16, dy(TABLE.headStringY))} p2={vec(CANVAS_W - 16, dy(TABLE.headStringY))} color="rgba(255,255,255,0.28)" strokeWidth={1.5} />
            {line ? (
              <>
                <Line p1={vec(dx(line.x1), dy(line.y1))} p2={vec(dx(line.x2), dy(line.y2))} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
                <Line p1={vec(dx(line.bx), dy(line.by))} p2={vec(dx(line.x1), dy(line.y1))} color="#D6B079" strokeWidth={6} />
              </>
            ) : null}
            {renderBalls.filter((b) => !b.pocketed).map((b) => {
              const x = dx(b.x);
              const y = dy(b.y);
              const color = getBallColor(b.id);
              const stripe = getBallType(b.id) === "stripe";
              return (
                <React.Fragment key={`b-${b.id}`}>
                  <Circle cx={x + 1.1} cy={y + 1.3} r={BR} color="rgba(0,0,0,0.28)" />
                  <Circle cx={x} cy={y} r={BR}>
                    <RadialGradient c={vec(x - BR * 0.35, y - BR * 0.35)} r={BR * 1.2} colors={["#FFFFFF", stripe ? "#FFFFFF" : color, color]} />
                  </Circle>
                  {stripe ? (
                    <RoundedRect x={x - BR} y={y - BR * 0.38} width={BR * 2} height={BR * 0.76} r={BR * 0.3} color={color} />
                  ) : null}
                  <Circle cx={x} cy={y} r={BR * 0.34} color="#FFFFFF" />
                </React.Fragment>
              );
            })}
          </Canvas>
          {renderBalls.filter((b) => !b.pocketed).map((b) => (
            <View
              key={`n-${b.id}`}
              pointerEvents="none"
              style={[styles.numWrap, { left: dx(b.x) - 7, top: dy(b.y) - 7 }]}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${b.id === 0 ? "Cue ball" : `Ball ${b.id}`}`}
            >
              <Text style={styles.numText}>{b.id === 0 ? "" : b.id}</Text>
            </View>
          ))}
        </View>
      </GestureDetector>

      <View style={styles.bottom}>
        <View style={[styles.powerTrack, { borderColor: colors.outline }]}>
          <View
            style={[
              styles.powerFill,
              {
                width: `${Math.round(aimPower * 100)}%`,
                backgroundColor:
                  aimPower < 0.35 ? "#3CB371" : aimPower < 0.7 ? "#F5C542" : "#E53935",
              },
            ]}
          />
          <Text style={[styles.powerText, { color: colors.text }]}>
            Power {Math.round(aimPower * 100)}%
          </Text>
        </View>
        <View style={styles.row}>
          <Button mode="outlined" onPress={() => setEnglish({ x: 0, y: 0 })}>
            Reset Spin
          </Button>
          <Button mode="contained-tonal" onPress={() => { setFriendPickerMode("challenge"); setShowFriendPicker(true); }}>
            Challenge
          </Button>
          <Button mode="text" onPress={() => void goMenu()}>
            Menu
          </Button>
        </View>
        {mode === "local" ? (
          <Button mode="text" onPress={() => setShowSpectatorInvite(true)} disabled={!spHost.spectatorRoomId}>
            Invite to Watch
          </Button>
        ) : null}
      </View>

      <SpectatorOverlay spectatorCount={watcherCount} />

      <GameOverModal
        visible={resultVisible}
        result={resultType}
        stats={{
          score: score * 10,
          personalBest: pb ?? undefined,
          moves: shots,
          timeSeconds: Math.max(1, Math.round((Date.now() - startMs) / 1000)),
          winMethod: resultText,
        }}
        title={resultText}
        onExit={() => {
          setResultVisible(false);
          void goMenu();
        }}
        onRematch={() => {
          if (mode === "local") void startLocal();
          else sendMessage("rematch");
        }}
        onShare={() => {
          setFriendPickerMode("share");
          setShowFriendPicker(true);
        }}
        showRematch
        showShare
      />

      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={onPickFriend}
        currentUserId={currentFirebaseUser?.uid ?? ""}
        title={friendPickerMode === "challenge" ? "Challenge Friend" : "Share Score"}
      />

      <SpectatorInviteModal
        visible={showSpectatorInvite}
        onDismiss={() => setShowSpectatorInvite(false)}
        currentUserId={currentFirebaseUser?.uid ?? ""}
        inviteData={inviteData}
        onSent={(name) => showSuccess(`Invite sent to ${name}`)}
        onError={showError}
        onInviteRef={(ref) => spHost.registerInviteMessage(ref)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 8 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12, marginTop: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  foul: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  board: { width: CANVAS_W, height: CANVAS_H, alignSelf: "center", position: "relative", borderRadius: 20, overflow: "hidden" },
  numWrap: { position: "absolute", width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  numText: { fontSize: 8, fontWeight: "700", color: "#1A1A1A" },
  bottom: { marginTop: 10, gap: 8 },
  powerTrack: { height: 24, borderRadius: 12, borderWidth: 1, overflow: "hidden", justifyContent: "center" },
  powerFill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  powerText: { fontSize: 12, textAlign: "center", fontWeight: "700" },
});

export default withGameErrorBoundary(PoolGameScreen, "8ball_pool");
