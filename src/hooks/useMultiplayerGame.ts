/**
 * useMultiplayerGame — Unified multiplayer hook for quick-play game screens
 *
 * Wraps useScoreRace with feature-flag checks and provides a simpler
 * interface for game screens. Games only need to:
 *   1. Call useMultiplayerGame(gameType)
 *   2. Check `isMultiplayer` to decide which mode they're in
 *   3. Call `reportScore(n)` whenever score changes
 *   4. Call `reportFinished()` when the local game ends
 *   5. Render `<MultiplayerUI />` from the returned component
 *
 * The hook handles:
 *   - Feature flag checks
 *   - Connecting to Colyseus
 *   - Sending score updates
 *   - Providing opponent data
 *   - Reconnection
 *   - Rematch flow
 */

import { COLYSEUS_FEATURES } from "@/constants/featureFlags";
import { Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MultiplayerPhase =
  | "idle" // Not in multiplayer
  | "connecting" // Joining room
  | "waiting" // Waiting for opponent
  | "countdown" // 3-2-1 countdown
  | "playing" // Active gameplay
  | "finished" // Game over
  | "reconnecting" // Reconnecting to server
  | "gameOver"; // Game over (alias for finished)

export interface MultiplayerState {
  /** Whether multiplayer features are available for this game */
  isAvailable: boolean;

  /** Whether we're currently in a multiplayer session */
  isMultiplayer: boolean;

  /** Current multiplayer phase */
  phase: MultiplayerPhase;

  /** Countdown value (3, 2, 1, 0) */
  countdown: number;

  /** Alias for countdown */
  countdownValue: number;

  /** Local player's synced score */
  myScore: number;

  /** Opponent's live score */
  opponentScore: number;

  /** Opponent display name */
  opponentName: string;

  /** Opponent's avatar URL */
  opponentAvatar: string;

  /** Whether the local player won */
  isWinner: boolean | null;

  /** Whether the game was a tie */
  isTie: boolean;

  /** Name of the winner */
  winnerName: string;

  /** Time remaining in ms */
  timeRemaining: number;

  /** Local player's remaining lives */
  myLives: number;

  /** Opponent's remaining lives */
  opponentLives: number;

  /** Whether opponent disconnected */
  opponentDisconnected: boolean;

  /** Whether we're reconnecting */
  reconnecting: boolean;

  /** Whether opponent requested a rematch */
  rematchRequested: boolean;

  /** Connection error message */
  error: string | null;

  /** Network latency in ms */
  latency: number;

  /** Shared random seed for deterministic gameplay */
  seed: number;

  /** Whether the local user joined as spectator */
  isSpectator: boolean;

  /** Number of spectators currently watching */
  spectatorCount: number;

  /** Active Colyseus room */
  room: Room | null;

  /** Latest raw room state snapshot */
  rawState: unknown | null;
}

export interface MultiplayerActions {
  /** Start a multiplayer session for this game */
  startMultiplayer: (
    options?: string | { roomId?: string; spectator?: boolean },
  ) => Promise<void>;

  /** Alias for startMultiplayer */
  findMatch: () => Promise<void>;

  /** Cancel / leave multiplayer */
  cancelMultiplayer: () => void;

  /** Report a score update */
  reportScore: (score: number) => void;

  /** Report a life lost */
  reportLifeLost: () => void;

  /** Report a combo */
  reportCombo: (combo: number) => void;

  /** Report game finished locally */
  reportFinished: () => void;

  /** Request a rematch */
  requestRematch: () => void;

  /** Accept opponent's rematch request */
  acceptRematch: () => void;

  /** Send ready signal */
  sendReady: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseMultiplayerGameOptions {
  gameType: string;
  /** Firestore game ID from invite flow — used by filterBy to match both players */
  firestoreGameId?: string;
}

export function useMultiplayerGame(
  optionsOrGameType: string | UseMultiplayerGameOptions,
): MultiplayerState & MultiplayerActions {
  // Support both old string signature and new options object
  const { gameType, firestoreGameId: inviteGameId } =
    typeof optionsOrGameType === "string"
      ? { gameType: optionsOrGameType, firestoreGameId: undefined }
      : optionsOrGameType;
  const isAvailable =
    COLYSEUS_FEATURES.COLYSEUS_ENABLED && COLYSEUS_FEATURES.QUICKPLAY_ENABLED;

  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [phase, setPhase] = useState<MultiplayerPhase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentName, setOpponentName] = useState("");
  const [opponentAvatar, setOpponentAvatar] = useState("");
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [isTie, setIsTie] = useState(false);
  const [winnerName, setWinnerName] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [myLives, setMyLives] = useState(0);
  const [opponentLives, setOpponentLives] = useState(0);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);
  const [seed, setSeed] = useState(0);
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [room, setRoom] = useState<Room | null>(null);
  const [rawState, setRawState] = useState<unknown | null>(null);

  // Dynamic import refs — we lazily load useScoreRace only when needed
  const scoreRaceRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const myUidRef = useRef<string>("");
  const mySessionIdRef = useRef<string>("");

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Get my UID from Firebase auth
  useEffect(() => {
    try {
      const { getAuth } = require("firebase/auth");
      const user = getAuth().currentUser;
      if (user) myUidRef.current = user.uid;
    } catch {}
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────

  const startMultiplayer = useCallback(
    async (options?: string | { roomId?: string; spectator?: boolean }) => {
      const roomId = typeof options === "string" ? options : options?.roomId;
      const spectator =
        typeof options === "string" ? false : !!options?.spectator;

      if (!isAvailable) {
        setError("Multiplayer is not available");
        return;
      }

      setIsMultiplayer(true);
      setIsSpectator(spectator);
      setPhase("connecting");
      setError(null);

      try {
        // Dynamically import to avoid loading Colyseus when feature is off
        const { colyseusService } = await import("@/services/colyseus");
        const { getColyseusRoomName } = await import("@/config/colyseus");

        const roomName = getColyseusRoomName(gameType);
        if (!roomName) {
          throw new Error(`No Colyseus room configured for ${gameType}`);
        }

        const stateHandlers = {
          onStateChange: (state: any) => {
            if (!mountedRef.current) return;
            setRawState(state ?? null);
            setSpectatorCount(state?.spectatorCount ?? 0);

            // Map Colyseus state to our simplified state
            setPhase(state.phase || "waiting");
            setCountdown(state.countdown ?? 0);
            setTimeRemaining(state.timer?.remaining ?? 0);
            setSeed(state.seed ?? 0);

            // Find my player and opponent
            if (state.racePlayers) {
              const mySessionId = mySessionIdRef.current || room?.sessionId;
              let me: any = null;
              let opponent: any = null;

              state.racePlayers.forEach((player: any, key: string) => {
                if (player.sessionId === mySessionId || key === mySessionId) {
                  me = player;
                } else {
                  opponent = player;
                }
              });

              if (me) {
                setMyScore(me.currentScore ?? 0);
                setMyLives(me.lives ?? 0);
              }
              if (opponent) {
                setOpponentScore(opponent.currentScore ?? 0);
                setOpponentName(opponent.displayName ?? "Opponent");
                setOpponentAvatar(opponent.avatarUrl ?? "");
                setOpponentLives(opponent.lives ?? 0);
                setOpponentDisconnected(!opponent.connected);
              }
            }

            // Check for winner (winnerId is a UID, not session ID)
            if (state.winnerId && state.phase === "finished") {
              setIsWinner(state.winnerId === myUidRef.current);
              setIsTie(state.winReason === "tie");

              // Find winner name by UID
              if (state.racePlayers) {
                state.racePlayers.forEach((player: any) => {
                  if (player.uid === state.winnerId) {
                    setWinnerName(player.displayName ?? "");
                  }
                });
              }

              setPhase("finished");
            }
          },
          onError: (code: number, message?: string) => {
            if (!mountedRef.current) return;
            setError(`Connection error: ${message ?? "Unknown error"}`);
            setPhase("idle");
          },
          onLeave: (code: number) => {
            if (!mountedRef.current) return;
            if (code > 1000) {
              setError("Disconnected from server");
            }
          },
        };

        // If a roomId is provided (invite flow), join by ID instead of matchmaking.
        // If firestoreGameId is provided (universal invite flow), pass it to joinOrCreate
        // so server's filterBy(["firestoreGameId"]) matches both players to the same room.
        const joinOptions = {
          ...(inviteGameId ? { firestoreGameId: inviteGameId } : {}),
          ...(spectator ? { spectator: true } : {}),
        };
        const room = roomId
          ? await colyseusService.joinById(roomId, joinOptions, stateHandlers)
          : await colyseusService.joinOrCreate(
              gameType,
              joinOptions,
              stateHandlers,
            );

        scoreRaceRef.current = room;
        setRoom(room as Room);

        if (mountedRef.current) {
          setPhase("waiting");

          // Capture session ID from welcome message
          room?.onMessage("welcome", (data: any) => {
            if (mountedRef.current && data?.sessionId) {
              mySessionIdRef.current = data.sessionId;
            }
          });

          // Listen for additional messages
          room?.onMessage("rematch_request", () => {
            if (mountedRef.current) setRematchRequested(true);
          });
          room?.onMessage("opponent_reconnecting", () => {
            if (mountedRef.current) setOpponentDisconnected(true);
          });
          room?.onMessage("opponent_reconnected", () => {
            if (mountedRef.current) setOpponentDisconnected(false);
          });
        }
      } catch (err: any) {
        if (mountedRef.current) {
          setError(err.message || "Failed to connect");
          setPhase("idle");
          setIsMultiplayer(false);
        }
      }
    },
    [isAvailable, gameType, inviteGameId],
  );

  const cancelMultiplayer = useCallback(() => {
    if (scoreRaceRef.current) {
      scoreRaceRef.current.leave?.();
      scoreRaceRef.current = null;
    }
    setIsMultiplayer(false);
    setPhase("idle");
    setError(null);
    setRematchRequested(false);
    setOpponentDisconnected(false);
    setIsSpectator(false);
    setSpectatorCount(0);
    setRoom(null);
    setRawState(null);
  }, []);

  const reportScore = useCallback((score: number) => {
    if (scoreRaceRef.current) {
      scoreRaceRef.current.send?.("score_update", { score });
    }
  }, []);

  const reportLifeLost = useCallback(() => {
    if (scoreRaceRef.current) {
      scoreRaceRef.current.send?.("lose_life", {});
    }
  }, []);

  const reportCombo = useCallback((combo: number) => {
    if (scoreRaceRef.current) {
      scoreRaceRef.current.send?.("combo_update", { combo });
    }
  }, []);

  const reportFinished = useCallback(() => {
    if (scoreRaceRef.current) {
      scoreRaceRef.current.send?.("finished", {});
    }
  }, []);

  const requestRematch = useCallback(() => {
    if (scoreRaceRef.current) {
      scoreRaceRef.current.send?.("rematch", {});
    }
  }, []);

  const acceptRematch = useCallback(() => {
    if (scoreRaceRef.current) {
      scoreRaceRef.current.send?.("rematch_accept", {});
    }
    setRematchRequested(false);
    setPhase("waiting");
    setIsWinner(null);
    setIsTie(false);
  }, []);

  const sendReady = useCallback(() => {
    if (scoreRaceRef.current) {
      scoreRaceRef.current.send?.("ready", {});
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scoreRaceRef.current) {
        scoreRaceRef.current.leave?.();
        scoreRaceRef.current = null;
      }
    };
  }, []);

  return {
    // State
    isAvailable,
    isMultiplayer,
    phase,
    countdown,
    myScore,
    opponentScore,
    opponentName,
    opponentAvatar,
    isWinner,
    isTie,
    winnerName,
    timeRemaining,
    myLives,
    opponentLives,
    opponentDisconnected,
    reconnecting,
    rematchRequested,
    error,
    latency,
    seed,
    isSpectator,
    spectatorCount,
    room,
    rawState,
    countdownValue: countdown,
    // Actions
    startMultiplayer,
    findMatch: startMultiplayer,
    cancelMultiplayer,
    reportScore,
    reportLifeLost,
    reportCombo,
    reportFinished,
    requestRematch,
    acceptRematch,
    sendReady,
  };
}
