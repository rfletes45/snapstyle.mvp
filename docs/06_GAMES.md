# 06 — Games System

> **Last Updated**: 2026-02-18
> **Status**: ✅ Fully Implemented — 19 game types (7 SP + 8 TB + 4 RT)

---

## Overview

The Play tab is one of the app's five main tabs, containing **19 playable mini-games** across four categories. Games support solo play, async turn-based multiplayer (via Firebase), and real-time multiplayer (via Colyseus WebSocket rooms).

Key capabilities:

- **Single-player**: Score-based games with leaderboards, achievements, and anti-cheat score limits
- **Turn-based multiplayer**: Invite friends, async moves stored in Firestore, spectator mode
- **Real-time multiplayer**: Colyseus WebSocket rooms with state sync, reconnection, auto-ready
- **Physics engines**: Matter.js for 2D physics, react-native-game-engine for game loops
- **GPU graphics**: @shopify/react-native-skia for 2D board rendering, Three.js for 3D effects

---

## Game Registry

All games are defined in `src/types/games.ts` via the `GAME_METADATA` constant (`Record<ExtendedGameType, GameMetadata>`).

### Type Hierarchy

```typescript
// src/types/games.ts

type SinglePlayerGameType = // 8 games
  | "bounce_blitz"
  | "play_2048"
  | "word_master"
  | "reaction_tap"
  | "timed_tap"
  | "brick_breaker"
  | "minesweeper_classic"
  | "lights_out"
  | "pong_game";

type TurnBasedGameType = // 8 games
  | "chess"
  | "checkers"
  | "crazy_eights"
  | "tic_tac_toe"
  | "connect_four"
  | "dot_match"
  | "gomoku_master"
  | "reversi_game";

type RealTimeGameType = // 3 games (2 coming soon)
  | "8ball_pool"
  | "air_hockey" // coming soon
  | "crossword_puzzle";

type ExtendedGameType =
  | SinglePlayerGameType
  | TurnBasedGameType
  | RealTimeGameType;
type GameCategory = "quick_play" | "puzzle" | "multiplayer" | "daily";
```

### GameMetadata Interface

```typescript
interface GameMetadata {
  id: ExtendedGameType;
  name: string;
  shortName: string;
  description: string;
  icon: string; // Emoji or MaterialCommunityIcons name
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  isMultiplayer: boolean;
  hasLeaderboard: boolean;
  hasAchievements: boolean;
  isAvailable: boolean; // Feature flag for gradual rollout
  comingSoon?: boolean;
  isNew?: boolean; // Shows NEW badge in UI
}
```

---

## Complete Game List

### Single-Player Games (8)

| Game          | Type Key              | Category   | Description                      |
| ------------- | --------------------- | ---------- | -------------------------------- |
| Reaction Tap  | `reaction_tap`        | quick_play | Tap when screen turns green      |
| Timed Tap     | `timed_tap`           | quick_play | Tap count in 10 seconds          |
| Bounce Blitz  | `bounce_blitz`        | quick_play | Ballz-style ball bouncing        |
| Brick Breaker | `brick_breaker`       | quick_play | Classic Breakout/Arkanoid        |
| Pong          | `pong_game`           | quick_play | Pong with AI opponent            |
| Play 2048     | `play_2048`           | puzzle     | 2048 tile merging                |
| Minesweeper   | `minesweeper_classic` | puzzle     | Classic Minesweeper              |
| Lights Out    | `lights_out`          | puzzle     | Lights Out puzzle                |
| Word Master   | `word_master`         | daily      | Daily word puzzle (Wordle-style) |

### Turn-Based Multiplayer Games (8)

| Game         | Type Key        | Description                          |
| ------------ | --------------- | ------------------------------------ |
| Tic-Tac-Toe  | `tic_tac_toe`   | Classic 3×3 grid                     |
| Chess        | `chess`         | Full chess with Skia-rendered pieces |
| Checkers     | `checkers`      | Classic checkers with Skia board     |
| Crazy Eights | `crazy_eights`  | UNO-style card game                  |
| Connect Four | `connect_four`  | Classic 4-in-a-row                   |
| Gomoku       | `gomoku_master` | Five in a Row on 15×15 grid          |
| Reversi      | `reversi_game`  | Othello / Reversi                    |
| Dot Match    | `dot_match`     | Dots and Boxes                       |

### Real-Time Multiplayer Games (3)

| Game        | Type Key           | Status         | Description          |
| ----------- | ------------------ | -------------- | -------------------- |
| Crossword   | `crossword_puzzle` | ✅ Available   | Daily mini crossword |
| 8-Ball Pool | `8ball_pool`       | 🔜 Coming Soon | Pool with physics    |
| Air Hockey  | `air_hockey`       | 🔜 Coming Soon | Real-time air hockey |

---

## Architecture

### Layer Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    GAME SCREENS (41 files)                     │
│  src/screens/games/*GameScreen.tsx                            │
│  + GamesHubScreen, LeaderboardScreen, AchievementsScreen,    │
│    GameHistoryScreen, SpectatorViewScreen                     │
└────────────────────────┬─────────────────────────────────────┘
                         │
            ┌────────────┼──────────────┐
            ▼            ▼              ▼
   ┌────────────┐  ┌──────────┐  ┌──────────────┐
   │   HOOKS    │  │ GRAPHICS │  │  COMPONENTS  │
   │ (13 hooks) │  │ Skia/3D  │  │ (19 UI files)│
   └─────┬──────┘  └──────────┘  └──────────────┘
         │
    ┌────┼────────────────┐
    ▼    ▼                ▼
┌───────────┐  ┌────────────────┐  ┌──────────────────┐
│ FIREBASE  │  │ COLYSEUS (WS)  │  │ LOCAL LOGIC      │
│ Firestore │  │ 25 rooms       │  │ Matter.js physics│
│ Functions │  │ State sync     │  │ Game engine      │
└───────────┘  └────────────────┘  └──────────────────┘
```

### File Organization

```
src/screens/games/
├── GamesHubScreen.tsx          # Main Play tab screen
├── LeaderboardScreen.tsx       # Global leaderboards
├── AchievementsScreen.tsx      # Achievement badges
├── GameHistoryScreen.tsx       # Past game history
├── SpectatorViewScreen.tsx     # Watch live games
├── components/                 # 19 Play screen UI components
│   ├── PlayHeader.tsx          # Play tab header
│   ├── PlaySearchBar.tsx       # Game search
│   ├── GameFilterBar.tsx       # Category filters
│   ├── FeaturedGameBanner.tsx  # Featured game hero (+ Three.js)
│   ├── DailyChallengeCard.tsx  # Daily challenge promotion
│   ├── GameCategoryCarousel.tsx # Horizontal category scroll
│   ├── CarouselGameTile.tsx    # Individual carousel tile
│   ├── ModernGameCard.tsx      # Game card in grid
│   ├── MiniGameItem.tsx        # Compact game list item
│   ├── GameStatsSummary.tsx    # Player stats overview
│   ├── GameRecommendations.tsx # AI-suggested games
│   ├── GameQuickActionsModal.tsx # Quick actions bottom sheet
│   ├── GameInvitesBanner.tsx   # Pending invites banner
│   ├── FriendsPlayingNow.tsx   # Friends currently playing
│   ├── CompactInviteCard.tsx   # Compact invite (+ Three.js)
│   ├── ActiveGamesSection.tsx  # Active games section
│   ├── ActiveGamesMini.tsx     # Mini active games widget
│   ├── ActiveGameCard.tsx      # Single active game card
│   └── SearchResultsView.tsx   # Game search results
├── [36 individual game screens]
└── ...
```

---

## Hooks (src/hooks/)

### Game Hook Architecture

| Hook                  | Purpose                                       | Used By                          |
| --------------------- | --------------------------------------------- | -------------------------------- |
| `useGameHaptics`      | Haptic feedback patterns                      | All games                        |
| `useGameScores`       | Score submission + leaderboard queries        | All games with leaderboards      |
| `useGameCompletion`   | End-of-game flow (score submit, rematch)      | All games                        |
| `useGameNavigation`   | Navigation between game screens               | GamesHub, game screens           |
| `useGameAchievements` | Achievement tracking + unlock triggers        | All games                        |
| `useGameConnection`   | Colyseus WebSocket connection lifecycle       | All multiplayer games            |
| `useMultiplayerGame`  | Multiplayer state (invites, turns, spectator) | Turn-based + real-time games     |
| `useTurnBasedGame`    | Turn-based game state + move submission       | Chess, Checkers, TicTacToe, etc. |
| `usePhysicsGame`      | Matter.js physics world management            | Pong, BrickBreaker, BounceBlitz  |
| `useCardGame`         | Card game state (hand, deck, discard)         | CrazyEights                      |

---

## Colyseus Multiplayer Server (colyseus-server/)

### Overview

The Colyseus server runs as a separate Node.js process, deployed via Docker + nginx. It provides real-time WebSocket rooms for multiplayer games.

- **Client SDK**: `colyseus.js@0.17.31`
- **Server**: `@colyseus/core@0.17.35`
- **Transport**: WebSocket with JSON patches
- **Reconnection**: Token-based, 30-second timeout

### Room Architecture (22 rooms)

```
colyseus-server/src/rooms/
├── base/                       # 4 base room patterns
│   ├── CardGameRoom.ts
│   ├── PhysicsRoom.ts
│   ├── ScoreRaceRoom.ts
│   └── TurnBasedRoom.ts
├── quickplay/                  # 3 quickplay rooms
│   ├── DotMatchRoom.ts
│   ├── ReactionRoom.ts
│   └── TimedTapRoom.ts
├── turnbased/                  # 7 turn-based rooms
│   ├── TicTacToeRoom.ts
│   ├── ChessRoom.ts
│   ├── CheckersRoom.ts
│   ├── CrazyEightsRoom.ts
│   ├── ConnectFourRoom.ts
│   ├── GomokuRoom.ts
│   └── ReversiRoom.ts
├── physics/                    # 5 physics rooms
│   ├── AirHockeyRoom.ts
│   ├── BounceBlitzRoom.ts
│   ├── BrickBreakerRoom.ts
│   ├── PongRoom.ts
│   └── PoolRoom.ts
├── spectator/                  # 1 spectator room
│   └── SpectatorRoom.ts
└── coop/                       # 2 cooperative rooms
    ├── WordMasterRoom.ts
    └── CrosswordRoom.ts
```

### Base Room Patterns

| Pattern         | Base Class      | Features                                              |
| --------------- | --------------- | ----------------------------------------------------- |
| **Quickplay**   | `QuickplayRoom` | Timer-based, concurrent play, score comparison at end |
| **Turn-based**  | `TurnBasedRoom` | Alternating turns, resign/forfeit, move validation    |
| **Physics**     | `PhysicsRoom`   | Server-authoritative physics, input forwarding        |
| **Cooperative** | (varies)        | Shared state, collaborative objectives                |

### Room Lifecycle

```
Client                          Colyseus Server
  │                                    │
  ├── joinOrCreate(roomName) ─────────►│ onCreate() / onJoin()
  │                                    │  ├── validate auth token
  │◄── state patch ───────────────────┤  ├── assign player slot
  │                                    │  └── start countdown if full
  │                                    │
  ├── send("action", data) ──────────►│ onMessage("action")
  │                                    │  ├── validate move
  │◄── state patch ───────────────────┤  └── broadcast state
  │                                    │
  │  (disconnect)                      │ onLeave()
  │                                    │  └── allow 30s reconnect
  ├── reconnect(token) ──────────────►│ onJoin() (reconnected)
  │                                    │
  │◄── state: game_over ─────────────┤ endGame()
  │                                    │  ├── submit scores to Firebase
  └── leave() ───────────────────────►│  └── dispose room
```

---

## Skia Graphics (src/components/games/graphics/)

GPU-accelerated 2D rendering via `@shopify/react-native-skia` for game boards:

| Component            | Used By                  |
| -------------------- | ------------------------ |
| `SkiaChessPieces`    | Chess game               |
| `SkiaCheckersPieces` | Checkers game            |
| `SkiaGameBoard`      | Generic grid-based games |
| `Skia2048Tiles`      | 2048 game tiles          |
| `SkiaParticleSystem` | Victory/combo effects    |
| `SkiaGoBoard`        | Gomoku game board        |

---

## Three.js 3D Effects (src/components/three/)

Three.js provides 3D visual effects on the Play tab via `expo-gl` + `expo-three`:

| Component             | Integration Point                |
| --------------------- | -------------------------------- |
| `ThreeHeroBanner`     | `FeaturedGameBanner` on GamesHub |
| `ThreeInviteCard`     | `CompactInviteCard` game invites |
| `ThreeGameTrophy`     | Victory screen overlay           |
| `ThreeGameBackground` | Full-screen 3D backgrounds       |
| `ThreeFloatingIcons`  | GamesHub floating game icons     |

Feature-flagged via `THREE_JS_FEATURES` in `constants/featureFlags.ts`.

---

## Play Screen Components

The GamesHub screen (`src/screens/games/GamesHubScreen.tsx`) is the main Play tab and uses 19 dedicated components:

### Layout Sections (top to bottom)

1. **PlayHeader** — Play tab header with avatar
2. **PlaySearchBar** — Game search with `SearchResultsView`
3. **GameFilterBar** — Category filter pills (All, Quick Play, Puzzle, Multiplayer, Daily)
4. **FeaturedGameBanner** — Hero card with Three.js 3D banner
5. **DailyChallengeCard** — Daily challenge promotion
6. **GameInvitesBanner** — Pending game invites (with `CompactInviteCard`)
7. **ActiveGamesSection** / **ActiveGamesMini** — Games in progress
8. **FriendsPlayingNow** — Friends currently in games
9. **GameCategoryCarousel** — Horizontal scrollable game carousels per category
10. **GameRecommendations** — Suggested games based on play history
11. **GameStatsSummary** — Player stats (games played, win rate, etc.)

### Enhanced Profile Header (Phase 7)

Gated by `PLAY_SCREEN_FEATURES.ENHANCED_PROFILE_HEADER`.

The **EnhancedGamesProfileHeader** replaces the legacy inline profile card with a
premium "Player Summary Header" that shows identity, progression, economy, and task
progress in a single compact card. It supports an expand/collapse panel for deeper
detail.

**Components** (all in `src/components/games/`):

| Component                    | Purpose                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `EnhancedGamesProfileHeader` | Top-level orchestrator — three-zone layout + rails + expand                                 |
| `AvatarStack`                | Layered PFP with 5 decoration slots (frame, aura, badge, overlay, backplate) + presence dot |
| `XpBar`                      | Level pill + animated XP progress bar with numeric label                                    |
| `CurrencyChip`               | Compact currency badge with icon, amount, claimable dot                                     |
| `TaskProgressRail`           | Daily / monthly task progress bar with claimable indicator                                  |
| `ExpandedPanel`              | Collapsible panel: claimables, mini stats, equipped cosmetics, active boosts                |

**Data source**: `usePlayerSummary` hook (`src/hooks/usePlayerSummary.ts`) composes
existing hooks (`useProfileData`, `useProfilePicture`, `subscribeToWallet`,
`getTasksWithProgress`) into a single `PlayerSummary` payload. No new Firestore docs
or listeners are introduced.

**Types**: `src/types/playerSummary.ts` — `PlayerSummary`, `EquippedDecor`,
`CurrencyBalances`, `TasksProgressSummary`, `MiniStats`, `ActiveBoost`.

**Feature flag**: `PLAY_SCREEN_FEATURES.ENHANCED_PROFILE_HEADER` (default `true`).
When `false`, falls back to the legacy inline profile card.

### Tasks System (Daily & Monthly)

The **TasksScreen** (`src/screens/tasks/TasksScreen.tsx`) provides a dual-tab view
for daily and monthly challenges. It lives in the **ProfileStack** and is navigated
to from the enhanced profile header via `CommonActions.navigate`.

**Tab structure**:

| Tab     | Cadence   | Reset         | Key format   |
| ------- | --------- | ------------- | ------------ |
| Daily   | `daily`   | Midnight (TZ) | `YYYY-MM-DD` |
| Monthly | `monthly` | 1st of month  | `YYYY-MM`    |

**Route params**: `{ tab?: "daily" | "monthly" }` — controls which tab is selected
on entry. Defaults to `"daily"`.

**Service layer** (`src/services/tasks.ts`):

- `subscribeToTasksWithProgress(uid, onUpdate, cadence)` — real-time dual Firestore
  subscription (Tasks collection + TaskProgress sub-collection), filtered by cadence
  and using the appropriate period key (`dayKey` for daily, `monthKey` for monthly).
- `claimTaskReward(taskId, dayKey?, cadence?)` — calls Cloud Function, auto-selects
  the correct period key based on cadence.
- `getDaysUntilMonthReset()` — days remaining until the 1st of next month.
- `getCurrentMonthKey()` — helper in `src/types/models.ts`, returns `"YYYY-MM"`.

**Cloud Functions** (`firebase-backend/functions/src/legacy.ts`):

- `updateTaskProgress` now handles both daily and monthly cadence — uses `dayKey` for
  daily tasks and `monthKey` (YYYY-MM) for monthly tasks; resets progress when the
  period changes.
- `claimTaskReward` verifies the period key matches for both daily and monthly tasks.
- `seedMonthlyTasks` — admin HTTP endpoint to seed 7 monthly challenge definitions
  (Seasoned Player, Monthly Champion, Chatterbox, Content Creator, Story Binge,
  Expanding Circles, Streak Master) with higher reward amounts (80–250 tokens).

---

## Anti-Cheat

Score limits defined in `src/types/games.ts` as `SCORE_LIMITS`:

```typescript
const SCORE_LIMITS: Partial<
  Record<ExtendedGameType, { max: number; minTime?: number }>
> = {
  reaction_tap: { max: 500, minTime: 100 }, // ms — can't be faster than 100ms
  timed_tap: { max: 200 }, // max 200 taps in 10s
  bounce_blitz: { max: 100000 },
  // ... limits for each game
};
```

Helper functions: `isScoreSuspicious()`, `getScoreLimit()`.

---

## Firestore Data Model

### Game Documents

```
/games/{gameId}
├── type: ExtendedGameType
├── status: "waiting" | "active" | "completed" | "abandoned"
├── players: string[]           # User IDs
├── currentTurn: string         # UID of current player
├── state: object               # Game-specific state (board, scores, etc.)
├── moves: Move[]               # Move history
├── winner: string | null
├── createdAt: Timestamp
└── updatedAt: Timestamp

/users/{uid}/gameStats
├── gamesPlayed: number
├── gamesWon: number
├── highScores: Record<ExtendedGameType, number>
└── achievements: string[]

/leaderboards/{gameType}
├── daily: LeaderboardEntry[]
├── weekly: LeaderboardEntry[]
└── allTime: LeaderboardEntry[]
```

---

## Testing

### Test Files

```
__tests__/games/
├── brickBreakerLogic.test.ts
├── [other game logic tests]

colyseus-server/tests/
├── rooms/
│   ├── BaseRoom.test.ts
│   ├── QuickplayRoom.test.ts
│   ├── TurnBasedRoom.test.ts
│   └── [game-specific room tests]
```

### Running Tests

```bash
# Client-side game tests
npx jest --testPathPattern="games"

# Colyseus server tests
cd colyseus-server && npm test
```

---

## Feature Flags

Game-related flags in `constants/featureFlags.ts`:

```typescript
export const PLAY_SCREEN = {
  FEATURED_BANNER: true,
  DAILY_CHALLENGE: true,
  FRIENDS_PLAYING: true,
  GAME_RECOMMENDATIONS: true,
  SEARCH: true,
  CATEGORY_FILTERS: true,
  STATS_SUMMARY: true,
};

export const THREE_JS_FEATURES = {
  INVITE_CARDS: true,
  HERO_BANNERS: true,
  GAME_BACKGROUNDS: false, // Performance-gated
  TROPHIES: true,
  FLOATING_ICONS: true,
};

export const COLYSEUS = {
  ENABLED: true,
  AUTO_RECONNECT: true,
  SPECTATOR_MODE: true,
};
```

---

## Invite System

> Updated 2026-02-17 as part of Segment 9 — Deprecations & Migration Complete.

### Universal Invite API (Primary)

All game invites now use `sendUniversalInvite()` from `src/services/gameInvites.ts`. The universal system supports DM (1:1), group, and multi-slot invites with host controls.

| Function                         | Purpose                                  |
| -------------------------------- | ---------------------------------------- |
| `sendUniversalInvite(params)`    | Create an invite (DM or group context)   |
| `claimInviteSlot(id, uid, …)`    | Recipient joins an invite slot           |
| `unclaimInviteSlot(id, uid)`     | Recipient leaves before game starts      |
| `startGameEarly(id, hostId)`     | Host triggers game start                 |
| `cancelUniversalInvite(id, …)`   | Host cancels invite (transactional)      |
| `completeGameInvite(id, …)`      | Mark invite completed when game finishes |
| `subscribeToUniversalInvite`     | Real-time listener for a single invite   |
| `subscribeToPlayPageInvites`     | Real-time listener for Play tab          |
| `subscribeToConversationInvites` | Real-time listener for chat view         |

### Universal Invite Statuses

| Status      | Meaning                                  | Transitions To              |
| ----------- | ---------------------------------------- | --------------------------- |
| `pending`   | Created, waiting for players             | filling, cancelled, expired |
| `filling`   | Some slots claimed, not full yet         | ready, cancelled, expired   |
| `ready`     | All required slots filled                | starting, cancelled         |
| `starting`  | Host triggered start, game being created | active                      |
| `active`    | Game in progress                         | completed                   |
| `completed` | Game finished                            | —                           |
| `expired`   | TTL exceeded before game started         | —                           |
| `cancelled` | Host cancelled                           | —                           |

### Invite UI Components

| Component             | Purpose                                   | Used By                 |
| --------------------- | ----------------------------------------- | ----------------------- |
| `InvitePickerModal`   | Unified Friends + Groups tabs for invites | All multiplayer screens |
| `FriendPickerModal`   | Friend picker for **scorecard sharing**   | All game screens        |
| `UniversalInviteCard` | Invite card with join/start buttons       | Chat & Play tab         |
| `CompactInviteCard`   | Condensed invite card for Play tab        | GamesHubScreen          |
| `GamePickerModal`     | Game selection when sending invite        | Chat screens            |

### Legacy Invite Functions (Deprecated / Removed)

Remaining deprecated exports in `src/services/gameInvites.ts`:

- `sendGameInvite()` → use `sendUniversalInvite()` instead
- `cancelGameInvite()` → use `cancelUniversalInvite()` (transactional)
- `getPendingInvites()` → use `subscribeToPlayPageInvites()`
- `subscribeToPendingInvites()` → use `subscribeToPlayPageInvites()`

Removed in cleanup pass on February 17, 2026 (zero callers):

- `acceptGameInvite()` → replaced by `claimInviteSlot()` + `startGameEarly()`
- `declineGameInvite()` → replaced by `unclaimInviteSlot()` / `cancelUniversalInvite()`
- `subscribeToInvite()` → replaced by `subscribeToUniversalInvite()`

The barrel export object `gameInvites` has been trimmed to remove dead entries.

---

## Deprecation Log

> Added 2026-02-17 as part of Segment 9 — Deprecations & Migration Complete.

| What                               | When       | Replacement                                       | Status              |
| ---------------------------------- | ---------- | ------------------------------------------------- | ------------------- |
| `GroupPickerModal`                 | Seg 9      | `InvitePickerModal` (unified)                     | Deleted             |
| `sendGameInvite()`                 | Seg 9      | `sendUniversalInvite()`                           | Deprecated (marked) |
| `acceptGameInvite()`               | Seg 9      | `claimInviteSlot()` + `startGameEarly()`          | Removed             |
| `declineGameInvite()`              | Seg 9      | `unclaimInviteSlot()` / `cancelUniversalInvite()` | Removed             |
| `cancelGameInvite()`               | Seg 9      | `cancelUniversalInvite()`                         | Deprecated (marked) |
| Legacy helper/query internals      | 2026-02-17 | Real-time subscriptions                           | Removed             |
| Per-game lobby components          | Seg 5      | `MultiplayerLobbyOverlay`                         | Already removed     |
| `PoolGameScreen`                   | Pre-Seg 0  | N/A (game removed)                                | Deleted             |
| Old `InviteStatus` type            | Seg 9      | `UniversalInviteStatus`                           | Deprecated (marked) |
| `gameInvites` barrel (legacy keys) | Seg 9      | Direct named imports                              | Trimmed             |

---

## Error Taxonomy & Observability Contracts

> Added 2026-02-17 as part of the Platform Improvements project (Segment 1).

### GameErrorCode (`src/types/gameErrors.ts`)

A canonical `enum GameErrorCode` covering all game-system failure modes. Every error carries:

| Field         | Type                      | Purpose                                    |
| ------------- | ------------------------- | ------------------------------------------ |
| `code`        | `GameErrorCode`           | Machine-readable code, e.g. `JOIN_TIMEOUT` |
| `message`     | `string`                  | Developer log message                      |
| `context?`    | `Record<string, unknown>` | Metadata (roomId, traceId, gameType, …)    |
| `recoveries?` | `GameRecoveryAction[]`    | Ordered list of buttons the UI can show    |

**Code categories:** `JOIN_*`, `AUTH_*`, `INVITE_*`, `LOBBY_*`, `ROOM_*`, `NETWORK_*`, `PROTOCOL_*`, `STATE_*`, `UNKNOWN`.

Use `createGameError(GameErrorCode.JOIN_TIMEOUT)` to get defaults pre-populated. Use `getUserMessage(code)` for a safe user-facing string.

### Protocol Version (`src/types/gameProtocol.ts`)

`GAME_PROTOCOL_VERSION` (currently `1`) is sent in every Colyseus join request via the `buildInfo` field. The server can reject clients whose `protocolVersion` is below its minimum, returning `PROTOCOL_VERSION_MISMATCH`.

Bump the constant whenever a Colyseus schema adds/removes fields or message shapes change.

`getClientBuildInfo()` builds a `ClientBuildInfo` snapshot (appVersion, platform, commitHash, buildNumber, protocolVersion) from the running Expo app.

### Canonical Join Options (`src/types/gameSession.ts`)

All Colyseus join calls should use `GameJoinOptions`:

```typescript
interface GameJoinOptions {
  token: string; // Firebase ID token
  protocolVersion: number; // GAME_PROTOCOL_VERSION
  buildInfo: ClientBuildInfo; // App metadata
  firestoreGameId?: string; // Room routing key
  spectator?: boolean; // Spectator mode
  traceId?: string; // Correlation ID
  inviteId?: string; // Source invite
  conversationId?: string; // Chat context
}
```

`GameSessionContext` captures the client-side routing context (gameType, entryPoint, mode, etc.) before the Colyseus connection is established.

### Trace IDs (`src/utils/trace.ts`)

`createTraceId(prefix?)` generates short, URL-safe correlation IDs (e.g. `gs-m5abc12-k7f9x2`). Create one per:

- **Invite**: `createTraceId("inv")` — stored in the GameInvites document.
- **Game session**: `createTraceId("gs")` — passed in `GameJoinOptions.traceId`.

Both client and server should include the traceId in every log line for that session.

### Room Name Resolver (`src/config/colyseus.ts`) — Segment 2

`resolveColyseusRoomName(gameType)` is the **throwing** counterpart to `getColyseusRoomName()`. It normalises `_game` suffix mismatches between `ExtendedGameType` values and COLYSEUS_ROOM_NAMES keys:

1. Direct lookup: `"chess_game"` → `"chess"`
2. Append `_game`: `"chess"` → `"chess_game"` → `"chess"`
3. Strip `_game` (edge case guard)

Throws `GameError(JOIN_ROOM_NOT_FOUND)` if no mapping exists.

### Join Options Builder (`src/services/colyseusJoin.ts`) — Segment 2

`buildJoinOptions(ctx: GameSessionContext): Promise<GameJoinOptions>` is the single factory for wire-format join payloads. It:

- Retrieves the Firebase ID token (throws `AUTH_NOT_SIGNED_IN` / `AUTH_TOKEN_MISSING`)
- Stamps `protocolVersion`, `buildInfo`, and a fresh `traceId`
- Copies optional routing fields from ctx (`firestoreGameId`, `spectator`, `inviteId`, `conversationId`)

### Context-Driven Join (`ColyseusService.joinWithContext`) — Segment 2

`colyseusService.joinWithContext(ctx, handlers, extras?)` is the **preferred** join path. It calls `resolveColyseusRoomName` + `buildJoinOptions` internally, maps SDK errors to `GameError`, and includes the traceId in all log lines. Hooks should migrate to this instead of `joinOrCreate`.

### Room Health Hook (`src/hooks/useRoomHealth.ts`) — Segment 2

`useRoomHealth(room, options?)` tracks the time since the last Colyseus state patch. Returns `{ stale, msSinceLastPatch, error }`. Raises `NETWORK_DISCONNECTED` when the threshold (default 15 s) is exceeded, and fires `onRecover` when patches resume. Does **not** reconnect — the parent decides.

---

## Debugging & Trace IDs

> Added 2026-02-17 as part of Segment 7 — Observability.

### End-to-End Trace ID Flow

Every multiplayer game session can be correlated across client logs, server logs, Firestore documents, and bug reports via a single **traceId**.

```
sendUniversalInvite()           createTraceId("inv")
  → GameInvites/{id}.traceId ──────────────────────────────┐
                                                            │
useGameLobby → lobby.invite.traceId ───────────────────────┤
                                                            │
Game screen builds GameSessionContext({ traceId }) ────────┤
                                                            │
buildJoinOptions(ctx) ──────────────────────────────────────┤
  → GameJoinOptions.traceId  (re-uses invite traceId)      │
                                                            │
colyseusService.joinWithContext(ctx) ───────────────────────┤
  → logs: traceId=inv-xxx                                   │
                                                            │
Server: roomLog = createServerLogger("ChessRoom")          │
  .child({ traceId: options.traceId }) ────────────────────┤
  → every server log line includes traceId                  │
                                                            │
createMatch(..., traceId)                                   │
  → TurnBasedGames/{id}.traceId ───────────────────────────┤
                                                            │
BugReports/{id}.traceId ───────────────────────────────────┘
  (from recovery action → submitBugReport)
```

**To filter all logs/docs for a session:** search for the invite's traceId (e.g. `inv-m5abc12-k7f9x2`). It appears in:

| Location                        | Field                                            |
| ------------------------------- | ------------------------------------------------ |
| Client console                  | `traceId=inv-xxx` in `joinWithContext` logs      |
| Colyseus server JSON logs       | `"traceId": "inv-xxx"` in every `roomLog.*` call |
| Firestore `GameInvites/{id}`    | `.traceId`                                       |
| Firestore `TurnBasedGames/{id}` | `.traceId`                                       |
| Firestore `BugReports/{id}`     | `.traceId`                                       |

**If no invite exists** (e.g. direct room join), `buildJoinOptions` falls back to `createTraceId("gs")`, producing a session-only traceId that still appears in server logs and bug reports.

### Debug HUD (`src/components/dev/GameDebugHUD.tsx`)

A dev-only (`__DEV__`) overlay that displays all game IDs, phases, players, and watchdog state in a collapsible panel. Gated at the component level — never renders in production.

**Usage in any multiplayer game screen:**

```tsx
import { GameDebugHUD } from "@/components/dev/GameDebugHUD";

// Inside render:
<GameDebugHUD
  controller={controller}
  room={mp.room}
  gameType="chess_game"
  traceId={lobby.invite?.traceId}
  firestoreGameId={lobby.effectiveGameId}
  inviteId={lobby.inviteId}
/>;
```

**Displayed fields:**

| Section  | Fields                                                                           |
| -------- | -------------------------------------------------------------------------------- |
| IDs      | gameType, inviteId, firestoreGameId, roomId, traceId (invite), traceId (session) |
| Phase    | lobby phase, room phase, isHost, isSpectator                                     |
| Me       | uid, sessionId                                                                   |
| Players  | index, name, ready flag, host flag                                               |
| Watchdog | isStuck, stuckDurationSec, lobbyStuck, lobbyStuckDurationSec                     |
| Error    | code, message (if active)                                                        |
| Banner   | connection banner text (if any)                                                  |

**Copy Debug Info** button serialises the entire state to JSON and opens Share sheet (or Alert fallback). The blob is suitable for pasting into a bug report or Slack message.

### Bug Report Service (`src/services/bugReports.ts`)

Two APIs:

| Function                                          | Use Case                                                  |
| ------------------------------------------------- | --------------------------------------------------------- |
| `submitBugReport(context, userNote?)`             | Full context — used by recovery action handlers           |
| `recordBugReport({ code, userMessage, context })` | Convenience wrapper — used by Debug HUD or manual reports |

Both write to Firestore `BugReports` collection with:

- Error info (code, message, user note)
- Game context (gameType, firestoreGameId, roomId, inviteId, **traceId**)
- State snapshot (roomPhase, lobbyPhase, wasStale, staleDurationSec)
- Build info (appVersion, platform, protocolVersion, commitHash)
- Metadata (uid, displayName, createdAt, status: "new")

---

## Spectator System

> Added 2026-02-17 as part of Segment 8 — Spectator QoL + Efficiency.

### Unified Entry Point

All spectator invites ("Watch Live") navigate to **`SpectatorViewScreen`** (`src/screens/games/SpectatorViewScreen.tsx`), regardless of whether the game is single-player or multiplayer. The `spectatorMode` route param determines the connection strategy:

| Route Param `spectatorMode` | Connection Strategy                                                           | Use Case                      |
| --------------------------- | ----------------------------------------------------------------------------- | ----------------------------- |
| `"sp"` (default)            | Joins a dedicated SpectatorRoom by `roomId`                                   | Single-player game spectating |
| `"multiplayer"`             | Joins the game room via `roomName` + `firestoreGameId` with `spectator: true` | Multiplayer game spectating   |

The screen renders a consistent UI for both modes: SpectatorBanner (leave button + viewer count), game info header, and phase indicators.

**Route Params:**

```typescript
type SpectatorViewRouteParams = {
  roomId?: string; // SP mode: SpectatorRoom ID
  roomName?: string; // Multiplayer mode: Colyseus room name
  firestoreGameId?: string; // Multiplayer mode: game doc ID
  spectatorMode?: "sp" | "multiplayer";
  gameType?: string;
  hostName?: string;
  inviteMode?: "spectate" | "boost" | "expedition";
  boostSessionEndsAt?: number;
};
```

### useSpectator Modes

The `useSpectator` hook (`src/hooks/useSpectator.ts`) supports four modes:

| Mode                               | Purpose                                       | Connection Owner |
| ---------------------------------- | --------------------------------------------- | ---------------- |
| `multiplayer-spectator`            | Embedded spectator (game screen owns room)    | Caller           |
| `multiplayer-spectator-standalone` | Standalone spectator (hook creates room)      | Hook             |
| `sp-host`                          | Single-player host (creates SpectatorRoom)    | Hook             |
| `sp-spectator`                     | Single-player spectator (joins SpectatorRoom) | Hook             |

### Throttling & Bandwidth Reduction

The Colyseus `SpectatorRoom` (server) applies two levels of throttling:

1. **gameStateJson throttle**: Large JSON state blobs are rate-limited to once per 500–1000 ms (adaptive based on spectator count). Scalar fields (score, level, lives) always pass through immediately.

2. **Adaptive patchRate**: The Colyseus patch rate is automatically adjusted based on spectator count:

| Spectators | Patch Rate | Effective FPS |
| ---------- | ---------- | ------------- |
| ≤ 5        | 100 ms     | ~10 fps       |
| 6–15       | 150 ms     | ~7 fps        |
| 16–30      | 250 ms     | ~4 fps        |
| 31+        | 500 ms     | ~2 fps        |

This reduces total bandwidth proportionally as rooms get crowded.

### SpectatorSessions (Firestore)

Collection: `SpectatorSessions/{roomId}`

Instead of mutating chat messages to show "Game Ended", a `SpectatorSessions/{roomId}` doc is created when the host starts hosting and updated to `status: "finished"` when the game ends.

```typescript
interface SpectatorSessionDoc {
  roomId: string;
  gameType: string;
  hostUid: string;
  hostName: string;
  status: "active" | "finished";
  finalScore?: number;
  createdAt: number;
  updatedAt: number;
}
```

**`SpectatorInviteBubble`** subscribes to this doc and uses it to determine finished state (alongside the legacy `finished` flag on the message content). This eliminates the need for message mutation in large groups.

Services: `src/services/spectatorSessions.ts` — `createSpectatorSession()`, `finishSpectatorSession()`, `getSpectatorSession()`, `subscribeToSpectatorSession()`.

### Spectator Capacity

- Default soft cap: **50 spectators** per SpectatorRoom (`maxSpectators` option)
- Hard cap: 51 maxClients (1 host + 50 spectators)
- Exceeding the soft cap → new spectators are rejected with code 4001
- Load shedding kicks in automatically as spectators increase (see throttling table above)

---

## Common Failure Modes & Recovery

> Added 2026-02-17 as part of Segments 6–7.

### Failure Mode Table

| Failure            | Error Code                  | Detection                    | Recovery Actions                                    | Notes                                  |
| ------------------ | --------------------------- | ---------------------------- | --------------------------------------------------- | -------------------------------------- |
| Room join timeout  | `JOIN_TIMEOUT`              | Colyseus SDK timeout         | Retry Join, Switch Mode                             | May indicate server down               |
| Room full          | `JOIN_ROOM_FULL`            | Colyseus rejection           | Reset Lobby, Cancel Invite                          | Race condition on slot                 |
| Auth expired       | `AUTH_TOKEN_EXPIRED`        | Server 401                   | Retry Join (re-auth)                                | Token auto-refreshes                   |
| Invite not found   | `INVITE_NOT_FOUND`          | Firestore miss               | Reset Lobby                                         | Invite expired/cancelled               |
| Invite expired     | `INVITE_EXPIRED`            | Status check                 | Cancel Invite                                       | Host must re-create                    |
| Lobby stuck        | `STUCK_WAITING`             | Client watchdog (30s)        | Rejoin Room, Reset Lobby, Report Bug, Cancel Invite | All players ready but room not playing |
| Room stale         | `ROOM_STALE`                | Client health watchdog (15s) | Resync (Rejoin), Report Bug                         | No state patches during gameplay       |
| Network disconnect | `NETWORK_DISCONNECTED`      | Health watchdog              | (auto-reconnect window)                             | 15–30s reconnection window             |
| Protocol mismatch  | `PROTOCOL_VERSION_MISMATCH` | Server rejection             | (force update)                                      | Bump `GAME_PROTOCOL_VERSION`           |
| Server stuck room  | `STUCK_ROOM` (server log)   | Server watchdog (60s)        | — (server-side only)                                | Logged for ops alerting                |

### Recovery Action Reference

| Action ID       | Label                | Backend Operation                                      |
| --------------- | -------------------- | ------------------------------------------------------ |
| `retry_join`    | Retry                | Re-invokes the join flow callback                      |
| `rejoin_room`   | Rejoin Room / Resync | `colyseusService.leaveRoom()` → re-join callback       |
| `reset_lobby`   | Reset Lobby          | `colyseusService.leaveRoom()` → `lobby.leaveLobby()`   |
| `switch_mode`   | Switch Mode          | Delegate to transport mode callback                    |
| `cancel_invite` | Cancel Invite        | `cancelUniversalInvite()` → leave room → navigate away |
| `report_bug`    | Report Bug           | `submitBugReport()` → Alert with report ID             |

### Watchdog Thresholds

| Watchdog            | Default   | Configurable                   | Location                  |
| ------------------- | --------- | ------------------------------ | ------------------------- |
| Room health (stale) | 15 000 ms | `watchdogThresholdMs` option   | `useRoomHealth`           |
| Lobby stuck         | 30 000 ms | `lobbyStuckThresholdMs` option | `useGameLobbyController`  |
| Server stuck room   | 60 000 ms | `timeoutMs` parameter          | `createStuckRoomWatchdog` |

---

## Release Checklist

> Added 2026-02-17 (Segment 10). Use this checklist before every release that touches the games platform.

### 1. Automated Checks

```bash
# Type-check (client + server)
npm run type-check
cd colyseus-server && npx tsc --noEmit && cd ..

# Lint
npm run lint

# Full test suite (client)
npm test

# Server tests
cd colyseus-server && npx jest --no-coverage && cd ..

# Game registry completeness
npm run verify:registry

# Smoke test (invite lifecycle)
npm run smoke
```

All must exit 0 (or show only pre-existing failures documented in `progress.md`).

### 2. Two-User Manual Test Plan

Perform with two physical devices or emulators signed into different accounts.

| #   | Step                                         | Expected                                             |
| --- | -------------------------------------------- | ---------------------------------------------------- |
| 1   | User A opens Play tab                        | Games hub loads, active games / invites visible      |
| 2   | User A taps a multiplayer game → "Challenge" | `InvitePickerModal` opens with Friends + Groups tabs |
| 3   | User A selects User B (DM invite)            | Invite appears in chat for User B                    |
| 4   | User B taps "Join" on invite card            | Slot claimed, status → `filling` or `ready`          |
| 5   | User A taps "Start"                          | Game screen opens for both users                     |
| 6   | Both players make moves                      | State syncs correctly, turn indicator updates        |
| 7   | One player force-closes app                  | Opponent sees "reconnecting…" overlay                |
| 8   | Player reopens app within 30s                | Reconnects to same room, game continues              |
| 9   | Game finishes (win/draw)                     | `GameOverModal` shown, invite status → `completed`   |
| 10  | Both return to Play tab                      | Completed game appears in history, no orphan invite  |

### 3. Invite Lifecycle Test Plan

| #   | Flow                                                 | Verify                                                 |
| --- | ---------------------------------------------------- | ------------------------------------------------------ |
| 1   | DM invite → claim → start → active → completed       | All status transitions fire, `GameInvites` doc updated |
| 2   | Group invite (3+ players) → fill → start             | `filling` → `ready` → `active` transitions             |
| 3   | Host cancels before start                            | Status → `cancelled`, invite card updates              |
| 4   | Invite expires (wait or set short expiration in dev) | Status → `expired`                                     |
| 5   | Duplicate claim attempt                              | Returns `{ success: false, error: "Already claimed" }` |
| 6   | Ineligible user tries to claim                       | Returns `{ success: false, error: "not eligible" }`    |

### 4. Spectator Test Plan

| #   | Step                                                              | Expected                                            |
| --- | ----------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Host starts single-player game with spectating                    | SpectatorRoom created, roomId in SpectatorSessions  |
| 2   | Host sends spectator invite to friend                             | Chat message with "Watch Live" button               |
| 3   | Friend taps "Watch Live"                                          | Joins SpectatorRoom, sees live game state           |
| 4   | Host finishes game                                                | Spectator sees final score, room phase → `finished` |
| 5   | SpectatorSessions doc updates                                     | `status: "finished"`, `finalScore` populated        |
| 6   | Multiplayer spectating: third user joins active game as spectator | Sees live state, cannot send moves                  |

### 5. Cleanup & Persistence Validation

| Check                           | How                                                                   |
| ------------------------------- | --------------------------------------------------------------------- |
| Suspended games restore         | Start chess, both leave mid-game → reopen → board restored            |
| Room disposal writes result     | Finish a game → check `RealtimeGameSessions` or `TurnBasedGames` doc  |
| `cleanupCompletedGameInvites()` | Run in console → old completed invites deleted                        |
| BugReports written              | Trigger Report Bug from Debug HUD → confirm `BugReports/{id}` created |
| SpectatorSessions cleaned up    | After spectator game ends → doc shows `status: "finished"`            |

### 6. Game Registry Sanity

Run `npm run verify:registry`. If it fails, a new game type was added without updating all registries. Fix by adding entries to:

- `GAME_METADATA` in `src/types/games.ts`
- `GAME_SCREEN_MAP` in `src/config/gameCategories.ts`
- `EXTENDED_GAME_SCORE_LIMITS` in `src/types/games.ts`
- `COLYSEUS_ROOM_NAMES` / `GAME_CATEGORY_MAP` in `src/config/colyseus.ts` (if multiplayer)
- `getDefaultInviteSettings()` in `src/services/gameInvites.ts` (if multiplayer)
- Navigation stack screen in `src/navigation/`
