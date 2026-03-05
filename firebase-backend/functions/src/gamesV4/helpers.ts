/**
 * Games V4 — Shared Backend Helpers
 *
 * Utility functions used across all V4 Cloud Functions:
 * auth assertions, membership checks, pinning, ID generation.
 *
 * @module gamesV4/helpers
 */

import * as crypto from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { MAX_PINNED_INVITES, PINNED_INVITE_IDS_FIELD } from "./types";

// =============================================================================
// Firestore accessor
// =============================================================================

export function getDb(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

// =============================================================================
// Auth helpers
// =============================================================================

/**
 * Assert the caller is authenticated, returning their UID.
 * Throws `unauthenticated` HttpsError if not.
 */
export function assertAuth(context: functions.https.CallableContext): string {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required.",
    );
  }
  return context.auth.uid;
}

// =============================================================================
// Membership helpers
// =============================================================================

/**
 * Check if a user is a member of a conversation (DM or group).
 */
export async function isConversationMember(
  uid: string,
  conversationId: string,
  scope: "dm" | "group",
): Promise<boolean> {
  const db = getDb();
  if (scope === "dm") {
    const chatDoc = await db.collection("Chats").doc(conversationId).get();
    if (!chatDoc.exists) return false;
    const members: string[] = chatDoc.data()?.members || [];
    return members.includes(uid);
  } else {
    const memberDoc = await db
      .collection("Groups")
      .doc(conversationId)
      .collection("Members")
      .doc(uid)
      .get();
    return memberDoc.exists;
  }
}

/**
 * Assert the caller is a member of the conversation.
 * Throws `permission-denied` if not.
 */
export async function assertConversationMember(
  uid: string,
  conversationId: string,
  scope: "dm" | "group",
): Promise<void> {
  const isMember = await isConversationMember(uid, conversationId, scope);
  if (!isMember) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You are not a member of this conversation.",
    );
  }
}

/**
 * Get all member UIDs for a conversation.
 */
export async function getConversationMemberIds(
  conversationId: string,
  scope: "dm" | "group",
): Promise<string[]> {
  const db = getDb();
  if (scope === "dm") {
    const chatDoc = await db.collection("Chats").doc(conversationId).get();
    return chatDoc.exists ? chatDoc.data()?.members || [] : [];
  } else {
    const snap = await db
      .collection("Groups")
      .doc(conversationId)
      .collection("Members")
      .get();
    return snap.docs.map((d) => d.id);
  }
}

// =============================================================================
// Pinning helpers
// =============================================================================

/** Collection name for the conversation doc (Chats or Groups). */
function conversationCollection(scope: "dm" | "group"): string {
  return scope === "dm" ? "Chats" : "Groups";
}

/**
 * Pin an invite ID to the conversation's pinnedGameInviteIds array.
 * Respects MAX_PINNED_INVITES — oldest are evicted (FIFO) if at capacity.
 */
export async function pinInviteToConversation(
  conversationId: string,
  scope: "dm" | "group",
  inviteId: string,
): Promise<void> {
  const db = getDb();
  const docRef = db
    .collection(conversationCollection(scope))
    .doc(conversationId);

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(docRef);
    const current: string[] = doc.data()?.[PINNED_INVITE_IDS_FIELD] || [];

    // Already pinned
    if (current.includes(inviteId)) return;

    // Evict oldest if at capacity
    const updated = [...current, inviteId];
    while (updated.length > MAX_PINNED_INVITES) {
      updated.shift();
    }

    tx.update(docRef, { [PINNED_INVITE_IDS_FIELD]: updated });
  });
}

/**
 * Unpin an invite ID from the conversation.
 */
export async function unpinInviteFromConversation(
  conversationId: string,
  scope: "dm" | "group",
  inviteId: string,
): Promise<void> {
  const db = getDb();
  const docRef = db
    .collection(conversationCollection(scope))
    .doc(conversationId);

  await docRef.update({
    [PINNED_INVITE_IDS_FIELD]: admin.firestore.FieldValue.arrayRemove(inviteId),
  });
}

// =============================================================================
// ID & trace generation
// =============================================================================

/** Generate a random trace ID for debugging. */
export function generateTraceId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** Server timestamp shorthand. */
export function serverTimestamp(): FirebaseFirestore.FieldValue {
  return admin.firestore.FieldValue.serverTimestamp();
}

/** Current epoch millis. */
export function nowMs(): number {
  return Date.now();
}

// =============================================================================
// User profile lookup
// =============================================================================

export interface MinimalProfile {
  displayName: string;
  avatarConfig?: Record<string, unknown>;
  profilePictureUrl?: string | null;
}

/**
 * Fetch minimal profile data for a user.
 */
export async function getUserProfile(
  uid: string,
): Promise<MinimalProfile | null> {
  const db = getDb();
  const doc = await db.collection("Users").doc(uid).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    displayName: data.displayName || "Unknown",
    avatarConfig: data.avatarConfig,
    profilePictureUrl: data.profilePictureUrl ?? null,
  };
}

// =============================================================================
// Integrity hash
// =============================================================================

/**
 * Compute an integrity hash for PB anti-forgery.
 */
export function computeIntegrityHash(
  uid: string,
  gameId: string,
  pbValue: number,
  sessionId: string | null,
): string {
  const payload = `${uid}:${gameId}:${pbValue}:${sessionId ?? "none"}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// =============================================================================
// Week key for leaderboards
// =============================================================================

/**
 * Compute a weekly leaderboard key: "YYYY-Wnn" (ISO week).
 */
export function currentWeekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear =
    Math.floor((now.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);
  return `${now.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}
