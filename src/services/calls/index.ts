/**
 * Call Services - Barrel Export
 *
 * IMPORTANT: Native call features (WebRTC, CallKeep) require a development build.
 * They do NOT work in:
 * - Web browsers
 * - Expo Go app
 *
 * This module safely exports services, with native-dependent ones returning
 * no-op stubs on unsupported platforms.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

// Platform detection
const isWeb = Platform.OS === "web";
const isExpoGo = Constants.appOwnership === "expo";
const areNativeCallsAvailable = !isWeb && !isExpoGo;

// Re-export platform check for consumers
export { areNativeCallsAvailable };

// ============================================================================
// Safe initialization functions (always available)
// ============================================================================

/**
 * Initialize background call handler - safe to call on any platform
 */
export function initializeBackgroundCallHandler(): void {
  if (!areNativeCallsAvailable) {
    console.log(
      "[CallServices] Skipping background handler init - native calls not available",
    );
    return;
  }

  // Dynamic import to avoid loading native modules on web/Expo Go
  import("./backgroundCallHandler")
    .then(({ initializeBackgroundCallHandler }) => {
      initializeBackgroundCallHandler();
    })
    .catch((e) => {
      console.warn(
        "[CallServices] Failed to init background handler:",
        e.message,
      );
    });
}

/**
 * Initialize app state listener - safe to call on any platform
 */
export function initializeAppStateListener(): void {
  if (!areNativeCallsAvailable) {
    console.log(
      "[CallServices] Skipping app state listener - native calls not available",
    );
    return;
  }

  import("./backgroundCallHandler")
    .then(({ initializeAppStateListener }) => {
      initializeAppStateListener();
    })
    .catch((e) => {
      console.warn(
        "[CallServices] Failed to init app state listener:",
        e.message,
      );
    });
}

/**
 * Create call notification channel - safe to call on any platform
 */
export function createCallNotificationChannel(): void {
  if (!areNativeCallsAvailable) {
    console.log(
      "[CallServices] Skipping notification channel - native calls not available",
    );
    return;
  }

  import("./backgroundCallHandler")
    .then(({ createCallNotificationChannel }) => {
      createCallNotificationChannel();
    })
    .catch((e) => {
      console.warn(
        "[CallServices] Failed to create notification channel:",
        e.message,
      );
    });
}

// ============================================================================
// Types (always safe to export)
// ============================================================================

export type {
  AdaptiveBitrateCallbacks,
  BitrateConfig,
  BitrateQuality,
} from "./adaptiveBitrateService";
export type {
  AudioDevice,
  AudioRoute,
  AudioSessionConfig,
} from "./audioSessionService";
export type { BatteryOptimizationState } from "./batteryOptimizationHandler";
export type {
  ConnectionState,
  NetworkMetrics,
  ReconnectionConfig,
} from "./callReconnectionService";
export type {
  ConcurrentCallConfig,
  ManagedCall,
} from "./concurrentCallManager";
export type {
  CallNotificationConfig,
  NotificationAction,
} from "./foregroundServiceManager";
export type { RingtoneType } from "./ringtoneService";
export type { VoIPPushPayload } from "./voipPushService";

// ============================================================================
// Platform-agnostic services (Firebase/AsyncStorage based - always safe)
// ============================================================================

export { callAnalyticsService } from "./callAnalyticsService";
export { callHistoryService } from "./callHistoryService";
export { callSettingsService } from "./callSettingsService";

// ============================================================================
// Native-dependent services (lazy loaded to prevent crashes)
// ============================================================================

// These are dynamically imported when needed
// Use getCallService(), getWebRTCService(), etc. for safe access

/**
 * Get the call service instance (native only)
 */
export async function getCallService() {
  if (!areNativeCallsAvailable) {
    console.warn("[CallServices] callService not available on this platform");
    return null;
  }
  const { callService } = await import("./callService");
  return callService;
}

/**
 * Get the WebRTC service instance (native only)
 */
export async function getWebRTCService() {
  if (!areNativeCallsAvailable) {
    console.warn("[CallServices] webRTCService not available on this platform");
    return null;
  }
  const { webRTCService } = await import("./webRTCService");
  return webRTCService;
}

/**
 * Get the CallKeep service instance (native only)
 */
export async function getCallKeepService() {
  if (!areNativeCallsAvailable) {
    console.warn(
      "[CallServices] callKeepService not available on this platform",
    );
    return null;
  }
  const { callKeepService } = await import("./callKeepService");
  return callKeepService;
}

/**
 * Get the group call service instance (native only)
 */
export async function getGroupCallService() {
  if (!areNativeCallsAvailable) {
    console.warn(
      "[CallServices] groupCallService not available on this platform",
    );
    return null;
  }
  const { groupCallService } = await import("./groupCallService");
  return groupCallService;
}

// CallEndReason constant (safe as it's just an object)
export const CallEndReason = {
  FAILED: 1,
  REMOTE_ENDED: 2,
  UNANSWERED: 3,
  ANSWERED_ELSEWHERE: 4,
  DECLINED_ELSEWHERE: 5,
  MISSED: 6,
} as const;
