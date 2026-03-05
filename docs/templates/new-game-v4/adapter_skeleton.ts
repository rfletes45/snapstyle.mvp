// ──────────────────────────────────────────────────────────
// Template: Game Adapter Skeleton for Games V4
// Copy this file to src/gamesV4/adapters/{myGame}.ts
// Replace all "my_game" / "MyGame" references with your game.
// ──────────────────────────────────────────────────────────
import type {
  GameAdapterV4,
  GameOutcome,
  MoveValidationResult,
  SettingsFieldDef,
} from "../types";
import type { PlayerSlot, ScoreSummaryEntry } from "../types/common";
import { registerAdapter } from "./registry";

// ─── Game-Specific Types ────────────────────────────────
// Define the shape of your public state (stored in PublicState/state):
interface MyGamePublicState {
  board: (string | null)[][]; // Replace with your board representation
  scores: Record<string, number>;
  moveCount: number;
  // Add any other state fields
}

// Define the shape of move payloads submitted by clients:
interface MyGameMovePayload {
  row: number;
  col: number;
  // Add fields your game needs to describe a move
}

// ─── Adapter Implementation ─────────────────────────────
const myGameAdapter: GameAdapterV4 = {
  // ── Identity ──────────────────────────────────────────
  gameId: "my_game", // Must match the GameId union in types/common.ts
  runtimeType: "turnBased", // "solo" | "turnBased" | "realtime"
  maxPlayers: 2,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "full_state", // "public_only" | "post_game_only" | "full_state"
  settingsSchema: [] as SettingsFieldDef[], // Lobby settings (future)
  defaultSettings: {},

  // ── Required: Initial State ───────────────────────────
  createInitialPublicState(
    players: PlayerSlot[],
    _settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const ROWS = 8;
    const COLS = 8;
    return {
      board: Array(ROWS)
        .fill(null)
        .map(() => Array(COLS).fill(null)),
      scores: Object.fromEntries(players.map((p) => [p.uid, 0])),
      moveCount: 0,
    } satisfies MyGamePublicState as unknown as Record<string, unknown>;
  },

  // ── Optional: Private State (e.g., hidden cards) ──────
  // createInitialPrivateState(players, settings) {
  //   return Object.fromEntries(
  //     players.map(p => [p.uid, { hand: [] }])
  //   );
  // },

  // ── Recommended: Move Validation ──────────────────────
  validateMove(
    publicState: Record<string, unknown>,
    _privateState: Record<string, unknown> | null,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult {
    const state = publicState as unknown as MyGamePublicState;
    const move = movePayload as unknown as MyGameMovePayload;
    const { uid } = ctx;

    // 1. Validate the move is within bounds
    if (
      move.row < 0 ||
      move.row >= state.board.length ||
      move.col < 0 ||
      move.col >= state.board[0].length
    ) {
      return { ok: false, error: "Out of bounds" };
    }

    // 2. Check cell is unoccupied
    if (state.board[move.row][move.col] !== null) {
      return { ok: false, error: "Cell already occupied" };
    }

    // 3. Clone state (NEVER mutate input)
    const nextBoard = state.board.map((r) => [...r]);
    nextBoard[move.row][move.col] = uid;

    const nextState: MyGamePublicState = {
      ...state,
      board: nextBoard,
      moveCount: state.moveCount + 1,
    };

    // 4. Check win condition
    const winner = checkWinner(nextBoard);
    if (winner) {
      nextState.scores[winner] = 1;
      return {
        ok: true,
        nextPublicState: nextState as unknown as Record<string, unknown>,
        scoreDelta: [{ uid: winner, delta: 1 }],
        turnAdvance: false,
        terminal: { type: "win", winnerIds: [winner] },
      };
    }

    // 5. Check draw condition
    if (isBoardFull(nextBoard)) {
      return {
        ok: true,
        nextPublicState: nextState as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: { type: "draw" },
      };
    }

    // 6. Non-terminal — advance turn to next player
    return {
      ok: true,
      nextPublicState: nextState as unknown as Record<string, unknown>,
      turnAdvance: true,
    };
  },

  // ── Optional: Invite Card Summary ─────────────────────
  computeSummary(
    publicState: Record<string, unknown>,
    players: PlayerSlot[],
    turnPlayerId: string | null,
  ): { turnPlayerId: string | null; scoreSummary: ScoreSummaryEntry[] } {
    const state = publicState as unknown as MyGamePublicState;
    return {
      turnPlayerId,
      scoreSummary: players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName ?? "???",
        score: state.scores[p.uid] ?? 0,
      })),
    };
  },

  // ── Optional: Final Outcome ───────────────────────────
  computeOutcome(
    publicState: Record<string, unknown>,
    players: PlayerSlot[],
  ): GameOutcome {
    const state = publicState as unknown as MyGamePublicState;
    const sorted = [...players].sort(
      (a, b) => (state.scores[b.uid] ?? 0) - (state.scores[a.uid] ?? 0),
    );
    return {
      winnerIds: sorted
        .filter((p) => (state.scores[p.uid] ?? 0) > 0)
        .map((p) => p.uid),
      finalScoreboard: sorted.map((p, i) => ({
        uid: p.uid,
        score: state.scores[p.uid] ?? 0,
        placement: i + 1,
        stats: {},
      })),
    };
  },

  // ── Optional: Spectator View ──────────────────────────
  // Implement this if your game has hidden information:
  // getSpectatorView(publicState) {
  //   const state = publicState as unknown as MyGamePublicState;
  //   return { ...state, hiddenField: "[HIDDEN]" };
  // },

  // ── Optional: Performance Metrics ─────────────────────
  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    _players: PlayerSlot[],
  ): Record<string, unknown> {
    const state = publicState as unknown as MyGamePublicState;
    return { totalMoves: state.moveCount };
  },
};

// ─── Game Logic Helpers ─────────────────────────────────
// TODO: Replace with your game's win detection logic
function checkWinner(board: (string | null)[][]): string | null {
  // Example: check for N-in-a-row
  // Return the UID of the winner, or null if no winner
  return null;
}

function isBoardFull(board: (string | null)[][]): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

// ─── Self-Register ──────────────────────────────────────
registerAdapter(myGameAdapter);
export default myGameAdapter;
