/**
 * AudioSessionService - Manages audio routing and session for calls
 * Handles speaker/earpiece/bluetooth routing and background audio
 */

import { NativeEventEmitter, Platform } from "react-native";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/audioSessionService");
// Logging helpers
const logInfo = (msg: string, data?: any) =>
  logger.info(`[AudioSessionService] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  logger.error(`[AudioSessionService] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && logger.info(`[AudioSessionService] ${msg}`, data ?? "");

// Audio route types
export type AudioRoute =
  | "earpiece"
  | "speaker"
  | "bluetooth"
  | "headphones"
  | "wired";

export interface AudioDevice {
  id: string;
  name: string;
  type: AudioRoute;
  isActive: boolean;
}

// Audio session configuration
export interface AudioSessionConfig {
  /** Use speaker by default for video calls */
  speakerForVideo: boolean;
  /** Automatically handle bluetooth devices */
  autoHandleBluetooth: boolean;
  /** Keep audio active in background */
  backgroundAudio: boolean;
}

const DEFAULT_CONFIG: AudioSessionConfig = {
  speakerForVideo: true,
  autoHandleBluetooth: true,
  backgroundAudio: true,
};

class AudioSessionService {
  private static instance: AudioSessionService;
  private isActive: boolean = false;
  private currentRoute: AudioRoute = "earpiece";
  private availableDevices: AudioDevice[] = [];
  private config: AudioSessionConfig = DEFAULT_CONFIG;
  private eventEmitter: NativeEventEmitter | null = null;
  private routeChangeListeners: Set<(route: AudioRoute) => void> = new Set();
  private deviceChangeListeners: Set<(devices: AudioDevice[]) => void> =
    new Set();
  private currentCallId: string | null = null;

  private constructor() {}

  static getInstance(): AudioSessionService {
    if (!AudioSessionService.instance) {
      AudioSessionService.instance = new AudioSessionService();
    }
    return AudioSessionService.instance;
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the audio session for a call
   * @param isVideoCall - Whether this is a video call (affects default speaker setting)
   */
  async initialize(isVideoCall: boolean = false): Promise<void> {
    if (this.isActive) {
      logDebug("Audio session already active");
      return;
    }

    logInfo("Initializing audio session", { isVideoCall });

    try {
      if (Platform.OS === "ios") {
        await this.initializeIOS(isVideoCall);
      } else {
        await this.initializeAndroid(isVideoCall);
      }

      this.isActive = true;

      // Set default route based on call type
      if (isVideoCall && this.config.speakerForVideo) {
        await this.setRoute("speaker");
      } else {
        await this.setRoute("earpiece");
      }

      // Get available devices
      await this.refreshAvailableDevices();

      logInfo("Audio session initialized", { route: this.currentRoute });
    } catch (error) {
      logError("Failed to initialize audio session", error);
      throw error;
    }
  }

  /**
   * Set the active call ID for audio routing through CallKeep
   */
  setCurrentCallId(callId: string | null): void {
    this.currentCallId = callId;
    logDebug("Current call ID set", { callId });
  }

  private async initializeIOS(isVideoCall: boolean): Promise<void> {
    // iOS audio session is managed via CallKit (react-native-callkeep)
    // WebRTC also configures AVAudioSession internally
    // CallKeep.setAudioRoute handles speaker/earpiece switching
    logInfo("[AUDIO] iOS audio session initialized", {
      isVideoCall,
      defaultRoute: isVideoCall ? "speaker" : "earpiece",
    });
  }

  private async initializeAndroid(isVideoCall: boolean): Promise<void> {
    // Android audio is managed via ConnectionService (react-native-callkeep)
    // WebRTC configures AudioManager internally
    // CallKeep.setAudioRoute handles speaker/earpiece switching
    logInfo("[AUDIO] Android audio session initialized", {
      isVideoCall,
      defaultRoute: isVideoCall ? "speaker" : "earpiece",
    });
  }

  // ============================================================================
  // Audio Route Management
  // ============================================================================

  /**
   * Set the audio output route
   */
  async setRoute(route: AudioRoute): Promise<void> {
    logInfo("Setting audio route", { from: this.currentRoute, to: route });

    try {
      if (Platform.OS === "ios") {
        await this.setRouteIOS(route);
      } else {
        await this.setRouteAndroid(route);
      }

      this.currentRoute = route;
      this.notifyRouteChange(route);
    } catch (error) {
      logError("Failed to set audio route", { route, error });
      throw error;
    }
  }

  private async setRouteIOS(route: AudioRoute): Promise<void> {
    logInfo("[AUDIO] iOS: Setting route", {
      route,
      callId: this.currentCallId,
    });
    await this.setRouteViaCallKeep(route);
  }

  private async setRouteAndroid(route: AudioRoute): Promise<void> {
    logInfo("[AUDIO] Android: Setting route", {
      route,
      callId: this.currentCallId,
    });
    await this.setRouteViaCallKeep(route);
  }

  /**
   * Route audio through CallKeep (CallKit on iOS / ConnectionService on Android)
   * This is the actual native audio routing mechanism.
   */
  private async setRouteViaCallKeep(route: AudioRoute): Promise<void> {
    if (!this.currentCallId) {
      logDebug("[AUDIO] No active call ID — skipping CallKeep audio route");
      return;
    }
    try {
      // Lazily import to avoid circular dependencies
      const { callKeepService } = require("./callKeepService");
      const callKeepRoute = route === "speaker" ? "Speaker" : "Phone";
      await callKeepService.setAudioRoute(this.currentCallId, callKeepRoute);
      logInfo("[AUDIO] CallKeep audio route set", { route: callKeepRoute });
    } catch (error) {
      logError("[AUDIO] Failed to set CallKeep audio route", { route, error });
      // Audio may still work via WebRTC's default routing
    }
  }

  /**
   * Toggle between speaker and earpiece
   */
  async toggleSpeaker(): Promise<boolean> {
    const newRoute = this.currentRoute === "speaker" ? "earpiece" : "speaker";
    await this.setRoute(newRoute);
    return newRoute === "speaker";
  }

  /**
   * Get current audio route
   */
  getRoute(): AudioRoute {
    return this.currentRoute;
  }

  /**
   * Check if speaker is currently active
   */
  isSpeakerOn(): boolean {
    return this.currentRoute === "speaker";
  }

  // ============================================================================
  // Device Management
  // ============================================================================

  /**
   * Refresh list of available audio devices
   */
  async refreshAvailableDevices(): Promise<AudioDevice[]> {
    try {
      // In production, query native APIs for available devices
      // For now, return basic device list
      this.availableDevices = [
        {
          id: "earpiece",
          name: "Phone",
          type: "earpiece",
          isActive: this.currentRoute === "earpiece",
        },
        {
          id: "speaker",
          name: "Speaker",
          type: "speaker",
          isActive: this.currentRoute === "speaker",
        },
      ];

      // NOTE: Add bluetooth detection
      // NOTE: Add wired headset detection

      this.notifyDeviceChange(this.availableDevices);
      return this.availableDevices;
    } catch (error) {
      logError("Failed to refresh available devices", error);
      return this.availableDevices;
    }
  }

  /**
   * Get available audio devices
   */
  getAvailableDevices(): AudioDevice[] {
    return this.availableDevices;
  }

  /**
   * Select a specific audio device
   */
  async selectDevice(deviceId: string): Promise<void> {
    const device = this.availableDevices.find((d) => d.id === deviceId);
    if (!device) {
      logError("Device not found", { deviceId });
      return;
    }

    await this.setRoute(device.type);
    await this.refreshAvailableDevices();
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  /**
   * Add listener for audio route changes
   */
  addRouteChangeListener(listener: (route: AudioRoute) => void): () => void {
    this.routeChangeListeners.add(listener);
    return () => this.routeChangeListeners.delete(listener);
  }

  /**
   * Add listener for device availability changes
   */
  addDeviceChangeListener(
    listener: (devices: AudioDevice[]) => void,
  ): () => void {
    this.deviceChangeListeners.add(listener);
    return () => this.deviceChangeListeners.delete(listener);
  }

  private notifyRouteChange(route: AudioRoute): void {
    this.routeChangeListeners.forEach((listener) => {
      try {
        listener(route);
      } catch (error) {
        logError("Route change listener error", error);
      }
    });
  }

  private notifyDeviceChange(devices: AudioDevice[]): void {
    this.deviceChangeListeners.forEach((listener) => {
      try {
        listener(devices);
      } catch (error) {
        logError("Device change listener error", error);
      }
    });
  }

  // ============================================================================
  // Background Audio
  // ============================================================================

  /**
   * Enable background audio (call continues when app is backgrounded)
   */
  async enableBackgroundAudio(): Promise<void> {
    if (!this.config.backgroundAudio) {
      return;
    }

    logDebug("Enabling background audio");

    // On iOS, this is handled via UIBackgroundModes in Info.plist
    // On Android, this is handled via the foreground service

    // WebRTC maintains audio session in background automatically
    // This method is for any additional configuration needed
  }

  /**
   * Handle app going to background
   */
  async handleAppBackground(): Promise<void> {
    logDebug("App going to background, maintaining audio");
    // Audio should continue via CallKeep / foreground service
  }

  /**
   * Handle app coming to foreground
   */
  async handleAppForeground(): Promise<void> {
    logDebug("App coming to foreground");
    // Refresh device list in case it changed
    await this.refreshAvailableDevices();
  }

  // ============================================================================
  // Proximity Sensor
  // ============================================================================

  /**
   * Enable proximity sensor (screen off when phone to ear)
   */
  enableProximitySensor(): void {
    logDebug("Enabling proximity sensor");
    // This would typically use react-native-incall-manager
    // For now, it's a placeholder
  }

  /**
   * Disable proximity sensor
   */
  disableProximitySensor(): void {
    logDebug("Disabling proximity sensor");
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Deactivate the audio session
   */
  async deactivate(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    logInfo("[AUDIO] Deactivating audio session", {
      callId: this.currentCallId,
    });

    try {
      this.disableProximitySensor();

      // Reset to default state
      this.currentRoute = "earpiece";
      this.availableDevices = [];
      this.currentCallId = null;
      this.isActive = false;

      logInfo("[AUDIO] Audio session deactivated");
    } catch (error) {
      logError("[AUDIO] Failed to deactivate audio session", error);
    }
  }

  /**
   * Configure audio session settings
   */
  configure(config: Partial<AudioSessionConfig>): void {
    this.config = { ...this.config, ...config };
    logDebug("Audio session configured", this.config);
  }
}

export const audioSessionService = AudioSessionService.getInstance();
