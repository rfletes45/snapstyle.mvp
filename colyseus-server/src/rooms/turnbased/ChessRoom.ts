/**
 * ChessRoom â€” Server-authoritative Chess
 *
 * Full chess with FEN, castling, en passant, promotion, check/checkmate,
 * stalemate, 50-move rule, insufficient material detection.
 *
 * Board encoding (GridCell.value):
 *   0=empty
 *   Positive = white:  1=pawn 2=knight 3=bishop 4=rook 5=queen 6=king
 *   Negative = black: -1=pawn -2=knight -3=bishop -4=rook -5=queen -6=king
 *
 * Extra state via GridCell.ownerId stores "hasMoved" flag as "1" or "".
 *
 * Extends TurnBasedRoom â€” uses fromâ†’to moves with extra.promotion.
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md Phase 3
 */

import { MoveRecord, TurnBasedPlayer } from "../../schemas/turnbased";
import { MovePayload, TurnBasedRoom, WinResult } from "../base/TurnBasedRoom";

// =============================================================================
// Piece encoding
// =============================================================================

const EMPTY = 0;
const W_PAWN = 1;
const W_KNIGHT = 2;
const W_BISHOP = 3;
const W_ROOK = 4;
const W_QUEEN = 5;
const W_KING = 6;
const B_PAWN = -1;
const B_KNIGHT = -2;
const B_BISHOP = -3;
const B_ROOK = -4;
const B_QUEEN = -5;
const B_KING = -6;

function isWhite(v: number): boolean {
  return v > 0;
}
function isBlackPiece(v: number): boolean {
  return v < 0;
}
function pieceColor(v: number): 0 | 1 {
  return v > 0 ? 0 : 1; // 0=white, 1=black
}
function absPiece(v: number): number {
  return Math.abs(v);
}

// FEN piece map
const FEN_MAP: Record<string, number> = {
  P: W_PAWN,
  N: W_KNIGHT,
  B: W_BISHOP,
  R: W_ROOK,
  Q: W_QUEEN,
  K: W_KING,
  p: B_PAWN,
  n: B_KNIGHT,
  b: B_BISHOP,
  r: B_ROOK,
  q: B_QUEEN,
  k: B_KING,
};

const PIECE_CHARS: Record<number, string> = {
  [W_PAWN]: "P",
  [W_KNIGHT]: "N",
  [W_BISHOP]: "B",
  [W_ROOK]: "R",
  [W_QUEEN]: "Q",
  [W_KING]: "K",
  [B_PAWN]: "p",
  [B_KNIGHT]: "n",
  [B_BISHOP]: "b",
  [B_ROOK]: "r",
  [B_QUEEN]: "q",
  [B_KING]: "k",
};

const PIECE_NOTATION: Record<number, string> = {
  1: "",
  2: "N",
  3: "B",
  4: "R",
  5: "Q",
  6: "K",
};

// =============================================================================
// Room
// =============================================================================

export class ChessRoom extends TurnBasedRoom {
  protected readonly gameTypeKey = "chess_game";
  protected readonly defaultBoardWidth = 8;
  protected readonly defaultBoardHeight = 8;

  // Extra state not in GridCell
  private castling = { wK: true, wQ: true, bK: true, bQ: true };
  private enPassantTarget: { row: number; col: number } | null = null;
  private halfMoveClock = 0;
  private fullMoveNumber = 1;

  // â”€â”€â”€ Board Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected initializeBoard(_options: Record<string, any>): void {
    // White pieces (player 0) on rows 0-1, Black (player 1) on rows 6-7
    const backRank = [
      W_ROOK,
      W_KNIGHT,
      W_BISHOP,
      W_QUEEN,
      W_KING,
      W_BISHOP,
      W_KNIGHT,
      W_ROOK,
    ];
    for (let c = 0; c < 8; c++) {
      this.state.setCell(0, c, backRank[c], ""); // white back rank
      this.state.setCell(1, c, W_PAWN, ""); // white pawns
      this.state.setCell(6, c, B_PAWN, ""); // black pawns
      this.state.setCell(7, c, -backRank[c], ""); // black back rank
    }
    this.castling = { wK: true, wQ: true, bK: true, bQ: true };
    this.enPassantTarget = null;
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
  }

  // â”€â”€â”€ Cell helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private getP(r: number, c: number): number {
    return this.state.getCell(r, c);
  }
  private setP(r: number, c: number, v: number, moved = true): void {
    this.state.setCell(r, c, v, moved ? "1" : "");
  }
  private hasMoved(r: number, c: number): boolean {
    const idx = r * 8 + c;
    return this.state.board[idx]?.ownerId === "1";
  }

  // â”€â”€â”€ Validate Move â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected validateMove(sessionId: string, move: MovePayload): boolean {
    const player = this.state.tbPlayers.get(sessionId);
    if (!player) return false;
    if (move.toRow === undefined || move.toCol === undefined) return false;

    const from = { row: move.row, col: move.col };
    const to = { row: move.toRow, col: move.toCol };
    const piece = this.getP(from.row, from.col);
    if (piece === EMPTY) return false;

    // Must be this player's piece
    const color = player.playerIndex; // 0=white, 1=black
    if (color === 0 && !isWhite(piece)) return false;
    if (color === 1 && !isBlackPiece(piece)) return false;

    // Check if this move is in the legal moves list
    const legalMoves = this.getLegalMoves(from, piece, color);
    const isLegal = legalMoves.some(
      (m) => m.row === to.row && m.col === to.col,
    );
    if (!isLegal) return false;

    // Promotion validation
    if (absPiece(piece) === 1) {
      const promoRow = color === 0 ? 7 : 0;
      if (to.row === promoRow) {
        const promo = move.extra?.promotion;
        if (!promo || !["queen", "rook", "bishop", "knight"].includes(promo)) {
          // Default to queen if not specified
          if (!move.extra) move.extra = {};
          move.extra.promotion = "queen";
        }
      }
    }

    return true;
  }

  // â”€â”€â”€ Apply Move â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected applyMove(sessionId: string, move: MovePayload): void {
    const player = this.state.tbPlayers.get(sessionId);
    if (!player) return;

    const from = { row: move.row, col: move.col };
    const to = { row: move.toRow!, col: move.toCol! };
    const piece = this.getP(from.row, from.col);
    const captured = this.getP(to.row, to.col);
    const color = player.playerIndex;
    const ap = absPiece(piece);

    // Track for half-move clock
    const isCapture = captured !== EMPTY;
    const isPawnMove = ap === 1;

    // Clear source
    this.setP(from.row, from.col, EMPTY, false);

    // Handle en passant capture
    let enPassantCapture = false;
    if (ap === 1 && this.enPassantTarget) {
      if (
        to.row === this.enPassantTarget.row &&
        to.col === this.enPassantTarget.col
      ) {
        const capturedPawnRow = color === 0 ? to.row - 1 : to.row + 1;
        this.setP(capturedPawnRow, to.col, EMPTY, false);
        enPassantCapture = true;
      }
    }

    // Handle castling
    let castlingNotation: string | undefined;
    if (ap === 6 && Math.abs(to.col - from.col) === 2) {
      if (to.col === 6) {
        // Kingside
        castlingNotation = "O-O";
        this.setP(from.row, 5, this.getP(from.row, 7));
        this.setP(from.row, 7, EMPTY, false);
      } else if (to.col === 2) {
        // Queenside
        castlingNotation = "O-O-O";
        this.setP(from.row, 3, this.getP(from.row, 0));
        this.setP(from.row, 0, EMPTY, false);
      }
    }

    // Place piece at destination
    let finalPiece = piece;

    // Pawn promotion
    if (ap === 1) {
      const promoRow = color === 0 ? 7 : 0;
      if (to.row === promoRow) {
        const promoType = move.extra?.promotion || "queen";
        const promoMap: Record<string, number> = {
          queen: 5,
          rook: 4,
          bishop: 3,
          knight: 2,
        };
        const promoVal = promoMap[promoType] || 5;
        finalPiece = color === 0 ? promoVal : -promoVal;
      }
    }

    this.setP(to.row, to.col, finalPiece);

    // Update en passant target
    this.enPassantTarget = null;
    if (ap === 1 && Math.abs(to.row - from.row) === 2) {
      this.enPassantTarget = {
        row: (from.row + to.row) / 2,
        col: from.col,
      };
    }

    // Update castling rights
    if (ap === 6) {
      if (color === 0) {
        this.castling.wK = false;
        this.castling.wQ = false;
      } else {
        this.castling.bK = false;
        this.castling.bQ = false;
      }
    }
    if (ap === 4) {
      if (from.row === 0 && from.col === 0) this.castling.wQ = false;
      if (from.row === 0 && from.col === 7) this.castling.wK = false;
      if (from.row === 7 && from.col === 0) this.castling.bQ = false;
      if (from.row === 7 && from.col === 7) this.castling.bK = false;
    }
    // If a rook is captured, remove castling right
    if (to.row === 0 && to.col === 0) this.castling.wQ = false;
    if (to.row === 0 && to.col === 7) this.castling.wK = false;
    if (to.row === 7 && to.col === 0) this.castling.bQ = false;
    if (to.row === 7 && to.col === 7) this.castling.bK = false;

    // Half-move clock
    this.halfMoveClock =
      isPawnMove || isCapture || enPassantCapture ? 0 : this.halfMoveClock + 1;

    // Full move number
    if (color === 1) this.fullMoveNumber++;

    // Generate notation
    const notation = this.generateNotation(
      from,
      to,
      piece,
      captured,
      move.extra?.promotion,
      castlingNotation,
      enPassantCapture,
    );

    // Record move
    const rec = new MoveRecord();
    rec.playerId = player.uid;
    rec.x = from.col;
    rec.y = from.row;
    rec.toX = to.col;
    rec.toY = to.row;
    rec.notation = notation;
    rec.timestamp = Date.now();
    rec.playerIndex = player.playerIndex;
    this.state.moveHistory.push(rec);
    this.state.lastMoveNotation = notation;
  }

  // â”€â”€â”€ Win Condition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected checkWinCondition(): WinResult | null {
    const players: TurnBasedPlayer[] = [];
    this.state.tbPlayers.forEach((p: TurnBasedPlayer) => players.push(p));
    if (players.length < 2) return null;

    // Determine who just moved (the OTHER player from currentTurn)
    const nextColor = players.find(
      (p) => p.sessionId === this.state.currentTurnPlayerId,
    )?.playerIndex;
    if (nextColor === undefined) return null;

    const inCheck = this.isInCheck(nextColor);
    const hasLegal = this.hasLegalMoves(nextColor);

    if (!hasLegal) {
      if (inCheck) {
        // Checkmate â€” the PREVIOUS player wins
        const winner = players.find((p) => p.playerIndex !== nextColor)!;
        return {
          winnerId: winner.uid,
          winnerSessionId: winner.sessionId,
          reason: "checkmate",
        };
      } else {
        // Stalemate â€” draw
        return {
          winnerId: "",
          winnerSessionId: "",
          reason: "stalemate",
        };
      }
    }

    // 50-move rule
    if (this.halfMoveClock >= 100) {
      return {
        winnerId: "",
        winnerSessionId: "",
        reason: "fifty_move_rule",
      };
    }

    // Insufficient material
    if (this.hasInsufficientMaterial()) {
      return {
        winnerId: "",
        winnerSessionId: "",
        reason: "insufficient_material",
      };
    }

    return null;
  }

  // â”€â”€â”€ Persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected serializeExtraState(): Record<string, any> {
    // Store hasMoved flags from ownerId field
    const movedFlags: boolean[] = [];
    for (let i = 0; i < 64; i++) {
      movedFlags.push(this.state.board[i]?.ownerId === "1");
    }
    return {
      castling: this.castling,
      enPassantTarget: this.enPassantTarget,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber,
      movedFlags,
    };
  }

  protected restoreExtraState(saved: Record<string, any>): void {
    this.castling = saved.castling ?? {
      wK: true,
      wQ: true,
      bK: true,
      bQ: true,
    };
    this.enPassantTarget = saved.enPassantTarget ?? null;
    this.halfMoveClock = saved.halfMoveClock ?? 0;
    this.fullMoveNumber = saved.fullMoveNumber ?? 1;
    if (saved.movedFlags) {
      for (let i = 0; i < saved.movedFlags.length && i < 64; i++) {
        if (this.state.board[i]) {
          this.state.board[i].ownerId = saved.movedFlags[i] ? "1" : "";
        }
      }
    }
  }

  // =========================================================================
  // Chess Logic Helpers
  // =========================================================================

  /** Get all legal moves for a piece at (row, col) */
  private getLegalMoves(
    from: { row: number; col: number },
    piece: number,
    color: number,
  ): { row: number; col: number }[] {
    const pseudoLegal = this.getPseudoLegalMoves(from, piece, color);
    // Filter out moves that leave king in check
    return pseudoLegal.filter((to) => {
      return !this.wouldBeInCheck(from, to, color);
    });
  }

  /** Get pseudo-legal moves (before check filtering) */
  private getPseudoLegalMoves(
    from: { row: number; col: number },
    piece: number,
    color: number,
  ): { row: number; col: number }[] {
    const ap = absPiece(piece);
    switch (ap) {
      case 1:
        return this.getPawnMoves(from, color);
      case 2:
        return this.getKnightMoves(from, color);
      case 3:
        return this.getSlidingMoves(from, color, [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ]);
      case 4:
        return this.getSlidingMoves(from, color, [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]);
      case 5:
        return this.getSlidingMoves(from, color, [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ]);
      case 6:
        return this.getKingMoves(from, color);
      default:
        return [];
    }
  }

  private getPawnMoves(
    from: { row: number; col: number },
    color: number,
  ): { row: number; col: number }[] {
    const moves: { row: number; col: number }[] = [];
    const dir = color === 0 ? 1 : -1;
    const startRow = color === 0 ? 1 : 6;

    // Single forward
    const one = { row: from.row + dir, col: from.col };
    if (this.inBounds(one) && this.getP(one.row, one.col) === EMPTY) {
      moves.push(one);
      // Double forward from start
      if (from.row === startRow) {
        const two = { row: from.row + 2 * dir, col: from.col };
        if (this.getP(two.row, two.col) === EMPTY) {
          moves.push(two);
        }
      }
    }

    // Captures
    for (const dc of [-1, 1]) {
      const cap = { row: from.row + dir, col: from.col + dc };
      if (!this.inBounds(cap)) continue;
      const target = this.getP(cap.row, cap.col);
      if (target !== EMPTY && pieceColor(target) !== color) {
        moves.push(cap);
      }
      // En passant
      if (
        this.enPassantTarget &&
        cap.row === this.enPassantTarget.row &&
        cap.col === this.enPassantTarget.col
      ) {
        moves.push(cap);
      }
    }

    return moves;
  }

  private getKnightMoves(
    from: { row: number; col: number },
    color: number,
  ): { row: number; col: number }[] {
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
      .filter((pos) => {
        if (!this.inBounds(pos)) return false;
        const t = this.getP(pos.row, pos.col);
        return t === EMPTY || pieceColor(t) !== color;
      });
  }

  private getSlidingMoves(
    from: { row: number; col: number },
    color: number,
    directions: number[][],
  ): { row: number; col: number }[] {
    const moves: { row: number; col: number }[] = [];
    for (const [dr, dc] of directions) {
      let r = from.row + dr;
      let c = from.col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const t = this.getP(r, c);
        if (t === EMPTY) {
          moves.push({ row: r, col: c });
        } else {
          if (pieceColor(t) !== color) moves.push({ row: r, col: c });
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  private getKingMoves(
    from: { row: number; col: number },
    color: number,
  ): { row: number; col: number }[] {
    const moves: { row: number; col: number }[] = [];
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

    for (const [dr, dc] of offsets) {
      const pos = { row: from.row + dr, col: from.col + dc };
      if (!this.inBounds(pos)) continue;
      const t = this.getP(pos.row, pos.col);
      if (t === EMPTY || pieceColor(t) !== color) {
        moves.push(pos);
      }
    }

    // Castling
    if (!this.isInCheck(color)) {
      const row = color === 0 ? 0 : 7;
      if (from.row === row && from.col === 4) {
        // Kingside
        const canK = color === 0 ? this.castling.wK : this.castling.bK;
        if (
          canK &&
          this.getP(row, 5) === EMPTY &&
          this.getP(row, 6) === EMPTY &&
          !this.isSquareAttacked(row, 5, color) &&
          !this.isSquareAttacked(row, 6, color)
        ) {
          moves.push({ row, col: 6 });
        }
        // Queenside
        const canQ = color === 0 ? this.castling.wQ : this.castling.bQ;
        if (
          canQ &&
          this.getP(row, 1) === EMPTY &&
          this.getP(row, 2) === EMPTY &&
          this.getP(row, 3) === EMPTY &&
          !this.isSquareAttacked(row, 2, color) &&
          !this.isSquareAttacked(row, 3, color)
        ) {
          moves.push({ row, col: 2 });
        }
      }
    }

    return moves;
  }

  /** Check if a square is attacked by the opponent */
  private isSquareAttacked(
    row: number,
    col: number,
    defendingColor: number,
  ): boolean {
    const attackColor = 1 - defendingColor;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.getP(r, c);
        if (p === EMPTY || pieceColor(p) !== attackColor) continue;
        if (this.canAttack({ row: r, col: c }, { row, col }, p)) return true;
      }
    }
    return false;
  }

  /** Check if a piece can attack a target square (raw, no check filter) */
  private canAttack(
    from: { row: number; col: number },
    to: { row: number; col: number },
    piece: number,
  ): boolean {
    const dr = to.row - from.row;
    const dc = to.col - from.col;
    const ap = absPiece(piece);

    switch (ap) {
      case 1: {
        // Pawn attacks diagonally
        const dir = isWhite(piece) ? 1 : -1;
        return dr === dir && Math.abs(dc) === 1;
      }
      case 2:
        return (
          (Math.abs(dr) === 2 && Math.abs(dc) === 1) ||
          (Math.abs(dr) === 1 && Math.abs(dc) === 2)
        );
      case 3:
        return (
          Math.abs(dr) === Math.abs(dc) &&
          dr !== 0 &&
          this.isPathClear(from, to)
        );
      case 4:
        return (
          (dr === 0 || dc === 0) &&
          (dr !== 0 || dc !== 0) &&
          this.isPathClear(from, to)
        );
      case 5:
        return (
          (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) &&
          (dr !== 0 || dc !== 0) &&
          this.isPathClear(from, to)
        );
      case 6:
        return Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0);
      default:
        return false;
    }
  }

  private isPathClear(
    from: { row: number; col: number },
    to: { row: number; col: number },
  ): boolean {
    const dr = Math.sign(to.row - from.row);
    const dc = Math.sign(to.col - from.col);
    let r = from.row + dr;
    let c = from.col + dc;
    while (r !== to.row || c !== to.col) {
      if (this.getP(r, c) !== EMPTY) return false;
      r += dr;
      c += dc;
    }
    return true;
  }

  /** Find king position for a color */
  private findKing(color: number): { row: number; col: number } | null {
    const kingVal = color === 0 ? W_KING : B_KING;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.getP(r, c) === kingVal) return { row: r, col: c };
      }
    }
    return null;
  }

  /** Is the king of the given color in check? */
  private isInCheck(color: number): boolean {
    const king = this.findKing(color);
    if (!king) return false;
    return this.isSquareAttacked(king.row, king.col, color);
  }

  /** Would moving fromâ†’to leave the king in check? */
  private wouldBeInCheck(
    from: { row: number; col: number },
    to: { row: number; col: number },
    color: number,
  ): boolean {
    // Simulate the move
    const origFrom = this.getP(from.row, from.col);
    const origTo = this.getP(to.row, to.col);
    const piece = origFrom;
    const ap = absPiece(piece);

    // Apply
    this.state.setCell(from.row, from.col, EMPTY, "");
    this.state.setCell(to.row, to.col, piece, "1");

    // En passant capture
    let epCaptured = EMPTY;
    let epRow = -1;
    let epCol = -1;
    if (
      ap === 1 &&
      this.enPassantTarget &&
      to.row === this.enPassantTarget.row &&
      to.col === this.enPassantTarget.col
    ) {
      epRow = color === 0 ? to.row - 1 : to.row + 1;
      epCol = to.col;
      epCaptured = this.getP(epRow, epCol);
      this.state.setCell(epRow, epCol, EMPTY, "");
    }

    // Castling â€” move rook too
    let castleRookFrom = -1;
    let castleRookTo = -1;
    let castleRookVal = EMPTY;
    if (ap === 6 && Math.abs(to.col - from.col) === 2) {
      const row = from.row;
      if (to.col === 6) {
        castleRookFrom = 7;
        castleRookTo = 5;
      } else {
        castleRookFrom = 0;
        castleRookTo = 3;
      }
      castleRookVal = this.getP(row, castleRookFrom);
      this.state.setCell(row, castleRookTo, castleRookVal, "1");
      this.state.setCell(row, castleRookFrom, EMPTY, "");
    }

    const inCheck = this.isInCheck(color);

    // Undo
    this.state.setCell(from.row, from.col, origFrom, "");
    this.state.setCell(to.row, to.col, origTo, "");
    if (epRow >= 0) {
      this.state.setCell(epRow, epCol, epCaptured, "");
    }
    if (castleRookFrom >= 0) {
      this.state.setCell(from.row, castleRookTo, EMPTY, "");
      this.state.setCell(from.row, castleRookFrom, castleRookVal, "");
    }

    return inCheck;
  }

  /** Does the given color have any legal moves? */
  private hasLegalMoves(color: number): boolean {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.getP(r, c);
        if (p === EMPTY) continue;
        if (pieceColor(p) !== color) continue;
        const moves = this.getLegalMoves({ row: r, col: c }, p, color);
        if (moves.length > 0) return true;
      }
    }
    return false;
  }

  /** Check for insufficient material */
  private hasInsufficientMaterial(): boolean {
    const white: { type: number; r: number; c: number }[] = [];
    const black: { type: number; r: number; c: number }[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.getP(r, c);
        if (p === EMPTY) continue;
        const info = { type: absPiece(p), r, c };
        if (isWhite(p)) white.push(info);
        else black.push(info);
      }
    }

    const hasMajor = (pieces: typeof white) =>
      pieces.some((p) => p.type === 1 || p.type === 4 || p.type === 5);
    if (hasMajor(white) || hasMajor(black)) return false;

    const wMinor = white.filter((p) => p.type === 2 || p.type === 3);
    const bMinor = black.filter((p) => p.type === 2 || p.type === 3);

    // K vs K
    if (wMinor.length === 0 && bMinor.length === 0) return true;
    // K+minor vs K
    if (
      (wMinor.length === 1 && bMinor.length === 0) ||
      (wMinor.length === 0 && bMinor.length === 1)
    )
      return true;
    // K+B vs K+B same color
    if (
      wMinor.length === 1 &&
      bMinor.length === 1 &&
      wMinor[0].type === 3 &&
      bMinor[0].type === 3
    ) {
      if ((wMinor[0].r + wMinor[0].c) % 2 === (bMinor[0].r + bMinor[0].c) % 2)
        return true;
    }

    return false;
  }

  // â”€â”€â”€ Notation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private generateNotation(
    from: { row: number; col: number },
    to: { row: number; col: number },
    piece: number,
    captured: number,
    promotion: string | undefined,
    castling: string | undefined,
    enPassant: boolean,
  ): string {
    if (castling) return castling;

    const ap = absPiece(piece);
    let notation = "";

    if (ap !== 1) {
      notation += PIECE_NOTATION[ap] || "";
    }

    const isCapture = captured !== EMPTY || enPassant;
    if (isCapture && ap === 1) {
      notation += String.fromCharCode(97 + from.col);
    }
    if (isCapture) notation += "x";

    notation += String.fromCharCode(97 + to.col) + (to.row + 1);

    if (promotion) {
      const promoMap: Record<string, string> = {
        queen: "Q",
        rook: "R",
        bishop: "B",
        knight: "N",
      };
      notation += "=" + (promoMap[promotion] || "Q");
    }

    return notation;
  }

  private inBounds(pos: { row: number; col: number }): boolean {
    return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
  }
}

