/**
 * ReversiRoom â€” 8Ã—8 Reversi (Othello) with server-validated moves
 *
 * Rules:
 * - 8Ã—8 board, starts with 4 pieces in center (standard Othello setup)
 * - Player 0 = Black (value 1), Player 1 = White (value 2)
 * - Black goes first
 * - A move must outflank at least one opponent piece in any of 8 directions
 * - All outflanked pieces are flipped to the current player's color
 * - If a player has no valid moves, their turn is skipped
 * - If neither player can move, the game ends
 * - Player with more pieces wins
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md Phase 2
 */

import { MovePayload, TurnBasedRoom, WinResult } from "../base/TurnBasedRoom";

const BOARD_SIZE = 8;

// All 8 directions for flipping
const DIRECTIONS: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export class ReversiRoom extends TurnBasedRoom {
  protected readonly gameTypeKey = "reversi_game";
  protected readonly defaultBoardWidth = BOARD_SIZE;
  protected readonly defaultBoardHeight = BOARD_SIZE;

  /** Track consecutive passes (if both pass, game ends) */
  private consecutivePasses = 0;

  // =========================================================================
  // Board Setup â€” standard Othello opening position
  // =========================================================================

  protected initializeBoard(_options: Record<string, any>): void {
    // Standard Othello starting position: 4 pieces in center
    // White (2) at d4, e5; Black (1) at d5, e4
    this.state.setCell(3, 3, 2); // White
    this.state.setCell(3, 4, 1); // Black
    this.state.setCell(4, 3, 1); // Black
    this.state.setCell(4, 4, 2); // White
  }

  // =========================================================================
  // Move Validation
  // =========================================================================

  protected validateMove(sessionId: string, move: MovePayload): boolean {
    const { row, col } = move;
    const playerIndex = this.getPlayerIndex(sessionId);
    const value = playerIndex + 1;

    // Bounds check
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE)
      return false;

    // Cell must be empty
    if (this.state.getCell(row, col) !== 0) return false;

    // Must flip at least one opponent piece
    const flips = this.getFlips(row, col, value);
    if (flips.length === 0) return false;

    return true;
  }

  // =========================================================================
  // Apply Move
  // =========================================================================

  protected applyMove(sessionId: string, move: MovePayload): void {
    const { row, col } = move;
    const playerIndex = this.getPlayerIndex(sessionId);
    const value = playerIndex + 1;
    const uid = this.playerUids.get(sessionId) || "";

    // Place the piece
    this.state.setCell(row, col, value, uid);

    // Flip all outflanked pieces
    const flips = this.getFlips(row, col, value);
    for (const [fr, fc] of flips) {
      this.state.setCell(fr, fc, value, uid);
    }

    // Update captured pieces count
    const player = this.getPlayer(sessionId);
    if (player) {
      player.capturedPieces += flips.length;
    }

    // Update scores
    this.updateScores();

    // Reset consecutive passes (a valid move was made)
    this.consecutivePasses = 0;

    // Record notation
    const color = value === 1 ? "B" : "W";
    const colLetter = String.fromCharCode(97 + col); // a-h
    const notation = `${color}${colLetter}${row + 1}(+${flips.length})`;
    this.recordMove(sessionId, row, col, notation);
  }

  // =========================================================================
  // Win Detection
  // =========================================================================

  protected checkWinCondition(): WinResult | null {
    // After applying a move, check if the next player can move
    // If not, check if the other can. If neither can â†’ game over.

    // Get next player's value
    const players = Array.from(this.state.tbPlayers.values());
    const currentPlayer = players.find(
      (p) => p.sessionId === this.state.currentTurnPlayerId,
    );
    const nextPlayer = players.find(
      (p) => p.sessionId !== this.state.currentTurnPlayerId,
    );

    if (!currentPlayer || !nextPlayer) return null;

    // We're about to advance turn. Check if next player has valid moves.
    const nextValue = nextPlayer.playerIndex + 1;
    const currentValue = currentPlayer.playerIndex + 1;
    const nextHasMoves = this.hasValidMoves(nextValue);

    if (!nextHasMoves) {
      // Next player can't move â€” check if current player can move again
      const currentHasMoves = this.hasValidMoves(currentValue);

      if (!currentHasMoves) {
        // Neither player can move â€” game over
        return this.determineWinner();
      }

      // Current player plays again (skip next player's turn)
      // Don't advance turn â€” it stays with current player
      this.consecutivePasses++;

      if (this.consecutivePasses >= 2) {
        return this.determineWinner();
      }

      // Broadcast that the opponent's turn was skipped
      this.broadcast("turn_skipped", {
        skippedPlayer: nextPlayer.sessionId,
      });

      // Override the normal turn advance â€” stay with current player
      // This is done by NOT returning null and letting advanceTurn run,
      // but instead we need to keep currentTurnPlayerId the same.
      // We'll handle this by overriding advanceTurn behavior.
      // Actually, let's just not advance. Set it back after advanceTurn.
      // The base class calls advanceTurn() after checkWinCondition returns null.
      // So we need a flag.
      this.skipNextAdvance = true;

      return null;
    }

    return null;
  }

  /** Flag to prevent turn advance when opponent has no valid moves */
  private skipNextAdvance = false;

  /**
   * Override advanceTurn to support turn skipping in Reversi.
   */
  protected advanceTurn(): void {
    if (this.skipNextAdvance) {
      this.skipNextAdvance = false;
      // Don't advance â€” current player goes again
      return;
    }
    super.advanceTurn();
  }

  // =========================================================================
  // Reversi-Specific Logic
  // =========================================================================

  /**
   * Get all pieces that would be flipped by placing `player` at (row, col).
   */
  private getFlips(
    row: number,
    col: number,
    player: number,
  ): [number, number][] {
    const opponent = player === 1 ? 2 : 1;
    const allFlips: [number, number][] = [];

    for (const [dr, dc] of DIRECTIONS) {
      const lineFlips: [number, number][] = [];
      let nr = row + dr;
      let nc = col + dc;

      while (
        nr >= 0 &&
        nr < BOARD_SIZE &&
        nc >= 0 &&
        nc < BOARD_SIZE &&
        this.state.getCell(nr, nc) === opponent
      ) {
        lineFlips.push([nr, nc]);
        nr += dr;
        nc += dc;
      }

      // Must end with our own piece to complete the sandwich
      if (
        lineFlips.length > 0 &&
        nr >= 0 &&
        nr < BOARD_SIZE &&
        nc >= 0 &&
        nc < BOARD_SIZE &&
        this.state.getCell(nr, nc) === player
      ) {
        allFlips.push(...lineFlips);
      }
    }

    return allFlips;
  }

  /**
   * Check if a player has any valid moves on the board.
   */
  private hasValidMoves(player: number): boolean {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.state.getCell(r, c) !== 0) continue;
        if (this.getFlips(r, c, player).length > 0) return true;
      }
    }
    return false;
  }

  /**
   * Count pieces and determine the winner.
   */
  private determineWinner(): WinResult {
    const counts = this.countPieces();

    if (counts.p1 > counts.p2) {
      // Player 0 (Black) wins
      let winnerId = "";
      let winnerSessionId = "";
      this.state.tbPlayers.forEach((p) => {
        if (p.playerIndex === 0) {
          winnerId = p.uid;
          winnerSessionId = p.sessionId;
        }
      });
      return { winnerId, winnerSessionId, reason: "most_pieces" };
    } else if (counts.p2 > counts.p1) {
      // Player 1 (White) wins
      let winnerId = "";
      let winnerSessionId = "";
      this.state.tbPlayers.forEach((p) => {
        if (p.playerIndex === 1) {
          winnerId = p.uid;
          winnerSessionId = p.sessionId;
        }
      });
      return { winnerId, winnerSessionId, reason: "most_pieces" };
    } else {
      // Draw (equal pieces)
      return { winnerId: "", winnerSessionId: "", reason: "draw_equal_pieces" };
    }
  }

  /**
   * Count pieces for each player.
   */
  private countPieces(): { p1: number; p2: number } {
    let p1 = 0;
    let p2 = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const val = this.state.getCell(r, c);
        if (val === 1) p1++;
        else if (val === 2) p2++;
      }
    }
    return { p1, p2 };
  }

  /**
   * Update player scores to reflect piece counts.
   */
  private updateScores(): void {
    const counts = this.countPieces();
    this.state.tbPlayers.forEach((p) => {
      if (p.playerIndex === 0) p.score = counts.p1;
      else p.score = counts.p2;
    });
    this.state.players.forEach((p) => {
      if (p.playerIndex === 0) p.score = counts.p1;
      else p.score = counts.p2;
    });
  }

  // =========================================================================
  // Persistence â€” Extra State
  // =========================================================================

  protected serializeExtraState(): Record<string, any> {
    return {
      consecutivePasses: this.consecutivePasses,
    };
  }

  protected restoreExtraState(saved: Record<string, any>): void {
    this.consecutivePasses = saved.consecutivePasses || 0;
  }
}

