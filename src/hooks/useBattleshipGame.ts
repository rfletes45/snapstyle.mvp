/**
 * useBattleshipGame — Client hook for Battleship multiplayer
 *
 * Wraps useColyseus for Battleship-specific state: grids, placements,
 * shot history, turn tracking, and private board messages.
 *
 * Fog-of-war: the opponent's ship placements are NEVER exposed to this
 * client. Own placements arrive via targeted "your_board" messages.
 * Sunk ship outlines appear in shared state only after sinking.
 *
 * @see colyseus-server/src/rooms/turnbased/BattleshipRoom.ts
 * @see colyseus-server/src/schemas/battleship.ts
 */

import type { Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { useColyseus, type UseColyseusOptions } from "./useColyseus";
import { useColyseusAppState } from "./useColyseusAppState";

import { createLogger } from "@/utils/log";
const bsLogger = createLogger("hooks/useBattleshipGame");

// =============================================================================
// Types
// =============================================================================

export type BattleshipPhase =
  | "idle"
  | "connecting"
  | "waiting"
  | "placement"
  | "combat"
  | "finished"
  | "reconnecting"
  | "error";

export interface ShipPlacementClient {
  shipId: string;
  shipName: string;
  size: number;
  startRow: number;
  startCol: number;
  orientation: "horizontal" | "vertical";
  cells: Array<{ row: number; col: number }>;
  hitsRemaining: number;
}

export interface ShotRecordClient {
  row: number;
  col: number;
  shooterUid: string;
  targetUid: string;
  result: "miss" | "hit" | "sunk";
  shipId: string;
  shipName: string;
  turnNumber: number;
}

export interface SunkShipClient {
  shipId: string;
  shipName: string;
  size: number;
  ownerUid: string;
  cells: Array<{ row: number; col: number }>;
}

export interface BattleshipPlayerInfo {
  uid: string;
  sessionId: string;
  displayName: string;
  playerIndex: number;
  connected: boolean;
  placementReady: boolean;
  shipCellsRemaining: number;
  shipsRemaining: number;
  shotsFired: number;
  hits: number;
  misses: number;
}

export interface UseBattleshipGameReturn {
  // ── Availability ────────────────────────────────────────────────────
  isMultiplayer: boolean;
  phase: BattleshipPhase;

  // ── Players ─────────────────────────────────────────────────────────
  myUid: string;
  myPlayer: BattleshipPlayerInfo | null;
  opponentPlayer: BattleshipPlayerInfo | null;

  // ── Board (own placements — fog-of-war) ─────────────────────────────
  myPlacements: ShipPlacementClient[];

  // ── Combat state ────────────────────────────────────────────────────
  currentTurnUid: string;
  isMyTurn: boolean;
  turnNumber: number;
  shotHistory: ShotRecordClient[];
  sunkShips: SunkShipClient[];

  // ── Last action (animation trigger) ─────────────────────────────────
  lastActionType: string;
  lastActionRow: number;
  lastActionCol: number;
  lastActionShipName: string;

  // ── Timers ──────────────────────────────────────────────────────────
  placementTimeRemaining: number;
  turnTimeRemaining: number;

  // ── End state ───────────────────────────────────────────────────────
  winnerId: string;
  winReason: string;
  isWinner: boolean | null;

  // ── Revealed boards (post-game only) ────────────────────────────────
  revealedBoards: Record<string, ShipPlacementClient[]> | null;

  // ── Connection ──────────────────────────────────────────────────────
  connected: boolean;
  reconnecting: boolean;
  opponentDisconnected: boolean;
  error: string | null;
  room: Room | null;

  // ── Spectator ───────────────────────────────────────────────────────
  isSpectator: boolean;
  spectatorCount: number;

  // ── Actions ─────────────────────────────────────────────────────────
  placeShip: (
    shipId: string,
    startRow: number,
    startCol: number,
    orientation: "horizontal" | "vertical",
  ) => void;
  removeShip: (shipId: string) => void;
  randomize: () => void;
  lockIn: () => void;
  fire: (row: number, col: number) => void;
  surrender: () => void;
  leave: () => Promise<void>;
  startMultiplayer: (opts?: {
    firestoreGameId?: string;
    spectator?: boolean;
    inviteId?: string;
  }) => void;
  cancelMultiplayer: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useBattleshipGame(): UseBattleshipGameReturn {
  const gameType = "battleship_game"; // clientKey from colyseus mapping

  // ── Colyseus connection ────────────────────────────────────────────────
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [activeFirestoreGameId, setActiveFirestoreGameId] = useState<
    string | undefined
  >();
  const [activeSpectator, setActiveSpectator] = useState(false);
  const [activeInviteId, setActiveInviteId] = useState<string | undefined>();

  const colyseusOptions: UseColyseusOptions = {
    gameType,
    autoJoin: false,
    firestoreGameId: activeFirestoreGameId,
    inviteId: activeInviteId,
    // Pass inviteId through to the server so the room can use it in
    // onDispose for direct invite finalization (defense-in-depth).
    options: {
      ...(activeSpectator ? { spectator: true } : {}),
      ...(activeInviteId ? { inviteId: activeInviteId } : {}),
    },
  };

  const {
    room,
    state,
    connected,
    reconnecting,
    error,
    sendMessage,
    joinRoom,
    leaveRoom,
  } = useColyseus(colyseusOptions);

  useColyseusAppState(room);

  // ── Game state ─────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<BattleshipPhase>("idle");
  const [myUid, setMyUid] = useState("");
  const [myPlacements, setMyPlacements] = useState<ShipPlacementClient[]>([]);
  const [revealedBoards, setRevealedBoards] = useState<Record<
    string,
    ShipPlacementClient[]
  > | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [isWinner, setIsWinner] = useState<boolean | null>(null);

  // Derived from synced state
  const [currentTurnUid, setCurrentTurnUid] = useState("");
  const [turnNumber, setTurnNumber] = useState(0);
  const [winnerId, setWinnerId] = useState("");
  const [winReason, setWinReason] = useState("");
  const [placementTimeRemaining, setPlacementTimeRemaining] = useState(90000);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(25000);
  const [lastActionType, setLastActionType] = useState("");
  const [lastActionRow, setLastActionRow] = useState(0);
  const [lastActionCol, setLastActionCol] = useState(0);
  const [lastActionShipName, setLastActionShipName] = useState("");
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [players, setPlayers] = useState<BattleshipPlayerInfo[]>([]);
  const [shotHistory, setShotHistory] = useState<ShotRecordClient[]>([]);
  const [sunkShips, setSunkShips] = useState<SunkShipClient[]>([]);

  const myUidRef = useRef("");
  const joinTriggeredRef = useRef(false);

  // ── Message handlers ───────────────────────────────────────────────────
  useEffect(() => {
    if (!room) return;

    const handleYourBoard = (data: any) => {
      if (data?.placements) {
        setMyPlacements(data.placements);
      }
    };

    const handleBoardsRevealed = (data: any) => {
      if (data?.boards) {
        setRevealedBoards(data.boards);
      }
    };

    const handleGameOver = (data: any) => {
      setWinnerId(data.winnerId || "");
      setWinReason(data.winReason || "");
      setPhase("finished");
      setIsWinner(data.winnerId === myUidRef.current);
    };

    const handleCombatStarted = (_data: any) => {
      setPhase("combat");
    };

    const handleOpponentReconnecting = (_data: any) => {
      setOpponentDisconnected(true);
    };

    const handleOpponentReconnected = (_data: any) => {
      setOpponentDisconnected(false);
    };

    const handleError = (data: any) => {
      // Server-sent error messages (not fatal)
      // Could show as toast — for now just log
    };

    room.onMessage("your_board", handleYourBoard);
    room.onMessage("boards_revealed", handleBoardsRevealed);
    room.onMessage("game_over", handleGameOver);
    room.onMessage("combat_started", handleCombatStarted);
    room.onMessage("opponent_reconnecting", handleOpponentReconnecting);
    room.onMessage("opponent_reconnected", handleOpponentReconnected);
    room.onMessage("error", handleError);

    // No cleanup needed — Colyseus SDK handles listener removal on leave
  }, [room]);

  // ── State sync ─────────────────────────────────────────────────────────
  // Canonical pattern: use room.sessionId to identify self (same as
  // useTurnBasedGame) and .forEach() for Colyseus MapSchema iteration.
  useEffect(() => {
    if (!state || !isMultiplayer) return;

    // Reliable session ID directly from Colyseus Room object — no
    // dependency on "welcome" message timing.
    const mySessionId = room?.sessionId ?? "";

    // Phase
    const serverPhase = state.phase as string;
    if (serverPhase === "waiting") setPhase("waiting");
    else if (serverPhase === "placement") setPhase("placement");
    else if (serverPhase === "combat") setPhase("combat");
    else if (serverPhase === "finished") setPhase("finished");

    // Turn state
    setCurrentTurnUid(state.currentTurnUid || "");
    setTurnNumber(state.turnNumber || 0);

    // Winner
    if (state.winnerId) {
      setWinnerId(state.winnerId);
      setWinReason(state.winReason || "");
      setIsWinner(state.winnerId === myUidRef.current);
    }

    // Timers
    setPlacementTimeRemaining(state.placementTimeRemaining ?? 90000);
    setTurnTimeRemaining(state.turnTimeRemaining ?? 25000);

    // Last action
    setLastActionType(state.lastActionType || "");
    setLastActionRow(state.lastActionRow ?? 0);
    setLastActionCol(state.lastActionCol ?? 0);
    setLastActionShipName(state.lastActionShipName || "");

    // Spectator count
    setSpectatorCount(state.spectatorCount ?? 0);

    // Players — use canonical .forEach() for Colyseus MapSchema
    if (state.players && typeof state.players.forEach === "function") {
      const playerList: BattleshipPlayerInfo[] = [];

      state.players.forEach((player: any, sessionId: string) => {
        playerList.push({
          uid: player.uid || "",
          sessionId: String(sessionId),
          displayName: player.displayName || "Player",
          playerIndex: player.playerIndex ?? 0,
          connected: player.connected ?? true,
          placementReady: player.placementReady ?? false,
          shipCellsRemaining: player.shipCellsRemaining ?? 17,
          shipsRemaining: player.shipsRemaining ?? 5,
          shotsFired: player.shotsFired ?? 0,
          hits: player.hits ?? 0,
          misses: player.misses ?? 0,
        });

        // Identify self by sessionId (canonical: room.sessionId)
        if (String(sessionId) === mySessionId) {
          myUidRef.current = player.uid || "";
          setMyUid(player.uid || "");
        }
      });
      setPlayers(playerList);

      // Check opponent disconnected
      const opponent = playerList.find((p) => p.sessionId !== mySessionId);
      if (opponent && !opponent.connected && serverPhase !== "finished") {
        setOpponentDisconnected(true);
      } else if (opponent?.connected) {
        setOpponentDisconnected(false);
      }
    }

    // Shot history
    if (state.shotHistory) {
      const shots: ShotRecordClient[] = [];
      const shotArr = Array.isArray(state.shotHistory)
        ? state.shotHistory
        : state.shotHistory.toArray
          ? state.shotHistory.toArray()
          : [];
      for (const s of shotArr) {
        shots.push({
          row: s.row ?? 0,
          col: s.col ?? 0,
          shooterUid: s.shooterUid || "",
          targetUid: s.targetUid || "",
          result: (s.result as "miss" | "hit" | "sunk") || "miss",
          shipId: s.shipId || "",
          shipName: s.shipName || "",
          turnNumber: s.turnNumber ?? 0,
        });
      }
      setShotHistory(shots);
    }

    // Sunk ships
    if (state.sunkShips) {
      const sunk: SunkShipClient[] = [];
      const sunkArr = Array.isArray(state.sunkShips)
        ? state.sunkShips
        : state.sunkShips.toArray
          ? state.sunkShips.toArray()
          : [];
      for (const s of sunkArr) {
        const cells: Array<{ row: number; col: number }> = [];
        const cellArr = s.cells
          ? Array.isArray(s.cells)
            ? s.cells
            : s.cells.toArray
              ? s.cells.toArray()
              : []
          : [];
        for (const c of cellArr) {
          cells.push({ row: c.row ?? 0, col: c.col ?? 0 });
        }
        sunk.push({
          shipId: s.shipId || "",
          shipName: s.shipName || "",
          size: s.size ?? 0,
          ownerUid: s.ownerUid || "",
          cells,
        });
      }
      setSunkShips(sunk);
    }
  }, [state, isMultiplayer, room]);

  // ── Derived ────────────────────────────────────────────────────────────
  const mySessionId = room?.sessionId ?? "";
  const myPlayer = players.find((p) => p.sessionId === mySessionId) ?? null;
  const opponentPlayer =
    players.find((p) => p.sessionId !== mySessionId && p.sessionId !== "") ??
    null;
  const isMyTurn = currentTurnUid === myUid;

  // ── Actions ────────────────────────────────────────────────────────────
  const placeShip = useCallback(
    (
      shipId: string,
      startRow: number,
      startCol: number,
      orientation: "horizontal" | "vertical",
    ) => {
      sendMessage("place_ship", { shipId, startRow, startCol, orientation });
    },
    [sendMessage],
  );

  const removeShip = useCallback(
    (shipId: string) => {
      sendMessage("remove_ship", { shipId });
    },
    [sendMessage],
  );

  const randomize = useCallback(() => {
    sendMessage("randomize", {});
  }, [sendMessage]);

  const lockIn = useCallback(() => {
    sendMessage("lock_in", {});
  }, [sendMessage]);

  const fire = useCallback(
    (row: number, col: number) => {
      sendMessage("fire", { row, col });
    },
    [sendMessage],
  );

  const surrender = useCallback(() => {
    sendMessage("surrender", {});
  }, [sendMessage]);

  const leave = useCallback(async () => {
    await leaveRoom();
    setIsMultiplayer(false);
    setPhase("idle");
    setMyPlacements([]);
    setRevealedBoards(null);
    setShotHistory([]);
    setSunkShips([]);
    setPlayers([]);
    joinTriggeredRef.current = false;
    didJoinRef.current = false;
  }, [leaveRoom]);

  const startMultiplayer = useCallback(
    (opts?: {
      firestoreGameId?: string;
      spectator?: boolean;
      inviteId?: string;
    }) => {
      if (joinTriggeredRef.current) {
        bsLogger.warn(
          `[startMultiplayer] BLOCKED — already triggered (gameId=${opts?.firestoreGameId})`,
        );
        return;
      }
      joinTriggeredRef.current = true;

      bsLogger.info(
        `[startMultiplayer] gameId=${opts?.firestoreGameId}, spectator=${opts?.spectator ?? false}, inviteId=${opts?.inviteId ?? "none"}`,
      );

      setIsMultiplayer(true);
      setPhase("connecting");
      setActiveFirestoreGameId(opts?.firestoreGameId);
      setActiveSpectator(opts?.spectator ?? false);
      setActiveInviteId(opts?.inviteId);
    },
    [],
  );

  // ── Join trigger ───────────────────────────────────────────────────────
  // Fires joinRoom exactly once when the multiplayer session params are set.
  // Uses a ref to hold the latest joinRoom so the effect has ZERO unstable
  // deps — preventing the tight re-render → retry loop identified in M0.
  const joinRoomRef = useRef(joinRoom);
  joinRoomRef.current = joinRoom;
  const didJoinRef = useRef(false);

  useEffect(() => {
    if (
      isMultiplayer &&
      activeFirestoreGameId &&
      !room &&
      !didJoinRef.current
    ) {
      didJoinRef.current = true;
      bsLogger.info(
        `[joinEffect] → calling joinRoom (gameId=${activeFirestoreGameId})`,
      );
      joinRoomRef.current();
    }
  }, [isMultiplayer, activeFirestoreGameId, room]);

  // ── Terminal error → phase=error ───────────────────────────────────────
  useEffect(() => {
    if (error && isMultiplayer && !room) {
      bsLogger.warn(`[errorEffect] Join error surfaced: ${error}`);
      setPhase("error");
    }
  }, [error, isMultiplayer, room]);

  const cancelMultiplayer = useCallback(async () => {
    await leave();
  }, [leave]);

  return {
    isMultiplayer,
    phase,
    myUid,
    myPlayer,
    opponentPlayer,
    myPlacements,
    currentTurnUid,
    isMyTurn,
    turnNumber,
    shotHistory,
    sunkShips,
    lastActionType,
    lastActionRow,
    lastActionCol,
    lastActionShipName,
    placementTimeRemaining,
    turnTimeRemaining,
    winnerId,
    winReason,
    isWinner,
    revealedBoards,
    connected,
    reconnecting,
    opponentDisconnected,
    error,
    room,
    isSpectator: activeSpectator,
    spectatorCount,
    placeShip,
    removeShip,
    randomize,
    lockIn,
    fire,
    surrender,
    leave,
    startMultiplayer,
    cancelMultiplayer,
  };
}
