# Configuration and Security

Last verified: 2026-02-22

## Configuration Surfaces

Primary runtime config files:

- Feature flags: `constants/featureFlags.ts`
- Expo/native config: `app.config.ts`
- Firebase project wiring: `firebase.json`
- Client Firebase bootstrap config: `src/services/firebaseConfig.local.ts`

## Feature Flag Groups

Main groups in active use:

- `USE_LOCAL_STORAGE`
- `USE_VISION_CAMERA`
- `PROFILE_V2_FEATURES`
- `PLAY_SCREEN_FEATURES`
- `CALL_FEATURES`
- `THREE_JS_FEATURES`
- `COLYSEUS_FEATURES`
- `CHAT_FEATURES`
- `ACHIEVEMENTS_V2_FEATURES`

High-impact defaults (as of 2026-02-22):

- `USE_LOCAL_STORAGE`: enabled on native, disabled on web
- `USE_VISION_CAMERA`: false (Expo-safe default)
- `CALL_FEATURES.CALLS_ENABLED`: true, rollout percentage set to `0`
- `COLYSEUS_FEATURES.COLYSEUS_ENABLED`: true, `USE_PRODUCTION_SERVER`: false
- `CHAT_FEATURES` major V3 rollout flags: mostly false
- `ACHIEVEMENTS_V2_FEATURES.ENABLED`: true

## Environment Variables Used by App Code

Current observed reads:

- `EXPO_PUBLIC_STARFORGE_GAME_URL`
- `EXPO_PUBLIC_COLYSEUS_URL`
- `EXPO_PUBLIC_COLYSEUS_SERVER_URL`

Any new env var should be documented here when introduced.

## Native Platform Config Notes

`app.config.ts` controls:

- iOS/Android identifiers
- camera/microphone permissions
- call/background permissions
- plugins (SQLite, orientation, Vision Camera)

Permission and plugin changes should be treated as release-impacting.

## Security Boundaries

Firestore and Storage policy:

- Firestore auth/data validation: `firebase-backend/firestore.rules`
- Storage path/content limits: `firebase-backend/storage.rules`

Server-authoritative operations:

- Money-like state (wallet, purchases, rewards)
- canonical messaging writes and moderation-sensitive actions
- invite/session orchestration logic where integrity matters

Function deployment safety:

- `firebase.json` predeploy builds functions before deploy.

## Sensitive Files and Secret Hygiene

Do not commit real credentials or service account material.

Paths that require care:

- `src/services/firebaseConfig.local.ts` (public client config is okay; private keys are not)
- `colyseus-server/serviceAccountKey.json` (should not contain production credentials in git)
- local `.env` files in backend/server packages

## Secure Change Checklist

1. Keep validation aligned across client types, functions, and rules.
2. Avoid adding direct client writes to data currently guarded by callables.
3. Sanitize logs for user content and PII-sensitive payloads.
4. Re-run function build and relevant tests after auth/rule changes.
5. Document new flags, env vars, and trust-boundary changes in this file.
