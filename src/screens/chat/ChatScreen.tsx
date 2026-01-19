import React, { useEffect, useState, useCallback, useRef } from "react";
import { StyleSheet, View, FlatList, TextInput, Alert, KeyboardAvoidingView } from "react-native";
import { Text, Button, ActivityIndicator, Card } from "react-native-paper";
import { useAuth } from "@/store/AuthContext";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  getOrCreateChat,
  sendMessage,
  subscribeToChat,
  getChatMessages,
  markMessageAsRead,
} from "@/services/chat";
import { getUserProfileByUid } from "@/services/friends";
import { Message, AvatarConfig } from "@/types/models";

interface MessageWithProfile extends Message {
  otherUserProfile?: {
    username: string;
    displayName: string;
    avatarConfig: AvatarConfig;
  };
}

export default function ChatScreen({
  route,
  navigation,
}: NativeStackScreenProps<any, "ChatDetail">) {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;
  const { friendUid } = route.params as { friendUid: string };

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingLoading, setSendingLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize chat and subscribe to messages
  useFocusEffect(
    useCallback(() => {
      const initializeChat = async () => {
        if (!uid) return;

        try {
          setLoading(true);

          // Get or create chat
          const id = await getOrCreateChat(uid, friendUid);
          setChatId(id);

          // Fetch friend profile
          const profile = await getUserProfileByUid(friendUid);
          setFriendProfile(profile);

          // Subscribe to real-time messages
          const unsubscribe = subscribeToChat(id, async (newMessages) => {
            // Enrich messages with friend profile
            const enrichedMessages = newMessages.map((msg) => ({
              ...msg,
              otherUserProfile: msg.sender === friendUid ? profile : undefined,
            }));

            setMessages(enrichedMessages);

            // Mark messages as read if they're from the friend
            for (const msg of newMessages) {
              if (msg.sender === friendUid && !msg.read) {
                await markMessageAsRead(id, msg.id);
              }
            }
          });

          unsubscribeRef.current = unsubscribe;
          setLoading(false);
        } catch (error) {
          console.error("Error initializing chat:", error);
          Alert.alert("Error", "Failed to initialize chat");
          setLoading(false);
        }
      };

      initializeChat();

      // Cleanup listener on unmount
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    }, [uid, friendUid]),
  );

  // Update header with friend name
  useEffect(() => {
    if (friendProfile) {
      navigation.setOptions({
        title: friendProfile.username,
      });
    }
  }, [friendProfile, navigation]);

  const handleSendMessage = async () => {
    if (!uid || !chatId || !inputText.trim()) return;

    try {
      setSendingLoading(true);
      await sendMessage(chatId, uid, inputText.trim(), friendUid);
      setInputText("");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
    } finally {
      setSendingLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator animating={true} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <FlatList
        data={messages}
        renderItem={({ item: message }) => (
          <View
            style={[
              styles.messageContainer,
              message.sender === uid
                ? styles.sentMessageContainer
                : styles.receivedMessageContainer,
            ]}
          >
            <Card
              style={[
                styles.messageBubble,
                message.sender === uid
                  ? styles.sentBubble
                  : styles.receivedBubble,
              ]}
            >
              <Card.Content style={styles.messageContent}>
                <Text
                  style={[
                    styles.messageText,
                    message.sender === uid
                      ? styles.sentText
                      : styles.receivedText,
                  ]}
                >
                  {message.content}
                </Text>
              </Card.Content>
            </Card>
            <Text style={styles.timestamp}>
              {new Date(message.createdAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
        inverted
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No messages yet
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              Start the conversation!
            </Text>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={!sendingLoading}
        />
        <Button
          mode="contained"
          onPress={handleSendMessage}
          disabled={!inputText.trim() || sendingLoading}
          loading={sendingLoading}
          style={styles.sendButton}
          labelStyle={styles.sendButtonLabel}
        >
          Send
        </Button>
      </View>
    </KeyboardAvoidingView>
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
  },

  messageContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: "row",
    marginVertical: 4,
  },

  sentMessageContainer: {
    justifyContent: "flex-end",
  },

  receivedMessageContainer: {
    justifyContent: "flex-start",
  },

  messageBubble: {
    maxWidth: "80%",
    elevation: 0,
  },

  sentBubble: {
    backgroundColor: "#0084FF",
  },

  receivedBubble: {
    backgroundColor: "#E5E5EA",
  },

  messageContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },

  sentText: {
    color: "#fff",
  },

  receivedText: {
    color: "#000",
  },

  timestamp: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
    marginHorizontal: 8,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 8,
  },

  textInput: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },

  sendButton: {
    marginBottom: 0,
  },

  sendButtonLabel: {
    fontSize: 14,
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
