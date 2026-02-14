/**
 * useChatComposer Hook (ARCH-D03)
 *
 * Manages the chat composer state, optionally integrating with:
 * - Voice recording (hold-to-record)
 * - Attachment picking (images, camera)
 * - @mention autocomplete (groups only)
 *
 * This hook unifies composer-related state that was previously scattered
 * across screen components.
 *
 * ## Basic Usage (text only)
 *
 * ```typescript
 * const composer = useChatComposer({
 *   scope: "dm",
 *   conversationId: chatId,
 *   onSend: async (text, options) => {
 *     await chat.sendMessage(text, options);
 *   },
 * });
 *
 * // In your composer component:
 * <TextInput
 *   value={composer.text}
 *   onChangeText={composer.setText}
 *   onSelectionChange={(e) => composer.setCursorPosition(e.nativeEvent.selection.end)}
 * />
 * <Button onPress={() => composer.send()} disabled={!composer.canSend} />
 * ```
 *
 * ## With Voice Recording
 *
 * ```typescript
 * const composer = useChatComposer({
 *   scope: "group",
 *   conversationId: groupId,
 *   enableVoice: true,
 *   onSend: (text, options) => chat.sendMessage(text, options),
 *   onSendVoice: (recording) => sendVoiceMessage(recording),
 * });
 *
 * // Voice recording controls:
 * composer.voice.startRecording()
 * composer.voice.stopRecording()
 * composer.voice.isRecording
 * ```
 *
 * ## With Mentions (Groups)
 *
 * ```typescript
 * const composer = useChatComposer({
 *   scope: "group",
 *   conversationId: groupId,
 *   enableMentions: true,
 *   mentionableMembers: groupMembers,
 *   onSend: (text, options) => chat.sendMessage(text, options),
 * });
 *
 * // Mention autocomplete:
 * {composer.mentions?.isVisible && (
 *   <MentionSuggestions
 *     suggestions={composer.mentions.suggestions}
 *     onSelect={(member) => composer.insertMention(member)}
 *   />
 * )}
 * ```
 *
 * @module hooks/useChatComposer
 */

import {
  extractMentionsExact,
  InsertMentionResult,
  MentionableMember,
} from "@/services/mentionParser";
import { LocalAttachment } from "@/services/storage";
import { AttachmentV2, ReplyToMetadata } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useCallback, useMemo, useState } from "react";
import {
  useAttachmentPicker,
  UseAttachmentPickerReturn,
} from "./useAttachmentPicker";
import type { UseChatReturn } from "./useChat";
import {
  useMentionAutocomplete,
  UseMentionAutocompleteReturn,
} from "./useMentionAutocomplete";
import {
  useVoiceRecorder,
  UseVoiceRecorderReturn,
  VoiceRecording,
} from "./useVoiceRecorder";

const log = createLogger("useChatComposer");

// =============================================================================
// Types
// =============================================================================

/**
 * Send options for the composer
 */
export interface ComposerSendOptions {
  /** Reply metadata */
  replyTo?: ReplyToMetadata;
  /** Mention UIDs */
  mentionUids?: string[];
  /** Attachments to send */
  attachments?: LocalAttachment[];
}

/**
 * Configuration for useChatComposer
 */
export interface UseChatComposerConfig {
  /** Conversation scope ("dm" or "group") */
  scope: "dm" | "group";

  /** Conversation ID */
  conversationId: string;

  /** Current user ID (for excluding from mentions) */
  currentUid?: string;

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------

  /**
   * Called when send button is pressed (text + attachments)
   * @param text - Message text
   * @param options - Send options including mentions and attachments
   */
  onSend: (text: string, options: ComposerSendOptions) => Promise<void>;

  /**
   * Called when voice recording is sent
   * @param recording - Voice recording result
   */
  onSendVoice?: (recording: VoiceRecording) => Promise<void>;

  // -------------------------------------------------------------------------
  // Feature Toggles
  // -------------------------------------------------------------------------

  /** Enable voice recording (default: false) */
  enableVoice?: boolean;

  /** Enable @mention autocomplete (default: true for groups) */
  enableMentions?: boolean;

  /** Enable attachment picker (default: true) */
  enableAttachments?: boolean;

  // -------------------------------------------------------------------------
  // Mentions Config
  // -------------------------------------------------------------------------

  /** Members that can be mentioned (required if enableMentions=true) */
  mentionableMembers?: MentionableMember[];

  /** Max mention suggestions to show (default: 5) */
  maxMentionSuggestions?: number;

  // -------------------------------------------------------------------------
  // Attachments Config
  // -------------------------------------------------------------------------

  /** Max attachments allowed (default: 10) */
  maxAttachments?: number;

  // -------------------------------------------------------------------------
  // Voice Config
  // -------------------------------------------------------------------------

  /** Max voice recording duration in seconds (default: 60) */
  maxVoiceDuration?: number;

  // -------------------------------------------------------------------------
  // Integration Options
  // -------------------------------------------------------------------------

  /**
   * useChat hook instance for integrated send functionality.
   * When provided:
   * - `replyTo` is automatically synced from chatHook.replyTo
   * - `send()` uses chatHook.sendMessage()
   * - Reply state is auto-cleared after send via chatHook.clearReplyTo()
   */
  chatHook?: UseChatReturn;

  /**
   * Attachment upload handler.
   * Called before sending to upload local attachments to storage.
   * @param attachments - Local attachments to upload
   * @returns Promise resolving to uploaded attachment metadata
   */
  onUploadAttachments?: (
    attachments: LocalAttachment[],
  ) => Promise<AttachmentV2[]>;

  // -------------------------------------------------------------------------
  // Scheduled Messages Options
  // -------------------------------------------------------------------------

  /** Enable scheduled messages (default: false) */
  enableScheduledMessages?: boolean;

  /** Callback when schedule button pressed */
  onSchedulePress?: (text: string, attachments?: LocalAttachment[]) => void;

  // -------------------------------------------------------------------------
  // Other Options
  // -------------------------------------------------------------------------

  /** Reply metadata (controlled externally by useChat, or auto-synced from chatHook) */
  replyTo?: ReplyToMetadata | null;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Return type for useChatComposer
 */
export interface UseChatComposerReturn {
  // -------------------------------------------------------------------------
  // Text State
  // -------------------------------------------------------------------------

  /** Current input text */
  text: string;

  /** Set input text */
  setText: (text: string) => void;

  /** Current cursor position */
  cursorPosition: number;

  /** Set cursor position (call from onSelectionChange) */
  setCursorPosition: (position: number) => void;

  /** Combined text + cursor update */
  onTextChange: (text: string, cursorPosition?: number) => void;

  /** Whether text is empty (trimmed) */
  isEmpty: boolean;

  /** Clear text input */
  clearText: () => void;

  // -------------------------------------------------------------------------
  // Send State
  // -------------------------------------------------------------------------

  /** Whether send button should be enabled */
  canSend: boolean;

  /** Whether currently sending */
  sending: boolean;

  /** Send the current message */
  send: () => Promise<void>;

  // -------------------------------------------------------------------------
  // Mentions (Optional)
  // -------------------------------------------------------------------------

  /** Mention autocomplete state (null if disabled) */
  mentions: UseMentionAutocompleteReturn | null;

  /** Insert a mention at the current cursor position */
  insertMention: (member: MentionableMember) => void;

  /** Collected mention UIDs from text */
  mentionUids: string[];

  // -------------------------------------------------------------------------
  // Attachments (Optional)
  // -------------------------------------------------------------------------

  /** Attachment picker state (null if disabled) */
  attachments: UseAttachmentPickerReturn | null;

  /** Whether there are attachments selected */
  hasAttachments: boolean;

  // -------------------------------------------------------------------------
  // Voice Recording (Optional)
  // -------------------------------------------------------------------------

  /** Voice recorder state (null if disabled) */
  voice: UseVoiceRecorderReturn | null;

  /** Whether currently recording voice */
  isRecordingVoice: boolean;

  // -------------------------------------------------------------------------
  // Scheduled Messages (Optional)
  // -------------------------------------------------------------------------

  /** Whether schedule button should be visible */
  canSchedule: boolean;

  /** Whether scheduled messages are enabled */
  scheduledMessagesEnabled: boolean;

  /** Open schedule modal with current text/attachments */
  openScheduleModal: () => void;

  // -------------------------------------------------------------------------
  // Upload Progress (Integration)
  // -------------------------------------------------------------------------

  /** Current upload progress (null if not uploading) */
  uploadProgress: { current: number; total: number } | null;

  /** Whether currently uploading attachments */
  isUploading: boolean;

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  /** Reply metadata being handled (synced from chatHook if provided) */
  replyTo: ReplyToMetadata | null;

  /** Clear reply state (delegates to chatHook if provided) */
  clearReplyTo: () => void;

  /** Reset composer to initial state */
  reset: () => void;

  /** Scope of conversation */
  scope: "dm" | "group";

  /** Whether integrated with useChat hook */
  isIntegrated: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useChatComposer(
  config: UseChatComposerConfig,
): UseChatComposerReturn {
  const {
    scope,
    // conversationId is available in config but not currently used
    currentUid,
    onSend,
    onSendVoice,
    chatHook,
    onUploadAttachments,
    enableVoice = false,
    enableMentions = scope === "group",
    enableAttachments = true,
    enableScheduledMessages = false,
    onSchedulePress,
    mentionableMembers = [],
    maxMentionSuggestions = 5,
    maxAttachments = 10,
    maxVoiceDuration = 60,
    replyTo: configReplyTo = null,
    debug = false,
  } = config;

  // -------------------------------------------------------------------------
  // Text State
  // -------------------------------------------------------------------------
  const [text, setTextState] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [sending, setSending] = useState(false);
  const [mentionUidsState, setMentionUids] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const isEmpty = text.trim().length === 0;

  // Sync replyTo from chatHook if integrated, otherwise use config
  const replyTo = chatHook?.replyTo ?? configReplyTo;
  const isIntegrated = !!chatHook;

  // -------------------------------------------------------------------------
  // Optional Hooks
  // -------------------------------------------------------------------------

  // Mentions
  const mentionsHook = useMentionAutocomplete({
    members: enableMentions ? mentionableMembers : [],
    excludeUids: currentUid ? [currentUid] : [],
    maxSuggestions: maxMentionSuggestions,
    onMentionSelected: (member) => {
      if (debug) {
        log.debug("Mention selected", {
          operation: "mentionSelected",
          data: { uid: member.uid, displayName: member.displayName },
        });
      }
    },
  });

  // Attachments
  const attachmentsHook = useAttachmentPicker({
    maxAttachments: enableAttachments ? maxAttachments : 0,
    onAttachmentsChange: (attachments) => {
      if (debug) {
        log.debug("Attachments changed", {
          operation: "attachmentsChange",
          data: { count: attachments.length },
        });
      }
    },
  });

  // Voice Recording
  const voiceHook = useVoiceRecorder({
    maxDuration: enableVoice ? maxVoiceDuration : 0,
    onRecordingComplete: async (recording) => {
      if (onSendVoice) {
        await onSendVoice(recording);
      }
    },
  });

  // -------------------------------------------------------------------------
  // Computed State
  // -------------------------------------------------------------------------

  const hasAttachments =
    enableAttachments && attachmentsHook.attachments.length > 0;
  const isRecordingVoice = enableVoice && voiceHook.isRecording;

  // Can send if: has text or attachments, and not already sending or recording
  const canSend = (!isEmpty || hasAttachments) && !sending && !isRecordingVoice;

  // -------------------------------------------------------------------------
  // Text Handlers
  // -------------------------------------------------------------------------

  const setText = useCallback(
    (newText: string) => {
      setTextState(newText);

      // Update mention autocomplete
      if (enableMentions) {
        mentionsHook.onTextChange(newText, cursorPosition);
        // Re-extract mention UIDs to keep state in sync when text is edited
        const { mentionUids: freshUids } = extractMentionsExact(
          newText,
          mentionableMembers,
        );
        setMentionUids(freshUids);
      }
    },
    [enableMentions, mentionsHook, cursorPosition, mentionableMembers],
  );

  const onTextChange = useCallback(
    (newText: string, newCursorPosition?: number) => {
      setTextState(newText);
      if (newCursorPosition !== undefined) {
        setCursorPosition(newCursorPosition);
      }

      // Update mention autocomplete
      if (enableMentions) {
        mentionsHook.onTextChange(newText, newCursorPosition ?? cursorPosition);
        // Re-extract mention UIDs to keep state in sync when text is edited
        const { mentionUids: freshUids } = extractMentionsExact(
          newText,
          mentionableMembers,
        );
        setMentionUids(freshUids);
      }
    },
    [enableMentions, mentionsHook, cursorPosition, mentionableMembers],
  );

  const clearText = useCallback(() => {
    setTextState("");
    setCursorPosition(0);
    setMentionUids([]);
    if (enableMentions) {
      mentionsHook.reset();
    }
  }, [enableMentions, mentionsHook]);

  // -------------------------------------------------------------------------
  // Mention Handlers
  // -------------------------------------------------------------------------

  const insertMention = useCallback(
    (member: MentionableMember) => {
      if (!enableMentions) return;

      const result: InsertMentionResult = mentionsHook.onSelectMember(
        member,
        text,
        cursorPosition,
      );

      setTextState(result.newText);
      setCursorPosition(result.newCursorPosition);

      // Track mention UID
      setMentionUids((prev) =>
        prev.includes(member.uid) ? prev : [...prev, member.uid],
      );

      if (debug) {
        log.debug("Mention inserted", {
          operation: "insertMention",
          data: {
            uid: member.uid,
            newCursorPosition: result.newCursorPosition,
          },
        });
      }
    },
    [enableMentions, mentionsHook, text, cursorPosition, debug],
  );

  // -------------------------------------------------------------------------
  // Send Handler
  // -------------------------------------------------------------------------

  const send = useCallback(async () => {
    if (!canSend) return;

    setSending(true);

    try {
      // Upload attachments if we have them and an upload handler
      let uploadedAttachments: AttachmentV2[] | undefined;
      if (hasAttachments && onUploadAttachments) {
        const localAttachments = attachmentsHook.attachments;
        setUploadProgress({ current: 0, total: localAttachments.length });

        if (debug) {
          log.debug("Uploading attachments", {
            operation: "uploadAttachments",
            data: { count: localAttachments.length },
          });
        }

        uploadedAttachments = await onUploadAttachments(localAttachments);
        setUploadProgress(null);
      }

      const sendOptions: ComposerSendOptions = {
        replyTo: replyTo ?? undefined,
        mentionUids: mentionUidsState.length > 0 ? mentionUidsState : undefined,
        attachments: hasAttachments ? attachmentsHook.attachments : undefined,
      };

      if (debug) {
        log.debug("Sending message", {
          operation: "send",
          data: {
            textLength: text.length,
            hasReply: !!replyTo,
            mentionCount: mentionUidsState.length,
            attachmentCount: attachmentsHook.attachments.length,
            isIntegrated,
          },
        });
      }

      // Use chatHook.sendMessage if integrated, otherwise use onSend callback
      if (chatHook) {
        await chatHook.sendMessage(text, {
          replyTo: replyTo ?? undefined,
          mentionUids:
            mentionUidsState.length > 0 ? mentionUidsState : undefined,
          attachments: uploadedAttachments
            ? attachmentsHook.attachments
            : undefined,
        });
        // chatHook.sendMessage auto-clears replyTo when clearReplyOnSend is true (default)
      } else {
        await onSend(text, sendOptions);
      }

      // Clear state after successful send
      clearText();
      if (enableAttachments) {
        attachmentsHook.clearAttachments();
      }
    } catch (err) {
      log.error("Send failed", err);
      setUploadProgress(null);
      // Don't clear on error so user can retry
    } finally {
      setSending(false);
    }
  }, [
    canSend,
    text,
    replyTo,
    mentionUidsState,
    hasAttachments,
    attachmentsHook,
    enableAttachments,
    onSend,
    chatHook,
    onUploadAttachments,
    isIntegrated,
    clearText,
    debug,
  ]);

  // -------------------------------------------------------------------------
  // Scheduled Messages
  // -------------------------------------------------------------------------

  const canSchedule = enableScheduledMessages && !isEmpty && !sending;

  const openScheduleModal = useCallback(() => {
    if (!canSchedule || !onSchedulePress) return;

    if (debug) {
      log.debug("Opening schedule modal", {
        operation: "openScheduleModal",
        data: {
          textLength: text.length,
          attachmentCount: attachmentsHook.attachments.length,
        },
      });
    }

    onSchedulePress(
      text,
      hasAttachments ? attachmentsHook.attachments : undefined,
    );
  }, [
    canSchedule,
    onSchedulePress,
    text,
    hasAttachments,
    attachmentsHook.attachments,
    debug,
  ]);

  // -------------------------------------------------------------------------
  // Clear Reply Handler (delegates to chatHook if integrated)
  // -------------------------------------------------------------------------

  const clearReplyTo = useCallback(() => {
    if (chatHook) {
      chatHook.clearReplyTo();
    }
    // If not integrated, replyTo is controlled externally via config
  }, [chatHook]);

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  const reset = useCallback(() => {
    clearText();
    setUploadProgress(null);
    if (enableAttachments) {
      attachmentsHook.clearAttachments();
    }
    if (enableMentions) {
      mentionsHook.reset();
    }
    if (enableVoice && voiceHook.isRecording) {
      voiceHook.cancelRecording();
    }
  }, [
    clearText,
    enableAttachments,
    attachmentsHook,
    enableMentions,
    mentionsHook,
    enableVoice,
    voiceHook,
  ]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return useMemo<UseChatComposerReturn>(
    () => ({
      // Text State
      text,
      setText,
      cursorPosition,
      setCursorPosition,
      onTextChange,
      isEmpty,
      clearText,

      // Send State
      canSend,
      sending,
      send,

      // Mentions
      mentions: enableMentions ? mentionsHook : null,
      insertMention,
      mentionUids: mentionUidsState,

      // Attachments
      attachments: enableAttachments ? attachmentsHook : null,
      hasAttachments,

      // Voice
      voice: enableVoice ? voiceHook : null,
      isRecordingVoice,

      // Scheduled Messages
      canSchedule,
      scheduledMessagesEnabled: enableScheduledMessages,
      openScheduleModal,

      // Upload Progress
      uploadProgress,
      isUploading: uploadProgress !== null,

      // Utility
      replyTo,
      clearReplyTo,
      reset,
      scope,
      isIntegrated,
    }),
    [
      text,
      setText,
      cursorPosition,
      setCursorPosition,
      onTextChange,
      isEmpty,
      clearText,
      canSend,
      sending,
      send,
      enableMentions,
      mentionsHook,
      insertMention,
      mentionUidsState,
      enableAttachments,
      attachmentsHook,
      hasAttachments,
      enableVoice,
      voiceHook,
      isRecordingVoice,
      canSchedule,
      enableScheduledMessages,
      openScheduleModal,
      uploadProgress,
      replyTo,
      clearReplyTo,
      reset,
      scope,
      isIntegrated,
    ],
  );
}

export default useChatComposer;
