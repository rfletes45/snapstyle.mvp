/**
 * TargetMasterGameScreen - Target Shooting Accuracy Game
 *
 * How to play:
 * 1. Tap START to begin a 30-second round
 * 2. Colourful circular targets appear at random positions and shrink over 2 seconds
 * 3. Tap a target before it disappears to score points
 * 4. Smaller targets when tapped = more points
 * 5. Tapping empty space costs -50 points and resets your combo
 * 6. Consecutive hits build a combo multiplier (1× → 1.5× → 2× → 2.5× → 3×)
 * 7. Higher scores are better!
 */

import FriendPickerModal from "@/components/FriendPickerModal";
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
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  Canvas,
  Circle,
  RadialGradient,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

type GameState = "idle" | "playing" | "result";

interface Target {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  spawnedAt: number;
  anim: Animated.Value;
}

interface TargetMasterGameScreenProps {
  navigation: any;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// =============================================================================
// Difficulty Settings
// =============================================================================

interface DifficultyConfig {
  label: string;
  emoji: string;
  gameDuration: number; // ms
  targetLifetime: number; // ms before target disappears
  minSpawnInterval: number; // ms
  maxSpawnInterval: number; // ms
  maxTargetRadius: number;
  minTargetRadius: number;
  maxActiveTargets: number; // max simultaneous targets
}

const DIFFICULTIES: Record<string, DifficultyConfig> = {
  easy: {
    label: "Easy",
    emoji: "🟢",
    gameDuration: 30_000,
    targetLifetime: 2_500,
    minSpawnInterval: 900,
    maxSpawnInterval: 1_400,
    maxTargetRadius: 44,
    minTargetRadius: 16,
    maxActiveTargets: 3,
  },
  medium: {
    label: "Medium",
    emoji: "🟡",
    gameDuration: 30_000,
    targetLifetime: 2_000,
    minSpawnInterval: 700,
    maxSpawnInterval: 1_100,
    maxTargetRadius: 38,
    minTargetRadius: 12,
    maxActiveTargets: 4,
  },
  hard: {
    label: "Hard",
    emoji: "🔴",
    gameDuration: 30_000,
    targetLifetime: 1_500,
    minSpawnInterval: 500,
    maxSpawnInterval: 800,
    maxTargetRadius: 32,
    minTargetRadius: 10,
    maxActiveTargets: 5,
  },
  insane: {
    label: "Insane",
    emoji: "💀",
    gameDuration: 30_000,
    targetLifetime: 1_000,
    minSpawnInterval: 300,
    maxSpawnInterval: 600,
    maxTargetRadius: 28,
    minTargetRadius: 8,
    maxActiveTargets: 7,
  },
};

const MISS_PENALTY = -50;
const BASE_HIT_POINTS = 100; // points for hitting at full size
const MAX_HIT_POINTS = 300; // points for hitting at smallest size

const COMBO_MULTIPLIERS = [1, 1.5, 2, 2.5, 3];

const PLAY_AREA_TOP = 130; // space for header/stats
const PLAY_AREA_BOTTOM = 60; // bottom padding
const PLAY_AREA_PADDING = 20; // side padding

const TARGET_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96E6A1",
  "#DDA0DD",
  "#FFD93D",
  "#FF8C42",
  "#6C5CE7",
  "#A8E6CF",
  "#FF85A1",
];

// =============================================================================
// Component
// =============================================================================

export default function TargetMasterGameScreen({
  navigation,
}: TargetMasterGameScreenProps) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // Game state
  const [gameState, setGameState] = useState<GameState>("idle");
  const [difficulty, setDifficulty] = useState<DifficultyConfig>(
    DIFFICULTIES.easy,
  );
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [targets, setTargets] = useState<Target[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(
    DIFFICULTIES.easy.gameDuration,
  );
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  // Difficulty ref for use in callbacks
  const difficultyRef = useRef<DifficultyConfig>(DIFFICULTIES.easy);

  // Personal best / sharing
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);

  // Floating text feedback
  const [floatingTexts, setFloatingTexts] = useState<
    {
      id: number;
      x: number;
      y: number;
      text: string;
      color: string;
      anim: Animated.Value;
    }[]
  >([]);

  // Refs
  const nextTargetId = useRef(0);
  const nextFloatId = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shrinkTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const startTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const maxComboRef = useRef(0);
  const targetsRef = useRef<Target[]>([]);
  const gameStateRef = useRef<GameState>("idle");

  // Keep refs in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  // ---------------------------------------------------------------------------
  // Load personal best
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, "target_master" as any).then(
        setPersonalBest,
      );
    }
  }, [currentFirebaseUser]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
      shrinkTimersRef.current.forEach((t) => clearTimeout(t));
      shrinkTimersRef.current.clear();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getComboMultiplier = useCallback((c: number) => {
    const idx = Math.min(c, COMBO_MULTIPLIERS.length - 1);
    return COMBO_MULTIPLIERS[idx];
  }, []);

  const spawnFloatingText = useCallback(
    (x: number, y: number, text: string, color: string) => {
      const id = nextFloatId.current++;
      const anim = new Animated.Value(0);
      setFloatingTexts((prev) => [...prev, { id, x, y, text, color, anim }]);
      Animated.timing(anim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        setFloatingTexts((prev) => prev.filter((f) => f.id !== id));
      });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Target spawning
  // ---------------------------------------------------------------------------

  const spawnTarget = useCallback(() => {
    if (gameStateRef.current !== "playing") return;

    const diff = difficultyRef.current;

    // Don't spawn if at max active targets
    if (targetsRef.current.length >= diff.maxActiveTargets) {
      const nextDelay =
        diff.minSpawnInterval +
        Math.random() * (diff.maxSpawnInterval - diff.minSpawnInterval);
      spawnTimerRef.current = setTimeout(spawnTarget, nextDelay);
      return;
    }

    const id = nextTargetId.current++;
    const radius = diff.maxTargetRadius;
    const x =
      PLAY_AREA_PADDING +
      radius +
      Math.random() * (SCREEN_WIDTH - 2 * PLAY_AREA_PADDING - 2 * radius);
    const y =
      PLAY_AREA_TOP +
      radius +
      Math.random() *
        (SCREEN_HEIGHT - PLAY_AREA_TOP - PLAY_AREA_BOTTOM - 2 * radius);
    const color =
      TARGET_COLORS[Math.floor(Math.random() * TARGET_COLORS.length)];
    const anim = new Animated.Value(1);

    const target: Target = {
      id,
      x,
      y,
      radius,
      maxRadius: radius,
      color,
      spawnedAt: Date.now(),
      anim,
    };

    setTargets((prev) => [...prev, target]);

    // Shrink animation over TARGET_LIFETIME
    Animated.timing(anim, {
      toValue: 0,
      duration: diff.targetLifetime,
      useNativeDriver: true,
    }).start();

    // Remove target after lifetime (missed)
    const expireTimer = setTimeout(() => {
      if (gameStateRef.current !== "playing") return;
      setTargets((prev) => prev.filter((t) => t.id !== id));
      shrinkTimersRef.current.delete(id);
    }, diff.targetLifetime);

    shrinkTimersRef.current.set(id, expireTimer);

    // Schedule next spawn
    const nextDelay =
      diff.minSpawnInterval +
      Math.random() * (diff.maxSpawnInterval - diff.minSpawnInterval);
    spawnTimerRef.current = setTimeout(spawnTarget, nextDelay);
  }, []);

  // ---------------------------------------------------------------------------
  // Game lifecycle
  // ---------------------------------------------------------------------------

  const startGame = useCallback(
    (diff?: DifficultyConfig) => {
      const activeDiff = diff || difficultyRef.current;
      difficultyRef.current = activeDiff;
      if (diff) setDifficulty(activeDiff);

      // Reset state
      setScore(0);
      setCombo(0);
      setHits(0);
      setMisses(0);
      setMaxCombo(0);
      setTargets([]);
      setTimeRemaining(activeDiff.gameDuration);
      setIsNewBest(false);
      setFloatingTexts([]);
      scoreRef.current = 0;
      comboRef.current = 0;
      hitsRef.current = 0;
      missesRef.current = 0;
      maxComboRef.current = 0;
      targetsRef.current = [];
      nextTargetId.current = 0;

      setGameState("playing");
      startTimeRef.current = Date.now();

      // Haptic
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Countdown timer
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, activeDiff.gameDuration - elapsed);
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          endGame();
        }
      }, 100);

      // Start spawning targets
      const initialDelay =
        activeDiff.minSpawnInterval +
        Math.random() *
          (activeDiff.maxSpawnInterval - activeDiff.minSpawnInterval);
      spawnTimerRef.current = setTimeout(spawnTarget, initialDelay);
    },
    [spawnTarget],
  );

  const endGame = useCallback(async () => {
    // Stop timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (spawnTimerRef.current) {
      clearTimeout(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }
    shrinkTimersRef.current.forEach((t) => clearTimeout(t));
    shrinkTimersRef.current.clear();

    setTargets([]);
    setGameState("result");
    setTimeRemaining(0);

    // Haptic
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    const finalScore = scoreRef.current;
    const finalHits = hitsRef.current;
    const finalMisses = missesRef.current;
    const finalMaxCombo = maxComboRef.current;

    // Check personal best
    const newBest = !personalBest || finalScore > personalBest.bestScore;
    setIsNewBest(newBest);

    if (newBest && Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Record session
    if (currentFirebaseUser && finalScore > 0) {
      const session = await recordGameSession(currentFirebaseUser.uid, {
        gameId: "target_master" as any,
        score: finalScore,
        duration: difficultyRef.current.gameDuration,
      });

      if (session && newBest) {
        setPersonalBest({
          gameId: "target_master" as any,
          bestScore: finalScore,
          achievedAt: Date.now(),
        });
        showSuccess("🎉 New Personal Best!");
      }
    }
  }, [currentFirebaseUser, personalBest, showSuccess]);

  // ---------------------------------------------------------------------------
  // Hit / Miss handling
  // ---------------------------------------------------------------------------

  const handleTargetHit = useCallback(
    (target: Target) => {
      if (gameStateRef.current !== "playing") return;

      // Calculate how far the target has shrunk (0 = full size, 1 = gone)
      const elapsed = Date.now() - target.spawnedAt;
      const shrinkProgress = Math.min(
        elapsed / difficultyRef.current.targetLifetime,
        1,
      );
      // Current radius factor (1 = full, ~0 = tiny)
      const radiusFactor = 1 - shrinkProgress;
      // Smaller target = more points  (linear interpolation)
      const basePoints = Math.round(
        BASE_HIT_POINTS +
          (MAX_HIT_POINTS - BASE_HIT_POINTS) * (1 - radiusFactor),
      );

      // Combo
      const newCombo = comboRef.current + 1;
      comboRef.current = newCombo;
      setCombo(newCombo);
      if (newCombo > maxComboRef.current) {
        maxComboRef.current = newCombo;
        setMaxCombo(newCombo);
      }

      const multiplier = getComboMultiplier(newCombo);
      const points = Math.round(basePoints * multiplier);

      // Update score
      scoreRef.current += points;
      setScore(scoreRef.current);

      // Hits
      hitsRef.current += 1;
      setHits(hitsRef.current);

      // Remove target
      setTargets((prev) => prev.filter((t) => t.id !== target.id));
      const expireTimer = shrinkTimersRef.current.get(target.id);
      if (expireTimer) {
        clearTimeout(expireTimer);
        shrinkTimersRef.current.delete(target.id);
      }

      // Floating text
      const comboLabel = multiplier > 1 ? ` (${multiplier}×)` : "";
      spawnFloatingText(
        target.x,
        target.y,
        `+${points}${comboLabel}`,
        "#4CAF50",
      );

      // Haptic
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
    [getComboMultiplier, spawnFloatingText],
  );

  const handleMiss = useCallback(
    (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
      if (gameStateRef.current !== "playing") return;

      const { locationX, locationY } = evt.nativeEvent;

      // Check if the tap actually hit a target (targets render on top, so this
      // handler only fires for empty-area taps)
      // Reset combo
      comboRef.current = 0;
      setCombo(0);

      // Penalty
      scoreRef.current += MISS_PENALTY;
      setScore(scoreRef.current);

      // Misses
      missesRef.current += 1;
      setMisses(missesRef.current);

      // Floating text
      spawnFloatingText(locationX, locationY, `${MISS_PENALTY}`, "#FF5252");

      // Haptic
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [spawnFloatingText],
  );

  // ---------------------------------------------------------------------------
  // Sharing
  // ---------------------------------------------------------------------------

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const shareToChat = () => {
    setShowShareDialog(false);
    setShowFriendPicker(true);
  };

  const handleSelectFriend = async (friend: {
    friendUid: string;
    username: string;
    displayName: string;
  }) => {
    if (!currentFirebaseUser || !profile) return;

    setIsSending(true);
    setShowFriendPicker(false);

    try {
      const success = await sendScorecard(
        currentFirebaseUser.uid,
        friend.friendUid,
        {
          gameId: "target_master",
          score: scoreRef.current,
          playerName: profile.displayName || profile.username || "Player",
        },
      );

      if (success) {
        showSuccess(`Score shared with ${friend.displayName}!`);
      } else {
        showError("Failed to share score. Try again.");
      }
    } catch (error) {
      console.error("[GameAim] Error sharing score:", error);
      showError("Failed to share score. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const accuracy =
    hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;
  const comboMultiplier = getComboMultiplier(combo);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Aim</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Stats bar (visible during play & result) */}
      {gameState !== "idle" && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Score
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {score}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Time
            </Text>
            <Text
              style={[
                styles.statValue,
                {
                  color:
                    timeRemaining <= 5000 && gameState === "playing"
                      ? "#FF5252"
                      : colors.text,
                },
              ]}
            >
              {(timeRemaining / 1000).toFixed(1)}s
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Combo
            </Text>
            <Text
              style={[
                styles.statValue,
                {
                  color:
                    comboMultiplier >= 3
                      ? "#FFD700"
                      : comboMultiplier >= 2
                        ? "#FF8C42"
                        : comboMultiplier >= 1.5
                          ? "#4ECDC4"
                          : colors.text,
                },
              ]}
            >
              {comboMultiplier}×
            </Text>
          </View>
        </View>
      )}

      {/* Play area */}
      <TouchableWithoutFeedback
        onPress={gameState === "playing" ? handleMiss : undefined}
      >
        <View style={styles.playArea}>
          {/* Idle state */}
          {gameState === "idle" && (
            <View style={styles.idleContainer}>
              <MaterialCommunityIcons
                name="target"
                size={80}
                color={colors.primary}
              />
              <Text style={[styles.idleTitle, { color: colors.text }]}>
                Aim
              </Text>
              <Text
                style={[styles.idleSubtext, { color: colors.textSecondary }]}
              >
                Tap targets before they disappear!{"\n"}Smaller targets = more
                points.{"\n"}Don't miss — it costs you points.
              </Text>
              {personalBest && (
                <Text
                  style={[styles.personalBestText, { color: colors.primary }]}
                >
                  Personal Best: {personalBest.bestScore}
                </Text>
              )}
              <View style={styles.difficultyRow}>
                {Object.entries(DIFFICULTIES).map(([key, diff]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.difficultyButton,
                      {
                        backgroundColor:
                          difficulty === diff
                            ? colors.primary
                            : colors.primary + "20",
                        borderColor:
                          difficulty === diff
                            ? colors.primary
                            : colors.primary + "40",
                      },
                    ]}
                    onPress={() => {
                      setDifficulty(diff);
                      difficultyRef.current = diff;
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.difficultyEmoji}>{diff.emoji}</Text>
                    <Text
                      style={[
                        styles.difficultyLabel,
                        {
                          color: difficulty === diff ? "#000" : colors.text,
                        },
                      ]}
                    >
                      {diff.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[
                  styles.startButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => startGame(difficulty)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="play" size={32} color="#000" />
                <Text style={styles.startButtonText}>START</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Targets */}
          {gameState === "playing" &&
            targets.map((target) => (
              <TouchableOpacity
                key={target.id}
                activeOpacity={0.7}
                onPress={() => handleTargetHit(target)}
                style={[
                  styles.targetTouchable,
                  {
                    left: target.x - target.maxRadius,
                    top: target.y - PLAY_AREA_TOP - target.maxRadius,
                    width: target.maxRadius * 2,
                    height: target.maxRadius * 2,
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.target,
                    {
                      width: target.maxRadius * 2,
                      height: target.maxRadius * 2,
                      borderRadius: target.maxRadius,
                      transform: [{ scale: target.anim }],
                      opacity: target.anim.interpolate({
                        inputRange: [0, 0.3, 1],
                        outputRange: [0.2, 0.8, 1],
                      }),
                    },
                  ]}
                >
                  <Canvas style={{ width: target.maxRadius * 2, height: target.maxRadius * 2 }}>
                    {/* Outer glow */}
                    <Circle cx={target.maxRadius} cy={target.maxRadius} r={target.maxRadius}>
                      <RadialGradient
                        c={vec(target.maxRadius, target.maxRadius)}
                        r={target.maxRadius}
                        colors={[target.color, `${target.color}88`, `${target.color}00`]}
                      />
                    </Circle>
                    {/* Main target body */}
                    <Circle cx={target.maxRadius} cy={target.maxRadius} r={target.maxRadius * 0.85}>
                      <RadialGradient
                        c={vec(target.maxRadius * 0.7, target.maxRadius * 0.6)}
                        r={target.maxRadius * 0.85}
                        colors={["#FFFFFF", target.color, `${target.color}DD`]}
                      />
                      <Shadow dx={0} dy={2} blur={4} color="rgba(0,0,0,0.3)" />
                    </Circle>
                    {/* Inner ring */}
                    <Circle cx={target.maxRadius} cy={target.maxRadius} r={target.maxRadius * 0.5}>
                      <RadialGradient
                        c={vec(target.maxRadius * 0.8, target.maxRadius * 0.7)}
                        r={target.maxRadius * 0.5}
                        colors={["rgba(255,255,255,0.6)", "rgba(255,255,255,0.2)", "rgba(255,255,255,0)"]}
                      />
                    </Circle>
                    {/* Center dot */}
                    <Circle cx={target.maxRadius} cy={target.maxRadius} r={target.maxRadius * 0.2}>
                      <RadialGradient
                        c={vec(target.maxRadius * 0.9, target.maxRadius * 0.85)}
                        r={target.maxRadius * 0.2}
                        colors={["#FFFFFF", "rgba(255,255,255,0.7)"]}
                      />
                    </Circle>
                  </Canvas>
                </Animated.View>
              </TouchableOpacity>
            ))}

          {/* Floating score texts */}
          {floatingTexts.map((ft) => (
            <Animated.Text
              key={ft.id}
              style={[
                styles.floatingText,
                {
                  left: ft.x - 30,
                  top: ft.y - PLAY_AREA_TOP - 10,
                  color: ft.color,
                  opacity: ft.anim.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [1, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: ft.anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -60],
                      }),
                    },
                    {
                      scale: ft.anim.interpolate({
                        inputRange: [0, 0.15, 1],
                        outputRange: [0.5, 1.2, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {ft.text}
            </Animated.Text>
          ))}

          {/* Result overlay */}
          {gameState === "result" && (
            <View style={styles.resultOverlay}>
              <Text style={[styles.resultTitle, { color: colors.primary }]}>
                TIME'S UP!
              </Text>
              <Text style={[styles.resultScore, { color: colors.text }]}>
                {score}
              </Text>
              <Text
                style={[styles.resultLabel, { color: colors.textSecondary }]}
              >
                POINTS
              </Text>
              {isNewBest && (
                <Text style={styles.newBestBadge}>🎉 NEW BEST!</Text>
              )}

              <View style={styles.resultStatsRow}>
                <View style={styles.resultStatItem}>
                  <Text
                    style={[styles.resultStatValue, { color: colors.text }]}
                  >
                    {hits}
                  </Text>
                  <Text
                    style={[
                      styles.resultStatLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Hits
                  </Text>
                </View>
                <View style={styles.resultStatItem}>
                  <Text
                    style={[styles.resultStatValue, { color: colors.text }]}
                  >
                    {misses}
                  </Text>
                  <Text
                    style={[
                      styles.resultStatLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Misses
                  </Text>
                </View>
                <View style={styles.resultStatItem}>
                  <Text
                    style={[styles.resultStatValue, { color: colors.text }]}
                  >
                    {accuracy}%
                  </Text>
                  <Text
                    style={[
                      styles.resultStatLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Accuracy
                  </Text>
                </View>
                <View style={styles.resultStatItem}>
                  <Text
                    style={[styles.resultStatValue, { color: colors.text }]}
                  >
                    {maxCombo}
                  </Text>
                  <Text
                    style={[
                      styles.resultStatLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Best Combo
                  </Text>
                </View>
              </View>

              {personalBest && (
                <Text
                  style={[
                    styles.personalBestResult,
                    { color: colors.textSecondary },
                  ]}
                >
                  Personal Best: {personalBest.bestScore}
                </Text>
              )}

              <View style={styles.resultActions}>
                <TouchableOpacity
                  style={[
                    styles.playAgainButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => startGame()}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="refresh"
                    size={22}
                    color="#000"
                  />
                  <Text style={styles.playAgainText}>Play Again</Text>
                </TouchableOpacity>

                <Button
                  mode="outlined"
                  onPress={handleShare}
                  icon="share"
                  style={styles.shareButton}
                  textColor={colors.primary}
                >
                  Share
                </Button>
              </View>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Share Dialog */}
      <Portal>
        <Dialog
          visible={showShareDialog}
          onDismiss={() => setShowShareDialog(false)}
        >
          <Dialog.Title>Share Your Score</Dialog.Title>
          <Dialog.Content>
            <Text>
              Share your Picture Aim score of {score} points with a friend?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowShareDialog(false)}>Cancel</Button>
            <Button onPress={shareToChat}>Choose Friend</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Friend Picker Modal */}
      {currentFirebaseUser && (
        <FriendPickerModal
          visible={showFriendPicker}
          onDismiss={() => setShowFriendPicker(false)}
          onSelectFriend={handleSelectFriend}
          currentUserId={currentFirebaseUser.uid}
          title="Share Score With"
        />
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 8,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  headerSpacer: {
    width: 40,
  },
  statsBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingVertical: 6,
    zIndex: 10,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  playArea: {
    flex: 1,
    overflow: "hidden",
  },
  // Idle state
  idleContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  idleTitle: {
    fontSize: 36,
    fontWeight: "bold",
    marginTop: 16,
  },
  idleSubtext: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  personalBestText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 20,
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
    marginBottom: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  difficultyButton: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 72,
  },
  difficultyEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  difficultyLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 32,
  },
  startButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginLeft: 8,
  },
  // Targets
  targetTouchable: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  target: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  targetInner: {
    position: "absolute",
  },
  targetCenter: {
    position: "absolute",
  },
  // Floating text
  floatingText: {
    position: "absolute",
    fontSize: 18,
    fontWeight: "bold",
    width: 60,
    textAlign: "center",
    zIndex: 10,
  },
  // Result overlay
  resultOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  resultScore: {
    fontSize: 72,
    fontWeight: "bold",
    lineHeight: 80,
  },
  resultLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  newBestBadge: {
    fontSize: 22,
    color: "#FFD700",
    marginBottom: 16,
  },
  resultStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 16,
    marginBottom: 12,
  },
  resultStatItem: {
    alignItems: "center",
  },
  resultStatValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  resultStatLabel: {
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
  },
  personalBestResult: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 24,
  },
  resultActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  playAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  playAgainText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginLeft: 6,
  },
  shareButton: {
    borderRadius: 24,
  },
});
