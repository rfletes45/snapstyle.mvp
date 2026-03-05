/**
 * Games V4 — Battleship Engine
 *
 * Pure, deterministic game logic for Battleship.
 * Validates fleet placements, resolves shots, checks win conditions.
 * No Firestore / side-effect dependencies — shared between client and server.
 *
 * @module gamesV4/adapters/battleship/battleshipEngine
 */

import type {
  BattleshipPrivateState,
  BattleshipPublicState,
  BattleshipSettings,
  Direction,
  FleetPreset,
  GridSize,
  PlayerStats,
  ShipDef,
  ShipPlacement,
  ShotRecord,
} from "./battleshipTypes";
import { getFleetForPreset } from "./battleshipTypes";

// =============================================================================
// Placement Helpers
// =============================================================================

/** Compute the cells a ship occupies given start position and direction. */
export function computeShipCells(
  startRow: number,
  startCol: number,
  size: number,
  direction: Direction,
): string[] {
  const cells: string[] = [];
  for (let i = 0; i < size; i++) {
    const r = direction === "V" ? startRow + i : startRow;
    const c = direction === "H" ? startCol + i : startCol;
    cells.push(`${r},${c}`);
  }
  return cells;
}

/** Validate a single ship placement against grid bounds. */
export function isPlacementInBounds(
  placement: ShipPlacement,
  gridSize: GridSize,
): boolean {
  for (const cellKey of placement.cells) {
    const [r, c] = cellKey.split(",").map(Number);
    if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return false;
  }
  return true;
}

/** Check if two placement cell sets overlap. */
function cellsOverlap(cellsA: string[], cellsB: string[]): boolean {
  const setA = new Set(cellsA);
  return cellsB.some((c) => setA.has(c));
}

/** Get all neighbor cells (including diagonals) for a given cell. */
function getNeighborCells(cellKey: string): string[] {
  const [r, c] = cellKey.split(",").map(Number);
  const neighbors: string[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      neighbors.push(`${r + dr},${c + dc}`);
    }
  }
  return neighbors;
}

/** Check adjacency violation between two ships. */
function shipsAdjacent(cellsA: string[], cellsB: string[]): boolean {
  const setB = new Set(cellsB);
  for (const cellKey of cellsA) {
    const neighbors = getNeighborCells(cellKey);
    if (neighbors.some((n) => setB.has(n))) return true;
  }
  return false;
}

// =============================================================================
// Fleet Validation
// =============================================================================

export interface FleetValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a complete fleet placement.
 * Checks: correct ship count, correct sizes, bounds, no overlaps, adjacency rule.
 */
export function validateFleetPlacement(
  placements: ShipPlacement[],
  gridSize: GridSize,
  fleetPreset: FleetPreset,
  allowAdjacentShips: boolean,
): FleetValidationResult {
  const fleet = getFleetForPreset(fleetPreset);

  // Check ship count
  if (placements.length !== fleet.length) {
    return {
      valid: false,
      error: `Expected ${fleet.length} ships, got ${placements.length}.`,
    };
  }

  // Check each ship matches expected definition
  const expectedById = new Map<string, ShipDef>();
  for (const def of fleet) expectedById.set(def.shipId, def);

  const usedIds = new Set<string>();
  for (const placement of placements) {
    if (usedIds.has(placement.shipId)) {
      return { valid: false, error: `Duplicate ship: ${placement.shipId}.` };
    }
    usedIds.add(placement.shipId);

    const def = expectedById.get(placement.shipId);
    if (!def) {
      return { valid: false, error: `Unknown ship: ${placement.shipId}.` };
    }
    if (placement.size !== def.size) {
      return {
        valid: false,
        error: `Ship ${placement.shipId} should be size ${def.size}, got ${placement.size}.`,
      };
    }

    // Recompute cells to prevent tampering
    const expectedCells = computeShipCells(
      placement.startRow,
      placement.startCol,
      placement.size,
      placement.direction,
    );
    if (expectedCells.length !== placement.cells.length) {
      return {
        valid: false,
        error: `Ship ${placement.shipId} cell count mismatch.`,
      };
    }

    // Check bounds
    if (
      !isPlacementInBounds({ ...placement, cells: expectedCells }, gridSize)
    ) {
      return {
        valid: false,
        error: `Ship ${placement.shipId} out of bounds.`,
      };
    }
  }

  // Recompute all cells for overlap/adjacency checks
  const allShipCells: string[][] = placements.map((p) =>
    computeShipCells(p.startRow, p.startCol, p.size, p.direction),
  );

  // Check overlaps
  for (let i = 0; i < allShipCells.length; i++) {
    for (let j = i + 1; j < allShipCells.length; j++) {
      if (cellsOverlap(allShipCells[i], allShipCells[j])) {
        return {
          valid: false,
          error: `Ships ${placements[i].shipId} and ${placements[j].shipId} overlap.`,
        };
      }
    }
  }

  // Check adjacency rule
  if (!allowAdjacentShips) {
    for (let i = 0; i < allShipCells.length; i++) {
      for (let j = i + 1; j < allShipCells.length; j++) {
        if (shipsAdjacent(allShipCells[i], allShipCells[j])) {
          return {
            valid: false,
            error: `Ships ${placements[i].shipId} and ${placements[j].shipId} are adjacent (not allowed).`,
          };
        }
      }
    }
  }

  return { valid: true };
}

// =============================================================================
// Private State Creation
// =============================================================================

/** Create an empty private state for a player (before fleet placement). */
export function createEmptyPrivateState(): BattleshipPrivateState {
  return {
    placements: [],
    cellToShip: {},
    shipHealth: {},
    aliveShips: [],
    committedAt: null,
  };
}

/** Build private state from validated placements. */
export function buildPrivateStateFromPlacements(
  placements: ShipPlacement[],
): BattleshipPrivateState {
  const cellToShip: Record<string, string | null> = {};
  const shipHealth: Record<string, number> = {};
  const aliveShips: string[] = [];

  for (const p of placements) {
    const cells = computeShipCells(p.startRow, p.startCol, p.size, p.direction);
    for (const cell of cells) {
      cellToShip[cell] = p.shipId;
    }
    shipHealth[p.shipId] = 0;
    aliveShips.push(p.shipId);
  }

  return {
    placements: placements.map((p) => ({
      ...p,
      cells: computeShipCells(p.startRow, p.startCol, p.size, p.direction),
    })),
    cellToShip,
    shipHealth,
    aliveShips,
    committedAt: Date.now(),
  };
}

// =============================================================================
// Public State Creation
// =============================================================================

/** Create initial public state for a new Battleship session. */
export function createInitialBattleshipPublicState(
  players: Array<{ uid: string; slotIndex: number }>,
  settings: BattleshipSettings,
): BattleshipPublicState {
  const fleet = getFleetForPreset(settings.fleetPreset);
  const readyByUid: Record<string, boolean> = {};
  const readyAtByUid: Record<string, number> = {};
  const shotsByDefender: Record<string, Record<string, ShotRecord>> = {};
  const statsByUid: Record<string, PlayerStats> = {};

  for (const p of players) {
    readyByUid[p.uid] = false;
    readyAtByUid[p.uid] = 0;
    shotsByDefender[p.uid] = {};
    statsByUid[p.uid] = {
      hits: 0,
      misses: 0,
      accuracy: 0,
      shipsRemaining: fleet.length,
      shipsSunk: 0,
      turnsTaken: 0,
    };
  }

  return {
    phase: "setup",
    rules: {
      gridSize: settings.gridSize,
      fleetPreset: settings.fleetPreset,
      fleetShipCount: fleet.length,
      shotMode: settings.shotMode,
      turnRule: settings.turnRule,
      allowAdjacentShips: settings.allowAdjacentShips,
      setupTimeLimitSec: settings.setupTimeLimitSec,
      turnTimeLimitSec: settings.turnTimeLimitSec,
      autoResolveOnTimeout: settings.autoResolveOnTimeout,
      spectatorRevealPolicy: settings.spectatorRevealPolicy,
    },
    setup: { readyByUid, readyAtByUid },
    turnNumber: 0,
    currentTurnUid: null,
    shotsByDefender,
    statsByUid,
    lastEvent: null,
    resolved: null,
    moveCount: 0,
  };
}

// =============================================================================
// Shot Resolution
// =============================================================================

export interface ShotResolution {
  result: "miss" | "hit" | "sunk";
  shipId?: string;
  shipSize?: number;
  defenderPrivateState: BattleshipPrivateState;
}

/** Resolve a single shot against the defender's private state. */
export function resolveShot(
  targetRow: number,
  targetCol: number,
  defenderPrivate: BattleshipPrivateState,
  fleet: ShipDef[],
): ShotResolution {
  const cellKey = `${targetRow},${targetCol}`;
  const shipId = defenderPrivate.cellToShip[cellKey];

  if (!shipId) {
    return { result: "miss", defenderPrivateState: defenderPrivate };
  }

  // It's a hit
  const newHealth = { ...defenderPrivate.shipHealth };
  newHealth[shipId] = (newHealth[shipId] ?? 0) + 1;

  const shipDef = fleet.find((s) => s.shipId === shipId);
  const shipSize = shipDef?.size ?? 0;
  const isSunk = newHealth[shipId] >= shipSize;

  const newAliveShips = isSunk
    ? defenderPrivate.aliveShips.filter((s) => s !== shipId)
    : [...defenderPrivate.aliveShips];

  const newPrivate: BattleshipPrivateState = {
    ...defenderPrivate,
    shipHealth: newHealth,
    aliveShips: newAliveShips,
  };

  if (isSunk) {
    return {
      result: "sunk",
      shipId,
      shipSize,
      defenderPrivateState: newPrivate,
    };
  }

  return { result: "hit", shipId, defenderPrivateState: newPrivate };
}

// =============================================================================
// Stats Helpers
// =============================================================================

export function updatePlayerStats(
  stats: PlayerStats,
  shotResult: "miss" | "hit" | "sunk",
  isAttacker: boolean,
): PlayerStats {
  if (isAttacker) {
    const newHits = shotResult !== "miss" ? stats.hits + 1 : stats.hits;
    const newMisses = shotResult === "miss" ? stats.misses + 1 : stats.misses;
    const total = newHits + newMisses;
    return {
      ...stats,
      hits: newHits,
      misses: newMisses,
      accuracy: total > 0 ? Math.round((newHits / total) * 100) : 0,
      shipsSunk: shotResult === "sunk" ? stats.shipsSunk + 1 : stats.shipsSunk,
    };
  } else {
    // Defender
    return {
      ...stats,
      shipsRemaining:
        shotResult === "sunk" ? stats.shipsRemaining - 1 : stats.shipsRemaining,
    };
  }
}

// =============================================================================
// Turn Advancement
// =============================================================================

/** Get the opponent UID in a 2-player game. */
export function getOpponentUid(
  currentUid: string,
  turnOrder: string[],
): string {
  return turnOrder[0] === currentUid ? turnOrder[1] : turnOrder[0];
}

/** Pick starting player (slot 0 goes first). */
export function pickStartingPlayer(turnOrder: string[]): string {
  return turnOrder[0];
}

// =============================================================================
// Auto-place Fleet (Random)
// =============================================================================

/** Generate a random valid fleet placement for the given grid and fleet preset. */
export function autoPlaceFleet(
  gridSize: GridSize,
  fleetPreset: FleetPreset,
  allowAdjacentShips: boolean,
): ShipPlacement[] {
  const fleet = getFleetForPreset(fleetPreset);
  const maxAttempts = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const placements: ShipPlacement[] = [];
    const occupied = new Set<string>();
    const blocked = new Set<string>(); // cells adjacent to placed ships (for non-adjacent rule)
    let valid = true;

    // Sort by size descending for better placement success
    const sortedFleet = [...fleet].sort((a, b) => b.size - a.size);

    for (const shipDef of sortedFleet) {
      let placed = false;
      for (let subAttempt = 0; subAttempt < 100; subAttempt++) {
        const direction: Direction = Math.random() < 0.5 ? "H" : "V";
        const maxRow =
          direction === "V" ? gridSize - shipDef.size : gridSize - 1;
        const maxCol =
          direction === "H" ? gridSize - shipDef.size : gridSize - 1;
        const startRow = Math.floor(Math.random() * (maxRow + 1));
        const startCol = Math.floor(Math.random() * (maxCol + 1));

        const cells = computeShipCells(
          startRow,
          startCol,
          shipDef.size,
          direction,
        );

        // Check overlap
        if (cells.some((c) => occupied.has(c))) continue;

        // Check adjacency
        if (!allowAdjacentShips && cells.some((c) => blocked.has(c))) continue;

        // Place the ship
        for (const c of cells) {
          occupied.add(c);
          if (!allowAdjacentShips) {
            for (const n of getNeighborCells(c)) blocked.add(n);
          }
        }

        placements.push({
          shipId: shipDef.shipId,
          size: shipDef.size,
          startRow,
          startCol,
          direction,
          cells,
        });
        placed = true;
        break;
      }

      if (!placed) {
        valid = false;
        break;
      }
    }

    if (valid && placements.length === fleet.length) {
      return placements;
    }
  }

  // Fallback: should never happen with reasonable grid sizes
  return [];
}

// =============================================================================
// Scoring
// =============================================================================

/**
 * Compute the "Fleet Score" for leaderboard.
 * Winner: 100 + shipsRemaining*10 + round(accuracy*50/100) - turnsTaken
 * Loser: shipsSunk*10 + round(accuracy*25/100)
 */
export function computeFleetScore(
  stats: PlayerStats,
  isWinner: boolean,
): number {
  if (isWinner) {
    return (
      100 +
      stats.shipsRemaining * 10 +
      Math.round((stats.accuracy * 50) / 100) -
      stats.turnsTaken
    );
  }
  return stats.shipsSunk * 10 + Math.round((stats.accuracy * 25) / 100);
}
