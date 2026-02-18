/**
 * Presence Service
 *
 * Manages user online/offline status using Firebase Realtime Database.
 * Uses the special `.info/connected` path to detect connection state
 * and `onDisconnect()` to automatically mark users offline.
 *
 * ## Architecture
 *
 * - RTDB stores presence at `/presence/{uid}`:
 *   - `online`: boolean
 *   - `lastSeen`: timestamp
 *
 * - Privacy is controlled by the current user's own settings (reciprocal model):
 *   - If you turn off `showOnlineStatus`, you can't see others' online status
 *   - This is enforced in the usePresence hook, not in this service
 *
 * @module services/presence
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import { createLogger } from "@/utils/log";
import { getAuth } from "firebase/auth";
import {
  DatabaseReference,
  get,
  getDatabase,
  off,
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
} from "firebase/database";

const log = createLogger("presence");

// =============================================================================
// Types
// =============================================================================

export interface PresenceData {
  /** Whether user is currently online */
  online: boolean;
  /** Last seen timestamp (ms since epoch) */
  lastSeen: number | null;
}

export interface PresenceWithPrivacy extends PresenceData {
  /** Whether we're allowed to see this user's online status */
  canSeeOnlineStatus: boolean;
  /** Whether we're allowed to see this user's last seen */
  canSeeLastSeen: boolean;
}

/**
 * RTDB mirror of user privacy flags.
 * Written by Firestore trigger onChatSettingsChanged.
 */
export interface StatusVisibility {
  onlineAllowed: boolean;
  lastSeenAllowed: boolean;
  updatedAt?: number;
}

// =============================================================================
// Module State
// =============================================================================

let presenceInitialized = false;
let connectedRef: DatabaseReference | null = null;
let currentUserPresenceRef: DatabaseReference | null = null;

/**
 * When CHAT_SETTINGS_V3 is enabled, callers can pass effective settings
 * to gate whether presence is published. This flag is stored at the module
 * level so that `initializePresence` and `setPresenceOnline` can reference
 * it without requiring callers in the connection listener to pass settings.
 *
 * Default: true (publish) — preserves existing behaviour when either:
 *  - CHAT_SETTINGS_V3 is OFF, or
 *  - the caller hasn't provided effective settings yet.
 */
let shouldPublishOnlineStatus = true;
let shouldPublishLastSeen = true;

/**
 * Update the module-level publish flags.
 *
 * Call this whenever the user's effective settings change (e.g. from a
 * useEffect in the AuthContext that subscribes to inbox settings and
 * resolves them through `resolveFromInboxSettings`).
 *
 * When CHAT_SETTINGS_V3 is OFF, this function is a no-op — presence
 * continues to be published unconditionally.
 */
export function setPresencePrivacyFlags(flags: {
  publishOnlineStatus?: boolean;
  publishLastSeen?: boolean;
}): void {
  if (!CHAT_FEATURES.CHAT_SETTINGS_V3) return;
  if (flags.publishOnlineStatus !== undefined) {
    shouldPublishOnlineStatus = flags.publishOnlineStatus;
  }
  if (flags.publishLastSeen !== undefined) {
    shouldPublishLastSeen = flags.publishLastSeen;
  }
  log.debug("Presence privacy flags updated", {
    operation: "privacyFlags",
    data: { shouldPublishOnlineStatus, shouldPublishLastSeen },
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

function getRealtimeDatabase() {
  return getDatabase();
}

// =============================================================================
// Presence Management
// =============================================================================

/**
 * Initialize presence tracking for the current user
 *
 * This should be called once when the user signs in.
 * It sets up connection monitoring and auto-offline on disconnect.
 *
 * @example
 * ```tsx
 * // In AuthContext or App initialization
 * useEffect(() => {
 *   if (user) {
 *     initializePresence(user.uid);
 *     return () => cleanupPresence();
 *   }
 * }, [user]);
 * ```
 */
export function initializePresence(uid: string): void {
  if (presenceInitialized) {
    log.debug("Presence already initialized", { operation: "init" });
    return;
  }

  try {
    const db = getRealtimeDatabase();
    connectedRef = ref(db, ".info/connected");
    currentUserPresenceRef = ref(db, `presence/${uid}`);

    log.info("Initializing presence", { operation: "init", data: { uid } });

    // Listen for connection state changes
    onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        // We're connected!
        log.debug("Connected to RTDB", { operation: "connected" });

        if (currentUserPresenceRef) {
          // When we disconnect, set offline status
          // Always write onDisconnect so absent presence looks offline
          onDisconnect(currentUserPresenceRef).set({
            online: false,
            lastSeen: shouldPublishLastSeen ? serverTimestamp() : null,
          });

          // Set online status — respect privacy flag
          if (shouldPublishOnlineStatus) {
            set(currentUserPresenceRef, {
              online: true,
              lastSeen: shouldPublishLastSeen ? serverTimestamp() : null,
            });
          } else {
            // User opted out of online status; write offline so stale
            // "online: true" from a previous session doesn't linger.
            set(currentUserPresenceRef, {
              online: false,
              lastSeen: shouldPublishLastSeen ? serverTimestamp() : null,
            });
          }
        }
      } else {
        log.debug("Disconnected from RTDB", { operation: "disconnected" });
      }
    });

    presenceInitialized = true;
  } catch (error) {
    log.error("Failed to initialize presence", { operation: "init", error });
  }
}

/**
 * Clean up presence tracking (call on sign out)
 */
export function cleanupPresence(): void {
  if (!presenceInitialized) return;

  try {
    if (connectedRef) {
      off(connectedRef);
      connectedRef = null;
    }

    // Set offline before cleanup
    if (currentUserPresenceRef) {
      set(currentUserPresenceRef, {
        online: false,
        lastSeen: Date.now(),
      });
      currentUserPresenceRef = null;
    }

    presenceInitialized = false;
    log.info("Presence cleaned up", { operation: "cleanup" });
  } catch (error) {
    log.error("Failed to cleanup presence", { operation: "cleanup", error });
  }
}

/**
 * Set the current user's online status manually
 *
 * @param online - Whether to show as online
 */
export async function setPresenceOnline(online: boolean): Promise<void> {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  if (!uid) {
    log.warn("Cannot set presence - no user", { operation: "setOnline" });
    return;
  }

  try {
    const db = getRealtimeDatabase();
    const presenceRef = ref(db, `presence/${uid}`);

    // When CHAT_SETTINGS_V3 is enabled and user opted out of
    // publishOnlineStatus, force online=false so the presence node
    // never advertises this user as online.
    const effectiveOnline = online && shouldPublishOnlineStatus;

    await set(presenceRef, {
      online: effectiveOnline,
      lastSeen: shouldPublishLastSeen ? serverTimestamp() : null,
    });

    log.debug("Set presence", {
      operation: "setOnline",
      data: { online, effectiveOnline },
    });
  } catch (error) {
    log.error("Failed to set presence", { operation: "setOnline", error });
  }
}

// =============================================================================
// Presence Queries
// =============================================================================

/**
 * Get a user's presence data (one-time fetch)
 *
 * Note: We do NOT check the target user's privacy settings here because:
 * 1. Firestore rules prevent reading another user's settings
 * 2. Privacy is handled via reciprocal model in usePresence hook -
 *    if you disable showing YOUR online status, you can't see others' status either
 *
 * @param uid - User ID to check
 * @returns Presence data with privacy flags
 */
export async function getUserPresence(
  uid: string,
): Promise<PresenceWithPrivacy> {
  try {
    // Fetch presence data from RTDB
    const db = getRealtimeDatabase();
    const presenceRef = ref(db, `presence/${uid}`);
    const snapshot = await get(presenceRef);

    const data = snapshot.val() as PresenceData | null;

    return {
      online: data?.online ?? false,
      lastSeen: data?.lastSeen ?? null,
      // Always true - privacy is controlled by the current user's own settings
      // in the calling code (reciprocal privacy model)
      canSeeOnlineStatus: true,
      canSeeLastSeen: true,
    };
  } catch (error) {
    log.error("Failed to get user presence", {
      operation: "getPresence",
      data: { uid },
      error,
    });

    return {
      online: false,
      lastSeen: null,
      canSeeOnlineStatus: false,
      canSeeLastSeen: false,
    };
  }
}

/**
 * Subscribe to a user's presence in real-time
 *
 * Note: We do NOT check the target user's privacy settings here because:
 * 1. Firestore rules prevent reading another user's settings
 * 2. Privacy is handled via reciprocal model in usePresence hook -
 *    if you disable showing YOUR online status, you can't see others' status either
 *
 * @param uid - User ID to watch
 * @param callback - Called with presence updates
 * @returns Unsubscribe function
 */
export function subscribeToPresence(
  uid: string,
  callback: (presence: PresenceWithPrivacy) => void,
): () => void {
  const db = getRealtimeDatabase();
  const presenceRef = ref(db, `presence/${uid}`);

  const handleValue = (snapshot: any) => {
    const data = snapshot.val() as PresenceData | null;

    callback({
      online: data?.online ?? false,
      lastSeen: data?.lastSeen ?? null,
      // Always true - privacy is controlled by the current user's own settings
      // in the usePresence hook (reciprocal privacy model)
      canSeeOnlineStatus: true,
      canSeeLastSeen: true,
    });
  };

  onValue(presenceRef, handleValue);

  return () => {
    off(presenceRef, "value", handleValue);
  };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Format last seen time as human-readable string
 *
 * @param lastSeen - Timestamp in milliseconds
 * @returns Formatted string like "5 minutes ago" or "Yesterday"
 */
export function formatLastSeen(lastSeen: number | null): string {
  if (!lastSeen) return "Never";

  const now = Date.now();
  const diff = now - lastSeen;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  // Format as date for older
  const date = new Date(lastSeen);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// =============================================================================
// Status Visibility (Segment 7 — RTDB Privacy Mirror)
// =============================================================================

/**
 * Fetch the RTDB status visibility flags for a target user.
 *
 * When CHAT_PRIVACY_SERVER_ENFORCED is enabled, this tells the
 * subscribing client whether the target user allows their online
 * status and last-seen to be shown.
 *
 * @param uid - Target user whose visibility flags to check
 * @returns StatusVisibility (defaults to allowed if not present)
 */
export async function getStatusVisibility(
  uid: string,
): Promise<StatusVisibility> {
  if (!CHAT_FEATURES.CHAT_PRIVACY_SERVER_ENFORCED) {
    return { onlineAllowed: true, lastSeenAllowed: true };
  }

  try {
    const db = getRealtimeDatabase();
    const visRef = ref(db, `statusVisibility/${uid}`);
    const snapshot = await get(visRef);
    const data = snapshot.val() as StatusVisibility | null;

    return {
      onlineAllowed: data?.onlineAllowed ?? true,
      lastSeenAllowed: data?.lastSeenAllowed ?? true,
      updatedAt: data?.updatedAt,
    };
  } catch (error) {
    log.error("Failed to get status visibility", {
      operation: "getStatusVisibility",
      data: { uid },
      error,
    });
    // Fail open — if we can't read, assume allowed
    return { onlineAllowed: true, lastSeenAllowed: true };
  }
}

/**
 * Subscribe to a user's status visibility flags in real-time.
 *
 * When CHAT_PRIVACY_SERVER_ENFORCED is enabled, the caller should
 * combine this with `subscribeToPresence` to mask the online status
 * and last-seen fields if the target user has disabled them.
 *
 * @param uid - Target user
 * @param callback - Called when visibility flags change
 * @returns Unsubscribe function
 */
export function subscribeToStatusVisibility(
  uid: string,
  callback: (visibility: StatusVisibility) => void,
): () => void {
  if (!CHAT_FEATURES.CHAT_PRIVACY_SERVER_ENFORCED) {
    // Immediately fire allowed and return no-op
    callback({ onlineAllowed: true, lastSeenAllowed: true });
    return () => {};
  }

  const db = getRealtimeDatabase();
  const visRef = ref(db, `statusVisibility/${uid}`);

  const handleValue = (snapshot: { val: () => StatusVisibility | null }) => {
    const data = snapshot.val();
    callback({
      onlineAllowed: data?.onlineAllowed ?? true,
      lastSeenAllowed: data?.lastSeenAllowed ?? true,
      updatedAt: data?.updatedAt,
    });
  };

  onValue(visRef, handleValue);

  return () => {
    off(visRef, "value", handleValue);
  };
}
