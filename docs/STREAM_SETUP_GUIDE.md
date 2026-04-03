# Stream Setup Guide

Last verified: 2026-04-03

## Purpose

This guide documents the Stream configuration required by the current codebase.

It is intentionally focused on the live implementation and avoids embedding live credential values.

## What The Code Already Does

The current app already includes:

- Stream client initialization in [streamClient.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/streamClient.ts)
- app-entry push config in [setPushConfig.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/utils/setPushConfig.ts)
- direct call creation in [directCallService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/directCallService.ts)
- voice channel creation in [voiceChannelService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/voiceChannelService.ts)
- token issuance in [streamToken.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/streamToken.ts)
- webhook-based history writes in [streamCallHistory.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/streamCallHistory.ts)

Important correction:

- the mounted `StreamVideo` provider already runs Stream’s built-in RN push-registration hooks
- do not add a second custom device-registration layer for Stream call pushes

## Required Functions Environment Variables

Set these in `firebase-backend/functions/.env`:

```env
STREAM_API_KEY=...
STREAM_API_SECRET=...
APPLE_SHARED_SECRET=...
ANDROID_PACKAGE_NAME=com.vibeapp.mobile
```

Notes:

- `STREAM_API_KEY` is safe to return to the client
- `STREAM_API_SECRET` stays server-side and is also used to verify webhook signatures
- do not paste real values into docs or commits

## Build and Deploy Functions

```bash
npm --prefix firebase-backend/functions run build
firebase deploy --only functions
```

After deploy, verify:

- `getStreamVideoToken` is reachable
- `streamCallWebhook` is deployed

## Call Types Required In Stream

Current runtime truth:

- direct calls use Stream call type `default`
- voice channels also use Stream call type `default`

Important correction from older docs:

- the current voice-channel implementation does not use `audio_room`
- the Stream dashboard does not need `audio_room` configured for the live app flow

Why voice channels still use `default`:

- everyone can freely send audio
- no backstage or request-to-speak semantics are required
- this matches a Discord-style room more closely than Stream’s documented `audio_room` flow

## Push Provider Names

The provider names configured in Stream must match the names used by [setPushConfig.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/utils/setPushConfig.ts):

- Android Firebase provider name: `vibe-firebase`
- iOS APNs / VoIP provider name: `vibe-apn`

If those names differ in the Stream dashboard, incoming background call handling will fail even if credentials are otherwise valid.

## Native App Build Requirements

Stream calls require a native build:

- dev client
- preview build
- production build

They do not run in Expo Go because native Stream/WebRTC modules are unavailable there.

## iOS and Android App Config

Relevant current `app.config.ts` state:

- plugin includes `@stream-io/video-react-native-sdk`
- iOS background modes include `audio`, `remote-notification`, `fetch`, and `voip`
- iOS APS entitlement is configured
- Android includes microphone, camera, notification, Bluetooth, and foreground-service permissions

## Webhook Setup

The Stream webhook should point to the deployed `streamCallWebhook` endpoint.

Current backend behavior:

- validates `X-Signature` using `STREAM_API_SECRET`
- writes `Users/{uid}/StreamCallHistory/{entryId}`
- handles these event types:
  - `call.session_ended`
  - `call.rejected`
  - `call.missed`

If those event types are not enabled in Stream, direct-call history will be incomplete.

## Push Flow Summary

There are two separate push systems:

- app notifications: Expo push tokens stored in Firebase
- Stream call pushes: device tokens managed by Stream’s RN SDK integration

Current Stream push behavior:

- `setPushConfig()` is called at app entry
- `createStreamVideoClient` uses `StreamVideoClient.getOrCreateInstance()`
- the mounted `<StreamVideo>` provider registers Android, iOS APNs, and iOS VoIP tokens as needed
- logout cleanup uses `StreamVideoRN.onPushLogout()`

## Verification Checklist

1. Functions env contains `STREAM_API_KEY` and `STREAM_API_SECRET`.
2. Functions build and deploy cleanly.
3. Stream dashboard provider names match `vibe-firebase` and `vibe-apn`.
4. A native dev client or release build is used.
5. The device grants notification permission.
6. The app initializes Stream without token errors.
7. A direct call rings on another physical device.
8. Direct-call cancel / decline / missed events appear in `StreamCallHistory`.
9. Completed calls and voice-room sessions appear in `StreamCallHistory`.

## Common Failure Modes

### Calls unavailable in development

Cause:

- running in Expo Go

Fix:

- use a dev client or release build

### Token function fails

Check:

- `STREAM_API_KEY`
- `STREAM_API_SECRET`
- Functions deployment status

### Background ringing does not work

Check:

- provider names in Stream dashboard
- native notification permissions
- physical device versus emulator/simulator
- app-entry `setPushConfig()` logs
- iOS `voip` background mode and capabilities

### Voice channel setup fails with call-type confusion

Check:

- do not configure the docs or dashboard assuming `audio_room`
- the current code expects `default`
