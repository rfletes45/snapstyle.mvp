# Game Invite + Flow Audit

Last updated: 2026-02-24

## Scope

This audit maps the current game invite system and end-to-end game runtime flows in:

- React Native client
- Firebase Functions orchestration
- Colyseus room join and server room registry
- Spectator plumbing
- Game result -> leaderboard/achievements hooks

This is a code-reality audit (not target architecture). Findings are based on current runtime paths.

## Architecture Overview

The game system currently has 4 cooperating layers:

1. Registry and routing contracts (client)
- `src/types/games.ts` defines canonical game IDs and metadata.
- `src/config/gameCategories.ts` maps game IDs to screen routes.
- `src/navigation/RootNavigator.tsx` and `src/types/navigation/root.ts` define actual stack routes.

2. Invite lifecycle and lobby orchestration
- Canonical invite type: `UniversalGameInvite` in `src/types/turnBased.ts`.
- Client operations: `src/services/gameInvites.ts`.
- Chat and Play subscriptions/actions:
  - `src/components/chat/ChatGameInvites.tsx`
  - `src/components/games/UniversalInviteCard.tsx`
  - `src/screens/games/GamesHubScreen.tsx`
  - `src/hooks/useGameLobby.ts`

3. Game creation and backend transitions
- Cloud triggers/callables in `firebase-backend/functions/src/games.ts`.
- Universal invite trigger: `onUniversalInviteUpdate` creates/activates games.
- Legacy invite trigger still exists: `createGameFromInvite`.

4. Realtime join and spectator runtime
- Client room mapping: `src/config/colyseus.ts`.
- Join payload builder: `src/services/colyseusJoin.ts`.
- Join execution: `src/services/colyseus.ts` (`joinWithContext` canonical path).
- Server room registry: `colyseus-server/src/app.config.ts`.
- Spectator status docs: `src/services/spectatorSessions.ts`.
- Unified spectator screen/hook:
  - `src/screens/games/SpectatorViewScreen.tsx`
  - `src/hooks/useSpectator.ts`

## End-to-End Runtime Flow Maps

## 1) SOLO flow (entry -> play -> result)

Entry:
- Play tab (`GamesHub`) or chat game picker (`GamePickerModal`) navigates via `GAME_SCREEN_MAP`.

Play:
- Solo screens own game loops and local state.

Completion:
- New path: `submitGameResult` via `src/services/gameResultService.ts` -> callable `onGameResult`.
- Legacy+new hybrid still exists for solo sessions:
  - `src/services/singlePlayerSessions.ts` writes `Users/{uid}/GameSessions` and legacy leaderboard docs.
  - Also submits `onGameResult` for XP/achievements.

Risks:
- Dual write path can produce metric drift if legacy and new schemas diverge.

## 2) TURN-BASED invite flow

Create:
- `sendUniversalInvite` writes `GameInvites/{inviteId}` with host slot.

Join:
- `claimInviteSlot` transaction updates slots and status (`pending/filling/ready`).

Start:
- Host can call `startGameEarly` (transaction lock to `starting`, then `createMatch`, then `active`).
- Backend trigger path also exists: `onUniversalInviteUpdate` creates game when status transitions to `ready`.

Navigate:
- Chat/Play cards route to game screen through `GAME_SCREEN_MAP`.
- `UniversalInviteCard` auto-navigates when status transitions to `active`.

Complete:
- Client `completeGameInvite` and backend completion trigger/update helpers both attempt to converge invite status to `completed`.

## 3) REALTIME invite flow (Colyseus-backed)

Create/join:
- Same universal invite path as turn-based.

Room key and join:
- Canonical room name resolution in `resolveColyseusRoomName`.
- Join payload built by `buildJoinOptions`.
- Join call uses `colyseusService.joinWithContext`.

Backend game creation split:
- For specific IDs in backend `EXTERNAL_COLYSEUS_INVITE_GAMES`, backend skips `TurnBasedGames` creation and sets external `gameId = ext_<gameType>_<inviteId>`.
- Client also has an external-session set in `usesExternalSessionId`.

Critical nuance:
- Metadata game ID, client lookup key, and Colyseus room name are not always equal.

## 4) SPECTATOR flow

Single-player host/spectator:
- Host creates Colyseus `spectator` room via `useSpectator(mode: "sp-host")`.
- Host writes `SpectatorSessions/{roomId}` active/finished via `spectatorSessions` service.
- Spectator joins via `SpectatorViewScreen` (`spectatorMode: "sp"`).

Multiplayer spectator:
- Spectator joins game room with `{ spectator: true }` using `useSpectator(mode: "multiplayer-spectator-standalone")`.
- `SpectatorViewScreen` uses `spectatorMode: "multiplayer"`.

Legacy overlap:
- `useSpectator` still updates spectator invite chat message payloads through `src/services/games.ts` (`updateAllSpectatorInvites`), alongside `SpectatorSessions`.

## Dependency Index (Primary Modules)

Core contracts:
- `src/types/games.ts`
- `src/types/turnBased.ts`
- `src/types/navigation/root.ts`

Routing:
- `src/config/gameCategories.ts`
- `src/navigation/RootNavigator.tsx`
- `src/screens/chat/ChatScreen.tsx`
- `src/screens/groups/GroupChatScreen.tsx`
- `src/screens/games/GamesHubScreen.tsx`

Invite service and lobby:
- `src/services/gameInvites.ts`
- `src/components/chat/ChatGameInvites.tsx`
- `src/components/games/UniversalInviteCard.tsx`
- `src/hooks/useGameLobby.ts`

Backend orchestration:
- `firebase-backend/functions/src/games.ts`
- `firebase-backend/functions/src/index.ts`

Colyseus join/runtime:
- `src/config/colyseus.ts`
- `src/services/colyseusJoin.ts`
- `src/services/colyseus.ts`
- `colyseus-server/src/app.config.ts`

Spectator:
- `src/services/spectatorSessions.ts`
- `src/services/games.ts`
- `src/hooks/useSpectator.ts`
- `src/screens/games/SpectatorViewScreen.tsx`

Results/achievements/leaderboards:
- `src/services/gameResultService.ts`
- `src/services/singlePlayerSessions.ts`
- `src/services/achievementsV2.ts`
- `src/services/leaderboards.ts`
- `firebase-backend/functions/src/achievementsV2Evaluator.ts`
- `firebase-backend/functions/src/leaderboards.ts`

## Confirmed Invariants

1. Registry invariants
- Existing game IDs are widely referenced in data and routing; IDs must remain stable.

2. Invite transition monotonicity (current intended contract)
- Waiting states: `pending -> filling -> ready -> starting -> active`.
- Terminal states: `completed`, `declined`, `expired`, `cancelled`.
- Terminal states should not transition back to waiting/active.

3. Mapping invariants
- `gameId` in metadata does not imply Colyseus room string.
- Mapping tables must remain explicit and synchronized.

4. Traceability
- `traceId` is part of invite/join contracts and should be preserved end-to-end.

## High-Risk or Brittle Points

1. Drift between canonical and legacy invite systems
- Both `createGameFromInvite` (legacy accepted-flow) and `onUniversalInviteUpdate` (universal flow) are active in backend.
- Increases maintenance surface and risk of behavior divergence.

2. Runtime classification is not centralized
- Multiple modules decide turn-based/realtime behavior via local booleans or local game sets.
- Leads to inconsistent handling and "unknown game type" branches.

3. Client/server external-session mismatch risk
- Client runtime classification and backend `EXTERNAL_COLYSEUS_INVITE_GAMES` can drift if not kept aligned.

4. Contract drift in type aliases
- `src/types/turnBased.ts` local `RealTimeGameType` is stale compared to actual metadata/runtime usage.
- Backend local `TurnBasedGameType` still contains legacy IDs.

5. Screen-map and route-map skew risk
- `GAME_SCREEN_MAP` is consumed by chat/group/play routes.
- Missing or stale entries lead directly to navigation failure ("No screen mapping for gameType").

6. Dual spectator completion channels
- `SpectatorSessions` docs and spectator invite message edits both exist.
- Not wrong, but easy to desync semantics if one path changes and the other does not.

7. Mixed legacy docs references
- Multiple source headers still reference removed docs paths (`docs/06_*`, `docs/07_*`), which now mislead maintenance.

## Suspected Deprecated Material for Phase 2 Validation

Code/API candidates:
- Legacy invite APIs in `src/services/gameInvites.ts`:
  - `sendGameInvite`
  - `cancelGameInvite`
  - `getPendingInvites`
  - `subscribeToPendingInvites`
  - internal `GameInvite`/`InviteFilterOptions` helpers
- Legacy backend trigger path:
  - `createGameFromInvite` (accepted-flow)
- Unexported scheduled function in backend:
  - `cleanupStaleActiveInvites` in `firebase-backend/functions/src/games.ts`

Type contract cleanup candidates:
- Stale `RealTimeGameType` in `src/types/turnBased.ts`.
- Backend stale local game union entries (`snap_reversi`, `snap_war`).

Doc/comment cleanup candidates:
- Obsolete `@see` references to removed docs:
  - `docs/06_GAMES.md`
  - `docs/06_GAMES_RESEARCH.md`
  - `docs/07_GAMES_ARCHITECTURE.md`

Filesystem cleanup candidates:
- Backup file:
  - `src/screens/games/BounceBlitzGameScreen.tsx.old`

## Phase 2 Cleanup Strategy (Safety)

Before each removal:
1. Repo-wide reference search (`rg`) including exports/imports and string-based references.
2. Confirm no dynamic import usage.
3. Keep backward compatibility where production callers may still exist:
- Prefer deprecating + wrapping over hard delete unless zero references.

Validation gates after changes:
- `npm run verify:registry`
- `npm run smoke`
- `npm run type-check`
- `npm run lint` (if feasible in current repo state)

## Notes for Next Phases

- Keep game IDs stable.
- Do not assume metadata ID equals Colyseus room key/name.
- Introduce one canonical runtime classifier and use it across invite routing and lobby wiring.
- Move to one canonical "Games System" document reflecting actual code paths after cleanup.

## Phase 2/3 Completion Log (2026-02-24)

## Standardization updates

- Added canonical runtime classifier in `src/types/games.ts`:
  - `GAME_RUNTIME_TYPE`
  - `getGameRuntimeType()`
  - runtime helpers (`isSoloRuntimeGame`, `isTurnBasedRuntimeGame`, `isRealtimeRuntimeGame`)
- Updated invite/runtime decision logic to use canonical classifier:
  - `src/services/gameInvites.ts` (`usesExternalSessionId`, solo invite rejection)
- Standardized Colyseus mapping in `src/config/colyseus.ts`:
  - canonical `COLYSEUS_GAME_MAPPING`
  - derived `COLYSEUS_ROOM_NAMES` / `GAME_CATEGORY_MAP`
  - dev-time integrity checks for registry and realtime mapping coverage
- Brought navigation contracts into alignment:
  - added `lights_out` and `minigolf_duels` route mapping and navigator wiring
  - files: `src/config/gameCategories.ts`, `src/types/navigation/root.ts`, `src/navigation/RootNavigator.tsx`
- Aligned backend external-session orchestration in `firebase-backend/functions/src/games.ts`:
  - canonical external set for invite-created realtime sessions
  - type-guarded external routing
  - removed stale in-branch `crazy_eights` turn-based init path

## Removed because (validated as dead/unused)

- Removed legacy invite API surface from `src/services/gameInvites.ts` (old send/cancel/query helpers and legacy types).
  - Removed because all current call sites use universal invite APIs and no runtime imports referenced the legacy exports.
- Removed stale local realtime union from `src/types/turnBased.ts`.
  - Removed because it drifted from `src/types/games.ts` and caused type-contract divergence.
- Removed unused invite parsing helpers from `src/services/turnBasedGames.ts`:
  - `toMillis`
  - `parseInviteDoc`
  - `COLLECTIONS.invites` entry
  - Removed because there were zero in-file and repo references.
- Deleted backup file `src/screens/games/BounceBlitzGameScreen.tsx.old`.
  - Removed because it had no imports/references and risked stale confusion.
- Removed unused backend helpers in `firebase-backend/functions/src/games.ts`:
  - `createInitialWordsBoard`
  - `getInitialPoolBalls`
  - `cleanupStaleActiveInvites`
  - Removed because none were referenced by exports/triggers/runtime code.

## Compatibility hardening

- Added invite status transition graph and guard helper in `src/types/turnBased.ts`:
  - `UNIVERSAL_INVITE_STATUS_TRANSITIONS`
  - `canTransitionUniversalInviteStatus()`
- Added transition checks in `src/services/gameInvites.ts` before status writes.
- Added spectator field compatibility handling across client/backend:
  - `sendUniversalInvite` now seeds `spectatorOnly: false` and `spectators: []`
  - backend trigger logic now safely handles missing `spectators` for old docs via `?? []`
  - avoids runtime crashes when reading legacy invite documents.

## Validation results

- Passed: `npm run verify:registry`
- Passed: `npm run smoke`
- Passed: `npx jest __tests__/integration/universalGameInvites.test.ts --no-coverage`
- Passed: `npm run build` in `firebase-backend/functions`
- Passed: `npm run build` in `colyseus-server`
- Failed (pre-existing unrelated workspace issues): root `npm run type-check`, root `npm run lint`
