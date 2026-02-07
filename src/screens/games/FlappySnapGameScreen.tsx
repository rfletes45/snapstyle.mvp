/**
 * FlappyBirdGameScreen - Flappy Bird-style Game
 *
 * How to play:
 * 1. Tap anywhere to make the ball jump/flap
 * 2. Navigate through the pipes without hitting them
 * 3. Score points for each pipe passed
 * 4. Perfect center passes give bonus points!
 *
 * Physics:
 * - Gravity constantly pulls the ball down
 * - Tapping applies an upward velocity
 * - Pipes scroll from right to left
 * - Collision detection with pipes and boundaries
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { sendScorecard } from "@/services/games";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import {
  FLAPPY_DUNK_CONFIG as CONFIG,
  FlappyHoop,
} from "@/types/singlePlayerGames";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  Vibration,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

type GameStatus = "idle" | "playing" | "paused" | "gameOver";

interface FlappyBirdGameScreenProps {
  navigation: any;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Scaled constants based on screen size
const GAME_WIDTH = Math.min(SCREEN_WIDTH, 400);
const GAME_HEIGHT = Math.min(SCREEN_HEIGHT - 100, 600);
const SCALE = GAME_WIDTH / CONFIG.worldWidth;

const BALL_RADIUS = CONFIG.ballRadius * SCALE;
const PIPE_WIDTH = CONFIG.hoopWidth * SCALE;
const PIPE_GAP = CONFIG.baseHoopGap * SCALE;
const PIPE_SPACING = CONFIG.hoopSpacing * SCALE;
const GRAVITY = CONFIG.gravity * SCALE;
const JUMP_VELOCITY = CONFIG.jumpVelocity * SCALE;
const TERMINAL_VELOCITY = CONFIG.terminalVelocity * SCALE;

const GROUND_HEIGHT = 60;
const CEILING_HEIGHT = 0;
const INITIAL_SCROLL_SPEED = 3;
const FPS = 60;

// =============================================================================
// Helper Functions
// =============================================================================

function generatePipe(
  x: number,
  index: number,
  difficultyLevel: number,
): FlappyHoop {
  // Adjust gap based on difficulty
  const gapReduction = Math.min(
    difficultyLevel * CONFIG.gapDecrease,
    CONFIG.baseHoopGap - CONFIG.minHoopGap,
  );
  const gap = (CONFIG.baseHoopGap - gapReduction) * SCALE;

  // Random center Y position (with padding from top/bottom)
  const minY = gap / 2 + 50;
  const maxY = GAME_HEIGHT - GROUND_HEIGHT - gap / 2 - 50;
  const centerY = minY + Math.random() * (maxY - minY);

  return {
    id: index,
    x,
    centerY,
    gapSize: gap,
    passed: false,
    scoredPerfect: false,
    // Add movement for higher difficulty levels
    moving:
      difficultyLevel >= 3
        ? {
            direction: Math.random() > 0.5 ? "up" : "down",
            speed: 0.5 + difficultyLevel * 0.1,
            minY: minY,
            maxY: maxY,
          }
        : undefined,
  };
}

function checkCollision(
  ballX: number,
  ballY: number,
  pipe: FlappyHoop,
): { hit: boolean; perfect: boolean } {
  // Ball bounds
  const ballLeft = ballX - BALL_RADIUS;
  const ballRight = ballX + BALL_RADIUS;
  const ballTop = ballY - BALL_RADIUS;
  const ballBottom = ballY + BALL_RADIUS;

  // Pipe bounds
  const pipeLeft = pipe.x;
  const pipeRight = pipe.x + PIPE_WIDTH;
  const gapTop = pipe.centerY - pipe.gapSize / 2;
  const gapBottom = pipe.centerY + pipe.gapSize / 2;

  // Check if ball is horizontally within pipe
  if (ballRight > pipeLeft && ballLeft < pipeRight) {
    // Check if ball hits top or bottom pipe
    if (ballTop < gapTop || ballBottom > gapBottom) {
      return { hit: true, perfect: false };
    }

    // Check for perfect pass (within center 30% of gap)
    const perfectZone = pipe.gapSize * 0.15;
    const perfectTop = pipe.centerY - perfectZone;
    const perfectBottom = pipe.centerY + perfectZone;

    if (ballY >= perfectTop && ballY <= perfectBottom) {
      return { hit: false, perfect: true };
    }
  }

  return { hit: false, perfect: false };
}

// =============================================================================
// Component
// =============================================================================

export default function FlappyBirdGameScreen({
  navigation,
}: FlappyBirdGameScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // Game state
  const [status, setStatus] = useState<GameStatus>("idle");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  // Share state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Physics refs
  const ballY = useRef(GAME_HEIGHT / 2);
  const ballVelocity = useRef(0);
  const ballRotation = useRef(0);
  const pipes = useRef<FlappyHoop[]>([]);
  const scrollSpeed = useRef(INITIAL_SCROLL_SPEED);
  const difficultyLevel = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const lastFrameTime = useRef<number>(0);

  // Animation values for rendering
  const ballYAnim = useRef(new Animated.Value(GAME_HEIGHT / 2)).current;
  const ballRotateAnim = useRef(new Animated.Value(0)).current;
  const pipesAnim = useRef(new Animated.Value(0)).current;
  const [renderTrigger, setRenderTrigger] = useState(0);

  // Load high score on mount
  useEffect(() => {
    if (currentFirebaseUser) {
      // Load from local storage or Firestore
      // For now, we'll track it in state
    }
  }, [currentFirebaseUser]);

  // Initialize game
  const initGame = useCallback(() => {
    ballY.current = GAME_HEIGHT / 2;
    ballVelocity.current = 0;
    ballRotation.current = 0;
    scrollSpeed.current = INITIAL_SCROLL_SPEED;
    difficultyLevel.current = 0;

    // Generate initial pipes
    const initialPipes: FlappyHoop[] = [];
    for (let i = 0; i < 4; i++) {
      initialPipes.push(generatePipe(GAME_WIDTH + i * PIPE_SPACING, i, 0));
    }
    pipes.current = initialPipes;

    setScore(0);
    setPerfectCount(0);
    setComboCount(0);
    setMaxCombo(0);
    setIsNewBest(false);

    // Reset animations
    ballYAnim.setValue(GAME_HEIGHT / 2);
    ballRotateAnim.setValue(0);
    pipesAnim.setValue(0);
  }, [ballYAnim, ballRotateAnim, pipesAnim]);

  // Start game
  const startGame = useCallback(() => {
    initGame();
    setStatus("playing");
    lastFrameTime.current = performance.now();

    // Start game loop
    const gameLoop = () => {
      const now = performance.now();
      const deltaTime = ((now - lastFrameTime.current) / 1000) * FPS;
      lastFrameTime.current = now;

      if (deltaTime > 0) {
        updateGame(deltaTime);
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [initGame]);

  // Update game physics
  const updateGame = useCallback(
    (deltaTime: number) => {
      // Apply gravity
      ballVelocity.current += GRAVITY * deltaTime;

      // Clamp velocity
      if (ballVelocity.current > TERMINAL_VELOCITY) {
        ballVelocity.current = TERMINAL_VELOCITY;
      }

      // Update ball position
      ballY.current += ballVelocity.current * deltaTime;

      // Update ball rotation based on velocity
      ballRotation.current = Math.min(
        90,
        Math.max(-30, ballVelocity.current * 3),
      );

      // Check boundary collisions
      if (ballY.current < BALL_RADIUS + CEILING_HEIGHT) {
        ballY.current = BALL_RADIUS + CEILING_HEIGHT;
        endGame();
        return;
      }
      if (ballY.current > GAME_HEIGHT - GROUND_HEIGHT - BALL_RADIUS) {
        ballY.current = GAME_HEIGHT - GROUND_HEIGHT - BALL_RADIUS;
        endGame();
        return;
      }

      // Update pipes
      let scored = false;
      let perfect = false;
      const ballX = GAME_WIDTH * 0.25; // Ball is at 25% from left

      pipes.current = pipes.current.map((pipe) => {
        // Move pipe
        const newX = pipe.x - scrollSpeed.current * deltaTime;

        // Move vertically if pipe has movement
        let newCenterY = pipe.centerY;
        if (pipe.moving) {
          const dir = pipe.moving.direction === "up" ? -1 : 1;
          newCenterY += dir * pipe.moving.speed * deltaTime;

          if (
            newCenterY <= pipe.moving.minY ||
            newCenterY >= pipe.moving.maxY
          ) {
            pipe.moving.direction =
              pipe.moving.direction === "up" ? "down" : "up";
          }
        }

        // Check collision
        const collision = checkCollision(ballX, ballY.current, {
          ...pipe,
          x: newX,
          centerY: newCenterY,
        });
        if (collision.hit) {
          endGame();
          return pipe;
        }

        // Check if passed
        if (!pipe.passed && newX + PIPE_WIDTH < ballX - BALL_RADIUS) {
          scored = true;
          if (collision.perfect && !pipe.scoredPerfect) {
            perfect = true;
            return {
              ...pipe,
              x: newX,
              centerY: newCenterY,
              passed: true,
              scoredPerfect: true,
            };
          }
          return { ...pipe, x: newX, centerY: newCenterY, passed: true };
        }

        return { ...pipe, x: newX, centerY: newCenterY };
      });

      // Remove off-screen pipes and add new ones
      if (pipes.current[0] && pipes.current[0].x < -PIPE_WIDTH) {
        pipes.current.shift();
        const lastPipe = pipes.current[pipes.current.length - 1];
        const newPipeX = lastPipe.x + PIPE_SPACING;
        pipes.current.push(
          generatePipe(newPipeX, lastPipe.id + 1, difficultyLevel.current),
        );
      }

      // Update score
      if (scored) {
        const basePoints = CONFIG.scorePerHoop;
        let bonusPoints = 0;

        if (perfect) {
          bonusPoints = CONFIG.perfectDunkBonus;
          setPerfectCount((p) => p + 1);
          setComboCount((c) => {
            const newCombo = c + 1;
            setMaxCombo((m) => Math.max(m, newCombo));
            return newCombo;
          });

          // Haptic feedback for perfect
          if (Platform.OS !== "web") {
            Vibration.vibrate(50);
          }
        } else {
          setComboCount(0);
        }

        setScore((s) => {
          const comboBonus = comboCount * CONFIG.comboMultiplier;
          const newScore =
            s + basePoints + bonusPoints + Math.floor(comboBonus);

          // Increase difficulty every 5 points
          if (
            Math.floor(newScore / CONFIG.difficultyIncreaseInterval) >
            difficultyLevel.current
          ) {
            difficultyLevel.current++;
            scrollSpeed.current =
              INITIAL_SCROLL_SPEED +
              difficultyLevel.current * CONFIG.speedIncrease;
          }

          return newScore;
        });
      }

      // Update animations
      ballYAnim.setValue(ballY.current);
      ballRotateAnim.setValue(ballRotation.current);
      setRenderTrigger((t) => t + 1);
    },
    [comboCount, ballYAnim, ballRotateAnim],
  );

  // Handle tap/jump
  const handleTap = useCallback(() => {
    if (status === "idle" || status === "gameOver") {
      startGame();
      return;
    }

    if (status === "playing") {
      ballVelocity.current = JUMP_VELOCITY;
      ballRotation.current = -30;

      if (Platform.OS !== "web") {
        Vibration.vibrate(10);
      }
    }
  }, [status, startGame]);

  // End game
  const endGame = useCallback(async () => {
    setStatus("gameOver");

    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    // Haptic feedback
    if (Platform.OS !== "web") {
      Vibration.vibrate([0, 100, 50, 100]);
    }

    // Check high score
    const currentScore = score;
    const newBest = currentScore > highScore;
    if (newBest) {
      setHighScore(currentScore);
      setIsNewBest(true);
      showSuccess("🎉 New High Score!");
    }

    // Record session
    if (currentFirebaseUser) {
      try {
        await recordSinglePlayerSession(currentFirebaseUser.uid, {
          gameType: "flappy_bird",
          finalScore: currentScore,
          stats: {
            gameType: "flappy_bird",
            pipesPassed: score,
            perfectPasses: perfectCount,
            maxCombo,
            totalJumps: 0, // Would need to track this
          },
        });
      } catch (error) {
        console.error("[FlappySnap] Error recording session:", error);
      }
    }
  }, [
    score,
    highScore,
    perfectCount,
    maxCombo,
    currentFirebaseUser,
    showSuccess,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, []);

  // Share handlers
  const handleShare = () => setShowShareDialog(true);

  const shareToChat = () => {
    setShowShareDialog(false);
    setShowFriendPicker(true);
  };

  const handleSelectFriend = async (friend: {
    friendUid: string;
    username: string;
    displayName: string;
  }) => {
    if (!currentFirebaseUser || !profile) return;

    setIsSending(true);
    setShowFriendPicker(false);

    try {
      const success = await sendScorecard(
        currentFirebaseUser.uid,
        friend.friendUid,
        {
          gameId: "flappy_bird",
          score,
          playerName: profile.displayName || profile.username || "Player",
        },
      );

      if (success) {
        showSuccess(`Score shared with ${friend.displayName}!`);
      } else {
        showError("Failed to share score. Try again.");
      }
    } catch (error) {
      console.error("[FlappySnap] Error sharing score:", error);
      showError("Failed to share score. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Render ball rotation
  const ballRotateStyle = {
    transform: [
      {
        rotate: ballRotateAnim.interpolate({
          inputRange: [-30, 90],
          outputRange: ["-30deg", "90deg"],
        }),
      },
    ],
  };

  return (
    <View style={[styles.container, { backgroundColor: "#1a1a2e" }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
          <View style={styles.backButton}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.colors.onBackground}
            />
          </View>
        </TouchableWithoutFeedback>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>
        <View style={styles.highScoreContainer}>
          <MaterialCommunityIcons name="trophy" size={16} color="#FFD700" />
          <Text style={styles.highScoreValue}>{highScore}</Text>
        </View>
      </View>

      {/* Game Area */}
      <TouchableWithoutFeedback onPress={handleTap}>
        <View
          style={[styles.gameArea, { width: GAME_WIDTH, height: GAME_HEIGHT }]}
        >
          {/* Sky gradient background */}
          <View style={styles.sky} />

          {/* Pipes */}
          {pipes.current.map((pipe) => (
            <View
              key={pipe.id}
              style={[styles.pipeContainer, { left: pipe.x }]}
            >
              {/* Top pipe */}
              <View
                style={[
                  styles.pipe,
                  styles.pipeTop,
                  {
                    height: pipe.centerY - pipe.gapSize / 2,
                    width: PIPE_WIDTH,
                  },
                ]}
              >
                <View style={styles.pipeCap} />
              </View>
              {/* Bottom pipe */}
              <View
                style={[
                  styles.pipe,
                  styles.pipeBottom,
                  {
                    top: pipe.centerY + pipe.gapSize / 2,
                    height:
                      GAME_HEIGHT -
                      GROUND_HEIGHT -
                      pipe.centerY -
                      pipe.gapSize / 2,
                    width: PIPE_WIDTH,
                  },
                ]}
              >
                <View style={[styles.pipeCap, styles.pipeCapBottom]} />
              </View>
            </View>
          ))}

          {/* Ball */}
          <Animated.View
            style={[
              styles.ball,
              {
                top: ballYAnim,
                left: GAME_WIDTH * 0.25 - BALL_RADIUS,
                width: BALL_RADIUS * 2,
                height: BALL_RADIUS * 2,
                borderRadius: BALL_RADIUS,
              },
              ballRotateStyle,
            ]}
          >
            <MaterialCommunityIcons
              name="snapchat"
              size={BALL_RADIUS * 1.5}
              color="#1a1a2e"
            />
          </Animated.View>

          {/* Ground */}
          <View style={[styles.ground, { height: GROUND_HEIGHT }]} />

          {/* Combo indicator */}
          {comboCount > 0 && status === "playing" && (
            <View style={styles.comboContainer}>
              <Text style={styles.comboText}>🔥 {comboCount}x Combo!</Text>
            </View>
          )}

          {/* Idle/GameOver Overlay */}
          {(status === "idle" || status === "gameOver") && (
            <View style={styles.overlay}>
              <MaterialCommunityIcons name="bird" size={64} color="#FFFC00" />
              <Text style={styles.overlayTitle}>
                {status === "idle" ? "Flappy Snap" : "Game Over!"}
              </Text>

              {status === "gameOver" && (
                <View style={styles.statsContainer}>
                  <Text style={styles.finalScore}>{score}</Text>
                  <Text style={styles.finalScoreLabel}>points</Text>

                  {isNewBest && (
                    <View style={styles.newBestBadge}>
                      <MaterialCommunityIcons
                        name="star"
                        size={16}
                        color="#FFD700"
                      />
                      <Text style={styles.newBestText}>New Best!</Text>
                    </View>
                  )}

                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{perfectCount}</Text>
                      <Text style={styles.statLabel}>Perfect</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{maxCombo}</Text>
                      <Text style={styles.statLabel}>Max Combo</Text>
                    </View>
                  </View>

                  <Button
                    mode="contained"
                    icon="share"
                    onPress={handleShare}
                    style={styles.shareButton}
                    buttonColor="#FFFC00"
                    textColor="#1a1a2e"
                  >
                    Share Score
                  </Button>
                </View>
              )}

              <Text style={styles.overlaySubtitle}>
                {status === "idle" ? "Tap to Start" : "Tap to Play Again"}
              </Text>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Instructions */}
      {status === "idle" && (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            🐦 Tap to flap through the pipes
          </Text>
          <Text style={styles.instructionText}>
            ⭐ Pass through the center for bonus points!
          </Text>
        </View>
      )}

      {/* Share Dialog */}
      <Portal>
        <Dialog
          visible={showShareDialog}
          onDismiss={() => setShowShareDialog(false)}
          style={{ backgroundColor: theme.colors.surface }}
        >
          <Dialog.Title>Share Your Score</Dialog.Title>
          <Dialog.Content>
            <Text>Challenge your friends with your score of {score}!</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowShareDialog(false)}>Cancel</Button>
            <Button onPress={shareToChat} mode="contained">
              Send to Friend
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  scoreContainer: {
    alignItems: "center",
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "500",
  },
  scoreValue: {
    color: "white",
    fontSize: 32,
    fontWeight: "bold",
  },
  highScoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  highScoreValue: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "600",
  },
  gameArea: {
    backgroundColor: "#16213e",
    overflow: "hidden",
    borderRadius: 16,
    marginTop: 10,
  },
  sky: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0f3460",
  },
  pipeContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  pipe: {
    position: "absolute",
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#2E7D32",
  },
  pipeTop: {
    top: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  pipeBottom: {
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  pipeCap: {
    position: "absolute",
    bottom: -2,
    left: -4,
    right: -4,
    height: 20,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#2E7D32",
    borderRadius: 4,
  },
  pipeCapBottom: {
    bottom: undefined,
    top: -2,
  },
  ball: {
    position: "absolute",
    backgroundColor: "#FFFC00",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  ground: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#8B4513",
    borderTopWidth: 4,
    borderTopColor: "#228B22",
  },
  comboContainer: {
    position: "absolute",
    top: 20,
    alignSelf: "center",
    backgroundColor: "rgba(255, 152, 0, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  comboText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  overlayTitle: {
    color: "white",
    fontSize: 32,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  overlaySubtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 18,
    marginTop: 20,
  },
  statsContainer: {
    alignItems: "center",
    marginTop: 16,
  },
  finalScore: {
    color: "#FFFC00",
    fontSize: 64,
    fontWeight: "bold",
  },
  finalScoreLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 16,
    marginTop: -8,
  },
  newBestBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    gap: 4,
  },
  newBestText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 32,
    marginTop: 20,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
  },
  shareButton: {
    marginTop: 20,
  },
  instructions: {
    marginTop: 20,
    alignItems: "center",
    gap: 8,
  },
  instructionText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
  },
});


