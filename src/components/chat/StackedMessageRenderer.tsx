/**
 * StackedMessageRenderer — Discord-style dense feed layout for DM chats.
 *
 * Architecture:
 * - Fixed left gutter (avatar area) + content column grid
 * - NO bubble chrome around text messages — flat feed rows
 * - Self-messages distinguished by subtle row tint + left accent, not alignment
 * - Images, reactions, replies all anchored to the same content column
 * - Group-start rows show avatar + author name + inline timestamp
 * - Within-group rows show only content, indented to the same column
 *
 * This renderer is structurally separate from the bubble renderer.
 * It shares only the data model and hooks, not layout primitives.
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

import type { MessageViewModel } from "@/chat/displayMode";
import { FEED_LAYOUT } from "@/chat/displayMode";
import AppImage from "@/components/AppImage";
import { SwipeableMessage } from "@/components/chat";
import { AnimalBubble } from "@/components/chat/AnimalBubble";
import { LinkPreviewCard } from "@/components/chat/LinkPreviewCard";
import { ReactionPills } from "@/components/chat/ReactionBar";
import { StackedReplyReference } from "@/components/chat/StackedReplyReference";
import { ThreadIndicator } from "@/components/chat/ThreadIndicator";
import { VoiceMessagePlayer } from "@/components/chat/VoiceMessagePlayer";
import type { MessageWithProfile } from "@/components/DMMessageItem";
import type { ChatAppearance } from "@/cosmetics/types";
import { useLinkPreviews } from "@/hooks/useLinkPreviews";
import { extractUrls, hasUrls } from "@/services/linkPreview";
import type { ReactionSummary } from "@/services/reactions";
import type { ReplyToMetadata } from "@/types/messaging";

// ---------------------------------------------------------------------------
// Feed layout constants
// ---------------------------------------------------------------------------

const F = FEED_LAYOUT;

function getImageSize(w?: number, h?: number) {
  if (!w || !h) return { width: F.imageMaxWidth, height: F.imageMaxWidth };
  const aspect = w / h;
  let bw = Math.min(w, F.imageMaxWidth);
  let bh = bw / aspect;
  if (bh > F.imageMaxHeight) {
    bh = F.imageMaxHeight;
    bw = bh * aspect;
  }
  if (bw < F.imageMinWidth) {
    bw = F.imageMinWidth;
    bh = bw / aspect;
  }
  return { width: Math.round(bw), height: Math.round(bh) };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StackedMessageRendererProps {
  message: MessageWithProfile;
  currentUid: string | undefined;
  chatId: string | null;
  friendProfile: {
    displayName?: string;
    username?: string;
    avatarConfig?: { baseColor: string };
  } | null;
  chatAppearance?: ChatAppearance | null;
  onReply: (replyMetadata: ReplyToMetadata) => void;
  onLongPress: (message: MessageWithProfile) => void;
  onScrollToMessage: (messageId: string) => void;
  onRetry: (message: MessageWithProfile) => Promise<void>;
  onImagePress?: (
    imageUrl: string,
    senderName: string,
    timestamp: Date,
  ) => void;
  isHighlighted?: boolean;
  reactions?: ReactionSummary[];
  onOptimisticReaction?: (messageId: string, emoji: string) => void;
  vm: MessageViewModel;
  senderDisplayName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const StackedMessageRenderer: React.FC<StackedMessageRendererProps> =
  React.memo(
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
      reactions = [],
      onOptimisticReaction,
      vm,
      senderDisplayName,
    }) => {
      const theme = useTheme();
      const navigation = useNavigation<NativeStackNavigationProp<any>>();
      const isSentByMe = message.sender === currentUid;

      // ── Font color ────────────────────────────────────────────────────
      // Stacked mode uses a single theme-adaptive text color for all
      // messages (no per-sender custom font colors). This guarantees
      // uniform readability and proper light/dark contrast.
      const fontColor = theme.colors.onSurface;

      // ── Link previews ─────────────────────────────────────────────────
      const messagesForPreview = React.useMemo(
        () =>
          message.type === "text" && hasUrls(message.content)
            ? [{ id: message.id, content: message.content, type: message.type }]
            : [],
        [message.id, message.content, message.type],
      );
      const { linkPreviews, loadingPreviews } =
        useLinkPreviews(messagesForPreview);

      // ── Highlight animation ───────────────────────────────────────────
      const highlightOpacity = useSharedValue(0);

      useEffect(() => {
        if (isHighlighted) {
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
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.primary,
        opacity: highlightOpacity.value * 0.1,
        zIndex: -1,
      }));

      // ── Handlers ──────────────────────────────────────────────────────
      const handlePress = useCallback(() => {
        if (message.status === "failed") {
          onRetry(message);
          return;
        }
        if (message.type === "image" && message.imageUrl && onImagePress) {
          onImagePress(message.imageUrl, senderDisplayName, message.createdAt);
        }
      }, [message, senderDisplayName, onImagePress, onRetry]);

      // ── Format timestamp ──────────────────────────────────────────────
      const formattedTime = React.useMemo(
        () =>
          new Date(message.createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        [message.createdAt],
      );

      // ── Status indicator ──────────────────────────────────────────────
      const renderStatus = () => {
        if (!isSentByMe) return null;
        const color = theme.colors.onSurfaceVariant;
        switch (message.status) {
          case "sending":
            return (
              <Text
                style={[s.metaText, { color }]}
                accessibilityLabel="Sending"
              >
                ○
              </Text>
            );
          case "failed":
            return (
              <TouchableOpacity
                onPress={() => onRetry(message)}
                accessibilityLabel="Message failed. Tap to retry"
                accessibilityRole="button"
              >
                <Text style={[s.metaText, { color: theme.colors.error }]}>
                  ⚠️ Retry
                </Text>
              </TouchableOpacity>
            );
          case "sent":
            return (
              <Text style={[s.metaText, { color }]} accessibilityLabel="Sent">
                ✓
              </Text>
            );
          case "delivered":
            return (
              <Text
                style={[s.metaText, { color }]}
                accessibilityLabel="Delivered"
              >
                ✓✓
              </Text>
            );
          case "read":
            return (
              <Text
                style={[s.metaText, { color: theme.colors.primary }]}
                accessibilityLabel="Read"
              >
                ✓✓
              </Text>
            );
          default:
            return null;
        }
      };

      // ── Message content ───────────────────────────────────────────────
      const renderContent = () => {
        if (message.type === "animal") {
          if (message.animalId) {
            return <AnimalBubble animalId={message.animalId} isMine={false} />;
          }
          return (
            <Text
              style={{
                fontSize: F.messageFontSize,
                fontStyle: "italic",
                opacity: 0.5,
              }}
            >
              (Animal unavailable)
            </Text>
          );
        }

        if (message.type === "voice") {
          return (
            <View
              style={[
                s.voiceContainer,
                {
                  backgroundColor: isSentByMe
                    ? theme.colors.primaryContainer + "40"
                    : theme.colors.surfaceVariant + "80",
                  borderColor: theme.colors.outline + "20",
                },
              ]}
            >
              <VoiceMessagePlayer
                url={message.voiceUrl || message.content}
                durationMs={message.voiceDurationMs || 0}
                isOwn={isSentByMe}
              />
            </View>
          );
        }

        if (message.type === "image") {
          if (message.imageUrl) {
            const imgSize = getImageSize(
              message.imageWidth,
              message.imageHeight,
            );
            return (
              <AppImage
                source={{ uri: message.imageUrl }}
                style={[s.image, imgSize]}
                contentFit="cover"
                debugLabel="StackedFeedImage"
              />
            );
          }
          return (
            <Text style={{ fontSize: F.messageFontSize, color: "#999" }}>
              📷 Photo
            </Text>
          );
        }

        // Text message — no bubble, just text
        return (
          <>
            <Text style={[s.messageText, { color: fontColor }]}>
              {message.content}
            </Text>
            {hasUrls(message.content) && (
              <View style={s.linkPreviewContainer}>
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
              </View>
            )}
          </>
        );
      };

      // ── Swipeable message shell ───────────────────────────────────────
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
        senderName: senderDisplayName,
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

      // ── Avatar color ──────────────────────────────────────────────────
      const avatarBg = isSentByMe
        ? theme.colors.primaryContainer
        : friendProfile?.avatarConfig?.baseColor ||
          theme.colors.secondaryContainer;
      const avatarFg = isSentByMe
        ? theme.colors.onPrimaryContainer
        : theme.colors.onSecondaryContainer;
      const authorColor = isSentByMe
        ? theme.colors.primary
        : theme.colors.secondary;

      // ── Self-message row styling — removed ─────────────────────────
      // In Discord-style feed, own messages have no background tint.
      // Only mention-highlighted rows get a row-level treatment.
      // (DM mode has no mentions, so no tint at all.)

      return (
        <SwipeableMessage
          message={swipeableMessage}
          onReply={onReply}
          enabled={message.status !== "failed"}
          currentUid={currentUid}
        >
          <View
            style={[
              s.feedRow,
              vm.isGroupStart ? s.feedRowGroupStart : s.feedRowWithinGroup,
              message.status === "failed" && { opacity: 0.7 },
            ]}
          >
            {/* Highlight overlay for reply navigation */}
            <Animated.View style={highlightStyle} pointerEvents="none" />

            {/* ── Message row: [avatar/spacer] [content column] ──────── */}
            <TouchableOpacity
              activeOpacity={0.7}
              onLongPress={() => onLongPress(message)}
              onPress={handlePress}
              delayLongPress={300}
              accessibilityLabel={
                message.type === "voice"
                  ? `${isSentByMe ? "You sent" : `${senderDisplayName} sent`} a voice message`
                  : message.type === "image"
                    ? `${isSentByMe ? "You sent" : `${senderDisplayName} sent`} a picture`
                    : `${isSentByMe ? "You" : senderDisplayName}: ${message.content}`
              }
              accessibilityRole="button"
              accessibilityHint="Long press for message options, swipe right to reply"
            >
              <View style={s.contentRow}>
                {/* Gutter: avatar at group-start, spacer for within-group */}
                {vm.isGroupStart ? (
                  <View style={s.gutter}>
                    <View style={[s.avatar, { backgroundColor: avatarBg }]}>
                      <Text style={[s.avatarText, { color: avatarFg }]}>
                        {senderDisplayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={s.gutterSpacer} />
                )}

                {/* Content column — name + message in one vertical flow */}
                <View style={s.contentColumn}>
                  {/* Author name + timestamp (group-start only) */}
                  {vm.isGroupStart && (
                    <View style={s.nameRow}>
                      <Text
                        style={[s.authorName, { color: authorColor }]}
                        numberOfLines={1}
                      >
                        {senderDisplayName}
                      </Text>
                      <Text
                        style={[
                          s.headerTimestamp,
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {formattedTime}
                      </Text>
                    </View>
                  )}

                  {/* Reply preview — stacked-mode inline reference */}
                  {message.replyTo && (
                    <StackedReplyReference
                      replyTo={message.replyTo}
                      isReplyToMe={message.replyTo.senderId === currentUid}
                      onPress={() =>
                        onScrollToMessage(message.replyTo!.messageId)
                      }
                    />
                  )}

                  {/* Message content — no bubble wrapper */}
                  <View
                    style={[
                      message.status === "sending" && { opacity: 0.6 },
                      message.status === "failed" && s.failedContent,
                    ]}
                  >
                    {renderContent()}
                  </View>

                  {/* Reaction pills — always left-aligned in feed mode */}
                  {reactions.length > 0 && (
                    <View style={s.reactionRow}>
                      <ReactionPills
                        reactions={reactions}
                        isOwnMessage={false}
                        scope="dm"
                        conversationId={chatId || ""}
                        messageId={message.id}
                        currentUid={currentUid || ""}
                        onOptimisticToggle={onOptimisticReaction}
                      />
                    </View>
                  )}

                  {/* Delivery status at group-end (time already shown in group header) */}
                  {vm.showTimestamp && isSentByMe && (
                    <View style={s.metaRow}>{renderStatus()}</View>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            {/* Thread indicator */}
            {!!message.replyCount && message.replyCount > 0 && (
              <View style={s.threadRow}>
                <View style={s.gutterSpacer} />
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
              </View>
            )}
          </View>
        </SwipeableMessage>
      );
    },
  );

StackedMessageRenderer.displayName = "StackedMessageRenderer";

// ---------------------------------------------------------------------------
// Styles — Feed-row grid system
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  // ── Row containers ──────────────────────────────────────────────────
  feedRow: {
    width: "100%",
    paddingHorizontal: F.rowPaddingH,
    paddingVertical: F.rowPaddingV,
  },
  feedRowGroupStart: {
    marginTop: F.groupGap,
  },
  feedRowWithinGroup: {
    marginTop: F.withinGroupGap,
  },

  // ── Group-start name row: [name] [timestamp] (inside content column) ──
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 1,
  },
  gutter: {
    width: F.gutterWidth,
    marginRight: F.gutterGap,
    alignItems: "center",
    paddingTop: 2,
  },
  avatar: {
    width: F.avatarSize,
    height: F.avatarSize,
    borderRadius: F.avatarSize / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: F.avatarSize * 0.44,
    fontWeight: "600",
  },
  authorName: {
    fontSize: F.authorNameFontSize,
    fontWeight: "600",
    flexShrink: 1,
  },
  headerTimestamp: {
    fontSize: F.timestampFontSize,
    marginLeft: 8,
    opacity: 0.6,
  },

  // ── Content row: [gutter spacer] [content column] ──────────────────
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  gutterSpacer: {
    width: F.gutterWidth + F.gutterGap,
  },
  contentColumn: {
    flex: 1,
  },

  // ── Message text (no bubble) ────────────────────────────────────────
  messageText: {
    fontSize: F.messageFontSize,
    lineHeight: F.messageLineHeight,
  },

  // ── Media ───────────────────────────────────────────────────────────
  image: {
    borderRadius: F.mediaRadius,
    marginTop: 2,
  },
  voiceContainer: {
    maxWidth: 260,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  linkPreviewContainer: {
    marginTop: 4,
    maxWidth: 320,
  },

  // ── Reactions (always left-aligned) ─────────────────────────────────
  reactionRow: {
    marginTop: F.reactionRowGap,
  },

  // ── Metadata row ────────────────────────────────────────────────────
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: F.timestampFontSize,
  },

  // ── Thread indicator row ────────────────────────────────────────────
  threadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
  },

  // ── Failed message styling ──────────────────────────────────────────
  failedContent: {
    opacity: 0.8,
  },
});
