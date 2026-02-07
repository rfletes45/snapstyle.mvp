/**
 * SnakeMasterGameScreen - Classic Snake Game
 *
 * How to play:
 * 1. Swipe to change the snake's direction
 * 2. Eat food to grow and score points
 * 3. Avoid hitting walls and yourself!
 * 4. Speed increases as you eat more food
 *
 * Features:
 * - Smooth swipe controls with haptic feedback
 * - Progressive speed increase
 * - Score and high score tracking with animations
 * - Pause/Resume functionality
 * - Visual feedback with colors and animations
 * - Polished game over modal
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { sendScorecard } from "@/services/games";
import {
  calculateBoardDimensions,
  calculateCellSize,
  changeDirection,
  createInitialSnakeState,
  getDirectionFromSwipe,
  getGameDuration,
  getSegmentColor,
  isHead,
  tick,
} from "@/services/games/snapSnakeLogic";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import {
  SnakeDirection,
  snake_master_CONFIG,
  SnapSnakeState,
  SnapSnakeStats,
} from "@/types/singlePlayerGames";
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
import { Button, Text, useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

// =============================================================================
// Types
// =============================================================================

interface SnakeMasterGameScreenProps {
  navigation: any;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HEADER_HEIGHT = 180;
const FOOTER_HEIGHT = 120;
const AVAILABLE_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;
const BOARD_PADDING = 16;

// Calculate grid and cell sizes
const GRID_WIDTH = 16;
const GRID_HEIGHT = 22;
const CELL_SIZE = calculateCellSize(
  SCREEN_WIDTH - BOARD_PADDING * 2,
  AVAILABLE_HEIGHT,
  GRID_WIDTH,
  GRID_HEIGHT,
);
const BOARD_DIMENSIONS = calculateBoardDimensions(
  CELL_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
);

const SWIPE_THRESHOLD = 20;

// =============================================================================
// Main Component
// =============================================================================

export default function SnakeMasterGameScreen({
  navigation,
}: SnakeMasterGameScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();
  const haptics = useGameHaptics();

  // Game state
  const [gameState, setGameState] = useState<SnapSnakeState>(() =>
    createInitialSnakeState(currentFirebaseUser?.uid ?? "guest", generateId(), {
      gridWidth: GRID_WIDTH,
      gridHeight: GRID_HEIGHT,
    }),
  );
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);

  // Share state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Game loop reference
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameStateRef = useRef(gameState);

  // Score animation
  const scoreScale = useSharedValue(1);

  // Keep ref in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Animate score when it changes
  useEffect(() => {
    if (gameState.score > 0) {
      scoreScale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    }
  }, [gameState.score, scoreScale]);

  const scoreAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  // Handle swipe gesture
  const handleSwipe = useCallback(
    (direction: SnakeDirection) => {
      if (gameState.status !== "playing" || isPaused) return;

      haptics.trigger("move");
      setGameState((prev) => changeDirection(prev, direction));
    },
    [gameState.status, isPaused, haptics],
  );

  // Pan responder for swipe detection
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy } = gestureState;
        const direction = getDirectionFromSwipe(dx, dy, SWIPE_THRESHOLD);

        if (direction) {
          handleSwipe(direction);
        }
      },
    }),
  ).current;

  // Game tick
  const gameTick = useCallback(() => {
    setGameState((prev) => {
      if (prev.status !== "playing") return prev;

      const newState = tick(prev);

      // Check if food was eaten
      if (newState.foodEaten > prev.foodEaten) {
        haptics.trigger("eat");
      }

      // Check for game over
      if (newState.status === "gameOver") {
        haptics.gameOverPattern(false);
      }

      return newState;
    });
  }, [haptics]);

  // Start game loop
  useEffect(() => {
    if (gameState.status === "playing" && !isPaused) {
      gameLoopRef.current = setInterval(gameTick, gameState.speed);
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState.status, gameState.speed, isPaused, gameTick]);

  // Handle game over
  useEffect(() => {
    if (gameState.status === "gameOver") {
      // Update high score
      if (gameState.score > highScore) {
        setHighScore(gameState.score);
      }

      // Record session
      const recordSession = async () => {
        if (currentFirebaseUser?.uid) {
          const stats: SnapSnakeStats = {
            gameType: "snake_master",
            foodEaten: gameState.foodEaten,
            maxLength: gameState.maxLength,
            survivalTime: getGameDuration(gameState),
          };

          await recordSinglePlayerSession(currentFirebaseUser.uid, {
            gameType: "snake_master",
            finalScore: gameState.score,
            stats,
            duration: getGameDuration(gameState),
          });
        }
      };

      recordSession();
      setShowGameOverModal(true);
    }
  }, [gameState.status, currentFirebaseUser, highScore]);

  // Start new game
  const startNewGame = useCallback(() => {
    haptics.trigger("selection");
    setGameState(
      createInitialSnakeState(
        currentFirebaseUser?.uid ?? "guest",
        generateId(),
        { gridWidth: GRID_WIDTH, gridHeight: GRID_HEIGHT },
      ),
    );
    setIsPaused(false);
    setShowShareDialog(false);
    setShowGameOverModal(false);
  }, [currentFirebaseUser, haptics]);

  // Pause/Resume
  const togglePause = useCallback(() => {
    if (gameState.status !== "playing") return;
    haptics.trigger("selection");
    setIsPaused((prev) => !prev);
  }, [gameState.status, haptics]);

  // Share score
  const handleShare = useCallback(async () => {
    setShowFriendPicker(true);
  }, []);

  const handleSelectFriend = useCallback(
    async (friend: {
      friendUid: string;
      username: string;
      displayName?: string;
    }) => {
      if (!currentFirebaseUser?.uid || !profile) return;

      setIsSending(true);
      try {
        await sendScorecard(currentFirebaseUser.uid, friend.friendUid, {
          gameId: "snake_master",
          score: gameState.score,
          playerName: profile.displayName || profile.username || "Player",
        });
        showSuccess("Scorecard sent!");
        setShowFriendPicker(false);
      } catch (error) {
        showError("Failed to send scorecard");
      } finally {
        setIsSending(false);
      }
    },
    [currentFirebaseUser, profile, gameState.score, showSuccess, showError],
  );

  // Render grid
  const renderGrid = () => {
    const lines = [];

    // Vertical lines
    for (let x = 0; x <= GRID_WIDTH; x++) {
      lines.push(
        <View
          key={`v-${x}`}
          style={[
            styles.gridLine,
            {
              left: x * CELL_SIZE,
              top: 0,
              width: 1,
              height: BOARD_DIMENSIONS.height,
              backgroundColor: snake_master_CONFIG.gridLineColor,
            },
          ]}
        />,
      );
    }

    // Horizontal lines
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      lines.push(
        <View
          key={`h-${y}`}
          style={[
            styles.gridLine,
            {
              left: 0,
              top: y * CELL_SIZE,
              width: BOARD_DIMENSIONS.width,
              height: 1,
              backgroundColor: snake_master_CONFIG.gridLineColor,
            },
          ]}
        />,
      );
    }

    return lines;
  };

  // Render snake
  const renderSnake = () => {
    return gameState.snake.map((segment, index) => {
      const color = getSegmentColor(index, gameState.snake.length);
      const isSnakeHead = isHead(index);

      return (
        <View
          key={`snake-${index}`}
          style={[
            styles.snakeSegment,
            {
              left: segment.x * CELL_SIZE + 1,
              top: segment.y * CELL_SIZE + 1,
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
              backgroundColor: color,
              borderRadius: isSnakeHead ? CELL_SIZE / 2 : 4,
            },
          ]}
        >
          {isSnakeHead && (
            <View style={styles.snakeEyes}>
              <View style={styles.snakeEye} />
              <View style={styles.snakeEye} />
            </View>
          )}
        </View>
      );
    });
  };

  // Render food
  const renderFood = () => (
    <View
      style={[
        styles.food,
        {
          left: gameState.food.x * CELL_SIZE + 2,
          top: gameState.food.y * CELL_SIZE + 2,
          width: CELL_SIZE - 4,
          height: CELL_SIZE - 4,
          backgroundColor: snake_master_CONFIG.foodColor,
        },
      ]}
    />
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: snake_master_CONFIG.gridColor },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          icon="arrow-left"
          textColor="#FFFFFF"
        >
          Back
        </Button>
        <Text variant="headlineSmall" style={styles.title}>
          🐍 Snake
        </Text>
        <Button
          mode="text"
          onPress={togglePause}
          icon={isPaused ? "play" : "pause"}
          textColor="#FFFFFF"
          disabled={gameState.status !== "playing"}
        >
          {isPaused ? "Play" : "Pause"}
        </Button>
      </View>

      {/* Score display */}
      <View style={styles.scoreContainer}>
        <Animated.View style={[styles.scoreBox, scoreAnimatedStyle]}>
          <Text variant="labelMedium" style={styles.scoreLabel}>
            SCORE
          </Text>
          <Text variant="headlineMedium" style={styles.scoreValue}>
            {gameState.score}
          </Text>
        </Animated.View>
        <View style={styles.scoreBox}>
          <Text variant="labelMedium" style={styles.scoreLabel}>
            LENGTH
          </Text>
          <Text variant="headlineMedium" style={styles.scoreValue}>
            {gameState.snake.length}
          </Text>
        </View>
        <View style={styles.scoreBox}>
          <Text variant="labelMedium" style={styles.scoreLabel}>
            BEST
          </Text>
          <Text variant="headlineMedium" style={styles.scoreValue}>
            {Math.max(highScore, gameState.score)}
          </Text>
        </View>
      </View>

      {/* Game board */}
      <View
        style={[
          styles.board,
          {
            width: BOARD_DIMENSIONS.width,
            height: BOARD_DIMENSIONS.height,
            backgroundColor: snake_master_CONFIG.gridColor,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {renderGrid()}
        {renderFood()}
        {renderSnake()}

        {/* Pause overlay */}
        {isPaused && (
          <View style={styles.pauseOverlay}>
            <MaterialCommunityIcons
              name="pause-circle"
              size={64}
              color="#FFFFFF"
            />
            <Text style={styles.pauseText}>PAUSED</Text>
            <Text style={styles.pauseSubtext}>Swipe to continue</Text>
          </View>
        )}

        {/* Game over overlay */}
        {gameState.status === "gameOver" && (
          <View style={styles.gameOverOverlay}>
            <Text style={styles.gameOverText}>Game Over!</Text>
            <Text style={styles.gameOverScore}>Score: {gameState.score}</Text>
            <Text style={styles.gameOverLength}>
              Length: {gameState.snake.length}
            </Text>
          </View>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.footer}>
        <Text variant="bodyMedium" style={styles.instructions}>
          Swipe to change direction
        </Text>
        <View style={styles.statsRow}>
          <Text style={styles.statText}>🍎 Food: {gameState.foodEaten}</Text>
          <Text style={styles.statText}>
            ⚡ Speed: {Math.round(1000 / gameState.speed)}x
          </Text>
        </View>
      </View>

      {/* Game Over Modal */}
      <GameOverModal
        visible={showGameOverModal}
        result="loss"
        stats={{
          score: gameState.score,
          personalBest: highScore,
          isNewBest: gameState.score > highScore,
          timeSeconds: getGameDuration(gameState),
        }}
        onRematch={startNewGame}
        onShare={handleShare}
        onExit={() => navigation.goBack()}
        showRematch={true}
        showShare={true}
        title={`🐍 Length: ${gameState.maxLength} | 🍎 Food: ${gameState.foodEaten}`}
      />

      {/* Friend Picker Modal */}
      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={handleSelectFriend}
        title="Send Scorecard"
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
    marginBottom: 8,
  },
  title: {
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  scoreContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  scoreBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    minWidth: 80,
  },
  scoreLabel: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  scoreValue: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  board: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: snake_master_CONFIG.gridLineColor,
  },
  gridLine: {
    position: "absolute",
  },
  snakeSegment: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  snakeEyes: {
    flexDirection: "row",
    gap: 4,
  },
  snakeEye: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  food: {
    position: "absolute",
    borderRadius: 999,
    shadowColor: snake_master_CONFIG.foodColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  pauseOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  pauseText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 16,
  },
  pauseSubtext: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 8,
  },
  gameOverOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  gameOverText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FF5722",
  },
  gameOverScore: {
    fontSize: 24,
    color: "#FFFFFF",
    marginTop: 12,
  },
  gameOverLength: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 4,
  },
  footer: {
    marginTop: 16,
    alignItems: "center",
  },
  instructions: {
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 24,
  },
  statText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
  },
  dialogStats: {
    gap: 4,
    marginTop: 8,
  },
  newHighScore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  newHighScoreText: {
    color: "#FFD700",
    fontWeight: "bold",
    fontSize: 16,
  },
});


