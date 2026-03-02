/**
 * Game Sessions Service (v3)
 *
 * Client-side Firestore operations for the `GameSessions/{sessionId}` collection.
 *
 * Responsibilities:
 *   - Subscribe to a session document (real-time listener)
 *   - Subscribe to sessions for a conversation (chat list)
 *   - Call v3 Cloud Function callables (create, join, leave, start)
 *   - Optimistic UI helpers
 *
 * All writes go through Cloud Function callables — the client never
 * writes directly to the sessions collection. This ensures server-side
 * validation of phase transitions and participant limits.
 *
 * @module services/gameSessions
 */

import { GAME_SESSIONS_V3 } from "@/constants/featureFlags";
import type {
  CreateSessionParams,
  CreateSessionResult,
  GameSessionV3,
  InviteToSessionParams,
  InviteToSessionResult,
  JoinSessionParams,
  JoinSessionResult,
  LeaveSessionParams,
  LeaveSessionResult,
  ResolveSessionParams,
  ResolveSessionResult,
  StartSessionParams,
  StartSessionResult,
} from "@/types/gameSessionV3";
import {
  SESSION_PHASES,
  SESSIONS_COLLECTION,
  TERMINAL_PHASES,
} from "@/types/gameSessionV3";
import { createLogger } from "@/utils/log";
import { createSessionTrace, type SessionTracer } from "@/utils/sessionTrace";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirestoreInstance, getFunctionsInstance } from "./firebase";

/**
 * Non-terminal session phases — used as an `in` filter instead of `not-in`
 * because Firestore disallows combining `array-contains` with `not-in`.
 */
const NON_TERMINAL_PHASES: string[] = SESSION_PHASES.filter(
  (p) => !TERMINAL_PHASES.has(p),
);

const logger = createLogger("services/gameSessions");

// =============================================================================
// Session Subscription
// =============================================================================

/**
 * Subscribe to a single session document in real-time.
 *
 * @param sessionId  The session document ID
 * @param onUpdate   Called with the latest session snapshot (or null if deleted)
 * @param onError    Called on Firestore listener error
 * @returns          Unsubscribe function
 */
export function subscribeToSession(
  sessionId: string,
  onUpdate: (session: GameSessionV3 | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!GAME_SESSIONS_V3.ENABLED) {
    logger.warn("[GameSessions] subscribeToSession called but v3 is disabled");
    return () => {};
  }

  const trace = createSessionTrace({ sessionId });
  trace.info("SESSION.SUBSCRIBE.START");

  const db = getFirestoreInstance();
  const docRef = doc(db, SESSIONS_COLLECTION, sessionId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        trace.warn("SESSION.SUBSCRIBE.NOT_FOUND");
        onUpdate(null);
        return;
      }

      const data = snapshot.data() as Omit<GameSessionV3, "id">;
      const session: GameSessionV3 = { ...data, id: snapshot.id };

      // Always log session updates — critical for debugging lobby sync
      trace.info("SESSION.SUBSCRIBE.UPDATE", {
        phase: session.phase,
        participantCount: session.participants.length,
        participantUids: session.participantUids,
        participants: session.participants.map((p) => ({
          uid: p.uid,
          status: p.status,
          role: p.role,
        })),
      });

      onUpdate(session);
    },
    (error) => {
      trace.error("SESSION.SUBSCRIBE.ERROR", error);
      onError?.(error);
    },
  );
}

// =============================================================================
// Conversation Sessions Subscription
// =============================================================================

/**
 * Subscribe to all non-terminal sessions for a conversation.
 *
 * Used by the InvitePillRow in chat to show active / lobby sessions.
 *
 * The query includes `array-contains` on `participantUids` so that
 * Firestore security rules (which require `uid in participantUids`) can
 * validate the query at plan time. We also use `in` instead of `not-in`
 * because Firestore disallows combining `array-contains` with `not-in`.
 *
 * @param conversationId  Chat or group ID
 * @param currentUserId   UID of the authenticated user (needed for security-rule-compliant query)
 * @param onUpdate        Called with the latest list of sessions
 * @param onError         Called on Firestore listener error
 * @returns               Unsubscribe function
 */
export function subscribeToConversationSessions(
  conversationId: string,
  currentUserId: string,
  onUpdate: (sessions: GameSessionV3[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!GAME_SESSIONS_V3.ENABLED) {
    return () => {};
  }

  const trace = createSessionTrace({ conversationId });
  trace.info("SESSION.CONV_SUBSCRIBE.START");

  const db = getFirestoreInstance();
  const sessionsRef = collection(db, SESSIONS_COLLECTION);

  // Query: current user is a participant, conversationId matches,
  // phase is non-terminal, ordered by newest first.
  // NOTE: Firestore disallows array-contains + not-in in the same query,
  // so we use `in` with the computed non-terminal phase list instead.
  const q = query(
    sessionsRef,
    where("participantUids", "array-contains", currentUserId),
    where("conversationId", "==", conversationId),
    where("phase", "in", NON_TERMINAL_PHASES),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const sessions: GameSessionV3[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<GameSessionV3, "id">),
        id: d.id,
      }));

      if (GAME_SESSIONS_V3.DEBUG_SESSION_LIFECYCLE) {
        trace.info("SESSION.CONV_SUBSCRIBE.UPDATE", {
          count: sessions.length,
        });
      }

      onUpdate(sessions);
    },
    (error) => {
      trace.error("SESSION.CONV_SUBSCRIBE.ERROR", error);
      onError?.(error);
    },
  );
}

// =============================================================================
// Cloud Function Callables
// =============================================================================

/**
 * Create a new v3 game session (and optionally a v2 invite for bridge).
 *
 * Calls the `createSessionV3` Cloud Function callable.
 */
export async function createSession(
  params: CreateSessionParams,
  trace?: SessionTracer,
): Promise<CreateSessionResult> {
  const t = trace ?? createSessionTrace({ gameType: params.gameType });
  t.info("SESSION.CREATE.CALL", { params });

  try {
    const functions = getFunctionsInstance();
    const callable = httpsCallable<CreateSessionParams, CreateSessionResult>(
      functions,
      "createSessionV3",
    );

    // Auto-set createInvite when DUAL_WRITE flag is on
    const callableParams: CreateSessionParams = {
      ...params,
      ...(GAME_SESSIONS_V3.DUAL_WRITE && !("createInvite" in params)
        ? { createInvite: true }
        : {}),
    };

    const result = await callable(callableParams);
    const data = result.data;

    if (data.success && data.sessionId) {
      t.update({ sessionId: data.sessionId });
      t.info("SESSION.CREATE.OK", {
        sessionId: data.sessionId,
        inviteId: data.inviteId,
      });
    } else {
      t.warn("SESSION.CREATE.FAIL", { error: data.error });
    }

    return data;
  } catch (error) {
    t.error("SESSION.CREATE.ERROR", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Join an existing session as a player or spectator.
 *
 * Calls the `joinSessionV3` Cloud Function callable.
 */
export async function joinSession(
  params: JoinSessionParams,
  trace?: SessionTracer,
): Promise<JoinSessionResult> {
  const t = trace ?? createSessionTrace({ sessionId: params.sessionId });
  t.info("SESSION.JOIN.CALL", { params });

  try {
    const functions = getFunctionsInstance();
    const callable = httpsCallable<JoinSessionParams, JoinSessionResult>(
      functions,
      "joinSessionV3",
    );
    const result = await callable(params);
    const data = result.data;

    if (data.success) {
      t.info("SESSION.JOIN.OK");
    } else {
      t.warn("SESSION.JOIN.FAIL", { error: data.error });
    }

    return data;
  } catch (error) {
    t.error("SESSION.JOIN.ERROR", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Leave a session (remove self from participants).
 *
 * Calls the `leaveSessionV3` Cloud Function callable.
 */
export async function leaveSession(
  params: LeaveSessionParams,
  trace?: SessionTracer,
): Promise<LeaveSessionResult> {
  const t = trace ?? createSessionTrace({ sessionId: params.sessionId });
  t.info("SESSION.LEAVE.CALL");

  try {
    const functions = getFunctionsInstance();
    const callable = httpsCallable<LeaveSessionParams, LeaveSessionResult>(
      functions,
      "leaveSessionV3",
    );
    const result = await callable(params);
    const data = result.data;

    if (data.success) {
      t.info("SESSION.LEAVE.OK");
    } else {
      t.warn("SESSION.LEAVE.FAIL", { error: data.error });
    }

    return data;
  } catch (error) {
    t.error("SESSION.LEAVE.ERROR", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Start the session (host only — transitions lobby → starting → active).
 *
 * Calls the `startSessionV3` Cloud Function callable.
 */
export async function startSession(
  params: StartSessionParams,
  trace?: SessionTracer,
): Promise<StartSessionResult> {
  const t = trace ?? createSessionTrace({ sessionId: params.sessionId });
  t.info("SESSION.START.CALL");

  try {
    const functions = getFunctionsInstance();
    const callable = httpsCallable<StartSessionParams, StartSessionResult>(
      functions,
      "startSessionV3",
    );
    const result = await callable(params);
    const data = result.data;

    if (data.success) {
      t.info("SESSION.START.OK", {
        colyseusRoomId: data.colyseusRoomId,
        firestoreGameId: data.firestoreGameId,
      });
    } else {
      t.warn("SESSION.START.FAIL", { error: data.error });
    }

    return data;
  } catch (error) {
    t.error("SESSION.START.ERROR", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Resolve a session (game over — transitions active → resolved).
 *
 * Calls the `resolveSessionV3` Cloud Function callable.
 * Idempotent: if the session is already terminal, returns success.
 */
export async function resolveSession(
  params: ResolveSessionParams,
  trace?: SessionTracer,
): Promise<ResolveSessionResult> {
  const t = trace ?? createSessionTrace({ sessionId: params.sessionId });
  t.info("SESSION.RESOLVE.CALL", {
    outcome: params.outcome,
    winnerUid: params.winnerUid,
  });

  try {
    const functions = getFunctionsInstance();
    const callable = httpsCallable<ResolveSessionParams, ResolveSessionResult>(
      functions,
      "resolveSessionV3",
    );
    const result = await callable(params);
    const data = result.data;

    if (data.success) {
      t.info("SESSION.RESOLVE.OK", {
        alreadyTerminal: data.alreadyTerminal,
      });
    } else {
      t.warn("SESSION.RESOLVE.FAIL", { error: data.error });
    }

    return data;
  } catch (error) {
    t.error("SESSION.RESOLVE.ERROR", error);
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// Invite to Session
// =============================================================================

/**
 * Invite a friend to an existing v3 lobby session.
 *
 * Calls the `inviteToSessionV3` Cloud Function callable, which:
 *   1. Validates the session exists, is in lobby phase, and caller is a participant
 *   2. Stamps conversationId on the session (if missing)
 *   3. Creates a `GameInvites` doc for the target conversation so the
 *      chat invite pill renders immediately.
 *
 * INVARIANT: This function NEVER modifies GameSessions.participants.
 * Participants are only added by joinSessionV3.
 */
export async function inviteToSession(
  params: InviteToSessionParams,
  trace?: SessionTracer,
): Promise<InviteToSessionResult> {
  const t = trace ?? createSessionTrace({ sessionId: params.sessionId });
  t.info("SESSION.INVITE.CALL", {
    recipientUid: params.recipientUid,
    conversationId: params.conversationId,
    eligibleUserIds: params.eligibleUserIds,
    eligibleCount: params.eligibleUserIds?.length,
  });

  try {
    const functions = getFunctionsInstance();
    const callable = httpsCallable<
      InviteToSessionParams,
      InviteToSessionResult
    >(functions, "inviteToSessionV3");
    const result = await callable(params);
    const data = result.data;

    if (data.success) {
      t.info("SESSION.INVITE.OK", {
        inviteId: data.inviteId,
        alreadyInvited: data.alreadyInvited,
      });
    } else {
      t.warn("SESSION.INVITE.FAIL", { error: data.error });
    }

    return data;
  } catch (error) {
    t.error("SESSION.INVITE.ERROR", error);
    return { success: false, error: String(error) };
  }
}
