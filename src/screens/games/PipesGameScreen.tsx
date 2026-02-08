/**
 * PipesGameScreen — Pipe Mania
 *
 * How to play:
 * 1. Tap pipe segments to rotate them
 * 2. Connect water flow from source (top-left) to drain (bottom-right)
 * 3. Complete before time runs out!
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
const GRID_ROWS = 6;
const GRID_COLS = 6;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 48) / GRID_COLS);
const GAME_TYPE = "pipes_game";
const TIME_LIMIT = 120; // seconds

type GameState = "menu" | "playing" | "result";
type Rotation = 0 | 1 | 2 | 3; // 0=up, 1=right, 2=down, 3=left (90° increments)

/**
 * Pipe types and their connections per rotation:
 * - straight: connects 2 opposite sides
 * - bend: connects 2 adjacent sides
 * - tee: connects 3 sides
 * - cross: connects all 4 sides
 *
 * Sides: 0=top, 1=right, 2=bottom, 3=left
 */
type PipeType = "straight" | "bend" | "tee" | "cross" | "source" | "drain";

interface PipeCell {
  type: PipeType;
  rotation: Rotation;
  filled: boolean;
}

// Base connections (before rotation)
const PIPE_CONNECTIONS: Record<PipeType, number[]> = {
  straight: [0, 2], // top-bottom
  bend: [0, 1], // top-right
  tee: [0, 1, 2], // top-right-bottom
  cross: [0, 1, 2, 3],
  source: [2], // connects downward
  drain: [0], // connects upward
};

function getConnections(type: PipeType, rotation: Rotation): number[] {
  if (type === "source" || type === "drain") return PIPE_CONNECTIONS[type];
  return PIPE_CONNECTIONS[type].map((side) => (side + rotation) % 4);
}

function hasConnection(
  type: PipeType,
  rotation: Rotation,
  side: number,
): boolean {
  return getConnections(type, rotation).includes(side);
}

function oppositeSide(side: number): number {
  return (side + 2) % 4;
}

function generatePuzzle(): PipeCell[][] {
  // Create a solvable path from source to drain using BFS/random walk
  const grid: PipeCell[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => ({
      type: "straight" as PipeType,
      rotation: 0 as Rotation,
      filled: false,
    })),
  );

  // Source at (0,0), drain at (GRID_ROWS-1, GRID_COLS-1)
  grid[0][0] = { type: "source", rotation: 0, filled: false };
  grid[GRID_ROWS - 1][GRID_COLS - 1] = {
    type: "drain",
    rotation: 0,
    filled: false,
  };

  // Generate a random path
  const visited = new Set<string>();
  visited.add("0,0");
  const path: [number, number][] = [[0, 0]];
  let r = 0;
  let c = 0;

  // Random walk toward drain
  while (r !== GRID_ROWS - 1 || c !== GRID_COLS - 1) {
    const neighbors: [number, number, number][] = []; // [row, col, side from current]

    if (r > 0 && !visited.has(`${r - 1},${c}`)) neighbors.push([r - 1, c, 0]);
    if (c < GRID_COLS - 1 && !visited.has(`${r},${c + 1}`))
      neighbors.push([r, c + 1, 1]);
    if (r < GRID_ROWS - 1 && !visited.has(`${r + 1},${c}`))
      neighbors.push([r + 1, c, 2]);
    if (c > 0 && !visited.has(`${r},${c - 1}`)) neighbors.push([r, c - 1, 3]);

    if (neighbors.length === 0) {
      // Backtrack
      path.pop();
      if (path.length === 0) break;
      [r, c] = path[path.length - 1];
      continue;
    }

    // Bias toward drain
    neighbors.sort((a, b) => {
      const distA =
        Math.abs(a[0] - (GRID_ROWS - 1)) + Math.abs(a[1] - (GRID_COLS - 1));
      const distB =
        Math.abs(b[0] - (GRID_ROWS - 1)) + Math.abs(b[1] - (GRID_COLS - 1));
      return distA - distB + (Math.random() - 0.5) * 3;
    });

    const [nr, nc] = neighbors[0];
    visited.add(`${nr},${nc}`);
    path.push([nr, nc]);
    r = nr;
    c = nc;
  }

  // Now set pipe types along the path
  for (let i = 1; i < path.length - 1; i++) {
    const [pr, pc] = path[i - 1];
    const [cr, cc] = path[i];
    const [nr, nc] = path[i + 1];

    // Determine which sides connect
    const fromSide = pr < cr ? 0 : pr > cr ? 2 : pc < cc ? 3 : 1;
    const toSide = nr < cr ? 0 : nr > cr ? 2 : nc < cc ? 3 : 1;

    // Determine pipe type and rotation
    if (oppositeSide(fromSide) === toSide) {
      // Straight
      grid[cr][cc] = {
        type: "straight",
        rotation: (fromSide % 2 === 0 ? 0 : 1) as Rotation,
        filled: false,
      };
    } else {
      // Bend — need to find rotation that connects fromSide and toSide
      const sides = [fromSide, toSide].sort();
      let rot: Rotation = 0;
      for (let r = 0; r < 4; r++) {
        const conns = PIPE_CONNECTIONS["bend"].map((s) => (s + r) % 4).sort();
        if (conns[0] === sides[0] && conns[1] === sides[1]) {
          rot = r as Rotation;
          break;
        }
      }
      grid[cr][cc] = { type: "bend", rotation: rot, filled: false };
    }
  }

  // Fill remaining cells with random pipes
  const pipeTypes: PipeType[] = ["straight", "bend", "tee"];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c].type === "source" || grid[r][c].type === "drain") continue;
      if (
        visited.has(`${r},${c}`) &&
        r !== 0 &&
        !(r === GRID_ROWS - 1 && c === GRID_COLS - 1)
      )
        continue;
      if (!visited.has(`${r},${c}`)) {
        grid[r][c] = {
          type: pipeTypes[Math.floor(Math.random() * pipeTypes.length)],
          rotation: Math.floor(Math.random() * 4) as Rotation,
          filled: false,
        };
      }
    }
  }

  // Scramble all rotations (except source/drain)
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c].type !== "source" && grid[r][c].type !== "drain") {
        grid[r][c].rotation = Math.floor(Math.random() * 4) as Rotation;
      }
    }
  }

  return grid;
}

function checkFlow(grid: PipeCell[][]): PipeCell[][] {
  const newGrid = grid.map((row) =>
    row.map((cell) => ({ ...cell, filled: false })),
  );

  // BFS from source
  const queue: [number, number][] = [[0, 0]];
  const visited = new Set<string>();
  visited.add("0,0");
  newGrid[0][0].filled = true;

  const dr = [-1, 0, 1, 0];
  const dc = [0, 1, 0, -1];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const cell = newGrid[r][c];
    const conns = getConnections(cell.type, cell.rotation);

    for (const side of conns) {
      const nr = r + dr[side];
      const nc = c + dc[side];
      if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
      if (visited.has(`${nr},${nc}`)) continue;

      const neighbor = newGrid[nr][nc];
      if (hasConnection(neighbor.type, neighbor.rotation, oppositeSide(side))) {
        visited.add(`${nr},${nc}`);
        neighbor.filled = true;
        queue.push([nr, nc]);
      }
    }
  }

  return newGrid;
}

// =============================================================================
// Pipe Rendering
// =============================================================================

function getPipeIcon(type: PipeType, rotation: Rotation): string {
  switch (type) {
    case "source":
      return "water";
    case "drain":
      return "water-check";
    case "straight":
      return rotation % 2 === 0 ? "pipe" : "pipe";
    case "bend":
      return "pipe-wrench";
    case "tee":
      return "pipe-valve";
    case "cross":
      return "plus-thick";
    default:
      return "pipe";
  }
}

function getRotationDeg(rotation: Rotation): string {
  return `${rotation * 90}deg`;
}

// =============================================================================
// Component
// =============================================================================

export default function PipesGameScreen({ navigation }: { navigation: any }) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("menu");
  const [grid, setGrid] = useState<PipeCell[][]>([]);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [level, setLevel] = useState(1);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [solved, setSolved] = useState(false);
  const [solveTime, setSolveTime] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval>>(null!);

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  useEffect(() => {
    if (gameState === "playing" && !solved) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setGameState("result");
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, solved]);

  const startGame = useCallback(() => {
    const newGrid = generatePuzzle();
    setGrid(checkFlow(newGrid));
    setTimeLeft(TIME_LIMIT);
    setSolved(false);
    setGameState("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const rotatePipe = useCallback(
    (r: number, c: number) => {
      if (gameState !== "playing" || solved) return;
      const cell = grid[r][c];
      if (cell.type === "source" || cell.type === "drain") return;

      const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })));
      newGrid[r][c].rotation = ((cell.rotation + 1) % 4) as Rotation;

      const flowGrid = checkFlow(newGrid);
      setGrid(flowGrid);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Check if drain is connected
      if (flowGrid[GRID_ROWS - 1][GRID_COLS - 1].filled) {
        setSolved(true);
        const time = TIME_LIMIT - timeLeft;
        setSolveTime(time);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (currentFirebaseUser) {
          recordGameSession(currentFirebaseUser.uid, {
            gameId: GAME_TYPE,
            score: time,
            duration: time * 1000,
          });
        }
        setTimeout(() => setGameState("result"), 1000);
      }
    },
    [grid, gameState, solved, timeLeft, currentFirebaseUser],
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
        <Text style={[styles.title, { color: colors.text }]}>🔧 Pipes</Text>
        {gameState === "playing" && (
          <Text
            style={[
              styles.timer,
              { color: timeLeft <= 10 ? "#e74c3c" : colors.primary },
            ]}
          >
            {formatTime(timeLeft)}
          </Text>
        )}
        {gameState !== "playing" && <View style={{ width: 50 }} />}
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>Pipes</Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Rotate pipes to connect the flow!
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

      {gameState === "playing" && (
        <View style={styles.playArea}>
          <View style={[styles.gridContainer, { borderColor: colors.border }]}>
            {grid.map((row, r) => (
              <View key={r} style={styles.gridRow}>
                {row.map((cell, c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => rotatePipe(r, c)}
                    style={[
                      styles.pipeCell,
                      {
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        borderColor: cell.filled ? "#3498db50" : "rgba(255,255,255,0.08)",
                      },
                    ]}
                    activeOpacity={0.6}
                  >
                    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                      <RoundedRect x={0} y={0} width={CELL_SIZE - 2} height={CELL_SIZE - 2} r={2}>
                        <LinearGradient
                          start={vec(0, 0)}
                          end={vec(0, CELL_SIZE - 2)}
                          colors={
                            cell.filled
                              ? ["rgba(52,152,219,0.25)", "rgba(52,152,219,0.15)", "rgba(52,152,219,0.08)"]
                              : [colors.surface, colors.surface]
                          }
                        />
                        <Shadow dx={0} dy={1} blur={2} color={cell.filled ? "rgba(52,152,219,0.2)" : "rgba(0,0,0,0.1)"} inner />
                      </RoundedRect>
                    </Canvas>
                    <View
                      style={{
                        transform: [{ rotate: getRotationDeg(cell.rotation) }],
                      }}
                    >
                      <MaterialCommunityIcons
                        name={getPipeIcon(cell.type, cell.rotation) as any}
                        size={CELL_SIZE * 0.6}
                        color={
                          cell.type === "source"
                            ? "#3498db"
                            : cell.type === "drain"
                              ? "#27ae60"
                              : cell.filled
                                ? "#3498db"
                                : colors.textSecondary
                        }
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Tap a pipe to rotate it 90°
          </Text>
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
            {solved ? "🎉 Connected!" : "⏰ Time's Up!"}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
              {solved ? `Solved in ${formatTime(solveTime)}` : "Try again!"}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={startGame}>Play Again</Button>
            {solved && (
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
              score: solveTime,
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
  playArea: { flex: 1, alignItems: "center", paddingTop: 16 },
  gridContainer: { borderWidth: 2, borderRadius: 8, overflow: "hidden" },
  gridRow: { flexDirection: "row" },
  pipeCell: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 13, marginTop: 12 },
  dialogActions: { justifyContent: "center" },
});
