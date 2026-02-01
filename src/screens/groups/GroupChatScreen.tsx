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
 * Enhanced Features:
 * - Message highlight animation when navigating to replied messages
 * - Jump-back button after scrolling to a reply target
 *
 * @module screens/groups/GroupChatScreen
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  MessageHighlightOverlay,
  ReactionsSummary,
  ReplyBubble,
  ScrollReturnButton,
  SwipeableMessage,
  VoiceMessagePlayer,
  VoiceRecordButton,
} from "@/components/chat";
import type { ChatMessageListRef } from "@/components/chat/ChatMessageList";
import { ChatSkeleton } from "@/components/chat/ChatSkeleton";
import ScheduleMessageModal from "@/components/ScheduleMessageModal";
import { EmptyState, ErrorState } from "@/components/ui";

// Services
import {
  getGroup,
  getGroupMembers,
  isGroupMember,
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
import { Group, GroupMember, ScheduledMessage } from "@/types/models";
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
  // Screen State (No message state - uses unified hook)
  // ==========================================================================

  const [group, setGroup] = useState<Group | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
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
  const [selectedMessage, setSelectedMessage] = useState<MessageV2 | null>(
    null,
  );
  const [userRole, setUserRole] = useState<
    "owner" | "admin" | "moderator" | "member"
  >("member");

  // Reactions state (H8)
  const [messageReactions, setMessageReactions] = useState<
    Map<string, ReactionSummary[]>
  >(new Map());

  // Scheduled messages state (UNI-09)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [gamePickerVisible, setGamePickerVisible] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<
    ScheduledMessage[]
  >([]);

  // Reply navigation state (highlight + jump-back)
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [showReturnButton, setShowReturnButton] = useState(false);
  const returnIndexRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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

  // Messages come directly from the unified hook (SQLite-backed)
  const messages = screen.messages;

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
  // Initialization (Group metadata only - messages via unified hook)
  // ==========================================================================

  useEffect(() => {
    async function loadGroup() {
      if (!groupId || !uid) return;

      try {
        setGroupLoading(true);
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
        setGroupLoading(false);
      }
    }

    loadGroup();
  }, [groupId, uid, navigation]);

  // Update last read when messages change
  useEffect(() => {
    if (groupId && uid && messages.length > 0) {
      updateLastRead(groupId, uid).catch(console.error);
    }
  }, [groupId, uid, messages.length]);

  // NOTE: Tab bar visibility is now handled at the navigator level
  // in RootNavigator.tsx using getFocusedRouteNameFromRoute.
  // This eliminates flicker during navigation transitions.

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
        if (message.kind !== "text") continue;
        if (!message.text) continue;
        if (linkPreviews.has(message.id)) continue;
        if (loadingPreviews.has(message.id)) continue;
        if (!hasUrls(message.text)) continue;

        const urls = extractUrls(message.text);
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

  const handleMessageLongPress = useCallback((message: MessageV2) => {
    setSelectedMessage(message);
    setActionsSheetVisible(true);
  }, []);

  // Enhanced scroll-to-message with highlight animation
  const scrollToMessage = useCallback(
    (messageId: string) => {
      const targetIndex = messages.findIndex((m) => m.id === messageId);
      if (targetIndex === -1 || !messageListRef.current) return;

      // Clear any existing highlight timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      // Store current position for return navigation
      returnIndexRef.current = 0;
      setShowReturnButton(true);

      // Scroll to target message
      messageListRef.current.scrollToIndex(targetIndex, true);

      // Highlight the target message after scroll settles
      setTimeout(() => {
        setHighlightedMessageId(messageId);

        // Auto-clear highlight after animation
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedMessageId(null);
        }, 2100);
      }, 300);
    },
    [messages],
  );

  // Handle return button press
  const handleReturnToReply = useCallback(() => {
    if (returnIndexRef.current !== null && messageListRef.current) {
      messageListRef.current.scrollToIndex(returnIndexRef.current, true);
    }
    setShowReturnButton(false);
    returnIndexRef.current = null;
  }, []);

  // Auto-hide return button callback
  const handleReturnButtonAutoHide = useCallback(() => {
    setShowReturnButton(false);
    returnIndexRef.current = null;
  }, []);

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
    (_messageId: string, _newText: string) => {
      // Messages auto-refresh from SQLite via unified hook
      setSnackbar({ visible: true, message: "Message edited" });
    },
    [],
  );

  const handleMessageDeleted = useCallback(
    (_messageId: string, forAll: boolean) => {
      // Messages auto-refresh from SQLite via unified hook
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

    try {
      if (hasAttachments) {
        // Get local attachments before clearing
        const localAttachments = [...attachmentPicker.attachments];
        attachmentPicker.clearAttachments();

        // Send each attachment as a media message with local URI
        // The sync engine will handle uploading
        for (const attachment of localAttachments) {
          await screen.chat.sendMessage("", {
            replyTo: currentReplyTo || undefined,
            mentionUids,
            kind: "media",
            attachments: [
              {
                id: attachment.id,
                uri: attachment.uri,
                kind: attachment.kind,
                mime: attachment.mime || "image/jpeg",
              },
            ],
          });
        }

        // Send text if present (separate message)
        if (hasText) {
          await screen.chat.sendMessage(text, {
            replyTo: currentReplyTo || undefined,
            mentionUids,
          });
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
        // Send voice message via unified path
        await screen.chat.sendMessage("", {
          kind: "voice",
          attachments: [
            {
              id: `voice_${Date.now()}_${uid}`,
              uri: recording.uri,
              kind: "audio",
              mime: "audio/m4a",
              durationMs: recording.durationMs,
            },
          ],
        });
      } catch (error: any) {
        setSnackbar({
          visible: true,
          message: error.message || "Failed to send voice",
        });
      }
    },
    [uid, screen.chat, screen.sending],
  );

  // ==========================================================================
  // Message Grouping Logic (for inverted FlatList with MessageV2)
  // ==========================================================================

  const MESSAGE_GROUP_THRESHOLD_MS = 2 * 60 * 1000;

  const areMessagesGrouped = useCallback(
    (msg1: MessageV2 | null, msg2: MessageV2 | null): boolean => {
      if (!msg1 || !msg2) return false;
      if (msg1.kind === "system" || msg2.kind === "system") return false;
      if (msg1.replyTo || msg2.replyTo) return false;
      if (msg1.senderId !== msg2.senderId) return false;
      return (
        Math.abs(msg1.createdAt - msg2.createdAt) < MESSAGE_GROUP_THRESHOLD_MS
      );
    },
    [],
  );

  const shouldShowSender = useCallback(
    (index: number, message: MessageV2) => {
      if (message.kind === "system") return false;
      const messageAbove =
        index < messages.length - 1 ? messages[index + 1] : null;
      return !areMessagesGrouped(message, messageAbove);
    },
    [messages, areMessagesGrouped],
  );

  const shouldShowTimestamp = useCallback(
    (index: number, message: MessageV2) => {
      if (message.kind === "system") return false;
      const messageBelow = index > 0 ? messages[index - 1] : null;
      return !areMessagesGrouped(message, messageBelow);
    },
    [messages, areMessagesGrouped],
  );

  const shouldShowAvatar = useCallback(
    (index: number, message: MessageV2) => {
      if (message.kind === "system") return false;
      const messageBelow = index > 0 ? messages[index - 1] : null;
      return !areMessagesGrouped(message, messageBelow);
    },
    [messages, areMessagesGrouped],
  );

  const isGroupedMessage = useCallback(
    (index: number, message: MessageV2) => {
      if (message.kind === "system") return false;
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
  // Get sender info from group members
  // ==========================================================================

  const getSenderAvatarConfig = useCallback(
    (senderId: string) => {
      const member = groupMembers.find((m) => m.uid === senderId);
      return member?.avatarConfig || { baseColor: "#6200EE" };
    },
    [groupMembers],
  );

  const getSenderDisplayName = useCallback(
    (message: MessageV2) => {
      if (message.senderName) return message.senderName;
      const member = groupMembers.find((m) => m.uid === message.senderId);
      return member?.displayName || member?.username || "Unknown";
    },
    [groupMembers],
  );

  // ==========================================================================
  // Render Message Item (MessageV2)
  // ==========================================================================

  const renderMessage = useCallback(
    ({ item, index }: { item: MessageV2; index: number }) => {
      const isOwnMessage = item.senderId === uid;
      const showSender = shouldShowSender(index, item);
      const showTimestamp = shouldShowTimestamp(index, item);
      const showAvatar = shouldShowAvatar(index, item);
      const isGrouped = isGroupedMessage(index, item);
      const senderDisplayName = getSenderDisplayName(item);
      const senderAvatarConfig = getSenderAvatarConfig(item.senderId);

      if (item.kind === "system") {
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
              {item.text}
            </Text>
          </View>
        );
      }

      // Get image attachment if present
      const imageAttachment = item.attachments?.find((a) => a.kind === "image");
      const voiceAttachment = item.attachments?.find((a) => a.kind === "audio");

      const handleImagePress = () => {
        if (item.kind === "media" && imageAttachment) {
          handleOpenMediaViewer(
            [imageAttachment],
            0,
            senderDisplayName,
            item.createdAt,
          );
        }
      };

      return (
        <SwipeableMessage
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
            {/* Highlight overlay for reply navigation */}
            <MessageHighlightOverlay
              isHighlighted={item.id === highlightedMessageId}
            />

            {item.replyTo && (
              <View
                style={!isOwnMessage ? styles.replyBubbleIndent : undefined}
              >
                <ReplyBubble
                  replyTo={item.replyTo}
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
                      config={senderAvatarConfig || { baseColor: "#6200EE" }}
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
                    {senderDisplayName}
                  </Text>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={item.kind === "media" ? handleImagePress : undefined}
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
                      item.kind === "media" && styles.imageOnlyBubble,
                      item.kind === "voice" && styles.voiceBubble,
                    ]}
                  >
                    {item.kind === "media" && imageAttachment ? (
                      <Image
                        source={{ uri: imageAttachment.url }}
                        style={styles.standaloneImage}
                        resizeMode="cover"
                      />
                    ) : item.kind === "voice" && voiceAttachment ? (
                      <VoiceMessagePlayer
                        url={voiceAttachment.url}
                        durationMs={voiceAttachment.durationMs || 0}
                        isOwn={isOwnMessage}
                      />
                    ) : item.kind === "scorecard" && item.scorecard ? (
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
                          {item.text}
                        </Text>
                        {hasUrls(item.text || "") && (
                          <LinkPreviewCard
                            preview={
                              linkPreviews.get(item.id) || {
                                url: extractUrls(item.text || "")[0] || "",
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
        </SwipeableMessage>
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

  // OPTIMIZATION: Show skeleton instead of full-screen loading
  // Shell (header, composer) renders immediately to prevent flicker
  const showSkeleton = groupLoading || screen.loading;

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

        {/* Game Invites Section - only show when ready */}
        {groupId && uid && !showSkeleton && (
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

        {/* OPTIMIZATION: Show skeleton during loading, messages when ready */}
        {showSkeleton ? (
          <ChatSkeleton bubbleCount={8} />
        ) : (
          <ChatMessageList
            ref={messageListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            listBottomInset={screen.keyboard.listBottomInset}
            staticBottomInset={60 + insets.bottom + 16}
            isKeyboardOpen={screen.keyboard.isKeyboardOpen}
            ListHeaderComponent={
              screen.chat.pagination.isLoadingOlder ? (
                <View style={styles.loadMoreContainer}>
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />
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
              onEndReached: screen.chat.loadOlder,
              onEndReachedThreshold: 0.3,
            }}
          />
        )}

        <ChatComposer
          scope="group"
          value={screen.composer.text}
          onChangeText={screen.composer.setText}
          onSend={handleSendMessage}
          hasAttachments={attachmentPicker.attachments.length > 0}
          sendDisabled={
            showSkeleton ||
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
          absolutePosition={true}
        />

        {/* Jump-back button for reply navigation */}
        <ScrollReturnButton
          visible={showReturnButton}
          onPress={handleReturnToReply}
          onAutoHide={handleReturnButtonAutoHide}
          autoHideDelay={5000}
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
        message={selectedMessage}
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
