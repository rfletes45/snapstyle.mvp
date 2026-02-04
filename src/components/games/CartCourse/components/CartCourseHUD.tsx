/**
 * CartCourseHUD - Phase 7
 * Heads-Up Display showing score, lives, timer, and area info
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

// ============================================
// HUD Configuration
// ============================================

export interface HUDConfig {
  showLives: boolean;
  showScore: boolean;
  showTimer: boolean;
  showArea: boolean;
  showBananas: boolean;
  showCoins: boolean;
  animateChanges: boolean;
}

export const DEFAULT_HUD_CONFIG: HUDConfig = {
  showLives: true,
  showScore: true,
  showTimer: true,
  showArea: true,
  showBananas: true,
  showCoins: false,
  animateChanges: true,
};

// ============================================
// HUD Props
// ============================================

export interface CartCourseHUDProps {
  lives: number;
  maxLives: number;
  score: number;
  highScore?: number;
  elapsedTimeMs: number;
  maxTimeMs: number;
  currentArea: number;
  totalAreas: number;
  bananasCollected: number;
  totalBananas: number;
  coinsCollected?: number;
  totalCoins?: number;
  isPaused?: boolean;
  isWarningTime?: boolean;
  isCriticalTime?: boolean;
  config?: Partial<HUDConfig>;
  onPausePress?: () => void;
}

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format milliseconds to MM:SS or M:SS
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format remaining time
 */
export function formatRemainingTime(elapsedMs: number, maxMs: number): string {
  const remainingMs = Math.max(0, maxMs - elapsedMs);
  return formatTime(remainingMs);
}

/**
 * Format score with commas
 */
export function formatScore(score: number): string {
  return score.toLocaleString();
}

// ============================================
// Animated Score Component
// ============================================

interface AnimatedScoreProps {
  score: number;
  animate: boolean;
}

const AnimatedScore: React.FC<AnimatedScoreProps> = ({ score, animate }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevScore = useRef(score);

  useEffect(() => {
    if (animate && score > prevScore.current) {
      // Pop animation on score increase
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevScore.current = score;
  }, [score, animate, scaleAnim]);

  return (
    <Animated.Text
      style={[styles.scoreValue, { transform: [{ scale: scaleAnim }] }]}
    >
      {formatScore(score)}
    </Animated.Text>
  );
};

// ============================================
// Animated Lives Component
// ============================================

interface AnimatedLivesProps {
  lives: number;
  maxLives: number;
  animate: boolean;
}

const AnimatedLives: React.FC<AnimatedLivesProps> = ({
  lives,
  maxLives,
  animate,
}) => {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevLives = useRef(lives);

  useEffect(() => {
    if (!animate) return;

    if (lives < prevLives.current) {
      // Shake animation on life lost
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 5,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (lives > prevLives.current) {
      // Pop animation on extra life
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.5,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevLives.current = lives;
  }, [lives, animate, shakeAnim, scaleAnim]);

  // Render heart icons
  const hearts = [];
  for (let i = 0; i < maxLives; i++) {
    const isFilled = i < lives;
    hearts.push(
      <Text key={i} style={[styles.heartIcon, !isFilled && styles.heartEmpty]}>
        {isFilled ? "❤️" : "🖤"}
      </Text>,
    );
  }

  return (
    <Animated.View
      style={[
        styles.livesContainer,
        {
          transform: [{ translateX: shakeAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      {hearts}
    </Animated.View>
  );
};

// ============================================
// Timer Component
// ============================================

interface TimerDisplayProps {
  elapsedMs: number;
  maxMs: number;
  isWarning: boolean;
  isCritical: boolean;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({
  elapsedMs,
  maxMs,
  isWarning,
  isCritical,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isCritical) {
      // Pulsing animation when critical
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isCritical, pulseAnim]);

  const timeColor = isCritical ? "#ff1744" : isWarning ? "#ff9100" : "#ffffff";

  return (
    <Animated.View
      style={[styles.timerContainer, { transform: [{ scale: pulseAnim }] }]}
    >
      <Text style={styles.timerIcon}>⏱️</Text>
      <Text style={[styles.timerValue, { color: timeColor }]}>
        {formatRemainingTime(elapsedMs, maxMs)}
      </Text>
    </Animated.View>
  );
};

// ============================================
// Banana Counter Component
// ============================================

interface BananaCounterProps {
  collected: number;
  total: number;
  animate: boolean;
}

const BananaCounter: React.FC<BananaCounterProps> = ({
  collected,
  total,
  animate,
}) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const prevCollected = useRef(collected);

  useEffect(() => {
    if (animate && collected > prevCollected.current) {
      // Bounce animation on collect
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevCollected.current = collected;
  }, [collected, animate, bounceAnim]);

  const isComplete = collected >= total;

  return (
    <Animated.View
      style={[
        styles.bananaContainer,
        { transform: [{ translateY: bounceAnim }] },
      ]}
    >
      <Text style={styles.bananaIcon}>🍌</Text>
      <Text style={[styles.bananaValue, isComplete && styles.bananaComplete]}>
        {collected}/{total}
      </Text>
    </Animated.View>
  );
};

// ============================================
// Area Indicator Component
// ============================================

interface AreaIndicatorProps {
  current: number;
  total: number;
}

const AreaIndicator: React.FC<AreaIndicatorProps> = ({ current, total }) => {
  return (
    <View style={styles.areaContainer}>
      <Text style={styles.areaLabel}>Area</Text>
      <Text style={styles.areaValue}>
        {current}/{total}
      </Text>
    </View>
  );
};

// ============================================
// Progress Bar Component
// ============================================

interface ProgressBarProps {
  progress: number; // 0-1
  color?: string;
  backgroundColor?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = "#4CAF50",
  backgroundColor = "rgba(255, 255, 255, 0.2)",
  height = 4,
}) => {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <View style={[styles.progressBarBg, { height, backgroundColor }]}>
      <View
        style={[
          styles.progressBarFill,
          {
            width: `${clampedProgress * 100}%`,
            backgroundColor: color,
            height,
          },
        ]}
      />
    </View>
  );
};

// ============================================
// Pause Button Component
// ============================================

interface PauseButtonProps {
  onPress: () => void;
  isPaused: boolean;
}

export const PauseButton: React.FC<PauseButtonProps> = ({
  onPress,
  isPaused,
}) => {
  return (
    <Text style={styles.pauseButton} onPress={onPress}>
      {isPaused ? "▶️" : "⏸️"}
    </Text>
  );
};

// ============================================
// Main HUD Component
// ============================================

export const CartCourseHUD: React.FC<CartCourseHUDProps> = ({
  lives,
  maxLives,
  score,
  highScore,
  elapsedTimeMs,
  maxTimeMs,
  currentArea,
  totalAreas,
  bananasCollected,
  totalBananas,
  coinsCollected = 0,
  totalCoins = 0,
  isPaused = false,
  isWarningTime = false,
  isCriticalTime = false,
  config = {},
  onPausePress,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const mergedConfig = { ...DEFAULT_HUD_CONFIG, ...config };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Top Row */}
      <View style={styles.topRow}>
        {/* Top Left: Lives and Area */}
        <View style={styles.topLeft}>
          {mergedConfig.showLives && (
            <AnimatedLives
              lives={lives}
              maxLives={maxLives}
              animate={mergedConfig.animateChanges}
            />
          )}
          {mergedConfig.showArea && (
            <AreaIndicator current={currentArea} total={totalAreas} />
          )}
        </View>

        {/* Top Center: Bananas */}
        <View style={styles.topCenter}>
          {mergedConfig.showBananas && (
            <BananaCounter
              collected={bananasCollected}
              total={totalBananas}
              animate={mergedConfig.animateChanges}
            />
          )}
          {mergedConfig.showCoins && totalCoins > 0 && (
            <View style={styles.coinContainer}>
              <Text style={styles.coinIcon}>🪙</Text>
              <Text style={styles.coinValue}>
                {coinsCollected}/{totalCoins}
              </Text>
            </View>
          )}
        </View>

        {/* Top Right: Timer, Score, Pause */}
        <View style={styles.topRight}>
          {mergedConfig.showTimer && (
            <TimerDisplay
              elapsedMs={elapsedTimeMs}
              maxMs={maxTimeMs}
              isWarning={isWarningTime}
              isCritical={isCriticalTime}
            />
          )}
          {mergedConfig.showScore && (
            <View style={styles.scoreContainer}>
              <AnimatedScore
                score={score}
                animate={mergedConfig.animateChanges}
              />
              {highScore !== undefined && score > highScore && (
                <Text style={styles.newHighScore}>NEW!</Text>
              )}
            </View>
          )}
          {onPausePress && (
            <PauseButton onPress={onPausePress} isPaused={isPaused} />
          )}
        </View>
      </View>

      {/* Course Progress Bar */}
      <View style={styles.progressBarContainer}>
        <ProgressBar progress={(currentArea - 1) / totalAreas} />
      </View>
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50, // Safe area
    paddingHorizontal: 16,
    zIndex: 100,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  // Top Left
  topLeft: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  livesContainer: {
    flexDirection: "row",
    marginBottom: 4,
  },
  heartIcon: {
    fontSize: 20,
    marginRight: 2,
  },
  heartEmpty: {
    opacity: 0.4,
  },
  areaContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  areaLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10,
    fontWeight: "600",
  },
  areaValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Top Center
  topCenter: {
    flexDirection: "column",
    alignItems: "center",
  },
  bananaContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bananaIcon: {
    fontSize: 24,
    marginRight: 4,
  },
  bananaValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  bananaComplete: {
    color: "#4CAF50",
  },
  coinContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  coinIcon: {
    fontSize: 18,
    marginRight: 4,
  },
  coinValue: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "bold",
  },

  // Top Right
  topRight: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  timerIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  timerValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"],
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  scoreValue: {
    color: "#FFD700",
    fontSize: 20,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"],
  },
  newHighScore: {
    color: "#ff6b6b",
    fontSize: 10,
    fontWeight: "bold",
    marginLeft: 4,
  },
  pauseButton: {
    fontSize: 24,
    marginTop: 8,
    padding: 4,
  },

  // Progress Bar
  progressBarContainer: {
    marginTop: 12,
  },
  progressBarBg: {
    width: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    borderRadius: 2,
  },
});

export default CartCourseHUD;
