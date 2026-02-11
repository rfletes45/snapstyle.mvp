/**
 * ChessGameScreen
 *
 * Features:
 * - Real-time turn-based gameplay via Firestore
 * - Complete chess rules with check/checkmate detection
 * - Legal move highlighting with haptic feedback
 * - Pawn promotion modal
 * - Move history with algebraic notation
 * - Captured pieces display
 * - Game invites and matchmaking
 * - Polished game over modal
 *
 * @see docs/07_GAMES_ARCHITECTURE.md
 * @see src/types/turnBased.ts
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Modal, Portal, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import FriendPickerModal from "@/components/FriendPickerModal";
import { GameOverModal, GameResult } from "@/components/games/GameOverModal";
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
import { SkiaChessPieces } from "@/components/games/graphics/SkiaChessPieces";
import { SkiaGameBoard } from "@/components/games/graphics/SkiaGameBoard";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { useSpectator } from "@/hooks/useSpectator";
import { useTurnBasedGame } from "@/hooks/useTurnBasedGame";
import { sendGameInvite } from "@/services/gameInvites";
import {
  createChessMove,
  createInitialChessState,
  getCapturedPieces,
  getPieceDisplay,
  getValidMoves,
  makeMove,
  requiresPromotion,
} from "@/services/games/chessLogic";
import {
  endMatch,
  resignMatch,
  submitMove,
  subscribeToMatch,
} from "@/services/turnBasedGames";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import {
  ChessBoard,
  ChessColor,
  ChessGameState,
  ChessMatch,
  ChessMove,
  ChessPiece,
  ChessPieceType,
  ChessPosition,
  createInitialChessBoard,
} from "@/types/turnBased";
import { BorderRadius, Spacing } from "@/constants/theme";


import { createLogger } from "@/utils/log";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
const logger = createLogger("screens/games/ChessGameScreen");
// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_BORDER = 2;
// Calculate board size accounting for border - the inner content area should be evenly divisible by 8
const BOARD_INNER_SIZE =
  Math.floor((Math.min(SCREEN_WIDTH - 32, 380) - BOARD_BORDER * 2) / 8) * 8;
const BOARD_SIZE = BOARD_INNER_SIZE + BOARD_BORDER * 2;
const CELL_SIZE = BOARD_INNER_SIZE / 8;
const PIECE_SIZE = CELL_SIZE * 0.85;

// Colors
const LIGHT_SQUARE = "#F0D9B5";
const DARK_SQUARE = "#B58863";
const SELECTED_HIGHLIGHT = "rgba(255, 255, 0, 0.5)";
const VALID_MOVE_HIGHLIGHT = "rgba(0, 255, 0, 0.4)";
const LAST_MOVE_HIGHLIGHT = "rgba(155, 199, 0, 0.4)";
const CHECK_HIGHLIGHT = "rgba(255, 0, 0, 0.5)";

// =============================================================================
// Types
// =============================================================================

interface ChessGameScreenProps {
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

type GameMode = "menu" | "local" | "online" | "colyseus" | "waiting";

// =============================================================================
// Piece Component
// =============================================================================

interface PieceComponentProps {
  piece: ChessPiece;
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
    <Animated.View
      style={[
        styles.piece,
        {
          width: size,
          height: size,
        },
        animatedStyle,
      ]}
    >
      <SkiaChessPieces type={piece.type} color={piece.color} size={size} />
    </Animated.View>
  );
}

// =============================================================================
// Board Cell Component
// =============================================================================

interface CellComponentProps {
  row: number;
  col: number;
  piece: ChessPiece | null;
  isSelected: boolean;
  isValidMove: boolean;
  isLastMove: boolean;
  isCheck: boolean;
  onPress: () => void;
  disabled: boolean;
  flipped: boolean;
}

function CellComponent({
  row,
  col,
  piece,
  isSelected,
  isValidMove: isValid,
  isLastMove,
  isCheck,
  onPress,
  disabled,
  flipped,
}: CellComponentProps) {
  // row and col are display coordinates (0-7 from top-left of visual board)
  // Calculate the actual chess rank/file for coordinate labels
  const displayRow = row;
  const displayCol = col;
  const isDarkSquare = (displayRow + displayCol) % 2 === 1;
  const backgroundColor = isDarkSquare ? DARK_SQUARE : LIGHT_SQUARE;

  // Calculate actual rank (1-8) and file (a-h) for labels
  // When not flipped (white at bottom): displayRow 0 = rank 8, displayRow 7 = rank 1
  // When flipped (black at bottom): displayRow 0 = rank 1, displayRow 7 = rank 8
  const rankNumber = flipped ? displayRow + 1 : 8 - displayRow;
  const fileChar = flipped
    ? String.fromCharCode(104 - displayCol)
    : String.fromCharCode(97 + displayCol);

  return (
    <TouchableOpacity
      style={[styles.cell, { backgroundColor }]}
      onPress={onPress}
      disabled={disabled && !isValid && !piece}
      activeOpacity={0.8}
    >
      {/* Skia-powered cell highlights */}
      {isLastMove && (
        <SkiaCellHighlight
          width={CELL_SIZE}
          height={CELL_SIZE}
          type="lastMove"
        />
      )}
      {isSelected && (
        <SkiaCellHighlight
          width={CELL_SIZE}
          height={CELL_SIZE}
          type="selected"
        />
      )}
      {isValid && !piece && (
        <SkiaCellHighlight
          width={CELL_SIZE}
          height={CELL_SIZE}
          type="validMove"
        />
      )}
      {isCheck && (
        <SkiaCellHighlight width={CELL_SIZE} height={CELL_SIZE} type="check" />
      )}

      {/* Coordinates on edge */}
      {displayCol === 0 && (
        <Text
          style={[
            styles.coordinateRank,
            { color: isDarkSquare ? LIGHT_SQUARE : DARK_SQUARE },
          ]}
        >
          {rankNumber}
        </Text>
      )}
      {displayRow === 7 && (
        <Text
          style={[
            styles.coordinateFile,
            { color: isDarkSquare ? LIGHT_SQUARE : DARK_SQUARE },
          ]}
        >
          {fileChar}
        </Text>
      )}

      {piece && (
        <PieceComponent
          piece={piece}
          isSelected={isSelected}
          size={PIECE_SIZE}
        />
      )}
      {isValid && !piece && <View style={styles.validMoveIndicator} />}
      {isValid && piece && <View style={styles.captureIndicator} />}
    </TouchableOpacity>
  );
}

// =============================================================================
// Promotion Modal
// =============================================================================

interface PromotionModalProps {
  visible: boolean;
  color: ChessColor;
  onSelect: (piece: ChessPieceType) => void;
}

function PromotionModal({ visible, color, onSelect }: PromotionModalProps) {
  const pieces: ChessPieceType[] = ["queen", "rook", "bishop", "knight"];

  return (
    <Portal>
      <Modal
        visible={visible}
        dismissable={false}
        contentContainerStyle={styles.promotionModal}
      >
        <Text style={styles.promotionTitle}>Choose Promotion</Text>
        <View style={styles.promotionOptions}>
          {pieces.map((type) => (
            <TouchableOpacity
              key={type}
              style={styles.promotionOption}
              onPress={() => onSelect(type)}
            >
              <SkiaChessPieces type={type} color={color} size={40} />
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </Portal>
  );
}

// =============================================================================
// Move History Component
// =============================================================================

interface MoveHistoryProps {
  moves: ChessMove[];
}

function MoveHistory({ moves }: MoveHistoryProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [moves]);

  // Group moves into pairs (white, black)
  const movePairs: { number: number; white?: ChessMove; black?: ChessMove }[] =
    [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <View style={styles.moveHistoryContainer}>
      <Text style={styles.moveHistoryTitle}>Moves</Text>
      <ScrollView ref={scrollRef} style={styles.moveHistoryScroll}>
        {movePairs.map((pair) => (
          <View key={pair.number} style={styles.moveRow}>
            <Text style={styles.moveNumber}>{pair.number}.</Text>
            <Text style={styles.moveNotation}>
              {pair.white?.notation || ""}
            </Text>
            <Text style={styles.moveNotation}>
              {pair.black?.notation || ""}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Captured Pieces Component
// =============================================================================

interface CapturedPiecesProps {
  pieces: ChessPieceType[];
  color: ChessColor;
}

function CapturedPiecesDisplay({ pieces, color }: CapturedPiecesProps) {
  const sortedPieces = [...pieces].sort((a, b) => {
    const order: ChessPieceType[] = [
      "queen",
      "rook",
      "bishop",
      "knight",
      "pawn",
    ];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <View style={styles.capturedContainer}>
      {sortedPieces.map((type, index) => (
        <Text key={`${type}-${index}`} style={styles.capturedPiece}>
          {getPieceDisplay({ type, color, hasMoved: true })}
        </Text>
      ))}
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function ChessGameScreen({
  navigation,
  route,
}: ChessGameScreenProps) {
  useGameBackHandler({ gameType: "chess", isGameOver: false });

  const { colors } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile: userProfile } = useUser();
  const haptics = useGameHaptics();

  const isSpectator = route.params?.spectatorMode === true;

  // Online game state (declared early for navigation hook)
  const [match, setMatch] = useState<ChessMatch | null>(null);

  // Online game state
  const [matchId, setMatchId] = useState<string | null>(
    route.params?.matchId || null,
  );

  // Game completion hook - integrates navigation (Phase 6) and achievements (Phase 7)
  const {
    exitGame,
    handleGameCompletion,
    notifications: achievementNotifications,
    dismissNotification,
  } = useGameCompletion({
    match,
    currentUserId: currentFirebaseUser?.uid,
    gameType: "chess",
    entryPoint: route.params?.entryPoint,
    onAchievementsAwarded: (achievements) => {
      logger.info(
        "[Chess] Achievements awarded:",
        achievements.map((a) => a.name),
      );
    },
  });

  // Game state
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const [gameState, setGameState] = useState<ChessGameState>(() =>
    createInitialChessState("player1", "player2"),
  );
  const [selectedPiece, setSelectedPiece] = useState<ChessPosition | null>(
    null,
  );
  const [validMoves, setValidMoves] = useState<ChessPosition[]>([]);
  const [lastMove, setLastMove] = useState<{
    from: ChessPosition;
    to: ChessPosition;
  } | null>(null);
  const [moveHistory, setMoveHistory] = useState<ChessMove[]>([]);

  // Promotion state
  const [promotionPending, setPromotionPending] = useState<{
    from: ChessPosition;
    to: ChessPosition;
  } | null>(null);

  // Captured pieces
  const [initialBoard] = useState<ChessBoard>(createInitialChessBoard);
  const [capturedWhite, setCapturedWhite] = useState<ChessPieceType[]>([]);
  const [capturedBlack, setCapturedBlack] = useState<ChessPieceType[]>([]);

  // Game result
  const [scores, setScores] = useState({ white: 0, black: 0 });
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [winMethod, setWinMethod] = useState<string>("");

  const [myColor, setMyColor] = useState<ChessColor | null>(null);
  const [opponentName, setOpponentName] = useState<string>("Opponent");
  const [player1Name, setPlayer1Name] = useState<string>("White");
  const [player2Name, setPlayer2Name] = useState<string>("Black");
  const [flipped, setFlipped] = useState(false);

  // UI state
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  // Colyseus multiplayer hook
  const mp = useTurnBasedGame("chess_game");
  const spectatorSession = useSpectator({
    mode: "multiplayer-spectator",
    room: mp.room,
    state: mp.rawState,
  });
  const spectatorCount = spectatorSession.spectatorCount || mp.spectatorCount;

  // Derive Colyseus board as 2D ChessBoard when in multiplayer
  const pieceTypeMap: Record<number, ChessPieceType> = {
    1: "pawn",
    2: "knight",
    3: "bishop",
    4: "rook",
    5: "queen",
    6: "king",
  };

  const colyseusBoard: ChessBoard | null =
    mp.isMultiplayer && mp.board.length === 64
      ? (Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 8 }, (_, col): ChessPiece | null => {
            const v = mp.board[row * 8 + col];
            if (v === 0) return null;
            const color: ChessColor = v > 0 ? "white" : "black";
            const type = pieceTypeMap[Math.abs(v)];
            if (!type) return null;
            return { type, color, hasMoved: true };
          }),
        ) as ChessBoard)
      : null;

  // Effective board — use Colyseus board when in multiplayer, else local
  const effectiveBoard: ChessBoard =
    gameMode === "colyseus" && colyseusBoard ? colyseusBoard : gameState.board;

  // ==========================================================================
  // Online Game Subscription
  // ==========================================================================

  useEffect(() => {
    if (!matchId) return;

    logger.info(`[Chess] Setting up subscription for matchId: ${matchId}`);

    const unsubscribe = subscribeToMatch(matchId, (updatedMatch) => {
      logger.info(
        `[Chess] Received match update:`,
        updatedMatch
          ? {
              id: updatedMatch.id,
              currentTurn: updatedMatch.currentTurn,
              turnNumber: updatedMatch.turnNumber,
              moveCount: updatedMatch.moveHistory?.length,
              status: updatedMatch.status,
            }
          : null,
      );

      if (!updatedMatch) return;

      const typedMatch = updatedMatch as ChessMatch;
      setMatch(typedMatch);

      // Update local state from match
      const state = typedMatch.gameState as ChessGameState;
      setGameState(state);
      setMoveHistory(typedMatch.moveHistory as ChessMove[]);

      setPlayer1Name(typedMatch.players.player1.displayName);
      setPlayer2Name(typedMatch.players.player2.displayName);

      // Update last move
      if (typedMatch.moveHistory.length > 0) {
        const lastMoveData = typedMatch.moveHistory[
          typedMatch.moveHistory.length - 1
        ] as ChessMove;
        setLastMove({ from: lastMoveData.from, to: lastMoveData.to });
      }

      // Update captured pieces
      setCapturedWhite(getCapturedPieces(initialBoard, state.board, "white"));
      setCapturedBlack(getCapturedPieces(initialBoard, state.board, "black"));

      // Determine my color
      if (currentFirebaseUser) {
        if (typedMatch.players.player1.userId === currentFirebaseUser.uid) {
          setMyColor("white");
          setOpponentName(typedMatch.players.player2.displayName);
          setFlipped(false);
        } else {
          setMyColor("black");
          setOpponentName(typedMatch.players.player1.displayName);
          setFlipped(true);
        }
      }

      // Check for game over
      if (typedMatch.status === "completed") {
        const didWin = typedMatch.winnerId === currentFirebaseUser?.uid;
        setGameResult(didWin ? "win" : typedMatch.winnerId ? "loss" : "draw");
        setShowGameOverModal(true);
        haptics.gameOverPattern(didWin);

        // Phase 7: Check achievements on game completion
        handleGameCompletion(typedMatch as Parameters<typeof handleGameCompletion>[0]).then((result) => {
          if (result.achievementsAwarded.length > 0) {
            logger.info(
              "[Chess] Game complete, achievements:",
              result.achievementsAwarded.map((a) => a.name),
            );
          }
        });
      }
    });

    return () => unsubscribe();
  }, [matchId, currentFirebaseUser, initialBoard]);

  // Handle incoming match from route params — smart switch for Colyseus vs Firestore
  const { resolvedMode, firestoreGameId } = useGameConnection(
    "chess_game",
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
    async (actualRow: number, actualCol: number) => {
      // actualRow and actualCol are actual board coordinates (0-7, where 0 is white's back rank)

      if (isSpectator) return;

      if (gameState.isCheckmate || gameState.isStalemate || gameState.isDraw)
        return;

      // Colyseus multiplayer mode
      if (gameMode === "colyseus" && mp.isMultiplayer) {
        if (!mp.isMyTurn || mp.phase !== "playing") return;

        const clickedPieceColyseus = effectiveBoard[actualRow][actualCol];

        // Selecting a piece (my color = playerIndex 0 → white, 1 → black)
        const myColyseusColor: ChessColor =
          mp.myPlayerIndex === 0 ? "white" : "black";

        if (
          clickedPieceColyseus &&
          clickedPieceColyseus.color === myColyseusColor
        ) {
          const moves = getValidMoves(
            {
              ...gameState,
              board: effectiveBoard,
              currentTurn: myColyseusColor,
            },
            { row: actualRow, col: actualCol },
          );
          if (moves.length > 0) {
            setSelectedPiece({ row: actualRow, col: actualCol });
            setValidMoves(moves);
            haptics.trigger("selection");
          }
          return;
        }

        // Moving to a valid position
        if (selectedPiece) {
          const isValid = validMoves.some(
            (m) => m.row === actualRow && m.col === actualCol,
          );
          if (isValid) {
            // Check for pawn promotion
            const srcPiece =
              effectiveBoard[selectedPiece.row][selectedPiece.col];
            const isPromotion =
              srcPiece?.type === "pawn" &&
              ((myColyseusColor === "white" && actualRow === 0) ||
                (myColyseusColor === "black" && actualRow === 7));

            if (isPromotion) {
              setPromotionPending({
                from: selectedPiece,
                to: { row: actualRow, col: actualCol },
              });
            } else {
              mp.sendMove({
                row: selectedPiece.row,
                col: selectedPiece.col,
                toRow: actualRow,
                toCol: actualCol,
              });
              haptics.trigger("move");
              setSelectedPiece(null);
              setValidMoves([]);
            }
          } else {
            setSelectedPiece(null);
            setValidMoves([]);
          }
        }
        return;
      }

      const clickedPiece = gameState.board[actualRow][actualCol];

      // Selecting a piece
      if (clickedPiece && clickedPiece.color === gameState.currentTurn) {
        // In online mode, check if it's my turn
        if (gameMode === "online" && myColor !== gameState.currentTurn) {
          return;
        }

        const moves = getValidMoves(gameState, {
          row: actualRow,
          col: actualCol,
        });

        if (moves.length > 0) {
          setSelectedPiece({ row: actualRow, col: actualCol });
          setValidMoves(moves);
          haptics.trigger("selection");
        }
        return;
      }

      // Moving to a valid position
      if (selectedPiece) {
        const isValid = validMoves.some(
          (m) => m.row === actualRow && m.col === actualCol,
        );

        if (isValid) {
          // Check for pawn promotion
          if (
            requiresPromotion(gameState, selectedPiece, {
              row: actualRow,
              col: actualCol,
            })
          ) {
            setPromotionPending({
              from: selectedPiece,
              to: { row: actualRow, col: actualCol },
            });
          } else {
            await executeMove(selectedPiece, {
              row: actualRow,
              col: actualCol,
            });
          }
        } else {
          // Deselect
          setSelectedPiece(null);
          setValidMoves([]);
        }
      }
    },
    [gameState, selectedPiece, validMoves, gameMode, myColor, haptics],
  );

  const handlePromotion = async (pieceType: ChessPieceType) => {
    if (!promotionPending) return;

    haptics.trigger("special_move");

    // Colyseus multiplayer: send move with promotion via Colyseus
    if (gameMode === "colyseus" && mp.isMultiplayer) {
      mp.sendMove({
        row: promotionPending.from.row,
        col: promotionPending.from.col,
        toRow: promotionPending.to.row,
        toCol: promotionPending.to.col,
        extra: { promotion: pieceType },
      });
      setSelectedPiece(null);
      setValidMoves([]);
      setPromotionPending(null);
      return;
    }

    await executeMove(promotionPending.from, promotionPending.to, pieceType);
    setPromotionPending(null);
  };

  const executeMove = async (
    from: ChessPosition,
    to: ChessPosition,
    promotion?: ChessPieceType,
  ) => {
    const piece = gameState.board[from.row][from.col];
    if (!piece) return;

    // Create the move object
    const chessMove = createChessMove(gameState, from, to, promotion);

    // Apply the move
    const newState = makeMove(gameState, {
      from,
      to,
      piece: piece.type,
      promotion,
    });

    setGameState(newState);
    setLastMove({ from, to });
    setMoveHistory((prev) => [...prev, chessMove]);
    setSelectedPiece(null);
    setValidMoves([]);

    // Update captured pieces
    setCapturedWhite(getCapturedPieces(initialBoard, newState.board, "white"));
    setCapturedBlack(getCapturedPieces(initialBoard, newState.board, "black"));

    // Haptic feedback based on move type
    if (chessMove.capture) {
      haptics.trigger("capture");
    } else if (chessMove.castling) {
      haptics.trigger("special_move");
    } else {
      haptics.trigger("move");
    }

    // Check feedback
    if (newState.isCheck) {
      haptics.trigger("check");
    }

    // Check for game over
    if (newState.isCheckmate || newState.isStalemate || newState.isDraw) {
      handleGameOver(newState);
      return;
    }

    // Submit move for online games
    if (gameMode === "online" && matchId && match && currentFirebaseUser) {
      const nextPlayerId =
        match.players.player1.userId === currentFirebaseUser.uid
          ? match.players.player2.userId
          : match.players.player1.userId;

      logger.info(`[Chess] Submitting move to Firestore:`, {
        matchId,
        from: chessMove.from,
        to: chessMove.to,
        nextPlayerId,
      });

      try {
        await submitMove(matchId, chessMove, newState, nextPlayerId);
        logger.info(`[Chess] Move submitted successfully`);
      } catch (error) {
        logger.error("[Chess] Error submitting move:", error);
      }
    }
  };

  const handleGameOver = async (finalState: ChessGameState) => {
    setShowGameOverModal(true);

    if (finalState.isCheckmate) {
      const winner = finalState.currentTurn === "white" ? "black" : "white";
      setWinMethod("Checkmate");

      // Determine result from player perspective
      if (gameMode === "local") {
        setGameResult("win"); // Local always shows winner info
      } else if (myColor === winner) {
        setGameResult("win");
        haptics.celebrationPattern();
      } else {
        setGameResult("loss");
        haptics.gameOverPattern(false);
      }

      setScores((prev) => ({
        ...prev,
        [winner]: prev[winner] + 1,
      }));

      // End online match
      if (gameMode === "online" && matchId && match) {
        const winnerId =
          winner === "white"
            ? match.players.player1.userId
            : match.players.player2.userId;

        try {
          await endMatch(matchId, winnerId, "checkmate");
        } catch (error) {
          logger.error("[Chess] Error ending match:", error);
        }
      }
    } else if (finalState.isStalemate) {
      setGameResult("draw");
      setWinMethod("Stalemate");
      haptics.trigger("game_over");

      // End online match as draw
      if (gameMode === "online" && matchId) {
        try {
          await endMatch(matchId, null, "stalemate");
        } catch (error) {
          logger.error("[Chess] Error ending match:", error);
        }
      }
    } else if (finalState.isDraw) {
      setGameResult("draw");
      setWinMethod("Draw");
      haptics.trigger("game_over");

      // End online match as draw
      if (gameMode === "online" && matchId) {
        try {
          await endMatch(matchId, null, "draw_agreement");
        } catch (error) {
          logger.error("[Chess] Error ending match (draw):", error);
        }
      }
    }
  };

  // ==========================================================================
  // Game Actions
  // ==========================================================================

  const resetGame = () => {
    haptics.trigger("selection");
    setGameState(createInitialChessState("player1", "player2"));
    setSelectedPiece(null);
    setValidMoves([]);
    setLastMove(null);
    setMoveHistory([]);
    setCapturedWhite([]);
    setCapturedBlack([]);
    setShowGameOverModal(false);
    setGameResult(null);
    setWinMethod("");
  };

  const startLocalGame = () => {
    setGameMode("local");
    resetGame();
    setScores({ white: 0, black: 0 });
    setFlipped(false);
  };

  // Flip board for Colyseus when playing as black (player index 1)
  useEffect(() => {
    if (gameMode === "colyseus" && mp.isMultiplayer) {
      setFlipped(mp.myPlayerIndex === 1);
    }
  }, [gameMode, mp.isMultiplayer, mp.myPlayerIndex]);

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
          gameType: "chess",
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
      logger.error("[Chess] Error sending invite:", error);
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
              logger.error("[Chess] Error resigning:", error);
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
    if (gameMode === "online" && myColor) {
      return myColor === gameState.currentTurn;
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

    if (gameState.isCheckmate) {
      const winner = gameState.currentTurn === "white" ? "Black" : "White";
      if (gameMode === "online") {
        return myColor === (winner.toLowerCase() as ChessColor)
          ? "Checkmate! You Win! 🎉"
          : "Checkmate! You Lose 😔";
      }
      return `Checkmate! ${winner} Wins!`;
    }

    if (gameState.isStalemate) {
      return "Stalemate! It's a draw.";
    }

    if (gameState.isDraw) {
      return "Draw!";
    }

    if (gameState.isCheck) {
      if (gameMode === "online") {
        return isMyTurn()
          ? "Check! Your turn"
          : `Check! ${opponentName}'s turn`;
      }
      return `Check! ${gameState.currentTurn === "white" ? "White" : "Black"} to move`;
    }

    if (gameMode === "online") {
      return isMyTurn() ? "Your turn" : `${opponentName}'s turn`;
    }

    return `${gameState.currentTurn === "white" ? "White" : "Black"} to move`;
  };

  const renderBoard = () => {
    const cells = [];

    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        const actualRow = flipped ? displayRow : 7 - displayRow;
        const actualCol = flipped ? 7 - displayCol : displayCol;
        const piece = effectiveBoard[actualRow][actualCol];

        const isSelected =
          selectedPiece?.row === actualRow && selectedPiece?.col === actualCol;
        const isValid = validMoves.some(
          (m) => m.row === actualRow && m.col === actualCol,
        );
        const isLast =
          (lastMove?.from.row === actualRow &&
            lastMove?.from.col === actualCol) ||
          (lastMove?.to.row === actualRow && lastMove?.to.col === actualCol);
        const isKingInCheck =
          gameState.isCheck &&
          piece?.type === "king" &&
          piece?.color === gameState.currentTurn;

        cells.push(
          <CellComponent
            key={`${actualRow}-${actualCol}`}
            row={displayRow}
            col={displayCol}
            piece={piece}
            isSelected={isSelected}
            isValidMove={isValid}
            isLastMove={isLast}
            isCheck={isKingInCheck}
            onPress={() => handleCellPress(actualRow, actualCol)}
            disabled={
              !isMyTurn() ||
              (gameMode === "colyseus" &&
                (!mp.isMyTurn || mp.phase !== "playing"))
            }
            flipped={flipped}
          />,
        );
      }
    }

    return cells;
  };

  // ==========================================================================
  // Menu Screen
  // ==========================================================================

  if (gameMode === "menu") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            ♟️ Chess
          </Text>
          <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
            The classic game of strategy
          </Text>

          <View style={styles.menuButtons}>
            <Button
              mode="contained"
              onPress={startLocalGame}
              style={styles.menuButton}
              icon="account-multiple"
            >
              Local 2-Player
            </Button>

            <Button
              mode="contained"
              onPress={handleInviteFriend}
              style={styles.menuButton}
              icon="account-plus"
              loading={loading}
            >
              Invite Friend
            </Button>

            <Button
              mode="outlined"
              onPress={() => exitGame()}
              style={styles.menuButton}
              icon="arrow-left"
            >
              Back
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

  // ==========================================================================
  // Game Screen
  // ==========================================================================

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
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
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>Chess</Text>

        {gameMode === "online" && !isSpectator && (
          <TouchableOpacity onPress={handleResign} style={styles.resignButton}>
            <MaterialCommunityIcons
              name="flag"
              size={20}
              color={colors.error}
            />
          </TouchableOpacity>
        )}
        {gameMode === "colyseus" &&
          mp.isMultiplayer &&
          mp.phase === "playing" &&
          !isSpectator && (
            <TouchableOpacity
              onPress={() => setShowResignConfirm(true)}
              style={styles.resignButton}
            >
              <MaterialCommunityIcons
                name="flag"
                size={20}
                color={colors.error}
              />
            </TouchableOpacity>
          )}
      </View>

      {/* Opponent Info & Captured Pieces */}
      <View style={styles.playerInfo}>
        <View style={styles.playerNameContainer}>
          <Text style={[styles.playerName, { color: colors.textSecondary }]}>
            {gameMode === "colyseus"
              ? mp.opponentName || "Opponent"
              : gameMode === "online"
                ? opponentName
                : "Black"}
          </Text>
          {!isMyTurn() && gameMode !== "local" && (
            <View style={styles.turnIndicator} />
          )}
        </View>
        <CapturedPiecesDisplay pieces={capturedWhite} color="white" />
      </View>

      {/* Status */}
      <View style={styles.statusContainer}>
        <Text
          style={[
            styles.statusText,
            { color: colors.text },
            gameState.isCheck && styles.checkText,
          ]}
        >
          {getStatusText()}
        </Text>
      </View>

      {/* Board — Skia wood-grain gradient frame */}
      <SkiaGameBoard
        width={BOARD_SIZE}
        height={BOARD_SIZE}
        borderRadius={6}
        gradientColors={["#5D3A1A", "#3C2410", "#5D3A1A"]}
        borderColor="#7D5A2A"
        borderWidth={BOARD_BORDER}
        innerShadowBlur={6}
      >
        <View style={styles.board}>{renderBoard()}</View>
      </SkiaGameBoard>

      {/* Player Info & Captured Pieces */}
      <View style={styles.playerInfo}>
        <View style={styles.playerNameContainer}>
          <Text style={[styles.playerName, { color: colors.textSecondary }]}>
            {gameMode === "colyseus"
              ? mp.myName || "You"
              : gameMode === "online"
                ? userProfile?.displayName || "You"
                : "White"}
          </Text>
          {isMyTurn() && gameMode !== "local" && (
            <View style={styles.turnIndicator} />
          )}
        </View>
        <CapturedPiecesDisplay pieces={capturedBlack} color="black" />
      </View>

      {/* Move History */}
      {moveHistory.length > 0 && <MoveHistory moves={moveHistory} />}

      {/* Score (Local Game) */}
      {gameMode === "local" && (
        <View style={styles.scoreContainer}>
          <Text style={[styles.scoreText, { color: colors.text }]}>
            White: {scores.white} - Black: {scores.black}
          </Text>
        </View>
      )}

      {/* Promotion Modal */}
      <PromotionModal
        visible={promotionPending !== null}
        color={gameState.currentTurn}
        onSelect={handlePromotion}
      />

      {/* Game Over Modal */}
      <GameOverModal
        visible={showGameOverModal}
        result={gameResult || "draw"}
        stats={{
          moves: moveHistory.length,
          winMethod: winMethod,
          opponentName: gameMode === "online" ? opponentName : undefined,
        }}
        onRematch={handlePlayAgain}
        onExit={() => {
          setShowGameOverModal(false);
          setGameMode("menu");
        }}
        showRematch={true}
        showShare={false}
        title={
          gameState.isCheckmate
            ? `${winMethod}!`
            : gameState.isStalemate
              ? "Stalemate!"
              : "Game Over"
        }
      />

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
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
              player1: colors.primary,
              player2: colors.error,
            }}
            player1Label="White"
            player2Label="Black"
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
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
            }}
          />
        )}

      {/* Colyseus Multiplayer Overlays */}
      {gameMode === "colyseus" && (
        <>
          <TurnBasedWaitingOverlay
            colors={{
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
            }}
            onCancel={() => {
              mp.cancelMultiplayer();
              setGameMode("menu");
            }}
            gameName="Chess"
            visible={mp.phase === "waiting" || mp.phase === "connecting"}
          />

          <TurnBasedCountdownOverlay
            countdown={mp.countdown}
            colors={{
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
            }}
            visible={mp.phase === "countdown"}
          />

          <TurnBasedReconnectingOverlay
            colors={{
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
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
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
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
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
            }}
            onAccept={mp.acceptDraw}
            onDecline={mp.declineDraw}
          />

          <ResignConfirmDialog
            visible={showResignConfirm}
            colors={{
              primary: colors.primary,
              background: colors.background,
              surface: colors.surface,
              text: colors.text,
              textSecondary: colors.textSecondary,
              border: colors.border,
            }}
            onConfirm={() => {
              setShowResignConfirm(false);
              mp.resign();
            }}
            onCancel={() => setShowResignConfirm(false)}
          />
        </>
      )}

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

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  menuTitle: {
    fontSize: 48,
    fontWeight: "bold",
    marginBottom: Spacing.sm,
  },
  menuSubtitle: {
    fontSize: 16,
    marginBottom: Spacing.xl,
  },
  menuButtons: {
    width: "100%",
    maxWidth: 300,
    gap: Spacing.md,
  },
  menuButton: {
    marginVertical: Spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  resignButton: {
    padding: Spacing.xs,
  },
  playerInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  playerNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "500",
  },
  turnIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
  },
  capturedContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    maxWidth: 150,
  },
  capturedPiece: {
    fontSize: 16,
    marginHorizontal: 1,
  },
  statusContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
  },
  checkText: {
    color: "#e74c3c",
  },
  boardContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: BOARD_BORDER,
    borderColor: "#5D3A1A",
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedCell: {
    backgroundColor: SELECTED_HIGHLIGHT,
  },
  validMoveCell: {
    backgroundColor: VALID_MOVE_HIGHLIGHT,
  },
  lastMoveCell: {
    backgroundColor: LAST_MOVE_HIGHLIGHT,
  },
  checkCell: {
    backgroundColor: CHECK_HIGHLIGHT,
  },
  coordinateRank: {
    position: "absolute",
    top: 2,
    left: 2,
    fontSize: 10,
    fontWeight: "600",
  },
  coordinateFile: {
    position: "absolute",
    bottom: 2,
    right: 2,
    fontSize: 10,
    fontWeight: "600",
  },
  piece: {
    justifyContent: "center",
    alignItems: "center",
  },
  pieceText: {
    fontWeight: "bold",
  },
  validMoveIndicator: {
    width: CELL_SIZE * 0.3,
    height: CELL_SIZE * 0.3,
    borderRadius: CELL_SIZE * 0.15,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  captureIndicator: {
    position: "absolute",
    width: CELL_SIZE - 4,
    height: CELL_SIZE - 4,
    borderRadius: (CELL_SIZE - 4) / 2,
    borderWidth: 3,
    borderColor: "rgba(0, 0, 0, 0.3)",
  },
  moveHistoryContainer: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    maxHeight: 80,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  moveHistoryTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    opacity: 0.7,
  },
  moveHistoryScroll: {
    flex: 1,
  },
  moveRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  moveNumber: {
    width: 24,
    fontSize: 12,
    opacity: 0.6,
  },
  moveNotation: {
    width: 50,
    fontSize: 12,
    fontWeight: "500",
  },
  scoreContainer: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: "500",
  },
  promotionModal: {
    backgroundColor: "#fff",
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  promotionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  promotionOptions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  promotionOption: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: "#f0f0f0",
  },
  promotionPiece: {
    fontSize: 40,
  },
  gameOverModal: {
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  gameOverTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: Spacing.sm,
  },
  gameOverText: {
    fontSize: 16,
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  gameOverButtons: {
    width: "100%",
  },
});

export default withGameErrorBoundary(ChessGameScreen, "chess");
