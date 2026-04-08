/**
 * useChatDebugInfo Hook (Segment 8)
 *
 * Aggregates debug information for the ChatDebugHUD.
 * Only collects data when CHAT_DEBUG_HUD is enabled (dev only).
 *
 * @module hooks/useChatDebugInfo
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import { getQueueItemsForConversation } from "@/services/messaging";
import { EffectiveChatSettings, OutboxItem } from "@/types/messaging";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// Types
// =============================================================================

export interface ChatDebugInfo {
  /** Outbox items for this conversation */
  outboxItems: OutboxItem[];

  /** Number of active Firestore listeners (estimated) */
  listenerCount: number;

  /** Whether the device is online */
  isOnline: boolean;

  /** Last delivered-at watermark */
  lastDeliveredAt: number | null;

  /** Last read-at watermark */
  lastReadAt: number | null;

  /** Effective settings (passed through) */
  effectiveSettings: EffectiveChatSettings | undefined;
}

// =============================================================================
// Global listener counter
// =============================================================================

let globalListenerCount = 0;

/**
 * Increment the global listener count.
 * Call in `useEffect` when subscribing to Firestore.
 * @returns Decrement function for cleanup
 */
export function trackListener(): () => void {
  globalListenerCount++;
  return () => {
    globalListenerCount = Math.max(0, globalListenerCount - 1);
  };
}

/**
 * Get the current global listener count.
 */
export function getListenerCount(): number {
  return globalListenerCount;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Collects debug information for the ChatDebugHUD.
 *
 * When CHAT_DEBUG_HUD is false, returns a stable empty object
 * and does NO work (no subscriptions, no polling).
 */
export function useChatDebugInfo(params: {
  conversationId: string;
  effectiveSettings?: EffectiveChatSettings;
  lastDeliveredAt?: number | null;
  lastReadAt?: number | null;
}): ChatDebugInfo | null {
  const { conversationId, effectiveSettings, lastDeliveredAt, lastReadAt } =
    params;

  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Don't do any work if the HUD is disabled
  if (!CHAT_FEATURES.CHAT_DEBUG_HUD) {
    return null;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    // Poll outbox every 2 seconds (dev-only, low cost)
    async function pollOutbox() {
      try {
        const items = await getQueueItemsForConversation(conversationId);
        setOutboxItems(items);
      } catch {
        // ignore
      }
    }

    pollOutbox();
    intervalRef.current = setInterval(pollOutbox, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [conversationId]);

  // Network state (simple navigator.onLine check)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (typeof globalThis.addEventListener === "function") {
      const onOnline = () => setIsOnline(true);
      const onOffline = () => setIsOnline(false);
      globalThis.addEventListener("online", onOnline);
      globalThis.addEventListener("offline", onOffline);
      return () => {
        globalThis.removeEventListener("online", onOnline);
        globalThis.removeEventListener("offline", onOffline);
      };
    }
  }, []);

  return {
    outboxItems,
    listenerCount: globalListenerCount,
    isOnline,
    lastDeliveredAt: lastDeliveredAt ?? null,
    lastReadAt: lastReadAt ?? null,
    effectiveSettings,
  };
}
