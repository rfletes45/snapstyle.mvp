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

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AchievementsCard,
  BadgesCard,
  BestScoresCard,
  FriendsCard,
} from "@/components/profile/OverviewCards";
import { ProfileBioEditor } from "@/components/profile/ProfileBio/index";
import { OwnProfileHeader } from "@/components/profile/ProfileHeader/index";
import { ProfileOverflowMenu } from "@/components/profile/ProfileOverflowMenu";
import { ProfilePictureEditor } from "@/components/profile/ProfilePicture";
import { SocialProofSection } from "@/components/profile/SocialProof";
import { LoadingState } from "@/components/ui";
import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { prefetchCriticalProfileAssets } from "@/services/cosmeticsAssetCache";

import { useAchievementsV2 } from "@/hooks/useAchievementsV2";
import { useFullProfileData } from "@/hooks/useFullProfileData";
import { useGameScores } from "@/hooks/useGameScores";
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

  // Game scores hook
  const { displayScores: gameScores } = useGameScores({
    userId: currentFirebaseUser?.uid || "",
    maxScores: 5,
  });

  // Achievements hook
  const {
    displayItems: achievementItems,
    unlockedIds: achievementUnlockedIds,
    isV2Active: achievementsActive,
  } = useAchievementsV2(currentFirebaseUser?.uid || "");

  // Derived from hook results
  const pictureUrl = picture?.url || null;
  const decorationId = decoration?.decorationId || null;

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [pictureEditorVisible, setPictureEditorVisible] = useState(false);
  const [bioEditorVisible, setBioEditorVisible] = useState(false);

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
  const scoresHidden = privacy?.showGameScores === "nobody";
  const achievementsHidden = privacy?.showAchievements === "nobody";
  const streaksHidden = privacy?.showStreaks === "nobody";
  const activityHidden = privacy?.showRecentActivity === "nobody";

  // Streak from stats
  const streakCount = profile?.stats?.currentStreak ?? 0;

  // Latest achievement title
  const latestAchievementTitle = useMemo(() => {
    if (!achievementsActive || achievementItems.length === 0) return undefined;
    const unlocked = achievementItems.filter((a) =>
      achievementUnlockedIds.has(a.id),
    );
    if (unlocked.length === 0) return undefined;
    // Most-recently unlocked (items are sorted by display order so pick last unlocked)
    return unlocked[unlocked.length - 1]?.name;
  }, [achievementItems, achievementUnlockedIds, achievementsActive]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshPicture(), refreshFullProfile()]);
    setRefreshing(false);
  }, [refresh, refreshPicture, refreshFullProfile]);

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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
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
        />

        {/* ============================================================ */}
        {/* Identity chips row (Level + Tokens — read-only) */}
        {/* ============================================================ */}
        <View style={styles.chipsRow}>
          <View
            style={[styles.chip, { backgroundColor: colors.primary + "15" }]}
          >
            <MaterialCommunityIcons
              name="star-circle-outline"
              size={14}
              color={colors.primary}
            />
            <Text style={[styles.chipText, { color: colors.primary }]}>
              Lv {profile?.level?.current ?? 1}
            </Text>
          </View>
        </View>

        {/* ============================================================ */}
        {/* B) Primary Actions (max 2-3) */}
        {/* ============================================================ */}
        <View style={styles.primaryActions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate("Customization")}
            accessibilityLabel="Customize profile"
          >
            <MaterialCommunityIcons name="palette" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Customize</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: colors.surfaceVariant },
            ]}
            onPress={() => navigation.navigate("Shop")}
            accessibilityLabel="Open shop"
          >
            <MaterialCommunityIcons
              name="shopping-outline"
              size={18}
              color={colors.text}
            />
            <Text style={[styles.primaryBtnText, { color: colors.text }]}>
              Shop
            </Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* D) Social Proof (streak + recent activity) */}
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
            onPress={() => navigation.navigate("Connections")}
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

          {/* Achievements Card */}
          {achievementsActive && (
            <AchievementsCard
              totalAchievements={achievementItems.length}
              unlockedCount={achievementUnlockedIds.size}
              latestUnlockTitle={latestAchievementTitle}
              hiddenFromOthers={achievementsHidden}
              enterIndex={2}
              onPress={() =>
                navigation.navigate("Play", { screen: "Achievements" })
              }
            />
          )}

          {/* Best Scores Card */}
          <BestScoresCard
            scores={gameScores}
            hiddenFromOthers={scoresHidden}
            enterIndex={3}
            onPress={() => navigation.navigate("GameStats")}
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
  chipsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
  },
  primaryActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginVertical: Spacing.lg,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  primaryBtnText: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: "#fff",
  },
  cardsSection: {
    marginTop: Spacing.sm,
  },
});
