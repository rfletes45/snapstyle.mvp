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
 * Per-session Firestore cache. When multiple players join the same room
 * within a short window (typical for match start), the second–Nth players
 * reuse the cached session doc instead of doing a redundant Firestore read.
 * Cache entries expire after 30 s — long enough for a full roster join,
 * short enough that a status change won't be stale.
 */
const sessionCache = new Map<
  string,
  { data: Record<string, unknown>; expiresAt: number }
>();
const SESSION_CACHE_TTL_MS = 30_000;

function getCachedSession(sessionId: string): Record<string, unknown> | null {
  const entry = sessionCache.get(sessionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessionCache.delete(sessionId);
    return null;
  }
  return entry.data;
}

function setCachedSession(
  sessionId: string,
  data: Record<string, unknown>,
): void {
  sessionCache.set(sessionId, {
    data,
    expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
  });
  // Evict old entries if cache grows unbounded (unlikely in practice)
  if (sessionCache.size > 200) {
    const now = Date.now();
    for (const [key, val] of sessionCache) {
      if (now > val.expiresAt) sessionCache.delete(key);
    }
  }
}

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

  const tag = `[SessionGuard:${expectedGameId}]`;
  console.log(
    `${tag} Verifying join: uid=${uid}, sessionId=${sessionId}, hasToken=${!!token}`,
  );

  // ── Basic parameter validation ──────────────────────────────────────
  if (!uid || typeof uid !== "string") {
    console.error(`${tag} REJECTED — missing uid`);
    throw new Error("Missing uid.");
  }
  if (!sessionId || sessionId !== expectedSessionId) {
    console.error(
      `${tag} REJECTED — session mismatch: expected=${expectedSessionId}, got=${sessionId}`,
    );
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
    console.error(`${tag} REJECTED — missing auth token for uid=${uid}`);
    throw new Error("Missing auth token.");
  }

  // ── Firebase token verification ─────────────────────────────────────
  let decoded;
  try {
    decoded = await verifyFirebaseToken(token);
  } catch (tokenErr) {
    console.error(
      `${tag} REJECTED — Firebase token verification failed for uid=${uid}:`,
      tokenErr instanceof Error ? tokenErr.message : tokenErr,
    );
    throw new Error("Firebase token verification failed.");
  }
  if (decoded.uid !== uid) {
    console.error(
      `${tag} REJECTED — uid mismatch: token.uid=${decoded.uid}, claimed=${uid}`,
    );
    throw new Error("Authenticated user mismatch.");
  }
  console.log(`${tag} Token verified for uid=${uid}`);

  // ── Firestore session verification (with short-lived cache) ──────
  // PERF: When all players join within seconds, avoid N identical reads
  // for the same session doc. Cache is TTL-bounded and read-only.
  let sessionData = getCachedSession(expectedSessionId);
  if (!sessionData) {
    const db = getFirebaseDb();
    const sessionSnap = await db
      .collection("GameSessionsV4")
      .doc(expectedSessionId)
      .get();

    if (!sessionSnap.exists) {
      console.error(
        `${tag} REJECTED — session doc not found: ${expectedSessionId}`,
      );
      throw new Error("Game session not found.");
    }

    sessionData = sessionSnap.data() as Record<string, unknown>;
    setCachedSession(expectedSessionId, sessionData);
  }

  // Verify game ID
  if (sessionData.gameId !== expectedGameId) {
    console.error(
      `${tag} REJECTED — game mismatch: expected=${expectedGameId}, got=${sessionData.gameId}`,
    );
    throw new Error(
      `Session game mismatch: expected ${expectedGameId}, got ${sessionData.gameId}.`,
    );
  }

  // Verify runtime type
  if (sessionData.runtimeType !== "realtime") {
    console.error(
      `${tag} REJECTED — not realtime: runtimeType=${sessionData.runtimeType}`,
    );
    throw new Error("Session is not a realtime game.");
  }

  // Verify session is active
  if (sessionData.status !== "active") {
    console.error(
      `${tag} REJECTED — session not active: status=${sessionData.status}`,
    );
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
    console.error(
      `${tag} REJECTED — uid=${uid} not in participants=${JSON.stringify(participantUids)} or spectators=${JSON.stringify(spectatorUids)}`,
    );
    throw new Error("You are not a participant in this match.");
  }
  console.log(
    `${tag} ✓ Join verified: uid=${uid}, role=${isParticipant ? "participant" : "spectator"}`,
  );

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
