/**
 * AudioSystem - Phase 7
 * Manages sound effects and music for Cart Course
 */

// ============================================
// Audio Configuration
// ============================================

export interface AudioConfig {
  /** Master volume (0-1) */
  masterVolume: number;
  /** Sound effects volume (0-1) */
  sfxVolume: number;
  /** Music volume (0-1) */
  musicVolume: number;
  /** Enable audio globally */
  enabled: boolean;
  /** Enable haptic feedback */
  hapticsEnabled: boolean;
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  masterVolume: 1.0,
  sfxVolume: 0.8,
  musicVolume: 0.6,
  enabled: true,
  hapticsEnabled: true,
};

// ============================================
// Sound Effect Definitions
// ============================================

export interface SoundEffectDef {
  id: string;
  file: string;
  volume: number;
  loop: boolean;
  pitchVariation: boolean;
  pitchRange?: { min: number; max: number };
  maxInstances?: number;
  cooldownMs?: number;
}

export const SOUND_EFFECTS: Record<string, SoundEffectDef> = {
  // Cart sounds
  cartRoll: {
    id: "cartRoll",
    file: "cart_roll.mp3",
    volume: 0.3,
    loop: true,
    pitchVariation: true,
    pitchRange: { min: 0.8, max: 1.2 },
  },
  cartBounce: {
    id: "cartBounce",
    file: "cart_bounce.mp3",
    volume: 0.5,
    loop: false,
    pitchVariation: true,
    pitchRange: { min: 0.9, max: 1.1 },
    cooldownMs: 100,
  },
  cartCrash: {
    id: "cartCrash",
    file: "cart_crash.mp3",
    volume: 0.8,
    loop: false,
    pitchVariation: false,
  },
  cartLand: {
    id: "cartLand",
    file: "cart_land.mp3",
    volume: 0.4,
    loop: false,
    pitchVariation: true,
    pitchRange: { min: 0.9, max: 1.1 },
    cooldownMs: 150,
  },

  // Mechanism sounds
  gearRotate: {
    id: "gearRotate",
    file: "gear_rotate.mp3",
    volume: 0.4,
    loop: true,
    pitchVariation: false,
  },
  platformMove: {
    id: "platformMove",
    file: "platform_move.mp3",
    volume: 0.3,
    loop: true,
    pitchVariation: false,
  },
  launcherCharge: {
    id: "launcherCharge",
    file: "launcher_charge.mp3",
    volume: 0.5,
    loop: false,
    pitchVariation: false,
  },
  launcherFire: {
    id: "launcherFire",
    file: "launcher_fire.mp3",
    volume: 0.7,
    loop: false,
    pitchVariation: false,
  },
  fanBlow: {
    id: "fanBlow",
    file: "fan_blow.mp3",
    volume: 0.4,
    loop: true,
    pitchVariation: false,
  },
  conveyorHum: {
    id: "conveyorHum",
    file: "conveyor_hum.mp3",
    volume: 0.25,
    loop: true,
    pitchVariation: false,
  },

  // Collectible sounds
  bananaCollect: {
    id: "bananaCollect",
    file: "banana.mp3",
    volume: 0.5,
    loop: false,
    pitchVariation: true,
    pitchRange: { min: 0.9, max: 1.3 },
    cooldownMs: 50,
  },
  coinCollect: {
    id: "coinCollect",
    file: "coin.mp3",
    volume: 0.6,
    loop: false,
    pitchVariation: true,
    pitchRange: { min: 0.95, max: 1.05 },
  },

  // Progress sounds
  checkpointReached: {
    id: "checkpointReached",
    file: "checkpoint.mp3",
    volume: 0.7,
    loop: false,
    pitchVariation: false,
  },
  areaComplete: {
    id: "areaComplete",
    file: "area_complete.mp3",
    volume: 0.8,
    loop: false,
    pitchVariation: false,
  },
  courseComplete: {
    id: "courseComplete",
    file: "course_complete.mp3",
    volume: 1.0,
    loop: false,
    pitchVariation: false,
  },
  extraLife: {
    id: "extraLife",
    file: "extra_life.mp3",
    volume: 0.8,
    loop: false,
    pitchVariation: false,
  },
  lifeLost: {
    id: "lifeLost",
    file: "life_lost.mp3",
    volume: 0.7,
    loop: false,
    pitchVariation: false,
  },

  // UI sounds
  menuSelect: {
    id: "menuSelect",
    file: "menu_select.mp3",
    volume: 0.4,
    loop: false,
    pitchVariation: false,
  },
  menuBack: {
    id: "menuBack",
    file: "menu_back.mp3",
    volume: 0.4,
    loop: false,
    pitchVariation: false,
  },
  pause: {
    id: "pause",
    file: "pause.mp3",
    volume: 0.5,
    loop: false,
    pitchVariation: false,
  },
  countdown: {
    id: "countdown",
    file: "countdown.mp3",
    volume: 0.6,
    loop: false,
    pitchVariation: false,
  },
  countdownGo: {
    id: "countdownGo",
    file: "countdown_go.mp3",
    volume: 0.8,
    loop: false,
    pitchVariation: false,
  },

  // Warning sounds
  timeWarning: {
    id: "timeWarning",
    file: "time_warning.mp3",
    volume: 0.5,
    loop: false,
    pitchVariation: false,
    cooldownMs: 1000,
  },
  timeCritical: {
    id: "timeCritical",
    file: "time_critical.mp3",
    volume: 0.6,
    loop: true,
    pitchVariation: false,
  },

  // Surface-specific roll sounds
  rollNormal: {
    id: "rollNormal",
    file: "roll_normal.mp3",
    volume: 0.25,
    loop: true,
    pitchVariation: true,
    pitchRange: { min: 0.8, max: 1.2 },
  },
  rollIce: {
    id: "rollIce",
    file: "roll_ice.mp3",
    volume: 0.3,
    loop: true,
    pitchVariation: true,
    pitchRange: { min: 0.9, max: 1.1 },
  },
  rollSticky: {
    id: "rollSticky",
    file: "roll_sticky.mp3",
    volume: 0.35,
    loop: true,
    pitchVariation: true,
    pitchRange: { min: 0.85, max: 1.15 },
  },
  rollMetal: {
    id: "rollMetal",
    file: "roll_metal.mp3",
    volume: 0.3,
    loop: true,
    pitchVariation: true,
    pitchRange: { min: 0.9, max: 1.1 },
  },
  rollGravel: {
    id: "rollGravel",
    file: "roll_gravel.mp3",
    volume: 0.35,
    loop: true,
    pitchVariation: true,
    pitchRange: { min: 0.85, max: 1.15 },
  },
  bumperHit: {
    id: "bumperHit",
    file: "bumper_hit.mp3",
    volume: 0.6,
    loop: false,
    pitchVariation: true,
    pitchRange: { min: 0.9, max: 1.1 },
    cooldownMs: 100,
  },
};

// ============================================
// Music Track Definitions
// ============================================

export interface MusicTrackDef {
  id: string;
  file: string;
  volume: number;
  loop: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
}

export interface CourseMusicSet {
  main: MusicTrackDef;
  intense: MusicTrackDef;
  victory: MusicTrackDef;
}

export const MUSIC_TRACKS: Record<string, CourseMusicSet> = {
  course1: {
    main: {
      id: "course1_main",
      file: "course1_main.mp3",
      volume: 0.6,
      loop: true,
      fadeInDuration: 1000,
      fadeOutDuration: 500,
    },
    intense: {
      id: "course1_intense",
      file: "course1_intense.mp3",
      volume: 0.7,
      loop: true,
      fadeInDuration: 500,
      fadeOutDuration: 500,
    },
    victory: {
      id: "course1_victory",
      file: "course1_victory.mp3",
      volume: 0.8,
      loop: false,
      fadeInDuration: 0,
      fadeOutDuration: 2000,
    },
  },
  course2: {
    main: {
      id: "course2_main",
      file: "course2_main.mp3",
      volume: 0.6,
      loop: true,
      fadeInDuration: 1000,
      fadeOutDuration: 500,
    },
    intense: {
      id: "course2_intense",
      file: "course2_intense.mp3",
      volume: 0.7,
      loop: true,
      fadeInDuration: 500,
      fadeOutDuration: 500,
    },
    victory: {
      id: "course2_victory",
      file: "course2_victory.mp3",
      volume: 0.8,
      loop: false,
      fadeInDuration: 0,
      fadeOutDuration: 2000,
    },
  },
  course3: {
    main: {
      id: "course3_main",
      file: "course3_main.mp3",
      volume: 0.6,
      loop: true,
      fadeInDuration: 1000,
      fadeOutDuration: 500,
    },
    intense: {
      id: "course3_intense",
      file: "course3_intense.mp3",
      volume: 0.7,
      loop: true,
      fadeInDuration: 500,
      fadeOutDuration: 500,
    },
    victory: {
      id: "course3_victory",
      file: "course3_victory.mp3",
      volume: 0.8,
      loop: false,
      fadeInDuration: 0,
      fadeOutDuration: 2000,
    },
  },
  course4: {
    main: {
      id: "course4_main",
      file: "course4_main.mp3",
      volume: 0.6,
      loop: true,
      fadeInDuration: 1000,
      fadeOutDuration: 500,
    },
    intense: {
      id: "course4_intense",
      file: "course4_intense.mp3",
      volume: 0.7,
      loop: true,
      fadeInDuration: 500,
      fadeOutDuration: 500,
    },
    victory: {
      id: "course4_victory",
      file: "course4_victory.mp3",
      volume: 0.8,
      loop: false,
      fadeInDuration: 0,
      fadeOutDuration: 2000,
    },
  },
};

// ============================================
// Audio State
// ============================================

export interface SoundInstance {
  id: string;
  soundId: string;
  startTime: number;
  volume: number;
  pitch: number;
  isPlaying: boolean;
  isLooping: boolean;
}

export interface MusicState {
  currentTrack: string | null;
  targetTrack: string | null;
  volume: number;
  targetVolume: number;
  isPlaying: boolean;
  isFading: boolean;
  fadeStartTime: number;
  fadeDuration: number;
  musicSet: "main" | "intense" | "victory";
}

export interface AudioState {
  config: AudioConfig;
  activeSounds: Map<string, SoundInstance>;
  loopingSounds: Map<string, SoundInstance>;
  music: MusicState;
  lastPlayTimes: Map<string, number>;
  nextInstanceId: number;
  isMuted: boolean;
  isPaused: boolean;
}

// ============================================
// State Management
// ============================================

/**
 * Create initial audio state
 */
export function createAudioState(
  config: Partial<AudioConfig> = {},
): AudioState {
  return {
    config: { ...DEFAULT_AUDIO_CONFIG, ...config },
    activeSounds: new Map(),
    loopingSounds: new Map(),
    music: {
      currentTrack: null,
      targetTrack: null,
      volume: 0,
      targetVolume: 0.6,
      isPlaying: false,
      isFading: false,
      fadeStartTime: 0,
      fadeDuration: 1000,
      musicSet: "main",
    },
    lastPlayTimes: new Map(),
    nextInstanceId: 1,
    isMuted: false,
    isPaused: false,
  };
}

/**
 * Generate unique sound instance ID
 */
function generateInstanceId(state: AudioState): string {
  return `sound_${state.nextInstanceId++}`;
}

/**
 * Calculate effective volume for a sound
 */
export function calculateEffectiveVolume(
  state: AudioState,
  baseVolume: number,
  isMusic: boolean = false,
): number {
  if (state.isMuted || !state.config.enabled) {
    return 0;
  }

  const typeVolume = isMusic
    ? state.config.musicVolume
    : state.config.sfxVolume;

  return baseVolume * typeVolume * state.config.masterVolume;
}

/**
 * Get random pitch variation
 */
function getRandomPitch(def: SoundEffectDef): number {
  if (!def.pitchVariation || !def.pitchRange) {
    return 1.0;
  }
  const { min, max } = def.pitchRange;
  return min + Math.random() * (max - min);
}

// ============================================
// Sound Effect Playback
// ============================================

/**
 * Check if sound is on cooldown
 */
function isOnCooldown(
  state: AudioState,
  soundId: string,
  currentTime: number,
): boolean {
  const def = SOUND_EFFECTS[soundId];
  if (!def || !def.cooldownMs) {
    return false;
  }

  const lastPlayTime = state.lastPlayTimes.get(soundId) ?? 0;
  return currentTime - lastPlayTime < def.cooldownMs;
}

/**
 * Play a sound effect
 */
export function playSound(
  state: AudioState,
  soundId: string,
  currentTime: number = Date.now(),
): { state: AudioState; instanceId: string | null } {
  if (!state.config.enabled || state.isMuted || state.isPaused) {
    return { state, instanceId: null };
  }

  const def = SOUND_EFFECTS[soundId];
  if (!def) {
    console.warn(`Unknown sound effect: ${soundId}`);
    return { state, instanceId: null };
  }

  // Check cooldown
  if (isOnCooldown(state, soundId, currentTime)) {
    return { state, instanceId: null };
  }

  const instanceId = generateInstanceId(state);
  const pitch = getRandomPitch(def);
  const volume = calculateEffectiveVolume(state, def.volume, false);

  const instance: SoundInstance = {
    id: instanceId,
    soundId,
    startTime: currentTime,
    volume,
    pitch,
    isPlaying: true,
    isLooping: def.loop,
  };

  const newActiveSounds = new Map(state.activeSounds);
  const newLoopingSounds = new Map(state.loopingSounds);
  const newLastPlayTimes = new Map(state.lastPlayTimes);

  if (def.loop) {
    newLoopingSounds.set(soundId, instance);
  } else {
    newActiveSounds.set(instanceId, instance);
  }

  newLastPlayTimes.set(soundId, currentTime);

  return {
    state: {
      ...state,
      activeSounds: newActiveSounds,
      loopingSounds: newLoopingSounds,
      lastPlayTimes: newLastPlayTimes,
      nextInstanceId: state.nextInstanceId + 1,
    },
    instanceId,
  };
}

/**
 * Stop a looping sound
 */
export function stopLoopingSound(
  state: AudioState,
  soundId: string,
): AudioState {
  const newLoopingSounds = new Map(state.loopingSounds);
  const instance = newLoopingSounds.get(soundId);

  if (instance) {
    newLoopingSounds.delete(soundId);
  }

  return {
    ...state,
    loopingSounds: newLoopingSounds,
  };
}

/**
 * Stop all sounds
 */
export function stopAllSounds(state: AudioState): AudioState {
  return {
    ...state,
    activeSounds: new Map(),
    loopingSounds: new Map(),
  };
}

/**
 * Update looping sound volume based on a factor (e.g., cart speed)
 */
export function updateLoopingSoundVolume(
  state: AudioState,
  soundId: string,
  volumeFactor: number,
): AudioState {
  const instance = state.loopingSounds.get(soundId);
  if (!instance) {
    return state;
  }

  const def = SOUND_EFFECTS[soundId];
  if (!def) {
    return state;
  }

  const newVolume = calculateEffectiveVolume(
    state,
    def.volume * volumeFactor,
    false,
  );
  const newLoopingSounds = new Map(state.loopingSounds);
  newLoopingSounds.set(soundId, { ...instance, volume: newVolume });

  return {
    ...state,
    loopingSounds: newLoopingSounds,
  };
}

/**
 * Update looping sound pitch based on a factor (e.g., cart speed)
 */
export function updateLoopingSoundPitch(
  state: AudioState,
  soundId: string,
  pitch: number,
): AudioState {
  const instance = state.loopingSounds.get(soundId);
  if (!instance) {
    return state;
  }

  const newLoopingSounds = new Map(state.loopingSounds);
  newLoopingSounds.set(soundId, { ...instance, pitch });

  return {
    ...state,
    loopingSounds: newLoopingSounds,
  };
}

// ============================================
// Music Playback
// ============================================

/**
 * Start playing music for a course
 */
export function startMusic(
  state: AudioState,
  courseId: string,
  musicSet: "main" | "intense" | "victory" = "main",
  currentTime: number = Date.now(),
): AudioState {
  const tracks = MUSIC_TRACKS[courseId];
  if (!tracks) {
    console.warn(`No music tracks for course: ${courseId}`);
    return state;
  }

  const track = tracks[musicSet];
  if (!track) {
    return state;
  }

  const targetVolume = calculateEffectiveVolume(state, track.volume, true);

  return {
    ...state,
    music: {
      ...state.music,
      currentTrack: track.id,
      targetTrack: track.id,
      volume: 0,
      targetVolume,
      isPlaying: true,
      isFading: true,
      fadeStartTime: currentTime,
      fadeDuration: track.fadeInDuration,
      musicSet,
    },
  };
}

/**
 * Switch to different music set (e.g., main -> intense)
 */
export function switchMusicSet(
  state: AudioState,
  courseId: string,
  musicSet: "main" | "intense" | "victory",
  currentTime: number = Date.now(),
): AudioState {
  if (state.music.musicSet === musicSet) {
    return state;
  }

  const tracks = MUSIC_TRACKS[courseId];
  if (!tracks) {
    return state;
  }

  const track = tracks[musicSet];
  if (!track) {
    return state;
  }

  const targetVolume = calculateEffectiveVolume(state, track.volume, true);

  return {
    ...state,
    music: {
      ...state.music,
      targetTrack: track.id,
      targetVolume,
      isFading: true,
      fadeStartTime: currentTime,
      fadeDuration: track.fadeOutDuration + track.fadeInDuration,
      musicSet,
    },
  };
}

/**
 * Stop music with fade out
 */
export function stopMusic(
  state: AudioState,
  currentTime: number = Date.now(),
  fadeDuration: number = 1000,
): AudioState {
  if (!state.music.isPlaying) {
    return state;
  }

  return {
    ...state,
    music: {
      ...state.music,
      targetTrack: null,
      targetVolume: 0,
      isFading: true,
      fadeStartTime: currentTime,
      fadeDuration,
    },
  };
}

/**
 * Update music fading
 */
export function updateMusic(
  state: AudioState,
  currentTime: number,
): AudioState {
  if (!state.music.isFading) {
    return state;
  }

  const elapsed = currentTime - state.music.fadeStartTime;
  const progress = Math.min(1, elapsed / state.music.fadeDuration);

  if (progress >= 1) {
    // Fade complete
    const isNowPlaying = state.music.targetTrack !== null;

    return {
      ...state,
      music: {
        ...state.music,
        currentTrack: state.music.targetTrack,
        volume: state.music.targetVolume,
        isPlaying: isNowPlaying,
        isFading: false,
      },
    };
  }

  // Interpolate volume
  const startVolume = state.music.volume;
  const endVolume = state.music.targetVolume;
  const currentVolume = startVolume + (endVolume - startVolume) * progress;

  return {
    ...state,
    music: {
      ...state.music,
      volume: currentVolume,
    },
  };
}

// ============================================
// Audio State Control
// ============================================

/**
 * Mute/unmute all audio
 */
export function setMuted(state: AudioState, muted: boolean): AudioState {
  return {
    ...state,
    isMuted: muted,
  };
}

/**
 * Pause/resume all audio
 */
export function setPaused(state: AudioState, paused: boolean): AudioState {
  return {
    ...state,
    isPaused: paused,
  };
}

/**
 * Update audio configuration
 */
export function updateAudioConfig(
  state: AudioState,
  config: Partial<AudioConfig>,
): AudioState {
  return {
    ...state,
    config: { ...state.config, ...config },
  };
}

/**
 * Set master volume
 */
export function setMasterVolume(state: AudioState, volume: number): AudioState {
  return updateAudioConfig(state, {
    masterVolume: Math.max(0, Math.min(1, volume)),
  });
}

/**
 * Set SFX volume
 */
export function setSfxVolume(state: AudioState, volume: number): AudioState {
  return updateAudioConfig(state, {
    sfxVolume: Math.max(0, Math.min(1, volume)),
  });
}

/**
 * Set music volume
 */
export function setMusicVolume(state: AudioState, volume: number): AudioState {
  return updateAudioConfig(state, {
    musicVolume: Math.max(0, Math.min(1, volume)),
  });
}

// ============================================
// Update System
// ============================================

/**
 * Clean up finished sound instances
 */
export function cleanupFinishedSounds(
  state: AudioState,
  currentTime: number,
): AudioState {
  const newActiveSounds = new Map<string, SoundInstance>();

  state.activeSounds.forEach((instance, id) => {
    const def = SOUND_EFFECTS[instance.soundId];
    if (!def) return;

    // Estimate sound duration (or use a default)
    const estimatedDuration = 2000; // 2 seconds default
    const elapsed = currentTime - instance.startTime;

    if (elapsed < estimatedDuration || instance.isLooping) {
      newActiveSounds.set(id, instance);
    }
  });

  return {
    ...state,
    activeSounds: newActiveSounds,
  };
}

/**
 * Full audio system update
 */
export function updateAudioSystem(
  state: AudioState,
  currentTime: number,
): AudioState {
  let newState = state;

  // Update music fading
  newState = updateMusic(newState, currentTime);

  // Cleanup finished sounds
  newState = cleanupFinishedSounds(newState, currentTime);

  return newState;
}

// ============================================
// Haptic Feedback
// ============================================

export type HapticType =
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error";

export interface HapticEvent {
  type: HapticType;
  timestamp: number;
}

/**
 * Trigger haptic feedback event
 */
export function triggerHaptic(
  state: AudioState,
  type: HapticType,
): HapticEvent | null {
  if (!state.config.hapticsEnabled || !state.config.enabled) {
    return null;
  }

  return {
    type,
    timestamp: Date.now(),
  };
}

// ============================================
// Game Event Audio Helpers
// ============================================

/**
 * Play appropriate sound for cart landing
 */
export function playLandingSound(
  state: AudioState,
  impactForce: number,
  currentTime: number,
): AudioState {
  if (impactForce < 2) {
    return state;
  }

  const { state: newState } = playSound(state, "cartLand", currentTime);
  return newState;
}

/**
 * Play appropriate sound for crash
 */
export function playCrashSound(
  state: AudioState,
  currentTime: number,
): AudioState {
  const { state: newState } = playSound(state, "cartCrash", currentTime);
  return newState;
}

/**
 * Play collectible pickup sound
 */
export function playCollectSound(
  state: AudioState,
  isCoin: boolean,
  currentTime: number,
): AudioState {
  const soundId = isCoin ? "coinCollect" : "bananaCollect";
  const { state: newState } = playSound(state, soundId, currentTime);
  return newState;
}

/**
 * Play checkpoint reached sound
 */
export function playCheckpointSound(
  state: AudioState,
  currentTime: number,
): AudioState {
  const { state: newState } = playSound(
    state,
    "checkpointReached",
    currentTime,
  );
  return newState;
}

/**
 * Play extra life sound
 */
export function playExtraLifeSound(
  state: AudioState,
  currentTime: number,
): AudioState {
  const { state: newState } = playSound(state, "extraLife", currentTime);
  return newState;
}

/**
 * Update cart rolling sound based on velocity
 */
export function updateRollingSound(
  state: AudioState,
  velocity: number,
  isGrounded: boolean,
  surfaceType: string = "normal",
  currentTime: number,
): AudioState {
  const rollSoundId = `roll${surfaceType.charAt(0).toUpperCase() + surfaceType.slice(1)}`;
  const validRollSound = SOUND_EFFECTS[rollSoundId] ? rollSoundId : "cartRoll";

  if (!isGrounded || velocity < 0.5) {
    // Stop rolling sound
    return stopLoopingSound(state, validRollSound);
  }

  // Start or update rolling sound
  if (!state.loopingSounds.has(validRollSound)) {
    const { state: newState } = playSound(state, validRollSound, currentTime);
    return newState;
  }

  // Update volume and pitch based on velocity
  const volumeFactor = Math.min(1, velocity / 10);
  const pitch = 0.8 + (velocity / 20) * 0.4; // 0.8 to 1.2

  let newState = updateLoopingSoundVolume(state, validRollSound, volumeFactor);
  newState = updateLoopingSoundPitch(newState, validRollSound, pitch);

  return newState;
}
