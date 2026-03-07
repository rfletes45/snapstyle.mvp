/**
 * Mini Golf — Server-side Types (duplicated for Cloud Functions parity)
 *
 * MUST remain in sync with src/gamesV4/games/miniGolf/types.ts
 *
 * @module gamesV4/minigolf/types
 */

export interface Vec2 {
  x: number;
  y: number;
}

export type MiniGolfPhase = "aim" | "rolling" | "between_holes" | "finished";

export interface MiniGolfPublicState {
  coursePackId: string;
  holeCount: 3 | 5 | 9 | 18;
  holeIndex: number;
  phase: MiniGolfPhase;
  holeId: string;
  holePar: number;
  strokesTotalByUid: Record<string, number>;
  strokesThisHoleByUid: Record<string, number>;
  ballPosByUid: Record<string, Vec2>;
  ballSunkByUid: Record<string, boolean>;
  lastSafePosByUid: Record<string, Vec2>;
  penaltiesByUid: Record<string, number>;
  holeScoresByUid: Record<string, Record<string, number>>;
  holesInOneByUid: Record<string, number>;
  birdiesByUid: Record<string, number>;
  lastShotMeta: Record<
    string,
    {
      wallContact: boolean;
      bumperContact: boolean;
      sandContact: boolean;
      sunk: boolean;
    }
  >;
  events: MiniGolfEvent[];
}

export interface MiniGolfEvent {
  t: number;
  type: string;
  uid?: string;
  data?: Record<string, unknown>;
}

export interface ShotMove {
  type: "shot";
  angleQ: number;
  powerQ: number;
}

export interface PickupMove {
  type: "pickup";
}

export interface NextHoleReadyMove {
  type: "next_hole_ready";
}

export type MiniGolfMove = ShotMove | PickupMove | NextHoleReadyMove;

export type SurfaceType = "turf" | "sand" | "ice" | "rough";
export type HazardType = "water" | "out_of_bounds";

export interface WallDef {
  points: Vec2[];
  loop?: boolean;
}

export interface BumperDef {
  pos: Vec2;
  radius: number;
  restitution?: number;
}

export interface SurfaceRegionDef {
  type: SurfaceType;
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
  exitOffset: Vec2;
}

export interface RotatingGateDef {
  pivot: Vec2;
  length: number;
  thickness: number;
  angularVelocity: number;
  initialAngle?: number;
}

export interface ConveyorDef {
  vertices: Vec2[];
  force: Vec2;
}

export interface SlopeRegionDef {
  vertices: Vec2[];
  force: Vec2;
}

export interface BoostRegionDef {
  vertices: Vec2[];
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
