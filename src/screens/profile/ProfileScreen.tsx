import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Button, TextInput, useTheme } from "react-native-paper";
import { signOut } from "firebase/auth";
import { getAuthInstance } from "@/services/firebase";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import { updateProfile } from "@/services/users";
import { isValidDisplayName } from "@/utils/validators";
import Avatar from "@/components/Avatar";
import AvatarCustomizer from "@/components/AvatarCustomizer";
import { LoadingState } from "@/components/ui";
import { Spacing, BorderRadius } from "../../../constants/theme";
import type { AvatarConfig } from "@/types/models";

export default function ProfileScreen({ navigation }: any) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile, refreshProfile } = useUser();

  const [isEditing, setIsEditing] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(
    profile?.displayName || "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      const success = await updateProfile(currentFirebaseUser.uid, {
        displayName: editDisplayName,
      });

      if (success) {
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

  const handleSignOut = async () => {
    try {
      const auth = getAuthInstance();
      await signOut(auth);
    } catch (error: any) {
      console.error("Sign out error:", error);
    }
  };

  if (!profile) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <LoadingState message="Loading profile..." />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Profile Header */}
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Profile
      </Text>

      {/* Avatar Preview with Customization */}
      {!isEditing && (
        <View style={styles.avatarSection}>
          <Avatar
            config={profile.avatarConfig || { baseColor: theme.colors.primary }}
            size={120}
          />
          <Button
            mode="outlined"
            onPress={() => setShowCustomizer(true)}
            style={styles.customizeButton}
            icon="palette"
          >
            Customize Avatar
          </Button>
        </View>
      )}

      {/* Avatar Customizer Modal */}
      <AvatarCustomizer
        visible={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        userId={currentFirebaseUser?.uid || ""}
        currentConfig={
          profile.avatarConfig || { baseColor: theme.colors.primary }
        }
        onSave={async (newConfig: AvatarConfig) => {
          await refreshProfile();
          setSuccess("Avatar updated!");
          setTimeout(() => setSuccess(""), 2000);
        }}
      />

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
          {profile.username}
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
              {profile.displayName}
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
                setEditDisplayName(profile.displayName);
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
  content: {
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
