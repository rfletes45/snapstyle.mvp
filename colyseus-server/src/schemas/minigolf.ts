/**
 * Mini-Golf Duels Schemas — State types for the minigolf_duels room
 *
 * Design constraints:
 * - @colyseus/schema 64-property-per-class limit respected.
 * - Course geometry (wall polygons, hazard polygons) is NOT synced.
 *   Only IDs + dynamic kinematic obstacle state are synced.
 * - Ball positions reuse the existing Ball sub-schema pattern
 *   but are keyed per player in a MapSchema.
 *
 * @see colyseus-server/src/rooms/physics/MiniGolfDuelsRoom.ts
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { Vec2 } from "./common";
import { SpectatorEntry } from "./spectator";

// =============================================================================
// Sub-schemas
// =============================================================================

/** A golf ball tracked per player (keyed by firebase uid) */
export class GolfBall extends Schema {
  @type("string") uid: string = "";
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") vx: number = 0;
  @type("float32") vy: number = 0;
  @type("float32") radius: number = 8;
}

/** Kinematic obstacle synced to clients (id + dynamic transform only) */
export class KinematicObstacle extends Schema {
  @type("string") id: string = "";
  /** "spinner" | "moving_gate" | "bumper" */
  @type("string") obstacleType: string = "";
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") angle: number = 0;
}

/** Mini-golf player — lightweight, keyed by sessionId */
export class MiniGolfPlayer extends Schema {
  @type("string") uid: string = "";
  @type("string") sessionId: string = "";
  @type("string") displayName: string = "";
  @type("string") avatarUrl: string = "";
  @type("boolean") connected: boolean = true;
  @type("boolean") ready: boolean = false;
  @type("uint8") playerIndex: number = 0;
}

// =============================================================================
// MiniGolfState — Root room state
// =============================================================================

export class MiniGolfState extends Schema {
  // --- Game lifecycle ---
  @type("string") phase: string = "waiting";
  @type("string") gameId: string = "";
  @type("string") gameType: string = "";
  @type({ map: MiniGolfPlayer }) players = new MapSchema<MiniGolfPlayer>();
  @type("uint8") maxPlayers: number = 2;
  @type("string") winnerId: string = "";
  @type("string") winReason: string = "";

  // --- Timer ---
  @type("float32") elapsed: number = 0;
  @type("uint8") countdown: number = 0;

  // --- Course metadata (IDs only, no geometry) ---
  @type("string") packId: string = "default";
  @type("string") holeId: string = "";
  @type("uint8") holeIndex: number = 0;
  @type("uint8") holesTotal: number = 9;
  @type("uint8") par: number = 3;

  // --- Turn flow ---
  @type("string") subPhase: string = "aiming";
  @type("string") currentTurnUid: string = "";

  // --- Stroke tracking (keyed by firebase uid) ---
  @type({ map: "number" }) strokesTotalByUid = new MapSchema<number>();
  @type({ map: "number" }) strokesHoleByUid = new MapSchema<number>();
  @type({ map: "number" }) holedByUid = new MapSchema<number>();

  // --- Last safe positions (keyed by firebase uid) ---
  @type({ map: Vec2 }) lastSafePosByUid = new MapSchema<Vec2>();

  // --- Balls (keyed by firebase uid) ---
  @type({ map: GolfBall }) balls = new MapSchema<GolfBall>();

  // --- Kinematic obstacles (dynamic transform only) ---
  @type([KinematicObstacle]) obstacles = new ArraySchema<KinematicObstacle>();

  // --- Field bounds (logical units for current hole) ---
  @type("uint16") fieldWidth: number = 800;
  @type("uint16") fieldHeight: number = 1200;

  // --- Firestore linkage ---
  @type("string") firestoreGameId: string = "";
  @type("boolean") isRated: boolean = true;

  // --- Spectator support ---
  @type({ map: SpectatorEntry }) spectators = new MapSchema<SpectatorEntry>();
  @type("uint8") spectatorCount: number = 0;
  @type("uint8") maxSpectators: number = 10;

  // --- Seed ---
  @type("uint32") seed: number = 0;
}
