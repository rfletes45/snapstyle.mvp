/**
 * usePresence Hook
 *
 * Subscribe to a user's online presence status.
 * Respects the user's privacy settings.
 *
 * @module hooks/usePresence
 */

import { subscribeToInboxSettings } from "@/services/inboxSettings";
import {
  formatLastSeen,
  PresenceWithPrivacy,
  subscribeToPresence,
} from "@/services/presence";
import { createLogger } from "@/utils/log";
import { useEffect, useState } from "react";

const log = createLogger("usePresence");

interface UsePresenceConfig {
  /** User ID to watch */
  userId: string;
  /** Current user's ID (to check their own settings) */
  currentUserId?: string;
  /** Enable debug logging */
  debug?: boolean;
}

interface UsePresenceReturn {
  /** Whether the user is currently online */
  isOnline: boolean;
  /** Last seen timestamp (ms) */
  lastSeen: number | null;
  /** Formatted last seen string ("5m ago", "Yesterday", etc.) */
  lastSeenFormatted: string;
  /** Whether we can show online status (based on target user's settings) */
  canShowOnlineStatus: boolean;
  /** Whether we can show last seen (based on target user's settings) */
  canShowLastSeen: boolean;
  /** Whether our own settings allow seeing presence (reciprocal) */
  ourSettingsAllowPresence: boolean;
  /** Combined check: should we actually display online indicator */
  shouldShowOnlineIndicator: boolean;
  /** Combined check: should we actually display last seen */
  shouldShowLastSeen: boolean;
}

/**
 * Hook to subscribe to a user's presence status
 *
 * @example
 * ```tsx
 * const presence = usePresence({
 *   userId: friendUid,
 *   currentUserId: user.uid,
 * });
 *
 * // In header
 * {presence.shouldShowOnlineIndicator && (
 *   <PresenceIndicator online={presence.isOnline} />
 * )}
 *
 * // Show last seen
 * {presence.shouldShowLastSeen && !presence.isOnline && (
 *   <Text>Last seen {presence.lastSeenFormatted}</Text>
 * )}
 * ```
 */
export function usePresence(config: UsePresenceConfig): UsePresenceReturn {
  const { userId, currentUserId, debug = false } = config;

  const [presence, setPresence] = useState<PresenceWithPrivacy>({
    online: false,
    lastSeen: null,
    canSeeOnlineStatus: true,
    canSeeLastSeen: true,
  });

  const [ourSettings, setOurSettings] = useState({
    showOnlineStatus: true,
    showLastSeen: true,
  });

  // Subscribe to target user's presence
  useEffect(() => {
    if (!userId) return;

    if (debug) {
      log.debug("Subscribing to presence", {
        operation: "subscribe",
        data: { userId },
      });
    }

    const unsubscribe = subscribeToPresence(userId, (newPresence) => {
      if (debug) {
        log.debug("Presence update", {
          operation: "update",
          data: { userId, ...newPresence },
        });
      }
      setPresence(newPresence);
    });

    return unsubscribe;
  }, [userId, debug]);

  // Subscribe to our own settings (for reciprocal visibility)
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = subscribeToInboxSettings(currentUserId, (settings) => {
      setOurSettings({
        showOnlineStatus: settings.showOnlineStatus,
        showLastSeen: settings.showLastSeen,
      });
    });

    return unsubscribe;
  }, [currentUserId]);

  // Compute derived values
  const shouldShowOnlineIndicator =
    presence.canSeeOnlineStatus && ourSettings.showOnlineStatus;

  const shouldShowLastSeen =
    presence.canSeeLastSeen && ourSettings.showLastSeen;

  return {
    isOnline: presence.online,
    lastSeen: presence.lastSeen,
    lastSeenFormatted: formatLastSeen(presence.lastSeen),
    canShowOnlineStatus: presence.canSeeOnlineStatus,
    canShowLastSeen: presence.canSeeLastSeen,
    ourSettingsAllowPresence: ourSettings.showOnlineStatus,
    shouldShowOnlineIndicator,
    shouldShowLastSeen,
  };
}
