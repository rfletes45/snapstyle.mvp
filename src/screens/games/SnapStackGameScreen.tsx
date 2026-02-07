/**
 * StackPuzzleGameScreen - Stacking Puzzle Game
 *
 * How to play:
 * 1. Blocks slide back and forth across the screen
 * 2. Tap to drop/place the block
 * 3. The block is trimmed to the overlapping area with the previous block
 * 4. Stack as high as possible without missing!
 * 5. Perfect placement (exact overlap) earns combo bonuses
 *
 * Score: Number of blocks successfully stacked
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import {
  getPersonalBest,
  PersonalBest,
  recordGameSession,
  sendScorecard,
} from "@/services/games";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useColors } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Types & Constants
// =============================================================================

type GameState = "idle" | "playing" | "result";

interface Block {
  x: number;
  width: number;
  y: number;
  color: string;
  perfect: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BLOCK_HEIGHT = 24;
const INITIAL_BLOCK_WIDTH = SCREEN_WIDTH * 0.5;
const BASE_SPEED = 3;
const SPEED_INCREMENT = 0.12;
const PERFECT_THRESHOLD = 5; // pixels tolerance for "perfect" placement

const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F8C471",
  "#82E0AA",
  "#F1948A",
  "#AED6F1",
  "#D7BDE2",
];

// =============================================================================
// Component
// =============================================================================

interface StackPuzzleGameScreenProps {
  navigation: any;
}

export default function StackPuzzleGameScreen({
  navigation,
}: StackPuzzleGameScreenProps) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("idle");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);

  // Animation refs
  const currentBlockX = useRef(new Animated.Value(0)).current;
  const blockDirection = useRef(1);
  const blockSpeed = useRef(BASE_SPEED);
  const currentBlockWidth = useRef(INITIAL_BLOCK_WIDTH);
  const animFrameRef = useRef<number | null>(null);
  const blockXRef = useRef(0);
  const gameActive = useRef(false);

  // Load personal best
  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, "stack_puzzle" as any).then(
        setPersonalBest,
      );
    }
  }, [currentFirebaseUser]);

  // Cleanup
  useEffect(() => {
    return () => {
      gameActive.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ==========================================================================
  // Game Logic
  // ==========================================================================

  const startGame = useCallback(() => {
    setGameState("playing");
    setScore(0);
    setCombo(0);
    blockSpeed.current = BASE_SPEED;
    currentBlockWidth.current = INITIAL_BLOCK_WIDTH;
    gameActive.current = true;

    // Create the base/foundation block
    const baseBlock: Block = {
      x: (SCREEN_WIDTH - INITIAL_BLOCK_WIDTH) / 2,
      width: INITIAL_BLOCK_WIDTH,
      y: SCREEN_HEIGHT - 100,
      color: COLORS[0],
      perfect: false,
    };
    setBlocks([baseBlock]);

    // Start moving the first block
    blockXRef.current = 0;
    currentBlockX.setValue(0);
    blockDirection.current = 1;
    animateBlock();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const animateBlock = useCallback(() => {
    if (!gameActive.current) return;

    const animate = () => {
      if (!gameActive.current) return;

      blockXRef.current += blockDirection.current * blockSpeed.current;

      // Bounce off edges
      if (blockXRef.current + currentBlockWidth.current >= SCREEN_WIDTH) {
        blockDirection.current = -1;
        blockXRef.current = SCREEN_WIDTH - currentBlockWidth.current;
      } else if (blockXRef.current <= 0) {
        blockDirection.current = 1;
        blockXRef.current = 0;
      }

      currentBlockX.setValue(blockXRef.current);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [currentBlockX]);

  // Track whether a placement is in progress to prevent double-taps
  const placingRef = useRef(false);

  const placeBlock = useCallback(async () => {
    if (gameState !== "playing" || !gameActive.current || placingRef.current)
      return;
    placingRef.current = true;

    // Immediately provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Cancel animation immediately
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const placedX = blockXRef.current;
    const placedWidth = currentBlockWidth.current;
    const prevBlock = blocks[blocks.length - 1];

    // Calculate overlap
    const overlapLeft = Math.max(placedX, prevBlock.x);
    const overlapRight = Math.min(
      placedX + placedWidth,
      prevBlock.x + prevBlock.width,
    );
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      // Missed completely - game over
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      placingRef.current = false;
      endGame();
      return;
    }

    // Check for perfect placement
    const isPerfect = Math.abs(placedX - prevBlock.x) < PERFECT_THRESHOLD;

    if (isPerfect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCombo((c) => c + 1);
    } else {
      setCombo(0);
    }

    // Create the new stacked block
    const newBlock: Block = {
      x: isPerfect ? prevBlock.x : overlapLeft,
      width: isPerfect ? prevBlock.width : overlapWidth,
      y: prevBlock.y - BLOCK_HEIGHT,
      color: COLORS[blocks.length % COLORS.length],
      perfect: isPerfect,
    };

    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);

    const newScore = blocks.length; // blocks.length is the new score (1-indexed)
    setScore(newScore);

    // Update current block width for next round
    currentBlockWidth.current = isPerfect ? prevBlock.width : overlapWidth;

    // Increase speed
    blockSpeed.current = BASE_SPEED + newScore * SPEED_INCREMENT;

    // Start next block immediately
    blockXRef.current =
      blockDirection.current > 0 ? 0 : SCREEN_WIDTH - currentBlockWidth.current;
    currentBlockX.setValue(blockXRef.current);
    blockDirection.current = 1;

    // Small delay before starting next block for visual clarity
    requestAnimationFrame(() => {
      placingRef.current = false;
      if (gameActive.current) {
        animateBlock();
      }
    });
  }, [gameState, blocks, animateBlock, currentBlockX]);

  const endGame = useCallback(async () => {
    gameActive.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    setGameState("result");

    // Record score
    if (currentFirebaseUser && score > 0) {
      try {
        await recordGameSession(currentFirebaseUser.uid, {
          gameId: "stack_puzzle" as any,
          score,
        });
        const newBest = !personalBest || score > personalBest.bestScore;
        if (newBest) {
          setIsNewBest(true);
          setPersonalBest({
            gameId: "stack_puzzle" as any,
            bestScore: score,
            achievedAt: Date.now(),
          });
          showSuccess("🎉 New personal best!");
        }
      } catch (error) {
        console.error("Error recording game session:", error);
      }
    }
  }, [currentFirebaseUser, score, showSuccess]);

  // ==========================================================================
  // Share Handlers
  // ==========================================================================

  const handleShareScore = useCallback(() => {
    setShowShareDialog(true);
  }, []);

  const handleSendScorecard = useCallback(
    async (friendUid: string) => {
      if (!currentFirebaseUser || !profile) return;
      setIsSending(true);
      try {
        await sendScorecard(currentFirebaseUser.uid, friendUid, {
          gameId: "stack_puzzle",
          score,
          playerName: profile.displayName || "Player",
        });
        showSuccess("Scorecard sent!");
        setShowFriendPicker(false);
      } catch (error: any) {
        showError(error.message || "Failed to send scorecard");
      } finally {
        setIsSending(false);
      }
    },
    [currentFirebaseUser, profile, score, showSuccess, showError],
  );

  // ==========================================================================
  // Render
  // ==========================================================================

  const renderBlock = (block: Block, index: number) => (
    <View
      key={index}
      style={[
        styles.block,
        {
          left: block.x,
          bottom: SCREEN_HEIGHT - block.y,
          width: block.width,
          height: BLOCK_HEIGHT,
          backgroundColor: block.color,
          borderWidth: block.perfect ? 2 : 0,
          borderColor: "#FFD700",
        },
      ]}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Snap Stack</Text>
        <View style={styles.scoreContainer}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>
            Score
          </Text>
          <Text style={[styles.scoreValue, { color: colors.text }]}>
            {score}
          </Text>
        </View>
      </View>

      {/* Combo indicator */}
      {combo > 1 && gameState === "playing" && (
        <View style={styles.comboContainer}>
          <Text style={styles.comboText}>🔥 {combo}x COMBO!</Text>
        </View>
      )}

      {/* Game Area - Use Pressable for instant response */}
      <Pressable
        style={styles.gameArea}
        onPressIn={gameState === "playing" ? placeBlock : undefined}
        disabled={gameState !== "playing"}
      >
        {/* Stacked blocks */}
        {blocks.map(renderBlock)}

        {/* Moving block (current) */}
        {gameState === "playing" && (
          <Animated.View
            style={[
              styles.block,
              styles.currentBlock,
              {
                left: currentBlockX as any,
                bottom:
                  SCREEN_HEIGHT -
                  (blocks[blocks.length - 1]?.y - BLOCK_HEIGHT ||
                    SCREEN_HEIGHT - 100),
                width: currentBlockWidth.current,
                height: BLOCK_HEIGHT,
                backgroundColor: COLORS[blocks.length % COLORS.length],
              },
            ]}
          />
        )}

        {/* Idle State */}
        {gameState === "idle" && (
          <View style={styles.centerContent}>
            <Text style={[styles.gameTitle, { color: colors.text }]}>
              🏗️ Snap Stack
            </Text>
            <Text
              style={[styles.instructions, { color: colors.textSecondary }]}
            >
              Tap to place blocks{"\n"}Stack as high as you can!
            </Text>
            {personalBest && (
              <Text style={[styles.bestScore, { color: colors.primary }]}>
                Best: {personalBest.bestScore}
              </Text>
            )}
            <Button
              mode="contained"
              onPress={startGame}
              style={styles.playButton}
            >
              Play
            </Button>
          </View>
        )}
      </Pressable>

      {/* Result Dialog */}
      <Portal>
        <Dialog visible={gameState === "result"} dismissable={false}>
          <Dialog.Title>
            {isNewBest ? "🎉 New Best!" : "Game Over!"}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.resultScore}>Score: {score} blocks</Text>
            {personalBest && (
              <Text style={styles.resultBest}>
                Personal Best: {personalBest.bestScore}
              </Text>
            )}
            {combo > 1 && (
              <Text style={styles.resultCombo}>Max Combo: {combo}x</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => navigation.goBack()}>Quit</Button>
            <Button onPress={handleShareScore}>Share</Button>
            <Button mode="contained" onPress={startGame}>
              Play Again
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Share Dialog */}
      <Portal>
        <Dialog
          visible={showShareDialog}
          onDismiss={() => setShowShareDialog(false)}
        >
          <Dialog.Title>Share Score</Dialog.Title>
          <Dialog.Content>
            <Text>Send your score of {score} to a friend?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowShareDialog(false)}>Cancel</Button>
            <Button
              onPress={() => {
                setShowShareDialog(false);
                setShowFriendPicker(true);
              }}
            >
              Choose Friend
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Friend Picker */}
      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={(friend) => handleSendScorecard(friend.friendUid)}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Send Scorecard"
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 12,
    zIndex: 10,
  },
  backButton: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700" },
  scoreContainer: { alignItems: "center" },
  scoreLabel: { fontSize: 10, textTransform: "uppercase" },
  scoreValue: { fontSize: 24, fontWeight: "800" },
  comboContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 110 : 90,
    alignSelf: "center",
    backgroundColor: "rgba(255,165,0,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 20,
  },
  comboText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  gameArea: { flex: 1 },
  block: {
    position: "absolute",
    borderRadius: 2,
  },
  currentBlock: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  gameTitle: { fontSize: 32, fontWeight: "800", marginBottom: 16 },
  instructions: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 24,
  },
  bestScore: { fontSize: 18, fontWeight: "700", marginBottom: 24 },
  playButton: { paddingHorizontal: 32 },
  resultScore: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  resultBest: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
    marginBottom: 4,
  },
  resultCombo: { fontSize: 14, textAlign: "center", opacity: 0.7 },
});


