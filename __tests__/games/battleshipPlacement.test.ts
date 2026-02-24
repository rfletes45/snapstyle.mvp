/**
 * battleshipPlacement — Unit tests for the placement ghost calculator
 *
 * Tests the pure helper functions in src/utils/battleshipPlacement.ts:
 * - computeShipCells: anchor + orientation → cells
 * - areCellsInBounds: bounds checking
 * - hasOverlap: collision detection
 * - buildOccupiedSet: occupied cell aggregation
 * - computeGhost: full ghost computation (integration of the above)
 */

import {
  areCellsInBounds,
  buildOccupiedSet,
  computeGhost,
  computeShipCells,
  hasOverlap,
  type Cell,
  type PlacedShip,
} from "@/utils/battleshipPlacement";

// =============================================================================
// computeShipCells
// =============================================================================

describe("computeShipCells", () => {
  it("should produce correct cells for horizontal placement", () => {
    const cells = computeShipCells(2, 3, 4, "horizontal");
    expect(cells).toEqual([
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 2, col: 5 },
      { row: 2, col: 6 },
    ]);
  });

  it("should produce correct cells for vertical placement", () => {
    const cells = computeShipCells(1, 5, 3, "vertical");
    expect(cells).toEqual([
      { row: 1, col: 5 },
      { row: 2, col: 5 },
      { row: 3, col: 5 },
    ]);
  });

  it("should handle length 1", () => {
    const cells = computeShipCells(0, 0, 1, "horizontal");
    expect(cells).toEqual([{ row: 0, col: 0 }]);
  });

  it("should produce cells that extend beyond grid (caller validates bounds)", () => {
    // Ship at row 8, col 0, vertical, length 5 → extends to row 12
    const cells = computeShipCells(8, 0, 5, "vertical");
    expect(cells).toHaveLength(5);
    expect(cells[4]).toEqual({ row: 12, col: 0 });
  });

  it("should handle top-left corner horizontal", () => {
    const cells = computeShipCells(0, 0, 5, "horizontal");
    expect(cells[0]).toEqual({ row: 0, col: 0 });
    expect(cells[4]).toEqual({ row: 0, col: 4 });
  });

  it("should handle bottom-right corner vertical", () => {
    const cells = computeShipCells(9, 9, 2, "vertical");
    expect(cells).toEqual([
      { row: 9, col: 9 },
      { row: 10, col: 9 },
    ]);
  });
});

// =============================================================================
// areCellsInBounds
// =============================================================================

describe("areCellsInBounds", () => {
  const gridSize = 10;

  it("should return true for cells fully within bounds (horizontal)", () => {
    const cells: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    expect(areCellsInBounds(cells, gridSize)).toBe(true);
  });

  it("should return true for cells at grid edge (row 9, col 9)", () => {
    const cells: Cell[] = [{ row: 9, col: 9 }];
    expect(areCellsInBounds(cells, gridSize)).toBe(true);
  });

  it("should return false when col extends beyond grid", () => {
    const cells: Cell[] = [
      { row: 0, col: 8 },
      { row: 0, col: 9 },
      { row: 0, col: 10 }, // out of bounds
    ];
    expect(areCellsInBounds(cells, gridSize)).toBe(false);
  });

  it("should return false when row extends beyond grid", () => {
    const cells: Cell[] = [
      { row: 8, col: 0 },
      { row: 9, col: 0 },
      { row: 10, col: 0 }, // out of bounds
    ];
    expect(areCellsInBounds(cells, gridSize)).toBe(false);
  });

  it("should return false for negative row", () => {
    const cells: Cell[] = [{ row: -1, col: 5 }];
    expect(areCellsInBounds(cells, gridSize)).toBe(false);
  });

  it("should return false for negative col", () => {
    const cells: Cell[] = [{ row: 5, col: -1 }];
    expect(areCellsInBounds(cells, gridSize)).toBe(false);
  });

  it("should return true for an empty array", () => {
    expect(areCellsInBounds([], gridSize)).toBe(true);
  });

  it("should work with non-standard grid size", () => {
    const cells: Cell[] = [{ row: 4, col: 4 }];
    expect(areCellsInBounds(cells, 5)).toBe(true);
    expect(areCellsInBounds([{ row: 5, col: 0 }], 5)).toBe(false);
  });
});

// =============================================================================
// hasOverlap
// =============================================================================

describe("hasOverlap", () => {
  it("should return false when no cells overlap", () => {
    const cells: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
    const occupied = new Set(["2,2", "3,3"]);
    expect(hasOverlap(cells, occupied)).toBe(false);
  });

  it("should return true when at least one cell overlaps", () => {
    const cells: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    const occupied = new Set(["0,2"]);
    expect(hasOverlap(cells, occupied)).toBe(true);
  });

  it("should return false with empty occupied set", () => {
    const cells: Cell[] = [{ row: 5, col: 5 }];
    expect(hasOverlap(cells, new Set())).toBe(false);
  });

  it("should return false with empty cells array", () => {
    const occupied = new Set(["0,0", "1,1"]);
    expect(hasOverlap([], occupied)).toBe(false);
  });

  it("should handle exact key match format 'row,col'", () => {
    const cells: Cell[] = [{ row: 3, col: 7 }];
    const occupied = new Set(["3,7"]);
    expect(hasOverlap(cells, occupied)).toBe(true);
  });
});

// =============================================================================
// buildOccupiedSet
// =============================================================================

describe("buildOccupiedSet", () => {
  const ships: PlacedShip[] = [
    {
      shipId: "carrier",
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
        { row: 0, col: 4 },
      ],
    },
    {
      shipId: "destroyer",
      cells: [
        { row: 5, col: 5 },
        { row: 5, col: 6 },
      ],
    },
  ];

  it("should include all cells from all ships", () => {
    const set = buildOccupiedSet(ships);
    expect(set.size).toBe(7); // 5 + 2
    expect(set.has("0,0")).toBe(true);
    expect(set.has("0,4")).toBe(true);
    expect(set.has("5,5")).toBe(true);
    expect(set.has("5,6")).toBe(true);
  });

  it("should exclude a specified ship", () => {
    const set = buildOccupiedSet(ships, "carrier");
    expect(set.size).toBe(2); // only destroyer
    expect(set.has("0,0")).toBe(false);
    expect(set.has("5,5")).toBe(true);
  });

  it("should return empty set for empty ships array", () => {
    expect(buildOccupiedSet([]).size).toBe(0);
  });

  it("should return all cells when excludeShipId doesn't match any ship", () => {
    const set = buildOccupiedSet(ships, "nonexistent");
    expect(set.size).toBe(7);
  });
});

// =============================================================================
// computeGhost — integration
// =============================================================================

describe("computeGhost", () => {
  const carrier: PlacedShip = {
    shipId: "carrier",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
    ],
  };

  it("should return valid ghost for a placement with no conflicts", () => {
    const result = computeGhost(2, 3, 4, "horizontal", [], 10);
    expect(result.cells).toHaveLength(4);
    expect(result.inBounds).toBe(true);
    expect(result.overlaps).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it("should detect out-of-bounds horizontal placement", () => {
    // Ship of length 5 at col 7 → extends to col 11
    const result = computeGhost(0, 7, 5, "horizontal", [], 10);
    expect(result.cells).toHaveLength(5);
    expect(result.inBounds).toBe(false);
    expect(result.isValid).toBe(false);
  });

  it("should detect out-of-bounds vertical placement", () => {
    // Ship of length 3 at row 8 → extends to row 10
    const result = computeGhost(8, 0, 3, "vertical", [], 10);
    expect(result.inBounds).toBe(false);
    expect(result.isValid).toBe(false);
  });

  it("should detect overlap with placed ship", () => {
    // Carrier occupies row 0, cols 0-4. Place a new ship at 0,2 horizontal
    const result = computeGhost(0, 2, 3, "horizontal", [carrier], 10);
    expect(result.overlaps).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it("should not detect overlap when excluding the same ship (re-placement)", () => {
    // Re-placing the carrier — exclude it from overlap check
    const result = computeGhost(
      0,
      0,
      5,
      "horizontal",
      [carrier],
      10,
      "carrier",
    );
    expect(result.overlaps).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it("should handle placement at grid boundary (exactly fits)", () => {
    // Length 2 at col 8 horizontal → cols 8,9 = exactly in bounds
    const result = computeGhost(5, 8, 2, "horizontal", [], 10);
    expect(result.inBounds).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it("should handle placement at grid boundary (one over)", () => {
    // Length 2 at col 9 horizontal → cols 9,10 = out of bounds
    const result = computeGhost(5, 9, 2, "horizontal", [], 10);
    expect(result.inBounds).toBe(false);
    expect(result.isValid).toBe(false);
  });

  it("should handle vertical placement at bottom edge (exactly fits)", () => {
    // Length 3 at row 7 vertical → rows 7,8,9 = in bounds
    const result = computeGhost(7, 0, 3, "vertical", [], 10);
    expect(result.inBounds).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it("should handle placement that is both out-of-bounds AND overlapping", () => {
    // Carrier at row 0, cols 0-4. Place at 0,3 horizontal length 5 → overlap + out of bounds
    const result = computeGhost(0, 3, 8, "horizontal", [carrier], 10);
    expect(result.inBounds).toBe(false);
    expect(result.overlaps).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it("should work with multiple placed ships", () => {
    const ships: PlacedShip[] = [
      carrier,
      {
        shipId: "destroyer",
        cells: [
          { row: 5, col: 0 },
          { row: 5, col: 1 },
        ],
      },
    ];
    // Place at 5,1 horizontal length 3 → overlaps with destroyer at 5,1
    const result = computeGhost(5, 1, 3, "horizontal", ships, 10);
    expect(result.overlaps).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it("should place next to a ship without overlap", () => {
    // Carrier at row 0, cols 0-4. Place at row 1, cols 0-2 — no overlap
    const result = computeGhost(1, 0, 3, "horizontal", [carrier], 10);
    expect(result.overlaps).toBe(false);
    expect(result.inBounds).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it("should handle custom grid size", () => {
    // 5x5 grid, place at row 0, col 3, horizontal, length 3 → extends to col 5 (OOB)
    const result = computeGhost(0, 3, 3, "horizontal", [], 5);
    expect(result.inBounds).toBe(false);
    expect(result.isValid).toBe(false);
  });

  it("should handle length-1 ship", () => {
    const result = computeGhost(4, 4, 1, "horizontal", [], 10);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]).toEqual({ row: 4, col: 4 });
    expect(result.isValid).toBe(true);
  });

  it("should default gridSize to 10", () => {
    // col 9, length 2 horizontal → extends to col 10 which is OOB for default gridSize=10
    const result = computeGhost(0, 9, 2, "horizontal", []);
    expect(result.inBounds).toBe(false);
  });
});
