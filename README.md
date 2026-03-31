# Vibe

Vibe is an Expo/React Native social app with:

- DM and group messaging
- Stream-based direct calls and group voice channels
- customizable profile boards, cosmetics, themes, and chat appearance
- wallet, shop, task, and achievement systems
- Games V4 turn-based, solo, and Colyseus-backed realtime games

## Current Stack

- Expo / React Native / TypeScript
- Firebase Auth, Firestore, Storage, Cloud Functions
- SQLite-backed local-first messaging on native
- Stream Video for calling
- Colyseus for realtime multiplayer games

## Start Here

The canonical documentation entrypoint is [docs/README.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/README.md).

High-value current-state docs:

- [system-overview.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/architecture/system-overview.md)
- [messaging.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/features/messaging.md)
- [calls-and-audio.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/features/calls-and-audio.md)
- [profile-economy.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/features/profile-economy.md)
- [firebase-and-functions.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/backend/firebase-and-functions.md)

Games V4 docs remain canonical and current:

- [GAMES_V4_SYSTEM.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/GAMES_V4_SYSTEM.md)
- [GAMES_V4_RUNBOOK.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/GAMES_V4_RUNBOOK.md)
- [GAME_INTEGRATION_GUIDE_V4.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/GAME_INTEGRATION_GUIDE_V4.md)
- [REALTIME_FRAMEWORK.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/REALTIME_FRAMEWORK.md)

## Quick Start

```bash
npm install
npm --prefix firebase-backend/functions install
npm --prefix colyseus-server install
```

Run the app:

```bash
npm run start
```

Optional local services:

```bash
npm --prefix firebase-backend/functions run serve
npm --prefix colyseus-server run dev
```

Platform launches:

```bash
npm run ios
npm run android
npm run web
```

## Verification Commands

```bash
# App
npm run type-check
npm run lint
npm run test

# Firebase functions
npm --prefix firebase-backend/functions run build

# Colyseus realtime server
npm --prefix colyseus-server run lint
npm --prefix colyseus-server run test
npm --prefix colyseus-server run build
```

## Notes

- Calls require a native dev client or production build. `CALL_FEATURES.CALLS_ENABLED` auto-disables in Expo Go.
- Native messaging uses the SQLite local-first runtime. Web still uses the Firestore-first compatibility path.
- Production and preview EAS profiles inject `COLYSEUS_URL`; local dev can auto-detect the Expo host or fall back to localhost.

## Repository Layout

- `src/` app screens, providers, hooks, services, UI, and Games V4 client code
- `firebase-backend/` Firestore rules/indexes/storage rules and Cloud Functions
- `colyseus-server/` realtime multiplayer server
- `docs/` current-state technical documentation plus historical audits/plans
- `__tests__/` Jest coverage for app, messaging, notifications, profile widgets, rules, and games
