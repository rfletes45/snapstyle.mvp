/**
 * Group Members Service
 *
 * Manages member state for group conversations.
 * Mirrors chatMembers.ts structure for DMs but handles group-specific logic.
 *
 * @module services/groupMembers
 */

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
    return docSnap.data() as MemberStatePublic;
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
      members.set(doc.id, doc.data() as MemberStatePublic);
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

/**
 * Remove a member from a group
 */
export async function removeGroupMember(
  groupId: string,
  uid: string,
): Promise<void> {
  // NOTE: Implement in H6 - requires batch delete of both docs
  log.warn("removeGroupMember: Not yet implemented (H6)");
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
    await updateDoc(getMemberPrivateRef(groupId, uid), {
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
 * Update typing indicator in group
 */
export async function updateGroupTypingIndicator(
  groupId: string,
  uid: string,
  isTyping: boolean,
): Promise<void> {
  try {
    const expiresAt = isTyping ? Date.now() + 5000 : 0;
    await updateDoc(getMemberPublicRef(groupId, uid), {
      typingExpiresAt: expiresAt,
    });
  } catch (error) {
    log.error("Failed to update typing indicator", error);
    throw error;
  }
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
    await updateDoc(getMemberPrivateRef(groupId, uid), {
      muted,
      mutedUntil: mutedUntil || null,
    });
    log.info("Set group muted", {
      operation: "setMuted",
      data: { groupId, muted },
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
    await updateDoc(getMemberPrivateRef(groupId, uid), { archived });
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
    await updateDoc(getMemberPrivateRef(groupId, uid), { notifyLevel });
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
    await updateDoc(getMemberPrivateRef(groupId, uid), { sendReadReceipts });
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
    await updateDoc(getMemberPrivateRef(groupId, uid), {
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
        members.set(doc.id, doc.data() as MemberStatePublic);
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
    const TYPING_TIMEOUT_MS = 5000;

    const typingUids: string[] = [];
    members.forEach((state, uid) => {
      if (state.typingAt && now - state.typingAt < TYPING_TIMEOUT_MS) {
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
