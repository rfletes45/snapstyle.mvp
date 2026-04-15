/**
 * NotificationSettingsScreen
 *
 * Dedicated screen for all notification preferences, organized into
 * logical groups. Accessed from the main Settings screen.
 *
 * Groups:
 * - General (master switch, in-app banners, app badge)
 * - Messages & Social (messages, social/friend requests)
 * - Games & Activity (games, achievements, gifts, ritual reminders)
 * - Stories (moments)
 *
 * @module screens/settings/NotificationSettingsScreen
 */

import { ScreenHeader } from "@/components/shared/ScreenHeader";
import {
  subscribeToInboxSettings,
  updateInboxSettings,
} from "@/services/inboxSettings";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import type { InboxSettings } from "@/types/messaging";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Divider, List, Switch, Text, useTheme } from "react-native-paper";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/settings/NotificationSettingsScreen");

// =============================================================================
// Types
// =============================================================================

interface NotificationToggle {
  key: keyof InboxSettings;
  title: string;
  description: string;
  icon: string;
  label: string;
}

interface NotificationSection {
  title: string;
  description?: string;
  toggles: NotificationToggle[];
}

// =============================================================================
// Configuration
// =============================================================================

const NOTIFICATION_SECTIONS: NotificationSection[] = [
  {
    title: "General",
    description:
      "Master controls for all notifications and how they appear on your device.",
    toggles: [
      {
        key: "notificationsEnabled",
        title: "All Notifications",
        description: "Master switch for alerts and notification feed writes",
        icon: "bell-ring",
        label: "Notifications",
      },
      {
        key: "inAppNotificationsEnabled",
        title: "In-App Banners",
        description: "Foreground banners while you're actively using the app",
        icon: "bell-badge",
        label: "In-app banners",
      },
      {
        key: "badgeCountEnabled",
        title: "App Badge",
        description: "Show unread notification count on the app icon",
        icon: "numeric",
        label: "Badge count",
      },
    ],
  },
  {
    title: "Messages & Social",
    description: "Notifications for conversations and friend activity.",
    toggles: [
      {
        key: "messageNotificationsEnabled",
        title: "Messages",
        description: "Direct messages, group messages, and message requests",
        icon: "message",
        label: "Message notifications",
      },
      {
        key: "socialNotificationsEnabled",
        title: "Social",
        description: "Friend requests and accepted requests",
        icon: "account-plus",
        label: "Social notifications",
      },
    ],
  },
  {
    title: "Games & Activity",
    description: "Notifications for gaming, progress, and rewards.",
    toggles: [
      {
        key: "gameNotificationsEnabled",
        title: "Games",
        description: "Invites, lobby ready events, turns, and results",
        icon: "gamepad-variant",
        label: "Game notifications",
      },
      {
        key: "achievementNotificationsEnabled",
        title: "Achievements",
        description: "Achievement unlocks and progression milestones",
        icon: "trophy-outline",
        label: "Achievement notifications",
      },
      {
        key: "giftNotificationsEnabled",
        title: "Gifts",
        description: "Gift received and gift opened events",
        icon: "gift-outline",
        label: "Gift notifications",
      },
      {
        key: "streakNotificationsEnabled",
        title: "Ritual Reminders",
        description: "Get reminded about expiring rituals",
        icon: "fire",
        label: "Ritual reminders",
      },
    ],
  },
  {
    title: "Stories",
    toggles: [
      {
        key: "storyNotificationsEnabled",
        title: "Moments",
        description: "Story and moments alerts when enabled by the backend",
        icon: "image-multiple",
        label: "Moments notifications",
      },
    ],
  },
];

// =============================================================================
// Component
// =============================================================================

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const [notificationSettings, setNotificationSettings] =
    useState<InboxSettings | null>(null);

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

  const masterEnabled = notificationSettings?.notificationsEnabled !== false;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title="Notifications" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text
          style={[
            styles.pageDescription,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Choose which notifications you receive. These controls apply to both
          in-app alerts and push notifications.
        </Text>

        {NOTIFICATION_SECTIONS.map((section, sectionIdx) => (
          <View key={section.title}>
            {sectionIdx > 0 && <Divider />}
            <List.Section>
              <List.Subheader style={styles.sectionHeader}>
                {section.title}
              </List.Subheader>
              {section.description && (
                <Text
                  style={[
                    styles.sectionDescription,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {section.description}
                </Text>
              )}

              {section.toggles.map((toggle) => {
                const isDisabled =
                  toggle.key !== "notificationsEnabled" && !masterEnabled;

                return (
                  <List.Item
                    key={toggle.key}
                    title={toggle.title}
                    description={toggle.description}
                    titleStyle={isDisabled ? { opacity: 0.5 } : undefined}
                    descriptionStyle={isDisabled ? { opacity: 0.5 } : undefined}
                    right={() => (
                      <Switch
                        value={
                          (notificationSettings?.[toggle.key] as boolean) !==
                          false
                        }
                        onValueChange={(value) =>
                          toggleNotificationSetting(
                            toggle.key,
                            toggle.label,
                            value,
                          )
                        }
                        color={theme.colors.primary}
                        disabled={isDisabled}
                      />
                    )}
                  />
                );
              })}
            </List.Section>
          </View>
        ))}

        {!masterEnabled && (
          <Text
            style={[
              styles.disabledNote,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Turn on "All Notifications" to configure individual categories.
          </Text>
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  pageDescription: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionHeader: {
    fontWeight: "bold",
  },
  sectionDescription: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  disabledNote: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    fontStyle: "italic",
  },
});
