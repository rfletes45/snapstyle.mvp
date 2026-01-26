# Phase 1 Research Findings: Game Implementation

> Research completed January 25, 2026 for Chess, 2048, and Crazy Eights implementation

---

## 1. Research Questions - Answers

### 1.1 For ALL Games

#### ✅ What is the standard screen component structure?

**Standard Pattern (from TicTacToeGameScreen, ChessGameScreen, Snap2048GameScreen):**

```typescript
// 1. IMPORTS
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
// Game-specific services, types, components...

// 2. CONSTANTS (screen dimensions, game config)
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 48, 380);

// 3. TYPES (Props, GameMode, local interfaces)
interface GameScreenProps { navigation: any; route: { params?: {...} } }
type GameMode = "menu" | "local" | "online" | "waiting";

// 4. HELPER COMPONENTS (Cell, Piece, Card, Tile)
function Cell({ ... }) { ... }

// 5. MAIN COMPONENT
export default function GameScreen({ navigation, route }) {
  // Hooks: auth, theme, navigation
  const { currentFirebaseUser } = useAuth();
  const theme = useTheme();

  // State: game mode, game state, UI state
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const [gameState, setGameState] = useState(initialState);

  // Refs: animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Effects: subscriptions, route params handling
  useEffect(() => { /* subscribe to match */ }, [matchId]);

  // Callbacks: game actions
  const handleCellPress = useCallback(() => { ... }, [deps]);

  // Render
  return (
    <SafeAreaView>
      {/* Menu mode UI */}
      {/* Game board */}
      {/* Modals (game over, promotion, etc.) */}
    </SafeAreaView>
  );
}
```

#### ✅ How are game states persisted to Firebase?

**Turn-Based Games:**

- Collection: `TurnBasedGames/{matchId}`
- Uses `submitMove()` from `turnBasedGames.ts`
- Board arrays are converted to map format (Firestore doesn't support nested arrays)
- Real-time sync via `subscribeToMatch(matchId, callback)`

**Single-Player Games:**

- Collection: `Users/{uid}/GameSessions/{sessionId}`
- Uses `recordSinglePlayerSession()` from `singlePlayerSessions.ts`
- High scores in: `Users/{uid}/GameHighScores/{gameType}`
- Leaderboards in: `Leaderboards/{gameType}/...`

#### ✅ How do games handle the game-over flow?

1. Detect win/loss/draw condition in game logic
2. Call `endMatch(matchId, winnerId, endReason)` for turn-based
3. Call `recordSinglePlayerSession()` for single-player
4. Show `<GameOverModal>` component with results
5. Provide options: Play Again, Rematch, Back to Menu
6. Trigger achievement checks

#### ✅ What animation patterns are used?

- **React Native Animated** for simple animations (scale, fade, bounce)
- **Reanimated 2** for complex tile animations (2048 uses `useSharedValue`, `withSpring`)
- Common patterns:
  - `Animated.spring()` for bouncy effects
  - `Animated.sequence()` for chained animations
  - `useRef(new Animated.Value())` for persistent values

#### ✅ How are achievements triggered?

- Service: `src/services/gameAchievements.ts`
- Definitions: `src/data/gameAchievements.ts`
- Call `checkAndGrantGameAchievements(uid, gameType, gameResult)` after game ends
- Achievements have:
  - `trigger: { type: string, conditions: {...} }`
  - `progressType: "instant" | "count" | "streak"`
  - Tier-based rewards (bronze, silver, gold, platinum)

#### ✅ How are leaderboards updated?

- Single-player: `updateLeaderboard(playerId, gameType, score)` in `singlePlayerSessions.ts`
- Turn-based: Win/loss tracked in `PlayerRatings` collection
- Leaderboard structure: `Leaderboards/{gameType}/weekly_{weekKey}/`

---

### 1.2 For Turn-Based Games (Chess, Crazy Eights)

#### ✅ How is `TurnBasedMatch` structured in Firestore?

```typescript
interface TurnBasedMatchDocument {
  id: string;
  gameType: TurnBasedGameType;
  status: MatchStatus; // "waiting" | "active" | "completed" | etc.
  players: {
    player1: TurnBasedPlayer;
    player2: TurnBasedPlayer;
  };
  playerIds: string[]; // For array-contains queries
  gameState: Record<string, unknown>; // Board stored as map, not nested array
  moveHistory: AnyMove[];
  currentTurn: string; // userId of whose turn it is
  turnNumber: number;
  config: TurnBasedMatchConfig;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMoveAt: number;
  winnerId?: string;
  endReason?: GameEndReason;
}
```

#### ✅ How are moves validated and applied?

1. UI calls game-specific logic (e.g., `getValidMoves()`, `makeMove()`)
2. Client validates move locally first
3. Client calls `submitMove(matchId, move, newGameState, nextPlayerId)`
4. Service updates Firestore with:
   - New `gameState` (converted to map format)
   - Appended `moveHistory`
   - Updated `currentTurn`, `turnNumber`, `lastMoveAt`

#### ✅ How is turn switching handled?

- `currentTurn` field stores the userId of the current player
- After `submitMove()`, the `nextPlayerId` becomes `currentTurn`
- UI checks: `match.currentTurn === currentFirebaseUser.uid` to enable/disable moves

#### ✅ How are real-time updates subscribed to?

```typescript
useEffect(() => {
  const unsubscribe = subscribeToMatch(matchId, (updatedMatch) => {
    setMatch(updatedMatch);
    setBoard(updatedMatch.gameState.board);
    // ... sync local state
  });
  return () => unsubscribe();
}, [matchId]);
```

#### ✅ How is the opponent's state displayed?

- For Chess/Checkers: Full board visible to both
- For Crazy Eights: `handSize` shown (not actual cards)
- Opponent info from `match.players.player1/player2`

---

### 1.3 For Single-Player Games (2048)

#### ✅ How is `SinglePlayerGameSession` structured?

```typescript
interface SinglePlayerGameSession {
  id: string;
  playerId: string;
  gameType: SinglePlayerGameType;
  finalScore: number;
  highScore: number;
  isNewHighScore: boolean;
  startedAt: number;
  endedAt: number;
  duration: number;
  stats: SinglePlayerGameStats; // Game-specific (bestTile, moveCount, etc.)
  achievementsUnlocked: string[];
  coinsEarned: number;
  platform: string;
}
```

#### ✅ How are high scores tracked?

- Stored in: `Users/{uid}/GameHighScores/{gameType}`
- Updated when `isNewHighScore = finalScore > currentHighScore`
- `totalGames` counter incremented on each session

#### ✅ How do daily challenges work?

- Word Snap uses daily word system
- Seed based on date ensures same puzzle for all users
- Tracked per-user with daily completion status

#### ✅ How are scores submitted to leaderboards?

```typescript
// In recordSinglePlayerSession:
if (isNewHighScore) {
  await updateLeaderboard(playerId, gameType, finalScore);
}

// updateLeaderboard() writes to:
// Leaderboards/{gameType}/weekly_{weekKey}/{playerId}
// Leaderboards/{gameType}/daily_{dayKey}/{playerId}
// Leaderboards/{gameType}/allTime/{playerId}
```

---

## 2. Existing Implementation Status

### ✅ Chess - ALREADY IMPLEMENTED

**Files Found:**

- `src/screens/games/ChessGameScreen.tsx` (1340 lines)
- `src/services/games/chessLogic.ts` (981 lines)
- `src/services/gameValidation/chessValidator.ts` (618 lines)
- Types in `src/types/turnBased.ts`

**Features Implemented:**

- Complete move validation
- Check/checkmate/stalemate detection
- Castling, en passant, pawn promotion
- FEN notation support
- Algebraic notation for moves
- Online multiplayer via Firestore
- Local two-player mode
- Game invites via `FriendPickerModal`
- Polished UI with piece animations

### ✅ 2048 (Snap 2048) - ALREADY IMPLEMENTED

**Files Found:**

- `src/screens/games/Snap2048GameScreen.tsx` (840 lines)
- `src/services/games/snap2048Logic.ts`
- Types in `src/types/singlePlayerGames.ts`

**Features Implemented:**

- Swipe gesture handling
- Tile merge animations with Reanimated 2
- Score tracking with high score persistence
- Win detection (reaching 2048)
- Continue playing after win
- New tile spawn animation
- Haptic feedback
- Leaderboard submission

### ✅ Crazy Eights - ALREADY IMPLEMENTED

**Files Found:**

- `src/screens/games/CrazyEightsGameScreen.tsx` (1322 lines)
- `src/services/games/crazyEightsLogic.ts`
- Types in `src/types/turnBased.ts`

**Features Implemented:**

- Card rendering with suit/rank display
- Fan-style hand layout
- Suit selector for playing 8s
- Online multiplayer
- Turn indicator
- Playable card highlighting
- Deck and discard pile
- Game over with winner detection

---

## 3. Type Definitions Summary

### 3.1 Chess Types (Already Defined)

```typescript
// src/types/turnBased.ts
interface ChessGameState {
  board: ChessBoard; // (ChessPiece | null)[][]
  currentTurn: ChessColor;
  castlingRights: {
    whiteKingside;
    whiteQueenside;
    blackKingside;
    blackQueenside;
  };
  enPassantTarget: ChessPosition | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  fen: string;
}
```

### 3.2 2048 Types (Already Defined)

```typescript
// src/types/singlePlayerGames.ts
interface Snap2048State extends BaseSinglePlayerState {
  board: number[][];
  score: number;
  bestTile: number;
  moveCount: number;
  hasWon: boolean;
  continueAfterWin: boolean;
}
```

### 3.3 Crazy Eights Types (Already Defined)

```typescript
// src/types/turnBased.ts
interface CrazyEightsGameState {
  discardPile: Card[];
  deckSize: number;
  topCard: Card;
  currentSuit: CardSuit;
  currentTurn: string;
  direction: 1 | -1;
  drawCount: number;
  mustDraw: boolean;
}
```

---

## 4. Achievements (Already Defined)

From `src/data/gameAchievements.ts`:

### Chess Achievements (Expected)

- First checkmate
- Win streak achievements
- Rating milestones

### 2048 Achievements (Expected)

- Reach 512, 1024, 2048, 4096 tiles
- Score milestones
- Perfect games

### Crazy Eights Achievements (Expected)

- First win
- Win without drawing
- Comeback wins

---

## 5. Conclusion

### 🎉 ALL THREE GAMES ARE ALREADY FULLY IMPLEMENTED!

| Game         | Screen                       | Logic                                | Types                   | Status       |
| ------------ | ---------------------------- | ------------------------------------ | ----------------------- | ------------ |
| Chess        | ✅ ChessGameScreen.tsx       | ✅ chessLogic.ts + chessValidator.ts | ✅ turnBased.ts         | **Complete** |
| 2048         | ✅ Snap2048GameScreen.tsx    | ✅ snap2048Logic.ts                  | ✅ singlePlayerGames.ts | **Complete** |
| Crazy Eights | ✅ CrazyEightsGameScreen.tsx | ✅ crazyEightsLogic.ts               | ✅ turnBased.ts         | **Complete** |

### Recommendations

Since all three games are already implemented, the next steps could be:

1. **Review and polish** existing implementations
2. **Add missing achievements** if not complete
3. **Enhance features** (e.g., time controls for Chess, undo for 2048)
4. **Add new games** not yet implemented (e.g., Pool, Air Hockey marked as "comingSoon")

### Files to Review for Enhancements

| Area         | Files                                                      |
| ------------ | ---------------------------------------------------------- |
| Chess        | `ChessGameScreen.tsx`, `chessLogic.ts`                     |
| 2048         | `Snap2048GameScreen.tsx`, `snap2048Logic.ts`               |
| Crazy Eights | `CrazyEightsGameScreen.tsx`, `crazyEightsLogic.ts`         |
| Achievements | `gameAchievements.ts` - verify all game achievements exist |
| Navigation   | `RootNavigator.tsx` - verify all screens registered        |
