/**
 * DotMatchGameScreen - Dots & Boxes Game
 *
 * How to play:
 * 1. Two players take turns drawing lines between adjacent dots
 * 2. When a player completes the fourth side of a 1x1 box, they claim it and get another turn
 * 3. The player with the most boxes at the end wins!
 *
 * Supports: vs AI (greedy strategy)
 *
 * Grid: 5x5 dots → 4x4 boxes
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
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const GRID_ROWS = 5; // dots vertically
const GRID_COLS = 5; // dots horizontally
const BOX_ROWS = GRID_ROWS - 1; // 4 rows of boxes
const BOX_COLS = GRID_COLS - 1; // 4 cols of boxes
const TOTAL_BOXES = BOX_ROWS * BOX_COLS; // 16 boxes

// Total lines: horizontal lines = GRID_ROWS * (GRID_COLS - 1) = 20
//              vertical lines   = (GRID_ROWS - 1) * GRID_COLS = 20
// Total = 40
const TOTAL_H_LINES = GRID_ROWS * BOX_COLS; // 20
const TOTAL_V_LINES = BOX_ROWS * GRID_COLS; // 20
const TOTAL_LINES = TOTAL_H_LINES + TOTAL_V_LINES; // 40

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_PADDING = 24;
const DOT_SIZE = 12;
// Calculate cell spacing so the board fits the screen width nicely
const CELL_SPACING = Math.floor(
  (SCREEN_WIDTH - BOARD_PADDING * 2 - GRID_COLS * DOT_SIZE) / (GRID_COLS - 1),
);
const LINE_THICKNESS = 6;
// Tap target sizes (bigger than visual for easier tapping)
const H_LINE_TAP_HEIGHT = 24;
const V_LINE_TAP_WIDTH = 24;

// Total board dimensions
const BOARD_WIDTH = GRID_COLS * DOT_SIZE + (GRID_COLS - 1) * CELL_SPACING;
const BOARD_HEIGHT = GRID_ROWS * DOT_SIZE + (GRID_ROWS - 1) * CELL_SPACING;

const PLAYER_COLORS = {
  1: "#3B82F6", // blue for player
  2: "#EF4444", // red for AI
};

type Owner = 0 | 1 | 2; // 0 = unclaimed
type GameState = "menu" | "playing" | "result";
type GameMode = "ai" | "local";

// Horizontal lines: hLines[row][col] — line from dot(row,col) to dot(row,col+1)
// Vertical lines:   vLines[row][col] — line from dot(row,col) to dot(row+1,col)
interface BoardState {
  hLines: boolean[][]; // [GRID_ROWS][BOX_COLS]
  vLines: boolean[][]; // [BOX_ROWS][GRID_COLS]
  boxes: Owner[][]; // [BOX_ROWS][BOX_COLS]
}

// =============================================================================
// Board Helpers
// =============================================================================

function createEmptyBoard(): BoardState {
  return {
    hLines: Array.from({ length: GRID_ROWS }, () =>
      Array(BOX_COLS).fill(false),
    ),
    vLines: Array.from({ length: BOX_ROWS }, () =>
      Array(GRID_COLS).fill(false),
    ),
    boxes: Array.from({ length: BOX_ROWS }, () =>
      Array<Owner>(BOX_COLS).fill(0),
    ),
  };
}

function cloneBoard(b: BoardState): BoardState {
  return {
    hLines: b.hLines.map((r) => [...r]),
    vLines: b.vLines.map((r) => [...r]),
    boxes: b.boxes.map((r) => [...r]),
  };
}

/** Count how many sides a box currently has drawn. */
function boxSideCount(b: BoardState, row: number, col: number): number {
  let count = 0;
  if (b.hLines[row][col]) count++; // top
  if (b.hLines[row + 1][col]) count++; // bottom
  if (b.vLines[row][col]) count++; // left
  if (b.vLines[row][col + 1]) count++; // right
  return count;
}

/**
 * Draw a line and check for completed boxes. Returns the number of boxes
 * completed by this move. Mutates the board in place for efficiency.
 */
function drawLine(
  b: BoardState,
  type: "h" | "v",
  row: number,
  col: number,
  player: 1 | 2,
): number {
  if (type === "h") {
    b.hLines[row][col] = true;
  } else {
    b.vLines[row][col] = true;
  }

  let completed = 0;

  if (type === "h") {
    // Horizontal line at (row, col) is the top edge of box (row, col)
    // and the bottom edge of box (row-1, col)
    // Check box above
    if (row > 0 && boxSideCount(b, row - 1, col) === 4) {
      b.boxes[row - 1][col] = player;
      completed++;
    }
    // Check box below
    if (row < BOX_ROWS && boxSideCount(b, row, col) === 4) {
      b.boxes[row][col] = player;
      completed++;
    }
  } else {
    // Vertical line at (row, col) is the left edge of box (row, col)
    // and the right edge of box (row, col-1)
    // Check box to the right
    if (col < BOX_COLS && boxSideCount(b, row, col) === 4) {
      b.boxes[row][col] = player;
      completed++;
    }
    // Check box to the left
    if (col > 0 && boxSideCount(b, row, col - 1) === 4) {
      b.boxes[row][col - 1] = player;
      completed++;
    }
  }

  return completed;
}

/** Check if the line is already drawn. */
function isLineDrawn(
  b: BoardState,
  type: "h" | "v",
  row: number,
  col: number,
): boolean {
  return type === "h" ? b.hLines[row][col] : b.vLines[row][col];
}

/** Get all available (undrawn) lines. */
function getAvailableLines(
  b: BoardState,
): Array<{ type: "h" | "v"; row: number; col: number }> {
  const lines: Array<{ type: "h" | "v"; row: number; col: number }> = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < BOX_COLS; c++) {
      if (!b.hLines[r][c]) lines.push({ type: "h", row: r, col: c });
    }
  }
  for (let r = 0; r < BOX_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (!b.vLines[r][c]) lines.push({ type: "v", row: r, col: c });
    }
  }
  return lines;
}

function countBoxes(b: BoardState, player: Owner): number {
  let count = 0;
  for (let r = 0; r < BOX_ROWS; r++) {
    for (let c = 0; c < BOX_COLS; c++) {
      if (b.boxes[r][c] === player) count++;
    }
  }
  return count;
}

function allBoxesFilled(b: BoardState): boolean {
  for (let r = 0; r < BOX_ROWS; r++) {
    for (let c = 0; c < BOX_COLS; c++) {
      if (b.boxes[r][c] === 0) return false;
    }
  }
  return true;
}

// =============================================================================
// AI Logic — Greedy strategy
// Priority:
//   1. Complete a box (4th side)
//   2. Play a safe line (doesn't give opponent a box, i.e., don't make 3rd side)
//   3. If forced, play the line that gives away the fewest boxes
// =============================================================================

function getAIMove(
  b: BoardState,
): { type: "h" | "v"; row: number; col: number } | null {
  const available = getAvailableLines(b);
  if (available.length === 0) return null;

  // 1. Find any move that completes a box
  for (const line of available) {
    const test = cloneBoard(b);
    const completed = drawLine(test, line.type, line.row, line.col, 2);
    if (completed > 0) return line;
  }

  // 2. Find safe moves (don't create a 3-sided box for opponent)
  const safeMoves: typeof available = [];
  for (const line of available) {
    const test = cloneBoard(b);
    if (line.type === "h") {
      test.hLines[line.row][line.col] = true;
    } else {
      test.vLines[line.row][line.col] = true;
    }

    let createsThree = false;
    // Check adjacent boxes
    if (line.type === "h") {
      if (line.row > 0 && boxSideCount(test, line.row - 1, line.col) === 3)
        createsThree = true;
      if (line.row < BOX_ROWS && boxSideCount(test, line.row, line.col) === 3)
        createsThree = true;
    } else {
      if (line.col < BOX_COLS && boxSideCount(test, line.row, line.col) === 3)
        createsThree = true;
      if (line.col > 0 && boxSideCount(test, line.row, line.col - 1) === 3)
        createsThree = true;
    }

    if (!createsThree) safeMoves.push(line);
  }

  if (safeMoves.length > 0) {
    return safeMoves[Math.floor(Math.random() * safeMoves.length)];
  }

  // 3. All moves give away boxes — pick the one that gives away the fewest
  let bestLine = available[0];
  let bestGiveaway = Infinity;
  for (const line of available) {
    const test = cloneBoard(b);
    if (line.type === "h") {
      test.hLines[line.row][line.col] = true;
    } else {
      test.vLines[line.row][line.col] = true;
    }

    let giveaway = 0;
    if (line.type === "h") {
      if (line.row > 0 && boxSideCount(test, line.row - 1, line.col) === 3)
        giveaway++;
      if (line.row < BOX_ROWS && boxSideCount(test, line.row, line.col) === 3)
        giveaway++;
    } else {
      if (line.col < BOX_COLS && boxSideCount(test, line.row, line.col) === 3)
        giveaway++;
      if (line.col > 0 && boxSideCount(test, line.row, line.col - 1) === 3)
        giveaway++;
    }

    if (giveaway < bestGiveaway) {
      bestGiveaway = giveaway;
      bestLine = line;
    }
  }

  return bestLine;
}

// =============================================================================
// Component
// =============================================================================

export default function DotMatchGameScreen({
  navigation,
}: {
  navigation: any;
}) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("menu");
  const [gameMode, setGameMode] = useState<GameMode>("ai");
  const [board, setBoard] = useState<BoardState>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [linesDrawn, setLinesDrawn] = useState(0);

  const isGameOver = useMemo(
    () => allBoxesFilled(board) || linesDrawn >= TOTAL_LINES,
    [board, linesDrawn],
  );

  // Load personal best
  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, "dot_match" as any).then(
        setPersonalBest,
      );
    }
  }, [currentFirebaseUser]);

  const startGame = useCallback((mode: GameMode = "ai") => {
    setGameMode(mode);
    setBoard(createEmptyBoard());
    setCurrentPlayer(1);
    setPlayerScore(0);
    setAiScore(0);
    setLinesDrawn(0);
    setGameState("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const finishGame = useCallback(
    (pScore: number) => {
      setGameState("result");
      Haptics.notificationAsync(
        pScore > TOTAL_BOXES / 2
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );

      if (currentFirebaseUser && pScore > 0) {
        const newBest = !personalBest || pScore > personalBest.bestScore;
        recordGameSession(currentFirebaseUser.uid, {
          gameId: "dot_match" as any,
          score: pScore,
        }).then((session) => {
          if (session && newBest) {
            setPersonalBest({
              gameId: "dot_match" as any,
              bestScore: pScore,
              achievedAt: Date.now(),
            });
            showSuccess("🎉 New personal best!");
          }
        });
      }
    },
    [currentFirebaseUser, showSuccess],
  );

  // Process a single AI turn (may recurse via setTimeout if AI captures a box)
  const doAITurn = useCallback(
    (
      currentBoard: BoardState,
      pScore: number,
      aScore: number,
      drawn: number,
    ) => {
      const move = getAIMove(currentBoard);
      if (!move) return;

      const newBoard = cloneBoard(currentBoard);
      const completed = drawLine(newBoard, move.type, move.row, move.col, 2);
      const newDrawn = drawn + 1;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const newAiScore = aScore + completed;
      setBoard(newBoard);
      setAiScore(newAiScore);
      setLinesDrawn(newDrawn);

      if (allBoxesFilled(newBoard) || newDrawn >= TOTAL_LINES) {
        setPlayerScore(pScore);
        finishGame(pScore);
        return;
      }

      if (completed > 0) {
        // AI gets another turn
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTimeout(() => {
          doAITurn(newBoard, pScore, newAiScore, newDrawn);
        }, 400);
      } else {
        setCurrentPlayer(1);
      }
    },
    [finishGame],
  );

  const handleLinePress = useCallback(
    (type: "h" | "v", row: number, col: number) => {
      if (gameState !== "playing") return;
      // In AI mode, only player 1 can tap. In local mode, either player can tap.
      if (gameMode === "ai" && currentPlayer !== 1) return;
      if (isLineDrawn(board, type, row, col)) return;

      const newBoard = cloneBoard(board);
      const completed = drawLine(newBoard, type, row, col, currentPlayer);
      const newDrawn = linesDrawn + 1;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Update scores based on who played
      let newPlayerScore = playerScore;
      let newAiScore = aiScore;
      if (currentPlayer === 1) {
        newPlayerScore += completed;
        setPlayerScore(newPlayerScore);
      } else {
        newAiScore += completed;
        setAiScore(newAiScore);
      }

      setBoard(newBoard);
      setLinesDrawn(newDrawn);

      if (completed > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      if (allBoxesFilled(newBoard) || newDrawn >= TOTAL_LINES) {
        finishGame(newPlayerScore);
        return;
      }

      if (completed > 0) {
        // Current player gets another turn (completed a box)
        return;
      }

      // Switch players
      if (gameMode === "local") {
        // Local multiplayer: just switch turns
        setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      } else {
        // AI mode: switch to AI
        setCurrentPlayer(2);
        setTimeout(() => {
          doAITurn(newBoard, newPlayerScore, newAiScore, newDrawn);
        }, 500);
      }
    },
    [
      board,
      currentPlayer,
      gameState,
      gameMode,
      linesDrawn,
      playerScore,
      aiScore,
      finishGame,
      doAITurn,
    ],
  );

  const handleSendScorecard = useCallback(
    async (friendUid: string) => {
      if (!currentFirebaseUser || !profile) return;
      setIsSending(true);
      try {
        await sendScorecard(currentFirebaseUser.uid, friendUid, {
          gameId: "dot_match",
          score: playerScore,
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
    [currentFirebaseUser, profile, playerScore, showSuccess, showError],
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
            gameType: "dot_match",
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

  const resultTitle = useMemo(() => {
    if (playerScore > aiScore) {
      return gameMode === "local" ? "🎉 Player 1 Wins!" : "🎉 You Win!";
    }
    if (aiScore > playerScore) {
      return gameMode === "local" ? "🎉 Player 2 Wins!" : "AI Wins!";
    }
    return "It's a Draw!";
  }, [playerScore, aiScore, gameMode]);

  // ==========================================================================
  // Render
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
        <Text style={[styles.title, { color: colors.text }]}>Snap Dots</Text>
        <View style={{ width: 32 }} />
      </View>

      {gameState === "menu" ? (
        <View style={styles.menuContent}>
          <Text style={[styles.gameTitle, { color: colors.text }]}>
            🔵🔴 Snap Dots
          </Text>
          <Text style={[styles.instructions, { color: colors.textSecondary }]}>
            Draw lines between dots to complete boxes.{"\n"}Complete a box to
            claim it and get another turn!{"\n"}The player with the most boxes
            wins.
          </Text>
          {personalBest && (
            <Text style={[styles.bestScore, { color: colors.primary }]}>
              Personal Best: {personalBest.bestScore} boxes
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
          {/* Score bar */}
          <View style={styles.scoreBar}>
            <View style={styles.scoreItem}>
              <View
                style={[styles.scoreDot, { backgroundColor: PLAYER_COLORS[1] }]}
              />
              <Text style={[styles.scoreLabel, { color: colors.text }]}>
                {gameMode === "local" ? "P1" : "You"}: {playerScore}
              </Text>
            </View>
            {gameState === "playing" && (
              <Text style={[styles.turnText, { color: colors.textSecondary }]}>
                {gameMode === "local"
                  ? `Player ${currentPlayer}'s turn`
                  : currentPlayer === 1
                    ? "Your turn"
                    : "AI thinking..."}
              </Text>
            )}
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreLabel, { color: colors.text }]}>
                {gameMode === "local" ? "P2" : "AI"}: {aiScore}
              </Text>
              <View
                style={[styles.scoreDot, { backgroundColor: PLAYER_COLORS[2] }]}
              />
            </View>
          </View>

          {/* Board — absolute positioning for perfect alignment */}
          <View style={styles.boardContainer}>
            <View
              style={[
                styles.board,
                { width: BOARD_WIDTH, height: BOARD_HEIGHT },
              ]}
            >
              {/* 1. Box fills (behind everything) */}
              {Array.from({ length: BOX_ROWS }).map((_, boxRow) =>
                Array.from({ length: BOX_COLS }).map((_, boxCol) => {
                  const owner = board.boxes[boxRow][boxCol];
                  if (owner === 0) return null;
                  const left = boxCol * (DOT_SIZE + CELL_SPACING) + DOT_SIZE;
                  const top = boxRow * (DOT_SIZE + CELL_SPACING) + DOT_SIZE;
                  return (
                    <View
                      key={`box-${boxRow}-${boxCol}`}
                      style={[
                        styles.boxFill,
                        {
                          left,
                          top,
                          width: CELL_SPACING,
                          height: CELL_SPACING,
                          backgroundColor: PLAYER_COLORS[owner as 1 | 2] + "40",
                        },
                      ]}
                    >
                      <Text style={styles.boxOwnerText}>
                        {owner === 1 ? "🔵" : "🔴"}
                      </Text>
                    </View>
                  );
                }),
              )}

              {/* 2. Horizontal lines */}
              {Array.from({ length: GRID_ROWS }).map((_, dotRow) =>
                Array.from({ length: BOX_COLS }).map((_, dotCol) => {
                  const drawn = board.hLines[dotRow][dotCol];
                  const left = dotCol * (DOT_SIZE + CELL_SPACING) + DOT_SIZE;
                  const top =
                    dotRow * (DOT_SIZE + CELL_SPACING) +
                    DOT_SIZE / 2 -
                    LINE_THICKNESS / 2;
                  return (
                    <TouchableOpacity
                      key={`h-${dotRow}-${dotCol}`}
                      onPress={() => handleLinePress("h", dotRow, dotCol)}
                      disabled={
                        gameState !== "playing" ||
                        (gameMode === "ai" && currentPlayer !== 1) ||
                        drawn
                      }
                      style={[
                        styles.hLineTap,
                        {
                          left,
                          top:
                            dotRow * (DOT_SIZE + CELL_SPACING) +
                            DOT_SIZE / 2 -
                            H_LINE_TAP_HEIGHT / 2,
                          width: CELL_SPACING,
                          height: H_LINE_TAP_HEIGHT,
                        },
                      ]}
                      accessibilityLabel={`Horizontal line row ${dotRow} col ${dotCol}`}
                    >
                      <View
                        style={[
                          styles.hLine,
                          {
                            width: CELL_SPACING,
                            backgroundColor: drawn
                              ? getLineColor(board, "h", dotRow, dotCol)
                              : colors.textSecondary + "30",
                          },
                        ]}
                      />
                    </TouchableOpacity>
                  );
                }),
              )}

              {/* 3. Vertical lines */}
              {Array.from({ length: BOX_ROWS }).map((_, dotRow) =>
                Array.from({ length: GRID_COLS }).map((_, dotCol) => {
                  const drawn = board.vLines[dotRow][dotCol];
                  const left =
                    dotCol * (DOT_SIZE + CELL_SPACING) +
                    DOT_SIZE / 2 -
                    LINE_THICKNESS / 2;
                  const top = dotRow * (DOT_SIZE + CELL_SPACING) + DOT_SIZE;
                  return (
                    <TouchableOpacity
                      key={`v-${dotRow}-${dotCol}`}
                      onPress={() => handleLinePress("v", dotRow, dotCol)}
                      disabled={
                        gameState !== "playing" ||
                        (gameMode === "ai" && currentPlayer !== 1) ||
                        drawn
                      }
                      style={[
                        styles.vLineTap,
                        {
                          left:
                            dotCol * (DOT_SIZE + CELL_SPACING) +
                            DOT_SIZE / 2 -
                            V_LINE_TAP_WIDTH / 2,
                          top,
                          width: V_LINE_TAP_WIDTH,
                          height: CELL_SPACING,
                        },
                      ]}
                      accessibilityLabel={`Vertical line row ${dotRow} col ${dotCol}`}
                    >
                      <View
                        style={[
                          styles.vLine,
                          {
                            height: CELL_SPACING,
                            backgroundColor: drawn
                              ? getLineColor(board, "v", dotRow, dotCol)
                              : colors.textSecondary + "30",
                          },
                        ]}
                      />
                    </TouchableOpacity>
                  );
                }),
              )}

              {/* 4. Dots (on top of everything) */}
              {Array.from({ length: GRID_ROWS }).map((_, dotRow) =>
                Array.from({ length: GRID_COLS }).map((_, dotCol) => {
                  const left = dotCol * (DOT_SIZE + CELL_SPACING);
                  const top = dotRow * (DOT_SIZE + CELL_SPACING);
                  return (
                    <View
                      key={`dot-${dotRow}-${dotCol}`}
                      style={[
                        styles.dot,
                        {
                          left,
                          top,
                          backgroundColor: colors.text,
                        },
                      ]}
                    />
                  );
                }),
              )}
            </View>
          </View>
        </>
      )}

      {/* Result Dialog */}
      <Portal>
        <Dialog visible={gameState === "result"} dismissable={false}>
          <Dialog.Title>{resultTitle}</Dialog.Title>
          <Dialog.Content>
            <Text>
              {gameMode === "local"
                ? `P1: ${playerScore} ${playerScore === 1 ? "box" : "boxes"} vs P2: ${aiScore} ${aiScore === 1 ? "box" : "boxes"}`
                : `You captured ${playerScore} ${playerScore === 1 ? "box" : "boxes"} vs AI's ${aiScore}.`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setGameState("menu")}>Menu</Button>
            {playerScore > aiScore && (
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
        title="Invite to game Dots"
      />
    </View>
  );
}

// =============================================================================
// Helpers (render)
// =============================================================================

/**
 * Determine the color for a drawn line based on who most recently "owns"
 * adjacent completed boxes. Falls back to a neutral drawn-line color.
 */
function getLineColor(
  b: BoardState,
  type: "h" | "v",
  row: number,
  col: number,
): string {
  const adjacentOwners: Owner[] = [];

  if (type === "h") {
    if (row > 0 && b.boxes[row - 1][col] !== 0)
      adjacentOwners.push(b.boxes[row - 1][col]);
    if (row < BOX_ROWS && b.boxes[row][col] !== 0)
      adjacentOwners.push(b.boxes[row][col]);
  } else {
    if (col < BOX_COLS && b.boxes[row][col] !== 0)
      adjacentOwners.push(b.boxes[row][col]);
    if (col > 0 && b.boxes[row][col - 1] !== 0)
      adjacentOwners.push(b.boxes[row][col - 1]);
  }

  if (adjacentOwners.length > 0) {
    // Use the last owner color
    const owner = adjacentOwners[adjacentOwners.length - 1];
    return PLAYER_COLORS[owner as 1 | 2];
  }

  return "#888888"; // neutral gray for drawn but no adjacent box yet
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
    paddingBottom: 12,
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
    marginBottom: 16,
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
  scoreBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scoreItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  turnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  boardContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: BOARD_PADDING,
  },
  board: {
    position: "relative",
  },
  dot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    zIndex: 4,
  },
  hLineTap: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  hLine: {
    height: LINE_THICKNESS,
    borderRadius: LINE_THICKNESS / 2,
  },
  vLineTap: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  vLine: {
    width: LINE_THICKNESS,
    borderRadius: LINE_THICKNESS / 2,
  },
  boxFill: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    zIndex: 1,
  },
  boxOwnerText: {
    fontSize: 16,
  },
});



