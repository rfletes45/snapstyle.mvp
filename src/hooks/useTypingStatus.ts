/**
 * useTypingStatus Hook
 *
 * Subscribes to typing status of other users in a conversation (DM + Group).
 * Also provides a function to update the current user's typing status.
 *
 * For DMs: watches a single member doc for `typingAt`.
 * For Groups: watches the Members subcollection for `typingExpiresAt`.
 *
 * Returns the list of currently-typing user UIDs so the UI can decide
 * how to render (single "is typing" vs "N people are typing").
 *
 * @module hooks/useTypingStatus
 */

import { subscribeToTyping } from "@/services/chatMembers";
import { subscribeToGroupTyping } from "@/services/groupMembers";
import { subscribeToInboxSettings } from "@/services/inboxSettings";
import { setTypingIndicator } from "@/services/messaging";
import { resolveFromInboxSettings } from "@/services/messaging/resolveChatSettings";
import { DEFAULT_INBOX_SETTINGS, InboxSettings } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const log = createLogger("useTypingStatus");

/** Auto-clear after idle (no further typing events) */
const TYPING_IDLE_TIMEOUT_MS = 5000;
/** Minimum interval between typing writes to avoid Firestore write flood */
const TYPING_KEEPALIVE_MS = 3000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseTypingStatusConfig {
  /** Conversation scope */
  scope: "dm" | "group";
  /** Conversation ID (chatId for DM, groupId for group) */
  conversationId: string;
  /** Current user's UID */
  currentUid: string;
  /** Other user's UID (for DM only — ignored for groups) */
  otherUid?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseTypingStatusReturn {
  /** Whether anyone else is currently typing (convenience boolean) */
  isOtherUserTyping: boolean;
  /** UIDs of users who are currently typing (excludes self) */
  typingUserIds: string[];
  /** Update current user's typing status (call on text input change) */
  setTyping: (isTyping: boolean) => void;
  /** Whether typing indicators are enabled in settings */
  typingIndicatorsEnabled: boolean;
}

/**
 * Hook to manage typing status in conversations (DM + Group).
 *
 * @example
 * ```tsx
 * const typing = useTypingStatus({
 *   scope: "dm",
 *   conversationId: chatId,
 *   currentUid: user.uid,
 *   otherUid: friendUid,
 * });
 *
 * // In TextInput onChange
 * const handleTextChange = (text) => {
 *   setText(text);
 *   typing.setTyping(text.length > 0);
 * };
 *
 * // Display typing indicator
 * {typing.isOtherUserTyping && <TypingIndicator />}
 * ```
 */
export function useTypingStatus(
  config: UseTypingStatusConfig,
): UseTypingStatusReturn {
  const { scope, conversationId, currentUid, otherUid, debug = false } = config;

  // ── State ──────────────────────────────────────────────────────────────
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<InboxSettings>(
    DEFAULT_INBOX_SETTINGS,
  );

  // ── Refs for debounce / keepalive ──────────────────────────────────────
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteRef = useRef(0); // timestamp of last Firestore write
  const lastTypingRef = useRef(false);
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve effective settings via the V3 resolver
  const effective = useMemo(
    () => resolveFromInboxSettings(settings),
    [settings],
  );

  // ── Subscribe to user's inbox settings ─────────────────────────────────
  useEffect(() => {
    if (!currentUid) return;
    const unsubscribe = subscribeToInboxSettings(currentUid, (newSettings) => {
      setSettings(newSettings);
    });
    return unsubscribe;
  }, [currentUid]);

  // ── Subscribe to remote typing state ───────────────────────────────────
  useEffect(() => {
    if (!conversationId || !effective.publishTyping) {
      setTypingUserIds([]);
      return;
    }

    if (scope === "dm") {
      // DM: watch the other user's member doc
      if (!otherUid) {
        setTypingUserIds([]);
        return;
      }

      if (debug) {
        log.debug("Subscribing to DM typing", {
          operation: "subscribe",
          data: { conversationId, otherUid },
        });
      }

      const unsubscribe = subscribeToTyping(
        conversationId,
        otherUid,
        (typing) => {
          setTypingUserIds(typing ? [otherUid] : []);
        },
      );
      return unsubscribe;
    }

    // Group: watch the whole Members subcollection
    if (debug) {
      log.debug("Subscribing to group typing", {
        operation: "subscribe",
        data: { conversationId },
      });
    }

    const unsubscribe = subscribeToGroupTyping(
      conversationId,
      currentUid,
      (uids) => {
        setTypingUserIds(uids);
      },
    );
    return unsubscribe;
  }, [
    conversationId,
    otherUid,
    scope,
    currentUid,
    effective.publishTyping,
    debug,
  ]);

  // ── Emit typing state (debounce + keepalive) ──────────────────────────
  const writeTyping = useCallback(
    (isTyping: boolean) => {
      if (!conversationId || !currentUid) return;
      lastWriteRef.current = Date.now();
      setTypingIndicator(scope, conversationId, currentUid, isTyping).catch(
        (error) => {
          log.error("Failed to set typing indicator", {
            operation: "setTyping",
            error,
          });
        },
      );
    },
    [scope, conversationId, currentUid],
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!effective.publishTyping) return;
      if (!conversationId || !currentUid) return;

      // ── Clear idle timeout ──
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }

      if (isTyping) {
        // Throttle: only write if enough time has passed since last write
        const elapsed = Date.now() - lastWriteRef.current;
        if (!lastTypingRef.current || elapsed >= TYPING_KEEPALIVE_MS) {
          lastTypingRef.current = true;
          writeTyping(true);
        }

        // Start keepalive interval if not running
        if (!keepaliveRef.current) {
          keepaliveRef.current = setInterval(() => {
            if (lastTypingRef.current) {
              writeTyping(true);
            }
          }, TYPING_KEEPALIVE_MS);
        }

        // Set idle timeout to auto-clear
        idleTimeoutRef.current = setTimeout(() => {
          if (lastTypingRef.current) {
            lastTypingRef.current = false;
            writeTyping(false);
          }
          if (keepaliveRef.current) {
            clearInterval(keepaliveRef.current);
            keepaliveRef.current = null;
          }
        }, TYPING_IDLE_TIMEOUT_MS);
      } else {
        // Explicitly stopped typing (send, blur, clear)
        if (lastTypingRef.current) {
          lastTypingRef.current = false;
          writeTyping(false);
        }
        if (keepaliveRef.current) {
          clearInterval(keepaliveRef.current);
          keepaliveRef.current = null;
        }
      }
    },
    [conversationId, currentUid, effective.publishTyping, writeTyping],
  );

  // ── Cleanup on unmount or conversation switch ──────────────────────────
  useEffect(() => {
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (keepaliveRef.current) clearInterval(keepaliveRef.current);

      // Clear typing status when leaving
      if (lastTypingRef.current && conversationId && currentUid) {
        setTypingIndicator(scope, conversationId, currentUid, false).catch(
          () => {},
        );
        lastTypingRef.current = false;
      }
    };
  }, [scope, conversationId, currentUid]);

  return {
    isOtherUserTyping: typingUserIds.length > 0,
    typingUserIds,
    setTyping,
    typingIndicatorsEnabled: effective.publishTyping,
  };
}
