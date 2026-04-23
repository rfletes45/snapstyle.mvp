/**
 * Games V4 — Chat Scorecard Message wrapper.
 *
 * Wraps a `<GameScorecard>` with the full chat-message frame so a
 * scorecard reads as a true authored message in the transcript:
 *  - Sender avatar (with decoration) on group-start.
 *  - Sender display name.
 *  - Timestamp.
 *  - Self/other alignment for bubble mode.
 *  - Avatar gutter + content column for stacked mode.
 *
 * This is the single rendering path for inline scorecards in both
 * `ChatScreen` (DM) and `GroupChatScreen` after the sentinel decode
 * short-circuit. Manual share + automatic host post both flow through
 * the same component so the visual result is consistent.
 *
 * @module gamesV4/components/ChatScorecardMessage
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import GameScorecard from "@/gamesV4/components/GameScorecard";
import type { GameScorecardPayload } from "@/gamesV4/types";
import type { MessageV2 } from "@/types/messaging";
import { formatChatTimestamp } from "@/utils/chatTimestamp";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

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
    }) => {
      const theme = useTheme();
      const timestamp = formatChatTimestamp(message.createdAt);
      const showSenderName = !isOwn && isGroupChat;

      // ── Stacked mode: feed-row with gutter avatar + content column ──
      if (displayMode === "stacked") {
        const authorColor = isOwn
          ? theme.colors.primary
          : theme.colors.secondary;
        return (
          <View style={s.stackedRow}>
            <View style={s.stackedGutter}>
              <ProfilePictureWithDecoration
                pictureUrl={senderProfilePictureUrl ?? null}
                name={senderDisplayName}
                decorationId={senderDecorationId ?? null}
                size={STACKED_AVATAR_SIZE}
              />
            </View>
            <View style={s.stackedContent}>
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
              <View style={s.scorecardWrap}>
                <GameScorecard payload={payload} />
              </View>
            </View>
          </View>
        );
      }

      // ── Bubble mode: aligned row, avatar on incoming side ───────────
      return (
        <View style={[s.bubbleRow, isOwn ? s.bubbleRowOwn : s.bubbleRowOther]}>
          {!isOwn && (
            <View style={s.bubbleAvatarCol}>
              <ProfilePictureWithDecoration
                pictureUrl={senderProfilePictureUrl ?? null}
                name={senderDisplayName}
                decorationId={senderDecorationId ?? null}
                size={AVATAR_SIZE}
              />
            </View>
          )}
          <View
            style={[
              s.bubbleColumn,
              isOwn ? { alignItems: "flex-end" } : { alignItems: "flex-start" },
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
            <GameScorecard payload={payload} />
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
          </View>
        </View>
      );
    },
  );

ChatScorecardMessage.displayName = "ChatScorecardMessage";

export default ChatScorecardMessage;

const s = StyleSheet.create({
  // Bubble mode
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

  // Stacked mode
  stackedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
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
