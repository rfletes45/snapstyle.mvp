/**
 * SnapGomokuGameScreen - Five in a Row
 *
 * How to play:
 * 1. Two players take turns placing stones on a 15×15 grid
 * 2. Black always goes first
 * 3. First to get exactly 5 in a row (horizontal, vertical, or diagonal) wins!
 *
 * Supports: Local 2-player and vs AI (threat-based heuristic)
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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const BOARD_ROWS = 15;
const BOARD_COLS = 15;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_PADDING = 12;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - BOARD_PADDING * 2) / BOARD_COLS);
const BOARD_PIXEL_SIZE = CELL_SIZE * BOARD_COLS;
const STONE_RADIUS = Math.floor(CELL_SIZE * 0.42);

const GAME_TYPE = "snap_gomoku";

// =============================================================================
// Types
// =============================================================================

type CellState = 0 | 1 | 2; // 0 = empty, 1 = black, 2 = white
type Board = CellState[][];
type GameMode = "local" | "ai";
type GameState = "menu" | "playing" | "result";

interface Coord {
  row: number;
  col: number;
}

// =============================================================================
// Board Helpers
// =============================================================================

const EMPTY_BOARD = (): Board =>
  Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(0));

const DIRECTIONS: [number, number][] = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal ↘
  [1, -1], // diagonal ↙
];

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS;
}

/**
 * Count consecutive stones of `player` starting from (r, c) in direction (dr, dc).
 * Does NOT count the starting cell.
 */
function countDirection(
  board: Board,
  r: number,
  c: number,
  dr: number,
  dc: number,
  player: CellState,
): number {
  let count = 0;
  let nr = r + dr;
  let nc = c + dc;
  while (inBounds(nr, nc) && board[nr][nc] === player) {
    count++;
    nr += dr;
    nc += dc;
  }
  return count;
}

/**
 * Check if placing `player` at (r, c) would create exactly 5 in a row.
 */
function wouldWin(
  board: Board,
  r: number,
  c: number,
  player: CellState,
): boolean {
  for (const [dr, dc] of DIRECTIONS) {
    const total =
      1 +
      countDirection(board, r, c, dr, dc, player) +
      countDirection(board, r, c, -dr, -dc, player);
    if (total >= 5) return true;
  }
  return false;
}

/**
 * Check the entire board for a five-in-a-row and return the winning coordinates.
 */
function findWinLine(board: Board, player: CellState): Coord[] | null {
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const line: Coord[] = [{ row: r, col: c }];
        for (let step = 1; step < 5; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (!inBounds(nr, nc) || board[nr][nc] !== player) break;
          line.push({ row: nr, col: nc });
        }
        if (line.length >= 5) return line;
      }
    }
  }
  return null;
}

function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== 0));
}

// =============================================================================
// AI Logic — Threat-based heuristic
// =============================================================================

/**
 * Score a single empty cell for a given player.
 * Checks all four directions for line lengths and open ends.
 */
function scoreCell(
  board: Board,
  r: number,
  c: number,
  player: CellState,
): number {
  let total = 0;
  for (const [dr, dc] of DIRECTIONS) {
    const forward = countDirection(board, r, c, dr, dc, player);
    const backward = countDirection(board, r, c, -dr, -dc, player);
    const lineLen = forward + backward + 1;

    // Check open ends
    const fEnd = { r: r + dr * (forward + 1), c: c + dc * (forward + 1) };
    const bEnd = { r: r - dr * (backward + 1), c: c - dc * (backward + 1) };
    const fOpen = inBounds(fEnd.r, fEnd.c) && board[fEnd.r][fEnd.c] === 0;
    const bOpen = inBounds(bEnd.r, bEnd.c) && board[bEnd.r][bEnd.c] === 0;
    const openEnds = (fOpen ? 1 : 0) + (bOpen ? 1 : 0);

    if (lineLen >= 5) total += 1000000;
    else if (lineLen === 4 && openEnds === 2) total += 50000;
    else if (lineLen === 4 && openEnds === 1) total += 10000;
    else if (lineLen === 3 && openEnds === 2) total += 5000;
    else if (lineLen === 3 && openEnds === 1) total += 500;
    else if (lineLen === 2 && openEnds === 2) total += 200;
    else if (lineLen === 2 && openEnds === 1) total += 50;
    else if (lineLen === 1 && openEnds === 2) total += 10;
  }
  return total;
}

function getAIMove(board: Board, aiPlayer: CellState): Coord {
  const humanPlayer: CellState = aiPlayer === 1 ? 2 : 1;
  let bestScore = -1;
  let bestMove: Coord = { row: 7, col: 7 };

  // Collect empty cells near existing stones for efficiency
  const candidates: Coord[] = [];
  const visited = new Set<string>();

  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c] === 0) continue;
      // Add all empty neighbours within radius 2
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          const key = `${nr},${nc}`;
          if (inBounds(nr, nc) && board[nr][nc] === 0 && !visited.has(key)) {
            visited.add(key);
            candidates.push({ row: nr, col: nc });
          }
        }
      }
    }
  }

  // If board is empty, play centre
  if (candidates.length === 0) return { row: 7, col: 7 };

  for (const { row, col } of candidates) {
    // Offensive score (how good for AI)
    const attackScore = scoreCell(board, row, col, aiPlayer);
    // Defensive score (how good for human — we want to block)
    const defendScore = scoreCell(board, row, col, humanPlayer);

    // Prioritise winning, then blocking, then attack
    const combinedScore = attackScore * 1.1 + defendScore;

    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestMove = { row, col };
    }
  }

  return bestMove;
}

// =============================================================================
// Component
// =============================================================================

interface SnapGomokuGameScreenProps {
  navigation: any;
}

export default function SnapGomokuGameScreen({
  navigation,
}: SnapGomokuGameScreenProps) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("menu");
  const [gameMode, setGameMode] = useState<GameMode>("ai");
  const [board, setBoard] = useState<Board>(EMPTY_BOARD());
  const [currentPlayer, setCurrentPlayer] = useState<CellState>(1); // 1 = black goes first
  const [winner, setWinner] = useState<CellState | null>(null);
  const [winLine, setWinLine] = useState<Coord[] | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [wins, setWins] = useState(0);
  const [lastMove, setLastMove] = useState<Coord | null>(null);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Load personal best
  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE as any).then(
        setPersonalBest,
      );
    }
  }, [currentFirebaseUser]);

  // Win line set for fast lookup during render
  const winLineSet = useMemo(() => {
    if (!winLine) return new Set<string>();
    return new Set(winLine.map((c) => `${c.row},${c.col}`));
  }, [winLine]);

  const startGame = useCallback((mode: GameMode) => {
    setGameMode(mode);
    setBoard(EMPTY_BOARD());
    setCurrentPlayer(1);
    setWinner(null);
    setWinLine(null);
    setIsDraw(false);
    setLastMove(null);
    setGameState("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const placeStone = useCallback(
    (row: number, col: number) => {
      if (gameState !== "playing" || winner || isDraw) return;
      if (board[row][col] !== 0) return;
      if (gameMode === "ai" && currentPlayer === 2) return; // AI's turn

      const newBoard = board.map((r) => [...r]);
      newBoard[row][col] = currentPlayer;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setBoard(newBoard);
      setLastMove({ row, col });

      // Check win
      const line = findWinLine(newBoard, currentPlayer);
      if (line) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setWinner(currentPlayer);
        setWinLine(line);
        setGameState("result");
        if (currentPlayer === 1) {
          const newWins = wins + 1;
          setWins(newWins);
          if (currentFirebaseUser) {
            const newBest = !personalBest || newWins > personalBest.bestScore;
            recordGameSession(currentFirebaseUser.uid, {
              gameId: GAME_TYPE as any,
              score: newWins,
            }).then((session) => {
              if (session && newBest) {
                setPersonalBest({
                  gameId: GAME_TYPE as any,
                  bestScore: newWins,
                  achievedAt: Date.now(),
                });
                showSuccess("🎉 New personal best!");
              }
            });
          }
        }
        return;
      }

      // Check draw
      if (isBoardFull(newBoard)) {
        setIsDraw(true);
        setGameState("result");
        return;
      }

      const nextPlayer: CellState = currentPlayer === 1 ? 2 : 1;
      setCurrentPlayer(nextPlayer);

      // AI move
      if (gameMode === "ai" && nextPlayer === 2) {
        setTimeout(() => {
          const aiMove = getAIMove(newBoard, 2);
          const aiBoard = newBoard.map((r) => [...r]);
          aiBoard[aiMove.row][aiMove.col] = 2;

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setBoard(aiBoard);
          setLastMove(aiMove);

          const aiLine = findWinLine(aiBoard, 2);
          if (aiLine) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setWinner(2);
            setWinLine(aiLine);
            setGameState("result");
            return;
          }

          if (isBoardFull(aiBoard)) {
            setIsDraw(true);
            setGameState("result");
            return;
          }

          setCurrentPlayer(1);
        }, 400);
      }
    },
    [
      board,
      currentPlayer,
      gameState,
      gameMode,
      winner,
      isDraw,
      wins,
      currentFirebaseUser,
      personalBest,
      showSuccess,
    ],
  );

  const handleSendScorecard = useCallback(
    async (friendUid: string) => {
      if (!currentFirebaseUser || !profile) return;
      setIsSending(true);
      try {
        await sendScorecard(currentFirebaseUser.uid, friendUid, {
          gameId: GAME_TYPE,
          score: wins,
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
    [currentFirebaseUser, profile, wins, showSuccess, showError],
  );

  const [inviteLoading, setInviteLoading] = useState(false);
  const [showInvitePicker, setShowInvitePicker] = useState(false);

  const handleInviteFriend = useCallback(() => {
    setShowInvitePicker(true);
  }, []);

  const handleSelectFriendForInvite = useCallback(
    async (friend: any) => {
      if (!currentFirebaseUser || !profile) return;
      setShowInvitePicker(false);
      setInviteLoading(true);
      try {
        await sendGameInvite(
          currentFirebaseUser.uid,
          profile.displayName || "Player",
          profile.avatarConfig
            ? JSON.stringify(profile.avatarConfig)
            : undefined,
          {
            gameType: GAME_TYPE,
            recipientId: friend.friendUid,
            recipientName: friend.displayName || "Friend",
            settings: { isRated: false, chatEnabled: false },
          },
        );
        Alert.alert(
          "Invite Sent!",
          `Game invite sent to ${friend.displayName || "your friend"}. They'll see it on their Play screen!`,
        );
      } catch (error: any) {
        Alert.alert("Error", "Failed to send game invite. Please try again.");
      } finally {
        setInviteLoading(false);
      }
    },
    [currentFirebaseUser, profile],
  );

  // ==========================================================================
  // Render helpers
  // ==========================================================================

  const stoneColor = (player: CellState) =>
    player === 1 ? "#1A1A1A" : "#F5F5F5";

  const stoneBorder = (player: CellState) =>
    player === 1 ? "#000000" : "#D4D4D4";

  const renderBoard = () => (
    <View style={[styles.boardOuter, { backgroundColor: "#DCB35C" }]}>
      {/* Grid lines (horizontal) */}
      {Array.from({ length: BOARD_ROWS }).map((_, r) => (
        <View
          key={`h-${r}`}
          style={[
            styles.gridLineH,
            {
              top: CELL_SIZE * r + CELL_SIZE / 2,
              left: CELL_SIZE / 2,
              width: CELL_SIZE * (BOARD_COLS - 1),
            },
          ]}
        />
      ))}
      {/* Grid lines (vertical) */}
      {Array.from({ length: BOARD_COLS }).map((_, c) => (
        <View
          key={`v-${c}`}
          style={[
            styles.gridLineV,
            {
              left: CELL_SIZE * c + CELL_SIZE / 2,
              top: CELL_SIZE / 2,
              height: CELL_SIZE * (BOARD_ROWS - 1),
            },
          ]}
        />
      ))}
      {/* Star points (traditional Gomoku markers) */}
      {[
        [3, 3],
        [3, 7],
        [3, 11],
        [7, 3],
        [7, 7],
        [7, 11],
        [11, 3],
        [11, 7],
        [11, 11],
      ].map(([r, c]) => (
        <View
          key={`star-${r}-${c}`}
          style={[
            styles.starPoint,
            {
              left: CELL_SIZE * c + CELL_SIZE / 2 - 4,
              top: CELL_SIZE * r + CELL_SIZE / 2 - 4,
            },
          ]}
        />
      ))}
      {/* Cells */}
      {board.map((row, r) =>
        row.map((cell, c) => {
          const isWinCell = winLineSet.has(`${r},${c}`);
          const isLast = lastMove?.row === r && lastMove?.col === c;

          return (
            <TouchableOpacity
              key={`${r}-${c}`}
              style={[
                styles.cell,
                {
                  left: CELL_SIZE * c,
                  top: CELL_SIZE * r,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                },
              ]}
              onPress={() => placeStone(r, c)}
              disabled={gameState !== "playing" || cell !== 0}
              activeOpacity={0.7}
              accessibilityLabel={`Row ${r + 1} Column ${c + 1}${cell === 1 ? " Black stone" : cell === 2 ? " White stone" : " Empty"}`}
            >
              {cell !== 0 && (
                <View
                  style={[
                    styles.stone,
                    {
                      width: STONE_RADIUS * 2,
                      height: STONE_RADIUS * 2,
                      borderRadius: STONE_RADIUS,
                      backgroundColor: stoneColor(cell),
                      borderWidth: 1,
                      borderColor: stoneBorder(cell),
                    },
                    isWinCell && styles.winStone,
                    isLast && styles.lastStone,
                  ]}
                >
                  {/* Subtle highlight on black stones */}
                  {cell === 1 && (
                    <View
                      style={[
                        styles.stoneHighlight,
                        {
                          width: STONE_RADIUS * 0.6,
                          height: STONE_RADIUS * 0.6,
                          borderRadius: STONE_RADIUS * 0.3,
                        },
                      ]}
                    />
                  )}
                  {/* Last move indicator dot */}
                  {isLast && !winner && (
                    <View
                      style={[
                        styles.lastMoveDot,
                        {
                          backgroundColor: cell === 1 ? "#EF4444" : "#EF4444",
                        },
                      ]}
                    />
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        }),
      )}
    </View>
  );

  // ==========================================================================
  // Main render
  // ==========================================================================

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
        <Text style={[styles.title, { color: colors.text }]}>Snap Gomoku</Text>
        <View style={{ width: 32 }} />
      </View>

      {gameState === "menu" ? (
        <View style={styles.menuContent}>
          <Text style={[styles.gameTitle, { color: colors.text }]}>
            ⚫⚪ Snap Gomoku
          </Text>
          <Text style={[styles.subtitle, { color: colors.text }]}>
            Five in a Row
          </Text>
          <Text style={[styles.instructions, { color: colors.textSecondary }]}>
            Place stones on the board.{"\n"}First to get 5 in a row wins!{"\n"}
            Horizontal, vertical, or diagonal.
          </Text>
          {personalBest && (
            <Text style={[styles.bestScore, { color: colors.primary }]}>
              Best Win Streak: {personalBest.bestScore}
            </Text>
          )}
          <Button
            mode="contained"
            onPress={() => startGame("ai")}
            style={styles.menuButton}
          >
            🤖 Play vs AI
          </Button>
          <Button
            mode="outlined"
            onPress={() => startGame("local")}
            style={styles.menuButton}
          >
            👥 Local 2-Player
          </Button>
          <Button
            mode="contained-tonal"
            onPress={handleInviteFriend}
            icon="account-plus"
            loading={inviteLoading}
            style={styles.menuButton}
          >
            Invite a Friend
          </Button>
        </View>
      ) : (
        <>
          {/* Turn indicator */}
          {gameState === "playing" && (
            <View style={styles.turnIndicator}>
              <View
                style={[
                  styles.turnDot,
                  {
                    backgroundColor:
                      currentPlayer === 1 ? "#1A1A1A" : "#F5F5F5",
                    borderWidth: 1,
                    borderColor: currentPlayer === 1 ? "#000" : "#D4D4D4",
                  },
                ]}
              />
              <Text style={[styles.turnText, { color: colors.text }]}>
                {gameMode === "ai"
                  ? currentPlayer === 1
                    ? "Your turn (Black)"
                    : "AI thinking..."
                  : `Player ${currentPlayer === 1 ? "Black" : "White"}'s turn`}
              </Text>
            </View>
          )}

          {/* Score / Win streak */}
          {wins > 0 && gameState === "playing" && (
            <Text style={[styles.streakText, { color: colors.primary }]}>
              Win Streak: {wins}
            </Text>
          )}

          {/* Board container — scrollable if needed */}
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            maximumZoomScale={2}
            minimumZoomScale={1}
            bouncesZoom
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            <View style={styles.boardWrapper}>{renderBoard()}</View>
          </ScrollView>
        </>
      )}

      {/* Result Dialog */}
      <Portal>
        <Dialog visible={gameState === "result"} dismissable={false}>
          <Dialog.Title>
            {isDraw
              ? "Draw!"
              : winner === 1
                ? gameMode === "ai"
                  ? "🎉 You Win!"
                  : "🎉 Black Wins!"
                : gameMode === "ai"
                  ? "AI Wins!"
                  : "⚪ White Wins!"}
          </Dialog.Title>
          <Dialog.Content>
            <Text>
              {isDraw
                ? "The board is full — no winner!"
                : winner === 1
                  ? "Black connected five in a row!"
                  : "White connected five in a row!"}
            </Text>
            {wins > 0 && (
              <Text style={{ marginTop: 8 }}>Win Streak: {wins}</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setGameState("menu")}>Menu</Button>
            {winner === 1 && (
              <Button onPress={() => setShowFriendPicker(true)}>Share</Button>
            )}
            <Button mode="contained" onPress={() => startGame(gameMode)}>
              Play Again
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={(friend) => handleSendScorecard(friend.friendUid)}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Send Scorecard"
      />
      <FriendPickerModal
        visible={showInvitePicker}
        onDismiss={() => setShowInvitePicker(false)}
        onSelectFriend={handleSelectFriendForInvite}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Invite to Gomoku"
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  menuContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  gameTitle: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    opacity: 0.7,
  },
  instructions: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 24,
  },
  bestScore: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 24,
  },
  menuButton: {
    width: "100%",
    marginBottom: 12,
  },
  turnIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 8,
  },
  turnDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  turnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  streakText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
    paddingVertical: 8,
  },
  boardWrapper: {
    alignItems: "center",
    justifyContent: "center",
    padding: BOARD_PADDING,
  },
  boardOuter: {
    width: BOARD_PIXEL_SIZE,
    height: BOARD_PIXEL_SIZE,
    borderRadius: 4,
    position: "relative",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  gridLineH: {
    position: "absolute",
    height: 1,
    backgroundColor: "#8B6914",
  },
  gridLineV: {
    position: "absolute",
    width: 1,
    backgroundColor: "#8B6914",
  },
  starPoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8B6914",
  },
  cell: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  stone: {
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
  },
  stoneHighlight: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    position: "absolute",
    top: "15%",
    left: "20%",
  },
  winStone: {
    shadowColor: "#22C55E",
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
  lastStone: {
    // slight glow on last placed stone
  },
  lastMoveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
