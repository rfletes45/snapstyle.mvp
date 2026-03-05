/**
 * Firebase Bridge — calls resolveRealtimeSessionV4 Cloud Function
 *
 * The Colyseus server calls this when a match ends so the result
 * flows through the normal V4 resolution pipeline (PB, leaderboard,
 * achievements, XP, notifications).
 */

import * as admin from "firebase-admin";

// ── Initialise once ─────────────────────────────────────────────────
let initialised = false;

function ensureInit() {
  if (!initialised) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    initialised = true;
  }
}

// ── Public API ──────────────────────────────────────────────────────

export interface ScoreboardEntry {
  uid: string;
  displayName: string;
  score: number;
  placement: number;
  stats: Record<string, unknown>;
}

/**
 * Resolve a realtime session through the V4 pipeline by calling the
 * `resolveRealtimeSessionV4` HTTPS callable Cloud Function.
 */
export async function resolveRealtimeSessionV4(
  sessionId: string,
  resolutionType: string,
  winnerIds: string[],
  scoreboard: ScoreboardEntry[],
): Promise<void> {
  ensureInit();

  const db = admin.firestore();

  // Write the resolution request doc — a Cloud Function trigger picks it up
  await db
    .collection("gameSessions")
    .doc(sessionId)
    .collection("internal")
    .doc("realtimeResolution")
    .set({
      resolutionType,
      winnerIds,
      scoreboard,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  console.log(
    `[FirebaseBridge] Wrote resolution request for session ${sessionId} (${resolutionType})`,
  );
}
