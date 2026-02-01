/**
 * useTypingStatus Hook
 *
 * Subscribes to typing status of other users in a conversation.
 * Also provides a function to update the current user's typing status.
 *
 * @module hooks/useTypingStatus
 */

import { subscribeToTyping } from "@/services/chatMembers";
import { subscribeToInboxSettings } from "@/services/inboxSettings";
import { setTypingIndicator } from "@/services/messaging";
import { DEFAULT_INBOX_SETTINGS, InboxSettings } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useRef, useState } from "react";

const log = createLogger("useTypingStatus");

// Debounce typing indicator updates
const TYPING_DEBOUNCE_MS = 500;
const TYPING_TIMEOUT_MS = 5000; // Auto-clear after 5 seconds of no typing

interface UseTypingStatusConfig {
  /** Conversation scope */
  scope: "dm" | "group";
  /** Conversation ID (chatId for DM, groupId for group) */
  conversationId: string;
  /** Current user's UID */
  currentUid: string;
  /** Other user's UID (for DM only) */
  otherUid?: string;
  /** Enable debug logging */
  debug?: boolean;
}

interface UseTypingStatusReturn {
  /** Whether the other user is currently typing */
  isOtherUserTyping: boolean;
  /** Update current user's typing status (call on text input) */
  setTyping: (isTyping: boolean) => void;
  /** Whether typing indicators are enabled in settings */
  typingIndicatorsEnabled: boolean;
}

/**
 * Hook to manage typing status in conversations
 *
 * @example
 * ```tsx
 * const { isOtherUserTyping, setTyping, typingIndicatorsEnabled } = useTypingStatus({
 *   scope: "dm",
 *   conversationId: chatId,
 *   currentUid: user.uid,
 *   otherUid: friendUid,
 * });
 *
 * // In TextInput onChange
 * const handleTextChange = (text) => {
 *   setText(text);
 *   if (typingIndicatorsEnabled) {
 *     setTyping(text.length > 0);
 *   }
 * };
 *
 * // Display typing indicator
 * {isOtherUserTyping && typingIndicatorsEnabled && <TypingIndicator />}
 * ```
 */
export function useTypingStatus(
  config: UseTypingStatusConfig,
): UseTypingStatusReturn {
  const { scope, conversationId, currentUid, otherUid, debug = false } = config;

  // State
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [settings, setSettings] = useState<InboxSettings>(
    DEFAULT_INBOX_SETTINGS,
  );

  // Refs for debouncing
  const typingTimeoutRef = useRef<number | null>(null);
  const lastTypingRef = useRef(false);

  // Subscribe to user's inbox settings
  useEffect(() => {
    if (!currentUid) return;

    const unsubscribe = subscribeToInboxSettings(currentUid, (newSettings) => {
      setSettings(newSettings);
    });

    return unsubscribe;
  }, [currentUid]);

  // Subscribe to other user's typing status (DM only for now)
  useEffect(() => {
    if (!conversationId || !otherUid || scope !== "dm") {
      return;
    }

    // Don't subscribe if typing indicators are disabled
    if (!settings.showTypingIndicators) {
      setIsOtherUserTyping(false);
      return;
    }

    if (debug) {
      log.debug("Subscribing to typing status", {
        operation: "subscribe",
        data: { conversationId, otherUid },
      });
    }

    const unsubscribe = subscribeToTyping(
      conversationId,
      otherUid,
      (typing) => {
        if (debug) {
          log.debug("Typing status update", {
            operation: "update",
            data: { conversationId, otherUid, typing },
          });
        }
        setIsOtherUserTyping(typing);
      },
    );

    return unsubscribe;
  }, [conversationId, otherUid, scope, settings.showTypingIndicators, debug]);

  // Update current user's typing status with debouncing
  const setTyping = useCallback(
    (isTyping: boolean) => {
      // Don't send typing indicators if disabled in settings
      if (!settings.showTypingIndicators) {
        return;
      }

      if (!conversationId || !currentUid) {
        return;
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      // Only update if status changed
      if (lastTypingRef.current !== isTyping) {
        lastTypingRef.current = isTyping;

        if (debug) {
          log.debug("Setting typing status", {
            operation: "setTyping",
            data: { conversationId, isTyping },
          });
        }

        // Fire and forget - don't await
        setTypingIndicator(scope, conversationId, currentUid, isTyping).catch(
          (error) => {
            log.error("Failed to set typing indicator", {
              operation: "setTyping",
              error,
            });
          },
        );
      }

      // Auto-clear typing after timeout (when typing=true)
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          if (lastTypingRef.current) {
            lastTypingRef.current = false;
            setTypingIndicator(scope, conversationId, currentUid, false).catch(
              () => {},
            );
          }
        }, TYPING_TIMEOUT_MS) as unknown as number;
      }
    },
    [conversationId, currentUid, scope, settings.showTypingIndicators, debug],
  );

  // Cleanup typing status on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Clear typing status when leaving the screen
      if (lastTypingRef.current && conversationId && currentUid) {
        setTypingIndicator(scope, conversationId, currentUid, false).catch(
          () => {},
        );
      }
    };
  }, [scope, conversationId, currentUid]);

  return {
    isOtherUserTyping,
    setTyping,
    typingIndicatorsEnabled: settings.showTypingIndicators,
  };
}
