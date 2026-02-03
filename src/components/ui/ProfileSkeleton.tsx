/**
 * Profile Skeleton Component
 *
 * Phase 7 of Profile Screen Overhaul
 *
 * Complete skeleton loading state for the profile screen,
 * matching the layout of NewProfileScreen
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 7
 */

import React, { memo } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";
import {
  AvatarSkeleton,
  BadgeSkeleton,
  Skeleton,
  SkeletonGroup,
  StatSkeleton,
} from "./SkeletonLoader";

// =============================================================================
// Types
// =============================================================================

export interface ProfileSkeletonProps {
  /** Whether to show the header section */
  showHeader?: boolean;
  /** Whether to show the stats section */
  showStats?: boolean;
  /** Whether to show the badges section */
  showBadges?: boolean;
  /** Whether to show the level progress section */
  showLevel?: boolean;
  /** Number of badge placeholders */
  badgeCount?: number;
  /** Whether to animate */
  animated?: boolean;
}

// =============================================================================
// Profile Header Skeleton
// =============================================================================

const ProfileHeaderSkeleton = memo(function ProfileHeaderSkeleton() {
  const { width } = useWindowDimensions();
  const avatarSize = Math.min(width * 0.3, 120);

  return (
    <View style={styles.header}>
      {/* Avatar with frame placeholder */}
      <View style={styles.avatarContainer}>
        <AvatarSkeleton size={avatarSize} />
        {/* Frame ring skeleton */}
        <View
          style={[
            styles.frameRing,
            { width: avatarSize + 16, height: avatarSize + 16 },
          ]}
        />
      </View>

      {/* Username and tagline */}
      <View style={styles.userInfo}>
        <Skeleton width={140} height={24} variant="text" />
        <Skeleton
          width={180}
          height={14}
          variant="text"
          style={{ marginTop: 8 }}
        />
      </View>

      {/* Action buttons placeholder */}
      <View style={styles.actions}>
        <Skeleton width={100} height={36} variant="rounded" borderRadius={18} />
        <Skeleton width={100} height={36} variant="rounded" borderRadius={18} />
      </View>
    </View>
  );
});

// =============================================================================
// Stats Section Skeleton
// =============================================================================

const StatsSectionSkeleton = memo(function StatsSectionSkeleton() {
  return (
    <View style={styles.statsSection}>
      <Skeleton
        width={80}
        height={18}
        variant="text"
        style={styles.sectionTitle}
      />
      <View style={styles.statsGrid}>
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </View>
    </View>
  );
});

// =============================================================================
// Level Progress Skeleton
// =============================================================================

const LevelProgressSkeleton = memo(function LevelProgressSkeleton() {
  const { width } = useWindowDimensions();

  return (
    <View style={styles.levelSection}>
      <View style={styles.levelHeader}>
        <Skeleton width={80} height={18} variant="text" />
        <Skeleton width={60} height={14} variant="text" />
      </View>
      {/* Progress bar */}
      <Skeleton
        width={width - 48}
        height={12}
        variant="rounded"
        borderRadius={6}
      />
      <View style={styles.levelFooter}>
        <Skeleton width={100} height={12} variant="text" />
        <Skeleton width={80} height={12} variant="text" />
      </View>
    </View>
  );
});

// =============================================================================
// Badges Section Skeleton
// =============================================================================

const BadgesSectionSkeleton = memo<{ count: number }>(
  function BadgesSectionSkeleton({ count }) {
    return (
      <View style={styles.badgesSection}>
        <View style={styles.badgesHeader}>
          <Skeleton width={120} height={18} variant="text" />
          <Skeleton width={60} height={14} variant="text" />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgesScroll}
        >
          {Array.from({ length: count }).map((_, index) => (
            <BadgeSkeleton key={index} size={64} />
          ))}
        </ScrollView>
      </View>
    );
  },
);

// =============================================================================
// Activity Section Skeleton
// =============================================================================

const ActivitySectionSkeleton = memo(function ActivitySectionSkeleton() {
  return (
    <View style={styles.activitySection}>
      <Skeleton
        width={100}
        height={18}
        variant="text"
        style={styles.sectionTitle}
      />
      <SkeletonGroup
        count={3}
        gap={12}
        items={[
          { width: "100%", height: 60 },
          { width: "100%", height: 60 },
          { width: "100%", height: 60 },
        ]}
        skeletonProps={{ variant: "rounded", borderRadius: 12 }}
      />
    </View>
  );
});

// =============================================================================
// Main Profile Skeleton Component
// =============================================================================

export const ProfileSkeleton = memo<ProfileSkeletonProps>(
  function ProfileSkeleton({
    showHeader = true,
    showStats = true,
    showBadges = true,
    showLevel = true,
    badgeCount = 5,
    animated = true,
  }) {
    const theme = useTheme();

    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        scrollEnabled={false}
      >
        {showHeader && <ProfileHeaderSkeleton />}
        {showLevel && <LevelProgressSkeleton />}
        {showStats && <StatsSectionSkeleton />}
        {showBadges && <BadgesSectionSkeleton count={badgeCount} />}
        <ActivitySectionSkeleton />
      </ScrollView>
    );
  },
);

// =============================================================================
// Compact Profile Skeleton
// =============================================================================

/**
 * Compact skeleton for inline profile views
 */
export const CompactProfileSkeleton = memo(function CompactProfileSkeleton() {
  return (
    <View style={styles.compactContainer}>
      <AvatarSkeleton size={56} />
      <View style={styles.compactInfo}>
        <Skeleton width={120} height={18} variant="text" />
        <Skeleton
          width={80}
          height={14}
          variant="text"
          style={{ marginTop: 4 }}
        />
      </View>
      <View style={styles.compactStats}>
        <StatSkeleton />
      </View>
    </View>
  );
});

// =============================================================================
// Badge Showcase Skeleton
// =============================================================================

/**
 * Skeleton for badge showcase section
 */
export const BadgeShowcaseSkeleton = memo<{ featured?: number; grid?: number }>(
  function BadgeShowcaseSkeleton({ featured = 3, grid = 6 }) {
    return (
      <View style={styles.showcaseContainer}>
        {/* Featured badges */}
        <View style={styles.featuredBadges}>
          <Skeleton
            width={140}
            height={18}
            variant="text"
            style={styles.sectionTitle}
          />
          <View style={styles.featuredGrid}>
            {Array.from({ length: featured }).map((_, index) => (
              <BadgeSkeleton key={`featured-${index}`} size={80} />
            ))}
          </View>
        </View>

        {/* All badges grid */}
        <View style={styles.allBadges}>
          <Skeleton
            width={100}
            height={18}
            variant="text"
            style={styles.sectionTitle}
          />
          <View style={styles.badgesGrid}>
            {Array.from({ length: grid }).map((_, index) => (
              <BadgeSkeleton key={`grid-${index}`} size={56} />
            ))}
          </View>
        </View>
      </View>
    );
  },
);

// =============================================================================
// Shop Section Skeleton
// =============================================================================

/**
 * Skeleton for cosmetic shop items
 */
export const ShopSkeleton = memo<{ itemCount?: number }>(function ShopSkeleton({
  itemCount = 4,
}) {
  return (
    <View style={styles.shopContainer}>
      {/* Category tabs */}
      <View style={styles.shopTabs}>
        <Skeleton width={80} height={32} variant="rounded" borderRadius={16} />
        <Skeleton width={80} height={32} variant="rounded" borderRadius={16} />
        <Skeleton width={80} height={32} variant="rounded" borderRadius={16} />
      </View>

      {/* Items grid */}
      <View style={styles.shopGrid}>
        {Array.from({ length: itemCount }).map((_, index) => (
          <View key={index} style={styles.shopItem}>
            <Skeleton
              width={80}
              height={80}
              variant="rounded"
              borderRadius={12}
            />
            <Skeleton
              width={70}
              height={14}
              variant="text"
              style={{ marginTop: 8 }}
            />
            <Skeleton
              width={50}
              height={12}
              variant="text"
              style={{ marginTop: 4 }}
            />
          </View>
        ))}
      </View>
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 24,
  },
  // Header
  header: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 24,
  },
  avatarContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  frameRing: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "rgba(128, 128, 128, 0.2)",
    borderRadius: 999,
  },
  userInfo: {
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  // Stats
  statsSection: {
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
  },
  // Level
  levelSection: {
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(128, 128, 128, 0.05)",
  },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  // Badges
  badgesSection: {
    gap: 12,
  },
  badgesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgesScroll: {
    gap: 16,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  // Activity
  activitySection: {
    gap: 12,
  },
  // Compact
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  compactInfo: {
    flex: 1,
  },
  compactStats: {
    alignItems: "flex-end",
  },
  // Showcase
  showcaseContainer: {
    gap: 24,
  },
  featuredBadges: {
    gap: 12,
  },
  featuredGrid: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },
  allBadges: {
    gap: 12,
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  // Shop
  shopContainer: {
    gap: 16,
  },
  shopTabs: {
    flexDirection: "row",
    gap: 8,
  },
  shopGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  shopItem: {
    alignItems: "center",
    width: 100,
  },
});

export default ProfileSkeleton;
