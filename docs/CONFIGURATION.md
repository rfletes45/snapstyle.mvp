# Configuration Guide

Last verified: 2026-02-18

## Purpose

This document defines where runtime/config values live, which surfaces are safe to change, and how to add new configuration without bypassing feature flags or platform constraints.

## Configuration Surfaces

| Surface | File(s) | Owner | Notes |
| --- | --- | --- | --- |
| Client feature flags | `constants/featureFlags.ts` | RN app | Primary rollout control plane. |
| Expo manifest/build config | `app.config.ts` | RN app/native | App metadata, permissions, native plugins. |
| Firebase client bootstrap | `src/services/firebaseConfig.local.ts`, `src/services/firebase.ts`, `App.tsx` | RN app | Initialized synchronously at startup via `initializeFirebase(firebaseConfig)`. |
| Client env vars (Expo public) | `src/config/starforgeGame.ts` | RN app/webview | Uses `process.env.EXPO_PUBLIC_*` for host overrides. |
| Colyseus server env vars | `colyseus-server/src/app.config.ts`, `colyseus-server/src/services/firebase.ts` | Colyseus server | Uses `.env` via `dotenv.config()` plus process env in runtime. |
| Functions env vars | `firebase-backend/functions/src/*.ts` | Cloud Functions | Uses `process.env` (emulator flags, admin setup key, etc.). |

## Feature Flag Audit (Segment 4)

Top-level exports in `constants/featureFlags.ts` are all referenced by runtime code and/or tests:

- `USE_LOCAL_STORAGE`
- `USE_VISION_CAMERA`
- `DEBUG_MINIGOLF_OVERLAY`
- `DEBUG_CHAT_V2`
- `DEBUG_UNIFIED_MESSAGING`
- `PROFILE_V2_FEATURES`
- `PLAY_SCREEN_FEATURES`
- `CALL_FEATURES`
- `THREE_JS_FEATURES`
- `COLYSEUS_FEATURES`
- `CHAT_FEATURES`

No top-level flag object was removed in Segment 4.

Sub-flag caller audit found several keys with no direct static caller (mostly roadmap placeholders in `CALL_FEATURES`, plus some optional toggles in `THREE_JS_FEATURES`/`COLYSEUS_FEATURES`/`PROFILE_V2_FEATURES`). These were intentionally retained to avoid deleting staged rollout switches still documented for future segments.

## Risk-Sensitive Defaults (Current)

- `USE_LOCAL_STORAGE = !IS_WEB`
  - Native: local-first SQLite path enabled.
  - Web: disabled due shared-array-buffer/runtime constraints.
- `USE_VISION_CAMERA = false`
  - Keeps Expo Go compatible camera path by default.
- `CALL_FEATURES.CALLS_ENABLED = false`
  - Call surface remains gated unless explicitly enabled.
- `COLYSEUS_FEATURES.USE_PRODUCTION_SERVER = false`
  - Dev defaults avoid accidental prod host routing in local development.

## Environment Variables In Use

Client (Expo public):

- `EXPO_PUBLIC_STARFORGE_GAME_URL`
- `EXPO_PUBLIC_COLYSEUS_URL`
- `EXPO_PUBLIC_COLYSEUS_SERVER_URL`

Colyseus server:

- `PORT`
- `NODE_ENV`
- `LOG_LEVEL`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `RECONNECTION_TIMEOUT_*` (game-tier specific)
- `STARFORGE_CLIENT_DIST`

Functions (examples from source):

- `FUNCTIONS_EMULATOR`
- `ADMIN_SETUP_KEY`

## How To Add New Config Safely

1. Pick the right layer:
   - Feature rollout switch: `constants/featureFlags.ts`
   - Build/native capability: `app.config.ts`
   - Secret/server-only behavior: backend env (`functions` or `colyseus-server`)
2. Default conservatively for risky behavior.
3. Gate both UI and service logic, not UI alone.
4. Add/adjust tests for both flag states when behavior changes.
5. Update this doc and related subsystem docs (`docs/AI_PROJECT_GUIDE.md`, `docs/REPO_MAP.md`) if contracts changed.
