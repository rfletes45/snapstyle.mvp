/**
 * Stream Video Push Notification Configuration
 *
 * Configures the Stream Video SDK to handle incoming call push notifications
 * on both Android (Firebase + Notifee) and iOS (VoIP push + CallKit).
 *
 * Must be called OUTSIDE the React component tree — typically in index.js
 * before the app mounts — so configuration is available when the app is
 * opened from a push notification in a terminated state.
 */

import { CALL_FEATURES } from "@/constants/featureFlags";

export function setPushConfig(): void {
  // Skip entirely if native call modules are not available (Expo Go)
  if (!CALL_FEATURES.CALLS_ENABLED) return;

  let StreamVideoRN: any;
  let StreamVideoClient: any;
  let AndroidImportance: any;

  try {
    const sdk = require("@stream-io/video-react-native-sdk");
    StreamVideoRN = sdk.StreamVideoRN;
    StreamVideoClient = sdk.StreamVideoClient;
  } catch {
    console.warn("[setPushConfig] Stream SDK not available, skipping");
    return;
  }

  try {
    const notifee = require("@notifee/react-native");
    AndroidImportance = notifee.AndroidImportance;
  } catch {
    // Notifee not installed — use a sensible default
    AndroidImportance = { HIGH: 4 };
  }

  // Lazy imports for token fetching — these run only when a push arrives
  // while the app is terminated and the SDK needs to create a client.
  const createStreamVideoClient = async () => {
    try {
      const { fetchStreamToken } =
        require("@/services/stream/streamTokenProvider") as typeof import("@/services/stream/streamTokenProvider");
      const { getAuthInstance } =
        require("@/services/firebase") as typeof import("@/services/firebase");

      const currentUser = getAuthInstance().currentUser;
      if (!currentUser) {
        console.warn(
          "[setPushConfig] No authenticated user, cannot create client for push",
        );
        return undefined;
      }

      const { token, apiKey } = await fetchStreamToken();

      return StreamVideoClient.getOrCreateInstance({
        apiKey,
        user: { id: currentUser.uid },
        token,
        tokenProvider: async () => {
          const result = await fetchStreamToken();
          return result.token;
        },
      });
    } catch (err) {
      console.error("[setPushConfig] createStreamVideoClient failed:", err);
      return undefined;
    }
  };

  StreamVideoRN.setPushConfig({
    // Inform the SDK this is an Expo project
    isExpo: true,

    ios: {
      // Must match the Push Provider name configured in the Stream Dashboard
      pushProviderName: "vibe-apn",
    },

    android: {
      // Must match the Push Provider name configured in the Stream Dashboard
      pushProviderName: "vibe-firebase",

      // Notification channel for incoming calls (full-screen / heads-up)
      incomingCallChannel: {
        id: "stream_incoming_call",
        name: "Incoming call notifications",
        importance: AndroidImportance.HIGH,
        sound: "default",
      },

      // Notification channel for general call events (missed calls, etc.)
      callChannel: {
        id: "stream_call_notifications",
        name: "Call notifications",
        importance: AndroidImportance.HIGH,
        sound: "default",
      },

      // Text shown in the Android notification for incoming calls
      incomingCallNotificationTextGetters: {
        getTitle: (createdUserName: string) =>
          `Incoming call from ${createdUserName}`,
        getBody: (_createdUserName: string) => "Tap to answer the call",
      },
    },

    // Called when a push arrives while the app is terminated.
    // The SDK needs a connected client to process the call event.
    createStreamVideoClient,

    // Stream 1.30 watches ringing / joined calls from the root component
    // rather than routing through deprecated navigateAcceptCall callbacks.
    // We intentionally rely on IncomingCallHandler + useCalls() for app-side
    // navigation after native accept / decline actions.
  });
}
