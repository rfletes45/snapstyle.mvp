/**
 * GroupChatScreen (UNI-06 - Refactored)
 *
 * Group chat screen using unified chat system abstractions.
 * Refactored from ~1,700 lines to ~600 lines using:
 * - useUnifiedChatScreen hook (combines useChat + useChatComposer)
 * - ChatComposer component (unified input area)
 * - ChatMessageList component (unified message display)
 *
 * Screen-specific features retained:
 * - Multi-attachment support (H10)
 * - Voice messages (H11)
 * - Link previews (H12)
 * - Emoji reactions (H8)
 * - @mention autocomplete (H9)
 * - Reply-to threading (H6)
 *
 * @module screens/groups/GroupChatScreen
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Image, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  IconButton,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Auth
import { useAuth } from "@/store/AuthContext";

// Unified hooks
import { useAttachmentPicker } from "@/hooks/useAttachmentPicker";
import { useUnifiedChatScreen } from "@/hooks/useUnifiedChatScreen";
import { useVoiceRecorder, VoiceRecording } from "@/hooks/useVoiceRecorder";

// Chat components
import { AvatarMini } from "@/components/Avatar";
import {
  AttachmentTray,
  CameraLongPressButton,
  ChatComposer,
  ChatGameInvites,
  ChatMessageList,
  LinkPreviewCard,
  MediaViewerModal,
  MentionAutocomplete,
  MessageActionsSheet,
  ReactionsSummary,
  ReplyBubble,
  SwipeableGroupMessage,
  VoiceMessagePlayer,
  VoiceRecordButton,
} from "@/components/chat";
import type { ChatMessageListRef } from "@/components/chat/ChatMessageList";
import ScheduleMessageModal from "@/components/ScheduleMessageModal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";

// Services
import {
  getGroup,
  getGroupMembers,
  getGroupMessages,
  isGroupMember,
  sendGroupMessage,
  subscribeToGroupMessages,
  updateLastRead,
} from "@/services/groups";
import { extractUrls, fetchPreview, hasUrls } from "@/services/linkPreview";
import {
  extractMentionsExact,
  MentionableMember,
} from "@/services/mentionParser";
import {
  ReactionSummary,
  subscribeToMultipleMessageReactions,
} from "@/services/reactions";
import {
  getScheduledMessagesForChat,
  scheduleMessage,
} from "@/services/scheduledMessages";
import { uploadVoiceMessage } from "@/services/storage";

// Game Picker
import { GamePickerModal } from "@/components/games/GamePickerModal";
import { GAME_SCREEN_MAP } from "@/config/gameCategories";
import { ExtendedGameType } from "@/types/games";

// Types
import {
  AttachmentV2,
  LinkPreviewV2,
  MessageV2,
  ReplyToMetadata,
} from "@/types/messaging";
import {
  Group,
  GroupMember,
  GroupMessage,
  ScheduledMessage,
} from "@/types/models";
import { DEBUG_CHAT_V2 } from "../../../constants/featureFlags";

// =============================================================================
// Constants
// =============================================================================

const PAGINATION_PAGE_SIZE = 25;
const LOAD_OLDER_DEBOUNCE_MS = 500;

interface Props {
  route: any;
  navigation: any;
}

// =============================================================================
// GroupChatScreen Component
// =============================================================================

export default function GroupChatScreen({ route, navigation }: Props) {
  const { groupId, groupName: initialGroupName } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  // ==========================================================================
  // Screen State
  // ==========================================================================

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const messageListRef = useRef<ChatMessageListRef>(null);
  const textInputRef = useRef<any>(null);

  // Media viewer state (H10)
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [viewerAttachments, setViewerAttachments] = useState<AttachmentV2[]>(
    [],
  );
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [viewerSenderName, setViewerSenderName] = useState<string>("");
  const [viewerTimestamp, setViewerTimestamp] = useState<Date | undefined>();

  // Link previews cache (H12)
  const [linkPreviews, setLinkPreviews] = useState<
    Map<string, LinkPreviewV2 | null>
  >(new Map());
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(
    new Set(),
  );

  // Message actions state (H7)
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<GroupMessage | null>(
    null,
  );
  const [userRole, setUserRole] = useState<
    "owner" | "admin" | "moderator" | "member"
  >("member");

  // Reactions state (H8)
  const [messageReactions, setMessageReactions] = useState<
    Map<string, ReactionSummary[]>
  >(new Map());

  // Pagination state
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const lastLoadOlderTimeRef = useRef<number>(0);

  // Scheduled messages state (UNI-09)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [gamePickerVisible, setGamePickerVisible] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<
    ScheduledMessage[]
  >([]);

  // ==========================================================================
  // Mentionable Members
  // ==========================================================================

  const mentionableMembers: MentionableMember[] = useMemo(
    () =>
      groupMembers.map((m) => ({
        uid: m.uid,
        displayName: m.displayName || "Unknown",
        username: m.username,
      })),
    [groupMembers],
  );

  // ==========================================================================
  // Unified Hook (UNI-06)
  // ==========================================================================

  const screen = useUnifiedChatScreen({
    scope: "group",
    conversationId: groupId || "",
    currentUid: uid || "",
    currentUserName: currentFirebaseUser?.displayName || "User",
    enableVoice: true,
    enableAttachments: true,
    enableMentions: true,
    enableScheduledMessages: true,
    onSchedulePress: () => setScheduleModalVisible(true),
    mentionableMembers,
    maxMentionSuggestions: 5,
    debug: DEBUG_CHAT_V2,
  });

  // ==========================================================================
  // Attachment & Voice Hooks
  // ==========================================================================

  const attachmentPicker = useAttachmentPicker({
    maxAttachments: 10,
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: ["image"],
  });

  const voiceRecorder = useVoiceRecorder({
    maxDuration: 60,
    onRecordingComplete: () => {},
  });

  // ==========================================================================
  // Initialization
  // ==========================================================================

  useEffect(() => {
    async function loadGroup() {
      if (!groupId || !uid) return;

      try {
        setLoading(true);
        setError(null);

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

        const members = await getGroupMembers(groupId);
        setGroupMembers(members);
      } catch (err: any) {
        console.error("Error loading group:", err);
        setError(err.message || "Failed to load group");
      } finally {
        setLoading(false);
      }
    }

    loadGroup();
  }, [groupId, uid, navigation]);

  useEffect(() => {
    if (!groupId || !uid || error) return;

    const unsubscribe = subscribeToGroupMessages(groupId, (messagesData) => {
      setMessages(messagesData);
      setLoading(false);
      updateLastRead(groupId, uid).catch(console.error);
    });

    return () => unsubscribe();
  }, [groupId, uid, error]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        navigation.getParent()?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation]),
  );

  // Load scheduled messages (UNI-09)
  useEffect(() => {
    if (!uid || !groupId) return;
    getScheduledMessagesForChat(uid, groupId)
      .then(setScheduledMessages)
      .catch(console.error);
  }, [uid, groupId]);

  // ==========================================================================
  // Link Previews (H12)
  // ==========================================================================

  useEffect(() => {
    const fetchLinkPreviews = async () => {
      for (const message of messages) {
        if (message.type !== "text") continue;
        if (linkPreviews.has(message.id)) continue;
        if (loadingPreviews.has(message.id)) continue;
        if (!hasUrls(message.content)) continue;

        const urls = extractUrls(message.content);
        if (urls.length === 0) continue;

        setLoadingPreviews((prev) => new Set([...prev, message.id]));

        try {
          const preview = await fetchPreview(urls[0]);
          setLinkPreviews((prev) => new Map(prev).set(message.id, preview));
        } catch {
          setLinkPreviews((prev) => new Map(prev).set(message.id, null));
        } finally {
          setLoadingPreviews((prev) => {
            const newSet = new Set(prev);
            newSet.delete(message.id);
            return newSet;
          });
        }
      }
    };

    fetchLinkPreviews();
  }, [messages, linkPreviews, loadingPreviews]);

  // ==========================================================================
  // Reactions Subscription (H8)
  // ==========================================================================

  useEffect(() => {
    if (!groupId || !uid || messages.length === 0) return;

    const messageIds = messages.slice(0, 50).map((m) => m.id);
    const unsubscribe = subscribeToMultipleMessageReactions(
      "group",
      groupId,
      messageIds,
      uid,
      (reactionsMap) => setMessageReactions(reactionsMap),
    );

    return () => unsubscribe();
  }, [groupId, uid, messages]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleOpenMediaViewer = useCallback(
    (
      attachments: AttachmentV2[],
      index: number,
      senderName: string,
      timestamp: number,
    ) => {
      setViewerAttachments(attachments);
      setViewerInitialIndex(index);
      setViewerSenderName(senderName);
      setViewerTimestamp(new Date(timestamp));
      setMediaViewerVisible(true);
    },
    [],
  );

  const handleMessageLongPress = useCallback((message: GroupMessage) => {
    setSelectedMessage(message);
    setActionsSheetVisible(true);
  }, []);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index !== -1 && messageListRef.current) {
        messageListRef.current.scrollToIndex(index, true);
      }
    },
    [messages],
  );

  const handleReply = useCallback(
    (replyToData: ReplyToMetadata) => {
      screen.chat.setReplyTo(replyToData);
      textInputRef.current?.focus();
    },
    [screen.chat],
  );

  const handleCancelReply = useCallback(() => {
    screen.chat.clearReplyTo();
  }, [screen.chat]);

  const handleMessageEdited = useCallback(
    (messageId: string, newText: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: newText } : m)),
      );
      setSnackbar({ visible: true, message: "Message edited" });
    },
    [],
  );

  const handleMessageDeleted = useCallback(
    (messageId: string, forAll: boolean) => {
      if (forAll) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      setSnackbar({
        visible: true,
        message: forAll ? "Message deleted" : "Message hidden",
      });
    },
    [],
  );

  const handleNavigateToGame = useCallback(
    (gameId: string, gameType: string) => {
      const screenMap: Record<string, string> = {
        tic_tac_toe: "TicTacToeGame",
        checkers: "CheckersGame",
        chess: "ChessGame",
        crazy_eights: "CrazyEightsGame",
      };
      const screen = screenMap[gameType];
      if (screen) {
        // Navigate to Play tab first, then to the specific game screen
        navigation.navigate("Play", {
          screen,
          params: { matchId: gameId, entryPoint: "chat" },
        });
      }
    },
    [navigation],
  );

  // Game button press handler - Opens game picker modal
  const handleGamePress = useCallback(() => {
    setGamePickerVisible(true);
  }, []);

  // Handle single-player game selection - navigate directly to game
  const handleSinglePlayerGame = useCallback(
    (gameType: ExtendedGameType) => {
      const screenName = GAME_SCREEN_MAP[gameType];
      if (screenName) {
        navigation.navigate(screenName as any);
      }
    },
    [navigation],
  );

  // Compute eligible user IDs from group members
  const groupMemberIds = useMemo(
    () => groupMembers.map((m) => m.uid),
    [groupMembers],
  );

  // ==========================================================================
  // Schedule Message (UNI-09)
  // ==========================================================================

  const handleScheduleMessage = useCallback(
    async (scheduledFor: Date) => {
      const text = screen.composer.text.trim();
      if (!uid || !groupId || !text) return;

      const { mentionUids } = extractMentionsExact(text, mentionableMembers);

      try {
        const result = await scheduleMessage({
          senderId: uid,
          chatId: groupId,
          scope: "group",
          content: text,
          type: "text",
          scheduledFor,
          mentionUids: mentionUids.length > 0 ? mentionUids : undefined,
        });

        if (result) {
          screen.composer.clearText();
          setScheduledMessages((prev) => [...prev, result]);
          setScheduleModalVisible(false);
          Alert.alert(
            "Message Scheduled! ⏰",
            `Your message will be sent ${scheduledFor.toLocaleString()}`,
          );
        } else {
          Alert.alert("Error", "Failed to schedule message. Please try again.");
        }
      } catch (error) {
        console.error("[GroupChatScreen] Schedule message error:", error);
        Alert.alert("Error", "Failed to schedule message.");
      }
    },
    [uid, groupId, screen.composer, mentionableMembers],
  );

  // ==========================================================================
  // Send Message (H10)
  // ==========================================================================

  const handleSendMessage = useCallback(async () => {
    const hasText = screen.composer.text.trim().length > 0;
    const hasAttachments = attachmentPicker.attachments.length > 0;

    if (!uid || (!hasText && !hasAttachments) || screen.sending) return;

    const text = screen.composer.text.trim();
    const { mentionUids } = extractMentionsExact(text, mentionableMembers);
    const currentReplyTo = screen.chat.replyTo;

    screen.composer.clearText();

    if (hasText && !hasAttachments) {
      try {
        const result = await screen.chat.sendMessage(text, {
          replyTo: currentReplyTo || undefined,
          mentionUids,
        });
        if (!result.success) {
          setSnackbar({
            visible: true,
            message: result.error || "Failed to send",
          });
          screen.composer.setText(text);
        }
      } catch (error: any) {
        screen.composer.setText(text);
        setSnackbar({
          visible: true,
          message: error.message || "Failed to send",
        });
      }
      return;
    }

    screen.chat.clearReplyTo();

    const replyToData = currentReplyTo
      ? {
          messageId: currentReplyTo.messageId,
          senderId: currentReplyTo.senderId,
          senderName: currentReplyTo.senderName || "Unknown",
          textSnippet: currentReplyTo.textSnippet,
          ...(currentReplyTo.attachmentPreview?.kind && {
            attachmentKind: currentReplyTo.attachmentPreview.kind as
              | "image"
              | "voice",
          }),
        }
      : undefined;

    try {
      if (hasAttachments) {
        const basePath = `groups/${groupId}/attachments`;
        const { successful, failed } =
          await attachmentPicker.uploadAttachments(basePath);

        if (failed.length > 0) {
          console.warn(`${failed.length} attachments failed to upload`);
        }

        for (const attachment of successful) {
          await sendGroupMessage(
            groupId,
            uid,
            attachment.url,
            "image",
            undefined,
            mentionUids,
            undefined,
            replyToData,
          );
        }

        attachmentPicker.clearAttachments();

        if (hasText) {
          await sendGroupMessage(
            groupId,
            uid,
            text,
            "text",
            undefined,
            mentionUids,
            undefined,
            replyToData,
          );
        }
      }
    } catch (error: any) {
      if (hasText) screen.composer.setText(text);
      setSnackbar({
        visible: true,
        message: error.message || "Failed to send",
      });
    }
  }, [
    uid,
    groupId,
    screen.composer,
    screen.chat,
    screen.sending,
    attachmentPicker,
    mentionableMembers,
  ]);

  const handleAddAttachment = useCallback(async () => {
    await attachmentPicker.pickFromGallery();
  }, [attachmentPicker]);

  const handleCaptureFromCamera = useCallback(async () => {
    await attachmentPicker.captureFromCamera();
  }, [attachmentPicker]);

  const handleVoiceRecordingComplete = useCallback(
    async (recording: VoiceRecording) => {
      if (!uid || screen.sending) return;

      try {
        const messageId = `voice_${Date.now()}_${uid}`;
        const result = await uploadVoiceMessage(groupId, messageId, recording);

        if (!result.success || !result.url) {
          throw new Error(result.error || "Voice upload failed");
        }

        await sendGroupMessage(
          groupId,
          uid,
          result.url,
          "voice",
          undefined,
          [],
          {
            durationMs: recording.durationMs,
            storagePath: result.path,
            sizeBytes: result.sizeBytes,
          },
        );
      } catch (error: any) {
        setSnackbar({
          visible: true,
          message: error.message || "Failed to send voice",
        });
      }
    },
    [uid, groupId, screen.sending],
  );

  const loadOlderMessages = useCallback(async () => {
    const now = Date.now();
    if (now - lastLoadOlderTimeRef.current < LOAD_OLDER_DEBOUNCE_MS) return;
    lastLoadOlderTimeRef.current = now;

    if (isLoadingOlder || !hasMoreOlder || !groupId) return;

    try {
      setIsLoadingOlder(true);
      const result = await getGroupMessages(groupId, PAGINATION_PAGE_SIZE);

      if (result.messages.length === 0) {
        setHasMoreOlder(false);
        return;
      }

      if (result.messages.length < PAGINATION_PAGE_SIZE) {
        setHasMoreOlder(false);
      }

      const filteredMessages = uid
        ? result.messages.filter((msg) => !msg.hiddenFor?.includes(uid))
        : result.messages;

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newMessages = filteredMessages.filter(
          (m) => !existingIds.has(m.id),
        );
        return [...prev, ...newMessages];
      });
    } catch (err) {
      console.error("[GroupChatScreen] Error loading older messages:", err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [groupId, isLoadingOlder, hasMoreOlder, uid]);

  // ==========================================================================
  // Message Conversion
  // ==========================================================================

  const selectedMessageAsV2: MessageV2 | null = selectedMessage
    ? {
        id: selectedMessage.id,
        scope: "group",
        conversationId: groupId,
        senderId: selectedMessage.sender,
        senderName: selectedMessage.senderDisplayName,
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
                  path: selectedMessage.imagePath || "",
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

  // ==========================================================================
  // Message Grouping Logic (for inverted FlatList)
  // ==========================================================================

  /**
   * Time threshold for grouping messages (2 minutes in milliseconds)
   * Messages from the same sender within this window are grouped together
   */
  const MESSAGE_GROUP_THRESHOLD_MS = 2 * 60 * 1000;

  /**
   * Helper to check if two messages should be grouped together
   * Messages with replies are ALWAYS standalone and break the chain
   */
  const areMessagesGrouped = useCallback(
    (msg1: GroupMessage | null, msg2: GroupMessage | null): boolean => {
      if (!msg1 || !msg2) return false;
      if (msg1.type === "system" || msg2.type === "system") return false;
      // Reply messages are always standalone - they break the group chain
      if (msg1.replyTo || msg2.replyTo) return false;
      if (msg1.sender !== msg2.sender) return false;
      return (
        Math.abs(msg1.createdAt - msg2.createdAt) < MESSAGE_GROUP_THRESHOLD_MS
      );
    },
    [],
  );

  /**
   * Determines if sender name should be shown (at visual TOP of group)
   *
   * In an inverted list:
   * - index 0 = newest message (visual bottom)
   * - Higher index = older messages (visual top)
   * - messages[index + 1] = message ABOVE visually (older)
   *
   * Show name when this message is the TOP of a visual group
   * (not connected to the message above it)
   */
  const shouldShowSender = useCallback(
    (index: number, message: GroupMessage) => {
      if (message.type === "system") return false;
      // Get message above (older, higher index)
      const messageAbove =
        index < messages.length - 1 ? messages[index + 1] : null;
      // Show name if NOT grouped with message above
      return !areMessagesGrouped(message, messageAbove);
    },
    [messages, areMessagesGrouped],
  );

  /**
   * Determines if timestamp should be shown (at visual BOTTOM of group)
   *
   * Show timestamp when this message is the BOTTOM of a visual group
   * (not connected to the message below it)
   */
  const shouldShowTimestamp = useCallback(
    (index: number, message: GroupMessage) => {
      if (message.type === "system") return false;
      // Get message below (newer, lower index)
      const messageBelow = index > 0 ? messages[index - 1] : null;
      // Show timestamp if NOT grouped with message below
      return !areMessagesGrouped(message, messageBelow);
    },
    [messages, areMessagesGrouped],
  );

  /**
   * Determines if avatar should be shown (at visual BOTTOM of group)
   * Only for received messages - show on bottom message of the visual group
   */
  const shouldShowAvatar = useCallback(
    (index: number, message: GroupMessage) => {
      if (message.type === "system") return false;
      // Get message below (newer, lower index)
      const messageBelow = index > 0 ? messages[index - 1] : null;
      // Show avatar if NOT grouped with message below
      return !areMessagesGrouped(message, messageBelow);
    },
    [messages, areMessagesGrouped],
  );

  /**
   * Determines if this message should have reduced bottom margin
   * A message uses reduced margin if it's connected to the message BELOW it
   * (since marginBottom controls spacing to the next item in the inverted list)
   */
  const isGroupedMessage = useCallback(
    (index: number, message: GroupMessage) => {
      if (message.type === "system") return false;
      // Get message below (newer, lower index) - this is what marginBottom spaces to
      const messageBelow = index > 0 ? messages[index - 1] : null;
      return areMessagesGrouped(message, messageBelow);
    },
    [messages, areMessagesGrouped],
  );

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ==========================================================================
  // Render Message Item
  // ==========================================================================

  const renderMessage = useCallback(
    ({ item, index }: { item: GroupMessage; index: number }) => {
      const isOwnMessage = item.sender === uid;
      const showSender = shouldShowSender(index, item);
      const showTimestamp = shouldShowTimestamp(index, item);
      const showAvatar = shouldShowAvatar(index, item);

      // Determine if this message is part of a group (for reduced spacing)
      const isGrouped = isGroupedMessage(index, item);

      if (item.type === "system") {
        return (
          <View style={styles.systemMessage}>
            <Text
              style={[
                styles.systemMessageText,
                {
                  color: theme.dark ? "#888" : "#666",
                  backgroundColor: theme.dark ? "#1A1A1A" : "#e8e8e8",
                },
              ]}
            >
              {item.content}
            </Text>
          </View>
        );
      }

      const handleImagePress = () => {
        if (item.type === "image") {
          handleOpenMediaViewer(
            [
              {
                id: item.id,
                kind: "image",
                mime: "image/jpeg",
                url: item.content,
                path: item.imagePath || "",
                sizeBytes: 0,
              },
            ],
            0,
            item.senderDisplayName,
            item.createdAt,
          );
        }
      };

      return (
        <SwipeableGroupMessage
          message={item}
          onReply={handleReply}
          enabled={true}
          currentUid={uid}
        >
          <View
            style={[
              styles.messageContainer,
              isOwnMessage && styles.ownMessageContainer,
              isGrouped && styles.groupedMessageContainer,
            ]}
          >
            {item.replyTo && (
              <View
                style={!isOwnMessage ? styles.replyBubbleIndent : undefined}
              >
                <ReplyBubble
                  replyTo={{
                    messageId: item.replyTo.messageId,
                    senderId: item.replyTo.senderId,
                    senderName: item.replyTo.senderName,
                    kind:
                      item.replyTo.attachmentKind === "image"
                        ? "media"
                        : item.replyTo.attachmentKind === "voice"
                          ? "voice"
                          : "text",
                    textSnippet: item.replyTo.textSnippet,
                  }}
                  isSentByMe={isOwnMessage}
                  isReplyToMe={item.replyTo.senderId === uid}
                  onPress={() => scrollToMessage(item.replyTo!.messageId)}
                />
              </View>
            )}

            <View
              style={[
                styles.messageRow,
                isOwnMessage ? styles.ownMessageRow : styles.receivedMessageRow,
              ]}
            >
              {/* Show avatar for received messages - only on last message of group */}
              {!isOwnMessage && (
                <View style={styles.avatarColumn}>
                  {showAvatar ? (
                    <AvatarMini
                      config={
                        item.senderAvatarConfig || { baseColor: "#6200EE" }
                      }
                      size={32}
                    />
                  ) : (
                    <View style={{ width: 32 }} />
                  )}
                </View>
              )}

              <View style={styles.bubbleColumn}>
                {!isOwnMessage && showSender && (
                  <Text
                    style={[styles.senderName, { color: theme.colors.primary }]}
                  >
                    {item.senderDisplayName}
                  </Text>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={item.type === "image" ? handleImagePress : undefined}
                  onLongPress={() => handleMessageLongPress(item)}
                  delayLongPress={300}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isOwnMessage
                        ? [
                            styles.ownMessage,
                            { backgroundColor: theme.colors.primary },
                          ]
                        : [
                            styles.otherMessage,
                            {
                              backgroundColor: theme.dark
                                ? "#1A1A1A"
                                : "#e8e8e8",
                            },
                          ],
                      item.type === "image" && styles.imageOnlyBubble,
                      item.type === "voice" && styles.voiceBubble,
                    ]}
                  >
                    {item.type === "image" ? (
                      <Image
                        source={{ uri: item.content }}
                        style={styles.standaloneImage}
                        resizeMode="cover"
                      />
                    ) : item.type === "voice" ? (
                      <VoiceMessagePlayer
                        url={item.content}
                        durationMs={item.voiceMetadata?.durationMs || 0}
                        isOwn={isOwnMessage}
                      />
                    ) : item.type === "scorecard" && item.scorecard ? (
                      <View style={styles.scorecardContent}>
                        <MaterialCommunityIcons
                          name="gamepad-variant"
                          size={24}
                          color={
                            isOwnMessage
                              ? theme.colors.onPrimary
                              : theme.colors.onSurface
                          }
                        />
                        <Text
                          style={[
                            styles.scorecardGame,
                            {
                              color: isOwnMessage
                                ? theme.colors.onPrimary
                                : theme.colors.onSurface,
                            },
                          ]}
                        >
                          {item.scorecard.gameId === "reaction_tap"
                            ? "Reaction Tap"
                            : "Timed Tap"}
                        </Text>
                        <Text
                          style={[
                            styles.scorecardScore,
                            {
                              color: isOwnMessage
                                ? theme.colors.onPrimary
                                : theme.colors.onSurface,
                            },
                          ]}
                        >
                          {item.scorecard.gameId === "reaction_tap"
                            ? `${item.scorecard.score}ms`
                            : `${item.scorecard.score} taps`}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.messageText,
                            {
                              color: isOwnMessage
                                ? theme.colors.onPrimary
                                : theme.colors.onSurface,
                            },
                          ]}
                        >
                          {item.content}
                        </Text>
                        {hasUrls(item.content) && (
                          <LinkPreviewCard
                            preview={
                              linkPreviews.get(item.id) || {
                                url: extractUrls(item.content)[0] || "",
                                fetchedAt: Date.now(),
                              }
                            }
                            isOwn={isOwnMessage}
                            loading={loadingPreviews.has(item.id)}
                          />
                        )}
                      </>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Only show timestamp on last message of group */}
                {showTimestamp && (
                  <View
                    style={[
                      styles.timestampRow,
                      isOwnMessage
                        ? styles.timestampRowSent
                        : styles.timestampRowReceived,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageTime,
                        { color: theme.dark ? "#666" : "#888" },
                      ]}
                    >
                      {formatTime(item.createdAt)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {(messageReactions.get(item.id) || []).length > 0 && (
              <ReactionsSummary
                reactionsSummary={Object.fromEntries(
                  (messageReactions.get(item.id) || []).map((r) => [
                    r.emoji,
                    r.count,
                  ]),
                )}
                userReactions={(messageReactions.get(item.id) || [])
                  .filter((r) => r.hasReacted)
                  .map((r) => r.emoji)}
                compact
                onPress={() => handleMessageLongPress(item)}
              />
            )}
          </View>
        </SwipeableGroupMessage>
      );
    },
    [
      uid,
      theme,
      shouldShowSender,
      shouldShowTimestamp,
      shouldShowAvatar,
      isGroupedMessage,
      linkPreviews,
      loadingPreviews,
      messageReactions,
      handleReply,
      handleMessageLongPress,
      handleOpenMediaViewer,
      scrollToMessage,
    ],
  );

  // ==========================================================================
  // Loading/Error States
  // ==========================================================================

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.dark ? "#000" : theme.colors.background },
        ]}
        edges={[]}
      >
        <Appbar.Header
          style={[
            styles.header,
            { backgroundColor: theme.dark ? "#000" : theme.colors.background },
          ]}
        >
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={initialGroupName || "Group Chat"} />
        </Appbar.Header>
        <LoadingState message="Loading messages..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.dark ? "#000" : theme.colors.background },
        ]}
        edges={[]}
      >
        <Appbar.Header
          style={[
            styles.header,
            { backgroundColor: theme.dark ? "#000" : theme.colors.background },
          ]}
        >
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

  // ==========================================================================
  // Main Render
  // ==========================================================================

  return (
    <>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.dark ? "#000" : theme.colors.background },
        ]}
      >
        <Appbar.Header
          style={[
            styles.header,
            { backgroundColor: theme.dark ? "#000" : theme.colors.background },
          ]}
        >
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
              <Text
                style={[
                  styles.headerTitleText,
                  { color: theme.colors.onSurface },
                ]}
              >
                {group?.name}
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: theme.dark ? "#888" : "#666" },
                ]}
              >
                {group?.memberCount} members
              </Text>
            </View>
          </TouchableOpacity>
          <Appbar.Action
            icon="information-outline"
            onPress={() => navigation.navigate("GroupChatInfo", { groupId })}
          />
        </Appbar.Header>

        {/* Game Invites Section */}
        {groupId && uid && (
          <ChatGameInvites
            conversationId={groupId}
            currentUserId={uid}
            currentUserName={
              currentFirebaseUser?.displayName ||
              currentFirebaseUser?.email ||
              "User"
            }
            onNavigateToGame={handleNavigateToGame}
            compact
          />
        )}

        <ChatMessageList
          ref={messageListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          listBottomInset={screen.keyboard.listBottomInset}
          staticBottomInset={60 + insets.bottom + 16}
          isKeyboardOpen={screen.keyboard.isKeyboardOpen}
          ListHeaderComponent={
            isLoadingOlder ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="chat-outline"
              title="No Messages Yet"
              subtitle="Be the first to send a message!"
            />
          }
          flatListProps={{
            onEndReached: loadOlderMessages,
            onEndReachedThreshold: 0.3,
          }}
        />

        <ChatComposer
          scope="group"
          value={screen.composer.text}
          onChangeText={screen.composer.setText}
          onSend={handleSendMessage}
          sendDisabled={
            (!screen.composer.text.trim() &&
              attachmentPicker.attachments.length === 0) ||
            screen.sending ||
            attachmentPicker.isUploading
          }
          isSending={screen.sending || attachmentPicker.isUploading}
          placeholder="Message..."
          leftAccessory={
            <CameraLongPressButton
              onShortPress={handleCaptureFromCamera}
              onLongPress={handleAddAttachment}
              disabled={screen.sending || attachmentPicker.isMaxReached}
              size={40}
            />
          }
          headerContent={
            attachmentPicker.attachments.length > 0 ? (
              <AttachmentTray
                attachments={attachmentPicker.attachments}
                uploadProgress={attachmentPicker.uploadProgress}
                onRemove={attachmentPicker.removeAttachment}
                onAdd={handleAddAttachment}
                maxAttachments={10}
              />
            ) : null
          }
          mentionAutocomplete={
            <MentionAutocomplete
              visible={screen.composer.mentions?.isVisible || false}
              suggestions={screen.composer.mentions?.suggestions || []}
              query={screen.composer.mentions?.query || ""}
              onSelect={(member) => screen.composer.insertMention(member)}
              onDismiss={() => screen.composer.mentions?.onDismiss()}
              bottomOffset={8}
            />
          }
          voiceButtonComponent={
            voiceRecorder.isAvailable &&
            !screen.composer.text.trim() &&
            attachmentPicker.attachments.length === 0 ? (
              <VoiceRecordButton
                onRecordingComplete={handleVoiceRecordingComplete}
                onRecordingCancelled={() => {}}
                disabled={screen.sending}
                size={32}
                maxDuration={60000}
              />
            ) : undefined
          }
          additionalRightAccessory={
            screen.composer.text.trim() ? (
              <IconButton
                icon="clock-outline"
                size={22}
                onPress={() => setScheduleModalVisible(true)}
                disabled={screen.sending || attachmentPicker.isUploading}
                style={styles.scheduleButton}
              />
            ) : null
          }
          replyTo={screen.chat.replyTo}
          onCancelReply={handleCancelReply}
          currentUid={uid}
          onGamePress={handleGamePress}
          keyboardHeight={screen.keyboard.keyboardHeight}
          safeAreaBottom={insets.bottom}
          textInputRef={textInputRef}
        />
      </View>

      <MediaViewerModal
        visible={mediaViewerVisible}
        attachments={viewerAttachments}
        initialIndex={viewerInitialIndex}
        onClose={() => setMediaViewerVisible(false)}
        senderName={viewerSenderName}
        timestamp={viewerTimestamp}
      />

      <MessageActionsSheet
        visible={actionsSheetVisible}
        message={selectedMessageAsV2}
        currentUid={uid || ""}
        userRole={userRole}
        onClose={() => setActionsSheetVisible(false)}
        onReply={handleReply}
        onEdited={handleMessageEdited}
        onDeleted={handleMessageDeleted}
        onReactionAdded={() => {}}
      />

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbar.message}
      </Snackbar>

      <ScheduleMessageModal
        visible={scheduleModalVisible}
        messagePreview={screen.composer.text}
        onSchedule={handleScheduleMessage}
        onClose={() => setScheduleModalVisible(false)}
      />

      <GamePickerModal
        visible={gamePickerVisible}
        onDismiss={() => setGamePickerVisible(false)}
        context="group"
        conversationId={groupId}
        conversationName={group?.name}
        eligibleUserIds={groupMemberIds}
        onSinglePlayerGame={handleSinglePlayerGame}
        onInviteCreated={() => {}}
        onError={(error) => Alert.alert("Error", error)}
      />
    </>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {},
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
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleText: { fontSize: 16, fontWeight: "600" },
  headerSubtitle: { fontSize: 12 },
  messageContainer: { marginBottom: 12, width: "100%" },
  groupedMessageContainer: { marginBottom: 3 }, // Reduced spacing for grouped messages
  ownMessageContainer: {},
  replyBubbleIndent: { marginLeft: 40 }, // 32px avatar + 8px margin
  messageRow: { maxWidth: "80%", flexDirection: "row", alignItems: "flex-end" },
  ownMessageRow: { alignSelf: "flex-end" },
  receivedMessageRow: { alignSelf: "flex-start" },
  avatarColumn: {
    marginRight: 8,
    marginBottom: 4,
  },
  bubbleColumn: { flexDirection: "column", flexShrink: 1 },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: { padding: 12, borderRadius: 16 },
  ownMessage: { borderBottomRightRadius: 4 },
  otherMessage: { borderBottomLeftRadius: 4 },
  imageOnlyBubble: {
    padding: 0,
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  voiceBubble: { padding: 8 },
  messageText: { fontSize: 15, lineHeight: 20 },
  standaloneImage: { width: 200, height: 200, borderRadius: 16 },
  scorecardContent: { alignItems: "center", padding: 8 },
  scorecardGame: { fontSize: 12, marginTop: 4 },
  scorecardScore: { fontSize: 18, fontWeight: "bold", marginTop: 2 },
  messageTime: { fontSize: 10 },
  timestampRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timestampRowSent: { alignSelf: "flex-end", marginRight: 4 },
  timestampRowReceived: { alignSelf: "flex-start", marginLeft: 4 },
  systemMessage: { alignItems: "center", marginVertical: 12 },
  systemMessageText: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  loadMoreContainer: {
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 8,
  },
  snackbar: {},
  scheduleButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
});
