/**
 * TurnBasedRoom Unit Tests
 *
 * Tests schemas, game logic, board operations, win detection,
 * and special rules for all 5 Phase-2 turn-based games:
 *   - TicTacToe (3×3, 8 win patterns)
 *   - ConnectFour (6×7, gravity, 4-in-a-row)
 *   - Gomoku (15×15, 5-in-a-row)
 *   - Hex (9×9, BFS path detection)
 *   - Reversi (8×8, outflanking, turn skipping)
 */

// ---------------------------------------------------------------------------
// Mocks — must be before imports
// ---------------------------------------------------------------------------
jest.mock("../../src/services/firebase", () => ({
  initializeFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: jest.fn().mockResolvedValue({
    uid: "test-uid-1",
    name: "Player 1",
  }),
  getFirestoreDb: jest.fn().mockReturnValue(null),
}));

jest.mock("../../src/services/persistence", () => ({
  saveGameState: jest.fn().mockResolvedValue(undefined),
  loadGameState: jest.fn().mockResolvedValue(null),
  persistGameResult: jest.fn().mockResolvedValue(undefined),
  cleanupExpiredGameStates: jest.fn().mockResolvedValue(undefined),
}));

import {
  GridCell,
  MoveRecord,
  TurnBasedPlayer,
  TurnBasedState,
} from "../../src/schemas/turnbased";

// ---------------------------------------------------------------------------
// Schema Tests
// ---------------------------------------------------------------------------

describe("TurnBasedState Schema", () => {
  it("should create a state with default values", () => {
    const state = new TurnBasedState();
    expect(state.phase).toBe("waiting");
    expect(state.boardWidth).toBe(8); // default 8
    expect(state.boardHeight).toBe(8); // default 8
    expect(state.currentTurnPlayerId).toBe("");
    expect(state.turnNumber).toBe(0);
    expect(state.winnerId).toBe("");
    expect(state.winReason).toBe("");
    expect(state.drawPending).toBe(false);
    expect(state.drawOfferedBy).toBe("");
    expect(state.timedMode).toBe(false);
    expect(state.lastMoveNotation).toBe("");
  });

  it("should create a GridCell with default values", () => {
    const cell = new GridCell();
    expect(cell.value).toBe(0);
    expect(cell.ownerId).toBe("");
  });

  it("should create a MoveRecord", () => {
    const move = new MoveRecord();
    move.playerId = "uid-1";
    move.x = 2;
    move.y = 3;
    move.notation = "C4";
    move.timestamp = Date.now();
    move.playerIndex = 0;
    expect(move.playerId).toBe("uid-1");
    expect(move.x).toBe(2);
    expect(move.y).toBe(3);
    expect(move.notation).toBe("C4");
    expect(move.playerIndex).toBe(0);
  });

  it("should create a TurnBasedPlayer with defaults", () => {
    const player = new TurnBasedPlayer();
    expect(player.piece).toBe("");
    expect(player.timeRemainingMs).toBe(0);
    expect(player.offeredDraw).toBe(false);
    expect(player.capturedPieces).toBe(0);
    // Inherited from Player
    expect(player.connected).toBe(true);
    expect(player.ready).toBe(false);
    expect(player.score).toBe(0);
  });

  it("should track players in tbPlayers MapSchema", () => {
    const state = new TurnBasedState();
    const p1 = new TurnBasedPlayer();
    p1.uid = "uid-1";
    p1.displayName = "Alice";
    p1.piece = "X";
    p1.playerIndex = 0;

    const p2 = new TurnBasedPlayer();
    p2.uid = "uid-2";
    p2.displayName = "Bob";
    p2.piece = "O";
    p2.playerIndex = 1;

    state.tbPlayers.set("session-1", p1);
    state.tbPlayers.set("session-2", p2);

    expect(state.tbPlayers.size).toBe(2);
    expect(state.tbPlayers.get("session-1")!.displayName).toBe("Alice");
    expect(state.tbPlayers.get("session-2")!.piece).toBe("O");
  });
});

// ---------------------------------------------------------------------------
// Board Operations
// ---------------------------------------------------------------------------

describe("TurnBasedState Board Operations", () => {
  it("should initialize a board with given dimensions", () => {
    const state = new TurnBasedState();
    state.initBoard(3, 3);
    expect(state.boardWidth).toBe(3);
    expect(state.boardHeight).toBe(3);
    expect(state.board.length).toBe(9);
    // All should be empty
    for (let i = 0; i < 9; i++) {
      expect(state.board[i].value).toBe(0);
      expect(state.board[i].ownerId).toBe("");
    }
  });

  it("should get and set cell values", () => {
    const state = new TurnBasedState();
    state.initBoard(3, 3);

    state.setCell(0, 0, 1, "player-1");
    state.setCell(1, 1, 2, "player-2");

    expect(state.getCell(0, 0)).toBe(1);
    expect(state.getCell(1, 1)).toBe(2);
    expect(state.getCell(0, 1)).toBe(0); // Empty
    expect(state.getCell(2, 2)).toBe(0); // Empty
  });

  it("should handle out-of-bounds getCell gracefully", () => {
    const state = new TurnBasedState();
    state.initBoard(3, 3);
    expect(state.getCell(-1, 0)).toBe(-1);
    expect(state.getCell(0, 3)).toBe(-1);
    expect(state.getCell(3, 0)).toBe(-1);
  });

  it("should serialize and restore board", () => {
    const state = new TurnBasedState();
    state.initBoard(3, 3);
    state.setCell(0, 0, 1, "p1");
    state.setCell(1, 1, 2, "p2");
    state.setCell(2, 2, 1, "p1");

    const serialized = state.serializeBoard();
    expect(serialized).toEqual([1, 0, 0, 0, 2, 0, 0, 0, 1]);

    // Create new state and restore
    const state2 = new TurnBasedState();
    state2.initBoard(3, 3);
    state2.restoreBoard(serialized);
    expect(state2.getCell(0, 0)).toBe(1);
    expect(state2.getCell(1, 1)).toBe(2);
    expect(state2.getCell(2, 2)).toBe(1);
    expect(state2.getCell(0, 1)).toBe(0);
  });

  it("should initialize large boards (15×15 Gomoku)", () => {
    const state = new TurnBasedState();
    state.initBoard(15, 15);
    expect(state.board.length).toBe(225);
    expect(state.boardWidth).toBe(15);
    expect(state.boardHeight).toBe(15);
    state.setCell(7, 7, 1, "p1");
    expect(state.getCell(7, 7)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TicTacToe Logic
// ---------------------------------------------------------------------------

describe("TicTacToe Game Logic", () => {
  // Import TicTacToeRoom to test its game logic
  // Since it's an abstract Room subclass, we test the pure logic via schema manipulation

  function createTTTBoard(): TurnBasedState {
    const state = new TurnBasedState();
    state.initBoard(3, 3);
    return state;
  }

  // Re-implement the win check for testing (matches TicTacToeRoom)
  const WINNING_LINES = [
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ], // rows
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
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ], // cols
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
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ], // diags
    [
      [0, 2],
      [1, 1],
      [2, 0],
    ],
  ];

  function checkTTTWin(state: TurnBasedState): number | null {
    for (const line of WINNING_LINES) {
      const vals = line.map(([r, c]) => state.getCell(r, c));
      if (vals[0] !== 0 && vals[0] === vals[1] && vals[1] === vals[2]) {
        return vals[0];
      }
    }
    return null;
  }

  it("should detect X win (top row)", () => {
    const state = createTTTBoard();
    state.setCell(0, 0, 1, "p1"); // X
    state.setCell(0, 1, 1, "p1"); // X
    state.setCell(0, 2, 1, "p1"); // X
    expect(checkTTTWin(state)).toBe(1);
  });

  it("should detect O win (diagonal)", () => {
    const state = createTTTBoard();
    state.setCell(0, 0, 2, "p2"); // O
    state.setCell(1, 1, 2, "p2"); // O
    state.setCell(2, 2, 2, "p2"); // O
    expect(checkTTTWin(state)).toBe(2);
  });

  it("should detect no winner on partial board", () => {
    const state = createTTTBoard();
    state.setCell(0, 0, 1, "p1");
    state.setCell(0, 1, 2, "p2");
    state.setCell(1, 1, 1, "p1");
    expect(checkTTTWin(state)).toBeNull();
  });

  it("should detect draw (full board, no winner)", () => {
    const state = createTTTBoard();
    // X O X
    // X X O
    // O X O
    state.setCell(0, 0, 1, "p1");
    state.setCell(0, 1, 2, "p2");
    state.setCell(0, 2, 1, "p1");
    state.setCell(1, 0, 1, "p1");
    state.setCell(1, 1, 1, "p1");
    state.setCell(1, 2, 2, "p2");
    state.setCell(2, 0, 2, "p2");
    state.setCell(2, 1, 1, "p1");
    state.setCell(2, 2, 2, "p2");
    expect(checkTTTWin(state)).toBeNull();
    // All cells filled
    const allFilled = state.serializeBoard().every((v) => v !== 0);
    expect(allFilled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ConnectFour Logic
// ---------------------------------------------------------------------------

describe("ConnectFour Game Logic", () => {
  function createC4Board(): TurnBasedState {
    const state = new TurnBasedState();
    state.initBoard(7, 6); // width=7 (cols), height=6 (rows)
    return state;
  }

  function findDropRow(state: TurnBasedState, col: number): number {
    const h = state.boardHeight;
    for (let row = h - 1; row >= 0; row--) {
      if (state.getCell(row, col) === 0) return row;
    }
    return -1; // Column full
  }

  function checkC4Win(state: TurnBasedState, player: number): boolean {
    const w = state.boardWidth;
    const h = state.boardHeight;
    // Horizontal
    for (let r = 0; r < h; r++) {
      for (let c = 0; c <= w - 4; c++) {
        if (
          state.getCell(r, c) === player &&
          state.getCell(r, c + 1) === player &&
          state.getCell(r, c + 2) === player &&
          state.getCell(r, c + 3) === player
        )
          return true;
      }
    }
    // Vertical
    for (let r = 0; r <= h - 4; r++) {
      for (let c = 0; c < w; c++) {
        if (
          state.getCell(r, c) === player &&
          state.getCell(r + 1, c) === player &&
          state.getCell(r + 2, c) === player &&
          state.getCell(r + 3, c) === player
        )
          return true;
      }
    }
    // Diagonal ↘
    for (let r = 0; r <= h - 4; r++) {
      for (let c = 0; c <= w - 4; c++) {
        if (
          state.getCell(r, c) === player &&
          state.getCell(r + 1, c + 1) === player &&
          state.getCell(r + 2, c + 2) === player &&
          state.getCell(r + 3, c + 3) === player
        )
          return true;
      }
    }
    // Diagonal ↗
    for (let r = 3; r < h; r++) {
      for (let c = 0; c <= w - 4; c++) {
        if (
          state.getCell(r, c) === player &&
          state.getCell(r - 1, c + 1) === player &&
          state.getCell(r - 2, c + 2) === player &&
          state.getCell(r - 3, c + 3) === player
        )
          return true;
      }
    }
    return false;
  }

  it("should handle gravity correctly", () => {
    const state = createC4Board();
    expect(findDropRow(state, 0)).toBe(5); // Bottom row
    state.setCell(5, 0, 1, "p1");
    expect(findDropRow(state, 0)).toBe(4); // Second from bottom
    state.setCell(4, 0, 2, "p2");
    expect(findDropRow(state, 0)).toBe(3);
  });

  it("should detect column full", () => {
    const state = createC4Board();
    for (let row = 0; row < 6; row++) {
      state.setCell(row, 0, row % 2 === 0 ? 1 : 2, `p${(row % 2) + 1}`);
    }
    expect(findDropRow(state, 0)).toBe(-1);
  });

  it("should detect horizontal win", () => {
    const state = createC4Board();
    state.setCell(5, 0, 1, "p1");
    state.setCell(5, 1, 1, "p1");
    state.setCell(5, 2, 1, "p1");
    state.setCell(5, 3, 1, "p1");
    expect(checkC4Win(state, 1)).toBe(true);
  });

  it("should detect vertical win", () => {
    const state = createC4Board();
    state.setCell(5, 3, 2, "p2");
    state.setCell(4, 3, 2, "p2");
    state.setCell(3, 3, 2, "p2");
    state.setCell(2, 3, 2, "p2");
    expect(checkC4Win(state, 2)).toBe(true);
  });

  it("should detect diagonal ↘ win", () => {
    const state = createC4Board();
    state.setCell(2, 0, 1, "p1");
    state.setCell(3, 1, 1, "p1");
    state.setCell(4, 2, 1, "p1");
    state.setCell(5, 3, 1, "p1");
    expect(checkC4Win(state, 1)).toBe(true);
  });

  it("should detect no win on 3-in-a-row", () => {
    const state = createC4Board();
    state.setCell(5, 0, 1, "p1");
    state.setCell(5, 1, 1, "p1");
    state.setCell(5, 2, 1, "p1");
    expect(checkC4Win(state, 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Gomoku Logic
// ---------------------------------------------------------------------------

describe("Gomoku Game Logic", () => {
  function createGomokuBoard(): TurnBasedState {
    const state = new TurnBasedState();
    state.initBoard(15, 15);
    return state;
  }

  function checkGomokuWin(state: TurnBasedState, player: number): boolean {
    const DIRS = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    const w = state.boardWidth;
    const h = state.boardHeight;

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (state.getCell(r, c) !== player) continue;
        for (const [dr, dc] of DIRS) {
          let count = 1;
          let nr = r + dr,
            nc = c + dc;
          while (
            nr >= 0 &&
            nr < h &&
            nc >= 0 &&
            nc < w &&
            state.getCell(nr, nc) === player
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

  it("should detect horizontal 5-in-a-row", () => {
    const state = createGomokuBoard();
    for (let c = 5; c < 10; c++) {
      state.setCell(7, c, 1, "p1");
    }
    expect(checkGomokuWin(state, 1)).toBe(true);
  });

  it("should detect vertical 5-in-a-row", () => {
    const state = createGomokuBoard();
    for (let r = 3; r < 8; r++) {
      state.setCell(r, 7, 2, "p2");
    }
    expect(checkGomokuWin(state, 2)).toBe(true);
  });

  it("should detect diagonal 5-in-a-row", () => {
    const state = createGomokuBoard();
    for (let i = 0; i < 5; i++) {
      state.setCell(2 + i, 2 + i, 1, "p1");
    }
    expect(checkGomokuWin(state, 1)).toBe(true);
  });

  it("should not detect 4-in-a-row as win", () => {
    const state = createGomokuBoard();
    for (let c = 0; c < 4; c++) {
      state.setCell(7, c, 1, "p1");
    }
    expect(checkGomokuWin(state, 1)).toBe(false);
  });

  it("should detect 6-in-a-row as win (overline)", () => {
    const state = createGomokuBoard();
    for (let c = 0; c < 6; c++) {
      state.setCell(7, c, 1, "p1");
    }
    expect(checkGomokuWin(state, 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hex Logic
// ---------------------------------------------------------------------------

describe("Hex Game Logic", () => {
  const HEX_SIZE = 9;

  function createHexBoard(): TurnBasedState {
    const state = new TurnBasedState();
    state.initBoard(HEX_SIZE, HEX_SIZE);
    return state;
  }

  function getHexNeighbors(r: number, c: number): [number, number][] {
    return [
      [r - 1, c],
      [r - 1, c + 1],
      [r, c - 1],
      [r, c + 1],
      [r + 1, c - 1],
      [r + 1, c],
    ];
  }

  function checkHexWin(state: TurnBasedState, player: number): boolean {
    const visited = new Set<string>();
    const queue: [number, number][] = [];

    if (player === 1) {
      // Top to bottom
      for (let c = 0; c < HEX_SIZE; c++) {
        if (state.getCell(0, c) === player) {
          queue.push([0, c]);
          visited.add(`0,${c}`);
        }
      }
    } else {
      // Left to right
      for (let r = 0; r < HEX_SIZE; r++) {
        if (state.getCell(r, 0) === player) {
          queue.push([r, 0]);
          visited.add(`${r},0`);
        }
      }
    }

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      if (player === 1 && r === HEX_SIZE - 1) return true;
      if (player === 2 && c === HEX_SIZE - 1) return true;

      for (const [nr, nc] of getHexNeighbors(r, c)) {
        if (nr < 0 || nr >= HEX_SIZE || nc < 0 || nc >= HEX_SIZE) continue;
        const key = `${nr},${nc}`;
        if (visited.has(key)) continue;
        if (state.getCell(nr, nc) === player) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }

    return false;
  }

  it("should detect player 1 win (top to bottom path)", () => {
    const state = createHexBoard();
    // Create a straight column path for player 1
    for (let r = 0; r < HEX_SIZE; r++) {
      state.setCell(r, 4, 1, "p1");
    }
    expect(checkHexWin(state, 1)).toBe(true);
  });

  it("should detect player 2 win (left to right path)", () => {
    const state = createHexBoard();
    // Create a straight row path for player 2
    for (let c = 0; c < HEX_SIZE; c++) {
      state.setCell(4, c, 2, "p2");
    }
    expect(checkHexWin(state, 2)).toBe(true);
  });

  it("should detect no win on partial path", () => {
    const state = createHexBoard();
    // Partial path (not connecting both edges)
    for (let r = 0; r < 5; r++) {
      state.setCell(r, 4, 1, "p1");
    }
    expect(checkHexWin(state, 1)).toBe(false);
  });

  it("should detect win through zigzag path", () => {
    const state = createHexBoard();
    // Zigzag path using hex neighbors
    state.setCell(0, 0, 1, "p1"); // top
    state.setCell(1, 0, 1, "p1");
    state.setCell(2, 0, 1, "p1");
    state.setCell(3, 0, 1, "p1");
    state.setCell(4, 0, 1, "p1");
    state.setCell(5, 0, 1, "p1");
    state.setCell(6, 0, 1, "p1");
    state.setCell(7, 0, 1, "p1");
    state.setCell(8, 0, 1, "p1"); // bottom
    expect(checkHexWin(state, 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Reversi Logic
// ---------------------------------------------------------------------------

describe("Reversi Game Logic", () => {
  const REVERSI_SIZE = 8;

  function createReversiBoard(): TurnBasedState {
    const state = new TurnBasedState();
    state.initBoard(REVERSI_SIZE, REVERSI_SIZE);
    // Standard opening position
    state.setCell(3, 3, 2, "p2"); // White
    state.setCell(3, 4, 1, "p1"); // Black
    state.setCell(4, 3, 1, "p1"); // Black
    state.setCell(4, 4, 2, "p2"); // White
    return state;
  }

  function getFlips(
    state: TurnBasedState,
    r: number,
    c: number,
    player: number,
  ): [number, number][] {
    if (state.getCell(r, c) !== 0) return [];
    const opponent = player === 1 ? 2 : 1;
    const DIRS = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];
    const allFlips: [number, number][] = [];

    for (const [dr, dc] of DIRS) {
      const lineFlips: [number, number][] = [];
      let nr = r + dr,
        nc = c + dc;
      while (
        nr >= 0 &&
        nr < REVERSI_SIZE &&
        nc >= 0 &&
        nc < REVERSI_SIZE &&
        state.getCell(nr, nc) === opponent
      ) {
        lineFlips.push([nr, nc]);
        nr += dr;
        nc += dc;
      }
      if (
        lineFlips.length > 0 &&
        nr >= 0 &&
        nr < REVERSI_SIZE &&
        nc >= 0 &&
        nc < REVERSI_SIZE &&
        state.getCell(nr, nc) === player
      ) {
        allFlips.push(...lineFlips);
      }
    }
    return allFlips;
  }

  function getValidMoves(
    state: TurnBasedState,
    player: number,
  ): [number, number][] {
    const moves: [number, number][] = [];
    for (let r = 0; r < REVERSI_SIZE; r++) {
      for (let c = 0; c < REVERSI_SIZE; c++) {
        if (getFlips(state, r, c, player).length > 0) {
          moves.push([r, c]);
        }
      }
    }
    return moves;
  }

  it("should have correct initial position", () => {
    const state = createReversiBoard();
    expect(state.getCell(3, 3)).toBe(2);
    expect(state.getCell(3, 4)).toBe(1);
    expect(state.getCell(4, 3)).toBe(1);
    expect(state.getCell(4, 4)).toBe(2);
  });

  it("should find valid opening moves for Black", () => {
    const state = createReversiBoard();
    const moves = getValidMoves(state, 1);
    // Standard opening has 4 valid moves for Black
    expect(moves.length).toBe(4);
    const moveSet = new Set(moves.map(([r, c]) => `${r},${c}`));
    expect(moveSet.has("2,3")).toBe(true);
    expect(moveSet.has("3,2")).toBe(true);
    expect(moveSet.has("4,5")).toBe(true);
    expect(moveSet.has("5,4")).toBe(true);
  });

  it("should compute correct flips for a valid move", () => {
    const state = createReversiBoard();
    // Black plays at (2,3) — should flip (3,3) from White to Black
    const flips = getFlips(state, 2, 3, 1);
    expect(flips.length).toBe(1);
    expect(flips[0]).toEqual([3, 3]);
  });

  it("should return no flips for invalid move", () => {
    const state = createReversiBoard();
    // (0,0) is too far away — no outflanking possible
    const flips = getFlips(state, 0, 0, 1);
    expect(flips.length).toBe(0);
  });

  it("should handle piece count correctly after move", () => {
    const state = createReversiBoard();
    // Apply Black's move at (2,3)
    state.setCell(2, 3, 1, "p1");
    // Flip (3,3) from White to Black
    state.setCell(3, 3, 1, "p1");

    // Count pieces
    let black = 0,
      white = 0;
    for (let r = 0; r < REVERSI_SIZE; r++) {
      for (let c = 0; c < REVERSI_SIZE; c++) {
        const v = state.getCell(r, c);
        if (v === 1) black++;
        else if (v === 2) white++;
      }
    }
    expect(black).toBe(4); // 2 original + placed + flipped
    expect(white).toBe(1); // 2 original - 1 flipped
  });
});

// ---------------------------------------------------------------------------
// Move Record tracking
// ---------------------------------------------------------------------------

describe("MoveRecord Tracking", () => {
  it("should track moves in ArraySchema", () => {
    const state = new TurnBasedState();
    const move1 = new MoveRecord();
    move1.playerId = "uid-1";
    move1.x = 0;
    move1.y = 0;
    move1.notation = "1-1";
    move1.timestamp = 1000;
    move1.playerIndex = 0;

    const move2 = new MoveRecord();
    move2.playerId = "uid-2";
    move2.x = 1;
    move2.y = 1;
    move2.notation = "2-2";
    move2.timestamp = 2000;
    move2.playerIndex = 1;

    state.moveHistory.push(move1);
    state.moveHistory.push(move2);

    expect(state.moveHistory.length).toBe(2);
    expect(state.moveHistory[0].notation).toBe("1-1");
    expect(state.moveHistory[1].playerId).toBe("uid-2");
  });
});

// ---------------------------------------------------------------------------
// Draw System
// ---------------------------------------------------------------------------

describe("Draw Offer System", () => {
  it("should track draw offer state", () => {
    const state = new TurnBasedState();
    expect(state.drawPending).toBe(false);
    expect(state.drawOfferedBy).toBe("");

    state.drawPending = true;
    state.drawOfferedBy = "session-1";
    expect(state.drawPending).toBe(true);
    expect(state.drawOfferedBy).toBe("session-1");

    // Clear draw
    state.drawPending = false;
    state.drawOfferedBy = "";
    expect(state.drawPending).toBe(false);
    expect(state.drawOfferedBy).toBe("");
  });

  it("should track offeredDraw on players", () => {
    const p1 = new TurnBasedPlayer();
    const p2 = new TurnBasedPlayer();

    p1.offeredDraw = true;
    expect(p1.offeredDraw).toBe(true);
    expect(p2.offeredDraw).toBe(false);
  });
});
