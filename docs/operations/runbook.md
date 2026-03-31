# Developer Runbook

Last verified: 2026-03-30

## Prerequisites

- Node.js 20
- npm
- Firebase CLI
- EAS CLI for device builds

Optional, depending on what you are changing:

- Android Studio / Xcode for native runs
- a native dev client if you need Stream calls or VisionCamera behavior

## First-Time Install

```bash
npm install
npm --prefix firebase-backend/functions install
npm --prefix colyseus-server install
```

## Daily Startup

App:

```bash
npm run start
```

Optional functions emulator:

```bash
npm --prefix firebase-backend/functions run serve
```

Optional Colyseus server for realtime game work:

```bash
npm --prefix colyseus-server run dev
```

Platform launches:

```bash
npm run ios
npm run android
npm run web
```

## Current Development Reality

- the app currently points at the configured Firebase project by default; there is no repo-wide Firestore/Functions emulator wiring in the client app
- `firebase.json` does not define emulator ports
- realtime game local development is the main reason to run `colyseus-server` locally
- calls are disabled automatically in Expo Go because Stream native modules are unavailable there

## Build and Validation Commands

```bash
# App
npm run type-check
npm run lint
npm run test

# Firebase functions
npm --prefix firebase-backend/functions run build

# Colyseus server
npm --prefix colyseus-server run lint
npm --prefix colyseus-server run test
npm --prefix colyseus-server run build
```

There is no verified `npm run smoke` or `npm run verify:registry` script in the current repo.

## Deploy Commands

```bash
# Functions
firebase deploy --only functions

# Firestore rules + indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# Storage
firebase deploy --only storage
```

## High-Value Diagnostics

Messaging issues:

- verify Firebase initialization and client config files
- verify callable exports in `firebase-backend/functions/src/index.ts`
- build Functions after contract changes

Call issues:

- verify you are using a native build, not Expo Go
- verify Stream credentials are present in Functions env
- verify Stream dashboard provider names match `vibe-firebase` and `vibe-apn`

Realtime game issues:

- verify `COLYSEUS_URL` in the build profile or local dev resolution
- run the local Colyseus server when testing against localhost

Profile/economy issues:

- verify rules and callable contracts, not just UI code
- check wallet/task/entitlement reads against real Firestore paths

## Pre-Merge Checklist

1. Run the subsystem-appropriate matrix from [testing.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/operations/testing.md).
2. Build Functions for any backend, callable, or schema-adjacent change.
3. Run Colyseus checks for realtime game changes.
4. Update the matching current-state docs in the same branch.
