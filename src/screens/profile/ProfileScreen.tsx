/**
 * ProfileScreen
 *
 * Profile screen with:
 * - Profile header with avatar and level
 * - Featured badges showcase
 * - Stats dashboard
 * - Action buttons for navigation
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 */

import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Button, Divider, Text, TextInput, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BadgeShowcase } from "@/components/badges";
import { ProfileStats } from "@/components/profile";
import { ProfileActions } from "@/components/profile/LegacyProfileActions";
import { ProfileHeader } from "@/components/profile/LegacyProfileHeader";
import { LoadingState } from "@/components/ui";
import { useProfileData } from "@/hooks/useProfileData";
import { logout } from "@/services/auth";
import { updateProfile } from "@/services/users";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import type { ProfileAction } from "@/types/profile";
import { isValidDisplayName } from "@/utils/validators";
import { BorderRadius, Spacing } from "@/constants/theme";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/profile/ProfileScreen");
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

  const [refreshing, setRefreshing] = useState(false);

  // Legacy state for edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(
    baseProfile?.displayName || "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      logger.error("Profile update error:", err);
      setError(err.message || "Couldn't update profile");
    } finally {
      setLoading(false);
    }
  };

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    try {
      await logout();
    } catch (error: any) {
      logger.error("Sign out error:", error);
    }
  }, []);

  // Action buttons configuration for new layout
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
        id: "tasks",
        label: "Daily Tasks",
        icon: "clipboard-check",
        onPress: () => navigation.navigate("Tasks"),
        badge: 3, // NOTE: Get actual count from tasks service
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
    [navigation],
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
  // NEW PROFILE LAYOUT
  // ========================================
  if (profile) {
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
          avatarConfig={profile.avatarConfig}
          level={profile.level}
          onEditPress={() => navigation.navigate("Settings")}
        />

        {/* Featured Badges */}
        <>
          <BadgeShowcase
            badges={profile.featuredBadges}
            onBadgePress={(badge) => {
              // NOTE: Open badge detail modal
              logger.info("Badge pressed:", badge.badgeId);
            }}
            onViewAll={() => navigation.navigate("BadgeCollection")}
          />
          <Divider style={styles.divider} />
        </>

        {/* Stats Dashboard */}
        <>
          <ProfileStats stats={profile.stats} expanded={false} />
          <Divider style={styles.divider} />
        </>

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

      {/* Avatar Preview */}
      {!isEditing && (
        <View style={styles.avatarSection}>
          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor:
                  baseProfile.avatarConfig?.baseColor || theme.colors.primary,
              },
            ]}
          >
            <Text style={styles.avatarEmoji}>
              {baseProfile.avatarConfig?.hat || "😊"}
            </Text>
          </View>
        </View>
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
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarEmoji: {
    fontSize: 48,
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
