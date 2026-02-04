/**
 * Cart Course Systems Index
 * Re-exports game systems for react-native-game-engine
 */

// Core physics and controls
export * from "./CameraSystem";
export * from "./CrashDetectionSystem";
export * from "./MechanismSystem";
export * from "./PhysicsSystem";
export * from "./TiltGravitySystem";

// Phase 6: Collectibles and Scoring
export * from "./CollectibleSystem";
export * from "./GameProgressSystem";
export * from "./ScoringSystem";
export * from "./TimerSystem";

// Phase 7: Polish & Effects
export * from "./AudioSystem";

// Re-export ParticleSystem - CameraSystem's triggerScreenShake takes precedence
// ParticleSystem's version is available as createScreenShake
export {
  // Constants and interfaces
  DEFAULT_PARTICLE_CONFIG,
  DEFAULT_SCREEN_SHAKE,
  EFFECT_PRESETS,
  clearParticles,
  createEmitter,
  createParticle,
  // Particle creation and management
  createParticleState,
  // Screen shake (renamed to avoid conflict with CameraSystem)
  triggerScreenShake as createScreenShake,
  getParticleCount,
  getParticlesForRendering,
  getScreenShakeOffset,
  removeEmitter,
  setEmitterActive,
  spawnCheckpointEffect,
  spawnCollectEffect,
  spawnCrashEffect,
  spawnDust,
  // Effect spawning
  spawnEffect,
  spawnSparks,
  updateEmitterPosition,
  // Particle updates
  updateParticles,
  updateScreenShake,
} from "./ParticleSystem";

export type {
  EffectPreset,
  Particle,
  ParticleConfig,
  ParticleEmitter,
  ParticleState,
  ParticleType,
  ScreenShakeState,
} from "./ParticleSystem";
