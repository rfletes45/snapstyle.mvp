/**
 * Blow Detector Engine (Phase 4)
 * Detects blowing into microphone using expo-audio
 * Provides alternative tap button for accessibility
 *
 * NOTE: expo-audio uses hook-based API (useAudioRecorder).
 * This class provides a tap-based fallback interface.
 * For microphone-based detection, use the useBlowDetection hook instead.
 */

import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";

// ============================================
// Configuration
// ============================================

export interface BlowDetectorConfig {
  threshold: number; // 0-1, volume level to consider "blowing"
  updateInterval: number; // ms between checks
  smoothingFactor: number; // 0-1, how much to smooth readings
  minBlowDuration: number; // ms, minimum duration to register blow
  debounceTime: number; // ms, prevent rapid on/off
}

const DEFAULT_CONFIG: BlowDetectorConfig = {
  threshold: 0.35, // 35% volume = blowing
  updateInterval: 50, // Check every 50ms
  smoothingFactor: 0.3, // Moderate smoothing
  minBlowDuration: 100, // 100ms minimum blow
  debounceTime: 50, // 50ms debounce
};

// ============================================
// Blow Detector Class
// ============================================

export class BlowDetector {
  private isInitialized: boolean = false;
  private isListening: boolean = false;
  private permissionGranted: boolean = false;
  private isPaused: boolean = false;

  // State
  private isBlowing: boolean = false;
  private isTapActive: boolean = false; // Alternative tap input
  private smoothedVolume: number = 0;
  private blowStartTime: number = 0;
  private lastChangeTime: number = 0;

  // Configuration
  private config: BlowDetectorConfig;

  // Callbacks
  private onBlowChange: ((isBlowing: boolean) => void) | null = null;
  private onVolumeChange: ((volume: number) => void) | null = null;

  constructor(config: Partial<BlowDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================
  // Initialization
  // ============================================

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Request microphone permission
      const { granted } = await requestRecordingPermissionsAsync();
      this.permissionGranted = granted;

      if (!this.permissionGranted) {
        console.warn("BlowDetector: Microphone permission denied");
        return false;
      }

      // Set audio mode for recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("BlowDetector: Failed to initialize", error);
      return false;
    }
  }

  // ============================================
  // Start Listening (Tap-based fallback)
  // ============================================

  async start(
    onBlowChange: (isBlowing: boolean) => void,
    onVolumeChange?: (volume: number) => void,
  ): Promise<boolean> {
    if (this.isListening) return true;

    this.onBlowChange = onBlowChange;
    this.onVolumeChange = onVolumeChange || null;

    // Initialize if needed
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Use tap-only mode (microphone requires hook-based API)
    // The useBlowDetection hook should be used for microphone support
    this.isListening = true;
    this.isPaused = false;
    return true;
  }

  // ============================================
  // Blow State Management
  // ============================================

  private updateBlowState(): void {
    if (this.isPaused) return;

    const now = Date.now();
    const isAboveThreshold =
      this.smoothedVolume > this.config.threshold || this.isTapActive;

    // Debounce rapid changes
    if (now - this.lastChangeTime < this.config.debounceTime) {
      return;
    }

    if (isAboveThreshold && !this.isBlowing) {
      // Start blowing
      this.blowStartTime = now;
      this.isBlowing = true;
      this.lastChangeTime = now;
      this.onBlowChange?.(true);
    } else if (!isAboveThreshold && this.isBlowing) {
      // Check minimum duration
      const duration = now - this.blowStartTime;
      if (duration >= this.config.minBlowDuration) {
        this.isBlowing = false;
        this.lastChangeTime = now;
        this.onBlowChange?.(false);
      }
    }
  }

  // ============================================
  // Alternative Tap Input
  // ============================================

  setTapState(isActive: boolean): void {
    if (this.isPaused) return;

    this.isTapActive = isActive;

    // Update blow state immediately for tap input
    const now = Date.now();

    if (isActive && !this.isBlowing) {
      this.isBlowing = true;
      this.blowStartTime = now;
      this.lastChangeTime = now;
      this.onBlowChange?.(true);
    } else if (!isActive && this.isBlowing && !this.isAboveThreshold()) {
      this.isBlowing = false;
      this.lastChangeTime = now;
      this.onBlowChange?.(false);
    }
  }

  // Alias for setTapState for easier use
  setTapActive(isActive: boolean): void {
    this.setTapState(isActive);
  }

  private isAboveThreshold(): boolean {
    return this.smoothedVolume > this.config.threshold;
  }

  // Method to update volume from external source (e.g., useBlowDetection hook)
  updateVolume(volume: number): void {
    if (this.isPaused) return;

    // Apply smoothing
    this.smoothedVolume =
      this.smoothedVolume * (1 - this.config.smoothingFactor) +
      volume * this.config.smoothingFactor;

    // Notify volume change
    this.onVolumeChange?.(this.smoothedVolume);

    // Check blow state
    this.updateBlowState();
  }

  // ============================================
  // Pause/Resume
  // ============================================

  pause(): void {
    this.isPaused = true;
    if (this.isBlowing) {
      this.isBlowing = false;
      this.onBlowChange?.(false);
    }
  }

  resume(): void {
    this.isPaused = false;
  }

  // ============================================
  // Stop Listening
  // ============================================

  async stop(): Promise<void> {
    this.isListening = false;
    this.isBlowing = false;
    this.isTapActive = false;
    this.smoothedVolume = 0;
    this.isPaused = false;
    this.onBlowChange = null;
    this.onVolumeChange = null;
  }

  // ============================================
  // Getters
  // ============================================

  getIsBlowing(): boolean {
    return this.isBlowing;
  }

  getVolume(): number {
    return this.smoothedVolume;
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  hasPermission(): boolean {
    return this.permissionGranted;
  }

  // ============================================
  // Configuration
  // ============================================

  setThreshold(threshold: number): void {
    this.config.threshold = Math.max(0, Math.min(1, threshold));
  }

  getThreshold(): number {
    return this.config.threshold;
  }
}

// ============================================
// Singleton Instance
// ============================================

let blowDetectorInstance: BlowDetector | null = null;

export function getBlowDetector(
  config?: Partial<BlowDetectorConfig>,
): BlowDetector {
  if (!blowDetectorInstance) {
    blowDetectorInstance = new BlowDetector(config);
  }
  return blowDetectorInstance;
}

export function resetBlowDetector(): void {
  if (blowDetectorInstance) {
    blowDetectorInstance.stop();
    blowDetectorInstance = null;
  }
}
