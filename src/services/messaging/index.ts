/**
 * Unified Messaging Service
 *
 * Single entry point for all messaging operations across DM and Group
 * conversations. This module provides:
 *
 * **Phase A (Type Adapters):**
 * - Message type adapters (GroupMessage ↔ MessageV2)
 *
 * **Phase B (Service Layer):**
 * - Sending messages (with outbox support)
 * - Subscribing to messages (real-time)
 * - Member state management (read receipts, typing, mute, archive)
 *
 * Works for both DM and Group conversations via `scope` parameter.
 *
 * @module services/messaging
 *
 * @example
 * ```typescript
 * import {
 *   // Adapters
 *   fromGroupMessage,
 *   isLegacyGroupMessage,
 *   // Subscriptions
 *   subscribeToMessages,
 *   loadOlderMessages,
 *   // Sending
 *   sendMessage,
 *   retryMessage,
 *   // Member state
 *   updateReadWatermark,
 *   setTypingIndicator,
 * } from "@/services/messaging";
 *
 * // Subscribe to group messages
 * const unsubscribe = subscribeToMessages("group", groupId, {
 *   onMessages: (messages) => setMessages(messages),
 *   currentUid: user.uid,
 * });
 *
 * // Send a message
 * const { outboxItem, sendPromise } = await sendMessage({
 *   scope: "group",
 *   conversationId: groupId,
 *   kind: "text",
 *   text: "Hello!",
 * });
 *
 * // Update read watermark
 * await updateReadWatermark("group", groupId, user.uid, latestTimestamp);
 * ```
 */

// =============================================================================
// Adapters - Convert between message formats
// =============================================================================

export {
  fromGroupMessage,
  fromGroupMessages,
  isLegacyGroupMessage,
  isMessageV2,
  toGroupMessage,
} from "./adapters";

// =============================================================================
// Subscriptions - Real-time message updates
// =============================================================================

export {
  clearAllPaginationCursors,
  countUnreadMentions,
  // Unread counting
  countUnreadSince,
  // Single message retrieval
  getMessage,
  getUnreadMentions,
  hasUnreadMessages,
  loadNewerMessages,
  // Pagination
  loadOlderMessages,
  resetPaginationCursor,
  subscribeToDMMessages,
  subscribeToGroupMessagesUnified,
  // Main subscription functions
  subscribeToMessages,
} from "./subscribe";

// =============================================================================
// Sending - Send messages with outbox support
// =============================================================================

export {
  // Utilities
  generateMessageId,
  getClientId,
  getFailedMessages,
  // Outbox queries
  getPendingForConversation,
  getPendingMessages,
  processPendingMessages,
  retryMessage,
  // Main send function
  sendMessage,
} from "./send";

// =============================================================================
// Member State - Read receipts, typing, mute, archive
// =============================================================================

export {
  clearTypingIndicator,
  setArchived,
  // Mute & Archive
  setMuted,
  // Notification preferences
  setNotifyLevel,
  setReadReceipts,
  // Typing indicators
  setTypingIndicator,
  updateLastSeenPrivate,
  // Read watermarks
  updateReadWatermark,
} from "./memberState";

// =============================================================================
// Re-export types for convenience
// =============================================================================

export type {
  AttachmentKind,
  AttachmentV2,
  LocalAttachment,
  MessageKind,
  MessageStatusV2,
  MessageV2,
  OutboxItem,
  ReplyToMetadata,
} from "@/types/messaging";

export type { GroupMessage } from "@/types/models";

// Re-export types from subscribe module
export type {
  ConversationScope,
  MessagePaginationState,
  PaginationLoadResult,
  UnifiedSubscriptionOptions,
} from "./subscribe";

// Re-export types from member state module
export type { MemberStateScope, NotifyLevel } from "./memberState";
