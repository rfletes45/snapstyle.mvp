/**
 * OwnProfileScreen
 *
 * The current user's profile screen with full editing capabilities.
 * Replaces the legacy ProfileScreen when NEW_PROFILE_LAYOUT feature flag is enabled.
 *
 * Features:
 * - Profile picture with decoration editing
 * - Bio editing
 * - Status/mood setting
 * - Featured badges showcase
 * - Stats dashboard
 * - Quick action navigation
 *
 * @module screens/profile/OwnProfileScreen
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, Divider, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BadgeShowcase } from "@/components/badges";
import {
  FriendsSection,
  GameScoresDisplay,
  GameScoresEditor,
  ProfileActions as ProfileActionsGrid,
  ProfileBackground,
  ProfileStats,
  ProfileThemePicker,
} from "@/components/profile";
import { ProfileBioEditor } from "@/components/profile/ProfileBio/index";
import { OwnProfileHeader } from "@/components/profile/ProfileHeader/index";
import {
  DecorationPickerModal,
  ProfilePictureEditor,
} from "@/components/profile/ProfilePicture";
import { LoadingState } from "@/components/ui";
import { BorderRadius, Spacing } from "@/constants/theme";
import { ProfileThemeColorsProvider } from "@/contexts/ProfileThemeColorsContext";
import { getThemeById, PROFILE_THEMES } from "@/data/profileThemes";
import { useFullProfileData } from "@/hooks/useFullProfileData";
import { useGameScores } from "@/hooks/useGameScores";
import { useProfileData } from "@/hooks/useProfileData";
import { useProfilePicture } from "@/hooks/useProfilePicture";
import { logout } from "@/services/auth";
import { getEquippedTheme, getUserOwnedThemes } from "@/services/profileThemes";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import type { ProfileAction, ProfileTheme } from "@/types/profile";
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
  const theme = useTheme();
  const colors = {
    background: theme.colors.background,
    surface: theme.colors.surface,
    error: theme.colors.error,
    onError: theme.colors.onError,
  };
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const { profile: baseProfile, refreshProfile } = useUser();
  const {
    profile,
    loading: profileDataLoading,
    refresh,
  } = useProfileData(currentFirebaseUser?.uid);

  // Full profile data for bio and status
  const { profile: fullProfile, refresh: refreshFullProfile } =
    useFullProfileData({ userId: currentFirebaseUser?.uid || "" });

  // Profile picture hook
  const {
    picture,
    decoration,
    ownedDecorations,
    refresh: refreshPicture,
  } = useProfilePicture({ userId: currentFirebaseUser?.uid || "" });

  // Game scores hook
  const {
    displayScores: gameScores,
    allScores: allGameScores,
    config: gameScoresConfig,
    updateConfig: updateGameScoresConfig,
    refresh: refreshGameScores,
  } = useGameScores({
    userId: currentFirebaseUser?.uid || "",
    maxScores: 5,
  });

  // Derived from hook results
  const pictureUrl = picture?.url || null;
  const decorationId = decoration?.decorationId || null;

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [pictureEditorVisible, setPictureEditorVisible] = useState(false);
  const [decorationPickerVisible, setDecorationPickerVisible] = useState(false);
  const [bioEditorVisible, setBioEditorVisible] = useState(false);
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [gameScoresEditorVisible, setGameScoresEditorVisible] = useState(false);

  // Theme state
  const [equippedTheme, setEquippedTheme] = useState<ProfileTheme | null>(null);
  const [ownedThemes, setOwnedThemes] = useState<string[]>([]);
  const [themeLoading, setThemeLoading] = useState(true);

  // Ref to track decoration picker delay timer
  const decorationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bio and status from full profile data
  const userBio: ProfileBio | null = fullProfile?.bio || null;
  const userStatus: ProfileStatus | null = fullProfile?.status || null;

  // ==========================================================================
  // Load Theme Data
  // ==========================================================================

  const loadThemeData = useCallback(async () => {
    if (!currentFirebaseUser?.uid) return;

    setThemeLoading(true);
    try {
      const [themeId, owned] = await Promise.all([
        getEquippedTheme(currentFirebaseUser.uid),
        getUserOwnedThemes(currentFirebaseUser.uid),
      ]);

      // Convert theme ID to theme object
      if (themeId) {
        const themeObj = getThemeById(themeId);

        if (!themeObj) {
          // Fall back to dark_mode theme if the theme ID doesn't exist
          const fallbackTheme =
            getThemeById("dark_mode") || PROFILE_THEMES[1] || PROFILE_THEMES[0];
          setEquippedTheme(fallbackTheme);
        } else {
          setEquippedTheme(themeObj);
        }
      } else {
        // Default to first theme if none equipped
        setEquippedTheme(PROFILE_THEMES[0] || null);
      }

      setOwnedThemes(owned);
    } catch (error) {
      logger.error("Error loading theme data:", error);
    } finally {
      setThemeLoading(false);
    }
  }, [currentFirebaseUser?.uid]);

  useEffect(() => {
    loadThemeData();
  }, [loadThemeData]);

  // Clean up decoration timer on unmount
  useEffect(() => {
    return () => {
      if (decorationTimerRef.current) {
        clearTimeout(decorationTimerRef.current);
      }
    };
  }, []);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refresh(),
      refreshPicture(),
      refreshFullProfile(),
      loadThemeData(),
    ]);
    setRefreshing(false);
  }, [refresh, refreshPicture, refreshFullProfile, loadThemeData]);

  const handleSignOut = useCallback(async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (error: any) {
            logger.error("Sign out error:", error);
          }
        },
      },
    ]);
  }, []);

  const handleEditPicture = useCallback(() => {
    setPictureEditorVisible(true);
  }, []);

  const handleOpenDecorationPicker = useCallback(() => {
    setPictureEditorVisible(false);
    // Wait for modal dismiss animation to complete before opening next modal
    if (decorationTimerRef.current) {
      clearTimeout(decorationTimerRef.current);
    }
    decorationTimerRef.current = setTimeout(() => {
      setDecorationPickerVisible(true);
      decorationTimerRef.current = null;
    }, 350);
  }, []);

  const handleOpenDecorationPickerDirect = useCallback(() => {
    setDecorationPickerVisible(true);
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
    (newBio: ProfileBio) => {
      refreshFullProfile();
    },
    [refreshFullProfile],
  );

  const handlePictureUpdated = useCallback(() => {
    refreshPicture();
  }, [refreshPicture]);

  const handleDecorationChanged = useCallback(() => {
    refreshPicture();
  }, [refreshPicture]);

  const handleOpenThemePicker = useCallback(() => {
    setThemePickerVisible(true);
  }, []);

  const handleThemeChanged = useCallback((theme: ProfileTheme) => {
    setEquippedTheme(theme);
  }, []);

  // Modal close handlers
  const handleClosePictureEditor = useCallback(() => {
    setPictureEditorVisible(false);
  }, []);

  const handleCloseDecorationPicker = useCallback(() => {
    setDecorationPickerVisible(false);
  }, []);

  const handleCloseBioEditor = useCallback(() => {
    setBioEditorVisible(false);
  }, []);

  const handleCloseThemePicker = useCallback(() => {
    setThemePickerVisible(false);
  }, []);

  const handleCloseGameScoresEditor = useCallback(() => {
    setGameScoresEditorVisible(false);
  }, []);

  // Action buttons configuration
  const actions = useMemo<ProfileAction[]>(
    () => [
      {
        id: "wallet",
        label: "My Wallet",
        icon: "wallet",
        onPress: () => navigation.navigate("Wallet"),
      },
      {
        id: "shop",
        label: "Shop",
        icon: "shopping",
        onPress: () => navigation.navigate("Shop"),
      },
      {
        id: "theme",
        label: "Themes",
        icon: "palette",
        onPress: handleOpenThemePicker,
      },
      {
        id: "decorations",
        label: "Decorations",
        icon: "star-circle",
        onPress: handleOpenDecorationPickerDirect,
      },
      {
        id: "tasks",
        label: "Daily Tasks",
        icon: "clipboard-check",
        onPress: () => navigation.navigate("Tasks"),
      },
      {
        id: "settings",
        label: "Settings",
        icon: "cog",
        onPress: () => navigation.navigate("Settings"),
      },
      ...(__DEV__
        ? [
            {
              id: "debug",
              label: "Debug",
              icon: "bug",
              onPress: () => navigation.navigate("Debug"),
            },
          ]
        : []),
      {
        id: "blocked",
        label: "Blocked Users",
        icon: "account-cancel",
        onPress: () => navigation.navigate("BlockedUsers"),
      },
    ],
    [navigation, handleOpenThemePicker, handleOpenDecorationPickerDirect],
  );

  // ==========================================================================
  // Render
  // ==========================================================================

  // Loading state - wait for both profile data AND theme to load
  if (!baseProfile || profileDataLoading || themeLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingState message="Loading profile..." />
      </View>
    );
  }

  return (
    <ProfileThemeColorsProvider theme={equippedTheme}>
      <ProfileBackground theme={equippedTheme} style={styles.container}>
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
          {/* Profile Header */}
          <OwnProfileHeader
            displayName={baseProfile.displayName}
            username={baseProfile.username}
            pictureUrl={pictureUrl}
            decorationId={decorationId}
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
          />

          <Divider style={styles.divider} />

          {/* Game Scores Display */}
          <>
            <GameScoresDisplay
              scores={gameScores}
              enabled={gameScoresConfig.enabled}
              isOwnProfile={true}
              onEditPress={() => setGameScoresEditorVisible(true)}
              onGamePress={(gameId) => {
                // Navigate to game
                navigation.navigate("Games", { gameId });
              }}
              testID="own-profile-game-scores"
            />
            <Divider style={styles.divider} />
          </>

          {/* Featured Badges */}
          {profile?.featuredBadges && (
            <>
              <BadgeShowcase
                badges={profile.featuredBadges}
                onBadgePress={(badge) => {
                  navigation.navigate("BadgeCollection", {
                    highlightBadgeId: badge.badgeId,
                  });
                }}
                onViewAll={() => navigation.navigate("BadgeCollection")}
              />
              <Divider style={styles.divider} />
            </>
          )}

          {/* Friends Section */}
          {currentFirebaseUser?.uid && (
            <>
              <FriendsSection
                userId={currentFirebaseUser.uid}
                maxDisplay={10}
                onSeeAllPress={() => navigation.navigate("Connections")}
                onFriendPress={(friendUid) =>
                  navigation.navigate("UserProfile", { userId: friendUid })
                }
              />
              <Divider style={styles.divider} />
            </>
          )}

          {/* Stats Dashboard */}
          {profile?.stats && (
            <>
              <ProfileStats stats={profile.stats} expanded={false} />
              <Divider style={styles.divider} />
            </>
          )}

          {/* Action Buttons */}
          <ProfileActionsGrid actions={actions} />

          {/* Sign Out */}
          <View style={styles.signOutContainer}>
            <Button
              mode="contained"
              onPress={handleSignOut}
              buttonColor={colors.error}
              textColor={colors.onError}
              style={styles.signOutButton}
              accessibilityLabel="Sign out of your account"
            >
              Sign Out
            </Button>
          </View>
        </ScrollView>
      </ProfileBackground>

      {/* Profile Picture Editor Modal */}
      <ProfilePictureEditor
        visible={pictureEditorVisible}
        userId={currentFirebaseUser?.uid || ""}
        currentPictureUrl={pictureUrl}
        name={baseProfile.displayName}
        decorationId={decorationId}
        onClose={handleClosePictureEditor}
        onPictureUpdated={handlePictureUpdated}
        onDecorationPress={handleOpenDecorationPicker}
      />

      {/* Decoration Picker Modal */}
      <DecorationPickerModal
        visible={decorationPickerVisible}
        userId={currentFirebaseUser?.uid || ""}
        pictureUrl={pictureUrl}
        name={baseProfile.displayName}
        ownedDecorationIds={ownedDecorations}
        currentDecorationId={decorationId}
        onClose={handleCloseDecorationPicker}
        onDecorationChanged={handleDecorationChanged}
      />

      {/* Bio Editor Modal */}
      <ProfileBioEditor
        visible={bioEditorVisible}
        userId={currentFirebaseUser?.uid || ""}
        currentBio={userBio}
        onClose={handleCloseBioEditor}
        onBioUpdated={handleBioUpdated}
      />

      {/* Profile Theme Picker Modal */}
      <ProfileThemePicker
        visible={themePickerVisible}
        userId={currentFirebaseUser?.uid || ""}
        currentThemeId={equippedTheme?.id}
        onClose={handleCloseThemePicker}
        onThemeChanged={handleThemeChanged}
      />

      {/* Game Scores Editor Modal */}
      <GameScoresEditor
        visible={gameScoresEditorVisible}
        currentConfig={gameScoresConfig}
        availableScores={allGameScores}
        onDismiss={handleCloseGameScoresEditor}
        onSave={async (newConfig) => {
          await updateGameScoresConfig(newConfig);
          await refreshGameScores();
        }}
        testID="game-scores-editor"
      />
    </ProfileThemeColorsProvider>
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
  divider: {
    marginVertical: Spacing.md,
  },
  signOutContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    marginTop: "auto",
  },
  signOutButton: {
    borderRadius: BorderRadius.md,
  },
});
