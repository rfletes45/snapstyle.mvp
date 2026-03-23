# SnapStyle MVP

React Native (Expo) social app with messaging, profile/economy systems, and a multiplayer games platform backed by Firebase and Colyseus.

## Start Here

The canonical documentation entrypoint is `docs/README.md`.

Game-system docs that match the current codebase:

- `docs/GAMES_V4_SYSTEM.md`
- `docs/GAMES_V4_RUNBOOK.md`
- `docs/GAME_INTEGRATION_GUIDE_V4.md`
- `docs/REALTIME_FRAMEWORK.md`

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

## Verified Scripts

```bash
# Root app
npm run type-check
npm run lint
npm run test

# Colyseus
npm --prefix colyseus-server run lint
npm --prefix colyseus-server run test
npm --prefix colyseus-server run build

# Firebase functions
npm --prefix firebase-backend/functions run build
```

## Repository Layout

- `src/` app screens, hooks, services, shared game infrastructure, and UI
- `firebase-backend/` Firestore rules/indexes and Cloud Functions
- `colyseus-server/` realtime multiplayer server
- `docs/` canonical technical and operational documentation
- `__tests__/` Jest coverage for client/shared systems
