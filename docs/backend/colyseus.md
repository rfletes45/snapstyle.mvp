# Colyseus Multiplayer Server

Last verified: 2026-03-01

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
- `v3SessionId` (v3 session document ID — used by persistence bridge)

## V3 Session Bridge

When a game room is created via the v3 session pipeline, `options.v3SessionId` is captured
in `onCreate`. The persistence bridge in `colyseus-server/src/services/persistence.ts`
provides three functions to synchronize v3 session lifecycle with room lifecycle:

| Function           | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| `linkColyseusRoom` | Writes `colyseusRoomId` to session doc on room creation     |
| `resolveV3Session` | Transitions session → "resolved" with outcome/scores/winner |
| `abandonV3Session` | Transitions session → "abandoned" (game suspended/vacant)   |

All four base room classes (`TurnBasedRoom`, `ScoreRaceRoom`, `PhysicsRoom`, `CardGameRoom`)
integrate with this bridge. Game-managed rooms (battleship, sketch_party, starforge,
crossword, minigolf) call the bridge in their own `onDispose` handlers.

See `docs/UNIFIED_LOBBY_SPEC.md` §8 for the full phase mapping.

Reward processing:

- When `resolveV3Session` completes, the backend `processSessionRewards` function in `sessionsV3.ts` runs (idempotent, checks `rewardsProcessed` flag).
- V3 guards in `games.ts` ensure `processRealtimeGameCompletion` skips legacy reward processing for V3 sessions (checks `v3SessionId` on the doc).
- Watchdog Pass 4 retries `processSessionRewards` for resolved sessions where rewards were not processed.

Runtime shell integration:

- On the client side, all 14 multiplayer game screens are wrapped with `withMultiplayerRuntime` HOC (`src/components/games/MultiplayerRuntimeShell.tsx`).
- The shell detects game completion, builds `GameResultFacts`, and navigates to `SessionGameOverScreen`.
- For V3 sessions, the shell calls `resolveSessionV3` to trigger the backend reward pipeline.
- See `docs/GAMES_SYSTEM.md` §26 for full runtime shell architecture.

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
