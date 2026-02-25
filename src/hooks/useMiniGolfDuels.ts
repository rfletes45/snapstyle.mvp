/**
 * useMiniGolfDuels — Hook for the minigolf_duels Colyseus room
 *
 * Wraps useColyseus with mini-golf-specific state selectors and actions.
 * Maps schema state to typed React state and provides action dispatchers.
 *
 * @see colyseus-server/src/rooms/physics/MiniGolfDuelsRoom.ts
 */

import { recordRematchCompleted } from "@/services/socialGameStats";
import { getAuth } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { useColyseus } from "./useColyseus";

// =============================================================================
// Types
// =============================================================================

export interface MiniGolfPlayerInfo {
  uid: string;
  sessionId: string;
  displayName: string;
  avatarUrl: string;
  connected: boolean;
  ready: boolean;
  playerIndex: number;
}

export interface BallState {
  uid: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface ObstacleState {
  id: string;
  obstacleType: string;
  x: number;
  y: number;
  angle: number;
}

export interface GameOverPayload {
  winnerId: string;
  winReason: string;
}

export interface UseMiniGolfDuelsOptions {
  firestoreGameId?: string;
  autoJoin?: boolean;
  spectator?: boolean;
  /** Forwarded to Colyseus join options for server-side invite finalization. */
  inviteId?: string;
}

export interface UseMiniGolfDuelsReturn {
  // Connection
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
  latency: number | null;

  // Game lifecycle
  phase: string;
  countdown: number;
  subPhase: string;

  // Course
  packId: string;
  holeId: string;
  holeIndex: number;
  holesTotal: number;
  par: number;

  // Turn
  currentTurnUid: string;
  myUid: string;
  isMyTurn: boolean;
  isSpectator: boolean;

  // Players
  players: MiniGolfPlayerInfo[];
  myPlayer: MiniGolfPlayerInfo | null;
  opponentPlayer: MiniGolfPlayerInfo | null;

  // Strokes
  strokesHoleByUid: Record<string, number>;
  strokesTotalByUid: Record<string, number>;
  holedByUid: Record<string, number>;

  // Balls
  balls: Record<string, BallState>;

  // Obstacles (dynamic transforms)
  obstacles: ObstacleState[];

  // Winner
  winnerId: string;
  winReason: string;

  // Game over
  gameOverData: GameOverPayload | null;

  // Actions
  sendReady: () => void;
  sendShot: (angle: number, power: number) => void;
  sendAim: (angle: number, power: number) => void;
  sendRematch: () => void;
  sendRematchAccept: () => void;
  leaveRoom: () => Promise<void>;
  joinRoom: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useMiniGolfDuels({
  firestoreGameId,
  autoJoin = true,
  spectator = false,
  inviteId,
}: UseMiniGolfDuelsOptions): UseMiniGolfDuelsReturn {
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
    gameType: "minigolf_duels",
    firestoreGameId,
    autoJoin,
    options: { firestoreGameId, spectator, inviteId },
  });

  // ---------------------------------------------------------------------------
  // Local state derived from room messages + schema
  // ---------------------------------------------------------------------------
  const [myUid, setMyUid] = useState("");
  const [isSpectator, setIsSpectator] = useState(spectator);
  const [gameOverData, setGameOverData] = useState<GameOverPayload | null>(
    null,
  );

  // Derived state from schema — refreshed on every state change
  const [players, setPlayers] = useState<MiniGolfPlayerInfo[]>([]);
  const [balls, setBalls] = useState<Record<string, BallState>>({});
  const [obstacles, setObstacles] = useState<ObstacleState[]>([]);
  const [strokesHoleByUid, setStrokesHoleByUid] = useState<
    Record<string, number>
  >({});
  const [strokesTotalByUid, setStrokesTotalByUid] = useState<
    Record<string, number>
  >({});
  const [holedByUid, setHoledByUid] = useState<Record<string, number>>({});

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

    // Set uid from room sessionId immediately (server sets it in welcome too)
    const sessionId = room.sessionId;

    room.onMessage(
      "welcome",
      (payload: { uid: string; spectator?: boolean }) => {
        if (!mountedRef.current) return;
        setMyUid(payload.uid);
        if (payload.spectator) setIsSpectator(true);
      },
    );

    room.onMessage("game_over", (payload: GameOverPayload) => {
      if (!mountedRef.current) return;
      setGameOverData(payload);
    });

    return () => {};
  }, [room]);

  // ---------------------------------------------------------------------------
  // State snapshot — read live schema on every state change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!room) return;

    const snapshot = () => {
      const s = room.state as any;
      if (!s) return;

      // Players
      const pl: MiniGolfPlayerInfo[] = [];
      if (s.players && typeof s.players.forEach === "function") {
        s.players.forEach((p: any) => {
          pl.push({
            uid: p.uid ?? "",
            sessionId: p.sessionId ?? "",
            displayName: p.displayName ?? "",
            avatarUrl: p.avatarUrl ?? "",
            connected: p.connected ?? false,
            ready: p.ready ?? false,
            playerIndex: p.playerIndex ?? 0,
          });
        });
      }
      setPlayers(pl);

      // Balls
      const b: Record<string, BallState> = {};
      if (s.balls && typeof s.balls.forEach === "function") {
        s.balls.forEach((ball: any, key: string) => {
          b[key] = {
            uid: ball.uid ?? key,
            x: ball.x ?? 0,
            y: ball.y ?? 0,
            vx: ball.vx ?? 0,
            vy: ball.vy ?? 0,
            radius: ball.radius ?? 8,
          };
        });
      }
      setBalls(b);

      // Obstacles
      const obs: ObstacleState[] = [];
      if (s.obstacles) {
        const arr = Array.isArray(s.obstacles)
          ? s.obstacles
          : typeof s.obstacles.forEach === "function"
            ? (() => {
                const tmp: any[] = [];
                s.obstacles.forEach((o: any) => tmp.push(o));
                return tmp;
              })()
            : [];
        for (const o of arr) {
          obs.push({
            id: o.id ?? "",
            obstacleType: o.obstacleType ?? "",
            x: o.x ?? 0,
            y: o.y ?? 0,
            angle: o.angle ?? 0,
          });
        }
      }
      setObstacles(obs);

      // Strokes (MapSchema<number>)
      const readMap = (m: any): Record<string, number> => {
        const out: Record<string, number> = {};
        if (m && typeof m.forEach === "function") {
          m.forEach((v: number, k: string) => {
            out[k] = v;
          });
        }
        return out;
      };
      setStrokesHoleByUid(readMap(s.strokesHoleByUid));
      setStrokesTotalByUid(readMap(s.strokesTotalByUid));
      setHoledByUid(readMap(s.holedByUid));
    };

    snapshot(); // initial
    const handler = () => snapshot();
    room.onStateChange(handler);
    return () => {
      room.onStateChange.remove(handler);
    };
  }, [room]);

  // ---------------------------------------------------------------------------
  // Scalar state from schema
  // ---------------------------------------------------------------------------
  const phase = state?.phase ?? "waiting";
  const countdown = state?.countdown ?? 0;
  const subPhase = state?.subPhase ?? "aiming";
  const packId = state?.packId ?? "default";
  const holeId = state?.holeId ?? "";
  const holeIndex = state?.holeIndex ?? 0;
  const holesTotal = state?.holesTotal ?? 9;
  const par = state?.par ?? 3;
  const currentTurnUid = state?.currentTurnUid ?? "";
  const winnerId = state?.winnerId ?? "";
  const winReason = state?.winReason ?? "";

  // Derived
  const myPlayer = players.find((p) => p.uid === myUid) ?? null;
  const opponentPlayer = players.find((p) => p.uid !== myUid) ?? null;
  const isMyTurn = !isSpectator && currentTurnUid === myUid;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const sendReady = useCallback(() => sendMessage("ready"), [sendMessage]);

  const sendShot = useCallback(
    (angle: number, power: number) => {
      if (isSpectator) return;
      sendMessage("input", { action: "shot", angle, power });
    },
    [sendMessage, isSpectator],
  );

  const sendAim = useCallback(
    (angle: number, power: number) => {
      if (isSpectator) return;
      sendMessage("input", { action: "aim", angle, power });
    },
    [sendMessage, isSpectator],
  );

  const sendRematch = useCallback(() => {
    sendMessage("rematch");
    // Record rematch for Achievements V2 social counter
    const uid = getAuth().currentUser?.uid;
    if (uid) recordRematchCompleted(uid).catch(() => {});
  }, [sendMessage]);

  const sendRematchAccept = useCallback(() => {
    sendMessage("rematch_accept");
    // Record rematch for Achievements V2 social counter
    const uid = getAuth().currentUser?.uid;
    if (uid) recordRematchCompleted(uid).catch(() => {});
  }, [sendMessage]);

  return {
    connected,
    reconnecting,
    error,
    latency,

    phase,
    countdown,
    subPhase,

    packId,
    holeId,
    holeIndex,
    holesTotal,
    par,

    currentTurnUid,
    myUid,
    isMyTurn,
    isSpectator,

    players,
    myPlayer,
    opponentPlayer,

    strokesHoleByUid,
    strokesTotalByUid,
    holedByUid,

    balls,
    obstacles,

    winnerId,
    winReason,
    gameOverData,

    sendReady,
    sendShot,
    sendAim,
    sendRematch,
    sendRematchAccept,
    leaveRoom,
    joinRoom,
  };
}
