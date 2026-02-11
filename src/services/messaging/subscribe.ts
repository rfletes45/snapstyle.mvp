/**
 * Unified Message Subscription Service
 *
 * @deprecated This module is being replaced by SQLite-first local storage.
 * For new code, use:
 * - `@/hooks/useLocalMessages` for React components
 * - `@/services/sync/syncEngine` for real-time Firestore sync
 *
 * Provides a unified API for subscribing to messages across both
 * DM and Group conversations. This service wraps the existing
 * messageList.ts functionality and adds legacy GroupMessage conversion.
 *
 * Features:
 * - Real-time message subscriptions
 * - Pagination (load older/newer messages)
 * - Unread counting
 * - Legacy GroupMessage conversion (via adapters)
 *
 * @module services/messaging/subscribe
 *
 * @example
 * ```typescript
 * import { subscribeToMessages, loadOlderMessages } from "@/services/messaging";
 *
 * // Subscribe to group messages
 * const unsubscribe = subscribeToMessages("group", groupId, {
 *   onMessages: (messages) => setMessages(messages),
 *   onError: (error) => console.error(error),
 *   currentUid: user.uid,
 * });
 *
 * // Load older messages for pagination
 * const { messages, hasMore } = await loadOlderMessages(
 *   "group",
 *   groupId,
 *   oldestTimestamp,
 * );
 * ```
 */

import { MessageV2 } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { DEBUG_UNIFIED_MESSAGING } from "@/constants/featureFlags";

// Import existing messageList functions and types
import {
  clearAllPaginationCursors as clearAllPaginationCursorsV2,
  countUnreadMentions as countUnreadMentionsV2,
  countUnreadSince as countUnreadSinceV2,
  getMessage as getMessageV2,
  getUnreadMentions,
  hasUnreadMessages,
  loadNewerMessages as loadNewerMessagesV2,
  loadOlderMessages as loadOlderMessagesV2,
  MessagePaginationState,
  PaginationLoadResult,
  resetPaginationCursor as resetPaginationCursorV2,
  subscribeToDMMessages as subscribeToDMMessagesV2,
  subscribeToGroupMessages as subscribeToGroupMessagesV2,
} from "@/services/messageList";

const log = createLogger("messaging:subscribe");

// =============================================================================
// Types
// =============================================================================

/**
 * Scope determines the conversation type
 */
export type ConversationScope = "dm" | "group";

/**
 * Options for message subscription
 */
export interface UnifiedSubscriptionOptions {
  /** Maximum messages to fetch initially */
  initialLimit?: number;
  /** Callback for messages update */
  onMessages: (messages: MessageV2[]) => void;
  /** Callback for pagination state changes */
  onPaginationState?: (state: MessagePaginationState) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Current user ID for filtering hiddenFor */
  currentUid?: string;
  /**
   * If true, enables debug logging for this subscription
   */
  debug?: boolean;
}

// =============================================================================
// Subscription Functions
// =============================================================================

/**
 * Subscribe to messages in a conversation
 *
 * Unified entry point that works for both DM and Group conversations.
 * Uses the V2 subscription system with real-time updates and pagination.
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat ID or Group ID
 * @param options - Subscription options
 * @returns Unsubscribe function
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToMessages("group", groupId, {
 *   initialLimit: 50,
 *   onMessages: (messages) => setMessages(messages),
 *   onPaginationState: (state) => setPaginationState(state),
 *   onError: (error) => handleError(error),
 *   currentUid: user.uid,
 * });
 *
 * // Later: cleanup
 * unsubscribe();
 * ```
 */
export function subscribeToMessages(
  scope: ConversationScope,
  conversationId: string,
  options: UnifiedSubscriptionOptions,
): () => void {
  const shouldDebug = options.debug || DEBUG_UNIFIED_MESSAGING;

  if (shouldDebug) {
    log.debug("subscribeToMessages called", {
      operation: "subscribe",
      data: { scope, conversationId },
    });
  }

  // Delegate to appropriate subscription function
  if (scope === "dm") {
    return subscribeToDMMessagesV2(conversationId, options);
  } else {
    return subscribeToGroupMessagesV2(conversationId, options);
  }
}

/**
 * Subscribe to DM messages
 *
 * Convenience wrapper for subscribeToMessages with scope="dm"
 *
 * @param chatId - DM Chat ID
 * @param options - Subscription options
 * @returns Unsubscribe function
 */
export function subscribeToDMMessages(
  chatId: string,
  options: UnifiedSubscriptionOptions,
): () => void {
  return subscribeToMessages("dm", chatId, options);
}

/**
 * Subscribe to group messages
 *
 * Convenience wrapper for subscribeToMessages with scope="group"
 *
 * @param groupId - Group ID
 * @param options - Subscription options
 * @returns Unsubscribe function
 */
export function subscribeToGroupMessagesUnified(
  groupId: string,
  options: UnifiedSubscriptionOptions,
): () => void {
  return subscribeToMessages("group", groupId, options);
}

// =============================================================================
// Pagination Functions
// =============================================================================

/**
 * Load older messages (pagination - scroll up)
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param beforeServerReceivedAt - Load messages before this timestamp
 * @param messageLimit - Number of messages to load (default: 25)
 * @returns Messages and hasMore flag
 */
export async function loadOlderMessages(
  scope: ConversationScope,
  conversationId: string,
  beforeServerReceivedAt: number,
  messageLimit: number = 25,
): Promise<PaginationLoadResult> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("loadOlderMessages called", {
      operation: "loadOlder",
      data: { scope, conversationId, beforeServerReceivedAt, messageLimit },
    });
  }

  return loadOlderMessagesV2(
    scope,
    conversationId,
    beforeServerReceivedAt,
    messageLimit,
  );
}

/**
 * Load newer messages (for catching up after reconnect)
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param afterServerReceivedAt - Load messages after this timestamp
 * @param messageLimit - Number of messages to load (default: 25)
 * @returns Messages and hasMore flag
 */
export async function loadNewerMessages(
  scope: ConversationScope,
  conversationId: string,
  afterServerReceivedAt: number,
  messageLimit: number = 25,
): Promise<PaginationLoadResult> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("loadNewerMessages called", {
      operation: "loadNewer",
      data: { scope, conversationId, afterServerReceivedAt, messageLimit },
    });
  }

  return loadNewerMessagesV2(
    scope,
    conversationId,
    afterServerReceivedAt,
    messageLimit,
  );
}

// =============================================================================
// Pagination Cursor Management
// =============================================================================

/**
 * Reset pagination cursor for a conversation
 *
 * Call this when leaving a chat screen or re-initializing.
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 */
export function resetPaginationCursor(
  scope: ConversationScope,
  conversationId: string,
): void {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("resetPaginationCursor called", {
      operation: "resetCursor",
      data: { scope, conversationId },
    });
  }

  resetPaginationCursorV2(scope, conversationId);
}

/**
 * Clear all pagination cursors
 *
 * Call this on user logout or app reset.
 */
export function clearAllPaginationCursors(): void {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("clearAllPaginationCursors called", {
      operation: "clearCursors",
    });
  }

  clearAllPaginationCursorsV2();
}

// =============================================================================
// Unread Counting
// =============================================================================

/**
 * Count unread messages since watermark
 *
 * Uses Firestore's count aggregation for efficiency.
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param watermark - Last seen timestamp (serverReceivedAt)
 * @param currentUid - Current user ID (to exclude own messages)
 * @returns Unread count
 */
export async function countUnreadSince(
  scope: ConversationScope,
  conversationId: string,
  watermark: number,
  currentUid?: string,
): Promise<number> {
  return countUnreadSinceV2(scope, conversationId, watermark, currentUid);
}

/**
 * Count unread mentions for badge display
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param uid - Current user ID
 * @param watermark - Last seen timestamp
 * @returns Count of unread mentions
 */
export async function countUnreadMentions(
  scope: ConversationScope,
  conversationId: string,
  uid: string,
  watermark: number,
): Promise<number> {
  return countUnreadMentionsV2(scope, conversationId, uid, watermark);
}

/**
 * Check if there are unread messages (fast check without query)
 *
 * Compares conversation's lastMessageAt with user's watermark.
 *
 * @param lastMessageAt - Conversation's last message timestamp
 * @param watermark - User's last seen timestamp
 * @returns true if there are unreads, false otherwise
 */
export { hasUnreadMessages };

/**
 * Get unread message IDs for mention highlighting
 */
export { getUnreadMentions };

// =============================================================================
// Single Message Operations
// =============================================================================

/**
 * Get a single message by ID
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param messageId - Message ID
 * @returns Message or null if not found
 */
export async function getMessage(
  scope: ConversationScope,
  conversationId: string,
  messageId: string,
): Promise<MessageV2 | null> {
  return getMessageV2(scope, conversationId, messageId);
}

// =============================================================================
// Re-export types
// =============================================================================

export type { MessagePaginationState, MessageV2, PaginationLoadResult };
