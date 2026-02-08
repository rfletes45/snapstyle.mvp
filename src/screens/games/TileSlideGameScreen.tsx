/**
 * Tile Slide Game Screen
 *
 * Classic sliding puzzle game where players rearrange numbered tiles
 * into order by sliding them into the empty space.
 *
 * Game Mechanics:
 * - Multiple puzzle sizes (3×3, 4×4, 5×5)
 * - Tap adjacent tile to slide into empty space
 * - Solvability guaranteed via inversion count algorithm
 * - Optional hint system
 * - Daily puzzle mode
 * - Image mode variant
 *
 * @see docs/NEW_SINGLEPLAYER_GAMES_PLAN.md for full specification
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { sendScorecard } from "@/services/games";
import {
  calculateScore,
  calculateStarRating,
  clearAnimationState,
  createPuzzle,
  createTileSlideStats,
  getValidMoves,
  isSolved,
  isTileCorrect,
  moveTile,
  PUZZLE_DIFFICULTIES,
  TileSlideSize,
  useHint,
} from "@/services/games/tileSlideLogic";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { TILE_SLIDE_CONFIG, TileSlideState } from "@/types/singlePlayerGames";
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
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Chip,
  Dialog,
  MD3Theme,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Canvas,
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";

// =============================================================================
// Types
// =============================================================================

interface TileSlideGameScreenProps {
  navigation: any;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_PADDING = 24;
const MAX_BOARD_SIZE = Math.min(SCREEN_WIDTH - BOARD_PADDING * 2, 360);
const SLIDE_ANIMATION_MS = TILE_SLIDE_CONFIG.slideAnimationMs;

// =============================================================================
// Animated Tile Component
// =============================================================================

interface AnimatedTileProps {
  value: number | null;
  index: number;
  gridSize: number;
  tileSize: number;
  gap: number;
  isCorrect: boolean;
  isHinted: boolean;
  isValidMove: boolean;
  onPress: (index: number) => void;
  theme: MD3Theme;
}

function AnimatedTile({
  value,
  index,
  gridSize,
  tileSize,
  gap,
  isCorrect,
  isHinted,
  isValidMove,
  onPress,
  theme,
}: AnimatedTileProps) {
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;
  const x = col * (tileSize + gap) + gap;
  const y = row * (tileSize + gap) + gap;

  // Animation values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(x);
  const translateY = useSharedValue(y);
  const hintPulse = useSharedValue(1);

  // Update position with animation when tile moves
  useEffect(() => {
    translateX.value = withTiming(x, {
      duration: SLIDE_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    translateY.value = withTiming(y, {
      duration: SLIDE_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [x, y, translateX, translateY]);

  // Hint pulse animation
  useEffect(() => {
    if (isHinted) {
      hintPulse.value = withSequence(
        withTiming(1.08, { duration: 300 }),
        withTiming(1, { duration: 300 }),
        withTiming(1.08, { duration: 300 }),
        withTiming(1, { duration: 300 }),
      );
    }
  }, [isHinted, hintPulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value * hintPulse.value },
    ],
  }));

  const handlePress = useCallback(() => {
    if (value === null) return;
    if (isValidMove) {
      scale.value = withSequence(
        withSpring(0.95, { damping: 10, stiffness: 400 }),
        withSpring(1, { damping: 15, stiffness: 300 }),
      );
    } else {
      // Shake animation for invalid move
      scale.value = withSequence(
        withTiming(1.02, { duration: 50 }),
        withTiming(0.98, { duration: 50 }),
        withTiming(1, { duration: 50 }),
      );
    }
    onPress(index);
  }, [value, isValidMove, index, onPress, scale]);

  if (value === null) {
    return null; // Empty space
  }

  // Calculate font size based on number of digits
  const digits = value.toString().length;
  let fontSize = tileSize * 0.45;
  if (digits === 2) fontSize = tileSize * 0.38;
  else if (digits >= 3) fontSize = tileSize * 0.3;

  const textColor =
    isHinted || isCorrect ? "#FFFFFF" : theme.colors.onPrimaryContainer;

  // Tile gradient colors based on state
  const gradientColors: [string, string, string] = isHinted
    ? ["#FFE44D", "#FFD700", "#E6B800"]
    : isCorrect
      ? ["#66BB6A", "#4CAF50", "#388E3C"]
      : [
          theme.colors.primaryContainer,
          theme.colors.primaryContainer,
          theme.colors.primaryContainer,
        ];

  const borderRadius = tileSize * 0.12;

  return (
    <Animated.View style={[styles.tileWrapper, animatedStyle]}>
      <Pressable
        onPress={handlePress}
        style={[
          styles.tile,
          {
            width: tileSize,
            height: tileSize,
            borderRadius,
          },
        ]}
      >
        <Canvas style={StyleSheet.absoluteFill}>
          {/* Tile body with gradient */}
          <RoundedRect
            x={0}
            y={0}
            width={tileSize}
            height={tileSize}
            r={borderRadius}
          >
            <LinearGradient
              start={vec(0, 0)}
              end={vec(tileSize, tileSize)}
              colors={gradientColors}
            />
            <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.15)" inner />
          </RoundedRect>
          {/* Top highlight strip */}
          <RoundedRect
            x={1}
            y={1}
            width={tileSize - 2}
            height={tileSize * 0.35}
            r={borderRadius - 1}
          >
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, tileSize * 0.35)}
              colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
            />
          </RoundedRect>
        </Canvas>
        <Text
          style={[
            styles.tileText,
            {
              fontSize,
              color: textColor,
            },
          ]}
        >
          {value}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// Size Selector Component
// =============================================================================

interface SizeSelectorProps {
  currentSize: TileSlideSize;
  onSelectSize: (size: TileSlideSize) => void;
  theme: MD3Theme;
}

function SizeSelector({ currentSize, onSelectSize, theme }: SizeSelectorProps) {
  const sizes: TileSlideSize[] = [3, 4, 5];

  return (
    <View style={styles.sizeSelector}>
      {sizes.map((size) => (
        <Chip
          key={size}
          selected={currentSize === size}
          onPress={() => onSelectSize(size)}
          style={[
            styles.sizeChip,
            currentSize === size && { backgroundColor: theme.colors.primary },
          ]}
          textStyle={{
            color:
              currentSize === size
                ? theme.colors.onPrimary
                : theme.colors.onSurface,
          }}
        >
          {size}×{size}
        </Chip>
      ))}
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function TileSlideGameScreen({
  navigation,
}: TileSlideGameScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();
  const haptics = useGameHaptics();

  // Game state
  const [gameState, setGameState] = useState<TileSlideState | null>(null);
  const [selectedSize, setSelectedSize] = useState<TileSlideSize>(4);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [hintTileIndex, setHintTileIndex] = useState<number | null>(null);
  const [highScore, setHighScore] = useState(0);
  const startTimeRef = useRef<number>(0);

  // Share state
  const [showFriendPicker, setShowFriendPicker] = useState(false);

  // Animation values
  const moveCountScale = useSharedValue(1);

  // Calculate board and tile sizes
  const boardSize = useMemo(() => {
    return Math.min(MAX_BOARD_SIZE, SCREEN_WIDTH - BOARD_PADDING * 2);
  }, []);

  const { tileSize, gap } = useMemo(() => {
    const size = gameState?.gridSize || selectedSize;
    const totalGap = (size + 1) * 6;
    const availableSpace = boardSize - totalGap;
    return {
      tileSize: Math.floor(availableSpace / size),
      gap: 6,
    };
  }, [boardSize, gameState?.gridSize, selectedSize]);

  // Ref for game state
  const gameStateRef = useRef(gameState);

  // Timer refs for cleanup on unmount
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);
  gameStateRef.current = gameState;

  // Start a new game
  const startGame = useCallback(
    (size: TileSlideSize = selectedSize) => {
      if (!currentFirebaseUser?.uid) return;

      const newState = createPuzzle(currentFirebaseUser.uid, size, "numbers");
      setGameState(newState);
      setIsGameStarted(true);
      setHintTileIndex(null);
      startTimeRef.current = Date.now();
      haptics.trigger("selection");
    },
    [currentFirebaseUser, selectedSize, haptics],
  );

  // Handle tile press
  const handleTilePress = useCallback(
    (tileIndex: number) => {
      if (!gameState || gameState.status !== "playing") return;

      const validMoves = getValidMoves(gameState);
      if (!validMoves.includes(tileIndex)) {
        haptics.trigger("warning");
        return;
      }

      const result = moveTile(gameState, tileIndex);
      if (!result.moved) return;

      haptics.trigger("tile_slide");
      setHintTileIndex(null);

      // Animate move counter
      moveCountScale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );

      // Check for win
      if (isSolved(result.newState)) {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const finalScore = calculateScore(result.newState, duration);
        const isOptimal =
          result.newState.moveCount <=
          PUZZLE_DIFFICULTIES[result.newState.gridSize].optimalMoves;

        const completedState: TileSlideState = {
          ...result.newState,
          status: "gameOver",
          score: finalScore,
          endedAt: Date.now(),
        };

        setGameState(completedState);
        haptics.puzzleSolvedPattern();

        // Record session
        if (currentFirebaseUser?.uid) {
          const stats = createTileSlideStats(completedState, isOptimal);
          recordSinglePlayerSession(currentFirebaseUser.uid, {
            gameType: "tile_slide",
            finalScore,
            stats,
            duration,
          });
        }

        // Update high score
        if (finalScore > highScore) {
          setHighScore(finalScore);
        }

        setShowWinDialog(true);
        return;
      }

      // Clear animation state after animation completes
      animTimerRef.current = setTimeout(() => {
        setGameState((prev) => (prev ? clearAnimationState(prev) : null));
      }, SLIDE_ANIMATION_MS);

      setGameState(result.newState);
    },
    [gameState, haptics, moveCountScale, currentFirebaseUser, highScore],
  );

  // Handle hint
  const handleHint = useCallback(() => {
    if (!gameState || gameState.status !== "playing") return;

    const { newState, hintTileIndex: hint } = useHint(gameState);
    setGameState(newState);
    setHintTileIndex(hint);
    haptics.trigger("selection");

    // Clear hint after 3 seconds
    hintTimerRef.current = setTimeout(() => {
      setHintTileIndex(null);
    }, 3000);
  }, [gameState, haptics]);

  // Handle share
  const handleShare = useCallback(() => {
    setShowFriendPicker(true);
  }, []);

  const handleSelectFriend = useCallback(
    async (friend: {
      friendUid: string;
      username: string;
      displayName: string;
    }) => {
      if (!currentFirebaseUser?.uid || !profile || !gameState) return;

      setShowFriendPicker(false);

      try {
        const success = await sendScorecard(
          currentFirebaseUser.uid,
          friend.friendUid,
          {
            gameId: "tile_slide",
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
    [currentFirebaseUser, profile, gameState, showSuccess, showError],
  );

  // Handle restart
  const handleRestart = useCallback(() => {
    setShowWinDialog(false);
    setShowGameOverModal(false);
    if (gameState) {
      startGame(gameState.gridSize);
    }
  }, [gameState, startGame]);

  // Handle exit
  const handleExit = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Move count animated style
  const moveCountAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: moveCountScale.value }],
  }));

  // Get valid moves for highlighting
  const validMoveIndices = useMemo(() => {
    if (!gameState) return new Set<number>();
    return new Set(getValidMoves(gameState));
  }, [gameState]);

  // Render game content
  const renderGame = () => {
    if (!gameState) return null;

    const { tiles, gridSize, moveCount, hintsUsed } = gameState;
    const actualBoardSize = gridSize * (tileSize + gap) + gap;

    return (
      <>
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Animated.View
            style={[
              styles.statBox,
              { backgroundColor: theme.colors.primaryContainer },
              moveCountAnimatedStyle,
            ]}
          >
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onPrimaryContainer }}
            >
              MOVES
            </Text>
            <Text
              variant="headlineSmall"
              style={{
                color: theme.colors.onPrimaryContainer,
                fontWeight: "bold",
              }}
            >
              {moveCount}
            </Text>
          </Animated.View>

          <View
            style={[
              styles.statBox,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSecondaryContainer }}
            >
              HINTS
            </Text>
            <Text
              variant="headlineSmall"
              style={{
                color: theme.colors.onSecondaryContainer,
                fontWeight: "bold",
              }}
            >
              {hintsUsed}
            </Text>
          </View>

          <View
            style={[
              styles.statBox,
              { backgroundColor: theme.colors.tertiaryContainer },
            ]}
          >
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onTertiaryContainer }}
            >
              BEST
            </Text>
            <Text
              variant="headlineSmall"
              style={{
                color: theme.colors.onTertiaryContainer,
                fontWeight: "bold",
              }}
            >
              {highScore}
            </Text>
          </View>
        </View>

        {/* Optimal moves hint */}
        <Text
          variant="bodySmall"
          style={[styles.optimalHint, { color: theme.colors.onSurfaceVariant }]}
        >
          Target: ~{PUZZLE_DIFFICULTIES[gridSize].optimalMoves} moves
        </Text>

        {/* Game Board */}
        <View
          style={[
            styles.board,
            {
              width: actualBoardSize,
              height: actualBoardSize,
              backgroundColor: theme.colors.surfaceVariant,
            },
          ]}
        >
          {/* Empty cell backgrounds */}
          {tiles.map((_, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            return (
              <View
                key={`bg-${index}`}
                style={[
                  styles.emptyCell,
                  {
                    left: col * (tileSize + gap) + gap,
                    top: row * (tileSize + gap) + gap,
                    width: tileSize,
                    height: tileSize,
                    borderRadius: tileSize * 0.12,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              />
            );
          })}

          {/* Tiles */}
          {tiles.map((value, index) => (
            <AnimatedTile
              key={`tile-${value ?? "empty"}-${index}`}
              value={value}
              index={index}
              gridSize={gridSize}
              tileSize={tileSize}
              gap={gap}
              isCorrect={value !== null && isTileCorrect(gameState, index)}
              isHinted={index === hintTileIndex}
              isValidMove={validMoveIndices.has(index)}
              onPress={handleTilePress}
              theme={theme}
            />
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={handleHint}
            icon="lightbulb-outline"
            style={styles.actionButton}
          >
            Hint
          </Button>
          <Button
            mode="contained"
            onPress={handleRestart}
            icon="refresh"
            style={styles.actionButton}
          >
            New Puzzle
          </Button>
        </View>

        {/* Instructions */}
        <Text
          variant="bodyMedium"
          style={[
            styles.instructions,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Tap a tile next to the empty space to slide it
        </Text>
      </>
    );
  };

  // Render size selection (before game starts)
  const renderSizeSelection = () => (
    <View style={styles.selectionContainer}>
      <MaterialCommunityIcons
        name="puzzle"
        size={64}
        color={theme.colors.primary}
        style={{ marginBottom: 16 }}
      />
      <Text
        variant="headlineMedium"
        style={{ color: theme.colors.onBackground, marginBottom: 8 }}
      >
        Tile Slide
      </Text>
      <Text
        variant="bodyLarge"
        style={{
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        Slide tiles to arrange them in order
      </Text>

      <Text
        variant="labelLarge"
        style={{ color: theme.colors.onBackground, marginBottom: 12 }}
      >
        Select Puzzle Size
      </Text>

      <SizeSelector
        currentSize={selectedSize}
        onSelectSize={setSelectedSize}
        theme={theme}
      />

      <View style={styles.difficultyInfo}>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {PUZZLE_DIFFICULTIES[selectedSize].name}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Target: ~{PUZZLE_DIFFICULTIES[selectedSize].optimalMoves} moves
        </Text>
      </View>

      <Button
        mode="contained"
        onPress={() => startGame(selectedSize)}
        style={styles.startButton}
        icon="play"
      >
        Start Puzzle
      </Button>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Button
          mode="text"
          onPress={handleExit}
          icon="arrow-left"
          textColor={theme.colors.onBackground}
        >
          Back
        </Button>
        <Text variant="headlineSmall" style={{ fontWeight: "bold" }}>
          🔢 Tile Slide
        </Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {isGameStarted ? renderGame() : renderSizeSelection()}
      </View>

      {/* Win Dialog */}
      <Portal>
        <Dialog
          visible={showWinDialog}
          onDismiss={() => setShowWinDialog(false)}
        >
          <Dialog.Title>🎉 Puzzle Solved!</Dialog.Title>
          <Dialog.Content>
            {gameState && (
              <>
                <Text variant="bodyLarge">Congratulations!</Text>
                <View style={styles.winStats}>
                  <Text variant="bodyMedium">Moves: {gameState.moveCount}</Text>
                  <Text variant="bodyMedium">Score: {gameState.score}</Text>
                  <Text variant="bodyMedium">
                    Stars:{" "}
                    {"⭐".repeat(
                      calculateStarRating(
                        gameState.moveCount,
                        PUZZLE_DIFFICULTIES[gameState.gridSize].optimalMoves,
                      ),
                    )}
                  </Text>
                  {gameState.hintsUsed > 0 && (
                    <Text variant="bodySmall" style={{ color: "#888" }}>
                      Hints used: {gameState.hintsUsed}
                    </Text>
                  )}
                </View>
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleShare}>Share</Button>
            <Button onPress={handleRestart}>New Puzzle</Button>
            <Button mode="contained" onPress={handleExit}>
              Exit
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Game Over Modal */}
      <GameOverModal
        visible={showGameOverModal}
        result="win"
        stats={{
          score: gameState?.score || 0,
          personalBest: highScore,
          isNewBest: (gameState?.score || 0) > highScore,
          moves: gameState?.moveCount || 0,
        }}
        onRematch={handleRestart}
        onShare={handleShare}
        onExit={handleExit}
        showRematch={true}
        showShare={true}
        title={`Puzzle Solved! ${"⭐".repeat(
          gameState
            ? calculateStarRating(
                gameState.moveCount,
                PUZZLE_DIFFICULTIES[gameState.gridSize].optimalMoves,
              )
            : 0,
        )}`}
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
    paddingTop: Platform.OS === "ios" ? 50 : 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  selectionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sizeSelector: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  sizeChip: {
    minWidth: 60,
  },
  difficultyInfo: {
    alignItems: "center",
    marginBottom: 24,
    gap: 4,
  },
  startButton: {
    minWidth: 200,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
    marginTop: 16,
  },
  statBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 80,
  },
  optimalHint: {
    marginBottom: 16,
  },
  board: {
    borderRadius: 12,
    position: "relative",
  },
  emptyCell: {
    position: "absolute",
  },
  tileWrapper: {
    position: "absolute",
  },
  tile: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  tileText: {
    fontWeight: "bold",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
  },
  instructions: {
    marginTop: 16,
    textAlign: "center",
  },
  winStats: {
    marginTop: 12,
    gap: 4,
  },
});
