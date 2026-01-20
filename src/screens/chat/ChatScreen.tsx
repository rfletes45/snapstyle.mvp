import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { Text, Button, ActivityIndicator, Card, IconButton } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
import * as ImagePicker from "expo-image-picker";
import { compressImage, uploadSnapImage } from "@/services/storage";

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
  const [uploadingSnap, setUploadingSnap] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize chat and subscribe to messages
  useFocusEffect(
    useCallback(() => {
      const initializeChat = async () => {
        if (!uid) {
          console.error("❌ [ChatScreen] No uid available");
          return;
        }

        console.log(
          "🔵 [ChatScreen] Initializing chat with friendUid:",
          friendUid,
          "currentUid:",
          uid,
        );

        try {
          setLoading(true);

          // Get or create chat
          console.log("🔵 [ChatScreen] Calling getOrCreateChat...");
          const id = await getOrCreateChat(uid, friendUid);
          console.log("✅ [ChatScreen] Chat ID obtained:", id);
          setChatId(id);

          // Fetch friend profile
          console.log(
            "🔵 [ChatScreen] Fetching friend profile for:",
            friendUid,
          );
          const profile = await getUserProfileByUid(friendUid);
          console.log(
            "✅ [ChatScreen] Friend profile loaded:",
            profile?.username,
          );
          setFriendProfile(profile);

          // Subscribe to real-time messages
          console.log("🔵 [ChatScreen] Setting up message subscription...");
          const unsubscribe = subscribeToChat(id, async (newMessages) => {
            console.log(
              "✅ [ChatScreen] Received",
              newMessages.length,
              "messages from subscription",
            );
            // Enrich messages with friend profile
            const enrichedMessages = newMessages.map((msg) => ({
              ...msg,
              otherUserProfile: msg.sender === friendUid ? profile : undefined,
            }));

            setMessages(enrichedMessages);

            // Mark messages as read if they're from the friend
            for (const msg of newMessages) {
              if (msg.sender === friendUid && !msg.read) {
                console.log("🔵 [ChatScreen] Marking message as read:", msg.id);
                await markMessageAsRead(id, msg.id);
              }
            }
          });

          unsubscribeRef.current = unsubscribe;
          console.log("✅ [ChatScreen] Chat initialization complete");
          setLoading(false);
        } catch (error: any) {
          console.error("❌ [ChatScreen] Chat initialization error:", {
            message: error.message,
            code: error.code,
            errorType: error.constructor.name,
            timestamp: new Date().toISOString(),
          });
          Alert.alert("Error", "Failed to initialize chat");
          setLoading(false);
        }
      };

      initializeChat();

      // Cleanup listener on unmount
      return () => {
        if (unsubscribeRef.current) {
          console.log("🔵 [ChatScreen] Cleaning up message listener");
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

  // Request media library permission
  const requestMediaLibraryPermission = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Permission Denied",
        "Media library access is required to select photos",
      );
      return false;
    }
    return true;
  };

  // Request camera permission
  const requestCameraPermission = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert("Permission Denied", "Camera access is required to take photos");
      return false;
    }
    return true;
  };

  // Capture photo from camera
  const handleCapturePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
        await handleSnapUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error capturing photo:", error);
      Alert.alert("Error", "Failed to capture photo");
    }
  };

  // Select photo from gallery
  const handleSelectPhoto = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
        await handleSnapUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error selecting photo:", error);
      Alert.alert("Error", "Failed to select photo");
    }
  };

  // Handle snap upload and send
  const handleSnapUpload = async (imageUri: string) => {
    if (!uid || !chatId) return;

    try {
      setUploadingSnap(true);

      // Compress image
      Alert.alert("Compressing...", "Please wait");
      const compressedUri = await compressImage(imageUri);

      // Upload to Storage and get storagePath
      const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const storagePath = await uploadSnapImage(chatId, messageId, compressedUri);

      // Send as image message
      await sendMessage(chatId, uid, storagePath, friendUid, "image");

      Alert.alert("Success", "Snap sent!");
    } catch (error) {
      console.error("Error uploading snap:", error);
      Alert.alert("Error", "Failed to send snap");
    } finally {
      setUploadingSnap(false);
    }
  };

  // Show photo options menu
  const showPhotoMenu = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Gallery"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleCapturePhoto();
          } else if (buttonIndex === 2) {
            handleSelectPhoto();
          }
        },
      );
    } else {
      // Android: show alert dialog
      Alert.alert("Send Snap", "Choose an option", [
        { text: "Cancel", onPress: () => {} },
        { text: "Take Photo", onPress: handleCapturePhoto },
        { text: "Choose from Gallery", onPress: handleSelectPhoto },
      ]);
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
              onPress={() => {
                // If image message, navigate to snap viewer
                if (message.type === "image") {
                  navigation.navigate("SnapViewer", {
                    messageId: message.id,
                    chatId: chatId,
                    storagePath: message.content,
                  });
                }
              }}
            >
              <Card.Content style={styles.messageContent}>
                {message.type === "image" ? (
                  <Text style={{ fontSize: 24 }}>🔒</Text>
                ) : (
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
                )}
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
        <IconButton
          icon="camera"
          size={24}
          onPress={showPhotoMenu}
          disabled={sendingLoading || uploadingSnap}
        />
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={!sendingLoading && !uploadingSnap}
        />
        <Button
          mode="contained"
          onPress={handleSendMessage}
          disabled={!inputText.trim() || sendingLoading || uploadingSnap}
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
