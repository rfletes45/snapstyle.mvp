/**
 * CheckersGameScreen
 *
 * Features:
 * - Real-time turn-based gameplay via Firestore
 * - Complete checkers rules (jumps, multi-jumps, kinging)
 * - Game invites and matchmaking
 * - Animated piece movement and captures
 * - King promotion with visual feedback
 *
 * @see docs/07_GAMES_ARCHITECTURE.md
 * @see src/types/turnBased.ts
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import InvitePickerModal, {
  type FriendItem,
  type GroupItem,
} from "@/components/InvitePickerModal";
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
import { SkiaCellHighlight } from "@/components/games/graphics/SkiaCellHighlight";
import { SkiaCheckersPiece } from "@/components/games/graphics/SkiaCheckersPiece";
import { SkiaGameBoard } from "@/components/games/graphics/SkiaGameBoard";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useSpectator } from "@/hooks/useSpectator";
import { useTurnBasedGame } from "@/hooks/useTurnBasedGame";
import { onGameResultNotification } from "@/services/gameResultEvents";
import {
  buildGameResultEvent,
  submitGameResult,
} from "@/services/gameResultService";
import { getGroupMembers } from "@/services/groups";
import {
  endMatch,
  resignMatch,
  submitMove,
  subscribeToMatch,
} from "@/services/turnBasedGames";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import {
  CheckersBoard,
  CheckersGameState,
  CheckersMatch,
  CheckersMove,
  CheckersPiece,
  CheckersPosition,
  createInitialCheckersBoard,
} from "@/types/turnBased";

import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { MultiplayerLobbyOverlay } from "@/components/games/MultiplayerLobbyOverlay";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameLobbyController } from "@/hooks/useGameLobbyController";
import {
  useMultiplayerRuntime,
  withMultiplayerRuntime,
} from "@/screens/games/MultiplayerRuntimeShell";
import type { GameResultFacts } from "@/types/gameResultFacts";
import { createLogger } from "@/utils/log";
const logger = createLogger("screens/games/CheckersGameScreen");
// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 32, 380);
const CELL_SIZE = BOARD_SIZE / 8;
const PIECE_SIZE = CELL_SIZE * 0.75;

// Colors
const LIGHT_SQUARE = "#F0D9B5";
const DARK_SQUARE = "#B58863";
const RED_PIECE = "#CC3333";
const RED_PIECE_DARK = "#992222";
const BLACK_PIECE = "#333333";
const BLACK_PIECE_DARK = "#111111";
const SELECTED_HIGHLIGHT = "rgba(255, 255, 0, 0.5)";
const VALID_MOVE_HIGHLIGHT = "rgba(0, 255, 0, 0.4)";

// =============================================================================
// Types
// =============================================================================

interface CheckersGameScreenProps {
  navigation: any;
  route: {
    params?: {
      matchId?: string;
      inviteId?: string;
      /** Where the user entered from - determines back navigation */
      entryPoint?: "play" | "chat";
      spectatorMode?: boolean;
      /** v3 session fields */
      v3Session?: string;
      sessionId?: string;
      firestoreGameId?: string;
    };
  };
}

type GameMode = "menu" | "lobby" | "local" | "online" | "colyseus" | "waiting";

interface ValidMove {
  to: CheckersPosition;
  captures: CheckersPosition[];
  isJump: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getValidMoves(
  board: CheckersBoard,
  from: CheckersPosition,
  mustJump: boolean,
): ValidMove[] {
  const piece = board[from.row][from.col];
  if (!piece) return [];

  const moves: ValidMove[] = [];
  const jumpMoves: ValidMove[] = [];

  // Direction based on color (red moves down, black moves up)
  const directions = piece.isKing
    ? [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]
    : piece.color === "red"
      ? [
          [1, -1],
          [1, 1],
        ]
      : [
          [-1, -1],
          [-1, 1],
        ];

  // Check for jumps first
  for (const [dr, dc] of directions) {
    const jumpRow = from.row + dr * 2;
    const jumpCol = from.col + dc * 2;
    const midRow = from.row + dr;
    const midCol = from.col + dc;

    if (
      jumpRow >= 0 &&
      jumpRow < 8 &&
      jumpCol >= 0 &&
      jumpCol < 8 &&
      board[midRow]?.[midCol] &&
      board[midRow][midCol]!.color !== piece.color &&
      !board[jumpRow][jumpCol]
    ) {
      jumpMoves.push({
        to: { row: jumpRow, col: jumpCol },
        captures: [{ row: midRow, col: midCol }],
        isJump: true,
      });
    }
  }

  // If there are jumps available, must take them
  if (jumpMoves.length > 0) {
    return jumpMoves;
  }

  // If mustJump is true globally but this piece has no jumps, return empty
  if (mustJump) {
    return [];
  }

  // Regular moves (only if no jumps required)
  for (const [dr, dc] of directions) {
    const newRow = from.row + dr;
    const newCol = from.col + dc;

    if (
      newRow >= 0 &&
      newRow < 8 &&
      newCol >= 0 &&
      newCol < 8 &&
      !board[newRow][newCol]
    ) {
      moves.push({
        to: { row: newRow, col: newCol },
        captures: [],
        isJump: false,
      });
    }
  }

  return moves;
}

function checkForJumps(board: CheckersBoard, color: "red" | "black"): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const moves = getValidMoves(board, { row, col }, false);
        if (moves.some((m) => m.isJump)) {
          return true;
        }
      }
    }
  }
  return false;
}

function canPlayerMove(board: CheckersBoard, color: "red" | "black"): boolean {
  const mustJump = checkForJumps(board, color);

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const moves = getValidMoves(board, { row, col }, mustJump);
        if (moves.length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

function countPieces(board: CheckersBoard): {
  red: number;
  black: number;
  redKings: number;
  blackKings: number;
} {
  let red = 0,
    black = 0,
    redKings = 0,
    blackKings = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        if (piece.color === "red") {
          red++;
          if (piece.isKing) redKings++;
        } else {
          black++;
          if (piece.isKing) blackKings++;
        }
      }
    }
  }

  return { red, black, redKings, blackKings };
}

// =============================================================================
// Piece Component
// =============================================================================

interface PieceComponentProps {
  piece: CheckersPiece;
  isSelected: boolean;
  size: number;
}

function PieceComponent({ piece, isSelected, size }: PieceComponentProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    if (isSelected) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 300 }),
          withTiming(1, { duration: 300 }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(scale);
      scale.value = 1;
    }

    return () => {
      cancelAnimation(scale);
    };
  }, [isSelected, scale]);

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
      <SkiaCheckersPiece
        size={size}
        color={piece.color === "red" ? "red" : "black"}
        isKing={piece.isKing}
        isSelected={isSelected}
      />
    </Animated.View>
  );
}

// =============================================================================
// Board Cell Component
// =============================================================================

interface CellComponentProps {
  row: number;
  col: number;
  piece: CheckersPiece | null;
  isSelected: boolean;
  isValidMove: boolean;
  isJumpMove: boolean;
  onPress: () => void;
  disabled: boolean;
}

function CellComponent({
  row,
  col,
  piece,
  isSelected,
  isValidMove,
  isJumpMove,
  onPress,
  disabled,
}: CellComponentProps) {
  const isDarkSquare = (row + col) % 2 === 1;
  const backgroundColor = isDarkSquare ? DARK_SQUARE : LIGHT_SQUARE;

  return (
    <TouchableOpacity
      style={[styles.cell, { backgroundColor }]}
      onPress={onPress}
      disabled={disabled && !isValidMove && !piece}
      activeOpacity={0.8}
    >
      {/* Skia-powered cell highlights */}
      {isSelected && (
        <SkiaCellHighlight
          width={CELL_SIZE}
          height={CELL_SIZE}
          type="selected"
        />
      )}
      {isValidMove && (
        <SkiaCellHighlight
          width={CELL_SIZE}
          height={CELL_SIZE}
          type={isJumpMove ? "capture" : "validMove"}
        />
      )}
      {piece && (
        <PieceComponent
          piece={piece}
          isSelected={isSelected}
          size={PIECE_SIZE}
        />
      )}
      {isValidMove && !piece && (
        <View
          style={[
            styles.validMoveIndicator,
            isJumpMove && styles.jumpMoveIndicator,
          ]}
        />
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function CheckersGameScreen({ navigation, route }: CheckersGameScreenProps) {
  const isV3 = !!route.params?.v3Session;
  const initialMode: GameMode = isV3
    ? "colyseus"
    : route.params?.inviteId
      ? "lobby"
      : "menu";
  const [gameMode, setGameMode] = useState<GameMode>(initialMode);

  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile: userProfile } = useUser();
  const isSpectator = route.params?.spectatorMode === true;

  // Online game state (declared early for navigation hook)
  const [match, setMatch] = useState<CheckersMatch | null>(null);

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
    gameType: "checkers",
    entryPoint: route.params?.entryPoint,
  });

  // Game state
  const [board, setBoard] = useState<CheckersBoard>(createInitialCheckersBoard);
  const [currentTurn, setCurrentTurn] = useState<"red" | "black">("red");
  const [selectedPiece, setSelectedPiece] = useState<CheckersPosition | null>(
    null,
  );
  const [validMoves, setValidMoves] = useState<ValidMove[]>([]);
  const [mustJump, setMustJump] = useState(false);
  const [multiJumpPiece, setMultiJumpPiece] = useState<CheckersPosition | null>(
    null,
  );

  // Game result
  const [winner, setWinner] = useState<"red" | "black" | null>(null);
  const [scores, setScores] = useState({ red: 0, black: 0 });

  const [myColor, setMyColor] = useState<"red" | "black" | null>(null);
  const [opponentName, setOpponentName] = useState<string>("Opponent");
  const [player1Name, setPlayer1Name] = useState<string>("Red");
  const [player2Name, setPlayer2Name] = useState<string>("Black");

  // UI state
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  // Back-handler wired AFTER showGameOverModal so isGameOver is reactive
  const { markAsLeaving } = useGameBackHandler({
    gameType: "checkers",
    isGameOver: showGameOverModal,
    isMultiplayer: gameMode === "online" || gameMode === "colyseus",
    isInLobby: gameMode === "lobby" && !isV3,
    entryPoint: route.params?.entryPoint,
  });

  // XP state (populated via GameResult notification)
  const [xpEarned, setXpEarned] = useState(0);
  const [didLevelUp, setDidLevelUp] = useState(false);
  const [newXpLevel, setNewXpLevel] = useState(0);

  // Listen for game result notifications (XP + achievements)
  useEffect(() => {
    const unsub = onGameResultNotification((n) => {
      if (n.gameId === "checkers") {
        setXpEarned(n.xpEarned);
        setDidLevelUp(n.didLevelUp);
        setNewXpLevel(n.newLevel);
      }
    });
    return unsub;
  }, []);

  // Colyseus multiplayer hook (declared before lobby controller so room is available)
  const mp = useTurnBasedGame("checkers_game");

  // ── V3 Runtime Shell integration ──────────────────────────────────────
  const mpRuntime = useMultiplayerRuntime();

  const v3ResultSentRef = useRef(false);
  useEffect(() => {
    if (
      !isV3 ||
      !mpRuntime ||
      mp.phase !== "finished" ||
      v3ResultSentRef.current
    )
      return;
    v3ResultSentRef.current = true;

    const uid = currentFirebaseUser?.uid ?? "";
    const displayName = currentFirebaseUser?.displayName ?? "Player";
    const myOutcome = mp.isDraw ? "draw" : mp.isWinner ? "win" : "lose";

    const facts: GameResultFacts = {
      gameId: "checkers",
      mode: "turnBased",
      outcome: myOutcome as GameResultFacts["outcome"],
      outcomeReason:
        mp.winReason ??
        (mp.isDraw ? "Draw" : mp.isWinner ? "Victory" : "Defeat"),
      scoreboard: [
        {
          uid,
          displayName,
          outcome: myOutcome as GameResultFacts["outcome"],
          isWinner: !!mp.isWinner,
        },
        {
          uid: "opponent",
          displayName: mp.opponentName ?? "Opponent",
          outcome: (mp.isDraw
            ? "draw"
            : mp.isWinner
              ? "lose"
              : "win") as GameResultFacts["outcome"],
          isWinner: !mp.isWinner && !mp.isDraw,
        },
      ],
      performanceMetrics: [
        { label: "Turns", value: String(mp.turnNumber ?? 0), icon: "counter" },
      ],
      durationMs: 0,
      sessionId: route.params?.v3Session,
    };

    mpRuntime.setResultFacts(facts);
  }, [isV3, mpRuntime, mp.phase, mp.isWinner, mp.isDraw]);

  // ── Lobby Controller (composes useGameLobby + watchdog + recovery) ────
  const lobbyController = useGameLobbyController({
    gameType: "checkers",
    inviteId: route.params?.inviteId,
    entryPoint: route.params?.entryPoint,
    isTurnBased: true,
    onGameReady: (gameId: string) => {
      logger.info(`[Checkers] Lobby ready, gameId=${gameId}`);
      setGameMode("colyseus");
      mp.startMultiplayer({
        firestoreGameId: gameId,
        spectator: isSpectator,
        inviteId: route.params?.inviteId,
      });
    },
    onLeaveLobby: () => {
      setGameMode("menu");
    },
    // Bridge Colyseus room state into controller
    room: mp.room,
    roomPhase: mp.phase,
    roomReconnecting: mp.reconnecting,
    roomOpponentDisconnected: mp.opponentDisconnected,
    roomError: mp.error,
  });
  const spectatorSession = useSpectator({
    mode: "multiplayer-spectator",
    room: mp.room,
    state: mp.rawState,
  });
  const spectatorCount = spectatorSession.spectatorCount || mp.spectatorCount;

  // Derive Colyseus board as 2D CheckersBoard when in multiplayer
  // Server encoding: 0=empty, 1=red, 2=black, 3=red king, 4=black king
  const colyseusBoard: CheckersBoard | null =
    mp.isMultiplayer && mp.board.length === 64
      ? (Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 8 }, (_, col): CheckersPiece | null => {
            const v = mp.board[row * 8 + col];
            if (v === 0) return null;
            if (v === 1) return { color: "red", isKing: false };
            if (v === 2) return { color: "black", isKing: false };
            if (v === 3) return { color: "red", isKing: true };
            if (v === 4) return { color: "black", isKing: true };
            return null;
          }),
        ) as CheckersBoard)
      : null;

  // Effective board — use Colyseus board when in multiplayer, else local
  const effectiveBoard: CheckersBoard =
    gameMode === "colyseus" && colyseusBoard ? colyseusBoard : board;

  // Overlay colors for Colyseus overlays
  const overlayColors = {
    primary: theme.colors.primary,
    background: theme.colors.background,
    surface: theme.colors.surface,
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    border: theme.colors.outline,
    player1: RED_PIECE,
    player2: BLACK_PIECE,
  };

  // ==========================================================================
  // Online Game Subscription
  // ==========================================================================

  useEffect(() => {
    // Skip when lobby is handling the invite flow
    if (route.params?.inviteId) return;
    if (!matchId) return;

    const unsubscribe = subscribeToMatch(matchId, (updatedMatch) => {
      if (!updatedMatch) return;

      const typedMatch = updatedMatch as CheckersMatch;
      setMatch(typedMatch);

      // Update local state from match
      const gameState = typedMatch.gameState as CheckersGameState;
      setBoard(gameState.board);
      setCurrentTurn(gameState.currentTurn);
      setMustJump(gameState.mustJump);

      setPlayer1Name(typedMatch.players.player1.displayName);
      setPlayer2Name(typedMatch.players.player2.displayName);

      // Determine my color
      if (currentFirebaseUser) {
        if (typedMatch.players.player1.userId === currentFirebaseUser.uid) {
          setMyColor("red");
          setOpponentName(typedMatch.players.player2.displayName);
        } else {
          setMyColor("black");
          setOpponentName(typedMatch.players.player1.displayName);
        }
      }

      // Check for game over
      if (typedMatch.status === "completed" && typedMatch.winnerId) {
        const winnerColor =
          typedMatch.players.player1.userId === typedMatch.winnerId
            ? "red"
            : "black";
        setWinner(winnerColor);
        setShowGameOverModal(true);
        Vibration.vibrate([0, 100, 50, 100]);

        // Submit to XP pipeline
        if (currentFirebaseUser) {
          const didWin = typedMatch.winnerId === currentFirebaseUser.uid;
          submitGameResult(
            buildGameResultEvent({
              gameId: "checkers",
              mode: "turnBased",
              outcome: didWin ? "win" : "lose",
              score: 0,
              durationMs: 0,
              userId: currentFirebaseUser.uid,
              displayName: currentFirebaseUser.displayName || "Player",
            }),
          ).catch(() => {});
        }

        // Phase 7: Check achievements on game completion
        handleGameCompletion(
          typedMatch as Parameters<typeof handleGameCompletion>[0],
        );
      }
    });

    return () => unsubscribe();
  }, [matchId, currentFirebaseUser]);

  // Handle incoming match from route params — smart switch for Colyseus vs Firestore
  const { resolvedMode, firestoreGameId } = useGameConnection(
    "checkers_game",
    route.params?.matchId,
  );

  // v3 auto-start: bypass useGameConnection, join room directly
  const v3StartedRef = useRef(false);
  useEffect(() => {
    if (!isV3 || v3StartedRef.current) return;
    const fId =
      route.params?.firestoreGameId ||
      route.params?.matchId ||
      route.params?.v3Session;
    if (fId) {
      v3StartedRef.current = true;
      setGameMode("colyseus");
      mp.startMultiplayer({ firestoreGameId: fId, spectator: isSpectator });
    }
  }, [
    isV3,
    route.params?.firestoreGameId,
    route.params?.matchId,
    route.params?.v3Session,
    isSpectator,
  ]);

  useEffect(() => {
    // Skip when lobby is handling the invite flow, or v3 (handled above)
    if (route.params?.inviteId || isV3) return;
    if (resolvedMode === "colyseus" && firestoreGameId) {
      setGameMode("colyseus");
      mp.startMultiplayer({ firestoreGameId, spectator: isSpectator });
    } else if (resolvedMode === "online" && firestoreGameId) {
      setGameMode("online");
      setMatchId(firestoreGameId);
    }
  }, [resolvedMode, firestoreGameId, route.params?.inviteId, isV3]);

  // Fallback: if Colyseus connection fails, switch to Firestore online mode
  // so the game remains playable with Firestore subscriptions
  useEffect(() => {
    if (
      gameMode === "colyseus" &&
      mp.error &&
      !mp.isMultiplayer &&
      firestoreGameId
    ) {
      logger.warn(
        "[Checkers] Colyseus connection failed, falling back to Firestore mode:",
        mp.error,
      );
      setGameMode("online");
      setMatchId(firestoreGameId);
    }
  }, [gameMode, mp.error, mp.isMultiplayer, firestoreGameId]);

  // ==========================================================================
  // Game Logic
  // ==========================================================================

  const handleCellPress = useCallback(
    async (row: number, col: number) => {
      if (isSpectator) return;
      if (winner) return;

      // Colyseus multiplayer mode
      if (gameMode === "colyseus" && mp.isMultiplayer) {
        if (!mp.isMyTurn || mp.phase !== "playing") return;

        const clickedPieceColyseus = effectiveBoard[row][col];
        // playerIndex 0 → red, 1 → black
        const myColyseusColor: "red" | "black" =
          mp.myPlayerIndex === 0 ? "red" : "black";

        // Selecting a piece
        if (
          clickedPieceColyseus &&
          clickedPieceColyseus.color === myColyseusColor
        ) {
          const mustJumpNow = checkForJumps(effectiveBoard, myColyseusColor);
          const moves = getValidMoves(
            effectiveBoard,
            { row, col },
            mustJumpNow,
          );
          if (moves.length > 0) {
            setSelectedPiece({ row, col });
            setValidMoves(moves);
            Vibration.vibrate(10);
          }
          return;
        }

        // Moving to a valid destination
        if (selectedPiece) {
          const move = validMoves.find(
            (m) => m.to.row === row && m.to.col === col,
          );
          if (move) {
            mp.sendMove({
              row: selectedPiece.row,
              col: selectedPiece.col,
              toRow: row,
              toCol: col,
            });
            Vibration.vibrate(20);
            setSelectedPiece(null);
            setValidMoves([]);
          } else {
            setSelectedPiece(null);
            setValidMoves([]);
          }
        }
        return;
      }

      const clickedPiece = board[row][col];

      // If in multi-jump mode, can only continue with the jumping piece
      if (multiJumpPiece) {
        // Check if clicking on a valid jump destination
        const move = validMoves.find(
          (m) => m.to.row === row && m.to.col === col,
        );
        if (move && move.isJump) {
          await executeMove(multiJumpPiece, move);
        }
        return;
      }

      // Selecting a piece
      if (clickedPiece && clickedPiece.color === currentTurn) {
        // In online mode, check if it's my turn
        if (gameMode === "online" && myColor !== currentTurn) {
          return;
        }

        const mustJumpNow = checkForJumps(board, currentTurn);
        setMustJump(mustJumpNow);

        const moves = getValidMoves(board, { row, col }, mustJumpNow);

        if (moves.length > 0) {
          setSelectedPiece({ row, col });
          setValidMoves(moves);
          Vibration.vibrate(10);
        }
        return;
      }

      // Moving to a valid position
      if (selectedPiece) {
        const move = validMoves.find(
          (m) => m.to.row === row && m.to.col === col,
        );
        if (move) {
          await executeMove(selectedPiece, move);
        } else {
          // Deselect
          setSelectedPiece(null);
          setValidMoves([]);
        }
      }
    },
    [
      board,
      currentTurn,
      selectedPiece,
      validMoves,
      winner,
      gameMode,
      myColor,
      multiJumpPiece,
      effectiveBoard,
      mp,
    ],
  );

  const executeMove = async (from: CheckersPosition, move: ValidMove) => {
    const newBoard = board.map((row) => [...row]);
    const piece = newBoard[from.row][from.col]!;

    // Move piece
    newBoard[from.row][from.col] = null;
    newBoard[move.to.row][move.to.col] = { ...piece };

    // Remove captured pieces
    for (const capture of move.captures) {
      newBoard[capture.row][capture.col] = null;
    }

    // Check for kinging
    const shouldKing =
      (piece.color === "red" && move.to.row === 7) ||
      (piece.color === "black" && move.to.row === 0);

    if (shouldKing && !piece.isKing) {
      newBoard[move.to.row][move.to.col] = { ...piece, isKing: true };
      Vibration.vibrate([0, 50, 50, 50]); // Crown vibration
    }

    setBoard(newBoard);
    Vibration.vibrate(20);

    // Check for multi-jump (but stop if piece was just kinged)
    if (move.isJump && !(shouldKing && !piece.isKing)) {
      const moreJumps = getValidMoves(newBoard, move.to, true).filter(
        (m) => m.isJump,
      );

      if (moreJumps.length > 0) {
        // Continue jumping
        setMultiJumpPiece(move.to);
        setSelectedPiece(move.to);
        setValidMoves(moreJumps);
        return;
      }
    }

    // End turn
    setSelectedPiece(null);
    setValidMoves([]);
    setMultiJumpPiece(null);

    const nextTurn = currentTurn === "red" ? "black" : "red";

    // Check for winner
    const { red, black } = countPieces(newBoard);

    if (red === 0) {
      handleGameOver("black", newBoard);
      return;
    }
    if (black === 0) {
      handleGameOver("red", newBoard);
      return;
    }
    if (!canPlayerMove(newBoard, nextTurn)) {
      // Current player wins if opponent can't move
      handleGameOver(currentTurn, newBoard);
      return;
    }

    // Submit move for online games
    if (gameMode === "online" && matchId && match && currentFirebaseUser) {
      const {
        red: newRed,
        black: newBlack,
        redKings,
        blackKings,
      } = countPieces(newBoard);

      const newGameState: CheckersGameState = {
        board: newBoard,
        currentTurn: nextTurn,
        redPieces: newRed,
        blackPieces: newBlack,
        redKings,
        blackKings,
        mustJump: checkForJumps(newBoard, nextTurn),
      };

      const moveData: CheckersMove = {
        from,
        to: move.to,
        captures: move.captures,
        promotion: shouldKing,
        timestamp: Date.now(),
      };

      const nextPlayerId =
        match.players.player1.userId === currentFirebaseUser.uid
          ? match.players.player2.userId
          : match.players.player1.userId;

      try {
        await submitMove(matchId, moveData, newGameState, nextPlayerId);
      } catch (error) {
        logger.error("[Checkers] Error submitting move:", error);
      }
    } else {
      // Local game - switch turns
      setCurrentTurn(nextTurn);
      setMustJump(checkForJumps(newBoard, nextTurn));
    }
  };

  const handleGameOver = async (
    winnerColor: "red" | "black",
    finalBoard: CheckersBoard,
  ) => {
    setWinner(winnerColor);
    setShowGameOverModal(true);
    setXpEarned(0);
    setDidLevelUp(false);
    setNewXpLevel(0);
    setScores((prev) => ({
      ...prev,
      [winnerColor]: prev[winnerColor] + 1,
    }));
    Vibration.vibrate([0, 100, 50, 100]);

    // Submit local game to XP pipeline
    if (gameMode === "local" && currentFirebaseUser) {
      submitGameResult(
        buildGameResultEvent({
          gameId: "checkers",
          mode: "solo",
          outcome: "win",
          score: 0,
          durationMs: 0,
          userId: currentFirebaseUser.uid,
          displayName: currentFirebaseUser.displayName || "Player",
        }),
      ).catch(() => {});
    }

    // End online match
    if (gameMode === "online" && matchId && match) {
      const winnerId =
        winnerColor === "red"
          ? match.players.player1.userId
          : match.players.player2.userId;

      try {
        await endMatch(matchId, winnerId, "normal");
      } catch (error) {
        logger.error("[Checkers] Error ending match:", error);
      }
    }
  };

  // ==========================================================================
  // Game Actions
  // ==========================================================================

  const resetGame = () => {
    setBoard(createInitialCheckersBoard());
    setCurrentTurn("red");
    setSelectedPiece(null);
    setValidMoves([]);
    setMultiJumpPiece(null);
    setMustJump(false);
    setWinner(null);
    setShowGameOverModal(false);
  };

  const startLocalGame = () => {
    setGameMode("local");
    resetGame();
    setScores({ red: 0, black: 0 });
  };

  const handleInviteFriend = () => {
    setGameMode("lobby");
  };

  const handleSelectInviteFriend = async (friend: FriendItem) => {
    setShowFriendPicker(false);
    if (!currentFirebaseUser || !userProfile) return;

    setLoading(true);
    try {
      await lobbyController.lobby.sendFriendInvite(
        friend.friendUid,
        friend.displayName || friend.username,
        undefined,
      );
    } catch (error: any) {
      logger.error("[Checkers] Error sending invite:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to send game invite. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInviteGroup = async (group: GroupItem) => {
    setShowFriendPicker(false);
    if (!currentFirebaseUser || !userProfile) return;

    setLoading(true);
    try {
      const members = await getGroupMembers(group.groupId);
      const memberIds = members.map((m) => m.uid);
      await lobbyController.lobby.sendGroupInvite(
        group.groupId,
        group.name,
        memberIds,
      );
    } catch (error: any) {
      logger.error("[Checkers] Error sending group invite:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to send group game invite. Please try again.",
      );
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
              markAsLeaving();
              exitGame();
            } catch (error) {
              logger.error("[Checkers] Error resigning:", error);
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
      setShowGameOverModal(false);
      markAsLeaving();
      exitGame();
    }
  };

  const handleGoBack = () => {
    // Allow users to leave active games without resigning
    // They can return to continue playing at their own pace
    markAsLeaving();
    exitGame();
  };

  // ==========================================================================
  // Render Helpers
  // ==========================================================================

  const isMyTurn = () => {
    if (gameMode === "local") return true;
    if (gameMode === "online" && myColor) {
      return myColor === currentTurn;
    }
    return false;
  };

  const getStatusText = () => {
    if (gameMode === "colyseus" && mp.isMultiplayer) {
      if (mp.phase === "waiting" || mp.phase === "connecting")
        return "Waiting for opponent...";
      if (mp.phase === "countdown") return "Get Ready!";
      if (mp.phase === "finished") {
        if (mp.isDraw) return "Draw!";
        return mp.isWinner ? "You Win! 🎉" : "You Lose 😔";
      }
      return mp.isMyTurn ? "Your Turn" : `${mp.opponentName}'s Turn`;
    }

    if (winner) {
      if (gameMode === "online") {
        return winner === myColor ? "You Win! 🎉" : "You Lose 😔";
      }
      return `${winner === "red" ? "Red" : "Black"} Wins!`;
    }

    if (multiJumpPiece) {
      return "Continue jumping!";
    }

    if (mustJump) {
      return `${gameMode === "online" ? (isMyTurn() ? "You must" : opponentName + " must") : currentTurn === "red" ? "Red must" : "Black must"} jump!`;
    }

    if (gameMode === "online") {
      return isMyTurn() ? "Your Turn" : `${opponentName}'s Turn`;
    }
    return `${currentTurn === "red" ? "Red" : "Black"}'s Turn`;
  };

  const isValidMoveCell = (
    row: number,
    col: number,
  ): { isValid: boolean; isJump: boolean } => {
    const move = validMoves.find((m) => m.to.row === row && m.to.col === col);
    return { isValid: !!move, isJump: move?.isJump || false };
  };

  const {
    red: redCount,
    black: blackCount,
    redKings,
    blackKings,
  } = countPieces(effectiveBoard);

  // ==========================================================================
  // Render
  // ==========================================================================

  // Lobby Screen (skip for v3 — lobby is handled by SessionLobbyScreen)
  if (gameMode === "lobby" && !isV3) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <MultiplayerLobbyOverlay
          controller={lobbyController}
          gameTitle="Checkers"
          gameIcon="⬛🔴"
          onInvitePress={() => setShowFriendPicker(true)}
          onLeave={() => {
            lobbyController.lobby.leaveLobby();
            setGameMode("menu");
          }}
          showReadyButton={false}
        >
          {/* Children rendered when phase transitions to "playing" */}
          <View style={{ flex: 1 }} />
        </MultiplayerLobbyOverlay>

        <InvitePickerModal
          visible={showFriendPicker}
          onDismiss={() => setShowFriendPicker(false)}
          onSelectFriend={handleSelectInviteFriend}
          onSelectGroup={handleSelectInviteGroup}
          currentUserId={currentFirebaseUser?.uid || ""}
          title="Challenge a Friend"
        />
      </SafeAreaView>
    );
  }

  // Menu Screen
  if (gameMode === "menu") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              markAsLeaving();
              exitGame();
            }}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={28}
              color={theme.colors.onBackground}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>
            Checkers
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.menuContent}>
          <Text style={styles.menuEmoji}>⬛🔴</Text>
          <Text
            style={[
              styles.menuSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Jump and capture your way to victory!
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

          <View
            style={[
              styles.rulesCard,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Text
              style={[styles.rulesTitle, { color: theme.colors.onSurface }]}
            >
              How to Play
            </Text>
            <Text
              style={[
                styles.rulesText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              • Red moves first{"\n"}• Move diagonally forward{"\n"}• Jump over
              opponents to capture{"\n"}• Reach the end to become a King 👑
              {"\n"}• Kings can move backward too!{"\n"}• Capture all pieces to
              win
            </Text>
          </View>
        </View>

        <InvitePickerModal
          visible={showFriendPicker}
          onDismiss={() => setShowFriendPicker(false)}
          onSelectFriend={handleSelectInviteFriend}
          onSelectGroup={handleSelectInviteGroup}
          currentUserId={currentFirebaseUser?.uid || ""}
          title="Challenge a Friend"
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
          Checkers
        </Text>
        {gameMode === "online" &&
        match?.status === "active" &&
        !isSpectator &&
        !isV3 ? (
          <TouchableOpacity onPress={handleResign}>
            <MaterialCommunityIcons
              name="flag"
              size={24}
              color={theme.colors.error}
            />
          </TouchableOpacity>
        ) : gameMode === "colyseus" &&
          mp.isMultiplayer &&
          mp.phase === "playing" &&
          !isSpectator &&
          !isV3 ? (
          <TouchableOpacity onPress={() => setShowResignConfirm(true)}>
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
          <View
            style={[styles.pieceIndicator, { backgroundColor: RED_PIECE }]}
          />
          <Text
            style={[styles.scoreName, { color: theme.colors.onSurfaceVariant }]}
          >
            {gameMode === "online" && myColor === "red"
              ? "You"
              : gameMode === "online"
                ? opponentName
                : "Red"}
          </Text>
          <Text style={[styles.scoreValue, { color: theme.colors.onSurface }]}>
            {redCount} {redKings > 0 && `(${redKings}👑)`}
          </Text>
        </View>
        <View style={styles.scoreItem}>
          <Text
            style={[styles.vsText, { color: theme.colors.onSurfaceVariant }]}
          >
            VS
          </Text>
          <Text
            style={[styles.winsText, { color: theme.colors.onSurfaceVariant }]}
          >
            {scores.red} - {scores.black}
          </Text>
        </View>
        <View style={styles.scoreItem}>
          <View
            style={[styles.pieceIndicator, { backgroundColor: BLACK_PIECE }]}
          />
          <Text
            style={[styles.scoreName, { color: theme.colors.onSurfaceVariant }]}
          >
            {gameMode === "online" && myColor === "black"
              ? "You"
              : gameMode === "online"
                ? opponentName
                : "Black"}
          </Text>
          <Text style={[styles.scoreValue, { color: theme.colors.onSurface }]}>
            {blackCount} {blackKings > 0 && `(${blackKings}👑)`}
          </Text>
        </View>
      </View>

      {/* Turn Indicator */}
      <View style={styles.turnIndicator}>
        <View
          style={[
            styles.turnDot,
            {
              backgroundColor: currentTurn === "red" ? RED_PIECE : BLACK_PIECE,
            },
          ]}
        />
        <Text
          style={[
            styles.turnText,
            {
              color: winner
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

      {/* Game Board — Skia wood-grain frame */}
      <SkiaGameBoard
        width={BOARD_SIZE}
        height={BOARD_SIZE}
        borderRadius={6}
        gradientColors={["#5D3A1A", "#3C2410", "#5D3A1A"]}
        borderColor="#7D5A2A"
        borderWidth={3}
        innerShadowBlur={6}
      >
        <View style={[styles.board, { borderColor: theme.colors.outline }]}>
          {effectiveBoard.map((row, rowIndex) => {
            // Flip board for red player (player index 0) so their pieces are at the bottom
            const shouldFlip =
              (gameMode === "online" && myColor === "red") ||
              (gameMode === "colyseus" && mp.myPlayerIndex === 0);
            const displayRowIndex = shouldFlip ? 7 - rowIndex : rowIndex;
            const displayRow = effectiveBoard[displayRowIndex];

            return (
              <View key={rowIndex} style={styles.row}>
                {displayRow.map((cell, colIndex) => {
                  const displayColIndex = shouldFlip ? 7 - colIndex : colIndex;
                  const actualRow = displayRowIndex;
                  const actualCol = displayColIndex;
                  const { isValid, isJump } = isValidMoveCell(
                    actualRow,
                    actualCol,
                  );
                  return (
                    <CellComponent
                      key={`${rowIndex}-${colIndex}`}
                      row={actualRow}
                      col={actualCol}
                      piece={effectiveBoard[actualRow][actualCol]}
                      isSelected={
                        selectedPiece?.row === actualRow &&
                        selectedPiece?.col === actualCol
                      }
                      isValidMove={isValid}
                      isJumpMove={isJump}
                      onPress={() => handleCellPress(actualRow, actualCol)}
                      disabled={
                        !!winner ||
                        (gameMode === "online" && !isMyTurn()) ||
                        (gameMode === "colyseus" &&
                          (!mp.isMyTurn || mp.phase !== "playing"))
                      }
                    />
                  );
                })}
              </View>
            );
          })}
        </View>
      </SkiaGameBoard>

      {/* Game Over Modal */}
      {showGameOverModal && (
        <View
          style={[
            {
              ...StyleSheet.absoluteFillObject,
              zIndex: 9999,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.5)",
            },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text
              style={[styles.modalTitle, { color: theme.colors.onSurface }]}
            >
              {winner &&
                (gameMode === "online"
                  ? winner === myColor
                    ? "🎉 Victory!"
                    : "😔 Defeat"
                  : `${winner === "red" ? "🔴 Red" : "⬛ Black"} Wins!`)}
            </Text>
            {xpEarned > 0 && (
              <Text
                style={{ color: "#fbbf24", textAlign: "center", marginTop: 8 }}
              >
                ⭐ +{xpEarned} XP
                {didLevelUp ? ` — Level Up! Level ${newXpLevel}!` : ""}
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
          </View>
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
            colors={overlayColors}
            player1Label="Red"
            player2Label="Black"
          />
        )}

      {/* Colyseus Multiplayer — Game Action Bar */}
      {gameMode === "colyseus" &&
        mp.isMultiplayer &&
        mp.phase === "playing" &&
        !isSpectator &&
        !isV3 && (
          <GameActionBar
            onResign={() => setShowResignConfirm(true)}
            onOfferDraw={mp.offerDraw}
            isMyTurn={mp.isMyTurn}
            drawPending={mp.drawPending}
            colors={overlayColors}
          />
        )}

      {/* Colyseus Multiplayer Overlays */}
      {gameMode === "colyseus" && (
        <>
          <TurnBasedWaitingOverlay
            colors={overlayColors}
            onCancel={() => {
              mp.cancelMultiplayer();
              setGameMode("menu");
            }}
            gameName="Checkers"
            visible={mp.phase === "waiting" || mp.phase === "connecting"}
          />

          <TurnBasedCountdownOverlay
            countdown={mp.countdown}
            colors={overlayColors}
            visible={mp.phase === "countdown"}
          />

          <TurnBasedReconnectingOverlay
            colors={overlayColors}
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
            colors={overlayColors}
            onRematch={mp.requestRematch}
            onAcceptRematch={mp.acceptRematch}
            onMenu={() => {
              mp.cancelMultiplayer();
              markAsLeaving();
              exitGame();
            }}
            visible={mp.phase === "finished" && !isV3}
          />

          <DrawOfferDialog
            visible={mp.drawPending}
            opponentName={mp.opponentName}
            isMyOffer={mp.drawOfferedByMe}
            colors={overlayColors}
            onAccept={mp.acceptDraw}
            onDecline={mp.declineDraw}
          />

          <ResignConfirmDialog
            visible={showResignConfirm && !isV3}
            colors={overlayColors}
            onConfirm={() => {
              setShowResignConfirm(false);
              mp.resign();
            }}
            onCancel={() => setShowResignConfirm(false)}
          />
        </>
      )}

      {/* Local Game Controls */}
      {gameMode === "local" && !winner && (
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
    marginBottom: Spacing.xl,
  },
  menuButton: {
    borderRadius: BorderRadius.md,
  },
  menuButtonContent: {
    paddingVertical: Spacing.xs,
  },
  rulesCard: {
    width: "100%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  rulesText: {
    fontSize: 14,
    lineHeight: 22,
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
  pieceIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 4,
  },
  scoreName: {
    fontSize: 12,
    marginTop: 2,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 4,
  },
  vsText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  winsText: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  },
  turnIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing.md,
    gap: Spacing.sm,
  },
  turnDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  turnText: {
    fontSize: 18,
    fontWeight: "600",
  },
  boardContainer: {
    alignSelf: "center",
    padding: 4,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    borderWidth: 3,
    borderRadius: 4,
    overflow: "hidden",
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
  piece: {
    borderRadius: 100,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  pieceInner: {
    borderRadius: 100,
    borderWidth: 2,
  },
  kingCrown: {
    position: "absolute",
    fontSize: 16,
  },
  validMoveIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0, 200, 0, 0.6)",
  },
  jumpMoveIndicator: {
    backgroundColor: "rgba(255, 150, 0, 0.8)",
    borderWidth: 2,
    borderColor: "#FF6600",
  },
  controls: {
    marginTop: Spacing.lg,
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

export default withGameErrorBoundary(
  withMultiplayerRuntime(CheckersGameScreen),
  "checkers",
);
