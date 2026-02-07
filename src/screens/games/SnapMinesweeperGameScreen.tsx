/**
 * MinesweeperGameScreen - Classic Minesweeper
 *
 * How to play:
 * 1. Select a difficulty: Easy (9×9, 10 mines), Medium (16×16, 40 mines), Hard (16×30, 99 mines)
 * 2. Tap a cell to reveal it
 * 3. Long press a cell to toggle a flag (🚩)
 * 4. Numbers indicate how many adjacent cells contain mines
 * 5. Reveal all non-mine cells to win
 * 6. Timer-based scoring — lower time is better
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
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// =============================================================================
// Types & Constants
// =============================================================================

type GamePhase = "menu" | "playing" | "result";

interface Difficulty {
  label: string;
  rows: number;
  cols: number;
  mines: number;
  icon: string;
}

interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
}

const GAME_TYPE = "minesweeper_classic";

const DIFFICULTIES: Record<string, Difficulty> = {
  easy: {
    label: "Easy",
    rows: 9,
    cols: 9,
    mines: 10,
    icon: "emoticon-happy-outline",
  },
  medium: {
    label: "Medium",
    rows: 16,
    cols: 16,
    mines: 40,
    icon: "emoticon-neutral-outline",
  },
  hard: {
    label: "Hard",
    rows: 16,
    cols: 30,
    mines: 99,
    icon: "emoticon-dead-outline",
  },
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_PADDING = 8;

// Number colors matching classic Minesweeper
const NUMBER_COLORS: Record<number, string> = {
  1: "#1976D2",
  2: "#388E3C",
  3: "#D32F2F",
  4: "#7B1FA2",
  5: "#FF8F00",
  6: "#00838F",
  7: "#424242",
  8: "#9E9E9E",
};

// =============================================================================
// Board Utilities
// =============================================================================

function createEmptyBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0,
    })),
  );
}

function placeMines(
  board: Cell[][],
  rows: number,
  cols: number,
  mineCount: number,
  safeRow: number,
  safeCol: number,
): Cell[][] {
  const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
  let placed = 0;

  // Generate safe zone around first tap (3×3)
  const safeSet = new Set<string>();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      safeSet.add(`${safeRow + dr},${safeCol + dc}`);
    }
  }

  while (placed < mineCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!newBoard[r][c].isMine && !safeSet.has(`${r},${c}`)) {
      newBoard[r][c].isMine = true;
      placed++;
    }
  }

  // Calculate adjacent mine counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (newBoard[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 &&
            nr < rows &&
            nc >= 0 &&
            nc < cols &&
            newBoard[nr][nc].isMine
          ) {
            count++;
          }
        }
      }
      newBoard[r][c].adjacentMines = count;
    }
  }

  return newBoard;
}

function revealCell(
  board: Cell[][],
  rows: number,
  cols: number,
  row: number,
  col: number,
): Cell[][] {
  const newBoard = board.map((r) => r.map((c) => ({ ...c })));

  // Flood-fill reveal for empty cells
  const stack: Array<[number, number]> = [[row, col]];

  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
    if (newBoard[r][c].isRevealed || newBoard[r][c].isFlagged) continue;

    newBoard[r][c].isRevealed = true;

    // If the cell has no adjacent mines, reveal neighbors
    if (newBoard[r][c].adjacentMines === 0 && !newBoard[r][c].isMine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          stack.push([r + dr, c + dc]);
        }
      }
    }
  }

  return newBoard;
}

function revealAllMines(board: Cell[][]): Cell[][] {
  return board.map((row) =>
    row.map((cell) =>
      cell.isMine ? { ...cell, isRevealed: true } : { ...cell },
    ),
  );
}

function countFlags(board: Cell[][]): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.isFlagged) count++;
    }
  }
  return count;
}

function countUnrevealedSafe(board: Cell[][]): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (!cell.isMine && !cell.isRevealed) count++;
    }
  }
  return count;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// =============================================================================
// Component
// =============================================================================

interface MinesweeperGameScreenProps {
  navigation: any;
}

export default function MinesweeperGameScreen({
  navigation,
}: MinesweeperGameScreenProps) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // Game state
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>(DIFFICULTIES.easy);
  const [board, setBoard] = useState<Cell[][]>([]);
  const [minesPlaced, setMinesPlaced] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);

  // Personal best & sharing
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Timer ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  // ==========================================================================
  // Personal Best
  // ==========================================================================

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE as any).then(
        setPersonalBest,
      );
    }
  }, [currentFirebaseUser]);

  // ==========================================================================
  // Timer
  // ==========================================================================

  useEffect(() => {
    if (phase === "playing" && minesPlaced && !won && !lost) {
      startTimeRef.current = Date.now() - elapsedSeconds * 1000;
      timerRef.current = setInterval(() => {
        setElapsedSeconds(
          Math.floor((Date.now() - startTimeRef.current) / 1000),
        );
      }, 250);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, minesPlaced, won, lost]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ==========================================================================
  // Cell sizing
  // ==========================================================================

  const cellSize = useMemo(() => {
    const maxBoardWidth = SCREEN_WIDTH - BOARD_PADDING * 2;
    const maxBoardHeight = Dimensions.get("window").height * 0.55;
    const sizeByWidth = Math.floor(maxBoardWidth / difficulty.cols);
    const sizeByHeight = Math.floor(maxBoardHeight / difficulty.rows);
    return Math.min(sizeByWidth, sizeByHeight, 36);
  }, [difficulty]);

  // ==========================================================================
  // Game Logic
  // ==========================================================================

  const startGame = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    setBoard(createEmptyBoard(diff.rows, diff.cols));
    setMinesPlaced(false);
    setElapsedSeconds(0);
    setWon(false);
    setLost(false);
    setIsNewBest(false);
    setPhase("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleWin = useCallback(async () => {
    setWon(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Record score (time in seconds — lower is better)
    if (currentFirebaseUser?.uid) {
      try {
        await recordGameSession(currentFirebaseUser.uid, {
          gameId: GAME_TYPE as any,
          score: elapsedSeconds,
          duration: elapsedSeconds,
        });
        // Check if new best (lower is better)
        if (!personalBest || elapsedSeconds < personalBest.bestScore) {
          setIsNewBest(true);
          setPersonalBest({
            gameId: GAME_TYPE as any,
            bestScore: elapsedSeconds,
            achievedAt: Date.now(),
          });
          showSuccess("🎉 New personal best!");
        }
      } catch (error) {
        console.error("[minesweeper_classic] Error recording session:", error);
      }
    }

    setPhase("result");
  }, [currentFirebaseUser, elapsedSeconds, personalBest, showSuccess]);

  const handleLoss = useCallback(() => {
    setLost(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setPhase("result");
  }, []);

  const handleCellPress = useCallback(
    (row: number, col: number) => {
      if (won || lost) return;

      let currentBoard = board;

      // First tap: place mines avoiding this cell
      if (!minesPlaced) {
        currentBoard = placeMines(
          currentBoard,
          difficulty.rows,
          difficulty.cols,
          difficulty.mines,
          row,
          col,
        );
        setMinesPlaced(true);
        startTimeRef.current = Date.now();
      }

      const cell = currentBoard[row][col];
      if (cell.isRevealed || cell.isFlagged) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Hit a mine
      if (cell.isMine) {
        const revealed = revealAllMines(currentBoard);
        setBoard(revealed);
        handleLoss();
        return;
      }

      // Reveal the cell
      const newBoard = revealCell(
        currentBoard,
        difficulty.rows,
        difficulty.cols,
        row,
        col,
      );
      setBoard(newBoard);

      // Check win
      if (countUnrevealedSafe(newBoard) === 0) {
        handleWin();
      }
    },
    [board, minesPlaced, difficulty, won, lost, handleLoss, handleWin],
  );

  const handleCellLongPress = useCallback(
    (row: number, col: number) => {
      if (won || lost) return;
      const cell = board[row][col];
      if (cell.isRevealed) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const newBoard = board.map((r) => r.map((c) => ({ ...c })));
      newBoard[row][col].isFlagged = !newBoard[row][col].isFlagged;
      setBoard(newBoard);
    },
    [board, won, lost],
  );

  const restartGame = useCallback(() => {
    startGame(difficulty);
  }, [difficulty, startGame]);

  const goToMenu = useCallback(() => {
    setPhase("menu");
    setBoard([]);
    setMinesPlaced(false);
    setElapsedSeconds(0);
    setWon(false);
    setLost(false);
    setIsNewBest(false);
  }, []);

  // ==========================================================================
  // Share Handlers
  // ==========================================================================

  const handleShareScore = useCallback(() => {
    setShowShareDialog(true);
  }, []);

  const handleSendScorecard = useCallback(
    async (friend: {
      friendUid: string;
      username: string;
      displayName: string;
    }) => {
      if (!currentFirebaseUser?.uid || !profile) return;
      setIsSending(true);
      try {
        const success = await sendScorecard(
          currentFirebaseUser.uid,
          friend.friendUid,
          {
            gameId: GAME_TYPE,
            score: elapsedSeconds,
            playerName: profile.displayName || profile.username || "Player",
          },
        );
        if (success) {
          showSuccess(`Score shared with ${friend.displayName}!`);
          setShowFriendPicker(false);
        } else {
          showError("Failed to share score. Try again.");
        }
      } catch {
        showError("Failed to share score. Try again.");
      } finally {
        setIsSending(false);
      }
    },
    [currentFirebaseUser, profile, elapsedSeconds, showSuccess, showError],
  );

  // ==========================================================================
  // Computed
  // ==========================================================================

  const flagCount = useMemo(() => countFlags(board), [board]);
  const remainingMines = difficulty.mines - flagCount;

  // ==========================================================================
  // Pinch-to-zoom for medium/hard boards
  // ==========================================================================

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const boardPixelWidth = difficulty.cols * cellSize;
  const boardPixelHeight = difficulty.rows * cellSize;

  // Reset zoom when difficulty changes
  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [difficulty]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = Math.min(Math.max(savedScale.value * e.scale, 1), 3);
      scale.value = newScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Clamp translation after pinch
      const maxTx = Math.max(
        0,
        (boardPixelWidth * scale.value - SCREEN_WIDTH + BOARD_PADDING * 2) / 2,
      );
      const maxTy = Math.max(
        0,
        (boardPixelHeight * scale.value -
          Dimensions.get("window").height * 0.55) /
          2,
      );
      translateX.value = withTiming(
        Math.min(Math.max(translateX.value, -maxTx), maxTx),
        { duration: 150 },
      );
      translateY.value = withTiming(
        Math.min(Math.max(translateY.value, -maxTy), maxTy),
        { duration: 150 },
      );
      savedTranslateX.value = Math.min(
        Math.max(translateX.value, -maxTx),
        maxTx,
      );
      savedTranslateY.value = Math.min(
        Math.max(translateY.value, -maxTy),
        maxTy,
      );
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const maxTx = Math.max(
        0,
        (boardPixelWidth * scale.value - SCREEN_WIDTH + BOARD_PADDING * 2) / 2,
      );
      const maxTy = Math.max(
        0,
        (boardPixelHeight * scale.value -
          Dimensions.get("window").height * 0.55) /
          2,
      );
      translateX.value = Math.min(
        Math.max(savedTranslateX.value + e.translationX, -maxTx),
        maxTx,
      );
      translateY.value = Math.min(
        Math.max(savedTranslateY.value + e.translationY, -maxTy),
        maxTy,
      );
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .minPointers(2);

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1, { duration: 250 });
        savedScale.value = 1;
        translateX.value = withTiming(0, { duration: 250 });
        translateY.value = withTiming(0, { duration: 250 });
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2, { duration: 250 });
        savedScale.value = 2;
      }
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);
  const allGestures = Gesture.Exclusive(doubleTapGesture, composedGesture);

  const animatedBoardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const needsZoom = difficulty.cols > 9;

  // ==========================================================================
  // Render Helpers
  // ==========================================================================

  const renderCell = useCallback(
    (cell: Cell, row: number, col: number) => {
      let content: React.ReactNode = null;
      let bgColor = colors.primary + "22";
      let borderStyle: "raised" | "flat" = "raised";

      if (cell.isRevealed) {
        borderStyle = "flat";
        if (cell.isMine) {
          content = <Text style={styles.cellEmoji}>💣</Text>;
          bgColor = "#FF4444";
        } else if (cell.adjacentMines > 0) {
          content = (
            <Text
              style={[
                styles.cellNumber,
                {
                  color: NUMBER_COLORS[cell.adjacentMines] || colors.text,
                  fontSize: cellSize * 0.5,
                },
              ]}
            >
              {cell.adjacentMines}
            </Text>
          );
          bgColor = colors.background;
        } else {
          bgColor = colors.background;
        }
      } else if (cell.isFlagged) {
        content = <Text style={styles.cellEmoji}>🚩</Text>;
      }

      const raisedStyle =
        borderStyle === "raised"
          ? {
              borderTopColor: "rgba(255,255,255,0.4)",
              borderLeftColor: "rgba(255,255,255,0.4)",
              borderBottomColor: "rgba(0,0,0,0.25)",
              borderRightColor: "rgba(0,0,0,0.25)",
              borderWidth: 2,
            }
          : {
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
            };

      return (
        <Pressable
          key={`${row}-${col}`}
          onPress={() => handleCellPress(row, col)}
          onLongPress={() => handleCellLongPress(row, col)}
          delayLongPress={300}
          style={[
            styles.cell,
            {
              width: cellSize,
              height: cellSize,
              backgroundColor: bgColor,
            },
            raisedStyle,
          ]}
          accessibilityLabel={`Cell ${row + 1}, ${col + 1}${cell.isFlagged ? ", flagged" : ""}${cell.isRevealed && cell.isMine ? ", mine" : ""}`}
        >
          {content}
        </Pressable>
      );
    },
    [colors, cellSize, handleCellPress, handleCellLongPress],
  );

  // ==========================================================================
  // Menu Screen
  // ==========================================================================

  if (phase === "menu") {
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
          <Text style={[styles.title, { color: colors.text }]}>
            Snap Minesweeper
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.menuContent}>
          <Text style={[styles.menuEmoji]}>💣</Text>
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            Minesweeper
          </Text>
          <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
            Clear the minefield without detonating any mines!
          </Text>

          {personalBest && (
            <Text style={[styles.menuBest, { color: colors.primary }]}>
              Best Time: {formatTime(personalBest.bestScore)}
            </Text>
          )}

          <View style={styles.difficultyContainer}>
            {Object.entries(DIFFICULTIES).map(([key, diff]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.difficultyCard,
                  {
                    backgroundColor: colors.primary + "15",
                    borderColor: colors.primary + "30",
                  },
                ]}
                onPress={() => startGame(diff)}
                activeOpacity={0.7}
                accessibilityLabel={`Start ${diff.label} game`}
              >
                <MaterialCommunityIcons
                  name={diff.icon as any}
                  size={32}
                  color={colors.primary}
                />
                <Text style={[styles.diffLabel, { color: colors.text }]}>
                  {diff.label}
                </Text>
                <Text
                  style={[styles.diffInfo, { color: colors.textSecondary }]}
                >
                  {diff.rows}×{diff.cols}
                </Text>
                <Text
                  style={[styles.diffInfo, { color: colors.textSecondary }]}
                >
                  {diff.mines} mines
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.rulesContainer}>
            <Text style={[styles.rulesTitle, { color: colors.text }]}>
              How to Play
            </Text>
            <Text style={[styles.rulesText, { color: colors.textSecondary }]}>
              • Tap to reveal a cell{"\n"}• Long press to place/remove a flag
              {"\n"}• Numbers show adjacent mines{"\n"}• Reveal all safe cells
              to win{"\n"}• Fastest time wins!
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ==========================================================================
  // Playing & Result Screen
  // ==========================================================================

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            phase === "result" ? goToMenu() : navigation.goBack()
          }
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Minesweeper</Text>
        <View style={styles.headerRight}>
          {/* Mine counter */}
          <View style={styles.headerStat}>
            <Text style={styles.headerStatEmoji}>💣</Text>
            <Text style={[styles.headerStatValue, { color: colors.text }]}>
              {remainingMines}
            </Text>
          </View>
          {/* Timer */}
          <View style={styles.headerStat}>
            <MaterialCommunityIcons
              name="timer-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={[styles.headerStatValue, { color: colors.text }]}>
              {formatTime(elapsedSeconds)}
            </Text>
          </View>
        </View>
      </View>

      {/* Board with pinch-to-zoom for medium/hard */}
      {needsZoom ? (
        <GestureDetector gesture={allGestures}>
          <Animated.View
            style={[styles.boardZoomContainer, { overflow: "hidden" }]}
          >
            <Animated.View style={animatedBoardStyle}>
              <View
                style={[
                  styles.board,
                  {
                    width: boardPixelWidth,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                {board.map((rowData, rowIndex) => (
                  <View key={rowIndex} style={styles.boardRow}>
                    {rowData.map((cell, colIndex) =>
                      renderCell(cell, rowIndex, colIndex),
                    )}
                  </View>
                ))}
              </View>
            </Animated.View>
            {/* Zoom hint */}
            {scale.value <= 1 && phase === "playing" && (
              <View style={styles.zoomHint}>
                <Text
                  style={[styles.zoomHintText, { color: colors.textSecondary }]}
                >
                  Pinch to zoom • Double-tap to toggle
                </Text>
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      ) : (
        <View
          style={[
            styles.boardZoomContainer,
            { alignItems: "center", justifyContent: "center" },
          ]}
        >
          <View
            style={[
              styles.board,
              {
                width: boardPixelWidth,
                backgroundColor: colors.background,
              },
            ]}
          >
            {board.map((rowData, rowIndex) => (
              <View key={rowIndex} style={styles.boardRow}>
                {rowData.map((cell, colIndex) =>
                  renderCell(cell, rowIndex, colIndex),
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Playing Controls */}
      {phase === "playing" && (
        <View style={styles.controlsContainer}>
          <Button
            mode="outlined"
            onPress={restartGame}
            icon="refresh"
            textColor={colors.text}
            style={styles.controlButton}
          >
            Restart
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
      )}

      {/* Result Dialog */}
      <Portal>
        <Dialog visible={phase === "result"} dismissable={false}>
          <Dialog.Title>
            {won
              ? isNewBest
                ? "🎉 New Best Time!"
                : "🏆 You Win!"
              : "💥 Game Over!"}
          </Dialog.Title>
          <Dialog.Content>
            {won ? (
              <>
                <Text style={styles.resultLine}>
                  Time: {formatTime(elapsedSeconds)}
                </Text>
                <Text style={styles.resultLine}>
                  Difficulty: {difficulty.label} ({difficulty.rows}×
                  {difficulty.cols})
                </Text>
                {personalBest && (
                  <Text
                    style={[styles.resultBest, { color: colors.textSecondary }]}
                  >
                    Personal Best: {formatTime(personalBest.bestScore)}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.resultLine}>You hit a mine!</Text>
                <Text
                  style={[styles.resultLine, { color: colors.textSecondary }]}
                >
                  Time: {formatTime(elapsedSeconds)} — {difficulty.label}
                </Text>
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={goToMenu}>Menu</Button>
            {won && <Button onPress={handleShareScore}>Share</Button>}
            <Button mode="contained" onPress={restartGame}>
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
            <Text>
              Send your time of {formatTime(elapsedSeconds)} ({difficulty.label}
              ) to a friend?
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
  menuEmoji: {
    fontSize: 64,
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
  difficultyContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  difficultyCard: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 95,
  },
  diffLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  diffInfo: {
    fontSize: 11,
    marginTop: 2,
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

  // Board
  boardZoomContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  board: {
    alignSelf: "center",
  },
  boardRow: {
    flexDirection: "row",
  },
  zoomHint: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  zoomHintText: {
    fontSize: 12,
    fontWeight: "500",
  },
  cell: {
    justifyContent: "center",
    alignItems: "center",
  },
  cellNumber: {
    fontWeight: "800",
    textAlign: "center",
  },
  cellEmoji: {
    fontSize: 14,
    textAlign: "center",
  },

  // Controls
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
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


