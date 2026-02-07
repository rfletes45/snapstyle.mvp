/**
 * Chat Components Index (H6/H7/H8/H9/H10/H11/H12/ARCH-C)
 *
 * Exports all chat-related components for easy importing.
 *
 * @module components/chat
 */

// Reply-to components (H6) & Swipeable Wrapper (ARCH-C01)
// ReplyBubble is the enhanced version with polished design
export { ReplyBubble, default as ReplyBubbleDefault } from "./ReplyBubbleNew";
export {
  ReplyPreviewBar,
  default as ReplyPreviewBarDefault,
} from "./ReplyPreviewBar";
// SwipeableMessage is the unified swipe-to-reply component for both DM and Group
export {
  SwipeableMessage,
  default as SwipeableMessageDefault,
} from "./SwipeableMessage";
export {
  SwipeableMessageWrapper,
  default as SwipeableMessageWrapperDefault,
} from "./SwipeableMessageWrapper";
export type { SwipeableMessageWrapperProps } from "./SwipeableMessageWrapper";

// Scroll return button for reply navigation
export { ScrollReturnButton } from "./ScrollReturnButton";

// Message highlight overlay for reply navigation
export { MessageHighlightOverlay } from "./MessageHighlightOverlay";

// Message actions (H7)
export {
  MessageActionsSheet,
  default as MessageActionsSheetDefault,
} from "./MessageActionsSheet";

// Reactions (H8)
export {
  QuickReactionBar,
  ReactionBar,
  default as ReactionBarDefault,
  ReactionsSummary,
} from "./ReactionBar";

// Mentions (H9)
export {
  MentionAutocomplete,
  default as MentionAutocompleteDefault,
  MentionText,
  MessageWithMentions,
} from "./MentionAutocomplete";
export type {
  MentionAutocompleteProps,
  MentionTextProps,
  RenderMessageWithMentionsProps,
} from "./MentionAutocomplete";

// Multi-Attachment Support (H10)
export {
  AttachmentGrid,
  default as AttachmentGridDefault,
} from "./AttachmentGrid";
export type { AttachmentGridProps } from "./AttachmentGrid";
export {
  AttachmentTray,
  default as AttachmentTrayDefault,
} from "./AttachmentTray";
export type { AttachmentTrayProps } from "./AttachmentTray";
export {
  MediaViewerModal,
  default as MediaViewerModalDefault,
} from "./MediaViewerModal";
export type { MediaViewerModalProps } from "./MediaViewerModal";

// Voice Messages (H11)
export {
  VoiceMessagePlayer,
  default as VoiceMessagePlayerDefault,
} from "./VoiceMessagePlayer";
export type { VoiceMessagePlayerProps } from "./VoiceMessagePlayer";
export {
  VoiceRecordButton,
  default as VoiceRecordButtonDefault,
} from "./VoiceRecordButton";
export type { VoiceRecordButtonProps } from "./VoiceRecordButton";

// Link Previews (H12)
export {
  LinkPreviewCard,
  default as LinkPreviewCardDefault,
} from "./LinkPreviewCard";
export type { LinkPreviewCardProps } from "./LinkPreviewCard";

// Camera with Long Press (PR1/PR2)
export {
  CameraLongPressButton,
  default as CameraLongPressButtonDefault,
} from "./CameraLongPressButton";

// Chat Skeleton for loading states (OPTIMIZATION)
export {
  ChatSkeleton,
  default as ChatSkeletonDefault,
  ConversationListSkeleton,
  ConversationSkeleton,
} from "./ChatSkeleton";

// Keyboard-aware Chat Components (ARCH-C04)
export { ChatComposer, default as ChatComposerDefault } from "./ChatComposer";
export type { ChatComposerProps, ChatScope } from "./ChatComposer";
export {
  ChatMessageList,
  default as ChatMessageListDefault,
} from "./ChatMessageList";
export type {
  ChatMessageListProps,
  ChatMessageListRef,
} from "./ChatMessageList";
export {
  ReturnToBottomPill,
  default as ReturnToBottomPillDefault,
} from "./ReturnToBottomPill";
export type { ReturnToBottomPillProps } from "./ReturnToBottomPill";

// Game Invites in Chat (Universal Game Invites)
export {
  ChatGameInvites,
  default as ChatGameInvitesDefault,
} from "./ChatGameInvites";
export type { ChatGameInvitesProps } from "./ChatGameInvites";

// Typing Indicator
// Typing Indicator
export { TypingIndicator } from "./TypingIndicator";

// Duck Feature
export { default as DuckBubble } from "./DuckBubble";
export { DUCK_BG, DUCK_FG, default as DuckIcon } from "./DuckIcon";

// Inbox Components
export {
  ConversationItem,
  EmptyState,
  InboxFAB,
  InboxHeader,
  InboxTabs,
  PinnedSection,
  SwipeableConversation,
} from "./inbox";
export type {
  ConversationItemProps,
  EmptyStateProps,
  InboxFABProps,
  InboxHeaderProps,
  InboxTabsProps,
  PinnedSectionProps,
  SwipeableConversationProps,
} from "./inbox";
