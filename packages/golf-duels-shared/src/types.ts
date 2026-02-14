/**
 * Golf Duels — Shared Type Definitions
 *
 * These types exactly mirror the JSON course schema and are used by both
 * the Colyseus server (physics simulation) and the three.js client (rendering).
 *
 * IMPORTANT: These types are derived from the attached course JSON files.
 * Do NOT add fields that don't exist in those files.
 */

// =============================================================================
// Primitives
// =============================================================================

export interface Vec2 {
  x: number;
  z: number;
}

// =============================================================================
// Course Geometry
// =============================================================================

/** Line-segment wall: ball bounces off the segment from a to b */
export interface Wall {
  a: Vec2;
  b: Vec2;
}

// =============================================================================
// Surfaces — affect ball physics while inside the AABB zone
// =============================================================================

export type SurfaceType = "sand" | "slow" | "speed";

export interface SurfaceBase {
  type: SurfaceType;
  id: string;
  shape: "aabb";
  min: Vec2;
  max: Vec2;
}

/** Sand: high friction, slows ball dramatically */
export interface SandSurface extends SurfaceBase {
  type: "sand";
}

/** Slow zone: moderate friction increase */
export interface SlowSurface extends SurfaceBase {
  type: "slow";
}

/** Speed boost: accelerates ball in a given direction */
export interface SpeedSurface extends SurfaceBase {
  type: "speed";
  dir: Vec2;
  accel: number;
  maxSpeed: number;
}

export type Surface = SandSurface | SlowSurface | SpeedSurface;

// =============================================================================
// HeightFields — slopes and elevation changes
// =============================================================================

export type HeightFieldType = "plane" | "dome";

/** Planar slope: a = x-slope, b = z-slope within an AABB zone (or global if no zone) */
export interface PlaneHeightField {
  type: "plane";
  a: number;
  b: number;
  zone?: {
    shape: "aabb";
    min: Vec2;
    max: Vec2;
  };
}

/** Dome: hemisphere bump centered at a point */
export interface DomeHeightField {
  type: "dome";
  center: Vec2;
  radius: number;
  height: number;
}

export type HeightField = PlaneHeightField | DomeHeightField;

// =============================================================================
// Obstacles — physical objects the ball interacts with
// =============================================================================

export type ObstacleType =
  | "bumper_round"
  | "bumper_wedge"
  | "spinner"
  | "gate"
  | "bridge"
  | "tunnel"
  | "speed_gate";

export interface BumperRoundObstacle {
  type: "bumper_round";
  id: string;
  pos: Vec2;
  radius: number;
}

export interface BumperWedgeObstacle {
  type: "bumper_wedge";
  id: string;
  pos: Vec2;
  halfLength: number;
  rotationDeg: number;
}

export interface SpinnerObstacle {
  type: "spinner";
  id: string;
  pivot: Vec2;
  length: number;
  /** Revolutions per second */
  rps: number;
  /** Starting phase offset (0-1) */
  phase: number;
}

export interface GateObstacle {
  type: "gate";
  id: string;
  hinge: Vec2;
  armLength: number;
  arcDeg: number;
  periodSec: number;
  phase: number;
  rotationBaseDeg: number;
}

export interface BridgeObstacle {
  type: "bridge";
  id: string;
  a: Vec2;
  b: Vec2;
  width: number;
}

export interface TunnelObstacle {
  type: "tunnel";
  id: string;
  enter: Vec2;
  exit: Vec2;
  radius: number;
}

export interface SpeedGateObstacle {
  type: "speed_gate";
  id: string;
  entry: {
    shape: "aabb";
    min: Vec2;
    max: Vec2;
  };
  exit: Vec2;
  minSpeed: number;
  maxSpeed: number;
  onFail: string;
  reflectRestitution: number;
}

export type Obstacle =
  | BumperRoundObstacle
  | BumperWedgeObstacle
  | SpinnerObstacle
  | GateObstacle
  | BridgeObstacle
  | TunnelObstacle
  | SpeedGateObstacle;

// =============================================================================
// Hazards — penalty zones
// =============================================================================

export type HazardType = "water" | "out_of_bounds";

export interface Hazard {
  type: HazardType;
  id: string;
  shape: "aabb";
  min: Vec2;
  max: Vec2;
}

// =============================================================================
// Decor
// =============================================================================

export interface Decor {
  theme: string;
  seed: number;
}

// =============================================================================
// Complete Hole / Course
// =============================================================================

export interface HoleData {
  version: number;
  holeId: string;
  tier: number;
  bounds: { width: number; height: number };
  start: Vec2;
  cup: Vec2;
  walls: Wall[];
  surfaces: Surface[];
  heightFields: HeightField[];
  obstacles: Obstacle[];
  hazards: Hazard[];
  decor: Decor;
}

// =============================================================================
// Manifest
// =============================================================================

export interface ManifestEntry {
  holeId: string;
  tier: number;
  file: string;
}

export interface Manifest {
  version: number;
  generatedAt: string;
  count: number;
  holes: ManifestEntry[];
}

// =============================================================================
// Match / Game State Types
// =============================================================================

/**
 * Authoritative finite-state-machine phases (exact enum names from spec).
 * Transitions: LOBBY → HOLE_INTRO → (AIMING_P1 ↔ BALL_MOVING_P1 ↔ AIMING_P2 ↔ BALL_MOVING_P2)
 *              → HOLE_RESOLVE → (HOLE_INTRO or MATCH_END)
 */
export type MatchPhase =
  | "LOBBY"
  | "HOLE_INTRO"
  | "AIMING_P1"
  | "BALL_MOVING_P1"
  | "AIMING_P2"
  | "BALL_MOVING_P2"
  | "HOLE_RESOLVE"
  | "MATCH_END";

export type HoleWinner = "p1" | "p2" | "tie" | null;
export type MatchWinner = "p1" | "p2" | null;
export type MatchEndReason = "up_by_2" | "forfeit" | null;

export interface PlayerState {
  uid: string;
  displayName: string;
  avatarUrl: string;
  holesWon: number;
  strokesThisHole: number;
  ballRestPos: Vec2;
  connected: boolean;
  isReady: boolean;
}

export interface BallState {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

export interface BallSyncState {
  owner: "p1" | "p2";
  pos: Vec2;
  vel: Vec2;
  moving: boolean;
}

export interface HoleResult {
  winner: HoleWinner;
}

export interface MatchResult {
  winner: MatchWinner;
  reason: MatchEndReason;
}

// =============================================================================
// Message Protocol — Client → Server
// =============================================================================

export interface ClientReadyMsg {
  uid: string;
  displayName: string;
  avatarUrl: string;
  authToken?: string;
}

export interface RequestShotMsg {
  aimAngleRad: number;
  power01: number;
  clientTimeMs: number;
}

export interface EmoteMsg {
  kind: string;
}

// =============================================================================
// Message Protocol — Server → Client
// =============================================================================

export interface HoleLoadedMsg {
  holeId: string;
  tier: number;
  holeNumber: number;
  seed: number;
}

export interface ShotAcceptedMsg {
  owner: "p1" | "p2";
  aimAngleRad: number;
  power01: number;
  serverShotId: number;
}

export interface ShotRejectedMsg {
  reason: "not_your_turn" | "invalid_power" | "invalid_phase" | "rate_limited";
}

export interface BallSnapshotMsg {
  owner: "p1" | "p2";
  pos: Vec2;
  vel: Vec2;
  t: number;
}

export interface HoleResultMsg {
  winner: HoleWinner;
  p1Strokes: number;
  p2Strokes: number;
}

export interface MatchEndMsg {
  winner: MatchWinner;
  p1HolesWon: number;
  p2HolesWon: number;
  holesPlayed: number;
}

// =============================================================================
// Physics Constants
// =============================================================================

export const PHYSICS = {
  /** Ball radius in world units */
  BALL_RADIUS: 0.18,
  /** Cup radius in world units */
  CUP_RADIUS: 0.22,
  /** Physics tick rate (Hz) */
  TICK_RATE: 60,
  /** Delta time per tick (seconds) */
  DT: 1 / 60,
  /** Exponential damping on turf (default surface) */
  TURF_DAMPING: 2.2,
  /** Exponential damping on sand */
  SAND_DAMPING: 4.5,
  /** Exponential damping on slow surface */
  SLOW_DAMPING: 7.0,
  /** Wall bounce restitution */
  WALL_RESTITUTION: 0.6,
  /** Bumper bounce restitution */
  BUMPER_RESTITUTION: 0.85,
  /** Velocity below which ball is considered stopped */
  STOP_THRESHOLD: 0.05,
  /** Rest time: ball must stay below STOP_THRESHOLD for this long (seconds) */
  REST_TIME: 0.25,
  /** Maximum simulation time per stroke (seconds) */
  MAX_SIM_TIME: 6.0,
  /** Shot speed at power01=0 */
  SHOT_SPEED_MIN: 2.2,
  /** Shot speed at power01=1 */
  SHOT_SPEED_MAX: 11.5,
  /** Shot power exponent curve */
  SHOT_POWER_EXPONENT: 1.15,
  /** Cup capture speed — ball must be slower than this to sink */
  CUP_CAPTURE_SPEED: 1.2,
  /** Gravity acceleration for height fields (m/s²) */
  GRAVITY: 9.81,
  /** Slope scale multiplier for height-field acceleration */
  SLOPE_SCALE: 0.35,
  /** Default speed-pad acceleration if missing from JSON */
  SPEED_PAD_DEFAULT_ACCEL: 6,
  /** Maximum ball speed after speed-pad boost */
  SPEED_PAD_MAX_SPEED: 12,
  /** Speed gate reflection restitution default */
  SPEED_GATE_RESTITUTION: 0.6,
} as const;

// =============================================================================
// Match Rule Constants
// =============================================================================

export const MATCH_RULES = {
  /** Minimum holes before a winner can be declared */
  MIN_HOLES: 5,
  /** Lead required to win after MIN_HOLES */
  WIN_LEAD: 2,
  /** Overtime tier (tier 6 holes used for overtime) */
  OVERTIME_TIER: 6,
  /** Maximum strokes per hole before auto-pickup */
  MAX_STROKES_PER_HOLE: 8,
  /** Shot clock duration in seconds */
  SHOT_CLOCK_SECONDS: 15,
  /** Between-holes intro duration in seconds */
  HOLE_INTRO_SECONDS: 3,
  /** Maximum total holes (safety limit) */
  MAX_TOTAL_HOLES: 15,
  /** Disconnect grace period in seconds */
  DISCONNECT_GRACE_SECONDS: 10,
  /** Ball snapshot broadcast rate (Hz) while ball is moving */
  BALL_SNAPSHOT_HZ: 10,
} as const;
