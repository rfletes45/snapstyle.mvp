/**
 * useMessageReactions Hook (UNI-06 Extraction)
 *
 * Manages message reactions subscription and state.
 * Extracted from GroupChatScreen to reduce complexity.
 *
 * Features:
 * - Subscribe to reactions for visible messages
 * - Map of messageId -> ReactionSummary[]
 * - Automatic cleanup on unmount
 */

import {
  subscribeToMultipleMessageReactions,
  type ReactionSummary,
} from "@/services/reactions";
import { useCallback, useEffect, useState } from "react";

interface UseMessageReactionsConfig {
  /** Scope of the conversation */
  scope: "dm" | "group";
  /** Conversation ID (chatId or groupId) */
  conversationId: string;
  /** Current user's UID */
  currentUid: string | undefined;
  /** Message IDs to subscribe to */
  messageIds: string[];
  /** Maximum number of messages to subscribe to (performance limit) */
  maxMessages?: number;
  /** Enable/disable subscription (default: true) */
  enabled?: boolean;
}

interface UseMessageReactionsReturn {
  /** Map of messageId -> reactions array */
  reactions: Map<string, ReactionSummary[]>;
  /** Get reactions for a specific message */
  getReactions: (messageId: string) => ReactionSummary[];
}

export function useMessageReactions(
  config: UseMessageReactionsConfig,
): UseMessageReactionsReturn {
  const {
    scope,
    conversationId,
    currentUid,
    messageIds,
    maxMessages = 50,
    enabled = true,
  } = config;

  const [reactions, setReactions] = useState<Map<string, ReactionSummary[]>>(
    new Map(),
  );

  // Subscribe to reactions for visible messages
  useEffect(() => {
    if (!enabled || !conversationId || !currentUid || messageIds.length === 0) {
      return;
    }

    // Limit to maxMessages for performance
    const limitedIds = messageIds.slice(0, maxMessages);

    const unsubscribe = subscribeToMultipleMessageReactions(
      scope,
      conversationId,
      limitedIds,
      currentUid,
      (reactionsMap) => {
        setReactions(reactionsMap);
      },
    );

    return () => unsubscribe();
  }, [scope, conversationId, currentUid, messageIds, maxMessages, enabled]);

  const getReactions = useCallback(
    (messageId: string): ReactionSummary[] => reactions.get(messageId) || [],
    [reactions],
  );

  return {
    reactions,
    getReactions,
  };
}
