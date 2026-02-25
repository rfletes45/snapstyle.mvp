# Games System

Last verified: 2026-02-24

This is the canonical guide for SnapStyle game architecture, invites, runtime routing, and game completion plumbing.

Related system docs:

- Profile system: `docs/PROFILE_SYSTEM.md`

Recent changes (invite hardening):

- §13: Server-authoritative `finalizeUniversalInvite` (idempotent, transactional)
- §14: Chat visibility system (`chatVisibility` field + subscription/render filters)
- §15: Game recovery service (AsyncStorage crash-recovery + banner)
- §16: Watchdog reconciliation (`reconcileActiveInvites` every 15 min)
- §17: External Colyseus invite finalization fix (ext\_ parsing, separated try/catch, cardPlayers)
- §18: Validation commands
- §19: Phase 2 — Client-side chat layer hardening (leak guard, DEV tools, staleness)
- §20: Phase 3 + 4 — Realtime join stability & watchdog hardening (join mutex, grace windows, recovery)

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

Server functions:

- `onUniversalInviteUpdate`
- `createGameFromInvite` (legacy)
- `processGameCompletion`
- `processRealtimeGameCompletion`
- `onGameResult`
- `reconcileActiveInvites` (watchdog)
- `finalizeUniversalInvite` (internal helper, logged as `[finalizeUniversalInvite]`)

Colyseus server:

- room join/auth logs in `colyseus-server`
- room creation and `filterBy(["firestoreGameId"])` matching behavior

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

Three-pass design:

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

- Parses `ext_<gameType>_<inviteId>` format by taking the substring after the last underscore.
- Firestore auto-generated invite IDs are alphanumeric (no underscores), so this is safe.
- Used by `deleteGameAndInvite`, `BattleshipRoom.onDispose`, `CardGameRoom.onDispose`.
- Also replicated in `processRealtimeGameCompletion` Cloud Function.

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
