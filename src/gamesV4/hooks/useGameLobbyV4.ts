/**
 * Games V4 — useGameLobbyV4 Hook
 *
 * Manages the lobby lifecycle for a V4 game invite.
 * Provides:
 * - Live invite state
 * - Join/leave actions
 * - Start game action (host only)
 * - Navigation readiness
 *
 * @module gamesV4/hooks/useGameLobbyV4
 */

import {
  cancelGameInvite,
  joinInviteLobby,
  leaveInviteLobby,
  startGameFromInvite,
  subscribeToInvite,
  subscribeToSession,
} from "@/gamesV4/services/gameServiceV4";
import type { GameInviteV4, GameSessionV4 } from "@/gamesV4/types";
import { startTrace } from "@/gamesV4/utils/perfTrace";
import { useAuth } from "@/store/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";

// =============================================================================
// Error mapping — Firebase callable errors → friendly messages
// =============================================================================

function mapCallableError(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const e = err as {
      code?: string;
      message?: string;
      details?: { traceId?: string };
    };
    // Firebase JS SDK callable errors have code like "functions/resource-exhausted"
    const code = (e.code ?? "").replace("functions/", "");
    switch (code) {
      case "resource-exhausted":
        return "Please wait a moment before trying again.";
      case "failed-precondition": {
        const msg = e.message ?? "";
        // Race condition: invite status changed between UI render and server call
        if (msg.includes("status 'active'") || msg.includes("already active")) {
          return "This game has already started.";
        }
        if (msg.includes("status 'resolved'")) {
          return "This game invite has ended.";
        }
        return msg || "Action not allowed right now.";
      }
      case "permission-denied":
        return "You don't have permission for this action.";
      case "not-found":
        return "This invite no longer exists.";
      case "unauthenticated":
        return "Please sign in to continue.";
      case "invalid-argument":
        return e.message ?? "Invalid request.";
      case "internal": {
        const traceId =
          e.details && typeof e.details === "object"
            ? (e.details as Record<string, unknown>).traceId
            : undefined;
        return traceId
          ? `Unexpected server error (trace: ${String(traceId).slice(0, 8)}…)`
          : "Unexpected server error. Please try again.";
      }
      default:
        return e.message ?? fallback;
    }
  }
  return fallback;
}

interface UseGameLobbyV4Result {
  /** Current invite document (live). */
  invite: GameInviteV4 | null;
  /** Session document once game starts. */
  session: GameSessionV4 | null;
  /** Whether the current user is the host. */
  isHost: boolean;
  /** Whether the game has started (invite → active). */
  isStarted: boolean;
  /** Whether the session is fully loaded and active. */
  navReady: boolean;
  /** Loading state for async actions. */
  actionLoading: boolean;
  /** Error from async actions. */
  actionError: string | null;
  /** True when the user has optimistically joined but Firestore hasn't confirmed yet. */
  isOptimisticallyJoined: boolean;
  /** The optimistic role ("player" | "spectator") before Firestore confirms, or null. */
  optimisticRole: string | null;
  /** Join the lobby as a player. */
  joinAsPlayer: () => Promise<void>;
  /** Join the lobby as a spectator. */
  joinAsSpectator: () => Promise<void>;
  /** Leave the lobby (non-host player/spectator). Returns true on success. */
  leaveLobby: () => Promise<boolean>;
  /** Cancel the invite (host only). Returns true on success. */
  cancelInvite: () => Promise<boolean>;
  /** Start the game (host only). */
  startGame: (settings?: Record<string, unknown>) => Promise<void>;
}

export function useGameLobbyV4(inviteId: string): UseGameLobbyV4Result {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [invite, setInvite] = useState<GameInviteV4 | null>(null);
  const [session, setSession] = useState<GameSessionV4 | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Optimistic join: show user as a pending member before Firestore confirms
  const [optimisticRole, setOptimisticRole] = useState<string | null>(null);

  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null,
  );
  const prevStatus = useRef<string | null>(null);
  // Track the sessionId from the callable return so we can subscribe
  // immediately instead of waiting for the invite listener to deliver it.
  const earlySessionIdRef = useRef<string | null>(null);
  const sessionUnsubRef = useRef<(() => void) | null>(null);

  // Helper: start session subscription for a known sessionId
  const startSessionSubscription = useCallback((sid: string) => {
    // Avoid duplicate subscriptions for the same sessionId
    if (sessionUnsubRef.current) return;
    sessionUnsubRef.current = subscribeToSession(sid, setSession, (err) =>
      setSubscriptionError(err.message),
    );
  }, []);

  // Subscribe to invite doc
  useEffect(() => {
    if (!inviteId) return;
    const unsub = subscribeToInvite(inviteId, setInvite, (err) =>
      setSubscriptionError(err.message),
    );
    return unsub;
  }, [inviteId]);

  // Clear stale action errors when invite status transitions (e.g. race condition resolved)
  useEffect(() => {
    if (invite?.status && invite.status !== prevStatus.current) {
      prevStatus.current = invite.status;
      setActionError(null);
    }
  }, [invite?.status]);

  // Clear optimistic role once the invite listener confirms membership
  useEffect(() => {
    if (!uid || !invite || !optimisticRole) return;
    const confirmed =
      optimisticRole === "player"
        ? invite.participantIds?.includes(uid)
        : invite.spectatorIds?.includes(uid);
    if (confirmed) {
      setOptimisticRole(null);
    }
  }, [uid, invite, optimisticRole]);

  // When invite progresses to active and has a sessionId, subscribe to session.
  // PERF: If we already subscribed via the callable fast-path
  // (earlySessionIdRef), skip re-subscribing here.
  useEffect(() => {
    if (!invite?.sessionId) return;
    if (invite.status !== "active" && invite.status !== "resolved") return;
    // Already subscribed via callable fast-path
    if (earlySessionIdRef.current === invite.sessionId) return;

    startSessionSubscription(invite.sessionId);
    return () => {
      if (sessionUnsubRef.current) {
        sessionUnsubRef.current();
        sessionUnsubRef.current = null;
      }
    };
  }, [invite?.sessionId, invite?.status, startSessionSubscription]);

  // Cleanup session subscription on unmount
  useEffect(() => {
    return () => {
      if (sessionUnsubRef.current) {
        sessionUnsubRef.current();
        sessionUnsubRef.current = null;
      }
    };
  }, []);

  const isHost = !!(uid && invite?.hostId === uid);
  const isStarted =
    invite?.status === "active" || invite?.status === "resolved";
  const navReady = !!(session && session.status === "active");

  // Derive whether user appears to be in the lobby (real or optimistic)
  const isOptimisticallyJoined = optimisticRole !== null;

  const joinAsPlayer = useCallback(async () => {
    setActionLoading(true);
    setActionError(null);
    // PERF: Optimistic join — show "joining" state immediately
    setOptimisticRole("player");
    const trace = startTrace("lobby_join");
    trace.mark("callable_sent");
    try {
      await joinInviteLobby({ inviteId, asSpectator: false });
      trace.mark("callable_returned");
      trace.end();
    } catch (err) {
      setOptimisticRole(null); // Revert optimistic state on error
      setActionError(mapCallableError(err, "Failed to join lobby."));
      trace.mark("error");
      trace.end();
    } finally {
      setActionLoading(false);
    }
  }, [inviteId]);

  const joinAsSpectator = useCallback(async () => {
    setActionLoading(true);
    setActionError(null);
    setOptimisticRole("spectator");
    try {
      await joinInviteLobby({ inviteId, asSpectator: true });
    } catch (err) {
      setOptimisticRole(null);
      setActionError(mapCallableError(err, "Failed to join as spectator."));
    } finally {
      setActionLoading(false);
    }
  }, [inviteId]);

  const leaveLobby = useCallback(async (): Promise<boolean> => {
    setActionLoading(true);
    setActionError(null);
    try {
      await leaveInviteLobby({ inviteId });
      return true;
    } catch (err) {
      setActionError(mapCallableError(err, "Failed to leave lobby."));
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [inviteId]);

  const cancelInvite = useCallback(async (): Promise<boolean> => {
    setActionLoading(true);
    setActionError(null);
    try {
      await cancelGameInvite({ inviteId });
      return true;
    } catch (err) {
      setActionError(mapCallableError(err, "Failed to cancel invite."));
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [inviteId]);

  const startGame = useCallback(
    async (settings?: Record<string, unknown>) => {
      setActionLoading(true);
      setActionError(null);
      const trace = startTrace("lobby_start");
      trace.mark("callable_sent");
      try {
        const { sessionId } = await startGameFromInvite({ inviteId, settings });
        trace.mark("callable_returned");

        // PERF: Fast-path — subscribe to the session immediately using the
        // callable-returned sessionId instead of waiting for the invite
        // listener to deliver it (~1-1.5s saved).
        earlySessionIdRef.current = sessionId;
        startSessionSubscription(sessionId);
        trace.mark("session_sub_started");
        trace.end();
      } catch (err) {
        setActionError(mapCallableError(err, "Failed to start game."));
        trace.mark("error");
        trace.end();
      } finally {
        setActionLoading(false);
      }
    },
    [inviteId, startSessionSubscription],
  );

  return {
    invite,
    session,
    isHost,
    isStarted,
    navReady,
    actionLoading,
    actionError: actionError ?? subscriptionError,
    isOptimisticallyJoined,
    optimisticRole,
    joinAsPlayer,
    joinAsSpectator,
    leaveLobby,
    cancelInvite,
    startGame,
  };
}
