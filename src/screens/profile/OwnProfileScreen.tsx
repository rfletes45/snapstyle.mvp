/**
 * OwnProfileScreen
 *
 * The current user's profile screen — polished, minimal, and cohesive.
 *
 * Layout is managed by the WidgetBoard system which renders profile
 * sections as reorderable, resizable widgets in a controlled grid.
 *
 * Two modes:
 * - View mode: normal scrollable profile (default)
 * - Customize mode: drag/drop reorder, resize, add/remove widgets
 *
 * @module screens/profile/OwnProfileScreen
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileBioEditor } from "@/components/profile/ProfileBio/index";
import { ProfilePictureEditor } from "@/components/profile/ProfilePicture";
import {
  WidgetBoardContainer,
  useBoardState,
} from "@/components/profile/WidgetBoard";
import { LoadingState } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { prefetchCriticalProfileAssets } from "@/services/cosmeticsAssetCache";

import { useGameStatsV4 } from "@/gamesV4/hooks/useGameStatsV4";
import { useFullProfileData } from "@/hooks/useFullProfileData";
import { usePendingRewards } from "@/hooks/usePendingRewards";
import { useProfileData } from "@/hooks/useProfileData";
import { useProfilePicture } from "@/hooks/useProfilePicture";
import { useTopStreaks } from "@/hooks/useTopStreaks";
import { fetchUserActivities } from "@/services/activityFeed";

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

  const colors = useColors();

  // Bio and status from full profile data
  const userBio: ProfileBio | null = fullProfile?.bio || null;
  const userStatus: ProfileStatus | null = fullProfile?.status || null;

  // Privacy settings
  const privacy = fullProfile?.privacy;

  // ── Widget Board State ──────────────────────────────────────────────

  const board = useBoardState(currentFirebaseUser?.uid);
  const isCustomizing = board.mode === "customize";

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

  // ── Streak data (canonical, from Friends collection) ─────────────

  const topStreaks = useTopStreaks(currentFirebaseUser?.uid);

  // ── Game Stats & Pending Rewards ────────────────────────────────────

  const {
    globalStats,
    pbs,
    loading: gameStatsLoading,
    refresh: refreshGameStats,
  } = useGameStatsV4();

  const pendingRewards = usePendingRewards();

  // ── Recent Activity (for widget) ────────────────────────────────────

  const [recentActivities, setRecentActivities] = useState<
    Array<{ id: string; text: string; time: string; icon?: string }>
  >([]);

  useEffect(() => {
    const uid = currentFirebaseUser?.uid;
    if (!uid || activityHidden) return;

    fetchUserActivities(uid, 5).then((events) => {
      const now = Date.now();
      setRecentActivities(
        events.map((e) => {
          const ms = now - e.timestamp.getTime();
          const mins = Math.floor(ms / 60_000);
          const hrs = Math.floor(ms / 3_600_000);
          const days = Math.floor(ms / 86_400_000);
          const time =
            mins < 1
              ? "just now"
              : mins < 60
                ? `${mins}m ago`
                : hrs < 24
                  ? `${hrs}h ago`
                  : `${days}d ago`;

          let text = "Activity";
          let icon: string | undefined;
          if (e.type === "achievement") {
            text = `Unlocked ${(e.data as any)?.achievementName ?? "achievement"}`;
            icon = "trophy-outline";
          } else if (e.type === "streak_milestone") {
            text = `Hit a ${(e.data as any)?.streakDays ?? ""}-day streak milestone`;
            icon = "fire";
          } else if (e.type === "profile_update") {
            text = "Updated profile";
            icon = "account-edit-outline";
          } else if (e.type === "new_friend") {
            text = "Made a new friend";
            icon = "account-plus-outline";
          } else if (e.type === "shop_purchase") {
            text = "Got something from the shop";
            icon = "shopping-outline";
          } else if (e.type === "decoration_equip") {
            text = "Equipped a new decoration";
            icon = "star-outline";
          } else if (e.type === "status_change") {
            text = "Set a new status";
            icon = "emoticon-happy-outline";
          }

          return { id: e.id, text, time, icon };
        }),
      );
    });
  }, [currentFirebaseUser?.uid, activityHidden]);

  // ── Favorite Game (derived from PBs) ────────────────────────────────

  const favoriteGameData = useMemo(() => {
    if (!pbs || pbs.length === 0)
      return { gameName: "Not set", gamesPlayed: 0, winRate: 0 };

    // Find the game with the most plays
    const sorted = [...pbs].sort(
      (a, b) => (b.totalPlays ?? 0) - (a.totalPlays ?? 0),
    );
    const top = sorted[0];
    const plays = top.totalPlays ?? 0;
    const wins = top.totalWins ?? 0;
    const rate = plays > 0 ? Math.round((wins / plays) * 100) : 0;

    return {
      gameName:
        top.gameId
          ?.replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()) ?? "Unknown",
      gamesPlayed: plays,
      winRate: rate,
    };
  }, [pbs]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refresh(),
      refreshPicture(),
      refreshFullProfile(),
      refreshGameStats(),
    ]);
    setRefreshing(false);
  }, [refresh, refreshPicture, refreshFullProfile, refreshGameStats]);

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

  // ── Customize Mode Entry ────────────────────────────────────────────
  // Edit mode is now entered by long-pressing any widget (RNGH long-press
  // in WidgetWrapper). No board-level Pressable needed.

  // ==========================================================================
  // Widget Data Payloads
  // ==========================================================================

  const widgetData = useMemo(
    () => ({
      "profile-header": {
        displayName: baseProfile?.displayName ?? "",
        username: baseProfile?.username ?? "",
        pictureUrl,
        decorationId,
        backgroundId: profile?.equippedBackgroundId ?? null,
        bio: userBio,
        status: userStatus,
        level: profile?.level || {
          current: 1,
          xp: 0,
          xpToNextLevel: 100,
          totalXp: 0,
        },
        onEditPicturePress: handleEditPicture,
        onEditBioPress: handleEditBio,
        onEditStatusPress: handleEditStatus,
        onEditNamePress: handleEditName,
        onLevelPress: () => navigation.navigate("LevelRewards"),
        onCustomizePress: () => navigation.navigate("Customization"),
        onShopPress: () => navigation.navigate("Shop"),
        onSettingsPress: () => navigation.navigate("Settings"),
        unclaimedRewards: pendingRewards.unclaimedLevelRewardCount,
      },
      "social-proof": {
        streaks: streaksHidden ? [] : topStreaks.streaks,
        activeStreakCount: streaksHidden ? 0 : topStreaks.activeStreakCount,
        topStreakCount: streaksHidden ? 0 : topStreaks.topStreakCount,
        loading: topStreaks.loading,
        error: topStreaks.error,
        isOwnProfile: true,
        onPress: () => navigation.navigate("Friends"),
      },
      friends: {
        userId: currentFirebaseUser?.uid || "",
        isOwnProfile: true,
        hiddenFromOthers: friendsHidden,
        onPress: () => navigation.navigate("Friends"),
        onFriendPress: (friendUid: string) =>
          navigation.navigate("UserProfile", { userId: friendUid }),
      },
      badges: {
        badges: profile?.featuredBadges ?? [],
        totalEarned: profile?.stats?.totalBadges,
        hiddenFromOthers: badgesHidden,
        onPress: () => navigation.navigate("BadgeCollection"),
      },
      achievements: {
        userId: currentFirebaseUser?.uid || "",
        featuredAchievementIds:
          fullProfile?.featuredAchievements?.achievementIds ?? [],
        hiddenFromOthers: achievementsHidden,
        onPress: () =>
          navigation.navigate("ProfileAchievements", {
            userId: currentFirebaseUser?.uid || "",
            featuredIds:
              fullProfile?.featuredAchievements?.achievementIds ?? [],
          }),
      },
      "mutual-friends": {
        mutualFriends: [],
        mutualCount: 0,
      },
      "favorite-game": favoriteGameData,
      "profile-stats": {
        totalGames: globalStats?.gamesPlayed ?? 0,
        totalWins: globalStats?.gamesWon ?? 0,
        totalHours: 0,
        friendCount: profile?.stats?.friendCount ?? 0,
      },
      "recent-activity": {
        activities: recentActivities,
      },
    }),
    [
      baseProfile,
      pictureUrl,
      decorationId,
      profile,
      userBio,
      userStatus,
      currentFirebaseUser?.uid,
      fullProfile,
      friendsHidden,
      badgesHidden,
      achievementsHidden,
      streaksHidden,
      activityHidden,
      topStreaks,
      pendingRewards.unclaimedLevelRewardCount,
      globalStats,
      favoriteGameData,
      recentActivities,
      navigation,
      handleEditPicture,
      handleEditBio,
      handleEditStatus,
      handleEditName,
      board.actions,
    ],
  );

  // ==========================================================================
  // Render
  // ==========================================================================

  // Loading state
  if (!baseProfile || profileDataLoading || !board.loaded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingState message="Loading profile..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: isCustomizing ? insets.top + Spacing.xs : insets.top,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        refreshControl={
          !isCustomizing ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        <WidgetBoardContainer
          mode={board.mode}
          visibleWidgets={board.visibleWidgets}
          allWidgets={board.widgets}
          hiddenWidgets={board.hiddenWidgets}
          saving={board.saving}
          widgetData={widgetData}
          dragActiveId={board.dragActiveId}
          onMoveWidget={board.actions.moveWidget}
          onResizeWidget={board.actions.resizeWidget}
          onHideWidget={board.actions.hideWidget}
          onRestoreWidget={board.actions.restoreWidget}
          onAddWidget={board.actions.addWidget}
          onDragPreview={board.actions.updateDragPreview}
          onResizePreview={board.actions.updateResizePreview}
          onCommitPreview={board.actions.commitPreview}
          onClearPreview={board.actions.clearPreview}
          onEnterCustomize={board.actions.enterCustomize}
          onDone={board.actions.exitCustomize}
          onCancel={board.actions.cancelCustomize}
        />
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
});
