# Configuration and Security

Last verified: 2026-03-18

## Configuration Surfaces

Primary runtime config files:

- feature flags: `constants/featureFlags.ts`
- Expo/native config: `app.config.ts`
- Firebase wiring: `firebase.json`
- client Firebase config: `src/services/firebaseConfig.local.ts`

## Active Feature Flag Groups

- `USE_LOCAL_STORAGE`
- `USE_VISION_CAMERA`
- `PROFILE_V2_FEATURES`
- `CALL_FEATURES`
- `CHAT_FEATURES`

High-impact defaults:

- `USE_LOCAL_STORAGE`: enabled on native, disabled on web
- `USE_VISION_CAMERA`: true
- `CALL_FEATURES.CALLS_ENABLED`: true with rollout percentage still `0`
- `CHAT_FEATURES`: settings/media/rate-limit/inbox/delivery/privacy rollout flags remain mostly false

Important chat note:

- message requests are not a client feature flag anymore
- the backend enforces DM request gating directly

## Environment Variables

Current app and backend code reviewed for this audit do not expose an active `CHAT_LEGACY_PUSH_ENABLED` environment contract.

Any new env var must be documented here when introduced.

## Security Boundaries

Primary trust boundaries:

- Firestore rules: `firebase-backend/firestore.rules`
- Storage rules: `firebase-backend/storage.rules`
- Cloud Functions for canonical writes and moderation-sensitive operations

Server-authoritative areas include:

- canonical messaging writes
- notification channel selection
- wallet, purchase, reward, and other money-like state
- moderation-sensitive actions

## Sensitive Files

- `src/services/firebaseConfig.local.ts`
- backend package `.env` files

Do not commit private keys or service-account material.

## Secure Change Checklist

1. keep client types, backend contracts, and rules aligned
2. do not bypass callable guards for canonical message or notification flows
3. sanitize logs that could capture user content or PII
4. rebuild functions after rule/auth/backend changes
5. update this file when flags, env vars, or trust boundaries change
