/**
 * Hooks Index
 *
 * Exports:
 * - useMessagesV2: V2 message subscription with pagination
 * - useUnreadCount: Unread count calculation
 * - useMentionAutocomplete: @mention autocomplete state management
 * - useAttachmentPicker: Multi-attachment selection and upload management
 * - useVoiceRecorder: Voice message recording with expo-audio
 * - useOutboxProcessor: Outbox message processing
 * - useInboxData: Combined inbox data hook for DMs and Groups
 * - useConversationActions: Action handlers for inbox items
 * - useFriendRequests: Friend requests subscription with actions
 */

export { useMessagesV2, useUnreadCount } from "./useMessagesV2";

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
