/**
 * ChatScreen (DM) - Refactored (UNI-05)
 *
 * This screen handles direct message conversations between two users.
 * Refactored to use unified abstractions achieving ~400 lines from ~1,700.
 *
 * Extractions Made:
 * - useAttachmentPicker: Camera capture + gallery attachment management
 * - DMMessageItem: Message rendering component
 * - messageAdapters: V1↔V2 message conversion utilities
 *
 * Enhanced Features:
 * - In-app camera captures send directly to chat (via handleDirectCameraSend)
 * - Gallery picks queue in AttachmentTray for multi-image sends
 * - DM streak tracking preserved on camera sends
 * - Message highlight animation when navigating to replied messages
 * - Jump-back button after scrolling to a reply target
 */

import { usePrefetchChatImages } from "@/utils/imagePrefetch";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { IconButton, Menu, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Auth & notifications
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useUser } from "@/store/UserContext";

// Unified chat hooks (UNI-04, UNI-05)
import { useAttachmentPicker } from "@/hooks/useAttachmentPicker";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { usePresence } from "@/hooks/usePresence";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useUnifiedChatScreen } from "@/hooks/useUnifiedChatScreen";
import { useVoiceRecorder, VoiceRecording } from "@/hooks/useVoiceRecorder";

// Services
import {
  applyOptimisticReaction,
  ReactionSummary,
  subscribeToMultipleMessageReactions,
  toggleReaction,
} from "@/services/reactions";
import { updateStreakAfterMessage } from "@/services/streakCosmetics";

// Chat components
import {
  AttachmentTray,
  ChatComposer,
  ChatMessageList,
  MediaViewerModal,
  MessageActionsSheet,
  TypingIndicator,
} from "@/components/chat";
import { CameraLongPressButton } from "@/components/chat/CameraLongPressButton";
import type { ChatMessageListRef } from "@/components/chat/ChatMessageList";
import { ChatSkeleton } from "@/components/chat/ChatSkeleton";
import { NetworkBanner } from "@/components/chat/NetworkBanner";
import { ScrollReturnButton } from "@/components/chat/ScrollReturnButton";
import { VoiceRecordButton } from "@/components/chat/VoiceRecordButton";

// UI components
import BlockUserModal from "@/components/BlockUserModal";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { DMMessageItem, MessageWithProfile } from "@/components/DMMessageItem";
import ReportUserModal from "@/components/ReportUserModal";
import ScheduleMessageModal from "@/components/ScheduleMessageModal";
import { GamePickerModal } from "@/gamesV4/components/GamePickerModal";
import { PinnedInviteBar } from "@/gamesV4/components/PinnedInviteBar";
import { createGameInvite } from "@/gamesV4/services/gameServiceV4";
import type { GameId } from "@/gamesV4/types";

// Services
import { blockUser } from "@/services/blocking";
import { getOrCreateChat } from "@/services/chat";
import { getUserProfileByUid } from "@/services/friends";
import { retryMessage } from "@/services/messaging";
import { submitReport } from "@/services/reporting";
import {
  getScheduledMessagesForChat,
  scheduleMessage,
} from "@/services/scheduledMessages";
import { markConversationNotificationsRead } from "@/services/userNotifications";

// Call buttons
import { DirectCallButton } from "@/components/stream";

// Types & Utils
import { DEBUG_CHAT_V2, GAMES_V4_ENABLED } from "@/constants/featureFlags";
import { Spacing } from "@/constants/theme";
import { buildSenderStyle } from "@/cosmetics/chatAppearanceResolver";
import { useAnimalEntitlement } from "@/hooks/useAnimalEntitlement";
import { playAnimalSound } from "@/services/chat/animalSoundService";
import type { AttachmentV2, ReplyToMetadata } from "@/types/messaging";
import type { ReportReason, ScheduledMessage } from "@/types/models";
import {
  messageV2ToWithProfile,
  messageWithProfileToV2,
} from "@/utils/messageAdapters";
import * as Haptics from "expo-haptics";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/chat/ChatScreen");

/** Trigger haptic feedback with Android-safe fallback */
function triggerHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "android") {
    // Android may not support all impact styles; use selectionAsync as fallback
    Haptics.selectionAsync().catch(() => {});
  } else {
    Haptics.impactAsync(style).catch(() => {});
  }
}
// ==========================================================================
// Constants
// ==========================================================================

const DEBUG_CHAT = DEBUG_CHAT_V2;

/** Messages within this window from the same sender are visually grouped */
const MESSAGE_GROUP_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/** Stable no-op callback to avoid re-renders from inline arrow functions */
const NOOP = () => {};

// ==========================================================================
// Types
// ==========================================================================

interface InitialChatData {
  chatId?: string;
  friendName?: string;
  friendAvatar?: string | null;
  friendAvatarConfig?: any;
}

interface ChatScreenParams {
  friendUid: string;
  initialData?: InitialChatData;
}

// ==========================================================================
// ChatScreen Component
// ==========================================================================

export default function ChatScreen({
  route,
  navigation,
}: NativeStackScreenProps<any, "ChatDetail">) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const { setCurrentChatId } = useInAppNotifications();
  const { profile, refreshProfile } = useUser();
  const uid = currentFirebaseUser?.uid;
  const chatAppearance = profile?.chatAppearance ?? null;

  // Animal entitlement gating
  const animalEntitlement = useAnimalEntitlement(uid, chatAppearance);

  // Build sender style snapshot for stamping on outgoing messages
  const senderStyle = useMemo(
    () => buildSenderStyle(chatAppearance),
    [chatAppearance],
  );

  // OPTIMIZATION: Extract initial data passed from inbox for instant display
  const { friendUid, initialData } = route.params as ChatScreenParams;

  // ==========================================================================
  // Screen State
  // ==========================================================================

  // OPTIMIZATION: Initialize with cached data to prevent flicker
  const [chatId, setChatId] = useState<string | null>(
    initialData?.chatId || null,
  );
  const [friendProfile, setFriendProfile] = useState<any>(
    initialData
      ? {
          username: initialData.friendName,
          avatar: initialData.friendAvatar,
          avatarConfig: initialData.friendAvatarConfig,
        }
      : null,
  );
  const messageListRef = React.useRef<ChatMessageListRef>(null);

  // Modal state
  const [menuVisible, setMenuVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [animalPickerVisible, setAnimalPickerVisible] = useState(false);

  // Games V4 state
  const [gamePickerVisible, setGamePickerVisible] = useState(false);

  // Message actions state
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] =
    useState<MessageWithProfile | null>(null);

  // Media viewer state
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [viewerAttachments, setViewerAttachments] = useState<AttachmentV2[]>(
    [],
  );
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [viewerSenderName, setViewerSenderName] = useState<
    string | undefined
  >();
  const [viewerTimestamp, setViewerTimestamp] = useState<Date | undefined>();

  // Scheduled messages
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

  // Cleanup highlight timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // ==========================================================================
  // Unified Hooks (UNI-04, UNI-05)
  // ==========================================================================

  // Read receipts also drive whether the shared chat hook should publish
  // public DM read watermarks in local-first mode.
  const readReceipts = useReadReceipts({
    chatId: chatId || "",
    currentUid: uid || "",
    otherUid: friendUid,
    debug: DEBUG_CHAT,
  });

  const screen = useUnifiedChatScreen({
    scope: "dm",
    conversationId: chatId || "",
    currentUid: uid || "",
    currentUserName:
      currentFirebaseUser?.displayName || currentFirebaseUser?.email || "User",
    enableVoice: true,
    enableAttachments: true,
    enableMentions: false,
    enableScheduledMessages: true,
    onSchedulePress: () => setScheduleModalVisible(true),
    sendReadReceipts: readReceipts.shouldSendReadReceipts,
    senderStyle,
    debug: DEBUG_CHAT,
  });

  // Warm image cache for recent chat images
  usePrefetchChatImages(screen.messages?.slice(0, 20));

  // ==========================================================================
  // Camera & attachment actions are handled through unified chat screen hooks.
  // ==========================================================================

  /** Streak milestone messages for DM photo celebrations */
  const MILESTONE_MESSAGES: Record<number, string> = useMemo(
    () => ({
      3: "🔥 3-day streak! You're on fire!\n\nUnlocked: Flame Cap 🔥",
      7: "🔥 1 week streak! Amazing!\n\nUnlocked: Cool Shades 😎",
      14: "🔥 2 week streak! Incredible!\n\nUnlocked: Gradient Glow ✨",
      30: "🔥 30-day streak! One month!\n\nUnlocked: Golden Crown 👑",
      50: "🔥 50-day streak! Legendary!\n\nUnlocked: Star Glasses 🤩",
      100: "💯 100-day streak! Champion!\n\nUnlocked: Rainbow Burst 🌈",
      365: "🏆 365-day streak! One year!\n\nUnlocked: Legendary Halo 😇",
    }),
    [],
  );

  // Send an in-app camera capture directly as a media message (skip tray).
  const handleDirectCameraSend = useCallback(
    async (imageUri: string) => {
      if (!uid || !chatId || screen.sending) return;
      try {
        const id = `cam_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await screen.chat.sendMessage("", {
          kind: "media",
          attachments: [
            {
              id,
              uri: imageUri,
              kind: "image",
              mime: "image/jpeg",
            },
          ],
        });

        // Update DM streak after successful camera send
        try {
          const { newCount, milestoneReached } = await updateStreakAfterMessage(
            uid,
            friendUid,
          );
          if (milestoneReached) {
            const message =
              MILESTONE_MESSAGES[milestoneReached] ||
              `🎉 ${milestoneReached}-day streak milestone!`;
            Alert.alert("Streak Milestone! 🎉", message);
          }
        } catch (streakErr) {
          logger.error("❌ [ChatScreen] Streak update failed:", streakErr);
        }
      } catch (error: any) {
        logger.error("❌ [ChatScreen] Camera send error:", error);
        Alert.alert("Error", error.message || "Failed to send photo");
      }
    },
    [uid, chatId, friendUid, screen.chat, screen.sending, MILESTONE_MESSAGES],
  );

  // Send gallery-selected images directly as media messages (skip tray).
  const handleDirectGallerySend = useCallback(
    async (imageUris: string[]) => {
      if (!uid || !chatId || screen.sending) return;
      for (const uri of imageUris) {
        try {
          const id = `gal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          await screen.chat.sendMessage("", {
            kind: "media",
            attachments: [{ id, uri, kind: "image", mime: "image/jpeg" }],
          });
        } catch (error: any) {
          logger.error("❌ [ChatScreen] Gallery send error:", error);
          Alert.alert("Error", error.message || "Failed to send photo");
        }
      }

      // Update DM streak once after all images sent
      try {
        const { milestoneReached } = await updateStreakAfterMessage(
          uid,
          friendUid,
        );
        if (milestoneReached) {
          const message =
            MILESTONE_MESSAGES[milestoneReached] ||
            `🎉 ${milestoneReached}-day streak milestone!`;
          Alert.alert("Streak Milestone! 🎉", message);
        }
      } catch (streakErr) {
        logger.error("❌ [ChatScreen] Streak update failed:", streakErr);
      }
    },
    [uid, chatId, friendUid, screen.chat, screen.sending, MILESTONE_MESSAGES],
  );

  const attachmentPicker = useAttachmentPicker({
    maxAttachments: 10,
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: ["image"],
    routeParams: route.params as Record<string, any>,
    returnRoute: "ChatDetail",
    returnData: { friendUid, chatId },
    onCameraCapture: handleDirectCameraSend,
    onGalleryPick: handleDirectGallerySend,
  });

  // Typing indicator
  const typing = useTypingStatus({
    scope: "dm",
    conversationId: chatId || "",
    currentUid: uid || "",
    otherUid: friendUid,
    debug: DEBUG_CHAT,
  });

  // Presence (online status, last seen)
  const presence = usePresence({
    userId: friendUid,
    currentUserId: uid,
    debug: DEBUG_CHAT,
  });

  // Connectivity state for network banner + offline UX
  const networkStatus = useNetworkStatus();

  // Voice recorder
  const voiceRecorder = useVoiceRecorder({
    maxDuration: 60,
    onRecordingComplete: NOOP,
  });

  // ==========================================================================
  // Derived State
  // ==========================================================================

  const displayMessages: MessageWithProfile[] = useMemo(
    () =>
      chatId
        ? screen.messages.map((msg) => {
            const converted = messageV2ToWithProfile(
              msg,
              friendUid,
              friendProfile,
            );
            // Apply read receipt status for messages sent by current user
            if (msg.senderId === uid && converted.serverReceivedAt) {
              // Exclude "read" from status check since getMessageStatus will determine it
              const baseStatus =
                converted.status !== "read" ? converted.status : "delivered";
              converted.status = readReceipts.getMessageStatus(
                converted.serverReceivedAt,
                baseStatus,
              );
            }
            return converted;
          })
        : [],
    [chatId, screen.messages, friendUid, friendProfile, uid, readReceipts],
  );

  const selectedMessageAsV2 = useMemo(
    () => messageWithProfileToV2(selectedMessage, chatId, uid, friendProfile),
    [selectedMessage, chatId, uid, friendProfile],
  );

  // ==========================================================================
  // Reactions Subscription (H8) — with optimistic updates
  // ==========================================================================

  const [messageReactions, setMessageReactions] = useState<
    Map<string, ReactionSummary[]>
  >(new Map());

  // Track message IDs that have been optimistically reacted to (for subscriptions)
  const optimisticIds = React.useRef<Set<string>>(new Set());

  /**
   * Optimistic reaction toggle — mutates local state immediately.
   * Called from ReactionPills (pill tap) and MessageActionsSheet (quick reaction).
   */
  const handleOptimisticReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!uid) return;
      optimisticIds.current.add(messageId);
      setMessageReactions((prev) => {
        const next = new Map(prev);
        const current = next.get(messageId) || [];
        next.set(messageId, applyOptimisticReaction(current, emoji, uid));
        return next;
      });
    },
    [uid],
  );

  /**
   * Handle reaction from MessageActionsSheet — apply optimistic + fire server call
   */
  const handleSheetReaction = useCallback(
    (emoji: string) => {
      if (!selectedMessage || !chatId || !uid) return;
      const messageId = selectedMessage.id;
      handleOptimisticReaction(messageId, emoji);

      // Fire-and-forget server call; listener will reconcile
      toggleReaction({
        scope: "dm",
        conversationId: chatId,
        messageId,
        emoji,
        uid,
      })
        .then((result) => {
          if (!result.success) {
            // Rollback
            handleOptimisticReaction(messageId, emoji);
          }
        })
        .catch(() => {
          handleOptimisticReaction(messageId, emoji);
        });
    },
    [selectedMessage, chatId, uid, handleOptimisticReaction],
  );

  useEffect(() => {
    if (!chatId || !uid || displayMessages.length === 0) return;

    // Subscribe to messages that have reactionsSummary OR were optimistically reacted to
    const idsWithReactions = new Set<string>();
    for (const m of displayMessages) {
      if (m.reactionsSummary && Object.keys(m.reactionsSummary).length > 0) {
        idsWithReactions.add(m.id);
      }
    }
    for (const id of optimisticIds.current) {
      idsWithReactions.add(id);
    }

    if (idsWithReactions.size === 0) {
      setMessageReactions(new Map());
      return;
    }

    const unsubscribe = subscribeToMultipleMessageReactions(
      "dm",
      chatId,
      Array.from(idsWithReactions),
      (reactionsMap) => setMessageReactions(reactionsMap),
    );

    return unsubscribe;
    // Re-subscribe when the set of message-ids-with-reactions changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, uid, displayMessages.map((m) => m.id).join(",")]);

  // ==========================================================================
  // Message Grouping Logic (for inverted FlatList)
  // ==========================================================================

  const areMessagesGrouped = useCallback(
    (
      msg1: MessageWithProfile | null,
      msg2: MessageWithProfile | null,
    ): boolean => {
      if (!msg1 || !msg2) return false;
      if (msg1.replyTo || msg2.replyTo) return false;
      if (msg1.sender !== msg2.sender) return false;
      const time1 =
        msg1.createdAt instanceof Date
          ? msg1.createdAt.getTime()
          : msg1.createdAt;
      const time2 =
        msg2.createdAt instanceof Date
          ? msg2.createdAt.getTime()
          : msg2.createdAt;
      return Math.abs(time1 - time2) < MESSAGE_GROUP_THRESHOLD_MS;
    },
    [],
  );

  /** In an inverted list, index 0 = newest (bottom). The message "below" visually is index - 1. */
  const shouldShowTimestamp = useCallback(
    (index: number, message: MessageWithProfile): boolean => {
      // Always show timestamp on the last message in a group (visually bottom-most)
      const messageBelow = index > 0 ? displayMessages[index - 1] : null;
      return !areMessagesGrouped(message, messageBelow);
    },
    [displayMessages, areMessagesGrouped],
  );

  const isGroupedMessage = useCallback(
    (index: number, message: MessageWithProfile): boolean => {
      const messageAbove =
        index < displayMessages.length - 1 ? displayMessages[index + 1] : null;
      return areMessagesGrouped(message, messageAbove);
    },
    [displayMessages, areMessagesGrouped],
  );

  // ==========================================================================
  // Initialization
  // ==========================================================================

  // NOTE: Tab bar visibility is now handled at the navigator level
  // in RootNavigator.tsx using getFocusedRouteNameFromRoute.
  // This eliminates flicker during navigation transitions.

  // Initialize chat - OPTIMIZATION: Skip Firestore calls if we have cached data
  useFocusEffect(
    useCallback(() => {
      const initializeChat = async () => {
        if (!uid) return;

        try {
          // OPTIMIZATION: If we have both chatId and friendProfile from initialData,
          // only fetch fresh data in background (non-blocking)
          if (chatId && friendProfile) {
            setCurrentChatId(chatId, "dm");

            // Background refresh - don't block
            getUserProfileByUid(friendUid)
              .then(setFriendProfile)
              .catch((e) =>
                logger.warn("Background profile refresh failed:", e),
              );
            return;
          }

          // OPTIMIZATION: Parallelize fetch operations
          const promises: [Promise<string>, Promise<any>] = [
            chatId ? Promise.resolve(chatId) : getOrCreateChat(uid, friendUid),
            getUserProfileByUid(friendUid),
          ];

          const [resolvedChatId, profile] = await Promise.all(promises);

          setChatId(resolvedChatId);
          setCurrentChatId(resolvedChatId, "dm");
          setFriendProfile(profile);
        } catch (error: any) {
          logger.error("❌ [ChatScreen] Init error:", error);
          Alert.alert("Error", error.message || "Failed to initialize chat");
          if (error.message?.includes("Cannot chat with this user")) {
            navigation.goBack();
          }
        }
      };

      initializeChat();
      return () => setCurrentChatId(null);
    }, [uid, friendUid, chatId, friendProfile, setCurrentChatId, navigation]),
  );

  // Load scheduled messages
  useEffect(() => {
    if (!uid || !chatId) return;
    getScheduledMessagesForChat(uid, chatId)
      .then(setScheduledMessages)
      .catch((e) => logger.error("Failed to load scheduled messages:", e));
  }, [uid, chatId]);

  useEffect(() => {
    if (!uid || !chatId) return;
    markConversationNotificationsRead(uid, chatId, "dm").catch((error) => {
      logger.warn("Failed to mark DM notifications read:", error);
    });
  }, [uid, chatId]);

  // Derive header subtitle from presence / typing
  const headerSubtitle = useMemo(() => {
    if (typing.isOtherUserTyping && typing.typingIndicatorsEnabled) {
      return "typing...";
    }
    if (presence.shouldShowOnlineIndicator && presence.isOnline) {
      return "Online";
    }
    if (presence.shouldShowLastSeen && presence.lastSeen) {
      return `Last seen ${presence.lastSeenFormatted}`;
    }
    return undefined;
  }, [typing, presence]);

  const headerSubtitleColor = useMemo(
    () =>
      typing.isOtherUserTyping && typing.typingIndicatorsEnabled
        ? theme.colors.primary
        : undefined,
    [typing, theme.colors.primary],
  );

  /** Right-side actions for the DM header */
  const renderHeaderRight = useCallback(
    () => (
      <View style={styles.headerRightRow}>
        <DirectCallButton
          recipientId={friendUid}
          recipientName={friendProfile?.username || "Friend"}
          onCallStarted={(callId, mode) => {
            navigation.navigate("DirectCall" as any, {
              callId,
              recipientName: friendProfile?.username || "Friend",
              mode,
              isOutgoing: true,
            });
          }}
          size={22}
        />
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
    [friendUid, friendProfile, chatId, menuVisible, theme, navigation],
  );

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleTextChange = useCallback(
    (text: string) => {
      screen.composer.setText(text);
      // Update typing status
      typing.setTyping(text.length > 0);
    },
    [screen.composer, typing],
  );

  const handleSendMessage = useCallback(async () => {
    const hasText = screen.composer.text.trim().length > 0;
    const hasAttachments = attachmentPicker.attachments.length > 0;

    if (!uid || !chatId || (!hasText && !hasAttachments) || screen.sending)
      return;

    const text = screen.composer.text.trim();
    const currentReplyTo = screen.chat.replyTo;

    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    typing.setTyping(false);
    screen.composer.clearText();

    // Text-only path (no attachments)
    if (hasText && !hasAttachments) {
      try {
        const result = await screen.chat.sendMessage(text, {
          replyTo: currentReplyTo || undefined,
        });
        if (!result.success) {
          screen.composer.setText(text);
          Alert.alert("Error", result.error || "Failed to send");
        }
      } catch (error: any) {
        screen.composer.setText(text);
        logger.error("❌ [ChatScreen] Send error:", error);
      }
      return;
    }

    // Attachment path (gallery picks via attachment tray)
    screen.chat.clearReplyTo();
    try {
      if (hasAttachments) {
        const localAttachments = [...attachmentPicker.attachments];
        attachmentPicker.clearAttachments();

        for (const attachment of localAttachments) {
          await screen.chat.sendMessage("", {
            replyTo: currentReplyTo || undefined,
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

        // Send text separately if present
        if (hasText) {
          await screen.chat.sendMessage(text, {
            replyTo: currentReplyTo || undefined,
          });
        }
      }
    } catch (error: any) {
      logger.error("❌ [ChatScreen] Send error:", error);
      Alert.alert("Error", error.message || "Failed to send");
    }
  }, [
    uid,
    chatId,
    screen.composer,
    screen.chat,
    screen.sending,
    typing,
    attachmentPicker,
  ]);

  const handleAddAttachment = useCallback(async () => {
    await attachmentPicker.pickFromGallery();
  }, [attachmentPicker]);

  const handleCaptureFromCamera = useCallback(async () => {
    await attachmentPicker.captureFromCamera();
  }, [attachmentPicker]);

  const handleVoiceRecordingComplete = useCallback(
    async (recording: VoiceRecording) => {
      if (!uid || !chatId || screen.sending) return;

      try {
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
        logger.error("❌ [ChatScreen] Voice send error:", error);
        Alert.alert("Error", error.message || "Failed to send voice message");
      }
    },
    [uid, chatId, screen.chat, screen.sending],
  );

  const handleReply = useCallback(
    (replyMetadata: ReplyToMetadata) => {
      screen.chat.setReplyTo(replyMetadata);
    },
    [screen.chat],
  );

  const handleCancelReply = useCallback(() => {
    screen.chat.clearReplyTo();
  }, [screen.chat]);

  const handleMessageLongPress = useCallback((message: MessageWithProfile) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(message);
    setActionsSheetVisible(true);
  }, []);

  const handleRetryMessage = useCallback(async (msg: MessageWithProfile) => {
    await retryMessage(msg.id);
  }, []);

  // Enhanced scroll-to-message with highlight animation
  const scrollToMessage = useCallback(
    (messageId: string) => {
      const targetIndex = displayMessages.findIndex((m) => m.id === messageId);
      if (targetIndex === -1 || !messageListRef.current) return;

      // Clear any existing highlight timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      // Store current position for return navigation (rough estimate from visible messages)
      // In inverted list, index 0 is at the bottom
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
        }, 2100); // Match animation duration
      }, 300); // Wait for scroll to settle
    },
    [displayMessages],
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

  // Animal button press handler — sends a structured animal signal message
  const handleAnimalPress = useCallback(async () => {
    if (!uid || !chatId) return;
    const { equippedAnimalId, canSend } = animalEntitlement;
    if (!canSend || !equippedAnimalId) return;

    try {
      // Play animal sound + haptic (fire and forget but still catch errors)
      await playAnimalSound(equippedAnimalId);
    } catch (e) {
      logger.warn("❌ [ChatScreen] Animal sound error:", e);
    }
    try {
      // Send structured animal signal message (kind: "animal", animalId)
      await screen.chat.sendMessage("", {
        kind: "animal",
        animalId: equippedAnimalId,
      });
    } catch (error) {
      logger.error("❌ [ChatScreen] Animal send error:", error);
    }
  }, [uid, chatId, animalEntitlement, screen.chat]);

  // Animal picker equip handler — refresh profile so the button updates
  const handleAnimalEquipped = useCallback(
    (animalId: string) => {
      setAnimalPickerVisible(false);
      // Profile uses one-shot reads; must explicitly refresh so
      // useAnimalEntitlement picks up the new chatAppearance.animalThemeId
      refreshProfile();
    },
    [refreshProfile],
  );

  const handleBlockConfirm = async (reason?: string) => {
    if (!uid) return;
    try {
      await blockUser(uid, friendUid, reason);
      setBlockModalVisible(false);
      Alert.alert(
        "User Blocked",
        `${friendProfile?.username || "User"} has been blocked.`,
        [{ text: "OK", onPress: () => navigation.goBack() }],
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

  const handleOpenMediaViewer = useCallback(
    (imageUrl: string, senderName: string, timestamp: Date) => {
      setViewerAttachments([
        {
          id: "dm-image",
          kind: "photo" as any,
          mime: "image/jpeg",
          url: imageUrl,
          path: "",
          sizeBytes: 0,
        },
      ]);
      setViewerInitialIndex(0);
      setViewerSenderName(senderName);
      setViewerTimestamp(timestamp);
      setMediaViewerVisible(true);
    },
    [],
  );

  // Games V4: handle game selection from picker
  const handleGameSelected = useCallback(
    async (gameId: GameId) => {
      if (!chatId || !uid) return;
      try {
        const { inviteId } = await createGameInvite({
          conversationId: chatId,
          conversationScope: "dm",
          gameId,
        });
        navigation.navigate("GameLobbyV4", { inviteId });
      } catch (err: any) {
        const msg =
          err?.code === "functions/not-found" || err?.message === "not-found"
            ? "Game service is not available. Please make sure Cloud Functions are deployed."
            : (err?.message ?? "Failed to create game invite");
        Alert.alert("Game Error", msg);
      }
    },
    [chatId, uid, navigation],
  );

  const handleScheduleMessage = async (scheduledFor: Date) => {
    const text = screen.composer.text.trim();
    if (!uid || !chatId || !text) return;
    try {
      const result = await scheduleMessage({
        senderId: uid,
        recipientId: friendUid,
        chatId,
        scope: "dm",
        content: text,
        type: "text",
        scheduledFor,
      });
      if (result) {
        screen.composer.clearText();
        setScheduledMessages((prev) => [...prev, result]);
        Alert.alert(
          "Message Scheduled! ⏰",
          `Your message will be sent ${scheduledFor.toLocaleString()}`,
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to schedule message.");
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  // OPTIMIZATION: Show shell immediately, skeleton only for message area
  // This eliminates UI flicker by always rendering header and composer
  const isInitializing = !chatId || !friendProfile;
  const showSkeleton = screen.loading || isInitializing;

  const renderMessageItem = useCallback(
    ({ item, index }: { item: MessageWithProfile; index: number }) => (
      <DMMessageItem
        message={item}
        currentUid={uid}
        chatId={chatId}
        friendProfile={friendProfile}
        chatAppearance={chatAppearance}
        onReply={handleReply}
        onLongPress={handleMessageLongPress}
        onScrollToMessage={scrollToMessage}
        onRetry={handleRetryMessage}
        onImagePress={handleOpenMediaViewer}
        isHighlighted={item.id === highlightedMessageId}
        isGrouped={isGroupedMessage(index, item)}
        showTimestamp={shouldShowTimestamp(index, item)}
        reactions={messageReactions.get(item.id) || []}
        onOptimisticReaction={handleOptimisticReaction}
      />
    ),
    [
      uid,
      chatId,
      friendProfile,
      chatAppearance,
      handleReply,
      handleMessageLongPress,
      scrollToMessage,
      handleRetryMessage,
      handleOpenMediaViewer,
      highlightedMessageId,
      isGroupedMessage,
      shouldShowTimestamp,
      messageReactions,
      handleOptimisticReaction,
    ],
  );

  const cameraButton = (
    <CameraLongPressButton
      onShortPress={handleCaptureFromCamera}
      onLongPress={handleAddAttachment}
      disabled={screen.sending || attachmentPicker.isMaxReached}
      size={40}
    />
  );

  const scheduleButton = screen.composer.text.trim() ? (
    <IconButton
      icon="clock-outline"
      size={22}
      onPress={() => setScheduleModalVisible(true)}
      disabled={screen.sending || attachmentPicker.isUploading}
      style={styles.scheduleButton}
    />
  ) : null;

  return (
    <>
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        {/* Unified custom header — matches group chat style */}
        <ChatHeader
          onBack={() => navigation.goBack()}
          chatType="dm"
          title={friendProfile?.username || "Message"}
          subtitle={headerSubtitle}
          subtitleColor={headerSubtitleColor}
          profilePictureUrl={
            friendProfile?.profilePicture?.url ||
            friendProfile?.profilePictureUrl ||
            friendProfile?.avatar
          }
          decorationId={
            friendProfile?.avatarDecoration?.decorationId ||
            friendProfile?.decorationId
          }
          avatarFallbackName={
            friendProfile?.displayName || friendProfile?.username
          }
          onTitlePress={() =>
            navigation.navigate("UserProfile", { userId: friendUid })
          }
          showOnlineIndicator={presence.shouldShowOnlineIndicator}
          isOnline={presence.isOnline}
          renderRight={renderHeaderRight}
        />

        {/* Pinned Game Invites Bar */}
        {GAMES_V4_ENABLED && chatId && (
          <PinnedInviteBar conversationId={chatId} scope="dm" />
        )}

        {/* OPTIMIZATION: Show skeleton during initialization, messages when ready */}
        {showSkeleton ? (
          <ChatSkeleton bubbleCount={8} />
        ) : (
          <ChatMessageList
            ref={messageListRef}
            data={displayMessages}
            renderItem={renderMessageItem}
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
              <View style={styles.emptyStateContainer}>
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: theme.colors.onBackground },
                  ]}
                >
                  {`Say hi to ${friendProfile?.username || "your friend"}!`}
                </Text>
                <Text
                  style={[
                    styles.emptySubtitle,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Send a message, snap a photo, or challenge them to a game 🎮
                </Text>
              </View>
            }
            flatListProps={{
              onEndReached: screen.loadOlder,
              onEndReachedThreshold: 0.3,
            }}
          />
        )}

        {/* Network Status Banner */}
        <NetworkBanner
          showOffline={networkStatus.showOfflineBanner}
          showOnline={networkStatus.showOnlineBanner}
          statusText={networkStatus.statusText}
        />

        {/* Typing Indicator */}
        <TypingIndicator
          userName={friendProfile?.username}
          visible={typing.isOtherUserTyping && typing.typingIndicatorsEnabled}
        />

        {/* Jump-back button for reply navigation */}
        <ScrollReturnButton
          visible={showReturnButton}
          onPress={handleReturnToReply}
          onAutoHide={handleReturnButtonAutoHide}
          autoHideDelay={5000}
        />

        <ChatComposer
          scope="dm"
          value={screen.composer.text}
          onChangeText={handleTextChange}
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
          leftAccessory={cameraButton}
          additionalRightAccessory={scheduleButton}
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
          replyTo={screen.chat.replyTo}
          onCancelReply={handleCancelReply}
          currentUid={uid}
          onGamePress={
            GAMES_V4_ENABLED ? () => setGamePickerVisible(true) : undefined
          }
          onAnimalPress={handleAnimalPress}
          animalThemeId={animalEntitlement.equippedAnimalId}
          animalLocked={!animalEntitlement.canSend}
          animalPickerVisible={animalPickerVisible}
          onAnimalLongPress={() => setAnimalPickerVisible(true)}
          onAnimalPickerClose={() => setAnimalPickerVisible(false)}
          currentUserId={uid}
          onAnimalEquipped={handleAnimalEquipped}
          voiceButtonComponent={
            voiceRecorder.isAvailable &&
            !screen.composer.text.trim() &&
            attachmentPicker.attachments.length === 0 ? (
              <VoiceRecordButton
                onRecordingComplete={handleVoiceRecordingComplete}
                onRecordingCancelled={NOOP}
                disabled={screen.sending}
                size={32}
                maxDuration={60000}
              />
            ) : undefined
          }
          keyboardHeight={screen.keyboard.keyboardHeight}
          keyboardProgress={screen.keyboard.keyboardProgress}
          safeAreaBottom={insets.bottom}
          absolutePosition={true}
        />
      </View>

      <BlockUserModal
        visible={blockModalVisible}
        username={friendProfile?.username || "User"}
        onCancel={() => setBlockModalVisible(false)}
        onConfirm={handleBlockConfirm}
      />

      <ReportUserModal
        visible={reportModalVisible}
        username={friendProfile?.username || "User"}
        onSubmit={handleReportSubmit}
        onCancel={() => setReportModalVisible(false)}
      />

      <ScheduleMessageModal
        visible={scheduleModalVisible}
        messagePreview={screen.composer.text}
        onSchedule={handleScheduleMessage}
        onClose={() => setScheduleModalVisible(false)}
      />

      <MessageActionsSheet
        visible={actionsSheetVisible}
        message={selectedMessageAsV2}
        currentUid={uid || ""}
        onClose={() => setActionsSheetVisible(false)}
        onReply={handleReply}
        onEdited={NOOP}
        onDeleted={NOOP}
        onReactionAdded={handleSheetReaction}
      />

      <MediaViewerModal
        visible={mediaViewerVisible}
        attachments={viewerAttachments}
        initialIndex={viewerInitialIndex}
        onClose={() => setMediaViewerVisible(false)}
        senderName={viewerSenderName}
        timestamp={viewerTimestamp}
      />

      {/* Games V4: Game picker modal */}
      {GAMES_V4_ENABLED && (
        <GamePickerModal
          visible={gamePickerVisible}
          onSelect={handleGameSelected}
          onClose={() => setGamePickerVisible(false)}
          multiplayerOnly
        />
      )}
    </>
  );
}

// ==========================================================================
// Styles
// ==========================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyStateContainer: {
    transform: [{ scaleY: -1 }],
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 48,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
  loadMoreContainer: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  scheduleButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
});
