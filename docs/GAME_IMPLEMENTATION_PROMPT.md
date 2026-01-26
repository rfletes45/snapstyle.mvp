# Game Implementation Prompt for Claude Opus 4.5

> Use this prompt to have Claude extensively plan, research, and implement games in the Vibe App codebase.

---

## 🎯 Objective

You are tasked with implementing **production-ready games** for a React Native/Expo social app. Before writing ANY code, you must thoroughly research the existing codebase patterns and plan your implementation comprehensively.

**Games to Implement:**

1. ♟️ **Chess** - Full two-player chess with all rules (castling, en passant, promotion, check/checkmate)
2. 🎮 **2048** - Single-player sliding tile puzzle game
3. 🃏 **Crazy Eights** - Multiplayer card game

---

## 📋 Phase 1: Deep Codebase Research (MANDATORY)

### 1.1 Architecture Understanding

Before implementing anything, read and understand these files IN ORDER:

```
CRITICAL - Read these first:
1. docs/01_ARCHITECTURE.md          → Understand app structure and patterns
2. docs/06_GAMES.md                 → Understand game system architecture
3. src/types/games.ts               → Core game type definitions
4. src/types/turnBased.ts           → Turn-based game state types
5. src/types/singlePlayerGames.ts   → Single-player session types
```

### 1.2 Existing Game Analysis

Study these EXISTING game implementations to understand patterns:

```
Turn-Based Games (for Chess, Crazy Eights):
├── src/screens/games/TicTacToeGameScreen.tsx    → Simplest turn-based example
├── src/screens/games/CheckersGameScreen.tsx     → Board game with pieces
├── src/screens/games/ChessGameScreen.tsx        → If exists, study it
├── src/services/turnBasedGames.ts               → Turn-based game service
├── src/services/gameValidation/                 → Move validation patterns

Single-Player Games (for 2048):
├── src/screens/games/Snap2048GameScreen.tsx     → If exists, study it
├── src/screens/games/MemorySnapGameScreen.tsx   → Single-player patterns
├── src/screens/games/WordSnapGameScreen.tsx     → Score/session handling
├── src/services/singlePlayerSessions.ts         → Session management
```

### 1.3 Research Questions to Answer

Before coding, document answers to these questions:

**For ALL games:**

- [ ] What is the standard screen component structure? (hooks, state, effects, render)
- [ ] How are game states persisted to Firebase?
- [ ] How do games handle the game-over flow?
- [ ] What animation patterns are used? (Animated, Reanimated?)
- [ ] How are achievements triggered?
- [ ] How are leaderboards updated?

**For Turn-Based games (Chess, Crazy Eights):**

- [ ] How is `TurnBasedMatch` structured in Firestore?
- [ ] How are moves validated and applied?
- [ ] How is turn switching handled?
- [ ] How are real-time updates subscribed to?
- [ ] How is the opponent's state displayed?

**For Single-Player games (2048):**

- [ ] How is `SinglePlayerGameSession` structured?
- [ ] How are high scores tracked?
- [ ] How do daily challenges work?
- [ ] How are scores submitted to leaderboards?

---

## 📋 Phase 2: Type Definitions

### 2.1 Define Game-Specific Types

Create or extend types following existing patterns. Each game needs:

```typescript
// Chess types (add to src/types/games.ts or create src/types/chess.ts)
interface ChessGameState {
  board: ChessPiece[][]; // 8x8 board
  currentTurn: "white" | "black";
  capturedPieces: { white: ChessPiece[]; black: ChessPiece[] };
  moveHistory: ChessMove[];
  castlingRights: CastlingRights;
  enPassantTarget: Position | null;
  halfMoveClock: number; // For 50-move rule
  fullMoveNumber: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
}

// 2048 types
interface Game2048State {
  board: number[][]; // 4x4 grid of tile values
  score: number;
  bestTile: number;
  moveCount: number;
  isGameOver: boolean;
  hasWon: boolean; // Reached 2048
  continueAfterWin: boolean; // Keep playing after 2048
}

// Crazy Eights types
interface CrazyEightsGameState {
  drawPile: Card[];
  discardPile: Card[];
  hands: Record<string, Card[]>; // playerId -> cards
  currentPlayerIndex: number;
  direction: 1 | -1; // For reverse cards if using
  currentSuit: Suit | null; // When 8 is played
  winner: string | null;
}
```

### 2.2 Register Game Types

Ensure games are registered in the type system:

```typescript
// In src/types/games.ts
type TurnBasedGameType = 'tictactoe' | 'chess' | 'checkers' | 'crazyeights' | ...;
type SinglePlayerGameType = 'snap2048' | 'wordsnap' | 'memorysnap' | ...;
```

---

## 📋 Phase 3: Service Layer

### 3.1 Game Validation Service

Create move validation logic:

```
src/services/gameValidation/
├── chessValidator.ts      → Chess move validation, check detection
├── crazyEightsValidator.ts → Card play validation
└── index.ts               → Export validators
```

**Chess Validator Must Handle:**

- Legal move generation for each piece type
- Pin detection (pieces protecting king)
- Check and checkmate detection
- Castling legality (king/rook not moved, not through check)
- En passant capture
- Pawn promotion
- Stalemate detection
- Draw conditions (50-move rule, insufficient material, threefold repetition)

### 3.2 Game State Service

Create/extend services for game state management:

```typescript
// For turn-based: extend src/services/turnBasedGames.ts
// For single-player: extend src/services/singlePlayerSessions.ts

// Example functions needed:
export async function createChessMatch(
  player1: string,
  player2: string,
): Promise<string>;
export async function makeChessMove(
  matchId: string,
  move: ChessMove,
): Promise<void>;
export async function get2048Leaderboard(
  period: LeaderboardPeriod,
): Promise<LeaderboardEntry[]>;
```

---

## 📋 Phase 4: Screen Implementation

### 4.1 Standard Screen Structure

Follow this structure for consistency:

```typescript
/**
 * [GameName]GameScreen.tsx
 *
 * Features:
 * - [List key features]
 * - Real-time multiplayer sync (if applicable)
 * - Achievements integration
 * - Leaderboard submission
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useAuth } from '@/store/AuthContext';
import { useAppTheme } from '@/store/ThemeContext';
// ... other imports

type Props = NativeStackScreenProps<GamesStackParamList, 'ChessGame'>;

export default function ChessGameScreen({ route, navigation }: Props) {
  // 1. HOOKS - Auth, theme, navigation
  const { user } = useAuth();
  const theme = useAppTheme();

  // 2. STATE - Game state, UI state, animations
  const [gameState, setGameState] = useState<ChessGameState>(initialState);
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);

  // 3. EFFECTS - Subscriptions, cleanup
  useEffect(() => {
    // Subscribe to game updates
    return () => { /* cleanup */ };
  }, [matchId]);

  // 4. CALLBACKS - Event handlers
  const handleSquarePress = useCallback((position: Position) => {
    // Handle piece selection or move
  }, [gameState, selectedPiece]);

  // 5. MEMOS - Computed values
  const boardDisplay = useMemo(() => {
    // Compute board rendering data
  }, [gameState.board]);

  // 6. RENDER
  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button, opponent info */}
      {/* Game board */}
      {/* Game controls/info */}
      {/* Modals for game over, promotion, etc */}
    </SafeAreaView>
  );
}
```

### 4.2 Game-Specific UI Requirements

**Chess UI:**

- 8x8 board with alternating colors
- Piece rendering (use Unicode chess symbols or custom SVGs)
- Selected square highlight
- Valid move indicators
- Last move highlight
- Check indicator (highlight king)
- Captured pieces display
- Move history (algebraic notation)
- Pawn promotion modal
- Game over modal with result

**2048 UI:**

- 4x4 grid with tile colors based on value
- Swipe gesture handling (up/down/left/right)
- Tile sliding animations
- Tile merge animations
- New tile spawn animation
- Score display with animation on change
- Best score tracking
- Game over overlay
- New game button

**Crazy Eights UI:**

- Player's hand (fan of cards at bottom)
- Draw pile and discard pile (center)
- Opponent hands (show card backs)
- Current suit indicator (when 8 played)
- Card play animation
- Draw card animation
- Turn indicator
- Game over with winner

---

## 📋 Phase 5: Integration

### 5.1 Navigation Registration

Add screens to navigation:

```typescript
// In src/navigation/RootNavigator.tsx
<GamesStack.Screen name="ChessGame" component={ChessGameScreen} />
<GamesStack.Screen name="Snap2048Game" component={Snap2048GameScreen} />
<GamesStack.Screen name="CrazyEightsGame" component={CrazyEightsGameScreen} />
```

### 5.2 Games Hub Entry

Add game cards to GamesHubScreen:

```typescript
// Game card with icon, title, description
// Online indicator for multiplayer games
// "Play" button that navigates to game or matchmaking
```

### 5.3 Achievements Integration

Define achievements for each game:

```typescript
// In src/data/gameAchievements.ts
const CHESS_ACHIEVEMENTS = [
  {
    id: "chess_first_win",
    name: "First Checkmate",
    description: "Win your first chess game",
  },
  {
    id: "chess_scholar",
    name: "Scholar's Mate",
    description: "Win in 4 moves or fewer",
  },
  {
    id: "chess_grandmaster",
    name: "Grandmaster",
    description: "Win 100 chess games",
  },
  // ...
];

const GAME_2048_ACHIEVEMENTS = [
  {
    id: "2048_reach_512",
    name: "Getting Started",
    description: "Reach the 512 tile",
  },
  {
    id: "2048_reach_2048",
    name: "Victory!",
    description: "Reach the 2048 tile",
  },
  {
    id: "2048_reach_4096",
    name: "Beyond Limits",
    description: "Reach the 4096 tile",
  },
  // ...
];
```

### 5.4 Leaderboard Integration

Ensure games submit scores:

```typescript
// Single-player games submit to leaderboards
await submitScore("snap2048", score, { bestTile, moveCount });

// Turn-based games update win/loss records
await updatePlayerStats(userId, "chess", { wins: 1 });
```

---

## 📋 Phase 6: Testing & Polish

### 6.1 Verification Checklist

Before considering implementation complete:

- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)
- [ ] Game loads without crashes
- [ ] All game rules implemented correctly
- [ ] Animations are smooth (60fps)
- [ ] Multiplayer sync works in real-time
- [ ] Game over detection is accurate
- [ ] Achievements trigger correctly
- [ ] Leaderboards update correctly
- [ ] Back navigation doesn't break game state
- [ ] Dark mode supported
- [ ] Haptic feedback on interactions

### 6.2 Edge Cases to Handle

**Chess:**

- Attempting illegal moves
- Disconnection during game
- Time controls (if implemented)
- Draw offers and resignation

**2048:**

- No valid moves remaining
- Board full detection
- Continuing after reaching 2048

**Crazy Eights:**

- Empty draw pile (reshuffle discard)
- Player has no playable cards
- Disconnection handling
- Player timeout

---

## ⚠️ Critical Guidelines

### DO:

- ✅ Read existing game implementations BEFORE coding
- ✅ Follow existing patterns exactly (don't reinvent)
- ✅ Use TypeScript strictly (no `any` types)
- ✅ Implement ALL game rules (no shortcuts)
- ✅ Add comprehensive comments for complex logic
- ✅ Test incrementally (compile after each major addition)
- ✅ Use existing UI components where possible

### DO NOT:

- ❌ Skip the research phase
- ❌ Create new patterns when existing ones work
- ❌ Leave TODO comments for core functionality
- ❌ Ignore edge cases
- ❌ Use console.log for debugging (use the logger utility)
- ❌ Implement partial game rules

---

## 🚀 Execution Order

1. **Research** (30 min) - Read all referenced files, understand patterns
2. **Plan** (15 min) - Document your implementation approach
3. **Types** (15 min) - Define all type interfaces
4. **Validators** (45 min) - Implement game rule validation
5. **Services** (30 min) - Implement state management
6. **Screens** (60 min per game) - Implement UI and interactions
7. **Integration** (15 min) - Register in navigation, hub, achievements
8. **Testing** (30 min) - Verify all functionality

**Total Estimated Time:** 5-6 hours for all three games

---

## 🎮 Begin Implementation

Start by reading `docs/06_GAMES.md` and `src/types/games.ts`, then report:

1. Summary of existing game patterns discovered
2. Your proposed type definitions for each game
3. Key implementation decisions (e.g., piece rendering approach)
4. Any questions or clarifications needed

**Do not write any implementation code until you have completed Phase 1 research and received approval to proceed.**
