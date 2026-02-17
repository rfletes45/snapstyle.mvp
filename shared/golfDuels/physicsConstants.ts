/**
 * Physics Constants — Tunable values for Mini-Golf Duels
 *
 * Shared between server and (optionally) client for prediction.
 * All values are in world-units (wu) unless noted.
 *
 * Tuning guide:
 *   SINK_SPEED_MAX   — raise to make cups more forgiving
 *   LIP_OUT_IMPULSE  — raise for a bouncier rim rejection
 *   DEFAULT_FRICTION  — raise for heavier base deceleration
 *   SAND_FRICTION_MUL — raise to punish sand harder
 *   ICE_FRICTION_MUL  — lower for slipperier ice
 *   SLOPE_FORCE_SCALE — raise for stronger hill influence
 *   SPEED_CAP         — absolute max ball speed (prevents tunneling)
 *
 * @version 2
 */

// =============================================================================
// Simulation
// =============================================================================

/** Fixed physics timestep (ms). */
export const PHYSICS_DT = 1000 / 60; // 16.67 ms

/** Max physics sub-steps per simulation tick (prevents spiral of death). */
export const MAX_STEPS_PER_TICK = 5;

// =============================================================================
// Ball
// =============================================================================

/** Ball collision radius (wu). */
export const BALL_RADIUS = 8;

/** Base air-friction coefficient.  Applied every frame via `frictionAir`. */
export const DEFAULT_FRICTION = 0.02;

/** Maximum input power the client can request. */
export const MAX_POWER = 20;

/** Absolute speed cap (wu/frame).  Prevents tunnelling through thin walls. */
export const SPEED_CAP = 25;

// =============================================================================
// Cup / Sink
// =============================================================================

/**
 * Maximum ball speed for a successful cup capture (wu/frame).
 * Balls faster than this lip-out.
 */
export const SINK_SPEED_MAX = 3.5;

/**
 * Impulse magnitude applied when a ball lips out of the cup.
 * Directed radially away from cup centre.
 */
export const LIP_OUT_IMPULSE = 2.5;

// =============================================================================
// Stop Detection
// =============================================================================

/** Speed threshold below which a frame counts toward "stopped". */
export const STOP_EPS = 0.15;

/** Consecutive frames below STOP_EPS before the ball is force-stopped. */
export const STOP_FRAMES = 8;

/**
 * Hard anti-stuck: if the ball has been _moving_ (subPhase === ball_in_motion)
 * for this many frames without holing or stopping, force-stop it.
 */
export const ANTI_STUCK_MAX_FRAMES = 600; // ~10 seconds at 60 fps

// =============================================================================
// Surfaces
// =============================================================================

/** frictionAir multiplier while ball overlaps a **sand** zone. */
export const SAND_FRICTION_MUL = 3.5;

/** frictionAir multiplier while ball overlaps an **ice** zone. */
export const ICE_FRICTION_MUL = 0.15;

// =============================================================================
// Slopes / Speed Pads
// =============================================================================

/**
 * Force scale applied per tick while the ball overlaps a slope zone.
 * Actual force = direction · strength · SLOPE_FORCE_SCALE.
 *
 * A "speed pad" is simply a slope with high `strength` (≥ 2).
 */
export const SLOPE_FORCE_SCALE = 0.0004;

// =============================================================================
// Portals
// =============================================================================

/** Minimum speed after portal teleport (prevents immediate re-trigger). */
export const PORTAL_EXIT_MIN_SPEED = 2.0;

/**
 * Cooldown frames after a portal teleport.
 * Prevents teleport loops when exit portal overlaps entrance.
 */
export const PORTAL_COOLDOWN_FRAMES = 15;

// =============================================================================
// Obstacles
// =============================================================================

/** Default bumper restitution (bounciness).  > 1 = energy-adding. */
export const BUMPER_RESTITUTION = 1.5;

/** Default wall restitution. */
export const WALL_RESTITUTION = 0.6;

// =============================================================================
// Gameplay
// =============================================================================

/** Countdown seconds before match starts. */
export const COUNTDOWN_SECONDS = 3;

/** Delay after all players hole before advancing to next hole / end (ms). */
export const SCORECARD_DELAY_MS = 1500;

/** Offset between two tee positions (wu). */
export const TEE_OFFSET = 14;

/** Hard cap: auto-advance the player after this many strokes. */
export const MAX_STROKE_CAP = 14;

// =============================================================================
// Collision Categories (Matter.js bit masks)
// =============================================================================

/**
 * Ball-ball collision is **disabled** for multiplayer fairness.
 * Each ball gets its own category and only collides with WORLD.
 *
 * Category assignment:
 *   WORLD  = 0x0001  (walls, obstacles, cup sensor)
 *   BALL_A = 0x0002  (player 0's ball)
 *   BALL_B = 0x0004  (player 1's ball)
 *
 * Collision masks:
 *   WORLD  collides with 0xFFFF  (everything — but balls set their own mask)
 *   BALL_A collides with 0x0001  (only WORLD)
 *   BALL_B collides with 0x0001  (only WORLD)
 *
 * Result: balls interact with all static/kinematic geometry but NEVER with
 * each other.  This eliminates griefing (intentionally blocking opponent's
 * ball) while keeping the course hazards fully functional.
 */
export const COLLISION_CATEGORY_WORLD = 0x0001;
export const COLLISION_CATEGORY_BALL_A = 0x0002;
export const COLLISION_CATEGORY_BALL_B = 0x0004;
export const COLLISION_MASK_BALL = COLLISION_CATEGORY_WORLD; // balls only hit world
