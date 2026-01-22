/**
 * ChatListScreen (Inbox)
 * Vibe rebranded: Shows all conversations (DMs and groups)
 */

import React, {
  useState,
  useCallback,
  useLayoutEffect,
  useEffect,
} from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Alert,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  Searchbar,
  Card,
  Badge,
  FAB,
  useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/store/AuthContext";
import { getUserChats } from "@/services/chat";
import { getUserProfileByUid } from "@/services/friends";
import { getScheduledMessages } from "@/services/scheduledMessages";
import {
  getUserGroups,
  getPendingInvites,
  subscribeToUserGroups,
} from "@/services/groups";
import { Chat, AvatarConfig, Group, GroupInvite } from "@/types/models";
import { useFocusEffect } from "@react-navigation/native";
import { AvatarMini } from "@/components/Avatar";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui";
import { Spacing, BorderRadius } from "../../../constants/theme";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";

interface ChatWithProfile extends Chat {
  otherUserProfile?: {
    username: string;
    displayName: string;
    avatarConfig: AvatarConfig;
  };
  otherUid?: string;
}

export default function ChatListScreen({ navigation }: any) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [chats, setChats] = useState<ChatWithProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [pendingInvites, setPendingInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingScheduledCount, setPendingScheduledCount] = useState(0);

  // Set up header with scheduled messages button and group invites
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          {pendingInvites.length > 0 && (
            <TouchableOpacity
              onPress={() => navigation.navigate("GroupInvites")}
              style={styles.headerButton}
            >
              <MaterialCommunityIcons
                name="email-outline"
                size={24}
                color={theme.colors.onSurface}
              />
              <Badge size={16} style={styles.badge}>
                {pendingInvites.length > 99 ? "99+" : pendingInvites.length}
              </Badge>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => navigation.navigate("ScheduledMessages")}
            style={styles.headerButton}
          >
            <MaterialCommunityIcons
              name="clock-outline"
              size={24}
              color={theme.colors.onSurface}
            />
            {pendingScheduledCount > 0 && (
              <Badge size={16} style={styles.badge}>
                {pendingScheduledCount > 99 ? "99+" : pendingScheduledCount}
              </Badge>
            )}
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, pendingScheduledCount, pendingInvites.length]);

  const loadChats = useCallback(async () => {
    if (!uid) return;

    try {
      setLoading(true);
      setError(null);

      // Load DM chats
      const chatsData = await getUserChats(uid);

      // Fetch pending scheduled messages count
      try {
        const scheduledMessages = await getScheduledMessages(uid, "pending");
        setPendingScheduledCount(scheduledMessages.length);
      } catch (e) {
        console.log("Could not fetch scheduled messages count:", e);
      }

      // Fetch groups
      try {
        const userGroups = await getUserGroups(uid);
        setGroups(userGroups);
      } catch (e) {
        console.log("Could not fetch groups:", e);
      }

      // Fetch pending invites
      try {
        const invites = await getPendingInvites(uid);
        setPendingInvites(invites);
      } catch (e) {
        console.log("Could not fetch group invites:", e);
      }

      // Fetch profiles for each chat
      const chatsWithProfiles = await Promise.all(
        chatsData.map(async (chat) => {
          const otherUid = chat.members.find((m) => m !== uid);
          if (!otherUid) return chat;

          const profile = await getUserProfileByUid(otherUid);
          return {
            ...chat,
            otherUid,
            otherUserProfile: profile
              ? {
                  username: profile.username,
                  displayName: profile.displayName,
                  avatarConfig: profile.avatarConfig,
                }
              : undefined,
          };
        }),
      );

      setChats(chatsWithProfiles);
    } catch (err) {
      console.error("Error loading chats:", err);
      setError("Couldn't load your inbox");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // Subscribe to groups updates
  useEffect(() => {
    if (!uid) return;

    const unsubscribe = subscribeToUserGroups(uid, (updatedGroups) => {
      setGroups(updatedGroups);
    });

    return unsubscribe;
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  };

  const handleChatPress = (chat: ChatWithProfile) => {
    if (chat.otherUid) {
      navigation.navigate("ChatDetail", { friendUid: chat.otherUid });
    }
  };

  const handleGroupPress = (group: Group) => {
    navigation.navigate("GroupChat", {
      groupId: group.id,
      groupName: group.name,
    });
  };

  const filteredChats = chats.filter((chat) =>
    chat.otherUserProfile?.username
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase()),
  );

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Local type for combined list items
  type CombinedChatItem =
    | {
        type: "dm";
        id: string;
        lastMessageAt: number | undefined;
        data: ChatWithProfile;
      }
    | { type: "group"; id: string; lastMessageAt: any; data: Group };

  // Combine and sort all items by last message time
  const combinedItems: CombinedChatItem[] = [
    ...filteredChats.map(
      (chat): CombinedChatItem => ({
        type: "dm",
        id: chat.id,
        lastMessageAt: chat.lastMessageAt,
        data: chat,
      }),
    ),
    ...filteredGroups.map(
      (group): CombinedChatItem => ({
        type: "group",
        id: group.id,
        lastMessageAt: group.lastMessageAt,
        data: group,
      }),
    ),
  ].sort((a, b) => {
    const aTime = getTimestamp(a.lastMessageAt);
    const bTime = getTimestamp(b.lastMessageAt);
    return bTime - aTime;
  });

  if (loading) {
    return <LoadingState message="Loading inbox..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Something went wrong"
        message={error}
        onRetry={loadChats}
      />
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Searchbar
        placeholder="Search conversations..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={[styles.searchbar, { backgroundColor: theme.colors.surface }]}
      />

      <FlatList
        data={combinedItems}
        renderItem={({ item }) => {
          if (item.type === "dm") {
            const chat = item.data as ChatWithProfile;
            return (
              <Card
                style={[
                  styles.chatCard,
                  { backgroundColor: theme.colors.surface },
                ]}
                onPress={() => handleChatPress(chat)}
              >
                <Card.Content style={styles.chatContent}>
                  <View style={styles.chatHeader}>
                    <AvatarMini
                      config={
                        chat.otherUserProfile?.avatarConfig || {
                          baseColor: theme.colors.primary,
                        }
                      }
                      size={48}
                    />

                    <View style={styles.chatInfo}>
                      <Text
                        variant="bodyMedium"
                        style={[
                          styles.chatUsername,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        {chat.otherUserProfile?.username || "Loading..."}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={[
                          styles.chatPreview,
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                        numberOfLines={1}
                      >
                        {chat.lastMessageText || "No messages yet"}
                      </Text>
                    </View>

                    <View style={styles.chatTime}>
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.timestamp,
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {chat.lastMessageAt
                          ? formatTime(new Date(chat.lastMessageAt))
                          : ""}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            );
          } else {
            // Group chat
            const group = item.data as Group;
            return (
              <Card
                style={[
                  styles.chatCard,
                  { backgroundColor: theme.colors.surface },
                ]}
                onPress={() => handleGroupPress(group)}
              >
                <Card.Content style={styles.chatContent}>
                  <View style={styles.chatHeader}>
                    <View
                      style={[
                        styles.groupAvatar,
                        { backgroundColor: theme.colors.primary },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="account-group"
                        size={24}
                        color={theme.colors.onPrimary}
                      />
                    </View>

                    <View style={styles.chatInfo}>
                      <View style={styles.groupNameRow}>
                        <Text
                          variant="bodyMedium"
                          style={[
                            styles.chatUsername,
                            { color: theme.colors.onSurface },
                          ]}
                        >
                          {group.name}
                        </Text>
                        <Badge
                          size={16}
                          style={[
                            styles.memberBadge,
                            { backgroundColor: theme.colors.surfaceVariant },
                          ]}
                        >
                          {group.memberCount}
                        </Badge>
                      </View>
                      <Text
                        variant="bodySmall"
                        style={[
                          styles.chatPreview,
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                        numberOfLines={1}
                      >
                        {group.lastMessageText || "No messages yet"}
                      </Text>
                    </View>

                    <View style={styles.chatTime}>
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.timestamp,
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {group.lastMessageAt
                          ? formatTime(toDate(group.lastMessageAt))
                          : ""}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            );
          }
        }}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        {...LIST_PERFORMANCE_PROPS}
        ListEmptyComponent={
          <EmptyState
            icon="message-outline"
            title="Your inbox is quiet"
            subtitle="Start a conversation with your connections"
          />
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      <FAB
        icon="account-group-outline"
        label="New Group"
        onPress={() => navigation.navigate("GroupChatCreate")}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
      />
    </View>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTimestamp(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value?.toMillis) return value.toMillis();
  if (value?.getTime) return value.getTime();
  if (value?.seconds) return value.seconds * 1000;
  return 0;
}

function toDate(timestamp: any): Date {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: Spacing.md,
  },

  searchbar: {
    margin: Spacing.md,
    elevation: 0,
  },

  chatCard: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },

  chatContent: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },

  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },

  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
  },

  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },

  groupNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  memberBadge: {
    // Color applied inline
  },

  chatInfo: {
    flex: 1,
    justifyContent: "center",
  },

  chatUsername: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },

  chatPreview: {
    // Color applied inline
  },

  chatTime: {
    justifyContent: "center",
    alignItems: "flex-end",
    marginLeft: Spacing.sm,
  },

  timestamp: {
    // Color applied inline
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
  },

  emptyText: {
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },

  emptySubtext: {
    // Color applied inline
  },

  headerButton: {
    marginRight: Spacing.sm,
    padding: Spacing.xs,
    position: "relative",
  },

  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  badge: {
    position: "absolute",
    top: -2,
    right: -2,
  },

  fab: {
    position: "absolute",
    bottom: Spacing.md,
    right: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});
