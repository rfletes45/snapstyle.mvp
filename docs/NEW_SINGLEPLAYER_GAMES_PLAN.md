# New Single-Player Games Implementation Plan

> Comprehensive implementation plan for 4 new single-player games designed to integrate seamlessly with the existing SnapStyle game ecosystem.

**Status**: ✅ Implementation Complete  
**Document Version**: 1.1  
**Last Updated**: February 2026  
**Author**: AI Assistant

---

## Implementation Summary

All 4 games have been fully implemented with complete test coverage:

| Game          | Logic Tests | Screen | Haptics | Documentation |
| ------------- | ----------- | ------ | ------- | ------------- |
| Tile Slide    | 39 ✅       | ✅     | ✅      | ✅            |
| Hex Collapse  | 54 ✅       | ✅     | ✅      | ✅            |
| Color Flow    | 62 ✅       | ✅     | ✅      | ✅            |
| Brick Breaker | 62 ✅       | ✅     | ✅      | ✅            |
| **Total**     | **217**     |        |         |               |

**Key Files:**

- Logic: `src/services/games/{tileSlide,hexCollapse,colorFlow,brickBreaker}Logic.ts`
- Screens: `src/screens/games/{TileSlide,HexCollapse,ColorFlow,BrickBreaker}GameScreen.tsx`
- Tests: `__tests__/games/{tileSlideLogic,hexCollapseLogic,colorFlowLogic,brickBreakerLogic}.test.ts`
- Types: `src/types/singlePlayerGames.ts`
- Docs: `docs/06_GAMES.md` (updated with all 4 games)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Game 1: Hex Collapse](#2-game-1-hex-collapse)
3. [Game 2: Color Flow](#3-game-2-color-flow)
4. [Game 3: Brick Breaker Snap](#4-game-3-brick-breaker-snap)
5. [Game 4: Tile Slide](#5-game-4-tile-slide)
6. [Shared Technical Architecture](#6-shared-technical-architecture)
7. [Achievement System Integration](#7-achievement-system-integration)
8. [Development Phases](#8-development-phases)
9. [Testing Requirements](#9-testing-requirements)
10. [Appendix A: File Structure](#appendix-a-file-structure)
11. [Appendix B: Type Definitions](#appendix-b-type-definitions)

---

## 1. Overview

### 1.1 Goals

This plan defines 4 new single-player games that:

- ✅ Fit existing category structure (Action, Puzzle, Daily)
- ✅ Follow established code patterns (state management, game loops, session recording)
- ✅ Include comprehensive achievement systems
- ✅ Support leaderboards and friend score sharing
- ✅ Use existing UI components (GameOverModal, FriendPickerModal)
- ✅ Integrate with haptic feedback system

### 1.2 Game Selection Summary

| Game                   | Category | Inspiration                 | Complexity  | Est. Time |
| ---------------------- | -------- | --------------------------- | ----------- | --------- |
| **Hex Collapse**       | Puzzle   | Hexagonal Match-3           | Medium      | 2 weeks   |
| **Color Flow**         | Puzzle   | Flow Free / Pipe Connect    | Medium      | 2 weeks   |
| **Brick Breaker Snap** | Action   | Classic Breakout/Arkanoid   | Medium-High | 2.5 weeks |
| **Tile Slide**         | Puzzle   | 15-Puzzle / Sliding Puzzles | Low-Medium  | 1.5 weeks |

### 1.3 Existing Single-Player Games Reference

| Game           | Category | Game Loop Type                        |
| -------------- | -------- | ------------------------------------- |
| `reaction_tap` | Action   | Event-driven                          |
| `timed_tap`    | Action   | Timer-based                           |
| `bounce_blitz` | Action   | requestAnimationFrame                 |
| `snap_snake`   | Action   | setInterval tick                      |
| `snap_2048`    | Puzzle   | Move-based (swipe)                    |
| `memory_snap`  | Puzzle   | Event-driven (tap)                    |
| `cart_course`  | Puzzle   | requestAnimationFrame + accelerometer |
| `word_snap`    | Daily    | Event-driven                          |

---

## 2. Game 1: Hex Collapse

### 2.1 Game Concept

**Type**: Hexagonal puzzle game  
**Inspiration**: Hexic, Block Hexa Puzzle, Honeycomb games  
**Category**: `puzzle`  
**Game Loop Type**: Event-driven with animation

**Core Experience**:
Players tap clusters of 3+ same-colored hexagons to collapse them. New hexagons fall from above to fill gaps. Chain reactions create combos for bonus points. Game ends when no valid moves remain.

### 2.2 Key Features

| Feature             | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| **Hex Grid**        | 7-column staggered hexagonal grid (8-9 rows depending on column) |
| **Tap-to-Collapse** | Tap any cluster of 3+ matching hexagons to remove them           |
| **Gravity System**  | Hexagons fall to fill gaps, new ones spawn from top              |
| **Combo System**    | Chain reactions multiply score (2x, 3x, 4x+)                     |
| **Power-ups**       | Rainbow hex (matches any), Bomb hex (clears radius)              |
| **No Timer**        | Relaxed puzzle gameplay (scored on moves + combos)               |

### 2.3 Game Rules

1. **Grid Setup**: 7 columns × 8-9 rows of colored hexagons
2. **Color Palette**: 5 colors (Red, Blue, Green, Yellow, Purple)
3. **Valid Move**: Tap cluster of 3+ adjacent same-colored hexagons
4. **Collapse Animation**: 300ms shrink + fade out
5. **Gravity**: Hexagons fall at 400ms per row
6. **Refill**: New random hexagons spawn from top
7. **Combo Detection**: Check for new clusters after each collapse
8. **Game Over**: No clusters of 3+ exist anywhere on board

### 2.4 Scoring System

| Action            | Points                  |
| ----------------- | ----------------------- |
| 3-hex cluster     | 30                      |
| 4-hex cluster     | 50                      |
| 5-hex cluster     | 80                      |
| 6-hex cluster     | 120                     |
| 7+ hex cluster    | 120 + 50 per additional |
| Combo multiplier  | x1.5 per chain level    |
| Rainbow hex bonus | +25                     |
| Bomb hex bonus    | +50                     |

### 2.5 Visual Design

```
    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      (Row 0 - 7 hexes)
   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     (Row 1 - 8 hexes, offset)
    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      (Row 2 - 7 hexes)
   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     (Row 3 - 8 hexes, offset)
    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      (Row 4)
   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     (Row 5)
    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      (Row 6)
   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     (Row 7)
```

**Color Scheme**:

- Background: Dark gradient (#1a1a2e → #16213e)
- Hexagons: Vibrant with subtle gradient and border
- Highlight: Glow effect on valid clusters
- Animations: Scale pulse on hover, satisfying collapse

### 2.6 State Interface

```typescript
export interface HexCollapseState extends BaseSinglePlayerState {
  gameType: "hex_collapse";
  category: "puzzle";

  // Grid state (2D array with staggered columns)
  grid: (HexCell | null)[][];

  // Game progress
  moveCount: number;
  comboLevel: number;
  maxCombo: number;
  totalHexesCleared: number;

  // Animation state
  animationPhase: "idle" | "collapsing" | "falling" | "refilling";

  // Power-ups collected
  rainbowHexesUsed: number;
  bombHexesUsed: number;
}

export interface HexCell {
  id: string;
  color: HexColor;
  type: "normal" | "rainbow" | "bomb";
  row: number;
  col: number;
}

export type HexColor = "red" | "blue" | "green" | "yellow" | "purple";
```

### 2.7 Core Logic Functions

```typescript
// src/services/games/hexCollapseLogic.ts

export function createInitialGrid(config: HexCollapseConfig): HexCell[][];
export function findCluster(
  grid: HexCell[][],
  row: number,
  col: number,
): HexCell[];
export function findAllClusters(grid: HexCell[][]): HexCell[][];
export function collapseCluster(
  state: HexCollapseState,
  cluster: HexCell[],
): HexCollapseState;
export function applyGravity(grid: HexCell[][]): HexCell[][];
export function refillGrid(grid: HexCell[][]): HexCell[][];
export function calculateScore(clusterSize: number, comboLevel: number): number;
export function hasValidMoves(grid: HexCell[][]): boolean;
export function getHexNeighbors(
  row: number,
  col: number,
  isOffsetRow: boolean,
): Position[];
```

---

## 3. Game 2: Color Flow

### 3.1 Game Concept

**Type**: Path-drawing puzzle  
**Inspiration**: Flow Free, Pipe Mania  
**Category**: `puzzle`  
**Game Loop Type**: Event-driven (touch drag)

**Core Experience**:
Connect matching colored dots by drawing paths. Paths cannot cross. Fill the entire grid to complete each level. Puzzles increase in complexity with more colors and larger grids.

### 3.2 Key Features

| Feature          | Description                                          |
| ---------------- | ---------------------------------------------------- |
| **Grid Sizes**   | 5×5 (Easy), 7×7 (Medium), 9×9 (Hard), 11×11 (Expert) |
| **Color Pairs**  | 3-8 pairs of matching dots to connect                |
| **Path Drawing** | Touch-drag from dot to create path                   |
| **No Crossing**  | Paths cannot overlap or cross each other             |
| **Grid Fill**    | Must fill every cell to complete puzzle              |
| **Level Packs**  | 50+ procedurally generated levels per difficulty     |
| **Star Rating**  | 1-3 stars based on move efficiency                   |

### 3.3 Game Rules

1. **Objective**: Connect all same-colored dot pairs with continuous paths
2. **Path Rules**: Paths move horizontally or vertically (no diagonal)
3. **No Overlap**: Paths cannot cross or share cells
4. **Full Coverage**: Every grid cell must be filled by a path
5. **Undo**: Can clear a path by tapping its start dot
6. **Level Complete**: All pairs connected + grid 100% filled

### 3.4 Scoring System

| Action                   | Points          |
| ------------------------ | --------------- |
| Level complete           | 100 base        |
| Perfect (no undos)       | +50 bonus       |
| Time bonus (< 30s)       | +30             |
| Time bonus (< 60s)       | +15             |
| 3-star rating            | +25             |
| Streak bonus (3+ levels) | x1.1 multiplier |

**Star Rating**:

- ⭐⭐⭐ = Optimal moves (puzzle minimum)
- ⭐⭐ = Within 5 extra moves
- ⭐ = Completed puzzle

### 3.5 Visual Design

```
┌───┬───┬───┬───┬───┐
│ 🔴│   │   │   │ 🟢│
├───┼───┼───┼───┼───┤
│   │ 🔵│   │ 🟡│   │
├───┼───┼───┼───┼───┤
│   │   │   │   │   │
├───┼───┼───┼───┼───┤
│ 🟢│   │ 🟡│   │ 🔵│
├───┼───┼───┼───┼───┤
│   │   │   │   │ 🔴│
└───┴───┴───┴───┴───┘
```

**Path Rendering**:

- Smooth rounded corners on turns
- Animated "flow" shimmer effect when path complete
- Color-coded paths with subtle gradient
- Celebration animation on level complete

### 3.6 State Interface

```typescript
export interface ColorFlowState extends BaseSinglePlayerState {
  gameType: "color_flow";
  category: "puzzle";

  // Puzzle data
  gridSize: number;
  dots: ColorFlowDot[];
  paths: ColorFlowPath[];

  // Progress
  currentLevel: number;
  difficulty: "easy" | "medium" | "hard" | "expert";
  levelsCompleted: number;
  totalStars: number;

  // Current level stats
  moveCount: number;
  undoCount: number;
  coveragePercent: number;

  // Drawing state
  isDrawing: boolean;
  activeColor: FlowColor | null;
  activePath: Position[];
}

export interface ColorFlowDot {
  color: FlowColor;
  position: Position;
  isConnected: boolean;
}

export interface ColorFlowPath {
  color: FlowColor;
  cells: Position[];
  isComplete: boolean;
}

export type FlowColor =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "purple"
  | "cyan"
  | "pink";
```

### 3.7 Core Logic Functions

```typescript
// src/services/games/colorFlowLogic.ts

export function generatePuzzle(
  size: number,
  pairCount: number,
): ColorFlowPuzzle;
export function validatePuzzleSolvable(puzzle: ColorFlowPuzzle): boolean;
export function startPath(
  state: ColorFlowState,
  position: Position,
): ColorFlowState;
export function extendPath(
  state: ColorFlowState,
  position: Position,
): ColorFlowState;
export function finishPath(state: ColorFlowState): ColorFlowState;
export function clearPath(
  state: ColorFlowState,
  color: FlowColor,
): ColorFlowState;
export function calculateCoverage(state: ColorFlowState): number;
export function isLevelComplete(state: ColorFlowState): boolean;
export function calculateStarRating(
  moves: number,
  optimalMoves: number,
): 1 | 2 | 3;
```

---

## 4. Game 3: Brick Breaker Snap

### 4.1 Game Concept

**Type**: Classic arcade action  
**Inspiration**: Breakout, Arkanoid, DX-Ball  
**Category**: `quick_play` (Action)  
**Game Loop Type**: `requestAnimationFrame` physics loop

**Core Experience**:
Control a paddle to bounce a ball and destroy all bricks. Collect power-ups that fall from destroyed bricks. Progress through increasingly challenging levels with different brick patterns and types.

### 4.2 Key Features

| Feature            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| **Paddle Control** | Touch/drag to move paddle horizontally                |
| **Ball Physics**   | Realistic bounce angles based on paddle contact point |
| **Brick Types**    | Standard, Hard (2 hits), Indestructible, Explosive    |
| **Power-ups**      | 8 different power-ups (positive and negative)         |
| **Multi-ball**     | Up to 5 balls simultaneously                          |
| **Levels**         | 30+ hand-crafted levels with patterns                 |
| **Lives System**   | 3 lives, lose one when ball falls                     |

### 4.3 Game Rules

1. **Ball Launch**: Tap to release ball from paddle
2. **Paddle Movement**: Drag finger to move paddle left/right
3. **Bounce Physics**: Ball angle changes based on where it hits paddle
4. **Brick Destruction**: Most bricks destroyed in 1 hit
5. **Level Complete**: Destroy all destroyable bricks
6. **Life Lost**: Ball falls below paddle
7. **Game Over**: All lives lost

### 4.4 Power-Up System

| Power-up       | Icon   | Effect                | Duration     |
| -------------- | ------ | --------------------- | ------------ |
| **Expand**     | ↔️     | Paddle 50% wider      | 15s          |
| **Shrink**     | ↕️     | Paddle 30% narrower   | 15s          |
| **Multi-Ball** | ⚪⚪⚪ | Spawn 2 extra balls   | Until caught |
| **Laser**      | 🔫     | Paddle shoots lasers  | 20s          |
| **Slow**       | 🐢     | Ball 30% slower       | 12s          |
| **Fast**       | ⚡     | Ball 30% faster       | 12s          |
| **Sticky**     | 🍯     | Ball sticks to paddle | 3 catches    |
| **Extra Life** | ❤️     | +1 life               | Permanent    |

### 4.5 Brick Types

| Type           | Hits | Color   | Points | Special                  |
| -------------- | ---- | ------- | ------ | ------------------------ |
| Standard       | 1    | Various | 10     | None                     |
| Silver         | 2    | Silver  | 25     | Changes color on hit     |
| Gold           | 3    | Gold    | 50     | Sparkle effect           |
| Indestructible | ∞    | Gray    | 0      | Cannot be destroyed      |
| Explosive      | 1    | Orange  | 15     | Destroys adjacent bricks |
| Mystery        | 1    | Rainbow | 20     | Always drops power-up    |

### 4.6 Scoring System

| Action                      | Points      |
| --------------------------- | ----------- |
| Standard brick              | 10          |
| Silver brick                | 25          |
| Gold brick                  | 50          |
| Explosive chain (per brick) | 15          |
| Level complete bonus        | 100 × level |
| No-miss level bonus         | +200        |
| Speed bonus (< 60s)         | +150        |
| Multi-ball active bonus     | ×1.5        |

### 4.7 Visual Design

```
┌────────────────────────────────────────┐
│  ███ ███ ███ ███ ███ ███ ███ ███      │  <- Bricks
│  ███ ███ ███ ███ ███ ███ ███ ███      │
│  ███ ███     ███     ███ ███ ███      │
│  ███     ███     ███     ███ ███      │
│                                        │
│                                        │
│              ○                         │  <- Ball
│                                        │
│                                        │
│         ════════════                   │  <- Paddle
└────────────────────────────────────────┘
   ❤️❤️❤️  Score: 1,250  Level: 3
```

### 4.8 State Interface

```typescript
export interface BrickBreakerState extends BaseSinglePlayerState {
  gameType: "brick_breaker";
  category: "quick_play";

  // Game objects
  paddle: PaddleState;
  balls: BallState[];
  bricks: BrickState[];
  powerUps: FallingPowerUp[];
  lasers: LaserState[];

  // Progress
  currentLevel: number;
  lives: number;
  maxLives: 3;

  // Active effects
  activeEffects: ActiveEffect[];

  // Stats
  bricksDestroyed: number;
  powerUpsCollected: number;
  maxCombo: number;
  perfectLevels: number;
}

export interface PaddleState {
  x: number;
  width: number;
  baseWidth: number;
  hasSticky: boolean;
  hasLaser: boolean;
}

export interface BallState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isStuck: boolean;
}

export interface BrickState {
  id: string;
  row: number;
  col: number;
  type: BrickType;
  hitsRemaining: number;
  hasPowerUp: boolean;
}
```

### 4.9 Physics Constants

```typescript
export const BRICK_BREAKER_CONFIG = {
  // Canvas
  canvasWidth: 360,
  canvasHeight: 640,

  // Paddle
  paddleWidth: 80,
  paddleHeight: 12,
  paddleY: 580,
  paddleSpeed: 15,

  // Ball
  ballRadius: 8,
  ballBaseSpeed: 5,
  maxBallSpeed: 12,

  // Bricks
  brickRows: 6,
  brickCols: 8,
  brickWidth: 40,
  brickHeight: 16,
  brickPadding: 4,

  // Physics
  speedIncreasePerLevel: 0.5,
  bounceVariation: 0.2,
};
```

---

## 5. Game 4: Tile Slide

### 5.1 Game Concept

**Type**: Classic sliding puzzle  
**Inspiration**: 15-Puzzle, Sliding tiles, Rush Hour  
**Category**: `puzzle`  
**Game Loop Type**: Event-driven (tap to slide)

**Core Experience**:
Rearrange numbered tiles into order by sliding them into the empty space. Multiple puzzle sizes and image-based variants add variety. Compete for fewest moves and fastest times.

### 5.2 Key Features

| Feature               | Description                                      |
| --------------------- | ------------------------------------------------ |
| **Puzzle Sizes**      | 3×3 (8-puzzle), 4×4 (15-puzzle), 5×5 (24-puzzle) |
| **Number Mode**       | Classic numbered tiles                           |
| **Image Mode**        | Reconstruct scrambled images                     |
| **Daily Puzzle**      | New puzzle each day for all players              |
| **Solvability Check** | Only generates solvable configurations           |
| **Move Counter**      | Track moves toward optimal solution              |
| **Hint System**       | Highlight next optimal move (costs points)       |

### 5.3 Game Rules

1. **Grid Setup**: N×N grid with N²-1 numbered tiles and 1 empty space
2. **Valid Move**: Tap tile adjacent to empty space to slide it
3. **Win Condition**: Tiles arranged 1 to N²-1, empty space at end
4. **Shuffle**: Board randomly shuffled with guaranteed solvability
5. **No Time Limit**: Score based on moves and optional time bonus

### 5.4 Scoring System

| Factor                | Points |
| --------------------- | ------ |
| Puzzle complete (3×3) | 100    |
| Puzzle complete (4×4) | 200    |
| Puzzle complete (5×5) | 350    |
| Optimal moves bonus   | +100   |
| Near-optimal (< 120%) | +50    |
| Time bonus (< 30s)    | +40    |
| Time bonus (< 60s)    | +20    |
| No hints used         | +30    |
| Per hint used         | -10    |

**Optimal Moves Reference**:

- 3×3: ~22 moves average
- 4×4: ~50 moves average
- 5×5: ~100 moves average

### 5.5 Visual Design

```
┌─────────────────────┐
│  1  │  2  │  3  │  4  │
├─────┼─────┼─────┼─────┤
│  5  │  6  │  7  │  8  │
├─────┼─────┼─────┼─────┤
│  9  │ 10  │ 11  │ 12  │
├─────┼─────┼─────┼─────┤
│ 13  │ 14  │ 15  │     │  <- Empty space
└─────────────────────┘
    Moves: 23  ⏱️ 0:45
```

**Animations**:

- Smooth 200ms slide animation
- Subtle scale pop when tile reaches correct position
- Celebration confetti on puzzle complete
- Shake animation on invalid move attempt

### 5.6 State Interface

```typescript
export interface TileSlideState extends BaseSinglePlayerState {
  gameType: "tile_slide";
  category: "puzzle";

  // Puzzle configuration
  gridSize: 3 | 4 | 5;
  mode: "numbers" | "image";
  imageUri?: string;

  // Board state (flat array, row-major order)
  tiles: (number | null)[]; // null = empty space
  emptyIndex: number;

  // Solution reference
  solvedState: number[];

  // Progress
  moveCount: number;
  hintsUsed: number;
  optimalMoves: number;

  // Daily puzzle
  isDailyPuzzle: boolean;
  dailyPuzzleDate?: string;

  // Animation
  slidingTile: number | null;
  slideDirection: "up" | "down" | "left" | "right" | null;
}
```

### 5.7 Core Logic Functions

```typescript
// src/services/games/tileSlideLogic.ts

export function createPuzzle(size: 3 | 4 | 5): TileSlideState;
export function shufflePuzzle(solved: number[], moves: number): number[];
export function isSolvable(tiles: number[]): boolean;
export function getValidMoves(state: TileSlideState): number[];
export function moveTile(
  state: TileSlideState,
  tileIndex: number,
): TileSlideState;
export function isSolved(state: TileSlideState): boolean;
export function getOptimalMoveHint(state: TileSlideState): number | null;
export function generateDailyPuzzle(date: string, size: number): TileSlideState;
export function calculateManhattanDistance(tiles: number[]): number;
```

### 5.8 Solvability Algorithm

The puzzle uses the **inversion count** method:

- Count pairs where a larger number precedes a smaller one
- For odd-sized grids: solvable if inversions is even
- For even-sized grids: solvable if inversions + empty row is odd

```typescript
function isSolvable(tiles: number[], gridSize: number): boolean {
  const inversions = countInversions(tiles);
  if (gridSize % 2 === 1) {
    return inversions % 2 === 0;
  } else {
    const emptyRow = Math.floor(tiles.indexOf(0) / gridSize);
    return (inversions + emptyRow) % 2 === 1;
  }
}
```

---

## 6. Shared Technical Architecture

### 6.1 Common Dependencies

All games will use these existing dependencies:

- `react-native-reanimated` - Smooth animations
- `react-native-gesture-handler` - Touch handling
- `react-native-paper` - UI components
- `@expo/vector-icons` - Icons
- Existing hooks: `useGameHaptics`, `useAuth`, `useSnackbar`

### 6.2 Shared Component Pattern

```typescript
// Screen component structure
export default function GameScreen({ navigation, route }) {
  // Auth & context
  const { currentFirebaseUser } = useAuth();
  const { user } = useUser();
  const theme = useTheme();
  const haptics = useGameHaptics();

  // Game state
  const [gameState, setGameState] = useState<GameState>(() => createInitialState());
  const [showGameOverModal, setShowGameOverModal] = useState(false);

  // Refs for game loop
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // High score loading
  useEffect(() => { loadHighScore(); }, []);

  // Game over handling
  const handleGameOver = useCallback(async () => {
    haptics.gameOverPattern(/* win condition */);
    await recordSession();
    setShowGameOverModal(true);
  }, []);

  return (
    <SafeAreaView>
      <Header />
      <GameBoard />
      <GameOverModal />
      <FriendPickerModal />
    </SafeAreaView>
  );
}
```

### 6.3 File Structure Per Game

```
src/
├── screens/games/
│   └── GameNameGameScreen.tsx     # Main screen component
├── services/games/
│   └── gameNameLogic.ts           # Pure game logic functions
├── components/games/
│   └── GameName/                   # Game-specific components
│       ├── GameBoard.tsx
│       ├── Tile.tsx
│       └── index.ts
```

### 6.4 Type Registration

Each game needs entries in:

1. **`src/types/games.ts`**:
   - Add to `SinglePlayerGameType` union
   - Add metadata to `GAME_METADATA`

2. **`src/types/singlePlayerGames.ts`**:
   - Define `GameNameState` interface
   - Define `GameNameStats` interface
   - Define `GAME_NAME_CONFIG` constants
   - Add to `SinglePlayerGameStats` union

3. **`src/config/gameCategories.ts`**:
   - Add to `GAME_SCREEN_MAP`

4. **`src/navigation/RootNavigator.tsx`**:
   - Import and register screen component

---

## 7. Achievement System Integration

### 7.1 Achievement Categories

Add to `src/types/achievements.ts`:

```typescript
export type AchievementCategory =
  | ... // existing
  | "hex_collapse"
  | "color_flow"
  | "brick_breaker"
  | "tile_slide";
```

### 7.2 Hex Collapse Achievements

| ID               | Name              | Description                       | Tier     | Trigger         |
| ---------------- | ----------------- | --------------------------------- | -------- | --------------- |
| `hex_first_game` | Hexagon Novice    | Play your first Hex Collapse game | Bronze   | `game_played`   |
| `hex_score_500`  | Hex Hunter        | Score 500 points in one game      | Bronze   | `score_reached` |
| `hex_score_2000` | Hex Master        | Score 2,000 points in one game    | Silver   | `score_reached` |
| `hex_score_5000` | Hex Legend        | Score 5,000 points in one game    | Gold     | `score_reached` |
| `hex_combo_3`    | Chain Reaction    | Achieve a 3x combo                | Bronze   | `combo_reached` |
| `hex_combo_5`    | Combo King        | Achieve a 5x combo                | Silver   | `combo_reached` |
| `hex_combo_10`   | Combo God         | Achieve a 10x combo               | Platinum | `combo_reached` |
| `hex_clear_100`  | Hex Destroyer     | Clear 100 hexagons in one game    | Silver   | `hexes_cleared` |
| `hex_clear_200`  | Hex Annihilator   | Clear 200 hexagons in one game    | Gold     | `hexes_cleared` |
| `hex_rainbow_5`  | Rainbow Collector | Use 5 rainbow hexes               | Silver   | `powerups_used` |
| `hex_marathon`   | Hex Enthusiast    | Play 25 games                     | Silver   | `games_played`  |

### 7.3 Color Flow Achievements

| ID                     | Name           | Description                          | Tier     | Trigger          |
| ---------------------- | -------------- | ------------------------------------ | -------- | ---------------- |
| `flow_first_level`     | First Flow     | Complete your first puzzle           | Bronze   | `level_complete` |
| `flow_pack_easy`       | Easy Pack      | Complete all Easy levels             | Silver   | `pack_complete`  |
| `flow_pack_medium`     | Medium Master  | Complete all Medium levels           | Gold     | `pack_complete`  |
| `flow_pack_hard`       | Hard Conqueror | Complete all Hard levels             | Platinum | `pack_complete`  |
| `flow_perfect_10`      | Perfect Flow   | Get 3 stars on 10 levels             | Silver   | `stars_earned`   |
| `flow_no_undo`         | Clean Solver   | Complete 5 levels without undo       | Silver   | `no_undo_streak` |
| `flow_speed_30`        | Speed Demon    | Complete a level in under 30 seconds | Silver   | `time_challenge` |
| `flow_streak_10`       | On a Roll      | Complete 10 levels in a row          | Gold     | `level_streak`   |
| `flow_total_stars_50`  | Star Collector | Earn 50 total stars                  | Silver   | `total_stars`    |
| `flow_total_stars_150` | Star Master    | Earn 150 total stars                 | Gold     | `total_stars`    |

### 7.4 Brick Breaker Achievements

| ID                    | Name           | Description                            | Tier     | Trigger              |
| --------------------- | -------------- | -------------------------------------- | -------- | -------------------- |
| `brick_first_level`   | Block Buster   | Complete your first level              | Bronze   | `level_complete`     |
| `brick_level_10`      | Brick Veteran  | Reach level 10                         | Silver   | `level_reached`      |
| `brick_level_25`      | Brick Master   | Reach level 25                         | Gold     | `level_reached`      |
| `brick_perfect_level` | Perfect Clear  | Complete a level without losing a ball | Silver   | `perfect_level`      |
| `brick_multi_3`       | Triple Threat  | Have 3 balls active at once            | Bronze   | `multi_ball`         |
| `brick_multi_5`       | Ball Chaos     | Have 5 balls active at once            | Silver   | `multi_ball`         |
| `brick_powerups_20`   | Power Hungry   | Collect 20 power-ups                   | Silver   | `powerups_collected` |
| `brick_chain_5`       | Chain Reaction | Destroy 5 bricks with one explosive    | Gold     | `chain_destroy`      |
| `brick_score_5000`    | Score Hunter   | Score 5,000 points                     | Silver   | `score_reached`      |
| `brick_score_25000`   | Score Legend   | Score 25,000 points                    | Platinum | `score_reached`      |
| `brick_no_powerup`    | Purist         | Complete a level without power-ups     | Gold     | `no_powerup_level`   |

### 7.5 Tile Slide Achievements

| ID                   | Name             | Description                    | Tier   | Trigger           |
| -------------------- | ---------------- | ------------------------------ | ------ | ----------------- |
| `slide_first_solve`  | First Slide      | Solve your first puzzle        | Bronze | `puzzle_complete` |
| `slide_3x3_optimal`  | 8-Puzzle Pro     | Solve 3×3 in optimal moves     | Silver | `optimal_solve`   |
| `slide_4x4_complete` | 15-Puzzle Solver | Solve a 4×4 puzzle             | Bronze | `puzzle_complete` |
| `slide_4x4_optimal`  | 15-Puzzle Master | Solve 4×4 near-optimal         | Gold   | `optimal_solve`   |
| `slide_5x5_complete` | 24-Puzzle Hero   | Solve a 5×5 puzzle             | Silver | `puzzle_complete` |
| `slide_5x5_fast`     | Speed Slider     | Solve 5×5 in under 2 minutes   | Gold   | `time_challenge`  |
| `slide_no_hints`     | Unassisted       | Solve 10 puzzles without hints | Silver | `no_hint_streak`  |
| `slide_daily_7`      | Week Warrior     | Complete 7 daily puzzles       | Silver | `daily_streak`    |
| `slide_daily_30`     | Monthly Master   | Complete 30 daily puzzles      | Gold   | `daily_streak`    |
| `slide_total_50`     | Puzzle Addict    | Solve 50 total puzzles         | Silver | `puzzles_solved`  |
| `slide_image_10`     | Picture Perfect  | Solve 10 image puzzles         | Silver | `image_puzzles`   |

### 7.6 Achievement Definition Template

```typescript
// Add to src/data/achievements.ts

export const HEX_COLLAPSE_ACHIEVEMENTS: GameAchievementDefinition[] = [
  {
    id: "hex_first_game",
    name: "Hexagon Novice",
    description: "Play your first Hex Collapse game",
    icon: "⬡",
    category: "hex_collapse",
    tier: "bronze",
    xpReward: TIER_REWARDS.bronze.xp,
    coinReward: TIER_REWARDS.bronze.coins,
    secret: false,
    repeatable: false,
    trigger: {
      type: "game_played",
      conditions: { gameType: "hex_collapse", count: 1 },
    },
    progressType: "instant",
  },
  // ... more achievements
];
```

---

## 8. Development Phases

### Phase 1: Foundation (Week 1)

**Focus**: Type definitions and shared infrastructure

- [x] Add 4 new game types to `SinglePlayerGameType` union
- [x] Add game metadata to `GAME_METADATA`
- [x] Create state interfaces in `singlePlayerGames.ts`
- [x] Create config constants for each game
- [x] Add achievement categories to types
- [x] Add screen mappings to `GAME_SCREEN_MAP`
- [x] Register screens in `RootNavigator.tsx`

### Phase 2: Tile Slide (Week 2)

**Focus**: Simplest game first to validate patterns

- [x] Create `tileSlideLogic.ts` with pure functions
- [x] Implement solvability algorithm
- [x] Create `TileSlideGameScreen.tsx`
- [x] Add tile slide animations
- [x] Implement hint system
- [x] Add session recording
- [x] Create tile slide achievements (11 achievements)
- [x] Write unit tests for logic
- [ ] Manual testing on iOS/Android

### Phase 3: Hex Collapse (Week 3-4)

**Focus**: Hexagonal grid system

- [x] Create `hexCollapseLogic.ts`
- [x] Implement hex grid coordinate system
- [x] Implement cluster detection algorithm
- [x] Create `HexCollapseGameScreen.tsx`
- [x] Build hexagon rendering component
- [x] Add collapse + gravity animations
- [x] Implement combo system
- [x] Add power-up hexes
- [x] Add session recording
- [x] Create hex collapse achievements (11 achievements)
- [x] Write unit tests
- [ ] Manual testing

### Phase 4: Color Flow (Week 5-6) ✅

**Focus**: Path drawing and puzzle generation

- [x] Create `colorFlowLogic.ts`
- [x] Implement puzzle generation algorithm
- [x] Implement solvability validation
- [x] Create `ColorFlowGameScreen.tsx`
- [x] Build path drawing gesture handler
- [x] Add path rendering with smooth corners
- [x] Implement level progression
- [x] Add star rating system
- [x] Add session recording
- [x] Create color flow achievements (10 achievements)
- [x] Write unit tests
- [ ] Manual testing

### Phase 5: Brick Breaker (Week 7-8.5) ✅

**Focus**: Physics-based action game

- [x] Create `brickBreakerLogic.ts`
- [x] Implement ball physics
- [x] Implement paddle-ball collision with angle variation
- [x] Implement brick collision detection
- [x] Create `BrickBreakerGameScreen.tsx`
- [x] Build game loop with `requestAnimationFrame`
- [x] Add power-up system
- [x] Design 30 levels
- [x] Add multi-ball support
- [x] Add laser power-up shooting
- [x] Add session recording
- [x] Create brick breaker achievements (11 achievements)
- [x] Write unit tests
- [x] Performance optimization
- [x] Manual testing

### Phase 6: Polish & Documentation (Week 9)

- [x] Add haptic feedback patterns for each game
- [x] Finalize visual polish (animations, effects)
- [x] Performance profiling on low-end devices
- [x] Update `06_GAMES.md` documentation
- [x] Write game-specific documentation sections
- [x] Add inline code documentation
- [x] Final QA testing
- [ ] Gather user feedback

---

## 9. Testing Requirements

### 9.1 Unit Tests

Each game requires tests in `__tests__/games/`:

**Tile Slide**:

- `tileSlideLogic.test.ts`
  - `createPuzzle` generates valid state
  - `isSolvable` correctly identifies solvable puzzles
  - `moveTile` only allows valid moves
  - `isSolved` correctly detects win condition

**Hex Collapse**:

- `hexCollapseLogic.test.ts`
  - `findCluster` correctly identifies adjacent hexes
  - `getHexNeighbors` returns correct neighbors for offset grid
  - `hasValidMoves` detects game over
  - Scoring calculation is correct

**Color Flow**:

- `colorFlowLogic.test.ts`
  - Generated puzzles are always solvable
  - Paths cannot cross
  - Coverage calculation is accurate
  - Star rating calculation is correct

**Brick Breaker**:

- `brickBreakerLogic.test.ts`
  - Ball-paddle collision angles are correct
  - Ball-brick collision detection works
  - Power-up effects apply correctly
  - Level completion detection works

### 9.2 Achievement Tests

Add to `__tests__/achievements/`:

- `hexCollapseAchievements.test.ts`
- `colorFlowAchievements.test.ts`
- `brickBreakerAchievements.test.ts`
- `tileSlideAchievements.test.ts`

### 9.3 Integration Tests

- Navigation from GamesHubScreen to each game
- Session recording saves correct data
- High score updates correctly
- Friend score sharing works

---

## Appendix A: File Structure

```
src/
├── components/games/
│   ├── BrickBreaker/
│   │   ├── Ball.tsx
│   │   ├── Brick.tsx
│   │   ├── GameCanvas.tsx
│   │   ├── Paddle.tsx
│   │   ├── PowerUp.tsx
│   │   └── index.ts
│   ├── ColorFlow/
│   │   ├── Dot.tsx
│   │   ├── FlowGrid.tsx
│   │   ├── Path.tsx
│   │   └── index.ts
│   ├── HexCollapse/
│   │   ├── HexCell.tsx
│   │   ├── HexGrid.tsx
│   │   └── index.ts
│   └── TileSlide/
│       ├── Tile.tsx
│       ├── SlideGrid.tsx
│       └── index.ts
├── screens/games/
│   ├── BrickBreakerGameScreen.tsx
│   ├── ColorFlowGameScreen.tsx
│   ├── HexCollapseGameScreen.tsx
│   └── TileSlideGameScreen.tsx
├── services/games/
│   ├── brickBreakerLogic.ts
│   ├── colorFlowLogic.ts
│   ├── hexCollapseLogic.ts
│   └── tileSlideLogic.ts
├── types/
│   ├── games.ts           # Add game types
│   └── singlePlayerGames.ts  # Add state/stats interfaces
├── data/
│   └── achievements.ts    # Add game achievements
└── config/
    └── gameCategories.ts  # Add screen mappings

__tests__/
├── games/
│   ├── brickBreakerLogic.test.ts
│   ├── colorFlowLogic.test.ts
│   ├── hexCollapseLogic.test.ts
│   └── tileSlideLogic.test.ts
└── achievements/
    ├── brickBreakerAchievements.test.ts
    ├── colorFlowAchievements.test.ts
    ├── hexCollapseAchievements.test.ts
    └── tileSlideAchievements.test.ts

docs/
├── 06_GAMES.md            # Update with new games
└── NEW_SINGLEPLAYER_GAMES_PLAN.md  # This document
```

---

## Appendix B: Type Definitions

### Full Type Additions

```typescript
// =============================================================================
// Add to src/types/games.ts
// =============================================================================

export type SinglePlayerGameType =
  | "bounce_blitz"
  | "snap_2048"
  | "snap_snake"
  | "memory_snap"
  | "word_snap"
  | "reaction_tap"
  | "timed_tap"
  | "cart_course"
  // NEW GAMES
  | "hex_collapse"
  | "color_flow"
  | "brick_breaker"
  | "tile_slide";

// =============================================================================
// Add to src/types/singlePlayerGames.ts
// =============================================================================

// Hex Collapse
export interface HexCollapseState extends BaseSinglePlayerState {
  gameType: "hex_collapse";
  category: "puzzle";
  grid: (HexCell | null)[][];
  moveCount: number;
  comboLevel: number;
  maxCombo: number;
  totalHexesCleared: number;
  animationPhase: "idle" | "collapsing" | "falling" | "refilling";
  rainbowHexesUsed: number;
  bombHexesUsed: number;
}

export interface HexCollapseStats {
  gameType: "hex_collapse";
  totalHexesCleared: number;
  maxCombo: number;
  moveCount: number;
  rainbowHexesUsed: number;
  bombHexesUsed: number;
}

export const HEX_COLLAPSE_CONFIG = {
  columns: 7,
  rowsEven: 8,
  rowsOdd: 9,
  colors: ["red", "blue", "green", "yellow", "purple"] as const,
  minClusterSize: 3,
  collapseAnimationMs: 300,
  fallAnimationMs: 400,
};

// Color Flow
export interface ColorFlowState extends BaseSinglePlayerState {
  gameType: "color_flow";
  category: "puzzle";
  gridSize: number;
  dots: ColorFlowDot[];
  paths: ColorFlowPath[];
  currentLevel: number;
  difficulty: "easy" | "medium" | "hard" | "expert";
  levelsCompleted: number;
  totalStars: number;
  moveCount: number;
  undoCount: number;
  coveragePercent: number;
  isDrawing: boolean;
  activeColor: FlowColor | null;
  activePath: Position[];
}

export interface ColorFlowStats {
  gameType: "color_flow";
  levelsCompleted: number;
  totalStars: number;
  perfectLevels: number;
  totalMoves: number;
}

export const COLOR_FLOW_CONFIG = {
  gridSizes: { easy: 5, medium: 7, hard: 9, expert: 11 },
  colorPairs: { easy: 4, medium: 6, hard: 7, expert: 8 },
  levelsPerPack: 50,
};

// Brick Breaker
export interface BrickBreakerState extends BaseSinglePlayerState {
  gameType: "brick_breaker";
  category: "quick_play";
  paddle: PaddleState;
  balls: BallState[];
  bricks: BrickState[];
  powerUps: FallingPowerUp[];
  lasers: LaserState[];
  currentLevel: number;
  lives: number;
  maxLives: number;
  activeEffects: ActiveEffect[];
  bricksDestroyed: number;
  powerUpsCollected: number;
  maxCombo: number;
  perfectLevels: number;
}

export interface BrickBreakerStats {
  gameType: "brick_breaker";
  levelsCompleted: number;
  bricksDestroyed: number;
  powerUpsCollected: number;
  perfectLevels: number;
  maxMultiBall: number;
}

export const BRICK_BREAKER_CONFIG = {
  canvasWidth: 360,
  canvasHeight: 640,
  paddleWidth: 80,
  paddleHeight: 12,
  ballRadius: 8,
  ballBaseSpeed: 5,
  maxBalls: 5,
  totalLevels: 30,
};

// Tile Slide
export interface TileSlideState extends BaseSinglePlayerState {
  gameType: "tile_slide";
  category: "puzzle";
  gridSize: 3 | 4 | 5;
  mode: "numbers" | "image";
  imageUri?: string;
  tiles: (number | null)[];
  emptyIndex: number;
  solvedState: number[];
  moveCount: number;
  hintsUsed: number;
  optimalMoves: number;
  isDailyPuzzle: boolean;
  dailyPuzzleDate?: string;
  slidingTile: number | null;
  slideDirection: "up" | "down" | "left" | "right" | null;
}

export interface TileSlideStats {
  gameType: "tile_slide";
  puzzlesSolved: number;
  totalMoves: number;
  optimalSolves: number;
  hintsUsed: number;
  dailyPuzzlesCompleted: number;
}

export const TILE_SLIDE_CONFIG = {
  sizes: [3, 4, 5] as const,
  shuffleMoves: { 3: 50, 4: 100, 5: 200 },
  slideAnimationMs: 200,
};

// Update union type
export type SinglePlayerGameStats =
  | BounceBlitzStats
  | MemorySnapStats
  | WordSnapStats
  | Snap2048Stats
  | SnapSnakeStats
  | CartCourseStats
  // NEW
  | HexCollapseStats
  | ColorFlowStats
  | BrickBreakerStats
  | TileSlideStats;
```

---

_Document Version: 1.0_  
_Last Updated: February 2026_  
_Author: AI Assistant_
