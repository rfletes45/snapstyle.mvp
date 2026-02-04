/**
 * ParticleSystem - Phase 7
 * Manages particle effects for dust, sparks, and visual feedback
 */

import { Vector2D } from "../types/cartCourse.types";

// ============================================
// Particle Configuration
// ============================================

export interface ParticleConfig {
  /** Maximum number of particles in the pool */
  maxParticles: number;
  /** Default particle lifetime in ms */
  defaultLifetime: number;
  /** Enable particle effects globally */
  enabled: boolean;
}

export const DEFAULT_PARTICLE_CONFIG: ParticleConfig = {
  maxParticles: 100,
  defaultLifetime: 500,
  enabled: true,
};

// ============================================
// Particle Types
// ============================================

export type ParticleType =
  | "dust"
  | "spark"
  | "trail"
  | "collect"
  | "crash"
  | "checkpoint"
  | "coin";

export interface Particle {
  id: string;
  type: ParticleType;
  position: Vector2D;
  velocity: Vector2D;
  acceleration: Vector2D;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  scaleDecay: number;
  alpha: number;
  alphaDecay: number;
  color: string;
  lifetime: number;
  maxLifetime: number;
  createdAt: number;
  isAlive: boolean;
}

export interface ParticleEmitter {
  id: string;
  type: ParticleType;
  position: Vector2D;
  rate: number; // particles per second
  spread: number; // angle spread in radians
  direction: number; // base direction in radians
  speed: { min: number; max: number };
  lifetime: { min: number; max: number };
  scale: { min: number; max: number };
  colors: string[];
  gravity: Vector2D;
  isActive: boolean;
  lastEmitTime: number;
}

// ============================================
// Particle State
// ============================================

export interface ParticleState {
  particles: Particle[];
  emitters: Map<string, ParticleEmitter>;
  nextId: number;
  config: ParticleConfig;
}

// ============================================
// Effect Presets
// ============================================

export interface EffectPreset {
  type: ParticleType;
  count: number;
  spread: number;
  speed: { min: number; max: number };
  lifetime: { min: number; max: number };
  scale: { min: number; max: number };
  colors: string[];
  gravity: Vector2D;
  alphaDecay: number;
  scaleDecay: number;
}

export const EFFECT_PRESETS: Record<string, EffectPreset> = {
  // Dust when landing or rolling
  dust: {
    type: "dust",
    count: 5,
    spread: Math.PI / 3,
    speed: { min: 20, max: 50 },
    lifetime: { min: 300, max: 500 },
    scale: { min: 2, max: 4 },
    colors: ["#8b7355", "#a0937d", "#b5a997"],
    gravity: { x: 0, y: -10 },
    alphaDecay: 0.003,
    scaleDecay: 0.002,
  },

  // Sparks on impact
  spark: {
    type: "spark",
    count: 8,
    spread: Math.PI,
    speed: { min: 80, max: 150 },
    lifetime: { min: 200, max: 400 },
    scale: { min: 1, max: 3 },
    colors: ["#ffeb3b", "#ff9800", "#ff5722", "#ffffff"],
    gravity: { x: 0, y: 50 },
    alphaDecay: 0.004,
    scaleDecay: 0.001,
  },

  // Trail behind cart
  trail: {
    type: "trail",
    count: 1,
    spread: Math.PI / 8,
    speed: { min: 0, max: 5 },
    lifetime: { min: 150, max: 250 },
    scale: { min: 3, max: 5 },
    colors: ["rgba(255, 255, 255, 0.3)", "rgba(255, 255, 255, 0.2)"],
    gravity: { x: 0, y: 0 },
    alphaDecay: 0.006,
    scaleDecay: 0.003,
  },

  // Collectible pickup (banana/coin)
  collect: {
    type: "collect",
    count: 12,
    spread: Math.PI * 2,
    speed: { min: 60, max: 120 },
    lifetime: { min: 300, max: 500 },
    scale: { min: 2, max: 5 },
    colors: ["#ffeb3b", "#ffc107", "#ff9800"],
    gravity: { x: 0, y: 20 },
    alphaDecay: 0.003,
    scaleDecay: 0.001,
  },

  // Coin collect sparkle
  coin: {
    type: "coin",
    count: 16,
    spread: Math.PI * 2,
    speed: { min: 80, max: 140 },
    lifetime: { min: 400, max: 600 },
    scale: { min: 2, max: 6 },
    colors: ["#ffd700", "#ffec8b", "#ffffff", "#ffc107"],
    gravity: { x: 0, y: -20 },
    alphaDecay: 0.002,
    scaleDecay: 0.001,
  },

  // Crash explosion
  crash: {
    type: "crash",
    count: 25,
    spread: Math.PI * 2,
    speed: { min: 100, max: 200 },
    lifetime: { min: 400, max: 700 },
    scale: { min: 3, max: 8 },
    colors: ["#ff6b6b", "#ff5252", "#ff1744", "#ffab91"],
    gravity: { x: 0, y: 80 },
    alphaDecay: 0.002,
    scaleDecay: 0.001,
  },

  // Checkpoint reached
  checkpoint: {
    type: "checkpoint",
    count: 20,
    spread: Math.PI * 2,
    speed: { min: 50, max: 100 },
    lifetime: { min: 500, max: 800 },
    scale: { min: 3, max: 6 },
    colors: ["#4caf50", "#8bc34a", "#cddc39", "#ffffff"],
    gravity: { x: 0, y: -30 },
    alphaDecay: 0.002,
    scaleDecay: 0.0005,
  },
};

// ============================================
// State Management
// ============================================

/**
 * Create initial particle state
 */
export function createParticleState(
  config: Partial<ParticleConfig> = {},
): ParticleState {
  return {
    particles: [],
    emitters: new Map(),
    nextId: 1,
    config: { ...DEFAULT_PARTICLE_CONFIG, ...config },
  };
}

/**
 * Generate unique particle ID
 */
function generateParticleId(state: ParticleState): string {
  return `particle_${state.nextId++}`;
}

/**
 * Random number between min and max
 */
function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Pick random color from array
 */
function randomColor(colors: string[]): string {
  return colors[Math.floor(Math.random() * colors.length)];
}

// ============================================
// Particle Creation
// ============================================

/**
 * Create a single particle
 */
export function createParticle(
  state: ParticleState,
  type: ParticleType,
  position: Vector2D,
  direction: number,
  preset: EffectPreset,
  currentTime: number,
): Particle {
  const speed = randomRange(preset.speed.min, preset.speed.max);
  const angleOffset = (Math.random() - 0.5) * preset.spread;
  const finalDirection = direction + angleOffset;

  const lifetime = randomRange(preset.lifetime.min, preset.lifetime.max);

  return {
    id: generateParticleId(state),
    type,
    position: { ...position },
    velocity: {
      x: Math.cos(finalDirection) * speed,
      y: Math.sin(finalDirection) * speed,
    },
    acceleration: { ...preset.gravity },
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 5,
    scale: randomRange(preset.scale.min, preset.scale.max),
    scaleDecay: preset.scaleDecay,
    alpha: 1,
    alphaDecay: preset.alphaDecay,
    color: randomColor(preset.colors),
    lifetime: 0,
    maxLifetime: lifetime,
    createdAt: currentTime,
    isAlive: true,
  };
}

/**
 * Spawn particles using a preset effect
 */
export function spawnEffect(
  state: ParticleState,
  effectName: keyof typeof EFFECT_PRESETS,
  position: Vector2D,
  direction: number = -Math.PI / 2, // default: upward
  currentTime: number = Date.now(),
): ParticleState {
  if (!state.config.enabled) {
    return state;
  }

  const preset = EFFECT_PRESETS[effectName];
  if (!preset) {
    console.warn(`Unknown effect preset: ${effectName}`);
    return state;
  }

  const newParticles: Particle[] = [];
  const particleCount = Math.min(
    preset.count,
    state.config.maxParticles - state.particles.length,
  );

  for (let i = 0; i < particleCount; i++) {
    newParticles.push(
      createParticle(
        state,
        preset.type,
        position,
        direction,
        preset,
        currentTime,
      ),
    );
  }

  return {
    ...state,
    particles: [...state.particles, ...newParticles],
  };
}

/**
 * Spawn dust effect (for landing/rolling)
 */
export function spawnDust(
  state: ParticleState,
  position: Vector2D,
  velocity: Vector2D,
  currentTime: number = Date.now(),
): ParticleState {
  // Direction opposite to movement
  const direction = Math.atan2(-velocity.y, -velocity.x);
  return spawnEffect(state, "dust", position, direction, currentTime);
}

/**
 * Spawn spark effect (for impacts)
 */
export function spawnSparks(
  state: ParticleState,
  position: Vector2D,
  impactNormal: Vector2D,
  currentTime: number = Date.now(),
): ParticleState {
  // Sparks fly away from impact
  const direction = Math.atan2(impactNormal.y, impactNormal.x);
  return spawnEffect(state, "spark", position, direction, currentTime);
}

/**
 * Spawn collect effect (for collectibles)
 */
export function spawnCollectEffect(
  state: ParticleState,
  position: Vector2D,
  isCoin: boolean = false,
  currentTime: number = Date.now(),
): ParticleState {
  const effectName = isCoin ? "coin" : "collect";
  return spawnEffect(state, effectName, position, -Math.PI / 2, currentTime);
}

/**
 * Spawn crash explosion
 */
export function spawnCrashEffect(
  state: ParticleState,
  position: Vector2D,
  currentTime: number = Date.now(),
): ParticleState {
  return spawnEffect(state, "crash", position, 0, currentTime);
}

/**
 * Spawn checkpoint reached effect
 */
export function spawnCheckpointEffect(
  state: ParticleState,
  position: Vector2D,
  currentTime: number = Date.now(),
): ParticleState {
  return spawnEffect(state, "checkpoint", position, -Math.PI / 2, currentTime);
}

// ============================================
// Emitter Management
// ============================================

/**
 * Create a continuous particle emitter
 */
export function createEmitter(
  state: ParticleState,
  id: string,
  type: ParticleType,
  position: Vector2D,
  config: Partial<ParticleEmitter> = {},
): ParticleState {
  const preset = EFFECT_PRESETS[type] || EFFECT_PRESETS.dust;

  const emitter: ParticleEmitter = {
    id,
    type,
    position: { ...position },
    rate: config.rate ?? 10,
    spread: config.spread ?? preset.spread,
    direction: config.direction ?? -Math.PI / 2,
    speed: config.speed ?? preset.speed,
    lifetime: config.lifetime ?? preset.lifetime,
    scale: config.scale ?? preset.scale,
    colors: config.colors ?? preset.colors,
    gravity: config.gravity ?? preset.gravity,
    isActive: config.isActive ?? true,
    lastEmitTime: 0,
  };

  const newEmitters = new Map(state.emitters);
  newEmitters.set(id, emitter);

  return {
    ...state,
    emitters: newEmitters,
  };
}

/**
 * Update emitter position
 */
export function updateEmitterPosition(
  state: ParticleState,
  id: string,
  position: Vector2D,
): ParticleState {
  const emitter = state.emitters.get(id);
  if (!emitter) return state;

  const newEmitters = new Map(state.emitters);
  newEmitters.set(id, { ...emitter, position: { ...position } });

  return {
    ...state,
    emitters: newEmitters,
  };
}

/**
 * Set emitter active state
 */
export function setEmitterActive(
  state: ParticleState,
  id: string,
  isActive: boolean,
): ParticleState {
  const emitter = state.emitters.get(id);
  if (!emitter) return state;

  const newEmitters = new Map(state.emitters);
  newEmitters.set(id, { ...emitter, isActive });

  return {
    ...state,
    emitters: newEmitters,
  };
}

/**
 * Remove an emitter
 */
export function removeEmitter(state: ParticleState, id: string): ParticleState {
  const newEmitters = new Map(state.emitters);
  newEmitters.delete(id);

  return {
    ...state,
    emitters: newEmitters,
  };
}

// ============================================
// Particle Update
// ============================================

/**
 * Update a single particle
 */
function updateParticle(particle: Particle, deltaTimeMs: number): Particle {
  const deltaSeconds = deltaTimeMs / 1000;

  // Update lifetime
  const newLifetime = particle.lifetime + deltaTimeMs;
  if (newLifetime >= particle.maxLifetime) {
    return { ...particle, isAlive: false };
  }

  // Update velocity with acceleration
  const newVelocity = {
    x: particle.velocity.x + particle.acceleration.x * deltaSeconds,
    y: particle.velocity.y + particle.acceleration.y * deltaSeconds,
  };

  // Update position
  const newPosition = {
    x: particle.position.x + newVelocity.x * deltaSeconds,
    y: particle.position.y + newVelocity.y * deltaSeconds,
  };

  // Update rotation
  const newRotation = particle.rotation + particle.rotationSpeed * deltaSeconds;

  // Decay alpha and scale
  const newAlpha = Math.max(
    0,
    particle.alpha - particle.alphaDecay * deltaTimeMs,
  );
  const newScale = Math.max(
    0,
    particle.scale - particle.scaleDecay * deltaTimeMs,
  );

  return {
    ...particle,
    position: newPosition,
    velocity: newVelocity,
    rotation: newRotation,
    alpha: newAlpha,
    scale: newScale,
    lifetime: newLifetime,
    isAlive: newAlpha > 0 && newScale > 0,
  };
}

/**
 * Process emitters and spawn new particles
 */
function processEmitters(
  state: ParticleState,
  currentTime: number,
  deltaTimeMs: number,
): Particle[] {
  const newParticles: Particle[] = [];

  state.emitters.forEach((emitter) => {
    if (!emitter.isActive) return;

    const timeSinceLastEmit = currentTime - emitter.lastEmitTime;
    const emitInterval = 1000 / emitter.rate;

    if (timeSinceLastEmit >= emitInterval) {
      // Create preset from emitter config
      const preset: EffectPreset = {
        type: emitter.type,
        count: 1,
        spread: emitter.spread,
        speed: emitter.speed,
        lifetime: emitter.lifetime,
        scale: emitter.scale,
        colors: emitter.colors,
        gravity: emitter.gravity,
        alphaDecay: 0.003,
        scaleDecay: 0.002,
      };

      const particle = createParticle(
        state,
        emitter.type,
        emitter.position,
        emitter.direction,
        preset,
        currentTime,
      );

      newParticles.push(particle);
      emitter.lastEmitTime = currentTime;
    }
  });

  return newParticles;
}

/**
 * Update all particles in the system
 */
export function updateParticles(
  state: ParticleState,
  currentTime: number,
  deltaTimeMs: number,
): ParticleState {
  if (!state.config.enabled) {
    return state;
  }

  // Update existing particles
  const updatedParticles = state.particles
    .map((p) => updateParticle(p, deltaTimeMs))
    .filter((p) => p.isAlive);

  // Process emitters for new particles
  const emitterParticles = processEmitters(state, currentTime, deltaTimeMs);

  // Combine and limit to max particles
  const allParticles = [...updatedParticles, ...emitterParticles].slice(
    0,
    state.config.maxParticles,
  );

  return {
    ...state,
    particles: allParticles,
  };
}

/**
 * Clear all particles
 */
export function clearParticles(state: ParticleState): ParticleState {
  return {
    ...state,
    particles: [],
  };
}

/**
 * Get particle count
 */
export function getParticleCount(state: ParticleState): number {
  return state.particles.length;
}

/**
 * Get particles for rendering
 */
export function getParticlesForRendering(state: ParticleState): Particle[] {
  return state.particles.filter((p) => p.isAlive && p.alpha > 0.01);
}

// ============================================
// Screen Shake Effect
// ============================================

export interface ScreenShakeState {
  intensity: number;
  duration: number;
  elapsed: number;
  decay: number;
  offsetX: number;
  offsetY: number;
  isActive: boolean;
}

export const DEFAULT_SCREEN_SHAKE: ScreenShakeState = {
  intensity: 0,
  duration: 0,
  elapsed: 0,
  decay: 0.9,
  offsetX: 0,
  offsetY: 0,
  isActive: false,
};

/**
 * Trigger screen shake effect
 */
export function triggerScreenShake(
  intensity: number = 10,
  duration: number = 300,
  decay: number = 0.9,
): ScreenShakeState {
  return {
    intensity,
    duration,
    elapsed: 0,
    decay,
    offsetX: 0,
    offsetY: 0,
    isActive: true,
  };
}

/**
 * Update screen shake
 */
export function updateScreenShake(
  state: ScreenShakeState,
  deltaTimeMs: number,
): ScreenShakeState {
  if (!state.isActive) {
    return state;
  }

  const newElapsed = state.elapsed + deltaTimeMs;
  if (newElapsed >= state.duration) {
    return {
      ...DEFAULT_SCREEN_SHAKE,
    };
  }

  // Calculate remaining intensity
  const progress = newElapsed / state.duration;
  const currentIntensity =
    state.intensity * Math.pow(state.decay, progress * 10);

  // Random offset
  const offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
  const offsetY = (Math.random() - 0.5) * 2 * currentIntensity;

  return {
    ...state,
    elapsed: newElapsed,
    offsetX,
    offsetY,
  };
}

/**
 * Get screen shake offset for camera
 */
export function getScreenShakeOffset(state: ScreenShakeState): Vector2D {
  if (!state.isActive) {
    return { x: 0, y: 0 };
  }
  return { x: state.offsetX, y: state.offsetY };
}
