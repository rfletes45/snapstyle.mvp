/**
 * ProfileScreen
 *
 * Redesigned profile screen with:
 * - Profile header with avatar and level
 * - Featured badges showcase
 * - Stats dashboard
 * - Action buttons for navigation
 * - Digital Avatar Customization (Phase 6)
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */

import { signOut } from "firebase/auth";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Button, Divider, Text, TextInput, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "@/components/Avatar";
import AvatarCustomizer from "@/components/AvatarCustomizer";
import { AvatarCustomizerModal } from "@/components/avatar/AvatarCustomizer";
import { BadgeShowcase } from "@/components/badges";
import {
  ProfileActions,
  ProfileHeader,
  ProfileStats,
} from "@/components/profile";
import { LoadingState } from "@/components/ui";
import { useProfileData } from "@/hooks/useProfileData";
import { saveDigitalAvatar } from "@/services/avatarService";
import { getAuthInstance } from "@/services/firebase";
import { updateProfile } from "@/services/users";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import type { DigitalAvatarConfig } from "@/types/avatar";
import type { AvatarConfig } from "@/types/models";
import type { ProfileAction } from "@/types/profile";
import { getDefaultAvatarConfig } from "@/utils/avatarHelpers";
import { isValidDisplayName } from "@/utils/validators";
import {
  AVATAR_FEATURES,
  PROFILE_FEATURES,
} from "../../../constants/featureFlags";
import { BorderRadius, Spacing } from "../../../constants/theme";

export default function ProfileScreen({ navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const { profile: baseProfile, refreshProfile } = useUser();
  const {
    profile,
    loading: profileDataLoading,
    refresh,
  } = useProfileData(currentFirebaseUser?.uid);

  // Avatar customizer state - supports both legacy and digital
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showDigitalCustomizer, setShowDigitalCustomizer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Legacy state for edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(
    baseProfile?.displayName || "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Determine if we should use digital avatar system
  const useDigitalAvatar =
    AVATAR_FEATURES.DIGITAL_AVATAR_ENABLED && AVATAR_FEATURES.AVATAR_CUSTOMIZER;

  // Get current digital avatar config (or create default)
  const currentDigitalAvatarConfig: DigitalAvatarConfig = useMemo(() => {
    // Use existing digital avatar if available
    if (baseProfile?.digitalAvatar) {
      return baseProfile.digitalAvatar as DigitalAvatarConfig;
    }
    // Otherwise create default
    return getDefaultAvatarConfig();
  }, [baseProfile?.digitalAvatar]);

  // Handle opening the appropriate customizer
  const handleOpenCustomizer = useCallback(() => {
    if (useDigitalAvatar) {
      setShowDigitalCustomizer(true);
    } else {
      setShowCustomizer(true);
    }
  }, [useDigitalAvatar]);

  // Handle saving digital avatar
  const handleSaveDigitalAvatar = useCallback(
    async (config: DigitalAvatarConfig) => {
      if (!currentFirebaseUser?.uid) return;

      try {
        await saveDigitalAvatar(currentFirebaseUser.uid, config);
        await refreshProfile();
        setSuccess("Avatar updated!");
        setTimeout(() => setSuccess(""), 2000);
      } catch (err) {
        console.error("Error saving digital avatar:", err);
        setError("Failed to save avatar. Please try again.");
        setTimeout(() => setError(""), 3000);
      }
    },
    [currentFirebaseUser?.uid, refreshProfile],
  );

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Handle legacy save changes
  const handleSaveChanges = async () => {
    setError("");
    setSuccess("");

    // Validation
    if (!editDisplayName.trim()) {
      setError("Display name is required");
      return;
    }

    if (!isValidDisplayName(editDisplayName)) {
      setError("Display name must be 1-50 characters");
      return;
    }

    if (!currentFirebaseUser) {
      setError("User not authenticated");
      return;
    }

    setLoading(true);

    try {
      const updateSuccess = await updateProfile(currentFirebaseUser.uid, {
        displayName: editDisplayName,
      });

      if (updateSuccess) {
        await refreshProfile();
        setSuccess("All set!");
        setIsEditing(false);
        // Clear success message after 2 seconds
        setTimeout(() => setSuccess(""), 2000);
      } else {
        setError("Couldn't update profile. Please try again.");
      }
    } catch (err: any) {
      console.error("Profile update error:", err);
      setError(err.message || "Couldn't update profile");
    } finally {
      setLoading(false);
    }
  };

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    try {
      const auth = getAuthInstance();
      await signOut(auth);
    } catch (error: any) {
      console.error("Sign out error:", error);
    }
  }, []);

  // Action buttons configuration for new layout
  const actions = useMemo<ProfileAction[]>(
    () => [
      {
        id: "customize",
        label: useDigitalAvatar ? "Customize Avatar" : "Customize Profile",
        icon: useDigitalAvatar ? "account-edit" : "palette",
        onPress: handleOpenCustomizer,
      },
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
        id: "tasks",
        label: "Daily Tasks",
        icon: "clipboard-check",
        onPress: () => navigation.navigate("Tasks"),
        badge: 3, // TODO: Get actual count from tasks service
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
    [navigation, useDigitalAvatar, handleOpenCustomizer],
  );

  // Loading state (for both new and legacy)
  if (!baseProfile) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <LoadingState message="Loading profile..." />
      </View>
    );
  }

  // ========================================
  // NEW PROFILE LAYOUT (feature flag enabled)
  // ========================================
  if (PROFILE_FEATURES.NEW_PROFILE_LAYOUT && profile) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={[
          styles.newLayoutContent,
          { paddingTop: insets.top },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Profile Header */}
        <ProfileHeader
          displayName={profile.displayName}
          username={profile.username}
          avatarConfig={
            useDigitalAvatar && baseProfile?.digitalAvatar
              ? baseProfile.digitalAvatar
              : profile.avatarConfig
          }
          level={profile.level}
          onAvatarPress={handleOpenCustomizer}
          onEditPress={() => navigation.navigate("Settings")}
        />

        {/* Featured Badges */}
        {PROFILE_FEATURES.BADGE_SHOWCASE && (
          <>
            <BadgeShowcase
              badges={profile.featuredBadges}
              onBadgePress={(badge) => {
                // TODO: Open badge detail modal
                console.log("Badge pressed:", badge.badgeId);
              }}
              onViewAll={() => navigation.navigate("BadgeCollection")}
            />
            <Divider style={styles.divider} />
          </>
        )}

        {/* Stats Dashboard */}
        {PROFILE_FEATURES.PROFILE_STATS && (
          <>
            <ProfileStats stats={profile.stats} expanded={false} />
            <Divider style={styles.divider} />
          </>
        )}

        {/* Action Buttons */}
        <ProfileActions actions={actions} />

        {/* Sign Out */}
        <View style={styles.signOutContainer}>
          <Button
            mode="contained"
            onPress={handleSignOut}
            buttonColor={theme.colors.error}
            textColor={theme.colors.onError}
            style={styles.signOutButton}
          >
            Sign Out
          </Button>
        </View>

        {/* Digital Avatar Customizer Modal (new system) */}
        {useDigitalAvatar && (
          <AvatarCustomizerModal
            visible={showDigitalCustomizer}
            onDismiss={() => setShowDigitalCustomizer(false)}
            initialConfig={currentDigitalAvatarConfig}
            onSave={handleSaveDigitalAvatar}
            userId={currentFirebaseUser?.uid}
          />
        )}

        {/* Legacy Avatar Customizer Modal (fallback) */}
        {!useDigitalAvatar && (
          <AvatarCustomizer
            visible={showCustomizer}
            onClose={() => setShowCustomizer(false)}
            userId={currentFirebaseUser?.uid || ""}
            currentConfig={
              baseProfile?.avatarConfig || { baseColor: theme.colors.primary }
            }
            onSave={async (newConfig: AvatarConfig) => {
              await refreshProfile();
              setSuccess("Avatar updated!");
              setTimeout(() => setSuccess(""), 2000);
            }}
          />
        )}
      </ScrollView>
    );
  }

  // ========================================
  // LEGACY LAYOUT (feature flag disabled)
  // ========================================
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.legacyContent, { paddingTop: insets.top }]}
    >
      {/* Profile Header */}
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Profile
      </Text>

      {/* Avatar Preview with Customization */}
      {!isEditing && (
        <View style={styles.avatarSection}>
          <Avatar
            config={
              useDigitalAvatar && baseProfile.digitalAvatar
                ? baseProfile.digitalAvatar
                : baseProfile.avatarConfig || {
                    baseColor: theme.colors.primary,
                  }
            }
            size={120}
          />
          <Button
            mode="outlined"
            onPress={handleOpenCustomizer}
            style={styles.customizeButton}
            icon={useDigitalAvatar ? "account-edit" : "palette"}
          >
            {useDigitalAvatar ? "Customize Avatar" : "Customize Profile"}
          </Button>
        </View>
      )}

      {/* Digital Avatar Customizer Modal (new system) */}
      {useDigitalAvatar && (
        <AvatarCustomizerModal
          visible={showDigitalCustomizer}
          onDismiss={() => setShowDigitalCustomizer(false)}
          initialConfig={currentDigitalAvatarConfig}
          onSave={handleSaveDigitalAvatar}
          userId={currentFirebaseUser?.uid}
        />
      )}

      {/* Legacy Avatar Customizer Modal (fallback) */}
      {!useDigitalAvatar && (
        <AvatarCustomizer
          visible={showCustomizer}
          onClose={() => setShowCustomizer(false)}
          userId={currentFirebaseUser?.uid || ""}
          currentConfig={
            baseProfile.avatarConfig || { baseColor: theme.colors.primary }
          }
          onSave={async (newConfig: AvatarConfig) => {
            await refreshProfile();
            setSuccess("Avatar updated!");
            setTimeout(() => setSuccess(""), 2000);
          }}
        />
      )}

      {/* Profile Info */}
      <View style={styles.infoSection}>
        <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
          Username
        </Text>
        <Text
          style={[
            styles.value,
            {
              backgroundColor: theme.colors.surfaceVariant,
              color: theme.colors.onBackground,
            },
          ]}
        >
          {baseProfile.username}
        </Text>

        <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
          Email
        </Text>
        <Text
          style={[
            styles.value,
            {
              backgroundColor: theme.colors.surfaceVariant,
              color: theme.colors.onBackground,
            },
          ]}
        >
          {currentFirebaseUser?.email}
        </Text>

        {!isEditing ? (
          <>
            <Text
              style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
            >
              Display Name
            </Text>
            <Text
              style={[
                styles.value,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  color: theme.colors.onBackground,
                },
              ]}
            >
              {baseProfile.displayName}
            </Text>
          </>
        ) : (
          <>
            {/* Edit Mode */}
            <Text
              style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
            >
              Edit Display Name
            </Text>
            <TextInput
              label="Display Name"
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              mode="outlined"
              style={styles.input}
              disabled={loading}
            />
          </>
        )}
      </View>

      {/* Status Messages */}
      {error ? (
        <Text
          style={[
            styles.error,
            {
              backgroundColor: theme.colors.errorContainer,
              color: theme.colors.error,
            },
          ]}
        >
          {error}
        </Text>
      ) : null}
      {success ? (
        <Text
          style={[
            styles.successMessage,
            {
              backgroundColor: theme.colors.primaryContainer,
              color: theme.colors.primary,
            },
          ]}
        >
          {success}
        </Text>
      ) : null}

      {/* Action Buttons */}
      <View style={styles.buttonSection}>
        {/* Wallet Button */}
        <Button
          mode="contained"
          onPress={() => navigation.navigate("Wallet")}
          icon="wallet"
          style={styles.button}
        >
          My Wallet
        </Button>

        {/* Shop Button */}
        <Button
          mode="contained-tonal"
          onPress={() => navigation.navigate("Shop")}
          icon="shopping"
          style={styles.button}
        >
          Shop
        </Button>

        {/* Daily Tasks Button */}
        <Button
          mode="contained-tonal"
          onPress={() => navigation.navigate("Tasks")}
          icon="clipboard-check"
          style={styles.button}
        >
          Daily Tasks
        </Button>

        {/* Settings Button */}
        <Button
          mode="outlined"
          onPress={() => navigation.navigate("Settings")}
          icon="cog"
          style={styles.button}
        >
          Settings
        </Button>

        {/* Debug Button - only in dev */}
        {__DEV__ && (
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("Debug")}
            icon="bug"
            style={styles.button}
          >
            Debug Rituals & Cosmetics
          </Button>
        )}

        {/* Blocked Users Button */}
        <Button
          mode="outlined"
          onPress={() => navigation.navigate("BlockedUsers")}
          icon="account-cancel"
          style={styles.button}
        >
          Blocked
        </Button>

        {!isEditing ? (
          <Button
            mode="contained"
            onPress={() => setIsEditing(true)}
            style={styles.button}
          >
            Edit Profile
          </Button>
        ) : (
          <>
            <Button
              mode="contained"
              onPress={handleSaveChanges}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Save Changes
            </Button>
            <Button
              mode="outlined"
              onPress={() => {
                setIsEditing(false);
                setEditDisplayName(baseProfile.displayName);
                setError("");
              }}
              disabled={loading}
              style={styles.button}
            >
              Cancel
            </Button>
          </>
        )}

        <Button
          mode="contained"
          onPress={handleSignOut}
          buttonColor={theme.colors.error}
          textColor={theme.colors.onError}
          style={[styles.button, styles.signOutButton]}
        >
          Sign Out
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // New layout styles
  newLayoutContent: {
    paddingBottom: 32,
  },
  divider: {
    marginVertical: 16,
    marginHorizontal: 16,
  },
  signOutContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  // Legacy layout styles
  legacyContent: {
    padding: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  customizeButton: {
    marginTop: Spacing.md,
  },
  infoSection: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  value: {
    fontSize: 16,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  input: {
    marginBottom: Spacing.md,
  },
  buttonSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  button: {
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  signOutButton: {
    marginTop: Spacing.md,
  },
  error: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  successMessage: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
});
