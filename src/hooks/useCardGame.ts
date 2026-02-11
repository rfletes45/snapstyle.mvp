/**
 * useCardGame — Multiplayer hook for card games with hidden information
 *
 * Unlike useTurnBasedGame (which syncs the board via Colyseus state),
 * card games keep hands private. The server sends each player their hand
 * via targeted messages. This hook:
 *   - Connects to a CardGameRoom on the Colyseus server
 *   - Listens for "hand" messages to get the player's private cards
 *   - Syncs shared state (top card, hand sizes, phase, etc.)
 *   - Exposes actions: playCard, drawCard, pass, resign, etc.
 *
 * Used by: CrazyEightsGameScreen, WarGameScreen
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §8
 */

import { COLYSEUS_FEATURES } from "@/constants/featureFlags";
import { Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";


import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useCardGame");
// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CardGamePhase =
  | "idle"
  | "connecting"
  | "waiting"
  | "countdown"
  | "playing"
  | "finished"
  | "reconnecting";

export interface CardInfo {
  suit: string;
  rank: string;
}

export interface CardGameState {
  /** Whether card-game multiplayer is available */
  isAvailable: boolean;

  /** Whether we're in a multiplayer session */
  isMultiplayer: boolean;

  /** Current phase */
  phase: CardGamePhase;

  /** Countdown value */
  countdown: number;

  /** My private hand (sent via targeted message) */
  hand: CardInfo[];

  /** Whether it's my turn (not used for War — both flip simultaneously) */
  isMyTurn: boolean;

  /** My player index (0 or 1) */
  myPlayerIndex: number;

  /** Turn number */
  turnNumber: number;

  /** My display name */
  myName: string;

  /** Opponent display name */
  opponentName: string;

  /** My avatar URL */
  myAvatar: string;

  /** Opponent avatar URL */
  opponentAvatar: string;

  /** My score */
  myScore: number;

  /** Opponent score */
  opponentScore: number;

  /** My hand size */
  myHandSize: number;

  /** Opponent hand size */
  opponentHandSize: number;

  /** Top discard card (face-up) */
  topCard: CardInfo | null;

  /** Current active suit (for Crazy Eights after 8 played) */
  currentSuit: string;

  /** Cards left in the draw deck */
  deckSize: number;

  /** Discard pile size */
  discardSize: number;

  /** Number of cards drawn this turn */
  drawCount: number;

  // ── War-specific fields ──

  /** Player 1's revealed card (War) */
  player1Card: CardInfo | null;

  /** Player 2's revealed card (War) */
  player2Card: CardInfo | null;

  /** Whether a War (tie) is in progress */
  isWar: boolean;

  /** War pile size */
  warPileSize: number;

  /** Player 1 deck size (War) */
  p1DeckSize: number;

  /** Player 2 deck size (War) */
  p2DeckSize: number;

  /** Round result: "player1" | "player2" | "war" | "" */
  roundResult: string;

  /** The card I just flipped (War, sent via targeted message) */
  myFlippedCard: CardInfo | null;

  // ── Game over ──

  /** Whether I won */
  isWinner: boolean | null;

  /** Whether it was a draw */
  isDraw: boolean;

  /** Winner's name */
  winnerName: string;

  /** Win reason */
  winReason: string;

  /** Opponent disconnected? */
  opponentDisconnected: boolean;

  /** Reconnecting? */
  reconnecting: boolean;

  /** Whether the local user is a spectator (not a player) */
  isSpectator: boolean;

  /** Number of spectators watching the game */
  spectatorCount: number;

  /** Rematch requested by opponent? */
  rematchRequested: boolean;

  /** Connection error */
  error: string | null;

  /** Active Colyseus room for multiplayer spectator integration */
  room: Room | null;

  /** Latest raw room state snapshot for spectator/session consumers */
  rawState: unknown | null;
}

export interface CardGameActions {
  /** Start a multiplayer session */
  startMultiplayer: (
    options?:
      | string
      | { roomId?: string; firestoreGameId?: string; spectator?: boolean },
  ) => Promise<void>;

  /** Alias for startMultiplayer */
  findMatch: () => Promise<void>;

  /** Cancel / leave */
  cancelMultiplayer: () => void;

  /** Send ready signal */
  sendReady: () => void;

  /** Play a card (Crazy Eights) */
  playCard: (card: CardInfo, declaredSuit?: string) => void;

  /** Draw a card (Crazy Eights) */
  drawCard: () => void;

  /** Pass turn (Crazy Eights) */
  pass: () => void;

  /** Flip card (War) */
  flipCard: () => void;

  /** Send any game action */
  sendAction: (type: string, payload?: any) => void;

  /** Resign */
  resign: () => void;

  /** Request rematch */
  requestRematch: () => void;

  /** Accept rematch */
  acceptRematch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useCardGame(gameType: string): CardGameState & CardGameActions {
  const isAvailable =
    COLYSEUS_FEATURES.COLYSEUS_ENABLED &&
    COLYSEUS_FEATURES.COMPLEX_TURNBASED_ENABLED;

  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [phase, setPhase] = useState<CardGamePhase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [hand, setHand] = useState<CardInfo[]>([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [myPlayerIndex, setMyPlayerIndex] = useState(0);
  const [turnNumber, setTurnNumber] = useState(0);
  const [myName, setMyName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [myAvatar, setMyAvatar] = useState("");
  const [opponentAvatar, setOpponentAvatar] = useState("");
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [myHandSize, setMyHandSize] = useState(0);
  const [opponentHandSize, setOpponentHandSize] = useState(0);
  const [topCard, setTopCard] = useState<CardInfo | null>(null);
  const [currentSuit, setCurrentSuit] = useState("");
  const [deckSize, setDeckSize] = useState(0);
  const [discardSize, setDiscardSize] = useState(0);
  const [drawCount, setDrawCount] = useState(0);

  // War-specific
  const [player1Card, setPlayer1Card] = useState<CardInfo | null>(null);
  const [player2Card, setPlayer2Card] = useState<CardInfo | null>(null);
  const [isWar, setIsWar] = useState(false);
  const [warPileSize, setWarPileSize] = useState(0);
  const [p1DeckSize, setP1DeckSize] = useState(0);
  const [p2DeckSize, setP2DeckSize] = useState(0);
  const [roundResult, setRoundResult] = useState("");
  const [myFlippedCard, setMyFlippedCard] = useState<CardInfo | null>(null);

  // Game over
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [winnerName, setWinnerName] = useState("");
  const [winReason, setWinReason] = useState("");
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [rawState, setRawState] = useState<unknown | null>(null);

  const roomRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─── State Sync ──────────────────────────────────────────────────────

  const handleStateChange = useCallback((state: any) => {
    if (!mountedRef.current) return;
    setRawState(state ?? null);
    const room = roomRef.current;
    const mySessionId = room?.sessionId;

    // Phase
    setPhase(state.phase || "waiting");
    setCountdown(state.countdown ?? 0);
    setTurnNumber(state.turnNumber ?? 0);

    // Spectator count
    setSpectatorCount(state.spectatorCount ?? 0);

    // Card state
    if (state.topCard) {
      const tc = state.topCard;
      setTopCard(tc.faceUp ? { suit: tc.suit, rank: tc.rank } : null);
    }
    setCurrentSuit(state.currentSuit ?? "");
    setDeckSize(state.deckSize ?? 0);
    setDiscardSize(state.discardSize ?? 0);
    setDrawCount(state.drawCount ?? 0);

    // War state
    if (state.player1Card?.faceUp) {
      setPlayer1Card({
        suit: state.player1Card.suit,
        rank: state.player1Card.rank,
      });
    } else {
      setPlayer1Card(null);
    }
    if (state.player2Card?.faceUp) {
      setPlayer2Card({
        suit: state.player2Card.suit,
        rank: state.player2Card.rank,
      });
    } else {
      setPlayer2Card(null);
    }
    setIsWar(state.isWar ?? false);
    setWarPileSize(state.warPileSize ?? 0);
    setP1DeckSize(state.p1DeckSize ?? 0);
    setP2DeckSize(state.p2DeckSize ?? 0);
    setRoundResult(state.roundResult ?? "");

    // Players (using cardPlayers map)
    if (state.cardPlayers) {
      let me: any = null;
      let opponent: any = null;

      state.cardPlayers.forEach((player: any) => {
        if (player.sessionId === mySessionId) {
          me = player;
        } else {
          opponent = player;
        }
      });

      if (me) {
        setMyPlayerIndex(me.playerIndex ?? 0);
        setMyName(me.displayName ?? "You");
        setMyAvatar(me.avatarUrl ?? "");
        setMyScore(me.score ?? 0);
        setMyHandSize(me.handSize ?? 0);
      }
      if (opponent) {
        setOpponentName(opponent.displayName ?? "Opponent");
        setOpponentAvatar(opponent.avatarUrl ?? "");
        setOpponentScore(opponent.score ?? 0);
        setOpponentHandSize(opponent.handSize ?? 0);
        setOpponentDisconnected(!opponent.connected);
      }

      // Turn detection
      if (state.currentTurnPlayerId && mySessionId) {
        setIsMyTurn(state.currentTurnPlayerId === mySessionId);
      }
    }

    // Winner detection
    if (
      state.winnerId !== undefined &&
      state.winnerId !== "" &&
      state.phase === "finished"
    ) {
      let isMyWin = false;
      let wName = "";
      if (state.cardPlayers) {
        state.cardPlayers.forEach((player: any) => {
          if (player.uid === state.winnerId) {
            wName = player.displayName ?? "";
            if (player.sessionId === mySessionId) {
              isMyWin = true;
            }
          }
        });
      }
      setIsWinner(isMyWin);
      setWinnerName(wName);
      setIsDraw(false);
      setWinReason(state.winReason ?? "");
      setPhase("finished");
    } else if (
      state.phase === "finished" &&
      (state.winnerId === "" || !state.winnerId)
    ) {
      setIsWinner(null);
      setIsDraw(true);
      setWinnerName("");
      setWinReason(state.winReason ?? "draw");
      setPhase("finished");
    }
  }, []);

  // ─── Join Room ──────────────────────────────────────────────────────

  const joinRoom = useCallback(
    async (options: Record<string, any> = {}) => {
      setIsMultiplayer(true);
      setPhase("connecting");
      setError(null);

      try {
        const { colyseusService } = await import("@/services/colyseus");
        const { getColyseusRoomName } = await import("@/config/colyseus");

        const roomName = getColyseusRoomName(gameType);
        if (!roomName) {
          throw new Error(`No Colyseus room configured for ${gameType}`);
        }

        // If a roomId is provided (invite flow), join by ID instead of matchmaking
        const { roomId, ...joinOptions } = options;
        let room;
        if (roomId) {
          room = await colyseusService.joinById(roomId, joinOptions, {
            onStateChange: handleStateChange,
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
          });
        } else {
          room = await colyseusService.joinOrCreate(gameType, joinOptions, {
            onStateChange: handleStateChange,
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
          });
        }

        roomRef.current = room;
        setRoom(room as Room);

        if (mountedRef.current) {
          setPhase("waiting");

          // ── Private hand messages ──
          room?.onMessage("hand", (data: any) => {
            if (!mountedRef.current) return;
            if (data?.cards && Array.isArray(data.cards)) {
              setHand(
                data.cards.map((c: any) => ({
                  suit: c.suit,
                  rank: c.rank,
                })),
              );
            }
          });

          // ── War: my flipped card ──
          room?.onMessage("your_flip", (data: any) => {
            if (!mountedRef.current) return;
            if (data?.card) {
              setMyFlippedCard({
                suit: data.card.suit,
                rank: data.card.rank,
              });
            }
          });

          // ── War: ready / flip prompts ──
          room?.onMessage("war_ready", () => {
            if (!mountedRef.current) return;
            setMyFlippedCard(null);
          });
          room?.onMessage("war_flip", () => {
            if (!mountedRef.current) return;
            setMyFlippedCard(null);
          });

          // ── Rematch ──
          room?.onMessage("rematch_request", () => {
            if (mountedRef.current) setRematchRequested(true);
          });

          // ── Server errors ──
          room?.onMessage("error", (data: any) => {
            if (mountedRef.current) {
              logger.warn(`[CardGame] Server error: ${data.message}`);
            }
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
    [gameType, handleStateChange],
  );

  // ─── Public Actions ──────────────────────────────────────────────────

  const startMultiplayer = useCallback(
    async (
      options?:
        | string
        | { roomId?: string; firestoreGameId?: string; spectator?: boolean },
    ) => {
      if (!isAvailable) {
        setError("Card game multiplayer is not available");
        return;
      }
      // Support old signature: startMultiplayer(roomId?: string)
      // and new signature: startMultiplayer({ firestoreGameId })
      if (typeof options === "string") {
        await joinRoom({ roomId: options });
      } else if (options?.firestoreGameId) {
        if (options.spectator) {
          setIsSpectator(true);
        }
        await joinRoom({
          firestoreGameId: options.firestoreGameId,
          ...(options.spectator ? { spectator: true } : {}),
        });
      } else if (options?.roomId) {
        if (options.spectator) {
          setIsSpectator(true);
        }
        await joinRoom({
          roomId: options.roomId,
          ...(options.spectator ? { spectator: true } : {}),
        });
      } else {
        await joinRoom();
      }
    },
    [isAvailable, joinRoom],
  );

  const cancelMultiplayer = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.leave?.();
      roomRef.current = null;
    }
    setIsMultiplayer(false);
    setPhase("idle");
    setError(null);
    setHand([]);
    setMyFlippedCard(null);
    setRematchRequested(false);
    setOpponentDisconnected(false);
    setRawState(null);
    setRoom(null);
  }, []);

  const sendReady = useCallback(() => {
    roomRef.current?.send?.("ready", {});
  }, []);

  const playCard = useCallback((card: CardInfo, declaredSuit?: string) => {
    roomRef.current?.send?.("game_action", {
      type: "play",
      card,
      declaredSuit,
    });
  }, []);

  const drawCard = useCallback(() => {
    roomRef.current?.send?.("game_action", { type: "draw" });
  }, []);

  const pass = useCallback(() => {
    roomRef.current?.send?.("game_action", { type: "pass" });
  }, []);

  const flipCard = useCallback(() => {
    roomRef.current?.send?.("game_action", { type: "flip" });
  }, []);

  const sendAction = useCallback((type: string, payload?: any) => {
    roomRef.current?.send?.("game_action", { type, ...payload });
  }, []);

  const resign = useCallback(() => {
    roomRef.current?.send?.("resign", {});
  }, []);

  const requestRematch = useCallback(() => {
    roomRef.current?.send?.("rematch", {});
  }, []);

  const acceptRematch = useCallback(() => {
    roomRef.current?.send?.("rematch_accept", {});
    setRematchRequested(false);
    setPhase("waiting");
    setIsWinner(null);
    setIsDraw(false);
    setWinnerName("");
    setWinReason("");
    setHand([]);
    setMyFlippedCard(null);
  }, []);

  // ─── Cleanup ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.leave?.();
        roomRef.current = null;
      }
      setRoom(null);
      setRawState(null);
    };
  }, []);

  return {
    // State
    isAvailable,
    isMultiplayer,
    phase,
    countdown,
    hand,
    isMyTurn,
    myPlayerIndex,
    turnNumber,
    myName,
    opponentName,
    myAvatar,
    opponentAvatar,
    myScore,
    opponentScore,
    myHandSize,
    opponentHandSize,
    topCard,
    currentSuit,
    deckSize,
    discardSize,
    drawCount,
    player1Card,
    player2Card,
    isWar,
    warPileSize,
    p1DeckSize,
    p2DeckSize,
    roundResult,
    myFlippedCard,
    isWinner,
    isDraw,
    winnerName,
    winReason,
    opponentDisconnected,
    reconnecting,
    rematchRequested,
    isSpectator,
    spectatorCount,
    error,
    room,
    rawState,
    // Actions
    startMultiplayer,
    findMatch: startMultiplayer,
    cancelMultiplayer,
    sendReady,
    playCard,
    drawCard,
    pass,
    flipCard,
    sendAction,
    resign,
    requestRematch,
    acceptRematch,
  };
}
