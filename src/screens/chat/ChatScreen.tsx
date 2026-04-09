/**
 * ChatScreen (DM) - Refactored (UNI-05)
 *
 * This screen handles direct message conversations between two users.
 * Refactored to use unified abstractions achieving ~400 lines from ~1,700.
 *
 * Shared foundation:
 * - useAttachmentPicker: Camera capture + gallery attachment management
 * - MessageV2-native render path shared with the broader chat platform
 * - Shared send orchestration and shared ChatHeader / ChatMessageList / ChatComposer
 *
 * Enhanced Features:
 * - In-app camera captures send directly to chat (via handleDirectCameraSend)
 * - Gallery picks queue in AttachmentTray for multi-image sends
 * - DM streak tracking preserved on camera sends
 * - Message highlight animation when navigating to replied messages
 * - Jump-back button after scrolling to a reply target
 */

import { usePrefetch, usePrefetchChatImages } from "@/utils/imagePrefetch";
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
  Keyboard,
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
  parseReactionsFromMessage,
  ReactionSummary,
  subscribeToMultipleMessageReactions,
  toggleReaction,
} from "@/services/reactions";

// Chat components
import {
  buildTimeline,
  TimelineItem,
  timelineKeyExtractor,
} from "@/chat/buildTimeline";
import {
  AttachmentTray,
  ChatComposer,
  ChatMessageList,
  MediaViewerModal,
  MessageActionsSheet,
  SystemMessageChip,
  TypingBar,
  TypingBubble,
} from "@/components/chat";
import { AnimatedMessageRow } from "@/components/chat/AnimatedMessageRow";
import { CameraLongPressButton } from "@/components/chat/CameraLongPressButton";
import type { ChatMessageListRef } from "@/components/chat/ChatMessageList";
import { ChatSkeleton } from "@/components/chat/ChatSkeleton";
import { DateDivider } from "@/components/chat/DateDivider";
import { FullEmojiPicker } from "@/components/chat/FullEmojiPicker";
import { NetworkBanner } from "@/components/chat/NetworkBanner";
import { ScrollReturnButton } from "@/components/chat/ScrollReturnButton";
import { VoiceRecordButton } from "@/components/chat/VoiceRecordButton";
import { useComposerToolbarLayout } from "@/hooks/useComposerToolbarLayout";

// UI components
import BlockUserModal from "@/components/BlockUserModal";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessageRenderer } from "@/components/chat/ChatMessageRenderer";
import ReportUserModal from "@/components/ReportUserModal";
import ScheduleMessageModal from "@/components/ScheduleMessageModal";
import {
  ComposerSheetProvider,
  useComposerSheet,
} from "@/contexts/ComposerSheetContext";
import { PinnedInviteBar } from "@/gamesV4/components/PinnedInviteBar";
import { createGameInvite } from "@/gamesV4/services/gameServiceV4";
import type { GameId } from "@/gamesV4/types";
import { useConversationDisplayMode } from "@/store/ConversationDisplayModeContext";

// Keyboard-sync (KCSV + fallback animated container)
import {
  ChatFooterWrapper,
  ChatKeyboardContainer,
  KeyboardSafeAreaSpacer,
  setChatScrollViewConfig,
  useRenderChatScrollComponent,
} from "@/components/chat/ChatKeyboardScrollView";
import { SheetDismissLayer } from "@/components/chat/SheetDismissLayer";

// Services
import {
  sendAnimalSignalMessage,
  sendChatDraft,
  sendGifMessage,
  sendMediaAttachmentMessage,
  sendVoiceRecordingMessage,
} from "@/chat/sendDraft";
import { blockUser } from "@/services/blocking";
import { getOrCreateChat } from "@/services/chat";
import { safeSystemText } from "@/services/chat/normalizeMessage";
import { getUserProfileByUid } from "@/services/friends";
import { registerGifShare } from "@/services/gif/gifService";
import type { GifItem } from "@/services/gif/types";
import { retryMessage } from "@/services/messaging";
import { submitReport } from "@/services/reporting";
import { scheduleMessage } from "@/services/scheduledMessages";
import { registerStickerShare } from "@/services/sticker/stickerService";
import type { StickerItem } from "@/services/sticker/types";
import { markConversationNotificationsRead } from "@/services/userNotifications";

// Call buttons
import DirectCallButton from "@/components/stream/DirectCallButton";

// Types & Utils
import {
  DEBUG_CHAT_V2,
  GAMES_V4_ENABLED,
  GIF_PICKER_ENABLED,
  STICKER_PICKER_ENABLED,
} from "@/constants/featureFlags";
import { Spacing } from "@/constants/theme";
import { buildSenderStyle } from "@/cosmetics/chatAppearanceResolver";
import { useAnimalEntitlement } from "@/hooks/useAnimalEntitlement";
import { playAnimalSound } from "@/services/chat/animalSoundService";
import type {
  AttachmentV2,
  MessageV2,
  ReplyToMetadata,
} from "@/types/messaging";
import type { ReportReason } from "@/types/models";
import * as Haptics from "expo-haptics";

import { clearLastOpenChat, saveLastOpenChat } from "@/services/lastOpenChat";
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
  friendDecorationId?: string | null;
}

interface ChatScreenParams {
  friendUid: string;
  initialData?: InitialChatData;
  targetMessageId?: string;
}

// ==========================================================================
// ChatDMHeaderMenu — isolated so menu toggle doesn't re-render ChatScreen
// ==========================================================================
function ChatDMHeaderMenu({
  chatId,
  chatName,
  onBlock,
  onReport,
  navigation,
}: {
  chatId: string | null;
  chatName: string | undefined;
  onBlock: () => void;
  onReport: () => void;
  navigation: any;
}) {
  const [visible, setVisible] = useState(false);
  const closingRef = useRef(false);
  const theme = useTheme();
  const contentStyle = useMemo(
    () => ({ backgroundColor: theme.colors.surface }),
    [theme.colors.surface],
  );

  const handleOpen = useCallback(() => {
    // Prevent opening while a dismiss animation is still in progress
    if (closingRef.current) return;
    setVisible(true);
  }, []);

  const handleDismiss = useCallback(() => {
    closingRef.current = true;
    setVisible(false);
    // Allow re-opening after Paper's dismiss animation completes (~300ms)
    setTimeout(() => {
      closingRef.current = false;
    }, 350);
  }, []);

  return (
    <Menu
      visible={visible}
      onDismiss={handleDismiss}
      anchor={
        <IconButton icon="dots-vertical" size={24} onPress={handleOpen} />
      }
      contentStyle={contentStyle}
    >
      <Menu.Item
        onPress={() => {
          handleDismiss();
          navigation.navigate("ChatSettings", {
            chatId,
            chatType: "dm",
            chatName,
          });
        }}
        title="Settings"
        leadingIcon="cog-outline"
      />
      <Menu.Item
        onPress={() => {
          handleDismiss();
          onBlock();
        }}
        title="Block User"
        leadingIcon="block-helper"
      />
      <Menu.Item
        onPress={() => {
          handleDismiss();
          onReport();
        }}
        title="Report User"
        leadingIcon="flag"
      />
    </Menu>
  );
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
  const { displayMode } = useConversationDisplayMode();

  // Animal entitlement gating
  const animalEntitlement = useAnimalEntitlement(uid, chatAppearance);

  // Build sender style snapshot for stamping on outgoing messages
  const senderStyle = useMemo(
    () => buildSenderStyle(chatAppearance),
    [chatAppearance],
  );

  // OPTIMIZATION: Extract initial data passed from inbox for instant display
  const { friendUid, initialData, targetMessageId } =
    route.params as ChatScreenParams;

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
          profilePicture: { url: initialData.friendAvatar || null },
          avatarDecoration: {
            decorationId: initialData.friendDecorationId || null,
          },
        }
      : null,
  );
  const messageListRef = React.useRef<ChatMessageListRef>(null);

  // Modal state
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [animalPickerVisible, setAnimalPickerVisible] = useState(false);

  // Games V4 state
  const [gameInviteCreating, setGameInviteCreating] = useState(false);

  // Customizable toolbar
  const toolbar = useComposerToolbarLayout(uid);

  // Message actions state
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageV2 | null>(
    null,
  );
  const [fullEmojiPickerOpen, setFullEmojiPickerOpen] = useState(false);

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
      profile?.displayName ||
      profile?.username ||
      currentFirebaseUser?.displayName ||
      currentFirebaseUser?.email ||
      "User",
    enableVoice: true,
    enableAttachments: true,
    enableMentions: false,
    enableScheduledMessages: true,
    onSchedulePress: () => setScheduleModalVisible(true),
    sendReadReceipts: readReceipts.shouldSendReadReceipts,
    senderStyle,
    debug: DEBUG_CHAT,
  });

  // Keep ComposerSheetContext aware of the latest keyboard height
  const { setLastKeyboardHeight, sheetExtraPadding } = useComposerSheet();
  useEffect(() => {
    if (screen.keyboard.finalKeyboardHeight > 0) {
      setLastKeyboardHeight(screen.keyboard.finalKeyboardHeight);
    }
  }, [screen.keyboard.finalKeyboardHeight, setLastKeyboardHeight]);

  // Warm image cache for recent chat images
  usePrefetchChatImages(screen.messages?.slice(0, 20));

  // Prefetch friend's avatar for instant display
  const friendAvatarUrls = useMemo(() => {
    const url =
      friendProfile?.profilePicture?.url ||
      friendProfile?.profilePictureUrl ||
      friendProfile?.avatar ||
      initialData?.friendAvatar;
    return url ? [url] : undefined;
  }, [friendProfile, initialData?.friendAvatar]);
  usePrefetch(friendAvatarUrls);

  // ==========================================================================
  // Camera & attachment actions are handled through unified chat screen hooks.
  // ==========================================================================

  // Send an in-app camera capture directly as a media message (skip tray).
  const handleDirectCameraSend = useCallback(
    async (imageUri: string) => {
      if (!uid || !chatId || screen.sending) return;
      const result = await sendMediaAttachmentMessage({
        chat: screen.chat,
        attachment: {
          id: `cam_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          uri: imageUri,
          kind: "image",
          mime: "image/jpeg",
        },
      });

      if (!result.success) {
        Alert.alert("Error", result.error || "Failed to send photo");
      }
    },
    [uid, chatId, screen.chat, screen.sending],
  );

  // Send gallery-selected images directly as media messages (skip tray).
  const handleDirectGallerySend = useCallback(
    async (imageUris: string[]) => {
      if (!uid || !chatId || screen.sending) return;
      for (const uri of imageUris) {
        const result = await sendMediaAttachmentMessage({
          chat: screen.chat,
          attachment: {
            id: `gal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            uri,
            kind: "image",
            mime: "image/jpeg",
          },
        });

        if (!result.success) {
          Alert.alert("Error", result.error || "Failed to send photo");
        }
      }
    },
    [uid, chatId, screen.chat, screen.sending],
  );

  // Send a GIF selected from the KLIPY-powered GIF picker.
  const handleGifSelected = useCallback(
    async (gif: GifItem) => {
      if (!uid || !chatId || screen.sending) return;
      const result = await sendGifMessage({
        chat: screen.chat,
        gif: {
          id: `gif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          url: gif.fullUrl,
          width: gif.fullWidth,
          height: gif.fullHeight,
          mime: gif.mime ?? "image/gif",
        },
      });

      if (!result.success) {
        Alert.alert("Error", result.error || "Failed to send GIF");
      }
      // Fire-and-forget: let KLIPY know this GIF was shared (analytics / ranking).
      registerGifShare(gif.id).catch(() => {});
    },
    [uid, chatId, screen.chat, screen.sending],
  );

  // Send a sticker selected from the KLIPY-powered sticker picker.
  const handleStickerSelected = useCallback(
    async (sticker: StickerItem) => {
      if (!uid || !chatId || screen.sending) return;
      const result = await sendGifMessage({
        chat: screen.chat,
        gif: {
          id: `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          url: sticker.fullUrl,
          width: sticker.fullWidth,
          height: sticker.fullHeight,
          mime: sticker.mime ?? "image/gif",
        },
      });

      if (!result.success) {
        Alert.alert("Error", result.error || "Failed to send sticker");
      }
      // Fire-and-forget: let KLIPY know this sticker was shared.
      registerStickerShare(sticker.slug).catch(() => {});
    },
    [uid, chatId, screen.chat, screen.sending],
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

  // Destructure the stable callback ref outside useMemo so the dependency
  // is reference-stable (getMessageStatus is wrapped in useCallback inside
  // useReadReceipts).  Using the whole `readReceipts` object would create a
  // new dependency every render because the hook returns a plain object
  // literal, which in turn would churn the DM timeline and visible row props
  // more than necessary.
  const getReceiptStatus = readReceipts.getMessageStatus;

  const displayMessages: MessageV2[] = useMemo(
    () =>
      chatId
        ? screen.messages.map((msg) => {
            // Apply read receipt status for messages sent by current user
            if (msg.senderId === uid && msg.serverReceivedAt) {
              // For DMs, messages that reached the server are at minimum
              // "delivered". Map "sent" → "delivered" so the receipt resolver
              // never falls back to "Sent" during watermark hydration.
              const baseStatus =
                msg.status === "read" || msg.status === "sent"
                  ? "delivered"
                  : msg.status;
              return {
                ...msg,
                status: getReceiptStatus(msg.serverReceivedAt, baseStatus),
              };
            }
            return msg;
          })
        : [],
    [chatId, screen.messages, uid, getReceiptStatus],
  );

  const areMessagesGrouped = useCallback(
    (msg1: MessageV2 | null, msg2: MessageV2 | null): boolean => {
      if (!msg1 || !msg2) return false;
      if (msg1.replyTo || msg2.replyTo) return false;
      if (msg1.senderId !== msg2.senderId) return false;
      return (
        Math.abs(msg1.createdAt - msg2.createdAt) < MESSAGE_GROUP_THRESHOLD_MS
      );
    },
    [],
  );

  // ==========================================================================
  // Timeline with Date Dividers
  // ==========================================================================

  /** Derive timeline items (messages + day dividers) from displayMessages */
  const timelineData: TimelineItem<MessageV2>[] = useMemo(
    () =>
      buildTimeline<MessageV2>(
        displayMessages,
        (msg) => msg.createdAt,
        areMessagesGrouped,
      ),
    [displayMessages, areMessagesGrouped],
  );

  // ==========================================================================
  // Reactions Subscription (H8) — with optimistic updates
  // ==========================================================================

  const [messageReactions, setMessageReactions] = useState<
    Map<string, ReactionSummary[]>
  >(new Map());

  // Track message IDs that have been optimistically reacted to (for subscriptions)
  const optimisticIds = React.useRef<Set<string>>(new Set());

  // Seed reactions from denormalized reactionsSummary for instant first render.
  // The real-time subscription will reconcile with full data (hasReacted, userIds).
  const seededIdsRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!uid || displayMessages.length === 0) return;
    const seedMap = new Map<string, ReactionSummary[]>();
    let hasNew = false;
    for (const m of displayMessages) {
      if (
        m.reactionsSummary &&
        Object.keys(m.reactionsSummary).length > 0 &&
        !seededIdsRef.current.has(m.id)
      ) {
        seededIdsRef.current.add(m.id);
        seedMap.set(m.id, parseReactionsFromMessage(m.reactionsSummary, uid));
        hasNew = true;
      }
    }
    if (hasNew) {
      setMessageReactions((prev) => {
        const next = new Map(prev);
        seedMap.forEach((reactions, id) => {
          // Only seed if not already populated by subscription or optimistic toggle
          if (!next.has(id) || next.get(id)!.length === 0) {
            next.set(id, reactions);
          }
        });
        return next;
      });
    }
  }, [uid, displayMessages]);

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

  // Open full emoji picker (from "+" in action sheet)
  const handleExpandReactions = useCallback(() => {
    setFullEmojiPickerOpen(true);
  }, []);

  // Handle emoji from full picker — same reaction flow as handleSheetReaction
  const handleFullEmojiReaction = useCallback(
    (emoji: string) => {
      setFullEmojiPickerOpen(false);
      if (!selectedMessage || !chatId || !uid) return;
      const messageId = selectedMessage.id;
      handleOptimisticReaction(messageId, emoji);
      toggleReaction({
        scope: "dm",
        conversationId: chatId,
        messageId,
        emoji,
        uid,
      })
        .then((result) => {
          if (!result.success) handleOptimisticReaction(messageId, emoji);
        })
        .catch(() => handleOptimisticReaction(messageId, emoji));
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
      uid,
      (reactionsMap) => setMessageReactions(reactionsMap),
    );

    return unsubscribe;
    // Re-subscribe when the set of message-ids-with-reactions changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, uid, displayMessages.map((m) => m.id).join(",")]);

  // ==========================================================================
  // Message Grouping Logic (for inverted FlatList)
  // ==========================================================================

  // NOTE: areMessagesGrouped is now defined above with timeline building.
  // shouldShowTimestamp, isGroupedMessage, isGroupedWithNext are precomputed
  // inside buildTimeline and stored on each TimelineMessageItem.

  // ==========================================================================
  // Initialization
  // ==========================================================================

  // NOTE: Tab bar visibility is now handled at the navigator level
  // in RootNavigator.tsx using getFocusedRouteNameFromRoute.
  // This eliminates flicker during navigation transitions.

  // Track whether the initial chat setup has completed so we don't
  // re-run the full init on every focus event.  We use a ref instead of
  // putting `friendProfile` in the dependency array because
  // setFriendProfile creates a new object reference on every background
  // refresh, which previously caused an infinite re-execution loop:
  //   render → useFocusEffect → fetch → setFriendProfile → render → …
  const chatInitializedRef = useRef(false);

  // Initialize chat - OPTIMIZATION: Skip Firestore calls if we have cached data
  useFocusEffect(
    useCallback(() => {
      const initializeChat = async () => {
        if (!uid) return;

        try {
          // OPTIMIZATION: If we already initialised, just ensure presence
          // is set and do a lightweight background refresh.
          if (chatInitializedRef.current && chatId) {
            setCurrentChatId(chatId, "dm");

            // Background refresh — don't block, and never overwrite
            // a valid profile with undefined (transient Firestore error).
            getUserProfileByUid(friendUid)
              .then((p) => {
                if (p) setFriendProfile(p);
              })
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

          const [resolvedChatId, fetchedProfile] = await Promise.all(promises);

          setChatId(resolvedChatId);
          setCurrentChatId(resolvedChatId, "dm");
          // Only overwrite the profile if the fetch returned data;
          // otherwise keep whatever initialData provided.
          if (fetchedProfile) {
            setFriendProfile(fetchedProfile);
          }
          chatInitializedRef.current = true;
        } catch (error: any) {
          logger.error("❌ [ChatScreen] Init error:", error);
          Alert.alert("Error", error.message || "Failed to initialize chat");
          if (error.message?.includes("Cannot chat with this user")) {
            navigation.goBack();
          }
        }
      };

      initializeChat();
      // Persist this as the last open chat for resume-on-reopen
      saveLastOpenChat("ChatDetail", { friendUid, initialData });
      return () => {
        setCurrentChatId(null);
        clearLastOpenChat();
      };
    }, [uid, friendUid, chatId, setCurrentChatId, navigation]),
  );

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
        <ChatDMHeaderMenu
          chatId={chatId}
          chatName={friendProfile?.username}
          onBlock={() => setBlockModalVisible(true)}
          onReport={() => setReportModalVisible(true)}
          navigation={navigation}
        />
      </View>
    ),
    [friendUid, friendProfile, chatId, navigation],
  );

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleEmojiInsert = useCallback(
    (emoji: string) => {
      screen.composer.setText(screen.composer.text + emoji);
    },
    [screen.composer],
  );

  const handleTextChange = useCallback(
    (text: string) => {
      screen.composer.setText(text);
      // Update typing status
      typing.setTyping(text.length > 0);
    },
    [screen.composer, typing],
  );

  const handleSendMessage = useCallback(async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    await sendChatDraft({
      currentUid: uid,
      conversationId: chatId,
      isSending: screen.sending,
      chat: screen.chat,
      composer: screen.composer,
      attachmentPicker,
      onBeforeSend: () => typing.setTyping(false),
      onError: (message) => Alert.alert("Error", message),
    });
  }, [
    uid,
    chatId,
    screen.chat,
    screen.composer,
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

      const result = await sendVoiceRecordingMessage({
        chat: screen.chat,
        currentUid: uid,
        recording,
      });

      if (!result.success) {
        Alert.alert("Error", result.error || "Failed to send voice message");
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

  const handleMessageLongPress = useCallback((message: MessageV2) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    setSelectedMessage(message);
    setActionsSheetVisible(true);
  }, []);

  const handleRetryMessage = useCallback(async (msg: MessageV2) => {
    await retryMessage(msg.id);
  }, []);

  // Keep a live ref to timelineData so scrollToMessage can read the latest
  // value at call-time without appearing in useCallback deps.  This prevents
  // renderTimelineItem from being recreated on every message change (since
  // scrollToMessage is in its dep array), which in turn prevents FlatList
  // from re-rendering every visible cell.
  const timelineDataRef = useRef(timelineData);
  timelineDataRef.current = timelineData;

  // Enhanced scroll-to-message with highlight animation
  const scrollToMessage = useCallback(
    (messageId: string) => {
      const targetIndex = timelineDataRef.current.findIndex(
        (item) => item.type === "message" && item.data.id === messageId,
      );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Handle return button press
  const handleReturnToReply = useCallback(() => {
    if (returnIndexRef.current !== null && messageListRef.current) {
      messageListRef.current.scrollToIndex(returnIndexRef.current, true);
    }
    setShowReturnButton(false);
    returnIndexRef.current = null;
  }, []);

  // Auto-scroll to targetMessageId from search navigation (deep jump)
  const hasScrolledToTargetRef = useRef(false);
  const deepJumpAttemptsRef = useRef(0);
  const MAX_DEEP_JUMP_ATTEMPTS = 8;

  useEffect(() => {
    if (
      !targetMessageId ||
      hasScrolledToTargetRef.current ||
      timelineData.length === 0
    ) {
      return;
    }

    const targetIndex = timelineData.findIndex(
      (item) => item.type === "message" && item.data.id === targetMessageId,
    );
    if (targetIndex !== -1) {
      hasScrolledToTargetRef.current = true;
      deepJumpAttemptsRef.current = 0;
      // Delay to let list render
      setTimeout(() => {
        scrollToMessage(targetMessageId);
      }, 500);
    } else if (
      deepJumpAttemptsRef.current < MAX_DEEP_JUMP_ATTEMPTS &&
      screen.chat.pagination.hasMoreOlder
    ) {
      // Message not in current timeline — load older messages and retry
      deepJumpAttemptsRef.current += 1;
      screen.loadOlder?.();
    }
  }, [
    targetMessageId,
    timelineData,
    scrollToMessage,
    screen.loadOlder,
    screen.chat.pagination.hasMoreOlder,
  ]);

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
    const result = await sendAnimalSignalMessage({
      chat: screen.chat,
      animalId: equippedAnimalId,
    });
    if (!result.success) {
      logger.error("❌ [ChatScreen] Animal send error:", result.error);
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
      if (!chatId || !uid || gameInviteCreating) return;
      setGameInviteCreating(true);
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
      } finally {
        setGameInviteCreating(false);
      }
    },
    [chatId, uid, navigation, gameInviteCreating],
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
        Alert.alert(
          "Message Scheduled! ⏰",
          `Your message will be sent ${scheduledFor.toLocaleString()}`,
        );
      }
    } catch {
      Alert.alert("Error", "Failed to schedule message.");
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  // OPTIMIZATION: Show shell immediately, skeleton only for message area
  // This eliminates UI flicker by always rendering header and composer
  // Only show full skeleton when we truly have no chatId (first contact)
  const isInitializing = !chatId || !friendProfile;
  const showSkeleton = isInitializing && !initialData?.chatId;

  const renderTimelineItem = useCallback(
    ({ item }: { item: TimelineItem<MessageV2>; index: number }) => {
      if (item.type === "date-divider") {
        return <DateDivider label={item.label} />;
      }
      const msg = item.data;
      if (msg.kind === "system") {
        return <SystemMessageChip text={safeSystemText(msg.text)} />;
      }
      return (
        <AnimatedMessageRow
          messageId={msg.id}
          shouldAnimateOnMount={
            screen.chat.messageEnterAnimation.shouldAnimateOnMount
          }
        >
          <ChatMessageRenderer
            message={msg}
            currentUid={uid}
            chatId={chatId}
            friendProfile={friendProfile}
            chatAppearance={chatAppearance}
            onReply={handleReply}
            onLongPress={handleMessageLongPress}
            onScrollToMessage={scrollToMessage}
            onRetry={handleRetryMessage}
            onImagePress={handleOpenMediaViewer}
            isHighlighted={msg.id === highlightedMessageId}
            reactions={messageReactions.get(msg.id) || []}
            onOptimisticReaction={handleOptimisticReaction}
            displayMode={displayMode}
            isGroupChat={false}
            isGroupedWithPrevious={item.isGroupedWithPrevious}
            isGroupedWithNext={item.isGroupedWithNext}
            currentUserDisplayName={
              profile?.displayName ||
              profile?.username ||
              currentFirebaseUser?.displayName ||
              "Me"
            }
            currentUserProfilePictureUrl={
              (profile as any)?.profilePicture?.url ?? null
            }
            currentUserDecorationId={
              (profile as any)?.avatarDecoration?.decorationId ?? null
            }
          />
        </AnimatedMessageRow>
      );
    },
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
      messageReactions,
      handleOptimisticReaction,
      screen.chat.messageEnterAnimation,
      displayMode,
      profile?.displayName,
      profile?.username,
      currentFirebaseUser?.displayName,
      (profile as any)?.profilePicture?.url,
      (profile as any)?.avatarDecoration?.decorationId,
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

  // Keyboard-sync: configure KCSV and get stable renderScrollComponent
  // offset=0 because the footer (KSV) moves with the keyboard — KCSV needs
  // the full keyboard height as content inset to keep messages visible.
  setChatScrollViewConfig({
    offset: 0,
    keyboardLiftBehavior: "whenAtEnd",
    extraContentPadding: sheetExtraPadding,
  });
  const renderScrollComponent = useRenderChatScrollComponent();

  return (
    <ComposerSheetProvider>
      <ChatKeyboardContainer
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

        {/* SheetDismissLayer: tap/scroll above composer dismisses active sheet */}
        <SheetDismissLayer>
          {/* OPTIMIZATION: Show skeleton during initialization, messages when ready */}
          {showSkeleton ? (
            <ChatSkeleton bubbleCount={8} />
          ) : (
            <ChatMessageList
              ref={messageListRef}
              data={timelineData}
              renderItem={renderTimelineItem}
              keyExtractor={(item) =>
                timelineKeyExtractor(item, (msg) => msg.id)
              }
              renderScrollComponent={renderScrollComponent}
              pillBottomOffset={60 + insets.bottom + 16}
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
                initialNumToRender: 15,
                maxToRenderPerBatch: 8,
              }}
            />
          )}
        </SheetDismissLayer>

        {/* Network Status Banner */}
        <NetworkBanner
          showOffline={networkStatus.showOfflineBanner}
          showOnline={networkStatus.showOnlineBanner}
          statusText={networkStatus.statusText}
        />

        {/* Keyboard-aware footer: typing indicator + composer */}
        <ChatFooterWrapper>
          {/* Typing Indicator — display-mode aware */}
          {displayMode === "stacked" ? (
            <TypingBar
              userName={friendProfile?.username}
              visible={
                typing.isOtherUserTyping && typing.typingIndicatorsEnabled
              }
            />
          ) : (
            <TypingBubble
              userName={friendProfile?.username}
              visible={
                typing.isOtherUserTyping && typing.typingIndicatorsEnabled
              }
            />
          )}

          <ChatComposer
            scope="dm"
            value={screen.composer.text}
            onChangeText={handleTextChange}
            onSend={handleSendMessage}
            hasAttachments={attachmentPicker.attachments.length > 0}
            sendDisabled={
              !chatId ||
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
            onGameSelected={GAMES_V4_ENABLED ? handleGameSelected : undefined}
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
            // Customizable toolbar
            toolbarItems={toolbar.items}
            toolbarEditing={toolbar.isEditing}
            toolbarSaving={toolbar.saving}
            onToolbarEnterEdit={toolbar.enterEditMode}
            onToolbarSaveAndExit={toolbar.saveAndExit}
            onToolbarCancelEdit={toolbar.cancelEdit}
            onToolbarMoveItem={toolbar.moveItem}
            onToolbarAddItem={toolbar.addItem}
            onToolbarRemoveItem={toolbar.removeItem}
            onToolbarResetDefaults={toolbar.resetToDefaults}
            onEmojiSelected={handleEmojiInsert}
            onGifSelected={GIF_PICKER_ENABLED ? handleGifSelected : undefined}
            onStickerSelected={
              STICKER_PICKER_ENABLED ? handleStickerSelected : undefined
            }
            onSchedulePress={() => setScheduleModalVisible(true)}
            onImagesPicked={handleDirectGallerySend}
            imagePickerDisabled={screen.sending}
          />
          <KeyboardSafeAreaSpacer backgroundColor={theme.colors.background} />
        </ChatFooterWrapper>

        {/* Jump-back button for reply navigation */}
        <ScrollReturnButton
          visible={showReturnButton}
          onPress={handleReturnToReply}
          onAutoHide={handleReturnButtonAutoHide}
          autoHideDelay={5000}
        />
      </ChatKeyboardContainer>

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
        message={selectedMessage}
        currentUid={uid || ""}
        onClose={() => setActionsSheetVisible(false)}
        onReply={handleReply}
        onEdited={NOOP}
        onDeleted={NOOP}
        onReactionAdded={handleSheetReaction}
        onExpandReactions={handleExpandReactions}
      />

      <FullEmojiPicker
        open={fullEmojiPickerOpen}
        onClose={() => setFullEmojiPickerOpen(false)}
        onEmojiSelected={handleFullEmojiReaction}
      />

      <MediaViewerModal
        visible={mediaViewerVisible}
        attachments={viewerAttachments}
        initialIndex={viewerInitialIndex}
        onClose={() => setMediaViewerVisible(false)}
        senderName={viewerSenderName}
        timestamp={viewerTimestamp}
      />

      {/* Games V4: Invite creation loading overlay */}
      {gameInviteCreating && (
        <View style={styles.gameInviteLoadingOverlay}>
          <View style={styles.gameInviteLoadingBox}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text
              style={[
                styles.gameInviteLoadingText,
                { color: theme.colors.onSurface },
              ]}
            >
              Creating game invite...
            </Text>
          </View>
        </View>
      )}
    </ComposerSheetProvider>
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
  gameInviteLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 100,
  },
  gameInviteLoadingBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  gameInviteLoadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
