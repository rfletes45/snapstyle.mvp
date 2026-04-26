/**
 * Games V4 — Pong Game Screen (Polished)
 *
 * Real-time 1v1 Pong. Connects to Colyseus for authoritative state;
 * renders a premium arena with score-first HUD, animated phase
 * transitions, client-side paddle prediction for instant input feel,
 * and satisfying microinteractions.
 *
 * @module gamesV4/screens/PongScreenV4
 */

import type { GameShellProps } from "@/gamesV4/components/GameScreenShell";
import { withGameV4Shell } from "@/gamesV4/components/GameScreenShell";
import type { PongRealtimeState } from "@/gamesV4/realtime/games/pongDef";
import { PONG_CLIENT_DEF } from "@/gamesV4/realtime/games/pongDef";
import {
    createFrameLoop,
    InterpolationBuffer,
    ScalarInterpolator,
} from "@/gamesV4/realtime/interpolation";
import { useRealtimeRoom } from "@/gamesV4/realtime/useRealtimeRoom";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import * as haptics from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Animated,
    Easing,
    type GestureResponderEvent,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ═══════════════════════════════════════════════════════════════════════════════
// Theme Palettes
// ═══════════════════════════════════════════════════════════════════════════════

interface ArenaTheme {
  bg: string;
  arena: string;
  border: string;
  line: string;
  ball: string;
  ballGlow: string;
  paddleL: string;
  paddleLGlow: string;
  paddleR: string;
  paddleRGlow: string;
  text: string;
  textDim: string;
  card: string;
  accent: string;
  accentDim: string;
  overlay: string;
}

const THEMES: Record<string, ArenaTheme> = {
  classic: {
    bg: "#0B0B0F",
    arena: "#0F0F14",
    border: "rgba(255,255,255,0.10)",
    line: "rgba(255,255,255,0.07)",
    ball: "#FFFFFF",
    ballGlow: "rgba(255,255,255,0.28)",
    paddleL: "#4FC3F7",
    paddleLGlow: "rgba(79,195,247,0.22)",
    paddleR: "#FF7043",
    paddleRGlow: "rgba(255,112,67,0.22)",
    text: "#EEEEF2",
    textDim: "rgba(238,238,242,0.38)",
    card: "rgba(255,255,255,0.035)",
    accent: "#FFD54F",
    accentDim: "rgba(255,213,79,0.18)",
    overlay: "rgba(0,0,0,0.58)",
  },
  neon: {
    bg: "#050510",
    arena: "#08081A",
    border: "rgba(0,255,136,0.12)",
    line: "rgba(0,255,136,0.05)",
    ball: "#00FF88",
    ballGlow: "rgba(0,255,136,0.32)",
    paddleL: "#FF00FF",
    paddleLGlow: "rgba(255,0,255,0.28)",
    paddleR: "#00FFFF",
    paddleRGlow: "rgba(0,255,255,0.28)",
    text: "#EEEEF2",
    textDim: "rgba(238,238,242,0.38)",
    card: "rgba(0,255,136,0.03)",
    accent: "#FF00FF",
    accentDim: "rgba(255,0,255,0.18)",
    overlay: "rgba(0,0,0,0.62)",
  },
  catppuccin: {
    bg: "#11111B",
    arena: "#181825",
    border: "rgba(203,166,247,0.10)",
    line: "rgba(205,214,244,0.05)",
    ball: "#F5E0DC",
    ballGlow: "rgba(245,224,220,0.24)",
    paddleL: "#CBA6F7",
    paddleLGlow: "rgba(203,166,247,0.22)",
    paddleR: "#FAB387",
    paddleRGlow: "rgba(250,179,135,0.22)",
    text: "#CDD6F4",
    textDim: "rgba(205,214,244,0.38)",
    card: "rgba(203,166,247,0.03)",
    accent: "#F38BA8",
    accentDim: "rgba(243,139,168,0.18)",
    overlay: "rgba(0,0,0,0.58)",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Layout Constants — Vertical Orientation
// Config-only values live at module level; dimension-dependent values are
// computed inside the component via useWindowDimensions().
// ═══════════════════════════════════════════════════════════════════════════════

const ARENA_PAD = 16;
const HUD_RESERVE = 160;
const ARENA_ASPECT = 1.4; // height / width
const MAX_ARENA_W = 460;

// Server paddle face positions (where ball bounces):
// Left (bottom) paddle face: PADDLE_X_OFFSET + PADDLE_WIDTH = 0.042
// Right (top) paddle face: 1 - PADDLE_X_OFFSET - PADDLE_WIDTH = 0.958
// These define where the paddle visual inner edges should be.
const PADDLE_Y_BOTTOM_CENTER = 0.97; // server x=0.03 for left paddle
const PADDLE_Y_TOP_CENTER = 0.03; // server x=0.97 for right paddle

const DASH_W = 14;
const DASH_GAP = 10;
const SEND_HZ = 60;
const SEND_INTERVAL = 1000 / SEND_HZ;

/** Derive all dimension-dependent layout values from the window size. */
function useArenaLayout() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  return useMemo(() => {
    const arenaW = Math.min(screenW - ARENA_PAD * 2, MAX_ARENA_W);
    const arenaH = Math.min(
      Math.round(arenaW * ARENA_ASPECT),
      Math.round(screenH - HUD_RESERVE),
    );
    const ballR = Math.max(7, Math.round(0.012 * arenaH));
    const paddleThick = Math.max(12, Math.round(0.024 * arenaH));
    const centerY = Math.round(arenaH / 2);
    return { arenaW, arenaH, ballR, paddleThick, centerY };
  }, [screenW, screenH]);
}

/** Paddle horizontal width in pixels (server paddleHalf * 2 mapped to arena width) */
function paddleWidthPx(preset: string | undefined, arenaW: number): number {
  return Math.round((preset === "large" ? 0.22 : 0.16) * arenaW);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════════════

// ── Pulsing Dots (loading indicator) ────────────────────────────────────────

const PulsingDots = memo(function PulsingDots({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [anim]);
  return (
    <View style={st.dotsRow}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            st.dot,
            {
              backgroundColor: color,
              opacity: anim.interpolate({
                inputRange: [0, 0.33, 0.66, 1],
                outputRange:
                  i === 0
                    ? [1, 0.2, 0.2, 1]
                    : i === 1
                      ? [0.2, 1, 0.2, 0.2]
                      : [0.2, 0.2, 1, 0.2],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
});

// ── Center Dashes (memoised arena decoration) ───────────────────────────────

const CenterDashes = memo(function CenterDashes({
  color,
  arenaW,
  centerY,
}: {
  color: string;
  arenaW: number;
  centerY: number;
}) {
  const els: React.ReactElement[] = [];
  for (let x = DASH_GAP; x < arenaW - DASH_GAP; x += DASH_W + DASH_GAP) {
    els.push(
      <View
        key={x}
        style={{
          position: "absolute",
          left: x,
          top: centerY - 1,
          width: DASH_W,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
        }}
      />,
    );
  }
  return <>{els}</>;
});

// ── Score HUD ───────────────────────────────────────────────────────────────

interface ScoreHUDProps {
  leftScore: number;
  rightScore: number;
  leftName: string;
  rightName: string;
  leftConnected: boolean;
  rightConnected: boolean;
  mySide: "left" | "right" | null;
  scoreToWin: number;
  colors: ArenaTheme;
}

const ScoreHUD = memo(function ScoreHUD(p: ScoreHUDProps) {
  const {
    leftScore,
    rightScore,
    leftName,
    rightName,
    leftConnected,
    rightConnected,
    mySide,
    scoreToWin,
    colors,
  } = p;

  // Pulse animations on score change
  const pulseL = useRef(new Animated.Value(1)).current;
  const pulseR = useRef(new Animated.Value(1)).current;
  const prevL = useRef(leftScore);
  const prevR = useRef(rightScore);

  useEffect(() => {
    if (leftScore !== prevL.current) {
      prevL.current = leftScore;
      pulseL.setValue(1.35);
      Animated.spring(pulseL, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 160,
      }).start();
    }
  }, [leftScore, pulseL]);

  useEffect(() => {
    if (rightScore !== prevR.current) {
      prevR.current = rightScore;
      pulseR.setValue(1.35);
      Animated.spring(pulseR, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 160,
      }).start();
    }
  }, [rightScore, pulseR]);

  return (
    <View style={[st.hudCard, { backgroundColor: colors.card }]}>
      {/* Left player */}
      <View style={[st.hudCol, { alignItems: "flex-start" }]}>
        <View style={st.hudNameRow}>
          <View style={[st.hudColorDot, { backgroundColor: colors.paddleL }]} />
          <Text
            style={[
              st.hudName,
              { color: colors.paddleL },
              !leftConnected && st.hudNameDim,
            ]}
            numberOfLines={1}
          >
            {leftName}
          </Text>
          {mySide === "left" && (
            <View
              style={[st.youChip, { backgroundColor: colors.paddleL + "22" }]}
            >
              <Text style={[st.youChipText, { color: colors.paddleL }]}>
                YOU
              </Text>
            </View>
          )}
        </View>
        <Animated.Text
          style={[
            st.hudScore,
            { color: colors.text, transform: [{ scale: pulseL }] },
          ]}
        >
          {leftScore}
        </Animated.Text>
      </View>

      {/* Divider */}
      <View style={st.hudDivider}>
        <Text style={[st.hudDash, { color: colors.textDim }]}>—</Text>
        <Text style={[st.hudTarget, { color: colors.textDim }]}>
          to {scoreToWin}
        </Text>
      </View>

      {/* Right player */}
      <View style={[st.hudCol, { alignItems: "flex-end" }]}>
        <View style={[st.hudNameRow, { flexDirection: "row-reverse" }]}>
          <View style={[st.hudColorDot, { backgroundColor: colors.paddleR }]} />
          <Text
            style={[
              st.hudName,
              { color: colors.paddleR },
              !rightConnected && st.hudNameDim,
            ]}
            numberOfLines={1}
          >
            {rightName}
          </Text>
          {mySide === "right" && (
            <View
              style={[st.youChip, { backgroundColor: colors.paddleR + "22" }]}
            >
              <Text style={[st.youChipText, { color: colors.paddleR }]}>
                YOU
              </Text>
            </View>
          )}
        </View>
        <Animated.Text
          style={[
            st.hudScore,
            { color: colors.text, transform: [{ scale: pulseR }] },
          ]}
        >
          {rightScore}
        </Animated.Text>
      </View>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

function PongUI({ myUid, sessionId, players: shellPlayers }: GameShellProps) {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { arenaW, arenaH, ballR, paddleThick, centerY } = useArenaLayout();

  // ── Auth token ──────────────────────────────────────────────────────────
  const [authToken, setAuthToken] = useState("");
  useEffect(() => {
    let cancelled = false;
    currentFirebaseUser?.getIdToken().then((t) => {
      if (!cancelled) setAuthToken(t ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [currentFirebaseUser]);

  // ── Realtime room ───────────────────────────────────────────────────────
  const {
    room,
    connectionStatus,
    gameState,
    send,
    leave,
    error: connectionError,
  } = useRealtimeRoom<PongRealtimeState>(PONG_CLIENT_DEF, {
    sessionId,
    uid: myUid,
    displayName: currentFirebaseUser?.displayName ?? "Player",
    token: authToken,
    autoConnect: !!authToken,
  });

  // ── Derived state ───────────────────────────────────────────────────────
  const state = gameState;
  const pongPhase = state?.pongPhase ?? "waiting";
  const leftUid = state?.leftPlayerId ?? "";
  const rightUid = state?.rightPlayerId ?? "";
  const scores = state?.scores ?? {};
  const ball = state?.ball ?? { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  const paddles = state?.paddles ?? {
    left: { y: 0.5, vy: 0, connected: false },
    right: { y: 0.5, vy: 0, connected: false },
  };
  const serveOwner = state?.serveOwner ?? "left";
  const effectiveSettings = state?.effectiveSettings;
  const rallyHits = state?.rallyHits ?? 0;
  const roomPlayers = state?.players ?? [];

  const arenaThemeName = effectiveSettings?.arenaTheme ?? "classic";
  const colors = THEMES[arenaThemeName] ?? THEMES.classic;

  const mySide: "left" | "right" | null = useMemo(() => {
    if (myUid === leftUid) return "left";
    if (myUid === rightUid) return "right";
    return null;
  }, [myUid, leftUid, rightUid]);

  // ── Per-player perspective ──────────────────────────────────────────────
  // flipView: right player sees the board flipped so their paddle is at bottom.
  const flipView = mySide === "right";

  // Map server X (scoring axis, 0=left goal, 1=right goal) → screen Y
  const mapSX = useCallback(
    (sx: number) => (flipView ? sx * arenaH : (1 - sx) * arenaH),
    [flipView, arenaH],
  );
  // Map server Y (paddle-movement axis) → screen X
  const mapSY = useCallback(
    (sy: number) => (flipView ? (1 - sy) * arenaW : sy * arenaW),
    [flipView, arenaW],
  );
  // Inverse: screen X touch → server Y
  const touchXToServerY = useCallback(
    (screenX: number) => {
      const n = Math.max(0, Math.min(1, screenX / arenaW));
      return flipView ? 1 - n : n;
    },
    [flipView, arenaW],
  );

  const leftName = useMemo(() => {
    const p = roomPlayers.find((pl) => pl.uid === leftUid);
    return (
      p?.displayName ??
      shellPlayers.find((sp) => sp.uid === leftUid)?.displayName ??
      "Left"
    );
  }, [roomPlayers, shellPlayers, leftUid]);

  const rightName = useMemo(() => {
    const p = roomPlayers.find((pl) => pl.uid === rightUid);
    return (
      p?.displayName ??
      shellPlayers.find((sp) => sp.uid === rightUid)?.displayName ??
      "Right"
    );
  }, [roomPlayers, shellPlayers, rightUid]);

  const opponentDisconnected = useMemo(() => {
    if (!mySide) return false;
    const opp = mySide === "left" ? "right" : "left";
    return !paddles[opp].connected;
  }, [mySide, paddles]);

  const winningSide = useMemo(() => {
    const l = scores[leftUid] ?? 0;
    const r = scores[rightUid] ?? 0;
    if (l > r) return "left" as const;
    if (r > l) return "right" as const;
    return null;
  }, [scores, leftUid, rightUid]);

  const iWon = mySide && winningSide ? mySide === winningSide : null;

  // ── Client-side paddle prediction ───────────────────────────────────────
  // localPaddleY stores the server-Y coordinate from the player's touch.
  const localPaddleYRef = useRef<number | null>(null);

  // ── Interpolation buffers (shared infrastructure) ───────────────────────
  // Ball uses full 2D interpolation buffer for smooth 60fps from 20Hz server.
  const ballInterpRef = useRef(
    new InterpolationBuffer({
      renderDelayMs: 55, // ~1 server tick behind for smooth lerp window
      maxExtrapolateMs: 120,
      correctionAlpha: 0.45, // slightly snappy to keep ball feeling responsive
    }),
  );
  // Opponent paddle uses scalar interpolator (1D Y axis).
  const oppPaddleInterpRef = useRef(new ScalarInterpolator(0.4));

  // Animated values for ball and paddles (driven by RAF, not React state)
  const ballAnimX = useRef(new Animated.Value(arenaW / 2)).current;
  const ballAnimY = useRef(new Animated.Value(arenaH / 2)).current;
  const oppPaddleAnimX = useRef(new Animated.Value(arenaW / 2)).current;
  const myPaddleAnimX = useRef(new Animated.Value(arenaW / 2)).current;

  // Cache layout values for RAF (avoid stale closures)
  const flipRef = useRef(flipView);
  flipRef.current = flipView;
  const arenaWRef = useRef(arenaW);
  arenaWRef.current = arenaW;
  const arenaHRef = useRef(arenaH);
  arenaHRef.current = arenaH;
  const mySideRef = useRef(mySide);
  mySideRef.current = mySide;
  const pongPhaseRef = useRef(pongPhase);
  pongPhaseRef.current = pongPhase;

  // Push server state into interpolation buffers
  useEffect(() => {
    const bi = ballInterpRef.current;
    if (pongPhase !== "live") {
      // During non-live phases, snap ball to server pos (no extrapolation)
      bi.reset(ball.x, ball.y);
      const fv = flipRef.current;
      const aW = arenaWRef.current;
      const aH = arenaHRef.current;
      ballAnimX.setValue(fv ? (1 - ball.y) * aW : ball.y * aW);
      ballAnimY.setValue(fv ? ball.x * aH : (1 - ball.x) * aH);
    } else {
      bi.push({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy });
    }
  }, [ball.x, ball.y, ball.vx, ball.vy, pongPhase, ballAnimX, ballAnimY]);

  // Push opponent paddle into interpolator
  useEffect(() => {
    const oppSide = mySide === "left" ? "right" : "left";
    const oppY = paddles[oppSide]?.y ?? 0.5;
    const oppVy = paddles[oppSide]?.vy ?? 0;
    oppPaddleInterpRef.current.push(oppY, oppVy);
  }, [paddles, mySide]);

  // Master RAF loop — drives ball, opponent paddle, and local paddle at 60fps
  useEffect(() => {
    const loop = createFrameLoop(() => {
      const fv = flipRef.current;
      const aW = arenaWRef.current;
      const aH = arenaHRef.current;

      // Ball interpolation
      if (pongPhaseRef.current === "live") {
        const b = ballInterpRef.current.sample();
        ballAnimX.setValue(fv ? (1 - b.y) * aW : b.y * aW);
        ballAnimY.setValue(fv ? b.x * aH : (1 - b.x) * aH);
      }

      // Opponent paddle interpolation
      const oppY = oppPaddleInterpRef.current.sample();
      const oppScreenX = fv ? (1 - oppY) * aW : oppY * aW;
      oppPaddleAnimX.setValue(oppScreenX);

      // Local paddle — immediate from touch (no interpolation needed)
      const localY = localPaddleYRef.current;
      if (localY !== null) {
        const myScreenX = fv ? (1 - localY) * aW : localY * aW;
        myPaddleAnimX.setValue(myScreenX);
      }
    });

    loop.start();
    return () => loop.stop();
  }, [ballAnimX, ballAnimY, oppPaddleAnimX, myPaddleAnimX]);

  // ── Animation refs ──────────────────────────────────────────────────────
  const overlayAnim = useRef(new Animated.Value(1)).current;
  const goalFlashBottom = useRef(new Animated.Value(0)).current;
  const goalFlashTop = useRef(new Animated.Value(0)).current;
  const cdScale = useRef(new Animated.Value(1)).current;

  // ── Countdown local timer ───────────────────────────────────────────────
  const [countdown, setCountdown] = useState<number | null>(null);
  const cdTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    cdTimers.current.forEach(clearTimeout);
    cdTimers.current = [];
    if (pongPhase === "countdown") {
      const show = (n: number) => {
        setCountdown(n);
        haptics.medium();
        cdScale.setValue(2.2);
        Animated.spring(cdScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 10,
          stiffness: 200,
        }).start();
      };
      show(3);
      cdTimers.current.push(
        setTimeout(() => show(2), 1000),
        setTimeout(() => show(1), 2000),
      );
    } else {
      setCountdown(null);
    }
    return () => cdTimers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pongPhase]);

  // ── Phase overlay fade ──────────────────────────────────────────────────
  useEffect(() => {
    const shouldShow = pongPhase !== "live" && pongPhase !== "serve";
    Animated.timing(overlayAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: shouldShow ? 200 : 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [pongPhase, overlayAnim]);

  // ── Last scorer & goal flash ────────────────────────────────────────────
  const [lastScorerName, setLastScorerName] = useState("");
  const [lastScorerIsMe, setLastScorerIsMe] = useState(false);

  // ── Room message handlers ───────────────────────────────────────────────
  useEffect(() => {
    if (!room) return;

    const offPointScored = room.onMessage(
      "point_scored",
      (data: Record<string, unknown>) => {
        const sUid = data.scorerUid as string;
        const name = sUid === leftUid ? leftName : rightName;
        setLastScorerName(name);
        setLastScorerIsMe(sUid === myUid);

        // Flash the goal the ball went through — opposite of scorer's side.
        // For each viewer, "left goal" maps to bottom if they're left, top if right.
        const scorerSide = (data.scorerSide as string) ?? "left";
        // Ball went through the conceder's goal.
        // Conceder side is opposite of scorer side.
        const concederSide = scorerSide === "left" ? "right" : "left";
        // Is the conceder's goal at the bottom of the screen for this viewer?
        const isBottom = flipView
          ? concederSide === "right"
          : concederSide === "left";
        const flash = isBottom ? goalFlashBottom : goalFlashTop;
        flash.setValue(0.7);
        Animated.timing(flash, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();

        haptics.medium();
      },
    );

    const offPaddleHit = room.onMessage("paddle_hit", () => haptics.light());
    const offWallHit = room.onMessage("wall_hit", () => haptics.selection());
    const offServeLaunch = room.onMessage("serve_launch", () =>
      haptics.selection(),
    );
    const offMatchEnd = room.onMessage("match_end", () => {
      haptics.success();
      // Gracefully leave the room to prevent post-disposal reconnect loop
      leave();
    });

    return () => {
      for (const off of [
        offPointScored,
        offPaddleHit,
        offWallHit,
        offServeLaunch,
        offMatchEnd,
      ]) {
        if (typeof off === "function") off();
      }
    };
  }, [
    room,
    leftUid,
    leftName,
    rightName,
    myUid,
    flipView,
    goalFlashBottom,
    goalFlashTop,
    leave,
  ]);

  // ── Touch input (horizontal drag for vertical Pong) ──────────────────────
  const lastSentY = useRef<number | null>(null);
  const sendThrottle = useRef(0);

  const handleTouchMove = useCallback(
    (evt: GestureResponderEvent) => {
      // Allow movement during live, serve, countdown, and point_scored
      if (
        pongPhase === "waiting" ||
        pongPhase === "match_end" ||
        pongPhase === "aborted"
      )
        return;
      if (!mySide) return;

      const { locationX } = evt.nativeEvent;
      const serverY = touchXToServerY(locationX);

      // Instant local visual feedback via ref (no React re-render)
      localPaddleYRef.current = serverY;

      // Throttled server send
      const now = Date.now();
      if (now - sendThrottle.current < SEND_INTERVAL) return;
      sendThrottle.current = now;
      if (
        lastSentY.current !== null &&
        Math.abs(serverY - lastSentY.current) < 0.003
      )
        return;
      lastSentY.current = serverY;
      send("input_move", { y: serverY });
    },
    [pongPhase, mySide, send, touchXToServerY],
  );

  const handleTouchEnd = useCallback(() => {
    localPaddleYRef.current = null;
    lastSentY.current = null;
    send("input_stop", {});
  }, [send]);

  // ── Concede ─────────────────────────────────────────────────────────────
  const [concedeConfirm, setConcedeConfirm] = useState(false);
  const handleConcede = useCallback(() => {
    if (!concedeConfirm) {
      setConcedeConfirm(true);
      haptics.warning();
      setTimeout(() => setConcedeConfirm(false), 3000);
      return;
    }
    send("concede", {});
    setConcedeConfirm(false);
  }, [concedeConfirm, send]);

  // My paddle screen X: driven by RAF loop from localPaddleYRef / server state.
  // Sync from server when not touching (fallback).
  useEffect(() => {
    if (localPaddleYRef.current === null) {
      const myY = paddles[mySide ?? "left"]?.y ?? 0.5;
      const myScreenX = flipView ? (1 - myY) * arenaW : myY * arenaW;
      myPaddleAnimX.setValue(myScreenX);
    }
  }, [paddles, mySide, flipView, arenaW, myPaddleAnimX]);

  // ═════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════

  // ── Connecting / Reconnecting ─────────────────────────────────────────
  if (
    connectionStatus === "connecting" ||
    connectionStatus === "idle" ||
    connectionStatus === "reconnecting"
  ) {
    return (
      <View style={[st.root, { backgroundColor: colors.bg }]}>
        <View style={st.loadingWrap}>
          <MaterialCommunityIcons
            name="table-tennis"
            size={48}
            color={colors.accent}
            style={{ opacity: 0.8 }}
          />
          <Text style={[st.loadingLabel, { color: colors.text }]}>
            {connectionStatus === "reconnecting"
              ? "Reconnecting…"
              : "Joining match…"}
          </Text>
          <PulsingDots color={colors.accent} />
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (connectionError) {
    return (
      <View style={[st.root, { backgroundColor: colors.bg }]}>
        <View style={st.loadingWrap}>
          <MaterialCommunityIcons
            name="wifi-alert"
            size={44}
            color={colors.accent}
          />
          <Text style={[st.loadingLabel, { color: colors.text }]}>
            Connection error
          </Text>
          <Text style={[st.loadingSub, { color: colors.textDim }]}>
            {connectionError}
          </Text>
        </View>
      </View>
    );
  }

  // ── Compute positions for vertical layout ────────────────────────────────
  const pWpx = paddleWidthPx(effectiveSettings?.paddleSizePreset, arenaW);

  // Bottom paddle = my paddle, top paddle = opponent
  const bottomPaddleAnimX = myPaddleAnimX;
  const topPaddleAnimX = oppPaddleAnimX;

  // Fixed Y positions for paddle centers (screen coords)
  const bottomPaddleY = mapSX(mySide === "left" ? 0.03 : 0.97);
  const topPaddleY = mapSX(mySide === "left" ? 0.97 : 0.03);

  const scoreToWin = effectiveSettings?.scoreToWin ?? 7;
  const servePlayerName = serveOwner === "left" ? leftName : rightName;

  // ── Overlay content ───────────────────────────────────────────────────
  const renderOverlayContent = () => {
    switch (pongPhase) {
      case "waiting":
        return (
          <>
            <MaterialCommunityIcons
              name="account-clock-outline"
              size={36}
              color={colors.textDim}
            />
            <Text style={[st.overlayTitle, { color: colors.text }]}>
              Waiting for opponent
            </Text>
            <PulsingDots color={colors.accent} />
          </>
        );
      case "countdown":
        return countdown !== null ? (
          <Animated.Text
            style={[
              st.countdownNum,
              { color: colors.accent, transform: [{ scale: cdScale }] },
            ]}
          >
            {countdown}
          </Animated.Text>
        ) : null;
      case "point_scored":
        return (
          <>
            <Text style={[st.overlayTitle, { color: colors.textDim }]}>
              POINT
            </Text>
            <Text
              style={[
                st.overlayScorer,
                { color: lastScorerIsMe ? colors.accent : colors.text },
              ]}
            >
              {lastScorerName}
            </Text>
          </>
        );
      case "match_end": {
        const lScore = scores[leftUid] ?? 0;
        const rScore = scores[rightUid] ?? 0;
        return (
          <>
            <Text style={[st.overlayTitle, { color: colors.textDim }]}>
              MATCH OVER
            </Text>
            <View style={st.overlayScoreRow}>
              <Text
                style={[
                  st.overlayFinalScore,
                  {
                    color:
                      winningSide === "left" ? colors.paddleL : colors.textDim,
                  },
                ]}
              >
                {lScore}
              </Text>
              <Text style={[st.overlayFinalDash, { color: colors.textDim }]}>
                —
              </Text>
              <Text
                style={[
                  st.overlayFinalScore,
                  {
                    color:
                      winningSide === "right" ? colors.paddleR : colors.textDim,
                  },
                ]}
              >
                {rScore}
              </Text>
            </View>
            <Text
              style={[
                st.overlayResult,
                {
                  color:
                    iWon === true
                      ? colors.accent
                      : iWon === false
                        ? colors.textDim
                        : colors.text,
                },
              ]}
            >
              {iWon === true
                ? "Victory!"
                : iWon === false
                  ? "Defeat"
                  : "Match Over"}
            </Text>
          </>
        );
      }
      case "aborted":
        return (
          <>
            <MaterialCommunityIcons
              name="close-circle-outline"
              size={36}
              color={colors.textDim}
            />
            <Text style={[st.overlayTitle, { color: colors.text }]}>
              Match Aborted
            </Text>
          </>
        );
      default:
        return null;
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <View
      style={[
        st.root,
        { backgroundColor: colors.bg, paddingTop: insets.top + 8 },
      ]}
    >
      {/* ── Score HUD ────────────────────────────────────────────── */}
      <ScoreHUD
        leftScore={scores[leftUid] ?? 0}
        rightScore={scores[rightUid] ?? 0}
        leftName={leftName}
        rightName={rightName}
        leftConnected={paddles.left.connected}
        rightConnected={paddles.right.connected}
        mySide={mySide}
        scoreToWin={scoreToWin}
        colors={colors}
      />

      {/* ── Status Badges ────────────────────────────────────────── */}
      <View style={st.badgeRow}>
        {/* Reconnect banner */}
        {opponentDisconnected && pongPhase === "live" && (
          <View style={[st.badge, { backgroundColor: colors.accentDim }]}>
            <MaterialCommunityIcons
              name="wifi-off"
              size={12}
              color={colors.accent}
            />
            <Text style={[st.badgeText, { color: colors.accent }]}>
              Opponent disconnected
            </Text>
          </View>
        )}

        {/* Rally counter */}
        {pongPhase === "live" && rallyHits >= 4 && (
          <View style={[st.badge, { backgroundColor: colors.card }]}>
            <Text style={[st.badgeText, { color: colors.accent }]}>
              Rally {rallyHits}
            </Text>
          </View>
        )}

        {/* Serve indicator */}
        {pongPhase === "serve" && (
          <Text style={[st.serveHint, { color: colors.textDim }]}>
            {serveOwner === mySide
              ? "Your serve"
              : `${servePlayerName}'s serve`}
          </Text>
        )}
      </View>

      {/* ── Arena ────────────────────────────────────────────────── */}
      <View
        style={[
          st.arena,
          {
            width: arenaW,
            height: arenaH,
            backgroundColor: colors.arena,
            borderColor: colors.border,
          },
        ]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
        onResponderTerminate={handleTouchEnd}
      >
        {/* Center dashes */}
        <CenterDashes color={colors.line} arenaW={arenaW} centerY={centerY} />

        {/* Center circle */}
        <View
          style={[
            st.centerCircle,
            {
              borderColor: colors.line,
              left: Math.round(arenaW / 2) - 27,
              top: centerY - 27,
            },
          ]}
        />

        {/* Goal zones (horizontal strips at top & bottom) */}
        <View
          style={[
            st.goalZone,
            {
              top: 0,
              backgroundColor: flipView
                ? colors.paddleRGlow
                : colors.paddleLGlow,
            },
          ]}
          pointerEvents="none"
        />
        <View
          style={[
            st.goalZone,
            {
              bottom: 0,
              backgroundColor: flipView
                ? colors.paddleLGlow
                : colors.paddleRGlow,
            },
          ]}
          pointerEvents="none"
        />

        {/* Goal flash on score */}
        <Animated.View
          style={[
            st.goalFlash,
            {
              top: 0,
              height: Math.round(arenaH * 0.15),
              opacity: goalFlashTop,
              backgroundColor: flipView
                ? colors.paddleRGlow
                : colors.paddleLGlow,
            },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            st.goalFlash,
            {
              bottom: 0,
              height: Math.round(arenaH * 0.15),
              opacity: goalFlashBottom,
              backgroundColor: flipView
                ? colors.paddleLGlow
                : colors.paddleRGlow,
            },
          ]}
          pointerEvents="none"
        />

        {/* ── Bottom Paddle (mine) + glow ──────────────────── */}
        <Animated.View
          style={[
            st.paddleGlow,
            {
              backgroundColor:
                mySide === "left" ? colors.paddleLGlow : colors.paddleRGlow,
              left: -(pWpx / 2 + 4),
              top: bottomPaddleY - paddleThick / 2 - 4,
              width: pWpx + 8,
              height: paddleThick + 8,
              transform: [{ translateX: bottomPaddleAnimX }],
            },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            st.paddle,
            {
              backgroundColor:
                mySide === "left" ? colors.paddleL : colors.paddleR,
              shadowColor: mySide === "left" ? colors.paddleL : colors.paddleR,
              left: -(pWpx / 2),
              top: bottomPaddleY - paddleThick / 2,
              width: pWpx,
              height: paddleThick,
              transform: [{ translateX: bottomPaddleAnimX }],
            },
          ]}
        />

        {/* ── Top Paddle (opponent) + glow ─────────────────── */}
        <Animated.View
          style={[
            st.paddleGlow,
            {
              backgroundColor:
                mySide === "left" ? colors.paddleRGlow : colors.paddleLGlow,
              left: -(pWpx / 2 + 4),
              top: topPaddleY - paddleThick / 2 - 4,
              width: pWpx + 8,
              height: paddleThick + 8,
              transform: [{ translateX: topPaddleAnimX }],
            },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            st.paddle,
            {
              backgroundColor:
                mySide === "left" ? colors.paddleR : colors.paddleL,
              shadowColor: mySide === "left" ? colors.paddleR : colors.paddleL,
              left: -(pWpx / 2),
              top: topPaddleY - paddleThick / 2,
              width: pWpx,
              height: paddleThick,
              transform: [{ translateX: topPaddleAnimX }],
            },
          ]}
        />

        {/* ── Ball + glow (Animated for 60fps extrapolation) ── */}
        <Animated.View
          style={[
            st.ballGlow,
            {
              backgroundColor: colors.ballGlow,
              borderRadius: ballR + 5,
              left: -(ballR + 5),
              top: -(ballR + 5),
              width: (ballR + 5) * 2,
              height: (ballR + 5) * 2,
              transform: [{ translateX: ballAnimX }, { translateY: ballAnimY }],
            },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            st.ball,
            {
              backgroundColor: colors.ball,
              shadowColor: colors.ball,
              borderRadius: ballR,
              left: -ballR,
              top: -ballR,
              width: ballR * 2,
              height: ballR * 2,
              transform: [{ translateX: ballAnimX }, { translateY: ballAnimY }],
            },
          ]}
        />

        {/* ── Phase Overlay (animated) ─────────────────────── */}
        <Animated.View
          style={[
            st.overlay,
            { backgroundColor: colors.overlay, opacity: overlayAnim },
          ]}
          pointerEvents={
            pongPhase === "live" || pongPhase === "serve" ? "none" : "auto"
          }
        >
          <View style={[st.overlayCard, { backgroundColor: colors.card }]}>
            {renderOverlayContent()}
          </View>
        </Animated.View>
      </View>

      {/* ── Bottom Bar ───────────────────────────────────────────── */}
      <View style={st.bottomBar}>
        {/* Settings + Concede row */}
        <View style={st.bottomMeta}>
          {effectiveSettings && (
            <Text style={[st.settingsLine, { color: colors.textDim }]}>
              First to {effectiveSettings.scoreToWin}
              {effectiveSettings.winByTwo ? " (win by 2)" : ""} •{" "}
              {effectiveSettings.ballSpeedPreset}
            </Text>
          )}
          {pongPhase === "live" && (
            <Pressable
              style={({ pressed }) => [
                st.concedeBtn,
                concedeConfirm && {
                  backgroundColor: colors.accentDim,
                  borderColor: colors.accent,
                },
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleConcede}
            >
              <Text
                style={[
                  st.concedeText,
                  {
                    color: concedeConfirm ? colors.accent : colors.textDim,
                  },
                ]}
              >
                {concedeConfirm ? "Tap again" : "Concede"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════════

const st = StyleSheet.create({
  // ── Root ──────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
    alignItems: "center",
  },

  // ── Loading / Error ───────────────────────────────────────────────────────
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  loadingLabel: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 14,
  },
  loadingSub: {
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 40,
    marginTop: 4,
  },

  // ── Pulsing dots ──────────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  // ── Score HUD ─────────────────────────────────────────────────────────────
  hudCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 6,
  },
  hudCol: {
    flex: 1,
    gap: 2,
  },
  hudNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  hudColorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hudName: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 80,
  },
  hudNameDim: {
    opacity: 0.35,
  },
  youChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 2,
  },
  youChipText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  hudScore: {
    fontSize: 48,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    lineHeight: 56,
  },
  hudDivider: {
    alignItems: "center",
    paddingHorizontal: 14,
  },
  hudDash: {
    fontSize: 22,
    fontWeight: "200",
    lineHeight: 56,
  },
  hudTarget: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: -6,
  },

  // ── Status badges ─────────────────────────────────────────────────────────
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 22,
    marginBottom: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  serveHint: {
    fontSize: 12,
    fontWeight: "500",
    fontStyle: "italic",
  },

  // ── Arena ─────────────────────────────────────────────────────────────────
  arena: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  centerCircle: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
  },

  // ── Goal zones ────────────────────────────────────────────────────────────
  goalZone: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
  },
  goalFlash: {
    position: "absolute",
    left: 0,
    right: 0,
  },

  // ── Paddles ───────────────────────────────────────────────────────────────
  paddle: {
    position: "absolute",
    borderRadius: 7,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  paddleGlow: {
    position: "absolute",
    borderRadius: 11,
  },

  // ── Ball ──────────────────────────────────────────────────────────────────
  ball: {
    position: "absolute",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  ballGlow: {
    position: "absolute",
  },

  // ── Phase overlay ─────────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayCard: {
    paddingHorizontal: 40,
    paddingVertical: 28,
    borderRadius: 24,
    alignItems: "center",
    minWidth: 200,
    gap: 6,
  },
  overlayTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  countdownNum: {
    fontSize: 80,
    fontWeight: "900",
    lineHeight: 90,
  },
  overlayScorer: {
    fontSize: 26,
    fontWeight: "800",
    marginTop: 2,
  },
  overlayScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginVertical: 4,
  },
  overlayFinalScore: {
    fontSize: 52,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  overlayFinalDash: {
    fontSize: 24,
    fontWeight: "300",
  },
  overlayResult: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // ── Bottom bar ────────────────────────────────────────────────────────────
  bottomBar: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
  },
  reactionRow: {
    flexDirection: "row",
    gap: 10,
  },
  reactionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionEmoji: {
    fontSize: 18,
  },
  bottomMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  settingsLine: {
    fontSize: 11,
    fontWeight: "500",
  },
  concedeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  concedeText: {
    fontSize: 11,
    fontWeight: "600",
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════════

export default withGameV4Shell(PongUI, "pong_game");
