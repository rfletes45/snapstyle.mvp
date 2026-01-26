/**
 * GameOverModal Component
 *
 * Animated modal displayed when a game ends showing:
 * - Win/Loss/Draw result with celebration
 * - Final score and statistics
 * - Achievement unlocks
 * - Rating changes (multiplayer)
 * - Action buttons (rematch, share, exit)
 *
 * @see constants/gamesTheme.ts for color tokens
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import {
  Dimensions,
  Modal,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Button, Portal, Text, useTheme } from "react-native-paper";
import Animated, {
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import {
  AchievementNotification,
  GameAchievementDefinition,
} from "@/types/achievements";
import {
  ACHIEVEMENT_TIER_COLORS,
  GAME_ANIMATIONS,
  GAME_BORDER_RADIUS,
  GAME_SHADOWS,
  GAME_SPACING,
  GAME_STATUS_COLORS,
  GAME_TYPOGRAPHY,
} from "../../../constants/gamesTheme";

// =============================================================================
// Types
// =============================================================================

export type GameResult = "win" | "loss" | "draw";

export interface GameOverStats {
  /** Final score (for single player) */
  score?: number;
  /** Personal best score */
  personalBest?: number;
  /** Whether this is a new personal best */
  isNewBest?: boolean;
  /** Total moves made */
  moves?: number;
  /** Time taken in seconds */
  timeSeconds?: number;
  /** Rating change (for multiplayer) */
  ratingChange?: number;
  /** New rating (for multiplayer) */
  newRating?: number;
  /** Opponent name */
  opponentName?: string;
  /** Win method (e.g., "Checkmate", "Resignation") */
  winMethod?: string;
}

export interface GameOverModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Game result */
  result: GameResult;
  /** Game statistics */
  stats: GameOverStats;
  /** Achievements earned in this game */
  achievements?: AchievementNotification[];
  /** Called when rematch is pressed */
  onRematch?: () => void;
  /** Called when share is pressed */
  onShare?: () => void;
  /** Called when exit is pressed */
  onExit: () => void;
  /** Whether to show rematch button */
  showRematch?: boolean;
  /** Whether to show share button */
  showShare?: boolean;
  /** Custom title override */
  title?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getResultConfig(result: GameResult, isDarkMode: boolean) {
  const colors = GAME_STATUS_COLORS;

  switch (result) {
    case "win":
      return {
        title: "VICTORY! 🏆",
        emoji: "🎉",
        bgColor: isDarkMode ? colors.victory.bg.dark : colors.victory.bg.light,
        textColor: isDarkMode
          ? colors.victory.text.dark
          : colors.victory.text.light,
        confetti: true,
      };
    case "loss":
      return {
        title: "DEFEAT 💔",
        emoji: "😢",
        bgColor: isDarkMode ? colors.defeat.bg.dark : colors.defeat.bg.light,
        textColor: isDarkMode
          ? colors.defeat.text.dark
          : colors.defeat.text.light,
        confetti: false,
      };
    case "draw":
      return {
        title: "DRAW 🤝",
        emoji: "😐",
        bgColor: isDarkMode ? colors.draw.bg.dark : colors.draw.bg.light,
        textColor: isDarkMode ? colors.draw.text.dark : colors.draw.text.light,
        confetti: false,
      };
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// =============================================================================
// Confetti Particle
// =============================================================================

function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  const { width } = Dimensions.get("window");
  const startX = Math.random() * width;
  const translateX = useSharedValue(startX);
  const translateY = useSharedValue(-50);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(600, { duration: 2000 + Math.random() * 1000 }),
    );
    translateX.value = withDelay(
      delay,
      withSequence(
        withTiming(startX + (Math.random() - 0.5) * 100, { duration: 500 }),
        withTiming(startX + (Math.random() - 0.5) * 200, { duration: 1500 }),
      ),
    );
    rotate.value = withDelay(
      delay,
      withTiming(Math.random() * 720, { duration: 2000 }),
    );
    opacity.value = withDelay(1500 + delay, withTiming(0, { duration: 500 }));
  }, [delay, startX, translateX, translateY, rotate, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

// =============================================================================
// Confetti Component
// =============================================================================

function Confetti() {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#FFD93D",
    "#6C5CE7",
    "#FF8CC8",
    "#95E1D3",
  ];
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    delay: Math.random() * 500,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  return (
    <View style={styles.confettiContainer} pointerEvents="none">
      {particles.map((particle) => (
        <ConfettiParticle
          key={particle.id}
          delay={particle.delay}
          color={particle.color}
        />
      ))}
    </View>
  );
}

// =============================================================================
// Achievement Card (Mini)
// =============================================================================

function AchievementUnlocked({
  achievement,
}: {
  achievement: GameAchievementDefinition;
}) {
  const theme = useTheme();
  const tierColors = ACHIEVEMENT_TIER_COLORS[achievement.tier];

  return (
    <Animated.View
      entering={ZoomIn.delay(400).springify()}
      style={[
        styles.achievementCard,
        {
          backgroundColor: theme.colors.surface,
          borderLeftColor: tierColors.primary,
        },
      ]}
    >
      <View style={styles.achievementIcon}>
        <Text style={{ fontSize: 24 }}>{achievement.icon}</Text>
      </View>
      <View style={styles.achievementInfo}>
        <Text
          style={[styles.achievementUnlocked, { color: tierColors.primary }]}
        >
          🏆 Achievement Unlocked!
        </Text>
        <Text
          style={[styles.achievementName, { color: theme.colors.onSurface }]}
        >
          {achievement.name}
        </Text>
      </View>
    </Animated.View>
  );
}

// =============================================================================
// Stat Row Component
// =============================================================================

function StatRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.statRow}>
      <View style={styles.statLeft}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text
          style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[
          styles.statValue,
          {
            color: highlight ? theme.colors.primary : theme.colors.onSurface,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function GameOverModal({
  visible,
  result,
  stats,
  achievements = [],
  onRematch,
  onShare,
  onExit,
  showRematch = true,
  showShare = true,
  title,
}: GameOverModalProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";

  const resultConfig = getResultConfig(result, isDarkMode);

  // Haptic feedback on show
  useEffect(() => {
    if (visible) {
      if (result === "win") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (result === "loss") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  }, [visible, result]);

  // Animation values
  const titleScale = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      titleScale.value = withDelay(
        100,
        withSpring(1, GAME_ANIMATIONS.spring.bouncy),
      );
      contentOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
    } else {
      titleScale.value = 0;
      contentOpacity.value = 0;
    }
  }, [visible, titleScale, contentOpacity]);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <Portal>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onExit}
      >
        <View style={styles.overlay}>
          {/* Confetti for wins */}
          {resultConfig.confetti && <Confetti />}

          <Animated.View
            entering={SlideInDown.springify().damping(15)}
            style={[
              styles.modal,
              {
                backgroundColor: theme.colors.surface,
              },
              GAME_SHADOWS.lg,
            ]}
          >
            {/* Header */}
            <View
              style={[styles.header, { backgroundColor: resultConfig.bgColor }]}
            >
              <Animated.Text style={[styles.title, titleStyle]}>
                {title || resultConfig.title}
              </Animated.Text>

              {stats.winMethod && (
                <Text
                  style={[styles.winMethod, { color: resultConfig.textColor }]}
                >
                  {stats.winMethod}
                </Text>
              )}
            </View>

            {/* Content */}
            <Animated.View style={[styles.content, contentStyle]}>
              {/* Score / Rating Section */}
              {stats.score !== undefined && (
                <View style={styles.scoreSection}>
                  <Text
                    style={[
                      styles.scoreLabel,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    SCORE
                  </Text>
                  <Text
                    style={[styles.score, { color: theme.colors.onSurface }]}
                  >
                    {stats.score}
                  </Text>
                  {stats.isNewBest && (
                    <View style={styles.newBestBadge}>
                      <MaterialCommunityIcons
                        name="star"
                        size={16}
                        color="#FFD700"
                      />
                      <Text style={styles.newBestText}>NEW BEST!</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Rating Change (Multiplayer) */}
              {stats.ratingChange !== undefined &&
                stats.newRating !== undefined && (
                  <View style={styles.ratingSection}>
                    <Text
                      style={[
                        styles.ratingLabel,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      RATING
                    </Text>
                    <View style={styles.ratingRow}>
                      <Text
                        style={[
                          styles.rating,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        {stats.newRating}
                      </Text>
                      <Text
                        style={[
                          styles.ratingChange,
                          {
                            color:
                              stats.ratingChange >= 0 ? "#4CAF50" : "#F44336",
                          },
                        ]}
                      >
                        {stats.ratingChange >= 0 ? "+" : ""}
                        {stats.ratingChange}
                      </Text>
                    </View>
                  </View>
                )}

              {/* Stats */}
              <View style={styles.statsSection}>
                {stats.moves !== undefined && (
                  <StatRow
                    icon="♟️"
                    label="Moves"
                    value={stats.moves.toString()}
                  />
                )}
                {stats.timeSeconds !== undefined && (
                  <StatRow
                    icon="⏱️"
                    label="Time"
                    value={formatTime(stats.timeSeconds)}
                  />
                )}
                {stats.personalBest !== undefined && !stats.isNewBest && (
                  <StatRow
                    icon="🏆"
                    label="Best"
                    value={stats.personalBest.toString()}
                  />
                )}
                {stats.opponentName && (
                  <StatRow
                    icon="👤"
                    label="Opponent"
                    value={stats.opponentName}
                  />
                )}
              </View>

              {/* Achievements */}
              {achievements.length > 0 && (
                <View style={styles.achievementsSection}>
                  {achievements.slice(0, 2).map((notification) => (
                    <AchievementUnlocked
                      key={notification.achievement.id}
                      achievement={notification.achievement}
                    />
                  ))}
                  {achievements.length > 2 && (
                    <Text
                      style={[
                        styles.moreAchievements,
                        { color: theme.colors.primary },
                      ]}
                    >
                      +{achievements.length - 2} more achievements
                    </Text>
                  )}
                </View>
              )}
            </Animated.View>

            {/* Actions */}
            <View style={styles.actions}>
              {/* Row 1: Primary actions */}
              <View style={styles.primaryActions}>
                {showRematch && onRematch && (
                  <Button
                    mode="contained"
                    icon="reload"
                    onPress={onRematch}
                    style={styles.actionButton}
                  >
                    Rematch
                  </Button>
                )}
                {showShare && onShare && (
                  <Button
                    mode="outlined"
                    icon="share"
                    onPress={onShare}
                    style={styles.actionButton}
                  >
                    Share
                  </Button>
                )}
              </View>

              {/* Exit Button */}
              <TouchableOpacity style={styles.exitButton} onPress={onExit}>
                <MaterialCommunityIcons
                  name="home"
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.exitText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Back to Hub
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </Portal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: GAME_SPACING.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 360,
    borderRadius: GAME_BORDER_RADIUS.xl,
    overflow: "hidden",
  },
  header: {
    padding: GAME_SPACING.lg,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  winMethod: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: GAME_SPACING.xs,
  },
  content: {
    padding: GAME_SPACING.lg,
  },
  scoreSection: {
    alignItems: "center",
    marginBottom: GAME_SPACING.lg,
  },
  scoreLabel: {
    ...GAME_TYPOGRAPHY.statLabel,
    marginBottom: GAME_SPACING.xs,
  },
  score: {
    ...GAME_TYPOGRAPHY.score,
  },
  newBestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: GAME_SPACING.xs,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    paddingHorizontal: GAME_SPACING.sm,
    paddingVertical: 4,
    borderRadius: GAME_BORDER_RADIUS.sm,
  },
  newBestText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFD700",
  },
  ratingSection: {
    alignItems: "center",
    marginBottom: GAME_SPACING.lg,
  },
  ratingLabel: {
    ...GAME_TYPOGRAPHY.statLabel,
    marginBottom: GAME_SPACING.xs,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: GAME_SPACING.sm,
  },
  rating: {
    fontSize: 36,
    fontWeight: "800",
  },
  ratingChange: {
    fontSize: 18,
    fontWeight: "700",
  },
  statsSection: {
    marginBottom: GAME_SPACING.md,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: GAME_SPACING.xs,
  },
  statLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.sm,
  },
  statIcon: {
    fontSize: 16,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    ...GAME_TYPOGRAPHY.statValue,
  },
  achievementsSection: {
    marginTop: GAME_SPACING.md,
  },
  achievementCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: GAME_SPACING.sm,
    borderRadius: GAME_BORDER_RADIUS.md,
    borderLeftWidth: 4,
    marginBottom: GAME_SPACING.sm,
  },
  achievementIcon: {
    marginRight: GAME_SPACING.sm,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementUnlocked: {
    fontSize: 10,
    fontWeight: "700",
  },
  achievementName: {
    fontSize: 14,
    fontWeight: "600",
  },
  moreAchievements: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  actions: {
    padding: GAME_SPACING.lg,
    paddingTop: 0,
  },
  primaryActions: {
    flexDirection: "row",
    gap: GAME_SPACING.sm,
    marginBottom: GAME_SPACING.md,
  },
  actionButton: {
    flex: 1,
  },
  exitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: GAME_SPACING.xs,
    paddingVertical: GAME_SPACING.sm,
  },
  exitText: {
    fontSize: 14,
    fontWeight: "500",
  },

  // Confetti
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  confettiParticle: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});

export default GameOverModal;
