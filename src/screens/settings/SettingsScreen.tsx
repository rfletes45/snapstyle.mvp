/**
 * SettingsScreen - User settings hub
 *
 * Features:
 * - Notification toggles (local state, ready for persistence)
 * - Privacy settings entry
 * - Blocked users navigation
 * - Display name editing
 * - Account management section
 */

import {
  DeleteAccountError,
  executeAccountDeletion,
  reauthenticateUser,
} from "@/services/accountDeletion";
import { logout } from "@/services/auth";
import {
  subscribeToInboxSettings,
  updateInboxSettings,
} from "@/services/inboxSettings";
import { equipTheme, updateDisplayName } from "@/services/profileService";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import type { InboxSettings } from "@/types/messaging";
import { isValidDisplayName } from "@/utils/validators";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Dialog,
  Divider,
  List,
  Portal,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/settings/SettingsScreen");

// =============================================================================
// Types
// =============================================================================

interface SettingsScreenProps {
  navigation: any;
}

// =============================================================================
// Component
// =============================================================================

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser, customClaims } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { showSuccess, showError, showInfo } = useSnackbar();
  const { setTheme, isDark, useSystemTheme, setUseSystemTheme } = useAppTheme();
  const [notificationSettings, setNotificationSettings] =
    useState<InboxSettings | null>(null);

  // Edit display name state
  const [showEditName, setShowEditName] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(
    profile?.displayName || "",
  );
  const [savingName, setSavingName] = useState(false);

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteStep, setDeleteStep] = useState<
    "confirm" | "reauth" | "deleting" | "error"
  >("confirm");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);
  const deleteInProgressRef = useRef(false);

  // =============================================================================
  // Handlers
  // =============================================================================

  useEffect(() => {
    if (!currentFirebaseUser?.uid) return;
    return subscribeToInboxSettings(
      currentFirebaseUser.uid,
      setNotificationSettings,
    );
  }, [currentFirebaseUser?.uid]);

  const toggleNotificationSetting = useCallback(
    async (key: keyof InboxSettings, label: string, value: boolean) => {
      if (!currentFirebaseUser?.uid) return;

      Haptics.selectionAsync().catch(() => {});
      setNotificationSettings((prev) =>
        prev ? { ...prev, [key]: value } : prev,
      );

      try {
        await updateInboxSettings(currentFirebaseUser.uid, {
          [key]: value,
        });
        showSuccess(`${label} ${value ? "enabled" : "disabled"}`);
      } catch (error) {
        logger.error(`Failed to update ${String(key)}:`, error);
        setNotificationSettings((prev) =>
          prev ? { ...prev, [key]: !value } : prev,
        );
        showError(`Couldn't update ${label.toLowerCase()}`);
      }
    },
    [currentFirebaseUser?.uid, showError, showSuccess],
  );

  const handleSaveDisplayName = useCallback(async () => {
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
      const updatePromise = updateDisplayName(
        currentFirebaseUser.uid,
        editDisplayName,
      );

      await Promise.race([updatePromise, timeoutPromise]);
      await refreshProfile();
      showSuccess("Display name updated!");
      setShowEditName(false);
    } catch (err: any) {
      logger.error("Display name update error:", err);
      showError(err.message || "Failed to update display name");
    } finally {
      setSavingName(false);
    }
  }, [
    editDisplayName,
    currentFirebaseUser,
    refreshProfile,
    showSuccess,
    showError,
  ]);

  const handleSignOut = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
            showError("Failed to sign out");
          }
        },
      },
    ]);
  }, [showError]);

  const handleDeleteAccount = useCallback(async () => {
    if (deleteConfirmText !== "DELETE") {
      showError("Please type DELETE to confirm");
      return;
    }

    if (!currentFirebaseUser) {
      showError("User not authenticated");
      return;
    }

    // Prevent double-submit
    if (deleteInProgressRef.current) return;
    deleteInProgressRef.current = true;

    setDeleteStep("deleting");
    setDeleteError(null);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const result = await executeAccountDeletion(currentFirebaseUser);

      if (result.success) {
        // Deletion succeeded — the auth user is now deleted, so
        // onAuthStateChanged will fire with null. The app will
        // navigate to the auth screen automatically via AppGate.
        showSuccess("Your account has been permanently deleted.");
        setShowDeleteDialog(false);
      } else {
        // Partial failure — some steps had errors
        setDeleteStep("error");
        setDeleteError(
          result.message ||
            "Some data could not be deleted. Please try again or contact support.",
        );
      }
    } catch (error: any) {
      logger.error("Delete account error:", error);

      const typedError = error as DeleteAccountError;

      if (typedError.type === "requires-reauth") {
        // Need re-authentication — show password prompt
        setDeleteStep("reauth");
        setReauthPassword("");
      } else if (typedError.type === "network") {
        setDeleteStep("error");
        setDeleteError(typedError.message);
      } else if (typedError.type === "server") {
        setDeleteStep("error");
        setDeleteError(typedError.message);
      } else {
        setDeleteStep("error");
        setDeleteError(
          typedError.message ||
            "An unexpected error occurred. Please try again.",
        );
      }
    } finally {
      deleteInProgressRef.current = false;
    }
  }, [deleteConfirmText, currentFirebaseUser, showError, showSuccess]);

  const handleReauthAndDelete = useCallback(async () => {
    if (!currentFirebaseUser || !reauthPassword) {
      showError("Please enter your password");
      return;
    }

    setReauthLoading(true);

    try {
      await reauthenticateUser(currentFirebaseUser, reauthPassword);

      // Re-authentication succeeded — now retry deletion
      setReauthPassword("");
      setDeleteStep("deleting");
      setReauthLoading(false);

      // Retry the deletion
      deleteInProgressRef.current = true;
      try {
        const result = await executeAccountDeletion(currentFirebaseUser);

        if (result.success) {
          showSuccess("Your account has been permanently deleted.");
          setShowDeleteDialog(false);
        } else {
          setDeleteStep("error");
          setDeleteError(
            result.message ||
              "Some data could not be deleted. Please try again.",
          );
        }
      } catch (retryError: any) {
        logger.error("Delete account retry error:", retryError);
        setDeleteStep("error");
        setDeleteError(
          retryError.message || "Deletion failed after re-authentication.",
        );
      } finally {
        deleteInProgressRef.current = false;
      }
    } catch (err: any) {
      logger.error("Re-auth error:", err);
      setReauthLoading(false);

      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        showError("Incorrect password. Please try again.");
      } else if (err.code === "auth/too-many-requests") {
        showError("Too many attempts. Please wait and try again.");
      } else {
        showError(err.message || "Re-authentication failed.");
      }
    }
  }, [currentFirebaseUser, reauthPassword, showError, showSuccess]);

  const resetDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false);
    setDeleteConfirmText("");
    setDeleteStep("confirm");
    setDeleteError(null);
    setReauthPassword("");
    setReauthLoading(false);
    deleteInProgressRef.current = false;
  }, []);

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

        <View style={styles.themeButtonsContainer}>
          <Button
            mode={!useSystemTheme && !isDark ? "contained" : "outlined"}
            onPress={() => {
              setTheme("catppuccin-latte");
              if (currentFirebaseUser?.uid)
                equipTheme(currentFirebaseUser.uid, "catppuccin-latte").catch(
                  () => {},
                );
              showSuccess("Light theme enabled");
            }}
            style={styles.themeButton}
            icon="weather-sunny"
          >
            Light
          </Button>

          <Button
            mode={!useSystemTheme && isDark ? "contained" : "outlined"}
            onPress={() => {
              setTheme("catppuccin-mocha");
              if (currentFirebaseUser?.uid)
                equipTheme(currentFirebaseUser.uid, "catppuccin-mocha").catch(
                  () => {},
                );
              showSuccess("Dark theme enabled");
            }}
            style={styles.themeButton}
            icon="weather-night"
          >
            Dark
          </Button>

          <Button
            mode={useSystemTheme ? "contained" : "outlined"}
            onPress={() => {
              setUseSystemTheme(true);
              // Sync the resolved system theme to Firestore
              const resolved = isDark ? "catppuccin-mocha" : "catppuccin-latte";
              if (currentFirebaseUser?.uid)
                equipTheme(currentFirebaseUser.uid, resolved).catch(() => {});
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

        <Text
          style={[
            styles.notificationDisclaimer,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          These controls back the server-side notification rules. Foreground
          banners use the in-app channel, while background and offline delivery
          uses push.
        </Text>

        <List.Item
          title="All Notifications"
          description="Master switch for alerts and notification feed writes"
          left={(props) => <List.Icon {...props} icon="bell-ring" />}
          right={() => (
            <Switch
              value={notificationSettings?.notificationsEnabled !== false}
              onValueChange={(value) =>
                toggleNotificationSetting(
                  "notificationsEnabled",
                  "Notifications",
                  value,
                )
              }
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="In-App Banners"
          description="Foreground banners while you're actively using the app"
          left={(props) => <List.Icon {...props} icon="bell-badge" />}
          right={() => (
            <Switch
              value={notificationSettings?.inAppNotificationsEnabled !== false}
              onValueChange={(value) =>
                toggleNotificationSetting(
                  "inAppNotificationsEnabled",
                  "In-app banners",
                  value,
                )
              }
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="Messages"
          description="Direct messages, group messages, and message requests"
          left={(props) => <List.Icon {...props} icon="message" />}
          right={() => (
            <Switch
              value={notificationSettings?.messageNotificationsEnabled !== false}
              onValueChange={(value) =>
                toggleNotificationSetting(
                  "messageNotificationsEnabled",
                  "Message notifications",
                  value,
                )
              }
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="Social"
          description="Friend requests and accepted requests"
          left={(props) => <List.Icon {...props} icon="account-plus" />}
          right={() => (
            <Switch
              value={notificationSettings?.socialNotificationsEnabled !== false}
              onValueChange={(value) =>
                toggleNotificationSetting(
                  "socialNotificationsEnabled",
                  "Social notifications",
                  value,
                )
              }
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="Games"
          description="Invites, lobby ready events, turns, and results"
          left={(props) => <List.Icon {...props} icon="gamepad-variant" />}
          right={() => (
            <Switch
              value={notificationSettings?.gameNotificationsEnabled !== false}
              onValueChange={(value) =>
                toggleNotificationSetting(
                  "gameNotificationsEnabled",
                  "Game notifications",
                  value,
                )
              }
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="Achievements"
          description="Achievement unlocks and progression milestones"
          left={(props) => <List.Icon {...props} icon="trophy-outline" />}
          right={() => (
            <Switch
              value={
                notificationSettings?.achievementNotificationsEnabled !== false
              }
              onValueChange={(value) =>
                toggleNotificationSetting(
                  "achievementNotificationsEnabled",
                  "Achievement notifications",
                  value,
                )
              }
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="Gifts"
          description="Gift received and gift opened events"
          left={(props) => <List.Icon {...props} icon="gift-outline" />}
          right={() => (
            <Switch
              value={notificationSettings?.giftNotificationsEnabled !== false}
              onValueChange={(value) =>
                toggleNotificationSetting(
                  "giftNotificationsEnabled",
                  "Gift notifications",
                  value,
                )
              }
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="Moments"
          description="Story and moments alerts when enabled by the backend"
          left={(props) => <List.Icon {...props} icon="image-multiple" />}
          right={() => (
            <Switch
              value={notificationSettings?.storyNotificationsEnabled !== false}
              onValueChange={(value) =>
                toggleNotificationSetting(
                  "storyNotificationsEnabled",
                  "Moments notifications",
                  value,
                )
              }
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
              value={notificationSettings?.streakNotificationsEnabled !== false}
              onValueChange={(value) =>
                toggleNotificationSetting(
                  "streakNotificationsEnabled",
                  "Ritual reminders",
                  value,
                )
              }
              color={theme.colors.primary}
            />
          )}
        />

        <List.Item
          title="App Badge"
          description="Show unread notification count on the app icon"
          left={(props) => <List.Icon {...props} icon="numeric" />}
          right={() => (
            <Switch
              value={notificationSettings?.badgeCountEnabled !== false}
              onValueChange={(value) =>
                toggleNotificationSetting(
                  "badgeCountEnabled",
                  "Badge count",
                  value,
                )
              }
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
          title="Privacy Settings"
          description="Control who can see your profile and contact you"
          left={(props) => <List.Icon {...props} icon="shield-account" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate("PrivacySettings")}
        />

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
            Linking.openURL("https://vibeapp.com/privacy").catch(() =>
              showInfo("Could not open privacy policy"),
            );
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

      {/* Debug Section (Development only) */}
      {__DEV__ && (
        <>
          <List.Section>
            <List.Subheader style={styles.sectionHeader}>
              Developer
            </List.Subheader>

            <List.Item
              title="Debug Tools"
              description="Streaks & cosmetics debugging"
              left={(props) => <List.Icon {...props} icon="bug" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate("Debug")}
            />

            <List.Item
              title="Local Storage Debug"
              description="SQLite database, sync & cache testing"
              left={(props) => <List.Icon {...props} icon="database" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate("LocalStorageDebug")}
            />
          </List.Section>

          <Divider />
        </>
      )}

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
        Vibe v{Constants.expoConfig?.version || "1.0.0"} (Build{" "}
        {Constants.expoConfig?.ios?.buildNumber ||
          Constants.expoConfig?.android?.versionCode ||
          "dev"}
        )
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
          onDismiss={deleteStep === "deleting" ? undefined : resetDeleteDialog}
          dismissable={deleteStep !== "deleting"}
        >
          {/* ── Step: Confirm ── */}
          {deleteStep === "confirm" && (
            <>
              <Dialog.Title style={{ color: theme.colors.error }}>
                Delete Account
              </Dialog.Title>
              <Dialog.Content>
                <Text
                  style={[styles.deleteWarning, { color: theme.colors.error }]}
                >
                  ⚠️ This is permanent and cannot be undone.
                </Text>
                <Text style={styles.deleteDetail}>
                  Deleting your account will permanently remove:
                </Text>
                <Text style={styles.deleteBullet}>
                  • Your profile, avatar, and all settings
                </Text>
                <Text style={styles.deleteBullet}>
                  • All messages, photos, and stories you sent
                </Text>
                <Text style={styles.deleteBullet}>
                  • Friends list, game history, and achievements
                </Text>
                <Text style={styles.deleteBullet}>
                  • Your wallet balance and all purchased items
                </Text>
                <Text style={styles.deleteBullet}>
                  • Your badges, streaks, and leaderboard entries
                </Text>

                <Text style={styles.deleteNote}>
                  Your username will become available for others to claim.
                </Text>
                <Text style={styles.deleteNote}>
                  You can use the same email to create a new account later.
                </Text>

                <Text style={[styles.deleteInstruction, { marginTop: 16 }]}>
                  Type DELETE to confirm:
                </Text>
                <TextInput
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  mode="outlined"
                  placeholder="DELETE"
                  autoCapitalize="characters"
                  style={styles.deleteInput}
                />
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={resetDeleteDialog}>Cancel</Button>
                <Button
                  onPress={handleDeleteAccount}
                  textColor={theme.colors.error}
                  disabled={deleteConfirmText !== "DELETE"}
                  icon="delete-forever"
                >
                  Delete My Account
                </Button>
              </Dialog.Actions>
            </>
          )}

          {/* ── Step: Re-authentication ── */}
          {deleteStep === "reauth" && (
            <>
              <Dialog.Title>Verify Your Identity</Dialog.Title>
              <Dialog.Content>
                <Text style={styles.deleteDetail}>
                  For security, please enter your password to continue with
                  account deletion.
                </Text>
                <TextInput
                  label="Password"
                  value={reauthPassword}
                  onChangeText={setReauthPassword}
                  mode="outlined"
                  secureTextEntry
                  autoFocus
                  style={styles.deleteInput}
                />
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={resetDeleteDialog}>Cancel</Button>
                <Button
                  onPress={handleReauthAndDelete}
                  textColor={theme.colors.error}
                  disabled={!reauthPassword || reauthLoading}
                  loading={reauthLoading}
                >
                  Verify & Delete
                </Button>
              </Dialog.Actions>
            </>
          )}

          {/* ── Step: Deleting (in progress) ── */}
          {deleteStep === "deleting" && (
            <>
              <Dialog.Title>Deleting Account...</Dialog.Title>
              <Dialog.Content>
                <View style={styles.deletingContainer}>
                  <ActivityIndicator
                    size="large"
                    color={theme.colors.error}
                    style={{ marginBottom: 16 }}
                  />
                  <Text style={styles.deletingText}>
                    Please wait while we permanently remove your account and all
                    associated data. This may take a moment.
                  </Text>
                  <Text style={styles.deletingSubtext}>
                    Do not close the app.
                  </Text>
                </View>
              </Dialog.Content>
            </>
          )}

          {/* ── Step: Error ── */}
          {deleteStep === "error" && (
            <>
              <Dialog.Title style={{ color: theme.colors.error }}>
                Deletion Error
              </Dialog.Title>
              <Dialog.Content>
                <Text style={styles.deleteDetail}>
                  {deleteError ||
                    "Something went wrong during account deletion."}
                </Text>
                <Text style={[styles.deleteNote, { marginTop: 12 }]}>
                  Your deletion request has been recorded. You can retry now or
                  contact support for assistance.
                </Text>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={resetDeleteDialog}>Close</Button>
                <Button
                  onPress={() => {
                    setDeleteStep("confirm");
                    setDeleteConfirmText("");
                    setDeleteError(null);
                  }}
                  textColor={theme.colors.error}
                >
                  Retry
                </Button>
              </Dialog.Actions>
            </>
          )}
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
  notificationDisclaimer: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    lineHeight: 16,
  },
  sectionHeaderAdmin: {
    fontWeight: "bold",
    // Uses Paper error color inline
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
    marginBottom: 12,
    fontWeight: "bold" as const,
    fontSize: 15,
  },
  deleteDetail: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  deleteBullet: {
    fontSize: 13,
    lineHeight: 20,
    paddingLeft: 8,
    marginBottom: 2,
    opacity: 0.85,
  },
  deleteNote: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    fontStyle: "italic" as const,
    opacity: 0.7,
  },
  deleteInstruction: {
    marginBottom: 8,
    fontWeight: "600" as const,
  },
  deleteInput: {
    marginTop: 8,
  },
  deletingContainer: {
    alignItems: "center" as const,
    paddingVertical: 24,
  },
  deletingText: {
    textAlign: "center" as const,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  deletingSubtext: {
    textAlign: "center" as const,
    fontSize: 12,
    fontWeight: "bold" as const,
    opacity: 0.7,
  },
});
