/**
 * Snap2048GameScreen - 2048 Puzzle Game
 *
 * How to play:
 * 1. Swipe in any direction to slide all tiles
 * 2. Matching tiles merge and double their value
 * 3. Try to create the 2048 tile!
 * 4. Game ends when no moves are possible
 *
 * Features:
 * - Smooth tile animations with spring physics
 * - Score tracking with high score persistence
 * - New tile spawn animation with pop effect
 * - Merge animation with scale pulse
 * - Haptic feedback for all interactions
 * - Win detection (can continue playing)
 * - Polished game over modal
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { sendScorecard } from "@/services/games";
import {
  applyMove,
  createInitial2048State,
  getTileColor,
  getTileFontSize,
  getTileTextColor,
} from "@/services/games/snap2048Logic";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { Snap2048Direction, Snap2048Stats } from "@/types/singlePlayerGames";
import { generateId } from "@/utils/ids";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
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

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_SIZE = 4;
const BOARD_PADDING = 16;
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 48, 380);
const CELL_MARGIN = 6;
const CELL_SIZE = (BOARD_SIZE - CELL_MARGIN * (GRID_SIZE + 1)) / GRID_SIZE;

const SWIPE_THRESHOLD = 30;
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const ANIMATION_DURATION = 100; // ms for tile movement

// =============================================================================
// Tile Tracking Types
// =============================================================================

interface TrackedTile {
  id: number;
  value: number;
  row: number;
  col: number;
}

// Global tile ID counter
let nextTileId = 1;

// Create initial tracked tiles from a board
function createTrackedTiles(board: number[][]): TrackedTile[] {
  const tiles: TrackedTile[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] !== 0) {
        tiles.push({
          id: nextTileId++,
          value: board[row][col],
          row,
          col,
        });
      }
    }
  }
  return tiles;
}

// =============================================================================
// Tile Component with Position Animation
// =============================================================================

interface TileProps {
  tile: TrackedTile;
  isNew: boolean;
  isMerged: boolean;
}

// Memoized tile to prevent unnecessary rerenders
const Tile = React.memo(function Tile({ tile, isNew, isMerged }: TileProps) {
  const { value, row, col } = tile;

  // Calculate target position
  const targetX = col * (CELL_SIZE + CELL_MARGIN);
  const targetY = row * (CELL_SIZE + CELL_MARGIN);

  // Track previous position for animation
  const prevRow = useRef(row);
  const prevCol = useRef(col);

  // Calculate starting position (previous position or target for new tiles)
  const startX = isNew ? targetX : prevCol.current * (CELL_SIZE + CELL_MARGIN);
  const startY = isNew ? targetY : prevRow.current * (CELL_SIZE + CELL_MARGIN);

  // Animate position using shared values - start from previous position
  const posX = useSharedValue(startX);
  const posY = useSharedValue(startY);
  const scale = useSharedValue(isNew ? 0 : 1);

  // Animate to new position when row/col changes
  useEffect(() => {
    // Animate from current position to target
    posX.value = withTiming(targetX, { duration: ANIMATION_DURATION });
    posY.value = withTiming(targetY, { duration: ANIMATION_DURATION });

    // Update refs for next move
    prevRow.current = row;
    prevCol.current = col;
  }, [row, col, targetX, targetY, posX, posY]);

  // Handle new tile and merge animations
  useEffect(() => {
    if (isNew) {
      scale.value = 0;
      scale.value = withSequence(
        withTiming(0, { duration: ANIMATION_DURATION }), // Wait for slides
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    } else if (isMerged) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    }
  }, [isNew, isMerged, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value },
      { translateY: posY.value },
      { scale: scale.value },
    ],
  }));

  if (value === 0) return null;

  const backgroundColor = getTileColor(value);
  const textColor = getTileTextColor(value);
  const fontSize = getTileFontSize(value, CELL_SIZE);

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          left: CELL_MARGIN,
          top: CELL_MARGIN,
          width: CELL_SIZE,
          height: CELL_SIZE,
          backgroundColor,
        },
        animatedStyle,
      ]}
    >
      <Text
        style={[
          styles.tileText,
          {
            color: textColor,
            fontSize,
          },
        ]}
      >
        {value}
      </Text>
    </Animated.View>
  );
});

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

  // Game state
  const [gameState, setGameState] = useState(() =>
    createInitial2048State(currentFirebaseUser?.uid ?? "guest", generateId()),
  );
  const [highScore, setHighScore] = useState(0);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [hasShownWin, setHasShownWin] = useState(false);
  const [mergeCount, setMergeCount] = useState(0);
  const [showGameOverModal, setShowGameOverModal] = useState(false);

  // Share state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Tracked tiles for smooth animations
  const [trackedTiles, setTrackedTiles] = useState<TrackedTile[]>(() =>
    createTrackedTiles(gameState.board),
  );
  const [newTileId, setNewTileId] = useState<number | null>(null);
  const [mergedTileIds, setMergedTileIds] = useState<Set<number>>(new Set());

  // Animation lock to prevent rapid swipes
  const isAnimating = useRef(false);

  // Score animation
  const scoreScale = useSharedValue(1);

  // Animate score when it changes
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
    async (finalState: typeof gameState) => {
      // Haptic feedback for game over
      haptics.gameOverPattern(finalState.hasWon);

      // Record session
      if (currentFirebaseUser?.uid) {
        const stats: Snap2048Stats = {
          gameType: "snap_2048",
          bestTile: finalState.bestTile,
          moveCount: finalState.moveCount,
          mergeCount,
          didWin: finalState.hasWon,
        };

        const duration = Math.floor(
          ((finalState.endedAt ?? Date.now()) - finalState.startedAt) / 1000,
        );

        await recordSinglePlayerSession(currentFirebaseUser.uid, {
          gameType: "snap_2048",
          finalScore: finalState.score,
          stats,
          duration,
        });
      }

      // Show game over modal
      setShowGameOverModal(true);
    },
    [currentFirebaseUser, mergeCount, haptics],
  );

  // Handle swipe gesture
  const handleSwipe = useCallback(
    (direction: Snap2048Direction) => {
      if (isAnimating.current || gameState.status !== "playing") return;

      isAnimating.current = true;

      const newState = applyMove(gameState, direction);

      // Check if move was valid (state changed)
      if (newState.moveCount > gameState.moveCount) {
        // Haptic feedback for successful move
        haptics.trigger("move");

        // Update tracked tiles based on moves
        const newTrackedTiles: TrackedTile[] = [];
        const mergedIds = new Set<number>();
        let newlyCreatedTileId: number | null = null;

        // Build a map of tile positions for the new state
        const positionToValue = new Map<string, number>();
        for (let row = 0; row < GRID_SIZE; row++) {
          for (let col = 0; col < GRID_SIZE; col++) {
            const value = newState.board[row][col];
            if (value !== 0) {
              positionToValue.set(`${row}-${col}`, value);
            }
          }
        }

        // Process moved tiles - update positions of existing tiles
        if (newState.lastMove?.movedTiles) {
          const processedPositions = new Set<string>();

          for (const move of newState.lastMove.movedTiles) {
            const fromKey = `${move.from.row}-${move.from.col}`;
            const toKey = `${move.to.row}-${move.to.col}`;
            const newValue = newState.board[move.to.row][move.to.col];

            // Find the tile that was at this position
            const existingTile = trackedTiles.find(
              (t) => t.row === move.from.row && t.col === move.from.col,
            );

            if (existingTile && !processedPositions.has(toKey)) {
              // Check if this is a merge (value doubled)
              const isMerge = newValue > move.value;

              if (isMerge) {
                // Merged tile - create new tile with new ID (old tiles are removed)
                mergedIds.add(existingTile.id);
              }

              // Move the tile to new position with updated value
              newTrackedTiles.push({
                id: existingTile.id,
                value: newValue,
                row: move.to.row,
                col: move.to.col,
              });
              processedPositions.add(toKey);
            }
          }

          // Add tiles that didn't move
          for (const tile of trackedTiles) {
            const key = `${tile.row}-${tile.col}`;
            if (
              !newState.lastMove?.movedTiles.some(
                (m) => m.from.row === tile.row && m.from.col === tile.col,
              )
            ) {
              // Tile didn't move, check if still on board
              if (newState.board[tile.row][tile.col] === tile.value) {
                newTrackedTiles.push(tile);
              }
            }
          }
        }

        // Add newly spawned tile
        if (newState.lastMove?.newTile) {
          const { row, col, value } = newState.lastMove.newTile;
          const newTile: TrackedTile = {
            id: nextTileId++,
            value,
            row,
            col,
          };
          newTrackedTiles.push(newTile);
          newlyCreatedTileId = newTile.id;
        }

        // Track merge count for haptics
        if (
          newState.lastMove?.mergedPositions &&
          newState.lastMove.mergedPositions.length > 0
        ) {
          setMergeCount((c) => c + newState.lastMove!.mergedPositions.length);
          haptics.trigger("merge");
        }

        setTrackedTiles(newTrackedTiles);
        setNewTileId(newlyCreatedTileId);
        setMergedTileIds(mergedIds);
        setGameState(newState);

        // Update high score
        if (newState.score > highScore) {
          setHighScore(newState.score);
        }

        // Check for win (show dialog once)
        if (newState.hasWon && !hasShownWin) {
          setHasShownWin(true);
          setShowWinDialog(true);
          haptics.celebrationPattern();
        }

        // Check for game over
        if (newState.status === "gameOver") {
          handleGameOver(newState);
        }
      }

      // Reset animation lock after animation completes
      setTimeout(() => {
        isAnimating.current = false;
        // Clear animation flags
        setNewTileId(null);
        setMergedTileIds(new Set());
      }, ANIMATION_DURATION + 100);
    },
    [gameState, highScore, hasShownWin, haptics, handleGameOver, trackedTiles],
  );

  // Pan responder for swipe detection
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy, vx, vy } = gestureState;

        // Check if swipe is significant enough
        const isHorizontalSwipe =
          Math.abs(dx) > SWIPE_THRESHOLD ||
          Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD;
        const isVerticalSwipe =
          Math.abs(dy) > SWIPE_THRESHOLD ||
          Math.abs(vy) > SWIPE_VELOCITY_THRESHOLD;

        if (!isHorizontalSwipe && !isVerticalSwipe) return;

        // Determine direction
        if (Math.abs(dx) > Math.abs(dy)) {
          handleSwipe(dx > 0 ? "right" : "left");
        } else {
          handleSwipe(dy > 0 ? "down" : "up");
        }
      },
    }),
  ).current;

  // Start new game
  const startNewGame = useCallback(() => {
    haptics.trigger("selection");
    const newGameState = createInitial2048State(
      currentFirebaseUser?.uid ?? "guest",
      generateId(),
    );
    setGameState(newGameState);
    setTrackedTiles(createTrackedTiles(newGameState.board));
    setHasShownWin(false);
    setMergeCount(0);
    setNewTileId(null);
    setMergedTileIds(new Set());
    setShowShareDialog(false);
    setShowWinDialog(false);
    setShowGameOverModal(false);
  }, [currentFirebaseUser, haptics]);

  // Continue playing after win
  const continueGame = useCallback(() => {
    setShowWinDialog(false);
  }, []);

  // Share score
  const handleShare = useCallback(async () => {
    setShowFriendPicker(true);
  }, []);

  const handleSelectFriend = useCallback(
    async (friend: {
      friendUid: string;
      username: string;
      displayName: string;
    }) => {
      if (!currentFirebaseUser?.uid || !profile) return;

      setIsSending(true);
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
      } catch (error) {
        showError("Failed to share score. Try again.");
      } finally {
        setIsSending(false);
      }
    },
    [currentFirebaseUser, profile, gameState.score, showSuccess, showError],
  );

  // Render grid background
  const renderGridBackground = () => {
    const cells = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        cells.push(
          <View
            key={`bg-${row}-${col}`}
            style={[
              styles.gridCell,
              {
                left: CELL_MARGIN + col * (CELL_SIZE + CELL_MARGIN),
                top: CELL_MARGIN + row * (CELL_SIZE + CELL_MARGIN),
                width: CELL_SIZE,
                height: CELL_SIZE,
              },
            ]}
          />,
        );
      }
    }
    return cells;
  };

  // Render tiles from board state
  const renderTiles = () => {
    return trackedTiles.map((tile) => (
      <Tile
        key={tile.id}
        tile={tile}
        isNew={tile.id === newTileId}
        isMerged={mergedTileIds.has(tile.id)}
      />
    ));
  };

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

      {/* Score display */}
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

      {/* Best tile indicator */}
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

      {/* Game board */}
      <View
        style={[styles.board, { backgroundColor: "#BBADA0" }]}
        {...panResponder.panHandlers}
      >
        {renderGridBackground()}
        {renderTiles()}

        {/* Game over overlay */}
        {gameState.status === "gameOver" && (
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

      {/* Friend Picker Modal */}
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
