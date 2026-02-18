# Colyseus Server Contract

Last updated: 2026-02-18

## Scope

`colyseus-server/` is the real-time gameplay backend for multiplayer rooms and the dedicated spectator room. It enforces auth + protocol compatibility at join time, persists/recovers game state where needed, and provides structured logs with `traceId` for cross-system debugging.

## Entry Points

- Server bootstrap and room registry: `colyseus-server/src/app.config.ts`
- Protocol compatibility gate: `colyseus-server/src/utils/protocol.ts`
- Structured logging API: `colyseus-server/src/utils/logger.ts`
- Stuck-room diagnostics: `colyseus-server/src/utils/stuckRoomWatchdog.ts`
- Firebase auth/persistence integration: `colyseus-server/src/services/firebase.ts`, `colyseus-server/src/services/persistence.ts`

## Room Registry

The following room IDs are registered in `colyseus-server/src/app.config.ts`.

| Room ID | Class | Base | Primary state schema | Notes |
| --- | --- | --- | --- | --- |
| `dot_match` | `DotMatchRoom` | `ScoreRaceRoom` | `ScoreRaceState` | `filterBy(["firestoreGameId"])` |
| `tic_tac_toe` | `TicTacToeRoom` | `TurnBasedRoom` | `TurnBasedState` | `filterBy(["firestoreGameId"])` |
| `connect_four` | `ConnectFourRoom` | `TurnBasedRoom` | `TurnBasedState` | `filterBy(["firestoreGameId"])` |
| `gomoku` | `GomokuRoom` | `TurnBasedRoom` | `TurnBasedState` | `filterBy(["firestoreGameId"])` |
| `reversi` | `ReversiRoom` | `TurnBasedRoom` | `TurnBasedState` | `filterBy(["firestoreGameId"])` |
| `chess` | `ChessRoom` | `TurnBasedRoom` | `TurnBasedState` | `filterBy(["firestoreGameId"])` |
| `checkers` | `CheckersRoom` | `TurnBasedRoom` | `TurnBasedState` | `filterBy(["firestoreGameId"])` |
| `crazy_eights` | `CrazyEightsRoom` | `CardGameRoom` | `CardGameState` | `filterBy(["firestoreGameId"])` |
| `pong` | `PongRoom` | `PhysicsRoom` | `PhysicsState` | `filterBy(["firestoreGameId"])` |
| `bounce_blitz` | `BounceBlitzRoom` | standalone | `BounceBlitzState` | `filterBy(["firestoreGameId"])` |
| `brick_breaker` | `BrickBreakerRoom` | standalone | `BrickBreakerState` | `filterBy(["firestoreGameId"])` |
| `minigolf_duels` | `MiniGolfDuelsRoom` | standalone | `MiniGolfState` | `filterBy(["firestoreGameId"])` |
| `word_master` | `WordMasterRoom` | standalone | `WordMasterState` | `filterBy(["firestoreGameId"])` |
| `crossword` | `CrosswordRoom` | standalone | `CrosswordState` | `filterBy(["firestoreGameId"])` |
| `starforge` | `StarforgeRoom` | `IncrementalRoom` | `StarforgeState` | `filterBy(["firestoreGameId"])` |
| `sketch_party` | `SketchPartyRoom` | standalone | `SketchPartyState` | `filterBy(["firestoreGameId"])` |
| `spectator` | `SpectatorRoom` | standalone | `SpectatorRoomState` | dedicated SP spectator room |

## Join/Auth Contract

All production room joins are expected to include:

- `token` (Firebase ID token; verified in `onAuth`)
- `protocolVersion`
- `buildInfo`
- `traceId`
- `firestoreGameId` for game rooms using `filterBy(["firestoreGameId"])`

### Protocol Safety

- `checkProtocolVersion(...)` in `colyseus-server/src/utils/protocol.ts` is the canonical gate.
- Current server constants:
  - `SERVER_PROTOCOL_VERSION = 1`
  - `MINIMUM_PROTOCOL_VERSION = 1`
- If protocol check fails, room auth rejects early with a clear reason and structured warning log containing `traceId`.

### Client Error Mapping

- Client join errors are mapped to game error taxonomy in `src/services/colyseus.ts`.
- Protocol mismatch strings are mapped to `GameErrorCode.PROTOCOL_VERSION_MISMATCH` in `mapJoinError(...)`.

## TraceId Contract

Segment 11 hardening ensured `traceId` is present in both room state and logs:

- Schema fields now include `traceId`:
  - `colyseus-server/src/schemas/common.ts`
  - `colyseus-server/src/schemas/physics.ts`
  - `colyseus-server/src/schemas/draw.ts`
  - `colyseus-server/src/schemas/minigolf.ts`
  - `colyseus-server/src/schemas/spectator.ts`
- Rooms set `state.traceId` in `onCreate(...)` and initialize scoped logger context with `traceId`.
- Protocol reject logs include `traceId` across base and standalone rooms.

## Reconnection Behavior

Reconnection windows are room-family specific:

| Room family | Typical window | Source |
| --- | --- | --- |
| Turn-based base | 30s | `colyseus-server/src/rooms/base/TurnBasedRoom.ts` |
| Quick-play score race | `RECONNECTION_TIMEOUT_QUICKPLAY` (default 15s) | `colyseus-server/src/rooms/base/ScoreRaceRoom.ts` |
| Physics base | `RECONNECTION_TIMEOUT_PHYSICS` (default 15s) | `colyseus-server/src/rooms/base/PhysicsRoom.ts` |
| Card-game base | 300s | `colyseus-server/src/rooms/base/CardGameRoom.ts` |
| Coop rooms (`word_master`, `crossword`) | `RECONNECTION_TIMEOUT_COOP` (default 30s) | `colyseus-server/src/rooms/coop/*.ts` |
| Party room (`sketch_party`) | `RECONNECTION_TIMEOUT_PARTY` (default 30s) | `colyseus-server/src/rooms/party/SketchPartyRoom.ts` |
| Incremental base | 15s (`reconnectionTimeoutSec`) | `colyseus-server/src/rooms/incremental/IncrementalRoom.ts` |
| Spectator host | 30s (host only, active phase) | `colyseus-server/src/rooms/spectator/SpectatorRoom.ts` |

## Watchdogs and Stuck-State Diagnostics

- `createStuckRoomWatchdog(...)` logs room diagnostics if phase does not reach `playing` within timeout.
- Default timeout is 60 seconds (`DEFAULT_STUCK_TIMEOUT_MS` in `colyseus-server/src/utils/stuckRoomWatchdog.ts`).
- Base rooms (`TurnBasedRoom`, `ScoreRaceRoom`, `PhysicsRoom`) attach watchdogs using scoped room loggers so warnings include contextual fields.

## Spectator Throttling / Load Shedding

`SpectatorRoom` uses adaptive throttling to reduce bandwidth at higher viewer counts:

- Patch-rate tiers (spectator count -> patch rate):
  - `<=5` -> `100ms` (~10fps)
  - `6-15` -> `150ms`
  - `16-30` -> `250ms`
  - `31+` -> `500ms`
- Additional `gameStateJson` throttle interval widens from `500ms` up to `1000ms` at high counts.
- Source: `colyseus-server/src/rooms/spectator/SpectatorRoom.ts`.

## Debugging by TraceId

Use this sequence for production debugging:

1. Capture `traceId` from client logs, room logs, or bug report context.
2. Inspect server logs for protocol reject/auth/join lifecycle entries with matching `traceId`.
3. Correlate with Firestore game/invite docs via `firestoreGameId` and `traceId`.
4. For spectator issues, inspect `SpectatorRoom` logs (join/leave, patch-rate shifts, dropped update counters).

