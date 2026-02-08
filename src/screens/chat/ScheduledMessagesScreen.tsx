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
} from "@/services/scheduledMessages";
import { useAuth } from "@/store/AuthContext";
import { ScheduledMessage, ScheduledMessageStatus } from "@/types/models";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import {
  Appbar,
  Card,
  Chip,
  IconButton,
  Menu,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<any, "ScheduledMessages">;

export default function ScheduledMessagesScreen({ navigation }: Props) {
  const theme = useTheme();
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

  // Load scheduled messages
  const loadMessages = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const statusFilter = filter === "all" ? undefined : filter;
      const result = await getScheduledMessages(user.uid, statusFilter);
      setMessages(result);
    } catch (err) {
      console.error("Error loading scheduled messages:", err);
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
    console.log(
      "[ScheduledMessagesScreen] handleCancel called for:",
      messageId,
    );

    // Use native confirm for web, Alert for mobile
    const isWeb = Platform.OS === "web";
    const confirmed = isWeb
      ? window.confirm(
          "Are you sure you want to cancel this scheduled message?",
        )
      : true; // Will use Alert.alert below

    if (isWeb && !confirmed) {
      return;
    }

    const performCancel = async () => {
      console.log("[ScheduledMessagesScreen] User confirmed cancel");
      try {
        if (!user) {
          console.error("[ScheduledMessagesScreen] No user found");
          return;
        }
        console.log(
          "[ScheduledMessagesScreen] Calling cancelScheduledMessage...",
        );
        await cancelScheduledMessage(messageId, user.uid);
        console.log("[ScheduledMessagesScreen] Cancel successful");

        if (isWeb) {
          window.alert("Message has been cancelled");
        } else {
          Alert.alert("Cancelled", "Message has been cancelled");
        }

        loadMessages();
      } catch (error: any) {
        console.error(
          "[ScheduledMessagesScreen] Error cancelling message:",
          error,
        );
        const errorMsg = `Failed to cancel message: ${error?.message || error}`;

        if (isWeb) {
          window.alert(errorMsg);
        } else {
          Alert.alert("Error", errorMsg);
        }
      }
    };

    if (isWeb) {
      performCancel();
    } else {
      Alert.alert(
        "Cancel Message",
        "Are you sure you want to cancel this scheduled message?",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, Cancel",
            style: "destructive",
            onPress: performCancel,
          },
        ],
      );
    }
  };

  const handleDelete = async (messageId: string) => {
    console.log(
      "[ScheduledMessagesScreen] handleDelete called for:",
      messageId,
    );

    // Use native confirm for web, Alert for mobile
    const isWeb = Platform.OS === "web";
    const confirmed = isWeb
      ? window.confirm(
          "Are you sure you want to permanently delete this scheduled message?",
        )
      : true; // Will use Alert.alert below

    if (isWeb && !confirmed) {
      return;
    }

    const performDelete = async () => {
      console.log("[ScheduledMessagesScreen] User confirmed delete");
      try {
        if (!user) {
          console.error("[ScheduledMessagesScreen] No user found");
          return;
        }
        console.log(
          "[ScheduledMessagesScreen] Calling deleteScheduledMessage...",
        );
        await deleteScheduledMessage(messageId, user.uid);
        console.log("[ScheduledMessagesScreen] Delete successful");

        if (isWeb) {
          window.alert("Message has been deleted");
        } else {
          Alert.alert("Deleted", "Message has been deleted");
        }

        loadMessages();
      } catch (error: any) {
        console.error(
          "[ScheduledMessagesScreen] Error deleting message:",
          error,
        );
        const errorMsg = `Failed to delete message: ${error?.message || error}`;

        if (isWeb) {
          window.alert(errorMsg);
        } else {
          Alert.alert("Error", errorMsg);
        }
      }
    };

    if (isWeb) {
      performDelete();
    } else {
      Alert.alert(
        "Delete Message",
        "Are you sure you want to permanently delete this scheduled message?",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, Delete",
            style: "destructive",
            onPress: performDelete,
          },
        ],
      );
    }
  };

  const getStatusColor = (status: ScheduledMessageStatus): string => {
    switch (status) {
      case "pending":
        return "#2196F3";
      case "sent":
        return "#4CAF50";
      case "cancelled":
        return "#9E9E9E";
      case "failed":
        return "#F44336";
      default:
        return "#757575";
    }
  };

  const getStatusIcon = (status: ScheduledMessageStatus): string => {
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
  };

  const renderMessage = ({ item }: { item: ScheduledMessage }) => {
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
          <Text style={styles.messageContent} numberOfLines={3}>
            {item.type === "image" ? "📸 Picture" : item.content}
          </Text>

          {/* Scheduled time */}
          <View style={styles.timeRow}>
            <IconButton icon="clock" size={16} style={styles.timeIcon} />
            <Text style={styles.scheduledTime}>
              {formatScheduledTime(item.scheduledFor)}
            </Text>
          </View>

          {/* Time until delivery (for pending) */}
          {isPending && timeUntil && (
            <Text style={styles.timeUntil}>Sends {timeUntil}</Text>
          )}

          {/* Sent time (for sent messages) */}
          {item.status === "sent" && item.sentAt && (
            <Text style={styles.sentTime}>
              Sent at {formatScheduledTime(item.sentAt)}
            </Text>
          )}

          {/* Fail reason */}
          {item.status === "failed" && item.failReason && (
            <Text style={styles.failReason}>Failed: {item.failReason}</Text>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <IconButton icon="clock-outline" size={64} disabled />
      <Text style={styles.emptyTitle}>No Scheduled Messages</Text>
      <Text style={styles.emptySubtitle}>
        {filter === "pending"
          ? "You don't have any pending scheduled messages"
          : `No ${filter} messages to show`}
      </Text>
    </View>
  );

  const renderFilterChips = () => (
    <View style={styles.filterContainer}>
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
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text>Please sign in to view scheduled messages</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    color: "#666",
  },

  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
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
    backgroundColor: "#fff",
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
    color: "#333",
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
    color: "#666",
  },

  timeUntil: {
    fontSize: 13,
    color: "#2196F3",
    fontWeight: "500",
    marginTop: 4,
    marginLeft: 24,
  },

  sentTime: {
    fontSize: 13,
    color: "#4CAF50",
    marginTop: 4,
    marginLeft: 24,
  },

  failReason: {
    fontSize: 13,
    color: "#F44336",
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
    color: "#333",
    marginBottom: 8,
  },

  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
