/**
 * Games V4 — Firestore Triggers
 *
 * Triggers:
 * - onGameInviteV4Deleted: cleanup when invite is hard-deleted (by TTL or watchdog)
 * - onSessionV4Updated: detect status transitions and fan-out side effects
 *
 * @module gamesV4/triggers
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { getDb, unpinInviteFromConversation } from "./helpers";
import { resolveRealtimeSessionV4 } from "./sessions";
import type { GameInviteV4, GameSessionV4 } from "./types";
import { COLLECTIONS } from "./types";

// =============================================================================
// Trigger: onGameInviteV4Deleted
// Fires when an invite doc is deleted (by TTL policy or watchdog).
// Ensures the invite is unpinned from the conversation.
// =============================================================================

export const onGameInviteV4Deleted = functions.firestore
  .document(`${COLLECTIONS.GAME_INVITES}/{inviteId}`)
  .onDelete(async (snap) => {
    const invite = snap.data() as GameInviteV4;

    // Unpin from conversation (idempotent — arrayRemove is safe even if not present)
    try {
      await unpinInviteFromConversation(
        invite.conversationId,
        invite.conversationScope,
        invite.inviteId,
      );
    } catch (err) {
      console.error(
        `[triggerV4] Failed to unpin deleted invite ${invite.inviteId}:`,
        err,
      );
    }

    console.log(
      `[triggerV4] Invite ${invite.inviteId} deleted. Unpinned from ${invite.conversationScope}:${invite.conversationId}.`,
    );
  });

// =============================================================================
// Trigger: onSessionV4StatusChanged
// Fires when a session document is updated.
// Detects resolved → triggers cleanup for any side effects not handled
// by the resolve chokepoint (defensive/redundant).
// =============================================================================

export const onSessionV4StatusChanged = functions.firestore
  .document(`${COLLECTIONS.GAME_SESSIONS}/{sessionId}`)
  .onUpdate(async (change) => {
    const before = change.before.data() as GameSessionV4;
    const after = change.after.data() as GameSessionV4;

    // Only react to status transitions
    if (before.status === after.status) return;

    console.log(
      `[triggerV4] Session ${after.sessionId} status: ${before.status} → ${after.status}`,
    );

    // ─── Transition to resolved/abandoned/expired ─────────────────────
    if (
      (after.status === "resolved" ||
        after.status === "abandoned" ||
        after.status === "expired") &&
      before.status === "active"
    ) {
      // Defensive: ensure invite is also marked resolved
      // (resolveSessionV4Internal already does this, but this is a safety net)
      try {
        const db = getDb();
        const inviteRef = db
          .collection(COLLECTIONS.GAME_INVITES)
          .doc(after.inviteId);
        const inviteSnap = await inviteRef.get();

        if (inviteSnap.exists) {
          const invite = inviteSnap.data() as GameInviteV4;
          if (invite.status !== "resolved") {
            console.warn(
              `[triggerV4] Invite ${after.inviteId} not resolved — forcing.`,
            );
            await inviteRef.update({
              status: "resolved",
              updatedAt: admin.firestore.Timestamp.now(),
              "summary.phase": "resolved",
            });
          }
        }
      } catch (err) {
        console.error(
          `[triggerV4] Failed to sync invite status for session ${after.sessionId}:`,
          err,
        );
      }
    }

    // ─── Transition to active (from lobby_open) ──────────────────────
    if (after.status === "active" && before.status === "lobby_open") {
      console.log(
        `[triggerV4] Session ${after.sessionId} activated from lobby.`,
      );
      // Future: could trigger a "game started" notification here
    }
  });

// =============================================================================
// Trigger: onRealtimeResolutionRequest
// Fires when the Colyseus server writes a resolution request doc
// at gameSessions/{sessionId}/internal/realtimeResolution.
// Bridges the result into the standard V4 resolution pipeline.
// =============================================================================

export const onRealtimeResolutionRequest = functions.firestore
  .document(
    `${COLLECTIONS.GAME_SESSIONS}/{sessionId}/internal/realtimeResolution`,
  )
  .onCreate(async (snap, context) => {
    const sessionId = context.params.sessionId;
    const data = snap.data();

    if (!data) {
      console.error(
        `[triggerV4] Empty realtimeResolution doc for session ${sessionId}`,
      );
      return;
    }

    // ── Extract fields (supports both legacy and new framework payloads) ──
    const requestId = (data.requestId as string) ?? "legacy";
    const resolutionType = data.resolutionType as
      | "win"
      | "draw"
      | "disconnect"
      | "timeout"
      | "error";
    const winnerIds = (data.winnerIds as string[]) ?? [];
    const scoreboard = data.scoreboard as
      | Array<{
          uid: string;
          displayName: string;
          score: number;
          placement: number;
          stats: Record<string, unknown>;
        }>
      | undefined;

    // New framework enrichment fields (optional, used for postmortem data)
    const reason = (data.reason as string) ?? resolutionType;
    const durationMs = (data.durationMs as number) ?? 0;
    const gameId = data.gameId as string | undefined;
    const playerMetrics = data.playerMetrics as
      | Record<string, Record<string, unknown>>
      | undefined;

    console.log(
      `[triggerV4] Realtime resolution request for session ${sessionId}: ` +
        `requestId=${requestId}, resolutionType=${resolutionType}, ` +
        `reason=${reason}, winners=${JSON.stringify(winnerIds)}, ` +
        `durationMs=${durationMs}${gameId ? `, gameId=${gameId}` : ""}`,
    );

    // ── Idempotency guard: check session status before resolving ──
    try {
      const db = getDb();
      const sessionSnap = await db
        .collection(COLLECTIONS.GAME_SESSIONS)
        .doc(sessionId)
        .get();

      if (sessionSnap.exists) {
        const session = sessionSnap.data() as GameSessionV4;
        if (
          session.status === "resolved" ||
          session.status === "abandoned" ||
          session.status === "expired"
        ) {
          console.log(
            `[triggerV4] Session ${sessionId} already ${session.status}. ` +
              `Skipping resolution (requestId=${requestId}).`,
          );
          return;
        }
      }
    } catch (err) {
      console.warn(
        `[triggerV4] Failed to check session status for ${sessionId}. Proceeding with resolution:`,
        err,
      );
    }

    try {
      await resolveRealtimeSessionV4(
        sessionId,
        resolutionType,
        winnerIds,
        scoreboard,
        { reason, durationMs, gameId, playerMetrics, requestId },
      );
      console.log(
        `[triggerV4] Realtime session ${sessionId} resolved successfully (requestId=${requestId}).`,
      );
    } catch (err) {
      console.error(
        `[triggerV4] Failed to resolve realtime session ${sessionId} (requestId=${requestId}):`,
        err,
      );
    }
  });
