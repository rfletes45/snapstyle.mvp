/**
 * BounceBlitzGameScreen - Ballz-style Game
 *
 * How to play:
 * 1. Aim your shot by swiping in the direction you want to shoot
 * 2. Launch balls to destroy numbered blocks
 * 3. Each ball hit reduces a block's number by 1
 * 4. Clear all blocks to advance to the next level
 * 5. Don't let blocks reach the bottom!
 *
 * Features:
 * - Physics-based ball bouncing
 * - Numbered blocks that take multiple hits
 * - Power-ups and collectibles
 * - Progressive difficulty
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { sendScorecard } from "@/services/games";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Vibration,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

type GameStatus = "idle" | "aiming" | "shooting" | "waiting" | "gameOver";

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

interface Block {
  id: number;
  row: number;
  col: number;
  health: number;
  color: string;
  type: "normal" | "bonus" | "extra_ball";
}

interface BounceBlitzGameScreenProps {
  navigation: any;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const GAME_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
const COLS = 7;
const ROWS = 8;
const CELL_SIZE = GAME_WIDTH / COLS;
const GAME_HEIGHT = CELL_SIZE * (ROWS + 2); // Extra rows for launch area
const BALL_RADIUS = 8;
const BLOCK_PADDING = 3;
const BLOCK_SIZE = CELL_SIZE - BLOCK_PADDING * 2;

const GRAVITY = 0;
const INITIAL_SPEED = 12;
const BOUNCE_DAMPING = 1; // No energy loss on bounce
const FPS = 60;

// Block colors based on health
const BLOCK_COLORS = [
  "#4CAF50", // 1-5
  "#8BC34A", // 6-10
  "#CDDC39", // 11-20
  "#FFEB3B", // 21-30
  "#FFC107", // 31-50
  "#FF9800", // 51-75
  "#FF5722", // 76-100
  "#F44336", // 101+
];

function getBlockColor(health: number): string {
  if (health <= 5) return BLOCK_COLORS[0];
  if (health <= 10) return BLOCK_COLORS[1];
  if (health <= 20) return BLOCK_COLORS[2];
  if (health <= 30) return BLOCK_COLORS[3];
  if (health <= 50) return BLOCK_COLORS[4];
  if (health <= 75) return BLOCK_COLORS[5];
  if (health <= 100) return BLOCK_COLORS[6];
  return BLOCK_COLORS[7];
}

// =============================================================================
// Component
// =============================================================================

export default function BounceBlitzGameScreen({
  navigation,
}: BounceBlitzGameScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // Game state
  const [status, setStatus] = useState<GameStatus>("idle");
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [ballCount, setBallCount] = useState(1);
  const [isNewBest, setIsNewBest] = useState(false);
  const [totalBlocksDestroyed, setTotalBlocksDestroyed] = useState(0);
  const [totalBounces, setTotalBounces] = useState(0);

  // Aiming state
  const [aimAngle, setAimAngle] = useState<number | null>(null);
  const [launchX, setLaunchX] = useState(GAME_WIDTH / 2);

  // Refs to track current values for PanResponder (avoids stale closure)
  const statusRef = useRef<GameStatus>(status);
  const launchXRef = useRef<number>(launchX);
  const aimAngleRef = useRef<number | null>(aimAngle);

  // Refs to track game state values for endGame (avoids stale closure)
  const scoreRef = useRef<number>(score);
  const levelRef = useRef<number>(level);
  const ballCountRef = useRef<number>(ballCount);
  const totalBlocksDestroyedRef = useRef<number>(totalBlocksDestroyed);
  const totalBouncesRef = useRef<number>(totalBounces);
  const highScoreRef = useRef<number>(highScore);

  // Keep refs in sync with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    launchXRef.current = launchX;
  }, [launchX]);

  useEffect(() => {
    aimAngleRef.current = aimAngle;
  }, [aimAngle]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    ballCountRef.current = ballCount;
  }, [ballCount]);

  useEffect(() => {
    totalBlocksDestroyedRef.current = totalBlocksDestroyed;
  }, [totalBlocksDestroyed]);

  useEffect(() => {
    totalBouncesRef.current = totalBounces;
  }, [totalBounces]);

  useEffect(() => {
    highScoreRef.current = highScore;
  }, [highScore]);

  // Share state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Game objects
  const balls = useRef<Ball[]>([]);
  const blocks = useRef<Block[]>([]);
  const ballsReturned = useRef(0);
  const newLaunchX = useRef(GAME_WIDTH / 2);
  const gameLoopRef = useRef<number | null>(null);
  const blockIdCounter = useRef(0); // Unique ID counter for blocks
  const [renderTrigger, setRenderTrigger] = useState(0);
  // Track recently hit blocks to prevent multi-hit (blockId -> frames since hit)
  const recentlyHitBlocks = useRef<Map<number, number>>(new Map());

  // Generate blocks for a new level
  const generateBlocks = useCallback((levelNum: number): Block[] => {
    const newBlocks: Block[] = [];
    // Much gentler difficulty curve: start with 1 block, add 1 every 5 levels, max 4 blocks
    const blocksPerRow = Math.min(1 + Math.floor(levelNum / 5), 4);

    // Generate positions for blocks in the top row
    const positions = new Set<number>();
    while (positions.size < blocksPerRow) {
      positions.add(Math.floor(Math.random() * COLS));
    }

    positions.forEach((col) => {
      const blockId = blockIdCounter.current++; // Always unique
      // Determine block type (10% chance for bonus, 5% for extra ball)
      const rand = Math.random();
      let type: Block["type"] = "normal";
      if (rand < 0.05 && levelNum > 3) {
        type = "extra_ball";
      } else if (rand < 0.15) {
        type = "bonus";
      }

      // Health based on level - gentler difficulty curve
      // Starts at 1-2, grows slowly with diminishing returns
      const baseHealth = Math.ceil(1 + Math.sqrt(levelNum) * 0.8);
      const variance = Math.max(0, Math.floor(Math.sqrt(levelNum) * 0.3));
      const health = baseHealth + Math.floor(Math.random() * (variance + 1));

      newBlocks.push({
        id: blockId,
        row: 0,
        col,
        health: type === "extra_ball" ? 1 : health,
        color:
          type === "extra_ball"
            ? "#FFFC00"
            : type === "bonus"
              ? "#9C27B0"
              : getBlockColor(health),
        type,
      });
    });

    return newBlocks;
  }, []);

  // Initialize game
  const initGame = useCallback(() => {
    // Stop any running game loop first
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    balls.current = [];
    blockIdCounter.current = 0; // Reset block ID counter
    blocks.current = generateBlocks(1);
    ballsReturned.current = 0;
    newLaunchX.current = GAME_WIDTH / 2;

    setLevel(1);
    setScore(0);
    setBallCount(1);
    setLaunchX(GAME_WIDTH / 2);
    setAimAngle(null);
    setIsNewBest(false);
    setTotalBlocksDestroyed(0);
    setTotalBounces(0);
  }, [generateBlocks]);

  // Start game
  const startGame = useCallback(() => {
    console.log("[BounceBlitz] startGame called - initializing game");
    // Reset the ending flag in case it's stuck
    endingGameRef.current = false;
    initGame();
    // Use setTimeout to ensure state updates have processed
    setTimeout(() => {
      setStatus("aiming");
      statusRef.current = "aiming";
      console.log("[BounceBlitz] Game status set to 'aiming'");
    }, 50);
  }, [initGame]);

  // Launch balls
  const launchBalls = useCallback(
    (angle: number) => {
      setStatus("shooting");
      statusRef.current = "shooting";
      ballsReturned.current = 0;

      // Create balls with staggered launch
      const newBalls: Ball[] = [];
      for (let i = 0; i < ballCount; i++) {
        newBalls.push({
          id: i,
          x: launchX,
          y: GAME_HEIGHT - BALL_RADIUS - 10,
          vx: Math.cos(angle) * INITIAL_SPEED,
          vy: Math.sin(angle) * INITIAL_SPEED,
          active: false,
        });
      }
      balls.current = newBalls;

      // Start game loop
      let ballIndex = 0;
      const launchInterval = setInterval(() => {
        if (ballIndex < newBalls.length) {
          newBalls[ballIndex].active = true;
          ballIndex++;
        } else {
          clearInterval(launchInterval);
        }
      }, 80);

      // Game loop - check if we should continue after each update
      const gameLoop = () => {
        updateGame();
        // Only schedule next frame if we're still in shooting state
        // The updateGame function sets gameLoopRef.current to null when done
        if (gameLoopRef.current !== null && statusRef.current === "shooting") {
          gameLoopRef.current = requestAnimationFrame(gameLoop);
        }
      };
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    },
    [ballCount, launchX],
  );

  // Ref to store latest launchBalls function for PanResponder
  const launchBallsRef = useRef(launchBalls);
  useEffect(() => {
    launchBallsRef.current = launchBalls;
  }, [launchBalls]);

  // Flag to prevent multiple endGame calls
  const endingGameRef = useRef(false);

  // End game - uses refs to get current values, avoiding stale closures
  const endGame = useCallback(async () => {
    // Prevent multiple calls
    if (endingGameRef.current || statusRef.current === "gameOver") {
      console.log(
        "[BounceBlitz] endGame already in progress or game already over, skipping",
      );
      return;
    }
    endingGameRef.current = true;

    // Stop the game loop immediately
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    setStatus("gameOver");
    statusRef.current = "gameOver";

    if (Platform.OS !== "web") {
      Vibration.vibrate([0, 100, 50, 100]);
    }

    // Use refs to get current values
    const currentScore = scoreRef.current;
    const currentHighScore = highScoreRef.current;
    const currentLevel = levelRef.current;
    const currentBlocksDestroyed = totalBlocksDestroyedRef.current;
    const currentBallCount = ballCountRef.current;
    const currentBounces = totalBouncesRef.current;

    console.log(
      "[BounceBlitz] endGame - score:",
      currentScore,
      "level:",
      currentLevel,
    );

    const newBest = currentScore > currentHighScore;
    if (newBest) {
      setHighScore(currentScore);
      highScoreRef.current = currentScore;
      setIsNewBest(true);
      showSuccess("🎉 New High Score!");
    }

    // Record session
    if (currentFirebaseUser) {
      try {
        console.log(
          "[BounceBlitz] Recording session for user:",
          currentFirebaseUser.uid,
        );
        await recordSinglePlayerSession(currentFirebaseUser.uid, {
          gameType: "bounce_blitz",
          finalScore: currentScore,
          stats: {
            gameType: "bounce_blitz",
            levelReached: currentLevel,
            blocksDestroyed: currentBlocksDestroyed,
            ballsLaunched: currentBallCount,
            totalBounces: currentBounces,
          },
        });
        console.log("[BounceBlitz] Session recorded successfully");
      } catch (error) {
        console.error("[BounceBlitz] Error recording session:", error);
      }
    }

    // Reset the ending flag after a short delay
    endingGameRef.current = false;
  }, [currentFirebaseUser, showSuccess]);

  // Update game physics
  const updateGame = useCallback(() => {
    // Only process if we're in shooting state
    if (statusRef.current !== "shooting") {
      return;
    }

    let anyBallActive = false;
    let bounceOccurred = false;

    balls.current = balls.current.map((ball) => {
      if (!ball.active) {
        // Ball already returned, skip processing
        return ball;
      }

      anyBallActive = true;

      // Update position
      let newX = ball.x + ball.vx;
      let newY = ball.y + ball.vy;
      let newVx = ball.vx;
      let newVy = ball.vy;

      // Wall collisions
      if (newX - BALL_RADIUS < 0) {
        newX = BALL_RADIUS;
        newVx = -newVx * BOUNCE_DAMPING;
        bounceOccurred = true;
      } else if (newX + BALL_RADIUS > GAME_WIDTH) {
        newX = GAME_WIDTH - BALL_RADIUS;
        newVx = -newVx * BOUNCE_DAMPING;
        bounceOccurred = true;
      }

      // Ceiling collision
      if (newY - BALL_RADIUS < 0) {
        newY = BALL_RADIUS;
        newVy = -newVy * BOUNCE_DAMPING;
        bounceOccurred = true;
      }

      // Floor collision (ball returned)
      if (newY + BALL_RADIUS > GAME_HEIGHT - 10) {
        // First ball sets new launch position
        if (ballsReturned.current === 0) {
          newLaunchX.current = newX;
        }
        ballsReturned.current++;
        return { ...ball, active: false };
      }

      // Block collisions - track if we hit a block this frame to prevent multi-hits
      let hitBlockThisFrame = false;

      // Decrement cooldowns and remove expired entries
      recentlyHitBlocks.current.forEach((frames, blockId) => {
        if (frames <= 1) {
          recentlyHitBlocks.current.delete(blockId);
        } else {
          recentlyHitBlocks.current.set(blockId, frames - 1);
        }
      });

      blocks.current = blocks.current.map((block) => {
        // Skip if we already hit a block this frame
        if (hitBlockThisFrame) return block;

        // Skip if this block was recently hit (cooldown to prevent multi-hit)
        if (recentlyHitBlocks.current.has(block.id)) return block;

        // Extra ball pickups are pass-through (no collision/bounce)
        if (block.type === "extra_ball") {
          // Check if ball center is within pickup radius (circle collision)
          const blockCenterX = block.col * CELL_SIZE + CELL_SIZE / 2;
          const blockCenterY = (block.row + 1) * CELL_SIZE + CELL_SIZE / 2;
          const pickupRadius = BLOCK_SIZE / 2;

          const distX = newX - blockCenterX;
          const distY = newY - blockCenterY;
          const distance = Math.sqrt(distX * distX + distY * distY);

          if (distance < pickupRadius + BALL_RADIUS) {
            // Collect the extra ball - no bounce!
            setBallCount((b) => b + 1);
            setScore((s) => s + 10);
            return { ...block, health: 0 };
          }
          return block;
        }

        // Use full cell bounds for collision (no gaps between blocks)
        // This prevents balls from slipping through diagonal gaps
        const cellLeft = block.col * CELL_SIZE;
        const cellRight = cellLeft + CELL_SIZE;
        const cellTop = (block.row + 1) * CELL_SIZE;
        const cellBottom = cellTop + CELL_SIZE;

        // Check collision against full cell
        const closestX = Math.max(cellLeft, Math.min(newX, cellRight));
        const closestY = Math.max(cellTop, Math.min(newY, cellBottom));
        const distX = newX - closestX;
        const distY = newY - closestY;
        const distance = Math.sqrt(distX * distX + distY * distY);

        if (distance < BALL_RADIUS) {
          hitBlockThisFrame = true;
          bounceOccurred = true;

          // Add to recently hit blocks with cooldown (prevents re-hitting for 3 frames)
          recentlyHitBlocks.current.set(block.id, 3);

          // Determine collision side and push ball out more aggressively
          const overlapX = BALL_RADIUS - Math.abs(distX);
          const overlapY = BALL_RADIUS - Math.abs(distY);

          // Add extra push distance to ensure ball fully exits the block
          const pushExtra = 2;

          if (overlapX < overlapY) {
            newVx = -newVx;
            newX += distX > 0 ? overlapX + pushExtra : -(overlapX + pushExtra);
          } else {
            newVy = -newVy;
            newY += distY > 0 ? overlapY + pushExtra : -(overlapY + pushExtra);
          }

          // Handle block hit (normal and bonus blocks only)
          const newHealth = block.health - 1;
          if (newHealth <= 0) {
            setScore((s) => s + (block.type === "bonus" ? 20 : 10));
            setTotalBlocksDestroyed((t) => t + 1);
          }
          return {
            ...block,
            health: newHealth,
            color:
              block.type === "bonus" ? "#9C27B0" : getBlockColor(newHealth),
          };
        }
        return block;
      });

      // Remove destroyed blocks
      blocks.current = blocks.current.filter((b) => b.health > 0);

      return { ...ball, x: newX, y: newY, vx: newVx, vy: newVy };
    });

    if (bounceOccurred) {
      setTotalBounces((t) => t + 1);
    }

    // Check if all balls have returned (none are active and all have been launched)
    const allBallsReturned =
      !anyBallActive &&
      balls.current.length > 0 &&
      balls.current.every((b) => !b.active) &&
      ballsReturned.current >= balls.current.length;

    if (allBallsReturned) {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }

      // Move blocks down
      blocks.current = blocks.current.map((block) => ({
        ...block,
        row: block.row + 1,
      }));

      // Check for game over
      const gameOver = blocks.current.some((b) => b.row >= ROWS);
      if (gameOver) {
        endGame();
        return;
      }

      // Add new blocks for next level
      setLevel((l) => {
        const newLevel = l + 1;
        const newBlocks = generateBlocks(newLevel);
        blocks.current = [...newBlocks, ...blocks.current];
        return newLevel;
      });

      // Update launch position
      setLaunchX(newLaunchX.current);
      setStatus("aiming");
      statusRef.current = "aiming";
    }

    setRenderTrigger((t) => t + 1);
  }, [generateBlocks, endGame]);

  // Pan responder for aiming - uses refs to avoid stale closures
  const panResponder = useRef(
    PanResponder.create({
      // Capture phase - claim responder at the start
      onStartShouldSetPanResponderCapture: () => {
        const shouldCapture = statusRef.current === "aiming";
        console.log(
          "[BounceBlitz] onStartShouldSetPanResponderCapture - status:",
          statusRef.current,
          "capture:",
          shouldCapture,
        );
        return shouldCapture;
      },
      onMoveShouldSetPanResponderCapture: () => {
        const shouldCapture = statusRef.current === "aiming";
        console.log(
          "[BounceBlitz] onMoveShouldSetPanResponderCapture - status:",
          statusRef.current,
          "capture:",
          shouldCapture,
        );
        return shouldCapture;
      },
      onStartShouldSetPanResponder: () => {
        console.log(
          "[BounceBlitz] onStartShouldSetPanResponder - status:",
          statusRef.current,
        );
        return statusRef.current === "aiming";
      },
      onMoveShouldSetPanResponder: () => {
        console.log(
          "[BounceBlitz] onMoveShouldSetPanResponder - status:",
          statusRef.current,
        );
        return statusRef.current === "aiming";
      },
      onPanResponderGrant: () => {
        console.log("[BounceBlitz] Pan responder granted - aiming started");
      },
      onPanResponderMove: (_, gestureState) => {
        if (statusRef.current !== "aiming") return;

        const currentLaunchX = launchXRef.current;
        // Calculate relative to ball position (GAME_HEIGHT - BALL_RADIUS - 10)
        const ballY = GAME_HEIGHT - BALL_RADIUS - 10;
        const dx =
          gestureState.moveX - (SCREEN_WIDTH - GAME_WIDTH) / 2 - currentLaunchX;
        const dy =
          gestureState.moveY - (SCREEN_HEIGHT - GAME_HEIGHT) / 2 - ballY;

        console.log(
          "[BounceBlitz] Pan move - dx:",
          dx.toFixed(2),
          "dy:",
          dy.toFixed(2),
        );

        // Only allow aiming upward
        if (dy < -20) {
          const angle = Math.atan2(dy, dx);
          // Clamp angle to prevent shooting straight down
          const clampedAngle = Math.max(Math.min(angle, -0.2), -Math.PI + 0.2);
          console.log(
            "[BounceBlitz] Setting aim angle:",
            clampedAngle.toFixed(2),
          );
          setAimAngle(clampedAngle);
          aimAngleRef.current = clampedAngle;
        }
      },
      onPanResponderRelease: () => {
        console.log(
          "[BounceBlitz] Pan released - aimAngle:",
          aimAngleRef.current,
        );
        const currentAimAngle = aimAngleRef.current;
        if (currentAimAngle !== null) {
          console.log(
            "[BounceBlitz] Launching balls at angle:",
            currentAimAngle,
          );
          launchBallsRef.current(currentAimAngle);
          setAimAngle(null);
          aimAngleRef.current = null;
        }
      },
    }),
  ).current;

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
          gameId: "bounce_blitz",
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
      showError("Failed to share score. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Render aim line with ray-casting to find collision point
  const renderAimLine = () => {
    if (aimAngle === null) return null;

    // Starting position (directly above the ball)
    const startX = launchX;
    const startY = GAME_HEIGHT - BALL_RADIUS - 10;

    // Direction vector
    const dirX = Math.cos(aimAngle);
    const dirY = Math.sin(aimAngle);

    // Ray-cast to find collision point
    let endX = startX;
    let endY = startY;
    const step = 2; // Small step for accuracy
    const maxDistance = GAME_HEIGHT + GAME_WIDTH; // Maximum ray length

    for (let dist = 0; dist < maxDistance; dist += step) {
      const testX = startX + dirX * dist;
      const testY = startY + dirY * dist;

      // Check wall collisions
      if (testX - BALL_RADIUS <= 0 || testX + BALL_RADIUS >= GAME_WIDTH) {
        endX = testX;
        endY = testY;
        break;
      }

      // Check ceiling collision
      if (testY - BALL_RADIUS <= 0) {
        endX = testX;
        endY = testY;
        break;
      }

      // Check block collisions (skip extra_ball pickups since they're pass-through)
      let hitBlock = false;
      for (const block of blocks.current) {
        // Skip extra_ball pickups - they don't block the aim line
        if (block.type === "extra_ball") continue;

        const blockLeft = block.col * CELL_SIZE + BLOCK_PADDING;
        const blockRight = blockLeft + BLOCK_SIZE;
        const blockTop = (block.row + 1) * CELL_SIZE + BLOCK_PADDING;
        const blockBottom = blockTop + BLOCK_SIZE;

        // Simple AABB check with ball radius
        if (
          testX + BALL_RADIUS > blockLeft &&
          testX - BALL_RADIUS < blockRight &&
          testY + BALL_RADIUS > blockTop &&
          testY - BALL_RADIUS < blockBottom
        ) {
          hitBlock = true;
          break;
        }
      }

      if (hitBlock) {
        endX = testX;
        endY = testY;
        break;
      }

      endX = testX;
      endY = testY;
    }

    // Create dots along the line
    const dots = [];
    const lineLength = Math.sqrt(
      Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2),
    );
    const dotSpacing = 12;
    const numDots = Math.floor(lineLength / dotSpacing);

    for (let i = 0; i <= numDots; i++) {
      const t = i / Math.max(numDots, 1);
      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t;

      // Fade dots towards the end
      const opacity = 1 - t * 0.5;

      dots.push(
        <View
          key={i}
          style={[
            styles.aimDot,
            {
              left: x - 3,
              top: y - 3,
              opacity,
            },
          ]}
        />,
      );
    }

    // Add a larger dot at the collision point
    dots.push(
      <View
        key="collision"
        style={[
          styles.aimDot,
          {
            left: endX - 5,
            top: endY - 5,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: "#FF5722",
          },
        ]}
      />,
    );

    return dots;
  };

  return (
    <View style={[styles.container, { backgroundColor: "#1a1a2e" }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.backButton}>
          <Button
            onPress={() => navigation.goBack()}
            icon="arrow-left"
            textColor="white"
          >
            Back
          </Button>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.statBadge}>
            <Text style={styles.statLabel}>Level</Text>
            <Text style={styles.statValue}>{level}</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statLabel}>Score</Text>
            <Text style={styles.statValue}>{score}</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statLabel}>Balls</Text>
            <Text style={styles.statValue}>{ballCount}</Text>
          </View>
        </View>
      </View>

      {/* Game Area */}
      <View
        style={[styles.gameArea, { width: GAME_WIDTH, height: GAME_HEIGHT }]}
        {...panResponder.panHandlers}
      >
        {/* Blocks */}
        {blocks.current.map((block) => (
          <View
            key={block.id}
            style={[
              block.type === "extra_ball"
                ? styles.extraBallPickup
                : styles.block,
              block.type === "extra_ball"
                ? {
                    left:
                      block.col * CELL_SIZE + CELL_SIZE / 2 - BLOCK_SIZE / 2,
                    top:
                      (block.row + 1) * CELL_SIZE +
                      CELL_SIZE / 2 -
                      BLOCK_SIZE / 2,
                    width: BLOCK_SIZE,
                    height: BLOCK_SIZE,
                  }
                : {
                    left: block.col * CELL_SIZE + BLOCK_PADDING,
                    top: (block.row + 1) * CELL_SIZE + BLOCK_PADDING,
                    width: BLOCK_SIZE,
                    height: BLOCK_SIZE,
                    backgroundColor: block.color,
                  },
            ]}
          >
            {block.type === "extra_ball" ? (
              <MaterialCommunityIcons
                name="plus-circle"
                size={BLOCK_SIZE}
                color="#FFFC00"
              />
            ) : (
              <Text style={styles.blockText}>{block.health}</Text>
            )}
          </View>
        ))}

        {/* Balls */}
        {balls.current.map((ball) =>
          ball.active ? (
            <View
              key={ball.id}
              style={[
                styles.ball,
                {
                  left: ball.x - BALL_RADIUS,
                  top: ball.y - BALL_RADIUS,
                  width: BALL_RADIUS * 2,
                  height: BALL_RADIUS * 2,
                },
              ]}
            />
          ) : null,
        )}

        {/* Launch indicator */}
        {status === "aiming" && (
          <View
            style={[
              styles.launchIndicator,
              { left: launchX - BALL_RADIUS, bottom: 10 },
            ]}
          >
            <View style={styles.launchBall} />
            <Text style={styles.ballCountIndicator}>x{ballCount}</Text>
          </View>
        )}

        {/* Aim line */}
        {renderAimLine()}

        {/* Idle overlay */}
        {status === "idle" && (
          <View style={styles.overlay}>
            <MaterialCommunityIcons name="circle" size={64} color="#FFFC00" />
            <Text style={styles.overlayTitle}>Bounce Blitz</Text>
            <Text style={styles.overlaySubtitle}>
              Swipe to aim, release to shoot!
            </Text>
            <Button
              mode="contained"
              onPress={startGame}
              style={styles.startButton}
              buttonColor="#FFFC00"
              textColor="#1a1a2e"
            >
              Start Game
            </Button>
          </View>
        )}

        {/* Game Over overlay */}
        {status === "gameOver" && (
          <View style={styles.overlay}>
            <MaterialCommunityIcons
              name="emoticon-sad"
              size={64}
              color="#FF5722"
            />
            <Text style={styles.overlayTitle}>Game Over!</Text>

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
                  <Text style={styles.statItemValue}>{level}</Text>
                  <Text style={styles.statItemLabel}>Level</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statItemValue}>
                    {totalBlocksDestroyed}
                  </Text>
                  <Text style={styles.statItemLabel}>Blocks</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statItemValue}>{ballCount}</Text>
                  <Text style={styles.statItemLabel}>Balls</Text>
                </View>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={startGame}
                style={styles.playAgainButton}
                buttonColor="#4CAF50"
              >
                Play Again
              </Button>
              <Button
                mode="contained"
                icon="share"
                onPress={handleShare}
                style={styles.shareButton}
                buttonColor="#FFFC00"
                textColor="#1a1a2e"
              >
                Share
              </Button>
            </View>
          </View>
        )}
      </View>

      {/* Instructions */}
      {status === "aiming" && (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            👆 Swipe up to aim, release to shoot
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
            <Text>
              Challenge your friends! Level {level}, Score: {score}
            </Text>
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
    paddingHorizontal: 8,
    paddingTop: 50,
    paddingBottom: 10,
  },
  backButton: {
    flex: 1,
  },
  headerStats: {
    flexDirection: "row",
    gap: 12,
  },
  statBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 10,
    fontWeight: "500",
  },
  statValue: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  gameArea: {
    backgroundColor: "#16213e",
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 10,
  },
  block: {
    position: "absolute",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  blockText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  ball: {
    position: "absolute",
    backgroundColor: "white",
    borderRadius: BALL_RADIUS,
    shadowColor: "#FFFC00",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  launchIndicator: {
    position: "absolute",
    alignItems: "center",
  },
  launchBall: {
    width: BALL_RADIUS * 2,
    height: BALL_RADIUS * 2,
    borderRadius: BALL_RADIUS,
    backgroundColor: "white",
  },
  ballCountIndicator: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    marginTop: 4,
  },
  aimDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
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
    fontSize: 16,
    marginBottom: 24,
  },
  startButton: {
    minWidth: 150,
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
  statItemValue: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  statItemLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 24,
  },
  playAgainButton: {
    minWidth: 120,
  },
  shareButton: {
    minWidth: 100,
  },
  instructions: {
    marginTop: 20,
    alignItems: "center",
  },
  instructionText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
  },
  extraBallPickup: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    // No background - the icon provides the visual
  },
});
