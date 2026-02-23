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
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import ScoreRaceOverlay, {
  type ScoreRaceOverlayPhase,
} from "@/components/ScoreRaceOverlay";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import { COLYSEUS_FEATURES } from "@/constants/featureFlags";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useScoreRace } from "@/hooks/useScoreRace";
import { useSpectator } from "@/hooks/useSpectator";
import { sendScorecard } from "@/services/games";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Canvas,
  LinearGradient,
  RadialGradient,
  RoundedRect,
  Shadow,
  Circle as SkiaCircle,
  vec,
} from "@shopify/react-native-skia";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Vibration,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { GameOverModal } from "@/components/games/GameOverModal";
import {
  PhysicsDebugOverlay,
  usePhysicsDebug,
} from "@/components/games/PhysicsDebugOverlay";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { onGameResultNotification } from "@/services/gameResultEvents";
import { createLogger } from "@/utils/log";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
const logger = createLogger("screens/games/BounceBlitzGameScreen");
// =============================================================================
// Types
// =============================================================================

type GameStatus =
  | "idle"
  | "aiming"
  | "shooting"
  | "waiting"
  | "gameOver"
  | "colyseus";

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

/** Lighten a hex color by amount (0–255) */
function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Darken a hex color by amount (0–255) */
function darkenColor(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// =============================================================================
// Component
// =============================================================================

function BounceBlitzGameScreen({
  navigation,
  route,
}: BounceBlitzGameScreenProps & { route: any }) {
  const haptics = useGameHaptics();
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // Colyseus multiplayer
  const { resolvedMode, firestoreGameId } = useGameConnection(
    "bounce_blitz_game",
    route?.params?.matchId,
  );
  const isOnlineAvailable =
    !!COLYSEUS_FEATURES.COLYSEUS_ENABLED && !!COLYSEUS_FEATURES.PHYSICS_ENABLED;
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const mpRace = useScoreRace({
    gameType: "bounce_blitz",
    autoJoin: isOnlineMode,
    firestoreGameId: firestoreGameId ?? undefined,
  });

  useEffect(() => {
    if (resolvedMode === "colyseus" && firestoreGameId) {
      setIsOnlineMode(true);
    }
  }, [resolvedMode, firestoreGameId]);

  // Game state
  const [status, setStatus] = useState<GameStatus>("idle");
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [ballCount, setBallCount] = useState(1);
  const [isNewBest, setIsNewBest] = useState(false);
  const [totalBlocksDestroyed, setTotalBlocksDestroyed] = useState(0);
  const [totalBounces, setTotalBounces] = useState(0);
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduleTimeout = useCallback(
    (callback: () => void, delayMs: number) => {
      const timeoutId = setTimeout(callback, delayMs);
      timeoutIdsRef.current.push(timeoutId);
      return timeoutId;
    },
    [],
  );

  // Aiming state
  const [aimAngle, setAimAngle] = useState<number | null>(null);
  const [launchX, setLaunchX] = useState(GAME_WIDTH / 2);

  // Refs to track current values for aim gesture (avoids stale closure)
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
    // Send score to Colyseus in online mode
    if (isOnlineMode && mpRace.phase === "playing") {
      mpRace.sendScore(score);
    }
  }, [score, isOnlineMode, mpRace]);

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
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  // GameOverModal / XP state
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [didLevelUp, setDidLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);

  // Listen for game result notifications (XP + achievements)
  useEffect(() => {
    const unsub = onGameResultNotification((n) => {
      if (n.gameId === "bounce_blitz") {
        setXpEarned(n.xpEarned);
        setDidLevelUp(n.didLevelUp);
        setNewLevel(n.newLevel);
      }
    });
    return unsub;
  }, []);

  // Spectator hosting — allows friends to watch via SpectatorRoom
  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "bounce_blitz",
  });

  // Auto-start spectator hosting so invites can be sent before game starts
  useEffect(() => {
    spectatorHost.startHosting();
  }, []);

  // Game objects
  const balls = useRef<Ball[]>([]);
  const blocks = useRef<Block[]>([]);
  const ballsReturned = useRef(0);
  const newLaunchX = useRef(GAME_WIDTH / 2);
  const gameLoopRef = useRef<number | null>(null);
  const blockIdCounter = useRef(0); // Unique ID counter for blocks
  const [renderTrigger, setRenderTrigger] = useState(0);
  const spectatorFrameCount = useRef(0);

  // Physics debug harness (__DEV__ only)
  const physicsDebug = usePhysicsDebug();

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
    logger.info("[BounceBlitz] startGame called - initializing game");
    // Reset the ending flag in case it's stuck
    endingGameRef.current = false;
    initGame();
    spectatorHost.startHosting();
    // Use setTimeout to ensure state updates have processed
    scheduleTimeout(() => {
      setStatus("aiming");
      statusRef.current = "aiming";
      logger.info("[BounceBlitz] Game status set to 'aiming'");
    }, 50);
  }, [initGame, scheduleTimeout]);

  // Safety timeout ref to prevent infinite shooting loops
  const shootingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Launch balls
  const launchBalls = useCallback(
    (angle: number) => {
      // Pre-shot game-over check: blocks already at loss threshold
      if (blocks.current.some((b) => b.row >= ROWS)) {
        endGameRef.current();
        return;
      }

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

      // Safety timeout: force-end game if shooting takes longer than 30s
      if (shootingTimeoutRef.current) clearTimeout(shootingTimeoutRef.current);
      shootingTimeoutRef.current = setTimeout(() => {
        if (statusRef.current === "shooting") {
          logger.warn(
            "[BounceBlitz] Shooting safety timeout reached — forcing game over",
          );
          // Force all balls inactive
          balls.current = balls.current.map((b) => ({ ...b, active: false }));
          if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
            gameLoopRef.current = null;
          }
          endGameRef.current();
        }
      }, 30000);

      // Game loop - use ref to always call latest updateGame (avoids stale closures)
      const gameLoop = () => {
        updateGameRef.current();
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

  // Ref to store latest updateGame function to avoid stale closures in game loop
  const updateGameRef = useRef(updateGame);
  useEffect(() => {
    updateGameRef.current = updateGame;
  }, [updateGame]);

  // Ref to store latest launchBalls function for aim gesture
  const launchBallsRef = useRef(launchBalls);
  useEffect(() => {
    launchBallsRef.current = launchBalls;
  }, [launchBalls]);

  // Flag to prevent multiple endGame calls
  const endingGameRef = useRef(false);

  // End game - uses refs to get current values, avoiding stale closures
  const endGame = useCallback(() => {
    // Prevent multiple calls
    if (endingGameRef.current || statusRef.current === "gameOver") {
      logger.info(
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
    // Clear safety timeout
    if (shootingTimeoutRef.current) {
      clearTimeout(shootingTimeoutRef.current);
      shootingTimeoutRef.current = null;
    }

    setStatus("gameOver");
    statusRef.current = "gameOver";
    spectatorHost.endHosting(scoreRef.current);

    // Reset XP state before new run
    setXpEarned(0);
    setDidLevelUp(false);
    setNewLevel(0);

    if (Platform.OS !== "web") {
      Vibration.vibrate([0, 100, 50, 100]);
    }
    haptics.gameOver();

    // Use refs to get current values
    const currentScore = scoreRef.current;
    const currentHighScore = highScoreRef.current;
    const currentLevel = levelRef.current;
    const currentBlocksDestroyed = totalBlocksDestroyedRef.current;
    const currentBallCount = ballCountRef.current;
    const currentBounces = totalBouncesRef.current;

    logger.info(
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

    // Show the game-over modal immediately (don't block on session recording)
    setShowGameOverModal(true);

    // Record session in the background (non-blocking)
    if (currentFirebaseUser) {
      logger.info(
        "[BounceBlitz] Recording session for user:",
        currentFirebaseUser.uid,
      );
      recordSinglePlayerSession(currentFirebaseUser.uid, {
        gameType: "bounce_blitz",
        finalScore: currentScore,
        stats: {
          gameType: "bounce_blitz",
          levelReached: currentLevel,
          blocksDestroyed: currentBlocksDestroyed,
          ballsLaunched: currentBallCount,
          totalBounces: currentBounces,
        },
      })
        .then(() => logger.info("[BounceBlitz] Session recorded successfully"))
        .catch((error) =>
          logger.error("[BounceBlitz] Error recording session:", error),
        );
    }

    // Reset the ending flag after a short delay
    endingGameRef.current = false;
  }, [currentFirebaseUser, showSuccess, haptics]);

  // Ref to store latest endGame function for use in launchBalls safety checks
  const endGameRef = useRef(endGame);
  useEffect(() => {
    endGameRef.current = endGame;
  }, [endGame]);

  // ── Physics constants ──
  const BB_EPSILON = 1; // px separation after collision
  const BB_MAX_SUB_STEPS = 8;

  // Update game physics — sub-stepped to prevent tunneling & double-hits
  const updateGame = useCallback(() => {
    if (statusRef.current !== "shooting") {
      return;
    }

    let anyBallActive = false;
    let bounceOccurred = false;

    balls.current = balls.current.map((ball) => {
      if (!ball.active) {
        return ball;
      }

      anyBallActive = true;

      let newX = ball.x;
      let newY = ball.y;
      let newVx = ball.vx;
      let newVy = ball.vy;

      // Calculate sub-steps based on speed vs cell size
      const speed = Math.sqrt(newVx * newVx + newVy * newVy);
      const subSteps = Math.min(
        BB_MAX_SUB_STEPS,
        Math.max(1, Math.ceil(speed / (CELL_SIZE / 2))),
      );

      let ballReturned = false;

      for (let step = 0; step < subSteps; step++) {
        if (ballReturned) break;

        // Move by 1/N of current velocity
        newX += newVx / subSteps;
        newY += newVy / subSteps;

        // ── Wall collisions ──
        if (newX - BALL_RADIUS < 0) {
          newX = BALL_RADIUS + BB_EPSILON;
          newVx = Math.abs(newVx) * BOUNCE_DAMPING;
          bounceOccurred = true;
        } else if (newX + BALL_RADIUS > GAME_WIDTH) {
          newX = GAME_WIDTH - BALL_RADIUS - BB_EPSILON;
          newVx = -Math.abs(newVx) * BOUNCE_DAMPING;
          bounceOccurred = true;
        }

        // ── Ceiling collision ──
        if (newY - BALL_RADIUS < 0) {
          newY = BALL_RADIUS + BB_EPSILON;
          newVy = Math.abs(newVy) * BOUNCE_DAMPING;
          bounceOccurred = true;
        }

        // ── Floor collision (ball returned) ──
        if (newY + BALL_RADIUS > GAME_HEIGHT - 10) {
          if (ballsReturned.current === 0) {
            newLaunchX.current = newX;
          }
          ballsReturned.current++;
          ballReturned = true;
          break;
        }

        // ── Block collisions (one per sub-step with epsilon separation) ──
        const hitThisStep = new Set<number>();

        for (let bi = 0; bi < blocks.current.length; bi++) {
          const block = blocks.current[bi];
          if (block.health <= 0) continue;
          if (hitThisStep.has(block.id)) continue;

          // Extra ball pickups — pass-through (circle collision, no bounce)
          if (block.type === "extra_ball") {
            const bCx = block.col * CELL_SIZE + CELL_SIZE / 2;
            const bCy = (block.row + 1) * CELL_SIZE + CELL_SIZE / 2;
            const pickupR = BLOCK_SIZE / 2;
            const dx = newX - bCx;
            const dy = newY - bCy;
            if (Math.sqrt(dx * dx + dy * dy) < pickupR + BALL_RADIUS) {
              setBallCount((b) => b + 1);
              setScore((s) => s + 10);
              blocks.current[bi] = { ...block, health: 0 };
            }
            continue;
          }

          // Full cell bounds (no gaps)
          const cellLeft = block.col * CELL_SIZE;
          const cellRight = cellLeft + CELL_SIZE;
          const cellTop = (block.row + 1) * CELL_SIZE;
          const cellBottom = cellTop + CELL_SIZE;

          const closestX = Math.max(cellLeft, Math.min(newX, cellRight));
          const closestY = Math.max(cellTop, Math.min(newY, cellBottom));
          const distX = newX - closestX;
          const distY = newY - closestY;
          const distance = Math.sqrt(distX * distX + distY * distY);

          if (distance < BALL_RADIUS) {
            hitThisStep.add(block.id);
            bounceOccurred = true;

            // Epsilon separation — push ball fully outside the cell
            const overlapX = BALL_RADIUS - Math.abs(distX);
            const overlapY = BALL_RADIUS - Math.abs(distY);

            if (overlapX < overlapY) {
              newVx = distX >= 0 ? Math.abs(newVx) : -Math.abs(newVx);
              newX +=
                distX >= 0 ? overlapX + BB_EPSILON : -(overlapX + BB_EPSILON);
            } else {
              newVy = distY >= 0 ? Math.abs(newVy) : -Math.abs(newVy);
              newY +=
                distY >= 0 ? overlapY + BB_EPSILON : -(overlapY + BB_EPSILON);
            }

            // Damage block
            const newHealth = block.health - 1;
            if (newHealth <= 0) {
              setScore((s) => s + (block.type === "bonus" ? 20 : 10));
              setTotalBlocksDestroyed((t) => t + 1);
            }
            blocks.current[bi] = {
              ...block,
              health: newHealth,
              color:
                block.type === "bonus" ? "#9C27B0" : getBlockColor(newHealth),
            };

            // Feed debug harness
            if (__DEV__ && physicsDebug.enabled) {
              physicsDebug.recordCollision(newX, newY);
            }

            break; // One block per sub-step; next step can hit another
          }
        }
      }

      // Remove destroyed blocks after all sub-steps
      blocks.current = blocks.current.filter((b) => b.health > 0);

      // Feed ball speed to debug harness
      if (__DEV__ && physicsDebug.enabled && !ballReturned) {
        physicsDebug.setBallSpeed(Math.sqrt(newVx * newVx + newVy * newVy));
      }

      if (ballReturned) {
        return { ...ball, active: false };
      }
      return { ...ball, x: newX, y: newY, vx: newVx, vy: newVy };
    });

    if (bounceOccurred) {
      setTotalBounces((t) => t + 1);
    }

    // Check if all balls have returned
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
      // Clear safety timeout — turn ended normally
      if (shootingTimeoutRef.current) {
        clearTimeout(shootingTimeoutRef.current);
        shootingTimeoutRef.current = null;
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

    // Broadcast to spectators every ~4 frames (~15fps)
    spectatorFrameCount.current += 1;
    if (spectatorFrameCount.current % 4 === 0) {
      spectatorHost.updateGameState(
        JSON.stringify({
          score: scoreRef.current,
          level: levelRef.current,
          status: statusRef.current,
          ballCount: balls.current.length,
          blocks: blocks.current.map((b) => ({
            id: b.id,
            row: b.row,
            col: b.col,
            health: b.health,
            color: b.color,
            type: b.type,
          })),
          balls: balls.current
            .filter((b) => b.active)
            .map((b) => ({ x: b.x, y: b.y })),
        }),
        scoreRef.current,
        levelRef.current,
        undefined,
      );
    }

    setRenderTrigger((t) => t + 1);
  }, [generateBlocks, endGame]);

  const handleAimMove = useCallback((moveX: number, moveY: number) => {
    if (statusRef.current !== "aiming") return;

    const currentLaunchX = launchXRef.current;
    // Calculate relative to ball position (GAME_HEIGHT - BALL_RADIUS - 10)
    const ballY = GAME_HEIGHT - BALL_RADIUS - 10;
    const dx = moveX - (SCREEN_WIDTH - GAME_WIDTH) / 2 - currentLaunchX;
    const dy = moveY - (SCREEN_HEIGHT - GAME_HEIGHT) / 2 - ballY;

    logger.info(
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
      logger.info("[BounceBlitz] Setting aim angle:", clampedAngle.toFixed(2));
      setAimAngle(clampedAngle);
      aimAngleRef.current = clampedAngle;
    }
  }, []);

  const handleAimRelease = useCallback(() => {
    logger.info("[BounceBlitz] Pan released - aimAngle:", aimAngleRef.current);
    const currentAimAngle = aimAngleRef.current;
    if (currentAimAngle !== null) {
      logger.info("[BounceBlitz] Launching balls at angle:", currentAimAngle);
      launchBallsRef.current(currentAimAngle);
      setAimAngle(null);
      aimAngleRef.current = null;
    }
  }, []);

  // Pan gesture for aiming - uses refs to avoid stale closures
  const aimGesture = useRef(
    Gesture.Pan()
      .runOnJS(true)
      .onBegin(() => {
        logger.info(
          "[BounceBlitz] Pan begin - status:",
          statusRef.current,
          "capture:",
          statusRef.current === "aiming",
        );
      })
      .onUpdate((event) => {
        handleAimMove(event.absoluteX, event.absoluteY);
      })
      .onEnd(() => {
        handleAimRelease();
      }),
  ).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current = [];
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

  // Back navigation with confirmation
  const { handleBack } = useGameBackHandler({
    gameType: "bounce_blitz",
    isGameOver: status === "gameOver",
  });

  return (
    <View style={[styles.container, { backgroundColor: "#1a1a2e" }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.backButton}>
          <Button onPress={handleBack} icon="arrow-left" textColor="white">
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
      <GestureDetector gesture={aimGesture}>
        <View
          style={[styles.gameArea, { width: GAME_WIDTH, height: GAME_HEIGHT }]}
        >
          {/* Skia background gradient */}
          {/* Physics Debug Overlay */}
          {__DEV__ && (
            <PhysicsDebugOverlay
              debug={physicsDebug}
              width={GAME_WIDTH}
              height={GAME_HEIGHT}
            />
          )}
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <RoundedRect
              x={0}
              y={0}
              width={GAME_WIDTH}
              height={GAME_HEIGHT}
              r={16}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, GAME_HEIGHT)}
                colors={["#1A2744", "#16213E", "#0F1A2E"]}
              />
              <Shadow dx={0} dy={2} blur={10} color="rgba(0,0,0,0.5)" inner />
            </RoundedRect>
            {/* Subtle grid lines */}
            {Array.from({ length: 8 }).map((_, i) => {
              const x = (i + 1) * CELL_SIZE;
              return (
                <RoundedRect
                  key={`vg-${i}`}
                  x={x}
                  y={0}
                  width={0.5}
                  height={GAME_HEIGHT}
                  r={0}
                >
                  <LinearGradient
                    start={vec(x, 0)}
                    end={vec(x, GAME_HEIGHT)}
                    colors={[
                      "rgba(255,255,255,0)",
                      "rgba(255,255,255,0.03)",
                      "rgba(255,255,255,0)",
                    ]}
                  />
                </RoundedRect>
              );
            })}
          </Canvas>

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
                <>
                  <Canvas style={{ width: BLOCK_SIZE, height: BLOCK_SIZE }}>
                    <RoundedRect
                      x={0}
                      y={0}
                      width={BLOCK_SIZE}
                      height={BLOCK_SIZE}
                      r={6}
                    >
                      <LinearGradient
                        start={vec(0, 0)}
                        end={vec(0, BLOCK_SIZE)}
                        colors={[
                          lightenColor(block.color, 30),
                          block.color,
                          darkenColor(block.color, 30),
                        ]}
                      />
                      <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.3)" />
                    </RoundedRect>
                    {/* Top highlight */}
                    <RoundedRect
                      x={2}
                      y={1}
                      width={BLOCK_SIZE - 4}
                      height={4}
                      r={2}
                    >
                      <LinearGradient
                        start={vec(0, 1)}
                        end={vec(0, 5)}
                        colors={[
                          "rgba(255,255,255,0.35)",
                          "rgba(255,255,255,0)",
                        ]}
                      />
                    </RoundedRect>
                  </Canvas>
                  <Text style={[styles.blockText, { position: "absolute" }]}>
                    {block.health}
                  </Text>
                </>
              )}
            </View>
          ))}

          {/* Balls — Skia glowing */}
          {balls.current.map((ball) =>
            ball.active ? (
              <View
                key={ball.id}
                style={[
                  styles.ball,
                  {
                    left: ball.x - BALL_RADIUS - 2,
                    top: ball.y - BALL_RADIUS - 2,
                    width: (BALL_RADIUS + 2) * 2,
                    height: (BALL_RADIUS + 2) * 2,
                  },
                ]}
              >
                <Canvas
                  style={{
                    width: (BALL_RADIUS + 2) * 2,
                    height: (BALL_RADIUS + 2) * 2,
                  }}
                >
                  {/* Glow halo */}
                  <SkiaCircle
                    cx={BALL_RADIUS + 2}
                    cy={BALL_RADIUS + 2}
                    r={BALL_RADIUS + 2}
                  >
                    <RadialGradient
                      c={vec(BALL_RADIUS + 2, BALL_RADIUS + 2)}
                      r={BALL_RADIUS + 2}
                      colors={["rgba(255,252,0,0.4)", "rgba(255,252,0,0)"]}
                    />
                  </SkiaCircle>
                  {/* Ball body */}
                  <SkiaCircle
                    cx={BALL_RADIUS + 2}
                    cy={BALL_RADIUS + 2}
                    r={BALL_RADIUS}
                  >
                    <RadialGradient
                      c={vec(BALL_RADIUS, BALL_RADIUS - 1)}
                      r={BALL_RADIUS}
                      colors={["#FFFFFF", "#E8E8E8", "#CCCCCC"]}
                    />
                    <Shadow
                      dx={0}
                      dy={1}
                      blur={3}
                      color="rgba(255,252,0,0.6)"
                    />
                  </SkiaCircle>
                </Canvas>
              </View>
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

          {/* Game Over — handled by GameOverModal outside game area */}
        </View>
      </GestureDetector>

      {/* Instructions */}
      {status === "aiming" && (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            👆 Swipe up to aim, release to shoot
          </Text>
        </View>
      )}

      {/* Game Over Modal */}
      <GameOverModal
        visible={showGameOverModal}
        result={isNewBest ? "win" : "loss"}
        stats={{
          score,
          personalBest: highScore,
          isNewBest,
          moves: totalBlocksDestroyed,
          xpEarned: xpEarned || undefined,
          didLevelUp: didLevelUp || undefined,
          newLevel: newLevel || undefined,
        }}
        onRematch={() => {
          setShowGameOverModal(false);
          startGame();
        }}
        onShare={handleShare}
        onExit={handleBack}
        showRematch={true}
        showShare={true}
        title={`Game Over — Level ${level}`}
      />

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

      {/* Colyseus multiplayer overlay */}
      {isOnlineMode && (
        <ScoreRaceOverlay
          phase={mpRace.phase as ScoreRaceOverlayPhase}
          countdown={mpRace.countdown}
          myScore={mpRace.myScore}
          opponentScore={mpRace.opponentScore}
          opponentName={mpRace.opponentName}
          isWinner={mpRace.isWinner}
          isTie={mpRace.isTie}
          winnerName={mpRace.isWinner ? "You" : mpRace.opponentName}
          onReady={() => mpRace.sendReady()}
          onRematch={() => mpRace.sendRematch()}
          onAcceptRematch={() => mpRace.acceptRematch()}
          onLeave={async () => {
            await mpRace.leave();
            setIsOnlineMode(false);
            setStatus("idle");
          }}
          rematchRequested={mpRace.rematchRequested}
          reconnecting={mpRace.reconnecting}
          opponentDisconnected={mpRace.opponentDisconnected}
        />
      )}

      {/* Spectator overlay — shows count of watchers */}
      {spectatorHost.spectatorCount > 0 && (
        <SpectatorOverlay spectatorCount={spectatorHost.spectatorCount} />
      )}

      {/* Friend Picker */}
      <FriendPickerModal
        key="scorecard-picker"
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={handleSelectFriend}
        title="Share Score With..."
        currentUserId={currentFirebaseUser?.uid || ""}
      />

      {/* Spectator Invite Picker (Friends + Groups) */}
      <SpectatorInviteModal
        visible={showSpectatorInvitePicker}
        onDismiss={() => setShowSpectatorInvitePicker(false)}
        currentUserId={currentFirebaseUser?.uid || ""}
        inviteData={
          spectatorHost.spectatorRoomId
            ? {
                roomId: spectatorHost.spectatorRoomId,
                gameType: "bounce_blitz",
                hostName: profile?.displayName || profile?.username || "Player",
              }
            : null
        }
        onInviteRef={(ref) => spectatorHost.registerInviteMessage(ref)}
        onSent={(name) => showSuccess(`Spectator invite sent to ${name}!`)}
        onError={showError}
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

export default withGameErrorBoundary(BounceBlitzGameScreen, "bounce_blitz");
