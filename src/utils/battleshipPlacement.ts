/**
 * battleshipPlacement — Pure helpers for ship placement preview (ghost cells)
 *
 * These functions are intentionally free of React / RN dependencies so they
 * can be unit-tested trivially (see M5 tests).
 *
 * @module utils/battleshipPlacement
 */

// =============================================================================
// Types
// =============================================================================

export interface Cell {
  row: number;
  col: number;
}

export interface PlacedShip {
  shipId: string;
  cells: Cell[];
}

export type Orientation = "horizontal" | "vertical";

export interface GhostResult {
  /** Cells the ship would occupy. May extend out-of-bounds. */
  cells: Cell[];
  /** Every cell is within [0, gridSize). */
  inBounds: boolean;
  /** At least one cell overlaps an already-placed ship. */
  overlaps: boolean;
  /** The placement is legal (in bounds AND no overlaps). */
  isValid: boolean;
}

// =============================================================================
// Core helpers
// =============================================================================

/**
 * Compute the cells a ship of `length` would occupy when anchored at
 * `(anchorRow, anchorCol)` in the given `orientation`.
 *
 * Returns cells even if they extend beyond the grid — the caller should
 * check `inBounds`.
 */
export function computeShipCells(
  anchorRow: number,
  anchorCol: number,
  length: number,
  orientation: Orientation,
): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < length; i++) {
    cells.push({
      row: orientation === "vertical" ? anchorRow + i : anchorRow,
      col: orientation === "horizontal" ? anchorCol + i : anchorCol,
    });
  }
  return cells;
}

/**
 * Check whether every cell is within the grid bounds `[0, gridSize)`.
 */
export function areCellsInBounds(cells: Cell[], gridSize: number): boolean {
  return cells.every(
    (c) => c.row >= 0 && c.row < gridSize && c.col >= 0 && c.col < gridSize,
  );
}

/**
 * Check whether any cell overlaps with an already-placed ship.
 *
 * `occupiedCells` is a Set of `"row,col"` keys for cells claimed by
 * *other* ships.  If you are re-placing a ship that is already on the
 * board, remove its own cells from the set first.
 */
export function hasOverlap(cells: Cell[], occupiedCells: Set<string>): boolean {
  return cells.some((c) => occupiedCells.has(`${c.row},${c.col}`));
}

/**
 * Build a Set of `"row,col"` keys for all cells occupied by placed ships,
 * optionally excluding one ship (for re-placement preview).
 */
export function buildOccupiedSet(
  placedShips: PlacedShip[],
  excludeShipId?: string,
): Set<string> {
  const set = new Set<string>();
  for (const ship of placedShips) {
    if (ship.shipId === excludeShipId) continue;
    for (const c of ship.cells) {
      set.add(`${c.row},${c.col}`);
    }
  }
  return set;
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Compute placement ghost for a ship of `length` anchored at
 * `(anchorRow, anchorCol)` in `orientation`, given the list of
 * already-placed ships.
 *
 * The result includes the preview cells, whether the placement is in
 * bounds, whether it overlaps, and overall validity.
 *
 * @param anchorRow    Row of the anchor (top-left) cell
 * @param anchorCol    Column of the anchor (top-left) cell
 * @param length       Number of cells the ship spans
 * @param orientation  "horizontal" or "vertical"
 * @param placedShips  Currently placed ships (for overlap detection)
 * @param gridSize     Board dimension (default 10)
 * @param excludeShipId  Ship ID to exclude from overlap check (re-placing)
 */
export function computeGhost(
  anchorRow: number,
  anchorCol: number,
  length: number,
  orientation: Orientation,
  placedShips: PlacedShip[],
  gridSize: number = 10,
  excludeShipId?: string,
): GhostResult {
  const cells = computeShipCells(anchorRow, anchorCol, length, orientation);
  const inBounds = areCellsInBounds(cells, gridSize);
  const occupiedSet = buildOccupiedSet(placedShips, excludeShipId);
  const overlaps = hasOverlap(cells, occupiedSet);
  return {
    cells,
    inBounds,
    overlaps,
    isValid: inBounds && !overlaps,
  };
}
