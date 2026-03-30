# Stream Video SDK — Complete Setup Guide

Last updated: 2026-03-29

This guide walks you through every step required to get Stream Video fully operational for the Vibe app, from dashboard creation through push notifications.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create Your Stream Account & App](#2-create-your-stream-account--app)
3. [Configure Firebase Functions with Stream Credentials](#3-configure-firebase-functions-with-stream-credentials)
4. [Deploy Cloud Functions](#4-deploy-cloud-functions)
5. [Configure Call Types in Stream Dashboard](#5-configure-call-types-in-stream-dashboard)
6. [Configure Webhooks in Stream Dashboard](#6-configure-webhooks-in-stream-dashboard)
7. [Set Up Push Notifications — Firebase Cloud Messaging (Android)](#7-set-up-push-notifications--firebase-cloud-messaging-android)
8. [Set Up Push Notifications — APNs (iOS)](#8-set-up-push-notifications--apns-ios)
9. [Register Push Tokens in the App (Code Change Required)](#9-register-push-tokens-in-the-app-code-change-required)
10. [Verify google-services.json and GoogleService-Info.plist](#10-verify-google-servicesjson-and-googleservice-infoplist)
11. [Build and Test](#11-build-and-test)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

Before starting, ensure you have:

- [ ] A [Stream](https://getstream.io) account (free tier works for development)
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] EAS CLI installed (`npm install -g eas-cli`)
- [ ] Access to the [Firebase Console](https://console.firebase.google.com) for project `gamerapp-37e70`
- [ ] Access to the [Apple Developer Console](https://developer.apple.com) (Team ID: `495669RCD5`)
- [ ] Access to the [Google Cloud Console](https://console.cloud.google.com) for FCM credentials

---

## 2. Create Your Stream Account & App

### 2a. Sign up / log in

1. Go to **https://dashboard.getstream.io**
2. Sign up or log in

### 2b. Create a new app (if you haven't already)

1. Click **"Create App"**
2. Fill in:
   - **App Name:** `Vibe` (or `Vibe-Dev` for development)
   - **Region:** Choose the region closest to your users (e.g., `us-east` for US)
3. Click **Create**

### 2c. Copy your credentials

On the app dashboard page, you'll see:

| Field          | Example Value                            | Where It Goes                                 |
| -------------- | ---------------------------------------- | --------------------------------------------- |
| **API Key**    | `mmhfdzb5evj2` (public, safe for client) | Firebase Functions config                     |
| **API Secret** | `abcdef123456...` (PRIVATE, server only) | Firebase Functions config (NEVER commit this) |

> **Important:** The API Key is public and gets sent to the client alongside the token. The API Secret must NEVER be exposed to client code — it stays server-side only.

---

## 3. Configure Firebase Functions with Stream Credentials

Firebase Cloud Functions read secrets from a `.env` file at `firebase-backend/functions/.env`. This file is gitignored (contains secrets).

Open the file `firebase-backend/functions/.env` and fill in your Stream credentials:

```env
# Stream Video SDK credentials (from https://dashboard.getstream.io)
STREAM_API_KEY=wje4zg7uyvyw
STREAM_API_SECRET=nmgn5uvws9eh9zd99f97ghb8msjwc264rntghy4scxcyguq4gah6eh3z8faekwyc

# Apple IAP shared secret (from App Store Connect)
APPLE_SHARED_SECRET=

# Android package name
ANDROID_PACKAGE_NAME=com.vibeapp.mobile
```

The `STREAM_API_KEY` and `STREAM_API_SECRET` values above are already filled in from your Stream Dashboard. The API Secret is also used to verify webhook signatures (no separate webhook secret is needed — see step 6).

**Verify deployment works:**

```powershell
cd firebase-backend/functions
npm run build
cd ../..
firebase deploy --only functions
```

> **How it works:** Your Cloud Function `getStreamVideoToken` (in `firebase-backend/functions/src/streamToken.ts`) reads `process.env.STREAM_API_KEY` and `process.env.STREAM_API_SECRET` at runtime. Firebase automatically loads the `.env` file when deploying and running functions. The client app calls this function to get a token + the public API key. The secret never leaves the server.
>
> **Note:** The old `functions.config()` / `firebase functions:config:set` API was deprecated and removed in March 2026. This project now uses `.env` files with `process.env` instead.

---

## 4. Deploy Cloud Functions

```powershell
cd firebase-backend/functions

# Install dependencies (if not already done)
npm install

# Build TypeScript
npm run build

# Deploy all functions (from the project root)
cd ../..
firebase deploy --only functions
```

After deployment, note the **webhook URL** from the output. It will look like:

```
https://us-central1-gamerapp-37e70.cloudfunctions.net/streamCallWebhook
```

Save this URL — you'll need it for step 6.

> **Verify the token function works:** After deploy, open your app in a dev client build, log in, and check the console for `[StreamClient]` logs. If the client initializes without errors, token generation is working.

---

## 5. Configure Call Types in Stream Dashboard

Your app uses two Stream call types. The code references are:

- `DIRECT_CALL_TYPE = "default"` in `src/services/stream/directCallService.ts` — 1:1 ringing calls
- `VOICE_CHANNEL_TYPE = "audio_room"` in `src/services/stream/voiceChannelService.ts` — group voice channels

Both types must exist on the Stream Dashboard before calls will work.

### 5a. Navigate to Call Types

1. Log in to **https://dashboard.getstream.io**
2. Select your **Vibe** app
3. In the left sidebar, click **Video & Audio**
4. Click **Call Types** in the submenu

You'll see a list of call types. Stream auto-creates `default` when you create your app.

### 5b. Verify/configure the `default` call type

Click on **default** to open its settings. Verify or set:

| Setting               | Required Value | Why                                                                                              |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| **Ringing**           | ✅ Enabled     | Your app calls `call.getOrCreate({ ring: true })` — without this, the callee never gets notified |
| **Ringing timeout**   | 30 seconds     | How long the caller waits before the call is auto-cancelled (pick 30-60s)                        |
| **Max call duration** | 3600 (1 hour)  | Safety limit; set to whatever makes sense                                                        |
| **Max participants**  | 2              | Your direct calls are 1:1 (caller + callee). Setting this to 2 prevents accidental multi-party   |
| **Recording**         | Off            | Unless you plan to record calls                                                                  |
| **Backstage**         | Off            | Backstage is for livestream-style calls, not relevant here                                       |
| **Audio — speaker**   | On             | Your code sets `default_device: "speaker"` in `settings_override`                                |
| **Video — enabled**   | On             | Your code supports both `"audio"` and `"video"` modes; camera is toggled via `camera_default_on` |

Click **Save** after making changes.

**How your code uses it:** When User A calls User B, `directCallService.ts` runs:

```
client.call("default", callId)
call.getOrCreate({ ring: true, data: { members: [callerUid, calleeUid], custom: { mode } } })
call.join({ ring: true, settings_override: { audio: { mic_default_on: true }, video: { camera_default_on: mode === "video" } } })
```

The `ring: true` flag tells Stream to send a ringing notification to the callee. If the callee has a registered push device (step 9), they get a push notification even when the app is backgrounded.

### 5c. Create the `audio_room` call type

If `audio_room` does **not** already appear in the list:

1. Click **"Create Call Type"** (button at top of the call types list)
2. Set these values:

| Setting              | Required Value | Why                                                                        |
| -------------------- | -------------- | -------------------------------------------------------------------------- |
| **Name**             | `audio_room`   | Must match exactly — your code uses `client.call("audio_room", channelId)` |
| **Ringing**          | ❌ Disabled    | Voice rooms are join-on-demand; nobody gets "called"                       |
| **Max participants** | 25             | Or whatever your group voice room cap should be                            |
| **Recording**        | Off            | Unless you want voice room recordings                                      |
| **Backstage**        | Off            | Not needed for open voice rooms                                            |
| **Audio — speaker**  | On             | Your code sets `default_device: "speaker"`                                 |
| **Video — enabled**  | Off            | Voice channels are audio-only; your code sets `camera_default_on: false`   |

3. Click **Create**

**How your code uses it:** When a user taps a voice room, `voiceChannelService.ts` runs:

```
client.call("audio_room", `voice_channel_${groupId}`)
call.getOrCreate({ data: { custom: { groupId, groupName } } })
call.join({ settings_override: { audio: { mic_default_on: true }, video: { camera_default_on: false } } })
```

No `ring: true` means no push notifications — participants join and leave freely like a Discord voice channel.

### 5d. Verify both types are active

Back on the **Call Types** list page, you should see:

| Call Type    | Ringing  | Status |
| ------------ | -------- | ------ |
| `default`    | Enabled  | Active |
| `audio_room` | Disabled | Active |

If either type's name doesn't match exactly, calls will fail with a "call type not found" error.

---

## 6. Configure Webhooks in Stream Dashboard

The webhook powers your call history system. When any call ends, Stream sends a `call.session_ended` event to your Cloud Function, which records the call in each participant's Firestore subcollection.

### 6a. How Stream webhook authentication works

Stream does **NOT** have a separate "webhook secret" field in their Dashboard. Instead, Stream automatically signs every webhook request using your **API Secret** (the same one in your `.env` file as `STREAM_API_SECRET`). It works like this:

1. Stream takes the raw POST body of the webhook
2. Computes an HMAC-SHA256 hash using your **API Secret** as the key
3. Sends the hex digest in the **`X-Signature`** header
4. Your webhook handler recomputes the HMAC and compares — if they match, the request is authentic

**You don't need to configure any secret in the Dashboard** — it uses your API Secret automatically. Your `streamCallWebhook` Cloud Function already verifies this using `process.env.STREAM_API_SECRET`.

### 6b. Configure the webhook via the Stream API

Stream Video webhook configuration is done via the **API**, not through a Dashboard UI form. You'll use a one-time Node.js script to register your webhook URL.

**Option A: Use the Stream Dashboard (if available)**

Some Dashboard versions have a webhooks section at:

- **Video & Audio → Overview → Webhooks** or
- **App Settings → General → Webhooks**

If you see a webhook URL field there, paste:

```
https://us-central1-gamerapp-37e70.cloudfunctions.net/streamCallWebhook
```

**Option B: Use a script (recommended — guaranteed to work)**

Create a one-time setup script. Run this from your `firebase-backend/functions` directory:

```bash
npx ts-node -e "
const { StreamClient } = require('@stream-io/node-sdk');
const client = new StreamClient('wje4zg7uyvyw', process.env.STREAM_API_SECRET || 'YOUR_SECRET_HERE');
client.video.updateCallType('default', {
  notification_settings: {
    enabled: true,
    call_live_started: { enabled: false },
    session_started: { enabled: true },
  },
});
client.updateAppSettings({
  webhook_url: 'https://us-central1-gamerapp-37e70.cloudfunctions.net/streamCallWebhook',
}).then(() => console.log('Webhook URL configured!')).catch(console.error);
"
```

Or, even simpler — use a **cURL** command to set it:

```bash
curl -X PATCH "https://video.stream-io-api.com/api/v2/app?api_key=wje4zg7uyvyw" \
  -H "Authorization: wje4zg7uyvyw:nmgn5uvws9eh9zd99f97ghb8msjwc264rntghy4scxcyguq4gah6eh3z8faekwyc" \
  -H "Content-Type: application/json" \
  -H "stream-auth-type: jwt" \
  -d '{"webhook_url": "https://us-central1-gamerapp-37e70.cloudfunctions.net/streamCallWebhook"}'
```

> **Note:** You can also set specific events using the `event_hooks` array via the API. For now, the webhook handler ignores everything except `call.session_ended`, so receiving all events is fine.

### 6c. Verify the webhook is configured

After setting the webhook URL, check it's applied:

```powershell
firebase functions:log --only streamCallWebhook
```

You can also verify your app settings via the API:

```bash
curl "https://video.stream-io-api.com/api/v2/app?api_key=wje4zg7uyvyw" \
  -H "Authorization: wje4zg7uyvyw:nmgn5uvws9eh9zd99f97ghb8msjwc264rntghy4scxcyguq4gah6eh3z8faekwyc" \
  -H "stream-auth-type: jwt"
```

Look for `"webhook_url"` in the response — it should show your Cloud Function URL.

### 6d. What the webhook does (reference)

When a call ends, `streamCallWebhook` in `firebase-backend/functions/src/streamCallHistory.ts`:

1. **Validates** the request: POST method, verifies `X-Signature` HMAC using your API Secret
2. **Filters** to only `call.session_ended` events (ignores everything else)
3. **Parses** the call data: call type, participants, duration, who created it
4. **For each participant**, creates a `StreamCallHistoryEntry` document at:
   ```
   Users/{participantUid}/StreamCallHistory/{entryId}
   ```
5. **Direct calls**: Records direction (incoming/outgoing) and result (completed if >2s, missed if <2s and incoming)
6. **Voice rooms**: Records as "joined" / "left" with participant count

This is what populates the **Calls** tab in the app (via `useStreamCallHistory` → `subscribeToStreamCallHistory`).

---

## 7. Set Up Push Notifications — Firebase Cloud Messaging (Android)

This enables incoming call push notifications on Android when the app is backgrounded or killed. Without this, calls only ring when the app is in the foreground (via the WebSocket connection).

### Understanding the push flow

Here's what happens when User A calls User B on Android:

```
User A taps "Call"
  → app calls client.call("default", callId).getOrCreate({ ring: true })
  → Stream server sees ring:true + User B is a member
  → Stream server looks up User B's registered FCM device token
  → Stream sends FCM push to User B's device
  → Android wakes the app / shows a notification
  → User B's app receives the push → IncomingCallHandler shows the call overlay
```

**If User B has no registered FCM token with Stream, step 4 is skipped and the call only rings if User B's app is actively connected.**

### 7a. Enable the Firebase Cloud Messaging API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project **gamerapp-37e70** from the project dropdown
3. Navigate to **APIs & Services → Enabled APIs**
4. Search for **"Firebase Cloud Messaging API"** (the v1 API, NOT the legacy one)
5. If it's not enabled, click **Enable**

> This is the modern FCM HTTP v1 API. Google deprecated the legacy server key API — Stream's dashboard supports both, but v1 is the correct choice.

### 7b. Create a service account key for FCM v1

Stream needs a Google service account JSON key to send push notifications via FCM v1:

1. In [Google Cloud Console](https://console.cloud.google.com) → project **gamerapp-37e70**
2. Go to **IAM & Admin → Service Accounts**
3. You should see an account like `firebase-adminsdk-xxxxx@gamerapp-37e70.iam.gserviceaccount.com`
4. Click on that account
5. Go to the **Keys** tab
6. Click **Add Key → Create New Key**
7. Select **JSON** format
8. Click **Create** — a `.json` file will download

> **Security:** This key grants server-level access. Never commit it to your repo, never put it in client code. You're only uploading it to Stream's dashboard (which uses it server-side to send pushes).

### 7c. Upload the FCM credential to Stream Dashboard

1. In the Stream Dashboard, go to your **Vibe** app
2. Navigate to **Push Notifications** in the sidebar (or **App Settings → Push Notifications**)
3. Click **"New Configuration"** (or the **+** button)
4. Select **Firebase** as the provider type
5. You'll see a form titled **"New Push Configuration — Firebase"**. Fill in each field:

| Field                | Value                           | Notes                                                                                                                                                                |
| -------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enabled**          | ✅ Toggle ON                    | This activates the provider                                                                                                                                          |
| **Name**             | `vibe-firebase`                 | **Required.** This is an internal identifier — pick something descriptive. It must match what `addDevice()` passes in step 9. Use lowercase with hyphens, no spaces. |
| **Description**      | `Vibe app FCM push for Android` | Optional — just for your reference in the Dashboard                                                                                                                  |
| **Credentials JSON** | _(upload the file from 7b)_     | Click "Upload" or paste the JSON content of the service account key file you downloaded in step 7b                                                                   |

6. Click **Create**

> **About the "push notification templates" note at the bottom:** The Dashboard mentions that "push notification templates are now configured per notification type." You can ignore this for now — Stream Video calls use data-only push payloads, and the default template works fine. Template customization is only needed if you want to change notification text/appearance.

**Verify:** After creating, you should see your `vibe-firebase` provider listed on the Push Notifications page with a green "Enabled" indicator.

### 7d. Ensure google-services.json exists for Android builds

Your app needs `google-services.json` bundled into the Android build so the FCM SDK can initialize. Check if it already exists:

```powershell
Test-Path android/app/google-services.json
```

If `False`:

1. Go to [Firebase Console](https://console.firebase.google.com) → project **gamerapp-37e70**
2. Click **Project Settings** (gear icon) → **General** tab
3. Scroll to **Your apps** → find the Android app with package `com.vibeapp.mobile`
   - **If no Android app exists:** Click **Add app → Android**, enter package name `com.vibeapp.mobile`, optionally enter app nickname "Vibe", click **Register app**
4. Click **Download google-services.json**
5. Place it at `android/app/google-services.json`

**Alternative — EAS secrets** (if you don't want the file in your repo):

```powershell
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./path/to/google-services.json
```

EAS will inject it at build time. The `expo-notifications` and `@stream-io/video-react-native-sdk` Expo config plugins handle the rest.

### 7e. Verify Android notification channels

Your app already creates the right notification channels in `src/services/notifications.ts`. The key ones for calls:

| Channel ID            | Name           | Importance | Purpose                  |
| --------------------- | -------------- | ---------- | ------------------------ |
| `vibe-incoming-calls` | Incoming Calls | MAX        | 1:1 call ringing pushes  |
| `vibe-group-calls`    | Group Calls    | HIGH       | Voice room invite pushes |

These are created in `setupAndroidChannel()` which runs the first time push notifications are registered. No changes needed here.

---

## 8. Set Up Push Notifications — APNs (iOS)

This enables incoming call push notifications on iOS. iOS uses Apple Push Notification service (APNs) instead of FCM.

### Understanding the iOS push flow

When User A calls User B on iOS:

```
User A taps "Call"
  → Stream server sees ring:true + User B is an iOS member
  → Stream server sends APNs push using your uploaded .p8 key
  → iOS wakes the app / shows a notification (or CallKit incoming call screen)
  → User B's app receives the push → IncomingCallHandler shows the call overlay
```

Your app already has the required iOS entitlements configured in `app.config.ts`:

- `UIBackgroundModes: ["audio", "voip", "remote-notification", "fetch"]` — allows background execution
- `aps-environment: "production"` — uses the production APNs endpoint

### 8a. Create an APNs Authentication Key (.p8)

A `.p8` key is a single key file that works for all your apps under the same Apple team, never expires, and works for both development and production. This is the recommended approach over per-app certificates.

1. Go to [Apple Developer Console](https://developer.apple.com/account)
2. Click **Certificates, Identifiers & Profiles** in the sidebar
3. Click **Keys** in the left menu
4. Click the **+** button to create a new key
5. Fill in:
   - **Key Name:** `Vibe Stream Push` (or any descriptive name)
   - Check the box for ✅ **Apple Push Notifications service (APNs)**
6. Click **Continue**
7. Review the details, then click **Register**
8. On the confirmation page:
   - **Download the `.p8` file** — click the Download button. **You can only download this file ONCE.** If you lose it, you must create a new key.
   - **Copy the Key ID** — it's displayed on this page (10-character alphanumeric string, e.g., `A1B2C3D4E5`)

**Save these three values — you need all three for Stream:**

| Value          | Where to find it                                    | Example                 |
| -------------- | --------------------------------------------------- | ----------------------- |
| `.p8` key file | Downloaded in this step                             | `AuthKey_A1B2C3D4E5.p8` |
| Key ID         | Shown on the key page after creation                | `A1B2C3D4E5`            |
| Team ID        | Your Apple Developer account → Membership → Team ID | `495669RCD5`            |

### 8b. Upload APNs credentials to Stream Dashboard

1. In the Stream Dashboard, go to your **Vibe** app
2. Navigate to **Push Notifications** in the sidebar (same page as step 7c)
3. Click **"New Configuration"** (or the **+** button)
4. Select **APN** as the provider type
5. You'll see a form titled **"New Push Configuration — APN"**. Fill in each field:

| Field                   | Value                        | Notes                                                                                                           |
| ----------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Enabled**             | ✅ Toggle ON                 | This activates the provider                                                                                     |
| **Name**                | `vibe-apn`                   | **Required.** Internal identifier — must match what `addDevice()` passes in step 9. Use lowercase with hyphens. |
| **Description**         | `Vibe app APNs push for iOS` | Optional — for your reference                                                                                   |
| **Auth Key (.p8 file)** | _(upload the `.p8` from 8a)_ | Upload or paste the contents of the `.p8` file you downloaded from Apple                                        |
| **Key ID**              | Your 10-character Key ID     | e.g. `A1B2C3D4E5` — from the Apple Developer key creation page                                                  |
| **Team ID**             | `495669RCD5`                 | From your Apple Developer Membership page                                                                       |
| **Bundle ID / Topic**   | `com.vibeapp.mobile`         | Must match `bundleIdentifier` in `app.config.ts`                                                                |
| **Development** toggle  | ❌ OFF (use Production)      | See section 8c below for why — TestFlight requires production APNs                                              |

6. Click **Create**

> **About the form fields:** The exact field labels may vary slightly depending on your Dashboard version. The key fields to look for are: the `.p8` file upload, Key ID, Team ID, and Bundle ID. If you see a "Token (p8)" vs "Certificate (.p12)" choice, select **Token (p8)**.

**Verify:** After creating, you should have **two** push providers listed:

- `vibe-firebase` (Firebase, Enabled)
- `vibe-apn` (APN, Enabled)

### 8c. Why "Production" environment?

Your `app.config.ts` sets `entitlements: { "aps-environment": "production" }`. This means:

- **TestFlight builds** use the **production** APNs endpoint (Apple routes TestFlight through production)
- **App Store builds** also use **production**
- **Only local development builds** (built with `eas build --profile development`) use development APNs — but since your entitlements say "production", even dev builds will use production

If you set "Development" in Stream Dashboard, push notifications will **NOT work** on TestFlight or App Store builds. Always use **Production** here.

### 8d. Ensure GoogleService-Info.plist exists for iOS builds

Even though iOS uses APNs (not FCM) for call pushes, `GoogleService-Info.plist` is still needed for Firebase Analytics, Crashlytics, and Firestore on iOS.

Since your project uses Expo managed workflow (no `ios/` directory), you have two options:

**Option A — Reference in app.config.ts (simplest):**

1. Download `GoogleService-Info.plist` from [Firebase Console](https://console.firebase.google.com):
   - Project Settings → General → Your Apps → iOS app (`com.vibeapp.mobile`)
   - If no iOS app exists: Add app → iOS → Bundle ID `com.vibeapp.mobile` → Register
   - Download `GoogleService-Info.plist`
2. Place it at the project root: `./GoogleService-Info.plist`
3. Add this line to `app.config.ts` in the `ios` block:
   ```typescript
   ios: {
     googleServicesFile: "./GoogleService-Info.plist",
     // ... existing config (supportsTablet, bundleIdentifier, etc.)
   }
   ```

**Option B — EAS secret:**

```powershell
eas secret:create --scope project --name GOOGLE_SERVICES_PLIST --type file --value ./GoogleService-Info.plist
```

### 8e. Key differences: iOS vs Android push

| Aspect                   | Android (FCM)                                     | iOS (APNs)                                          |
| ------------------------ | ------------------------------------------------- | --------------------------------------------------- |
| **Token type**           | FCM registration token                            | APNs device token                                   |
| **Stream provider type** | `"firebase"`                                      | `"apn"`                                             |
| **Stream provider name** | `"vibe-firebase"` (set in step 7c)                | `"vibe-apn"` (set in step 8b)                       |
| **Credential**           | Service account JSON uploaded to Stream Dashboard | .p8 key uploaded to Stream Dashboard                |
| **Background wake**      | FCM high-priority data message wakes the app      | APNs push with `content-available: 1` wakes the app |
| **Foreground**           | Handled by `expo-notifications`                   | Handled by `expo-notifications`                     |
| **Notification channel** | `vibe-incoming-calls` (MAX importance)            | N/A (iOS doesn't have channels)                     |

---

## 9. Register Push Tokens in the App (Code Change Required)

**This is the critical missing piece in your codebase.** Steps 5-8 configure the server side (Stream knows _how_ to send pushes). This step tells Stream _where_ to send them (which device).

### Understanding the gap

Your app currently has **two separate push token systems** that do NOT talk to each other:

| System                 | Token Type                                 | Registered Where                                       | Used For                                                                     |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Expo Notifications** | Expo push token (`ExponentPushToken[...]`) | Firestore `Users/{uid}/NotificationDevices/{deviceId}` | Chat messages, friend requests, game invites — via your own Cloud Functions  |
| **Stream Video**       | Native FCM/APNs device token               | Stream's server (via `client.addDevice()`)             | Incoming call ringing when app is backgrounded — via Stream's infrastructure |

Currently, only the first system is wired up. The second (Stream push) is completely missing. Here's what needs to change.

### 9a. Key concept: Expo push token vs native device token

```
Expo Push Token:    "ExponentPushToken[abc123...]"
  → Routed through Expo's push service
  → Used by your own notification Cloud Functions
  → Retrieved via: Notifications.getExpoPushTokenAsync()

Native Device Token: "dKj4hf8s:APA91bGk..."  (FCM on Android)
                     "64-byte-hex-string"      (APNs on iOS)
  → Goes directly to FCM or APNs
  → THIS is what Stream needs
  → Retrieved via: Notifications.getDevicePushTokenAsync()
```

Your `src/services/notifications.ts` currently calls `getExpoPushTokenAsync()` only. For Stream, you need to ALSO call `getDevicePushTokenAsync()` and register that token with Stream.

### 9b. Create the push registration utility

Create a new file:

**File: `src/services/stream/streamPushRegistration.ts`**

```typescript
/**
 * Stream Push Device Registration
 *
 * Registers the device's native push token (FCM on Android, APNs on iOS)
 * with Stream Video so that incoming calls trigger push notifications
 * when the app is backgrounded or closed.
 *
 * This is separate from Expo push token registration in notifications.ts.
 * Expo tokens → your own notification system (chat, social, etc.)
 * Native tokens → Stream's call ringing system
 */

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { StreamVideoClient } from "@stream-io/video-react-native-sdk";

/**
 * Register the device's native push token with Stream Video.
 *
 * Must be called AFTER:
 * 1. The Stream client is initialized and connected
 * 2. Push notification permissions have been granted
 *
 * On Android: registers FCM token with push_provider = "firebase"
 * On iOS:     registers APNs token with push_provider = "apn"
 */
export async function registerStreamPushToken(
  client: StreamVideoClient,
): Promise<void> {
  try {
    // Skip on web — no push tokens
    if (Platform.OS === "web") return;

    // Simulators/emulators don't have push tokens
    if (!Device.isDevice) {
      console.log(
        "[StreamPush] Skipping push registration (not a physical device)",
      );
      return;
    }

    // Check permission status — don't request here, notifications.ts handles that
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      console.warn(
        "[StreamPush] Push permission not granted, skipping registration",
      );
      return;
    }

    // Get the NATIVE device push token (FCM on Android, APNs on iOS)
    // This is different from getExpoPushTokenAsync() which returns an Expo token
    const tokenData = await Notifications.getDevicePushTokenAsync();

    if (!tokenData?.data) {
      console.warn("[StreamPush] No device push token available");
      return;
    }

    // tokenData.data is a string on Android (FCM token), string on iOS (APNs hex token)
    const token =
      typeof tokenData.data === "string"
        ? tokenData.data
        : JSON.stringify(tokenData.data);

    if (Platform.OS === "android") {
      // Register with Stream as a Firebase (FCM) device
      // The 4th arg "vibe-firebase" must match the Name you set in Stream Dashboard (step 7c)
      await client.addDevice(token, "firebase", undefined, "vibe-firebase");
      console.log("[StreamPush] ✓ Registered FCM token with Stream");
    } else if (Platform.OS === "ios") {
      // Register with Stream as an APNs device
      // The 4th arg "vibe-apn" must match the Name you set in Stream Dashboard (step 8b)
      await client.addDevice(token, "apn", undefined, "vibe-apn");
      console.log("[StreamPush] ✓ Registered APNs token with Stream");
    }
  } catch (err) {
    // Non-fatal — calls still work in foreground without push registration.
    // Common failure: permission not granted, no Google Play Services (Android emulator).
    console.warn("[StreamPush] Failed to register push token:", err);
  }
}

/**
 * Unregister the device's push token from Stream.
 * Call this on logout to stop receiving call pushes for the old user.
 */
export async function unregisterStreamPushToken(
  client: StreamVideoClient,
): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    if (!Device.isDevice) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const tokenData = await Notifications.getDevicePushTokenAsync();
    if (!tokenData?.data) return;

    const token =
      typeof tokenData.data === "string"
        ? tokenData.data
        : JSON.stringify(tokenData.data);

    await client.removeDevice(token);
    console.log("[StreamPush] ✓ Unregistered push token from Stream");
  } catch (err) {
    // Non-fatal — if this fails, the token will expire naturally
    console.warn("[StreamPush] Failed to unregister push token:", err);
  }
}
```

### 9c. Wire it into the Stream client lifecycle

Now you need to call these functions at the right times. Edit `src/services/stream/streamClient.ts`:

**Add the import at the top of the file:**

```typescript
import {
  registerStreamPushToken,
  unregisterStreamPushToken,
} from "./streamPushRegistration";
```

**In `initStreamClient()` — add the registration call AFTER the client is created:**

Find this section (around line 60-65):

```typescript
  currentUserId = userId;
  return client;
}
```

Change it to:

```typescript
  currentUserId = userId;

  // Register device push token with Stream for background call notifications.
  // Fire-and-forget — push registration failure should never block client init.
  registerStreamPushToken(client).catch((err) =>
    console.warn("[StreamClient] Push registration failed:", err),
  );

  return client;
}
```

**In `destroyStreamClient()` — add unregistration BEFORE disconnecting:**

Change the current function from:

```typescript
export async function destroyStreamClient(): Promise<void> {
  if (client) {
    try {
      await client.disconnectUser();
    } catch (err) {
      console.warn("[StreamClient] disconnectUser failed:", err);
    }
    client = null;
    currentUserId = null;
  }
}
```

To:

```typescript
export async function destroyStreamClient(): Promise<void> {
  if (client) {
    // Unregister push token first so user stops receiving call pushes
    try {
      await unregisterStreamPushToken(client);
    } catch (err) {
      console.warn("[StreamClient] Push unregistration failed:", err);
    }
    try {
      await client.disconnectUser();
    } catch (err) {
      console.warn("[StreamClient] disconnectUser failed:", err);
    }
    client = null;
    currentUserId = null;
  }
}
```

### 9d. Add barrel exports

Your `src/services/stream/index.ts` currently exports from `streamClient` and `streamTokenProvider`. Add the new exports.

The current file is:

```typescript
export {
  destroyStreamClient,
  getStreamClient,
  getStreamClientOrNull,
  initStreamClient,
} from "./streamClient";

export {
  clearTokenCache,
  fetchStreamToken,
  getCachedApiKey,
  streamTokenProvider,
} from "./streamTokenProvider";
```

Add at the bottom:

```typescript
export {
  registerStreamPushToken,
  unregisterStreamPushToken,
} from "./streamPushRegistration";
```

### 9e. Execution timeline

Here's the complete sequence showing when each push system fires:

```
User opens app → Firebase Auth signs in
  │
  ├─ AuthContext.tsx: registerForPushNotifications()
  │    → getExpoPushTokenAsync()           ← Expo push token
  │    → savePushToken() to Firestore      ← For your own notification system
  │
  └─ StreamCallContext.tsx: initStreamClient(uid, name, avatar)
       → fetchStreamToken() from Cloud Function
       → StreamVideoClient.getOrCreateInstance(...)
       → registerStreamPushToken(client)   ← NEW (step 9c)
            → getDevicePushTokenAsync()    ← Native FCM/APNs token
            → client.addDevice(token, "firebase" | "apn")
                                           ← Tells Stream where to send call pushes
```

On logout:

```
User taps logout
  │
  ├─ AuthContext.tsx: removePushToken()
  │    → Nulls Expo token in Firestore
  │
  └─ StreamCallContext.tsx: destroyStreamClient()
       → unregisterStreamPushToken(client) ← NEW (step 9c)
       │    → client.removeDevice(token)   ← Tells Stream to stop sending call pushes
       └─ client.disconnectUser()
```

### 9f. Verify the registration works

After implementing the code changes above, build a dev client on a physical device and check the logs:

**Android:**

```powershell
adb logcat | Select-String "StreamPush"
```

**iOS (Xcode console):**
Filter logs for `[StreamPush]`

You should see:

```
[StreamPush] ✓ Registered FCM token with Stream
```

If you see `Failed to register push token`, check:

1. `google-services.json` is present (Android)
2. Push permission was granted
3. You're on a physical device, not a simulator
4. The Stream client initialized successfully (check for `[StreamClient]` logs)

### 9g. Test end-to-end

1. Log in as User A on Device 1
2. Log in as User B on Device 2
3. On Device 2, minimize the app (move to background)
4. On Device 1, navigate to User B's profile and tap the call button
5. Device 2 should receive a push notification within 2-3 seconds
6. Tapping the notification should bring the app to foreground with the incoming call overlay

If Device 2 does NOT get a push:

- Verify the FCM credential in Stream Dashboard (step 7c)
- Verify the APNs key in Stream Dashboard (step 8b)
- Check that `client.addDevice()` was called (look for `[StreamPush] ✓` in logs)
- Try `client.listDevices()` in a debug session to see what tokens Stream has registered

---

## 10. Verify google-services.json and GoogleService-Info.plist

### Android — google-services.json

**Check if it exists:**

```powershell
Test-Path android/app/google-services.json
```

If it doesn't exist:

1. Go to Firebase Console → Project Settings → General → Your Android app
2. Download `google-services.json`
3. Place it at `android/app/google-services.json`

Alternatively, if using EAS secrets:

```powershell
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
```

### iOS — GoogleService-Info.plist

Since this is an Expo managed workflow (no `ios/` directory), you have two options:

**Option A — EAS Secret (recommended):**

```powershell
# Download GoogleService-Info.plist from Firebase Console → iOS app
eas secret:create --scope project --name GOOGLE_SERVICES_PLIST --type file --value ./GoogleService-Info.plist
```

**Option B — Place in project root and reference in app.config.ts:**

1. Download `GoogleService-Info.plist` from Firebase Console
2. Place it at the project root
3. Add to `app.config.ts` under the `ios` block:
   ```typescript
   ios: {
     googleServicesFile: "./GoogleService-Info.plist",
     // ... rest of config
   }
   ```

> **Note:** The `expo-notifications` plugin and `@stream-io/video-react-native-sdk` plugin handle the native wiring automatically during `eas build`.

---

## 11. Build and Test

### 11a. Create a development build

```powershell
# Android (physical device)
eas build --platform android --profile development

# iOS (physical device)
eas build --platform ios --profile development

# iOS (simulator — no push support, but calls work in foreground)
eas build --platform ios --profile development-simulator
```

### 11b. Test the full call flow

| Test                          | Steps                                  | Expected Result                                             |
| ----------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| **Foreground call**           | User A calls User B (app open)         | B sees incoming call overlay, can accept/reject             |
| **Background call (Android)** | User A calls User B (app backgrounded) | B gets a push notification, tapping opens the call          |
| **Background call (iOS)**     | User A calls User B (app backgrounded) | B gets a push notification / CallKit UI                     |
| **Voice channel**             | User joins a group voice room          | Audio connects, other members visible                       |
| **Call history**              | Complete a call, check Calls tab       | Entry appears with correct duration/direction               |
| **Token refresh**             | Keep app open for >5 min, make a call  | Call works (token auto-refreshes via `streamTokenProvider`) |
| **Logout/login**              | Log out, log in as different user      | No stale call state, new Stream client initializes          |

### 11c. Create a TestFlight / preview build

```powershell
# Preview build (internal distribution)
eas build --platform ios --profile preview

# Production build (for App Store / TestFlight submission)
eas build --platform ios --profile production
```

---

## 12. Troubleshooting

### "Stream Video API key/secret not configured"

The Cloud Function can't find the Stream credentials in the `.env` file.

```powershell
# Verify .env file exists and has values
Get-Content firebase-backend/functions/.env

# If missing, create it with your Stream credentials:
# STREAM_API_KEY=your_key
# STREAM_API_SECRET=your_secret

# Rebuild and redeploy
cd firebase-backend/functions; npm run build; cd ../..
firebase deploy --only functions
```

### Calls work in foreground but not background

Push tokens are not registered with Stream. Verify:

1. The `streamPushRegistration.ts` code from step 9 is implemented
2. FCM/APNs credentials are uploaded to Stream Dashboard (steps 7–8)
3. Check logs: `adb logcat | grep StreamPush` or Xcode console for `[StreamPush]` messages
4. Verify the device token format — `getDevicePushTokenAsync()` returns the native token, not the Expo push token

### "No device push token available"

Push notifications aren't properly configured:

1. Ensure `google-services.json` (Android) or `GoogleService-Info.plist` (iOS) is included in the build
2. On iOS: ensure push notification entitlements are enabled in App Store Connect
3. On simulators: push tokens are not available — test on a physical device

### Webhook not receiving events

1. Verify the URL in Stream Dashboard matches your deployed function URL
2. Check Firebase Functions logs: `firebase functions:log --only streamCallWebhook`
3. Verify the `STREAM_API_SECRET` in your `.env` file matches your Dashboard API Secret (this is used to verify the `X-Signature` HMAC on every webhook request)
4. Ensure the webhook URL is correctly set via the API (see step 6b)

### "Cannot find native module @stream-io/react-native-webrtc"

You're running in Expo Go, which doesn't support native modules. This is expected behavior:

- Expo Go: Calls are disabled (`CALL_FEATURES.CALLS_ENABLED = false`), all call UI shows "Calls Coming Soon"
- Dev client / TestFlight: Calls are enabled because native modules are bundled

### Token refresh fails / calls stop working after ~24 hours

The `streamTokenProvider` auto-refresh should handle this. If it doesn't:

1. Check that `getStreamVideoToken` Cloud Function is deployed and working
2. Check Firebase Auth — the user must still be authenticated for the callable to succeed
3. Look for errors in the console: `[StreamClient]` or `[StreamToken]`

### Call quality issues (echo, lag, no audio)

1. Verify `INTERNET` and `ACCESS_NETWORK_STATE` permissions (already configured in `app.config.ts`)
2. Check that `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` permissions are granted at runtime
3. Stream uses its own TURN/STUN infrastructure — no additional ICE server configuration needed
4. On Android: ensure `react-native-incall-manager` is installed (it is — `^4.2.1`)

---

## Architecture Reference

Here's how all the pieces fit together:

```
┌─────────────────────────────────────────────────────────────┐
│                        Stream Dashboard                      │
│  • App credentials (API Key + Secret)                        │
│  • Call types: "default" (ringing), "audio_room" (no ring)   │
│  • Push providers: FCM (Android), APNs (iOS)                 │
│  • Webhook → call.session_ended                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│  Stream SFU  │  │ Stream Push  │  │   Stream Webhooks    │
│  (media)     │  │ (FCM/APNs)   │  │                      │
└──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘
       │                 │                      │
       ▼                 ▼                      ▼
┌─────────────────────────────────┐  ┌──────────────────────┐
│         Vibe App (Client)       │  │  Firebase Functions   │
│                                 │  │                       │
│  StreamCallContext              │  │  getStreamVideoToken  │
│    └─ initStreamClient()        │  │    → mints JWT        │
│       └─ fetchStreamToken()  ───┼──┼──→ returns token+key  │
│       └─ registerStreamPush()   │  │                       │
│    └─ StreamVideo provider      │  │  streamCallWebhook    │
│       └─ useCalls() (ringing)   │  │    → writes history   │
│       └─ call.join() (rooms)    │  │       to Firestore    │
│                                 │  │                       │
│  IncomingCallHandler            │  └──────────────────────┘
│    └─ useCalls() → overlay      │
│                                 │
│  Feature flags:                 │
│    CALLS_ENABLED =              │
│      isStreamNativeAvailable()  │
│    (false in Expo Go)           │
└─────────────────────────────────┘
```

---

## Summary Checklist

- [ ] Stream Dashboard account created and app set up
- [ ] API Key + Secret copied from dashboard
- [ ] `firebase-backend/functions/.env` created with `STREAM_API_KEY`, `STREAM_API_SECRET`
- [ ] Cloud Functions deployed (`firebase deploy --only functions`)
- [ ] Call types verified: `default` (ringing on) and `audio_room` (ringing off)
- [ ] Webhook URL configured via API or Dashboard (authentication uses API Secret automatically)
- [ ] FCM credentials uploaded to Stream Dashboard (for Android push)
- [ ] APNs .p8 key uploaded to Stream Dashboard (for iOS push)
- [ ] `streamPushRegistration.ts` created and wired into `streamClient.ts`
- [ ] `google-services.json` present for Android builds
- [ ] `GoogleService-Info.plist` present for iOS builds
- [ ] Dev client build created and tested (foreground calls)
- [ ] Physical device tested (background call push notifications)
- [ ] TestFlight / preview build created and distributed
