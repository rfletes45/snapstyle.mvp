/**
 * DMMessageItem Component (UNI-05 Extraction)
 *
 * Renders a single message in the DM chat screen.
 * Extracted from ChatScreen to reduce complexity and enable reuse.
 */

import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

import { ReplyBubble, SwipeableMessage } from "@/components/chat";
import ScorecardBubble from "@/components/ScorecardBubble";
import type { ReplyToMetadata } from "@/types/messaging";
import { Spacing } from "../../constants/theme";

// Parse scorecard content helper
function parseScorecardContent(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export interface MessageWithProfile {
  id: string;
  sender: string;
  content: string;
  type: "text" | "image" | "scorecard";
  createdAt: Date;
  status?: "sending" | "sent" | "delivered" | "failed";
  replyTo?: ReplyToMetadata;
}

interface DMMessageItemProps {
  /** The message to render */
  message: MessageWithProfile;
  /** Current user's UID */
  currentUid: string | undefined;
  /** Chat/conversation ID */
  chatId: string | null;
  /** Friend's profile data */
  friendProfile: {
    displayName?: string;
    username?: string;
    avatarConfig?: { baseColor: string };
  } | null;
  /** Callback when user swipes to reply */
  onReply: (replyMetadata: ReplyToMetadata) => void;
  /** Callback when user long-presses the message */
  onLongPress: (message: MessageWithProfile) => void;
  /** Callback to scroll to a specific message (for reply navigation) */
  onScrollToMessage: (messageId: string) => void;
  /** Callback to retry sending a failed message */
  onRetry: (message: MessageWithProfile) => Promise<void>;
}

export const DMMessageItem: React.FC<DMMessageItemProps> = React.memo(
  ({
    message,
    currentUid,
    chatId,
    friendProfile,
    onReply,
    onLongPress,
    onScrollToMessage,
    onRetry,
  }) => {
    const theme = useTheme();
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const isSentByMe = message.sender === currentUid;

    // Handle message tap
    const handlePress = useCallback(() => {
      if (message.status === "failed") {
        onRetry(message);
        return;
      }
      if (message.type === "image") {
        if (isSentByMe) {
          Alert.alert(
            "Cannot Open",
            "You sent this snap. Only the receiver can open it.",
          );
          return;
        }
        navigation.navigate("SnapViewer", {
          messageId: message.id,
          chatId: chatId,
          storagePath: message.content,
        });
      }
    }, [message, isSentByMe, chatId, navigation, onRetry]);

    // Render message status indicator
    const renderStatus = () => {
      if (!isSentByMe) return null;

      switch (message.status) {
        case "sending":
          return (
            <View style={styles.statusContainer}>
              <Text style={styles.sendingStatus}>○</Text>
            </View>
          );
        case "failed":
          return (
            <TouchableOpacity
              style={styles.statusContainer}
              onPress={() => onRetry(message)}
            >
              <Text style={styles.failedStatus}>⚠️ Tap to retry</Text>
            </TouchableOpacity>
          );
        case "sent":
          return (
            <View style={styles.statusContainer}>
              <Text style={styles.sentStatus}>✓</Text>
            </View>
          );
        case "delivered":
          return (
            <View style={styles.statusContainer}>
              <Text style={styles.deliveredStatus}>✓✓</Text>
            </View>
          );
        default:
          return null;
      }
    };

    // Render message content
    const renderContent = () => {
      if (message.type === "image") {
        return <Text style={{ fontSize: 24 }}>🔒</Text>;
      }

      if (message.type === "scorecard") {
        const scorecard = parseScorecardContent(message.content);
        if (scorecard) {
          return <ScorecardBubble scorecard={scorecard} isMine={isSentByMe} />;
        }
        return (
          <Text style={[styles.messageText, { color: theme.colors.onSurface }]}>
            [Invalid scorecard]
          </Text>
        );
      }

      return (
        <Text
          style={[
            styles.messageText,
            isSentByMe
              ? { color: theme.colors.onPrimary }
              : { color: theme.colors.onSurface },
          ]}
        >
          {message.content}
        </Text>
      );
    };

    // Create SwipeableMessage format - convert Date to timestamp
    const createdAtTimestamp =
      message.createdAt instanceof Date
        ? message.createdAt.getTime()
        : typeof message.createdAt === "number"
          ? message.createdAt
          : Date.now();

    const swipeableMessage = {
      id: message.id,
      scope: "dm" as const,
      conversationId: chatId || "",
      senderId: message.sender,
      senderName: isSentByMe ? "You" : friendProfile?.displayName,
      kind: message.type === "image" ? ("media" as const) : ("text" as const),
      text: message.type === "text" ? message.content : undefined,
      createdAt: createdAtTimestamp,
      serverReceivedAt: createdAtTimestamp,
      clientId: "",
      idempotencyKey: "",
    };

    return (
      <SwipeableMessage
        message={swipeableMessage}
        onReply={onReply}
        enabled={message.type !== "scorecard" && message.status !== "failed"}
        currentUid={currentUid}
      >
        <View
          style={[
            styles.messageContainer,
            isSentByMe
              ? styles.sentMessageContainer
              : styles.receivedMessageContainer,
            message.status === "failed" && styles.failedMessageContainer,
          ]}
        >
          <View style={styles.messageBubbleWrapper}>
            {/* Reply preview - Apple Messages style (above main bubble) */}
            {message.replyTo && (
              <ReplyBubble
                replyTo={message.replyTo}
                isSentByMe={isSentByMe}
                isReplyToMe={message.replyTo.senderId === currentUid}
                onPress={() => onScrollToMessage(message.replyTo!.messageId)}
              />
            )}

            {/* Main message row */}
            <View
              style={[
                styles.messageRow,
                isSentByMe ? styles.sentMessageRow : styles.receivedMessageRow,
              ]}
            >
              {/* Bubble and timestamp column */}
              <View style={styles.bubbleColumn}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onLongPress={() => onLongPress(message)}
                  onPress={handlePress}
                  delayLongPress={300}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isSentByMe
                        ? [
                            styles.sentBubble,
                            { backgroundColor: theme.colors.primary },
                          ]
                        : [
                            styles.receivedBubble,
                            {
                              backgroundColor: theme.dark
                                ? theme.colors.surfaceVariant
                                : "#e8e8e8",
                            },
                          ],
                      message.status === "sending" && styles.sendingBubble,
                      message.status === "failed" && [
                        styles.failedBubble,
                        {
                          backgroundColor: theme.colors.errorContainer,
                          borderColor: theme.colors.error,
                        },
                      ],
                    ]}
                  >
                    {renderContent()}
                  </View>
                </TouchableOpacity>

                {/* Timestamp and status row */}
                <View
                  style={[
                    styles.timestampStatusRow,
                    isSentByMe
                      ? styles.timestampStatusRowSent
                      : styles.timestampStatusRowReceived,
                  ]}
                >
                  {renderStatus()}
                  <Text
                    style={[
                      styles.timestamp,
                      { color: theme.dark ? "#888" : "#666" },
                    ]}
                  >
                    {new Date(message.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </SwipeableMessage>
    );
  },
);

DMMessageItem.displayName = "DMMessageItem";

const styles = StyleSheet.create({
  messageContainer: {
    marginBottom: 12,
    width: "100%",
  },
  sentMessageContainer: {},
  receivedMessageContainer: {},
  messageBubbleWrapper: {
    flexDirection: "column",
    width: "100%",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    maxWidth: "80%",
  },
  sentMessageRow: {
    alignSelf: "flex-end",
  },
  receivedMessageRow: {
    alignSelf: "flex-start",
  },
  bubbleColumn: {
    flexDirection: "column",
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: "100%",
  },
  sentBubble: {
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 10,
  },
  timestampStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  timestampStatusRowSent: {
    alignSelf: "flex-end",
  },
  timestampStatusRowReceived: {
    alignSelf: "flex-start",
  },
  statusContainer: {},
  sendingStatus: {
    fontSize: 10,
    color: "#999",
  },
  sentStatus: {
    fontSize: 10,
    color: "#888",
  },
  deliveredStatus: {
    fontSize: 10,
  },
  failedStatus: {
    fontSize: 10,
  },
  sendingBubble: {
    opacity: 0.7,
  },
  failedBubble: {
    borderWidth: 1,
  },
  failedMessageContainer: {
    opacity: 0.8,
  },
});
