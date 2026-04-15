/**
 * CallSettingsService - Manages call preferences and settings
 * Handles storage, retrieval, and validation of call settings
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { AppState, AppStateStatus } from "react-native";

import { getAuthInstance, getFirestoreInstance } from "@/services/firebase";
import {
  AudioOutput,
  CallSettings,
  CallsAllowedFrom,
  CameraPosition,
  DEFAULT_CALL_SETTINGS,
  DNDSchedule,
  RingtoneOption,
} from "@/types/callSettings";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/callSettingsService");
// Lazy getters to avoid accessing Firebase before initialization
const getDb = () => getFirestoreInstance();
const getAuth = () => getAuthInstance();

// Storage keys
const SETTINGS_STORAGE_KEY = "@call_settings";
const DND_CHECK_INTERVAL = 60000; // 1 minute

// Logging
const logInfo = (msg: string, data?: any) =>
  logger.info(`[CallSettingsService] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  logger.error(`[CallSettingsService] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && logger.info(`[CallSettingsService] ${msg}`, data ?? "");

type SettingsChangeListener = (settings: CallSettings) => void;

class CallSettingsService {
  private static instance: CallSettingsService;
  private settings: CallSettings = { ...DEFAULT_CALL_SETTINGS };
  private isLoaded = false;
  private listeners: Set<SettingsChangeListener> = new Set();
  private dndCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isDNDActive = false;

  private constructor() {
    // Start DND monitoring
    this.startDNDMonitoring();
  }

  static getInstance(): CallSettingsService {
    if (!CallSettingsService.instance) {
      CallSettingsService.instance = new CallSettingsService();
    }
    return CallSettingsService.instance;
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<CallSettings> {
    if (this.isLoaded) {
      return this.settings;
    }

    try {
      // Try local storage first (faster)
      const localData = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      let localUpdatedAt = 0;
      if (localData) {
        const parsed = JSON.parse(localData);
        localUpdatedAt = parsed._lastUpdatedAt ?? 0;
        this.settings = { ...DEFAULT_CALL_SETTINGS, ...parsed };
      }

      // Then sync from Firestore if authenticated
      const userId = getAuth().currentUser?.uid;
      if (userId) {
        const docRef = doc(getDb(), "Users", userId, "Settings", "calls");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const cloudSettings = docSnap.data() as Partial<CallSettings> & {
            _lastUpdatedAt?: number;
          };
          const cloudUpdatedAt = cloudSettings._lastUpdatedAt ?? 0;

          // Only overwrite local with cloud if cloud is newer (or local has
          // no timestamp, meaning it was written before this fix)
          if (cloudUpdatedAt >= localUpdatedAt) {
            this.settings = { ...this.settings, ...cloudSettings };
          }

          // Sync the merged result back to local storage
          await AsyncStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify(this.settings),
          );
        }
      }

      this.isLoaded = true;
      logDebug("Settings loaded", this.settings);
      return this.settings;
    } catch (error) {
      logError("Error loading settings", error);
      return this.settings;
    }
  }

  /**
   * Get current settings (loads if not already loaded)
   */
  async getSettings(): Promise<CallSettings> {
    if (!this.isLoaded) {
      await this.loadSettings();
    }
    return { ...this.settings };
  }

  /**
   * Get settings synchronously (returns cached or defaults)
   */
  getSettingsSync(): CallSettings {
    return { ...this.settings };
  }

  // ============================================================================
  // Update Settings
  // ============================================================================

  /**
   * Update settings (partial update)
   */
  async updateSettings(updates: Partial<CallSettings>): Promise<void> {
    try {
      // Merge with existing settings
      this.settings = { ...this.settings, ...updates };

      // Save to local storage immediately (without timestamp — stamped after cloud sync)
      await AsyncStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(this.settings),
      );

      // Save to Firestore if authenticated — stamp _lastUpdatedAt only on success
      // so a failed write doesn't prevent cloud data from syncing on next load
      const userId = getAuth().currentUser?.uid;
      if (userId) {
        const now = Date.now();
        const withTimestamp = { ...this.settings, _lastUpdatedAt: now };
        const docRef = doc(getDb(), "Users", userId, "Settings", "calls");
        // Strip undefined values — Firestore rejects them
        const cleaned = JSON.parse(JSON.stringify(withTimestamp));
        await setDoc(docRef, cleaned, { merge: true });
        // Firestore succeeded — persist the timestamp locally too
        await AsyncStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(withTimestamp),
        );
      }

      // Notify listeners
      this.notifyListeners();

      logInfo("Settings updated", updates);
    } catch (error) {
      logError("Error updating settings", error);
      throw error;
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    try {
      this.settings = { ...DEFAULT_CALL_SETTINGS };

      // Save to local storage immediately (without timestamp)
      await AsyncStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(this.settings),
      );

      const userId = getAuth().currentUser?.uid;
      if (userId) {
        const now = Date.now();
        const withTimestamp = { ...this.settings, _lastUpdatedAt: now };
        const docRef = doc(getDb(), "Users", userId, "Settings", "calls");
        const cleaned = JSON.parse(JSON.stringify(withTimestamp));
        await setDoc(docRef, cleaned);
        // Firestore succeeded — persist timestamp locally
        await AsyncStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(withTimestamp),
        );
      }

      this.notifyListeners();
      logInfo("Settings reset to defaults");
    } catch (error) {
      logError("Error resetting settings", error);
      throw error;
    }
  }

  // ============================================================================
  // Individual Settings
  // ============================================================================

  // Camera settings
  async setDefaultCamera(position: CameraPosition): Promise<void> {
    await this.updateSettings({ defaultCamera: position });
  }

  async setMirrorFrontCamera(enabled: boolean): Promise<void> {
    await this.updateSettings({ mirrorFrontCamera: enabled });
  }

  async setAutoEnableVideo(enabled: boolean): Promise<void> {
    await this.updateSettings({ autoEnableVideo: enabled });
  }

  // Audio settings
  async setDefaultAudioOutput(output: AudioOutput): Promise<void> {
    await this.updateSettings({ defaultAudioOutput: output });
  }

  async setNoiseSuppression(enabled: boolean): Promise<void> {
    await this.updateSettings({ noiseSuppression: enabled });
  }

  async setEchoCancellation(enabled: boolean): Promise<void> {
    await this.updateSettings({ echoCancellation: enabled });
  }

  async setAutoGainControl(enabled: boolean): Promise<void> {
    await this.updateSettings({ autoGainControl: enabled });
  }

  // Ringtone settings
  async setRingtone(ringtone: RingtoneOption): Promise<void> {
    await this.updateSettings({ ringtone });
  }

  async setCustomRingtone(uri: string): Promise<void> {
    await this.updateSettings({ ringtone: "custom", customRingtoneUri: uri });
  }

  async setVibrationEnabled(enabled: boolean): Promise<void> {
    await this.updateSettings({ vibrationEnabled: enabled });
  }

  async setRingtoneVolume(volume: number): Promise<void> {
    const clampedVolume = Math.max(0, Math.min(100, volume));
    await this.updateSettings({ ringtoneVolume: clampedVolume });
  }

  // Do Not Disturb
  async setDNDSchedule(schedule: DNDSchedule): Promise<void> {
    await this.updateSettings({ dndSchedule: schedule });
    this.checkDNDStatus(); // Recheck DND status
  }

  async enableDND(enabled: boolean): Promise<void> {
    await this.updateSettings({
      dndSchedule: { ...this.settings.dndSchedule, enabled },
    });
    this.checkDNDStatus();
  }

  // Privacy settings
  async setAllowCallsFrom(value: CallsAllowedFrom): Promise<void> {
    await this.updateSettings({ allowCallsFrom: value });
  }

  async setShowCallPreview(enabled: boolean): Promise<void> {
    await this.updateSettings({ showCallPreview: enabled });
  }

  async setAnnounceCallerName(enabled: boolean): Promise<void> {
    await this.updateSettings({ announceCallerName: enabled });
  }

  // Quality settings
  async setPreferredVideoQuality(
    quality: CallSettings["preferredVideoQuality"],
  ): Promise<void> {
    await this.updateSettings({ preferredVideoQuality: quality });
  }

  async setDataSaverMode(enabled: boolean): Promise<void> {
    await this.updateSettings({ dataSaverMode: enabled });
  }

  async setWifiOnlyVideo(enabled: boolean): Promise<void> {
    await this.updateSettings({ wifiOnlyVideo: enabled });
  }

  // Accessibility
  async setFlashOnRing(enabled: boolean): Promise<void> {
    await this.updateSettings({ flashOnRing: enabled });
  }

  async setHapticFeedback(enabled: boolean): Promise<void> {
    await this.updateSettings({ hapticFeedback: enabled });
  }

  async setLargeCallControls(enabled: boolean): Promise<void> {
    await this.updateSettings({ largeCallControls: enabled });
  }

  // ============================================================================
  // Do Not Disturb Logic
  // ============================================================================

  /**
   * Check if DND is currently active
   */
  isDNDCurrentlyActive(): boolean {
    return this.isDNDActive;
  }

  /**
   * Check and update DND status
   */
  private checkDNDStatus(): void {
    const { dndSchedule } = this.settings;

    if (!dndSchedule.enabled) {
      this.isDNDActive = false;
      return;
    }

    const now = new Date();
    const currentDay = now.getDay();

    // Check if today is in the DND days
    if (!dndSchedule.daysOfWeek.includes(currentDay)) {
      this.isDNDActive = false;
      return;
    }

    // Get current time in minutes
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = dndSchedule.startHour * 60 + dndSchedule.startMinute;
    const endMinutes = dndSchedule.endHour * 60 + dndSchedule.endMinute;

    // Handle overnight DND (e.g., 22:00 to 07:00)
    if (startMinutes > endMinutes) {
      // DND spans midnight
      this.isDNDActive =
        currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      // Same-day DND
      this.isDNDActive =
        currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  }

  /**
   * Start monitoring DND status
   */
  private startDNDMonitoring(): void {
    // Check immediately
    this.checkDNDStatus();

    // Check periodically
    this.dndCheckInterval = setInterval(() => {
      this.checkDNDStatus();
    }, DND_CHECK_INTERVAL);

    // Also check when app becomes active
    AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        this.checkDNDStatus();
      }
    });
  }

  /**
   * Stop DND monitoring
   */
  stopDNDMonitoring(): void {
    if (this.dndCheckInterval) {
      clearInterval(this.dndCheckInterval);
      this.dndCheckInterval = null;
    }
  }

  // ============================================================================
  // Call Permission Checking
  // ============================================================================

  /**
   * Check if a call from a specific user should be allowed
   */
  async shouldAllowCall(
    callerId: string,
    isFriend: boolean = false,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check DND first
    if (this.isDNDCurrentlyActive()) {
      return { allowed: false, reason: "dnd" };
    }

    // Check allow calls from setting
    const { allowCallsFrom } = this.settings;

    if (allowCallsFrom === "nobody") {
      return { allowed: false, reason: "calls_disabled" };
    }

    if (allowCallsFrom === "friends_only" && !isFriend) {
      return { allowed: false, reason: "not_friends" };
    }

    return { allowed: true };
  }

  /**
   * Get call configuration based on current settings
   */
  getCallConfig(): {
    video: {
      startEnabled: boolean;
      preferredQuality: string;
      facingMode: string;
      mirror: boolean;
    };
    audio: {
      noiseSuppression: boolean;
      echoCancellation: boolean;
      autoGainControl: boolean;
      defaultOutput: AudioOutput;
    };
    notifications: {
      ringtone: RingtoneOption;
      vibration: boolean;
      volume: number;
    };
  } {
    return {
      video: {
        startEnabled: this.settings.autoEnableVideo,
        preferredQuality: this.settings.preferredVideoQuality,
        facingMode:
          this.settings.defaultCamera === "front" ? "user" : "environment",
        mirror: this.settings.mirrorFrontCamera,
      },
      audio: {
        noiseSuppression: this.settings.noiseSuppression,
        echoCancellation: this.settings.echoCancellation,
        autoGainControl: this.settings.autoGainControl,
        defaultOutput: this.settings.defaultAudioOutput,
      },
      notifications: {
        ringtone: this.settings.ringtone,
        vibration: this.settings.vibrationEnabled,
        volume: this.settings.ringtoneVolume,
      },
    };
  }

  // ============================================================================
  // Listeners
  // ============================================================================

  /**
   * Add a settings change listener
   */
  addListener(listener: SettingsChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of settings change
   */
  private notifyListeners(): void {
    const settings = { ...this.settings };
    this.listeners.forEach((listener) => {
      try {
        listener(settings);
      } catch (error) {
        logError("Error in settings listener", error);
      }
    });
  }

  // ============================================================================
  // Export/Import
  // ============================================================================

  /**
   * Export settings as JSON string
   */
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON string
   */
  async importSettings(jsonString: string): Promise<void> {
    try {
      const imported = JSON.parse(jsonString);
      // Validate and merge with defaults to ensure all fields exist
      const validated: CallSettings = {
        ...DEFAULT_CALL_SETTINGS,
        ...imported,
      };
      await this.updateSettings(validated);
    } catch (error) {
      logError("Error importing settings", error);
      throw new Error("Invalid settings format");
    }
  }
}

export const callSettingsService = CallSettingsService.getInstance();
