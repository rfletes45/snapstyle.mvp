import { blockUser } from "@/services/blocking";
import { getOrCreateChat } from "@/services/chat";
import { getUserProfileByUid } from "@/services/friends";
import { submitReport } from "@/services/reporting";
import {
  getScheduledMessagesForChat,
  scheduleMessage,
} from "@/services/scheduledMessages";
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { MessageKind, MessageV2, ReplyToMetadata } from "@/types/messaging";
import {
  AvatarConfig,
  Message,
  MessageStatus,
  ReportReason,
  ScheduledMessage,
} from "@/types/models";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Badge,
  Button,
  Card,
  IconButton,
  Menu,
  Text,
  useTheme,
} from "react-native-paper";

// V2 imports
import { AvatarMini } from "@/components/Avatar";
import BlockUserModal from "@/components/BlockUserModal";
import {
  MessageActionsSheet,
  ReplyBubble,
  ReplyPreviewBar,
  SwipeableMessage,
} from "@/components/chat";
import ReportUserModal from "@/components/ReportUserModal";
import ScheduleMessageModal from "@/components/ScheduleMessageModal";
import ScorecardBubble, {
  parseScorecardContent,
} from "@/components/ScorecardBubble";
import { EmptyState, LoadingState } from "@/components/ui";
import { useMessagesV2 } from "@/hooks/useMessagesV2";
import {
  retryFailedMessage as retryFailedMessageV2,
  sendMessageWithOutbox,
} from "@/services/chatV2";
import { compressImage, uploadSnapImage } from "@/services/storage";
import { updateStreakAfterMessage } from "@/services/streakCosmetics";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import {
  captureImageFromWebcam,
  pickImageFromWeb,
} from "@/utils/webImagePicker";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEBUG_CHAT_V2, SHOW_V2_BADGE } from "../../../constants/featureFlags";
import { BorderRadius, Spacing } from "../../../constants/theme";

interface MessageWithProfile extends Message {
  otherUserProfile?: {
    username: string;
    displayName: string;
    avatarConfig: AvatarConfig;
  };
  /** Reply-to metadata for H6 reply feature */
  replyTo?: ReplyToMetadata;
}

/**
 * Convert V2 message to V1 MessageWithProfile format
 * This adapter allows the existing UI to work with V2 messages
 */
function messageV2ToWithProfile(
  msg: MessageV2,
  friendUid: string,
  friendProfile: any,
): MessageWithProfile {
  // Map V2 kind to V1 type (V1 only supports text, image, scorecard)
  const typeMap: Record<MessageKind, "text" | "image" | "scorecard"> = {
    text: "text",
    media: "image",
    scorecard: "scorecard",
    voice: "text", // Fallback for unsupported types
    file: "text",
    system: "text",
  };

  // Map V2 status to V1 status
  // V2 status values: "sending" | "sent" | "delivered" | "failed" | undefined
  let status: MessageStatus = "sent";
  if (msg.status === "sending") status = "sending";
  else if (msg.status === "failed") status = "failed";
  else if (msg.status === "delivered") status = "delivered";
  else if (msg.status === "sent") status = "sent";

  return {
    id: msg.id,
    sender: msg.senderId,
    content: msg.text || "",
    type: typeMap[msg.kind] || "text",
    createdAt: msg.serverReceivedAt || msg.createdAt || Date.now(),
    expiresAt:
      (msg.serverReceivedAt || msg.createdAt || Date.now()) +
      24 * 60 * 60 * 1000,
    read: false, // V2 uses watermarks instead
    status,
    isLocal: msg.status === "sending",
    clientMessageId: msg.clientMessageId,
    errorMessage:
      msg.status === "failed" ? "Message failed to send" : undefined,
    // V2 specific fields that exist in MessageWithProfile
    otherUserProfile: msg.senderId === friendUid ? friendProfile : undefined,
    replyTo: msg.replyTo,
  };
}

export default function ChatScreen({
  route,
  navigation,
}: NativeStackScreenProps<any, "ChatDetail">) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const { setCurrentChatId } = useInAppNotifications();
  const uid = currentFirebaseUser?.uid;
  const { friendUid } = route.params as { friendUid: string };

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingLoading, setSendingLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [uploadingSnap, setUploadingSnap] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // H6: Reply-to state
  const [replyTo, setReplyTo] = useState<ReplyToMetadata | null>(null);

  // Block/Report state
  const [menuVisible, setMenuVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // Phase 17: Scheduled messages state
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<
    ScheduledMessage[]
  >([]);

  // H7: Message actions state
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] =
    useState<MessageWithProfile | null>(null);

  // ==========================================================================
  // V2 Hook Integration
  // ==========================================================================
  const messagesV2 = useMessagesV2(
    chatId
      ? {
          scope: "dm",
          conversationId: chatId,
          currentUid: uid || "",
          currentUserName:
            currentFirebaseUser?.displayName ||
            currentFirebaseUser?.email ||
            "User",
          autoMarkRead: true,
        }
      : {
          // Dummy options when no chatId yet - hook will early-return
          scope: "dm",
          conversationId: "",
          currentUid: "",
        },
  );

  // Convert V2 messages to UI format
  const v2MessagesAsUI: MessageWithProfile[] = chatId
    ? messagesV2.messages.map((msg) =>
        messageV2ToWithProfile(msg, friendUid, friendProfile),
      )
    : [];

  // Use V2 state for display
  const displayMessages = chatId ? v2MessagesAsUI : [];
  const isLoading = chatId ? messagesV2.loading : loading;
  const hasMoreToLoad = chatId ? messagesV2.pagination.hasMoreOlder : false;
  const isLoadingMore = chatId ? messagesV2.pagination.isLoadingOlder : false;

  // Log V2 status in dev
  useEffect(() => {
    if (DEBUG_CHAT_V2 && chatId) {
      console.log("🔵 [ChatScreen V2] Status:", {
        chatId: chatId?.substring(0, 8) + "...",
        messageCount: displayMessages.length,
        loading: isLoading,
        hasMore: hasMoreToLoad,
      });
    }
  }, [chatId, displayMessages.length, isLoading, hasMoreToLoad]);

  // Hide tab bar when this screen is focused
  useFocusEffect(
    useCallback(() => {
      // Hide tab bar
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: "none" },
      });

      // Restore tab bar when leaving
      return () => {
        navigation.getParent()?.setOptions({
          tabBarStyle: undefined,
        });
      };
    }, [navigation]),
  );

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

          // Phase G: Suppress in-app notifications for this chat
          setCurrentChatId(id);

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

          // V2: useMessagesV2 hook handles subscription automatically
          console.log(
            "🔵 [ChatScreen V2] Using useMessagesV2 hook for messages",
          );

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

      // Cleanup on unmount
      return () => {
        // Phase G: Clear current chat ID to resume notifications
        setCurrentChatId(null);
      };
    }, [uid, friendUid, setCurrentChatId]),
  );

  // Update header with friend name and menu
  useEffect(() => {
    if (friendProfile) {
      navigation.setOptions({
        title: friendProfile.username,
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* V2 badge for debugging */}
            {SHOW_V2_BADGE && (
              <Badge
                size={20}
                style={{ backgroundColor: "#4CAF50", marginRight: 8 }}
              >
                V2
              </Badge>
            )}
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
              contentStyle={{ backgroundColor: theme.colors.surface }}
            >
              <Menu.Item
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate("ChatSettings", {
                    chatId,
                    chatType: "dm",
                    chatName: friendProfile?.username,
                  });
                }}
                title="Settings"
                leadingIcon="cog-outline"
              />
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
          </View>
        ),
      });
    }
  }, [friendProfile, navigation, menuVisible]);

  // Scroll to end when keyboard shows to keep latest messages visible
  useEffect(() => {
    const keyboardShowEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const keyboardListener = Keyboard.addListener(keyboardShowEvent, () => {
      // Small delay to let layout adjust
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => keyboardListener.remove();
  }, []);

  // H6: Handle reply-to from swipe gesture
  const handleReply = useCallback((replyMetadata: ReplyToMetadata) => {
    console.log(
      "🔵 [ChatScreen] Setting reply to message:",
      replyMetadata.messageId,
    );
    setReplyTo(replyMetadata);
  }, []);

  // H6: Clear reply state
  const handleCancelReply = useCallback(() => {
    console.log("🔵 [ChatScreen] Canceling reply");
    setReplyTo(null);
  }, []);

  // H7: Handle long press on message to show actions
  const handleMessageLongPress = useCallback((message: MessageWithProfile) => {
    setSelectedMessage(message);
    setActionsSheetVisible(true);
  }, []);

  // H7: Convert MessageWithProfile to MessageV2 format for actions sheet
  const selectedMessageAsV2: MessageV2 | null = selectedMessage
    ? {
        id: selectedMessage.id,
        scope: "dm",
        conversationId: chatId || "",
        senderId: selectedMessage.sender,
        senderName:
          selectedMessage.sender === uid
            ? "You"
            : friendProfile?.displayName || "User",
        kind: selectedMessage.type === "image" ? "media" : "text",
        text:
          selectedMessage.type === "text" ? selectedMessage.content : undefined,
        attachments:
          selectedMessage.type === "image"
            ? [
                {
                  id: selectedMessage.id,
                  kind: "image" as const,
                  mime: "image/jpeg",
                  url: selectedMessage.content,
                  path: "",
                  sizeBytes: 0,
                },
              ]
            : undefined,
        createdAt: selectedMessage.createdAt,
        serverReceivedAt: selectedMessage.createdAt,
        clientId: "",
        idempotencyKey: "",
      }
    : null;

  // H7: Handle reply from actions sheet
  const handleActionsReply = useCallback((replyMetadata: ReplyToMetadata) => {
    setReplyTo(replyMetadata);
  }, []);

  // H7: Handle message edited
  const handleMessageEdited = useCallback(
    (messageId: string, newText: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: newText } : m)),
      );
    },
    [],
  );

  // H7: Handle message deleted
  const handleMessageDeleted = useCallback(
    (messageId: string, forAll: boolean) => {
      if (forAll) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    },
    [],
  );

  // H6: Create reply metadata from a V1 message
  const createReplyMetadataFromMessage = useCallback(
    (message: MessageWithProfile): ReplyToMetadata => {
      const senderName =
        message.sender === uid
          ? "You"
          : friendProfile?.displayName || friendProfile?.username || "User";

      return {
        messageId: message.id,
        senderId: message.sender,
        senderName,
        kind:
          message.type === "image"
            ? "media"
            : message.type === "scorecard"
              ? "text"
              : "text",
        textSnippet:
          message.type === "text"
            ? message.content.length > 100
              ? message.content.substring(0, 100) + "..."
              : message.content
            : undefined,
        attachmentPreview:
          message.type === "image"
            ? { kind: "image", thumbUrl: undefined }
            : undefined,
      };
    },
    [uid, friendProfile],
  );

  // H6: Scroll to a specific message
  const scrollToMessage = useCallback(
    (messageId: string) => {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index !== -1 && flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5, // Center the message
        });
      }
    },
    [messages],
  );

  const handleSendMessage = async () => {
    if (!uid || !chatId || !inputText.trim()) return;

    const messageContent = inputText.trim();
    const currentReplyTo = replyTo; // Capture before clearing
    setInputText(""); // Clear input immediately for better UX
    setReplyTo(null); // H6: Clear reply state

    // V2 Send Path
    console.log("🔵 [ChatScreen V2] Sending message via sendMessageWithOutbox");
    setSendingLoading(true);

    try {
      const { outboxItem, sendPromise } = await sendMessageWithOutbox({
        conversationId: chatId,
        scope: "dm",
        kind: "text",
        text: messageContent,
        replyTo: currentReplyTo || undefined,
      });

      // The useMessagesV2 hook will automatically pick up the optimistic message
      // from the outbox and merge it into the display

      // Wait for result
      const result = await sendPromise;

      if (!result.success) {
        console.log("❌ [ChatScreen V2] Message failed:", result.error);
        // The outbox item will remain in failed state and show in UI
      } else {
        if (DEBUG_CHAT_V2) {
          console.log("✅ [ChatScreen V2] Message sent successfully");
        }
      }
    } catch (error: any) {
      console.error("❌ [ChatScreen V2] Error sending message:", error);
    } finally {
      setSendingLoading(false);
    }
  };

  // Phase 12: Retry sending a failed message
  const handleRetryMessage = async (failedMsg: Message) => {
    if (!uid || !chatId) return;

    // V2 uses the outbox retry function
    console.log("🔵 [ChatScreen V2] Retrying message:", failedMsg.id);
    const success = await retryFailedMessageV2(failedMsg.id);
    if (success) {
      console.log("✅ [ChatScreen V2] Retry successful");
    } else {
      console.log("❌ [ChatScreen V2] Retry failed");
    }
  };

  // Phase 12: Load older messages
  const handleLoadOlderMessages = async () => {
    // V2 uses hook's loadOlder function
    if (
      !chatId ||
      messagesV2.pagination.isLoadingOlder ||
      !messagesV2.pagination.hasMoreOlder
    )
      return;
    await messagesV2.loadOlder();
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
          mediaTypes: ["images"],
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
          mediaTypes: ["images"],
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

      // Send as image message using V2
      console.log("🔵 [handleSnapUpload] Sending message via V2...");
      const { outboxItem, sendPromise } = await sendMessageWithOutbox({
        conversationId: chatId,
        scope: "dm",
        kind: "media",
        text: storagePath, // Storage path as content
      });
      console.log(
        "✅ [handleSnapUpload] Message enqueued, waiting for send...",
      );

      // Wait for send to complete
      const sendResult = await sendPromise;
      if (!sendResult.success) {
        throw new Error(sendResult.error || "Failed to send snap");
      }
      console.log("✅ [handleSnapUpload] Message sent successfully");

      // Update streak (separate from V2 message sending)
      const { newCount, milestoneReached } = await updateStreakAfterMessage(
        uid,
        friendUid,
      );
      console.log("✅ [handleSnapUpload] Streak updated:", {
        newCount,
        milestoneReached,
      });

      // Show celebration if milestone reached
      if (milestoneReached) {
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
          milestoneMessages[milestoneReached] ||
          `🎉 ${milestoneReached}-day streak milestone!`;

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

  if (isLoading) {
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
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: message }) => (
            <SwipeableMessage
              message={{
                id: message.id,
                scope: "dm",
                conversationId: chatId || "",
                senderId: message.sender,
                senderName:
                  message.sender === uid ? "You" : friendProfile?.displayName,
                kind: message.type === "image" ? "media" : "text",
                text: message.type === "text" ? message.content : undefined,
                createdAt: message.createdAt,
                serverReceivedAt: message.createdAt,
                clientId: "",
                idempotencyKey: "",
              }}
              onReply={handleReply}
              enabled={
                message.type !== "scorecard" && message.status !== "failed"
              }
              currentUid={uid}
            >
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
                    config={
                      friendProfile.avatarConfig || { baseColor: "#6200EE" }
                    }
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
                    onLongPress={() => handleMessageLongPress(message)}
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
                        console.log(
                          "🔵 [ChatScreen] Opening snap for receiver",
                        );
                        navigation.navigate("SnapViewer", {
                          messageId: message.id,
                          chatId: chatId,
                          storagePath: message.content,
                        });
                      }
                    }}
                  >
                    <Card.Content style={styles.messageContent}>
                      {/* H6: Reply preview if message is a reply */}
                      {message.replyTo && (
                        <ReplyBubble
                          replyTo={message.replyTo}
                          isSentByMe={message.sender === uid}
                          isReplyToMe={message.replyTo.senderId === uid}
                          onPress={() =>
                            scrollToMessage(message.replyTo!.messageId)
                          }
                        />
                      )}
                      {message.type === "image" ? (
                        <Text style={{ fontSize: 24 }}>🔒</Text>
                      ) : message.type === "scorecard" ? (
                        (() => {
                          const scorecard = parseScorecardContent(
                            message.content,
                          );
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
            </SwipeableMessage>
          )}
          keyExtractor={(item) => item.id}
          {...LIST_PERFORMANCE_PROPS}
          contentContainerStyle={{
            paddingHorizontal: Spacing.sm,
            paddingBottom: 16,
          }}
          ListHeaderComponent={
            // Phase 12: Load older messages button
            hasMoreToLoad ? (
              <TouchableOpacity
                style={styles.loadMoreContainer}
                onPress={handleLoadOlderMessages}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />
                ) : (
                  <Text
                    style={[
                      styles.loadMoreText,
                      { color: theme.colors.primary },
                    ]}
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
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
        />

        {/* Input area */}
        <View
          style={[
            styles.inputAreaWrapper,
            {
              backgroundColor: theme.dark ? "#000" : "#fff",
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {/* H6: Reply preview bar above input */}
          {replyTo && (
            <ReplyPreviewBar
              replyTo={replyTo}
              onCancel={handleCancelReply}
              isOwnMessage={replyTo.senderId === uid}
            />
          )}

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: theme.dark ? "#000" : "#fff",
                borderTopColor: theme.dark ? "#222" : "#e0e0e0",
              },
            ]}
          >
            <IconButton
              icon="camera"
              size={24}
              onPress={showPhotoMenu}
              disabled={sendingLoading || uploadingSnap}
              style={styles.iconButton}
            />
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.dark ? "#1A1A1A" : "#f0f0f0",
                  color: theme.dark ? "#FFF" : "#000",
                  borderColor: theme.dark ? "#333" : "#e0e0e0",
                },
              ]}
              placeholder="Message..."
              placeholderTextColor={theme.dark ? "#888" : "#999"}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!sendingLoading && !uploadingSnap}
              textAlignVertical="center"
            />
            {/* Phase 17: Schedule Message Button */}
            <IconButton
              icon="clock-outline"
              size={22}
              onPress={() => setScheduleModalVisible(true)}
              disabled={!inputText.trim() || sendingLoading || uploadingSnap}
              style={styles.iconButton}
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
        </View>
      </KeyboardAvoidingView>

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

      {/* H7: Message Actions Sheet */}
      <MessageActionsSheet
        visible={actionsSheetVisible}
        message={selectedMessageAsV2}
        currentUid={uid || ""}
        onClose={() => setActionsSheetVisible(false)}
        onReply={handleActionsReply}
        onEdited={handleMessageEdited}
        onDeleted={handleMessageDeleted}
      />
    </>
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

  inputAreaWrapper: {
    // backgroundColor set inline based on theme
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
    // backgroundColor and borderTopColor set inline based on theme
  },

  textInput: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 16,
    borderWidth: 1,
    // color, backgroundColor, borderColor set inline based on theme
  },

  sendButton: {
    height: 40,
    justifyContent: "center",
    marginBottom: 0,
  },

  sendButtonLabel: {
    fontSize: 14,
  },

  iconButton: {
    margin: 0,
    width: 40,
    height: 40,
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
