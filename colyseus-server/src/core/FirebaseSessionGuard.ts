/**
 * Realtime Framework — Firebase Session Guard
 *
 * Shared authentication and authorization logic for Colyseus room joins.
 * Verifies Firebase tokens and session membership against Firestore.
 *
 * @module core/FirebaseSessionGuard
 */

import {
  getFirebaseDb,
  isDevBypass,
  verifyFirebaseToken,
} from "../bridge/firebaseBridge";

// =============================================================================
// Types
// =============================================================================

export interface SessionGuardResult {
  uid: string;
  displayName: string;
  participantUids: string[];
  spectatorUids: string[];
  players: Array<{ uid: string; displayName?: string }>;
  settings: Record<string, unknown>;
  sessionData: Record<string, unknown>;
}

export interface JoinOptions {
  uid: string;
  token: string;
  sessionId: string;
  displayName?: string;
  /** If true, allow spectator joins (uid in spectatorUids) */
  allowSpectators?: boolean;
}

// =============================================================================
// Guard Implementation
// =============================================================================

/**
 * Verify a player's Firebase auth token and session membership.
 * Throws descriptive errors on failure.
 *
 * This should be called from `onAuth()` in any realtime room.
 */
export async function verifyJoin(
  expectedSessionId: string,
  expectedGameId: string,
  options: JoinOptions,
): Promise<SessionGuardResult> {
  const { uid, token, sessionId, displayName, allowSpectators } = options;

  // ── Basic parameter validation ──────────────────────────────────────
  if (!uid || typeof uid !== "string") {
    throw new Error("Missing uid.");
  }
  if (!sessionId || sessionId !== expectedSessionId) {
    throw new Error("Session mismatch.");
  }

  // ── Dev bypass: trust client options, skip Firebase ─────────────────
  if (isDevBypass()) {
    console.log(
      `[SessionGuard] DEV BYPASS — trusting uid=${uid}, displayName=${displayName ?? "Player"}`,
    );
    return {
      uid,
      displayName: displayName || "Player",
      participantUids: [uid],
      spectatorUids: [],
      players: [{ uid, displayName: displayName || "Player" }],
      settings: {},
      sessionData: {
        gameId: expectedGameId,
        runtimeType: "realtime",
        status: "active",
        participantUids: [uid],
      },
    };
  }

  if (!token || typeof token !== "string") {
    throw new Error("Missing auth token.");
  }

  // ── Firebase token verification ─────────────────────────────────────
  const decoded = await verifyFirebaseToken(token);
  if (decoded.uid !== uid) {
    throw new Error("Authenticated user mismatch.");
  }

  // ── Firestore session verification ──────────────────────────────────
  const db = getFirebaseDb();
  const sessionSnap = await db
    .collection("GameSessionsV4")
    .doc(expectedSessionId)
    .get();

  if (!sessionSnap.exists) {
    throw new Error("Game session not found.");
  }

  const sessionData = sessionSnap.data() as Record<string, unknown>;

  // Verify game ID
  if (sessionData.gameId !== expectedGameId) {
    throw new Error(
      `Session game mismatch: expected ${expectedGameId}, got ${sessionData.gameId}.`,
    );
  }

  // Verify runtime type
  if (sessionData.runtimeType !== "realtime") {
    throw new Error("Session is not a realtime game.");
  }

  // Verify session is active
  if (sessionData.status !== "active") {
    throw new Error(`Session is not active (current: ${sessionData.status}).`);
  }

  // ── Membership verification ─────────────────────────────────────────
  const participantUids = Array.isArray(sessionData.participantUids)
    ? sessionData.participantUids.filter(
        (v): v is string => typeof v === "string",
      )
    : [];

  const spectatorUids = Array.isArray(sessionData.spectatorUids)
    ? sessionData.spectatorUids.filter(
        (v): v is string => typeof v === "string",
      )
    : [];

  const isParticipant = participantUids.includes(uid);
  const isSpectator = spectatorUids.includes(uid);

  if (!isParticipant && !(allowSpectators && isSpectator)) {
    throw new Error("You are not a participant in this match.");
  }

  // ── Extract player info ─────────────────────────────────────────────
  const players = Array.isArray(sessionData.players)
    ? sessionData.players
        .filter(
          (v): v is Record<string, unknown> => !!v && typeof v === "object",
        )
        .map((p) => ({
          uid: typeof p.uid === "string" ? p.uid : "",
          displayName:
            typeof p.displayName === "string" ? p.displayName : undefined,
        }))
        .filter((p) => p.uid.length > 0)
    : [];

  // Resolve display name with priority: session data > join option > token > fallback
  const resolvedDisplayName =
    players.find((p) => p.uid === uid)?.displayName ||
    displayName ||
    decoded.name ||
    "Player";

  return {
    uid,
    displayName: resolvedDisplayName,
    participantUids,
    spectatorUids,
    players,
    settings:
      sessionData.settings && typeof sessionData.settings === "object"
        ? (sessionData.settings as Record<string, unknown>)
        : {},
    sessionData,
  };
}
