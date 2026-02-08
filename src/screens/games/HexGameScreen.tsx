/**
 * HexGameScreen — Hex Board Game
 *
 * How to play:
 * 1. Two players take turns placing pieces on an 11×11 hex grid
 * 2. Player 1 (blue) connects top-to-bottom
 * 3. Player 2 (red) connects left-to-right
 * 4. First to connect their two sides wins!
 *
 * Supports: Turn-based multiplayer & vs AI
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { sendGameInvite } from "@/services/gameInvites";
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
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Canvas,
  Circle,
  LinearGradient,
  RadialGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GAME_TYPE = "hex_game";
const BOARD_SIZE = 9; // Use 9x9 for mobile friendliness
const HEX_SIZE = Math.floor((SCREEN_WIDTH - 80) / (BOARD_SIZE + 2));

type GameState = "menu" | "playing" | "result";
type CellValue = 0 | 1 | 2; // 0=empty, 1=player1(blue/top-bottom), 2=player2(red/left-right)

interface HexBoard {
  cells: CellValue[][];
}

// =============================================================================
// Game Logic (pure functions)
// =============================================================================

function createEmptyBoard(): HexBoard {
  return {
    cells: Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => 0 as CellValue),
    ),
  };
}

function placeStone(
  board: HexBoard,
  r: number,
  c: number,
  player: CellValue,
): HexBoard {
  const newCells = board.cells.map((row) => [...row]);
  newCells[r][c] = player;
  return { cells: newCells };
}

function getHexNeighbors(r: number, c: number): [number, number][] {
  return [
    [r - 1, c],
    [r - 1, c + 1],
    [r, c - 1],
    [r, c + 1],
    [r + 1, c - 1],
    [r + 1, c],
  ];
}

function checkWin(board: HexBoard, player: CellValue): boolean {
  // Player 1 (blue): connect top row to bottom row
  // Player 2 (red): connect left column to right column
  const visited = new Set<string>();
  const queue: [number, number][] = [];

  if (player === 1) {
    // Start from top row
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board.cells[0][c] === player) {
        queue.push([0, c]);
        visited.add(`0,${c}`);
      }
    }
  } else {
    // Start from left column
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board.cells[r][0] === player) {
        queue.push([r, 0]);
        visited.add(`${r},0`);
      }
    }
  }

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;

    // Check win condition
    if (player === 1 && r === BOARD_SIZE - 1) return true;
    if (player === 2 && c === BOARD_SIZE - 1) return true;

    for (const [nr, nc] of getHexNeighbors(r, c)) {
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      if (board.cells[nr][nc] === player) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  return false;
}

function getAIMove(board: HexBoard): [number, number] | null {
  const empty: [number, number][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board.cells[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return null;

  // Simple heuristic: prefer center, try to block opponent, try to connect
  const center = Math.floor(BOARD_SIZE / 2);

  // Score each move
  let bestScore = -Infinity;
  let bestMove = empty[0];

  for (const [r, c] of empty) {
    let score = 0;

    // Center preference
    const distFromCenter = Math.abs(r - center) + Math.abs(c - center);
    score -= distFromCenter * 2;

    // Check if this move wins
    const testBoard = placeStone(board, r, c, 2);
    if (checkWin(testBoard, 2)) return [r, c];

    // Check if we need to block opponent win
    const blockBoard = placeStone(board, r, c, 1);
    if (checkWin(blockBoard, 1)) score += 100;

    // Count adjacent friendly cells (build connections)
    for (const [nr, nc] of getHexNeighbors(r, c)) {
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        if (board.cells[nr][nc] === 2) score += 5;
      }
    }

    // Prefer edge connections (left-right for AI)
    if (c === 0 || c === BOARD_SIZE - 1) score += 8;

    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }

  return bestMove;
}

// =============================================================================
// Component
// =============================================================================

export default function HexGameScreen({ navigation }: { navigation: any }) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("menu");
  const [board, setBoard] = useState<HexBoard>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<CellValue>(1);
  const [winner, setWinner] = useState<CellValue>(0);
  const [moveCount, setMoveCount] = useState(0);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  const startGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setCurrentPlayer(1);
    setWinner(0);
    setMoveCount(0);
    setGameState("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleCellTap = useCallback(
    (r: number, c: number) => {
      if (gameState !== "playing" || winner !== 0) return;
      if (board.cells[r][c] !== 0) return;
      if (currentPlayer !== 1) return; // AI's turn

      const newBoard = placeStone(board, r, c, 1);
      const newMoveCount = moveCount + 1;
      setBoard(newBoard);
      setMoveCount(newMoveCount);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (checkWin(newBoard, 1)) {
        setWinner(1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (currentFirebaseUser) {
          recordGameSession(currentFirebaseUser.uid, {
            gameId: GAME_TYPE,
            score: newMoveCount,
            duration: newMoveCount * 1000,
          });
        }
        setTimeout(() => setGameState("result"), 600);
        return;
      }

      setCurrentPlayer(2);

      // AI move
      setTimeout(() => {
        const aiMove = getAIMove(newBoard);
        if (aiMove) {
          const [ar, ac] = aiMove;
          const aiBoard = placeStone(newBoard, ar, ac, 2);
          setBoard(aiBoard);
          setMoveCount((m) => m + 1);

          if (checkWin(aiBoard, 2)) {
            setWinner(2);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setTimeout(() => setGameState("result"), 600);
            return;
          }
        }
        setCurrentPlayer(1);
      }, 400);
    },
    [board, gameState, winner, currentPlayer, moveCount, currentFirebaseUser],
  );

  const playerColor = (v: CellValue): string => {
    if (v === 1) return "#3498db";
    if (v === 2) return "#e74c3c";
    return "transparent";
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
        <Text style={[styles.title, { color: colors.text }]}>⬡ Hex</Text>
        {gameState === "playing" && (
          <Text
            style={[
              styles.turnText,
              { color: currentPlayer === 1 ? "#3498db" : "#e74c3c" },
            ]}
          >
            {currentPlayer === 1 ? "Your Turn" : "AI..."}
          </Text>
        )}
        {gameState !== "playing" && <View style={{ width: 60 }} />}
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>Hex</Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Connect your sides to win!
          </Text>
          <View style={styles.rulesBox}>
            <Text style={{ color: "#3498db", fontWeight: "700" }}>
              🔵 Blue: Connect TOP ↔ BOTTOM
            </Text>
            <Text style={{ color: "#e74c3c", fontWeight: "700", marginTop: 4 }}>
              🔴 Red (AI): Connect LEFT ↔ RIGHT
            </Text>
          </View>
          {personalBest && (
            <Text style={[styles.bestText, { color: colors.primary }]}>
              Best win: {personalBest.bestScore} moves
            </Text>
          )}
          <Button
            mode="contained"
            onPress={startGame}
            style={{ backgroundColor: colors.primary, marginTop: 20 }}
            labelStyle={{ color: "#fff" }}
          >
            Play vs AI
          </Button>
          <Button
            mode="outlined"
            onPress={() => setShowInviteModal(true)}
            style={{ borderColor: colors.primary, marginTop: 12 }}
            labelStyle={{ color: colors.primary }}
          >
            Challenge Friend
          </Button>
        </View>
      )}

      {gameState === "playing" && (
        <ScrollView
          contentContainerStyle={styles.boardScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.boardContainer}>
            {/* Edge labels */}
            <Text
              style={[
                styles.edgeLabel,
                { color: "#3498db", alignSelf: "center" },
              ]}
            >
              ▼ BLUE ▼
            </Text>
            {board.cells.map((row, r) => (
              <View
                key={r}
                style={[styles.hexRow, { marginLeft: r * (HEX_SIZE * 0.5) }]}
              >
                {row.map((cell, c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => handleCellTap(r, c)}
                    style={[
                      styles.hexCell,
                      {
                        width: HEX_SIZE,
                        height: HEX_SIZE,
                        borderColor: "rgba(255,255,255,0.1)",
                      },
                    ]}
                    activeOpacity={0.6}
                    disabled={cell !== 0 || currentPlayer !== 1}
                  >
                    <Canvas style={{ width: HEX_SIZE - 2, height: HEX_SIZE - 2 }}>
                      {/* Cell background */}
                      <RoundedRect x={0} y={0} width={HEX_SIZE - 2} height={HEX_SIZE - 2} r={3}>
                        <LinearGradient
                          start={vec(0, 0)}
                          end={vec(0, HEX_SIZE - 2)}
                          colors={
                            cell !== 0
                              ? cell === 1
                                ? ["#5DADE2", "#3498DB", "#2471A3"]
                                : ["#F1948A", "#E74C3C", "#C0392B"]
                              : [colors.surface, colors.surface, colors.surface]
                          }
                        />
                        <Shadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.2)" inner />
                      </RoundedRect>
                      {/* Stone with 3D effect */}
                      {cell !== 0 && (
                        <>
                          <Circle
                            cx={(HEX_SIZE - 2) / 2}
                            cy={(HEX_SIZE - 2) / 2}
                            r={HEX_SIZE * 0.28}
                          >
                            <RadialGradient
                              c={vec((HEX_SIZE - 2) * 0.4, (HEX_SIZE - 2) * 0.35)}
                              r={HEX_SIZE * 0.28}
                              colors={
                                cell === 1
                                  ? ["#FFFFFF", "#85C1E9", "#2471A3"]
                                  : ["#FFFFFF", "#F5B7B1", "#C0392B"]
                              }
                            />
                            <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.4)" />
                          </Circle>
                        </>
                      )}
                    </Canvas>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <Text
              style={[
                styles.edgeLabel,
                { color: "#3498db", alignSelf: "center" },
              ]}
            >
              ▲ BLUE ▲
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Result */}
      <Portal>
        <Dialog
          visible={gameState === "result"}
          onDismiss={() => {}}
          style={{ backgroundColor: colors.surface }}
        >
          <Dialog.Title style={{ color: colors.text, textAlign: "center" }}>
            {winner === 1 ? "🎉 You Win!" : "😞 AI Wins!"}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
              {winner === 1
                ? `Won in ${moveCount} moves`
                : "Better luck next time!"}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={startGame}>Play Again</Button>
            {winner === 1 && (
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
              score: moveCount,
              playerName: profile?.displayName || "Player",
            });
            showSuccess("Score shared!");
          } catch {
            showError("Failed to share");
          }
          setIsSending(false);
          setShowFriendPicker(false);
        }}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Share Win With"
      />

      <FriendPickerModal
        visible={showInviteModal}
        onDismiss={() => setShowInviteModal(false)}
        onSelectFriend={async (friend) => {
          if (!currentFirebaseUser) return;
          try {
            await sendGameInvite(
              currentFirebaseUser.uid,
              profile?.displayName || "Player",
              profile?.avatarConfig
                ? JSON.stringify(profile.avatarConfig)
                : undefined,
              {
                gameType: GAME_TYPE as any,
                recipientId: friend.friendUid,
                recipientName: friend.displayName || "Friend",
              },
            );
            showSuccess("Invite sent!");
          } catch {
            showError("Failed to send invite");
          }
          setShowInviteModal(false);
        }}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Challenge a Friend"
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
  turnText: { fontSize: 14, fontWeight: "700" },
  menuContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuTitle: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  menuSub: { fontSize: 16, marginBottom: 16 },
  rulesBox: { marginBottom: 12, alignItems: "center" },
  bestText: { fontSize: 14, fontWeight: "600" },
  boardScroll: { alignItems: "center", paddingVertical: 16 },
  boardContainer: { paddingHorizontal: 16 },
  hexRow: { flexDirection: "row", marginBottom: 2 },
  hexCell: {
    borderWidth: 1,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  stone: { elevation: 2 },
  edgeLabel: { fontSize: 12, fontWeight: "700", marginVertical: 4 },
  dialogActions: { justifyContent: "center" },
});
