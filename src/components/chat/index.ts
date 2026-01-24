/**
 * Chat Components Index (H6/H7/H8/H9/H10/H11/H12)
 *
 * Exports all chat-related components for easy importing.
 *
 * @module components/chat
 */

// Reply-to components (H6)
export { ReplyBubble, default as ReplyBubbleDefault } from "./ReplyBubble";
export {
  ReplyPreviewBar,
  default as ReplyPreviewBarDefault,
} from "./ReplyPreviewBar";
export {
  SwipeableGroupMessage,
  default as SwipeableGroupMessageDefault,
} from "./SwipeableGroupMessage";
export type { GroupReplyToMetadata } from "./SwipeableGroupMessage";
export {
  SwipeableMessage,
  default as SwipeableMessageDefault,
} from "./SwipeableMessage";

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
