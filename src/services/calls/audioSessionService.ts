/**
 * AudioSessionService - Manages audio routing and session for calls
 * Handles speaker/earpiece/bluetooth routing and background audio
 */

import { NativeEventEmitter, Platform } from "react-native";

// Logging helpers
const logInfo = (msg: string, data?: any) =>
  console.log(`[AudioSessionService] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  console.error(`[AudioSessionService] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && console.log(`[AudioSessionService] ${msg}`, data ?? "");

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

  private async initializeIOS(isVideoCall: boolean): Promise<void> {
    // iOS uses AVAudioSession via native module
    // For now, we'll rely on react-native-webrtc's audio session handling
    // In production, you might want to use react-native-incall-manager

    logDebug("iOS audio session initialized (via WebRTC)");
  }

  private async initializeAndroid(isVideoCall: boolean): Promise<void> {
    // Android uses AudioManager via native module
    // react-native-webrtc handles basic audio routing
    // For advanced features, consider react-native-incall-manager

    logDebug("Android audio session initialized (via WebRTC)");
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
    // In a full implementation, this would call native AVAudioSession APIs
    // For now, we log the intent
    logDebug("iOS: Setting route", { route });
  }

  private async setRouteAndroid(route: AudioRoute): Promise<void> {
    // In a full implementation, this would call native AudioManager APIs
    // For now, we log the intent
    logDebug("Android: Setting route", { route });
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

      // TODO: Add bluetooth detection
      // TODO: Add wired headset detection

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

    logInfo("Deactivating audio session");

    try {
      this.disableProximitySensor();

      // Reset to default state
      this.currentRoute = "earpiece";
      this.availableDevices = [];
      this.isActive = false;

      logInfo("Audio session deactivated");
    } catch (error) {
      logError("Failed to deactivate audio session", error);
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
