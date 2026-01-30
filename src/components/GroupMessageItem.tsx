/**
 * GroupMessageItem Component (UNI-06 Extraction)
 *
 * Renders a single message in the Group chat screen.
 * Extracted from GroupChatScreen to reduce complexity and enable reuse.
 *
 * Handles:
 * - Text, image, voice, and scorecard messages
 * - Reply-to preview bubbles
 * - Sender name display
 * - Link previews (H12)
 * - Reactions summary (H8)
 * - Long press for actions
 * - Swipe to reply
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import {
  LinkPreviewCard,
  ReactionsSummary,
  ReplyBubble,
  SwipeableGroupMessage,
  VoiceMessagePlayer,
} from "@/components/chat";
import { extractUrls, hasUrls } from "@/services/linkPreview";
import type { ReactionSummary } from "@/services/reactions";
import type {
  AttachmentV2,
  LinkPreviewV2,
  ReplyToMetadata,
} from "@/types/messaging";
import type { GroupMessage } from "@/types/models";

// =============================================================================
// Types
// =============================================================================

interface GroupMessageItemProps {
  /** The message to render */
  message: GroupMessage;
  /** Index in the message list */
  index: number;
  /** All messages (for determining if sender should be shown) */
  allMessages: GroupMessage[];
  /** Current user's UID */
  currentUid: string | undefined;
  /** Group ID */
  groupId: string;
  /** Callback when user swipes to reply */
  onReply: (replyMetadata: ReplyToMetadata) => void;
  /** Callback when user long-presses the message */
  onLongPress: (message: GroupMessage) => void;
  /** Callback to scroll to a specific message (for reply navigation) */
  onScrollToMessage: (messageId: string) => void;
  /** Callback when image is pressed (opens media viewer) */
  onImagePress: (
    attachments: AttachmentV2[],
    index: number,
    senderName: string,
    timestamp: number,
  ) => void;
  /** Link preview for this message (if any) */
  linkPreview?: LinkPreviewV2 | null;
  /** Whether link preview is loading */
  linkPreviewLoading?: boolean;
  /** Reactions for this message */
  reactions?: ReactionSummary[];
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if we should show sender info (different sender from previous message)
 */
function shouldShowSender(
  index: number,
  message: GroupMessage,
  allMessages: GroupMessage[],
): boolean {
  if (message.type === "system") return false;
  if (index === 0) return true;
  const prevMessage = allMessages[index - 1];
  if (prevMessage.type === "system") return true;
  return prevMessage.sender !== message.sender;
}

/**
 * Format timestamp to time string
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Convert image message to AttachmentV2 format for viewer
 */
function getAttachmentFromMessage(msg: GroupMessage): AttachmentV2 | null {
  if (msg.type !== "image") return null;
  return {
    id: msg.id,
    kind: "image",
    mime: "image/jpeg",
    url: msg.content,
    path: msg.imagePath || "",
    sizeBytes: 0,
  };
}

// =============================================================================
// Component
// =============================================================================

export const GroupMessageItem: React.FC<GroupMessageItemProps> = React.memo(
  ({
    message,
    index,
    allMessages,
    currentUid,
    groupId,
    onReply,
    onLongPress,
    onScrollToMessage,
    onImagePress,
    linkPreview,
    linkPreviewLoading,
    reactions = [],
  }) => {
    const theme = useTheme();
    const isOwnMessage = message.sender === currentUid;
    const showSender = shouldShowSender(index, message, allMessages);

    // Handle image press
    const handleImagePress = useCallback(() => {
      const attachment = getAttachmentFromMessage(message);
      if (attachment) {
        onImagePress(
          [attachment],
          0,
          message.senderDisplayName,
          message.createdAt,
        );
      }
    }, [message, onImagePress]);

    // System message
    if (message.type === "system") {
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
            {message.content}
          </Text>
        </View>
      );
    }

    // Convert replyTo to ReplyToMetadata format
    const replyToMetadata: ReplyToMetadata | undefined = message.replyTo
      ? {
          messageId: message.replyTo.messageId,
          senderId: message.replyTo.senderId,
          senderName: message.replyTo.senderName,
          kind:
            message.replyTo.attachmentKind === "image"
              ? "media"
              : message.replyTo.attachmentKind === "voice"
                ? "voice"
                : "text",
          textSnippet: message.replyTo.textSnippet,
        }
      : undefined;

    return (
      <SwipeableGroupMessage
        message={message}
        onReply={onReply}
        enabled={true}
        currentUid={currentUid}
      >
        <View
          style={[
            styles.messageContainer,
            isOwnMessage && styles.ownMessageContainer,
          ]}
        >
          {/* Reply preview - Apple Messages style (above main bubble) */}
          {replyToMetadata && (
            <ReplyBubble
              replyTo={replyToMetadata}
              isSentByMe={isOwnMessage}
              isReplyToMe={message.replyTo?.senderId === currentUid}
              onPress={() => onScrollToMessage(message.replyTo!.messageId)}
            />
          )}

          {/* Message row */}
          <View
            style={[
              styles.messageRow,
              isOwnMessage ? styles.ownMessageRow : styles.receivedMessageRow,
            ]}
          >
            {!isOwnMessage && showSender && (
              <Text
                style={[styles.senderName, { color: theme.colors.primary }]}
              >
                {message.senderDisplayName}
              </Text>
            )}

            {/* Bubble column */}
            <View style={styles.bubbleColumn}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={
                  message.type === "image" ? handleImagePress : undefined
                }
                onLongPress={() => onLongPress(message)}
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
                            backgroundColor: theme.dark ? "#1A1A1A" : "#e8e8e8",
                          },
                        ],
                    message.type === "image" && styles.imageOnlyBubble,
                    message.type === "voice" && styles.voiceBubble,
                  ]}
                >
                  {message.type === "image" ? (
                    <Image
                      source={{ uri: message.content }}
                      style={styles.messageImage}
                      resizeMode="cover"
                    />
                  ) : message.type === "voice" ? (
                    <VoiceMessagePlayer
                      url={message.content}
                      durationMs={message.voiceMetadata?.durationMs || 0}
                      isOwn={isOwnMessage}
                    />
                  ) : message.type === "scorecard" && message.scorecard ? (
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
                        {message.scorecard.gameId === "reaction_tap"
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
                        {message.scorecard.gameId === "reaction_tap"
                          ? `${message.scorecard.score}ms`
                          : `${message.scorecard.score} taps`}
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
                        {message.content}
                      </Text>
                      {/* Link Preview (H12) */}
                      {hasUrls(message.content) && (
                        <LinkPreviewCard
                          preview={
                            linkPreview || {
                              url: extractUrls(message.content)[0] || "",
                              fetchedAt: Date.now(),
                            }
                          }
                          isOwn={isOwnMessage}
                          loading={linkPreviewLoading}
                        />
                      )}
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Timestamp row */}
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
                  {formatTime(message.createdAt)}
                </Text>
              </View>
            </View>
          </View>

          {/* Reactions Summary (H8) */}
          {reactions.length > 0 && (
            <ReactionsSummary
              reactionsSummary={Object.fromEntries(
                reactions.map((r) => [r.emoji, r.count]),
              )}
              userReactions={reactions
                .filter((r) => r.hasReacted)
                .map((r) => r.emoji)}
              compact
              onPress={() => onLongPress(message)}
            />
          )}
        </View>
      </SwipeableGroupMessage>
    );
  },
);

GroupMessageItem.displayName = "GroupMessageItem";

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  messageContainer: {
    marginBottom: 12,
    width: "100%",
  },
  ownMessageContainer: {},
  messageRow: {
    maxWidth: "80%",
  },
  ownMessageRow: {
    alignSelf: "flex-end",
  },
  receivedMessageRow: {
    alignSelf: "flex-start",
  },
  bubbleColumn: {
    flexDirection: "column",
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    borderBottomLeftRadius: 4,
  },
  imageOnlyBubble: {
    padding: 0,
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  voiceBubble: {
    padding: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  scorecardContent: {
    alignItems: "center",
    padding: 8,
  },
  scorecardGame: {
    fontSize: 12,
    marginTop: 4,
  },
  scorecardScore: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 2,
  },
  messageTime: {
    fontSize: 10,
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  timestampRowSent: {
    alignSelf: "flex-end",
    marginRight: 4,
  },
  timestampRowReceived: {
    alignSelf: "flex-start",
    marginLeft: 4,
  },
  systemMessage: {
    alignItems: "center",
    marginVertical: 12,
  },
  systemMessageText: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
});
