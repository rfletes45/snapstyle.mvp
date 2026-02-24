# Colyseus Multiplayer Server

Last verified: 2026-02-24

## Server Entry and Runtime

- Entry: `colyseus-server/src/app.config.ts`
- Dev run: `npm --prefix colyseus-server run dev`
- Health endpoint: `http://localhost:2567/health`

Startup responsibilities:

1. Load environment variables.
2. Initialize Firebase Admin bridge.
3. Register all room handlers.
4. Mount Starforge static host routes.
5. Listen on `PORT` (default `2567`).

## Room Registry (Current)

Registered room names:

- Quickplay: `dot_match`
- Turn-based: `tic_tac_toe`, `connect_four`, `gomoku`, `reversi`
- Complex turn-based: `chess`, `checkers`, `crazy_eights`
- Physics/realtime: `pong`, `bounce_blitz`, `brick_breaker`, `minigolf_duels`
- Cooperative: `word_master`, `crossword`
- Incremental/party: `starforge`, `sketch_party`
- Strategy/naval: `battleship`
- Spectator: `spectator`

Room source families:

- `colyseus-server/src/rooms/quickplay/`
- `colyseus-server/src/rooms/turnbased/`
- `colyseus-server/src/rooms/physics/`
- `colyseus-server/src/rooms/coop/`
- `colyseus-server/src/rooms/incremental/`
- `colyseus-server/src/rooms/party/`
- `colyseus-server/src/rooms/spectator/`

All gameplay rooms except `spectator` are filtered by `firestoreGameId`.

## Client-Server Mapping Contract

Client room mapping lives in:

- `src/config/colyseus.ts`
- Keys: `COLYSEUS_ROOM_NAMES`, `GAME_CATEGORY_MAP`

Join path should use context-driven API:

- `colyseusService.joinWithContext(...)` in `src/services/colyseus.ts`

Join payload is built by:

- `buildJoinOptions(...)` in `src/services/colyseusJoin.ts`

Required join payload invariants:

- `token` (Firebase auth token)
- `protocolVersion`
- `buildInfo`
- `traceId`

Optional routing fields:

- `firestoreGameId`
- `spectator`
- `inviteId`
- `conversationId`

## Feature-Flag Gating

Whether Colyseus is used for a game depends on:

1. `COLYSEUS_FEATURES.COLYSEUS_ENABLED`
2. Category gate (`PHYSICS_ENABLED`, `TURNBASED_ENABLED`, etc.)
3. Game mapping existence in `COLYSEUS_ROOM_NAMES`

## Spectator and Starforge Hosting

Spectator:

- Dedicated room: `spectator`
- Client entry: `joinAsSpectator`, `createSpectatorRoom`, `joinSpectatorRoom`

Starforge co-hosting:

- Static mount: `/starforge`
- Health route: `/starforge/health`
- Host logic: `colyseus-server/src/services/starforgeClientHost.ts`
- If bundle is missing, host returns 503 guidance instead of silently failing.

## Error and Diagnostics Path

- Colyseus join errors are normalized by `mapColyseusJoinError`.
- Trace IDs are propagated through join options and log paths.
- Keep trace propagation intact when modifying join or room boot paths.

## Commands

```bash
npm --prefix colyseus-server run dev
npm --prefix colyseus-server run lint
npm --prefix colyseus-server run test
npm --prefix colyseus-server run build
```

## Change Checklist

1. Add/modify room code under the correct `rooms/*` family.
2. Register room in `src/app.config.ts`.
3. Update client mapping in `src/config/colyseus.ts`.
4. Verify join options and error mapping paths still compile.
5. Add/update tests in `colyseus-server/tests/rooms/` and relevant utils tests.
6. Update this doc if room names, join contract, or hosting behavior changes.
