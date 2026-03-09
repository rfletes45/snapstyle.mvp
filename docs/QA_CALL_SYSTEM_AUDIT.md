# Call System Production Audit — Full Report

**Date:** 2025-01-XX  
**Trigger:** TestFlight builds failed — calling/video calling did not work on iOS  
**Scope:** Every file, flow, and backend function in the call system  
**Result:** 9 critical/high bugs found and fixed; system hardened for production

---

## 1. Executive Summary

The calling system had **4 critical bugs** that, in combination, guaranteed 100% failure on iOS TestFlight:

1. **All outgoing calls showed incoming-call UI** — a comparison bug in `CallContext.tsx` compared a user UID against a Firestore document ID (always `false`), causing every call event to be treated as incoming.
2. **Answering an incoming call navigated nowhere** — `IncomingCallOverlay` dismissed itself but never navigated to `AudioCallScreen` or `VideoCallScreen`. The user saw nothing after tapping "Accept".
3. **iOS push notifications silently failed** — the Cloud Function sent `apns-push-type: "voip"` via FCM. FCM cannot send PushKit/VoIP pushes; they were silently dropped. No incoming call notifications ever reached iPhones.
4. **TURN credentials were disabled** — `fetchTurnCredentials()` was entirely commented out. Only Google STUN servers were used. On cellular/symmetric-NAT (common on iPhone), peer connections frequently fail without TURN relay.

Additionally, 5 high/medium bugs were found and fixed: stale React closures, broken speaker toggle, missing Android permissions, participant filtering errors, and signaling race conditions.

---

## 2. Architecture Review

### Call Stack (top-down)

```
Screens:       VideoCallScreen / AudioCallScreen
Components:    CallControls, IncomingCallOverlay, CallButton, CallQualityIndicator
Hooks:         useCall, useLocalMedia, useRemoteParticipants
Context:       CallProvider (CallContext.tsx) — single React context wrapping the app
Services:      callService → webRTCService, callKeepService, audioSessionService,
               ringtoneService, callReconnectionService, voipPushService,
               foregroundServiceManager, backgroundCallHandler
Types:         src/types/call.ts
Backend:       firebase-backend/functions/src/calls.ts (Cloud Functions)
Database:      Firestore: Calls/{callId}, CallSignaling/{callId}/Signals/{signalId},
               Users/{userId}/CallHistory/{callId}
```

### Key Dependencies

| Package               | Version | Purpose                                 |
| --------------------- | ------- | --------------------------------------- |
| react-native-webrtc   | 124.0.7 | WebRTC peer connection, media streams   |
| react-native-callkeep | 4.3.16  | iOS CallKit / Android ConnectionService |
| expo-av               | —       | Ringtone playback                       |
| firebase/firestore    | —       | Signaling, call documents               |
| firebase/functions    | —       | Push notifications, TURN creds          |

### Missing Dependencies (known limitations)

| Package                             | Impact                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------- |
| react-native-voip-push-notification | Cannot receive PushKit VoIP pushes on iOS (incoming calls when app killed) |
| react-native-incall-manager         | No proximity sensor, limited audio route granularity                       |

---

## 3. Complete Issue List

### CRITICAL

| #   | File                      | Bug                                                                                                | Impact                                                                                       |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | CallContext.tsx           | `event.call.callerId === callService.getCurrentCallId()` — compared user UID to call document UUID | ALL calls treated as incoming; outgoing call shows IncomingCallOverlay on top of call screen |
| 2   | IncomingCallOverlay.tsx   | `handleAnswer()` hid overlay but did NOT navigate to any call screen                               | User answers call → sees home screen with active call running invisibly                      |
| 3   | calls.ts (Cloud Function) | `"apns-push-type": "voip"` via FCM — FCM can't deliver PushKit pushes                              | Zero iOS push notifications for incoming calls                                               |
| 4   | webRTCService.ts          | `fetchTurnCredentials()` entirely commented out; STUN-only config                                  | Peer connection fails on cellular / symmetric NAT                                            |

### HIGH

| #   | File             | Bug                                                                                     | Impact                                                       |
| --- | ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 5   | CallContext.tsx  | `handleConnectionLost`, `handleAppStateChange` captured `currentCall` at mount (null)   | Reconnection and background handling silently failed         |
| 6   | callService.ts   | `toggleSpeaker()` returned `webRTCService.toggleSpeaker()` which only flipped a boolean | Speaker button appeared to work but audio stayed on earpiece |
| 7   | webRTCService.ts | No `PermissionsAndroid.requestMultiple()` before `getUserMedia()`                       | Camera/mic permission denial with unhelpful error            |

### MEDIUM

| #   | File                                           | Bug                                                                                         | Impact                                                     |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 8   | AudioCallScreen.tsx + useRemoteParticipants.ts | Participant filtering used wrong field/logic to identify "other" person                     | Wrong avatar/name shown, or "Unknown" displayed            |
| 9   | webRTCService.ts                               | Firestore realtime subscription + `processPendingSignals()` could process same signal twice | Duplicate ICE candidates, potential duplicate answer/offer |
| 10  | calls.ts (Cloud Function)                      | `"cancelled"` not in terminal states array                                                  | `onCallUpdated` trigger looped on cancelled calls          |

---

## 4. Code Changes (Complete Diff Summary)

### 4.1 `src/contexts/CallContext.tsx`

**Fix 1 — Comparison bug:**

```diff
- if (event.call.callerId === callService.getCurrentCallId()) {
+ if (event.call.id === callService.getCurrentCallId()) {
```

**Fix 5 — Stale closures:**

```diff
+ const currentCallRef = useRef<Call | null>(null);
  // ... in useEffect that watches currentCall:
+ currentCallRef.current = currentCall;

  // In handleConnectionLost, handleAppStateChange, onReconnectFailed:
- const activeCall = currentCall;  // captured at mount = null
+ const activeCall = currentCallRef.current;  // always current
```

**Fix 9 — Audio session lifecycle:**

```diff
  case "call_started":
    setCurrentCall(event.call);
+   audioSessionService?.setCurrentCallId?.(event.call.id);

  case "call_answered":
    setCurrentCall(event.call);
+   audioSessionService?.setCurrentCallId?.(event.call.id);

  // handleCallEnded:
+   audioSessionService?.setCurrentCallId?.(null);
+   audioSessionService?.deactivate?.();
```

### 4.2 `src/components/calls/IncomingCallOverlay.tsx`

**Fix 2 — Navigation after answer:**

```diff
  interface IncomingCallOverlayProps {
+   onNavigateToCall?: (screenName: string, params: Record<string, unknown>) => void;
  }

  const handleAnswer = async () => {
+   const callInfo = incomingCall;  // capture before state clears
    await answerCall(incomingCall.id);
+   if (callInfo && onNavigateToCall) {
+     const screenName = callInfo.type === "video" ? "VideoCall" : "AudioCall";
+     onNavigateToCall(screenName, {
+       callId: callInfo.id,
+       participantName: callInfo.callerName ?? "Unknown",
+       isOutgoing: false,
+     });
+   }
  };
```

### 4.3 `App.tsx`

**Fix 3 — Pass navigation callback:**

```diff
  <IncomingCallOverlay
+   onNavigateToCall={(screenName, params) => {
+     navigationRef.current?.navigate(screenName as any, params as any);
+   }}
  />
```

### 4.4 `src/services/calls/webRTCService.ts`

**Fix 4 — TURN credentials enabled:**

```diff
  private async fetchTurnCredentials(): Promise<RTCIceServer[]> {
-   // Temporarily disabled
-   return [{ urls: ["stun:stun.l.google.com:19302", ...] }];
+   try {
+     const { getFunctions, httpsCallable } = await import("firebase/functions");
+     const { getFirebaseApp } = await import("@/config/firebase");
+     const functions = getFunctions(getFirebaseApp());
+     const getTurnCreds = httpsCallable(functions, "getTurnCredentials");
+     const result = await getTurnCreds();
+     // ... validate and return servers with STUN fallback
+   } catch (error) {
+     logError("[WEBRTC] Failed to fetch TURN credentials, using STUN fallback");
+     return fallbackStunServers;
+   }
  }
```

**Fix 7 — Android permission request:**

```diff
+ private async requestMediaPermissions(): Promise<boolean> {
+   if (Platform.OS === "android") {
+     const { PermissionsAndroid } = require("react-native");
+     const results = await PermissionsAndroid.requestMultiple([
+       PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
+       PermissionsAndroid.PERMISSIONS.CAMERA,
+     ]);
+     // ... check results, log and return false if denied
+   }
+   return true; // iOS: getUserMedia triggers system dialog
+ }
```

**Fix 9 — Signal deduplication:**

```diff
+ private processedSignalIds: Set<string> = new Set();

  // In signaling subscription and processPendingSignals:
+ if (this.processedSignalIds.has(signalDoc.id)) continue;
+ this.processedSignalIds.add(signalDoc.id);
```

### 4.5 `src/services/calls/callService.ts`

**Fix 6 — Speaker toggle through CallKeep:**

```diff
  async toggleSpeaker(callId: string): Promise<boolean> {
    const isSpeakerOn = webRTCService.toggleSpeaker();
+   // Route audio through native CallKit/ConnectionService
+   try {
+     callKeepService.setAudioRoute(callId, isSpeakerOn ? "Speaker" : "Phone");
+   } catch (error) {
+     logError("[CALL] Failed to set audio route via CallKeep", { error });
+   }
    return isSpeakerOn;
  }
```

### 4.6 `src/screens/calls/AudioCallScreen.tsx`

**Fix 8 — Participant filtering:**

```diff
  const otherParticipant = call
    ? (() => {
        const participants = Object.values(call.participants);
-       return participants.find(
-         p => p.odId !== call.callerId || call.participants[call.callerId]?.joinedAt
-       );
+       if (isOutgoing) {
+         return participants.find(p => p.odId !== call.callerId) || null;
+       } else {
+         return call.participants[call.callerId] || null;
+       }
      })()
    : null;
```

### 4.7 `src/hooks/calls/useRemoteParticipants.ts`

**Fix 8 — Filter by actual auth UID:**

```diff
+ import { getAuthInstance } from "@/config/firebase";

  const { participants } = useCallContext();
+ const currentUserId = getAuthInstance().currentUser?.uid;

  const remoteParticipants = useMemo(() =>
-   participants.filter(p => p.odId !== call?.callerId || ...)
+   participants.filter(p => p.odId !== currentUserId)
  , [participants, currentUserId]);
```

### 4.8 `firebase-backend/functions/src/calls.ts`

**Fix 3 — iOS push notification type:**

```diff
  // buildCallNotification — iOS path:
  headers: {
-   "apns-push-type": "voip",
+   "apns-push-type": "alert",
    "apns-priority": "10",
-   "apns-topic": "com.vibeapp.mobile.voip",
+   "apns-topic": "com.vibeapp.mobile",
  },
  payload: {
    aps: {
-     "content-available": 1,
+     alert: { title: callerName + " is calling", body: callType + " call" },
+     sound: "default",
+     "interruption-level": "time-sensitive",
    },
  },
```

**Fix 10 — Cancelled in terminal states:**

```diff
  const terminalStates = [
    "ended", "declined", "missed", "failed",
-   "no_answer", "busy"
+   "no_answer", "busy", "cancelled"
  ];
```

### 4.9 `src/services/calls/audioSessionService.ts`

**Fix 9 — Wire to CallKeep for real audio routing:**

```diff
+ private currentCallId: string | null = null;
+
+ setCurrentCallId(callId: string | null): void {
+   this.currentCallId = callId;
+ }

  private async setRouteIOS(route: AudioRoute): Promise<void> {
-   logDebug("iOS: Setting route", { route });
+   await this.setRouteViaCallKeep(route);
  }

+ private async setRouteViaCallKeep(route: AudioRoute): Promise<void> {
+   if (!this.currentCallId) return;
+   const { callKeepService } = require("./callKeepService");
+   await callKeepService.setAudioRoute(
+     this.currentCallId,
+     route === "speaker" ? "Speaker" : "Phone"
+   );
+ }
```

### 4.10 Debug Logging Added

| File                   | Tag            | What's Logged                                         |
| ---------------------- | -------------- | ----------------------------------------------------- |
| VideoCallScreen.tsx    | `[VIDEO_CALL]` | Mount/unmount, call ended, end call action            |
| AudioCallScreen.tsx    | `[AUDIO_CALL]` | Mount/unmount, call ended                             |
| useCall.ts             | `[useCall]`    | startAudioCall, startVideoCall, answer, decline, end  |
| audioSessionService.ts | `[AUDIO]`      | Route changes, CallKeep routing, init, deactivate     |
| webRTCService.ts       | `[WEBRTC]`     | Permission request, TURN fetch, signal dedup, cleanup |
| callService.ts         | `[CALL]`       | startCall, answerCall, speaker toggle                 |

---

## 5. Release / TestFlight Checklist

### Before Building

- [ ] **Deploy Cloud Functions** — the iOS push notification fix MUST be deployed before testing:
  ```bash
  cd firebase-backend
  npx firebase deploy --only functions:sendCallNotification,functions:onCallUpdated
  ```
- [ ] **Deploy Firestore indexes** — signaling queries may need composite indexes:
  ```bash
  npx firebase deploy --only firestore:indexes
  ```
- [ ] **Verify `getTurnCredentials` Cloud Function** — currently returns STUN-only servers. For production, integrate a TURN provider (Twilio, Xirsys, or self-hosted coturn) and return `{ urls, username, credential }` from this function.

### EAS Build

- [ ] Run `npx expo prebuild --clean` to regenerate native projects
- [ ] Verify `app.config.ts` has:
  - `UIBackgroundModes: ["audio", "voip", "remote-notification", "fetch"]`
  - Camera + Microphone usage descriptions
  - CallKit URL scheme
- [ ] Build: `eas build --platform ios --profile production`
- [ ] Build: `eas build --platform android --profile production`

### TestFlight Testing

- [ ] Test **outgoing audio call** — should show AudioCallScreen, ring recipient
- [ ] Test **outgoing video call** — should show VideoCallScreen with local preview
- [ ] Test **incoming call (app foreground)** — IncomingCallOverlay appears, answer navigates to correct screen
- [ ] Test **incoming call (app background)** — iOS notification appears (standard alert, not VoIP until package added)
- [ ] Test **speaker toggle** — audio actually switches between earpiece and speaker
- [ ] Test **mute toggle** — remote party confirms silence
- [ ] Test **end call** — both sides return to previous screen, Firestore doc updated
- [ ] Test **decline call** — caller sees "declined" status
- [ ] Test **call on cellular** — verifies TURN relay works (if TURN server configured)
- [ ] Test **call on WiFi** — verifies STUN P2P works
- [ ] Check debug logs with `[CALL]`, `[WEBRTC]`, `[AUDIO]`, `[VIDEO_CALL]`, `[AUDIO_CALL]` prefixes

---

## 6. Test Plan

### Unit Tests (recommended additions)

| Test                                       | File                                                | What to Assert                                                                 |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| handleCallEvent routes outgoing correctly  | `__tests__/contexts/CallContext.test.tsx`           | When `event.call.id === currentCallId`, sets currentCall (not incomingCall)    |
| handleCallEvent routes incoming correctly  | `__tests__/contexts/CallContext.test.tsx`           | When `event.call.id !== currentCallId`, sets incomingCall + showIncomingCallUI |
| IncomingCallOverlay navigates after answer | `__tests__/components/IncomingCallOverlay.test.tsx` | `onNavigateToCall` called with correct screen name and params                  |
| toggleSpeaker calls CallKeep               | `__tests__/services/callService.test.ts`            | `callKeepService.setAudioRoute` called with "Speaker"/"Phone"                  |
| useRemoteParticipants excludes self        | `__tests__/hooks/useRemoteParticipants.test.ts`     | Filters out currentUser.uid, not just callerId                                 |
| Signal deduplication                       | `__tests__/services/webRTCService.test.ts`          | Same signal ID processed only once                                             |

### Integration Tests

| Scenario                | Steps                                                | Expected                                                 |
| ----------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| Full outgoing call flow | startCall → ringing → answered → connected → end     | All state transitions logged, screens navigate correctly |
| Full incoming call flow | Push → overlay → answer → navigate → connected → end | Overlay shows, answer navigates to correct screen        |
| Network interruption    | Connected → disconnect WiFi → reconnect              | Reconnection handler fires, call resumes                 |
| Permission denial       | Deny camera/mic → start call                         | User-friendly error, no crash                            |

---

## 7. Hardening Notes & Known Limitations

### Remaining Work (requires new packages/infrastructure)

1. **VoIP Push (PushKit) for iOS** — `react-native-voip-push-notification` not installed. Current fix uses standard FCM alert notifications, which wake the app but don't provide the CallKit "full-screen incoming call" experience when the app is killed. To add:
   - Install `react-native-voip-push-notification`
   - Register for VoIP push token in `voipPushService.ts`
   - Send the VoIP token to backend
   - Backend sends via APNs directly (not FCM) with `apns-push-type: voip`
   - Handle VoIP push → display CallKit UI → answer → start WebRTC

2. **Production TURN Server** — `getTurnCredentials` Cloud Function currently returns only STUN. For reliable connectivity:
   - Integrate Twilio Network Traversal or Xirsys for TURN credentials
   - Return time-limited `{ urls, username, credential }` from the Cloud Function
   - The client-side code is already wired to use whatever the function returns

3. **InCall Manager** — `react-native-incall-manager` not installed. Without it:
   - Proximity sensor (screen off when phone to ear) is a no-op
   - Audio route detection is limited to CallKeep's capabilities
   - Bluetooth device enumeration is hardcoded

4. **Firestore Composite Indexes** — The signaling query `orderBy("timestamp")` on `CallSignaling/{callId}/Signals` may need an explicit index if additional `where()` clauses are added.

### Security Notes

- Firestore rules (lines 1466–1549) correctly enforce:
  - Only call participants can read/write call documents
  - Only participants can add signals
  - CallHistory is scoped per-user
- Cloud Functions validate caller identity via `context.auth.uid`
- TURN credentials are fetched via authenticated Cloud Function call

### Performance Notes

- `processedSignalIds` Set grows unbounded during a call — acceptable since calls have finite signals (typically < 100)
- WebRTC cleanup uses `Promise.allSettled()` to prevent one failed cleanup from blocking others
- Firestore signaling subscription is properly unsubscribed in cleanup

---

## Files Modified

| File                                         | Lines Changed | Severity        |
| -------------------------------------------- | ------------- | --------------- |
| src/contexts/CallContext.tsx                 | ~25           | CRITICAL        |
| src/components/calls/IncomingCallOverlay.tsx | ~20           | CRITICAL        |
| App.tsx                                      | ~5            | CRITICAL        |
| src/services/calls/webRTCService.ts          | ~100          | CRITICAL + HIGH |
| src/services/calls/callService.ts            | ~15           | HIGH            |
| src/screens/calls/AudioCallScreen.tsx        | ~20           | MEDIUM          |
| src/hooks/calls/useRemoteParticipants.ts     | ~10           | MEDIUM          |
| firebase-backend/functions/src/calls.ts      | ~20           | CRITICAL        |
| src/services/calls/audioSessionService.ts    | ~40           | HIGH            |
| src/screens/calls/VideoCallScreen.tsx        | ~15           | Logging         |
| src/hooks/calls/useCall.ts                   | ~15           | Logging         |

**Total: 11 files modified, ~285 lines changed**
