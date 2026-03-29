/**
 * ChatMessageRenderer — Unified Message Item
 *
 * Single entry point for rendering a message in the chat list.
 * Computes the MessageViewModel and delegates to either:
 * - DMMessageItem (bubble mode — existing renderer)
 * - StackedMessageRenderer (stacked mode — new dense layout)
 *
 * This component owns the view-model computation so both renderers
 * receive normalized signals without duplicating grouping logic.
 */

import React from "react";

import type { ConversationDisplayMode } from "@/chat/displayMode";
import { buildMessageViewModel } from "@/chat/displayMode";
import type { MessageWithProfile } from "@/components/DMMessageItem";
import { DMMessageItem } from "@/components/DMMessageItem";
import { StackedMessageRenderer } from "@/components/chat/StackedMessageRenderer";
import type { ChatAppearance } from "@/cosmetics/types";
import type { ReactionSummary } from "@/services/reactions";
import type { ReplyToMetadata } from "@/types/messaging";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChatMessageRendererProps {
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

  /** Display mode — from user preference context */
  displayMode: ConversationDisplayMode;
  /** Is this a group chat? */
  isGroupChat: boolean;
  /** Is this message grouped with the one visually above? (same sender, close time) */
  isGroupedWithPrevious: boolean;
  /** Is this message grouped with the one visually below? */
  isGroupedWithNext: boolean;
  /** Current user's display name (for stacked mode author labels) */
  currentUserDisplayName?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ChatMessageRenderer: React.FC<ChatMessageRendererProps> =
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
      displayMode,
      isGroupChat,
      isGroupedWithPrevious,
      isGroupedWithNext,
      currentUserDisplayName,
    }) => {
      const isSentByMe = message.sender === currentUid;

      // Build the view-model once for both renderers
      const vm = React.useMemo(
        () =>
          buildMessageViewModel({
            isMine: isSentByMe,
            isGroupChat,
            isGroupedWithPrevious,
            isGroupedWithNext,
            isSystemMessage: false,
            hasReactions: reactions.length > 0,
            hasReplyPreview: !!message.replyTo,
            hasThread: !!message.replyCount && message.replyCount > 0,
            displayMode,
          }),
        [
          isSentByMe,
          isGroupChat,
          isGroupedWithPrevious,
          isGroupedWithNext,
          reactions.length,
          message.replyTo,
          message.replyCount,
          displayMode,
        ],
      );

      // Resolve the sender name for display
      const senderDisplayName = React.useMemo(() => {
        if (isSentByMe) {
          return currentUserDisplayName || "You";
        }
        return (
          friendProfile?.displayName || friendProfile?.username || "Friend"
        );
      }, [isSentByMe, friendProfile, currentUserDisplayName]);

      // ── Bubble mode → existing DMMessageItem ──────────────────────────
      if (displayMode === "bubbles") {
        return (
          <DMMessageItem
            message={message}
            currentUid={currentUid}
            chatId={chatId}
            friendProfile={friendProfile}
            chatAppearance={chatAppearance}
            onReply={onReply}
            onLongPress={onLongPress}
            onScrollToMessage={onScrollToMessage}
            onRetry={onRetry}
            onImagePress={onImagePress}
            isHighlighted={isHighlighted}
            isGrouped={isGroupedWithPrevious}
            showTimestamp={vm.showTimestamp}
            reactions={reactions}
            onOptimisticReaction={onOptimisticReaction}
          />
        );
      }

      // ── Stacked mode → new dense renderer ────────────────────────────
      return (
        <StackedMessageRenderer
          message={message}
          currentUid={currentUid}
          chatId={chatId}
          friendProfile={friendProfile}
          chatAppearance={chatAppearance}
          onReply={onReply}
          onLongPress={onLongPress}
          onScrollToMessage={onScrollToMessage}
          onRetry={onRetry}
          onImagePress={onImagePress}
          isHighlighted={isHighlighted}
          reactions={reactions}
          onOptimisticReaction={onOptimisticReaction}
          vm={vm}
          senderDisplayName={senderDisplayName}
        />
      );
    },
  );

ChatMessageRenderer.displayName = "ChatMessageRenderer";
