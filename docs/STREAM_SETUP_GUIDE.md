# Stream Setup Guide

Last verified: 2026-03-30

## Purpose

This guide documents the Stream configuration required by the current codebase.

It is intentionally focused on the live implementation and avoids embedding live credential values.

## What The Code Already Does

The current app already includes:

- Stream client initialization in [streamClient.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/streamClient.ts)
- native push registration for Stream ringing in [streamPushRegistration.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/streamPushRegistration.ts)
- direct call creation in [directCallService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/directCallService.ts)
- voice channel creation in [voiceChannelService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/stream/voiceChannelService.ts)
- token issuance in [streamToken.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/streamToken.ts)
- webhook-based history writes in [streamCallHistory.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/streamCallHistory.ts)

You do not need to add a brand-new Stream push registration layer; that code is already present.

## Required Functions Environment Variables

Set these in `firebase-backend/functions/.env`:

```env
STREAM_API_KEY=...
STREAM_API_SECRET=...
APPLE_SHARED_SECRET=...
ANDROID_PACKAGE_NAME=com.vibeapp.mobile
```

Notes:

- `STREAM_API_KEY` is used by the token function and is safe to return to the client
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

Why voice channels still use `default`:

- everyone can freely send audio
- no backstage or host-only audio semantics are required
- this matches a Discord-style room more closely than a moderated audio room

## Push Provider Names

The provider names in Stream must match the names used by `streamPushRegistration.ts`:

- Android Firebase provider name: `vibe-firebase`
- iOS APNs provider name: `vibe-apn`

If those names differ in the Stream dashboard, incoming background call ringing will fail even if credentials are otherwise valid.

## Native App Build Requirements

Stream calls require a native build:

- dev client
- preview build
- production build

They do not run in Expo Go because native Stream/WebRTC modules are unavailable there.

## iOS and Android App Config

Relevant current `app.config.ts` state:

- plugin includes `@stream-io/video-react-native-sdk`
- iOS background modes: `audio`, `remote-notification`, `fetch`
- iOS APS entitlement is configured
- Android includes microphone, camera, notification, and foreground-service permissions

Important correction from older docs:

- the current app config does not declare `voip` background mode

## Webhook Setup

The Stream webhook should point to the deployed `streamCallWebhook` endpoint.

Current backend behavior:

- validates `X-Signature` using `STREAM_API_SECRET`
- processes call-session events for history recording
- writes `Users/{uid}/StreamCallHistory/{entryId}`

## Push Flow Summary

There are two separate push systems:

- app notifications: Expo push tokens stored in Firebase
- call ringing: native device tokens registered with Stream

Current Stream registration behavior:

- the app checks push permission
- reads the native device push token
- registers it with Stream under `vibe-firebase` or `vibe-apn`
- unregisters it on Stream client teardown

## Verification Checklist

1. Functions env contains `STREAM_API_KEY` and `STREAM_API_SECRET`.
2. Functions build and deploy cleanly.
3. Stream dashboard provider names match `vibe-firebase` and `vibe-apn`.
4. A native dev client or release build is used.
5. The device grants push permissions.
6. The app initializes Stream without token errors.
7. A direct call rings on another physical device.
8. A completed call produces `StreamCallHistory` entries in Firestore.

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
- native push permissions
- physical device versus emulator/simulator
- Stream push registration logs from `streamPushRegistration.ts`

### Voice channel creation fails with call-type confusion

Check:

- do not configure the docs or dashboard assuming `audio_room`
- the current code expects `default`
