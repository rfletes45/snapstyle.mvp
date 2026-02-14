/**
 * Golf Duels — Colyseus State Schemas  (Segment 2 / exact protocol)
 *
 * State hierarchy:
 *   GolfDuelsState
 *   ├── p1 / p2: GolfPlayerState   (named slots, not a MapSchema)
 *   ├── ball: GolfBall              (single ball — only one moves at a time)
 *   ├── holeScores: ArraySchema<HoleScoreEntry>
 *   └── scalar fields (phase, holeNumber, shotClock, etc.)
 *
 * Phase FSM (string literal):
 *   LOBBY → HOLE_INTRO → AIMING_P1 → BALL_MOVING_P1
 *                       → AIMING_P2 → BALL_MOVING_P2
 *                       → HOLE_RESOLVE → (loop or MATCH_END)
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { SpectatorEntry } from "./spectator";

// =============================================================================
// GolfBall — single ball, owner toggles between "p1" and "p2"
// =============================================================================

export class GolfBall extends Schema {
  @type("float32") x: number = 0;
  @type("float32") z: number = 0;
  @type("float32") vx: number = 0;
  @type("float32") vz: number = 0;
  /** "p1" | "p2" */
  @type("string") owner: string = "p1";
  /** true when ball has been sunk in cup */
  @type("boolean") holed: boolean = false;
}

// =============================================================================
// GolfPlayerState — per-player state (p1 / p2 named slots)
// =============================================================================

export class GolfPlayerState extends Schema {
  /** Firebase UID */
  @type("string") uid: string = "";
  /** Colyseus session ID */
  @type("string") sessionId: string = "";
  /** Display name */
  @type("string") displayName: string = "";
  /** Avatar URL */
  @type("string") avatarUrl: string = "";
  /** Whether connected right now */
  @type("boolean") connected: boolean = true;
  /** Holes won so far */
  @type("uint8") holesWon: number = 0;
  /** Total strokes across all holes */
  @type("uint16") totalStrokes: number = 0;
  /** Strokes on the current hole */
  @type("uint8") currentHoleStrokes: number = 0;
  /** Has this player holed out on the current hole? */
  @type("boolean") holedOut: boolean = false;
  /** Shot aim angle in radians (last accepted aim) */
  @type("float32") aimAngle: number = 0;
  /** Shot power 0-1 (last accepted power) */
  @type("float32") aimPower: number = 0;
  /** Has this player sent client_ready? */
  @type("boolean") ready: boolean = false;
}

// =============================================================================
// HoleScoreEntry — result for each completed hole
// =============================================================================

export class HoleScoreEntry extends Schema {
  @type("string") holeId: string = "";
  @type("uint8") holeNumber: number = 0;
  @type("uint8") p1Strokes: number = 0;
  @type("uint8") p2Strokes: number = 0;
  /** "p1" | "p2" | "tie" */
  @type("string") winner: string = "";
}

// =============================================================================
// GolfDuelsState — Root state for the GolfDuelsRoom
// =============================================================================

export class GolfDuelsState extends Schema {
  // --- Phase FSM ---
  /** LOBBY | HOLE_INTRO | AIMING_P1 | BALL_MOVING_P1 | AIMING_P2 | BALL_MOVING_P2 | HOLE_RESOLVE | MATCH_END */
  @type("string") phase: string = "LOBBY";
  @type("string") gameId: string = "";
  @type("string") gameType: string = "golf_duels";

  // --- Players (named p1/p2 slots) ---
  @type(GolfPlayerState) p1 = new GolfPlayerState();
  @type(GolfPlayerState) p2 = new GolfPlayerState();
  @type("uint8") maxPlayers: number = 2;
  @type("uint8") playerCount: number = 0;

  // --- Match progress ---
  /** 1-based hole number */
  @type("uint8") holeNumber: number = 0;
  @type("string") currentHoleId: string = "";
  @type("uint8") holePar: number = 0;

  // --- Ball ---
  @type(GolfBall) ball = new GolfBall();

  // --- Hole scores history ---
  @type([HoleScoreEntry]) holeScores = new ArraySchema<HoleScoreEntry>();

  // --- Timer ---
  @type("float32") shotClock: number = 0;
  /** "p1" | "p2" | "" */
  @type("string") activePlayer: string = "";

  // --- Match result ---
  /** "p1" | "p2" | "" */
  @type("string") matchWinner: string = "";
  /** "up_by_2" | "forfeit" | "" */
  @type("string") matchEndReason: string = "";

  // --- Course bounds (for client) ---
  @type("float32") courseWidth: number = 0;
  @type("float32") courseHeight: number = 0;
  @type("float32") cupX: number = 0;
  @type("float32") cupZ: number = 0;
  @type("float32") startX: number = 0;
  @type("float32") startZ: number = 0;

  // --- Spectators ---
  @type({ map: SpectatorEntry }) spectators = new MapSchema<SpectatorEntry>();
  @type("uint8") spectatorCount: number = 0;
  @type("uint8") maxSpectators: number = 10;

  // --- Misc ---
  @type("string") firestoreGameId: string = "";
  @type("boolean") isRated: boolean = true;
  /** Elapsed time within current hole (for animated obstacles) */
  @type("float32") holeElapsed: number = 0;
}
