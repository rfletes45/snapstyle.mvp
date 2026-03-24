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
 * Supports the full Unicode emoji set — no restricted whitelist on client.
 * Server validates emoji is a non-empty string ≤ 10 chars long.
 *
 * @module services/reactions
 */

import { MessageV2 } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirestoreInstance, getFunctionsInstance } from "./firebase";

// Lazy initialization - don't call at module load time
const getDb = () => getFirestoreInstance();
const getFunctions = () => getFunctionsInstance();
const log = createLogger("reactions");

// =============================================================================
// Types
// =============================================================================

export interface ReactionToggleResult {
  success: boolean;
  action: "added" | "removed";
  reactionsSummary: Record<string, number>;
  error?: string;
}

export interface ReactionSummary {
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
const MAX_REACTIONS_PER_MESSAGE = 20;

/** Maximum users displayed per reaction */
const MAX_USERS_PER_REACTION = 10;

/** Quick-reaction emojis shown in the reaction tray */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

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
 * Toggle a reaction on a message.
 *
 * If user has already reacted with this emoji, remove it.
 * If user hasn't reacted, add it.
 * Accepts any valid emoji string (server validates length ≤ 10 chars).
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

  // Basic client-side validation
  if (!emoji || typeof emoji !== "string" || emoji.length > 10) {
    return {
      success: false,
      action: "added",
      reactionsSummary: {},
      error: "Invalid emoji",
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

// =============================================================================
// Reaction Queries
// =============================================================================

/**
 * Get reactions for a message from subcollection
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

  messageIds.forEach((id) => reactionsMap.set(id, []));

  messageIds.forEach((messageId) => {
    const unsub = subscribeToReactions(
      scope,
      conversationId,
      messageId,
      currentUid,
      (reactions) => {
        reactionsMap.set(messageId, reactions);
        callback(new Map(reactionsMap));
      },
    );
    unsubscribes.push(unsub);
  });

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
  _currentUid: string,
): ReactionSummary[] {
  if (!reactionsSummary) return [];

  return Object.entries(reactionsSummary).map(([emoji, count]) => ({
    emoji,
    count,
    userIds: [],
    hasReacted: false,
  }));
}

/**
 * Sort reactions by count (descending), then alphabetically for ties
 */
export function sortReactionsByCount(
  reactions: ReactionSummary[],
): ReactionSummary[] {
  return [...reactions].sort(
    (a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji),
  );
}

/**
 * Check if user can add more reactions to a message
 */
export function canAddReaction(
  currentReactions: ReactionSummary[],
  emoji: string,
): boolean {
  if (!emoji || emoji.length > 10) return false;

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
// Optimistic Updates
// =============================================================================

/**
 * Compute the next reactions array after toggling an emoji.
 *
 * Pure function — produces a new array without mutating the input.
 * Used for optimistic UI so the pill appears/disappears instantly.
 */
export function applyOptimisticReaction(
  reactions: ReactionSummary[],
  emoji: string,
  uid: string,
): ReactionSummary[] {
  const existing = reactions.find((r) => r.emoji === emoji);

  if (existing && existing.hasReacted) {
    // User is removing their reaction
    if (existing.count <= 1) {
      // Last reactor — remove the entry entirely
      return reactions.filter((r) => r.emoji !== emoji);
    }
    // Decrement count, remove user from list
    return sortReactionsByCount(
      reactions.map((r) =>
        r.emoji === emoji
          ? {
              ...r,
              count: r.count - 1,
              hasReacted: false,
              userIds: r.userIds.filter((id) => id !== uid),
            }
          : r,
      ),
    );
  }

  if (existing) {
    // Emoji exists but user hasn't reacted — add them
    return sortReactionsByCount(
      reactions.map((r) =>
        r.emoji === emoji
          ? {
              ...r,
              count: r.count + 1,
              hasReacted: true,
              userIds: [...r.userIds, uid],
            }
          : r,
      ),
    );
  }

  // Brand new emoji
  return sortReactionsByCount([
    ...reactions,
    { emoji, count: 1, hasReacted: true, userIds: [uid] },
  ]);
}
