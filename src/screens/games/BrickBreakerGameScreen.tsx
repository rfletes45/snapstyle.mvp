/**
 * Brick Breaker Game Screen
 *
 * Classic arcade action game where players control a paddle to bounce
 * a ball and destroy all bricks. Features power-ups and multiple levels.
 *
 * Game Mechanics:
 * - Touch/drag to move paddle horizontally
 * - Ball bounces based on paddle contact point
 * - Multiple brick types (Standard, Silver, Gold, Explosive)
 * - 8 different power-ups
 * - Lives system with 3 starting lives
 * - 30 handcrafted levels
 *
 * @see docs/NEW_SINGLEPLAYER_GAMES_PLAN.md for full specification
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { sendScorecard } from "@/services/games";
import {
  advanceToNextLevel,
  applyPowerUp,
  CONFIG,
  createBrickBreakerState,
  createBrickBreakerStats,
  fireLaser,
  GameEvent,
  getBrickColor,
  getBrickPosition,
  getBricksRemaining,
  getDestroyableBrickCount,
  getPowerUpDisplay,
  handleBallLost,
  hasStuckBalls,
  isLevelComplete,
  launchBall,
  movePaddle,
  POWER_UP_INFO,
  updateActiveEffects,
  updateBallPhysics,
  updateLasers,
  updatePowerUps,
} from "@/services/games/brickBreakerLogic";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { BrickBreakerState } from "@/types/singlePlayerGames";
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
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import {
  Button,
  Dialog,
  MD3Theme,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// =============================================================================
// Types
// =============================================================================

interface BrickBreakerGameScreenProps {
  navigation: any;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GAME_SCALE = Math.min(1, SCREEN_WIDTH / CONFIG.canvasWidth);
const SCALED_WIDTH = CONFIG.canvasWidth * GAME_SCALE;
const SCALED_HEIGHT = CONFIG.canvasHeight * GAME_SCALE;

// =============================================================================
// Components
// =============================================================================

/**
 * Single brick component
 */
const Brick = React.memo(
  ({
    brick,
    scale,
    theme,
  }: {
    brick: BrickBreakerState["bricks"][0];
    scale: number;
    theme: MD3Theme;
  }) => {
    const pos = getBrickPosition(brick);
    const color = getBrickColor(brick);
    const opacity = useSharedValue(1);
    const scaleAnim = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ scale: scaleAnim.value }],
    }));

    return (
      <Animated.View
        style={[
          styles.brick,
          {
            left: pos.x * scale,
            top: pos.y * scale,
            width: pos.width * scale,
            height: pos.height * scale,
            backgroundColor: color,
            borderColor:
              brick.type === "indestructible"
                ? "#888"
                : brick.type === "mystery"
                  ? "#B67FCF"
                  : "rgba(255,255,255,0.3)",
          },
          animatedStyle,
        ]}
      >
        {brick.type === "explosive" && <Text style={styles.brickIcon}>💥</Text>}
        {brick.type === "mystery" && <Text style={styles.brickIcon}>?</Text>}
        {brick.type === "gold" && brick.hitsRemaining === 3 && (
          <Text style={styles.brickIcon}>✨</Text>
        )}
      </Animated.View>
    );
  },
);

/**
 * Ball component
 */
const Ball = React.memo(
  ({ ball, scale }: { ball: BrickBreakerState["balls"][0]; scale: number }) => {
    return (
      <View
        style={[
          styles.ball,
          {
            left: (ball.x - ball.radius) * scale,
            top: (ball.y - ball.radius) * scale,
            width: ball.radius * 2 * scale,
            height: ball.radius * 2 * scale,
            borderRadius: ball.radius * scale,
          },
        ]}
      />
    );
  },
);

/**
 * Animated Paddle component - uses shared value for smooth UI thread updates
 */
const AnimatedPaddle = React.memo(
  ({
    paddleX,
    width,
    scale,
    hasLaser,
    hasSticky,
  }: {
    paddleX: SharedValue<number>;
    width: number;
    scale: number;
    hasLaser: boolean;
    hasSticky: boolean;
  }) => {
    const animatedStyle = useAnimatedStyle(() => ({
      left: paddleX.value * scale,
    }));

    return (
      <Animated.View
        style={[
          styles.paddle,
          {
            top: CONFIG.paddleY * scale,
            width: width * scale,
            height: CONFIG.paddleHeight * scale,
            backgroundColor: hasSticky
              ? "#FFEB3B"
              : hasLaser
                ? "#E91E63"
                : "#FFFFFF",
          },
          animatedStyle,
        ]}
      >
        {hasLaser && (
          <>
            <View style={[styles.laserIndicator, { left: "20%" }]} />
            <View style={[styles.laserIndicator, { right: "20%" }]} />
          </>
        )}
      </Animated.View>
    );
  },
);

/**
 * Falling power-up component
 */
const PowerUp = React.memo(
  ({
    powerUp,
    scale,
  }: {
    powerUp: BrickBreakerState["powerUps"][0];
    scale: number;
  }) => {
    const display = getPowerUpDisplay(powerUp.type);
    const pulse = useSharedValue(1);

    useEffect(() => {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 300 }),
          withTiming(1, { duration: 300 }),
        ),
        -1,
        true,
      );
    }, [pulse]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: pulse.value }],
    }));

    return (
      <Animated.View
        style={[
          styles.powerUp,
          {
            left: (powerUp.x - CONFIG.powerUpSize / 2) * scale,
            top: (powerUp.y - CONFIG.powerUpSize / 2) * scale,
            width: CONFIG.powerUpSize * scale,
            height: CONFIG.powerUpSize * scale,
            backgroundColor: display.color,
          },
          animatedStyle,
        ]}
      >
        <Text style={styles.powerUpIcon}>{display.icon}</Text>
      </Animated.View>
    );
  },
);

/**
 * Laser projectile component
 */
const Laser = React.memo(
  ({
    laser,
    scale,
  }: {
    laser: BrickBreakerState["lasers"][0];
    scale: number;
  }) => {
    return (
      <View
        style={[
          styles.laser,
          {
            left: (laser.x - 2) * scale,
            top: laser.y * scale,
            width: 4 * scale,
            height: 12 * scale,
          },
        ]}
      />
    );
  },
);

/**
 * Lives display
 */
const LivesDisplay = React.memo(
  ({ lives, maxLives }: { lives: number; maxLives: number }) => {
    return (
      <View style={styles.livesContainer}>
        {Array.from({ length: maxLives + 2 }).map((_, i) => (
          <MaterialCommunityIcons
            key={i}
            name={i < lives ? "heart" : "heart-outline"}
            size={20}
            color={i < lives ? "#E91E63" : "#666"}
            style={styles.lifeIcon}
          />
        ))}
      </View>
    );
  },
);

/**
 * Active effects display
 */
const ActiveEffectsDisplay = React.memo(
  ({ effects }: { effects: BrickBreakerState["activeEffects"] }) => {
    if (effects.length === 0) return null;

    return (
      <View style={styles.effectsContainer}>
        {effects.map((effect, i) => {
          const display = POWER_UP_INFO[effect.type];
          const timeLeft =
            effect.expiresAt > 0
              ? Math.ceil((effect.expiresAt - Date.now()) / 1000)
              : effect.usesRemaining || 0;

          return (
            <View
              key={`${effect.type}-${i}`}
              style={[styles.effectBadge, { backgroundColor: display.color }]}
            >
              <Text style={styles.effectIcon}>{display.icon}</Text>
              <Text style={styles.effectTime}>
                {effect.expiresAt > 0 ? `${timeLeft}s` : `×${timeLeft}`}
              </Text>
            </View>
          );
        })}
      </View>
    );
  },
);

// =============================================================================
// Main Component
// =============================================================================

export default function BrickBreakerGameScreen({
  navigation,
}: BrickBreakerGameScreenProps): React.ReactElement {
  const theme = useTheme();
  const haptics = useGameHaptics();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showError, showSuccess } = useSnackbar();

  // Game state
  const [gameState, setGameState] = useState<BrickBreakerState | null>(null);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [showLevelCompleteDialog, setShowLevelCompleteDialog] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [initialBrickCount, setInitialBrickCount] = useState(0);

  // Game loop refs
  const gameStateRef = useRef<BrickBreakerState | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const laserCooldownRef = useRef<number>(0);

  // Shared value for smooth paddle movement (UI thread)
  const paddleX = useSharedValue(
    CONFIG.canvasWidth / 2 - CONFIG.paddleWidth / 2,
  );

  // NOTE: We manually sync gameStateRef everywhere we update gameState
  // This avoids the useEffect sync which could cause race conditions with the game loop

  // ==========================================================================
  // Game Initialization
  // ==========================================================================

  const startGame = useCallback(() => {
    if (!currentFirebaseUser?.uid) return;

    const newState = createBrickBreakerState(currentFirebaseUser.uid);
    setGameState(newState);
    setIsGameStarted(true);
    setInitialBrickCount(getDestroyableBrickCount(newState.bricks));
    gameStateRef.current = newState;
    // Reset paddle position shared value
    paddleX.value = newState.paddle.x;

    haptics.trigger("impact_medium");
  }, [currentFirebaseUser?.uid, haptics, paddleX]);

  // ==========================================================================
  // Session Recording
  // ==========================================================================

  const recordSession = useCallback(
    async (finalState: BrickBreakerState) => {
      if (!currentFirebaseUser?.uid) return;

      try {
        const stats = createBrickBreakerStats(finalState);
        const duration = Math.floor((Date.now() - finalState.startedAt) / 1000);
        await recordSinglePlayerSession(currentFirebaseUser.uid, {
          gameType: "brick_breaker",
          finalScore: finalState.score,
          stats,
          duration,
        });
      } catch (error) {
        console.error("[BrickBreaker] Failed to record session:", error);
      }
    },
    [currentFirebaseUser?.uid],
  );

  // ==========================================================================
  // Game Loop
  // ==========================================================================

  const processEvents = useCallback(
    (events: GameEvent[]) => {
      for (const event of events) {
        switch (event.type) {
          case "wall_hit":
            haptics.trigger("impact_light");
            break;
          case "paddle_hit":
            haptics.trigger("impact_medium");
            break;
          case "brick_hit":
            haptics.trigger("brick_hit");
            break;
          case "brick_destroyed":
            haptics.trigger("brick_destroy");
            if (event.brickType === "explosive") {
              haptics.trigger("impact_heavy");
            }
            break;
          case "powerup_collected":
            haptics.trigger("powerup_collect");
            break;
          case "ball_lost":
            haptics.trigger("error");
            break;
          case "laser_hit":
            haptics.trigger("impact_light");
            break;
        }
      }
    },
    [haptics],
  );

  // Sync paddle position from shared value to game state (called in game loop)
  const syncPaddlePosition = useCallback(() => {
    const state = gameStateRef.current;
    if (!state) return;

    const currentPaddleX = paddleX.value;
    if (Math.abs(state.paddle.x - currentPaddleX) > 0.1) {
      const newState = movePaddle(
        state,
        currentPaddleX + state.paddle.width / 2,
      );
      gameStateRef.current = newState;
    }
  }, [paddleX]);

  const gameLoop = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || state.phase !== "playing") {
      return;
    }

    // Sync paddle position from UI thread to game state for physics
    syncPaddlePosition();

    const now = Date.now();
    lastFrameTimeRef.current = now;

    let newState = gameStateRef.current!;
    const allEvents: GameEvent[] = [];

    // Update ball physics
    const ballResult = updateBallPhysics(newState);
    newState = ballResult.newState;
    allEvents.push(...ballResult.events);

    // Handle ball lost events
    const ballLostEvents = allEvents.filter((e) => e.type === "ball_lost");
    if (ballLostEvents.length > 0 && newState.balls.length === 0) {
      newState = handleBallLost(newState);
    }

    // Update power-ups
    const powerUpResult = updatePowerUps(newState);
    newState = powerUpResult.newState;

    // Apply collected power-ups
    for (const event of powerUpResult.events) {
      if (event.type === "powerup_collected" && event.powerUpType) {
        newState = applyPowerUp(newState, event.powerUpType);
      }
    }
    allEvents.push(...powerUpResult.events);

    // Update lasers
    const laserResult = updateLasers(newState);
    newState = laserResult.newState;
    allEvents.push(...laserResult.events);

    // Update active effects
    newState = updateActiveEffects(newState);

    // Process haptic feedback
    processEvents(allEvents);

    // Check level complete
    if (isLevelComplete(newState)) {
      haptics.levelCompletePattern();
      setShowLevelCompleteDialog(true);
      newState = { ...newState, phase: "levelComplete" };
    }

    // Check game over
    if (newState.phase === "gameOver") {
      haptics.gameOverPattern(false);
      setShowGameOverModal(true);
      recordSession(newState);
    }

    setGameState(newState);
    gameStateRef.current = newState;

    // Continue loop if still playing
    if (newState.phase === "playing") {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [processEvents, recordSession, syncPaddlePosition]);

  const startGameLoop = useCallback(() => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    lastFrameTimeRef.current = Date.now();
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  const stopGameLoop = useCallback(() => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGameLoop();
    };
  }, [stopGameLoop]);

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  const handleTap = useCallback(() => {
    const state = gameStateRef.current;
    if (!state) return;

    if (state.phase === "ready" && hasStuckBalls(state)) {
      // Launch ball
      const newState = launchBall(state);
      setGameState(newState);
      gameStateRef.current = newState;
      startGameLoop();
      haptics.trigger("impact_light");
    } else if (state.phase === "playing" && state.paddle.hasLaser) {
      // Fire laser
      const now = Date.now();
      if (now - laserCooldownRef.current > 300) {
        const newState = fireLaser(state);
        setGameState(newState);
        gameStateRef.current = newState;
        laserCooldownRef.current = now;
        haptics.trigger("impact_light");
      }
    }
  }, [haptics, startGameLoop]);

  // Pan gesture for paddle movement only
  // IMPORTANT: Do NOT access gameStateRef inside this callback!
  // Doing so causes Reanimated to "capture" the ref object, preventing JS-side modifications.
  // This was the root cause of the "ball not moving on mobile" bug.
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((event) => {
          "worklet";
          // Convert screen X to game X and clamp to canvas bounds
          // Use CONFIG.paddleWidth directly - do NOT access gameStateRef here!
          const gameX = event.x / GAME_SCALE;
          const paddleWidth = CONFIG.paddleWidth;
          const clampedX = Math.max(
            0,
            Math.min(CONFIG.canvasWidth - paddleWidth, gameX - paddleWidth / 2),
          );
          paddleX.value = clampedX;
        })
        .minDistance(0),
    [paddleX],
  );

  // ==========================================================================
  // Level Management
  // ==========================================================================

  const goToNextLevel = useCallback(() => {
    const state = gameStateRef.current;
    if (!state) return;

    setShowLevelCompleteDialog(false);
    const newState = advanceToNextLevel(state);
    setGameState(newState);
    gameStateRef.current = newState;
    setInitialBrickCount(getDestroyableBrickCount(newState.bricks));
    // Sync paddle position for new level
    paddleX.value = newState.paddle.x;

    if (newState.phase === "gameOver") {
      setShowGameOverModal(true);
      recordSession(newState);
    }

    haptics.trigger("success");
  }, [haptics, paddleX, recordSession]);

  // ==========================================================================
  // Navigation & Sharing
  // ==========================================================================

  const handleBack = useCallback(() => {
    stopGameLoop();
    navigation.goBack();
  }, [navigation, stopGameLoop]);

  const handlePlayAgain = useCallback(() => {
    setShowGameOverModal(false);
    setShowLevelCompleteDialog(false);
    startGame();
  }, [startGame]);

  const handleShare = useCallback(() => {
    setShowFriendPicker(true);
  }, []);

  const handleSelectFriend = useCallback(
    async (friend: {
      friendUid: string;
      username: string;
      displayName: string;
    }) => {
      if (!currentFirebaseUser?.uid || !gameState || !profile) return;

      setShowFriendPicker(false);

      try {
        const success = await sendScorecard(
          currentFirebaseUser.uid,
          friend.friendUid,
          {
            gameId: "brick_breaker",
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
        console.error("[BrickBreaker] Failed to send scorecard:", error);
        showError("Failed to share score. Try again.");
      }
    },
    [
      currentFirebaseUser?.uid,
      gameState,
      profile,
      haptics,
      showSuccess,
      showError,
    ],
  );

  const handleExitToHub = useCallback(() => {
    stopGameLoop();
    setShowGameOverModal(false);
    navigation.navigate("GamesHub");
  }, [navigation, stopGameLoop]);

  // ==========================================================================
  // Render Helpers
  // ==========================================================================

  const renderStartScreen = (): React.ReactElement => (
    <View style={styles.startContainer}>
      <Text
        variant="displaySmall"
        style={{ color: theme.colors.primary, marginBottom: 8 }}
      >
        🧱
      </Text>
      <Text
        variant="headlineLarge"
        style={{ color: theme.colors.onBackground, marginBottom: 16 }}
      >
        Brick Breaker
      </Text>
      <Text
        variant="bodyLarge"
        style={{
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          marginBottom: 8,
          paddingHorizontal: 24,
        }}
      >
        Bounce the ball to destroy all bricks!
      </Text>
      <Text
        variant="bodyMedium"
        style={{
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          marginBottom: 32,
          paddingHorizontal: 24,
        }}
      >
        Tap to launch • Drag to move paddle{"\n"}
        Collect power-ups • Complete 30 levels!
      </Text>

      {highScore > 0 && (
        <Text
          variant="titleMedium"
          style={{
            color: theme.colors.primary,
            marginBottom: 24,
          }}
        >
          High Score: {highScore.toLocaleString()}
        </Text>
      )}

      <Button
        mode="contained"
        onPress={startGame}
        style={{ borderRadius: 12, minWidth: 200 }}
        contentStyle={{ paddingVertical: 8 }}
        icon="play"
      >
        Start Game
      </Button>
    </View>
  );

  const renderGameContent = (): React.ReactElement | null => {
    if (!gameState) return null;

    const bricksRemaining = getBricksRemaining(gameState);

    return (
      <>
        {/* Game Stats */}
        <View style={styles.gameStats}>
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              LEVEL
            </Text>
            <Text
              style={[styles.statValue, { color: theme.colors.onBackground }]}
            >
              {gameState.currentLevel}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              SCORE
            </Text>
            <Text style={[styles.statValue, { color: theme.colors.primary }]}>
              {gameState.score.toLocaleString()}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              BRICKS
            </Text>
            <Text
              style={[styles.statValue, { color: theme.colors.onBackground }]}
            >
              {bricksRemaining}
            </Text>
          </View>
        </View>

        {/* Lives & Effects */}
        <View style={styles.gameInfo}>
          <LivesDisplay lives={gameState.lives} maxLives={gameState.maxLives} />
          <ActiveEffectsDisplay effects={gameState.activeEffects} />
        </View>

        {/* Game Canvas - TouchableWithoutFeedback for tap, GestureDetector for pan */}
        <TouchableWithoutFeedback onPress={handleTap}>
          <View style={{ flex: 0 }}>
            <GestureDetector gesture={panGesture}>
              <View
                style={[
                  styles.gameCanvas,
                  {
                    width: SCALED_WIDTH,
                    height: SCALED_HEIGHT,
                    backgroundColor: "#1a1a2e",
                  },
                ]}
              >
                {/* Bricks */}
                {gameState.bricks.map((brick) => (
                  <Brick
                    key={brick.id}
                    brick={brick}
                    scale={GAME_SCALE}
                    theme={theme}
                  />
                ))}

                {/* Power-ups */}
                {gameState.powerUps.map((powerUp) => (
                  <PowerUp
                    key={powerUp.id}
                    powerUp={powerUp}
                    scale={GAME_SCALE}
                  />
                ))}

                {/* Lasers */}
                {gameState.lasers.map((laser) => (
                  <Laser key={laser.id} laser={laser} scale={GAME_SCALE} />
                ))}

                {/* Paddle - uses shared value for smooth movement */}
                <AnimatedPaddle
                  paddleX={paddleX}
                  width={gameState.paddle.width}
                  scale={GAME_SCALE}
                  hasLaser={gameState.paddle.hasLaser}
                  hasSticky={gameState.paddle.hasSticky}
                />

                {/* Balls */}
                {gameState.balls.map((ball) => (
                  <Ball key={ball.id} ball={ball} scale={GAME_SCALE} />
                ))}

                {/* Tap to Launch indicator */}
                {gameState.phase === "ready" && (
                  <View style={styles.launchIndicator}>
                    <Text style={styles.launchText}>TAP TO LAUNCH</Text>
                  </View>
                )}
              </View>
            </GestureDetector>
          </View>
        </TouchableWithoutFeedback>

        {/* Instructions */}
        {gameState.phase === "playing" && gameState.paddle.hasLaser && (
          <Text
            variant="bodySmall"
            style={[
              styles.instructions,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Tap to fire lasers! 🔫
          </Text>
        )}
      </>
    );
  };

  // ==========================================================================
  // Main Render
  // ==========================================================================

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Button
            mode="text"
            onPress={handleBack}
            icon="arrow-left"
            textColor={theme.colors.onBackground}
          >
            Back
          </Button>
          <Text
            variant="headlineSmall"
            style={{ color: theme.colors.onBackground }}
          >
            🧱 Brick Breaker
          </Text>
          <View style={{ width: 80 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {isGameStarted ? renderGameContent() : renderStartScreen()}
        </View>

        {/* Level Complete Dialog */}
        <Portal>
          <Dialog
            visible={showLevelCompleteDialog}
            onDismiss={() => {}}
            style={{ backgroundColor: theme.colors.surface }}
          >
            <Dialog.Title style={{ textAlign: "center" }}>
              🎉 Level {gameState?.currentLevel} Complete!
            </Dialog.Title>
            <Dialog.Content>
              <View style={styles.levelCompleteContent}>
                <Text
                  variant="headlineMedium"
                  style={{
                    color: theme.colors.onSurface,
                    textAlign: "center",
                  }}
                >
                  Score: {gameState?.score.toLocaleString()}
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  Bricks Destroyed: {gameState?.bricksDestroyed}
                </Text>
                {gameState?.lives === gameState?.maxLives && (
                  <Text
                    variant="bodyLarge"
                    style={{
                      color: theme.colors.primary,
                      marginTop: 8,
                      textAlign: "center",
                    }}
                  >
                    ⭐ Perfect Level! +{CONFIG.noMissBonus} bonus
                  </Text>
                )}
              </View>
            </Dialog.Content>
            <Dialog.Actions style={{ justifyContent: "center" }}>
              <Button onPress={goToNextLevel} mode="contained">
                {gameState && gameState.currentLevel < CONFIG.totalLevels
                  ? "Next Level"
                  : "View Results"}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Game Over Modal */}
        <GameOverModal
          visible={showGameOverModal}
          result={
            gameState?.currentLevel === CONFIG.totalLevels ? "win" : "loss"
          }
          stats={{
            score: gameState?.score || 0,
            personalBest: highScore,
            isNewBest: (gameState?.score || 0) > highScore && highScore > 0,
            moves: gameState?.bricksDestroyed || 0,
          }}
          onRematch={handlePlayAgain}
          onShare={handleShare}
          onExit={handleExitToHub}
          showRematch={true}
          showShare={true}
          title={
            gameState?.currentLevel === CONFIG.totalLevels
              ? "🎉 You Win! All 30 Levels Complete!"
              : `Game Over - Level ${gameState?.currentLevel || 1}`
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
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  startContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  gameStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  gameInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  livesContainer: {
    flexDirection: "row",
  },
  lifeIcon: {
    marginHorizontal: 2,
  },
  effectsContainer: {
    flexDirection: "row",
  },
  effectBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 4,
  },
  effectIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  effectTime: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "bold",
  },
  gameCanvas: {
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  brick: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  brickIcon: {
    fontSize: 10,
  },
  ball: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  paddle: {
    position: "absolute",
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  laserIndicator: {
    position: "absolute",
    width: 4,
    height: 6,
    backgroundColor: "#FF0000",
    borderRadius: 2,
    top: -2,
  },
  powerUp: {
    position: "absolute",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  powerUpIcon: {
    fontSize: 14,
  },
  laser: {
    position: "absolute",
    backgroundColor: "#FF0000",
    borderRadius: 2,
    shadowColor: "#FF0000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  launchIndicator: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  launchText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  instructions: {
    marginTop: 12,
    textAlign: "center",
  },
  levelCompleteContent: {
    alignItems: "center",
    paddingVertical: 16,
  },
});
