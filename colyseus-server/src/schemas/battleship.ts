/**
 * Battleship Schemas — Colyseus state types for the Battleship game room
 *
 * Key design: FOG-OF-WAR
 * Ship placements are stored server-side only (NOT in Colyseus state).
 * The shared state contains only:
 *   - Phase, turn ownership, timers
 *   - Per-player readiness and ship health counts
 *   - Shot history with results (coord + miss/hit/sunk)
 *   - Sunk ship outlines (revealed after sinking)
 *   - Spectator entries
 *
 * Each player's own board is sent via targeted `client.send("your_board", ...)`
 * messages, never broadcast.
 *
 * @see docs/GAMES_SYSTEM.md — Battleship integration section
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { Player } from "./common";
import { SpectatorEntry } from "./spectator";

// =============================================================================
// Ship Configuration (shared constants, not schema)
// =============================================================================

export const BATTLESHIP_GRID_SIZE = 10;

export interface ShipDef {
  id: string;
  name: string;
  size: number;
}

/** Standard fleet: 5 ships, sizes [5, 4, 3, 3, 2] */
export const FLEET: ShipDef[] = [
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "cruiser", name: "Cruiser", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "destroyer", name: "Destroyer", size: 2 },
];

export const TOTAL_SHIP_CELLS = FLEET.reduce((sum, s) => sum + s.size, 0); // 17

// =============================================================================
// ShotRecord — A single shot in the shared history
// =============================================================================

export class ShotRecord extends Schema {
  /** Row (0–9) */
  @type("uint8") row: number = 0;

  /** Column (0–9) */
  @type("uint8") col: number = 0;

  /** Firebase UID of the shooter */
  @type("string") shooterUid: string = "";

  /** Firebase UID of the target (whose board was shot) */
  @type("string") targetUid: string = "";

  /**
   * Result of the shot:
   * "miss" | "hit" | "sunk"
   */
  @type("string") result: string = "miss";

  /** Ship ID that was hit/sunk (empty for miss) */
  @type("string") shipId: string = "";

  /** Ship name (empty for miss, set on hit/sunk for display) */
  @type("string") shipName: string = "";

  /** Turn number when shot was fired */
  @type("uint16") turnNumber: number = 0;
}

// =============================================================================
// SunkShipCell — Revealed cell of a sunk ship (for spectator/opponent display)
// =============================================================================

export class SunkShipCell extends Schema {
  @type("uint8") row: number = 0;
  @type("uint8") col: number = 0;
}

export class SunkShip extends Schema {
  @type("string") shipId: string = "";
  @type("string") shipName: string = "";
  @type("uint8") size: number = 0;
  /** Owner UID (whose board this ship was on) */
  @type("string") ownerUid: string = "";
  /** Cells revealed after sinking */
  @type([SunkShipCell]) cells = new ArraySchema<SunkShipCell>();
}

// =============================================================================
// BattleshipPlayer — Player with battleship-specific fields
// =============================================================================

export class BattleshipPlayer extends Player {
  /** Whether this player has locked in their ship placement */
  @type("boolean") placementReady: boolean = false;

  /** Number of ship cells remaining (starts at 17, decremented on hits) */
  @type("uint8") shipCellsRemaining: number = TOTAL_SHIP_CELLS;

  /** Number of ships still afloat (starts at 5) */
  @type("uint8") shipsRemaining: number = FLEET.length;

  /** Total shots fired by this player */
  @type("uint16") shotsFired: number = 0;

  /** Total hits scored by this player */
  @type("uint16") hits: number = 0;

  /** Total misses by this player */
  @type("uint16") misses: number = 0;
}

// =============================================================================
// BattleshipState — Root room state
// =============================================================================

export class BattleshipState extends Schema {
  // ── Core lifecycle ──────────────────────────────────────────────────────
  /**
   * Game phase:
   * "waiting"   → lobby, waiting for 2 players
   * "placement" → both players place ships
   * "combat"    → alternating shots
   * "finished"  → game over
   */
  @type("string") phase: string = "waiting";

  /** Game type key */
  @type("string") gameType: string = "battleship";

  /** Unique game ID */
  @type("string") gameId: string = "";

  /** Firestore game ID for persistence linkage */
  @type("string") firestoreGameId: string = "";

  /** End-to-end trace ID */
  @type("string") traceId: string = "";

  /** Whether this is a rated match */
  @type("boolean") isRated: boolean = true;

  // ── Players ─────────────────────────────────────────────────────────────
  @type({ map: BattleshipPlayer }) players = new MapSchema<BattleshipPlayer>();

  /** Maximum players (always 2) */
  @type("uint8") maxPlayers: number = 2;

  // ── Turn state ──────────────────────────────────────────────────────────
  /** UID of the player whose turn it is */
  @type("string") currentTurnUid: string = "";

  /** Current turn number (1-indexed) */
  @type("uint16") turnNumber: number = 0;

  // ── Winner ──────────────────────────────────────────────────────────────
  /** UID of the winner (empty until game ends) */
  @type("string") winnerId: string = "";

  /** Reason for win: "sunk" | "surrender" | "timeout" | "disconnect" */
  @type("string") winReason: string = "";

  // ── Timers ──────────────────────────────────────────────────────────────
  /** Placement timer remaining (ms) */
  @type("float32") placementTimeRemaining: number = 90000;

  /** Turn timer remaining (ms) */
  @type("float32") turnTimeRemaining: number = 25000;

  /** Whether the timer is running */
  @type("boolean") timerRunning: boolean = false;

  // ── Shot history (shared — visible to all) ──────────────────────────────
  @type([ShotRecord]) shotHistory = new ArraySchema<ShotRecord>();

  // ── Sunk ships (revealed outlines — visible to all including spectators)
  @type([SunkShip]) sunkShips = new ArraySchema<SunkShip>();

  // ── Last action (for animation triggers) ────────────────────────────────
  @type("string") lastActionType: string = ""; // "miss" | "hit" | "sunk"
  @type("uint8") lastActionRow: number = 0;
  @type("uint8") lastActionCol: number = 0;
  @type("string") lastActionShipName: string = "";

  // ── Spectators ──────────────────────────────────────────────────────────
  @type({ map: SpectatorEntry }) spectators = new MapSchema<SpectatorEntry>();
  @type("uint8") spectatorCount: number = 0;
  @type("uint8") maxSpectators: number = 10;

  // ── Error phase support ─────────────────────────────────────────────────
  @type("string") errorCode: string = "";
  @type("string") errorMessage: string = "";
}

// =============================================================================
// Server-side only types (NOT Colyseus schemas — never synced)
// =============================================================================

export interface ShipPlacement {
  shipId: string;
  shipName: string;
  size: number;
  /** Top-left row */
  startRow: number;
  /** Top-left col */
  startCol: number;
  /** "horizontal" | "vertical" */
  orientation: "horizontal" | "vertical";
  /** Cells occupied by this ship */
  cells: Array<{ row: number; col: number }>;
  /** Number of cells not yet hit */
  hitsRemaining: number;
}

export interface PlayerBoard {
  placements: ShipPlacement[];
  /** Quick lookup grid: cell key "r,c" → shipId or null */
  grid: Map<string, string>;
  /** Coordinates already shot at by opponent */
  shotsReceived: Set<string>;
}
