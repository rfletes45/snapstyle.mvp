# Repo Map

> Segment 3/18 inventory snapshot (2026-02-18). This is a read-mostly map of what exists now, not a refactor plan.

## Scope

`snapstyle-mvp` is a multi-package repo with three active package roots and one expected-but-missing web package root:

- Root app: `package.json` (Expo React Native client)
- Cloud Functions: `firebase-backend/functions/package.json`
- Colyseus server: `colyseus-server/package.json`
- Embedded web client package: `client/package.json` (not present in this snapshot)

## Major Folders and Responsibilities

| Folder | Responsibility | Notes |
| --- | --- | --- |
| `src/` | Main React Native app code: navigation, screens, hooks, services, types | Primary product surface and most active change area |
| `firebase-backend/` | Firestore rules/indexes/storage rules + Cloud Functions source | Includes `functions/src` modular exports + `legacy.ts` bridge |
| `colyseus-server/` | Realtime multiplayer room server | Registers rooms in `colyseus-server/src/app.config.ts` |
| `docs/` | Architecture, subsystem, rollout and audit docs | Contains high-level source of truth and historical plans |
| `constants/` | Feature flags, theme/config constants | Flags gate staged rollouts and risky runtime switches |
| `__tests__/` | Root app test suites | Messaging, hooks, services, games, performance tests |
| `e2e/` | End-to-end/integration smoke coverage | Smaller surface than unit/integration test tree |
| `shared/` | Shared game data/assets used across subsystems | Not a package root in this snapshot |
| `tools/` and `scripts/` | Local utilities and maintenance scripts | Validation/sync scripts for game data and repo upkeep |
| `starforge-viewer/` | Separate viewer app/tooling subtree | Parallel project, not current main app entrypoint |

## High-Value Entry Points

### App Shell

- `App.tsx`
  - Initializes Firebase, orientation lock, call handlers/channels before UI.
  - Mounts provider stack and `RootNavigator`.
- `src/navigation/RootNavigator.tsx`
  - Central route graph (auth stacks, tabs, root-level overlays, game/call/chat routes).
- `constants/featureFlags.ts`
  - Runtime rollout controls for messaging, profile, games, calls/camera behavior.
- `src/services/firebase.ts`
  - Firebase app initialization and singleton access guards.

### Messaging

- `src/hooks/useChat.ts`
  - Main screen-facing chat orchestrator.
- `src/services/messaging/send.ts`
  - Unified send entrypoint (currently delegates into `chatV2`/outbox path).
- `src/services/messaging/subscribe.ts`
  - Unified subscribe entrypoint (currently delegates into `messageList`).
- `firebase-backend/functions/src/messaging.ts`
  - Callable/trigger backend message operations.

### Profile

- `src/services/profileService.ts`
  - Full-profile fetch/privacy/decorations/status/share/relationship logic.
- `src/services/users.ts`
  - Generic user profile CRUD helpers still used by some screens/services.
- `src/screens/profile/*`
  - New and legacy profile screen variants coexist.

### Games

- `src/screens/games/GamesHubScreen.tsx`
  - Play tab hub and invite/list surfaces.
- `src/services/gameInvites.ts`
  - Universal invite APIs plus deprecated legacy invite exports/query helpers.
- `src/hooks/useGameLobbyController.ts`
  - Canonical lobby watchdog/recovery coordinator for multiplayer screens.
- `colyseus-server/src/app.config.ts`
  - Room registration and server bootstrap.
- `firebase-backend/functions/src/games.ts`
  - Invite lifecycle, game creation/completion/cleanup backend functions.

### Backend Aggregation

- `firebase-backend/functions/src/index.ts`
  - Cloud Functions export surface.
  - Still imports several wrappers from `./legacy` for stable deployed names.

## Critical Paths by Subsystem

### Auth + App Boot

`App.tsx` -> `initializeFirebase()` -> provider stack (`AuthProvider`, `UserProvider`, etc.) -> `RootNavigator`

### Messaging Send/Receive

- Send:
  `ChatScreen/useChat` -> `services/messaging/send.ts` -> `services/chatV2.ts` -> Cloud Function `sendMessageV2` -> Firestore `Chats/*/Messages` or `Groups/*/Messages`
- Receive:
  `useChat` -> `useUnifiedMessages` -> `services/messaging/subscribe.ts` -> `services/messageList.ts` Firestore listeners -> UI merge with outbox

### Profile Update

- Domain path:
  profile screens -> `profileService` update helpers (`updateBio`, `setStatus`, `updateFullPrivacySettings`, etc.) -> `Users/{uid}`
- Generic path (still active):
  settings/profile/cosmetics -> `users.updateProfile()` -> `Users/{uid}`

### Multiplayer Game Flow

`Game screen` -> `useGameLobbyController` + `useGameLobby` -> `gameInvites` universal API -> Colyseus join -> room state updates -> cleanup/terminal updates via backend (`functions/src/games.ts`) and server persistence (`colyseus-server/src/services/persistence.ts`)

## Current Duplicate/Overlap Zones (Inventory Only)

- Invite domain overlap:
  - Universal game invites in `src/services/gameInvites.ts`
  - Group invites in `src/services/groups.ts`
  - Call invites in `firebase-backend/functions/src/calls.ts` (`GroupCallInvites`)
- Lobby implementation overlap:
  - Active stack: `useGameLobbyController` + `MultiplayerLobbyOverlay`
  - Legacy wrapper `withGameLobby` was removed in Segment 17 after no-caller proof.
- Messaging write overlap:
  - `src/services/messaging/send.ts` unified facade plus `src/services/chatV2.ts` legacy implementation still in active call path
- Profile update overlap:
  - `profileService` domain-specific updates coexist with `users.updateProfile()` generic patch path

## Related Docs

- `docs/AI_PROJECT_GUIDE.md`
- `docs/01_ARCHITECTURE.md`
- `docs/02_FIREBASE.md`
- `docs/03_CHAT_V2.md`
- `docs/03_CHAT_V3.md`
- `docs/06_GAMES.md`
- `docs/AUDIT_CHECKLIST.md`
- `docs/AUDIT_REPORT_2026-02-17.md`
