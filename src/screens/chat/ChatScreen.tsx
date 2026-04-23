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
  InteractionManager,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { IconButton, Text as PaperText, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Auth & notifications
import { useAuth } from "@/store/AuthContext";
import { useChatKeyboardPreference } from "@/store/ChatKeyboardPreferenceContext";
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
import { getToolbarItemEditModeLongPressDuration } from "@/components/chat/ComposerToolbar/ComposerToolbarRegistry";
import { DateDivider } from "@/components/chat/DateDivider";
import {
  SuspenseBlockUserModal,
  SuspenseFullEmojiPicker,
  SuspenseReportUserModal,
  SuspenseScheduleMessageModal,
} from "@/components/chat/lazyChatComponents";
import { NetworkBanner } from "@/components/chat/NetworkBanner";
import { ScrollReturnButton } from "@/components/chat/ScrollReturnButton";
import { VoiceRecordButton } from "@/components/chat/VoiceRecordButton";
import { useTwoPhaseListConfig } from "@/hooks/chat/useTwoPhaseListConfig";
import { useComposerToolbarLayout } from "@/hooks/useComposerToolbarLayout";

// UI components
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessageRenderer } from "@/components/chat/ChatMessageRenderer";
import { createCardCornerWidthStore } from "@/components/chat/useGroupedCardLayout";
import {
  useComposerSheet,
  useDismissTransientUiOnBlur,
} from "@/contexts/ComposerSheetContext";
import { PinnedInviteBar } from "@/gamesV4/components/PinnedInviteBar";
import { createGameInvite } from "@/gamesV4/services/gameServiceV4";
import GameScorecard from "@/gamesV4/components/GameScorecard";
import { decodeScorecardText } from "@/gamesV4/services/scorecardWire";
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
import { DraggableBottomSheet } from "@/components/chat/DraggableBottomSheet";
import { SheetDismissLayer } from "@/components/chat/SheetDismissLayer";

// Services
import {
  sendAnimalSignalMessage,
  sendChatDraft,
  sendGifMessage,
  sendMediaAttachmentMessage,
  sendVoiceRecordingMessage,
} from "@/chat/sendDraft";
import { blockUser, hasBlockBetweenUsers } from "@/services/blocking";
import { getOrCreateChat } from "@/services/chat";
import { playAnimalSound } from "@/services/chat/animalSoundService";
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
  GAMES_V4_ENABLED,
  GIF_PICKER_ENABLED,
  STICKER_PICKER_ENABLED,
} from "@/constants/featureFlags";
import { Spacing } from "@/constants/theme";
import { buildSenderStyle } from "@/cosmetics/chatAppearanceResolver";
import { useAnimalEntitlement } from "@/hooks/useAnimalEntitlement";
import type {
  AttachmentV2,
  MessageV2,
  ReplyToMetadata,
} from "@/types/messaging";
import type { ReportReason } from "@/types/models";
import * as Haptics from "expo-haptics";

import { clearLastOpenChat, saveLastOpenChat } from "@/services/lastOpenChat";
import { syncMessagesAroundTarget } from "@/services/sync/syncEngine";
import { useSnackbar } from "@/store/SnackbarContext";
import { chatPerf } from "@/utils/chatPerf";
import { createLogger } from "@/utils/log";
import { scheduleIdleWork } from "@/utils/scheduleIdleWork";
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

/** Messages within this window from the same sender are visually grouped */
const MESSAGE_GROUP_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/** Stable no-op callback to avoid re-renders from inline arrow functions */
const NOOP = () => {};

/**
 * Stable empty array shared across all message cells that have no reactions.
 * Using this constant instead of inline `|| []` prevents React.memo on
 * ChatMessageRenderer from seeing a new reference every render, which would
 * force ALL visible cells to re-render on every timeline update.
 */
const EMPTY_REACTIONS: ReactionSummary[] = [];

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
  jumpRequestId?: string;
}

// ==========================================================================
// ChatDMHeaderMenu — bottom sheet action menu
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
  const theme = useTheme();

  const handleOpen = useCallback(() => setVisible(true), []);
  const handleClose = useCallback(() => setVisible(false), []);

  return (
    <>
      <IconButton icon="dots-vertical" size={24} onPress={handleOpen} />
      <DraggableBottomSheet
        open={visible}
        onClose={handleClose}
        snapPoints={[0.32]}
        initialSnapIndex={0}
      >
        <View style={dmMenuStyles.container}>
          <PaperText
            variant="titleMedium"
            style={[dmMenuStyles.title, { color: theme.colors.onSurface }]}
          >
            Options
          </PaperText>
          <TouchableOpacity
            style={dmMenuStyles.row}
            activeOpacity={0.6}
            onPress={() => {
              handleClose();
              navigation.navigate("ChatSettings", {
                chatId,
                chatType: "dm",
                chatName,
              });
            }}
          >
            <IconButton
              icon="cog-outline"
              size={22}
              iconColor={theme.colors.onSurface}
              style={dmMenuStyles.rowIcon}
            />
            <PaperText
              variant="bodyLarge"
              style={{ color: theme.colors.onSurface }}
            >
              Settings
            </PaperText>
          </TouchableOpacity>
          <TouchableOpacity
            style={dmMenuStyles.row}
            activeOpacity={0.6}
            onPress={() => {
              handleClose();
              onBlock();
            }}
          >
            <IconButton
              icon="block-helper"
              size={22}
              iconColor={theme.colors.error}
              style={dmMenuStyles.rowIcon}
            />
            <PaperText
              variant="bodyLarge"
              style={{ color: theme.colors.error }}
            >
              Block User
            </PaperText>
          </TouchableOpacity>
          <TouchableOpacity
            style={dmMenuStyles.row}
            activeOpacity={0.6}
            onPress={() => {
              handleClose();
              onReport();
            }}
          >
            <IconButton
              icon="flag-outline"
              size={22}
              iconColor={theme.colors.error}
              style={dmMenuStyles.rowIcon}
            />
            <PaperText
              variant="bodyLarge"
              style={{ color: theme.colors.error }}
            >
              Report User
            </PaperText>
          </TouchableOpacity>
        </View>
      </DraggableBottomSheet>
    </>
  );
}

const dmMenuStyles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  rowIcon: {
    margin: 0,
    marginRight: Spacing.sm,
  },
});

// ==========================================================================
// ChatScreen Component
// ==========================================================================

export default function ChatScreen({
  route,
  navigation,
}: NativeStackScreenProps<any, "ChatDetail">) {
  const renderStartRef = useRef(performance.now());
  const mountCountRef = useRef(0);
  mountCountRef.current++;
  if (mountCountRef.current === 1) {
    chatPerf.mark("dm-chat-mount");
    chatPerf.trackMount("ChatScreen", route.params?.friendUid);
    chatPerf.beginEntryTrace("ChatScreen", route.params?.friendUid, true);
  }

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const { setCurrentChatId } = useInAppNotifications();
  const { profile } = useUser();
  const uid = currentFirebaseUser?.uid;
  const chatAppearance = profile?.chatAppearance ?? null;
  const { displayMode } = useConversationDisplayMode();
  const { width: windowWidth } = useWindowDimensions();

  // Animal entitlement gating
  const animalEntitlement = useAnimalEntitlement(uid, chatAppearance);

  // Build sender style snapshot for stamping on outgoing messages
  const senderStyle = useMemo(
    () => buildSenderStyle(chatAppearance),
    [chatAppearance],
  );

  // OPTIMIZATION: Extract initial data passed from inbox for instant display
  const { friendUid, initialData, targetMessageId, jumpRequestId } =
    route.params as ChatScreenParams;

  // Two-phase FlatList: lightweight for first paint, full for steady-state
  const { listConfig } = useTwoPhaseListConfig(friendUid);

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
  // Imperative ref used to focus the composer (open keyboard) on chat open.
  const composerFocusRef = React.useRef<{ focus: () => void } | null>(null);
  const { autoOpenKeyboard } = useChatKeyboardPreference();
  const { showInfo } = useSnackbar();

  // Modal state
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [dmBlocked, setDmBlocked] = useState(false);

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
  // Raw scroll offset captured when the user taps a reply to jump.  Used
  // by handleReturnToReply to restore the user's previous scroll position
  // exactly — instead of dumping them at the inverted-list bottom.
  const returnScrollOffsetRef = useRef<number | null>(null);
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
  });

  // Keep ComposerSheetContext aware of the latest keyboard height
  const {
    setLastKeyboardHeight,
    sheetExtraPadding,
    dismissActiveSheet,
    dismissAllTransientUi,
  } = useComposerSheet();

  // Dismiss all transient chat UI (sheets, keyboard) on navigation blur.
  // This ensures no Portal-based sheet survives into the destination screen.
  useDismissTransientUiOnBlur();

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
  });

  // Presence (online status, last seen)
  const presence = usePresence({
    userId: friendUid,
    currentUserId: uid,
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
              const resolved = getReceiptStatus(
                msg.serverReceivedAt,
                baseStatus,
              );
              // Only allocate a new object when the status actually changed.
              // Preserving the original reference lets React.memo on
              // ChatMessageRenderer skip re-renders for unchanged cells.
              if (resolved === msg.status) return msg;
              return { ...msg, status: resolved };
            }
            return msg;
          })
        : [],
    [chatId, screen.messages, uid, getReceiptStatus],
  );

  // In DM bubble mode, only the newest eligible outgoing message shows
  // the read/delivered stamp. "Eligible" = sent by current user, not failed.
  // Messages are ordered newest-first (inverted list), so the first match
  // in displayMessages is the newest outgoing message.
  const newestStatusMessageId = useMemo(() => {
    if (displayMode !== "bubbles") return undefined;
    for (const msg of displayMessages) {
      if (msg.senderId === uid && msg.status !== "failed") {
        return msg.id;
      }
    }
    return undefined;
  }, [displayMessages, uid, displayMode]);

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
  const timelineData: TimelineItem<MessageV2>[] = useMemo(() => {
    const result = chatPerf.time("dm-buildTimeline", () =>
      buildTimeline<MessageV2>(
        displayMessages,
        (msg) => msg.createdAt,
        areMessagesGrouped,
      ),
    );
    chatPerf.traceCheckpoint("ChatScreen", friendUid, "buildTimeline");
    return result;
  }, [displayMessages, areMessagesGrouped, friendUid]);

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

  // Stabilize reaction subscription target IDs to avoid re-subscribing on
  // every message array change. Only re-subscribe when the actual set of IDs changes.
  const reactionTargetKey = useMemo(() => {
    if (!displayMessages.length) return "";
    const idsWithReactions = new Set<string>();
    for (const m of displayMessages) {
      if (m.reactionsSummary && Object.keys(m.reactionsSummary).length > 0) {
        idsWithReactions.add(m.id);
      }
    }
    for (const id of optimisticIds.current) {
      idsWithReactions.add(id);
    }
    return Array.from(idsWithReactions).sort().join(",");
  }, [displayMessages]);

  useEffect(() => {
    if (!chatId || !uid || !reactionTargetKey) {
      if (!reactionTargetKey) setMessageReactions(new Map());
      return;
    }

    const messageIds = reactionTargetKey.split(",");

    const unsubscribe = subscribeToMultipleMessageReactions(
      "dm",
      chatId,
      messageIds,
      uid,
      (reactionsMap) => setMessageReactions(reactionsMap),
    );

    return unsubscribe;
  }, [chatId, uid, reactionTargetKey]);

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
  const focusCountRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      focusCountRef.current++;
      const isResume = focusCountRef.current > 1;
      chatPerf.mark("dm-chat-focus");
      chatPerf.trackFocus("ChatScreen", friendUid, isResume);

      const initializeChat = async () => {
        if (!uid) return;

        try {
          // OPTIMIZATION: If we already initialised, just ensure presence
          // is set and do a lightweight background refresh.
          if (chatInitializedRef.current && chatId) {
            setCurrentChatId(chatId, "dm");

            // Background refresh — don't block, and never overwrite
            // a valid profile with undefined (transient Firestore error).
            // Deferred to idle to avoid competing with animation frames.
            const cancelIdle = scheduleIdleWork(() => {
              getUserProfileByUid(friendUid)
                .then((p) => {
                  if (p) setFriendProfile(p);
                })
                .catch((e) =>
                  logger.warn("Background profile refresh failed:", e),
                );
            });
            // Store cancel for cleanup if the component unmounts before idle fires
            (initializeChat as any).__cancelIdle = cancelIdle;
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

          // Check block status after init — if either direction has a block,
          // disable the composer so messages can't be sent.
          hasBlockBetweenUsers(uid, friendUid)
            .then((blocked) => {
              if (blocked) setDmBlocked(true);
            })
            .catch(() => {});
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
    // Defer notification marking to idle — pure backend side-effect with no UI impact
    const cancel = scheduleIdleWork(() => {
      markConversationNotificationsRead(uid, chatId, "dm").catch((error) => {
        logger.warn("Failed to mark DM notifications read:", error);
      });
    });
    return cancel;
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

  const handleSendMessage = useCallback(() => {
    // Fire-and-forget: the optimistic message is inserted synchronously
    // inside sendMessage, so the FlatList picks it up on the very next
    // React render.  Awaiting the result would add unnecessary microtask
    // hops that delay when React flushes the batched state update.
    sendChatDraft({
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
    dismissActiveSheet();
    await attachmentPicker.pickFromGallery();
  }, [attachmentPicker, dismissActiveSheet]);

  const handleCaptureFromCamera = useCallback(async () => {
    dismissActiveSheet();
    await attachmentPicker.captureFromCamera();
  }, [attachmentPicker, dismissActiveSheet]);

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

  // Lightweight shared store for corner-only width comparisons (no equalization)
  const cornerWidthStore = useMemo(() => createCardCornerWidthStore(), []);

  // ── Live refs for volatile data read inside renderTimelineItem ─────
  // By reading these from refs the useCallback stays stable across state
  // changes, preventing FlatList from re-diffing every cell.
  const messageReactionsRef = useRef(messageReactions);
  messageReactionsRef.current = messageReactions;
  const fallbackReactionsRef = useRef<Map<string, ReactionSummary[]>>(
    new Map(),
  );
  const highlightedMessageIdRef = useRef(highlightedMessageId);
  highlightedMessageIdRef.current = highlightedMessageId;
  const newestStatusMessageIdRef = useRef(newestStatusMessageId);
  newestStatusMessageIdRef.current = newestStatusMessageId;

  useEffect(() => {
    fallbackReactionsRef.current.clear();
  }, [displayMessages, uid]);

  // ── Auto-open keyboard on chat focus ────────────────────────────────
  // When the user enters a DM (or returns to it) we focus the composer so
  // the keyboard opens automatically — unless:
  //   * the user has disabled the preference in Chat Settings
  //   * we are deep-jumping to a specific targetMessageId (search / reply
  //     notification tap) — forcing focus there would steal the user's
  //     attention from the message they came to see.
  //   * the chat is blocked (composer is not rendered)
  //
  // We call focus() after an `InteractionManager.runAfterInteractions`
  // tick so layout (keyboard avoidance, sheet handoff floor, KCSV insets)
  // is fully settled before the native keyboard begins animating in.
  // `hasAutoFocusedRef` guards against the useFocusEffect firing on EVERY
  // focus event — specifically when the user returns to this screen from
  // a child screen like ThreadView, MediaViewer, ProfileViewer, etc.
  // Without this guard the keyboard re-opens during the stack pop, which
  // produces a jarring "sideways" animation because the keyboard is
  // animating in while the screen is still sliding back horizontally.
  //
  // Contract: keyboard auto-opens on the FIRST focus only (initial
  // mount / navigation-enter).  On subsequent focus events we actively
  // dismiss any keyboard the child screen may have left hanging so the
  // user returns to a calm, closed-composer state.
  const hasAutoFocusedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!autoOpenKeyboard) return;
      if (targetMessageId) return;
      if (dmBlocked) return;

      if (hasAutoFocusedRef.current) {
        // Return-from-child focus: do not re-open the keyboard.  Dismiss
        // anything that's still up so the chat settles cleanly.
        Keyboard.dismiss();
        return;
      }
      hasAutoFocusedRef.current = true;

      let cancelled = false;
      const task = InteractionManager.runAfterInteractions(() => {
        const timeoutId = setTimeout(() => {
          if (cancelled) return;
          composerFocusRef.current?.focus();
        }, 120);
        (task as any).__timeoutId = timeoutId;
      });
      return () => {
        cancelled = true;
        const timeoutId = (task as any).__timeoutId;
        if (timeoutId) clearTimeout(timeoutId);
        task.cancel?.();
      };
    }, [autoOpenKeyboard, targetMessageId, dmBlocked]),
  );

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

      // Snapshot the user's current scroll offset so "Back to reply" can
      // return them exactly where they were — not just to the bottom.
      // For the inverted list, this offset is a direction-correct value
      // that scrollToOffset can consume verbatim.
      const snapshotOffset =
        messageListRef.current.getLastScrollOffset?.() ?? 0;
      returnScrollOffsetRef.current = snapshotOffset;
      returnIndexRef.current = 0; // retained for back-compat only
      setShowReturnButton(true);

      // Scroll to target message
      messageListRef.current.scrollToIndex(targetIndex, true);

      requestAnimationFrame(() => {
        setHighlightedMessageId(messageId);

        // Auto-clear highlight after animation
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedMessageId(null);
        }, 2100); // Match animation duration
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Handle return button press — restore the exact scroll position the
  // user was at before tapping the reply.  If we failed to capture an
  // offset for some reason, fall back to scroll-to-latest.
  const handleReturnToReply = useCallback(() => {
    const snapshotOffset = returnScrollOffsetRef.current;
    screen.chat.clearMessageAnchor();
    setShowReturnButton(false);
    returnIndexRef.current = null;
    returnScrollOffsetRef.current = null;

    if (!messageListRef.current) return;
    requestAnimationFrame(() => {
      if (snapshotOffset !== null) {
        messageListRef.current?.scrollToOffset?.(snapshotOffset, true);
      } else {
        messageListRef.current?.scrollToBottom(true);
      }
    });
  }, [screen.chat]);

  // Auto-scroll to targetMessageId from search navigation (deep jump)
  const hasScrolledToTargetRef = useRef(false);
  const deepJumpSyncingRef = useRef(false);

  // Reset deep-jump refs when targetMessageId changes
  const targetJumpKey = jumpRequestId ?? targetMessageId ?? null;
  const prevTargetJumpKeyRef = useRef(targetJumpKey);
  useEffect(() => {
    if (targetJumpKey !== prevTargetJumpKeyRef.current) {
      prevTargetJumpKeyRef.current = targetJumpKey;
      hasScrolledToTargetRef.current = false;
      deepJumpSyncingRef.current = false;
      // Reset FlatList scrollToIndex retry budget so a re-jump to the
      // same index gets a fresh set of attempts instead of immediately
      // falling back to `highestMeasuredFrameIndex`.
      messageListRef.current?.resetScrollToIndexAttempts?.();
    }
  }, [targetJumpKey]);

  useEffect(() => {
    if (
      !targetMessageId ||
      !chatId ||
      hasScrolledToTargetRef.current ||
      deepJumpSyncingRef.current
    ) {
      return;
    }

    const targetIndex = timelineData.findIndex(
      (item) => item.type === "message" && item.data.id === targetMessageId,
    );
    if (targetIndex !== -1) {
      hasScrolledToTargetRef.current = true;
      requestAnimationFrame(() => {
        scrollToMessage(targetMessageId);
      });
      return;
    }

    if (screen.chat.loadAroundMessage(targetMessageId)) {
      return;
    }

    deepJumpSyncingRef.current = true;
    // Larger window (50) matches useLocalMessages.loadAroundMessage's default
    // so that after Firestore sync, SQLite has enough neighbours for the
    // anchor read to succeed and for FlatList's virtualization to have a
    // realistic chance of mounting the target cell on the first scroll
    // attempt.  Also critical for "far up" jumps from threads.
    syncMessagesAroundTarget("dm", chatId, targetMessageId, 50)
      .then((found) => {
        if (found) {
          if (!screen.chat.loadAroundMessage(targetMessageId)) {
            screen.chat.refresh();
            // SQLite still cannot locate the anchor even after a successful
            // Firestore sync - surface a toast instead of silently leaving
            // the user on the latest page.
            showInfo("Message not found");
          }
        } else {
          logger.warn(
            `[ChatScreen] Target message ${targetMessageId} not found on server`,
          );
          showInfo("Message not found");
        }
      })
      .catch((err) => {
        logger.warn("[ChatScreen] syncMessagesAroundTarget failed:", err);
        showInfo("Couldn't load that message");
      })
      .finally(() => {
        deepJumpSyncingRef.current = false;
      });
  }, [
    targetMessageId,
    timelineData,
    scrollToMessage,
    screen.chat.loadAroundMessage,
    screen.chat.refresh,
    chatId,
    showInfo,
  ]);
  // Auto-hide return button callback.  Intentionally does NOT clear
  // the scroll snapshot so that, when the pill fades into the return-to-
  // bottom pill, the user can still recover their prior position via
  // the scroll-to-latest path.  The snapshot is cleared only when the
  // user explicitly presses "Back to reply".
  const handleReturnButtonAutoHide = useCallback(() => {
    setShowReturnButton(false);
    returnIndexRef.current = null;
    returnScrollOffsetRef.current = null;
  }, []);

  // Tap sends the equipped animal directly into chat + plays its sound.
  const handleAnimalPress = useCallback(() => {
    if (!uid || !animalEntitlement.canSend) return;
    const animalId = animalEntitlement.equippedAnimalId;
    playAnimalSound(animalId);
    sendAnimalSignalMessage({ chat: screen.chat, animalId });
  }, [
    uid,
    animalEntitlement.canSend,
    animalEntitlement.equippedAnimalId,
    screen.chat,
  ]);

  // Holding the animal button opens the full animal customization picker.
  const handleAnimalAlternatePress = useCallback(() => {
    if (!uid) return;
    navigation.navigate("Customization", {
      initialSection: "chat",
      initialTab: "chat_animal_theme",
    });
  }, [navigation, uid]);

  const handleBlockConfirm = useCallback(
    async (reason?: string) => {
      if (!uid) return;
      const success = await blockUser(uid, friendUid, reason);
      setBlockModalVisible(false);
      if (success) {
        // Navigate away FIRST to tear down subscriptions immediately,
        // then show the confirmation alert on the previous screen.
        navigation.goBack();
        // Use setTimeout so the alert shows after navigation completes
        setTimeout(() => {
          Alert.alert(
            "User Blocked",
            `${friendProfile?.username || "User"} has been blocked.`,
          );
        }, 100);
      } else {
        Alert.alert("Error", "Failed to block user. Please try again.");
      }
    },
    [uid, friendUid, friendProfile?.username, navigation],
  );

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
      if (!uid || gameInviteCreating) return;

      // Resolve chatId on-demand if the screen was opened without one
      // (e.g. from ProfilePreview, FriendsScreen, or CallsScreen).
      let resolvedChatId = chatId;
      if (!resolvedChatId) {
        try {
          resolvedChatId = await getOrCreateChat(uid, friendUid);
          setChatId(resolvedChatId);
        } catch (initErr: any) {
          console.warn(
            "[ChatScreen] Game invite blocked — chat init failed:",
            initErr?.message,
          );
          Alert.alert(
            "Game Error",
            initErr?.message?.includes("Cannot chat")
              ? "You cannot send a game invite to this user."
              : "Could not initialize chat. Please try again.",
          );
          return;
        }
      }

      setGameInviteCreating(true);
      try {
        console.log(
          `[ChatScreen] Creating DM game invite: game=${gameId} chat=${resolvedChatId}`,
        );
        const { inviteId } = await createGameInvite({
          conversationId: resolvedChatId,
          conversationScope: "dm",
          gameId,
        });
        navigation.navigate("GameLobbyV4", { inviteId });
      } catch (err: any) {
        console.warn("[ChatScreen] Game invite creation failed:", err?.message);
        const msg =
          err?.code === "functions/not-found" || err?.message === "not-found"
            ? "Game service is not available. Please make sure Cloud Functions are deployed."
            : (err?.message ?? "Failed to create game invite");
        Alert.alert("Game Error", msg);
      } finally {
        setGameInviteCreating(false);
      }
    },
    [chatId, uid, friendUid, navigation, gameInviteCreating],
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
    ({ item, index }: { item: TimelineItem<MessageV2>; index: number }) => {
      if (item.type === "date-divider") {
        return <DateDivider label={item.label} />;
      }
      const msg = item.data;
      // Scorecards can ride inside either `system` (legacy/backend) or
      // `text` (user-shared via the in-app Share Scorecard sheet). Both
      // decode to the same rich `<GameScorecard />` row.
      if (msg.kind === "system" || msg.kind === "text") {
        const scorecard = decodeScorecardText(msg.text);
        if (scorecard) {
          return (
            <View style={dmScorecardStyles.container}>
              <GameScorecard payload={scorecard} />
            </View>
          );
        }
      }
      if (msg.kind === "system") {
        return <SystemMessageChip text={safeSystemText(msg.text)} />;
      }

      // Neighbor IDs for width-aware right-side corners.
      // In the inverted FlatList (newest-first), "previous" (visually above)
      // lives at index + 1, and "next" (visually below) lives at index - 1.
      const aboveTl = timelineDataRef.current[index + 1];
      const groupPrevMsgId =
        item.isGroupedWithPrevious && aboveTl?.type === "message"
          ? aboveTl.data.id
          : undefined;
      const belowTl = timelineDataRef.current[index - 1];
      const groupNextMsgId =
        item.isGroupedWithNext && belowTl?.type === "message"
          ? belowTl.data.id
          : undefined;

      const renderedReactions =
        messageReactionsRef.current.get(msg.id) ??
        (() => {
          const cached = fallbackReactionsRef.current.get(msg.id);
          if (cached) return cached;
          if (!uid || !msg.reactionsSummary) return EMPTY_REACTIONS;
          const parsed = parseReactionsFromMessage(msg.reactionsSummary, uid);
          fallbackReactionsRef.current.set(msg.id, parsed);
          return parsed;
        })();

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
            isHighlighted={msg.id === highlightedMessageIdRef.current}
            reactions={renderedReactions}
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
            newestStatusMessageId={newestStatusMessageIdRef.current}
            cornerWidthStore={cornerWidthStore}
            groupPrevMessageId={groupPrevMsgId}
            groupNextMessageId={groupNextMsgId}
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
      interactionLocked={toolbar.isEditing}
      editModeActivationDurationMs={getToolbarItemEditModeLongPressDuration(
        "camera",
      )}
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
  useMemo(() => {
    setChatScrollViewConfig({
      offset: 0,
      keyboardLiftBehavior: "whenAtEnd",
      blankSpace: sheetExtraPadding,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetExtraPadding]);
  const renderScrollComponent = useRenderChatScrollComponent();

  return (
    <>
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
              newestMessageId={displayMessages[0]?.id}
              renderScrollComponent={renderScrollComponent}
              pillBottomOffset={12}
              suppressReturnToBottom={showReturnButton}
              isKeyboardOpen={screen.keyboard.isKeyboardOpen}
              onDismissTransientUi={dismissAllTransientUi}
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
                onEndReachedThreshold: 0.5,
                windowSize: listConfig.windowSize,
                initialNumToRender: listConfig.initialNumToRender,
                maxToRenderPerBatch: listConfig.maxToRenderPerBatch,
                updateCellsBatchingPeriod: listConfig.updateCellsBatchingPeriod,
              }}
            />
          )}

          {/* Back-to-Reply button.  Rendered INSIDE SheetDismissLayer so it
              shares the same containing block as ReturnToBottomPill (which
              lives inside ChatMessageList). With both measured from the
              composer-top edge, `bottomOffset={12}` visually aligns the
              two buttons at the same Y. When Back-to-Reply fades out,
              ReturnToBottomPill can fade in at the exact same spot. */}
          <ScrollReturnButton
            visible={showReturnButton}
            onPress={handleReturnToReply}
            onAutoHide={handleReturnButtonAutoHide}
            autoHideDelay={screen.chat.isMessageAnchorActive ? 0 : 5000}
            bottomOffset={12}
          />
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

          {dmBlocked ? (
            <View style={styles.blockedBanner}>
              <Text
                style={[
                  styles.blockedBannerText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                You can't send messages in this conversation.
              </Text>
            </View>
          ) : (
            <ChatComposer
              scope="dm"
              value={screen.composer.text}
              onChangeText={handleTextChange}
              onSend={handleSendMessage}
              composerFocusRef={composerFocusRef}
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
              onAnimalAlternatePress={handleAnimalAlternatePress}
              animalThemeId={animalEntitlement.equippedAnimalId}
              animalDisabled={!uid || !animalEntitlement.canSend}
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
          )}
          <KeyboardSafeAreaSpacer />
        </ChatFooterWrapper>
      </ChatKeyboardContainer>

      {blockModalVisible && (
        <SuspenseBlockUserModal
          visible={blockModalVisible}
          username={friendProfile?.username || "User"}
          onCancel={() => setBlockModalVisible(false)}
          onConfirm={handleBlockConfirm}
        />
      )}

      {reportModalVisible && (
        <SuspenseReportUserModal
          visible={reportModalVisible}
          username={friendProfile?.username || "User"}
          onSubmit={handleReportSubmit}
          onCancel={() => setReportModalVisible(false)}
        />
      )}

      {scheduleModalVisible && (
        <SuspenseScheduleMessageModal
          visible={scheduleModalVisible}
          messagePreview={screen.composer.text}
          onSchedule={handleScheduleMessage}
          onClose={() => setScheduleModalVisible(false)}
        />
      )}

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

      {fullEmojiPickerOpen && (
        <SuspenseFullEmojiPicker
          open={fullEmojiPickerOpen}
          onClose={() => setFullEmojiPickerOpen(false)}
          onEmojiSelected={handleFullEmojiReaction}
        />
      )}

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
    </>
  );
}

// ==========================================================================
// Styles
// ==========================================================================

const dmScorecardStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 8,
  },
});

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
  blockedBanner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  blockedBannerText: {
    fontSize: 14,
    textAlign: "center",
  },
});
