/**
 * ConnectFourRoom â€” 6Ã—7 Connect Four with server-validated moves
 *
 * Rules:
 * - 6 rows Ã— 7 columns, pieces drop to lowest available row (gravity)
 * - Player 0 = Red (value 1), Player 1 = Yellow (value 2)
 * - Players alternate dropping a disc into a column
 * - First to connect 4 in a row (horizontal, vertical, diagonal) wins
 * - If board fills up (all 42 cells) â†’ draw
 *
 * Move payload: { col } â€” only column is needed (row is computed by gravity)
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md Phase 2
 */

import { MovePayload, TurnBasedRoom, WinResult } from "../base/TurnBasedRoom";

const ROWS = 6;
const COLS = 7;

export class ConnectFourRoom extends TurnBasedRoom {
  protected readonly gameTypeKey = "connect_four_game";
  protected readonly defaultBoardWidth = COLS;
  protected readonly defaultBoardHeight = ROWS;

  // =========================================================================
  // Board Setup
  // =========================================================================

  protected initializeBoard(_options: Record<string, any>): void {
    // Board is initialized with zeros by base class â€” empty board
  }

  // =========================================================================
  // Move Validation
  // =========================================================================

  protected validateMove(_sessionId: string, move: MovePayload): boolean {
    const col = move.col;

    // Bounds check
    if (col < 0 || col >= COLS) return false;

    // Column must have at least one empty cell (top row is empty)
    if (this.state.getCell(0, col) !== 0) return false;

    return true;
  }

  // =========================================================================
  // Apply Move â€” drop piece with gravity
  // =========================================================================

  protected applyMove(sessionId: string, move: MovePayload): void {
    const col = move.col;
    const playerIndex = this.getPlayerIndex(sessionId);
    const value = playerIndex + 1; // 1 = Red, 2 = Yellow
    const uid = this.playerUids.get(sessionId) || "";

    // Find the lowest empty row in this column (gravity)
    let targetRow = -1;
    for (let row = ROWS - 1; row >= 0; row--) {
      if (this.state.getCell(row, col) === 0) {
        targetRow = row;
        break;
      }
    }

    if (targetRow < 0) return; // Should not happen after validation

    this.state.setCell(targetRow, col, value, uid);

    const color = value === 1 ? "R" : "Y";
    const notation = `${color}â†’col${col + 1}`;
    this.recordMove(sessionId, targetRow, col, notation);
  }

  // =========================================================================
  // Win Detection
  // =========================================================================

  protected checkWinCondition(): WinResult | null {
    // Check all possible 4-in-a-row patterns
    for (let player = 1; player <= 2; player++) {
      if (this.hasFourInARow(player)) {
        const winnerIndex = player - 1;
        let winnerId = "";
        let winnerSessionId = "";

        this.state.tbPlayers.forEach((p) => {
          if (p.playerIndex === winnerIndex) {
            winnerId = p.uid;
            winnerSessionId = p.sessionId;
          }
        });

        return {
          winnerId,
          winnerSessionId,
          reason: "four_in_a_row",
        };
      }
    }

    // Check draw â€” all cells filled
    let allFilled = true;
    for (let c = 0; c < COLS; c++) {
      if (this.state.getCell(0, c) === 0) {
        allFilled = false;
        break;
      }
    }

    if (allFilled) {
      return {
        winnerId: "",
        winnerSessionId: "",
        reason: "draw_board_full",
      };
    }

    return null;
  }

  /**
   * Check if a player has 4 in a row anywhere on the board.
   */
  private hasFourInARow(player: number): boolean {
    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        if (
          this.state.getCell(r, c) === player &&
          this.state.getCell(r, c + 1) === player &&
          this.state.getCell(r, c + 2) === player &&
          this.state.getCell(r, c + 3) === player
        ) {
          return true;
        }
      }
    }

    // Vertical
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c < COLS; c++) {
        if (
          this.state.getCell(r, c) === player &&
          this.state.getCell(r + 1, c) === player &&
          this.state.getCell(r + 2, c) === player &&
          this.state.getCell(r + 3, c) === player
        ) {
          return true;
        }
      }
    }

    // Diagonal â†˜
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        if (
          this.state.getCell(r, c) === player &&
          this.state.getCell(r + 1, c + 1) === player &&
          this.state.getCell(r + 2, c + 2) === player &&
          this.state.getCell(r + 3, c + 3) === player
        ) {
          return true;
        }
      }
    }

    // Diagonal â†—
    for (let r = 3; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        if (
          this.state.getCell(r, c) === player &&
          this.state.getCell(r - 1, c + 1) === player &&
          this.state.getCell(r - 2, c + 2) === player &&
          this.state.getCell(r - 3, c + 3) === player
        ) {
          return true;
        }
      }
    }

    return false;
  }
}

