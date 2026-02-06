/**
 * ProfileSkeletons
 *
 * Skeleton loading components for profile sections.
 * Provides visual feedback while data is loading.
 *
 * @module components/profile/ProfileSkeletons
 */

import React, { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Surface, useTheme } from "react-native-paper";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { BorderRadius, Spacing } from "@/constants/theme";

// =============================================================================
// Base Skeleton Component
// =============================================================================

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

const SkeletonBox = memo(function SkeletonBox({
  width,
  height,
  borderRadius = BorderRadius.sm,
  style,
}: SkeletonBoxProps) {
  const theme = useTheme();
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      true,
    );
  }, [shimmerValue]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      shimmerValue.value,
      [0, 0.5, 1],
      [0.3, 0.6, 0.3],
    );
    return { opacity };
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surfaceVariant,
        },
        animatedStyle,
        style,
      ]}
    />
  );
});

// =============================================================================
// Profile Header Skeleton
// =============================================================================

export const ProfileHeaderSkeleton = memo(function ProfileHeaderSkeleton() {
  const theme = useTheme();

  return (
    <Surface
      style={[
        styles.headerContainer,
        { backgroundColor: theme.colors.surface },
      ]}
      elevation={1}
    >
      {/* Banner skeleton */}
      <SkeletonBox width="100%" height={120} borderRadius={0} />

      {/* Avatar skeleton */}
      <View style={styles.avatarSection}>
        <SkeletonBox
          width={100}
          height={100}
          borderRadius={50}
          style={styles.avatarSkeleton}
        />
      </View>

      {/* Name and username */}
      <View style={styles.headerInfo}>
        <SkeletonBox width={150} height={24} />
        <SkeletonBox width={100} height={16} style={styles.marginTop} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <SkeletonBox width={40} height={24} />
          <SkeletonBox width={60} height={14} style={styles.marginTop} />
        </View>
        <View style={styles.statItem}>
          <SkeletonBox width={40} height={24} />
          <SkeletonBox width={60} height={14} style={styles.marginTop} />
        </View>
        <View style={styles.statItem}>
          <SkeletonBox width={40} height={24} />
          <SkeletonBox width={60} height={14} style={styles.marginTop} />
        </View>
      </View>
    </Surface>
  );
});

// =============================================================================
// Profile Bio Skeleton
// =============================================================================

export const ProfileBioSkeleton = memo(function ProfileBioSkeleton() {
  const theme = useTheme();

  return (
    <Surface
      style={[styles.bioContainer, { backgroundColor: theme.colors.surface }]}
      elevation={1}
    >
      <SkeletonBox width={80} height={18} />
      <SkeletonBox width="100%" height={16} style={styles.marginTop} />
      <SkeletonBox width="80%" height={16} style={styles.marginTop} />
      <SkeletonBox width="60%" height={16} style={styles.marginTop} />
    </Surface>
  );
});

// =============================================================================
// Game Scores Skeleton
// =============================================================================

export const GameScoresSkeleton = memo(function GameScoresSkeleton() {
  const theme = useTheme();

  return (
    <View style={styles.scoresContainer}>
      {/* Header */}
      <View style={styles.scoresHeader}>
        <SkeletonBox width={100} height={20} />
      </View>

      {/* Score cards */}
      {[1, 2, 3].map((i) => (
        <Surface
          key={i}
          style={[
            styles.scoreCard,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          elevation={1}
        >
          <SkeletonBox width={40} height={40} borderRadius={20} />
          <View style={styles.scoreInfo}>
            <SkeletonBox width={80} height={16} />
            <SkeletonBox width={60} height={12} style={styles.marginTop} />
          </View>
          <SkeletonBox width={50} height={24} />
        </Surface>
      ))}
    </View>
  );
});

// =============================================================================
// Badge Display Skeleton
// =============================================================================

export const BadgeDisplaySkeleton = memo(function BadgeDisplaySkeleton() {
  const theme = useTheme();

  return (
    <View style={styles.badgesContainer}>
      {/* Header */}
      <View style={styles.badgesHeader}>
        <SkeletonBox width={80} height={20} />
      </View>

      {/* Badge items */}
      <View style={styles.badgesRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonBox key={i} width={48} height={48} borderRadius={24} />
        ))}
      </View>
    </View>
  );
});

// =============================================================================
// Theme Preview Skeleton
// =============================================================================

export const ThemePreviewSkeleton = memo(function ThemePreviewSkeleton() {
  const theme = useTheme();

  return (
    <Surface
      style={[styles.themeContainer, { backgroundColor: theme.colors.surface }]}
      elevation={1}
    >
      {/* Background preview */}
      <SkeletonBox width="100%" height={150} borderRadius={BorderRadius.md} />

      {/* Theme info */}
      <View style={styles.themeInfo}>
        <SkeletonBox width={100} height={18} />
        <SkeletonBox width={80} height={14} style={styles.marginTop} />
      </View>
    </Surface>
  );
});

// =============================================================================
// Full Profile Skeleton
// =============================================================================

export const FullProfileSkeleton = memo(function FullProfileSkeleton() {
  return (
    <View style={styles.fullProfileContainer}>
      <ProfileHeaderSkeleton />
      <ProfileBioSkeleton />
      <GameScoresSkeleton />
      <BadgeDisplaySkeleton />
    </View>
  );
});

// =============================================================================
// Privacy Settings Skeleton
// =============================================================================

export const PrivacySettingsSkeleton = memo(function PrivacySettingsSkeleton() {
  const theme = useTheme();

  return (
    <View style={styles.privacyContainer}>
      {/* Preset buttons */}
      <View style={styles.presetRow}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBox
            key={i}
            width={80}
            height={36}
            borderRadius={BorderRadius.md}
          />
        ))}
      </View>

      {/* Setting sections */}
      {[1, 2, 3].map((section) => (
        <View key={section} style={styles.settingSection}>
          <SkeletonBox width={120} height={18} style={styles.sectionHeader} />
          {[1, 2, 3].map((item) => (
            <Surface
              key={item}
              style={[
                styles.settingItem,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              elevation={1}
            >
              <View style={styles.settingRow}>
                <SkeletonBox width={20} height={20} borderRadius={10} />
                <View style={styles.settingText}>
                  <SkeletonBox width={100} height={14} />
                  <SkeletonBox
                    width={150}
                    height={12}
                    style={styles.marginTop}
                  />
                </View>
              </View>
              <View style={styles.chipRow}>
                <SkeletonBox width={70} height={28} borderRadius={14} />
                <SkeletonBox width={70} height={28} borderRadius={14} />
                <SkeletonBox width={70} height={28} borderRadius={14} />
              </View>
            </Surface>
          ))}
        </View>
      ))}
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Header
  headerContainer: {
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    overflow: "hidden",
  },
  avatarSection: {
    alignItems: "center",
    marginTop: -50,
  },
  avatarSkeleton: {
    borderWidth: 4,
    borderColor: "transparent",
  },
  headerInfo: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  marginTop: {
    marginTop: Spacing.xs,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: Spacing.md,
  },
  statItem: {
    alignItems: "center",
  },

  // Bio
  bioContainer: {
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },

  // Scores
  scoresContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  scoresHeader: {
    marginBottom: Spacing.sm,
  },
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  scoreInfo: {
    flex: 1,
  },

  // Badges
  badgesContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  badgesHeader: {
    marginBottom: Spacing.sm,
  },
  badgesRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  // Theme
  themeContainer: {
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  themeInfo: {
    marginTop: Spacing.sm,
  },

  // Full Profile
  fullProfileContainer: {
    flex: 1,
  },

  // Privacy
  privacyContainer: {
    padding: Spacing.md,
  },
  presetRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  settingSection: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
  },
  settingItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  settingText: {
    flex: 1,
  },
  chipRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
});

export { SkeletonBox };
