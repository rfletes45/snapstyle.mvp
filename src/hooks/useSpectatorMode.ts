/**
 * useSpectatorMode Hook
 *
 * Manages spectator mode state for game screens.
 * Handles joining/leaving spectator mode and provides UI state.
 *
 * @example
 * const {
 *   isSpectator,
 *   spectatorCount,
 *   spectators,
 *   leaveSpectatorMode,
 * } = useSpectatorMode({
 *   matchId,
 *   inviteId,
 *   spectatorMode: route.params?.spectatorMode,
 *   userId: currentFirebaseUser?.uid,
 *   userName: currentFirebaseUser?.displayName,
 * });
 */

import { collection, onSnapshot, query } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

import { getFirestoreInstance } from "@/services/firebase";
import {
  joinAsSpectator as joinAsInviteSpectator,
  leaveSpectator as leaveInviteSpectator,
} from "@/services/gameInvites";
import {
  joinAsSpectator as joinAsSpectatorService,
  leaveAsSpectator,
} from "@/services/turnBasedGames";

// Helper to get Firestore instance
const getDb = () => getFirestoreInstance();

// =============================================================================
// Types
// =============================================================================

export interface SpectatorInfo {
  id: string;
  displayName: string;
  joinedAt: number;
}

export interface UseSpectatorModeParams {
  /** The match ID to spectate */
  matchId: string | null;
  /** The invite ID (for invite-based spectating) */
  inviteId?: string;
  /** Whether spectator mode was requested via navigation params */
  spectatorMode?: boolean;
  /** Current user ID */
  userId?: string;
  /** Current user display name */
  userName?: string;
  /** Current user avatar URL */
  userAvatar?: string;
}

export interface UseSpectatorModeResult {
  /** Whether the current user is in spectator mode */
  isSpectator: boolean;
  /** Number of spectators watching */
  spectatorCount: number;
  /** List of spectators */
  spectators: SpectatorInfo[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Leave spectator mode and navigate back */
  leaveSpectatorMode: () => Promise<void>;
  /** The spectator document ID (for cleanup) */
  spectatorDocId: string | null;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useSpectatorMode({
  matchId,
  inviteId,
  spectatorMode = false,
  userId,
  userName,
  userAvatar,
}: UseSpectatorModeParams): UseSpectatorModeResult {
  // State
  const [isSpectator, setIsSpectator] = useState(spectatorMode);
  const [spectators, setSpectators] = useState<SpectatorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spectatorDocId, setSpectatorDocId] = useState<string | null>(null);

  // ==========================================================================
  // Join Spectator Mode
  // ==========================================================================

  useEffect(() => {
    if (!spectatorMode || !matchId || !userId || !userName) {
      return;
    }

    const joinSpectator = async () => {
      setLoading(true);
      setError(null);

      try {
        // Try match-level spectator first
        const docId = await joinAsSpectatorService(matchId, userId, userName);
        setSpectatorDocId(docId);
        setIsSpectator(true);
        console.log(`[SpectatorMode] Joined match ${matchId} as spectator`);
      } catch (err) {
        // If match-level fails, try invite-level
        if (inviteId) {
          try {
            const result = await joinAsInviteSpectator(
              inviteId,
              userId,
              userName,
              userAvatar,
            );
            if (result.success) {
              setIsSpectator(true);
              console.log(
                `[SpectatorMode] Joined invite ${inviteId} as spectator`,
              );
            } else {
              setError(result.error || "Failed to join as spectator");
            }
          } catch (inviteErr) {
            setError("Failed to join as spectator");
            console.error("[SpectatorMode] Error joining:", inviteErr);
          }
        } else {
          setError("Failed to join as spectator");
          console.error("[SpectatorMode] Error joining:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    joinSpectator();
  }, [spectatorMode, matchId, inviteId, userId, userName, userAvatar]);

  // ==========================================================================
  // Subscribe to Spectators
  // ==========================================================================

  useEffect(() => {
    if (!matchId) {
      setSpectators([]);
      return;
    }

    // Subscribe to spectators subcollection under the game
    const spectatorsRef = collection(
      getDb(),
      `TurnBasedGames/${matchId}/spectators`,
    );
    const q = query(spectatorsRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const spectatorList: SpectatorInfo[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          displayName: doc.data().displayName || "Anonymous",
          joinedAt: doc.data().joinedAt || Date.now(),
        }));
        setSpectators(spectatorList);
      },
      (err) => {
        console.error("[SpectatorMode] Error subscribing to spectators:", err);
      },
    );

    return () => unsubscribe();
  }, [matchId]);

  // ==========================================================================
  // Leave Spectator Mode
  // ==========================================================================

  const leaveSpectatorMode = useCallback(async () => {
    if (!matchId || !userId) return;

    setLoading(true);

    try {
      // Leave match-level spectator
      if (spectatorDocId) {
        await leaveAsSpectator(matchId, spectatorDocId);
        console.log(`[SpectatorMode] Left match ${matchId}`);
      }

      // Leave invite-level spectator
      if (inviteId) {
        await leaveInviteSpectator(inviteId, userId);
        console.log(`[SpectatorMode] Left invite ${inviteId}`);
      }

      setIsSpectator(false);
      setSpectatorDocId(null);
    } catch (err) {
      console.error("[SpectatorMode] Error leaving:", err);
    } finally {
      setLoading(false);
    }
  }, [matchId, inviteId, userId, spectatorDocId]);

  // ==========================================================================
  // Cleanup on unmount
  // ==========================================================================

  useEffect(() => {
    return () => {
      // Auto-leave when component unmounts
      if (isSpectator && matchId && spectatorDocId) {
        leaveAsSpectator(matchId, spectatorDocId).catch(console.error);
      }
    };
  }, [isSpectator, matchId, spectatorDocId]);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    isSpectator,
    spectatorCount: spectators.length,
    spectators,
    loading,
    error,
    leaveSpectatorMode,
    spectatorDocId,
  };
}

export default useSpectatorMode;
