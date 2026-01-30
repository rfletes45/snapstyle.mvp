# Games System Documentation

> Comprehensive documentation for the games expansion including architecture, implementation, and testing.  
> **Status**: Implementation Complete (January 2026)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Game Types](#3-game-types)
4. [Single-Player Games](#4-single-player-games)
5. [Turn-Based Multiplayer](#5-turn-based-multiplayer)
6. [Firestore Schema](#6-firestore-schema)
7. [Services Reference](#7-services-reference)
8. [Achievement System](#8-achievement-system)
9. [UI Components](#9-ui-components)
10. [Testing](#10-testing)
11. [Performance](#11-performance)

---

## 1. Overview

### Game Categories

| Category        | Games                                         | Description                      |
| --------------- | --------------------------------------------- | -------------------------------- |
| **Quick Play**  | Flappy Snap, Bounce Blitz                     | Fast, casual single-player games |
| **Puzzle**      | Snap 2048, Memory Snap, Word Snap, Snap Snake | Thinking games                   |
| **Multiplayer** | Chess, Checkers, Tic-Tac-Toe, Crazy Eights    | Turn-based VS other players      |
| **Daily**       | Word Snap                                     | Daily challenges                 |

### Game Status Flow

```
Single-Player:
  idle → ready → playing → (paused) → game_over

Turn-Based Multiplayer:
  invited → active → (draw_offered) → completed/resigned/timeout/draw
```

---

## 2. Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Game Screen Components                    │
├─────────────────────────────────────────────────────────────┤
│  Flappy    Bounce   Memory   Word   Snap2048  Snake        │
│  TicTacToe Checkers Chess    CrazyEights                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
┌────────┴────────┐              ┌───────────┴───────────┐
│ Single-Player   │              │ Turn-Based            │
│ Sessions        │              │ Games                 │
│ Service         │              │ Service               │
└────────┬────────┘              └───────────┬───────────┘
         │                                   │
         └─────────────────┬─────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Firestore  │
                    └─────────────┘
```

### Key Services

| Service                   | Purpose                                     |
| ------------------------- | ------------------------------------------- |
| `singlePlayerSessions.ts` | Records sessions, high scores, leaderboards |
| `turnBasedGames.ts`       | Match creation, moves, real-time sync       |
| `gameInvites.ts`          | Invite system for multiplayer               |
| `matchmaking.ts`          | Automatic matchmaking with ELO              |
| `gameStats.ts`            | Player statistics and leaderboards          |
| `gameAchievements.ts`     | Achievement tracking and unlocks            |

### Game Loop Hook

All action games use `useGameLoop` for 60fps frame updates:

```typescript
import { useGameLoop } from "@/hooks";

// In game component:
useGameLoop((deltaTime) => {
  // Update physics, positions, etc.
  // deltaTime is clamped to max 32ms to prevent physics explosions
}, isRunning);
```

---

## 3. Game Types

### Type Hierarchy

```typescript
// Base types (src/types/models.ts)
GameType = "reaction_tap" | "timed_tap";

// Extended types (src/types/games.ts)
SinglePlayerGameType =
  "flappy_snap" |
  "bounce_blitz" |
  "memory_snap" |
  "word_snap" |
  "snap_2048" |
  "snap_snake";

TurnBasedGameType = "chess" | "checkers" | "tic_tac_toe" | "crazy_eights";

ExtendedGameType = GameType | SinglePlayerGameType | TurnBasedGameType;
```

### File Locations

- `src/types/games.ts` — Game type definitions and metadata
- `src/types/singlePlayer.ts` — Single-player game states
- `src/types/turnBased.ts` — Turn-based game states

---

## 4. Single-Player Games

### Flappy Snap

**File:** `src/screens/games/FlappySnapGameScreen.tsx`

Flappy Bird-style tap-to-fly game with physics engine.

| Feature    | Description                                |
| ---------- | ------------------------------------------ |
| Controls   | Tap to jump/flap                           |
| Scoring    | Points per pipe + bonus for perfect passes |
| Difficulty | Pipes get closer and faster over time      |

**Physics Constants:**

```typescript
{
  gravity: 0.5,
  jumpVelocity: -8,
  terminalVelocity: 12,
  ballRadius: 15,
}
```

### Bounce Blitz

**File:** `src/screens/games/BounceBlitzGameScreen.tsx`

Ballz-style ball launcher that breaks numbered blocks.

| Feature  | Description                      |
| -------- | -------------------------------- |
| Controls | Swipe to aim, release to launch  |
| Scoring  | Points per block destroyed       |
| Special  | Extra ball pickups, bonus blocks |

### Memory Snap

**File:** `src/screens/games/MemorySnapGameScreen.tsx`

Card matching memory game with difficulty levels.

| Difficulty | Grid | Pairs |
| ---------- | ---- | ----- |
| Easy       | 3×4  | 6     |
| Medium     | 4×4  | 8     |
| Hard       | 4×5  | 10    |

### Word Snap

**File:** `src/screens/games/WordSnapGameScreen.tsx`

Daily Wordle-style word guessing game.

| Feature    | Description                                                  |
| ---------- | ------------------------------------------------------------ |
| Daily Word | One word per day, same for all users                         |
| Attempts   | 6 guesses maximum                                            |
| Hints      | Green (correct), Yellow (wrong position), Gray (not in word) |

### Snap 2048

**File:** `src/screens/games/Snap2048GameScreen.tsx`

Slide tiles to combine matching numbers, reach 2048.

| Feature  | Description               |
| -------- | ------------------------- |
| Grid     | 4×4                       |
| Controls | Swipe in any direction    |
| Scoring  | Sum of merged tile values |

### Snap Snake

**File:** `src/screens/games/SnapSnakeGameScreen.tsx`

Classic snake game - eat food, grow longer, don't hit walls.

---

## 5. Turn-Based Multiplayer

### Game Modes

All turn-based games support:

1. **Local Play** — Two players on same device
2. **Online Play** — Real-time via Firestore

### Tic-Tac-Toe

**File:** `src/screens/games/TicTacToeGameScreen.tsx`

Classic 3×3 grid, first to 3 in a row wins.

### Checkers

**File:** `src/screens/games/CheckersGameScreen.tsx`

8×8 board, jump to capture opponent pieces, king pieces can move backward.

### Chess

**File:** `src/screens/games/ChessGameScreen.tsx`

Full chess implementation with move validation, check/checkmate detection.

**Board Representation:** FEN notation for state serialization.

### Crazy Eights

**File:** `src/screens/games/CrazyEightsGameScreen.tsx`

Card game — match suit or rank, eights are wild.

---

## 6. Firestore Schema

### Collections Overview

```
Firestore Root
├── turnBasedMatches/           # All turn-based multiplayer games
│   └── {matchId}/
│       └── moves/              # Move history
│
├── gameInvites/                # Pending game invitations
│
├── matchmakingQueue/           # Players waiting for match
│
├── Users/{uid}/
│   ├── GameStats/{gameType}/   # Per-game statistics
│   ├── ActiveGames/{gameId}/   # Active games index
│   └── GameSessions/{id}/      # Single-player records
│
└── Leaderboards/{gameType}/    # Global leaderboards
    └── scores/{scoreId}/
```

### turnBasedMatches Document

```typescript
interface TurnBasedMatchDocument {
  id: string;
  type: TurnBasedGameType;
  status: "invited" | "active" | "completed" | "resigned" | "timeout" | "draw";

  createdBy: string;
  players: Record<string, PlayerInfo>;
  currentTurn: string; // Player side (e.g., 'white', 'black')

  boardState: string; // FEN for chess, JSON for others
  moveCount: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMoveAt: Timestamp;
}
```

### gameInvites Document

```typescript
interface GameInviteDocument {
  id: string;
  gameType: TurnBasedGameType;
  fromUid: string;
  toUid: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: Timestamp;
  expiresAt: Timestamp;
}
```

---

## 7. Services Reference

### Single-Player Sessions

**File:** `src/services/singlePlayerSessions.ts`

```typescript
// Record a game session
await recordSinglePlayerSession(uid, gameType, {
  score: 1500,
  level: 12,
  duration: 45000,
});

// Get high score
const highScore = await getHighScore(uid, gameType);

// Get leaderboard
const leaders = await getLeaderboard(gameType, 10);
```

### Turn-Based Games

**File:** `src/services/turnBasedGames.ts`

```typescript
// Create a match
const matchId = await createMatch(gameType, player1Uid, player2Uid);

// Subscribe to match updates
const unsubscribe = subscribeToMatch(matchId, (match) => {
  // Handle match updates
});

// Submit a move
await submitMove(matchId, playerUid, moveData);
```

### Game Invites

**File:** `src/services/gameInvites.ts`

```typescript
// Send invite
await sendGameInvite(fromUid, toUid, gameType);

// Accept/decline
await respondToInvite(inviteId, "accepted");
```

### Universal Game Invites (Multi-Player)

**File:** `src/services/gameInvites.ts`

The Universal Game Invites system supports flexible multiplayer games with 2-8 players plus spectators.

#### Key Features

- **Flexible Slots**: Support for 2-8 player games with configurable slot counts
- **Smart Targeting**: Invites can target public lobby, friends-only, specific users, or a conversation
- **Spectator Mode**: Up to 20 spectators can watch without playing
- **Real-time Sync**: Cloud Functions automatically create games and sync spectators

#### Creating a Universal Invite

```typescript
import { sendUniversalInvite } from "@/services/gameInvites";

// Create a 4-player poker game for friends
const inviteId = await sendUniversalInvite(
  userId,
  "crazy_eights", // gameType
  4, // maxSlots (2-8)
  {
    targeting: { type: "friends_only" },
    spectators: { enabled: true, maxCount: 10 },
    settings: { isRated: true, chatEnabled: true },
  },
);
```

#### Claiming/Unclaiming Slots

```typescript
import { claimInviteSlot, unclaimInviteSlot } from "@/services/gameInvites";

// Join a game
await claimInviteSlot(inviteId, userId, "PlayerName", "avatar_url");

// Leave before game starts
await unclaimInviteSlot(inviteId, userId);
```

#### Spectator Functions

```typescript
import { joinAsSpectator, leaveAsSpectator } from "@/services/gameInvites";

// Watch a game
await joinAsSpectator(inviteId, userId, "SpectatorName");

// Stop watching
await leaveAsSpectator(inviteId, userId);
```

#### Querying Universal Invites

```typescript
import {
  getPublicUniversalInvites,
  getFriendsUniversalInvites,
  getMyUniversalInvites,
} from "@/services/gameInvites";

// Get public lobby games
const publicInvites = await getPublicUniversalInvites("chess", 20);

// Get invites from friends
const friendsInvites = await getFriendsUniversalInvites(userId, friendIds);

// Get my active invites
const myInvites = await getMyUniversalInvites(userId);
```

#### Universal Invite Status Flow

```
pending → ready → active → completed
   ↓                         ↓
expired                   cancelled
```

#### Cloud Function Triggers

**File:** `firebase-backend/functions/src/games.ts`

The `onUniversalInviteUpdate` Cloud Function handles:

1. **Game Creation**: When all slots are filled (status → "ready"), automatically creates the game
2. **Spectator Sync**: When spectators join/leave, syncs to the game document

```typescript
// Firestore trigger path
GameInvites / { inviteId };
```

#### Migration from Legacy Invites

**File:** `firebase-backend/functions/src/migrations/migrateGameInvites.ts`

The migration script adds universal invite fields to existing legacy `GameInvites` documents.

**Running the Migration:**

```bash
# Step 1: Deploy the migration functions
cd firebase-backend/functions
npm run deploy

# Step 2: Run dry-run to preview changes
firebase functions:call migrateGameInvitesDryRun

# Step 3: Execute the actual migration
firebase functions:call migrateGameInvites

# Step 4: If issues occur, rollback (requires confirmation)
firebase functions:call rollbackGameInvitesMigration --data '{"confirm": true}'
```

**What the Migration Does:**

| Legacy Field  | Universal Field   | Transformation                       |
| ------------- | ----------------- | ------------------------------------ |
| `recipientId` | `targetType`      | Set to `"specific"` (1:1 DM invites) |
| `recipientId` | `eligibleUserIds` | `[senderId, recipientId]`            |
| N/A           | `context`         | Set to `"dm"` for legacy invites     |
| N/A           | `conversationId`  | Generated from sorted user IDs       |
| `senderId`    | `claimedSlots`    | Host added with `isHost: true`       |
| N/A           | `requiredPlayers` | Set to `2` (legacy invites were 1:1) |
| N/A           | `maxPlayers`      | Set to `2`                           |
| N/A           | `showInPlayPage`  | Set to `true` for visibility         |
| `settings`    | `settings`        | Merged with game-specific defaults   |

**Migration Safety Features:**

- ✅ Idempotent: Skips already-migrated documents
- ✅ Batched: Processes 500 documents at a time
- ✅ Dry-run: Preview changes before applying
- ✅ Rollback: Remove migration fields if needed
- ✅ Error handling: Logs failures without blocking

---

## 8. Achievement System

### Achievement Categories

| Category       | Examples                          |
| -------------- | --------------------------------- |
| **General**    | first_game, games_10, games_100   |
| **Per-Game**   | flappy_100, chess_first_win, etc. |
| **Milestones** | high_scores, win_streaks          |
| **Special**    | perfect_game, comeback_win        |

### Achievement Tiers & Rewards

| Tier     | Coins | XP  |
| -------- | ----- | --- |
| Bronze   | 50    | 25  |
| Silver   | 150   | 75  |
| Gold     | 500   | 200 |
| Platinum | 1000  | 500 |

### Service Usage

**File:** `src/services/gameAchievements.ts`

```typescript
// Check achievements after game
await checkAndGrantGameAchievements(uid, gameType, gameResult);

// Get progress
const progress = await getAchievementProgress(uid, achievementId);
```

---

## 9. UI Components

### Component Index

**Location:** `src/components/games/`

| Component              | Purpose                         |
| ---------------------- | ------------------------------- |
| `GameCard.tsx`         | Game selection card in hub      |
| `GameInviteCard.tsx`   | Incoming invite display         |
| `ActiveGamesList.tsx`  | List of in-progress games       |
| `GameOverModal.tsx`    | End-of-game modal with stats    |
| `PlayerBar.tsx`        | Shows player info during match  |
| `AchievementToast.tsx` | Achievement unlock notification |

### Games Theme

**File:** `constants/gamesTheme.ts`

```typescript
import {
  GAME_CATEGORY_COLORS,
  GAME_ANIMATIONS,
  getCategoryColor,
  getGamePalette,
} from "@/constants/gamesTheme";
```

---

## 10. Testing

### Test Structure

```
__tests__/
├── physics/
│   ├── flappyPhysics.test.ts
│   └── poolPhysics.test.ts
├── games/
│   ├── chess.validation.test.ts
│   ├── checkers.validation.test.ts
│   └── ticTacToe.validation.test.ts
├── integration/
│   ├── gameInvites.test.ts           # Legacy invite tests
│   ├── universalGameInvites.test.ts  # Universal invite tests (39 tests)
│   └── turnBasedGame.test.ts
├── achievements/
│   └── gameAchievements.test.ts
└── performance/
    └── gamePerformance.test.ts
```

### Running Tests

```bash
# All tests
npm test

# With coverage
npm test -- --coverage

# Specific test
npm test -- __tests__/physics/flappyPhysics.test.ts

# Universal invites tests
npm test -- __tests__/integration/universalGameInvites.test.ts
```

### Coverage Thresholds

| Scope           | Lines | Branches |
| --------------- | ----- | -------- |
| Global          | 80%   | 70%      |
| Game Validation | 95%   | 90%      |
| Physics Utils   | 90%   | 90%      |

---

## 11. Performance

### Benchmarks

| Metric                | Target |
| --------------------- | ------ |
| Flappy Physics Tick   | <0.5ms |
| Chess Move Validation | <1ms   |
| Checkmate Detection   | <5ms   |
| Game Load Time        | <500ms |
| Memory Usage          | <150MB |

### Frame Rate Monitor

**File:** `src/utils/performance/optimization.ts`

```typescript
import { usePerformanceMonitor } from "@/utils/performance";

function GameScreen() {
  const { metrics, recordFrame } = usePerformanceMonitor({
    enabled: __DEV__,
    onPerformanceDrop: (m) => console.warn("FPS drop:", m),
  });

  // Call recordFrame() in game loop
}
```

### Optimization Tips

1. **Use `useSharedValue`** for animation values (runs on UI thread)
2. **Clamp deltaTime** to max 32ms to prevent physics explosions
3. **Pool objects** instead of creating new ones each frame
4. **Memoize** expensive calculations
5. **Use `useCallback`** for game loop functions

---

## Related Documentation

- [01_ARCHITECTURE.md](01_ARCHITECTURE.md) — App structure overview
- [02_FIREBASE.md](02_FIREBASE.md) — Firestore schema details
- [04_TESTING.md](04_TESTING.md) — General testing guide
- [05_RUNBOOK.md](05_RUNBOOK.md) — Troubleshooting guide
