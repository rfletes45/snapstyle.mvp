/**
 * SettingsScreen - User settings hub
 *
 * Organized as a clean directory of settings categories:
 * - Account identity (display name, email, username)
 * - Appearance (theme selection)
 * - Navigation rows to sub-screens (Notifications, Chats, Calls, Privacy, etc.)
 * - Account actions (sign out, delete)
 *
 * Notification toggles live in NotificationSettingsScreen.
 * Chat/messaging preferences live in InboxSettingsScreen.
 */

import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { CALL_FEATURES } from "@/constants/featureFlags";
import {
  DeleteAccountError,
  executeAccountDeletion,
  reauthenticateUser,
} from "@/services/accountDeletion";
import { logout } from "@/services/auth";
import {
  clearPhoneNumber,
  equipTheme,
  updateDisplayName,
  updatePhoneNumber,
} from "@/services/profileService";
import { useAuth } from "@/store/AuthContext";
import { useConversationDisplayMode } from "@/store/ConversationDisplayModeContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { formatPhoneDisplay, isValidPhoneInput } from "@/utils/phone";
import { isValidDisplayName } from "@/utils/validators";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
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
  const { displayMode, setDisplayMode } = useConversationDisplayMode();

  // Edit display name state
  const [showEditName, setShowEditName] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(
    profile?.displayName || "",
  );
  const [savingName, setSavingName] = useState(false);

  // Edit phone number state
  const [showEditPhone, setShowEditPhone] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

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

  const handleSavePhone = useCallback(async () => {
    if (!currentFirebaseUser) {
      showError("User not authenticated");
      return;
    }

    const trimmed = editPhone.trim();

    // Empty input \u2192 treat as "remove phone number".
    if (!trimmed) {
      setSavingPhone(true);
      try {
        await clearPhoneNumber(currentFirebaseUser.uid);
        await refreshProfile();
        showSuccess("Phone number removed");
        setShowEditPhone(false);
      } catch (err: any) {
        logger.error("Clear phone error:", err);
        showError(err.message || "Failed to remove phone number");
      } finally {
        setSavingPhone(false);
      }
      return;
    }

    if (!isValidPhoneInput(trimmed)) {
      showError("Enter a valid phone number (with country code)");
      return;
    }

    setSavingPhone(true);
    try {
      await updatePhoneNumber(currentFirebaseUser.uid, trimmed);
      await refreshProfile();
      showSuccess("Phone number updated");
      setShowEditPhone(false);
    } catch (err: any) {
      logger.error("Phone update error:", err);
      if (err?.message === "INVALID_PHONE") {
        showError("Enter a valid phone number (with country code)");
      } else {
        showError(err?.message || "Failed to update phone number");
      }
    } finally {
      setSavingPhone(false);
    }
  }, [editPhone, currentFirebaseUser, refreshProfile, showSuccess, showError]);

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
    <View
      style={[
        styles.outerContainer,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <ScreenHeader title="Settings" />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        {/* ─── Account ─────────────────────────────────────────────── */}
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
            title="Phone Number"
            description={
              profile?.phoneDisplay ||
              (profile?.phone ? formatPhoneDisplay(profile.phone) : "Not set")
            }
            left={(props) => <List.Icon {...props} icon="phone" />}
            right={(props) => <List.Icon {...props} icon="pencil" />}
            onPress={() => {
              setEditPhone(
                profile?.phoneDisplay ||
                  (profile?.phone ? formatPhoneDisplay(profile.phone) : ""),
              );
              setShowEditPhone(true);
            }}
          />

          <List.Item
            title="Username"
            description={profile?.username || "Not set"}
            left={(props) => <List.Icon {...props} icon="at" />}
          />
        </List.Section>

        <Divider />

        {/* ─── Appearance ──────────────────────────────────────────── */}
        <List.Section>
          <List.Subheader style={styles.sectionHeader}>
            Appearance
          </List.Subheader>

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
                const resolved = isDark
                  ? "catppuccin-mocha"
                  : "catppuccin-latte";
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

          <Text
            style={[
              styles.styleLabel,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Conversation Style
          </Text>
          <View style={styles.themeButtonsContainer}>
            <Button
              mode={displayMode === "bubbles" ? "contained" : "outlined"}
              onPress={() => {
                setDisplayMode("bubbles");
                showSuccess("Bubbles mode enabled");
              }}
              style={styles.themeButton}
              icon="chat"
            >
              Bubbles
            </Button>
            <Button
              mode={displayMode === "stacked" ? "contained" : "outlined"}
              onPress={() => {
                setDisplayMode("stacked");
                showSuccess("Stacked mode enabled");
              }}
              style={styles.themeButton}
              icon="format-list-text"
            >
              Stacked
            </Button>
          </View>
        </List.Section>

        <Divider />

        {/* ─── Settings Categories ─────────────────────────────────── */}
        <List.Section>
          <List.Subheader style={styles.sectionHeader}>
            Preferences
          </List.Subheader>

          <List.Item
            title="Notifications"
            description="Messages, social, games, and alerts"
            left={(props) => <List.Icon {...props} icon="bell-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => navigation.navigate("NotificationSettings")}
          />

          <List.Item
            title="Chats & Messaging"
            description="Read receipts, typing indicators, blocked users"
            left={(props) => <List.Icon {...props} icon="message-cog" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => navigation.navigate("InboxSettings" as any)}
          />

          {CALL_FEATURES.CALLS_ENABLED && (
            <List.Item
              title="Calls"
              description="Camera, audio, ringtone, Do Not Disturb"
              left={(props) => <List.Icon {...props} icon="phone-cog" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate("CallSettings" as any)}
            />
          )}
        </List.Section>

        <Divider />

        {/* ─── Privacy & Safety ────────────────────────────────────── */}
        <List.Section>
          <List.Subheader style={styles.sectionHeader}>
            Privacy & Safety
          </List.Subheader>

          <List.Item
            title="Privacy Settings"
            description="Profile visibility, contact permissions"
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
        </List.Section>

        <Divider />

        {/* ─── Admin Tools (conditional) ───────────────────────────── */}
        {customClaims?.admin === true && (
          <>
            <List.Section>
              <List.Subheader
                style={[
                  styles.sectionHeaderAdmin,
                  { color: theme.colors.error },
                ]}
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

        {/* ─── About ───────────────────────────────────────────────── */}
        <List.Section>
          <List.Subheader style={styles.sectionHeader}>About</List.Subheader>

          <List.Item
            title="Privacy Policy"
            description="Read our privacy policy"
            left={(props) => <List.Icon {...props} icon="shield-lock" />}
            right={(props) => <List.Icon {...props} icon="open-in-new" />}
            onPress={() => {
              Linking.openURL("https://vibeapp.com/privacy").catch(() =>
                showInfo("Could not open privacy policy"),
              );
            }}
          />

          <List.Item
            title="Version"
            description={`Vibe v${Constants.expoConfig?.version || "1.0.0"} (Build ${Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || "dev"})`}
            left={(props) => (
              <List.Icon {...props} icon="information-outline" />
            )}
          />
        </List.Section>

        <Divider />

        {/* ─── Account Actions ─────────────────────────────────────── */}
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

        <View style={styles.bottomPadding} />

        {/* Edit Display Name Dialog */}
        <Portal>
          <Dialog
            visible={showEditName}
            onDismiss={() => setShowEditName(false)}
          >
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

        {/* Edit Phone Number Dialog */}
        <Portal>
          <Dialog
            visible={showEditPhone}
            onDismiss={() => !savingPhone && setShowEditPhone(false)}
          >
            <Dialog.Title>Phone Number</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Phone Number"
                value={editPhone}
                onChangeText={setEditPhone}
                mode="outlined"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder="+1 (555) 123-4567"
                maxLength={32}
              />
              <Text
                variant="bodySmall"
                style={{
                  marginTop: 12,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                Friends can find you by phone number in Add Friends. Include
                your country code. Leave blank and save to remove.
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setShowEditPhone(false)}
                disabled={savingPhone}
              >
                Cancel
              </Button>
              <Button
                onPress={handleSavePhone}
                loading={savingPhone}
                disabled={savingPhone}
              >
                Save
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* ═══════════════════════════════════════════════════════════════
            Delete Account Confirmation Modal — Full Overhaul
            ═══════════════════════════════════════════════════════════════ */}
        <Modal
          visible={showDeleteDialog}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={
            deleteStep === "deleting" ? undefined : resetDeleteDialog
          }
        >
          <Pressable
            style={dStyles.overlay}
            onPress={deleteStep === "deleting" ? undefined : resetDeleteDialog}
          >
            <Pressable
              style={[dStyles.card, { backgroundColor: theme.colors.surface }]}
              onPress={() => {}}
            >
              {/* ── Step: Confirm ───────────────────────────────────── */}
              {deleteStep === "confirm" && (
                <>
                  {/* Danger stripe at top */}
                  <View
                    style={[
                      dStyles.dangerStripe,
                      { backgroundColor: theme.colors.error },
                    ]}
                  />

                  {/* Icon badge */}
                  <View
                    style={[
                      dStyles.iconCircle,
                      { backgroundColor: theme.colors.errorContainer },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="account-remove"
                      size={32}
                      color={theme.colors.error}
                    />
                  </View>

                  <Text
                    variant="titleLarge"
                    style={[dStyles.title, { color: theme.colors.onSurface }]}
                  >
                    Delete your account?
                  </Text>

                  <Text
                    variant="bodyMedium"
                    style={[
                      dStyles.subtitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    This action is permanent and cannot be undone. Everything
                    associated with your account will be removed.
                  </Text>

                  {/* What gets deleted */}
                  <View
                    style={[
                      dStyles.infoBox,
                      {
                        backgroundColor: theme.colors.errorContainer,
                        borderColor: `${theme.colors.error}40`,
                      },
                    ]}
                  >
                    <Text
                      variant="labelMedium"
                      style={[
                        dStyles.infoBoxHeader,
                        { color: theme.colors.error },
                      ]}
                    >
                      What will be deleted
                    </Text>
                    {[
                      "Profile, avatar, and all settings",
                      "Messages, photos, and stories",
                      "Friends, game history, and achievements",
                      "Wallet balance and purchased items",
                      "Badges, streaks, and leaderboard data",
                    ].map((line) => (
                      <View key={line} style={dStyles.bulletRow}>
                        <View
                          style={[
                            dStyles.bulletDot,
                            { backgroundColor: theme.colors.error },
                          ]}
                        />
                        <Text
                          variant="bodySmall"
                          style={[
                            dStyles.bulletText,
                            { color: theme.colors.onErrorContainer },
                          ]}
                        >
                          {line}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Additional info */}
                  <View style={dStyles.noteRow}>
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={16}
                      color={theme.colors.onSurfaceVariant}
                      style={dStyles.noteIcon}
                    />
                    <Text
                      variant="bodySmall"
                      style={[
                        dStyles.noteText,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      Your username will become available for others. You may
                      use the same email to create a new account.
                    </Text>
                  </View>

                  {/* Confirmation input */}
                  <View style={dStyles.confirmSection}>
                    <Text
                      variant="labelMedium"
                      style={[
                        dStyles.confirmLabel,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      Type{" "}
                      <Text
                        style={{
                          color: theme.colors.error,
                          fontWeight: "800",
                          letterSpacing: 1,
                        }}
                      >
                        DELETE
                      </Text>{" "}
                      to confirm
                    </Text>
                    <TextInput
                      value={deleteConfirmText}
                      onChangeText={setDeleteConfirmText}
                      mode="outlined"
                      placeholder="DELETE"
                      autoCapitalize="characters"
                      style={dStyles.input}
                      dense
                      outlineColor={
                        deleteConfirmText === "DELETE"
                          ? theme.colors.error
                          : theme.colors.outlineVariant
                      }
                      activeOutlineColor={theme.colors.error}
                      outlineStyle={dStyles.inputOutline}
                    />
                  </View>

                  {/* Actions */}
                  <View style={dStyles.actions}>
                    <Pressable
                      onPress={resetDeleteDialog}
                      style={[
                        dStyles.cancelBtn,
                        {
                          borderColor: theme.colors.outlineVariant,
                        },
                      ]}
                    >
                      <Text
                        variant="labelLarge"
                        style={[
                          dStyles.cancelBtnText,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleDeleteAccount}
                      disabled={deleteConfirmText !== "DELETE"}
                      style={[
                        dStyles.deleteBtn,
                        {
                          backgroundColor:
                            deleteConfirmText === "DELETE"
                              ? theme.colors.error
                              : theme.colors.surfaceDisabled ||
                                theme.colors.surfaceVariant,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="delete-forever"
                        size={18}
                        color={
                          deleteConfirmText === "DELETE"
                            ? theme.colors.onError
                            : theme.colors.onSurfaceDisabled ||
                              theme.colors.onSurfaceVariant
                        }
                        style={dStyles.deleteBtnIcon}
                      />
                      <Text
                        variant="labelLarge"
                        style={[
                          dStyles.deleteBtnText,
                          {
                            color:
                              deleteConfirmText === "DELETE"
                                ? theme.colors.onError
                                : theme.colors.onSurfaceDisabled ||
                                  theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        Delete my account
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}

              {/* ── Step: Re-authentication ─────────────────────────── */}
              {deleteStep === "reauth" && (
                <>
                  <View
                    style={[
                      dStyles.dangerStripe,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  />

                  <View
                    style={[
                      dStyles.iconCircle,
                      { backgroundColor: theme.colors.primaryContainer },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="shield-lock"
                      size={32}
                      color={theme.colors.primary}
                    />
                  </View>

                  <Text
                    variant="titleLarge"
                    style={[dStyles.title, { color: theme.colors.onSurface }]}
                  >
                    Verify your identity
                  </Text>

                  <Text
                    variant="bodyMedium"
                    style={[
                      dStyles.subtitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    For security, please re-enter your password to continue with
                    account deletion.
                  </Text>

                  <View style={dStyles.confirmSection}>
                    <TextInput
                      label="Password"
                      value={reauthPassword}
                      onChangeText={setReauthPassword}
                      mode="outlined"
                      secureTextEntry
                      autoFocus
                      style={dStyles.input}
                      dense
                      activeOutlineColor={theme.colors.error}
                      outlineStyle={dStyles.inputOutline}
                    />
                  </View>

                  <View style={dStyles.actions}>
                    <Pressable
                      onPress={resetDeleteDialog}
                      style={[
                        dStyles.cancelBtn,
                        { borderColor: theme.colors.outlineVariant },
                      ]}
                    >
                      <Text
                        variant="labelLarge"
                        style={[
                          dStyles.cancelBtnText,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleReauthAndDelete}
                      disabled={!reauthPassword || reauthLoading}
                      style={[
                        dStyles.deleteBtn,
                        {
                          backgroundColor:
                            reauthPassword && !reauthLoading
                              ? theme.colors.error
                              : theme.colors.surfaceDisabled ||
                                theme.colors.surfaceVariant,
                        },
                      ]}
                    >
                      {reauthLoading ? (
                        <ActivityIndicator
                          size={18}
                          color={theme.colors.onError}
                          style={dStyles.deleteBtnIcon}
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="shield-check"
                          size={18}
                          color={
                            reauthPassword
                              ? theme.colors.onError
                              : theme.colors.onSurfaceDisabled ||
                                theme.colors.onSurfaceVariant
                          }
                          style={dStyles.deleteBtnIcon}
                        />
                      )}
                      <Text
                        variant="labelLarge"
                        style={[
                          dStyles.deleteBtnText,
                          {
                            color:
                              reauthPassword && !reauthLoading
                                ? theme.colors.onError
                                : theme.colors.onSurfaceDisabled ||
                                  theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        Verify & delete
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}

              {/* ── Step: Deleting (in progress) ───────────────────── */}
              {deleteStep === "deleting" && (
                <View style={dStyles.progressSection}>
                  <View
                    style={[
                      dStyles.dangerStripe,
                      { backgroundColor: theme.colors.error },
                    ]}
                  />

                  <View
                    style={[
                      dStyles.progressRing,
                      { borderColor: `${theme.colors.error}20` },
                    ]}
                  >
                    <ActivityIndicator size={40} color={theme.colors.error} />
                  </View>

                  <Text
                    variant="titleLarge"
                    style={[dStyles.title, { color: theme.colors.onSurface }]}
                  >
                    Deleting your account
                  </Text>

                  <Text
                    variant="bodyMedium"
                    style={[
                      dStyles.subtitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    Permanently removing all data associated with your account.
                    This may take a moment.
                  </Text>

                  <View
                    style={[
                      dStyles.warningBanner,
                      {
                        backgroundColor: theme.colors.errorContainer,
                        borderColor: `${theme.colors.error}30`,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="cellphone-lock"
                      size={20}
                      color={theme.colors.error}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      variant="labelMedium"
                      style={{
                        color: theme.colors.error,
                        fontWeight: "700",
                        flex: 1,
                      }}
                    >
                      Please do not close the app
                    </Text>
                  </View>
                </View>
              )}

              {/* ── Step: Error ─────────────────────────────────────── */}
              {deleteStep === "error" && (
                <>
                  <View
                    style={[
                      dStyles.dangerStripe,
                      { backgroundColor: theme.colors.error },
                    ]}
                  />

                  <View
                    style={[
                      dStyles.iconCircle,
                      { backgroundColor: theme.colors.errorContainer },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={32}
                      color={theme.colors.error}
                    />
                  </View>

                  <Text
                    variant="titleLarge"
                    style={[dStyles.title, { color: theme.colors.onSurface }]}
                  >
                    Deletion failed
                  </Text>

                  <Text
                    variant="bodyMedium"
                    style={[
                      dStyles.subtitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {deleteError ||
                      "Something went wrong while deleting your account."}
                  </Text>

                  <View
                    style={[
                      dStyles.infoBox,
                      {
                        backgroundColor: theme.colors.surfaceVariant,
                        borderColor: theme.colors.outlineVariant,
                      },
                    ]}
                  >
                    <View style={dStyles.bulletRow}>
                      <MaterialCommunityIcons
                        name="information-outline"
                        size={16}
                        color={theme.colors.onSurfaceVariant}
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        variant="bodySmall"
                        style={{
                          color: theme.colors.onSurfaceVariant,
                          flex: 1,
                          lineHeight: 18,
                        }}
                      >
                        Your deletion request has been recorded. You can retry
                        now or contact support for help.
                      </Text>
                    </View>
                  </View>

                  <View style={dStyles.actions}>
                    <Pressable
                      onPress={resetDeleteDialog}
                      style={[
                        dStyles.cancelBtn,
                        { borderColor: theme.colors.outlineVariant },
                      ]}
                    >
                      <Text
                        variant="labelLarge"
                        style={[
                          dStyles.cancelBtnText,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        Close
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setDeleteStep("confirm");
                        setDeleteConfirmText("");
                        setDeleteError(null);
                      }}
                      style={[
                        dStyles.deleteBtn,
                        { backgroundColor: theme.colors.error },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="refresh"
                        size={18}
                        color={theme.colors.onError}
                        style={dStyles.deleteBtnIcon}
                      />
                      <Text
                        variant="labelLarge"
                        style={[
                          dStyles.deleteBtnText,
                          { color: theme.colors.onError },
                        ]}
                      >
                        Try again
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  sectionHeader: {
    fontWeight: "bold",
  },
  sectionHeaderAdmin: {
    fontWeight: "bold",
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
  styleLabel: {
    fontSize: 13,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
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
  bottomPadding: {
    height: 24,
  },
});

// ─── Delete Account Modal styles ────────────────────────────────────────────

const dStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    paddingTop: 0,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 28,
      },
      android: { elevation: 16 },
    }),
  },
  dangerStripe: {
    width: "100%",
    height: 4,
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    textAlign: "center",
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  infoBox: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  infoBoxHeader: {
    fontWeight: "700",
    marginBottom: 2,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    fontSize: 11,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    lineHeight: 18,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  noteIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  noteText: {
    flex: 1,
    lineHeight: 18,
  },
  confirmSection: {
    width: "100%",
    marginBottom: 20,
  },
  confirmLabel: {
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    width: "100%",
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 12,
  },
  actions: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontWeight: "600",
  },
  deleteBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnIcon: {
    marginRight: 6,
  },
  deleteBtnText: {
    fontWeight: "700",
  },
  progressSection: {
    alignItems: "center",
    width: "100%",
  },
  progressRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
});
