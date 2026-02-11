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
import React, { useCallback, useEffect, useState } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Alert,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { Button, Modal, Portal, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import FriendPickerModal from "@/components/FriendPickerModal";
import { SkiaCellHighlight } from "@/components/games/graphics/SkiaCellHighlight";
import { SkiaGameBoard } from "@/components/games/graphics/SkiaGameBoard";
import { SkiaTicTacToePieces } from "@/components/games/graphics/SkiaTicTacToePieces";
import { SkiaWinLine } from "@/components/games/graphics/SkiaWinLine";
import { SpectatorBanner } from "@/components/games/SpectatorBanner";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import {
  DrawOfferDialog,
  GameActionBar,
  ResignConfirmDialog,
  TurnBasedCountdownOverlay,
  TurnBasedGameOverOverlay,
  TurnBasedReconnectingOverlay,
  TurnBasedWaitingOverlay,
  TurnIndicatorBar,
} from "@/components/games/TurnBasedOverlay";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useSpectator } from "@/hooks/useSpectator";
import { useTurnBasedGame } from "@/hooks/useTurnBasedGame";
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
import { BorderRadius, Spacing } from "@/constants/theme";


import { createLogger } from "@/utils/log";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameHaptics } from "@/hooks/useGameHaptics";
const logger = createLogger("screens/games/TicTacToeGameScreen");
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
      spectatorMode?: boolean;
    };
  };
}

type GameMode = "menu" | "local" | "online" | "colyseus" | "invite" | "waiting";

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
  const scale = useSharedValue(0);
  const bounce = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { scale: bounce.value }],
  }));

  useEffect(() => {
    if (value) {
      // Entrance animation
      scale.value = withSequence(
        withTiming(1.2, { duration: 150 }),
        withSpring(1, {
          damping: 12,
          stiffness: 220,
        }),
      );
    } else {
      cancelAnimation(scale);
      scale.value = 0;
    }

    return () => {
      cancelAnimation(scale);
    };
  }, [value, scale]);

  useEffect(() => {
    if (isWinningCell) {
      // Winning cell pulse
      bounce.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 300 }),
          withTiming(1, { duration: 300 }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(bounce);
      bounce.value = 1;
    }

    return () => {
      cancelAnimation(bounce);
    };
  }, [isWinningCell, bounce]);

  const borderStyle = {
    borderRightWidth: col < 2 ? LINE_THICKNESS : 0,
    borderBottomWidth: row < 2 ? LINE_THICKNESS : 0,
    borderColor: "rgba(255,255,255,0.15)",
  };

  return (
    <TouchableOpacity
      style={[styles.cell, borderStyle]}
      onPress={onPress}
      disabled={disabled || value !== null}
      activeOpacity={0.7}
    >
      {/* Winning cell glow highlight */}
      {isWinningCell && (
        <SkiaCellHighlight
          width={CELL_SIZE}
          height={CELL_SIZE}
          type="winning"
        />
      )}
      {value && (
        <Animated.View style={[styles.cellContent, animatedStyle]}>
          <SkiaTicTacToePieces value={value} size={CELL_SIZE * 0.7} />
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function TicTacToeGameScreen({
  navigation,
  route,
}: TicTacToeGameScreenProps) {
  useGameBackHandler({ gameType: "tic_tac_toe", isGameOver: false });
  const __codexGameHaptics = useGameHaptics();
  void __codexGameHaptics;

  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile: userProfile } = useUser();

  // Online game state (declared early for navigation hook)
  const [match, setMatch] = useState<TicTacToeMatch | null>(null);

  const isSpectator = route.params?.spectatorMode === true;

  // Online game state
  const [matchId, setMatchId] = useState<string | null>(
    route.params?.matchId || null,
  );

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
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  // Colyseus multiplayer hook
  const mp = useTurnBasedGame("tic_tac_toe_game");
  const spectatorSession = useSpectator({
    mode: "multiplayer-spectator",
    room: mp.room,
    state: mp.rawState,
  });
  const spectatorCount = spectatorSession.spectatorCount || mp.spectatorCount;

  // Derive Colyseus board as 2D array for rendering
  const colyseusBoard: TicTacToeBoard | null =
    mp.isMultiplayer && mp.board.length === 9
      ? [
          [
            mp.board[0] === 0 ? null : mp.board[0] === 1 ? "X" : "O",
            mp.board[1] === 0 ? null : mp.board[1] === 1 ? "X" : "O",
            mp.board[2] === 0 ? null : mp.board[2] === 1 ? "X" : "O",
          ],
          [
            mp.board[3] === 0 ? null : mp.board[3] === 1 ? "X" : "O",
            mp.board[4] === 0 ? null : mp.board[4] === 1 ? "X" : "O",
            mp.board[5] === 0 ? null : mp.board[5] === 1 ? "X" : "O",
          ],
          [
            mp.board[6] === 0 ? null : mp.board[6] === 1 ? "X" : "O",
            mp.board[7] === 0 ? null : mp.board[7] === 1 ? "X" : "O",
            mp.board[8] === 0 ? null : mp.board[8] === 1 ? "X" : "O",
          ],
        ]
      : null;

  // Effective board — use Colyseus board when in multiplayer, else local
  const effectiveBoard =
    gameMode === "colyseus" && colyseusBoard ? colyseusBoard : board;

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
        handleGameCompletion(typedMatch as Parameters<typeof handleGameCompletion>[0]);
      }
    });

    return () => unsubscribe();
  }, [matchId, currentFirebaseUser]);

  // Handle incoming match from route params — smart switch for Colyseus vs Firestore
  const { resolvedMode, firestoreGameId } = useGameConnection(
    "tic_tac_toe_game",
    route.params?.matchId,
  );

  useEffect(() => {
    if (resolvedMode === "colyseus" && firestoreGameId) {
      setGameMode("colyseus");
      mp.startMultiplayer({ firestoreGameId, spectator: isSpectator });
    } else if (resolvedMode === "online" && firestoreGameId) {
      setGameMode("online");
      setMatchId(firestoreGameId);
    }
  }, [resolvedMode, firestoreGameId]);

  // ==========================================================================
  // Game Logic
  // ==========================================================================

  const handleCellPress = useCallback(
    async (row: number, col: number) => {
      // Block spectator input
      if (isSpectator) return;

      if (winner || isDraw || board[row][col]) {
        return;
      }

      // Colyseus multiplayer mode
      if (gameMode === "colyseus" && mp.isMultiplayer) {
        if (!mp.isMyTurn || mp.phase !== "playing") return;
        mp.sendMove({ row, col });
        Vibration.vibrate(10);
        return;
      }

      // Legacy Firestore online mode
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
          logger.error("[TicTacToe] Error submitting move:", error);
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
      logger.error("[TicTacToe] Error sending invite:", error);
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
              logger.error("[TicTacToe] Error resigning:", error);
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
    if (gameMode === "colyseus") return mp.isMyTurn;
    if (gameMode === "online" && match && currentFirebaseUser) {
      return match.currentTurn === currentFirebaseUser.uid;
    }
    return false;
  };

  const getStatusText = () => {
    if (gameMode === "colyseus" && mp.isMultiplayer) {
      if (mp.phase === "waiting") return "Waiting...";
      if (mp.phase === "countdown") return "Get Ready!";
      if (mp.phase === "finished") {
        if (mp.isDraw) return "It's a Draw!";
        return mp.isWinner ? "You Win! 🎉" : "You Lose 😔";
      }
      return mp.isMyTurn ? "Your Turn" : `${mp.opponentName}'s Turn`;
    }
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
      {isSpectator && (
        <SpectatorBanner
          spectatorCount={spectatorCount}
          onLeave={() => {
            mp.cancelMultiplayer();
            navigation.goBack();
          }}
        />
      )}

      {!isSpectator && mp.isMultiplayer && spectatorCount > 0 && (
        <SpectatorOverlay spectatorCount={spectatorCount} />
      )}

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

      {/* Game Board — Skia gradient background */}
      <SkiaGameBoard
        width={BOARD_SIZE}
        height={BOARD_SIZE}
        borderRadius={BorderRadius.lg}
        gradientColors={["#2A2A3E", "#1E1E30", "#16162A"]}
        borderColor="rgba(255,255,255,0.1)"
        borderWidth={2}
        innerShadowBlur={10}
      >
        <View style={styles.board}>
          {effectiveBoard.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((cell, colIndex) => (
                <Cell
                  key={`${rowIndex}-${colIndex}`}
                  value={cell}
                  onPress={() => handleCellPress(rowIndex, colIndex)}
                  disabled={
                    !!winner ||
                    isDraw ||
                    (gameMode === "online" && !isMyTurn()) ||
                    (gameMode === "colyseus" &&
                      (!mp.isMyTurn || mp.phase !== "playing"))
                  }
                  isWinningCell={isWinningCell(rowIndex, colIndex)}
                  row={rowIndex}
                  col={colIndex}
                />
              ))}
            </View>
          ))}
        </View>
        {/* Animated win line overlay */}
        {winningLine && (
          <SkiaWinLine
            width={BOARD_SIZE}
            height={BOARD_SIZE}
            x1={winningLine[0].col * CELL_SIZE + CELL_SIZE / 2}
            y1={winningLine[0].row * CELL_SIZE + CELL_SIZE / 2}
            x2={winningLine[2].col * CELL_SIZE + CELL_SIZE / 2}
            y2={winningLine[2].row * CELL_SIZE + CELL_SIZE / 2}
            strokeWidth={6}
            duration={400}
          />
        )}
      </SkiaGameBoard>

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

      {/* Colyseus Multiplayer — Turn Indicator Bar */}
      {gameMode === "colyseus" &&
        mp.isMultiplayer &&
        mp.phase === "playing" && (
          <TurnIndicatorBar
            isMyTurn={mp.isMyTurn}
            myName={mp.myName}
            opponentName={mp.opponentName}
            currentPlayerIndex={mp.currentPlayerIndex}
            myPlayerIndex={mp.myPlayerIndex}
            turnNumber={mp.turnNumber}
            opponentDisconnected={mp.opponentDisconnected}
            colors={{
              primary: theme.colors.primary,
              background: theme.colors.background,
              surface: theme.colors.surface,
              text: theme.colors.onBackground,
              textSecondary: theme.colors.onSurfaceVariant,
              border: theme.colors.outlineVariant,
              player1: theme.colors.primary,
              player2: theme.colors.error,
            }}
            player1Label="X"
            player2Label="O"
          />
        )}

      {/* Colyseus Multiplayer — Game Action Bar */}
      {gameMode === "colyseus" &&
        mp.isMultiplayer &&
        mp.phase === "playing" &&
        !isSpectator && (
          <GameActionBar
            onResign={() => setShowResignConfirm(true)}
            onOfferDraw={mp.offerDraw}
            isMyTurn={mp.isMyTurn}
            drawPending={mp.drawPending}
            colors={{
              primary: theme.colors.primary,
              background: theme.colors.background,
              surface: theme.colors.surface,
              text: theme.colors.onBackground,
              textSecondary: theme.colors.onSurfaceVariant,
              border: theme.colors.outlineVariant,
            }}
          />
        )}

      {/* Colyseus Multiplayer Overlays */}
      {gameMode === "colyseus" && (
        <>
          <TurnBasedWaitingOverlay
            colors={{
              primary: theme.colors.primary,
              background: theme.colors.background,
              surface: theme.colors.surface,
              text: theme.colors.onBackground,
              textSecondary: theme.colors.onSurfaceVariant,
              border: theme.colors.outlineVariant,
            }}
            onCancel={() => {
              mp.cancelMultiplayer();
              setGameMode("menu");
            }}
            gameName="Tic-Tac-Toe"
            visible={mp.phase === "waiting" || mp.phase === "connecting"}
          />

          <TurnBasedCountdownOverlay
            countdown={mp.countdown}
            colors={{
              primary: theme.colors.primary,
              background: theme.colors.background,
              surface: theme.colors.surface,
              text: theme.colors.onBackground,
              textSecondary: theme.colors.onSurfaceVariant,
              border: theme.colors.outlineVariant,
            }}
            visible={mp.phase === "countdown"}
          />

          <TurnBasedReconnectingOverlay
            colors={{
              primary: theme.colors.primary,
              background: theme.colors.background,
              surface: theme.colors.surface,
              text: theme.colors.onBackground,
              textSecondary: theme.colors.onSurfaceVariant,
              border: theme.colors.outlineVariant,
            }}
            visible={mp.phase === "reconnecting"}
          />

          <TurnBasedGameOverOverlay
            isWinner={mp.isWinner}
            isDraw={mp.isDraw}
            winnerName={mp.winnerName}
            winReason={mp.winReason}
            myName={mp.myName}
            opponentName={mp.opponentName}
            rematchRequested={mp.rematchRequested}
            colors={{
              primary: theme.colors.primary,
              background: theme.colors.background,
              surface: theme.colors.surface,
              text: theme.colors.onBackground,
              textSecondary: theme.colors.onSurfaceVariant,
              border: theme.colors.outlineVariant,
            }}
            onRematch={mp.requestRematch}
            onAcceptRematch={mp.acceptRematch}
            onMenu={() => {
              mp.cancelMultiplayer();
              setGameMode("menu");
            }}
            visible={mp.phase === "finished"}
          />

          <DrawOfferDialog
            visible={mp.drawPending}
            opponentName={mp.opponentName}
            isMyOffer={mp.drawOfferedByMe}
            colors={{
              primary: theme.colors.primary,
              background: theme.colors.background,
              surface: theme.colors.surface,
              text: theme.colors.onBackground,
              textSecondary: theme.colors.onSurfaceVariant,
              border: theme.colors.outlineVariant,
            }}
            onAccept={mp.acceptDraw}
            onDecline={mp.declineDraw}
          />

          <ResignConfirmDialog
            visible={showResignConfirm}
            colors={{
              primary: theme.colors.primary,
              background: theme.colors.background,
              surface: theme.colors.surface,
              text: theme.colors.onBackground,
              textSecondary: theme.colors.onSurfaceVariant,
              border: theme.colors.outlineVariant,
            }}
            onConfirm={() => {
              setShowResignConfirm(false);
              mp.resign();
            }}
            onCancel={() => setShowResignConfirm(false)}
          />
        </>
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
    position: "relative",
  },
  cellContent: {
    justifyContent: "center",
    alignItems: "center",
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

export default withGameErrorBoundary(TicTacToeGameScreen, "tic_tac_toe");
