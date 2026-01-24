/**
 * SettingsScreen - User settings hub
 * Phase 15: Polish + Settings Hub
 *
 * Features:
 * - Notification toggles (local state, ready for persistence)
 * - Privacy settings entry
 * - Blocked users navigation
 * - Display name editing
 * - Account management section
 */

import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  Text,
  Switch,
  List,
  Divider,
  Button,
  TextInput,
  Portal,
  Dialog,
  useTheme,
} from "react-native-paper";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useAppTheme } from "@/store/ThemeContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { updateProfile } from "@/services/users";
import { isValidDisplayName } from "@/utils/validators";
import { signOut, deleteUser } from "firebase/auth";
import { getAuthInstance } from "@/services/firebase";

// =============================================================================
// Types
// =============================================================================

interface SettingsScreenProps {
  navigation: any;
}

interface NotificationSettings {
  messages: boolean;
  friendRequests: boolean;
  stories: boolean;
  streaks: boolean;
}

// =============================================================================
// Component
// =============================================================================

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser, customClaims } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { showSuccess, showError, showInfo } = useSnackbar();
  const { mode, setMode, isDark } = useAppTheme();
  const {
    enabled: inAppNotificationsEnabled,
    setEnabled: setInAppNotificationsEnabled,
  } = useInAppNotifications();

  // Notification toggles (local state - persisted to Firestore in future)
  const [notifications, setNotifications] = useState<NotificationSettings>({
    messages: true,
    friendRequests: true,
    stories: true,
    streaks: true,
  });

  // Edit display name state
  const [showEditName, setShowEditName] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(
    profile?.displayName || "",
  );
  const [savingName, setSavingName] = useState(false);

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // =============================================================================
  // Handlers
  // =============================================================================

  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    // TODO: Persist to Firestore in future phase
    showSuccess(
      `${key.charAt(0).toUpperCase() + key.slice(1)} notifications ${!notifications[key] ? "enabled" : "disabled"}`,
    );
  };

  const handleSaveDisplayName = async () => {
    if (!editDisplayName.trim()) {
      showError("Display name is required");
      return;
    }

    if (!isValidDisplayName(editDisplayName)) {
      showError("Display name must be 1-50 characters");
      return;
    }

    if (!currentFirebaseUser) {
      showError("User not authenticated");
      return;
    }

    setSavingName(true);

    // Create timeout to prevent infinite loading on network issues
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Request timed out. Check your connection.")),
        10000,
      );
    });

    try {
      const updatePromise = updateProfile(currentFirebaseUser.uid, {
        displayName: editDisplayName,
      });

      const success = await Promise.race([updatePromise, timeoutPromise]);

      if (success) {
        await refreshProfile();
        showSuccess("Display name updated!");
        setShowEditName(false);
      } else {
        showError("Failed to update display name");
      }
    } catch (err: any) {
      console.error("Display name update error:", err);
      showError(err.message || "Failed to update display name");
    } finally {
      setSavingName(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const auth = getAuthInstance();
      await signOut(auth);
    } catch (error: any) {
      console.error("Sign out error:", error);
      showError("Failed to sign out");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      showError("Please type DELETE to confirm");
      return;
    }

    if (!currentFirebaseUser) {
      showError("User not authenticated");
      return;
    }

    try {
      // Note: Full account deletion requires Cloud Function in Phase 22
      // This just deletes the Firebase Auth user for now
      await deleteUser(currentFirebaseUser);
      showSuccess("Account deleted");
    } catch (error: any) {
      console.error("Delete account error:", error);
      if (error.code === "auth/requires-recent-login") {
        showError(
          "Please sign out and sign in again before deleting your account",
        );
      } else {
        showError("Failed to delete account. Please try again.");
      }
    } finally {
      setShowDeleteDialog(false);
      setDeleteConfirmText("");
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Account Section */}
      <List.Section>
        <List.Subheader style={styles.sectionHeader}>Account</List.Subheader>

        <List.Item
          title="Display Name"
          description={profile?.displayName || "Not set"}
          left={(props) => <List.Icon {...props} icon="account" />}
          right={(props) => <List.Icon {...props} icon="pencil" />}
          onPress={() => {
            setEditDisplayName(profile?.displayName || "");
            setShowEditName(true);
          }}
        />

        <List.Item
          title="Email"
          description={currentFirebaseUser?.email || "Not set"}
          left={(props) => <List.Icon {...props} icon="email" />}
        />

        <List.Item
          title="Username"
          description={profile?.username || "Not set"}
          left={(props) => <List.Icon {...props} icon="at" />}
        />
      </List.Section>

      <Divider />

      {/* Appearance Section */}
      <List.Section>
        <List.Subheader style={styles.sectionHeader}>Appearance</List.Subheader>

        <List.Item
          title="Theme"
          description={
            mode === "system"
              ? `System (currently ${isDark ? "dark" : "light"})`
              : mode === "dark"
                ? "Dark"
                : "Light"
          }
          left={(props) => (
            <List.Icon
              {...props}
              icon={isDark ? "weather-night" : "weather-sunny"}
            />
          )}
        />

        <View style={styles.themeButtonsContainer}>
          <Button
            mode={mode === "light" ? "contained" : "outlined"}
            onPress={() => {
              setMode("light");
              showSuccess("Light theme enabled");
            }}
            style={styles.themeButton}
            icon="weather-sunny"
          >
            Light
          </Button>

          <Button
            mode={mode === "dark" ? "contained" : "outlined"}
            onPress={() => {
              setMode("dark");
              showSuccess("Dark theme enabled");
            }}
            style={styles.themeButton}
            icon="weather-night"
          >
            Dark
          </Button>

          <Button
            mode={mode === "system" ? "contained" : "outlined"}
            onPress={() => {
              setMode("system");
              showSuccess("System theme enabled");
            }}
            style={styles.themeButton}
            icon="brightness-auto"
          >
            Auto
          </Button>
        </View>
      </List.Section>

      <Divider />

      {/* Notifications Section */}
      <List.Section>
        <List.Subheader style={styles.sectionHeader}>
          Notifications
        </List.Subheader>

        <List.Item
          title="In-App Banners"
          description="Show banners for new messages & requests"
          left={(props) => <List.Icon {...props} icon="bell-badge" />}
          right={() => (
            <Switch
              value={inAppNotificationsEnabled}
              onValueChange={(value) => {
                setInAppNotificationsEnabled(value);
                showSuccess(
                  `In-app notifications ${value ? "enabled" : "disabled"}`,
                );
              }}
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="Messages"
          description="Get notified for new messages"
          left={(props) => <List.Icon {...props} icon="message" />}
          right={() => (
            <Switch
              value={notifications.messages}
              onValueChange={() => toggleNotification("messages")}
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="Connection Requests"
          description="Get notified for connection requests"
          left={(props) => <List.Icon {...props} icon="account-plus" />}
          right={() => (
            <Switch
              value={notifications.friendRequests}
              onValueChange={() => toggleNotification("friendRequests")}
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="Moments"
          description="Get notified when connections post moments"
          left={(props) => <List.Icon {...props} icon="image-multiple" />}
          right={() => (
            <Switch
              value={notifications.stories}
              onValueChange={() => toggleNotification("stories")}
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="Ritual Reminders"
          description="Get reminded about expiring rituals"
          left={(props) => <List.Icon {...props} icon="fire" />}
          right={() => (
            <Switch
              value={notifications.streaks}
              onValueChange={() => toggleNotification("streaks")}
              color={theme.colors.primary}
            />
          )}
        />
      </List.Section>

      <Divider />

      {/* Privacy Section */}
      <List.Section>
        <List.Subheader style={styles.sectionHeader}>
          Privacy & Safety
        </List.Subheader>

        <List.Item
          title="Blocked Users"
          description="Manage blocked users"
          left={(props) => <List.Icon {...props} icon="account-cancel" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate("BlockedUsers")}
        />

        <List.Item
          title="Privacy Policy"
          description="Read our privacy policy"
          left={(props) => <List.Icon {...props} icon="shield-lock" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => {
            // TODO: Link to privacy policy in future phase
            showInfo("Privacy policy coming soon");
          }}
        />
      </List.Section>

      <Divider />

      {/* Admin Section (Only shown to admins) */}
      {customClaims?.admin === true && (
        <>
          <List.Section>
            <List.Subheader
              style={[styles.sectionHeaderAdmin, { color: theme.colors.error }]}
            >
              🛡️ Admin Tools
            </List.Subheader>

            <List.Item
              title="Reports Queue"
              description="Review pending user reports"
              left={(props) => (
                <List.Icon
                  {...props}
                  icon="alert-circle"
                  color={theme.colors.error}
                />
              )}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate("AdminReports")}
              style={{ backgroundColor: theme.colors.errorContainer }}
            />
          </List.Section>

          <Divider />
        </>
      )}

      {/* Debug Section (Development) */}
      <List.Section>
        <List.Subheader style={styles.sectionHeader}>Developer</List.Subheader>

        <List.Item
          title="Debug Tools"
          description="Streaks & cosmetics debugging"
          left={(props) => <List.Icon {...props} icon="bug" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate("Debug")}
        />
      </List.Section>

      <Divider />

      {/* Account Actions */}
      <View style={styles.actionsSection}>
        <Button
          mode="outlined"
          onPress={handleSignOut}
          icon="logout"
          style={styles.actionButton}
        >
          Sign Out
        </Button>

        <Button
          mode="outlined"
          onPress={() => setShowDeleteDialog(true)}
          textColor={theme.colors.error}
          icon="delete"
          style={[
            styles.actionButton,
            styles.deleteButton,
            { borderColor: theme.colors.error },
          ]}
        >
          Delete Account
        </Button>
      </View>

      {/* App Version */}
      <Text
        style={[styles.versionText, { color: theme.colors.onSurfaceVariant }]}
      >
        SnapStyle MVP v1.0.0
      </Text>

      {/* Edit Display Name Dialog */}
      <Portal>
        <Dialog visible={showEditName} onDismiss={() => setShowEditName(false)}>
          <Dialog.Title>Edit Display Name</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Display Name"
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              mode="outlined"
              maxLength={50}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowEditName(false)}>Cancel</Button>
            <Button
              onPress={handleSaveDisplayName}
              loading={savingName}
              disabled={savingName}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete Account Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={showDeleteDialog}
          onDismiss={() => setShowDeleteDialog(false)}
        >
          <Dialog.Title>Delete Account</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.deleteWarning, { color: theme.colors.error }]}>
              This action cannot be undone. All your data will be permanently
              deleted.
            </Text>
            <Text style={styles.deleteInstruction}>
              Type DELETE to confirm:
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              mode="outlined"
              placeholder="DELETE"
              style={styles.deleteInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              onPress={handleDeleteAccount}
              textColor={theme.colors.error}
              disabled={deleteConfirmText !== "DELETE"}
            >
              Delete Forever
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor applied inline via theme
  },
  sectionHeader: {
    fontWeight: "bold",
    // Uses Paper default theme color
  },
  sectionHeaderAdmin: {
    fontWeight: "bold",
    // Uses Paper error color inline
  },
  adminItem: {
    // Background applied inline via theme.colors.errorContainer
  },
  themeButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  themeButton: {
    flex: 1,
  },
  actionsSection: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 4,
  },
  deleteButton: {
    // borderColor applied inline via theme.colors.error
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    paddingVertical: 20,
    // color applied inline via theme.colors.onSurfaceVariant
  },
  deleteWarning: {
    marginBottom: 16,
    // color applied inline via theme.colors.error
  },
  deleteInstruction: {
    marginBottom: 8,
  },
  deleteInput: {
    marginTop: 8,
  },
});
