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

import { callSettingsService } from "@/services/calls";
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

function getNotificationPreferences() {
  const settings = callSettingsService.getSettingsSync();
  return {
    ringtone: settings.ringtone,
    customRingtoneUri: settings.customRingtoneUri,
    vibrationEnabled: settings.vibrationEnabled,
    volume: Math.max(0, Math.min(1, settings.ringtoneVolume / 100)),
  };
}

async function configurePlaybackAudioMode(): Promise<void> {
  if (!setAudioModeAsync) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: "mixWithOthers",
    });
  } catch {
    // Non-fatal — audio mode may already be controlled by the call SDK
  }
}

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

  const preferences = getNotificationPreferences();
  const shouldVibrate =
    (vibrate ?? type === "incoming") && preferences.vibrationEnabled;
  const shouldLoop = loop ?? (type === "incoming" || type === "outgoing");
  const shouldPlayTone =
    type === "room_join"
      ? true
      : preferences.ringtone !== "silent" &&
        preferences.ringtone !== "vibrate_only";
  const source =
    type !== "room_join" &&
    preferences.ringtone === "custom" &&
    preferences.customRingtoneUri
      ? preferences.customRingtoneUri
      : SOUND_SOURCES[type];

  // Configure audio session for playback alongside other audio.
  // Use 'mixWithOthers' so ringtone doesn't fight with the active call
  // audio session that callManager.start() may have already configured.
  await configurePlaybackAudioMode();

  // Create and start the audio player
  if (shouldPlayTone && createAudioPlayer) {
    try {
      if (!source) {
        console.warn(`[RingtoneService] No sound source for type: ${type}`);
        return;
      }

      activePlayer = createAudioPlayer(source, {
        keepAudioSessionActive: true,
      });
      activePlayer.loop = shouldLoop;
      activePlayer.volume = preferences.volume;
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
  }
}

/**
 * Stop the currently playing ringtone and vibration.
 */
export async function stopRingtone(): Promise<void> {
  // Stop vibration
  Vibration.cancel();

  // Stop audio
  if (activePlayer) {
    try {
      activePlayer.pause();
      activePlayer.remove();
    } catch {
      // Player may already be removed
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
    const { volume } = getNotificationPreferences();
    if (!source) return;

    await configurePlaybackAudioMode();

    const player = createAudioPlayer(source, {
      keepAudioSessionActive: true,
    });
    player.loop = false;
    player.volume = volume;
    player.play();

    // Remove the player after playback completes (approximate)
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        // Already removed
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
