/**
 * Games V4 — Watchdog (Scheduled)
 *
 * Runs periodically to clean up stale game state:
 *
 * Pass 1: Expire stale lobbies (LOBBY_EXPIRY_MS with no start)
 * Pass 2: Clean up resolved invites past TTL (backup for TTL policy)
 * Pass 3: Retry failed reward processing (rewardsProcessed !== true)
 * Pass 4: Auto-resolve inactive turn-based sessions (TURN_INACTIVITY_MS)
 *
 * @module gamesV4/watchdog
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { getDb } from "./helpers";
import { resolveSessionV4Internal, retryRewardsForSession } from "./resolve";
import { COLLECTIONS, LOBBY_EXPIRY_MS, RESOLVED_INVITE_TTL_MS } from "./types";

// Turn inactivity — import from types if available, else define here
const TURN_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// =============================================================================
// Scheduled: watchdogGamesV4
// Every 30 minutes
// =============================================================================

export const watchdogGamesV4 = functions.pubsub
  .schedule("every 30 minutes")
  .onRun(async () => {
    console.log("[watchdogV4] Starting watchdog run...");

    const db = getDb();
    const now = Date.now();
    let pass1Count = 0;
    let pass2Count = 0;
    let pass3Count = 0;
    let pass4Count = 0;

    // ─── Pass 1: Expire stale lobbies ─────────────────────────────────
    try {
      const cutoff = admin.firestore.Timestamp.fromMillis(
        now - LOBBY_EXPIRY_MS,
      );
      const staleInvites = await db
        .collection(COLLECTIONS.GAME_INVITES)
        .where("status", "in", ["sent", "lobby"])
        .where("createdAt", "<", cutoff)
        .limit(100)
        .get();

      const batch = db.batch();
      for (const doc of staleInvites.docs) {
        batch.update(doc.ref, {
          status: "resolved",
          updatedAt: admin.firestore.Timestamp.now(),
          "summary.phase": "resolved",
          deleteRequestedAt: admin.firestore.Timestamp.now(),
          deleteAt: admin.firestore.Timestamp.fromMillis(
            now + RESOLVED_INVITE_TTL_MS,
          ),
        });
        pass1Count++;
      }
      if (pass1Count > 0) await batch.commit();
    } catch (err) {
      console.error("[watchdogV4] Pass 1 (expire lobbies) failed:", err);
    }

    // ─── Pass 2: Hard-delete resolved invites past TTL ────────────────
    try {
      const deleteCutoff = admin.firestore.Timestamp.fromMillis(now);
      const expiredInvites = await db
        .collection(COLLECTIONS.GAME_INVITES)
        .where("status", "==", "resolved")
        .where("deleteAt", "<=", deleteCutoff)
        .limit(100)
        .get();

      const batch = db.batch();
      for (const doc of expiredInvites.docs) {
        batch.delete(doc.ref);
        pass2Count++;
      }
      if (pass2Count > 0) await batch.commit();
    } catch (err) {
      console.error(
        "[watchdogV4] Pass 2 (delete expired invites) failed:",
        err,
      );
    }

    // ─── Pass 3: Retry failed reward processing ──────────────────────
    try {
      const unrewardedSessions = await db
        .collection(COLLECTIONS.GAME_SESSIONS)
        .where("status", "==", "resolved")
        .where("rewardsProcessed", "==", false)
        .limit(20)
        .get();

      for (const doc of unrewardedSessions.docs) {
        const session = doc.data();
        try {
          await retryRewardsForSession(session.sessionId);
          pass3Count++;
        } catch (err) {
          console.error(
            `[watchdogV4] Pass 3 retry failed for ${session.sessionId}:`,
            err,
          );
        }
      }
    } catch (err) {
      console.error("[watchdogV4] Pass 3 (retry rewards) failed:", err);
    }

    // ─── Pass 4: Auto-resolve inactive turn-based sessions ───────────
    try {
      const inactivityCutoff = admin.firestore.Timestamp.fromMillis(
        now - TURN_INACTIVITY_MS,
      );

      // Find active sessions that haven't had activity in TURN_INACTIVITY_MS
      const staleSessions = await db
        .collection(COLLECTIONS.GAME_SESSIONS)
        .where("status", "==", "active")
        .where("createdAt", "<", inactivityCutoff)
        .limit(20)
        .get();

      for (const doc of staleSessions.docs) {
        const session = doc.data();
        // Only auto-resolve turn-based (realtime sessions handle their own timeouts)
        if (session.runtimeType !== "turnBased") continue;

        try {
          await resolveSessionV4Internal({
            sessionId: session.sessionId,
            resolutionType: "timeout",
            winnerIds: [],
            reason: "Watchdog: inactivity timeout.",
          });
          pass4Count++;
        } catch (err) {
          console.error(
            `[watchdogV4] Pass 4 auto-resolve failed for ${session.sessionId}:`,
            err,
          );
        }
      }
    } catch (err) {
      console.error("[watchdogV4] Pass 4 (auto-resolve inactive) failed:", err);
    }

    console.log(
      `[watchdogV4] Complete. ` +
        `Pass1(expired lobbies):${pass1Count} ` +
        `Pass2(deleted invites):${pass2Count} ` +
        `Pass3(retried rewards):${pass3Count} ` +
        `Pass4(auto-resolved):${pass4Count}`,
    );

    return null;
  });
