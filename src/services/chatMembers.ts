/**
 * Chat Members Service
 *
 * Manages public and private member state for DM chats.
 * - Public state: visible to other members (read receipts, typing indicators)
 * - Private state: owner-only (mute, archive, notification preferences)
 *
 * Firestore paths:
 * - Public: `Chats/{chatId}/Members/{uid}`
 * - Private: `Chats/{chatId}/MembersPrivate/{uid}`
 *
 * @module services/chatMembers
 */

import {
  MemberStatePrivate,
  MemberStatePublic,
  TYPING_THROTTLE_MS,
  TYPING_TIMEOUT_MS,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

const log = createLogger("chatMembers");

// Helper to create log context with data
const ctx = (data: Record<string, unknown>) => ({ data });

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Convert Firestore Timestamp to milliseconds
 */
function toMillis(value: any): number | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  return undefined;
}

// =============================================================================
// Public Member State
// =============================================================================

/**
 * Get public member state for a DM chat
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @returns Member state or null if not found
 */
export async function getDMMemberPublic(
  chatId: string,
  uid: string,
): Promise<MemberStatePublic | null> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "Members", uid);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
      uid: data.uid,
      role: data.role,
      joinedAt: toMillis(data.joinedAt) || Date.now(),
      lastReadAtPublic: toMillis(data.lastReadAtPublic),
      typingAt: toMillis(data.typingAt),
    };
  } catch (error) {
    log.error("Failed to get public member state", ctx({ chatId, uid, error }));
    return null;
  }
}

/**
 * Get all public member states for a chat
 *
 * @param chatId - Chat document ID
 * @returns Array of member states
 */
export async function getAllDMMembersPublic(
  chatId: string,
): Promise<MemberStatePublic[]> {
  try {
    const db = getFirestoreInstance();
    const colRef = collection(db, "Chats", chatId, "Members");
    const snapshot = await getDocs(colRef);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: data.uid || doc.id,
        role: data.role,
        joinedAt: toMillis(data.joinedAt) || Date.now(),
        lastReadAtPublic: toMillis(data.lastReadAtPublic),
        typingAt: toMillis(data.typingAt),
      };
    });
  } catch (error) {
    log.error("Failed to get all members", ctx({ chatId, error }));
    return [];
  }
}

/**
 * Initialize or update public member state
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @param data - Partial state to merge
 */
export async function setDMMemberPublic(
  chatId: string,
  uid: string,
  data: Partial<MemberStatePublic>,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "Members", uid);

    await setDoc(
      docRef,
      {
        uid,
        ...data,
      },
      { merge: true },
    );

    log.debug("Updated public member state", ctx({ chatId, uid }));
  } catch (error) {
    log.error("Failed to set public member state", ctx({ chatId, uid, error }));
    throw error;
  }
}

/**
 * Update read receipt watermark (public)
 *
 * This updates the public lastReadAtPublic field, which is visible
 * to other members for read receipt display.
 * Also updates lastSeenAtPrivate for unread badge computation.
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @param timestamp - Watermark timestamp (serverReceivedAt of last read message)
 */
export async function updateReadWatermark(
  chatId: string,
  uid: string,
  timestamp: number,
  options: { sendPublicReceipt?: boolean } = { sendPublicReceipt: true },
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const { sendPublicReceipt = true } = options;

    // Update public watermark (for read receipts) - only if enabled
    if (sendPublicReceipt) {
      const publicDocRef = doc(db, "Chats", chatId, "Members", uid);
      await setDoc(
        publicDocRef,
        {
          uid,
          lastReadAtPublic: timestamp,
        },
        { merge: true },
      );
    }

    // Always update private last seen (for unread badge computation)
    // Use the max of the provided timestamp and Date.now() to ensure
    // lastSeenAtPrivate >= lastMessageAt. The Chat doc's lastMessageAt is a
    // server timestamp written after the message's serverReceivedAt, so using
    // serverReceivedAt alone would leave a gap where lastMessageAt >
    // lastSeenAtPrivate, causing perpetual unread badges.
    const privateDocRef = doc(db, "Chats", chatId, "MembersPrivate", uid);
    await setDoc(
      privateDocRef,
      {
        uid,
        lastSeenAtPrivate: Math.max(timestamp, Date.now()),
        lastMarkedUnreadAt: null, // Clear manual unread marker
      },
      { merge: true },
    );

    log.debug(
      "Updated read watermark",
      ctx({ chatId, uid, timestamp, sendPublicReceipt }),
    );
  } catch (error) {
    log.error("Failed to update read watermark", ctx({ chatId, uid, error }));
    // Don't throw - read receipts are not critical
  }
}

// =============================================================================
// Typing Indicators
// =============================================================================

let lastTypingUpdate = 0;

/**
 * Update typing indicator with throttling
 *
 * Throttled to prevent excessive Firestore writes.
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 */
export async function updateTypingIndicator(
  chatId: string,
  uid: string,
): Promise<void> {
  const now = Date.now();

  // Throttle updates
  if (now - lastTypingUpdate < TYPING_THROTTLE_MS) {
    return;
  }

  lastTypingUpdate = now;

  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "Members", uid);

    await setDoc(
      docRef,
      {
        uid,
        typingAt: now,
      },
      { merge: true },
    );

    log.debug("Updated typing indicator", ctx({ chatId, uid }));
  } catch (error) {
    log.error("Failed to update typing indicator", ctx({ chatId, uid, error }));
    // Don't throw - typing indicators are not critical
  }
}

/**
 * Clear typing indicator
 *
 * Call this when:
 * - User sends a message
 * - User clears input
 * - User leaves chat screen
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 */
export async function clearTypingIndicator(
  chatId: string,
  uid: string,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "Members", uid);

    await updateDoc(docRef, {
      typingAt: deleteField(),
    });

    log.debug("Cleared typing indicator", ctx({ chatId, uid }));
  } catch (error) {
    // May fail if doc doesn't exist yet, which is fine
    log.debug("Could not clear typing indicator", ctx({ chatId, uid }));
  }
}

/**
 * Subscribe to other member's typing status
 *
 * @param chatId - Chat document ID
 * @param otherUid - Other user's ID
 * @param callback - Called with typing status
 * @returns Unsubscribe function
 */
export function subscribeToTyping(
  chatId: string,
  otherUid: string,
  callback: (isTyping: boolean) => void,
): () => void {
  const db = getFirestoreInstance();
  const docRef = doc(db, "Chats", chatId, "Members", otherUid);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(false);
        return;
      }

      const data = snapshot.data();
      const typingAt = toMillis(data.typingAt);

      // Check if typing timestamp is recent enough
      const isTyping = typingAt
        ? Date.now() - typingAt < TYPING_TIMEOUT_MS
        : false;
      callback(isTyping);
    },
    (error) => {
      log.error("Typing subscription error", ctx({ chatId, otherUid, error }));
      callback(false);
    },
  );
}

/**
 * Subscribe to all members' typing status
 *
 * @param chatId - Chat document ID
 * @param currentUid - Current user's ID (excluded from results)
 * @param callback - Called with array of typing user IDs
 * @returns Unsubscribe function
 */
export function subscribeToAllTyping(
  chatId: string,
  currentUid: string,
  callback: (typingUids: string[]) => void,
): () => void {
  const db = getFirestoreInstance();
  const colRef = collection(db, "Chats", chatId, "Members");

  return onSnapshot(
    colRef,
    (snapshot) => {
      const now = Date.now();
      const typingUids: string[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const uid = data.uid || doc.id;

        // Skip current user
        if (uid === currentUid) return;

        const typingAt = toMillis(data.typingAt);
        if (typingAt && now - typingAt < TYPING_TIMEOUT_MS) {
          typingUids.push(uid);
        }
      });

      callback(typingUids);
    },
    (error) => {
      log.error("All typing subscription error", ctx({ chatId, error }));
      callback([]);
    },
  );
}

/**
 * Subscribe to other member's read receipt watermark
 *
 * This allows you to know which messages have been read by the other user.
 * Use this to show "read" status (blue checkmarks) on your sent messages.
 *
 * @param chatId - Chat document ID
 * @param otherUid - Other user's ID
 * @param callback - Called with their lastReadAtPublic timestamp (or null)
 * @returns Unsubscribe function
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToReadReceipt(chatId, friendUid, (watermark) => {
 *   // Messages with serverReceivedAt <= watermark have been read
 *   setOtherUserReadWatermark(watermark);
 * });
 * ```
 */
export function subscribeToReadReceipt(
  chatId: string,
  otherUid: string,
  callback: (readWatermark: number | null) => void,
): () => void {
  const db = getFirestoreInstance();
  const docRef = doc(db, "Chats", chatId, "Members", otherUid);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      const data = snapshot.data();
      const lastReadAtPublic = toMillis(data.lastReadAtPublic);
      callback(lastReadAtPublic ?? null);
    },
    (error) => {
      log.error(
        "Read receipt subscription error",
        ctx({ chatId, otherUid, error }),
      );
      callback(null);
    },
  );
}

// =============================================================================
// Private Member State
// =============================================================================

/**
 * Get private member state
 *
 * Only the owner ({uid}) can read this document.
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @returns Private state or null if not found
 */
export async function getDMMemberPrivate(
  chatId: string,
  uid: string,
): Promise<MemberStatePrivate | null> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
      uid: data.uid,
      archived: data.archived,
      mutedUntil: data.mutedUntil,
      notifyLevel: data.notifyLevel,
      customNotifications: data.customNotifications,
      lastSeenAtPrivate: toMillis(data.lastSeenAtPrivate) || Date.now(),
      lastMarkedUnreadAt: toMillis(data.lastMarkedUnreadAt),
    };
  } catch (error: unknown) {
    // Only log as error if it's not a permission/not-found error
    // (MembersPrivate docs may not exist until user sets preferences)
    const errorCode =
      error instanceof Error && "code" in error
        ? (error as { code: string }).code
        : undefined;
    const isExpectedError =
      errorCode === "permission-denied" || errorCode === "not-found";

    if (isExpectedError) {
      log.debug("Private member state not available", ctx({ chatId, uid }));
    } else {
      log.error(
        "Failed to get private member state",
        error,
        ctx({ chatId, uid }),
      );
    }
    return null;
  }
}

/**
 * Initialize or update private member state
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @param data - Partial state to merge
 */
export async function setDMMemberPrivate(
  chatId: string,
  uid: string,
  data: Partial<MemberStatePrivate>,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    await setDoc(
      docRef,
      {
        uid,
        ...data,
      },
      { merge: true },
    );

    log.debug("Updated private member state", ctx({ chatId, uid }));
  } catch (error) {
    log.error(
      "Failed to set private member state",
      ctx({ chatId, uid, error }),
    );
    throw error;
  }
}

/**
 * Update last seen timestamp (private)
 *
 * Call this when user opens/views a chat. Used for unread badge computation.
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 */
export async function updateLastSeen(
  chatId: string,
  uid: string,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    await setDoc(
      docRef,
      {
        uid,
        lastSeenAtPrivate: Date.now(),
      },
      { merge: true },
    );

    log.debug("Updated last seen", ctx({ chatId, uid }));
  } catch (error) {
    log.error("Failed to update last seen", ctx({ chatId, uid, error }));
    // Don't throw - not critical
  }
}

/**
 * Set mute status for a chat
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @param mutedUntil - null (unmute), -1 (forever), or timestamp
 */
export async function setMuted(
  chatId: string,
  uid: string,
  mutedUntil: number | null,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    await setDoc(
      docRef,
      {
        uid,
        mutedUntil,
      },
      { merge: true },
    );

    log.info("Set mute status", ctx({ chatId, mutedUntil }));
  } catch (error) {
    log.error("Failed to set mute", ctx({ chatId, uid, error }));
    throw error;
  }
}

/**
 * Set archive status for a chat
 *
 * Archived chats are hidden from the main chat list.
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @param archived - Whether to archive
 */
export async function setArchived(
  chatId: string,
  uid: string,
  archived: boolean,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    await setDoc(
      docRef,
      {
        uid,
        archived,
      },
      { merge: true },
    );

    log.info("Set archive status", ctx({ chatId, archived }));
  } catch (error) {
    log.error("Failed to set archive", ctx({ chatId, uid, error }));
    throw error;
  }
}

/**
 * Set notification level for a chat
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @param level - "all" | "mentions" | "none"
 */
export async function setNotifyLevel(
  chatId: string,
  uid: string,
  level: "all" | "mentions" | "none",
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    await setDoc(
      docRef,
      {
        uid,
        notifyLevel: level,
      },
      { merge: true },
    );

    log.info("Set notify level", ctx({ chatId, level }));
  } catch (error) {
    log.error("Failed to set notify level", ctx({ chatId, uid, error }));
    throw error;
  }
}

/**
 * Set read receipts preference for a DM chat
 * When disabled, lastReadAtPublic won't be updated for the other user
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @param sendReadReceipts - Whether to send read receipts
 */
export async function setReadReceipts(
  chatId: string,
  uid: string,
  sendReadReceipts: boolean,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    await setDoc(
      docRef,
      {
        uid,
        sendReadReceipts,
      },
      { merge: true },
    );

    log.info("Set read receipts", ctx({ chatId, sendReadReceipts }));
  } catch (error) {
    log.error("Failed to set read receipts", ctx({ chatId, uid, error }));
    throw error;
  }
}

/**
 * Mark chat as unread
 *
 * Sets lastMarkedUnreadAt to force unread badge until next view.
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 */
export async function markAsUnread(chatId: string, uid: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    await setDoc(
      docRef,
      {
        uid,
        lastMarkedUnreadAt: Date.now(),
      },
      { merge: true },
    );

    log.info("Marked as unread", ctx({ chatId }));
  } catch (error) {
    log.error("Failed to mark as unread", ctx({ chatId, uid, error }));
    throw error;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if chat is muted for user
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @returns true if muted, false otherwise
 */
export async function isChatMuted(
  chatId: string,
  uid: string,
): Promise<boolean> {
  const priv = await getDMMemberPrivate(chatId, uid);
  if (!priv || priv.mutedUntil === null || priv.mutedUntil === undefined) {
    return false;
  }
  // -1 means muted forever
  if (priv.mutedUntil === -1) return true;
  // Check if mute has expired
  return priv.mutedUntil > Date.now();
}

/**
 * Check if chat is archived for user
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @returns true if archived, false otherwise
 */
export async function isChatArchived(
  chatId: string,
  uid: string,
): Promise<boolean> {
  const priv = await getDMMemberPrivate(chatId, uid);
  return priv?.archived ?? false;
}

/**
 * Get notification level for chat
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @returns Notification level or "all" if not set
 */
export async function getNotifyLevel(
  chatId: string,
  uid: string,
): Promise<"all" | "mentions" | "none"> {
  const priv = await getDMMemberPrivate(chatId, uid);
  return priv?.notifyLevel ?? "all";
}

/**
 * Check if chat has unread messages
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @param lastMessageAt - Timestamp of last message in chat
 * @returns true if unread, false otherwise
 */
export async function hasUnreadMessages(
  chatId: string,
  uid: string,
  lastMessageAt: number,
): Promise<boolean> {
  const priv = await getDMMemberPrivate(chatId, uid);

  if (!priv) return true; // No state = unread

  // Check manual "mark as unread"
  if (
    priv.lastMarkedUnreadAt &&
    priv.lastMarkedUnreadAt > priv.lastSeenAtPrivate
  ) {
    return true;
  }

  // Compare last seen with last message
  return lastMessageAt > priv.lastSeenAtPrivate;
}

/**
 * Initialize member state when user joins/creates a chat
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 */
export async function initializeMemberState(
  chatId: string,
  uid: string,
): Promise<void> {
  const now = Date.now();

  // Initialize public state
  await setDMMemberPublic(chatId, uid, {
    uid,
    joinedAt: now,
  });

  // Initialize private state
  await setDMMemberPrivate(chatId, uid, {
    uid,
    lastSeenAtPrivate: now,
    notifyLevel: "all",
  });

  log.info("Initialized member state", ctx({ chatId, uid }));
}

// =============================================================================
// Pinning Functions (Inbox Overhaul)
// =============================================================================

/**
 * Pin or unpin a DM conversation
 *
 * When pinned, the conversation appears at the top of the inbox.
 * The pinnedAt timestamp is used for sorting multiple pinned conversations.
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @param pinned - Whether to pin (true) or unpin (false)
 */
export async function setDMPinned(
  chatId: string,
  uid: string,
  pinned: boolean,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    await setDoc(
      docRef,
      {
        uid,
        pinnedAt: pinned ? Date.now() : null,
      },
      { merge: true },
    );

    log.info("Set DM pinned", ctx({ chatId, pinned }));
  } catch (error) {
    log.error("Failed to set DM pinned", ctx({ chatId, uid, error }));
    throw error;
  }
}

/**
 * Check if a DM conversation is pinned
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 * @returns Pinned timestamp or null
 */
export async function getDMPinnedAt(
  chatId: string,
  uid: string,
): Promise<number | null> {
  const priv = await getDMMemberPrivate(chatId, uid);
  return priv?.pinnedAt ?? null;
}

// =============================================================================
// Soft Delete Functions (Inbox Overhaul)
// =============================================================================

/**
 * Soft delete a DM conversation
 *
 * This hides the conversation from the inbox without deleting any messages.
 * The conversation will reappear when a new message arrives.
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 */
export async function softDeleteDM(chatId: string, uid: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    await setDoc(
      docRef,
      {
        uid,
        deletedAt: Date.now(),
        hiddenUntilNewMessage: true,
        // Also unpin and unarchive
        pinnedAt: null,
        archived: false,
      },
      { merge: true },
    );

    log.info("Soft deleted DM", ctx({ chatId }));
  } catch (error) {
    log.error("Failed to soft delete DM", ctx({ chatId, uid, error }));
    throw error;
  }
}

/**
 * Restore a soft-deleted DM conversation
 *
 * Makes the conversation visible again in the inbox.
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 */
export async function restoreDM(chatId: string, uid: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    await setDoc(
      docRef,
      {
        uid,
        deletedAt: null,
        hiddenUntilNewMessage: false,
      },
      { merge: true },
    );

    log.info("Restored DM", ctx({ chatId }));
  } catch (error) {
    log.error("Failed to restore DM", ctx({ chatId, uid, error }));
    throw error;
  }
}

/**
 * Check if a DM conversation is visible (not soft-deleted with hidden flag)
 *
 * @param memberState - Member's private state
 * @returns true if visible, false if hidden
 */
export function isDMVisible(memberState: MemberStatePrivate | null): boolean {
  if (!memberState) return true; // No state = visible (new conversation)

  // Hidden if soft deleted and waiting for new message
  if (memberState.deletedAt && memberState.hiddenUntilNewMessage) {
    return false;
  }

  return true;
}

/**
 * Clear the hidden flag when a new message arrives
 *
 * Call this from the message listener to restore visibility.
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 */
export async function clearHiddenFlag(
  chatId: string,
  uid: string,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    // Only update if currently hidden
    const snapshot = await getDoc(docRef);
    if (snapshot.exists() && snapshot.data().hiddenUntilNewMessage) {
      await setDoc(
        docRef,
        {
          uid,
          hiddenUntilNewMessage: false,
        },
        { merge: true },
      );
      log.debug("Cleared hidden flag", ctx({ chatId, uid }));
    }
  } catch (error) {
    log.error("Failed to clear hidden flag", ctx({ chatId, uid, error }));
    // Don't throw - this is a background operation
  }
}

// =============================================================================
// Mark As Read/Unread Functions (Enhanced)
// =============================================================================

/**
 * Mark DM as read and clear manual unread marker
 *
 * Call this when user opens a conversation.
 *
 * @param chatId - Chat document ID
 * @param uid - User ID
 */
export async function markDMAsRead(chatId: string, uid: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const docRef = doc(db, "Chats", chatId, "MembersPrivate", uid);

    await setDoc(
      docRef,
      {
        uid,
        lastSeenAtPrivate: Date.now(),
        lastMarkedUnreadAt: null,
      },
      { merge: true },
    );

    log.debug("Marked DM as read", ctx({ chatId, uid }));
  } catch (error) {
    log.error("Failed to mark DM as read", ctx({ chatId, uid, error }));
    // Don't throw - not critical
  }
}
