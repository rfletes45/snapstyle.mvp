/**
 * OwnProfileScreen
 *
 * The current user's profile screen — polished, minimal, and cohesive.
 *
 * Layout (top → bottom):
 * 1. Showcase Header (background + PFP + decoration + level/XP)
 * 2. Identity row (name, handle, level/tokens chips)
 * 3. Primary actions (Customize / Shop) — max 2-3 buttons
 * 4. Social proof (streak summary + recent activity)
 * 5. Overview cards (Friends / Badges / Achievements / Best Scores)
 * 6. Overflow menu (•••) → Privacy / Settings
 *
 * @module screens/profile/OwnProfileScreen
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AchievementsTrophyCaseCard,
  BadgesCard,
  FriendsCard,
} from "@/components/profile/OverviewCards";
import { ProfileBioEditor } from "@/components/profile/ProfileBio/index";
import { OwnProfileHeader } from "@/components/profile/ProfileHeader/index";
import { ProfileOverflowMenu } from "@/components/profile/ProfileOverflowMenu";
import { ProfilePictureEditor } from "@/components/profile/ProfilePicture";
import { SocialProofSection } from "@/components/profile/SocialProof";
import { LoadingState } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { prefetchCriticalProfileAssets } from "@/services/cosmeticsAssetCache";

import { useFullProfileData } from "@/hooks/useFullProfileData";
import { useProfileData } from "@/hooks/useProfileData";
import { useProfilePicture } from "@/hooks/useProfilePicture";

import { useAuth } from "@/store/AuthContext";
import { useColors } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import type { ProfileBio, ProfileStatus } from "@/types/userProfile";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/profile/OwnProfileScreen");

// =============================================================================
// Types
// =============================================================================

interface OwnProfileScreenProps {
  navigation: any;
}

// =============================================================================
// Component
// =============================================================================

export default function OwnProfileScreen({
  navigation,
}: OwnProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const { profile: baseProfile } = useUser();
  const {
    profile,
    loading: profileDataLoading,
    refresh,
  } = useProfileData(currentFirebaseUser?.uid);

  // Full profile data for bio, status, and privacy
  const { profile: fullProfile, refresh: refreshFullProfile } =
    useFullProfileData({ userId: currentFirebaseUser?.uid || "" });

  // Profile picture hook
  const {
    picture,
    decoration,
    refresh: refreshPicture,
  } = useProfilePicture({ userId: currentFirebaseUser?.uid || "" });

  // Derived from hook results
  const pictureUrl = picture?.url || null;
  const decorationId = decoration?.decorationId || null;

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [pictureEditorVisible, setPictureEditorVisible] = useState(false);
  const [bioEditorVisible, setBioEditorVisible] = useState(false);

  // Pull-to-refresh state
  const pullDistance = useSharedValue(0);
  const scrollAtTop = useRef(true);
  const pullStartY = useRef<number | null>(null);

  const PULL_THRESHOLD = 60;
  const MAX_PULL = 80;
  const SPINNER_SIZE = 36;

  const colors = useColors();

  // Bio and status from full profile data
  const userBio: ProfileBio | null = fullProfile?.bio || null;
  const userStatus: ProfileStatus | null = fullProfile?.status || null;

  // Privacy settings
  const privacy = fullProfile?.privacy;

  // Prefetch equipped cosmetic assets so profile renders instantly
  useEffect(() => {
    const bgId = profile?.equippedBackgroundId;
    if (bgId || decorationId) {
      prefetchCriticalProfileAssets({
        backgroundId: bgId,
        decorationId,
      });
    }
  }, [profile?.equippedBackgroundId, decorationId]);

  // ==========================================================================
  // Privacy-derived flags (for "Hidden from others" badges on own profile)
  // ==========================================================================

  const friendsHidden = privacy?.showFriendsList === "nobody";
  const badgesHidden = privacy?.showBadges === "nobody";
  const achievementsHidden = privacy?.showAchievements === "nobody";
  const streaksHidden = privacy?.showStreaks === "nobody";
  const activityHidden = privacy?.showRecentActivity === "nobody";

  // Streak from stats
  const streakCount = profile?.stats?.currentStreak ?? 0;

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshPicture(), refreshFullProfile()]);
    setRefreshing(false);
  }, [refresh, refreshPicture, refreshFullProfile]);

  // Reset spinner when refresh completes
  useEffect(() => {
    if (!refreshing) {
      pullDistance.value = withSpring(0, { damping: 15, stiffness: 150 });
    }
  }, [refreshing]);

  // Touch-based pull tracking (works with bounces={false})
  const handleTouchMove = useCallback(
    (e: any) => {
      if (refreshing) return;
      const currentY = e.nativeEvent.pageY;
      if (scrollAtTop.current) {
        if (pullStartY.current === null) {
          pullStartY.current = currentY;
        }
        const delta = currentY - pullStartY.current;
        if (delta > 0) {
          pullDistance.value = Math.min(delta, MAX_PULL);
        } else {
          pullStartY.current = currentY;
        }
      } else {
        // Not at top yet — keep resetting the anchor so pull starts from 0
        pullStartY.current = currentY;
        if (pullDistance.value > 0) pullDistance.value = 0;
      }
    },
    [refreshing],
  );

  const handleTouchEnd = useCallback(() => {
    if (pullDistance.value >= PULL_THRESHOLD && !refreshing) {
      handleRefresh();
    } else if (!refreshing) {
      pullDistance.value = withSpring(0, { damping: 15, stiffness: 150 });
    }
    pullStartY.current = null;
  }, [handleRefresh, refreshing]);

  const handleScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollAtTop.current = y <= 0;
    if (y > 0 && pullDistance.value > 0) {
      pullDistance.value = 0;
      pullStartY.current = null;
    }
  }, []);

  const spinnerAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(pullDistance.value / PULL_THRESHOLD, 1);
    return {
      opacity: progress,
      transform: [
        { translateY: pullDistance.value * 0.5 - SPINNER_SIZE },
        { scale: 0.5 + progress * 0.5 },
      ],
    };
  });

  const handleEditPicture = useCallback(() => {
    setPictureEditorVisible(true);
  }, []);

  const handleEditBio = useCallback(() => {
    setBioEditorVisible(true);
  }, []);

  const handleEditStatus = useCallback(() => {
    navigation.navigate("SetStatus");
  }, [navigation]);

  const handleEditName = useCallback(() => {
    navigation.navigate("Settings");
  }, [navigation]);

  const handleBioUpdated = useCallback(
    (_newBio: ProfileBio) => {
      refreshFullProfile();
    },
    [refreshFullProfile],
  );

  const handlePictureUpdated = useCallback(() => {
    refreshPicture();
  }, [refreshPicture]);

  // Modal close handlers
  const handleClosePictureEditor = useCallback(() => {
    setPictureEditorVisible(false);
  }, []);

  const handleCloseBioEditor = useCallback(() => {
    setBioEditorVisible(false);
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  // Loading state
  if (!baseProfile || profileDataLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingState message="Loading profile..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Overflow menu (top-right) */}
      <View style={[styles.overflowContainer, { top: insets.top + 8 }]}>
        <ProfileOverflowMenu
          onPrivacyPress={() => navigation.navigate("PrivacySettings")}
          onSettingsPress={() => navigation.navigate("Settings")}
        />
      </View>

      {/* Pull-to-refresh spinner overlay */}
      <Animated.View
        style={[
          styles.spinnerContainer,
          { top: insets.top + 12 },
          spinnerAnimatedStyle,
        ]}
        pointerEvents="none"
      >
        <View
          style={[styles.spinnerBubble, { backgroundColor: colors.surface }]}
        >
          <ActivityIndicator
            size="small"
            color={colors.primary}
            animating={refreshing}
          />
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* ============================================================ */}
        {/* A) Showcase Header */}
        {/* ============================================================ */}
        <OwnProfileHeader
          displayName={baseProfile.displayName}
          username={baseProfile.username}
          pictureUrl={pictureUrl}
          decorationId={decorationId}
          backgroundId={profile?.equippedBackgroundId ?? null}
          bio={userBio}
          status={userStatus}
          topInset={insets.top}
          level={
            profile?.level || {
              current: 1,
              xp: 0,
              xpToNextLevel: 100,
              totalXp: 0,
            }
          }
          onEditPicturePress={handleEditPicture}
          onEditBioPress={handleEditBio}
          onEditStatusPress={handleEditStatus}
          onEditNamePress={handleEditName}
          onLevelPress={() => navigation.navigate("LevelRewards")}
          onCustomizePress={() => navigation.navigate("Customization")}
          onShopPress={() => navigation.navigate("Shop")}
        />

        {/* ============================================================ */}
        {/* B) Social Proof (streak + recent activity) */}
        {/* ============================================================ */}
        <SocialProofSection
          userId={currentFirebaseUser?.uid || ""}
          streakCount={streaksHidden ? 0 : streakCount}
          showRecentActivity={!activityHidden}
          isOwnProfile={true}
          onStreakPress={() => navigation.navigate("Tasks", { tab: "daily" })}
          onActivityPress={() => navigation.navigate("ActivityFeed")}
        />

        {/* ============================================================ */}
        {/* C) Overview Cards */}
        {/* ============================================================ */}
        <View style={styles.cardsSection}>
          {/* Friends Card */}
          <FriendsCard
            userId={currentFirebaseUser?.uid || ""}
            isOwnProfile={true}
            hiddenFromOthers={friendsHidden}
            enterIndex={0}
            onPress={() => navigation.navigate("Friends")}
            onFriendPress={(friendUid) =>
              navigation.navigate("UserProfile", { userId: friendUid })
            }
          />

          {/* Badges Card */}
          <BadgesCard
            badges={profile?.featuredBadges ?? []}
            totalEarned={profile?.stats?.totalBadges}
            hiddenFromOthers={badgesHidden}
            enterIndex={1}
            onPress={() => navigation.navigate("BadgeCollection")}
          />

          {/* Achievements Trophy Case Card */}
          <AchievementsTrophyCaseCard
            userId={currentFirebaseUser?.uid || ""}
            featuredAchievementIds={
              fullProfile?.featuredAchievements?.achievementIds ?? []
            }
            hiddenFromOthers={achievementsHidden}
            enterIndex={2}
            onPress={() =>
              navigation.navigate("ProfileAchievements", {
                userId: currentFirebaseUser?.uid || "",
                featuredIds:
                  fullProfile?.featuredAchievements?.achievementIds ?? [],
              })
            }
          />
        </View>
      </ScrollView>

      {/* Profile Picture Editor Modal */}
      <ProfilePictureEditor
        visible={pictureEditorVisible}
        userId={currentFirebaseUser?.uid || ""}
        currentPictureUrl={pictureUrl}
        name={baseProfile.displayName}
        decorationId={decorationId}
        onClose={handleClosePictureEditor}
        onPictureUpdated={handlePictureUpdated}
        onDecorationPress={() => {
          setPictureEditorVisible(false);
          // Navigate to Customization Hub decoration tab instead of deprecated picker
          setTimeout(
            () =>
              navigation.navigate("Customization", {
                initialTab: "profile",
                initialSection: "decoration",
              }),
            350,
          );
        }}
      />

      {/* Bio Editor Modal */}
      <ProfileBioEditor
        visible={bioEditorVisible}
        userId={currentFirebaseUser?.uid || ""}
        currentBio={userBio}
        onClose={handleCloseBioEditor}
        onBioUpdated={handleBioUpdated}
      />
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
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  overflowContainer: {
    position: "absolute",
    right: Spacing.md,
    zIndex: 10,
  },
  spinnerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  spinnerBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  cardsSection: {
    marginTop: Spacing.sm,
  },
});
