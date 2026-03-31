# Configuration and Security

Last verified: 2026-03-30

## Main Configuration Surfaces

- [featureFlags.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/constants/featureFlags.ts)
- [app.config.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/app.config.ts)
- [eas.json](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/eas.json)
- [firebase.json](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase.json)
- [firebaseConfig.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/firebaseConfig.ts)
- [firebaseConfig.local.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/firebaseConfig.local.ts)

## Active Feature Flags

### Storage and camera

- `USE_LOCAL_STORAGE = !IS_WEB`
- `USE_VISION_CAMERA = true`

Important nuance:

- `USE_VISION_CAMERA` being `true` does not mean Expo Go supports it
- the camera surface still performs runtime fallback behavior when native modules are unavailable

### Games

- `GAMES_V4_ENABLED = true`

### Calls

- `CALL_FEATURES.CALLS_ENABLED = isStreamNativeAvailable()`
- `CALL_FEATURES.DIRECT_CALLS_ENABLED = true`

Important correction from older docs:

- there is no rollout-percentage gate in the current call feature flags
- the main call gate is native-module availability, not a percentage rollout variable

### Profile

`PROFILE_V2_FEATURES` still exists as a named flag group, but most of those toggles are effectively enabled in the current profile runtime. The naming is legacy; the shipped profile surfaces are already the V2-style system.

### Chat

Important current chat flags:

- `CHAT_SETTINGS_V3 = false`
- `CHAT_SIGNED_MEDIA_URLS = false`
- `CHAT_STAGED_UPLOADS = false`
- `CHAT_GLOBAL_RATE_LIMIT = false`
- `CHAT_INBOX_AGGREGATION = false`
- `CHAT_DELIVERY_ACKS = false`
- `CHAT_PRIVACY_SERVER_ENFORCED = false`
- `CHAT_DEBUG_HUD = __DEV__`

Reality note:

- some backend infrastructure for these migrations already exists even while the client flags remain off

## Environment Variables

### App / build profiles

- `COLYSEUS_URL`

Used by:

- `app.config.ts`
- `src/gamesV4/realtime/realtimeClient.ts`

Current `eas.json` state:

- `preview` sets `COLYSEUS_URL`
- `production` sets `COLYSEUS_URL`

### Firebase Functions

Current source references:

- `STREAM_API_KEY`
- `STREAM_API_SECRET`
- `APPLE_SHARED_SECRET`
- `ANDROID_PACKAGE_NAME`
- `ADMIN_SETUP_KEY`
- `FUNCTIONS_EMULATOR`

### Colyseus server

Current source references:

- `FIREBASE_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `FIREBASE_SERVICE_ACCOUNT_BASE64`
- `COLYSEUS_DEV_BYPASS`
- `HOST`
- `PORT`

## Platform Configuration

### iOS

Current `app.config.ts` state:

- bundle ID: `com.vibeapp.mobile`
- `googleServicesFile` is configured
- background modes: `audio`, `remote-notification`, `fetch`
- APS entitlement is present

Important correction from older docs:

- the current config does not declare `voip` background mode

### Android

Current `app.config.ts` state includes permissions for:

- camera and microphone
- network
- Bluetooth audio
- foreground service
- vibration and wake lock
- post notifications

## Security Boundaries

Authoritative trust boundaries:

- Firestore rules
- Storage rules
- Cloud Functions for sensitive writes

The client should not become the authority for:

- canonical message writes
- notification routing
- wallet or transaction writes
- purchases and entitlement grants
- task reward claims
- Games V4 results and rewards
- Stream token issuance

## Sensitive Files and Secrets

Be careful with:

- `firebase-backend/functions/.env`
- service-account material used by Colyseus
- App Store / Play billing credentials

Do not paste live secret values into documentation. The previous Stream setup guide exposed real credential values; that is explicitly corrected in the current docs.

## Secure Change Checklist

1. Keep client types, backend contracts, rules, and indexes aligned.
2. Do not document inactive flags or removed rollout behavior as live runtime.
3. Rebuild Functions after backend or environment-contract changes.
4. Rebuild native apps when `app.config.ts` changes affect plugins, permissions, or background behavior.
