/**
 * ConnectFourGameScreen - Connect Four Game
 *
 * How to play:
 * 1. Two players take turns dropping colored discs
 * 2. Discs fall to the lowest available row in the column
 * 3. First to connect four discs in a row (horizontal, vertical, or diagonal) wins!
 *
 * Supports: Local 2-player and vs AI (simple minimax)
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import {
  SkiaDisc,
} from "@/components/games/graphics/SkiaDisc";
import {
  SkiaGameBoard,
} from "@/components/games/graphics/SkiaGameBoard";
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
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const ROWS = 6;
const COLS = 7;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_PADDING = 16;
const CELL_SIZE = Math.floor(
  (SCREEN_WIDTH - BOARD_PADDING * 2 - (COLS + 1) * 4) / COLS,
);

type CellState = 0 | 1 | 2; // 0 = empty, 1 = player 1 (red), 2 = player 2 (yellow)/AI
type Board = CellState[][];
type GameMode = "local" | "ai";
type GameState = "menu" | "playing" | "result";

const EMPTY_BOARD = (): Board =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(0));

const PLAYER_COLORS: Record<number, string> = {
  1: "#EF4444",
  2: "#EAB308",
};

// =============================================================================
// AI Logic (Simple Minimax with Alpha-Beta Pruning)
// =============================================================================

function getValidColumns(board: Board): number[] {
  return Array.from({ length: COLS }, (_, i) => i).filter(
    (col) => board[0][col] === 0,
  );
}

function dropPiece(board: Board, col: number, player: CellState): Board | null {
  const newBoard = board.map((row) => [...row]);
  for (let row = ROWS - 1; row >= 0; row--) {
    if (newBoard[row][col] === 0) {
      newBoard[row][col] = player;
      return newBoard;
    }
  }
  return null;
}

function checkWin(board: Board, player: CellState): boolean {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (
        board[r][c] === player &&
        board[r][c + 1] === player &&
        board[r][c + 2] === player &&
        board[r][c + 3] === player
      )
        return true;
    }
  }
  // Vertical
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c < COLS; c++) {
      if (
        board[r][c] === player &&
        board[r + 1][c] === player &&
        board[r + 2][c] === player &&
        board[r + 3][c] === player
      )
        return true;
    }
  }
  // Diagonal ↘
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (
        board[r][c] === player &&
        board[r + 1][c + 1] === player &&
        board[r + 2][c + 2] === player &&
        board[r + 3][c + 3] === player
      )
        return true;
    }
  }
  // Diagonal ↗
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (
        board[r][c] === player &&
        board[r - 1][c + 1] === player &&
        board[r - 2][c + 2] === player &&
        board[r - 3][c + 3] === player
      )
        return true;
    }
  }
  return false;
}

function isBoardFull(board: Board): boolean {
  return board[0].every((cell) => cell !== 0);
}

function evaluateWindow(window: CellState[], player: CellState): number {
  const opp = player === 1 ? 2 : 1;
  const count = window.filter((c) => c === player).length;
  const empty = window.filter((c) => c === 0).length;
  const oppCount = window.filter((c) => c === opp).length;

  if (count === 4) return 100;
  if (count === 3 && empty === 1) return 5;
  if (count === 2 && empty === 2) return 2;
  if (oppCount === 3 && empty === 1) return -4;
  return 0;
}

function scoreBoard(board: Board, player: CellState): number {
  let score = 0;
  // Center column preference
  const centerCol = Math.floor(COLS / 2);
  const centerCount = board.filter((row) => row[centerCol] === player).length;
  score += centerCount * 3;

  // Horizontal windows
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const window = [
        board[r][c],
        board[r][c + 1],
        board[r][c + 2],
        board[r][c + 3],
      ] as CellState[];
      score += evaluateWindow(window, player);
    }
  }
  // Vertical windows
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c < COLS; c++) {
      const window = [
        board[r][c],
        board[r + 1][c],
        board[r + 2][c],
        board[r + 3][c],
      ] as CellState[];
      score += evaluateWindow(window, player);
    }
  }
  // Diagonal windows
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const window = [
        board[r][c],
        board[r + 1][c + 1],
        board[r + 2][c + 2],
        board[r + 3][c + 3],
      ] as CellState[];
      score += evaluateWindow(window, player);
    }
  }
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const window = [
        board[r][c],
        board[r - 1][c + 1],
        board[r - 2][c + 2],
        board[r - 3][c + 3],
      ] as CellState[];
      score += evaluateWindow(window, player);
    }
  }
  return score;
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): [number, number] {
  const validCols = getValidColumns(board);
  if (depth === 0 || validCols.length === 0) return [scoreBoard(board, 2), -1];
  if (checkWin(board, 2)) return [100000, -1];
  if (checkWin(board, 1)) return [-100000, -1];
  if (isBoardFull(board)) return [0, -1];

  if (maximizing) {
    let maxScore = -Infinity;
    let bestCol = validCols[Math.floor(Math.random() * validCols.length)];
    for (const col of validCols) {
      const newBoard = dropPiece(board, col, 2);
      if (!newBoard) continue;
      const [s] = minimax(newBoard, depth - 1, alpha, beta, false);
      if (s > maxScore) {
        maxScore = s;
        bestCol = col;
      }
      alpha = Math.max(alpha, s);
      if (alpha >= beta) break;
    }
    return [maxScore, bestCol];
  } else {
    let minScore = Infinity;
    let bestCol = validCols[Math.floor(Math.random() * validCols.length)];
    for (const col of validCols) {
      const newBoard = dropPiece(board, col, 1);
      if (!newBoard) continue;
      const [s] = minimax(newBoard, depth - 1, alpha, beta, true);
      if (s < minScore) {
        minScore = s;
        bestCol = col;
      }
      beta = Math.min(beta, s);
      if (alpha >= beta) break;
    }
    return [minScore, bestCol];
  }
}

function getAIMove(board: Board): number {
  const [, col] = minimax(board, 4, -Infinity, Infinity, true);
  return col;
}

// =============================================================================
// Component
// =============================================================================

interface ConnectFourGameScreenProps {
  navigation: any;
}

export default function ConnectFourGameScreen({
  navigation,
}: ConnectFourGameScreenProps) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("menu");
  const [gameMode, setGameMode] = useState<GameMode>("ai");
  const [board, setBoard] = useState<Board>(EMPTY_BOARD());
  const [currentPlayer, setCurrentPlayer] = useState<CellState>(1);
  const [winner, setWinner] = useState<CellState | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [wins, setWins] = useState(0);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  // Refs to avoid stale closures in callbacks
  const boardRef = useRef<Board>(EMPTY_BOARD());
  const currentPlayerRef = useRef<CellState>(1);
  const gameStateRef = useRef<GameState>("menu");
  const gameModeRef = useRef<GameMode>("ai");
  const winnerRef = useRef<CellState | null>(null);
  const isDrawRef = useRef(false);
  const winsRef = useRef(0);

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, "connect_four" as any).then(
        setPersonalBest,
      );
    }
  }, [currentFirebaseUser]);

  const startGame = useCallback((mode: GameMode) => {
    const newBoard = EMPTY_BOARD();
    setGameMode(mode);
    gameModeRef.current = mode;
    setBoard(newBoard);
    boardRef.current = newBoard;
    setCurrentPlayer(1);
    currentPlayerRef.current = 1;
    setWinner(null);
    winnerRef.current = null;
    setIsDraw(false);
    isDrawRef.current = false;
    setAiThinking(false);
    setGameState("playing");
    gameStateRef.current = "playing";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const doAIMove = useCallback((currentBoard: Board) => {
    setAiThinking(true);
    setTimeout(() => {
      const aiCol = getAIMove(currentBoard);
      const aiBoard = dropPiece(currentBoard, aiCol, 2);
      if (!aiBoard) {
        setAiThinking(false);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setBoard(aiBoard);
      boardRef.current = aiBoard;

      if (checkWin(aiBoard, 2)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setWinner(2);
        winnerRef.current = 2;
        setGameState("result");
        gameStateRef.current = "result";
        setAiThinking(false);
        return;
      }

      if (isBoardFull(aiBoard)) {
        setIsDraw(true);
        isDrawRef.current = true;
        setGameState("result");
        gameStateRef.current = "result";
        setAiThinking(false);
        return;
      }

      setCurrentPlayer(1);
      currentPlayerRef.current = 1;
      setAiThinking(false);
    }, 400);
  }, []);

  const handleColumnPress = useCallback(
    (col: number) => {
      if (
        gameStateRef.current !== "playing" ||
        winnerRef.current ||
        isDrawRef.current
      )
        return;
      if (gameModeRef.current === "ai" && currentPlayerRef.current === 2)
        return;

      const currentBoard = boardRef.current;
      const player = currentPlayerRef.current;
      const newBoard = dropPiece(currentBoard, col, player);
      if (!newBoard) return; // Column full

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setBoard(newBoard);
      boardRef.current = newBoard;

      if (checkWin(newBoard, player)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setWinner(player);
        winnerRef.current = player;
        setGameState("result");
        gameStateRef.current = "result";
        if (player === 1) {
          const newWins = winsRef.current + 1;
          winsRef.current = newWins;
          setWins(newWins);
          if (currentFirebaseUser) {
            recordGameSession(currentFirebaseUser.uid, {
              gameId: "connect_four" as any,
              score: newWins,
            }).then(() => {
              const newBest = !personalBest || newWins > personalBest.bestScore;
              if (newBest) {
                setPersonalBest({
                  gameId: "connect_four" as any,
                  bestScore: newWins,
                  achievedAt: Date.now(),
                });
                showSuccess("🎉 New win streak!");
              }
            });
          }
        }
        return;
      }

      if (isBoardFull(newBoard)) {
        setIsDraw(true);
        isDrawRef.current = true;
        setGameState("result");
        gameStateRef.current = "result";
        return;
      }

      if (gameModeRef.current === "local") {
        const nextPlayer: CellState = player === 1 ? 2 : 1;
        setCurrentPlayer(nextPlayer);
        currentPlayerRef.current = nextPlayer;
      } else {
        // AI mode: switch to AI
        setCurrentPlayer(2);
        currentPlayerRef.current = 2;
        doAIMove(newBoard);
      }
    },
    [currentFirebaseUser, personalBest, showSuccess, doAIMove],
  );

  const handleSendScorecard = useCallback(
    async (friendUid: string) => {
      if (!currentFirebaseUser || !profile) return;
      setIsSending(true);
      try {
        await sendScorecard(currentFirebaseUser.uid, friendUid, {
          gameId: "connect_four",
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
            gameType: "connect_four",
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
  // Render
  // ==========================================================================

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.title, { color: colors.text }]}>Four</Text>
        <View style={{ width: 32 }} />
      </View>

      {gameState === "menu" ? (
        <View style={styles.menuContent}>
          <Text style={[styles.gameTitle, { color: colors.text }]}>
            🔴🟡 Four
          </Text>
          <Text style={[styles.instructions, { color: colors.textSecondary }]}>
            Connect 4 in a row to win!{"\n"}Horizontal, vertical, or diagonal.
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
                  { backgroundColor: PLAYER_COLORS[currentPlayer] },
                ]}
              />
              <Text style={[styles.turnText, { color: colors.text }]}>
                {gameMode === "ai"
                  ? currentPlayer === 1
                    ? "Your turn — tap a column"
                    : "AI thinking..."
                  : `Player ${currentPlayer}'s turn — tap a column`}
              </Text>
            </View>
          )}

          {/* Board — Skia gradient frame with glossy discs */}
          <View style={styles.boardContainer}>
            <SkiaGameBoard
              width={COLS * CELL_SIZE + (COLS + 1) * 4}
              height={ROWS * CELL_SIZE + (ROWS + 1) * 4}
              borderRadius={12}
              gradientColors={[
                colors.primary + "30",
                colors.primary + "18",
                colors.primary + "28",
              ]}
              borderColor={colors.primary + "40"}
              borderWidth={2}
              innerShadowBlur={8}
            >
              {/* Column touch areas overlay the entire board */}
              <View style={styles.columnOverlay}>
                {Array.from({ length: COLS }).map((_, col) => (
                  <TouchableOpacity
                    key={`col-press-${col}`}
                    style={styles.columnTouchArea}
                    onPress={() => handleColumnPress(col)}
                    disabled={
                      gameState !== "playing" ||
                      aiThinking ||
                      !!winner ||
                      isDraw
                    }
                    activeOpacity={0.7}
                    accessibilityLabel={`Drop in column ${col + 1}`}
                  />
                ))}
              </View>
              {/* Visual board cells — Skia glossy discs */}
              {board.map((row, r) => (
                <View key={r} style={styles.row}>
                  {row.map((cell, c) => (
                    <View
                      key={c}
                      style={[
                        styles.cell,
                        { width: CELL_SIZE, height: CELL_SIZE },
                      ]}
                    >
                      <SkiaDisc
                        size={CELL_SIZE - 4}
                        color={
                          cell === 0
                            ? null
                            : PLAYER_COLORS[cell as 1 | 2]
                        }
                        emptyColor={colors.background}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </SkiaGameBoard>
          </View>
        </>
      )}

      {/* Result Dialog */}
      <Portal>
        <Dialog visible={gameState === "result"} dismissable={false}>
          <Dialog.Title>
            {isDraw ? "Draw!" : winner === 1 ? "🎉 You Win!" : "AI Wins!"}
          </Dialog.Title>
          <Dialog.Content>
            <Text>
              {isDraw
                ? "The board is full!"
                : `${winner === 1 ? "Red" : "Yellow"} connected four!`}
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
        title="Invite to game Four"
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
  },
  backButton: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700" },
  menuContent: {
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
  menuButton: { width: "100%", marginBottom: 12 },
  turnIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
  },
  turnDot: { width: 16, height: 16, borderRadius: 8 },
  turnText: { fontSize: 16, fontWeight: "600" },
  boardContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: BOARD_PADDING,
  },
  columnOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    zIndex: 10,
  },
  columnTouchArea: {
    flex: 1,
    height: "100%",
  },
  row: { flexDirection: "row", gap: 4 },
  cell: { justifyContent: "center", alignItems: "center", padding: 2 },
});
