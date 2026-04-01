/**
 * Ringtone Service
 *
 * Manages in-app ringtone and vibration playback for incoming/outgoing calls.
 * Uses expo-audio (already installed) for sound playback.
 *
 * This handles the FOREGROUND ringing experience. Background/terminated
 * ringing is handled by the native push notification system (CallKit on
 * iOS, Notifee on Android) configured in setPushConfig.
 *
 * Sound assets:
 *   - assets/sounds/incoming_call.mp3  — played for incoming calls
 *   - assets/sounds/outgoing_call.mp3  — played for outgoing calls
 *   - assets/sounds/room_join.mp3      — played when someone joins a voice room
 *
 * If a sound file is missing, playback silently fails without crashing.
 */

import { Vibration } from "react-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RingtoneType = "incoming" | "outgoing" | "room_join";

// ---------------------------------------------------------------------------
// Lazy module loading — expo-audio may not be available in all environments
// ---------------------------------------------------------------------------

let createAudioPlayer: any = null;
let setAudioModeAsync: any = null;

try {
  const expoAudio = require("expo-audio");
  createAudioPlayer = expoAudio.createAudioPlayer;
  setAudioModeAsync = expoAudio.setAudioModeAsync;
} catch {
  // expo-audio not available — ringtone will be silent
}

// ---------------------------------------------------------------------------
// Sound asset mapping
// ---------------------------------------------------------------------------

const SOUND_SOURCES: Record<RingtoneType, any> = {
  incoming: require("@/../assets/sounds/incoming_call.mp3"),
  outgoing: require("@/../assets/sounds/outgoing_call.mp3"),
  room_join: require("@/../assets/sounds/room_join.mp3"),
};

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let activePlayer: any = null;
let activeType: RingtoneType | null = null;
let vibrationInterval: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start playing a ringtone with optional vibration.
 * Calling this while a ringtone is already playing will stop the previous one.
 *
 * @param type     Which sound to play
 * @param vibrate  Whether to vibrate in a call-like pattern (default: true for incoming)
 * @param loop     Whether to loop the sound (default: true for incoming/outgoing)
 */
export async function startRingtone(
  type: RingtoneType,
  vibrate?: boolean,
  loop?: boolean,
): Promise<void> {
  // Stop any currently playing ringtone
  await stopRingtone();

  const shouldVibrate = vibrate ?? type === "incoming";
  const shouldLoop = loop ?? (type === "incoming" || type === "outgoing");

  // Configure audio session for playback alongside other audio
  if (setAudioModeAsync) {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
    } catch {
      // Non-fatal — audio mode may already be set by the call SDK
    }
  }

  // Create and start the audio player
  if (createAudioPlayer) {
    try {
      const source = SOUND_SOURCES[type];
      if (!source) {
        console.warn(`[RingtoneService] No sound source for type: ${type}`);
        return;
      }

      activePlayer = createAudioPlayer(source, {
        isLooping: shouldLoop,
      });
      activePlayer.play();
      activeType = type;
    } catch (err) {
      console.warn("[RingtoneService] Failed to play ringtone:", err);
      activePlayer = null;
      activeType = null;
    }
  }

  // Start vibration pattern
  if (shouldVibrate) {
    // Vibrate in a phone-like pattern: buzz-pause-buzz-pause
    const VIBRATE_PATTERN = [0, 800, 600, 800, 600];
    Vibration.vibrate(VIBRATE_PATTERN, true /* repeat */);
    // Track so we can cancel later
    vibrationInterval = setInterval(() => {
      // no-op — the repeating pattern handles itself via Vibration.vibrate
      // This interval is just a sentinel for stopRingtone to clear
    }, 10000);
  }
}

/**
 * Stop the currently playing ringtone and vibration.
 */
export async function stopRingtone(): Promise<void> {
  // Stop vibration
  Vibration.cancel();
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }

  // Stop audio
  if (activePlayer) {
    try {
      activePlayer.pause();
      activePlayer.release();
    } catch {
      // Player may already be released
    }
    activePlayer = null;
    activeType = null;
  }
}

/**
 * Play a one-shot sound effect (no looping, no vibration).
 * Used for join sounds and other brief audio cues.
 */
export async function playSoundEffect(type: RingtoneType): Promise<void> {
  if (!createAudioPlayer) return;

  try {
    const source = SOUND_SOURCES[type];
    if (!source) return;

    const player = createAudioPlayer(source, { isLooping: false });
    player.play();

    // Release the player after playback completes (approximate)
    setTimeout(() => {
      try {
        player.release();
      } catch {
        // Already released
      }
    }, 3000);
  } catch (err) {
    console.warn("[RingtoneService] Failed to play sound effect:", err);
  }
}

/**
 * Check if a ringtone is currently playing.
 */
export function isRingtonePlaying(): boolean {
  return activePlayer !== null;
}

/**
 * Get the type of the currently playing ringtone.
 */
export function getActiveRingtoneType(): RingtoneType | null {
  return activeType;
}
