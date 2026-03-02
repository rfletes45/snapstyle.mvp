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
```

## Daily Startup (Recommended Terminal Split)

Terminal 1 - app:

```bash
npm run start
```

Terminal 2 - optional Firebase functions emulator:

```bash
npm --prefix firebase-backend/functions run serve
```

Optional native/web launches:

```bash
npm run ios
npm run android
npm run web
```

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

Profile/economy write issues:

- Verify Firestore rules allow current write shape
- Verify corresponding callable path exists for server-authoritative writes

## Pre-Merge Quick Checklist

1. Run subsystem-appropriate test matrix from `docs/operations/testing.md`.
2. Validate any changed contracts (rules, types, function payloads).
3. Update docs for behavior or contract changes in the same branch.
