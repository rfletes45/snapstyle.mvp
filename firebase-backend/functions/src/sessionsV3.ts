/**
 * sessionsV3.ts — Cloud Function Callables for v3 Game Sessions
 *
 * These callables manage the `GameSessions/{sessionId}` lifecycle:
 *   createSessionV3  — host creates a session (lobby phase)
 *   joinSessionV3    — player/spectator joins an existing session
 *   leaveSessionV3   — participant leaves (host leaving → abandons session)
 *   startSessionV3   — host starts the game (lobby → starting → active)
 *
 * Design:
 *   - All mutations run inside a Firestore transaction for consistency.
 *   - Phase transitions are validated via `canTransitionPhase()`.
 *   - The session doc is the single source of truth (not the invite).
 *   - Types are inlined here because the Cloud Functions tsconfig.rootDir
 *     is `src/` and cannot import from `../../shared/sessions/`.
 *
 * @module firebase-backend/functions/src/sessionsV3
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

import {
  evaluateAchievementsV2,
  updatePerGameStatsV2,
} from "./achievementsV2Evaluator";
import { awardGameXp } from "./games";

const { HttpsError } = functions.https;

// Initialize if not already
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =============================================================================
// Inlined v3 Types & Constants
// (Mirrors shared/sessions/constants.ts + shared/sessions/types.ts)
// =============================================================================

const SESSION_PHASES = [
  "lobby",
  "starting",
  "active",
  "finishing",
  "resolved",
  "abandoned",
  "expired",
] as const;
type SessionPhase = (typeof SESSION_PHASES)[number];

const SESSION_PHASE_TRANSITIONS: Record<SessionPhase, readonly SessionPhase[]> =
  {
    lobby: ["starting", "abandoned", "expired"],
    starting: ["active", "abandoned"],
    active: ["finishing", "abandoned"],
    finishing: ["resolved", "abandoned"],
    resolved: [],
    abandoned: [],
    expired: [],
  };

const TERMINAL_PHASES = new Set<SessionPhase>([
  "resolved",
  "abandoned",
  "expired",
]);

function canTransitionPhase(from: SessionPhase, to: SessionPhase): boolean {
  return (SESSION_PHASE_TRANSITIONS[from] as readonly string[]).includes(to);
}

type ParticipantRole = "host" | "player" | "spectator";
type ParticipantStatus =
  | "invited"
  | "joined"
  | "ready"
  | "playing"
  | "finished"
  | "left"
  | "disconnected";
type SessionVisibility = "private" | "friends" | "public";
type SessionEntrySource =
  | "chat"
  | "play"
  | "recovery"
  | "deeplink"
  | "invite_pill";

const SESSIONS_COLLECTION = "GameSessions";
const SESSION_LOBBY_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_PARTICIPANTS = 2;
const DEFAULT_MAX_SPECTATORS = 10;

interface SessionParticipant {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joinedAt: number;
  lastHeartbeatAt?: number;
  score?: number;
  isWinner?: boolean;
}

interface SessionResolution {
  outcome: "win" | "draw" | "forfeit" | "timeout" | "error";
  winnerUid?: string;
  scores?: Record<string, number>;
  resolvedAt: number;
  firestoreGameId?: string;
  sourceInviteId?: string;
  xpAwarded?: Record<string, number>;
  achievementsUnlocked?: Record<string, string[]>;
  rewardsProcessed?: boolean;
  rewardsProcessedAt?: number;
  resolvedBy?: string;
}

interface GameSessionV3 {
  id: string;
  gameType: string;
  runtimeType: "solo" | "turnBased" | "realtime";
  visibility: SessionVisibility;
  phase: SessionPhase;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  hostUid: string;
  participants: SessionParticipant[];
  maxParticipants: number;
  maxSpectators: number;
  colyseusRoomId?: string;
  firestoreGameId?: string;
  sourceInviteId?: string;
  conversationId?: string;
  entrySource?: SessionEntrySource;
  resolution?: SessionResolution;
  traceId?: string;
  /** Flat UID array for Firestore security rules (rules can't map over objects) */
  participantUids: string[];
}

// =============================================================================
// Helpers
// =============================================================================

/** Fetch a user profile doc and return display name + avatar. */
async function getUserProfile(
  uid: string,
): Promise<{ displayName: string; avatarUrl: string }> {
  const snap = await db.collection("Users").doc(uid).get();
  const data = snap.data();
  return {
    displayName: data?.displayName || data?.name || "Player",
    avatarUrl: data?.avatarUrl || data?.photoURL || "",
  };
}

/** Count active (non-spectator, non-left, non-invited) participants. */
function countActivePlayers(participants: SessionParticipant[]): number {
  return participants.filter(
    (p) =>
      (p.role === "host" || p.role === "player") &&
      p.status !== "left" &&
      p.status !== "disconnected" &&
      p.status !== "invited",
  ).length;
}

/** Count active spectators. */
function countActiveSpectators(participants: SessionParticipant[]): number {
  return participants.filter(
    (p) => p.role === "spectator" && p.status !== "left",
  ).length;
}

// =============================================================================
// createSessionV3
// =============================================================================

export const createSessionV3 = functions.https.onCall(async (data, context) => {
  // --- Auth ---
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }
  const uid = context.auth.uid;

  // --- Validate input ---
  const {
    gameType,
    runtimeType,
    visibility = "private",
    maxParticipants = DEFAULT_MAX_PARTICIPANTS,
    conversationId,
    entrySource,
    traceId,
    dualWriteInvite: rawDualWrite = false,
    createInvite: rawCreateInvite = false,
    recipientUids: rawRecipientUids,
  } = data as {
    gameType?: string;
    runtimeType?: string;
    visibility?: SessionVisibility;
    maxParticipants?: number;
    conversationId?: string;
    entrySource?: SessionEntrySource;
    traceId?: string;
    dualWriteInvite?: boolean;
    createInvite?: boolean;
    recipientUids?: string[];
  };

  // Sanitise recipient list — dedupe & exclude the host
  const recipientUids: string[] = Array.isArray(rawRecipientUids)
    ? [...new Set(rawRecipientUids)].filter(
        (id) => typeof id === "string" && id !== uid,
      )
    : [];

  // Accept either flag name — client uses createInvite, internal uses dualWriteInvite
  const dualWriteInvite = rawDualWrite || rawCreateInvite;

  if (!gameType || typeof gameType !== "string") {
    throw new HttpsError("invalid-argument", "gameType is required");
  }
  if (
    !runtimeType ||
    !["solo", "turnBased", "realtime"].includes(runtimeType)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "runtimeType must be solo, turnBased, or realtime",
    );
  }
  if (maxParticipants < 1 || maxParticipants > 20) {
    throw new HttpsError(
      "invalid-argument",
      "maxParticipants must be between 1 and 20",
    );
  }

  // --- Fetch host profile ---
  const profile = await getUserProfile(uid);

  const now = Date.now();
  const sessionRef = db.collection(SESSIONS_COLLECTION).doc();
  const sessionId = sessionRef.id;

  const hostParticipant: SessionParticipant = {
    uid,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    role: "host",
    status: "joined",
    joinedAt: now,
  };

  // Build invited-participant stubs so recipients' subscription queries
  // (which filter on `participantUids array-contains <uid>`) can discover
  // the session immediately — before they explicitly join.
  const invitedParticipants: SessionParticipant[] = recipientUids.map(
    (rUid) => ({
      uid: rUid,
      displayName: "", // filled on join
      avatarUrl: "",
      role: "player" as const,
      status: "invited" as const,
      joinedAt: 0,
    }),
  );

  // participantUids includes both host and invited recipients so Firestore
  // security rules + subscription queries work for everyone in the chat.
  const allParticipantUids = [uid, ...recipientUids];

  const session: GameSessionV3 = {
    id: sessionId,
    gameType,
    runtimeType: runtimeType as GameSessionV3["runtimeType"],
    visibility,
    phase: "lobby",
    createdAt: now,
    updatedAt: now,
    expiresAt: now + SESSION_LOBBY_TTL_MS,
    hostUid: uid,
    participants: [hostParticipant, ...invitedParticipants],
    maxParticipants,
    maxSpectators: DEFAULT_MAX_SPECTATORS,
    participantUids: allParticipantUids,
    ...(conversationId && conversationId.length > 0 ? { conversationId } : {}),
    ...(entrySource ? { entrySource } : {}),
    ...(traceId ? { traceId } : {}),
  };

  await sessionRef.set(session);

  // --- Dual-write: create a v2 GameInvites doc for backward compatibility ---
  let sourceInviteId: string | undefined;
  if (dualWriteInvite && conversationId) {
    try {
      const inviteRef = db.collection("GameInvites").doc();
      sourceInviteId = inviteRef.id;

      // eligibleUserIds must include ALL session participants so that
      // every player can read the invite doc via Firestore security rules.
      const inviteEligible = [...new Set([uid, ...recipientUids])];

      // Use a batch to make the invite creation + session back-link atomic.
      // Prevents orphaned invite docs when the back-link update fails.
      const dualBatch = db.batch();

      dualBatch.set(inviteRef, {
        id: sourceInviteId,
        gameType,
        senderId: uid,
        senderName: profile.displayName,
        senderAvatar: profile.avatarUrl || "",
        context: recipientUids.length === 1 ? "dm" : "group",
        conversationId,
        targetType: recipientUids.length === 1 ? "specific" : "universal",
        ...(recipientUids.length === 1
          ? { recipientId: recipientUids[0] }
          : {}),
        eligibleUserIds: inviteEligible,
        requiredPlayers: maxParticipants,
        maxPlayers: maxParticipants,
        claimedSlots: [
          {
            playerId: uid,
            playerName: profile.displayName,
            playerAvatar: profile.avatarUrl || "",
            claimedAt: now,
            isHost: true,
          },
        ],
        status: "pending",
        inviteVersion: 3,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + SESSION_LOBBY_TTL_MS,
        spectatingEnabled: true,
        spectatorOnly: false,
        spectators: [],
        showInPlayPage: false,
        // v3 link — lets v2 code discover the session
        v3SessionId: sessionId,
        traceId: traceId || "",
      });

      // Write sourceInviteId back to the session in the same batch
      dualBatch.update(sessionRef, { sourceInviteId });

      await dualBatch.commit();

      functions.logger.info("sessionsV3.createSessionV3.dualWrite", {
        sessionId,
        inviteId: sourceInviteId,
      });
    } catch (dualErr) {
      // Non-fatal: v3 session already created successfully
      functions.logger.warn("sessionsV3.createSessionV3.dualWrite.FAILED", {
        sessionId,
        error: dualErr instanceof Error ? dualErr.message : String(dualErr),
      });
    }
  }

  functions.logger.info("sessionsV3.createSessionV3.OK", {
    sessionId,
    gameType,
    runtimeType,
    hostUid: uid,
    conversationId,
    traceId,
    sourceInviteId,
  });

  return { success: true, sessionId, sourceInviteId };
});

// =============================================================================
// joinSessionV3
// =============================================================================

export const joinSessionV3 = functions.https.onCall(async (data, context) => {
  // --- Auth ---
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }
  const uid = context.auth.uid;

  // --- Validate input ---
  const {
    sessionId,
    role = "player",
    entrySource,
  } = data as {
    sessionId?: string;
    role?: ParticipantRole;
    displayName?: string;
    avatarUrl?: string;
    entrySource?: SessionEntrySource;
  };

  if (!sessionId || typeof sessionId !== "string") {
    throw new HttpsError("invalid-argument", "sessionId is required");
  }
  if (!["player", "spectator"].includes(role)) {
    throw new HttpsError(
      "invalid-argument",
      "role must be player or spectator",
    );
  }

  // --- Transaction ---
  const result = await db.runTransaction(async (tx) => {
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
    const snap = await tx.get(sessionRef);

    if (!snap.exists) {
      throw new HttpsError("not-found", "Session not found");
    }

    const session = snap.data() as GameSessionV3;

    // Must be in lobby phase
    if (session.phase !== "lobby") {
      throw new HttpsError(
        "failed-precondition",
        `Cannot join session in "${session.phase}" phase`,
      );
    }

    // Check if already a participant
    const existing = session.participants.find((p) => p.uid === uid);
    if (
      existing &&
      existing.status !== "left" &&
      existing.status !== "invited"
    ) {
      // Already actively in session — idempotent success
      return { success: true, alreadyJoined: true };
    }

    // Capacity check
    if (role === "spectator") {
      if (
        countActiveSpectators(session.participants) >= session.maxSpectators
      ) {
        throw new HttpsError(
          "resource-exhausted",
          "Session spectator slots are full",
        );
      }
    } else {
      if (countActivePlayers(session.participants) >= session.maxParticipants) {
        throw new HttpsError(
          "resource-exhausted",
          "Session player slots are full",
        );
      }
    }

    // Fetch joiner profile
    const profile = await getUserProfile(uid);
    const now = Date.now();

    const participant: SessionParticipant = {
      uid,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      role,
      status: "joined",
      joinedAt: now,
    };

    // If the user previously left, replace their entry; otherwise append
    let updatedParticipants: SessionParticipant[];
    if (existing) {
      updatedParticipants = session.participants.map((p) =>
        p.uid === uid ? participant : p,
      );
    } else {
      updatedParticipants = [...session.participants, participant];
    }

    // Merge: keep existing ACL UIDs (e.g. other invited users added by
    // inviteToSessionV3) AND add UIDs from updated participants array.
    const mergedUids = [
      ...new Set([
        ...(session.participantUids || []),
        ...updatedParticipants
          .filter((p) => p.status !== "left")
          .map((p) => p.uid),
      ]),
    ];

    tx.update(sessionRef, {
      participants: updatedParticipants,
      participantUids: mergedUids,
      updatedAt: now,
    });

    return { success: true };
  });

  functions.logger.info("sessionsV3.joinSessionV3.OK", {
    sessionId,
    uid,
    role,
    entrySource,
  });

  // --- Sync eligibleUserIds on the linked v2 invite (fire-and-forget) ---
  // The v2 invite doc's `eligibleUserIds` controls Firestore read access.
  // If this joiner isn't already in that array, they get "permission denied"
  // when the client tries to subscribe to the invite.
  try {
    const sessionSnap = await db
      .collection(SESSIONS_COLLECTION)
      .doc(sessionId)
      .get();
    const sourceInviteId = sessionSnap.data()?.sourceInviteId;
    if (sourceInviteId) {
      const inviteRef = db.collection("GameInvites").doc(sourceInviteId);
      const inviteSnap = await inviteRef.get();
      if (inviteSnap.exists) {
        const currentEligible: string[] =
          inviteSnap.data()?.eligibleUserIds ?? [];
        if (!currentEligible.includes(uid)) {
          await inviteRef.update({
            eligibleUserIds: [...currentEligible, uid],
            updatedAt: Date.now(),
          });
          functions.logger.info("sessionsV3.joinSessionV3.eligibleSynced", {
            sessionId,
            inviteId: sourceInviteId,
            addedUid: uid,
          });
        }
      }
    }
  } catch (syncErr) {
    // Non-fatal — the join itself already succeeded
    functions.logger.warn("sessionsV3.joinSessionV3.eligibleSyncFailed", {
      sessionId,
      uid,
      error: String(syncErr),
    });
  }

  return result;
});

// =============================================================================
// leaveSessionV3
// =============================================================================

export const leaveSessionV3 = functions.https.onCall(async (data, context) => {
  // --- Auth ---
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }
  const uid = context.auth.uid;

  // --- Validate input ---
  const { sessionId } = data as { sessionId?: string };

  if (!sessionId || typeof sessionId !== "string") {
    throw new HttpsError("invalid-argument", "sessionId is required");
  }

  // --- Transaction ---
  await db.runTransaction(async (tx) => {
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
    const snap = await tx.get(sessionRef);

    if (!snap.exists) {
      throw new HttpsError("not-found", "Session not found");
    }

    const session = snap.data() as GameSessionV3;

    // Session already terminal → idempotent success.
    // This happens when the host leaves (→ abandoned) and then another
    // participant presses "Leave". They should be allowed to exit cleanly.
    if (TERMINAL_PHASES.has(session.phase)) {
      functions.logger.info("sessionsV3.leaveSessionV3.ALREADY_TERMINAL", {
        sessionId,
        uid,
        phase: session.phase,
      });
      return;
    }

    // Find participant
    const participantIndex = session.participants.findIndex(
      (p) => p.uid === uid,
    );
    if (participantIndex === -1) {
      throw new HttpsError(
        "failed-precondition",
        "You are not a participant in this session",
      );
    }

    const participant = session.participants[participantIndex];
    const now = Date.now();

    // If host leaves in lobby → abandon the session entirely
    if (participant.role === "host" && session.phase === "lobby") {
      if (!canTransitionPhase(session.phase, "abandoned")) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot abandon session from current phase",
        );
      }

      const updatedParticipants = session.participants.map((p) =>
        p.uid === uid ? { ...p, status: "left" as ParticipantStatus } : p,
      );
      // Keep all existing ACL UIDs so participants can see the abandoned notice
      tx.update(sessionRef, {
        phase: "abandoned",
        participants: updatedParticipants,
        participantUids: session.participantUids || [],
        updatedAt: now,
      });

      functions.logger.info("sessionsV3.leaveSessionV3.ABANDON", {
        sessionId,
        hostUid: uid,
      });
      return;
    }

    // If host leaves during active game → abandon
    if (participant.role === "host" && session.phase !== "lobby") {
      const updatedParticipants = session.participants.map((p) =>
        p.uid === uid ? { ...p, status: "left" as ParticipantStatus } : p,
      );
      // Keep all existing ACL UIDs so participants can see the abandoned notice
      tx.update(sessionRef, {
        phase: "abandoned",
        participants: updatedParticipants,
        participantUids: session.participantUids || [],
        updatedAt: now,
      });

      functions.logger.info("sessionsV3.leaveSessionV3.HOST_ABANDON_ACTIVE", {
        sessionId,
        hostUid: uid,
        previousPhase: session.phase,
      });
      return;
    }

    // Non-host leaves: mark as "left"
    const updatedParticipants = session.participants.map((p) =>
      p.uid === uid ? { ...p, status: "left" as ParticipantStatus } : p,
    );

    // Remove leaving user from ACL but preserve other invited users' UIDs
    const activeParticipantUids = updatedParticipants
      .filter((p) => p.status !== "left")
      .map((p) => p.uid);
    const mergedUids = [
      ...new Set([
        ...(session.participantUids || []).filter((u: string) => u !== uid),
        ...activeParticipantUids,
      ]),
    ];

    tx.update(sessionRef, {
      participants: updatedParticipants,
      participantUids: mergedUids,
      updatedAt: now,
    });

    functions.logger.info("sessionsV3.leaveSessionV3.LEFT", {
      sessionId,
      uid,
      role: participant.role,
    });
  });

  return { success: true };
});

// =============================================================================
// startSessionV3
// =============================================================================

export const startSessionV3 = functions.https.onCall(async (data, context) => {
  // --- Auth ---
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }
  const uid = context.auth.uid;

  // --- Validate input ---
  const { sessionId } = data as { sessionId?: string };

  if (!sessionId || typeof sessionId !== "string") {
    throw new HttpsError("invalid-argument", "sessionId is required");
  }

  // --- Transaction ---
  const result = await db.runTransaction(async (tx) => {
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
    const snap = await tx.get(sessionRef);

    if (!snap.exists) {
      throw new HttpsError("not-found", "Session not found");
    }

    const session = snap.data() as GameSessionV3;

    // Only host can start
    if (session.hostUid !== uid) {
      throw new HttpsError(
        "permission-denied",
        "Only the host can start the session",
      );
    }

    // Must be in lobby phase
    if (session.phase !== "lobby") {
      throw new HttpsError(
        "failed-precondition",
        `Cannot start session in "${session.phase}" phase`,
      );
    }

    // Validate transition
    if (!canTransitionPhase("lobby", "starting")) {
      throw new HttpsError(
        "failed-precondition",
        "Invalid phase transition from lobby to starting",
      );
    }

    // Need at least 2 active players for multiplayer
    const activePlayers = countActivePlayers(session.participants);
    if (session.runtimeType !== "solo" && activePlayers < 2) {
      throw new HttpsError(
        "failed-precondition",
        `Need at least 2 players to start (have ${activePlayers})`,
      );
    }

    const now = Date.now();

    // Mark all active players' status as "playing"
    const updatedParticipants = session.participants.map((p) => {
      if ((p.role === "host" || p.role === "player") && p.status === "joined") {
        return { ...p, status: "playing" as ParticipantStatus };
      }
      return p;
    });

    // Transition: lobby → starting → active
    // We go straight to "active" since the server-side game creation
    // is synchronous within this callable. For realtime games, the
    // Colyseus room ID will be set by the Colyseus server on connect.
    const mergedUids = [
      ...new Set([
        ...(session.participantUids || []),
        ...updatedParticipants
          .filter((p) => p.status !== "left")
          .map((p) => p.uid),
      ]),
    ];
    const updates: Partial<GameSessionV3> & Record<string, unknown> = {
      phase: "active",
      participants: updatedParticipants,
      participantUids: mergedUids,
      updatedAt: now,
    };

    // For turn-based games, create the Firestore game document
    if (session.runtimeType === "turnBased") {
      const gameRef = db.collection("TurnBasedGames").doc();
      const players = updatedParticipants
        .filter(
          (p) =>
            (p.role === "host" || p.role === "player") &&
            p.status === "playing",
        )
        .map((p) => ({
          id: p.uid,
          name: p.displayName,
          avatar: p.avatarUrl || "",
        }));

      // Create a minimal turn-based game doc
      const gameDoc = {
        gameType: session.gameType,
        players,
        status: "active" as const,
        currentTurnIndex: 0,
        currentTurnPlayerId: players[0]?.id || "",
        moves: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        sessionId, // back-link to v3 session
      };

      tx.set(gameRef, gameDoc);
      updates.firestoreGameId = gameRef.id;

      functions.logger.info("sessionsV3.startSessionV3.TURN_GAME_CREATED", {
        sessionId,
        firestoreGameId: gameRef.id,
        gameType: session.gameType,
      });
    } else {
      // For realtime games (Colyseus-based), use sessionId as the shared
      // matchmaking key so both players joinOrCreate the same room.
      updates.firestoreGameId = sessionId;

      functions.logger.info("sessionsV3.startSessionV3.REALTIME_GAME_KEY", {
        sessionId,
        firestoreGameId: sessionId,
        gameType: session.gameType,
      });
    }

    // Remove expiry since the game is now active
    updates.expiresAt =
      admin.firestore.FieldValue.delete() as unknown as undefined;

    tx.update(sessionRef, updates);

    return {
      success: true,
      ...(updates.firestoreGameId
        ? { firestoreGameId: updates.firestoreGameId }
        : {}),
      sourceInviteId: session.sourceInviteId,
    };
  });

  // ── R3-1 fix: Update the linked invite so it reflects "active" status ──
  // Without this, the invite pill/card in chat stays stale while the game
  // is already in progress. Runs outside the transaction (idempotent).
  if (result.sourceInviteId) {
    try {
      const inviteRef = db.collection("GameInvites").doc(result.sourceInviteId);
      await inviteRef.update({
        status: "active",
        ...(result.firestoreGameId ? { gameId: result.firestoreGameId } : {}),
        updatedAt: Date.now(),
      });
      functions.logger.info("sessionsV3.startSessionV3.INVITE_UPDATED", {
        sessionId,
        sourceInviteId: result.sourceInviteId,
      });
    } catch (invErr) {
      // Non-fatal — the invite is a display hint, not a critical path
      functions.logger.warn("sessionsV3.startSessionV3.INVITE_UPDATE_FAIL", {
        sessionId,
        sourceInviteId: result.sourceInviteId,
        error: invErr instanceof Error ? invErr.message : String(invErr),
      });
    }
  }

  functions.logger.info("sessionsV3.startSessionV3.OK", {
    sessionId,
    hostUid: uid,
  });

  return result;
});

// =============================================================================
// Session Reward Pipeline
// =============================================================================

/**
 * Outcome type mapping from session resolution to game result pipeline.
 * Session outcomes use "forfeit" / "timeout" / "error" which map to
 * "lose" for XP purposes (the non-winner). "win" and "draw" map directly.
 */
type GameResultOutcome = "win" | "lose" | "draw" | "completed";
type GameResultMode = "solo" | "turnBased" | "realtime";

// =============================================================================
// Score Limits (shared with achievementsV2Evaluator)
// =============================================================================

interface GameScoreLimits {
  minScore: number;
  maxScore: number;
}

const SOLO_SCORE_LIMITS: Record<string, GameScoreLimits> = {
  bounce_blitz: { minScore: 0, maxScore: 999999 },
  play_2048: { minScore: 0, maxScore: 999999 },
  word_master: { minScore: 1, maxScore: 6 },
  brick_breaker: { minScore: 0, maxScore: 896 },
  minesweeper_classic: { minScore: 1, maxScore: 9999 },
  snake_master: { minScore: 0, maxScore: 999999 },
  memory_master: { minScore: 0, maxScore: 999999 },
  tile_slide: { minScore: 0, maxScore: 999999 },
  clicker_mine: { minScore: 0, maxScore: 999999 },
  helix_drop: { minScore: 0, maxScore: 999999 },
};

function isSoloScoreSuspicious(score: number, gameType: string): boolean {
  const limits = SOLO_SCORE_LIMITS[gameType];
  if (!limits) return true; // unknown game type → reject
  return score < limits.minScore || score > limits.maxScore;
}

// =============================================================================
// processSoloGameResult — Server-authoritative solo game recording
// =============================================================================

/**
 * Server-side solo game result processor. Replaces all client-side direct
 * writes to GameHighScores, Leaderboards, GameSessions, and user coins.
 *
 * The client sends raw game facts; this function validates the score,
 * writes all records via Admin SDK, and returns the computed results.
 *
 * Feature-flagged: clients with FF_SERVER_SOLO_WRITES=true call this
 * instead of doing direct Firestore writes.
 */
export const processSoloGameResult = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = context.auth.uid;
    const { gameType, score, durationMs, stats, gameSpecific } = data as {
      gameType: string;
      score: number;
      durationMs?: number;
      stats?: Record<string, unknown>;
      gameSpecific?: Record<string, number>;
    };

    // ── Input validation ────────────────────────────────────────────────
    if (!gameType || typeof gameType !== "string") {
      throw new HttpsError("invalid-argument", "gameType required");
    }
    if (typeof score !== "number") {
      throw new HttpsError("invalid-argument", "valid score required");
    }

    // Anti-cheat: score range validation
    if (isSoloScoreSuspicious(score, gameType)) {
      functions.logger.warn("processSoloGameResult.SUSPICIOUS_SCORE", {
        uid,
        gameType,
        score,
      });
      throw new HttpsError("invalid-argument", "Score out of valid range");
    }

    const now = Date.now();
    const sessionId = `solo_${uid}_${now}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      // ── 1. Read current high score (transactional) ──────────────────
      const highScoreRef = db
        .collection("Users")
        .doc(uid)
        .collection("GameHighScores")
        .doc(gameType);

      const highScoreSnap = await highScoreRef.get();
      const currentHighScore = highScoreSnap.exists
        ? (highScoreSnap.data()?.highScore ?? 0)
        : 0;
      const currentTotalGames = highScoreSnap.exists
        ? (highScoreSnap.data()?.totalGames ?? 0)
        : 0;
      const isNewHighScore = score > currentHighScore;

      // ── 2. Calculate coins (server-side copy of client logic) ───────
      let coins = 5; // base
      if (isNewHighScore) coins += 10;
      switch (gameType) {
        case "bounce_blitz":
          coins += Math.floor(score / 50);
          break;
        case "word_master":
          coins += score > 0 ? 15 : 0;
          break;
        default:
          coins += Math.floor(score / 100);
      }
      coins = Math.min(coins, 100); // cap

      // ── 3. Write session doc ────────────────────────────────────────
      const sessionDoc = {
        id: sessionId,
        playerId: uid,
        gameType,
        finalScore: score,
        highScore: isNewHighScore ? score : currentHighScore,
        isNewHighScore,
        startedAt: now - (durationMs || 0),
        endedAt: now,
        duration: durationMs ? Math.round(durationMs / 1000) : 0,
        stats: stats || {},
        coinsEarned: coins,
        createdAt: admin.firestore.Timestamp.now(),
      };

      await db
        .collection("Users")
        .doc(uid)
        .collection("GameSessions")
        .doc(sessionId)
        .set(sessionDoc);

      // ── 4. Update high score ────────────────────────────────────────
      if (isNewHighScore) {
        await highScoreRef.set(
          {
            gameType,
            highScore: score,
            achievedAt: admin.firestore.Timestamp.now(),
            totalGames: admin.firestore.FieldValue.increment(1),
          },
          { merge: true },
        );
      } else {
        await highScoreRef.set(
          { totalGames: admin.firestore.FieldValue.increment(1) },
          { merge: true },
        );
      }

      // ── 5. Update leaderboards (all-time, weekly, daily) ────────────
      if (isNewHighScore) {
        const userSnap = await db.collection("Users").doc(uid).get();
        const userData = userSnap.data();
        const playerName =
          userData?.displayName || userData?.username || "Player";
        const playerAvatar = userData?.avatarConfig;

        const leaderboardEntry = {
          playerId: uid,
          playerName,
          playerAvatar: playerAvatar || null,
          score,
          achievedAt: admin.firestore.Timestamp.now(),
        };

        const weekNum = Math.ceil(
          ((now - new Date(new Date().getFullYear(), 0, 1).getTime()) /
            86400000 +
            new Date(new Date().getFullYear(), 0, 1).getDay() +
            1) /
            7,
        );
        const weekKey = `${new Date().getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
        const dayKey = new Date().toISOString().split("T")[0];

        const batch = db.batch();
        batch.set(
          db
            .collection("Leaderboards")
            .doc(gameType)
            .collection("allTime")
            .doc(uid),
          leaderboardEntry,
        );
        batch.set(
          db
            .collection("Leaderboards")
            .doc(gameType)
            .collection(`weekly_${weekKey}`)
            .doc(uid),
          leaderboardEntry,
        );
        batch.set(
          db
            .collection("Leaderboards")
            .doc(gameType)
            .collection(`daily_${dayKey}`)
            .doc(uid),
          leaderboardEntry,
        );
        await batch.commit();
      }

      // ── 6. Award coins ─────────────────────────────────────────────
      if (coins > 0) {
        await db
          .collection("Users")
          .doc(uid)
          .update({
            coins: admin.firestore.FieldValue.increment(coins),
          });
      }

      // ── 7. Update per-game stats + evaluate achievements ───────────
      const mergedGameSpecific: Record<string, number> = {
        ...(gameSpecific || {}),
        bestScore: score,
      };

      await updatePerGameStatsV2(
        uid,
        gameType,
        "completed",
        score,
        mergedGameSpecific,
      );

      const evalResult = await evaluateAchievementsV2(uid);

      // ── 8. Award XP ────────────────────────────────────────────────
      const xpResult = await awardGameXp(
        uid,
        gameType,
        "completed",
        score,
        "solo",
      );

      functions.logger.info("processSoloGameResult.DONE", {
        uid,
        gameType,
        score,
        isNewHighScore,
        coins,
        xpEarned: xpResult.xpEarned,
        achievementsUnlocked: evalResult.newUnlocks.length,
      });

      return {
        success: true,
        sessionId,
        isNewHighScore,
        highScore: isNewHighScore ? score : currentHighScore,
        totalGames: currentTotalGames + 1,
        coinsEarned: coins,
        xpEarned: xpResult.xpEarned,
        didLevelUp: xpResult.didLevelUp,
        level: xpResult.level,
        achievementsUnlocked: evalResult.newUnlocks.map((u) => u.achievementId),
        rewardsGranted: evalResult.rewardsGranted,
      };
    } catch (err) {
      functions.logger.error("processSoloGameResult.FAIL", {
        uid,
        gameType,
        score,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new HttpsError("internal", "Failed to process solo game result");
    }
  },
);

/**
 * Process rewards (XP, per-game stats, achievements) for all participants
 * in a resolved v3 session, then write the computed awards back to the
 * session document under `resolution.xpAwarded`, `resolution.achievementsUnlocked`,
 * and `resolution.rewardsProcessed`.
 *
 * Idempotent: if `resolution.rewardsProcessed` is already `true`, returns
 * immediately without re-awarding.
 *
 * Called from:
 *   - resolveSessionV3 (primary path — inline after resolve transaction)
 *   - watchdogSessionsV3 Pass 4 (retry path — catches missed rewards)
 *
 * @param sessionId - The v3 session document ID
 * @param outcome - Session outcome (win, draw, forfeit, timeout, error)
 * @param winnerUid - Winner UID (if applicable)
 * @param scores - Per-participant scores (if applicable)
 */
async function processSessionRewards(
  sessionId: string,
  outcome: SessionResolution["outcome"],
  winnerUid?: string,
  scores?: Record<string, number>,
): Promise<void> {
  const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);

  // ── Atomic idempotency check via transaction ────────────────────────
  // This prevents the TOCTOU race where concurrent Cloud Function retries
  // both read rewardsProcessed=false and double-award XP/achievements.
  const shouldProcess = await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) return false;

    const session = snap.data() as GameSessionV3;

    // Already processed — idempotent
    if (session.resolution?.rewardsProcessed) {
      functions.logger.info("processSessionRewards.ALREADY_PROCESSED", {
        sessionId,
      });
      return false;
    }

    // Only process resolved sessions
    if (session.phase !== "resolved") {
      functions.logger.warn("processSessionRewards.NOT_RESOLVED", {
        sessionId,
        phase: session.phase,
      });
      return false;
    }

    // Atomically claim the reward processing slot
    tx.update(sessionRef, {
      "resolution.rewardsProcessed": true,
      "resolution.rewardsProcessedAt": Date.now(),
      updatedAt: Date.now(),
    });

    return true;
  });

  if (!shouldProcess) return;

  // ── Now we hold the exclusive claim — process rewards ───────────────
  // Re-read session outside transaction for the actual reward computation
  const snap = await sessionRef.get();
  if (!snap.exists) return;
  const session = snap.data() as GameSessionV3;

  const gameType = session.gameType;
  const runtimeType = session.runtimeType as GameResultMode;

  // Collect active participants (host + player roles, not spectators/left)
  const activePlayers = session.participants.filter(
    (p) =>
      (p.role === "host" || p.role === "player") &&
      p.status !== "left" &&
      p.status !== "invited",
  );

  if (activePlayers.length === 0) {
    functions.logger.warn("processSessionRewards.NO_ACTIVE_PLAYERS", {
      sessionId,
    });
    return;
  }

  const xpAwarded: Record<string, number> = {};
  const achievementsUnlocked: Record<string, string[]> = {};

  // Use the session-level outcome + winnerUid to derive per-player outcomes
  const effectiveWinner = winnerUid || session.resolution?.winnerUid;
  const effectiveOutcome = outcome || session.resolution?.outcome || "error";

  for (const player of activePlayers) {
    try {
      // Derive per-player outcome
      let playerOutcome: "win" | "loss" | "draw";
      if (effectiveOutcome === "draw") {
        playerOutcome = "draw";
      } else if (effectiveOutcome === "win" && effectiveWinner) {
        playerOutcome = player.uid === effectiveWinner ? "win" : "loss";
      } else if (
        effectiveOutcome === "forfeit" ||
        effectiveOutcome === "timeout"
      ) {
        // Forfeit/timeout: winner (if any) gets "win", others get "loss"
        if (effectiveWinner) {
          playerOutcome = player.uid === effectiveWinner ? "win" : "loss";
        } else {
          playerOutcome = "draw"; // No winner identified → draw
        }
      } else {
        // Error or unknown → draw (no penalty for errors)
        playerOutcome = "draw";
      }

      // Map to XP outcome format
      const xpOutcome: GameResultOutcome =
        playerOutcome === "loss" ? "lose" : playerOutcome;

      const playerScore = scores?.[player.uid] ?? player.score;

      // 1. Award XP
      const xpResult = await awardGameXp(
        player.uid,
        gameType,
        xpOutcome,
        playerScore ?? undefined,
        runtimeType,
      );
      xpAwarded[player.uid] = xpResult.xpEarned;

      // 2. Update per-game stats
      await updatePerGameStatsV2(
        player.uid,
        gameType,
        playerOutcome,
        playerScore ?? undefined,
      );

      // 3. Evaluate achievements
      const evalResult = await evaluateAchievementsV2(player.uid);
      const newUnlocks = evalResult.newUnlocks.map((u) => u.achievementId);
      if (newUnlocks.length > 0) {
        achievementsUnlocked[player.uid] = newUnlocks;
      }

      functions.logger.info("processSessionRewards.PLAYER_OK", {
        sessionId,
        uid: player.uid,
        playerOutcome,
        xpEarned: xpResult.xpEarned,
        achievementsUnlocked: newUnlocks.length,
        didLevelUp: xpResult.didLevelUp,
      });
    } catch (playerErr) {
      // Non-critical — continue processing other players
      functions.logger.warn("processSessionRewards.PLAYER_FAIL", {
        sessionId,
        uid: player.uid,
        error:
          playerErr instanceof Error ? playerErr.message : String(playerErr),
      });
    }
  }

  // Write computed reward details back to session doc
  const rewardPatch: Record<string, unknown> = {
    "resolution.xpAwarded": xpAwarded,
    updatedAt: Date.now(),
  };
  if (Object.keys(achievementsUnlocked).length > 0) {
    rewardPatch["resolution.achievementsUnlocked"] = achievementsUnlocked;
  }

  await sessionRef.update(rewardPatch);

  functions.logger.info("processSessionRewards.DONE", {
    sessionId,
    playerCount: activePlayers.length,
    totalXp: Object.values(xpAwarded).reduce((a, b) => a + b, 0),
    totalAchievements: Object.values(achievementsUnlocked).reduce(
      (a, b) => a + b.length,
      0,
    ),
  });
}

// =============================================================================
// resolveSessionV3
// =============================================================================

/**
 * Transition a session to "resolved" (or "abandoned") with resolution data.
 *
 * Called by:
 *   - Colyseus persistence bridge (room onDispose)
 *   - processGameCompletion / processRealtimeGameCompletion triggers
 *   - Client-side completion paths (via callable)
 *
 * Idempotent: if the session is already terminal, returns success.
 */
export const resolveSessionV3 = functions.https.onCall(
  async (data, context) => {
    // Auth is optional — server-side triggers call without user context
    // But if called from client, we verify the caller is a participant
    const callerUid = context.auth?.uid;

    const {
      sessionId,
      outcome,
      winnerUid,
      scores,
      firestoreGameId,
      resolvedBy = "server",
    } = data as {
      sessionId?: string;
      outcome?: string;
      winnerUid?: string;
      scores?: Record<string, number>;
      firestoreGameId?: string;
      resolvedBy?: string;
    };

    if (!sessionId || typeof sessionId !== "string") {
      throw new HttpsError("invalid-argument", "sessionId is required");
    }
    if (
      !outcome ||
      !["win", "draw", "forfeit", "timeout", "error"].includes(outcome)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "outcome must be win, draw, forfeit, timeout, or error",
      );
    }

    const result = await db.runTransaction(async (tx) => {
      const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
      const snap = await tx.get(sessionRef);

      if (!snap.exists) {
        // Already cleaned up — idempotent success
        return { success: true, alreadyCleaned: true };
      }

      const session = snap.data() as GameSessionV3;

      // Already terminal — idempotent success
      if (TERMINAL_PHASES.has(session.phase)) {
        return { success: true, alreadyTerminal: true };
      }

      // If called from client, verify participant
      if (callerUid) {
        const isParticipant = session.participants.some(
          (p) => p.uid === callerUid,
        );
        if (!isParticipant) {
          throw new HttpsError(
            "permission-denied",
            "You are not a participant in this session",
          );
        }
      }

      // D4-2 fix: Validate winnerUid is actually a participant
      if (winnerUid) {
        const winnerIsParticipant = session.participants.some(
          (p) => p.uid === winnerUid && p.status !== "left",
        );
        if (!winnerIsParticipant) {
          throw new HttpsError(
            "invalid-argument",
            `winnerUid "${winnerUid}" is not an active participant`,
          );
        }
      }

      // D4-2 fix: Validate score UIDs are all participants
      if (scores) {
        const participantUids = new Set(session.participants.map((p) => p.uid));
        for (const scoreUid of Object.keys(scores)) {
          if (!participantUids.has(scoreUid)) {
            throw new HttpsError(
              "invalid-argument",
              `Score UID "${scoreUid}" is not a session participant`,
            );
          }
        }
      }

      const now = Date.now();

      // Mark all active players as "finished"
      const updatedParticipants = session.participants.map((p) => {
        if (p.status === "playing" || p.status === "joined") {
          const isWinner = winnerUid ? p.uid === winnerUid : undefined;
          const score = scores?.[p.uid];
          return {
            ...p,
            status: "finished" as ParticipantStatus,
            ...(isWinner !== undefined ? { isWinner } : {}),
            ...(score !== undefined ? { score } : {}),
          };
        }
        return p;
      });

      const resolution: SessionResolution = {
        outcome: outcome as SessionResolution["outcome"],
        resolvedAt: now,
        ...(winnerUid ? { winnerUid } : {}),
        ...(scores ? { scores } : {}),
        ...(firestoreGameId ? { firestoreGameId } : {}),
        ...(session.sourceInviteId
          ? { sourceInviteId: session.sourceInviteId }
          : {}),
      };

      tx.update(sessionRef, {
        phase: "resolved",
        participants: updatedParticipants,
        // Preserve all ACL UIDs so everyone can read the resolved session
        participantUids: session.participantUids || [],
        resolution,
        updatedAt: now,
      });

      return { success: true };
    });

    // ── Finalize linked v2 invite (if dual-write created one) ────────
    // resolveSessionV3 is the canonical v3 completion path; we must also
    // hide the corresponding v2 GameInvites doc so it disappears from chat.
    // This is idempotent: if the invite was already finalized by
    // processGameCompletion / deleteGameAndInvite / the watchdog, the
    // second call is a no-op.
    if (!result.alreadyCleaned && !result.alreadyTerminal) {
      try {
        // Re-read session to get sourceInviteId (we're outside the tx now)
        const sessionSnap = await db
          .collection(SESSIONS_COLLECTION)
          .doc(sessionId)
          .get();
        const sessionData = sessionSnap.data() as GameSessionV3 | undefined;
        const sourceInviteId = sessionData?.sourceInviteId;

        if (sourceInviteId) {
          const inviteRef = db.collection("GameInvites").doc(sourceInviteId);
          const inviteSnap = await inviteRef.get();
          if (inviteSnap.exists) {
            const inv = inviteSnap.data()!;
            const invNow = Date.now();
            const TERMINAL = new Set([
              "completed",
              "declined",
              "expired",
              "cancelled",
            ]);
            const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
            const patch: Record<string, unknown> = {};

            if (!TERMINAL.has(inv.status)) {
              patch.status = "completed";
              patch.completedAt = invNow;
            }
            if (inv.chatVisibility !== "hidden") {
              patch.chatVisibility = "hidden";
              patch.chatHiddenAt = invNow;
            }
            if (!inv.resolvedAt) patch.resolvedAt = invNow;
            if (!inv.resolvedBy) patch.resolvedBy = resolvedBy || "server";
            if (!inv.deleteAt) patch.deleteAt = invNow + SIX_HOURS_MS;
            if (
              (!inv.chatHiddenInConversationIds ||
                inv.chatHiddenInConversationIds.length === 0) &&
              inv.conversationId
            ) {
              patch.chatHiddenInConversationIds = [inv.conversationId];
            }
            const resType = winnerUid
              ? "win"
              : outcome === "draw"
                ? "draw"
                : outcome === "forfeit"
                  ? "resign"
                  : outcome === "timeout"
                    ? "timeout"
                    : "disconnect";
            if (!inv.resolutionType) patch.resolutionType = resType;
            if (winnerUid && !inv.winnerId) patch.winnerId = winnerUid;

            if (Object.keys(patch).length > 0) {
              patch.updatedAt = invNow;
              await inviteRef.update(patch);
              functions.logger.info(
                "sessionsV3.resolveSessionV3.INVITE_FINALIZED",
                { sessionId, sourceInviteId, patchKeys: Object.keys(patch) },
              );
            }
          }
        }
      } catch (invErr) {
        // Non-fatal — invite will be caught by watchdog
        functions.logger.warn(
          "sessionsV3.resolveSessionV3.INVITE_FINALIZE_FAIL",
          {
            sessionId,
            error: invErr instanceof Error ? invErr.message : String(invErr),
          },
        );
      }
    }

    functions.logger.info("sessionsV3.resolveSessionV3.OK", {
      sessionId,
      outcome,
      winnerUid,
      resolvedBy,
    });

    // ── Process rewards (XP, stats, achievements) ────────────────────
    // Runs AFTER the resolve transaction and invite finalization.
    // This is the canonical reward path for v3 sessions — the legacy
    // triggers (processGameCompletion, processRealtimeGameCompletion)
    // skip rewards when they detect a v3 sessionId on the game doc.
    // NOTE (D4-7 fix): Also process rewards when alreadyTerminal, because
    // the Colyseus bridge writes phase:"resolved" first, then calls this
    // CF. processSessionRewards has its own idempotency guard via the
    // rewardsProcessed flag, so double-calls are safe.
    if (!result.alreadyCleaned) {
      try {
        await processSessionRewards(
          sessionId,
          outcome as SessionResolution["outcome"],
          winnerUid,
          scores,
        );
      } catch (rewardErr) {
        // Non-fatal — session is already resolved. The watchdog Pass 4
        // will retry reward processing for sessions missing rewardsProcessed.
        functions.logger.warn("sessionsV3.resolveSessionV3.REWARDS_FAILED", {
          sessionId,
          error:
            rewardErr instanceof Error ? rewardErr.message : String(rewardErr),
        });
      }
    }

    return result;
  },
);

// =============================================================================
// inviteToSessionV3
// =============================================================================

/**
 * Send a game invite to a conversation (DM or group).
 *
 * Creates a `GameInvites` pointer doc so the chat's invite pill subscription
 * renders it immediately. Optionally stamps `conversationId` on the session
 * so `subscribeToConversationSessions` can discover it.
 *
 * INVARIANT: This function NEVER modifies `GameSessions.participants`.
 * Participants are only added by `joinSessionV3` (explicit Join action).
 */
export const inviteToSessionV3 = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;

    const {
      sessionId,
      conversationId,
      recipientUid,
      eligibleUserIds: rawEligible,
    } = data as {
      sessionId?: string;
      conversationId?: string;
      /** For DM invites — single recipient UID. */
      recipientUid?: string;
      /** For group invites — all member UIDs who should see the pill. */
      eligibleUserIds?: string[];
    };

    if (!sessionId || typeof sessionId !== "string") {
      throw new HttpsError("invalid-argument", "sessionId is required");
    }
    if (!conversationId || typeof conversationId !== "string") {
      throw new HttpsError("invalid-argument", "conversationId is required");
    }
    // Must supply either recipientUid (DM) or eligibleUserIds (group)
    if (
      (!recipientUid || typeof recipientUid !== "string") &&
      (!Array.isArray(rawEligible) || rawEligible.length === 0)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "recipientUid or eligibleUserIds is required",
      );
    }

    // --- Validate session (read-only — NO participant mutation) ---
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
    const snap = await sessionRef.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Session not found");
    }

    const session = snap.data() as GameSessionV3;

    if (session.phase !== "lobby") {
      throw new HttpsError(
        "failed-precondition",
        `Cannot invite to session in "${session.phase}" phase`,
      );
    }

    // Caller must be an active participant (host or player)
    const caller = session.participants.find(
      (p) => p.uid === uid && p.status !== "left",
    );
    if (!caller) {
      throw new HttpsError(
        "permission-denied",
        "Only session participants can invite others",
      );
    }

    // --- Build eligibleUserIds for the GameInvites doc ---
    // For DM: [sender, recipient]
    // For group: rawEligible (all group members) + ensure sender is included
    let eligible: string[];
    if (Array.isArray(rawEligible) && rawEligible.length > 0) {
      // Group invite — use provided member UIDs, ensure sender is included
      const set = new Set(rawEligible.filter((id) => typeof id === "string"));
      set.add(uid);
      eligible = [...set];
    } else {
      // DM invite — sender + recipient
      eligible = [uid, recipientUid!];
    }

    // --- Update session: stamp conversationId + grant read access ---
    //
    // `participantUids` is the Firestore-rules access-control list.
    // We add all eligible UIDs so invited users can read the session
    // doc when they navigate to the lobby. This does NOT touch the
    // `participants` array — only joinSessionV3 adds real participants.
    //
    // INVARIANT: participants array is NEVER modified here.
    const existingUids: string[] = session.participantUids ?? [];
    const mergedUids = [...new Set([...existingUids, ...eligible])];
    const needsUidsUpdate = mergedUids.length > existingUids.length;
    const needsConvoUpdate = !session.conversationId && conversationId;

    if (needsUidsUpdate || needsConvoUpdate) {
      const updatePayload: Record<string, unknown> = {
        updatedAt: Date.now(),
      };
      if (needsUidsUpdate) {
        updatePayload.participantUids = mergedUids;
      }
      if (needsConvoUpdate) {
        updatePayload.conversationId = conversationId;
      }
      await sessionRef.update(updatePayload);

      functions.logger.info("sessionsV3.inviteToSessionV3.sessionUpdate", {
        sessionId,
        addedUids: mergedUids.length - existingUids.length,
        conversationIdStamped: !!needsConvoUpdate,
      });
    }

    // --- Create GameInvites doc (the chat pointer pill) ---
    const senderProfile = await getUserProfile(uid);
    const now = Date.now();

    const inviteRef = db.collection("GameInvites").doc();
    const inviteId = inviteRef.id;

    const isDm = conversationId.includes("_");

    await inviteRef.set({
      id: inviteId,
      gameType: session.gameType,
      senderId: uid,
      senderName: senderProfile.displayName,
      senderAvatar: senderProfile.avatarUrl || "",
      context: isDm ? "dm" : "group",
      conversationId,
      targetType: isDm ? "specific" : "universal",
      eligibleUserIds: eligible,
      requiredPlayers: session.maxParticipants,
      maxPlayers: session.maxParticipants,
      claimedSlots: [
        {
          playerId: uid,
          playerName: senderProfile.displayName,
          playerAvatar: senderProfile.avatarUrl || "",
          claimedAt: now,
          isHost: session.hostUid === uid,
        },
      ],
      status: "pending",
      inviteVersion: 3,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + SESSION_LOBBY_TTL_MS,
      spectatingEnabled: true,
      spectatorOnly: false,
      spectators: [],
      showInPlayPage: false,
      v3SessionId: sessionId,
      traceId: session.traceId || "",
    });

    functions.logger.info("sessionsV3.inviteToSessionV3.OK", {
      sessionId,
      invitedBy: uid,
      conversationId,
      inviteId,
      eligibleCount: eligible.length,
      isDm,
    });

    return {
      success: true,
      inviteId,
      alreadyInvited: false,
    };
  },
);

// =============================================================================
// watchdogSessionsV3 — Scheduled cleanup of stale sessions
// =============================================================================

const SESSION_ACTIVE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const INVITE_DELETE_DELAY_MS = 6 * 60 * 60 * 1000; // 6 hours — matches games.ts

/**
 * Helper: finalize the linked v2 GameInvites doc for a session.
 * Non-fatal — if the invite is already terminal or missing, this is a no-op.
 */
async function finalizeLinkedInvite(
  session: GameSessionV3,
  terminalStatus: "completed" | "cancelled" | "expired" | "declined",
  resolutionType: string,
  resolvedBy: "server" | "watchdog",
): Promise<void> {
  const sourceInviteId = session.sourceInviteId;
  if (!sourceInviteId) return;

  try {
    const inviteRef = db.collection("GameInvites").doc(sourceInviteId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) return;

    const inv = inviteSnap.data()!;
    const now = Date.now();
    const TERMINAL = new Set(["completed", "declined", "expired", "cancelled"]);
    const patch: Record<string, unknown> = {};

    if (!TERMINAL.has(inv.status)) {
      patch.status = terminalStatus;
      patch.completedAt = now;
    }
    if (inv.chatVisibility !== "hidden") {
      patch.chatVisibility = "hidden";
      patch.chatHiddenAt = now;
    }
    if (!inv.resolvedAt) patch.resolvedAt = now;
    if (!inv.resolvedBy) patch.resolvedBy = resolvedBy;
    if (!inv.deleteAt) patch.deleteAt = now + INVITE_DELETE_DELAY_MS;
    if (!inv.resolutionType) patch.resolutionType = resolutionType;
    if (
      (!inv.chatHiddenInConversationIds ||
        inv.chatHiddenInConversationIds.length === 0) &&
      inv.conversationId
    ) {
      patch.chatHiddenInConversationIds = [inv.conversationId];
    }

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = now;
      await inviteRef.update(patch);
    }
  } catch (err) {
    // Non-fatal — the games.ts watchdog will catch it
    functions.logger.warn("watchdogSessionsV3.INVITE_FINALIZE_FAIL", {
      sourceInviteId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Scheduled function that runs every 15 minutes to:
 *
 * Pass 1: Expire lobby sessions past their TTL (expiresAt < now)
 * Pass 2: Abandon active sessions with no updates for 4 hours
 *
 * Both passes also finalize the linked v2 GameInvites doc so it
 * disappears from chat. This is belt-and-suspenders — the primary
 * finalization happens in resolveSessionV3 / room disposal, but the
 * watchdog catches anything that slipped through.
 *
 * Idempotent — safe to run concurrently or with overlapping windows.
 */
export const watchdogSessionsV3 = functions.pubsub
  .schedule("every 15 minutes")
  .onRun(async () => {
    const now = Date.now();
    let expiredCount = 0;
    let abandonedCount = 0;

    // ── Pass 1: Expire stale lobby sessions ───────────────────────────────
    try {
      const lobbySnap = await db
        .collection(SESSIONS_COLLECTION)
        .where("phase", "==", "lobby")
        .where("expiresAt", "<", now)
        .limit(200)
        .get();

      for (const doc of lobbySnap.docs) {
        try {
          const session = doc.data() as GameSessionV3;
          if (session.phase !== "lobby") continue; // double-check

          await doc.ref.update({
            phase: "expired",
            updatedAt: now,
          });
          // Also finalize the linked v2 invite
          await finalizeLinkedInvite(session, "expired", "expire", "watchdog");
          expiredCount++;
        } catch (err) {
          functions.logger.error("watchdogSessionsV3.EXPIRE_FAIL", {
            sessionId: doc.id,
            error: err,
          });
        }
      }
    } catch (err) {
      functions.logger.error("watchdogSessionsV3.PASS1_FAIL", { error: err });
    }

    // ── Pass 2: Abandon stuck active sessions ─────────────────────────────
    try {
      const cutoff = now - SESSION_ACTIVE_TTL_MS;
      const activeSnap = await db
        .collection(SESSIONS_COLLECTION)
        .where("phase", "==", "active")
        .where("updatedAt", "<", cutoff)
        .limit(200)
        .get();

      for (const doc of activeSnap.docs) {
        try {
          const session = doc.data() as GameSessionV3;
          if (session.phase !== "active") continue;

          await doc.ref.update({
            phase: "abandoned",
            updatedAt: now,
          });
          // Also finalize the linked v2 invite
          await finalizeLinkedInvite(
            session,
            "cancelled",
            "disconnect",
            "watchdog",
          );
          abandonedCount++;
        } catch (err) {
          functions.logger.error("watchdogSessionsV3.ABANDON_FAIL", {
            sessionId: doc.id,
            error: err,
          });
        }
      }
    } catch (err) {
      functions.logger.error("watchdogSessionsV3.PASS2_FAIL", { error: err });
    }

    // ── Pass 3: Catch orphaned invites for recently-terminal sessions ──────
    // resolveSessionV3 finalizes invites post-transaction, but if that
    // non-fatal step failed (network blip, cold-start timeout, etc.) the
    // invite lingers in chat.  This pass catches them.
    let orphanCount = 0;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    for (const termPhase of ["resolved", "abandoned"] as const) {
      try {
        const snap = await db
          .collection(SESSIONS_COLLECTION)
          .where("phase", "==", termPhase)
          .limit(200)
          .get();

        for (const doc of snap.docs) {
          try {
            const session = doc.data() as GameSessionV3;
            if (!session.sourceInviteId) continue;
            // Skip sessions terminal for >24 h — already scanned
            if (
              session.updatedAt &&
              session.updatedAt < now - TWENTY_FOUR_HOURS
            )
              continue;

            await finalizeLinkedInvite(
              session,
              termPhase === "resolved" ? "completed" : "cancelled",
              termPhase === "resolved" ? "system" : "disconnect",
              "watchdog",
            );
            orphanCount++;
          } catch (err) {
            functions.logger.error("watchdogSessionsV3.PASS3_ITEM_FAIL", {
              sessionId: doc.id,
              error: err,
            });
          }
        }
      } catch (err) {
        functions.logger.warn(`watchdogSessionsV3.PASS3_${termPhase}_FAIL`, {
          error: String(err),
        });
      }
    }

    // ── Pass 4: Retry reward processing for resolved sessions ────────────
    // If resolveSessionV3's post-transaction reward step failed (cold-start
    // timeout, network blip, etc.), the session is resolved but
    // resolution.rewardsProcessed is missing/false. This pass retries.
    let rewardRetryCount = 0;
    try {
      const resolvedSnap = await db
        .collection(SESSIONS_COLLECTION)
        .where("phase", "==", "resolved")
        .limit(200)
        .get();

      for (const doc of resolvedSnap.docs) {
        try {
          const session = doc.data() as GameSessionV3;

          // Skip if already processed
          if (session.resolution?.rewardsProcessed) continue;

          // Skip sessions resolved > 24 h ago — too old for retry
          const resolvedAt =
            session.resolution?.resolvedAt ?? session.updatedAt;
          if (resolvedAt && resolvedAt < now - TWENTY_FOUR_HOURS) continue;

          // Skip sessions resolved < 2 min ago — give resolveSessionV3 time
          const TWO_MINUTES = 2 * 60 * 1000;
          if (resolvedAt && resolvedAt > now - TWO_MINUTES) continue;

          functions.logger.info("watchdogSessionsV3.PASS4_RETRY_REWARDS", {
            sessionId: doc.id,
            gameType: session.gameType,
            resolvedAt,
          });

          await processSessionRewards(
            doc.id,
            session.resolution?.outcome || "error",
            session.resolution?.winnerUid,
            session.resolution?.scores,
          );
          rewardRetryCount++;
        } catch (err) {
          functions.logger.error("watchdogSessionsV3.PASS4_ITEM_FAIL", {
            sessionId: doc.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      functions.logger.error("watchdogSessionsV3.PASS4_FAIL", {
        error: String(err),
      });
    }

    // ── Pass 5: Abandon stuck "starting" sessions ─────────────────────
    // If the starting→active transition fails (e.g. Colyseus room creation
    // times out), the session stays in "starting" forever. Neither Pass 1
    // (lobby expire) nor Pass 2 (active abandon) catches it.
    const STARTING_TTL_MS = 10 * 60 * 1000; // 10 minutes
    let stuckStartingCount = 0;
    try {
      const startingCutoff = now - STARTING_TTL_MS;
      const startingSnap = await db
        .collection(SESSIONS_COLLECTION)
        .where("phase", "==", "starting")
        .where("updatedAt", "<", startingCutoff)
        .limit(100)
        .get();

      for (const doc of startingSnap.docs) {
        try {
          await doc.ref.update({
            phase: "abandoned",
            updatedAt: now,
            "resolution.outcome": "error",
            "resolution.resolvedAt": now,
            "resolution.reason": "stuck_starting",
          });
          stuckStartingCount++;

          // D4-5 fix: Also finalize the linked invite so the chat pill
          // doesn't stay stale forever when the session gets abandoned.
          const sessionData = doc.data() as GameSessionV3;
          await finalizeLinkedInvite(
            sessionData,
            "cancelled",
            "error",
            "watchdog",
          );

          functions.logger.info("watchdogSessionsV3.PASS5_STUCK_STARTING", {
            sessionId: doc.id,
            updatedAt: doc.data().updatedAt,
          });
        } catch (err) {
          functions.logger.error("watchdogSessionsV3.PASS5_ITEM_FAIL", {
            sessionId: doc.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      functions.logger.error("watchdogSessionsV3.PASS5_FAIL", {
        error: String(err),
      });
    }

    functions.logger.info("watchdogSessionsV3.DONE", {
      expiredCount,
      abandonedCount,
      orphanCount,
      rewardRetryCount,
      stuckStartingCount,
    });
  });

// =============================================================================
// cleanupOldV3Sessions — D4-4 fix
// =============================================================================

/**
 * Scheduled function that hard-deletes terminal GameSessions docs older
 * than 90 days. Without this, the GameSessions collection grows unbounded
 * because resolved/abandoned/expired sessions are never removed.
 *
 * Runs daily at 03:00 UTC (low-traffic window).
 */
export const cleanupOldV3Sessions = functions.pubsub
  .schedule("every day 03:00")
  .timeZone("UTC")
  .onRun(async () => {
    const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
    const cutoff = Date.now() - RETENTION_MS;
    const BATCH_SIZE = 200;
    let deletedCount = 0;

    try {
      for (const phase of TERMINAL_PHASES) {
        let hasMore = true;
        while (hasMore) {
          const snap = await db
            .collection(SESSIONS_COLLECTION)
            .where("phase", "==", phase)
            .where("updatedAt", "<", cutoff)
            .limit(BATCH_SIZE)
            .get();

          if (snap.empty) {
            hasMore = false;
            break;
          }

          const batch = db.batch();
          for (const doc of snap.docs) {
            batch.delete(doc.ref);
          }
          await batch.commit();
          deletedCount += snap.size;

          // If we got fewer than batch size, no more pages
          if (snap.size < BATCH_SIZE) {
            hasMore = false;
          }
        }
      }

      functions.logger.info("cleanupOldV3Sessions.DONE", { deletedCount });
    } catch (err) {
      functions.logger.error("cleanupOldV3Sessions.FAIL", {
        deletedCount,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
