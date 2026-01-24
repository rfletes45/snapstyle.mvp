/**
 * ChatSettingsScreen
 * Phase H13: Chat Settings (Mute/Archive/Receipts)
 *
 * Universal settings screen for both DM and Group chats.
 *
 * Features:
 * - Mute notifications (1hr / 8hr / 24hr / Forever / Off)
 * - Archive chat (hide from main list)
 * - Notification level (All / Mentions only / None)
 * - Read receipts toggle
 *
 * @module screens/chat/ChatSettingsScreen
 */

import {
  getDMMemberPrivate,
  setArchived,
  setNotifyLevel as setDMNotifyLevel,
  setReadReceipts as setDMReadReceipts,
  setMuted,
} from "@/services/chatMembers";
import {
  getGroupMemberPrivate,
  setGroupArchived,
  setGroupMuted,
  setGroupNotifyLevel,
  setGroupReadReceipts,
} from "@/services/groupMembers";
import { useAuth } from "@/store/AuthContext";
import { MemberStatePrivate } from "@/types/messaging";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Divider,
  List,
  Modal,
  Portal,
  RadioButton,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

// =============================================================================
// Types
// =============================================================================

export interface ChatSettingsParams {
  chatId?: string;
  groupId?: string;
  chatType: "dm" | "group";
  chatName?: string;
}

type MuteDuration = "off" | "1h" | "8h" | "24h" | "forever";

// =============================================================================
// Constants
// =============================================================================

const MUTE_DURATIONS: { value: MuteDuration; label: string; hours?: number }[] =
  [
    { value: "off", label: "Off" },
    { value: "1h", label: "1 hour", hours: 1 },
    { value: "8h", label: "8 hours", hours: 8 },
    { value: "24h", label: "24 hours", hours: 24 },
    { value: "forever", label: "Until I turn it off" },
  ];

// =============================================================================
// Component
// =============================================================================

export default function ChatSettingsScreen({
  route,
  navigation,
}: NativeStackScreenProps<any, "ChatSettings">) {
  const { chatId, groupId, chatType, chatName } =
    route.params as ChatSettingsParams;
  const conversationId = chatType === "dm" ? chatId : groupId;
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<MemberStatePrivate | null>(null);

  // Modal state
  const [muteModalVisible, setMuteModalVisible] = useState(false);
  const [selectedMuteDuration, setSelectedMuteDuration] =
    useState<MuteDuration>("off");

  // Load current settings
  useEffect(() => {
    async function loadSettings() {
      if (!conversationId || !uid) return;

      try {
        setLoading(true);
        let memberSettings: MemberStatePrivate | null = null;

        if (chatType === "dm" && chatId) {
          memberSettings = await getDMMemberPrivate(chatId, uid);
        } else if (chatType === "group" && groupId) {
          memberSettings = await getGroupMemberPrivate(groupId, uid);
        }

        if (memberSettings) {
          setSettings(memberSettings);

          // Determine mute state
          if (memberSettings.mutedUntil === -1) {
            setSelectedMuteDuration("forever");
          } else if (
            memberSettings.mutedUntil &&
            memberSettings.mutedUntil > Date.now()
          ) {
            // Find closest match
            const remainingHours =
              (memberSettings.mutedUntil - Date.now()) / (1000 * 60 * 60);
            if (remainingHours > 12) {
              setSelectedMuteDuration("24h");
            } else if (remainingHours > 4) {
              setSelectedMuteDuration("8h");
            } else {
              setSelectedMuteDuration("1h");
            }
          } else {
            setSelectedMuteDuration("off");
          }
        } else {
          // Initialize with defaults
          setSettings({
            uid,
            lastSeenAtPrivate: Date.now(),
            notifyLevel: "all",
          });
        }
      } catch (error) {
        console.error("[ChatSettingsScreen] Failed to load settings:", error);
        Alert.alert("Error", "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [conversationId, uid, chatType, chatId, groupId]);

  // Handle mute change
  const handleMuteConfirm = useCallback(async () => {
    if (!conversationId || !uid) return;

    setSaving(true);
    try {
      let mutedUntil: number | null = null;

      if (selectedMuteDuration === "forever") {
        mutedUntil = -1;
      } else if (selectedMuteDuration !== "off") {
        const duration = MUTE_DURATIONS.find(
          (d) => d.value === selectedMuteDuration,
        );
        if (duration?.hours) {
          mutedUntil = Date.now() + duration.hours * 60 * 60 * 1000;
        }
      }

      if (chatType === "dm" && chatId) {
        await setMuted(chatId, uid, mutedUntil);
      } else if (chatType === "group" && groupId) {
        await setGroupMuted(
          groupId,
          uid,
          mutedUntil !== null,
          mutedUntil ?? undefined,
        );
      }

      setSettings((prev) =>
        prev ? { ...prev, mutedUntil: mutedUntil ?? undefined } : null,
      );
      setMuteModalVisible(false);
    } catch (error) {
      console.error("[ChatSettingsScreen] Failed to update mute:", error);
      Alert.alert("Error", "Failed to update mute settings");
    } finally {
      setSaving(false);
    }
  }, [conversationId, uid, selectedMuteDuration, chatType, chatId, groupId]);

  // Handle archive toggle
  const handleArchiveToggle = useCallback(async () => {
    if (!conversationId || !uid) return;

    const newValue = !settings?.archived;
    setSaving(true);

    try {
      if (chatType === "dm" && chatId) {
        await setArchived(chatId, uid, newValue);
      } else if (chatType === "group" && groupId) {
        await setGroupArchived(groupId, uid, newValue);
      }

      setSettings((prev) => (prev ? { ...prev, archived: newValue } : null));
    } catch (error) {
      console.error("[ChatSettingsScreen] Failed to update archive:", error);
      Alert.alert("Error", "Failed to update archive setting");
    } finally {
      setSaving(false);
    }
  }, [conversationId, uid, settings?.archived, chatType, chatId, groupId]);

  // Handle read receipts toggle
  const handleReadReceiptsToggle = useCallback(async () => {
    if (!conversationId || !uid) return;

    const newValue = settings?.sendReadReceipts === false ? true : false;
    setSaving(true);

    try {
      if (chatType === "dm" && chatId) {
        await setDMReadReceipts(chatId, uid, newValue);
      } else if (chatType === "group" && groupId) {
        await setGroupReadReceipts(groupId, uid, newValue);
      }

      setSettings((prev) =>
        prev ? { ...prev, sendReadReceipts: newValue } : null,
      );
    } catch (error) {
      console.error(
        "[ChatSettingsScreen] Failed to update read receipts:",
        error,
      );
      Alert.alert("Error", "Failed to update read receipts setting");
    } finally {
      setSaving(false);
    }
  }, [
    conversationId,
    uid,
    settings?.sendReadReceipts,
    chatType,
    chatId,
    groupId,
  ]);

  // Handle notify level change
  const handleNotifyLevelChange = useCallback(
    async (level: "all" | "mentions" | "none") => {
      if (!conversationId || !uid) return;

      setSaving(true);
      try {
        if (chatType === "dm" && chatId) {
          await setDMNotifyLevel(chatId, uid, level);
        } else if (chatType === "group" && groupId) {
          await setGroupNotifyLevel(groupId, uid, level);
        }

        setSettings((prev) => (prev ? { ...prev, notifyLevel: level } : null));
      } catch (error) {
        console.error(
          "[ChatSettingsScreen] Failed to update notify level:",
          error,
        );
        Alert.alert("Error", "Failed to update notification level");
      } finally {
        setSaving(false);
      }
    },
    [conversationId, uid, chatType, chatId, groupId],
  );

  // Get mute status text
  const getMuteStatusText = () => {
    if (!settings?.mutedUntil) return "Off";
    if (settings.mutedUntil === -1) return "Until turned off";
    if (settings.mutedUntil > Date.now()) {
      const date = new Date(settings.mutedUntil);
      return `Until ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return "Off";
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Settings" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title={chatName ? `${chatName} Settings` : "Chat Settings"}
        />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Notifications Section */}
        <List.Section>
          <List.Subheader style={styles.sectionHeader}>
            Notifications
          </List.Subheader>

          {/* Mute */}
          <List.Item
            title="Mute"
            description={getMuteStatusText()}
            left={(props) => (
              <List.Icon
                {...props}
                icon="bell-off-outline"
                color={settings?.mutedUntil ? theme.colors.primary : "#888"}
              />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setMuteModalVisible(true)}
            style={styles.listItem}
            titleStyle={styles.listItemTitle}
            descriptionStyle={styles.listItemDescription}
          />

          <Divider style={styles.divider} />

          {/* Notification Level */}
          <List.Item
            title="Notification Level"
            description={
              settings?.notifyLevel === "all"
                ? "All messages"
                : settings?.notifyLevel === "mentions"
                  ? "Mentions only"
                  : "None"
            }
            left={(props) => (
              <List.Icon {...props} icon="bell-outline" color="#888" />
            )}
            style={styles.listItem}
            titleStyle={styles.listItemTitle}
            descriptionStyle={styles.listItemDescription}
          />

          <View style={styles.radioGroup}>
            <RadioButton.Group
              onValueChange={(value) =>
                handleNotifyLevelChange(value as "all" | "mentions" | "none")
              }
              value={settings?.notifyLevel || "all"}
            >
              <RadioButton.Item
                label="All messages"
                value="all"
                style={styles.radioItem}
                labelStyle={styles.radioLabel}
                color={theme.colors.primary}
              />
              {chatType === "group" && (
                <RadioButton.Item
                  label="Mentions only"
                  value="mentions"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                  color={theme.colors.primary}
                />
              )}
              <RadioButton.Item
                label="None"
                value="none"
                style={styles.radioItem}
                labelStyle={styles.radioLabel}
                color={theme.colors.primary}
              />
            </RadioButton.Group>
          </View>
        </List.Section>

        {/* Privacy Section */}
        <List.Section>
          <List.Subheader style={styles.sectionHeader}>Privacy</List.Subheader>

          {/* Read Receipts */}
          <List.Item
            title="Read Receipts"
            description="Let others know when you've read messages"
            left={(props) => (
              <List.Icon {...props} icon="check-all" color="#888" />
            )}
            right={() => (
              <Switch
                value={settings?.sendReadReceipts !== false}
                onValueChange={handleReadReceiptsToggle}
                disabled={saving}
                color={theme.colors.primary}
              />
            )}
            style={styles.listItem}
            titleStyle={styles.listItemTitle}
            descriptionStyle={styles.listItemDescription}
          />
        </List.Section>

        {/* Chat Management Section */}
        <List.Section>
          <List.Subheader style={styles.sectionHeader}>
            Chat Management
          </List.Subheader>

          {/* Archive */}
          <List.Item
            title="Archive Chat"
            description="Hide from your chat list"
            left={(props) => (
              <List.Icon {...props} icon="archive-outline" color="#888" />
            )}
            right={() => (
              <Switch
                value={settings?.archived || false}
                onValueChange={handleArchiveToggle}
                disabled={saving}
                color={theme.colors.primary}
              />
            )}
            style={styles.listItem}
            titleStyle={styles.listItemTitle}
            descriptionStyle={styles.listItemDescription}
          />
        </List.Section>

        {/* Info text */}
        <Text style={styles.infoText}>
          {settings?.archived
            ? "This chat is archived and won't appear in your main chat list. You can find it in the Archived section."
            : "Archive this chat to hide it from your main chat list."}
        </Text>
      </ScrollView>

      {/* Mute Duration Modal */}
      <Portal>
        <Modal
          visible={muteModalVisible}
          onDismiss={() => setMuteModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Mute Notifications</Text>
          <Text style={styles.modalSubtitle}>
            Choose how long to mute this chat
          </Text>

          <RadioButton.Group
            onValueChange={(value) =>
              setSelectedMuteDuration(value as MuteDuration)
            }
            value={selectedMuteDuration}
          >
            {MUTE_DURATIONS.map((duration) => (
              <RadioButton.Item
                key={duration.value}
                label={duration.label}
                value={duration.value}
                style={styles.radioItem}
                labelStyle={styles.radioLabel}
                color={theme.colors.primary}
              />
            ))}
          </RadioButton.Group>

          <View style={styles.modalButtons}>
            <Button
              mode="text"
              onPress={() => setMuteModalVisible(false)}
              textColor="#888"
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleMuteConfirm}
              loading={saving}
              disabled={saving}
            >
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
  },
  listItem: {
    backgroundColor: "#1A1A1A",
    paddingVertical: 4,
  },
  listItemTitle: {
    color: "#FFF",
    fontSize: 16,
  },
  listItemDescription: {
    color: "#888",
    fontSize: 13,
  },
  divider: {
    backgroundColor: "#333",
  },
  radioGroup: {
    backgroundColor: "#1A1A1A",
    paddingLeft: 40,
  },
  radioItem: {
    paddingVertical: 2,
  },
  radioLabel: {
    color: "#FFF",
    fontSize: 15,
  },
  infoText: {
    color: "#666",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 16,
    lineHeight: 18,
  },
  modal: {
    backgroundColor: "#1A1A1A",
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  modalSubtitle: {
    color: "#888",
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
});
