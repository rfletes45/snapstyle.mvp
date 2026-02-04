/**
 * Snap2048GameScreen - 2048 Puzzle Game with Sliding Animations
 *
 * Features smooth tile sliding animations using React Native Reanimated.
 * Each tile has a unique ID that persists across moves, allowing us to
 * animate tiles from their old position to their new position.
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { sendScorecard } from "@/services/games";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { Snap2048Stats } from "@/types/singlePlayerGames";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// =============================================================================
// Types
// =============================================================================

interface Snap2048GameScreenProps {
  navigation: any;
}

type Direction = "up" | "down" | "left" | "right";

/**
 * A tile with a unique ID for tracking across moves
 */
interface TileData {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  isMerging?: boolean;
}

interface GameState {
  tiles: TileData[];
  score: number;
  bestTile: number;
  moveCount: number;
  isGameOver: boolean;
  hasWon: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_SIZE = 4;
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 48, 380);
const CELL_GAP = 8;
const CELL_SIZE = (BOARD_SIZE - CELL_GAP * (GRID_SIZE + 1)) / GRID_SIZE;
const SWIPE_THRESHOLD = 30;
const WIN_TILE = 2048;
const SLIDE_DURATION = 100; // ms for slide animation

// Tile colors matching the classic 2048 game
const TILE_COLORS: Record<number, string> = {
  2: "#EEE4DA",
  4: "#EDE0C8",
  8: "#F2B179",
  16: "#F59563",
  32: "#F67C5F",
  64: "#F65E3B",
  128: "#EDCF72",
  256: "#EDCC61",
  512: "#EDC850",
  1024: "#EDC53F",
  2048: "#EDC22E",
  4096: "#3C3A32",
  8192: "#3C3A32",
};

// =============================================================================
// Utility Functions
// =============================================================================

let nextTileId = 1;
function generateTileId(): number {
  return nextTileId++;
}

function resetTileIds(): void {
  nextTileId = 1;
}

/**
 * Convert pixel position to grid position
 */
function getPixelPosition(gridPos: number): number {
  return CELL_GAP + gridPos * (CELL_SIZE + CELL_GAP);
}

/**
 * Convert tiles to a 2D board for game logic
 */
function tilesToBoard(tiles: TileData[]): number[][] {
  const board: number[][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => 0),
  );
  for (const tile of tiles) {
    board[tile.row][tile.col] = tile.value;
  }
  return board;
}

/**
 * Get empty cells from a board
 */
function getEmptyCells(board: number[][]): Array<{ row: number; col: number }> {
  const empty: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === 0) {
        empty.push({ row, col });
      }
    }
  }
  return empty;
}

/**
 * Get the max tile value
 */
function getMaxTile(tiles: TileData[]): number {
  return tiles.reduce((max, tile) => Math.max(max, tile.value), 0);
}

/**
 * Check if any moves are possible
 */
function canMakeMove(tiles: TileData[]): boolean {
  const board = tilesToBoard(tiles);

  // Check for empty cells
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === 0) return true;
    }
  }

  // Check for possible merges
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE - 1; col++) {
      if (board[row][col] === board[row][col + 1]) return true;
    }
  }
  for (let row = 0; row < GRID_SIZE - 1; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === board[row + 1][col]) return true;
    }
  }

  return false;
}

// =============================================================================
// Move Logic with Tile Tracking
// =============================================================================

interface MoveResult {
  newTiles: TileData[];
  scoreEarned: number;
  moved: boolean;
  newTilePosition?: { row: number; col: number };
}

/**
 * Process a move and track tile movements
 */
function processMove(tiles: TileData[], direction: Direction): MoveResult {
  // Create a map of positions to tiles
  const tileMap = new Map<string, TileData>();
  for (const tile of tiles) {
    tileMap.set(`${tile.row},${tile.col}`, tile);
  }

  const newTiles: TileData[] = [];
  let scoreEarned = 0;
  let moved = false;

  // Determine the order to process tiles based on direction
  const rows = Array.from({ length: GRID_SIZE }, (_, i) => i);
  const cols = Array.from({ length: GRID_SIZE }, (_, i) => i);

  if (direction === "right") cols.reverse();
  if (direction === "down") rows.reverse();

  // Track which positions have been merged this move
  const mergedPositions = new Set<string>();

  // Process based on direction
  if (direction === "left" || direction === "right") {
    // Process row by row
    for (const row of rows) {
      // Get tiles in this row, sorted by column
      const rowTiles: TileData[] = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        const tile = tileMap.get(`${row},${col}`);
        if (tile) rowTiles.push({ ...tile });
      }

      if (direction === "right") rowTiles.reverse();

      // Slide and merge
      let targetCol = direction === "left" ? 0 : GRID_SIZE - 1;
      const step = direction === "left" ? 1 : -1;

      for (let i = 0; i < rowTiles.length; i++) {
        const tile = rowTiles[i];
        const nextTile = rowTiles[i + 1];

        if (
          nextTile &&
          tile.value === nextTile.value &&
          !mergedPositions.has(`${row},${targetCol}`)
        ) {
          // Merge
          const mergedTile: TileData = {
            id: generateTileId(),
            value: tile.value * 2,
            row,
            col: targetCol,
            isMerging: true,
          };
          newTiles.push(mergedTile);
          scoreEarned += tile.value * 2;
          mergedPositions.add(`${row},${targetCol}`);

          // Track if tiles actually moved
          if (tile.col !== targetCol || nextTile.col !== targetCol) {
            moved = true;
          }

          i++; // Skip the next tile since it merged
          targetCol += step;
        } else {
          // Just move
          const movedTile: TileData = {
            ...tile,
            row,
            col: targetCol,
          };
          newTiles.push(movedTile);

          if (tile.col !== targetCol) {
            moved = true;
          }

          targetCol += step;
        }
      }
    }
  } else {
    // Process column by column (up/down)
    for (const col of cols) {
      // Get tiles in this column, sorted by row
      const colTiles: TileData[] = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        const tile = tileMap.get(`${row},${col}`);
        if (tile) colTiles.push({ ...tile });
      }

      if (direction === "down") colTiles.reverse();

      // Slide and merge
      let targetRow = direction === "up" ? 0 : GRID_SIZE - 1;
      const step = direction === "up" ? 1 : -1;

      for (let i = 0; i < colTiles.length; i++) {
        const tile = colTiles[i];
        const nextTile = colTiles[i + 1];

        if (
          nextTile &&
          tile.value === nextTile.value &&
          !mergedPositions.has(`${targetRow},${col}`)
        ) {
          // Merge
          const mergedTile: TileData = {
            id: generateTileId(),
            value: tile.value * 2,
            row: targetRow,
            col,
            isMerging: true,
          };
          newTiles.push(mergedTile);
          scoreEarned += tile.value * 2;
          mergedPositions.add(`${targetRow},${col}`);

          if (tile.row !== targetRow || nextTile.row !== targetRow) {
            moved = true;
          }

          i++;
          targetRow += step;
        } else {
          // Just move
          const movedTile: TileData = {
            ...tile,
            row: targetRow,
            col,
          };
          newTiles.push(movedTile);

          if (tile.row !== targetRow) {
            moved = true;
          }

          targetRow += step;
        }
      }
    }
  }

  // Add a new random tile if the board changed
  let newTilePosition: { row: number; col: number } | undefined;
  if (moved) {
    const board = tilesToBoard(newTiles);
    const emptyCells = getEmptyCells(board);

    if (emptyCells.length > 0) {
      const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      newTiles.push({
        id: generateTileId(),
        value: Math.random() < 0.9 ? 2 : 4,
        row: cell.row,
        col: cell.col,
        isNew: true,
      });
      newTilePosition = cell;
    }
  }

  return { newTiles, scoreEarned, moved, newTilePosition };
}

/**
 * Create initial game state with two tiles
 */
function createInitialState(): GameState {
  resetTileIds();

  const tiles: TileData[] = [];
  const positions: Set<string> = new Set();

  for (let i = 0; i < 2; i++) {
    let row, col;
    do {
      row = Math.floor(Math.random() * GRID_SIZE);
      col = Math.floor(Math.random() * GRID_SIZE);
    } while (positions.has(`${row},${col}`));

    positions.add(`${row},${col}`);
    tiles.push({
      id: generateTileId(),
      value: Math.random() < 0.9 ? 2 : 4,
      row,
      col,
      isNew: true,
    });
  }

  return {
    tiles,
    score: 0,
    bestTile: getMaxTile(tiles),
    moveCount: 0,
    isGameOver: false,
    hasWon: false,
  };
}

// =============================================================================
// Animated Tile Component
// =============================================================================

interface AnimatedTileProps {
  tile: TileData;
  previousPositions: Map<number, { row: number; col: number }>;
}

function AnimatedTile({ tile, previousPositions }: AnimatedTileProps) {
  const prevPos = previousPositions.get(tile.id);

  // Shared values for position
  const translateX = useSharedValue(
    prevPos ? getPixelPosition(prevPos.col) : getPixelPosition(tile.col),
  );
  const translateY = useSharedValue(
    prevPos ? getPixelPosition(prevPos.row) : getPixelPosition(tile.row),
  );
  const scale = useSharedValue(tile.isNew ? 0 : 1);

  // Target positions
  const targetX = getPixelPosition(tile.col);
  const targetY = getPixelPosition(tile.row);

  useEffect(() => {
    // Animate to new position
    translateX.value = withTiming(targetX, { duration: SLIDE_DURATION });
    translateY.value = withTiming(targetY, { duration: SLIDE_DURATION });

    // Pop animation for new tiles or merged tiles
    if (tile.isNew) {
      scale.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1.1, { duration: SLIDE_DURATION }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    } else if (tile.isMerging) {
      scale.value = withSequence(
        withTiming(1.2, { duration: SLIDE_DURATION / 2 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    }
  }, [
    tile.col,
    tile.row,
    tile.isNew,
    tile.isMerging,
    targetX,
    targetY,
    translateX,
    translateY,
    scale,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const backgroundColor = TILE_COLORS[tile.value] || "#3C3A32";
  const textColor = tile.value <= 4 ? "#776E65" : "#FFFFFF";

  const digits = tile.value.toString().length;
  let fontSize = CELL_SIZE * 0.45;
  if (digits === 3) fontSize = CELL_SIZE * 0.38;
  else if (digits === 4) fontSize = CELL_SIZE * 0.32;
  else if (digits >= 5) fontSize = CELL_SIZE * 0.26;

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          width: CELL_SIZE,
          height: CELL_SIZE,
          backgroundColor,
        },
        animatedStyle,
      ]}
    >
      <Text style={[styles.tileText, { color: textColor, fontSize }]}>
        {tile.value}
      </Text>
    </Animated.View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function Snap2048GameScreen({
  navigation,
}: Snap2048GameScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();
  const haptics = useGameHaptics();

  // Core game state
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [highScore, setHighScore] = useState(0);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [hasShownWinDialog, setHasShownWinDialog] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [startTime] = useState(Date.now());

  // Track previous tile positions for animations
  const [previousPositions, setPreviousPositions] = useState<
    Map<number, { row: number; col: number }>
  >(new Map());

  // Share state
  const [showFriendPicker, setShowFriendPicker] = useState(false);

  // Prevent rapid swipes
  const isProcessingMove = useRef(false);

  // Refs for pan responder
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Score animation
  const scoreScale = useSharedValue(1);

  useEffect(() => {
    if (gameState.score > 0) {
      scoreScale.value = withSequence(
        withSpring(1.15, { damping: 8, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    }
  }, [gameState.score, scoreScale]);

  const scoreAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  // Handle game over
  const handleGameOver = useCallback(
    async (finalState: GameState) => {
      haptics.gameOverPattern(finalState.hasWon);

      if (currentFirebaseUser?.uid) {
        const stats: Snap2048Stats = {
          gameType: "snap_2048",
          bestTile: finalState.bestTile,
          moveCount: finalState.moveCount,
          mergeCount: 0,
          didWin: finalState.hasWon,
        };

        const duration = Math.floor((Date.now() - startTime) / 1000);

        await recordSinglePlayerSession(currentFirebaseUser.uid, {
          gameType: "snap_2048",
          finalScore: finalState.score,
          stats,
          duration,
        });
      }

      setShowGameOverModal(true);
    },
    [currentFirebaseUser, startTime, haptics],
  );

  // Process a swipe
  const handleSwipe = useCallback(
    (direction: Direction) => {
      if (isProcessingMove.current) return;

      const currentState = gameStateRef.current;
      if (currentState.isGameOver) return;

      isProcessingMove.current = true;

      // Store current positions before the move
      const prevPositions = new Map<number, { row: number; col: number }>();
      for (const tile of currentState.tiles) {
        prevPositions.set(tile.id, { row: tile.row, col: tile.col });
      }

      const result = processMove(currentState.tiles, direction);

      if (result.moved) {
        haptics.trigger("move");

        // Update previous positions for animation
        setPreviousPositions(prevPositions);

        const newBestTile = getMaxTile(result.newTiles);
        const newHasWon = currentState.hasWon || newBestTile >= WIN_TILE;
        const newIsGameOver = !canMakeMove(result.newTiles);

        const newState: GameState = {
          tiles: result.newTiles,
          score: currentState.score + result.scoreEarned,
          bestTile: newBestTile,
          moveCount: currentState.moveCount + 1,
          isGameOver: newIsGameOver,
          hasWon: newHasWon,
        };

        setGameState(newState);

        // Update high score
        if (newState.score > highScore) {
          setHighScore(newState.score);
        }

        // Show win dialog once
        if (newState.hasWon && !hasShownWinDialog) {
          setHasShownWinDialog(true);
          setShowWinDialog(true);
          haptics.celebrationPattern();
        }

        // Handle game over
        if (newState.isGameOver) {
          handleGameOver(newState);
        }
      }

      // Allow next move after animation completes
      setTimeout(() => {
        isProcessingMove.current = false;
      }, SLIDE_DURATION + 50);
    },
    [highScore, hasShownWinDialog, haptics, handleGameOver],
  );

  // Ref for handleSwipe
  const handleSwipeRef = useRef(handleSwipe);
  handleSwipeRef.current = handleSwipe;

  // Pan responder
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (
        _event: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const { dx, dy } = gestureState;

        if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
          return;
        }

        let direction: Direction;
        if (Math.abs(dx) > Math.abs(dy)) {
          direction = dx > 0 ? "right" : "left";
        } else {
          direction = dy > 0 ? "down" : "up";
        }

        handleSwipeRef.current(direction);
      },
    });
  }, []);

  // Start a new game
  const startNewGame = useCallback(() => {
    haptics.trigger("selection");
    setPreviousPositions(new Map());
    setGameState(createInitialState());
    setHasShownWinDialog(false);
    setShowWinDialog(false);
    setShowGameOverModal(false);
    isProcessingMove.current = false;
  }, [haptics]);

  // Continue after winning
  const continueGame = useCallback(() => {
    setShowWinDialog(false);
  }, []);

  // Share score
  const handleShare = useCallback(() => {
    setShowFriendPicker(true);
  }, []);

  const handleSelectFriend = useCallback(
    async (friend: {
      friendUid: string;
      username: string;
      displayName: string;
    }) => {
      if (!currentFirebaseUser?.uid || !profile) return;

      setShowFriendPicker(false);

      try {
        const success = await sendScorecard(
          currentFirebaseUser.uid,
          friend.friendUid,
          {
            gameId: "snap_2048",
            score: gameState.score,
            playerName: profile.displayName || profile.username || "Player",
          },
        );

        if (success) {
          showSuccess(`Score shared with ${friend.displayName}!`);
        } else {
          showError("Failed to share score. Try again.");
        }
      } catch {
        showError("Failed to share score. Try again.");
      }
    },
    [currentFirebaseUser, profile, gameState.score, showSuccess, showError],
  );

  // Render background grid cells
  const gridCells = useMemo(() => {
    const cells = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        cells.push(
          <View
            key={`cell-${row}-${col}`}
            style={[
              styles.gridCell,
              {
                left: getPixelPosition(col),
                top: getPixelPosition(row),
                width: CELL_SIZE,
                height: CELL_SIZE,
              },
            ]}
          />,
        );
      }
    }
    return cells;
  }, []);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          icon="arrow-left"
          textColor={theme.colors.onBackground}
        >
          Back
        </Button>
        <Text variant="headlineSmall" style={styles.title}>
          2048
        </Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Score Display */}
      <View style={styles.scoreContainer}>
        <Animated.View
          style={[
            styles.scoreBox,
            { backgroundColor: theme.colors.primaryContainer },
            scoreAnimatedStyle,
          ]}
        >
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onPrimaryContainer }}
          >
            SCORE
          </Text>
          <Text
            variant="headlineMedium"
            style={{
              color: theme.colors.onPrimaryContainer,
              fontWeight: "bold",
            }}
          >
            {gameState.score}
          </Text>
        </Animated.View>

        <View
          style={[
            styles.scoreBox,
            { backgroundColor: theme.colors.secondaryContainer },
          ]}
        >
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSecondaryContainer }}
          >
            BEST
          </Text>
          <Text
            variant="headlineMedium"
            style={{
              color: theme.colors.onSecondaryContainer,
              fontWeight: "bold",
            }}
          >
            {Math.max(highScore, gameState.score)}
          </Text>
        </View>
      </View>

      {/* Best Tile */}
      <View style={styles.bestTileContainer}>
        <Text variant="labelLarge" style={{ color: theme.colors.onBackground }}>
          Best Tile: {gameState.bestTile}
        </Text>
        {gameState.hasWon && (
          <View style={styles.winBadge}>
            <MaterialCommunityIcons name="trophy" size={16} color="#FFD700" />
            <Text style={styles.winBadgeText}>2048!</Text>
          </View>
        )}
      </View>

      {/* Game Board */}
      <View
        style={[styles.board, { backgroundColor: "#BBADA0" }]}
        {...panResponder.panHandlers}
      >
        {gridCells}

        {/* Render tiles */}
        {gameState.tiles.map((tile) => (
          <AnimatedTile
            key={tile.id}
            tile={tile}
            previousPositions={previousPositions}
          />
        ))}

        {/* Game Over Overlay */}
        {gameState.isGameOver && (
          <View style={styles.gameOverOverlay}>
            <Text style={styles.gameOverText}>Game Over!</Text>
            <Text style={styles.gameOverScore}>Score: {gameState.score}</Text>
          </View>
        )}
      </View>

      {/* Instructions */}
      <Text
        variant="bodyMedium"
        style={[styles.instructions, { color: theme.colors.onSurfaceVariant }]}
      >
        Swipe to move tiles. Matching tiles merge!
      </Text>

      {/* New Game Button */}
      <Button
        mode="contained"
        onPress={startNewGame}
        style={styles.newGameButton}
        icon="refresh"
      >
        New Game
      </Button>

      {/* Win Dialog */}
      <Portal>
        <Dialog visible={showWinDialog} onDismiss={continueGame}>
          <Dialog.Title>🎉 You Win!</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">Congratulations! You reached 2048!</Text>
            <Text variant="bodyMedium" style={{ marginTop: 8 }}>
              Score: {gameState.score}
            </Text>
            <Text
              variant="bodySmall"
              style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}
            >
              You can continue playing to reach higher tiles!
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={startNewGame}>New Game</Button>
            <Button mode="contained" onPress={continueGame}>
              Keep Playing
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Game Over Modal */}
      <GameOverModal
        visible={showGameOverModal}
        result={gameState.hasWon ? "win" : "loss"}
        stats={{
          score: gameState.score,
          personalBest: highScore,
          isNewBest: gameState.score > highScore,
          moves: gameState.moveCount,
        }}
        onRematch={startNewGame}
        onShare={handleShare}
        onExit={() => navigation.goBack()}
        showRematch={true}
        showShare={true}
        title={
          gameState.hasWon
            ? `🏆 ${gameState.bestTile} Achieved!`
            : `Best Tile: ${gameState.bestTile}`
        }
      />

      {/* Friend Picker */}
      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={handleSelectFriend}
        title="Share Score With..."
        currentUserId={currentFirebaseUser?.uid || ""}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  title: {
    fontWeight: "bold",
  },
  scoreContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  scoreBox: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 100,
  },
  bestTileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  winBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  winBadgeText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    borderRadius: 8,
    position: "relative",
  },
  gridCell: {
    position: "absolute",
    backgroundColor: "#CDC1B4",
    borderRadius: 4,
  },
  tile: {
    position: "absolute",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  tileText: {
    fontWeight: "bold",
  },
  gameOverOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(238, 228, 218, 0.73)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  gameOverText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#776E65",
  },
  gameOverScore: {
    fontSize: 24,
    color: "#776E65",
    marginTop: 8,
  },
  instructions: {
    marginTop: 24,
    textAlign: "center",
  },
  newGameButton: {
    marginTop: 16,
  },
});
