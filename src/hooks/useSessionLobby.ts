/**
 * useSessionLobby — V3 session-first lobby hook
 *
 * Encapsulates all lobby logic for the v3 GameSession lifecycle:
 *   1. Subscribes to `GameSessions/{sessionId}` in real-time
 *   2. Derives isHost, isInSession, canStart, players, etc.
 *   3. Provides action handlers: start, leave
 *   4. Signals when the session is ready to navigate to the game screen
 *
 * This hook replaces the inline logic in SessionLobbyScreen and can be
 * composed by any screen that needs v3 session state.
 *
 * @module hooks/useSessionLobby
 */

import {
  joinSession,
  leaveSession,
  startSession,
  subscribeToSession,
} from "@/services/gameSessions";
import { useAuth } from "@/store/AuthContext";
import type { GameSessionV3, SessionParticipant } from "@/types/gameSessionV3";
import { isLobbyFull, isSessionTerminal } from "@/types/gameSessionV3";
import type { ExtendedGameType } from "@/types/games";
import { GAME_METADATA, isValidGameType } from "@/types/games";
import { exitGameSession } from "@/utils/gameNavHelpers";
import { createLogger } from "@/utils/log";
import type { SessionTracer } from "@/utils/sessionTrace";
import { createSessionTrace } from "@/utils/sessionTrace";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const logger = createLogger("hooks/useSessionLobby");

// =============================================================================
// Types
// =============================================================================

/** Which auto-navigation event is pending. */
export interface SessionNavReady {
  /** Game screen name to navigate to (from GAME_SCREEN_MAP). */
  screenName: string;
  /** Route params for the game screen. */
  params: {
    sessionId: string;
    inviteId?: string;
    matchId?: string;
    firestoreGameId?: string;
    entryPoint: string;
    /** v3 session ID string (truthy = v3 flow). */
    v3Session: string;
  };
}

/**
 * Lobby phase — maps to UI states.
 *
 * - `loading`: waiting for first Firestore snapshot
 * - `waiting`: session is in lobby, waiting for players / host start
 * - `starting`: session transitioning → game screen navigation imminent
 * - `terminal`: session ended (resolved / abandoned / expired / cancelled)
 * - `error`: something went wrong
 */
export type LobbyPhase =
  | "loading"
  | "waiting"
  | "starting"
  | "terminal"
  | "error";

export interface UseSessionLobbyReturn {
  /** Current lobby phase. */
  phase: LobbyPhase;
  /** Raw session document (null while loading). */
  session: GameSessionV3 | null;
  /** User is the host of this session. */
  isHost: boolean;
  /** User is an active participant (joined, not left, not just invited). */
  isInSession: boolean;
  /** User has an "invited" stub but has not joined yet. */
  isInvited: boolean;
  /**
   * User can press "Join Game" — they're in the session's ACL
   * (`participantUids`) but haven't actually joined yet.
   * True when: not yet a participant, lobby phase, room not full.
   */
  canJoin: boolean;
  /** Current user's participant entry. */
  myParticipant: SessionParticipant | undefined;
  /** Session is at max participants. */
  lobbyFull: boolean;
  /** Host can press start (enough players). */
  canStart: boolean;
  /** Human-readable game name. */
  gameDisplayName: string;
  /** Error message, if any. */
  error: string | null;
  /** Whether an action (start/leave/join) is in progress. */
  actionLoading: boolean;
  /** Session trace for logging. */
  trace: SessionTracer;

  // Actions
  /** Join the session (invited → joined). */
  handleJoin: () => Promise<void>;
  /** Host starts the game. */
  handleStart: () => Promise<void>;
  /** Leave the session and navigate to play hub. */
  handleLeave: () => Promise<void>;
  /** Navigate back to play hub (no leave call). */
  handleBack: () => void;

  /**
   * Signals when the game screen should be navigated to.
   * The consuming screen calls `navigation.replace(navReady.screenName, navReady.params)`.
   * `null` when no navigation is pending.
   */
  navReady: SessionNavReady | null;
}

// =============================================================================
// Hook
// =============================================================================

export function useSessionLobby(
  sessionId: string,
  source: string,
  gameScreenMap: Record<string, string>,
  /** Local navigation.dispatch — ensures exit works even when navigationRef isn't ready. */
  dispatch?: (action: any) => void,
): UseSessionLobbyReturn {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  // ── State ─────────────────────────────────────────────────────────────────
  const [session, setSession] = useState<GameSessionV3 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [navReady, setNavReady] = useState<SessionNavReady | null>(null);
  const navigatedRef = useRef(false);
  /** Firestore listener unsub — stored in a ref so handleLeave can call it
   *  BEFORE the Cloud Function removes us from participantUids. */
  const unsubRef = useRef<(() => void) | null>(null);

  // ── Trace ─────────────────────────────────────────────────────────────────
  const trace = useMemo(
    () =>
      createSessionTrace({
        sessionId,
        uid: uid ?? undefined,
        role: "system",
      }),
    [sessionId, uid],
  );

  // ── Subscribe to session ──────────────────────────────────────────────────
  const lastSnapshotRef = useRef<number>(0);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided");
      setLoading(false);
      return;
    }

    trace.info("LOBBY.SUBSCRIBE.START", { source });

    const unsub = subscribeToSession(
      sessionId,
      (updated) => {
        lastSnapshotRef.current = Date.now();
        setLoading(false);
        if (!updated) {
          setError("Session not found");
          trace.warn("LOBBY.SESSION_NOT_FOUND");
          return;
        }
        setSession(updated);
        setError(null);
      },
      (err) => {
        // After an explicit leave we tear down the listener ourselves;
        // a follow-up permission error from Firestore is expected — ignore it.
        if (unsubRef.current === null) {
          // Already torn down → swallow the stale error
          return;
        }
        setLoading(false);
        setError("Failed to load session");
        trace.error("LOBBY.SUBSCRIBE.ERROR", err);
      },
    );
    unsubRef.current = unsub;

    // Staleness watchdog — warn if no snapshot for 30s during lobby
    const watchdog = setInterval(() => {
      const elapsed = Date.now() - lastSnapshotRef.current;
      if (elapsed > 30_000 && lastSnapshotRef.current > 0) {
        trace.warn("LOBBY.SUBSCRIBE.STALE", {
          elapsedMs: elapsed,
          sessionId,
        });
      }
    }, 30_000);

    return () => {
      trace.info("LOBBY.SUBSCRIBE.TEARDOWN");
      unsub();
      unsubRef.current = null;
      clearInterval(watchdog);
    };
  }, [sessionId, source, trace]);

  // ── Auto-navigate when session becomes active ─────────────────────────────
  useEffect(() => {
    if (!session || navigatedRef.current) return;

    const { phase, gameType, colyseusRoomId, firestoreGameId } = session;

    if (phase === "starting" || phase === "active") {
      navigatedRef.current = true;
      trace.info("LOBBY.AUTO_NAVIGATE", {
        phase,
        gameType,
        colyseusRoomId,
        firestoreGameId,
      });

      if (!isValidGameType(gameType)) {
        setError(`Unknown game type: ${gameType}`);
        trace.warn("LOBBY.UNKNOWN_GAME_TYPE", { gameType });
        return;
      }

      const screenName = gameScreenMap[gameType];
      if (!screenName) {
        setError(`No screen registered for game type: ${gameType}`);
        return;
      }

      setNavReady({
        screenName,
        params: {
          sessionId,
          inviteId: session.sourceInviteId,
          matchId: colyseusRoomId,
          firestoreGameId,
          entryPoint: source === "chat" ? "chat" : "play",
          v3Session: sessionId,
        },
      });
    }

    // Terminal phases
    if (isSessionTerminal(phase)) {
      trace.info("LOBBY.TERMINAL_PHASE", { phase });
      setError(
        phase === "abandoned"
          ? "This session was cancelled."
          : phase === "expired"
            ? "This session has expired."
            : "This game has ended.",
      );
    }
  }, [session, sessionId, source, trace, gameScreenMap]);

  // ── Client-side lobby timeout ─────────────────────────────────────────────
  // If the session sits in "lobby" too long, navigate the user away rather
  // than leaving them stuck.  The server-side watchdog handles actual expiry.
  useEffect(() => {
    if (!session || session.phase !== "lobby") return;

    const LOBBY_TTL_MS = 30 * 60 * 1000; // 30 minutes (mirrors SESSION_LOBBY_TTL_MS)
    const elapsed = Date.now() - session.createdAt;
    const remaining = Math.max(LOBBY_TTL_MS - elapsed, 0);

    if (remaining === 0) {
      // Already expired
      trace.warn("LOBBY.CLIENT_TIMEOUT", { elapsed });
      setError("This lobby has expired.");
      exitGameSession({ type: "playHub" }, { dispatch });
      return;
    }

    const timer = setTimeout(() => {
      trace.warn("LOBBY.CLIENT_TIMEOUT", { elapsed: LOBBY_TTL_MS });
      setError("This lobby has expired.");
      exitGameSession({ type: "playHub" }, { dispatch });
    }, remaining);

    return () => clearTimeout(timer);
  }, [session, trace, dispatch]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isHost = session?.hostUid === uid;
  const myParticipant = session?.participants.find(
    (p: SessionParticipant) => p.uid === uid,
  );
  // "In session" means actively joined — NOT just invited or left.
  const isInSession =
    !!myParticipant &&
    myParticipant.status !== "invited" &&
    myParticipant.status !== "left";
  // Has an invited stub but hasn't joined yet.
  const isInvited = !!myParticipant && myParticipant.status === "invited";
  const lobbyFull = session ? isLobbyFull(session) : false;

  // canJoin: user can see the lobby (passed ACL) but is not yet a participant.
  // This covers: invited via participantUids ACL (no stub in participants),
  // OR has an old "invited" stub from pre-refactor sessions.
  const canJoin =
    !isInSession && session?.phase === "lobby" && !lobbyFull && !isHost;

  // canStart: host needs enough *actually joined* players (exclude invited/left).
  const joinedPlayerCount = session
    ? session.participants.filter(
        (p: SessionParticipant) =>
          p.role !== "spectator" &&
          p.status !== "invited" &&
          p.status !== "left",
      ).length
    : 0;
  const canStart =
    isHost && joinedPlayerCount >= (session?.maxParticipants ?? 2);

  // ── Lobby state logging (always-on, critical for debugging) ───────────────
  useEffect(() => {
    if (!session) return;
    logger.info("[useSessionLobby] LOBBY.STATE.DERIVED", {
      sessionId,
      uid,
      phase: session.phase,
      isHost,
      isInSession,
      isInvited,
      canJoin,
      canStart,
      lobbyFull,
      joinedPlayerCount,
      maxParticipants: session.maxParticipants,
      myParticipantStatus: myParticipant?.status ?? "NOT_IN_PARTICIPANTS",
      participantUids: session.participantUids,
      participantCount: session.participants.length,
      participants: session.participants.map((p) => ({
        uid: p.uid,
        status: p.status,
        role: p.role,
        displayName: p.displayName,
      })),
    });
  }, [
    session,
    sessionId,
    uid,
    isHost,
    isInSession,
    isInvited,
    canJoin,
    canStart,
    lobbyFull,
    joinedPlayerCount,
    myParticipant,
  ]);

  const gameDisplayName = useMemo(() => {
    if (!session) return "";
    const gameType = session.gameType;
    if (isValidGameType(gameType)) {
      return GAME_METADATA[gameType as ExtendedGameType]?.name ?? gameType;
    }
    return gameType;
  }, [session]);

  // ── Computed phase ────────────────────────────────────────────────────────
  const phase: LobbyPhase = useMemo(() => {
    if (loading) return "loading";
    if (error) return "error";
    if (!session) return "error";
    if (isSessionTerminal(session.phase)) return "terminal";
    if (session.phase === "starting" || session.phase === "active")
      return "starting";
    return "waiting";
  }, [loading, error, session]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const autoJoinAttempted = useRef(false);

  const handleJoin = useCallback(async () => {
    if (!session || actionLoading) return;
    setActionLoading(true);
    trace.info("LOBBY.JOIN.PRESS", {
      sessionId,
      uid,
      currentPhase: session.phase,
      participantsBefore: session.participants.length,
    });

    const result = await joinSession({ sessionId }, trace);
    if (!result.success) {
      trace.error("LOBBY.JOIN.FAILED", { error: result.error });
      setError(result.error ?? "Failed to join session");
    } else {
      trace.info("LOBBY.JOIN.OK", { sessionId, uid });
    }
    setActionLoading(false);
  }, [session, sessionId, uid, actionLoading, trace]);

  // ── Auto-join: when user arrives at lobby via invite and is eligible ──────
  // Fires once after first snapshot when canJoin is true.
  useEffect(() => {
    if (autoJoinAttempted.current) return;
    if (!session || loading || actionLoading) return;
    if (!canJoin) return;
    // Only auto-join for non-host users who are not already in session
    if (isHost || isInSession) return;

    autoJoinAttempted.current = true;
    trace.info("LOBBY.AUTO_JOIN.START", { sessionId, uid });

    (async () => {
      setActionLoading(true);
      const result = await joinSession({ sessionId }, trace);
      if (!result.success) {
        trace.error("LOBBY.AUTO_JOIN.FAILED", { error: result.error });
        setError(result.error ?? "Failed to join session");
      } else {
        trace.info("LOBBY.AUTO_JOIN.OK", { sessionId, uid });
      }
      setActionLoading(false);
    })();
  }, [
    session,
    loading,
    actionLoading,
    canJoin,
    isHost,
    isInSession,
    sessionId,
    uid,
    trace,
  ]);

  const handleStart = useCallback(async () => {
    if (!session || actionLoading) return;
    setActionLoading(true);
    trace.info("LOBBY.START.PRESS");

    const result = await startSession({ sessionId }, trace);
    if (!result.success) {
      setError(result.error ?? "Failed to start game");
    }
    setActionLoading(false);
  }, [session, sessionId, actionLoading, trace]);

  const handleLeave = useCallback(async () => {
    if (!session || actionLoading) return;
    setActionLoading(true);
    trace.info("LOBBY.LEAVE.PRESS");

    // If the session is already terminal (host left → abandoned, expired, etc.)
    // skip the Cloud Function call — just navigate away.
    if (isSessionTerminal(session.phase)) {
      trace.info("LOBBY.LEAVE.ALREADY_TERMINAL", { phase: session.phase });
      setActionLoading(false);
      exitGameSession({ type: "playHub" }, { dispatch });
      return;
    }

    // Tear down the Firestore listener BEFORE the Cloud Function removes us
    // from participantUids — prevents "missing permissions" errors.
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    const result = await leaveSession({ sessionId }, trace);
    setActionLoading(false);

    if (result.success) {
      exitGameSession({ type: "playHub" }, { dispatch });
    } else {
      setError(result.error ?? "Failed to leave session");
    }
  }, [session, sessionId, actionLoading, trace, dispatch]);

  const handleBack = useCallback(() => {
    trace.info("LOBBY.BACK.PRESS");
    exitGameSession({ type: "playHub" }, { dispatch });
  }, [trace, dispatch]);

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    phase,
    session,
    isHost,
    isInSession,
    isInvited,
    canJoin,
    myParticipant,
    lobbyFull,
    canStart,
    gameDisplayName,
    error,
    actionLoading,
    trace,
    handleJoin,
    handleStart,
    handleLeave,
    handleBack,
    navReady,
  };
}
