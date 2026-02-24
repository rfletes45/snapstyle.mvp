# Games System

Last verified: 2026-02-24

This is the canonical guide for SnapStyle game architecture, invites, runtime routing, and game completion plumbing.

Related system docs:
- Profile system: `docs/PROFILE_SYSTEM.md`

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

- `processGameCompletion`: reacts to `TurnBasedGames` terminal statuses
- `processRealtimeGameCompletion`: reacts to `RealtimeGameSessions` inserts
- `onGameResult` callable: universal XP/achievement/per-game-stats pipeline

Invite cleanup/expiry:

- scheduled: `expireGameInvites`, `cleanupResolvedInvites`

## 7) Runtime Categories

### Solo

Flow:

1. Navigate to game screen via `GAME_SCREEN_MAP`.
2. Screen runs local game loop.
3. On finish, call `submitGameResult(buildGameResultEvent(...))`.
4. Optional legacy persistence path may also write `GameSessions` (`singlePlayerSessions.ts`).

### Turn-based (Firestore-orchestrated)

Flow:

1. Create invite (`sendUniversalInvite`).
2. Players claim slots (`claimInviteSlot`) until ready.
3. Host starts or trigger auto-creates match.
4. `TurnBasedGames` doc drives gameplay state lifecycle.
5. Completion updates invite + stats/achievements.

### Realtime (Colyseus)

Flow:

1. Create and claim invite as above.
2. Invite activation resolves to external session id for orchestration.
3. Client joins Colyseus via `joinWithContext` and resolved room mapping.
4. Room handles realtime gameplay and eventually persists completion (`RealtimeGameSessions`) if implemented by room.

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

- `BattleshipRoom.onDispose()` clears `firestoreGameId` -> `persistGameResult()` -> `RealtimeGameSessions` doc
- Triggers `processRealtimeGameCompletion` Cloud Function (stats, achievements, XP, GameHistory)
- `deleteGameAndInvite()` transitions invite to terminal state
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

Legacy overlap to know:

- `singlePlayerSessions.ts` still writes legacy session/leaderboard docs and also submits `onGameResult`.

Required end-of-game data:

- `gameId`, `mode`, `outcome`, `durationMs`
- `participants[]` including caller
- `score` where applicable
- include `inviteId` and `conversationId` for multiplayer sessions when available

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
3. If spectating is desired, integrate `useSpectator({ mode: "sp-host" })` + invite UI.
4. Add/adjust achievements in catalogs and evaluator expectations.

### C) Turn-based game checklist (Firestore)

1. Add to `TurnBasedGameType` unions where applicable.
2. Add default invite settings in `src/services/gameInvites.ts`.
3. Add initial state branch in `firebase-backend/functions/src/games.ts` -> `getInitialGameState`.
4. Ensure game screen consumes `inviteId`/`matchId` route params and joins lobby path.
5. Confirm completion path calls `completeGameInvite` and `submitGameResult`.
6. Validate in smoke tests for invite lifecycle.

### D) Realtime game checklist (Colyseus)

1. Add game metadata/runtime as `realtime` in `src/types/games.ts`.
2. Add mapping in `src/config/colyseus.ts` (`COLYSEUS_GAME_MAPPING`).
3. Register room in `colyseus-server/src/app.config.ts`.
4. If invite-driven, include game in backend `EXTERNAL_COLYSEUS_INVITE_GAMES`.
5. Ensure screen uses canonical join path (`joinWithContext` / mapping resolver).
6. Add room completion persistence if needed (`RealtimeGameSessions`) for post-game processing.

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
- `hooks/useGameLobby`
- `components/chat/ChatGameInvites`
- `services/colyseus`
- `hooks/useSpectator`
- `services/gameResultService`

Server functions:

- `onUniversalInviteUpdate`
- `createGameFromInvite` (legacy)
- `processGameCompletion`
- `processRealtimeGameCompletion`
- `onGameResult`

Colyseus server:

- room join/auth logs in `colyseus-server`
- room creation and `filterBy(["firestoreGameId"])` matching behavior

## 13) Validation Commands

Run after invite/flow changes:

1. `npm run verify:registry`
2. `npm run smoke`
3. `npm run type-check`
4. `npm run lint`
5. `npm run build` (in `firebase-backend/functions`)
6. `npm run build` (in `colyseus-server`)

Known repository state (as of this update):

- registry and smoke are passing
- root `type-check` and `lint` currently fail due unrelated existing workspace issues outside invite/flow scope
