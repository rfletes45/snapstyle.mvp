/**
 * Stream Video Push Notification Configuration
 *
 * Configures the Stream Video SDK to handle incoming call push notifications
 * on both Android and iOS in all app states (foreground, background, terminated).
 *
 * Platform push architecture:
 * ─────────────────────────────────────────────────────────────────────────
 * iOS:     VoIP push (PushKit) → CallKit native call UI → Stream SDK
 *          The SDK's Expo config plugin injects native AppDelegate code that:
 *          1. Calls RNVoipPushNotificationManager.voipRegistration() on launch
 *          2. Receives VoIP push credentials and forwards to JS via RNVoipPushNotification
 *          3. Handles didReceiveIncomingPushWith to parse the Stream payload,
 *             register the call, and report it to CallKit via RNCallKeep
 *          4. Forwards CXProvider audio session events to RTCAudioSession
 *          When setPushConfig() is called with ios.pushProviderName, the SDK
 *          internally registers VoIP push event listeners (setupIosVoipPushEvents)
 *          and CallKit event listeners (setupIosCallKeepEvents) for accept/reject.
 *          The <StreamVideo> provider then runs useIosVoipPushEventsSetupEffect()
 *          which sends the VoIP device token to Stream via client.addVoipDevice().
 *
 * Android: Firebase Cloud Messaging → Notifee high-importance channel → Stream SDK
 *          Handled by setFirebaseListeners.android.ts (FCM + Notifee wiring).
 *          The SDK registers the FCM token via client.addDevice() automatically.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * IMPORTANT: This must be called OUTSIDE the React component tree — in index.js
 * before the app mounts — so configuration is available when the app is
 * opened from a push notification in a terminated state.
 *
 * EXTERNAL REQUIREMENTS (cannot be completed from code alone):
 * - Apple Developer portal: Enable Push Notifications + VoIP Services capabilities
 * - APNs: Create a VoIP Services certificate or .p8 key
 * - Stream Dashboard: Upload APNs credentials as provider "vibe-apn" (type: VoIP)
 * - Stream Dashboard: Upload FCM credentials as provider "vibe-firebase"
 * - Provisioning profiles must include VoIP entitlement
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { Platform } from "react-native";

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

  // ── createStreamVideoClient ──────────────────────────────────────────
  // Called by the SDK when a push arrives while the app is terminated.
  //
  // On iOS: A VoIP push wakes the app from terminated state. The native
  // AppDelegate receives the push via PushKit, shows CallKit UI, then
  // the JS bridge initializes and the SDK calls this function to get a
  // connected client so it can process the ringing call (accept/reject
  // from native UI, WS subscription for call state changes).
  //
  // On Android: A high-priority FCM data message wakes the app. The
  // background message handler (setFirebaseListeners.android.ts) routes
  // it to the SDK, which calls this function similarly.
  //
  // This function MUST:
  // 1. Return a connected StreamVideoClient as fast as possible
  // 2. Not throw — return undefined on failure (the SDK will not show
  //    the call or will show it without WS state tracking)
  // 3. Handle the case where Firebase auth state may not be hydrated yet
  const createStreamVideoClient = async () => {
    const tag = `[setPushConfig:createStreamVideoClient:${Platform.OS}]`;
    try {
      console.info(`${tag} Invoked — creating client for push wake`);

      const { fetchStreamToken } =
        require("@/services/stream/streamTokenProvider") as typeof import("@/services/stream/streamTokenProvider");
      const { getAuthInstance } =
        require("@/services/firebase") as typeof import("@/services/firebase");

      const currentUser = getAuthInstance().currentUser;
      if (!currentUser) {
        console.warn(`${tag} No authenticated user — cannot create client`);
        return undefined;
      }

      console.info(`${tag} Fetching Stream token for uid=${currentUser.uid}`);
      const { token, apiKey } = await fetchStreamToken();

      const client = StreamVideoClient.getOrCreateInstance({
        apiKey,
        user: { id: currentUser.uid },
        token,
        tokenProvider: async () => {
          const result = await fetchStreamToken();
          return result.token;
        },
        options: {
          logLevel: __DEV__ ? "info" : "warn",
          rejectCallWhenBusy: true,
        },
      });

      console.info(`${tag} Client ready`);
      return client;
    } catch (err) {
      console.error(`${tag} Failed:`, err);
      return undefined;
    }
  };

  StreamVideoRN.setPushConfig({
    // Inform the SDK this is an Expo project
    isExpo: true,

    ios: {
      // Must match the Push Provider name configured in the Stream Dashboard.
      // Stream sends VoIP pushes to this provider. The provider must be set up
      // in the Stream Dashboard with APNs VoIP credentials (certificate or .p8 key).
      pushProviderName: "vibe-apn",
    },

    android: {
      // Must match the Push Provider name configured in the Stream Dashboard.
      // The provider must be set up with FCM server key / service account.
      pushProviderName: "vibe-firebase",

      // Reuse the same drawable generated by expo-notifications so Stream's
      // Notifee-backed call notifications don't fall back to the launcher icon.
      smallIcon: "notification_icon",

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
    // See detailed comment above createStreamVideoClient.
    createStreamVideoClient,

    // Stream SDK 1.30+ watches ringing/joined calls from the root <StreamVideo>
    // provider via useCalls() and useIosVoipPushEventsSetupEffect(). There are
    // no navigateAcceptCall/navigateToIncomingCall callbacks — the SDK removed
    // those. IncomingCallHandler + native-accept adoption handle all navigation.
  });

  if (__DEV__) {
    console.info(
      `[setPushConfig] Configured for ${Platform.OS} — ` +
        `iOS provider: "vibe-apn" (VoIP/APNs), Android provider: "vibe-firebase" (FCM)`,
    );
  }
}
