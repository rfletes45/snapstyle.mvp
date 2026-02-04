/**
 * RingtoneService - Manages ringtone playback for incoming calls
 * Handles playing, stopping, and vibration patterns
 */

// Note: expo-av is optional - handles case where it's not installed
import { Platform, Vibration } from "react-native";

// Conditional import for expo-av
let Audio: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Audio = require("expo-av").Audio;
} catch {
  Audio = {
    Sound: {
      createAsync: async () => ({ sound: null }),
    },
    setAudioModeAsync: async () => {},
  };
}

// Logging helpers
const logInfo = (msg: string, data?: any) =>
  console.log(`[RingtoneService] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  console.error(`[RingtoneService] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && console.log(`[RingtoneService] ${msg}`, data ?? "");

// Vibration patterns (in milliseconds)
const VIBRATION_PATTERNS = {
  incoming:
    Platform.OS === "android"
      ? [0, 500, 200, 500, 200, 500, 1000] // wait, vibrate, wait, vibrate, wait, vibrate, pause
      : [500, 200, 500, 200, 500], // iOS: vibrate, wait, vibrate, wait, vibrate
  ringing: Platform.OS === "android" ? [0, 1000, 2000] : [1000],
  hangup: Platform.OS === "android" ? [0, 200, 100, 200] : [200, 100, 200],
};

export type RingtoneType = "incoming" | "outgoing" | "hangup" | "busy";

class RingtoneService {
  private static instance: RingtoneService;
  private sound: any | null = null;
  private isPlaying: boolean = false;
  private vibrationInterval: ReturnType<typeof setInterval> | null = null;
  private currentRingtoneType: RingtoneType | null = null;

  private constructor() {}

  static getInstance(): RingtoneService {
    if (!RingtoneService.instance) {
      RingtoneService.instance = new RingtoneService();
    }
    return RingtoneService.instance;
  }

  // ============================================================================
  // Audio Configuration
  // ============================================================================

  /**
   * Configure audio session for ringtone playback
   */
  private async configureAudio(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      logError("Failed to configure audio", error);
    }
  }

  // ============================================================================
  // Ringtone Playback
  // ============================================================================

  /**
   * Play ringtone for incoming call
   */
  async playIncomingRingtone(): Promise<void> {
    if (this.isPlaying) {
      logDebug("Ringtone already playing");
      return;
    }

    logInfo("Playing incoming ringtone");
    this.currentRingtoneType = "incoming";

    try {
      await this.configureAudio();

      // Load the ringtone sound
      // Note: In production, you would have a custom ringtone file
      // For now, we'll use a placeholder that should be added to assets
      const { sound } = await Audio.Sound.createAsync(
        // You can use a custom ringtone file here
        // require('../../../assets/sounds/ringtone.mp3'),
        // For now, using a system-like approach with vibration
        { uri: "https://www.soundjay.com/phone/phone-calling-1.mp3" },
        {
          shouldPlay: true,
          isLooping: true,
          volume: 1.0,
        },
      );

      this.sound = sound;
      this.isPlaying = true;

      // Start vibration pattern
      this.startVibration("incoming");

      logDebug("Incoming ringtone started");
    } catch (error) {
      logError("Failed to play incoming ringtone", error);
      // Fallback to vibration only
      this.startVibration("incoming");
    }
  }

  /**
   * Play outgoing call ringing tone
   */
  async playOutgoingRingtone(): Promise<void> {
    if (this.isPlaying) {
      return;
    }

    logInfo("Playing outgoing ringtone");
    this.currentRingtoneType = "outgoing";

    try {
      await this.configureAudio();

      const { sound } = await Audio.Sound.createAsync(
        { uri: "https://www.soundjay.com/phone/phone-calling-2.mp3" },
        {
          shouldPlay: true,
          isLooping: true,
          volume: 0.5, // Lower volume for outgoing
        },
      );

      this.sound = sound;
      this.isPlaying = true;

      logDebug("Outgoing ringtone started");
    } catch (error) {
      logError("Failed to play outgoing ringtone", error);
    }
  }

  /**
   * Play hangup sound
   */
  async playHangupSound(): Promise<void> {
    logInfo("Playing hangup sound");

    try {
      await this.stopRingtone();

      const { sound } = await Audio.Sound.createAsync(
        { uri: "https://www.soundjay.com/phone/phone-disconnect-1.mp3" },
        {
          shouldPlay: true,
          isLooping: false,
          volume: 0.5,
        },
      );

      // Play short vibration
      Vibration.vibrate(VIBRATION_PATTERNS.hangup);

      // Unload sound after playing
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      logError("Failed to play hangup sound", error);
      // Just vibrate
      Vibration.vibrate(VIBRATION_PATTERNS.hangup);
    }
  }

  /**
   * Play busy tone
   */
  async playBusyTone(): Promise<void> {
    logInfo("Playing busy tone");
    this.currentRingtoneType = "busy";

    try {
      await this.configureAudio();

      const { sound } = await Audio.Sound.createAsync(
        { uri: "https://www.soundjay.com/phone/phone-busy-1.mp3" },
        {
          shouldPlay: true,
          isLooping: false,
          volume: 0.5,
        },
      );

      this.sound = sound;

      // Stop after a few seconds
      setTimeout(() => {
        this.stopRingtone();
      }, 3000);
    } catch (error) {
      logError("Failed to play busy tone", error);
    }
  }

  // ============================================================================
  // Vibration
  // ============================================================================

  /**
   * Start vibration pattern
   */
  private startVibration(pattern: keyof typeof VIBRATION_PATTERNS): void {
    this.stopVibration();

    const vibrationPattern = VIBRATION_PATTERNS[pattern];

    // Initial vibration
    Vibration.vibrate(vibrationPattern, true);

    // Set up repeating pattern (Vibration.vibrate with repeat on Android only)
    if (Platform.OS === "ios") {
      // iOS needs manual repeat
      this.vibrationInterval = setInterval(() => {
        Vibration.vibrate(vibrationPattern);
      }, 3000); // Repeat every 3 seconds
    }
  }

  /**
   * Stop vibration
   */
  private stopVibration(): void {
    Vibration.cancel();
    if (this.vibrationInterval) {
      clearInterval(this.vibrationInterval);
      this.vibrationInterval = null;
    }
  }

  // ============================================================================
  // Stop & Cleanup
  // ============================================================================

  /**
   * Stop current ringtone
   */
  async stopRingtone(): Promise<void> {
    logInfo("Stopping ringtone");

    this.stopVibration();

    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      } catch (error) {
        logError("Error stopping sound", error);
      }
      this.sound = null;
    }

    this.isPlaying = false;
    this.currentRingtoneType = null;
  }

  /**
   * Pause ringtone (for when answering)
   */
  async pauseRingtone(): Promise<void> {
    this.stopVibration();

    if (this.sound) {
      try {
        await this.sound.pauseAsync();
      } catch (error) {
        logError("Error pausing sound", error);
      }
    }
  }

  /**
   * Check if ringtone is currently playing
   */
  isRingtonePlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current ringtone type
   */
  getCurrentRingtoneType(): RingtoneType | null {
    return this.currentRingtoneType;
  }

  // ============================================================================
  // Volume Control
  // ============================================================================

  /**
   * Set ringtone volume
   * @param volume - Volume level (0.0 to 1.0)
   */
  async setVolume(volume: number): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.setVolumeAsync(Math.max(0, Math.min(1, volume)));
      } catch (error) {
        logError("Error setting volume", error);
      }
    }
  }

  /**
   * Mute ringtone
   */
  async mute(): Promise<void> {
    await this.setVolume(0);
  }

  /**
   * Unmute ringtone
   */
  async unmute(): Promise<void> {
    await this.setVolume(1);
  }
}

export const ringtoneService = RingtoneService.getInstance();
