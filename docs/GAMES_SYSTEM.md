# Games System

Last verified: 2026-03-01

This is the canonical guide for SnapStyle game architecture, invites, runtime routing, runtime shells, and game completion plumbing.

Related system docs:

- Profile system: `docs/PROFILE_SYSTEM.md`
- Unified lobby spec: `docs/UNIFIED_LOBBY_SPEC.md`
- Battleship deep-dive: `docs/features/battleship.md`

Recent changes (invite hardening → v3 session system):

- §13: Server-authoritative `finalizeUniversalInvite` (idempotent, transactional)
- §14: Chat visibility system (`chatVisibility` field + subscription/render filters)
- §15: Game recovery service (AsyncStorage crash-recovery + banner)
- §16: Watchdog reconciliation (`reconcileActiveInvites` every 15 min)
- §17: External Colyseus invite finalization fix (ext\_ parsing, separated try/catch, cardPlayers)
- §18: Validation commands
- §19: Phase 2 — Client-side chat layer hardening (leak guard, DEV tools, staleness)
- §20: Phase 3 + 4 — Realtime join stability & watchdog hardening (join mutex, grace windows, recovery)
- §21: Phase 5 — V3 session architecture (session-first lifecycle, Cloud Functions, lobby/game-over screens)
- §22: Phase 6 — Realtime alignment (Colyseus bridge, dual-write, useSessionLobby hook)
- §23: V3 game adapter registry (`src/config/gameAdapters.ts`) — connection mode per game
- §24: V3 lobby bug fixes (invite rendering, phantom participants, auto-join, game connection)
- §25: Invite lifecycle hardening (guaranteed chat disappearance)
- §26: V3 runtime shell architecture (MultiplayerRuntimeShell, SoloRuntimeShell, GameResultFacts)
- **§27: End-to-end hardening audit — 10 critical/high fixes (TOCTOU race, auth/validation, bookmark cleanup, push notifications, theme tokens, invite sync, session GC)**

## 1) Overview

Runtime surfaces:

- Client app (React Native): `src/`
- Firebase Functions orchestration: `firebase-backend/functions/src/`
- Colyseus realtime server: `colyseus-server/src/`

Core data stores:

- `GameInvites/{inviteId}`: universal invite docs
- `TurnBasedGames/{gameId}`: Firestore-backed turn-based matches
- `RealtimeGameSessions/{sessionId}`: persisted realtime completion records
- `SpectatorSessions/{roomId}`: single-player spectator session status docs
- `GameSessions/{sessionId}`: V3 session pipeline (primary path for all new sessions)

Runtime shell layer:

- All 20 games are wrapped with a runtime shell HOC that intercepts completion, emits `GameResultFacts`, and manages navigation.
- `MultiplayerRuntimeShell` (`src/components/games/MultiplayerRuntimeShell.tsx`) — wraps 14 multiplayer game screens.
- `SoloRuntimeShell` (`src/components/games/SoloRuntimeShell.tsx`) — wraps 6 solo game screens.
- Per-game adapters in `src/config/gameAdapters.ts` configure connection mode and metadata.
- See §26 for full runtime shell architecture details.

V3 session pipeline (primary path):

- `createSessionV3` → `SessionLobbyScreen` → `startSessionV3` → game screen → `resolveSessionV3` → `processSessionRewards` → `SessionGameOverScreen`
- Backend reward processing: `processSessionRewards` in `sessionsV3.ts` (idempotent, checks `rewardsProcessed` flag).
- V3 guards in `games.ts` skip legacy reward triggers for V3 sessions.

Important: game metadata IDs, Colyseus client keys, and Colyseus room names are not always equal. Always use mapping helpers.

## 2) Game Catalog And Registry

Canonical file:

- `src/types/games.ts`

Required registry contracts:

- game ID unions: `SinglePlayerGameType`, `TurnBasedGameType`, `RealTimeGameType`, `ExtendedGameType`
- metadata table: `GAME_METADATA`
- score limits: `EXTENDED_GAME_SCORE_LIMITS`
- runtime classification: `GAME_RUNTIME_TYPE` + `getGameRuntimeType(gameId)`

Current runtime categories (source: `GAME_RUNTIME_TYPE`):

- `solo`: `bounce_blitz`, `play_2048`, `word_master`, `brick_breaker`, `minesweeper_classic`, `lights_out`
- `turnBased`: `chess`, `checkers`, `tic_tac_toe`, `connect_four`, `dot_match`, `gomoku_master`, `reversi_game`
- `realtime`: `crazy_eights`, `crossword_puzzle`, `starforge_game`, `sketch_party_game`, `pong_game`, `minigolf_duels`, `battleship`

Notes:

- Do not rename existing IDs.
- `crazy_eights` is currently treated as `realtime` for invite/session orchestration.

## 3) Navigation Contracts

Navigation type contracts:

- `src/types/navigation/root.ts`

Screen wiring:

- `src/navigation/RootNavigator.tsx`
- `src/config/gameCategories.ts` (`GAME_SCREEN_MAP`)

Canonical game route map (`GAME_SCREEN_MAP`):

- `bounce_blitz -> BounceBlitzGame`
- `brick_breaker -> BrickBreakerGame`
- `pong_game -> PongGame`
- `play_2048 -> Play2048Game`
- `lights_out -> LightsOutGame`
- `minesweeper_classic -> MinesweeperGame`
- `word_master -> WordGame`
- `crossword_puzzle -> CrosswordGame`
- `tic_tac_toe -> TicTacToeGame`
- `checkers -> CheckersGame`
- `chess -> ChessGame`
- `crazy_eights -> CrazyEightsGame`
- `connect_four -> FourGame`
- `dot_match -> DotsGame`
- `gomoku_master -> GomokuGame`
- `reversi_game -> ReversiGame`
- `starforge_game -> StarforgeGame`
- `sketch_party_game -> SketchPartyGameScreen`
- `minigolf_duels -> MiniGolfDuelsGame`
- `battleship -> BattleshipGame`

Deep links:

- configured in `RootNavigator` linking config for app-level routes (`play`, `inbox`, `chat/:friendUid`, etc.)
- individual game screen deep-link paths are not exhaustively declared; in-app navigation uses stack route names + params

## 4) Invite Lifecycle

Canonical invite type:

- `src/types/turnBased.ts` -> `UniversalGameInvite`

Canonical status type + transition graph:

- `UniversalInviteStatus`
- `UNIVERSAL_INVITE_STATUS_TRANSITIONS`
- `canTransitionUniversalInviteStatus(from, to)`

Primary statuses:

- waiting chain: `pending -> filling -> ready -> starting -> active`
- terminal: `completed`, `declined`, `expired`, `cancelled`

Monotonicity rules:

- terminal states do not transition out
- service guards now validate transitions before writes (`src/services/gameInvites.ts`)

Core invite fields:

- targeting/context: `context`, `targetType`, `conversationId`, `eligibleUserIds`
- slot control: `requiredPlayers`, `maxPlayers`, `claimedSlots`, `filledAt`
- state refs: `status`, `gameId`, `traceId`, `inviteVersion`
- spectator controls: `spectatingEnabled`, `spectatorOnly?`, `spectators?`, `maxSpectators?`
- finalization: `resolvedAt`, `resolutionType`, `resolvedBy`, `chatVisibility`, `chatHiddenAt`, `chatHiddenInConversationIds`, `deleteAt`, `completedAt`

DM vs group semantics:

- DM invite: `context="dm"`, `targetType="specific"`, `showInPlayPage=true`
- Group invite: `context="group"`, `targetType="universal"`, `showInPlayPage=false`

## 5) Client Invite Flow

Canonical client service:

- `src/services/gameInvites.ts`

Entry points:

- `sendUniversalInvite(params)`
- `claimInviteSlot(inviteId, userId, userName, userAvatar?)`
- `unclaimInviteSlot(inviteId, userId)`
- `startGameEarly(inviteId, hostId)`
- `cancelUniversalInvite(inviteId, hostId)`
- `completeGameInvite(inviteId, winnerId?, winReason?)`
- subscriptions: `subscribeToUniversalInvite`, `subscribeToPlayPageInvites`, `subscribeToConversationInvites`

Validation behavior in `sendUniversalInvite`:

- rejects unknown IDs (`GAME_METADATA` lookup)
- rejects unavailable games (`metadata.isAvailable`)
- rejects `solo` runtime invites (`getGameRuntimeType(...) === "solo"`)

Create invite (host):

1. `GamePickerModal` calls `sendUniversalInvite`.
2. `ChatScreen` / `GroupChatScreen` handle `onInviteCreated` and immediately navigate host to game screen with `inviteId`.
3. Game screen lobby (`useGameLobby`) subscribes invite doc and waits for `active`.

Accept invite (joiner):

1. `UniversalInviteCard` action calls `claimInviteSlot`.
2. Joiner navigates immediately to game screen with `inviteId`.
3. `useGameLobby` subscribes invite status and joins when it transitions to `active`.

Auto navigation:

- `UniversalInviteCard` detects transition to `active` and calls `onPlay(gameId, gameType, inviteId)`.
- Chat/group screens dedupe navigation with `navigatedInvitesRef`.

Lobby/start behavior:

- host can call `startGameEarly` when minimum players joined
- function locks invite to `starting`, then creates match (or external session id), then promotes to `active`
- rollback path: if match creation fails, status returns to `ready`

## 6) Server Orchestration (Firebase Functions)

Main file:

- `firebase-backend/functions/src/games.ts`

Universal path:

- trigger: `onUniversalInviteUpdate`
- when status changes to `ready`, calls `createGameFromUniversalInvite`

Turn-based orchestration:

- creates `TurnBasedGames/{gameId}` with initial game state from `getInitialGameState(gameType)`
- invite updated to `active` with `gameId`

Realtime orchestration:

- external set: `EXTERNAL_COLYSEUS_INVITE_GAMES`
- no `TurnBasedGames` doc is created
- invite gets `gameId = ext_<gameType>_<inviteId>`

Legacy path (still present for backward compatibility):

- `createGameFromInvite` trigger on legacy accepted invites

Additional completion paths:

- `processGameCompletion`: reacts to `TurnBasedGames` terminal statuses → calls `finalizeUniversalInvite`
- `processRealtimeGameCompletion`: reacts to `RealtimeGameSessions` inserts → calls `finalizeUniversalInvite`
- `onGameResult` callable: universal XP/achievement/per-game-stats pipeline

Invite cleanup/expiry/reconciliation:

- scheduled: `expireGameInvites`, `cleanupResolvedInvites`, `cleanupVacantGames`
- watchdog: `reconcileActiveInvites` (every 15 min) — see §16

All completion/cleanup paths funnel through `finalizeUniversalInvite` — see §13.

## 7) Runtime Categories

### Solo

Flow:

1. Navigate to game screen via `GAME_SCREEN_MAP`.
2. Screen runs local game loop, wrapped by `SoloRuntimeShell` (see §26.4).
3. On finish, call `submitGameResult(buildGameResultEvent(...))`.
4. If `isV3`, shell resolves V3 session and navigates to `SessionGameOverScreen`.
5. Optional legacy persistence path may also write `GameSessions` (`singlePlayerSessions.ts` — candidate for removal).

Runtime shell wrapping:

- All 6 solo games use `withSoloRuntime(ScreenComponent)` HOC.
- 3 games (WordMaster, Minesweeper, LightsOut) accept `V3GameScreenParams` and pass `isV3` through the shell.
- 3 games (BounceBlitz, Play2048, BrickBreaker) still use `OptionalRouteParams` — `isV3` wiring deferred.

Games: `bounce_blitz`, `play_2048`, `word_master`, `brick_breaker`, `minesweeper_classic`, `lights_out`

### Turn-based (Firestore-orchestrated)

Flow:

1. Create invite (`sendUniversalInvite`) or create V3 session (`createSessionV3`).
2. Players claim slots (`claimInviteSlot`) / join session lobby until ready.
3. Host starts or trigger auto-creates match.
4. `TurnBasedGames` doc drives gameplay state lifecycle.
5. Game screen is wrapped by `MultiplayerRuntimeShell` (see §26.3).
6. Shell detects terminal phase → emits `GameResultFacts` → navigates to `SessionGameOverScreen`.
7. V3 path: `resolveSessionV3` + `processSessionRewards` for rewards. Legacy path: `processGameCompletion` trigger.

Games: `chess`, `checkers`, `tic_tac_toe`, `connect_four`, `dot_match`, `gomoku_master`, `reversi_game`

### Realtime (Colyseus)

Flow:

1. Create and claim invite as above, or create V3 session.
2. Invite activation resolves to external session id for orchestration.
3. Client joins Colyseus via `joinWithContext` and resolved room mapping.
4. Game screen is wrapped by `MultiplayerRuntimeShell` (see §26.3).
5. Room handles realtime gameplay and eventually persists completion (`RealtimeGameSessions`) if implemented by room.
6. V3 path: shell detects completion → `resolveSessionV3` + `processSessionRewards`. V3 guard in `processRealtimeGameCompletion` skips legacy rewards.

Games: `crazy_eights`, `crossword_puzzle`, `starforge_game`, `sketch_party_game`, `pong_game`, `minigolf_duels`, `battleship`

### Battleship (Colyseus realtime, invite-driven)

Source files:

- Room: `colyseus-server/src/rooms/turnbased/BattleshipRoom.ts` (~1096 lines)
- Schemas: `colyseus-server/src/schemas/battleship.ts` (231 lines)
- Client screen: `src/screens/games/BattleshipGameScreen.tsx`
- Client hook: `src/hooks/useBattleshipGame.ts`
- Tests: `colyseus-server/tests/rooms/BattleshipRoom.test.ts` (97 tests)

Phase machine: `waiting -> placement -> combat -> finished`

- `waiting`: lobby, players join via invite
- `placement`: 30s timer, each player places 5 ships on a 10x10 grid (random auto-fill on timeout)
- `combat`: alternating turns with 30s shot clock (random shot on timeout), players fire at opponent grid
- `finished`: winner determined when all opponent ships sunk, or by forfeit/disconnect

Fog-of-war design:

- Ship placements stored server-side only (not in Colyseus schema)
- Each player receives their own board via targeted messages
- Shared state only exposes shot results (`ShotRecord`: hit/miss/sunk) and sunk ship outlines (`SunkShip`)
- Opponent cannot see ship positions until each ship is fully sunk

Message protocol:

- `place_ships`: client sends ship placements during placement phase
- `fire`: client sends shot coordinates during combat phase
- `surrender`: player forfeits the match
- `shot_result`: server broadcasts hit/miss/sunk result
- `game_over`: server broadcasts winner + full board reveal
- `board_state`: server sends private board to individual player

Completion path:

- `BattleshipRoom.onDispose()` clears `firestoreGameId` -> `persistGameResult()` -> `RealtimeGameSessions` doc (with `inviteId` + `firestoreGameId` metadata)
- Triggers `processRealtimeGameCompletion` Cloud Function (stats, achievements, XP, GameHistory)
- `deleteGameAndInvite(firestoreGameId, inviteId)` transitions invite to terminal state (inviteId parsed from `ext_` format — see §17)
- `persistGameResult` and `deleteGameAndInvite` run in **separate try/catch blocks** so cleanup always runs
- Client does NOT call `submitGameResult` — fully server-driven

Per-player stats persisted (`gameSpecific`):

- `hits`, `misses`, `shotsFired`, `accuracy` (0-100)
- `shipsRemaining`, `shipCellsRemaining`, `shipsSunk`
- Achievement flags: `flawlessWin`, `sharpshooterWin`, `comebackWin`, `perfectGame`, `speedrunWin`

Achievements (9 total, 2 secret):

- Bronze: Anchors Aweigh (first match), Victorious Admiral (first win)
- Silver: Fleet Commander (10 wins), Sharpshooter (70%+ accuracy win)
- Gold: Sea Veteran (25 matches), Unsinkable (flawless win), Against the Tide (comeback win)
- Platinum (secret): Perfect Storm (0 misses), Blitz Attack (<=25 shots)

Spectator support:

- `maxSpectators = 10`
- Spectators join with `{ spectator: true }` flag
- Spectators see both boards (no fog-of-war) but cannot send actions

## 8) Colyseus Join Contract

Canonical client mapping/config:

- `src/config/colyseus.ts`
- `COLYSEUS_GAME_MAPPING`
- `resolveColyseusRoomName(gameType)`
- `getColyseusClientKey(gameType)`

Canonical payload types:

- `src/types/gameSession.ts` (`GameSessionContext`, `GameJoinOptions`)
- `src/services/colyseusJoin.ts` (`buildJoinOptions`)

Join payload fields:

- required: `token`, `protocolVersion`, `buildInfo`
- routing/context: `firestoreGameId?`, `spectator?`, `inviteId?`, `conversationId?`
- observability: `traceId?`

Server room registry:

- `colyseus-server/src/app.config.ts`
- must stay in sync with `COLYSEUS_GAME_MAPPING.roomName`

Mapping nuance (critical):

- metadata ID can differ from client key and room name
- examples:
  - `chess` -> client key `chess_game` -> room `chess`
  - `gomoku_master` -> client key `gomoku_master_game` -> room `gomoku`

## 9) Spectator System

Single-player spectator:

- host mode: `useSpectator({ mode: "sp-host" })`
- creates `spectator` Colyseus room + `SpectatorSessions/{roomId}` doc
- host pushes `state_update` messages
- spectator joins via `SpectatorViewScreen` with `spectatorMode="sp"`

Multiplayer spectator:

- game screen mode: `useSpectator({ mode: "multiplayer-spectator", room, state })`
- standalone view mode: `useSpectator({ mode: "multiplayer-spectator-standalone", roomName, firestoreGameId })`
- joins game room with `{ spectator: true }`; server tracks read-only spectator role

Shared state expectations:

- spectators receive room state updates
- spectators must not be able to mutate player state
- host/spectator count comes from room state (`spectatorCount`, `spectators`)

Compatibility note:

- `useSpectator` still updates legacy spectator invite message refs through `updateAllSpectatorInvites` in `src/services/games.ts`.

## 10) Leaderboards And Achievements Wiring

### V3 Session Rewards (Primary Path)

For V3 sessions, rewards flow through the backend `processSessionRewards` function in `sessionsV3.ts`:

1. `resolveSessionV3` marks the session `resolved`.
2. `processSessionRewards` (called by `resolveSessionV3` and retried by Watchdog Pass 4):
   - Reads session data + participants.
   - Awards XP / levels per participant.
   - Updates per-game stats (`updatePerGameStatsV2`).
   - Evaluates achievements (`evaluateAchievementsV2`).
   - Writes `GameHistory` entries.
   - Sets `rewardsProcessed: true` (idempotent — skips if already set).
3. V3 guards prevent double-counting:
   - `processGameCompletion` (turn-based trigger) checks `(after as any).sessionId` — skips if present.
   - `processRealtimeGameCompletion` (realtime trigger) checks `data.v3SessionId` — skips if present.

### Legacy Reward Path (still active for non-V3)

Primary completion entry point (client):

- `src/services/gameResultService.ts`
- call `submitGameResult(buildGameResultEvent(...))`

Server-side processing:

- callable `onGameResult` in `functions/src/games.ts`:
  - validates input + mode
  - dedups by `idempotencyKey`
  - awards XP / levels
  - updates per-game stats (`updatePerGameStatsV2`)
  - evaluates achievements (`evaluateAchievementsV2`)

Realtime completion trigger:

- `processRealtimeGameCompletion` (`RealtimeGameSessions` onCreate)
- updates per-player stats/achievements/xp and writes `GameHistory`
- **V3 guard**: skips all processing when `v3SessionId` is present on the doc

Legacy overlap to know:

- `singlePlayerSessions.ts` still writes legacy session/leaderboard docs and also submits `onGameResult`.
- This is a candidate for removal once all solo games are V3-wired.

Required end-of-game data:

- `gameId`, `mode`, `outcome`, `durationMs`
- `participants[]` including caller
- `score` where applicable
- include `inviteId` and `conversationId` for multiplayer sessions when available
- V3 sessions: `GameResultFacts` envelope is built by runtime shell and passed to `SessionGameOverScreen`

## 11) Add A New Game Cookbook

### A) Baseline checklist (all games)

1. Add game ID to `src/types/games.ts` unions.
2. Add `GAME_METADATA` entry.
3. Add `EXTENDED_GAME_SCORE_LIMITS` entry.
4. Add runtime classification in `GAME_RUNTIME_TYPE`.
5. Add route mapping in `src/config/gameCategories.ts` (`GAME_SCREEN_MAP`).
6. Add route type in `src/types/navigation/root.ts`.
7. Add screen registration in `src/navigation/RootNavigator.tsx`.
8. Run `npm run verify:registry`.

### B) Solo/puzzle game checklist

1. Implement screen + engine under `src/screens/games/` and optional `src/games/<game>/`.
2. Ensure screen calls `submitGameResult(buildGameResultEvent(...))` at completion.
3. Wrap screen export with `withSoloRuntime(ScreenComponent)` HOC.
4. Add a `resultFactsEffect` to the adapter that builds `GameResultFacts` from screen state. See §26.5 for the pattern.
5. Accept `V3GameScreenParams` in route params (or `OptionalRouteParams` if V3 wiring is deferred).
6. If spectating is desired, integrate `useSpectator({ mode: "sp-host" })` + invite UI.
7. Add/adjust achievements in catalogs and evaluator expectations.

### C) Turn-based game checklist (Firestore)

1. Add to `TurnBasedGameType` unions where applicable.
2. Add default invite settings in `src/services/gameInvites.ts`.
3. Add initial state branch in `firebase-backend/functions/src/games.ts` -> `getInitialGameState`.
4. Ensure game screen consumes `inviteId`/`matchId` route params and joins lobby path.
5. Wrap screen export with `withMultiplayerRuntime(ScreenComponent)` HOC.
6. Add a `resultFactsEffect` to the adapter that builds `GameResultFacts` from game state. See §26.5 for the pattern.
7. Confirm completion path calls `completeGameInvite` and `submitGameResult` (legacy), or relies on runtime shell for V3 sessions.
8. Validate in smoke tests for invite lifecycle.

### D) Realtime game checklist (Colyseus)

1. Add game metadata/runtime as `realtime` in `src/types/games.ts`.
2. Add mapping in `src/config/colyseus.ts` (`COLYSEUS_GAME_MAPPING`).
3. Register room in `colyseus-server/src/app.config.ts`.
4. If invite-driven, include game in backend `EXTERNAL_COLYSEUS_INVITE_GAMES`.
5. Ensure screen uses canonical join path (`joinWithContext` / mapping resolver).
6. Wrap screen export with `withMultiplayerRuntime(ScreenComponent)` HOC.
7. Add a `resultFactsEffect` to the adapter that builds `GameResultFacts` from room state. See §26.5 for the pattern.
8. Add room completion persistence if needed (`RealtimeGameSessions`) for post-game processing.

### E) Spectator-enabled checklist

1. Decide mode:

- multiplayer room spectator (`spectator: true`)
- single-player `spectator` room

2. For single-player host mode:

- create/finish `SpectatorSessions` docs (`createSpectatorSession`, `finishSpectatorSession`)

3. Add renderer in `src/components/games/spectator-renderers/` if using `SpectatorViewScreen`.
4. Verify spectator cannot send gameplay actions.

## 12) Troubleshooting

### Unknown game type

Symptoms:

- `sendUniversalInvite` throws `Unknown game type`.
- start flow logs `Unknown game type`.

Checks:

1. Confirm ID exists in `GAME_METADATA`.
2. Confirm ID is in the correct union type.
3. Confirm runtime classification exists in `GAME_RUNTIME_TYPE`.

### No screen mapping for game type

Symptoms:

- chat/group logs `No screen mapping for gameType`.

Checks:

1. Add missing `GAME_SCREEN_MAP` entry.
2. Add corresponding route in Play stack types and RootNavigator.

### Colyseus room mapping missing

Symptoms:

- `resolveColyseusRoomName` throws `JOIN_ROOM_NOT_FOUND`.

Checks:

1. Add/verify `COLYSEUS_GAME_MAPPING` entry.
2. Verify `roomName` exists in `colyseus-server/src/app.config.ts`.
3. Validate suffix behavior (`gameId`, `gameId_game`, room name).

### Invite stuck in `pending` / `filling` / `ready`

Checks:

1. Confirm joiner actually claimed slot (`claimedSlots`).
2. Confirm host started game when needed (`startGameEarly`).
3. Check Firebase logs for `onUniversalInviteUpdate` and `createGameFromUniversalInvite`.
4. Verify status transition validity against `UNIVERSAL_INVITE_STATUS_TRANSITIONS`.
5. The `reconcileActiveInvites` watchdog (§16) auto-finalizes stuck `starting` invites after 10 min.

### Invite still visible in chat after game ended

Checks:

1. Confirm `chatVisibility === "hidden"` on the invite doc.
2. If missing, the `reconcileActiveInvites` watchdog self-heals terminal invites (Pass 3).
3. Confirm `subscribeToConversationInvites` includes the `chatVisibility != "hidden"` filter.
4. Check `ChatGameInvites` defensive render filter.
5. Manually call `completeGameInvite(inviteId)` if needed — it writes chat-hide fields.
6. For external Colyseus games: verify `deleteGameAndInvite` can parse `inviteId` from `ext_<gameType>_<inviteId>` format — see §17.

### Invite active but wrong room joined

Checks:

1. Ensure navigation includes `inviteId` so lobby can resolve correctly.
2. For realtime flows, ensure `settings.colyseusRoomKey` is preserved.
3. Check `useGameLobby` resolved ID logic (`isTurnBased` branch).

### Spectator join issues

Checks:

1. Verify mode and params:

- single-player: roomId + `spectatorMode="sp"`
- multiplayer: roomName + firestoreGameId + spectator flag

2. Confirm room implements spectator-safe behavior.
3. Check `SpectatorSessions` doc for single-player status.

### Logs to inspect

Client tags:

- `services/gameInvites`
- `services/gameRecovery`
- `hooks/useGameLobby`
- `hooks/useGameRecovery`
- `components/chat/ChatGameInvites`
- `services/colyseus`
- `hooks/useSpectator`
- `services/gameResultService`
- `components/games/MultiplayerRuntimeShell`
- `components/games/SoloRuntimeShell`

Server functions:

- `onUniversalInviteUpdate`
- `createGameFromInvite` (legacy)
- `processGameCompletion`
- `processRealtimeGameCompletion`
- `processSessionRewards` (V3 reward processor)
- `onGameResult`
- `reconcileActiveInvites` (watchdog)
- `finalizeUniversalInvite` (internal helper, logged as `[finalizeUniversalInvite]`)

Colyseus server:

- room join/auth logs in `colyseus-server`
- room creation and `filterBy(["firestoreGameId"])` matching behavior
- persistence bridge: `resolveV3Session`, `abandonV3Session`, `linkColyseusRoom`

### Runtime shell not activating

Symptoms:

- Game completes but does not navigate to `SessionGameOverScreen`.
- `GameResultFacts` are not emitted.

Checks:

1. Confirm the screen export is wrapped with `withMultiplayerRuntime` or `withSoloRuntime`.
2. Confirm the game adapter entry in `src/config/gameAdapters.ts` has a `resultFactsEffect` function.
3. For solo games, confirm `isV3` is being passed through route params.
4. Check that the adapter's `resultFactsEffect` returns a non-null `GameResultFacts` when the game ends.
5. Verify the game screen's phase/state variable is one the shell is monitoring.

### Result-facts not producing expected values

Symptoms:

- `SessionGameOverScreen` shows wrong scores, missing participants, or blank data.

Checks:

1. Inspect the adapter's `resultFactsEffect` — it must build `GameResultFacts` from game state.
2. Verify `scoreboard` array has entries for each participant with correct `uid`, `displayName`, `score`.
3. Verify `outcome` is set correctly (`'win'`, `'loss'`, `'draw'`).
4. Verify `durationMs` is calculated from game start to end.

### Double navigation after game ends

Symptoms:

- App navigates twice — first to `SessionGameOverScreen`, then somewhere else.
- Two game-over screens appear in stack.

Checks:

1. Ensure the game screen's own legacy game-over handler does NOT also navigate on completion.
2. The runtime shell handles navigation — game screens should not call `navigation.navigate` on completion when V3 is active.
3. Check for stale `useGameCompletion` calls that trigger parallel navigation.

### V3 rewards not processing

Symptoms:

- `GameSessions` doc shows `resolved` status but `rewardsProcessed` is not `true`.

Checks:

1. Verify `processSessionRewards` was called — check Cloud Function logs.
2. If Watchdog Pass 4 retried and still failed, check for missing participant data or malformed session docs.
3. Verify V3 guards in `games.ts` — if `sessionId` is missing from `TurnBasedGames` doc, legacy trigger fires instead.

## 13) Invite Finalization (Server-Authoritative)

Canonical function:

- `firebase-backend/functions/src/games.ts` → `finalizeUniversalInvite(params)`

Design:

- Every completion / cancel / expire / decline path MUST call `finalizeUniversalInvite`.
- Uses a **Firestore transaction** to prevent races between concurrent resolvers.
- **Idempotent**: calling the same invite twice is safe — the second call detects the terminal status and returns `{ success: true, alreadyTerminal: true }`.

`FinalizeInviteParams`:

| Field            | Type                                                    | Description                                                                                               |
| ---------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `inviteId`       | `string`                                                | The invite doc ID                                                                                         |
| `terminalStatus` | `"completed" \| "declined" \| "expired" \| "cancelled"` | Target terminal status                                                                                    |
| `resolutionType` | `string?`                                               | How the game ended: `win`, `loss`, `draw`, `resign`, `timeout`, `disconnect`, `cancel`, `expire`, `error` |
| `winnerId`       | `string \| null?`                                       | Winner UID, or `null` for draws                                                                           |
| `winReason`      | `string \| null?`                                       | Human reason (e.g. `opponent_resigned`)                                                                   |
| `resolvedBy`     | `"server" \| "client" \| "room" \| "watchdog"`          | Who triggered finalization                                                                                |
| `traceId`        | `string?`                                               | For log correlation                                                                                       |
| `now`            | `number?`                                               | Override `Date.now()` (for tests)                                                                         |

Finalization fields written on the invite doc:

| Field                         | Type       | Purpose                                               |
| ----------------------------- | ---------- | ----------------------------------------------------- |
| `resolvedAt`                  | `number`   | Timestamp of resolution                               |
| `resolutionType`              | `string`   | How the game ended                                    |
| `resolvedBy`                  | `string`   | Attribution for debugging                             |
| `chatVisibility`              | `"hidden"` | Tells subscriptions to hide the invite                |
| `chatHiddenAt`                | `number`   | When chat-hide was applied                            |
| `chatHiddenInConversationIds` | `string[]` | Which conversations to hide in                        |
| `deleteAt`                    | `number`   | `resolvedAt + 6 hours` — TTL for deferred hard-delete |
| `completedAt`                 | `number`   | When status became terminal                           |

Self-healing behavior:

- If the invite is already terminal but missing `chatVisibility`, `deleteAt`, `resolvedAt`, or `chatHiddenInConversationIds`, they are backfilled in-place.
- If the invite doc is missing entirely, returns success (already cleaned up).

Callers:

| Caller                                 | ResolvedBy | When                             |
| -------------------------------------- | ---------- | -------------------------------- |
| `processGameCompletion`                | `server`   | TurnBasedGames status → terminal |
| `processRealtimeGameCompletion`        | `server`   | RealtimeGameSessions doc created |
| `deleteGameAndInvite` (persistence.ts) | `room`     | Colyseus room disposes           |
| `cancelUniversalInvite`                | `client`   | Host cancels in UI               |
| `completeGameInvite`                   | `client`   | Client-side completion           |
| `expireGameInvites`                    | `server`   | Scheduled expiry scan            |
| `cleanupVacantGames`                   | `server`   | Scheduled vacancy cleanup        |
| `reconcileActiveInvites`               | `watchdog` | Scheduled 15-min watchdog        |

## 14) Chat Visibility System

Problem solved:

- Game invites in chat must disappear when the match resolves.

Mechanism:

1. `finalizeUniversalInvite` sets `chatVisibility: "hidden"` and `chatHiddenInConversationIds: [conversationId]`.
2. `subscribeToConversationInvites` and `subscribeToPlayPageInvites` (in `src/services/gameInvites.ts`) filter out invites where `chatVisibility === "hidden"`.
3. `ChatGameInvites` component applies a defensive `.filter()` before rendering to exclude any invites that leak through.
4. `UniversalInviteCard` has an early-return `null` guard for terminal/hidden invites.

Subscription filter logic (Firestore query):

- Primary: `where("chatVisibility", "!=", "hidden")` — only fetches non-hidden invites.
- Render guard: client-side `.filter(inv => inv.chatVisibility !== "hidden" && !TERMINAL.has(inv.status))`.

Note: The `chatVisibility` field is deliberately **not** used in Firestore composite indexes — the terminal-status-based cleanup handles the index-heavy paths.

## 15) Game Recovery Service

Canonical files:

- `src/services/gameRecovery.ts` — AsyncStorage-backed bookmark persistence + Firestore validation
- `src/hooks/useGameRecovery.ts` — Recovery state hook with AppState listener
- `src/components/games/GameRecoveryBanner.tsx` — "Resume your match" banner

Purpose:

- After a crash, kill, or background eviction, the app detects an in-progress multiplayer game and offers a "Resume game" banner on the Games Hub screen.

Data flow:

1. **Save** — When `useColyseus` successfully joins a room and `inviteId` is provided, `saveActiveSession()` writes a small bookmark (~500B) to AsyncStorage.
2. **Update** — `colyseus.ts.setupRoomHandlers` calls `updateReconnectionToken()` whenever a reconnection token is issued.
3. **Clear** — `useColyseus.leaveRoom()` calls `clearActiveSession()` when the user intentionally leaves.
4. **Recover** — On mount + every background→foreground transition, `useGameRecovery` calls `recoverActiveSession(uid)`:
   - Reads bookmark from AsyncStorage.
   - Guards: wrong user → clear; stale (>3 h) → clear.
   - Fetches invite doc from Firestore.
   - If invite `active` → returns `RecoverableSession` with screen name.
   - If invite terminal → clears bookmark; self-heals `chatVisibility` if missing.
   - If invite non-terminal/non-active (e.g. `filling`) → keeps bookmark, returns null.
   - On network error → keeps bookmark, returns null (will retry).
5. **Resume** — `GameRecoveryBanner` shows a "Resume" button → navigates to the game screen with `fromRecovery: true` so `useGameLobby` skips cleanup.

`ActiveSessionBookmark` fields:

| Field               | Type      | Description                    |
| ------------------- | --------- | ------------------------------ |
| `inviteId`          | `string`  | Primary key for recovery       |
| `gameType`          | `string`  | Used to resolve screen name    |
| `firestoreGameId`   | `string?` | For Colyseus room reconnection |
| `reconnectionToken` | `string?` | Colyseus fast-reconnect token  |
| `conversationId`    | `string?` | For navigating back to chat    |
| `isTurnBased`       | `boolean` | Affects reconnect strategy     |
| `savedAt`           | `number`  | For staleness check            |
| `userId`            | `string`  | For multi-user guard           |

`fromRecovery` flag:

- When `useGameLobby` receives `fromRecovery: true`, it skips the unmount cancel/unclaim flow so the user can reconnect to an ongoing match without accidentally finalizing the invite.

External Colyseus game recovery (§17 verified):

- `saveActiveSession` stores the **bare invite ID** (not the `ext_` format) as `inviteId`, and the `ext_<gameType>_<inviteId>` string as `firestoreGameId`.
- `recoverActiveSession` fetches the invite doc using the bare `inviteId` — no ext\_ parsing needed on the client.
- `GAME_SCREEN_MAP` has entries for all 7 external Colyseus game types so screen resolution works.
- Terminal ext\_ invites correctly trigger bookmark clearance + chatVisibility self-heal.
- Non-active ext\_ invites (e.g. `filling`) keep the bookmark for retry.

## 16) Watchdog Reconciliation

Canonical function:

- `firebase-backend/functions/src/games.ts` → `reconcileActiveInvites`

Schedule: **every 15 minutes**

Purpose:

- Belt-and-suspenders safety net that catches invites which slipped through normal completion paths due to crashes, deploy gaps, or timing races.

Four-pass design:

### Pass 1 — Stuck `active` invites with dead game docs

- Queries invites with `status == "active"` and `updatedAt` older than 30 minutes.
- For each, checks if the referenced game doc (`TurnBasedGames` or `RealtimeGameSessions`) exists.
- If no game doc found → `finalizeUniversalInvite({ resolvedBy: "watchdog", resolutionType: "disconnect" })`.

### Pass 2 — Stuck `starting` invites

- Queries invites with `status == "starting"` and `updatedAt` older than 10 minutes.
- Finalizes as cancelled with `resolutionType: "timeout"`.

### Pass 3 — Terminal but still chat-visible

- Queries terminal invites (`completed`, `expired`, `cancelled`, `declined`) where `chatVisibility != "hidden"` using the `!=` filter.
- Calls `finalizeUniversalInvite` which self-heals the missing fields.

### Pass 4 — V3 sessions with unprocessed rewards

- Queries `GameSessions` with `status == "resolved"` and `rewardsProcessed !== true`.
- For each, retries `processSessionRewards(sessionId)`.
- Catches races where `resolveSessionV3` completed but reward processing failed transiently.
- `processSessionRewards` is idempotent — safe to retry.

Helper:

- `extractMillis(value: unknown): number` — safely converts Firestore `Timestamp` objects or plain numbers to milliseconds. Guards against the mixed-type `createdAt`/`updatedAt` fields.

## 17) External Colyseus Invite Finalization (ext\_ Parsing Fix)

Problem solved:

- External Colyseus invite games (`EXTERNAL_COLYSEUS_INVITE_GAMES`) had NO reliable path from room disposal → invite finalization.
- The `ext_<gameType>_<inviteId>` game ID was passed to `deleteGameAndInvite` but the `inviteId` was never extracted from it.
- `deleteGameAndInvite` tried to auto-discover `inviteId` from a `TurnBasedGames` doc that does **not exist** for external Colyseus games.
- Card games additionally failed because `persistGameResult` tried to update a non-existent `TurnBasedGames` doc (throwing), and `deleteGameAndInvite` was in the **same try/catch**, so it never ran.

Affected game types: `crazy_eights`, `starforge_game`, `sketch_party_game`, `crossword_puzzle`, `pong_game`, `minigolf_duels`, `battleship`

Fixes applied (7 gaps closed):

### A) `extractInviteIdFromExtGameId` helper

Canonical file: `colyseus-server/src/services/persistence.ts`

- Parses `ext_<gameType>_<inviteId>` format using **prefix-stripping** (NOT last-underscore).
- Accepts optional `gameType` parameter: when provided, strips exact `ext_<gameType>_` prefix.
- When `gameType` is omitted, tries all known external game types (longest prefix first) from `KNOWN_EXT_GAME_TYPES`.
- **Critical**: invite IDs may contain underscores (e.g. `uinv_mm2myqz0_ijltf8`), so `lastIndexOf("_")` MUST NOT be used.
- Used by `deleteGameAndInvite`, all room `onDispose` handlers.
- `processRealtimeGameCompletion` Cloud Function has equivalent inline prefix-stripping logic.

**Bug fixed (2026-02-25)**: The original implementation used `lastIndexOf("_")` which truncated underscore-containing invite IDs (e.g. `uinv_mm2myqz0_ijltf8` → `ijltf8`), causing finalization to target a nonexistent document while the real invite remained active in chat.

**Priority fix**: All room `onDispose` handlers now prefer `this.inviteId` (explicit from client join options) over `extractInviteIdFromExtGameId` parsing, as defense-in-depth.

### B) `deleteGameAndInvite` — ext\_ fallback

After the existing `TurnBasedGames` lookup (which still works for turn-based games), a new fallback parses `inviteId` from the `ext_` format when no TurnBasedGames doc provides it.

### C) `persistGameResult` — metadata + cardPlayers

- New optional `metadata` parameter: `{ inviteId?: string; firestoreGameId?: string }`.
- When writing to `RealtimeGameSessions`, includes `inviteId` and `firestoreGameId` on the doc so the `processRealtimeGameCompletion` Cloud Function can reliably find the invite.
- Falls back to `state.cardPlayers` when `state.players` is empty (card games use `cardPlayers`, not the inherited `players` MapSchema).

### D) Room `onDispose` — separated try/catch

All rooms handling external Colyseus games now:

1. Extract `inviteId` from the `ext_` format **before** the try/catch.
2. Run `persistGameResult` in its own try/catch.
3. Run `deleteGameAndInvite(firestoreGameId, inviteId)` in a **separate** try/catch — so invite cleanup always runs even if persistence throws.
4. Pass `inviteId` explicitly to both `persistGameResult` (via metadata) and `deleteGameAndInvite`.

Rooms with this pattern:

- `BattleshipRoom` — Phase 1 fix (originally reported)
- `CardGameRoom` (crazy_eights) — Phase 1 fix (originally reported)
- `PhysicsRoom` (base class for PongRoom/pong_game) — Phase 5 audit fix
- `SketchPartyRoom` (sketch_party_game) — Phase 5 audit fix
- `CrosswordRoom` (crossword_puzzle) — Phase 5 audit fix
- `MiniGolfDuelsRoom` (minigolf_duels) — Phase 5 audit fix

### E) firestoreGameId clearing

All rooms now clear `state.firestoreGameId` (or set `pseudoState.firestoreGameId = ""` for MiniGolfDuelsRoom) before calling `persistGameResult`, so the result is written to `RealtimeGameSessions` instead of trying to update a non-existent `TurnBasedGames` doc.

### F) Cloud Function fallback — ext\_ parsing

`processRealtimeGameCompletion` now tries to extract `inviteId` from `data.firestoreGameId` if it matches the `ext_` format, before falling back to the `finalizeInviteByGameId` query path.

Defense-in-depth layers for external Colyseus invite finalization (in order):

| Layer | Where                                             | Mechanism                                                                                    |
| ----- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1     | `deleteGameAndInvite` (Colyseus server)           | Parses `inviteId` from `ext_` format, marks invite completed + hidden                        |
| 2     | `processRealtimeGameCompletion` (Cloud Function)  | Reads `data.inviteId` or parses from `data.firestoreGameId`, calls `finalizeUniversalInvite` |
| 3     | `reconcileActiveInvites` (Watchdog, every 15 min) | Catches any remaining stuck active invites after 2-hour threshold                            |

## 18) Validation Commands

Run after invite/flow changes:

1. `npm run verify:registry`
2. `npm run smoke`
3. `npm run type-check`
4. `npm run lint`
5. `npm run build` (in `firebase-backend/functions`)
6. `npm run build` (in `colyseus-server`)
7. `npx jest __tests__/integration/inviteFinalization.test.ts`
8. `npx jest __tests__/services/gameRecovery.test.ts`
9. `npx jest colyseus-server/tests/services/persistence.test.ts` (from colyseus-server dir)

Known repository state (as of this update):

- registry and smoke are passing
- root `type-check` and `lint` currently fail due unrelated existing workspace issues outside invite/flow scope
- `inviteFinalization.test.ts` (51 tests), `gameRecovery.test.ts` (34 tests), and `persistence.test.ts` (28 tests) are passing
- `BattleshipRoom.test.ts` (97 tests) is passing
- Colyseus server: 15 suites, 525 tests passing
- Client-side invite/recovery: 2 suites, 85 tests passing

## 19) Phase 2 — Client-Side Chat Layer Hardening

Added: 2026-02-24

Purpose:

- Belt-and-suspenders client-side defenses that catch invites which slip through all server-side finalization layers.
- DEV-only tooling for diagnosing stuck invites during development.

### A) Leak Guard Timer (`ChatGameInvites`)

File: `src/components/chat/ChatGameInvites.tsx`

Behavior:

- A 60-second interval timer sweeps all visible invites.
- Any invite that has been `active` for more than **3 hours** (based on `createdAt`) is auto-resolved via `completeGameInvite(inviteId)`.
- Each invite is only resolved **once** per component lifetime (tracked in a `Set<string>` ref) to prevent retry storms.
- Fires a `logger.warn` for telemetry before resolving.

Design rationale:

- 3 hours is well beyond the longest expected game duration.
- This is a last-resort client-side safety net — the server-side watchdog (`reconcileActiveInvites`, §16) runs every 15 minutes with a 30-minute threshold, so the client guard only fires for invites that somehow survived the watchdog too.
- The `completeGameInvite` function is transactional and idempotent (§13), so calling it from the client is safe even if the server already finalized.

### B) Staleness Warning (`UniversalInviteCard`)

File: `src/components/games/UniversalInviteCard.tsx`

Behavior:

- When an invite has been `active` for more than **1 hour**, a visible orange warning banner appears:
  - _"⚠️ This game may have ended — it's been active for over an hour."_
- This gives users a visual signal that something may be wrong, before the 3-hour auto-resolve kicks in.

### C) DEV Force-Resolve Button (`UniversalInviteCard`)

File: `src/components/games/UniversalInviteCard.tsx`

Behavior:

- Only visible when `__DEV__` is true (React Native development mode).
- Shows a "🛠️ DEV Tools" section on `active` invite cards with:
  - **"Force Resolve Invite"** button — calls `completeGameInvite(inviteId)` immediately.
  - Invite ID displayed in monospace font for easy identification.
- Helps developers quickly clear stuck invites during testing without touching the Firebase console.

### D) Subscription Filter Hardening (`subscribeToConversationInvites`)

File: `src/services/gameInvites.ts`

Change:

- Added `"starting"` to the `validStatuses` client-side filter in `subscribeToConversationInvites`.
- Previously, invites in `starting` status (brief transition between `ready` → `active`) were filtered out, which caused a visual flicker where the card disappeared and reappeared.
- The `chatVisibility !== "hidden"` filter still applies as the primary defense.

### Defense-in-Depth Summary (all layers)

| Layer | Where                                            | Threshold | Mechanism                                       |
| ----- | ------------------------------------------------ | --------- | ----------------------------------------------- |
| 1     | Firestore query filter                           | Immediate | `chatVisibility != "hidden"` in subscription    |
| 2     | Client-side render filter                        | Immediate | `.filter()` excludes terminal + hidden invites  |
| 3     | `UniversalInviteCard` early return               | Immediate | `null` guard for terminal / hidden status       |
| 4     | Staleness warning                                | 1 hour    | Orange banner on stale active invites           |
| 5     | Leak guard timer                                 | 3 hours   | Auto-calls `completeGameInvite` once per invite |
| 6     | Server watchdog (`reconcileActiveInvites`)       | 30 min    | Server-side auto-finalization (§16)             |
| 7     | `deleteGameAndInvite` (Colyseus room onDispose)  | Immediate | Room-driven finalization (§17)                  |
| 8     | `processRealtimeGameCompletion` (Cloud Function) | Immediate | Trigger-driven finalization (§13)               |

## 20) Phase 3 + 4 — Realtime Join Stability & Watchdog Hardening

Added: 2026-02-24

### A) Join Mutex Guards (Phase 3)

Problem: Several game hooks lacked idempotency on the join path — rapid double-taps or React re-renders could fire multiple `joinRoom()` or `startMultiplayer()` calls, creating duplicate Colyseus connections and leaking rooms.

#### `usePhysicsGame` (Pong, BounceBlitz, etc.)

File: `src/hooks/usePhysicsGame.ts`

- Added `joinTriggeredRef` guard in `startMultiplayer` that blocks if already triggered.
- Resets in `stopMultiplayer` for rematch support.
- Added `createLogger` for structured logging.

#### `useCardGame` (Crazy Eights)

File: `src/hooks/useCardGame.ts`

- Added `joiningRef` guard in `joinRoom` — blocks concurrent network calls.
- Added `joinTriggeredRef` guard in `startMultiplayer` — blocks the entry point.
- Both refs reset in `cancelMultiplayer`.
- Two-tier protection: `joiningRef` guards the network call, `joinTriggeredRef` guards the caller.

#### Join guard defense-in-depth (all hooks)

| Layer | Component           | Guard                                                | Scope                      |
| ----- | ------------------- | ---------------------------------------------------- | -------------------------- |
| 1     | `useColyseus`       | `joiningRef` + `roomRef` + `terminalErrorRef` triple | All Colyseus games         |
| 2     | `useBattleshipGame` | `joinTriggeredRef` in `startMultiplayer`             | Battleship                 |
| 3     | `useTurnBasedGame`  | `joiningRef` in `joinRoom`                           | Turn-based Colyseus games  |
| 4     | `usePhysicsGame`    | `joinTriggeredRef` in `startMultiplayer`             | Physics games (Pong, etc.) |
| 5     | `useCardGame`       | `joiningRef` + `joinTriggeredRef` (two-tier)         | Card games (Crazy Eights)  |
| 6     | `useGameLobby`      | `didJoinRef` gates `onGameReady`                     | Lobby-level dedup          |

### B) Reconnection Grace Window Normalization (Phase 3)

File: `colyseus-server/src/rooms/base/CardGameRoom.ts`

Change: Reduced reconnection grace from hardcoded 300s to 60s with `RECONNECTION_TIMEOUT_CARD` env override.

Rationale: 300s (5 min) was absurdly long for card games that resolve in minutes. During that window the room stays alive, blocking finalization and keeping invite cards stuck in chat.

| Room              | Pattern                            | Grace              | Env Override                |
| ----------------- | ---------------------------------- | ------------------ | --------------------------- |
| BattleshipRoom    | `onLeave` + `await allowReconnect` | 45s                | —                           |
| TurnBasedRoom     | `onLeave` + `await allowReconnect` | 30s                | —                           |
| CardGameRoom      | `onLeave` + `await allowReconnect` | **60s** (was 300s) | `RECONNECTION_TIMEOUT_CARD` |
| SketchPartyRoom   | `onLeave` + `await allowReconnect` | 30s                | —                           |
| PhysicsRoom       | `onDrop`/`onReconnect`             | 15s                | —                           |
| ScoreRaceRoom     | `onDrop`/`onReconnect`             | 15s                | —                           |
| MiniGolfDuelsRoom | `onDrop`/`onReconnect`             | 15s                | —                           |
| BounceBlitzRoom   | `onDrop`/`onReconnect`             | 15s                | —                           |
| BrickBreakerRoom  | `onDrop`/`onReconnect`             | 15s                | —                           |

### C) Join Failure → Invite Rollback (Phase 3)

File: `src/hooks/useGameLobbyController.ts`

Change: Added auto-unclaim effect. When a terminal Colyseus join error occurs (`roomError` present, no `room` connected, user is NOT host), the effect automatically calls `unclaimInviteSlot(inviteId, uid)` to release the joiner's claimed slot. This allows the host to re-invite or the invite to be properly cleaned up.

### D) Watchdog Hardening (Phase 4)

File: `firebase-backend/functions/src/games.ts` → `reconcileActiveInvites`

Bugs fixed:

1. **Missing-timestamp silent skip**: `now - (updatedAt || createdAt || now)` produced `0` when both timestamps were missing, causing the invite to be silently skipped forever. Now treats missing timestamps as `Infinity` age (forces reconciliation) with a warning log.

2. **Pass 3 only matched `chatVisibility == "visible"`**: Firestore `==` doesn't match missing fields. Terminal invites with no `chatVisibility` field at all were never self-healed. Changed to `!= "hidden"` which catches both `"visible"` and unset values.

3. **Pass 3 no per-doc error handling**: A single doc update failure broke the entire status loop. Each doc update now has its own try/catch so failures don't block other docs.

4. **`finalizeUniversalInvite` return unchecked**: Counters were incremented even when finalization failed. Now only increments on `success: true`.

5. **No limit-hit logging**: When the query hit the pagination limit (200 active, 100 starting), there was no warning. Added limit-hit logging so you know when there's a backlog.

6. **Always log completion**: Previously logged only when counts > 0. Now always logs the summary for observability (confirms the function ran even when idle).

7. **`extractMillis` `_seconds` fallback**: Added fallback for serialized Timestamp objects (`{ _seconds, _nanoseconds }` shape) encountered in JSON-deserialized contexts.

### E) Game Recovery Hardening (Phase 4)

#### `GameRecoveryBanner` — flicker fix

File: `src/components/games/GameRecoveryBanner.tsx`

Change: Removed `checking` from the null-guard. Previously `if (!recoverableSession || checking) return null` caused the banner to disappear and reappear on every foreground transition when `checking` toggled. Now only hides when there's truly no session to recover.

#### `gameRecovery.ts` — bookmark shape validation

File: `src/services/gameRecovery.ts`

Change: `getActiveSessionBookmark()` now validates `inviteId`, `gameType`, and `savedAt` are present after JSON parse. If any are missing (corrupted/outdated bookmark from schema change), the bookmark is cleared and `null` returned instead of propagating a malformed object.

## 21) Phase 5 — Game-Exit Navigation & Invite Creation Unification

### A) "Back to Hub" Always → Play Hub Root

**Policy change:** Every "Back to Hub" / exit-game flow now navigates to the
Play tab root (`GamesHub`) regardless of how the user entered the game
(chat, Play hub, notification, recovery).

#### Files Changed

| File                                     | What Changed                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useGameBackHandler.ts`        | `navigateToOrigin` simplified — always dispatches `{ type: "playHub" }`. Chat-routing logic removed.                       |
| `src/hooks/useGameNavigation.ts`         | `exitGame` simplified — always dispatches `{ type: "playHub" }`. `goToChat()` preserved for explicit "Go to Chat" buttons. |
| `src/components/games/GameOverModal.tsx` | DEV log updated to `"[GameEnd] BACK_PRESS", { to: "playHub" }`.                                                            |

#### Why

Previously `navigateToOrigin` routed back to the DM/group chat when
`entryPoint === "chat"`, which confused users who expected the Play hub.
The separate `goToChat()` function remains available for explicit "Return to
Chat" buttons on game-over screens.

### B) Invite Creation Unification

All invite creation now goes through `sendUniversalInvite` with consistent
field population. Key changes:

#### New Helpers in `src/services/gameInvites.ts`

- **`buildDmConversationId(uid1, uid2)`** — deterministic sorted DM chat ID.
  Matches the format used by `getOrCreateChat` in `services/chat.ts`.
- **`normalizeInvitePayload(invite)`** — strips volatile fields
  (`id`, `traceId`, `createdAt`, `updatedAt`, `expiresAt`, `chatMessageId`)
  for structural comparison / testing.

#### Defensive Normalisation in `sendUniversalInvite`

- **Auto-compute DM conversationId:** If `context === "dm"` and
  `conversationId` is falsy, it's auto-derived via `buildDmConversationId`.
- **JSON avatar warning:** DEV warning if `senderAvatar` starts with `{`
  (catches the `JSON.stringify(avatarConfig)` bug).
- **DEV Invite Snapshot log:** After creation, logs a structured summary
  (`inviteId`, `gameType`, `context`, field presence booleans).

#### Call-Site Fixes

| Call Site                          | Fix                                                                   |
| ---------------------------------- | --------------------------------------------------------------------- |
| `useGameLobby.sendFriendInvite`    | Added `senderAvatar: currentUser?.photoURL`                           |
| `useGameLobby.sendGroupInvite`     | Added `senderAvatar: currentUser?.photoURL`                           |
| `MiniGolfDuels.handleSelectFriend` | Fixed `conversationId: ""` → `buildDmConversationId(uid, friendUid)`  |
| `MiniGolfDuels.handleSelectFriend` | Fixed `senderAvatar` from `JSON.stringify(avatarConfig)` → `photoURL` |
| `MiniGolfDuels.handleSelectGroup`  | Fixed `senderAvatar` from `JSON.stringify(avatarConfig)` → `photoURL` |

#### Intentional Differences Between Flows

| Field                      | Chat Flow | Play / Lobby Flow | Reason                                                        |
| -------------------------- | --------- | ----------------- | ------------------------------------------------------------- |
| `settings.isRated`         | `false`   | `true`            | Chat games are casual, lobby games are competitive            |
| `settings.colyseusRoomKey` | absent    | present           | Chat flow creates room after invite; lobby creates room first |

### C) Shared Post-Creation Lifecycle (Verified)

Both chat and play flows converge to an identical lifecycle after invite
creation:

```
sendUniversalInvite()
  → navigate to game screen with inviteId
    → useGameLobby subscribes to invite doc
      → claimInviteSlot (joiner) / startGameEarly (host)
        → invite status → "active" + gameId
          → onGameReady(gameId) → Colyseus join
            → game plays → completeGameInvite()
```

No divergences found — `claimInviteSlot`, `startGameEarly`, and
`completeGameInvite` are the same functions for both flows.

### D) Session 5 Overlay Persistence Fixes (Summary)

- `GameOverModal`: Replaced `<Modal>` with `<View>` overlay (fixed web DOM portal).
- 8 game screens: Made `isGameOver` reactive (removed hardcoded `false`).
- `useGameBackHandler`: Added `markAsLeaving()` for exit pipeline.
- 7 game screens: Removed leftover `<Portal>` wrappers.

### E) Consistency Tests

File: `__tests__/services/inviteConsistency.test.ts`

- `buildDmConversationId` — deterministic, order-independent.
- `normalizeInvitePayload` — strips volatile fields, preserves structure.
- Structural comparison: chat vs play invite payloads share the same key set.

### F) Manual Verification Checklist

- [ ] Start a game from chat → "Back to Hub" lands on GamesHub (not chat)
- [ ] Start a game from Play hub → "Back to Hub" lands on GamesHub
- [ ] Send MiniGolf DM invite → invite appears in chat (conversationId correct)
- [ ] Send MiniGolf DM invite → invite card shows avatar (not JSON string)
- [ ] Send friend invite from lobby → senderAvatar populated in Firestore doc
- [ ] DEV console shows "[Invite] Created snapshot" with all field flags

---

## §21: V3 Session-First Architecture

Added: STOP 2 + STOP 3 of the invite system overhaul.

### 21.1 Concept

Replace "invite as runtime state machine" with "session as authoritative runtime."
The invite doc (`GameInvites/{inviteId}`) becomes a lightweight delivery envelope
(chat pill + push notification) that carries a `sessionId` FK. All runtime state
lives in `GameSessions/{sessionId}`.

### 21.2 New Firestore Collection

**`GameSessions/{sessionId}`** — top-level, one doc per multiplayer game session.

Key fields:

- `gameType`, `runtimeType` (solo / turnBased / realtime), `visibility`
- `phase`: lobby → starting → active → finishing → resolved / abandoned / expired
- `hostUid`, `participants[]` (array of `SessionParticipant` objects)
- `participantUids[]` — flat UID array for Firestore security rules
- `maxParticipants`, `maxSpectators`
- `colyseusRoomId`, `firestoreGameId`, `sourceInviteId` — connections
- `conversationId`, `entrySource` — context
- `resolution` — outcome, winnerUid, scores, xpAwarded, resolvedAt
- `traceId` — end-to-end correlation

Types: `shared/sessions/types.ts`, `shared/sessions/constants.ts`

### 21.3 Feature Flags

`constants/featureFlags.ts` → `GAME_SESSIONS_V3` block:

| Flag                      | Default | Description                                             |
| ------------------------- | ------- | ------------------------------------------------------- |
| `ENABLED`                 | `true`  | Master gate for all v3 code paths                       |
| `COMPACT_CHAT_PILLS`      | `true`  | Compact session pills instead of tall invite cards      |
| `SESSION_LOBBY`           | `true`  | Route multiplayer entry through SessionLobbyScreen      |
| `DUAL_WRITE`              | `true`  | Create v2 `GameInvites` doc alongside v3 session        |
| `UNIVERSAL_GAME_OVER`     | `true`  | Use SessionGameOverScreen for all multiplayer game-over |
| `DEBUG_SESSION_LIFECYCLE` | DEV     | Verbose tracing (on by default in DEV builds)           |

All production flags are now **enabled** (`true`). The v3 session pipeline is the active production path.

### 21.4 Cloud Function Callables

File: `firebase-backend/functions/src/sessionsV3.ts`

| Callable          | Purpose                                                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSessionV3` | Host creates a session (lobby phase). Fetches profile, sets TTL.                                                                                                                                                       |
| `joinSessionV3`   | Player/spectator joins. Capacity check, idempotent re-join.                                                                                                                                                            |
| `leaveSessionV3`  | Participant leaves. Host leaving → session abandoned.                                                                                                                                                                  |
| `startSessionV3`  | Host starts game. Validates player count. Turn-based: creates `TurnBasedGames` doc + sets `firestoreGameId`. Realtime: sets `firestoreGameId = sessionId` as shared Colyseus matchmaking key. Transitions to "active". |

All callables:

- Require Firebase Auth (`context.auth`)
- Run inside `db.runTransaction()` for atomic consistency
- Maintain `participantUids[]` array for security rules
- Log structured events via `functions.logger.info()`

Re-exported via `firebase-backend/functions/src/index.ts`.

### 21.5 Firestore Security Rules

`firebase-backend/firestore.rules` — `GameSessions/{sessionId}`:

- **Read**: authenticated + (`uid in participantUids` OR legacy `playerId` owner)
- **Create**: only legacy single-player records (with `playerId` validation)
- **Update/Delete**: denied (all mutations via Cloud Functions / admin SDK)

### 21.6 Client Services

`src/services/gameSessions.ts`:

- `subscribeToSession()` — real-time listener on single session doc
- `subscribeToConversationSessions()` — query non-terminal sessions for a chat
- `createSession()`, `joinSession()`, `leaveSession()`, `startSession()` — callable wrappers

All gated behind `GAME_SESSIONS_V3.ENABLED`.

### 21.7 Screens

| Screen                  | File                                          | Purpose                                                                                     |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `SessionLobbyScreen`    | `src/screens/games/SessionLobbyScreen.tsx`    | Universal multiplayer lobby. Shows participants, host start, auto-navigates on "active".    |
| `SessionGameOverScreen` | `src/screens/games/SessionGameOverScreen.tsx` | Universal game-over screen. Subscribes to session resolution, shows results, rematch, exit. |

Both registered in `src/navigation/RootNavigator.tsx` with hidden tab bar.

### 21.8 Chat Integration

- `InvitePillRow` — compact 48px session pills in chat (max 3 visible + overflow)
- `InviteListSheet` — modal sheet for overflow sessions
- `ChatGameInvites` — conditionally renders v3 pills when flags are on

### 21.9 Hooks

- `useSessionGameOver` (`src/hooks/useSessionGameOver.ts`) — subscribes to session,
  derives `GameOverResult` (win/loss/draw/forfeit/abandoned) for current user

### 21.10 Navigation Helpers

- `navigateToSessionLobby()` in `src/utils/gameNavHelpers.ts` — deterministic
  root-level reset (GamesHub underneath, SessionLobbyScreen on top)

### 21.11 Tracing

- `src/utils/sessionTrace.ts` — `createSessionTrace()`, `SessionTracer` interface,
  `computeSessionHealth()` — mirrors inviteTrace.ts pattern for v3 sessions

## 22) Phase 6 — Realtime Alignment (v3 Session ↔ Colyseus Bridge)

Added: 2026-02-24

This phase wires the v3 GameSession lifecycle to the existing Colyseus realtime
game infrastructure. Sessions become the authoritative record that spans the
full lobby → game → game-over flow.

### 22.1 Colyseus Persistence Bridge

**File:** `colyseus-server/src/services/persistence.ts`

Three new exported functions:

| Function           | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| `linkColyseusRoom` | Writes `colyseusRoomId` to the session doc on room creation |
| `resolveV3Session` | Transitions session → "resolved" with outcome/scores/winner |
| `abandonV3Session` | Transitions session → "abandoned" (game suspended / vacant) |

All are non-fatal: if the session doc is missing or already terminal, they
log and return silently. The v2 persistence path (`persistGameResult`,
`deleteGameAndInvite`) continues to run unconditionally.

### 22.2 Base Room Integration

All four base room classes now capture `options.v3SessionId` in `onCreate`
and call the persistence bridge in `onDispose`:

| Room Class      | File                                              | Changes                                                      |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| `TurnBasedRoom` | `colyseus-server/src/rooms/base/TurnBasedRoom.ts` | +v3SessionId field, onCreate link, onDispose resolve/abandon |
| `ScoreRaceRoom` | `colyseus-server/src/rooms/base/ScoreRaceRoom.ts` | Same pattern                                                 |
| `PhysicsRoom`   | `colyseus-server/src/rooms/base/PhysicsRoom.ts`   | Same pattern                                                 |
| `CardGameRoom`  | `colyseus-server/src/rooms/base/CardGameRoom.ts`  | Same pattern                                                 |

**onCreate pattern:**

```typescript
if (options.v3SessionId) {
  this.v3SessionId = options.v3SessionId;
  linkColyseusRoom(options.v3SessionId, this.roomId);
}
```

**onDispose patterns:**

- `phase === "finished"` → `resolveV3Session(this.v3SessionId, outcome, { winnerUid, scores })`
- `phase === "playing"` (suspended) → `abandonV3Session(this.v3SessionId)`
- `phase === "waiting"/"countdown"` (pre-start) → `abandonV3Session(this.v3SessionId)`

### 22.3 Join Types Extension

- `GameSessionContext` + `GameJoinOptions` (`src/types/gameSession.ts`): added `v3SessionId?: string`
- `buildJoinOptions()` (`src/services/colyseusJoin.ts`): propagates `ctx.v3SessionId` to wire payload

### 22.4 Cloud Function Additions

**File:** `firebase-backend/functions/src/sessionsV3.ts`

| Callable             | Trigger   | Purpose                                           |
| -------------------- | --------- | ------------------------------------------------- |
| `resolveSessionV3`   | `onCall`  | Idempotent session resolution with outcome/scores |
| `watchdogSessionsV3` | Scheduled | Every 15 min: expire stale lobbies, abandon stuck |

`resolveSessionV3` is called by:

- Colyseus persistence bridge (via admin SDK — `resolveV3Session`)
- Existing game completion triggers (via callable)
- Client-side completion paths

### 22.5 Dual-Write Bridge

`createSessionV3` now accepts a `createInvite` / `dualWriteInvite` flag.
When `true`, it also creates a v2 `GameInvites` document linked via
`v3SessionId` field. The client-side `createSession()` auto-sets this when
`GAME_SESSIONS_V3.DUAL_WRITE` flag is `true`.

### 22.6 useSessionLobby Hook

**File:** `src/hooks/useSessionLobby.ts`

Encapsulates all lobby logic previously inline in SessionLobbyScreen:

- Session subscription (real-time)
- Derived state: `isHost`, `isInSession`, `isInvited`, `canJoin`, `canStart`, `lobbyFull`
- Actions: `handleStart`, `handleLeave`, `handleBack`, `handleJoin`
- Auto-join effect: fires once when `canJoin=true` (invited user auto-joins on lobby mount)
- Auto-navigation signal: `navReady` (screen name + params)
- Computed `LobbyPhase`: loading → waiting → starting → terminal → error

`navReady.params` shape:

```typescript
{
  sessionId,
  inviteId: session.sourceInviteId,
  matchId: session.colyseusRoomId,       // undefined for game-managed games
  firestoreGameId: session.firestoreGameId, // sessionId for realtime, TurnBasedGames ID for turn-based
  entryPoint: "chat" | "play",
  v3Session: sessionId,                  // always the session ID string
}
```

### 22.7 Game-Over Navigation

- `SessionLobbyScreen` now navigates to `SessionGameOverScreen` when session
  phase is "resolved" (instead of showing a generic error banner)
- `navigateToSessionGameOver()` helper in `gameNavHelpers.ts` — deterministic
  root-level reset for game screens that detect v3 session completion

## §23: V3 Game Adapter Registry

Added: 2026-02-27

### 23.1 Purpose

The game adapter registry provides a standardized contract between `SessionLobbyScreen`
and each game's transport layer. It defines how each multiplayer game connects to Colyseus.

**Canonical file:** `src/config/gameAdapters.ts`

### 23.2 Connection Modes

| Mode            | Games (9)                                                                                                   | Behaviour                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lobby-managed` | chess, checkers, tic_tac_toe, connect_four, gomoku_master, reversi_game, dot_match, crazy_eights, pong_game | `startSessionV3` creates a `TurnBasedGames` doc (turn-based) or sets `firestoreGameId=sessionId` (realtime). Lobby passes `matchId` + `firestoreGameId` to game screen. |
| `game-managed`  | battleship, sketch_party_game, starforge_game, crossword_puzzle, minigolf_duels                             | `startSessionV3` sets `firestoreGameId=sessionId`. Game screen creates/joins Colyseus room itself using `firestoreGameId` as `filterBy` matchmaking key.                |

### 23.3 Adapter Schema

```typescript
interface GameAdapter {
  gameId: ExtendedGameType;
  screenName: string; // PlayStack route name (from GAME_SCREEN_MAP)
  connectionMode: "lobby-managed" | "game-managed";
  hasAiMode: boolean; // Can bypass lobby for solo/AI play
  minRealPlayers: number;
  maxPlayers: number;
  supportsSpectators: boolean;
  isTurnBased: boolean;
}
```

### 23.4 Helpers

- `getGameAdapter(gameId)` — returns adapter or `undefined` (solo games)
- `isLobbyGame(gameId)` — `true` for multiplayer games in the registry
- `shouldUseLobby(gameId)` — `true` when a session exists for the game
- `getLobbyMaxParticipants(gameId)` — fallback to `GAME_METADATA.maxPlayers`
- `canPlaySolo(gameId)` — `true` for solo runtime or `hasAiMode: true`

### 23.5 Full Registry

| Game ID           | Screen Name           | Connection    | AI  | Min | Max | Turn-Based |
| ----------------- | --------------------- | ------------- | --- | --- | --- | ---------- |
| chess             | ChessGame             | lobby-managed | No  | 2   | 2   | Yes        |
| checkers          | CheckersGame          | lobby-managed | No  | 2   | 2   | Yes        |
| tic_tac_toe       | TicTacToeGame         | lobby-managed | No  | 2   | 2   | Yes        |
| connect_four      | FourGame              | lobby-managed | Yes | 1   | 2   | Yes        |
| gomoku_master     | GomokuGame            | lobby-managed | Yes | 1   | 2   | Yes        |
| reversi_game      | ReversiGame           | lobby-managed | Yes | 1   | 2   | Yes        |
| dot_match         | DotsGame              | lobby-managed | Yes | 1   | 2   | No         |
| crazy_eights      | CrazyEightsGame       | lobby-managed | Yes | 1   | 5   | No         |
| pong_game         | PongGame              | lobby-managed | Yes | 1   | 2   | No         |
| sketch_party_game | SketchPartyGameScreen | game-managed  | No  | 2   | 10  | No         |
| starforge_game    | StarforgeGame         | game-managed  | No  | 1   | 2   | No         |
| crossword_puzzle  | CrosswordGame         | game-managed  | No  | 1   | 1   | No         |
| minigolf_duels    | MiniGolfDuelsGame     | game-managed  | No  | 2   | 2   | No         |
| battleship        | BattleshipGame        | game-managed  | No  | 2   | 2   | No         |

## §24: V3 Lobby Bug Fixes & Game Connection Fix

Added: 2026-02-27

### 24.1 Invite Not Rendering in Chat (Bug A)

**Root cause:** `inviteToSessionV3` created a `GameInvites` doc but the v3 chat
subscribes to `GameSessions` via `subscribeToConversationSessions` which filters
on `conversationId`. Sessions created from the Play tab had no `conversationId`.

**Fix:** `inviteToSessionV3` now stamps `conversationId` on the session doc
inside the transaction if not already set.

### 24.2 Phantom Nameless Participant (Bug B)

**Root cause:** `inviteToSessionV3` added the recipient with `status: "invited"` and
`displayName: ""`. The lobby rendered ALL non-spectator participants.

**Fix:** Lobby now filters participant list to `status !== "invited" && status !== "left"`.
Player count, empty slot count, `isInSession`, and `canStart` all exclude invited stubs.

### 24.3 No Join Button (Bug B₂)

**Root cause:** `isInSession` was `true` for invited stubs → no Join button shown.

**Fix:** Added `handleJoin` (calls `joinSessionV3`), `isInvited` flag, and a
"Join Game" button in the lobby UI.

### 24.4 Auto-Join UX (Bug C)

**Root cause:** Recipient tapped invite pill → navigated to lobby → saw "Join Game"
button but had to manually press it. UX expectation: tapping the invite should join.

**Fix (belt-and-suspenders):**

1. `ChatGameInvites.handleJoin` calls `joinSession()` fire-and-forget BEFORE navigating to lobby
2. `useSessionLobby` auto-join effect fires once when `canJoin=true` on lobby mount

Both paths are idempotent (`joinSessionV3` detects already-joined participants).

### 24.5 Game Screen Not Recognizing Players (Bug D)

**Root cause:** `startSessionV3` only set `firestoreGameId` for turn-based games
(by creating a `TurnBasedGames` doc). For **all realtime/Colyseus games**, it left
`firestoreGameId` and `colyseusRoomId` undefined. Game screens received no
matchmaking key and couldn't connect players.

**Fix (two-pronged):**

1. **Cloud Function:** `startSessionV3` now sets `firestoreGameId = sessionId` for
   non-turn-based games. Both players get the same Colyseus matchmaking key via
   `filterBy(["firestoreGameId"])`.

2. **All 14 game screens:** Added `v3Session` as a fallback matchmaking key:
   - v3StartedRef screens (10): `const fId = firestoreGameId || matchId || v3Session;`
   - Inline-init screens (4): equivalent fallback in `useState` initializer or inline resolution

**Affected screens:**

| Pattern               | Screens                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| v3StartedRef fallback | Battleship, Pong, DotMatch, ConnectFour, Gomoku, Reversi, TicTacToe, Checkers, Chess, CrazyCards |
| Inline init fallback  | SketchParty, MiniGolf, Crossword, Starforge                                                      |

### 24.6 Invariants (Current)

These invariants are now enforced:

1. **Invite stubs are `status: "invited"` only** — `inviteToSessionV3` assertion
2. **Only `joinSessionV3` produces `status: "joined"`** — replaces stub with profile
3. **`isInSession` excludes invited/left** — prevents phantom participants
4. **`canStart` counts only joined players** — host needs explicit joins
5. **`inviteToSessionV3` stamps `conversationId`** — ensures chat subscription finds session
6. **`startSessionV3` always sets `firestoreGameId`** — turn-based gets `TurnBasedGames` doc ID, realtime gets `sessionId`
7. **Game screens fall back to `v3Session`** — belt-and-suspenders if `firestoreGameId` is somehow missing

## §25: Invite Lifecycle Hardening — Guaranteed Chat Disappearance

Added: 2026-02-27

### 25.1 Problem Statement

Game invites in chat must **always** disappear when the match resolves, regardless
of how it ended: win, loss, draw, resign, disconnect, room disposal, app crash,
or backend deploy gap. Several code paths had gaps that could leave invites stuck
visible in chat.

### 25.2 Bugs Fixed

| #   | Bug                                                                           | Where                     | Fix                                                                                                            |
| --- | ----------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | `reconcileActiveInvites` Pass 3 bypassed `finalizeUniversalInvite`            | `games.ts`                | Route through `finalizeUniversalInvite` for consistent field backfill (`resolvedAt`, `resolvedBy`, `deleteAt`) |
| 2   | `cleanupResolvedInvites` Pass 2 used `== "visible"`                           | `games.ts`                | Changed to `!= "hidden"` — catches both `"visible"` and missing/undefined `chatVisibility`                     |
| 3   | `resolveSessionV3` didn't finalize linked v2 invite                           | `sessionsV3.ts`           | After resolving v3 session, now reads `sourceInviteId` and writes all finalization fields on the invite doc    |
| 4   | `watchdogSessionsV3` didn't finalize linked v2 invites                        | `sessionsV3.ts`           | Both Pass 1 (expire) and Pass 2 (abandon) now call `finalizeLinkedInvite` for the session's `sourceInviteId`   |
| 5   | `resolveV3Session` (Colyseus bridge) didn't finalize invite                   | `persistence.ts`          | After resolving v3 session doc, now self-heals the linked v2 invite with all chat-hide + TTL fields            |
| 6   | `completeGameInvite` only self-healed `"completed"` status                    | `gameInvites.ts` (client) | Now self-heals ALL terminal statuses (completed, declined, expired, cancelled)                                 |
| 7   | Dead code `updateInviteStatusOnGameCompletion` / `updateInviteStatusByGameId` | `games.ts`                | Removed — these wrote incomplete fields (no `chatVisibility`, no `deleteAt`) and were never called             |

### 25.3 Client-Side Rendering Hardening

Three-layer defense that now includes `resolvedAt` as an extra safety signal:

| Layer | Component                        | Filter                                                                                                             |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1     | `subscribeToConversationInvites` | `chatVisibility !== "hidden"` AND `!resolvedAt`                                                                    |
| 2     | `ChatGameInvites.visibleInvites` | `chatVisibility !== "hidden"` AND `!TERMINAL_SET.has(status)` AND `!resolvedAt` AND `!optimisticHiddenRef.has(id)` |
| 3     | `UniversalInviteCard`            | Early-return `null` if terminal OR `chatVisibility === "hidden"` OR `resolvedAt` present                           |

**Optimistic UI removal**: `ChatGameInvites` now maintains an `optimisticHiddenRef` Set.
When the user cancels an invite or the leak guard fires, the invite ID is added to the
set immediately, causing the card to disappear before the Firestore snapshot round-trip
completes. On failure, the ID is removed from the set (rollback).

### 25.4 Defense-in-Depth Summary (All Layers)

| Layer | Where                                            | Threshold | Mechanism                                                                     |
| ----- | ------------------------------------------------ | --------- | ----------------------------------------------------------------------------- |
| 1     | Firestore query filter                           | Immediate | `chatVisibility != "hidden"` + `!resolvedAt` in subscription                  |
| 2     | Client-side render filter                        | Immediate | `.filter()` excludes terminal + hidden + resolved + optimistic-hidden invites |
| 3     | `UniversalInviteCard` early return               | Immediate | `null` guard for terminal / hidden / resolvedAt                               |
| 4     | Optimistic UI removal                            | Immediate | Local `Set<string>` hides invite before Firestore confirms                    |
| 5     | Staleness warning                                | 1 hour    | Orange banner on stale active invites                                         |
| 6     | Leak guard timer                                 | 3 hours   | Auto-calls `completeGameInvite` once per invite                               |
| 7     | `deleteGameAndInvite` (Colyseus room onDispose)  | Immediate | Room-driven finalization (§17)                                                |
| 8     | `resolveV3Session` (Colyseus bridge)             | Immediate | V3 session resolution also finalizes linked invite                            |
| 9     | `processGameCompletion` (Cloud Function)         | Immediate | Turn-based trigger-driven finalization                                        |
| 10    | `processRealtimeGameCompletion` (Cloud Function) | Immediate | Realtime trigger-driven finalization                                          |
| 11    | `resolveSessionV3` (Cloud Function)              | Immediate | V3 session callable also finalizes linked invite                              |
| 12    | Server watchdog `reconcileActiveInvites`         | 15 min    | Server-side auto-finalization via `finalizeUniversalInvite` (§16)             |
| 13    | V3 watchdog `watchdogSessionsV3`                 | 15 min    | Expires/abandons sessions AND finalizes linked invites                        |
| 14    | `cleanupResolvedInvites`                         | Daily     | Hard-deletes by TTL, self-heals `chatVisibility` (`!= "hidden"`)              |

### 25.5 Invite Finalization Contract

**`finalizeUniversalInvite`** is the canonical, server-authoritative, idempotent
invite finalization function. Every completion path MUST route through it (or
replicate its exact field writes for non-Functions callers like Colyseus rooms).

**Invariants:**

1. `status` is moved to a terminal value (one of: `completed`, `declined`, `expired`, `cancelled`)
2. `chatVisibility` is set to `"hidden"` — chat subscriptions drop it
3. `resolvedAt` is set — extra safety signal for client-side filtering
4. `deleteAt` is set to `now + 6h` — deferred hard-delete by `cleanupResolvedInvites`
5. `chatHiddenInConversationIds` is populated — for conversation-specific queries
6. Repeated calls are safe (idempotent) — already-terminal invites get missing fields self-healed
7. Missing doc → success — already cleaned up

### 25.6 Test / Validation Checklist

Manual verification steps:

- [ ] Create invite in chat → start game → end game (win) → verify invite disappears + invite doc has `chatVisibility: "hidden"` + terminal status
- [ ] Create invite → start game → resign → same verification
- [ ] Create invite → start game → force-kill app mid-game → wait 15 min → verify watchdog resolves and hides invite
- [ ] External Colyseus `ext_` id path → verify `extractInviteIdFromExtGameId` works and `deleteGameAndInvite` runs
- [ ] V3 session flow: create session from chat → play → resolve → verify `resolveSessionV3` finalized the linked invite
- [ ] Cancel invite from chat → verify optimistic UI removal (card disappears immediately)
- [ ] Inspect invite doc in Firestore after resolution → confirm all fields present: `chatVisibility`, `resolvedAt`, `resolvedBy`, `deleteAt`, `chatHiddenInConversationIds`

Automated tests:

```bash
# Client-side invite/recovery tests
npx jest __tests__/integration/inviteFinalization.test.ts
npx jest __tests__/services/gameRecovery.test.ts

# Colyseus persistence tests
cd colyseus-server && npx jest tests/services/persistence.test.ts

# Battleship room tests (Colyseus invite finalization)
cd colyseus-server && npx jest tests/rooms/BattleshipRoom.test.ts
```

## §26: V3 Runtime Shell Architecture

Added: 2026-02-27

### 26.1 Overview

Every game screen is now wrapped by a **runtime shell** HOC that owns the V3
session lifecycle (resign, back-handler, terminal detection, navigation to
`SessionGameOverScreen`). Game screens themselves only produce a
`GameResultFacts` object — they never call session-resolution or navigate to
end screens directly.

Two shells exist:

| Shell                       | HOC                                  | Hook                      | When used                                    |
| --------------------------- | ------------------------------------ | ------------------------- | -------------------------------------------- |
| **MultiplayerRuntimeShell** | `withMultiplayerRuntime(Component)`  | `useMultiplayerRuntime()` | Turn-based & realtime multiplayer (14 games) |
| **SoloRuntimeShell**        | `withSoloRuntime(Component, gameId)` | `useSoloRuntime()`        | Solo / single-player games (6 games)         |

Source files:

- `src/screens/games/MultiplayerRuntimeShell.tsx`
- `src/screens/games/SoloRuntimeShell.tsx`
- `src/types/gameResultFacts.ts`

### 26.2 GameResultFacts Type

`GameResultFacts` is the universal result envelope that every game screen must
produce when a match ends. It is JSON-serialisable and passed to
`SessionGameOverScreen` via route params.

```ts
interface GameResultFacts {
  gameType: ExtendedGameType;
  outcome: "win" | "loss" | "draw" | "timeout" | "abandoned";
  scoreboard: ScoreboardEntry[];
  durationMs: number;
  performanceMetrics?: PerformanceMetric[];
}
```

Helpers in `src/types/gameResultFacts.ts`:

- `getMyScoreboardEntry(facts, uid)` — find current user's entry
- `getWinnerEntry(facts)` — find the top scorer
- `buildSoloScoreboard(uid, displayName, score)` — convenience for solo games

### 26.3 Multiplayer Shell Behaviour

`withMultiplayerRuntime` wraps any multiplayer game screen component:

```tsx
export default withMultiplayerRuntime(ChessGameScreen);
```

When the route contains `v3Session`, the shell activates. It provides:

1. **Resign FAB** — floating button that calls `resignSessionV3` Cloud Function.
2. **Back-handler** — Android hardware back shows resign confirmation instead of
   popping the screen.
3. **Terminal detection** — watches Firestore session doc for `phase === "resolved"`.
   When detected, navigates to `SessionGameOverScreen` with `resultFacts` JSON.
4. **`useMultiplayerRuntime()` hook** — exposes `{ isV3, sessionId }` to the
   wrapped component.

When `v3Session` is absent (legacy invite flow), the shell is inert — all hooks
return defaults and no FAB renders.

### 26.4 Solo Shell Behaviour

`withSoloRuntime` wraps solo game screens and always activates (no `v3Session`
gating):

```tsx
export default withSoloRuntime(MinesweeperGameScreen, "minesweeper_classic");
```

It provides:

- `useSoloRuntime()` hook returning `{ onGameComplete }`.
- `onGameComplete(facts, options?)` — submits result facts. When
  `options.navigateToGameOver !== false`, navigates to `SessionGameOverScreen`
  with the encoded `resultFacts` and `isSolo = true`.

### 26.5 Game Screen Migration Pattern

Every game screen follows this pattern after migration:

1. **Import the shell HOC + hook:**

   ```tsx
   import {
     useMultiplayerRuntime,
     withMultiplayerRuntime,
   } from "@/screens/games/MultiplayerRuntimeShell";
   ```

2. **Derive `isV3`** from `route.params.v3Session`:

   ```tsx
   const isV3 = !!route?.params?.v3Session;
   ```

3. **Add a result-facts `useEffect`** that fires when the game reaches a
   terminal state (checkmate, timer expiry, score-race end, etc.):

   ```tsx
   useEffect(() => {
     if (!isV3 || phase !== "finished") return;
     const facts: GameResultFacts = {
       gameType,
       outcome,
       scoreboard,
       durationMs,
     };
     navigation.setParams({ resultFacts: JSON.stringify(facts) });
   }, [isV3, phase]);
   ```

4. **Gate legacy game-over UI** behind `!isV3`:

   ```tsx
   {!isV3 && <TurnBasedGameOverOverlay ... />}
   ```

5. **Change the default export** to the wrapped component:
   ```tsx
   export default withMultiplayerRuntime(ChessGameScreen);
   // or
   export default withSoloRuntime(Play2048GameScreen, "play_2048");
   ```

### 26.6 Game Adapter Registry

`src/config/gameAdapters.ts` maps every multiplayer game to its V3 connection
metadata (Colyseus room name, connection mode, lobby config). Solo games are not
in the registry — they use `SoloRuntimeShell` directly.

Key adapter fields:

| Field                    | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `gameType`               | `ExtendedGameType` identifier                |
| `colyseusRoom`           | Colyseus room class name                     |
| `connectionMode`         | `"colyseus"`, `"firestore"`, or `"hybrid"`   |
| `getPerformanceMetrics?` | Optional extractor for game-specific metrics |

### 26.7 Migration Status (All 20 Games)

| #   | Game          | Shell                    | Status                                           |
| --- | ------------- | ------------------------ | ------------------------------------------------ |
| 1   | TicTacToe     | `withMultiplayerRuntime` | Migrated                                         |
| 2   | Pong          | `withMultiplayerRuntime` | Migrated                                         |
| 3   | Play2048      | `withSoloRuntime`        | Migrated                                         |
| 4   | Chess         | `withMultiplayerRuntime` | Migrated                                         |
| 5   | Checkers      | `withMultiplayerRuntime` | Migrated                                         |
| 6   | ConnectFour   | `withMultiplayerRuntime` | Migrated                                         |
| 7   | GomokuMaster  | `withMultiplayerRuntime` | Migrated                                         |
| 8   | Reversi       | `withMultiplayerRuntime` | Migrated                                         |
| 9   | DotMatch      | `withMultiplayerRuntime` | Migrated                                         |
| 10  | SketchParty   | `withMultiplayerRuntime` | Migrated                                         |
| 11  | Crossword     | `withMultiplayerRuntime` | Migrated                                         |
| 12  | MiniGolfDuels | `withMultiplayerRuntime` | Migrated                                         |
| 13  | Battleship    | `withMultiplayerRuntime` | Migrated                                         |
| 14  | Starforge     | `withMultiplayerRuntime` | Migrated (WebView — result-facts via bridge TBD) |
| 15  | BounceBlitz   | `withSoloRuntime`        | Migrated                                         |
| 16  | BrickBreaker  | `withSoloRuntime`        | Migrated                                         |
| 17  | WordMaster    | `withSoloRuntime`        | Migrated                                         |
| 18  | Minesweeper   | `withSoloRuntime`        | Migrated                                         |
| 19  | LightsOut     | `withSoloRuntime`        | Migrated                                         |
| 20  | CrazyEights   | —                        | No game screen file exists                       |

### 26.8 Backend Reward Pipeline

When a V3 session resolves:

1. `resolveSessionV3` Cloud Function writes `resolution` + sets `phase = "resolved"`.
2. `processSessionRewards()` runs post-transaction — awards XP, updates stats,
   triggers achievements.
3. Watchdog Pass 4 retries `processSessionRewards` for any resolved session
   where `rewardsProcessed !== true`.
4. Client-side shells detect `phase === "resolved"` and navigate to
   `SessionGameOverScreen` with the result facts.

Guards in `firebase-backend/functions/src/games.ts` prevent double-counting:
`processGameCompletion` and `processRealtimeGameCompletion` skip execution when
`sessionId` is present (V3 uses `processSessionRewards` instead).

### 26.9 STOP 5 Cleanup Summary

Dead-code stubs removed from 13 game screens:

- `__codexGameCompletion` (voided `useGameCompletion` calls) — 8 files
- `__codexGameHaptics` (voided `useGameHaptics` calls) — 11 files
- `__codexGameOverModal` (permanently-hidden `<GameOverModal visible={false}/>`) — 9 files

Orphaned imports removed: 32 total (`useGameCompletion` × 8, `useGameHaptics` × 11, `GameOverModal` × 8, plus LightsOut `GameOverModal`).

`isV3` placeholder wiring completed for 3 solo games:

- `WordMasterGameScreen` — added `route` prop, derives `isV3` from `route.params.v3Session`
- `MinesweeperGameScreen` — same
- `LightsOutGameScreen` — same
- Navigation types updated: `PlayStackParamList` entries changed from `OptionalRouteParams` to `V3GameScreenParams | undefined`

## §27: End-to-End Hardening Audit

Added: 2026-03-01

A comprehensive 6-stop audit of the game invite/session system identified 78
findings across the entire stack (client → Cloud Functions → Colyseus server →
Firestore rules). The top 10 critical and high-severity findings were
implemented immediately. This section documents every change made.

### 27.1 Audit Methodology

The audit was structured as 6 sequential STOPs, each covering a different
subsystem:

| STOP | Focus                     | Findings |
| ---- | ------------------------- | -------- |
| 0    | E2E checklist & trace map | 10       |
| 1    | Static types & invariants | 12       |
| 2    | Navigation & resume       | 15       |
| 3    | Realtime cards & push     | 17       |
| 4    | Resolution & deletion     | 14       |
| 5    | Integration & regression  | 20       |
|      | **Total**                 | **78**   |

Severity distribution: 7 CRITICAL, 13 HIGH, 29 MODERATE, 17 LOW, 22 INFO.

The 10 fixes below address all 7 CRITICALs and 3 of the highest-risk HIGHs.

### 27.2 Fix 1 — Colyseus `resolveV3Session` Transaction (D4-1 + D4-7) — CRITICAL

**Problem (D4-1):** `resolveV3Session` in the Colyseus persistence bridge used a
plain read-then-write (`.get()` → `.update()`). Two rooms disposing simultaneously
for the same session could both read `phase: "active"`, both write
`phase: "resolved"`, and produce inconsistent participant data.

**Problem (D4-7):** After writing `phase: "resolved"` directly, the bridge called
the `resolveSessionV3` Cloud Function via HTTP POST. The CF saw
`alreadyTerminal: true` and **skipped reward processing entirely**. Rewards only
got processed by the 15-minute watchdog (Pass 4), delaying XP/achievements by
up to 15 minutes for every game.

**File:** `colyseus-server/src/services/persistence.ts` — `resolveV3Session()`

**Fix (D4-1):** Wrapped the entire read → update in `db.runTransaction()`. The
transaction holds a read lock on the session doc, preventing concurrent resolvers
from both seeing `phase: "active"`. The function returns a `txResult` object with
`{ written: boolean; sourceInviteId?: string }` so post-transaction invite
finalization can use the `sourceInviteId` without re-reading.

**Fix (D4-7):** Changed the reward guard in `resolveSessionV3` Cloud Function
from `if (!result.alreadyCleaned && !result.alreadyTerminal)` to
`if (!result.alreadyCleaned)`. Now rewards are processed even when the session
was already terminal (Colyseus wrote it first), because `processSessionRewards`
has its own atomic idempotency guard via the `rewardsProcessed` flag.

**Files changed:**

| File                                                   | Change                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| `colyseus-server/src/services/persistence.ts`          | `resolveV3Session` body wrapped in `db.runTransaction()`       |
| `firebase-backend/functions/src/sessionsV3.ts` (L1596) | Removed `!result.alreadyTerminal` from reward processing guard |

**Before:**

```typescript
// persistence.ts — TOCTOU race
const snap = await ref.get();
// ...reads session...
await ref.update({ phase: "resolved", ... });

// sessionsV3.ts — rewards skipped when already terminal
if (!result.alreadyCleaned && !result.alreadyTerminal) {
  await processSessionRewards(...);
}
```

**After:**

```typescript
// persistence.ts — atomic transaction
const txResult = await db.runTransaction(async (tx) => {
  const snap = await tx.get(ref);
  // ...reads session inside transaction...
  tx.update(ref, { phase: "resolved", ... });
  return { written: true, sourceInviteId: session.sourceInviteId };
});

// sessionsV3.ts — rewards always processed (idempotent via rewardsProcessed flag)
if (!result.alreadyCleaned) {
  await processSessionRewards(...);
}
```

**Impact:** Eliminates the race condition that could corrupt session state and
ensures rewards are processed within seconds instead of up to 15 minutes.

### 27.3 Fix 2 — `resolveSessionV3` Input Validation (D4-2) — CRITICAL

**Problem:** The `resolveSessionV3` Cloud Function accepted unauthenticated
calls (auth is optional for server-side triggers) but performed zero validation
on `winnerUid` and `scores`. A malicious caller could:

- Set `winnerUid` to a non-participant UID → awards to wrong user
- Add score entries for non-participant UIDs → inflates stats
- Pass arbitrary UIDs to manipulate leaderboards

**File:** `firebase-backend/functions/src/sessionsV3.ts` — `resolveSessionV3`

**Fix:** Added two validation blocks inside the transaction, after the
participant check but before writing resolution data:

1. **winnerUid validation**: If `winnerUid` is provided, verifies it belongs to
   an active participant (not `status: "left"`). Throws `invalid-argument` if not.

2. **scores validation**: If `scores` is provided, verifies all score UIDs
   belong to session participants. Throws `invalid-argument` for unknown UIDs.

```typescript
// D4-2 fix: Validate winnerUid is actually a participant
if (winnerUid) {
  const winnerIsParticipant = session.participants.some(
    (p) => p.uid === winnerUid && p.status !== "left",
  );
  if (!winnerIsParticipant) {
    throw new HttpsError(
      "invalid-argument",
      `winnerUid "${winnerUid}" is not an active participant`,
    );
  }
}

// D4-2 fix: Validate score UIDs are all participants
if (scores) {
  const participantUids = new Set(session.participants.map((p) => p.uid));
  for (const scoreUid of Object.keys(scores)) {
    if (!participantUids.has(scoreUid)) {
      throw new HttpsError(
        "invalid-argument",
        `Score UID "${scoreUid}" is not a session participant`,
      );
    }
  }
}
```

**Impact:** Prevents reward manipulation and leaderboard pollution from
unauthenticated or malformed resolution calls.

### 27.4 Fix 3 — Recovery Bookmark Cleanup + `exitGameSession` (N2-1, N2-2, D4-8) — HIGH

**Problem (N2-1 + N2-2):** When `MultiplayerRuntimeShell` and
`SessionRuntimeShell` detected a terminal phase (resolved/abandoned/expired),
they navigated to `SessionGameOverScreen` or `GamesHub` but never called
`clearActiveSession()`. The AsyncStorage bookmark remained, causing the
`GameRecoveryBanner` to show "Resume your match" for a game that had already
ended.

**Problem (D4-8):** `SessionGameOverScreen.handleExit()` used raw
`navigation.popToTop()` / `navigation.navigate("GamesHub")` instead of the
canonical `exitGameSession()` helper, which meant it bypassed the
`clearActiveSession()` call and double-tap guard.

**Problem (resign race in SessionRuntimeShell):** Unlike `MultiplayerRuntimeShell`
which set `navigatedRef.current = true` BEFORE the async resign call,
`SessionRuntimeShell` set it AFTER. This allowed a concurrent Firestore snapshot
to trigger a second navigation during the async gap.

**Files changed:**

| File                                            | Change                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `src/screens/games/MultiplayerRuntimeShell.tsx` | Added `clearActiveSession()` in both terminal-detection `useEffect` paths |
| `src/screens/games/SessionRuntimeShell.tsx`     | Added `clearActiveSession()` in both terminal-detection `useEffect` paths |
| `src/screens/games/SessionRuntimeShell.tsx`     | Moved `navigatedRef.current = true` BEFORE the async resign call          |
| `src/screens/games/SessionGameOverScreen.tsx`   | `handleExit` now calls `exitGameSession({ type: "playHub" })`             |

**Import changes:**

- `MultiplayerRuntimeShell`: Added `clearActiveSession` import from `@/services/gameRecovery`
- `SessionRuntimeShell`: Added `clearActiveSession` import from `@/services/gameRecovery`
- `SessionGameOverScreen`: Added `exitGameSession` import from `@/utils/gameNavHelpers`

**Impact:** Recovery banner no longer appears for ended games. Game-over exit
properly clears all state. Resign flow in `SessionRuntimeShell` no longer races
with snapshot navigation.

### 27.5 Fix 4 — DM Push Tap Field Mismatch (R3-3) — CRITICAL

**Problem:** The server-side DM push notification (`legacy.ts` → `onNewMessage`)
sends `data.senderId` in the push payload. The client-side tap handler
(`AuthContext.tsx`) checked for `data.friendUid`, which never matched. Tapping a
DM push notification did nothing.

**File:** `src/store/AuthContext.tsx` — notification response listener

**Fix:** Changed `typeof data.friendUid === "string"` to
`typeof data.senderId === "string"` and `friendUid: data.friendUid` to
`friendUid: data.senderId`.

**Before:**

```tsx
if (data?.type === "message" && typeof data.friendUid === "string") {
  globalNavigate("ChatDetail", { friendUid: data.friendUid, ... });
}
```

**After:**

```tsx
if (data?.type === "message" && typeof data.senderId === "string") {
  // R3-3 fix: server sends senderId
  globalNavigate("ChatDetail", { friendUid: data.senderId, ... });
}
```

**Impact:** DM push notification taps now correctly navigate to the chat.

### 27.6 Fix 5 — `game_start` Push Tap Handler (R3-2) — CRITICAL

**Problem:** The server sends a `game_start` push notification when a session
transitions to active, but the client-side tap handler in `AuthContext.tsx` had
no case for `data.type === "game_start"`. Tapping the notification did nothing.

**File:** `src/store/AuthContext.tsx` — notification response listener

**Fix:** Added a new `else if` branch that handles `game_start` notifications
and navigates to `SessionLobbyScreen` with the session ID:

```tsx
} else if (data?.type === "game_start" && typeof data.sessionId === "string") {
  // R3-2 fix: Navigate to the session lobby when a game starts
  globalNavigate("MainTabs", {
    screen: "Play",
    params: {
      screen: "SessionLobbyScreen",
      params: { sessionId: data.sessionId, source: "push" },
    },
  });
}
```

**Impact:** Users can tap into an active game session directly from the push
notification.

### 27.7 Fix 6 — Double Notification Prevention (R3-4) — HIGH

**Problem:** `Notifications.setNotificationHandler` was configured with
`shouldShowAlert: true` and `shouldShowBanner: true`. When the app was in the
foreground, **both** the OS system banner and the in-app notification handler
fired — the user saw the same notification twice.

**File:** `src/services/notifications.ts`

**Fix:** Set `shouldShowAlert: false` and `shouldShowBanner: false`. The OS
notification system no longer shows alerts/banners when the app is in the
foreground. The in-app notification handler (subscription listener in
`AuthContext.tsx`) still receives and processes all notifications for in-app UI.
`shouldPlaySound` and `shouldSetBadge` remain `true` for passive cues.
`shouldShowList` remains `true` so notifications still appear in the notification
center.

```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // R3-4: prevent OS banner in foreground
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: false, // R3-4: same
    shouldShowList: true,
  }),
});
```

**Impact:** Eliminates duplicate notifications when the app is in the foreground.

### 27.8 Fix 7 — Theme-Aware Resign Dialog (I5-1) — CRITICAL

**Problem:** The resign confirmation dialogs in both `MultiplayerRuntimeShell`
and `SessionRuntimeShell` used hardcoded dark theme colors:

- `backgroundColor: "#1e1e2e"` (dialog box)
- `color: "#e74c3c"` (flag icon, resign button)
- `color: "#fff"` (all text)
- `backgroundColor: "rgba(255, 255, 255, 0.1)"` (cancel button)

In light mode, the dark dialog box was jarring and unreadable. In any non-default
theme, the colors clashed with the theme palette.

**Files changed:**

| File                                            | Change                                                |
| ----------------------------------------------- | ----------------------------------------------------- |
| `src/screens/games/MultiplayerRuntimeShell.tsx` | Added `useTheme()` hook, replaced 8 hardcoded colours |
| `src/screens/games/SessionRuntimeShell.tsx`     | Added `useTheme()` hook, replaced 8 hardcoded colours |

**Token mapping:**

| Hardcoded Value                  | Replaced With                   | Purpose              |
| -------------------------------- | ------------------------------- | -------------------- |
| `#1e1e2e`                        | `theme.colors.surface`          | Dialog background    |
| `#e74c3c` (icon + button)        | `theme.colors.error`            | Resign accent        |
| `#fff` (title text)              | `theme.colors.onSurface`        | Title + cancel text  |
| `rgba(255,255,255,0.7)` (body)   | `theme.colors.onSurfaceVariant` | Body/subtext         |
| `#fff` (resign button text)      | `theme.colors.onError`          | Resign button label  |
| `rgba(255,255,255,0.1)` (bg)     | `theme.colors.surfaceVariant`   | Cancel button bg     |
| `rgba(255,255,255,0.2)` (border) | `theme.colors.outline`          | Cancel button border |

**Implementation:** The static `StyleSheet.create` styles remain for layout
properties. Colour overrides are applied as inline `style={[ styles.x, { color: theme.colors.y } ]}`
array merges, keeping the performance benefit of static stylesheets while
allowing theme-awareness.

**Impact:** Resign dialog now adapts correctly to all 15 supported themes
including light mode.

### 27.9 Fix 8 — Invite Update in `startSessionV3` (R3-1) — CRITICAL

**Problem:** When `startSessionV3` transitioned a session from `lobby` to `active`,
it never updated the linked `GameInvites` doc. The invite card in chat remained
in its old status (e.g. `pending` or `ready`) while the game was already
actively in play. Users saw stale invite pills that didn't reflect the current
game state.

**File:** `firebase-backend/functions/src/sessionsV3.ts` — `startSessionV3`

**Fix:** After the transaction succeeds, if `result.sourceInviteId` is present,
update the linked invite doc with `status: "active"` and `gameId` (so the invite
card can render a "Join Game" state). The transaction return value was extended
to include `sourceInviteId` from the session read.

```typescript
// Inside transaction return:
return {
  success: true,
  ...(updates.firestoreGameId
    ? { firestoreGameId: updates.firestoreGameId }
    : {}),
  sourceInviteId: session.sourceInviteId,
};

// After transaction:
if (result.sourceInviteId) {
  await db
    .collection("GameInvites")
    .doc(result.sourceInviteId)
    .update({
      status: "active",
      ...(result.firestoreGameId ? { gameId: result.firestoreGameId } : {}),
      updatedAt: Date.now(),
    });
}
```

The update runs outside the transaction (idempotent, non-fatal). If it fails,
a warning is logged and the game continues — the invite is a display hint, not a
critical state machine.

**Impact:** Invite cards in chat now immediately reflect "active" game status.

### 27.10 Fix 9 — Watchdog Pass 5 Invite Finalization (D4-5) — HIGH

**Problem:** Watchdog Pass 5 catches sessions stuck in `"starting"` phase for
more than 10 minutes (e.g., Colyseus room creation timed out) and transitions
them to `"abandoned"`. However, it did NOT call `finalizeLinkedInvite` — the
linked `GameInvites` doc remained in a non-terminal status, keeping the invite
card visibly stuck in chat.

**File:** `firebase-backend/functions/src/sessionsV3.ts` — `watchdogSessionsV3`
Pass 5

**Fix:** After updating the session to `"abandoned"`, cast the doc data to
`GameSessionV3` and call `finalizeLinkedInvite(sessionData, "cancelled", "error", "watchdog")`.

```typescript
// After phase update:
const sessionData = doc.data() as GameSessionV3;
await finalizeLinkedInvite(sessionData, "cancelled", "error", "watchdog");
```

**Impact:** Stuck "starting" sessions now properly clean up both the session doc
AND the linked invite, ensuring the chat pill disappears.

### 27.11 Fix 10 — `cleanupOldV3Sessions` Scheduled Function (D4-4) — HIGH

**Problem:** `GameSessions` documents were never hard-deleted after reaching a
terminal phase. Over time, the collection grows unbounded — every completed,
abandoned, or expired game session accumulates forever. This increases Firestore
storage costs and degrades query performance for collection-level queries
(watchdog passes, admin analytics).

**File:** `firebase-backend/functions/src/sessionsV3.ts` — new export

**Fix:** Added a new scheduled Cloud Function `cleanupOldV3Sessions`:

- **Schedule:** Runs daily at 03:00 UTC (low-traffic window)
- **Retention:** Deletes terminal sessions older than **90 days**
- **Terminal phases:** Iterates over `TERMINAL_PHASES` set → `"resolved"`, `"abandoned"`, `"expired"`
- **Pagination:** Processes up to 200 docs per batch using `db.batch()` deletes
- **Continues across phases:** Each terminal phase is processed independently
- **Structured logging:** Logs total `deletedCount` on completion and error

```typescript
export const cleanupOldV3Sessions = functions.pubsub
  .schedule("every day 03:00")
  .timeZone("UTC")
  .onRun(async () => {
    const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
    const cutoff = Date.now() - RETENTION_MS;
    const BATCH_SIZE = 200;
    let deletedCount = 0;

    for (const phase of TERMINAL_PHASES) {
      // Paginated batch-delete loop per terminal phase ...
    }

    functions.logger.info("cleanupOldV3Sessions.DONE", { deletedCount });
  });
```

**Deployment note:** This function must be exported from
`firebase-backend/functions/src/index.ts` and deployed via `firebase deploy --only functions:cleanupOldV3Sessions`.

**Impact:** GameSessions collection remains bounded. Historical data is preserved
for 90 days for analytics/debugging, then automatically purged.

### 27.12 Complete Change Manifest

Summary of all files modified during the audit implementation:

| File                                            | Fixes Applied  | Changes                                                                                     |
| ----------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `colyseus-server/src/services/persistence.ts`   | Fix 1          | `resolveV3Session` wrapped in `db.runTransaction()`                                         |
| `firebase-backend/functions/src/sessionsV3.ts`  | Fix 1,2,8,9,10 | Reward guard, winnerUid/scores validation, invite update, Pass 5 finalize, cleanup function |
| `src/store/AuthContext.tsx`                     | Fix 4, 5       | `senderId` field fix, `game_start` tap handler                                              |
| `src/services/notifications.ts`                 | Fix 6          | `shouldShowAlert: false`, `shouldShowBanner: false`                                         |
| `src/screens/games/MultiplayerRuntimeShell.tsx` | Fix 3, 7       | `clearActiveSession()` on terminal, `useTheme()` for resign dialog                          |
| `src/screens/games/SessionRuntimeShell.tsx`     | Fix 3, 7       | `clearActiveSession()` on terminal, resign race fix, `useTheme()`                           |
| `src/screens/games/SessionGameOverScreen.tsx`   | Fix 3          | `handleExit` → `exitGameSession()`                                                          |

### 27.13 Updated Scheduled Functions Reference

| Function                 | Schedule        | Purpose                                                     |
| ------------------------ | --------------- | ----------------------------------------------------------- |
| `reconcileActiveInvites` | Every 15 min    | Self-heals stuck invites (4 passes) — see §16               |
| `watchdogSessionsV3`     | Every 15 min    | Expires/abandons/retries V3 sessions (5 passes)             |
| `cleanupOldV3Sessions`   | Daily 03:00 UTC | Hard-deletes terminal sessions > 90 days — **NEW (Fix 10)** |
| `expireGameInvites`      | Every 15 min    | Expires stale non-terminal invites                          |
| `cleanupResolvedInvites` | Daily           | Hard-deletes terminal invites past `deleteAt` TTL           |
| `cleanupVacantGames`     | Daily           | Removes orphaned game docs                                  |

### 27.14 Updated V3 Session Lifecycle Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    V3 SESSION LIFECYCLE                  │
                    └─────────────────────────────────────────────────────────┘

  createSessionV3 ──► lobby ──► startSessionV3 ──► active ──► resolveSessionV3 ──► resolved
                       │  ▲                          │                               │
                       │  │ joinSessionV3             │                               │
                       │  │ leaveSessionV3            │                               ▼
                       │  └──────────────────┘        │                          processSessionRewards
                       │                              │                       (idempotent, atomic flag)
                       │                              │                               │
                       │  watchdog Pass 1             │  watchdog Pass 2              │  watchdog Pass 4
                       ▼  (>30min stale lobby)        ▼  (>2hr active)               ▼  (retry unprocessed)
                    expired                       abandoned
                       │                              │
                       │  watchdog Pass 5             │
                       │  (>10min stuck starting)     │
                       │           │                  │
                       │           ▼                  │
                       │       abandoned              │
                       │                              │
                       └──────────┬───────────────────┘
                                  │
                                  ▼
                         cleanupOldV3Sessions  ◄── NEW (Fix 10)
                         (daily, >90 days terminal → hard delete)
```

### 27.15 Updated Reward Flow Diagram

```
  Game ends in Colyseus room
      │
      ▼
  resolveV3Session()  ◄── NOW TRANSACTIONAL (Fix 1)
  [persistence.ts]
      │
      ├── Writes phase:"resolved" atomically via db.runTransaction()
      │   (prevents TOCTOU race — Fix 1)
      │
      ├── HTTP POST → resolveSessionV3 Cloud Function
      │
      └── Finalizes linked v2 invite (belt-and-suspenders)

  resolveSessionV3() receives HTTP call
      │
      ├── Transaction: reads session → already terminal? → idempotent success
      │   ├── Validates winnerUid is participant  ◄── NEW (Fix 2)
      │   └── Validates score UIDs are participants  ◄── NEW (Fix 2)
      │
      ├── Finalizes linked v2 invite
      │
      └── processSessionRewards()  ◄── NOW RUNS EVEN WHEN alreadyTerminal (Fix 1)
          │
          ├── Atomic idempotency: reads rewardsProcessed flag inside transaction
          ├── Claims slot: sets rewardsProcessed = true
          ├── Awards XP per participant
          ├── Updates per-game stats
          ├── Evaluates achievements
          └── Writes GameHistory entries

  Watchdog Pass 4 (every 15 min)
      │
      └── Retries processSessionRewards for any resolved session
          where rewardsProcessed !== true (safety net)
```

### 27.16 Updated Push Notification Tap Handler

Current tap handler routing in `AuthContext.tsx`:

| `data.type`      | Condition                            | Navigation Target                            | Fix   |
| ---------------- | ------------------------------------ | -------------------------------------------- | ----- |
| `message`        | `typeof data.senderId === "string"`  | `ChatDetail` with `friendUid: data.senderId` | Fix 4 |
| `group_message`  | `typeof data.groupId === "string"`   | `GroupChat` with `groupId`                   | —     |
| `friend_request` | —                                    | `Connections`                                | —     |
| `game_invite`    | `data.gameType` present              | `MainTabs > Play > GamesHub`                 | —     |
| `game_start`     | `typeof data.sessionId === "string"` | `MainTabs > Play > SessionLobbyScreen`       | Fix 5 |

### 27.17 Updated Foreground Notification Behaviour

| Property           | Value   | Effect                                           |
| ------------------ | ------- | ------------------------------------------------ |
| `shouldShowAlert`  | `false` | No OS alert popup in foreground (was `true`)     |
| `shouldPlaySound`  | `true`  | Sound plays for passive awareness                |
| `shouldSetBadge`   | `true`  | Badge count updates                              |
| `shouldShowBanner` | `false` | No OS banner in foreground (was `true`)          |
| `shouldShowList`   | `true`  | Notification appears in notification center/tray |

In-app notification handling (subscriptions in `AuthContext.tsx`) is unaffected —
it continues to receive all notifications regardless of these OS-level settings.

### 27.18 Remaining Audit Findings (Not Yet Implemented)

The following findings from the audit are documented but not yet implemented.
They are prioritized for future work:

**MODERATE (29 findings):**

- Client-server `SessionResolution` type mismatch (3 fields missing server-side)
- `RealtimeGameSessions` Firestore rules too permissive (`allow read, write: if isAuth()`)
- `GAME_SESSIONS_V3.ENABLED` toggle-off strands active sessions (no migration path)
- No turn-change or game-over push notifications
- Colyseus `docker-compose.yml` missing `LOG_LEVEL` environment variable
- Hardcoded 6-hour `deleteAt` TTL not configurable
- `processSessionRewards` sets `rewardsProcessed: true` BEFORE processing (partial failure not retried on second call)
- Missing `ExpoPushMessage._collapseId` type field
- Console.log in `DMMessageItem.tsx` fires on every render in production
- Various type-safety improvements in shared session types

**LOW (17 findings):**

- Missing loading spinner for "Loading results…" on `SessionGameOverScreen`
- No exit animation on resign dialog dismiss
- `v3SessionId` optional field on `TurnBasedGames` type not documented
- Various minor UI inconsistencies across themes

**INFO (22 findings):**

- Dead code candidates
- Documentation gaps
- Test coverage suggestions
- Observability improvements

### 27.19 Testing Checklist

Manual verification for all 10 fixes:

- [ ] **Fix 1:** Resolve two Colyseus rooms simultaneously for same session → only one set of rewards processed
- [ ] **Fix 2:** Call `resolveSessionV3` with fake `winnerUid` → get `invalid-argument` error
- [ ] **Fix 3:** Complete a game → verify `GameRecoveryBanner` does NOT show "Resume your match"
- [ ] **Fix 3:** On game-over screen, press "Back to Hub" → verify no stale bookmark in AsyncStorage
- [ ] **Fix 4:** Receive a DM push notification → tap → navigate to correct chat
- [ ] **Fix 5:** Receive a `game_start` push notification → tap → navigate to session lobby
- [ ] **Fix 6:** Receive a notification while app is in foreground → see only ONE notification (in-app)
- [ ] **Fix 7:** Show resign dialog in light theme → verify all text is readable
- [ ] **Fix 7:** Show resign dialog in Nord theme → verify colours match theme palette
- [ ] **Fix 8:** Start a session from chat → verify invite card shows "active" status immediately
- [ ] **Fix 9:** Let a session get stuck in "starting" for >10 min → verify watchdog abandons it AND hides the invite
- [ ] **Fix 10:** After deployment, verify `cleanupOldV3Sessions` runs at 03:00 UTC and logs `deletedCount`

Automated tests:

```bash
# Server-side (Cloud Functions)
cd firebase-backend/functions && npm run build

# Colyseus server
cd colyseus-server && npm run build
cd colyseus-server && npx jest tests/services/persistence.test.ts

# Client-side
npx jest __tests__/services/gameRecovery.test.ts
npx jest __tests__/integration/inviteFinalization.test.ts
```
