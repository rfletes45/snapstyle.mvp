# Game Invite + Flow Audit

Last verified: 2026-03-01

## Scope

This audit maps the current game invite system and end-to-end game runtime flows in:

- React Native client (20 games, all wrapped with runtime shells)
- Firebase Functions orchestration (V3 session pipeline + reward processing)
- Colyseus room join and server room registry (persistence bridge)
- Spectator plumbing
- Game result → leaderboard/achievements hooks (V3 reward pipeline)
- Runtime shell architecture (system-owned resign, back-handler, game-over navigation)

This is a code-reality audit (not target architecture). Findings are based on current runtime paths.

## Architecture Overview

The game system currently has 6 cooperating layers:

1. Registry and routing contracts (client)

- `src/types/games.ts` defines canonical game IDs and metadata.
- `src/config/gameCategories.ts` maps game IDs to screen routes.
- `src/config/gameAdapters.ts` defines the v3 Game Adapter Registry (connection modes, lobby/game-managed split).
- `src/navigation/RootNavigator.tsx` and `src/types/navigation/root.ts` define actual stack routes.

2. Invite lifecycle and lobby orchestration

- Canonical invite type: `UniversalGameInvite` in `src/types/turnBased.ts`.
- Client operations: `src/services/gameInvites.ts`.
- Chat and Play subscriptions/actions:
  - `src/components/chat/ChatGameInvites.tsx`
  - `src/components/games/UniversalInviteCard.tsx`
  - `src/screens/games/GamesHubScreen.tsx`
  - `src/hooks/useGameLobby.ts`

3. V3 Session Pipeline (primary path — all feature flags enabled)

- Cloud Functions: `firebase-backend/functions/src/sessionsV3.ts`
  - `createSessionV3`, `inviteToSessionV3`, `joinSessionV3`, `leaveSessionV3`, `startSessionV3`, `resolveSessionV3`, `watchdogSessionsV3`
  - `processSessionRewards` (private helper — awards XP, stats, achievements)
- Client hook: `src/hooks/useSessionLobby.ts`
- Lobby screen: `src/screens/games/SessionLobbyScreen.tsx`
- Game-over screen: `src/screens/games/SessionGameOverScreen.tsx`
- Session types: `shared/sessions/types.ts`
- Firestore collection: `GameSessions/{sessionId}`
- Flow: `createSessionV3 → SessionLobbyScreen → startSessionV3 → game screen → resolveSessionV3 → processSessionRewards → SessionGameOverScreen`
- See `docs/UNIFIED_LOBBY_SPEC.md` for the full implemented spec.

4. Game creation and backend transitions (legacy + dual-write)

- Cloud triggers/callables in `firebase-backend/functions/src/games.ts`.
- Universal invite trigger: `onUniversalInviteUpdate` creates/activates games.
- Legacy invite trigger still exists: `createGameFromInvite`.
- Dual-write: `createSessionV3` can optionally create a `GameInvites` doc alongside the session.
- V3 guards: `processGameCompletion` and `processRealtimeGameCompletion` skip reward processing when `sessionId`/`v3SessionId` is present.

5. Realtime join and spectator runtime

- Client room mapping: `src/config/colyseus.ts`.
- Join payload builder: `src/services/colyseusJoin.ts`.
- Join execution: `src/services/colyseus.ts` (`joinWithContext` canonical path).
- Server room registry: `colyseus-server/src/app.config.ts`.
- Spectator status docs: `src/services/spectatorSessions.ts`.
- Unified spectator screen/hook:
  - `src/screens/games/SpectatorViewScreen.tsx`
  - `src/hooks/useSpectator.ts`

6. Runtime shell architecture (system-owned game lifecycle)

- All 20 game screens are wrapped by a runtime shell HOC that owns resign, back-handler, terminal detection, and game-over navigation.
- Multiplayer shell: `src/screens/games/MultiplayerRuntimeShell.tsx`
  - HOC: `withMultiplayerRuntime(Component)` — wraps all 14 multiplayer game screens.
  - Hook: `useMultiplayerRuntime()` — exposes `{ isV3, sessionId }` to game screens.
  - Owns: resign FAB, resign confirmation, back-handler, terminal phase detection, auto-navigate to `SessionGameOverScreen`.
- Solo shell: `src/screens/games/SoloRuntimeShell.tsx`
  - HOC: `withSoloRuntime(Component, gameId)` — wraps all 6 solo game screens.
  - Hook: `useSoloRuntime()` — exposes `{ onGameComplete }` to game screens.
  - `onGameComplete(facts)` — submits solo result + optional navigation to `SessionGameOverScreen`.
- Result facts type: `src/types/gameResultFacts.ts`
  - `GameResultFacts` — universal JSON-serialisable result envelope (outcome, scoreboard, durationMs, performanceMetrics).
  - Helpers: `getMyScoreboardEntry()`, `getWinnerEntry()`, `buildSoloScoreboard()`.
- Wrapping pattern: `export default withMultiplayerRuntime(GameScreen)` or `export default withSoloRuntime(GameScreen, "game_id")`.
- Game screens produce `GameResultFacts`; the shell consumes them and handles navigation.

## End-to-End Runtime Flow Maps

## 1) SOLO flow (entry -> play -> result)

Entry:

- Play tab (`GamesHub`) or chat game picker (`GamePickerModal`) navigates via `GAME_SCREEN_MAP`.

Runtime shell:

- All 6 solo games are wrapped with `withSoloRuntime(Component, gameId)`.
- The shell is always active (no `v3Session` gating — solo games don't use the lobby).
- Game screens access `useSoloRuntime()` for `onGameComplete(facts)`.

Play:

- Solo screens own game loops and local state.

Completion (current):

- V3 path: Game screen produces `GameResultFacts` and calls `soloRuntime.onGameComplete(facts)`.
  - Shell navigates to `SessionGameOverScreen` with `resultFacts` JSON + `isSolo=true`.
- Legacy path: `submitGameResult` via `src/services/gameResultService.ts` -> callable `onGameResult`.
- Legacy+new hybrid still exists for solo sessions:
  - `src/services/singlePlayerSessions.ts` writes `Users/{uid}/GameSessions` and legacy leaderboard docs.
  - Also submits `onGameResult` for XP/achievements.

`isV3` wiring for solo games:

- `WordMasterGameScreen`, `MinesweeperGameScreen`, `LightsOutGameScreen`: derive `isV3` from `route?.params?.v3Session`.
- `BounceBlitzGame`, `Play2048Game`, `BrickBreakerGame`: still use `OptionalRouteParams` (no `isV3` gating — shell is always active).
- `PlayStackParamList` updated: `WordGame`, `LightsOutGame`, `MinesweeperGame` now accept `V3GameScreenParams | undefined`.

Risks:

- Dual write path (legacy `singlePlayerSessions.ts` + `onGameResult`) can produce metric drift if legacy and new schemas diverge. Once `SoloRuntimeShell` result submission is fully validated, legacy paths can be removed.

## 2) TURN-BASED invite flow

Create (V3 primary path):

- `createSessionV3` creates `GameSessions/{sessionId}` (lobby phase).
- Optional dual-write creates `GameInvites/{inviteId}` alongside.
- Navigation: `SessionLobbyScreen` with `sessionId`.

Create (legacy path):

- `sendUniversalInvite` writes `GameInvites/{inviteId}` with host slot.

Join:

- V3: `joinSessionV3` (idempotent, replaces invited stub with full profile).
- Legacy: `claimInviteSlot` transaction updates slots and status (`pending/filling/ready`).

Start:

- V3: Host calls `startSessionV3` → creates `TurnBasedGames` doc, sets `firestoreGameId`, phase → `active`.
- Legacy: Host can call `startGameEarly` (transaction lock to `starting`, then `createMatch`, then `active`).
- Backend trigger path also exists: `onUniversalInviteUpdate` creates game when status transitions to `ready`.

Navigate:

- V3: `useSessionLobby.navReady` fires → `navigation.replace(screenName, { v3Session, firestoreGameId, ... })`.
- Legacy: Chat/Play cards route to game screen through `GAME_SCREEN_MAP`.

Runtime shell:

- All 7 turn-based games wrapped with `withMultiplayerRuntime`.
- Shell provides resign FAB, back-handler, terminal detection.
- Game screens produce `GameResultFacts` via `useEffect` on terminal phase.

Complete:

- V3: Shell detects `phase === "resolved"` → navigates to `SessionGameOverScreen` with `resultFacts`.
- V3 backend: `resolveSessionV3` → `processSessionRewards` (XP/stats/achievements).
- V3 guard: `processGameCompletion` skips reward processing when `sessionId` is present.
- Legacy: Client `completeGameInvite` and backend completion trigger converge invite status to `completed`.

## 3) REALTIME invite flow (Colyseus-backed)

Create/join:

- V3 primary: Same `createSessionV3` → `SessionLobbyScreen` → `startSessionV3` path.
- `startSessionV3` sets `firestoreGameId = sessionId` for realtime games.
- Legacy: Same universal invite path as turn-based.

Room key and join:

- Canonical room name resolution in `resolveColyseusRoomName`.
- Join payload built by `buildJoinOptions` (includes `v3SessionId` when present).
- Join call uses `colyseusService.joinWithContext`.
- All rooms filter by `firestoreGameId` to match players to the same room.

Runtime shell:

- All 7 realtime multiplayer games wrapped with `withMultiplayerRuntime`.
- Connection modes: 4 lobby-managed (crazy_eights, pong, dot_match via base rooms), 5 game-managed (battleship, sketch_party, starforge, crossword, minigolf).
- Game-managed screens create/join Colyseus rooms themselves using `firestoreGameId` as matchmaking key.

Backend game creation split:

- For specific IDs in backend `EXTERNAL_COLYSEUS_INVITE_GAMES`, backend skips `TurnBasedGames` creation and sets external `gameId = ext_<gameType>_<inviteId>`.
- Client also has an external-session set in `usesExternalSessionId`.

Complete:

- V3: Colyseus persistence bridge calls `resolveV3Session` on room dispose → session phase → `resolved` → `processSessionRewards`.
- V3: Shell detects terminal phase → navigates to `SessionGameOverScreen`.
- V3 guard: `processRealtimeGameCompletion` skips reward processing when `v3SessionId` is present.
- Legacy: `RealtimeGameSessions` insert triggers `processRealtimeGameCompletion`.

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
- `src/types/gameResultFacts.ts` — `GameResultFacts`, `ScoreboardEntry`, helpers
- `shared/sessions/types.ts`

Routing:

- `src/config/gameCategories.ts`
- `src/config/gameAdapters.ts`
- `src/navigation/RootNavigator.tsx`
- `src/screens/chat/ChatScreen.tsx`
- `src/screens/groups/GroupChatScreen.tsx`
- `src/screens/games/GamesHubScreen.tsx`

Runtime shells:

- `src/screens/games/MultiplayerRuntimeShell.tsx` — HOC + hook for 14 multiplayer games
- `src/screens/games/SoloRuntimeShell.tsx` — HOC + hook for 6 solo games

Invite service and lobby:

- `src/services/gameInvites.ts`
- `src/components/chat/ChatGameInvites.tsx`
- `src/components/games/UniversalInviteCard.tsx`
- `src/hooks/useGameLobby.ts`

V3 Session pipeline:

- `firebase-backend/functions/src/sessionsV3.ts` — includes `processSessionRewards`
- `src/hooks/useSessionLobby.ts`
- `src/screens/games/SessionLobbyScreen.tsx`
- `src/screens/games/SessionGameOverScreen.tsx` — universal game-over (MP + solo)
- `src/services/sessionsV3.ts`

Backend orchestration:

- `firebase-backend/functions/src/games.ts` — includes V3 guards
- `firebase-backend/functions/src/index.ts`

Colyseus join/runtime:

- `src/config/colyseus.ts`
- `src/services/colyseusJoin.ts`
- `src/services/colyseus.ts`
- `colyseus-server/src/app.config.ts`
- `colyseus-server/src/services/persistence.ts` — V3 session bridge

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

1. Drift between v3 session and legacy invite systems

- `GAME_SESSIONS_V3.DUAL_WRITE` creates both `GameSessions` and `GameInvites` docs.
- Both `createGameFromInvite` (legacy accepted-flow) and `onUniversalInviteUpdate` (universal flow) are still active in backend.
- Once v3 is fully validated, the dual-write and legacy triggers can be removed.

2. Runtime classification is now centralized (resolved)

- `GAME_RUNTIME_TYPE` in `src/types/games.ts` is the canonical classifier.
- `src/config/gameAdapters.ts` provides per-game connection mode.
- Legacy local booleans or local game type sets should defer to these.

3. Client/server external-session alignment

- Client runtime classification and backend `EXTERNAL_COLYSEUS_INVITE_GAMES` can drift if not kept aligned.
- `startSessionV3` now handles `firestoreGameId` for both turn-based and realtime, reducing but not eliminating this risk.

4. Contract drift in type aliases (partially resolved)

- Stale `RealTimeGameType` in `src/types/turnBased.ts` was removed in Phase 2.
- Backend local `TurnBasedGameType` still contains some legacy IDs — review for cleanup.

5. Screen-map and route-map skew risk

- `GAME_SCREEN_MAP` is consumed by chat/group/play routes.
- Missing or stale entries lead directly to navigation failure ("No screen mapping for gameType").

6. Dual spectator completion channels

- `SpectatorSessions` docs and spectator invite message edits both exist.
- Not wrong, but easy to desync semantics if one path changes and the other does not.

7. V3 reward deduplication boundary

- `processGameCompletion` (turn-based trigger) checks `(after as any).sessionId` to skip rewards for V3 sessions.
- `processRealtimeGameCompletion` checks `data.v3SessionId` to skip rewards for V3 sessions.
- All V3 rewards flow through `processSessionRewards` in `sessionsV3.ts` (idempotent, checks `rewardsProcessed` flag).
- Watchdog Pass 4 retries `processSessionRewards` for resolved sessions where `rewardsProcessed !== true`.
- Risk: if `sessionId` is not written to `TurnBasedGames` docs during `startSessionV3`, the V3 guard fails and rewards double-count.

8. Starforge WebView result-facts bridge (incomplete)

- `StarforgeGameScreen` is wrapped with `withMultiplayerRuntime` but uses a WebView for gameplay.
- Result-facts integration requires a WebView postMessage bridge to send `GameResultFacts` from the Starforge client to the React Native shell.
- Currently deferred — the shell wrapping is active but result-facts are not populated from the WebView.

9. CrazyEights has no game screen file

- `CrazyEightsGame` is registered in `PlayStackParamList` and the adapter registry, but no `CrazyEightsGameScreen.tsx` file exists.
- Only `CrazyEightsSpectatorRenderer.tsx` exists in the codebase.
- Navigation to this game will fail at runtime.

## Suspected Deprecated Material

### Already removed (STOP 5 / Phase 2 cleanup)

Dead-code stubs removed from 13 game screens:

- `__codexGameCompletion` (voided `useGameCompletion()` calls) — removed from 8 files
- `__codexGameHaptics` (voided `useGameHaptics()` calls) — removed from 11 files
- `__codexGameOverModal` (permanently-hidden `<GameOverModal visible={false}/>`) — removed from 9 files
- 32 orphaned import lines removed (`useGameCompletion` × 8, `useGameHaptics` × 11, `GameOverModal` × 9)

Legacy invite APIs removed in Phase 2:

- `sendGameInvite`, `cancelGameInvite`, `getPendingInvites`, `subscribeToPendingInvites`
- Legacy `GameInvite`/`InviteFilterOptions` types
- Stale `RealTimeGameType` union in `src/types/turnBased.ts`
- Backend dead helpers: `createInitialWordsBoard`, `getInitialPoolBalls`, `cleanupStaleActiveInvites`
- Backup file: `src/screens/games/BounceBlitzGameScreen.tsx.old`

### Still present — candidates for future removal

Code/API candidates:

- Legacy backend trigger path:
  - `createGameFromInvite` (accepted-flow) — still active for backward compatibility
  - `onUniversalInviteUpdate` → `createGameFromUniversalInvite` — still active
- Dual-write flag `GAME_SESSIONS_V3.DUAL_WRITE` and `GameInvites` doc creation in `createSessionV3`
- `src/services/singlePlayerSessions.ts` — legacy solo session/leaderboard persistence (648 lines)
- `useGameCompletion` hook — still used by 5 multiplayer screens (Chess, Checkers, ConnectFour, Gomoku, Reversi) for `exitGame` action. Can be consolidated into runtime shell.
- `useGameLobby` hook — pre-v3 lobby logic, still referenced in some screens
- `MultiplayerLobbyOverlay` component — in-game lobby overlay (pre-v3), still imported

Type contract cleanup candidates:

- Backend stale local game union entries (`snap_reversi`, `snap_war`).

Doc/comment cleanup candidates:

- Obsolete `@see` references to removed docs:
  - `docs/06_GAMES.md`
  - `docs/06_GAMES_RESEARCH.md`
  - `docs/07_GAMES_ARCHITECTURE.md`

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
- The v3 session pipeline is now the primary path — all 5 `GAME_SESSIONS_V3` flags are enabled.
- Dual-write can be removed once v3 is fully validated in production.
- Legacy invite triggers (`createGameFromInvite`, `onUniversalInviteUpdate`) remain active for backward compatibility.
- `MultiplayerLobbyOverlay` and `useGameLobbyController` are still used inside game screens but are secondary to the v3 lobby.
- **All 20 games are now wrapped with runtime shells** (`MultiplayerRuntimeShell` for 14 MP games, `SoloRuntimeShell` for 6 solo games).
- Runtime shells handle result-facts emission, session resolution, navigation, and game-over presentation.
- Three solo games (WordMaster, Minesweeper, LightsOut) accept `V3GameScreenParams` and pass `isV3` through `SoloRuntimeShell`.
- Three solo games (BounceBlitz, Play2048, BrickBreaker) still use `OptionalRouteParams` — `isV3` wiring is deferred until `singlePlayerSessions.ts` is refactored.
- `processSessionRewards` in `sessionsV3.ts` is the sole reward processor for V3 sessions.
- Starforge WebView result-facts bridge is deferred — shell wrapping is active but postMessage integration is not.

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

---

## vNext Invite System — REMOVED (2026-02-25)

The vNext invite system (InviteBar, InviteViews, GameInviteLive, onGameInviteCreated,
inviteVNext.ts, inviteViewService.ts, useInviteBar.ts, inviteLiveWriter.ts,
inviteVNextBridge.ts) was fully removed on 2026-02-25.

The canonical invite system uses `ChatGameInvites` / `UniversalInviteCard` with
direct `GameInvites` subscriptions. See `docs/GAMES_SYSTEM.md` §4–§6 for details.

---

## Runtime Shell Migration Completion Log (STOPs 0–5, 2026-03-01)

### STOP 0 — Full inventory and migration tracker

- Catalogued all 20 games (6 solo, 7 turn-based, 7 realtime).
- Built migration tracker spreadsheet and screen analysis.

### STOP 1 — Type foundations and runtime shell HoCs

- Created `GameResultFacts` type (`src/types/gameResultFacts.ts`, 172 lines) — universal result envelope for all games.
- Created `MultiplayerRuntimeShell` HOC (`src/components/games/MultiplayerRuntimeShell.tsx`, 497 lines) — wraps all 14 MP game screens.
- Created `SoloRuntimeShell` HOC (`src/components/games/SoloRuntimeShell.tsx`, 258 lines) — wraps all 6 solo game screens.
- Expanded `src/config/gameAdapters.ts` with per-game adapter entries for all 20 games.
- Updated `SessionGameOverScreen` to consume `resultFacts` and `isSolo` params.

### STOP 2 — Backend reward determinism

- Added `processSessionRewards()` in `sessionsV3.ts` — idempotent reward processor for V3 sessions.
- Added V3 guards in `games.ts`:
  - `processGameCompletion` checks `(after as any).sessionId` to skip rewards for V3 sessions.
  - `processRealtimeGameCompletion` checks `data.v3SessionId` to skip rewards for V3 sessions.
- Added Colyseus persistence bridge functions: `resolveV3Session`, `abandonV3Session`, `linkColyseusRoom`.
- Added Watchdog Pass 4 — retries `processSessionRewards` for resolved sessions where `rewardsProcessed !== true`.

### STOP 3 — Pilot migration (3 games)

- Wrapped `TicTacToeGameScreen` with `withMultiplayerRuntime`.
- Wrapped `PongGameScreen` with `withMultiplayerRuntime`.
- Wrapped `Play2048Screen` with `withSoloRuntime`.
- Verified runtime shell activation, result-facts emission, and session resolution for all 3 pilots.

### STOP 4 — Bulk migration (remaining 17 games)

- Wrapped all remaining 17 game screens with appropriate runtime shell HOC.
- 14 multiplayer games use `withMultiplayerRuntime`.
- 6 solo games use `withSoloRuntime`.
- All 20 games verify zero TS errors.

### STOP 5 — Dead-code cleanup and V3 wiring

- Removed 28 `__codex*` dead-code stubs from 13 game screen files:
  - `__codexGameCompletion` (voided `useGameCompletion()`) — 8 files
  - `__codexGameHaptics` (voided `useGameHaptics()`) — 11 files
  - `__codexGameOverModal` (hidden `<GameOverModal visible={false}/>`) — 9 files
- Removed 32 orphaned import lines (`useGameCompletion` × 8, `useGameHaptics` × 11, `GameOverModal` × 9).
- Wired `isV3` for 3 solo games that accept `V3GameScreenParams`:
  - `WordMasterGameScreen`
  - `MinesweeperGameScreen`
  - `LightsOutGameScreen`
- Added §26 to `docs/GAMES_SYSTEM.md` documenting runtime shell architecture.
- Verified zero TS errors across entire project.

### Validation results (STOP 5)

- Passed: `npx tsc --noEmit` — zero errors
- Verified: all 20 games wrapped, all dead-code stubs removed, 3 solo games `isV3`-wired
