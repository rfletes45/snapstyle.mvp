/**
 * Games V4 — Chess Type Definitions
 *
 * Canonical types for the Chess game adapter.
 * Shared between client (optimistic validation) and server (authoritative).
 *
 * @module gamesV4/adapters/chess/chessTypes
 */

// =============================================================================
// Piece & Square
// =============================================================================

/** Piece notation: color prefix + piece letter. */
export type Piece =
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

/** File letters a–h. */
export type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";

/** Rank numbers 1–8. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Algebraic square notation. */
export type Square = `${File}${Rank}`;

/** Side to move. */
export type Side = "w" | "b";

/** Promotion piece types. */
export type PromotionPiece = "q" | "r" | "b" | "n";

// =============================================================================
// Public State
// =============================================================================

export interface CastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export interface LastMoveInfo {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: Piece | null;
  promotion?: PromotionPiece;
  san?: string;
}

export interface TerminalState {
  type: "win" | "draw";
  winnerUids?: string[];
  reason:
    | "checkmate"
    | "stalemate"
    | "insufficient_material"
    | "threefold_repetition"
    | "fifty_move_rule"
    | "draw_agreed"
    | "resignation";
}

export interface ChessPublicStateV1 {
  schemaVersion: 1;

  /** board[rankIndex][fileIndex] where rankIndex 0 == rank 8, 7 == rank 1. */
  board: (Piece | null)[][];

  sideToMove: Side;

  castling: CastlingRights;

  enPassant: Square | null;

  /** Plies since last pawn move or capture (50-move rule uses >= 100). */
  halfmoveClock: number;

  /** Starts at 1, increments after Black moves. */
  fullmoveNumber: number;

  lastMove: LastMoveInfo | null;

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

  terminal: TerminalState | null;
}

// =============================================================================
// Move Payloads
// =============================================================================

export type ChessMovePayload =
  | {
      action: "move";
      from: Square;
      to: Square;
      promotion?: PromotionPiece;
      offerDraw?: boolean;
    }
  | { action: "acceptDraw" }
  | { action: "claimDraw"; claim: "threefold" | "fiftyMove" };

// =============================================================================
// Helpers
// =============================================================================

export const FILES: File[] = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** Convert algebraic square to board indices. rankIndex 0 = rank 8. */
export function squareToIndices(sq: Square): [number, number] {
  const file = sq.charCodeAt(0) - 97; // a=0, h=7
  const rank = parseInt(sq[1], 10); // 1-8
  const row = 8 - rank; // rank 8 → row 0, rank 1 → row 7
  return [row, file];
}

/** Convert board indices to algebraic square. */
export function indicesToSquare(row: number, col: number): Square {
  const file = String.fromCharCode(97 + col);
  const rank = 8 - row;
  return `${file}${rank}` as Square;
}

/** Get the color of a piece. */
export function pieceColor(piece: Piece): Side {
  return piece[0] as Side;
}

/** Get the type letter of a piece (P, N, B, R, Q, K). */
export function pieceType(piece: Piece): string {
  return piece[1];
}

/** Make a piece from color and type. */
export function makePiece(color: Side, type: string): Piece {
  return `${color}${type}` as Piece;
}

/** Material value of a piece type. */
export function pieceValue(piece: Piece): number {
  switch (piece[1]) {
    case "P":
      return 1;
    case "N":
      return 3;
    case "B":
      return 3;
    case "R":
      return 5;
    case "Q":
      return 9;
    case "K":
      return 0;
    default:
      return 0;
  }
}
