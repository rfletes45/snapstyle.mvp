/**
 * useUnifiedChatScreen Hook (UNI-04)
 *
 * Composes useChat and useChatComposer into a single screen-ready hook.
 * This dramatically reduces screen complexity by handling all the integration
 * between messages and composer in one place.
 *
 * ## Usage
 *
 * ```typescript
 * const screen = useUnifiedChatScreen({
 *   scope: "dm",
 *   conversationId: chatId,
 *   currentUid: user.uid,
 *   currentUserName: user.displayName,
 *   enableVoice: true,
 *   enableAttachments: true,
 *   onUploadAttachments: async (attachments) => {
 *     return Promise.all(attachments.map(uploadAttachment));
 *   },
 *   onSendVoice: async (recording) => {
 *     // Handle voice message upload
 *   },
 * });
 *
 * // Access everything via screen object
 * screen.messages           // Combined server + optimistic messages
 * screen.loading            // Loading state
 * screen.keyboard           // Keyboard animation values
 * screen.composer.text      // Composer text
 * screen.composer.send()    // Send message
 * screen.chat.replyTo       // Reply state
 * screen.chat.setReplyTo()  // Set reply
 * ```
 *
 * ## Features
 *
 * - **Integrated send**: Composer automatically uses chat hook's sendMessage
 * - **Synced reply state**: Composer replyTo syncs with chat hook
 * - **Attachment uploads**: Uploads handled before sending
 * - **Voice recording**: Integrated voice message support
 * - **Mentions**: Group mention support with autocomplete
 * - **Scheduled messages**: Support for scheduling messages
 *
 * @module hooks/useUnifiedChatScreen
 */

import { MentionableMember } from "@/services/mentionParser";
import { LocalAttachment } from "@/services/storage";
import { AttachmentV2 } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useEffect, useMemo, useRef } from "react";
import { useChat, UseChatConfig, UseChatReturn } from "./useChat";
import {
  useChatComposer,
  UseChatComposerConfig,
  UseChatComposerReturn,
} from "./useChatComposer";
import type { VoiceRecording } from "./useVoiceRecorder";

const log = createLogger("useUnifiedChatScreen");

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for useUnifiedChatScreen hook
 */
export interface UseUnifiedChatScreenConfig {
  // -------------------------------------------------------------------------
  // Required
  // -------------------------------------------------------------------------

  /** Conversation scope ("dm" or "group") */
  scope: "dm" | "group";

  /** Chat ID (for DM) or Group ID (for group) */
  conversationId: string;

  /** Current user ID */
  currentUid: string;

  // -------------------------------------------------------------------------
  // Optional - User Info
  // -------------------------------------------------------------------------

  /** Current user display name (for optimistic messages) */
  currentUserName?: string;

  // -------------------------------------------------------------------------
  // Feature Toggles
  // -------------------------------------------------------------------------

  /** Enable voice recording (default: true) */
  enableVoice?: boolean;

  /** Enable attachment picker (default: true) */
  enableAttachments?: boolean;

  /** Enable @mention autocomplete (default: true for groups) */
  enableMentions?: boolean;

  /** Enable scheduled messages (default: false) */
  enableScheduledMessages?: boolean;

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
  // Voice Config
  // -------------------------------------------------------------------------

  /** Max voice recording duration in seconds (default: 60) */
  maxVoiceDuration?: number;

  /**
   * Voice message send handler.
   * Called when a voice recording is completed.
   * @param recording - Voice recording result with URI and duration
   */
  onSendVoice?: (recording: VoiceRecording) => Promise<void>;

  // -------------------------------------------------------------------------
  // Scheduled Messages Config
  // -------------------------------------------------------------------------

  /**
   * Scheduled message handler.
   * Called when user wants to schedule a message.
   * @param text - Message text
   * @param attachments - Optional attachments
   */
  onSchedulePress?: (text: string, attachments?: LocalAttachment[]) => void;

  // -------------------------------------------------------------------------
  // Chat Hook Config (Pass-through)
  // -------------------------------------------------------------------------

  /** Initial message limit (default: 50) */
  initialLimit?: number;

  /** Auto-mark messages as read (default: true) */
  autoMarkRead?: boolean;

  /** Send read receipts (default: true for DM, false for group) */
  sendReadReceipts?: boolean;

  /** Pixel threshold for "at bottom" detection (default: 200) */
  atBottomThreshold?: number;

  /** Message threshold for auto-scroll (default: 30) */
  autoscrollMessageThreshold?: number;

  // -------------------------------------------------------------------------
  // Debug
  // -------------------------------------------------------------------------

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Return type for useUnifiedChatScreen hook
 */
export interface UseUnifiedChatScreenReturn {
  // -------------------------------------------------------------------------
  // Core Hooks
  // -------------------------------------------------------------------------

  /** useChat hook instance - full access to messages, keyboard, scroll, etc. */
  chat: UseChatReturn;

  /** useChatComposer hook instance - full access to composer state */
  composer: UseChatComposerReturn;

  // -------------------------------------------------------------------------
  // Convenience Accessors (from chat)
  // -------------------------------------------------------------------------

  /** Combined server + optimistic messages (sorted newest first) */
  messages: UseChatReturn["messages"];

  /** Loading initial messages */
  loading: UseChatReturn["loading"];

  /** Error if subscription failed */
  error: UseChatReturn["error"];

  /** Keyboard animation state and values */
  keyboard: UseChatReturn["keyboard"];

  /** Scroll position state and handlers */
  scroll: UseChatReturn["scroll"];

  /** Auto-scroll state and handlers */
  autoscroll: UseChatReturn["autoscroll"];

  /** Ref to attach to FlatList */
  flatListRef: UseChatReturn["flatListRef"];

  /** Load older messages */
  loadOlder: UseChatReturn["loadOlder"];

  // -------------------------------------------------------------------------
  // Convenience Accessors (from composer)
  // -------------------------------------------------------------------------

  /** Whether send button should be enabled */
  canSend: UseChatComposerReturn["canSend"];

  /** Whether currently sending */
  sending: UseChatComposerReturn["sending"];

  /** Current input text */
  text: UseChatComposerReturn["text"];

  /** Current upload progress */
  uploadProgress: UseChatComposerReturn["uploadProgress"];

  /** Whether currently uploading */
  isUploading: UseChatComposerReturn["isUploading"];

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  /** Scope of this chat */
  scope: "dm" | "group";

  /** Conversation ID */
  conversationId: string;

  /** Whether hooks are integrated (always true for this hook) */
  isIntegrated: true;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useUnifiedChatScreen(
  config: UseUnifiedChatScreenConfig,
): UseUnifiedChatScreenReturn {
  const {
    scope,
    conversationId,
    currentUid,
    currentUserName,
    enableVoice = true,
    enableAttachments = true,
    enableMentions = scope === "group",
    enableScheduledMessages = false,
    mentionableMembers = [],
    maxMentionSuggestions = 5,
    maxAttachments = 10,
    onUploadAttachments,
    maxVoiceDuration = 60,
    onSendVoice,
    onSchedulePress,
    initialLimit = 50,
    autoMarkRead = true,
    sendReadReceipts,
    atBottomThreshold = 200,
    autoscrollMessageThreshold = 30,
    debug = false,
  } = config;

  // -------------------------------------------------------------------------
  // useChat Hook - Messages, Keyboard, Scroll, Reply State
  // -------------------------------------------------------------------------

  const chatConfig: UseChatConfig = useMemo(
    () => ({
      scope,
      conversationId,
      currentUid,
      currentUserName,
      initialLimit,
      autoMarkRead,
      sendReadReceipts,
      atBottomThreshold,
      autoscrollMessageThreshold,
      debug,
    }),
    [
      scope,
      conversationId,
      currentUid,
      currentUserName,
      initialLimit,
      autoMarkRead,
      sendReadReceipts,
      atBottomThreshold,
      autoscrollMessageThreshold,
      debug,
    ],
  );

  const chat = useChat(chatConfig);

  // -------------------------------------------------------------------------
  // useChatComposer Hook - Text, Attachments, Voice, Mentions, Send
  // -------------------------------------------------------------------------

  const composerConfig: UseChatComposerConfig = useMemo(
    () => ({
      scope,
      conversationId,
      currentUid,
      // Integration with useChat
      chatHook: chat,
      onUploadAttachments,
      // Features
      enableVoice,
      enableAttachments,
      enableMentions,
      enableScheduledMessages,
      // Mentions
      mentionableMembers,
      maxMentionSuggestions,
      // Attachments
      maxAttachments,
      // Voice
      maxVoiceDuration,
      onSendVoice,
      // Scheduled messages
      onSchedulePress,
      // Send is integrated via chatHook, but we still need a fallback
      onSend: async (text, options) => {
        // This should rarely be called since chatHook is provided
        // But we need it for the hook to work
        if (debug) {
          log.debug("Fallback onSend called (should use chatHook)", {
            operation: "fallbackSend",
            data: { textLength: text.length },
          });
        }
        await chat.sendMessage(text, {
          replyTo: options.replyTo,
          mentionUids: options.mentionUids,
          attachments: options.attachments,
        });
      },
      debug,
    }),
    [
      scope,
      conversationId,
      currentUid,
      chat,
      onUploadAttachments,
      enableVoice,
      enableAttachments,
      enableMentions,
      enableScheduledMessages,
      mentionableMembers,
      maxMentionSuggestions,
      maxAttachments,
      maxVoiceDuration,
      onSendVoice,
      onSchedulePress,
      debug,
    ],
  );

  const composer = useChatComposer(composerConfig);

  // -------------------------------------------------------------------------
  // Debug Logging (throttled to only log on actual state changes)
  // -------------------------------------------------------------------------

  const lastDebugRef = useRef("");
  useEffect(() => {
    if (!debug) return;
    const snapshot = JSON.stringify({
      messageCount: chat.messages.length,
      loading: chat.loading,
      composerText: composer.text.length,
      canSend: composer.canSend,
      sending: composer.sending,
      hasReply: !!chat.replyTo,
      isUploading: composer.isUploading,
    });
    if (snapshot !== lastDebugRef.current) {
      lastDebugRef.current = snapshot;
      log.debug("Unified screen state", {
        operation: "state",
        data: JSON.parse(snapshot),
      });
    }
  }, [
    debug,
    chat.messages.length,
    chat.loading,
    composer.text.length,
    composer.canSend,
    composer.sending,
    chat.replyTo,
    composer.isUploading,
  ]);

  // -------------------------------------------------------------------------
  // Return Memoized Result
  // -------------------------------------------------------------------------

  return useMemo<UseUnifiedChatScreenReturn>(
    () => ({
      // Core hooks
      chat,
      composer,

      // Convenience from chat
      messages: chat.messages,
      loading: chat.loading,
      error: chat.error,
      keyboard: chat.keyboard,
      scroll: chat.scroll,
      autoscroll: chat.autoscroll,
      flatListRef: chat.flatListRef,
      loadOlder: chat.loadOlder,

      // Convenience from composer
      canSend: composer.canSend,
      sending: composer.sending,
      text: composer.text,
      uploadProgress: composer.uploadProgress,
      isUploading: composer.isUploading,

      // Utility
      scope,
      conversationId,
      isIntegrated: true,
    }),
    [chat, composer, scope, conversationId],
  );
}

export default useUnifiedChatScreen;
