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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
import { ChatMessageRenderer } from "@/components/chat/ChatMessageRenderer";

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
import { useDismissTransientUiOnBlur } from "@/contexts/ComposerSheetContext";
import { useAuth } from "@/store/AuthContext";
import { useConversationDisplayMode } from "@/store/ConversationDisplayModeContext";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";

// Types
import type {
  AttachmentV2,
  MessageV2,
  ReplyToMetadata,
} from "@/types/messaging";
import type { MainStackParamList } from "@/types/navigation/root";
import { createLogger } from "@/utils/log";
import { createThreadRealtimeLifecycle } from "./threadLifecycle";

const logger = createLogger("ThreadScreen");

/** Messages within this window from the same sender are visually grouped */
const MESSAGE_GROUP_THRESHOLD_MS = 2 * 60 * 1000;

type Props = NativeStackScreenProps<MainStackParamList, "ThreadView">;

// =============================================================================
// ThreadScreen Component
// =============================================================================

export default function ThreadScreen({ navigation, route }: Props) {
  const { conversationId, scope, rootMessageId } = route.params;

  const { colors, isDark } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { displayMode } = useConversationDisplayMode();
  const uid = currentFirebaseUser?.uid ?? "";
  const displayName = currentFirebaseUser?.displayName ?? "";
  const chatAppearance = profile?.chatAppearance ?? null;
  const isGroupChat = scope === "group";

  // Dismiss all transient chat UI on navigation blur — ensures no
  // Portal-based sheet survives into the destination screen.
  useDismissTransientUiOnBlur();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [rootMessage, setRootMessage] = useState<MessageV2 | null>(null);
  const [replies, setReplies] = useState<MessageV2[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<MessageV2>>(null);
  const isMountedRef = useRef(true);

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
  // Grouping
  // ---------------------------------------------------------------------------
  const areMessagesGrouped = useCallback(
    (a: MessageV2 | null, b: MessageV2 | null): boolean => {
      if (!a || !b) return false;
      if (a.senderId !== b.senderId) return false;
      const timeA = a.serverReceivedAt || a.createdAt;
      const timeB = b.serverReceivedAt || b.createdAt;
      return Math.abs(timeA - timeB) < MESSAGE_GROUP_THRESHOLD_MS;
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Interaction handlers
  // ---------------------------------------------------------------------------
  const handleReply = useCallback((_replyTo: ReplyToMetadata) => {
    // In threads, all replies go to the thread root
  }, []);

  const handleLongPress = useCallback((message: MessageV2) => {
    setSelectedMessage(message);
    setActionsSheetVisible(true);
  }, []);

  const handleScrollToMessage = useCallback((_messageId: string) => {
    // Threads are short — no scroll-to needed
  }, []);

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
  // Send reply
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(async () => {
    const trimmed = replyText.trim();
    if (!trimmed || sending) return;

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

      insertMessage({
        conversationId,
        scope,
        senderId: uid,
        senderName: displayName,
        kind: "text",
        text: trimmed,
        replyTo,
        threadRootId: rootMessageId,
      });

      setReplyText("");

      // Refresh thread list
      loadThread();

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Sync in background
      syncPendingMessages().catch((err) => {
        logger.error("[ThreadScreen] Background sync failed:", err);
      });
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
    conversationId,
    scope,
    uid,
    displayName,
    loadThread,
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
    return (
      <View
        style={[
          styles.rootMessageContainer,
          { borderBottomColor: colors.outline },
        ]}
      >
        <ChatMessageRenderer
          message={rootMessage}
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
    ({ item, index }: { item: MessageV2; index: number }) => {
      const prev = index > 0 ? replies[index - 1] : null;
      const next = index < replies.length - 1 ? replies[index + 1] : null;
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
          isGroupedWithPrevious={areMessagesGrouped(prev, item)}
          isGroupedWithNext={areMessagesGrouped(item, next)}
          currentUserDisplayName={currentUserDisplayName}
          currentUserProfilePictureUrl={currentUserProfilePictureUrl}
          currentUserDecorationId={currentUserDecorationId}
        />
      );
    },
    [
      replies,
      uid,
      conversationId,
      friendProfile,
      chatAppearance,
      handleReply,
      handleLongPress,
      handleScrollToMessage,
      handleRetryMessage,
      handleImagePress,
      messageReactions,
      handleOptimisticReaction,
      displayMode,
      isGroupChat,
      areMessagesGrouped,
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
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
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No replies yet. Start the conversation!
              </Text>
            </View>
          }
        />

        {/* Composer */}
        <ChatFooterWrapper>
          <View
            style={[
              styles.composerBar,
              {
                borderTopColor: colors.outline,
                backgroundColor: colors.background,
              },
            ]}
          >
            <View
              style={[
                styles.composerInput,
                {
                  backgroundColor:
                    colors.inputBackground ?? colors.surfaceVariant,
                  borderColor: colors.outline,
                },
              ]}
            >
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Reply in thread..."
                placeholderTextColor={
                  colors.inputPlaceholder ?? colors.textSecondary
                }
                multiline
                style={[styles.input, { color: colors.text }]}
                selectionColor={colors.primary}
                keyboardAppearance={
                  Platform.OS === "ios"
                    ? isDark
                      ? "dark"
                      : "light"
                    : undefined
                }
                editable={!sending}
                returnKeyType="default"
              />
            </View>

            <TouchableOpacity
              onPress={handleSend}
              disabled={!replyText.trim() || sending}
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    replyText.trim() && !sending
                      ? colors.primary
                      : colors.surfaceVariant,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send reply"
            >
              <MaterialCommunityIcons
                name="send"
                size={20}
                color={
                  replyText.trim() && !sending
                    ? colors.onPrimary
                    : colors.textSecondary
                }
              />
            </TouchableOpacity>
          </View>
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
    </SafeAreaView>
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
