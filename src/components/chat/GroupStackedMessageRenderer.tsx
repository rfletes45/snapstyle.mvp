/**
 * GroupStackedMessageRenderer — Discord-style dense feed layout for group chats.
 *
 * Uses the same gutter/content-column grid as StackedMessageRenderer but adds:
 * - Profile pictures with decoration at group starts
 * - Multi-sender author headers with distinct colors
 * - @mention highlighting via MessageWithMentions
 *
 * NO bubble chrome around text messages — flat feed rows with self-message tint.
 */

import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

import {
  buildMessageViewModel,
  FEED_LAYOUT,
  hexToRgb,
} from "@/chat/displayMode";
import AppImage from "@/components/AppImage";
import {
  LinkPreviewCard,
  MessageWithMentions,
  ReactionPills,
  SwipeableMessage,
  ThreadIndicator,
  VoiceMessagePlayer,
} from "@/components/chat";
import { AnimalBubble } from "@/components/chat/AnimalBubble";
import { GROUP_STACKED_CARD_PADDING_H } from "@/components/chat/groupedCardMetrics";
import { MessageHighlightOverlay } from "@/components/chat/MessageHighlightOverlay";
import { StackedReplyReference } from "@/components/chat/StackedReplyReference";
import {
  useGroupedCardLayout,
  type CardCornerWidthStore,
} from "@/components/chat/useGroupedCardLayout";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { hasUrls } from "@/services/linkPreview";
import type { MentionableMember } from "@/services/mentionParser";
import { extractMentionsExact } from "@/services/mentionParser";
import type { ReactionSummary } from "@/services/reactions";
import type {
  AttachmentV2,
  MessageV2,
  ReplyToMetadata,
} from "@/types/messaging";
import { formatChatTimestamp } from "@/utils/chatTimestamp";

// ---------------------------------------------------------------------------
// Feed layout constants
// ---------------------------------------------------------------------------

const F = FEED_LAYOUT;
const CARD_PAD_V = F.rowPaddingV + 4; // 6px — full padding at group boundaries & solo
const CARD_PAD_V_INNER = 2; // tighter padding between grouped cards

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

export interface GroupStackedMessageRendererProps {
  item: MessageV2;
  uid: string | undefined;
  groupId: string;

  // ── Raw grouping flags (renderer builds vm internally) ───────────
  isGroupedWithPrevious: boolean;
  isGroupedWithNext: boolean;
  hasReactions: boolean;
  hasReplyPreview: boolean;
  hasThread: boolean;

  senderDisplayName: string;
  senderProfilePictureUrl: string | null;
  senderDecorationId: string | null;
  bubbleTextColor: string;
  bubbleFontFamily: string | undefined;
  /** Custom font color hex (null = use theme-adaptive default) */
  fontColorHex?: string | null;
  isHighlighted: boolean;
  reactions: ReactionSummary[];
  linkPreview: { url: string; fetchedAt: number } | undefined;
  loadingPreview: boolean;
  mentionableMembers: MentionableMember[];
  colors: any;
  onReply: (replyMetadata: ReplyToMetadata) => void;
  onMessageLongPress: (message: MessageV2) => void;
  onScrollToMessage: (messageId: string) => void;
  /** Stable callback — renderer passes attachments + metadata */
  onImagePress: (
    attachments: AttachmentV2[],
    index: number,
    senderName: string,
    timestamp: number,
  ) => void;
  onOptimisticReaction?: (messageId: string, emoji: string) => void;
  /** Stable callback — renderer passes message ID */
  onThreadPress: (messageId: string) => void;
  /** Shared width store for corner-only neighbor comparison. */
  cornerWidthStore?: CardCornerWidthStore;
  /** Previous neighbor in same group (for right-side corner shape). */
  groupPrevMessageId?: string;
  /** Next neighbor in same group (for right-side corner shape). */
  groupNextMessageId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GroupStackedMessageRenderer: React.FC<GroupStackedMessageRendererProps> =
  React.memo(
    ({
      item,
      uid,
      groupId,
      isGroupedWithPrevious,
      isGroupedWithNext,
      hasReactions,
      hasReplyPreview,
      hasThread,
      senderDisplayName,
      senderProfilePictureUrl,
      senderDecorationId,
      bubbleTextColor,
      bubbleFontFamily,
      fontColorHex,
      isHighlighted,
      reactions,
      linkPreview,
      loadingPreview,
      mentionableMembers,
      colors,
      onReply,
      onMessageLongPress,
      onScrollToMessage,
      onImagePress,
      onOptimisticReaction,
      onThreadPress,
      cornerWidthStore,
      groupPrevMessageId,
      groupNextMessageId,
    }) => {
      const theme = useTheme();
      const isOwnMessage = item.senderId === uid;

      // ── Build VM from raw flags (memoized on primitives) ──────────
      const vm = useMemo(
        () =>
          buildMessageViewModel({
            isMine: isOwnMessage,
            isGroupChat: true,
            isGroupedWithPrevious,
            isGroupedWithNext,
            isSystemMessage: false,
            hasReactions,
            hasReplyPreview,
            hasThread,
            displayMode: "stacked",
          }),
        [
          isOwnMessage,
          isGroupedWithPrevious,
          isGroupedWithNext,
          hasReactions,
          hasReplyPreview,
          hasThread,
        ],
      );

      // ── Stable per-message callbacks ──────────────────────────────
      const handleImagePress = useCallback(() => {
        const imageAtt = item.attachments?.find((a) => a.kind === "image");
        if (item.kind === "media" && imageAtt) {
          onImagePress([imageAtt], 0, senderDisplayName, item.createdAt);
        }
      }, [
        item.attachments,
        item.kind,
        item.createdAt,
        senderDisplayName,
        onImagePress,
      ]);

      const handleThreadPress = useCallback(() => {
        onThreadPress(item.id);
      }, [item.id, onThreadPress]);

      const authorColor = isOwnMessage ? colors.primary : colors.secondary;

      const imageAttachment = item.attachments?.find((a) => a.kind === "image");
      const voiceAttachment = item.attachments?.find((a) => a.kind === "audio");

      // ── Mention-targeted row styling (Discord-like) ───────────────
      // Only highlight the row if the message mentions the current user
      // or uses @everyone / @all. Regular and self messages have no tint.
      const mentionsMe =
        uid != null &&
        (item.mentionUids?.includes(uid) ||
          item.mentionUids?.includes("everyone") ||
          item.mentionUids?.includes("all") ||
          item.mentionUids?.includes("@all"));

      const mentionRowStyle = mentionsMe
        ? {
            backgroundColor: `rgba(${hexToRgb(colors.tertiary || colors.primary)}, ${theme.dark ? 0.06 : 0.04})`,
            borderLeftWidth: 2,
            borderLeftColor: `rgba(${hexToRgb(colors.tertiary || colors.primary)}, ${theme.dark ? 0.5 : 0.4})`,
          }
        : undefined;

      // ── Deterministic card corners ────────────────────────────────
      const groupCardBg = colors.background;
      const { groupCardRadius, handleCardLayout } = useGroupedCardLayout({
        messageId: item.id,
        isGroupStart: vm.isGroupStart,
        isGroupEnd: vm.isGroupEnd,
        cornerWidthStore,
        groupPrevMessageId,
        groupNextMessageId,
      });

      // ── Within-group vertical tightening ────────────────────────────
      const cardPaddingTop = vm.isGroupStart ? CARD_PAD_V : CARD_PAD_V_INNER;
      const showReactionPills = reactions.length > 0;
      const cardPaddingBottom = vm.isGroupEnd
        ? CARD_PAD_V
        : showReactionPills
          ? CARD_PAD_V_INNER + 2
          : CARD_PAD_V_INNER;

      // ── Message content ───────────────────────────────────────────────
      const renderContent = () => {
        if (item.kind === "animal") {
          if (item.animalId) {
            return <AnimalBubble animalId={item.animalId} isMine={false} />;
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

        if (item.kind === "media" && imageAttachment) {
          return (
            <AppImage
              source={{ uri: imageAttachment.url }}
              style={[
                gs.image,
                getImageSize(imageAttachment.width, imageAttachment.height),
              ]}
              contentFit="cover"
              debugLabel="GroupStackedFeedImage"
            />
          );
        }

        if (item.kind === "voice" && voiceAttachment) {
          return (
            <View
              style={[
                gs.voiceContainer,
                {
                  backgroundColor: isOwnMessage
                    ? theme.colors.primaryContainer + "55"
                    : theme.colors.surfaceVariant + "DD",
                  borderColor: isOwnMessage
                    ? theme.colors.primary + "30"
                    : theme.colors.outline + "55",
                },
              ]}
            >
              <VoiceMessagePlayer
                url={voiceAttachment.url}
                durationMs={voiceAttachment.durationMs || 0}
                isOwn={isOwnMessage}
              />
            </View>
          );
        }

        // Text message — no bubble
        return (
          <>
            <MessageWithMentions
              text={item.text || ""}
              mentionSpans={
                item.mentionSpans ??
                ((item.mentionUids?.length ?? 0) > 0
                  ? extractMentionsExact(item.text || "", mentionableMembers)
                      .mentionSpans
                  : undefined)
              }
              currentUid={uid}
              textStyle={[
                gs.messageText,
                {
                  color: colors.text,
                  ...(bubbleFontFamily ? { fontFamily: bubbleFontFamily } : {}),
                },
              ]}
              mentionRadius={6}
            />
            {hasUrls(item.text || "") && linkPreview && (
              <View style={gs.linkPreviewContainer}>
                <LinkPreviewCard
                  preview={linkPreview}
                  isOwn={isOwnMessage}
                  loading={loadingPreview}
                />
              </View>
            )}
          </>
        );
      };

      return (
        <SwipeableMessage
          message={item}
          onReply={onReply}
          enabled={true}
          currentUid={uid}
        >
          <View
            style={[
              gs.feedRow,
              vm.isGroupStart ? gs.feedRowGroupStart : gs.feedRowWithinGroup,
            ]}
          >
            {/* ── Message row: [avatar/spacer] [content column] ──────── */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={item.kind === "media" ? handleImagePress : undefined}
              onLongPress={() => onMessageLongPress(item)}
              delayLongPress={300}
            >
              <View style={gs.contentRow}>
                {/* Gutter: avatar at group-start, spacer for within-group */}
                {vm.isGroupStart ? (
                  <View style={gs.gutter}>
                    {vm.showAvatar ? (
                      <ProfilePictureWithDecoration
                        pictureUrl={senderProfilePictureUrl}
                        name={senderDisplayName}
                        decorationId={senderDecorationId}
                        size={F.avatarSize}
                      />
                    ) : (
                      <View style={gs.avatarPlaceholder}>
                        <Text
                          style={[
                            gs.avatarText,
                            { color: colors.onPrimaryContainer },
                          ]}
                        >
                          {senderDisplayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={gs.gutterSpacer} />
                )}

                {/* Content column — name + message in one vertical flow */}
                <View style={gs.contentColumn}>
                  <View
                    onLayout={handleCardLayout}
                    style={[
                      gs.cardWrapper,
                      {
                        backgroundColor: groupCardBg,
                        overflow: "hidden",
                      },
                      groupCardRadius,
                      mentionRowStyle,
                    ]}
                  >
                    {/* Highlight overlay */}
                    <MessageHighlightOverlay isHighlighted={isHighlighted} />
                    <View
                      style={[
                        gs.cardContent,
                        {
                          paddingTop: cardPaddingTop,
                          paddingBottom: cardPaddingBottom,
                        },
                      ]}
                    >
                      {/* Author name + timestamp (group-start only) */}
                      {vm.isGroupStart && (
                        <View style={gs.nameRow}>
                          <Text
                            style={[gs.authorName, { color: authorColor }]}
                            numberOfLines={1}
                          >
                            {senderDisplayName}
                          </Text>
                          <Text
                            style={[
                              gs.headerTimestamp,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {formatChatTimestamp(item.createdAt)}
                          </Text>
                        </View>
                      )}

                      {/* Reply preview — stacked-mode inline reference */}
                      {item.replyTo && (
                        <StackedReplyReference
                          replyTo={item.replyTo}
                          isReplyToMe={item.replyTo.senderId === uid}
                          onPress={() =>
                            onScrollToMessage(item.replyTo!.messageId)
                          }
                        />
                      )}

                      {/* Message content — no bubble wrapper */}
                      {renderContent()}

                      {/* Thread indicator — inline inside card when mid-group */}
                      {vm.threadPlacement === "inline" && (
                        <ThreadIndicator
                          replyCount={item.replyCount!}
                          isOutgoing={isOwnMessage}
                          onPress={handleThreadPress}
                        />
                      )}

                      {/* Reaction pills — inside the card, aligned with content */}
                      {showReactionPills && (
                        <View style={gs.reactionRow}>
                          <ReactionPills
                            reactions={reactions}
                            isOwnMessage={false}
                            scope="group"
                            conversationId={groupId}
                            messageId={item.id}
                            currentUid={uid || ""}
                            onOptimisticToggle={onOptimisticReaction}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Thread indicator — external below card at group-end / solo */}
            {vm.threadPlacement === "external" && (
              <View style={gs.threadRow}>
                <View style={gs.gutterSpacer} />
                <ThreadIndicator
                  replyCount={item.replyCount!}
                  isOutgoing={isOwnMessage}
                  onPress={handleThreadPress}
                />
              </View>
            )}
          </View>
        </SwipeableMessage>
      );
    },
  );

GroupStackedMessageRenderer.displayName = "GroupStackedMessageRenderer";

// ---------------------------------------------------------------------------
// Styles — Feed-row grid system (mirrors StackedMessageRenderer)
// ---------------------------------------------------------------------------

const gs = StyleSheet.create({
  feedRow: {
    width: "100%",
    paddingLeft: F.rowPaddingH - 6,
    paddingRight: F.rowPaddingH + 6,
  },
  feedRowGroupStart: {
    marginTop: F.groupGap,
  },
  feedRowWithinGroup: {
    marginTop: F.withinGroupGap,
  },

  // Group-start name row: [name] [timestamp] (inside content column)
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
    transform: [{ translateX: 4 }],
  },
  avatarPlaceholder: {
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

  // Content row: [gutter spacer] [content column]
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
  cardWrapper: {
    alignSelf: "flex-start" as const,
  },
  cardContent: {
    alignSelf: "flex-start" as const,
    paddingHorizontal: GROUP_STACKED_CARD_PADDING_H,
  },

  // Message text (no bubble)
  messageText: {
    fontSize: F.messageFontSize,
    lineHeight: F.messageLineHeight,
  },

  // Media
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

  // Reactions (inside card, aligned with message content)
  reactionRow: {
    marginTop: 0,
    marginLeft: -4,
  },

  // Metadata
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: F.timestampFontSize,
  },

  // Thread indicator
  threadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
  },
});
