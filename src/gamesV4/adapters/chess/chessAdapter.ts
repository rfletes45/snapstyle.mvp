/**
 * Games V4 — Chess Adapter
 *
 * Full turn-based adapter for Chess, following the V4 GameAdapterV4 contract.
 * Self-registers via registerAdapter() on import.
 *
 * White/black mapping:
 *   whiteUid = ctx.turnOrder[0]
 *   blackUid = ctx.turnOrder[1]
 *
 * @module gamesV4/adapters/chess/chessAdapter
 */

import type {
  GameAdapterV4,
  GameOutcome,
  MoveValidationResult,
} from "../../types/adapter";
import { registerAdapter } from "../registry";
import {
  applyMoveToState,
  createInitialChessState,
  findLegalMove,
  hasLostPieces,
} from "./chessEngine";
import type {
  ChessMovePayload,
  ChessPublicStateV1,
  PromotionPiece,
  Square,
} from "./chessTypes";
import { squareToIndices } from "./chessTypes";

// =============================================================================
// Helpers
// =============================================================================

function asChessState(raw: Record<string, unknown>): ChessPublicStateV1 {
  return raw as unknown as ChessPublicStateV1;
}

function asRecord(state: ChessPublicStateV1): Record<string, unknown> {
  return state as unknown as Record<string, unknown>;
}

function isValidSquare(s: unknown): s is Square {
  if (typeof s !== "string" || s.length !== 2) return false;
  const file = s.charCodeAt(0);
  const rank = s.charCodeAt(1);
  return file >= 97 && file <= 104 && rank >= 49 && rank <= 56;
}

function isValidPromotion(p: unknown): p is PromotionPiece | undefined {
  return p === undefined || p === "q" || p === "r" || p === "b" || p === "n";
}

// =============================================================================
// Adapter Implementation
// =============================================================================

const chessAdapter: GameAdapterV4 = {
  gameId: "chess",
  runtimeType: "turnBased",
  maxPlayers: 2,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "full_state",

  scoreboardDescriptor: {
    title: "MATCH RESULT",
    formatScore: (s: number) => (s === 1 ? "Win" : s === 0 ? "Loss" : "Draw"),
    sortDirection: "desc",
  },

  settingsSchema: [],
  defaultSettings: {},

  // ── State Creation ──────────────────────────────────────────────────

  createInitialPublicState(
    _players: Array<{ uid: string; slotIndex: number }>,
    _settings: Record<string, unknown>,
  ): Record<string, unknown> {
    return asRecord(createInitialChessState());
  },

  // ── Move Validation ─────────────────────────────────────────────────

  validateMove(
    publicState: Record<string, unknown>,
    _privateStateByPlayer: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult {
    const state = asChessState(publicState);
    const payload = movePayload as unknown as ChessMovePayload;

    // Game already terminal
    if (state.terminal) {
      return { ok: false, error: "Game is already over." };
    }

    const whiteUid = ctx.turnOrder[0];
    const blackUid = ctx.turnOrder[1];
    const moverUid = ctx.uid;
    const expectedSide = moverUid === whiteUid ? "w" : "b";

    // Verify it's this player's turn
    if (state.sideToMove !== expectedSide) {
      return { ok: false, error: "Not your turn." };
    }

    // ── Accept Draw ──────────────────────────────────────────────────
    if (payload.action === "acceptDraw") {
      if (!state.pendingDrawOfferByUid) {
        return { ok: false, error: "No draw offer to accept." };
      }
      if (state.pendingDrawOfferByUid === moverUid) {
        return { ok: false, error: "Cannot accept your own draw offer." };
      }

      const newState: ChessPublicStateV1 = {
        ...state,
        terminal: {
          type: "draw",
          reason: "draw_agreed",
        },
        pendingDrawOfferByUid: null,
      };

      return {
        ok: true,
        nextPublicState: asRecord(newState),
        turnAdvance: false,
        terminal: {
          type: "draw",
          reason: "draw_agreed",
        },
      };
    }

    // ── Claim Draw ───────────────────────────────────────────────────
    if (payload.action === "claimDraw") {
      if (payload.claim === "threefold") {
        const currentHash = state.positionHash;
        const count = state.repetitionCounts[currentHash] ?? 0;
        if (count < 3) {
          return {
            ok: false,
            error: `Threefold repetition not met: current position seen ${count} time(s).`,
          };
        }
        const newState: ChessPublicStateV1 = {
          ...state,
          terminal: {
            type: "draw",
            reason: "threefold_repetition",
          },
          pendingDrawOfferByUid: null,
        };
        return {
          ok: true,
          nextPublicState: asRecord(newState),
          turnAdvance: false,
          terminal: {
            type: "draw",
            reason: "threefold_repetition",
          },
        };
      }

      if (payload.claim === "fiftyMove") {
        if (state.halfmoveClock < 100) {
          return {
            ok: false,
            error: `50-move rule not met: halfmoveClock is ${state.halfmoveClock}.`,
          };
        }
        const newState: ChessPublicStateV1 = {
          ...state,
          terminal: {
            type: "draw",
            reason: "fifty_move_rule",
          },
          pendingDrawOfferByUid: null,
        };
        return {
          ok: true,
          nextPublicState: asRecord(newState),
          turnAdvance: false,
          terminal: {
            type: "draw",
            reason: "fifty_move_rule",
          },
        };
      }

      return { ok: false, error: "Invalid draw claim." };
    }

    // ── Normal Move ──────────────────────────────────────────────────
    if (payload.action !== "move") {
      return { ok: false, error: "Invalid action." };
    }

    if (!isValidSquare(payload.from) || !isValidSquare(payload.to)) {
      return { ok: false, error: "Invalid square coordinates." };
    }

    if (!isValidPromotion(payload.promotion)) {
      return { ok: false, error: "Invalid promotion piece." };
    }

    // Check if promotion is required
    const [fromRow, fromCol] = squareToIndices(payload.from);
    const [toRow] = squareToIndices(payload.to);
    const movingPiece = state.board[fromRow][fromCol];

    if (movingPiece && movingPiece[1] === "P") {
      const promoRank = expectedSide === "w" ? 0 : 7;
      if (toRow === promoRank && !payload.promotion) {
        return { ok: false, error: "Promotion piece required." };
      }
      if (toRow !== promoRank && payload.promotion) {
        return { ok: false, error: "Cannot promote on this rank." };
      }
    }

    // Find the legal move
    const legalMove = findLegalMove(
      state.board,
      state.sideToMove,
      state.castling,
      state.enPassant,
      payload.from,
      payload.to,
      payload.promotion,
    );

    if (!legalMove) {
      return { ok: false, error: "Illegal move." };
    }

    // Apply the move
    let newState = applyMoveToState(state, legalMove, moverUid);

    // Handle draw offer
    if (payload.offerDraw && !newState.terminal) {
      newState = {
        ...newState,
        pendingDrawOfferByUid: moverUid,
      };
    } else {
      // Making a normal move clears any pending draw offer
      newState = {
        ...newState,
        pendingDrawOfferByUid: null,
      };
    }

    // Build result
    if (newState.terminal) {
      return {
        ok: true,
        nextPublicState: asRecord(newState),
        turnAdvance: false,
        terminal: {
          type: newState.terminal.type,
          winnerIds: newState.terminal.winnerUids,
          reason: newState.terminal.reason,
        },
      };
    }

    return {
      ok: true,
      nextPublicState: asRecord(newState),
      turnAdvance: true,
    };
  },

  // ── Summary ─────────────────────────────────────────────────────────

  computeSummary(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; displayName: string }>,
    currentTurnPlayerId: string | null,
  ) {
    const state = asChessState(publicState);

    // Compute material captured value per player
    const scoreSummary = players.map((p) => {
      const captures = state.capturesByUid[p.uid] ?? 0;
      return {
        uid: p.uid,
        displayName: p.displayName,
        score: captures,
      };
    });

    return {
      turnPlayerId: currentTurnPlayerId,
      scoreSummary,
    };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = asChessState(publicState);

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

    // Draw
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

  // ── Spectator View ──────────────────────────────────────────────────

  getSpectatorView(
    publicState: Record<string, unknown>,
  ): Record<string, unknown> {
    // Chess has no hidden info — full state is spectatable
    return publicState;
  },

  // ── Performance Metrics ─────────────────────────────────────────────

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = asChessState(publicState);

    const metrics: Record<string, unknown> = {
      totalMoves: state.plyCount,
      endedBy: state.terminal?.reason ?? "unknown",
      capturesByUid: state.capturesByUid,
      promotionsByUid: state.promotionsByUid,
      enPassantByUid: state.enPassantByUid,
      castlesByUid: state.castlesByUid,
      checksByUid: state.checksByUid,
    };

    // Short mate ply count
    if (state.terminal?.reason === "checkmate") {
      metrics.shortMatePly = state.plyCount;
    }

    // Won without losing a piece
    if (state.terminal?.type === "win" && state.terminal.winnerUids?.length) {
      const winnerId = state.terminal.winnerUids[0];
      const winnerSlot = players.findIndex((p) => p.uid === winnerId);
      const winnerSide = winnerSlot === 0 ? "w" : "b";
      metrics.wonWithoutLosingPiece = !hasLostPieces(state.board, winnerSide);
    }

    // Underpromotion tracking
    const hasUnderpromotion: Record<string, boolean> = {};
    for (const uid of players.map((p) => p.uid)) {
      hasUnderpromotion[uid] = (state.underPromotionsByUid[uid] ?? 0) > 0;
    }
    metrics.hasUnderpromotion = hasUnderpromotion;

    return metrics;
  },
};

// Auto-register on import
registerAdapter(chessAdapter);

export default chessAdapter;
