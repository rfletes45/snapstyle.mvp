/**
 * Group Members Service
 *
 * Manages member state for group conversations.
 * Mirrors chatMembers.ts structure for DMs but handles group-specific logic.
 *
 * @module services/groupMembers
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import { MemberStatePrivate, MemberStatePublic } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

// Type alias for notify level
type NotifyLevel = "all" | "mentions" | "none";

// Lazy initialization - don't call at module load time
const getDb = () => getFirestoreInstance();

const log = createLogger("groupMembers");
const GROUP_TYPING_TIMEOUT_MS = 5000;

function normalizeGroupTypingAt(data: Record<string, unknown>): number | undefined {
  if (typeof data.typingAt === "number" && data.typingAt > 0) {
    return data.typingAt;
  }

  const typingExpiresAt =
    typeof data.typingExpiresAt === "number" ? data.typingExpiresAt : 0;
  if (typingExpiresAt > Date.now()) {
    return typingExpiresAt - GROUP_TYPING_TIMEOUT_MS;
  }

  return undefined;
}

function isGroupMemberTyping(
  data: Record<string, unknown>,
  now: number = Date.now(),
): boolean {
  const typingAt = normalizeGroupTypingAt(data);
  if (typingAt && now - typingAt < GROUP_TYPING_TIMEOUT_MS) {
    return true;
  }

  const typingExpiresAt =
    typeof data.typingExpiresAt === "number" ? data.typingExpiresAt : 0;
  return typingExpiresAt > now;
}

function normalizeGroupMemberPublic(
  uid: string,
  data: Record<string, unknown>,
): MemberStatePublic {
  return {
    uid: typeof data.uid === "string" ? data.uid : uid,
    role:
      data.role === "owner" || data.role === "admin" || data.role === "member"
        ? data.role
        : undefined,
    joinedAt: typeof data.joinedAt === "number" ? data.joinedAt : Date.now(),
    lastReadAtPublic:
      typeof data.lastReadAtPublic === "number"
        ? data.lastReadAtPublic
        : undefined,
    lastDeliveredAtPublic:
      typeof data.lastDeliveredAtPublic === "number"
        ? data.lastDeliveredAtPublic
        : undefined,
    typingAt: normalizeGroupTypingAt(data),
  };
}

async function setGroupMemberPrivateFields(
  groupId: string,
  uid: string,
  fields: Partial<MemberStatePrivate>,
): Promise<void> {
  await setDoc(
    getMemberPrivateRef(groupId, uid),
    {
      uid,
      ...fields,
    },
    { merge: true },
  );
}

// =============================================================================
// Collection References
// =============================================================================

/**
 * Get reference to a group's Members subcollection
 */
function getMembersCollection(groupId: string) {
  return collection(getDb(), "Groups", groupId, "Members");
}

/**
 * Get reference to a group's MembersPrivate subcollection
 */
function getMembersPrivateCollection(groupId: string) {
  return collection(getDb(), "Groups", groupId, "MembersPrivate");
}

/**
 * Get reference to a specific member's public doc
 */
function getMemberPublicRef(groupId: string, uid: string) {
  return doc(getMembersCollection(groupId), uid);
}

/**
 * Get reference to a specific member's private doc
 */
function getMemberPrivateRef(groupId: string, uid: string) {
  return doc(getMembersPrivateCollection(groupId), uid);
}

// =============================================================================
// Public Member State
// =============================================================================

/**
 * Get a member's public state in a group
 */
export async function getGroupMemberPublic(
  groupId: string,
  uid: string,
): Promise<MemberStatePublic | null> {
  try {
    const docSnap = await getDoc(getMemberPublicRef(groupId, uid));
    if (!docSnap.exists()) return null;
    return normalizeGroupMemberPublic(uid, docSnap.data());
  } catch (error) {
    log.error("Failed to get group member public state", error);
    throw error;
  }
}

/**
 * Get all members' public state for a group
 */
export async function getAllGroupMembersPublic(
  groupId: string,
): Promise<Map<string, MemberStatePublic>> {
  try {
    const snapshot = await getDocs(getMembersCollection(groupId));
    const members = new Map<string, MemberStatePublic>();

    snapshot.forEach((doc) => {
      members.set(doc.id, normalizeGroupMemberPublic(doc.id, doc.data()));
    });

    return members;
  } catch (error) {
    log.error("Failed to get all group members", error);
    throw error;
  }
}

/**
 * Initialize a member's public state when they join a group
 */
export async function initializeGroupMember(
  groupId: string,
  uid: string,
  displayName?: string,
  photoURL?: string,
  role: "owner" | "admin" | "member" = "member",
): Promise<void> {
  try {
    const memberData: MemberStatePublic = {
      uid,
      role,
      joinedAt: Date.now(),
      typingAt: 0,
    };

    await setDoc(getMemberPublicRef(groupId, uid), memberData);

    // Also initialize private state
    const privateData: MemberStatePrivate = {
      uid,
      lastSeenAtPrivate: 0,
      archived: false,
      notifyLevel: "all",
    };

    await setDoc(getMemberPrivateRef(groupId, uid), privateData);

    log.info("Initialized group member", {
      operation: "initMember",
      data: { groupId, uid, role },
    });
  } catch (error) {
    log.error("Failed to initialize group member", error);
    throw error;
  }
}

/**
 * Update member's role in group
 */
export async function updateGroupMemberRole(
  groupId: string,
  uid: string,
  role: "admin" | "moderator" | "member",
): Promise<void> {
  try {
    await updateDoc(getMemberPublicRef(groupId, uid), { role });
    log.info("Updated group member role", {
      operation: "updateRole",
      data: { groupId, uid, role },
    });
  } catch (error) {
    log.error("Failed to update member role", error);
    throw error;
  }
}

// =============================================================================
// Private Member State
// =============================================================================

/**
 * Get a member's private state in a group
 */
export async function getGroupMemberPrivate(
  groupId: string,
  uid: string,
): Promise<MemberStatePrivate | null> {
  try {
    const docSnap = await getDoc(getMemberPrivateRef(groupId, uid));
    if (!docSnap.exists()) return null;
    return docSnap.data() as MemberStatePrivate;
  } catch (error) {
    log.error("Failed to get group member private state", error);
    throw error;
  }
}

/**
 * Update read watermark for a group
 */
export async function updateGroupReadWatermark(
  groupId: string,
  uid: string,
  serverReceivedAt: number,
): Promise<void> {
  try {
    // Use the max of serverReceivedAt and Date.now() to ensure
    // lastSeenAtPrivate >= lastMessageAt (see chatMembers.ts for details)
    await setGroupMemberPrivateFields(groupId, uid, {
      lastSeenAtPrivate: Math.max(serverReceivedAt, Date.now()),
      lastMarkedUnreadAt: null, // Clear manual unread marker
    });
    log.debug("Updated group read watermark", { operation: "updateWatermark" });
  } catch (error) {
    log.error("Failed to update group read watermark", error);
    throw error;
  }
}

/**
 * Update delivery watermark for a group (Segment 2 — CHAT_DELIVERY_ACKS)
 *
 * Writes `lastDeliveredAtPublic` to the caller's public Members doc.
 * Monotonically increasing — Firestore rules enforce >= existing value.
 *
 * @param groupId - Group document ID
 * @param uid - Current user's UID
 * @param timestamp - Max serverReceivedAt from delivered messages
 */
export async function updateGroupDeliveryWatermark(
  groupId: string,
  uid: string,
  timestamp: number,
): Promise<void> {
  if (!CHAT_FEATURES.CHAT_DELIVERY_ACKS) return;

  try {
    await setDoc(
      getMemberPublicRef(groupId, uid),
      {
        uid,
        lastDeliveredAtPublic: timestamp,
      },
      { merge: true },
    );
    log.debug("Updated group delivery watermark", {
      operation: "updateDeliveryWatermark",
      data: { groupId, timestamp },
    });
  } catch (error) {
    log.error("Failed to update group delivery watermark", error);
    // Non-critical — don't throw
  }
}

/**
 * Update typing indicator in group
 */
export async function updateGroupTypingIndicator(
  groupId: string,
  uid: string,
  isTyping: boolean,
): Promise<void> {
  try {
    const now = Date.now();
    await setDoc(
      getMemberPublicRef(groupId, uid),
      {
        uid,
        typingAt: isTyping ? now : 0,
        // Transitional compatibility for older group typing readers.
        typingExpiresAt: isTyping ? now + GROUP_TYPING_TIMEOUT_MS : 0,
      },
      { merge: true },
    );
  } catch (error) {
    log.error("Failed to update typing indicator", error);
    throw error;
  }
}

/**
 * Subscribe to typing status of all members in a group.
 *
 * Watches the Members subcollection and emits an array of UIDs whose
 * canonical `typingAt` watermark is still fresh. Legacy `typingExpiresAt`
 * rows are still supported during migration.
 * The current user is always excluded.
 *
 * @param groupId - Group document ID
 * @param currentUid - Current user's UID (filtered out)
 * @param callback - Called with array of typing user UIDs
 * @returns Unsubscribe function
 */
export function subscribeToGroupTyping(
  groupId: string,
  currentUid: string,
  callback: (typingUids: string[]) => void,
): () => void {
  const colRef = getMembersCollection(groupId);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const now = Date.now();
      const typingUids: string[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const uid = data.uid || docSnap.id;

        // Skip current user
        if (uid === currentUid) return;

        if (isGroupMemberTyping(data, now)) {
          typingUids.push(uid);
        }
      });

      callback(typingUids);
    },
    (error) => {
      log.error("Group typing subscription error", {
        operation: "subscribeToGroupTyping",
        data: { groupId, error },
      });
      callback([]);
    },
  );
}

/**
 * Set muted state for a group
 */
export async function setGroupMuted(
  groupId: string,
  uid: string,
  muted: boolean,
  mutedUntil?: number,
): Promise<void> {
  try {
    await setGroupMemberPrivateFields(groupId, uid, {
      mutedUntil: muted ? (mutedUntil ?? -1) : null,
    });
    log.info("Set group muted", {
      operation: "setMuted",
      data: { groupId, muted, mutedUntil: muted ? (mutedUntil ?? -1) : null },
    });
  } catch (error) {
    log.error("Failed to set group muted", error);
    throw error;
  }
}

/**
 * Set archived state for a group
 */
export async function setGroupArchived(
  groupId: string,
  uid: string,
  archived: boolean,
): Promise<void> {
  try {
    await setGroupMemberPrivateFields(groupId, uid, { archived });
    log.info("Set group archived", {
      operation: "setArchived",
      data: { groupId, archived },
    });
  } catch (error) {
    log.error("Failed to set group archived", error);
    throw error;
  }
}

/**
 * Set notification level for a group
 */
export async function setGroupNotifyLevel(
  groupId: string,
  uid: string,
  notifyLevel: NotifyLevel,
): Promise<void> {
  try {
    await setGroupMemberPrivateFields(groupId, uid, { notifyLevel });
    log.info("Set group notify level", {
      operation: "setNotifyLevel",
      data: { groupId, notifyLevel },
    });
  } catch (error) {
    log.error("Failed to set group notify level", error);
    throw error;
  }
}

/**
 * Set read receipts preference for a group
 * When disabled, lastReadAtPublic won't be updated for other members
 */
export async function setGroupReadReceipts(
  groupId: string,
  uid: string,
  sendReadReceipts: boolean,
): Promise<void> {
  try {
    await setGroupMemberPrivateFields(groupId, uid, { sendReadReceipts });
    log.info("Set group read receipts", {
      operation: "setReadReceipts",
      data: { groupId, sendReadReceipts },
    });
  } catch (error) {
    log.error("Failed to set group read receipts", error);
    throw error;
  }
}

/**
 * Pin/unpin a group conversation
 */
export async function setGroupPinned(
  groupId: string,
  uid: string,
  pinned: boolean,
): Promise<void> {
  try {
    await setGroupMemberPrivateFields(groupId, uid, {
      pinnedAt: pinned ? Date.now() : null,
    });
    log.info("Set group pinned", {
      operation: "setPinned",
      data: { groupId, pinned },
    });
  } catch (error) {
    log.error("Failed to set group pinned", error);
    throw error;
  }
}

/**
 * Toggle whether to show other members' custom chat styles (bubble colors, fonts).
 * When disabled, all incoming messages render with theme defaults.
 */
export async function setGroupShowMemberChatStyles(
  groupId: string,
  uid: string,
  showMemberChatStyles: boolean,
): Promise<void> {
  try {
    await setGroupMemberPrivateFields(groupId, uid, {
      showMemberChatStyles,
    });
    log.info("Set group showMemberChatStyles", {
      operation: "setShowMemberChatStyles",
      data: { groupId, showMemberChatStyles },
    });
  } catch (error) {
    log.error("Failed to set group showMemberChatStyles", error);
    throw error;
  }
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to all members' public state in a group
 */
export function subscribeToGroupMembers(
  groupId: string,
  callback: (members: Map<string, MemberStatePublic>) => void,
): () => void {
  const q = getMembersCollection(groupId);

  return onSnapshot(
    q,
    (snapshot) => {
      const members = new Map<string, MemberStatePublic>();
      snapshot.forEach((doc) => {
        members.set(doc.id, normalizeGroupMemberPublic(doc.id, doc.data()));
      });
      callback(members);
    },
    (error) => {
      log.error("Group members subscription error", error);
    },
  );
}

/**
 * Subscribe to a member's private state
 */
export function subscribeToGroupMemberPrivate(
  groupId: string,
  uid: string,
  callback: (state: MemberStatePrivate | null) => void,
): () => void {
  const ref = getMemberPrivateRef(groupId, uid);

  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as MemberStatePrivate);
      } else {
        callback(null);
      }
    },
    (error) => {
      log.error("Member private state subscription error", error);
    },
  );
}

// =============================================================================
// Typing Indicators
// =============================================================================

/**
 * Get currently typing members in a group
 */
export async function getTypingMembers(groupId: string): Promise<string[]> {
  try {
    const now = Date.now();
    const members = await getAllGroupMembersPublic(groupId);

    const typingUids: string[] = [];
    members.forEach((state, uid) => {
      if (state.typingAt && now - state.typingAt < GROUP_TYPING_TIMEOUT_MS) {
        typingUids.push(uid);
      }
    });

    return typingUids;
  } catch (error) {
    log.error("Failed to get typing members", error);
    return [];
  }
}

// =============================================================================
// Unread Count Calculation
// =============================================================================

/**
 * Calculate unread count for a group
 *
 * Note: Requires conversation's lastMessageAt to compare against watermark
 */
export async function calculateGroupUnreadCount(
  groupId: string,
  uid: string,
  lastMessageAt: number,
): Promise<number> {
  try {
    const privateState = await getGroupMemberPrivate(groupId, uid);
    if (!privateState) return 0;

    // If watermark is >= lastMessageAt, no unreads
    if (privateState.lastSeenAtPrivate >= lastMessageAt) {
      return 0;
    }

    // NOTE: Implement actual count query (H5)
    // For now, return 1 to indicate "has unreads"
    return 1;
  } catch (error) {
    log.error("Failed to calculate unread count", error);
    return 0;
  }
}

// =============================================================================
// Soft Delete Functions (Inbox Overhaul)
// =============================================================================

/**
 * Soft delete a group conversation (leave + hide)
 *
 * This removes the user from the group's member list and hides
 * the conversation from their inbox. The conversation will NOT
 * reappear when new messages arrive (unlike DMs).
 *
 * Note: Owners must transfer ownership before calling this.
 *
 * @param groupId - Group document ID
 * @param uid - User ID
 * @throws Error if user is the group owner
 */
export async function leaveAndDeleteGroup(
  groupId: string,
  uid: string,
): Promise<void> {
  try {
    // Get member state to check role
    const memberState = await getGroupMemberPrivate(groupId, uid);

    // Check if user is owner
    const publicState = await getGroupMemberPublic(groupId, uid);
    if (publicState?.role === "owner") {
      throw new Error(
        "Owners must transfer ownership before leaving the group",
      );
    }

    // Update private state with soft delete
    await updateDoc(getMemberPrivateRef(groupId, uid), {
      deletedAt: Date.now(),
      hiddenUntilNewMessage: true,
      pinnedAt: null,
      archived: false,
    });

    // Remove from public members list
    // Note: We don't actually delete the member doc to preserve history
    // The group's memberIds array should be updated via a separate call

    log.info("Left and soft deleted group", {
      operation: "leaveAndDelete",
      data: { groupId, uid },
    });
  } catch (error) {
    log.error("Failed to leave and delete group", error);
    throw error;
  }
}

/**
 * Restore a soft-deleted group conversation
 *
 * Note: This only restores visibility, not group membership.
 * User must rejoin the group separately.
 *
 * @param groupId - Group document ID
 * @param uid - User ID
 */
export async function restoreGroup(
  groupId: string,
  uid: string,
): Promise<void> {
  try {
    await updateDoc(getMemberPrivateRef(groupId, uid), {
      deletedAt: null,
      hiddenUntilNewMessage: false,
    });

    log.info("Restored group", {
      operation: "restore",
      data: { groupId, uid },
    });
  } catch (error) {
    log.error("Failed to restore group", error);
    throw error;
  }
}

/**
 * Check if a group conversation is visible (not soft-deleted)
 *
 * @param memberState - Member's private state
 * @returns true if visible, false if hidden
 */
export function isGroupVisible(
  memberState: MemberStatePrivate | null,
): boolean {
  if (!memberState) return true; // No state = visible

  // Hidden if soft deleted and waiting for new message
  if (memberState.deletedAt && memberState.hiddenUntilNewMessage) {
    return false;
  }

  return true;
}

// =============================================================================
// Mark As Read/Unread Functions (Inbox Overhaul)
// =============================================================================

/**
 * Mark group as unread
 *
 * Sets a manual marker to force the unread badge to show.
 *
 * @param groupId - Group document ID
 * @param uid - User ID
 */
export async function markGroupAsUnread(
  groupId: string,
  uid: string,
): Promise<void> {
  try {
    await updateDoc(getMemberPrivateRef(groupId, uid), {
      lastMarkedUnreadAt: Date.now(),
    });

    log.info("Marked group as unread", {
      operation: "markUnread",
      data: { groupId },
    });
  } catch (error) {
    log.error("Failed to mark group as unread", error);
    throw error;
  }
}

/**
 * Mark group as read and clear manual unread marker
 *
 * Call this when user opens a conversation.
 *
 * @param groupId - Group document ID
 * @param uid - User ID
 */
export async function markGroupAsRead(
  groupId: string,
  uid: string,
): Promise<void> {
  try {
    // Use setDoc with merge to handle case where doc may not exist
    // or to create it with proper fields if needed
    await setDoc(
      getMemberPrivateRef(groupId, uid),
      {
        uid, // Include uid field for Firestore rules validation
        lastSeenAtPrivate: Date.now(),
        lastMarkedUnreadAt: null,
      },
      { merge: true },
    );

    log.debug("Marked group as read", {
      operation: "markRead",
      data: { groupId, uid },
    });
  } catch (error) {
    log.error("Failed to mark group as read", error);
    // Don't throw - not critical
  }
}
