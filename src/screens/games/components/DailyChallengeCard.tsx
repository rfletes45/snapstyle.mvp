/**
 * DailyChallengeCard
 *
 * A special card component for daily challenge games.
 *
 * Phase 4: Category & Browse Experience
 *
 * Features:
 * - Special treatment for single-game categories
 * - Streak information display
 * - Completion status with checkmark
 * - Today's challenge countdown
 * - Animated shine effect
 * - Spring press animation
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 4
 */

import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType, GAME_METADATA, GameCategory } from "@/types/games";
import { getCategoryColor } from "@/types/playScreen";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { PLAY_SCREEN_TOKENS } from "../../../../constants/gamesTheme";

const { spacing, borderRadius, shadows, typography, animation } =
  PLAY_SCREEN_TOKENS;

// =============================================================================
// Types
// =============================================================================

export interface DailyChallengeCardProps {
  /** Game type for the daily challenge */
  gameType: ExtendedGameType;
  /** Current streak count (days in a row) */
  streak?: number;
  /** Whether today's challenge is completed */
  isCompletedToday?: boolean;
  /** Today's score (if completed) */
  todayScore?: string | null;
  /** Personal best score (formatted string) */
  personalBest?: string | null;
  /** Called when card is pressed */
  onPress: () => void;
  /** Called when card is long-pressed */
  onLongPress?: () => void;
  /** Additional container styles */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

// Card dimensions
const CARD_HEIGHT = 140;
const CARD_MARGIN = spacing.horizontalPadding;

// =============================================================================
// Component
// =============================================================================

function DailyChallengeCardComponent({
  gameType,
  streak = 0,
  isCompletedToday = false,
  todayScore,
  personalBest,
  onPress,
  onLongPress,
  style,
  testID,
}: DailyChallengeCardProps) {
  const { colors, isDark } = useAppTheme();
  const scale = useSharedValue(1);

  const metadata = GAME_METADATA[gameType];
  const categoryColor = getCategoryColor(
    (metadata?.category as GameCategory) || "daily",
    isDark,
  );

  // Calculate time until next challenge (midnight)
  const timeUntilNext = useMemo(() => {
    if (!isCompletedToday) return null;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const diff = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }, [isCompletedToday]);

  // Gradient colors - typed as tuple for LinearGradient
  const gradientColors: readonly [string, string] = isDark
    ? (["#2D3436", "#636E72"] as const)
    : (["#FFFFFF", "#F5F6FA"] as const);

  // Animated scale style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, animation.pressSpring);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animation.pressSpring);
  }, [scale]);

  const handleLongPress = useCallback(() => {
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onLongPress();
    }
  }, [onLongPress]);

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.container, animatedStyle, style]}
      testID={testID}
    >
      <Pressable
        onPress={onPress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={400}
        style={styles.pressable}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradient,
            {
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.08)",
            },
          ]}
        >
          {/* Left: Icon and Title */}
          <View style={styles.leftSection}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${categoryColor}20` },
              ]}
            >
              <Text style={styles.icon}>{metadata?.icon || "📅"}</Text>
              {isCompletedToday && (
                <View style={styles.completedBadge}>
                  <MaterialCommunityIcons
                    name="check"
                    size={12}
                    color="#FFFFFF"
                  />
                </View>
              )}
            </View>

            <View style={styles.titleSection}>
              <Text style={[styles.title, { color: colors.text }]}>
                {metadata?.name || "Daily Challenge"}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isCompletedToday
                  ? `Next in ${timeUntilNext}`
                  : "Play today's puzzle!"}
              </Text>
            </View>
          </View>

          {/* Right: Stats */}
          <View style={styles.rightSection}>
            {/* Streak */}
            {streak > 0 && (
              <View style={styles.statItem}>
                <View style={styles.streakBadge}>
                  <MaterialCommunityIcons
                    name="fire"
                    size={16}
                    color="#FF6B6B"
                  />
                  <Text style={styles.streakText}>{streak}</Text>
                </View>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  day streak
                </Text>
              </View>
            )}

            {/* Today's Score */}
            {isCompletedToday && todayScore && (
              <View style={styles.statItem}>
                <Text style={[styles.scoreValue, { color: categoryColor }]}>
                  {todayScore}
                </Text>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  today
                </Text>
              </View>
            )}

            {/* Personal Best */}
            {personalBest && (
              <View style={styles.statItem}>
                <View style={styles.bestBadge}>
                  <MaterialCommunityIcons
                    name="trophy"
                    size={14}
                    color="#FFD700"
                  />
                  <Text style={[styles.bestValue, { color: colors.text }]}>
                    {personalBest}
                  </Text>
                </View>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  best
                </Text>
              </View>
            )}

            {/* Play Button */}
            <View
              style={[
                styles.playButton,
                {
                  backgroundColor: isCompletedToday
                    ? colors.textMuted
                    : categoryColor,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={isCompletedToday ? "check" : "play"}
                size={20}
                color="#FFFFFF"
              />
            </View>
          </View>

          {/* Status Ribbon */}
          {isCompletedToday && (
            <View style={[styles.statusRibbon, { backgroundColor: "#4CAF50" }]}>
              <Text style={styles.statusText}>COMPLETED</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginHorizontal: CARD_MARGIN,
    marginBottom: spacing.sectionGap,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.cardLarge,
    overflow: "hidden",
    ...shadows.card,
  },

  pressable: {
    flex: 1,
  },

  gradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderRadius: borderRadius.cardLarge,
  },

  // Left Section
  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    position: "relative",
  },
  icon: {
    fontSize: 32,
  },
  completedBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500" as const,
  },

  // Right Section
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  statItem: {
    alignItems: "center",
    minWidth: 44,
  },

  // Streak
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#FF6B6B",
  },

  // Score
  scoreValue: {
    fontSize: 16,
    fontWeight: "700" as const,
  },

  // Best
  bestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bestValue: {
    fontSize: 14,
    fontWeight: "600" as const,
  },

  statLabel: {
    fontSize: 10,
    fontWeight: "500" as const,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  // Play Button
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  // Status Ribbon
  statusRibbon: {
    position: "absolute",
    top: 10,
    right: -30,
    paddingHorizontal: 30,
    paddingVertical: 4,
    transform: [{ rotate: "45deg" }],
  },
  statusText: {
    fontSize: 8,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});

// =============================================================================
// Export
// =============================================================================

export const DailyChallengeCard = memo(DailyChallengeCardComponent);
export default DailyChallengeCard;
