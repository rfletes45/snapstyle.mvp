# Realtime Game Framework — Architecture & Integration Guide

> **Status**: Production-ready framework. Sketch Party refactored as reference implementation.
> **Owner**: Games V4 Team
> **Last Updated**: 2026-03-18 workspace audit

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Split: Firebase vs Colyseus](#architecture-split)
3. [Server-Side Framework](#server-side-framework)
4. [Client-Side Framework](#client-side-framework)
5. [Room Lifecycle](#room-lifecycle)
6. [Authentication & Security](#authentication--security)
7. [Reconnection & Disconnect Policies](#reconnection--disconnect-policies)
8. [Resolution Bridge](#resolution-bridge)
9. [Message Protocol](#message-protocol)
10. [Adding a New Realtime Game](#adding-a-new-realtime-game)
11. [Testing](#testing)
12. [Debugging & Operations](#debugging--operations)

---

## Overview

The Realtime Game Framework is a generalized system for building Colyseus-backed
multiplayer games within the Games V4 architecture. It replaces game-specific
room implementations with a reusable `BaseRealtimeRoom` that handles:

- Firebase token authentication & session membership verification
- Configurable match start, disconnect, and reconnect policies
- Rate-limited and validated message dispatch
- Periodic Firestore heartbeat (RuntimeMirror)
- Idempotent resolution bridge to the V4 pipeline
- Per-viewer state broadcasting with visibility scoping

### Design Principles

1. **Firebase = durable authority**: Sessions, invites, results, XP, PB, achievements, leaderboards
2. **Colyseus = live authority**: Real-time game state, input handling, simulation ticks
3. **Resolution pipeline is THE chokepoint**: All games resolve through `resolveSessionV4Internal()`
4. **Configuration over code**: Game behavior defined by `RealtimeGameDefinition`, not if-statements
5. **Retire superseded paths**: Remove legacy rooms and unused client helpers once the shared framework replaces them

---

## Architecture Split

```
┌─────────────────┐           ┌──────────────────────┐
│   React Native   │  ws://    │   Colyseus Server     │
│   Client App     │◄────────►│                        │
│                  │           │  BaseRealtimeRoom      │
│  useRealtimeRoom │           │    ├─ GameDefinition   │
│  RealtimeClient  │           │    ├─ InputValidation  │
│                  │           │    ├─ RuntimeMirror     │
└────────┬─────────┘           │    └─ ResolutionBridge │
         │                     └──────────┬─────────────┘
         │  Firestore                     │ Admin SDK
         │  (read-only for                │ (writes resolution
         │   session state)               │  request doc)
         ▼                                ▼
┌─────────────────────────────────────────┐
│              Firebase                    │
│  ┌──────────────────────────────┐       │
│  │ GameSessionsV4/{id}          │       │
│  │   /internal/realtimeResolution│ ◄────┤ onCreate trigger
│  │   /internal/runtimeSummary    │      │
│  └──────────────────────────────┘       │
│  ┌──────────────────────────────┐       │
│  │ onRealtimeResolutionRequest   │      │
│  │   → resolveSessionV4Internal  │      │
│  │     → XP, PB, leaderboards   │      │
│  └──────────────────────────────┘       │
└─────────────────────────────────────────┘
```

### What Lives Where

| Concern                | Owner                         | Notes                                       |
| ---------------------- | ----------------------------- | ------------------------------------------- |
| Invite creation        | Firebase (callable)           | `createGameInviteV4`                        |
| Session document       | Firebase                      | Durable lifecycle, participants             |
| Real-time game state   | Colyseus                      | In-memory, authoritative for live match     |
| Input validation       | Colyseus                      | Rate limiting, payload checks               |
| Authentication         | Colyseus (via Firebase Admin) | Verifies tokens on join                     |
| Resolution             | Firebase (trigger)            | Written by Colyseus, processed by Functions |
| XP / PB / Achievements | Firebase Functions            | Via resolution pipeline                     |
| Leaderboards           | Firebase Functions            | Updated on resolution                       |

---

## Server-Side Framework

### Directory Structure

```
colyseus-server/src/
├── core/                           # Shared framework
│   ├── types.ts                    # Type definitions
│   ├── BaseRealtimeRoom.ts         # Abstract base room (~550 lines)
│   ├── FirebaseSessionGuard.ts     # Auth verification
│   ├── ResolutionBridge.ts         # Firebase resolution writer
│   ├── RuntimeMirror.ts            # Periodic Firestore heartbeat
│   ├── InputValidation.ts          # Rate limiting, message registry
│   ├── GameRegistry.ts             # Central game definition registry
│   └── index.ts                    # Barrel exports
├── games/                          # Game implementations
│   └── sketch_party/
│       ├── Definition.ts           # RealtimeGameDefinition
│       ├── Room.ts                 # SketchPartyRoomV2
│       └── index.ts                # Auto-registration
├── bridge/
│   └── firebaseBridge.ts          # Firebase Admin init
└── index.ts                        # Server entry point
```

### RealtimeGameDefinition

The `RealtimeGameDefinition` is the contract that every realtime game must provide.
It defines all configurable behavior without subclassing:

```typescript
interface RealtimeGameDefinition {
  // Identity
  gameId: string;
  roomName: string;
  displayName: string;

  // Simulation
  simulationProfile: "phase_event" | "fixed_tick" | "hybrid_round_tick";
  tickRateMs?: number;            // For fixed_tick / hybrid

  // Capacity
  minPlayers: number;
  maxPlayers: number;

  // Policies
  matchStartPolicy: "full_roster" | "min_players" | "host_start" | ...;
  disconnectPolicy: "pause_match" | "continue_without_player" | ...;
  lateJoinPolicy: "disallow" | "allow_backfill" | "spectator_only";
  spectatorMode: "none" | "view_only" | "view_and_react";
  visibilityScope: "full_broadcast" | "per_player" | "team_scoped";

  // Timing
  reconnectGraceMs: number;
  abandonmentGraceMs: number;
  matchDurationMs: number | null;   // null = unlimited
  countdownSec: number;

  // Messages
  messages: MessageDefinition[];    // All game-specific message types

  // Settings
  defaultSettings: Record<string, unknown>;
  validateSettings?: (patch) => Record<string, unknown>;
}
```

### BaseRealtimeRoom

The abstract base class all realtime rooms extend:

```typescript
abstract class BaseRealtimeRoom extends Room {
  // MUST implement:
  abstract getGameDefinition(): RealtimeGameDefinition;
  abstract onMatchStart(players, settings): void;
  abstract onMatchEnd(reason): { resolutionType; winnerIds; scoreboard };
  abstract registerGameMessages(): void;
  abstract getGameState(viewerUid, isSpectator): Record<string, unknown>;

  // MAY override:
  onTick?(deltaMs: number): void;
  onPlayerReconnect?(uid, client): void;
  onPlayerDisconnect?(uid): void;
  onSpectatorJoin?(uid, client): void;
}
```

Built-in behaviors (no code needed in subclass):

- Firebase token verification via `FirebaseSessionGuard`
- Match start policy evaluation (5 policies)
- Disconnect/reconnect handling (7 disconnect policies)
- Abandonment grace timer
- Match duration timer
- Countdown before match start
- Rate-limited message dispatch
- Periodic state broadcast to all clients
- RuntimeMirror heartbeat to Firestore
- Resolution bridge writing on match end
- System messages (player joined/left, errors)
- Ping/pong latency tracking

---

## Client-Side Framework

### Directory Structure

```
src/gamesV4/realtime/
├── types.ts                  # Type definitions
├── realtimeClient.ts         # RealtimeRoomClient class
├── registry.ts               # Client-side game definition registry
├── useRealtimeRoom.ts        # Primary React hook
├── errors.ts                 # Structured error types
├── index.ts                  # Barrel exports
└── games/
    └── sketchPartyDef.ts     # Sketch Party client definition
```

### useRealtimeRoom Hook

Primary hook for game screens:

```typescript
function MyGameScreen({ sessionId }) {
  const { user } = useAuth();

  const {
    room, // Raw Colyseus Room (null until connected)
    gameState, // Latest server state (typed)
    connectionStatus, // "idle" | "connecting" | "connected" | ...
    latencyMs, // Ping latency
    error, // Error message or null
    send, // Send message to server
    leave, // Leave room gracefully
    reconnect, // Manually trigger reconnect
  } = useRealtimeRoom<MyGameState>(MY_GAME_CLIENT_DEF, {
    sessionId,
    uid: user.uid,
    displayName: user.displayName,
    token: await user.getIdToken(),
  });

  // Send game actions
  const handleMove = () => send("move", { x: 1, y: 2 });

  // The hook auto-connects on mount and auto-disconnects on unmount
}
```

### Game-Specific Message Handlers

Use the room returned by `useRealtimeRoom()` for game-specific messages that
should not flow through `state_sync`. The current screens register these
handlers from a room-scoped effect and rely on the room instance changing on
reconnect:

```typescript
useEffect(() => {
  if (!room) return;

  room.onMessage("chat", (data) => appendChat(data));
  room.onMessage("stroke_begin", (data) => addStroke(data));
}, [room]);
```

### RealtimeClientDefinition

```typescript
const MY_GAME_CLIENT_DEF: RealtimeClientDefinition<MyGameState> = {
  gameId: "my_game",
  roomName: "my_game",
  displayName: "My Game",
  serverMessageTypes: ["state_sync", "custom_event", ...],
  initialState: { /* default state */ },
  autoStateSync: true,            // Auto-update state on "state_sync"
  reconnect: {
    enabled: true,
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 15000,
  },
};
```

---

## Room Lifecycle

```
  ┌──────────┐     All players joined
  │ WAITING  │────────────────────────► ┌───────────┐
  └──────────┘                          │ COUNTDOWN │
       │                                └─────┬─────┘
       │ (immediate start)                    │ Timer expires
       │                                      ▼
       └──────────────────────────────► ┌──────────┐
                                        │ PLAYING  │
                                        └────┬─────┘
                                             │
                    ┌────────────────────────┤
                    │                        │
                    ▼                        ▼
              ┌──────────┐           ┌────────────┐
              │  PAUSED  │           │ MATCH_END  │
              └────┬─────┘           └──────┬─────┘
                   │ Resume                 │
                   └─► PLAYING              ▼
                                     ┌───────────┐
                                     │ RESOLVING │
                                     └─────┬─────┘
                                           │
                                           ▼
                                     ┌──────────┐
                                     │ RESOLVED │
                                     └──────────┘
```

### Phase Descriptions

| Phase       | Description                                       |
| ----------- | ------------------------------------------------- |
| `waiting`   | Room created, accepting player joins              |
| `countdown` | Pre-match countdown (configurable duration)       |
| `playing`   | Active gameplay, simulation running               |
| `paused`    | Game paused (e.g., all players disconnected)      |
| `match_end` | Game logic complete, preparing resolution payload |
| `resolving` | Resolution written to Firestore, awaiting trigger |
| `resolved`  | Resolution complete, room will dispose            |

---

## Authentication & Security

### Join Flow

1. Client sends `{ sessionId, uid, displayName, token }` on `joinOrCreate`
2. `BaseRealtimeRoom.onAuth()` calls `FirebaseSessionGuard.verifyJoin()`
3. Guard verifies:
   - Firebase ID token is valid (via Admin SDK)
   - Token UID matches declared UID
   - Session document exists in Firestore
   - Session gameId matches room's gameId
   - Session runtimeType is "realtime"
   - Session status is "active"
   - UID is in participantUids (or spectatorUids for spectators)
4. Returns `SessionGuardResult` with verified player profile

---

## Reconnection & Disconnect Policies

### Disconnect Policies (7 options)

| Policy                    | Behavior                             |
| ------------------------- | ------------------------------------ |
| `pause_match`             | Pause game until player reconnects   |
| `continue_without_player` | Skip disconnected player in rotation |
| `ai_takeover`             | AI plays for disconnected player     |
| `forfeit_player`          | Disconnected player forfeits         |
| `forfeit_team`            | Entire team forfeits                 |
| `spectate_on_disconnect`  | Move to spectator role               |
| `immediate_resolve`       | End match immediately                |

### Match Start Policies (5 options)

| Policy             | Behavior                                     |
| ------------------ | -------------------------------------------- |
| `full_roster`      | Start when all maxPlayers slots filled       |
| `min_players`      | Start when minPlayers threshold met          |
| `host_start`       | Host explicitly starts (requires minPlayers) |
| `countdown_on_min` | Begin countdown when minPlayers met          |
| `immediate`        | Start as soon as any player joins            |

### Reconnection Flow

1. Player disconnects → `BaseRealtimeRoom` starts grace timer
2. If reconnect within `reconnectGraceMs` → session restored, player marked connected
3. If grace expires → disconnect policy evaluated
4. Client auto-reconnect: `RealtimeRoomClient` retries with exponential backoff

---

## Resolution Bridge

### Flow

```
Colyseus Room                 Firestore                    Cloud Functions
     │                            │                              │
     │ onMatchEnd()               │                              │
     │ builds payload             │                              │
     ├─writeResolutionRequest()──►│                              │
     │                            │ internal/                    │
     │                            │ realtimeResolution           │
     │                            │    (onCreate)                │
     │                            ├─────────────────────────────►│
     │                            │                              │ onRealtimeResolutionRequest
     │                            │                              │   → resolveRealtimeSessionV4
     │                            │                              │     → resolveSessionV4Internal
     │                            │                              │       → XP, PB, leaderboards
```

### Idempotency

- In-process: `requestId` tracked in a `Set` (max 1000 entries)
- Firestore: `set()` to fixed doc path is naturally idempotent
- Trigger: Checks session status before resolving (already resolved → skip)

### Resolution Payload

```typescript
interface RealtimeResolutionPayload {
  requestId: string; // Unique per resolution attempt
  sessionId: string;
  gameId: string;
  roomVersion: number; // Monotonic counter
  endedAt: number; // Epoch ms
  reason: string; // "match_complete" | "abandoned" | "timeout" | ...
  resolutionType: "win" | "draw" | "disconnect" | "timeout" | "error";
  winnerIds: string[];
  scoreboard: FinalScoreboardEntry[];
  durationMs: number;
  playerMetrics: Record<string, Record<string, unknown>>;
  flags: Record<string, unknown>;
}
```

---

## Message Protocol

### System Messages (framework-provided)

| Message               | Direction       | Description                |
| --------------------- | --------------- | -------------------------- |
| `state_sync`          | Server → Client | Full game state broadcast  |
| `countdown`           | Server → Client | Match countdown tick       |
| `system_message`      | Server → Client | Announcements              |
| `player_connected`    | Server → Client | Player join notification   |
| `player_disconnected` | Server → Client | Player leave notification  |
| `player_reconnected`  | Server → Client | Player return notification |
| `match_resolved`      | Server → Client | Game over signal           |
| `ping`                | Client → Server | Latency probe              |
| `pong`                | Server → Client | Latency response           |
| `host_start`          | Client → Server | Host requests start        |
| `resign`              | Client → Server | Player resigns             |

### Game Messages

Defined per game via `RealtimeGameDefinition.messages[]`:

```typescript
interface MessageDefinition {
  type: string;
  senderRole: "any" | "active" | "spectator";
  allowedPhases: RoomPhase[];
  rateLimit: { maxPerWindow: number; windowMs: number };
  payloadValidator?: (payload: unknown) => string | null;
  preCheck?: (sender, room) => string | null;
}
```

---

## Adding a New Realtime Game

### Step-by-Step Checklist

#### 1. Define the game (server)

Create `colyseus-server/src/games/<game_name>/Definition.ts`:

```typescript
export const MY_GAME_DEFINITION: RealtimeGameDefinition = {
  gameId: "my_game",
  roomName: "my_game",
  displayName: "My Game",
  simulationProfile: "fixed_tick",    // or "phase_event"
  tickRateMs: 16,                     // ~60fps for physics games
  minPlayers: 2,
  maxPlayers: 2,
  matchStartPolicy: "full_roster",
  disconnectPolicy: "forfeit_player",
  // ... all other fields
  messages: [
    { type: "move", senderRole: "active", allowedPhases: ["playing"], ... },
  ],
};
```

#### 2. Implement the room (server)

Create `colyseus-server/src/games/<game_name>/Room.ts`:

```typescript
export class MyGameRoom extends BaseRealtimeRoom {
  getGameDefinition() { return MY_GAME_DEFINITION; }

  onMatchStart(players, settings) {
    // Initialize game state
  }

  onMatchEnd(reason) {
    // Return resolution data
    return { resolutionType: "win", winnerIds: [...], scoreboard: [...] };
  }

  registerGameMessages() {
    this.onGameMessage("move", (client, data) => {
      // Handle move
    });
  }

  getGameState(viewerUid, isSpectator) {
    // Return state visible to this viewer
    return { ... };
  }

  // Optional: for physics games
  onTick(deltaMs) {
    // Update simulation
  }
}
```

#### 3. Register the game (server)

Create `colyseus-server/src/games/<game_name>/index.ts`:

```typescript
import { registerRealtimeGame } from "../../core/GameRegistry";
import { MY_GAME_DEFINITION } from "./Definition";
registerRealtimeGame(MY_GAME_DEFINITION);
```

Import it in `colyseus-server/src/index.ts`:

```typescript
import "./games/my_game";
```

#### 4. Define client types

Create `src/gamesV4/realtime/games/myGameDef.ts`:

```typescript
export const MY_GAME_CLIENT_DEF: RealtimeClientDefinition<MyGameState> = {
  gameId: "my_game",
  roomName: "my_game",
  displayName: "My Game",
  serverMessageTypes: ["state_sync", "move_result", ...],
  initialState: { ... },
};
registerRealtimeClientDef(MY_GAME_CLIENT_DEF);
```

#### 5. Build the game screen (client)

```typescript
function MyGameScreen() {
  const { gameState, send, connectionStatus } =
    useRealtimeRoom<MyGameState>(MY_GAME_CLIENT_DEF, { ... });
  // Render game UI
}
```

#### 6. Register adapter & metadata

- Add adapter in `src/gamesV4/adapters/myGame.ts`
- Add to `GAME_METADATA` in `src/gamesV4/constants.ts`
- Add to `GAME_META` in `firebase-backend/.../invites.ts`
- Add screen to `GamePlayDispatcherV4.tsx`

#### 7. Add tests

- Unit tests for game logic (pure functions)
- Framework integration tests (policy evaluation, lifecycle)
- Place in `__tests__/gamesV4/realtime/`

---

## Testing

### Test Structure

```
__tests__/gamesV4/realtime/
├── inputValidation.test.ts    # Rate limiter, payload validation
├── resolutionBridge.test.ts   # Payload construction, idempotency
├── gameRegistry.test.ts       # Registration, lookup
├── roomLifecycle.test.ts      # Policies, phase transitions
└── clientRegistry.test.ts     # Client-side types & registry
```

### Running Tests

```bash
npx jest __tests__/gamesV4/realtime/ --no-coverage
```

---

## Debugging & Operations

### RuntimeMirror

The framework writes periodic heartbeats to Firestore at:

```
GameSessionsV4/{sessionId}/internal/runtimeSummary
```

Contains:

- Current phase
- Connected player count
- Match duration
- Room version
- Last update timestamp

### Health Check

Local development uses port `2567` by default. Railway/production uses the
platform `PORT` environment variable, currently `8080` internally, behind the
public `wss://` endpoint configured by `COLYSEUS_URL`.

```
GET http://<colyseus-host>:2567/health
```

Returns:

```json
{
  "status": "ok",
  "framework": "v2",
  "rooms": [
    {
      "gameId": "sketch_party_game",
      "roomName": "sketch_party",
      "simulationProfile": "phase_event"
    }
  ]
}
```

### Legacy Rollback

There is no longer an in-repo `sketch_party_legacy` room registration.

If a realtime regression requires rollback, deploy the previous known-good
server build and matching client bundle instead of pointing new clients at a
parallel legacy room name.

---

## Game Archetype Examples

### Party / Phase-Based (Sketch Party)

- `simulationProfile: "phase_event"`
- No tick loop; state changes on messages only
- Phases: choosing → drawing → turn_end → next turn
- Best for: drawing games, trivia, word games

### Action / Physics (Pong, Tank Battle)

- `simulationProfile: "fixed_tick"`
- `tickRateMs: 16` (60fps)
- Server runs physics simulation, broadcasts state
- Best for: arcade games, sports games, shooters

### Hybrid (Strategy with Timer)

- `simulationProfile: "hybrid_round_tick"`
- Event-driven move processing + periodic round ticks
- Best for: real-time strategy, card games with timers
