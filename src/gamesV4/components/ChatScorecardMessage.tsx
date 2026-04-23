/**
 * Games V4 — Chat Scorecard Message wrapper.
 *
 * Renders a `<GameScorecard>` inside a first-class chat-message frame
 * so scorecards behave like real messages in the transcript:
 *  - Sender avatar (with decoration) + display name + timestamp.
 *  - Self/other alignment for bubble mode, gutter+content for stacked.
 *  - Swipe-to-reply via `<SwipeableMessage>`.
 *  - Long-press menu via `TouchableOpacity onLongPress`.
 *  - Reply preview rendering when `message.replyTo` is set.
 *  - Inline reaction pills when reactions exist.
 *  - Thread indicator when `replyCount > 0`.
 *  - Grouping awareness: collapses avatar/header when
 *    `isGroupedWithPrevious` so adjacent same-sender rows stack cleanly.
 *
 * Callers (ChatScreen / GroupChatScreen) thread the same handlers here
 * that the canonical `ChatMessageRenderer` receives, so the scorecard
 * row participates in the normal gesture/grouping pipeline instead of
 * bypassing it.
 *
 * @module gamesV4/components/ChatScorecardMessage
 */

import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback } from "react";
import {
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";

import { ReplyBubble, SwipeableMessage } from "@/components/chat";
import { MessageHighlightOverlay } from "@/components/chat/MessageHighlightOverlay";
import { ReactionPills } from "@/components/chat/ReactionBar";
import { ThreadIndicator } from "@/components/chat/ThreadIndicator";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import GameScorecard from "@/gamesV4/components/GameScorecard";
import type { GameScorecardPayload } from "@/gamesV4/types";
import type { ReactionSummary } from "@/services/reactions";
import type { MessageV2, ReplyToMetadata } from "@/types/messaging";
import { formatChatTimestamp } from "@/utils/chatTimestamp";

export interface ChatScorecardMessageProps {
  message: MessageV2;
  payload: GameScorecardPayload;
  isOwn: boolean;
  /** Display mode currently active in this conversation. */
  displayMode: "bubbles" | "stacked";
  /** True for group chats. Controls sender-name visibility for incoming messages. */
  isGroupChat: boolean;
  senderDisplayName: string;
  senderProfilePictureUrl?: string | null;
  senderDecorationId?: string | null;

  // ── First-class chat-message integration ────────────────────────────
  /** Conversation ID (chatId for DM, groupId for group). */
  conversationId?: string | null;
  /** Current viewer UID (reactions/scope). */
  currentUid?: string;
  /** Swipe-to-reply handler (same as normal messages). */
  onReply?: (replyTo: ReplyToMetadata) => void;
  /** Long-press handler — opens the message action menu. */
  onLongPress?: (message: MessageV2) => void;
  /** Jump to a message when the reply preview is tapped. */
  onScrollToMessage?: (messageId: string) => void;
  /** Live reactions for this message. */
  reactions?: ReactionSummary[];
  /** Optimistic reaction toggle. */
  onOptimisticReaction?: (messageId: string, emoji: string) => void;
  /** Custom thread-press handler (group stacked uses this). Falls back to nav. */
  onThreadPress?: (messageId: string) => void;
  /** Highlight pulse (reply navigation target). */
  isHighlighted?: boolean;
  /** Grouping flags — collapse avatar/header when grouped-with-previous. */
  isGroupedWithPrevious?: boolean;
  isGroupedWithNext?: boolean;
}

const AVATAR_SIZE = 36;
const STACKED_AVATAR_SIZE = 36;

export const ChatScorecardMessage: React.FC<ChatScorecardMessageProps> =
  React.memo(
    ({
      message,
      payload,
      isOwn,
      displayMode,
      isGroupChat,
      senderDisplayName,
      senderProfilePictureUrl,
      senderDecorationId,
      conversationId,
      currentUid,
      onReply,
      onLongPress,
      onScrollToMessage,
      reactions = [],
      onOptimisticReaction,
      onThreadPress,
      isHighlighted = false,
      isGroupedWithPrevious = false,
      isGroupedWithNext = false,
    }) => {
      const theme = useTheme();
      const navigation = useNavigation<NativeStackNavigationProp<any>>();
      const timestamp = formatChatTimestamp(message.createdAt);
      const showSenderName = !isOwn && isGroupChat && !isGroupedWithPrevious;
      const showHeader = !isGroupedWithPrevious;

      const scope: "dm" | "group" = isGroupChat ? "group" : "dm";
      const hasReactions = reactions.length > 0;
      const hasThread = !!message.replyCount && message.replyCount > 0;

      const handleLongPress = useCallback(() => {
        onLongPress?.(message);
      }, [onLongPress, message]);

      const handleThreadPress = useCallback(() => {
        if (onThreadPress) {
          onThreadPress(message.id);
          return;
        }
        Keyboard.dismiss();
        (navigation as any).navigate("ThreadView", {
          conversationId: conversationId ?? null,
          scope,
          rootMessageId: message.id,
        });
      }, [onThreadPress, navigation, conversationId, scope, message.id]);

      const handleReplyBubblePress = useCallback(() => {
        if (!message.replyTo) return;
        onScrollToMessage?.(message.replyTo.messageId);
      }, [message.replyTo, onScrollToMessage]);

      const swipeEnabled = !!onReply;
      const longPressEnabled = !!onLongPress;

      const cardBody = (
        <TouchableOpacity
          activeOpacity={longPressEnabled ? 0.9 : 1}
          onLongPress={longPressEnabled ? handleLongPress : undefined}
          delayLongPress={300}
          disabled={!longPressEnabled}
          accessibilityRole={longPressEnabled ? "button" : undefined}
          accessibilityLabel={`${senderDisplayName} shared a ${payload.gameTitle} scorecard`}
          accessibilityHint={
            longPressEnabled
              ? "Long press for message options, swipe right to reply"
              : undefined
          }
        >
          <GameScorecard payload={payload} />
        </TouchableOpacity>
      );

      const reactionsRow =
        hasReactions && conversationId && currentUid ? (
          <ReactionPills
            reactions={reactions}
            isOwnMessage={isOwn}
            scope={scope}
            conversationId={conversationId}
            messageId={message.id}
            currentUid={currentUid}
            onOptimisticToggle={onOptimisticReaction}
          />
        ) : null;

      const threadRow = hasThread ? (
        <ThreadIndicator
          replyCount={message.replyCount!}
          isOutgoing={isOwn}
          onPress={handleThreadPress}
        />
      ) : null;

      const replyPreview = message.replyTo ? (
        <ReplyBubble
          replyTo={message.replyTo}
          isSentByMe={isOwn}
          isReplyToMe={message.replyTo.senderId === currentUid}
          onPress={handleReplyBubblePress}
        />
      ) : null;

      // ── Stacked mode ────────────────────────────────────────────────
      if (displayMode === "stacked") {
        const authorColor = isOwn
          ? theme.colors.primary
          : theme.colors.secondary;

        // Grouped-card shell — scorecards in group chats must remain
        // readable over whatever wallpaper/background a group has set,
        // and they must visually "belong" to the same grouped-box run
        // as adjacent text messages. We echo the surface colour +
        // corner-radius rules used by `GroupStackedMessageRenderer`
        // so the scorecard slots into a run with seamless corners.
        const cardSurfaceBg = theme.colors.background;
        const topRadius = isGroupedWithPrevious ? 6 : 18;
        const bottomRadius = isGroupedWithNext ? 6 : 18;
        const groupedCardStyle = isGroupChat
          ? {
              backgroundColor: cardSurfaceBg,
              borderTopLeftRadius: topRadius,
              borderTopRightRadius: topRadius,
              borderBottomLeftRadius: bottomRadius,
              borderBottomRightRadius: bottomRadius,
              paddingHorizontal: 10,
              paddingTop: isGroupedWithPrevious ? 2 : 8,
              paddingBottom: isGroupedWithNext ? 2 : 8,
              marginTop: isGroupedWithPrevious ? 1 : 2,
              marginBottom: isGroupedWithNext ? 1 : 2,
              // Stacked mode always left-aligns content against the
              // avatar gutter (Discord-style), regardless of sender.
              // `alignSelf: flex-start` shrinks the shell to hug the
              // 280px card instead of stretching to the full row width.
              alignSelf: "flex-start" as const,
            }
          : null;

        return (
          <SwipeableMessage
            message={message}
            onReply={onReply ?? (() => {})}
            enabled={swipeEnabled}
            currentUid={currentUid}
          >
            <View
              style={[
                s.stackedRow,
                isGroupedWithPrevious && s.stackedRowGrouped,
                isGroupedWithNext && s.stackedRowGroupedTight,
              ]}
            >
              <MessageHighlightOverlay isHighlighted={isHighlighted} />
              <View style={s.stackedGutter}>
                {showHeader ? (
                  <ProfilePictureWithDecoration
                    pictureUrl={senderProfilePictureUrl ?? null}
                    name={senderDisplayName}
                    decorationId={senderDecorationId ?? null}
                    size={STACKED_AVATAR_SIZE}
                  />
                ) : null}
              </View>
              <View style={s.stackedContent}>
                <View style={groupedCardStyle}>
                  {showHeader ? (
                    <View style={s.stackedNameRow}>
                      <Text
                        style={[s.authorName, { color: authorColor }]}
                        numberOfLines={1}
                      >
                        {senderDisplayName}
                      </Text>
                      <Text
                        style={[
                          s.timestampText,
                          { color: theme.colors.onSurface + "99" },
                        ]}
                      >
                        {timestamp}
                      </Text>
                    </View>
                  ) : null}
                  {replyPreview}
                  <View style={s.scorecardWrap}>{cardBody}</View>
                  {reactionsRow}
                  {threadRow}
                </View>
              </View>
            </View>
          </SwipeableMessage>
        );
      }

      // ── Bubble mode ─────────────────────────────────────────────────
      return (
        <SwipeableMessage
          message={message}
          onReply={onReply ?? (() => {})}
          enabled={swipeEnabled}
          currentUid={currentUid}
        >
          <View
            style={[
              s.bubbleRow,
              isOwn ? s.bubbleRowOwn : s.bubbleRowOther,
              isGroupedWithPrevious && s.bubbleRowGrouped,
              isGroupedWithNext && s.bubbleRowGroupedTight,
            ]}
          >
            <MessageHighlightOverlay isHighlighted={isHighlighted} />
            {!isOwn && (
              <View style={s.bubbleAvatarCol}>
                {showHeader ? (
                  <ProfilePictureWithDecoration
                    pictureUrl={senderProfilePictureUrl ?? null}
                    name={senderDisplayName}
                    decorationId={senderDecorationId ?? null}
                    size={AVATAR_SIZE}
                  />
                ) : null}
              </View>
            )}
            <View
              style={[
                s.bubbleColumn,
                isOwn
                  ? { alignItems: "flex-end" }
                  : { alignItems: "flex-start" },
              ]}
            >
              {showSenderName && (
                <Text
                  style={[s.senderName, { color: theme.colors.primary }]}
                  numberOfLines={1}
                >
                  {senderDisplayName}
                </Text>
              )}
              {replyPreview}
              {cardBody}
              {reactionsRow}
              {!isGroupedWithNext && (
                <View
                  style={[
                    s.timestampPill,
                    { backgroundColor: theme.colors.background },
                  ]}
                  pointerEvents="none"
                >
                  <Text
                    style={[
                      s.timestampText,
                      { color: theme.colors.onSurface + "99" },
                    ]}
                  >
                    {timestamp}
                  </Text>
                </View>
              )}
              {threadRow}
            </View>
          </View>
        </SwipeableMessage>
      );
    },
  );

ChatScorecardMessage.displayName = "ChatScorecardMessage";

export default ChatScorecardMessage;

const s = StyleSheet.create({
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  bubbleRowOwn: {
    justifyContent: "flex-end",
  },
  bubbleRowOther: {
    justifyContent: "flex-start",
  },
  bubbleRowGrouped: {
    marginTop: 1,
  },
  bubbleRowGroupedTight: {
    marginBottom: 1,
  },
  bubbleAvatarCol: {
    width: AVATAR_SIZE,
    marginRight: 6,
  },
  bubbleColumn: {
    maxWidth: "85%",
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
    marginLeft: 4,
  },
  timestampPill: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  timestampText: {
    fontSize: 11,
    fontWeight: "500",
  },

  stackedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  stackedRowGrouped: {
    marginTop: 0,
    paddingTop: 2,
  },
  stackedRowGroupedTight: {
    paddingBottom: 2,
  },
  stackedGutter: {
    width: STACKED_AVATAR_SIZE + 8,
    paddingTop: 2,
  },
  stackedContent: {
    flex: 1,
  },
  stackedNameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "700",
    marginRight: 8,
  },
  scorecardWrap: {
    alignItems: "flex-start",
  },
});
