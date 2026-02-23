# Developer Runbook

Last verified: 2026-02-22

## Prerequisites

- Node.js 20 (recommended; functions runtime target is Node 20)
- npm
- Firebase CLI
- Expo CLI tooling

## First-Time Install

```bash
npm install
npm --prefix firebase-backend/functions install
npm --prefix colyseus-server install
npm --prefix starforge-viewer install
npm --prefix starforge-viewer/server install
```

## Daily Startup (Recommended Terminal Split)

Terminal 1 - app:

```bash
npm run start
```

Terminal 2 - Colyseus realtime server:

```bash
npm --prefix colyseus-server run dev
```

Terminal 3 - optional Firebase functions emulator:

```bash
npm --prefix firebase-backend/functions run serve
```

Optional native/web launches:

```bash
npm run ios
npm run android
npm run web
```

## Starforge Embedded Setup

The app expects Starforge to be available from Colyseus host `/starforge`.

One-time build (or after viewer changes):

```bash
npm --prefix starforge-viewer run build
```

Health checks:

- Colyseus: `http://localhost:2567/health`
- Starforge host: `http://localhost:2567/starforge/health`

Optional overrides:

- `EXPO_PUBLIC_STARFORGE_GAME_URL`
- `EXPO_PUBLIC_COLYSEUS_URL`
- `EXPO_PUBLIC_COLYSEUS_SERVER_URL`

## Build and Validation Commands

```bash
# App
npm run type-check
npm run lint
npm run test
npm run verify:registry
npm run smoke

# Firebase functions
npm --prefix firebase-backend/functions run build

# Colyseus
npm --prefix colyseus-server run lint
npm --prefix colyseus-server run test
npm --prefix colyseus-server run build

# Starforge packages
npm --prefix starforge-viewer run typecheck
npm --prefix starforge-viewer run build
npm --prefix starforge-viewer/server run typecheck
```

## Deploy Commands

```bash
# Functions
firebase deploy --only functions

# Firestore + indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# Storage
firebase deploy --only storage
```

## Common Diagnostics

Messaging issues:

- Verify Firebase client bootstrap config: `src/services/firebaseConfig.local.ts`
- Verify callable export presence in `firebase-backend/functions/src/index.ts`
- Check function logs: `firebase functions:log`

Realtime game issues:

- Verify Colyseus server is reachable (`:2567/health`)
- Verify client room mapping in `src/config/colyseus.ts`
- Verify room registration in `colyseus-server/src/app.config.ts`

Starforge WebView issues:

- Verify `/starforge/health`
- Rebuild viewer bundle
- Restart Colyseus after rebuilding

Profile/economy write issues:

- Verify Firestore rules allow current write shape
- Verify corresponding callable path exists for server-authoritative writes

## Pre-Merge Quick Checklist

1. Run subsystem-appropriate test matrix from `docs/operations/testing.md`.
2. Validate any changed contracts (rules, types, function payloads).
3. Update docs for behavior or contract changes in the same branch.
