/**
 * UserProfileScreen
 *
 * Screen for viewing another user's profile.
 * Shows profile info, stats, badges, and provides actions based on relationship.
 *
 * Features:
 * - Profile picture with decoration
 * - Display name, username, bio
 * - Status/mood indicator
 * - Friendship info (streak, duration)
 * - Mutual friends display
 * - Dynamic action buttons (Add Friend, Message, Call, etc.)
 * - Block/Report/Mute options
 * - Profile sharing
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

import BlockUserModal from "@/components/BlockUserModal";
import ReportUserModal from "@/components/ReportUserModal";
import { MuteOptionsModal, MutualFriendsSection } from "@/components/profile";
import {
  AchievementsTrophyCaseCard,
  BadgesCard,
  FriendsCard,
} from "@/components/profile/OverviewCards";
import {
  MoreOptionsMenu,
  ProfileActionsBar,
} from "@/components/profile/ProfileActions/index";
import { UserProfileHeader } from "@/components/profile/ProfileHeader/index";
import { SocialProofSection } from "@/components/profile/SocialProof";
import { CALL_FEATURES } from "@/constants/featureFlags";
import { Spacing } from "@/constants/theme";
import { useBadges } from "@/hooks/useBadges";
import { useAuth } from "@/store/AuthContext";
import { useColors } from "@/store/ThemeContext";
import * as haptics from "@/utils/haptics";
import { areNativeCallsAvailable } from "@/utils/platform";

// Services
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
  const insets = useSafeAreaInsets();
  const currentUserId = currentFirebaseUser?.uid;

  const colors = useColors();
  const canInitiateCalls =
    CALL_FEATURES.CALLS_ENABLED && areNativeCallsAvailable;

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

  // Badges hook — subscribes to the viewed user's badges
  const { featuredBadges, stats: badgeStats } = useBadges(userId);

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
    navigation.navigate("ChatDetail", { friendUid: userId });
  }, [userId, navigation]);

  const handleCall = useCallback(() => {
    if (!userId) return;
    haptics.buttonPress();
    // Navigate to audio call
    navigation.navigate("AudioCall", {
      recipientId: userId,
      recipientName: profile?.displayName,
      isOutgoing: true,
    });
  }, [userId, profile, navigation]);

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

      try {
        await blockUser(currentUserId, userId, reason);
        setBlockModalVisible(false);
        await loadProfileData();
        Alert.alert("User Blocked", `${profile?.displayName} has been blocked`);
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to block user");
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
  // Render
  // ==========================================================================

  if (loading) {
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
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header with Picture, Name, Bio */}
          <UserProfileHeader
            displayName={profile.displayName}
            username={profile.username}
            pictureUrl={profile.profilePicture?.url || null}
            decorationId={profile.avatarDecoration?.decorationId || null}
            backgroundId={profile.equippedBackgroundId ?? null}
            bio={profile.bio}
            status={profile.status}
            level={profile.level}
            topInset={insets.top}
            lastActive={
              profile.privacy.showLastActive !== "nobody"
                ? profile.lastActive
                : null
            }
            friendshipDetails={
              relationship?.type === "friend" ? friendshipDetails : null
            }
          />

          {/* Muted indicator */}
          {isMuted && (
            <View
              style={[
                styles.mutedBadge,
                { backgroundColor: colors.surfaceVariant + "99" },
              ]}
            >
              <MaterialCommunityIcons
                name="bell-off"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                Muted
              </Text>
            </View>
          )}

          {/* Social Proof (streak for friendship + activity) */}
          {relationship?.type === "friend" && friendshipDetails && (
            <SocialProofSection
              userId={userId}
              streakCount={
                streaksPrivacyHidden ? 0 : (friendshipDetails.streakCount ?? 0)
              }
              showRecentActivity={!activityPrivacyHidden}
              isOwnProfile={false}
            />
          )}

          {/* ========================================================== */}
          {/* Overview Cards */}
          {/* ========================================================== */}
          <View style={styles.cardsSection}>
            {/* Friends Card */}
            <FriendsCard
              userId={userId}
              isOwnProfile={false}
              privacyHidden={friendsPrivacyHidden}
              enterIndex={0}
              onPress={
                !friendsPrivacyHidden
                  ? () =>
                      navigation.navigate("MutualFriendsList", {
                        userId: currentUserId,
                        targetUserId: userId,
                      })
                  : undefined
              }
              onFriendPress={(friendUid) =>
                navigation.push("UserProfile", { userId: friendUid })
              }
            />

            {/* Badges Card */}
            <BadgesCard
              badges={featuredBadges}
              totalEarned={badgeStats.earned}
              privacyHidden={badgesPrivacyHidden}
              enterIndex={1}
              onPress={
                !badgesPrivacyHidden
                  ? () =>
                      navigation.navigate("MainTabs", {
                        screen: "Profile",
                        params: {
                          screen: "BadgeCollection",
                          params: { userId },
                        },
                      })
                  : undefined
              }
            />

            {/* Achievements Trophy Case Card */}
            <AchievementsTrophyCaseCard
              userId={userId}
              featuredAchievementIds={
                profile.featuredAchievements?.achievementIds ?? []
              }
              privacyHidden={achievementsPrivacyHidden}
              enterIndex={2}
              onPress={
                !achievementsPrivacyHidden
                  ? () =>
                      navigation.navigate("ProfileAchievements", {
                        userId,
                        displayName: profile.displayName,
                        featuredIds:
                          profile.featuredAchievements?.achievementIds ?? [],
                      })
                  : undefined
              }
            />

            {/* Mutual Friends (compact) */}
            {mutualFriends.length > 0 && profile.privacy.showMutualFriends && (
              <MutualFriendsSection
                friends={mutualFriends}
                onFriendPress={(friendUserId) =>
                  navigation.push("UserProfile", { userId: friendUserId })
                }
                onSeeAllPress={() =>
                  navigation.navigate("MutualFriendsList", {
                    userId: currentUserId,
                    targetUserId: userId,
                  })
                }
                maxDisplay={6}
                testID="user-profile-mutual-friends"
              />
            )}
          </View>

          {/* Action Buttons */}
          {relationship && (
            <ProfileActionsBar
              relationship={relationship}
              isLoading={actionLoading}
              loadingAction={loadingAction}
              onAddFriend={handleAddFriend}
              onCancelRequest={handleCancelRequest}
              onAcceptRequest={handleAcceptRequest}
              onDeclineRequest={handleDeclineRequest}
              onMessage={handleMessage}
              onCall={canInitiateCalls ? handleCall : undefined}
              onRemoveFriend={handleRemoveFriend}
              onUnblock={handleUnblock}
              onMoreOptions={handleMoreOptions}
            />
          )}

          {/* Bottom spacing */}
          <View style={{ height: insets.bottom + 24 }} />
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
    paddingBottom: Spacing.xxxl,
  },
  mutedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: Spacing.md,
    gap: 6,
  },
  mutedText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  cardsSection: {
    marginTop: Spacing.md,
    paddingHorizontal: 0,
  },
});
