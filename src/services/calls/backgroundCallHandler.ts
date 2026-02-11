/**
 * Background Call Handler
 * Handles incoming call push notifications when app is in background/killed state
 * Integrates with CallKeep to show native incoming call UI
 *
 * Note: This module provides the handlers that should be connected to your
 * Firebase Cloud Messaging setup. The actual FCM initialization happens
 * elsewhere in the app.
 */

import { AppState, AppStateStatus, Platform } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { callKeepService } from "./callKeepService";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/backgroundCallHandler");
// Type for incoming call notification data
export interface IncomingCallData {
  type: "incoming_call" | "call_cancelled";
  callId: string;
  callerId: string;
  callerName: string;
  callType: "audio" | "video";
  conversationId: string;
  scope: "dm" | "group";
  hasVideo: string;
  uuid?: string;
  reason?: string;
}

/**
 * Initialize the background call handler
 * Should be called early in app initialization
 *
 * Note: This sets up the CallKeep service. FCM message handlers
 * should call handleBackgroundMessage and handleForegroundMessage
 * when call-related notifications are received.
 */
export function initializeBackgroundCallHandler(): void {
  // Initialize CallKeep service
  callKeepService.setup().catch((error) => {
    logger.warn("[BackgroundCallHandler] CallKeep setup failed:", error);
  });

  logger.info("[BackgroundCallHandler] Initialized");
}

/**
 * Handle FCM messages when app is in background or killed
 * Call this from your FCM background message handler
 */
export async function handleBackgroundMessage(
  data: Record<string, string> | undefined,
): Promise<void> {
  logger.info("[BackgroundCallHandler] Background message received:", data);

  const callData = data as IncomingCallData | undefined;

  if (!callData?.type) {
    return;
  }

  switch (callData.type) {
    case "incoming_call":
      await handleIncomingCallNotification(callData);
      break;
    case "call_cancelled":
      await handleCallCancelledNotification(callData);
      break;
    default:
      logger.info(
        "[BackgroundCallHandler] Unknown message type:",
        callData.type,
      );
  }
}

/**
 * Handle FCM messages when app is in foreground
 * Call this from your FCM foreground message handler
 */
export async function handleForegroundMessage(
  data: Record<string, string> | undefined,
): Promise<void> {
  logger.info("[BackgroundCallHandler] Foreground message received:", data);

  const callData = data as IncomingCallData | undefined;

  if (!callData?.type) {
    return;
  }

  // In foreground, the CallContext will handle the incoming call
  // via Firestore listener. We only need to handle cancellations.
  if (callData.type === "call_cancelled") {
    await handleCallCancelledNotification(callData);
  }
}

/**
 * Display incoming call notification using CallKeep
 */
async function handleIncomingCallNotification(
  data: IncomingCallData,
): Promise<void> {
  logger.info("[BackgroundCallHandler] Incoming call:", {
    callId: data.callId,
    caller: data.callerName,
    type: data.callType,
  });

  // Ensure CallKeep is initialized
  await callKeepService.setup();

  // Generate or use existing UUID for CallKeep
  const uuid = data.uuid || data.callId || uuidv4();
  const hasVideo = data.hasVideo === "true" || data.callType === "video";

  // Display incoming call using native UI
  callKeepService.displayIncomingCall(
    uuid,
    data.callerName || "Unknown Caller",
    data.callerName,
    hasVideo,
  );

  // Store call metadata for when user answers
  storeCallMetadata(uuid, {
    callId: data.callId,
    callerId: data.callerId,
    callerName: data.callerName,
    callType: data.callType,
    conversationId: data.conversationId,
    scope: data.scope,
    hasVideo,
  });

  logger.info("[BackgroundCallHandler] Displayed incoming call UI", { uuid });
}

/**
 * Handle call cancelled notification (caller hung up, timeout, etc.)
 */
async function handleCallCancelledNotification(
  data: IncomingCallData,
): Promise<void> {
  logger.info("[BackgroundCallHandler] Call cancelled:", {
    callId: data.callId,
    reason: data.reason,
  });

  const uuid = data.uuid || data.callId;

  if (uuid) {
    // End the call in CallKeep
    callKeepService.endCall(uuid);

    // Clear stored metadata
    clearCallMetadata(uuid);
  }
}

// ============================================================================
// Call Metadata Storage
// In-memory storage for call data received via push notification
// This data is used when the user answers the call
// ============================================================================

interface StoredCallMetadata {
  callId: string;
  callerId: string;
  callerName: string;
  callType: "audio" | "video";
  conversationId: string;
  scope: "dm" | "group";
  hasVideo: boolean;
  receivedAt: number;
}

const callMetadataStore = new Map<string, StoredCallMetadata>();

function storeCallMetadata(
  uuid: string,
  metadata: Omit<StoredCallMetadata, "receivedAt">,
): void {
  callMetadataStore.set(uuid, {
    ...metadata,
    receivedAt: Date.now(),
  });
}

function clearCallMetadata(uuid: string): void {
  callMetadataStore.delete(uuid);
}

/**
 * Get stored call metadata by UUID
 * Called when user answers a call from CallKeep UI
 */
export function getCallMetadata(uuid: string): StoredCallMetadata | undefined {
  return callMetadataStore.get(uuid);
}

/**
 * Clean up old metadata entries (older than 5 minutes)
 */
export function cleanupOldCallMetadata(): void {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  for (const [uuid, metadata] of callMetadataStore.entries()) {
    if (metadata.receivedAt < fiveMinutesAgo) {
      callMetadataStore.delete(uuid);
    }
  }
}

// ============================================================================
// iOS VoIP Push Registration
// iOS requires separate VoIP push registration for CallKit
// ============================================================================

/**
 * Register for VoIP pushes on iOS
 * This is required for CallKit to work reliably in background
 *
 * Note: Call this after requesting notification permissions
 * and getting the FCM token
 */
export async function registerForVoIPPushes(): Promise<string | null> {
  if (Platform.OS !== "ios") {
    return null;
  }

  try {
    // VoIP registration would happen here
    // For Expo/Firebase, the FCM token is typically used for both
    logger.info("[BackgroundCallHandler] VoIP push registration placeholder");
    return null;
  } catch (error) {
    logger.error(
      "[BackgroundCallHandler] Failed to register for VoIP pushes:",
      error,
    );
    return null;
  }
}

// ============================================================================
// Android Notification Channel Setup
// Android requires a high-priority notification channel for incoming calls
// ============================================================================

/**
 * Create the high-priority notification channel for incoming calls on Android
 */
export async function createCallNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  // This would typically use a library like @notifee/react-native or
  // react-native-push-notification to create the channel
  // For now, this is a placeholder - the Cloud Function sends the channel ID

  logger.info(
    "[BackgroundCallHandler] Android notification channel placeholder",
  );
}

// ============================================================================
// App State Handling
// Track app state to coordinate between foreground and background handling
// ============================================================================

type AppStateType =
  | "active"
  | "background"
  | "inactive"
  | "unknown"
  | "extension";
let currentAppState: AppStateType = "unknown";

/**
 * Initialize app state listener
 */
export function initializeAppStateListener(): () => void {
  currentAppState = AppState.currentState as AppStateType;

  const subscription = AppState.addEventListener(
    "change",
    (nextAppState: AppStateStatus) => {
      logger.info(
        "[BackgroundCallHandler] App state changed:",
        currentAppState,
        "->",
        nextAppState,
      );

      // Clean up old metadata when app comes to foreground
      if (
        (currentAppState === "inactive" || currentAppState === "background") &&
        nextAppState === "active"
      ) {
        cleanupOldCallMetadata();
      }

      currentAppState = nextAppState as AppStateType;
    },
  );

  // Return cleanup function
  return () => subscription.remove();
}

/**
 * Check if app is in foreground
 */
export function isAppInForeground(): boolean {
  return currentAppState === "active";
}
