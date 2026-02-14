/**
 * Golf Duels Persistence — Firestore match records + user stats  (Segment 4)
 *
 * Writes to:
 *   GolfDuelsMatches/{matchId}  — detailed match record with holeDetails[]
 *   users/{uid}/gameStats/golf_duels — per-user Golf Duels statistics
 *
 * All writes use the Firebase Admin SDK (server-only).
 * Clients read via Firestore security rules (see firestore.rules).
 */

import { FieldValue } from "firebase-admin/firestore";
import { createServerLogger } from "../utils/logger";
import { getFirestoreDb } from "./firebase";

const log = createServerLogger("golf-persistence");

// =============================================================================
// Types
// =============================================================================

export interface GolfHoleDetail {
  holeId: string;
  tier: number;
  p1Strokes: number;
  p2Strokes: number;
  winner: "p1" | "p2" | "tie";
}

export interface GolfMatchRecord {
  p1Uid: string;
  p2Uid: string;
  p1DisplayName: string;
  p2DisplayName: string;
  startedAt: FieldValue;
  endedAt: FieldValue;
  holesPlayed: number;
  p1HolesWon: number;
  p2HolesWon: number;
  winnerUid: string | null;
  reason: string; // "up_by_2" | "forfeit" | "max_holes"
  holeDetails: GolfHoleDetail[];
  gameType: "golf_duels";
  source: "colyseus";
}

export interface GolfUserStats {
  wins: number;
  losses: number;
  draws: number;
  holesWon: number;
  holesLost: number;
  totalStrokes: number;
  totalHoles: number;
  avgStrokes: number;
  lastPlayedAt: FieldValue;
}

// =============================================================================
// Persist Match
// =============================================================================

/**
 * Write a completed Golf Duels match record to Firestore.
 *
 * @param matchId   Unique match ID (typically the Colyseus roomId)
 * @param record    Match data including holeDetails
 */
export async function persistGolfMatch(
  matchId: string,
  record: GolfMatchRecord,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    log.warn("No Firestore — cannot persist golf match");
    return;
  }

  try {
    await db.collection("GolfDuelsMatches").doc(matchId).set(record);
    log.info(`Golf match persisted: ${matchId}`);
  } catch (err) {
    log.error(`Failed to persist golf match ${matchId}: ${err}`);
  }
}

// =============================================================================
// Update User Stats
// =============================================================================

/**
 * Update golf-duels-specific stats for both players after a match.
 *
 * Stored at: users/{uid}/gameStats/golf_duels
 *
 * @param p1Uid      Player 1 UID
 * @param p2Uid      Player 2 UID
 * @param winnerUid  UID of the winner (null for draw)
 * @param holeDetails  Array of per-hole results
 */
export async function updateGolfStats(
  p1Uid: string,
  p2Uid: string,
  winnerUid: string | null,
  holeDetails: GolfHoleDetail[],
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    log.warn("No Firestore — cannot update golf stats");
    return;
  }

  // Aggregate from hole details
  let p1HolesWon = 0;
  let p2HolesWon = 0;
  let p1TotalStrokes = 0;
  let p2TotalStrokes = 0;
  const totalHoles = holeDetails.length;

  for (const h of holeDetails) {
    if (h.winner === "p1") p1HolesWon++;
    else if (h.winner === "p2") p2HolesWon++;
    p1TotalStrokes += h.p1Strokes;
    p2TotalStrokes += h.p2Strokes;
  }

  const p1Outcome: "win" | "loss" | "draw" =
    winnerUid === p1Uid ? "win" : winnerUid === p2Uid ? "loss" : "draw";
  const p2Outcome: "win" | "loss" | "draw" =
    winnerUid === p2Uid ? "win" : winnerUid === p1Uid ? "loss" : "draw";

  try {
    await Promise.all([
      updateSingleGolfStats(
        p1Uid,
        p1Outcome,
        p1HolesWon,
        p2HolesWon,
        p1TotalStrokes,
        totalHoles,
      ),
      updateSingleGolfStats(
        p2Uid,
        p2Outcome,
        p2HolesWon,
        p1HolesWon,
        p2TotalStrokes,
        totalHoles,
      ),
    ]);
    log.info(`Golf stats updated for ${p1Uid} and ${p2Uid}`);
  } catch (err) {
    log.error(`Failed to update golf stats: ${err}`);
  }
}

async function updateSingleGolfStats(
  uid: string,
  outcome: "win" | "loss" | "draw",
  holesWon: number,
  holesLost: number,
  strokes: number,
  totalHoles: number,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const ref = db
    .collection("users")
    .doc(uid)
    .collection("gameStats")
    .doc("golf_duels");

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const now = FieldValue.serverTimestamp();

    if (doc.exists) {
      const data = doc.data() as GolfUserStats;
      const newWins = (data.wins || 0) + (outcome === "win" ? 1 : 0);
      const newLosses = (data.losses || 0) + (outcome === "loss" ? 1 : 0);
      const newDraws = (data.draws || 0) + (outcome === "draw" ? 1 : 0);
      const newHolesWon = (data.holesWon || 0) + holesWon;
      const newHolesLost = (data.holesLost || 0) + holesLost;
      const newTotalStrokes = (data.totalStrokes || 0) + strokes;
      const newTotalHoles = (data.totalHoles || 0) + totalHoles;
      const newAvg = newTotalHoles > 0 ? newTotalStrokes / newTotalHoles : 0;

      tx.update(ref, {
        wins: newWins,
        losses: newLosses,
        draws: newDraws,
        holesWon: newHolesWon,
        holesLost: newHolesLost,
        totalStrokes: newTotalStrokes,
        totalHoles: newTotalHoles,
        avgStrokes: Math.round(newAvg * 100) / 100,
        lastPlayedAt: now,
      });
    } else {
      const avg = totalHoles > 0 ? strokes / totalHoles : 0;
      tx.set(ref, {
        wins: outcome === "win" ? 1 : 0,
        losses: outcome === "loss" ? 1 : 0,
        draws: outcome === "draw" ? 1 : 0,
        holesWon,
        holesLost,
        totalStrokes: strokes,
        totalHoles,
        avgStrokes: Math.round(avg * 100) / 100,
        lastPlayedAt: now,
      });
    }
  });
}

// =============================================================================
// Complete Invite on Match End
// =============================================================================

/**
 * Mark the GameInvites document as "completed" when a Golf Duels match ends.
 *
 * The invite's `gameId` field (e.g. "ext_golf_duels_uinv_xxxxx") is the same
 * value both players pass as `firestoreGameId` when joining the Colyseus room.
 * We look up invites by that `gameId` and transition them from "active" →
 * "completed".
 *
 * @param firestoreGameId  The external session ID used as the room filter key
 * @param winnerUid        UID of the winner (empty string / null for draw)
 * @param reason           End reason ("up_by_2" | "forfeit" | "max_holes")
 */
export async function completeGolfInvite(
  firestoreGameId: string,
  winnerUid: string | null,
  reason: string,
): Promise<void> {
  if (!firestoreGameId) return; // No invite to update (hub / dev launch)

  const db = getFirestoreDb();
  if (!db) {
    log.warn("No Firestore — cannot complete golf invite");
    return;
  }

  try {
    const snapshot = await db
      .collection("GameInvites")
      .where("gameId", "==", firestoreGameId)
      .limit(5)
      .get();

    if (snapshot.empty) {
      // Match may have been started outside the invite flow (e.g. dev/testing)
      log.info(
        `No invite found for firestoreGameId=${firestoreGameId} — skipping`,
      );
      return;
    }

    const batch = db.batch();
    for (const inviteDoc of snapshot.docs) {
      const invite = inviteDoc.data();
      if (invite.status === "active" || invite.status === "ready") {
        batch.update(inviteDoc.ref, {
          status: "completed",
          completedAt: Date.now(),
          gameEndStatus: reason,
          winnerUid: winnerUid || null,
          updatedAt: Date.now(),
        });
      }
    }
    await batch.commit();
    log.info(
      `Golf invite(s) marked completed for firestoreGameId=${firestoreGameId}`,
    );
  } catch (err) {
    log.error(`Failed to complete golf invite: ${err}`);
  }
}

// =============================================================================
// Helper: Extract tier from holeId
// =============================================================================

/**
 * Extract tier number from a holeId like "T3-2" → 3
 */
export function tierFromHoleId(holeId: string): number {
  const match = holeId.match(/^T(\d+)-/);
  return match ? parseInt(match[1], 10) : 1;
}
