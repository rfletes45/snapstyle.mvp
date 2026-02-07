/**
 * QUACK SERVICE
 * Plays the duck quack sound effect (assets/sounds/quack.mp3).
 * Also fires haptic feedback for immediate tactile confirmation.
 */

import * as Haptics from "expo-haptics";

let Audio: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Audio = require("expo-av").Audio;
} catch {
  Audio = null;
}

/**
 * IMPORTANT: require() for assets MUST be at module top-level
 * so Metro can statically resolve and bundle the file.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QUACK_ASSET = require("../../../assets/sounds/quack.mp3");

/** Cached sound object so we only load once */
let cachedQuackSound: any = null;
let audioConfigured = false;

/**
 * Configure audio session so sounds play even when the
 * device ringer/silent switch is off (iOS) and mix with
 * other audio on Android.
 */
async function ensureAudioConfigured(): Promise<void> {
  if (audioConfigured || !Audio?.setAudioModeAsync) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    audioConfigured = true;
  } catch (err) {
    console.warn("[Quack] Failed to configure audio mode:", err);
  }
}

/**
 * Play the quack sound + haptic.
 * Falls back gracefully if audio is unavailable.
 */
export async function playQuack(): Promise<void> {
  // Always fire haptic for immediate tactile feedback
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );

  if (!Audio?.Sound) {
    console.warn("[Quack] expo-av Audio not available");
    return;
  }

  try {
    // Ensure audio session is configured (one-time)
    await ensureAudioConfigured();

    if (!cachedQuackSound) {
      console.log("[Quack] Loading quack.mp3…");
      const { sound } = await Audio.Sound.createAsync(QUACK_ASSET, {
        shouldPlay: false,
        volume: 1.0,
      });
      cachedQuackSound = sound;
      console.log("[Quack] Sound loaded successfully");
    }

    // Rewind to start and play
    await cachedQuackSound.setPositionAsync(0);
    await cachedQuackSound.playAsync();
    console.log("[Quack] Playing quack!");
  } catch (err) {
    console.warn("[Quack] Playback failed:", err);
    // Reset cached sound in case it got into a bad state
    cachedQuackSound = null;
  }
}

/**
 * Clean up cached sound (call on unmount if desired)
 */
export async function unloadQuack(): Promise<void> {
  if (cachedQuackSound) {
    try {
      await cachedQuackSound.unloadAsync();
    } catch {}
    cachedQuackSound = null;
  }
}
