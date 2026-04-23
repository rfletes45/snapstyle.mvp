/**
 * ThreadScreen
 *
 * Dedicated thread view that shows the root message at the top,
 * followed by all replies in the thread in chronological order,
 * with a composer at the bottom for adding new replies.
 *
 * Modernized to reuse ChatMessageRenderer for full message-type support,
 * display-mode awareness, reactions, and chat appearance.
 *
 * Navigation params:
 *   conversationId: string
 *   scope: "dm" | "group"
 *   rootMessageId: string
 *
 * @module screens/chat/ThreadScreen
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Shared keyboard architecture
import {
  ChatFooterWrapper,
  ChatKeyboardContainer,
  KeyboardSafeAreaSpacer,
  setChatScrollViewConfig,
  useRenderChatScrollComponent,
} from "@/components/chat/ChatKeyboardScrollView";

// Chat rendering pipeline
import { MediaViewerModal, MessageActionsSheet } from "@/components/chat";
import { CameraLongPressButton } from "@/components/chat/CameraLongPressButton";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatMessageRenderer } from "@/components/chat/ChatMessageRenderer";
import { SheetDismissLayer } from "@/components/chat/SheetDismissLayer";
import { VoiceRecordButton } from "@/components/chat/VoiceRecordButton";

// Data services
import {
  getMessageById,
  getThreadMessages,
  insertMessage,
  rowToMessageV2,
} from "@/services/database/messageRepository";
import { getUserProfileByUid } from "@/services/friends";
import {
  applyOptimisticReaction,
  type ReactionSummary,
  subscribeToMultipleMessageReactions,
  toggleReaction,
} from "@/services/reactions";
import {
  subscribeToConversation,
  syncPendingMessages,
} from "@/services/sync/syncEngine";

// Hooks & Context
import {
  GIF_PICKER_ENABLED,
  STICKER_PICKER_ENABLED,
} from "@/constants/featureFlags";
import { useDismissTransientUiOnBlur } from "@/contexts/ComposerSheetContext";
import { useAttachmentPicker } from "@/hooks/useAttachmentPicker";
import { useComposerToolbarLayout } from "@/hooks/useComposerToolbarLayout";
import {
  useVoiceRecorder,
  type VoiceRecording,
} from "@/hooks/useVoiceRecorder";
import { registerGifShare } from "@/services/gif/gifService";
import type { GifItem } from "@/services/gif/types";
import { registerStickerShare } from "@/services/sticker/stickerService";
import type { StickerItem } from "@/services/sticker/types";
import { useAuth } from "@/store/AuthContext";
import { useConversationDisplayMode } from "@/store/ConversationDisplayModeContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";

// Types
import type {
  AttachmentV2,
  LocalAttachment,
  MessageV2,
  ReplyToMetadata,
} from "@/types/messaging";
import type { MainStackParamList } from "@/types/navigation/root";
import { createLogger } from "@/utils/log";
import { createThreadRealtimeLifecycle } from "./threadLifecycle";

const logger = createLogger("ThreadScreen");

type Props = NativeStackScreenProps<MainStackParamList, "ThreadView">;

// =============================================================================
// ThreadScreen Component
// =============================================================================

export default function ThreadScreen({ navigation, route }: Props) {
  const { conversationId, scope, rootMessageId } = route.params;

  const { colors } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { displayMode } = useConversationDisplayMode();
  const { showInfo } = useSnackbar();
  const insets = useSafeAreaInsets();
  const uid = currentFirebaseUser?.uid ?? "";
  const displayName = currentFirebaseUser?.displayName ?? "";
  const chatAppearance = profile?.chatAppearance ?? null;
  const isGroupChat = scope === "group";

  // Dismiss all transient chat UI on navigation blur — ensures no
  // Portal-based sheet survives into the destination screen.
  useDismissTransientUiOnBlur();

  // User's customizable composer toolbar layout.  Threads render the SAME
  // equipped buttons as the main chat so the composer is visually
  // identical.  Unsupported slots in threads (game / schedule / animal)
  // are gracefully handled via Snackbar messages below rather than by
  // removing the buttons.
  const toolbar = useComposerToolbarLayout(uid);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [rootMessage, setRootMessage] = useState<MessageV2 | null>(null);
  const [replies, setReplies] = useState<MessageV2[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<MessageV2>>(null);
  const isMountedRef = useRef(true);
  // Imperative focus handle for the unified ChatComposer.
  const composerFocusRef = useRef<{ focus: () => void } | null>(null);

  // Friend profile (for DM threads)
  const [friendProfile, setFriendProfile] = useState<any>(null);

  // Reactions
  const [messageReactions, setMessageReactions] = useState<
    Map<string, ReactionSummary[]>
  >(new Map());

  // Message actions sheet
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageV2 | null>(
    null,
  );

  // Media viewer
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [viewerAttachments, setViewerAttachments] = useState<AttachmentV2[]>(
    [],
  );
  const [viewerSenderName, setViewerSenderName] = useState("");
  const [viewerTimestamp, setViewerTimestamp] = useState<Date | undefined>();

  // ---------------------------------------------------------------------------
  // Keyboard scroll component (KCSV integration)
  // ---------------------------------------------------------------------------
  useMemo(() => {
    setChatScrollViewConfig({ offset: 0 });
  }, []);
  const renderScrollComponent = useRenderChatScrollComponent();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Thread keyboard lifecycle ──────────────────────────────────────
  // Threads must ALWAYS open with the keyboard closed — we intentionally
  // do NOT autofocus the composer on entry.  We also force the keyboard
  // closed on blur/unmount so thread keyboard state never leaks back
  // into the parent chat.
  useFocusEffect(
    useCallback(() => {
      Keyboard.dismiss();
      return () => {
        Keyboard.dismiss();
      };
    }, []),
  );

  // ---------------------------------------------------------------------------
  // Load messages
  // ---------------------------------------------------------------------------
  const loadThread = useCallback(() => {
    try {
      // Load root message
      const rootRow = getMessageById(rootMessageId);
      if (rootRow) {
        const converted = rowToMessageV2(rootRow, uid);
        if (isMountedRef.current) {
          setRootMessage(converted);
        }
      }

      // Load thread replies
      const threadRows = getThreadMessages(rootMessageId);
      const converted = threadRows
        .map((row) => rowToMessageV2(row, uid))
        .filter((m): m is MessageV2 => m !== null);
      if (isMountedRef.current) {
        setReplies(converted);
      }
    } catch (err) {
      logger.error("[ThreadScreen] Failed to load thread:", err);
    }
  }, [rootMessageId, uid]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Subscribe to conversation updates and reload thread from local DB when new
  // messages are synced.
  useEffect(() => {
    if (!conversationId) return;

    return createThreadRealtimeLifecycle({
      scope,
      conversationId,
      subscribeFn: subscribeToConversation,
      onConversationUpdate: loadThread,
    });
  }, [scope, conversationId, loadThread]);

  // ---------------------------------------------------------------------------
  // Fetch friend profile (DM threads)
  // ---------------------------------------------------------------------------
  const friendUid = useMemo(() => {
    if (isGroupChat) return null;
    const allMessages = rootMessage ? [rootMessage, ...replies] : replies;
    return (
      allMessages.find((m) => m.senderId && m.senderId !== uid)?.senderId ??
      null
    );
  }, [rootMessage, replies, uid, isGroupChat]);

  useEffect(() => {
    if (!friendUid) return;
    let cancelled = false;
    getUserProfileByUid(friendUid)
      .then((p) => {
        if (p && !cancelled && isMountedRef.current) setFriendProfile(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [friendUid]);

  // ---------------------------------------------------------------------------
  // Reactions subscription
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const allIds = rootMessage
      ? [rootMessage.id, ...replies.map((r) => r.id)]
      : replies.map((r) => r.id);
    if (!allIds.length || !conversationId) return;
    return subscribeToMultipleMessageReactions(
      scope,
      conversationId,
      allIds,
      uid,
      (reactionsMap) => {
        if (isMountedRef.current) setMessageReactions(reactionsMap);
      },
    );
  }, [scope, conversationId, rootMessage?.id, replies.length, uid]);

  // ---------------------------------------------------------------------------
  // Grouping — disabled in threads
  //
  // In threads every reply is treated as an INDEPENDENT message — we
  // never visually group replies (even from the same sender sent
  // moments apart).  This makes each reply's sender, timestamp and
  // status glyph always visible, which is the behaviour the product
  // requires.  `renderItem` below hard-codes both grouping flags to
  // `false`.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Interaction handlers
  // ---------------------------------------------------------------------------
  const handleReply = useCallback((_replyTo: ReplyToMetadata) => {
    // No-op: threads do not support reply-to-a-reply.  SwipeableMessage
    // is disabled inside threads (`inThread={true}`) and the Reply
    // action is hidden from `MessageActionsSheet` (`hideReply={true}`),
    // so this handler should never be invoked in practice.
  }, []);

  const handleLongPress = useCallback((message: MessageV2) => {
    setSelectedMessage(message);
    setActionsSheetVisible(true);
  }, []);

  const handleScrollToMessage = useCallback(
    (messageId: string) => {
      // Threads are a drill-down view into a parent chat.  When the user
      // taps a referenced/replied message from inside a thread, bring
      // them to that message in the PARENT chat — not to the message
      // within the thread (and definitely not nowhere, which was the
      // previous behaviour).
      //
      // Stack safety: the MainStack navigator defines `getId` on both
      // ChatDetail (by friendUid) and GroupChat (by groupId).  That means
      // `navigation.navigate()` pops back to the EXISTING parent chat
      // screen instead of pushing a duplicate, which fully eliminates
      // the "infinite chain of duplicate chats" bug that this handler
      // used to cause.
      //
      // Jump re-arming: we always pass a fresh `jumpRequestId` so the
      // parent screen's deep-jump effect re-fires even when the user
      // taps the SAME referenced message twice in a row.  Without this,
      // repeat-taps were silently no-ops once `hasScrolledToTargetRef`
      // latched on the first tap.
      if (!messageId) return;

      const jumpRequestId = `thread-${Date.now()}`;

      if (scope === "dm") {
        // Find the "other" participant from the loaded thread messages.
        const allMessages = rootMessage ? [rootMessage, ...replies] : replies;
        const other = allMessages.find(
          (m) => m.senderId && m.senderId !== uid,
        )?.senderId;
        if (!other) {
          navigation.goBack();
          return;
        }
        navigation.navigate("ChatDetail" as any, {
          friendUid: other,
          targetMessageId: messageId,
          jumpRequestId,
        });
      } else {
        navigation.navigate("GroupChat" as any, {
          groupId: conversationId,
          targetMessageId: messageId,
          jumpRequestId,
        });
      }
    },
    [scope, rootMessage, replies, uid, conversationId, navigation],
  );

  const handleRetryMessage = useCallback(
    async (_message: MessageV2) => {
      await syncPendingMessages().catch((err) => {
        logger.error("[ThreadScreen] Retry sync failed:", err);
      });
      loadThread();
    },
    [loadThread],
  );

  const handleImagePress = useCallback(
    (imageUrl: string, senderName: string, timestamp: Date) => {
      setViewerAttachments([
        {
          id: "thread-image",
          kind: "photo" as any,
          mime: "image/jpeg",
          url: imageUrl,
          path: "",
          sizeBytes: 0,
        },
      ]);
      setViewerSenderName(senderName);
      setViewerTimestamp(timestamp);
      setMediaViewerVisible(true);
    },
    [],
  );

  // Body-tap handler used when `inThread={true}` on the renderer.
  // Tapping any reply inside a thread jumps to that exact message in
  // the parent chat — the user's primary mental model of "open the
  // thread, see context, jump to the conversation point".  Tapping the
  // thread root navigates back to the parent chat at the root's own
  // location (same UX as tapping any other thread message).
  const handleMessageTap = useCallback(
    (m: MessageV2) => {
      handleScrollToMessage(m.id);
    },
    [handleScrollToMessage],
  );

  const handleOptimisticReaction = useCallback(
    (messageId: string, emoji: string) => {
      setMessageReactions((prev) => {
        const next = new Map(prev);
        const current = next.get(messageId) || [];
        next.set(messageId, applyOptimisticReaction(current, emoji, uid));
        return next;
      });
      toggleReaction({
        scope,
        conversationId,
        messageId,
        emoji,
        uid,
      }).catch(() => {});
    },
    [scope, conversationId, uid],
  );

  const handleActionsClose = useCallback(() => {
    setActionsSheetVisible(false);
    setSelectedMessage(null);
  }, []);

  const handleActionsReply = useCallback((_replyTo: ReplyToMetadata) => {
    setActionsSheetVisible(false);
    setSelectedMessage(null);
  }, []);

  const handleReactionAdded = useCallback(
    (emoji: string) => {
      if (!selectedMessage) return;
      handleOptimisticReaction(selectedMessage.id, emoji);
    },
    [selectedMessage, handleOptimisticReaction],
  );

  // ---------------------------------------------------------------------------
  // Emoji insertion (parity with ChatScreen)
  // ---------------------------------------------------------------------------
  const handleEmojiInsert = useCallback((emoji: string) => {
    setReplyText((prev) => prev + emoji);
  }, []);

  // ---------------------------------------------------------------------------
  // Thread-scoped send helpers
  //
  // Threads cannot reuse `useChat().sendMessage` directly because that hook
  // owns the parent conversation's message list — invoking it from a
  // thread would emit the reply into the main conversation without
  // `thread_root_id` and skip the thread subscription entirely.
  //
  // Instead we write directly to SQLite via `insertMessage()`, which
  // already accepts `threadRootId`, and then trigger `syncPendingMessages()`
  // so the background uploader uploads local attachments and posts the row
  // to the Firestore thread subcollection.  The main conversation also
  // receives the thread-root updates via the server-side trigger, so
  // `lastThreadMessage` + `replyCount` stay in sync.
  // ---------------------------------------------------------------------------
  const insertThreadMessage = useCallback(
    (params: {
      kind: "text" | "media" | "voice";
      text?: string;
      attachments?: AttachmentV2[];
      localAttachments?: LocalAttachment[];
      replyTo?: ReplyToMetadata;
    }) => {
      insertMessage({
        conversationId,
        scope,
        senderId: uid,
        senderName: displayName,
        kind: params.kind,
        text: params.text,
        attachments: params.attachments,
        localAttachments: params.localAttachments,
        replyTo: params.replyTo,
        threadRootId: rootMessageId,
      });
      loadThread();
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      syncPendingMessages().catch((err) => {
        logger.error("[ThreadScreen] Background sync failed:", err);
      });
    },
    [conversationId, scope, uid, displayName, rootMessageId, loadThread],
  );

  // Camera capture + gallery pick → send as media reply in thread.
  const handleDirectCameraSend = useCallback(
    async (imageUri: string) => {
      if (!uid || sending) return;
      try {
        insertThreadMessage({
          kind: "media",
          localAttachments: [
            {
              id: `cam_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              uri: imageUri,
              kind: "image",
              mime: "image/jpeg",
            },
          ],
        });
      } catch (err) {
        logger.error("[ThreadScreen] Camera send failed:", err);
        Alert.alert("Error", "Failed to send photo");
      }
    },
    [uid, sending, insertThreadMessage],
  );

  const handleDirectGallerySend = useCallback(
    async (imageUris: string[]) => {
      if (!uid || sending) return;
      for (const uri of imageUris) {
        try {
          insertThreadMessage({
            kind: "media",
            localAttachments: [
              {
                id: `gal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                uri,
                kind: "image",
                mime: "image/jpeg",
              },
            ],
          });
        } catch (err) {
          logger.error("[ThreadScreen] Gallery send failed:", err);
          Alert.alert("Error", "Failed to send photo");
        }
      }
    },
    [uid, sending, insertThreadMessage],
  );

  const handleGifSelected = useCallback(
    async (gif: GifItem) => {
      if (!uid || sending) return;
      try {
        const attachment: AttachmentV2 = {
          id: `gif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          kind: "image",
          mime: gif.mime ?? "image/gif",
          url: gif.fullUrl,
          path: "",
          sizeBytes: 0,
          width: gif.fullWidth,
          height: gif.fullHeight,
        };
        insertThreadMessage({ kind: "media", attachments: [attachment] });
        registerGifShare(gif.id).catch(() => {});
      } catch (err) {
        logger.error("[ThreadScreen] GIF send failed:", err);
        Alert.alert("Error", "Failed to send GIF");
      }
    },
    [uid, sending, insertThreadMessage],
  );

  const handleStickerSelected = useCallback(
    async (sticker: StickerItem) => {
      if (!uid || sending) return;
      try {
        const attachment: AttachmentV2 = {
          id: `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          kind: "image",
          mime: sticker.mime ?? "image/gif",
          url: sticker.fullUrl,
          path: "",
          sizeBytes: 0,
          width: sticker.fullWidth,
          height: sticker.fullHeight,
        };
        insertThreadMessage({ kind: "media", attachments: [attachment] });
        registerStickerShare(sticker.slug).catch(() => {});
      } catch (err) {
        logger.error("[ThreadScreen] Sticker send failed:", err);
        Alert.alert("Error", "Failed to send sticker");
      }
    },
    [uid, sending, insertThreadMessage],
  );

  const handleVoiceRecordingComplete = useCallback(
    async (recording: VoiceRecording) => {
      if (!uid || sending) return;
      try {
        insertThreadMessage({
          kind: "voice",
          localAttachments: [
            {
              id: `voice_${Date.now()}_${uid}`,
              uri: recording.uri,
              kind: "audio",
              mime: "audio/m4a",
              durationMs: recording.durationMs,
            },
          ],
        });
      } catch (err) {
        logger.error("[ThreadScreen] Voice send failed:", err);
        Alert.alert("Error", "Failed to send voice message");
      }
    },
    [uid, sending, insertThreadMessage],
  );

  // Attachment picker — camera + gallery plumbing identical to ChatScreen,
  // but the camera return route navigates back into THIS thread so users
  // don't pop out to the parent conversation after taking a photo.
  const attachmentPicker = useAttachmentPicker({
    maxAttachments: 10,
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: ["image"],
    routeParams: route.params as Record<string, any>,
    returnRoute: "ThreadView",
    returnData: { conversationId, scope, rootMessageId },
    onCameraCapture: handleDirectCameraSend,
    onGalleryPick: handleDirectGallerySend,
  });

  // Voice recorder — re-used verbatim from ChatScreen.  Availability of the
  // voice button in the composer is toggled per-render based on empty
  // composer text + no tray attachments, matching ChatScreen behaviour.
  const voiceRecorder = useVoiceRecorder({
    maxDuration: 60,
    onRecordingComplete: () => {},
  });

  // Camera tap / long-press handlers for the composer's left accessory.
  // Tap → open native camera (direct send path via `onCameraCapture`).
  // Long press → open gallery picker (direct send path via `onGalleryPick`).
  const handleCaptureFromCamera = useCallback(() => {
    void attachmentPicker.captureFromCamera();
  }, [attachmentPicker]);
  const handleAddAttachment = useCallback(() => {
    void attachmentPicker.pickFromGallery();
  }, [attachmentPicker]);

  // Rendered into the composer's `leftAccessory` slot — which maps to the
  // `camera` toolbar item (see `DEFAULT_TOOLBAR_ITEMS`).  Without this,
  // the camera slot renders as nothing.
  const threadCameraButton = useMemo(
    () => (
      <CameraLongPressButton
        onShortPress={handleCaptureFromCamera}
        onLongPress={handleAddAttachment}
        disabled={sending || attachmentPicker.isMaxReached}
        size={40}
      />
    ),
    [
      handleCaptureFromCamera,
      handleAddAttachment,
      sending,
      attachmentPicker.isMaxReached,
    ],
  );

  // Explicit fallback layout used when the user has never customized
  // their toolbar (or the remote layout hasn't loaded yet).  Mirrors the
  // typical equipped set for new users.
  const threadFallbackToolbarItems = useMemo<typeof toolbar.items>(
    () => [
      { id: "camera", position: 0 },
      { id: "message-bar", position: 1, flexWeight: 1 },
      { id: "gif-sticker", position: 2 },
    ],
    [],
  );

  const effectiveToolbarItems = toolbar.loaded
    ? toolbar.items
    : threadFallbackToolbarItems;

  // ── Thread-scoped graceful fallbacks ──────────────────────────────
  // The game picker, schedule-send, and animal-signal features are all
  // conversation-level operations that have no thread-scoped backend.
  // Rather than removing the buttons from the user's toolbar (which
  // would feel like a downgrade), we keep them visible and show a
  // Snackbar explaining that the action can't be performed from inside
  // a thread.  This matches the user-visible contract of "if equipped,
  // it still appears" without leaving broken button state.
  const showThreadUnsupported = useCallback(
    (feature: string) => {
      showInfo(`${feature} can't be used in threads — open the main chat.`);
    },
    [showInfo],
  );
  const handleGameUnsupported = useCallback(
    () => showThreadUnsupported("Game invites"),
    [showThreadUnsupported],
  );
  const handleScheduleUnsupported = useCallback(
    () => showThreadUnsupported("Scheduled messages"),
    [showThreadUnsupported],
  );
  const handleAnimalUnsupported = useCallback(
    () => showThreadUnsupported("Animal signals"),
    [showThreadUnsupported],
  );

  // ---------------------------------------------------------------------------
  // Send reply (text + pending tray attachments)
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(async () => {
    const trimmed = replyText.trim();
    const trayAttachments = attachmentPicker.attachments;
    const hasText = trimmed.length > 0;
    const hasAttachments = trayAttachments.length > 0;

    if ((!hasText && !hasAttachments) || sending) return;

    setSending(true);
    try {
      // Build reply metadata from root message
      const replyTo: ReplyToMetadata = rootMessage
        ? {
            messageId: rootMessage.id,
            senderId: rootMessage.senderId,
            senderName: rootMessage.senderName,
            kind: rootMessage.kind,
            textSnippet: rootMessage.text?.substring(0, 100),
          }
        : {
            messageId: rootMessageId,
            senderId: "",
            kind: "text",
          };

      if (hasAttachments) {
        // Media-with-caption: mirror the main chat convention by sending a
        // single media message carrying the text as its caption.
        insertThreadMessage({
          kind: "media",
          text: hasText ? trimmed : undefined,
          localAttachments: [...trayAttachments],
          replyTo,
        });
        attachmentPicker.clearAttachments();
      } else {
        insertThreadMessage({
          kind: "text",
          text: trimmed,
          replyTo,
        });
      }

      setReplyText("");
    } catch (err) {
      logger.error("[ThreadScreen] Failed to send reply:", err);
    } finally {
      setSending(false);
    }
  }, [
    replyText,
    sending,
    rootMessage,
    rootMessageId,
    attachmentPicker,
    insertThreadMessage,
  ]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const currentUserDisplayName =
    profile?.displayName ||
    profile?.username ||
    currentFirebaseUser?.displayName ||
    "Me";
  const currentUserProfilePictureUrl =
    (profile as any)?.profilePicture?.url ?? null;
  const currentUserDecorationId =
    (profile as any)?.avatarDecoration?.decorationId ?? null;

  const renderRootMessage = useCallback(() => {
    if (!rootMessage) return null;
    // Root is ALWAYS rendered at full opacity regardless of its
    // `status` field.  The thread root is, by definition, an existing
    // message from the parent chat — it is never in a failed/sending
    // state from the thread's perspective.  We force `status: "sent"`
    // here defensively so no renderer in the pipeline can dim a media
    // root just because its local `sync_status` row temporarily shows
    // something other than "synced" (e.g. during a re-sync window).
    const rootForRender: MessageV2 =
      rootMessage.status === "sent"
        ? rootMessage
        : { ...rootMessage, status: "sent" };

    return (
      <View
        style={[
          styles.rootMessageContainer,
          { borderBottomColor: colors.outline, opacity: 1 },
        ]}
      >
        <ChatMessageRenderer
          message={rootForRender}
          currentUid={uid}
          chatId={conversationId}
          friendProfile={friendProfile}
          chatAppearance={chatAppearance}
          onReply={handleReply}
          onLongPress={handleLongPress}
          onScrollToMessage={handleScrollToMessage}
          onRetry={handleRetryMessage}
          onImagePress={handleImagePress}
          reactions={messageReactions.get(rootMessage.id) || []}
          onOptimisticReaction={handleOptimisticReaction}
          displayMode={displayMode}
          isGroupChat={isGroupChat}
          isGroupedWithPrevious={false}
          isGroupedWithNext={false}
          currentUserDisplayName={currentUserDisplayName}
          currentUserProfilePictureUrl={currentUserProfilePictureUrl}
          currentUserDecorationId={currentUserDecorationId}
          inThread
          onMessageTap={handleMessageTap}
        />
      </View>
    );
  }, [
    rootMessage,
    uid,
    conversationId,
    friendProfile,
    chatAppearance,
    handleReply,
    handleLongPress,
    handleScrollToMessage,
    handleRetryMessage,
    handleImagePress,
    handleMessageTap,
    messageReactions,
    handleOptimisticReaction,
    displayMode,
    isGroupChat,
    currentUserDisplayName,
    currentUserProfilePictureUrl,
    currentUserDecorationId,
    colors.outline,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: MessageV2; index: number }) => {
      // Threads always render each reply as an independent message —
      // no visual grouping, no shared timestamp collapsing.
      return (
        <ChatMessageRenderer
          message={item}
          currentUid={uid}
          chatId={conversationId}
          friendProfile={friendProfile}
          chatAppearance={chatAppearance}
          onReply={handleReply}
          onLongPress={handleLongPress}
          onScrollToMessage={handleScrollToMessage}
          onRetry={handleRetryMessage}
          onImagePress={handleImagePress}
          reactions={messageReactions.get(item.id) || []}
          onOptimisticReaction={handleOptimisticReaction}
          displayMode={displayMode}
          isGroupChat={isGroupChat}
          isGroupedWithPrevious={false}
          isGroupedWithNext={false}
          currentUserDisplayName={currentUserDisplayName}
          currentUserProfilePictureUrl={currentUserProfilePictureUrl}
          currentUserDecorationId={currentUserDecorationId}
          inThread
          onMessageTap={handleMessageTap}
        />
      );
    },
    [
      uid,
      conversationId,
      friendProfile,
      chatAppearance,
      handleReply,
      handleLongPress,
      handleScrollToMessage,
      handleRetryMessage,
      handleImagePress,
      handleMessageTap,
      messageReactions,
      handleOptimisticReaction,
      displayMode,
      isGroupChat,
      currentUserDisplayName,
      currentUserProfilePictureUrl,
      currentUserDecorationId,
    ],
  );

  const keyExtractor = useCallback((item: MessageV2) => item.id, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.outline }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Thread</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </Text>
      </View>

      <ChatKeyboardContainer
        style={[styles.flex, { backgroundColor: colors.background }]}
      >
        {/* SheetDismissLayer: tapping/scrolling above the composer collapses
            any active picker sheet, matching main-chat behaviour. */}
        <SheetDismissLayer style={styles.flex}>
          {/* Root message */}
          {renderRootMessage()}

          {/* Thread replies */}
          <FlatList
            ref={flatListRef}
            data={replies}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            renderScrollComponent={renderScrollComponent}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  No replies yet. Start the conversation!
                </Text>
              </View>
            }
          />
        </SheetDismissLayer>

        {/* Composer — unified with ChatScreen/GroupChatScreen.  Threads
            render the user's equipped toolbar layout verbatim so the
            composer is visually and behaviorally identical (height,
            spacing, buttons).  Thread-scoped handlers back every slot:
            camera / gif / sticker / emoji / voice / image-picker send
            messages directly via `insertMessage` with `threadRootId`.
            Game, schedule, and animal are conversation-level operations
            with no thread-scoped backend — tapping them surfaces a
            Snackbar explaining the limitation (rather than silently
            doing nothing or opening a broken modal).  Toolbar edit mode
            is NOT wired here: equipping/unequipping buttons still
            happens from the main chat. */}
        <ChatFooterWrapper>
          <ChatComposer
            scope={isGroupChat ? "group" : "dm"}
            value={replyText}
            onChangeText={setReplyText}
            onSend={handleSend}
            composerFocusRef={composerFocusRef}
            sendDisabled={
              (!replyText.trim() &&
                attachmentPicker.attachments.length === 0) ||
              sending
            }
            isSending={sending}
            placeholder="Reply in thread..."
            currentUid={uid}
            toolbarItems={effectiveToolbarItems}
            leftAccessory={threadCameraButton}
            onEmojiSelected={handleEmojiInsert}
            onGifSelected={GIF_PICKER_ENABLED ? handleGifSelected : undefined}
            onStickerSelected={
              STICKER_PICKER_ENABLED ? handleStickerSelected : undefined
            }
            onImagesPicked={handleDirectGallerySend}
            imagePickerDisabled={sending}
            // Thread-unsupported slots: surface a Snackbar instead of
            // opening the picker / performing the action.
            onGamePress={handleGameUnsupported}
            onSchedulePress={handleScheduleUnsupported}
            onAnimalPress={handleAnimalUnsupported}
            voiceButtonComponent={
              voiceRecorder.isAvailable && !replyText.trim() ? (
                <VoiceRecordButton
                  onRecordingComplete={handleVoiceRecordingComplete}
                  onRecordingCancelled={() => {}}
                  disabled={sending}
                  size={32}
                  maxDuration={60000}
                />
              ) : undefined
            }
          />
          <KeyboardSafeAreaSpacer />
        </ChatFooterWrapper>
      </ChatKeyboardContainer>

      {/* Message Actions Sheet */}
      <MessageActionsSheet
        visible={actionsSheetVisible}
        message={selectedMessage}
        currentUid={uid}
        onClose={handleActionsClose}
        onReply={handleActionsReply}
        onReactionAdded={handleReactionAdded}
        hideReply
      />

      {/* Media Viewer */}
      <MediaViewerModal
        visible={mediaViewerVisible}
        attachments={viewerAttachments}
        initialIndex={0}
        onClose={() => setMediaViewerVisible(false)}
        senderName={viewerSenderName}
        timestamp={viewerTimestamp}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginRight: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "400",
  },

  // Root message
  rootMessageContainer: {
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },

  // List
  listContent: {
    paddingBottom: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },

  // Composer
  composerBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  input: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    marginBottom: 2,
  },
});
