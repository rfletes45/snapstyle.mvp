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
import { StackedMessageRenderer } from "@/components/chat/StackedMessageRenderer";
import type { CardCornerWidthStore } from "@/components/chat/useGroupedCardLayout";
import { DMMessageItem } from "@/components/DMMessageItem";
import type { ChatAppearance } from "@/cosmetics/types";
import type { ReactionSummary } from "@/services/reactions";
import type { MessageV2, ReplyToMetadata } from "@/types/messaging";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChatMessageRendererProps {
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
  /** Current user's profile picture URL (for stacked mode avatars) */
  currentUserProfilePictureUrl?: string | null;
  /** Current user's decoration ID (for stacked mode avatars) */
  currentUserDecorationId?: string | null;
  /** ID of the newest outgoing message that should show read/delivered status (DM bubble mode) */
  newestStatusMessageId?: string;
  /** Shared width store for corner-only neighbor comparison (stacked mode). */
  cornerWidthStore?: CardCornerWidthStore;
  /** Previous neighbor in same group (for right-side corner shape). */
  groupPrevMessageId?: string;
  /** Next neighbor in same group (for right-side corner shape). */
  groupNextMessageId?: string;
  /**
   * Rendering inside a thread view.
   * When true the child renderers disable swipe-to-reply, suppress
   * failed-status opacity dimming, and route body taps through
   * `onMessageTap` so the thread can jump to the parent chat.
   */
  inThread?: boolean;
  /** Thread-only: tap handler to jump to parent chat message. */
  onMessageTap?: (message: MessageV2) => void;
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
      currentUserProfilePictureUrl,
      currentUserDecorationId,
      newestStatusMessageId,
      cornerWidthStore,
      groupPrevMessageId,
      groupNextMessageId,
      inThread = false,
      onMessageTap,
    }) => {
      const isSentByMe = message.senderId === currentUid;

      // Build the view-model once for both renderers
      const vm = React.useMemo(
        () =>
          buildMessageViewModel({
            isMine: isSentByMe,
            isGroupChat,
            isGroupedWithPrevious,
            isGroupedWithNext,
            isSystemMessage: message.kind === "system",
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
          message.kind,
          displayMode,
        ],
      );

      // Resolve the sender name for display
      const senderDisplayName = React.useMemo(() => {
        if (isSentByMe) {
          return currentUserDisplayName || message.senderName || "You";
        }
        return (
          friendProfile?.displayName ||
          friendProfile?.username ||
          message.senderName ||
          "Friend"
        );
      }, [
        isSentByMe,
        friendProfile,
        currentUserDisplayName,
        message.senderName,
      ]);

      // Resolve sender-level profile picture (matches group chat pattern)
      const senderProfilePictureUrl = React.useMemo(() => {
        if (isSentByMe) {
          return currentUserProfilePictureUrl ?? null;
        }
        return (
          friendProfile?.profilePicture?.url ||
          friendProfile?.profilePictureUrl ||
          null
        );
      }, [isSentByMe, friendProfile, currentUserProfilePictureUrl]);

      const senderDecorationId = React.useMemo(() => {
        if (isSentByMe) {
          return currentUserDecorationId ?? null;
        }
        return (
          friendProfile?.avatarDecoration?.decorationId ||
          friendProfile?.decorationId ||
          null
        );
      }, [isSentByMe, friendProfile, currentUserDecorationId]);

      // ── Bubble mode → existing DMMessageItem ──────────────────────────
      if (displayMode === "bubbles") {
        // In DM bubble mode, only the newest outgoing message shows status
        const shouldShowStatus =
          !isGroupChat && newestStatusMessageId
            ? message.id === newestStatusMessageId
            : true;

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
            isGroupedWithNext={isGroupedWithNext}
            showTimestamp={vm.showTimestamp}
            useTimeOnly={!isGroupChat}
            showStatus={shouldShowStatus}
            reactions={reactions}
            onOptimisticReaction={onOptimisticReaction}
            inThread={inThread}
            onMessageTap={onMessageTap}
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
          senderProfilePictureUrl={senderProfilePictureUrl}
          senderDecorationId={senderDecorationId}
          cornerWidthStore={cornerWidthStore}
          groupPrevMessageId={groupPrevMessageId}
          groupNextMessageId={groupNextMessageId}
          inThread={inThread}
          onMessageTap={onMessageTap}
        />
      );
    },
  );

ChatMessageRenderer.displayName = "ChatMessageRenderer";
