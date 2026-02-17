/**
 * useSketchPartyGame — Hook for Sketch Party multiplayer room
 *
 * Wraps useColyseus with Sketch-Party-specific state selectors and actions.
 * Manages connection to the "sketch_party" Colyseus room, maps schema state
 * to typed React state, and provides action dispatchers.
 *
 * Usage:
 *   const sp = useSketchPartyGame({ firestoreGameId });
 *   sp.sendReady();
 *   sp.sendGuess("cat");
 *
 * @see colyseus-server/src/rooms/party/SketchPartyRoom.ts
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useColyseus } from "./useColyseus";

// =============================================================================
// Types
// =============================================================================

export interface SketchPartyPlayerInfo {
  sessionId: string;
  uid: string;
  displayName: string;
  avatarUrl: string;
  score: number;
  isDrawer: boolean;
  hasGuessed: boolean;
  guessRank: number;
  connected: boolean;
  ready: boolean;
}

export interface ChatMessage {
  sessionId: string;
  displayName: string;
  text: string;
  isCorrect?: boolean;
  isSystem?: boolean;
  kind?: string;
  timestamp: number;
}

export interface DrawOp {
  type: "begin" | "points" | "end" | "undo" | "clear";
  [key: string]: any;
}

export interface TurnRevealPayload {
  word: string;
  deltas: Array<{ uid: string; delta: number }>;
  scores: Array<{ uid: string; score: number }>;
}

export interface GameOverPayload {
  winnerId: string;
  finalScores: Array<{ uid: string; displayName: string; score: number }>;
}

export interface UseSketchPartyGameOptions {
  /** Firestore game ID from invite flow */
  firestoreGameId?: string;
  /** Auto-join room on mount (default: true) */
  autoJoin?: boolean;
  /** Join as spectator */
  spectator?: boolean;
}

export interface UseSketchPartyGameReturn {
  // Connection state
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
  latency: number | null;
  /** The raw Colyseus Room instance (null until connected). */
  room: import("@colyseus/sdk").Room | null;

  // Game state
  phase: string;
  turnSubphase: string;
  roundNumber: number;
  rounds: number;
  turnIndex: number;
  currentDrawerUid: string;
  hostUid: string;
  wordMask: string;
  wordLength: number;
  correctGuessCount: number;
  countdown: number;
  turnEndsAt: number;
  chooseEndsAt: number;
  revealEndsAt: number;

  // Players
  players: SketchPartyPlayerInfo[];
  mySessionId: string | null;
  isHost: boolean;
  isDrawer: boolean;
  isSpectator: boolean;
  hasGuessed: boolean;
  canGuess: boolean;
  canDraw: boolean;

  // Timers (seconds remaining, updated every second)
  turnSecondsLeft: number;
  chooseSecondsLeft: number;

  // Settings
  drawTimeSec: number;

  // Chat
  chatMessages: ChatMessage[];

  // Drawing ops (for non-drawers / snapshot replay)
  drawOps: DrawOp[];
  canvasSnapshot: DrawOp[] | null;

  // Word choices (drawer only)
  wordChoices: string[];
  /** The actual word the drawer is drawing (drawer only, empty for guessers) */
  drawerWord: string;

  // Reveal / game over
  lastReveal: TurnRevealPayload | null;
  gameOverData: GameOverPayload | null;

  // Actions
  sendReady: () => void;
  sendStartGame: () => void;
  sendChooseWord: (index: number) => void;
  sendGuess: (text: string) => void;
  sendDrawBegin: (payload: any) => void;
  sendDrawPoints: (payload: any) => void;
  sendDrawEnd: (payload: any) => void;
  sendDrawUndo: () => void;
  sendDrawClear: () => void;
  sendUpdateSettings: (settings: Partial<SketchPartySettings>) => void;
  leaveRoom: () => Promise<void>;
  joinRoom: () => Promise<void>;
}

export interface SketchPartySettings {
  rounds?: number;
  drawTimeSec?: number;
  wordChoiceCount?: number;
  hints?: number;
}

// =============================================================================
// Hook
// =============================================================================

export function useSketchPartyGame({
  firestoreGameId,
  autoJoin = true,
  spectator = false,
}: UseSketchPartyGameOptions): UseSketchPartyGameReturn {
  // ---------------------------------------------------------------------------
  // Colyseus connection
  // ---------------------------------------------------------------------------
  const {
    room,
    state,
    connected,
    reconnecting,
    error,
    sendMessage,
    joinRoom,
    leaveRoom,
    latency,
  } = useColyseus({
    gameType: "sketch_party_game",
    firestoreGameId,
    autoJoin,
    options: { firestoreGameId, spectator },
  });

  // ---------------------------------------------------------------------------
  // Local state for message-based data (not in schema)
  // ---------------------------------------------------------------------------
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [drawOps, setDrawOps] = useState<DrawOp[]>([]);
  const [canvasSnapshot, setCanvasSnapshot] = useState<DrawOp[] | null>(null);
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [drawerWord, setDrawerWord] = useState("");
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [lastReveal, setLastReveal] = useState<TurnRevealPayload | null>(null);
  const [gameOverData, setGameOverData] = useState<GameOverPayload | null>(
    null,
  );
  const [isSpectator, setIsSpectator] = useState(spectator);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Message listeners
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!room) return;

    if (__DEV__)
      console.log("[SketchParty] Room connected, sessionId:", room.sessionId);

    // Set mySessionId immediately from the Room object — the server's
    // "welcome" message often arrives BEFORE this useEffect fires (during
    // the joinOrCreate handshake), so relying on it leaves mySessionId
    // null and breaks isHost / isDrawer / canDraw / canGuess.
    setMySessionId(room.sessionId);

    const on = (type: string, handler: (payload: any) => void) => {
      room.onMessage(type, (payload) => {
        if (__DEV__)
          console.log(
            `[SketchParty] msg:${type}`,
            typeof payload === "object"
              ? JSON.stringify(payload).slice(0, 200)
              : payload,
          );
        handler(payload);
      });
    };

    // Keep welcome listener for any supplementary data, but sessionId is
    // already set above so this is a fallback/no-op for that field.
    on("welcome", (payload: { sessionId: string; isHost?: boolean }) => {
      if (!mountedRef.current) return;
      setMySessionId(payload.sessionId);
    });

    on("chat", (msg: any) => {
      if (!mountedRef.current) return;
      setChatMessages((prev) => [
        ...prev,
        {
          sessionId: msg.sessionId ?? "__system__",
          displayName: msg.displayName ?? "System",
          text: msg.text ?? "",
          isCorrect: msg.isCorrect ?? false,
          isSystem: msg.isSystem ?? false,
          kind: msg.kind ?? "chat",
          timestamp: Date.now(),
        },
      ]);
    });

    on("draw_op", (op: DrawOp) => {
      if (!mountedRef.current) return;
      setDrawOps((prev) => [...prev, op]);
    });

    on("canvas_snapshot", (payload: { ops: DrawOp[] }) => {
      if (!mountedRef.current) return;
      setCanvasSnapshot(payload.ops);
      setDrawOps([]); // Reset incremental ops; snapshot is baseline
    });

    on("word_choices", (payload: { words: string[] }) => {
      if (!mountedRef.current) return;
      setWordChoices(payload.words);
    });

    on("drawer_word", (payload: { word: string }) => {
      if (!mountedRef.current) return;
      setDrawerWord(payload.word);
    });

    on(
      "player_guessed",
      (payload: {
        uid: string;
        displayName: string;
        guessRank: number;
        pointsEarned: number;
      }) => {
        if (!mountedRef.current) return;
        // Appended as system chat line by the server "chat" message too,
        // but we can use this for toasts or highlights if desired.
      },
    );

    on("hint_revealed", (_payload: { mask: string; revealedCount: number }) => {
      // Mask updates come via schema state sync, this is supplementary.
    });

    on("turn_reveal", (payload: TurnRevealPayload) => {
      if (!mountedRef.current) return;
      setLastReveal(payload);
      // Clear drawing state for next turn
      setDrawOps([]);
      setCanvasSnapshot(null);
      setWordChoices([]);
      setDrawerWord("");
    });

    on("game_over", (payload: GameOverPayload) => {
      if (!mountedRef.current) return;
      setGameOverData(payload);
    });

    on("error", (payload: { message: string }) => {
      if (!mountedRef.current) return;
      // Could surface as a snackbar; for now append to chat
      setChatMessages((prev) => [
        ...prev,
        {
          sessionId: "__system__",
          displayName: "System",
          text: payload.message,
          isSystem: true,
          kind: "error",
          timestamp: Date.now(),
        },
      ]);
    });

    // Cleanup: room.leave() handles listener teardown automatically
    return () => {};
  }, [room]);

  // ---------------------------------------------------------------------------
  // Derived state from schema — read directly from room.state (live Schema)
  // ---------------------------------------------------------------------------

  // Scalar state from schema (read from useColyseus spread as fallback)
  const phase = state?.phase ?? "waiting";
  const turnSubphase = state?.turnSubphase ?? "lobby";
  const roundNumber = state?.roundNumber ?? 0;
  const rounds = state?.rounds ?? 3;
  const turnIndex = state?.turnIndex ?? 0;
  const currentDrawerUid = state?.currentDrawerUid ?? "";
  const wordMask = state?.wordMask ?? "";
  const wordLength = state?.wordLength ?? 0;
  const correctGuessCount = state?.correctGuessCount ?? 0;
  const countdown = state?.countdown ?? 0;
  const turnEndsAt = state?.turnEndsAt ?? 0;
  const chooseEndsAt = state?.chooseEndsAt ?? 0;
  const revealEndsAt = state?.revealEndsAt ?? 0;

  // ---------------------------------------------------------------------------
  // Player list + critical scalars — read directly from room.state (bypasses
  // the useColyseus spread which can lose MapSchema data).
  //
  // room.onStateChange fires on every state patch AFTER the decoder updates
  // the live Schema tree, so room.state.spPlayers.$items always has current
  // data when we snapshot.
  // ---------------------------------------------------------------------------
  const [players, setPlayers] = useState<SketchPartyPlayerInfo[]>([]);
  const [hostUid, setHostUid] = useState("");
  const [drawTimeSec, setDrawTimeSec] = useState(80);

  useEffect(() => {
    if (!room) return;

    const snapshot = () => {
      const s = room.state as any;
      if (!s) return;

      // Critical scalars — read from live Schema, not the spread copy
      setHostUid(s.hostUid ?? "");
      setDrawTimeSec(s.drawTimeSec ?? 80);

      // Player list — iterate the live MapSchema
      const sp = s.spPlayers;
      if (!sp || typeof sp.forEach !== "function") {
        setPlayers([]);
        return;
      }
      const result: SketchPartyPlayerInfo[] = [];
      sp.forEach((p: any) => {
        result.push({
          sessionId: p.sessionId ?? "",
          uid: p.uid ?? "",
          displayName: p.displayName ?? "",
          avatarUrl: p.avatarUrl ?? "",
          score: p.score ?? 0,
          isDrawer: p.isDrawer ?? false,
          hasGuessed: p.hasGuessed ?? false,
          guessRank: p.guessRank ?? 0,
          connected: p.connected ?? false,
          ready: p.ready ?? false,
        });
      });
      if (__DEV__)
        console.log(
          "[SketchParty] snapshot players:",
          result.length,
          result.map((p) => `${p.displayName}(ready=${p.ready})`).join(", "),
        );
      setPlayers(result);
    };

    // Immediate snapshot — room already has initial state after joinOrCreate
    snapshot();

    // Subscribe directly to state changes on the Room object.
    // This is independent of the useColyseus service-level listener.
    const handler = () => snapshot();
    room.onStateChange(handler);

    return () => {
      room.onStateChange.remove(handler);
    };
  }, [room]);

  // Determine derived booleans
  const myPlayer = players.find((p) => p.sessionId === mySessionId);
  const isHost = myPlayer ? myPlayer.uid === hostUid : false;
  const isDrawer = myPlayer ? myPlayer.uid === currentDrawerUid : false;
  const hasGuessed = myPlayer?.hasGuessed ?? false;
  const canGuess =
    !isSpectator &&
    !isDrawer &&
    !hasGuessed &&
    phase === "playing" &&
    turnSubphase === "drawing";
  const canDraw = !isSpectator && isDrawer && turnSubphase === "drawing";

  // ---------------------------------------------------------------------------
  // Timer: update seconds remaining every second
  // ---------------------------------------------------------------------------
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const turnSecondsLeft = Math.max(0, Math.ceil((turnEndsAt - now) / 1000));
  const chooseSecondsLeft = Math.max(0, Math.ceil((chooseEndsAt - now) / 1000));

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const sendReady = useCallback(() => {
    if (__DEV__) console.log("[SketchParty] sendReady");
    sendMessage("ready");
  }, [sendMessage]);

  const sendStartGame = useCallback(
    () => sendMessage("start_game"),
    [sendMessage],
  );

  const sendChooseWord = useCallback(
    (index: number) => sendMessage("choose_word", { index }),
    [sendMessage],
  );

  const sendGuess = useCallback(
    (text: string) => sendMessage("guess", { text }),
    [sendMessage],
  );

  const sendDrawBegin = useCallback(
    (payload: any) => sendMessage("draw_begin", payload),
    [sendMessage],
  );

  const sendDrawPoints = useCallback(
    (payload: any) => sendMessage("draw_points", payload),
    [sendMessage],
  );

  const sendDrawEnd = useCallback(
    (payload: any) => sendMessage("draw_end", payload),
    [sendMessage],
  );

  const sendDrawUndo = useCallback(
    () => sendMessage("draw_undo"),
    [sendMessage],
  );

  const sendDrawClear = useCallback(
    () => sendMessage("draw_clear"),
    [sendMessage],
  );

  const sendUpdateSettings = useCallback(
    (settings: Partial<SketchPartySettings>) =>
      sendMessage("update_settings", settings),
    [sendMessage],
  );

  return {
    connected,
    reconnecting,
    error,
    latency,
    room,

    phase,
    turnSubphase,
    roundNumber,
    rounds,
    turnIndex,
    currentDrawerUid,
    hostUid,
    wordMask,
    wordLength,
    correctGuessCount,
    countdown,
    turnEndsAt,
    chooseEndsAt,
    revealEndsAt,

    players,
    mySessionId,
    isHost,
    isDrawer,
    isSpectator,
    hasGuessed,
    canGuess,
    canDraw,

    turnSecondsLeft,
    chooseSecondsLeft,

    drawTimeSec,

    chatMessages,
    drawOps,
    canvasSnapshot,
    wordChoices,
    drawerWord,

    lastReveal,
    gameOverData,

    sendReady,
    sendStartGame,
    sendChooseWord,
    sendGuess,
    sendDrawBegin,
    sendDrawPoints,
    sendDrawEnd,
    sendDrawUndo,
    sendDrawClear,
    sendUpdateSettings,
    leaveRoom,
    joinRoom,
  };
}
