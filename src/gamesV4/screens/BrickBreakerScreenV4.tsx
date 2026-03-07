/**
 * Games V4 — Brick Breaker Screen (Polished)
 *
 * Premium arcade aesthetic: gradient background, glass panels, beveled
 * bricks with damage states, glowing ball with trail, particle bursts,
 * chip-style HUD, animated serve prompt, pause modal.
 *
 * Rendering: absolute-positioned RN Views driven by physics refs.
 * Physics: Planck engine (unchanged).
 * Safe area: useSafeAreaInsets for Dynamic Island/notch clearance.
 *
 * Shell buttons (back top-left, options top-right) are NOT rendered
 * here — they come from GameScreenShell. Our HUD sits below them.
 *
 * @module gamesV4/screens/BrickBreakerScreenV4
 */

import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import {
  BALL,
  BG,
  BRICK_CRACK,
  BRICK_HIGHLIGHT,
  BRICK_ROW_COLORS,
  BRICK_SHADOW,
  CHIP,
  CLR,
  PADDLE,
  PARTICLE,
  SPACE,
  STEEL_COLORS,
  TYPO,
} from "@/gamesV4/games/brickBreaker/bbTheme";
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
  POWERUP_COLORS,
  POWERUP_ICONS,
  SIM,
} from "@/gamesV4/games/brickBreaker/types";
import * as haptics from "@/utils/haptics";
import { Ionicons } from "@expo/vector-icons";
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
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Layout constants
// =============================================================================

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const FIELD_ASPECT = SIM.FIELD_W / SIM.FIELD_H;

// =============================================================================
// Helpers
// =============================================================================

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

// =============================================================================
// Simple particle system (pooled, capped)
// =============================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  active: boolean;
}

function createParticlePool(): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < PARTICLE.maxAlive; i++) {
    pool.push({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: PARTICLE.lifetime,
      size: 3,
      color: "#FFF",
      active: false,
    });
  }
  return pool;
}

function emitBurst(
  pool: Particle[],
  cx: number,
  cy: number,
  color: string,
  count: number,
) {
  let emitted = 0;
  for (const p of pool) {
    if (emitted >= count) break;
    if (p.active) continue;
    const angle = Math.random() * Math.PI * 2;
    const speed = PARTICLE.burstSpeed * (0.5 + Math.random() * 0.5);
    p.x = cx;
    p.y = cy;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed - 1;
    p.life = PARTICLE.lifetime;
    p.maxLife = PARTICLE.lifetime;
    p.size =
      PARTICLE.sizeMin + Math.random() * (PARTICLE.sizeMax - PARTICLE.sizeMin);
    p.color = color;
    p.active = true;
    emitted++;
  }
}

function tickParticles(pool: Particle[]) {
  for (const p of pool) {
    if (!p.active) continue;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += PARTICLE.gravity;
    p.life--;
    if (p.life <= 0) p.active = false;
  }
}

// =============================================================================
// Ball trail ring buffer
// =============================================================================

interface TrailPoint {
  x: number;
  y: number;
}

// =============================================================================
// Brick color helper
// =============================================================================

function getBrickColor(
  brickType: string,
  row: number,
  hp: number,
  maxHp: number,
): string {
  if (brickType === "S") return STEEL_COLORS[1];
  if (brickType === "N") return BRICK_ROW_COLORS[row % BRICK_ROW_COLORS.length];
  if (brickType === "H") {
    const base = BRICK_ROW_COLORS[row % BRICK_ROW_COLORS.length];
    return hp < maxHp ? darkenHex(base, 0.3) : darkenHex(base, 0.15);
  }
  if (brickType === "V") {
    const base = "#EF5350";
    if (hp >= 3) return base;
    if (hp === 2) return darkenHex(base, 0.2);
    return darkenHex(base, 0.4);
  }
  if (brickType === "E") return "#FFCA28";
  if (brickType === "P") return "#CE93D8";
  if (brickType === "M") return "#81C784";
  return "#888";
}

// =============================================================================
// UI Component
// =============================================================================

function BrickBreakerUI({
  publicState,
  isTerminal,
  submitMove,
  actionLoading,
  sessionId,
  registerSoloPause,
  registerSoloResume,
}: GameShellProps) {
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

  // ── Visual refs (no re-render needed) ──────────────────────────────
  const particlesRef = useRef<Particle[]>(createParticlePool());
  const trailRef = useRef<TrailPoint[]>([]);
  const prevBrickKeysRef = useRef<Set<string>>(new Set());

  // ── Settings refs ──────────────────────────────────────────────────
  const hapticsEnabledRef = useRef(true);
  const shakeEnabledRef = useRef(true);

  // ── Pause source tracking (prevents dual-modal when shell triggers) ─
  const pausedByShellRef = useRef(false);

  // ── React state for rendering ──────────────────────────────────────
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [gamePhase, setGamePhase] = useState<"menu" | "playing">("menu");
  const [hapticsOn, setHapticsOn] = useState(true);
  const [shakeOn, setShakeOn] = useState(true);

  // ── Animated values ────────────────────────────────────────────────
  const serveBounce = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const shakeY = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  const state = publicState as unknown as BrickBreakerPublicState | null;

  // ── Dynamic layout (safe-area aware) ────────────────────────────────
  // Derive field size + position from insets so the HUD sits below
  // the shell buttons and the playfield is properly centered.
  const {
    HUD_TOP,
    FIELD_TOP,
    FIELD_PX_W,
    FIELD_PX_H,
    SCALE,
    BALL_PX_R,
    BRICK_PX_W,
    BRICK_PX_H,
    PADDLE_PX_H,
  } = useMemo(() => {
    const hudTop = insets.top + 8 + SPACE.shellRowH;
    const fieldTop = hudTop + SPACE.hudChipH + SPACE.hudFieldGap;
    const bottomPad = insets.bottom + 12;
    const availH = SCREEN_H - fieldTop - bottomPad;
    const maxW = SCREEN_W - SPACE.fieldMarginH * 2;
    const idealH = maxW / FIELD_ASPECT;

    let fH: number;
    let fW: number;
    if (idealH <= availH) {
      fH = idealH;
      fW = maxW;
    } else {
      fH = availH;
      fW = fH * FIELD_ASPECT;
    }

    const sc = fW / SIM.FIELD_W;
    return {
      HUD_TOP: hudTop,
      FIELD_TOP: fieldTop,
      FIELD_PX_W: fW,
      FIELD_PX_H: fH,
      SCALE: sc,
      BALL_PX_R: SIM.BALL_RADIUS * sc,
      BRICK_PX_W: SIM.BRICK_W * sc,
      BRICK_PX_H: SIM.BRICK_H * sc,
      PADDLE_PX_H: SIM.PADDLE_HH * 2 * sc,
    };
  }, [insets.top, insets.bottom]);

  // Scale ref for RAF loop (avoids stale closure)
  const scaleRef = useRef(SCALE);
  scaleRef.current = SCALE;

  // World → screen transforms (relative to field container)
  const toScreenX = (wx: number) => wx * SCALE;
  const toScreenY = (wy: number) => (SIM.FIELD_H - wy) * SCALE;

  // Serve prompt bounce loop
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(serveBounce, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(serveBounce, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [serveBounce]);

  // ── Register pause / resume callbacks with GameScreenShell ──────────
  useEffect(() => {
    registerSoloPause?.(() => {
      if (__DEV__) console.log("[BrickBreaker] pauseGame (shell)");
      pausedByShellRef.current = true;
      runningRef.current = false;
      setPaused(true);
    });
  }, [registerSoloPause]);

  useEffect(() => {
    registerSoloResume?.(() => {
      if (__DEV__) console.log("[BrickBreaker] resumeGame (shell)");
      pausedByShellRef.current = false;
      runningRef.current = true;
      setPaused(false);
    });
  }, [registerSoloResume]);

  // ── Shake helper ───────────────────────────────────────────────────
  const triggerShake = useCallback(
    (intensity: number = 3) => {
      if (!shakeEnabledRef.current) return;
      Animated.sequence([
        Animated.timing(shakeX, {
          toValue: intensity,
          duration: 30,
          useNativeDriver: true,
        }),
        Animated.timing(shakeX, {
          toValue: -intensity,
          duration: 30,
          useNativeDriver: true,
        }),
        Animated.timing(shakeX, {
          toValue: intensity * 0.5,
          duration: 25,
          useNativeDriver: true,
        }),
        Animated.timing(shakeX, {
          toValue: 0,
          duration: 25,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [shakeX],
  );

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
    trailRef.current = [];
    prevBrickKeysRef.current = new Set();

    submitMove({ type: "startRun", seed, startLevelId: 1 });

    const levelDef = getLevelById(1);
    if (!levelDef) return;
    simRef.current = createLevelSim(levelDef, seed, SIM.DEFAULT_LIVES);
    renderRef.current = getRenderState(simRef.current);
    runningRef.current = true;

    // Populate initial brick keys for particle diff
    if (renderRef.current) {
      const keys = new Set<string>();
      for (const b of renderRef.current.bricks) keys.add(b.key);
      prevBrickKeysRef.current = keys;
    }

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
        const prevRs = renderRef.current;
        renderRef.current = getRenderState(simRef.current);
        const newRs = renderRef.current;

        // Detect destroyed bricks → particles + shake
        if (prevRs && newRs) {
          const newKeys = new Set<string>();
          for (const b of newRs.bricks) newKeys.add(b.key);
          let destroyed = 0;
          for (const b of prevRs.bricks) {
            if (!newKeys.has(b.key)) {
              destroyed++;
              const sc = scaleRef.current;
              const cx = b.x * sc;
              const cy = (SIM.FIELD_H - b.y) * sc;
              const color = getBrickColor(b.brickType, b.row, b.hp, b.maxHp);
              emitBurst(
                particlesRef.current,
                cx,
                cy,
                color,
                PARTICLE.maxPerBurst,
              );
            }
          }
          if (destroyed > 0) {
            triggerShake(Math.min(destroyed * 2, 6));
            if (hapticsEnabledRef.current) haptics.light();
          }
        }

        // Tick particles
        tickParticles(particlesRef.current);

        // Update ball trail
        if (newRs && newRs.balls.length > 0) {
          const mainBall = newRs.balls[0];
          const trail = trailRef.current;
          const sc2 = scaleRef.current;
          trail.push({
            x: mainBall.x * sc2,
            y: (SIM.FIELD_H - mainBall.y) * sc2,
          });
          if (trail.length > BALL.trailSegments) trail.shift();
        } else {
          trailRef.current = [];
        }

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
            trailRef.current = [];
            if (hapticsEnabledRef.current) haptics.medium();
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

  // ── Menu screen ────────────────────────────────────────────────────
  if (gamePhase === "menu") {
    return (
      <LinearGradient
        colors={BG.gradient as [string, string, string]}
        style={styles.flex}
      >
        <View style={[styles.menuContainer, { paddingTop: HUD_TOP }]}>
          {/* Title chip */}
          <View style={styles.titleChip}>
            <Text style={styles.titleEmoji}>🧱</Text>
            <Text style={styles.titleText}>Brick Breaker</Text>
          </View>

          {/* Feature cards */}
          <View style={styles.featureRow}>
            {[
              { label: "30", sub: "Levels" },
              { label: "⭐", sub: "Powerups" },
              { label: "🏆", sub: "Achieve" },
            ].map((f, i) => (
              <View key={i} style={styles.featureCard}>
                <Text style={styles.featureCardLabel}>{f.label}</Text>
                <Text style={styles.featureCardSub}>{f.sub}</Text>
              </View>
            ))}
          </View>

          {/* Start button */}
          <Pressable
            onPressIn={() => {
              Animated.spring(btnScale, {
                toValue: 0.95,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(btnScale, {
                toValue: 1,
                useNativeDriver: true,
              }).start();
            }}
            onPress={startGame}
            disabled={actionLoading}
          >
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <LinearGradient
                colors={[CLR.accent, "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startButton}
              >
                <Ionicons name="play" size={20} color="#FFF" />
                <Text style={styles.startButtonText}>
                  {actionLoading ? "Starting..." : "Start Campaign"}
                </Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>
        </View>

        {/* Vignette */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.4)"]}
          style={styles.vignette}
          pointerEvents="none"
        />
      </LinearGradient>
    );
  }

  // ── In-game screen ─────────────────────────────────────────────────
  return (
    <LinearGradient
      colors={BG.gradient as [string, string, string]}
      style={styles.flex}
    >
      {/* ── Level chip (true-center, behind left/right) ──── */}
      <View
        style={[styles.hudCenterWrapper, { top: HUD_TOP }]}
        pointerEvents="box-none"
      >
        <View style={styles.hudChipCenter}>
          <Text style={styles.hudChipValue}>
            Lv {rs?.levelId ?? 1}/{MAX_LEVEL}
          </Text>
          {rs?.levelName ? (
            <Text style={styles.hudChipName} numberOfLines={1}>
              {rs.levelName}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ── Left / Right HUD chips ────────────────────── */}
      <View style={[styles.hudRow, { top: HUD_TOP }]}>
        {/* Lives */}
        <View style={styles.hudChipLeft}>
          {Array.from({ length: Math.max(0, rs?.lives ?? 3) }).map((_, i) => (
            <Text key={i} style={styles.heartIcon}>
              ❤
            </Text>
          ))}
        </View>

        {/* Score + combo */}
        <View style={styles.hudChipRight}>
          <Text style={styles.hudChipValue}>
            {(rs?.score ?? 0).toLocaleString()}
          </Text>
          {(rs?.combo ?? 0) > 1 && (
            <View style={styles.comboBadge}>
              <Text style={styles.comboBadgeText}>x{rs!.combo}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Shake wrapper ─────────────────────────────── */}
      <Animated.View
        style={{
          flex: 1,
          alignItems: "center",
          transform: [{ translateX: shakeX }, { translateY: shakeY }],
        }}
      >
        {/* ── Glass field panel ────────────────────────── */}
        <View
          style={[
            styles.field,
            { width: FIELD_PX_W, height: FIELD_PX_H, marginTop: FIELD_TOP },
          ]}
          onLayout={onFieldLayout}
          {...panResponder.panHandlers}
        >
          {/* Top highlight bar */}
          <View style={styles.fieldTopHighlight} pointerEvents="none" />

          {/* Active powerup badges */}
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

          {/* Bricks */}
          {rs?.bricks.map((b) => {
            const baseColor = getBrickColor(b.brickType, b.row, b.hp, b.maxHp);
            const damaged = b.hp < b.maxHp && b.brickType !== "N";
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
                    backgroundColor: baseColor,
                    opacity: b.brickType === "S" ? 0.85 : 1,
                  },
                ]}
              >
                {/* Bevel highlight (top 30%) */}
                <View
                  style={[
                    styles.brickHighlight,
                    { backgroundColor: BRICK_HIGHLIGHT },
                  ]}
                />
                {/* Bevel shadow (bottom 20%) */}
                <View
                  style={[
                    styles.brickShadow,
                    { backgroundColor: BRICK_SHADOW },
                  ]}
                />
                {/* Crack overlay */}
                {damaged && (
                  <View
                    style={[styles.brickCrack, { borderColor: BRICK_CRACK }]}
                  />
                )}
                {/* Special icons */}
                {b.brickType === "E" && (
                  <Text style={styles.brickIcon}>💥</Text>
                )}
                {b.brickType === "P" && (
                  <Text style={styles.brickIcon}>⭐</Text>
                )}
                {b.brickType === "S" && (
                  <Text style={styles.brickIcon}>🔩</Text>
                )}
              </View>
            );
          })}

          {/* Shield */}
          {rs?.hasShield && (
            <View
              style={[
                styles.shield,
                { width: FIELD_PX_W, top: toScreenY(0.1) },
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
            >
              <View style={styles.paddleHighlight} />
            </View>
          )}

          {/* Ball trail */}
          {trailRef.current.map((tp, i) => {
            const alpha = ((i + 1) / trailRef.current.length) * 0.5;
            const sz =
              BALL_PX_R * 2 * (0.4 + 0.6 * ((i + 1) / trailRef.current.length));
            return (
              <View
                key={`trail-${i}`}
                style={{
                  position: "absolute",
                  left: tp.x - sz / 2,
                  top: tp.y - sz / 2,
                  width: sz,
                  height: sz,
                  borderRadius: sz / 2,
                  backgroundColor: BALL.trailColor,
                  opacity: alpha,
                }}
              />
            );
          })}

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
                  left: toScreenX(p.x) - 10,
                  top: toScreenY(p.y) - 10,
                  backgroundColor: POWERUP_COLORS[p.kind],
                },
              ]}
            >
              <Text style={styles.powerupDropText}>
                {POWERUP_ICONS[p.kind]?.[0] ?? "?"}
              </Text>
            </View>
          ))}

          {/* Particles */}
          {particlesRef.current.map((p, i) =>
            p.active ? (
              <View
                key={`p-${i}`}
                style={{
                  position: "absolute",
                  left: p.x - p.size / 2,
                  top: p.y - p.size / 2,
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size / 2,
                  backgroundColor: p.color,
                  opacity: p.life / p.maxLife,
                }}
              />
            ) : null,
          )}

          {/* Serve prompt */}
          {rs?.serving && gamePhase === "playing" && (
            <Animated.View
              style={[
                styles.serveOverlay,
                {
                  transform: [
                    {
                      translateY: serveBounce.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -10],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.servePill}>
                <Ionicons name="arrow-up-circle" size={22} color={CLR.accent} />
                <Text style={styles.serveText}>Tap to Launch</Text>
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.View>

      {/* ── Pause Modal (only when game itself triggers, not shell) ── */}
      <Modal
        visible={paused && gamePhase === "playing" && !pausedByShellRef.current}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Paused</Text>

            <Pressable
              style={styles.modalBtnResume}
              onPress={() => {
                runningRef.current = true;
                setPaused(false);
              }}
            >
              <Ionicons
                name="play"
                size={18}
                color="#FFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.modalBtnText}>Resume</Text>
            </Pressable>

            <Pressable
              style={styles.modalBtnQuit}
              onPress={() => {
                setPaused(false);
                const sim = simRef.current;
                if (sim) finishRun(sim);
              }}
            >
              <Ionicons
                name="exit-outline"
                size={18}
                color={CLR.text}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.modalBtnText, { color: CLR.text }]}>
                Quit Run
              </Text>
            </Pressable>

            {/* Divider */}
            <View style={styles.modalDivider} />

            {/* Haptics toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Haptics</Text>
              <Pressable
                style={[styles.toggleBtn, hapticsOn && styles.toggleBtnActive]}
                onPress={() => {
                  const next = !hapticsOn;
                  setHapticsOn(next);
                  hapticsEnabledRef.current = next;
                }}
              >
                <Text style={styles.toggleBtnText}>
                  {hapticsOn ? "ON" : "OFF"}
                </Text>
              </Pressable>
            </View>

            {/* Screen shake toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Screen Shake</Text>
              <Pressable
                style={[styles.toggleBtn, shakeOn && styles.toggleBtnActive]}
                onPress={() => {
                  const next = !shakeOn;
                  setShakeOn(next);
                  shakeEnabledRef.current = next;
                }}
              >
                <Text style={styles.toggleBtnText}>
                  {shakeOn ? "ON" : "OFF"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Vignette */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.3)"]}
        style={styles.vignette}
        pointerEvents="none"
      />
    </LinearGradient>
  );
}

// =============================================================================
// Styles
// =============================================================================

// ViewStyle-typed helper — prevents StyleSheet.create generic inference breakage
const chipBase: ViewStyle = {
  backgroundColor: CHIP.bg,
  borderRadius: CHIP.radius,
  borderWidth: 1,
  borderColor: CHIP.border,
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  vignette: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: "60%" as unknown as number,
  },

  // ── Menu ──────────────────────────────────────────
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  titleChip: {
    ...chipBase,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 24,
  },
  titleEmoji: { fontSize: 28, marginRight: 10 },
  titleText: {
    ...TYPO.title,
    color: CLR.text,
  },
  featureRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 32,
  },
  featureCard: {
    ...chipBase,
    alignItems: "center" as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 90,
  },
  featureCardLabel: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: CLR.text,
    marginBottom: 2,
  },
  featureCardSub: {
    fontSize: 11,
    color: CLR.textDim,
    fontWeight: "600" as const,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  startButtonText: {
    ...TYPO.button,
    color: "#FFF",
  },

  // ── HUD ───────────────────────────────────────────
  hudCenterWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 49,
  },
  hudRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    zIndex: 50,
  },
  hudChipLeft: {
    ...chipBase,
    flexDirection: "row" as const,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
  },
  hudChipCenter: {
    ...chipBase,
    alignItems: "center" as const,
    paddingHorizontal: 12,
    paddingVertical: 5,
    maxWidth: "55%" as unknown as number,
  },
  hudChipRight: {
    ...chipBase,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  heartIcon: { fontSize: 14, color: CLR.heart },
  hudChipValue: {
    ...TYPO.hudValue,
    color: CLR.text,
  },
  hudChipName: {
    ...TYPO.levelSub,
    color: CLR.textDim,
  },
  comboBadge: {
    backgroundColor: CLR.gold + "33",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  comboBadgeText: {
    ...TYPO.combo,
    color: CLR.gold,
  },

  // ── Field ─────────────────────────────────────────
  field: {
    backgroundColor: BG.fieldFill,
    borderRadius: SPACE.fieldRadius,
    borderWidth: 1,
    borderColor: BG.fieldBorder,
    overflow: "hidden",
    position: "relative",
  },
  fieldTopHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderTopLeftRadius: SPACE.fieldRadius,
    borderTopRightRadius: SPACE.fieldRadius,
  },

  // ── Powerups (active) ─────────────────────────────
  powerupRow: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    zIndex: 20,
    gap: 6,
  },
  powerupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    opacity: 0.9,
  },
  powerupBadgeText: {
    fontSize: 12,
    color: "#FFF",
    fontWeight: "700" as const,
  },

  // ── Bricks ────────────────────────────────────────
  brick: {
    position: "absolute",
    borderRadius: SPACE.brickRadius,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  brickHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "30%" as unknown as number,
    borderTopLeftRadius: SPACE.brickRadius,
    borderTopRightRadius: SPACE.brickRadius,
  },
  brickShadow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "20%" as unknown as number,
    borderBottomLeftRadius: SPACE.brickRadius,
    borderBottomRightRadius: SPACE.brickRadius,
  },
  brickCrack: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: SPACE.brickRadius,
  },
  brickIcon: { fontSize: 9, zIndex: 2 },

  // ── Paddle ────────────────────────────────────────
  paddle: {
    position: "absolute",
    backgroundColor: PADDLE.fill,
    borderRadius: 5,
    overflow: "hidden",
  },
  paddleHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "40%" as unknown as number,
    backgroundColor: PADDLE.highlight,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },

  // ── Ball ──────────────────────────────────────────
  ball: {
    position: "absolute",
    backgroundColor: BALL.fill,
    shadowColor: BALL.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: BALL.glowRadius,
    elevation: 6,
  },

  // ── Powerups (falling) ────────────────────────────
  powerupDrop: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  powerupDropText: { fontSize: 10 },

  // ── Shield ────────────────────────────────────────
  shield: {
    position: "absolute",
    left: 0,
    height: 3,
    backgroundColor: "#5C6BC0",
    opacity: 0.9,
    shadowColor: "#5C6BC0",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },

  // ── Serve ─────────────────────────────────────────
  serveOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
  },
  servePill: {
    ...chipBase,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
  },
  serveText: {
    ...TYPO.servePrompt,
    color: CLR.text,
  },

  // ── Pause modal ───────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: 280,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 10,
    backgroundColor: CHIP.bg,
    borderWidth: 1,
    borderColor: CHIP.border,
  },
  modalTitle: {
    ...TYPO.pauseTitle,
    color: CLR.text,
    marginBottom: 8,
  },
  modalBtnResume: {
    width: "100%" as unknown as number,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: CLR.accent,
  },
  modalBtnQuit: {
    width: "100%" as unknown as number,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  modalBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" as const },
  modalDivider: {
    width: "80%" as unknown as number,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 6,
  },
  toggleRow: {
    width: "100%" as unknown as number,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  toggleLabel: {
    color: CLR.text,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  toggleBtnActive: {
    backgroundColor: CLR.accent + "44",
  },
  toggleBtnText: {
    color: CLR.text,
    fontSize: 12,
    fontWeight: "700" as const,
  },
});

export default withGameV4Shell(BrickBreakerUI, "brick_breaker");
