# Colyseus Real-Time Multiplayer Integration Plan

> **Version:** 1.0  
> **Status:** ✅ Implemented — Reference documentation  
> **Created:** 2025  
> **Framework:** Colyseus v0.17 + Firebase Firestore Persistence  
> **Target:** All 25 playable game screens

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Game Classification](#3-game-classification)
4. [Server Infrastructure](#4-server-infrastructure)
5. [Colyseus Server Setup](#5-colyseus-server-setup)
6. [Schema Design](#6-schema-design)
7. [Room Hierarchy & Design](#7-room-hierarchy--design)
8. [Client SDK Integration](#8-client-sdk-integration)
9. [Firestore Persistence Layer](#9-firestore-persistence-layer)
10. [Reconnection & Mobile Handling](#10-reconnection--mobile-handling)
11. [Matchmaking & Invites](#11-matchmaking--invites)
12. [Authentication Bridge](#12-authentication-bridge)
13. [Game-by-Game Migration Plan](#13-game-by-game-migration-plan)
14. [Testing Strategy](#14-testing-strategy)
15. [Deployment & DevOps](#15-deployment--devops)
16. [Performance Considerations](#16-performance-considerations)
17. [Rollout Phases](#17-rollout-phases)
18. [Risk Assessment](#18-risk-assessment)

---

## 1. Executive Summary

### Current State

All 25 playable games run either as **pure client-side single-player** experiences or as **Firestore-poll-based "multiplayer"** using `onSnapshot` listeners. There is **no dedicated game server** — turn-based games write moves to Firestore documents, and "real-time" games (Race) are simulated locally. This approach works for low-frequency turn-based games but cannot deliver:

- Sub-100ms state synchronization for physics-based games
- Server-authoritative game logic (anti-cheat)
- Deterministic tick-based physics simulation
- True real-time competitive gameplay

### Proposed State

Introduce a **Colyseus v0.17 game server** as a dedicated real-time multiplayer layer that:

1. **Owns real-time game state** for physics/action games (server-authoritative)
2. **Manages turn validation** for turn-based games (server validates moves, broadcasts state)
3. **Persists to Firestore** when all players leave a turn-based room (cold storage)
4. **Restores from Firestore** when a player re-opens a suspended turn-based game
5. **Coexists with Firebase** — Firebase Auth for identity, Firestore for persistence/history, Colyseus for real-time gameplay

### What Colyseus Is

Colyseus is a Node.js-based multiplayer game server framework (v0.17, latest) that provides:

- **Room-based architecture** — isolated game sessions with lifecycle hooks (`onCreate`, `onJoin`, `onDrop`, `onReconnect`, `onLeave`, `onDispose`)
- **Schema-based state sync** — `@colyseus/schema` with `@type()` decorators, automatic binary delta-encoded patches at configurable rates (default 20fps/50ms)
- **Built-in reconnection** — `onDrop()`/`allowReconnection()` with configurable timeout, automatic client-side retry with exponential backoff
- **Simulation intervals** — `setSimulationInterval()` for fixed-tick game loops (default 60fps/16.6ms)
- **Timing events** — `this.clock.setTimeout()`/`setInterval()` auto-cleaned on room disposal
- **Client SDK** — `@colyseus/sdk` with `joinOrCreate()`, `joinById()`, state sync callbacks, message sending
- **Matchmaker API** — server-side `matchMaker.createRoom()`, `reserveSeatFor()`, `query()`, `joinOrCreate()`
- **Zod validation** — `validate()` helper for type-safe message input validation
- **Max 64 sync properties per Schema class** (split into sub-schemas for larger states)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REACT NATIVE CLIENT                         │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Game Screen  │  │ useColyseus  │  │  ColyseusProvider        │  │
│  │  (Skia/SVG)  │──│    Hook      │──│  (Context + Client)      │  │
│  └──────────────┘  └──────────────┘  └──────────┬───────────────┘  │
│                                                  │                  │
│  ┌──────────────────────────────────────────────┐│                  │
│  │  Firebase Auth (useAuth)                     ││                  │
│  │  Firestore (game history, stats, invites)    ││                  │
│  └──────────────────────────────────────────────┘│                  │
└──────────────────────────────────────────────────│──────────────────┘
                                                   │ WebSocket (port 2567)
                                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        COLYSEUS SERVER                              │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  app.config.ts (defineServer)                                 │  │
│  │                                                               │  │
│  │  Rooms:                                                       │  │
│  │  ├── PhysicsRoom (base)  → PongRoom, BounceBlitzRoom, ...   │  │
│  │  ├── TurnBasedRoom (base) → ChessRoom, CheckersRoom, ...    │  │
│  │  ├── PuzzleCoopRoom (base) → CrosswordRoom              │  │
│  │  └── RaceRoom                                                │  │
│  │                                                               │  │
│  │  Schemas:                                                     │  │
│  │  ├── PhysicsState → Ball, Paddle, Player                    │  │
│  │  ├── TurnBasedState → Board, Piece, Move                    │  │
│  │  └── Per-game specialized schemas                            │  │
│  └───────────────┬───────────────────────────────────────────────┘  │
│                  │                                                   │
│  ┌───────────────▼───────────────────────────────────────────────┐  │
│  │  Firebase Admin SDK                                           │  │
│  │  ├── Auth verification (onAuth → verifyIdToken)              │  │
│  │  ├── Firestore write (onDispose → persist turn-based state)  │  │
│  │  └── Firestore read (onCreate → restore suspended games)     │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        FIREBASE / FIRESTORE                         │
│                                                                     │
│  Collections:                                                       │
│  ├── TurnBasedGames/      (existing — game documents)              │
│  │   └── Moves/           (existing — move history)                │
│  ├── GameInvites/         (existing — invite documents)            │
│  ├── MatchmakingQueue/    (existing — ELO matchmaking)             │
│  ├── GameSessions/        (existing — single-player records)       │
│  ├── PlayerGameStats/     (existing — aggregated stats)            │
│  ├── ColyseusGameState/   (NEW — cold-stored room states)          │
│  └── RealtimeGameSessions/ (NEW — real-time game history)          │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision                                           | Rationale                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| **Separate Node.js server** (not embedded in Expo) | Colyseus requires a persistent Node.js process; Expo is a client framework |
| **Firebase Admin SDK on Colyseus server**          | Direct Firestore access for persistence without Cloud Function overhead    |
| **WebSocket transport (default)**                  | React Native supports WebSocket natively; no polyfill needed               |
| **Colyseus for real-time only**                    | Single-player games stay client-side; no server needed                     |
| **Hybrid Firestore + Colyseus**                    | Firestore for persistence/history/stats; Colyseus for live gameplay        |

---

## 3. Game Classification

### Tier 1: Real-Time Physics Games (Colyseus Server-Authoritative)

These games require sub-frame state synchronization with a server-authoritative physics loop. The server runs the simulation; clients send inputs and render interpolated state.

| Game          | Screen File                  | Max Players | Tick Rate | Key Mechanics                   |
| ------------- | ---------------------------- | ----------- | --------- | ------------------------------- |
| Pong          | `PongGameScreen.tsx`         | 2           | 60fps     | Ball physics, paddle input      |
| Bounce Blitz  | `BounceBlitzGameScreen.tsx`  | 2           | 60fps     | Ball bouncing, scoring zones    |
| Brick Breaker | `BrickBreakerGameScreen.tsx` | 2 (co-op)   | 60fps     | Ball + brick collision grid     |
| Air Hockey    | `AirHockeyGameScreen.tsx`    | 2           | 60fps     | Puck physics, mallet input      |
| Snake         | `SnakeMasterGameScreen.tsx`  | 2-4         | 30fps     | Grid movement, collision        |
| Race          | `RaceGameScreen.tsx`         | 2-4         | 60fps     | Vehicle physics, track position |

**Simulation Pattern:** `setSimulationInterval(deltaTime => this.update(deltaTime), 16.6)` — server owns physics state, broadcasts at `patchRate = 33` (30fps sync).

### Tier 2: Turn-Based Strategy Games (Colyseus + Firestore Persistence)

These games have discrete turns. The server validates moves and broadcasts state. When both players leave, state is persisted to Firestore and the room disposes. When either player returns, the room is recreated from Firestore.

| Game         | Screen File                  | Max Players | Key State                                        |
| ------------ | ---------------------------- | ----------- | ------------------------------------------------ |
| Chess        | `ChessGameScreen.tsx`        | 2           | 8×8 board, piece positions, move history, timers |
| Checkers     | `CheckersGameScreen.tsx`     | 2           | 8×8 board, piece positions, king status          |
| TicTacToe    | `TicTacToeGameScreen.tsx`    | 2           | 3×3 grid, X/O placement                          |
| Connect Four | `ConnectFourGameScreen.tsx`  | 2           | 7×6 grid, disc drops                             |
| Reversi      | `ReversiGameScreen.tsx`      | 2           | 8×8 board, disc flips                            |
| Gomoku       | `GomokuMasterGameScreen.tsx` | 2           | 15×15 or 19×19 grid                              |
| Crazy Eights | `CrazyEightsGameScreen.tsx`  | 2-4         | Card hands, discard pile, suit selection         |
| War          | `WarGameScreen.tsx`          | 2           | Card decks, war pile                             |

**Persistence Pattern:**

```
Player A leaves → onDrop → allowReconnection(client, 300) → 5 min window
Player B also leaves within window → both onLeave fire → onDispose triggers
onDispose → serialize state → write to Firestore ColyseusGameState/{gameId}
Player A returns → joinById → onCreate reads Firestore → restores state
```

### Tier 3: Cooperative/Competitive Word Games (Colyseus Real-Time + Turn Hybrid)

These games need real-time presence (see what others are doing) but also have turn/phase elements.

| Game                 | Screen File                | Max Players | Key Mechanics                                   |
| -------------------- | -------------------------- | ----------- | ----------------------------------------------- |
| Crossword            | `CrosswordGameScreen.tsx`  | 2-4         | Shared grid, real-time cursor, letter placement |
| Word Master (Wordle) | `WordMasterGameScreen.tsx` | 2           | Parallel guessing, reveal sync                  |

**Sync Pattern:** Real-time state at 20fps for cursor/drawing data, plus message-based events for guesses/answers.

### Tier 4: Quick-Play / Reaction Games (Colyseus Score Racing)

Fast-paced games where both players play simultaneously and compete on score. Server synchronizes scores in real-time but doesn't run the game logic (client-authoritative with server score validation).

| Game         | Screen File                 | Max Players | Key Mechanics            |
| ------------ | --------------------------- | ----------- | ------------------------ |
| Reaction Tap | `ReactionTapGameScreen.tsx` | 2           | Reaction time comparison |
| Timed Tap    | `TimedTapGameScreen.tsx`    | 2           | Score in time limit      |
| Dot Match    | `DotMatchGameScreen.tsx`    | 2           | Pattern matching speed   |

**Sync Pattern:** Server manages timer, syncs opponent's live score. Game logic runs client-side. Anti-cheat via server-side score bounds checking.

### Tier 5: Puzzle Games (Single-Player Only — No Colyseus)

These games are inherently single-player puzzles. They stay 100% client-side with existing Firestore score recording.

| Game          | Screen File                  | Reason      |
| ------------- | ---------------------------- | ----------- |
| 2048          | `Play2048GameScreen.tsx`     | Solo puzzle |
| Minesweeper   | `MinesweeperGameScreen.tsx`  | Solo puzzle |
| Lights Out    | `LightsOutGameScreen.tsx`    | Solo puzzle |
| Memory Master | `MemoryMasterGameScreen.tsx` | Solo puzzle |
| Tile Slide    | `TileSlideGameScreen.tsx`    | Solo puzzle |
| Number Master | `NumberMasterGameScreen.tsx` | Solo puzzle |

> **Future Enhancement:** Puzzle games could optionally support **"puzzle racing"** (Tier 4 pattern) where 2 players solve the same puzzle simultaneously and race to completion. This would be a simple Colyseus room that syncs timer + completion status without sharing puzzle state.

### Summary

| Tier           | Games | Colyseus? | Server Authority           | Firestore Persist?    |
| -------------- | ----- | --------- | -------------------------- | --------------------- |
| 1: Physics     | 6     | ✅ Yes    | Full (server owns physics) | No (ephemeral)        |
| 2: Turn-Based  | 8     | ✅ Yes    | Move validation            | ✅ Yes (cold storage) |
| 3: Cooperative | 2     | ✅ Yes    | Hybrid (presence + turns)  | ✅ Yes                |
| 4: Quick-Play  | 3     | ✅ Yes    | Score validation only      | No (ephemeral)        |
| 5: Puzzle      | 6     | ❌ No     | N/A                        | Existing Firestore    |

**Total Colyseus-enabled games: 19 out of 25**

---

## 4. Server Infrastructure

### Colyseus Server Location

The Colyseus server lives as a **sibling directory** to the Expo app, sharing the same monorepo:

```
snapstyle-mvp/
├── app.config.ts              (Expo config)
├── src/                       (React Native app)
├── firebase-backend/          (Cloud Functions)
├── colyseus-server/           ← NEW
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── .env
│   ├── src/
│   │   ├── app.config.ts      (Colyseus defineServer)
│   │   ├── rooms/
│   │   │   ├── base/
│   │   │   │   ├── PhysicsRoom.ts
│   │   │   │   ├── TurnBasedRoom.ts
│   │   │   │   ├── ScoreRaceRoom.ts
│   │   │   │   └── CoopRoom.ts
│   │   │   ├── physics/
│   │   │   │   ├── PongRoom.ts
│   │   │   │   ├── BounceBlitzRoom.ts
│   │   │   │   ├── BrickBreakerRoom.ts
│   │   │   │   ├── AirHockeyRoom.ts
│   │   │   │   ├── SnakeRoom.ts
│   │   │   │   └── RaceRoom.ts
│   │   │   ├── turnbased/
│   │   │   │   ├── ChessRoom.ts
│   │   │   │   ├── CheckersRoom.ts
│   │   │   │   ├── TicTacToeRoom.ts
│   │   │   │   ├── ConnectFourRoom.ts
│   │   │   │   ├── ReversiRoom.ts
│   │   │   │   ├── GomokuRoom.ts
│   │   │   │   ├── CrazyEightsRoom.ts
│   │   │   │   └── WarRoom.ts
│   │   │   ├── coop/
│   │   │   │   ├── CrosswordRoom.ts
│   │   │   │   └── WordMasterRoom.ts
│   │   │   └── quickplay/
│   │   │       ├── ReactionRoom.ts
│   │   │       └── DotMatchRoom.ts
│   │   ├── schemas/
│   │   │   ├── common.ts          (Player, Vec2, Timer)
│   │   │   ├── physics.ts         (Ball, Paddle, PhysicsState)
│   │   │   ├── turnbased.ts       (TurnBasedState, Move)
│   │   │   ├── chess.ts           (ChessPiece, ChessBoard)
│   │   │   ├── checkers.ts
│   │   │   ├── cards.ts           (Card, Hand, Deck)
│   │   │   ├── board.ts           (GridCell, Board)
│   │   │   └── quickplay.ts       (ScoreRaceState)
│   │   ├── services/
│   │   │   ├── firebase.ts        (Admin SDK init)
│   │   │   ├── persistence.ts     (save/restore game state)
│   │   │   └── validation.ts      (move validators per game)
│   │   └── utils/
│   │       ├── physics.ts         (collision detection, vector math)
│   │       ├── elo.ts             (ELO calculation)
│   │       └── gameLogic/         (per-game logic modules)
│   │           ├── chess.ts
│   │           ├── checkers.ts
│   │           ├── tictactoe.ts
│   │           └── ...
│   └── tests/
│       ├── rooms/
│       └── schemas/
```

### Dependencies

```json
{
  "dependencies": {
    "colyseus": "^0.17.0",
    "@colyseus/schema": "^3.0.0",
    "@colyseus/command": "^0.3.0",
    "firebase-admin": "^12.0.0",
    "zod": "^3.23.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@colyseus/testing": "^0.17.0",
    "ts-node": "^10.9.0",
    "nodemon": "^3.1.0",
    "@types/node": "^22.0.0"
  }
}
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

> **Critical:** `experimentalDecorators: true` and `useDefineForClassFields: false` are **required** for `@colyseus/schema` `@type()` decorators to work with ES2022+ targets.

---

## 5. Colyseus Server Setup

### `colyseus-server/src/app.config.ts`

```typescript
import { defineServer, defineRoom } from "colyseus";

// Physics rooms
import { PongRoom } from "./rooms/physics/PongRoom";
import { BounceBlitzRoom } from "./rooms/physics/BounceBlitzRoom";
import { BrickBreakerRoom } from "./rooms/physics/BrickBreakerRoom";
import { AirHockeyRoom } from "./rooms/physics/AirHockeyRoom";
import { SnakeRoom } from "./rooms/physics/SnakeRoom";
import { RaceRoom } from "./rooms/physics/RaceRoom";

// Turn-based rooms
import { ChessRoom } from "./rooms/turnbased/ChessRoom";
import { CheckersRoom } from "./rooms/turnbased/CheckersRoom";
import { TicTacToeRoom } from "./rooms/turnbased/TicTacToeRoom";
import { ConnectFourRoom } from "./rooms/turnbased/ConnectFourRoom";
import { ReversiRoom } from "./rooms/turnbased/ReversiRoom";
import { GomokuRoom } from "./rooms/turnbased/GomokuRoom";
import { CrazyEightsRoom } from "./rooms/turnbased/CrazyEightsRoom";
import { WarRoom } from "./rooms/turnbased/WarRoom";

// Coop rooms
import { CrosswordRoom } from "./rooms/coop/CrosswordRoom";
import { WordMasterRoom } from "./rooms/coop/WordMasterRoom";

// Quick-play rooms
import { ReactionRoom } from "./rooms/quickplay/ReactionRoom";
import { DotMatchRoom } from "./rooms/quickplay/DotMatchRoom";

export default defineServer({
  rooms: {
    // Tier 1: Physics (server-authoritative, 60fps sim)
    pong: defineRoom(PongRoom),
    bounce_blitz: defineRoom(BounceBlitzRoom),
    brick_breaker: defineRoom(BrickBreakerRoom),
    air_hockey: defineRoom(AirHockeyRoom),
    snake: defineRoom(SnakeRoom),
    race: defineRoom(RaceRoom),

    // Tier 2: Turn-Based (validated moves, Firestore persistence)
    chess: defineRoom(ChessRoom),
    checkers: defineRoom(CheckersRoom),
    tic_tac_toe: defineRoom(TicTacToeRoom),
    connect_four: defineRoom(ConnectFourRoom),
    reversi: defineRoom(ReversiRoom),
    gomoku: defineRoom(GomokuRoom),
    crazy_eights: defineRoom(CrazyEightsRoom),
    war: defineRoom(WarRoom),

    // Tier 3: Cooperative
    crossword: defineRoom(CrosswordRoom),
    word_master: defineRoom(WordMasterRoom),

    // Tier 4: Quick-Play Score Race
    reaction: defineRoom(ReactionRoom),
    dot_match: defineRoom(DotMatchRoom),
  },

  options: {
    // devMode: process.env.NODE_ENV !== "production",
  },
});
```

### Environment Variables (`.env`)

```
COLYSEUS_PORT=2567
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
NODE_ENV=development
RECONNECTION_TIMEOUT_PHYSICS=30
RECONNECTION_TIMEOUT_TURNBASED=300
RECONNECTION_TIMEOUT_QUICKPLAY=15
```

---

## 6. Schema Design

### 6.1 Common Schemas (`schemas/common.ts`)

```typescript
import { Schema, type, MapSchema } from "@colyseus/schema";

export class Vec2 extends Schema {
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
}

export class Player extends Schema {
  @type("string") odid: string = ""; // Firebase UID
  @type("string") sessionId: string = "";
  @type("string") displayName: string = "";
  @type("string") avatarUrl: string = "";
  @type("boolean") connected: boolean = true;
  @type("boolean") ready: boolean = false;
  @type("int32") score: number = 0;
  @type("uint8") playerIndex: number = 0; // 0 = player1, 1 = player2, etc.
  @type("int32") eloRating: number = 1200;
}

export class GameTimer extends Schema {
  @type("float32") elapsed: number = 0;
  @type("float32") remaining: number = 0;
  @type("boolean") running: boolean = false;
}

export class BaseGameState extends Schema {
  @type("string") phase: string = "waiting"; // waiting | countdown | playing | finished
  @type("string") gameId: string = "";
  @type("string") gameType: string = "";
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("uint8") maxPlayers: number = 2;
  @type("string") winnerId: string = "";
  @type("string") winReason: string = "";
  @type(GameTimer) timer = new GameTimer();
  @type("uint32") turnNumber: number = 0;
  @type("string") currentTurnPlayerId: string = "";
  @type("boolean") isRated: boolean = true;
  @type("string") firestoreGameId: string = ""; // for persistence link
}
```

### 6.2 Physics Schemas (`schemas/physics.ts`)

```typescript
import { Schema, type, ArraySchema } from "@colyseus/schema";
import { Vec2, BaseGameState, Player } from "./common";

export class Ball extends Schema {
  @type(Vec2) position = new Vec2();
  @type(Vec2) velocity = new Vec2();
  @type("float32") radius: number = 10;
  @type("float32") speed: number = 5;
}

export class Paddle extends Schema {
  @type(Vec2) position = new Vec2();
  @type("float32") width: number = 80;
  @type("float32") height: number = 15;
  @type("string") ownerId: string = "";
}

export class PhysicsState extends BaseGameState {
  @type(Ball) ball = new Ball();
  @type({ map: Paddle }) paddles = new MapSchema<Paddle>();
  @type("uint16") fieldWidth: number = 400;
  @type("uint16") fieldHeight: number = 600;
  @type("uint8") scoreToWin: number = 7;
}

// Snake-specific extensions
export class SnakeSegment extends Schema {
  @type("int16") x: number = 0;
  @type("int16") y: number = 0;
}

export class SnakePlayer extends Player {
  @type([SnakeSegment]) segments = new ArraySchema<SnakeSegment>();
  @type("string") direction: string = "right";
  @type("boolean") alive: boolean = true;
}

export class Food extends Schema {
  @type("int16") x: number = 0;
  @type("int16") y: number = 0;
  @type("uint8") value: number = 1;
}

export class SnakeState extends BaseGameState {
  @type({ map: SnakePlayer }) snakePlayers = new MapSchema<SnakePlayer>();
  @type([Food]) food = new ArraySchema<Food>();
  @type("uint8") gridWidth: number = 20;
  @type("uint8") gridHeight: number = 20;
}
```

### 6.3 Turn-Based Schemas (`schemas/turnbased.ts`)

```typescript
import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";
import { BaseGameState, Player } from "./common";

export class GridCell extends Schema {
  @type("int8") value: number = 0; // piece type or empty
  @type("string") ownerId: string = ""; // who owns this cell
}

export class MoveRecord extends Schema {
  @type("string") playerId: string = "";
  @type("uint16") fromX: number = 0;
  @type("uint16") fromY: number = 0;
  @type("uint16") toX: number = 0;
  @type("uint16") toY: number = 0;
  @type("string") notation: string = ""; // e.g., "e2e4" for chess
  @type("float64") timestamp: number = 0;
}

export class TurnBasedState extends BaseGameState {
  @type("uint8") boardWidth: number = 8;
  @type("uint8") boardHeight: number = 8;
  @type([GridCell]) board = new ArraySchema<GridCell>();
  @type([MoveRecord]) moveHistory = new ArraySchema<MoveRecord>();
  @type("string") drawOfferedBy: string = "";
  @type("boolean") drawPending: boolean = false;
  @type("string") lastMoveNotation: string = "";

  // Chess-specific timers (split into sub-schemas if >64 props)
  @type("float32") player1TimeRemaining: number = 600;
  @type("float32") player2TimeRemaining: number = 600;
  @type("boolean") timedMode: boolean = false;
}
```

### 6.4 Card Game Schemas (`schemas/cards.ts`)

```typescript
import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";
import { BaseGameState, Player } from "./common";

export class Card extends Schema {
  @type("string") suit: string = ""; // hearts, diamonds, clubs, spades
  @type("string") rank: string = ""; // A, 2-10, J, Q, K
  @type("boolean") faceUp: boolean = false;
}

export class CardHand extends Schema {
  @type([Card]) cards = new ArraySchema<Card>();
  @type("string") ownerId: string = "";
}

export class CardGameState extends BaseGameState {
  @type({ map: CardHand }) hands = new MapSchema<CardHand>();
  @type([Card]) discardPile = new ArraySchema<Card>();
  @type([Card]) drawPile = new ArraySchema<Card>();
  @type("string") currentSuit: string = ""; // for Crazy Eights
  @type("uint8") drawCount: number = 0;
}
```

### 6.6 Quick-Play Score Race Schema (`schemas/quickplay.ts`)

```typescript
import { Schema, type, MapSchema } from "@colyseus/schema";
import { BaseGameState, Player } from "./common";

export class ScoreRacePlayer extends Player {
  @type("int32") currentScore: number = 0;
  @type("boolean") finished: boolean = false;
  @type("float32") finishTime: number = 0;
}

export class ScoreRaceState extends BaseGameState {
  @type({ map: ScoreRacePlayer }) racePlayers =
    new MapSchema<ScoreRacePlayer>();
  @type("float32") gameDuration: number = 30; // seconds
  @type("uint32") seed: number = 0; // shared RNG seed for identical challenges
}
```

---

## 7. Room Hierarchy & Design

### 7.1 Base Room: `PhysicsRoom`

The abstract base for all server-authoritative physics games.

```typescript
import { Room, Client, Delayed } from "colyseus";
import { PhysicsState } from "../schemas/physics";
import { verifyFirebaseToken, persistGameResult } from "../services/firebase";

export abstract class PhysicsRoom extends Room {
  state = new PhysicsState();
  maxClients = 2;
  patchRate = 33; // ~30fps state sync
  autoDispose = true;

  abstract initializeGame(): void;
  abstract updatePhysics(deltaTime: number): void;
  abstract handleInput(client: Client, input: any): void;

  async onAuth(client: Client, options: any, context: any) {
    const decodedToken = await verifyFirebaseToken(context.token);
    return { uid: decodedToken.uid, displayName: decodedToken.name };
  }

  onCreate(options: any) {
    this.state.gameType = this.roomName;
    this.state.maxPlayers = this.maxClients;
    this.state.phase = "waiting";

    // Start physics loop
    this.setSimulationInterval((dt) => {
      if (this.state.phase === "playing") {
        this.updatePhysics(dt);
      }
    }, 16.6); // 60fps

    this.initializeGame();
  }

  messages = {
    input: (client: Client, payload: any) => {
      this.handleInput(client, payload);
    },
    ready: (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.checkAllReady();
      }
    },
    rematch: (client: Client) => {
      // Handle rematch request
    },
  };

  onJoin(client: Client, options: any, auth: any) {
    const player = new Player();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.playerIndex = this.state.players.size;
    this.state.players.set(client.sessionId, player);

    if (this.state.players.size >= this.maxClients) {
      this.lock();
    }
  }

  onDrop(client: Client, code: number) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    this.allowReconnection(client, 30); // 30 second window for physics games
  }

  onReconnect(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
  }

  onLeave(client: Client, code: number) {
    // Player permanently left — award win to remaining player
    if (this.state.phase === "playing") {
      const remainingPlayer = Array.from(this.state.players.values()).find(
        (p) => p.sessionId !== client.sessionId,
      );
      if (remainingPlayer) {
        this.state.winnerId = remainingPlayer.uid;
        this.state.winReason = "opponent_left";
        this.state.phase = "finished";
      }
    }
    this.state.players.delete(client.sessionId);
  }

  async onDispose() {
    if (this.state.phase === "finished" && this.state.winnerId) {
      await persistGameResult(this.state);
    }
  }

  private checkAllReady() {
    const allReady = Array.from(this.state.players.values()).every(
      (p) => p.ready,
    );
    if (allReady && this.state.players.size >= 2) {
      this.startCountdown();
    }
  }

  private startCountdown() {
    this.state.phase = "countdown";
    this.clock.setTimeout(() => {
      this.state.phase = "playing";
      this.state.timer.running = true;
    }, 3000); // 3-second countdown
  }
}
```

### 7.2 Base Room: `TurnBasedRoom`

The abstract base for all turn-based games with Firestore persistence.

```typescript
import { Room, Client } from "colyseus";
import { TurnBasedState } from "../schemas/turnbased";
import {
  verifyFirebaseToken,
  saveGameState,
  loadGameState,
  persistGameResult,
} from "../services/firebase";

export abstract class TurnBasedRoom extends Room {
  state = new TurnBasedState();
  maxClients = 2;
  patchRate = 100; // 10fps sync (turns don't need fast updates)
  autoDispose = true;

  // Track Firebase UIDs for persistence
  private playerUids: Map<string, string> = new Map();
  private allPlayersLeft = false;

  abstract initializeBoard(options: any): void;
  abstract validateMove(playerId: string, move: any): boolean;
  abstract applyMove(playerId: string, move: any): void;
  abstract checkWinCondition(): {
    winner: string | null;
    reason: string;
  } | null;

  async onAuth(client: Client, options: any, context: any) {
    const decodedToken = await verifyFirebaseToken(context.token);
    return { uid: decodedToken.uid, displayName: decodedToken.name };
  }

  async onCreate(options: any) {
    this.state.gameType = this.roomName;
    this.state.maxPlayers = this.maxClients;

    // Check if restoring from Firestore
    if (options.firestoreGameId) {
      const savedState = await loadGameState(options.firestoreGameId);
      if (savedState) {
        this.restoreFromSaved(savedState);
        this.state.firestoreGameId = options.firestoreGameId;
        this.state.phase = "playing";
        return;
      }
    }

    // Fresh game
    this.state.phase = "waiting";
    this.initializeBoard(options);
  }

  messages = {
    move: (client: Client, payload: any) => {
      if (this.state.phase !== "playing") return;
      if (this.state.currentTurnPlayerId !== client.sessionId) {
        client.send("error", { message: "Not your turn" });
        return;
      }

      if (!this.validateMove(client.sessionId, payload)) {
        client.send("error", { message: "Invalid move" });
        return;
      }

      this.applyMove(client.sessionId, payload);
      this.state.turnNumber++;

      // Check win condition
      const result = this.checkWinCondition();
      if (result) {
        this.state.winnerId = result.winner || "";
        this.state.winReason = result.reason;
        this.state.phase = "finished";
        return;
      }

      // Advance turn
      this.advanceTurn();
    },

    resign: (client: Client) => {
      const opponent = this.getOpponent(client.sessionId);
      if (opponent) {
        this.state.winnerId = this.playerUids.get(opponent.sessionId) || "";
        this.state.winReason = "resignation";
        this.state.phase = "finished";
      }
    },

    offer_draw: (client: Client) => {
      this.state.drawOfferedBy = client.sessionId;
      this.state.drawPending = true;
    },

    accept_draw: (client: Client) => {
      if (
        this.state.drawPending &&
        this.state.drawOfferedBy !== client.sessionId
      ) {
        this.state.winnerId = "";
        this.state.winReason = "draw_agreed";
        this.state.phase = "finished";
      }
    },

    decline_draw: (client: Client) => {
      this.state.drawPending = false;
      this.state.drawOfferedBy = "";
    },

    ready: (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.checkAllReady();
      }
    },
  };

  onJoin(client: Client, options: any, auth: any) {
    const player = new Player();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.playerIndex = this.state.players.size;
    this.state.players.set(client.sessionId, player);
    this.playerUids.set(client.sessionId, auth.uid);

    if (this.state.players.size >= this.maxClients) {
      this.lock();
    }
  }

  onDrop(client: Client, code: number) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;

    // 5 minute reconnection window for turn-based games
    this.allowReconnection(client, 300);
  }

  onReconnect(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
  }

  onLeave(client: Client, code: number) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;

    // Check if ALL players have now left
    const anyConnected = Array.from(this.state.players.values()).some(
      (p) => p.connected,
    );

    if (!anyConnected && this.state.phase === "playing") {
      this.allPlayersLeft = true;
      // Don't delete players — we need them for restoration
    }
  }

  async onDispose() {
    if (this.state.phase === "finished") {
      // Game completed — persist final result to existing TurnBasedGames collection
      await persistGameResult(this.state);
    } else if (this.allPlayersLeft && this.state.phase === "playing") {
      // Game in progress but all players left — save state for later restoration
      await saveGameState(this.state, this.roomId);
    }
  }

  // --- Helper Methods ---

  private checkAllReady() {
    const allReady = Array.from(this.state.players.values()).every(
      (p) => p.ready,
    );
    if (allReady && this.state.players.size >= 2) {
      this.state.phase = "playing";
      const players = Array.from(this.state.players.values());
      this.state.currentTurnPlayerId = players[0].sessionId;
    }
  }

  private advanceTurn() {
    const players = Array.from(this.state.players.values());
    const currentIndex = players.findIndex(
      (p) => p.sessionId === this.state.currentTurnPlayerId,
    );
    const nextIndex = (currentIndex + 1) % players.length;
    this.state.currentTurnPlayerId = players[nextIndex].sessionId;
  }

  private getOpponent(sessionId: string) {
    return Array.from(this.state.players.values()).find(
      (p) => p.sessionId !== sessionId,
    );
  }

  protected abstract restoreFromSaved(savedState: any): void;
}
```

### 7.3 Base Room: `ScoreRaceRoom`

For quick-play competitive games where both players play simultaneously.

```typescript
import { Room, Client } from "colyseus";
import { ScoreRaceState, ScoreRacePlayer } from "../schemas/quickplay";
import { verifyFirebaseToken, persistGameResult } from "../services/firebase";

export abstract class ScoreRaceRoom extends Room {
  state = new ScoreRaceState();
  maxClients = 2;
  patchRate = 100; // 10fps sync (just scores + timer)
  autoDispose = true;

  async onAuth(client: Client, options: any, context: any) {
    const decodedToken = await verifyFirebaseToken(context.token);
    return { uid: decodedToken.uid, displayName: decodedToken.name };
  }

  onCreate(options: any) {
    this.state.gameType = this.roomName;
    this.state.gameDuration = options.duration || 30;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.state.phase = "waiting";
  }

  messages = {
    score_update: (client: Client, payload: { score: number }) => {
      if (this.state.phase !== "playing") return;
      const player = this.state.racePlayers.get(client.sessionId);
      if (player && this.validateScore(payload.score, player.currentScore)) {
        player.currentScore = payload.score;
      }
    },
    finished: (client: Client, payload: { finalScore: number }) => {
      const player = this.state.racePlayers.get(client.sessionId);
      if (player) {
        player.currentScore = payload.finalScore;
        player.finished = true;
        player.finishTime = this.state.timer.elapsed;
        this.checkAllFinished();
      }
    },
    ready: (client: Client) => {
      const player = this.state.racePlayers.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.checkAllReady();
      }
    },
  };

  // Subclasses define max score-per-second to prevent cheating
  protected abstract validateScore(
    newScore: number,
    currentScore: number,
  ): boolean;

  onJoin(client: Client, options: any, auth: any) {
    const player = new ScoreRacePlayer();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.playerIndex = this.state.racePlayers.size;
    this.state.racePlayers.set(client.sessionId, player);
    this.state.players.set(client.sessionId, player);

    if (this.state.racePlayers.size >= this.maxClients) {
      this.lock();
    }
  }

  onDrop(client: Client, code: number) {
    const player = this.state.racePlayers.get(client.sessionId);
    if (player) player.connected = false;
    this.allowReconnection(client, 15); // Short window for fast games
  }

  onReconnect(client: Client) {
    const player = this.state.racePlayers.get(client.sessionId);
    if (player) player.connected = true;
  }

  onLeave(client: Client) {
    const player = this.state.racePlayers.get(client.sessionId);
    if (player) {
      player.finished = true;
      this.checkAllFinished();
    }
  }

  async onDispose() {
    if (this.state.phase === "finished") {
      await persistGameResult(this.state);
    }
  }

  private checkAllReady() {
    const allReady = Array.from(this.state.racePlayers.values()).every(
      (p) => p.ready,
    );
    if (allReady && this.state.racePlayers.size >= 2) {
      this.startCountdown();
    }
  }

  private startCountdown() {
    this.state.phase = "countdown";
    this.clock.setTimeout(() => {
      this.state.phase = "playing";
      this.state.timer.running = true;

      // Game timer
      this.setSimulationInterval((dt) => {
        this.state.timer.elapsed += dt;
        this.state.timer.remaining = Math.max(
          0,
          this.state.gameDuration * 1000 - this.state.timer.elapsed,
        );
        if (this.state.timer.remaining <= 0) {
          this.endGame();
        }
      }, 100); // 10fps timer updates
    }, 3000);
  }

  private checkAllFinished() {
    const allFinished = Array.from(this.state.racePlayers.values()).every(
      (p) => p.finished,
    );
    if (allFinished) this.endGame();
  }

  private endGame() {
    this.state.phase = "finished";
    const players = Array.from(this.state.racePlayers.values());
    const sorted = [...players].sort((a, b) => b.currentScore - a.currentScore);
    if (sorted.length > 0) {
      this.state.winnerId = sorted[0].uid;
      this.state.winReason = "highest_score";
    }
  }
}
```

---

## 8. Client SDK Integration

### 8.1 Colyseus Service (`src/services/colyseus.ts`)

```typescript
import { Client, Room } from "@colyseus/sdk";
import { getAuth } from "firebase/auth";
import { Platform } from "react-native";
import { COLYSEUS_SERVER_URL } from "../config/colyseus";

class ColyseusService {
  private client: Client;
  private activeRoom: Room | null = null;

  constructor() {
    this.client = new Client(COLYSEUS_SERVER_URL);
  }

  private async getAuthToken(): Promise<string> {
    const user = getAuth().currentUser;
    if (!user) throw new Error("Not authenticated");
    return user.getIdToken();
  }

  /**
   * Join or create a new game room for real-time play.
   * Used when starting a new match via invite or matchmaking.
   */
  async joinOrCreate(
    roomName: string,
    options: Record<string, any> = {},
  ): Promise<Room> {
    const token = await this.getAuthToken();
    const room = await this.client.joinOrCreate(roomName, options, {
      token,
    });
    this.activeRoom = room;
    this.setupReconnectionHandlers(room);
    return room;
  }

  /**
   * Join a specific room by ID.
   * Used when accepting an invite or restoring a suspended game.
   */
  async joinById(
    roomId: string,
    options: Record<string, any> = {},
  ): Promise<Room> {
    const token = await this.getAuthToken();
    const room = await this.client.joinById(roomId, options, {
      token,
    });
    this.activeRoom = room;
    this.setupReconnectionHandlers(room);
    return room;
  }

  /**
   * Restore a suspended turn-based game from Firestore.
   * Creates a new Colyseus room but pre-loads saved state.
   */
  async restoreGame(roomName: string, firestoreGameId: string): Promise<Room> {
    return this.joinOrCreate(roomName, { firestoreGameId });
  }

  /**
   * Leave the current room gracefully.
   */
  async leaveRoom(): Promise<void> {
    if (this.activeRoom) {
      await this.activeRoom.leave();
      this.activeRoom = null;
    }
  }

  /**
   * Get the current active room.
   */
  getActiveRoom(): Room | null {
    return this.activeRoom;
  }

  /**
   * Measure latency to the server.
   */
  async getLatency(): Promise<number> {
    return this.client.getLatency({ pingCount: 3 });
  }

  private setupReconnectionHandlers(room: Room) {
    // Configure reconnection for mobile
    room.reconnection.maxRetries = 20;
    room.reconnection.maxDelay = 8000;
    room.reconnection.minUptime = 3000;
    room.reconnection.maxEnqueuedMessages = 15;

    room.onDrop((code, reason) => {
      console.log(`[Colyseus] Connection dropped: ${code} - ${reason}`);
      // UI overlay shown via state listener on player.connected
    });

    room.onReconnect(() => {
      console.log("[Colyseus] Reconnected successfully");
    });

    room.onLeave((code) => {
      console.log(`[Colyseus] Left room: ${code}`);
      this.activeRoom = null;
    });

    room.onError((code, message) => {
      console.error(`[Colyseus] Room error: ${code} - ${message}`);
    });
  }
}

export const colyseusService = new ColyseusService();
```

### 8.2 Colyseus Config (`src/config/colyseus.ts`)

```typescript
import { Platform } from "react-native";

// Development: localhost
// Production: your deployed Colyseus server URL
const DEV_URL = Platform.select({
  android: "ws://10.0.2.2:2567", // Android emulator → host machine
  ios: "ws://localhost:2567",
  default: "ws://localhost:2567",
});

const PROD_URL = "wss://games.yourdomain.com";

export const COLYSEUS_SERVER_URL = __DEV__ ? DEV_URL : PROD_URL;
```

### 8.3 React Hook: `useColyseus` (`src/hooks/useColyseus.ts`)

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { Room } from "@colyseus/sdk";
import { Callbacks } from "@colyseus/sdk";
import { colyseusService } from "../services/colyseus";

interface UseColyseusOptions {
  roomName: string;
  options?: Record<string, any>;
  firestoreGameId?: string; // For restoring suspended games
  autoJoin?: boolean;
}

interface UseColyseusReturn {
  room: Room | null;
  state: any;
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
  sendMessage: (type: string, payload?: any) => void;
  joinRoom: () => Promise<void>;
  leaveRoom: () => Promise<void>;
  latency: number | null;
}

export function useColyseus({
  roomName,
  options = {},
  firestoreGameId,
  autoJoin = true,
}: UseColyseusOptions): UseColyseusReturn {
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const roomRef = useRef<Room | null>(null);

  const joinRoom = useCallback(async () => {
    try {
      setError(null);
      let newRoom: Room;

      if (firestoreGameId) {
        newRoom = await colyseusService.restoreGame(roomName, firestoreGameId);
      } else {
        newRoom = await colyseusService.joinOrCreate(roomName, options);
      }

      roomRef.current = newRoom;
      setRoom(newRoom);
      setConnected(true);

      // Listen to full state changes
      newRoom.onStateChange((newState) => {
        setState({ ...newState }); // Trigger re-render
      });

      newRoom.onDrop(() => {
        setReconnecting(true);
      });

      newRoom.onReconnect(() => {
        setReconnecting(false);
        setConnected(true);
      });

      newRoom.onLeave((code) => {
        setConnected(false);
        setReconnecting(false);
        roomRef.current = null;
        setRoom(null);
      });

      newRoom.onError((code, message) => {
        setError(`Error ${code}: ${message}`);
      });

      // Measure latency
      newRoom.ping((ms) => setLatency(ms));
    } catch (err: any) {
      setError(err.message || "Failed to join room");
    }
  }, [roomName, options, firestoreGameId]);

  const leaveRoom = useCallback(async () => {
    await colyseusService.leaveRoom();
    setRoom(null);
    setConnected(false);
    setState(null);
  }, []);

  const sendMessage = useCallback((type: string, payload?: any) => {
    if (roomRef.current) {
      roomRef.current.send(type, payload);
    }
  }, []);

  useEffect(() => {
    if (autoJoin) {
      joinRoom();
    }
    return () => {
      // Cleanup on unmount
      if (roomRef.current) {
        roomRef.current.leave();
      }
    };
  }, []);

  return {
    room,
    state,
    connected,
    reconnecting,
    error,
    sendMessage,
    joinRoom,
    leaveRoom,
    latency,
  };
}
```

### 8.4 State Sync Callbacks Hook (`src/hooks/useColyseusCallbacks.ts`)

```typescript
import { useEffect, useRef } from "react";
import { Room, Callbacks } from "@colyseus/sdk";

/**
 * Register fine-grained state sync callbacks on a Colyseus room.
 * This avoids full state re-renders and is more performant.
 */
export function useColyseusCallbacks(
  room: Room | null,
  registerCallbacks: (
    callbacks: ReturnType<typeof Callbacks.get>,
  ) => (() => void)[],
) {
  const unbindRefs = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!room) return;

    const callbacks = Callbacks.get(room);
    unbindRefs.current = registerCallbacks(callbacks);

    return () => {
      unbindRefs.current.forEach((unbind) => unbind());
      unbindRefs.current = [];
    };
  }, [room]);
}
```

---

## 9. Firestore Persistence Layer

### Purpose

Turn-based games must survive **both players leaving**. When that happens, the Colyseus room serializes its state to Firestore. When either player returns, a new room is created and pre-loaded with the saved state.

### 9.1 Persistence Service (`colyseus-server/src/services/persistence.ts`)

```typescript
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, cert } from "firebase-admin/app";

// Initialize Firebase Admin (once)
const app = initializeApp({
  credential: cert(require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH!)),
});
const db = getFirestore(app);

/**
 * Save a turn-based game's full state to Firestore for later restoration.
 * Called from TurnBasedRoom.onDispose() when all players have left mid-game.
 */
export async function saveGameState(
  state: any,
  roomId: string,
): Promise<string> {
  const gameId = state.firestoreGameId || roomId;

  const serializedState = {
    gameType: state.gameType,
    phase: state.phase,
    turnNumber: state.turnNumber,
    currentTurnPlayerId: state.currentTurnPlayerId,
    isRated: state.isRated,

    // Board state
    boardWidth: state.boardWidth,
    boardHeight: state.boardHeight,
    board: Array.from(state.board).map((cell: any) => ({
      value: cell.value,
      ownerId: cell.ownerId,
    })),

    // Players
    players: Object.fromEntries(
      Array.from(state.players.entries()).map(([key, p]: [string, any]) => [
        key,
        {
          uid: p.uid,
          displayName: p.displayName,
          score: p.score,
          playerIndex: p.playerIndex,
          eloRating: p.eloRating,
        },
      ]),
    ),

    // Move history
    moveHistory: Array.from(state.moveHistory).map((m: any) => ({
      playerId: m.playerId,
      fromX: m.fromX,
      fromY: m.fromY,
      toX: m.toX,
      toY: m.toY,
      notation: m.notation,
      timestamp: m.timestamp,
    })),

    // Timers (for chess, etc.)
    player1TimeRemaining: state.player1TimeRemaining,
    player2TimeRemaining: state.player2TimeRemaining,
    timedMode: state.timedMode,

    // Metadata
    savedAt: FieldValue.serverTimestamp(),
    lastRoomId: roomId,
    status: "suspended",
  };

  await db
    .collection("ColyseusGameState")
    .doc(gameId)
    .set(serializedState, { merge: true });

  // Also update existing TurnBasedGames document if linked
  if (state.firestoreGameId) {
    await db
      .collection("TurnBasedGames")
      .doc(state.firestoreGameId)
      .update({
        status: "suspended",
        suspendedAt: FieldValue.serverTimestamp(),
        colyseusStateRef: `ColyseusGameState/${gameId}`,
      });
  }

  return gameId;
}

/**
 * Load a suspended game state from Firestore.
 * Called from TurnBasedRoom.onCreate() when firestoreGameId is provided.
 */
export async function loadGameState(gameId: string): Promise<any | null> {
  const doc = await db.collection("ColyseusGameState").doc(gameId).get();
  if (!doc.exists) return null;

  const data = doc.data()!;
  if (data.status !== "suspended") return null;

  // Mark as resumed
  await db.collection("ColyseusGameState").doc(gameId).update({
    status: "active",
    resumedAt: FieldValue.serverTimestamp(),
  });

  return data;
}

/**
 * Persist final game result to existing Firestore collections.
 * Called from any room's onDispose() when game is finished.
 */
export async function persistGameResult(state: any): Promise<void> {
  const players = Array.from(state.players.values());

  const gameRecord = {
    gameType: state.gameType,
    players: players.map((p: any) => ({
      odid: p.uid,
      displayName: p.displayName,
      score: p.score,
      playerIndex: p.playerIndex,
    })),
    winnerId: state.winnerId,
    winReason: state.winReason,
    turnCount: state.turnNumber,
    isRated: state.isRated,
    completedAt: FieldValue.serverTimestamp(),
    source: "colyseus", // Distinguish from legacy Firestore-only games
  };

  // Write to existing TurnBasedGames or RealtimeGameSessions
  if (state.firestoreGameId) {
    await db
      .collection("TurnBasedGames")
      .doc(state.firestoreGameId)
      .update({
        ...gameRecord,
        status: "completed",
      });
  } else {
    await db.collection("RealtimeGameSessions").add(gameRecord);
  }

  // Clean up suspended state if any
  const stateRef = db
    .collection("ColyseusGameState")
    .doc(state.gameId || state.firestoreGameId);
  const stateDoc = await stateRef.get();
  if (stateDoc.exists) {
    await stateRef.delete();
  }
}
```

### 9.2 Firestore Security Rules Addition

```
// Add to firebase-backend/firestore.rules
match /ColyseusGameState/{gameId} {
  // Only the Colyseus server (via Admin SDK) writes here
  // Clients can read their own games
  allow read: if request.auth != null &&
    request.auth.uid in resource.data.players;
  allow write: if false; // Admin SDK bypasses rules
}

match /RealtimeGameSessions/{sessionId} {
  allow read: if request.auth != null;
  allow write: if false; // Only Colyseus server writes
}
```

### 9.3 State Restoration Flow (Detailed)

```
┌──────────────────────────────────────────────────────────────┐
│  SAVE FLOW (both players leave mid-game)                     │
│                                                              │
│  1. Player A drops → onDrop → allowReconnection(300s)       │
│  2. Player A times out → onLeave (connected=false)          │
│  3. Player B drops → onDrop → allowReconnection(300s)       │
│  4. Player B times out → onLeave (connected=false)          │
│  5. No clients remaining → autoDispose triggers             │
│  6. onDispose() detects allPlayersLeft && phase=="playing"  │
│  7. saveGameState() → serializes to ColyseusGameState/      │
│  8. Updates TurnBasedGames/ doc status → "suspended"        │
│  9. Room is disposed from memory                            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  RESTORE FLOW (player returns to suspended game)             │
│                                                              │
│  1. Player opens game → ActiveGamesList shows "suspended"   │
│  2. Player taps game → navigates to game screen             │
│  3. Game screen calls colyseusService.restoreGame(          │
│       roomName, firestoreGameId)                            │
│  4. → joinOrCreate(roomName, {firestoreGameId})             │
│  5. Server creates new room → onCreate receives options     │
│  6. onCreate detects firestoreGameId → loadGameState()      │
│  7. Loads from ColyseusGameState/ → restoreFromSaved()      │
│  8. Room state populated → phase set to "playing"           │
│  9. Player A joins → onJoin → matched to restored player   │
│  10. Room waits for Player B to join                        │
│  11. Player B opens game → joinById(roomId)                 │
│  12. Both players connected → game resumes                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Reconnection & Mobile Handling

### Mobile-Specific Challenges

React Native apps face unique reconnection scenarios:

- **App backgrounded** (user switches apps) — OS may kill the WebSocket
- **Network switch** (WiFi → cellular) — connection drops briefly
- **Lock screen** — iOS suspends JS after ~30 seconds
- **Poor signal** — intermittent connectivity

### Reconnection Strategy by Game Tier

| Tier                     | Timeout      | Behavior on Timeout               |
| ------------------------ | ------------ | --------------------------------- |
| Physics (Pong, etc.)     | 30s          | Opponent wins by forfeit          |
| Turn-Based (Chess, etc.) | 300s (5 min) | If BOTH leave → save to Firestore |
| Coop (Crossword)         | 60s          | Player removed from session       |
| Quick-Play (Tap, etc.)   | 15s          | Player gets score of 0            |

### Client-Side AppState Handling

```typescript
// src/hooks/useColyseusAppState.ts
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { Room } from "@colyseus/sdk";

export function useColyseusAppState(room: Room | null) {
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!room) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          // App came to foreground — reconnection is handled
          // automatically by Colyseus SDK if onDrop is configured
          console.log("[Colyseus] App returned to foreground");
        }

        if (nextAppState === "background") {
          // App going to background — send a "pause" message
          // so server knows player isn't actively playing
          room.send("app_state", { state: "background" });
        }

        appStateRef.current = nextAppState;
      },
    );

    return () => subscription.remove();
  }, [room]);
}
```

### Reconnecting UI Overlay

```typescript
// Add to game screens when reconnecting state is true
{reconnecting && (
  <View style={styles.reconnectingOverlay}>
    <ActivityIndicator size="large" color="#fff" />
    <Text style={styles.reconnectingText}>Reconnecting...</Text>
  </View>
)}
```

---

## 11. Matchmaking & Invites

### 11.1 Integration with Existing Invite System

The app already has a robust invite system (`src/services/gameInvites.ts`) that writes to `GameInvites/` in Firestore. **This system stays intact.** The change is what happens _after_ an invite is accepted:

**Current Flow:**

```
Invite accepted → Cloud Function creates TurnBasedGames/ doc → Both players open
game → Each listens to onSnapshot on TurnBasedGames doc → Moves written to Firestore
```

**New Flow (Colyseus-enabled games):**

```
Invite accepted → Cloud Function creates TurnBasedGames/ doc + stores roomConfig →
Player A opens game → calls colyseusService.joinOrCreate(gameType, {gameId}) →
Colyseus room created → Player A joins → Player B opens game →
joinById(colyseus roomId) → Both connected via WebSocket → Real-time play
```

### 11.2 Friend Invite via Colyseus

```typescript
// src/services/colyseusMatchmaking.ts

import { colyseusService } from "./colyseus";
import { firestore } from "../config/firebase";

/**
 * Create a private room for a friend invite.
 * Returns the Colyseus roomId for the friend to join.
 */
export async function createInviteRoom(
  gameType: string,
  inviteeUid: string,
  options: Record<string, any> = {},
): Promise<{ roomId: string; gameId: string }> {
  // 1. Create the Colyseus room
  const room = await colyseusService.joinOrCreate(gameType, {
    ...options,
    private: true,
    inviteeUid,
  });

  // 2. Create a GameInvite doc in Firestore (existing system)
  const inviteRef = await firestore.collection("GameInvites").add({
    type: "universal",
    gameType,
    hostUid: auth.currentUser!.uid,
    inviteeUid,
    colyseusRoomId: room.roomId, // NEW FIELD
    status: "pending",
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  return {
    roomId: room.roomId,
    gameId: inviteRef.id,
  };
}

/**
 * Accept an invite and join the Colyseus room.
 */
export async function acceptInviteRoom(inviteId: string): Promise<Room> {
  const inviteDoc = await firestore
    .collection("GameInvites")
    .doc(inviteId)
    .get();
  const invite = inviteDoc.data();

  if (!invite?.colyseusRoomId) {
    throw new Error("No Colyseus room associated with this invite");
  }

  // Join the existing room by ID
  const room = await colyseusService.joinById(invite.colyseusRoomId);

  // Update invite status
  await firestore.collection("GameInvites").doc(inviteId).update({
    status: "accepted",
    acceptedAt: firestore.FieldValue.serverTimestamp(),
  });

  return room;
}
```

### 11.3 ELO Matchmaking via Colyseus Server

The existing `processMatchmakingQueue` Cloud Function runs every minute. We enhance it to create Colyseus rooms instead of just Firestore documents:

```typescript
// In Cloud Function: after matching two players
const colyseusRoom = await fetch(`${COLYSEUS_SERVER_URL}/matchmaker/create`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${INTERNAL_API_KEY}`,
  },
  body: JSON.stringify({
    roomName: gameType,
    options: {
      player1Uid: match.player1.uid,
      player2Uid: match.player2.uid,
      isRated: match.isRated,
    },
  }),
});

// Store roomId in both matchmaking queue entries
await db.collection("MatchmakingQueue").doc(match.player1Id).update({
  colyseusRoomId: colyseusRoom.roomId,
  status: "matched",
});
await db.collection("MatchmakingQueue").doc(match.player2Id).update({
  colyseusRoomId: colyseusRoom.roomId,
  status: "matched",
});
```

---

## 12. Authentication Bridge

### Firebase Auth → Colyseus `onAuth`

The Colyseus server verifies Firebase ID tokens to authenticate players:

```typescript
// colyseus-server/src/services/firebase.ts
import { getAuth } from "firebase-admin/auth";

export async function verifyFirebaseToken(token: string) {
  if (!token) throw new Error("No auth token provided");

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    throw new Error("Invalid auth token");
  }
}
```

**Client sends token via SDK:**

```typescript
// The @colyseus/sdk sends the token in the handshake context
const room = await client.joinOrCreate("chess", options, {
  token: await getAuth().currentUser.getIdToken(),
});
```

**Server validates in `onAuth`:**

```typescript
async onAuth(client: Client, options: any, context: any) {
  const decoded = await verifyFirebaseToken(context.token);
  return {
    uid: decoded.uid,
    displayName: decoded.name || decoded.email || "Player",
    photoURL: decoded.picture || "",
  };
}
```

---

## 13. Game-by-Game Migration Plan

### Priority Order

Games are migrated in order of impact and complexity:

### Phase 1: Quick-Play Games (Simplest — Score Race Pattern)

| Priority | Game         | Room Type    | Complexity | Estimated Effort |
| -------- | ------------ | ------------ | ---------- | ---------------- |
| 1.1      | Reaction Tap | ReactionRoom | Low        | 1 day            |
| 1.2      | Timed Tap    | TimedTapRoom | Low        | 0.5 day          |
| 1.3      | Dot Match    | DotMatchRoom | Low        | 1 day            |

**What changes per game:**

- Create Colyseus room class (extends `ScoreRaceRoom`)
- Define score validation bounds
- Add `useColyseus` hook to game screen
- Show opponent's live score
- Add "waiting for opponent" + "countdown" phases
- Add rematch flow

### Phase 2: Simple Turn-Based Games (TicTacToe, Connect Four, Gomoku, Hex)

| Priority | Game         | Room Type       | Complexity | Estimated Effort |
| -------- | ------------ | --------------- | ---------- | ---------------- |
| 2.1      | Tic Tac Toe  | TicTacToeRoom   | Low        | 1.5 days         |
| 2.2      | Connect Four | ConnectFourRoom | Low        | 1.5 days         |
| 2.3      | Gomoku       | GomokuRoom      | Low        | 1.5 days         |
| 2.4      | Reversi      | ReversiRoom     | Medium     | 2 days           |

**What changes per game:**

- Create Colyseus room (extends `TurnBasedRoom`)
- Implement `validateMove()`, `applyMove()`, `checkWinCondition()`
- Implement `initializeBoard()` and `restoreFromSaved()`
- Replace Firestore `onSnapshot` with Colyseus state sync
- Add Firestore persistence in `onDispose`
- Test save/restore cycle

### Phase 3: Complex Turn-Based Games (Chess, Checkers, Cards, Words)

| Priority | Game         | Room Type       | Complexity | Estimated Effort |
| -------- | ------------ | --------------- | ---------- | ---------------- |
| 3.1      | Checkers     | CheckersRoom    | Medium     | 3 days           |
| 3.2      | Crazy Eights | CrazyEightsRoom | Medium     | 3 days           |
| 3.3      | War          | WarRoom         | Medium     | 2 days           |
| 3.4      | Chess        | ChessRoom       | High       | 5 days           |

**Additional complexity:**

- Chess: FEN notation, castling, en passant, promotion, check/checkmate detection, optional timers
- Crazy Eights: Deck shuffling, suit selection, draw rules
- All: More complex `restoreFromSaved()` implementations

### Phase 4: Physics / Real-Time Games

| Priority | Game          | Room Type        | Complexity | Estimated Effort |
| -------- | ------------- | ---------------- | ---------- | ---------------- |
| 4.1      | Pong          | PongRoom         | Medium     | 3 days           |
| 4.2      | Air Hockey    | AirHockeyRoom    | Medium     | 3 days           |
| 4.3      | Bounce Blitz  | BounceBlitzRoom  | Medium     | 3 days           |
| 4.4      | Brick Breaker | BrickBreakerRoom | High       | 4 days           |
| 4.5      | Snake         | SnakeRoom        | High       | 4 days           |
| 4.6      | Race          | RaceRoom         | Very High  | 5 days           |

**Additional complexity:**

- Server-side physics simulation (collision detection, velocity, acceleration)
- Client-side prediction + interpolation for smooth rendering
- Input buffering with server reconciliation
- Tick-rate optimization (60fps sim, 30fps sync)
- Latency compensation

### Phase 5: Cooperative / Creative Games

| Priority | Game        | Room Type      | Complexity | Estimated Effort |
| -------- | ----------- | -------------- | ---------- | ---------------- |
| 5.1      | Word Master | WordMasterRoom | Medium     | 3 days           |
| 5.2      | Crossword   | CrosswordRoom  | High       | 5 days           |

**Additional complexity:**

- Crossword: Shared grid with cursor positions, letter placement validation, completion detection
- Word Master: Parallel play with synchronized reveals

### Total Estimated Effort

| Phase                       | Games  | Days         |
| --------------------------- | ------ | ------------ |
| Infrastructure Setup        | —      | 5 days       |
| Phase 1: Quick-Play         | 3      | 2.5 days     |
| Phase 2: Simple Turn-Based  | 4      | 6.5 days     |
| Phase 3: Complex Turn-Based | 4      | 13 days      |
| Phase 4: Physics            | 6      | 22 days      |
| Phase 5: Cooperative        | 2      | 8 days       |
| Testing & Polish            | —      | 10 days      |
| **TOTAL**                   | **19** | **~67 days** |

---

## 14. Testing Strategy

### 14.1 Unit Tests (`colyseus-server/tests/`)

Using `@colyseus/testing`:

```typescript
import { ColyseusTestServer, boot } from "@colyseus/testing";
import appConfig from "../src/app.config";

describe("ChessRoom", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("should create a room and accept 2 players", async () => {
    const room = await colyseus.createRoom("chess");
    const client1 = await colyseus.connectTo(room);
    const client2 = await colyseus.connectTo(room);

    expect(room.state.players.size).toBe(2);
  });

  it("should validate moves correctly", async () => {
    const room = await colyseus.createRoom("chess");
    const client1 = await colyseus.connectTo(room);
    const client2 = await colyseus.connectTo(room);

    // Send ready
    client1.send("ready");
    client2.send("ready");

    await room.waitForNextPatch();

    // Valid pawn move
    client1.send("move", { fromX: 4, fromY: 6, toX: 4, toY: 4 });
    await room.waitForNextPatch();

    expect(room.state.turnNumber).toBe(1);
  });

  it("should persist state when both players leave", async () => {
    const room = await colyseus.createRoom("chess");
    const client1 = await colyseus.connectTo(room);
    const client2 = await colyseus.connectTo(room);

    // Play a few moves...
    client1.send("ready");
    client2.send("ready");
    await room.waitForNextPatch();

    // Both players leave
    client1.leave();
    client2.leave();

    await room.waitForDispose();

    // Verify Firestore has saved state
    // (mock Firebase Admin SDK in tests)
  });
});
```

### 14.2 Integration Tests

```typescript
// __tests__/integration/colyseusMultiplayer.test.ts
describe("Colyseus Multiplayer Integration", () => {
  it("should handle invite → join → play → complete flow");
  it("should handle disconnect → reconnect during physics game");
  it("should save/restore turn-based game via Firestore");
  it("should handle matchmaking → room creation → gameplay");
  it("should sync scores in real-time for quick-play games");
});
```

### 14.3 Load Tests

Using `@colyseus/loadtest`:

```typescript
import { Client } from "@colyseus/sdk";

async function main() {
  const client = new Client("ws://localhost:2567");

  // Simulate 100 concurrent rooms
  const promises = [];
  for (let i = 0; i < 200; i++) {
    promises.push(
      client.joinOrCreate("timed_tap").then((room) => {
        room.send("ready");
        // Simulate score updates
        setInterval(() => {
          room.send("score_update", { score: Math.random() * 100 });
        }, 100);
      }),
    );
  }

  await Promise.all(promises);
}
```

---

## 15. Deployment & DevOps

### 15.1 Docker Configuration

```dockerfile
# colyseus-server/Dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY serviceAccountKey.json ./

ENV NODE_ENV=production
ENV COLYSEUS_PORT=2567

EXPOSE 2567

CMD ["node", "dist/app.config.js"]
```

### 15.2 Nginx Reverse Proxy (with WebSocket upgrade)

```nginx
upstream colyseus {
    server 127.0.0.1:2567;
}

server {
    listen 443 ssl;
    server_name games.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://colyseus;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;     # 24 hours for long-lived WS
    }
}
```

### 15.3 Deployment Options

| Option                | Pros                                           | Cons              | Cost |
| --------------------- | ---------------------------------------------- | ----------------- | ---- |
| **Colyseus Cloud**    | Zero-ops, managed scaling, built-in monitoring | Vendor lock-in    | $$   |
| **Vultr VPS**         | Pre-configured Colyseus image, good price      | Manual scaling    | $    |
| **AWS ECS + Fargate** | Auto-scaling, Docker-native                    | Complex setup     | $$   |
| **Railway / Render**  | Simple deploy from Git, WebSocket support      | Limited control   | $    |
| **Self-hosted VPS**   | Full control, cheapest                         | Manual everything | $    |

**Recommended for MVP:** Start with a single **Vultr** or **Railway** instance. Graduate to **Colyseus Cloud** or **AWS ECS** when you need horizontal scaling.

### 15.4 PM2 Process Manager (for VPS)

```json
{
  "apps": [
    {
      "name": "colyseus-server",
      "script": "dist/app.config.js",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "production",
        "COLYSEUS_PORT": 2567
      },
      "max_memory_restart": "500M",
      "watch": false,
      "autorestart": true
    }
  ]
}
```

---

## 16. Performance Considerations

### 16.1 Schema Optimization

- **Max 64 properties per Schema class** — split large states into sub-schemas
- Use **smallest possible numeric types**: `uint8` (0-255) for grid indices, `int16` for coordinates, `float32` for positions
- Use **ArraySchema** for ordered data (board cells, move history), **MapSchema** for keyed data (players)
- Avoid storing unnecessary data in synchronized state — use `client.userData` for server-only data

### 16.2 Network Optimization

| Setting                 | Physics Games  | Turn-Based    | Quick-Play    |
| ----------------------- | -------------- | ------------- | ------------- |
| `patchRate`             | 33ms (30fps)   | 100ms (10fps) | 100ms (10fps) |
| `setSimulationInterval` | 16.6ms (60fps) | None          | 100ms (timer) |
| `maxMessagesPerSecond`  | 60             | 10            | 30            |

### 16.3 Client-Side Interpolation

For physics games, the client should interpolate between server state snapshots:

```typescript
// Linear interpolation between last two server states
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// In game render loop:
const interpolatedX = lerp(
  previousState.ball.x,
  currentState.ball.x,
  interpolationFactor,
);
```

### 16.4 Memory Management

- Each Colyseus room uses ~1-5MB RAM depending on state size
- A single server can handle **~500-1000 concurrent rooms** with 2 players each
- Turn-based rooms with no simulation use minimal CPU
- Physics rooms at 60fps use ~0.5% CPU per room

---

## 17. Rollout Phases

### Phase 0: Infrastructure (Week 1-2)

- [ ] Set up `colyseus-server/` directory with TypeScript config
- [ ] Install Colyseus v0.17 + Firebase Admin SDK
- [ ] Create base room classes (PhysicsRoom, TurnBasedRoom, ScoreRaceRoom)
- [ ] Create common schemas (Player, Vec2, Timer, BaseGameState)
- [ ] Set up Firebase Admin authentication bridge
- [ ] Create `src/services/colyseus.ts` client service
- [ ] Create `src/hooks/useColyseus.ts` React hook
- [ ] Create `src/config/colyseus.ts` configuration
- [ ] Add `COLYSEUS_ENABLED` feature flag
- [ ] Set up Docker + deployment pipeline
- [ ] Write base room unit tests

### Phase 1: Quick-Play Pilot (Week 3-4)

- [ ] Implement ReactionRoom (simplest score-race game)
- [ ] Integrate Reaction Tap game screen with useColyseus
- [ ] Add "Multiplayer" toggle to Reaction Tap game
- [ ] Test reconnection, score sync, rematch flow
- [ ] Roll out remaining 2 quick-play games
- [ ] Feature flag: `COLYSEUS_QUICKPLAY_ENABLED`

### Phase 2: Simple Turn-Based (Week 5-6)

- [ ] Implement TicTacToeRoom with full move validation
- [ ] Implement Firestore save/restore cycle
- [ ] Test both-players-leave → Firestore → restore flow
- [ ] Roll out Connect Four, Gomoku, Reversi
- [ ] Feature flag: `COLYSEUS_TURNBASED_ENABLED`

### Phase 3: Complex Turn-Based (Week 7-10)

- [ ] Implement ChessRoom (FEN, castling, en passant, timers)
- [ ] Implement CheckersRoom (king promotion, mandatory jumps)
- [ ] Implement CrazyEightsRoom (deck, draw, suit selection)
- [ ] Implement WarRoom (deck, war pile)
- [ ] Feature flag: `COLYSEUS_COMPLEX_TURNBASED_ENABLED`

### Phase 4: Physics Games (Week 11-14)

- [ ] Implement PongRoom with server-authoritative physics
- [ ] Add client-side prediction + interpolation
- [ ] Implement AirHockeyRoom, BounceBlitzRoom
- [ ] Implement BrickBreakerRoom (co-op or competitive)
- [ ] Implement SnakeRoom (multi-snake, grid collision)
- [ ] Implement RaceRoom (vehicle physics, track)
- [ ] Feature flag: `COLYSEUS_PHYSICS_ENABLED`

### Phase 5: Cooperative Games (Week 15-16)

- [ ] Implement WordMasterRoom (parallel Wordle)
- [ ] Implement CrosswordRoom (shared grid, cursors)
- [ ] Feature flag: `COLYSEUS_COOP_ENABLED`

### Phase 6: Polish & Migration (Week 17-18)

- [ ] Migrate invite system to include Colyseus room IDs
- [ ] Migrate matchmaking Cloud Function to create Colyseus rooms
- [ ] Update ActiveGamesList to show Colyseus games
- [ ] Update GameHistory to include real-time game records
- [ ] Performance testing + load testing
- [ ] Deprecate Firestore-only multiplayer path (behind flag)

---

## 18. Risk Assessment

| Risk                                           | Likelihood | Impact | Mitigation                                                             |
| ---------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------- |
| WebSocket blocked by corporate/school networks | Medium     | High   | Fallback to long-polling transport; detect & warn user                 |
| Colyseus server downtime                       | Medium     | High   | Health checks, auto-restart via PM2, Firestore fallback for turn-based |
| State desync between client and server         | Medium     | Medium | Server-authoritative design; client always renders server state        |
| Firebase ID token expiry during long game      | Low        | Medium | Refresh token before expiry (tokens last 1 hour); re-auth on reconnect |
| Memory leak from undisposed rooms              | Low        | High   | `autoDispose = true`; monitoring panel; scheduled cleanup              |
| High latency for distant players               | Medium     | Medium | Multi-region deployment or region selection; latency indicator in UI   |
| Schema migration breaking existing games       | Low        | High   | Schema versioning; backward-compatible changes only                    |
| Dual system confusion (Firestore + Colyseus)   | Medium     | Medium | Feature flags per game tier; gradual migration; clear code separation  |

### Fallback Strategy

If a Colyseus room fails to create or the server is unreachable:

1. **Turn-based games** fall back to existing Firestore `onSnapshot` path (already works)
2. **Quick-play games** fall back to single-player mode (already works)
3. **Physics games** fall back to single-player or vs-AI mode
4. Client detects server unavailability via `getLatency()` timeout and shows appropriate UI

---

## Appendix A: NPM Packages Required

### Colyseus Server

```
colyseus@^0.17.0
@colyseus/schema@^3.0.0
@colyseus/command@^0.3.0
@colyseus/testing@^0.17.0
firebase-admin@^12.0.0
zod@^3.23.0
dotenv@^16.4.0
```

### React Native Client

```
@colyseus/sdk@^0.17.0
```

### Existing (no changes needed)

```
firebase (already installed)
react-native (WebSocket supported natively)
```

## Appendix B: New Firestore Collections

| Collection                   | Purpose                                                | TTL                       |
| ---------------------------- | ------------------------------------------------------ | ------------------------- |
| `ColyseusGameState/{gameId}` | Cold-stored room state for suspended turn-based games  | Until restored or 30 days |
| `RealtimeGameSessions/{id}`  | Completed real-time game records (physics, quick-play) | 180 days (match existing) |

## Appendix C: New Feature Flags

```typescript
// Add to constants/featureFlags.ts
export const COLYSEUS_FLAGS = {
  COLYSEUS_ENABLED: false, // Master kill switch
  COLYSEUS_QUICKPLAY_ENABLED: false, // Tier 4 games
  COLYSEUS_TURNBASED_ENABLED: false, // Tier 2 games
  COLYSEUS_COMPLEX_TURNBASED_ENABLED: false, // Tier 3 games
  COLYSEUS_PHYSICS_ENABLED: false, // Tier 1 games
  COLYSEUS_COOP_ENABLED: false, // Tier 3 coop games
  COLYSEUS_MATCHMAKING_ENABLED: false, // Server-side matchmaking
};
```

## Appendix D: Message Protocol Reference

### Client → Server Messages

| Message Type     | Payload                               | Used By          |
| ---------------- | ------------------------------------- | ---------------- |
| `"ready"`        | `{}`                                  | All rooms        |
| `"input"`        | `{ direction, action }`               | Physics rooms    |
| `"move"`         | `{ fromX, fromY, toX, toY, ... }`     | Turn-based rooms |
| `"score_update"` | `{ score: number }`                   | Quick-play rooms |
| `"finished"`     | `{ finalScore: number }`              | Quick-play rooms |
| `"resign"`       | `{}`                                  | Turn-based rooms |
| `"offer_draw"`   | `{}`                                  | Turn-based rooms |
| `"accept_draw"`  | `{}`                                  | Turn-based rooms |
| `"decline_draw"` | `{}`                                  | Turn-based rooms |
| `"rematch"`      | `{}`                                  | All rooms        |
| `"app_state"`    | `{ state: "background" \| "active" }` | All rooms        |
| `"letter"`       | `{ x, y, letter }`                    | Crossword room   |
| `"cursor"`       | `{ x, y }`                            | Crossword room   |

### Server → Client Messages

| Message Type              | Payload                       | Used By   |
| ------------------------- | ----------------------------- | --------- |
| `"welcome"`               | `{ sessionId, playerIndex }`  | All rooms |
| `"countdown"`             | `{ seconds: number }`         | All rooms |
| `"error"`                 | `{ message: string }`         | All rooms |
| `"game_over"`             | `{ winnerId, reason, stats }` | All rooms |
| `"rematch_request"`       | `{ fromSessionId }`           | All rooms |
| `"opponent_reconnecting"` | `{ sessionId }`               | All rooms |
| `"opponent_reconnected"`  | `{ sessionId }`               | All rooms |

---

_This plan provides a complete roadmap for integrating Colyseus v0.17 into the SnapStyle game suite. Each phase is independently deployable behind feature flags, allowing gradual rollout with zero disruption to existing gameplay._
