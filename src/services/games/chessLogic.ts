/**
 * Chess Game Logic
 *
 * Complete chess logic including:
 * - All piece movement rules
 * - Check, checkmate, and stalemate detection
 * - Special moves: castling, en passant, pawn promotion
 * - FEN notation support
 * - Algebraic notation generation
 *
 * @see src/types/turnBased.ts for type definitions
 * @see src/services/gameValidation/chessValidator.ts for core validation
 */

import {
  ChessBoard,
  ChessColor,
  ChessGameState,
  ChessMove,
  ChessPiece,
  ChessPieceType,
  ChessPosition,
  createInitialChessBoard,
  getPieceSymbol,
  positionToAlgebraic,
} from "@/types/turnBased";

// =============================================================================
// Initial State
// =============================================================================

/**
 * Create initial chess game state
 */
export function createInitialChessState(
  player1Id: string,
  player2Id: string,
): ChessGameState {
  const board = createInitialChessBoard();

  return {
    board,
    currentTurn: "white",
    castlingRights: {
      whiteKingside: true,
      whiteQueenside: true,
      blackKingside: true,
      blackQueenside: true,
    },
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  };
}

// =============================================================================
// Piece Movement
// =============================================================================

/**
 * Apply a move to a board and return the new board (for testing legality)
 * This does NOT check for checkmate/stalemate to avoid recursion
 */
function applyMoveToBoard(
  board: ChessBoard,
  from: ChessPosition,
  to: ChessPosition,
  enPassantTarget: ChessPosition | null,
): ChessBoard {
  const newBoard = board.map((row) =>
    row.map((cell) => (cell ? { ...cell } : null)),
  );
  const piece = newBoard[from.row][from.col];

  if (!piece) return newBoard;

  // Move the piece
  newBoard[to.row][to.col] = { ...piece, hasMoved: true };
  newBoard[from.row][from.col] = null;

  // Handle en passant capture
  if (
    piece.type === "pawn" &&
    enPassantTarget &&
    to.row === enPassantTarget.row &&
    to.col === enPassantTarget.col
  ) {
    const capturedPawnRow = piece.color === "white" ? to.row - 1 : to.row + 1;
    newBoard[capturedPawnRow][to.col] = null;
  }

  // Handle castling
  if (piece.type === "king" && Math.abs(to.col - from.col) === 2) {
    const row = from.row;
    if (to.col === 6) {
      // Kingside
      newBoard[row][5] = newBoard[row][7];
      newBoard[row][7] = null;
      if (newBoard[row][5]) newBoard[row][5]!.hasMoved = true;
    } else if (to.col === 2) {
      // Queenside
      newBoard[row][3] = newBoard[row][0];
      newBoard[row][0] = null;
      if (newBoard[row][3]) newBoard[row][3]!.hasMoved = true;
    }
  }

  return newBoard;
}

/**
 * Get all valid moves for a piece at a given position
 */
export function getValidMoves(
  state: ChessGameState,
  from: ChessPosition,
): ChessPosition[] {
  const piece = state.board[from.row][from.col];
  if (!piece) return [];

  // Generate all pseudo-legal moves
  const moves = getPseudoLegalMoves(state, from, piece);

  // Filter out moves that would leave the king in check
  // Use applyMoveToBoard instead of makeMove to avoid infinite recursion
  return moves.filter((to) => {
    const testBoard = applyMoveToBoard(
      state.board,
      from,
      to,
      state.enPassantTarget,
    );
    return !isKingInCheck(testBoard, piece.color);
  });
}

/**
 * Get pseudo-legal moves (doesn't check if king is left in check)
 */
function getPseudoLegalMoves(
  state: ChessGameState,
  from: ChessPosition,
  piece: ChessPiece,
): ChessPosition[] {
  switch (piece.type) {
    case "pawn":
      return getPawnMoves(state, from, piece);
    case "knight":
      return getKnightMoves(state, from, piece);
    case "bishop":
      return getBishopMoves(state, from, piece);
    case "rook":
      return getRookMoves(state, from, piece);
    case "queen":
      return getQueenMoves(state, from, piece);
    case "king":
      return getKingMoves(state, from, piece);
    default:
      return [];
  }
}

/**
 * Get pawn moves including en passant and double move from start
 */
function getPawnMoves(
  state: ChessGameState,
  from: ChessPosition,
  piece: ChessPiece,
): ChessPosition[] {
  const moves: ChessPosition[] = [];
  const direction = piece.color === "white" ? 1 : -1;
  const startRow = piece.color === "white" ? 1 : 6;

  // Single forward move
  const oneForward = { row: from.row + direction, col: from.col };
  if (isInBounds(oneForward) && !state.board[oneForward.row][oneForward.col]) {
    moves.push(oneForward);

    // Double forward from start
    if (from.row === startRow) {
      const twoForward = { row: from.row + 2 * direction, col: from.col };
      if (!state.board[twoForward.row][twoForward.col]) {
        moves.push(twoForward);
      }
    }
  }

  // Diagonal captures
  for (const colOffset of [-1, 1]) {
    const capturePos = { row: from.row + direction, col: from.col + colOffset };
    if (isInBounds(capturePos)) {
      const targetPiece = state.board[capturePos.row][capturePos.col];
      if (targetPiece && targetPiece.color !== piece.color) {
        moves.push(capturePos);
      }

      // En passant
      if (
        state.enPassantTarget &&
        capturePos.row === state.enPassantTarget.row &&
        capturePos.col === state.enPassantTarget.col
      ) {
        moves.push(capturePos);
      }
    }
  }

  return moves;
}

/**
 * Get knight moves
 */
function getKnightMoves(
  state: ChessGameState,
  from: ChessPosition,
  piece: ChessPiece,
): ChessPosition[] {
  const offsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];

  return offsets
    .map(([dr, dc]) => ({ row: from.row + dr, col: from.col + dc }))
    .filter(
      (pos) =>
        isInBounds(pos) &&
        (!state.board[pos.row][pos.col] ||
          state.board[pos.row][pos.col]!.color !== piece.color),
    );
}

/**
 * Get bishop moves (diagonals)
 */
function getBishopMoves(
  state: ChessGameState,
  from: ChessPosition,
  piece: ChessPiece,
): ChessPosition[] {
  const directions = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  return getSlidingMoves(state, from, piece, directions);
}

/**
 * Get rook moves (straight lines)
 */
function getRookMoves(
  state: ChessGameState,
  from: ChessPosition,
  piece: ChessPiece,
): ChessPosition[] {
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  return getSlidingMoves(state, from, piece, directions);
}

/**
 * Get queen moves (diagonals + straight lines)
 */
function getQueenMoves(
  state: ChessGameState,
  from: ChessPosition,
  piece: ChessPiece,
): ChessPosition[] {
  const directions = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];
  return getSlidingMoves(state, from, piece, directions);
}

/**
 * Get sliding piece moves (bishop, rook, queen)
 */
function getSlidingMoves(
  state: ChessGameState,
  from: ChessPosition,
  piece: ChessPiece,
  directions: number[][],
): ChessPosition[] {
  const moves: ChessPosition[] = [];

  for (const [dr, dc] of directions) {
    let row = from.row + dr;
    let col = from.col + dc;

    while (row >= 0 && row < 8 && col >= 0 && col < 8) {
      const targetPiece = state.board[row][col];

      if (!targetPiece) {
        moves.push({ row, col });
      } else {
        if (targetPiece.color !== piece.color) {
          moves.push({ row, col });
        }
        break;
      }

      row += dr;
      col += dc;
    }
  }

  return moves;
}

/**
 * Get king moves including castling
 */
function getKingMoves(
  state: ChessGameState,
  from: ChessPosition,
  piece: ChessPiece,
): ChessPosition[] {
  const moves: ChessPosition[] = [];
  const offsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  // Normal king moves
  for (const [dr, dc] of offsets) {
    const pos = { row: from.row + dr, col: from.col + dc };
    if (
      isInBounds(pos) &&
      (!state.board[pos.row][pos.col] ||
        state.board[pos.row][pos.col]!.color !== piece.color)
    ) {
      moves.push(pos);
    }
  }

  // Castling
  if (!piece.hasMoved && !state.isCheck) {
    const row = piece.color === "white" ? 0 : 7;

    // Kingside castling
    const canCastleKingside =
      piece.color === "white"
        ? state.castlingRights.whiteKingside
        : state.castlingRights.blackKingside;

    if (
      canCastleKingside &&
      !state.board[row][5] &&
      !state.board[row][6] &&
      state.board[row][7]?.type === "rook" &&
      !state.board[row][7]?.hasMoved
    ) {
      // Check that king doesn't pass through check
      if (
        !isSquareAttacked(state.board, { row, col: 5 }, piece.color) &&
        !isSquareAttacked(state.board, { row, col: 6 }, piece.color)
      ) {
        moves.push({ row, col: 6 });
      }
    }

    // Queenside castling
    const canCastleQueenside =
      piece.color === "white"
        ? state.castlingRights.whiteQueenside
        : state.castlingRights.blackQueenside;

    if (
      canCastleQueenside &&
      !state.board[row][1] &&
      !state.board[row][2] &&
      !state.board[row][3] &&
      state.board[row][0]?.type === "rook" &&
      !state.board[row][0]?.hasMoved
    ) {
      // Check that king doesn't pass through check
      if (
        !isSquareAttacked(state.board, { row, col: 2 }, piece.color) &&
        !isSquareAttacked(state.board, { row, col: 3 }, piece.color)
      ) {
        moves.push({ row, col: 2 });
      }
    }
  }

  return moves;
}

// =============================================================================
// Move Execution
// =============================================================================

/**
 * Apply a move to the game state and return new state
 */
export function makeMove(
  state: ChessGameState,
  move: {
    from: ChessPosition;
    to: ChessPosition;
    piece: ChessPieceType;
    promotion?: ChessPieceType;
  },
): ChessGameState {
  const newBoard = state.board.map((row) =>
    row.map((cell) => (cell ? { ...cell } : null)),
  );
  const piece = newBoard[move.from.row][move.from.col];

  if (!piece) {
    return state;
  }

  // Move the piece
  newBoard[move.to.row][move.to.col] = { ...piece, hasMoved: true };
  newBoard[move.from.row][move.from.col] = null;

  // Handle pawn promotion
  if (piece.type === "pawn" && (move.to.row === 0 || move.to.row === 7)) {
    newBoard[move.to.row][move.to.col] = {
      type: move.promotion || "queen",
      color: piece.color,
      hasMoved: true,
    };
  }

  // Handle en passant capture
  if (
    piece.type === "pawn" &&
    state.enPassantTarget &&
    move.to.row === state.enPassantTarget.row &&
    move.to.col === state.enPassantTarget.col
  ) {
    const capturedPawnRow =
      piece.color === "white" ? move.to.row - 1 : move.to.row + 1;
    newBoard[capturedPawnRow][move.to.col] = null;
  }

  // Handle castling
  if (piece.type === "king" && Math.abs(move.to.col - move.from.col) === 2) {
    const row = move.from.row;
    if (move.to.col === 6) {
      // Kingside
      newBoard[row][5] = newBoard[row][7];
      newBoard[row][7] = null;
      if (newBoard[row][5]) newBoard[row][5]!.hasMoved = true;
    } else if (move.to.col === 2) {
      // Queenside
      newBoard[row][3] = newBoard[row][0];
      newBoard[row][0] = null;
      if (newBoard[row][3]) newBoard[row][3]!.hasMoved = true;
    }
  }

  // Calculate new en passant target
  let enPassantTarget: ChessPosition | null = null;
  if (piece.type === "pawn" && Math.abs(move.to.row - move.from.row) === 2) {
    enPassantTarget = {
      row: (move.from.row + move.to.row) / 2,
      col: move.from.col,
    };
  }

  // Update castling rights
  const newCastlingRights = { ...state.castlingRights };
  if (piece.type === "king") {
    if (piece.color === "white") {
      newCastlingRights.whiteKingside = false;
      newCastlingRights.whiteQueenside = false;
    } else {
      newCastlingRights.blackKingside = false;
      newCastlingRights.blackQueenside = false;
    }
  }
  if (piece.type === "rook") {
    if (move.from.row === 0 && move.from.col === 0)
      newCastlingRights.whiteQueenside = false;
    if (move.from.row === 0 && move.from.col === 7)
      newCastlingRights.whiteKingside = false;
    if (move.from.row === 7 && move.from.col === 0)
      newCastlingRights.blackQueenside = false;
    if (move.from.row === 7 && move.from.col === 7)
      newCastlingRights.blackKingside = false;
  }

  const nextTurn: ChessColor =
    state.currentTurn === "white" ? "black" : "white";

  // Create new state
  const newState: ChessGameState = {
    board: newBoard,
    currentTurn: nextTurn,
    castlingRights: newCastlingRights,
    enPassantTarget,
    halfMoveClock:
      piece.type === "pawn" || state.board[move.to.row][move.to.col]
        ? 0
        : state.halfMoveClock + 1,
    fullMoveNumber:
      state.currentTurn === "black"
        ? state.fullMoveNumber + 1
        : state.fullMoveNumber,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    fen: "", // Will be updated below
  };

  // Check for check/checkmate/stalemate
  newState.isCheck = isKingInCheck(newBoard, nextTurn);
  const hasLegalMoves = playerHasLegalMoves(newState, nextTurn);

  if (!hasLegalMoves) {
    if (newState.isCheck) {
      newState.isCheckmate = true;
    } else {
      newState.isStalemate = true;
      newState.isDraw = true;
    }
  }

  // Check for 50-move rule
  if (newState.halfMoveClock >= 100) {
    newState.isDraw = true;
  }

  // Check for insufficient material
  if (hasInsufficientMaterial(newBoard)) {
    newState.isDraw = true;
  }

  newState.fen = generateFEN(newState);

  return newState;
}

/**
 * Create a ChessMove object with notation
 */
export function createChessMove(
  state: ChessGameState,
  from: ChessPosition,
  to: ChessPosition,
  promotion?: ChessPieceType,
): ChessMove {
  const piece = state.board[from.row][from.col];
  if (!piece) {
    throw new Error("No piece at from position");
  }

  const capture = state.board[to.row][to.col]?.type;
  const isEnPassant =
    piece.type === "pawn" &&
    state.enPassantTarget?.row === to.row &&
    state.enPassantTarget?.col === to.col;

  let castling: "kingside" | "queenside" | undefined;
  if (piece.type === "king" && Math.abs(to.col - from.col) === 2) {
    castling = to.col === 6 ? "kingside" : "queenside";
  }

  // Apply the move to check for check/checkmate
  const newState = makeMove(state, {
    from,
    to,
    piece: piece.type,
    promotion,
  });

  const notation = generateAlgebraicNotation(
    state,
    from,
    to,
    piece,
    capture || (isEnPassant ? "pawn" : undefined),
    promotion,
    castling,
    newState.isCheck,
    newState.isCheckmate,
  );

  return {
    from,
    to,
    piece: piece.type,
    capture: capture || (isEnPassant ? "pawn" : undefined),
    promotion,
    castling,
    enPassant: isEnPassant,
    check: newState.isCheck,
    checkmate: newState.isCheckmate,
    notation,
    timestamp: Date.now(),
  };
}

// =============================================================================
// Check Detection
// =============================================================================

/**
 * Check if a square is attacked by any piece of a given color
 */
export function isSquareAttacked(
  board: ChessBoard,
  square: ChessPosition,
  defendingColor: ChessColor,
): boolean {
  const attackingColor = defendingColor === "white" ? "black" : "white";

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== attackingColor) continue;

      if (canPieceAttackSquare(board, { row, col }, square, piece)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a specific piece can attack a square
 */
function canPieceAttackSquare(
  board: ChessBoard,
  from: ChessPosition,
  to: ChessPosition,
  piece: ChessPiece,
): boolean {
  const dr = to.row - from.row;
  const dc = to.col - from.col;

  switch (piece.type) {
    case "pawn": {
      const direction = piece.color === "white" ? 1 : -1;
      return dr === direction && Math.abs(dc) === 1;
    }
    case "knight":
      return (
        (Math.abs(dr) === 2 && Math.abs(dc) === 1) ||
        (Math.abs(dr) === 1 && Math.abs(dc) === 2)
      );
    case "bishop":
      return (
        Math.abs(dr) === Math.abs(dc) &&
        dr !== 0 &&
        isPathClear(board, from, to)
      );
    case "rook":
      return (
        (dr === 0 || dc === 0) &&
        (dr !== 0 || dc !== 0) &&
        isPathClear(board, from, to)
      );
    case "queen":
      return (
        (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) &&
        (dr !== 0 || dc !== 0) &&
        isPathClear(board, from, to)
      );
    case "king":
      return Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0);
    default:
      return false;
  }
}

/**
 * Check if path between two squares is clear (for sliding pieces)
 */
function isPathClear(
  board: ChessBoard,
  from: ChessPosition,
  to: ChessPosition,
): boolean {
  const dr = Math.sign(to.row - from.row);
  const dc = Math.sign(to.col - from.col);

  let row = from.row + dr;
  let col = from.col + dc;

  while (row !== to.row || col !== to.col) {
    if (board[row][col]) return false;
    row += dr;
    col += dc;
  }

  return true;
}

/**
 * Check if the king of a given color is in check
 */
export function isKingInCheck(board: ChessBoard, color: ChessColor): boolean {
  // Find the king
  let kingPos: ChessPosition | null = null;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece?.type === "king" && piece.color === color) {
        kingPos = { row, col };
        break;
      }
    }
    if (kingPos) break;
  }

  if (!kingPos) return false;

  return isSquareAttacked(board, kingPos, color);
}

/**
 * Check if a player has any legal moves
 */
function playerHasLegalMoves(
  state: ChessGameState,
  color: ChessColor,
): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = state.board[row][col];
      if (piece?.color === color) {
        const moves = getValidMoves(state, { row, col });
        if (moves.length > 0) return true;
      }
    }
  }
  return false;
}

/**
 * Check if the position has insufficient material for checkmate
 * Draw conditions:
 * - King vs King
 * - King + Bishop vs King
 * - King + Knight vs King
 * - King + Bishop vs King + Bishop (same color bishops)
 */
export function hasInsufficientMaterial(board: ChessBoard): boolean {
  const whitePieces: { type: ChessPieceType; row: number; col: number }[] = [];
  const blackPieces: { type: ChessPieceType; row: number; col: number }[] = [];

  // Collect all pieces
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const pieceInfo = { type: piece.type, row, col };
        if (piece.color === "white") {
          whitePieces.push(pieceInfo);
        } else {
          blackPieces.push(pieceInfo);
        }
      }
    }
  }

  // If either side has a pawn, rook, or queen, there's sufficient material
  const hasSufficientPiece = (
    pieces: { type: ChessPieceType; row: number; col: number }[],
  ) =>
    pieces.some(
      (p) => p.type === "pawn" || p.type === "rook" || p.type === "queen",
    );

  if (hasSufficientPiece(whitePieces) || hasSufficientPiece(blackPieces)) {
    return false;
  }

  // Count minor pieces (bishops and knights)
  const whiteMinor = whitePieces.filter(
    (p) => p.type === "bishop" || p.type === "knight",
  );
  const blackMinor = blackPieces.filter(
    (p) => p.type === "bishop" || p.type === "knight",
  );

  // King vs King
  if (whiteMinor.length === 0 && blackMinor.length === 0) {
    return true;
  }

  // King + single minor piece vs King
  if (
    (whiteMinor.length === 1 && blackMinor.length === 0) ||
    (whiteMinor.length === 0 && blackMinor.length === 1)
  ) {
    return true;
  }

  // King + Bishop vs King + Bishop (same color squares)
  if (
    whiteMinor.length === 1 &&
    blackMinor.length === 1 &&
    whiteMinor[0].type === "bishop" &&
    blackMinor[0].type === "bishop"
  ) {
    // Check if bishops are on same color squares
    const whiteBishopColor = (whiteMinor[0].row + whiteMinor[0].col) % 2;
    const blackBishopColor = (blackMinor[0].row + blackMinor[0].col) % 2;
    if (whiteBishopColor === blackBishopColor) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// FEN Notation
// =============================================================================

/**
 * Generate FEN string from game state
 */
export function generateFEN(state: ChessGameState): string {
  const rows: string[] = [];

  // Board position
  for (let row = 7; row >= 0; row--) {
    let rowStr = "";
    let emptyCount = 0;

    for (let col = 0; col < 8; col++) {
      const piece = state.board[row][col];
      if (!piece) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        const symbol = pieceToFENSymbol(piece);
        rowStr +=
          piece.color === "white" ? symbol.toUpperCase() : symbol.toLowerCase();
      }
    }

    if (emptyCount > 0) {
      rowStr += emptyCount;
    }
    rows.push(rowStr);
  }

  const position = rows.join("/");

  // Active color
  const activeColor = state.currentTurn === "white" ? "w" : "b";

  // Castling rights
  let castling = "";
  if (state.castlingRights.whiteKingside) castling += "K";
  if (state.castlingRights.whiteQueenside) castling += "Q";
  if (state.castlingRights.blackKingside) castling += "k";
  if (state.castlingRights.blackQueenside) castling += "q";
  if (castling === "") castling = "-";

  // En passant
  const enPassant = state.enPassantTarget
    ? positionToAlgebraic(state.enPassantTarget)
    : "-";

  return `${position} ${activeColor} ${castling} ${enPassant} ${state.halfMoveClock} ${state.fullMoveNumber}`;
}

/**
 * Convert piece to FEN symbol
 */
function pieceToFENSymbol(piece: ChessPiece): string {
  const symbols: Record<ChessPieceType, string> = {
    king: "k",
    queen: "q",
    rook: "r",
    bishop: "b",
    knight: "n",
    pawn: "p",
  };
  return symbols[piece.type];
}

// =============================================================================
// Algebraic Notation
// =============================================================================

/**
 * Generate algebraic notation for a move
 */
function generateAlgebraicNotation(
  state: ChessGameState,
  from: ChessPosition,
  to: ChessPosition,
  piece: ChessPiece,
  capture: ChessPieceType | undefined,
  promotion: ChessPieceType | undefined,
  castling: "kingside" | "queenside" | undefined,
  isCheck: boolean,
  isCheckmate: boolean,
): string {
  // Castling
  if (castling === "kingside")
    return isCheckmate ? "O-O#" : isCheck ? "O-O+" : "O-O";
  if (castling === "queenside")
    return isCheckmate ? "O-O-O#" : isCheck ? "O-O-O+" : "O-O-O";

  let notation = "";

  // Piece symbol (pawns have no symbol)
  if (piece.type !== "pawn") {
    notation += getPieceSymbol(piece.type);
  }

  // Disambiguation for pieces that can move to the same square
  if (piece.type !== "pawn") {
    const disambig = getDisambiguation(state, from, to, piece);
    notation += disambig;
  }

  // Capture
  if (capture) {
    if (piece.type === "pawn") {
      notation += String.fromCharCode(97 + from.col); // File for pawn captures
    }
    notation += "x";
  }

  // Destination square
  notation += positionToAlgebraic(to);

  // Pawn promotion
  if (promotion) {
    notation += "=" + getPieceSymbol(promotion);
  }

  // Check or checkmate
  if (isCheckmate) {
    notation += "#";
  } else if (isCheck) {
    notation += "+";
  }

  return notation;
}

/**
 * Get disambiguation string for moves where multiple pieces can move to the same square
 */
function getDisambiguation(
  state: ChessGameState,
  from: ChessPosition,
  to: ChessPosition,
  piece: ChessPiece,
): string {
  // Find all pieces of the same type and color that can move to the same square
  const sameTypePieces: ChessPosition[] = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (row === from.row && col === from.col) continue;
      const p = state.board[row][col];
      if (p?.type === piece.type && p.color === piece.color) {
        const moves = getValidMoves(state, { row, col });
        if (moves.some((m) => m.row === to.row && m.col === to.col)) {
          sameTypePieces.push({ row, col });
        }
      }
    }
  }

  if (sameTypePieces.length === 0) return "";

  // Check if file is unique
  const sameFile = sameTypePieces.some((p) => p.col === from.col);
  const sameRank = sameTypePieces.some((p) => p.row === from.row);

  if (!sameFile) {
    return String.fromCharCode(97 + from.col);
  } else if (!sameRank) {
    return (from.row + 1).toString();
  } else {
    return String.fromCharCode(97 + from.col) + (from.row + 1).toString();
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a position is within bounds
 */
function isInBounds(pos: ChessPosition): boolean {
  return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
}

/**
 * Get piece display character (Unicode chess symbols)
 */
export function getPieceDisplay(piece: ChessPiece): string {
  const symbols: Record<ChessColor, Record<ChessPieceType, string>> = {
    white: {
      king: "♔",
      queen: "♕",
      rook: "♖",
      bishop: "♗",
      knight: "♘",
      pawn: "♙",
    },
    black: {
      king: "♚",
      queen: "♛",
      rook: "♜",
      bishop: "♝",
      knight: "♞",
      pawn: "♟",
    },
  };
  return symbols[piece.color][piece.type];
}

/**
 * Check if a move is a valid move
 */
export function isValidMove(
  state: ChessGameState,
  from: ChessPosition,
  to: ChessPosition,
): boolean {
  const piece = state.board[from.row][from.col];
  if (!piece || piece.color !== state.currentTurn) return false;

  const validMoves = getValidMoves(state, from);
  return validMoves.some((m) => m.row === to.row && m.col === to.col);
}

/**
 * Check if a pawn move requires promotion
 */
export function requiresPromotion(
  state: ChessGameState,
  from: ChessPosition,
  to: ChessPosition,
): boolean {
  const piece = state.board[from.row][from.col];
  if (!piece || piece.type !== "pawn") return false;

  return to.row === 0 || to.row === 7;
}

/**
 * Get all pieces captured by a player
 */
export function getCapturedPieces(
  initialBoard: ChessBoard,
  currentBoard: ChessBoard,
  color: ChessColor,
): ChessPieceType[] {
  const initialPieces: ChessPieceType[] = [];
  const currentPieces: ChessPieceType[] = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const initial = initialBoard[row][col];
      const current = currentBoard[row][col];

      if (initial?.color === color) initialPieces.push(initial.type);
      if (current?.color === color) currentPieces.push(current.type);
    }
  }

  // Find pieces that are missing
  const captured: ChessPieceType[] = [];
  for (const piece of initialPieces) {
    const idx = currentPieces.indexOf(piece);
    if (idx === -1) {
      captured.push(piece);
    } else {
      currentPieces.splice(idx, 1);
    }
  }

  return captured;
}
