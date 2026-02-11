/**
 * TicTacToeRoom â€” 3Ã—3 Tic-Tac-Toe with server-validated moves
 *
 * Rules:
 * - 3Ã—3 board, player 0 = X (value 1), player 1 = O (value 2)
 * - Players alternate placing their mark
 * - First to get 3 in a row (horizontal, vertical, diagonal) wins
 * - If all 9 cells are filled with no winner â†’ draw
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md Phase 2
 */

import { MovePayload, TurnBasedRoom, WinResult } from "../base/TurnBasedRoom";

// Winning line patterns for 3Ã—3
const WINNING_LINES = [
  // Rows
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  // Columns
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  // Diagonals
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
];

export class TicTacToeRoom extends TurnBasedRoom {
  protected readonly gameTypeKey = "tic_tac_toe_game";
  protected readonly defaultBoardWidth = 3;
  protected readonly defaultBoardHeight = 3;

  // =========================================================================
  // Board Setup
  // =========================================================================

  protected initializeBoard(_options: Record<string, any>): void {
    // Board is already initialized by base class with zeros
    // No additional setup needed for TicTacToe
  }

  // =========================================================================
  // Move Validation
  // =========================================================================

  protected validateMove(sessionId: string, move: MovePayload): boolean {
    const { row, col } = move;

    // Bounds check
    if (row < 0 || row >= 3 || col < 0 || col >= 3) return false;

    // Cell must be empty
    if (this.state.getCell(row, col) !== 0) return false;

    return true;
  }

  // =========================================================================
  // Apply Move
  // =========================================================================

  protected applyMove(sessionId: string, move: MovePayload): void {
    const { row, col } = move;
    const playerIndex = this.getPlayerIndex(sessionId);
    const value = playerIndex + 1; // 1 = X, 2 = O
    const uid = this.playerUids.get(sessionId) || "";

    this.state.setCell(row, col, value, uid);

    const symbol = value === 1 ? "X" : "O";
    const notation = `${symbol}(${row},${col})`;
    this.recordMove(sessionId, row, col, notation);
  }

  // =========================================================================
  // Win Detection
  // =========================================================================

  protected checkWinCondition(): WinResult | null {
    // Check each winning line
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      const va = this.state.getCell(a[0], a[1]);
      const vb = this.state.getCell(b[0], b[1]);
      const vc = this.state.getCell(c[0], c[1]);

      if (va !== 0 && va === vb && vb === vc) {
        // Found a winner â€” value 1 = player 0, value 2 = player 1
        const winnerIndex = va - 1;
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
          reason: "three_in_a_row",
        };
      }
    }

    // Check for draw (all cells filled)
    let allFilled = true;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (this.state.getCell(r, c) === 0) {
          allFilled = false;
          break;
        }
      }
      if (!allFilled) break;
    }

    if (allFilled) {
      return {
        winnerId: "",
        winnerSessionId: "",
        reason: "draw_board_full",
      };
    }

    return null; // Game continues
  }
}

