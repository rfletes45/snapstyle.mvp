/**
 * ScheduledMessagesScreen.tsx
 *
 * Shows all pending scheduled messages for the current user
 * with options to cancel or edit them.
 */

import { ErrorState, LoadingState } from "@/components/ui";
import {
  cancelScheduledMessage,
  deleteScheduledMessage,
  formatScheduledTime,
  getScheduledMessages,
  getTimeUntilDelivery,
  subscribeToScheduledMessages,
  updateScheduledMessageContent,
} from "@/services/scheduledMessages";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { ScheduledMessage, ScheduledMessageStatus } from "@/types/models";
import { alertDialog, confirmDialog } from "@/utils/confirmDialog";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  Card,
  Chip,
  IconButton,
  Menu,
  Modal,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/chat/ScheduledMessagesScreen");
type Props = NativeStackScreenProps<any, "ScheduledMessages">;

export default function ScheduledMessagesScreen({ navigation }: Props) {
  const theme = useTheme();
  const { colors } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const user = currentFirebaseUser;
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScheduledMessageStatus | "all">(
    "pending",
  );
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(
    null,
  );
  const [editText, setEditText] = useState("");

  // Load scheduled messages
  const loadMessages = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const statusFilter = filter === "all" ? undefined : filter;
      const result = await getScheduledMessages(user.uid, statusFilter);
      setMessages(result);
    } catch (err) {
      logger.error("Error loading scheduled messages:", err);
      setError("Couldn't load scheduled messages");
    }
  }, [user, filter]);

  // Subscribe to real-time updates for pending messages
  useEffect(() => {
    if (!user) return;

    // Only subscribe to real-time updates when viewing pending messages
    if (filter !== "pending" && filter !== "all") {
      return;
    }

    const unsubscribe = subscribeToScheduledMessages(
      user.uid,
      (updatedMessages) => {
        if (filter === "pending" || filter === "all") {
          setMessages(updatedMessages);
        }
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user, filter]);

  // Load messages on filter change
  useEffect(() => {
    setLoading(true);
    loadMessages().finally(() => setLoading(false));
  }, [loadMessages]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  };

  const handleCancel = async (messageId: string) => {
    logger.info(
      "[ScheduledMessagesScreen] handleCancel called for:",
      messageId,
    );

    confirmDialog(
      {
        title: "Cancel Message",
        message: "Are you sure you want to cancel this scheduled message?",
        confirmText: "Yes, Cancel",
        destructive: true,
      },
      async () => {
        try {
          if (!user) {
            logger.error("[ScheduledMessagesScreen] No user found");
            return;
          }
          await cancelScheduledMessage(messageId, user.uid);
          logger.info("[ScheduledMessagesScreen] Cancel successful");
          alertDialog({
            title: "Cancelled",
            message: "Message has been cancelled",
          });
          loadMessages();
        } catch (error: any) {
          logger.error(
            "[ScheduledMessagesScreen] Error cancelling message:",
            error,
          );
          alertDialog({
            title: "Error",
            message: `Failed to cancel message: ${error?.message || error}`,
          });
        }
      },
    );
  };

  const handleDelete = async (messageId: string) => {
    logger.info(
      "[ScheduledMessagesScreen] handleDelete called for:",
      messageId,
    );

    confirmDialog(
      {
        title: "Delete Message",
        message:
          "Are you sure you want to permanently delete this scheduled message?",
        confirmText: "Yes, Delete",
        destructive: true,
      },
      async () => {
        try {
          if (!user) {
            logger.error("[ScheduledMessagesScreen] No user found");
            return;
          }
          await deleteScheduledMessage(messageId, user.uid);
          logger.info("[ScheduledMessagesScreen] Delete successful");
          alertDialog({
            title: "Deleted",
            message: "Message has been deleted",
          });
          loadMessages();
        } catch (error: any) {
          logger.error(
            "[ScheduledMessagesScreen] Error deleting message:",
            error,
          );
          alertDialog({
            title: "Error",
            message: `Failed to delete message: ${error?.message || error}`,
          });
        }
      },
    );
  };

  // ---- Edit scheduled message text ----

  const handleStartEdit = useCallback((message: ScheduledMessage) => {
    setEditingMessage(message);
    setEditText(message.content);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage || !user) return;
    const trimmed = editText.trim();
    if (!trimmed || trimmed === editingMessage.content) {
      setEditingMessage(null);
      return;
    }

    try {
      await updateScheduledMessageContent(editingMessage.id, user.uid, trimmed);
      setEditingMessage(null);
      loadMessages();
    } catch (error: any) {
      logger.error("[ScheduledMessagesScreen] Error editing message:", error);
      const errorMsg = `Failed to edit message: ${error?.message || error}`;
      if (Platform.OS === "web") {
        window.alert(errorMsg);
      } else {
        Alert.alert("Error", errorMsg);
      }
    }
  }, [editingMessage, editText, user, loadMessages]);

  const getStatusColor = useCallback(
    (status: ScheduledMessageStatus): string => {
      switch (status) {
        case "pending":
          return colors.info;
        case "sent":
          return colors.success;
        case "cancelled":
          return colors.textMuted;
        case "failed":
          return colors.error;
        default:
          return colors.textSecondary;
      }
    },
    [colors],
  );

  const getStatusIcon = useCallback(
    (status: ScheduledMessageStatus): string => {
      switch (status) {
        case "pending":
          return "clock-outline";
        case "sent":
          return "check-circle";
        case "cancelled":
          return "cancel";
        case "failed":
          return "alert-circle";
        default:
          return "help-circle";
      }
    },
    [],
  );

  const renderMessage = useCallback(
    ({ item }: { item: ScheduledMessage }) => {
      const isPending = item.status === "pending";
      const timeUntil = isPending
        ? getTimeUntilDelivery(item.scheduledFor)
        : null;

      return (
        <Card style={styles.messageCard} mode="elevated">
          <Card.Content>
            {/* Status chip */}
            <View style={styles.headerRow}>
              <Chip
                icon={getStatusIcon(item.status)}
                style={[
                  styles.statusChip,
                  { backgroundColor: getStatusColor(item.status) + "20" },
                ]}
                textStyle={{ color: getStatusColor(item.status), fontSize: 12 }}
              >
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Chip>

              {isPending && (
                <Menu
                  visible={menuVisible === item.id}
                  onDismiss={() => setMenuVisible(null)}
                  anchor={
                    <IconButton
                      icon="dots-vertical"
                      size={20}
                      onPress={() => setMenuVisible(item.id)}
                    />
                  }
                  contentStyle={{ backgroundColor: theme.colors.surface }}
                >
                  {item.type !== "image" && (
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        handleStartEdit(item);
                      }}
                      title="Edit Text"
                      leadingIcon="pencil"
                    />
                  )}
                  <Menu.Item
                    onPress={() => {
                      setMenuVisible(null);
                      handleCancel(item.id);
                    }}
                    title="Cancel Message"
                    leadingIcon="cancel"
                  />
                  <Menu.Item
                    onPress={() => {
                      setMenuVisible(null);
                      handleDelete(item.id);
                    }}
                    title="Delete"
                    leadingIcon="delete"
                  />
                </Menu>
              )}

              {!isPending && (
                <IconButton
                  icon="delete"
                  size={20}
                  onPress={() => handleDelete(item.id)}
                />
              )}
            </View>

            {/* Message content */}
            <Text
              style={[styles.messageContent, { color: colors.text }]}
              numberOfLines={3}
            >
              {item.type === "image" ? "📸 Picture" : item.content}
            </Text>

            {/* Scheduled time */}
            <View style={styles.timeRow}>
              <IconButton icon="clock" size={16} style={styles.timeIcon} />
              <Text
                style={[styles.scheduledTime, { color: colors.textSecondary }]}
              >
                {formatScheduledTime(item.scheduledFor)}
              </Text>
            </View>

            {/* Time until delivery (for pending) */}
            {isPending && timeUntil && (
              <Text style={[styles.timeUntil, { color: colors.info }]}>
                Sends {timeUntil}
              </Text>
            )}

            {/* Sent time (for sent messages) */}
            {item.status === "sent" && item.sentAt && (
              <Text style={[styles.sentTime, { color: colors.success }]}>
                Sent at {formatScheduledTime(item.sentAt)}
              </Text>
            )}

            {/* Fail reason */}
            {item.status === "failed" && item.failReason && (
              <Text style={[styles.failReason, { color: colors.error }]}>
                Failed: {item.failReason}
              </Text>
            )}
          </Card.Content>
        </Card>
      );
    },
    [
      getStatusColor,
      getStatusIcon,
      menuVisible,
      handleCancel,
      handleDelete,
      colors,
    ],
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <IconButton icon="clock-outline" size={64} disabled />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No Scheduled Messages
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {filter === "pending"
            ? "You don't have any pending scheduled messages"
            : `No ${filter} messages to show`}
        </Text>
      </View>
    ),
    [filter, colors],
  );

  const renderFilterChips = useCallback(
    () => (
      <View
        style={[
          styles.filterContainer,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        {(["all", "pending", "sent", "cancelled", "failed"] as const).map(
          (status) => (
            <Chip
              key={status}
              selected={filter === status}
              onPress={() => setFilter(status)}
              style={styles.filterChip}
              textStyle={styles.filterChipText}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Chip>
          ),
        )}
      </View>
    ),
    [filter, colors],
  );

  if (!user) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centerContainer}>
          <Text style={{ color: colors.text }}>
            Please sign in to view scheduled messages
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Scheduled Messages" />
      </Appbar.Header>

      {renderFilterChips()}

      {loading && !refreshing ? (
        <LoadingState message="Loading scheduled messages..." />
      ) : error ? (
        <ErrorState
          title="Something went wrong"
          message={error}
          onRetry={loadMessages}
        />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          {...LIST_PERFORMANCE_PROPS}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* Edit scheduled message modal */}
      <Portal>
        <Modal
          visible={editingMessage !== null}
          onDismiss={() => setEditingMessage(null)}
          contentContainerStyle={[
            styles.editModal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onSurface, marginBottom: 12 }}
          >
            Edit Scheduled Message
          </Text>
          <TextInput
            value={editText}
            onChangeText={setEditText}
            multiline
            numberOfLines={4}
            style={[
              styles.editInput,
              {
                color: theme.colors.onSurface,
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surfaceVariant,
              },
            ]}
            autoFocus
          />
          <View style={styles.editActions}>
            <Button mode="text" onPress={() => setEditingMessage(null)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveEdit}
              disabled={
                !editText.trim() || editText.trim() === editingMessage?.content
              }
            >
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },

  filterChip: {
    height: 32,
  },

  filterChipText: {
    fontSize: 12,
  },

  listContent: {
    padding: 16,
    flexGrow: 1,
  },

  messageCard: {
    marginBottom: 12,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  statusChip: {
    height: 28,
  },

  messageContent: {
    fontSize: 16,
    marginBottom: 12,
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: -8,
  },

  timeIcon: {
    margin: 0,
  },

  scheduledTime: {
    fontSize: 14,
  },

  timeUntil: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
    marginLeft: 24,
  },

  sentTime: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 24,
  },

  failReason: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 24,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },

  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },

  editModal: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },

  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 16,
  },

  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});
