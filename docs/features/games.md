# Games System

Last verified: 2026-02-22

## Scope

This doc covers game catalog contracts, navigation/runtime routing, invite lifecycle, multiplayer integration (Firestore + Colyseus), spectator behavior, and leaderboard/achievement wiring.

## Game Catalog and Registry

Source of truth:

- `src/types/games.ts` (`GAME_METADATA`)

Current game IDs (19):

- Solo/puzzle/daily:
  - `bounce_blitz`, `play_2048`, `word_master`, `brick_breaker`, `minesweeper_classic`, `lights_out`, `pong_game`, `crossword_puzzle`
- Turn-based multiplayer:
  - `chess`, `checkers`, `crazy_eights`, `tic_tac_toe`, `connect_four`, `dot_match`, `gomoku_master`, `reversi_game`
- Realtime/incremental/party:
  - `starforge_game`, `sketch_party_game`, `minigolf_duels`

Registry helper functions in the same file (`getAvailableGames`, `getGameMetadata`, score limits) are part of the contract.

## Navigation and Screen Entry

Navigation contracts:

- Types: `src/types/navigation/root.ts`
- Wiring: `src/navigation/RootNavigator.tsx`

Primary route hub:

- `GamesHub` in `PlayStack`

Important overlays:

- `SpectatorView` is mounted at root stack to allow cross-tab deep entry.

## Runtime Split: Firestore vs Colyseus

Game flow can use one or both backends:

1. Invite/session orchestration uses Firestore + Functions (`gameInvites.ts`, `functions/src/games.ts`).
2. Realtime socket state uses Colyseus where enabled.

Colyseus mapping contract:

- Client map: `src/config/colyseus.ts`
- Room registry: `colyseus-server/src/app.config.ts`

Mapping nuance:

- Metadata IDs (e.g. `chess`) are not always the same as Colyseus keys (e.g. `chess_game`) or room names (`chess`).
- Preserve mapping tables; do not assume direct string equality.

## Invite Lifecycle Contract

Universal invite type source:

- `src/types/turnBased.ts` (`UniversalGameInvite`)

Key statuses:

- `pending`
- `filling`
- `ready`
- `starting`
- `active`
- `completed`
- `declined`
- `expired`
- `cancelled`

Core fields to preserve:

- `context` (`dm` or `group`)
- `targetType` (`specific` or `universal`)
- `eligibleUserIds`
- `claimedSlots`
- `requiredPlayers` / `maxPlayers`
- `traceId` / `inviteVersion`

Client service:

- `src/services/gameInvites.ts`

Server orchestration:

- `firebase-backend/functions/src/games.ts`

## Colyseus Join Contract for Games

Preferred join path:

- `colyseusService.joinWithContext(...)`

Join payload built by:

- `src/services/colyseusJoin.ts`

Important join fields:

- required: `token`, `protocolVersion`, `buildInfo`, `traceId`
- optional routing: `firestoreGameId`, `spectator`, `inviteId`, `conversationId`

## Spectator and Starforge

Spectator:

- Service: `src/services/spectatorSessions.ts`
- Screen: `src/screens/games/SpectatorViewScreen.tsx`
- Colyseus room: `spectator`
- Firestore tracking: `SpectatorSessions`

Starforge embedded flow:

- URL builder and host probing: `src/config/starforgeGame.ts`
- WebView wrapper: `src/screens/games/StarforgeGameScreen.tsx`
- Static host mount: `colyseus-server/src/services/starforgeClientHost.ts`

## Achievements and Leaderboards

Client services:

- `src/services/achievementsV2.ts`
- `src/services/leaderboards.ts`
- `src/services/multiplayerLeaderboard.ts`

Server evaluators/updates:

- `firebase-backend/functions/src/achievementsV2Evaluator.ts`
- `firebase-backend/functions/src/leaderboards.ts`

## Critical Invariants

1. Game ID registry, navigation route names, and backend routing keys must stay aligned.
2. Invite lifecycle status transitions must remain monotonic and valid.
3. Realtime games must keep client room mapping in sync with server room names.
4. Trace IDs should propagate across invite -> join -> server logs.
5. Spectator paths must not mutate active player state.

## Change Checklist

1. New game:
   - Add metadata and score limits in `src/types/games.ts`
   - Add screen + route contracts
   - Add persistence/invite/runtime wiring
2. Realtime/Colyseus change:
   - Update client mapping + server room registry together
   - Verify context-driven join path still typechecks
3. Invite schema/status change:
   - Update `src/types/turnBased.ts`
   - Update `src/services/gameInvites.ts`
   - Update functions game orchestration
4. Validate with:
   - `npm run verify:registry`
   - `npm run smoke`
   - Colyseus tests/lint/build from operations docs
