/**
 * InboxSettingsScreen
 *
 * Settings screen for inbox/chat preferences:
 * - Notification level (all/mentions/none)
 * - Privacy settings (read receipts, typing indicators, online status)
 * - Preferences (swipe actions, confirm before delete)
 * - Blocked users management
 *
 * @module screens/chat/InboxSettingsScreen
 */

import {
  subscribeToInboxSettings,
  updateInboxSettings,
} from "@/services/inboxSettings";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { AppTabsParamList, InboxStackParamList } from "@/types/navigation";
import type { InboxSettings } from "@/types/messaging";
import { log } from "@/utils/log";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Dialog,
  Divider,
  List,
  Portal,
  RadioButton,
  Switch,
  Text,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

type NotifyLevel = "all" | "mentions" | "none";

// =============================================================================
// Component
// =============================================================================

export default function InboxSettingsScreen() {
  const { colors } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<InboxStackParamList>>();
  const insets = useSafeAreaInsets();
  const uid = currentFirebaseUser?.uid ?? "";

  // State
  const [settings, setSettings] = useState<InboxSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifyDialogVisible, setNotifyDialogVisible] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  // =============================================================================
  // Load Settings
  // =============================================================================

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    // Subscribe to real-time updates
    const unsubscribe = subscribeToInboxSettings(uid, (newSettings) => {
      setSettings(newSettings);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleToggle = useCallback(
    async (key: keyof InboxSettings, value: boolean) => {
      if (!uid || !settings) return;

      // Optimistic update
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
      setUpdating(key);

      try {
        await updateInboxSettings(uid, { [key]: value });
      } catch (error) {
        // Revert on error
        setSettings((prev) => (prev ? { ...prev, [key]: !value } : prev));
        log.error(`Failed to update ${key}`, error);
      } finally {
        setUpdating(null);
      }
    },
    [uid, settings],
  );

  const handleNotifyLevelChange = useCallback(
    async (level: NotifyLevel) => {
      if (!uid || !settings) return;

      // Optimistic update
      setSettings((prev) =>
        prev ? { ...prev, defaultNotifyLevel: level } : prev,
      );
      setNotifyDialogVisible(false);
      setUpdating("defaultNotifyLevel");

      try {
        await updateInboxSettings(uid, { defaultNotifyLevel: level });
      } catch (error) {
        // Revert on error
        setSettings((prev) =>
          prev
            ? { ...prev, defaultNotifyLevel: settings.defaultNotifyLevel }
            : prev,
        );
        log.error("Failed to update notification level", error);
      } finally {
        setUpdating(null);
      }
    },
    [uid, settings],
  );

  const navigateToBlockedUsers = useCallback(() => {
    // BlockedUsers is in ProfileStack, which is the Profile tab
    const tabNavigation =
      navigation.getParent<BottomTabNavigationProp<AppTabsParamList>>();
    tabNavigation?.navigate("Profile", {
      screen: "BlockedUsers",
    });
  }, [navigation]);

  // =============================================================================
  // Loading State
  // =============================================================================

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Appbar.Header style={{ backgroundColor: colors.surface }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Chat Settings" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading settings...
          </Text>
        </View>
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Appbar.Header style={{ backgroundColor: colors.surface }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Chat Settings" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            Failed to load settings
          </Text>
          <Button mode="contained" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  // =============================================================================
  // Helpers
  // =============================================================================

  const getNotifyLevelDescription = () => {
    switch (settings.defaultNotifyLevel) {
      case "all":
        return "All messages";
      case "mentions":
        return "Mentions only";
      case "none":
        return "None";
      default:
        return "All messages";
    }
  };

  // =============================================================================
  // Main Render
  // =============================================================================

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Appbar.Header style={{ backgroundColor: colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Chat Settings" />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.lg }}
      >
        {/* Notifications Section */}
        <List.Section>
          <List.Subheader style={{ color: colors.primary }}>
            Notifications
          </List.Subheader>

          <List.Item
            title="Default Notification Level"
            description={getNotifyLevelDescription()}
            left={(props) => (
              <List.Icon {...props} icon="bell" color={colors.primary} />
            )}
            right={(props) => (
              <List.Icon
                {...props}
                icon="chevron-right"
                color={colors.textSecondary}
              />
            )}
            onPress={() => setNotifyDialogVisible(true)}
            style={styles.listItem}
            titleStyle={{ color: colors.text }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
        </List.Section>

        <Divider />

        {/* Privacy Section */}
        <List.Section>
          <List.Subheader style={{ color: colors.primary }}>
            Privacy
          </List.Subheader>

          <List.Item
            title="Read Receipts"
            description="Let others know when you've read their messages"
            left={(props) => (
              <List.Icon {...props} icon="check-all" color={colors.primary} />
            )}
            right={() => (
              <Switch
                value={settings.showReadReceipts}
                onValueChange={(v) => handleToggle("showReadReceipts", v)}
                disabled={updating === "showReadReceipts"}
              />
            )}
            style={styles.listItem}
            titleStyle={{ color: colors.text }}
            descriptionStyle={{ color: colors.textSecondary }}
          />

          <List.Item
            title="Typing Indicators"
            description="Show when you're typing"
            left={(props) => (
              <List.Icon {...props} icon="keyboard" color={colors.primary} />
            )}
            right={() => (
              <Switch
                value={settings.showTypingIndicators}
                onValueChange={(v) => handleToggle("showTypingIndicators", v)}
                disabled={updating === "showTypingIndicators"}
              />
            )}
            style={styles.listItem}
            titleStyle={{ color: colors.text }}
            descriptionStyle={{ color: colors.textSecondary }}
          />

          <List.Item
            title="Online Status"
            description="Show when you're online"
            left={(props) => (
              <List.Icon {...props} icon="circle" color={colors.primary} />
            )}
            right={() => (
              <Switch
                value={settings.showOnlineStatus}
                onValueChange={(v) => handleToggle("showOnlineStatus", v)}
                disabled={updating === "showOnlineStatus"}
              />
            )}
            style={styles.listItem}
            titleStyle={{ color: colors.text }}
            descriptionStyle={{ color: colors.textSecondary }}
          />

          <List.Item
            title="Last Seen"
            description="Show when you were last active"
            left={(props) => (
              <List.Icon
                {...props}
                icon="clock-outline"
                color={colors.primary}
              />
            )}
            right={() => (
              <Switch
                value={settings.showLastSeen}
                onValueChange={(v) => handleToggle("showLastSeen", v)}
                disabled={updating === "showLastSeen"}
              />
            )}
            style={styles.listItem}
            titleStyle={{ color: colors.text }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
        </List.Section>

        <Divider />

        {/* Preferences Section */}
        <List.Section>
          <List.Subheader style={{ color: colors.primary }}>
            Preferences
          </List.Subheader>

          <List.Item
            title="Swipe Actions"
            description="Enable swipe gestures on conversations"
            left={(props) => (
              <List.Icon
                {...props}
                icon="gesture-swipe"
                color={colors.primary}
              />
            )}
            right={() => (
              <Switch
                value={settings.swipeActionsEnabled}
                onValueChange={(v) => handleToggle("swipeActionsEnabled", v)}
                disabled={updating === "swipeActionsEnabled"}
              />
            )}
            style={styles.listItem}
            titleStyle={{ color: colors.text }}
            descriptionStyle={{ color: colors.textSecondary }}
          />

          <List.Item
            title="Confirm Before Delete"
            description="Ask before deleting conversations"
            left={(props) => (
              <List.Icon
                {...props}
                icon="alert-outline"
                color={colors.primary}
              />
            )}
            right={() => (
              <Switch
                value={settings.confirmBeforeDelete}
                onValueChange={(v) => handleToggle("confirmBeforeDelete", v)}
                disabled={updating === "confirmBeforeDelete"}
              />
            )}
            style={styles.listItem}
            titleStyle={{ color: colors.text }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
        </List.Section>

        <Divider />

        {/* Blocked Users Section */}
        <List.Section>
          <List.Subheader style={{ color: colors.primary }}>
            Blocked Users
          </List.Subheader>

          <List.Item
            title="Manage Blocked Users"
            description="View and unblock users you've blocked"
            left={(props) => (
              <List.Icon {...props} icon="account-off" color={colors.primary} />
            )}
            right={(props) => (
              <List.Icon
                {...props}
                icon="chevron-right"
                color={colors.textSecondary}
              />
            )}
            onPress={navigateToBlockedUsers}
            style={styles.listItem}
            titleStyle={{ color: colors.text }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
        </List.Section>
      </ScrollView>

      {/* Notification Level Dialog */}
      <Portal>
        <Dialog
          visible={notifyDialogVisible}
          onDismiss={() => setNotifyDialogVisible(false)}
          style={{ backgroundColor: colors.surface }}
        >
          <Dialog.Title style={{ color: colors.text }}>
            Default Notification Level
          </Dialog.Title>
          <Dialog.Content>
            <Text
              style={[
                styles.dialogDescription,
                { color: colors.textSecondary },
              ]}
            >
              Choose what notifications you receive for new conversations by
              default.
            </Text>
            <RadioButton.Group
              value={settings.defaultNotifyLevel}
              onValueChange={(v) => handleNotifyLevelChange(v as NotifyLevel)}
            >
              <RadioButton.Item
                label="All Messages"
                value="all"
                labelStyle={{ color: colors.text }}
                style={styles.radioItem}
              />
              <RadioButton.Item
                label="Mentions Only"
                value="mentions"
                labelStyle={{ color: colors.text }}
                style={styles.radioItem}
              />
              <RadioButton.Item
                label="None"
                value="none"
                labelStyle={{ color: colors.text }}
                style={styles.radioItem}
              />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNotifyDialogVisible(false)}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  errorText: {
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  listItem: {
    paddingVertical: Spacing.xs,
  },
  dialogDescription: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  radioItem: {
    paddingVertical: Spacing.xs,
  },
});
