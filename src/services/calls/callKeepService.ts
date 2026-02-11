/**
 * CallKeepService - Native call UI integration
 * Handles iOS CallKit and Android ConnectionService integration
 */

import { Platform } from "react-native";
import RNCallKeep from "react-native-callkeep";
import { CallKeepOptions } from "@/types/call";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/callKeepService");
type RNCallKeepSetupOptions = Parameters<typeof RNCallKeep.setup>[0];
interface RNCallKeepWithAudioRoutes {
  getAudioRoutes?: () => Promise<unknown[]>;
}
// Simple logging helpers
const logInfo = (msg: string, data?: any) =>
  logger.info(`[CallKeepService] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  logger.error(`[CallKeepService] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && logger.info(`[CallKeepService] ${msg}`, data ?? "");
const logWarn = (msg: string, data?: any) =>
  logger.warn(`[CallKeepService] ${msg}`, data ?? "");

// CallKeep end call reasons
export const CallEndReason = {
  FAILED: 1,
  REMOTE_ENDED: 2,
  UNANSWERED: 3,
  ANSWERED_ELSEWHERE: 4,
  DECLINED_ELSEWHERE: 5,
  MISSED: 6,
} as const;

class CallKeepService {
  private static instance: CallKeepService;
  private isSetup = false;
  private activeCallId: string | null = null;

  // Callbacks to connect with CallService
  private onAnswerCall?: (callId: string) => void;
  private onEndCall?: (callId: string) => void;
  private onMuteCall?: (callId: string, muted: boolean) => void;
  private onHoldCall?: (callId: string, hold: boolean) => void;

  private constructor() {}

  static getInstance(): CallKeepService {
    if (!CallKeepService.instance) {
      CallKeepService.instance = new CallKeepService();
    }
    return CallKeepService.instance;
  }

  // ============================================================================
  // Setup
  // ============================================================================

  async setup(): Promise<void> {
    if (this.isSetup) {
      logDebug("CallKeep already setup");
      return;
    }

    const options: CallKeepOptions = {
      ios: {
        appName: "Vibe",
        imageName: "call_icon",
        supportsVideo: true,
        maximumCallGroups: "1",
        maximumCallsPerCallGroup: "1",
        ringtoneSound: "ringtone.mp3",
        includesCallsInRecents: true,
      },
      android: {
        alertTitle: "Permissions Required",
        alertDescription:
          "Vibe needs access to your phone account to make and receive calls",
        cancelButton: "Cancel",
        okButton: "OK",
        imageName: "ic_call",
        additionalPermissions: [], // Required by RNCallKeep
        selfManaged: false,
        foregroundService: {
          channelId: "vibe-call-channel",
          channelName: "Vibe Calls",
          notificationTitle: "Vibe call in progress",
          notificationIcon: "ic_call_notification",
        },
      },
    };

    try {
      const setupOptions = options as RNCallKeepSetupOptions;
      await RNCallKeep.setup(setupOptions);
      this.registerEventListeners();
      this.isSetup = true;

      // Mark device as available for calls on Android
      if (Platform.OS === "android") {
        RNCallKeep.setAvailable(true);
      }

      logInfo("CallKeep setup complete");
    } catch (error) {
      logError("CallKeep setup failed", { error });
      // Don't throw - app can still work without native call UI
    }
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  private registerEventListeners(): void {
    // User answered call from native UI
    RNCallKeep.addEventListener("answerCall", ({ callUUID }) => {
      logInfo("Native: answerCall", { callUUID });
      this.onAnswerCall?.(callUUID);
    });

    // User ended call from native UI
    RNCallKeep.addEventListener("endCall", ({ callUUID }) => {
      logInfo("Native: endCall", { callUUID });
      this.onEndCall?.(callUUID);
    });

    // User muted from native UI
    RNCallKeep.addEventListener(
      "didPerformSetMutedCallAction",
      ({ muted, callUUID }) => {
        logDebug("Native: muted", { muted, callUUID });
        this.onMuteCall?.(callUUID, muted);
      },
    );

    // User toggled hold from native UI
    RNCallKeep.addEventListener(
      "didToggleHoldCallAction",
      ({ hold, callUUID }) => {
        logDebug("Native: hold", { hold, callUUID });
        this.onHoldCall?.(callUUID, hold);
      },
    );

    // Audio session activated (safe to start audio)
    RNCallKeep.addEventListener("didActivateAudioSession", () => {
      logDebug("Audio session activated");
    });

    // Audio session deactivated
    RNCallKeep.addEventListener("didDeactivateAudioSession", () => {
      logDebug("Audio session deactivated");
    });

    // Incoming call displayed
    RNCallKeep.addEventListener(
      "didDisplayIncomingCall",
      ({ error, callUUID, handle, localizedCallerName, hasVideo }) => {
        if (error) {
          logError("Error displaying incoming call", { error });
        } else {
          logDebug("Incoming call displayed", {
            callUUID,
            handle,
            localizedCallerName,
            hasVideo,
          });
        }
      },
    );

    // Call state changes
    RNCallKeep.addEventListener(
      "didPerformDTMFAction",
      ({ digits, callUUID }) => {
        logDebug("DTMF action", { digits, callUUID });
      },
    );

    // Handle events that occurred before JS was ready (iOS)
    RNCallKeep.addEventListener("didLoadWithEvents", (events) => {
      if (events && events.length > 0) {
        logInfo("Processing early events", { count: events.length });
        events.forEach((event: any) => {
          if (event.name === "RNCallKeepPerformAnswerCallAction") {
            this.onAnswerCall?.(event.data.callUUID);
          } else if (event.name === "RNCallKeepPerformEndCallAction") {
            this.onEndCall?.(event.data.callUUID);
          }
        });
      }
    });

    // Show incoming call when permission was initially denied (Android)
    RNCallKeep.addEventListener(
      "showIncomingCallUi",
      ({ handle, callUUID, name }) => {
        logDebug("Show incoming call UI", { handle, callUUID, name });
        // This is called when Android doesn't have permission to show full-screen call
        // You may want to show a notification or in-app UI instead
      },
    );

    // Check if app was launched by a call (iOS)
    RNCallKeep.addEventListener("checkReachability", () => {
      logDebug("Reachability check requested");
      RNCallKeep.setReachable();
    });
  }

  // ============================================================================
  // Callbacks
  // ============================================================================

  setCallbacks(callbacks: {
    onAnswerCall: (callId: string) => void;
    onEndCall: (callId: string) => void;
    onMuteCall: (callId: string, muted: boolean) => void;
    onHoldCall: (callId: string, hold: boolean) => void;
  }): void {
    this.onAnswerCall = callbacks.onAnswerCall;
    this.onEndCall = callbacks.onEndCall;
    this.onMuteCall = callbacks.onMuteCall;
    this.onHoldCall = callbacks.onHoldCall;
  }

  // ============================================================================
  // Incoming Calls
  // ============================================================================

  /**
   * Display incoming call using native UI
   * Usually called from push notification handler
   */
  displayIncomingCall(
    callId: string,
    callerName: string,
    callerHandle: string,
    hasVideo: boolean,
  ): void {
    if (!this.isSetup) {
      logWarn("CallKeep not setup, cannot display incoming call");
      return;
    }

    this.activeCallId = callId;

    logInfo("Displaying incoming call", {
      callId,
      callerName,
      hasVideo,
    });

    RNCallKeep.displayIncomingCall(
      callId,
      callerHandle,
      callerName,
      "generic",
      hasVideo,
    );
  }

  // ============================================================================
  // Outgoing Calls
  // ============================================================================

  /**
   * Start an outgoing call
   */
  startOutgoingCall(
    callId: string,
    calleeName: string,
    calleeHandle: string,
    hasVideo: boolean,
  ): void {
    if (!this.isSetup) {
      logWarn("CallKeep not setup, cannot start outgoing call");
      return;
    }

    this.activeCallId = callId;

    logInfo("Starting outgoing call", { callId, calleeName, hasVideo });

    RNCallKeep.startCall(callId, calleeHandle, calleeName, "generic", hasVideo);
  }

  // ============================================================================
  // Call State Updates
  // ============================================================================

  /**
   * Update call when answered/connected
   */
  setCallConnected(callId: string): void {
    if (!this.isSetup) return;

    logDebug("Setting call connected", { callId });

    if (Platform.OS === "android") {
      RNCallKeep.setCurrentCallActive(callId);
    }
  }

  /**
   * End a call
   */
  endCall(callId: string): void {
    if (!this.isSetup) return;

    logInfo("Ending call", { callId });

    RNCallKeep.endCall(callId);
    this.activeCallId = null;
  }

  /**
   * End all active calls
   */
  endAllCalls(): void {
    if (!this.isSetup) return;

    logInfo("Ending all calls");

    RNCallKeep.endAllCalls();
    this.activeCallId = null;
  }

  /**
   * Report that a call ended (when remote ends)
   */
  reportEndCall(
    callId: string,
    reason: (typeof CallEndReason)[keyof typeof CallEndReason],
  ): void {
    if (!this.isSetup) return;

    logInfo("Reporting call ended", { callId, reason });

    RNCallKeep.reportEndCallWithUUID(callId, reason);
    this.activeCallId = null;
  }

  // ============================================================================
  // Display Updates
  // ============================================================================

  /**
   * Update the caller/callee display name
   */
  updateDisplay(callId: string, displayName: string, handle: string): void {
    if (!this.isSetup) return;

    logDebug("Updating display", { callId, displayName });

    RNCallKeep.updateDisplay(callId, displayName, handle);
  }

  // ============================================================================
  // Media State
  // ============================================================================

  /**
   * Set mute state
   */
  setMuted(callId: string, muted: boolean): void {
    if (!this.isSetup) return;

    logDebug("Setting muted", { callId, muted });

    RNCallKeep.setMutedCall(callId, muted);
  }

  /**
   * Set hold state
   */
  setOnHold(callId: string, onHold: boolean): void {
    if (!this.isSetup) return;

    logDebug("Setting on hold", { callId, onHold });

    RNCallKeep.setOnHold(callId, onHold);
  }

  // ============================================================================
  // Audio Routing
  // ============================================================================

  /**
   * Get available audio routes
   */
  async getAudioRoutes(): Promise<unknown[]> {
    if (!this.isSetup) return [];

    try {
      const routes = await (
        RNCallKeep as unknown as RNCallKeepWithAudioRoutes
      ).getAudioRoutes?.();
      return Array.isArray(routes) ? routes : [];
    } catch (error) {
      logError("Failed to get audio routes", { error });
      return [];
    }
  }

  /**
   * Set audio route
   */
  async setAudioRoute(callId: string, route: string): Promise<void> {
    if (!this.isSetup) return;

    try {
      await RNCallKeep.setAudioRoute(callId, route);
      logDebug("Audio route set", { callId, route });
    } catch (error) {
      logError("Failed to set audio route", { error });
    }
  }

  // ============================================================================
  // State Getters
  // ============================================================================

  hasActiveCall(): boolean {
    return this.activeCallId !== null;
  }

  getActiveCallId(): string | null {
    return this.activeCallId;
  }

  isInitialized(): boolean {
    return this.isSetup;
  }

  // ============================================================================
  // Permissions
  // ============================================================================

  /**
   * Check if the app has phone account permission (Android)
   */
  async hasPhoneAccountPermission(): Promise<boolean> {
    if (Platform.OS !== "android") return true;

    try {
      return await RNCallKeep.hasPhoneAccount();
    } catch (error) {
      logError("Error checking phone account", { error });
      return false;
    }
  }

  /**
   * Prompt user to enable phone account (Android)
   */
  async promptPhoneAccountSettings(): Promise<void> {
    if (Platform.OS !== "android") return;

    try {
      await RNCallKeep.hasDefaultPhoneAccount();
    } catch (error) {
      logError("Error prompting phone settings", { error });
    }
  }

  /**
   * Check if the app is registered for phone calls (Android)
   */
  async checkPhoneAccountEnabled(): Promise<boolean> {
    if (Platform.OS !== "android") return true;

    try {
      return await RNCallKeep.checkPhoneAccountEnabled();
    } catch (error) {
      logError("Error checking phone account enabled", { error });
      return false;
    }
  }

  /**
   * Check if Do Not Disturb permission is enabled (Android)
   */
  async isConnectionServiceAvailable(): Promise<boolean> {
    if (Platform.OS !== "android") return true;

    try {
      return await RNCallKeep.isConnectionServiceAvailable();
    } catch (error) {
      logError("Error checking connection service", { error });
      return false;
    }
  }
}

export const callKeepService = CallKeepService.getInstance();
