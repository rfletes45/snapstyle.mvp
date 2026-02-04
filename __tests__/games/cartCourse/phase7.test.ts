/**
 * Phase 7 Tests: Polish & Effects
 *
 * Tests for:
 * - ParticleSystem (dust, sparks, trails, collection effects, screen shake)
 * - AudioSystem (sound effects, music, volume controls, haptics)
 *
 * Note: React component tests (ParticleRenderer, CollectibleRenderer, CartCourseHUD,
 * TiltCalibration, TutorialOverlay) require a full React Native environment and are
 * tested separately via integration/E2E tests.
 */

import {
  DEFAULT_PARTICLE_CONFIG,
  EFFECT_PRESETS,
  createEmitter,
  createParticleState,
  removeEmitter,
  setEmitterActive,
  spawnCheckpointEffect,
  spawnCollectEffect,
  spawnCrashEffect,
  spawnDust,
  spawnEffect,
  spawnSparks,
  updateEmitterPosition,
} from "../../../src/components/games/CartCourse/systems/ParticleSystem";

import {
  DEFAULT_AUDIO_CONFIG,
  MUSIC_TRACKS,
  SOUND_EFFECTS,
  calculateEffectiveVolume,
  createAudioState,
  playSound,
  setMuted,
  setPaused,
  startMusic,
  stopAllSounds,
  stopLoopingSound,
  stopMusic,
  switchMusicSet,
  updateLoopingSoundPitch,
  updateLoopingSoundVolume,
  updateMusic,
} from "../../../src/components/games/CartCourse/systems/AudioSystem";

// ============================================
// PARTICLE SYSTEM TESTS
// ============================================

describe("ParticleSystem", () => {
  // ------------------------------------------
  // Configuration
  // ------------------------------------------

  describe("Configuration", () => {
    it("should have default config with maxParticles of 100", () => {
      expect(DEFAULT_PARTICLE_CONFIG.maxParticles).toBe(100);
    });

    it("should have default config with enabled true", () => {
      expect(DEFAULT_PARTICLE_CONFIG.enabled).toBe(true);
    });
  });

  // ------------------------------------------
  // Effect Presets
  // ------------------------------------------

  describe("Effect Presets", () => {
    it("should have dust effect preset", () => {
      expect(EFFECT_PRESETS.dust).toBeDefined();
      expect(EFFECT_PRESETS.dust.type).toBe("dust");
      expect(EFFECT_PRESETS.dust.count).toBeGreaterThan(0);
    });

    it("should have spark effect preset", () => {
      expect(EFFECT_PRESETS.spark).toBeDefined();
      expect(EFFECT_PRESETS.spark.type).toBe("spark");
      expect(EFFECT_PRESETS.spark.count).toBeGreaterThan(0);
    });

    it("should have trail effect preset", () => {
      expect(EFFECT_PRESETS.trail).toBeDefined();
      expect(EFFECT_PRESETS.trail.type).toBe("trail");
    });

    it("should have collect effect preset", () => {
      expect(EFFECT_PRESETS.collect).toBeDefined();
      expect(EFFECT_PRESETS.collect.type).toBe("collect");
    });

    it("should have coin effect preset", () => {
      expect(EFFECT_PRESETS.coin).toBeDefined();
      expect(EFFECT_PRESETS.coin.type).toBe("coin");
    });

    it("should have crash effect preset with high count", () => {
      expect(EFFECT_PRESETS.crash).toBeDefined();
      expect(EFFECT_PRESETS.crash.type).toBe("crash");
      expect(EFFECT_PRESETS.crash.count).toBeGreaterThan(10);
    });

    it("should have checkpoint effect preset", () => {
      expect(EFFECT_PRESETS.checkpoint).toBeDefined();
      expect(EFFECT_PRESETS.checkpoint.type).toBe("checkpoint");
    });

    it("should have required properties in all presets", () => {
      Object.values(EFFECT_PRESETS).forEach((preset) => {
        expect(preset.type).toBeDefined();
        expect(preset.count).toBeDefined();
        expect(preset.spread).toBeDefined();
        expect(preset.speed).toBeDefined();
        expect(preset.lifetime).toBeDefined();
        expect(preset.scale).toBeDefined();
        expect(preset.colors).toBeDefined();
        expect(preset.gravity).toBeDefined();
      });
    });
  });

  // ------------------------------------------
  // State Management
  // ------------------------------------------

  describe("createParticleState", () => {
    it("should create particle state with default config", () => {
      const state = createParticleState();

      expect(state).toBeDefined();
      expect(state.particles).toEqual([]);
      expect(state.emitters).toBeInstanceOf(Map);
      expect(state.emitters.size).toBe(0);
      expect(state.config.maxParticles).toBe(100);
      expect(state.nextId).toBe(1);
    });

    it("should create particle state with custom config", () => {
      const state = createParticleState({ maxParticles: 50 });

      expect(state.config.maxParticles).toBe(50);
    });

    it("should merge custom config with defaults", () => {
      const state = createParticleState({ enabled: false });

      expect(state.config.enabled).toBe(false);
      expect(state.config.maxParticles).toBe(100);
    });
  });

  // ------------------------------------------
  // Particle Spawning
  // ------------------------------------------

  describe("spawnEffect", () => {
    it("should spawn particles for dust effect", () => {
      const state = createParticleState();
      const newState = spawnEffect(state, "dust", { x: 100, y: 200 });

      expect(newState.particles.length).toBeGreaterThan(0);
      expect(newState.particles[0].type).toBe("dust");
    });

    it("should spawn particles for spark effect", () => {
      const state = createParticleState();
      const newState = spawnEffect(state, "spark", { x: 100, y: 200 });

      expect(newState.particles.length).toBeGreaterThan(0);
      expect(newState.particles[0].type).toBe("spark");
    });

    it("should spawn particles for crash effect", () => {
      const state = createParticleState();
      const newState = spawnEffect(state, "crash", { x: 100, y: 200 });

      expect(newState.particles.length).toBeGreaterThan(0);
      expect(newState.particles[0].type).toBe("crash");
    });

    it("should not spawn particles when disabled", () => {
      const state = createParticleState({ enabled: false });
      const newState = spawnEffect(state, "dust", { x: 100, y: 200 });

      expect(newState.particles.length).toBe(0);
    });

    it("should respect max particle limit", () => {
      const state = createParticleState({ maxParticles: 3 });
      const newState = spawnEffect(state, "crash", { x: 100, y: 200 });

      // Crash spawns 25 particles but should be limited to 3
      expect(newState.particles.length).toBeLessThanOrEqual(3);
    });

    it("should increment nextId for each particle", () => {
      const state = createParticleState();
      const initialNextId = state.nextId;
      const newState = spawnEffect(state, "dust", { x: 100, y: 200 });

      // nextId should have increased by the number of particles spawned
      // Note: dust preset spawns 5 particles
      expect(newState.nextId).toBeGreaterThan(initialNextId);
    });
  });

  describe("spawnDust", () => {
    it("should spawn dust particles with velocity-based direction", () => {
      const state = createParticleState();
      const newState = spawnDust(state, { x: 100, y: 200 }, { x: 50, y: 0 });

      expect(newState.particles.length).toBeGreaterThan(0);
      expect(newState.particles[0].type).toBe("dust");
    });
  });

  describe("spawnSparks", () => {
    it("should spawn spark particles with impact normal", () => {
      const state = createParticleState();
      const newState = spawnSparks(state, { x: 100, y: 200 }, { x: 0, y: -1 });

      expect(newState.particles.length).toBeGreaterThan(0);
      expect(newState.particles[0].type).toBe("spark");
    });
  });

  describe("spawnCollectEffect", () => {
    it("should spawn collect effect particles for banana", () => {
      const state = createParticleState();
      const newState = spawnCollectEffect(state, { x: 100, y: 200 }, false);

      expect(newState.particles.length).toBeGreaterThan(0);
      expect(newState.particles[0].type).toBe("collect");
    });

    it("should spawn coin effect particles for coin", () => {
      const state = createParticleState();
      const newState = spawnCollectEffect(state, { x: 100, y: 200 }, true);

      expect(newState.particles.length).toBeGreaterThan(0);
      expect(newState.particles[0].type).toBe("coin");
    });
  });

  describe("spawnCrashEffect", () => {
    it("should spawn crash particles", () => {
      const state = createParticleState();
      const newState = spawnCrashEffect(state, { x: 100, y: 200 });

      expect(newState.particles.length).toBeGreaterThan(0);
      expect(newState.particles[0].type).toBe("crash");
    });
  });

  describe("spawnCheckpointEffect", () => {
    it("should spawn checkpoint particles", () => {
      const state = createParticleState();
      const newState = spawnCheckpointEffect(state, { x: 100, y: 200 });

      expect(newState.particles.length).toBeGreaterThan(0);
      expect(newState.particles[0].type).toBe("checkpoint");
    });
  });

  // ------------------------------------------
  // Emitter Management
  // ------------------------------------------

  describe("Emitter System", () => {
    it("should create an emitter", () => {
      const state = createParticleState();
      const newState = createEmitter(state, "cart_trail", "trail", {
        x: 100,
        y: 200,
      });

      expect(newState.emitters.get("cart_trail")).toBeDefined();
      expect(newState.emitters.get("cart_trail")?.type).toBe("trail");
    });

    it("should update emitter position", () => {
      let state = createParticleState();
      state = createEmitter(state, "cart_trail", "trail", { x: 0, y: 0 });
      state = updateEmitterPosition(state, "cart_trail", { x: 200, y: 300 });

      const emitter = state.emitters.get("cart_trail");
      expect(emitter?.position.x).toBe(200);
      expect(emitter?.position.y).toBe(300);
    });

    it("should set emitter active state", () => {
      let state = createParticleState();
      state = createEmitter(state, "cart_trail", "trail", { x: 0, y: 0 });

      expect(state.emitters.get("cart_trail")?.isActive).toBe(true);

      state = setEmitterActive(state, "cart_trail", false);
      expect(state.emitters.get("cart_trail")?.isActive).toBe(false);

      state = setEmitterActive(state, "cart_trail", true);
      expect(state.emitters.get("cart_trail")?.isActive).toBe(true);
    });

    it("should remove an emitter", () => {
      let state = createParticleState();
      state = createEmitter(state, "cart_trail", "trail", { x: 0, y: 0 });

      expect(state.emitters.has("cart_trail")).toBe(true);

      state = removeEmitter(state, "cart_trail");
      expect(state.emitters.has("cart_trail")).toBe(false);
    });

    it("should handle non-existent emitter gracefully", () => {
      const state = createParticleState();

      const updated1 = updateEmitterPosition(state, "nonexistent", {
        x: 0,
        y: 0,
      });
      const updated2 = setEmitterActive(state, "nonexistent", true);

      expect(updated1).toEqual(state);
      expect(updated2).toEqual(state);
    });
  });
});

// ============================================
// AUDIO SYSTEM TESTS
// ============================================

describe("AudioSystem", () => {
  // ------------------------------------------
  // Configuration
  // ------------------------------------------

  describe("Configuration", () => {
    it("should have default config with correct volumes", () => {
      expect(DEFAULT_AUDIO_CONFIG.masterVolume).toBe(1.0);
      expect(DEFAULT_AUDIO_CONFIG.sfxVolume).toBe(0.8);
      expect(DEFAULT_AUDIO_CONFIG.musicVolume).toBe(0.6);
    });

    it("should have default config with haptics enabled", () => {
      expect(DEFAULT_AUDIO_CONFIG.hapticsEnabled).toBe(true);
    });

    it("should have default config with audio enabled", () => {
      expect(DEFAULT_AUDIO_CONFIG.enabled).toBe(true);
    });
  });

  // ------------------------------------------
  // Sound Effect Definitions
  // ------------------------------------------

  describe("Sound Effect Definitions", () => {
    it("should have cart sound effects defined", () => {
      expect(SOUND_EFFECTS.cartRoll).toBeDefined();
      expect(SOUND_EFFECTS.cartBounce).toBeDefined();
      expect(SOUND_EFFECTS.cartCrash).toBeDefined();
      expect(SOUND_EFFECTS.cartLand).toBeDefined();
    });

    it("should have mechanism sound effects defined", () => {
      expect(SOUND_EFFECTS.gearRotate).toBeDefined();
      expect(SOUND_EFFECTS.platformMove).toBeDefined();
      expect(SOUND_EFFECTS.launcherCharge).toBeDefined();
      expect(SOUND_EFFECTS.launcherFire).toBeDefined();
      expect(SOUND_EFFECTS.fanBlow).toBeDefined();
      expect(SOUND_EFFECTS.conveyorHum).toBeDefined();
    });

    it("should have collectible sound effects defined", () => {
      expect(SOUND_EFFECTS.bananaCollect).toBeDefined();
      expect(SOUND_EFFECTS.coinCollect).toBeDefined();
    });

    it("should have progress sound effects defined", () => {
      expect(SOUND_EFFECTS.checkpointReached).toBeDefined();
      expect(SOUND_EFFECTS.areaComplete).toBeDefined();
      expect(SOUND_EFFECTS.courseComplete).toBeDefined();
    });

    it("should have UI sound effects defined", () => {
      expect(SOUND_EFFECTS.menuSelect).toBeDefined();
      expect(SOUND_EFFECTS.pause).toBeDefined();
    });

    it("should have required properties in sound effects", () => {
      const sfx = SOUND_EFFECTS.cartRoll;
      expect(sfx.id).toBeDefined();
      expect(sfx.file).toBeDefined();
      expect(sfx.volume).toBeDefined();
      expect(typeof sfx.loop).toBe("boolean");
    });
  });

  // ------------------------------------------
  // Music Definitions
  // ------------------------------------------

  describe("Music Definitions", () => {
    it("should have music tracks for all courses", () => {
      expect(MUSIC_TRACKS.course1).toBeDefined();
      expect(MUSIC_TRACKS.course2).toBeDefined();
      expect(MUSIC_TRACKS.course3).toBeDefined();
      expect(MUSIC_TRACKS.course4).toBeDefined();
    });

    it("should have main, intense, and victory sets for each course", () => {
      Object.values(MUSIC_TRACKS).forEach((course) => {
        expect(course.main).toBeDefined();
        expect(course.intense).toBeDefined();
        expect(course.victory).toBeDefined();
      });
    });

    it("should have fade durations in track definitions", () => {
      const track = MUSIC_TRACKS.course1.main;
      expect(typeof track.fadeInDuration).toBe("number");
      expect(typeof track.fadeOutDuration).toBe("number");
    });
  });

  // ------------------------------------------
  // State Management
  // ------------------------------------------

  describe("createAudioState", () => {
    it("should create audio state with default config", () => {
      const state = createAudioState();

      expect(state).toBeDefined();
      expect(state.config.masterVolume).toBe(1.0);
      expect(state.config.sfxVolume).toBe(0.8);
      expect(state.config.musicVolume).toBe(0.6);
    });

    it("should create audio state with custom config", () => {
      const state = createAudioState({
        masterVolume: 0.5,
        sfxVolume: 0.3,
      });

      expect(state.config.masterVolume).toBe(0.5);
      expect(state.config.sfxVolume).toBe(0.3);
      expect(state.config.musicVolume).toBe(0.6); // default
    });

    it("should initialize with no active sounds", () => {
      const state = createAudioState();

      expect(state.activeSounds.size).toBe(0);
      expect(state.loopingSounds.size).toBe(0);
    });

    it("should initialize with music state", () => {
      const state = createAudioState();

      expect(state.music).toBeDefined();
      expect(state.music.currentTrack).toBeNull();
      expect(state.music.isPlaying).toBe(false);
    });

    it("should initialize as not muted and not paused", () => {
      const state = createAudioState();

      expect(state.isMuted).toBe(false);
      expect(state.isPaused).toBe(false);
    });
  });

  // ------------------------------------------
  // Sound Playback
  // ------------------------------------------

  describe("playSound", () => {
    it("should add sound to active sounds", () => {
      const state = createAudioState();
      const result = playSound(state, "cartBounce", Date.now());

      expect(result.state.activeSounds.size).toBe(1);
      expect(result.instanceId).toBeTruthy();
    });

    it("should return null instanceId for invalid sound", () => {
      const state = createAudioState();
      const result = playSound(state, "invalidSound", Date.now());

      expect(result.instanceId).toBeNull();
    });

    it("should not play when muted", () => {
      let state = createAudioState();
      state = setMuted(state, true);

      const result = playSound(state, "cartBounce", Date.now());

      expect(result.instanceId).toBeNull();
    });

    it("should not play when paused", () => {
      let state = createAudioState();
      state = setPaused(state, true);

      const result = playSound(state, "cartBounce", Date.now());

      expect(result.instanceId).toBeNull();
    });

    it("should not play when disabled", () => {
      const state = createAudioState({ enabled: false });

      const result = playSound(state, "cartBounce", Date.now());

      expect(result.instanceId).toBeNull();
    });

    it("should respect cooldown period", () => {
      let state = createAudioState();
      const now = Date.now();

      // First play
      const result1 = playSound(state, "cartBounce", now);
      state = result1.state;

      // Immediate second play should be blocked
      const result2 = playSound(state, "cartBounce", now + 10);

      expect(result2.instanceId).toBeNull();
    });

    it("should allow sound after cooldown expires", () => {
      let state = createAudioState();
      const now = Date.now();

      // First play
      const result1 = playSound(state, "cartBounce", now);
      state = result1.state;

      // Play after cooldown expires (cooldown is 100ms)
      const result2 = playSound(state, "cartBounce", now + 150);

      expect(result2.instanceId).toBeTruthy();
    });

    it("should add looping sounds to loopingSounds map", () => {
      const state = createAudioState();
      const result = playSound(state, "cartRoll", Date.now());

      // cartRoll is a looping sound
      expect(result.state.loopingSounds.has("cartRoll")).toBe(true);
    });
  });

  // ------------------------------------------
  // Stop Sounds
  // ------------------------------------------

  describe("stopLoopingSound", () => {
    it("should remove looping sound from map", () => {
      let state = createAudioState();
      const result = playSound(state, "cartRoll", Date.now());
      state = result.state;

      expect(state.loopingSounds.has("cartRoll")).toBe(true);

      state = stopLoopingSound(state, "cartRoll");
      expect(state.loopingSounds.has("cartRoll")).toBe(false);
    });

    it("should handle non-existent sound gracefully", () => {
      const state = createAudioState();
      const newState = stopLoopingSound(state, "nonexistent");

      expect(newState.loopingSounds.size).toBe(0);
    });
  });

  describe("stopAllSounds", () => {
    it("should clear all active sounds", () => {
      let state = createAudioState();

      // Play some sounds
      const result1 = playSound(state, "cartBounce", Date.now());
      state = result1.state;
      const result2 = playSound(state, "cartRoll", Date.now());
      state = result2.state;

      expect(
        state.activeSounds.size + state.loopingSounds.size,
      ).toBeGreaterThan(0);

      state = stopAllSounds(state);

      expect(state.activeSounds.size).toBe(0);
      expect(state.loopingSounds.size).toBe(0);
    });
  });

  // ------------------------------------------
  // Looping Sound Adjustments
  // ------------------------------------------

  describe("updateLoopingSoundVolume", () => {
    it("should update volume of looping sound", () => {
      let state = createAudioState();
      const result = playSound(state, "cartRoll", Date.now());
      state = result.state;

      const originalVolume = state.loopingSounds.get("cartRoll")?.volume ?? 0;

      state = updateLoopingSoundVolume(state, "cartRoll", 0.5);
      const newVolume = state.loopingSounds.get("cartRoll")?.volume ?? 0;

      expect(newVolume).not.toBe(originalVolume);
    });

    it("should handle non-existent sound gracefully", () => {
      const state = createAudioState();
      const newState = updateLoopingSoundVolume(state, "nonexistent", 0.5);

      expect(newState).toEqual(state);
    });
  });

  describe("updateLoopingSoundPitch", () => {
    it("should update pitch of looping sound", () => {
      let state = createAudioState();
      const result = playSound(state, "cartRoll", Date.now());
      state = result.state;

      state = updateLoopingSoundPitch(state, "cartRoll", 1.5);
      const sound = state.loopingSounds.get("cartRoll");

      expect(sound?.pitch).toBe(1.5);
    });

    it("should handle non-existent sound gracefully", () => {
      const state = createAudioState();
      const newState = updateLoopingSoundPitch(state, "nonexistent", 1.5);

      expect(newState).toEqual(state);
    });
  });

  // ------------------------------------------
  // Music Control
  // ------------------------------------------

  describe("startMusic", () => {
    it("should set current music track", () => {
      const state = createAudioState();
      const newState = startMusic(state, "course1", "main");

      expect(newState.music.currentTrack).toBe("course1_main");
      expect(newState.music.isPlaying).toBe(true);
      expect(newState.music.musicSet).toBe("main");
    });

    it("should start with specified set", () => {
      const state = createAudioState();
      const newState = startMusic(state, "course2", "intense");

      expect(newState.music.currentTrack).toBe("course2_intense");
      expect(newState.music.musicSet).toBe("intense");
    });

    it("should handle invalid course gracefully", () => {
      const state = createAudioState();
      const newState = startMusic(state, "invalidCourse", "main");

      expect(newState).toEqual(state);
    });
  });

  describe("switchMusicSet", () => {
    it("should switch to different music set", () => {
      let state = createAudioState();
      state = startMusic(state, "course1", "main");
      state = switchMusicSet(state, "course1", "intense");

      expect(state.music.musicSet).toBe("intense");
      expect(state.music.targetTrack).toBe("course1_intense");
    });

    it("should not switch to same set", () => {
      let state = createAudioState();
      state = startMusic(state, "course1", "main");
      const stateBeforeSwitch = state;

      state = switchMusicSet(state, "course1", "main");

      expect(state).toEqual(stateBeforeSwitch);
    });

    it("should handle switch to victory set", () => {
      let state = createAudioState();
      state = startMusic(state, "course1", "main");
      state = switchMusicSet(state, "course1", "victory");

      expect(state.music.musicSet).toBe("victory");
    });
  });

  describe("stopMusic", () => {
    it("should start fade out when stopping music", () => {
      let state = createAudioState();
      state = startMusic(state, "course1", "main");
      state = stopMusic(state);

      expect(state.music.targetTrack).toBeNull();
      expect(state.music.targetVolume).toBe(0);
      expect(state.music.isFading).toBe(true);
    });

    it("should not affect non-playing music", () => {
      const state = createAudioState();
      const newState = stopMusic(state);

      expect(newState).toEqual(state);
    });
  });

  // ------------------------------------------
  // Audio State Control
  // ------------------------------------------

  describe("setMuted", () => {
    it("should set muted state", () => {
      const state = createAudioState();

      const mutedState = setMuted(state, true);
      expect(mutedState.isMuted).toBe(true);

      const unmutedState = setMuted(mutedState, false);
      expect(unmutedState.isMuted).toBe(false);
    });
  });

  describe("setPaused", () => {
    it("should set paused state", () => {
      const state = createAudioState();

      const pausedState = setPaused(state, true);
      expect(pausedState.isPaused).toBe(true);

      const resumedState = setPaused(pausedState, false);
      expect(resumedState.isPaused).toBe(false);
    });
  });

  // ------------------------------------------
  // Volume Calculations
  // ------------------------------------------

  describe("calculateEffectiveVolume", () => {
    it("should calculate effective SFX volume", () => {
      const state = createAudioState({
        masterVolume: 0.5,
        sfxVolume: 0.8,
      });

      const effectiveVolume = calculateEffectiveVolume(state, 1.0, false);
      expect(effectiveVolume).toBeCloseTo(0.4); // 0.5 * 0.8 * 1.0
    });

    it("should calculate effective music volume", () => {
      const state = createAudioState({
        masterVolume: 0.5,
        musicVolume: 0.6,
      });

      const effectiveVolume = calculateEffectiveVolume(state, 1.0, true);
      expect(effectiveVolume).toBeCloseTo(0.3); // 0.5 * 0.6 * 1.0
    });

    it("should return 0 when muted", () => {
      let state = createAudioState();
      state = setMuted(state, true);

      expect(calculateEffectiveVolume(state, 1.0, false)).toBe(0);
      expect(calculateEffectiveVolume(state, 1.0, true)).toBe(0);
    });

    it("should return 0 when disabled", () => {
      const state = createAudioState({ enabled: false });

      expect(calculateEffectiveVolume(state, 1.0, false)).toBe(0);
    });
  });
});

// ============================================
// MODULE EXPORTS TESTS
// ============================================

describe("Phase 7 Module Exports", () => {
  describe("ParticleSystem exports", () => {
    it("should export EFFECT_PRESETS with all effect types", () => {
      expect(EFFECT_PRESETS).toBeDefined();
      expect(Object.keys(EFFECT_PRESETS)).toContain("dust");
      expect(Object.keys(EFFECT_PRESETS)).toContain("spark");
      expect(Object.keys(EFFECT_PRESETS)).toContain("trail");
      expect(Object.keys(EFFECT_PRESETS)).toContain("collect");
      expect(Object.keys(EFFECT_PRESETS)).toContain("coin");
      expect(Object.keys(EFFECT_PRESETS)).toContain("crash");
      expect(Object.keys(EFFECT_PRESETS)).toContain("checkpoint");
    });

    it("should export all state functions", () => {
      expect(typeof createParticleState).toBe("function");
      expect(typeof spawnEffect).toBe("function");
    });

    it("should export all effect spawning functions", () => {
      expect(typeof spawnDust).toBe("function");
      expect(typeof spawnSparks).toBe("function");
      expect(typeof spawnCollectEffect).toBe("function");
      expect(typeof spawnCrashEffect).toBe("function");
      expect(typeof spawnCheckpointEffect).toBe("function");
    });

    it("should export all emitter functions", () => {
      expect(typeof createEmitter).toBe("function");
      expect(typeof updateEmitterPosition).toBe("function");
      expect(typeof setEmitterActive).toBe("function");
      expect(typeof removeEmitter).toBe("function");
    });
  });

  describe("AudioSystem exports", () => {
    it("should export configuration objects", () => {
      expect(SOUND_EFFECTS).toBeDefined();
      expect(MUSIC_TRACKS).toBeDefined();
      expect(DEFAULT_AUDIO_CONFIG).toBeDefined();
    });

    it("should export all state functions", () => {
      expect(typeof createAudioState).toBe("function");
      expect(typeof playSound).toBe("function");
      expect(typeof stopLoopingSound).toBe("function");
      expect(typeof stopAllSounds).toBe("function");
    });

    it("should export all looping sound functions", () => {
      expect(typeof updateLoopingSoundVolume).toBe("function");
      expect(typeof updateLoopingSoundPitch).toBe("function");
    });

    it("should export all music functions", () => {
      expect(typeof startMusic).toBe("function");
      expect(typeof switchMusicSet).toBe("function");
      expect(typeof stopMusic).toBe("function");
      expect(typeof updateMusic).toBe("function");
    });

    it("should export audio control functions", () => {
      expect(typeof setMuted).toBe("function");
      expect(typeof setPaused).toBe("function");
      expect(typeof calculateEffectiveVolume).toBe("function");
    });
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe("Phase 7 Integration", () => {
  describe("Particle + Audio Integration", () => {
    it("should handle crash effect with sound", () => {
      const particleState = createParticleState();
      const audioState = createAudioState();
      const now = Date.now();

      // Trigger crash effect
      const newParticleState = spawnCrashEffect(particleState, {
        x: 100,
        y: 200,
      });
      const { state: newAudioState } = playSound(audioState, "cartCrash", now);

      // Both should have been updated
      expect(newParticleState.particles.length).toBeGreaterThan(0);
      expect(newAudioState.activeSounds.size).toBe(1);
    });

    it("should handle checkpoint with effect and sound", () => {
      const particleState = createParticleState();
      const audioState = createAudioState();
      const now = Date.now();

      // Trigger checkpoint
      const newParticleState = spawnCheckpointEffect(particleState, {
        x: 100,
        y: 200,
      });
      const { state: newAudioState } = playSound(
        audioState,
        "checkpointReached",
        now,
      );

      expect(newParticleState.particles.length).toBeGreaterThan(0);
      expect(newAudioState.activeSounds.size).toBe(1);
    });

    it("should handle collectible with effect and sound", () => {
      const particleState = createParticleState();
      const audioState = createAudioState();
      const now = Date.now();

      // Collect banana
      const newParticleState = spawnCollectEffect(
        particleState,
        { x: 100, y: 200 },
        false,
      );
      const { state: newAudioState } = playSound(
        audioState,
        "bananaCollect",
        now,
      );

      expect(newParticleState.particles.length).toBeGreaterThan(0);
      expect(newAudioState.activeSounds.size).toBe(1);
    });
  });

  describe("Full Game Loop Simulation", () => {
    it("should handle a game session with multiple effects", () => {
      let particleState = createParticleState();
      let audioState = createAudioState();
      let now = 0;

      // Start game with music
      audioState = startMusic(audioState, "course1", "main");
      expect(audioState.music.isPlaying).toBe(true);

      // Cart starts moving - dust and roll sound
      particleState = spawnDust(
        particleState,
        { x: 50, y: 100 },
        { x: 10, y: 0 },
        now,
      );
      const rollResult = playSound(audioState, "cartRoll", now);
      audioState = rollResult.state;

      // Collect a banana
      now += 1000;
      particleState = spawnCollectEffect(
        particleState,
        { x: 200, y: 100 },
        false,
        now,
      );
      const bananaResult = playSound(audioState, "bananaCollect", now);
      audioState = bananaResult.state;

      expect(particleState.particles.length).toBeGreaterThan(0);

      // Hit checkpoint
      now += 2000;
      particleState = spawnCheckpointEffect(
        particleState,
        { x: 400, y: 100 },
        now,
      );
      const checkpointResult = playSound(audioState, "checkpointReached", now);
      audioState = checkpointResult.state;

      // Crash!
      now += 1000;
      particleState = spawnCrashEffect(particleState, { x: 500, y: 100 }, now);
      const crashResult = playSound(audioState, "cartCrash", now);
      audioState = crashResult.state;

      expect(particleState.particles.length).toBeGreaterThan(0);

      // Complete course - switch to victory music
      now += 5000;
      audioState = switchMusicSet(audioState, "course1", "victory");
      expect(audioState.music.musicSet).toBe("victory");

      // Stop everything
      audioState = stopMusic(audioState);
      audioState = stopAllSounds(audioState);

      expect(audioState.music.targetTrack).toBeNull();
      expect(audioState.activeSounds.size).toBe(0);
      expect(audioState.loopingSounds.size).toBe(0);
    });
  });
});
