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
import React, { useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

import type { MessageViewModel } from "@/chat/displayMode";
import { FEED_LAYOUT } from "@/chat/displayMode";
import FeedImage from "@/components/AppImage";
import { SwipeableMessage } from "@/components/chat";
import { AnimalBubble } from "@/components/chat/AnimalBubble";
import { LinkPreviewCard } from "@/components/chat/LinkPreviewCard";
import { MessageHighlightOverlay } from "@/components/chat/MessageHighlightOverlay";
import { ReactionPills } from "@/components/chat/ReactionBar";
import { StackedReplyReference } from "@/components/chat/StackedReplyReference";
import { ThreadIndicator } from "@/components/chat/ThreadIndicator";
import { VoiceMessagePlayer } from "@/components/chat/VoiceMessagePlayer";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import type { ChatAppearance } from "@/cosmetics/types";
import { useLinkPreviews } from "@/hooks/useLinkPreviews";
import { extractUrls, hasUrls } from "@/services/linkPreview";
import type { ReactionSummary } from "@/services/reactions";
import type { MessageV2, ReplyToMetadata } from "@/types/messaging";
import { formatChatTimestamp } from "@/utils/chatTimestamp";

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
  message: MessageV2;
  currentUid: string | undefined;
  chatId: string | null;
  friendProfile: {
    displayName?: string;
    username?: string;
    avatarConfig?: { baseColor: string };
    profilePicture?: { url?: string | null } | null;
    profilePictureUrl?: string | null;
    avatarDecoration?: { decorationId?: string | null } | null;
    decorationId?: string | null;
  } | null;
  chatAppearance?: ChatAppearance | null;
  onReply: (replyMetadata: ReplyToMetadata) => void;
  onLongPress: (message: MessageV2) => void;
  onScrollToMessage: (messageId: string) => void;
  onRetry: (message: MessageV2) => Promise<void>;
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
  /** Resolved sender profile picture URL (null for initials fallback) */
  senderProfilePictureUrl?: string | null;
  /** Resolved sender decoration ID */
  senderDecorationId?: string | null;
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
      senderProfilePictureUrl,
      senderDecorationId,
    }) => {
      const theme = useTheme();
      const navigation = useNavigation<NativeStackNavigationProp<any>>();
      const isSentByMe = message.senderId === currentUid;
      const messageText = message.text || "";
      const imageAttachment = message.attachments?.find(
        (attachment) => attachment.kind === "image",
      );
      const voiceAttachment = message.attachments?.find(
        (attachment) => attachment.kind === "audio",
      );

      // ── Font color ────────────────────────────────────────────────────
      // Stacked mode uses a single theme-adaptive text color for all
      // messages (no per-sender custom font colors). This guarantees
      // uniform readability and proper light/dark contrast.
      const fontColor = theme.colors.onSurface;

      // ── Link previews ─────────────────────────────────────────────────
      const messagesForPreview = React.useMemo(
        () =>
          message.kind === "text" && hasUrls(messageText)
            ? [{ id: message.id, text: messageText, kind: message.kind }]
            : [],
        [message.id, message.kind, messageText],
      );
      const { linkPreviews, loadingPreviews } =
        useLinkPreviews(messagesForPreview);

      // ── Handlers ──────────────────────────────────────────────────────
      const handlePress = useCallback(() => {
        if (message.status === "failed") {
          onRetry(message);
          return;
        }
        if (message.kind === "media" && imageAttachment && onImagePress) {
          onImagePress(
            imageAttachment.url,
            senderDisplayName,
            new Date(message.createdAt),
          );
        }
      }, [message, imageAttachment, senderDisplayName, onImagePress, onRetry]);

      // ── Format timestamp ──────────────────────────────────────────────
      const formattedTime = React.useMemo(
        () => formatChatTimestamp(message.createdAt),
        [message.createdAt],
      );

      // ── Message content ───────────────────────────────────────────────
      const renderContent = () => {
        if (message.kind === "animal") {
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

        if (message.kind === "voice" && voiceAttachment) {
          return (
            <View
              style={[
                s.voiceContainer,
                {
                  backgroundColor: isSentByMe
                    ? theme.colors.primaryContainer + "55"
                    : theme.colors.surfaceVariant + "DD",
                  borderColor: isSentByMe
                    ? theme.colors.primary + "30"
                    : theme.colors.outline + "55",
                },
              ]}
            >
              <VoiceMessagePlayer
                url={voiceAttachment.url}
                durationMs={voiceAttachment.durationMs || 0}
                isOwn={isSentByMe}
              />
            </View>
          );
        }

        if (message.kind === "media") {
          if (imageAttachment) {
            const imgSize = getImageSize(
              imageAttachment.width,
              imageAttachment.height,
            );
            return (
              <FeedImage
                source={{ uri: imageAttachment.url }}
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
              {messageText}
            </Text>
            {hasUrls(messageText) && (
              <View style={s.linkPreviewContainer}>
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
              </View>
            )}
          </>
        );
      };

      // ── Swipeable message shell ───────────────────────────────────────
      // ── Author name color ─────────────────────────────────────────────
      const authorColor = isSentByMe
        ? theme.colors.primary
        : theme.colors.secondary;

      // ── Self-message row styling — removed ─────────────────────────
      // In Discord-style feed, own messages have no background tint.
      // Only mention-highlighted rows get a row-level treatment.
      // (DM mode has no mentions, so no tint at all.)

      return (
        <SwipeableMessage
          message={message}
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
            <MessageHighlightOverlay isHighlighted={isHighlighted} />

            {/* ── Message row: [avatar/spacer] [content column] ──────── */}
            <TouchableOpacity
              activeOpacity={0.7}
              onLongPress={() => onLongPress(message)}
              onPress={handlePress}
              delayLongPress={300}
              accessibilityLabel={
                message.kind === "voice"
                  ? `${isSentByMe ? "You sent" : `${senderDisplayName} sent`} a voice message`
                  : message.kind === "media"
                    ? `${isSentByMe ? "You sent" : `${senderDisplayName} sent`} a picture`
                    : `${isSentByMe ? "You" : senderDisplayName}: ${messageText}`
              }
              accessibilityRole="button"
              accessibilityHint="Long press for message options, swipe right to reply"
            >
              <View style={s.contentRow}>
                {/* Gutter: avatar at group-start, spacer for within-group */}
                {vm.isGroupStart ? (
                  <View style={s.gutter}>
                    <ProfilePictureWithDecoration
                      pictureUrl={senderProfilePictureUrl ?? null}
                      name={senderDisplayName}
                      decorationId={senderDecorationId}
                      size={F.avatarSize}
                    />
                  </View>
                ) : (
                  <View style={s.gutterSpacer} />
                )}

                {/* Content column — name + message in one vertical flow */}
                <View style={s.contentColumn}>
                  {/* Author name + timestamp + status (group-start only) */}
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
                          { color: theme.colors.onSurface + "99" },
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
                    style={[message.status === "failed" && s.failedContent]}
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

  // ── Group-start name row: [name] [timestamp] [status?] (inside content column)
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
