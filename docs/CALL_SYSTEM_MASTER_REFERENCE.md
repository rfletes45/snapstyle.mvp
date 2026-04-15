# Call System Master Reference

> **Version**: 1.6 — April 14, 2026
> **Authority**: This is the single source of truth for the call system. When this document conflicts with any other call-related documentation, this document wins. Previous docs (`calls-and-audio.md`, `CALL_SYSTEM_AUDIT_REFERENCE.md`, `QA_CALL_SYSTEM_AUDIT.md`, `QA_CALLING_AUDIT.md`, `QA_STREAM_CALL_SYSTEM.md`, `STREAM_SETUP_GUIDE.md`) are historical references only.
> **Verification**: Every claim in this document was verified against the live codebase on April 14, 2026. v1.6 is the iOS background/terminated incoming call delivery pass: corrects stale claims about iOS push architecture (the repo IS using VoIP push + CallKit via the Stream SDK — not FCM for iOS calls), adds diagnostic logging to setPushConfig and IncomingCallHandler native-accept adoption, enriches code comments to document the actual iOS/Android push separation, and documents the remaining manual Apple/Stream dashboard steps.

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Feature Inventory](#2-feature-inventory)
3. [File and Architecture Map](#3-file-and-architecture-map)
4. [End-to-End Lifecycle Flows](#4-end-to-end-lifecycle-flows)
5. [State Model](#5-state-model)
6. [Data Model and Backend Contract](#6-data-model-and-backend-contract)
7. [Navigation and UI Behavior](#7-navigation-and-ui-behavior)
8. [Permission and Device Behavior](#8-permission-and-device-behavior)
9. [Error Handling and Known Fragility Points](#9-error-handling-and-known-fragility-points)
10. [Behavioral Truth Table](#10-behavioral-truth-table)
11. [Known Gaps and Improvement Opportunities](#11-known-gaps-and-improvement-opportunities)
12. [Verification and Confidence Notes](#12-verification-and-confidence-notes)
13. [Testing Guidance for a Future Agent](#13-testing-guidance-for-a-future-agent)
14. [Concise Issue-Spotting Appendix](#14-concise-issue-spotting-appendix)

---

## 1. Executive Overview

### What the call system supports today

The app implements real-time audio and video calling powered by the **Stream Video React Native SDK**. The system supports three call modes:

1. **Direct 1:1 audio calls** — ringing calls between two users
2. **Direct 1:1 video calls** — ringing calls with camera/video between two users
3. **Group voice channels** — Discord-style open voice rooms attached to group chats (no ringing, join/leave model)

The **legacy Firestore/WebRTC call stack** (`firebase-backend/functions/src/calls.ts`) still exists in the codebase but is not used by any active client code. The entire active runtime uses Stream Video.

### High-level architecture

```
┌────────────────────────────────────────────────────────────┐
│                        App Root                            │
│  App.tsx                                                   │
│    └─ StreamCallProvider (StreamCallContext.tsx)            │
│         └─ <StreamVideo client={client}>                   │
│              ├─ IncomingCallHandler (root overlay)          │
│              ├─ FloatingVideoOverlay (PiP banner)           │
│              ├─ NativePiPBridge (native PiP for video)      │
│              └─ Navigation Stack                            │
│                   ├─ DirectCallScreen (fullScreenModal)     │
│                   ├─ VoiceChannelScreen (fullScreenModal)   │
│                   ├─ CallsScreen (tab)                      │
│                   └─ CallSettingsScreen                     │
└────────────────────────────────────────────────────────────┘

Backend:
  ├─ getStreamVideoToken (Cloud Function → mints Stream tokens)
  ├─ ensureStreamUsers (Cloud Function → provisions users in Stream)
  └─ streamCallWebhook (HTTPS → writes call history from Stream webhooks)

Stream Video:
  ├─ Media transport (SFU)
  ├─ Ringing state machine
  ├─ Participant state
  └─ Push token registration (via SDK provider)
```

### Design principles and constraints

- **One active media session at a time**: enforced by `busyRef` in `StreamCallContext`. The user cannot be in a direct call and a voice channel simultaneously.
- **Provider-level cleanup**: `StreamCallContext` subscribes to `callingState$` and clears session state on `LEFT`, `IDLE`, or `RECONNECTING_FAILED`. Individual screens do not own call disposal.
- **Feature-flagged**: All call code is gated behind `CALL_FEATURES.CALLS_ENABLED`, which auto-disables when Stream native modules are unavailable (Expo Go).
- **Lazy SDK loading**: Stream SDK is loaded via `require()` at runtime, not static imports, to prevent crashes in environments without native modules.
- **Server-authoritative history**: Call history is written exclusively by the `streamCallWebhook` Cloud Function processing Stream webhook events. The client never writes history documents directly.
- **No legacy signaling**: Despite `calls.ts` existing in the backend, no client code references Firestore-based call documents (`Calls/{callId}`) or WebRTC signaling (`CallSignaling/`). The file is now clearly marked `@deprecated` with a header explaining it is not exported from `index.ts`.

### Current maturity level

**Functional with stabilization fixes applied (v1.6)**:

- Core calling flows work end-to-end for direct audio, direct video, and voice channels
- UI is complete for audio calls, video calls, and voice rooms
- Connection quality badge shows degraded/reconnecting/poor states in both call screens
- Settings persistence works with correct cloud sync ordering; unwired settings hidden from UI with honest info rows
- iOS push delivery uses VoIP push (PushKit) + CallKit via the Stream SDK; requires external APNs/Stream dashboard config for full terminated-state delivery
- DND time pickers are functional (using `@react-native-community/datetimepicker`)
- Video quality and data saver preferences are wired to incoming video resolution via `callRuntime.ts`
- Join retry logic wired via `joinCallWithRetry()` with reconnect timeout policy
- Room discovery errors surfaced honestly in CallsScreen and GroupChatScreen
- Stream client initialization protected by mutex against concurrent init/destroy races (v1.5)
- Voice room occupancy polling protected by fetch guard against concurrent request races (v1.5)
- Incoming call accept failure now restores the pending call overlay so user can retry (v1.5)
- Settings sync timestamps written only after Firestore write succeeds, preventing sync divergence (v1.5)
- No deep linking to calls
- Dead screen-share props removed from CallControlBar (v1.4)

### Most fragile or important areas

1. **iOS push delivery in terminated state** — Repo-side VoIP push + CallKit integration is complete (Stream SDK handles PushKit/CallKeep internally). Requires Apple Developer portal VoIP entitlement, APNs credentials uploaded to Stream dashboard as provider `"vibe-apn"`, and real-device validation to confirm end-to-end delivery.
2. **Race conditions in DirectCallScreen and VoiceChannelScreen effects** — multiple effects interact with call state; mitigated by `endedRef` guard on auto-dismiss and `endingRef` idempotency in context (v1.1)
3. **callSessionManager audio session lifecycle** — `callManager.start()` / `callManager.stop()` must be paired; mismatches leave audio routing in wrong state
4. **Voice channel join effect re-triggering** — complex dependency array can cause unintended re-joins; `joinAttemptedRef` resets on failure (v1.1); error UI now has Retry + Go Back buttons (v1.3)
5. **Token cache concurrency** — `fetchStreamToken()` now has an in-flight promise lock preventing duplicate requests (v1.1)
6. **Stream client init race** — `initStreamClient()` now has a mutex (`initPromise`) preventing concurrent init/destroy cycles during rapid login/logout (v1.5)
7. **Settings sync divergence** — Firestore write timestamp only persisted locally after successful cloud write, preventing stale-cloud data from being permanently ignored (v1.5)

---

## 2. Feature Inventory

### Implemented

| Feature                                             | Status         | Evidence                                                                                                                                                                                                                         |
| --------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1:1 audio calls with ringing                        | ✅ Implemented | `directCallService.ts`, `DirectCallScreen.tsx`                                                                                                                                                                                   |
| 1:1 video calls with ringing                        | ✅ Implemented | `directCallService.ts`, `DirectCallScreen.tsx`                                                                                                                                                                                   |
| Group voice channels (join/leave)                   | ✅ Implemented | `voiceChannelService.ts`, `VoiceChannelScreen.tsx`                                                                                                                                                                               |
| Incoming call overlay (in-app)                      | ✅ Implemented | `IncomingCallHandler.tsx`                                                                                                                                                                                                        |
| Native-accepted call adoption                       | ✅ Implemented | `IncomingCallHandler.tsx` native accept effect                                                                                                                                                                                   |
| Call history (server-written)                       | ✅ Implemented | `streamCallWebhook`, `streamCallHistoryService.ts`                                                                                                                                                                               |
| Call history filtering                              | ✅ Implemented | all/missed/direct/rooms filters                                                                                                                                                                                                  |
| Call history profile enrichment                     | ✅ Implemented | `useStreamCallHistory.ts` resolves "Unknown" names                                                                                                                                                                               |
| Mute/unmute microphone                              | ✅ Implemented | `CallControlBar.tsx`, `call.microphone.toggle()`                                                                                                                                                                                 |
| Camera toggle                                       | ✅ Implemented | Direct + voice screens                                                                                                                                                                                                           |
| Camera flip                                         | ✅ Implemented | Direct + voice screens                                                                                                                                                                                                           |
| Speaker toggle                                      | ✅ Implemented | `callManager.speaker.setForceSpeakerphoneOn()`                                                                                                                                                                                   |
| Audio route picker (Android)                        | ✅ Implemented | `AudioRoutePicker.tsx` modal with device list                                                                                                                                                                                    |
| Audio route picker (iOS)                            | ✅ Implemented | iOS native device selector via `callManager.ios`                                                                                                                                                                                 |
| Call settings persistence                           | ✅ Implemented | `callSettingsService.ts`, AsyncStorage + Firestore                                                                                                                                                                               |
| DND (Do Not Disturb) gating                         | ✅ Implemented | `callSettingsService.shouldAllowCall()`                                                                                                                                                                                          |
| Privacy: Allow calls from (everyone/friends/nobody) | ✅ Implemented | `callSettingsService.shouldAllowCall()`                                                                                                                                                                                          |
| Auto-reject when busy                               | ✅ Implemented | `IncomingCallHandler.tsx` sends `"busy"` rejection                                                                                                                                                                               |
| Outgoing ringtone playback                          | ✅ Implemented | `ringtoneService.ts`, DirectCallScreen effect                                                                                                                                                                                    |
| Incoming ringtone + vibration                       | ✅ Implemented | `ringtoneService.ts`, IncomingCallHandler effect                                                                                                                                                                                 |
| Room join sound effect                              | ✅ Implemented | `ringtoneService.playSoundEffect("room_join")`                                                                                                                                                                                   |
| Active voice room discovery                         | ✅ Implemented | `useActiveVoiceRooms.ts` polling                                                                                                                                                                                                 |
| Voice room occupancy display                        | ✅ Implemented | `useVoiceRoomOccupancy.ts`, `VoiceChannelCard.tsx`                                                                                                                                                                               |
| Floating video overlay (PiP banner)                 | ✅ Implemented | `FloatingVideoOverlay.tsx`                                                                                                                                                                                                       |
| Native PiP (iOS RTCViewPipIOS)                      | ✅ Implemented | `NativePiPBridge.tsx`                                                                                                                                                                                                            |
| Android auto-enter PiP                              | ✅ Implemented | `useAutoEnterPiPEffect` in NativePiPBridge                                                                                                                                                                                       |
| Call duration timer                                 | ✅ Implemented | 1-second interval in both call screens                                                                                                                                                                                           |
| Participant grid (voice rooms)                      | ✅ Implemented | FlatList grid in VoiceChannelScreen                                                                                                                                                                                              |
| Client-side ringing timeout                         | ✅ Implemented | 60-second timeout in DirectCallScreen                                                                                                                                                                                            |
| Stream client init/teardown on auth                 | ✅ Implemented | `StreamCallProvider`, `initStreamClient`/`destroyStreamClient`                                                                                                                                                                   |
| Push config for background calls                    | ✅ Implemented | `setPushConfig.ts` — iOS: VoIP push via PushKit + CallKit (provider `"vibe-apn"`). Android: FCM + Notifee (provider `"vibe-firebase"`).                                                                                          |
| iOS VoIP push + CallKit (code-complete)             | ✅ Implemented | Stream SDK handles PushKit token registration, VoIP push reception, CallKit UI, accept/reject, audio session forwarding. Expo plugin injects native AppDelegate code. External APNs/Stream dashboard setup required — see §11.8. |
| Video defaults from settings                        | ✅ Implemented | `camera_default_on` from `callSettingsService.getCallConfig()`                                                                                                                                                                   |
| Audio output defaults from settings                 | ✅ Implemented | `defaultOutput` from `callSettingsService.getCallConfig()`                                                                                                                                                                       |
| DND schedule UI                                     | ✅ Implemented | Toggle, day-of-week, and start/end time pickers all functional (`@react-native-community/datetimepicker`)                                                                                                                        |

### Partially implemented (stored-only or incomplete wiring)

| Feature                                     | Status         | Details                                                                                                                                                                                                                                    |
| ------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Noise suppression / Echo cancellation / AGC | ⚠️ Stored only | Settings saved to Firestore but not wired to SDK. `@stream-io/noise-cancellation-react-native` is NOT installed. Echo cancellation and AGC are handled by the platform WebRTC stack at the OS level; these toggles have no runtime effect. |
| Ringtone selection                          | ⚠️ Stored only | `ringtone` setting stored; `startRingtone` reads the preference and skips playback for `silent`/`vibrate_only` modes, but only the single default sound asset plays for `default`. No alternative ringtones bundled.                       |
| Custom ringtone URI                         | ⚠️ Stored only | `customRingtoneUri` field exists; `startRingtone` will attempt to use it when `ringtone === "custom"`, but no file picker UI lets the user set a URI.                                                                                      |
| Video quality setting                       | ✅ Implemented | `preferredVideoQuality` and `dataSaverMode` applied to incoming video resolution via `callRuntime.ts` `applyCallMediaPreferences()`. Maps auto/high/medium/low to 720p/480p/240p resolution caps.                                          |
| WiFi-only video                             | ⚠️ Stored only | `wifiOnlyVideo` saved but not applied. Would require `NetInfo` check before enabling camera.                                                                                                                                               |
| Flash on ring                               | ⚠️ Stored only | Accessibility setting saved but not wired. Would require native torch/LED API.                                                                                                                                                             |
| Haptic feedback                             | ⚠️ Stored only | Setting saved but not wired to Haptics API                                                                                                                                                                                                 |
| Large controls                              | ⚠️ Stored only | Setting saved but not wired to UI sizing                                                                                                                                                                                                   |
| Announce caller name                        | ⚠️ Stored only | Setting saved but not wired to TTS                                                                                                                                                                                                         |
| Show call preview                           | ⚠️ Stored only | Setting saved but not wired to preview UI                                                                                                                                                                                                  |
| Screen share                                | 🚫 Removed     | Dead `showScreenShare` props removed from `CallControlBar` in v1.4. Feature requires native iOS broadcast extension + Android foreground service configuration. No UI or dead code path remains.                                           |

### Deprecated / Legacy (still in codebase)

| Feature                        | Status                   | Details                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firestore/WebRTC call system   | 🚫 Deprecated            | `firebase-backend/functions/src/calls.ts` — 11 Cloud Functions for Firestore-based signaling. Not referenced by any active client code.                                                                                           |
| CallKeep / CallKit integration | ✅ Active (SDK-internal) | `react-native-callkeep` v4.3.16 installed. Used internally by Stream SDK for iOS CallKit (accept/reject from native UI, audio session forwarding). Expo plugin `@config-plugins/react-native-callkeep` adds CallKit entitlements. |
| WebRTC service                 | 🚫 Removed               | `webRTCService.ts` referenced in QA docs but not found in current codebase                                                                                                                                                        |
| Legacy call context            | 🚫 Removed               | Old `CallContext.tsx` replaced by `StreamCallContext.tsx`                                                                                                                                                                         |

---

## 3. File and Architecture Map

### Core Provider

| File                                              | Purpose                                                                                                                                                                                                                                 | Depends on                                                                                                                                                                                                                              | Depended on by                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/contexts/StreamCallContext.tsx` (~415 lines) | Central call state provider. Owns `ActiveMediaSession`, `activeCall`, and all call actions (`startCall`, `acceptCall`, `rejectCall`, `endCall`, `joinChannel`, `leaveChannel`). Wraps children in `<StreamVideo>` when client is ready. | `AuthContext`, `UserContext`, `initStreamClient`, `destroyStreamClient`, `startDirectCall`, `acceptDirectCall`, `rejectDirectCall`, `endDirectCall`, `joinVoiceChannel`, `leaveVoiceChannel`, `clearTokenCache`, `stopCallAudioSession` | Every call screen, component, and hook that uses `useStreamCall()` |

**Key caveats**:

- Uses both `useState` (`activeSession`) and `useRef` (`busyRef`, `activeCallRef`) for state. The ref is the synchronous gate for preventing double-starts; the state drives re-renders.
- Subscribes to `callingState$` on the active call to auto-cleanup on `LEFT`/`IDLE`/`RECONNECTING_FAILED`.
- On logout (`currentUserId` becomes null): destroys Stream client, clears token cache, nulls `client` state.
- Provides a noop context value when calls are disabled or client not ready (`isReady: false`).
- The `deliberatelyLeftChannelsRef` tracks voice channels the user explicitly left, preventing auto-rejoin on screen re-mount.

### Stream Services (`src/services/stream/`)

| File                                       | Purpose                                  | Key exports                                                                                                           | Caveats                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `streamClient.ts` (~130 lines)             | Singleton `StreamVideoClient` management | `initStreamClient()`, `destroyStreamClient()`, `getStreamClient()`, `getStreamClientOrNull()`                         | Calls `StreamVideoRN.onPushLogout()` and `client.disconnectUser()` on destroy. Tears down previous client on user switch. Uses `initPromise` mutex to prevent concurrent init/destroy races (v1.5).                                                                                                             |
| `streamTokenProvider.ts` (~80 lines)       | Token fetching and caching               | `fetchStreamToken()`, `streamTokenProvider()`, `getCachedApiKey()`, `clearTokenCache()`                               | Module-scoped `cachedApiKey` variable. No built-in token refresh logic — relies on Stream SDK calling `tokenProvider` callback when needed.                                                                                                                                                                     |
| `streamUserProvisioning.ts` (~70 lines)    | Batch user registration in Stream        | `ensureStreamUsersExist(userIds)`                                                                                     | Calls `ensureStreamUsers` Cloud Function. Deduplicates and validates IDs. Throws if all IDs invalid. No batch size limit (backend limits to 25).                                                                                                                                                                |
| `directCallService.ts` (~300 lines)        | 1:1 call lifecycle                       | `startDirectCall()`, `acceptDirectCall()`, `rejectDirectCall()`, `endDirectCall()`                                    | Provisions users, requests permissions, creates call with `getOrCreate({ring: true})`, starts audio session, watches for join to enable devices. Caller does NOT manually `join()` — Stream auto-joins when callee accepts. Uses `callRuntime` for retry, reconnect policy, and media preferences.              |
| `voiceChannelService.ts` (~200 lines)      | Group voice channel lifecycle            | `joinVoiceChannel()`, `leaveVoiceChannel()`, `queryVoiceChannel()`                                                    | Uses `default` call type (NOT `audio_room`). Deterministic ID: `voice_channel_{groupId}`. `queryVoiceChannel` uses low-level `client.streamClient.post("/calls")` to avoid device config side effects. Returns typed `VoiceChannelQueryResult` discriminated union. Uses `callRuntime` for retry and reconnect. |
| `callRuntime.ts` (~100 lines)              | Shared call runtime helpers              | `applyCallReconnectPolicy()`, `applyCallMediaPreferences()`, `applyPreferredCameraDirection()`, `joinCallWithRetry()` | Applies 45s disconnection timeout, preferred incoming video resolution (based on quality/data-saver settings), preferred camera direction, and join with 4 max retries. Used by both direct call and voice channel services.                                                                                    |
| `callSessionManager.ts` (~85 lines)        | Native audio session management          | `requestCallPermissions()`, `startCallAudioSession(endpoint)`, `stopCallAudioSession()`                               | Wraps `callManager.start({audioRole: "communicator", deviceEndpointType})` and `callManager.stop()`. Microphone permission is required (throws); camera permission is best-effort.                                                                                                                              |
| `callSettingsValidator.ts` (~60 lines)     | Input sanitization                       | `sanitizeSettingsOverride()`, `validateParticipantIds()`                                                              | Clamps video resolution to [240, 3840], bitrate to [0, 6M]. Different error behavior in `__DEV__` vs production for participant validation.                                                                                                                                                                     |
| `voiceChannelIds.ts` (~25 lines)           | Channel ID generation                    | `getVoiceChannelId(groupId)`                                                                                          | Simple template: `voice_channel_${groupId}`. No validation.                                                                                                                                                                                                                                                     |
| `streamCallHistoryService.ts` (~120 lines) | History fetch/subscribe                  | `getStreamCallHistory(filter?)`, `subscribeToStreamCallHistory(onUpdate, maxResults?, onError?)`                      | Queries `Users/{uid}/StreamCallHistory`. Returns empty if no auth. No document validation — raw cast.                                                                                                                                                                                                           |
| `streamUtils.ts` (~50 lines)               | Device mapping                           | `toStreamDevice(output)`                                                                                              | Maps `AudioOutput` → `"speaker"` or `"earpiece"`. Silent fallback to `"speaker"` for unknown inputs.                                                                                                                                                                                                            |
| `index.ts` (~50 lines)                     | Barrel re-exports                        | All of the above                                                                                                      | —                                                                                                                                                                                                                                                                                                               |

### Call Settings (`src/services/calls/`)

| File                                  | Purpose                     | Key exports                                                                                                                                                          | Caveats                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `callSettingsService.ts` (~430 lines) | Persistent call preferences | Singleton `callSettingsService` with `loadSettings()`, `updateSettings()`, `shouldAllowCall()`, `getCallConfig()`, `isDNDCurrentlyActive()`, + 24 individual setters | Dual storage: AsyncStorage (local, `@call_settings`) + Firestore (cloud, `Users/{uid}/Settings/calls`). DND check runs every 60 seconds + on AppState change. Uses `JSON.parse(JSON.stringify())` to strip `undefined` before Firestore writes. `_lastUpdatedAt` timestamp written to AsyncStorage only after successful Firestore write, preventing sync divergence when cloud writes fail (v1.5). |
| `ringtoneService.ts` (~200 lines)     | Ringtone and vibration      | `startRingtone(type, vibrate?, loop?)`, `stopRingtone()`, `playSoundEffect(type)`                                                                                    | Uses `expo-audio` lazy-loaded. Vibration pattern: `[0, 800, 600, 800, 600]` repeating. Audio mode: `playsInSilentMode: true, interruptionMode: "mixWithOthers"`. Reads volume/ringtone prefs from `callSettingsService`.                                                                                                                                                                            |

### Screens (`src/screens/`)

| File                                  | Purpose                         | Key behaviors                                                                                                                                                                                                              | Caveats                                                                                                                                      |
| ------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DirectCallScreen.tsx` (~600 lines)   | Active 1:1 call UI              | Two render branches: video (full-screen remote + local PiP) and audio (avatar + status). 10 effects for: Android audio sync, speaker init, auto-dismiss, ringtone, ringing state, timeout, duration timer, PiP management. | `endedRef` gate prevents double-end. 60s client-side ringing timeout. Auto-navigates back 500ms after `activeCall` becomes null.             |
| `VoiceChannelScreen.tsx` (~560 lines) | Group voice room UI             | Participant grid (2-3 columns), join on mount, room join sound. Multiple refs: `joinAttemptedRef`, `mountedRef`, `hasSeenActiveCallRef`, `leavingRef`.                                                                     | `joinAttemptedRef` resets on failure (v1.1); error UI has Retry + Go Back buttons (v1.3). Auto-leaves 250ms after `activeCall` becomes null. |
| `CallsScreen.tsx` (~320 lines)        | Call history + active rooms tab | Combines `useActiveVoiceRooms()` + `useStreamCallHistory(filter)`. Pull-to-refresh. Filter chips. Inline error/partial-failure states with Retry for active rooms. Navigation to VoiceChannel, GroupChat, or ChatDetail.   | `prepareGroupChatNavigation` called but not awaited.                                                                                         |
| `CallSettingsScreen.tsx` (~250 lines) | Call preferences UI             | 8 settings sections. Picker via `Alert.alert()` option list. DND schedule with day-of-week toggles and functional time pickers.                                                                                            | Error state with retry on settings load failure. Reset requires confirmation but shows no success feedback.                                  |

### Components (`src/components/stream/`)

| File                                    | Purpose                            | Key behaviors                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IncomingCallHandler.tsx` (~330 lines)  | Root-level incoming call overlay   | Filters `useCalls()` for RINGING + `!isCreatedByMe` calls. Runs DND/privacy checks via `callSettingsService.shouldAllowCall()`. Plays ringtone while displayed. Auto-rejects when busy. Adopts native-accepted calls (JOINING/JOINED without prior context state). `acceptingRef` prevents race between accept flow and auto-reject effect. On accept failure, restores pending call if still RINGING so user can retry (v1.5). |
| `CallControlBar.tsx` (~140 lines)       | Shared call controls bar           | Pure presentational. Renders mic, camera, flip, speaker, and leave buttons. All callbacks from parent. `ControlPill` subcomponent with press animations. Screen share props removed in v1.4.                                                                                                                                                                                                                                    |
| `AudioRoutePicker.tsx` (~120 lines)     | Audio output selection modal       | iOS: delegates to native picker (`callManager.ios.showDeviceSelector`), returns null. Android: modal with device list from `callManager.android.getAudioDeviceStatus()`. Live device change listener. `applyAudioRoute()` exported for simpler toggle scenarios.                                                                                                                                                                |
| `FloatingVideoOverlay.tsx` (~180 lines) | PiP/minimized call banner          | Draggable (PanResponder). Two modes: `FloatingAudioBanner` (pill for audio calls with end-call button) and `FloatingVideoContent` (video PiP with minimize). Snaps to screen edge on release. Hidden when on call screen, in native PiP, or no active direct call.                                                                                                                                                              |
| `CallConnectionBadge.tsx` (~90 lines)   | Connection quality badge           | Shows contextual badges for RECONNECTING, MIGRATING, OFFLINE, RECONNECTING_FAILED, and POOR connection quality. Color-coded (warning/error). Only visible when connection is degraded — hidden when healthy. Used in both DirectCallScreen and VoiceChannelScreen.                                                                                                                                                              |
| `NativePiPBridge.tsx` (~80 lines)       | Native PiP mode bridge             | Only mounts for video direct calls. Uses `useAutoEnterPiPEffect` (Android) and `RTCViewPipIOS` (iOS). Renders iOS PiP in JOINED, RECONNECTING, MIGRATING, OFFLINE, RECONNECTING_FAILED states.                                                                                                                                                                                                                                  |
| `DirectCallButton.tsx` (~100 lines)     | Call initiation button             | Audio and/or video buttons. `starting` state prevents rapid clicks. Shows Alert on busy or error. Returns null if `CALLS_ENABLED` is false.                                                                                                                                                                                                                                                                                     |
| `ActiveRoomCard.tsx` (~130 lines)       | Active voice room preview card     | Pulsing live indicator. Stacked avatars (max 4 visible + overflow). "Join" / "Return" / "In Call" button. Disabled with opacity if busy in another call.                                                                                                                                                                                                                                                                        |
| `VoiceChannelCard.tsx` (~110 lines)     | Voice channel entry point in group | Uses `useVoiceRoomOccupancy()` hook for occupancy data (single source of truth — no self-polling). Shows occupant list (max 5). Loading and error states. "Join Voice" / "Connected" / "In another call" button. Green border when active.                                                                                                                                                                                      |
| `CallHistoryRow.tsx` (~140 lines)       | History list row                   | Status, duration, timestamp display. Tap to navigate to relevant chat.                                                                                                                                                                                                                                                                                                                                                          |
| `VoiceRoomAvatarStack.tsx` (~90 lines)  | Compact avatar stack               | Overlapping circles with configurable max visible.                                                                                                                                                                                                                                                                                                                                                                              |

### Hooks (`src/hooks/`)

| File                                    | Purpose                     | Key behaviors                                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useStreamCallHistory.ts` (~130 lines)  | Call history data           | Fetches/subscribes history via service. Enriches profiles with `getCachedProfile` fallback. "all" filter uses real-time subscription; others use one-time fetch. `mountedRef` guards stale updates.                                                                                                                    |
| `useActiveVoiceRooms.ts` (~170 lines)   | Active voice room discovery | Polls every 15s with ±20% jitter (v1.3). Discovers up to 25 groups, queries each for active voice channel. AppState-aware (pauses when backgrounded). Returns `error`, `errorMessage`, `hasPartialFailures`, `lastUpdatedAt`. Uses `fetchingRef` to prevent concurrent fetches. Manual `refresh()` bypasses debounce.  |
| `useVoiceRoomOccupancy.ts` (~170 lines) | Single room occupancy       | Polls every 8s with ±20% jitter (v1.3) via `queryVoiceChannel()`. Derives `isActive`, `isCurrentUserInRoom`, `loading`, `error`, `errorMessage`, `status`, `lastUpdatedAt`. Sorts occupants by userId for stability. Uses `fetchingRef` to prevent concurrent fetches (v1.5). Preserves last-known occupants on error. |

### Types (`src/types/`)

| File                   | Key types                                                                                                                                                                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `streamCall.ts`        | `DirectCallMode` ("audio" \| "video"), `VoiceChannelMode`, `DirectCallStatus`, `VoiceChannelStatus`, `StreamParticipantInfo`, `DirectCallParams`, `VoiceChannelParams`, `ActiveMediaSession` (discriminated union: direct_call \| voice_channel \| null)                                            |
| `streamCallHistory.ts` | `CallEntryType` ("direct_audio" \| "direct_video" \| "voice_room"), `CallDirection` ("incoming" \| "outgoing" \| "joined"), `CallResult` ("completed" \| "missed" \| "declined" \| "canceled" \| "left" \| "ongoing"), `StreamCallHistoryEntry`, `CallHistoryFilterType`, `StreamCallHistoryFilter` |
| `callSettings.ts`      | Full settings interface with: video config, audio config, notifications, DND schedule, privacy, quality, accessibility                                                                                                                                                                              |

### Backend (`firebase-backend/functions/src/`)

| File                   | Purpose                              | Active?                                                             |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| `streamToken.ts`       | Mint Stream tokens + provision users | ✅ Active                                                           |
| `streamCallHistory.ts` | Webhook → Firestore history          | ✅ Active                                                           |
| `calls.ts`             | Legacy Firestore/WebRTC call system  | 🚫 Inactive (no client references)                                  |
| `notifications.ts`     | App notification dispatch            | ✅ Active (general notifications, not call-specific in Stream flow) |

### Configuration & Utilities

| File                                | Purpose                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/utils/setPushConfig.ts`        | Configures `StreamVideoRN.setPushConfig()` before React tree mounts. Defines Android FCM channels, iOS VoIP provider name (`"vibe-apn"`), and background client creation callback. On iOS, this triggers the SDK's internal VoIP push + CallKit listener setup. Includes platform-tagged diagnostic logging for push wake debugging. |
| `src/utils/setFirebaseListeners.ts` | iOS: no-op stub (iOS uses VoIP push, not FCM for calls). Android: `.android.ts` variant wires FCM background/foreground handlers + Notifee event handlers to Stream SDK. Platform file resolution selects correct variant at bundle time.                                                                                            |
| `src/utils/permissions.ts`          | `requestMicrophonePermission()`, `requestCameraPermission()` — platform-aware permission prompts                                                                                                                                                                                                                                     |
| `constants/featureFlags.ts`         | `CALL_FEATURES.CALLS_ENABLED` (auto-detects Stream native modules), `CALL_FEATURES.DIRECT_CALLS_ENABLED` (hardcoded true)                                                                                                                                                                                                            |

---

## 4. End-to-End Lifecycle Flows

### 4.1 Starting an outgoing direct call

**Entry points**: `DirectCallButton.tsx` (DM header, profile screen), call history re-call

**Step-by-step**:

1. User taps audio or video call button in `DirectCallButton`
2. `DirectCallButton.handleCall()` checks `isBusy` (from context), shows Alert if true
3. Sets `starting=true` to prevent double-tap
4. Calls `startCall(recipientId, mode, recipientName)` from `useStreamCall()`
5. **StreamCallContext.startCallAction**:
   - Checks `busyRef.current` — throws if already busy
   - Sets `busyRef.current = true` synchronously
   - Generates UUID for `callId`
   - Calls `startDirectCall(callId, userId, recipientId, mode)`
6. **directCallService.startDirectCall**:
   - Reads call config from `callSettingsService.getCallConfig()`
   - Validates participant IDs via `validateParticipantIds()`
   - Best-effort provisions both users in Stream via `ensureStreamUsersExist()`
   - Requests microphone permission (required, throws if denied)
   - Requests camera permission if video mode and `startEnabled` (non-fatal if denied)
   - Creates `call = client.call("default", callId)`
   - Calls `call.getOrCreate({ ring: true, video: mode === "video", data: { members, custom: { mode } } })`
   - Starts native audio session via `startCallAudioSession(deviceEndpoint)`
   - Sets up `watchLocalDeviceSetupOnJoin()` — subscribes to `callingState$` and enables mic/camera when state reaches JOINED
   - Returns `Call` object
7. Back in context: stores `call` in `activeCallRef` + `activeCall` state, sets `activeSession` to `{ type: "direct_call", callId, recipientName, mode }`
8. Back in `DirectCallButton`: calls `onCallStarted(callId)` callback
9. Parent navigates to `DirectCallScreen` with callId, recipientName, mode, isOutgoing=true
10. `DirectCallScreen` mounts, renders ringing UI with pulsing avatar
11. Outgoing ringtone starts playing (200ms delay to let audio session settle)
12. 60-second client-side timeout starts — auto-ends call if unanswered

**Important**: The caller does NOT call `call.join()`. Stream auto-joins the caller when the callee accepts.

### 4.2 Receiving an incoming direct call

**Entry point**: `IncomingCallHandler.tsx` (mounted at app root)

**Step-by-step**:

1. Stream SDK delivers incoming call via `useCalls()` hook
2. `IncomingCallHandler` filters for `callingState === RINGING && !isCreatedByMe`
3. If call already JOINING/JOINED (native accept via CallKit): adopts immediately:
   - Sets `acceptingRef = true`
   - Calls `acceptCall(call)` from context
   - Navigates to DirectCallScreen
   - Skips showing in-app UI
4. Otherwise, sets `pendingCall` state
5. Runs DND/privacy check asynchronously:
   - Calls `callSettingsService.shouldAllowCall(callerId, isFriend)`
   - If DND active or caller not in allowed list: auto-rejects with `"decline"`
   - If check fails: fails open (allows call through)
6. If allowed (`callAllowed === true`): renders incoming call overlay
7. Starts incoming ringtone with vibration

**Accept flow**:

1. User taps accept button
2. `handleAccept()` sets `acceptingRef = true` and clears `pendingCall`
3. Calls `acceptCall(call)` from context
4. **StreamCallContext.acceptCallAction**:
   - Checks `busyRef.current` — if busy, rejects with "busy"
   - Sets `busyRef.current = true`
   - Reads call mode from `call.state.custom?.mode`
   - Calls `acceptDirectCall(call, mode)`
5. **directCallService.acceptDirectCall**:
   - Reads config for camera default
   - Requests permissions (mic required, camera best-effort)
   - Starts audio session with appropriate device
   - Calls `call.join()` if not already JOINING/JOINED
   - Enables local mic/camera via `ensureLocalDevices()`
6. Context stores call in refs/state, sets `activeSession`
7. `onNavigateToCall(callId, mode)` navigates to DirectCallScreen
8. **On accept failure** (v1.5): If `acceptCall()` throws and the call is still RINGING, `pendingCall` is restored with `callAllowed=true` so the incoming call overlay re-appears and the user can retry or decline.

**Decline flow**:

1. User taps decline button
2. Calls `rejectCall(pendingCall, "decline")` from context
3. **directCallService.rejectDirectCall**: `call.leave({ reject: true, reason: "decline" })`, then `stopCallAudioSession()`

**Auto-reject when busy**:

- Effect in `IncomingCallHandler` checks `isBusy && activeSession && pendingCall`
- Rejects with `"busy"` reason
- `acceptingRef` guard prevents rejecting a call that's currently being accepted

### 4.3 Ending a direct call

**Entry points**: End button in `DirectCallScreen`, remote hangup

**User-initiated end**:

1. User taps leave/end button
2. `DirectCallScreen.handleEndCall()` checks `endedRef` gate
3. Sets `endedRef.current = true`
4. Calls `endCall()` from context
5. **StreamCallContext.endCallAction**:
   - Reads `activeCallRef.current`
   - Immediately clears: `activeCallRef = null`, `busyRef = false`, `activeCall = null`, `activeSession = null`
   - Calls `endDirectCall(call)` (best-effort, catch-all)
6. **directCallService.endDirectCall**:
   - If RINGING state: uses `call.leave({ reject: true, reason })` where reason is `"cancel"` (caller) or `"decline"` (callee)
   - If JOINED state: uses `call.endCall()` with fallback to `call.leave()`
   - Always calls `stopCallAudioSession()` in finally block
7. Navigation: `handleEndCall` always calls `navigation.goBack()` regardless of success/failure

**Remote hangup / provider cleanup**:

1. `callingState$` subscription in `StreamCallContext` detects `LEFT`, `IDLE`, or `RECONNECTING_FAILED`
2. Clears `activeCallRef`, `busyRef`, `activeCall`, `activeSession`
3. Calls `stopCallAudioSession()`
4. `DirectCallScreen` auto-dismiss effect detects `activeCall === null`
5. 500ms delay → `navigation.goBack()`

### 4.4 Joining a voice channel

**Entry points**: `VoiceChannelCard` (in group info), `ActiveRoomCard` (in CallsScreen), navigation from group chat

**Step-by-step**:

1. User taps "Join Voice" button
2. Parent navigates to `VoiceChannelScreen` with `channelId`, `channelName`, `groupId`
3. `VoiceChannelScreen` mounts, shows "Joining voice channel…" spinner
4. Join effect fires (dependency: mount + props):
   - Guards: already in channel, already attempted, busy
   - If `wasChannelDeliberatelyLeft(channelId)`: clears the flag
   - Sets `joinAttemptedRef.current = true`
   - Calls `joinChannel(groupId, groupName)` from context
5. **StreamCallContext.joinChannelAction**:
   - Checks `busyRef.current` — throws if busy
   - Sets `busyRef.current = true`
   - Clears `deliberatelyLeftChannelsRef` for this channel
   - Calls `joinVoiceChannel(groupId, groupName, userId)`
6. **voiceChannelService.joinVoiceChannel**:
   - Gets `channelId = getVoiceChannelId(groupId)` = `voice_channel_{groupId}`
   - Best-effort provisions user in Stream
   - Requests microphone permission
   - Creates/gets call with `getOrCreate({ data: { custom: { groupId, groupName } } })`
   - Starts audio session with `"speaker"` device
   - Calls `call.join({ create: false })`
   - Enables microphone after join
   - Returns `Call` object
7. Context stores call, sets `activeSession = { type: "voice_channel", channelId, channelName, groupId }`
8. `VoiceChannelScreen` shows participant grid with controls
9. Room join sound uses state-based detection: the local user's own transition into JOINED triggers one `room_join` sound (with a 300ms playback delay). The first participant snapshot is then recorded as a baseline (no additional sound). Subsequent participant count increases trigger the sound for remote joins. Remounting the screen while already JOINED (e.g. minimize and return) does not replay the local join sound.

### 4.5 Leaving a voice channel

**User-initiated leave**:

1. User taps disconnect button
2. `VoiceChannelScreen.handleLeave()` checks `leavingRef` gate
3. Calls `leaveChannel()` from context
4. **StreamCallContext.leaveChannelAction**:
   - Adds channel to `deliberatelyLeftChannelsRef`
   - Calls `leaveVoiceChannel(call)` FIRST (while SDK reference still live)
   - Then clears: `activeCallRef = null`, `busyRef = false`, `activeCall = null`, `activeSession = null`
5. **voiceChannelService.leaveVoiceChannel**:
   - Disables microphone and camera (best-effort)
   - Calls `call.leave({ reject: false })`
   - Calls `stopCallAudioSession()` in finally block
6. Navigation: always `navigation.goBack()`

**Important ordering**: Leave is called BEFORE clearing state. This was a deliberate fix — previously, nulling the ref first caused the `callingState$` subscription to tear down mid-flight, preventing proper server-side participant removal.

### 4.6 Minimizing and returning to a call

**Minimizing**:

1. User taps back/minimize button
2. `navigation.goBack()` — returns to previous screen
3. Call remains active (not ended/left)
4. `FloatingVideoOverlay` detects active call + not on call screen:
   - Audio calls: shows `FloatingAudioBanner` (draggable pill "Return to call")
   - Video calls: shows `FloatingVideoContent` (draggable video PiP with remote video)
5. For video: `NativePiPBridge` may enter native PiP mode (Android auto-enter, iOS RTCViewPipIOS)

**Returning**:

1. User taps the floating overlay/banner
2. `FloatingVideoOverlay.handleRestoreCall()` navigates to `DirectCallScreen` with call params
3. Call screen re-mounts and reconnects to existing `activeCall` from context
4. No new call is created — it uses the same `Call` object

### 4.7 Handling disconnects and reconnection

Stream SDK handles reconnection internally. The app reacts to state changes:

- `RECONNECTING`: DirectCallScreen shows "Reconnecting…" status text
- `RECONNECTING_FAILED`: Provider-level cleanup fires — clears session, stops audio
- `MIGRATING`: PiP bridge keeps rendering iOS PiP view during migration
- `OFFLINE`: PiP bridge keeps rendering iOS PiP view; DirectCallScreen shows "Offline" status

No custom reconnection UI beyond status text. The service layer does provide join retry (`joinCallWithRetry()` with `maxJoinRetries`) and a disconnection timeout policy (`applyCallReconnectPolicy()`), but there is no user-facing manual reconnect button or retry prompt. If reconnection fails, the call is considered ended.

---

## 5. State Model

### 5.1 Local UI state (per-screen)

**DirectCallScreen**:

- `endedRef` — gate preventing double endCall dispatch
- `isSpeakerOn` — current speaker state (defaults to `true` for video, `false` for audio)
- `wasAcceptedByRemote` — tracks if outgoing call was accepted (for ringtone control)
- `audioRoutePickerVisible` — modal visibility
- `currentAudioRoute` — selected audio route label
- `duration` — elapsed seconds (1s interval when joined)
- `pipEligibilityLogRef`, `pipModeLogRef` — debug logging refs

**VoiceChannelScreen**:

- `joinError` — error message from failed join
- `joinAttemptedRef` — one-shot gate (resets on failure to allow retry — fixed v1.1)
- `mountedRef` — unmount safety
- `hasSeenActiveCallRef` — tracks if activeCall was ever non-null (for auto-leave logic)
- `leavingRef` — gate preventing double leave
- `isSpeakerOn` — defaults to `true`
- `audioRoutePickerVisible`, `currentAudioRoute` — same as DirectCallScreen
- `prevCountRef` — participant count for join sound detection
- `elapsed` — room duration timer

### 5.2 Shared app state (StreamCallContext)

- `activeSession: ActiveMediaSession` — discriminated union identifying what the user is in:
  - `null` — idle
  - `{ type: "direct_call", callId, recipientName?, mode? }` — in a direct call
  - `{ type: "voice_channel", channelId, channelName?, groupId? }` — in a voice channel
- `activeCall: Call | null` — Stream SDK Call object (provides real-time state like `callingState`, `participants`, etc.)
- `isBusy: boolean` — derived from `activeSession !== null`
- `isReady: boolean` — true when StreamVideoClient is initialized and user is authenticated

**Refs (not exposed, internal to provider)**:

- `busyRef` — synchronous gate (set before async work to prevent double-starts)
- `activeCallRef` — synchronous copy of activeCall for subscription callbacks
- `deliberatelyLeftChannelsRef` — Set of channel IDs the user explicitly left

### 5.3 Persisted backend state

**Firestore collections**:

- `Users/{uid}/StreamCallHistory/{entryId}` — server-written call history entries
- `Users/{uid}/Settings/calls` — user call preferences (single document, synced from client)
- `Users/{uid}` — profile data used for token generation and user provisioning (name, image)

**AsyncStorage keys** (call settings):

- `@call_settings` — local cache of call settings (loads before Firestore sync)

### 5.4 Transient session state

- Stream SDK internal state: `callingState`, `participants`, `members`, `session`, `custom` — accessed via `call.state.*` and `call.state.callingState$` observable
- `callManager` audio session: native audio routing state (speaker/earpiece/bluetooth) — platform-managed, not persisted
- Ringtone playback state: `activePlayer`, `activeType` in `ringtoneService` singleton

### 5.5 Derived state

| State                 | Derived from                            | Used by                                |
| --------------------- | --------------------------------------- | -------------------------------------- |
| `isBusy`              | `activeSession !== null`                | Context consumers, IncomingCallHandler |
| `isJoined`            | `callingState === CallingState.JOINED`  | Call screens, controls                 |
| `isRinging`           | `callingState === CallingState.RINGING` | DirectCallScreen ringtone              |
| `isMuted`             | `call.microphone.state.status`          | CallControlBar                         |
| `isCameraOff`         | `call.camera.state.status`              | CallControlBar                         |
| `isInPiPMode`         | `useIsInPiPMode()` SDK hook             | FloatingVideoOverlay, DirectCallScreen |
| `isCurrentUserInRoom` | `occupants.includes(uid)`               | VoiceRoomOccupancy                     |
| `isActive`            | `occupants.length > 0`                  | VoiceChannelCard                       |

### 5.6 Where state becomes stale

1. **`busyRef` vs `activeSession` timing**: `busyRef` is set synchronously before async call operations, but `activeSession` updates asynchronously via `setState`. Between the ref set and state update, components see `isBusy=false` but ref says busy. This is intentional — the ref is the truth for guards, the state is for UI.

2. **`joinAttemptedRef` on failure**: ~~If `joinChannel()` throws, `joinAttemptedRef.current` remains `true`.~~ **FIXED v1.1**: Reset to `false` in catch block so the user can retry.

3. **Voice room occupancy polling**: Occupancy data can be up to 8-15 seconds stale. User may see occupants who have already left, or miss new joiners.

4. **Call history enrichment**: Profile data is enriched client-side asynchronously. If a profile lookup is slow or fails, entries show "Unknown" until the next refresh.

5. **DND schedule**: Checked on a 60-second interval + AppState changes. If a scheduled DND period starts mid-call, it won't affect already-active calls (by design), but an incoming call arriving in the first 59 seconds of a DND period might slip through.

### 5.7 Race condition catalog

| Race                          | Location                | Risk                                                 | Mitigation                                                                                              |
| ----------------------------- | ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Double call start             | `startCallAction`       | Two taps before `busyRef` set                        | `busyRef.current` set synchronously before any async work                                               |
| Accept during auto-reject     | `IncomingCallHandler`   | Accept and auto-reject fire in same render cycle     | `acceptingRef` guard checked in auto-reject effect                                                      |
| Accept failure loses call     | `IncomingCallHandler`   | Accept fails, pendingCall was already cleared        | **FIXED v1.5**: Restores `pendingCall` if call is still RINGING after accept failure                    |
| Multiple leave calls          | `leaveChannelAction`    | Rapid taps or effect + user action                   | `leavingRef` in VoiceChannelScreen, but context has no gate                                             |
| Auto-dismiss after manual end | `DirectCallScreen`      | `endCall` and auto-dismiss effect both navigate back | `endedRef` prevents double end, but both can call `goBack()` — harmless extra nav                       |
| Token fetch race              | `fetchStreamToken`      | Concurrent calls return different API keys           | **FIXED v1.1**: In-flight promise lock coalesces concurrent requests                                    |
| Client init race              | `initStreamClient`      | Concurrent init/destroy during rapid login/logout    | **FIXED v1.5**: `initPromise` mutex — concurrent callers wait for in-flight init then re-check          |
| Join effect re-fire           | `VoiceChannelScreen`    | Complex dep array triggers unexpected re-runs        | `joinAttemptedRef` guards; **FIXED v1.1**: ref resets on failure to allow retry                         |
| Ringtone start/stop conflicts | `DirectCallScreen`      | Multiple effects toggle ringtone in same render      | Effects use state-based conditions, but ordering not guaranteed                                         |
| Concurrent occupancy fetches  | `useVoiceRoomOccupancy` | Rapid refresh/resume could start multiple fetches    | **FIXED v1.5**: `fetchingRef` guard prevents concurrent fetches (matches `useActiveVoiceRooms` pattern) |
| Settings sync divergence      | `callSettingsService`   | Firestore write fails but local timestamp is ahead   | **FIXED v1.5**: `_lastUpdatedAt` written to AsyncStorage only after Firestore write succeeds            |

---

## 6. Data Model and Backend Contract

### 6.1 Stream Call History Entry

**Collection**: `Users/{uid}/StreamCallHistory/{entryId}`
**Written by**: `streamCallWebhook` Cloud Function only
**Read by**: `streamCallHistoryService.ts` client-side

```typescript
interface StreamCallHistoryEntry {
  id: string; // doc ID — for direct: callId, for rooms: `${callId}_${userId}`
  userId: string; // owner of this record
  callId: string; // Stream call ID

  entryType: "direct_audio" | "direct_video" | "voice_room";
  direction: "incoming" | "outgoing" | "joined";
  result: "completed" | "missed" | "declined" | "canceled" | "left" | "ongoing";

  startedAt: number; // timestamp ms
  endedAt: number | null; // timestamp ms or null if ongoing
  durationSeconds: number | null; // only for "completed", calculated as (endedAt - startedAt) / 1000

  otherUserId: string | null; // peer ID (null for voice rooms)
  otherUserName: string | null; // peer display name (null for voice rooms)
  otherUserAvatar: string | null; // peer avatar URL (null for voice rooms)

  groupId: string | null; // group ID (null for direct calls)
  groupName: string | null; // group name (null for direct calls)
  groupAvatar: string | null; // group avatar (null for direct calls)
  participantCount: number | null; // for voice rooms

  initiatedBy: string; // user ID who created the call
  createdAt: number; // when this history entry was created
}
```

**Voice room detection**: Call ID starts with `voice_channel_` OR call has `custom.groupId`/`custom.groupName`.

**Entry type mapping**:

- Voice room → `"voice_room"`
- Direct call with `custom.mode === "video"` → `"direct_video"`
- Direct call otherwise → `"direct_audio"`

**Direction mapping** (direct calls):

- `userId === createdBy` → `"outgoing"`
- Otherwise → `"incoming"`
- Voice rooms always → `"joined"`

**Result mapping**:

- `call.session_ended` normally → `"completed"`
- `call.rejected` with reason `"cancel"` → `"canceled"`
- `call.rejected` with reason `"decline"` or `"busy"` → `"declined"`
- `call.rejected` with reason `"timeout"` → `"missed"`
- `call.missed` → `"missed"`

### 6.2 Call Settings

**Collection**: `Users/{uid}/Settings/calls` (single document in subcollection)
**Written by**: Client via `callSettingsService.updateSettings()`
**Read by**: Client on init via `callSettingsService.loadSettings()`
**Also cached**: AsyncStorage at `@call_settings`

```typescript
interface CallSettings {
  // Video
  defaultCamera: "front" | "back";
  mirrorFrontCamera: boolean;
  autoEnableVideo: boolean;

  // Audio
  defaultAudioOutput: "earpiece" | "speaker" | "bluetooth" | "wired";
  noiseSuppression: boolean; // stored but handled by device hardware
  echoCancellation: boolean; // stored but handled by platform WebRTC stack
  autoGainControl: boolean; // stored but handled by platform WebRTC stack

  // Notifications
  ringtone: "default" | "vibrate_only" | "silent" | "custom";
  customRingtoneUri?: string;
  vibrationEnabled: boolean;
  ringtoneVolume: number; // 0-100

  // DND
  dndSchedule: {
    enabled: boolean;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    timezone: string;
    daysOfWeek: number[]; // 0-6 (Sun-Sat)
  };

  // Privacy
  allowCallsFrom: "everyone" | "friends_only" | "nobody";
  showCallPreview: boolean; // stored, not wired
  announceCallerName: boolean; // stored, not wired

  // Quality
  preferredVideoQuality: "auto" | "high" | "medium" | "low"; // wired via callRuntime.ts
  dataSaverMode: boolean; // wired via callRuntime.ts (forces 240p incoming)
  wifiOnlyVideo: boolean; // stored, not wired

  // Accessibility
  flashOnRing: boolean; // stored, not wired
  hapticFeedback: boolean; // stored, not wired
  largeCallControls: boolean; // stored, not wired

  // Metadata (added v1.2, sync ordering fixed v1.5)
  _lastUpdatedAt?: number; // ms timestamp — written to AsyncStorage only after Firestore write succeeds
}
```

### 6.3 Stream Call Custom Data

**Set by** `startDirectCall` during `getOrCreate()`:

```typescript
data: {
  members: [
    { user_id: callerId, role: "admin" },
    { user_id: calleeId }
  ],
  custom: {
    mode: "audio" | "video"   // read by acceptDirectCall to determine camera behavior
  }
}
```

**Set by** `joinVoiceChannel` during `getOrCreate()`:

```typescript
data: {
  custom: {
    groupId: string,
    groupName: string
  }
}
```

### 6.4 Stream Token Response

**Cloud Function**: `getStreamVideoToken` (HTTPS Callable)
**Input**: None (uses `context.auth.uid`)
**Output**: `{ token: string, apiKey: string }`
**Token TTL**: 24 hours (86400 seconds)
**Side effect**: Upserts user in Stream with name/image from Firebase Auth + Firestore profile

### 6.5 Stream User Provisioning

**Cloud Function**: `ensureStreamUsers` (HTTPS Callable)
**Input**: `{ userIds: string[] }` (max 25)
**Output**: `{ provisioned: number }`
**Behavior**: Batch upserts users in Stream. Reads Firestore profiles for name/image. Still upserts with just ID if profile missing.

### 6.6 Stream Webhook Handler

**Cloud Function**: `streamCallWebhook` (HTTPS onRequest)
**Security**: Validates `X-Signature` HMAC-SHA256 with `STREAM_API_SECRET`. **Fail-closed** (v1.2): if `STREAM_API_SECRET` is not set, all requests are rejected with 500. If signature is missing or invalid, rejected with 401.
**Handled events**: `call.session_ended`, `call.rejected`, `call.missed`
**Write target**: `Users/{uid}/StreamCallHistory/{entryId}` — batch write for all participants

**Participant sources** (in order of preference):

1. `call.members[]` array
2. `call.session.participants[]` array

**CRITICAL**: `STREAM_API_SECRET` must be set in `firebase-backend/functions/.env`. Without it the webhook will reject all requests (fail-closed, fixed in v1.2).

### 6.7 Legacy Firestore Collections (Inactive)

These are used by `calls.ts` backend functions but NOT by any active client code:

| Collection                                  | Purpose                                | Status      |
| ------------------------------------------- | -------------------------------------- | ----------- |
| `Calls/{callId}`                            | Call documents with participant arrays | 🚫 Inactive |
| `CallSignaling/{callId}/Signals/{signalId}` | WebRTC ICE candidates/offers/answers   | 🚫 Inactive |
| `Users/{uid}/CallHistory/{callId}`          | Per-user call history (legacy)         | 🚫 Inactive |
| `GroupCallInvites/{inviteId}`               | Group call invitations                 | 🚫 Inactive |

---

## 7. Navigation and UI Behavior

### 7.1 Navigation configuration

```
MainStack (React Navigation)
  ├─ DirectCall (fullScreenModal, fade animation, headerShown: false, gestureEnabled: true)
  ├─ VoiceChannel (fullScreenModal, fade animation, headerShown: false, gestureEnabled: true)
  └─ CallSettings (slide_from_right, headerShown: false)
```

Screens are lazy-loaded via `require()` when `CALL_FEATURES.CALLS_ENABLED` is true. When false, empty components substitute.

**No deep linking** configured for DirectCall or VoiceChannel routes.

### 7.2 Call screen entry and exit

**DirectCallScreen entry**:

1. From `DirectCallButton` (DM header, profile) → `onCallStarted(callId)` → `navigate("DirectCall", params)`
2. From `IncomingCallHandler` → `onNavigateToCall(callId, mode)` → `navigate("DirectCall", params)`
3. From `FloatingVideoOverlay` → `navigate("DirectCall", params)` (restore from PiP/minimized)
4. From `CallsScreen` history row → navigate to DirectCall for re-call (if implemented)

**DirectCallScreen exit**:

1. User taps end button → `endCall()` + `goBack()`
2. Remote hangs up → `activeCall` becomes null → auto-dismiss after 500ms
3. Client-side timeout (60s unanswered outgoing) → `endCall()` + `goBack()`
4. User taps minimize → `goBack()` (call stays active)

**VoiceChannelScreen entry**:

1. From `VoiceChannelCard` in group info/chat
2. From `ActiveRoomCard` on CallsScreen
3. Navigation with `channelId`, `channelName`, `groupId` params

**VoiceChannelScreen exit**:

1. User taps disconnect → `leaveChannel()` + `goBack()`
2. Call ends externally → `activeCall` becomes null → auto-leave after 250ms
3. User taps minimize/back → `goBack()` (stays in channel)
4. Join failure → error screen with Retry and Go Back (v1.3)

### 7.3 Call UI layering

- **Incoming call overlay** (`IncomingCallHandler`): Full-screen absolute overlay at root level, above all navigation. Rendered portal-style regardless of current screen.
- **Floating overlay** (`FloatingVideoOverlay`): Positioned absolutely at root level. Draggable. Hidden when user is on DirectCallScreen or in native PiP mode.
- **Native PiP** (`NativePiPBridge`): Rendered at root level, only for video direct calls. iOS: renders `RTCViewPipIOS`. Android: uses `useAutoEnterPiPEffect`.

### 7.4 Platform-specific call UI behavior

**Video call UI**:

- Remote video: full-screen `ParticipantView`
- Local PiP: bottom-right corner, 110×160, bordered, shadowed
- Floating header over video with back + speaker buttons
- Full control bar: mic, camera, flip, speaker, leave

**Audio call UI**:

- Header with back and speaker buttons
- Centered avatar with pulsing border (during ringing)
- Status text below avatar
- Bottom control bar: mic, speaker, leave

**Voice channel UI**:

- Header with back button, status text, speaker button
- Participant grid: FlatList with 2-3 columns (dynamic based on count)
- Each tile: video or avatar fallback, name, speaking/muted indicator
- Speaking indicator: green border (#43A047) + volume icon
- Control bar: mic, camera, flip, speaker, disconnect

---

## 8. Permission and Device Behavior

### 8.1 Microphone permission

- **Required** for all call types (direct audio, direct video, voice channel)
- Requested via `requestMicrophonePermission()` in `callSessionManager.ts`
- If denied: `requestCallPermissions()` throws `"Microphone permission is required to join calls."`
- The call is not created if microphone permission is denied

### 8.2 Camera permission

- **Optional** — only requested for video calls when `config.video.startEnabled` is true
- Requested via `requestCameraPermission()` in `callSessionManager.ts`
- If denied: call proceeds without camera (audio-only video call)
- For voice channels: camera toggle requests permission on-demand when user first enables camera

### 8.3 Audio routing

**Initialization**:

- Direct audio calls: device from `callSettingsService.getCallConfig().audio.defaultOutput`, mapped via `toStreamDevice()` → "speaker" or "earpiece"
- Direct video calls: always "speaker"
- Voice channels: always "speaker"

**Runtime routing**:

- Speaker toggle: `callManager.speaker.setForceSpeakerphoneOn(boolean)`
- iOS route picker: `callManager.ios.showDeviceSelector` (native system picker)
- Android route picker: `AudioRoutePicker` modal with `callManager.android.getAudioDeviceStatus()` and `callManager.android.selectAudioDevice(name)`

**Audio session lifecycle**:

- Start: `callManager.start({ audioRole: "communicator", deviceEndpointType })` — called before media join
- Stop: `callManager.stop()` — called on call end, reject, leave, and provider-level cleanup

**Bluetooth/headphone handling**:

- Android: `AudioRoutePicker` parses device names for bluetooth variants (airpods, buds, car, headset)
- Android: `addAudioDeviceChangeListener` tracks device changes live
- iOS: handled entirely by native system picker

### 8.4 Background/foreground behavior

**Push config** (`setPushConfig.ts`):

- Configured before React tree mounts via `StreamVideoRN.setPushConfig()`
- Android: incoming call channel with HIGH importance, call notification channel
- iOS: provider name `"vibe-apn"` for APNs
- Background client creation: when push arrives while app terminated, callback creates `StreamVideoClient` using cached token
- `rejectCallWhenBusy: true` option on client

**AppState awareness**:

- `useActiveVoiceRooms`: pauses polling when backgrounded, resumes on foreground
- `useVoiceRoomOccupancy`: pauses polling when backgrounded
- `callSettingsService`: rechecks DND on AppState change

**iOS push architecture** (v1.6): The app uses **VoIP push (PushKit) + CallKit** for iOS call delivery, NOT Firebase Cloud Messaging. The full chain is:

1. **Native layer** (injected by Stream SDK Expo config plugin into AppDelegate):
   - `RNVoipPushNotificationManager.voipRegistration()` called on app launch
   - `pushRegistry:didReceiveIncomingPushWith:` receives VoIP push, parses Stream payload, calls `RNCallKeep.reportNewIncomingCall()` to show CallKit UI
   - `pushRegistry:didUpdatePushCredentials:` forwards VoIP token to JS bridge
   - CXProvider audio session activate/deactivate forwarded to RTCAudioSession

2. **SDK JS layer** (automatic when `ios.pushProviderName` is set in `setPushConfig`):
   - `setupIosVoipPushEvents()` listens for VoIP `notification` events, creates client via `createStreamVideoClient`, processes the ringing call
   - `setupIosCallKeepEvents()` listens for CallKit accept/reject/didDisplayIncomingCall events
   - `useIosVoipPushEventsSetupEffect()` (inside `<StreamVideo>` provider) registers VoIP token with Stream via `client.addVoipDevice(token, 'apn', 'vibe-apn')`

3. **App layer** (`setPushConfig.ts`, `IncomingCallHandler.tsx`):
   - `createStreamVideoClient` callback creates a connected client when the app wakes from terminated state
   - Native-accept adoption effect in `IncomingCallHandler` detects JOINING/JOINED calls after native accept and adopts them into app state

**Remaining external requirements**: Apple Developer portal must have the Push Notifications capability enabled on the App ID. APNs credentials (`.p8` auth key or VoIP Services certificate) must be uploaded to the Stream Dashboard as provider `"vibe-apn"`. Provisioning profile must include the Push Notifications entitlement. These cannot be completed from code alone. Until completed, VoIP pushes from Stream to iOS devices will fail silently.

---

## 9. Error Handling and Known Fragility Points

### 9.1 Error handling patterns

**General strategy**: Try-catch with console.warn/error, continue execution. Most errors are logged but not surfaced to users.

| Layer                             | Pattern                                                     | User feedback                                |
| --------------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| Service layer (directCallService) | `classifyCallError()` maps errors to user-friendly messages | Yes — thrown and caught by context/component |
| Context layer                     | Catches service errors, re-throws to caller                 | Depends on caller                            |
| Screen layer                      | Catches context errors, shows `Alert.alert()`               | Yes — for starting calls                     |
| IncomingCallHandler               | Catches accept/reject failures, logs                        | No user feedback                             |
| Voice channel join                | Sets `joinError` state, shows error screen                  | Yes — error + retry                          |
| Audio session                     | Logs warnings, never throws                                 | No                                           |
| Settings                          | Catches and shows Alert                                     | Yes                                          |

### 9.2 Known bugs and fragile areas

#### Critical

1. ~~**iOS background call delivery**~~ — **ADDRESSED v1.6**: Repo-side VoIP push + CallKit integration is now complete. The Stream SDK handles PushKit token registration, VoIP push reception, and CallKit UI internally. Code comments and logging updated. **Remaining**: Apple Developer portal VoIP capabilities, APNs credential upload to Stream dashboard, and real-device validation. Until external setup is done, VoIP pushes will not be delivered.

2. ~~**VoiceChannelScreen joinAttemptedRef never resets on failure**~~ — **FIXED v1.1**: `joinAttemptedRef.current = false` in catch block.

3. ~~**Double goBack on call end**~~ — **FIXED v1.1**: `endedRef` guard on auto-dismiss prevents second `goBack()`.

#### High

4. ~~**Speaker init effect fires without call guard**~~ — **FIXED v1.1**: Now requires `isJoined === true` before `setForceSpeakerphoneOn`.

5. ~~**Token cache race condition**~~ — **FIXED v1.1**: In-flight promise lock added to `fetchStreamToken()`.

6. **Android audio route listener leak** (Confidence: LOW)
   - `DirectCallScreen` and `VoiceChannelScreen` both set up Android audio listeners using `callManager.android.addAudioDeviceChangeListener()`.
   - Both use a `cancelled` flag with `[]` dependency array (runs once). Cleanup calls `unsubscribe()` and sets `cancelled = true`. Pattern is correct.
   - Code is duplicated across both screens. A shared `useAndroidAudioRoute` hook would reduce duplication but is not a correctness issue.

7. ~~**Voice channel join effect complex dependency array**~~ (Confidence: MEDIUM)
   - Dependencies: `[channelId, channelName, clearDeliberateLeave, groupId, isBusy, isAlreadyInChannel, joinChannel, wasChannelDeliberatelyLeft]`
   - Context functions (`clearDeliberateLeave`, `wasChannelDeliberatelyLeft`) use `useCallback` with `[]` deps — stable.
   - `joinChannel` uses `useCallback` with `[userId]` deps — stable unless auth changes.
   - `joinAttemptedRef` guards against re-joins. Resets on failure (v1.1).
   - **FIXED v1.3**: Error UI now has explicit Retry button that clears `joinError` and resets `joinAttemptedRef`, allowing clean retry without remount.

#### Medium

8. **Ringtone start/stop conflicts** (Confidence: LOW-MEDIUM)
   - Multiple effects in DirectCallScreen affect ringtone state. Rapid state transitions (RINGING → JOINING → JOINED) could cause start/stop calls to interleave.
   - The ringtone service stops any playing ringtone before starting a new one, which partially mitigates this.

9. **PanResponder in FloatingVideoOverlay** (Confidence: LOW)
   - Created in `useRef` initializer. If component re-renders with different overlay dimensions, the responder retains stale bounds.
   - Unlikely to cause visible issues unless screen rotates during call.

10. ~~**queryVoiceChannel error swallowing**~~ — **FIXED v1.2**: Returns discriminated union (`{ status: "active" | "no_room" | "error" }`). Consumers updated to handle error variant. Network/auth failures now distinguishable from "no room."

11. ~~**Settings load failure shows infinite spinner**~~ — **FIXED v1.2**: Error state with retry button added to `CallSettingsScreen`.

12. ~~**Stream client concurrent init race**~~ — **FIXED v1.5**: `initStreamClient()` now uses `initPromise` mutex. Concurrent callers wait for in-flight init to complete, then re-check if the result matches their userId. Eliminates init/destroy overlaps during rapid login/logout.

13. ~~**useVoiceRoomOccupancy concurrent fetch race**~~ — **FIXED v1.5**: Added `fetchingRef` guard matching the pattern already used by `useActiveVoiceRooms`. Prevents concurrent fetches from app state resume + interval overlap.

14. ~~**Accept failure loses incoming call overlay**~~ — **FIXED v1.5**: `handleAccept()` now restores `pendingCall` and `callAllowed` if `acceptCall()` throws AND the call is still in RINGING state. User sees the incoming call overlay again and can retry or decline.

15. ~~**Settings Firestore sync divergence**~~ — **FIXED v1.5**: `updateSettings()` and `resetToDefaults()` now write `_lastUpdatedAt` to AsyncStorage only AFTER successful Firestore write. If Firestore write fails, local settings are saved without a timestamp, so the next `loadSettings()` will properly accept cloud data when it becomes available.

### 9.3 Areas where UI and backend can drift out of sync

1. **Call settings**: Client writes to both AsyncStorage and Firestore. `_lastUpdatedAt` timestamp prevents stale cloud data from overwriting newer local data on load (v1.2). Timestamp is only persisted locally after successful Firestore write, preventing sync divergence on write failure (v1.5). `resetToDefaults()` also stamps `_lastUpdatedAt` (v1.3).

2. **Call history enrichment**: Client enriches history entries with profile data. If profile changes after history entry creation, enriched data becomes stale. No background refresh mechanism.

3. **Voice room occupancy**: Polls every 8-15 seconds. Server state changes faster than poll interval, so UI can show stale occupancy.

4. **Active session vs Stream state**: If the Stream backend forcefully ends a call (e.g., due to server restart), the `callingState$` subscription should detect it. However, if the subscription tears down first (e.g., component unmount race), `activeSession` could get stuck.

---

## 10. Behavioral Truth Table

### 10.1 Direct call states

| State                     | User sees                                                 | Data exists                                                   | Available actions                                            | Allowed transitions                                          | What can go wrong                                                                               |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **Idle**                  | No call UI                                                | No activeSession                                              | Start call, receive call                                     | → Outgoing Initializing, → Incoming Ringing                  | —                                                                                               |
| **Outgoing Initializing** | Loading/spinner briefly                                   | busyRef=true, no call yet                                     | Cancel (via back)                                            | → Outgoing Ringing, → Failed                                 | Provisioning or permission failure aborts                                                       |
| **Outgoing Ringing**      | Avatar with pulsing border, "Ringing…", outgoing ringtone | activeSession (direct_call), activeCall, CallingState.RINGING | End/cancel call, minimize                                    | → Active (remote accepts), → Ended (timeout/cancel)          | 60s client timeout ends call. Remote never sees if push fails on iOS.                           |
| **Incoming Ringing**      | Full-screen overlay with accept/decline                   | pendingCall in IncomingCallHandler, CallingState.RINGING      | Accept, decline                                              | → Joining, → Ended (decline/busy/DND)                        | DND incorrectly configured could auto-reject wanted calls. Race between accept and auto-reject. |
| **Joining**               | "Connecting…" or "Answered, connecting…"                  | activeSession, activeCall, CallingState.JOINING               | End call                                                     | → Active, → Failed                                           | If join fails, call screen shows error then dismisses                                           |
| **Active (Joined)**       | Video/audio call UI with controls, duration timer         | activeSession, activeCall, CallingState.JOINED                | Mute, camera, speaker, flip, audio route, minimize, end, PiP | → Reconnecting, → Ended, → Minimized                         | Audio route issues if callManager out of sync                                                   |
| **Minimized**             | Previous screen + floating overlay/PiP                    | Same as Active                                                | Return to call (tap overlay), end call via overlay button    | → Active (tap to return), → Ended (end tap or remote hangup) | Double navigation if overlay tap races with remote end                                          |
| **Reconnecting**          | "Reconnecting…" status                                    | activeSession, CallingState.RECONNECTING                      | Wait, end call                                               | → Active, → Failed                                           | No retry UI, no timeout — relies on Stream SDK                                                  |
| **Ending**                | Brief transition                                          | endedRef=true                                                 | None                                                         | → Ended                                                      | endDirectCall can throw — caught, call still cleaned up                                         |
| **Ended**                 | Auto-dismiss (500ms delay)                                | null activeSession, null activeCall                           | None                                                         | → Idle                                                       | Double goBack possible but usually harmless                                                     |
| **Failed**                | Alert.alert with error message, then dismiss              | busyRef reset, no activeSession                               | Dismiss alert                                                | → Idle                                                       | User-friendly error message via classifyCallError()                                             |

### 10.2 Voice channel states

| State               | User sees                                     | Data exists                               | Available actions                              | Allowed transitions                                | What can go wrong                                          |
| ------------------- | --------------------------------------------- | ----------------------------------------- | ---------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| **Idle**            | Group chat with voice room card               | No activeSession for this channel         | Join voice                                     | → Joining                                          | "In another call" shown if busy                            |
| **Joining**         | "Joining voice channel…" spinner              | joinAttemptedRef=true                     | Back (cancel)                                  | → Active, → Error                                  | Join can fail; ref resets on failure to allow retry (v1.1) |
| **Active (Joined)** | Participant grid with controls, count + timer | activeSession (voice_channel), activeCall | Mute, camera, speaker, disconnect, minimize    | → Ended (leave), → Minimized                       | —                                                          |
| **Minimized**       | Previous screen + floating audio banner       | Same as Active                            | Return (tap banner), end call (tap end button) | → Active (tap), → Ended (end tap/provider cleanup) | —                                                          |
| **Error**           | Error screen with message, Retry + Go Back    | joinError state                           | Retry (clears error + ref), Go Back            | → Joining (retry), → Idle (go back)                | —                                                          |
| **Ended**           | Auto-dismiss (250ms delay)                    | null activeSession                        | None                                           | → Idle                                             | deliberatelyLeftChannelsRef prevents auto-rejoin           |

---

## 11. Known Gaps and Improvement Opportunities

### 11.1 Architecture cleanup

1. ~~**Remove legacy `calls.ts` backend code**~~ — ✅ **FIXED v1.1**: File now has a clear `@deprecated` header explaining it is not exported from `index.ts` and should not be re-enabled without a full audit.

2. **Consolidate audio session management** — `startCallAudioSession` / `stopCallAudioSession` is called from context, services, and screens. Unclear ownership. Consider making the context the sole owner.

3. **Unify screen state patterns** — `DirectCallScreen` and `VoiceChannelScreen` have near-identical patterns for audio route, speaker toggle, Android listeners, and duration timer. Extract shared hook (e.g., `useCallControls`).

4. **Feature flag for voice channels** — `CALL_FEATURES.VOICE_CHANNELS_ENABLED` was mentioned in old QA docs but doesn't exist in current `featureFlags.ts`. Only `CALLS_ENABLED` (master) and `DIRECT_CALLS_ENABLED` exist. Voice channels are always-on when calls are enabled.

### 11.2 Missing guards

1. ~~**Speaker init effect needs call guard**~~ — ✅ **FIXED v1.1**: Now checks `isJoined` before setting speaker.

2. ~~**Camera flip without off-guard in VoiceChannelScreen**~~ — ✅ **FIXED v1.1**: `handleFlipCamera` now checks `isCameraOff`.

3. ~~**joinAttemptedRef reset on failure**~~ — ✅ **FIXED v1.1**: Reset on join failure to allow retry.

4. ~~**Settings load failure handling**~~ — ✅ **FIXED v1.2**: Error state with retry button in `CallSettingsScreen`.

5. ~~**Token fetch lock**~~ — ✅ **FIXED v1.1**: In-flight promise lock added to `fetchStreamToken()`.

### 11.3 Missing cleanup

1. **Stream client destroy on app crash/force-quit** — If the app crashes during an active call, the Stream backend still sees the user as a participant. Stream has server-side timeout for this, but stale participants may appear briefly.

2. **Ringtone cleanup on unmount** — `DirectCallScreen` effect cleanup should always call `stopRingtone()`, but rapid mount/unmount during navigation transitions could leave audio playing.

3. ~~**endCallAction idempotency**~~ — ✅ **FIXED v1.1**: Added `endingRef` guard to prevent concurrent endCall dispatches.

### 11.4 UX improvements

1. **No call reconnection UI** — User has no way to manually retry reconnection. Only "Reconnecting…" text.

2. ~~**No disconnect button on floating overlay**~~ — ✅ **FIXED v1.1**: `FloatingAudioBanner` now includes an end-call button alongside "Return to call".

3. **Settings picker uses Alert.alert** — No visual indication of currently selected option. Better: use a dedicated picker/select component.

4. ~~**DND time picker is placeholder**~~ — ✅ **FIXED v1.1**: Replaced with `@react-native-community/datetimepicker`.

5. **No in-call volume control** — Volume managed only by device hardware buttons.

6. **No call quality indicator** — ~~No visual feedback about connection quality, packet loss, etc.~~ ✅ **FIXED v1.2**: `CallConnectionBadge` component shows contextual badges for RECONNECTING, MIGRATING, OFFLINE, RECONNECTING_FAILED, and POOR connection quality. Used in both DirectCallScreen and VoiceChannelScreen.

7. ~~**Room join sound plays for every participant join**~~ — ✅ **FIXED v1.2**: State-based approach tracks local user's JOINED transition. First participant snapshot is recorded as baseline; only subsequent count increases trigger sound. Replaced v1.1's 2000ms setTimeout timing hack.

8. ~~**DirectCallScreen auto-dismiss race**~~ — ✅ **FIXED v1.1**: Auto-dismiss effect now respects `endedRef` to prevent double `goBack()`.

9. ~~**Settings descriptions dishonest**~~ — ✅ **FIXED v1.1**: Unwired settings now show "Saved for future use — not yet enforced" instead of implying they work.

### 11.5 Resilience improvements

1. ~~**Add jitter to polling intervals**~~ — ✔️ **FIXED v1.3**: `useActiveVoiceRooms` (15s), `useVoiceRoomOccupancy` (8s), `VoiceChannelCard` (10s) now use ±20% jitter to prevent synchronized polling storms.

2. **Add retry with backoff for join failures** — Currently one-shot join attempt. If network is briefly unavailable, user must manually retry.

3. **Add call quality monitoring** — Stream SDK provides stats. Could surface to users or log for debugging.

### 11.6 Missing tests

- No unit tests found for call services (`directCallService`, `voiceChannelService`, `callSessionManager`)
- No integration tests for call flows
- No tests for `IncomingCallHandler` accept/reject/auto-reject logic
- No tests for `callSettingsService` DND calculation
- Test files in `__tests__/calls/` exist but contents not verified

### 11.7 Naming issues

- `endDirectCall` says "end" but actually does `leave()` or `endCall()` depending on state — naming doesn't distinguish
- `rejectDirectCall` handles both decline and cancel — the "reject" name is ambiguous
- `ActiveRoomCard` vs `VoiceChannelCard` — similar names, different contexts. `ActiveRoomCard` is for rooms the user can see in CallsScreen; `VoiceChannelCard` is in group info/chat. Not obvious from names alone.

### 11.8 iOS Terminated/Background Incoming Call — Manual Steps Checklist (v1.6)

All repo-side code for iOS VoIP push + CallKit is complete. The following external steps must be completed manually before iOS terminated-state incoming calls will work end-to-end.

#### Step 1: Apple Developer Portal

1. Sign in at [developer.apple.com](https://developer.apple.com)
2. Navigate to **Certificates, Identifiers & Profiles → Identifiers**
3. Select the App ID for `com.vibeapp.mobile`
4. Under **Capabilities**, enable:
   - **Push Notifications** (if not already enabled)
5. Save changes

> **Note**: There is no separate "VoIP Services" capability toggle on the App ID. VoIP push is enabled by the combination of the Push Notifications capability here + the `voip` entry in `UIBackgroundModes` (already declared in `app.config.ts`). The VoIP-specific setup is handled via the certificate type (Step 2, Option B) or an APNs Auth Key (Step 2, Option A).

#### Step 2: Create APNs Credentials

**Option A: APNs Auth Key (.p8) — Recommended**

1. In the Apple Developer portal, go to **Keys**
2. Create a new key with **Apple Push Notifications service (APNs)** enabled
3. Download the `.p8` file (you can only download it once)
4. Note the **Key ID** and your **Team ID** (from Membership page)

**Option B: VoIP Certificate (.p12)**

1. In the Apple Developer portal, go to **Certificates**
2. Create a new **VoIP Services Certificate** for `com.vibeapp.mobile`
3. Generate from a CSR, download, and export as `.p12`

#### Step 3: Stream Dashboard Configuration

1. Log in to the [Stream Dashboard](https://dashboard.getstream.io/)
2. Navigate to your app → select **Push Notifications** from the left sidebar
3. Click **New Configuration** and select the **APN** provider type
4. Fill in the configuration fields:
   - **Name**: `vibe-apn` (must match exactly — this is what `setPushConfig.ts` declares)
   - **Bundle/Topic ID**: `com.vibeapp.mobile`
   - **Team ID**: Your Apple Team ID (top-right of Apple Developer account page)
   - **Key ID**: The Key ID from the `.p8` key created in Step 2 (also in the filename, e.g. `AuthKey_ABC123.p8`)
   - Upload the **`.p8` token** file (or `.p12` certificate if using Option B)
5. Enable the provider using the **toggle**, then click **Create**
6. **Verify the Android provider** `vibe-firebase` is also configured with FCM credentials (should already be done)

> Stream's APN provider handles VoIP push delivery for video/calling automatically — there is no separate "VoIP" toggle. The SDK sends VoIP pushes through this provider when a ringing call is created.

#### Step 4: Provisioning Profile

1. In the Apple Developer portal → **Profiles**
2. The provisioning profile for `com.vibeapp.mobile` must include:
   - Push Notifications entitlement (from the capability enabled in Step 1)
   - The `voip` background mode is baked into the binary by `app.config.ts`, not the provisioning profile
3. Regenerate the profile if the Push Notifications capability was newly added in Step 1
4. EAS Build will use the profile automatically if configured correctly
5. For manual builds: download and install the updated profile

#### Step 5: Build & Deploy

1. Run a fresh EAS build:
   ```
   eas build --platform ios --profile production
   ```
   The Stream SDK Expo config plugin will inject:
   - `RNVoipPushNotificationManager.voipRegistration()` into AppDelegate
   - PushKit delegate methods (`didUpdate`, `didReceiveIncomingPushWith`)
   - CallKit audio session forwarding
   - VoIP background mode in Info.plist (already declared in `app.config.ts`)
2. Install the build on a physical iPhone (simulators cannot receive VoIP pushes)

#### Step 6: Real-Device Validation

**Test 1: VoIP Token Registration**

1. Launch the app on a physical iPhone, sign in
2. Check Xcode console or Stream dashboard for VoIP device token registration
3. **Success sign**: Stream logs show `Sent voip token: <token>` or the Stream dashboard shows a VoIP device for the user
4. **Failure sign**: `Skipped sending voip token: no token was present (possibly using a simulator)` — you're on a simulator, or VoIP entitlement is missing from the provisioning profile

**Test 2: Background Incoming Call**

1. Have User A on iOS with app in background (not terminated)
2. User B calls User A
3. **Success sign**: iPhone shows CallKit incoming call UI (full-screen when locked, banner when unlocked)
4. **Failure sign**: No notification or only a silent FCM alert — check Stream dashboard push provider config

**Test 3: Terminated State Incoming Call**

1. Force-quit the app on User A's iPhone
2. User B calls User A
3. **Success sign**: iPhone shows CallKit incoming call UI even though app was killed. When accepted, app launches directly into the call.
4. **Failure sign**: Nothing happens — check APNs credentials, Stream provider name match, and VoIP entitlement

**Test 4: Accept from Native UI**

1. Receive a call via CallKit (background or terminated)
2. Accept using the CallKit green button
3. **Success sign**: App opens → IncomingCallHandler adopts the JOINED call → navigates to DirectCallScreen → audio works both ways
4. **Failure sign**: App opens but shows no call screen — check `[IncomingCallHandler] Adopting natively-accepted call` logs

**Test 5: Decline from Native UI**

1. Receive a call via CallKit
2. Decline using the CallKit red button
3. **Success sign**: Call is rejected, caller sees "declined" or timeout, callee sees nothing in-app
4. **Failure sign**: Call continues ringing on caller side — check setupIosCallKeepEvents endCall handler

#### Simulator Limitations

- **iOS Simulator cannot receive VoIP pushes**: PushKit requires a real device. Foreground incoming calls (via `useCalls()` hook) work on simulator.
- **Android emulator**: FCM push should work on emulators with Google Play Services, but behavior may vary.

---

## 12. Verification and Confidence Notes

| Section                                  | Confidence | Basis                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Executive Overview                       | HIGH       | Direct code reading of all core files                                                                                                                                                                                                                  |
| Feature Inventory                        | HIGH       | Every feature traced to specific code                                                                                                                                                                                                                  |
| File/Architecture Map                    | HIGH       | Every file read completely                                                                                                                                                                                                                             |
| Direct call lifecycle                    | HIGH       | Traced through StreamCallContext → directCallService → Stream SDK calls                                                                                                                                                                                |
| Incoming call lifecycle                  | HIGH       | Full IncomingCallHandler code read with all effects                                                                                                                                                                                                    |
| Voice channel lifecycle                  | HIGH       | Full voiceChannelService + VoiceChannelScreen code read                                                                                                                                                                                                |
| Minimize/return flow                     | HIGH       | FloatingVideoOverlay and NativePiPBridge fully read                                                                                                                                                                                                    |
| State model                              | HIGH       | All state hooks, refs, and context values cataloged from code                                                                                                                                                                                          |
| Data model / Firestore                   | HIGH       | Backend webhook code + types + client service all read                                                                                                                                                                                                 |
| Call settings schema                     | HIGH       | callSettingsService and types fully read                                                                                                                                                                                                               |
| Navigation config                        | HIGH       | RootNavigator.tsx routes verified                                                                                                                                                                                                                      |
| Permission handling                      | HIGH       | callSessionManager and permission utils read                                                                                                                                                                                                           |
| Audio routing                            | HIGH       | AudioRoutePicker, callSessionManager, and screen code read                                                                                                                                                                                             |
| Push/background behavior                 | HIGH       | setPushConfig.ts verified; Stream SDK Expo plugin, VoIP push listeners, and CallKit events all confirmed present. iOS VoIP push architecture is code-complete. External APNs/Stream dashboard config and real-device validation still required (v1.6). |
| Legacy backend status                    | MEDIUM     | calls.ts read; confirmed no client imports, but didn't search every possible dynamic reference                                                                                                                                                         |
| Token cache race condition               | MEDIUM     | Identified from code structure; not reproduced                                                                                                                                                                                                         |
| Webhook signature validation strictness  | HIGH       | **FIXED v1.2**: fail-closed when secret missing. Code verified line-by-line.                                                                                                                                                                           |
| Screen share readiness                   | HIGH       | CallControlBar has prop, no screen passes it — confirmed code-absent                                                                                                                                                                                   |
| Settings wiring ("stored but not wired") | HIGH       | Each setting traced from service → consumer → Stream config                                                                                                                                                                                            |

---

## 13. Testing Guidance for a Future Agent

### 13.1 High-value manual test scenarios

1. **Basic outgoing audio call**: Start call from DM header → verify ringtone plays → remote accepts → verify audio flows both ways → end call → verify cleanup (no stale UI, back to previous screen)

2. **Basic incoming audio call**: Receive call → verify overlay appears with caller info → verify ringtone + vibration → accept → verify audio → hang up

3. **Incoming call while busy**: Be in a call → receive another call → verify auto-reject with "busy" (no overlay shown)

4. **DND rejection**: Enable DND → receive call → verify auto-reject without showing overlay

5. **Video call with camera**: Start video call → verify local PiP shows → verify remote video shows → toggle camera off/on → flip camera → end call

6. **Minimize and return (audio)**: Start audio call → tap back → verify floating banner appears → tap banner → verify return to call screen → end call

7. **Minimize and return (video)**: Start video call → tap back → verify floating video PiP → tap PiP → verify return to call screen

8. **Voice channel join/leave**: Navigate to group → join voice channel → verify mic enabled → see participants → leave → verify deliberate leave flag prevents auto-rejoin

9. **Voice channel while in direct call**: Be in a direct call → try to join voice channel → verify "already in a call" error

10. **Native accept adoption (iOS)**: Receive call while app backgrounded → accept via CallKit → verify app opens to call screen with audio working

11. **Call history verification**: Make calls → check CallsScreen → verify entries appear with correct type/direction/duration → filter by missed/direct/rooms

12. **Call settings persistence**: Change settings → kill app → reopen → verify settings restored

### 13.2 Risky transitions requiring careful testing

| Transition                         | Risk                                   | What to watch                                     |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------- |
| RINGING → JOINED (caller side)     | Stream auto-join must work             | Verify mic/camera enable after join               |
| Accept incoming → JOINED           | Permission requests during accept flow | Audio session must start before join              |
| Active → Minimize → Return         | State must persist                     | Verify same Call object used, no new call created |
| Joined → RECONNECTING → JOINED     | Network transition                     | Verify audio resumes, UI updates                  |
| Joined → RECONNECTING_FAILED       | Provider cleanup                       | Verify clean exit, no stuck UI                    |
| End call during RINGING            | Cancel vs decline                      | Verify correct reason sent to Stream              |
| Rapid accept/decline taps          | Race conditions                        | Verify acceptingRef prevents auto-reject          |
| Voice channel join failure         | joinAttemptedRef stuck                 | Verify Retry + Go Back buttons work (fixed v1.3)  |
| Settings change during active call | Live update                            | Verify settings don't disrupt active call         |

### 13.3 Edge cases

1. Both users tap "end" simultaneously → verify no crash, both clean up
2. Network drops during call setup → verify error message and cleanup
3. User denies microphone permission → verify call is not created, user sees error
4. User switches between WiFi and cellular during call → verify Stream handles reconnection
5. App force-quit during active call → verify next launch cleans up state
6. Receive call while on VoiceChannelScreen → verify auto-reject with busy
7. Two rapid call start taps → verify only one call created (busyRef guard)
8. Voice channel with 0 participants displayed → should show empty state or hide

### 13.4 What success/failure looks like

**Success indicators**:

- `activeSession` transitions cleanly: null → set → null
- `busyRef` always matches `activeSession !== null` after state settles
- `callManager.start()` paired with `callManager.stop()` (check console logs)
- No "Failed to..." warnings in console
- CallingState follows expected progression: IDLE → RINGING → JOINING → JOINED → LEFT
- Firestore `StreamCallHistory` entry created after call ends

**Failure indicators**:

- `activeSession` stuck (not null after call ends) → check callingState$ subscription
- Ghost "Return to call" banner visible when no call active → check FloatingVideoOverlay conditions
- Audio routing wrong (speaker when expecting earpiece) → check callManager.start() device parameter
- Console logs showing "callManager.start failed" or "callManager.stop failed"
- Missing history entries → check webhook, signature validation, Cloud Function logs

### 13.5 Areas to log heavily

- `StreamCallContext`: callingState$ transitions, activeSession changes
- `directCallService`: getOrCreate result, join state, device setup
- `callSessionManager`: start/stop calls with device type
- `IncomingCallHandler`: shouldAllowCall results, accept/reject actions
- `setPushConfig`: background client creation callback invocations
- `streamCallHistory` webhook: incoming events, participant resolution, Firestore writes

---

## 14. Concise Issue-Spotting Appendix

### Most likely sources of bugs

1. **VoiceChannelScreen join effect re-fire** — complex dependency array, `joinAttemptedRef` mask on failure
2. **DirectCallScreen auto-dismiss racing with user-initiated end** — double `goBack()` calls
3. **Audio session start/stop mismatches** — especially during rapid state transitions or error paths
4. **IncomingCallHandler accept vs auto-reject race** — mitigated by `acceptingRef` but timing-sensitive
5. **iOS background push delivery** — VoIP push architecture is code-complete but requires external APNs/Stream dashboard setup and real-device validation (v1.6)

### Most likely outdated assumptions

1. Any doc referencing `audio_room` call type — the app uses `default` for everything
2. Any doc referencing `CallContext.tsx` (legacy) — replaced by `StreamCallContext.tsx`
3. Any doc referencing Firestore signaling or WebRTC — completely replaced by Stream Video
4. ~~Any doc referencing `react-native-callkeep` or `react-native-webrtc` — removed~~ **CORRECTED v1.6**: `react-native-callkeep` v4.3.16 IS installed and used internally by the Stream SDK for iOS CallKit. `@stream-io/react-native-webrtc` v137.1.2 IS the active WebRTC engine. Old QA docs referencing standalone `react-native-webrtc` (pre-Stream) and manual CallKeep setup are outdated, but the packages themselves are active dependencies.
5. The assumption that `calls.ts` backend functions are active — they are not (but still deployed)
6. QA docs mentioning `VOICE_CHANNELS_ENABLED` flag — no such flag exists; voice channels are always enabled when calls are enabled

### Most important files to inspect first

1. `src/contexts/StreamCallContext.tsx` — the brain of the call system
2. `src/services/stream/directCallService.ts` — 1:1 call lifecycle
3. `src/components/stream/IncomingCallHandler.tsx` — incoming call handling, most complex component
4. `src/screens/stream/DirectCallScreen.tsx` — most effects, most state, most fragility
5. `src/services/stream/voiceChannelService.ts` — voice channel lifecycle
6. `firebase-backend/functions/src/streamCallHistory.ts` — server-side history (source of truth)

### Fastest ways to improve reliability

1. ~~**Fix `joinAttemptedRef` reset on failure**~~ — ✅ Done (v1.1)
2. ~~**Add call guard to speaker init effect**~~ — ✅ Done (v1.1)
3. ~~**Add camera-off guard to VoiceChannelScreen flip**~~ — ✅ Done (v1.1)
4. ~~**Add token fetch lock**~~ — ✅ Done (v1.1)
5. **Remove legacy `calls.ts`** (10 min) — delete file and remove from backend index, reduces confusion
6. ~~**Add error state to CallSettingsScreen**~~ — ✅ Done (v1.2)
7. ~~**Add Retry button to VoiceChannelScreen error UI**~~ — ✅ Done (v1.3)
8. ~~**Add jitter to polling intervals**~~ — ✅ Done (v1.3)
9. ~~**Add `_lastUpdatedAt` to `resetToDefaults()`**~~ — ✅ Done (v1.3)
10. ~~**Remove duplicate JSDoc in voiceChannelService.ts**~~ — ✅ Done (v1.3)

### Highest-risk flows

1. **Incoming call acceptance** — involves IncomingCallHandler accept, context state update, navigation, auto-reject guard, audio session start, and Stream join — many interleaving points
2. **Voice channel join on mount** — complex effect with many dependencies, one-shot ref, and async join that can fail silently
3. **Call end with concurrent provider cleanup** — user-initiated end and `callingState$` subscription can both trigger cleanup simultaneously
4. **iOS background call push** — VoIP push + CallKit architecture is code-complete (v1.6); requires external Apple/Stream config and physical device testing to confirm end-to-end delivery
5. **Minimize → return → end** — three navigation operations that each affect call state, audio session, and UI overlay visibility

---

## Appendix A: Existing Documentation Status

| Document                              | Status                               | Disposition                                                 |
| ------------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `docs/features/calls-and-audio.md`    | ⚠️ Mostly accurate but incomplete    | Superseded by this document                                 |
| `docs/CALL_SYSTEM_AUDIT_REFERENCE.md` | 🚫 Legacy (2026-03-30)               | Already self-marked as deprecated                           |
| `docs/QA_CALL_SYSTEM_AUDIT.md`        | 🚫 Historical (pre-Stream migration) | References WebRTC/Firestore stack. Keep as historical only. |
| `docs/QA_CALLING_AUDIT.md`            | ⚠️ Partially current                 | Fixed real bugs but references are to earlier code state    |
| `docs/QA_STREAM_CALL_SYSTEM.md`       | ⚠️ Partially current                 | Good audit but some findings already fixed                  |
| `docs/STREAM_SETUP_GUIDE.md`          | ✅ Mostly current                    | Push provider names and webhook setup still accurate        |

**Recommendation**: All of the above docs should reference this master document as the current source of truth. They can be retained as historical context but should not be used for implementation decisions.

---

## Appendix B: Environment and Configuration Requirements

### Stream Dashboard Configuration

- **API Key**: Set in `STREAM_API_KEY` env var (backend functions)
- **API Secret**: Set in `STREAM_API_SECRET` env var (backend functions)
- **Call type**: `default` (used for both direct calls and voice channels)
- **Push providers**:
  - Android Firebase: `vibe-firebase`
  - iOS APNs: `vibe-apn`
- **Webhook URL**: Points to deployed `streamCallWebhook` Cloud Function endpoint

### Native Build Requirements

- Stream Video SDK requires native modules (not compatible with Expo Go)
- Dev client, preview build, or production build required
- iOS background modes required: `audio`, `remote-notification`, `fetch`, `voip`
- iOS APS entitlement required
- Android permissions: microphone, camera, notification, Bluetooth connect, foreground service

### Verification Commands

```bash
npm run type-check          # TypeScript compilation
npm run lint                # ESLint
npm --prefix firebase-backend/functions run build  # Backend compilation
```
