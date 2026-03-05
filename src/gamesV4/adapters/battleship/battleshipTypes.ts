/**
 * Games V4 — Battleship Types
 *
 * Type definitions for the Battleship game.
 * Covers settings, public state, private state, and move payloads.
 *
 * Hidden-information model:
 *   - Ship placements live in PrivateState (per-player, owner-only read).
 *   - PublicState contains shots, results, stats — safe for spectators.
 *   - Post-game reveal merges placements into PublicState.resolved.reveal.
 *
 * @module gamesV4/adapters/battleship/battleshipTypes
 */

// =============================================================================
// Settings
// =============================================================================

export type GridSize = 8 | 10 | 12;

export type FleetPreset = "classic_5" | "compact_4";

export type TurnRule = "alternate";

export type ShotMode = "single" | "salvo";

export type SpectatorRevealPolicy = "no_reveal_live" | "post_game_reveal_only";

export interface BattleshipSettings {
  gridSize: GridSize;
  fleetPreset: FleetPreset;
  allowAdjacentShips: boolean;
  turnRule: TurnRule;
  shotMode: ShotMode;
  setupTimeLimitSec: number;
  turnTimeLimitSec: number;
  autoResolveOnTimeout: boolean;
  spectatorRevealPolicy: SpectatorRevealPolicy;
  confirmBeforeFire: boolean;
  haptics: boolean;
  showHeatmapHint: boolean;
}

export const DEFAULT_BATTLESHIP_SETTINGS: BattleshipSettings = {
  gridSize: 10,
  fleetPreset: "classic_5",
  allowAdjacentShips: true,
  turnRule: "alternate",
  shotMode: "single",
  setupTimeLimitSec: 90,
  turnTimeLimitSec: 45,
  autoResolveOnTimeout: true,
  spectatorRevealPolicy: "no_reveal_live",
  confirmBeforeFire: true,
  haptics: true,
  showHeatmapHint: false,
};

// =============================================================================
// Fleet Definitions
// =============================================================================

export interface ShipDef {
  shipId: string;
  name: string;
  size: number;
}

export const FLEET_CLASSIC_5: ShipDef[] = [
  { shipId: "carrier", name: "Carrier", size: 5 },
  { shipId: "battleship", name: "Battleship", size: 4 },
  { shipId: "cruiser", name: "Cruiser", size: 3 },
  { shipId: "submarine", name: "Submarine", size: 3 },
  { shipId: "destroyer", name: "Destroyer", size: 2 },
];

export const FLEET_COMPACT_4: ShipDef[] = [
  { shipId: "battleship", name: "Battleship", size: 4 },
  { shipId: "cruiser", name: "Cruiser", size: 3 },
  { shipId: "submarine", name: "Submarine", size: 3 },
  { shipId: "destroyer", name: "Destroyer", size: 2 },
];

export function getFleetForPreset(preset: FleetPreset): ShipDef[] {
  return preset === "compact_4" ? FLEET_COMPACT_4 : FLEET_CLASSIC_5;
}

// =============================================================================
// Ship Placement (PrivateState)
// =============================================================================

export type Direction = "H" | "V";

export interface ShipPlacement {
  shipId: string;
  size: number;
  startRow: number;
  startCol: number;
  direction: Direction;
  /** Computed cells occupied, e.g. ["3,4", "3,5", "3,6"] */
  cells: string[];
}

// =============================================================================
// Private State (per-player, Firestore PrivateState/{uid})
// =============================================================================

export interface BattleshipPrivateState {
  placements: ShipPlacement[];
  /** Fast lookup: "r,c" → shipId | null */
  cellToShip: Record<string, string | null>;
  /** shipId → number of hits received */
  shipHealth: Record<string, number>;
  /** shipIds still afloat */
  aliveShips: string[];
  committedAt: number | null;
}

// =============================================================================
// Public State (safe for spectators + all players)
// =============================================================================

export type BattleshipPhase = "setup" | "battle" | "resolved";

export type ShotResult = "miss" | "hit" | "sunk";

export interface ShotRecord {
  by: string;
  result: ShotResult;
  shipId?: string; // only when sunk
  shipSize?: number; // only when sunk
  atTurn: number;
  ts: number;
}

export interface PlayerStats {
  hits: number;
  misses: number;
  accuracy: number;
  shipsRemaining: number;
  shipsSunk: number;
  turnsTaken: number;
}

export interface BattleshipPublicState {
  phase: BattleshipPhase;

  // Rules (derived from settings at creation)
  rules: {
    gridSize: GridSize;
    fleetPreset: FleetPreset;
    fleetShipCount: number;
    shotMode: ShotMode;
    turnRule: TurnRule;
    allowAdjacentShips: boolean;
    setupTimeLimitSec: number;
    turnTimeLimitSec: number;
    autoResolveOnTimeout: boolean;
    spectatorRevealPolicy: SpectatorRevealPolicy;
  };

  // Setup phase
  setup: {
    readyByUid: Record<string, boolean>;
    readyAtByUid: Record<string, number>;
  };

  // Battle phase
  turnNumber: number;
  currentTurnUid: string | null;

  /**
   * Shots indexed by defender UID, then by cell key "r,c".
   * This shows what happened on each player's board (incoming fire).
   */
  shotsByDefender: Record<string, Record<string, ShotRecord>>;

  /** Per-player cumulative stats. */
  statsByUid: Record<string, PlayerStats>;

  /** Last event for UI ribbon. */
  lastEvent: string | null;

  // Resolved phase
  resolved: {
    winnerUid: string | null;
    reason: string | null;
    finalStatsByUid: Record<string, PlayerStats>;
    /** Post-game fleet reveal (only after resolved if policy allows). */
    reveal?: {
      placementsByUid: Record<string, ShipPlacement[]>;
    };
  } | null;

  /** Monotonically increasing — used by optimistic state overlay. */
  moveCount: number;
}

// =============================================================================
// Move Payloads
// =============================================================================

export interface PlaceFleetPayload {
  action: "place_fleet";
  placements: ShipPlacement[];
}

export interface FirePayload {
  action: "fire";
  target: { r: number; c: number };
}

export interface SalvoFirePayload {
  action: "salvo_fire";
  targets: Array<{ r: number; c: number }>;
}

export interface ResignPayload {
  action: "resign";
}

export type BattleshipMovePayload =
  | PlaceFleetPayload
  | FirePayload
  | SalvoFirePayload
  | ResignPayload;
