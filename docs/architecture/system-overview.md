# System Overview

Last verified: 2026-02-22

## Scope

SnapStyle is an Expo/React Native app with Firebase as the primary backend, Colyseus for realtime multiplayer sessions, and an embedded web client for Starforge.

Runtime components:

- App shell: `App.tsx`
- Client code: `src/`
- Firebase backend:
  - Functions: `firebase-backend/functions/src/`
  - Firestore rules/indexes: `firebase-backend/firestore.rules`, `firebase-backend/firestore.indexes.json`
  - Storage rules: `firebase-backend/storage.rules`
- Colyseus server: `colyseus-server/src/app.config.ts`
- Starforge web client bundle: `starforge-viewer/` served via Colyseus `/starforge`

## App Bootstrap and Gating

Startup sequence in `App.tsx`:

1. `initializeFirebase(firebaseConfig)` runs before render.
2. App locks to portrait by default (`lockToPortrait()`).
3. Fonts load, then app UI mounts.
4. Provider stack initializes in this order:
   - `ThemeProvider`
   - `SnackbarProvider`
   - `AuthProvider`
   - `UserProvider`
   - `CallProvider`
   - `InAppNotificationsProvider`
   - `CameraProvider`
5. `RootNavigator` handles auth/profile hydration state.
6. `useOutboxProcessor()` runs once inside authenticated provider context.

Hydration states in `RootNavigator`:

- `auth` state -> `AuthStack`
- `needs_profile` state -> profile setup flow
- `ready` state -> full app (`MainStack`)

## Navigation Topology

Source: `src/navigation/RootNavigator.tsx`, `src/types/navigation/root.ts`.

Core structure:

- Root: `NavigationContainer`
- Main tabs (`AppTabs`): `Shop`, `Play`, `Inbox`, `Moments`, `Profile`
- Overlay/full-screen stack (`MainStack`) for:
  - Chat details and group chat flows
  - Camera and call screens
  - User profile + social/activity screens
  - Spectator view and cross-tab overlays

Important design choice:

- Chat/game/call overlays are mounted at root stack level so they can animate over tabs and avoid tab-layout constraints.

## Data Planes and Authority

App data responsibilities are split across three planes:

1. Client Firebase SDK plane:
   - Day-to-day reads and lightweight writes
   - Real-time listeners for chats, groups, profile, wallet, etc.
2. Cloud Functions authoritative plane:
   - Messaging callable writes (idempotency, validation, moderation/rate checks)
   - Economy/shop/task transaction safety
   - Scheduled cleanup and maintenance jobs
3. Colyseus realtime plane:
   - Stateful realtime gameplay rooms
   - Spectator session room
   - Embedded Starforge hosting support on the same server process

## Storage and Sync Strategy

Messaging is currently hybrid:

- `USE_LOCAL_STORAGE = true` on native, false on web.
- Native path:
  - SQLite (`src/services/database/`)
  - Sync engine (`src/services/sync/syncEngine.ts`)
  - `useLocalMessages`
- Fallback path:
  - Firestore-first subscription (`useUnifiedMessages`)

This means both paths are active contracts and must remain functional.

## High-Value Source-of-Truth Files

- App shell: `App.tsx`
- Navigation contracts: `src/navigation/RootNavigator.tsx`, `src/types/navigation/root.ts`
- Feature flags: `constants/featureFlags.ts`
- Messaging model: `src/types/messaging.ts`
- Game registry and IDs: `src/types/games.ts`
- Colyseus mapping: `src/config/colyseus.ts`
- Profile validation/hydration: `src/services/profile/profileContract.ts`
- Firebase SDK init: `src/services/firebase.ts`

## Critical Invariants

1. Firebase must be initialized before any service call paths use `get*Instance()`.
2. Route names in `root.ts` and `RootNavigator.tsx` must remain aligned.
3. All context-dependent hooks must mount inside their provider boundaries.
4. Realtime game room mappings must remain consistent across client/server.
5. Cross-system trace IDs should be preserved for debugging (`createTraceId` paths).

## Change-Safety Checklist

1. If modifying navigation, update both route types and navigator wiring.
2. If modifying initialization or providers, verify boot/hydration and auth transitions.
3. If changing data flow authority (client vs function vs server), update docs and tests together.
4. If touching hybrid messaging logic, test both local-first and fallback modes.
