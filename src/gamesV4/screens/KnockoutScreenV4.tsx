/**
 * Games V4 — Knockout Game Screen (Polished)
 *
 * Real-time FFA penguin physics game. Connects to Colyseus for
 * authoritative state; renders a top-down SQUARE ice arena over
 * an ocean background with simultaneous planning, reveal, and
 * physics-simulation phases.
 *
 * Visual direction: penguins on ice floating on the ocean.
 * Square ice platform, blue ocean background, readable HUD,
 * drag-to-aim with variable power.
 */

import type { GameShellProps } from "@/gamesV4/components/GameScreenShell";
import { withGameV4Shell } from "@/gamesV4/components/GameScreenShell";
import type {
  KnockoutBodyState,
  KnockoutPhase,
  KnockoutPlayerStats,
  KnockoutRealtimeState,
  KnockoutRevealedMove,
  KnockoutRoundSummary,
} from "@/gamesV4/realtime/games/knockoutGameDef";
import { KNOCKOUT_CLIENT_DEF } from "@/gamesV4/realtime/games/knockoutGameDef";
import {
  createFrameLoop,
  InterpolationBuffer,
} from "@/gamesV4/realtime/interpolation";
import { useRealtimeRoom } from "@/gamesV4/realtime/useRealtimeRoom";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import * as haptics from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, {
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
// SERVER PHYSICS MIRROR  (must match colyseus-server/src/games/knockout/physics.ts)
// ═══════════════════════════════════════════════════════════════════════════════

const SRV = {
  PENGUIN_RADIUS: 0.035,
  ARENA_BASE_HALF_SIDE: 0.42,
  ARENA_CENTER: 0.5,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// ARCTIC COLOR PALETTE
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  // Backgrounds — ocean
  bg: "#0A2A4A",
  bgLight: "#0F3560",

  // Arena — ice
  iceLight: "#D6EAF8",
  iceMid: "#B0D4F1",
  iceDark: "#8FBFE0",
  iceEdge: "rgba(180,220,255,0.60)",
  iceSheen: "rgba(255,255,255,0.18)",

  // Water / ocean void
  water: "#07223D",
  waterEdge: "rgba(40,120,200,0.30)",

  // Danger / shrink
  danger: "#FF5252",
  dangerBand: "rgba(255,82,82,0.12)",
  shrinkWarning: "#FFA726",

  // Text
  text: "#E8EDF4",
  textSecondary: "rgba(232,237,244,0.70)",
  textDim: "rgba(232,237,244,0.40)",

  // Accent
  accent: "#4FC3F7",
  accentDim: "rgba(79,195,247,0.15)",
  accentGlow: "rgba(79,195,247,0.30)",

  // Status
  success: "#66BB6A",
  successGlow: "rgba(102,187,106,0.25)",
  warning: "#FFA726",
  warningGlow: "rgba(255,167,38,0.20)",
  elimination: "#FF5252",
  gold: "#FFD54F",
  goldGlow: "rgba(255,213,79,0.25)",

  // UI surfaces
  card: "rgba(255,255,255,0.07)",
  cardBorder: "rgba(255,255,255,0.08)",
  cardElevated: "rgba(255,255,255,0.10)",
  overlay: "rgba(6,20,40,0.82)",

  // Controls
  btnPrimary: "#4FC3F7",
  btnPrimaryPressed: "#29B6F6",
  btnGhost: "rgba(255,255,255,0.08)",
  btnGhostPressed: "rgba(255,255,255,0.14)",
  btnDisabled: "rgba(255,255,255,0.04)",

  // Player
  localRing: "#FFFFFF",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYER COLORS  (high-contrast on dark ice)
// ═══════════════════════════════════════════════════════════════════════════════

const PLAYER_COLORS = [
  "#4FC3F7", // ice blue
  "#FF7043", // coral
  "#66BB6A", // spring green
  "#CE93D8", // lavender
  "#FFD54F", // gold
  "#F06292", // rose
  "#26C6DA", // teal
  "#BCAAA4", // warm gray
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

interface PhaseConfig {
  label: string;
  icon: string;
  accent: string;
  subtitle?: string;
  minimal?: boolean;
}

const PHASE_CFG: Record<KnockoutPhase, PhaseConfig> = {
  waiting: {
    label: "Waiting",
    icon: "timer-sand",
    accent: C.textSecondary,
    subtitle: "Waiting for players…",
  },
  round_intro: {
    label: "Get Ready",
    icon: "penguin",
    accent: C.accent,
  },
  planning: {
    label: "Plan",
    icon: "target",
    accent: C.accent,
    subtitle: "Drag to aim · tap Ready",
  },
  locked_countdown: {
    label: "All Locked",
    icon: "lock-check",
    accent: C.warning,
  },
  reveal: {
    label: "Reveal!",
    icon: "eye",
    accent: C.gold,
    minimal: true,
  },
  simulation: {
    label: "Launch",
    icon: "rocket-launch",
    accent: C.text,
    minimal: true,
  },
  settle: {
    label: "Settling",
    icon: "dots-horizontal",
    accent: C.textSecondary,
    minimal: true,
  },
  resolve_elims: {
    label: "Results",
    icon: "account-remove",
    accent: C.elimination,
    minimal: true,
  },
  shrink: {
    label: "Shrink!",
    icon: "arrow-collapse-all",
    accent: C.shrinkWarning,
  },
  round_summary: {
    label: "Round Over",
    icon: "clipboard-text",
    accent: C.accent,
  },
  match_end: {
    label: "Game Over",
    icon: "trophy",
    accent: C.gold,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

function useArenaLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const topReserve = insets.top + 120; // extra space to clear HUD + resign button
  const bottomReserve = insets.bottom + 120;
  const vertAvailable = height - topReserve - bottomReserve;
  const horzAvailable = width - 20;

  const arenaSize = Math.max(200, Math.min(horzAvailable, vertAvailable));
  const penguinR = Math.max(
    14,
    Math.round(
      (SRV.PENGUIN_RADIUS / SRV.ARENA_BASE_HALF_SIDE) * (arenaSize / 2),
    ),
  );

  return { arenaSize, penguinR };
}

/** Detect body velocity-change impacts for visual feedback. */
interface ImpactEvent {
  x: number;
  y: number;
  intensity: number; // 0–1
}

function useImpactDetection(
  bodies: KnockoutBodyState[],
  phase: KnockoutPhase,
): ImpactEvent[] {
  const prevRef = useRef<Map<string, { vx: number; vy: number }>>(new Map());
  const [impacts, setImpacts] = useState<ImpactEvent[]>([]);

  useEffect(() => {
    if (phase !== "simulation" && phase !== "settle") {
      prevRef.current.clear();
      setImpacts([]);
      return;
    }

    const prev = prevRef.current;
    const fresh: ImpactEvent[] = [];

    for (const b of bodies) {
      if (!b.alive) continue;
      const p = prev.get(b.uid);
      if (p) {
        const dvx = b.vx - p.vx;
        const dvy = b.vy - p.vy;
        const delta = Math.sqrt(dvx * dvx + dvy * dvy);
        if (delta > 0.15) {
          fresh.push({
            x: b.x,
            y: b.y,
            intensity: Math.min(1, delta / 0.8),
          });
        }
      }
      prev.set(b.uid, { vx: b.vx, vy: b.vy });
    }

    if (fresh.length > 0) {
      setImpacts(fresh);
      const maxI = Math.max(...fresh.map((i) => i.intensity));
      if (maxI > 0.6) haptics.heavy();
      else if (maxI > 0.3) haptics.medium();
      else haptics.light();
      const t = setTimeout(() => setImpacts([]), 250);
      return () => clearTimeout(t);
    }
  }, [bodies, phase]);

  return impacts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Phase HUD ────────────────────────────────────────────────────────────────

function PhaseHUD({
  phase,
  roundNumber,
  aliveCount,
  totalPlayers,
  planningEndsAt,
  shrinkStage,
}: {
  phase: KnockoutPhase;
  roundNumber: number;
  aliveCount: number;
  totalPlayers: number;
  planningEndsAt: number;
  shrinkStage: number;
}) {
  const cfg = PHASE_CFG[phase];
  const [timeLeft, setTimeLeft] = useState(0);

  // Timer tick
  useEffect(() => {
    if (phase !== "planning" && phase !== "locked_countdown") {
      setTimeLeft(0);
      return;
    }
    const tick = () => {
      setTimeLeft(Math.max(0, Math.ceil((planningEndsAt - Date.now()) / 1000)));
    };
    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, [phase, planningEndsAt]);

  // Fade-in on phase change
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [phase, fadeAnim]);

  const showTimer = phase === "planning" || phase === "locked_countdown";
  const urgent = timeLeft > 0 && timeLeft <= 3;
  const timerColor = urgent ? C.elimination : C.text;

  return (
    <View style={s.hud} accessibilityRole="header">
      <View style={s.hudRow}>
        {/* Round pill */}
        <View style={s.hudPill}>
          <Text style={s.hudPillLabel}>R{roundNumber}</Text>
        </View>

        {/* Phase chip */}
        <Animated.View
          style={[
            s.hudPhaseChip,
            { opacity: fadeAnim, borderColor: cfg.accent + "30" },
          ]}
        >
          <MaterialCommunityIcons
            name={cfg.icon as any}
            size={14}
            color={cfg.accent}
          />
          <Text
            style={[s.hudPhaseLabel, { color: cfg.accent }]}
            accessibilityLabel={`Phase: ${cfg.label}`}
          >
            {cfg.label}
          </Text>
        </Animated.View>

        {/* Alive pill */}
        <View style={s.hudPill}>
          <MaterialCommunityIcons
            name="penguin"
            size={12}
            color={C.textSecondary}
          />
          <Text style={s.hudPillLabel}>
            {aliveCount}/{totalPlayers}
          </Text>
        </View>

        {/* Shrink badge */}
        {shrinkStage > 0 && (
          <View style={[s.hudPill, s.hudShrinkPill]}>
            <MaterialCommunityIcons
              name="arrow-collapse-all"
              size={11}
              color={C.warning}
            />
            <Text style={[s.hudPillLabel, { color: C.warning }]}>
              ×{shrinkStage}
            </Text>
          </View>
        )}
      </View>

      {/* Timer */}
      {showTimer && (
        <View style={s.hudTimerRow}>
          <Animated.Text
            style={[
              s.hudTimer,
              { color: timerColor, opacity: fadeAnim },
              urgent && s.hudTimerUrgent,
            ]}
            accessibilityLabel={`${timeLeft} seconds remaining`}
          >
            {timeLeft}
          </Animated.Text>
          <View style={s.timerTrack}>
            <View
              style={[
                s.timerFill,
                {
                  width: `${Math.min(100, (timeLeft / 10) * 100)}%`,
                  backgroundColor: urgent ? C.elimination : C.accent,
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Impact Burst ─────────────────────────────────────────────────────────────

function ImpactBurst({
  x,
  y,
  intensity,
  arenaSize,
}: {
  x: number;
  y: number;
  intensity: number;
  arenaSize: number;
}) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1 + intensity * 0.6,
        duration: 200 + intensity * 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250 + intensity * 100,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity, intensity]);

  const half = arenaSize / 2;
  const px = (x - SRV.ARENA_CENTER) * arenaSize + half;
  const py = (y - SRV.ARENA_CENTER) * arenaSize + half;
  const sz = 16 + intensity * 24;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.impactBurst,
        {
          left: px - sz / 2,
          top: py - sz / 2,
          width: sz,
          height: sz,
          borderRadius: sz / 2,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

// ─── Phase Overlay (round intro + match end) ──────────────────────────────────

function PhaseOverlay({
  phase,
  roundNumber,
  stats,
  myUid,
  nameMap,
  colorMap,
}: {
  phase: KnockoutPhase;
  roundNumber: number;
  stats: Record<string, KnockoutPlayerStats>;
  myUid: string;
  nameMap: Record<string, string>;
  colorMap: Record<string, string>;
}) {
  const overlayOp = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const [visible, setVisible] = useState(false);
  const prevRef = useRef(phase);

  const show = phase === "round_intro" || phase === "match_end";

  useEffect(() => {
    if (show && phase !== prevRef.current) {
      setVisible(true);
      overlayOp.setValue(0);
      cardScale.setValue(0.85);
      Animated.parallel([
        Animated.timing(overlayOp, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!show && visible) {
      Animated.timing(overlayOp, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
    prevRef.current = phase;
  }, [phase, show, visible, overlayOp, cardScale]);

  if (!visible && !show) return null;

  // ── Match End ──
  if (phase === "match_end") {
    const sorted = Object.entries(stats).sort(
      (a, b) => a[1].placement - b[1].placement,
    );
    const winnerId = sorted[0]?.[0];

    return (
      <Animated.View style={[s.phaseOverlay, { opacity: overlayOp }]}>
        <Animated.View
          style={[s.matchEndCard, { transform: [{ scale: cardScale }] }]}
          accessibilityRole="alert"
        >
          <View style={s.matchEndTrophy}>
            <Text style={s.matchEndTrophyEmoji}>🏆</Text>
          </View>
          <Text style={s.matchEndTitle}>GAME OVER</Text>
          {winnerId && (
            <Text style={s.matchEndWinner}>
              {winnerId === myUid
                ? "You Win!"
                : `${nameMap[winnerId] ?? "Player"} Wins!`}
            </Text>
          )}
          <View style={s.matchEndPlacements}>
            {sorted.slice(0, 6).map(([uid, st]) => (
              <View
                key={uid}
                style={[s.matchEndRow, uid === myUid && s.matchEndRowMe]}
              >
                <Text style={s.matchEndPlace}>
                  {st.placement === 1 ? "👑" : `#${st.placement}`}
                </Text>
                <View
                  style={[
                    s.matchEndDot,
                    { backgroundColor: colorMap[uid] ?? C.textDim },
                  ]}
                />
                <Text style={s.matchEndName} numberOfLines={1}>
                  {nameMap[uid] ?? uid}
                  {uid === myUid ? " (you)" : ""}
                </Text>
                {st.knockouts > 0 && (
                  <Text style={s.matchEndKO}>{st.knockouts} KO</Text>
                )}
              </View>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    );
  }

  // ── Round Intro ──
  if (phase === "round_intro") {
    return (
      <Animated.View
        style={[s.phaseOverlay, { opacity: overlayOp }]}
        pointerEvents="none"
        accessibilityRole="alert"
        accessibilityLabel={`Round ${roundNumber}`}
      >
        <Animated.View
          style={[s.roundIntroCard, { transform: [{ scale: cardScale }] }]}
        >
          <Text style={s.roundIntroLabel}>ROUND</Text>
          <Text style={s.roundIntroNumber}>{roundNumber}</Text>
        </Animated.View>
      </Animated.View>
    );
  }

  return null;
}

// ─── Reveal Flash ─────────────────────────────────────────────────────────────

function RevealFlash({ phase }: { phase: KnockoutPhase }) {
  const op = useRef(new Animated.Value(0)).current;
  const prev = useRef(phase);

  useEffect(() => {
    if (phase === "reveal" && prev.current !== "reveal") {
      haptics.heavy();
      op.setValue(0.25);
      Animated.timing(op, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    prev.current = phase;
  }, [phase, op]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: C.gold, opacity: op },
      ]}
    />
  );
}

// ─── Round Summary Card ───────────────────────────────────────────────────────

function RoundSummaryCard({
  roundNumber,
  summary,
  nameMap,
  colorMap,
  myUid,
}: {
  roundNumber: number;
  summary: KnockoutRoundSummary;
  nameMap: Record<string, string>;
  colorMap: Record<string, string>;
  myUid: string;
}) {
  const slideY = useRef(new Animated.Value(80)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        friction: 10,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(op, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideY, op]);

  return (
    <Animated.View
      style={[
        s.summaryCard,
        { opacity: op, transform: [{ translateY: slideY }] },
      ]}
      accessibilityRole="alert"
    >
      <Text style={s.summaryTitle}>Round {roundNumber}</Text>

      {summary.eliminations.length === 0 ? (
        <Text style={s.summaryNone}>No eliminations</Text>
      ) : (
        summary.eliminations.map((e, i) => {
          const victim = nameMap[e.uid] ?? "Player";
          const killer = e.killerUid
            ? (nameMap[e.killerUid] ?? "Player")
            : null;
          const isMe = e.uid === myUid;
          return (
            <View key={i} style={s.summaryElimRow}>
              <View
                style={[
                  s.summaryDot,
                  { backgroundColor: colorMap[e.uid] ?? C.textDim },
                ]}
              />
              <Text
                style={[s.summaryElimText, isMe && { color: C.elimination }]}
              >
                {isMe ? "You" : victim}
                {killer
                  ? ` knocked out by ${e.killerUid === myUid ? "you" : killer}`
                  : " fell off"}
              </Text>
            </View>
          );
        })
      )}

      <View style={s.summaryFooter}>
        <MaterialCommunityIcons name="penguin" size={14} color={C.accent} />
        <Text style={s.summaryAlive}>{summary.aliveCount} remaining</Text>
      </View>
    </Animated.View>
  );
}

// ─── Eliminated Banner ────────────────────────────────────────────────────────

function EliminatedBanner({
  placement,
  bottom,
}: {
  placement: number | string;
  bottom: number;
}) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [op]);

  return (
    <Animated.View
      style={[s.elimBanner, { opacity: op, bottom }]}
      pointerEvents="none"
      accessibilityRole="alert"
    >
      <MaterialCommunityIcons
        name="eye-outline"
        size={16}
        color={C.textSecondary}
      />
      <Text style={s.elimText}>Eliminated · #{placement}</Text>
      <Text style={s.elimSub}>Spectating</Text>
    </Animated.View>
  );
}

// ─── Shrink Warning ───────────────────────────────────────────────────────────

function ShrinkWarning({ phase }: { phase: KnockoutPhase }) {
  const op = useRef(new Animated.Value(0)).current;
  const prev = useRef(phase);

  useEffect(() => {
    if (phase === "shrink" && prev.current !== "shrink") {
      haptics.warning();
      op.setValue(1);
      Animated.timing(op, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    prev.current = phase;
  }, [phase, op]);

  return (
    <Animated.View pointerEvents="none" style={[s.shrinkWrap, { opacity: op }]}>
      <View style={s.shrinkPill}>
        <MaterialCommunityIcons
          name="arrow-collapse-all"
          size={16}
          color={C.warning}
        />
        <Text style={s.shrinkLabel}>Ice Shrinking!</Text>
      </View>
    </Animated.View>
  );
}

// ─── Planning Controls ────────────────────────────────────────────────────────

function PlanningControls({
  aimDir,
  isLocked,
  onReady,
  onCancel,
  insetBottom,
}: {
  aimDir: { dx: number; dy: number; power: number } | null;
  isLocked: boolean;
  onReady: () => void;
  onCancel: () => void;
  insetBottom: number;
}) {
  const powerPct = aimDir ? Math.round(aimDir.power * 100) : 0;
  const hint = aimDir
    ? isLocked
      ? "Locked in — waiting for others"
      : `Power: ${powerPct}% · Tap Ready to lock`
    : "Drag anywhere to aim";

  return (
    <View style={[s.controls, { paddingBottom: insetBottom + 12 }]}>
      <Text style={s.ctrlHint}>{hint}</Text>
      <View style={s.ctrlRow}>
        {/* Reset */}
        <Pressable
          style={({ pressed }) => [
            s.ctrlBtn,
            s.ctrlBtnGhost,
            pressed && { backgroundColor: C.btnGhostPressed },
            (isLocked || !aimDir) && s.ctrlBtnDisabled,
          ]}
          onPress={onCancel}
          disabled={isLocked || !aimDir}
          accessibilityLabel="Reset aim direction"
        >
          <MaterialCommunityIcons
            name="undo"
            size={18}
            color={isLocked || !aimDir ? C.textDim : C.textSecondary}
          />
          <Text
            style={[s.ctrlLabel, (isLocked || !aimDir) && { color: C.textDim }]}
          >
            Reset
          </Text>
        </Pressable>

        {/* Ready / Locked */}
        <Pressable
          style={({ pressed }) => [
            s.ctrlBtn,
            s.ctrlBtnPrimary,
            pressed && !isLocked && { backgroundColor: C.btnPrimaryPressed },
            isLocked && s.ctrlBtnLocked,
            !aimDir && !isLocked && s.ctrlBtnDisabled,
          ]}
          onPress={onReady}
          disabled={isLocked || !aimDir}
          accessibilityLabel={isLocked ? "Move is locked" : "Lock your move"}
        >
          <MaterialCommunityIcons
            name={isLocked ? "check-circle" : "lock"}
            size={20}
            color={isLocked ? C.success : "#fff"}
          />
          <Text
            style={[
              s.ctrlLabel,
              s.ctrlLabelPrimary,
              isLocked && { color: C.success },
            ]}
          >
            {isLocked ? "Locked" : "Ready"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Stats Strip ──────────────────────────────────────────────────────────────

function StatsStrip({
  stats,
  myUid,
  nameMap,
  colorMap,
  bottom,
}: {
  stats: Record<string, KnockoutPlayerStats>;
  myUid: string;
  nameMap: Record<string, string>;
  colorMap: Record<string, string>;
  bottom: number;
}) {
  const sorted = useMemo(
    () =>
      Object.entries(stats).sort((a, b) => {
        if (a[1].alive !== b[1].alive) return a[1].alive ? -1 : 1;
        return b[1].knockouts - a[1].knockouts;
      }),
    [stats],
  );

  return (
    <View style={[s.statsStrip, { paddingBottom: bottom + 8 }]}>
      {sorted.slice(0, 8).map(([uid, st]) => (
        <View
          key={uid}
          style={[
            s.statChip,
            !st.alive && s.statChipDead,
            uid === myUid && s.statChipMe,
          ]}
          accessibilityLabel={`${nameMap[uid] ?? uid}: ${st.knockouts} knockouts${st.alive ? "" : ", eliminated"}`}
        >
          <View
            style={[s.statDot, { backgroundColor: colorMap[uid] ?? C.textDim }]}
          />
          <Text style={s.statName} numberOfLines={1}>
            {(nameMap[uid] ?? uid).split(" ")[0]}
          </Text>
          {st.knockouts > 0 && <Text style={s.statKO}>{st.knockouts}</Text>}
        </View>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function KnockoutUI({ myUid, sessionId }: GameShellProps) {
  const { theme: _theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { arenaSize, penguinR } = useArenaLayout();
  const half = arenaSize / 2;

  // ── Auth token ──────────────────────────────────────────────────
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

  // ── Realtime room ───────────────────────────────────────────────
  const {
    room,
    connectionStatus,
    gameState,
    send,
    leave,
    error: connError,
  } = useRealtimeRoom<KnockoutRealtimeState>(KNOCKOUT_CLIENT_DEF, {
    sessionId,
    uid: myUid,
    displayName: currentFirebaseUser?.displayName ?? "Player",
    token: authToken,
    autoConnect: !!authToken,
  });

  // ── Derived state ───────────────────────────────────────────────
  const gs = gameState;
  const phase = (gs?.knockoutPhase ?? "waiting") as KnockoutPhase;
  const roundNumber = gs?.roundNumber ?? 0;
  const planningEndsAt = gs?.planningEndsAt ?? 0;
  const shrinkStage = gs?.shrinkStage ?? 0;
  const arenaHalfSide = gs?.arenaHalfSide ?? SRV.ARENA_BASE_HALF_SIDE;
  const aliveCount = gs?.aliveCount ?? 0;
  const bodies: KnockoutBodyState[] = gs?.bodies ?? [];
  const revealedMoves: KnockoutRevealedMove[] = gs?.revealedMoves ?? [];
  const roundSummary: KnockoutRoundSummary | undefined =
    gs?.roundSummary ?? undefined;
  const stats: Record<string, KnockoutPlayerStats> = gs?.stats ?? {};
  const myMove = gs?.myMove ?? null;
  const roomPlayers = gs?.players ?? [];

  const totalPlayers = useMemo(
    () =>
      roomPlayers.filter((p: any) => !p.isSpectator).length || bodies.length,
    [roomPlayers, bodies],
  );

  // ── Impact detection ────────────────────────────────────────────
  const impacts = useImpactDetection(bodies, phase);

  // ── Player maps ─────────────────────────────────────────────────
  const colorMap = useMemo(() => {
    const m: Record<string, string> = {};
    const uids =
      bodies.length > 0
        ? bodies.map((b) => b.uid)
        : roomPlayers.filter((p: any) => !p.isSpectator).map((p: any) => p.uid);
    uids.forEach((uid: string, i: number) => {
      m[uid] = PLAYER_COLORS[i % PLAYER_COLORS.length];
    });
    return m;
  }, [bodies, roomPlayers]);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of roomPlayers) {
      m[(p as any).uid] = (p as any).displayName;
    }
    return m;
  }, [roomPlayers]);

  // ── Player status ───────────────────────────────────────────────
  const myBody = useMemo(
    () => bodies.find((b) => b.uid === myUid),
    [bodies, myUid],
  );
  const amAlive = myBody?.alive ?? false;

  // ── Aim state ───────────────────────────────────────────────────
  const [aimDir, setAimDir] = useState<{
    dx: number;
    dy: number;
    power: number;
  } | null>(
    myMove ? { dx: myMove.dx, dy: myMove.dy, power: myMove.power } : null,
  );
  const [isLocked, setIsLocked] = useState(myMove?.locked ?? false);
  const aimStartRef = useRef<{ x: number; y: number } | null>(null);

  // Max drag distance in px that maps to power=1
  const MAX_DRAG_PX = arenaSize * 0.3;
  // Min drag distance in px for a valid aim
  const MIN_DRAG_PX = 8;

  useEffect(() => {
    if (myMove) {
      setAimDir({ dx: myMove.dx, dy: myMove.dy, power: myMove.power });
      setIsLocked(myMove.locked);
    }
  }, [myMove]);

  useEffect(() => {
    if (phase === "planning") {
      setAimDir(null);
      setIsLocked(false);
    }
  }, [phase, roundNumber]);

  // ── Room message handlers ───────────────────────────────────────
  useEffect(() => {
    if (!room) return;

    room.onMessage("match_end", () => {
      haptics.success();
      leave();
    });
    room.onMessage("eliminations", () => haptics.medium());
    room.onMessage("arena_shrink", () => haptics.light());
    room.onMessage("reaction_event", () => haptics.selection());
    room.onMessage("shrink_warning", () => haptics.warning());

    return () => {};
  }, [room, leave]);

  // ── Coordinate mapping ──────────────────────────────────────────
  // The arena is a square: half-side in normalized coords mapped to pixels
  const arenaHalfSidePx =
    (arenaHalfSide / SRV.ARENA_BASE_HALF_SIDE) * half * 0.92;

  const toScreenX = useCallback(
    (sx: number) => (sx - SRV.ARENA_CENTER) * arenaSize + half,
    [arenaSize, half],
  );
  const toScreenY = useCallback(
    (sy: number) => (sy - SRV.ARENA_CENTER) * arenaSize + half,
    [arenaSize, half],
  );

  // ── Body interpolation (InterpolationBuffer for 60fps from 15Hz server) ──
  const bodyRefs = useRef<
    Map<string, { x: Animated.Value; y: Animated.Value }>
  >(new Map());
  const bodyInterpRef = useRef<Map<string, InterpolationBuffer>>(new Map());

  // Cache layout values for RAF (avoid stale closures)
  const arenaSizeRef = useRef(arenaSize);
  arenaSizeRef.current = arenaSize;
  const halfRef = useRef(half);
  halfRef.current = half;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Push server body state into interpolation buffers
  useEffect(() => {
    const isSimPhase =
      phase === "simulation" || phase === "settle" || phase === "resolve_elims";

    for (const body of bodies) {
      // Ensure Animated.Value refs exist
      let r = bodyRefs.current.get(body.uid);
      if (!r) {
        r = {
          x: new Animated.Value(toScreenX(body.x)),
          y: new Animated.Value(toScreenY(body.y)),
        };
        bodyRefs.current.set(body.uid, r);
      }

      // Ensure InterpolationBuffer exists
      let buf = bodyInterpRef.current.get(body.uid);
      if (!buf) {
        buf = new InterpolationBuffer({
          renderDelayMs: 70, // ~1 server tick at 15Hz (66ms)
          maxExtrapolateMs: 150,
          correctionAlpha: 0.4,
        });
        bodyInterpRef.current.set(body.uid, buf);
      }

      if (isSimPhase) {
        // During simulation, push snapshots for smooth interpolation
        buf.push({ x: body.x, y: body.y, vx: body.vx, vy: body.vy });
      } else {
        // During calm phases, snap directly (no interpolation needed)
        buf.reset(body.x, body.y);
        r.x.setValue(toScreenX(body.x));
        r.y.setValue(toScreenY(body.y));
      }
    }
  }, [bodies, phase, toScreenX, toScreenY]);

  // RAF loop — drives body Animated.Values at 60fps during simulation
  useEffect(() => {
    const loop = createFrameLoop(() => {
      const p = phaseRef.current;
      const isSim =
        p === "simulation" || p === "settle" || p === "resolve_elims";
      if (!isSim) return;

      const sz = arenaSizeRef.current;
      const h = halfRef.current;

      bodyInterpRef.current.forEach((buf, uid) => {
        const r = bodyRefs.current.get(uid);
        if (!r) return;
        const sample = buf.sample();
        r.x.setValue((sample.x - SRV.ARENA_CENTER) * sz + h);
        r.y.setValue((sample.y - SRV.ARENA_CENTER) * sz + h);
      });
    });

    loop.start();
    return () => loop.stop();
  }, []);

  // ── Touch handlers ──────────────────────────────────────────────
  const canAim = phase === "planning" && amAlive && !isLocked;

  const handleTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      if (!canAim || !myBody) return;
      aimStartRef.current = {
        x: e.nativeEvent.locationX,
        y: e.nativeEvent.locationY,
      };
    },
    [canAim, myBody],
  );

  const handleTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      if (!canAim || !aimStartRef.current || !myBody) return;
      const dx = e.nativeEvent.locationX - aimStartRef.current.x;
      const dy = e.nativeEvent.locationY - aimStartRef.current.y;
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag < MIN_DRAG_PX) return;

      // Direction from drag vector
      const ndx = dx / mag;
      const ndy = dy / mag;

      // Power from drag distance (clamped 0..1)
      const power = Math.min(1, Math.max(0, mag / MAX_DRAG_PX));

      setAimDir({ dx: ndx, dy: ndy, power });
      send("submit_move", { dx: ndx, dy: ndy, power });
      haptics.selection();
    },
    [canAim, myBody, send, MAX_DRAG_PX],
  );

  const handleTouchEnd = useCallback(() => {
    aimStartRef.current = null;
  }, []);

  // ── Action handlers ─────────────────────────────────────────────
  const handleReady = useCallback(() => {
    if (!aimDir || isLocked) return;
    send("lock_move", {});
    setIsLocked(true);
    haptics.medium();
  }, [aimDir, isLocked, send]);

  const handleCancel = useCallback(() => {
    if (isLocked) return;
    send("cancel_move", {});
    setAimDir(null);
    haptics.light();
  }, [isLocked, send]);

  // ── Render helpers (must be before early returns to keep hook order stable) ──
  const arrowPhases: KnockoutPhase[] = ["reveal", "simulation", "settle"];
  const showArrows = arrowPhases.includes(phase);
  const simActive =
    phase === "simulation" || phase === "settle" || phase === "resolve_elims";
  const calmPhase =
    phase === "planning" || phase === "round_intro" || phase === "waiting";

  // Edge danger for local player (square arena)
  const edgeDanger = useMemo(() => {
    if (!myBody || !myBody.alive) return 0;
    const dxEdge = arenaHalfSide - Math.abs(myBody.x - SRV.ARENA_CENTER);
    const dyEdge = arenaHalfSide - Math.abs(myBody.y - SRV.ARENA_CENTER);
    const gap = Math.min(dxEdge, dyEdge) - SRV.PENGUIN_RADIUS;
    if (gap < 0.04) return 1;
    if (gap < 0.08) return 0.5;
    return 0;
  }, [myBody, arenaHalfSide]);

  // ── Connection states ───────────────────────────────────────────
  if (
    connectionStatus === "connecting" ||
    connectionStatus === "idle" ||
    connectionStatus === "reconnecting"
  ) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.connectCenter}>
          <View style={s.connectIcon}>
            <MaterialCommunityIcons name="penguin" size={40} color={C.accent} />
          </View>
          <Text style={s.connectTitle}>
            {connectionStatus === "reconnecting"
              ? "Reconnecting…"
              : "Connecting…"}
          </Text>
          <Text style={s.connectSub}>Setting up the ice</Text>
        </View>
      </View>
    );
  }

  if (connError) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.connectCenter}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={40}
            color={C.elimination}
          />
          <Text style={s.connectTitle}>Connection Error</Text>
          <Text style={s.connectSub}>{connError}</Text>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* ── HUD ──────────────────────────────────────────────── */}
      <PhaseHUD
        phase={phase}
        roundNumber={roundNumber}
        aliveCount={aliveCount}
        totalPlayers={totalPlayers}
        planningEndsAt={planningEndsAt}
        shrinkStage={shrinkStage}
      />

      {/* ── Arena ────────────────────────────────────────────── */}
      <View
        style={[s.arenaOuter, { width: arenaSize, height: arenaSize }]}
        onStartShouldSetResponder={() => canAim}
        onMoveShouldSetResponder={() => canAim}
        onResponderGrant={handleTouchStart}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
        accessibilityLabel="Game arena"
      >
        {/* Ocean water background */}
        <View style={s.waterBg}>
          <View
            style={[
              s.waterGlowRing,
              {
                width: arenaHalfSidePx * 2 + 20,
                height: arenaHalfSidePx * 2 + 20,
                borderRadius: 8,
                left: half - arenaHalfSidePx - 10,
                top: half - arenaHalfSidePx - 10,
              },
            ]}
          />
        </View>

        {/* Danger band (square) */}
        <View
          style={[
            s.dangerBand,
            {
              width: arenaHalfSidePx * 2 + 12,
              height: arenaHalfSidePx * 2 + 12,
              borderRadius: 6,
              left: half - arenaHalfSidePx - 6,
              top: half - arenaHalfSidePx - 6,
              borderColor:
                shrinkStage > 0
                  ? `rgba(255,82,82,${0.15 + shrinkStage * 0.08})`
                  : "rgba(255,255,255,0.06)",
              borderWidth: shrinkStage > 0 ? 2 : 1,
            },
          ]}
        />

        {/* Square ice platform */}
        <View
          style={[
            s.icePlatform,
            {
              width: arenaHalfSidePx * 2,
              height: arenaHalfSidePx * 2,
              borderRadius: 6,
              left: half - arenaHalfSidePx,
              top: half - arenaHalfSidePx,
              overflow: "hidden" as const,
            },
          ]}
        >
          <LinearGradient
            colors={[C.iceLight, C.iceMid, C.iceDark]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Sheen */}
          <View style={s.iceSheen} />
          {/* Center dot */}
          <View style={s.iceCenterDot} />
        </View>

        {/* Edge danger pulse (near-edge warning — square) */}
        {edgeDanger > 0 && simActive && (
          <View
            style={[
              s.edgePulse,
              {
                width: arenaHalfSidePx * 2,
                height: arenaHalfSidePx * 2,
                borderRadius: 6,
                left: half - arenaHalfSidePx,
                top: half - arenaHalfSidePx,
                borderColor: `rgba(255,82,82,${edgeDanger * 0.5})`,
                borderWidth: edgeDanger > 0.7 ? 3 : 2,
              },
            ]}
          />
        )}

        {/* Revealed move arrows (properly centered on penguin for correct rotation) */}
        {showArrows &&
          revealedMoves.map((mv: KnockoutRevealedMove) => {
            const b = bodies.find((x) => x.uid === mv.uid);
            if (!b || !b.alive) return null;
            const sx = toScreenX(b.x);
            const sy = toScreenY(b.y);
            const angle = Math.atan2(mv.dy, mv.dx);
            const col = colorMap[mv.uid] ?? C.accent;
            // Arrow length reflects power
            const minLen = penguinR * 1.3;
            const maxLen = penguinR * 3.5;
            const shaftLen = minLen + (mv.power ?? 1) * (maxLen - minLen);
            const headW = 8;
            const headH = 10;
            const shaftH = 3 + (mv.power ?? 1) * 2;
            // Container wide enough that center = penguin center
            const containerW = (shaftLen + headW) * 2;
            const containerH = Math.max(headH, shaftH) + 4;

            return (
              <View
                key={`arr-${mv.uid}`}
                pointerEvents="none"
                style={[
                  s.arrowContainer,
                  {
                    left: sx - containerW / 2,
                    top: sy - containerH / 2,
                    width: containerW,
                    height: containerH,
                    transform: [{ rotate: `${angle}rad` }],
                  },
                ]}
              >
                <View
                  style={[
                    s.arrowShaft,
                    {
                      position: "absolute",
                      left: containerW / 2,
                      top: (containerH - shaftH) / 2,
                      width: shaftLen,
                      height: shaftH,
                      borderRadius: shaftH / 2,
                      backgroundColor: col,
                    },
                  ]}
                />
                <View
                  style={[
                    s.arrowHead,
                    {
                      position: "absolute",
                      left: containerW / 2 + shaftLen - 1,
                      top: (containerH - headH) / 2,
                      borderLeftWidth: headW,
                      borderTopWidth: headH / 2,
                      borderBottomWidth: headH / 2,
                      borderLeftColor: col,
                    },
                  ]}
                />
              </View>
            );
          })}

        {/* My aim arrow (planning) — power-aware, pivots around penguin */}
        {phase === "planning" &&
          aimDir &&
          myBody &&
          (() => {
            const sx = toScreenX(myBody.x);
            const sy = toScreenY(myBody.y);
            const angle = Math.atan2(aimDir.dy, aimDir.dx);
            const power = aimDir.power;

            // Shaft length and thickness scale with power
            const minLen = penguinR * 1.3;
            const maxLen = penguinR * 3.5;
            const shaftLen = minLen + power * (maxLen - minLen);
            const headW = 9;
            const headH = 12;
            const shaftH = 3 + power * 3;

            // Color interpolation: cool blue → orange → red
            const r = Math.round(79 + power * (255 - 79));
            const g = Math.round(195 + power * (82 - 195));
            const b_ = Math.round(247 + power * (82 - 247));
            const powerColor = isLocked ? C.success : `rgb(${r},${g},${b_})`;

            const containerW = (shaftLen + headW) * 2;
            const containerH = Math.max(headH, shaftH) + 6;

            return (
              <View
                pointerEvents="none"
                style={[
                  s.arrowContainer,
                  {
                    left: sx - containerW / 2,
                    top: sy - containerH / 2,
                    width: containerW,
                    height: containerH,
                    transform: [{ rotate: `${angle}rad` }],
                  },
                ]}
              >
                <View
                  style={[
                    s.arrowShaft,
                    s.aimShaft,
                    {
                      position: "absolute",
                      left: containerW / 2,
                      top: (containerH - shaftH) / 2,
                      width: shaftLen,
                      height: shaftH,
                      borderRadius: shaftH / 2,
                      backgroundColor: powerColor,
                    },
                  ]}
                />
                <View
                  style={[
                    s.arrowHead,
                    {
                      position: "absolute",
                      left: containerW / 2 + shaftLen - 1,
                      top: (containerH - headH) / 2,
                      borderLeftWidth: headW,
                      borderTopWidth: headH / 2,
                      borderBottomWidth: headH / 2,
                      borderLeftColor: powerColor,
                    },
                  ]}
                />
              </View>
            );
          })()}

        {/* Penguin bodies */}
        {bodies.map((body) => {
          if (!body.alive) return null;
          const ref = bodyRefs.current.get(body.uid);
          const col = colorMap[body.uid] ?? PLAYER_COLORS[0];
          const isMe = body.uid === myUid;
          const firstName = (nameMap[body.uid] ?? "").split(" ")[0];
          const showName = calmPhase && firstName.length > 0;
          const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
          const motionGlow = speed > 0.15 && simActive;
          const diameter = penguinR * 2;

          const inner = (
            <>
              {/* Color ring outline */}
              <View
                style={[
                  s.penguinRing,
                  {
                    width: diameter,
                    height: diameter,
                    borderRadius: penguinR,
                    borderColor: col,
                    borderWidth: isMe ? 2.5 : 1.5,
                  },
                ]}
              />
              {/* Tinted fill */}
              <View
                style={[
                  s.penguinFill,
                  {
                    width: diameter - 4,
                    height: diameter - 4,
                    borderRadius: penguinR - 2,
                    backgroundColor: col + "30",
                  },
                ]}
              />
              {/* Emoji */}
              <Text
                style={[
                  s.penguinEmoji,
                  { fontSize: Math.max(12, penguinR * 0.9) },
                ]}
              >
                🐧
              </Text>
              {/* Local indicator dot */}
              {isMe && (
                <View style={[s.localDot, { backgroundColor: C.localRing }]} />
              )}
              {/* Name tag */}
              {showName && (
                <View style={[s.nameTag, { backgroundColor: col + "CC" }]}>
                  <Text style={s.nameText} numberOfLines={1}>
                    {isMe ? "You" : firstName}
                  </Text>
                </View>
              )}
              {/* Motion blur/glow */}
              {motionGlow && (
                <View
                  style={[
                    s.motionGlow,
                    {
                      width: penguinR * 3,
                      height: penguinR * 3,
                      borderRadius: penguinR * 1.5,
                      backgroundColor: col + "15",
                    },
                  ]}
                />
              )}
            </>
          );

          if (ref) {
            return (
              <Animated.View
                key={body.uid}
                style={[
                  s.penguin,
                  {
                    width: diameter,
                    height: diameter,
                    borderRadius: penguinR,
                    transform: [
                      {
                        translateX: Animated.subtract(
                          ref.x,
                          new Animated.Value(penguinR),
                        ),
                      },
                      {
                        translateY: Animated.subtract(
                          ref.y,
                          new Animated.Value(penguinR),
                        ),
                      },
                    ],
                  },
                ]}
                accessibilityLabel={`${nameMap[body.uid] ?? "Player"}${isMe ? " (you)" : ""}`}
              >
                {inner}
              </Animated.View>
            );
          }

          const sx = toScreenX(body.x);
          const sy = toScreenY(body.y);
          return (
            <View
              key={body.uid}
              style={[
                s.penguin,
                {
                  width: diameter,
                  height: diameter,
                  borderRadius: penguinR,
                  transform: [
                    { translateX: sx - penguinR },
                    { translateY: sy - penguinR },
                  ],
                },
              ]}
            >
              {inner}
            </View>
          );
        })}

        {/* Impact bursts */}
        {impacts.map((imp, i) => (
          <ImpactBurst
            key={`imp-${i}-${imp.x.toFixed(3)}-${imp.y.toFixed(3)}`}
            x={imp.x}
            y={imp.y}
            intensity={imp.intensity}
            arenaSize={arenaSize}
          />
        ))}
      </View>

      {/* ── Overlays ─────────────────────────────────────────── */}
      <ShrinkWarning phase={phase} />
      <RevealFlash phase={phase} />

      {phase === "round_summary" && roundSummary && (
        <RoundSummaryCard
          roundNumber={roundNumber}
          summary={roundSummary}
          nameMap={nameMap}
          colorMap={colorMap}
          myUid={myUid}
        />
      )}

      <PhaseOverlay
        phase={phase}
        roundNumber={roundNumber}
        stats={stats}
        myUid={myUid}
        nameMap={nameMap}
        colorMap={colorMap}
      />

      {/* ── Eliminated banner ────────────────────────────────── */}
      {!amAlive && phase !== "waiting" && phase !== "match_end" && (
        <EliminatedBanner
          placement={stats[myUid]?.placement ?? "?"}
          bottom={insets.bottom + 120}
        />
      )}

      {/* ── Bottom planning controls ─────────────────────────── */}
      {phase === "planning" && amAlive && (
        <PlanningControls
          aimDir={aimDir}
          isLocked={isLocked}
          onReady={handleReady}
          onCancel={handleCancel}
          insetBottom={insets.bottom}
        />
      )}

      {/* ── Stats strip (non-action phases) ──────────────────── */}
      {!simActive &&
        phase !== "planning" &&
        phase !== "waiting" &&
        phase !== "match_end" &&
        phase !== "round_intro" && (
          <StatsStrip
            stats={stats}
            myUid={myUid}
            nameMap={nameMap}
            colorMap={colorMap}
            bottom={insets.bottom}
          />
        )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const SHADOW_SM = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  android: { elevation: 2 },
  default: {},
}) as Record<string, unknown>;

const SHADOW_MD = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  android: { elevation: 4 },
  default: {},
}) as Record<string, unknown>;

const s = StyleSheet.create({
  // ── Root ────────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
  },

  // ── Connection ──────────────────────────────────────────────
  connectCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  connectIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accentDim,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  connectTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: "600",
  },
  connectSub: {
    color: C.textDim,
    fontSize: 14,
  },

  // ── HUD ─────────────────────────────────────────────────────
  hud: {
    alignItems: "center",
    paddingTop: 36,
    paddingBottom: 4,
    paddingHorizontal: 12,
    gap: 4,
  },
  hudRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hudPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  hudPillLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  hudShrinkPill: {
    backgroundColor: C.warningGlow,
    borderColor: "rgba(255,167,38,0.15)",
  },
  hudPhaseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  hudPhaseLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  hudTimerRow: {
    alignItems: "center",
    gap: 4,
  },
  hudTimer: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
  },
  hudTimerUrgent: {
    ...(SHADOW_SM as any),
  },
  timerTrack: {
    width: 100,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.card,
    overflow: "hidden",
  },
  timerFill: {
    height: 3,
    borderRadius: 1.5,
  },

  // ── Arena ───────────────────────────────────────────────────
  arenaOuter: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 4,
  },
  waterBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.water,
    borderRadius: 4,
  },
  waterGlowRing: {
    position: "absolute",
    borderWidth: 1,
    borderColor: C.waterEdge,
  },
  dangerBand: {
    position: "absolute",
  },
  icePlatform: {
    position: "absolute",
    borderWidth: 1,
    borderColor: C.iceEdge,
    ...(SHADOW_MD as any),
  },
  iceSheen: {
    position: "absolute",
    top: "8%",
    left: "15%",
    width: "35%",
    height: "25%",
    borderRadius: 100,
    backgroundColor: C.iceSheen,
  },
  iceCenterDot: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 6,
    height: 6,
    marginTop: -3,
    marginLeft: -3,
    borderRadius: 3,
    backgroundColor: "rgba(200,230,255,0.10)",
  },
  edgePulse: {
    position: "absolute",
  },

  // ── Arrows ──────────────────────────────────────────────────
  arrowContainer: {
    position: "absolute",
    zIndex: 10,
  },
  arrowShaft: {
    opacity: 0.85,
  },
  aimShaft: {
    opacity: 1,
    ...(SHADOW_SM as any),
  },
  arrowHead: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderRightWidth: 0,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "transparent",
  },

  // ── Penguins ────────────────────────────────────────────────
  penguin: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  penguinRing: {
    position: "absolute",
  },
  penguinFill: {
    position: "absolute",
  },
  penguinEmoji: {
    textAlign: "center",
    zIndex: 1,
  },
  localDot: {
    position: "absolute",
    bottom: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    zIndex: 2,
  },
  nameTag: {
    position: "absolute",
    bottom: -18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    zIndex: 3,
  },
  nameText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  motionGlow: {
    position: "absolute",
    zIndex: -1,
  },

  // ── Impact bursts ──────────────────────────────────────────
  impactBurst: {
    position: "absolute",
    backgroundColor: "rgba(200,230,255,0.35)",
    zIndex: 15,
  },

  // ── Shrink warning ─────────────────────────────────────────
  shrinkWrap: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  shrinkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.warningGlow,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,167,38,0.20)",
  },
  shrinkLabel: {
    color: C.warning,
    fontSize: 14,
    fontWeight: "700",
  },

  // ── Phase overlay ──────────────────────────────────────────
  phaseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.overlay,
    zIndex: 40,
  },

  // Round intro
  roundIntroCard: {
    alignItems: "center",
    gap: 4,
  },
  roundIntroLabel: {
    color: C.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 3,
  },
  roundIntroNumber: {
    color: C.text,
    fontSize: 64,
    fontWeight: "800",
    letterSpacing: -2,
  },

  // Match end
  matchEndCard: {
    alignItems: "center",
    backgroundColor: C.cardElevated,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: C.cardBorder,
    minWidth: 260,
    maxWidth: 340,
    ...(SHADOW_MD as any),
  },
  matchEndTrophy: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.goldGlow,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  matchEndTrophyEmoji: {
    fontSize: 28,
  },
  matchEndTitle: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
  },
  matchEndWinner: {
    color: C.gold,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
    marginBottom: 16,
  },
  matchEndPlacements: {
    width: "100%",
    gap: 6,
  },
  matchEndRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  matchEndRowMe: {
    backgroundColor: C.accentDim,
  },
  matchEndPlace: {
    width: 28,
    fontSize: 14,
    fontWeight: "700",
    color: C.textSecondary,
    textAlign: "center",
  },
  matchEndDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  matchEndName: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontWeight: "600",
  },
  matchEndKO: {
    color: C.textDim,
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Round summary ──────────────────────────────────────────
  summaryCard: {
    position: "absolute",
    bottom: 130,
    left: 16,
    right: 16,
    backgroundColor: C.cardElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    zIndex: 35,
    ...(SHADOW_MD as any),
  },
  summaryTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "700",
  },
  summaryNone: {
    color: C.textDim,
    fontSize: 13,
    fontStyle: "italic",
  },
  summaryElimRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryElimText: {
    color: C.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  summaryFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
  },
  summaryAlive: {
    color: C.accent,
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Eliminated ─────────────────────────────────────────────
  elimBanner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    zIndex: 25,
  },
  elimText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  elimSub: {
    color: C.textDim,
    fontSize: 11,
  },

  // ── Planning controls ──────────────────────────────────────
  controls: {
    width: "100%",
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  ctrlHint: {
    color: C.textDim,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
  },
  ctrlRow: {
    flexDirection: "row",
    gap: 12,
  },
  ctrlBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minWidth: 110,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  ctrlBtnGhost: {
    backgroundColor: C.btnGhost,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  ctrlBtnPrimary: {
    backgroundColor: C.btnPrimary,
    minWidth: 140,
    ...(SHADOW_SM as any),
  },
  ctrlBtnLocked: {
    backgroundColor: C.successGlow,
    borderWidth: 1,
    borderColor: "rgba(102,187,106,0.3)",
  },
  ctrlBtnDisabled: {
    backgroundColor: C.btnDisabled,
    opacity: 0.5,
  },
  ctrlLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textSecondary,
  },
  ctrlLabelPrimary: {
    color: "#fff",
  },

  // ── Stats strip ────────────────────────────────────────────
  statsStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.card,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  statChipDead: {
    opacity: 0.35,
  },
  statChipMe: {
    borderColor: "rgba(255,255,255,0.12)",
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statName: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    maxWidth: 48,
  },
  statKO: {
    color: C.accent,
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 1,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default withGameV4Shell(KnockoutUI, "knockout_game");
