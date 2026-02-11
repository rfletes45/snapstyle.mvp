/**
 * DailyChallengeCard Component
 *
 * Featured card for the daily challenge displayed at the top of the Games Hub.
 * Shows the challenge game, rewards, and countdown to reset.
 *
 * @see constants/gamesTheme.ts for color tokens
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import {
  GAME_ANIMATIONS,
  GAME_BORDER_RADIUS,
  GAME_SHADOWS,
  GAME_SPACING,
} from "@/constants/gamesTheme";

// =============================================================================
// Types
// =============================================================================

export interface DailyChallengeData {
  /** The game type for today's challenge */
  gameType: ExtendedGameType;
  /** Challenge description */
  description: string;
  /** Coin reward for completing */
  coinReward: number;
  /** XP reward for completing */
  xpReward: number;
  /** Target to complete (e.g., score 50 points) */
  target?: number;
  /** Current progress toward target */
  progress?: number;
  /** Whether challenge is completed */
  isCompleted: boolean;
  /** Timestamp when challenge resets (midnight UTC) */
  resetsAt: number;
}

export interface DailyChallengeCardProps {
  /** Challenge data */
  challenge: DailyChallengeData;
  /** Called when play button is pressed */
  onPlay: () => void;
  /** Card style variant */
  variant?: "default" | "compact";
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTimeRemaining(resetsAt: number): string {
  const now = Date.now();
  const diff = resetsAt - now;

  if (diff <= 0) return "Resetting...";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// =============================================================================
// Countdown Timer Hook
// =============================================================================

function useCountdown(resetsAt: number) {
  const [timeRemaining, setTimeRemaining] = useState(
    formatTimeRemaining(resetsAt),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(resetsAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [resetsAt]);

  return timeRemaining;
}

// =============================================================================
// Star Animation Component
// =============================================================================

function StarDecoration() {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 20000 }),
      -1,
      false,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 2000 }),
        withTiming(1, { duration: 2000 }),
      ),
      -1,
      true,
    );
  }, [rotation, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  return (
    <Animated.Text style={[styles.starDecoration, animatedStyle]}>
      ⭐
    </Animated.Text>
  );
}

// =============================================================================
// Progress Bar Component
// =============================================================================

function ProgressBar({
  progress,
  target,
  isCompleted,
}: {
  progress: number;
  target: number;
  isCompleted: boolean;
}) {
  const theme = useTheme();
  const progressPercent = Math.min((progress / target) * 100, 100);
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withSpring(
      progressPercent,
      GAME_ANIMATIONS.spring.gentle,
    );
  }, [progressPercent, progressWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  return (
    <View style={styles.progressContainer}>
      <View
        style={[
          styles.progressTrack,
          { backgroundColor: "rgba(255, 255, 255, 0.2)" },
        ]}
      >
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: isCompleted ? "#4CAF50" : "#FFFFFF",
            },
            progressStyle,
          ]}
        />
      </View>
      <Text style={styles.progressText}>
        {progress}/{target}
      </Text>
    </View>
  );
}

// =============================================================================
// Reward Badge Component
// =============================================================================

function RewardBadge({ icon, value }: { icon: string; value: number }) {
  return (
    <View style={styles.rewardBadge}>
      <Text style={styles.rewardIcon}>{icon}</Text>
      <Text style={styles.rewardValue}>{value}</Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DailyChallengeCard({
  challenge,
  onPlay,
  variant = "default",
}: DailyChallengeCardProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";

  const timeRemaining = useCountdown(challenge.resetsAt);
  const metadata = GAME_METADATA[challenge.gameType];

  // Animation for completed state
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.98, { duration: 100 }),
      withSpring(1, GAME_ANIMATIONS.spring.snappy),
    );
    onPlay();
  };

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const backgroundColor = challenge.isCompleted
    ? "#2E7D32" // Green for completed
    : "#6C5CE7"; // Purple

  if (variant === "compact") {
    return (
      <Animated.View style={cardStyle}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.9}
          disabled={challenge.isCompleted}
        >
          <View
            style={[styles.compactCard, { backgroundColor }, GAME_SHADOWS.md]}
          >
            {/* Game Icon */}
            <View style={styles.compactIconContainer}>
              <Text style={styles.compactIcon}>{metadata?.icon || "🎮"}</Text>
            </View>

            {/* Info */}
            <View style={styles.compactInfo}>
              <Text style={styles.compactTitle}>Daily Challenge</Text>
              <Text style={styles.compactGame} numberOfLines={1}>
                {metadata?.name || challenge.gameType}
              </Text>
            </View>

            {/* Status */}
            {challenge.isCompleted ? (
              <View style={styles.completedBadge}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color="#FFFFFF"
                />
              </View>
            ) : (
              <View style={styles.compactRewards}>
                <Text style={styles.compactRewardText}>
                  🪙 {challenge.coinReward}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={cardStyle}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        disabled={challenge.isCompleted}
      >
        <View style={[styles.card, { backgroundColor }, GAME_SHADOWS.lg]}>
          {/* Decorations */}
          <View style={styles.decorationsContainer}>
            <StarDecoration />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons
                name="star-circle"
                size={20}
                color="rgba(255, 255, 255, 0.9)"
              />
              <Text style={styles.headerTitle}>DAILY CHALLENGE</Text>
            </View>
            <View style={styles.timerContainer}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={14}
                color="rgba(255, 255, 255, 0.8)"
              />
              <Text style={styles.timerText}>{timeRemaining}</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Game Info */}
            <View style={styles.gameRow}>
              <View style={styles.gameIconContainer}>
                <Text style={styles.gameIcon}>{metadata?.icon || "🎮"}</Text>
              </View>
              <View style={styles.gameInfo}>
                <Text style={styles.gameName}>
                  {metadata?.name || challenge.gameType}
                </Text>
                <Text style={styles.challengeDescription}>
                  {challenge.description}
                </Text>
              </View>
            </View>

            {/* Progress (if has target) */}
            {challenge.target !== undefined &&
              challenge.progress !== undefined && (
                <ProgressBar
                  progress={challenge.progress}
                  target={challenge.target}
                  isCompleted={challenge.isCompleted}
                />
              )}

            {/* Rewards Row */}
            <View style={styles.rewardsRow}>
              <Text style={styles.rewardsLabel}>Rewards:</Text>
              <View style={styles.rewardBadges}>
                <RewardBadge icon="🪙" value={challenge.coinReward} />
                <RewardBadge icon="⚡" value={challenge.xpReward} />
              </View>
            </View>
          </View>

          {/* Action */}
          <View style={styles.actionContainer}>
            {challenge.isCompleted ? (
              <View style={styles.completedContainer}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={styles.completedText}>COMPLETED!</Text>
              </View>
            ) : (
              <View style={styles.playButton}>
                <MaterialCommunityIcons
                  name="play-circle"
                  size={20}
                  color={backgroundColor}
                />
                <Text
                  style={[styles.playButtonText, { color: backgroundColor }]}
                >
                  PLAY NOW
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// Empty State
// =============================================================================

export function DailyChallengeEmpty() {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.emptyCard,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <MaterialCommunityIcons
        name="calendar-clock"
        size={32}
        color={theme.colors.onSurfaceVariant}
      />
      <Text
        style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
      >
        Daily challenge loading...
      </Text>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Default Card
  card: {
    borderRadius: GAME_BORDER_RADIUS.lg,
    padding: GAME_SPACING.md,
    marginBottom: GAME_SPACING.md,
    overflow: "hidden",
  },
  decorationsContainer: {
    position: "absolute",
    top: GAME_SPACING.sm,
    right: GAME_SPACING.sm,
  },
  starDecoration: {
    fontSize: 20,
    opacity: 0.6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: GAME_SPACING.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.xs,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255, 255, 255, 0.9)",
    letterSpacing: 1,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    paddingHorizontal: GAME_SPACING.sm,
    paddingVertical: 4,
    borderRadius: GAME_BORDER_RADIUS.sm,
  },
  timerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    fontFamily: "monospace",
  },
  content: {
    gap: GAME_SPACING.md,
  },
  gameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.md,
  },
  gameIconContainer: {
    width: 56,
    height: 56,
    borderRadius: GAME_BORDER_RADIUS.md,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  gameIcon: {
    fontSize: 28,
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  challengeDescription: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.sm,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    minWidth: 40,
    textAlign: "right",
  },
  rewardsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.sm,
  },
  rewardsLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
  },
  rewardBadges: {
    flexDirection: "row",
    gap: GAME_SPACING.sm,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: GAME_SPACING.sm,
    paddingVertical: 4,
    borderRadius: GAME_BORDER_RADIUS.sm,
  },
  rewardIcon: {
    fontSize: 14,
  },
  rewardValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionContainer: {
    marginTop: GAME_SPACING.md,
    alignItems: "center",
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.xs,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: GAME_SPACING.lg,
    paddingVertical: GAME_SPACING.sm,
    borderRadius: GAME_BORDER_RADIUS.round,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  completedContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.xs,
  },
  completedText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },

  // Compact Card
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: GAME_BORDER_RADIUS.md,
    padding: GAME_SPACING.sm,
    marginBottom: GAME_SPACING.sm,
  },
  compactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: GAME_BORDER_RADIUS.sm,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: GAME_SPACING.sm,
  },
  compactIcon: {
    fontSize: 20,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.5,
  },
  compactGame: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  compactRewards: {
    paddingHorizontal: GAME_SPACING.sm,
  },
  compactRewardText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  completedBadge: {
    paddingHorizontal: GAME_SPACING.sm,
  },

  // Empty State
  emptyCard: {
    borderRadius: GAME_BORDER_RADIUS.lg,
    padding: GAME_SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: GAME_SPACING.md,
  },
  emptyText: {
    fontSize: 14,
    marginTop: GAME_SPACING.sm,
  },
});

export default DailyChallengeCard;
