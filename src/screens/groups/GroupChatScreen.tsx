/**
 * GroupChatScreen
 * Phase 20: Group Chat Messaging
 *
 * Features:
 * - Send/receive messages in group
 * - Text and image messages
 * - System messages (join/leave)
 * - Real-time updates
 * - Message pagination
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import {
  Text,
  TextInput,
  IconButton,
  Appbar,
  ActivityIndicator,
  Snackbar,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/store/AuthContext";
import {
  getGroup,
  subscribeToGroupMessages,
  sendGroupMessage,
  isGroupMember,
  updateLastRead,
} from "@/services/groups";
import { uploadGroupImage } from "@/services/storage";
import { Group, GroupMessage } from "@/types/models";
import { AvatarMini } from "@/components/Avatar";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { AppColors } from "../../../constants/theme";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";

interface Props {
  route: any;
  navigation: any;
}

export default function GroupChatScreen({ route, navigation }: Props) {
  const { groupId, groupName: initialGroupName } = route.params;
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const flatListRef = useRef<FlatList>(null);

  // Load group and verify membership
  useEffect(() => {
    async function loadGroup() {
      if (!groupId || !uid) return;

      try {
        setLoading(true);
        setError(null);

        // Check membership
        const isMember = await isGroupMember(groupId, uid);
        if (!isMember) {
          setError("You are not a member of this group");
          return;
        }

        const groupData = await getGroup(groupId);
        if (!groupData) {
          setError("Group not found");
          return;
        }

        setGroup(groupData);
        navigation.setOptions({ title: groupData.name });
      } catch (err: any) {
        console.error("Error loading group:", err);
        setError(err.message || "Failed to load group");
      } finally {
        setLoading(false);
      }
    }

    loadGroup();
  }, [groupId, uid, navigation]);

  // Subscribe to messages
  useEffect(() => {
    if (!groupId || !uid || error) return;

    const unsubscribe = subscribeToGroupMessages(groupId, (messagesData) => {
      setMessages(messagesData);
      setLoading(false);

      // Update last read timestamp
      updateLastRead(groupId, uid).catch(console.error);
    });

    return () => unsubscribe();
  }, [groupId, uid, error]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Send text message
  const handleSendMessage = async () => {
    if (!uid || !messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText("");
    setSending(true);

    try {
      await sendGroupMessage(groupId, uid, text, "text");
    } catch (error: any) {
      console.error("Error sending message:", error);
      setMessageText(text); // Restore message on failure
      setSnackbar({
        visible: true,
        message: error.message || "Failed to send message",
      });
    } finally {
      setSending(false);
    }
  };

  // Send image message
  const handleSendImage = async () => {
    if (!uid || sending) return;

    try {
      // Request permission
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant photo library access");
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (result.canceled || !result.assets?.[0]) return;

      setSending(true);

      // Generate message ID for storage path
      const messageId = `${Date.now()}_${uid}`;

      // Upload image
      const imagePath = await uploadGroupImage(
        groupId,
        messageId,
        result.assets[0].uri,
      );

      // Send image message
      await sendGroupMessage(groupId, uid, imagePath, "image");
    } catch (error: any) {
      console.error("Error sending image:", error);
      setSnackbar({
        visible: true,
        message: error.message || "Failed to send image",
      });
    } finally {
      setSending(false);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Check if we should show sender info (different sender from previous message)
  const shouldShowSender = (index: number, message: GroupMessage) => {
    if (message.type === "system") return false;
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    if (prevMessage.type === "system") return true;
    return prevMessage.sender !== message.sender;
  };

  // Render message
  const renderMessage = ({
    item,
    index,
  }: {
    item: GroupMessage;
    index: number;
  }) => {
    const isOwnMessage = item.sender === uid;
    const showSender = shouldShowSender(index, item);

    // System message
    if (item.type === "system") {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage && styles.ownMessageContainer,
        ]}
      >
        {!isOwnMessage && showSender && (
          <Text style={[styles.senderName, { color: theme.colors.primary }]}>
            {item.senderDisplayName}
          </Text>
        )}

        <View
          style={[
            styles.messageBubble,
            isOwnMessage
              ? [styles.ownMessage, { backgroundColor: theme.colors.primary }]
              : styles.otherMessage,
            item.type === "image" && styles.imageBubble,
          ]}
        >
          {item.type === "image" ? (
            <Image
              source={{ uri: item.content }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          ) : item.type === "scorecard" && item.scorecard ? (
            <View style={styles.scorecardContent}>
              <MaterialCommunityIcons
                name="gamepad-variant"
                size={24}
                color={isOwnMessage ? "#000" : "#FFF"}
              />
              <Text
                style={[
                  styles.scorecardGame,
                  isOwnMessage && styles.ownMessageText,
                ]}
              >
                {item.scorecard.gameId === "reaction_tap"
                  ? "Reaction Tap"
                  : "Timed Tap"}
              </Text>
              <Text
                style={[
                  styles.scorecardScore,
                  isOwnMessage && styles.ownMessageText,
                ]}
              >
                {item.scorecard.gameId === "reaction_tap"
                  ? `${item.scorecard.score}ms`
                  : `${item.scorecard.score} taps`}
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.messageText,
                isOwnMessage && styles.ownMessageText,
              ]}
            >
              {item.content}
            </Text>
          )}
        </View>

        <Text
          style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}
        >
          {formatTime(item.createdAt)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={initialGroupName || "Group Chat"} />
        </Appbar.Header>
        <LoadingState message="Loading messages..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Error" />
        </Appbar.Header>
        <ErrorState
          message={error}
          onRetry={() => navigation.goBack()}
          retryLabel="Go Back"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <TouchableOpacity
          style={styles.headerTitle}
          onPress={() => navigation.navigate("GroupChatInfo", { groupId })}
        >
          <View
            style={[
              styles.groupIcon,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name="account-group"
              size={20}
              color={theme.colors.primary}
            />
          </View>
          <View>
            <Text style={styles.headerTitleText}>{group?.name}</Text>
            <Text style={styles.headerSubtitle}>
              {group?.memberCount} members
            </Text>
          </View>
        </TouchableOpacity>
        <Appbar.Action
          icon="information-outline"
          onPress={() => navigation.navigate("GroupChatInfo", { groupId })}
        />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {messages.length === 0 ? (
          <EmptyState
            icon="chat-outline"
            title="No Messages Yet"
            subtitle="Be the first to send a message!"
          />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            {...LIST_PERFORMANCE_PROPS}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <IconButton
            icon="image"
            size={24}
            iconColor="#888"
            onPress={handleSendImage}
            disabled={sending}
          />

          <TextInput
            mode="flat"
            placeholder="Message..."
            value={messageText}
            onChangeText={setMessageText}
            style={styles.textInput}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            textColor="#FFF"
            placeholderTextColor="#888"
            multiline
            maxLength={1000}
          />

          {sending ? (
            <ActivityIndicator
              size={24}
              color={theme.colors.primary}
              style={styles.sendButton}
            />
          ) : (
            <IconButton
              icon="send"
              size={24}
              iconColor={
                messageText.trim()
                  ? theme.colors.primary
                  : theme.colors.onSurfaceDisabled
              }
              onPress={handleSendMessage}
              disabled={!messageText.trim()}
            />
          )}
        </View>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    backgroundColor: "#000",
  },
  headerTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginLeft: 8,
  },
  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  headerSubtitle: {
    color: "#888",
    fontSize: 12,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: "80%",
  },
  ownMessageContainer: {
    alignSelf: "flex-end",
  },
  senderName: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    backgroundColor: AppColors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: "#1A1A1A",
    borderBottomLeftRadius: 4,
  },
  imageBubble: {
    padding: 4,
  },
  messageText: {
    color: "#FFF",
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: "#000",
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  scorecardContent: {
    alignItems: "center",
    padding: 8,
  },
  scorecardGame: {
    color: "#FFF",
    fontSize: 12,
    marginTop: 4,
  },
  scorecardScore: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 2,
  },
  messageTime: {
    color: "#666",
    fontSize: 10,
    marginTop: 4,
    marginLeft: 12,
  },
  ownMessageTime: {
    textAlign: "right",
    marginRight: 12,
  },
  systemMessage: {
    alignItems: "center",
    marginVertical: 12,
  },
  systemMessageText: {
    color: "#888",
    fontSize: 12,
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#222",
    backgroundColor: "#000",
  },
  textInput: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    maxHeight: 100,
    paddingHorizontal: 16,
  },
  sendButton: {
    marginHorizontal: 8,
  },
  snackbar: {
    backgroundColor: "#333",
  },
});
