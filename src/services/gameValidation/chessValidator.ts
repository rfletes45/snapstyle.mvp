/**
 * Chess Validator Service
 *
 * Provides pure functions for chess move validation.
 * Note: In production, consider using chess.js library for complete rules.
 * This implementation covers core rules for testing demonstration.
 *
 * FEN Notation: piece positions / active color / castling / en passant / halfmove / fullmove
 * Example: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
 *
 * @see __tests__/games/chess/chessValidator.test.ts
 */

// =============================================================================
// Types
// =============================================================================

export interface ChessMove {
  from: string; // e.g., "e2"
  to: string; // e.g., "e4"
  promotion?: "q" | "r" | "b" | "n"; // For pawn promotion
}

export interface ChessSquare {
  file: string; // a-h
  rank: number; // 1-8
}

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type PieceColor = "w" | "b";

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
}

export interface ParsedFEN {
  board: (ChessPiece | null)[][]; // 8x8, [rank][file] indexed 0-7
  activeColor: PieceColor;
  castling: {
    whiteKingside: boolean;
    whiteQueenside: boolean;
    blackKingside: boolean;
    blackQueenside: boolean;
  };
  enPassant: string | null; // e.g., "e3" or null
  halfmoveClock: number;
  fullmoveNumber: number;
}

// =============================================================================
// FEN Parsing
// =============================================================================

/**
 * Parse a FEN string into a structured board representation
 */
export function parseFEN(fen: string): ParsedFEN {
  const parts = fen.split(" ");
  const [position, activeColor, castling, enPassant, halfmove, fullmove] =
    parts;

  // Parse board position
  const board: (ChessPiece | null)[][] = [];
  const ranks = position.split("/");

  for (let r = 0; r < 8; r++) {
    const rank: (ChessPiece | null)[] = [];
    const rankStr = ranks[r];

    for (const char of rankStr) {
      if (/[1-8]/.test(char)) {
        // Empty squares
        for (let i = 0; i < parseInt(char); i++) {
          rank.push(null);
        }
      } else {
        // Piece
        const color: PieceColor = char === char.toUpperCase() ? "w" : "b";
        const type = char.toLowerCase() as PieceType;
        rank.push({ type, color });
      }
    }
    board.push(rank);
  }

  return {
    board,
    activeColor: activeColor as PieceColor,
    castling: {
      whiteKingside: castling.includes("K"),
      whiteQueenside: castling.includes("Q"),
      blackKingside: castling.includes("k"),
      blackQueenside: castling.includes("q"),
    },
    enPassant: enPassant === "-" ? null : enPassant,
    halfmoveClock: parseInt(halfmove) || 0,
    fullmoveNumber: parseInt(fullmove) || 1,
  };
}

// =============================================================================
// Square Helpers
// =============================================================================

/**
 * Convert algebraic notation to array indices
 * "e4" -> { file: 4, rank: 4 } (0-indexed)
 */
export function squareToIndices(square: string): {
  file: number;
  rank: number;
} {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = 8 - parseInt(square[1]);
  return { file, rank };
}

/**
 * Convert array indices to algebraic notation
 */
export function indicesToSquare(file: number, rank: number): string {
  return String.fromCharCode("a".charCodeAt(0) + file) + (8 - rank);
}

/**
 * Get piece at a square from parsed FEN
 */
export function getPieceAt(
  board: ParsedFEN["board"],
  square: string,
): ChessPiece | null {
  const { file, rank } = squareToIndices(square);
  if (rank < 0 || rank > 7 || file < 0 || file > 7) return null;
  return board[rank][file];
}

// =============================================================================
// Move Generation Helpers
// =============================================================================

/**
 * Check if a square is attacked by the given color
 */
export function isSquareAttacked(
  board: ParsedFEN["board"],
  square: string,
  byColor: PieceColor,
): boolean {
  const { file: targetFile, rank: targetRank } = squareToIndices(square);

  // Check all squares for attacking pieces
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece || piece.color !== byColor) continue;

      const from = indicesToSquare(file, rank);
      // Check if this piece can attack the target (simplified)
      if (canPieceAttack(board, from, square, piece)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if a specific piece can attack a target square
 */
function canPieceAttack(
  board: ParsedFEN["board"],
  from: string,
  to: string,
  piece: ChessPiece,
): boolean {
  const { file: fromFile, rank: fromRank } = squareToIndices(from);
  const { file: toFile, rank: toRank } = squareToIndices(to);
  const fileDiff = toFile - fromFile;
  const rankDiff = toRank - fromRank;

  switch (piece.type) {
    case "p": {
      // Pawns attack diagonally
      const direction = piece.color === "w" ? -1 : 1;
      return Math.abs(fileDiff) === 1 && rankDiff === direction;
    }
    case "n":
      // Knights move in L-shape
      return (
        (Math.abs(fileDiff) === 2 && Math.abs(rankDiff) === 1) ||
        (Math.abs(fileDiff) === 1 && Math.abs(rankDiff) === 2)
      );
    case "b":
      // Bishops move diagonally
      if (Math.abs(fileDiff) !== Math.abs(rankDiff)) return false;
      return isPathClear(board, from, to);
    case "r":
      // Rooks move in straight lines
      if (fileDiff !== 0 && rankDiff !== 0) return false;
      return isPathClear(board, from, to);
    case "q":
      // Queens move like rook or bishop
      if (
        fileDiff !== 0 &&
        rankDiff !== 0 &&
        Math.abs(fileDiff) !== Math.abs(rankDiff)
      )
        return false;
      return isPathClear(board, from, to);
    case "k":
      // Kings move one square in any direction
      return Math.abs(fileDiff) <= 1 && Math.abs(rankDiff) <= 1;
    default:
      return false;
  }
}

/**
 * Check if path between two squares is clear (for sliding pieces)
 */
function isPathClear(
  board: ParsedFEN["board"],
  from: string,
  to: string,
): boolean {
  const { file: fromFile, rank: fromRank } = squareToIndices(from);
  const { file: toFile, rank: toRank } = squareToIndices(to);

  const fileStep = Math.sign(toFile - fromFile);
  const rankStep = Math.sign(toRank - fromRank);

  let file = fromFile + fileStep;
  let rank = fromRank + rankStep;

  while (file !== toFile || rank !== toRank) {
    if (board[rank][file] !== null) return false;
    file += fileStep;
    rank += rankStep;
  }
  return true;
}

/**
 * Find the king's position for a given color
 */
export function findKing(
  board: ParsedFEN["board"],
  color: PieceColor,
): string | null {
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.type === "k" && piece.color === color) {
        return indicesToSquare(file, rank);
      }
    }
  }
  return null;
}

// =============================================================================
// Check Detection
// =============================================================================

/**
 * Check if the current side to move is in check
 */
export function isCheck(fen: string): boolean {
  const parsed = parseFEN(fen);
  const kingSquare = findKing(parsed.board, parsed.activeColor);
  if (!kingSquare) return false;

  const opponentColor = parsed.activeColor === "w" ? "b" : "w";
  return isSquareAttacked(parsed.board, kingSquare, opponentColor);
}

/**
 * Check if the current side to move is in checkmate
 */
export function isCheckmate(fen: string): boolean {
  if (!isCheck(fen)) return false;

  // In checkmate if in check and no legal moves
  return !hasLegalMoves(fen);
}

/**
 * Check if the current side to move is in stalemate
 */
export function isStalemate(fen: string): boolean {
  if (isCheck(fen)) return false;

  // In stalemate if not in check but no legal moves
  return !hasLegalMoves(fen);
}

/**
 * Check if the current side has any legal moves
 */
function hasLegalMoves(fen: string): boolean {
  const parsed = parseFEN(fen);

  // Try all possible moves for active color
  for (let fromRank = 0; fromRank < 8; fromRank++) {
    for (let fromFile = 0; fromFile < 8; fromFile++) {
      const piece = parsed.board[fromRank][fromFile];
      if (!piece || piece.color !== parsed.activeColor) continue;

      const from = indicesToSquare(fromFile, fromRank);

      // Try all destination squares
      for (let toRank = 0; toRank < 8; toRank++) {
        for (let toFile = 0; toFile < 8; toFile++) {
          const to = indicesToSquare(toFile, toRank);
          if (isLegalMove(fen, { from, to })) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// =============================================================================
// Move Validation
// =============================================================================

/**
 * Check if a move is legal in the given position
 */
export function isLegalMove(fen: string, move: ChessMove): boolean {
  const parsed = parseFEN(fen);
  const { from, to } = move;

  // Get the piece being moved
  const piece = getPieceAt(parsed.board, from);
  if (!piece) return false;

  // Must be the active color's piece
  if (piece.color !== parsed.activeColor) return false;

  // Can't capture own piece
  const targetPiece = getPieceAt(parsed.board, to);
  if (targetPiece && targetPiece.color === piece.color) return false;

  // Validate piece-specific movement
  if (!isValidPieceMove(parsed, move, piece)) {
    return false;
  }

  // After making the move, own king can't be in check
  const boardAfterMove = makeMove(parsed.board, move);
  const kingSquare = findKing(boardAfterMove, parsed.activeColor);
  if (!kingSquare) return false;

  const opponentColor = parsed.activeColor === "w" ? "b" : "w";
  if (isSquareAttacked(boardAfterMove, kingSquare, opponentColor)) {
    return false;
  }

  return true;
}

/**
 * Validate piece-specific movement rules
 */
function isValidPieceMove(
  parsed: ParsedFEN,
  move: ChessMove,
  piece: ChessPiece,
): boolean {
  const { from, to } = move;
  const { file: fromFile, rank: fromRank } = squareToIndices(from);
  const { file: toFile, rank: toRank } = squareToIndices(to);
  const fileDiff = toFile - fromFile;
  const rankDiff = toRank - fromRank;
  const targetPiece = getPieceAt(parsed.board, to);

  switch (piece.type) {
    case "p":
      return isValidPawnMove(
        parsed,
        from,
        to,
        piece.color,
        targetPiece,
        fileDiff,
        rankDiff,
      );
    case "n":
      return (
        (Math.abs(fileDiff) === 2 && Math.abs(rankDiff) === 1) ||
        (Math.abs(fileDiff) === 1 && Math.abs(rankDiff) === 2)
      );
    case "b":
      return (
        Math.abs(fileDiff) === Math.abs(rankDiff) &&
        fileDiff !== 0 &&
        isPathClear(parsed.board, from, to)
      );
    case "r":
      return (
        (fileDiff === 0 || rankDiff === 0) &&
        (fileDiff !== 0 || rankDiff !== 0) &&
        isPathClear(parsed.board, from, to)
      );
    case "q":
      return (
        (fileDiff === 0 ||
          rankDiff === 0 ||
          Math.abs(fileDiff) === Math.abs(rankDiff)) &&
        (fileDiff !== 0 || rankDiff !== 0) &&
        isPathClear(parsed.board, from, to)
      );
    case "k":
      return isValidKingMove(parsed, move, fileDiff, rankDiff);
    default:
      return false;
  }
}

/**
 * Validate pawn movement
 */
function isValidPawnMove(
  parsed: ParsedFEN,
  from: string,
  to: string,
  color: PieceColor,
  targetPiece: ChessPiece | null,
  fileDiff: number,
  rankDiff: number,
): boolean {
  const direction = color === "w" ? -1 : 1;
  const startRank = color === "w" ? 6 : 1;
  const { rank: fromRank } = squareToIndices(from);

  // Single step forward
  if (fileDiff === 0 && rankDiff === direction && !targetPiece) {
    return true;
  }

  // Double step from starting position
  if (
    fileDiff === 0 &&
    rankDiff === 2 * direction &&
    fromRank === startRank &&
    !targetPiece &&
    isPathClear(parsed.board, from, to)
  ) {
    return true;
  }

  // Diagonal capture
  if (Math.abs(fileDiff) === 1 && rankDiff === direction) {
    // Normal capture
    if (targetPiece && targetPiece.color !== color) {
      return true;
    }
    // En passant
    if (parsed.enPassant === to) {
      return true;
    }
  }

  return false;
}

/**
 * Validate king movement including castling
 */
function isValidKingMove(
  parsed: ParsedFEN,
  move: ChessMove,
  fileDiff: number,
  rankDiff: number,
): boolean {
  // Normal king move
  if (Math.abs(fileDiff) <= 1 && Math.abs(rankDiff) <= 1) {
    return fileDiff !== 0 || rankDiff !== 0;
  }

  // Castling
  if (Math.abs(fileDiff) === 2 && rankDiff === 0) {
    return isValidCastling(parsed, move);
  }

  return false;
}

/**
 * Validate castling move
 */
function isValidCastling(parsed: ParsedFEN, move: ChessMove): boolean {
  const { from, to } = move;
  const { file: toFile } = squareToIndices(to);
  const isKingside = toFile === 6;
  const isQueenside = toFile === 2;

  if (!isKingside && !isQueenside) return false;

  // Check castling rights
  if (parsed.activeColor === "w") {
    if (isKingside && !parsed.castling.whiteKingside) return false;
    if (isQueenside && !parsed.castling.whiteQueenside) return false;
  } else {
    if (isKingside && !parsed.castling.blackKingside) return false;
    if (isQueenside && !parsed.castling.blackQueenside) return false;
  }

  // King must not be in check
  if (isCheck(fenFromParsed(parsed))) return false;

  // Path must be clear
  const rank = parsed.activeColor === "w" ? 7 : 0;
  const pathSquares = isKingside
    ? [indicesToSquare(5, rank), indicesToSquare(6, rank)]
    : [
        indicesToSquare(3, rank),
        indicesToSquare(2, rank),
        indicesToSquare(1, rank),
      ];

  for (const square of pathSquares) {
    if (getPieceAt(parsed.board, square) !== null) return false;
  }

  // King must not pass through or end up in check
  const throughSquares = isKingside
    ? [indicesToSquare(5, rank), indicesToSquare(6, rank)]
    : [indicesToSquare(3, rank), indicesToSquare(2, rank)];

  const opponentColor = parsed.activeColor === "w" ? "b" : "w";
  for (const square of throughSquares) {
    if (isSquareAttacked(parsed.board, square, opponentColor)) return false;
  }

  return true;
}

// =============================================================================
// Board Manipulation
// =============================================================================

/**
 * Make a move on the board (returns new board, doesn't validate)
 */
export function makeMove(
  board: ParsedFEN["board"],
  move: ChessMove,
): ParsedFEN["board"] {
  const { from, to } = move;
  const { file: fromFile, rank: fromRank } = squareToIndices(from);
  const { file: toFile, rank: toRank } = squareToIndices(to);

  // Clone the board
  const newBoard = board.map((row) => [...row]);

  // Move the piece
  const piece = newBoard[fromRank][fromFile];
  newBoard[fromRank][fromFile] = null;
  newBoard[toRank][toFile] = piece;

  // Handle promotion
  if (piece?.type === "p" && (toRank === 0 || toRank === 7)) {
    newBoard[toRank][toFile] = {
      type: move.promotion || "q",
      color: piece.color,
    };
  }

  return newBoard;
}

/**
 * Convert parsed FEN back to string (simplified - position only)
 */
function fenFromParsed(parsed: ParsedFEN): string {
  const rows: string[] = [];
  for (const row of parsed.board) {
    let rowStr = "";
    let emptyCount = 0;
    for (const cell of row) {
      if (cell === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        const char =
          cell.color === "w"
            ? cell.type.toUpperCase()
            : cell.type.toLowerCase();
        rowStr += char;
      }
    }
    if (emptyCount > 0) rowStr += emptyCount;
    rows.push(rowStr);
  }

  const castlingStr =
    (parsed.castling.whiteKingside ? "K" : "") +
      (parsed.castling.whiteQueenside ? "Q" : "") +
      (parsed.castling.blackKingside ? "k" : "") +
      (parsed.castling.blackQueenside ? "q" : "") || "-";

  return `${rows.join("/")} ${parsed.activeColor} ${castlingStr} ${parsed.enPassant || "-"} ${parsed.halfmoveClock} ${parsed.fullmoveNumber}`;
}

// =============================================================================
// Exports for Testing
// =============================================================================

export { fenFromParsed };
