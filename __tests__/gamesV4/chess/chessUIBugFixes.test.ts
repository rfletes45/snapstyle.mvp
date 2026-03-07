/**
 * Chess UI Bug-Fix Regression Tests
 *
 * Tests the logic fixes made to the chess screen:
 * 1. Queued move uses engine promotion (not stale queuedMove.promotion)
 * 2. Queued moves are validated against hypothetical legal moves
 * 3. Queued promotion stores the chosen piece
 * 4. actionError priority in notice message
 *
 * These tests exercise pure logic extracted from ChessScreenV4's handlers
 * without mounting React components.
 */

import {
  createInitialChessState,
  generateLegalMoves,
} from "@/gamesV4/adapters/chess/chessEngine";
import type {
  ChessPublicStateV1,
  Piece,
  PromotionPiece,
  Square,
} from "@/gamesV4/adapters/chess/chessTypes";
import { squareToIndices } from "@/gamesV4/adapters/chess/chessTypes";

// =============================================================================
// Helpers
// =============================================================================

type Board = (Piece | null)[][];

function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
}

function setBoardPiece(board: Board, sq: Square, piece: Piece | null): void {
  const [r, c] = squareToIndices(sq);
  board[r][c] = piece;
}

function noCastling() {
  return { wK: false, wQ: false, bK: false, bQ: false };
}

// Simulate the auto-submit logic from ChessScreenV4's useEffect
function simulateQueueAutoSubmit(
  state: ChessPublicStateV1,
  queuedMove: { from: Square; to: Square; promotion?: PromotionPiece },
): {
  action: string;
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
} | null {
  const legal = generateLegalMoves(
    state.board,
    state.sideToMove,
    state.castling,
    state.enPassant,
  );
  const match = legal.find(
    (m) =>
      m.from === queuedMove.from &&
      m.to === queuedMove.to &&
      (!queuedMove.promotion || m.promotion === queuedMove.promotion),
  );

  if (match) {
    return {
      action: "move",
      from: match.from,
      to: match.to,
      promotion: match.promotion,
    };
  }
  return null; // move no longer legal
}

// Simulate the premove validation from handleSquareTap's !isMyTurn branch
function validatePremove(
  board: Board,
  myColor: "w" | "b",
  castling: ChessPublicStateV1["castling"],
  enPassant: Square | null,
  from: Square,
  to: Square,
): { isLegal: boolean; isPromotion: boolean } {
  const hypotheticalLegal = generateLegalMoves(
    board,
    myColor,
    castling,
    enPassant,
  );
  const targets = hypotheticalLegal.filter(
    (m) => m.from === from && m.to === to,
  );

  return {
    isLegal: targets.length > 0,
    isPromotion: targets.some((m) => m.promotion !== undefined),
  };
}

// Simulate the noticeMessage priority logic
function getNoticeMessage(opts: {
  actionError?: string | null;
  replayPly?: number | null;
  queuedMove?: boolean;
  pendingConfirm?: boolean;
}): string | null {
  if (opts.actionError) return opts.actionError;
  if (opts.replayPly !== null && opts.replayPly !== undefined)
    return "Replaying — tap board to return to live";
  if (opts.queuedMove) return "Move queued";
  if (opts.pendingConfirm) return "Confirm your move below";
  return null;
}

// =============================================================================
// Bug 3: Promotion payload — auto-submit must use engine's promotion value
// =============================================================================

describe("Queue auto-submit promotion fix", () => {
  it("sends engine promotion when queuedMove.promotion is undefined", () => {
    // Set up a position where white has a pawn on e7 ready to promote
    const board = emptyBoard();
    setBoardPiece(board, "e7" as Square, "wP");
    setBoardPiece(board, "e1" as Square, "wK");
    setBoardPiece(board, "e8" as Square, "bK"); // blocking e8
    setBoardPiece(board, "d8" as Square, null); // d8 free? actually king blocks e8
    // Let's make a simpler scenario: pawn on a7, king on e1 for white, king on h8 for black
    const board2 = emptyBoard();
    setBoardPiece(board2, "a7" as Square, "wP");
    setBoardPiece(board2, "e1" as Square, "wK");
    setBoardPiece(board2, "h8" as Square, "bK");

    const state: ChessPublicStateV1 = {
      board: board2,
      sideToMove: "w",
      castling: noCastling(),
      enPassant: null,
      halfmoveClock: 0,
      plyCount: 10,
      positionHash: "test",
      repetitionCounts: {},
      pendingDrawOfferByUid: null,
      lastMove: null,
      terminal: null,
    };

    // Queued move with NO promotion piece (the old bug)
    const queuedMove = { from: "a7" as Square, to: "a8" as Square };
    const payload = simulateQueueAutoSubmit(state, queuedMove);

    // Must send a valid promotion piece (engine defaults to queen variant first)
    expect(payload).not.toBeNull();
    expect(payload!.promotion).toBeDefined();
    expect(["q", "r", "b", "n"]).toContain(payload!.promotion);
  });

  it("sends the specific promotion piece when specified in queuedMove", () => {
    const board = emptyBoard();
    setBoardPiece(board, "a7" as Square, "wP");
    setBoardPiece(board, "e1" as Square, "wK");
    setBoardPiece(board, "h8" as Square, "bK");

    const state: ChessPublicStateV1 = {
      board,
      sideToMove: "w",
      castling: noCastling(),
      enPassant: null,
      halfmoveClock: 0,
      plyCount: 10,
      positionHash: "test",
      repetitionCounts: {},
      pendingDrawOfferByUid: null,
      lastMove: null,
      terminal: null,
    };

    // User explicitly chose knight promotion
    const queuedMove = {
      from: "a7" as Square,
      to: "a8" as Square,
      promotion: "n" as PromotionPiece,
    };
    const payload = simulateQueueAutoSubmit(state, queuedMove);

    expect(payload).not.toBeNull();
    expect(payload!.promotion).toBe("n");
  });

  it("returns null when queued move is no longer legal", () => {
    const board = emptyBoard();
    setBoardPiece(board, "e2" as Square, "wP");
    setBoardPiece(board, "e1" as Square, "wK");
    setBoardPiece(board, "e8" as Square, "bK");
    // e3 is blocked by black pawn
    setBoardPiece(board, "e3" as Square, "bP");

    const state: ChessPublicStateV1 = {
      board,
      sideToMove: "w",
      castling: noCastling(),
      enPassant: null,
      halfmoveClock: 0,
      plyCount: 10,
      positionHash: "test",
      repetitionCounts: {},
      pendingDrawOfferByUid: null,
      lastMove: null,
      terminal: null,
    };

    // Pawn queued to move to e3 but it's now blocked
    const queuedMove = { from: "e2" as Square, to: "e3" as Square };
    const payload = simulateQueueAutoSubmit(state, queuedMove);

    expect(payload).toBeNull();
  });
});

// =============================================================================
// Bug 2: Queued move legality — premoves validated against hypothetical
// =============================================================================

describe("Premove validation", () => {
  it("allows a legal premove target", () => {
    const state = createInitialChessState();
    // White pawn on e2 can move to e4
    const result = validatePremove(
      state.board as Board,
      "w",
      state.castling,
      state.enPassant,
      "e2" as Square,
      "e4" as Square,
    );
    expect(result.isLegal).toBe(true);
    expect(result.isPromotion).toBe(false);
  });

  it("rejects an illegal premove target", () => {
    const state = createInitialChessState();
    // White pawn on e2 cannot go to d5
    const result = validatePremove(
      state.board as Board,
      "w",
      state.castling,
      state.enPassant,
      "e2" as Square,
      "d5" as Square,
    );
    expect(result.isLegal).toBe(false);
  });

  it("detects promotion premoves", () => {
    const board = emptyBoard();
    setBoardPiece(board, "a7" as Square, "wP");
    setBoardPiece(board, "e1" as Square, "wK");
    setBoardPiece(board, "h8" as Square, "bK");

    const result = validatePremove(
      board,
      "w",
      noCastling(),
      null,
      "a7" as Square,
      "a8" as Square,
    );
    expect(result.isLegal).toBe(true);
    expect(result.isPromotion).toBe(true);
  });

  it("rejects premove when piece is not your color", () => {
    const state = createInitialChessState();
    // Trying to premove a black pawn as white — pieceColor check happens before this
    // but the legal move gen for "w" won't include moves from black pieces
    const result = validatePremove(
      state.board as Board,
      "w",
      state.castling,
      state.enPassant,
      "e7" as Square,
      "e5" as Square,
    );
    expect(result.isLegal).toBe(false);
  });
});

// =============================================================================
// Bug 3 (noticeMessage): actionError should have highest priority
// =============================================================================

describe("Notice message priority", () => {
  it("shows actionError over replay message", () => {
    const msg = getNoticeMessage({
      actionError: "Move failed",
      replayPly: 5,
    });
    expect(msg).toBe("Move failed");
  });

  it("shows actionError over queued move message", () => {
    const msg = getNoticeMessage({
      actionError: "Network error",
      queuedMove: true,
    });
    expect(msg).toBe("Network error");
  });

  it("shows replay message when no error", () => {
    const msg = getNoticeMessage({ replayPly: 3 });
    expect(msg).toContain("Replaying");
  });

  it("shows queued move when no error or replay", () => {
    const msg = getNoticeMessage({ queuedMove: true });
    expect(msg).toContain("queued");
  });

  it("returns null when nothing active", () => {
    const msg = getNoticeMessage({});
    expect(msg).toBeNull();
  });
});
