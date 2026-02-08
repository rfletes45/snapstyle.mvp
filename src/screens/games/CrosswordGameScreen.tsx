/**
 * CrosswordGameScreen — Daily 5×5 Mini Crossword
 *
 * How to play:
 * 1. Fill in the 5×5 grid using the across/down clues
 * 2. Tap a cell, then type the letter
 * 3. Complete the puzzle as fast as possible!
 * 4. New puzzle daily — share your time with friends
 *
 * Uses a rotating set of pre-built mini crosswords.
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
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Canvas,
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_SIZE = 5;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 64) / GRID_SIZE);
const GAME_TYPE = "crossword_puzzle";

type GameState = "playing" | "result";

interface CrosswordPuzzle {
  grid: (string | null)[][]; // null = black cell
  acrossClues: { num: number; clue: string; row: number; col: number }[];
  downClues: { num: number; clue: string; row: number; col: number }[];
}

// =============================================================================
// Puzzle Bank (rotated daily)
// =============================================================================

const PUZZLES: CrosswordPuzzle[] = [
  {
    grid: [
      ["S", "T", "A", "R", "T"],
      ["H", "I", "D", "E", null],
      ["A", "N", "D", null, "A"],
      ["R", null, "S", "E", "T"],
      ["E", "V", "E", "N", null],
    ],
    acrossClues: [
      { num: 1, clue: "Begin", row: 0, col: 0 },
      { num: 6, clue: "Conceal", row: 1, col: 0 },
      { num: 7, clue: "Also", row: 2, col: 0 },
      { num: 8, clue: "Group of things", row: 3, col: 2 },
      { num: 9, clue: "Flat, level", row: 4, col: 0 },
    ],
    downClues: [
      { num: 1, clue: "Portion", row: 0, col: 0 },
      { num: 2, clue: "Shade, color", row: 0, col: 1 },
      { num: 3, clue: "Includes", row: 0, col: 2 },
      { num: 4, clue: "Gain, make", row: 0, col: 3 },
      { num: 5, clue: "Small feline", row: 2, col: 4 },
    ],
  },
  {
    grid: [
      ["L", "I", "G", "H", "T"],
      ["O", "N", "E", null, "A"],
      ["O", "D", null, "B", "L"],
      ["P", null, "A", "I", "L"],
      [null, "S", "P", "T", "Y"],
    ],
    acrossClues: [
      { num: 1, clue: "Not heavy", row: 0, col: 0 },
      { num: 5, clue: "Single", row: 1, col: 0 },
      { num: 6, clue: "Bucket", row: 3, col: 2 },
      { num: 7, clue: "Devious, crafty", row: 4, col: 1 },
    ],
    downClues: [
      { num: 1, clue: "Repeated circle", row: 0, col: 0 },
      { num: 2, clue: "Not outdoors", row: 0, col: 1 },
      { num: 3, clue: "Space, opening", row: 0, col: 2 },
      { num: 4, clue: "Highest, also ...", row: 1, col: 4 },
    ],
  },
  {
    grid: [
      ["B", "R", "A", "V", "E"],
      ["L", "O", null, "I", "A"],
      ["A", "C", "U", "P", null],
      ["D", "K", "S", "E", "D"],
      ["E", null, "E", "R", null],
    ],
    acrossClues: [
      { num: 1, clue: "Courageous", row: 0, col: 0 },
      { num: 5, clue: "Drinking vessel", row: 2, col: 1 },
      { num: 6, clue: "Cutting tool", row: 3, col: 0 },
      { num: 7, clue: "Employ, utilize", row: 4, col: 2 },
    ],
    downClues: [
      { num: 1, clue: "Sword part", row: 0, col: 0 },
      { num: 2, clue: "Solid stone", row: 0, col: 1 },
      { num: 3, clue: "Snake relative", row: 1, col: 3 },
      { num: 4, clue: "Listen to", row: 0, col: 4 },
    ],
  },
  {
    grid: [
      ["F", "L", "A", "S", "H"],
      ["L", "I", "N", "E", null],
      ["A", "N", "T", null, "B"],
      ["T", null, "H", "U", "E"],
      [null, "R", "E", "N", "D"],
    ],
    acrossClues: [
      { num: 1, clue: "Quick burst of light", row: 0, col: 0 },
      { num: 6, clue: "Queue, row", row: 1, col: 0 },
      { num: 7, clue: "Small insect", row: 2, col: 0 },
      { num: 8, clue: "Popular direction", row: 4, col: 1 },
    ],
    downClues: [
      { num: 1, clue: "Apartment", row: 0, col: 0 },
      { num: 2, clue: "Connection", row: 0, col: 1 },
      { num: 3, clue: "Song, melody", row: 0, col: 2 },
      { num: 4, clue: "Utilize, send", row: 0, col: 3 },
      { num: 5, clue: "Curve, turn", row: 2, col: 4 },
    ],
  },
  {
    grid: [
      ["G", "R", "O", "W", "N"],
      ["L", "I", "V", "E", null],
      ["A", "D", "E", null, "M"],
      ["D", null, "R", "A", "N"],
      [null, "S", "T", "O", "P"],
    ],
    acrossClues: [
      { num: 1, clue: "Mature, adult", row: 0, col: 0 },
      { num: 6, clue: "Exist, be alive", row: 1, col: 0 },
      { num: 7, clue: "Finished, completed", row: 1, col: 0 },
      { num: 8, clue: "Halt, cease", row: 4, col: 1 },
    ],
    downClues: [
      { num: 1, clue: "Happy, pleased", row: 0, col: 0 },
      { num: 2, clue: "Go up, ascend", row: 0, col: 1 },
      { num: 3, clue: "Above, past", row: 0, col: 2 },
      { num: 4, clue: "Desire, require", row: 0, col: 3 },
      { num: 5, clue: "Guy, fellow", row: 2, col: 4 },
    ],
  },
  {
    grid: [
      ["P", "L", "A", "N", "E"],
      ["L", "O", "S", "E", null],
      ["A", "V", "K", null, "B"],
      ["N", null, "E", "A", "I"],
      [null, "D", "D", "R", "T"],
    ],
    acrossClues: [
      { num: 1, clue: "Aircraft", row: 0, col: 0 },
      { num: 6, clue: "Not win", row: 1, col: 0 },
      { num: 7, clue: "Inquire", row: 2, col: 1 },
      { num: 8, clue: "Small amount", row: 4, col: 1 },
    ],
    downClues: [
      { num: 1, clue: "Scheme, strategy", row: 0, col: 0 },
      { num: 2, clue: "Adore, care for", row: 0, col: 1 },
      { num: 3, clue: "Requested", row: 0, col: 2 },
      { num: 4, clue: "Close, proximate", row: 0, col: 3 },
      { num: 5, clue: "Chew, munch", row: 2, col: 4 },
    ],
  },
  {
    grid: [
      ["C", "H", "A", "I", "R"],
      ["L", "O", "N", "E", null],
      ["E", "P", "E", null, "S"],
      ["A", null, "W", "E", "T"],
      ["R", "E", "S", "T", null],
    ],
    acrossClues: [
      { num: 1, clue: "Seat furniture", row: 0, col: 0 },
      { num: 6, clue: "Solo, single", row: 1, col: 0 },
      { num: 7, clue: "Not dry", row: 3, col: 2 },
      { num: 8, clue: "Relax, sleep", row: 4, col: 0 },
    ],
    downClues: [
      { num: 1, clue: "Obvious, plain", row: 0, col: 0 },
      { num: 2, clue: "Wish, expect", row: 0, col: 1 },
      { num: 3, clue: "Response", row: 0, col: 2 },
      { num: 4, clue: "Frozen water", row: 0, col: 3 },
      { num: 5, clue: "Road, avenue", row: 2, col: 4 },
    ],
  },
];

function getDailyPuzzle(): CrosswordPuzzle {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  return PUZZLES[daysSinceEpoch % PUZZLES.length];
}

// =============================================================================
// Component
// =============================================================================

export default function CrosswordGameScreen({
  navigation,
}: {
  navigation: any;
}) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const puzzle = useMemo(() => getDailyPuzzle(), []);
  const [userGrid, setUserGrid] = useState<(string | null)[][]>(() =>
    puzzle.grid.map((row) => row.map((cell) => (cell === null ? null : ""))),
  );
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(
    null,
  );
  const [direction, setDirection] = useState<"across" | "down">("across");
  const [gameState, setGameState] = useState<GameState>("playing");
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null!);

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  // Timer
  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, startTime]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Check completion
  const checkComplete = useCallback(
    (grid: (string | null)[][]) => {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (puzzle.grid[r][c] !== null) {
            if ((grid[r][c] || "").toUpperCase() !== puzzle.grid[r][c]) {
              return false;
            }
          }
        }
      }
      return true;
    },
    [puzzle],
  );

  const handleCellPress = useCallback(
    (r: number, c: number) => {
      if (puzzle.grid[r][c] === null) return;
      if (selectedCell?.[0] === r && selectedCell?.[1] === c) {
        // Toggle direction
        setDirection((d) => (d === "across" ? "down" : "across"));
      } else {
        setSelectedCell([r, c]);
      }
      inputRef.current?.focus();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [puzzle, selectedCell],
  );

  const handleInput = useCallback(
    (text: string) => {
      if (!selectedCell || gameState !== "playing") return;
      const [r, c] = selectedCell;
      const letter = text.toUpperCase().replace(/[^A-Z]/g, "");
      if (!letter) return;

      const newGrid = userGrid.map((row) => [...row]);
      newGrid[r][c] = letter[0];
      setUserGrid(newGrid);

      // Move to next cell
      const dr = direction === "down" ? 1 : 0;
      const dc = direction === "across" ? 1 : 0;
      let nr = r + dr;
      let nc = c + dc;
      while (nr < GRID_SIZE && nc < GRID_SIZE && puzzle.grid[nr][nc] === null) {
        nr += dr;
        nc += dc;
      }
      if (nr < GRID_SIZE && nc < GRID_SIZE) {
        setSelectedCell([nr, nc]);
      }

      // Check completion
      if (checkComplete(newGrid)) {
        const time = Math.floor((Date.now() - startTime) / 1000);
        setElapsedTime(time);
        setGameState("result");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (currentFirebaseUser) {
          const isNewBest = !personalBest || time < personalBest.bestScore;
          recordGameSession(currentFirebaseUser.uid, {
            gameId: GAME_TYPE,
            score: time,
            duration: time * 1000,
          });
        }
      }
    },
    [
      selectedCell,
      userGrid,
      direction,
      puzzle,
      gameState,
      checkComplete,
      startTime,
      currentFirebaseUser,
      personalBest,
    ],
  );

  const handleBackspace = useCallback(() => {
    if (!selectedCell) return;
    const [r, c] = selectedCell;
    const newGrid = userGrid.map((row) => [...row]);
    if (newGrid[r][c]) {
      newGrid[r][c] = "";
      setUserGrid(newGrid);
    } else {
      // Move back
      const dr = direction === "down" ? -1 : 0;
      const dc = direction === "across" ? -1 : 0;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nc >= 0 && puzzle.grid[nr][nc] !== null) {
        setSelectedCell([nr, nc]);
        newGrid[nr][nc] = "";
        setUserGrid(newGrid);
      }
    }
  }, [selectedCell, userGrid, direction, puzzle]);

  // Get cell number
  const cellNumbers = useMemo(() => {
    const nums: Record<string, number> = {};
    for (const clue of [...puzzle.acrossClues, ...puzzle.downClues]) {
      const key = `${clue.row},${clue.col}`;
      if (!nums[key]) nums[key] = clue.num;
    }
    return nums;
  }, [puzzle]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hidden input for keyboard */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        autoCapitalize="characters"
        onChangeText={handleInput}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === "Backspace") handleBackspace();
        }}
        value=""
        autoCorrect={false}
        autoComplete="off"
      />

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
        <Text style={[styles.title, { color: colors.text }]}>📰 Crossword</Text>
        <Text style={[styles.timer, { color: colors.primary }]}>
          {formatTime(elapsedTime)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Grid */}
        <View style={[styles.grid, { borderColor: colors.border }]}>
          {puzzle.grid.map((row, r) => (
            <View key={r} style={styles.gridRow}>
              {row.map((cell, c) => {
                const isBlack = cell === null;
                const isSelected =
                  selectedCell?.[0] === r && selectedCell?.[1] === c;
                const num = cellNumbers[`${r},${c}`];
                const userLetter = userGrid[r]?.[c] || "";
                const isCorrect = userLetter.toUpperCase() === (cell || "");
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => handleCellPress(r, c)}
                    disabled={isBlack}
                    style={[
                      styles.gridCell,
                      {
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        borderColor: isSelected ? colors.primary : "rgba(200,200,200,0.3)",
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                      <RoundedRect x={0} y={0} width={CELL_SIZE - 2} height={CELL_SIZE - 2} r={2}>
                        <LinearGradient
                          start={vec(0, 0)}
                          end={vec(0, CELL_SIZE - 2)}
                          colors={
                            isBlack
                              ? ["#1a1a2e", "#12122a"]
                              : isSelected
                                ? [`${colors.primary}40`, `${colors.primary}20`]
                                : ["#FFFFFF", "#F5F5F5"]
                          }
                        />
                        <Shadow dx={0} dy={1} blur={1} color="rgba(0,0,0,0.1)" inner />
                      </RoundedRect>
                    </Canvas>
                    {num && <Text style={styles.cellNum}>{num}</Text>}
                    {!isBlack && (
                      <Text
                        style={[
                          styles.cellLetter,
                          {
                            color:
                              gameState === "result"
                                ? isCorrect
                                  ? "#27ae60"
                                  : "#e74c3c"
                                : colors.text,
                          },
                        ]}
                      >
                        {userLetter}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Clues */}
        <View style={styles.cluesContainer}>
          <View style={styles.clueSection}>
            <Text style={[styles.clueHeader, { color: colors.primary }]}>
              Across
            </Text>
            {puzzle.acrossClues.map((clue) => (
              <TouchableOpacity
                key={`a-${clue.num}`}
                onPress={() => {
                  setSelectedCell([clue.row, clue.col]);
                  setDirection("across");
                  inputRef.current?.focus();
                }}
              >
                <Text style={[styles.clueText, { color: colors.text }]}>
                  {clue.num}. {clue.clue}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.clueSection}>
            <Text style={[styles.clueHeader, { color: colors.primary }]}>
              Down
            </Text>
            {puzzle.downClues.map((clue) => (
              <TouchableOpacity
                key={`d-${clue.num}`}
                onPress={() => {
                  setSelectedCell([clue.row, clue.col]);
                  setDirection("down");
                  inputRef.current?.focus();
                }}
              >
                <Text style={[styles.clueText, { color: colors.text }]}>
                  {clue.num}. {clue.clue}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Result dialog */}
      <Portal>
        <Dialog
          visible={gameState === "result"}
          onDismiss={() => {}}
          style={{ backgroundColor: colors.surface }}
        >
          <Dialog.Title style={{ color: colors.text, textAlign: "center" }}>
            🎉 Puzzle Complete!
          </Dialog.Title>
          <Dialog.Content>
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                fontSize: 16,
              }}
            >
              Time: {formatTime(elapsedTime)}
            </Text>
            {personalBest && (
              <Text
                style={{
                  color: colors.primary,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Best: {formatTime(personalBest.bestScore)}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowFriendPicker(true)}>Share</Button>
            <Button onPress={() => navigation.goBack()}>Done</Button>
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
              score: elapsedTime,
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
  hiddenInput: {
    position: "absolute",
    top: -100,
    left: -100,
    width: 1,
    height: 1,
    opacity: 0,
  },
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
  timer: { fontSize: 16, fontWeight: "600" },
  scrollContent: { alignItems: "center", paddingBottom: 100 },
  grid: { borderWidth: 1, borderRadius: 4, marginTop: 16 },
  gridRow: { flexDirection: "row" },
  gridCell: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cellNum: {
    position: "absolute",
    top: 2,
    left: 3,
    fontSize: 9,
    fontWeight: "600",
    color: "#666",
  },
  cellLetter: { fontSize: 22, fontWeight: "700" },
  cluesContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 24,
    width: "100%",
  },
  clueSection: { flex: 1 },
  clueHeader: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  clueText: { fontSize: 14, lineHeight: 22, marginBottom: 4 },
  dialogActions: { justifyContent: "center" },
});
