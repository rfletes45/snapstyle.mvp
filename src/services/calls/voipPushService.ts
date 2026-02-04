/**
 * VoIPPushService - Handles iOS VoIP push notifications
 * Integrates with PushKit for reliable call delivery
 */

import { NativeEventEmitter, Platform } from "react-native";
import { callKeepService } from "./callKeepService";

// Logging helpers
const logInfo = (msg: string, data?: any) =>
  console.log(`[VoIPPush] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  console.error(`[VoIPPush] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && console.log(`[VoIPPush] ${msg}`, data ?? "");

// VoIP push payload from server
export interface VoIPPushPayload {
  type: "incoming_call" | "call_cancelled" | "call_updated";
  callId: string;
  callerId: string;
  callerName: string;
  callType: "audio" | "video";
  conversationId: string;
  scope: "dm" | "group";
  hasVideo: string;
  uuid?: string;
  // For call updates
  action?: "ended" | "declined" | "answered_elsewhere";
}

// Event listeners
type VoIPPushEventListener = (payload: VoIPPushPayload) => void;
type TokenEventListener = (token: string) => void;

class VoIPPushService {
  private static instance: VoIPPushService;
  private isRegistered: boolean = false;
  private voipToken: string | null = null;
  private eventEmitter: NativeEventEmitter | null = null;

  // Event listeners
  private pushListeners: Set<VoIPPushEventListener> = new Set();
  private tokenListeners: Set<TokenEventListener> = new Set();

  private constructor() {}

  static getInstance(): VoIPPushService {
    if (!VoIPPushService.instance) {
      VoIPPushService.instance = new VoIPPushService();
    }
    return VoIPPushService.instance;
  }

  // ============================================================================
  // Registration
  // ============================================================================

  /**
   * Register for VoIP push notifications (iOS only)
   * Must be called after user grants notification permission
   */
  async register(): Promise<string | null> {
    if (Platform.OS !== "ios") {
      logDebug("VoIP push only available on iOS");
      return null;
    }

    if (this.isRegistered && this.voipToken) {
      logDebug("Already registered, returning existing token");
      return this.voipToken;
    }

    logInfo("Registering for VoIP push notifications");

    try {
      // In production, this would use react-native-voip-push-notification
      // For now, we document the expected flow

      // The actual implementation would be:
      // const RNVoipPushNotification = require('react-native-voip-push-notification').default;
      //
      // RNVoipPushNotification.addEventListener('register', (token: string) => {
      //   this.handleTokenReceived(token);
      // });
      //
      // RNVoipPushNotification.addEventListener('notification', (notification: any) => {
      //   this.handleNotification(notification);
      // });
      //
      // RNVoipPushNotification.addEventListener('didLoadWithEvents', (events: any[]) => {
      //   this.handleEarlyEvents(events);
      // });
      //
      // RNVoipPushNotification.registerVoipToken();

      this.isRegistered = true;
      logInfo("VoIP push registration initiated");

      // Token will be received via callback
      return null;
    } catch (error) {
      logError("Failed to register for VoIP push", error);
      throw error;
    }
  }

  /**
   * Unregister from VoIP push notifications
   */
  async unregister(): Promise<void> {
    if (Platform.OS !== "ios" || !this.isRegistered) {
      return;
    }

    logInfo("Unregistering from VoIP push notifications");

    try {
      // RNVoipPushNotification.removeEventListener('register');
      // RNVoipPushNotification.removeEventListener('notification');

      this.isRegistered = false;
      this.voipToken = null;
    } catch (error) {
      logError("Failed to unregister from VoIP push", error);
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle VoIP token received
   */
  private handleTokenReceived(token: string): void {
    logInfo("VoIP token received", { token: token.substring(0, 20) + "..." });

    this.voipToken = token;

    // Notify listeners
    this.tokenListeners.forEach((listener) => {
      try {
        listener(token);
      } catch (error) {
        logError("Token listener error", error);
      }
    });
  }

  /**
   * Handle VoIP push notification received
   */
  private handleNotification(notification: any): void {
    logInfo("VoIP notification received", {
      type: notification?.type,
      callId: notification?.callId,
    });

    const payload = this.parseNotification(notification);
    if (!payload) {
      logError("Invalid notification payload", notification);
      return;
    }

    // Handle based on type
    switch (payload.type) {
      case "incoming_call":
        this.handleIncomingCall(payload);
        break;
      case "call_cancelled":
        this.handleCallCancelled(payload);
        break;
      case "call_updated":
        this.handleCallUpdated(payload);
        break;
      default:
        logError("Unknown notification type", payload);
    }

    // Notify listeners
    this.pushListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        logError("Push listener error", error);
      }
    });
  }

  /**
   * Handle events that occurred before JS was ready
   */
  private handleEarlyEvents(events: any[]): void {
    if (!events || events.length === 0) return;

    logInfo("Processing early VoIP events", { count: events.length });

    events.forEach((event) => {
      if (event.name === "RNVoipPushRemoteNotificationsRegisteredEvent") {
        this.handleTokenReceived(event.data?.deviceToken);
      } else if (event.name === "RNVoipPushRemoteNotificationReceivedEvent") {
        this.handleNotification(event.data);
      }
    });
  }

  // ============================================================================
  // Notification Handling
  // ============================================================================

  private parseNotification(notification: any): VoIPPushPayload | null {
    if (!notification) return null;

    // Extract payload (might be nested)
    const data = notification.getData?.() || notification;

    if (!data.callId || !data.type) {
      return null;
    }

    return {
      type: data.type,
      callId: data.callId,
      callerId: data.callerId || "",
      callerName: data.callerName || "Unknown",
      callType: data.callType || "audio",
      conversationId: data.conversationId || "",
      scope: data.scope || "dm",
      hasVideo: data.hasVideo || "false",
      uuid: data.uuid || data.callId,
      action: data.action,
    };
  }

  private handleIncomingCall(payload: VoIPPushPayload): void {
    logInfo("Handling incoming call", {
      callId: payload.callId,
      caller: payload.callerName,
    });

    // Display incoming call using CallKit via CallKeep
    callKeepService.displayIncomingCall(
      payload.uuid || payload.callId,
      payload.callerName,
      payload.callerId,
      payload.hasVideo === "true",
    );
  }

  private handleCallCancelled(payload: VoIPPushPayload): void {
    logInfo("Handling call cancelled", {
      callId: payload.callId,
      action: payload.action,
    });

    // End the call in CallKit
    const reason = this.mapCancelReasonToCallKitReason(payload.action);
    callKeepService.reportEndCall(payload.uuid || payload.callId, reason);
  }

  private handleCallUpdated(payload: VoIPPushPayload): void {
    logInfo("Handling call updated", {
      callId: payload.callId,
      action: payload.action,
    });

    // Handle based on action
    if (payload.action === "answered_elsewhere") {
      callKeepService.reportEndCall(
        payload.uuid || payload.callId,
        4, // ANSWERED_ELSEWHERE
      );
    }
  }

  private mapCancelReasonToCallKitReason(
    action?: string,
  ): 1 | 2 | 3 | 4 | 5 | 6 {
    switch (action) {
      case "ended":
        return 2; // REMOTE_ENDED
      case "declined":
        return 5; // DECLINED_ELSEWHERE
      case "answered_elsewhere":
        return 4; // ANSWERED_ELSEWHERE
      default:
        return 2; // REMOTE_ENDED
    }
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  /**
   * Add listener for VoIP push notifications
   */
  addPushListener(listener: VoIPPushEventListener): () => void {
    this.pushListeners.add(listener);
    return () => this.pushListeners.delete(listener);
  }

  /**
   * Add listener for VoIP token updates
   */
  addTokenListener(listener: TokenEventListener): () => void {
    this.tokenListeners.add(listener);
    return () => this.tokenListeners.delete(listener);
  }

  // ============================================================================
  // State Getters
  // ============================================================================

  isRegisteredForPush(): boolean {
    return this.isRegistered;
  }

  getVoIPToken(): string | null {
    return this.voipToken;
  }
}

export const voipPushService = VoIPPushService.getInstance();
