/**
 * Unified Member State Service
 *
 * Provides a unified API for managing member state across both
 * DM and Group conversations. This includes:
 * - Read receipts / watermarks
 * - Typing indicators
 * - Mute settings
 * - Archive settings
 * - Notification preferences
 *
 * @module services/messaging/memberState
 *
 * @example
 * ```typescript
 * import { updateReadWatermark, setTypingIndicator, setMuted } from "@/services/messaging";
 *
 * // Update read watermark
 * await updateReadWatermark("group", groupId, currentUser.uid, latestTimestamp);
 *
 * // Set typing indicator
 * await setTypingIndicator("dm", chatId, currentUser.uid, true);
 *
 * // Mute conversation
 * await setMuted("group", groupId, currentUser.uid, -1); // -1 = forever
 * ```
 */

import { createLogger } from "@/utils/log";
import { DEBUG_UNIFIED_MESSAGING } from "@/constants/featureFlags";

// Import DM member functions
import {
  clearTypingIndicator as clearDMTypingIndicator,
  setArchived as setDMArchived,
  setMuted as setDMMuted,
  setNotifyLevel as setDMNotifyLevel,
  setReadReceipts as setDMReadReceipts,
  updateReadWatermark as updateDMReadWatermark,
  updateTypingIndicator as updateDMTypingIndicator,
} from "@/services/chatMembers";

// Import Group member functions
import {
  setGroupArchived,
  setGroupMuted,
  setGroupNotifyLevel,
  setGroupReadReceipts,
  updateGroupReadWatermark,
  updateGroupTypingIndicator,
} from "@/services/groupMembers";

const log = createLogger("messaging:memberState");

// =============================================================================
// Types
// =============================================================================

/**
 * Scope determines the conversation type
 */
export type ConversationScope = "dm" | "group";

/**
 * Notification level options
 */
export type NotifyLevel = "all" | "mentions" | "none";

// =============================================================================
// Read Watermark Functions
// =============================================================================

/**
 * Update read receipt watermark
 *
 * This marks messages as "read" up to the given timestamp.
 * For DMs, this also updates the private lastSeenAtPrivate.
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param uid - Current user ID
 * @param serverReceivedAt - Timestamp of the latest read message
 *
 * @example
 * ```typescript
 * // Mark messages as read up to this point
 * await updateReadWatermark("group", groupId, user.uid, latestMessage.serverReceivedAt);
 * ```
 */
export async function updateReadWatermark(
  scope: ConversationScope,
  conversationId: string,
  uid: string,
  serverReceivedAt: number,
): Promise<void> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("updateReadWatermark called", {
      operation: "updateWatermark",
      data: {
        scope,
        conversationId,
        uid: uid.substring(0, 8) + "...",
        serverReceivedAt,
      },
    });
  }

  if (scope === "dm") {
    await updateDMReadWatermark(conversationId, uid, serverReceivedAt);
  } else {
    await updateGroupReadWatermark(conversationId, uid, serverReceivedAt);
  }
}

/**
 * Update private last seen timestamp (for unread badge computation)
 *
 * This is a "soft" read that doesn't send read receipts to others,
 * but does affect your own unread badge.
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param uid - Current user ID
 * @param timestamp - Timestamp
 */
export async function updateLastSeenPrivate(
  scope: ConversationScope,
  conversationId: string,
  uid: string,
  timestamp: number,
): Promise<void> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("updateLastSeenPrivate called", {
      operation: "updateLastSeen",
      data: { scope, conversationId, timestamp },
    });
  }

  if (scope === "dm") {
    // For DMs, updateLastSeen uses Date.now() internally
    // Use updateReadWatermark which accepts a timestamp
    await updateDMReadWatermark(conversationId, uid, timestamp);
  } else {
    // For groups, use the regular watermark update
    await updateGroupReadWatermark(conversationId, uid, timestamp);
  }
}

// =============================================================================
// Typing Indicator Functions
// =============================================================================

/**
 * Update typing indicator
 *
 * Shows or hides the typing indicator for the current user.
 * Automatically throttled to prevent excessive writes.
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param uid - Current user ID
 * @param isTyping - Whether user is typing
 *
 * @example
 * ```typescript
 * // Show typing indicator
 * await setTypingIndicator("dm", chatId, user.uid, true);
 *
 * // Hide typing indicator (on send or blur)
 * await setTypingIndicator("dm", chatId, user.uid, false);
 * ```
 */
export async function setTypingIndicator(
  scope: ConversationScope,
  conversationId: string,
  uid: string,
  isTyping: boolean,
): Promise<void> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("setTypingIndicator called", {
      operation: "typing",
      data: { scope, conversationId, isTyping },
    });
  }

  if (scope === "dm") {
    if (isTyping) {
      await updateDMTypingIndicator(conversationId, uid);
    } else {
      await clearDMTypingIndicator(conversationId, uid);
    }
  } else {
    await updateGroupTypingIndicator(conversationId, uid, isTyping);
  }
}

/**
 * Clear typing indicator
 *
 * Convenience function to explicitly clear the typing indicator.
 * Call this when:
 * - User sends a message
 * - User clears input
 * - User leaves chat screen
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param uid - Current user ID
 */
export async function clearTypingIndicator(
  scope: ConversationScope,
  conversationId: string,
  uid: string,
): Promise<void> {
  await setTypingIndicator(scope, conversationId, uid, false);
}

// =============================================================================
// Mute Functions
// =============================================================================

/**
 * Set mute status for a conversation
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param uid - Current user ID
 * @param mutedUntil - null (unmute), -1 (forever), or timestamp when mute expires
 *
 * @example
 * ```typescript
 * // Mute forever
 * await setMuted("group", groupId, user.uid, -1);
 *
 * // Mute for 8 hours
 * await setMuted("dm", chatId, user.uid, Date.now() + 8 * 60 * 60 * 1000);
 *
 * // Unmute
 * await setMuted("dm", chatId, user.uid, null);
 * ```
 */
export async function setMuted(
  scope: ConversationScope,
  conversationId: string,
  uid: string,
  mutedUntil: number | null,
): Promise<void> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("setMuted called", {
      operation: "setMuted",
      data: { scope, conversationId, mutedUntil },
    });
  }

  if (scope === "dm") {
    await setDMMuted(conversationId, uid, mutedUntil);
  } else {
    // Group mute uses boolean + separate mutedUntil field
    const muted = mutedUntil !== null;
    const until = muted
      ? mutedUntil === -1
        ? undefined
        : mutedUntil
      : undefined;
    await setGroupMuted(conversationId, uid, muted, until);
  }
}

// =============================================================================
// Archive Functions
// =============================================================================

/**
 * Set archive status for a conversation
 *
 * Archived conversations are hidden from the main chat list.
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param uid - Current user ID
 * @param archived - Whether to archive
 *
 * @example
 * ```typescript
 * // Archive conversation
 * await setArchived("dm", chatId, user.uid, true);
 *
 * // Unarchive conversation
 * await setArchived("dm", chatId, user.uid, false);
 * ```
 */
export async function setArchived(
  scope: ConversationScope,
  conversationId: string,
  uid: string,
  archived: boolean,
): Promise<void> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("setArchived called", {
      operation: "setArchived",
      data: { scope, conversationId, archived },
    });
  }

  if (scope === "dm") {
    await setDMArchived(conversationId, uid, archived);
  } else {
    await setGroupArchived(conversationId, uid, archived);
  }
}

// =============================================================================
// Notification Preference Functions
// =============================================================================

/**
 * Set notification level for a conversation
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param uid - Current user ID
 * @param level - "all" | "mentions" | "none"
 *
 * @example
 * ```typescript
 * // Only notify for mentions in this group
 * await setNotifyLevel("group", groupId, user.uid, "mentions");
 * ```
 */
export async function setNotifyLevel(
  scope: ConversationScope,
  conversationId: string,
  uid: string,
  level: NotifyLevel,
): Promise<void> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("setNotifyLevel called", {
      operation: "setNotifyLevel",
      data: { scope, conversationId, level },
    });
  }

  if (scope === "dm") {
    await setDMNotifyLevel(conversationId, uid, level);
  } else {
    await setGroupNotifyLevel(conversationId, uid, level);
  }
}

/**
 * Set read receipts preference for a conversation
 *
 * When disabled, lastReadAtPublic won't be updated, so other
 * members won't see when you've read their messages.
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param uid - Current user ID
 * @param sendReadReceipts - Whether to send read receipts
 *
 * @example
 * ```typescript
 * // Disable read receipts for this conversation
 * await setReadReceipts("dm", chatId, user.uid, false);
 * ```
 */
export async function setReadReceipts(
  scope: ConversationScope,
  conversationId: string,
  uid: string,
  sendReadReceipts: boolean,
): Promise<void> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("setReadReceipts called", {
      operation: "setReadReceipts",
      data: { scope, conversationId, sendReadReceipts },
    });
  }

  if (scope === "dm") {
    await setDMReadReceipts(conversationId, uid, sendReadReceipts);
  } else {
    await setGroupReadReceipts(conversationId, uid, sendReadReceipts);
  }
}

// =============================================================================
// Re-export types
// =============================================================================

// Export type aliases for this module
export type MemberStateScope = ConversationScope;
