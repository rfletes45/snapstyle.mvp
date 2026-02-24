/**
 * BattleshipRoom Unit Tests
 *
 * Tests schemas, constants, placement validation, combat logic,
 * win detection, phase machine, fog-of-war, and spectator support
 * for the Battleship game room.
 *
 * Pattern: test schema classes + pure game logic directly (no Colyseus
 * Room instantiation). Matches TurnBasedRoom.test.ts / Phase4Rooms.test.ts.
 *
 * @see colyseus-server/src/schemas/battleship.ts
 * @see colyseus-server/src/rooms/turnbased/BattleshipRoom.ts
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
  deleteGameAndInvite: jest.fn().mockResolvedValue(undefined),
  markGameVacant: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("colyseus", () => ({
  Room: class MockRoom {
    state: any;
    clients: any[] = [];
    clock = {
      setInterval: jest.fn().mockReturnValue({ clear: jest.fn() }),
    };
    roomId = "test-room-id";
    maxClients = 12;
    patchRate = 100;
    autoDispose = true;
    setState(s: any) {
      this.state = s;
    }
    broadcast = jest.fn();
    allowReconnection = jest.fn();
  },
  Client: class MockClient {
    sessionId = "mock-session";
    send = jest.fn();
    error = jest.fn();
    leave = jest.fn();
  },
}));

import { ArraySchema, MapSchema } from "@colyseus/schema";
import {
  BATTLESHIP_GRID_SIZE,
  BattleshipPlayer,
  BattleshipState,
  FLEET,
  type PlayerBoard,
  type ShipDef,
  type ShipPlacement,
  ShotRecord,
  SunkShip,
  SunkShipCell,
  TOTAL_SHIP_CELLS,
} from "../../src/schemas/battleship";

// =============================================================================
// Schema Tests
// =============================================================================

describe("BattleshipState Schema", () => {
  it("should create state with correct default values", () => {
    const state = new BattleshipState();
    expect(state.phase).toBe("waiting");
    expect(state.gameType).toBe("battleship");
    expect(state.gameId).toBe("");
    expect(state.firestoreGameId).toBe("");
    expect(state.traceId).toBe("");
    expect(state.isRated).toBe(true);
    expect(state.maxPlayers).toBe(2);
    expect(state.currentTurnUid).toBe("");
    expect(state.turnNumber).toBe(0);
    expect(state.winnerId).toBe("");
    expect(state.winReason).toBe("");
    expect(state.placementTimeRemaining).toBe(90000);
    expect(state.turnTimeRemaining).toBe(25000);
    expect(state.timerRunning).toBe(false);
    expect(state.lastActionType).toBe("");
    expect(state.lastActionRow).toBe(0);
    expect(state.lastActionCol).toBe(0);
    expect(state.lastActionShipName).toBe("");
    expect(state.spectatorCount).toBe(0);
    expect(state.maxSpectators).toBe(10);
    expect(state.errorCode).toBe("");
    expect(state.errorMessage).toBe("");
  });

  it("should have empty players MapSchema by default", () => {
    const state = new BattleshipState();
    expect(state.players).toBeInstanceOf(MapSchema);
    expect(state.players.size).toBe(0);
  });

  it("should have empty shotHistory ArraySchema by default", () => {
    const state = new BattleshipState();
    expect(state.shotHistory).toBeInstanceOf(ArraySchema);
    expect(state.shotHistory.length).toBe(0);
  });

  it("should have empty sunkShips ArraySchema by default", () => {
    const state = new BattleshipState();
    expect(state.sunkShips).toBeInstanceOf(ArraySchema);
    expect(state.sunkShips.length).toBe(0);
  });

  it("should have empty spectators MapSchema by default", () => {
    const state = new BattleshipState();
    expect(state.spectators).toBeInstanceOf(MapSchema);
    expect(state.spectators.size).toBe(0);
  });
});

describe("BattleshipPlayer Schema", () => {
  it("should create player with correct defaults", () => {
    const player = new BattleshipPlayer();
    expect(player.placementReady).toBe(false);
    expect(player.shipCellsRemaining).toBe(TOTAL_SHIP_CELLS);
    expect(player.shipsRemaining).toBe(FLEET.length);
    expect(player.shotsFired).toBe(0);
    expect(player.hits).toBe(0);
    expect(player.misses).toBe(0);
    // Inherited from Player
    expect(player.connected).toBe(true);
    expect(player.ready).toBe(false);
    expect(player.score).toBe(0);
    expect(player.uid).toBe("");
    expect(player.displayName).toBe("");
  });

  it("should track players in MapSchema", () => {
    const state = new BattleshipState();
    const p1 = new BattleshipPlayer();
    p1.uid = "uid-1";
    p1.displayName = "Alice";
    p1.playerIndex = 0;

    const p2 = new BattleshipPlayer();
    p2.uid = "uid-2";
    p2.displayName = "Bob";
    p2.playerIndex = 1;

    state.players.set("session-1", p1);
    state.players.set("session-2", p2);

    expect(state.players.size).toBe(2);
    expect(state.players.get("session-1")!.displayName).toBe("Alice");
    expect(state.players.get("session-2")!.uid).toBe("uid-2");
  });

  it("should decrement ship cell count correctly", () => {
    const player = new BattleshipPlayer();
    expect(player.shipCellsRemaining).toBe(17); // 5+4+3+3+2
    player.shipCellsRemaining--;
    expect(player.shipCellsRemaining).toBe(16);
  });

  it("should decrement ships remaining on sunk", () => {
    const player = new BattleshipPlayer();
    expect(player.shipsRemaining).toBe(5);
    player.shipsRemaining--;
    expect(player.shipsRemaining).toBe(4);
  });
});

describe("ShotRecord Schema", () => {
  it("should create with correct defaults", () => {
    const shot = new ShotRecord();
    expect(shot.row).toBe(0);
    expect(shot.col).toBe(0);
    expect(shot.shooterUid).toBe("");
    expect(shot.targetUid).toBe("");
    expect(shot.result).toBe("miss");
    expect(shot.shipId).toBe("");
    expect(shot.shipName).toBe("");
    expect(shot.turnNumber).toBe(0);
  });

  it("should store shot details correctly", () => {
    const shot = new ShotRecord();
    shot.row = 4;
    shot.col = 7;
    shot.shooterUid = "uid-1";
    shot.targetUid = "uid-2";
    shot.result = "hit";
    shot.shipId = "carrier";
    shot.shipName = "Carrier";
    shot.turnNumber = 5;

    expect(shot.row).toBe(4);
    expect(shot.col).toBe(7);
    expect(shot.result).toBe("hit");
    expect(shot.shipId).toBe("carrier");
    expect(shot.turnNumber).toBe(5);
  });

  it("should store in ArraySchema", () => {
    const state = new BattleshipState();
    const s1 = new ShotRecord();
    s1.row = 0;
    s1.col = 0;
    s1.result = "miss";
    state.shotHistory.push(s1);

    const s2 = new ShotRecord();
    s2.row = 3;
    s2.col = 5;
    s2.result = "hit";
    s2.shipId = "destroyer";
    state.shotHistory.push(s2);

    expect(state.shotHistory.length).toBe(2);
    expect(state.shotHistory[0].result).toBe("miss");
    expect(state.shotHistory[1].result).toBe("hit");
    expect(state.shotHistory[1].shipId).toBe("destroyer");
  });
});

describe("SunkShip + SunkShipCell Schema", () => {
  it("should create SunkShipCell with defaults", () => {
    const cell = new SunkShipCell();
    expect(cell.row).toBe(0);
    expect(cell.col).toBe(0);
  });

  it("should create SunkShip with defaults", () => {
    const ship = new SunkShip();
    expect(ship.shipId).toBe("");
    expect(ship.shipName).toBe("");
    expect(ship.size).toBe(0);
    expect(ship.ownerUid).toBe("");
    expect(ship.cells).toBeInstanceOf(ArraySchema);
    expect(ship.cells.length).toBe(0);
  });

  it("should build sunk ship outline with cells", () => {
    const ship = new SunkShip();
    ship.shipId = "destroyer";
    ship.shipName = "Destroyer";
    ship.size = 2;
    ship.ownerUid = "uid-2";

    const c1 = new SunkShipCell();
    c1.row = 3;
    c1.col = 5;
    const c2 = new SunkShipCell();
    c2.row = 3;
    c2.col = 6;
    ship.cells.push(c1);
    ship.cells.push(c2);

    expect(ship.cells.length).toBe(2);
    expect(ship.cells[0].row).toBe(3);
    expect(ship.cells[0].col).toBe(5);
    expect(ship.cells[1].col).toBe(6);
  });

  it("should store sunk ships in state ArraySchema", () => {
    const state = new BattleshipState();
    const ship = new SunkShip();
    ship.shipId = "carrier";
    ship.shipName = "Carrier";
    ship.size = 5;
    ship.ownerUid = "uid-1";

    for (let i = 0; i < 5; i++) {
      const cell = new SunkShipCell();
      cell.row = 0;
      cell.col = i;
      ship.cells.push(cell);
    }
    state.sunkShips.push(ship);

    expect(state.sunkShips.length).toBe(1);
    expect(state.sunkShips[0].shipName).toBe("Carrier");
    expect(state.sunkShips[0].cells.length).toBe(5);
  });
});

// =============================================================================
// Fleet & Constants Tests
// =============================================================================

describe("Battleship Constants", () => {
  it("should have grid size of 10", () => {
    expect(BATTLESHIP_GRID_SIZE).toBe(10);
  });

  it("should define exactly 5 ships in FLEET", () => {
    expect(FLEET).toHaveLength(5);
  });

  it("should have correct ship definitions", () => {
    const expected = [
      { id: "carrier", name: "Carrier", size: 5 },
      { id: "battleship", name: "Battleship", size: 4 },
      { id: "cruiser", name: "Cruiser", size: 3 },
      { id: "submarine", name: "Submarine", size: 3 },
      { id: "destroyer", name: "Destroyer", size: 2 },
    ];
    expect(FLEET).toEqual(expected);
  });

  it("should have unique ship IDs", () => {
    const ids = FLEET.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have correct TOTAL_SHIP_CELLS (5+4+3+3+2 = 17)", () => {
    expect(TOTAL_SHIP_CELLS).toBe(17);
    expect(FLEET.reduce((sum, s) => sum + s.size, 0)).toBe(17);
  });

  it("should have sizes in descending order", () => {
    for (let i = 0; i < FLEET.length - 1; i++) {
      expect(FLEET[i].size).toBeGreaterThanOrEqual(FLEET[i + 1].size);
    }
  });
});

// =============================================================================
// Placement Validation Tests (pure logic, mirroring BattleshipRoom logic)
// =============================================================================

describe("Placement Validation", () => {
  /**
   * Re-implement placement helpers as pure functions for testing.
   * These match the logic in BattleshipRoom exactly.
   */
  function computeCells(
    shipDef: ShipDef,
    startRow: number,
    startCol: number,
    orientation: "horizontal" | "vertical",
  ): Array<{ row: number; col: number }> {
    const cells: Array<{ row: number; col: number }> = [];
    for (let i = 0; i < shipDef.size; i++) {
      cells.push({
        row: orientation === "vertical" ? startRow + i : startRow,
        col: orientation === "horizontal" ? startCol + i : startCol,
      });
    }
    return cells;
  }

  function validatePlacement(
    board: PlayerBoard,
    shipDef: ShipDef,
    startRow: number,
    startCol: number,
    orientation: string,
  ): string | null {
    if (orientation !== "horizontal" && orientation !== "vertical") {
      return "Orientation must be 'horizontal' or 'vertical'";
    }
    if (
      typeof startRow !== "number" ||
      typeof startCol !== "number" ||
      startRow < 0 ||
      startCol < 0
    ) {
      return "Invalid starting position";
    }

    if (orientation === "horizontal") {
      if (
        startRow >= BATTLESHIP_GRID_SIZE ||
        startCol + shipDef.size > BATTLESHIP_GRID_SIZE
      ) {
        return "Ship extends beyond grid boundary";
      }
    } else {
      if (
        startCol >= BATTLESHIP_GRID_SIZE ||
        startRow + shipDef.size > BATTLESHIP_GRID_SIZE
      ) {
        return "Ship extends beyond grid boundary";
      }
    }

    const cells = computeCells(
      shipDef,
      startRow,
      startCol,
      orientation as "horizontal" | "vertical",
    );
    for (const cell of cells) {
      const existing = board.grid.get(`${cell.row},${cell.col}`);
      if (existing && existing !== shipDef.id) {
        return `Overlaps with ${existing}`;
      }
    }

    return null;
  }

  function createEmptyBoard(): PlayerBoard {
    return {
      placements: [],
      grid: new Map<string, string>(),
      shotsReceived: new Set<string>(),
    };
  }

  function placeShipOnBoard(
    board: PlayerBoard,
    shipDef: ShipDef,
    startRow: number,
    startCol: number,
    orientation: "horizontal" | "vertical",
  ): void {
    const cells = computeCells(shipDef, startRow, startCol, orientation);
    board.placements.push({
      shipId: shipDef.id,
      shipName: shipDef.name,
      size: shipDef.size,
      startRow,
      startCol,
      orientation,
      cells,
      hitsRemaining: shipDef.size,
    });
    for (const cell of cells) {
      board.grid.set(`${cell.row},${cell.col}`, shipDef.id);
    }
  }

  // ── computeCells ────────────────────────────────────────────────────────

  describe("computeCells", () => {
    it("should compute horizontal cells correctly", () => {
      const cells = computeCells(FLEET[0], 0, 0, "horizontal"); // Carrier, size 5
      expect(cells).toEqual([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
        { row: 0, col: 4 },
      ]);
    });

    it("should compute vertical cells correctly", () => {
      const cells = computeCells(FLEET[4], 3, 7, "vertical"); // Destroyer, size 2
      expect(cells).toEqual([
        { row: 3, col: 7 },
        { row: 4, col: 7 },
      ]);
    });

    it("should compute cells for each ship size", () => {
      for (const ship of FLEET) {
        const cells = computeCells(ship, 0, 0, "horizontal");
        expect(cells).toHaveLength(ship.size);
        // All on row 0 for horizontal
        cells.forEach((c, i) => {
          expect(c.row).toBe(0);
          expect(c.col).toBe(i);
        });
      }
    });

    it("should compute single cell for size-1 hypothetical ship", () => {
      const tiny: ShipDef = { id: "tiny", name: "Tiny", size: 1 };
      const cells = computeCells(tiny, 5, 5, "horizontal");
      expect(cells).toEqual([{ row: 5, col: 5 }]);
    });
  });

  // ── Bounds checking ─────────────────────────────────────────────────────

  describe("Bounds checking", () => {
    it("should accept placement within bounds (horizontal)", () => {
      const board = createEmptyBoard();
      // Carrier (5) starting at col 5: occupies 5,6,7,8,9 → exactly fits
      expect(validatePlacement(board, FLEET[0], 0, 5, "horizontal")).toBeNull();
    });

    it("should accept placement within bounds (vertical)", () => {
      const board = createEmptyBoard();
      // Carrier (5) starting at row 5: occupies 5,6,7,8,9 → exactly fits
      expect(validatePlacement(board, FLEET[0], 5, 0, "vertical")).toBeNull();
    });

    it("should reject horizontal placement extending beyond east edge", () => {
      const board = createEmptyBoard();
      // Carrier (5) at col 6: would need cols 6,7,8,9,10 → out of bounds
      expect(validatePlacement(board, FLEET[0], 0, 6, "horizontal")).toBe(
        "Ship extends beyond grid boundary",
      );
    });

    it("should reject vertical placement extending beyond south edge", () => {
      const board = createEmptyBoard();
      // Carrier (5) at row 6: would need rows 6,7,8,9,10 → out of bounds
      expect(validatePlacement(board, FLEET[0], 6, 0, "vertical")).toBe(
        "Ship extends beyond grid boundary",
      );
    });

    it("should reject negative coordinates", () => {
      const board = createEmptyBoard();
      expect(validatePlacement(board, FLEET[4], -1, 0, "horizontal")).toBe(
        "Invalid starting position",
      );
      expect(validatePlacement(board, FLEET[4], 0, -1, "horizontal")).toBe(
        "Invalid starting position",
      );
    });

    it("should reject row beyond grid for horizontal ship", () => {
      const board = createEmptyBoard();
      expect(validatePlacement(board, FLEET[4], 10, 0, "horizontal")).toBe(
        "Ship extends beyond grid boundary",
      );
    });

    it("should reject col beyond grid for vertical ship", () => {
      const board = createEmptyBoard();
      expect(validatePlacement(board, FLEET[4], 0, 10, "vertical")).toBe(
        "Ship extends beyond grid boundary",
      );
    });

    it("should accept destroyer at bottom-right corner horizontal", () => {
      const board = createEmptyBoard();
      // Destroyer (2) at row 9, col 8 → cols 8,9 ✓
      expect(validatePlacement(board, FLEET[4], 9, 8, "horizontal")).toBeNull();
    });

    it("should accept destroyer at bottom-right corner vertical", () => {
      const board = createEmptyBoard();
      // Destroyer (2) at row 8, col 9 → rows 8,9 ✓
      expect(validatePlacement(board, FLEET[4], 8, 9, "vertical")).toBeNull();
    });
  });

  // ── Orientation validation ──────────────────────────────────────────────

  describe("Orientation validation", () => {
    it("should accept 'horizontal' orientation", () => {
      const board = createEmptyBoard();
      expect(validatePlacement(board, FLEET[4], 0, 0, "horizontal")).toBeNull();
    });

    it("should accept 'vertical' orientation", () => {
      const board = createEmptyBoard();
      expect(validatePlacement(board, FLEET[4], 0, 0, "vertical")).toBeNull();
    });

    it("should reject invalid orientation", () => {
      const board = createEmptyBoard();
      expect(validatePlacement(board, FLEET[4], 0, 0, "diagonal")).toBe(
        "Orientation must be 'horizontal' or 'vertical'",
      );
    });

    it("should reject empty orientation", () => {
      const board = createEmptyBoard();
      expect(validatePlacement(board, FLEET[4], 0, 0, "")).toBe(
        "Orientation must be 'horizontal' or 'vertical'",
      );
    });
  });

  // ── Overlap detection ───────────────────────────────────────────────────

  describe("Overlap detection", () => {
    it("should detect overlapping ships", () => {
      const board = createEmptyBoard();
      // Place carrier horizontally at (0,0)
      placeShipOnBoard(board, FLEET[0], 0, 0, "horizontal");

      // Try to place battleship vertically at (0,2) → overlaps at (0,2)
      expect(validatePlacement(board, FLEET[1], 0, 2, "vertical")).toBe(
        "Overlaps with carrier",
      );
    });

    it("should allow non-overlapping placements", () => {
      const board = createEmptyBoard();
      placeShipOnBoard(board, FLEET[0], 0, 0, "horizontal"); // Carrier at row 0
      // Battleship at row 1 — no overlap
      expect(validatePlacement(board, FLEET[1], 1, 0, "horizontal")).toBeNull();
    });

    it("should allow self-overlap for re-placement of same ship", () => {
      const board = createEmptyBoard();
      placeShipOnBoard(board, FLEET[0], 0, 0, "horizontal");
      // Re-placing carrier at same position should be allowed
      expect(validatePlacement(board, FLEET[0], 0, 0, "horizontal")).toBeNull();
    });

    it("should allow L-shaped adjacent placements", () => {
      const board = createEmptyBoard();
      placeShipOnBoard(board, FLEET[0], 0, 0, "horizontal"); // Row 0, cols 0-4
      // Battleship vertical starting at (1, 4) — adjacent, no overlap
      expect(validatePlacement(board, FLEET[1], 1, 4, "vertical")).toBeNull();
    });

    it("should detect overlap at intersection of perpendicular ships", () => {
      const board = createEmptyBoard();
      placeShipOnBoard(board, FLEET[0], 3, 0, "horizontal"); // Row 3, cols 0-4
      // Cruiser vertical at (1, 3) → occupies rows 1,2,3 at col 3 → overlap at (3,3)
      expect(validatePlacement(board, FLEET[2], 1, 3, "vertical")).toBe(
        "Overlaps with carrier",
      );
    });
  });

  // ── Full fleet placement ────────────────────────────────────────────────

  describe("Full fleet placement", () => {
    it("should place all 5 ships without overlap", () => {
      const board = createEmptyBoard();
      // Place each ship on a separate row, horizontally
      FLEET.forEach((ship, i) => {
        const err = validatePlacement(board, ship, i, 0, "horizontal");
        expect(err).toBeNull();
        placeShipOnBoard(board, ship, i, 0, "horizontal");
      });

      expect(board.placements).toHaveLength(5);
      expect(board.grid.size).toBe(TOTAL_SHIP_CELLS);
    });

    it("should account for all 17 cells across fleet", () => {
      const board = createEmptyBoard();
      FLEET.forEach((ship, i) => {
        placeShipOnBoard(board, ship, i, 0, "horizontal");
      });

      // All grid entries should map to exactly 17 cells
      expect(board.grid.size).toBe(17);

      // Each cell should map to a valid ship ID
      board.grid.forEach((shipId) => {
        expect(FLEET.some((f) => f.id === shipId)).toBe(true);
      });
    });
  });
});

// =============================================================================
// Auto-Place Fleet Tests (pure logic)
// =============================================================================

describe("autoPlaceFleet logic", () => {
  /**
   * Re-implement autoPlaceFleet as a pure function for testing.
   */
  function computeCells(
    shipDef: ShipDef,
    startRow: number,
    startCol: number,
    orientation: "horizontal" | "vertical",
  ): Array<{ row: number; col: number }> {
    const cells: Array<{ row: number; col: number }> = [];
    for (let i = 0; i < shipDef.size; i++) {
      cells.push({
        row: orientation === "vertical" ? startRow + i : startRow,
        col: orientation === "horizontal" ? startCol + i : startCol,
      });
    }
    return cells;
  }

  function validatePlacement(
    board: PlayerBoard,
    shipDef: ShipDef,
    startRow: number,
    startCol: number,
    orientation: string,
  ): string | null {
    if (orientation !== "horizontal" && orientation !== "vertical")
      return "bad";
    if (startRow < 0 || startCol < 0) return "bad";
    if (orientation === "horizontal") {
      if (
        startRow >= BATTLESHIP_GRID_SIZE ||
        startCol + shipDef.size > BATTLESHIP_GRID_SIZE
      )
        return "bad";
    } else {
      if (
        startCol >= BATTLESHIP_GRID_SIZE ||
        startRow + shipDef.size > BATTLESHIP_GRID_SIZE
      )
        return "bad";
    }
    const cells = computeCells(
      shipDef,
      startRow,
      startCol,
      orientation as "horizontal" | "vertical",
    );
    for (const cell of cells) {
      const existing = board.grid.get(`${cell.row},${cell.col}`);
      if (existing && existing !== shipDef.id) return "overlap";
    }
    return null;
  }

  function autoPlaceFleet(): PlayerBoard {
    const board: PlayerBoard = {
      placements: [],
      grid: new Map<string, string>(),
      shotsReceived: new Set<string>(),
    };

    for (const shipDef of FLEET) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 200) {
        attempts++;
        const orientation: "horizontal" | "vertical" =
          Math.random() < 0.5 ? "horizontal" : "vertical";
        const maxRow =
          orientation === "vertical"
            ? BATTLESHIP_GRID_SIZE - shipDef.size
            : BATTLESHIP_GRID_SIZE - 1;
        const maxCol =
          orientation === "horizontal"
            ? BATTLESHIP_GRID_SIZE - shipDef.size
            : BATTLESHIP_GRID_SIZE - 1;

        const startRow = Math.floor(Math.random() * (maxRow + 1));
        const startCol = Math.floor(Math.random() * (maxCol + 1));

        const err = validatePlacement(
          board,
          shipDef,
          startRow,
          startCol,
          orientation,
        );
        if (!err) {
          const cells = computeCells(shipDef, startRow, startCol, orientation);
          board.placements.push({
            shipId: shipDef.id,
            shipName: shipDef.name,
            size: shipDef.size,
            startRow,
            startCol,
            orientation,
            cells,
            hitsRemaining: shipDef.size,
          });
          for (const cell of cells) {
            board.grid.set(`${cell.row},${cell.col}`, shipDef.id);
          }
          placed = true;
        }
      }
    }

    return board;
  }

  it("should place all 5 ships", () => {
    const board = autoPlaceFleet();
    expect(board.placements).toHaveLength(5);
  });

  it("should place exactly 17 total cells", () => {
    const board = autoPlaceFleet();
    expect(board.grid.size).toBe(TOTAL_SHIP_CELLS);
  });

  it("should have no overlapping cells", () => {
    const board = autoPlaceFleet();
    const allCells: string[] = [];
    for (const p of board.placements) {
      for (const c of p.cells) {
        allCells.push(`${c.row},${c.col}`);
      }
    }
    expect(new Set(allCells).size).toBe(allCells.length);
  });

  it("should keep all cells within grid bounds", () => {
    const board = autoPlaceFleet();
    for (const p of board.placements) {
      for (const c of p.cells) {
        expect(c.row).toBeGreaterThanOrEqual(0);
        expect(c.row).toBeLessThan(BATTLESHIP_GRID_SIZE);
        expect(c.col).toBeGreaterThanOrEqual(0);
        expect(c.col).toBeLessThan(BATTLESHIP_GRID_SIZE);
      }
    }
  });

  it("should produce valid results across 20 random runs", () => {
    for (let run = 0; run < 20; run++) {
      const board = autoPlaceFleet();
      expect(board.placements).toHaveLength(5);
      expect(board.grid.size).toBe(TOTAL_SHIP_CELLS);
    }
  });

  it("should respect ship sizes", () => {
    const board = autoPlaceFleet();
    for (const p of board.placements) {
      const shipDef = FLEET.find((f) => f.id === p.shipId)!;
      expect(p.cells).toHaveLength(shipDef.size);
      expect(p.size).toBe(shipDef.size);
    }
  });

  it("should set correct hitsRemaining for each ship", () => {
    const board = autoPlaceFleet();
    for (const p of board.placements) {
      expect(p.hitsRemaining).toBe(p.size);
    }
  });
});

// =============================================================================
// Combat Logic Tests
// =============================================================================

describe("Combat Logic", () => {
  /**
   * Re-implement processShot as a pure function for testing.
   */
  function createFullBoard(startRowOffset: number = 0): PlayerBoard {
    const board: PlayerBoard = {
      placements: [],
      grid: new Map<string, string>(),
      shotsReceived: new Set<string>(),
    };
    FLEET.forEach((ship, i) => {
      const row = startRowOffset + i;
      const cells: Array<{ row: number; col: number }> = [];
      for (let c = 0; c < ship.size; c++) {
        cells.push({ row, col: c });
        board.grid.set(`${row},${c}`, ship.id);
      }
      board.placements.push({
        shipId: ship.id,
        shipName: ship.name,
        size: ship.size,
        startRow: row,
        startCol: 0,
        orientation: "horizontal",
        cells,
        hitsRemaining: ship.size,
      });
    });
    return board;
  }

  interface ProcessShotResult {
    result: "miss" | "hit" | "sunk";
    shipId: string;
    shipName: string;
    playerStats: {
      shotsFired: number;
      hits: number;
      misses: number;
      shipCellsRemaining: number;
      shipsRemaining: number;
    };
    isGameOver: boolean;
  }

  function processShot(
    targetBoard: PlayerBoard,
    row: number,
    col: number,
    shooterStats: {
      shotsFired: number;
      hits: number;
      misses: number;
    },
    targetStats: {
      shipCellsRemaining: number;
      shipsRemaining: number;
    },
  ): ProcessShotResult {
    const key = `${row},${col}`;
    targetBoard.shotsReceived.add(key);
    const shipId = targetBoard.grid.get(key);

    shooterStats.shotsFired++;

    let result: "miss" | "hit" | "sunk" = "miss";
    let hitShipId = "";
    let hitShipName = "";

    if (shipId) {
      const placement = targetBoard.placements.find((p) => p.shipId === shipId);
      if (placement) {
        placement.hitsRemaining--;
        shooterStats.hits++;
        targetStats.shipCellsRemaining--;

        if (placement.hitsRemaining <= 0) {
          result = "sunk";
          targetStats.shipsRemaining--;
        } else {
          result = "hit";
        }
        hitShipId = placement.shipId;
        hitShipName = placement.shipName;
      }
    } else {
      shooterStats.misses++;
    }

    return {
      result,
      shipId: hitShipId,
      shipName: hitShipName,
      playerStats: {
        ...shooterStats,
        ...targetStats,
      },
      isGameOver:
        targetStats.shipCellsRemaining <= 0 || targetStats.shipsRemaining <= 0,
    };
  }

  it("should register a miss on empty cell", () => {
    const board = createFullBoard();
    const shooter = { shotsFired: 0, hits: 0, misses: 0 };
    const target = {
      shipCellsRemaining: TOTAL_SHIP_CELLS,
      shipsRemaining: FLEET.length,
    };

    // Fire at (9, 9) — no ship there
    const result = processShot(board, 9, 9, shooter, target);
    expect(result.result).toBe("miss");
    expect(result.shipId).toBe("");
    expect(shooter.shotsFired).toBe(1);
    expect(shooter.misses).toBe(1);
    expect(shooter.hits).toBe(0);
    expect(target.shipCellsRemaining).toBe(TOTAL_SHIP_CELLS);
    expect(result.isGameOver).toBe(false);
  });

  it("should register a hit on occupied cell", () => {
    const board = createFullBoard();
    const shooter = { shotsFired: 0, hits: 0, misses: 0 };
    const target = {
      shipCellsRemaining: TOTAL_SHIP_CELLS,
      shipsRemaining: FLEET.length,
    };

    // Fire at (0, 0) — Carrier is there
    const result = processShot(board, 0, 0, shooter, target);
    expect(result.result).toBe("hit");
    expect(result.shipId).toBe("carrier");
    expect(result.shipName).toBe("Carrier");
    expect(shooter.hits).toBe(1);
    expect(target.shipCellsRemaining).toBe(TOTAL_SHIP_CELLS - 1);
    expect(target.shipsRemaining).toBe(FLEET.length); // Not sunk yet
    expect(result.isGameOver).toBe(false);
  });

  it("should register sunk when all cells of a ship are hit", () => {
    const board = createFullBoard();
    const shooter = { shotsFired: 0, hits: 0, misses: 0 };
    const target = {
      shipCellsRemaining: TOTAL_SHIP_CELLS,
      shipsRemaining: FLEET.length,
    };

    // Sink the destroyer (size 2) at row 4, cols 0-1
    processShot(board, 4, 0, shooter, target);
    const result = processShot(board, 4, 1, shooter, target);
    expect(result.result).toBe("sunk");
    expect(result.shipId).toBe("destroyer");
    expect(target.shipsRemaining).toBe(FLEET.length - 1);
    expect(result.isGameOver).toBe(false);
  });

  it("should track shotsReceived on target board", () => {
    const board = createFullBoard();
    const shooter = { shotsFired: 0, hits: 0, misses: 0 };
    const target = {
      shipCellsRemaining: TOTAL_SHIP_CELLS,
      shipsRemaining: FLEET.length,
    };

    processShot(board, 0, 0, shooter, target);
    processShot(board, 5, 5, shooter, target);
    expect(board.shotsReceived.has("0,0")).toBe(true);
    expect(board.shotsReceived.has("5,5")).toBe(true);
    expect(board.shotsReceived.has("1,1")).toBe(false);
  });

  it("should increment shotsFired for each shot", () => {
    const board = createFullBoard();
    const shooter = { shotsFired: 0, hits: 0, misses: 0 };
    const target = {
      shipCellsRemaining: TOTAL_SHIP_CELLS,
      shipsRemaining: FLEET.length,
    };

    processShot(board, 0, 0, shooter, target);
    processShot(board, 9, 9, shooter, target);
    processShot(board, 1, 0, shooter, target);
    expect(shooter.shotsFired).toBe(3);
    expect(shooter.hits).toBe(2); // 0,0 and 1,0 are hits
    expect(shooter.misses).toBe(1); // 9,9 is miss
  });

  it("should detect game over when all cells destroyed", () => {
    const board = createFullBoard();
    const shooter = { shotsFired: 0, hits: 0, misses: 0 };
    const target = {
      shipCellsRemaining: TOTAL_SHIP_CELLS,
      shipsRemaining: FLEET.length,
    };

    // Sink all ships
    let gameOver = false;
    for (const placement of board.placements) {
      for (const cell of placement.cells) {
        const result = processShot(board, cell.row, cell.col, shooter, target);
        if (result.isGameOver) gameOver = true;
      }
    }

    expect(gameOver).toBe(true);
    expect(target.shipCellsRemaining).toBe(0);
    expect(target.shipsRemaining).toBe(0);
    expect(shooter.hits).toBe(TOTAL_SHIP_CELLS);
    expect(shooter.misses).toBe(0);
    expect(shooter.shotsFired).toBe(TOTAL_SHIP_CELLS);
  });

  it("should detect game over when ships remaining reaches 0", () => {
    const board = createFullBoard();
    const shooter = { shotsFired: 0, hits: 0, misses: 0 };
    const target = {
      shipCellsRemaining: TOTAL_SHIP_CELLS,
      shipsRemaining: FLEET.length,
    };

    let lastResult: ProcessShotResult | null = null;
    for (const placement of board.placements) {
      for (const cell of placement.cells) {
        lastResult = processShot(board, cell.row, cell.col, shooter, target);
      }
    }

    expect(lastResult!.isGameOver).toBe(true);
    expect(target.shipsRemaining).toBe(0);
  });

  it("should not immediately end game after sinking 4 of 5 ships", () => {
    const board = createFullBoard();
    const shooter = { shotsFired: 0, hits: 0, misses: 0 };
    const target = {
      shipCellsRemaining: TOTAL_SHIP_CELLS,
      shipsRemaining: FLEET.length,
    };

    // Sink first 4 ships (carrier, battleship, cruiser, submarine) but NOT destroyer
    for (let shipIdx = 0; shipIdx < 4; shipIdx++) {
      const placement = board.placements[shipIdx];
      for (const cell of placement.cells) {
        processShot(board, cell.row, cell.col, shooter, target);
      }
    }

    expect(target.shipsRemaining).toBe(1); // Destroyer still afloat
    expect(target.shipCellsRemaining).toBe(2); // Destroyer has 2 cells
  });

  it("should calculate accuracy correctly", () => {
    const board = createFullBoard();
    const shooter = { shotsFired: 0, hits: 0, misses: 0 };
    const target = {
      shipCellsRemaining: TOTAL_SHIP_CELLS,
      shipsRemaining: FLEET.length,
    };

    // 3 hits, 2 misses
    processShot(board, 0, 0, shooter, target); // hit
    processShot(board, 0, 1, shooter, target); // hit
    processShot(board, 0, 2, shooter, target); // hit
    processShot(board, 9, 8, shooter, target); // miss
    processShot(board, 9, 9, shooter, target); // miss

    const accuracy =
      shooter.shotsFired > 0
        ? Math.round((shooter.hits / shooter.shotsFired) * 100)
        : 0;
    expect(accuracy).toBe(60);
  });
});

// =============================================================================
// Phase Machine Tests
// =============================================================================

describe("Phase Machine", () => {
  it("should start in 'waiting' phase", () => {
    const state = new BattleshipState();
    expect(state.phase).toBe("waiting");
  });

  it("should transition to 'placement' when set", () => {
    const state = new BattleshipState();
    state.phase = "placement";
    expect(state.phase).toBe("placement");
  });

  it("should transition to 'combat' when set", () => {
    const state = new BattleshipState();
    state.phase = "combat";
    expect(state.phase).toBe("combat");
  });

  it("should transition to 'finished' when set", () => {
    const state = new BattleshipState();
    state.phase = "finished";
    expect(state.phase).toBe("finished");
  });

  it("should set winner fields on game end", () => {
    const state = new BattleshipState();
    state.phase = "finished";
    state.winnerId = "uid-1";
    state.winReason = "sunk";

    expect(state.winnerId).toBe("uid-1");
    expect(state.winReason).toBe("sunk");
  });

  it("should support all win reasons", () => {
    const reasons = ["sunk", "surrender", "timeout", "disconnect"];
    for (const reason of reasons) {
      const state = new BattleshipState();
      state.winReason = reason;
      expect(state.winReason).toBe(reason);
    }
  });

  it("should track turn number progression", () => {
    const state = new BattleshipState();
    state.turnNumber = 0;

    for (let i = 1; i <= 10; i++) {
      state.turnNumber = i;
      expect(state.turnNumber).toBe(i);
    }
  });

  it("should alternate current turn UID", () => {
    const state = new BattleshipState();
    const uid1 = "uid-1";
    const uid2 = "uid-2";

    state.currentTurnUid = uid1;
    expect(state.currentTurnUid).toBe(uid1);

    state.currentTurnUid = uid2;
    expect(state.currentTurnUid).toBe(uid2);
  });

  it("should set timer values correctly", () => {
    const state = new BattleshipState();

    // Placement timer
    expect(state.placementTimeRemaining).toBe(90000);

    // Turn timer
    expect(state.turnTimeRemaining).toBe(25000);

    // Decrement
    state.placementTimeRemaining = 45000;
    expect(state.placementTimeRemaining).toBe(45000);

    state.turnTimeRemaining = 10000;
    expect(state.turnTimeRemaining).toBe(10000);
  });
});

// =============================================================================
// Fog-of-War Tests
// =============================================================================

describe("Fog-of-War Design", () => {
  it("should store boards server-side only (not in schema)", () => {
    const state = new BattleshipState();
    // BattleshipState has NO board field — boards are Map<string, PlayerBoard>
    // stored in the Room, not the schema
    expect((state as any).boards).toBeUndefined();
    expect((state as any).grid).toBeUndefined();
    expect((state as any).placements).toBeUndefined();
  });

  it("should only expose shot results (hit/miss/sunk) in shared state", () => {
    const state = new BattleshipState();

    // Shot history is shared — it only contains results, not ship positions
    const shot = new ShotRecord();
    shot.row = 3;
    shot.col = 5;
    shot.shooterUid = "uid-1";
    shot.targetUid = "uid-2";
    shot.result = "miss";
    // No ship placement data in shot record for a miss
    shot.shipId = "";
    shot.shipName = "";
    state.shotHistory.push(shot);

    expect(state.shotHistory[0].result).toBe("miss");
    expect(state.shotHistory[0].shipId).toBe("");
  });

  it("should reveal sunk ship outlines via sunkShips array", () => {
    const state = new BattleshipState();

    // Only sunk ships get revealed — not the entire board
    const sunk = new SunkShip();
    sunk.shipId = "destroyer";
    sunk.shipName = "Destroyer";
    sunk.size = 2;
    sunk.ownerUid = "uid-2";

    const c1 = new SunkShipCell();
    c1.row = 4;
    c1.col = 5;
    const c2 = new SunkShipCell();
    c2.row = 4;
    c2.col = 6;
    sunk.cells.push(c1);
    sunk.cells.push(c2);

    state.sunkShips.push(sunk);

    // The revealed info is minimal: just the outline cells + owner
    expect(state.sunkShips.length).toBe(1);
    expect(state.sunkShips[0].ownerUid).toBe("uid-2");
    expect(state.sunkShips[0].cells.length).toBe(2);
  });

  it("should not reveal hit ship positions until sunk", () => {
    const state = new BattleshipState();

    // A "hit" shot reveals the ship ID in the shot record, but NOT the
    // other cells of that ship — the opponent/spectators can't see
    // the rest of the ship until it's fully sunk
    const hitShot = new ShotRecord();
    hitShot.result = "hit";
    hitShot.shipId = "carrier";
    hitShot.row = 2;
    hitShot.col = 3;
    state.shotHistory.push(hitShot);

    // No sunk ships revealed yet
    expect(state.sunkShips.length).toBe(0);
  });

  it("should build sendBoardToPlayer payload format correctly", () => {
    // This tests the payload shape that sendBoardToPlayer creates
    const placement: ShipPlacement = {
      shipId: "destroyer",
      shipName: "Destroyer",
      size: 2,
      startRow: 4,
      startCol: 5,
      orientation: "horizontal",
      cells: [
        { row: 4, col: 5 },
        { row: 4, col: 6 },
      ],
      hitsRemaining: 2,
    };

    // Matches BattleshipRoom.sendBoardToPlayer() logic
    const payload = {
      shipId: placement.shipId,
      shipName: placement.shipName,
      size: placement.size,
      startRow: placement.startRow,
      startCol: placement.startCol,
      orientation: placement.orientation,
      cells: placement.cells,
      hitsRemaining: placement.hitsRemaining,
    };

    expect(payload.shipId).toBe("destroyer");
    expect(payload.cells).toHaveLength(2);
    expect(payload.hitsRemaining).toBe(2);
  });
});

// =============================================================================
// Spectator Tests
// =============================================================================

describe("Spectator Support", () => {
  it("should have maxSpectators default of 10", () => {
    const state = new BattleshipState();
    expect(state.maxSpectators).toBe(10);
  });

  it("should track spectator count", () => {
    const state = new BattleshipState();
    state.spectatorCount = 3;
    expect(state.spectatorCount).toBe(3);
  });

  it("should store spectators in MapSchema", () => {
    const state = new BattleshipState();
    // SpectatorEntry is imported in the room — we test via the state MapSchema
    expect(state.spectators.size).toBe(0);
  });

  it("should allow 2 players + multiple spectators", () => {
    const state = new BattleshipState();

    // Add 2 players
    const p1 = new BattleshipPlayer();
    p1.uid = "uid-1";
    const p2 = new BattleshipPlayer();
    p2.uid = "uid-2";
    state.players.set("s1", p1);
    state.players.set("s2", p2);

    // Spectator slots are separate from player slots
    state.spectatorCount = 5;

    expect(state.players.size).toBe(2);
    expect(state.spectatorCount).toBe(5);
  });
});

// =============================================================================
// Last Action (Animation Trigger) Tests
// =============================================================================

describe("Last Action Fields", () => {
  it("should default to empty/zero", () => {
    const state = new BattleshipState();
    expect(state.lastActionType).toBe("");
    expect(state.lastActionRow).toBe(0);
    expect(state.lastActionCol).toBe(0);
    expect(state.lastActionShipName).toBe("");
  });

  it("should store miss action details", () => {
    const state = new BattleshipState();
    state.lastActionType = "miss";
    state.lastActionRow = 5;
    state.lastActionCol = 7;
    state.lastActionShipName = "";

    expect(state.lastActionType).toBe("miss");
    expect(state.lastActionRow).toBe(5);
    expect(state.lastActionCol).toBe(7);
  });

  it("should store hit action details", () => {
    const state = new BattleshipState();
    state.lastActionType = "hit";
    state.lastActionRow = 3;
    state.lastActionCol = 2;
    state.lastActionShipName = "Carrier";

    expect(state.lastActionType).toBe("hit");
    expect(state.lastActionShipName).toBe("Carrier");
  });

  it("should store sunk action details", () => {
    const state = new BattleshipState();
    state.lastActionType = "sunk";
    state.lastActionRow = 1;
    state.lastActionCol = 4;
    state.lastActionShipName = "Destroyer";

    expect(state.lastActionType).toBe("sunk");
    expect(state.lastActionShipName).toBe("Destroyer");
  });
});

// =============================================================================
// End Game / Persistence Payload Tests
// =============================================================================

describe("End Game Payload", () => {
  it("should build correct per-player stats for persistence", () => {
    const p1 = new BattleshipPlayer();
    p1.uid = "uid-1";
    p1.hits = 12;
    p1.misses = 5;
    p1.shotsFired = 17;
    p1.shipsRemaining = 5;
    p1.shipCellsRemaining = 17;

    const p2 = new BattleshipPlayer();
    p2.uid = "uid-2";
    p2.hits = 8;
    p2.misses = 9;
    p2.shotsFired = 17;
    p2.shipsRemaining = 0;
    p2.shipCellsRemaining = 0;

    // Mirrors BattleshipRoom.onDispose() perPlayerStats
    const perPlayerStats: Record<string, Record<string, number>> = {};
    [p1, p2].forEach((p) => {
      const opponentShipsSunk = FLEET.length - p.shipsRemaining;
      perPlayerStats[p.uid] = {
        hits: p.hits,
        misses: p.misses,
        shotsFired: p.shotsFired,
        shipsRemaining: p.shipsRemaining,
        shipCellsRemaining: p.shipCellsRemaining,
        shipsSunk: opponentShipsSunk,
        accuracy:
          p.shotsFired > 0 ? Math.round((p.hits / p.shotsFired) * 100) : 0,
      };
    });

    expect(perPlayerStats["uid-1"].hits).toBe(12);
    expect(perPlayerStats["uid-1"].accuracy).toBe(71); // 12/17 ≈ 70.6 → 71
    expect(perPlayerStats["uid-1"].shipsSunk).toBe(0); // uid-1 has all 5 ships
    expect(perPlayerStats["uid-2"].accuracy).toBe(47); // 8/17 ≈ 47.1 → 47
    expect(perPlayerStats["uid-2"].shipsSunk).toBe(5); // uid-2 lost all ships
    expect(perPlayerStats["uid-2"].shipsRemaining).toBe(0);
  });

  it("should build game_over broadcast payload", () => {
    const state = new BattleshipState();
    state.winnerId = "uid-1";
    state.winReason = "sunk";
    state.turnNumber = 42;

    const p1 = new BattleshipPlayer();
    p1.uid = "uid-1";
    p1.displayName = "Alice";
    p1.hits = 17;
    p1.shotsFired = 30;
    p1.shipsRemaining = 3;

    const p2 = new BattleshipPlayer();
    p2.uid = "uid-2";
    p2.displayName = "Bob";
    p2.hits = 12;
    p2.shotsFired = 28;
    p2.shipsRemaining = 0;

    state.players.set("s1", p1);
    state.players.set("s2", p2);

    // Mirrors BattleshipRoom.endGame() broadcast
    const results: Record<string, any>[] = [];
    state.players.forEach((p: BattleshipPlayer) => {
      results.push({
        uid: p.uid,
        displayName: p.displayName,
        hits: p.hits,
        misses: p.misses,
        shotsFired: p.shotsFired,
        shipsRemaining: p.shipsRemaining,
        shipCellsRemaining: p.shipCellsRemaining,
        playerIndex: p.playerIndex,
      });
    });

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.uid === "uid-1")!.hits).toBe(17);
    expect(results.find((r) => r.uid === "uid-2")!.shipsRemaining).toBe(0);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("Edge Cases", () => {
  it("should handle duplicate shot at same cell (shotsReceived set)", () => {
    const board: PlayerBoard = {
      placements: [],
      grid: new Map(),
      shotsReceived: new Set(),
    };

    board.shotsReceived.add("3,5");

    // Client should check before firing; server also checks
    expect(board.shotsReceived.has("3,5")).toBe(true);

    // Verify set prevents duplicates
    board.shotsReceived.add("3,5");
    expect(board.shotsReceived.size).toBe(1);
  });

  it("should handle removeShipFromBoard correctly", () => {
    const board: PlayerBoard = {
      placements: [],
      grid: new Map(),
      shotsReceived: new Set(),
    };

    const ship = FLEET[4]; // Destroyer, size 2
    const cells = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
    board.placements.push({
      shipId: ship.id,
      shipName: ship.name,
      size: ship.size,
      startRow: 0,
      startCol: 0,
      orientation: "horizontal",
      cells,
      hitsRemaining: ship.size,
    });
    for (const c of cells) {
      board.grid.set(`${c.row},${c.col}`, ship.id);
    }

    expect(board.grid.size).toBe(2);
    expect(board.placements).toHaveLength(1);

    // Remove ship (mirrors removeShipFromBoard)
    const idx = board.placements.findIndex((p) => p.shipId === ship.id);
    const placement = board.placements[idx];
    for (const c of placement.cells) {
      board.grid.delete(`${c.row},${c.col}`);
    }
    board.placements.splice(idx, 1);

    expect(board.grid.size).toBe(0);
    expect(board.placements).toHaveLength(0);
  });

  it("should handle removing non-existent ship gracefully", () => {
    const board: PlayerBoard = {
      placements: [],
      grid: new Map(),
      shotsReceived: new Set(),
    };

    const idx = board.placements.findIndex((p) => p.shipId === "nonexistent");
    expect(idx).toBe(-1); // Not found — no crash
  });

  it("should compute getRandomUnshotCell correctly", () => {
    const board: PlayerBoard = {
      placements: [],
      grid: new Map(),
      shotsReceived: new Set(),
    };

    // Fire at everything except (9,9)
    for (let r = 0; r < BATTLESHIP_GRID_SIZE; r++) {
      for (let c = 0; c < BATTLESHIP_GRID_SIZE; c++) {
        if (r === 9 && c === 9) continue;
        board.shotsReceived.add(`${r},${c}`);
      }
    }

    // Only (9,9) should be unshot
    const unshot: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < BATTLESHIP_GRID_SIZE; r++) {
      for (let c = 0; c < BATTLESHIP_GRID_SIZE; c++) {
        if (!board.shotsReceived.has(`${r},${c}`)) {
          unshot.push({ row: r, col: c });
        }
      }
    }
    expect(unshot).toEqual([{ row: 9, col: 9 }]);
  });

  it("should return null when all cells shot", () => {
    const board: PlayerBoard = {
      placements: [],
      grid: new Map(),
      shotsReceived: new Set(),
    };

    for (let r = 0; r < BATTLESHIP_GRID_SIZE; r++) {
      for (let c = 0; c < BATTLESHIP_GRID_SIZE; c++) {
        board.shotsReceived.add(`${r},${c}`);
      }
    }

    const unshot: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < BATTLESHIP_GRID_SIZE; r++) {
      for (let c = 0; c < BATTLESHIP_GRID_SIZE; c++) {
        if (!board.shotsReceived.has(`${r},${c}`)) {
          unshot.push({ row: r, col: c });
        }
      }
    }
    expect(unshot).toHaveLength(0);
  });

  it("should handle player with 0 accuracy (all misses)", () => {
    const p = new BattleshipPlayer();
    p.shotsFired = 10;
    p.hits = 0;
    p.misses = 10;

    const accuracy =
      p.shotsFired > 0 ? Math.round((p.hits / p.shotsFired) * 100) : 0;
    expect(accuracy).toBe(0);
  });

  it("should handle player with 100% accuracy (no misses)", () => {
    const p = new BattleshipPlayer();
    p.shotsFired = 17;
    p.hits = 17;
    p.misses = 0;

    const accuracy =
      p.shotsFired > 0 ? Math.round((p.hits / p.shotsFired) * 100) : 0;
    expect(accuracy).toBe(100);
  });

  it("should handle 0 shots fired (avoid division by zero)", () => {
    const p = new BattleshipPlayer();
    const accuracy =
      p.shotsFired > 0 ? Math.round((p.hits / p.shotsFired) * 100) : 0;
    expect(accuracy).toBe(0);
  });
});

// =============================================================================
// Full Game Simulation (end-to-end logic without Room lifecycle)
// =============================================================================

describe("Full Game Simulation", () => {
  function computeCells(
    shipDef: ShipDef,
    startRow: number,
    startCol: number,
    orientation: "horizontal" | "vertical",
  ): Array<{ row: number; col: number }> {
    const cells: Array<{ row: number; col: number }> = [];
    for (let i = 0; i < shipDef.size; i++) {
      cells.push({
        row: orientation === "vertical" ? startRow + i : startRow,
        col: orientation === "horizontal" ? startCol + i : startCol,
      });
    }
    return cells;
  }

  function placeFleet(board: PlayerBoard): void {
    FLEET.forEach((ship, i) => {
      const cells = computeCells(ship, i, 0, "horizontal");
      board.placements.push({
        shipId: ship.id,
        shipName: ship.name,
        size: ship.size,
        startRow: i,
        startCol: 0,
        orientation: "horizontal",
        cells,
        hitsRemaining: ship.size,
      });
      for (const c of cells) {
        board.grid.set(`${c.row},${c.col}`, ship.id);
      }
    });
  }

  it("should simulate a complete game from placement to win", () => {
    const state = new BattleshipState();

    // ── Phase: waiting ──────────────────────────────────────────────────
    expect(state.phase).toBe("waiting");

    // Add two players
    const p1 = new BattleshipPlayer();
    p1.uid = "uid-1";
    p1.displayName = "Alice";
    p1.playerIndex = 0;
    const p2 = new BattleshipPlayer();
    p2.uid = "uid-2";
    p2.displayName = "Bob";
    p2.playerIndex = 1;
    state.players.set("s1", p1);
    state.players.set("s2", p2);

    // ── Phase: placement ────────────────────────────────────────────────
    state.phase = "placement";
    expect(state.phase).toBe("placement");

    const board1: PlayerBoard = {
      placements: [],
      grid: new Map(),
      shotsReceived: new Set(),
    };
    const board2: PlayerBoard = {
      placements: [],
      grid: new Map(),
      shotsReceived: new Set(),
    };
    placeFleet(board1);
    placeFleet(board2);

    expect(board1.placements).toHaveLength(5);
    expect(board2.placements).toHaveLength(5);
    expect(board1.grid.size).toBe(TOTAL_SHIP_CELLS);
    expect(board2.grid.size).toBe(TOTAL_SHIP_CELLS);

    // Lock in
    p1.placementReady = true;
    p2.placementReady = true;

    // ── Phase: combat ───────────────────────────────────────────────────
    state.phase = "combat";
    state.turnNumber = 1;
    state.currentTurnUid = "uid-1";
    expect(state.phase).toBe("combat");

    // Simulate uid-1 sinking all of uid-2's ships
    let turnNum = 1;
    for (const placement of board2.placements) {
      for (const cell of placement.cells) {
        // uid-1 fires at uid-2's board
        const key = `${cell.row},${cell.col}`;
        board2.shotsReceived.add(key);

        const shipId = board2.grid.get(key)!;
        const hitPlacement = board2.placements.find(
          (p) => p.shipId === shipId,
        )!;
        hitPlacement.hitsRemaining--;
        p1.shotsFired++;
        p1.hits++;
        p2.shipCellsRemaining--;

        let result: "miss" | "hit" | "sunk" = "hit";
        if (hitPlacement.hitsRemaining <= 0) {
          result = "sunk";
          p2.shipsRemaining--;

          const sunk = new SunkShip();
          sunk.shipId = hitPlacement.shipId;
          sunk.shipName = hitPlacement.shipName;
          sunk.size = hitPlacement.size;
          sunk.ownerUid = "uid-2";
          for (const c of hitPlacement.cells) {
            const sc = new SunkShipCell();
            sc.row = c.row;
            sc.col = c.col;
            sunk.cells.push(sc);
          }
          state.sunkShips.push(sunk);
        }

        const record = new ShotRecord();
        record.row = cell.row;
        record.col = cell.col;
        record.shooterUid = "uid-1";
        record.targetUid = "uid-2";
        record.result = result;
        record.shipId = shipId;
        record.turnNumber = turnNum;
        state.shotHistory.push(record);

        state.lastActionType = result;
        state.lastActionRow = cell.row;
        state.lastActionCol = cell.col;

        // Check game over
        if (p2.shipCellsRemaining <= 0 || p2.shipsRemaining <= 0) {
          state.phase = "finished";
          state.winnerId = "uid-1";
          state.winReason = "sunk";
          break;
        }

        // Advance turn (simplified — uid-2 fires a miss, then back to uid-1)
        state.currentTurnUid = "uid-2";
        turnNum++;
        // uid-2 fires at an empty cell
        p2.shotsFired++;
        p2.misses++;
        state.currentTurnUid = "uid-1";
        turnNum++;
      }
      if (state.phase === "finished") break;
    }

    // ── Phase: finished ─────────────────────────────────────────────────
    expect(state.phase).toBe("finished");
    expect(state.winnerId).toBe("uid-1");
    expect(state.winReason).toBe("sunk");
    expect(p2.shipsRemaining).toBe(0);
    expect(p2.shipCellsRemaining).toBe(0);
    expect(p1.hits).toBe(TOTAL_SHIP_CELLS);
    expect(state.sunkShips.length).toBe(5);
    expect(state.shotHistory.length).toBeGreaterThan(0);

    // Verify all 5 sunk ships are present
    const sunkIds = state.sunkShips.map((s: SunkShip) => s.shipId);
    expect(sunkIds.sort()).toEqual(FLEET.map((f) => f.id).sort());
  });

  it("should handle surrender ending the game", () => {
    const state = new BattleshipState();
    state.phase = "combat";

    const p1 = new BattleshipPlayer();
    p1.uid = "uid-1";
    const p2 = new BattleshipPlayer();
    p2.uid = "uid-2";
    state.players.set("s1", p1);
    state.players.set("s2", p2);

    // uid-2 surrenders → uid-1 wins
    state.phase = "finished";
    state.winnerId = "uid-1";
    state.winReason = "surrender";

    expect(state.phase).toBe("finished");
    expect(state.winnerId).toBe("uid-1");
    expect(state.winReason).toBe("surrender");
    // Ships should still be intact since game ended by surrender
    expect(p2.shipsRemaining).toBe(FLEET.length);
  });

  it("should handle disconnect ending the game", () => {
    const state = new BattleshipState();
    state.phase = "combat";

    const p1 = new BattleshipPlayer();
    p1.uid = "uid-1";
    p1.connected = true;
    const p2 = new BattleshipPlayer();
    p2.uid = "uid-2";
    p2.connected = false; // disconnected

    state.players.set("s1", p1);
    state.players.set("s2", p2);

    // uid-2 disconnects after reconnection grace period
    state.phase = "finished";
    state.winnerId = "uid-1";
    state.winReason = "disconnect";

    expect(state.winReason).toBe("disconnect");
    expect(p2.connected).toBe(false);
  });
});
