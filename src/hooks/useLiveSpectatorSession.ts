/**
 * useLiveSpectatorSession Hook
 *
 * Manages live spectator session state for single-player game screens.
 * Handles both hosting (for players) and watching (for spectators).
 *
 * @example Host mode (player):
 * const { startSession, updateState, endSession, spectatorCount } = useLiveSpectatorSession({
 *   sessionId: route.params?.liveSessionId,
 *   mode: 'host',
 *   userId: currentFirebaseUser?.uid,
 *   userName: currentFirebaseUser?.displayName,
 * });
 *
 * @example Spectator mode:
 * const { session, gameState, currentScore } = useLiveSpectatorSession({
 *   sessionId: route.params?.liveSessionId,
 *   mode: 'spectator',
 *   userId: currentFirebaseUser?.uid,
 *   userName: currentFirebaseUser?.displayName,
 * });
 */

import {
  abandonLiveSession,
  createLiveSession,
  CreateLiveSessionInput,
  endLiveSession,
  GameStateUpdate,
  joinLiveSessionAsSpectator,
  leaveLiveSessionAsSpectator,
  LiveSpectator,
  LiveSpectatorSession,
  startLiveSession,
  subscribeToLiveSession,
  updateLiveSessionState,
} from "@/services/liveSpectatorSession";
import { SinglePlayerGameType } from "@/types/games";
import { useCallback, useEffect, useRef, useState } from "react";

// =============================================================================
// Types
// =============================================================================

export type SpectatorSessionMode = "host" | "spectator";

export interface UseLiveSpectatorSessionParams {
  /** Existing session ID (for spectators or resuming) */
  sessionId?: string;
  /** Mode: 'host' for player, 'spectator' for watcher */
  mode: SpectatorSessionMode;
  /** Current user ID */
  userId?: string;
  /** Current user display name */
  userName?: string;
  /** Current user avatar URL */
  userAvatar?: string;
  /** Game type (required for host to create session) */
  gameType?: SinglePlayerGameType;
  /** Invited user IDs (required for host) */
  invitedUserIds?: string[];
  /** Conversation context (optional) */
  conversationId?: string;
  conversationType?: "dm" | "group";
  /** Max spectators (optional) */
  maxSpectators?: number;
  /** Throttle interval for state updates (ms) */
  throttleMs?: number;
}

export interface UseLiveSpectatorSessionResult {
  /** Whether a live session is active */
  isLive: boolean;
  /** The session ID (null if not created/joined) */
  sessionId: string | null;
  /** The full session data (for spectators) */
  session: LiveSpectatorSession | null;
  /** Current game state from session (for spectators) */
  gameState: Record<string, unknown> | null;
  /** Current score (for spectators) */
  currentScore: number;
  /** List of spectators */
  spectators: LiveSpectator[];
  /** Number of spectators */
  spectatorCount: number;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether we're in spectator mode */
  isSpectator: boolean;
  /** Create and start a new session (host only) */
  createSession: (
    input: Omit<CreateLiveSessionInput, "hostId" | "hostName">,
  ) => Promise<string | null>;
  /** Mark session as started (host only) */
  startSession: () => Promise<boolean>;
  /** Update game state (host only, throttled) */
  updateState: (update: GameStateUpdate) => void;
  /** End the session (host only) */
  endSession: (
    finalScore: number,
    finalState: Record<string, unknown>,
  ) => Promise<void>;
  /** Abandon the session (host only) */
  abandonSession: () => Promise<void>;
  /** Leave spectator mode (spectator only) */
  leaveSession: () => Promise<void>;
}

// =============================================================================
// Default values
// =============================================================================

const DEFAULT_THROTTLE_MS = 100; // 10 updates per second max

// =============================================================================
// Hook Implementation
// =============================================================================

export function useLiveSpectatorSession({
  sessionId: initialSessionId,
  mode,
  userId,
  userName,
  userAvatar,
  gameType,
  invitedUserIds,
  conversationId,
  conversationType,
  maxSpectators,
  throttleMs = DEFAULT_THROTTLE_MS,
}: UseLiveSpectatorSessionParams): UseLiveSpectatorSessionResult {
  // State
  const [sessionId, setSessionId] = useState<string | null>(
    initialSessionId || null,
  );
  const [session, setSession] = useState<LiveSpectatorSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  // Refs for throttling
  const lastUpdateRef = useRef<number>(0);
  const pendingUpdateRef = useRef<GameStateUpdate | null>(null);
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Computed values
  const isSpectator = mode === "spectator";
  const spectators = session?.spectators || [];
  const spectatorCount = spectators.length;
  const gameState = session?.gameState || null;
  const currentScore = session?.currentScore || 0;

  // ==========================================================================
  // Join as spectator (for spectator mode)
  // ==========================================================================
  useEffect(() => {
    if (!isSpectator || !sessionId || !userId || !userName) {
      return;
    }

    const joinSession = async () => {
      setLoading(true);
      setError(null);

      const result = await joinLiveSessionAsSpectator(
        sessionId,
        userId,
        userName,
        userAvatar,
      );

      if (!result.success) {
        setError(result.error || "Failed to join session");
      } else {
        setIsLive(true);
      }
      setLoading(false);
    };

    joinSession();
  }, [isSpectator, sessionId, userId, userName, userAvatar]);

  // ==========================================================================
  // Subscribe to session updates
  // ==========================================================================
  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      return;
    }

    const unsubscribe = subscribeToLiveSession(
      sessionId,
      (updatedSession) => {
        setSession(updatedSession);
        if (updatedSession) {
          setIsLive(
            updatedSession.status === "waiting" ||
              updatedSession.status === "active" ||
              updatedSession.status === "paused",
          );
        } else {
          setIsLive(false);
        }
      },
      (err) => {
        setError(err.message);
      },
    );

    return () => unsubscribe();
  }, [sessionId]);

  // ==========================================================================
  // Cleanup on unmount
  // ==========================================================================
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  // ==========================================================================
  // Host Functions
  // ==========================================================================

  /**
   * Create a new live session
   */
  const createSession = useCallback(
    async (
      input: Omit<CreateLiveSessionInput, "hostId" | "hostName">,
    ): Promise<string | null> => {
      if (!userId || !userName) {
        setError("Not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      const result = await createLiveSession({
        ...input,
        hostId: userId,
        hostName: userName,
        hostAvatar: userAvatar,
      });

      setLoading(false);

      if (result.success && result.sessionId) {
        setSessionId(result.sessionId);
        setIsLive(true);
        return result.sessionId;
      } else {
        setError(result.error || "Failed to create session");
        return null;
      }
    },
    [userId, userName, userAvatar],
  );

  /**
   * Start the session (when game begins)
   */
  const startSession = useCallback(async (): Promise<boolean> => {
    if (!sessionId) {
      return false;
    }
    return await startLiveSession(sessionId);
  }, [sessionId]);

  /**
   * Update game state (throttled)
   */
  const updateState = useCallback(
    (update: GameStateUpdate) => {
      if (!sessionId || isSpectator) {
        return;
      }

      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;

      if (timeSinceLastUpdate >= throttleMs) {
        // Send immediately
        lastUpdateRef.current = now;
        updateLiveSessionState(sessionId, update);
      } else {
        // Queue the update
        pendingUpdateRef.current = update;

        // Set a timeout to send the update if not already set
        if (!throttleTimeoutRef.current) {
          throttleTimeoutRef.current = setTimeout(() => {
            if (pendingUpdateRef.current && sessionId) {
              lastUpdateRef.current = Date.now();
              updateLiveSessionState(sessionId, pendingUpdateRef.current);
              pendingUpdateRef.current = null;
            }
            throttleTimeoutRef.current = null;
          }, throttleMs - timeSinceLastUpdate);
        }
      }
    },
    [sessionId, isSpectator, throttleMs],
  );

  /**
   * End the session
   */
  const endSession = useCallback(
    async (finalScore: number, finalState: Record<string, unknown>) => {
      if (!sessionId) {
        return;
      }

      // Flush any pending updates first
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = null;
      }

      await endLiveSession(sessionId, finalScore, finalState);
      setIsLive(false);
    },
    [sessionId],
  );

  /**
   * Abandon the session
   */
  const abandonSession = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }

    await abandonLiveSession(sessionId);
    setIsLive(false);
  }, [sessionId]);

  // ==========================================================================
  // Spectator Functions
  // ==========================================================================

  /**
   * Leave spectator mode
   */
  const leaveSession = useCallback(async () => {
    if (!sessionId || !userId) {
      return;
    }

    await leaveLiveSessionAsSpectator(sessionId, userId);
    setIsLive(false);
    setSession(null);
  }, [sessionId, userId]);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    isLive,
    sessionId,
    session,
    gameState,
    currentScore,
    spectators,
    spectatorCount,
    loading,
    error,
    isSpectator,
    createSession,
    startSession,
    updateState,
    endSession,
    abandonSession,
    leaveSession,
  };
}
