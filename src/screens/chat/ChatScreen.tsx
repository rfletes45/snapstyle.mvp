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
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  Text,
  Button,
  Card,
  IconButton,
  Menu,
  useTheme,
} from "react-native-paper";
import { useAuth } from "@/store/AuthContext";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  getOrCreateChat,
  sendMessage,
  sendMessageOptimistic,
  subscribeToChat,
  markMessageAsRead,
  loadOlderMessages,
  resetPaginationCursor,
} from "@/services/chat";
import { getUserProfileByUid } from "@/services/friends";
import { blockUser } from "@/services/blocking";
import { submitReport } from "@/services/reporting";
import {
  scheduleMessage,
  getScheduledMessagesForChat,
} from "@/services/scheduledMessages";
import {
  Message,
  AvatarConfig,
  ReportReason,
  MessageStatus,
  ScheduledMessage,
} from "@/types/models";
import * as ImagePicker from "expo-image-picker";
import { compressImage, uploadSnapImage } from "@/services/storage";
import {
  pickImageFromWeb,
  captureImageFromWebcam,
} from "@/utils/webImagePicker";
import { AvatarMini } from "@/components/Avatar";
import BlockUserModal from "@/components/BlockUserModal";
import ReportUserModal from "@/components/ReportUserModal";
import ScheduleMessageModal from "@/components/ScheduleMessageModal";
import ScorecardBubble, {
  parseScorecardContent,
} from "@/components/ScorecardBubble";
import { LoadingState, EmptyState } from "@/components/ui";
import { Spacing, BorderRadius } from "../../../constants/theme";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";

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
  const theme = useTheme();
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

  // Phase 12: Pagination state
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Phase 12: Failed messages for retry
  const [failedMessages, setFailedMessages] = useState<Map<string, Message>>(
    new Map(),
  );

  // Block/Report state
  const [menuVisible, setMenuVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // Phase 17: Scheduled messages state
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<
    ScheduledMessage[]
  >([]);

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

          // Reset pagination cursor when entering chat
          resetPaginationCursor();

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
          const unsubscribe = subscribeToChat(
            id,
            async (newMessages, hasMore) => {
              console.log(
                "✅ [ChatScreen] Received",
                newMessages.length,
                "messages from subscription, hasMore:",
                hasMore,
              );

              // Track if there are more messages to load
              setHasMoreMessages(hasMore);

              // Enrich messages with friend profile
              const enrichedMessages = newMessages.map((msg) => ({
                ...msg,
                otherUserProfile:
                  msg.sender === friendUid ? profile : undefined,
              }));

              // Merge with any local optimistic messages that haven't synced yet
              setMessages((prevMessages) => {
                // Keep only local messages that aren't in the new messages
                const localOnlyMessages = prevMessages.filter(
                  (m) => m.isLocal && !newMessages.some((nm) => nm.id === m.id),
                );
                // Combine: server messages + still-pending local messages
                return [...enrichedMessages, ...localOnlyMessages];
              });

              // Mark messages as read if they're from the friend
              for (const msg of newMessages) {
                if (msg.sender === friendUid && !msg.read) {
                  console.log(
                    "🔵 [ChatScreen] Marking message as read:",
                    msg.id,
                  );
                  await markMessageAsRead(id, msg.id);
                }
              }
            },
          );

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
          const errorMessage = error.message || "Failed to initialize chat";
          Alert.alert("Error", errorMessage);
          setLoading(false);
          // Navigate back if blocked
          if (error.message?.includes("Cannot chat with this user")) {
            navigation.goBack();
          }
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

  // Update header with friend name and menu
  useEffect(() => {
    if (friendProfile) {
      navigation.setOptions({
        title: friendProfile.username,
        headerRight: () => (
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={24}
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                setBlockModalVisible(true);
              }}
              title="Block User"
              leadingIcon="block-helper"
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                setReportModalVisible(true);
              }}
              title="Report User"
              leadingIcon="flag"
            />
          </Menu>
        ),
      });
    }
  }, [friendProfile, navigation, menuVisible]);

  const handleSendMessage = async () => {
    if (!uid || !chatId || !inputText.trim()) return;

    const messageContent = inputText.trim();
    setInputText(""); // Clear input immediately for better UX

    // Phase 12: Use optimistic sending
    const { localMessage, sendPromise } = sendMessageOptimistic(
      chatId,
      uid,
      messageContent,
      friendUid,
    );

    // Add optimistic message to UI immediately
    const optimisticMsg: MessageWithProfile = {
      ...localMessage,
      otherUserProfile: undefined, // It's our own message
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      setSendingLoading(true);
      const result = await sendPromise;

      if (result.success) {
        // Remove the local message (will be replaced by real-time listener)
        setMessages((prev) => prev.filter((m) => m.id !== localMessage.id));

        // Remove from failed messages if it was there
        setFailedMessages((prev) => {
          const next = new Map(prev);
          next.delete(localMessage.id);
          return next;
        });

        // Show celebration if milestone reached
        if (result.milestoneReached) {
          const milestoneMessages: Record<number, string> = {
            3: "🔥 3-day streak! You're on fire!\n\nUnlocked: Flame Cap 🔥",
            7: "🔥 1 week streak! Amazing!\n\nUnlocked: Cool Shades 😎",
            14: "🔥 2 week streak! Incredible!\n\nUnlocked: Gradient Glow ✨",
            30: "🔥 30-day streak! One month!\n\nUnlocked: Golden Crown 👑",
            50: "🔥 50-day streak! Legendary!\n\nUnlocked: Star Glasses 🤩",
            100: "💯 100-day streak! Champion!\n\nUnlocked: Rainbow Burst 🌈",
            365: "🏆 365-day streak! One year!\n\nUnlocked: Legendary Halo 😇",
          };

          const message =
            milestoneMessages[result.milestoneReached] ||
            `🎉 ${result.milestoneReached}-day streak milestone!`;

          Alert.alert("Streak Milestone! 🎉", message);
        }
      } else {
        // Mark message as failed
        console.log("❌ [ChatScreen] Message failed:", result.error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === localMessage.id
              ? {
                  ...m,
                  status: "failed" as MessageStatus,
                  errorMessage: result.error,
                }
              : m,
          ),
        );

        // Store for retry
        setFailedMessages((prev) => {
          const next = new Map(prev);
          next.set(localMessage.id, {
            ...localMessage,
            status: "failed",
            errorMessage: result.error,
          });
          return next;
        });
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      // Mark as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === localMessage.id
            ? {
                ...m,
                status: "failed" as MessageStatus,
                errorMessage: error.message,
              }
            : m,
        ),
      );
    } finally {
      setSendingLoading(false);
    }
  };

  // Phase 12: Retry sending a failed message
  const handleRetryMessage = async (failedMsg: Message) => {
    if (!uid || !chatId) return;

    // Remove from failed messages
    setFailedMessages((prev) => {
      const next = new Map(prev);
      next.delete(failedMsg.id);
      return next;
    });

    // Update status to sending
    setMessages((prev) =>
      prev.map((m) =>
        m.id === failedMsg.id
          ? { ...m, status: "sending" as MessageStatus }
          : m,
      ),
    );

    // Resend using optimistic flow
    const { sendPromise } = sendMessageOptimistic(
      chatId,
      uid,
      failedMsg.content,
      friendUid,
      failedMsg.type,
    );

    const result = await sendPromise;

    if (result.success) {
      // Remove the local message (real-time listener will add the server version)
      setMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));
    } else {
      // Still failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id
            ? {
                ...m,
                status: "failed" as MessageStatus,
                errorMessage: result.error,
              }
            : m,
        ),
      );
      setFailedMessages((prev) => {
        const next = new Map(prev);
        next.set(failedMsg.id, {
          ...failedMsg,
          status: "failed",
          errorMessage: result.error,
        });
        return next;
      });
    }
  };

  // Phase 12: Load older messages
  const handleLoadOlderMessages = async () => {
    if (!chatId || loadingOlder || !hasMoreMessages) return;

    try {
      setLoadingOlder(true);
      const { messages: olderMessages, hasMore } =
        await loadOlderMessages(chatId);

      if (olderMessages.length > 0) {
        // Enrich with profile
        const enrichedOlder = olderMessages.map((msg) => ({
          ...msg,
          otherUserProfile:
            msg.sender === friendUid ? friendProfile : undefined,
        }));

        // Prepend older messages
        setMessages((prev) => [...enrichedOlder, ...prev]);
      }

      setHasMoreMessages(hasMore);
    } catch (error) {
      console.error("Error loading older messages:", error);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Block/Report handlers
  const handleBlockConfirm = async (reason?: string) => {
    if (!uid) return;

    try {
      await blockUser(uid, friendUid, reason);
      setBlockModalVisible(false);
      Alert.alert(
        "User Blocked",
        `${friendProfile?.username || "User"} has been blocked.`,
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to block user");
    }
  };

  const handleReportSubmit = async (
    reason: ReportReason,
    description?: string,
  ) => {
    if (!uid) return;

    try {
      await submitReport(uid, friendUid, reason, {
        description,
        relatedContent: { type: "message" },
      });
      setReportModalVisible(false);
      Alert.alert(
        "Report Submitted",
        "Thank you for helping keep our community safe.",
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit report");
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
      const result = await sendMessage(
        chatId,
        uid,
        storagePath,
        friendUid,
        "image",
      );
      console.log("✅ [handleSnapUpload] Message sent successfully");

      // Show celebration if milestone reached
      if (result.milestoneReached) {
        const milestoneMessages: Record<number, string> = {
          3: "🔥 3-day streak! You're on fire!\n\nUnlocked: Flame Cap 🔥",
          7: "🔥 1 week streak! Amazing!\n\nUnlocked: Cool Shades 😎",
          14: "🔥 2 week streak! Incredible!\n\nUnlocked: Gradient Glow ✨",
          30: "🔥 30-day streak! One month!\n\nUnlocked: Golden Crown 👑",
          50: "🔥 50-day streak! Legendary!\n\nUnlocked: Star Glasses 🤩",
          100: "💯 100-day streak! Champion!\n\nUnlocked: Rainbow Burst 🌈",
          365: "🏆 365-day streak! One year!\n\nUnlocked: Legendary Halo 😇",
        };

        const message =
          milestoneMessages[result.milestoneReached] ||
          `🎉 ${result.milestoneReached}-day streak milestone!`;

        Alert.alert("Streak Milestone! 🎉", message);
      } else {
        Alert.alert("Success", "Snap sent!");
      }
    } catch (error) {
      console.error("❌ [handleSnapUpload] Error:", error);
      Alert.alert("Error", `Failed to send snap: ${String(error)}`);
    } finally {
      setUploadingSnap(false);
    }
  };

  // Phase 17: Handle scheduling a message
  const handleScheduleMessage = async (scheduledFor: Date) => {
    if (!uid || !chatId || !inputText.trim()) return;

    const messageContent = inputText.trim();

    try {
      const result = await scheduleMessage({
        senderId: uid,
        recipientId: friendUid,
        chatId,
        content: messageContent,
        type: "text",
        scheduledFor,
      });

      if (result) {
        setInputText(""); // Clear input
        setScheduledMessages((prev) => [...prev, result]);
        Alert.alert(
          "Message Scheduled! ⏰",
          `Your message will be sent ${scheduledFor.toLocaleString()}`,
        );
      } else {
        Alert.alert("Error", "Failed to schedule message. Please try again.");
      }
    } catch (error) {
      console.error("[ChatScreen] Error scheduling message:", error);
      Alert.alert("Error", "Failed to schedule message.");
    }
  };

  // Phase 17: Load scheduled messages for this chat
  useEffect(() => {
    const loadScheduledMessages = async () => {
      if (!uid || !chatId) return;

      try {
        const scheduled = await getScheduledMessagesForChat(uid, chatId);
        setScheduledMessages(scheduled);
      } catch (error) {
        console.error("[ChatScreen] Error loading scheduled messages:", error);
      }
    };

    loadScheduledMessages();
  }, [uid, chatId]);

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
        "Send Snap\n\nClick OK to take a photo with camera, or Cancel to choose from gallery.",
      );

      console.log(
        "🔵 [showPhotoMenu] User choice:",
        useCamera ? "camera" : "gallery",
      );

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
    return <LoadingState message="Loading chat..." />;
  }

  // Helper to render message status indicator
  const renderMessageStatus = (message: MessageWithProfile) => {
    if (message.sender !== uid) return null; // Only show status for sent messages

    switch (message.status) {
      case "sending":
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size={10} color="#999" />
          </View>
        );
      case "failed":
        return (
          <TouchableOpacity
            style={styles.statusContainer}
            onPress={() => handleRetryMessage(message)}
          >
            <Text style={styles.failedStatus}>⚠️ Tap to retry</Text>
          </TouchableOpacity>
        );
      case "sent":
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.sentStatus}>✓</Text>
          </View>
        );
      case "delivered":
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.deliveredStatus}>✓✓</Text>
          </View>
        );
      default:
        return null;
    }
  };

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
              message.status === "failed" && styles.failedMessageContainer,
            ]}
          >
            {/* Show avatar for received messages */}
            {message.sender !== uid && friendProfile && (
              <AvatarMini
                config={friendProfile.avatarConfig || { baseColor: "#6200EE" }}
                size={32}
              />
            )}
            <View style={styles.messageBubbleWrapper}>
              <Card
                style={[
                  styles.messageBubble,
                  message.sender === uid
                    ? styles.sentBubble
                    : styles.receivedBubble,
                  message.status === "sending" && styles.sendingBubble,
                  message.status === "failed" && styles.failedBubble,
                ]}
                onPress={() => {
                  // If failed, allow retry on tap
                  if (message.status === "failed") {
                    handleRetryMessage(message);
                    return;
                  }

                  // If image message, check if user is the receiver before allowing view
                  if (message.type === "image") {
                    // Only allow receiver to open snaps, not the sender
                    if (message.sender === uid) {
                      console.log(
                        "ℹ️  [ChatScreen] Sender cannot open their own snap",
                      );
                      Alert.alert(
                        "Cannot Open",
                        "You sent this snap. Only the receiver can open it.",
                      );
                      return;
                    }

                    // Receiver can open the snap
                    console.log("🔵 [ChatScreen] Opening snap for receiver");
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
                  ) : message.type === "scorecard" ? (
                    (() => {
                      const scorecard = parseScorecardContent(message.content);
                      if (scorecard) {
                        return (
                          <ScorecardBubble
                            scorecard={scorecard}
                            isMine={message.sender === uid}
                          />
                        );
                      }
                      return (
                        <Text style={styles.messageText}>
                          [Invalid scorecard]
                        </Text>
                      );
                    })()
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
              {/* Phase 12: Message status indicator */}
              {renderMessageStatus(message)}
            </View>
            <Text style={styles.timestamp}>
              {new Date(message.createdAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
        {...LIST_PERFORMANCE_PROPS}
        ListHeaderComponent={
          // Phase 12: Load older messages button
          hasMoreMessages ? (
            <TouchableOpacity
              style={styles.loadMoreContainer}
              onPress={handleLoadOlderMessages}
              disabled={loadingOlder}
            >
              {loadingOlder ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text
                  style={[styles.loadMoreText, { color: theme.colors.primary }]}
                >
                  Load older messages
                </Text>
              )}
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="chat-outline"
            title="No messages yet"
            subtitle="Send a message or snap to start the conversation!"
          />
        }
        inverted={false}
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
        {/* Phase 17: Schedule Message Button */}
        <IconButton
          icon="clock-outline"
          size={22}
          onPress={() => setScheduleModalVisible(true)}
          disabled={!inputText.trim() || sendingLoading || uploadingSnap}
          style={styles.scheduleButton}
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

      {/* Block User Modal */}
      <BlockUserModal
        visible={blockModalVisible}
        username={friendProfile?.username || "User"}
        onCancel={() => setBlockModalVisible(false)}
        onConfirm={handleBlockConfirm}
      />

      {/* Report User Modal */}
      <ReportUserModal
        visible={reportModalVisible}
        username={friendProfile?.username || "User"}
        onSubmit={handleReportSubmit}
        onCancel={() => setReportModalVisible(false)}
      />

      {/* Phase 17: Schedule Message Modal */}
      <ScheduleMessageModal
        visible={scheduleModalVisible}
        messagePreview={inputText}
        onSchedule={handleScheduleMessage}
        onClose={() => setScheduleModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor applied inline via theme
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  messageContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    flexDirection: "row",
    marginVertical: Spacing.xs,
    alignItems: "flex-end",
    gap: Spacing.sm,
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
    // backgroundColor applied inline via theme.colors.primary
  },

  receivedBubble: {
    // backgroundColor applied inline via theme.colors.surfaceVariant
  },

  messageContent: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },

  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },

  sentText: {
    // color applied inline via theme.colors.onPrimary
  },

  receivedText: {
    // color applied inline via theme.colors.onSurface
  },

  timestamp: {
    fontSize: 12,
    marginTop: Spacing.xs,
    marginHorizontal: Spacing.sm,
    // color applied inline via theme
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
    // backgroundColor and borderTopColor applied inline via theme
  },

  textInput: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    borderWidth: 1,
    // backgroundColor and borderColor applied inline via theme
  },

  sendButton: {
    marginBottom: 0,
  },

  sendButtonLabel: {
    fontSize: 14,
  },

  scheduleButton: {
    margin: 0,
    marginBottom: 2,
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxxl,
  },

  emptyText: {
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },

  emptySubtext: {
    // color applied inline via theme
  },

  // Phase 12: Message status styles
  messageBubbleWrapper: {
    flexDirection: "column",
    alignItems: "flex-end",
    maxWidth: "80%",
  },

  statusContainer: {
    marginTop: 2,
    paddingHorizontal: Spacing.xs,
  },

  sentStatus: {
    fontSize: 10,
    // color applied inline via theme
  },

  deliveredStatus: {
    fontSize: 10,
    // color applied inline via theme.colors.primary
  },

  failedStatus: {
    fontSize: 10,
    // color applied inline via theme.colors.error
  },

  sendingBubble: {
    opacity: 0.7,
  },

  failedBubble: {
    borderWidth: 1,
    // backgroundColor and borderColor applied inline via theme.colors.errorContainer
  },

  failedMessageContainer: {
    opacity: 0.8,
  },

  // Phase 12: Load more styles
  loadMoreContainer: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },

  loadMoreText: {
    fontSize: 14,
    fontWeight: "500",
    // color applied inline via theme.colors.primary
  },
});
