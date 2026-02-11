/**
 * Groups Service
 *
 * Handles:
 * - Group creation and management
 * - Group invites (send, accept, decline)
 * - Group membership (join, leave, roles)
 * - Group messages (send, fetch, pagination)
 * - Real-time subscriptions
 *
 * Security:
 * - Blocked users cannot be invited or added to groups
 * - Only owner/admin can manage roles and remove members
 * - Members can only leave (not remove others unless admin)
 */

import {
  CreateGroupInput,
  Group,
  GROUP_LIMITS,
  GroupInvite,
  GroupMember,
  GroupMessage,
  GroupRole,
} from "@/types/models";
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { isUserBlocked } from "./blocking";
import { getFirestoreInstance } from "./firebase";
import { getUserProfileByUid } from "./friends";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/groups");

interface DateLikeTimestamp {
  toMillis?: () => number;
  getTime?: () => number;
}
// =============================================================================
// Constants
// =============================================================================

/** Default number of messages to load per page */
const DEFAULT_PAGE_SIZE = 30;

/** Invite expiry in milliseconds (7 days) */
const INVITE_EXPIRY_MS = GROUP_LIMITS.INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// =============================================================================
// Group Creation
// =============================================================================

/**
 * Create a new group
 * @param creatorUid - UID of the user creating the group
 * @param input - Group creation input (name, initial member UIDs)
 * @returns The created group
 */
export async function createGroup(
  creatorUid: string,
  input: CreateGroupInput,
): Promise<Group> {
  const db = getFirestoreInstance();

  // Validate name
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Group name is required");
  }
  if (input.name.length > GROUP_LIMITS.MAX_NAME_LENGTH) {
    throw new Error(
      `Group name must be ${GROUP_LIMITS.MAX_NAME_LENGTH} characters or less`,
    );
  }

  // Validate member count (must have at least MIN_MEMBERS including creator)
  const totalMembers = input.memberUids.length + 1; // +1 for creator
  if (totalMembers < GROUP_LIMITS.MIN_MEMBERS) {
    throw new Error(
      `Groups must have at least ${GROUP_LIMITS.MIN_MEMBERS} members`,
    );
  }
  if (totalMembers > GROUP_LIMITS.MAX_MEMBERS) {
    throw new Error(
      `Groups can have at most ${GROUP_LIMITS.MAX_MEMBERS} members`,
    );
  }

  // Get creator profile
  const creatorProfile = await getUserProfileByUid(creatorUid);
  if (!creatorProfile) {
    throw new Error("Creator profile not found");
  }

  const now = Date.now();
  const groupRef = doc(collection(db, "Groups"));
  const groupId = groupRef.id;

  const batch = writeBatch(db);

  // Create group document with memberIds array for queries
  const groupData: Omit<Group, "id"> & { memberIds: string[] } = {
    name: input.name.trim(),
    ownerId: creatorUid,
    memberIds: [creatorUid], // Track members for array-contains queries
    memberCount: 1, // Just creator initially
    createdAt: now,
    updatedAt: now,
  };

  batch.set(groupRef, groupData);

  // Add creator as owner member
  const creatorMemberRef = doc(db, "Groups", groupId, "Members", creatorUid);
  const creatorMemberData: Omit<GroupMember, "uid"> = {
    role: "owner",
    joinedAt: now,
    displayName: creatorProfile.displayName,
    username: creatorProfile.username,
    avatarConfig: creatorProfile.avatarConfig,
    profilePictureUrl: creatorProfile.profilePicture?.url || null,
    decorationId: creatorProfile.avatarDecoration?.equippedId || null,
  };
  batch.set(creatorMemberRef, { uid: creatorUid, ...creatorMemberData });

  // Add system message for group creation
  const systemMessageRef = doc(collection(db, "Groups", groupId, "Messages"));
  const systemMessage: Omit<GroupMessage, "id"> = {
    groupId,
    sender: creatorUid,
    senderDisplayName: creatorProfile.displayName,
    type: "system",
    content: `${creatorProfile.displayName} created the group`,
    createdAt: now,
    systemType: "group_created",
  };
  batch.set(systemMessageRef, systemMessage);

  await batch.commit();

  logger.info(`✅ [groups] Created group "${input.name}" with ID: ${groupId}`);

  // Send invites to initial members (non-blocking)
  for (const memberUid of input.memberUids) {
    sendGroupInvite(groupId, input.name, creatorUid, memberUid).catch((error) =>
      logger.error(`Failed to send invite to ${memberUid}:`, error),
    );
  }

  return {
    id: groupId,
    ...groupData,
  };
}

// =============================================================================
// Group Invites
// =============================================================================

/**
 * Send a group invite to a user
 */
export async function sendGroupInvite(
  groupId: string,
  groupName: string,
  fromUid: string,
  toUid: string,
): Promise<GroupInvite> {
  const db = getFirestoreInstance();

  logger.info(
    `[sendGroupInvite] Starting invite from ${fromUid} to ${toUid} for group ${groupId}`,
  );

  // Check if target is blocked by sender or vice versa
  logger.info(`[sendGroupInvite] Step 1: Checking blocked status...`);
  const blocked = await isUserBlocked(fromUid, toUid);
  const blockedBy = await isUserBlocked(toUid, fromUid);
  logger.info(
    `[sendGroupInvite] Step 1 complete: blocked=${blocked}, blockedBy=${blockedBy}`,
  );
  if (blocked || blockedBy) {
    throw new Error("Cannot invite this user");
  }

  // Check if user is already a member
  logger.info(
    `[sendGroupInvite] Step 2: Checking if ${toUid} is already a member...`,
  );
  const memberDoc = await getDoc(doc(db, "Groups", groupId, "Members", toUid));
  logger.info(
    `[sendGroupInvite] Step 2 complete: exists=${memberDoc.exists()}`,
  );
  if (memberDoc.exists()) {
    throw new Error("User is already a member of this group");
  }

  // Check for existing pending invite (that hasn't expired)
  logger.info(
    `[sendGroupInvite] Step 3: Checking for existing pending invites...`,
  );
  const now = Date.now();
  const existingInvites = await getDocs(
    query(
      collection(db, "GroupInvites"),
      where("groupId", "==", groupId),
      where("toUid", "==", toUid),
      where("status", "==", "pending"),
    ),
  );

  // Filter out expired invites
  const validPendingInvites = existingInvites.docs.filter((docSnap) => {
    const data = docSnap.data();
    const expiresAt =
      data.expiresAt instanceof Timestamp
        ? data.expiresAt.toMillis()
        : data.expiresAt;
    return expiresAt > now;
  });

  logger.info(
    `[sendGroupInvite] Step 3 complete: existingInvites=${existingInvites.docs.length}, validPending=${validPendingInvites.length}`,
  );

  if (validPendingInvites.length > 0) {
    throw new Error("User already has a pending invite to this group");
  }

  // Get sender profile
  logger.info(`[sendGroupInvite] Step 4: Getting sender profile...`);
  const senderProfile = await getUserProfileByUid(fromUid);
  logger.info(`[sendGroupInvite] Step 4 complete: found=${!!senderProfile}`);
  if (!senderProfile) {
    throw new Error("Sender profile not found");
  }

  const inviteRef = doc(collection(db, "GroupInvites"));

  const inviteData: Omit<GroupInvite, "id"> = {
    groupId,
    groupName,
    fromUid,
    fromDisplayName: senderProfile.displayName,
    toUid,
    status: "pending",
    createdAt: now,
    expiresAt: now + INVITE_EXPIRY_MS,
  };

  logger.info(
    `[sendGroupInvite] Step 5: Creating invite document...`,
    inviteData,
  );
  await setDoc(inviteRef, inviteData);
  logger.info(`[sendGroupInvite] Step 5 complete: invite created`);

  logger.info(`✅ [groups] Sent invite to ${toUid} for group ${groupId}`);

  return {
    id: inviteRef.id,
    ...inviteData,
  };
}

/**
 * Get pending invites for a user
 */
export async function getPendingInvites(uid: string): Promise<GroupInvite[]> {
  const db = getFirestoreInstance();
  const now = Date.now();

  logger.info(`[getPendingInvites] Fetching invites for uid: ${uid}`);

  const invitesQuery = query(
    collection(db, "GroupInvites"),
    where("toUid", "==", uid),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(invitesQuery);
  logger.info(
    `[getPendingInvites] Raw snapshot count: ${snapshot.docs.length}`,
  );

  const invites = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      logger.info(`[getPendingInvites] Doc ${doc.id}:`, data);
      return {
        id: doc.id,
        ...data,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : data.createdAt,
        expiresAt:
          data.expiresAt instanceof Timestamp
            ? data.expiresAt.toMillis()
            : data.expiresAt,
      };
    })
    .filter((invite) => {
      const notExpired = invite.expiresAt > now;
      logger.info(
        `[getPendingInvites] Invite ${invite.id} expiresAt=${invite.expiresAt}, now=${now}, notExpired=${notExpired}`,
      );
      return notExpired;
    }) as GroupInvite[];

  logger.info(`[getPendingInvites] Final invites count: ${invites.length}`);
  return invites;
}

/**
 * Subscribe to pending invites for a user
 */
export function subscribeToPendingInvites(
  uid: string,
  onUpdate: (invites: GroupInvite[]) => void,
): () => void {
  const db = getFirestoreInstance();

  const invitesQuery = query(
    collection(db, "GroupInvites"),
    where("toUid", "==", uid),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    invitesQuery,
    (snapshot) => {
      const now = Date.now();
      const invites = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt:
            doc.data().createdAt instanceof Timestamp
              ? doc.data().createdAt.toMillis()
              : doc.data().createdAt,
          expiresAt:
            doc.data().expiresAt instanceof Timestamp
              ? doc.data().expiresAt.toMillis()
              : doc.data().expiresAt,
        }))
        .filter((invite) => invite.expiresAt > now) as GroupInvite[];

      onUpdate(invites);
    },
    (error) => {
      logger.error("[groups] Error subscribing to invites:", error);
    },
  );
}

/**
 * Accept a group invite
 */
export async function acceptGroupInvite(
  inviteId: string,
  uid: string,
): Promise<void> {
  logger.info("🔵 [acceptGroupInvite] Starting...", { inviteId, uid });

  const db = getFirestoreInstance();

  logger.info("🔵 [acceptGroupInvite] Step 1: Fetching invite document");
  const inviteRef = doc(db, "GroupInvites", inviteId);
  const inviteDoc = await getDoc(inviteRef);

  if (!inviteDoc.exists()) {
    logger.error("❌ [acceptGroupInvite] Invite not found");
    throw new Error("Invite not found");
  }

  const invite = inviteDoc.data() as Omit<GroupInvite, "id">;
  logger.info("🔵 [acceptGroupInvite] Invite data:", invite);

  if (invite.toUid !== uid) {
    logger.error("❌ [acceptGroupInvite] Invite not for this user");
    throw new Error("This invite is not for you");
  }

  if (invite.status !== "pending") {
    logger.error("❌ [acceptGroupInvite] Invite not pending:", invite.status);
    throw new Error("Invite is no longer pending");
  }

  const expiresAt =
    typeof invite.expiresAt === "number"
      ? invite.expiresAt
      : (invite.expiresAt as DateLikeTimestamp | undefined)?.toMillis?.() ??
        (invite.expiresAt as DateLikeTimestamp | undefined)?.getTime?.() ??
        0;

  if (Date.now() > expiresAt) {
    logger.error("❌ [acceptGroupInvite] Invite expired");
    throw new Error("Invite has expired");
  }

  logger.info("🔵 [acceptGroupInvite] Step 2: Fetching group document");
  const groupRef = doc(db, "Groups", invite.groupId);
  const groupDoc = await getDoc(groupRef);

  if (!groupDoc.exists()) {
    logger.error("❌ [acceptGroupInvite] Group not found");
    throw new Error("Group no longer exists");
  }

  const group = groupDoc.data() as Omit<Group, "id">;
  logger.info("🔵 [acceptGroupInvite] Group data:", {
    groupId: invite.groupId,
    memberCount: group.memberCount,
    memberIds: group.memberIds,
  });

  if (group.memberCount >= GROUP_LIMITS.MAX_MEMBERS) {
    logger.error("❌ [acceptGroupInvite] Group is full");
    throw new Error("Group is full");
  }

  logger.info("🔵 [acceptGroupInvite] Step 3: Fetching user profile");
  const userProfile = await getUserProfileByUid(uid);
  if (!userProfile) {
    logger.error("❌ [acceptGroupInvite] User profile not found");
    throw new Error("User profile not found");
  }
  logger.info("🔵 [acceptGroupInvite] User profile:", userProfile.displayName);

  const now = Date.now();
  const batch = writeBatch(db);

  logger.info("🔵 [acceptGroupInvite] Step 4: Preparing batch write");

  // Update invite status
  logger.info("🔵 [acceptGroupInvite] - Updating invite status");
  batch.update(inviteRef, {
    status: "accepted",
    respondedAt: now,
  });

  // Add user as member
  logger.info("🔵 [acceptGroupInvite] - Adding member document");
  const memberRef = doc(db, "Groups", invite.groupId, "Members", uid);
  const memberData: GroupMember = {
    uid,
    role: "member",
    joinedAt: now,
    displayName: userProfile.displayName,
    username: userProfile.username,
    avatarConfig: userProfile.avatarConfig,
    profilePictureUrl: userProfile.profilePicture?.url || null,
    decorationId: userProfile.avatarDecoration?.equippedId || null,
  };
  batch.set(memberRef, memberData);

  // Update group document
  logger.info("🔵 [acceptGroupInvite] - Updating group document");
  batch.update(groupRef, {
    memberIds: [...group.memberIds, uid],
    memberCount: increment(1),
    updatedAt: now,
  });

  // Add system message
  logger.info("🔵 [acceptGroupInvite] - Adding system message");
  const systemMessageRef = doc(
    collection(db, "Groups", invite.groupId, "Messages"),
  );
  const systemMessage: Omit<GroupMessage, "id"> = {
    groupId: invite.groupId,
    sender: uid,
    senderDisplayName: userProfile.displayName,
    type: "system",
    content: `${userProfile.displayName} joined the group`,
    createdAt: now,
    systemType: "member_joined",
  };
  batch.set(systemMessageRef, systemMessage);

  logger.info("🔵 [acceptGroupInvite] Step 5: Committing batch write");
  try {
    await batch.commit();
    logger.info(
      `✅ [acceptGroupInvite] Success! User ${uid} joined group ${invite.groupId}`,
    );
  } catch (error) {
    logger.error("❌ [acceptGroupInvite] Batch commit failed:", error);
    throw error;
  }
}

/**
 * Decline a group invite
 */
export async function declineGroupInvite(
  inviteId: string,
  uid: string,
): Promise<void> {
  const db = getFirestoreInstance();

  const inviteRef = doc(db, "GroupInvites", inviteId);
  const inviteDoc = await getDoc(inviteRef);

  if (!inviteDoc.exists()) {
    throw new Error("Invite not found");
  }

  const invite = inviteDoc.data() as Omit<GroupInvite, "id">;

  if (invite.toUid !== uid) {
    throw new Error("This invite is not for you");
  }

  if (invite.status !== "pending") {
    throw new Error("Invite is no longer pending");
  }

  await updateDoc(inviteRef, {
    status: "declined",
    respondedAt: Date.now(),
  });

  logger.info(`✅ [groups] User ${uid} declined invite ${inviteId}`);
}

// =============================================================================
// Group Membership
// =============================================================================

/**
 * Get all groups a user is a member of
 */
export async function getUserGroups(uid: string): Promise<Group[]> {
  const db = getFirestoreInstance();

  // Query groups where user is a member using memberIds array
  const groupsQuery = query(
    collection(db, "Groups"),
    where("memberIds", "array-contains", uid),
    orderBy("updatedAt", "desc"),
  );

  const groupsSnapshot = await getDocs(groupsQuery);
  const groups: Group[] = [];

  for (const groupDoc of groupsSnapshot.docs) {
    const data = groupDoc.data();
    groups.push({
      id: groupDoc.id,
      name: data.name,
      ownerId: data.ownerId,
      memberIds: data.memberIds || [],
      avatarPath: data.avatarPath,
      memberCount: data.memberCount,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toMillis()
          : data.createdAt,
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toMillis()
          : data.updatedAt,
      lastMessageText: data.lastMessageText,
      lastMessageAt:
        data.lastMessageAt instanceof Timestamp
          ? data.lastMessageAt.toMillis()
          : data.lastMessageAt,
      lastMessageSenderId: data.lastMessageSenderId,
    });
  }

  // Sort by last message time
  return groups.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
}

/**
 * Subscribe to user's groups (for real-time updates)
 */
export function subscribeToUserGroups(
  uid: string,
  onUpdate: (groups: Group[]) => void,
): () => void {
  const db = getFirestoreInstance();

  // Query groups where user is a member (using memberIds array)
  const groupsQuery = query(
    collection(db, "Groups"),
    where("memberIds", "array-contains", uid),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    groupsQuery,
    (snapshot) => {
      const groups: Group[] = [];

      for (const groupDoc of snapshot.docs) {
        const data = groupDoc.data();
        groups.push({
          id: groupDoc.id,
          name: data.name,
          ownerId: data.ownerId,
          memberIds: data.memberIds || [],
          avatarPath: data.avatarPath,
          avatarUrl: data.avatarUrl,
          memberCount: data.memberCount,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : data.createdAt,
          updatedAt:
            data.updatedAt instanceof Timestamp
              ? data.updatedAt.toMillis()
              : data.updatedAt,
          lastMessageText: data.lastMessageText,
          lastMessageAt:
            data.lastMessageAt instanceof Timestamp
              ? data.lastMessageAt.toMillis()
              : data.lastMessageAt,
          lastMessageSenderId: data.lastMessageSenderId,
        });
      }

      onUpdate(groups);
    },
    (error) => {
      logger.error("[groups] Error subscribing to groups:", error);
    },
  );
}

/**
 * Get group details
 */
export async function getGroup(groupId: string): Promise<Group | null> {
  const db = getFirestoreInstance();

  const groupDoc = await getDoc(doc(db, "Groups", groupId));

  if (!groupDoc.exists()) {
    return null;
  }

  const data = groupDoc.data();
  return {
    id: groupDoc.id,
    name: data.name,
    ownerId: data.ownerId,
    memberIds: data.memberIds || [],
    avatarPath: data.avatarPath,
    avatarUrl: data.avatarUrl,
    memberCount: data.memberCount,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toMillis()
        : data.createdAt,
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toMillis()
        : data.updatedAt,
    lastMessageText: data.lastMessageText,
    lastMessageAt:
      data.lastMessageAt instanceof Timestamp
        ? data.lastMessageAt.toMillis()
        : data.lastMessageAt,
    lastMessageSenderId: data.lastMessageSenderId,
  };
}

/**
 * Get group members
 */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const db = getFirestoreInstance();

  const membersQuery = query(
    collection(db, "Groups", groupId, "Members"),
    orderBy("joinedAt", "asc"),
  );

  const snapshot = await getDocs(membersQuery);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: doc.id,
      role: data.role,
      joinedAt:
        data.joinedAt instanceof Timestamp
          ? data.joinedAt.toMillis()
          : data.joinedAt,
      lastReadAt:
        data.lastReadAt instanceof Timestamp
          ? data.lastReadAt.toMillis()
          : data.lastReadAt,
      displayName: data.displayName,
      username: data.username,
      avatarConfig: data.avatarConfig,
      profilePictureUrl: data.profilePictureUrl || null,
      decorationId: data.decorationId || null,
    } as GroupMember;
  });
}

/**
 * Subscribe to group members
 */
export function subscribeToGroupMembers(
  groupId: string,
  onUpdate: (members: GroupMember[]) => void,
): () => void {
  const db = getFirestoreInstance();

  const membersQuery = query(
    collection(db, "Groups", groupId, "Members"),
    orderBy("joinedAt", "asc"),
  );

  return onSnapshot(
    membersQuery,
    (snapshot) => {
      const members = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          role: data.role,
          joinedAt:
            data.joinedAt instanceof Timestamp
              ? data.joinedAt.toMillis()
              : data.joinedAt,
          lastReadAt:
            data.lastReadAt instanceof Timestamp
              ? data.lastReadAt.toMillis()
              : data.lastReadAt,
          displayName: data.displayName,
          username: data.username,
          avatarConfig: data.avatarConfig,
          profilePictureUrl: data.profilePictureUrl || null,
          decorationId: data.decorationId || null,
        } as GroupMember;
      });

      onUpdate(members);
    },
    (error) => {
      logger.error("[groups] Error subscribing to members:", error);
    },
  );
}

/**
 * Check if user is a member of a group
 */
export async function isGroupMember(
  groupId: string,
  uid: string,
): Promise<boolean> {
  const db = getFirestoreInstance();
  const memberDoc = await getDoc(doc(db, "Groups", groupId, "Members", uid));
  return memberDoc.exists();
}

/**
 * Get user's role in a group
 */
export async function getUserRole(
  groupId: string,
  uid: string,
): Promise<GroupRole | null> {
  const db = getFirestoreInstance();
  const memberDoc = await getDoc(doc(db, "Groups", groupId, "Members", uid));

  if (!memberDoc.exists()) {
    return null;
  }

  return memberDoc.data().role as GroupRole;
}

/**
 * Leave a group
 */
export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  const db = getFirestoreInstance();

  // Check if user is owner
  const memberDoc = await getDoc(doc(db, "Groups", groupId, "Members", uid));
  if (!memberDoc.exists()) {
    throw new Error("You are not a member of this group");
  }

  const memberData = memberDoc.data();
  if (memberData.role === "owner") {
    throw new Error(
      "Group owner cannot leave. Transfer ownership or delete the group.",
    );
  }

  // Get user profile for system message
  const userProfile = await getUserProfileByUid(uid);
  const displayName = userProfile?.displayName || "A member";

  const now = Date.now();
  const batch = writeBatch(db);

  // Remove member
  batch.delete(doc(db, "Groups", groupId, "Members", uid));

  // Decrement member count and remove from memberIds
  batch.update(doc(db, "Groups", groupId), {
    memberIds: arrayRemove(uid),
    memberCount: increment(-1),
    updatedAt: now,
  });

  // Add system message
  const systemMessageRef = doc(collection(db, "Groups", groupId, "Messages"));
  const systemMessage: Omit<GroupMessage, "id"> = {
    groupId,
    sender: uid,
    senderDisplayName: displayName,
    type: "system",
    content: `${displayName} left the group`,
    createdAt: now,
    systemType: "member_left",
  };
  batch.set(systemMessageRef, systemMessage);

  await batch.commit();

  logger.info(`✅ [groups] User ${uid} left group ${groupId}`);
}

/**
 * Remove a member from a group (admin/owner only)
 */
export async function removeMember(
  groupId: string,
  adminUid: string,
  targetUid: string,
): Promise<void> {
  const db = getFirestoreInstance();

  // Check admin's role
  const adminRole = await getUserRole(groupId, adminUid);
  if (adminRole !== "owner" && adminRole !== "admin") {
    throw new Error("Only admins can remove members");
  }

  // Check target's role
  const targetRole = await getUserRole(groupId, targetUid);
  if (!targetRole) {
    throw new Error("User is not a member of this group");
  }

  // Owner cannot be removed
  if (targetRole === "owner") {
    throw new Error("Cannot remove the group owner");
  }

  // Admin can only remove members, not other admins
  if (adminRole === "admin" && targetRole === "admin") {
    throw new Error("Admins cannot remove other admins");
  }

  // Get profiles for system message
  const targetProfile = await getUserProfileByUid(targetUid);
  const adminProfile = await getUserProfileByUid(adminUid);

  const now = Date.now();
  const batch = writeBatch(db);

  // Remove member
  batch.delete(doc(db, "Groups", groupId, "Members", targetUid));

  // Decrement member count and remove from memberIds
  batch.update(doc(db, "Groups", groupId), {
    memberIds: arrayRemove(targetUid),
    memberCount: increment(-1),
    updatedAt: now,
  });

  // Add system message
  const systemMessageRef = doc(collection(db, "Groups", groupId, "Messages"));
  const systemMessage: Omit<GroupMessage, "id"> = {
    groupId,
    sender: adminUid,
    senderDisplayName: adminProfile?.displayName || "Admin",
    type: "system",
    content: `${targetProfile?.displayName || "A member"} was removed from the group`,
    createdAt: now,
    systemType: "member_removed",
    systemMeta: {
      targetUid,
      targetDisplayName: targetProfile?.displayName,
    },
  };
  batch.set(systemMessageRef, systemMessage);

  await batch.commit();

  logger.info(`✅ [groups] User ${targetUid} removed from group ${groupId}`);
}

/**
 * Change a member's role (owner only)
 */
export async function changeMemberRole(
  groupId: string,
  ownerUid: string,
  targetUid: string,
  newRole: GroupRole,
): Promise<void> {
  const db = getFirestoreInstance();

  // Verify requester is owner
  const ownerRole = await getUserRole(groupId, ownerUid);
  if (ownerRole !== "owner") {
    throw new Error("Only the group owner can change roles");
  }

  // Cannot change own role
  if (ownerUid === targetUid) {
    throw new Error("Cannot change your own role");
  }

  // Cannot make someone else owner (would need transfer ownership)
  if (newRole === "owner") {
    throw new Error("Use transfer ownership instead");
  }

  // Verify target is a member
  const targetMemberRef = doc(db, "Groups", groupId, "Members", targetUid);
  const targetDoc = await getDoc(targetMemberRef);
  if (!targetDoc.exists()) {
    throw new Error("User is not a member of this group");
  }

  const targetProfile = await getUserProfileByUid(targetUid);

  const now = Date.now();
  const batch = writeBatch(db);

  // Update role
  batch.update(targetMemberRef, { role: newRole });

  // Add system message
  const systemMessageRef = doc(collection(db, "Groups", groupId, "Messages"));
  const systemMessage: Omit<GroupMessage, "id"> = {
    groupId,
    sender: ownerUid,
    senderDisplayName: "System",
    type: "system",
    content: `${targetProfile?.displayName || "A member"} is now ${newRole === "admin" ? "an admin" : "a member"}`,
    createdAt: now,
    systemType: "role_changed",
    systemMeta: {
      targetUid,
      targetDisplayName: targetProfile?.displayName,
      newRole,
    },
  };
  batch.set(systemMessageRef, systemMessage);

  // Update group timestamp
  batch.update(doc(db, "Groups", groupId), { updatedAt: now });

  await batch.commit();

  logger.info(
    `✅ [groups] Changed ${targetUid}'s role to ${newRole} in group ${groupId}`,
  );
}

/**
 * Transfer group ownership
 */
export async function transferOwnership(
  groupId: string,
  currentOwnerUid: string,
  newOwnerUid: string,
): Promise<void> {
  const db = getFirestoreInstance();

  // Verify current owner
  const currentRole = await getUserRole(groupId, currentOwnerUid);
  if (currentRole !== "owner") {
    throw new Error("Only the group owner can transfer ownership");
  }

  // Verify new owner is a member
  const newOwnerRole = await getUserRole(groupId, newOwnerUid);
  if (!newOwnerRole) {
    throw new Error("New owner must be a member of the group");
  }

  const batch = writeBatch(db);

  // Update group owner field
  batch.update(doc(db, "Groups", groupId), {
    ownerId: newOwnerUid,
    updatedAt: Date.now(),
  });

  // Update roles
  batch.update(doc(db, "Groups", groupId, "Members", currentOwnerUid), {
    role: "admin",
  });
  batch.update(doc(db, "Groups", groupId, "Members", newOwnerUid), {
    role: "owner",
  });

  await batch.commit();

  logger.info(
    `✅ [groups] Transferred ownership from ${currentOwnerUid} to ${newOwnerUid}`,
  );
}

// =============================================================================
// Group Messages
// =============================================================================

/**
 * Get group messages (paginated)
 */
export async function getGroupMessages(
  groupId: string,
  pageSize: number = DEFAULT_PAGE_SIZE,
  lastMessageDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<{
  messages: GroupMessage[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
}> {
  const db = getFirestoreInstance();

  let messagesQuery = query(
    collection(db, "Groups", groupId, "Messages"),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  );

  if (lastMessageDoc) {
    messagesQuery = query(
      collection(db, "Groups", groupId, "Messages"),
      orderBy("createdAt", "desc"),
      startAfter(lastMessageDoc),
      limit(pageSize),
    );
  }

  const snapshot = await getDocs(messagesQuery);

  const messages = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      groupId: data.groupId,
      sender: data.sender,
      senderDisplayName: data.senderDisplayName,
      type: data.type,
      content: data.content,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toMillis()
          : data.createdAt,
      imagePath: data.imagePath,
      scorecard: data.scorecard,
      systemType: data.systemType,
      systemMeta: data.systemMeta,
      // H6: Reply-to threading
      replyTo: data.replyTo,
      // H11: Voice message metadata
      voiceMetadata: data.voiceMetadata,
      // H9: Mention UIDs
      mentionUids: data.mentionUids,
      // H7: Delete support
      hiddenFor: data.hiddenFor,
      deletedForAll: data.deletedForAll,
    } as GroupMessage;
  });

  const lastDoc =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { messages, lastDoc };
}

/**
 * Subscribe to group messages (real-time)
 *
 * @deprecated Use `subscribeToMessages` from `@/services/messaging` instead:
 *
 * ```typescript
 * // OLD (deprecated):
 * import { subscribeToGroupMessages } from "@/services/groups";
 * const unsubscribe = subscribeToGroupMessages(groupId, setMessages);
 *
 * // NEW (recommended):
 * import { subscribeToMessages } from "@/services/messaging";
 * const unsubscribe = subscribeToMessages("group", groupId, {
 *   onMessages: setMessages,
 *   onPaginationState: setPagination,
 *   currentUid: user.uid,
 * });
 * ```
 *
 * The unified subscription provides:
 * - MessageV2 format (consistent with DMs)
 * - Built-in pagination support
 * - Hidden message filtering
 * - Proper cursor-based pagination
 */
export function subscribeToGroupMessages(
  groupId: string,
  onUpdate: (messages: GroupMessage[]) => void,
  messageLimit: number = DEFAULT_PAGE_SIZE,
  currentUid?: string,
): () => void {
  const db = getFirestoreInstance();

  const messagesQuery = query(
    collection(db, "Groups", groupId, "Messages"),
    orderBy("createdAt", "desc"),
    limit(messageLimit),
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          groupId: data.groupId,
          sender: data.sender,
          senderDisplayName: data.senderDisplayName,
          senderAvatarConfig: data.senderAvatarConfig,
          type: data.type,
          content: data.content,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : data.createdAt,
          imagePath: data.imagePath,
          scorecard: data.scorecard,
          systemType: data.systemType,
          systemMeta: data.systemMeta,
          // H6: Reply-to threading
          replyTo: data.replyTo,
          // H11: Voice message metadata
          voiceMetadata: data.voiceMetadata,
          // H9: Mention UIDs
          mentionUids: data.mentionUids,
          // H7: Delete support
          hiddenFor: data.hiddenFor,
          deletedForAll: data.deletedForAll,
        } as GroupMessage;
      });

      // Filter out messages hidden for current user
      const filteredMessages = currentUid
        ? messages.filter((msg) => !msg.hiddenFor?.includes(currentUid))
        : messages;

      // NOTE: For inverted FlatList, keep messages in "newest-first" order
      // (query already returns DESC order from Firestore)
      // Do NOT reverse here
      onUpdate(filteredMessages);
    },
    (error) => {
      // Permission errors are expected after leaving a group - ignore them silently
      if (error.code === "permission-denied") {
        logger.info(
          `[groups] Message subscription ended (user left group ${groupId})`,
        );
      } else {
        logger.error("[groups] Error subscribing to messages:", error);
      }
    },
  );
}

/**
 * Update last read timestamp for a member
 * Updates both public (for read receipts) and private (for unread badges) timestamps
 */
export async function updateLastRead(
  groupId: string,
  uid: string,
): Promise<void> {
  const db = getFirestoreInstance();
  const now = Date.now();

  // Update public member state (for read receipts)
  const memberRef = doc(db, "Groups", groupId, "Members", uid);

  // Check if member document exists before updating
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) {
    // User is no longer a member (likely just left), skip update
    return;
  }

  await updateDoc(memberRef, {
    lastReadAt: now,
  });

  // Also update private member state (for unread badge computation)
  const privateRef = doc(db, "Groups", groupId, "MembersPrivate", uid);
  await setDoc(
    privateRef,
    {
      uid,
      lastSeenAtPrivate: now,
      lastMarkedUnreadAt: null, // Clear manual unread marker
    },
    { merge: true },
  );
}

// =============================================================================
// Group Management
// =============================================================================

/**
 * Update group name
 */
export async function updateGroupName(
  groupId: string,
  adminUid: string,
  newName: string,
): Promise<void> {
  const db = getFirestoreInstance();

  // Verify user has permission
  const role = await getUserRole(groupId, adminUid);
  if (role !== "owner" && role !== "admin") {
    throw new Error("Only admins can update the group name");
  }

  // Validate name
  if (!newName || newName.trim().length === 0) {
    throw new Error("Group name cannot be empty");
  }
  if (newName.length > GROUP_LIMITS.MAX_NAME_LENGTH) {
    throw new Error(
      `Group name must be ${GROUP_LIMITS.MAX_NAME_LENGTH} characters or less`,
    );
  }

  await updateDoc(doc(db, "Groups", groupId), {
    name: newName.trim(),
    updatedAt: Date.now(),
  });

  logger.info(`✅ [groups] Updated group ${groupId} name to "${newName}"`);
}

/**
 * Update group photo
 */
export async function updateGroupPhoto(
  groupId: string,
  adminUid: string,
  avatarUrl: string,
): Promise<void> {
  const db = getFirestoreInstance();

  // Verify user has permission
  const role = await getUserRole(groupId, adminUid);
  if (role !== "owner" && role !== "admin") {
    throw new Error("Only admins can update the group photo");
  }

  await updateDoc(doc(db, "Groups", groupId), {
    avatarUrl: avatarUrl,
    updatedAt: Date.now(),
  });

  logger.info(`✅ [groups] Updated group ${groupId} photo`);
}

/**
 * Delete a group (owner only)
 */
export async function deleteGroup(
  groupId: string,
  ownerUid: string,
): Promise<void> {
  logger.info("🗑️ deleteGroup called", { groupId, ownerUid });

  const db = getFirestoreInstance();

  // Verify owner
  logger.info("🗑️ Verifying owner role...");
  const role = await getUserRole(groupId, ownerUid);
  logger.info("🗑️ User role:", role);

  if (role !== "owner") {
    logger.error("🗑️ Permission denied - user is not owner");
    throw new Error("Only the group owner can delete the group");
  }

  // Note: In production, you'd use a Cloud Function to delete subcollections
  // For now, we just mark the group as deleted or remove the main doc
  // Messages and members would need cleanup via scheduled function

  logger.info("🗑️ Deleting group document...");
  await deleteDoc(doc(db, "Groups", groupId));

  logger.info(`✅ [groups] Deleted group ${groupId}`);
}
