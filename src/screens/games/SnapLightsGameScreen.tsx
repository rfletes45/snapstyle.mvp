/**
 * LightsOutGameScreen - Lights Out Puzzle
 *
 * How to play:
 * 1. A 5×5 grid of lights is shown — some are ON, some are OFF
 * 2. Tap a light to toggle it AND its adjacent neighbors (up, down, left, right)
 * 3. Turn ALL lights off to solve the puzzle
 * 4. Score = number of moves (lower is better)
 * 5. Puzzles are guaranteed solvable
 * 6. Levels increase in difficulty (more lights on)
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
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Types & Constants
// =============================================================================

type GamePhase = "menu" | "playing" | "result";

const GRID_SIZE = 5;
const GAME_TYPE = "lights_out";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_PADDING = 24;
const CELL_GAP = 6;
const CELL_SIZE = Math.floor(
  (SCREEN_WIDTH - BOARD_PADDING * 2 - CELL_GAP * (GRID_SIZE - 1)) / GRID_SIZE,
);

const LIGHT_ON_COLOR = "#FFD600";
const LIGHT_ON_BORDER = "#FFC107";
const LIGHT_OFF_COLOR = "#2A2A2E";
const LIGHT_OFF_BORDER = "#3A3A3E";
const LIGHT_ON_GLOW = "rgba(255, 214, 0, 0.35)";

// =============================================================================
// Board Utilities
// =============================================================================

/** Create a GRID_SIZE × GRID_SIZE grid initialized to all off (false). */
function createEmptyGrid(): boolean[][] {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => false),
  );
}

/** Deep-clone a grid. */
function cloneGrid(grid: boolean[][]): boolean[][] {
  return grid.map((row) => [...row]);
}

/** Toggle a cell and its adjacent neighbors in place. Returns a new grid. */
function toggleCell(grid: boolean[][], row: number, col: number): boolean[][] {
  const next = cloneGrid(grid);
  const deltas = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of deltas) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
      next[r][c] = !next[r][c];
    }
  }
  return next;
}

/** Check if all lights are off. */
function isSolved(grid: boolean[][]): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c]) return false;
    }
  }
  return true;
}

/**
 * Generate a solvable puzzle by starting from all-off and applying random
 * toggles. The number of random moves determines difficulty.
 * `numMoves` controls how many distinct cells are toggled (higher = harder).
 */
function generatePuzzle(numMoves: number): boolean[][] {
  let grid = createEmptyGrid();

  // Track which cells we've toggled to avoid cancelling out moves
  const toggled = new Set<string>();
  let attempts = 0;

  while (toggled.size < numMoves && attempts < numMoves * 10) {
    const r = Math.floor(Math.random() * GRID_SIZE);
    const c = Math.floor(Math.random() * GRID_SIZE);
    const key = `${r},${c}`;
    if (!toggled.has(key)) {
      toggled.add(key);
      grid = toggleCell(grid, r, c);
    }
    attempts++;
  }

  // Safety: if grid ended up all off, toggle one cell
  if (isSolved(grid)) {
    const r = Math.floor(Math.random() * GRID_SIZE);
    const c = Math.floor(Math.random() * GRID_SIZE);
    grid = toggleCell(grid, r, c);
  }

  return grid;
}

/**
 * Return number of random toggle moves for a given level.
 * Level 1 → 3 moves, scales up gradually.
 */
function movesForLevel(level: number): number {
  if (level <= 2) return 3;
  if (level <= 4) return 5;
  if (level <= 7) return 7;
  if (level <= 10) return 9;
  if (level <= 14) return 12;
  return Math.min(15, 10 + level);
}

/** Count number of lights currently ON. */
function countLightsOn(grid: boolean[][]): number {
  let count = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c]) count++;
    }
  }
  return count;
}

// =============================================================================
// Animated Light Cell Component
// =============================================================================

interface LightCellProps {
  isOn: boolean;
  onPress: () => void;
  disabled: boolean;
}

function LightCell({ isOn, onPress, disabled }: LightCellProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  }, [scaleAnim]);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityLabel={isOn ? "Light on" : "Light off"}
      accessibilityRole="button"
    >
      <Animated.View
        style={[
          styles.cell,
          {
            backgroundColor: isOn ? LIGHT_ON_COLOR : LIGHT_OFF_COLOR,
            borderColor: isOn ? LIGHT_ON_BORDER : LIGHT_OFF_BORDER,
            shadowColor: isOn ? LIGHT_ON_COLOR : "transparent",
            shadowOpacity: isOn ? 0.6 : 0,
            shadowRadius: isOn ? 10 : 0,
            shadowOffset: { width: 0, height: 0 },
            elevation: isOn ? 8 : 2,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {isOn && <View style={styles.cellGlow} />}
        <MaterialCommunityIcons
          name={isOn ? "lightbulb-on" : "lightbulb-outline"}
          size={CELL_SIZE * 0.4}
          color={isOn ? "#7B6B00" : "#666"}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// =============================================================================
// Component
// =============================================================================

export default function LightsOutGameScreen({
  navigation,
}: {
  navigation: any;
}) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [grid, setGrid] = useState<boolean[][]>(createEmptyGrid);
  const [moves, setMoves] = useState(0);
  const [level, setLevel] = useState(1);
  const [won, setWon] = useState(false);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  // ---------------------------------------------------------------------------
  // Load personal best
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE as any).then(
        setPersonalBest,
      );
    }
  }, [currentFirebaseUser]);

  // ---------------------------------------------------------------------------
  // Game Logic
  // ---------------------------------------------------------------------------

  const startLevel = useCallback((lvl: number) => {
    const puzzle = generatePuzzle(movesForLevel(lvl));
    setGrid(puzzle);
    setMoves(0);
    setLevel(lvl);
    setWon(false);
    setIsNewBest(false);
    setPhase("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const startGame = useCallback(() => {
    startLevel(1);
  }, [startLevel]);

  const handleCellPress = useCallback(
    (row: number, col: number) => {
      if (phase !== "playing") return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const nextGrid = toggleCell(grid, row, col);
      const nextMoves = moves + 1;
      setGrid(nextGrid);
      setMoves(nextMoves);

      if (isSolved(nextGrid)) {
        // Puzzle solved!
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setWon(true);
        setFinalScore(nextMoves);
        setPhase("result");

        // Record score
        if (currentFirebaseUser) {
          const newBest = !personalBest || nextMoves < personalBest.bestScore;
          recordGameSession(currentFirebaseUser.uid, {
            gameId: GAME_TYPE as any,
            score: nextMoves,
            duration: 0,
          })
            .then((session) => {
              if (session && newBest) {
                setIsNewBest(true);
                setPersonalBest({
                  gameId: GAME_TYPE as any,
                  bestScore: nextMoves,
                  achievedAt: Date.now(),
                });
                showSuccess("🎉 New personal best!");
              }
            })
            .catch((error) => {
              console.error("Error recording game session:", error);
            });
        }
      }
    },
    [phase, grid, moves, currentFirebaseUser, showSuccess],
  );

  const resetPuzzle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startLevel(level);
  }, [level, startLevel]);

  const nextLevel = useCallback(() => {
    startLevel(level + 1);
  }, [level, startLevel]);

  const goToMenu = useCallback(() => {
    setPhase("menu");
  }, []);

  // ---------------------------------------------------------------------------
  // Share Handlers
  // ---------------------------------------------------------------------------

  const handleShareScore = useCallback(() => {
    setShowShareDialog(true);
  }, []);

  const handleSendScorecard = useCallback(
    async (friend: {
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
            gameId: GAME_TYPE,
            score: finalScore,
            playerName: profile.displayName || profile.username || "Player",
          },
        );
        if (success) {
          showSuccess(`Score shared with ${friend.displayName}!`);
        } else {
          showError("Failed to share score. Try again.");
        }
      } catch (error) {
        console.error("[GameLights] Error sharing score:", error);
        showError("Failed to share score. Try again.");
      } finally {
        setIsSending(false);
      }
    },
    [currentFirebaseUser, profile, finalScore, showSuccess, showError],
  );

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------
  const lightsOn = countLightsOn(grid);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
        <Text style={[styles.title, { color: colors.text }]}>Snap Lights</Text>
        <View style={styles.headerRight}>
          {phase === "playing" && (
            <>
              <View style={styles.headerStat}>
                <Text style={styles.headerStatEmoji}>💡</Text>
                <Text
                  style={[styles.headerStatValue, { color: colors.primary }]}
                >
                  {lightsOn}
                </Text>
              </View>
              <View style={styles.headerStat}>
                <Text style={styles.headerStatEmoji}>👆</Text>
                <Text style={[styles.headerStatValue, { color: colors.text }]}>
                  {moves}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* ================================================================= */}
      {/* MENU STATE                                                        */}
      {/* ================================================================= */}
      {phase === "menu" && (
        <View style={styles.menuContent}>
          <MaterialCommunityIcons
            name="lightbulb-group"
            size={72}
            color={LIGHT_ON_COLOR}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            💡 Snap Lights
          </Text>
          <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
            Tap a light to toggle it and its neighbors.{"\n"}Turn ALL lights off
            to solve the puzzle!{"\n"}Fewer moves = better score.
          </Text>
          {personalBest && (
            <Text style={[styles.menuBest, { color: colors.primary }]}>
              🏆 Best: {personalBest.bestScore} moves
            </Text>
          )}
          <Button
            mode="contained"
            onPress={startGame}
            icon="play"
            style={styles.playButton}
            contentStyle={styles.playButtonContent}
            labelStyle={styles.playButtonLabel}
          >
            Play
          </Button>

          <View style={styles.rulesContainer}>
            <Text style={[styles.rulesTitle, { color: colors.text }]}>
              How to Play
            </Text>
            <Text style={[styles.rulesText, { color: colors.textSecondary }]}>
              • Tap any light on the 5×5 grid{"\n"}• It toggles itself +
              adjacent lights{"\n"}• Goal: turn ALL lights OFF{"\n"}• Score =
              number of moves (lower is better){"\n"}• Levels get harder as you
              progress
            </Text>
          </View>
        </View>
      )}

      {/* ================================================================= */}
      {/* PLAYING STATE                                                     */}
      {/* ================================================================= */}
      {phase === "playing" && (
        <View style={styles.playArea}>
          {/* Level indicator */}
          <View style={styles.levelBar}>
            <Text style={[styles.levelText, { color: colors.text }]}>
              Level {level}
            </Text>
            <Text style={[styles.levelHint, { color: colors.textSecondary }]}>
              {lightsOn} light{lightsOn !== 1 ? "s" : ""} remaining
            </Text>
          </View>

          {/* Board */}
          <View style={styles.boardContainer}>
            <View style={styles.board}>
              {grid.map((row, rIdx) => (
                <View key={rIdx} style={styles.boardRow}>
                  {row.map((isOn, cIdx) => (
                    <LightCell
                      key={`${rIdx}-${cIdx}`}
                      isOn={isOn}
                      onPress={() => handleCellPress(rIdx, cIdx)}
                      disabled={phase !== "playing"}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            <Button
              mode="outlined"
              onPress={resetPuzzle}
              icon="refresh"
              textColor={colors.text}
              style={styles.controlButton}
            >
              Reset
            </Button>
            <Button
              mode="outlined"
              onPress={goToMenu}
              icon="menu"
              textColor={colors.text}
              style={styles.controlButton}
            >
              Menu
            </Button>
          </View>
        </View>
      )}

      {/* Result Dialog */}
      <Portal>
        <Dialog visible={phase === "result"} dismissable={false}>
          <Dialog.Title>
            {isNewBest ? "🎉 New Best!" : "🏆 Puzzle Solved!"}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.resultLine}>
              Level {level} completed in {finalScore} move
              {finalScore !== 1 ? "s" : ""}!
            </Text>
            {personalBest && (
              <Text
                style={[styles.resultBest, { color: colors.textSecondary }]}
              >
                Personal Best: {personalBest.bestScore} moves
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={goToMenu}>Menu</Button>
            <Button onPress={handleShareScore}>Share</Button>
            <Button mode="contained" onPress={nextLevel}>
              Next Level
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
            <Text>
              Send your score of {finalScore} move
              {finalScore !== 1 ? "s" : ""} (Level {level}) to a friend?
            </Text>
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
        onSelectFriend={handleSendScorecard}
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
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 12,
    zIndex: 10,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerStatEmoji: {
    fontSize: 16,
  },
  headerStatValue: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  // Menu
  menuContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  menuIcon: {
    marginBottom: 12,
  },
  menuTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  menuSubtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 22,
  },
  menuBest: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 24,
  },
  playButton: {
    marginBottom: 32,
    minWidth: 180,
  },
  playButtonContent: {
    paddingVertical: 6,
  },
  playButtonLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  rulesContainer: {
    width: "100%",
    maxWidth: 320,
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  rulesText: {
    fontSize: 14,
    lineHeight: 22,
  },

  // Playing
  playArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  levelBar: {
    alignItems: "center",
    marginBottom: 16,
  },
  levelText: {
    fontSize: 20,
    fontWeight: "800",
  },
  levelHint: {
    fontSize: 14,
    marginTop: 2,
  },

  // Board
  boardContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: BOARD_PADDING,
  },
  board: {
    gap: CELL_GAP,
  },
  boardRow: {
    flexDirection: "row",
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  cellGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LIGHT_ON_GLOW,
    borderRadius: 10,
  },

  // Controls
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  controlButton: {
    minWidth: 110,
  },

  // Results
  resultLine: {
    fontSize: 16,
    marginBottom: 4,
  },
  resultBest: {
    fontSize: 14,
    marginTop: 8,
  },
});



