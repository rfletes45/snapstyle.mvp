/**
 * ForegroundServiceManager - Manages Android foreground service for calls
 * Ensures call continues when app is in background on Android
 */

import { Platform } from "react-native";

// Logging helpers
const logInfo = (msg: string, data?: any) =>
  console.log(`[ForegroundService] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  console.error(`[ForegroundService] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && console.log(`[ForegroundService] ${msg}`, data ?? "");

// Notification channel configuration
export interface CallNotificationConfig {
  channelId: string;
  channelName: string;
  channelDescription: string;
  notificationTitle: string;
  notificationText: string;
  smallIcon: string;
  largeIcon?: string;
  color?: string;
}

const DEFAULT_NOTIFICATION_CONFIG: CallNotificationConfig = {
  channelId: "vibe-active-call",
  channelName: "Active Calls",
  channelDescription: "Shows when you have an active call",
  notificationTitle: "Vibe Call",
  notificationText: "Call in progress...",
  smallIcon: "ic_call_notification",
  color: "#6366f1", // Primary color
};

// Service states
export type ServiceState = "stopped" | "starting" | "running" | "stopping";

class ForegroundServiceManager {
  private static instance: ForegroundServiceManager;
  private state: ServiceState = "stopped";
  private currentCallId: string | null = null;
  private config: CallNotificationConfig = DEFAULT_NOTIFICATION_CONFIG;
  private startTime: number | null = null;
  private updateInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  static getInstance(): ForegroundServiceManager {
    if (!ForegroundServiceManager.instance) {
      ForegroundServiceManager.instance = new ForegroundServiceManager();
    }
    return ForegroundServiceManager.instance;
  }

  // ============================================================================
  // Service Lifecycle
  // ============================================================================

  /**
   * Start the foreground service for a call
   */
  async startService(
    callId: string,
    callerName: string,
    isVideoCall: boolean,
  ): Promise<void> {
    if (Platform.OS !== "android") {
      logDebug("Foreground service only needed on Android");
      return;
    }

    if (this.state === "running") {
      logDebug("Service already running, updating...");
      await this.updateNotification(callerName, isVideoCall);
      return;
    }

    logInfo("Starting foreground service", { callId, callerName });
    this.state = "starting";
    this.currentCallId = callId;
    this.startTime = Date.now();

    try {
      // In production, this would call a native module to start the foreground service
      // For now, we'll use CallKeep's foreground service which is configured in callKeepService

      // The actual native implementation would be:
      // await NativeModules.CallForegroundService?.startService({
      //   channelId: this.config.channelId,
      //   channelName: this.config.channelName,
      //   notificationTitle: this.config.notificationTitle,
      //   notificationText: `Call with ${callerName}`,
      //   smallIcon: this.config.smallIcon,
      //   largeIcon: this.config.largeIcon,
      //   color: this.config.color,
      //   isVideoCall,
      // });

      this.state = "running";

      // Start periodic notification updates for duration
      this.startDurationUpdates(callerName, isVideoCall);

      logInfo("Foreground service started");
    } catch (error) {
      logError("Failed to start foreground service", error);
      this.state = "stopped";
      throw error;
    }
  }

  /**
   * Stop the foreground service
   */
  async stopService(): Promise<void> {
    if (Platform.OS !== "android") {
      return;
    }

    if (this.state !== "running") {
      logDebug("Service not running");
      return;
    }

    logInfo("Stopping foreground service");
    this.state = "stopping";

    try {
      // Stop duration updates
      this.stopDurationUpdates();

      // In production:
      // await NativeModules.CallForegroundService?.stopService();

      this.state = "stopped";
      this.currentCallId = null;
      this.startTime = null;

      logInfo("Foreground service stopped");
    } catch (error) {
      logError("Failed to stop foreground service", error);
      this.state = "stopped";
    }
  }

  // ============================================================================
  // Notification Updates
  // ============================================================================

  /**
   * Update the notification content
   */
  async updateNotification(
    callerName: string,
    isVideoCall: boolean,
  ): Promise<void> {
    if (Platform.OS !== "android" || this.state !== "running") {
      return;
    }

    const duration = this.getCallDuration();
    const durationText = this.formatDuration(duration);

    const title = isVideoCall ? "📹 Video Call" : "📞 Voice Call";
    const text = `${callerName} • ${durationText}`;

    logDebug("Updating notification", { title, text });

    // In production:
    // await NativeModules.CallForegroundService?.updateNotification({
    //   notificationTitle: title,
    //   notificationText: text,
    // });
  }

  private startDurationUpdates(callerName: string, isVideoCall: boolean): void {
    this.stopDurationUpdates();

    this.updateInterval = setInterval(() => {
      this.updateNotification(callerName, isVideoCall);
    }, 1000);
  }

  private stopDurationUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Add action buttons to the notification
   */
  async setNotificationActions(actions: NotificationAction[]): Promise<void> {
    if (Platform.OS !== "android" || this.state !== "running") {
      return;
    }

    logDebug("Setting notification actions", { count: actions.length });

    // In production:
    // await NativeModules.CallForegroundService?.setActions(actions);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private getCallDuration(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // ============================================================================
  // State Getters
  // ============================================================================

  getState(): ServiceState {
    return this.state;
  }

  isRunning(): boolean {
    return this.state === "running";
  }

  getCurrentCallId(): string | null {
    return this.currentCallId;
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  configure(config: Partial<CallNotificationConfig>): void {
    this.config = { ...this.config, ...config };
    logDebug("Configuration updated", this.config);
  }
}

// Notification action type
export interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
}

export const foregroundServiceManager = ForegroundServiceManager.getInstance();
