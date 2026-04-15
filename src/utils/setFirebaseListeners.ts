/**
 * Firebase Notification Listeners — iOS stub
 *
 * iOS incoming calls use VoIP push (PushKit) + CallKit, NOT Firebase messaging.
 * The entire iOS push flow is handled by the Stream SDK + native AppDelegate code:
 *
 * 1. PushKit delivers VoIP push to the native layer (even when app is terminated)
 * 2. AppDelegate's pushRegistry:didReceiveIncomingPushWith: parses the Stream
 *    payload and calls RNCallKeep.reportNewIncomingCall() to show the CallKit UI
 * 3. The JS bridge initializes and the SDK's setupIosVoipPushEvents listener
 *    processes the push payload → creates a client → joins the call
 * 4. CallKit accept/reject actions are forwarded to the SDK via setupIosCallKeepEvents
 *
 * This is all set up by:
 * - setPushConfig.ts (ios.pushProviderName triggers SDK's internal VoIP setup)
 * - The Stream SDK Expo config plugin (injects native PushKit/CallKit code)
 * - react-native-voip-push-notification (PushKit bridge, already installed)
 * - react-native-callkeep (CallKit bridge, already installed)
 *
 * No Firebase call listeners are needed on iOS. FCM is used for non-call
 * notifications only.
 *
 * The Android-specific handlers are in setFirebaseListeners.android.ts.
 * React Native's platform-specific file resolution will pick the correct
 * file at bundle time.
 */

export const setFirebaseListeners = (): void => {
  // No Firebase call listeners needed on iOS — VoIP push handles incoming calls
};
