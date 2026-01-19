import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, FlatList, Alert } from "react-native";
import {
  Text,
  Searchbar,
  Card,
  ActivityIndicator,
  Button,
} from "react-native-paper";
import { useAuth } from "@/store/AuthContext";
import { getUserChats, getOrCreateChat } from "@/services/chat";
import { getUserProfileByUid } from "@/services/friends";
import { Chat, AvatarConfig } from "@/types/models";
import { useFocusEffect } from "@react-navigation/native";

interface ChatWithProfile extends Chat {
  otherUserProfile?: {
    username: string;
    displayName: string;
    avatarConfig: AvatarConfig;
  };
  otherUid?: string;
}

export default function ChatListScreen({ navigation }: any) {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [chats, setChats] = useState<ChatWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadChats = useCallback(async () => {
    if (!uid) return;

    try {
      setLoading(true);
      const chatsData = await getUserChats(uid);

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
    } catch (error) {
      console.error("Error loading chats:", error);
      Alert.alert("Error", "Failed to load chats");
    } finally {
      setLoading(false);
    }
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

  const filteredChats = chats.filter((chat) =>
    chat.otherUserProfile?.username
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator animating={true} size="large" />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search chats..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <FlatList
        data={filteredChats}
        renderItem={({ item: chat }) => (
          <Card style={styles.chatCard} onPress={() => handleChatPress(chat)}>
            <Card.Content style={styles.chatContent}>
              <View style={styles.chatHeader}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor:
                        chat.otherUserProfile?.avatarConfig?.baseColor ||
                        "#6200EE",
                    },
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {chat.otherUserProfile?.username?.charAt(0).toUpperCase() ||
                      "?"}
                  </Text>
                </View>

                <View style={styles.chatInfo}>
                  <Text variant="bodyMedium" style={styles.chatUsername}>
                    {chat.otherUserProfile?.username || "Loading..."}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={styles.chatPreview}
                    numberOfLines={1}
                  >
                    {chat.lastMessageText || "No messages yet"}
                  </Text>
                </View>

                <View style={styles.chatTime}>
                  <Text variant="labelSmall" style={styles.timestamp}>
                    {chat.lastMessageAt
                      ? formatTime(new Date(chat.lastMessageAt))
                      : ""}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No chats yet
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              Start chatting with friends to see conversations here
            </Text>
          </View>
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 16,
    color: "#666",
  },

  searchbar: {
    margin: 16,
    elevation: 0,
    backgroundColor: "#fff",
  },

  chatCard: {
    marginHorizontal: 16,
    marginVertical: 8,
  },

  chatContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },

  chatInfo: {
    flex: 1,
    justifyContent: "center",
  },

  chatUsername: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },

  chatPreview: {
    color: "#999",
  },

  chatTime: {
    justifyContent: "center",
    alignItems: "flex-end",
    marginLeft: 8,
  },

  timestamp: {
    color: "#999",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },

  emptyText: {
    fontWeight: "500",
    marginBottom: 8,
  },

  emptySubtext: {
    color: "#999",
  },
});
