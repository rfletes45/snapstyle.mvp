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

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

import type { MessageViewModel } from "@/chat/displayMode";
import { FEED_LAYOUT, hexToRgb } from "@/chat/displayMode";
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
import { MessageHighlightOverlay } from "@/components/chat/MessageHighlightOverlay";
import { StackedReplyReference } from "@/components/chat/StackedReplyReference";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { hasUrls } from "@/services/linkPreview";
import type { MentionableMember } from "@/services/mentionParser";
import { extractMentionsExact } from "@/services/mentionParser";
import type { ReactionSummary } from "@/services/reactions";
import type { MessageV2, ReplyToMetadata } from "@/types/messaging";

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

export interface GroupStackedMessageRendererProps {
  item: MessageV2;
  uid: string | undefined;
  groupId: string;
  vm: MessageViewModel;
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
  onImagePress: () => void;
  onOptimisticReaction?: (messageId: string, emoji: string) => void;
  onThreadPress: () => void;
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
      vm,
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
    }) => {
      const theme = useTheme();
      const isOwnMessage = item.senderId === uid;

      const authorColor = isOwnMessage ? colors.primary : colors.secondary;

      const imageAttachment = item.attachments?.find((a) => a.kind === "image");
      const voiceAttachment = item.attachments?.find((a) => a.kind === "audio");

      const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      };

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
                    ? theme.colors.primaryContainer + "40"
                    : theme.colors.surfaceVariant + "80",
                  borderColor: theme.colors.outline + "20",
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
              mentionRowStyle,
            ]}
          >
            {/* Highlight overlay */}
            <MessageHighlightOverlay isHighlighted={isHighlighted} />

            {/* ── Message row: [avatar/spacer] [content column] ──────── */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={item.kind === "media" ? onImagePress : undefined}
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
                          { color: colors.textMuted },
                        ]}
                      >
                        {formatTime(item.createdAt)}
                      </Text>
                    </View>
                  )}

                  {/* Reply preview — stacked-mode inline reference */}
                  {item.replyTo && (
                    <StackedReplyReference
                      replyTo={item.replyTo}
                      isReplyToMe={item.replyTo.senderId === uid}
                      onPress={() => onScrollToMessage(item.replyTo!.messageId)}
                    />
                  )}

                  {/* Message content — no bubble wrapper */}
                  {renderContent()}

                  {/* Reaction pills — always left-aligned in feed mode */}
                  {reactions.length > 0 && (
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

                  {/* Timestamp (group end only, when header didn't show it) */}
                  {vm.showTimestamp && !vm.isGroupStart && (
                    <View style={gs.metaRow}>
                      <Text style={[gs.metaText, { color: colors.textMuted }]}>
                        {formatTime(item.createdAt)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            {/* Thread indicator */}
            {!!item.replyCount && item.replyCount > 0 && (
              <View style={gs.threadRow}>
                <View style={gs.gutterSpacer} />
                <ThreadIndicator
                  replyCount={item.replyCount}
                  isOutgoing={isOwnMessage}
                  onPress={onThreadPress}
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
    paddingHorizontal: F.rowPaddingH,
    paddingVertical: F.rowPaddingV,
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

  // Reactions (always left-aligned)
  reactionRow: {
    marginTop: F.reactionRowGap,
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
