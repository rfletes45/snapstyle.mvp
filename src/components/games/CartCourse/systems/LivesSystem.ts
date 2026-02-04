/**
 * Lives System
 *
 * Manages player lives, crash detection, respawn process, and invincibility.
 * Integrates with CheckpointSystem for respawn positions.
 */

import Matter from "matter-js";
import {
  GameEngineUpdateProps,
  GameEntities,
  GameEvent,
  LivesConfig,
  RespawnState,
  Vector2D,
} from "../types/cartCourse.types";
import {
  CheckpointState,
  completeRespawn,
  isRespawnComplete,
  respawnAtCheckpoint,
  startRespawn,
} from "./CheckpointSystem";

// ============================================
// Lives Configuration
// ============================================

export const DEFAULT_LIVES_CONFIG: LivesConfig = {
  // Base properties (for compatibility)
  initialLives: 3,
  pointsPerExtraLife: 2000,
  respawnInvincibilityMs: 2000,
  // Extended properties
  startingLives: 3,
  maxLives: 5,
  extraLifePoints: 2000, // Points needed for extra life
  invincibilityDuration: 2000, // MS of invincibility after respawn
  respawnAnimationDuration: 1000, // MS for respawn animation
  crashDetectionThreshold: 25, // Impact force threshold for crash
  flipTimeLimit: 3000, // MS before flipped cart is considered crashed
  fallDetectionY: 8100, // Y position below which cart is considered fallen
  hazardCrash: true, // Whether hazards cause instant crash
};

// ============================================
// Lives State
// ============================================

export interface LivesState {
  currentLives: number;
  maxLives: number;
  totalDeaths: number;
  deathPositions: Vector2D[];
  scoreForNextLife: number;
  extraLivesEarned: number;
  // Crash detection
  isCrashed: boolean;
  crashTime: number;
  crashReason: CrashReason | null;
  // Invincibility
  isInvincible: boolean;
  invincibilityEndTime: number;
  // Flip detection
  isFlipped: boolean;
  flipStartTime: number;
  // Respawn
  respawnState: RespawnState;
}

export type CrashReason = "impact" | "flip" | "fall" | "hazard" | "timeout";

/**
 * Create initial lives state
 */
export function createLivesState(
  config: LivesConfig = DEFAULT_LIVES_CONFIG,
): LivesState {
  return {
    currentLives: config.startingLives,
    maxLives: config.maxLives,
    totalDeaths: 0,
    deathPositions: [],
    scoreForNextLife: config.extraLifePoints,
    extraLivesEarned: 0,
    isCrashed: false,
    crashTime: 0,
    crashReason: null,
    isInvincible: false,
    invincibilityEndTime: 0,
    isFlipped: false,
    flipStartTime: 0,
    respawnState: {
      isRespawning: false,
      phase: "none",
      progress: 0,
      fadeOpacity: 1,
    },
  };
}

// ============================================
// Crash Detection
// ============================================

/**
 * Check if cart is flipped (upside down)
 */
export function isCartFlipped(cartBody: Matter.Body): boolean {
  // Cart is flipped if rotation is between 90 and 270 degrees
  const angle = cartBody.angle;
  const normalizedAngle =
    ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return normalizedAngle > Math.PI / 2 && normalizedAngle < (3 * Math.PI) / 2;
}

/**
 * Check for crash from impact
 */
export function detectImpactCrash(
  collision: Matter.IEventCollision<Matter.Engine>,
  config: LivesConfig,
  isInvincible: boolean,
): boolean {
  if (isInvincible) return false;

  for (const pair of collision.pairs) {
    const { bodyA, bodyB } = pair;
    const isCartInvolved =
      bodyA.label?.startsWith("cart_") || bodyB.label?.startsWith("cart_");

    if (!isCartInvolved) continue;

    // Check impact velocity
    const relativeVelocity = Matter.Vector.magnitude(
      Matter.Vector.sub(bodyA.velocity, bodyB.velocity),
    );

    if (relativeVelocity > config.crashDetectionThreshold) {
      return true;
    }
  }

  return false;
}

/**
 * Check if cart has fallen off course
 */
export function hasCartFallen(
  cartBody: Matter.Body,
  config: LivesConfig,
): boolean {
  return cartBody.position.y > config.fallDetectionY;
}

/**
 * Check for hazard collision
 */
export function detectHazardCrash(
  collision: Matter.IEventCollision<Matter.Engine>,
  config: LivesConfig,
  isInvincible: boolean,
): boolean {
  if (isInvincible || !config.hazardCrash) return false;

  for (const pair of collision.pairs) {
    const { bodyA, bodyB } = pair;

    // Check if either body is a hazard
    const isHazardCollision =
      bodyA.label?.includes("hazard") ||
      bodyB.label?.includes("hazard") ||
      bodyA.label?.includes("spike") ||
      bodyB.label?.includes("spike");

    // Check if cart is involved
    const isCartInvolved =
      bodyA.label?.startsWith("cart_") || bodyB.label?.startsWith("cart_");

    if (isHazardCollision && isCartInvolved) {
      return true;
    }
  }

  return false;
}

// ============================================
// Lives System
// ============================================

/**
 * Lives System - main game engine system
 */
export function LivesSystem(
  entities: GameEntities & {
    livesState?: LivesState;
    checkpointState?: CheckpointState;
    livesConfig?: LivesConfig;
  },
  { time, dispatch }: GameEngineUpdateProps,
): GameEntities {
  const {
    cart,
    livesState,
    checkpointState,
    livesConfig = DEFAULT_LIVES_CONFIG,
  } = entities;

  if (!livesState || !checkpointState) {
    return entities;
  }

  const currentTime = time.current;

  // Handle respawn phase
  if (livesState.respawnState.isRespawning) {
    updateRespawnAnimation(
      livesState,
      checkpointState,
      cart.composite,
      currentTime,
      livesConfig,
      dispatch,
    );
    return entities;
  }

  // Skip crash detection during invincibility
  if (livesState.isInvincible) {
    if (currentTime >= livesState.invincibilityEndTime) {
      livesState.isInvincible = false;
      dispatch({ type: "invincibility_end" });
    }
    return entities;
  }

  // Get cart body
  const cartBody = cart.composite.bodies.find((b) => b.label === "cart_body");
  if (!cartBody) {
    return entities;
  }

  // Check for flip
  const isFlipped = isCartFlipped(cartBody);

  if (isFlipped && !livesState.isFlipped) {
    // Just became flipped
    livesState.isFlipped = true;
    livesState.flipStartTime = currentTime;
    dispatch({ type: "cart_flipped" });
  } else if (!isFlipped && livesState.isFlipped) {
    // Recovered from flip
    livesState.isFlipped = false;
    livesState.flipStartTime = 0;
    dispatch({ type: "cart_recovered" });
  }

  // Check flip timeout
  if (
    livesState.isFlipped &&
    currentTime - livesState.flipStartTime > livesConfig.flipTimeLimit
  ) {
    triggerCrash(
      livesState,
      checkpointState,
      cartBody.position,
      "flip",
      currentTime,
      dispatch,
    );
    return entities;
  }

  // Check for fall
  if (hasCartFallen(cartBody, livesConfig)) {
    triggerCrash(
      livesState,
      checkpointState,
      cartBody.position,
      "fall",
      currentTime,
      dispatch,
    );
    return entities;
  }

  return entities;
}

/**
 * Trigger a crash
 */
export function triggerCrash(
  livesState: LivesState,
  checkpointState: CheckpointState,
  position: Vector2D,
  reason: CrashReason,
  currentTime: number,
  dispatch: (event: GameEvent) => void,
): void {
  // Record crash
  livesState.isCrashed = true;
  livesState.crashTime = currentTime;
  livesState.crashReason = reason;
  livesState.totalDeaths++;
  livesState.deathPositions.push({ ...position });

  // Decrement lives
  livesState.currentLives = Math.max(0, livesState.currentLives - 1);

  // Dispatch crash event
  dispatch({
    type: "crash",
    reason,
    livesRemaining: livesState.currentLives,
    position,
  });

  // Check game over
  if (livesState.currentLives <= 0) {
    dispatch({ type: "game_over", reason: "no_lives" });
    return;
  }

  // Start respawn
  startRespawnProcess(livesState, checkpointState, currentTime);
}

/**
 * Start respawn process
 */
function startRespawnProcess(
  livesState: LivesState,
  checkpointState: CheckpointState,
  currentTime: number,
): void {
  livesState.respawnState = {
    isRespawning: true,
    phase: "fadeout",
    progress: 0,
    fadeOpacity: 1,
  };

  startRespawn(checkpointState, currentTime);
}

/**
 * Update respawn animation
 */
function updateRespawnAnimation(
  livesState: LivesState,
  checkpointState: CheckpointState,
  cartComposite: Matter.Composite,
  currentTime: number,
  config: LivesConfig,
  dispatch: (event: GameEvent) => void,
): void {
  const { respawnState } = livesState;
  const elapsed = currentTime - checkpointState.respawnStartTime;
  const halfDuration = config.respawnAnimationDuration / 2;

  if (respawnState.phase === "fadeout") {
    // Fade out phase
    respawnState.progress = Math.min(elapsed / halfDuration, 1);
    respawnState.fadeOpacity = 1 - respawnState.progress;

    if (elapsed >= halfDuration) {
      // Teleport cart to checkpoint
      respawnAtCheckpoint(cartComposite, checkpointState);

      // Switch to fade in phase
      respawnState.phase = "fadein";
      respawnState.progress = 0;

      dispatch({ type: "respawn_teleport" });
    }
  } else if (respawnState.phase === "fadein") {
    // Fade in phase
    const fadeInElapsed = elapsed - halfDuration;
    respawnState.progress = Math.min(fadeInElapsed / halfDuration, 1);
    respawnState.fadeOpacity = respawnState.progress;

    if (
      isRespawnComplete(
        checkpointState,
        currentTime,
        config.respawnAnimationDuration,
      )
    ) {
      // Complete respawn
      completeRespawn(checkpointState);

      livesState.respawnState = {
        isRespawning: false,
        phase: "none",
        progress: 0,
        fadeOpacity: 1,
      };

      livesState.isCrashed = false;
      livesState.crashReason = null;
      livesState.isFlipped = false;
      livesState.flipStartTime = 0;

      // Start invincibility
      livesState.isInvincible = true;
      livesState.invincibilityEndTime =
        currentTime + config.invincibilityDuration;

      dispatch({
        type: "respawn_complete",
        invincibilityDuration: config.invincibilityDuration,
      });
    }
  }
}

// ============================================
// Extra Life System
// ============================================

/**
 * Check if player has earned an extra life from score
 */
export function checkExtraLife(
  livesState: LivesState,
  currentScore: number,
  config: LivesConfig = DEFAULT_LIVES_CONFIG,
): boolean {
  if (
    currentScore >= livesState.scoreForNextLife &&
    livesState.currentLives < livesState.maxLives
  ) {
    // Award extra life
    livesState.currentLives++;
    livesState.extraLivesEarned++;
    livesState.scoreForNextLife += config.extraLifePoints;
    return true;
  }
  return false;
}

/**
 * Award a bonus life (from collectible)
 */
export function awardBonusLife(
  livesState: LivesState,
  dispatch: (event: GameEvent) => void,
): boolean {
  if (livesState.currentLives < livesState.maxLives) {
    livesState.currentLives++;
    dispatch({ type: "bonus_life", newTotal: livesState.currentLives });
    return true;
  }
  return false;
}

// ============================================
// Collision Event Handler
// ============================================

/**
 * Create collision handler for crash detection
 * Should be attached to Matter.Events.on(engine, 'collisionStart', handler)
 */
export function createCrashCollisionHandler(
  livesState: LivesState,
  checkpointState: CheckpointState,
  config: LivesConfig,
  dispatch: (event: GameEvent) => void,
): (event: Matter.IEventCollision<Matter.Engine>) => void {
  return (event: Matter.IEventCollision<Matter.Engine>) => {
    // Skip if already crashed or invincible
    if (livesState.isCrashed || livesState.isInvincible) {
      return;
    }

    // Check for impact crash
    if (detectImpactCrash(event, config, livesState.isInvincible)) {
      const cartBody = event.pairs[0].bodyA.label?.startsWith("cart_")
        ? event.pairs[0].bodyA
        : event.pairs[0].bodyB;

      triggerCrash(
        livesState,
        checkpointState,
        cartBody.position,
        "impact",
        Date.now(),
        dispatch,
      );
      return;
    }

    // Check for hazard crash
    if (detectHazardCrash(event, config, livesState.isInvincible)) {
      const cartBody = event.pairs[0].bodyA.label?.startsWith("cart_")
        ? event.pairs[0].bodyA
        : event.pairs[0].bodyB;

      triggerCrash(
        livesState,
        checkpointState,
        cartBody.position,
        "hazard",
        Date.now(),
        dispatch,
      );
    }
  };
}

// ============================================
// Lives Display Data
// ============================================

export interface LivesDisplayData {
  currentLives: number;
  maxLives: number;
  isInvincible: boolean;
  invincibilityProgress: number; // 0-1, how much invincibility time remains
  respawnFadeOpacity: number;
  isRespawning: boolean;
  deathCount: number;
}

/**
 * Get lives display data for UI
 */
export function getLivesDisplayData(
  livesState: LivesState,
  currentTime: number,
  config: LivesConfig = DEFAULT_LIVES_CONFIG,
): LivesDisplayData {
  let invincibilityProgress = 0;

  if (livesState.isInvincible) {
    const remaining = livesState.invincibilityEndTime - currentTime;
    invincibilityProgress = Math.max(
      0,
      Math.min(1, remaining / config.invincibilityDuration),
    );
  }

  return {
    currentLives: livesState.currentLives,
    maxLives: livesState.maxLives,
    isInvincible: livesState.isInvincible,
    invincibilityProgress,
    respawnFadeOpacity: livesState.respawnState.fadeOpacity,
    isRespawning: livesState.respawnState.isRespawning,
    deathCount: livesState.totalDeaths,
  };
}

// ============================================
// Reset Functions
// ============================================

/**
 * Reset lives state for new game
 */
export function resetLivesState(
  livesState: LivesState,
  config: LivesConfig = DEFAULT_LIVES_CONFIG,
): void {
  livesState.currentLives = config.startingLives;
  livesState.totalDeaths = 0;
  livesState.deathPositions = [];
  livesState.scoreForNextLife = config.extraLifePoints;
  livesState.extraLivesEarned = 0;
  livesState.isCrashed = false;
  livesState.crashTime = 0;
  livesState.crashReason = null;
  livesState.isInvincible = false;
  livesState.invincibilityEndTime = 0;
  livesState.isFlipped = false;
  livesState.flipStartTime = 0;
  livesState.respawnState = {
    isRespawning: false,
    phase: "none",
    progress: 0,
    fadeOpacity: 1,
  };
}

/**
 * Continue from checkpoint (for "continue" feature after game over)
 */
export function continueFromCheckpoint(
  livesState: LivesState,
  checkpointState: CheckpointState,
  cartComposite: Matter.Composite,
  config: LivesConfig = DEFAULT_LIVES_CONFIG,
): void {
  // Reset lives but keep death count
  livesState.currentLives = config.startingLives;
  livesState.isCrashed = false;
  livesState.crashTime = 0;
  livesState.crashReason = null;
  livesState.isInvincible = false;
  livesState.invincibilityEndTime = 0;
  livesState.isFlipped = false;
  livesState.flipStartTime = 0;
  livesState.respawnState = {
    isRespawning: false,
    phase: "none",
    progress: 0,
    fadeOpacity: 1,
  };

  // Respawn at last checkpoint
  respawnAtCheckpoint(cartComposite, checkpointState);
}
