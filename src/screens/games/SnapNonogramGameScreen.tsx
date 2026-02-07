/**
 * SnapNonogramGameScreen — Picross / Nonogram
 *
 * How to play:
 * 1. Use row and column clues (numbers) to determine which cells to fill
 * 2. Tap a cell to fill it, long-press to mark it empty (X)
 * 3. Complete the hidden picture!
 *
 * Supports: Single-player puzzle with timer scoring
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GAME_TYPE = "snap_nonogram";
type GameState = "menu" | "playing" | "result";
type CellState = "empty" | "filled" | "marked"; // empty = unknown, filled = colored, marked = X

interface Puzzle {
  size: number;
  solution: boolean[][];
  name: string;
}

// 5x5 puzzle bank
const PUZZLES: Puzzle[] = [
  {
    name: "Heart",
    size: 5,
    solution: [
      [false, true, false, true, false],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [false, true, true, true, false],
      [false, false, true, false, false],
    ],
  },
  {
    name: "Star",
    size: 5,
    solution: [
      [false, false, true, false, false],
      [false, true, true, true, false],
      [true, true, true, true, true],
      [false, true, false, true, false],
      [true, false, false, false, true],
    ],
  },
  {
    name: "Arrow",
    size: 5,
    solution: [
      [false, false, true, false, false],
      [false, true, true, false, false],
      [true, true, true, true, true],
      [false, true, true, false, false],
      [false, false, true, false, false],
    ],
  },
  {
    name: "Cross",
    size: 5,
    solution: [
      [false, true, true, true, false],
      [true, false, true, false, true],
      [true, true, true, true, true],
      [true, false, true, false, true],
      [false, true, true, true, false],
    ],
  },
  {
    name: "Smiley",
    size: 5,
    solution: [
      [false, true, false, true, false],
      [false, true, false, true, false],
      [false, false, false, false, false],
      [true, false, false, false, true],
      [false, true, true, true, false],
    ],
  },
  {
    name: "House",
    size: 5,
    solution: [
      [false, false, true, false, false],
      [false, true, true, true, false],
      [true, true, true, true, true],
      [true, false, true, false, true],
      [true, false, true, false, true],
    ],
  },
  {
    name: "Diamond",
    size: 5,
    solution: [
      [false, false, true, false, false],
      [false, true, false, true, false],
      [true, false, false, false, true],
      [false, true, false, true, false],
      [false, false, true, false, false],
    ],
  },
  {
    name: "Boat",
    size: 5,
    solution: [
      [false, false, true, false, false],
      [false, false, true, true, false],
      [false, false, true, false, false],
      [true, true, true, true, true],
      [false, true, true, true, false],
    ],
  },
];

// Compute clues from solution
function computeClues(solution: boolean[][]): {
  rows: number[][];
  cols: number[][];
} {
  const size = solution.length;
  const rows: number[][] = [];
  const cols: number[][] = [];

  for (let r = 0; r < size; r++) {
    const clue: number[] = [];
    let run = 0;
    for (let c = 0; c < size; c++) {
      if (solution[r][c]) {
        run++;
      } else if (run > 0) {
        clue.push(run);
        run = 0;
      }
    }
    if (run > 0) clue.push(run);
    rows.push(clue.length > 0 ? clue : [0]);
  }

  for (let c = 0; c < size; c++) {
    const clue: number[] = [];
    let run = 0;
    for (let r = 0; r < size; r++) {
      if (solution[r][c]) {
        run++;
      } else if (run > 0) {
        clue.push(run);
        run = 0;
      }
    }
    if (run > 0) clue.push(run);
    cols.push(clue.length > 0 ? clue : [0]);
  }

  return { rows, cols };
}

// =============================================================================
// Component
// =============================================================================

export default function SnapNonogramGameScreen({
  navigation,
}: {
  navigation: any;
}) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("menu");
  const [grid, setGrid] = useState<CellState[][]>([]);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [clues, setClues] = useState<{ rows: number[][]; cols: number[][] }>({
    rows: [],
    cols: [],
  });
  const [elapsed, setElapsed] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [won, setWon] = useState(false);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [fillMode, setFillMode] = useState<"fill" | "mark">("fill");

  const timerRef = useRef<ReturnType<typeof setInterval>>(null!);
  const maxMistakes = 3;

  const CELL_SIZE = puzzle
    ? Math.floor((SCREEN_WIDTH - 100) / puzzle.size)
    : 40;

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  useEffect(() => {
    if (gameState === "playing" && !won) {
      timerRef.current = setInterval(() => {
        setElapsed((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, won]);

  const startGame = useCallback(() => {
    const p = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
    setPuzzle(p);
    setClues(computeClues(p.solution));
    setGrid(
      Array.from({ length: p.size }, () =>
        Array.from({ length: p.size }, () => "empty" as CellState),
      ),
    );
    setElapsed(0);
    setMistakes(0);
    setWon(false);
    setFillMode("fill");
    setGameState("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const tapCell = useCallback(
    (r: number, c: number) => {
      if (gameState !== "playing" || won || !puzzle) return;
      if (grid[r][c] !== "empty") return;

      const newGrid = grid.map((row) => [...row]);

      if (fillMode === "fill") {
        if (puzzle.solution[r][c]) {
          newGrid[r][c] = "filled";
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          newGrid[r][c] = "marked";
          const newMistakes = mistakes + 1;
          setMistakes(newMistakes);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          if (newMistakes >= maxMistakes) {
            setGrid(newGrid);
            setWon(false);
            clearInterval(timerRef.current!);
            setTimeout(() => setGameState("result"), 500);
            return;
          }
        }
      } else {
        newGrid[r][c] = "marked";
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      setGrid(newGrid);

      // Check win: all solution=true cells are filled
      let complete = true;
      for (let rr = 0; rr < puzzle.size; rr++) {
        for (let cc = 0; cc < puzzle.size; cc++) {
          if (puzzle.solution[rr][cc] && newGrid[rr][cc] !== "filled") {
            complete = false;
            break;
          }
        }
        if (!complete) break;
      }

      if (complete) {
        setWon(true);
        clearInterval(timerRef.current!);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (currentFirebaseUser) {
          recordGameSession(currentFirebaseUser.uid, {
            gameId: GAME_TYPE,
            score: elapsed,
            duration: elapsed * 1000,
          });
        }
        setTimeout(() => setGameState("result"), 800);
      }
    },
    [
      grid,
      gameState,
      won,
      puzzle,
      fillMode,
      mistakes,
      elapsed,
      currentFirebaseUser,
    ],
  );

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          🧩 Snap Nonogram
        </Text>
        {gameState === "playing" && (
          <Text style={[styles.timer, { color: colors.primary }]}>
            {formatTime(elapsed)}
          </Text>
        )}
        {gameState !== "playing" && <View style={{ width: 50 }} />}
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            Snap Nonogram
          </Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Fill cells to reveal the hidden picture!
          </Text>
          {personalBest && (
            <Text style={[styles.bestText, { color: colors.primary }]}>
              Best: {formatTime(personalBest.bestScore)}
            </Text>
          )}
          <Button
            mode="contained"
            onPress={startGame}
            style={{ backgroundColor: colors.primary, marginTop: 24 }}
            labelStyle={{ color: "#fff" }}
          >
            Start Puzzle
          </Button>
        </View>
      )}

      {gameState === "playing" && puzzle && (
        <View style={styles.playArea}>
          {/* Mistakes */}
          <View style={styles.mistakeRow}>
            <Text style={{ color: colors.textSecondary, marginRight: 8 }}>
              Lives:
            </Text>
            {Array.from({ length: maxMistakes }).map((_, i) => (
              <MaterialCommunityIcons
                key={i}
                name={i < maxMistakes - mistakes ? "heart" : "heart-broken"}
                size={20}
                color={i < maxMistakes - mistakes ? "#e74c3c" : colors.border}
                style={{ marginRight: 2 }}
              />
            ))}
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              onPress={() => setFillMode("fill")}
              style={[
                styles.modeBtn,
                {
                  backgroundColor:
                    fillMode === "fill" ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="square"
                size={18}
                color={fillMode === "fill" ? "#fff" : colors.text}
              />
              <Text
                style={{
                  color: fillMode === "fill" ? "#fff" : colors.text,
                  marginLeft: 4,
                  fontWeight: "600",
                }}
              >
                Fill
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFillMode("mark")}
              style={[
                styles.modeBtn,
                {
                  backgroundColor:
                    fillMode === "mark" ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="close"
                size={18}
                color={fillMode === "mark" ? "#fff" : colors.text}
              />
              <Text
                style={{
                  color: fillMode === "mark" ? "#fff" : colors.text,
                  marginLeft: 4,
                  fontWeight: "600",
                }}
              >
                Mark
              </Text>
            </TouchableOpacity>
          </View>

          {/* Grid with clues */}
          <View style={styles.gridWrapper}>
            {/* Column clues */}
            <View style={styles.colCluesRow}>
              <View style={{ width: 50 }} />
              {clues.cols.map((clue, c) => (
                <View key={c} style={[styles.colClue, { width: CELL_SIZE }]}>
                  {clue.map((n, i) => (
                    <Text
                      key={i}
                      style={{
                        color: colors.text,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {n}
                    </Text>
                  ))}
                </View>
              ))}
            </View>

            {/* Rows */}
            {grid.map((row, r) => (
              <View key={r} style={styles.gridRow}>
                {/* Row clue */}
                <View style={styles.rowClue}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {clues.rows[r]?.join(" ")}
                  </Text>
                </View>
                {/* Cells */}
                {row.map((cell, c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => tapCell(r, c)}
                    style={[
                      styles.cell,
                      {
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        backgroundColor:
                          cell === "filled"
                            ? colors.primary
                            : cell === "marked"
                              ? colors.surface
                              : colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    activeOpacity={0.6}
                  >
                    {cell === "marked" && (
                      <MaterialCommunityIcons
                        name="close"
                        size={CELL_SIZE * 0.5}
                        color={colors.textSecondary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Result */}
      <Portal>
        <Dialog
          visible={gameState === "result"}
          onDismiss={() => {}}
          style={{ backgroundColor: colors.surface }}
        >
          <Dialog.Title style={{ color: colors.text, textAlign: "center" }}>
            {won ? `🎨 ${puzzle?.name || "Puzzle"} Complete!` : "💔 Game Over"}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
              {won
                ? `Solved in ${formatTime(elapsed)} with ${mistakes} mistake${mistakes !== 1 ? "s" : ""}`
                : "Too many mistakes! Try again."}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={startGame}>Play Again</Button>
            {won && (
              <Button onPress={() => setShowFriendPicker(true)}>Share</Button>
            )}
            <Button onPress={() => setGameState("menu")}>Menu</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={async (friend) => {
          if (!currentFirebaseUser || isSending) return;
          setIsSending(true);
          try {
            await sendScorecard(currentFirebaseUser.uid, friend.friendUid, {
              gameId: GAME_TYPE,
              score: elapsed,
              playerName: profile?.displayName || "Player",
            });
            showSuccess("Time shared!");
          } catch {
            showError("Failed to share");
          }
          setIsSending(false);
          setShowFriendPicker(false);
        }}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Share Time With"
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
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  timer: { fontSize: 16, fontWeight: "700" },
  menuContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuTitle: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  menuSub: { fontSize: 16, marginBottom: 16 },
  bestText: { fontSize: 14, fontWeight: "600" },
  playArea: { flex: 1, alignItems: "center", paddingTop: 8 },
  mistakeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  gridWrapper: { alignItems: "flex-start" },
  colCluesRow: { flexDirection: "row", marginBottom: 2 },
  colClue: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 2,
    minHeight: 30,
  },
  gridRow: { flexDirection: "row" },
  rowClue: {
    width: 50,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 6,
  },
  cell: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogActions: { justifyContent: "center" },
});
