/**
 * Reactions Service (H8)
 *
 * Manages message reactions (emoji responses).
 * Uses a subcollection approach for scalability.
 *
 * Data Model:
 * - Messages/{messageId}/Reactions/{emoji}: { emoji, uids[], count, updatedAt }
 * - message.reactionsSummary: Record<string, number> (denormalized counts)
 *
 * @module services/reactions
 */

import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  getDoc,
  Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirestoreInstance, getFunctionsInstance } from "./firebase";
import { MessageV2 } from "@/types/messaging";
import { createLogger } from "@/utils/log";

// Lazy initialization - don't call at module load time
const getDb = () => getFirestoreInstance();
const getFunctions = () => getFunctionsInstance();
const log = createLogger("reactions");

// =============================================================================
// Types
// =============================================================================

interface ReactionToggleResult {
  success: boolean;
  action: "added" | "removed";
  reactionsSummary: Record<string, number>;
  error?: string;
}

interface ReactionSummary {
  emoji: string;
  count: number;
  userIds: string[];
  hasReacted: boolean;
}

interface ReactionDoc {
  emoji: string;
  uids: string[];
  count: number;
  updatedAt: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum unique reactions per message */
const MAX_REACTIONS_PER_MESSAGE = 12;

/** Maximum users displayed per reaction */
const MAX_USERS_PER_REACTION = 10;

/** Allowed emoji set (matches server-side) */
const ALLOWED_EMOJIS = new Set([
  "👍",
  "👎",
  "❤️",
  "🔥",
  "😂",
  "😢",
  "😮",
  "😡",
  "🎉",
  "👏",
  "🙌",
  "💯",
  "⭐",
  "🚀",
  "💪",
  "🤔",
]);

// =============================================================================
// Cloud Function Callable (lazy initialized)
// =============================================================================

function getToggleReactionCallable() {
  return httpsCallable<
    {
      conversationId: string;
      scope: "dm" | "group";
      messageId: string;
      emoji: string;
    },
    ReactionToggleResult
  >(getFunctions(), "toggleReactionV2");
}

// =============================================================================
// Reaction Operations
// =============================================================================

/**
 * Toggle a reaction on a message
 *
 * If user has already reacted with this emoji, remove it.
 * If user hasn't reacted, add it.
 *
 * @param params - Reaction parameters
 * @returns Toggle result
 */
export async function toggleReaction(params: {
  scope: "dm" | "group";
  conversationId: string;
  messageId: string;
  emoji: string;
  uid: string;
}): Promise<ReactionToggleResult> {
  const { scope, conversationId, messageId, emoji } = params;

  log.info("toggleReaction", {
    operation: "toggle",
    data: { messageId, emoji, scope },
  });

  // Validate emoji client-side first
  if (!ALLOWED_EMOJIS.has(emoji)) {
    return {
      success: false,
      action: "added",
      reactionsSummary: {},
      error: "Emoji not allowed",
    };
  }

  try {
    const result = await getToggleReactionCallable()({
      conversationId,
      scope,
      messageId,
      emoji,
    });

    log.info("toggleReaction success", {
      operation: result.data.action,
      data: { messageId },
    });

    return result.data;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("toggleReaction failed", { error: errorMessage, messageId });

    return {
      success: false,
      action: "added",
      reactionsSummary: {},
      error: errorMessage,
    };
  }
}

/**
 * Add a reaction (convenience wrapper)
 *
 * @param params - Reaction parameters
 */
export async function addReaction(params: {
  scope: "dm" | "group";
  conversationId: string;
  messageId: string;
  emoji: string;
  uid: string;
}): Promise<{ success: boolean; error?: string }> {
  const result = await toggleReaction(params);

  // If toggle removed the reaction, toggle again to add it
  if (result.success && result.action === "removed") {
    const retoggle = await toggleReaction(params);
    return { success: retoggle.success, error: retoggle.error };
  }

  return { success: result.success, error: result.error };
}

/**
 * Remove a reaction (convenience wrapper)
 *
 * @param params - Reaction parameters
 */
export async function removeReaction(params: {
  scope: "dm" | "group";
  conversationId: string;
  messageId: string;
  emoji: string;
  uid: string;
}): Promise<{ success: boolean; error?: string }> {
  const result = await toggleReaction(params);

  // If toggle added the reaction, toggle again to remove it
  if (result.success && result.action === "added") {
    const retoggle = await toggleReaction(params);
    return { success: retoggle.success, error: retoggle.error };
  }

  return { success: result.success, error: result.error };
}

// =============================================================================
// Reaction Queries
// =============================================================================

/**
 * Get reactions for a message from subcollection
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param messageId - Message ID
 * @param currentUid - Current user ID (for hasReacted)
 */
export async function getReactions(
  scope: "dm" | "group",
  conversationId: string,
  messageId: string,
  currentUid: string,
): Promise<ReactionSummary[]> {
  const basePath =
    scope === "dm"
      ? `Chats/${conversationId}/Messages`
      : `Groups/${conversationId}/Messages`;

  const reactionsRef = collection(getDb(), basePath, messageId, "Reactions");

  try {
    const snapshot = await getDocs(reactionsRef);

    const reactions: ReactionSummary[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as ReactionDoc;
      reactions.push({
        emoji: data.emoji,
        count: data.count || data.uids?.length || 0,
        userIds: (data.uids || []).slice(0, MAX_USERS_PER_REACTION),
        hasReacted: (data.uids || []).includes(currentUid),
      });
    });

    return sortReactionsByCount(reactions);
  } catch (error) {
    log.error("getReactions failed", { error, messageId });
    return [];
  }
}

/**
 * Get users who reacted with a specific emoji
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param messageId - Message ID
 * @param emoji - Emoji to query
 */
export async function getReactionUsers(
  scope: "dm" | "group",
  conversationId: string,
  messageId: string,
  emoji: string,
): Promise<string[]> {
  const basePath =
    scope === "dm"
      ? `Chats/${conversationId}/Messages`
      : `Groups/${conversationId}/Messages`;

  const reactionRef = doc(getDb(), basePath, messageId, "Reactions", emoji);

  try {
    const snapshot = await getDoc(reactionRef);

    if (!snapshot.exists()) return [];

    const data = snapshot.data() as ReactionDoc;
    return data.uids || [];
  } catch (error) {
    log.error("getReactionUsers failed", { error, messageId, emoji });
    return [];
  }
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to reactions on a message
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param messageId - Message ID
 * @param currentUid - Current user ID
 * @param callback - Callback for updates
 * @returns Unsubscribe function
 */
export function subscribeToReactions(
  scope: "dm" | "group",
  conversationId: string,
  messageId: string,
  currentUid: string,
  callback: (reactions: ReactionSummary[]) => void,
): Unsubscribe {
  const basePath =
    scope === "dm"
      ? `Chats/${conversationId}/Messages`
      : `Groups/${conversationId}/Messages`;

  const reactionsRef = collection(getDb(), basePath, messageId, "Reactions");

  const unsubscribe = onSnapshot(
    reactionsRef,
    (snapshot) => {
      const reactions: ReactionSummary[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ReactionDoc;
        reactions.push({
          emoji: data.emoji,
          count: data.count || data.uids?.length || 0,
          userIds: (data.uids || []).slice(0, MAX_USERS_PER_REACTION),
          hasReacted: (data.uids || []).includes(currentUid),
        });
      });

      callback(sortReactionsByCount(reactions));
    },
    (error) => {
      log.error("subscribeToReactions error", { error, messageId });
      callback([]);
    },
  );

  return unsubscribe;
}

/**
 * Subscribe to multiple messages' reactions (batch subscription)
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param messageIds - Array of message IDs
 * @param currentUid - Current user ID
 * @param callback - Callback with map of messageId -> reactions
 * @returns Unsubscribe function
 */
export function subscribeToMultipleMessageReactions(
  scope: "dm" | "group",
  conversationId: string,
  messageIds: string[],
  currentUid: string,
  callback: (reactionsMap: Map<string, ReactionSummary[]>) => void,
): Unsubscribe {
  const reactionsMap = new Map<string, ReactionSummary[]>();
  const unsubscribes: Unsubscribe[] = [];

  // Initialize all message IDs with empty arrays
  messageIds.forEach((id) => reactionsMap.set(id, []));

  // Subscribe to each message's reactions
  messageIds.forEach((messageId) => {
    const unsub = subscribeToReactions(
      scope,
      conversationId,
      messageId,
      currentUid,
      (reactions) => {
        reactionsMap.set(messageId, reactions);
        // Trigger callback with updated map
        callback(new Map(reactionsMap));
      },
    );
    unsubscribes.push(unsub);
  });

  // Return combined unsubscribe
  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse reactions summary map from MessageV2 into ReactionSummary array
 */
export function parseReactionsFromMessage(
  reactionsSummary: MessageV2["reactionsSummary"],
  currentUid: string,
): ReactionSummary[] {
  if (!reactionsSummary) return [];

  // reactionsSummary is Record<string, number> for counts only
  // For full user list, would need to query Reactions subcollection
  return Object.entries(reactionsSummary).map(([emoji, count]) => ({
    emoji,
    count,
    userIds: [], // Would need separate query for user list
    hasReacted: false, // Would need separate query to check
  }));
}

/**
 * Check if emoji is in allowed set
 */
export function isAllowedEmoji(emoji: string): boolean {
  return ALLOWED_EMOJIS.has(emoji);
}

/**
 * Get allowed emoji list
 */
export function getAllowedEmojis(): string[] {
  return Array.from(ALLOWED_EMOJIS);
}

/**
 * Sort reactions by count (descending)
 */
export function sortReactionsByCount(
  reactions: ReactionSummary[],
): ReactionSummary[] {
  return [...reactions].sort((a, b) => b.count - a.count);
}

/**
 * Check if user can add more reactions to a message
 */
export function canAddReaction(
  currentReactions: ReactionSummary[],
  emoji: string,
): boolean {
  // Check if emoji is allowed
  if (!isAllowedEmoji(emoji)) return false;

  // Check max unique emojis
  const uniqueEmojis = currentReactions.length;
  const emojiExists = currentReactions.some((r) => r.emoji === emoji);

  if (!emojiExists && uniqueEmojis >= MAX_REACTIONS_PER_MESSAGE) {
    return false;
  }

  return true;
}

/**
 * Format reaction count for display
 */
export function formatReactionCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

// =============================================================================
// Export Types
// =============================================================================

export type { ReactionSummary, ReactionToggleResult };
