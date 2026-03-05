/**
 * Games V4 — Brick Breaker Screen
 *
 * Mobile-first portrait physics game with Planck engine.
 * Uses absolute-positioned RN Views driven by physics positions.
 *
 * @module gamesV4/screens/BrickBreakerScreenV4
 */

import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import { getLevelById, MAX_LEVEL } from "@/gamesV4/games/brickBreaker/levels";
import type {
  LevelSim,
  RenderState,
} from "@/gamesV4/games/brickBreaker/simCore";
import {
  createLevelSim,
  getRenderState,
  stepLevelSim,
} from "@/gamesV4/games/brickBreaker/simCore";
import type {
  BrickBreakerPublicState,
  CampaignStats,
  InputSample,
} from "@/gamesV4/games/brickBreaker/types";
import {
  ACTION_LAUNCH,
  BRICK_COLORS,
  POWERUP_COLORS,
  POWERUP_ICONS,
  SIM,
} from "@/gamesV4/games/brickBreaker/types";
import { useAppTheme } from "@/store/ThemeContext";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Constants
// =============================================================================

const SCREEN_W = Dimensions.get("window").width;

/** Darken a hex color by a factor (0–1). */
function darkenHex(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const r = Math.max(
    0,
    Math.round(parseInt(c.substring(0, 2), 16) * (1 - amount)),
  );
  const g = Math.max(
    0,
    Math.round(parseInt(c.substring(2, 4), 16) * (1 - amount)),
  );
  const b = Math.max(
    0,
    Math.round(parseInt(c.substring(4, 6), 16) * (1 - amount)),
  );
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
const FIELD_ASPECT = SIM.FIELD_W / SIM.FIELD_H;
const FIELD_PX_W = SCREEN_W - 16; // 8px padding each side
const FIELD_PX_H = FIELD_PX_W / FIELD_ASPECT;
const SCALE = FIELD_PX_W / SIM.FIELD_W;

function toScreenX(wx: number): number {
  return wx * SCALE;
}
function toScreenY(wy: number): number {
  return (SIM.FIELD_H - wy) * SCALE; // flip Y: world up → screen down
}

const BALL_PX_R = SIM.BALL_RADIUS * SCALE;
const BRICK_PX_W = SIM.BRICK_W * SCALE;
const BRICK_PX_H = SIM.BRICK_H * SCALE;
const PADDLE_PX_H = SIM.PADDLE_HH * 2 * SCALE;

// Row-based color palette for normal bricks (indexed by row 0-9)
const ROW_COLORS: string[] = [
  "#E53935", // row 0 — red
  "#FF7043", // row 1 — deep orange
  "#FFA726", // row 2 — orange
  "#FFCA28", // row 3 — amber
  "#66BB6A", // row 4 — green
  "#26A69A", // row 5 — teal
  "#42A5F5", // row 6 — blue
  "#5C6BC0", // row 7 — indigo
  "#7E57C2", // row 8 — deep purple
  "#EC407A", // row 9 — pink
];

// =============================================================================
// UI Component
// =============================================================================

function BrickBreakerUI({
  publicState,
  isTerminal,
  submitMove,
  actionLoading,
  sessionId,
}: GameShellProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  // ── Game state refs ────────────────────────────────────────────────
  const simRef = useRef<LevelSim | null>(null);
  const renderRef = useRef<RenderState | null>(null);
  const inputSamplesRef = useRef<InputSample[]>([]);
  const globalTickRef = useRef(0);
  const targetXRef = useRef(0.5);
  const runningRef = useRef(false);
  const seedRef = useRef(0);
  const startLevelRef = useRef(1);
  const runSubmittedRef = useRef(false);
  const currentLevelRef = useRef(1);
  const livesRef = useRef<number>(SIM.DEFAULT_LIVES);
  const carryStatsRef = useRef<Partial<CampaignStats>>({});
  const noMissLevelsRef = useRef<number[]>([]);

  // ── React state for rendering ──────────────────────────────────────
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [gamePhase, setGamePhase] = useState<"menu" | "playing">("menu");

  const state = publicState as unknown as BrickBreakerPublicState | null;

  // ── Initialize / Start Game ────────────────────────────────────────
  const startGame = useCallback(() => {
    const seed = Date.now();
    seedRef.current = seed;
    startLevelRef.current = 1;
    currentLevelRef.current = 1;
    livesRef.current = SIM.DEFAULT_LIVES;
    inputSamplesRef.current = [];
    globalTickRef.current = 0;
    runSubmittedRef.current = false;
    carryStatsRef.current = {};
    noMissLevelsRef.current = [];

    // Submit startRun move
    submitMove({ type: "startRun", seed, startLevelId: 1 });

    // Create first level sim
    const levelDef = getLevelById(1);
    if (!levelDef) return;
    simRef.current = createLevelSim(levelDef, seed, SIM.DEFAULT_LIVES);
    renderRef.current = getRenderState(simRef.current);
    runningRef.current = true;
    setGamePhase("playing");
  }, [submitMove]);

  // ── Advance to next level ──────────────────────────────────────────
  const advanceLevel = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;

    // Apply level clear bonus
    const lvlId = sim.levelDef.id;
    const levelTicks = sim.tick;
    const timeBonus = Math.max(0, 3000 - levelTicks);
    const livesBonus = sim.lives * 500;
    const clearBonus = 1000 * lvlId + timeBonus + livesBonus;

    if (!sim.missedThisLevel) {
      noMissLevelsRef.current.push(lvlId);
    }

    const nextLevelId = lvlId + 1;
    if (nextLevelId > MAX_LEVEL) {
      // Campaign complete
      finishRun(sim, clearBonus);
      return;
    }

    const nextLevel = getLevelById(nextLevelId);
    if (!nextLevel) {
      finishRun(sim, clearBonus);
      return;
    }

    currentLevelRef.current = nextLevelId;
    livesRef.current = sim.lives;

    const newSim = createLevelSim(nextLevel, seedRef.current, sim.lives, {
      score: sim.score + clearBonus,
      combo: sim.combo,
      maxCombo: sim.maxCombo,
      bricksDestroyed: sim.bricksDestroyed,
      powerupsUsed: sim.powerupsUsed,
      explosionKills: sim.explosionKills,
      laserKills: sim.laserKills,
      maxBallsAtOnce: sim.maxBallsAtOnce,
      missedThisLevel: false,
    });

    simRef.current = newSim;
  }, []);

  // ── Finish run ─────────────────────────────────────────────────────
  const finishRun = useCallback(
    (sim: LevelSim, bonusScore: number = 0) => {
      if (runSubmittedRef.current) return;
      runSubmittedRef.current = true;
      runningRef.current = false;

      const finalScore = sim.score + bonusScore;
      const levelsCleared =
        currentLevelRef.current -
        startLevelRef.current +
        (sim.levelCleared ? 1 : 0);

      const clientStats: CampaignStats = {
        score: finalScore,
        maxCombo: sim.maxCombo,
        bricksDestroyed: sim.bricksDestroyed,
        powerupsUsed: sim.powerupsUsed,
        levelsCleared,
        durationMs: Math.round((globalTickRef.current / 60) * 1000),
        livesRemaining: sim.lives,
        explosionBrickKills: sim.explosionKills,
        laserBrickKills: sim.laserKills,
        maxBallsAtOnce: sim.maxBallsAtOnce,
        noMissLevels: noMissLevelsRef.current,
      };

      submitMove({
        type: "finishRun",
        seed: seedRef.current,
        startLevelId: startLevelRef.current,
        endLevelId: MAX_LEVEL,
        inputHz: SIM.INPUT_HZ,
        inputSamples: inputSamplesRef.current,
        clientStats,
      });

      // Game phase stays 'playing' — the V4 shell auto-navigates to
      // GameOverV4 once the server marks the session as terminal.
    },
    [submitMove],
  );

  // ── Game loop (RAF) ────────────────────────────────────────────────
  useEffect(() => {
    let rafId: number;
    let lastTime = 0;
    let accumulator = 0;

    const loop = (time: number) => {
      if (!runningRef.current || paused) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (lastTime === 0) lastTime = time;
      const delta = Math.min((time - lastTime) / 1000, 0.1); // cap at 100ms
      lastTime = time;
      accumulator += delta;

      const sim = simRef.current;
      if (!sim) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      let stepped = false;
      while (accumulator >= SIM.DT) {
        // Record input at sample rate
        if (globalTickRef.current % SIM.TICKS_PER_SAMPLE === 0) {
          inputSamplesRef.current.push({
            tick: globalTickRef.current,
            x: Math.round(targetXRef.current * 1000) / 1000,
          });
        }

        const result = stepLevelSim(sim, targetXRef.current);
        globalTickRef.current++;
        accumulator -= SIM.DT;
        stepped = true;

        if (result.levelCleared) {
          advanceLevel();
          break;
        }
        if (result.runOver) {
          finishRun(sim);
          break;
        }
      }

      if (stepped && simRef.current) {
        renderRef.current = getRenderState(simRef.current);
        setFrame((f) => f + 1);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [paused, advanceLevel, finishRun]);

  // ── Touch input ────────────────────────────────────────────────────
  const fieldLayoutRef = useRef({ x: 0, y: 0, w: FIELD_PX_W });

  const onFieldLayout = useCallback(
    (e: {
      nativeEvent: { layout: { x: number; y: number; width: number } };
    }) => {
      const { x, y, width } = e.nativeEvent.layout;
      fieldLayoutRef.current = { x, y, w: width };
    },
    [],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          // Use pageX for consistent tracking regardless of touch origin
          const pageX = evt.nativeEvent.pageX;
          const { x: fieldX, w: fieldW } = fieldLayoutRef.current;
          const relX = pageX - fieldX;
          targetXRef.current = Math.max(0, Math.min(1, relX / fieldW));

          // Tap to launch
          const sim = simRef.current;
          if (sim?.serving) {
            inputSamplesRef.current.push({
              tick: globalTickRef.current,
              x: targetXRef.current,
              a: ACTION_LAUNCH,
            });
            stepLevelSim(sim, targetXRef.current, ACTION_LAUNCH);
          }
        },
        onPanResponderMove: (evt) => {
          const pageX = evt.nativeEvent.pageX;
          const { x: fieldX, w: fieldW } = fieldLayoutRef.current;
          const relX = pageX - fieldX;
          targetXRef.current = Math.max(0, Math.min(1, relX / fieldW));
        },
      }),
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────
  const rs = renderRef.current;
  const isDark = theme.isDark;
  const bg = isDark ? "#111" : "#1a1a2e";
  const textColor = isDark ? "#eee" : "#fff";

  // Menu screen
  if (gamePhase === "menu") {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: bg, paddingTop: insets.top },
        ]}
      >
        <View style={styles.menuContainer}>
          <Text style={[styles.titleText, { color: textColor }]}>
            🧱 Brick Breaker
          </Text>
          <Text style={[styles.subtitleText, { color: textColor + "99" }]}>
            30-level campaign • Break all bricks!
          </Text>
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={startGame}
            disabled={actionLoading}
          >
            <Text style={styles.startButtonText}>
              {actionLoading ? "Starting..." : "▶  Start Campaign"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Game field
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bg, paddingTop: insets.top },
      ]}
    >
      {/* ── HUD ──────────────────────────────────────── */}
      <View style={styles.hudRow}>
        <Text style={[styles.hudText, { color: textColor }]}>
          {"❤".repeat(Math.max(0, rs?.lives ?? 3))}
        </Text>
        <Text style={[styles.hudTextCenter, { color: textColor }]}>
          Lv {rs?.levelId ?? 1}/{MAX_LEVEL} — {rs?.levelName ?? ""}
        </Text>
        <Text style={[styles.hudText, { color: textColor }]}>
          {(rs?.score ?? 0).toLocaleString()}
        </Text>
      </View>

      {/* ── Play field ────────────────────────────────── */}
      <View
        style={[styles.field, { width: FIELD_PX_W, height: FIELD_PX_H }]}
        onLayout={onFieldLayout}
        {...panResponder.panHandlers}
      >
        {/* ── Active powerup icons (absolute overlay — no layout shift) ── */}
        {rs && rs.activePowerups.length > 0 && (
          <View style={styles.powerupRow} pointerEvents="none">
            {rs.activePowerups.map((kind) => (
              <View
                key={kind}
                style={[
                  styles.powerupBadge,
                  { backgroundColor: POWERUP_COLORS[kind] },
                ]}
              >
                <Text style={styles.powerupBadgeText}>
                  {POWERUP_ICONS[kind]}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Combo indicator (absolute overlay) ───────── */}
        {rs && rs.combo > 2 && (
          <Text
            style={[styles.comboText, { color: "#FFD700" }]}
            pointerEvents="none"
          >
            x{rs.combo} COMBO
          </Text>
        )}

        {/* Bricks */}
        {rs?.bricks.map((b) => {
          let color: string;
          if (b.brickType === "N") {
            // Row-based color for normal bricks
            color = ROW_COLORS[b.row % ROW_COLORS.length];
          } else if (b.brickType === "H") {
            // Hard bricks — tinted row color, slightly darkened
            const base = ROW_COLORS[b.row % ROW_COLORS.length];
            color = darkenHex(base, 0.25);
          } else {
            const colors = BRICK_COLORS[b.brickType] || ["#888"];
            const colorIdx = Math.min(b.hp - 1, colors.length - 1);
            color = colors[Math.max(0, colorIdx)];
          }
          return (
            <View
              key={b.key}
              style={[
                styles.brick,
                {
                  left: toScreenX(b.x) - BRICK_PX_W / 2,
                  top: toScreenY(b.y) - BRICK_PX_H / 2,
                  width: BRICK_PX_W - 2,
                  height: BRICK_PX_H - 2,
                  backgroundColor: color,
                  opacity: b.brickType === "S" ? 0.7 : 1,
                  borderWidth: b.brickType === "H" ? 1 : 0,
                  borderColor: "rgba(255,255,255,0.35)",
                },
              ]}
            >
              {b.brickType === "S" && <Text style={styles.brickIcon}>▪</Text>}
              {b.brickType === "E" && <Text style={styles.brickIcon}>💥</Text>}
              {b.brickType === "P" && <Text style={styles.brickIcon}>⭐</Text>}
              {b.brickType === "H" && b.hp > 1 && (
                <Text style={styles.brickIcon}>■</Text>
              )}
            </View>
          );
        })}

        {/* Shield */}
        {rs?.hasShield && (
          <View
            style={[
              styles.shield,
              {
                width: FIELD_PX_W,
                top: toScreenY(0.1),
              },
            ]}
          />
        )}

        {/* Paddle */}
        {rs && (
          <View
            style={[
              styles.paddle,
              {
                left: toScreenX(rs.paddleX) - rs.paddleHW * SCALE,
                top: toScreenY(SIM.PADDLE_Y) - PADDLE_PX_H / 2,
                width: rs.paddleHW * 2 * SCALE,
                height: PADDLE_PX_H,
              },
            ]}
          />
        )}

        {/* Balls */}
        {rs?.balls.map((b) => (
          <View
            key={b.id}
            style={[
              styles.ball,
              {
                left: toScreenX(b.x) - BALL_PX_R,
                top: toScreenY(b.y) - BALL_PX_R,
                width: BALL_PX_R * 2,
                height: BALL_PX_R * 2,
                borderRadius: BALL_PX_R,
              },
            ]}
          />
        ))}

        {/* Powerups (falling) */}
        {rs?.powerups.map((p) => (
          <View
            key={p.id}
            style={[
              styles.powerupDrop,
              {
                left: toScreenX(p.x) - 8,
                top: toScreenY(p.y) - 8,
                backgroundColor: POWERUP_COLORS[p.kind],
              },
            ]}
          >
            <Text style={styles.powerupDropText}>
              {POWERUP_ICONS[p.kind]?.[0] ?? "?"}
            </Text>
          </View>
        ))}

        {/* Serve overlay */}
        {rs?.serving && gamePhase === "playing" && (
          <View style={styles.serveOverlay}>
            <Text style={styles.serveText}>Tap to Launch</Text>
          </View>
        )}
      </View>

      {/* ── Bottom controls ───────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.pauseButton}
          onPress={() => setPaused(true)}
        >
          <Text style={styles.pauseButtonText}>⏸</Text>
        </TouchableOpacity>
      </View>

      {/* ── Pause Modal ───────────────────────────────── */}
      <Modal
        visible={paused && gamePhase === "playing"}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? "#222" : "#fff" },
            ]}
          >
            <Text
              style={[styles.modalTitle, { color: isDark ? "#fff" : "#000" }]}
            >
              Paused
            </Text>
            <Pressable
              style={[
                styles.modalBtn,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => setPaused(false)}
            >
              <Text style={styles.modalBtnText}>Resume</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: "#666" }]}
              onPress={() => {
                setPaused(false);
                const sim = simRef.current;
                if (sim) finishRun(sim);
              }}
            >
              <Text style={styles.modalBtnText}>Quit Run</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center" },
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  titleText: { fontSize: 36, fontWeight: "800", marginBottom: 8 },
  subtitleText: { fontSize: 16, marginBottom: 32, textAlign: "center" },
  startButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },

  hudRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  hudText: { fontSize: 14, fontWeight: "600" },
  hudTextCenter: { fontSize: 13, fontWeight: "600", textAlign: "center" },

  powerupRow: {
    position: "absolute",
    top: 4,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    zIndex: 20,
    gap: 6,
  },
  powerupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    opacity: 0.9,
  },
  powerupBadgeText: { fontSize: 12, color: "#fff", fontWeight: "700" },

  comboText: {
    position: "absolute",
    top: 28,
    left: 0,
    right: 0,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    zIndex: 20,
  },

  field: {
    backgroundColor: "#0f0f23",
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },

  brick: {
    position: "absolute",
    borderRadius: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  brickIcon: { fontSize: 8 },

  paddle: {
    position: "absolute",
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
  },

  ball: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
  },

  powerupDrop: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  powerupDropText: { fontSize: 9 },

  shield: {
    position: "absolute",
    left: 0,
    height: 3,
    backgroundColor: "#3F51B5",
    opacity: 0.8,
  },

  serveOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  serveText: { color: "#fff", fontSize: 20, fontWeight: "700" },

  bottomBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pauseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  pauseButtonText: { fontSize: 20 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: 280,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  modalTitle: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  modalBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default withGameV4Shell(BrickBreakerUI, "brick_breaker");
