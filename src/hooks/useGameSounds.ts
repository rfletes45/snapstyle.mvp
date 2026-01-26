/**
 * useGameSounds Hook
 *
 * Provides sound effect management for all games.
 *
 * Note: This is a stub implementation. To enable sounds:
 * 1. Install expo-av: npx expo install expo-av
 * 2. Add sound files to assets/sounds/
 * 3. Uncomment and update the implementation below
 *
 * @see docs/GAMES_IMPLEMENTATION_PLAN.md
 */

import { useCallback, useState } from "react";

// =============================================================================
// Types
// =============================================================================

export type GameSoundType =
  // UI sounds
  | "button_tap"
  | "menu_select"

  // General game sounds
  | "move"
  | "capture"
  | "win"
  | "lose"
  | "draw"
  | "turn_change"
  | "timer_warning"

  // 2048 specific
  | "tile_slide"
  | "tile_merge"
  | "new_tile"

  // Snake specific
  | "eat_food"
  | "snake_crash"

  // Chess specific
  | "piece_move"
  | "piece_capture"
  | "check"
  | "checkmate"
  | "castling"

  // Card games
  | "card_deal"
  | "card_play"
  | "card_draw"
  | "shuffle";

export interface GameSoundsConfig {
  enabled: boolean;
  volume: number; // 0.0 to 1.0
}

// =============================================================================
// Sound Mapping (placeholder paths - replace with actual sound files)
// =============================================================================

// When expo-av is installed and sound files are added:
// const SOUND_FILES: Partial<Record<GameSoundType, any>> = {
//   button_tap: require('@/assets/sounds/tap.mp3'),
//   // ... etc
// };

// =============================================================================
// Hook (Stub Implementation)
// =============================================================================

/**
 * Game sounds hook - stub implementation.
 *
 * To enable actual sounds:
 * 1. Run: npx expo install expo-av
 * 2. Add sound files to assets/sounds/
 * 3. Implement the actual audio playback logic
 */
export function useGameSounds(
  config: GameSoundsConfig = { enabled: true, volume: 0.7 },
) {
  const [isMuted, setIsMuted] = useState(!config.enabled);
  const [volume, setVolumeState] = useState(config.volume);

  /**
   * Play a sound effect (stub - no-op until expo-av is installed)
   */
  const play = useCallback((_type: GameSoundType) => {
    // Stub implementation - sound playback requires expo-av
    // console.debug(`[Sound Stub] Would play: ${type}`);
  }, []);

  /**
   * Play a sound with custom volume (stub)
   */
  const playWithVolume = useCallback(
    (_type: GameSoundType, _volume: number) => {
      // Stub implementation
    },
    [],
  );

  /**
   * Toggle mute state
   */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  /**
   * Set volume level
   */
  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(Math.max(0, Math.min(1, newVolume)));
  }, []);

  /**
   * Preload commonly used sounds (stub)
   */
  const preloadSounds = useCallback((_types: GameSoundType[]) => {
    // Stub implementation
    return Promise.resolve();
  }, []);

  return {
    play,
    playWithVolume,
    toggleMute,
    setVolume,
    preloadSounds,
    isMuted,
    isReady: true, // Always ready since it's a stub
    volume,
  };
}

export default useGameSounds;
