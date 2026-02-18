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

// Unified chat hooks (UNI-04, UNI-05)
import { useAttachmentPicker } from "@/hooks/useAttachmentPicker";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { usePresence } from "@/hooks/usePresence";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useUnifiedChatScreen } from "@/hooks/useUnifiedChatScreen";
import { useVoiceRecorder, VoiceRecording } from "@/hooks/useVoiceRecorder";

// Services
import { updateStreakAfterMessage } from "@/services/streakCosmetics";

// Chat components
import {
  AttachmentTray,
  ChatComposer,
  ChatGameInvites,
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
import { DMMessageItem, MessageWithProfile } from "@/components/DMMessageItem";
import ReportUserModal from "@/components/ReportUserModal";
import ScheduleMessageModal from "@/components/ScheduleMessageModal";
import { EmptyState, PresenceIndicator } from "@/components/ui";

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

// Game Picker
import { GamePickerModal } from "@/components/games/GamePickerModal";
import { GAME_SCREEN_MAP } from "@/config/gameCategories";
import { ExtendedGameType } from "@/types/games";
import type { UniversalGameInvite } from "@/types/turnBased";

// Call buttons
import { CallButtonGroup } from "@/components/calls";

// Types & Utils
import { DEBUG_CHAT_V2 } from "@/constants/featureFlags";
import { Spacing } from "@/constants/theme";
import { playQuack } from "@/services/chat/quackService";
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
  const uid = currentFirebaseUser?.uid;

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
    debug: DEBUG_CHAT,
  });

  // ==========================================================================
  // Camera & Attachment Hooks (replaces legacy useSnapCapture)
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

  // Read receipts
  const readReceipts = useReadReceipts({
    chatId: chatId || "",
    currentUid: uid || "",
    otherUid: friendUid,
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
            setCurrentChatId(chatId);

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
          setCurrentChatId(resolvedChatId);
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

  // Update header
  useEffect(() => {
    if (!friendProfile) return;

    // Determine header subtitle based on presence
    const getSubtitle = () => {
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
    };

    const subtitle = getSubtitle();

    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerTitleRow}>
            {presence.shouldShowOnlineIndicator && (
              <PresenceIndicator
                online={presence.isOnline}
                size={8}
                position="inline"
              />
            )}
            <Text
              style={[
                styles.headerTitleText,
                { color: theme.colors.onSurface },
              ]}
            >
              {friendProfile.username}
            </Text>
          </View>
          {subtitle && (
            <Text
              style={[
                styles.headerSubtitleText,
                {
                  color:
                    typing.isOtherUserTyping && typing.typingIndicatorsEnabled
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerRightRow}>
          {/* Call buttons */}
          <CallButtonGroup
            participantId={friendUid}
            participantName={friendProfile?.username || "Friend"}
            conversationId={chatId || ""}
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
    });
  }, [
    friendProfile,
    navigation,
    menuVisible,
    theme.colors.surface,
    theme.colors.onSurface,
    theme.colors.onSurfaceVariant,
    theme.colors.primary,
    chatId,
    presence,
    typing,
  ]);

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

  // Guard to prevent duplicate navigation to the same game/invite
  const navigatedInvitesRef = useRef<Set<string>>(new Set());

  const handleNavigateToGame = useCallback(
    (
      gameId: string,
      gameType: string,
      options?: {
        inviteId?: string;
        spectatorMode?: boolean;
      },
    ) => {
      // De-duplicate: if we already navigated for this inviteId, skip
      if (options?.inviteId) {
        if (navigatedInvitesRef.current.has(options.inviteId)) {
          logger.info(
            `[ChatScreen] Skipping duplicate navigation for invite ${options.inviteId}`,
          );
          return;
        }
        navigatedInvitesRef.current.add(options.inviteId);
      }

      const screen = GAME_SCREEN_MAP[gameType as keyof typeof GAME_SCREEN_MAP];
      if (screen) {
        // Navigate through MainTabs -> Play tab -> specific game screen
        navigation.navigate("MainTabs", {
          screen: "Play",
          params: {
            screen,
            params: {
              matchId: gameId || undefined,
              inviteId: options?.inviteId,
              spectatorMode: options?.spectatorMode,
              entryPoint: "chat",
              conversationId: chatId,
              conversationType: "dm" as const,
            },
          },
        });
      } else {
        logger.warn(`[ChatScreen] No screen mapping for gameType: ${gameType}`);
      }
    },
    [navigation, chatId],
  );

  // Game button press handler - Opens game picker modal
  const handleGamePress = useCallback(() => {
    setGamePickerVisible(true);
  }, []);

  // Duck button press handler — sends a duck bubble + quack sound
  const handleDuckPress = useCallback(async () => {
    if (!uid || !chatId) return;
    try {
      // Play quack sound + haptic (fire and forget but still catch errors)
      await playQuack();
    } catch (e) {
      logger.warn("❌ [ChatScreen] Quack sound error:", e);
    }
    try {
      // Send the duck marker as a text message
      await screen.chat.sendMessage("🦆", {});
    } catch (error) {
      logger.error("❌ [ChatScreen] Duck send error:", error);
    }
  }, [uid, chatId, screen.chat]);

  // Handle single-player game selection - navigate directly to game
  const handleSinglePlayerGame = useCallback(
    (gameType: ExtendedGameType) => {
      const screen = GAME_SCREEN_MAP[gameType];
      if (screen) {
        // Navigate through MainTabs -> Play tab -> specific game screen
        navigation.navigate("MainTabs", {
          screen: "Play",
          params: {
            screen,
            params: {
              entryPoint: "chat",
              conversationId: chatId,
              conversationType: "dm" as const,
            },
          },
        });
      }
    },
    [navigation, chatId],
  );

  // Handle multiplayer invite creation — navigate host into the game's
  // built-in lobby immediately so they don't wait in chat.
  const handleInviteCreated = useCallback(
    (invite: UniversalGameInvite) => {
      if (!invite?.id || !invite?.gameType) return;

      // Navigate host to the game screen with inviteId so it enters lobby
      // mode.  The lobby subscribes to the invite and waits for the
      // opponent.  matchId may be empty at this point (game not yet started).
      handleNavigateToGame(invite.gameId || "", invite.gameType, {
        inviteId: invite.id,
      });
    },
    [handleNavigateToGame],
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
        onReply={handleReply}
        onLongPress={handleMessageLongPress}
        onScrollToMessage={scrollToMessage}
        onRetry={handleRetryMessage}
        onImagePress={handleOpenMediaViewer}
        isHighlighted={item.id === highlightedMessageId}
        isGrouped={isGroupedMessage(index, item)}
        showTimestamp={shouldShowTimestamp(index, item)}
      />
    ),
    [
      uid,
      chatId,
      friendProfile,
      handleReply,
      handleMessageLongPress,
      scrollToMessage,
      handleRetryMessage,
      handleOpenMediaViewer,
      highlightedMessageId,
      isGroupedMessage,
      shouldShowTimestamp,
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
        style={[
          styles.container,
          { backgroundColor: theme.dark ? "#000" : theme.colors.background },
        ]}
      >
        {/* Game Invites Section - only show when ready */}
        {chatId && uid && !showSkeleton && (
          <ChatGameInvites
            conversationId={chatId}
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
                <Text style={styles.emptyEmoji}>👋</Text>
                <EmptyState
                  icon="message-text-outline"
                  title={`Say hi to ${friendProfile?.username || "your friend"}!`}
                  subtitle="Send a message, snap a photo, or challenge them to a game 🎮"
                />
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
          onDuckPress={handleDuckPress}
          onGamePress={handleGamePress}
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
      />

      <GamePickerModal
        visible={gamePickerVisible}
        onDismiss={() => setGamePickerVisible(false)}
        context="dm"
        conversationId={chatId || ""}
        conversationName={friendProfile?.username}
        recipientId={friendUid}
        recipientName={friendProfile?.username}
        recipientAvatar={friendProfile?.profilePicture?.url}
        onSinglePlayerGame={handleSinglePlayerGame}
        onInviteCreated={handleInviteCreated}
        onError={(error) => Alert.alert("Error", error)}
      />

      <MediaViewerModal
        visible={mediaViewerVisible}
        attachments={viewerAttachments}
        initialIndex={viewerInitialIndex}
        onClose={() => setMediaViewerVisible(false)}
        senderName={viewerSenderName}
        timestamp={viewerTimestamp}
      />
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
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: "600",
  },
  headerSubtitleText: {
    fontSize: 12,
    marginTop: 2,
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
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
    transform: [{ scaleY: -1 }],
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
