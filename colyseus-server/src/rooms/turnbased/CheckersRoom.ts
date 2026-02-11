/**
 * CheckersRoom â€” Server-authoritative Checkers (Draughts)
 *
 * 8Ã—8 board, mandatory jumps, multi-jump chains, king promotion.
 * Board encoding: 0=empty, 1=red, 2=black, 3=red king, 4=black king
 * Player 0 = red (rows 0-2), Player 1 = black (rows 5-7)
 *
 * Extends TurnBasedRoom â€” uses fromâ†’to moves with captures in `extra`.
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md Phase 3
 */

import { MoveRecord, TurnBasedPlayer } from "../../schemas/turnbased";
import { MovePayload, TurnBasedRoom, WinResult } from "../base/TurnBasedRoom";

// =============================================================================
// Constants
// =============================================================================

const RED = 1;
const BLACK = 2;
const RED_KING = 3;
const BLACK_KING = 4;

function isRed(v: number): boolean {
  return v === RED || v === RED_KING;
}
function isBlack(v: number): boolean {
  return v === BLACK || v === BLACK_KING;
}
function isKing(v: number): boolean {
  return v === RED_KING || v === BLACK_KING;
}
function ownerIndex(v: number): number {
  return isRed(v) ? 0 : isBlack(v) ? 1 : -1;
}

// =============================================================================
// Room
// =============================================================================

export class CheckersRoom extends TurnBasedRoom {
  protected readonly gameTypeKey = "checkers_game";
  protected readonly defaultBoardWidth = 8;
  protected readonly defaultBoardHeight = 8;

  /** Track multi-jump state: session of player mid-chain, and their piece pos */
  private multiJumpSession: string | null = null;
  private multiJumpRow = -1;
  private multiJumpCol = -1;

  // â”€â”€â”€ Lifecycle hooks applied by the base class â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected initializeBoard(_options: Record<string, any>): void {
    // Red pieces (player 0) on rows 0-2, dark squares only
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          this.state.setCell(row, col, RED, "");
        }
      }
    }
    // Black pieces (player 1) on rows 5-7
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          this.state.setCell(row, col, BLACK, "");
        }
      }
    }
    this.multiJumpSession = null;
  }

  // â”€â”€â”€ Move Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected validateMove(sessionId: string, move: MovePayload): boolean {
    const player = this.state.tbPlayers.get(sessionId);
    if (!player) return false;

    const fromRow = move.row;
    const fromCol = move.col;
    const toRow = move.toRow;
    const toCol = move.toCol;

    if (toRow === undefined || toCol === undefined) return false;

    const piece = this.state.getCell(fromRow, fromCol);
    if (piece <= 0) return false;

    // Must be this player's piece
    if (ownerIndex(piece) !== player.playerIndex) return false;

    // If mid multi-jump, must move the same piece
    if (this.multiJumpSession === sessionId) {
      if (fromRow !== this.multiJumpRow || fromCol !== this.multiJumpCol) {
        return false;
      }
    }

    // Target must be empty
    if (this.state.getCell(toRow, toCol) !== 0) return false;

    // Check if this is a valid regular move or jump
    const dr = toRow - fromRow;
    const dc = toCol - fromCol;

    // Direction validation (non-kings can only go forward)
    if (!isKing(piece)) {
      if (ownerIndex(piece) === 0 && dr <= 0) return false; // Red moves down
      if (ownerIndex(piece) === 1 && dr >= 0) return false; // Black moves up
    }

    if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
      // Regular move â€” only allowed if no jumps are available
      if (this.multiJumpSession === sessionId) return false; // Mid-chain must jump
      if (this.hasAnyJumps(player.playerIndex)) return false; // Mandatory jump
      return true;
    }

    if (Math.abs(dr) === 2 && Math.abs(dc) === 2) {
      // Jump â€” check there's an opponent piece in between
      const midRow = fromRow + dr / 2;
      const midCol = fromCol + dc / 2;
      const midPiece = this.state.getCell(midRow, midCol);
      if (midPiece <= 0) return false;
      if (ownerIndex(midPiece) === player.playerIndex) return false; // Can't jump own
      return true;
    }

    return false;
  }

  // â”€â”€â”€ Apply Move â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected applyMove(sessionId: string, move: MovePayload): void {
    const player = this.state.tbPlayers.get(sessionId);
    if (!player) return;

    const fromRow = move.row;
    const fromCol = move.col;
    const toRow = move.toRow!;
    const toCol = move.toCol!;
    let piece = this.state.getCell(fromRow, fromCol);

    const dr = toRow - fromRow;
    const dc = toCol - fromCol;
    const isJump = Math.abs(dr) === 2;

    // Move the piece
    this.state.setCell(fromRow, fromCol, 0, "");

    // Handle capture
    if (isJump) {
      const midRow = fromRow + dr / 2;
      const midCol = fromCol + dc / 2;
      this.state.setCell(midRow, midCol, 0, "");
      player.capturedPieces++;
    }

    // King promotion
    if (piece === RED && toRow === 7) piece = RED_KING;
    if (piece === BLACK && toRow === 0) piece = BLACK_KING;

    this.state.setCell(toRow, toCol, piece, player.uid);

    // Check for multi-jump continuation
    if (isJump && this.getJumpsFrom(toRow, toCol, piece).length > 0) {
      // Player must continue jumping
      this.multiJumpSession = sessionId;
      this.multiJumpRow = toRow;
      this.multiJumpCol = toCol;
      // Don't advance turn â€” same player goes again
      this.skipNextAdvance = true;
    } else {
      this.multiJumpSession = null;
      this.multiJumpRow = -1;
      this.multiJumpCol = -1;
    }

    // Record move
    const rec = new MoveRecord();
    rec.playerId = player.uid;
    rec.x = fromCol;
    rec.y = fromRow;
    rec.toX = toCol;
    rec.toY = toRow;
    rec.notation = `${String.fromCharCode(97 + fromCol)}${fromRow + 1}-${String.fromCharCode(97 + toCol)}${toRow + 1}`;
    rec.timestamp = Date.now();
    rec.playerIndex = player.playerIndex;
    this.state.moveHistory.push(rec);
    this.state.lastMoveNotation = rec.notation;

    // Update piece counts as score
    this.updateScores();
  }

  /** Flag to prevent advanceTurn when multi-jump continues */
  private skipNextAdvance = false;

  /** Override advanceTurn to support multi-jump */
  protected advanceTurn(): void {
    if (this.skipNextAdvance) {
      this.skipNextAdvance = false;
      return; // Same player continues
    }
    super.advanceTurn();
  }

  // â”€â”€â”€ Win Condition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected checkWinCondition(): WinResult | null {
    const players: TurnBasedPlayer[] = [];
    this.state.tbPlayers.forEach((p: TurnBasedPlayer) => players.push(p));
    if (players.length < 2) return null;

    const p0 = players.find((p) => p.playerIndex === 0)!;
    const p1 = players.find((p) => p.playerIndex === 1)!;

    // Count pieces
    let redCount = 0;
    let blackCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const v = this.state.getCell(r, c);
        if (isRed(v)) redCount++;
        if (isBlack(v)) blackCount++;
      }
    }

    // No pieces left = loss
    if (redCount === 0) {
      return {
        winnerId: p1.uid,
        winnerSessionId: p1.sessionId,
        reason: "all_captured",
      };
    }
    if (blackCount === 0) {
      return {
        winnerId: p0.uid,
        winnerSessionId: p0.sessionId,
        reason: "all_captured",
      };
    }

    // Current player has no legal moves = loss
    const currentPlayer = players.find(
      (p) => p.sessionId === this.state.currentTurnPlayerId,
    );
    if (currentPlayer && !this.multiJumpSession) {
      if (!this.canPlayerMove(currentPlayer.playerIndex)) {
        const opponent = players.find(
          (p) => p.playerIndex !== currentPlayer.playerIndex,
        )!;
        return {
          winnerId: opponent.uid,
          winnerSessionId: opponent.sessionId,
          reason: "no_moves",
        };
      }
    }

    return null;
  }

  // â”€â”€â”€ Persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected serializeExtraState(): Record<string, any> {
    return {
      multiJumpSession: this.multiJumpSession,
      multiJumpRow: this.multiJumpRow,
      multiJumpCol: this.multiJumpCol,
    };
  }

  protected restoreExtraState(saved: Record<string, any>): void {
    this.multiJumpSession = saved.multiJumpSession ?? null;
    this.multiJumpRow = saved.multiJumpRow ?? -1;
    this.multiJumpCol = saved.multiJumpCol ?? -1;
  }

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private getJumpsFrom(
    row: number,
    col: number,
    piece: number,
  ): { toRow: number; toCol: number }[] {
    const jumps: { toRow: number; toCol: number }[] = [];
    const directions = isKing(piece)
      ? [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ]
      : ownerIndex(piece) === 0
        ? [
            [1, -1],
            [1, 1],
          ] // Red moves down
        : [
            [-1, -1],
            [-1, 1],
          ]; // Black moves up

    for (const [dr, dc] of directions) {
      const midRow = row + dr;
      const midCol = col + dc;
      const toRow = row + dr * 2;
      const toCol = col + dc * 2;
      if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) continue;
      const midPiece = this.state.getCell(midRow, midCol);
      if (midPiece <= 0) continue;
      if (ownerIndex(midPiece) === ownerIndex(piece)) continue;
      if (this.state.getCell(toRow, toCol) !== 0) continue;
      jumps.push({ toRow, toCol });
    }
    return jumps;
  }

  private hasAnyJumps(playerIndex: number): boolean {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const v = this.state.getCell(r, c);
        if (v <= 0 || ownerIndex(v) !== playerIndex) continue;
        if (this.getJumpsFrom(r, c, v).length > 0) return true;
      }
    }
    return false;
  }

  private canPlayerMove(playerIndex: number): boolean {
    const mustJump = this.hasAnyJumps(playerIndex);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const v = this.state.getCell(r, c);
        if (v <= 0 || ownerIndex(v) !== playerIndex) continue;

        // Check jumps
        if (this.getJumpsFrom(r, c, v).length > 0) return true;

        // If must jump, don't check regular moves
        if (mustJump) continue;

        // Check regular moves
        const directions = isKing(v)
          ? [
              [-1, -1],
              [-1, 1],
              [1, -1],
              [1, 1],
            ]
          : playerIndex === 0
            ? [
                [1, -1],
                [1, 1],
              ]
            : [
                [-1, -1],
                [-1, 1],
              ];

        for (const [dr, dc] of directions) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (this.state.getCell(nr, nc) === 0) return true;
          }
        }
      }
    }
    return false;
  }

  private updateScores(): void {
    let redCount = 0;
    let blackCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const v = this.state.getCell(r, c);
        if (isRed(v)) redCount++;
        if (isBlack(v)) blackCount++;
      }
    }
    this.state.tbPlayers.forEach((p: TurnBasedPlayer) => {
      if (p.playerIndex === 0) p.score = redCount;
      else p.score = blackCount;
    });
  }
}

