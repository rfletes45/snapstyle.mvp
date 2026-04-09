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
  canDeleteGroup,
  canEditGroupName,
  canEditGroupPhoto,
  canKickMember,
  canManageInvites,
  canManageRoles,
  canTransferOwnership,
  DEFAULT_PERMISSIONS_CONFIG,
  GroupPermissionsConfig,
  OWNER_ONLY_PERMISSIONS,
  PERMISSIONS_SCHEMA_VERSION,
} from "@/permissions/groupPermissions";
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

interface CachedGroupMemberIdentity {
  profilePictureUrl: string | null;
  decorationId: string | null;
  fetchedAt: number;
}
// =============================================================================
// Constants
// =============================================================================

/** Default number of messages to load per page */
const DEFAULT_PAGE_SIZE = 30;
const GROUP_MEMBER_IDENTITY_CACHE_TTL_MS = 3 * 60 * 1000;
const groupMemberIdentityCache = new Map<string, CachedGroupMemberIdentity>();

/** Invite expiry in milliseconds (7 days) */
const INVITE_EXPIRY_MS = GROUP_LIMITS.INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

function hasOwnField(value: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function cacheGroupMemberIdentity(
  uid: string,
  profilePictureUrl: string | null,
  decorationId: string | null,
): void {
  groupMemberIdentityCache.set(uid, {
    profilePictureUrl,
    decorationId,
    fetchedAt: Date.now(),
  });
}

async function getCachedGroupMemberIdentity(
  uid: string,
): Promise<{ identity: CachedGroupMemberIdentity; fromCache: boolean } | null> {
  const cached = groupMemberIdentityCache.get(uid);
  if (
    cached &&
    Date.now() - cached.fetchedAt <= GROUP_MEMBER_IDENTITY_CACHE_TTL_MS
  ) {
    return { identity: cached, fromCache: true };
  }

  const profile = await getUserProfileByUid(uid);
  if (!profile) return null;

  const identity = {
    profilePictureUrl: profile.profilePicture?.url || null,
    decorationId: profile.avatarDecoration?.decorationId || null,
    fetchedAt: Date.now(),
  };
  groupMemberIdentityCache.set(uid, identity);
  return { identity, fromCache: false };
}

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

  // Fetch all selected member profiles in parallel so we can populate
  // their Member sub-documents in the same atomic batch write.
  const memberProfiles = await Promise.all(
    input.memberUids.map(async (memberUid) => {
      const profile = await getUserProfileByUid(memberUid);
      return { uid: memberUid, profile };
    }),
  );

  const now = Date.now();
  const groupRef = input.groupId
    ? doc(db, "Groups", input.groupId)
    : doc(collection(db, "Groups"));
  const groupId = groupRef.id;

  // Build the full memberIds array: creator + all selected members
  const allMemberIds = [creatorUid, ...input.memberUids];

  const batch = writeBatch(db);

  // Create group document with ALL members included from the start
  const groupData: Omit<Group, "id"> & { memberIds: string[] } = {
    name: input.name.trim(),
    ownerId: creatorUid,
    memberIds: allMemberIds,
    memberCount: allMemberIds.length,
    ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
    createdAt: now,
    updatedAt: now,
    // Initialize capability-based permissions config
    permissionsConfig: {
      ...DEFAULT_PERMISSIONS_CONFIG,
      updatedAt: now,
      updatedBy: creatorUid,
    },
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
    decorationId: creatorProfile.avatarDecoration?.decorationId || null,
  };
  batch.set(creatorMemberRef, { uid: creatorUid, ...creatorMemberData });

  // Add all selected members directly to the Members subcollection
  for (const { uid: memberUid, profile: memberProfile } of memberProfiles) {
    const memberRef = doc(db, "Groups", groupId, "Members", memberUid);
    const memberData: GroupMember = {
      uid: memberUid,
      role: "member",
      joinedAt: now,
      displayName: memberProfile?.displayName || "Unknown",
      username: memberProfile?.username || "unknown",
      avatarConfig: memberProfile?.avatarConfig ?? undefined,
      profilePictureUrl: memberProfile?.profilePicture?.url || null,
      decorationId: memberProfile?.avatarDecoration?.decorationId || null,
    };
    batch.set(memberRef, memberData);

    logger.debug(
      `[createGroup] Adding member ${memberUid} (${memberData.displayName}) to group ${groupId}`,
    );
  }

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

  logger.info(
    `[createGroup] Created group "${input.name}" (${groupId}) with ${allMemberIds.length} members`,
  );

  return {
    id: groupId,
    ...groupData,
  };
}

// =============================================================================
// Group Invites
// =============================================================================

/**
 * Send a group invite to a user.
 * Requires MANAGE_INVITES permission.
 */
export async function sendGroupInvite(
  groupId: string,
  groupName: string,
  fromUid: string,
  toUid: string,
): Promise<GroupInvite> {
  const db = getFirestoreInstance();

  logger.debug(
    `[sendGroupInvite] Starting invite from ${fromUid} to ${toUid} for group ${groupId}`,
  );

  // Verify inviter has permission
  const groupDocSnap = await getDoc(doc(db, "Groups", groupId));
  const groupData = groupDocSnap.exists()
    ? (groupDocSnap.data() as Group)
    : null;
  const config = groupData?.permissionsConfig ?? null;
  const fromRole = await getUserRole(groupId, fromUid);
  if (!canManageInvites(fromRole, config)) {
    throw new Error("You do not have permission to invite members");
  }

  // Check if target is blocked by sender or vice versa
  const blocked = await isUserBlocked(fromUid, toUid);
  const blockedBy = await isUserBlocked(toUid, fromUid);
  if (blocked || blockedBy) {
    throw new Error("Cannot invite this user");
  }

  // Check if user is already a member
  const memberDoc = await getDoc(doc(db, "Groups", groupId, "Members", toUid));
  if (memberDoc.exists()) {
    throw new Error("User is already a member of this group");
  }

  // Check for existing pending invite (that hasn't expired)
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

  if (validPendingInvites.length > 0) {
    throw new Error("User already has a pending invite to this group");
  }

  // Get sender profile
  const senderProfile = await getUserProfileByUid(fromUid);
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

  logger.debug(`[sendGroupInvite] Creating invite document...`);
  await setDoc(inviteRef, inviteData);

  logger.debug(`✅ [groups] Sent invite to ${toUid} for group ${groupId}`);

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

  const invitesQuery = query(
    collection(db, "GroupInvites"),
    where("toUid", "==", uid),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(invitesQuery);

  const invites = snapshot.docs
    .map((doc) => {
      const data = doc.data();
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
      return notExpired;
    }) as GroupInvite[];

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
  logger.debug("[acceptGroupInvite] Starting...", { inviteId, uid });

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

  const expiresAt =
    typeof invite.expiresAt === "number"
      ? invite.expiresAt
      : ((invite.expiresAt as DateLikeTimestamp | undefined)?.toMillis?.() ??
        (invite.expiresAt as DateLikeTimestamp | undefined)?.getTime?.() ??
        0);

  if (Date.now() > expiresAt) {
    throw new Error("Invite has expired");
  }

  logger.debug("[acceptGroupInvite] Fetching group document");
  const groupRef = doc(db, "Groups", invite.groupId);
  const groupDoc = await getDoc(groupRef);

  if (!groupDoc.exists()) {
    throw new Error("Group no longer exists");
  }

  const group = groupDoc.data() as Omit<Group, "id">;

  if (group.memberCount >= GROUP_LIMITS.MAX_MEMBERS) {
    throw new Error("Group is full");
  }

  const userProfile = await getUserProfileByUid(uid);
  if (!userProfile) {
    throw new Error("User profile not found");
  }

  const now = Date.now();
  const batch = writeBatch(db);

  // Update invite status
  batch.update(inviteRef, {
    status: "accepted",
    respondedAt: now,
  });

  // Add user as member
  const memberRef = doc(db, "Groups", invite.groupId, "Members", uid);
  const memberData: GroupMember = {
    uid,
    role: "member",
    joinedAt: now,
    displayName: userProfile.displayName,
    username: userProfile.username,
    avatarConfig: userProfile.avatarConfig,
    profilePictureUrl: userProfile.profilePicture?.url || null,
    decorationId: userProfile.avatarDecoration?.decorationId || null,
  };
  batch.set(memberRef, memberData);

  // Update group document
  batch.update(groupRef, {
    memberIds: [...group.memberIds, uid],
    memberCount: increment(1),
    updatedAt: now,
  });

  // Add system message
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

  logger.debug("[acceptGroupInvite] Committing batch write");
  try {
    await batch.commit();
    logger.debug(
      `[acceptGroupInvite] Success! User ${uid} joined group ${invite.groupId}`,
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

  logger.debug(`[groups] User ${uid} declined invite ${inviteId}`);
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
 * Subscribe to real-time group document changes.
 * Returns unsubscribe function.
 */
export function subscribeToGroup(
  groupId: string,
  onUpdate: (group: Group | null) => void,
): () => void {
  const db = getFirestoreInstance();
  const groupRef = doc(db, "Groups", groupId);

  return onSnapshot(
    groupRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const data = snap.data();
      onUpdate({
        id: snap.id,
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
        permissionsConfig: data.permissionsConfig,
      });
    },
    (error) => {
      logger.error("[groups] Error subscribing to group:", error);
      onUpdate(null);
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
    permissionsConfig: data.permissionsConfig,
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
    const profilePictureUrl = hasOwnField(data, "profilePictureUrl")
      ? (data.profilePictureUrl ?? null)
      : undefined;
    const decorationId = hasOwnField(data, "decorationId")
      ? (data.decorationId ?? null)
      : undefined;
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
      profilePictureUrl,
      decorationId,
    } as GroupMember;
  });
}

export async function hydrateGroupMembersForDisplay(
  members: GroupMember[],
): Promise<GroupMember[]> {
  if (members.length === 0) return members;

  let mirrored = 0;
  let cacheHit = 0;
  let freshFetch = 0;

  const result = await Promise.all(
    members.map(async (member) => {
      const hasMirroredIdentity =
        member.profilePictureUrl !== undefined &&
        member.decorationId !== undefined;

      if (hasMirroredIdentity) {
        mirrored++;
        cacheGroupMemberIdentity(
          member.uid,
          member.profilePictureUrl ?? null,
          member.decorationId ?? null,
        );
        return member;
      }

      try {
        const result = await getCachedGroupMemberIdentity(member.uid);
        if (result?.fromCache) cacheHit++;
        else freshFetch++;
        return {
          ...member,
          profilePictureUrl:
            member.profilePictureUrl !== undefined
              ? member.profilePictureUrl
              : (result?.identity.profilePictureUrl ?? null),
          decorationId:
            member.decorationId !== undefined
              ? member.decorationId
              : (result?.identity.decorationId ?? null),
        };
      } catch {
        freshFetch++;
        return {
          ...member,
          profilePictureUrl:
            member.profilePictureUrl !== undefined
              ? member.profilePictureUrl
              : null,
          decorationId:
            member.decorationId !== undefined ? member.decorationId : null,
        };
      }
    }),
  );

  logger.debug("[groups] Hydrated member identities", {
    total: members.length,
    mirrored,
    cacheHit,
    freshFetch,
  });

  return result;
}

export async function getGroupMembersForDisplay(
  groupId: string,
): Promise<GroupMember[]> {
  const members = await getGroupMembers(groupId);
  return hydrateGroupMembersForDisplay(members);
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
        const profilePictureUrl = hasOwnField(data, "profilePictureUrl")
          ? (data.profilePictureUrl ?? null)
          : undefined;
        const decorationId = hasOwnField(data, "decorationId")
          ? (data.decorationId ?? null)
          : undefined;
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
          profilePictureUrl,
          decorationId,
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

  logger.debug(`[groups] User ${uid} left group ${groupId}`);
}

/**
 * Remove a member from a group.
 * Requires KICK_MEMBERS permission and must outrank target.
 */
export async function removeMember(
  groupId: string,
  adminUid: string,
  targetUid: string,
): Promise<void> {
  const db = getFirestoreInstance();

  // Load group for permissions config
  const groupDoc = await getDoc(doc(db, "Groups", groupId));
  const groupData = groupDoc.exists() ? (groupDoc.data() as Group) : null;
  const config = groupData?.permissionsConfig ?? null;

  // Check admin's role
  const adminRole = await getUserRole(groupId, adminUid);

  // Check target's role
  const targetRole = await getUserRole(groupId, targetUid);
  if (!targetRole) {
    throw new Error("User is not a member of this group");
  }

  // Cannot kick yourself
  if (adminUid === targetUid) {
    throw new Error("Cannot remove yourself from the group");
  }

  // Owner cannot be removed
  if (targetRole === "owner") {
    throw new Error("Cannot remove the group owner");
  }

  // Permission check: must have kickMembers and outrank target
  if (!canKickMember(adminRole, targetRole, config)) {
    throw new Error("You do not have permission to remove this member");
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

  // Write audit log
  await writeAuditLog(db, groupId, {
    action: "member_removed",
    actorUid: adminUid,
    targetUid,
    details: { targetRole: targetRole },
  });

  logger.debug(`[groups] User ${targetUid} removed from group ${groupId}`);
}

/**
 * Change a member's role.
 * Requires MANAGE_ROLES permission and must outrank target.
 */
export async function changeMemberRole(
  groupId: string,
  actorUid: string,
  targetUid: string,
  newRole: GroupRole,
): Promise<void> {
  const db = getFirestoreInstance();

  // Load group for permissions config
  const groupDoc = await getDoc(doc(db, "Groups", groupId));
  const groupData = groupDoc.exists() ? (groupDoc.data() as Group) : null;
  const config = groupData?.permissionsConfig ?? null;

  // Verify requester has permission
  const actorRole = await getUserRole(groupId, actorUid);
  const targetCurrentRole = await getUserRole(groupId, targetUid);
  if (!canManageRoles(actorRole, targetCurrentRole, config)) {
    throw new Error("You do not have permission to change roles");
  }

  // Cannot change own role
  if (actorUid === targetUid) {
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
    sender: actorUid,
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

  // Write audit log entry
  await writeAuditLog(db, groupId, {
    action: "role_changed",
    actorUid: actorUid,
    targetUid,
    details: { newRole, previousRole: targetCurrentRole },
  });

  await batch.commit();

  logger.debug(
    `[groups] Changed ${targetUid}'s role to ${newRole} in group ${groupId}`,
  );
}

/**
 * Transfer group ownership. Always owner-only.
 */
export async function transferOwnership(
  groupId: string,
  currentOwnerUid: string,
  newOwnerUid: string,
): Promise<void> {
  const db = getFirestoreInstance();

  // Verify current owner
  const currentRole = await getUserRole(groupId, currentOwnerUid);
  if (!canTransferOwnership(currentRole)) {
    throw new Error("Only the group owner can transfer ownership");
  }

  // Cannot transfer to yourself
  if (currentOwnerUid === newOwnerUid) {
    throw new Error("Cannot transfer ownership to yourself");
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

  // Write audit log entry
  await writeAuditLog(db, groupId, {
    action: "ownership_transferred",
    actorUid: currentOwnerUid,
    targetUid: newOwnerUid,
    details: {},
  });

  await batch.commit();

  logger.debug(
    `[groups] Transferred ownership from ${currentOwnerUid} to ${newOwnerUid}`,
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

// =============================================================================
// Group Management
// =============================================================================

/**
 * Update group name.
 * Requires EDIT_GROUP_NAME permission.
 */
export async function updateGroupName(
  groupId: string,
  actorUid: string,
  newName: string,
): Promise<void> {
  const db = getFirestoreInstance();

  // Load group for permissions config
  const groupDoc = await getDoc(doc(db, "Groups", groupId));
  const groupData = groupDoc.exists() ? (groupDoc.data() as Group) : null;
  const config = groupData?.permissionsConfig ?? null;

  // Verify user has permission
  const role = await getUserRole(groupId, actorUid);
  if (!canEditGroupName(role, config)) {
    throw new Error("You do not have permission to update the group name");
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

  logger.debug(`[groups] Updated group ${groupId} name to "${newName}"`);
}

/**
 * Update group photo.
 * Requires EDIT_GROUP_PHOTO permission.
 */
export async function updateGroupPhoto(
  groupId: string,
  actorUid: string,
  avatarUrl: string,
): Promise<void> {
  const db = getFirestoreInstance();

  // Load group for permissions config
  const groupDoc = await getDoc(doc(db, "Groups", groupId));
  const groupData = groupDoc.exists() ? (groupDoc.data() as Group) : null;
  const config = groupData?.permissionsConfig ?? null;

  // Verify user has permission
  const role = await getUserRole(groupId, actorUid);
  if (!canEditGroupPhoto(role, config)) {
    throw new Error("You do not have permission to update the group photo");
  }

  await updateDoc(doc(db, "Groups", groupId), {
    avatarUrl: avatarUrl,
    updatedAt: Date.now(),
  });

  logger.debug(`[groups] Updated group ${groupId} photo`);
}

/**
 * Delete a group. Always owner-only.
 */
export async function deleteGroup(
  groupId: string,
  ownerUid: string,
): Promise<void> {
  logger.debug("deleteGroup called", { groupId, ownerUid });

  const db = getFirestoreInstance();

  // Verify owner
  const role = await getUserRole(groupId, ownerUid);

  if (!canDeleteGroup(role)) {
    logger.error("Permission denied - user is not owner");
    throw new Error("Only the group owner can delete the group");
  }

  // Write audit log before deletion
  await writeAuditLog(db, groupId, {
    action: "group_deleted",
    actorUid: ownerUid,
    details: {},
  });

  // Subcollection cleanup (Members, Messages, MembersPrivate, AuditLog)
  // and storage cleanup are handled by the onGroupDeleted Cloud Function
  // trigger that fires automatically when this document is deleted.

  await deleteDoc(doc(db, "Groups", groupId));

  logger.debug(
    "[groups] Deleted group root doc — Cloud Function will handle subcollection + storage cleanup",
    { groupId },
  );
}

// =============================================================================
// Permissions Config Management
// =============================================================================

/**
 * Get a group's current permissions config.
 * Returns null for legacy groups without config — callers should use
 * DEFAULT_PERMISSIONS_CONFIG as fallback.
 */
export async function getGroupPermissionsConfig(
  groupId: string,
): Promise<GroupPermissionsConfig | null> {
  const db = getFirestoreInstance();
  const groupDoc = await getDoc(doc(db, "Groups", groupId));
  if (!groupDoc.exists()) return null;
  return (groupDoc.data() as Group).permissionsConfig ?? null;
}

/**
 * Update the group's permissions config. Owner-only.
 * Validates that owner-only permissions cannot be granted to non-owners.
 */
export async function updateGroupPermissionsConfig(
  groupId: string,
  actorUid: string,
  newConfig: Partial<GroupPermissionsConfig>,
): Promise<void> {
  const db = getFirestoreInstance();

  // Verify actor is owner
  const actorRole = await getUserRole(groupId, actorUid);
  if (actorRole !== "owner") {
    throw new Error("Only the group owner can change permissions");
  }

  // Load current config
  const groupDocRef = doc(db, "Groups", groupId);
  const groupSnap = await getDoc(groupDocRef);
  if (!groupSnap.exists()) {
    throw new Error("Group not found");
  }

  const currentGroup = groupSnap.data() as Group;
  const currentConfig =
    currentGroup.permissionsConfig ?? DEFAULT_PERMISSIONS_CONFIG;

  // Merge new config into current
  const mergedConfig: GroupPermissionsConfig = {
    schemaVersion: PERMISSIONS_SCHEMA_VERSION,
    admin: { ...currentConfig.admin, ...newConfig.admin },
    member: { ...currentConfig.member, ...newConfig.member },
    updatedAt: Date.now(),
    updatedBy: actorUid,
  };

  // Enforce invariant: owner-only permissions can never be true for admin/member
  for (const ownerOnlyPerm of OWNER_ONLY_PERMISSIONS) {
    if (mergedConfig.admin[ownerOnlyPerm]) {
      mergedConfig.admin[ownerOnlyPerm] = false;
    }
    if (mergedConfig.member[ownerOnlyPerm]) {
      mergedConfig.member[ownerOnlyPerm] = false;
    }
  }

  await updateDoc(groupDocRef, {
    permissionsConfig: mergedConfig,
    updatedAt: Date.now(),
  });

  // Write audit log
  await writeAuditLog(db, groupId, {
    action: "permissions_changed",
    actorUid,
    details: { admin: mergedConfig.admin, member: mergedConfig.member },
  });

  logger.debug(`[groups] Updated permissions config for group ${groupId}`);
}

/**
 * Migrate a legacy group to the new permissions system.
 * Called lazily when a group is opened that lacks permissionsConfig.
 * Safe to call multiple times — checks if already migrated.
 */
export async function migrateGroupPermissions(
  groupId: string,
): Promise<GroupPermissionsConfig> {
  const db = getFirestoreInstance();
  const groupDocRef = doc(db, "Groups", groupId);
  const groupSnap = await getDoc(groupDocRef);

  if (!groupSnap.exists()) {
    throw new Error("Group not found");
  }

  const groupData = groupSnap.data() as Group;

  // Already migrated?
  if (groupData.permissionsConfig?.schemaVersion) {
    return groupData.permissionsConfig;
  }

  // Apply default permissions config
  const config: GroupPermissionsConfig = {
    ...DEFAULT_PERMISSIONS_CONFIG,
    updatedAt: Date.now(),
    updatedBy: "system_migration",
  };

  await updateDoc(groupDocRef, {
    permissionsConfig: config,
  });

  logger.debug(`[groups] Migrated permissions for group ${groupId}`);
  return config;
}

// =============================================================================
// Audit Log
// =============================================================================

/** Audit log entry for group governance actions */
export interface GroupAuditLogEntry {
  action: string;
  actorUid: string;
  targetUid?: string;
  details: Record<string, any>;
  timestamp: number;
}

/**
 * Write an audit log entry to the group's AuditLog subcollection.
 */
async function writeAuditLog(
  db: ReturnType<typeof getFirestoreInstance>,
  groupId: string,
  entry: Omit<GroupAuditLogEntry, "timestamp">,
): Promise<void> {
  try {
    const logRef = doc(collection(db, "Groups", groupId, "AuditLog"));
    await setDoc(logRef, {
      ...entry,
      timestamp: Date.now(),
    });
  } catch (error) {
    // Audit log failures should not block the primary action
    logger.error("[groups] Failed to write audit log:", error);
  }
}
