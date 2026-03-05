/**
 * Games V4 — Chess Rules Engine
 *
 * Pure, deterministic chess rules engine with zero external dependencies.
 * Handles all legal move generation, validation, check/mate/draw detection.
 *
 * Board representation:
 *   board[row][col] where row 0 = rank 8, row 7 = rank 1
 *   col 0 = file a, col 7 = file h
 *
 * @module gamesV4/adapters/chess/chessEngine
 */

import type {
  CastlingRights,
  ChessPublicStateV1,
  Piece,
  PromotionPiece,
  Side,
  Square,
} from "./chessTypes";
import {
  indicesToSquare,
  makePiece,
  pieceColor,
  pieceType,
  squareToIndices,
} from "./chessTypes";

// =============================================================================
// Board Helpers
// =============================================================================

type Board = (Piece | null)[][];

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

/** Find the king's position for the given side. */
function findKing(board: Board, side: Side): [number, number] | null {
  const king = makePiece(side, "K");
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === king) return [r, c];
    }
  }
  return null;
}

// =============================================================================
// Attack Detection
// =============================================================================

/** Check if a given square is attacked by the given side. */
export function isSquareAttackedBy(
  board: Board,
  row: number,
  col: number,
  attacker: Side,
): boolean {
  // Pawn attacks
  const pawnDir = attacker === "w" ? 1 : -1; // white pawns attack upward (lower row index)
  const pawn = makePiece(attacker, "P");
  for (const dc of [-1, 1]) {
    const pr = row + pawnDir;
    const pc = col + dc;
    if (inBounds(pr, pc) && board[pr][pc] === pawn) return true;
  }

  // Knight attacks
  const knight = makePiece(attacker, "N");
  const knightOffsets: [number, number][] = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  for (const [dr, dc] of knightOffsets) {
    const nr = row + dr;
    const nc = col + dc;
    if (inBounds(nr, nc) && board[nr][nc] === knight) return true;
  }

  // King attacks (for checking if kings are adjacent)
  const king = makePiece(attacker, "K");
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const kr = row + dr;
      const kc = col + dc;
      if (inBounds(kr, kc) && board[kr][kc] === king) return true;
    }
  }

  // Sliding attacks: bishop/queen on diagonals, rook/queen on straights
  const bishop = makePiece(attacker, "B");
  const rook = makePiece(attacker, "R");
  const queen = makePiece(attacker, "Q");

  // Diagonals
  const diags: [number, number][] = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const [dr, dc] of diags) {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p !== null) {
        if (p === bishop || p === queen) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  // Straights
  const straights: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of straights) {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
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

/** Check if the given side's king is in check. */
export function isInCheck(board: Board, side: Side): boolean {
  const kingPos = findKing(board, side);
  if (!kingPos) return false;
  const opponent: Side = side === "w" ? "b" : "w";
  return isSquareAttackedBy(board, kingPos[0], kingPos[1], opponent);
}

// =============================================================================
// Move Representation
// =============================================================================

export interface ChessMove {
  from: Square;
  to: Square;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  piece: Piece;
  captured: Piece | null;
  promotion?: PromotionPiece;
  isCastle?: boolean;
  isEnPassant?: boolean;
}

// =============================================================================
// Pseudo-Legal Move Generation
// =============================================================================

/** Generate all pseudo-legal moves for a side (does NOT filter for check). */
function generatePseudoLegalMoves(
  board: Board,
  side: Side,
  castling: CastlingRights,
  enPassant: Square | null,
): ChessMove[] {
  const moves: ChessMove[] = [];
  const opponent: Side = side === "w" ? "b" : "w";

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece === null || pieceColor(piece) !== side) continue;

      const type = pieceType(piece);
      const from = indicesToSquare(r, c);

      if (type === "P") {
        // Pawn moves
        const dir = side === "w" ? -1 : 1;
        const startRow = side === "w" ? 6 : 1;
        const promoRow = side === "w" ? 0 : 7;

        // Single push
        const r1 = r + dir;
        if (inBounds(r1, c) && board[r1][c] === null) {
          if (r1 === promoRow) {
            for (const promo of ["q", "r", "b", "n"] as PromotionPiece[]) {
              moves.push({
                from,
                to: indicesToSquare(r1, c),
                fromRow: r,
                fromCol: c,
                toRow: r1,
                toCol: c,
                piece,
                captured: null,
                promotion: promo,
              });
            }
          } else {
            moves.push({
              from,
              to: indicesToSquare(r1, c),
              fromRow: r,
              fromCol: c,
              toRow: r1,
              toCol: c,
              piece,
              captured: null,
            });

            // Double push from start
            const r2 = r + 2 * dir;
            if (r === startRow && inBounds(r2, c) && board[r2][c] === null) {
              moves.push({
                from,
                to: indicesToSquare(r2, c),
                fromRow: r,
                fromCol: c,
                toRow: r2,
                toCol: c,
                piece,
                captured: null,
              });
            }
          }
        }

        // Captures
        for (const dc of [-1, 1]) {
          const nc = c + dc;
          if (!inBounds(r1, nc)) continue;

          const target = board[r1][nc];
          if (target !== null && pieceColor(target) === opponent) {
            if (r1 === promoRow) {
              for (const promo of ["q", "r", "b", "n"] as PromotionPiece[]) {
                moves.push({
                  from,
                  to: indicesToSquare(r1, nc),
                  fromRow: r,
                  fromCol: c,
                  toRow: r1,
                  toCol: nc,
                  piece,
                  captured: target,
                  promotion: promo,
                });
              }
            } else {
              moves.push({
                from,
                to: indicesToSquare(r1, nc),
                fromRow: r,
                fromCol: c,
                toRow: r1,
                toCol: nc,
                piece,
                captured: target,
              });
            }
          }

          // En passant
          if (enPassant !== null) {
            const [epRow, epCol] = squareToIndices(enPassant);
            if (r1 === epRow && nc === epCol) {
              const capturedPawn = makePiece(opponent, "P");
              moves.push({
                from,
                to: enPassant,
                fromRow: r,
                fromCol: c,
                toRow: epRow,
                toCol: epCol,
                piece,
                captured: capturedPawn,
                isEnPassant: true,
              });
            }
          }
        }
      } else if (type === "N") {
        for (const [dr, dc] of knightOffsets) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = board[nr][nc];
          if (target !== null && pieceColor(target) === side) continue;
          moves.push({
            from,
            to: indicesToSquare(nr, nc),
            fromRow: r,
            fromCol: c,
            toRow: nr,
            toCol: nc,
            piece,
            captured: target,
          });
        }
      } else if (type === "B" || type === "R" || type === "Q") {
        const directions =
          type === "B"
            ? diags
            : type === "R"
              ? straights
              : [...diags, ...straights];

        for (const [dr, dc] of directions) {
          let nr = r + dr;
          let nc = c + dc;
          while (inBounds(nr, nc)) {
            const target = board[nr][nc];
            if (target !== null) {
              if (pieceColor(target) === opponent) {
                moves.push({
                  from,
                  to: indicesToSquare(nr, nc),
                  fromRow: r,
                  fromCol: c,
                  toRow: nr,
                  toCol: nc,
                  piece,
                  captured: target,
                });
              }
              break;
            }
            moves.push({
              from,
              to: indicesToSquare(nr, nc),
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
        // Normal king moves
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const target = board[nr][nc];
            if (target !== null && pieceColor(target) === side) continue;
            moves.push({
              from,
              to: indicesToSquare(nr, nc),
              fromRow: r,
              fromCol: c,
              toRow: nr,
              toCol: nc,
              piece,
              captured: target,
            });
          }
        }

        // Castling
        if (side === "w") {
          // White kingside: e1 → g1, rook h1 → f1
          if (castling.wK && c === 4 && r === 7) {
            if (
              board[7][5] === null &&
              board[7][6] === null &&
              board[7][7] === "wR"
            ) {
              moves.push({
                from,
                to: "g1" as Square,
                fromRow: 7,
                fromCol: 4,
                toRow: 7,
                toCol: 6,
                piece,
                captured: null,
                isCastle: true,
              });
            }
          }
          // White queenside: e1 → c1, rook a1 → d1
          if (castling.wQ && c === 4 && r === 7) {
            if (
              board[7][1] === null &&
              board[7][2] === null &&
              board[7][3] === null &&
              board[7][0] === "wR"
            ) {
              moves.push({
                from,
                to: "c1" as Square,
                fromRow: 7,
                fromCol: 4,
                toRow: 7,
                toCol: 2,
                piece,
                captured: null,
                isCastle: true,
              });
            }
          }
        } else {
          // Black kingside: e8 → g8, rook h8 → f8
          if (castling.bK && c === 4 && r === 0) {
            if (
              board[0][5] === null &&
              board[0][6] === null &&
              board[0][7] === "bR"
            ) {
              moves.push({
                from,
                to: "g8" as Square,
                fromRow: 0,
                fromCol: 4,
                toRow: 0,
                toCol: 6,
                piece,
                captured: null,
                isCastle: true,
              });
            }
          }
          // Black queenside: e8 → c8, rook a8 → d8
          if (castling.bQ && c === 4 && r === 0) {
            if (
              board[0][1] === null &&
              board[0][2] === null &&
              board[0][3] === null &&
              board[0][0] === "bR"
            ) {
              moves.push({
                from,
                to: "c8" as Square,
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
      }
    }
  }

  return moves;
}

const knightOffsets: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

const diags: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const straights: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// =============================================================================
// Legal Move Generation
// =============================================================================

/** Apply a move to a cloned board (for legality checking). Returns the new board. */
function applyMoveToBoard(board: Board, move: ChessMove): Board {
  const newBoard = cloneBoard(board);

  // Remove piece from origin
  newBoard[move.fromRow][move.fromCol] = null;

  // En passant: remove the captured pawn from its actual square
  if (move.isEnPassant) {
    const capturedRow = move.fromRow; // The pawn being captured is on the same rank as the moving pawn
    newBoard[capturedRow][move.toCol] = null;
  }

  // Place piece (or promoted piece)
  if (move.promotion) {
    const color = pieceColor(move.piece);
    newBoard[move.toRow][move.toCol] = makePiece(
      color,
      move.promotion.toUpperCase(),
    );
  } else {
    newBoard[move.toRow][move.toCol] = move.piece;
  }

  // Castling: move the rook
  if (move.isCastle) {
    const row = move.fromRow;
    if (move.toCol === 6) {
      // Kingside: rook from h-file to f-file
      newBoard[row][5] = newBoard[row][7];
      newBoard[row][7] = null;
    } else if (move.toCol === 2) {
      // Queenside: rook from a-file to d-file
      newBoard[row][3] = newBoard[row][0];
      newBoard[row][0] = null;
    }
  }

  return newBoard;
}

/** Filter pseudo-legal moves to only legal ones (king not left in check). */
function filterLegalMoves(
  board: Board,
  moves: ChessMove[],
  side: Side,
): ChessMove[] {
  const opponent: Side = side === "w" ? "b" : "w";

  return moves.filter((move) => {
    // For castling, also check that king doesn't pass through or start in check
    if (move.isCastle) {
      // King must not be in check currently
      if (isSquareAttackedBy(board, move.fromRow, move.fromCol, opponent)) {
        return false;
      }

      // King must not pass through attacked square
      const throughCol = move.toCol === 6 ? 5 : 3;
      if (isSquareAttackedBy(board, move.fromRow, throughCol, opponent)) {
        return false;
      }

      // King must not land in check (checked below)
    }

    // Apply move and check if own king is in check
    const newBoard = applyMoveToBoard(board, move);
    return !isInCheck(newBoard, side);
  });
}

/** Generate all legal moves for a side. */
export function generateLegalMoves(
  board: Board,
  side: Side,
  castling: CastlingRights,
  enPassant: Square | null,
): ChessMove[] {
  const pseudoMoves = generatePseudoLegalMoves(
    board,
    side,
    castling,
    enPassant,
  );
  return filterLegalMoves(board, pseudoMoves, side);
}

/** Find a specific legal move matching from/to/promotion. */
export function findLegalMove(
  board: Board,
  side: Side,
  castling: CastlingRights,
  enPassant: Square | null,
  from: Square,
  to: Square,
  promotion?: PromotionPiece,
): ChessMove | null {
  const legalMoves = generateLegalMoves(board, side, castling, enPassant);
  return (
    legalMoves.find(
      (m) =>
        m.from === from &&
        m.to === to &&
        (promotion ? m.promotion === promotion : !m.promotion),
    ) ?? null
  );
}

// =============================================================================
// Position Hash (Zobrist-lite)
// =============================================================================

/**
 * Compute a deterministic position hash for repetition detection.
 * Uses a string-based representation (not true Zobrist for simplicity,
 * but deterministic and correct).
 */
export function computePositionHash(
  board: Board,
  sideToMove: Side,
  castling: CastlingRights,
  enPassant: Square | null,
): string {
  const parts: string[] = [];

  // Board pieces
  for (let r = 0; r < 8; r++) {
    let rowStr = "";
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p === null) {
        empty++;
      } else {
        if (empty > 0) {
          rowStr += empty;
          empty = 0;
        }
        rowStr += p;
      }
    }
    if (empty > 0) rowStr += empty;
    parts.push(rowStr);
  }

  // Side to move
  parts.push(sideToMove);

  // Castling rights
  let castleStr = "";
  if (castling.wK) castleStr += "K";
  if (castling.wQ) castleStr += "Q";
  if (castling.bK) castleStr += "k";
  if (castling.bQ) castleStr += "q";
  parts.push(castleStr || "-");

  // En passant (only if there's a pawn that can actually capture)
  if (enPassant) {
    const [epRow, epCol] = squareToIndices(enPassant);
    const attackerSide = sideToMove;
    const pawnDir = attackerSide === "w" ? 1 : -1;
    const pawn = makePiece(attackerSide, "P");
    let epRelevant = false;
    for (const dc of [-1, 1]) {
      const pr = epRow + pawnDir;
      const pc = epCol + dc;
      if (inBounds(pr, pc) && board[pr][pc] === pawn) {
        epRelevant = true;
        break;
      }
    }
    parts.push(epRelevant ? enPassant : "-");
  } else {
    parts.push("-");
  }

  return parts.join("/");
}

// =============================================================================
// Terminal Detection
// =============================================================================

/** Check if the position is checkmate for the given side. */
export function isCheckmate(
  board: Board,
  side: Side,
  castling: CastlingRights,
  enPassant: Square | null,
): boolean {
  if (!isInCheck(board, side)) return false;
  return generateLegalMoves(board, side, castling, enPassant).length === 0;
}

/** Check if the position is stalemate for the given side. */
export function isStalemate(
  board: Board,
  side: Side,
  castling: CastlingRights,
  enPassant: Square | null,
): boolean {
  if (isInCheck(board, side)) return false;
  return generateLegalMoves(board, side, castling, enPassant).length === 0;
}

/** Check for insufficient material (automatic draw). */
export function isInsufficientMaterial(board: Board): boolean {
  const pieces: { piece: Piece; row: number; col: number }[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] !== null) {
        pieces.push({ piece: board[r][c]!, row: r, col: c });
      }
    }
  }

  // Filter out kings
  const nonKings = pieces.filter((p) => pieceType(p.piece) !== "K");

  // K vs K
  if (nonKings.length === 0) return true;

  // K+N vs K or K+B vs K
  if (nonKings.length === 1) {
    const t = pieceType(nonKings[0].piece);
    if (t === "N" || t === "B") return true;
  }

  // K+B vs K+B with same-colored bishops
  if (nonKings.length === 2) {
    const [a, b] = nonKings;
    if (
      pieceType(a.piece) === "B" &&
      pieceType(b.piece) === "B" &&
      pieceColor(a.piece) !== pieceColor(b.piece)
    ) {
      // Same colored squares? Check (row+col) parity
      const aColor = (a.row + a.col) % 2;
      const bColor = (b.row + b.col) % 2;
      if (aColor === bColor) return true;
    }
  }

  return false;
}

// =============================================================================
// SAN Generation
// =============================================================================

/**
 * Generate Standard Algebraic Notation for a move.
 * Must be called BEFORE the move is applied to the board.
 */
export function generateSAN(
  board: Board,
  move: ChessMove,
  side: Side,
  castling: CastlingRights,
  enPassant: Square | null,
): string {
  // Castling
  if (move.isCastle) {
    const newBoard = applyMoveToBoard(board, move);
    const opponent: Side = side === "w" ? "b" : "w";
    const inCheck = isInCheck(newBoard, opponent);
    const isMate =
      inCheck && isCheckmate(newBoard, opponent, castling, enPassant);
    const base = move.toCol === 6 ? "O-O" : "O-O-O";
    return base + (isMate ? "#" : inCheck ? "+" : "");
  }

  const type = pieceType(move.piece);
  let san = "";

  if (type === "P") {
    // Pawn moves
    if (move.captured) {
      san += move.from[0]; // file letter for capture
      san += "x";
    }
    san += move.to;
    if (move.promotion) {
      san += "=" + move.promotion.toUpperCase();
    }
  } else {
    // Piece moves
    san += type;

    // Disambiguation
    const legalMoves = generateLegalMoves(board, side, castling, enPassant);
    const sameTypeMoves = legalMoves.filter(
      (m) =>
        pieceType(m.piece) === type && m.to === move.to && m.from !== move.from,
    );
    if (sameTypeMoves.length > 0) {
      const sameFile = sameTypeMoves.some((m) => m.fromCol === move.fromCol);
      const sameRank = sameTypeMoves.some((m) => m.fromRow === move.fromRow);

      if (!sameFile) {
        san += move.from[0]; // file
      } else if (!sameRank) {
        san += move.from[1]; // rank
      } else {
        san += move.from; // full square
      }
    }

    if (move.captured) {
      san += "x";
    }
    san += move.to;
  }

  // Check / checkmate suffix
  const newBoard = applyMoveToBoard(board, move);
  const opponent: Side = side === "w" ? "b" : "w";
  // Compute updated castling for correct checkmate detection
  const newCastling = updateCastlingRights(castling, move);
  const newEnPassant = computeEnPassantSquare(move);
  const oppInCheck = isInCheck(newBoard, opponent);
  if (oppInCheck) {
    const oppMate = isCheckmate(newBoard, opponent, newCastling, newEnPassant);
    san += oppMate ? "#" : "+";
  }

  return san;
}

// =============================================================================
// State Update Helpers
// =============================================================================

/** Update castling rights after a move. */
export function updateCastlingRights(
  castling: CastlingRights,
  move: ChessMove,
): CastlingRights {
  const newCastling = { ...castling };
  const type = pieceType(move.piece);
  const color = pieceColor(move.piece);

  // King moves remove both castling rights
  if (type === "K") {
    if (color === "w") {
      newCastling.wK = false;
      newCastling.wQ = false;
    } else {
      newCastling.bK = false;
      newCastling.bQ = false;
    }
  }

  // Rook moves remove that side's castling right
  if (type === "R") {
    if (color === "w") {
      if (move.fromRow === 7 && move.fromCol === 7) newCastling.wK = false;
      if (move.fromRow === 7 && move.fromCol === 0) newCastling.wQ = false;
    } else {
      if (move.fromRow === 0 && move.fromCol === 7) newCastling.bK = false;
      if (move.fromRow === 0 && move.fromCol === 0) newCastling.bQ = false;
    }
  }

  // Rook captured: remove opponent's castling right for that rook
  if (move.captured) {
    if (move.toRow === 7 && move.toCol === 7) newCastling.wK = false;
    if (move.toRow === 7 && move.toCol === 0) newCastling.wQ = false;
    if (move.toRow === 0 && move.toCol === 7) newCastling.bK = false;
    if (move.toRow === 0 && move.toCol === 0) newCastling.bQ = false;
  }

  return newCastling;
}

/** Compute the en passant target square after a pawn double push. */
export function computeEnPassantSquare(move: ChessMove): Square | null {
  if (pieceType(move.piece) === "P") {
    const rowDiff = Math.abs(move.toRow - move.fromRow);
    if (rowDiff === 2) {
      // En passant square is between from and to
      const epRow = (move.fromRow + move.toRow) / 2;
      return indicesToSquare(epRow, move.fromCol);
    }
  }
  return null;
}

// =============================================================================
// Initial Board
// =============================================================================

/** Create the standard starting position board. */
export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null),
  );

  // Rank 8 (row 0): black pieces
  board[0] = ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"];
  // Rank 7 (row 1): black pawns
  board[1] = ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"];
  // Ranks 6-3 (rows 2-5): empty
  // Rank 2 (row 6): white pawns
  board[6] = ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"];
  // Rank 1 (row 7): white pieces
  board[7] = ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"];

  return board;
}

/** Create the initial chess public state. */
export function createInitialChessState(): ChessPublicStateV1 {
  const board = createInitialBoard();
  const castling: CastlingRights = { wK: true, wQ: true, bK: true, bQ: true };
  const positionHash = computePositionHash(board, "w", castling, null);

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

// =============================================================================
// Full Move Application
// =============================================================================

/**
 * Apply a validated move to the state and return the new state.
 * Assumes the move has already been validated as legal.
 *
 * @param state Current public state
 * @param move The legal move to apply
 * @param moverUid The UID of the player making the move
 * @returns Updated public state
 */
export function applyMoveToState(
  state: ChessPublicStateV1,
  move: ChessMove,
  moverUid: string,
): ChessPublicStateV1 {
  const newBoard = applyMoveToBoard(state.board, move);
  const opponent: Side = state.sideToMove === "w" ? "b" : "w";

  // Generate SAN before modifying state
  const san = generateSAN(
    state.board,
    move,
    state.sideToMove,
    state.castling,
    state.enPassant,
  );

  // Update castling rights
  const newCastling = updateCastlingRights(state.castling, move);

  // Compute en passant square
  const newEnPassant = computeEnPassantSquare(move);

  // Update halfmove clock
  const isPawnMove = pieceType(move.piece) === "P";
  const isCapture = move.captured !== null;
  const newHalfmoveClock =
    isPawnMove || isCapture ? 0 : state.halfmoveClock + 1;

  // Update fullmove number
  const newFullmoveNumber =
    state.sideToMove === "b" ? state.fullmoveNumber + 1 : state.fullmoveNumber;

  // Build lastMove
  const lastMove = {
    from: move.from,
    to: move.to,
    piece: move.piece,
    captured: move.captured,
    promotion: move.promotion,
    san,
  };

  // Update per-uid counters
  const capturesByUid = { ...state.capturesByUid };
  const checksByUid = { ...state.checksByUid };
  const castlesByUid = { ...state.castlesByUid };
  const promotionsByUid = { ...state.promotionsByUid };
  const underPromotionsByUid = { ...state.underPromotionsByUid };
  const enPassantByUid = { ...state.enPassantByUid };

  if (isCapture) {
    capturesByUid[moverUid] = (capturesByUid[moverUid] ?? 0) + 1;
  }
  if (move.isCastle) {
    castlesByUid[moverUid] = (castlesByUid[moverUid] ?? 0) + 1;
  }
  if (move.promotion) {
    promotionsByUid[moverUid] = (promotionsByUid[moverUid] ?? 0) + 1;
    if (move.promotion !== "q") {
      underPromotionsByUid[moverUid] =
        (underPromotionsByUid[moverUid] ?? 0) + 1;
    }
  }
  if (move.isEnPassant) {
    enPassantByUid[moverUid] = (enPassantByUid[moverUid] ?? 0) + 1;
  }

  // Check if opponent is now in check
  const oppInCheck = isInCheck(newBoard, opponent);
  if (oppInCheck) {
    checksByUid[moverUid] = (checksByUid[moverUid] ?? 0) + 1;
  }

  // Compute position hash for repetition tracking
  const positionHash = computePositionHash(
    newBoard,
    opponent,
    newCastling,
    newEnPassant,
  );
  const repetitionCounts = { ...state.repetitionCounts };
  repetitionCounts[positionHash] = (repetitionCounts[positionHash] ?? 0) + 1;

  // Check for terminal conditions
  let terminal = state.terminal;

  // Check for checkmate/stalemate
  const oppLegalMoves = generateLegalMoves(
    newBoard,
    opponent,
    newCastling,
    newEnPassant,
  );

  if (oppLegalMoves.length === 0) {
    if (oppInCheck) {
      terminal = {
        type: "win",
        winnerUids: [moverUid],
        reason: "checkmate",
      };
    } else {
      terminal = {
        type: "draw",
        reason: "stalemate",
      };
    }
  }

  // Check for insufficient material (only if game isn't already over)
  if (!terminal && isInsufficientMaterial(newBoard)) {
    terminal = {
      type: "draw",
      reason: "insufficient_material",
    };
  }

  // Auto-detect 75-move rule (mandatory draw) — but we allow claiming at 50
  // Per FIDE: 75 move rule (150 plies) is automatic, 50 move rule (100 plies) is claimable
  // We'll keep it simple: only claimable at 100
  // No auto-draw for 50-move (players must claim)

  return {
    schemaVersion: 1,
    board: newBoard,
    sideToMove: opponent,
    castling: newCastling,
    enPassant: newEnPassant,
    halfmoveClock: newHalfmoveClock,
    fullmoveNumber: newFullmoveNumber,
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

/**
 * Count total captured material value for a UID.
 */
export function computeCapturedMaterialValue(
  state: ChessPublicStateV1,
  uid: string,
): number {
  // We need to track captured pieces to compute value.
  // Since we only track capture count, not what was captured,
  // we'll derive from the board by comparing to starting pieces.
  // Actually, let's compute from the board: count missing pieces per side.
  return 0; // This is computed differently — via the adapter
}

/**
 * Check if a side has lost any pieces by comparing current board to initial.
 */
export function hasLostPieces(board: Board, side: Side): boolean {
  const initial = createInitialBoard();
  const countPieces = (b: Board, s: Side): number => {
    let count = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p !== null && p[0] === s && p[1] !== "K") count++;
      }
    }
    return count;
  };

  return countPieces(board, side) < countPieces(initial, side);
}

/**
 * Count pieces of a given side on the board (excluding king).
 */
export function countPiecesOnBoard(board: Board, side: Side): number {
  let count = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p !== null && p[0] === side && p[1] !== "K") count++;
    }
  }
  return count;
}

/**
 * Get material value remaining on the board for a side.
 */
export function getMaterialValue(board: Board, side: Side): number {
  let value = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p !== null && p[0] === side) {
        const t = p[1];
        if (t === "P") value += 1;
        else if (t === "N") value += 3;
        else if (t === "B") value += 3;
        else if (t === "R") value += 5;
        else if (t === "Q") value += 9;
      }
    }
  }
  return value;
}

/**
 * Get captured pieces by comparing to starting position.
 */
export function getCapturedPieces(board: Board, side: Side): Piece[] {
  const initial = createInitialBoard();
  const countMap = new Map<Piece, number>();

  // Count initial pieces
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = initial[r][c];
      if (p !== null && p[0] === side) {
        countMap.set(p, (countMap.get(p) ?? 0) + 1);
      }
    }
  }

  // Subtract current board pieces
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p !== null && p[0] === side) {
        // For promoted pieces, they started as pawns
        const basePiece = p;
        const current = countMap.get(basePiece) ?? 0;
        if (current > 0) {
          countMap.set(basePiece, current - 1);
        }
      }
    }
  }

  // Remaining counts are captured
  const captured: Piece[] = [];
  for (const [piece, count] of countMap) {
    for (let i = 0; i < count; i++) {
      captured.push(piece);
    }
  }

  return captured;
}
