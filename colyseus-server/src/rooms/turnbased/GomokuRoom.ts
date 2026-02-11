/**
 * GomokuRoom â€” 15Ã—15 Gomoku (Five in a Row) with server-validated moves
 *
 * Rules:
 * - 15Ã—15 board (standard Gomoku size)
 * - Player 0 = Black (value 1), Player 1 = White (value 2)
 * - Black always goes first
 * - Players alternate placing stones on empty intersections
 * - First to get 5 (or more) in a row (horizontal, vertical, diagonal) wins
 * - If all 225 cells are filled â†’ draw (extremely rare)
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md Phase 2
 */

import { MovePayload, TurnBasedRoom, WinResult } from "../base/TurnBasedRoom";

const BOARD_SIZE = 15;

// Directions for line checking: horizontal, vertical, diagonal â†˜, diagonal â†™
const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export class GomokuRoom extends TurnBasedRoom {
  protected readonly gameTypeKey = "gomoku_master_game";
  protected readonly defaultBoardWidth = BOARD_SIZE;
  protected readonly defaultBoardHeight = BOARD_SIZE;

  // =========================================================================
  // Board Setup
  // =========================================================================

  protected initializeBoard(_options: Record<string, any>): void {
    // Board is initialized with zeros by base class â€” empty intersections
  }

  // =========================================================================
  // Move Validation
  // =========================================================================

  protected validateMove(_sessionId: string, move: MovePayload): boolean {
    const { row, col } = move;

    // Bounds check
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE)
      return false;

    // Intersection must be empty
    if (this.state.getCell(row, col) !== 0) return false;

    return true;
  }

  // =========================================================================
  // Apply Move
  // =========================================================================

  protected applyMove(sessionId: string, move: MovePayload): void {
    const { row, col } = move;
    const playerIndex = this.getPlayerIndex(sessionId);
    const value = playerIndex + 1; // 1 = Black, 2 = White
    const uid = this.playerUids.get(sessionId) || "";

    this.state.setCell(row, col, value, uid);

    const color = value === 1 ? "B" : "W";
    // Use Go-style notation: column letter + row number
    const colLetter = String.fromCharCode(65 + col); // A-O
    const notation = `${color}${colLetter}${row + 1}`;
    this.recordMove(sessionId, row, col, notation);
  }

  // =========================================================================
  // Win Detection
  // =========================================================================

  protected checkWinCondition(): WinResult | null {
    // Check for 5-in-a-row for both players
    for (let player = 1; player <= 2; player++) {
      if (this.hasFiveInARow(player)) {
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
          reason: "five_in_a_row",
        };
      }
    }

    // Check for draw â€” all cells filled
    let allFilled = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
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

    return null;
  }

  /**
   * Check if a player has 5 (or more) in a row.
   */
  private hasFiveInARow(player: number): boolean {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.state.getCell(r, c) !== player) continue;

        for (const [dr, dc] of DIRECTIONS) {
          let count = 1;
          let nr = r + dr;
          let nc = c + dc;
          while (
            nr >= 0 &&
            nr < BOARD_SIZE &&
            nc >= 0 &&
            nc < BOARD_SIZE &&
            this.state.getCell(nr, nc) === player
          ) {
            count++;
            nr += dr;
            nc += dc;
          }
          if (count >= 5) return true;
        }
      }
    }
    return false;
  }
}

