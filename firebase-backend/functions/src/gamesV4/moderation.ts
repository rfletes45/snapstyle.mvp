/**
 * Games V4 — Admin / Owner Game Moderation
 *
 * Server-authoritative callables for force-clearing broken games when the
 * normal lifecycle fails.  Permission-gated by conversation role (group
 * owner/admin or DM participant).
 *
 * Design:
 * - Soft-clear by default (mark resolved/hidden, unpin, set TTL).
 * - Hard-delete only for truly orphaned docs.
 * - Resolution type "error" so moderation clears are distinguishable from
 *   real game outcomes and don't corrupt rewards/history.
 * - Idempotent — safe to call repeatedly on the same target.
 *
 * @module gamesV4/moderation
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
  assertAuth,
  generateTraceId,
  getDb,
  unpinInviteFromConversation,
} from "./helpers";
import type { GameInviteV4, GameSessionV4 } from "./types";
import { COLLECTIONS, RESOLVED_INVITE_TTL_MS } from "./types";

// =============================================================================
// Helpers: Role Verification
// =============================================================================

/**
 * Check if a user is an owner/admin of a conversation.
 * - DMs: both participants have equal authority (both can clear).
 * - Groups: only owner or admin roles.
 */
async function assertConversationAuthority(
  uid: string,
  conversationId: string,
  scope: "dm" | "group",
): Promise<void> {
  const db = getDb();

  if (scope === "dm") {
    // In a DM, both participants are "owners" — check membership.
    const chatDoc = await db.collection("Chats").doc(conversationId).get();
    if (!chatDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Conversation not found.",
      );
    }
    const members: string[] = chatDoc.data()?.members ?? [];
    if (!members.includes(uid)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You are not a member of this conversation.",
      );
    }
    return;
  }

  // Group: owner or admin role required.
  const [memberDoc, groupDoc] = await Promise.all([
    db
      .collection("Groups")
      .doc(conversationId)
      .collection("Members")
      .doc(uid)
      .get(),
    db.collection("Groups").doc(conversationId).get(),
  ]);

  if (!groupDoc.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Conversation not found.",
    );
  }

  // Check owner via top-level field
  if (groupDoc.data()?.createdBy === uid) return;
  if (groupDoc.data()?.ownerId === uid) return;

  // Check admin role via Members subcollection
  if (memberDoc.exists) {
    const role = memberDoc.data()?.role;
    if (role === "admin" || role === "owner") return;
  }

  throw new functions.https.HttpsError(
    "permission-denied",
    "Only the group owner or an admin can clear games.",
  );
}

// =============================================================================
// Soft-clear helpers
// =============================================================================

/**
 * Soft-clear a single invite.  Sets it to resolved + hidden with a TTL.
 * Returns true if the invite was active/modified, false if already resolved.
 */
async function softClearInvite(
  db: FirebaseFirestore.Firestore,
  inviteId: string,
  traceId: string,
): Promise<boolean> {
  const inviteRef = db.collection(COLLECTIONS.GAME_INVITES).doc(inviteId);
  const snap = await inviteRef.get();

  if (!snap.exists) return false;

  const invite = snap.data() as GameInviteV4;
  const now = admin.firestore.Timestamp.now();

  // Already fully resolved/hidden — idempotent no-op.
  if (invite.status === "resolved" && invite.hiddenInChat) return false;

  const update: Record<string, unknown> = {
    status: "resolved",
    hiddenInChat: true,
    hiddenAt: now,
    updatedAt: now,
    "summary.phase": "resolved",
    "summary.turnPlayerId": null,
    forceClearedAt: now,
    forceClearTraceId: traceId,
  };

  // Set TTL for eventual hard-delete by watchdog.
  if (!invite.deleteRequestedAt) {
    update.deleteRequestedAt = now;
    update.deleteAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + RESOLVED_INVITE_TTL_MS,
    );
  }

  await inviteRef.update(update);

  // Unpin from conversation
  try {
    await unpinInviteFromConversation(
      invite.conversationId,
      invite.conversationScope,
      inviteId,
    );
  } catch (err) {
    console.warn(`[gamesV4][mod] Failed to unpin invite ${inviteId}:`, err);
  }

  return true;
}

/**
 * Soft-clear a single session.  Transitions to "abandoned" with an error
 * resolution so it doesn't corrupt rewards/history.
 */
async function softClearSession(
  db: FirebaseFirestore.Firestore,
  sessionId: string,
  traceId: string,
): Promise<boolean> {
  const sessionRef = db.collection(COLLECTIONS.GAME_SESSIONS).doc(sessionId);
  const snap = await sessionRef.get();

  if (!snap.exists) return false;

  const session = snap.data() as GameSessionV4;
  const now = admin.firestore.Timestamp.now();

  // Already terminal — idempotent.
  if (
    session.status === "resolved" ||
    session.status === "abandoned" ||
    session.status === "expired"
  ) {
    return false;
  }

  await sessionRef.update({
    status: "abandoned",
    resolvedAt: now,
    resolution: {
      type: "error",
      reason: `Force-cleared by moderator (trace: ${traceId})`,
      winnerIds: [],
    },
    rewardsProcessed: true, // prevent reward pipeline — this is not a real outcome
    forceClearedAt: now,
    forceClearTraceId: traceId,
  });

  return true;
}

// =============================================================================
// Callable: adminClearGameV4
// =============================================================================

/**
 * Force-clear a single broken game (invite + session).
 *
 * Permission: conversation owner/admin (group) or any participant (DM).
 * Behavior:
 * - Soft-clears the invite (resolved + hidden + TTL for eventual hard-delete).
 * - Soft-clears the session if one exists (abandoned with error resolution).
 * - Unpins from conversation.
 * - Idempotent.
 */
export const adminClearGameV4 = functions.https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);
    const { inviteId } = data as { inviteId: string };

    if (!inviteId || typeof inviteId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "inviteId is required.",
      );
    }

    const db = getDb();
    const traceId = generateTraceId();

    // Read the invite to verify conversation ownership
    const inviteRef = db.collection(COLLECTIONS.GAME_INVITES).doc(inviteId);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      // No invite doc — attempt to clean up any stale pinned reference.
      // We don't know the conversation, so this is a best-effort no-op.
      return {
        success: true,
        inviteCleared: false,
        sessionCleared: false,
        alreadyClean: true,
        traceId,
      };
    }

    const invite = inviteSnap.data() as GameInviteV4;

    // Permission check: caller must have authority over the conversation
    await assertConversationAuthority(
      uid,
      invite.conversationId,
      invite.conversationScope,
    );

    // Clear invite
    const inviteCleared = await softClearInvite(db, inviteId, traceId);

    // Clear session if it exists
    let sessionCleared = false;
    if (invite.sessionId) {
      sessionCleared = await softClearSession(db, invite.sessionId, traceId);
    }

    // Write audit log
    await db.collection("GameModerationAuditV4").add({
      action: "clearGame",
      inviteId,
      sessionId: invite.sessionId ?? null,
      conversationId: invite.conversationId,
      conversationScope: invite.conversationScope,
      gameId: invite.gameId,
      actorUid: uid,
      traceId,
      inviteCleared,
      sessionCleared,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `[gamesV4][mod] adminClearGameV4: uid=${uid} cleared invite=${inviteId} session=${invite.sessionId ?? "none"} (trace: ${traceId})`,
    );

    return {
      success: true,
      inviteCleared,
      sessionCleared,
      alreadyClean: !inviteCleared && !sessionCleared,
      traceId,
    };
  },
);

// =============================================================================
// Callable: adminClearConversationGamesV4
// =============================================================================

/**
 * Force-clear ALL games in a conversation.
 *
 * Permission: conversation owner/admin (group) or any participant (DM).
 * Behavior:
 * - Queries all non-resolved invites for the conversation.
 * - Soft-clears each invite + associated session.
 * - Unpins all.
 * - Optionally clears the entire pinnedGameInviteIds array.
 * - Idempotent.
 */
export const adminClearConversationGamesV4 = functions.https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);
    const { conversationId, conversationScope } = data as {
      conversationId: string;
      conversationScope: "dm" | "group";
    };

    if (!conversationId || typeof conversationId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "conversationId is required.",
      );
    }
    if (conversationScope !== "dm" && conversationScope !== "group") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        'conversationScope must be "dm" or "group".',
      );
    }

    const db = getDb();
    const traceId = generateTraceId();

    // Permission check
    await assertConversationAuthority(uid, conversationId, conversationScope);

    // Query all non-terminal invites for this conversation.
    // Also include recently-resolved ones that might still be pinned/visible.
    const invitesSnap = await db
      .collection(COLLECTIONS.GAME_INVITES)
      .where("conversationId", "==", conversationId)
      .limit(50)
      .get();

    let totalInvitesCleared = 0;
    let totalSessionsCleared = 0;

    for (const inviteDoc of invitesSnap.docs) {
      const invite = inviteDoc.data() as GameInviteV4;
      const cleared = await softClearInvite(db, inviteDoc.id, traceId);
      if (cleared) totalInvitesCleared++;

      if (invite.sessionId) {
        const sCleared = await softClearSession(db, invite.sessionId, traceId);
        if (sCleared) totalSessionsCleared++;
      }
    }

    // Force-wipe the pinned invite array to ensure no stale references remain.
    const collName = conversationScope === "dm" ? "Chats" : "Groups";
    const convRef = db.collection(collName).doc(conversationId);
    try {
      await convRef.update({ pinnedGameInviteIds: [] });
    } catch (err) {
      console.warn(
        `[gamesV4][mod] Failed to wipe pinnedGameInviteIds for ${conversationId}:`,
        err,
      );
    }

    // Audit log
    await db.collection("GameModerationAuditV4").add({
      action: "clearConversationGames",
      conversationId,
      conversationScope,
      actorUid: uid,
      traceId,
      totalInvitesCleared,
      totalSessionsCleared,
      totalInvitesScanned: invitesSnap.size,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `[gamesV4][mod] adminClearConversationGamesV4: uid=${uid} cleared ${totalInvitesCleared} invites + ${totalSessionsCleared} sessions in ${conversationId} (trace: ${traceId})`,
    );

    return {
      success: true,
      totalInvitesCleared,
      totalSessionsCleared,
      traceId,
    };
  },
);
