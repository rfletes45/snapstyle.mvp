# SnapStyle Game System — Complete Reference

> **Purpose**: This document is the single source of truth for how the SnapStyle game system works. It is designed so that any developer or AI assistant (Claude) can read it and fully understand how to implement, modify, or integrate games.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Game Type Classification](#2-game-type-classification)
3. [Colyseus Server Architecture](#3-colyseus-server-architecture)
4. [Room Base Classes (Server)](#4-room-base-classes-server)
5. [Colyseus Schemas (State Sync)](#5-colyseus-schemas-state-sync)
6. [Client-Side Hooks](#6-client-side-hooks)
7. [Game Invite System](#7-game-invite-system)
8. [Spectator System](#8-spectator-system)
9. [Save & Persistence Behavior](#9-save--persistence-behavior)
10. [Exit & Back Navigation](#10-exit--back-navigation)
11. [Game Lifecycle (End-to-End)](#11-game-lifecycle-end-to-end)
12. [Feature Flags](#12-feature-flags)
13. [Firestore Collections](#13-firestore-collections)
14. [File Map — Where Everything Lives](#14-file-map--where-everything-lives)
15. [How to Add a New Game](#15-how-to-add-a-new-game)

---

## 1. Architecture Overview

The game system is a **React Native (Expo) mobile client** communicating with a **Colyseus v0.17 WebSocket game server** and **Firebase/Firestore** for persistence, auth, and invites.

```
┌──────────────────┐       WebSocket        ┌──────────────────────┐
│   React Native   │ ◄──────────────────►   │  Colyseus Server     │
│   (Expo client)  │    (real-time state)    │  (Node.js + Express) │
└────────┬─────────┘                         └──────────┬───────────┘
         │                                              │
         │  Firestore SDK                               │  Firebase Admin SDK
         ▼                                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Firebase / Firestore                        │
│  - Auth (ID tokens)                                              │
│  - GameInvites collection                                        │
│  - TurnBasedGames collection                                     │
│  - ColyseusGameState collection (suspended games)                │
│  - RealtimeGameSessions collection (completed game records)      │
│  - GameSessions collection (single-player score records)         │
└──────────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**

- **Server-authoritative**: Colyseus server validates all moves and runs physics. Clients are renderers.
- **Firebase Auth**: Every Colyseus room requires a Firebase ID token for `onAuth`.
- **Firestore for persistence**: Invites, suspended games, and completed match records live in Firestore.
- **Colyseus for real-time**: All multiplayer gameplay uses Colyseus WebSocket rooms.
- **Feature flags**: Every game category can be independently toggled on/off.

---

## 2. Game Type Classification

All games are defined in `src/types/games.ts` via the `ExtendedGameType` union.

### 2.1 Single-Player Games (`SinglePlayerGameType`)

These run entirely on the client. No Colyseus room is created unless the player enables spectating or multiplayer score-race mode.

| Game Type             | Name          | Category   |
| --------------------- | ------------- | ---------- |
| `bounce_blitz`        | Bounce Blitz  | quick_play |
| `play_2048`           | 2048          | puzzle     |
| `word_master`         | Word Master   | daily      |
| `reaction_tap`        | Reaction Tap  | quick_play |
| `timed_tap`           | Timed Tap     | quick_play |
| `brick_breaker`       | Brick Breaker | quick_play |
| `minesweeper_classic` | Minesweeper   | puzzle     |
| `lights_out`          | Lights Out    | puzzle     |
| `pong_game`           | Pong (vs AI)  | quick_play |

**Note:** Some single-player games (reaction_tap, timed_tap, brick_breaker, bounce_blitz) support a **Score Race** multiplayer mode via Colyseus. In this mode both players play simultaneously and compete on score.

### 2.2 Turn-Based Multiplayer Games (`TurnBasedGameType`)

Players alternate turns. Server validates every move.

| Game Type       | Name           | Players | Board     |
| --------------- | -------------- | ------- | --------- |
| `chess`         | Chess          | 2       | 8×8       |
| `checkers`      | Checkers       | 2       | 8×8       |
| `crazy_eights`  | Crazy Eights   | 2–4     | Card game |
| `tic_tac_toe`   | Tic-Tac-Toe    | 2       | 3×3       |
| `connect_four`  | Connect Four   | 2       | 7×6       |
| `dot_match`     | Dots and Boxes | 2       | 4×4       |
| `gomoku_master` | Gomoku         | 2       | 15×15     |
| `reversi_game`  | Reversi        | 2       | 8×8       |

### 2.3 Real-Time Multiplayer Games (`RealTimeGameType`)

Server-authoritative physics or cooperative play.

| Game Type          | Name             | Room Type    | Players |
| ------------------ | ---------------- | ------------ | ------- |
| `8ball_pool`       | 8-Ball Pool      | Physics      | 2       |
| `air_hockey`       | Air Hockey       | Physics      | 2       |
| `crossword_puzzle` | Crossword        | Coop         | 1       |
| `golf_duels`       | Golf Duels       | Physics      | 2       |
| `tropical_fishing` | Tropical Fishing | Physics/Coop | 2–10    |
| `starforge_game`   | Starforge        | Incremental  | 1–2     |

### 2.4 Game Categories (UI Grouping)

Games appear in the GamesHub (`GamesHubScreen.tsx`) organized by these categories defined in `src/config/gameCategories.ts`:

| Category      | Label       | Filter Logic                              |
| ------------- | ----------- | ----------------------------------------- |
| `action`      | Action      | `quick_play` category AND not multiplayer |
| `puzzle`      | Puzzle      | `puzzle` category AND not multiplayer     |
| `multiplayer` | Multiplayer | `isMultiplayer === true`                  |
| `daily`       | Daily       | `daily` category                          |

### 2.5 Game Metadata Registry

`GAME_METADATA` in `src/types/games.ts` is the **source of truth** for all game metadata:

```typescript
interface GameMetadata {
  id: ExtendedGameType;
  name: string;
  shortName: string;
  description: string;
  icon: string; // Emoji
  category: GameCategory; // "quick_play" | "puzzle" | "multiplayer" | "daily"
  minPlayers: number;
  maxPlayers: number;
  isMultiplayer: boolean;
  hasLeaderboard: boolean;
  hasAchievements: boolean;
  isAvailable: boolean; // Feature flag for rollout
  comingSoon?: boolean;
  isNew?: boolean; // Shows "NEW" badge
}
```

### 2.6 Navigation Screen Map

`GAME_SCREEN_MAP` in `src/config/gameCategories.ts` maps each `ExtendedGameType` to its React Navigation screen name:

```typescript
const GAME_SCREEN_MAP: Record<ExtendedGameType, string> = {
  reaction_tap: "ReactionTapGame",
  chess: "ChessGame",
  // etc.
};
```

---

## 3. Colyseus Server Architecture

### 3.1 Server Entry Point

File: `colyseus-server/src/app.config.ts`

The server uses Colyseus v0.17's `defineServer` / `defineRoom` / `listen` API.

Every room is registered with `.filterBy(["firestoreGameId"])`. This is critical: when two players both call `joinOrCreate` with the same `firestoreGameId`, Colyseus routes them to the **same room** instead of creating duplicates. This is how the invite system works — both players receive the same `firestoreGameId` from the invite and end up in the same Colyseus room.

```typescript
rooms: {
  // Quick-Play
  reaction: defineRoom(ReactionRoom).filterBy(["firestoreGameId"]),
  timed_tap: defineRoom(TimedTapRoom).filterBy(["firestoreGameId"]),

  // Turn-Based
  chess: defineRoom(ChessRoom).filterBy(["firestoreGameId"]),
  checkers: defineRoom(CheckersRoom).filterBy(["firestoreGameId"]),

  // Physics
  pong: defineRoom(PongRoom).filterBy(["firestoreGameId"]),
  air_hockey: defineRoom(AirHockeyRoom).filterBy(["firestoreGameId"]),

  // Spectator (no filterBy — unique per host)
  spectator: defineRoom(SpectatorRoom),
}
```

### 3.2 Room Name Mapping

File: `src/config/colyseus.ts`

The client maps game types to Colyseus room names:

```typescript
const COLYSEUS_ROOM_NAMES: Record<string, string> = {
  chess_game: "chess", // Client uses "chess_game", server registers "chess"
  pong_game: "pong",
  brick_breaker_game: "brick_breaker",
  // ...
};
```

**Convention:** Client game types often have a `_game` suffix (e.g., `chess_game`). The Colyseus room name strips this suffix. Both formats are mapped.

### 3.3 Authentication

Every room's `onAuth` verifies the Firebase ID token:

```typescript
async onAuth(client, options, context): Promise<any> {
  const decoded = await verifyFirebaseToken(context?.token || options?.token);
  return { uid: decoded.uid, displayName: decoded.name, avatarUrl: decoded.picture };
}
```

The client sends the token via `colyseusService.joinOrCreate()`:

```typescript
const token = await getAuth().currentUser.getIdToken();
const room = await client.joinOrCreate(roomName, { ...options, token });
```

---

## 4. Room Base Classes (Server)

All game rooms extend one of four abstract base classes in `colyseus-server/src/rooms/base/`.

### 4.1 TurnBasedRoom

**File:** `colyseus-server/src/rooms/base/TurnBasedRoom.ts`  
**Used by:** Chess, Checkers, TicTacToe, ConnectFour, Gomoku, Reversi, CrazyEights

**Lifecycle:**

1. Players join → phase = `"waiting"`
2. Both players send `"ready"` → phase = `"countdown"` (3 seconds)
3. Countdown expires → phase = `"playing"` (player 0 goes first)
4. Players alternate `"move"` messages → server validates → applies → checks win → advances turn
5. Win/draw/resign → phase = `"finished"`
6. On dispose: if finished → `persistGameResult()`; if playing (abandoned) → `saveGameState()`

**Key Messages (client → server):**
| Message | Purpose |
|---------|---------|
| `ready` | Signal ready to start |
| `move` | Submit a move `{ row, col, toRow?, toCol?, extra? }` |
| `resign` | Forfeit the game |
| `offer_draw` | Offer a draw to opponent |
| `accept_draw` / `decline_draw` | Respond to draw offer |
| `rematch` | Request rematch |
| `rematch_accept` | Accept rematch (resets board) |

**Subclass Requirements:**

```typescript
abstract readonly gameTypeKey: string;
abstract readonly defaultBoardWidth: number;
abstract readonly defaultBoardHeight: number;
abstract initializeBoard(options: Record<string, any>): void;
abstract validateMove(sessionId: string, move: MovePayload): boolean;
abstract applyMove(sessionId: string, move: MovePayload): void;
abstract checkWinCondition(): WinResult | null;
// Optional overrides:
serializeExtraState(): Record<string, any>;
restoreExtraState(saved: Record<string, any>): void;
```

**Save/Restore (Async Play):**

- When all players leave mid-game, `onDispose()` calls `saveGameState()` → writes full board + player state to `ColyseusGameState/{gameId}` in Firestore.
- When either player returns, they navigate to the game screen with the same `firestoreGameId`. The room's `onCreate()` calls `loadGameState()` to restore the board and player positions.
- Players are re-mapped by Firebase UID (not session ID, which changes each connection).

### 4.2 ScoreRaceRoom

**File:** `colyseus-server/src/rooms/base/ScoreRaceRoom.ts`  
**Used by:** ReactionRoom, TimedTapRoom, DotMatchRoom

**Lifecycle:**

1. Players join → phase = `"waiting"`
2. Both send `"ready"` → phase = `"countdown"` (3 seconds)
3. Countdown expires → phase = `"playing"` (timer starts)
4. Game duration expires OR both players finish → phase = `"finished"`
5. Winner = highest score (or lowest for reaction time)

**Key Messages:**
| Message | Purpose |
|---------|---------|
| `ready` | Signal ready |
| `score_update` | Report current score `{ score: number }` |
| `combo_update` | Report combo streak `{ combo: number }` |
| `lose_life` | Report life lost |
| `finished` | Signal local game over `{ finalScore: number }` |
| `rematch` / `rematch_accept` | Rematch flow |

**Subclass Requirements:**

```typescript
abstract readonly gameTypeKey: string;
abstract readonly defaultDuration: number;  // Game length in seconds
abstract readonly maxLives: number;         // -1 = unlimited
abstract readonly lowerIsBetter: boolean;   // true for reaction time
```

### 4.3 PhysicsRoom

**File:** `colyseus-server/src/rooms/base/PhysicsRoom.ts`  
**Used by:** PongRoom, AirHockeyRoom, BounceBlitzRoom, BrickBreakerRoom, GolfDuelsRoom, TropicalFishingRoom

**Lifecycle:**

1. Players join → phase = `"waiting"`
2. Both send `"ready"` → phase = `"countdown"` (3 seconds)
3. Countdown expires → phase = `"playing"` (physics loop starts at ~60fps)
4. Score limit or timeout → phase = `"finished"`

**Key Messages:**
| Message | Purpose |
|---------|---------|
| `ready` | Signal ready |
| `input` | Send paddle/cursor position `{ x?, y?, action? }` |
| `rematch` / `rematch_accept` | Rematch flow |

**Physics Loop:**

```typescript
this.setSimulationInterval((dt) => {
  this.updatePhysics(dt); // Subclass implements
}, 16.6); // ~60fps
```

State sync: `patchRate = 33` (patches sent ~30fps to clients).

**Subclass Requirements:**

```typescript
abstract readonly gameTypeKey: string;
abstract readonly scoreToWin: number;   // 0 = time-based only
abstract readonly gameDuration: number; // 0 = score-only
abstract initializeGame(): void;
abstract updatePhysics(deltaTime: number): void;
abstract handleInput(client: Client, input: InputPayload): void;
abstract resetAfterScore(): void;
```

### 4.4 CardGameRoom

**File:** `colyseus-server/src/rooms/base/CardGameRoom.ts`  
**Used by:** CrazyEightsRoom

A specialized turn-based room for card games with hands, draw piles, and discard piles.

### 4.5 SpectatorRoom (Standalone)

**File:** `colyseus-server/src/rooms/spectator/SpectatorRoom.ts`

Not a base class — a standalone room for single-player game spectating. See [Section 8](#8-spectator-system).

---

## 5. Colyseus Schemas (State Sync)

Schemas define the synchronized state structure. Colyseus patches deltas automatically.

### 5.1 Common Schemas (`colyseus-server/src/schemas/common.ts`)

```typescript
class Player extends Schema {
  uid: string; // Firebase UID
  sessionId: string; // Colyseus session ID
  displayName: string;
  avatarUrl: string;
  connected: boolean;
  ready: boolean;
  score: number;
  playerIndex: number; // 0 or 1
  eloRating: number;
}

class BaseGameState extends Schema {
  phase: string; // "waiting" | "countdown" | "playing" | "finished"
  gameId: string;
  gameType: string;
  players: MapSchema<Player>;
  maxPlayers: number;
  winnerId: string; // Firebase UID of winner ("" = no winner/draw)
  winReason: string;
  countdown: number;
  turnNumber: number;
  currentTurnPlayerId: string; // Session ID of whose turn it is
  isRated: boolean;
  seed: number; // Shared random seed
  firestoreGameId: string;
  spectators: MapSchema<SpectatorEntry>;
  spectatorCount: number;
}
```

### 5.2 Turn-Based Schemas (`colyseus-server/src/schemas/turnbased.ts`)

```typescript
class GridCell extends Schema {
  value: number;
  ownerId: string;
}
class MoveRecord extends Schema {
  playerId;
  x;
  y;
  toX;
  toY;
  notation;
  timestamp;
  playerIndex;
}
class TurnBasedPlayer extends Player {
  piece;
  timeRemainingMs;
  offeredDraw;
  capturedPieces;
}

class TurnBasedState extends BaseGameState {
  tbPlayers: MapSchema<TurnBasedPlayer>;
  boardWidth: number;
  boardHeight: number;
  board: ArraySchema<GridCell>; // Flat row-major: board[row * width + col]
  moveHistory: ArraySchema<MoveRecord>;
  drawPending: boolean;
  drawOfferedBy: string;
  lastMoveNotation: string;
}
```

### 5.3 Quick-Play Schemas (`colyseus-server/src/schemas/quickplay.ts`)

```typescript
class ScoreRacePlayer extends Player {
  currentScore;
  combo;
  lives;
  finished;
  finishTime;
}
class ScoreRaceState extends BaseGameState {
  racePlayers: MapSchema<ScoreRacePlayer>;
  gameDuration: number;
  difficulty: number;
  timer: GameTimer;
}
```

### 5.4 Physics Schemas (`colyseus-server/src/schemas/physics.ts`)

```typescript
class PhysicsPlayer extends Player {
  finished;
  combo;
}
class Ball extends Schema {
  x;
  y;
  vx;
  vy;
  radius;
  active;
}
class Paddle extends Schema {
  x;
  y;
  width;
  height;
  ownerId;
}
class PhysicsState extends BaseGameState {
  paddles: MapSchema<Paddle>;
  balls: ArraySchema<Ball>;
  fieldWidth;
  fieldHeight;
  elapsed;
  remaining;
  timerRunning;
}
```

### 5.5 Spectator Schemas (`colyseus-server/src/schemas/spectator.ts`)

```typescript
class SpectatorEntry extends Schema {
  uid;
  sessionId;
  displayName;
  avatarUrl;
  joinedAt;
}

class SpectatorRoomState extends Schema {
  gameType: string;
  hostId: string;
  hostName: string;
  phase: string; // "waiting" | "active" | "finished"
  currentScore: number;
  currentLevel: number;
  lives: number;
  gameStateJson: string; // Full game state as JSON (host pushes this)
  spectators: MapSchema<SpectatorEntry>;
  spectatorCount: number;
  sessionMode: string; // "spectate" | "boost" | "expedition"
  boostSessionEndsAt: number;
}
```

---

## 6. Client-Side Hooks

### 6.1 `useMultiplayerGame` — Quick-Play Score Race

**File:** `src/hooks/useMultiplayerGame.ts`

For single-player games that also support multiplayer score-race mode (reaction_tap, timed_tap, bounce_blitz, brick_breaker, etc.).

**Usage Pattern:**

```typescript
const mp = useMultiplayerGame({
  gameType: "brick_breaker_game",
  firestoreGameId,
});

// Check availability
mp.isAvailable; // true if Colyseus feature flags are on
mp.isMultiplayer; // true if currently in a multiplayer session

// Start multiplayer
await mp.startMultiplayer(); // or mp.startMultiplayer({ roomId: "xxx" })

// During gameplay
mp.reportScore(currentScore);
mp.reportLifeLost();
mp.reportFinished();

// Read state
mp.phase; // "waiting" | "countdown" | "playing" | "finished"
mp.opponentScore;
mp.opponentName;
mp.isWinner;
mp.countdown;
mp.seed; // Shared random seed for deterministic level generation
```

### 6.2 `useTurnBasedGame` — Turn-Based Games

**File:** `src/hooks/useTurnBasedGame.ts`

For chess, checkers, tic-tac-toe, connect-four, gomoku, reversi, dots, crazy-eights.

**Usage Pattern:**

```typescript
const tb = useTurnBasedGame("chess_game");

// Start multiplayer
await tb.startMultiplayer();
// Or restore a saved game:
await tb.restoreGame(firestoreGameId);
// Or join as spectator:
await tb.startMultiplayer({ spectator: true, roomId: "xxx" });

// During gameplay
tb.board; // number[] — flat board: board[row * boardWidth + col]
tb.boardWidth;
tb.boardHeight;
tb.isMyTurn;
tb.currentPlayerIndex;
tb.myPlayerIndex;
tb.turnNumber;
tb.moveHistory;

// Send a move
tb.sendMove({ row: 3, col: 4 }); // Simple grid games
tb.sendMove({ row: 1, col: 4, toRow: 3, toCol: 4 }); // Chess-style movement

// Game actions
tb.resign();
tb.offerDraw();
tb.acceptDraw();
tb.declineDraw();
tb.requestRematch();
```

### 6.3 `useGameConnection` — Transport Resolver

**File:** `src/hooks/useGameConnection.ts`

Determines whether a game opened from an invite should use Colyseus or Firestore:

```typescript
const { resolvedMode, firestoreGameId } = useGameConnection(
  "chess_game",
  route.params?.matchId,
);
// resolvedMode: "colyseus" | "online" | null
```

### 6.4 `useSpectator` — Spectating Hook

**File:** `src/hooks/useSpectator.ts`

Three modes:

1. **`multiplayer-spectator`**: Joins existing game room with `{ spectator: true }`
2. **`sp-host`**: Creates a SpectatorRoom, pushes game state updates
3. **`sp-spectator`**: Joins a SpectatorRoom to watch

See [Section 8](#8-spectator-system) for details.

### 6.5 `useGameBackHandler` — Exit/Back Logic

**File:** `src/hooks/useGameBackHandler.ts`

Handles back button (Android hardware + iOS swipe + header button):

- **Daily games** (word_master): Leaves immediately (progress auto-saved).
- **Game already over**: Leaves immediately.
- **In-progress non-daily game**: Shows confirmation: "Your current game will not be saved."
- Navigates to GamesHub on exit.

### 6.6 `useGameNavigation` — Smart Exit Navigation

**File:** `src/hooks/useGameNavigation.ts`

Handles where to navigate after leaving a game:

- If game has a `conversationId` (from invite) and `entryPoint === "chat"` → navigate to chat
- Otherwise → navigate to GamesHub (Play screen)

### 6.7 `useGameCompletion` — Post-Game Recording

**File:** `src/hooks/useGameCompletion.ts`

Records game results, personal bests, and achievement triggers after a game ends.

### 6.8 `useColyseus` / `useColyseusAppState`

Low-level hooks for Colyseus connection management and app state (background/foreground) handling.

---

## 7. Game Invite System

### 7.1 Overview

File: `src/services/gameInvites.ts`

There are **two** invite systems:

1. **Legacy Game Invites** (`sendGameInvite`, `acceptGameInvite`, `declineGameInvite`) — Direct 1:1 invites stored in `GameInvites` collection.
2. **Universal Game Invites** (`sendUniversalInvite`, `claimInviteSlot`, `startGameEarly`) — Slot-based system supporting DM and group contexts.

**The Universal system is the primary system.** It supports:

- DM invites (2-player, specific target)
- Group invites (2–10 players, anyone in the group can join)
- Slot claiming with atomic Firestore transactions
- Host controls (start early, cancel)

### 7.2 Universal Invite Flow

```
1. SENDER creates invite → Firestore: GameInvites/{inviteId}
   - Status: "pending"
   - claimedSlots: [{ sender as host }]
   - eligibleUserIds: [sender, recipient(s)]

2. RECIPIENT sees invite in chat or Play page
   - Calls claimInviteSlot() → adds to claimedSlots
   - Status transitions: "pending" → "filling" → "ready"

3. When requiredPlayers slots are filled (or host starts early):
   - startGameEarly() creates the actual match
   - For turn-based: calls createMatch() → Firestore: TurnBasedGames/{gameId}
   - For real-time/external: creates a session ID
   - Status: "active", gameId is set

4. Players navigate to game screen with matchId = gameId
   - Both players call useMultiplayerGame or useTurnBasedGame
   - Hook calls colyseusService.joinOrCreate(gameType, { firestoreGameId })
   - Colyseus filterBy(["firestoreGameId"]) routes both to SAME room
```

### 7.3 Invite Statuses

| Status      | Meaning                       |
| ----------- | ----------------------------- |
| `pending`   | Waiting for players to join   |
| `filling`   | Some but not all slots filled |
| `ready`     | All required players joined   |
| `active`    | Game has started              |
| `completed` | Game finished                 |
| `expired`   | Invite timed out              |
| `cancelled` | Host cancelled                |
| `declined`  | Recipient declined (legacy)   |

### 7.4 Key Functions

```typescript
// Send invite
sendUniversalInvite({ senderId, senderName, gameType, context: "dm" | "group", ... });

// Join an invite
claimInviteSlot(inviteId, userId, userName, userAvatar?);

// Leave before game starts
unclaimInviteSlot(inviteId, userId);

// Host starts the game
startGameEarly(inviteId, hostId);

// Host cancels
cancelUniversalInvite(inviteId, hostId);

// Subscribe to invites for the Play page
subscribeToPlayPageInvites(userId, callback);
```

### 7.5 Invite → Colyseus Room Connection

The critical bridge between invites and Colyseus:

1. Invite's `gameId` is set when the game starts (via `startGameEarly` or auto-fill)
2. All players navigate to the game screen with `matchId` = that `gameId`
3. Game screen hook calls `colyseusService.joinOrCreate(gameType, { firestoreGameId: gameId })`
4. Server's `filterBy(["firestoreGameId"])` ensures both players join the same room
5. No Colyseus room is pre-created at invite time — rooms are created on-demand

### 7.6 Invite UI Components

- `UniversalInviteCard` — Renders invite with player slots, join/start buttons
- `GameInviteBadge` — Shows pending invite count badge
- `GamePickerModal` — Modal to select game type when sending invite
- `MatchmakingModal` — Shows matchmaking progress

---

## 8. Spectator System

### 8.1 Two Spectating Modes

**A. Multiplayer Game Spectating**  
Spectator joins the _same Colyseus room_ as the players, with `{ spectator: true }`.

- All room base classes (TurnBasedRoom, ScoreRaceRoom, PhysicsRoom) track spectators in `state.spectators` and `state.spectatorCount`.
- Spectator session IDs are tracked in `spectatorSessionIds` Set.
- All game actions (move, score_update, input, etc.) check `isSpectator()` and reject if true.
- Spectators receive the same state patches as players automatically.

**B. Single-Player Game Spectating**  
Uses a dedicated `SpectatorRoom`. The host (player) creates the room and pushes state snapshots.

### 8.2 SpectatorRoom Lifecycle

1. Host creates room: `colyseusService.createSpectatorRoom(gameType)` → roomId returned
2. Host sends invite to friends: `sendSpectatorInvite(senderId, friendUid, { roomId, gameType, ... })`
3. Host starts broadcasting: sends `"start_hosting"` message → phase = `"active"`
4. Host periodically sends `"state_update"` with `{ gameStateJson, currentScore, currentLevel, lives }`
5. Spectators join: `colyseusService.joinSpectatorRoom(roomId)` → receive state patches
6. Host sends `"game_end"` when game is over → phase = `"finished"`
7. Room auto-disposes when all clients leave

### 8.3 Spectator Invites

Spectator invites are sent as chat messages (DM or group):

```typescript
// DM spectator invite
sendSpectatorInvite(senderId, friendUid, {
  roomId,
  gameType,
  hostName,
  currentScore,
});

// Group spectator invite
sendGroupSpectatorInvite(senderId, groupId, { roomId, gameType, hostName });
```

These are stored as `kind: "scorecard"` messages with a `type: "spectator_invite"` field inside the JSON content. The chat bubble renders a "Watch Live" button.

When the game ends, `updateAllSpectatorInvites()` updates the message to show final results.

### 8.4 Helper/Boost System

The SpectatorRoom supports interactive spectating:

- Host can start a **boost session**: `"boost_session_start"` → `boostSessionEndsAt` is set
- Spectators can send `"helper_boost"` actions (tap boost, ore rain) — forwarded to host
- Each spectator has **energy** (max 6) that depletes on helper actions
- Spectators can send `"cheer"` reactions (emoji reactions)

### 8.5 Spectator UI Components

- `SpectatorOverlay` — Shows spectator count and list
- `SpectatorBanner` — "X people watching" indicator
- `SpectatorViewScreen` — Full spectator experience (for sp-spectator mode)
- `spectator-renderers/` — Game-specific spectator renderers (e.g., `GolfDuelsSpectatorRenderer.tsx`)

---

## 9. Save & Persistence Behavior

### 9.1 Turn-Based Games — Firestore Save/Restore

**When all players leave a game in progress:**

```
TurnBasedRoom.onDispose()
  → saveGameState(state, roomId, extraFields)
  → Firestore: ColyseusGameState/{gameId} = {
      board, boardWidth, boardHeight,
      currentTurnUid, playersByUid,
      moveHistory, gameType, phase: "playing",
      status: "suspended", savedAt: timestamp,
      ...gameSpecificFields
    }
  → Also updates TurnBasedGames/{firestoreGameId}.status = "suspended"
```

**When a player returns:**

```
Player navigates to game screen with firestoreGameId
  → Hook calls colyseusService.joinOrCreate(gameType, { firestoreGameId })
  → New room created → TurnBasedRoom.onCreate({ firestoreGameId })
    → loadGameState(firestoreGameId) from Firestore
    → restoreFromSaved(savedData) — rebuilds board, players, move history
    → phase immediately set to "playing" (no waiting/countdown)
  → Player joins → onJoin re-maps by UID to their saved slot
```

### 9.2 Completed Games

When a game finishes (phase = `"finished"`):

```
Room.onDispose()
  → persistGameResult(state, gameDurationMs)
  → If firestoreGameId exists:
      Updates TurnBasedGames/{firestoreGameId}.status = "completed"
  → Else:
      Creates RealtimeGameSessions/{auto-id} = { gameType, players, winnerId, ... }
  → Deletes ColyseusGameState/{gameId} if it exists (cleanup)
```

### 9.3 Single-Player Sessions

File: `src/services/singlePlayerSessions.ts`

Single-player game results are recorded to `GameSessions` collection:

```typescript
recordGameSession(playerId, {
  gameId,
  score,
  duration,
  tapCount,
  reactionTime,
});
```

### 9.4 Daily Game Persistence

File: `src/services/dailyGamePersistence.ts`

Daily games (word_master, crossword_puzzle) save progress locally so the player can resume.

### 9.5 Reconnection

All rooms support reconnection:

- **TurnBasedRoom**: 30-second window via `allowReconnection(client, 30)`
- **ScoreRaceRoom**: 15-second window (configurable via `RECONNECTION_TIMEOUT_QUICKPLAY` env var)
- **PhysicsRoom**: 15-second window (configurable via `RECONNECTION_TIMEOUT_PHYSICS` env var)
- **SpectatorRoom**: 30-second window for the host only

On reconnection, the player's `.connected` flag is restored to `true` and opponents are notified via `"opponent_reconnected"` broadcast.

---

## 10. Exit & Back Navigation

### 10.1 `useGameBackHandler`

Intercepts:

- Android hardware back button (`BackHandler`)
- iOS swipe-back (`beforeRemove` listener)
- Header back button (`beforeRemove` listener)

Behavior:
| Condition | Action |
|-----------|--------|
| Game is over (`isGameOver = true`) | Navigate immediately to GamesHub |
| Daily game (word_master) | Navigate immediately (progress auto-saved) |
| In-progress non-daily game | Show Alert: "Leave Game? Your current game will not be saved." |
| User confirms leave | Call `onBeforeLeave()` then navigate to GamesHub |

### 10.2 `useGameNavigation`

After leaving:

- If `entryPoint === "play"` → navigate to GamesHub
- If `entryPoint === "chat"` and has `conversationId` → navigate to chat
- If has `conversationId` (no explicit entry point) → navigate to chat
- Default → navigate to GamesHub

### 10.3 Multiplayer Leave Behavior

When a player leaves a multiplayer game:

| Room Type | Leave During Play | Effect                                                        |
| --------- | ----------------- | ------------------------------------------------------------- |
| TurnBased | Disconnects       | 30s reconnection window; if timeout → game saved to Firestore |
| TurnBased | All leave         | Game saved to Firestore for async resume                      |
| ScoreRace | Disconnects       | 15s reconnection window; if timeout → player marked finished  |
| Physics   | Disconnects       | 15s reconnection window; if timeout → opponent wins           |
| Physics   | Leaves            | Opponent wins by "opponent_left"                              |

---

## 11. Game Lifecycle (End-to-End)

### 11.1 Starting a Multiplayer Game from Invite

```
1. Alice opens GamePickerModal → selects "Chess" → chooses Bob
2. sendUniversalInvite({ gameType: "chess", context: "dm", recipientId: bobId })
   → Creates GameInvites/{inviteId} with status "pending"
3. Bob sees invite card in chat (UniversalInviteCard)
4. Bob taps "Join" → claimInviteSlot(inviteId, bobId, "Bob")
   → Status becomes "ready" (2/2 slots filled)
5. Either player taps "Start" → startGameEarly(inviteId, hostId)
   → Creates TurnBasedGames/{gameId} via createMatch()
   → Invite status becomes "active", gameId is set
6. Both players' UI navigates to ChessGameScreen with matchId = gameId
7. ChessGameScreen:
   - useGameConnection("chess_game", matchId) → resolvedMode = "colyseus"
   - useTurnBasedGame("chess_game").startMultiplayer({ firestoreGameId: matchId })
   - → colyseusService.joinOrCreate("chess_game", { firestoreGameId: matchId })
   - → Both join same Colyseus room (filterBy matching)
8. Room auto-starts: both players auto-ready → countdown → playing
9. Players alternate moves → server validates → state syncs to both clients
10. Checkmate → phase = "finished" → GameOverOverlay shown
11. On room dispose → persistGameResult() writes to TurnBasedGames/{gameId}
```

### 11.2 Playing a Single-Player Game with Spectating

```
1. Alice opens BrickBreakerGameScreen
2. Game logic runs locally on Alice's device
3. Alice wants friends to watch → taps "Invite to Watch"
4. useSpectator({ mode: "sp-host", gameType: "brick_breaker_game" })
5. startHosting() → creates SpectatorRoom → returns roomId
6. sendSpectatorInvite(aliceId, bobId, { roomId, gameType, hostName: "Alice" })
   → Sends chat message with "Watch Live" button
7. Alice's game loop calls updateGameState(jsonState, score, level, lives) periodically
8. Bob taps "Watch Live" → opens SpectatorViewScreen with roomId
9. useSpectator({ mode: "sp-spectator", roomId }) → joins SpectatorRoom
10. Bob sees live game state rendered by spectator renderer
11. Alice's game ends → endHosting(finalScore) → phase = "finished"
12. updateAllSpectatorInvites() marks invite messages as finished
```

### 11.3 Resuming a Suspended Turn-Based Game

```
1. Alice and Bob were playing chess → both left mid-game
2. Room disposed → saveGameState() wrote to ColyseusGameState/{gameId}
3. Later, Alice opens GamesHubScreen → sees "Active Games" section
4. Active game shows chess match with Bob (from TurnBasedGames subscription)
5. Alice taps the game → navigates to ChessGameScreen with matchId = gameId
6. useTurnBasedGame("chess_game").startMultiplayer({ firestoreGameId: gameId })
7. → colyseusService.joinOrCreate("chess_game", { firestoreGameId: gameId })
8. → New room created → loadGameState(gameId) → board restored
9. Alice joins → onJoin re-maps her UID to the restored player slot
10. Game continues from the saved turn (no countdown for restored games)
11. When Bob also returns, he joins the same room and is also re-mapped
```

---

## 12. Feature Flags

File: `constants/featureFlags.ts`

```typescript
COLYSEUS_FEATURES = {
  COLYSEUS_ENABLED: true, // Master switch
  QUICKPLAY_ENABLED: true, // reaction, timed_tap, dot_match
  TURNBASED_ENABLED: true, // tic_tac_toe, connect_four, gomoku, reversi
  COMPLEX_TURNBASED_ENABLED: true, // chess, checkers, crazy_eights
  PHYSICS_ENABLED: true, // pong, air_hockey, pool, bounce_blitz, brick_breaker, golf_duels
  COOP_ENABLED: true, // word_master, crossword
  INCREMENTAL_ENABLED: true, // starforge
  MATCHMAKING_ENABLED: false, // Public matchmaking (disabled — friends-only)
  RANKED_ENABLED: false, // ELO-based ranking (disabled)
  REMATCH_ENABLED: true,
  RECONNECTION_ENABLED: true,
  OPPONENT_SCORE_OVERLAY: true,
};
```

The `shouldUseColyseus(gameType)` function in `src/config/colyseus.ts` maps each game type to its category and checks the corresponding flag.

---

## 13. Firestore Collections

| Collection             | Purpose                                      | Key Fields                                                         |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `GameInvites`          | Game invitations (both legacy and universal) | id, gameType, status, claimedSlots, gameId, senderId, recipientId  |
| `TurnBasedGames`       | Turn-based match records                     | id, gameType, players, gameState, currentTurn, status, winnerId    |
| `ColyseusGameState`    | Suspended game snapshots (cold storage)      | gameType, board, playersByUid, currentTurnUid, status: "suspended" |
| `RealtimeGameSessions` | Completed real-time game records             | gameType, players, winnerId, winReason, source: "colyseus"         |
| `GameSessions`         | Single-player score records                  | gameId, playerId, score, playedAt                                  |
| `PlayerRatings`        | ELO ratings per game type                    | (for future ranked play)                                           |
| `MatchmakingQueue`     | Matchmaking queue entries                    | (for future public matchmaking)                                    |

---

## 14. File Map — Where Everything Lives

### Client (React Native / Expo)

```
src/
├── types/
│   ├── games.ts                    # ExtendedGameType, GAME_METADATA, score limits
│   ├── turnBased.ts                # TurnBasedMatch, player, game state types
│   └── singlePlayerGames.ts        # Single-player state types
│
├── config/
│   ├── colyseus.ts                 # Room name mapping, shouldUseColyseus()
│   └── gameCategories.ts           # UI categories, GAME_SCREEN_MAP
│
├── constants/
│   └── featureFlags.ts             # COLYSEUS_FEATURES, DAILY_GAMES
│
├── services/
│   ├── colyseus.ts                 # ColyseusService singleton (joinOrCreate, joinById, etc.)
│   ├── gameInvites.ts              # Universal invite system (send, claim, start, cancel)
│   ├── games.ts                    # Score recording, scorecard sharing, spectator invites
│   ├── turnBasedGames.ts           # Firestore-based turn-based match CRUD
│   ├── singlePlayerSessions.ts     # Single-player session recording
│   ├── dailyGamePersistence.ts     # Daily game save/load
│   └── games/                      # Game-specific logic (brickBreakerLogic.ts, etc.)
│
├── hooks/
│   ├── useMultiplayerGame.ts       # Quick-play score race hook
│   ├── useTurnBasedGame.ts         # Turn-based multiplayer hook
│   ├── useSpectator.ts             # Spectator hook (3 modes)
│   ├── useGameConnection.ts        # Transport resolver (Colyseus vs Firestore)
│   ├── useGameBackHandler.ts       # Back/exit confirmation logic
│   ├── useGameNavigation.ts        # Smart post-game navigation
│   ├── useGameCompletion.ts        # Post-game recording
│   ├── useColyseus.ts              # Low-level Colyseus connection
│   ├── useGameHaptics.ts           # Haptic feedback
│   └── usePhysicsGame.ts           # Physics game specific hook
│
├── screens/games/
│   ├── GamesHubScreen.tsx          # Main game hub (Play tab)
│   ├── TicTacToeGameScreen.tsx     # Turn-based game example
│   ├── BrickBreakerGameScreen.tsx  # Single-player + multiplayer score race example
│   ├── ChessGameScreen.tsx         # Complex turn-based example
│   ├── PoolGameScreen.tsx          # Physics game example
│   ├── SpectatorViewScreen.tsx     # Spectator experience screen
│   └── [all other game screens]
│
├── components/games/
│   ├── GamePickerModal.tsx         # Game selection for invites
│   ├── UniversalInviteCard.tsx     # Invite card with join/start buttons
│   ├── GameInviteBadge.tsx         # Pending invite count badge
│   ├── GameOverModal.tsx           # Game over overlay
│   ├── MatchmakingModal.tsx        # Matchmaking progress
│   ├── MultiplayerOverlay.tsx      # Score race overlay
│   ├── SpectatorOverlay.tsx        # Spectator viewer UI
│   ├── SpectatorBanner.tsx         # "X watching" indicator
│   ├── TurnBasedOverlay.tsx        # Turn-based game UI components
│   ├── PlayerBar.tsx               # Player name/score bars
│   ├── PlayerSlots.tsx             # Slot-based invite UI
│   └── spectator-renderers/        # Game-specific spectator renderers
```

### Colyseus Server

```
colyseus-server/
├── src/
│   ├── app.config.ts               # Server entry point, room registration
│   ├── rooms/
│   │   ├── base/
│   │   │   ├── TurnBasedRoom.ts    # Abstract base for turn-based games
│   │   │   ├── ScoreRaceRoom.ts    # Abstract base for quick-play games
│   │   │   ├── PhysicsRoom.ts      # Abstract base for physics games
│   │   │   └── CardGameRoom.ts     # Abstract base for card games
│   │   ├── turnbased/
│   │   │   ├── ChessRoom.ts
│   │   │   ├── CheckersRoom.ts
│   │   │   ├── TicTacToeRoom.ts
│   │   │   ├── ConnectFourRoom.ts
│   │   │   ├── GomokuRoom.ts
│   │   │   ├── ReversiRoom.ts
│   │   │   └── CrazyEightsRoom.ts
│   │   ├── quickplay/
│   │   │   ├── ReactionRoom.ts
│   │   │   ├── TimedTapRoom.ts
│   │   │   └── DotMatchRoom.ts
│   │   ├── physics/
│   │   │   ├── PongRoom.ts
│   │   │   ├── AirHockeyRoom.ts
│   │   │   ├── BounceBlitzRoom.ts
│   │   │   ├── BrickBreakerRoom.ts
│   │   │   ├── GolfDuelsRoom.ts
│   │   │   └── TropicalFishingRoom.ts
│   │   ├── coop/
│   │   │   ├── CrosswordRoom.ts
│   │   │   └── WordMasterRoom.ts
│   │   ├── incremental/
│   │   │   └── StarforgeRoom.ts
│   │   ├── spectator/
│   │   │   └── SpectatorRoom.ts
│   │   └── PoolRoom.ts
│   ├── schemas/
│   │   ├── common.ts               # Player, BaseGameState, Vec2, GameTimer
│   │   ├── turnbased.ts            # TurnBasedState, GridCell, MoveRecord
│   │   ├── quickplay.ts            # ScoreRaceState, ScoreRacePlayer
│   │   ├── physics.ts              # PhysicsState, Ball, Paddle
│   │   ├── spectator.ts            # SpectatorRoomState, SpectatorEntry
│   │   ├── cards.ts                # Card game schemas
│   │   ├── tropicalFishing.ts      # Fishing game schemas
│   │   ├── starforge.ts            # Starforge game schemas
│   │   └── golfDuels.ts            # Golf game schemas
│   └── services/
│       ├── firebase.ts             # Firebase Admin SDK init + token verification
│       ├── persistence.ts          # saveGameState, loadGameState, persistGameResult
│       └── validation.ts           # Anti-cheat score validation
```

---

## 15. How to Add a New Game

### Step-by-Step Checklist

#### 1. Define the Game Type

In `src/types/games.ts`:

- Add to the appropriate union type (`SinglePlayerGameType`, `TurnBasedGameType`, or `RealTimeGameType`)
- Add entry to `GAME_METADATA` with all fields
- Add entry to `EXTENDED_GAME_SCORE_LIMITS`

#### 2. Create the Server Room (if multiplayer)

In `colyseus-server/src/rooms/`:

- Choose the appropriate base class:
  - Turn-based → extend `TurnBasedRoom`
  - Quick-play score race → extend `ScoreRaceRoom`
  - Physics/real-time → extend `PhysicsRoom`
- Implement all abstract methods
- Export from the file

In `colyseus-server/src/app.config.ts`:

- Import the room
- Register: `my_game: defineRoom(MyGameRoom).filterBy(["firestoreGameId"])`

#### 3. Map the Room Name

In `src/config/colyseus.ts`:

- Add to `COLYSEUS_ROOM_NAMES`: `my_game_game: "my_game"`
- Add to `GAME_CATEGORY_MAP`: `my_game_game: "turnbased"` (or appropriate category)

#### 4. Add Default Invite Settings

In `src/services/gameInvites.ts`:

- Add to `DEFAULT_SETTINGS` record
- Add to `getDefaultInviteSettings()` record

#### 5. Create the Game Screen

In `src/screens/games/MyGameScreen.tsx`:

- Use the appropriate hook:
  - Turn-based: `useTurnBasedGame("my_game_game")`
  - Quick-play: `useMultiplayerGame({ gameType: "my_game_game" })`
  - Physics: use `useColyseus` directly or `usePhysicsGame`
- Use `useGameBackHandler({ gameType: "my_game" })` for exit behavior
- Use `useSpectator({ mode: "sp-host", gameType: "my_game_game" })` if spectating supported
- Wrap with `withGameErrorBoundary(MyGameScreen)`

#### 6. Register the Navigation Screen

In `src/config/gameCategories.ts`:

- Add to `GAME_SCREEN_MAP`: `my_game: "MyGameScreen"`

In your navigation config (PlayStack):

- Add the screen: `<Stack.Screen name="MyGameScreen" component={MyGameScreen} />`

#### 7. Add Feature Flag (if needed)

In `constants/featureFlags.ts`:

- The game category flag already exists (QUICKPLAY_ENABLED, TURNBASED_ENABLED, etc.)
- Set `isAvailable: true` in GAME_METADATA when ready to ship

#### 8. Create Schema (if new state fields needed)

In `colyseus-server/src/schemas/`:

- Only needed if the game requires state fields beyond what the base schemas provide
- Remember: 64-property limit per Colyseus Schema class

#### 9. Add Spectator Renderer (optional)

In `src/components/games/spectator-renderers/`:

- Create `MyGameSpectatorRenderer.tsx`
- Import in `SpectatorViewScreen.tsx`

---

## Appendix A: Key Patterns to Remember

### Pattern: `firestoreGameId` as the Universal Glue

The `firestoreGameId` is the single identifier that connects:

- The invite (`GameInvites/{id}.gameId`)
- The Firestore match record (`TurnBasedGames/{gameId}`)
- The Colyseus room (`filterBy(["firestoreGameId"])` ensures matching)
- The suspended state (`ColyseusGameState/{gameId}`)

Both players receive this ID from the invite and pass it when joining. Colyseus routes them to the same room.

### Pattern: Session ID vs Firebase UID

- **Session ID** (`client.sessionId`): Changes every connection. Used for Colyseus messages and state maps.
- **Firebase UID** (`auth.uid`): Permanent. Used for Firestore, persistence, and winner identification.
- `state.currentTurnPlayerId` = session ID (for real-time turn detection)
- `state.winnerId` = Firebase UID (for persistence)
- When restoring games, players are re-mapped by UID to new session IDs.

### Pattern: Phase-Based Lifecycle

Every room follows: `waiting → countdown → playing → finished`

- **waiting**: Players join, not enough to start
- **countdown**: All players ready, 3-2-1 countdown
- **playing**: Active gameplay
- **finished**: Game over, results shown

### Pattern: Spectators Are Second-Class Citizens

Spectators in any room:

- Are tracked in `state.spectators` MapSchema
- Are blocked from all game actions (`isSpectator(sessionId)` check)
- Receive the same state patches as players
- Can be ejected if room is full
- Don't trigger game logic (leave doesn't count as forfeit)

### Pattern: Rematch Flow

1. Player sends `"rematch"` message
2. Server broadcasts `"rematch_request"` to all
3. Opponent sends `"rematch_accept"` message
4. Server calls `resetForRematch()` — resets board, scores, swaps player order
5. Phase returns to `"waiting"` → players send `"ready"` again

---

## Appendix B: Anti-Cheat

- Server validates all moves in turn-based games (`validateMove()`)
- Server validates score updates in quick-play games (`validateScoreUpdate()`)
- Score limits per game type in `EXTENDED_GAME_SCORE_LIMITS`
- Physics runs server-side at 60fps — clients only send input positions

---

_Last updated: 2026-02-14_
