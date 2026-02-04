/**
 * TicTacToeGameScreen
 *
 * Features:
 * - Real-time turn-based gameplay via Firestore
 * - Game invites and matchmaking
 * - Win/draw detection with visual feedback
 * - Animated cell placement
 * - Score tracking and rematch functionality
 *
 * @see docs/07_GAMES_ARCHITECTURE.md
 * @see src/types/turnBased.ts
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { Button, Modal, Portal, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import FriendPickerModal from "@/components/FriendPickerModal";
import SpectatorBanner from "@/components/games/SpectatorBanner";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useSpectatorMode } from "@/hooks/useSpectatorMode";
import { sendGameInvite } from "@/services/gameInvites";
import {
  endMatch,
  resignMatch,
  submitMove,
  subscribeToMatch,
} from "@/services/turnBasedGames";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import {
  createInitialTicTacToeBoard,
  TicTacToeBoard,
  TicTacToeCell,
  TicTacToeGameState,
  TicTacToeMatch,
  TicTacToeMove,
  TicTacToePosition,
} from "@/types/turnBased";
import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 48, 350);
const CELL_SIZE = BOARD_SIZE / 3;
const LINE_THICKNESS = 4;

// Winning line patterns (row, col indices)
const WINNING_LINES: TicTacToePosition[][] = [
  // Rows
  [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
  ],
  [
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
  ],
  [
    { row: 2, col: 0 },
    { row: 2, col: 1 },
    { row: 2, col: 2 },
  ],
  // Columns
  [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 2, col: 0 },
  ],
  [
    { row: 0, col: 1 },
    { row: 1, col: 1 },
    { row: 2, col: 1 },
  ],
  [
    { row: 0, col: 2 },
    { row: 1, col: 2 },
    { row: 2, col: 2 },
  ],
  // Diagonals
  [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 2 },
  ],
  [
    { row: 0, col: 2 },
    { row: 1, col: 1 },
    { row: 2, col: 0 },
  ],
];

// =============================================================================
// Types
// =============================================================================

interface TicTacToeGameScreenProps {
  navigation: any;
  route: {
    params?: {
      matchId?: string;
      inviteId?: string;
      /** Where the user entered from - determines back navigation */
      entryPoint?: "play" | "chat";
      /** Whether user is spectating (watching only) */
      spectatorMode?: boolean;
    };
  };
}

type GameMode = "menu" | "local" | "online" | "invite" | "waiting";

// =============================================================================
// Helper Functions
// =============================================================================

function checkWinner(board: TicTacToeBoard): {
  winner: TicTacToeCell;
  line: TicTacToePosition[] | null;
} {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const cellA = board[a.row][a.col];
    const cellB = board[b.row][b.col];
    const cellC = board[c.row][c.col];

    if (cellA && cellA === cellB && cellB === cellC) {
      return { winner: cellA, line };
    }
  }

  return { winner: null, line: null };
}

function isBoardFull(board: TicTacToeBoard): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

// =============================================================================
// Cell Component
// =============================================================================

interface CellProps {
  value: TicTacToeCell;
  onPress: () => void;
  disabled: boolean;
  isWinningCell: boolean;
  row: number;
  col: number;
}

function Cell({
  value,
  onPress,
  disabled,
  isWinningCell,
  row,
  col,
}: CellProps) {
  const theme = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (value) {
      // Entrance animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [value]);

  useEffect(() => {
    if (isWinningCell) {
      // Winning cell pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 1.1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [isWinningCell]);

  const borderStyle = {
    borderRightWidth: col < 2 ? LINE_THICKNESS : 0,
    borderBottomWidth: row < 2 ? LINE_THICKNESS : 0,
    borderColor: theme.colors.outline,
  };

  return (
    <TouchableOpacity
      style={[styles.cell, borderStyle]}
      onPress={onPress}
      disabled={disabled || value !== null}
      activeOpacity={0.7}
    >
      {value && (
        <Animated.View
          style={[
            styles.cellContent,
            {
              transform: [{ scale: scaleAnim }, { scale: bounceAnim }],
            },
          ]}
        >
          <Text
            style={[
              styles.cellText,
              {
                color:
                  value === "X" ? theme.colors.primary : theme.colors.error,
              },
            ]}
          >
            {value}
          </Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function TicTacToeGameScreen({
  navigation,
  route,
}: TicTacToeGameScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile: userProfile } = useUser();

  // Online game state (declared early for navigation hook)
  const [match, setMatch] = useState<TicTacToeMatch | null>(null);

  // Online game state
  const [matchId, setMatchId] = useState<string | null>(
    route.params?.matchId || null,
  );

  // Spectator mode hook
  const {
    isSpectator,
    spectatorCount,
    leaveSpectatorMode,
    loading: spectatorLoading,
  } = useSpectatorMode({
    matchId,
    inviteId: route.params?.inviteId,
    spectatorMode: route.params?.spectatorMode,
    userId: currentFirebaseUser?.uid,
    userName: currentFirebaseUser?.displayName || "Spectator",
  });

  // Game completion hook - integrates navigation (Phase 6) and achievements (Phase 7)
  const {
    exitGame,
    handleGameCompletion,
    notifications: achievementNotifications,
  } = useGameCompletion({
    match,
    currentUserId: currentFirebaseUser?.uid,
    gameType: "tic_tac_toe",
    entryPoint: route.params?.entryPoint,
  });

  // Game state
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const [board, setBoard] = useState<TicTacToeBoard>(
    createInitialTicTacToeBoard,
  );
  const [currentTurn, setCurrentTurn] = useState<"X" | "O">("X");
  const [winner, setWinner] = useState<TicTacToeCell>(null);
  const [winningLine, setWinningLine] = useState<TicTacToePosition[] | null>(
    null,
  );
  const [isDraw, setIsDraw] = useState(false);
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });

  const [mySymbol, setMySymbol] = useState<"X" | "O" | null>(null);
  const [opponentName, setOpponentName] = useState<string>("Opponent");
  const [player1Name, setPlayer1Name] = useState<string>("Player 1");
  const [player2Name, setPlayer2Name] = useState<string>("Player 2");

  // UI state
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Handle spectator leave
  const handleLeaveSpectator = useCallback(async () => {
    await leaveSpectatorMode();
    navigation.goBack();
  }, [leaveSpectatorMode, navigation]);

  // ==========================================================================
  // Online Game Subscription
  // ==========================================================================

  useEffect(() => {
    if (!matchId) return;

    const unsubscribe = subscribeToMatch(matchId, (updatedMatch) => {
      if (!updatedMatch) return;

      const typedMatch = updatedMatch as TicTacToeMatch;
      setMatch(typedMatch);

      // Update local state from match
      const gameState = typedMatch.gameState as TicTacToeGameState;

      setBoard(gameState.board);
      setCurrentTurn(gameState.currentTurn);

      // Track player names for spectators
      setPlayer1Name(typedMatch.players.player1.displayName);
      setPlayer2Name(typedMatch.players.player2.displayName);

      // Determine my symbol
      if (currentFirebaseUser) {
        if (typedMatch.players.player1.userId === currentFirebaseUser.uid) {
          setMySymbol("X");
          setOpponentName(typedMatch.players.player2.displayName);
        } else {
          setMySymbol("O");
          setOpponentName(typedMatch.players.player1.displayName);
        }
      }

      // Check for winner
      if (gameState.winner) {
        setWinner(gameState.winner === "draw" ? null : gameState.winner);
        setIsDraw(gameState.winner === "draw");
        setWinningLine(gameState.winningLine || null);
        setShowGameOverModal(true);
        Vibration.vibrate(
          gameState.winner === "draw" ? 100 : [0, 100, 50, 100],
        );

        // Phase 7: Check achievements on game completion
        handleGameCompletion(typedMatch as any);
      }
    });

    return () => unsubscribe();
  }, [matchId, currentFirebaseUser]);

  // Handle incoming match from route params
  useEffect(() => {
    if (route.params?.matchId) {
      setGameMode("online");
      setMatchId(route.params.matchId);
    }
  }, [route.params?.matchId]);

  // ==========================================================================
  // Game Logic
  // ==========================================================================

  const handleCellPress = useCallback(
    async (row: number, col: number) => {
      // Block interactions in spectator mode
      if (isSpectator) {
        return;
      }

      if (winner || isDraw || board[row][col]) {
        return;
      }

      // Online mode
      if (gameMode === "online" && match && matchId && currentFirebaseUser) {
        // Check if it's my turn
        if (match.currentTurn !== currentFirebaseUser.uid) {
          return;
        }
        const newBoard = board.map((r, ri) =>
          r.map((c, ci) => (ri === row && ci === col ? currentTurn : c)),
        );

        // Check for winner
        const { winner: newWinner, line } = checkWinner(newBoard);
        const boardIsFull = isBoardFull(newBoard);

        // Determine next player
        const nextPlayerId =
          match.players.player1.userId === currentFirebaseUser.uid
            ? match.players.player2.userId
            : match.players.player1.userId;

        const newGameState: TicTacToeGameState = {
          board: newBoard,
          currentTurn: currentTurn === "X" ? "O" : "X",
          winner: newWinner || (boardIsFull ? "draw" : null),
          winningLine: line || undefined,
        };

        const move: TicTacToeMove = {
          position: { row, col },
          symbol: currentTurn,
          timestamp: Date.now(),
        };

        try {
          await submitMove(matchId, move, newGameState, nextPlayerId);

          // End game if there's a winner or draw
          if (newWinner || boardIsFull) {
            let winnerId: string | null = null;
            if (newWinner === "X") {
              winnerId = match.players.player1.userId;
            } else if (newWinner === "O") {
              winnerId = match.players.player2.userId;
            }
            await endMatch(matchId, winnerId, "normal");
          }
        } catch (error) {
          console.error("[TicTacToe] Error submitting move:", error);
        }
        return;
      }

      // Local mode
      if (gameMode === "local") {
        const newBoard = board.map((r, ri) =>
          r.map((c, ci) => (ri === row && ci === col ? currentTurn : c)),
        );
        setBoard(newBoard);

        Vibration.vibrate(10);

        // Check for winner
        const { winner: newWinner, line } = checkWinner(newBoard);

        if (newWinner) {
          setWinner(newWinner);
          setWinningLine(line);
          setScores((prev) => ({
            ...prev,
            [newWinner]: prev[newWinner as "X" | "O"] + 1,
          }));
          setShowGameOverModal(true);
          Vibration.vibrate([0, 100, 50, 100]);
          return;
        }

        // Check for draw
        if (isBoardFull(newBoard)) {
          setIsDraw(true);
          setScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
          setShowGameOverModal(true);
          Vibration.vibrate(100);
          return;
        }

        // Switch turns
        setCurrentTurn(currentTurn === "X" ? "O" : "X");
      }
    },
    [
      board,
      currentTurn,
      winner,
      isDraw,
      gameMode,
      match,
      matchId,
      currentFirebaseUser,
    ],
  );

  // ==========================================================================
  // Game Actions
  // ==========================================================================

  const resetGame = () => {
    setBoard(createInitialTicTacToeBoard());
    setCurrentTurn("X");
    setWinner(null);
    setWinningLine(null);
    setIsDraw(false);
    setShowGameOverModal(false);
  };

  const startLocalGame = () => {
    setGameMode("local");
    resetGame();
    setScores({ X: 0, O: 0, draws: 0 });
  };

  const handleInviteFriend = () => {
    setShowFriendPicker(true);
  };

  const handleSelectFriend = async (friend: {
    friendUid: string;
    displayName: string;
  }) => {
    setShowFriendPicker(false);
    if (!currentFirebaseUser || !userProfile) return;

    setLoading(true);
    try {
      await sendGameInvite(
        currentFirebaseUser.uid,
        userProfile.displayName || "Player",
        userProfile.avatarConfig
          ? JSON.stringify(userProfile.avatarConfig)
          : undefined,
        {
          gameType: "tic_tac_toe",
          recipientId: friend.friendUid,
          recipientName: friend.displayName,
          settings: {
            isRated: false,
            chatEnabled: false,
          },
        },
      );

      Alert.alert(
        "Invite Sent!",
        `Game invite sent to ${friend.displayName}. You'll be notified when they respond.`,
      );
    } catch (error) {
      console.error("[TicTacToe] Error sending invite:", error);
      Alert.alert("Error", "Failed to send game invite. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResign = async () => {
    if (!matchId || !currentFirebaseUser) return;

    Alert.alert(
      "Resign Game",
      "Are you sure you want to resign? Your opponent will win.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resign",
          style: "destructive",
          onPress: async () => {
            try {
              await resignMatch(matchId, currentFirebaseUser.uid);
              exitGame();
            } catch (error) {
              console.error("[TicTacToe] Error resigning:", error);
            }
          },
        },
      ],
    );
  };

  const handlePlayAgain = () => {
    if (gameMode === "local") {
      resetGame();
    } else {
      // For online, need to send a rematch invite
      setShowGameOverModal(false);
      exitGame();
    }
  };

  const handleGoBack = () => {
    // Allow users to leave active games without resigning
    // They can return to continue playing at their own pace
    exitGame();
  };

  // ==========================================================================
  // Render Helpers
  // ==========================================================================

  const isMyTurn = () => {
    if (gameMode === "local") return true;
    if (gameMode === "online" && match && currentFirebaseUser) {
      return match.currentTurn === currentFirebaseUser.uid;
    }
    return false;
  };

  const getStatusText = () => {
    if (winner) {
      if (gameMode === "online") {
        const winnerIsMe =
          (winner === "X" && mySymbol === "X") ||
          (winner === "O" && mySymbol === "O");
        return winnerIsMe ? "You Win! 🎉" : "You Lose 😔";
      }
      return `${winner} Wins!`;
    }
    if (isDraw) return "It's a Draw!";

    if (gameMode === "online") {
      return isMyTurn() ? "Your Turn" : `${opponentName}'s Turn`;
    }
    return `${currentTurn}'s Turn`;
  };

  const isWinningCell = (row: number, col: number): boolean => {
    if (!winningLine) return false;
    return winningLine.some((pos) => pos.row === row && pos.col === col);
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  // Menu Screen
  if (gameMode === "menu") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => exitGame()}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={28}
              color={theme.colors.onBackground}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>
            Tic-Tac-Toe
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.menuContent}>
          <Text style={[styles.menuEmoji]}>❌⭕</Text>
          <Text
            style={[
              styles.menuSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Classic game of X's and O's
          </Text>

          <View style={styles.menuButtons}>
            <Button
              mode="contained"
              onPress={startLocalGame}
              style={styles.menuButton}
              contentStyle={styles.menuButtonContent}
              icon="account-multiple"
            >
              Play Local (2 Players)
            </Button>

            <Button
              mode="contained-tonal"
              onPress={handleInviteFriend}
              style={styles.menuButton}
              contentStyle={styles.menuButtonContent}
              icon="account-plus"
              loading={loading}
            >
              Invite a Friend
            </Button>
          </View>
        </View>

        <FriendPickerModal
          visible={showFriendPicker}
          onDismiss={() => setShowFriendPicker(false)}
          onSelectFriend={handleSelectFriend}
          title="Challenge a Friend"
          currentUserId={currentFirebaseUser?.uid || ""}
        />
      </SafeAreaView>
    );
  }

  // Game Screen
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Spectator Banner */}
      <SpectatorBanner
        isSpectator={isSpectator}
        spectatorCount={spectatorCount}
        onLeave={handleLeaveSpectator}
        playerNames={[player1Name, player2Name]}
        loading={spectatorLoading}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={28}
            color={theme.colors.onBackground}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Tic-Tac-Toe
        </Text>
        {gameMode === "online" && match?.status === "active" && !isSpectator ? (
          <TouchableOpacity onPress={handleResign}>
            <MaterialCommunityIcons
              name="flag"
              size={24}
              color={theme.colors.error}
            />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {/* Scoreboard */}
      <View
        style={[
          styles.scoreboard,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreSymbol, { color: theme.colors.primary }]}>
            X
          </Text>
          <Text
            style={[styles.scoreName, { color: theme.colors.onSurfaceVariant }]}
          >
            {gameMode === "online" && mySymbol === "X"
              ? "You"
              : gameMode === "online"
                ? opponentName
                : "Player 1"}
          </Text>
          <Text style={[styles.scoreValue, { color: theme.colors.onSurface }]}>
            {scores.X}
          </Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreSymbol, { color: theme.colors.outline }]}>
            🤝
          </Text>
          <Text
            style={[styles.scoreName, { color: theme.colors.onSurfaceVariant }]}
          >
            Draws
          </Text>
          <Text style={[styles.scoreValue, { color: theme.colors.onSurface }]}>
            {scores.draws}
          </Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreSymbol, { color: theme.colors.error }]}>
            O
          </Text>
          <Text
            style={[styles.scoreName, { color: theme.colors.onSurfaceVariant }]}
          >
            {gameMode === "online" && mySymbol === "O"
              ? "You"
              : gameMode === "online"
                ? opponentName
                : "Player 2"}
          </Text>
          <Text style={[styles.scoreValue, { color: theme.colors.onSurface }]}>
            {scores.O}
          </Text>
        </View>
      </View>

      {/* Turn Indicator */}
      <View style={styles.turnIndicator}>
        <Text
          style={[
            styles.turnText,
            {
              color:
                winner || isDraw
                  ? theme.colors.primary
                  : isMyTurn()
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant,
            },
          ]}
        >
          {getStatusText()}
        </Text>
      </View>

      {/* Game Board */}
      <View
        style={[
          styles.boardContainer,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={styles.board}>
          {board.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((cell, colIndex) => (
                <Cell
                  key={`${rowIndex}-${colIndex}`}
                  value={cell}
                  onPress={() => handleCellPress(rowIndex, colIndex)}
                  disabled={
                    !!winner || isDraw || (gameMode === "online" && !isMyTurn())
                  }
                  isWinningCell={isWinningCell(rowIndex, colIndex)}
                  row={rowIndex}
                  col={colIndex}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Game Over Modal */}
      <Portal>
        <Modal
          visible={showGameOverModal}
          onDismiss={() => setShowGameOverModal(false)}
          contentContainerStyle={[
            styles.modalContent,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
            {winner
              ? gameMode === "online"
                ? (winner === "X" && mySymbol === "X") ||
                  (winner === "O" && mySymbol === "O")
                  ? "🎉 Victory!"
                  : "😔 Defeat"
                : `${winner} Wins!`
              : "🤝 Draw!"}
          </Text>

          {winner && (
            <Text style={[styles.modalEmoji]}>
              {winner === "X" ? "❌" : "⭕"}
            </Text>
          )}

          <View style={styles.modalButtons}>
            <Button
              mode="contained"
              onPress={handlePlayAgain}
              style={styles.modalButton}
            >
              {gameMode === "local" ? "Play Again" : "Back to Menu"}
            </Button>
            <Button
              mode="outlined"
              onPress={() => {
                setShowGameOverModal(false);
                setGameMode("menu");
                resetGame();
              }}
              style={styles.modalButton}
            >
              Main Menu
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Local Game Controls */}
      {gameMode === "local" && !winner && !isDraw && (
        <View style={styles.controls}>
          <Button
            mode="outlined"
            onPress={() => {
              setGameMode("menu");
              resetGame();
            }}
            compact
          >
            End Game
          </Button>
        </View>
      )}
    </SafeAreaView>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  menuContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  menuEmoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  menuSubtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  menuButtons: {
    width: "100%",
    gap: Spacing.md,
  },
  menuButton: {
    borderRadius: BorderRadius.md,
  },
  menuButtonContent: {
    paddingVertical: Spacing.xs,
  },
  scoreboard: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  scoreItem: {
    alignItems: "center",
    minWidth: 80,
  },
  scoreSymbol: {
    fontSize: 28,
    fontWeight: "bold",
  },
  scoreName: {
    fontSize: 12,
    marginTop: 2,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 4,
  },
  turnIndicator: {
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  turnText: {
    fontSize: 24,
    fontWeight: "600",
  },
  boardContainer: {
    alignSelf: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
  },
  row: {
    flexDirection: "row",
    height: CELL_SIZE,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  cellContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  cellText: {
    fontSize: 64,
    fontWeight: "bold",
  },
  controls: {
    marginTop: Spacing.xl,
    alignItems: "center",
  },
  modalContent: {
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: Spacing.md,
  },
  modalEmoji: {
    fontSize: 80,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    width: "100%",
    gap: Spacing.sm,
  },
  modalButton: {
    borderRadius: BorderRadius.md,
  },
});
