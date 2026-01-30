/**
 * Hooks Index
 *
 * Exports:
 * - useChat: Unified chat hook (ARCH-D02) - composes all chat functionality
 * - useUnifiedMessages: Unified message subscription (ARCH-D01)
 * - useChatComposer: Chat composer state management (ARCH-D03)
 * - useUnifiedChatScreen: Screen-ready hook that composes useChat + useChatComposer (UNI-04)
 * - useSnapCapture: Snap/photo capture and upload hook (UNI-05)
 * - useMessagesV2: @deprecated - Use useChat or useUnifiedMessages instead
 * - useUnreadCount: Unread count calculation
 * - useMentionAutocomplete: @mention autocomplete state management
 * - useAttachmentPicker: Multi-attachment selection and upload management
 * - useVoiceRecorder: Voice message recording with expo-audio
 * - useOutboxProcessor: Outbox message processing
 * - useInboxData: Combined inbox data hook for DMs and Groups
 * - useConversationActions: Action handlers for inbox items
 * - useFriendRequests: Friend requests subscription with actions
 */

// =============================================================================
// Unified Chat Hooks (Phase D)
// =============================================================================

export { useChat, default as useChatDefault } from "./useChat";
export type {
  SendMessageOptions,
  UseChatConfig,
  UseChatReturn,
} from "./useChat";

export { useUnifiedMessages } from "./useUnifiedMessages";
export type {
  UseUnifiedMessagesOptions,
  UseUnifiedMessagesReturn,
} from "./useUnifiedMessages";

export { useChatComposer } from "./useChatComposer";
export type {
  ComposerSendOptions,
  UseChatComposerConfig,
  UseChatComposerReturn,
} from "./useChatComposer";

export { useUnifiedChatScreen } from "./useUnifiedChatScreen";
export type {
  UseUnifiedChatScreenConfig,
  UseUnifiedChatScreenReturn,
} from "./useUnifiedChatScreen";

export { useSnapCapture } from "./useSnapCapture";
export type {} from "./useSnapCapture";

// =============================================================================
// Legacy Hooks (Deprecated)
// =============================================================================

/** @deprecated Use useChat or useUnifiedMessages instead */
export { useMessagesV2, useUnreadCount } from "./useMessagesV2";

// =============================================================================
// Feature-Specific Hooks
// =============================================================================

export { useMentionAutocomplete } from "./useMentionAutocomplete";
export type {
  UseMentionAutocompleteOptions,
  UseMentionAutocompleteReturn,
} from "./useMentionAutocomplete";

export { useAttachmentPicker } from "./useAttachmentPicker";
export type {
  UseAttachmentPickerOptions,
  UseAttachmentPickerReturn,
} from "./useAttachmentPicker";

export { useVoiceRecorder } from "./useVoiceRecorder";
export type {
  UseVoiceRecorderOptions,
  UseVoiceRecorderReturn,
  VoiceRecording,
} from "./useVoiceRecorder";

export { useOutboxProcessor } from "./useOutboxProcessor";

// Inbox Overhaul hooks
export { useInboxData, useInboxUnreadCount } from "./useInboxData";
export type {
  InboxFilter,
  InboxSort,
  UseInboxDataResult,
} from "./useInboxData";

export { useConversationActions } from "./useConversationActions";
export type {
  MuteDuration,
  UseConversationActionsOptions,
  UseConversationActionsResult,
} from "./useConversationActions";

export { useFriendRequests } from "./useFriendRequests";
export type {
  FriendRequestWithUser,
  UseFriendRequestsResult,
} from "./useFriendRequests";

export { useGameLoop, useGameTick, usePerformanceMonitor } from "./useGameLoop";
export type { GameFrameCallback, UseGameLoopReturn } from "./useGameLoop";

export {
  useGameAchievements,
  useGameOverAchievements,
  useMultiplayerAchievements,
} from "./useGameAchievements";

export { useGameHaptics } from "./useGameHaptics";
export type { HapticFeedbackType } from "./useGameHaptics";

export { useGameSounds } from "./useGameSounds";
export type { GameSoundType, GameSoundsConfig } from "./useGameSounds";
