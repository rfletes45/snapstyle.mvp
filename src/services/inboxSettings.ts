/**
 * Inbox Settings Service
 *
 * Manages user's global inbox and notification preferences.
 * Settings are stored in a user's subcollection for privacy.
 *
 * Firestore path: `Users/{uid}/settings/inbox`
 *
 * @module services/inboxSettings
 */

import { DEFAULT_INBOX_SETTINGS, InboxSettings } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

const log = createLogger("inboxSettings");

// Helper to create log context
const ctx = (data: Record<string, unknown>) => ({ data });

// =============================================================================
// Document Reference Helpers
// =============================================================================

/**
 * Get reference to user's inbox settings document
 */
function getSettingsRef(uid: string) {
  return doc(getFirestoreInstance(), "Users", uid, "settings", "inbox");
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Get user's inbox settings
 *
 * Returns default settings if no settings document exists.
 * Creates the document with defaults on first access.
 *
 * @param uid - User ID
 * @returns Inbox settings (merged with defaults for missing fields)
 */
export async function getInboxSettings(uid: string): Promise<InboxSettings> {
  try {
    const settingsRef = getSettingsRef(uid);
    const snapshot = await getDoc(settingsRef);

    if (!snapshot.exists()) {
      // Create default settings
      await setDoc(settingsRef, DEFAULT_INBOX_SETTINGS);
      log.info("Created default inbox settings", ctx({ uid }));
      return DEFAULT_INBOX_SETTINGS;
    }

    // Merge with defaults to ensure all fields exist
    const data = snapshot.data();
    return {
      ...DEFAULT_INBOX_SETTINGS,
      ...data,
    } as InboxSettings;
  } catch (error) {
    log.error("Failed to get inbox settings", ctx({ uid, error }));
    // Return defaults on error to avoid breaking the app
    return DEFAULT_INBOX_SETTINGS;
  }
}

/**
 * Subscribe to user's inbox settings in real-time
 *
 * @param uid - User ID
 * @param callback - Called with settings on each change
 * @returns Unsubscribe function
 */
export function subscribeToInboxSettings(
  uid: string,
  callback: (settings: InboxSettings) => void,
): () => void {
  const settingsRef = getSettingsRef(uid);

  return onSnapshot(
    settingsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(DEFAULT_INBOX_SETTINGS);
        return;
      }

      const data = snapshot.data();
      callback({
        ...DEFAULT_INBOX_SETTINGS,
        ...data,
      } as InboxSettings);
    },
    (error) => {
      log.error("Inbox settings subscription error", ctx({ uid, error }));
      callback(DEFAULT_INBOX_SETTINGS);
    },
  );
}

// =============================================================================
// Write Operations
// =============================================================================

/**
 * Update inbox settings
 *
 * Merges with existing settings - only updates provided fields.
 *
 * @param uid - User ID
 * @param updates - Partial settings to update
 */
export async function updateInboxSettings(
  uid: string,
  updates: Partial<InboxSettings>,
): Promise<void> {
  try {
    const settingsRef = getSettingsRef(uid);

    // Check if document exists first
    const snapshot = await getDoc(settingsRef);

    if (!snapshot.exists()) {
      // Create with defaults merged with updates
      await setDoc(settingsRef, {
        ...DEFAULT_INBOX_SETTINGS,
        ...updates,
      });
    } else {
      // Update existing document
      await updateDoc(settingsRef, updates);
    }

    log.debug(
      "Updated inbox settings",
      ctx({ uid, fields: Object.keys(updates) }),
    );
  } catch (error) {
    log.error("Failed to update inbox settings", ctx({ uid, error }));
    throw error;
  }
}

/**
 * Reset inbox settings to defaults
 *
 * @param uid - User ID
 */
export async function resetInboxSettings(uid: string): Promise<void> {
  try {
    const settingsRef = getSettingsRef(uid);
    await setDoc(settingsRef, DEFAULT_INBOX_SETTINGS);

    log.info("Reset inbox settings to defaults", ctx({ uid }));
  } catch (error) {
    log.error("Failed to reset inbox settings", ctx({ uid, error }));
    throw error;
  }
}

// =============================================================================
// Notification Settings
// =============================================================================

/**
 * Set default notification level for new conversations
 *
 * @param uid - User ID
 * @param level - Notification level
 */
export async function setDefaultNotifyLevel(
  uid: string,
  level: "all" | "mentions" | "none",
): Promise<void> {
  await updateInboxSettings(uid, { defaultNotifyLevel: level });
}

/**
 * Toggle read receipts setting
 *
 * @param uid - User ID
 * @param enabled - Whether to enable read receipts
 */
export async function setReadReceiptsEnabled(
  uid: string,
  enabled: boolean,
): Promise<void> {
  await updateInboxSettings(uid, { showReadReceipts: enabled });
}

/**
 * Toggle typing indicators setting
 *
 * @param uid - User ID
 * @param enabled - Whether to show typing indicators
 */
export async function setTypingIndicatorsEnabled(
  uid: string,
  enabled: boolean,
): Promise<void> {
  await updateInboxSettings(uid, { showTypingIndicators: enabled });
}

/**
 * Toggle online status visibility
 *
 * @param uid - User ID
 * @param visible - Whether to show online status
 */
export async function setOnlineStatusVisible(
  uid: string,
  visible: boolean,
): Promise<void> {
  await updateInboxSettings(uid, { showOnlineStatus: visible });
}

/**
 * Toggle last seen visibility
 *
 * @param uid - User ID
 * @param visible - Whether to show last seen
 */
export async function setLastSeenVisible(
  uid: string,
  visible: boolean,
): Promise<void> {
  await updateInboxSettings(uid, { showLastSeen: visible });
}

// =============================================================================
// UI Preferences
// =============================================================================

/**
 * Set maximum pinned conversations
 *
 * @param uid - User ID
 * @param max - Maximum number of pinned conversations (1-10)
 */
export async function setMaxPinnedConversations(
  uid: string,
  max: number,
): Promise<void> {
  // Clamp to valid range
  const clampedMax = Math.max(1, Math.min(10, max));
  await updateInboxSettings(uid, { maxPinnedConversations: clampedMax });
}

/**
 * Toggle delete confirmation setting
 *
 * @param uid - User ID
 * @param enabled - Whether to show confirmation before delete
 */
export async function setConfirmBeforeDelete(
  uid: string,
  enabled: boolean,
): Promise<void> {
  await updateInboxSettings(uid, { confirmBeforeDelete: enabled });
}

/**
 * Toggle swipe actions setting
 *
 * @param uid - User ID
 * @param enabled - Whether to enable swipe actions
 */
export async function setSwipeActionsEnabled(
  uid: string,
  enabled: boolean,
): Promise<void> {
  await updateInboxSettings(uid, { swipeActionsEnabled: enabled });
}

// =============================================================================
// Recent Searches
// =============================================================================

/**
 * Add a search term to recent searches
 *
 * Moves the term to the front if it already exists.
 * Limits to 10 recent searches.
 *
 * @param uid - User ID
 * @param searchTerm - Search term to add
 */
export async function addRecentSearch(
  uid: string,
  searchTerm: string,
): Promise<void> {
  try {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) return;

    const settings = await getInboxSettings(uid);

    // Remove if already exists, then add to front
    const searches = settings.recentSearches.filter((s) => s !== trimmedTerm);
    searches.unshift(trimmedTerm);

    // Limit to 10 searches
    if (searches.length > 10) {
      searches.pop();
    }

    await updateInboxSettings(uid, { recentSearches: searches });

    log.debug("Added recent search", ctx({ uid, term: trimmedTerm }));
  } catch (error) {
    log.error("Failed to add recent search", ctx({ uid, error }));
    // Don't throw - this is not critical
  }
}

/**
 * Remove a search term from recent searches
 *
 * @param uid - User ID
 * @param searchTerm - Search term to remove
 */
export async function removeRecentSearch(
  uid: string,
  searchTerm: string,
): Promise<void> {
  try {
    const settings = await getInboxSettings(uid);
    const searches = settings.recentSearches.filter((s) => s !== searchTerm);

    await updateInboxSettings(uid, { recentSearches: searches });

    log.debug("Removed recent search", ctx({ uid, term: searchTerm }));
  } catch (error) {
    log.error("Failed to remove recent search", ctx({ uid, error }));
    // Don't throw - this is not critical
  }
}

/**
 * Clear all recent searches
 *
 * @param uid - User ID
 */
export async function clearRecentSearches(uid: string): Promise<void> {
  try {
    await updateInboxSettings(uid, { recentSearches: [] });
    log.info("Cleared recent searches", ctx({ uid }));
  } catch (error) {
    log.error("Failed to clear recent searches", ctx({ uid, error }));
    throw error;
  }
}

/**
 * Get recent searches
 *
 * @param uid - User ID
 * @returns Array of recent search terms
 */
export async function getRecentSearches(uid: string): Promise<string[]> {
  const settings = await getInboxSettings(uid);
  return settings.recentSearches;
}
