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
