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
import {
  Text,
  Button,
  ActivityIndicator,
  Card,
  IconButton,
} from "react-native-paper";
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
import {
  pickImageFromWeb,
  captureImageFromWebcam,
} from "@/utils/webImagePicker";

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
    try {
      console.log(
        "🔵 [requestMediaLibraryPermission] Requesting permissions...",
      );
      const { granted } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log(
        "✅ [requestMediaLibraryPermission] Permission result:",
        granted,
      );

      if (!granted) {
        Alert.alert(
          "Permission Denied",
          "Media library access is required to select photos",
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("❌ [requestMediaLibraryPermission] Error:", error);
      return true; // On web, permissions don't apply - continue anyway
    }
  };

  // Request camera permission
  const requestCameraPermission = async () => {
    try {
      console.log(
        "🔵 [requestCameraPermission] Requesting camera permissions...",
      );
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      console.log("✅ [requestCameraPermission] Permission result:", granted);

      if (!granted) {
        Alert.alert(
          "Permission Denied",
          "Camera access is required to take photos",
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("❌ [requestCameraPermission] Error:", error);
      return true; // On web, permissions don't apply - continue anyway
    }
  };

  // Capture photo from camera
  const handleCapturePhoto = async () => {
    console.log("🔵 [handleCapturePhoto] Starting camera capture");
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      console.warn("⚠️  [handleCapturePhoto] Permission denied");
      return;
    }

    try {
      console.log("🔵 [handleCapturePhoto] Platform:", Platform.OS);

      let imageUri: string | null = null;

      // On web, use webcam or file picker
      if (Platform.OS === "web") {
        console.log("🔵 [handleCapturePhoto] Using web-specific capture");
        imageUri = await captureImageFromWebcam();
      } else {
        // On native platforms, use expo-image-picker
        console.log("🔵 [handleCapturePhoto] Launching camera...");
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          aspect: [1, 1],
          quality: 1,
        });

        console.log("✅ [handleCapturePhoto] Camera result:", {
          canceled: result.canceled,
          assetsCount: result.assets?.length || 0,
        });

        if (!result.canceled && result.assets.length > 0) {
          imageUri = result.assets[0].uri;
        }
      }

      if (imageUri) {
        console.log("✅ [handleCapturePhoto] Image captured, uploading...");
        await handleSnapUpload(imageUri);
      } else {
        console.log("ℹ️  [handleCapturePhoto] User cancelled capture");
      }
    } catch (error) {
      console.error("❌ [handleCapturePhoto] Error:", error);
      Alert.alert("Error", `Failed to capture photo: ${String(error)}`);
    }
  };

  // Select photo from gallery
  const handleSelectPhoto = async () => {
    console.log("🔵 [handleSelectPhoto] Starting gallery selection");
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      console.warn("⚠️  [handleSelectPhoto] Permission denied");
      return;
    }

    try {
      console.log("🔵 [handleSelectPhoto] Platform:", Platform.OS);

      let imageUri: string | null = null;

      // On web, use file picker
      if (Platform.OS === "web") {
        console.log("🔵 [handleSelectPhoto] Using web file picker");
        imageUri = await pickImageFromWeb();
      } else {
        // On native platforms, use expo-image-picker
        console.log("🔵 [handleSelectPhoto] Launching image library...");
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          aspect: [1, 1],
          quality: 1,
        });

        console.log("✅ [handleSelectPhoto] Library result:", {
          canceled: result.canceled,
          assetsCount: result.assets?.length || 0,
        });

        if (!result.canceled && result.assets.length > 0) {
          imageUri = result.assets[0].uri;
        }
      }

      if (imageUri) {
        console.log("✅ [handleSelectPhoto] Image selected, uploading...");
        await handleSnapUpload(imageUri);
      } else {
        console.log("ℹ️  [handleSelectPhoto] User cancelled selection");
      }
    } catch (error) {
      console.error("❌ [handleSelectPhoto] Error:", error);
      Alert.alert("Error", `Failed to select photo: ${String(error)}`);
    }
  };

  // Handle snap upload and send
  const handleSnapUpload = async (imageUri: string) => {
    console.log("🔵 [handleSnapUpload] Starting upload with URI:", imageUri);

    if (!uid || !chatId) {
      console.error("❌ [handleSnapUpload] Missing uid or chatId:", {
        uid,
        chatId,
      });
      Alert.alert("Error", "Chat not initialized");
      return;
    }

    try {
      setUploadingSnap(true);

      // Compress image
      console.log("🔵 [handleSnapUpload] Starting compression...");
      const compressedUri = await compressImage(imageUri);
      console.log("✅ [handleSnapUpload] Compression complete:", compressedUri);

      // Upload to Storage and get storagePath
      const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(
        "🔵 [handleSnapUpload] Uploading to Storage with messageId:",
        messageId,
      );
      const storagePath = await uploadSnapImage(
        chatId,
        messageId,
        compressedUri,
      );
      console.log(
        "✅ [handleSnapUpload] Upload complete, storagePath:",
        storagePath,
      );

      // Send as image message
      console.log("🔵 [handleSnapUpload] Sending message...");
      await sendMessage(chatId, uid, storagePath, friendUid, "image");
      console.log("✅ [handleSnapUpload] Message sent successfully");

      Alert.alert("Success", "Snap sent!");
    } catch (error) {
      console.error("❌ [handleSnapUpload] Error:", error);
      Alert.alert("Error", `Failed to send snap: ${String(error)}`);
    } finally {
      setUploadingSnap(false);
    }
  };

  // Show photo options menu
  const showPhotoMenu = () => {
    console.log(
      "🔵 [showPhotoMenu] Opening photo menu, platform:",
      Platform.OS,
    );

    if (Platform.OS === "web") {
      // On web, Alert doesn't work reliably with multiple buttons
      // Use browser's confirm() for a simple choice
      console.log("🔵 [showPhotoMenu] Using web-specific menu");
      
      const useCamera = window.confirm(
        "Send Snap\n\nClick OK to take a photo with camera, or Cancel to choose from gallery."
      );
      
      console.log("🔵 [showPhotoMenu] User choice:", useCamera ? "camera" : "gallery");
      
      if (useCamera) {
        console.log("🔵 [showPhotoMenu] Calling handleCapturePhoto");
        handleCapturePhoto().catch((error) => {
          console.error("❌ [showPhotoMenu] Camera error:", error);
        });
      } else {
        console.log("🔵 [showPhotoMenu] Calling handleSelectPhoto");
        handleSelectPhoto().catch((error) => {
          console.error("❌ [showPhotoMenu] Gallery error:", error);
        });
      }
    } else if (Platform.OS === "ios") {
      console.log("🔵 [showPhotoMenu] Using ActionSheetIOS");
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Gallery"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          console.log("🔵 [showPhotoMenu] Selected option:", buttonIndex);
          if (buttonIndex === 1) {
            handleCapturePhoto();
          } else if (buttonIndex === 2) {
            handleSelectPhoto();
          }
        },
      );
    } else {
      // Android: show alert dialog
      console.log("🔵 [showPhotoMenu] Using Alert dialog");
      Alert.alert("Send Snap", "Choose an option", [
        {
          text: "Cancel",
          onPress: () => console.log("🔵 [showPhotoMenu] Cancel pressed"),
        },
        {
          text: "Take Photo",
          onPress: () => {
            console.log("🔵 [showPhotoMenu] Take Photo pressed");
            handleCapturePhoto();
          },
        },
        {
          text: "Choose from Gallery",
          onPress: () => {
            console.log("🔵 [showPhotoMenu] Choose from Gallery pressed");
            handleSelectPhoto();
          },
        },
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
