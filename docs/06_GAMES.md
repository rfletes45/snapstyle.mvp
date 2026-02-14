# 06 — Games System

> **Last Updated**: 2025-07-14
> **Status**: ✅ Fully Implemented — 26 games + 2 coming soon

---

## Overview

The Play tab is one of the app's five main tabs, containing **26 playable mini-games** and **2 coming-soon titles** across four categories. Games support solo play, async turn-based multiplayer (via Firebase), and real-time multiplayer (via Colyseus WebSocket rooms).

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
