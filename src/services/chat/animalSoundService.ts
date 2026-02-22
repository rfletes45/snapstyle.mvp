/**
 * Animal Sound Service
 *
 * Plays animal sounds for the animal theme system.
 * Generalizes the original quackService to support any animal.
 * Also fires haptic feedback for immediate tactile confirmation.
 *
 * Uses the `expo-audio` package (AudioPlayer API).
 *
 * @module services/chat/animalSoundService
 */

import type { AudioPlayer } from "expo-audio";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";

import {
  DEFAULT_ANIMAL_THEME_ID,
  getAnimalSound,
} from "@/cosmetics/animalAssets";
import { createLogger } from "@/utils/log";

const logger = createLogger("services/chat/animalSoundService");

/** Cached AudioPlayer instances keyed by animal ID — create once per animal */
const cachedPlayers: Map<string, AudioPlayer> = new Map();
let audioConfigured = false;

/**
 * Configure audio session so sounds play even when the
 * device ringer/silent switch is off (iOS) and mix with
 * other audio on Android.
 */
async function ensureAudioConfigured(): Promise<void> {
  if (audioConfigured) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      allowsRecording: false,
      interruptionMode: "duckOthers",
      shouldRouteThroughEarpiece: false,
    });
    audioConfigured = true;
  } catch (err) {
    logger.warn("[AnimalSound] Failed to configure audio mode:", err);
  }
}

/**
 * Play the sound for a given animal theme + fire haptic.
 * Falls back to duck if animalId is null/unknown.
 */
export async function playAnimalSound(
  animalId: string | null | undefined,
): Promise<void> {
  const resolvedId = animalId ?? DEFAULT_ANIMAL_THEME_ID;

  // Always fire haptic for immediate tactile feedback
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );

  try {
    await ensureAudioConfigured();

    const soundAsset = getAnimalSound(resolvedId);

    if (!cachedPlayers.has(resolvedId)) {
      logger.info(`[AnimalSound] Creating player for "${resolvedId}"…`);
      const player = createAudioPlayer(soundAsset);
      player.volume = 1.0;
      cachedPlayers.set(resolvedId, player);
      logger.info(`[AnimalSound] Player created for "${resolvedId}"`);
    }

    const player = cachedPlayers.get(resolvedId)!;
    await player.seekTo(0);
    player.play();
    logger.info(`[AnimalSound] Playing "${resolvedId}"!`);
  } catch (err) {
    logger.warn(`[AnimalSound] Playback failed for "${resolvedId}":`, err);
    // Remove cached player in case it got into a bad state
    const player = cachedPlayers.get(resolvedId);
    if (player) {
      try {
        player.remove();
      } catch {
        // ignore
      }
    }
    cachedPlayers.delete(resolvedId);
  }
}

/**
 * Clean up all cached players (call on unmount if desired).
 */
export async function unloadAllAnimalSounds(): Promise<void> {
  for (const [id, player] of cachedPlayers.entries()) {
    try {
      player.remove();
    } catch {
      // ignore
    }
    cachedPlayers.delete(id);
  }
}
