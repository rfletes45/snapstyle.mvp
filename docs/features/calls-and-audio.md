# Calls and Audio

Last verified: 2026-04-03

## Scope

This is the current-state reference for the live Stream call stack:

- direct 1:1 audio calls
- direct 1:1 video calls
- group voice channels
- incoming ringing flow
- call history
- call settings

It replaces the legacy Firestore/WebRTC call stack as the description of the runtime that actually ships today.

## Canonical Flows

### Direct audio call

- Stream call type: `default`
- unique UUID call ID
- custom mode: `"audio"`
- ringing flow via `getOrCreate({ ring: true })`

### Direct video call

- Stream call type: `default`
- unique UUID call ID
- custom mode: `"video"`
- ringing flow via `getOrCreate({ ring: true, video: true })`

### Group voice channel

- Stream call type: `default`
- deterministic room ID: `voice_channel_{groupId}`
- no ringing
- shared join/leave room behavior

Important correction from older docs:

- the live voice-channel implementation does not use Stream `audio_room`
- `audio_room` is a backstage/request-to-speak model in Stream docs, not the open Discord-style room this app implements

## Main Files

Provider and screens:

- [StreamCallContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/contexts/StreamCallContext.tsx)
- [IncomingCallHandler.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/stream/IncomingCallHandler.tsx)
- [DirectCallScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/stream/DirectCallScreen.tsx)
- [VoiceChannelScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/stream/VoiceChannelScreen.tsx)
- [CallsScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/calls/CallsScreen.tsx)

Stream services:

- [streamClient.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/streamClient.ts)
- [callSessionManager.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/callSessionManager.ts)
- [directCallService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/directCallService.ts)
- [voiceChannelService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/voiceChannelService.ts)
- [streamCallHistoryService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/streamCallHistoryService.ts)
- [setPushConfig.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/utils/setPushConfig.ts)

Backend:

- [streamToken.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/streamToken.ts)
- [streamCallHistory.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/streamCallHistory.ts)

## Architecture

`StreamCallProvider` owns the live media-session model.

Current responsibilities:

- initialize one `StreamVideoClient` after auth and profile hydration
- keep `<StreamVideo>` mounted at the app root
- expose direct-call and voice-channel actions through context
- enforce one active media session at a time
- perform provider-level cleanup on `LEFT`, `IDLE`, and `RECONNECTING_FAILED`

The provider is the authoritative cleanup layer. Individual screens render state and dispatch explicit user actions, but they do not own call disposal anymore.

## Direct Call Lifecycle

Outgoing ringing calls follow Stream’s documented flow:

1. best-effort provision Stream users
2. request microphone permission, and camera permission only if local auto-video is enabled
3. `call.getOrCreate({ ring: true })`
4. start `callManager` before media join
5. let Stream auto-join the caller when the first callee accepts
6. enable local mic/camera after the call reaches `JOINED`

Incoming direct calls:

1. `IncomingCallHandler` watches `useCalls()` from the root tree
2. app-level DND / privacy gates run before presenting the in-app accept UI
3. accept uses `call.join()` and idempotent local device setup
4. decline uses `call.leave({ reject: true, reason: "decline" })`

Important corrections:

- the caller does not manually `join()` immediately after `getOrCreate({ ring: true })`
- canceling an unanswered outgoing call uses `call.leave({ reject: true, reason: "cancel" })`
- native-accepted calls can be adopted safely without attempting a second `join()`
- `callManager.start()` is paired with `callManager.stop()` on every exit path

## Voice Channel Lifecycle

Voice channels are non-ringing rooms on the `default` call type.

Current behavior:

- room identity is deterministic per group
- join requests microphone permission deliberately
- local audio routing starts before join and stops on leave/cleanup
- room teardown is provider-driven, so minimized/backgrounded rooms cannot leave stale active state behind

Room occupancy/discovery:

- the app intentionally uses the low-level `/calls` query through the Stream client instead of `queryCalls()`
- reason: the current RN SDK materializes queried `Call` objects and applies device config during `queryCalls()`, which is not acceptable for read-only occupancy checks on iOS
- this deviation is intentional, documented, and isolated to `queryVoiceChannel()`

## Push and Incoming Calls

Push handling is split into two parts:

- `setPushConfig()` in [setPushConfig.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/utils/setPushConfig.ts) configures provider names, channels, and background client creation
- the mounted `<StreamVideo>` provider runs the RN SDK’s built-in push registration hooks for Android tokens, iOS APNs tokens, and iOS VoIP tokens

Important correction:

- the app does not need a separate custom `streamPushRegistration.ts` layer
- logout cleanup must call `StreamVideoRN.onPushLogout()` before disconnecting the Stream client

## Call History

History is server-authoritative.

Storage:

- `Users/{uid}/StreamCallHistory/{entryId}`

Writers:

- Cloud Function webhook only

Handled Stream webhook events:

- `call.session_ended`
- `call.rejected`
- `call.missed`

Important corrections:

- the client no longer writes durable Stream history documents directly
- voice-room history is detected from deterministic room metadata / call ID, not `call.type === "audio_room"`
- voice-room history uses session participants, not call members

## Call Settings

The active settings service lives at [callSettingsService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/calls/callSettingsService.ts).

Current settings areas:

- audio output defaults
- camera defaults
- ringtone and vibration
- privacy options
- DND schedule
- quality/data options
- accessibility options

Known caveat:

- the DND time-range rows in `CallSettingsScreen` still show placeholder alerts instead of a real time picker

## Runtime Boundaries

### Stream owns

- live media transport
- ringing-call state
- participant state
- push-token registration inside the RN SDK provider

### Firebase owns

- auth for token issuance
- `getStreamVideoToken`
- webhook-authenticated call history persistence
- the rest of the app’s non-call notification system

## Legacy and Historical Docs

These are historical references, not the live runtime source of truth:

- old Firestore/WebRTC call docs
- `firebase-backend/functions/src/calls.ts`
- older QA docs that describe `audio_room` as the active voice-channel implementation

When docs disagree, prefer this file plus the active source files listed above.

## Recommended Validation

```bash
npm run type-check
npm run lint
npm --prefix firebase-backend/functions run build
```
