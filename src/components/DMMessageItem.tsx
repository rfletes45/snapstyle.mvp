/**
 * DMMessageItem Component (UNI-05 Extraction)
 *
 * Renders a single message in the DM chat screen.
 * Extracted from ChatScreen to reduce complexity and enable reuse.
 *
 * Enhanced with:
 * - Highlight animation when navigating to a replied message
 * - Polished visual design
 */

import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import AppImage from "@/components/AppImage";
import { ReplyBubble, SwipeableMessage } from "@/components/chat";
import { AnimalBubble } from "@/components/chat/AnimalBubble";
import { LinkPreviewCard } from "@/components/chat/LinkPreviewCard";
import { ReactionPills } from "@/components/chat/ReactionBar";
import { ThreadIndicator } from "@/components/chat/ThreadIndicator";
import { VoiceMessagePlayer } from "@/components/chat/VoiceMessagePlayer";
import { Spacing } from "@/constants/theme";
import {
  resolveIncomingBubbleStyle,
  resolveOutgoingChatStyle,
} from "@/cosmetics/chatAppearanceResolver";
import type { ChatAppearance, SenderStyle } from "@/cosmetics/types";
import { useLinkPreviews } from "@/hooks/useLinkPreviews";
import { extractUrls, hasUrls } from "@/services/linkPreview";
import type { ReactionSummary } from "@/services/reactions";
import type { ReplyToMetadata } from "@/types/messaging";
import { formatChatTimestamp } from "@/utils/chatTimestamp";

const IMAGE_MAX_WIDTH = 240;
const IMAGE_MAX_HEIGHT = 320;
const IMAGE_MIN_WIDTH = 150;

function getImageBubbleSize(w?: number, h?: number) {
  if (!w || !h) return { width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_WIDTH };
  const aspect = w / h;
  let bw = Math.min(w, IMAGE_MAX_WIDTH);
  let bh = bw / aspect;
  if (bh > IMAGE_MAX_HEIGHT) {
    bh = IMAGE_MAX_HEIGHT;
    bw = bh * aspect;
  }
  if (bw < IMAGE_MIN_WIDTH) {
    bw = IMAGE_MIN_WIDTH;
    bh = bw / aspect;
  }
  return { width: Math.round(bw), height: Math.round(bh) };
}

export interface MessageWithProfile {
  id: string;
  sender: string;
  content: string;
  type: "text" | "image" | "voice" | "animal";
  createdAt: Date;
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  /** Server received timestamp for read receipt calculation */
  serverReceivedAt?: number;
  replyTo?: ReplyToMetadata;
  /** Voice message URL */
  voiceUrl?: string;
  /** Voice message duration in milliseconds */
  voiceDurationMs?: number;
  /** Image attachment URL (for media messages) */
  imageUrl?: string;
  /** Image dimensions from upload metadata */
  imageWidth?: number;
  imageHeight?: number;
  /** Sender's chat style snapshot (bubble color, font, etc.) */
  senderStyle?: SenderStyle | null;
  /** Thread reply count (for thread indicator) */
  replyCount?: number;
  /** Animal theme ID (for animal signal messages) */
  animalId?: string;
  /** Denormalized reaction counts from the message document */
  reactionsSummary?: Record<string, number>;
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
  /** User's chat cosmetics (bubble color, font) */
  chatAppearance?: ChatAppearance | null;
  /** Callback when user swipes to reply */
  onReply: (replyMetadata: ReplyToMetadata) => void;
  /** Callback when user long-presses the message */
  onLongPress: (message: MessageWithProfile) => void;
  /** Callback to scroll to a specific message (for reply navigation) */
  onScrollToMessage: (messageId: string) => void;
  /** Callback to retry sending a failed message */
  onRetry: (message: MessageWithProfile) => Promise<void>;
  /** Callback to open the media viewer for an image message */
  onImagePress?: (
    imageUrl: string,
    senderName: string,
    timestamp: Date,
  ) => void;
  /** Whether this message should be highlighted (reply navigation) */
  isHighlighted?: boolean;
  /** Whether this message is grouped with the one above (same sender, close time) */
  isGrouped?: boolean;
  /** Whether to show the timestamp for this message */
  showTimestamp?: boolean;
  /** Live reactions for this message (from subscription) */
  reactions?: ReactionSummary[];
  /** Called immediately for optimistic reaction toggle */
  onOptimisticReaction?: (messageId: string, emoji: string) => void;
}

export const DMMessageItem: React.FC<DMMessageItemProps> = React.memo(
  ({
    message,
    currentUid,
    chatId,
    friendProfile,
    chatAppearance,
    onReply,
    onLongPress,
    onScrollToMessage,
    onRetry,
    onImagePress,
    isHighlighted = false,
    isGrouped = false,
    showTimestamp = true,
    reactions = [],
    onOptimisticReaction,
  }) => {
    const theme = useTheme();
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const isSentByMe = message.sender === currentUid;

    // Resolve outgoing chat cosmetics (bubble color, text color, font)
    const chatStyle = React.useMemo(
      () =>
        resolveOutgoingChatStyle({
          chatAppearance: chatAppearance ?? null,
          appearanceMode: theme.dark ? "dark" : "light",
        }),
      [chatAppearance, theme.dark],
    );

    // Resolve incoming sender style from the message's senderStyle snapshot
    const incomingStyle = React.useMemo(() => {
      if (isSentByMe) return null;
      return resolveIncomingBubbleStyle({
        senderStyle: message.senderStyle ?? null,
        appearanceMode: theme.dark ? "dark" : "light",
        defaultBgColor: theme.colors.surfaceVariant,
        defaultTextColor: theme.colors.onSurface,
      });
    }, [
      isSentByMe,
      message.senderStyle,
      message.id,
      message.sender,
      theme.dark,
      theme.colors.surfaceVariant,
      theme.colors.onSurface,
    ]);

    // Unified style: outgoing uses viewer's chatStyle, incoming uses sender's stamped style
    const bubbleBgColor = isSentByMe
      ? chatStyle.bubbleBgColor
      : incomingStyle!.bubbleBgColor;
    const bubbleTextColor = isSentByMe
      ? chatStyle.bubbleTextColor
      : incomingStyle!.bubbleTextColor;
    const bubbleFontFamily = isSentByMe
      ? chatStyle.fontFamily
      : incomingStyle!.fontFamily;
    // Custom font color overrides contrast-computed bubbleTextColor when set
    const fontColorHex = isSentByMe
      ? chatStyle.fontColorHex
      : (incomingStyle?.fontColorHex ?? null);
    const resolvedTextColor = fontColorHex ?? bubbleTextColor;

    // Link preview support for text messages
    const messagesForPreview = React.useMemo(
      () =>
        message.type === "text" && hasUrls(message.content)
          ? [{ id: message.id, content: message.content, type: message.type }]
          : [],
      [message.id, message.content, message.type],
    );
    const { linkPreviews, loadingPreviews } =
      useLinkPreviews(messagesForPreview);

    // Highlight animation
    const highlightOpacity = useSharedValue(0);

    useEffect(() => {
      if (isHighlighted) {
        // Animate: fade in → hold → fade out
        highlightOpacity.value = withSequence(
          withTiming(1, { duration: 200 }),
          withDelay(1500, withTiming(0, { duration: 400 })),
        );
      } else {
        highlightOpacity.value = 0;
      }
    }, [isHighlighted, highlightOpacity]);

    const highlightStyle = useAnimatedStyle(() => ({
      position: "absolute" as const,
      top: -4,
      left: -8,
      right: -8,
      bottom: -4,
      backgroundColor: theme.colors.primary,
      opacity: highlightOpacity.value * 0.15,
      borderRadius: 12,
      zIndex: -1,
    }));

    // Handle message tap
    const handlePress = useCallback(() => {
      if (message.status === "failed") {
        onRetry(message);
        return;
      }
      if (message.type === "image" && message.imageUrl && onImagePress) {
        const senderName = isSentByMe
          ? "You"
          : friendProfile?.displayName || friendProfile?.username || "Friend";
        onImagePress(message.imageUrl, senderName, message.createdAt);
        return;
      }
    }, [message, isSentByMe, friendProfile, onImagePress, navigation, onRetry]);

    // Render message status indicator
    const renderStatus = () => {
      if (!isSentByMe) return null;

      switch (message.status) {
        case "sending":
          return (
            <View
              style={styles.statusContainer}
              accessibilityLabel="Sending message"
            >
              <Text
                style={[
                  styles.sendingStatus,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                ○
              </Text>
            </View>
          );
        case "failed":
          return (
            <TouchableOpacity
              style={styles.statusContainer}
              onPress={() => onRetry(message)}
              accessibilityLabel="Message failed to send. Tap to retry"
              accessibilityRole="button"
            >
              <Text style={styles.failedStatus}>⚠️ Tap to retry</Text>
            </TouchableOpacity>
          );
        case "sent":
          return (
            <View
              style={styles.statusContainer}
              accessibilityLabel="Message sent"
            >
              <Text
                style={[
                  styles.sentStatus,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                ✓
              </Text>
            </View>
          );
        case "delivered":
          return (
            <View
              style={styles.statusContainer}
              accessibilityLabel="Message delivered"
            >
              <Text
                style={[
                  styles.deliveredStatus,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                ✓✓
              </Text>
            </View>
          );
        case "read":
          return (
            <View
              style={styles.statusContainer}
              accessibilityLabel="Message read"
            >
              <Text
                style={[styles.readStatus, { color: theme.colors.primary }]}
              >
                Read
              </Text>
            </View>
          );
        default:
          return null;
      }
    };

    // Render message content
    const renderContent = () => {
      // Animal message — check kind-based animal signal
      if (message.type === "animal") {
        if (message.animalId) {
          return (
            <AnimalBubble animalId={message.animalId} isMine={isSentByMe} />
          );
        }
        // Fallback: animal message with missing animalId
        return (
          <Text style={{ fontSize: 13, fontStyle: "italic", opacity: 0.5 }}>
            (Animal unavailable)
          </Text>
        );
      }

      if (message.type === "voice") {
        return (
          <VoiceMessagePlayer
            url={message.voiceUrl || message.content}
            durationMs={message.voiceDurationMs || 0}
            isOwn={isSentByMe}
          />
        );
      }

      if (message.type === "image") {
        if (message.imageUrl) {
          const imgSize = getImageBubbleSize(
            message.imageWidth,
            message.imageHeight,
          );
          return (
            <AppImage
              source={{ uri: message.imageUrl }}
              style={[styles.standaloneImage, imgSize]}
              contentFit="cover"
              debugLabel="DMMessageImage"
            />
          );
        }
        // Fallback for old messages without a URL
        return <Text style={{ fontSize: 14, color: "#999" }}>📷 Photo</Text>;
      }

      return (
        <>
          <Text
            style={[
              styles.messageText,
              {
                color: resolvedTextColor,
                ...(bubbleFontFamily ? { fontFamily: bubbleFontFamily } : {}),
              },
            ]}
          >
            {message.content}
          </Text>
          {hasUrls(message.content) && (
            <LinkPreviewCard
              preview={
                linkPreviews.get(message.id) || {
                  url: extractUrls(message.content)[0] || "",
                  fetchedAt: Date.now(),
                }
              }
              isOwn={isSentByMe}
              loading={loadingPreviews.has(message.id)}
            />
          )}
        </>
      );
    };

    // Is this an animal message?
    const isAnimal = message.type === "animal" && !!message.animalId;

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
      kind:
        message.type === "image"
          ? ("media" as const)
          : message.type === "voice"
            ? ("voice" as const)
            : ("text" as const),
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
        enabled={message.status !== "failed"}
        currentUid={currentUid}
      >
        <View
          style={[
            styles.messageContainer,
            isSentByMe
              ? styles.sentMessageContainer
              : styles.receivedMessageContainer,
            message.status === "failed" && styles.failedMessageContainer,
            isGrouped && styles.groupedMessageContainer,
          ]}
        >
          {/* Highlight overlay for reply navigation */}
          <Animated.View style={highlightStyle} pointerEvents="none" />

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
                  accessibilityLabel={
                    message.type === "voice"
                      ? `${isSentByMe ? "You sent" : `${friendProfile?.displayName || "Friend"} sent`} a voice message`
                      : message.type === "image"
                        ? `${isSentByMe ? "You sent" : `${friendProfile?.displayName || "Friend"} sent`} a picture`
                        : `${isSentByMe ? "You" : friendProfile?.displayName || "Friend"}: ${message.content}`
                  }
                  accessibilityRole="button"
                  accessibilityHint="Long press for message options, swipe right to reply"
                >
                  <View
                    style={[
                      styles.messageBubble,
                      !isAnimal &&
                        (isSentByMe
                          ? [
                              styles.sentBubble,
                              { backgroundColor: bubbleBgColor },
                            ]
                          : [
                              styles.receivedBubble,
                              {
                                backgroundColor: bubbleBgColor,
                              },
                            ]),
                      isAnimal && {
                        padding: 0,
                        backgroundColor: "transparent",
                      },
                      message.type === "image" &&
                        message.imageUrl &&
                        styles.imageOnlyBubble,
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

                <View
                  style={[
                    styles.timestampStatusRow,
                    isSentByMe
                      ? styles.timestampStatusRowSent
                      : styles.timestampStatusRowReceived,
                    !showTimestamp && styles.timestampStatusRowHidden,
                  ]}
                  pointerEvents="none"
                >
                  {renderStatus()}
                  <Text
                    style={[
                      styles.timestamp,
                      { color: theme.colors.onSurface + "99" },
                    ]}
                  >
                    {formatChatTimestamp(message.createdAt)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Reaction pills — anchored below the bubble, aligned to sender */}
            {reactions.length > 0 && (
              <ReactionPills
                reactions={reactions}
                isOwnMessage={isSentByMe}
                scope="dm"
                conversationId={chatId || ""}
                messageId={message.id}
                currentUid={currentUid || ""}
                onOptimisticToggle={onOptimisticReaction}
              />
            )}
          </View>
        </View>

        {/* Thread indicator — show when this message is the root of a thread */}
        {!!message.replyCount && message.replyCount > 0 && (
          <ThreadIndicator
            replyCount={message.replyCount}
            isOutgoing={isSentByMe}
            onPress={() =>
              navigation.navigate("ThreadView", {
                conversationId: chatId,
                scope: "dm" as const,
                rootMessageId: message.id,
              })
            }
          />
        )}
      </SwipeableMessage>
    );
  },
);

DMMessageItem.displayName = "DMMessageItem";

const styles = StyleSheet.create({
  messageContainer: {
    marginBottom: 14,
    width: "100%",
  },
  sentMessageContainer: {},
  receivedMessageContainer: {},
  groupedMessageContainer: {
    marginBottom: 3,
  },
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
    flexShrink: 1,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 20,
    maxWidth: "100%",
    alignSelf: "flex-start",
  },
  sentBubble: {
    borderBottomRightRadius: 6,
  },
  receivedBubble: {
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 17,
    lineHeight: 26,
  },
  timestamp: {
    fontSize: 10,
  },
  timestampStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  timestampStatusRowSent: {
    alignSelf: "flex-end",
  },
  timestampStatusRowReceived: {
    alignSelf: "flex-start",
  },
  timestampStatusRowHidden: {
    opacity: 0,
  },
  statusContainer: {},
  sendingStatus: {
    fontSize: 10,
    color: undefined, // Use theme.colors.onSurfaceVariant inline
  },
  sentStatus: {
    fontSize: 10,
    color: undefined, // Use theme.colors.onSurfaceVariant inline
  },
  deliveredStatus: {
    fontSize: 10,
  },
  readStatus: {
    fontSize: 10,
    fontWeight: "600",
    color: undefined, // Use theme.colors.primary inline for read receipts
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
  imageOnlyBubble: {
    padding: 0,
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  standaloneImage: {
    borderRadius: 16,
  },
});
