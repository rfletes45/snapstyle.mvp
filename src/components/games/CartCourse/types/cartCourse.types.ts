/**
 * Cart Course Game Types
 * TypeScript interfaces for the tilt-based obstacle course game
 */

import Matter from "matter-js";

// ============================================
// Vector & Basic Types
// ============================================

export interface Vector2D {
  x: number;
  y: number;
}

// ============================================
// Cart Configuration & State
// ============================================

export interface CartConfig {
  // Physical properties
  mass: number;
  wheelRadius: number;
  wheelBase: number;
  maxAngularVelocity: number;

  // Movement limits
  maxLinearVelocity: number;
  gravity: number;
  friction: number;
  airResistance: number;

  // Durability (crash thresholds)
  maxImpactVelocity: number;
  maxFallDistance: number;
  maxRotation: number;
}

export interface CartState {
  position: Vector2D;
  rotation: number;
  linearVelocity: Vector2D;
  angularVelocity: number;
  isGrounded: boolean;
  isOnRamp: boolean;
  surfaceNormal: Vector2D | null;
  currentMechanism: string | null;
  leftWheelContact: boolean;
  rightWheelContact: boolean;
}

// ============================================
// Crash Detection
// ============================================

export enum CrashType {
  WALL_IMPACT = "wall_impact",
  FLOOR_IMPACT = "floor_impact",
  FLIP = "flip",
  CRUSH = "crush",
  PIT = "pit",
  STUCK = "stuck",
  HAZARD = "hazard",
}

// ============================================
// Mechanism Types (Phase 3)
// ============================================

export enum MechanismType {
  // L/R Button Controlled
  L_ROTATING_GEAR = "l_rotating_gear",
  R_ROTATING_GEAR = "r_rotating_gear",
  L_LIFT_PLATFORM = "l_lift_platform",
  R_LIFT_PLATFORM = "r_lift_platform",
  R_LAUNCHER = "r_launcher",

  // Joystick Controlled
  LEFT_STICK_GEAR = "left_stick_gear",
  RIGHT_STICK_GEAR = "right_stick_gear",
  RIGHT_STICK_TILT = "right_stick_tilt",

  // Microphone/Blow Controlled
  FAN_PLATFORM = "fan_platform",

  // Automatic (triggered by cart)
  AUTO_ROTATE = "auto_rotate",
  AUTO_MOVE = "auto_move",
  CONVEYOR = "conveyor",
}

export type MechanismControlType =
  | "left_button"
  | "right_button"
  | "left_joystick"
  | "right_joystick"
  | "blow"
  | "auto";

export type MechanismState = "idle" | "active" | "transitioning" | "returning";

export interface MechanismConfig {
  // Control type (required)
  controlType: MechanismControlType;

  // Optional identifiers (duplicated on mechanism entity)
  id?: string;
  type?: MechanismType;

  // Activation zone (for auto mechanisms)
  activationZone?: { x: number; y: number; width: number; height: number };

  // Rotation-based
  rotationRange?: { min: number; max: number };
  rotationSpeed?: number; // degrees per second
  returnToNeutral?: boolean;
  returnSpeed?: number; // degrees per second when returning
  angularVelocity?: number; // angular velocity for rotating mechanisms
  maxAngle?: number; // maximum rotation angle

  // Position-based (lift platforms)
  startPosition?: Vector2D;
  endPosition?: Vector2D;
  moveSpeed?: number; // pixels per second
  distance?: number; // travel distance for moving platforms
  direction?: number; // direction of movement (1 or -1)
  waitTime?: number; // time to wait at endpoints

  // Launcher
  launchForce?: number;
  chargeTime?: number; // seconds to full charge
  launchDirection?: Vector2D;
  launchAngle?: number; // degrees for launch direction
  cooldown?: number; // cooldown time after launch

  // Platform attachment
  attachedPlatformId?: string;
  armLength?: number; // for rotating gears

  // Additional mechanism properties
  radius?: number; // for rotating gears/circular mechanisms
  force?: number; // force applied by mechanism (fans, conveyors)
  range?: number; // effective range of the mechanism
  width?: number; // width for conveyors and platforms
  height?: number; // height for platforms
  speed?: number; // generic speed property
  friction?: number; // friction coefficient for mechanism surface
  sensitivity?: number; // input sensitivity for joystick controls
  segments?: number; // number of segments (for gears)
}

export interface BaseMechanism {
  id: string;
  type: MechanismType;
  position: Vector2D;
  config: MechanismConfig;
  state: MechanismState;
  progress: number; // 0-1 for animations/transitions
  renderer: string;
}

export interface RotatingGearMechanism extends BaseMechanism {
  body: Matter.Body; // The gear visual body
  attachedPlatform: Matter.Body;
  currentAngle: number; // degrees
  targetAngle: number; // degrees
  armLength: number;
  renderer: "rotating_gear";
}

export interface LiftPlatformMechanism extends BaseMechanism {
  platform: Matter.Body;
  baseY: number;
  maxLiftY: number;
  currentLift: number; // 0-1
  renderer: "lift_platform";
}

export interface JoystickGearMechanism extends BaseMechanism {
  body: Matter.Body;
  attachedPlatform: Matter.Body;
  currentAngle: number;
  armLength: number;
  renderer: "joystick_gear";
}

// ============================================
// Phase 4 Mechanism Types
// ============================================

export interface LauncherPlatformMechanism extends BaseMechanism {
  platform: Matter.Body;
  chargeLevel: number; // 0-1
  isCharging: boolean;
  maxLaunchForce: number;
  chargeTime: number; // seconds
  launchDirection: Vector2D;
  activationRadius: number;
  lastLaunchTime: number;
  renderer: "launcher_platform";
}

export interface FanPlatformMechanism extends BaseMechanism {
  platform: Matter.Body;
  baseY: number;
  maxLiftY: number;
  currentLift: number; // 0-1
  liftSpeed: number;
  descentSpeed: number;
  holdToMaintain: boolean;
  blowStartTime: number;
  totalBlowTime: number;
  renderer: "fan_platform";
}

export interface AutoRotateMechanism extends BaseMechanism {
  platform: Matter.Body;
  currentAngle: number;
  targetAngle: number;
  rotationAngle: number; // total rotation in degrees
  rotationSpeed: number;
  pivotPoint: "center" | "left" | "right";
  pivotOffset: number;
  pivotPosition: Vector2D; // Computed pivot position for rendering
  isTriggered: boolean;
  triggerOnce: boolean;
  resetDelay: number;
  lastTriggerTime: number;
  cartOnPlatform: boolean;
  renderer: "auto_rotate";
}

export interface ConveyorMechanism extends BaseMechanism {
  belt: Matter.Body;
  speed: number;
  direction: "left" | "right";
  isActive: boolean;
  animationOffset: number;
  visualSegments: number;
  beltWidth: number;
  beltHeight: number;
  renderer: "conveyor";
}

export type Mechanism =
  | RotatingGearMechanism
  | LiftPlatformMechanism
  | JoystickGearMechanism
  | LauncherPlatformMechanism
  | FanPlatformMechanism
  | AutoRotateMechanism
  | ConveyorMechanism;

// ============================================
// Joystick Input (Phase 3)
// ============================================

export interface JoystickInput {
  angle: number; // radians, 0 = right, PI/2 = down
  magnitude: number; // 0-1
  x: number; // -1 to 1
  y: number; // -1 to 1
}

// ============================================
// Touch Zone Configuration (Phase 3)
// ============================================

export interface TouchZone {
  id: string;
  x: number | string; // number for pixels, string for percentage
  y: number | string;
  width: number | string;
  height: number | string;
  type: "button" | "joystick";
  controlId:
    | "left_button"
    | "right_button"
    | "left_joystick"
    | "right_joystick"
    | "blow_button";
}

export interface CrashEvent {
  type: CrashType;
  position: Vector2D;
  velocity: number;
  timestamp: number;
  impactAngle?: number; // Angle of impact for visual feedback
  surfaceType?: SurfaceType; // What surface was hit
}

// ============================================
// Surface Types (Phase 2)
// ============================================

export enum SurfaceType {
  NORMAL = "normal",
  SLIPPERY = "slippery", // Ice-like, low friction
  STICKY = "sticky", // High friction, slows down
  BOUNCY = "bouncy", // Bumper walls, high restitution
  ROUGH = "rough", // Gravel-like, very high friction
  METAL = "metal", // Medium friction, some bounce
}

export interface SurfaceMaterial {
  type: SurfaceType;
  friction: number;
  frictionStatic: number;
  restitution: number;
  density?: number;
  // Visual/audio hints
  color?: string;
  soundEffect?: string;
}

// ============================================
// Wheel Physics State (Phase 2)
// ============================================

export interface WheelState {
  angularVelocity: number; // Rotation speed
  isSlipping: boolean; // Wheel losing traction
  surfaceContact: SurfaceType | null; // Current surface
  grip: number; // 0-1 grip level
  temperature: number; // For advanced physics (optional)
}

// ============================================
// Enhanced Cart State (Phase 2)
// ============================================

export interface EnhancedCartState extends CartState {
  leftWheelState: WheelState;
  rightWheelState: WheelState;
  currentSurface: SurfaceType;
  lastGroundedY: number; // For fall distance calculation
  airTime: number; // Time spent airborne
  previousPosition: Vector2D; // For velocity/fall calculations
  impactHistory: ImpactRecord[]; // Recent impacts for analysis
}

export interface ImpactRecord {
  velocity: number;
  surfaceType: SurfaceType;
  position: Vector2D;
  timestamp: number;
  wasDeadly: boolean;
}

// ============================================
// Collision Categories
// ============================================

export const COLLISION_CATEGORIES = {
  CART: 0x0001,
  PLATFORM: 0x0002,
  WALL: 0x0004,
  MECHANISM: 0x0008,
  COLLECTIBLE: 0x0010,
  HAZARD: 0x0020,
  CHECKPOINT: 0x0040,
} as const;

// ============================================
// Entity Types
// ============================================

export interface CartEntity {
  composite: Matter.Composite;
  body: Matter.Body;
  leftWheel: Matter.Body;
  rightWheel: Matter.Body;
  state: CartState;
  config: CartConfig;
  renderer: "cart";
}

export interface PlatformEntity {
  body: Matter.Body;
  position: Vector2D;
  size: { width: number; height: number };
  rotation: number;
  friction: number;
  surfaceType: SurfaceType; // Phase 2: Surface material type
  renderer: "platform";
}

export interface WallEntity {
  body: Matter.Body;
  position: Vector2D;
  size: { width: number; height: number };
  rotation: number;
  surfaceType: SurfaceType; // Phase 2: Surface material type
  isBumper: boolean; // Phase 2: Is this a bouncy bumper?
  renderer: "wall";
}

// ============================================
// Bumper Entity (Phase 2)
// ============================================

export interface BumperEntity {
  body: Matter.Body;
  position: Vector2D;
  size: { width: number; height: number };
  rotation: number;
  bounciness: number; // 0-1, how much force to return
  maxBounceVelocity: number; // Cap on bounce velocity
  renderer: "bumper";
}

export interface CameraEntity {
  position: Vector2D;
  targetPosition: Vector2D; // Phase 2: Target for smooth interpolation
  zoom: number;
  targetZoom: number; // Phase 2: Target zoom for smooth interpolation
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  config: CameraConfig;
  currentArea: AreaBounds | null; // Phase 2: Current area for bounds clamping
  areas: AreaBounds[]; // Phase 2: All area bounds
  isTransitioning: boolean; // Phase 2: Camera transitioning between areas
}

// ============================================
// Camera Configuration
// ============================================

export interface CameraConfig {
  followMode: "centered" | "ahead" | "area-locked";
  followSmoothing: number;
  lookAheadDistance: number;
  defaultZoom: number;
  zoomRange: { min: number; max: number };
  autoZoom: boolean;
  deadZone: { x: number; y: number; width: number; height: number };
}

// ============================================
// Area Definition (Phase 2 - Camera Bounds)
// ============================================

export interface AreaBounds {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width?: number; // Computed: maxX - minX
  height?: number; // Computed: maxY - minY
  cameraZoom?: number; // Optional zoom override for this area
  transitionSmoothing?: number; // How smooth to transition to this area
}

// ============================================
// Game Entities Container
// ============================================

export interface GameEntities {
  physics: {
    engine: Matter.Engine;
    world: Matter.World;
  };
  cart: CartEntity;
  platforms: Map<string, PlatformEntity>;
  walls: Map<string, WallEntity>;
  bumpers: Map<string, BumperEntity>; // Phase 2: Bouncy bumpers
  mechanisms: Map<string, Mechanism>; // Phase 3: Interactive mechanisms
  camera: CameraEntity;
  elapsedTime: number;
  surfaceManager?: SurfaceManager; // Phase 2: Manages surface friction
  input: InputState; // Phase 3: Current input state
  [key: string]: unknown;
}

// ============================================
// Surface Manager (Phase 2)
// ============================================

export interface SurfaceManager {
  materials: Map<SurfaceType, SurfaceMaterial>;
  getMaterial: (type: SurfaceType) => SurfaceMaterial;
  applyFriction: (body: Matter.Body, surfaceType: SurfaceType) => void;
}

// ============================================
// Input State
// ============================================

export interface TiltInput {
  x: number;
  y: number;
  pitch: number;
  roll: number;
}

export interface InputState {
  tilt: TiltInput;
  leftButton: boolean;
  rightButton: boolean;
  leftJoystick: { angle: number; magnitude: number };
  rightJoystick: { angle: number; magnitude: number };
  isBlowing: boolean;
}

// ============================================
// Game State
// ============================================

export type GameStatus = "idle" | "playing" | "paused" | "crashed" | "complete";

export interface GameState {
  status: GameStatus;
  lives: number;
  score: number;
  elapsedTime: number;
  currentAreaIndex: number;
  totalAreas: number;
  bananasCollected: number;
  totalBananas: number;
  isPaused: boolean;
  showBlowIndicator: boolean;
  isBlowing: boolean;
  lastCheckpoint: number;
}

// ============================================
// Game Engine Update Props
// ============================================

export interface GameEngineUpdateProps {
  time: {
    delta: number;
    current: number;
    previous: number;
  };
  touches: unknown[];
  dispatch: (event: GameEvent) => void;
  events: GameEvent[];
  input: InputState;
  tilt: TiltInput;
}

// ============================================
// Game Events
// ============================================

export type GameEvent =
  | {
      type: "crash";
      crashType?: CrashType;
      reason?: string;
      livesRemaining?: number;
      position?: Vector2D;
    }
  | { type: "checkpoint"; index: number; checkpointId?: string }
  | { type: "collect"; itemType: string; id: string }
  | { type: "time-up" }
  | { type: "complete" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "restart" }
  | { type: "game_over"; reason?: string }
  | { type: "invincibility_end" }
  | { type: "cart_flipped" }
  | { type: "cart_recovered" }
  | { type: "respawn_teleport" }
  | { type: "respawn_complete"; invincibilityDuration?: number }
  | { type: "bonus_life"; newTotal?: number }
  | { type: "extra_life" }
  | {
      type: "area_complete";
      areaIndex?: number;
      time?: number;
      perfect?: boolean;
    }
  | { type: "area_start"; areaIndex?: number }
  | { type: "course_complete" }
  | { type: "respawn" }
  | { type: "timer_warning" }
  | { type: "timer_critical" };

// ============================================
// Renderer Props
// ============================================

export interface CartRendererProps {
  cart: CartEntity;
  camera: CameraEntity;
}

export interface PlatformRendererProps {
  platform: PlatformEntity;
  camera: CameraEntity;
}

export interface CourseRendererProps {
  entities: GameEntities;
  camera: CameraEntity;
  screenWidth: number;
  screenHeight: number;
}

// ============================================
// Course Design Types (Phase 5)
// ============================================

export type CourseTheme = "classic" | "industrial" | "sky" | "underground";
export type ScrollDirection = "vertical" | "horizontal" | "both";
export type CollectibleType = "banana" | "coin";

/**
 * Static obstacle types for course design
 */
export enum StaticObstacleType {
  RAMP = "ramp",
  PLATFORM = "platform",
  STAIRS = "stairs",
  BUMPER = "bumper",
  SPIKES = "spikes",
  PIT = "pit",
  NARROW_GAP = "narrow_gap",
  WALL = "wall",
}

/**
 * Static obstacle definition for course data
 */
export interface StaticObstacle {
  id: string;
  type: StaticObstacleType;
  position: Vector2D;
  size: { width: number; height: number };
  rotation: number;
  surfaceType?: SurfaceType;
  properties?: {
    friction?: number;
    bounciness?: number;
    isFatal?: boolean;
  };
}

/**
 * Mechanism definition for course data (defines where mechanisms are placed)
 */
export interface MechanismDefinition {
  id: string;
  type: MechanismType;
  position: Vector2D;
  config: Partial<MechanismConfig>;
}

/**
 * Collectible item in course
 */
export interface Collectible {
  id: string;
  type: CollectibleType;
  position: Vector2D;
  value?: number;
  requiresPrecedingBananas?: boolean;
  areaIndex?: number; // Area this collectible belongs to
}

/**
 * Checkpoint definition
 */
export interface Checkpoint {
  id: string;
  position: Vector2D;
  rotation: number;
  areaIndex: number;
  isStart?: boolean; // Is this the starting checkpoint?
  isFinish?: boolean; // Is this the finish line checkpoint?
  flags?: {
    autoSave: boolean;
    showTransition: boolean;
  };
}

/**
 * Area within a course (like DK Crash Course areas 1-10)
 */
export interface Area {
  id: string;
  areaNumber: number;
  name?: string;
  bounds: AreaBounds;
  obstacles: StaticObstacle[];
  mechanisms: MechanismDefinition[];
  collectibles: Collectible[];
  checkpoint: Checkpoint;
  scrollDirection: ScrollDirection;
  cameraZoom?: number;
  transitionSmoothing?: number;
  parTime?: number; // Expected time to complete this area in seconds
}

/**
 * Background layer for parallax scrolling
 */
export interface BackgroundLayer {
  id: string;
  image?: string;
  color?: string;
  parallaxFactor: number; // 0 = no movement, 1 = moves with camera
  repeatX: boolean;
  repeatY: boolean;
  zIndex: number;
}

/**
 * Foreground layer (rendered on top of game elements)
 */
export interface ForegroundLayer {
  id: string;
  image?: string;
  parallaxFactor: number;
  zIndex: number;
}

/**
 * Unlock requirements for courses
 */
export interface CourseUnlockRequirements {
  courseCompleted?: string; // ID of course that must be completed
  minStars?: number; // Minimum star rating required on prerequisite course
}

/**
 * Full course definition
 */
export interface Course {
  id: string;
  name: string;
  description?: string;
  theme: CourseTheme;

  // Dimensions
  width: number;
  height: number;

  // Areas (like DK Crash Course areas 1-10)
  areas: Area[];
  totalAreas?: number; // Total number of areas (can be inferred from areas.length)

  // Visual layers
  backgroundLayers: BackgroundLayer[];
  foregroundLayers?: ForegroundLayer[];

  // Camera configuration
  cameraConfig: CameraConfig;

  // Difficulty (1-2 normal, 3-4 expert variants)
  difficulty: 1 | 2 | 3 | 4;
  parentCourseId?: string; // For expert variants

  // Spawn
  startPosition: Vector2D;
  startRotation: number;

  // Timing
  parTime: number; // Expected completion time in seconds
  maxTime: number; // Time limit (default 600 = 10 minutes)

  // Scoring
  totalBananas: number;
  totalCoins: number;

  // Unlock requirements
  unlockRequirements?: CourseUnlockRequirements;
}

/**
 * Course progress tracking
 */
export interface CourseProgress {
  courseId: string;
  completed: boolean;
  bestTime: number;
  bestScore: number;
  bananasCollected: number;
  totalBananas: number;
  starRating: 1 | 2 | 3;
  attempts: number;
  lastCheckpointIndex: number;
}

/**
 * Game session state (runtime state during gameplay)
 */
export interface GameSession {
  courseId: string;
  lives: number;
  score: number;
  elapsedTime: number;
  currentAreaIndex: number;
  lastCheckpointIndex: number;
  bananasCollected: Set<string>;
  coinsCollected: Set<string>;
  checkpointsReached: Set<string>;
  crashCount: number;
  isPaused: boolean;
}

// ============================================
// Checkpoint System Types (Phase 5)
// ============================================

export interface CheckpointEntity {
  body: Matter.Body;
  checkpoint: Checkpoint;
  isActivated: boolean;
  activationTime?: number;
  renderer: "checkpoint";
}

export interface CollectibleEntity {
  body: Matter.Body;
  collectible: Collectible;
  isCollected: boolean;
  collectionTime?: number;
  renderer: "collectible";
}

// ============================================
// Lives System Types (Phase 5)
// ============================================

export interface LivesConfig {
  initialLives: number;
  maxLives: number;
  pointsPerExtraLife: number;
  respawnInvincibilityMs: number;
  // Extended properties used by LivesSystem
  startingLives: number;
  extraLifePoints: number;
  invincibilityDuration: number;
  respawnAnimationDuration: number;
  crashDetectionThreshold: number;
  flipTimeLimit: number;
  fallDetectionY: number;
  hazardCrash: boolean;
}

export type RespawnPhase = "none" | "fadeout" | "fadein";

export interface RespawnState {
  isRespawning: boolean;
  respawnPosition?: Vector2D;
  respawnRotation?: number;
  invincibilityEndTime?: number;
  // Extended properties used by LivesSystem
  phase: RespawnPhase;
  progress: number;
  fadeOpacity: number;
}
