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
import { useAuth } from "@/store/AuthContext";
import { useCallback, useEffect, useState } from "react";

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
      case "failed-precondition":
        return e.message ?? "Action not allowed right now.";
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

  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null,
  );

  // Subscribe to invite doc
  useEffect(() => {
    if (!inviteId) return;
    const unsub = subscribeToInvite(inviteId, setInvite, (err) =>
      setSubscriptionError(err.message),
    );
    return unsub;
  }, [inviteId]);

  // When invite progresses to active and has a sessionId, subscribe to session
  useEffect(() => {
    if (!invite?.sessionId) return;
    if (invite.status !== "active" && invite.status !== "resolved") return;

    const unsub = subscribeToSession(invite.sessionId, setSession, (err) =>
      setSubscriptionError(err.message),
    );
    return unsub;
  }, [invite?.sessionId, invite?.status]);

  const isHost = !!(uid && invite?.hostId === uid);
  const isStarted =
    invite?.status === "active" || invite?.status === "resolved";
  const navReady = !!(session && session.status === "active");

  const joinAsPlayer = useCallback(async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await joinInviteLobby({ inviteId, asSpectator: false });
    } catch (err) {
      setActionError(mapCallableError(err, "Failed to join lobby."));
    } finally {
      setActionLoading(false);
    }
  }, [inviteId]);

  const joinAsSpectator = useCallback(async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await joinInviteLobby({ inviteId, asSpectator: true });
    } catch (err) {
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
      try {
        await startGameFromInvite({ inviteId, settings });
      } catch (err) {
        setActionError(mapCallableError(err, "Failed to start game."));
      } finally {
        setActionLoading(false);
      }
    },
    [inviteId],
  );

  return {
    invite,
    session,
    isHost,
    isStarted,
    navReady,
    actionLoading,
    actionError: actionError ?? subscriptionError,
    joinAsPlayer,
    joinAsSpectator,
    leaveLobby,
    cancelInvite,
    startGame,
  };
}
