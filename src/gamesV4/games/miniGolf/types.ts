/**
 * Mini Golf — Types
 *
 * Public state, move payloads, course definitions, and physics types.
 * Shared between client adapter and server adapter.
 *
 * @module gamesV4/games/miniGolf/types
 */

// =============================================================================
// Position / Vector
// =============================================================================

export interface Vec2 {
  x: number;
  y: number;
}

// =============================================================================
// Public State
// =============================================================================

export type MiniGolfPhase = "aim" | "rolling" | "between_holes" | "finished";

export interface MiniGolfPublicState {
  coursePackId: string;
  holeCount: 3 | 5 | 9 | 18;
  holeIndex: number;
  phase: MiniGolfPhase;
  holeId: string;
  holePar: number;

  /** Per-player total strokes across all holes */
  strokesTotalByUid: Record<string, number>;
  /** Per-player strokes on current hole */
  strokesThisHoleByUid: Record<string, number>;
  /** Per-player current ball position */
  ballPosByUid: Record<string, Vec2>;
  /** Per-player whether ball is sunk this hole */
  ballSunkByUid: Record<string, boolean>;
  /** Per-player last safe position (for OOB/water reset) */
  lastSafePosByUid: Record<string, Vec2>;
  /** Per-player total penalties */
  penaltiesByUid: Record<string, number>;
  /** Per-player per-hole stroke breakdown keyed by holeId */
  holeScoresByUid: Record<string, Record<string, number>>;
  /** Per-player holes-in-one count */
  holesInOneByUid: Record<string, number>;
  /** Per-player birdies count (strokes < par) */
  birdiesByUid: Record<string, number>;
  /** Track wall-contact and bumper-contact flags per shot for achievements */
  lastShotMeta: Record<
    string,
    {
      wallContact: boolean;
      bumperContact: boolean;
      sandContact: boolean;
      sunk: boolean;
    }
  >;

  /** Bounded event log (last 20) */
  events: MiniGolfEvent[];

  /** Non-null while a shot is animating (phase === "rolling"). */
  rolling?: RollingPayload | null;
}

// =============================================================================
// Rolling Payload (stored in publicState while ball is in motion)
// =============================================================================

export interface RollingPayload {
  /** Unique id to match finish_roll with the originating shot */
  shotId: string;
  /** The player whose ball is rolling */
  uid: string;
  /** Hole id for sim replay */
  holeId: string;
  /** Ball position at the start of the shot (world coords) */
  startPos: Vec2;
  /** Quantized shot angle */
  angleQ: number;
  /** Quantized shot power */
  powerQ: number;
  /** Server timestamp (ms) when rolling started */
  startedAtMs: number;
  /** Duration of the sim in ms (totalSteps * 1000/60) */
  rollDurationMs: number;
  /** Quantized final position after sim completes */
  finalPosQ: Vec2;
  /** Did the ball sink? */
  sunk: boolean;
  /** Was there a penalty? */
  penalty: boolean;
  /** Penalty type if applicable */
  penaltyType?: HazardType;
  /** Total sim steps (for client replay) */
  totalSteps: number;
}

// =============================================================================
// Events
// =============================================================================

export interface MiniGolfEvent {
  t: number;
  type: string;
  uid?: string;
  data?: Record<string, unknown>;
}

// =============================================================================
// Move Payloads
// =============================================================================

export interface ShotMove {
  type: "shot";
  angleQ: number; // int [0..3599] representing 0-359.9°
  powerQ: number; // int [0..1000] representing 0-1.0
}

export interface PickupMove {
  type: "pickup";
}

export interface NextHoleReadyMove {
  type: "next_hole_ready";
}

export interface FinishRollMove {
  type: "finish_roll";
  shotId: string;
}

export type MiniGolfMove =
  | ShotMove
  | PickupMove
  | NextHoleReadyMove
  | FinishRollMove;

// =============================================================================
// Course Definition Schema
// =============================================================================

export type SurfaceType = "turf" | "sand" | "ice" | "rough";
export type HazardType = "water" | "out_of_bounds";

export interface WallDef {
  /** Chain of points forming a wall */
  points: Vec2[];
  /** Whether to close the chain (loop) */
  loop?: boolean;
}

export interface BumperDef {
  pos: Vec2;
  radius: number;
  restitution?: number; // default ~1.2
}

export interface SurfaceRegionDef {
  type: SurfaceType;
  /** Polygon vertices */
  vertices: Vec2[];
}

export interface HazardRegionDef {
  type: HazardType;
  vertices: Vec2[];
}

export interface PortalDef {
  id: string;
  pos: Vec2;
  radius: number;
  targetId: string;
  /** Offset from target portal center for exit position */
  exitOffset: Vec2;
}

export interface RotatingGateDef {
  pivot: Vec2;
  length: number;
  thickness: number;
  /** Radians per step (deterministic) */
  angularVelocity: number;
  initialAngle?: number;
}

export interface ConveyorDef {
  vertices: Vec2[];
  /** Force direction and magnitude */
  force: Vec2;
}

export interface SlopeRegionDef {
  vertices: Vec2[];
  /** Constant force vector applied while overlapping */
  force: Vec2;
}

export interface BoostRegionDef {
  vertices: Vec2[];
  /** Impulse applied once on entry */
  impulse: Vec2;
}

export interface HoleDef {
  id: string;
  name: string;
  par: number;
  bounds: { width: number; height: number };
  tee: Vec2;
  cup: Vec2;
  cupRadius: number;
  walls: WallDef[];
  bumpers?: BumperDef[];
  surfaces?: SurfaceRegionDef[];
  hazards?: HazardRegionDef[];
  portals?: PortalDef[];
  rotatingGates?: RotatingGateDef[];
  conveyors?: ConveyorDef[];
  slopes?: SlopeRegionDef[];
  boosts?: BoostRegionDef[];
}

export interface CoursePackDef {
  id: string;
  name: string;
  holes: HoleDef[];
}

// =============================================================================
// Simulation Result
// =============================================================================

export interface SimulationResult {
  finalPos: Vec2;
  sunk: boolean;
  penalty: boolean;
  penaltyType?: HazardType;
  resetPos: Vec2;
  events: MiniGolfEvent[];
  wallContact: boolean;
  bumperContact: boolean;
  sandContact: boolean;
  totalSteps: number;
}

// =============================================================================
// Settings
// =============================================================================

export interface MiniGolfSettings {
  holeCount: 3 | 5 | 9 | 18;
  maxStrokesPerHole: number;
  allowPickups: boolean;
  assistGhostLine: boolean;
}

export const DEFAULT_MINI_GOLF_SETTINGS: MiniGolfSettings = {
  holeCount: 3,
  maxStrokesPerHole: 10,
  allowPickups: true,
  assistGhostLine: false,
};
