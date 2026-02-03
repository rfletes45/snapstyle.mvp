/**
 * Level Up Animation Component
 *
 * Phase 7 of Profile Screen Overhaul
 *
 * Celebration animation when a user levels up:
 * - Level number zoom effect
 * - Progress ring burst
 * - XP counter animation
 * - Optional rewards display
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 7
 */

import React, { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// =============================================================================
// Types
// =============================================================================

export interface LevelUpAnimationProps {
  /** Previous level info */
  previousLevel: number;
  /** New level info */
  newLevel: number;
  /** XP gained to trigger level up */
  xpGained?: number;
  /** Whether the animation is visible */
  visible: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Animation duration in ms */
  duration?: number;
  /** Optional rewards unlocked at this level */
  rewards?: Array<{ type: string; name: string; icon: string }>;
}

interface RingBurstProps {
  progress: SharedValue<number>;
  size: number;
  color: string;
  delay: number;
}

// =============================================================================
// Constants
// =============================================================================

const ANIMATION_DURATION = 3000;
const RING_SIZE = 200;

/**
 * Level milestone colors
 */
function getLevelColor(level: number): { primary: string; secondary: string } {
  if (level >= 50) return { primary: "#F59E0B", secondary: "#FCD34D" }; // Gold
  if (level >= 40) return { primary: "#A855F7", secondary: "#C084FC" }; // Purple
  if (level >= 30) return { primary: "#EC4899", secondary: "#F472B6" }; // Pink
  if (level >= 20) return { primary: "#3B82F6", secondary: "#60A5FA" }; // Blue
  if (level >= 10) return { primary: "#22C55E", secondary: "#4ADE80" }; // Green
  return { primary: "#6366F1", secondary: "#818CF8" }; // Indigo
}

// =============================================================================
// Ring Burst Component
// =============================================================================

const RingBurst = memo<RingBurstProps>(function RingBurst({
  progress,
  size,
  color,
  delay,
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const prog = progress.value;
    const scale = interpolate(prog, [0, 1], [0.5, 2], Extrapolation.CLAMP);
    const opacity = interpolate(
      prog,
      [0, 0.2, 1],
      [0, 0.8, 0],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.ringBurst,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: color,
        },
        animatedStyle,
      ]}
    />
  );
});

// =============================================================================
// Sparkle Component
// =============================================================================

const Sparkle = memo<{
  index: number;
  progress: SharedValue<number>;
  containerSize: number;
  color: string;
}>(function Sparkle({ index, progress, containerSize, color }) {
  const angle = (index / 8) * Math.PI * 2;
  const distance = containerSize * 0.7;

  const animatedStyle = useAnimatedStyle(() => {
    const prog = progress.value;

    const x = Math.cos(angle) * distance * prog;
    const y = Math.sin(angle) * distance * prog;
    const scale = interpolate(
      prog,
      [0, 0.3, 0.7, 1],
      [0, 1.5, 1, 0],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      prog,
      [0, 0.2, 0.8, 1],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    );
    const rotation = prog * 180;

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale },
        { rotate: `${rotation}deg` },
      ],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.sparkle, animatedStyle]}>
      <Text style={[styles.sparkleIcon, { color }]}>✦</Text>
    </Animated.View>
  );
});

// =============================================================================
// Progress Ring Component (Pure RN)
// =============================================================================

const ProgressRing = memo<{
  progress: SharedValue<number>;
  size: number;
  color: string;
}>(function ProgressRing({ progress, size, color }) {
  const animatedStyle = useAnimatedStyle(() => {
    const prog = progress.value;
    // Simulate progress ring with border
    const borderWidth = 8 * prog;

    return {
      borderWidth,
      borderColor: color,
    };
  });

  return (
    <Animated.View
      style={[
        styles.progressRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        animatedStyle,
      ]}
    />
  );
});

// =============================================================================
// Main Level Up Animation Component
// =============================================================================

export const LevelUpAnimation = memo<LevelUpAnimationProps>(
  function LevelUpAnimation({
    previousLevel,
    newLevel,
    xpGained = 0,
    visible,
    onComplete,
    duration = ANIMATION_DURATION,
    rewards = [],
  }) {
    const theme = useTheme();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const [displayedLevel, setDisplayedLevel] = useState(previousLevel);

    const colors = getLevelColor(newLevel);

    // Animation values
    const overlayOpacity = useSharedValue(0);
    const levelScale = useSharedValue(0);
    const levelOpacity = useSharedValue(0);
    const ringProgress = useSharedValue(0);
    const ringBurstProgress = useSharedValue(0);
    const sparkleProgress = useSharedValue(0);
    const textOpacity = useSharedValue(0);
    const textTranslateY = useSharedValue(30);
    const numberCountUp = useSharedValue(previousLevel);
    const rewardsOpacity = useSharedValue(0);
    const rewardsTranslateY = useSharedValue(20);
    const pulseScale = useSharedValue(1);

    // Handle animation completion
    const handleComplete = useCallback(() => {
      onComplete?.();
    }, [onComplete]);

    // Update displayed level number during animation
    useDerivedValue(() => {
      const currentLevel = Math.round(numberCountUp.value);
      runOnJS(setDisplayedLevel)(currentLevel);
    });

    // Start animation when visible changes
    useEffect(() => {
      if (visible) {
        // Reset values
        overlayOpacity.value = 0;
        levelScale.value = 0;
        levelOpacity.value = 0;
        ringProgress.value = 0;
        ringBurstProgress.value = 0;
        sparkleProgress.value = 0;
        textOpacity.value = 0;
        textTranslateY.value = 30;
        numberCountUp.value = previousLevel;
        rewardsOpacity.value = 0;
        rewardsTranslateY.value = 20;
        pulseScale.value = 1;

        // Animate overlay
        overlayOpacity.value = withTiming(1, { duration: 200 });

        // Level text entrance
        levelOpacity.value = withDelay(100, withTiming(1, { duration: 200 }));
        levelScale.value = withDelay(
          100,
          withSequence(
            withSpring(1.3, { damping: 6, stiffness: 150 }),
            withSpring(1, { damping: 10, stiffness: 200 }),
          ),
        );

        // Count up animation
        numberCountUp.value = withDelay(
          200,
          withTiming(newLevel, {
            duration: 600,
            easing: Easing.out(Easing.cubic),
          }),
        );

        // Ring fill animation
        ringProgress.value = withDelay(
          200,
          withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
        );

        // Ring burst
        ringBurstProgress.value = withDelay(
          600,
          withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
        );

        // Sparkles
        sparkleProgress.value = withDelay(
          500,
          withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
        );

        // Pulse effect
        pulseScale.value = withDelay(
          800,
          withRepeat(
            withSequence(
              withTiming(1.1, { duration: 400 }),
              withTiming(1, { duration: 400 }),
            ),
            3,
            false,
          ),
        );

        // Level up text
        textOpacity.value = withDelay(700, withTiming(1, { duration: 300 }));
        textTranslateY.value = withDelay(700, withSpring(0, { damping: 15 }));

        // Rewards
        if (rewards.length > 0) {
          rewardsOpacity.value = withDelay(
            1200,
            withTiming(1, { duration: 300 }),
          );
          rewardsTranslateY.value = withDelay(
            1200,
            withSpring(0, { damping: 15 }),
          );
        }

        // Complete and dismiss
        const timeout = setTimeout(() => {
          overlayOpacity.value = withTiming(
            0,
            { duration: 300 },
            (finished) => {
              if (finished) {
                runOnJS(handleComplete)();
              }
            },
          );
        }, duration - 300);

        return () => clearTimeout(timeout);
      }
    }, [
      visible,
      previousLevel,
      newLevel,
      duration,
      rewards.length,
      handleComplete,
    ]);

    // Animated styles
    const overlayStyle = useAnimatedStyle(() => ({
      opacity: overlayOpacity.value,
    }));

    const levelContainerStyle = useAnimatedStyle(() => ({
      transform: [{ scale: levelScale.value * pulseScale.value }],
      opacity: levelOpacity.value,
    }));

    const textStyle = useAnimatedStyle(() => ({
      opacity: textOpacity.value,
      transform: [{ translateY: textTranslateY.value }],
    }));

    const rewardsStyle = useAnimatedStyle(() => ({
      opacity: rewardsOpacity.value,
      transform: [{ translateY: rewardsTranslateY.value }],
    }));

    if (!visible) return null;

    return (
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.5)" },
          ]}
        />

        {/* Main content */}
        <View style={styles.content}>
          {/* Ring bursts */}
          <View style={styles.ringBurstContainer}>
            <RingBurst
              progress={ringBurstProgress}
              size={RING_SIZE}
              color={colors.primary}
              delay={0}
            />
            <RingBurst
              progress={ringBurstProgress}
              size={RING_SIZE * 1.2}
              color={colors.secondary}
              delay={100}
            />
          </View>

          {/* Sparkles */}
          <View
            style={[
              styles.sparklesContainer,
              { width: RING_SIZE, height: RING_SIZE },
            ]}
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <Sparkle
                key={index}
                index={index}
                progress={sparkleProgress}
                containerSize={RING_SIZE}
                color={colors.secondary}
              />
            ))}
          </View>

          {/* Progress ring and level number */}
          <Animated.View style={levelContainerStyle}>
            <ProgressRing
              progress={ringProgress}
              size={RING_SIZE}
              color={colors.primary}
            />

            {/* Level number */}
            <View style={styles.levelNumberContainer}>
              <Text style={[styles.levelNumber, { color: colors.primary }]}>
                {displayedLevel}
              </Text>
            </View>
          </Animated.View>

          {/* Level up text */}
          <Animated.View style={[styles.textContainer, textStyle]}>
            <Text style={styles.levelUpText}>LEVEL UP!</Text>
            <Text style={[styles.newLevelText, { color: colors.primary }]}>
              You reached Level {newLevel}
            </Text>
            {xpGained > 0 && (
              <Text style={styles.xpText}>+{xpGained.toLocaleString()} XP</Text>
            )}
          </Animated.View>

          {/* Rewards */}
          {rewards.length > 0 && (
            <Animated.View style={[styles.rewardsContainer, rewardsStyle]}>
              <Text style={styles.rewardsTitle}>Rewards Unlocked</Text>
              <View style={styles.rewardsList}>
                {rewards.map((reward, index) => (
                  <View key={index} style={styles.rewardItem}>
                    <Text style={styles.rewardIcon}>{reward.icon}</Text>
                    <Text style={styles.rewardName}>{reward.name}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    );
  },
);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringBurstContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ringBurst: {
    position: "absolute",
  },
  sparklesContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  sparkle: {
    position: "absolute",
  },
  sparkleIcon: {
    fontSize: 24,
  },
  progressRing: {
    borderWidth: 0,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  levelNumberContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  levelNumber: {
    fontSize: 72,
    fontWeight: "bold",
  },
  textContainer: {
    alignItems: "center",
    marginTop: 32,
    paddingHorizontal: 24,
  },
  levelUpText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    textTransform: "uppercase",
    letterSpacing: 4,
    marginBottom: 8,
  },
  newLevelText: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  xpText: {
    fontSize: 18,
    color: "#22C55E",
    fontWeight: "600",
  },
  rewardsContainer: {
    marginTop: 32,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 16,
    minWidth: 200,
  },
  rewardsTitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 12,
  },
  rewardsList: {
    gap: 8,
  },
  rewardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rewardIcon: {
    fontSize: 20,
  },
  rewardName: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});

export default LevelUpAnimation;
