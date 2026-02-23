/**
 * ThreadScreen
 *
 * Dedicated thread view that shows the root message at the top,
 * followed by all replies in the thread in chronological order,
 * with a composer at the bottom for adding new replies.
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
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ReplyBubble } from "@/components/chat";
import {
  getMessageById,
  getThreadMessages,
  insertMessage,
  rowToMessageV2,
} from "@/services/database/messageRepository";
import { syncPendingMessages } from "@/services/sync/syncEngine";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MessageV2, ReplyToMetadata } from "@/types/messaging";
import type { MainStackParamList } from "@/types/navigation/root";
import { createLogger } from "@/utils/log";

const logger = createLogger("ThreadScreen");

type Props = NativeStackScreenProps<MainStackParamList, "ThreadView">;

// =============================================================================
// ThreadScreen Component
// =============================================================================

export default function ThreadScreen({ navigation, route }: Props) {
  const { conversationId, scope, rootMessageId } = route.params;

  const { colors, isDark } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";
  const displayName = currentFirebaseUser?.displayName ?? "";

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [rootMessage, setRootMessage] = useState<MessageV2 | null>(null);
  const [replies, setReplies] = useState<MessageV2[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<MessageV2>>(null);

  // ---------------------------------------------------------------------------
  // Load messages
  // ---------------------------------------------------------------------------
  const loadThread = useCallback(() => {
    try {
      // Load root message
      const rootRow = getMessageById(rootMessageId);
      if (rootRow) {
        const converted = rowToMessageV2(rootRow, uid);
        setRootMessage(converted);
      }

      // Load thread replies
      const threadRows = getThreadMessages(rootMessageId);
      const converted = threadRows
        .map((row) => rowToMessageV2(row, uid))
        .filter((m): m is MessageV2 => m !== null);
      setReplies(converted);
    } catch (err) {
      logger.error("[ThreadScreen] Failed to load thread:", err);
    }
  }, [rootMessageId, uid]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Auto-refresh every 3 seconds to pick up synced messages
  useEffect(() => {
    const interval = setInterval(loadThread, 3000);
    return () => clearInterval(interval);
  }, [loadThread]);

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

  /** Render a single message row */
  const renderMessage = useCallback(
    (message: MessageV2, isRoot: boolean) => {
      const isOwn = message.senderId === uid;
      return (
        <View
          style={[
            styles.messageRow,
            isRoot && styles.rootMessageRow,
            isRoot && { borderBottomColor: colors.outline },
          ]}
        >
          {/* Sender name */}
          {!isOwn && (
            <Text style={[styles.senderName, { color: colors.primary }]}>
              {message.senderName || "Unknown"}
            </Text>
          )}

          {/* Reply preview (for non-root messages that reply to other thread members) */}
          {!isRoot && message.replyTo && (
            <ReplyBubble
              replyTo={message.replyTo}
              isSentByMe={isOwn}
              isReplyToMe={message.replyTo.senderId === uid}
            />
          )}

          {/* Bubble */}
          <View
            style={[
              styles.bubble,
              isOwn
                ? [styles.ownBubble, { backgroundColor: colors.primary }]
                : [
                    styles.otherBubble,
                    {
                      backgroundColor: isDark
                        ? colors.surfaceVariant
                        : "#F0F0F0",
                    },
                  ],
            ]}
          >
            <Text
              style={[
                styles.messageText,
                { color: isOwn ? "#FFFFFF" : colors.text },
              ]}
            >
              {message.text || ""}
            </Text>
          </View>

          {/* Timestamp */}
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {new Date(
              message.serverReceivedAt || message.createdAt,
            ).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      );
    },
    [uid, colors, isDark],
  );

  const renderItem = useCallback(
    ({ item }: { item: MessageV2 }) => renderMessage(item, false),
    [renderMessage],
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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Root message */}
        {rootMessage && renderMessage(rootMessage, true)}

        {/* Thread replies */}
        <FlatList
          ref={flatListRef}
          data={replies}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No replies yet. Start the conversation!
              </Text>
            </View>
          }
        />

        {/* Composer */}
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
                backgroundColor: isDark ? colors.surfaceVariant : "#F0F0F0",
                borderColor: colors.outline,
              },
            ]}
          >
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Reply in thread..."
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[styles.input, { color: colors.text }]}
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
                replyText.trim() && !sending ? "#FFFFFF" : colors.textSecondary
              }
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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

  // Message rows
  messageRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  rootMessageRow: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  senderName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: "85%",
  },
  ownBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: "flex-end",
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
