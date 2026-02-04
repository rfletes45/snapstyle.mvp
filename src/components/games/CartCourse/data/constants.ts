/**
 * Cart Course Physics Constants
 * All physics-related constants and configurations
 */

import {
  CameraConfig,
  CartConfig,
  COLLISION_CATEGORIES,
  SurfaceMaterial,
  SurfaceType,
} from "../types/cartCourse.types";

// ============================================
// Cart Dimensions
// ============================================

export const CART_WIDTH = 32;
export const CART_HEIGHT = 20;
export const WHEEL_RADIUS = 8;

// ============================================
// Default Cart Configuration
// ============================================

export const DEFAULT_CART_CONFIG: CartConfig = {
  // Physical properties
  mass: 1.0,
  wheelRadius: WHEEL_RADIUS,
  wheelBase: 24,
  maxAngularVelocity: 720, // degrees/sec

  // Movement limits
  maxLinearVelocity: 400, // pixels/sec
  gravity: 980, // pixels/sec²
  friction: 0.3,
  airResistance: 0.02,

  // Durability (crash thresholds)
  maxImpactVelocity: 350, // Crash if hit wall faster than this
  maxFallDistance: 100, // Crash if fall more than this
  maxRotation: 110, // Crash if tilted more than this from vertical (degrees)
};

// ============================================
// Physics World Constants
// ============================================

export const PHYSICS_CONFIG = {
  gravity: { x: 0, y: 1 }, // Normalized, will be multiplied by scale
  gravityScale: 0.001, // Scale factor for Matter.js gravity
  enableSleeping: false,
  timestep: 1000 / 60, // 60 FPS
  velocityIterations: 8,
  positionIterations: 6,
};

// ============================================
// Collision Filters
// ============================================

export const CART_COLLISION_FILTER = {
  category: COLLISION_CATEGORIES.CART,
  mask:
    COLLISION_CATEGORIES.PLATFORM |
    COLLISION_CATEGORIES.WALL |
    COLLISION_CATEGORIES.MECHANISM |
    COLLISION_CATEGORIES.HAZARD,
};

export const PLATFORM_COLLISION_FILTER = {
  category: COLLISION_CATEGORIES.PLATFORM,
  mask: COLLISION_CATEGORIES.CART,
};

export const WALL_COLLISION_FILTER = {
  category: COLLISION_CATEGORIES.WALL,
  mask: COLLISION_CATEGORIES.CART,
};

// ============================================
// Material Properties
// ============================================

export const MATERIALS = {
  cart: {
    friction: 0.8,
    frictionStatic: 0.9,
    frictionAir: 0.01,
    restitution: 0.1, // Low bounce
    density: 0.001,
  },
  wheel: {
    friction: 0.9, // High friction for grip
    frictionStatic: 1.0,
    frictionAir: 0.001,
    restitution: 0.05, // Very low bounce
    density: 0.001,
  },
  platform: {
    friction: 0.6,
    frictionStatic: 0.7,
    restitution: 0.0,
  },
  wall: {
    friction: 0.4,
    frictionStatic: 0.5,
    restitution: 0.1,
  },
  bumper: {
    friction: 0.3,
    frictionStatic: 0.4,
    restitution: 0.8, // High bounce
  },
};

// ============================================
// Surface Materials (Phase 2)
// ============================================

export const SURFACE_MATERIALS: Record<SurfaceType, SurfaceMaterial> = {
  [SurfaceType.NORMAL]: {
    type: SurfaceType.NORMAL,
    friction: 0.6,
    frictionStatic: 0.7,
    restitution: 0.0,
    color: "#8b4513", // Saddle brown
    soundEffect: "roll_normal",
  },
  [SurfaceType.SLIPPERY]: {
    type: SurfaceType.SLIPPERY,
    friction: 0.05, // Very low friction - ice-like
    frictionStatic: 0.08,
    restitution: 0.02,
    color: "#87CEEB", // Sky blue (ice)
    soundEffect: "roll_ice",
  },
  [SurfaceType.STICKY]: {
    type: SurfaceType.STICKY,
    friction: 1.2, // Very high friction - tar-like
    frictionStatic: 1.5,
    restitution: 0.0,
    color: "#2F4F4F", // Dark slate gray
    soundEffect: "roll_sticky",
  },
  [SurfaceType.BOUNCY]: {
    type: SurfaceType.BOUNCY,
    friction: 0.3,
    frictionStatic: 0.4,
    restitution: 0.85, // High bounce - saves from crashes
    color: "#FF6B6B", // Red/orange bumper
    soundEffect: "bumper_hit",
  },
  [SurfaceType.ROUGH]: {
    type: SurfaceType.ROUGH,
    friction: 0.95, // Very high - gravel-like
    frictionStatic: 1.1,
    restitution: 0.05,
    color: "#696969", // Dim gray (gravel)
    soundEffect: "roll_gravel",
  },
  [SurfaceType.METAL]: {
    type: SurfaceType.METAL,
    friction: 0.4, // Medium-low friction
    frictionStatic: 0.5,
    restitution: 0.15, // Some bounce
    color: "#708090", // Slate gray
    soundEffect: "roll_metal",
  },
};

// ============================================
// Wheel Physics (Phase 2)
// ============================================

export const WHEEL_PHYSICS = {
  // Grip calculation
  baseGrip: 1.0, // Normal grip level
  slipThreshold: 0.3, // Angular velocity difference threshold for slip detection
  gripRecoveryRate: 0.1, // How fast grip recovers after slipping

  // Friction multipliers per surface
  surfaceFrictionMultipliers: {
    [SurfaceType.NORMAL]: 1.0,
    [SurfaceType.SLIPPERY]: 0.15,
    [SurfaceType.STICKY]: 1.8,
    [SurfaceType.BOUNCY]: 0.5,
    [SurfaceType.ROUGH]: 1.4,
    [SurfaceType.METAL]: 0.7,
  },

  // Wheel rotation physics
  maxAngularVelocity: 50, // Max wheel rotation speed (rad/s)
  angularDamping: 0.05, // How fast wheel rotation slows
  rollingResistance: 0.02, // Energy lost to rolling
};

// ============================================
// Bumper Configuration (Phase 2)
// ============================================

export const BUMPER_CONFIG = {
  defaultBounciness: 0.85,
  maxBounceVelocity: 12, // Cap to prevent launching into orbit
  minBounceVelocity: 2, // Minimum bounce to feel responsive
  crashProtection: true, // Bumpers prevent wall impact crashes
  bounceAngleVariation: 0.1, // Slight angle variation on bounce
  visualPulseOnHit: true, // Visual feedback
  soundEffect: "bumper_hit",
};

// ============================================
// Mechanism Configuration (Phase 3)
// ============================================

export const MECHANISM_CONFIG = {
  // Rotating Gear defaults
  rotatingGear: {
    defaultRotationSpeed: 90, // degrees per second
    defaultReturnSpeed: 45, // degrees per second when returning
    defaultArmLength: 80, // pixels
    maxRotation: 180, // maximum rotation range
    minRotation: -180,
    platformWidth: 100,
    platformHeight: 15,
    gearRadius: 20,
    returnToNeutral: true,
  },

  // Lift Platform defaults
  liftPlatform: {
    defaultMoveSpeed: 100, // pixels per second
    defaultReturnSpeed: 50, // pixels per second when returning
    defaultLiftHeight: 150, // pixels
    platformWidth: 120,
    platformHeight: 15,
    holdToMaintain: true, // Must hold button to keep raised
  },

  // Joystick Gear defaults
  joystickGear: {
    defaultRotationSpeed: 120, // degrees per second
    maxRotation: 90, // max angle from center
    armLength: 80,
    deadzone: 0.2, // joystick deadzone
    returnToNeutral: true,
    returnSpeed: 60,
  },

  // Phase 4: Launcher Platform defaults
  launcher: {
    maxLaunchForce: 15, // impulse strength
    chargeTime: 1.5, // seconds to full charge
    platformWidth: 80,
    platformHeight: 20,
    minChargeToLaunch: 0.2, // minimum charge to trigger launch
    cooldownTime: 0.5, // seconds after launch before can charge again
  },

  // Phase 4: Fan Platform defaults
  fanPlatform: {
    defaultLiftSpeed: 2.0, // lift rate per second (0-1)
    defaultDescentSpeed: 1.0, // descent rate per second
    defaultLiftHeight: 120, // pixels
    platformWidth: 100,
    platformHeight: 15,
    windForce: 5, // additional upward force on cart
  },

  // Phase 4: Auto Rotate defaults
  autoRotate: {
    defaultRotationSpeed: 45, // degrees per second
    defaultActivationRadius: 40, // pixels from center to trigger
    defaultMaxRotation: 360, // max rotation before resetting
    platformWidth: 100,
    platformHeight: 15,
    pivotOffset: { x: 0, y: 0 }, // offset from platform center
    continuous: true, // keep rotating while cart is nearby
  },

  // Phase 4: Conveyor defaults
  conveyor: {
    defaultSpeed: 80, // pixels per second
    defaultWidth: 200,
    defaultHeight: 20,
    beltAnimationSpeed: 2.0, // visual animation multiplier
    frictionOverride: 0.1, // low friction for sliding effect
  },

  // Collision filter for mechanism platforms
  collisionFilter: {
    category: COLLISION_CATEGORIES.MECHANISM,
    mask: COLLISION_CATEGORIES.CART,
  },
};

// ============================================
// Touch Zone Configuration (Phase 3)
// ============================================

export const TOUCH_ZONES = {
  leftButton: {
    id: "left_button",
    x: 0,
    y: "40%",
    width: "15%",
    height: "30%",
    type: "button" as const,
    controlId: "left_button" as const,
  },
  rightButton: {
    id: "right_button",
    x: "85%",
    y: "40%",
    width: "15%",
    height: "30%",
    type: "button" as const,
    controlId: "right_button" as const,
  },
  leftJoystick: {
    id: "left_joystick",
    x: "5%",
    y: "60%",
    width: "25%",
    height: "35%",
    type: "joystick" as const,
    controlId: "left_joystick" as const,
  },
  rightJoystick: {
    id: "right_joystick",
    x: "70%",
    y: "60%",
    width: "25%",
    height: "35%",
    type: "joystick" as const,
    controlId: "right_joystick" as const,
  },
  blowButton: {
    id: "blow_button",
    x: "40%",
    y: "85%",
    width: "20%",
    height: "12%",
    type: "button" as const,
    controlId: "blow_button" as const,
  },
};

// ============================================
// Joystick Visual Configuration (Phase 3)
// ============================================

export const JOYSTICK_CONFIG = {
  outerRadius: 50, // pixels
  innerRadius: 25, // pixels (knob)
  maxDisplacement: 40, // max pixels knob can move
  returnSpeed: 0.3, // how fast knob returns to center
  deadzone: 0.15, // input deadzone (0-1)
  colors: {
    outerRing: "rgba(255, 255, 255, 0.2)",
    outerRingActive: "rgba(255, 255, 255, 0.3)",
    innerKnob: "rgba(255, 255, 255, 0.5)",
    innerKnobActive: "rgba(255, 255, 255, 0.7)",
  },
};

// ============================================
// Button Visual Configuration (Phase 3)
// ============================================

export const BUTTON_CONFIG = {
  size: 60, // pixels
  borderRadius: 12,
  colors: {
    idle: "rgba(255, 255, 255, 0.15)",
    pressed: "rgba(255, 107, 107, 0.5)",
    border: "rgba(255, 255, 255, 0.3)",
    text: "rgba(255, 255, 255, 0.7)",
  },
  labels: {
    left: "L",
    right: "R",
    blow: "💨",
  },
};

// ============================================
// Collision Filters (Updated for Phase 2)
// ============================================

export const BUMPER_COLLISION_FILTER = {
  category: COLLISION_CATEGORIES.WALL, // Bumpers use wall category
  mask: COLLISION_CATEGORIES.CART,
};

// ============================================
// Mechanism Collision Filter (Phase 3)
// ============================================

export const MECHANISM_COLLISION_FILTER = {
  category: COLLISION_CATEGORIES.MECHANISM,
  mask: COLLISION_CATEGORIES.CART,
};

// ============================================
// Tilt Controls
// ============================================

export const TILT_CONFIG = {
  updateInterval: 16, // ~60 FPS
  smoothingFactor: 0.15, // Lower = more smoothing
  maxTiltAngle: 45, // Max device tilt in degrees
  tiltMultiplier: 0.5, // How much tilt affects gravity
  invertX: false,
  invertY: false,
  deadzone: 0.05, // Ignore small tilts
};

// ============================================
// Crash Detection Thresholds
// ============================================

export const CRASH_CONFIG = {
  maxImpactVelocity: 8, // Matter.js velocity units
  maxRotationDegrees: 110, // Degrees from upright
  pitThreshold: 200, // Pixels below course floor
  stuckTimeout: 3000, // MS without movement = stuck
  stuckVelocityThreshold: 0.1, // Velocity below this = not moving

  // Phase 2: Enhanced crash detection
  impactVelocityThresholds: {
    // Different thresholds for different surfaces
    [SurfaceType.NORMAL]: 8,
    [SurfaceType.SLIPPERY]: 10, // Higher threshold - slide instead of crash
    [SurfaceType.STICKY]: 6, // Lower threshold - impacts harder
    [SurfaceType.BOUNCY]: 999, // Bumpers don't cause crashes
    [SurfaceType.ROUGH]: 7,
    [SurfaceType.METAL]: 9,
  },

  // Fall damage calculation
  fallDamageStartHeight: 80, // Start taking fall damage at this height
  fallDamageFatalHeight: 150, // Instant crash at this fall distance
  fallDamageGracePeriod: 100, // ms grace period after leaving ground

  // Flip detection refinement
  flipAngleRecoveryThreshold: 90, // Can recover if angle < this
  flipAngularVelocityThreshold: 5, // rad/s - if spinning too fast, crash
};

// ============================================
// Camera Configuration (Phase 2 Enhanced)
// ============================================

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  followMode: "ahead",
  followSmoothing: 0.08,
  lookAheadDistance: 100,
  defaultZoom: 1.0,
  zoomRange: { min: 0.8, max: 1.2 },
  autoZoom: true,
  deadZone: { x: 0, y: 0, width: 100, height: 150 },
};

// Phase 2: Advanced camera settings
export const CAMERA_ADVANCED_CONFIG = {
  // Lookahead based on velocity
  lookAheadVelocityMultiplier: 0.3, // How much velocity affects lookahead
  lookAheadVerticalMultiplier: 0.2, // Less lookahead vertically
  maxLookAhead: 150, // Maximum lookahead distance

  // Smoothing variations
  normalSmoothing: 0.08,
  transitionSmoothing: 0.04, // Slower when changing areas
  fastSmoothing: 0.15, // Faster catch-up when cart moves fast

  // Zoom based on velocity
  zoomVelocityThreshold: 5, // Start zooming out above this speed
  zoomSmoothingFactor: 0.05,

  // Area transition
  areaTransitionTime: 500, // ms to transition between areas
  boundsPadding: 50, // Padding inside area bounds

  // Screen shake (crash feedback)
  screenShakeIntensity: 10,
  screenShakeDuration: 300,
  screenShakeDecay: 0.9,
};

// ============================================
// Visual Constants
// ============================================

export const VISUAL_CONFIG = {
  // Color palette - Classic theme
  colors: {
    background: "#1a1a2e",
    girders: "#d4a857",
    platforms: "#8b4513",
    walls: "#636e72",
    accents: "#ff6b6b",
    text: "#ffffff",
  },
  // Cart colors
  cart: {
    bodyColor: "#e74c3c",
    wheelColor: "#2c3e50",
    highlightColor: "#f39c12",
    axleColor: "#7f8c8d",
  },
};

// ============================================
// Debug Configuration
// ============================================

export const DEBUG_CONFIG = {
  showCollisionBodies: false,
  showVelocityVectors: false,
  showContactPoints: false,
  showFPS: true,
  logCollisions: false,
  logCrashes: true,
};
