/**
 * UserProfileScreen
 *
 * Screen for viewing another user's profile using the new widget-based
 * profile system in read-only / viewer mode.
 *
 * Renders the target user's widget board layout with all editing
 * affordances stripped: no customize mode, no drag/resize/remove,
 * no owner-only buttons (Settings, Shop, Customize).
 *
 * Viewer-appropriate controls (action bar, block/report/mute) are
 * rendered outside the widget board as overlays and footer sections.
 *
 * @module screens/profile/UserProfileScreen
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  IconButton,
  Text,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CommonActions } from "@react-navigation/native";

import BlockUserModal from "@/components/BlockUserModal";
import ReportUserModal from "@/components/ReportUserModal";
import { MuteOptionsModal } from "@/components/profile";
import { MoreOptionsMenu } from "@/components/profile/ProfileActions/index";
import {
  getWidgetDefinition,
  useBoardState,
  WidgetBoardContainer,
} from "@/components/profile/WidgetBoard";
import type { WidgetInstance } from "@/components/profile/WidgetBoard/types";
import { SIZE_PRESETS } from "@/components/profile/WidgetBoard/types";
import { CALL_FEATURES } from "@/constants/featureFlags";
import { Spacing } from "@/constants/theme";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { useBadges } from "@/hooks/useBadges";
import { useTopStreaks } from "@/hooks/useTopStreaks";
import { useAuth } from "@/store/AuthContext";
import { useColors } from "@/store/ThemeContext";
import * as haptics from "@/utils/haptics";

// Services
import {
  fetchAllGamePBs,
  fetchUserStatsCache,
} from "@/gamesV4/services/gameServiceV4";
import { fetchUserActivities } from "@/services/activityFeed";
import { blockUser, unblockUser } from "@/services/blocking";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "@/services/friends";
import {
  generateProfileShare,
  getFriendshipDetailsForUser,
  getFullProfileData,
  getMutualFriends,
  getRelationship,
  incrementProfileViews,
  isUserMuted,
  muteUser,
  unmuteUser,
} from "@/services/profileService";
import { submitReport } from "@/services/reporting";

// Types
import type { ReportReason } from "@/types/models";
import type {
  FriendshipDetails,
  MutualFriendInfo,
  ProfileRelationship,
  UserProfileData,
} from "@/types/userProfile";
import { canCallUser, DEFAULT_PRIVACY_SETTINGS } from "@/types/userProfile";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/profile/UserProfileScreen");
// =============================================================================
// Types
// =============================================================================

type UserProfileScreenProps = NativeStackScreenProps<any, "UserProfile">;

// =============================================================================
// Component
// =============================================================================

export default function UserProfileScreen({
  route,
  navigation,
}: UserProfileScreenProps) {
  return <UserProfileScreenContent route={route} navigation={navigation} />;
}

// =============================================================================
// Inner Content
// =============================================================================

function UserProfileScreenContent({
  route,
  navigation,
}: UserProfileScreenProps) {
  const { userId } = route.params as { userId: string };
  const { currentFirebaseUser } = useAuth();
  const { startCall } = useStreamCall();
  const insets = useSafeAreaInsets();
  const currentUserId = currentFirebaseUser?.uid;

  const colors = useColors();

  // ==========================================================================
  // Target User's Widget Board Layout (read-only)
  // ==========================================================================

  const board = useBoardState(userId, { readOnly: true });

  // ==========================================================================
  // State
  // ==========================================================================

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [relationship, setRelationship] = useState<ProfileRelationship | null>(
    null,
  );
  const [friendshipDetails, setFriendshipDetails] =
    useState<FriendshipDetails | null>(null);
  const [mutualFriends, setMutualFriends] = useState<MutualFriendInfo[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [muteActionLoading, setMuteActionLoading] = useState(false);

  // Calls require native modules AND the target's privacy settings must allow it
  const canInitiateCalls =
    CALL_FEATURES.CALLS_ENABLED &&
    (relationship
      ? canCallUser(profile?.privacy ?? DEFAULT_PRIVACY_SETTINGS, relationship)
      : false);

  // Badges hook — subscribes to the viewed user's badges
  const { featuredBadges, stats: badgeStats } = useBadges(userId);

  // Streaks hook — subscribes to the viewed user's friend streaks
  const topStreaks = useTopStreaks(userId);

  // Game stats for the viewed user (loaded on mount)
  const [gameStats, setGameStats] = useState<{
    gamesPlayed: number;
    gamesWon: number;
    pbs: Array<{ gameId: string; totalPlays?: number; totalWins?: number }>;
  } | null>(null);

  // Recent activities for the viewed user
  const [recentActivities, setRecentActivities] = useState<
    Array<{ id: string; text: string; time: string; icon?: string }>
  >([]);

  // ==========================================================================
  // Load Profile Data
  // ==========================================================================

  const loadProfileData = useCallback(async () => {
    if (!userId || !currentUserId) return;

    setLoading(true);
    setError(null);

    try {
      // Load all data in parallel
      // Load profile data on mount
      const [profileData, relationshipData, mutualFriendsData, mutedStatus] =
        await Promise.all([
          getFullProfileData(userId),
          getRelationship(currentUserId, userId),
          getMutualFriends(currentUserId, userId),
          isUserMuted(currentUserId, userId),
        ]);

      if (!profileData) {
        setError("Profile not found");
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setRelationship(relationshipData);
      setMutualFriends(mutualFriendsData);
      setIsMuted(mutedStatus);

      // Load friendship details if friends
      if (relationshipData.type === "friend") {
        const details = await getFriendshipDetailsForUser(
          currentUserId,
          userId,
        );
        setFriendshipDetails(details);
      }

      // Track profile view (fire-and-forget, non-critical)
      if (currentUserId !== userId) {
        incrementProfileViews(userId);
      }
    } catch (err: any) {
      logger.error("Error loading profile:", err);
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [userId, currentUserId]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Load game stats for the viewed user (best-effort, non-blocking)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [statsData, pbsData] = await Promise.all([
          fetchUserStatsCache(userId),
          fetchAllGamePBs(userId),
        ]);
        if (!cancelled) {
          setGameStats({
            gamesPlayed: statsData?.gamesPlayed ?? 0,
            gamesWon: statsData?.gamesWon ?? 0,
            pbs: pbsData ?? [],
          });
        }
      } catch {
        // Non-critical — profile still works without game stats
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Load recent activities for the viewed user (best-effort, privacy-gated)
  useEffect(() => {
    if (!userId || !profile) return;
    const activityHidden = (() => {
      const setting = profile.privacy?.showRecentActivity;
      if (!setting || setting === "everyone") return false;
      if (setting === "nobody") return true;
      return relationship?.type !== "friend";
    })();
    if (activityHidden) {
      setRecentActivities([]);
      return;
    }
    let cancelled = false;
    fetchUserActivities(userId, 5).then((events) => {
      if (cancelled) return;
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
    return () => {
      cancelled = true;
    };
  }, [userId, profile, relationship]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  const actions = useMemo(() => {
    if (!relationship) return null;

    // Import the function directly since it's a type export
    const baseActions = {
      canAddFriend: false,
      canCancelRequest: false,
      canAcceptRequest: false,
      canDeclineRequest: false,
      canMessage: false,
      canCall: false,
      canRemoveFriend: false,
      canBlock: true,
      canUnblock: false,
      canMute: false,
      canUnmute: false,
      canReport: true,
      canShare: true,
    };

    switch (relationship.type) {
      case "self":
        return {
          ...baseActions,
          canBlock: false,
          canReport: false,
          canShare: true,
        };
      case "stranger":
        return { ...baseActions, canAddFriend: true };
      case "friend":
        return {
          ...baseActions,
          canMessage: true,
          canCall: true,
          canRemoveFriend: true,
          canMute: true,
        };
      case "pending_sent":
        return { ...baseActions, canCancelRequest: true };
      case "pending_received":
        return {
          ...baseActions,
          canAcceptRequest: true,
          canDeclineRequest: true,
        };
      case "blocked_by_you":
        return {
          ...baseActions,
          canBlock: false,
          canUnblock: true,
          canReport: false,
          canShare: false,
        };
      case "blocked_by_them":
        return {
          ...baseActions,
          canBlock: false,
          canReport: false,
          canShare: false,
        };
      default:
        return baseActions;
    }
  }, [relationship]);

  const handleAddFriend = useCallback(async () => {
    if (!profile || actionLoading) return;

    setActionLoading(true);
    setLoadingAction("addFriend");
    haptics.buttonPress();

    try {
      await sendFriendRequest(currentUserId!, profile.username);
      await loadProfileData();
      Alert.alert(
        "Friend Request Sent",
        `Friend request sent to ${profile.displayName}`,
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send friend request");
    } finally {
      setActionLoading(false);
      setLoadingAction(null);
    }
  }, [profile, currentUserId, actionLoading, loadProfileData]);

  const handleCancelRequest = useCallback(async () => {
    if (!relationship || relationship.type !== "pending_sent" || actionLoading)
      return;

    setActionLoading(true);
    setLoadingAction("cancelRequest");
    haptics.buttonPress();

    try {
      await cancelFriendRequest(relationship.requestId);
      await loadProfileData();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to cancel request");
    } finally {
      setActionLoading(false);
      setLoadingAction(null);
    }
  }, [relationship, actionLoading, loadProfileData]);

  const handleAcceptRequest = useCallback(async () => {
    if (
      !relationship ||
      relationship.type !== "pending_received" ||
      actionLoading
    )
      return;

    setActionLoading(true);
    setLoadingAction("acceptRequest");
    haptics.success();

    try {
      await acceptFriendRequest(relationship.requestId);
      await loadProfileData();
      Alert.alert(
        "Friend Added",
        `You are now friends with ${profile?.displayName}`,
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to accept request");
    } finally {
      setActionLoading(false);
      setLoadingAction(null);
    }
  }, [relationship, profile, actionLoading, loadProfileData]);

  const handleDeclineRequest = useCallback(async () => {
    if (
      !relationship ||
      relationship.type !== "pending_received" ||
      actionLoading
    )
      return;

    setActionLoading(true);
    setLoadingAction("declineRequest");
    haptics.buttonPress();

    try {
      await declineFriendRequest(relationship.requestId);
      await loadProfileData();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to decline request");
    } finally {
      setActionLoading(false);
      setLoadingAction(null);
    }
  }, [relationship, actionLoading, loadProfileData]);

  const handleMessage = useCallback(() => {
    if (!userId) return;
    haptics.buttonPress();
    // Reset the navigation state so that ChatDetail sits on top of MainTabs
    // with the Messages tab focused. This way pressing back from the DM
    // returns to the Messages screen instead of the profile screen.
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          {
            name: "MainTabs",
            state: {
              routes: [{ name: "Messages" }],
              index: 0,
            },
          },
          {
            name: "ChatDetail",
            params: { friendUid: userId },
          },
        ],
      }),
    );
  }, [userId, navigation]);

  const handleCall = useCallback(async () => {
    if (!userId) return;
    haptics.buttonPress();
    try {
      const callId = await startCall(userId, "audio");
      navigation.navigate("DirectCall" as any, {
        callId,
        recipientName: profile?.displayName || "User",
        mode: "audio",
        isOutgoing: true,
      });
    } catch (err: any) {
      Alert.alert(
        "Call Failed",
        err?.message || "Unable to start call. Please try again.",
      );
    }
  }, [userId, startCall, profile, navigation]);

  const handleRemoveFriend = useCallback(async () => {
    if (!currentUserId || !userId || actionLoading) return;

    Alert.alert(
      "Remove Friend",
      `Are you sure you want to remove ${profile?.displayName} as a friend?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            haptics.deleteWarning();
            try {
              await removeFriend(currentUserId, userId);
              await loadProfileData();
              Alert.alert(
                "Friend Removed",
                `${profile?.displayName} has been removed from your friends`,
              );
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to remove friend");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [currentUserId, userId, profile, actionLoading, loadProfileData]);

  const handleBlock = useCallback(() => {
    setMenuVisible(false);
    haptics.warning();
    setBlockModalVisible(true);
  }, []);

  const handleConfirmBlock = useCallback(
    async (reason?: string) => {
      if (!currentUserId || !userId) return;

      const success = await blockUser(currentUserId, userId, reason);
      setBlockModalVisible(false);
      if (success) {
        await loadProfileData();
        Alert.alert("User Blocked", `${profile?.displayName} has been blocked`);
      } else {
        Alert.alert("Error", "Failed to block user. Please try again.");
      }
    },
    [currentUserId, userId, profile, loadProfileData],
  );

  const handleUnblock = useCallback(async () => {
    if (!currentUserId || !userId || actionLoading) return;

    setActionLoading(true);
    setLoadingAction("unblock");
    haptics.buttonPress();

    try {
      await unblockUser(currentUserId, userId);
      await loadProfileData();
      Alert.alert(
        "User Unblocked",
        `${profile?.displayName} has been unblocked`,
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to unblock user");
    } finally {
      setActionLoading(false);
      setLoadingAction(null);
    }
  }, [currentUserId, userId, profile, actionLoading, loadProfileData]);

  const handleReport = useCallback(() => {
    setMenuVisible(false);
    haptics.buttonPress();
    setReportModalVisible(true);
  }, []);

  const handleSubmitReport = useCallback(
    async (reason: ReportReason, description?: string) => {
      if (!currentUserId || !userId) return;

      try {
        await submitReport(currentUserId, userId, reason, { description });
        setReportModalVisible(false);
        Alert.alert(
          "Report Submitted",
          "Thank you for your report. We will review it shortly.",
        );
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to submit report");
      }
    },
    [currentUserId, userId],
  );

  // Opens the mute options modal
  const handleMute = useCallback(() => {
    setMenuVisible(false);
    setMuteModalVisible(true);
  }, []);

  // Handles mute confirmation from modal
  const handleConfirmMute = useCallback(
    async (settings: {
      duration: number | null;
      options: { notifications: boolean; stories: boolean; messages: boolean };
    }) => {
      if (!currentUserId || !userId) return;

      setMuteActionLoading(true);
      haptics.muteToggle();

      try {
        await muteUser(currentUserId, userId, settings.duration ?? undefined);
        setIsMuted(true);
        setMuteModalVisible(false);
        Alert.alert("User Muted", `${profile?.displayName} has been muted`);
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to mute user");
      } finally {
        setMuteActionLoading(false);
      }
    },
    [currentUserId, userId, profile],
  );

  // Handles unmute from modal
  const handleUnmute = useCallback(async () => {
    if (!currentUserId || !userId) return;

    setMuteActionLoading(true);
    haptics.muteToggle();

    try {
      await unmuteUser(currentUserId, userId);
      setIsMuted(false);
      setMuteModalVisible(false);
      Alert.alert("User Unmuted", `${profile?.displayName} has been unmuted`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to unmute user");
    } finally {
      setMuteActionLoading(false);
    }
  }, [currentUserId, userId, profile]);

  const handleMoreOptions = useCallback(() => {
    setMenuVisible(true);
  }, []);

  const handleShare = useCallback(async () => {
    if (!userId) return;

    setMenuVisible(false);
    haptics.buttonPress();

    try {
      const shareData = await generateProfileShare(userId);
      if (!shareData) {
        Alert.alert("Cannot Share", "This profile cannot be shared");
        return;
      }

      await Share.share({
        message: `Check out ${shareData.displayName}'s profile on Vibe! ${shareData.shareUrl}`,
        url: shareData.shareUrl,
        title: `${shareData.displayName}'s Profile`,
      });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        logger.error("Share error:", err);
      }
    }
  }, [userId]);

  // ==========================================================================
  // Privacy-derived flags (for other-user cards)
  // ==========================================================================

  const friendsPrivacyHidden = (() => {
    const setting = profile?.privacy?.showFriendsList;
    if (!setting || setting === "everyone") return false;
    if (setting === "nobody") return true;
    // "friends" — only visible if relationship is friend
    return relationship?.type !== "friend";
  })();

  const badgesPrivacyHidden = (() => {
    const setting = profile?.privacy?.showBadges;
    if (!setting || setting === "everyone") return false;
    if (setting === "nobody") return true;
    return relationship?.type !== "friend";
  })();

  const achievementsPrivacyHidden = (() => {
    const setting = profile?.privacy?.showAchievements;
    if (!setting || setting === "everyone") return false;
    if (setting === "nobody") return true;
    return relationship?.type !== "friend";
  })();

  const streaksPrivacyHidden = (() => {
    const setting = profile?.privacy?.showStreaks;
    if (!setting || setting === "everyone") return false;
    if (setting === "nobody") return true;
    return relationship?.type !== "friend";
  })();

  const activityPrivacyHidden = (() => {
    const setting = profile?.privacy?.showRecentActivity;
    if (!setting || setting === "everyone") return false;
    if (setting === "nobody") return true;
    return relationship?.type !== "friend";
  })();

  // ==========================================================================
  // Derived game data (from target user's stats)
  // ==========================================================================

  const favoriteGameData = useMemo(() => {
    if (!gameStats?.pbs || gameStats.pbs.length === 0)
      return { gameName: "Not set", gamesPlayed: 0, winRate: 0 };
    const sorted = [...gameStats.pbs].sort(
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
          .replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? "Unknown",
      gamesPlayed: plays,
      winRate: rate,
    };
  }, [gameStats]);

  // ==========================================================================
  // Last active label (derived)
  // ==========================================================================

  const lastActiveLabel = useMemo(() => {
    if (
      !profile ||
      profile.privacy.showLastActive === "nobody" ||
      profile.lastActive <= 0
    )
      return null;
    const ms = Date.now() - profile.lastActive;
    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(ms / 3_600_000);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(ms / 86_400_000);
    return `${days}d ago`;
  }, [profile]);

  // ==========================================================================
  // Widget Data Payloads (viewer-safe — no edit callbacks)
  // ==========================================================================

  const widgetData = useMemo(
    () => ({
      "profile-header": {
        displayName: profile?.displayName ?? "",
        username: profile?.username ?? "",
        pictureUrl: profile?.profilePicture?.url || null,
        decorationId: profile?.avatarDecoration?.decorationId || null,
        backgroundId: profile?.equippedBackgroundId ?? null,
        bio: profile?.bio ?? null,
        status: profile?.status ?? null,
        level: profile?.level || {
          current: 1,
          xp: 0,
          xpToNextLevel: 100,
          totalXp: 0,
        },
        // ── NO owner-only callbacks ──
        // onEditPicturePress: undefined
        // onEditBioPress: undefined
        // onEditStatusPress: undefined
        // onEditNamePress: undefined
        // onLevelPress: undefined (disables tap-to-rewards)
        // onCustomizePress: undefined (hides Customize button)
        // onShopPress: undefined (hides Shop button)
        // onSettingsPress: undefined (hides Settings button)
        // unclaimedRewards: undefined (hides rewards pill)
      },
      "social-proof": {
        streaks: streaksPrivacyHidden ? [] : topStreaks.streaks,
        activeStreakCount: streaksPrivacyHidden
          ? 0
          : topStreaks.activeStreakCount,
        topStreakCount: streaksPrivacyHidden ? 0 : topStreaks.topStreakCount,
        loading: topStreaks.loading,
        error: topStreaks.error,
        isOwnProfile: false,
        onPress: undefined, // no drill-down for viewers
      },
      friends: {
        userId,
        isOwnProfile: false,
        hiddenFromOthers: friendsPrivacyHidden,
        onPress: !friendsPrivacyHidden
          ? () =>
              navigation.navigate("MutualFriendsList", {
                userId: currentUserId,
                targetUserId: userId,
              })
          : undefined,
        onFriendPress: (friendUid: string) =>
          navigation.push("UserProfile", { userId: friendUid }),
      },
      badges: {
        badges: featuredBadges ?? [],
        totalEarned: badgeStats?.earned,
        hiddenFromOthers: badgesPrivacyHidden,
        onPress: !badgesPrivacyHidden
          ? () =>
              navigation.navigate("MainTabs", {
                screen: "Profile",
                params: {
                  screen: "BadgeCollection",
                  params: { userId },
                },
              })
          : undefined,
      },
      achievements: {
        userId,
        featuredAchievementIds:
          profile?.featuredAchievements?.achievementIds ?? [],
        hiddenFromOthers: achievementsPrivacyHidden,
        onPress: !achievementsPrivacyHidden
          ? () =>
              navigation.navigate("ProfileAchievements", {
                userId,
                displayName: profile?.displayName,
                featuredIds:
                  profile?.featuredAchievements?.achievementIds ?? [],
              })
          : undefined,
      },
      "mutual-friends": {
        mutualFriends: mutualFriends.map((f) => ({
          id: f.userId,
          name: f.displayName,
          pictureUrl: f.profilePictureUrl,
        })),
        mutualCount: mutualFriends.length,
      },
      "favorite-game": favoriteGameData,
      "profile-stats": {
        totalGames: gameStats?.gamesPlayed ?? 0,
        totalWins: gameStats?.gamesWon ?? 0,
        totalHours: 0,
        friendCount: 0,
      },
      "recent-activity": {
        activities: activityPrivacyHidden ? [] : recentActivities,
      },
      "viewer-actions": {
        isMuted,
        friendshipDuration: friendshipDetails?.friendshipDuration ?? null,
        lastActiveLabel: lastActiveLabel,
        relationship,
        actionLoading,
        loadingAction,
        onAddFriend: handleAddFriend,
        onCancelRequest: handleCancelRequest,
        onAcceptRequest: handleAcceptRequest,
        onDeclineRequest: handleDeclineRequest,
        onMessage: handleMessage,
        onCall: canInitiateCalls ? handleCall : undefined,
        onRemoveFriend: handleRemoveFriend,
        onUnblock: handleUnblock,
        onMoreOptions: handleMoreOptions,
      },
      // tasks-overview: omitted — owner-only widget, filtered out for viewers
      "wallet-balance": {
        balance: (profile as any)?.wallet?.tokensBalance ?? 0,
        loading: false,
        isOwner: false,
        isCustomizing: false,
      },
      "theme-mode": {
        themeMode: (profile as any)?.useSystemTheme
          ? "auto"
          : profile?.theme?.equippedThemeId?.includes("dark")
            ? "dark"
            : "light",
        isOwner: false,
        isCustomizing: false,
      },
      "chat-layout-mode": {
        chatLayoutMode: (profile as any)?.conversationDisplayMode ?? "bubbles",
        isOwner: false,
        isCustomizing: false,
      },
    }),
    [
      profile,
      userId,
      currentUserId,
      topStreaks,
      streaksPrivacyHidden,
      friendsPrivacyHidden,
      badgesPrivacyHidden,
      achievementsPrivacyHidden,
      activityPrivacyHidden,
      featuredBadges,
      badgeStats,
      mutualFriends,
      favoriteGameData,
      gameStats,
      recentActivities,
      navigation,
      isMuted,
      friendshipDetails,
      lastActiveLabel,
      relationship,
      actionLoading,
      loadingAction,
      handleAddFriend,
      handleCancelRequest,
      handleAcceptRequest,
      handleDeclineRequest,
      handleMessage,
      handleCall,
      handleRemoveFriend,
      handleUnblock,
      handleMoreOptions,
      canInitiateCalls,
    ],
  );

  // ==========================================================================
  // Synthetic viewer-actions widget (injected at the board bottom)
  // ==========================================================================

  const augmentedVisibleWidgets = useMemo(() => {
    // Filter out owner-only widgets (e.g. tasks-overview) for viewers
    const base = board.visibleWidgets.filter((w) => {
      const def = getWidgetDefinition(w.widgetType);
      return !def || def.visibilityMode !== "owner-only";
    });
    // Find the bottom-most row occupied by existing widgets
    let maxBottom = 0;
    for (const w of base) {
      const span = SIZE_PRESETS[w.size];
      if (span) {
        const bottom = w.y + span.h;
        if (bottom > maxBottom) maxBottom = bottom;
      }
    }
    // Create a synthetic viewer-actions widget placed just below
    const viewerActionsWidget: WidgetInstance = {
      instanceId: "__viewer-actions__",
      widgetType: "viewer-actions",
      size: "large",
      x: 0,
      y: maxBottom,
      visible: true,
      pinned: true,
      config: {},
      createdAt: "",
      updatedAt: "",
    };
    return [...base, viewerActionsWidget];
  }, [board.visibleWidgets]);

  // Stub no-op handlers for read-only board
  const noop = useCallback(() => false as boolean, []);
  const noopVoid = useCallback(() => {}, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  if (loading || !board.loaded) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            iconColor={colors.text}
          />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading profile...
          </Text>
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            iconColor={colors.text}
          />
        </View>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="account-alert"
            size={64}
            color={colors.error}
          />
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error || "Profile not found"}
          </Text>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            textColor={colors.text}
            style={{ borderColor: colors.surfaceVariant }}
          >
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  // Blocked view
  if (relationship?.type === "blocked_by_them") {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            iconColor={colors.text}
          />
        </View>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="account-off"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            This profile is not available
          </Text>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            textColor={colors.text}
            style={{ borderColor: colors.surfaceVariant }}
          >
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.innerContainer}>
        {/* Header Bar — positioned above the scroll so it overlays the
         * background image, letting the profile header bg extend to the
         * very top of the viewport behind the status bar / dynamic island. */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top,
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
            },
          ]}
        >
          <IconButton
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            iconColor={colors.text}
            size={24}
          />
          <View style={styles.headerRight}>
            <IconButton
              icon="dots-vertical"
              onPress={handleMoreOptions}
              iconColor={colors.text}
              size={24}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Widget Board (read-only viewer mode) ──────────────── */}
          <WidgetBoardContainer
            mode="view"
            readOnly
            visibleWidgets={augmentedVisibleWidgets}
            allWidgets={board.widgets}
            hiddenWidgets={board.hiddenWidgets}
            saving={false}
            widgetData={widgetData}
            dragActiveId={null}
            onMoveWidget={noop}
            onResizeWidget={noop}
            onHideWidget={noop}
            onRestoreWidget={noop}
            onAddWidget={noop}
            onDragPreview={noopVoid}
            onResizePreview={noopVoid}
            onCommitPreview={noopVoid}
            onClearPreview={noopVoid}
            onEnterCustomize={noopVoid}
            onDone={noopVoid}
            onCancel={noopVoid}
          />
        </ScrollView>

        {/* More Options Menu (overflow: block/report/share/mute) */}
        <MoreOptionsMenu
          visible={menuVisible}
          relationship={relationship || { type: "stranger" }}
          isMuted={isMuted}
          targetDisplayName={profile.displayName}
          onClose={() => setMenuVisible(false)}
          onShareProfile={handleShare}
          onCopyLink={handleShare}
          onToggleMute={handleMute}
          onRemoveFriend={handleRemoveFriend}
          onBlock={handleBlock}
          onReport={handleReport}
        />

        {/* Modals */}
        <BlockUserModal
          visible={blockModalVisible}
          username={profile.username}
          onConfirm={handleConfirmBlock}
          onCancel={() => setBlockModalVisible(false)}
        />

        <ReportUserModal
          visible={reportModalVisible}
          username={profile.username}
          onSubmit={handleSubmitReport}
          onCancel={() => setReportModalVisible(false)}
        />

        <MuteOptionsModal
          visible={muteModalVisible}
          username={profile.username}
          displayName={profile.displayName}
          isCurrentlyMuted={isMuted}
          onConfirm={handleConfirmMute}
          onUnmute={handleUnmute}
          onClose={() => setMuteModalVisible(false)}
          loading={muteActionLoading}
        />
      </View>
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
  innerContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: 0.2,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "500",
  },
  content: {
    flexGrow: 1,
  },
});
