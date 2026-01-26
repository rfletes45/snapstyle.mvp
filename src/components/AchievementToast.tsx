/**
 * AchievementToast.tsx
 *
 * Displays achievement unlock notifications with animations.
 * Shows achievement icon, name, rewards, and tier.
 */

import {
  AchievementNotification,
  GameAchievementDefinition,
  TIER_COLORS,
} from "@/types/achievements";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BorderRadius, Spacing } from "../../constants/theme";

// =============================================================================
// Props
// =============================================================================

interface AchievementToastProps {
  notification: AchievementNotification;
  onDismiss: () => void;
  duration?: number; // Auto-dismiss after this many ms
}

interface AchievementToastQueueProps {
  notifications: AchievementNotification[];
  onDismiss: (achievementId: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const TOAST_HEIGHT = 120;
const ANIMATION_DURATION = 400;
const DEFAULT_DISPLAY_DURATION = 4000;

// =============================================================================
// Single Achievement Toast
// =============================================================================

export function AchievementToast({
  notification,
  onDismiss,
  duration = DEFAULT_DISPLAY_DURATION,
}: AchievementToastProps) {
  const theme = useTheme();
  const { achievement, isNew, earnCount } = notification;
  const tierColor = TIER_COLORS[achievement.tier];

  // Animation values
  const translateY = useSharedValue(-TOAST_HEIGHT - 50);
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const shimmerX = useSharedValue(-100);

  // Animate in
  useEffect(() => {
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Slide in
    translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 200 });

    // Pop in icon
    iconScale.value = withSequence(
      withDelay(200, withSpring(1.2, { damping: 10, stiffness: 300 })),
      withSpring(1, { damping: 8, stiffness: 200 }),
    );

    // Shimmer effect
    shimmerX.value = withSequence(
      withDelay(400, withTiming(300, { duration: 600, easing: Easing.linear })),
      withTiming(-100, { duration: 0 }),
    );

    // Auto-dismiss timer
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    translateY.value = withTiming(-TOAST_HEIGHT - 50, { duration: 300 });
    opacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(onDismiss)();
    });
  };

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <Animated.View style={[styles.toastContainer, containerStyle]}>
      <Pressable onPress={handleDismiss}>
        <Surface
          style={[
            styles.toastSurface,
            { backgroundColor: theme.colors.elevation.level3 },
          ]}
          elevation={5}
        >
          {/* Shimmer overlay */}
          <Animated.View style={[styles.shimmer, shimmerStyle]}>
            <View
              style={[
                styles.shimmerGradient,
                { backgroundColor: tierColor + "20" },
              ]}
            />
          </Animated.View>

          {/* Tier accent bar */}
          <View style={[styles.tierBar, { backgroundColor: tierColor }]} />

          {/* Content */}
          <View style={styles.content}>
            {/* Icon */}
            <Animated.View
              style={[
                styles.iconContainer,
                { backgroundColor: tierColor + "25" },
                iconStyle,
              ]}
            >
              <Text style={styles.iconEmoji}>{achievement.icon}</Text>
            </Animated.View>

            {/* Details */}
            <View style={styles.details}>
              <View style={styles.headerRow}>
                <Text style={[styles.label, { color: tierColor }]}>
                  {isNew
                    ? "🎉 Achievement Unlocked!"
                    : "🔄 Achievement Repeated"}
                </Text>
                {earnCount > 1 && (
                  <Text
                    style={[
                      styles.earnCount,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    ×{earnCount}
                  </Text>
                )}
              </View>

              <Text style={[styles.name, { color: theme.colors.onSurface }]}>
                {achievement.name}
              </Text>

              <Text
                style={[
                  styles.description,
                  { color: theme.colors.onSurfaceVariant },
                ]}
                numberOfLines={1}
              >
                {achievement.description}
              </Text>

              {/* Rewards */}
              <View style={styles.rewardsRow}>
                <View style={styles.reward}>
                  <Text style={styles.rewardIcon}>🪙</Text>
                  <Text style={[styles.rewardText, { color: "#FFD700" }]}>
                    +{achievement.coinReward}
                  </Text>
                </View>
                <View style={styles.reward}>
                  <Text style={styles.rewardIcon}>⭐</Text>
                  <Text style={[styles.rewardText, { color: "#9C27B0" }]}>
                    +{achievement.xpReward} XP
                  </Text>
                </View>
                <View
                  style={[
                    styles.tierBadge,
                    { backgroundColor: tierColor + "20" },
                  ]}
                >
                  <Text style={[styles.tierText, { color: tierColor }]}>
                    {achievement.tier.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Dismiss hint */}
            <MaterialCommunityIcons
              name="close"
              size={20}
              color={theme.colors.onSurfaceVariant}
              style={styles.closeIcon}
            />
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// Achievement Toast Queue
// =============================================================================

export function AchievementToastQueue({
  notifications,
  onDismiss,
}: AchievementToastQueueProps) {
  // Show only the first notification (queue style)
  const currentNotification = notifications[0];

  if (!currentNotification) return null;

  return (
    <View style={styles.queueContainer} pointerEvents="box-none">
      <AchievementToast
        key={currentNotification.achievement.id + currentNotification.earnedAt}
        notification={currentNotification}
        onDismiss={() => onDismiss(currentNotification.achievement.id)}
      />
    </View>
  );
}

// =============================================================================
// Mini Achievement Badge (for inline display)
// =============================================================================

interface AchievementBadgeProps {
  achievement: GameAchievementDefinition;
  earned: boolean;
  size?: "small" | "medium" | "large";
  onPress?: () => void;
}

export function AchievementBadge({
  achievement,
  earned,
  size = "medium",
  onPress,
}: AchievementBadgeProps) {
  const theme = useTheme();
  const tierColor = TIER_COLORS[achievement.tier];

  const sizes = {
    small: { container: 40, icon: 20, font: 10 },
    medium: { container: 56, icon: 28, font: 12 },
    large: { container: 72, icon: 36, font: 14 },
  };

  const s = sizes[size];

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <View
        style={[
          styles.badgeContainer,
          {
            width: s.container,
            height: s.container,
            backgroundColor: earned
              ? tierColor + "25"
              : theme.colors.surfaceVariant,
            borderColor: earned ? tierColor : theme.colors.outline,
            opacity: earned ? 1 : 0.5,
          },
        ]}
      >
        <Text style={{ fontSize: s.icon }}>{achievement.icon}</Text>
        {!earned && (
          <View style={styles.lockOverlay}>
            <MaterialCommunityIcons
              name="lock"
              size={s.icon * 0.6}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

// =============================================================================
// Achievement Progress Card
// =============================================================================

interface AchievementProgressCardProps {
  achievement: GameAchievementDefinition;
  progress: number; // 0-100
  currentValue: number;
  targetValue: number;
  earned: boolean;
  onPress?: () => void;
}

export function AchievementProgressCard({
  achievement,
  progress,
  currentValue,
  targetValue,
  earned,
  onPress,
}: AchievementProgressCardProps) {
  const theme = useTheme();
  const tierColor = TIER_COLORS[achievement.tier];

  return (
    <Pressable onPress={onPress}>
      <Surface
        style={[
          styles.progressCard,
          { backgroundColor: theme.colors.surface },
          earned && { borderLeftColor: tierColor, borderLeftWidth: 4 },
        ]}
        elevation={1}
      >
        <View style={styles.progressCardContent}>
          {/* Icon */}
          <View
            style={[
              styles.progressIconContainer,
              {
                backgroundColor: earned
                  ? tierColor + "25"
                  : theme.colors.surfaceVariant,
              },
            ]}
          >
            <Text style={styles.progressIcon}>{achievement.icon}</Text>
            {earned && (
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color={tierColor}
                style={styles.checkmark}
              />
            )}
          </View>

          {/* Details */}
          <View style={styles.progressDetails}>
            <View style={styles.progressHeader}>
              <Text
                style={[
                  styles.progressName,
                  { color: theme.colors.onSurface },
                  !earned && { opacity: 0.7 },
                ]}
                numberOfLines={1}
              >
                {achievement.secret && !earned ? "???" : achievement.name}
              </Text>
              <View
                style={[styles.tierChip, { backgroundColor: tierColor + "20" }]}
              >
                <Text style={[styles.tierChipText, { color: tierColor }]}>
                  {achievement.tier.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>

            <Text
              style={[
                styles.progressDescription,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {achievement.secret && !earned
                ? "Complete to reveal this achievement"
                : achievement.description}
            </Text>

            {/* Progress bar */}
            {!earned && achievement.progressTarget && (
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarBg,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progress}%`, backgroundColor: tierColor },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.progressText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {currentValue}/{targetValue}
                </Text>
              </View>
            )}

            {/* Rewards */}
            <View style={styles.progressRewards}>
              <Text style={[styles.rewardSmall, { color: "#FFD700" }]}>
                🪙 {achievement.coinReward}
              </Text>
              <Text style={[styles.rewardSmall, { color: "#9C27B0" }]}>
                ⭐ {achievement.xpReward} XP
              </Text>
              {achievement.unlocks && (
                <Text
                  style={[styles.rewardSmall, { color: theme.colors.primary }]}
                >
                  🎁 Unlocks reward
                </Text>
              )}
            </View>
          </View>
        </View>
      </Surface>
    </Pressable>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Toast styles
  toastContainer: {
    position: "absolute",
    top: 60,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 1000,
  },

  toastSurface: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },

  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },

  shimmerGradient: {
    width: 100,
    height: "100%",
    opacity: 0.5,
  },

  tierBar: {
    height: 4,
    width: "100%",
  },

  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },

  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },

  iconEmoji: {
    fontSize: 28,
  },

  details: {
    flex: 1,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  earnCount: {
    fontSize: 11,
    fontWeight: "600",
  },

  name: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },

  description: {
    fontSize: 12,
    marginTop: 2,
  },

  rewardsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },

  reward: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  rewardIcon: {
    fontSize: 14,
  },

  rewardText: {
    fontSize: 12,
    fontWeight: "700",
  },

  tierBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },

  tierText: {
    fontSize: 10,
    fontWeight: "800",
  },

  closeIcon: {
    position: "absolute",
    top: 0,
    right: 0,
    padding: Spacing.sm,
    opacity: 0.5,
  },

  // Queue styles
  queueContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },

  // Badge styles
  badgeContainer: {
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
  },

  // Progress card styles
  progressCard: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },

  progressCardContent: {
    flexDirection: "row",
    padding: Spacing.md,
    gap: Spacing.md,
  },

  progressIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },

  progressIcon: {
    fontSize: 24,
  },

  checkmark: {
    position: "absolute",
    bottom: -4,
    right: -4,
  },

  progressDetails: {
    flex: 1,
  },

  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },

  progressName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },

  tierChip: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },

  tierChipText: {
    fontSize: 10,
    fontWeight: "800",
  },

  progressDescription: {
    fontSize: 12,
    marginTop: 2,
  },

  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },

  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },

  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  progressText: {
    fontSize: 11,
    fontWeight: "600",
    minWidth: 40,
  },

  progressRewards: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },

  rewardSmall: {
    fontSize: 11,
    fontWeight: "600",
  },
});
