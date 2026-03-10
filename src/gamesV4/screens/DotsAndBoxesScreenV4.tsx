/**
 * Games V4 — Dots & Boxes Screen (Premium Polish)
 *
 * A premium, mobile-first Dots & Boxes experience:
 *
 * Layout zones:
 *   1. Top HUD — TurnStatusCard + refined player capsules
 *   2. Board hero — deep graphite slab, anchored dots, visible edge rails
 *   3. Slim bottom helper bar — contextual one-liners
 *
 * Visual design: "premium midnight strategy board"
 *   - Deep graphite surface with subtle depth
 *   - Crisp dot pegs with soft luminance
 *   - Neutral edge rail hints for tappable zones
 *   - Player-colored box fills with bloom animation
 *   - Last-move glow with fade
 *   - Score pulse on capture
 *   - Chain momentum emphasis
 *
 * Animation: Core RN Animated API only, native-driver safe.
 * Theme: Catppuccin dark alignment via useAppTheme.
 *
 * @module gamesV4/screens/DotsAndBoxesScreenV4
 */

import { BorderRadius, Elevation, FontSizes, Spacing } from "@/constants/theme";
import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import {
  BoardTray,
  InlineNotice,
  TurnStatusCard,
} from "@/gamesV4/components/turnBased";
import type { PlayerChipProps } from "@/gamesV4/components/turnBased/PlayerChip";
import { useAppTheme } from "@/store/ThemeContext";
import * as Haptics from "@/utils/haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

interface LastMove {
  edgeType: "h" | "v";
  row: number;
  col: number;
}

// =============================================================================
// Design Tokens
// =============================================================================

/** Player palette — desaturated strategy-game tones. */
const P = {
  // Player 0: cool sapphire
  blue: "#72AADF",
  blueFill: "rgba(114,170,223,0.18)",
  blueFillStrong: "rgba(114,170,223,0.38)",
  blueGlow: "rgba(114,170,223,0.30)",
  // Player 1: warm coral
  coral: "#E8826A",
  coralFill: "rgba(232,130,106,0.18)",
  coralFillStrong: "rgba(232,130,106,0.38)",
  coralGlow: "rgba(232,130,106,0.30)",
} as const;

const PLAYER_EDGE = [P.blue, P.coral] as const;
const PLAYER_FILL = [P.blueFill, P.coralFill] as const;
const PLAYER_FILL_STRONG = [P.blueFillStrong, P.coralFillStrong] as const;
const PLAYER_GLOW = [P.blueGlow, P.coralGlow] as const;

/** Board surface palette */
const BOARD = {
  surfaceDark: "#12121E",
  frameDark: "#0C0C16",
  surfaceLight: "#EAEAF0",
  frameLight: "#D4D4DC",
  dotDark: "#54546A",
  dotLight: "#999",
  railDark: "rgba(255,255,255,0.07)",
  railLight: "rgba(0,0,0,0.06)",
  railPressDark: "rgba(255,255,255,0.20)",
  railPressLight: "rgba(0,0,0,0.14)",
  claimedDark: "rgba(200,200,220,0.52)",
  claimedLight: "rgba(40,40,60,0.45)",
  lastGlow: "#FFD54F",
} as const;

/** Timing (ms) */
const T = {
  edgeSnap: 170,
  boxBloom: 260,
  glowFade: 1800,
} as const;

// =============================================================================
// Layout helper
// =============================================================================

const SCREEN_W = Dimensions.get("window").width;

function boardLayout(rows: number, cols: number) {
  const DOT = 10;
  const THICK = 5;
  const max = Math.min(SCREEN_W - 40, 400);
  const cell = Math.floor((max - DOT * (cols + 1)) / cols);
  const w = cell * cols + DOT * (cols + 1);
  const h = cell * rows + DOT * (rows + 1);
  const hit = Math.max((44 - THICK) / 2, 12);
  return { DOT, THICK, cell, w, h, hit };
}

// =============================================================================
// AnimatedEdge
// =============================================================================

interface AnimatedEdgeProps {
  color: string;
  isNew: boolean;
  isLastMove: boolean;
  horizontal: boolean;
  length: number;
  thickness: number;
}

const AnimatedEdge = React.memo(function AnimatedEdge({
  color,
  isNew,
  isLastMove,
  horizontal,
  length,
  thickness,
}: AnimatedEdgeProps) {
  const anim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const glow = useRef(new Animated.Value(isLastMove ? 1 : 0)).current;

  useEffect(() => {
    if (isNew) {
      Animated.timing(anim, {
        toValue: 1,
        duration: T.edgeSnap,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLastMove) {
      glow.setValue(1);
      Animated.timing(glow, {
        toValue: 0,
        duration: T.glowFade,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [isLastMove]); // eslint-disable-line react-hooks/exhaustive-deps

  const scale = isNew
    ? anim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] })
    : 1;
  const opacity = isNew ? anim : 1;

  return (
    <View>
      {/* Glow halo behind the edge */}
      <Animated.View
        style={{
          position: "absolute",
          width: horizontal ? length + 6 : thickness + 8,
          height: horizontal ? thickness + 8 : length + 6,
          left: horizontal ? -3 : -4,
          top: horizontal ? -4 : -3,
          borderRadius: (thickness + 10) / 2,
          backgroundColor: BOARD.lastGlow,
          opacity: glow.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.35],
          }),
        }}
      />
      {/* Edge */}
      <Animated.View
        style={{
          width: horizontal ? length : thickness,
          height: horizontal ? thickness : length,
          backgroundColor: color,
          borderRadius: thickness / 2,
          opacity,
          transform: [horizontal ? { scaleX: scale } : { scaleY: scale }],
        }}
      />
    </View>
  );
});

// =============================================================================
// AnimatedBoxFill
// =============================================================================

interface AnimatedBoxFillProps {
  strongColor: string;
  isNew: boolean;
  size: number;
  initial: string | null;
  playerIdx: number;
}

const AnimatedBoxFill = React.memo(function AnimatedBoxFill({
  strongColor,
  isNew,
  size,
  initial,
  playerIdx,
}: AnimatedBoxFillProps) {
  const anim = useRef(new Animated.Value(isNew ? 0 : 1)).current;

  useEffect(() => {
    if (isNew) {
      Animated.timing(anim, {
        toValue: 1,
        duration: T.boxBloom,
        easing: Easing.out(Easing.back(1.12)),
        useNativeDriver: true,
      }).start();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scale = isNew
    ? anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] })
    : 1;
  const opacity = isNew
    ? anim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.45, 1] })
    : 1;

  const edgeColor = PLAYER_EDGE[playerIdx] ?? PLAYER_EDGE[0];

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: 4,
        backgroundColor: strongColor,
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: [{ scale }],
        shadowColor: PLAYER_GLOW[playerIdx] ?? PLAYER_GLOW[0],
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      {initial && size >= 22 && (
        <Text
          style={{
            fontSize: Math.max(size * 0.28, 9),
            fontWeight: "800",
            color: edgeColor,
            opacity: 0.65,
            includeFontPadding: false,
          }}
        >
          {initial}
        </Text>
      )}
    </Animated.View>
  );
});

// =============================================================================
// Dot
// =============================================================================

const Dot = React.memo(function Dot({
  size,
  isDark,
  highlighted,
}: {
  size: number;
  isDark: boolean;
  highlighted: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isDark ? BOARD.dotDark : BOARD.dotLight,
        borderWidth: 1,
        borderColor: isDark
          ? highlighted
            ? "rgba(255,213,79,0.30)"
            : "rgba(100,100,130,0.25)"
          : highlighted
            ? "rgba(180,150,50,0.30)"
            : "rgba(0,0,0,0.12)",
        zIndex: 10,
      }}
    />
  );
});

// =============================================================================
// PlayerScoreCapsule
// =============================================================================

interface CapsuleProps {
  name: string;
  score: number;
  prevScore: number;
  color: string;
  glowColor: string;
  isActive: boolean;
  isLocal: boolean;
  avatarUrl?: string | null;
  isDark: boolean;
}

const PlayerScoreCapsule = React.memo(function PlayerScoreCapsule({
  name,
  score,
  prevScore,
  color,
  glowColor,
  isActive,
  isLocal,
  avatarUrl,
  isDark,
}: CapsuleProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (score > prevScore && prevScore >= 0) {
      pulse.setValue(1.25);
      Animated.spring(pulse, {
        toValue: 1,
        stiffness: 300,
        damping: 14,
        mass: 0.7,
        useNativeDriver: true,
      }).start();
    }
  }, [score]); // eslint-disable-line react-hooks/exhaustive-deps

  const txt = isDark ? "#EEEEF0" : "#222";
  const muted = isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.32)";
  const short = name.length > 10 ? name.slice(0, 9) + "\u2026" : name;

  return (
    <View
      style={[
        cs.wrap,
        isActive
          ? {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.07)"
                : "rgba(0,0,0,0.04)",
              borderColor: color,
              borderWidth: 1.5,
              shadowColor: glowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
              elevation: 3,
            }
          : {
              backgroundColor: "transparent",
              borderColor: isDark
                ? "rgba(255,255,255,0.07)"
                : "rgba(0,0,0,0.06)",
              borderWidth: 1,
              opacity: 0.55,
            },
      ]}
    >
      {/* Avatar pip */}
      <View style={[cs.pip, { backgroundColor: color }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={cs.avatar} />
        ) : (
          <Text style={cs.pipLetter}>{name[0]?.toUpperCase() ?? "?"}</Text>
        )}
      </View>
      {/* Info */}
      <View style={cs.info}>
        <View style={cs.nameRow}>
          <Text
            style={[cs.name, { color: isActive ? txt : muted }]}
            numberOfLines={1}
          >
            {short}
          </Text>
          {isLocal && <Text style={[cs.you, { color: muted }]}>you</Text>}
        </View>
        <Animated.Text
          style={[
            cs.score,
            { color: isActive ? color : muted },
            { transform: [{ scale: pulse }] },
          ]}
        >
          {score}
        </Animated.Text>
      </View>
    </View>
  );
});

const cs = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.xl,
    gap: 7,
    minWidth: 96,
    maxWidth: 160,
  },
  pip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatar: { width: 26, height: 26, borderRadius: 13 },
  pipLetter: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFF",
    includeFontPadding: false,
  },
  info: { flexShrink: 1, gap: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  name: { fontSize: 11, fontWeight: "600", flexShrink: 1 },
  you: { fontSize: 9, fontWeight: "500", fontStyle: "italic", opacity: 0.65 },
  score: {
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
    lineHeight: 24,
  },
});

// =============================================================================
// MatchHUD
// =============================================================================

function MatchHUD({
  myUid,
  turnOrder,
  players,
  scores,
  prevScores,
  isMyTurn,
  isTerminal,
  boardKey,
  turnRetained,
  isDark,
}: {
  myUid: string;
  turnOrder: string[];
  players: Array<{
    uid: string;
    displayName?: string;
    profilePictureUrl?: string | null;
  }>;
  scores: Record<string, number>;
  prevScores: Record<string, number>;
  isMyTurn: boolean;
  isTerminal: boolean;
  boardKey: string;
  turnRetained: boolean;
  isDark: boolean;
}) {
  const myIdx = turnOrder.indexOf(myUid);
  const ci = myIdx >= 0 ? myIdx : 0;
  const oi = ci === 0 ? 1 : 0;
  const myP = players.find((p) => p.uid === myUid);
  const oppUid = turnOrder.find((u) => u !== myUid) ?? "";
  const oppP = players.find((p) => p.uid === oppUid);

  let statusText: string;
  let statusColor: string;
  const mutedC = isDark ? "rgba(255,255,255,0.36)" : "rgba(0,0,0,0.32)";

  if (isTerminal) {
    const ms = scores[myUid] ?? 0;
    const os = scores[oppUid] ?? 0;
    statusText = ms > os ? "Victory" : os > ms ? "Defeated" : "Draw";
    statusColor =
      ms > os ? "#34C759" : os > ms ? "#FF453A" : isDark ? "#AAA" : "#777";
  } else if (isMyTurn) {
    statusText = turnRetained ? "Go again" : "Your move";
    statusColor = turnRetained ? "#34C759" : isDark ? "#EEEEF0" : "#222";
  } else {
    statusText = "Waiting";
    statusColor = mutedC;
  }

  return (
    <View style={hud.row}>
      <PlayerScoreCapsule
        name={myP?.displayName ?? "You"}
        score={scores[myUid] ?? 0}
        prevScore={prevScores[myUid] ?? 0}
        color={PLAYER_EDGE[ci]}
        glowColor={PLAYER_GLOW[ci]}
        isActive={isMyTurn && !isTerminal}
        isLocal
        avatarUrl={myP?.profilePictureUrl}
        isDark={isDark}
      />

      <View style={hud.center}>
        <Text style={[hud.status, { color: statusColor }]} numberOfLines={1}>
          {statusText}
        </Text>
        <View
          style={[
            hud.badge,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.04)",
            },
          ]}
        >
          <Text style={[hud.badgeTxt, { color: mutedC }]}>{boardKey}</Text>
        </View>
      </View>

      <PlayerScoreCapsule
        name={oppP?.displayName ?? "Opponent"}
        score={scores[oppUid] ?? 0}
        prevScore={prevScores[oppUid] ?? 0}
        color={PLAYER_EDGE[oi]}
        glowColor={PLAYER_GLOW[oi]}
        isActive={!isMyTurn && !isTerminal}
        isLocal={false}
        avatarUrl={oppP?.profilePictureUrl}
        isDark={isDark}
      />
    </View>
  );
}

const hud = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginHorizontal: Spacing.sm,
    paddingVertical: 2,
    gap: 4,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    flexShrink: 1,
    minWidth: 56,
  },
  status: {
    fontSize: FontSizes.sm,
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeTxt: { fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },
});

// =============================================================================
// EdgeRail (unclaimed edge hint)
// =============================================================================

const EdgeRail = React.memo(function EdgeRail({
  horizontal,
  length,
  thickness,
  isDark,
  pressed,
  active,
}: {
  horizontal: boolean;
  length: number;
  thickness: number;
  isDark: boolean;
  pressed: boolean;
  active: boolean;
}) {
  const bg =
    pressed && active
      ? isDark
        ? BOARD.railPressDark
        : BOARD.railPressLight
      : isDark
        ? BOARD.railDark
        : BOARD.railLight;

  return (
    <View
      style={{
        width: horizontal ? length : thickness,
        height: horizontal ? thickness : length,
        borderRadius: thickness / 2,
        backgroundColor: bg,
      }}
    />
  );
});

// =============================================================================
// HelperBar (slim bottom)
// =============================================================================

function HelperBar({
  text,
  accent,
  isDark,
}: {
  text: string;
  accent?: string;
  isDark: boolean;
}) {
  const c = accent ?? (isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.26)");
  return (
    <View style={hlp.wrap}>
      <Text style={[hlp.txt, { color: c }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const hlp = StyleSheet.create({
  wrap: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  txt: { fontSize: FontSizes.xs, fontWeight: "500", letterSpacing: 0.15 },
});

// =============================================================================
// Main UI
// =============================================================================

function DotsAndBoxesUI({
  publicState,
  isMyTurn,
  isTerminal,
  myUid,
  turnOrder,
  players,
  submitMove,
  actionLoading,
}: GameShellProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;

  // ─── Parse state ───────────────────────────────────────────────────
  const rows = (publicState?.rows as number) ?? 4;
  const cols = (publicState?.cols as number) ?? 4;
  const boardKey = (publicState?.boardKey as string) ?? "4x4";
  const hEdges = (publicState?.horizontalEdges as boolean[]) ?? [];
  const vEdges = (publicState?.verticalEdges as boolean[]) ?? [];
  const boxOwners = (publicState?.boxOwners as (string | null)[]) ?? [];
  const scores = (publicState?.scoresByUid as Record<string, number>) ?? {};
  const turnRetained = (publicState?.turnRetained as boolean) ?? false;
  const lastMove = publicState?.lastMove as LastMove | null;
  const lastCapturedBoxes = (publicState?.lastCapturedBoxes as number[]) ?? [];
  const moveNumber = (publicState?.moveNumber as number) ?? 0;
  const remainingEdges = (publicState?.remainingEdges as number) ?? 0;

  // ─── Layout ────────────────────────────────────────────────────────
  const bl = useMemo(() => boardLayout(rows, cols), [rows, cols]);

  // ─── Player identity ──────────────────────────────────────────────
  const oppUid = turnOrder.find((u) => u !== myUid) ?? "";
  const mySlot = players.find((p) => p.uid === myUid);
  const oppSlot = players.find((p) => p.uid === oppUid);
  const myIdx = turnOrder.indexOf(myUid);
  const ci = myIdx >= 0 ? myIdx : 0;
  const oi = ci === 0 ? 1 : 0;

  // ─── Animation trackers ───────────────────────────────────────────
  const prevMoveRef = useRef(moveNumber);
  const newEdgeKey = useRef<string | null>(null);
  const newBoxSet = useRef(new Set<number>());
  const prevScoresSnap = useRef<Record<string, number>>({
    [myUid]: 0,
    [oppUid]: 0,
  });
  const [prevScores, setPrevScores] = useState<Record<string, number>>({
    [myUid]: 0,
    [oppUid]: 0,
  });

  if (moveNumber > prevMoveRef.current) {
    const snap = { ...prevScoresSnap.current };
    prevScoresSnap.current = { ...scores };
    newEdgeKey.current = lastMove
      ? `${lastMove.edgeType}-${lastMove.row}-${lastMove.col}`
      : null;
    newBoxSet.current = new Set(lastCapturedBoxes);
    prevMoveRef.current = moveNumber;
    if (snap[myUid] !== scores[myUid] || snap[oppUid] !== scores[oppUid]) {
      queueMicrotask(() => setPrevScores(snap));
    }
  }

  const isNewEdge = useCallback(
    (t: "h" | "v", r: number, c: number) =>
      newEdgeKey.current === `${t}-${r}-${c}`,
    [moveNumber], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const isNewBox = useCallback(
    (idx: number) => newBoxSet.current.has(idx),
    [moveNumber], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const isLast = useCallback(
    (t: "h" | "v", r: number, c: number) =>
      lastMove?.edgeType === t && lastMove.row === r && lastMove.col === c,
    [lastMove],
  );

  // ─── Dot highlight set ────────────────────────────────────────────
  const lastDots = useMemo(() => {
    if (!lastMove) return new Set<string>();
    const s = new Set<string>();
    if (lastMove.edgeType === "h") {
      s.add(`${lastMove.row}-${lastMove.col}`);
      s.add(`${lastMove.row}-${lastMove.col + 1}`);
    } else {
      s.add(`${lastMove.row}-${lastMove.col}`);
      s.add(`${lastMove.row + 1}-${lastMove.col}`);
    }
    return s;
  }, [lastMove]);

  // ─── Edge/box visuals ─────────────────────────────────────────────
  const edgeColor = isDark ? BOARD.claimedDark : BOARD.claimedLight;

  const boxVisual = useCallback(
    (uid: string | null) => {
      if (!uid)
        return {
          fill: "transparent",
          strong: "transparent",
          init: null as string | null,
          pi: 0,
        };
      const pi = turnOrder.indexOf(uid);
      const idx = pi >= 0 ? pi : 0;
      const init =
        uid === myUid
          ? (mySlot?.displayName?.[0]?.toUpperCase() ?? "Y")
          : (oppSlot?.displayName?.[0]?.toUpperCase() ?? "O");
      return {
        fill: PLAYER_FILL[idx] ?? PLAYER_FILL[0],
        strong: PLAYER_FILL_STRONG[idx] ?? PLAYER_FILL_STRONG[0],
        init,
        pi: idx,
      };
    },
    [turnOrder, myUid, mySlot?.displayName, oppSlot?.displayName],
  );

  // ─── Handlers ─────────────────────────────────────────────────────
  const onEdge = useCallback(
    async (t: "h" | "v", r: number, c: number) => {
      if (!isMyTurn || isTerminal || actionLoading) return;
      if (t === "h" && hEdges[r * cols + c]) return;
      if (t === "v" && vEdges[r * (cols + 1) + c]) return;
      Haptics.light();
      await submitMove({ edgeType: t, row: r, col: c });
    },
    [isMyTurn, isTerminal, actionLoading, hEdges, vEdges, cols, submitMove],
  );

  // ─── Capture haptics ──────────────────────────────────────────────
  const lastBoxCount = useRef(0);
  const myBoxes = scores[myUid] ?? 0;
  const oppBoxes = scores[oppUid] ?? 0;
  const totalB = rows * cols;

  useEffect(() => {
    const cur = Object.values(scores).reduce((a, b) => a + b, 0);
    if (cur > lastBoxCount.current && lastBoxCount.current > 0) {
      const d = cur - lastBoxCount.current;
      d >= 2 ? Haptics.medium() : Haptics.light();
    }
    lastBoxCount.current = cur;
  }, [scores]);

  const termHaptic = useRef(false);
  useEffect(() => {
    if (isTerminal && !termHaptic.current) {
      termHaptic.current = true;
      myBoxes > oppBoxes
        ? Haptics.success()
        : myBoxes === oppBoxes
          ? Haptics.light()
          : Haptics.medium();
    }
  }, [isTerminal, myBoxes, oppBoxes]);

  // ─── Helper bar text ──────────────────────────────────────────────
  const helper = useMemo((): { text: string; accent?: string } => {
    if (isTerminal) {
      const d = Math.abs(myBoxes - oppBoxes);
      if (d === 0)
        return { text: `Game over \u00B7 ${myBoxes}\u2013${oppBoxes}` };
      return {
        text: `Final \u00B7 ${Math.max(myBoxes, oppBoxes)}\u2013${Math.min(myBoxes, oppBoxes)}`,
      };
    }
    if (!isMyTurn) {
      const n = oppSlot?.displayName?.split(" ")[0] ?? "Opponent";
      return { text: `${n} is thinking\u2026` };
    }
    if (turnRetained) {
      return { text: "You completed a box \u2014 go again", accent: "#34C759" };
    }
    if (moveNumber === 0) return { text: "Draw any edge to begin" };
    const total = 2 * rows * cols + rows + cols;
    if (remainingEdges < total * 0.25) return { text: "Final stretch" };
    return { text: "Your move" };
  }, [
    isTerminal,
    isMyTurn,
    turnRetained,
    moveNumber,
    myBoxes,
    oppBoxes,
    oppSlot?.displayName,
    remainingEdges,
    rows,
    cols,
  ]);

  // ─── Inline notice ────────────────────────────────────────────────
  const [notice, setNotice] = useState<{
    msg: string;
    sev: "info" | "warning";
  } | null>(null);

  useEffect(() => {
    if (moveNumber === 0 || isTerminal) return;
    if (turnRetained && isMyTurn) {
      const n = lastCapturedBoxes.length;
      setNotice(
        n >= 2
          ? { msg: "Double capture! Go again", sev: "warning" }
          : { msg: "Extra turn!", sev: "info" },
      );
    }
  }, [moveNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── TurnStatusCard props ─────────────────────────────────────────
  const localChip: PlayerChipProps = {
    displayName: mySlot?.displayName || "You",
    markLabel: "\u25A0",
    markColor: PLAYER_EDGE[ci],
    isActive: isMyTurn && !isTerminal,
    isLocal: true,
    avatarUrl: mySlot?.profilePictureUrl,
  };
  const oppChip: PlayerChipProps = {
    displayName: oppSlot?.displayName || "Opponent",
    markLabel: "\u25A0",
    markColor: PLAYER_EDGE[oi],
    isActive: !isMyTurn && !isTerminal,
    avatarUrl: oppSlot?.profilePictureUrl,
  };

  const sText = useMemo(() => {
    if (isTerminal) {
      if (myBoxes > oppBoxes) return "You won!";
      if (oppBoxes > myBoxes) return "You lost";
      return "Draw \u2014 equal boxes";
    }
    if (isMyTurn) return turnRetained ? "Nice \u2014 go again!" : "Your turn";
    return "Opponent\u2019s turn";
  }, [isTerminal, isMyTurn, turnRetained, myBoxes, oppBoxes]);

  const sColor = useMemo(() => {
    if (isTerminal) {
      if (myBoxes > oppBoxes) return "#34C759";
      if (oppBoxes > myBoxes) return "#FF3B30";
      return isDark ? "#AAA" : "#888";
    }
    if (isMyTurn && turnRetained) return "#34C759";
    return undefined;
  }, [isTerminal, isMyTurn, turnRetained, myBoxes, oppBoxes, isDark]);

  const sSub = useMemo(() => {
    if (isTerminal) {
      const d = Math.abs(myBoxes - oppBoxes);
      if (d === 0) return `${myBoxes} \u2013 ${oppBoxes}`;
      return `${Math.max(myBoxes, oppBoxes)} \u2013 ${Math.min(myBoxes, oppBoxes)} \u00B7 +${d}`;
    }
    return boardKey + " board";
  }, [isTerminal, myBoxes, oppBoxes, boardKey]);

  // ─── Surface colors ───────────────────────────────────────────────
  const gameBg = isDark ? "#08080E" : theme.colors.background;
  const boardBg = isDark ? BOARD.surfaceDark : BOARD.surfaceLight;
  const frameBg = isDark ? BOARD.frameDark : BOARD.frameLight;

  // ════════════════════════════════════════════════════════════════════
  // Board elements (memoized)
  // ════════════════════════════════════════════════════════════════════

  const boardEls = useMemo(() => {
    const els: React.ReactNode[] = [];
    const { DOT, THICK, cell, hit } = bl;
    const canTap = isMyTurn && !isTerminal && !actionLoading;

    for (let dr = 0; dr <= rows; dr++) {
      // ── Dot row ──
      const dRow: React.ReactNode[] = [];
      for (let dc = 0; dc <= cols; dc++) {
        dRow.push(
          <Dot
            key={`d${dr}${dc}`}
            size={DOT}
            isDark={isDark}
            highlighted={lastDots.has(`${dr}-${dc}`)}
          />,
        );
        if (dc < cols) {
          const hi = dr * cols + dc;
          const taken = hEdges[hi] ?? false;
          const last = isLast("h", dr, dc);
          const animNew = isNewEdge("h", dr, dc);
          dRow.push(
            <Pressable
              key={`h${dr}${dc}`}
              onPress={() => onEdge("h", dr, dc)}
              disabled={taken || !canTap}
              hitSlop={{ top: hit, bottom: hit, left: 2, right: 2 }}
              style={{
                width: cell,
                height: DOT,
                justifyContent: "center",
                alignItems: "center",
              }}
              accessibilityLabel={
                taken
                  ? `Edge taken row ${dr} col ${dc}`
                  : `Place edge row ${dr} col ${dc}`
              }
              accessibilityRole="button"
            >
              {({ pressed }) =>
                taken ? (
                  <AnimatedEdge
                    color={edgeColor}
                    isNew={animNew}
                    isLastMove={last}
                    horizontal
                    length={cell}
                    thickness={THICK}
                  />
                ) : (
                  <EdgeRail
                    horizontal
                    length={cell - 2}
                    thickness={THICK - 1}
                    isDark={isDark}
                    pressed={pressed}
                    active={canTap}
                  />
                )
              }
            </Pressable>,
          );
        }
      }
      els.push(
        <View key={`DR${dr}`} style={s.dotRow}>
          {dRow}
        </View>,
      );

      // ── Box row ──
      if (dr < rows) {
        const bRow: React.ReactNode[] = [];
        for (let dc = 0; dc <= cols; dc++) {
          const vi = dr * (cols + 1) + dc;
          const taken = vEdges[vi] ?? false;
          const last = isLast("v", dr, dc);
          const animNew = isNewEdge("v", dr, dc);
          bRow.push(
            <Pressable
              key={`v${dr}${dc}`}
              onPress={() => onEdge("v", dr, dc)}
              disabled={taken || !canTap}
              hitSlop={{ left: hit, right: hit, top: 2, bottom: 2 }}
              style={{
                width: DOT,
                height: cell,
                justifyContent: "center",
                alignItems: "center",
              }}
              accessibilityLabel={
                taken
                  ? `Edge taken row ${dr} col ${dc}`
                  : `Place edge row ${dr} col ${dc}`
              }
              accessibilityRole="button"
            >
              {({ pressed }) =>
                taken ? (
                  <AnimatedEdge
                    color={edgeColor}
                    isNew={animNew}
                    isLastMove={last}
                    horizontal={false}
                    length={cell}
                    thickness={THICK}
                  />
                ) : (
                  <EdgeRail
                    horizontal={false}
                    length={cell - 2}
                    thickness={THICK - 1}
                    isDark={isDark}
                    pressed={pressed}
                    active={canTap}
                  />
                )
              }
            </Pressable>,
          );
          if (dc < cols) {
            const bi = dr * cols + dc;
            const own = boxOwners[bi] ?? null;
            const bv = boxVisual(own);
            const animB = isNewBox(bi);
            bRow.push(
              <View
                key={`b${dr}${dc}`}
                style={{
                  width: cell,
                  height: cell,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {own && (
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      backgroundColor: bv.fill,
                      borderRadius: 2,
                    }}
                  />
                )}
                {own && (
                  <AnimatedBoxFill
                    strongColor={bv.strong}
                    isNew={animB}
                    size={cell - 6}
                    initial={bv.init}
                    playerIdx={bv.pi}
                  />
                )}
              </View>,
            );
          }
        }
        els.push(
          <View key={`BR${dr}`} style={s.dotRow}>
            {bRow}
          </View>,
        );
      }
    }
    return els;
  }, [
    rows,
    cols,
    bl,
    hEdges,
    vEdges,
    boxOwners,
    moveNumber,
    isMyTurn,
    isTerminal,
    actionLoading,
    isDark,
    lastDots,
    edgeColor,
    boxVisual,
    isNewEdge,
    isNewBox,
    isLast,
    onEdge,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════

  return (
    <View style={[s.root, { backgroundColor: gameBg }]}>
      {/* Zone 1 — top HUD */}
      <TurnStatusCard
        statusText={sText}
        subtitle={sSub}
        localPlayer={localChip}
        opponentPlayer={oppChip}
        isLocalTurn={isMyTurn}
        isTerminal={isTerminal}
        statusColor={sColor}
      />

      {/* Score capsules */}
      <MatchHUD
        myUid={myUid}
        turnOrder={turnOrder}
        players={players}
        scores={scores}
        prevScores={prevScores}
        isMyTurn={isMyTurn}
        isTerminal={isTerminal}
        boardKey={boardKey}
        turnRetained={turnRetained}
        isDark={isDark}
      />

      {/* Zone 2 — board hero */}
      <View style={s.boardZone}>
        <View
          style={[
            s.frame,
            {
              backgroundColor: frameBg,
              ...Elevation.lg,
              shadowColor: isDark ? "#000" : "#888",
            },
          ]}
        >
          <BoardTray padding={8} backgroundColor={boardBg} style={s.tray}>
            <View style={{ width: bl.w, height: bl.h }}>{boardEls}</View>
          </BoardTray>
        </View>
      </View>

      {/* Zone 3 — bottom helper + notices */}
      <View style={s.bottom}>
        <HelperBar text={helper.text} accent={helper.accent} isDark={isDark} />
        {notice && (
          <InlineNotice
            message={notice.msg}
            severity={notice.sev}
            dismissAfterMs={2200}
            onDismiss={() => setNotice(null)}
          />
        )}
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  boardZone: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  frame: { borderRadius: BorderRadius.lg + 2, padding: 3 },
  tray: { borderRadius: BorderRadius.lg },
  dotRow: { flexDirection: "row", alignItems: "center" },
  bottom: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.select({ ios: Spacing.md, default: Spacing.lg }),
    gap: Spacing.xs,
    alignItems: "center",
    minHeight: 48,
  },
});

export default withGameV4Shell(DotsAndBoxesUI, "dots_and_boxes");
