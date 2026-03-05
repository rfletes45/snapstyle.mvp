/**
 * Games V4 — Backend Adapter System
 *
 * Self-contained adapter framework for the Cloud Functions environment.
 * Contains:
 * - Adapter interface (mirrors client types)
 * - Registry (register/query)
 * - Game runner (validate, apply, outcome)
 * - Pilot adapters (tic_tac_toe, connect_four, play_2048)
 *
 * @module gamesV4/adapters
 */

import type { GameId } from "./types";

// =============================================================================
// Types (mirrors client src/gamesV4/types/adapter.ts)
// =============================================================================

export interface MoveValidationResult {
  ok: boolean;
  error?: string;
  nextPublicState?: Record<string, unknown>;
  nextPrivateState?: Record<string, Record<string, unknown>>;
  scoreDelta?: Array<{ uid: string; delta: number }>;
  turnAdvance?: boolean;
  nextTurnPlayerId?: string;
  terminal?: {
    type: "win" | "draw" | "timeout";
    winnerIds?: string[];
    reason?: string;
  };
}

export interface GameOutcome {
  winnerIds: string[];
  finalScoreboard: Array<{
    uid: string;
    score: number;
    placement: number;
    stats: Record<string, unknown>;
  }>;
}

export interface GameAdapterV4 {
  gameId: GameId;
  runtimeType: "solo" | "turnBased" | "realtime";
  maxPlayers: number;
  minPlayers: number;

  defaultSettings: Record<string, unknown>;

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, unknown>;

  createInitialPrivateState?(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, Record<string, unknown>>;

  validateMove?(
    publicState: Record<string, unknown>,
    privateStateByPlayer: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult;

  computeOutcome?(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome;

  extractPerformanceMetrics?(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string }>,
  ): Record<string, unknown>;

  validateSettings?(patch: Record<string, unknown>): Record<string, unknown>;
}

// =============================================================================
// Firestore Nested-Array Serialization
// =============================================================================
// Firestore rejects nested arrays (e.g. a 2D board: [[0,1],[2,3]]).
// These helpers convert top-level 2D arrays ↔ Firestore-safe maps so
// game logic can keep using normal 2D arrays while storage works.
//
//   serialize:   board: [[0,1],[2,3]]  →  board: { _nestedArray:true, length:2, "0":[0,1], "1":[2,3] }
//   deserialize: inverse
// Both are idempotent — safe to call on already-(de)serialized data.

export function serializeStateForFirestore(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
      // Nested array → Firestore-safe map
      const map: Record<string, unknown> = {
        _nestedArray: true,
        length: value.length,
      };
      for (let i = 0; i < value.length; i++) {
        map[String(i)] = value[i];
      }
      result[key] = map;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function deserializeStateFromFirestore(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>)._nestedArray === true
    ) {
      const map = value as Record<string, unknown>;
      const length = map.length as number;
      const arr: unknown[] = [];
      for (let i = 0; i < length; i++) {
        arr.push(map[String(i)]);
      }
      result[key] = arr;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// =============================================================================
// Registry
// =============================================================================

const adapters = new Map<GameId, GameAdapterV4>();

export function registerAdapter(adapter: GameAdapterV4): void {
  if (adapters.has(adapter.gameId)) {
    throw new Error(
      `[gamesV4] Adapter already registered for "${adapter.gameId}".`,
    );
  }
  adapters.set(adapter.gameId, adapter);
}

export function getAdapter(gameId: GameId): GameAdapterV4 | null {
  return adapters.get(gameId) ?? null;
}

export function requireAdapter(gameId: GameId): GameAdapterV4 {
  const adapter = adapters.get(gameId);
  if (!adapter) {
    throw new Error(`[gamesV4] No adapter registered for "${gameId}".`);
  }
  return adapter;
}

export function hasAdapter(gameId: GameId): boolean {
  return adapters.has(gameId);
}

// =============================================================================
// Game Runner
// =============================================================================

export interface RunMoveInput {
  gameId: GameId;
  publicState: Record<string, unknown>;
  privateStateByPlayer: Record<string, Record<string, unknown>>;
  movePayload: Record<string, unknown>;
  uid: string;
  turnOrder: string[];
  currentTurnIndex: number;
  settings: Record<string, unknown>;
}

export interface RunMoveResult {
  valid: boolean;
  error?: string;
  nextPublicState: Record<string, unknown>;
  nextPrivateState: Record<string, Record<string, unknown>>;
  scoreDelta: Array<{ uid: string; delta: number }>;
  turnAdvance: boolean;
  nextTurnPlayerId?: string;
  terminal: MoveValidationResult["terminal"];
}

export function createInitialState(
  gameId: GameId,
  players: Array<{ uid: string; slotIndex: number }>,
  settings: Record<string, unknown>,
): {
  publicState: Record<string, unknown>;
  privateStateByPlayer: Record<string, Record<string, unknown>>;
} {
  const adapter = requireAdapter(gameId);
  const rawPublicState = adapter.createInitialPublicState(players, settings);
  const publicState = serializeStateForFirestore(rawPublicState);
  const privateStateByPlayer = adapter.createInitialPrivateState
    ? adapter.createInitialPrivateState(players, settings)
    : {};
  return { publicState, privateStateByPlayer };
}

export function runMove(input: RunMoveInput): RunMoveResult {
  const adapter = requireAdapter(input.gameId);

  // Deserialize Firestore-safe maps back to 2D arrays for adapter logic
  const deserialized = deserializeStateFromFirestore(input.publicState);

  if (!adapter.validateMove) {
    return {
      valid: true,
      nextPublicState: input.publicState,
      nextPrivateState: input.privateStateByPlayer,
      scoreDelta: [],
      turnAdvance: true,
      terminal: undefined,
    };
  }

  const result = adapter.validateMove(
    deserialized,
    input.privateStateByPlayer,
    input.movePayload,
    {
      uid: input.uid,
      turnOrder: input.turnOrder,
      currentTurnIndex: input.currentTurnIndex,
      settings: input.settings,
    },
  );

  // Serialize adapter output back to Firestore-safe format
  const nextPublicState = result.nextPublicState
    ? serializeStateForFirestore(result.nextPublicState)
    : input.publicState;

  return {
    valid: result.ok,
    error: result.error,
    nextPublicState,
    nextPrivateState: result.nextPrivateState ?? input.privateStateByPlayer,
    scoreDelta: result.scoreDelta ?? [],
    turnAdvance: result.turnAdvance ?? true,
    nextTurnPlayerId: result.nextTurnPlayerId,
    terminal: result.terminal,
  };
}

export function computeOutcome(
  gameId: GameId,
  publicState: Record<string, unknown>,
  players: Array<{ uid: string; slotIndex: number }>,
  fallbackWinnerIds: string[] = [],
): GameOutcome {
  const adapter = requireAdapter(gameId);
  // Deserialize in case publicState was read from Firestore
  const deserialized = deserializeStateFromFirestore(publicState);
  if (adapter.computeOutcome) {
    return adapter.computeOutcome(deserialized, players);
  }
  return {
    winnerIds: fallbackWinnerIds,
    finalScoreboard: players.map((p, i) => ({
      uid: p.uid,
      score: fallbackWinnerIds.includes(p.uid) ? 1 : 0,
      placement: fallbackWinnerIds.includes(p.uid) ? 1 : i + 1,
      stats: {},
    })),
  };
}

export function extractPerformanceMetrics(
  gameId: GameId,
  publicState: Record<string, unknown>,
  players: Array<{ uid: string }>,
): Record<string, unknown> {
  const adapter = requireAdapter(gameId);
  // Deserialize in case publicState was read from Firestore
  const deserialized = deserializeStateFromFirestore(publicState);
  if (adapter.extractPerformanceMetrics) {
    return adapter.extractPerformanceMetrics(deserialized, players);
  }
  return {};
}

// =============================================================================
// ── Tic-Tac-Toe Adapter ──────────────────────────────────────────────────────
// =============================================================================

type TTTCell = "X" | "O" | null;
type TTTBoard = TTTCell[][];

interface TicTacToeState {
  board: TTTBoard;
  scores: { X: number; O: number; draws: number };
  moveCount: number;
}

const TTT_SIZE = 3;

const TTT_LINES: Array<Array<[number, number]>> = [
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
];

function tttCheckWinner(board: TTTBoard): TTTCell {
  for (const line of TTT_LINES) {
    const [a, b, c] = line;
    const v = board[a[0]][a[1]];
    if (v && v === board[b[0]][b[1]] && v === board[c[0]][c[1]]) return v;
  }
  return null;
}

function tttIsFull(board: TTTBoard): boolean {
  return board.every((r) => r.every((c) => c !== null));
}

registerAdapter({
  gameId: "tic_tac_toe",
  runtimeType: "turnBased",
  maxPlayers: 2,
  minPlayers: 2,
  defaultSettings: {},

  createInitialPublicState(): Record<string, unknown> {
    return {
      board: Array.from({ length: TTT_SIZE }, () => Array(TTT_SIZE).fill(null)),
      scores: { X: 0, O: 0, draws: 0 },
      moveCount: 0,
    } as unknown as Record<string, unknown>;
  },

  validateMove(
    publicState: Record<string, unknown>,
    _priv: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx,
  ): MoveValidationResult {
    const state = publicState as unknown as TicTacToeState;
    const { row, col } = movePayload as { row: number; col: number };

    if (
      typeof row !== "number" ||
      typeof col !== "number" ||
      row < 0 ||
      row >= TTT_SIZE ||
      col < 0 ||
      col >= TTT_SIZE
    ) {
      return { ok: false, error: "Invalid cell." };
    }
    if (state.board[row][col] !== null) {
      return { ok: false, error: "Cell occupied." };
    }

    const newBoard: TTTBoard = state.board.map((r) => [...r]);
    const symbol: TTTCell = ctx.currentTurnIndex === 0 ? "X" : "O";
    newBoard[row][col] = symbol;

    const newState: TicTacToeState = {
      board: newBoard,
      scores: { ...state.scores },
      moveCount: state.moveCount + 1,
    };

    const winner = tttCheckWinner(newBoard);
    if (winner) {
      if (winner === "X") newState.scores.X += 1;
      else newState.scores.O += 1;
      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: { type: "win", winnerIds: [ctx.uid] },
      };
    }
    if (tttIsFull(newBoard)) {
      newState.scores.draws += 1;
      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: { type: "draw" },
      };
    }
    return {
      ok: true,
      nextPublicState: newState as unknown as Record<string, unknown>,
      turnAdvance: true,
    };
  },

  computeOutcome(publicState: Record<string, unknown>, players): GameOutcome {
    const state = publicState as unknown as TicTacToeState;
    const winner = tttCheckWinner(state.board);
    if (winner) {
      const winSlot = winner === "X" ? 0 : 1;
      const wId = players.find((p) => p.slotIndex === winSlot)?.uid ?? "";
      const lId = players.find((p) => p.slotIndex !== winSlot)?.uid ?? "";
      return {
        winnerIds: [wId],
        finalScoreboard: [
          { uid: wId, score: 1, placement: 1, stats: { symbol: winner } },
          { uid: lId, score: 0, placement: 2, stats: {} },
        ],
      };
    }
    return {
      winnerIds: [],
      finalScoreboard: players.map((p) => ({
        uid: p.uid,
        score: 0,
        placement: 1,
        stats: {},
      })),
    };
  },

  extractPerformanceMetrics(publicState): Record<string, unknown> {
    return { totalMoves: (publicState as unknown as TicTacToeState).moveCount };
  },
});

// =============================================================================
// ── Connect Four Adapter ─────────────────────────────────────────────────────
// =============================================================================

type C4Cell = 0 | 1 | 2;
type C4Board = C4Cell[][];

interface ConnectFourState {
  board: C4Board;
  moveCount: number;
  lastMove: { row: number; col: number } | null;
}

const C4_ROWS = 6;
const C4_COLS = 7;

function c4CheckWin(board: C4Board, player: C4Cell): boolean {
  for (let r = 0; r < C4_ROWS; r++)
    for (let c = 0; c <= C4_COLS - 4; c++)
      if (
        board[r][c] === player &&
        board[r][c + 1] === player &&
        board[r][c + 2] === player &&
        board[r][c + 3] === player
      )
        return true;
  for (let r = 0; r <= C4_ROWS - 4; r++)
    for (let c = 0; c < C4_COLS; c++)
      if (
        board[r][c] === player &&
        board[r + 1][c] === player &&
        board[r + 2][c] === player &&
        board[r + 3][c] === player
      )
        return true;
  for (let r = 0; r <= C4_ROWS - 4; r++)
    for (let c = 0; c <= C4_COLS - 4; c++)
      if (
        board[r][c] === player &&
        board[r + 1][c + 1] === player &&
        board[r + 2][c + 2] === player &&
        board[r + 3][c + 3] === player
      )
        return true;
  for (let r = 3; r < C4_ROWS; r++)
    for (let c = 0; c <= C4_COLS - 4; c++)
      if (
        board[r][c] === player &&
        board[r - 1][c + 1] === player &&
        board[r - 2][c + 2] === player &&
        board[r - 3][c + 3] === player
      )
        return true;
  return false;
}

function c4FindDropRow(board: C4Board, col: number): number {
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

registerAdapter({
  gameId: "connect_four",
  runtimeType: "turnBased",
  maxPlayers: 2,
  minPlayers: 2,
  defaultSettings: {},

  createInitialPublicState(): Record<string, unknown> {
    return {
      board: Array.from({ length: C4_ROWS }, () => Array(C4_COLS).fill(0)),
      moveCount: 0,
      lastMove: null,
    } as unknown as Record<string, unknown>;
  },

  validateMove(
    publicState: Record<string, unknown>,
    _priv: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx,
  ): MoveValidationResult {
    const state = publicState as unknown as ConnectFourState;
    const { col } = movePayload as { col: number };

    if (typeof col !== "number" || col < 0 || col >= C4_COLS) {
      return { ok: false, error: "Invalid column." };
    }
    const row = c4FindDropRow(state.board, col);
    if (row === -1) return { ok: false, error: "Column full." };

    const newBoard: C4Board = state.board.map((r) => [...r] as C4Cell[]);
    const piece = (ctx.currentTurnIndex + 1) as C4Cell;
    newBoard[row][col] = piece;

    const ns: ConnectFourState = {
      board: newBoard,
      moveCount: state.moveCount + 1,
      lastMove: { row, col },
    };

    if (c4CheckWin(newBoard, piece)) {
      return {
        ok: true,
        nextPublicState: ns as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: { type: "win", winnerIds: [ctx.uid] },
      };
    }
    if (newBoard[0].every((c) => c !== 0)) {
      return {
        ok: true,
        nextPublicState: ns as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: { type: "draw" },
      };
    }
    return {
      ok: true,
      nextPublicState: ns as unknown as Record<string, unknown>,
      turnAdvance: true,
    };
  },

  computeOutcome(publicState: Record<string, unknown>, players): GameOutcome {
    const state = publicState as unknown as ConnectFourState;
    for (const p of players) {
      const piece = (p.slotIndex + 1) as C4Cell;
      if (c4CheckWin(state.board, piece)) {
        const lId = players.find((op) => op.uid !== p.uid)?.uid ?? "";
        return {
          winnerIds: [p.uid],
          finalScoreboard: [
            { uid: p.uid, score: 1, placement: 1, stats: { piece } },
            { uid: lId, score: 0, placement: 2, stats: {} },
          ],
        };
      }
    }
    return {
      winnerIds: [],
      finalScoreboard: players.map((p) => ({
        uid: p.uid,
        score: 0,
        placement: 1,
        stats: {},
      })),
    };
  },

  extractPerformanceMetrics(publicState): Record<string, unknown> {
    return {
      totalMoves: (publicState as unknown as ConnectFourState).moveCount,
    };
  },
});

// =============================================================================
// ── 2048 (Solo) Adapter ──────────────────────────────────────────────────────
// =============================================================================

type S2048Board = number[][];

interface Play2048State {
  board: S2048Board;
  score: number;
  bestTile: number;
  moveCount: number;
  mergeCount: number;
  hasWon: boolean;
  gameOver: boolean;
}

const G2048 = 4;
const WIN_TILE = 2048;

function s2048SlideLeft(row: number[]): {
  row: number[];
  score: number;
  merges: number;
} {
  const comp = row.filter((v) => v !== 0);
  const res: number[] = [];
  let sc = 0,
    mg = 0,
    i = 0;
  while (i < comp.length) {
    if (i + 1 < comp.length && comp[i] === comp[i + 1]) {
      const m = comp[i] * 2;
      res.push(m);
      sc += m;
      mg++;
      i += 2;
    } else {
      res.push(comp[i]);
      i++;
    }
  }
  while (res.length < G2048) res.push(0);
  return { row: res, score: sc, merges: mg };
}

function s2048Exec(
  board: S2048Board,
  dir: string,
): { nb: S2048Board; sc: number; mg: number; moved: boolean } {
  const nb = board.map((r) => [...r]);
  let sc = 0,
    mg = 0;
  if (dir === "left") {
    for (let r = 0; r < G2048; r++) {
      const x = s2048SlideLeft(nb[r]);
      nb[r] = x.row;
      sc += x.score;
      mg += x.merges;
    }
  } else if (dir === "right") {
    for (let r = 0; r < G2048; r++) {
      const x = s2048SlideLeft([...nb[r]].reverse());
      nb[r] = x.row.reverse();
      sc += x.score;
      mg += x.merges;
    }
  } else if (dir === "up") {
    for (let c = 0; c < G2048; c++) {
      const col = nb.map((r) => r[c]);
      const x = s2048SlideLeft(col);
      for (let r = 0; r < G2048; r++) nb[r][c] = x.row[r];
      sc += x.score;
      mg += x.merges;
    }
  } else {
    for (let c = 0; c < G2048; c++) {
      const col = nb.map((r) => r[c]).reverse();
      const x = s2048SlideLeft(col);
      const rev = x.row.reverse();
      for (let r = 0; r < G2048; r++) nb[r][c] = rev[r];
      sc += x.score;
      mg += x.merges;
    }
  }
  let moved = false;
  outer: for (let r = 0; r < G2048; r++)
    for (let c = 0; c < G2048; c++)
      if (board[r][c] !== nb[r][c]) {
        moved = true;
        break outer;
      }
  return { nb, sc, mg, moved };
}

function s2048CanMove(b: S2048Board): boolean {
  for (let r = 0; r < G2048; r++)
    for (let c = 0; c < G2048; c++) {
      if (b[r][c] === 0) return true;
      if (c + 1 < G2048 && b[r][c] === b[r][c + 1]) return true;
      if (r + 1 < G2048 && b[r][c] === b[r + 1][c]) return true;
    }
  return false;
}

function s2048Best(b: S2048Board): number {
  let best = 0;
  for (const row of b) for (const v of row) if (v > best) best = v;
  return best;
}

function s2048PlaceTile(b: S2048Board, mc: number): S2048Board {
  const nb = b.map((r) => [...r]);
  const empty: Array<[number, number]> = [];
  for (let r = 0; r < G2048; r++)
    for (let c = 0; c < G2048; c++) if (nb[r][c] === 0) empty.push([r, c]);
  if (empty.length === 0) return nb;
  const [er, ec] = empty[mc % empty.length];
  nb[er][ec] = mc % 10 === 7 ? 4 : 2;
  return nb;
}

registerAdapter({
  gameId: "play_2048",
  runtimeType: "solo",
  maxPlayers: 1,
  minPlayers: 1,
  defaultSettings: {},

  createInitialPublicState(): Record<string, unknown> {
    let b = Array.from({ length: G2048 }, () => Array(G2048).fill(0));
    b = s2048PlaceTile(b, 0);
    b = s2048PlaceTile(b, 1);
    return {
      board: b,
      score: 0,
      bestTile: s2048Best(b),
      moveCount: 0,
      mergeCount: 0,
      hasWon: false,
      gameOver: false,
    } as unknown as Record<string, unknown>;
  },

  validateMove(
    publicState: Record<string, unknown>,
    _priv: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx,
  ): MoveValidationResult {
    const st = publicState as unknown as Play2048State;
    const { direction } = movePayload as { direction: string };

    if (!["up", "down", "left", "right"].includes(direction))
      return { ok: false, error: "Invalid direction." };
    if (st.gameOver) return { ok: false, error: "Game over." };

    const { nb, sc, mg, moved } = s2048Exec(st.board, direction);
    if (!moved) return { ok: false, error: "No effect." };

    const nb2 = s2048PlaceTile(nb, st.moveCount + 1);
    const best = s2048Best(nb2);
    const won = st.hasWon || best >= WIN_TILE;
    const over = !s2048CanMove(nb2);

    const ns: Play2048State = {
      board: nb2,
      score: st.score + sc,
      bestTile: best,
      moveCount: st.moveCount + 1,
      mergeCount: st.mergeCount + mg,
      hasWon: won,
      gameOver: over,
    };

    if (over) {
      return {
        ok: true,
        nextPublicState: ns as unknown as Record<string, unknown>,
        scoreDelta: [{ uid: ctx.uid, delta: sc }],
        turnAdvance: false,
        terminal: {
          type: won ? "win" : "timeout",
          winnerIds: won ? [ctx.uid] : [],
        },
      };
    }
    return {
      ok: true,
      nextPublicState: ns as unknown as Record<string, unknown>,
      scoreDelta: [{ uid: ctx.uid, delta: sc }],
      turnAdvance: false,
    };
  },

  computeOutcome(publicState: Record<string, unknown>, players): GameOutcome {
    const st = publicState as unknown as Play2048State;
    const uid = players[0]?.uid ?? "";
    return {
      winnerIds: st.hasWon ? [uid] : [],
      finalScoreboard: [
        {
          uid,
          score: st.score,
          placement: 1,
          stats: { bestTile: st.bestTile },
        },
      ],
    };
  },

  extractPerformanceMetrics(publicState): Record<string, unknown> {
    const st = publicState as unknown as Play2048State;
    return { score: st.score, bestTile: st.bestTile, moveCount: st.moveCount };
  },
});

// =============================================================================
// ♟  CHESS — Full turn-based adapter (2-player)
// =============================================================================

// ── Chess Types ──────────────────────────────────────────────────────

type ChessPiece =
  | "wP"
  | "wN"
  | "wB"
  | "wR"
  | "wQ"
  | "wK"
  | "bP"
  | "bN"
  | "bB"
  | "bR"
  | "bQ"
  | "bK";

type ChessSide = "w" | "b";
type ChessSquare = string; // e.g. "e4"
type ChessPromotionPiece = "q" | "r" | "b" | "n";

type ChessBoard = (ChessPiece | null)[][];

interface ChessCastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

interface ChessTerminalState {
  type: "win" | "draw";
  winnerUids?: string[];
  reason: string;
}

interface ChessLastMove {
  from: ChessSquare;
  to: ChessSquare;
  piece: ChessPiece;
  captured?: ChessPiece | null;
  promotion?: ChessPromotionPiece;
  san?: string;
}

interface ChessState {
  schemaVersion: 1;
  board: ChessBoard;
  sideToMove: ChessSide;
  castling: ChessCastlingRights;
  enPassant: ChessSquare | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  lastMove: ChessLastMove | null;
  pendingDrawOfferByUid: string | null;
  positionHash: string;
  repetitionCounts: Record<string, number>;
  plyCount: number;
  capturesByUid: Record<string, number>;
  checksByUid: Record<string, number>;
  castlesByUid: Record<string, number>;
  promotionsByUid: Record<string, number>;
  underPromotionsByUid: Record<string, number>;
  enPassantByUid: Record<string, number>;
  terminal: ChessTerminalState | null;
}

interface ChessMove {
  from: ChessSquare;
  to: ChessSquare;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  piece: ChessPiece;
  captured: ChessPiece | null;
  promotion?: ChessPromotionPiece;
  isCastle?: boolean;
  isEnPassant?: boolean;
}

// ── Chess Helpers ────────────────────────────────────────────────────

function chPieceColor(p: ChessPiece): ChessSide {
  return p[0] as ChessSide;
}
function chPieceType(p: ChessPiece): string {
  return p[1];
}
function chMakePiece(c: ChessSide, t: string): ChessPiece {
  return `${c}${t}` as ChessPiece;
}

function chSqToIdx(sq: ChessSquare): [number, number] {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1], 10);
  return [8 - rank, file];
}

function chIdxToSq(r: number, c: number): ChessSquare {
  return String.fromCharCode(97 + c) + (8 - r);
}

function chInBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function chCloneBoard(b: ChessBoard): ChessBoard {
  return b.map((r) => [...r]);
}

function chFindKing(b: ChessBoard, side: ChessSide): [number, number] | null {
  const k = chMakePiece(side, "K");
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) if (b[r][c] === k) return [r, c];
  return null;
}

function chIsValidSquare(s: unknown): boolean {
  if (typeof s !== "string" || s.length !== 2) return false;
  const f = s.charCodeAt(0),
    rk = s.charCodeAt(1);
  return f >= 97 && f <= 104 && rk >= 49 && rk <= 56;
}

function chIsValidPromotion(p: unknown): boolean {
  return p === undefined || p === "q" || p === "r" || p === "b" || p === "n";
}

// ── Attack Detection ─────────────────────────────────────────────────

const CH_KNIGHT_OFS: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const CH_DIAGS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const CH_STRAIGHTS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function chIsAttackedBy(
  b: ChessBoard,
  row: number,
  col: number,
  attacker: ChessSide,
): boolean {
  // Pawn
  const pawnDir = attacker === "w" ? 1 : -1;
  const pawn = chMakePiece(attacker, "P");
  for (const dc of [-1, 1]) {
    const pr = row + pawnDir,
      pc = col + dc;
    if (chInBounds(pr, pc) && b[pr][pc] === pawn) return true;
  }
  // Knight
  const knight = chMakePiece(attacker, "N");
  for (const [dr, dc] of CH_KNIGHT_OFS) {
    const nr = row + dr,
      nc = col + dc;
    if (chInBounds(nr, nc) && b[nr][nc] === knight) return true;
  }
  // King
  const king = chMakePiece(attacker, "K");
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const kr = row + dr,
        kc = col + dc;
      if (chInBounds(kr, kc) && b[kr][kc] === king) return true;
    }
  // Sliding
  const bishop = chMakePiece(attacker, "B");
  const rook = chMakePiece(attacker, "R");
  const queen = chMakePiece(attacker, "Q");
  for (const [dr, dc] of CH_DIAGS) {
    let r = row + dr,
      c = col + dc;
    while (chInBounds(r, c)) {
      const p = b[r][c];
      if (p !== null) {
        if (p === bishop || p === queen) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  for (const [dr, dc] of CH_STRAIGHTS) {
    let r = row + dr,
      c = col + dc;
    while (chInBounds(r, c)) {
      const p = b[r][c];
      if (p !== null) {
        if (p === rook || p === queen) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return false;
}

function chIsInCheck(b: ChessBoard, side: ChessSide): boolean {
  const kp = chFindKing(b, side);
  if (!kp) return false;
  return chIsAttackedBy(b, kp[0], kp[1], side === "w" ? "b" : "w");
}

// ── Move Generation ──────────────────────────────────────────────────

function chApplyMoveToBoard(b: ChessBoard, m: ChessMove): ChessBoard {
  const nb = chCloneBoard(b);
  nb[m.fromRow][m.fromCol] = null;
  if (m.isEnPassant) nb[m.fromRow][m.toCol] = null;
  if (m.promotion) {
    nb[m.toRow][m.toCol] = chMakePiece(
      chPieceColor(m.piece),
      m.promotion.toUpperCase(),
    );
  } else {
    nb[m.toRow][m.toCol] = m.piece;
  }
  if (m.isCastle) {
    const row = m.fromRow;
    if (m.toCol === 6) {
      nb[row][5] = nb[row][7];
      nb[row][7] = null;
    } else if (m.toCol === 2) {
      nb[row][3] = nb[row][0];
      nb[row][0] = null;
    }
  }
  return nb;
}

function chGenPseudoLegalMoves(
  b: ChessBoard,
  side: ChessSide,
  castling: ChessCastlingRights,
  ep: ChessSquare | null,
): ChessMove[] {
  const moves: ChessMove[] = [];
  const opp: ChessSide = side === "w" ? "b" : "w";

  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const piece = b[r][c];
      if (piece === null || chPieceColor(piece) !== side) continue;
      const type = chPieceType(piece);
      const from = chIdxToSq(r, c);

      if (type === "P") {
        const dir = side === "w" ? -1 : 1;
        const startRow = side === "w" ? 6 : 1;
        const promoRow = side === "w" ? 0 : 7;
        const r1 = r + dir;
        if (chInBounds(r1, c) && b[r1][c] === null) {
          if (r1 === promoRow) {
            for (const pr of ["q", "r", "b", "n"] as ChessPromotionPiece[])
              moves.push({
                from,
                to: chIdxToSq(r1, c),
                fromRow: r,
                fromCol: c,
                toRow: r1,
                toCol: c,
                piece,
                captured: null,
                promotion: pr,
              });
          } else {
            moves.push({
              from,
              to: chIdxToSq(r1, c),
              fromRow: r,
              fromCol: c,
              toRow: r1,
              toCol: c,
              piece,
              captured: null,
            });
            const r2 = r + 2 * dir;
            if (r === startRow && chInBounds(r2, c) && b[r2][c] === null)
              moves.push({
                from,
                to: chIdxToSq(r2, c),
                fromRow: r,
                fromCol: c,
                toRow: r2,
                toCol: c,
                piece,
                captured: null,
              });
          }
        }
        for (const dc of [-1, 1]) {
          const nc = c + dc;
          if (!chInBounds(r1, nc)) continue;
          const tgt = b[r1][nc];
          if (tgt !== null && chPieceColor(tgt) === opp) {
            if (r1 === promoRow) {
              for (const pr of ["q", "r", "b", "n"] as ChessPromotionPiece[])
                moves.push({
                  from,
                  to: chIdxToSq(r1, nc),
                  fromRow: r,
                  fromCol: c,
                  toRow: r1,
                  toCol: nc,
                  piece,
                  captured: tgt,
                  promotion: pr,
                });
            } else {
              moves.push({
                from,
                to: chIdxToSq(r1, nc),
                fromRow: r,
                fromCol: c,
                toRow: r1,
                toCol: nc,
                piece,
                captured: tgt,
              });
            }
          }
          if (ep !== null) {
            const [epR, epC] = chSqToIdx(ep);
            if (r1 === epR && nc === epC)
              moves.push({
                from,
                to: ep,
                fromRow: r,
                fromCol: c,
                toRow: epR,
                toCol: epC,
                piece,
                captured: chMakePiece(opp, "P"),
                isEnPassant: true,
              });
          }
        }
      } else if (type === "N") {
        for (const [dr, dc] of CH_KNIGHT_OFS) {
          const nr = r + dr,
            nc = c + dc;
          if (!chInBounds(nr, nc)) continue;
          const tgt = b[nr][nc];
          if (tgt !== null && chPieceColor(tgt) === side) continue;
          moves.push({
            from,
            to: chIdxToSq(nr, nc),
            fromRow: r,
            fromCol: c,
            toRow: nr,
            toCol: nc,
            piece,
            captured: tgt,
          });
        }
      } else if (type === "B" || type === "R" || type === "Q") {
        const dirs =
          type === "B"
            ? CH_DIAGS
            : type === "R"
              ? CH_STRAIGHTS
              : [...CH_DIAGS, ...CH_STRAIGHTS];
        for (const [dr, dc] of dirs) {
          let nr = r + dr,
            nc = c + dc;
          while (chInBounds(nr, nc)) {
            const tgt = b[nr][nc];
            if (tgt !== null) {
              if (chPieceColor(tgt) === opp)
                moves.push({
                  from,
                  to: chIdxToSq(nr, nc),
                  fromRow: r,
                  fromCol: c,
                  toRow: nr,
                  toCol: nc,
                  piece,
                  captured: tgt,
                });
              break;
            }
            moves.push({
              from,
              to: chIdxToSq(nr, nc),
              fromRow: r,
              fromCol: c,
              toRow: nr,
              toCol: nc,
              piece,
              captured: null,
            });
            nr += dr;
            nc += dc;
          }
        }
      } else if (type === "K") {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr,
              nc = c + dc;
            if (!chInBounds(nr, nc)) continue;
            const tgt = b[nr][nc];
            if (tgt !== null && chPieceColor(tgt) === side) continue;
            moves.push({
              from,
              to: chIdxToSq(nr, nc),
              fromRow: r,
              fromCol: c,
              toRow: nr,
              toCol: nc,
              piece,
              captured: tgt,
            });
          }
        // Castling
        if (side === "w" && c === 4 && r === 7) {
          if (
            castling.wK &&
            b[7][5] === null &&
            b[7][6] === null &&
            b[7][7] === "wR"
          )
            moves.push({
              from,
              to: "g1",
              fromRow: 7,
              fromCol: 4,
              toRow: 7,
              toCol: 6,
              piece,
              captured: null,
              isCastle: true,
            });
          if (
            castling.wQ &&
            b[7][1] === null &&
            b[7][2] === null &&
            b[7][3] === null &&
            b[7][0] === "wR"
          )
            moves.push({
              from,
              to: "c1",
              fromRow: 7,
              fromCol: 4,
              toRow: 7,
              toCol: 2,
              piece,
              captured: null,
              isCastle: true,
            });
        } else if (side === "b" && c === 4 && r === 0) {
          if (
            castling.bK &&
            b[0][5] === null &&
            b[0][6] === null &&
            b[0][7] === "bR"
          )
            moves.push({
              from,
              to: "g8",
              fromRow: 0,
              fromCol: 4,
              toRow: 0,
              toCol: 6,
              piece,
              captured: null,
              isCastle: true,
            });
          if (
            castling.bQ &&
            b[0][1] === null &&
            b[0][2] === null &&
            b[0][3] === null &&
            b[0][0] === "bR"
          )
            moves.push({
              from,
              to: "c8",
              fromRow: 0,
              fromCol: 4,
              toRow: 0,
              toCol: 2,
              piece,
              captured: null,
              isCastle: true,
            });
        }
      }
    }
  return moves;
}

function chFilterLegal(
  b: ChessBoard,
  moves: ChessMove[],
  side: ChessSide,
): ChessMove[] {
  const opp: ChessSide = side === "w" ? "b" : "w";
  return moves.filter((m) => {
    if (m.isCastle) {
      if (chIsAttackedBy(b, m.fromRow, m.fromCol, opp)) return false;
      const throughCol = m.toCol === 6 ? 5 : 3;
      if (chIsAttackedBy(b, m.fromRow, throughCol, opp)) return false;
    }
    return !chIsInCheck(chApplyMoveToBoard(b, m), side);
  });
}

function chGenLegalMoves(
  b: ChessBoard,
  side: ChessSide,
  castling: ChessCastlingRights,
  ep: ChessSquare | null,
): ChessMove[] {
  return chFilterLegal(b, chGenPseudoLegalMoves(b, side, castling, ep), side);
}

function chFindLegalMove(
  b: ChessBoard,
  side: ChessSide,
  castling: ChessCastlingRights,
  ep: ChessSquare | null,
  from: ChessSquare,
  to: ChessSquare,
  promo?: ChessPromotionPiece,
): ChessMove | null {
  return (
    chGenLegalMoves(b, side, castling, ep).find(
      (m) =>
        m.from === from &&
        m.to === to &&
        (promo ? m.promotion === promo : !m.promotion),
    ) ?? null
  );
}

// ── Position Hash ────────────────────────────────────────────────────

function chPositionHash(
  b: ChessBoard,
  side: ChessSide,
  castling: ChessCastlingRights,
  ep: ChessSquare | null,
): string {
  const parts: string[] = [];
  for (let r = 0; r < 8; r++) {
    let s = "",
      empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p === null) {
        empty++;
      } else {
        if (empty > 0) {
          s += empty;
          empty = 0;
        }
        s += p;
      }
    }
    if (empty > 0) s += empty;
    parts.push(s);
  }
  parts.push(side);
  let cs = "";
  if (castling.wK) cs += "K";
  if (castling.wQ) cs += "Q";
  if (castling.bK) cs += "k";
  if (castling.bQ) cs += "q";
  parts.push(cs || "-");
  if (ep) {
    const [epR, epC] = chSqToIdx(ep);
    const pawnDir = side === "w" ? 1 : -1;
    const pawn = chMakePiece(side, "P");
    let relevant = false;
    for (const dc of [-1, 1]) {
      const pr = epR + pawnDir,
        pc = epC + dc;
      if (chInBounds(pr, pc) && b[pr][pc] === pawn) {
        relevant = true;
        break;
      }
    }
    parts.push(relevant ? ep : "-");
  } else {
    parts.push("-");
  }
  return parts.join("/");
}

// ── Terminal Detection ───────────────────────────────────────────────

function chIsInsufficient(b: ChessBoard): boolean {
  const nonKings: { piece: ChessPiece; row: number; col: number }[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p && chPieceType(p) !== "K")
        nonKings.push({ piece: p, row: r, col: c });
    }
  if (nonKings.length === 0) return true;
  if (nonKings.length === 1) {
    const t = chPieceType(nonKings[0].piece);
    if (t === "N" || t === "B") return true;
  }
  if (nonKings.length === 2) {
    const [a, b2] = nonKings;
    if (
      chPieceType(a.piece) === "B" &&
      chPieceType(b2.piece) === "B" &&
      chPieceColor(a.piece) !== chPieceColor(b2.piece)
    ) {
      if ((a.row + a.col) % 2 === (b2.row + b2.col) % 2) return true;
    }
  }
  return false;
}

// ── SAN Generation ───────────────────────────────────────────────────

function chUpdateCastling(
  castling: ChessCastlingRights,
  m: ChessMove,
): ChessCastlingRights {
  const nc = { ...castling };
  const t = chPieceType(m.piece),
    clr = chPieceColor(m.piece);
  if (t === "K") {
    if (clr === "w") {
      nc.wK = false;
      nc.wQ = false;
    } else {
      nc.bK = false;
      nc.bQ = false;
    }
  }
  if (t === "R") {
    if (clr === "w") {
      if (m.fromRow === 7 && m.fromCol === 7) nc.wK = false;
      if (m.fromRow === 7 && m.fromCol === 0) nc.wQ = false;
    } else {
      if (m.fromRow === 0 && m.fromCol === 7) nc.bK = false;
      if (m.fromRow === 0 && m.fromCol === 0) nc.bQ = false;
    }
  }
  if (m.captured) {
    if (m.toRow === 7 && m.toCol === 7) nc.wK = false;
    if (m.toRow === 7 && m.toCol === 0) nc.wQ = false;
    if (m.toRow === 0 && m.toCol === 7) nc.bK = false;
    if (m.toRow === 0 && m.toCol === 0) nc.bQ = false;
  }
  return nc;
}

function chComputeEP(m: ChessMove): ChessSquare | null {
  if (chPieceType(m.piece) === "P" && Math.abs(m.toRow - m.fromRow) === 2) {
    return chIdxToSq((m.fromRow + m.toRow) / 2, m.fromCol);
  }
  return null;
}

function chGenSAN(
  b: ChessBoard,
  m: ChessMove,
  side: ChessSide,
  castling: ChessCastlingRights,
  ep: ChessSquare | null,
): string {
  if (m.isCastle) {
    const nb = chApplyMoveToBoard(b, m);
    const opp: ChessSide = side === "w" ? "b" : "w";
    const inChk = chIsInCheck(nb, opp);
    const nc = chUpdateCastling(castling, m);
    const nep = chComputeEP(m);
    const isMate = inChk && chGenLegalMoves(nb, opp, nc, nep).length === 0;
    return (
      (m.toCol === 6 ? "O-O" : "O-O-O") + (isMate ? "#" : inChk ? "+" : "")
    );
  }
  const type = chPieceType(m.piece);
  let san = "";
  if (type === "P") {
    if (m.captured) san += m.from[0] + "x";
    san += m.to;
    if (m.promotion) san += "=" + m.promotion.toUpperCase();
  } else {
    san += type;
    const legal = chGenLegalMoves(b, side, castling, ep);
    const amb = legal.filter(
      (mv) =>
        chPieceType(mv.piece) === type && mv.to === m.to && mv.from !== m.from,
    );
    if (amb.length > 0) {
      if (!amb.some((a) => a.fromCol === m.fromCol)) san += m.from[0];
      else if (!amb.some((a) => a.fromRow === m.fromRow)) san += m.from[1];
      else san += m.from;
    }
    if (m.captured) san += "x";
    san += m.to;
  }
  const nb = chApplyMoveToBoard(b, m);
  const opp: ChessSide = side === "w" ? "b" : "w";
  const nc = chUpdateCastling(castling, m);
  const nep = chComputeEP(m);
  const oppChk = chIsInCheck(nb, opp);
  if (oppChk) {
    san += chGenLegalMoves(nb, opp, nc, nep).length === 0 ? "#" : "+";
  }
  return san;
}

// ── State Application ────────────────────────────────────────────────

function chCreateInitialBoard(): ChessBoard {
  const b: ChessBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
  b[0] = ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"];
  b[1] = Array(8).fill("bP");
  b[6] = Array(8).fill("wP");
  b[7] = ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"];
  return b;
}

function chCreateInitialState(): ChessState {
  const board = chCreateInitialBoard();
  const castling: ChessCastlingRights = {
    wK: true,
    wQ: true,
    bK: true,
    bQ: true,
  };
  const positionHash = chPositionHash(board, "w", castling, null);
  return {
    schemaVersion: 1,
    board,
    sideToMove: "w",
    castling,
    enPassant: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    lastMove: null,
    pendingDrawOfferByUid: null,
    positionHash,
    repetitionCounts: { [positionHash]: 1 },
    plyCount: 0,
    capturesByUid: {},
    checksByUid: {},
    castlesByUid: {},
    promotionsByUid: {},
    underPromotionsByUid: {},
    enPassantByUid: {},
    terminal: null,
  };
}

function chApplyMoveToState(
  state: ChessState,
  move: ChessMove,
  moverUid: string,
): ChessState {
  const newBoard = chApplyMoveToBoard(state.board, move);
  const opp: ChessSide = state.sideToMove === "w" ? "b" : "w";
  const san = chGenSAN(
    state.board,
    move,
    state.sideToMove,
    state.castling,
    state.enPassant,
  );
  const newCastling = chUpdateCastling(state.castling, move);
  const newEP = chComputeEP(move);
  const isPawn = chPieceType(move.piece) === "P";
  const isCapture = move.captured !== null;
  const newHalfmove = isPawn || isCapture ? 0 : state.halfmoveClock + 1;
  const newFullmove =
    state.sideToMove === "b" ? state.fullmoveNumber + 1 : state.fullmoveNumber;

  const lastMove: ChessLastMove = {
    from: move.from,
    to: move.to,
    piece: move.piece,
    captured: move.captured,
    promotion: move.promotion,
    san,
  };

  const capturesByUid = { ...state.capturesByUid };
  const checksByUid = { ...state.checksByUid };
  const castlesByUid = { ...state.castlesByUid };
  const promotionsByUid = { ...state.promotionsByUid };
  const underPromotionsByUid = { ...state.underPromotionsByUid };
  const enPassantByUid = { ...state.enPassantByUid };

  if (isCapture) capturesByUid[moverUid] = (capturesByUid[moverUid] ?? 0) + 1;
  if (move.isCastle) castlesByUid[moverUid] = (castlesByUid[moverUid] ?? 0) + 1;
  if (move.promotion) {
    promotionsByUid[moverUid] = (promotionsByUid[moverUid] ?? 0) + 1;
    if (move.promotion !== "q")
      underPromotionsByUid[moverUid] =
        (underPromotionsByUid[moverUid] ?? 0) + 1;
  }
  if (move.isEnPassant)
    enPassantByUid[moverUid] = (enPassantByUid[moverUid] ?? 0) + 1;

  const oppInCheck = chIsInCheck(newBoard, opp);
  if (oppInCheck) checksByUid[moverUid] = (checksByUid[moverUid] ?? 0) + 1;

  const positionHash = chPositionHash(newBoard, opp, newCastling, newEP);
  const repetitionCounts = { ...state.repetitionCounts };
  repetitionCounts[positionHash] = (repetitionCounts[positionHash] ?? 0) + 1;

  let terminal = state.terminal;
  const oppLegal = chGenLegalMoves(newBoard, opp, newCastling, newEP);
  if (oppLegal.length === 0) {
    terminal = oppInCheck
      ? { type: "win", winnerUids: [moverUid], reason: "checkmate" }
      : { type: "draw", reason: "stalemate" };
  }
  if (!terminal && chIsInsufficient(newBoard)) {
    terminal = { type: "draw", reason: "insufficient_material" };
  }

  return {
    schemaVersion: 1,
    board: newBoard,
    sideToMove: opp,
    castling: newCastling,
    enPassant: newEP,
    halfmoveClock: newHalfmove,
    fullmoveNumber: newFullmove,
    lastMove,
    pendingDrawOfferByUid: state.pendingDrawOfferByUid,
    positionHash,
    repetitionCounts,
    plyCount: state.plyCount + 1,
    capturesByUid,
    checksByUid,
    castlesByUid,
    promotionsByUid,
    underPromotionsByUid,
    enPassantByUid,
    terminal,
  };
}

function chHasLostPieces(b: ChessBoard, side: ChessSide): boolean {
  const init = chCreateInitialBoard();
  const count = (board: ChessBoard, s: ChessSide) => {
    let n = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p[0] === s && p[1] !== "K") n++;
      }
    return n;
  };
  return count(b, side) < count(init, side);
}

// ── Chess Adapter Registration ───────────────────────────────────────

registerAdapter({
  gameId: "chess",
  runtimeType: "turnBased",
  maxPlayers: 2,
  minPlayers: 2,
  defaultSettings: {},

  createInitialPublicState(): Record<string, unknown> {
    return chCreateInitialState() as unknown as Record<string, unknown>;
  },

  validateMove(
    publicState: Record<string, unknown>,
    _priv: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx,
  ): MoveValidationResult {
    const state = publicState as unknown as ChessState;
    const payload = movePayload as {
      action: string;
      from?: string;
      to?: string;
      promotion?: string;
      offerDraw?: boolean;
      claim?: string;
    };

    if (state.terminal) return { ok: false, error: "Game is already over." };

    const whiteUid = ctx.turnOrder[0];
    const moverUid = ctx.uid;
    const expectedSide: ChessSide = moverUid === whiteUid ? "w" : "b";

    if (state.sideToMove !== expectedSide)
      return { ok: false, error: "Not your turn." };

    // Accept draw
    if (payload.action === "acceptDraw") {
      if (!state.pendingDrawOfferByUid)
        return { ok: false, error: "No draw offer to accept." };
      if (state.pendingDrawOfferByUid === moverUid)
        return { ok: false, error: "Cannot accept your own draw offer." };
      const ns: ChessState = {
        ...state,
        terminal: { type: "draw", reason: "draw_agreed" },
        pendingDrawOfferByUid: null,
      };
      return {
        ok: true,
        nextPublicState: ns as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: { type: "draw", reason: "draw_agreed" },
      };
    }

    // Claim draw
    if (payload.action === "claimDraw") {
      if (payload.claim === "threefold") {
        const count = state.repetitionCounts[state.positionHash] ?? 0;
        if (count < 3)
          return {
            ok: false,
            error: `Threefold repetition not met: current position seen ${count} time(s).`,
          };
        const ns: ChessState = {
          ...state,
          terminal: { type: "draw", reason: "threefold_repetition" },
          pendingDrawOfferByUid: null,
        };
        return {
          ok: true,
          nextPublicState: ns as unknown as Record<string, unknown>,
          turnAdvance: false,
          terminal: { type: "draw", reason: "threefold_repetition" },
        };
      }
      if (payload.claim === "fiftyMove") {
        if (state.halfmoveClock < 100)
          return {
            ok: false,
            error: `50-move rule not met: halfmoveClock is ${state.halfmoveClock}.`,
          };
        const ns: ChessState = {
          ...state,
          terminal: { type: "draw", reason: "fifty_move_rule" },
          pendingDrawOfferByUid: null,
        };
        return {
          ok: true,
          nextPublicState: ns as unknown as Record<string, unknown>,
          turnAdvance: false,
          terminal: { type: "draw", reason: "fifty_move_rule" },
        };
      }
      return { ok: false, error: "Invalid draw claim." };
    }

    // Normal move
    if (payload.action !== "move")
      return { ok: false, error: "Invalid action." };
    if (!chIsValidSquare(payload.from) || !chIsValidSquare(payload.to))
      return { ok: false, error: "Invalid square coordinates." };
    if (!chIsValidPromotion(payload.promotion))
      return { ok: false, error: "Invalid promotion piece." };

    const [fromRow, fromCol] = chSqToIdx(payload.from!);
    const [toRow] = chSqToIdx(payload.to!);
    const movingPiece = state.board[fromRow][fromCol];
    if (movingPiece && movingPiece[1] === "P") {
      const promoRank = expectedSide === "w" ? 0 : 7;
      if (toRow === promoRank && !payload.promotion)
        return { ok: false, error: "Promotion piece required." };
      if (toRow !== promoRank && payload.promotion)
        return { ok: false, error: "Cannot promote on this rank." };
    }

    const legalMove = chFindLegalMove(
      state.board,
      state.sideToMove,
      state.castling,
      state.enPassant,
      payload.from!,
      payload.to!,
      payload.promotion as ChessPromotionPiece | undefined,
    );
    if (!legalMove) return { ok: false, error: "Illegal move." };

    let ns = chApplyMoveToState(state, legalMove, moverUid);
    ns =
      payload.offerDraw && !ns.terminal
        ? { ...ns, pendingDrawOfferByUid: moverUid }
        : { ...ns, pendingDrawOfferByUid: null };

    if (ns.terminal) {
      return {
        ok: true,
        nextPublicState: ns as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: {
          type: ns.terminal.type,
          winnerIds: ns.terminal.winnerUids,
          reason: ns.terminal.reason,
        },
      };
    }
    return {
      ok: true,
      nextPublicState: ns as unknown as Record<string, unknown>,
      turnAdvance: true,
    };
  },

  computeOutcome(publicState: Record<string, unknown>, players): GameOutcome {
    const state = publicState as unknown as ChessState;
    if (state.terminal?.type === "win" && state.terminal.winnerUids?.length) {
      const winnerId = state.terminal.winnerUids[0];
      const loserId = players.find((p) => p.uid !== winnerId)?.uid ?? "";
      return {
        winnerIds: [winnerId],
        finalScoreboard: [
          {
            uid: winnerId,
            score: 1,
            placement: 1,
            stats: {
              side: players[0].uid === winnerId ? "white" : "black",
              reason: state.terminal.reason,
              captures: state.capturesByUid[winnerId] ?? 0,
              checks: state.checksByUid[winnerId] ?? 0,
            },
          },
          {
            uid: loserId,
            score: 0,
            placement: 2,
            stats: {
              side: players[0].uid === loserId ? "white" : "black",
              reason: state.terminal.reason,
              captures: state.capturesByUid[loserId] ?? 0,
              checks: state.checksByUid[loserId] ?? 0,
            },
          },
        ],
      };
    }
    return {
      winnerIds: [],
      finalScoreboard: players.map((p) => ({
        uid: p.uid,
        score: 0,
        placement: 1,
        stats: {
          side: p.slotIndex === 0 ? "white" : "black",
          reason: state.terminal?.reason ?? "unknown",
          captures: state.capturesByUid[p.uid] ?? 0,
          checks: state.checksByUid[p.uid] ?? 0,
        },
      })),
    };
  },

  extractPerformanceMetrics(publicState, players): Record<string, unknown> {
    const state = publicState as unknown as ChessState;
    const metrics: Record<string, unknown> = {
      totalMoves: state.plyCount,
      endedBy: state.terminal?.reason ?? "unknown",
      capturesByUid: state.capturesByUid,
      promotionsByUid: state.promotionsByUid,
      enPassantByUid: state.enPassantByUid,
      castlesByUid: state.castlesByUid,
      checksByUid: state.checksByUid,
    };
    if (state.terminal?.reason === "checkmate")
      metrics.shortMatePly = state.plyCount;
    if (state.terminal?.type === "win" && state.terminal.winnerUids?.length) {
      const winnerId = state.terminal.winnerUids[0];
      const winnerSlot = (players ?? []).findIndex((p) => p.uid === winnerId);
      metrics.wonWithoutLosingPiece = !chHasLostPieces(
        state.board,
        winnerSlot === 0 ? "w" : "b",
      );
    }
    const hasUnderpromotion: Record<string, boolean> = {};
    for (const p of players ?? []) {
      hasUnderpromotion[p.uid] = (state.underPromotionsByUid[p.uid] ?? 0) > 0;
    }
    metrics.hasUnderpromotion = hasUnderpromotion;
    return metrics;
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sketch Party (realtime drawing + guessing game)
// ═══════════════════════════════════════════════════════════════════════════════

registerAdapter({
  gameId: "sketch_party_game",
  runtimeType: "realtime",
  maxPlayers: 8,
  minPlayers: 2,

  defaultSettings: {
    maxPlayers: 8,
    rounds: 3,
    drawTimeSec: 80,
    turnChooseTimeSec: 10,
    wordChoices: 3,
    hints: 2,
    customWordsEnabled: false,
  },

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
  ): Record<string, unknown> {
    const turnOrder = players.map((p) => p.uid).sort(() => Math.random() - 0.5);
    const scores: Record<string, number> = {};
    for (const p of players) scores[p.uid] = 0;
    return {
      currentRound: 1,
      totalRounds: 3,
      currentTurnIndex: 0,
      turnOrder,
      drawerId: turnOrder[0] ?? "",
      phase: "choosing",
      maskedWord: "",
      wordLength: 0,
      scores,
      correctGuessers: [],
      timeRemainingSec: 80,
      drawTimeSec: 80,
      hintsUsed: 0,
      maxHints: 2,
    };
  },

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const scores = (publicState as Record<string, unknown>).scores as
      | Record<string, number>
      | undefined;
    if (!scores) {
      return {
        winnerIds: [],
        finalScoreboard: players.map((p, i) => ({
          uid: p.uid,
          score: 0,
          placement: i + 1,
          stats: {},
        })),
      };
    }
    const sorted = players
      .map((p) => ({ uid: p.uid, score: scores[p.uid] ?? 0 }))
      .sort((a, b) => b.score - a.score);
    const topScore = sorted[0]?.score ?? 0;
    const winnerIds =
      topScore > 0
        ? sorted.filter((s) => s.score === topScore).map((s) => s.uid)
        : [];
    return {
      winnerIds,
      finalScoreboard: sorted.map((s, i) => ({
        uid: s.uid,
        score: s.score,
        placement: i + 1,
        stats: {},
      })),
    };
  },

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const scores = (publicState as Record<string, unknown>).scores as
      | Record<string, number>
      | undefined;
    return {
      scoresSnapshot: scores ?? {},
      playerCount: players.length,
    };
  },
});

// =============================================================================
// Battleship Adapter
// =============================================================================

type BsDirection = "H" | "V";
interface BsShipPlacement {
  shipId: string;
  size: number;
  startRow: number;
  startCol: number;
  direction: BsDirection;
  cells: string[];
}

interface BsShipDef {
  shipId: string;
  name: string;
  size: number;
}

type BsShotResult = "hit" | "miss" | "sunk";

interface BsShotRecord {
  result: BsShotResult;
  shipId?: string;
  turnNumber: number;
}

interface BsPlayerStats {
  hits: number;
  misses: number;
  accuracy: number;
  shipsRemaining: number;
  shipsSunk: number;
  turnsTaken: number;
}

interface BsPrivateState {
  placements: BsShipPlacement[];
  cellToShip: Record<string, string>;
  shipHealth: Record<string, number>;
  aliveShips: string[];
  committedAt: number;
}

const BS_FLEET_CLASSIC_5: BsShipDef[] = [
  { shipId: "carrier", name: "Carrier", size: 5 },
  { shipId: "battleship", name: "Battleship", size: 4 },
  { shipId: "cruiser", name: "Cruiser", size: 3 },
  { shipId: "submarine", name: "Submarine", size: 3 },
  { shipId: "destroyer", name: "Destroyer", size: 2 },
];

const BS_FLEET_COMPACT_4: BsShipDef[] = [
  { shipId: "battleship", name: "Battleship", size: 4 },
  { shipId: "cruiser", name: "Cruiser", size: 3 },
  { shipId: "submarine", name: "Submarine", size: 3 },
  { shipId: "destroyer", name: "Destroyer", size: 2 },
];

function bsGetFleet(preset: string): BsShipDef[] {
  return preset === "compact_4" ? BS_FLEET_COMPACT_4 : BS_FLEET_CLASSIC_5;
}

function bsCellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function bsComputeShipCells(
  startRow: number,
  startCol: number,
  size: number,
  dir: BsDirection,
): string[] {
  const cells: string[] = [];
  for (let i = 0; i < size; i++) {
    cells.push(
      dir === "H"
        ? bsCellKey(startRow, startCol + i)
        : bsCellKey(startRow + i, startCol),
    );
  }
  return cells;
}

function bsValidateFleetPlacement(
  placements: BsShipPlacement[],
  gridSize: number,
  fleetPreset: string,
  allowAdjacentShips: boolean,
): { valid: boolean; error?: string } {
  const fleet = bsGetFleet(fleetPreset);
  if (placements.length !== fleet.length) {
    return {
      valid: false,
      error: `Expected ${fleet.length} ships, got ${placements.length}`,
    };
  }

  const requiredIds = new Set(fleet.map((s) => s.shipId));
  const placedIds = new Set(placements.map((p) => p.shipId));
  for (const id of requiredIds) {
    if (!placedIds.has(id)) {
      return { valid: false, error: `Missing ship: ${id}` };
    }
  }

  const occupiedCells = new Set<string>();
  for (const p of placements) {
    const def = fleet.find((f) => f.shipId === p.shipId);
    if (!def || p.size !== def.size) {
      return { valid: false, error: `Invalid ship size for ${p.shipId}` };
    }

    const cells = bsComputeShipCells(
      p.startRow,
      p.startCol,
      p.size,
      p.direction,
    );
    for (const ck of cells) {
      const [r, c] = ck.split(",").map(Number);
      if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
        return { valid: false, error: `Ship ${p.shipId} goes out of bounds` };
      }
      if (occupiedCells.has(ck)) {
        return { valid: false, error: `Ships overlap at ${ck}` };
      }
      occupiedCells.add(ck);
    }
  }

  if (!allowAdjacentShips) {
    for (const p of placements) {
      const myCells = new Set(
        bsComputeShipCells(p.startRow, p.startCol, p.size, p.direction),
      );
      for (const other of placements) {
        if (other.shipId === p.shipId) continue;
        const otherCells = bsComputeShipCells(
          other.startRow,
          other.startCol,
          other.size,
          other.direction,
        );
        for (const ck of otherCells) {
          const [r, c] = ck.split(",").map(Number);
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              if (myCells.has(bsCellKey(r + dr, c + dc))) {
                return {
                  valid: false,
                  error: `Ships ${p.shipId} and ${other.shipId} are adjacent`,
                };
              }
            }
          }
        }
      }
    }
  }

  return { valid: true };
}

function bsEmptyStats(fleet: BsShipDef[]): BsPlayerStats {
  return {
    hits: 0,
    misses: 0,
    accuracy: 0,
    shipsRemaining: fleet.length,
    shipsSunk: 0,
    turnsTaken: 0,
  };
}

registerAdapter({
  gameId: "battleship",
  runtimeType: "turnBased",
  maxPlayers: 2,
  minPlayers: 2,
  defaultSettings: {
    gridSize: 10,
    fleetPreset: "classic_5",
    allowAdjacentShips: false,
    shotMode: "single",
    setupTimeLimitSec: 0,
    turnTimeLimitSec: 0,
    autoResolveOnTimeout: false,
    spectatorRevealPolicy: "after_game",
    confirmBeforeFire: true,
    haptics: true,
  },

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const gridSize = (settings.gridSize as number) ?? 10;
    const fleetPreset = (settings.fleetPreset as string) ?? "classic_5";
    const shotMode = (settings.shotMode as string) ?? "single";
    const allowAdjacentShips =
      (settings.allowAdjacentShips as boolean) ?? false;
    const fleet = bsGetFleet(fleetPreset);

    const readyByUid: Record<string, boolean> = {};
    const statsByUid: Record<string, BsPlayerStats> = {};
    for (const p of players) {
      readyByUid[p.uid] = false;
      statsByUid[p.uid] = bsEmptyStats(fleet);
    }

    return {
      phase: "setup",
      rules: { gridSize, fleetPreset, shotMode, allowAdjacentShips },
      setup: { readyByUid },
      turnNumber: 0,
      currentTurnUid: null,
      shotsByDefender: {},
      statsByUid,
      lastEvent: null,
      resolved: null,
      moveCount: 0,
    };
  },

  createInitialPrivateState(
    players: Array<{ uid: string; slotIndex: number }>,
    _settings: Record<string, unknown>,
  ): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};
    for (const p of players) {
      result[p.uid] = {
        placements: [],
        cellToShip: {},
        shipHealth: {},
        aliveShips: [],
        committedAt: 0,
      };
    }
    return result;
  },

  validateMove(
    publicState: Record<string, unknown>,
    privateStateByPlayer: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult {
    const state = publicState as Record<string, unknown>;
    const phase = state.phase as string;
    const action = movePayload.action as string;

    // ── Resign ──
    if (action === "resign") {
      const opponentUid = ctx.turnOrder.find((u) => u !== ctx.uid) ?? "";
      const nextState = {
        ...state,
        phase: "resolved",
        resolved: {
          winnerUid: opponentUid,
          reason: "resign",
          finalStatsByUid: state.statsByUid,
          reveal: null,
        },
      };
      return {
        ok: true,
        nextPublicState: nextState,
        terminal: { type: "win", winnerIds: [opponentUid], reason: "resign" },
      };
    }

    // ── Place Fleet (setup phase) ──
    if (action === "place_fleet") {
      if (phase !== "setup") {
        return {
          ok: false,
          error: "Fleet placement is only available during setup.",
        };
      }

      const placements = movePayload.placements as BsShipPlacement[];
      if (!Array.isArray(placements)) {
        return { ok: false, error: "Invalid placements." };
      }

      const gridSize =
        ((state.rules as Record<string, unknown>).gridSize as number) ?? 10;
      const fleetPreset =
        ((state.rules as Record<string, unknown>).fleetPreset as string) ??
        "classic_5";
      const allowAdjacentShips =
        ((state.rules as Record<string, unknown>)
          .allowAdjacentShips as boolean) ?? false;

      const validation = bsValidateFleetPlacement(
        placements,
        gridSize,
        fleetPreset,
        allowAdjacentShips,
      );
      if (!validation.valid) {
        return { ok: false, error: validation.error };
      }

      // Build private state for this player
      const fleet = bsGetFleet(fleetPreset);
      const cellToShip: Record<string, string> = {};
      const shipHealth: Record<string, number> = {};
      const aliveShips: string[] = [];

      for (const p of placements) {
        const cells = bsComputeShipCells(
          p.startRow,
          p.startCol,
          p.size,
          p.direction,
        );
        for (const ck of cells) {
          cellToShip[ck] = p.shipId;
        }
        shipHealth[p.shipId] = p.size;
        aliveShips.push(p.shipId);
      }

      const myPrivateState: Record<string, unknown> = {
        placements,
        cellToShip,
        shipHealth,
        aliveShips,
        committedAt: Date.now(),
      };

      // Update readyByUid
      const readyByUid = {
        ...((state.setup as Record<string, unknown>).readyByUid as Record<
          string,
          boolean
        >),
        [ctx.uid]: true,
      };

      // Check if all players ready → transition to battle
      const allReady = ctx.turnOrder.every((uid) => readyByUid[uid]);

      console.log(
        `[gamesV4][DEBUG][BS] place_fleet: uid=${ctx.uid}, allReady=${allReady}, readyByUid=${JSON.stringify(readyByUid)}, turnOrder=${JSON.stringify(ctx.turnOrder)}, currentTurnIndex=${ctx.currentTurnIndex}`,
      );

      let nextState: Record<string, unknown>;
      if (allReady) {
        // Pick starting player (deterministic from session order)
        const startIndex = 0;
        nextState = {
          ...state,
          phase: "battle",
          setup: { readyByUid },
          turnNumber: 1,
          currentTurnUid: ctx.turnOrder[startIndex],
          lastEvent: "Battle begins!",
          moveCount: (state.moveCount as number) + 1,
        };
      } else {
        nextState = {
          ...state,
          setup: { readyByUid },
          lastEvent: `Player deployed their fleet.`,
          moveCount: (state.moveCount as number) + 1,
        };
      }

      const nextPrivate: Record<string, Record<string, unknown>> = {};
      nextPrivate[ctx.uid] = myPrivateState;

      console.log(
        `[gamesV4][DEBUG][BS] place_fleet returning: phase=${nextState.phase}, currentTurnUid=${nextState.currentTurnUid}, moveCount=${nextState.moveCount}, turnAdvance=true`,
      );

      return {
        ok: true,
        nextPublicState: nextState,
        nextPrivateState: nextPrivate,
        // turnAdvance must be TRUE so the session pipeline advances
        // currentTurnPlayerId to the other player. During setup this
        // lets both players submit place_fleet in alternating turns.
        // When allReady, round-robin from player-index-1 wraps to 0,
        // which matches the adapter's currentTurnUid = turnOrder[0].
        turnAdvance: true,
      };
    }

    // ── Fire (battle phase) ──
    if (action === "fire") {
      if (phase !== "battle") {
        return { ok: false, error: "Not in battle phase." };
      }

      if (state.currentTurnUid !== ctx.uid) {
        return { ok: false, error: "Not your turn." };
      }

      const target = movePayload.target as { r: number; c: number };
      if (
        !target ||
        typeof target.r !== "number" ||
        typeof target.c !== "number"
      ) {
        return { ok: false, error: "Invalid target." };
      }

      const gridSize =
        ((state.rules as Record<string, unknown>).gridSize as number) ?? 10;
      if (
        target.r < 0 ||
        target.r >= gridSize ||
        target.c < 0 ||
        target.c >= gridSize
      ) {
        return { ok: false, error: "Target out of bounds." };
      }

      const opponentUid = ctx.turnOrder.find((u) => u !== ctx.uid) ?? "";
      const key = bsCellKey(target.r, target.c);

      // Check for duplicate shot
      const shotsOnOpponent =
        ((state.shotsByDefender as Record<string, Record<string, unknown>>)?.[
          opponentUid
        ] as Record<string, BsShotRecord>) ?? {};
      if (shotsOnOpponent[key]) {
        return { ok: false, error: "Already fired at this cell." };
      }

      // Resolve shot against opponent's private state
      const oppPrivate = (privateStateByPlayer[opponentUid] ?? {}) as Record<
        string,
        unknown
      >;
      const oppCellToShip =
        (oppPrivate.cellToShip as Record<string, string>) ?? {};
      const oppShipHealth = {
        ...((oppPrivate.shipHealth as Record<string, number>) ?? {}),
      };
      const oppAliveShips = [...((oppPrivate.aliveShips as string[]) ?? [])];

      const hitShipId = oppCellToShip[key] ?? null;
      let shotResult: BsShotResult;
      let sunkShipId: string | undefined;

      if (hitShipId) {
        oppShipHealth[hitShipId] = (oppShipHealth[hitShipId] ?? 1) - 1;
        if (oppShipHealth[hitShipId] <= 0) {
          shotResult = "sunk";
          sunkShipId = hitShipId;
          const idx = oppAliveShips.indexOf(hitShipId);
          if (idx !== -1) oppAliveShips.splice(idx, 1);
        } else {
          shotResult = "hit";
        }
      } else {
        shotResult = "miss";
      }

      // Build shot record
      const turnNumber = (state.turnNumber as number) ?? 1;
      const newShot: BsShotRecord = {
        result: shotResult,
        shipId: sunkShipId,
        turnNumber,
      };

      // Update shots
      const shotsByDefender = {
        ...(state.shotsByDefender as Record<string, Record<string, unknown>>),
      };
      shotsByDefender[opponentUid] = { ...shotsOnOpponent, [key]: newShot };

      // Update attacker stats
      const statsByUid = {
        ...(state.statsByUid as Record<string, BsPlayerStats>),
      };
      const myOldStats =
        statsByUid[ctx.uid] ?? bsEmptyStats(bsGetFleet("classic_5"));
      const newHits = myOldStats.hits + (shotResult !== "miss" ? 1 : 0);
      const newMisses = myOldStats.misses + (shotResult === "miss" ? 1 : 0);
      const total = newHits + newMisses;
      statsByUid[ctx.uid] = {
        hits: newHits,
        misses: newMisses,
        accuracy: total > 0 ? Math.round((newHits / total) * 100) : 0,
        shipsRemaining: myOldStats.shipsRemaining,
        shipsSunk: myOldStats.shipsSunk + (shotResult === "sunk" ? 1 : 0),
        turnsTaken: myOldStats.turnsTaken + 1,
      };

      // Update defender shipsRemaining
      const oppOldStats =
        statsByUid[opponentUid] ?? bsEmptyStats(bsGetFleet("classic_5"));
      statsByUid[opponentUid] = {
        ...oppOldStats,
        shipsRemaining: oppAliveShips.length,
      };

      // Build event
      let event = `Shot at ${String.fromCharCode(65 + target.c)}${target.r + 1}: `;
      if (shotResult === "sunk") {
        event += `HIT & SUNK ${sunkShipId}!`;
      } else if (shotResult === "hit") {
        event += "HIT!";
      } else {
        event += "MISS";
      }

      // Check for win
      const allSunk = oppAliveShips.length === 0;

      // Update opponent private state
      const nextPrivate: Record<string, Record<string, unknown>> = {};
      nextPrivate[opponentUid] = {
        ...oppPrivate,
        shipHealth: oppShipHealth,
        aliveShips: oppAliveShips,
      };

      if (allSunk) {
        // Game over — attacker wins
        const fleet = bsGetFleet(
          ((state.rules as Record<string, unknown>).fleetPreset as string) ??
            "classic_5",
        );

        // Build reveal (opponent placements only)
        const oppPlacements =
          (oppPrivate.placements as BsShipPlacement[]) ?? [];
        const myPrivate = (privateStateByPlayer[ctx.uid] ?? {}) as Record<
          string,
          unknown
        >;
        const myPlacements = (myPrivate.placements as BsShipPlacement[]) ?? [];
        const reveal = {
          placementsByUid: {
            [ctx.uid]: myPlacements,
            [opponentUid]: oppPlacements,
          },
        };

        const nextState = {
          ...state,
          phase: "resolved",
          shotsByDefender,
          statsByUid,
          lastEvent: `${event} — ALL SHIPS SUNK! Victory!`,
          resolved: {
            winnerUid: ctx.uid,
            reason: "all_sunk",
            finalStatsByUid: statsByUid,
            reveal,
          },
          moveCount: (state.moveCount as number) + 1,
        };

        return {
          ok: true,
          nextPublicState: nextState,
          nextPrivateState: nextPrivate,
          terminal: { type: "win", winnerIds: [ctx.uid], reason: "all_sunk" },
        };
      }

      // Advance turn
      const nextTurnUid = opponentUid;

      const nextState: Record<string, unknown> = {
        ...state,
        turnNumber: turnNumber + 1,
        currentTurnUid: nextTurnUid,
        shotsByDefender,
        statsByUid,
        lastEvent: event,
        moveCount: (state.moveCount as number) + 1,
      };

      return {
        ok: true,
        nextPublicState: nextState,
        nextPrivateState: nextPrivate,
        turnAdvance: true,
      };
    }

    // ── Salvo Fire (battle phase) ──
    if (action === "salvo_fire") {
      if (phase !== "battle") {
        return { ok: false, error: "Not in battle phase." };
      }
      if (state.currentTurnUid !== ctx.uid) {
        return { ok: false, error: "Not your turn." };
      }

      const targets = movePayload.targets as Array<{ r: number; c: number }>;
      if (!Array.isArray(targets) || targets.length === 0) {
        return { ok: false, error: "Invalid targets." };
      }

      const gridSize =
        ((state.rules as Record<string, unknown>).gridSize as number) ?? 10;
      const opponentUid = ctx.turnOrder.find((u) => u !== ctx.uid) ?? "";

      // Expected count = attacker's shipsRemaining
      const myOldStats =
        (state.statsByUid as Record<string, BsPlayerStats>)[ctx.uid] ??
        bsEmptyStats(bsGetFleet("classic_5"));
      if (targets.length !== myOldStats.shipsRemaining) {
        return {
          ok: false,
          error: `Salvo requires exactly ${myOldStats.shipsRemaining} targets.`,
        };
      }

      // Validate all targets
      const targetKeys = new Set<string>();
      const shotsOnOpponent =
        ((state.shotsByDefender as Record<string, Record<string, unknown>>)?.[
          opponentUid
        ] as Record<string, BsShotRecord>) ?? {};

      for (const t of targets) {
        if (t.r < 0 || t.r >= gridSize || t.c < 0 || t.c >= gridSize) {
          return { ok: false, error: `Target (${t.r},${t.c}) out of bounds.` };
        }
        const k = bsCellKey(t.r, t.c);
        if (targetKeys.has(k)) {
          return { ok: false, error: `Duplicate target: ${k}` };
        }
        if (shotsOnOpponent[k]) {
          return { ok: false, error: `Already fired at ${k}.` };
        }
        targetKeys.add(k);
      }

      // Resolve all shots
      const oppPrivate = (privateStateByPlayer[opponentUid] ?? {}) as Record<
        string,
        unknown
      >;
      const oppCellToShip =
        (oppPrivate.cellToShip as Record<string, string>) ?? {};
      const oppShipHealth = {
        ...((oppPrivate.shipHealth as Record<string, number>) ?? {}),
      };
      const oppAliveShips = [...((oppPrivate.aliveShips as string[]) ?? [])];

      const turnNumber = (state.turnNumber as number) ?? 1;
      const shotsByDefender = {
        ...(state.shotsByDefender as Record<string, Record<string, unknown>>),
      };
      const updatedShots = { ...shotsOnOpponent };

      let newHits = myOldStats.hits;
      let newMisses = myOldStats.misses;
      let newSunk = myOldStats.shipsSunk;
      const events: string[] = [];

      for (const t of targets) {
        const k = bsCellKey(t.r, t.c);
        const hitShipId = oppCellToShip[k] ?? null;
        let shotResult: BsShotResult;
        let sunkShipId: string | undefined;

        if (hitShipId) {
          oppShipHealth[hitShipId] = (oppShipHealth[hitShipId] ?? 1) - 1;
          if (oppShipHealth[hitShipId] <= 0) {
            shotResult = "sunk";
            sunkShipId = hitShipId;
            const idx = oppAliveShips.indexOf(hitShipId);
            if (idx !== -1) oppAliveShips.splice(idx, 1);
            newSunk++;
          } else {
            shotResult = "hit";
          }
          newHits++;
        } else {
          shotResult = "miss";
          newMisses++;
        }

        updatedShots[k] = {
          result: shotResult,
          shipId: sunkShipId,
          turnNumber,
        };
        const label = `${String.fromCharCode(65 + t.c)}${t.r + 1}`;
        events.push(
          `${label}:${shotResult.toUpperCase()}${sunkShipId ? `(${sunkShipId})` : ""}`,
        );
      }

      shotsByDefender[opponentUid] = updatedShots;

      const total = newHits + newMisses;
      const statsByUid = {
        ...(state.statsByUid as Record<string, BsPlayerStats>),
      };
      statsByUid[ctx.uid] = {
        hits: newHits,
        misses: newMisses,
        accuracy: total > 0 ? Math.round((newHits / total) * 100) : 0,
        shipsRemaining: myOldStats.shipsRemaining,
        shipsSunk: newSunk,
        turnsTaken: myOldStats.turnsTaken + 1,
      };

      const oppOldStats =
        statsByUid[opponentUid] ?? bsEmptyStats(bsGetFleet("classic_5"));
      statsByUid[opponentUid] = {
        ...oppOldStats,
        shipsRemaining: oppAliveShips.length,
      };

      const event = `Salvo: ${events.join(", ")}`;
      const allSunk = oppAliveShips.length === 0;

      const nextPrivate: Record<string, Record<string, unknown>> = {};
      nextPrivate[opponentUid] = {
        ...oppPrivate,
        shipHealth: oppShipHealth,
        aliveShips: oppAliveShips,
      };

      if (allSunk) {
        const oppPlacements =
          (oppPrivate.placements as BsShipPlacement[]) ?? [];
        const myPrivate = (privateStateByPlayer[ctx.uid] ?? {}) as Record<
          string,
          unknown
        >;
        const myPlacements = (myPrivate.placements as BsShipPlacement[]) ?? [];
        const reveal = {
          placementsByUid: {
            [ctx.uid]: myPlacements,
            [opponentUid]: oppPlacements,
          },
        };

        const nextState = {
          ...state,
          phase: "resolved",
          shotsByDefender,
          statsByUid,
          lastEvent: `${event} — ALL SHIPS SUNK! Victory!`,
          resolved: {
            winnerUid: ctx.uid,
            reason: "all_sunk",
            finalStatsByUid: statsByUid,
            reveal,
          },
          moveCount: (state.moveCount as number) + 1,
        };

        return {
          ok: true,
          nextPublicState: nextState,
          nextPrivateState: nextPrivate,
          terminal: { type: "win", winnerIds: [ctx.uid], reason: "all_sunk" },
        };
      }

      const nextState: Record<string, unknown> = {
        ...state,
        turnNumber: turnNumber + 1,
        currentTurnUid: opponentUid,
        shotsByDefender,
        statsByUid,
        lastEvent: event,
        moveCount: (state.moveCount as number) + 1,
      };

      return {
        ok: true,
        nextPublicState: nextState,
        nextPrivateState: nextPrivate,
        turnAdvance: true,
      };
    }

    return { ok: false, error: `Unknown action: ${action}` };
  },

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = publicState as Record<string, unknown>;
    const resolved = state.resolved as Record<string, unknown> | null;
    const winnerUid = resolved?.winnerUid as string | null;
    const statsByUid =
      (state.statsByUid as Record<string, BsPlayerStats>) ?? {};

    const sorted = players
      .map((p) => {
        const s = statsByUid[p.uid] ?? bsEmptyStats(bsGetFleet("classic_5"));
        const isWinner = p.uid === winnerUid;
        // Score: Winner gets 100 + shipsRemaining*10 + accuracy bonus - turns penalty
        // Loser gets shipsSunk*10 + accuracy bonus (lower weight)
        const score = isWinner
          ? 100 +
            s.shipsRemaining * 10 +
            Math.round((s.accuracy * 50) / 100) -
            s.turnsTaken
          : s.shipsSunk * 10 + Math.round((s.accuracy * 25) / 100);
        return {
          uid: p.uid,
          score: Math.max(0, score),
          stats: s as unknown as Record<string, unknown>,
        };
      })
      .sort((a, b) => b.score - a.score);

    return {
      winnerIds: winnerUid ? [winnerUid] : [],
      finalScoreboard: sorted.map((s, i) => ({
        uid: s.uid,
        score: s.score,
        placement: i + 1,
        stats: s.stats,
      })),
    };
  },

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as Record<string, unknown>;
    const statsByUid =
      (state.statsByUid as Record<string, BsPlayerStats>) ?? {};
    const turnNumber = (state.turnNumber as number) ?? 0;
    const phase = (state.phase as string) ?? "unknown";
    const rules = (state.rules as Record<string, unknown>) ?? {};

    return {
      phase,
      turnNumber,
      gridSize: rules.gridSize,
      fleetPreset: rules.fleetPreset,
      shotMode: rules.shotMode,
      statsByUid,
    };
  },

  validateSettings(patch: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    if (patch.gridSize !== undefined) {
      const g = Number(patch.gridSize);
      clean.gridSize = [8, 10, 12].includes(g) ? g : 10;
    }
    if (patch.fleetPreset !== undefined) {
      clean.fleetPreset = ["classic_5", "compact_4"].includes(
        patch.fleetPreset as string,
      )
        ? patch.fleetPreset
        : "classic_5";
    }
    if (patch.allowAdjacentShips !== undefined) {
      clean.allowAdjacentShips = Boolean(patch.allowAdjacentShips);
    }
    if (patch.shotMode !== undefined) {
      clean.shotMode = ["single", "salvo"].includes(patch.shotMode as string)
        ? patch.shotMode
        : "single";
    }
    if (patch.confirmBeforeFire !== undefined) {
      clean.confirmBeforeFire = Boolean(patch.confirmBeforeFire);
    }
    if (patch.haptics !== undefined) {
      clean.haptics = Boolean(patch.haptics);
    }
    return clean;
  },
});

// =============================================================================
// 🧱  BRICK BREAKER — Solo campaign adapter (server-side)
// =============================================================================

// ── Brick Breaker Constants ──────────────────────────────────────────

const BB_FIELD_W = 6.5;
const BB_FIELD_H = 11.0;
const BB_COLS = 13;
const BB_ROWS = 10;
const BB_BRICK_W = 0.5;
const BB_BRICK_H = 0.3;
const BB_GRID_TOP_Y = 10.0;
const BB_PADDLE_Y = 1.0;
const BB_PADDLE_HW = 0.5;
const BB_PADDLE_HH = 0.1;
const BB_BALL_RADIUS = 0.12;
const BB_BALL_SPEED = 5.0;
const BB_POWERUP_RADIUS = 0.13;
const BB_POWERUP_FALL_SPEED = -2.0;
const BB_DT = 1 / 60;
const BB_DEFAULT_LIVES = 3;
const BB_POWERUP_DURATION = 600;
const BB_LASER_INTERVAL = 20;
const BB_LASER_SHOTS = 10;
const BB_LASER_SPEED = 12;
const BB_MAX_BOUNCE_ANGLE = (65 * Math.PI) / 180;
const BB_MOVE_SPEED = 0.8;
const BB_MOVE_RANGE = 0.6;
const BB_MAX_LEVEL = 30;

// ── Brick Breaker Types ──────────────────────────────────────────────

interface BBBrickInfo {
  hp: number;
  breakable: boolean;
  score: number;
}
const BB_BRICKS: Record<string, BBBrickInfo> = {
  ".": { hp: -1, breakable: false, score: 0 },
  " ": { hp: -1, breakable: false, score: 0 },
  N: { hp: 1, breakable: true, score: 10 },
  H: { hp: 2, breakable: true, score: 25 },
  V: { hp: 3, breakable: true, score: 60 },
  S: { hp: 0, breakable: false, score: 0 },
  E: { hp: 1, breakable: true, score: 40 },
  P: { hp: 1, breakable: true, score: 20 },
  M: { hp: 1, breakable: true, score: 30 },
};

interface BBLevelDef {
  id: number;
  name: string;
  ballSpeed: number;
  paddle: number;
  powerRate: number;
  rows: string[];
}

interface BBInputSample {
  tick: number;
  x: number;
  a?: number;
}

type BBPowerup =
  | "expand"
  | "shrink"
  | "multiball"
  | "slow"
  | "fast"
  | "sticky"
  | "laser"
  | "shield"
  | "extraLife";

const BB_PU_POOL: BBPowerup[] = [
  "expand",
  "shrink",
  "multiball",
  "slow",
  "fast",
  "sticky",
  "laser",
  "shield",
  "extraLife",
];
const BB_PU_WEIGHTS: Record<BBPowerup, number> = {
  expand: 15,
  shrink: 10,
  multiball: 8,
  slow: 12,
  fast: 10,
  sticky: 5,
  laser: 5,
  shield: 8,
  extraLife: 3,
};

// ── Seeded RNG (Mulberry32) ──────────────────────────────────────────

function bbRng(seed: number) {
  let s = seed | 0;
  if (s === 0) s = 1;
  function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    nextInt: (a: number, b: number) => a + Math.floor(next() * (b - a + 1)),
  };
}

function bbWeightedPick(rng: ReturnType<typeof bbRng>): BBPowerup {
  const total = BB_PU_POOL.reduce((s, k) => s + BB_PU_WEIGHTS[k], 0);
  let roll = rng.next() * total;
  for (const item of BB_PU_POOL) {
    roll -= BB_PU_WEIGHTS[item];
    if (roll <= 0) return item;
  }
  return BB_PU_POOL[BB_PU_POOL.length - 1];
}

// ── Level Pack (30 levels) ───────────────────────────────────────────

const BB_LEVELS: BBLevelDef[] = [
  {
    id: 1,
    name: "Warm-Up",
    ballSpeed: 1,
    paddle: 1,
    powerRate: 0.16,
    rows: [
      "NNNNNNNNNNNNN",
      "NNNNNNNNNNNNN",
      ".....NNN.....",
      "....NNNNN....",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 2,
    name: "Staircase",
    ballSpeed: 1,
    paddle: 1,
    powerRate: 0.16,
    rows: [
      "N............",
      ".N...........",
      "..N..........",
      "...N.........",
      "....N........",
      ".....N.......",
      "......N......",
      ".......N.....",
      "........N....",
      ".........N...",
    ],
  },
  {
    id: 3,
    name: "Smile",
    ballSpeed: 1.02,
    paddle: 1,
    powerRate: 0.15,
    rows: [
      "..NN.....NN..",
      "..NN.....NN..",
      ".............",
      "N...N...N...N",
      "N...........N",
      "N..N.....N..N",
      "N...NNNNN...N",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 4,
    name: "Double Bars",
    ballSpeed: 1.03,
    paddle: 1,
    powerRate: 0.15,
    rows: [
      "NNNNNNNNNNNNN",
      ".............",
      "NNNNNNNNNNNNN",
      ".............",
      "NNNNNNNNNNNNN",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 5,
    name: "Pocket Gaps",
    ballSpeed: 1.05,
    paddle: 1,
    powerRate: 0.14,
    rows: [
      "NNN.NNN.NNN.N",
      "NNN.NNN.NNN.N",
      "NNN.NNN.NNN.N",
      ".............",
      "....NNNNN....",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 6,
    name: "First Armor",
    ballSpeed: 1.07,
    paddle: 0.98,
    powerRate: 0.14,
    rows: [
      "HHHHHHHHHHHHH",
      "NNNNNNNNNNNNN",
      ".............",
      "....NNNNN....",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 7,
    name: "Checker Lite",
    ballSpeed: 1.08,
    paddle: 0.98,
    powerRate: 0.14,
    rows: [
      "N.N.N.N.N.N.N",
      ".N.N.N.N.N.N.",
      "N.N.N.N.N.N.N",
      ".N.N.N.N.N.N.",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 8,
    name: "Diamond",
    ballSpeed: 1.1,
    paddle: 0.98,
    powerRate: 0.13,
    rows: [
      ".....N.N.....",
      "....NHHHN....",
      "...NHVVVHN...",
      "..NHVVVVVHN..",
      "...NHVVVHN...",
      "....NHHHN....",
      ".....N.N.....",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 9,
    name: "Thin Channel",
    ballSpeed: 1.12,
    paddle: 0.96,
    powerRate: 0.13,
    rows: [
      "SSSSS...SSSSS",
      "NNNNN...NNNNN",
      "HHHHH...HHHHH",
      "NNNNN...NNNNN",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 10,
    name: "Armor Rows",
    ballSpeed: 1.15,
    paddle: 0.96,
    powerRate: 0.13,
    rows: [
      "HHHHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      "NNNNNNNNNNNNN",
      "NNNNNNNNNNNNN",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 11,
    name: "Steel Posts",
    ballSpeed: 1.18,
    paddle: 0.95,
    powerRate: 0.12,
    rows: [
      "S...NNNNN...S",
      "S...NNNNN...S",
      "S...HHHHH...S",
      "S...NNNNN...S",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 12,
    name: "Power Lane",
    ballSpeed: 1.2,
    paddle: 0.95,
    powerRate: 0.12,
    rows: [
      "NNNNPPPPNNNNN",
      "NNNN....NNNNN",
      "HHHH....HHHHH",
      "NNNNPPPPNNNNN",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 13,
    name: "Heavy Core",
    ballSpeed: 1.22,
    paddle: 0.94,
    powerRate: 0.12,
    rows: [
      "NNNNNNNNNNNNN",
      "NNNHHHHHHHNNN",
      "NNHHVVVVVHHNN",
      "NNNHHHHHHHNNN",
      "NNNNNNNNNNNNN",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 14,
    name: "Split Walls",
    ballSpeed: 1.24,
    paddle: 0.94,
    powerRate: 0.11,
    rows: [
      "SSSSS...SSSSS",
      "NNNNN...NNNNN",
      "HHHHH...HHHHH",
      "NNNNN...NNNNN",
      "SSSSS...SSSSS",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 15,
    name: "Explosive Intro",
    ballSpeed: 1.26,
    paddle: 0.92,
    powerRate: 0.11,
    rows: [
      "NNNNEEEEENNNN",
      "NNNNNHHHNNNNN",
      "NNNN.....NNNN",
      "HHHH.....HHHH",
      "NNNNPPPPNNNNN",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 16,
    name: "Blast Pockets",
    ballSpeed: 1.3,
    paddle: 0.9,
    powerRate: 0.11,
    rows: [
      "S..E..NNN..ES",
      "..NNNHHHHHNN.",
      ".NN.HVVVH.NN.",
      "..NNNHHHHHNN.",
      "S..E..NNN..ES",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 17,
    name: "Steel Maze I",
    ballSpeed: 1.32,
    paddle: 0.9,
    powerRate: 0.1,
    rows: [
      "SSSSSSSSSSSSS",
      "SNNN...NNNNS.",
      ".HH...HHHS...",
      "SNNN...NNNNS.",
      "SSSS...SSSSS.",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 18,
    name: "Ring",
    ballSpeed: 1.34,
    paddle: 0.88,
    powerRate: 0.1,
    rows: [
      "..NNNNNNNNN..",
      ".NHHHHHHHHHN.",
      "NHH.......HHN",
      "NH..VVVVV..HN",
      "NH..VVVVV..HN",
      "NHH.......HHN",
      ".NHHHHHHHHHN.",
      "..NNNNNNNNN..",
      ".............",
      ".............",
    ],
  },
  {
    id: 19,
    name: "Heavy Rain",
    ballSpeed: 1.36,
    paddle: 0.88,
    powerRate: 0.1,
    rows: [
      "V.V.V.V.V.V.V",
      ".V.V.V.V.V.V.",
      "V.V.V.V.V.V.V",
      ".V.V.V.V.V.V.",
      "HHHHHHHHHHHHH",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 20,
    name: "Steel Maze II",
    ballSpeed: 1.4,
    paddle: 0.85,
    powerRate: 0.1,
    rows: [
      "SSSSSSSSSSSSS",
      "SNNN.SSS.NNNS",
      "SHHH.SSS.HHHS",
      "SNNN.SSS.NNNS",
      "SSSS.SSS.SSSS",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 21,
    name: "Moving Intro",
    ballSpeed: 1.44,
    paddle: 0.84,
    powerRate: 0.09,
    rows: [
      "MMMMM...MMMMM",
      "NNNNN...NNNNN",
      "HHHHH...HHHHH",
      "NNNNNPPPPNNNN",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 22,
    name: "Crossfire",
    ballSpeed: 1.46,
    paddle: 0.83,
    powerRate: 0.09,
    rows: [
      "..E...MMM...E",
      ".NNN.HHHHH.NN",
      "..E...MMM...E",
      ".....VVVVV...",
      "..P.........P",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 23,
    name: "Moving Rails",
    ballSpeed: 1.48,
    paddle: 0.82,
    powerRate: 0.09,
    rows: [
      "SSSSSMMMSSSMM",
      "NNNNN...NNNNN",
      "HHHHH...HHHHH",
      "NNNNN...NNNNN",
      "SSSSSMMMSSSMM",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 24,
    name: "Tight Diamond",
    ballSpeed: 1.5,
    paddle: 0.8,
    powerRate: 0.08,
    rows: [
      ".....H.H.....",
      "....HVVVH....",
      "...HVSSSVH...",
      "..HVSSSSSVH..",
      "...HVSSSVH...",
      "....HVVVH....",
      ".....H.H.....",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 25,
    name: "Explode & Move",
    ballSpeed: 1.52,
    paddle: 0.8,
    powerRate: 0.08,
    rows: [
      "MMEEMMEEEMMEE",
      "NNNNHHHHNNNNN",
      "....P...P....",
      "HHHHVVVVHHHHH",
      "NNNNHHHHNNNNN",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 26,
    name: "Boss Plate I",
    ballSpeed: 1.56,
    paddle: 0.78,
    powerRate: 0.08,
    rows: [
      "SSSSSSSSSSSSS",
      "S...VVVVV...S",
      "S..VVVVVVV..S",
      "S...VVVVV...S",
      "SSSSSSSSSSSSS",
      ".....P.P.....",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 27,
    name: "Boss Plate II",
    ballSpeed: 1.58,
    paddle: 0.77,
    powerRate: 0.07,
    rows: [
      "SSSSSSSSSSSSS",
      "S..VVVVVVV..S",
      "S.VVVSSSVVV.S",
      "S..VVVVVVV..S",
      "SSSSSSSSSSSSS",
      "....E...E....",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 28,
    name: "Steel Funnel",
    ballSpeed: 1.6,
    paddle: 0.76,
    powerRate: 0.07,
    rows: [
      "SSSSS...SSSSS",
      "SNNNN...NNNNS",
      "S.HHHH.HHHH.S",
      "S..VVVVVVV..S",
      "S...EEEEE...S",
      "SSSSS...SSSSS",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 29,
    name: "Chaos Grid",
    ballSpeed: 1.62,
    paddle: 0.75,
    powerRate: 0.07,
    rows: [
      "MNHVESPNMHVSP",
      "H.S.E.N.P.S.E",
      "VNMHSPVNMHSPV",
      "E..P..E..P..E",
      "SSSSSSSSSSSSS",
      ".............",
      ".............",
      ".............",
      ".............",
      ".............",
    ],
  },
  {
    id: 30,
    name: "The Last Wall",
    ballSpeed: 1.65,
    paddle: 0.75,
    powerRate: 0.06,
    rows: [
      "SSSSSSSSSSSSS",
      "SVVVVVVVVVVVS",
      "SVVMMMEEEMMVS",
      "SVVHHHPPPHHVS",
      "SVVNNNNNNNVVS",
      "SVVHHHPPPHHVS",
      "SVVMMMEEEMMVS",
      "SVVVVVVVVVVVS",
      "SSSSSSSSSSSSS",
      ".....P...P...",
    ],
  },
];

// ── Planck Replay (server-side) ──────────────────────────────────────

import * as planck from "planck";
const bbVec2 = planck.Vec2;

interface BBEntityUD {
  tag: string;
  id?: number;
  key?: string;
  col?: number;
  row?: number;
  brickType?: string;
  kind?: string;
}

interface BBSimState {
  world: planck.World;
  paddle: planck.Body;
  balls: Map<number, planck.Body>;
  bricks: Map<
    string,
    {
      body: planck.Body;
      hp: number;
      brickType: string;
      col: number;
      row: number;
      originX: number;
    }
  >;
  powerupBodies: Map<number, { body: planck.Body; kind: BBPowerup }>;
  shieldBody: planck.Body | null;
  laserBodies: Map<number, planck.Body>;
  rng: ReturnType<typeof bbRng>;
  baseBallSpeed: number;
  paddleHW: number;
  tick: number;
  serving: boolean;
  lives: number;
  score: number;
  combo: number;
  maxCombo: number;
  bricksDestroyed: number;
  breakableRemaining: number;
  powerupsUsed: number;
  explosionKills: number;
  laserKills: number;
  maxBallsAtOnce: number;
  missedThisLevel: boolean;
  levelCleared: boolean;
  runOver: boolean;
  activePowerups: Map<BBPowerup, number>;
  laserShotsRemaining: number;
  lastLaserTick: number;
  stickyBall: boolean;
  stickyOffset: number;
  nextBallId: number;
  nextPuId: number;
  nextLaserId: number;
  pendBrick: Array<{ key: string }>;
  pendBallLoss: number[];
  pendPuCollect: Array<{ id: number; byPaddle: boolean }>;
  pendLaser: Array<{ lid: number; bkey: string }>;
  pendShield: boolean;
  pendPaddle: number | null;
}

function bbClamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function bbCreateSim(
  levelDef: BBLevelDef,
  seed: number,
  lives: number,
  carry?: Partial<BBSimState>,
): BBSimState {
  const world = new planck.World(bbVec2(0, 0));
  const rng = bbRng(seed + levelDef.id * 997);
  const paddleHW = BB_PADDLE_HW * levelDef.paddle;
  const baseBallSpeed = BB_BALL_SPEED * levelDef.ballSpeed;

  // Walls
  const wb = world.createBody({ type: "static", position: bbVec2(0, 0) });
  wb.setUserData({ tag: "wall" });
  wb.createFixture({
    shape: new planck.Edge(bbVec2(0, 0), bbVec2(0, BB_FIELD_H)),
    friction: 0,
    restitution: 1,
  });
  wb.createFixture({
    shape: new planck.Edge(
      bbVec2(BB_FIELD_W, 0),
      bbVec2(BB_FIELD_W, BB_FIELD_H),
    ),
    friction: 0,
    restitution: 1,
  });
  wb.createFixture({
    shape: new planck.Edge(
      bbVec2(0, BB_FIELD_H),
      bbVec2(BB_FIELD_W, BB_FIELD_H),
    ),
    friction: 0,
    restitution: 1,
  });

  // Death zone
  const dz = world.createBody({
    type: "static",
    position: bbVec2(BB_FIELD_W / 2, -0.5),
  });
  dz.setUserData({ tag: "death" });
  dz.createFixture({ shape: new planck.Box(BB_FIELD_W, 0.3), isSensor: true });

  // Paddle
  const paddle = world.createBody({
    type: "kinematic",
    position: bbVec2(BB_FIELD_W / 2, BB_PADDLE_Y),
    fixedRotation: true,
  });
  paddle.setUserData({ tag: "paddle" });
  paddle.createFixture({
    shape: new planck.Box(paddleHW, BB_PADDLE_HH),
    friction: 0,
    restitution: 1,
  });

  // Bricks
  const bricks = new Map<
    string,
    {
      body: planck.Body;
      hp: number;
      brickType: string;
      col: number;
      row: number;
      originX: number;
    }
  >();
  let breakableRemaining = 0;
  for (let r = 0; r < BB_ROWS; r++) {
    const rowStr = (levelDef.rows[r] || "")
      .padEnd(BB_COLS, ".")
      .slice(0, BB_COLS);
    for (let c = 0; c < BB_COLS; c++) {
      let ch = rowStr[c] || ".";
      if (ch === " ") ch = ".";
      const def = BB_BRICKS[ch];
      if (!def || def.hp < 0) continue;
      const x = c * BB_BRICK_W + BB_BRICK_W / 2;
      const y = BB_GRID_TOP_Y - r * BB_BRICK_H - BB_BRICK_H / 2;
      const key = `${c}_${r}`;
      const body = world.createBody({
        type: ch === "M" ? "kinematic" : "static",
        position: bbVec2(x, y),
        fixedRotation: true,
      });
      body.setUserData({ tag: "brick", key, col: c, row: r, brickType: ch });
      body.createFixture({
        shape: new planck.Box(BB_BRICK_W / 2 - 0.01, BB_BRICK_H / 2 - 0.01),
        friction: 0,
        restitution: 1,
      });
      const hp = def.hp === 0 ? 9999 : def.hp;
      bricks.set(key, { body, hp, brickType: ch, col: c, row: r, originX: x });
      if (def.breakable) breakableRemaining++;
    }
  }

  // Ball
  const balls = new Map<number, planck.Body>();
  const by = BB_PADDLE_Y + BB_PADDLE_HH + BB_BALL_RADIUS + 0.05;
  const ball = world.createBody({
    type: "dynamic",
    position: bbVec2(BB_FIELD_W / 2, by),
    bullet: true,
    fixedRotation: true,
  });
  ball.setUserData({ tag: "ball", id: 0 });
  ball.createFixture({
    shape: new planck.Circle(BB_BALL_RADIUS),
    friction: 0,
    restitution: 1,
    density: 1,
  });
  ball.setLinearVelocity(bbVec2(0, 0));
  balls.set(0, ball);

  const sim: BBSimState = {
    world,
    paddle,
    balls,
    bricks,
    powerupBodies: new Map(),
    shieldBody: null,
    laserBodies: new Map(),
    rng,
    baseBallSpeed,
    paddleHW,
    tick: 0,
    serving: true,
    lives,
    score: carry?.score ?? 0,
    combo: carry?.combo ?? 0,
    maxCombo: carry?.maxCombo ?? 0,
    bricksDestroyed: carry?.bricksDestroyed ?? 0,
    breakableRemaining,
    powerupsUsed: carry?.powerupsUsed ?? 0,
    explosionKills: carry?.explosionKills ?? 0,
    laserKills: carry?.laserKills ?? 0,
    maxBallsAtOnce: carry?.maxBallsAtOnce ?? 1,
    missedThisLevel: false,
    levelCleared: false,
    runOver: false,
    activePowerups: new Map(),
    laserShotsRemaining: 0,
    lastLaserTick: -999,
    stickyBall: false,
    stickyOffset: 0,
    nextBallId: 1,
    nextPuId: 0,
    nextLaserId: 0,
    pendBrick: [],
    pendBallLoss: [],
    pendPuCollect: [],
    pendLaser: [],
    pendShield: false,
    pendPaddle: null,
  };

  world.on("begin-contact", (contact: planck.Contact) => {
    const bA = contact.getFixtureA().getBody();
    const bB = contact.getFixtureB().getBody();
    const uA = bA.getUserData() as BBEntityUD | null;
    const uB = bB.getUserData() as BBEntityUD | null;
    if (!uA || !uB) return;
    const p = [uA, uB];
    const _b = p.find((u) => u.tag === "ball");
    const _br = p.find((u) => u.tag === "brick");
    const _d = p.find((u) => u.tag === "death");
    const _pa = p.find((u) => u.tag === "paddle");
    const _pu = p.find((u) => u.tag === "powerup");
    const _la = p.find((u) => u.tag === "laser");
    const _sh = p.find((u) => u.tag === "shield");
    if (_b && _br) sim.pendBrick.push({ key: _br.key! });
    if (_b && _d) sim.pendBallLoss.push(_b.id!);
    if (_b && _pa) sim.pendPaddle = _b.id!;
    if (_b && _sh) sim.pendShield = true;
    if (_pu && _pa) sim.pendPuCollect.push({ id: _pu.id!, byPaddle: true });
    if (_pu && _d) sim.pendPuCollect.push({ id: _pu.id!, byPaddle: false });
    if (_la && _br) sim.pendLaser.push({ lid: _la.id!, bkey: _br.key! });
  });

  return sim;
}

function bbGetPaddleHW(s: BBSimState) {
  let hw = s.paddleHW;
  if (s.activePowerups.has("expand")) hw *= 1.5;
  if (s.activePowerups.has("shrink")) hw *= 0.6;
  return bbClamp(hw, 0.2, BB_FIELD_W / 2 - 0.1);
}

function bbGetBallSpeed(s: BBSimState) {
  let sp = s.baseBallSpeed;
  if (s.activePowerups.has("slow")) sp *= 0.65;
  if (s.activePowerups.has("fast")) sp *= 1.4;
  return sp;
}

function bbAdjacentKeys(c: number, r: number): string[] {
  const keys: string[] = [];
  for (let dc = -1; dc <= 1; dc++)
    for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue;
      const nc = c + dc,
        nr = r + dr;
      if (nc >= 0 && nc < BB_COLS && nr >= 0 && nr < BB_ROWS)
        keys.push(`${nc}_${nr}`);
    }
  return keys;
}

function bbDestroyBrick(s: BBSimState, key: string, destroyed: Set<string>) {
  const br = s.bricks.get(key);
  if (!br || destroyed.has(key)) return;
  const def = BB_BRICKS[br.brickType];
  if (!def || !def.breakable) return;
  destroyed.add(key);
  s.score += def.score * Math.max(1, Math.floor(s.combo / 5) + 1);
  s.combo++;
  s.maxCombo = Math.max(s.maxCombo, s.combo);
  s.bricksDestroyed++;
  s.breakableRemaining--;
  if (br.brickType === "E") {
    for (const ak of bbAdjacentKeys(br.col, br.row)) {
      const adj = s.bricks.get(ak);
      if (adj && !destroyed.has(ak) && BB_BRICKS[adj.brickType]?.breakable) {
        adj.hp = 0;
        s.explosionKills++;
        bbDestroyBrick(s, ak, destroyed);
      }
    }
  }
  const drop = br.brickType === "P" || s.rng.next() < 0.12; // use a fixed server rate
  if (drop) {
    const kind = bbWeightedPick(s.rng);
    const id = s.nextPuId++;
    const body = s.world.createBody({
      type: "dynamic",
      position: bbVec2(br.body.getPosition().x, br.body.getPosition().y),
      fixedRotation: true,
    });
    body.setUserData({ tag: "powerup", id, kind });
    body.createFixture({
      shape: new planck.Circle(BB_POWERUP_RADIUS),
      isSensor: true,
      density: 0.1,
    });
    body.setLinearVelocity(bbVec2(0, BB_POWERUP_FALL_SPEED));
    body.setGravityScale(0);
    s.powerupBodies.set(id, { body, kind });
  }
  s.world.destroyBody(br.body);
  s.bricks.delete(key);
}

function bbApplyPowerup(s: BBSimState, kind: BBPowerup) {
  s.powerupsUsed++;
  const exp = s.tick + BB_POWERUP_DURATION;
  switch (kind) {
    case "expand":
      s.activePowerups.set("expand", exp);
      s.activePowerups.delete("shrink");
      break;
    case "shrink":
      s.activePowerups.set("shrink", exp);
      s.activePowerups.delete("expand");
      break;
    case "slow":
      s.activePowerups.set("slow", exp);
      s.activePowerups.delete("fast");
      break;
    case "fast":
      s.activePowerups.set("fast", exp);
      s.activePowerups.delete("slow");
      break;
    case "extraLife":
      s.lives++;
      break;
    case "shield":
      if (!s.shieldBody) {
        const sb = s.world.createBody({
          type: "static",
          position: bbVec2(BB_FIELD_W / 2, 0.05),
        });
        sb.setUserData({ tag: "shield" });
        sb.createFixture({
          shape: new planck.Box(BB_FIELD_W / 2, 0.05),
          friction: 0,
          restitution: 1,
        });
        s.shieldBody = sb;
      }
      break;
    case "multiball": {
      const primary = [...s.balls.values()][0];
      if (primary) {
        const pos = primary.getPosition();
        const vel = primary.getLinearVelocity();
        const sp = vel.length() || bbGetBallSpeed(s);
        for (let i = 0; i < 2; i++) {
          const ang = (i === 0 ? -0.4 : 0.4) + Math.atan2(vel.x, vel.y);
          const id = s.nextBallId++;
          const nb = s.world.createBody({
            type: "dynamic",
            position: bbVec2(pos.x, pos.y),
            bullet: true,
            fixedRotation: true,
          });
          nb.setUserData({ tag: "ball", id });
          nb.createFixture({
            shape: new planck.Circle(BB_BALL_RADIUS),
            friction: 0,
            restitution: 1,
            density: 1,
          });
          nb.setLinearVelocity(bbVec2(Math.sin(ang) * sp, Math.cos(ang) * sp));
          s.balls.set(id, nb);
        }
        s.maxBallsAtOnce = Math.max(s.maxBallsAtOnce, s.balls.size);
      }
      break;
    }
    case "sticky":
      s.stickyBall = true;
      break;
    case "laser":
      s.laserShotsRemaining = BB_LASER_SHOTS;
      s.lastLaserTick = s.tick - BB_LASER_INTERVAL;
      break;
  }
}

function bbResetServe(s: BBSimState) {
  s.serving = true;
  s.stickyBall = false;
  s.stickyOffset = 0;
  for (const [, b] of s.balls) s.world.destroyBody(b);
  s.balls.clear();
  for (const [, p] of s.powerupBodies) s.world.destroyBody(p.body);
  s.powerupBodies.clear();
  for (const [, l] of s.laserBodies) s.world.destroyBody(l);
  s.laserBodies.clear();
  s.activePowerups.clear();
  s.laserShotsRemaining = 0;
  if (s.shieldBody) {
    s.world.destroyBody(s.shieldBody);
    s.shieldBody = null;
  }
  // Update paddle fixture
  const ohw = bbGetPaddleHW(s);
  const of2 = s.paddle.getFixtureList();
  if (of2) s.paddle.destroyFixture(of2);
  s.paddle.createFixture({
    shape: new planck.Box(s.paddleHW, BB_PADDLE_HH),
    friction: 0,
    restitution: 1,
  });
  // New ball
  const by = BB_PADDLE_Y + BB_PADDLE_HH + BB_BALL_RADIUS + 0.05;
  const px = s.paddle.getPosition().x;
  const nb = s.world.createBody({
    type: "dynamic",
    position: bbVec2(px, by),
    bullet: true,
    fixedRotation: true,
  });
  const bid = s.nextBallId++;
  nb.setUserData({ tag: "ball", id: bid });
  nb.createFixture({
    shape: new planck.Circle(BB_BALL_RADIUS),
    friction: 0,
    restitution: 1,
    density: 1,
  });
  nb.setLinearVelocity(bbVec2(0, 0));
  s.balls.set(bid, nb);
}

function bbStep(s: BBSimState, targetXNorm: number, action?: number) {
  if (s.levelCleared || s.runOver) return;
  // Launch
  if (s.serving && action === 1) {
    s.serving = false;
    const sp = bbGetBallSpeed(s);
    const ang = (s.rng.next() - 0.5) * 0.6;
    for (const [, ball] of s.balls) {
      if (ball.getLinearVelocity().length() < 0.1)
        ball.setLinearVelocity(bbVec2(Math.sin(ang) * sp, Math.cos(ang) * sp));
    }
  }
  // Paddle
  const hw = bbGetPaddleHW(s);
  const tx = bbClamp(targetXNorm * BB_FIELD_W, hw, BB_FIELD_W - hw);
  const pp = s.paddle.getPosition();
  const dx = tx - pp.x;
  s.paddle.setLinearVelocity(bbVec2(bbClamp(dx / BB_DT, -30, 30), 0));
  // Sticky / serve follow
  if (s.serving || s.stickyBall) {
    for (const [, ball] of s.balls) {
      if (ball.getLinearVelocity().length() < 0.1) {
        ball.setTransform(
          bbVec2(
            s.paddle.getPosition().x + s.stickyOffset,
            BB_PADDLE_Y + BB_PADDLE_HH + BB_BALL_RADIUS + 0.05,
          ),
          0,
        );
        ball.setLinearVelocity(bbVec2(0, 0));
      }
    }
  }
  // Moving bricks
  for (const [, br] of s.bricks) {
    if (br.brickType === "M") {
      const t = s.tick * BB_DT;
      const ox = Math.sin(t * BB_MOVE_SPEED * Math.PI * 2) * BB_MOVE_RANGE;
      br.body.setTransform(bbVec2(br.originX + ox, br.body.getPosition().y), 0);
    }
  }
  // Laser auto-fire
  if (
    s.laserShotsRemaining > 0 &&
    s.tick - s.lastLaserTick >= BB_LASER_INTERVAL &&
    !s.serving
  ) {
    s.laserShotsRemaining--;
    s.lastLaserTick = s.tick;
    const lid = s.nextLaserId++;
    const lb = s.world.createBody({
      type: "dynamic",
      position: bbVec2(s.paddle.getPosition().x, BB_PADDLE_Y + 0.3),
      bullet: true,
      fixedRotation: true,
    });
    lb.setUserData({ tag: "laser", id: lid });
    lb.createFixture({
      shape: new planck.Box(0.03, 0.1),
      isSensor: true,
      density: 0.01,
    });
    lb.setGravityScale(0);
    lb.setLinearVelocity(bbVec2(0, BB_LASER_SPEED));
    s.laserBodies.set(lid, lb);
  }
  // Remove high lasers
  for (const [id, l] of s.laserBodies) {
    if (l.getPosition().y > BB_FIELD_H + 0.5) {
      s.world.destroyBody(l);
      s.laserBodies.delete(id);
    }
  }
  // Step physics
  s.world.step(BB_DT, 8, 3);
  s.tick++;
  // Paddle hit angle adjust
  if (s.pendPaddle !== null) {
    const ball = s.balls.get(s.pendPaddle);
    if (ball) {
      const vel = ball.getLinearVelocity();
      const sp = vel.length();
      if (sp > 0.5) {
        const bx = ball.getPosition().x;
        const pxl = s.paddle.getPosition().x;
        const off = bbClamp((bx - pxl) / hw, -1, 1);
        const ang = off * BB_MAX_BOUNCE_ANGLE;
        const es = bbGetBallSpeed(s);
        ball.setLinearVelocity(
          bbVec2(Math.sin(ang) * es, Math.abs(Math.cos(ang)) * es),
        );
      }
    }
    s.pendPaddle = null;
  }
  // Shield
  if (s.pendShield && s.shieldBody) {
    s.world.destroyBody(s.shieldBody);
    s.shieldBody = null;
    s.pendShield = false;
  }
  // Bricks
  const destroyed = new Set<string>();
  for (const h of s.pendBrick) {
    if (destroyed.has(h.key)) continue;
    const br = s.bricks.get(h.key);
    if (!br) continue;
    br.hp--;
    if (br.hp <= 0) bbDestroyBrick(s, h.key, destroyed);
  }
  s.pendBrick = [];
  // Laser hits
  for (const lh of s.pendLaser) {
    const br = s.bricks.get(lh.bkey);
    if (br && !destroyed.has(lh.bkey)) {
      br.hp--;
      if (br.hp <= 0) {
        bbDestroyBrick(s, lh.bkey, destroyed);
        s.laserKills++;
      }
    }
    const la = s.laserBodies.get(lh.lid);
    if (la) {
      s.world.destroyBody(la);
      s.laserBodies.delete(lh.lid);
    }
  }
  s.pendLaser = [];
  // Ball loss
  const lost = new Set(s.pendBallLoss);
  for (const id of lost) {
    const b = s.balls.get(id);
    if (b) {
      s.world.destroyBody(b);
      s.balls.delete(id);
    }
  }
  s.pendBallLoss = [];
  if (lost.size > 0 && s.balls.size === 0) {
    s.lives--;
    s.combo = 0;
    s.missedThisLevel = true;
    if (s.lives <= 0) {
      s.runOver = true;
    } else bbResetServe(s);
  }
  // Powerup collect
  for (const pc of s.pendPuCollect) {
    const pu = s.powerupBodies.get(pc.id);
    if (pu) {
      if (pc.byPaddle) bbApplyPowerup(s, pu.kind);
      s.world.destroyBody(pu.body);
      s.powerupBodies.delete(pc.id);
    }
  }
  s.pendPuCollect = [];
  // Expire powerups
  for (const [k, ex] of s.activePowerups) {
    if (s.tick >= ex) {
      s.activePowerups.delete(k);
      if (k === "expand" || k === "shrink") {
        const of2 = s.paddle.getFixtureList();
        if (of2) s.paddle.destroyFixture(of2);
        s.paddle.createFixture({
          shape: new planck.Box(bbGetPaddleHW(s), BB_PADDLE_HH),
          friction: 0,
          restitution: 1,
        });
      }
    }
  }
  // Enforce ball speed
  const es = bbGetBallSpeed(s);
  for (const [, ball] of s.balls) {
    const vel = ball.getLinearVelocity();
    const sp = vel.length();
    if (sp > 0.5 && Math.abs(sp - es) > 0.1) {
      const sc = es / sp;
      ball.setLinearVelocity(bbVec2(vel.x * sc, vel.y * sc));
    }
    if (sp > 0.5 && Math.abs(vel.y) < es * 0.15) {
      const sg = vel.y >= 0 ? 1 : -1;
      const my = es * 0.15;
      ball.setLinearVelocity(
        bbVec2(Math.sign(vel.x) * Math.sqrt(es * es - my * my), sg * my),
      );
    }
  }
  // Remove OOB powerups
  for (const [id, pu] of s.powerupBodies) {
    if (pu.body.getPosition().y < -1) {
      s.world.destroyBody(pu.body);
      s.powerupBodies.delete(id);
    }
  }
  // Level clear
  if (s.breakableRemaining <= 0 && !s.levelCleared) s.levelCleared = true;
}

function bbReplay(
  seed: number,
  startLvl: number,
  endLvl: number,
  inputHz: number,
  samples: BBInputSample[],
) {
  const ticksPer = Math.round(60 / inputHz);
  let lives = BB_DEFAULT_LIVES;
  let score = 0,
    combo = 0,
    maxCombo = 0,
    bricksDestroyed = 0,
    powerupsUsed = 0;
  let explosionKills = 0,
    laserKills = 0,
    maxBallsAtOnce = 1,
    levelsCleared = 0;
  const noMiss: number[] = [];
  let gTick = 0,
    sIdx = 0;
  const maxTicks = 60 * 60 * 60;

  function findInput(t: number): { x: number; a?: number } {
    while (sIdx + 1 < samples.length && samples[sIdx + 1].tick <= t) sIdx++;
    if (sIdx < samples.length && samples[sIdx].tick <= t) return samples[sIdx];
    return { x: 0.5 };
  }

  for (let lvl = startLvl; lvl <= endLvl; lvl++) {
    const ld = BB_LEVELS.find((l) => l.id === lvl);
    if (!ld) break;
    const s = bbCreateSim(ld, seed, lives, {
      score,
      combo,
      maxCombo,
      bricksDestroyed,
      powerupsUsed,
      explosionKills,
      laserKills,
      maxBallsAtOnce,
    });
    let ltk = 0;
    while (
      !s.levelCleared &&
      !s.runOver &&
      ltk < 60 * 60 * 5 &&
      gTick < maxTicks
    ) {
      const inp = findInput(gTick);
      bbStep(s, inp.x, inp.a);
      gTick++;
      ltk++;
    }
    score = s.score;
    combo = s.combo;
    maxCombo = s.maxCombo;
    bricksDestroyed = s.bricksDestroyed;
    powerupsUsed = s.powerupsUsed;
    explosionKills = s.explosionKills;
    laserKills = s.laserKills;
    maxBallsAtOnce = s.maxBallsAtOnce;
    lives = s.lives;
    if (s.levelCleared) {
      levelsCleared++;
      const tb = Math.max(0, 3000 - ltk);
      const lb = lives * 500;
      score += 1000 * lvl + tb + lb;
      if (!s.missedThisLevel) noMiss.push(lvl);
    }
    if (s.runOver) {
      lives = 0;
      break;
    }
  }
  return {
    score,
    maxCombo,
    bricksDestroyed,
    powerupsUsed,
    levelsCleared,
    durationMs: Math.round((gTick / 60) * 1000),
    livesRemaining: lives,
    explosionBrickKills: explosionKills,
    laserBrickKills: laserKills,
    maxBallsAtOnce,
    noMissLevels: noMiss,
  };
}

// ── Brick Breaker Public State Shape ─────────────────────────────────

interface BBPublicState {
  phase: string;
  campaign: {
    currentLevelId: number;
    maxLevel: number;
    seed: number;
    lives: number;
    score: number;
    combo: number;
    maxCombo: number;
    bricksDestroyed: number;
    powerupsUsed: number;
    levelsCleared: number;
    startedAtMs: number;
    finishedAtMs: number | null;
    durationMs: number | null;
  };
  lastError?: string | null;
  integrity?: { replayVerified: boolean; verifierVersion: number };
}

// ── Register Adapter ─────────────────────────────────────────────────

registerAdapter({
  gameId: "brick_breaker",
  runtimeType: "solo",
  maxPlayers: 1,
  minPlayers: 1,
  defaultSettings: { aimGuide: true, haptics: true, sound: true },

  createInitialPublicState(): Record<string, unknown> {
    const st: BBPublicState = {
      phase: "idle",
      campaign: {
        currentLevelId: 1,
        maxLevel: BB_MAX_LEVEL,
        seed: 0,
        lives: BB_DEFAULT_LIVES,
        score: 0,
        combo: 0,
        maxCombo: 0,
        bricksDestroyed: 0,
        powerupsUsed: 0,
        levelsCleared: 0,
        startedAtMs: 0,
        finishedAtMs: null,
        durationMs: null,
      },
    };
    return st as unknown as Record<string, unknown>;
  },

  validateMove(
    publicState: Record<string, unknown>,
    _priv: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx,
  ): MoveValidationResult {
    const state = publicState as unknown as BBPublicState;
    const moveType = movePayload.type as string;

    if (moveType === "startRun") {
      const seed = (movePayload.seed as number) || Date.now();
      const startLevel = (movePayload.startLevelId as number) || 1;
      const ns: BBPublicState = {
        phase: "running",
        campaign: {
          currentLevelId: startLevel,
          maxLevel: BB_MAX_LEVEL,
          seed,
          lives: BB_DEFAULT_LIVES,
          score: 0,
          combo: 0,
          maxCombo: 0,
          bricksDestroyed: 0,
          powerupsUsed: 0,
          levelsCleared: 0,
          startedAtMs: Date.now(),
          finishedAtMs: null,
          durationMs: null,
        },
      };
      return {
        ok: true,
        nextPublicState: ns as unknown as Record<string, unknown>,
        turnAdvance: false,
      };
    }

    if (moveType === "finishRun") {
      const seed = movePayload.seed as number;
      const startLevelId = (movePayload.startLevelId as number) || 1;
      const endLevelId = (movePayload.endLevelId as number) || BB_MAX_LEVEL;
      const inputHz = (movePayload.inputHz as number) || 15;
      const inputSamples = (movePayload.inputSamples as BBInputSample[]) || [];

      // Server-authoritative replay
      let authStats;
      try {
        authStats = bbReplay(
          seed,
          startLevelId,
          endLevelId,
          inputHz,
          inputSamples,
        );
      } catch (err) {
        console.error(
          "[brick_breaker] Replay failed:",
          err,
          `seed=${seed}, startLvl=${startLevelId}, endLvl=${endLevelId}, inputHz=${inputHz}, samplesLen=${inputSamples.length}`,
        );
        return { ok: false, error: "Server replay failed." };
      }

      const now = Date.now();
      const ns: BBPublicState = {
        phase: "finished",
        campaign: {
          currentLevelId: startLevelId + authStats.levelsCleared,
          maxLevel: BB_MAX_LEVEL,
          seed,
          lives: authStats.livesRemaining,
          score: authStats.score,
          combo: 0,
          maxCombo: authStats.maxCombo,
          bricksDestroyed: authStats.bricksDestroyed,
          powerupsUsed: authStats.powerupsUsed,
          levelsCleared: authStats.levelsCleared,
          startedAtMs: state.campaign?.startedAtMs || now,
          finishedAtMs: now,
          durationMs: authStats.durationMs,
        },
        integrity: { replayVerified: true, verifierVersion: 1 },
      };

      return {
        ok: true,
        nextPublicState: ns as unknown as Record<string, unknown>,
        scoreDelta: [{ uid: ctx.uid, delta: authStats.score }],
        turnAdvance: false,
        terminal: {
          type:
            authStats.levelsCleared >= endLevelId - startLevelId + 1
              ? "win"
              : "timeout",
          winnerIds: [ctx.uid],
          reason:
            authStats.levelsCleared >= endLevelId - startLevelId + 1
              ? "Campaign complete!"
              : `Reached level ${startLevelId + authStats.levelsCleared}`,
        },
      };
    }

    return { ok: false, error: `Unknown move: ${moveType}` };
  },

  computeOutcome(publicState: Record<string, unknown>, players): GameOutcome {
    const st = publicState as unknown as BBPublicState;
    const uid = players[0]?.uid ?? "";
    const c = st.campaign;
    return {
      winnerIds: [uid],
      finalScoreboard: [
        {
          uid,
          score: c?.score ?? 0,
          placement: 1,
          stats: {
            levelsCleared: c?.levelsCleared ?? 0,
            durationMs: c?.durationMs ?? 0,
            maxCombo: c?.maxCombo ?? 0,
            bricksDestroyed: c?.bricksDestroyed ?? 0,
            powerupsUsed: c?.powerupsUsed ?? 0,
          },
        },
      ],
    };
  },

  extractPerformanceMetrics(publicState): Record<string, unknown> {
    const st = publicState as unknown as BBPublicState;
    const c = st.campaign;
    return {
      score: c?.score ?? 0,
      levelsCleared: c?.levelsCleared ?? 0,
      durationMs: c?.durationMs ?? 0,
      maxCombo: c?.maxCombo ?? 0,
      bricksDestroyed: c?.bricksDestroyed ?? 0,
      powerupsUsed: c?.powerupsUsed ?? 0,
      lives: c?.lives ?? 0,
    };
  },
});

// =============================================================================
// ████  CRAZY 8'S ADAPTER  ████
// =============================================================================

// -- Crazy 8's types (inline for backend monolith) --

type CE_CardColor = "red" | "blue" | "green" | "yellow";
type CE_CardType =
  | "number" | "skip" | "reverse" | "draw_two" | "wild" | "wild_draw_four";

interface CE_Card {
  id: string;
  color: CE_CardColor | null;
  type: CE_CardType;
  value: number | null;
}

const CE_ALL_COLORS: CE_CardColor[] = ["red", "blue", "green", "yellow"];

interface CE_Settings {
  stackDraw2: boolean;
  stackDraw4: boolean;
  stackingMode: "same_only" | "draws_mix";
  forcePlay: boolean;
  drawMode: "draw_one_then_pass" | "draw_until_playable";
  sevenZeroRule: boolean;
  jumpIn: boolean;
  wildDraw4Challenge: boolean;
  turnTimer: "off" | "20s" | "30s" | "45s";
  roundModel: "single_hand" | "match_points";
  targetPoints: number;
}

const CE_DEFAULT_SETTINGS: CE_Settings = {
  stackDraw2: false, stackDraw4: false, stackingMode: "same_only",
  forcePlay: true, drawMode: "draw_one_then_pass", sevenZeroRule: false,
  jumpIn: false, wildDraw4Challenge: true, turnTimer: "off",
  roundModel: "single_hand", targetPoints: 500,
};

interface CE_PrivateState { hand: CE_Card[]; hasDrawnThisTurn: boolean; }

interface CE_PublicState {
  phase: string; turnOrder: string[]; currentTurnIndex: number;
  currentTurnUid: string; direction: 1 | -1; topDiscard: CE_Card;
  currentColor: CE_CardColor; drawPileCount: number; discardCount: number;
  handCounts: Record<string, number>; pendingDraw: { count: number; source: string | null };
  callEligibleUid: string | null; calledCrazy: Record<string, boolean>;
  turnCounter: number; moveCount: number;
  lastMove: { actor: string; action: string; detail?: string } | null;
  challengeWindow: { active: boolean; wild4PlayerUid: string; targetUid: string; couldHavePlayedOtherColor: boolean } | null;
  scores: Record<string, number>; roundNumber: number; settings: CE_Settings;
  resolved: { winnerUid: string; reason: string; roundScores: Record<string, number>; matchWinner?: string } | null;
  drawPile: string[]; discardPile: string[]; cardLookup: Record<string, CE_Card>;
}

function ceCreateDeck(): CE_Card[] {
  const cards: CE_Card[] = [];
  for (const color of CE_ALL_COLORS) {
    cards.push({ id: `${color}_0_0`, color, type: "number", value: 0 });
    for (let v = 1; v <= 9; v++) {
      for (let c = 0; c < 2; c++) {
        cards.push({ id: `${color}_${v}_${c}`, color, type: "number", value: v });
      }
    }
    for (const at of ["skip", "reverse", "draw_two"] as CE_CardType[]) {
      for (let c = 0; c < 2; c++) {
        cards.push({ id: `${color}_${at}_${c}`, color, type: at, value: null });
      }
    }
  }
  for (let i = 0; i < 4; i++) cards.push({ id: `wild_${i}`, color: null, type: "wild", value: null });
  for (let i = 0; i < 4; i++) cards.push({ id: `wild_draw_four_${i}`, color: null, type: "wild_draw_four", value: null });
  return cards;
}

function ceShuffle(cards: CE_Card[]): CE_Card[] {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ceBuildLookup(cards: CE_Card[]): Record<string, CE_Card> {
  const m: Record<string, CE_Card> = {};
  for (const c of cards) m[c.id] = c;
  return m;
}

function ceIsPlayable(card: CE_Card, color: CE_CardColor, top: CE_Card): boolean {
  if (card.type === "wild" || card.type === "wild_draw_four") return true;
  if (card.color === color) return true;
  if (card.type === "number" && top.type === "number" && card.value === top.value) return true;
  if (card.type !== "number" && card.type === top.type) return true;
  return false;
}

function ceCouldPlayOther(hand: CE_Card[], color: CE_CardColor, top: CE_Card): boolean {
  return hand.some(c =>
    c.type !== "wild" && c.type !== "wild_draw_four" &&
    (c.color === color || (c.type === "number" && top.type === "number" && c.value === top.value) ||
     (c.type !== "number" && c.type === top.type)));
}

function ceNextTurn(idx: number, dir: 1 | -1, count: number, skip = 1): number {
  return (((idx + dir * skip) % count) + count) % count;
}

function ceDrawCards(n: number, drawPile: string[], discardPile: string[], lookup: Record<string, CE_Card>) {
  let dp = [...drawPile]; let disc = [...discardPile]; const drawn: CE_Card[] = [];
  for (let i = 0; i < n; i++) {
    if (dp.length === 0 && disc.length > 1) {
      const topId = disc[disc.length - 1];
      const reshuf = disc.slice(0, -1);
      for (let j = reshuf.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [reshuf[j], reshuf[k]] = [reshuf[k], reshuf[j]]; }
      dp = [...dp, ...reshuf]; disc = [topId];
    }
    if (dp.length === 0) break;
    const cid = dp.pop()!; if (lookup[cid]) drawn.push(lookup[cid]);
  }
  return { drawn, drawPile: dp, discardPile: disc };
}

function ceCardPoints(c: CE_Card): number {
  if (c.type === "number") return c.value ?? 0;
  if (c.type === "wild" || c.type === "wild_draw_four") return 50;
  return 20;
}

function ceMergeSettings(p: Record<string, unknown>): CE_Settings {
  const d = CE_DEFAULT_SETTINGS;
  return {
    stackDraw2: typeof p.stackDraw2 === "boolean" ? p.stackDraw2 : d.stackDraw2,
    stackDraw4: typeof p.stackDraw4 === "boolean" ? p.stackDraw4 : d.stackDraw4,
    stackingMode: ["same_only", "draws_mix"].includes(p.stackingMode as string) ? p.stackingMode as CE_Settings["stackingMode"] : d.stackingMode,
    forcePlay: typeof p.forcePlay === "boolean" ? p.forcePlay : d.forcePlay,
    drawMode: ["draw_one_then_pass", "draw_until_playable"].includes(p.drawMode as string) ? p.drawMode as CE_Settings["drawMode"] : d.drawMode,
    sevenZeroRule: typeof p.sevenZeroRule === "boolean" ? p.sevenZeroRule : d.sevenZeroRule,
    jumpIn: false,
    wildDraw4Challenge: typeof p.wildDraw4Challenge === "boolean" ? p.wildDraw4Challenge : d.wildDraw4Challenge,
    turnTimer: ["off", "20s", "30s", "45s"].includes(p.turnTimer as string) ? p.turnTimer as CE_Settings["turnTimer"] : d.turnTimer,
    roundModel: ["single_hand", "match_points"].includes(p.roundModel as string) ? p.roundModel as CE_Settings["roundModel"] : d.roundModel,
    targetPoints: typeof p.targetPoints === "number" && p.targetPoints >= 100 && p.targetPoints <= 1000 ? p.targetPoints : d.targetPoints,
  };
}

function ceCanStack(card: CE_Card, pending: { count: number; source: string | null }, settings: CE_Settings): boolean {
  if (pending.source === "D2") {
    if (card.type === "draw_two" && settings.stackDraw2) return true;
    if (card.type === "wild_draw_four" && settings.stackingMode === "draws_mix" && settings.stackDraw4) return true;
  }
  if (pending.source === "D4") {
    if (card.type === "wild_draw_four" && settings.stackDraw4) return true;
    if (card.type === "draw_two" && settings.stackingMode === "draws_mix" && settings.stackDraw2) return true;
  }
  return false;
}

// Temporary cache to share dealt hands between createInitialPublicState and
// createInitialPrivateState, which are called sequentially in the same pipeline.
let _ceLastDealCache: { hands: Record<string, CE_Card[]> } | null = null;

registerAdapter({
  gameId: "crazy_eights",
  runtimeType: "turnBased",
  maxPlayers: 6,
  minPlayers: 2,
  defaultSettings: CE_DEFAULT_SETTINGS as unknown as Record<string, unknown>,

  createInitialPublicState(players, settings) {
    const s = ceMergeSettings(settings);
    const turnOrder = players.sort((a, b) => a.slotIndex - b.slotIndex).map(p => p.uid);
    const deck = ceShuffle(ceCreateDeck());
    const lookup = ceBuildLookup(deck);
    const hands: Record<string, CE_Card[]> = {};
    const remaining = [...deck];
    for (const uid of turnOrder) hands[uid] = remaining.splice(0, 7);
    let topIdx = remaining.findIndex(c => c.type === "number");
    if (topIdx === -1) topIdx = remaining.findIndex(c => c.type !== "wild" && c.type !== "wild_draw_four");
    if (topIdx === -1) topIdx = 0;
    const topDiscard = remaining.splice(topIdx, 1)[0];
    const hc: Record<string, number> = {};
    const sc: Record<string, number> = {};
    const cc: Record<string, boolean> = {};
    for (const uid of turnOrder) { hc[uid] = 7; sc[uid] = 0; cc[uid] = false; }

    // Cache dealt hands for createInitialPrivateState
    _ceLastDealCache = { hands };

    return {
      phase: "playing", turnOrder, currentTurnIndex: 0, currentTurnUid: turnOrder[0],
      direction: 1, topDiscard, currentColor: topDiscard.color!, drawPileCount: remaining.length,
      discardCount: 1, handCounts: hc, pendingDraw: { count: 0, source: null },
      callEligibleUid: null, calledCrazy: cc, turnCounter: 0, moveCount: 0,
      lastMove: null, challengeWindow: null, scores: sc, roundNumber: 1, settings: s,
      resolved: null, drawPile: remaining.map(c => c.id), discardPile: [topDiscard.id], cardLookup: lookup,
    } as unknown as Record<string, unknown>;
  },

  createInitialPrivateState(players, _settings) {
    const turnOrder = players.sort((a, b) => a.slotIndex - b.slotIndex).map(p => p.uid);

    // Use the cached hands from createInitialPublicState (called first in pipeline)
    const cache = _ceLastDealCache;
    _ceLastDealCache = null; // Consume cache

    if (!cache) {
      throw new Error("CE: createInitialPrivateState called before createInitialPublicState");
    }

    const result: Record<string, Record<string, unknown>> = {};
    for (const uid of turnOrder) {
      result[uid] = { hand: cache.hands[uid] ?? [], hasDrawnThisTurn: false };
    }
    return result;
  },

  validateMove(publicState, privateStateByPlayer, movePayload, ctx) {
    const state = publicState as unknown as CE_PublicState;
    const privMap = privateStateByPlayer as unknown as Record<string, CE_PrivateState>;
    const payload = movePayload as unknown as { action: string; cardId?: string; declaredColor?: CE_CardColor; callCrazy?: boolean; targetUid?: string; challengeAction?: string; swapTargetUid?: string };
    const { uid } = ctx;
    const settings = state.settings;
    const priv = privMap[uid];
    const pc = state.turnOrder.length;

    if (state.phase !== "playing") return { ok: false, error: "Game not playing." };
    if (state.currentTurnUid !== uid) return { ok: false, error: "Not your turn." };

    switch (payload.action) {
      case "CHALLENGE_WILD4": {
        if (!state.challengeWindow?.active || state.challengeWindow.targetUid !== uid)
          return { ok: false, error: "No challenge window." };
        if (!settings.wildDraw4Challenge) return { ok: false, error: "Challenges disabled." };

        const w4uid = state.challengeWindow.wild4PlayerUid;
        const couldPlay = state.challengeWindow.couldHavePlayedOtherColor;
        let ns = { ...state }; let npm = { ...privMap };

        if (payload.challengeAction === "challenge") {
          if (couldPlay) {
            const w4p = { ...npm[w4uid] };
            const dr = ceDrawCards(4, [...state.drawPile], [...state.discardPile], state.cardLookup);
            w4p.hand = [...w4p.hand, ...dr.drawn]; npm[w4uid] = w4p;
            ns = { ...ns, drawPile: dr.drawPile, discardPile: dr.discardPile, drawPileCount: dr.drawPile.length, discardCount: dr.discardPile.length, handCounts: { ...ns.handCounts, [w4uid]: w4p.hand.length }, pendingDraw: { count: 0, source: null }, challengeWindow: null, lastMove: { actor: uid, action: "CHALLENGE_WILD4", detail: "Succeeded! Opponent drew 4" }, moveCount: state.moveCount + 1 };
            return { ok: true, nextPublicState: ns as unknown as Record<string, unknown>, nextPrivateState: npm as unknown as Record<string, Record<string, unknown>>, turnAdvance: false };
          } else {
            const cp = { ...npm[uid] };
            const dr = ceDrawCards(6, [...state.drawPile], [...state.discardPile], state.cardLookup);
            cp.hand = [...cp.hand, ...dr.drawn]; npm[uid] = cp;
            const ni = ceNextTurn(state.currentTurnIndex, state.direction, pc);
            ns = { ...ns, drawPile: dr.drawPile, discardPile: dr.discardPile, drawPileCount: dr.drawPile.length, discardCount: dr.discardPile.length, handCounts: { ...ns.handCounts, [uid]: cp.hand.length }, pendingDraw: { count: 0, source: null }, challengeWindow: null, currentTurnIndex: ni, currentTurnUid: state.turnOrder[ni], turnCounter: state.turnCounter + 1, lastMove: { actor: uid, action: "CHALLENGE_WILD4", detail: "Failed! Drew 6" }, moveCount: state.moveCount + 1 };
            return { ok: true, nextPublicState: ns as unknown as Record<string, unknown>, nextPrivateState: npm as unknown as Record<string, Record<string, unknown>>, turnAdvance: false, nextTurnPlayerId: state.turnOrder[ni] };
          }
        } else {
          const ap = { ...npm[uid] };
          const dr = ceDrawCards(state.pendingDraw.count, [...state.drawPile], [...state.discardPile], state.cardLookup);
          ap.hand = [...ap.hand, ...dr.drawn]; npm[uid] = ap;
          const ni = ceNextTurn(state.currentTurnIndex, state.direction, pc);
          ns = { ...ns, drawPile: dr.drawPile, discardPile: dr.discardPile, drawPileCount: dr.drawPile.length, discardCount: dr.discardPile.length, handCounts: { ...ns.handCounts, [uid]: ap.hand.length }, pendingDraw: { count: 0, source: null }, challengeWindow: null, currentTurnIndex: ni, currentTurnUid: state.turnOrder[ni], turnCounter: state.turnCounter + 1, lastMove: { actor: uid, action: "CHALLENGE_WILD4", detail: `Accepted, drew ${state.pendingDraw.count}` }, moveCount: state.moveCount + 1 };
          return { ok: true, nextPublicState: ns as unknown as Record<string, unknown>, nextPrivateState: npm as unknown as Record<string, Record<string, unknown>>, turnAdvance: false, nextTurnPlayerId: state.turnOrder[ni] };
        }
      }

      case "CATCH_NO_CRAZY": {
        const tid = payload.targetUid;
        if (!tid || !state.callEligibleUid || state.callEligibleUid !== tid) return { ok: false, error: "No eligible catch." };
        if (state.calledCrazy[tid]) return { ok: false, error: "Already called." };
        const tp = { ...privMap[tid] };
        const dr = ceDrawCards(2, [...state.drawPile], [...state.discardPile], state.cardLookup);
        tp.hand = [...tp.hand, ...dr.drawn];
        const npm2 = { ...privMap, [tid]: tp };
        const ns2: CE_PublicState = { ...state, drawPile: dr.drawPile, discardPile: dr.discardPile, drawPileCount: dr.drawPile.length, discardCount: dr.discardPile.length, handCounts: { ...state.handCounts, [tid]: tp.hand.length }, callEligibleUid: null, lastMove: { actor: uid, action: "CATCH_NO_CRAZY", detail: `Caught ${tid}` }, moveCount: state.moveCount + 1 };
        return { ok: true, nextPublicState: ns2 as unknown as Record<string, unknown>, nextPrivateState: npm2 as unknown as Record<string, Record<string, unknown>>, turnAdvance: false };
      }

      case "CALL_CRAZY": {
        if (state.callEligibleUid !== uid) return { ok: false, error: "Not eligible." };
        if (state.calledCrazy[uid]) return { ok: false, error: "Already called." };
        const ns3 = { ...state, calledCrazy: { ...state.calledCrazy, [uid]: true }, lastMove: { actor: uid, action: "CALL_CRAZY", detail: "CRAZY!" }, moveCount: state.moveCount + 1 };
        return { ok: true, nextPublicState: ns3 as unknown as Record<string, unknown>, turnAdvance: false };
      }

      case "DRAW_CARD": {
        if (state.challengeWindow?.active && state.challengeWindow.targetUid === uid) return { ok: false, error: "Resolve challenge first." };
        if (state.pendingDraw.count > 0) {
          const dc = state.pendingDraw.count;
          const dr = ceDrawCards(dc, [...state.drawPile], [...state.discardPile], state.cardLookup);
          const mp = { ...priv, hand: [...priv.hand, ...dr.drawn], hasDrawnThisTurn: true };
          const ni = ceNextTurn(state.currentTurnIndex, state.direction, pc);
          const ns: CE_PublicState = { ...state, drawPile: dr.drawPile, discardPile: dr.discardPile, drawPileCount: dr.drawPile.length, discardCount: dr.discardPile.length, handCounts: { ...state.handCounts, [uid]: mp.hand.length }, pendingDraw: { count: 0, source: null }, currentTurnIndex: ni, currentTurnUid: state.turnOrder[ni], turnCounter: state.turnCounter + 1, callEligibleUid: null, lastMove: { actor: uid, action: "DRAW_CARD", detail: `Drew ${dc} from stack` }, moveCount: state.moveCount + 1 };
          return { ok: true, nextPublicState: ns as unknown as Record<string, unknown>, nextPrivateState: { ...privMap, [uid]: mp } as unknown as Record<string, Record<string, unknown>>, turnAdvance: false, nextTurnPlayerId: state.turnOrder[ni] };
        }
        if (priv?.hasDrawnThisTurn && settings.drawMode === "draw_one_then_pass") return { ok: false, error: "Already drew." };
        const dr = ceDrawCards(1, [...state.drawPile], [...state.discardPile], state.cardLookup);
        if (dr.drawn.length === 0) return { ok: false, error: "No cards." };
        const mp = { ...priv, hand: [...(priv?.hand ?? []), ...dr.drawn], hasDrawnThisTurn: true };
        const ns = { ...state, drawPile: dr.drawPile, discardPile: dr.discardPile, drawPileCount: dr.drawPile.length, discardCount: dr.discardPile.length, handCounts: { ...state.handCounts, [uid]: mp.hand.length }, lastMove: { actor: uid, action: "DRAW_CARD", detail: "Drew 1" }, moveCount: state.moveCount + 1 };
        return { ok: true, nextPublicState: ns as unknown as Record<string, unknown>, nextPrivateState: { ...privMap, [uid]: mp } as unknown as Record<string, Record<string, unknown>>, turnAdvance: false };
      }

      case "PASS": {
        if (!priv?.hasDrawnThisTurn) return { ok: false, error: "Must draw first." };
        const ni = ceNextTurn(state.currentTurnIndex, state.direction, pc);
        const rp = { ...priv, hasDrawnThisTurn: false };
        const ns = { ...state, currentTurnIndex: ni, currentTurnUid: state.turnOrder[ni], turnCounter: state.turnCounter + 1, callEligibleUid: null, lastMove: { actor: uid, action: "PASS", detail: "Passed" }, moveCount: state.moveCount + 1 };
        return { ok: true, nextPublicState: ns as unknown as Record<string, unknown>, nextPrivateState: { ...privMap, [uid]: rp } as unknown as Record<string, Record<string, unknown>>, turnAdvance: false, nextTurnPlayerId: state.turnOrder[ni] };
      }

      case "PLAY_CARD": {
        const { cardId, declaredColor, callCrazy, swapTargetUid } = payload;
        if (!cardId) return { ok: false, error: "No cardId." };
        if (state.challengeWindow?.active && state.challengeWindow.targetUid === uid) return { ok: false, error: "Resolve challenge first." };
        if (!priv) return { ok: false, error: "No private state." };
        const card = priv.hand.find(c => c.id === cardId);
        if (!card) return { ok: false, error: "Card not in hand." };
        if (state.pendingDraw.count > 0 && !ceCanStack(card, state.pendingDraw, settings)) return { ok: false, error: "Must draw or stack." };
        if (state.pendingDraw.count === 0 && !ceIsPlayable(card, state.currentColor, state.topDiscard)) return { ok: false, error: "Not playable." };
        if ((card.type === "wild" || card.type === "wild_draw_four") && !declaredColor) return { ok: false, error: "Declare color." };
        if (declaredColor && !CE_ALL_COLORS.includes(declaredColor)) return { ok: false, error: "Invalid color." };

        const newHand = priv.hand.filter(c => c.id !== cardId);
        let npm: Record<string, CE_PrivateState> = { ...privMap, [uid]: { ...priv, hand: newHand, hasDrawnThisTurn: false } };
        const newDiscard = [...state.discardPile, cardId];
        const nc: CE_CardColor = declaredColor ?? card.color ?? state.currentColor;
        let dir = state.direction;
        let skip = 1;
        let pd = { ...state.pendingDraw };
        let cw: CE_PublicState["challengeWindow"] = null;

        if (card.type === "reverse") { if (pc === 2) skip = 2; else dir = (dir === 1 ? -1 : 1) as 1 | -1; }
        if (card.type === "skip") skip = 2;
        if (card.type === "draw_two") { pd = { count: (settings.stackDraw2 ? pd.count : 0) + 2, source: "D2" }; }
        if (card.type === "wild_draw_four") {
          const cp = ceCouldPlayOther(priv.hand, state.currentColor, state.topDiscard);
          pd = { count: (settings.stackDraw4 ? pd.count : 0) + 4, source: "D4" };
          if (settings.wildDraw4Challenge) cw = { active: true, wild4PlayerUid: uid, targetUid: "", couldHavePlayedOtherColor: cp };
        }

        // Seven-Zero
        if (settings.sevenZeroRule && card.type === "number") {
          if (card.value === 7 && swapTargetUid) {
            const ah = [...(npm[uid]?.hand ?? [])]; const th = [...(npm[swapTargetUid]?.hand ?? [])];
            npm[uid] = { ...npm[uid], hand: th }; npm[swapTargetUid] = { ...npm[swapTargetUid], hand: ah };
          } else if (card.value === 0) {
            const handsCopy: Record<string, CE_Card[]> = {};
            for (const u of state.turnOrder) handsCopy[u] = [...(npm[u]?.hand ?? [])];
            for (let i = 0; i < pc; i++) {
              const fi = (((i - dir) % pc) + pc) % pc;
              npm[state.turnOrder[i]] = { ...npm[state.turnOrder[i]], hand: handsCopy[state.turnOrder[fi]] };
            }
          }
        }

        const nhc: Record<string, number> = {};
        for (const u of state.turnOrder) nhc[u] = npm[u]?.hand?.length ?? state.handCounts[u];

        // Win check
        if (newHand.length === 0) {
          const rs: Record<string, number> = {};
          let total = 0;
          for (const u of state.turnOrder) { const pts = (npm[u]?.hand ?? []).reduce((s, c) => s + ceCardPoints(c), 0); rs[u] = -pts; if (u !== uid) total += pts; }
          rs[uid] = total;
          const nsc = { ...state.scores }; for (const u of state.turnOrder) nsc[u] = (nsc[u] ?? 0) + (rs[u] ?? 0);
          const isMatchEnd = settings.roundModel === "match_points" && nsc[uid] >= settings.targetPoints;
          const phase = isMatchEnd ? "match_over" : "round_over";
          const ns: CE_PublicState = { ...state, phase, topDiscard: card, currentColor: nc, direction: dir, discardPile: newDiscard, discardCount: newDiscard.length, handCounts: nhc, pendingDraw: { count: 0, source: null }, callEligibleUid: null, scores: nsc, lastMove: { actor: uid, action: "PLAY_CARD", detail: "Wins!" }, moveCount: state.moveCount + 1, resolved: { winnerUid: uid, reason: "hand_empty", roundScores: rs, matchWinner: isMatchEnd ? uid : undefined } };
          return { ok: true, nextPublicState: ns as unknown as Record<string, unknown>, nextPrivateState: npm as unknown as Record<string, Record<string, unknown>>, turnAdvance: false, terminal: { type: "win", winnerIds: [uid], reason: isMatchEnd ? "match_points_reached" : "hand_empty" } };
        }

        let ceUid = state.callEligibleUid;
        let cc = { ...state.calledCrazy };
        if (ceUid && ceUid !== uid) ceUid = null;
        if (newHand.length === 1) { ceUid = uid; cc[uid] = !!callCrazy; } else if (ceUid === uid) { ceUid = null; }

        const ni = ceNextTurn(state.currentTurnIndex, dir, pc, skip);
        if (cw) cw.targetUid = state.turnOrder[ni];

        const ns: CE_PublicState = { ...state, topDiscard: card, currentColor: nc, direction: dir, drawPileCount: state.drawPile.length, discardPile: newDiscard, discardCount: newDiscard.length, handCounts: nhc, pendingDraw: pd, callEligibleUid: ceUid, calledCrazy: cc, challengeWindow: cw, currentTurnIndex: ni, currentTurnUid: state.turnOrder[ni], turnCounter: state.turnCounter + 1, lastMove: { actor: uid, action: "PLAY_CARD" }, moveCount: state.moveCount + 1 };
        return { ok: true, nextPublicState: ns as unknown as Record<string, unknown>, nextPrivateState: npm as unknown as Record<string, Record<string, unknown>>, turnAdvance: false, nextTurnPlayerId: state.turnOrder[ni] };
      }

      default:
        return { ok: false, error: `Unknown action: ${payload.action}` };
    }
  },

  computeOutcome(publicState, players) {
    const state = publicState as unknown as CE_PublicState;
    const wu = state.resolved?.winnerUid;
    if (wu) {
      const rs = state.resolved?.roundScores ?? {};
      const sorted = players.map(p => ({ ...p, score: rs[p.uid] ?? 0 })).sort((a, b) => b.score - a.score);
      return { winnerIds: [wu], finalScoreboard: sorted.map((p, i) => ({ uid: p.uid, score: p.score, placement: p.uid === wu ? 1 : i + 1, stats: { handCount: state.handCounts[p.uid] ?? 0, matchScore: state.scores[p.uid] ?? 0 } as Record<string, unknown> })) };
    }
    return { winnerIds: [], finalScoreboard: players.map((p, i) => ({ uid: p.uid, score: 0, placement: i + 1, stats: {} })) };
  },

  extractPerformanceMetrics(publicState) {
    const s = publicState as unknown as CE_PublicState;
    return { totalMoves: s.moveCount, turnCounter: s.turnCounter, roundNumber: s.roundNumber, scores: s.scores, phase: s.phase };
  },

  validateSettings(patch) {
    return ceMergeSettings(patch) as unknown as Record<string, unknown>;
  },
});
