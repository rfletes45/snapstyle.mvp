/**
 * Games V4 — useGameSessionV4 Hook
 *
 * Manages an active game session.
 * Provides:
 * - Live session state
 * - Live public game state
 * - Move submission
 * - Resign action
 * - Terminal detection + result loading
 *
 * @module gamesV4/hooks/useGameSessionV4
 */

import {
  resignSession,
  submitTurnMove,
  subscribeToPublicState,
  subscribeToResult,
  subscribeToSession,
} from "@/gamesV4/services/gameServiceV4";
import type { GameResultV4, GameSessionV4 } from "@/gamesV4/types";
import { useAuth } from "@/store/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseGameSessionV4Result {
  /** Live session document. */
  session: GameSessionV4 | null;
  /** Live public game state. */
  publicState: Record<string, unknown> | null;
  /** Game result (available after resolution). */
  result: GameResultV4 | null;
  /** Whether the session is resolved/terminal. */
  isTerminal: boolean;
  /** Whether it's the current user's turn. */
  isMyTurn: boolean;
  /** Current user's UID. */
  myUid: string | undefined;
  /** Loading state for actions. */
  actionLoading: boolean;
  /** Error from actions. */
  actionError: string | null;
  /** Submit a move. */
  submitMove: (
    payload: Record<string, unknown>,
    isTerminal?: boolean,
    winnerIds?: string[],
  ) => Promise<void>;
  /** Resign from the session. */
  resign: () => Promise<void>;
}

export function useGameSessionV4(sessionId: string): UseGameSessionV4Result {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [session, setSession] = useState<GameSessionV4 | null>(null);
  const [publicState, setPublicState] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [result, setResult] = useState<GameResultV4 | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null,
  );

  // Track whether a resign/resolution is in progress so we can suppress
  // transient Firestore permission errors that occur during the status
  // transition (e.g. snapshot listener fires while security rules evaluate
  // against the mid-write document). This prevents "Missing Firebase
  // permissions" from surfacing to the user.
  const resolvingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Suppressed error setter: ignores permission errors while resolving.
  const handleSnapshotError = useCallback((err: Error) => {
    if (resolvingRef.current) {
      console.warn(
        "[gamesV4] Suppressed snapshot error during resolution:",
        err.message,
      );
      return;
    }
    if (mountedRef.current) {
      setSubscriptionError(err.message);
    }
  }, []);

  // Subscribe to session doc
  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeToSession(
      sessionId,
      setSession,
      handleSnapshotError,
    );
    return unsub;
  }, [sessionId, handleSnapshotError]);

  // Subscribe to public state
  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeToPublicState(
      sessionId,
      setPublicState,
      handleSnapshotError,
    );
    return unsub;
  }, [sessionId, handleSnapshotError]);

  // Subscribe to result when session is resolved
  useEffect(() => {
    if (!sessionId) return;
    if (!session) return;
    if (
      session.status !== "resolved" &&
      session.status !== "abandoned" &&
      session.status !== "expired"
    ) {
      return;
    }
    const unsub = subscribeToResult(sessionId, setResult, handleSnapshotError);
    return unsub;
  }, [sessionId, session?.status, handleSnapshotError]);

  // Clear subscription errors when session reaches terminal — the game is over,
  // any lingering snapshot error is no longer relevant.
  useEffect(() => {
    if (
      session &&
      (session.status === "resolved" ||
        session.status === "abandoned" ||
        session.status === "expired")
    ) {
      setSubscriptionError(null);
    }
  }, [session?.status]);

  const isTerminal = !!(
    session &&
    (session.status === "resolved" ||
      session.status === "abandoned" ||
      session.status === "expired")
  );

  const isMyTurn = !!(
    uid &&
    session &&
    ((session.runtimeType === "turnBased" &&
      (session.currentTurnPlayerId === uid ||
        // Fallback: if currentTurnPlayerId is null, derive from turnOrder
        (!session.currentTurnPlayerId &&
          session.turnOrder?.[session.currentTurnIndex ?? 0] === uid))) ||
      session.runtimeType === "solo" ||
      // Realtime games: all participants can act simultaneously
      session.runtimeType === "realtime")
  );

  // DEBUG: Log every time session or isMyTurn changes
  useEffect(() => {
    if (session) {
      console.log(
        `[gamesV4][DEBUG] useGameSessionV4: uid=${uid}, isMyTurn=${isMyTurn}, session.currentTurnPlayerId=${session.currentTurnPlayerId}, session.currentTurnIndex=${session.currentTurnIndex}, session.turnOrder=${JSON.stringify(session.turnOrder)}, session.status=${session.status}`,
      );
    }
  }, [
    session?.currentTurnPlayerId,
    session?.currentTurnIndex,
    isMyTurn,
    uid,
    session,
  ]);

  const submitMove = useCallback(
    async (
      payload: Record<string, unknown>,
      terminal?: boolean,
      winnerIds?: string[],
    ) => {
      setActionLoading(true);
      setActionError(null);
      try {
        await submitTurnMove({
          sessionId,
          movePayload: payload,
          isTerminal: terminal,
          winnerIds,
        });
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Failed to submit move.",
        );
        throw err; // Re-throw so callers (e.g. GameScreenShell .catch) can revert optimistic state
      } finally {
        setActionLoading(false);
      }
    },
    [sessionId],
  );

  const resign = useCallback(async () => {
    resolvingRef.current = true;
    setActionLoading(true);
    setActionError(null);
    setSubscriptionError(null);
    try {
      await resignSession({ sessionId });
    } catch (err) {
      if (mountedRef.current) {
        setActionError(
          err instanceof Error ? err.message : "Failed to resign.",
        );
      }
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
      // Keep resolvingRef true — snapshot suppression stays active until
      // component unmounts or session reaches terminal (cleared above).
    }
  }, [sessionId]);

  return {
    session,
    publicState,
    result,
    isTerminal,
    isMyTurn,
    myUid: uid,
    actionLoading,
    actionError: actionError ?? subscriptionError,
    submitMove,
    resign,
  };
}
