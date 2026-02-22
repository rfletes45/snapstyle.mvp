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
import { VoiceMessagePlayer } from "@/components/chat/VoiceMessagePlayer";
import ScorecardBubble from "@/components/ScorecardBubble";
import SpectatorInviteBubble, {
  parseSpectatorInviteContent,
} from "@/components/SpectatorInviteBubble";
import { Spacing } from "@/constants/theme";
import { detectAnimalEmoji } from "@/cosmetics/animalAssets";
import {
  resolveIncomingBubbleStyle,
  resolveOutgoingChatStyle,
} from "@/cosmetics/chatAppearanceResolver";
import type { ChatAppearance, SenderStyle } from "@/cosmetics/types";
import { useLinkPreviews } from "@/hooks/useLinkPreviews";
import { extractUrls, hasUrls } from "@/services/linkPreview";
import type { ReplyToMetadata } from "@/types/messaging";

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
  type: "text" | "image" | "scorecard" | "voice";
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
  /** Sender's chat style snapshot (bubble color, font, etc.) */
  senderStyle?: SenderStyle | null;
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
      const resolved = resolveIncomingBubbleStyle({
        senderStyle: message.senderStyle ?? null,
        appearanceMode: theme.dark ? "dark" : "light",
        defaultBgColor: theme.colors.surfaceVariant,
        defaultTextColor: theme.colors.onSurface,
      });
      console.log(
        `[DM_RENDER_STYLE] id=${message.id} sender=${message.sender} senderStyle=${JSON.stringify(message.senderStyle ?? null)} resolvedBg=${resolved.bubbleBgColor}`,
      );
      return resolved;
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
      // Handle spectator invite taps
      if (message.type === "scorecard") {
        const spectatorInvite = parseSpectatorInviteContent(message.content);
        if (spectatorInvite && !isSentByMe && !spectatorInvite.finished) {
          navigation.navigate("SpectatorView", {
            roomId: spectatorInvite.roomId,
            gameType: spectatorInvite.gameId,
            hostName: spectatorInvite.hostName,
            inviteMode: spectatorInvite.inviteMode,
            boostSessionEndsAt: spectatorInvite.boostSessionEndsAt,
          });
        }
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
                ✓✓
              </Text>
            </View>
          );
        default:
          return null;
      }
    };

    // Render message content
    const renderContent = () => {
      // Animal message — detect any animal emoji (duck/turtle/bear/wolf)
      if (message.type === "text") {
        const animalId = detectAnimalEmoji(message.content);
        if (animalId) {
          return <AnimalBubble animalId={animalId} isMine={isSentByMe} />;
        }
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
          return (
            <AppImage
              source={{ uri: message.imageUrl }}
              style={styles.standaloneImage}
              contentFit="cover"
              debugLabel="DMMessageImage"
            />
          );
        }
        // Fallback for old messages without a URL
        return <Text style={{ fontSize: 14, color: "#999" }}>📷 Photo</Text>;
      }

      if (message.type === "scorecard") {
        // Check if this is a spectator invite (subtype of scorecard)
        const spectatorInvite = parseSpectatorInviteContent(message.content);
        if (spectatorInvite) {
          return (
            <SpectatorInviteBubble
              invite={spectatorInvite}
              isMine={isSentByMe}
              onPress={
                !isSentByMe && !spectatorInvite.finished
                  ? () =>
                      navigation.navigate("SpectatorView", {
                        roomId: spectatorInvite.roomId,
                        gameType: spectatorInvite.gameId,
                        hostName: spectatorInvite.hostName,
                        inviteMode: spectatorInvite.inviteMode,
                        boostSessionEndsAt: spectatorInvite.boostSessionEndsAt,
                      })
                  : undefined
              }
            />
          );
        }

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
        <>
          <Text
            style={[
              styles.messageText,
              {
                color: bubbleTextColor,
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
    const isAnimal =
      message.type === "text" && detectAnimalEmoji(message.content) !== null;

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
                        : message.type === "scorecard"
                          ? `${isSentByMe ? "You sent" : `${friendProfile?.displayName || "Friend"} sent`} a scorecard`
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

                {/* Timestamp and status row - only shown on last message of group */}
                {showTimestamp && (
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
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {new Date(message.createdAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                )}
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
  groupedMessageContainer: {
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
    width: 200,
    height: 200,
    borderRadius: 16,
  },
});
