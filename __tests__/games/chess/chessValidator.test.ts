/**
 * Chess Validator Unit Tests
 * Phase 7: Testing Requirements
 *
 * Tests for:
 * - FEN parsing
 * - Pawn movement (single, double, capture, en passant)
 * - Piece movement (knight, bishop, rook, queen, king)
 * - Castling
 * - Check detection
 * - Checkmate detection
 * - Stalemate detection
 *
 * @see src/services/gameValidation/chessValidator.ts
 */

import {
  findKing,
  getPieceAt,
  indicesToSquare,
  isCheck,
  isCheckmate,
  isLegalMove,
  isStalemate,
  parseFEN,
  squareToIndices,
} from "@/services/gameValidation/chessValidator";

// =============================================================================
// Test Fixtures
// =============================================================================

// Standard starting position
const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// After 1. e4
const AFTER_E4_FEN =
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

// Position for en passant (white pawn on e5, black just played d7-d5)
const EN_PASSANT_FEN =
  "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3";

// Fool's mate position (black has Qh4#)
const FOOLS_MATE_SETUP =
  "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2";

// After fool's mate - white is checkmated
const FOOLS_MATE_FINAL =
  "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";

// Clear board for castling tests
const CASTLING_READY_FEN = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";

// No castling rights
const NO_CASTLING_FEN = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w - - 0 1";

// Stalemate position - black king only legal square blocked
const STALEMATE_FEN = "k7/8/1K6/8/8/8/8/8 b - - 0 1";

// =============================================================================
// FEN Parsing Tests
// =============================================================================

describe("Chess Move Validation", () => {
  describe("FEN Parsing", () => {
    it("should parse starting position correctly", () => {
      const parsed = parseFEN(STARTING_FEN);

      expect(parsed.activeColor).toBe("w");
      expect(parsed.castling.whiteKingside).toBe(true);
      expect(parsed.castling.whiteQueenside).toBe(true);
      expect(parsed.castling.blackKingside).toBe(true);
      expect(parsed.castling.blackQueenside).toBe(true);
      expect(parsed.enPassant).toBeNull();
      expect(parsed.halfmoveClock).toBe(0);
      expect(parsed.fullmoveNumber).toBe(1);
    });

    it("should parse board pieces correctly", () => {
      const parsed = parseFEN(STARTING_FEN);

      // White pieces on rank 1
      expect(getPieceAt(parsed.board, "a1")).toEqual({ type: "r", color: "w" });
      expect(getPieceAt(parsed.board, "e1")).toEqual({ type: "k", color: "w" });

      // Black pieces on rank 8
      expect(getPieceAt(parsed.board, "a8")).toEqual({ type: "r", color: "b" });
      expect(getPieceAt(parsed.board, "e8")).toEqual({ type: "k", color: "b" });

      // Empty squares
      expect(getPieceAt(parsed.board, "e4")).toBeNull();
    });

    it("should parse en passant square", () => {
      const parsed = parseFEN(AFTER_E4_FEN);

      expect(parsed.enPassant).toBe("e3");
    });

    it("should parse position with no castling rights", () => {
      const parsed = parseFEN(NO_CASTLING_FEN);

      expect(parsed.castling.whiteKingside).toBe(false);
      expect(parsed.castling.whiteQueenside).toBe(false);
      expect(parsed.castling.blackKingside).toBe(false);
      expect(parsed.castling.blackQueenside).toBe(false);
    });
  });

  // ===========================================================================
  // Square Conversion Tests
  // ===========================================================================

  describe("Square Conversion", () => {
    it("should convert algebraic to indices correctly", () => {
      expect(squareToIndices("a1")).toEqual({ file: 0, rank: 7 });
      expect(squareToIndices("h8")).toEqual({ file: 7, rank: 0 });
      expect(squareToIndices("e4")).toEqual({ file: 4, rank: 4 });
    });

    it("should convert indices to algebraic correctly", () => {
      expect(indicesToSquare(0, 7)).toBe("a1");
      expect(indicesToSquare(7, 0)).toBe("h8");
      expect(indicesToSquare(4, 4)).toBe("e4");
    });
  });

  // ===========================================================================
  // Pawn Movement Tests
  // ===========================================================================

  describe("Pawn Moves", () => {
    it("should allow pawn to move one square forward", () => {
      expect(isLegalMove(STARTING_FEN, { from: "e2", to: "e3" })).toBe(true);
    });

    it("should allow pawn to move two squares from starting position", () => {
      expect(isLegalMove(STARTING_FEN, { from: "e2", to: "e4" })).toBe(true);
    });

    it("should not allow pawn to move two squares after first move", () => {
      // After 1. e4, white pawn is on e4
      const afterE4 =
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2";
      expect(isLegalMove(afterE4, { from: "e4", to: "e6" })).toBe(false);
    });

    it("should allow pawn capture diagonally", () => {
      // Position where white pawn on e4 can capture black pawn on d5
      const capturePosition =
        "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";
      expect(isLegalMove(capturePosition, { from: "e4", to: "d5" })).toBe(true);
    });

    it("should allow en passant capture", () => {
      expect(isLegalMove(EN_PASSANT_FEN, { from: "e5", to: "d6" })).toBe(true);
    });

    it("should not allow pawn to move backwards", () => {
      const position =
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
      expect(isLegalMove(position, { from: "e4", to: "e3" })).toBe(false);
    });

    it("should not allow pawn to capture forward", () => {
      // Pawn blocked by piece directly ahead
      const blockedPosition =
        "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
      expect(isLegalMove(blockedPosition, { from: "e4", to: "e5" })).toBe(
        false,
      );
    });
  });

  // ===========================================================================
  // Knight Movement Tests
  // ===========================================================================

  describe("Knight Moves", () => {
    it("should allow knight L-shape move", () => {
      expect(isLegalMove(STARTING_FEN, { from: "g1", to: "f3" })).toBe(true);
      expect(isLegalMove(STARTING_FEN, { from: "g1", to: "h3" })).toBe(true);
      expect(isLegalMove(STARTING_FEN, { from: "b1", to: "c3" })).toBe(true);
    });

    it("should allow knight to jump over pieces", () => {
      // Knight can jump from b1 to c3 even with pawns in the way
      expect(isLegalMove(STARTING_FEN, { from: "b1", to: "c3" })).toBe(true);
    });

    it("should not allow knight to move in straight line", () => {
      expect(isLegalMove(STARTING_FEN, { from: "g1", to: "g3" })).toBe(false);
    });
  });

  // ===========================================================================
  // Bishop Movement Tests
  // ===========================================================================

  describe("Bishop Moves", () => {
    it("should allow bishop to move diagonally", () => {
      // Position with open diagonal
      const openPosition =
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1";
      // After 1. e4, f1 bishop can move
      expect(isLegalMove(openPosition, { from: "f1", to: "c4" })).toBe(true);
    });

    it("should not allow bishop to move through pieces", () => {
      // At start, bishops are blocked
      expect(isLegalMove(STARTING_FEN, { from: "f1", to: "c4" })).toBe(false);
    });

    it("should not allow bishop to move in straight line", () => {
      const openPosition =
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1";
      expect(isLegalMove(openPosition, { from: "f1", to: "f4" })).toBe(false);
    });
  });

  // ===========================================================================
  // Rook Movement Tests
  // ===========================================================================

  describe("Rook Moves", () => {
    it("should allow rook to move in straight line", () => {
      // Open position for rook
      const rookPosition = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
      expect(isLegalMove(rookPosition, { from: "a1", to: "a3" })).toBe(false); // Blocked
      expect(isLegalMove(rookPosition, { from: "a1", to: "b1" })).toBe(true);
    });

    it("should not allow rook to move diagonally", () => {
      const rookPosition = "8/8/8/8/4R3/8/8/4K2k w - - 0 1";
      expect(isLegalMove(rookPosition, { from: "e4", to: "f5" })).toBe(false);
    });
  });

  // ===========================================================================
  // Queen Movement Tests
  // ===========================================================================

  describe("Queen Moves", () => {
    it("should allow queen to move diagonally", () => {
      const queenPosition = "8/8/8/8/4Q3/8/8/4K2k w - - 0 1";
      expect(isLegalMove(queenPosition, { from: "e4", to: "h7" })).toBe(true);
    });

    it("should allow queen to move in straight line", () => {
      const queenPosition = "8/8/8/8/4Q3/8/8/4K2k w - - 0 1";
      expect(isLegalMove(queenPosition, { from: "e4", to: "e8" })).toBe(true);
    });

    it("should not allow queen to move like knight", () => {
      const queenPosition = "8/8/8/8/4Q3/8/8/4K2k w - - 0 1";
      expect(isLegalMove(queenPosition, { from: "e4", to: "f6" })).toBe(false);
    });
  });

  // ===========================================================================
  // King Movement Tests
  // ===========================================================================

  describe("King Moves", () => {
    it("should allow king to move one square", () => {
      const kingPosition = "8/8/8/8/4K3/8/8/7k w - - 0 1";
      expect(isLegalMove(kingPosition, { from: "e4", to: "e5" })).toBe(true);
      expect(isLegalMove(kingPosition, { from: "e4", to: "f5" })).toBe(true);
    });

    it("should not allow king to move two squares (except castling)", () => {
      const kingPosition = "8/8/8/8/4K3/8/8/7k w - - 0 1";
      expect(isLegalMove(kingPosition, { from: "e4", to: "e6" })).toBe(false);
    });
  });

  // ===========================================================================
  // Castling Tests
  // ===========================================================================

  describe("Castling", () => {
    it("should allow kingside castling when path is clear", () => {
      expect(isLegalMove(CASTLING_READY_FEN, { from: "e1", to: "g1" })).toBe(
        true,
      );
    });

    it("should allow queenside castling when path is clear", () => {
      expect(isLegalMove(CASTLING_READY_FEN, { from: "e1", to: "c1" })).toBe(
        true,
      );
    });

    it("should not allow castling without rights", () => {
      expect(isLegalMove(NO_CASTLING_FEN, { from: "e1", to: "g1" })).toBe(
        false,
      );
    });

    it("should not allow castling through check", () => {
      // Rook on e8 controls e1, can't castle through
      const throughCheck = "4r3/8/8/8/8/8/8/R3K2R w KQ - 0 1";
      expect(isLegalMove(throughCheck, { from: "e1", to: "g1" })).toBe(false);
    });

    it("should not allow castling when in check", () => {
      const inCheck = "4r3/8/8/8/8/8/8/R3K2R w KQ - 0 1";
      expect(isLegalMove(inCheck, { from: "e1", to: "g1" })).toBe(false);
    });

    it("should not allow castling when path is blocked", () => {
      const blocked = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R2QK2R w KQkq - 0 1";
      expect(isLegalMove(blocked, { from: "e1", to: "c1" })).toBe(false);
    });
  });

  // ===========================================================================
  // Check Detection Tests
  // ===========================================================================

  describe("Check Detection", () => {
    it("should detect check by queen", () => {
      expect(isCheck(FOOLS_MATE_FINAL)).toBe(true);
    });

    it("should not detect check in normal position", () => {
      expect(isCheck(STARTING_FEN)).toBe(false);
    });

    it("should detect check by knight", () => {
      // Knight checking king
      const knightCheck = "4k3/8/5N2/8/8/8/8/4K3 b - - 0 1";
      expect(isCheck(knightCheck)).toBe(true);
    });
  });

  // ===========================================================================
  // Checkmate Detection Tests
  // ===========================================================================

  describe("Checkmate Detection", () => {
    it("should detect fool's mate checkmate", () => {
      expect(isCheckmate(FOOLS_MATE_FINAL)).toBe(true);
    });

    it("should not detect checkmate when not in check", () => {
      expect(isCheckmate(STARTING_FEN)).toBe(false);
    });

    it("should not detect checkmate when check can be blocked", () => {
      // Check that can be blocked
      const blockableCheck = "r3k3/8/8/8/8/8/4R3/4K3 b - - 0 1";
      expect(isCheckmate(blockableCheck)).toBe(false);
    });

    it("should detect back rank mate", () => {
      const backRankMate = "6k1/5ppp/8/8/8/8/8/R3K3 b - - 0 1";
      expect(isCheckmate(backRankMate)).toBe(true);
    });
  });

  // ===========================================================================
  // Stalemate Detection Tests
  // ===========================================================================

  describe("Stalemate Detection", () => {
    it("should detect stalemate when no legal moves", () => {
      // King trapped in corner with no legal moves, not in check
      const stalemate = "k7/2K5/8/8/8/8/8/8 b - - 0 1";
      expect(isStalemate(stalemate)).toBe(true);
    });

    it("should not detect stalemate when in check", () => {
      expect(isStalemate(FOOLS_MATE_FINAL)).toBe(false); // It's checkmate
    });

    it("should not detect stalemate when moves available", () => {
      expect(isStalemate(STARTING_FEN)).toBe(false);
    });
  });

  // ===========================================================================
  // Move Legality Tests (edge cases)
  // ===========================================================================

  describe("Move Legality Edge Cases", () => {
    it("should not allow moving opponent's piece", () => {
      // White to move, try to move black piece
      expect(isLegalMove(STARTING_FEN, { from: "e7", to: "e5" })).toBe(false);
    });

    it("should not allow capturing own piece", () => {
      expect(isLegalMove(STARTING_FEN, { from: "e2", to: "d2" })).toBe(false);
    });

    it("should not allow move that leaves king in check", () => {
      // Pinned piece - bishop pinned by rook
      const pinned = "4k3/8/8/8/8/4B3/8/r3K3 w - - 0 1";
      expect(isLegalMove(pinned, { from: "e3", to: "d4" })).toBe(false);
    });

    it("should allow capturing checking piece", () => {
      // King can capture checking piece
      const canCapture = "4k3/8/8/8/8/8/3q4/3QK3 w - - 0 1";
      expect(isLegalMove(canCapture, { from: "d1", to: "d2" })).toBe(true);
    });
  });

  // ===========================================================================
  // Find King Tests
  // ===========================================================================

  describe("Find King", () => {
    it("should find white king", () => {
      const parsed = parseFEN(STARTING_FEN);
      expect(findKing(parsed.board, "w")).toBe("e1");
    });

    it("should find black king", () => {
      const parsed = parseFEN(STARTING_FEN);
      expect(findKing(parsed.board, "b")).toBe("e8");
    });
  });
});
