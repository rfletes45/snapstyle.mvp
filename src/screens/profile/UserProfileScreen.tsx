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
  Divider,
  IconButton,
  Text,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BlockUserModal from "@/components/BlockUserModal";
import ReportUserModal from "@/components/ReportUserModal";
import {
  FriendshipInfoCard,
  GameScoresDisplay,
  MuteOptionsModal,
  MutualFriendsSection,
  ProfileBackground,
  ScoreComparisonView,
  ShareProfileButton,
} from "@/components/profile";
import {
  MoreOptionsMenu,
  ProfileActionsBar,
} from "@/components/profile/ProfileActions/index";
import { UserProfileHeader } from "@/components/profile/ProfileHeader/index";
import { PROFILE_V2_FEATURES } from "@/constants/featureFlags";
import { Spacing } from "@/constants/theme";
import {
  ProfileThemeProvider,
  useProfileTheme,
} from "@/contexts/ProfileThemeContext";
import { useScoreComparison } from "@/hooks/useGameScores";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import * as haptics from "@/utils/haptics";

// Services
import { getThemeById } from "@/data/profileThemes";
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
import { getEquippedTheme } from "@/services/profileThemes";
import { submitReport } from "@/services/reporting";

// Types
import type { ReportReason } from "@/types/models";
import type { ProfileTheme } from "@/types/profile";
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
  const { userId } = route.params as { userId: string };
  const { currentFirebaseUser } = useAuth();
  const currentUserId = currentFirebaseUser?.uid;

  return (
    <ProfileThemeProvider
      profileUserId={userId}
      viewerUserId={currentUserId}
      isOwnProfile={false}
    >
      <UserProfileScreenContent route={route} navigation={navigation} />
    </ProfileThemeProvider>
  );
}

// =============================================================================
// Inner Content (wrapped by ProfileThemeProvider)
// =============================================================================

function UserProfileScreenContent({
  route,
  navigation,
}: UserProfileScreenProps) {
  const { userId } = route.params as { userId: string };
  const { currentFirebaseUser } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const currentUserId = currentFirebaseUser?.uid;

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

  // Theme state
  const [profileTheme, setProfileTheme] = useState<ProfileTheme | null>(null);
  const { effectiveTheme, themePreference, viewerTheme } = useProfileTheme();

  // Game scores comparison hook
  const {
    ownerScores: profileGameScores,
    viewerScores: myGameScores,
    isLoading: gameScoresLoading,
  } = useScoreComparison({
    ownerId: userId,
    viewerId: currentUserId || "",
    autoFetch: true,
  });

  // Determine which theme to display based on user preference
  const displayTheme = useMemo(() => {
    if (themePreference === "my_theme") {
      return viewerTheme; // Use the viewer's theme
    }
    return profileTheme || viewerTheme; // Use the profile owner's theme or fallback to viewer's
  }, [themePreference, viewerTheme, profileTheme]);

  // ==========================================================================
  // Load Profile Data
  // ==========================================================================

  const loadProfileData = useCallback(async () => {
    if (!userId || !currentUserId) return;

    setLoading(true);
    setError(null);

    try {
      // Load all data in parallel
      const [
        profileData,
        relationshipData,
        mutualFriendsData,
        mutedStatus,
        userTheme,
      ] = await Promise.all([
        getFullProfileData(userId),
        getRelationship(currentUserId, userId),
        getMutualFriends(currentUserId, userId),
        isUserMuted(currentUserId, userId),
        getEquippedTheme(userId),
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

      // Convert theme ID to theme object
      if (userTheme) {
        const themeObj = getThemeById(userTheme);
        setProfileTheme(themeObj || null);
      }

      // Load friendship details if friends
      if (relationshipData.type === "friend") {
        const details = await getFriendshipDetailsForUser(
          currentUserId,
          userId,
        );
        setFriendshipDetails(details);
      }

      // Track profile view (only if not own profile)
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
  // Render Helpers
  // ==========================================================================

  const getMoodEmoji = (mood: string) => {
    const moodConfig: Record<
      string,
      { emoji: string; label: string; color: string }
    > = {
      happy: { emoji: "😊", label: "Happy", color: "#FFD700" },
      excited: { emoji: "🎉", label: "Excited", color: "#FF69B4" },
      chill: { emoji: "😎", label: "Chillin", color: "#87CEEB" },
      busy: { emoji: "💼", label: "Busy", color: "#FF4500" },
      gaming: { emoji: "🎮", label: "Gaming", color: "#9B59B6" },
      studying: { emoji: "📚", label: "Studying", color: "#3498DB" },
      away: { emoji: "🌙", label: "Away", color: "#95A5A6" },
      sleeping: { emoji: "😴", label: "Sleeping", color: "#34495E" },
      custom: { emoji: "✨", label: "Custom", color: "#E91E63" },
    };
    return moodConfig[mood] || moodConfig.custom;
  };

  const formatLastActiveTime = (lastActive: number): string => {
    const now = Date.now();
    const diff = now - lastActive;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(lastActive).toLocaleDateString();
  };

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
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
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
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
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
          <Button mode="outlined" onPress={() => navigation.goBack()}>
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
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
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
          <Button mode="outlined" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  return (
    <ProfileBackground theme={displayTheme} style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton
          icon="arrow-left"
          onPress={() => navigation.goBack()}
          iconColor={colors.text}
        />
        <View style={styles.headerRight}>
          <IconButton
            icon="dots-vertical"
            onPress={handleMoreOptions}
            iconColor={colors.text}
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
          bio={profile.bio}
          status={profile.status}
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
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name="bell-off"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
              Muted
            </Text>
          </View>
        )}

        <Divider style={styles.divider} />

        {/* Game Scores Display */}
        {profile.gameScores?.enabled !== false &&
          profile.privacy.showGameScores !== "nobody" && (
            <>
              {relationship?.type === "friend" ? (
                // Show comparison view for friends
                <ScoreComparisonView
                  ownerScores={profileGameScores}
                  viewerScores={myGameScores}
                  ownerName={profile.displayName}
                  viewerName="You"
                  testID="user-profile-score-comparison"
                />
              ) : (
                // Show regular scores for non-friends
                <GameScoresDisplay
                  scores={profileGameScores}
                  enabled={true}
                  isOwnProfile={false}
                  onGamePress={(gameId) => {
                    navigation.navigate("Games", { gameId });
                  }}
                  testID="user-profile-game-scores"
                />
              )}
              <Divider style={styles.divider} />
            </>
          )}

        {/* Friendship Info Card (for friends) */}
        {relationship?.type === "friend" && friendshipDetails && (
          <>
            <FriendshipInfoCard
              details={friendshipDetails}
              testID="user-profile-friendship-info"
            />
            <Divider style={styles.divider} />
          </>
        )}

        {/* Mutual Friends - Using new component */}
        {mutualFriends.length > 0 && profile.privacy.showMutualFriends && (
          <>
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
            <Divider style={styles.divider} />
          </>
        )}

        {/* Share Profile Button */}
        {PROFILE_V2_FEATURES.PROFILE_SHARING &&
          profile.privacy.allowProfileSharing && (
            <ShareProfileButton
              userId={userId}
              displayName={profile.displayName}
              username={profile.username}
              variant="full"
              style={styles.shareButton}
            />
          )}

        {/* Action Buttons - Using ProfileActionsBar */}
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
            onCall={handleCall}
            onRemoveFriend={handleRemoveFriend}
            onUnblock={handleUnblock}
            onMoreOptions={handleMoreOptions}
          />
        )}
      </ScrollView>

      {/* More Options Menu */}
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
    </ProfileBackground>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
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
    fontSize: 16,
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
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    alignItems: "center",
  },
  mutedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: Spacing.md,
    gap: 6,
  },
  mutedText: {
    fontSize: 13,
    fontWeight: "500",
  },
  divider: {
    width: "80%",
    marginVertical: Spacing.md,
  },
  section: {
    width: "100%",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  mutualFriendsScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  mutualFriendItem: {
    alignItems: "center",
    marginRight: Spacing.md,
    width: 64,
  },
  mutualFriendName: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  shareButton: {
    width: "100%",
    marginVertical: Spacing.sm,
  },
});
