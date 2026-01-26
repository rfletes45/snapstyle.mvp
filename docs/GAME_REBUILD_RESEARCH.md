# Game Rebuild Research - Phase 1 Complete

**Date**: Phase 1 research completed  
**Games**: Chess, 2048, Crazy Eights  
**Status**: Ready for rebuild implementation

---

## 1. Codebase Architecture Summary

### 1.1 Game Categories

| Category                   | Games                                         | Service                   | Storage                    |
| -------------------------- | --------------------------------------------- | ------------------------- | -------------------------- |
| **Turn-Based Multiplayer** | Chess, Checkers, TicTacToe, Crazy Eights      | `turnBasedGames.ts`       | `TurnBasedGames/{matchId}` |
| **Single-Player**          | Snap2048, FlappySnap, BounceBlitz, MemorySnap | `singlePlayerSessions.ts` | `Users/{uid}/GameSessions` |

### 1.2 Key Types

```typescript
// Turn-Based Generic
interface TurnBasedMatch<TGameState, TMove, TPlayerState = unknown> {
  id: string;
  gameType: TurnBasedGameType;
  players: { player1: TurnBasedPlayer; player2: TurnBasedPlayer };
  playerIds: string[]; // For Firestore array-contains queries
  gameState: TGameState;
  moveHistory: TMove[];
  currentTurn: string;
  turnNumber: number;
  status: MatchStatus; // 'waiting' | 'active' | 'completed' | 'abandoned'
  config: TurnBasedMatchConfig;
  winnerId?: string;
  endReason?: GameEndReason;
}

// Single-Player Base
interface BaseSinglePlayerState {
  gameType: SinglePlayerGameType;
  category: GameCategory;
  playerId: string;
  sessionId: string;
  score: number;
  highScore: number;
  status: "playing" | "paused" | "gameOver";
  startedAt: number;
  endedAt?: number;
  totalPauseDuration: number;
}
```

### 1.3 Service Layer Functions

**Turn-Based (`turnBasedGames.ts`)**:

- `createMatch(gameType, player1, player2, config)` → `matchId`
- `subscribeToMatch(matchId, callback)` → `unsubscribe`
- `submitMove(matchId, move, newGameState, nextPlayerId)`
- `endMatch(matchId, winnerId, endReason)`
- `resignMatch(matchId, userId)`
- `sendGameInvite(...)` / `respondToInvite(...)`

**Single-Player (`singlePlayerSessions.ts`)**:

- `recordSinglePlayerSession(playerId, input)` → `session`
- `getHighScore(playerId, gameType)`
- `getRecentSessions(playerId, gameType?, maxResults?)`
- `updateLeaderboard(playerId, gameType, score)`

---

## 2. Working Pattern Analysis: TicTacToe

TicTacToe is the **reference implementation** for turn-based games. Pattern:

### 2.1 Component Structure

```
1. Imports
2. Constants (BOARD_SIZE, CELL_SIZE, colors)
3. Types (GameMode, props interfaces)
4. Sub-components (Cell, Modal)
5. Main Component:
   - Hooks (useAuth, useTheme, useUser)
   - State (gameMode, board, currentTurn, winner)
   - Effects (subscribeToMatch, route params)
   - Callbacks (handleCellPress, resetGame, etc.)
   - Render (menu → game → game over modal)
```

### 2.2 GameMode State Machine

```
"menu" → (startLocalGame) → "local"
"menu" → (inviteFriend) → "waiting" → (match found) → "online"
route.params?.matchId → "online"
```

### 2.3 Online Subscription Pattern

```typescript
useEffect(() => {
  if (!matchId) return;

  const unsubscribe = subscribeToMatch(matchId, (updatedMatch) => {
    if (!updatedMatch) return;
    const typedMatch = updatedMatch as TicTacToeMatch;
    setMatch(typedMatch);

    // Sync local state from match
    const state = typedMatch.gameState;
    setBoard(state.board);
    setCurrentTurn(state.currentTurn);

    // Determine player identity
    if (currentFirebaseUser) {
      if (typedMatch.players.player1.userId === currentFirebaseUser.uid) {
        setMySymbol("X");
        setOpponentName(typedMatch.players.player2.displayName);
      } else {
        setMySymbol("O");
        setOpponentName(typedMatch.players.player1.displayName);
      }
    }

    // Handle game over
    if (typedMatch.status === "completed") {
      const didWin = typedMatch.winnerId === currentFirebaseUser?.uid;
      setShowGameOverModal(true);
    }
  });

  return () => unsubscribe();
}, [matchId, currentFirebaseUser]);
```

### 2.4 Move Submission Pattern

```typescript
const handleCellPress = useCallback(
  async (row, col) => {
    if (gameMode === "online" && match && currentFirebaseUser) {
      const move: TicTacToeMove = {
        row,
        col,
        player: mySymbol,
        timestamp: Date.now(),
      };
      const newBoard = applyMove(board, move);
      const newGameState = { ...match.gameState, board: newBoard };

      // Determine next player
      const nextPlayerId =
        match.currentTurn === match.players.player1.userId
          ? match.players.player2.userId
          : match.players.player1.userId;

      await submitMove(matchId, move, newGameState, nextPlayerId);

      // Check for winner
      const { winner } = checkWinner(newBoard);
      if (winner) {
        await endMatch(matchId, currentFirebaseUser.uid, "normal");
      }
    }
  },
  [
    /* deps */
  ],
);
```

---

## 3. Existing Game Analysis

### 3.1 Chess (`ChessGameScreen.tsx` - 1340 lines)

**Current Structure**:

- ✅ Proper imports and constants
- ✅ PieceComponent with animation
- ✅ CellComponent with coordinate labels
- ✅ PromotionModal, MoveHistory, CapturedPiecesDisplay
- ✅ subscribeToMatch pattern implemented
- ✅ Uses `chessLogic.ts` for game rules

**Logic File** (`chessLogic.ts` - 981 lines):

- ✅ `createInitialChessState()`
- ✅ `getValidMoves()` with full check filtering
- ✅ `makeMove()` with all special moves
- ✅ Check/checkmate/stalemate detection
- ✅ Castling, en passant, promotion support

**Potential Issues to Investigate**:

- Board coordinate system (flipping for black)
- Move validation in online mode
- State sync timing with Firestore

### 3.2 Snap2048 (`Snap2048GameScreen.tsx` - 840 lines)

**Current Structure**:

- ✅ Single-player only (correct)
- ✅ TrackedTile system for animations
- ✅ PanResponder for swipe gestures
- ✅ Reanimated for tile movement
- ✅ Uses `snap2048Logic.ts`
- ✅ Records sessions with `recordSinglePlayerSession()`

**Logic File** (`snap2048Logic.ts` - 533 lines):

- ✅ `createInitial2048State()`
- ✅ `applyMove()` with merge tracking
- ✅ `slideRowLeft()` with move tracking
- ✅ Win/lose detection
- ✅ New tile spawning

**Potential Issues to Investigate**:

- Animation state management complexity
- Tile ID tracking consistency
- Move animation ordering

### 3.3 Crazy Eights (`CrazyEightsGameScreen.tsx` - 1322 lines)

**Current Structure**:

- ✅ CardComponent with animation
- ✅ SuitSelectorModal for 8s
- ✅ HandComponent with fan layout
- ✅ subscribeToMatch for online
- ✅ Uses `crazyEightsLogic.ts`

**Logic File** (`crazyEightsLogic.ts` - 475 lines):

- ✅ `createInitialCrazyEightsState()`
- ✅ `validateCrazyEightsMove()`
- ✅ `canPlayCard()`, `sortHand()`
- ✅ Draw/play/pass logic

**Critical Design Issue - Card Privacy**:

```typescript
// Current approach stores private data locally
interface LocalGameState {
  hands: Record<string, Card[]>; // ← NOT synced to Firestore
  deck: Card[];
}
```

The Firestore `CrazyEightsGameState` only stores:

- `discardPile`, `topCard`, `currentSuit`
- `deckSize` (not actual deck)
- `currentTurn`, `drawCount`, `mustDraw`

**This means**: Online mode CANNOT work properly because players can't see their hands after reconnecting or on different devices. The hands are only stored in local component state.

---

## 4. Identified Critical Issues

### 4.1 Chess

| Issue                | Severity | Description                                   |
| -------------------- | -------- | --------------------------------------------- |
| Board flip logic     | Medium   | Coordinate transformation may be inconsistent |
| Move validation      | Medium   | Online mode needs server-side validation      |
| No TypeScript errors | -        | Code compiles but may have runtime issues     |

### 4.2 Snap 2048

| Issue                | Severity | Description                               |
| -------------------- | -------- | ----------------------------------------- |
| Animation complexity | Medium   | TrackedTile system is fragile             |
| Tile ID management   | Medium   | Global counter may cause issues           |
| No TypeScript errors | -        | Code compiles but may have runtime issues |

### 4.3 Crazy Eights

| Issue                    | Severity     | Description                                           |
| ------------------------ | ------------ | ----------------------------------------------------- |
| **Card privacy model**   | **CRITICAL** | Hands not persisted to Firestore - online mode broken |
| **Deck synchronization** | **CRITICAL** | Each client has different deck state                  |
| Local state desync       | High         | Reconnecting loses all hand data                      |

---

## 5. Rebuild Strategy

### 5.1 Chess Rebuild Priority: **MEDIUM**

- Mostly functional, needs testing
- Verify board coordinate system
- Add proper error handling for moves
- Test online multiplayer thoroughly

### 5.2 Snap 2048 Rebuild Priority: **LOW**

- Appears functional
- Simplify animation system if issues found
- Single-player only, less complexity

### 5.3 Crazy Eights Rebuild Priority: **CRITICAL**

**Must redesign data model** for card games:

**Option A: Server-Authoritative**

- Store encrypted hands in Firestore
- Cloud Function validates moves
- Each player can only read their own hand

**Option B: Secret Sharing**

- Store `handCounts` per player in public state
- Store actual hands in private subcollections: `TurnBasedGames/{matchId}/PlayerHands/{playerId}`
- Security rules restrict read access

**Recommended**: Option B with Firestore security rules:

```javascript
match /TurnBasedGames/{matchId}/PlayerHands/{playerId} {
  allow read: if request.auth.uid == playerId;
  allow write: if false; // Only Cloud Functions write
}
```

---

## 6. Type Definitions Needed

### 6.1 Chess Types (Existing - Verified)

```typescript
interface ChessGameState {
  board: ChessBoard;
  currentTurn: ChessColor;
  castlingRights: CastlingRights;
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

### 6.2 Snap 2048 Types (Existing - Verified)

```typescript
interface Snap2048State extends BaseSinglePlayerState {
  board: number[][];
  bestTile: number;
  moveCount: number;
  hasWon: boolean;
  lastMove?: {
    direction: Snap2048Direction;
    mergedPositions: { row: number; col: number; value: number }[];
    movedTiles: { from: Position; to: Position; value: number }[];
    newTile: Position & { value: number };
  };
}
```

### 6.3 Crazy Eights Types (Need Update)

```typescript
// Current (insufficient)
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

// Proposed (with privacy support)
interface CrazyEightsGameState {
  discardPile: Card[];
  deckSize: number;
  topCard: Card;
  currentSuit: CardSuit;
  currentTurn: string;
  direction: 1 | -1;
  drawCount: number;
  mustDraw: boolean;
  handSizes: Record<string, number>; // Public: how many cards each player has
  // Hands stored in subcollection, not here
}
```

---

## 7. Files to Modify/Create

### Phase 2: Chess

- [ ] `src/screens/games/ChessGameScreen.tsx` - Review and fix
- [ ] `src/services/games/chessLogic.ts` - Verify all rules

### Phase 3: Snap 2048

- [ ] `src/screens/games/Snap2048GameScreen.tsx` - Simplify animations
- [ ] `src/services/games/snap2048Logic.ts` - Already solid

### Phase 4: Crazy Eights (Major Rewrite)

- [ ] `src/types/turnBased.ts` - Update CrazyEightsGameState
- [ ] `firebase-backend/firestore.rules` - Add private hand rules
- [ ] `firebase-backend/functions/src/` - Add move validation function
- [ ] `src/services/crazyEightsService.ts` - New service for card privacy
- [ ] `src/screens/games/CrazyEightsGameScreen.tsx` - Full rewrite

---

## 8. Next Steps

1. **User to clarify**: What specifically is "broken"?
   - Are games not launching?
   - Are moves not working?
   - Is online multiplayer failing?
   - Are there runtime crashes?

2. **Testing**: Run each game and document specific failures

3. **Priority**:
   - If online multiplayer is broken → Fix Crazy Eights first (architectural issue)
   - If animations are broken → Start with Snap 2048
   - If chess rules are wrong → Focus on chessLogic.ts

---

## 9. Reference Files

| Purpose                    | File Path                                   |
| -------------------------- | ------------------------------------------- |
| Working turn-based example | `src/screens/games/TicTacToeGameScreen.tsx` |
| Turn-based service         | `src/services/turnBasedGames.ts`            |
| Single-player service      | `src/services/singlePlayerSessions.ts`      |
| Turn-based types           | `src/types/turnBased.ts`                    |
| Single-player types        | `src/types/singlePlayerGames.ts`            |
| Game metadata              | `src/types/games.ts`                        |
| Navigation                 | `src/screens/games/GamesHubScreen.tsx`      |
| Firestore rules            | `firebase-backend/firestore.rules`          |

---

_Phase 1 Research Complete. Ready to proceed with implementation._
