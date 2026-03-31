# Calls and Audio

Last verified: 2026-03-30

## Scope

This is the current-state reference for the live call stack:

- Stream direct calls
- Stream-backed group voice channels
- incoming call handling
- call history
- call settings

It supersedes the old Firestore/WebRTC call architecture as the description of the runtime that actually ships today.

## Current Status

- direct calls: implemented
- group voice channels: implemented
- incoming ringing flow: implemented
- call history: implemented
- call settings: implemented, with some placeholder UI in DND scheduling
- legacy Firestore/WebRTC call stack: not the active runtime

## Main Files

Provider and screens:

- [StreamCallContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/contexts/StreamCallContext.tsx)
- [IncomingCallHandler.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/stream/IncomingCallHandler.tsx)
- [CallsScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/calls/CallsScreen.tsx)
- [CallSettingsScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/calls/CallSettingsScreen.tsx)
- [DirectCallScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/stream/DirectCallScreen.tsx)
- [VoiceChannelScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/stream/VoiceChannelScreen.tsx)

Stream services:

- [streamClient.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/streamClient.ts)
- [streamPushRegistration.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/streamPushRegistration.ts)
- [directCallService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/directCallService.ts)
- [voiceChannelService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/voiceChannelService.ts)
- [streamCallHistoryService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/streamCallHistoryService.ts)

Backend:

- [streamToken.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/streamToken.ts)
- [streamCallHistory.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/streamCallHistory.ts)

## Availability and Gating

Calling is gated by `CALL_FEATURES.CALLS_ENABLED`.

Current behavior:

- enabled when Stream native modules are available
- disabled automatically in Expo Go
- available in native dev-client, preview, and production builds

This means the docs should not describe calls as universally available across all Expo environments.

## Architecture

`StreamCallProvider` owns the live media session model.

Current responsibilities:

- initialize a single `StreamVideoClient` after auth and profile hydration
- destroy the client on logout
- enforce a single active media session at a time
- expose direct-call and voice-channel actions through context
- record history when sessions end

There is no active `CallProvider` in the current app shell.

## Direct Calls

Direct calls use Stream ringing with:

- call type: `"default"`
- unique UUID call IDs
- mode: `"audio"` or `"video"`

Flow:

1. initialize/get the Stream client
2. best-effort provision Stream users
3. `getOrCreate` the call with `ring: true`
4. join the call
5. set final camera/mic state

Incoming ringing is handled globally by `IncomingCallHandler`.

## Group Voice Channels

Group voice channels are also Stream calls, but they are treated as non-ringing rooms.

Current implementation details:

- deterministic channel ID: `voice_channel_{groupId}`
- call type: `"default"`
- no ringing
- camera is forced off after join

Important correction from older docs:

- the live implementation does not use Stream `audio_room`
- the service explicitly explains that `"default"` is used so all participants can freely send audio without backstage/host restrictions

## History and Calls Tab

The Calls tab combines:

- active/joinable voice-room data
- Stream call history stored in Firestore

History documents are written server-side by the Stream webhook into:

- `Users/{uid}/StreamCallHistory/{entryId}`

## Push Registration

There are two different push systems in play:

- Expo push tokens for the app’s own notification system
- native device tokens registered with Stream for incoming call ringing

Current Stream push registration is already implemented in code:

- Android provider name: `vibe-firebase`
- iOS provider name: `vibe-apn`
- registration happens from `streamClient.ts`
- unregister happens on Stream client teardown

This means the setup doc should talk about verification and provider naming, not imply that the app still needs a new push-registration code path added.

## Call Settings

The active settings service lives under `src/services/calls/callSettingsService.ts`. The old broader call service stack is not the active call transport anymore.

Current settings areas:

- camera defaults
- audio defaults
- ringtone and vibration
- privacy options
- DND schedule
- quality/data options
- accessibility options

Known caveat:

- the DND time range rows in `CallSettingsScreen` still show placeholder alerts instead of a real time picker

## Runtime Boundaries

### Stream owns

- live media transport
- ringing calls
- participant state
- device registration for native call push delivery

### Firebase owns

- auth for token issuance
- `getStreamVideoToken`
- call history persistence
- the rest of the app’s push notification system

## Legacy and Non-Canonical Surfaces

The following are not the live calling runtime anymore:

- old Firestore/WebRTC call docs
- `firebase-backend/functions/src/calls.ts`
- old `src/services/calls/*` transport assumptions

What is still active from `src/services/calls/`:

- `callSettingsService`

## Recommended Validation

```bash
npm run type-check
npm run lint
npm run test
npm --prefix firebase-backend/functions run build
```
