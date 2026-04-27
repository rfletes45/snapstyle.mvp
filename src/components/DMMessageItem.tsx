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
import {
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import MessageImage from "@/components/AppImage";
import { AnimalBubble } from "@/components/chat/AnimalBubble";
import { LinkPreviewCard } from "@/components/chat/LinkPreviewCard";
import { MessageHighlightOverlay } from "@/components/chat/MessageHighlightOverlay";
import { ReactionPills } from "@/components/chat/ReactionBar";
import { ReplyBubble } from "@/components/chat/ReplyBubbleNew";
import { SwipeableMessage } from "@/components/chat/SwipeableMessage";
import { ThreadIndicator } from "@/components/chat/ThreadIndicator";
import { VoiceMessagePlayer } from "@/components/chat/VoiceMessagePlayer";
import { Spacing } from "@/constants/theme";
import {
  resolveIncomingBubbleStyle,
  resolveOutgoingChatStyle,
} from "@/cosmetics/chatAppearanceResolver";
import type { ChatAppearance } from "@/cosmetics/types";
import { useLinkPreviews } from "@/hooks/useLinkPreviews";
import { extractUrls, hasUrls } from "@/services/linkPreview";
import type { ReactionSummary } from "@/services/reactions";
import type { MessageV2, ReplyToMetadata } from "@/types/messaging";
import {
  formatBubbleTimestamp,
  formatChatTimestamp,
} from "@/utils/chatTimestamp";

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

interface DMMessageItemProps {
  /** The message to render */
  message: MessageV2;
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
  onLongPress: (message: MessageV2) => void;
  /** Callback to scroll to a specific message (for reply navigation) */
  onScrollToMessage: (messageId: string) => void;
  /** Callback to retry sending a failed message */
  onRetry: (message: MessageV2) => Promise<void>;
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
  /** Whether this message is grouped with the one below (controls bottom spacing) */
  isGroupedWithNext?: boolean;
  /** Whether to show the timestamp for this message */
  showTimestamp?: boolean;
  /** When true, show time-only (bubble mode) instead of full date */
  useTimeOnly?: boolean;
  /** Whether to show the read/delivered status stamp for this message */
  showStatus?: boolean;
  /** Live reactions for this message (from subscription) */
  reactions?: ReactionSummary[];
  /** Called immediately for optimistic reaction toggle */
  onOptimisticReaction?: (messageId: string, emoji: string) => void;
  /**
   * Rendering inside a thread view.
   * When true:
   *   - swipe-to-reply is disabled (threads are already the reply scope)
   *   - a tap on the message body navigates to this message in the
   *     parent chat (via `onMessageTap`) instead of no-op'ing
   *   - any failed-status opacity dimming is suppressed for the root
   *     message (replyTo roots should always render at full opacity)
   */
  inThread?: boolean;
  /**
   * Optional tap handler used when `inThread` is true.  Receives the
   * full message so the caller can navigate to the correct parent-chat
   * location regardless of scope.
   */
  onMessageTap?: (message: MessageV2) => void;
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
    isGroupedWithNext = false,
    showTimestamp = true,
    useTimeOnly = false,
    showStatus = true,
    reactions = [],
    onOptimisticReaction,
    inThread = false,
    onMessageTap,
  }) => {
    const theme = useTheme();
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const isSentByMe = message.senderId === currentUid;
    const messageText = message.text || "";

    // ── Status fade animation ─────────────────────────────────────────
    const statusOpacity = useSharedValue(showStatus ? 1 : 0);
    useEffect(() => {
      statusOpacity.value = withTiming(showStatus ? 1 : 0, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
    }, [showStatus, statusOpacity]);
    const statusAnimatedStyle = useAnimatedStyle(() => ({
      opacity: statusOpacity.value,
    }));

    const imageAttachment = message.attachments?.find(
      (attachment) => attachment.kind === "image",
    );
    const voiceAttachment = message.attachments?.find(
      (attachment) => attachment.kind === "audio",
    );

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
        message.kind === "text" && hasUrls(messageText)
          ? [{ id: message.id, text: messageText, kind: message.kind }]
          : [],
      [message.id, message.kind, messageText],
    );
    const { linkPreviews, loadingPreviews } =
      useLinkPreviews(messagesForPreview);

    // Handle message tap
    const handlePress = useCallback(() => {
      if (message.status === "failed") {
        onRetry(message);
        return;
      }
      if (message.kind === "media" && imageAttachment && onImagePress) {
        const senderName = isSentByMe
          ? "You"
          : friendProfile?.displayName || friendProfile?.username || "Friend";
        onImagePress(
          imageAttachment.url,
          senderName,
          new Date(message.createdAt),
        );
        return;
      }
      // Thread-only fallback: tapping anywhere on a message inside a
      // thread jumps to that message in the parent chat.  In the main
      // chat this branch is intentionally inert (text taps are no-ops).
      if (inThread && onMessageTap) {
        onMessageTap(message);
      }
    }, [
      message,
      imageAttachment,
      isSentByMe,
      friendProfile,
      onImagePress,
      onRetry,
      inThread,
      onMessageTap,
    ]);

    // Render message status indicator
    // "sending" and "failed" always show (operational feedback).
    // "delivered" and "read" respect showStatus + fade animation.
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
                  styles.statusLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Sending
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
              <Text style={[styles.statusLabel, { color: theme.colors.error }]}>
                Failed · Tap to retry
              </Text>
            </TouchableOpacity>
          );
        case "delivered":
          return (
            <Animated.View
              style={[styles.statusContainer, statusAnimatedStyle]}
              accessibilityLabel="Message delivered"
            >
              <Text
                style={[
                  styles.statusLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Delivered
              </Text>
            </Animated.View>
          );
        case "read":
          return (
            <Animated.View
              style={[styles.statusContainer, statusAnimatedStyle]}
              accessibilityLabel="Message read"
            >
              <Text
                style={[styles.statusLabel, { color: theme.colors.primary }]}
              >
                Read
              </Text>
            </Animated.View>
          );
        default:
          return null;
      }
    };

    // Render message content
    const renderContent = () => {
      // Animal message — check kind-based animal signal
      if (message.kind === "animal") {
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

      if (message.kind === "voice" && voiceAttachment) {
        return (
          <VoiceMessagePlayer
            url={voiceAttachment.url}
            durationMs={voiceAttachment.durationMs || 0}
            isOwn={isSentByMe}
          />
        );
      }

      if (message.kind === "media") {
        if (imageAttachment) {
          const imgSize = getImageBubbleSize(
            imageAttachment.width,
            imageAttachment.height,
          );
          return (
            <MessageImage
              source={{ uri: imageAttachment.url }}
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
            {messageText}
          </Text>
          {hasUrls(messageText) && (
            <LinkPreviewCard
              preview={
                linkPreviews.get(message.id) || {
                  url: extractUrls(messageText)[0] || "",
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
    const isAnimal = message.kind === "animal" && !!message.animalId;

    return (
      <SwipeableMessage
        message={message}
        onReply={onReply}
        enabled={!inThread && message.status !== "failed"}
        currentUid={currentUid}
      >
        <View
          style={[
            styles.messageContainer,
            isSentByMe
              ? styles.sentMessageContainer
              : styles.receivedMessageContainer,
            !inThread &&
              message.status === "failed" &&
              styles.failedMessageContainer,
            isGrouped && styles.groupedMessageContainer,
            isGroupedWithNext && styles.groupedMessageContainerTight,
          ]}
        >
          {/* Highlight overlay for reply navigation */}
          <MessageHighlightOverlay isHighlighted={isHighlighted} />

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
                    message.kind === "voice"
                      ? `${isSentByMe ? "You sent" : `${friendProfile?.displayName || "Friend"} sent`} a voice message`
                      : message.kind === "media"
                        ? `${isSentByMe ? "You sent" : `${friendProfile?.displayName || "Friend"} sent`} a picture`
                        : `${isSentByMe ? "You" : friendProfile?.displayName || "Friend"}: ${messageText}`
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
                      message.kind === "media" &&
                        imageAttachment &&
                        styles.imageOnlyBubble,

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

                {showTimestamp && (
                  <View
                    style={[
                      styles.timestampStatusRow,
                      isSentByMe
                        ? styles.timestampStatusRowSent
                        : styles.timestampStatusRowReceived,
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
                      {useTimeOnly
                        ? formatBubbleTimestamp(message.createdAt)
                        : formatChatTimestamp(message.createdAt)}
                    </Text>
                  </View>
                )}
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
            onPress={() => {
              Keyboard.dismiss();
              navigation.navigate("ThreadView", {
                conversationId: chatId,
                scope: "dm" as const,
                rootMessageId: message.id,
              });
            }}
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
    // Visual grouping (hides some elements) — no spacing override here
  },
  groupedMessageContainerTight: {
    marginBottom: 2,
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
  },
  sentBubble: {
    borderBottomRightRadius: 6,
    // Keep outgoing bubbles anchored to the trailing edge even when the
    // timestamp/status footer is wider than the bubble itself.
    alignSelf: "flex-end",
  },
  receivedBubble: {
    borderBottomLeftRadius: 6,
    alignSelf: "flex-start",
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
  statusContainer: {},
  statusLabel: {
    fontSize: 10,
    fontWeight: "700",
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
