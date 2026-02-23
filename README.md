# SnapStyle MVP

React Native (Expo) social app with messaging, profile/economy systems, and a multiplayer games platform backed by Firebase + Colyseus.

## Documentation

Start with `docs/README.md`.

Canonical docs are now organized as:

- `docs/architecture/system-overview.md`
- `docs/backend/firebase-and-functions.md`
- `docs/backend/colyseus.md`
- `docs/features/messaging.md`
- `docs/features/games.md`
- `docs/features/profile-economy.md`
- `docs/operations/runbook.md`
- `docs/operations/testing.md`
- `docs/operations/configuration-and-security.md`

Historical/removed docs are tracked in:

- `docs/archive/removed-docs-2026-02-22.md`

## Quick Start

```bash
npm install
npm run start
```

Optional local services:

```bash
npm --prefix colyseus-server install
npm --prefix colyseus-server run dev

npm --prefix firebase-backend/functions install
npm --prefix firebase-backend/functions run serve
```

## Core Scripts

```bash
# Root app
npm run type-check
npm run lint
npm run test
npm run verify:registry
npm run smoke

# Colyseus
npm --prefix colyseus-server run lint
npm --prefix colyseus-server run test
npm --prefix colyseus-server run build

# Firebase functions
npm --prefix firebase-backend/functions run build
```

## Repository Layout

- `src/` app screens, hooks, services, types
- `constants/` feature flags and static config
- `firebase-backend/` Firestore rules/indexes + Cloud Functions
- `colyseus-server/` real-time multiplayer server
- `starforge-viewer/` embedded web client for Starforge
