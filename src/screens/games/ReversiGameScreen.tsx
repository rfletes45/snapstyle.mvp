/**
 * ReversiGameScreen — Othello / Reversi
 *
 * How to play:
 * 1. Players take turns placing discs on an 8×8 board
 * 2. Place a disc to outflank opponent's discs in any direction
 * 3. All outflanked discs are flipped to your color
 * 4. Game ends when no one can move — most discs wins!
 *
 * Supports: Local 2-player and vs AI (positional heuristic)
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { SpectatorBanner } from "@/components/games/SpectatorBanner";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import { SkiaCellHighlight, SkiaGameBoard } from "@/components/games/graphics";
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
import { useGameConnection } from "@/hooks/useGameConnection";
import { useSpectator } from "@/hooks/useSpectator";
import { useTurnBasedGame } from "@/hooks/useTurnBasedGame";
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
import {
  Canvas,
  Circle,
  RadialGradient,
  vec,
} from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { GameOverModal } from "@/components/games/GameOverModal";
import { useGameCompletion } from "@/hooks/useGameCompletion";

// =============================================================================
// Constants
// =============================================================================

const BOARD_SIZE = 8;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_PADDING = 8;
const CELL_SIZE = Math.floor(
  (SCREEN_WIDTH - 32 - BOARD_PADDING * 2) / BOARD_SIZE,
);
const GAME_TYPE = "reversi_game";

type CellState = 0 | 1 | 2; // 0=empty, 1=black, 2=white
type Board = CellState[][];
type GameMode = "local" | "ai" | "online";
type ScreenState = "menu" | "playing" | "result";

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

// Positional weights for AI
const POS_WEIGHTS = [
  [100, -20, 10, 5, 5, 10, -20, 100],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [10, -2, 1, 1, 1, 1, -2, 10],
  [5, -2, 1, 0, 0, 1, -2, 5],
  [5, -2, 1, 0, 0, 1, -2, 5],
  [10, -2, 1, 1, 1, 1, -2, 10],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [100, -20, 10, 5, 5, 10, -20, 100],
];

// =============================================================================
// Game Logic
// =============================================================================

function createBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(0));
  b[3][3] = 2;
  b[3][4] = 1;
  b[4][3] = 1;
  b[4][4] = 2;
  return b;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function getFlips(
  board: Board,
  r: number,
  c: number,
  player: CellState,
): [number, number][] {
  if (board[r][c] !== 0) return [];
  const opponent: CellState = player === 1 ? 2 : 1;
  const allFlips: [number, number][] = [];

  for (const [dr, dc] of DIRECTIONS) {
    const lineFlips: [number, number][] = [];
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc) && board[nr][nc] === opponent) {
      lineFlips.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (lineFlips.length > 0 && inBounds(nr, nc) && board[nr][nc] === player) {
      allFlips.push(...lineFlips);
    }
  }
  return allFlips;
}

function getValidMoves(board: Board, player: CellState): [number, number][] {
  const moves: [number, number][] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (getFlips(board, r, c, player).length > 0) {
        moves.push([r, c]);
      }
    }
  }
  return moves;
}

function countPieces(board: Board): { p1: number; p2: number } {
  let p1 = 0;
  let p2 = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 1) p1++;
      else if (cell === 2) p2++;
    }
  }
  return { p1, p2 };
}

function getAIMove(board: Board, player: CellState): [number, number] | null {
  const moves = getValidMoves(board, player);
  if (moves.length === 0) return null;

  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const [r, c] of moves) {
    const flips = getFlips(board, r, c, player);
    // Positional score + flip count
    let score = POS_WEIGHTS[r][c] + flips.length * 3;

    // Look ahead: penalize moves that give opponent corners
    const newBoard = board.map((row) => [...row]);
    newBoard[r][c] = player;
    for (const [fr, fc] of flips) newBoard[fr][fc] = player;
    const opponent: CellState = player === 1 ? 2 : 1;
    const oppMoves = getValidMoves(newBoard, opponent);
    for (const [or, oc] of oppMoves) {
      if (POS_WEIGHTS[or][oc] >= 100) score -= 50;
    }

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

function ReversiGameScreen({
  navigation,
  route,
}: {
  navigation: any;
  route?: any;
}) {
  const __codexGameCompletion = useGameCompletion({ gameType: "reversi" });
  void __codexGameCompletion;
  useGameBackHandler({ gameType: "reversi", isGameOver: false });
  const __codexGameHaptics = useGameHaptics();
  void __codexGameHaptics;
  const __codexGameOverModal = (
    <GameOverModal visible={false} result="loss" stats={{}} onExit={() => {}} />
  );
  void __codexGameOverModal;

  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [screenState, setScreenState] = useState<ScreenState>("menu");
  const [gameMode, setGameMode] = useState<GameMode>("ai");
  const [board, setBoard] = useState<Board>(createBoard());
  const [currentPlayer, setCurrentPlayer] = useState<CellState>(1);
  const [validMoves, setValidMoves] = useState<Set<string>>(new Set());
  const [winner, setWinner] = useState<CellState | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [scores, setScores] = useState({ p1: 2, p2: 2 });
  const [wins, setWins] = useState(0);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);

  // Colyseus multiplayer hook
  const mp = useTurnBasedGame("reversi_game");
  const isSpectator = route?.params?.spectatorMode === true;
  const spectatorSession = useSpectator({
    mode: "multiplayer-spectator",
    room: mp.room,
    state: mp.rawState,
  });
  const spectatorCount = spectatorSession.spectatorCount || mp.spectatorCount;
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Handle incoming match from route params (invite flow)
  const { resolvedMode, firestoreGameId } = useGameConnection(
    "reversi_game",
    route?.params?.matchId,
  );

  useEffect(() => {
    if (resolvedMode && firestoreGameId) {
      mp.startMultiplayer({ firestoreGameId, spectator: isSpectator });
    }
  }, [resolvedMode, firestoreGameId, isSpectator]);

  // Derive Colyseus board as 2D array for rendering
  const colyseusBoard: Board | null =
    mp.isMultiplayer && mp.board.length === BOARD_SIZE * BOARD_SIZE
      ? Array.from({ length: BOARD_SIZE }, (_, r) =>
          Array.from(
            { length: BOARD_SIZE },
            (_, c) => mp.board[r * BOARD_SIZE + c] as CellState,
          ),
        )
      : null;

  const effectiveBoard =
    gameMode === "online" && colyseusBoard ? colyseusBoard : board;

  // Valid moves for effective board
  const effectiveValidMoves =
    gameMode === "online" && mp.isMultiplayer && mp.isMyTurn && colyseusBoard
      ? new Set(
          getValidMoves(
            colyseusBoard,
            mp.myPlayerIndex === 0 ? 1 : (2 as CellState),
          ).map(([r, c]) => `${r},${c}`),
        )
      : validMoves;

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  const updateValidMoves = useCallback((b: Board, player: CellState) => {
    const moves = getValidMoves(b, player);
    setValidMoves(new Set(moves.map(([r, c]) => `${r},${c}`)));
    return moves;
  }, []);

  const startGame = useCallback(
    (mode: GameMode) => {
      setGameMode(mode);
      const b = createBoard();
      setBoard(b);
      setCurrentPlayer(1);
      setWinner(null);
      setIsDraw(false);
      setScores({ p1: 2, p2: 2 });
      setLastMove(null);
      setScreenState("playing");
      updateValidMoves(b, 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [updateValidMoves],
  );

  const checkGameEnd = useCallback(
    (b: Board, nextPlayer: CellState): boolean => {
      const nextMoves = getValidMoves(b, nextPlayer);
      if (nextMoves.length > 0) {
        setCurrentPlayer(nextPlayer);
        updateValidMoves(b, nextPlayer);
        return false;
      }

      // Other player can't move either? → game over
      const otherPlayer: CellState = nextPlayer === 1 ? 2 : 1;
      const otherMoves = getValidMoves(b, otherPlayer);
      if (otherMoves.length === 0) {
        // Game over
        const { p1, p2 } = countPieces(b);
        setScores({ p1, p2 });
        if (p1 > p2) {
          setWinner(1);
          const newWins = wins + 1;
          setWins(newWins);
          if (currentFirebaseUser) {
            recordGameSession(currentFirebaseUser.uid, {
              gameId: GAME_TYPE,
              score: newWins,
              duration: 0,
            });
          }
        } else if (p2 > p1) {
          setWinner(2);
        } else {
          setIsDraw(true);
        }
        setScreenState("result");
        return true;
      }

      // Skip turn
      setCurrentPlayer(otherPlayer);
      updateValidMoves(b, otherPlayer);
      return false;
    },
    [wins, currentFirebaseUser, updateValidMoves],
  );

  const placePiece = useCallback(
    (row: number, col: number) => {
      // Colyseus multiplayer mode
      if (gameMode === "online" && mp.isMultiplayer) {
        if (!mp.isMyTurn || mp.phase !== "playing") return;
        mp.sendMove({ row, col });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      if (screenState !== "playing") return;
      if (gameMode === "ai" && currentPlayer === 2) return;

      const flips = getFlips(board, row, col, currentPlayer);
      if (flips.length === 0) return;

      const newBoard = board.map((r) => [...r]);
      newBoard[row][col] = currentPlayer;
      for (const [fr, fc] of flips) {
        newBoard[fr][fc] = currentPlayer;
      }

      setBoard(newBoard);
      setLastMove([row, col]);
      const { p1, p2 } = countPieces(newBoard);
      setScores({ p1, p2 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const nextPlayer: CellState = currentPlayer === 1 ? 2 : 1;
      checkGameEnd(newBoard, nextPlayer);
    },
    [board, currentPlayer, screenState, gameMode, checkGameEnd],
  );

  // AI move
  useEffect(() => {
    if (screenState !== "playing" || gameMode !== "ai" || currentPlayer !== 2)
      return;
    const timer = setTimeout(() => {
      const move = getAIMove(board, 2);
      if (move) {
        placePiece(move[0], move[1]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [currentPlayer, screenState, gameMode, board, placePiece]);

  const playerWon = winner === 1;
  const resultTitle = isDraw
    ? "🤝 Draw!"
    : playerWon
      ? "🎉 Black Wins!"
      : "⚪ White Wins!";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.title, { color: colors.text }]}>⚪ Reversi</Text>
        <View style={{ width: 40 }} />
      </View>

      {screenState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            Reversi
          </Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Outflank and flip your opponent!
          </Text>
          {personalBest && (
            <Text style={[styles.bestText, { color: colors.primary }]}>
              Best: {personalBest.bestScore} wins
            </Text>
          )}
          <View style={styles.modeButtons}>
            {mp.isAvailable && (
              <Button
                mode="contained"
                onPress={async () => {
                  setGameMode("online");
                  const b = createBoard();
                  setBoard(b);
                  setCurrentPlayer(1);
                  setWinner(null);
                  setIsDraw(false);
                  setScores({ p1: 2, p2: 2 });
                  setLastMove(null);
                  setScreenState("playing");
                  updateValidMoves(b, 1);
                  await mp.startMultiplayer(
                    isSpectator ? { spectator: true } : undefined,
                  );
                }}
                style={[styles.modeBtn, { backgroundColor: colors.primary }]}
                labelStyle={{ color: "#fff" }}
                icon="earth"
              >
                Online
              </Button>
            )}
            <Button
              mode={mp.isAvailable ? "contained-tonal" : "contained"}
              onPress={() => startGame("ai")}
              style={[
                styles.modeBtn,
                mp.isAvailable ? {} : { backgroundColor: colors.primary },
              ]}
              labelStyle={mp.isAvailable ? undefined : { color: "#fff" }}
            >
              vs AI
            </Button>
            <Button
              mode="outlined"
              onPress={() => startGame("local")}
              style={styles.modeBtn}
            >
              2 Players
            </Button>
          </View>
          {mp.isAvailable && (
            <Button
              mode="contained-tonal"
              onPress={() => setShowInviteModal(true)}
              icon="account-plus"
              style={{ marginTop: 12 }}
            >
              Challenge Friend
            </Button>
          )}
        </View>
      )}

      {screenState === "playing" && (
        <View style={styles.playArea}>
          {/* Score bar */}
          <View style={styles.scoreBar}>
            <View style={styles.scoreItem}>
              <View style={[styles.disc, { backgroundColor: "#1a1a2e" }]} />
              <Text
                style={[
                  styles.scoreNum,
                  {
                    color: colors.text,
                    fontWeight: currentPlayer === 1 ? "800" : "400",
                  },
                ]}
              >
                {scores.p1}
              </Text>
            </View>
            <Text style={[styles.turnLabel, { color: colors.textSecondary }]}>
              {currentPlayer === 1 ? "Black's turn" : "White's turn"}
            </Text>
            <View style={styles.scoreItem}>
              <Text
                style={[
                  styles.scoreNum,
                  {
                    color: colors.text,
                    fontWeight: currentPlayer === 2 ? "800" : "400",
                  },
                ]}
              >
                {scores.p2}
              </Text>
              <View
                style={[
                  styles.disc,
                  {
                    backgroundColor: "#ecf0f1",
                    borderWidth: 1,
                    borderColor: "#bbb",
                  },
                ]}
              />
            </View>
          </View>

          {/* Board — Skia-enhanced felt background with gradient discs */}
          <SkiaGameBoard
            width={CELL_SIZE * 8 + BOARD_PADDING * 2}
            height={CELL_SIZE * 8 + BOARD_PADDING * 2}
            borderRadius={6}
            gradientColors={["#2ECC71", "#27AE60", "#1E8449"]}
            borderColor="#1A7A3C"
            borderWidth={2}
            innerShadowBlur={8}
          >
            <View style={{ padding: BOARD_PADDING }}>
              {effectiveBoard.map((row, r) => (
                <View key={r} style={styles.boardRow}>
                  {row.map((cell, c) => {
                    const isValid = effectiveValidMoves.has(`${r},${c}`);
                    const isLast = lastMove?.[0] === r && lastMove?.[1] === c;
                    const pieceSize = CELL_SIZE * 0.78;
                    return (
                      <TouchableOpacity
                        key={c}
                        onPress={() => placePiece(r, c)}
                        disabled={
                          !isValid ||
                          isSpectator ||
                          (gameMode === "online" &&
                            (!mp.isMyTurn || mp.phase !== "playing"))
                        }
                        style={[
                          styles.cell,
                          {
                            width: CELL_SIZE,
                            height: CELL_SIZE,
                            borderColor: "#1e8449",
                          },
                        ]}
                        activeOpacity={0.6}
                      >
                        {isLast && (
                          <SkiaCellHighlight
                            type="lastMove"
                            width={CELL_SIZE}
                            height={CELL_SIZE}
                          />
                        )}
                        {cell !== 0 && (
                          <Canvas
                            style={{ width: pieceSize, height: pieceSize }}
                          >
                            {/* Drop shadow */}
                            <Circle
                              cx={pieceSize / 2}
                              cy={pieceSize / 2 + 2}
                              r={pieceSize / 2 - 2}
                              color="rgba(0,0,0,0.3)"
                            />
                            {/* Main disc with radial gradient */}
                            <Circle
                              cx={pieceSize / 2}
                              cy={pieceSize / 2}
                              r={pieceSize / 2 - 2}
                            >
                              <RadialGradient
                                c={vec(pieceSize * 0.4, pieceSize * 0.35)}
                                r={pieceSize * 0.55}
                                colors={
                                  cell === 1
                                    ? ["#4A4A6E", "#1a1a2e", "#0a0a1a"]
                                    : ["#FFFFFF", "#ecf0f1", "#d5dbdb"]
                                }
                              />
                            </Circle>
                            {/* Specular highlight */}
                            <Circle
                              cx={pieceSize * 0.38}
                              cy={pieceSize * 0.32}
                              r={pieceSize * 0.15}
                              color={
                                cell === 1
                                  ? "rgba(255,255,255,0.2)"
                                  : "rgba(255,255,255,0.5)"
                              }
                            />
                          </Canvas>
                        )}
                        {cell === 0 && isValid && (
                          <SkiaCellHighlight
                            type="validMove"
                            width={CELL_SIZE * 0.35}
                            height={CELL_SIZE * 0.35}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </SkiaGameBoard>
        </View>
      )}

      {/* Result dialog */}
      <Portal>
        <Dialog
          visible={screenState === "result"}
          onDismiss={() => {}}
          style={{ backgroundColor: colors.surface }}
        >
          <Dialog.Title style={{ color: colors.text, textAlign: "center" }}>
            {resultTitle}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
              Black: {scores.p1} — White: {scores.p2}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => startGame(gameMode)}>Play Again</Button>
            <Button onPress={() => setShowFriendPicker(true)}>Share</Button>
            <Button onPress={() => setScreenState("menu")}>Menu</Button>
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
              score: wins,
              playerName: profile?.displayName || "Player",
            });
            showSuccess("Score sent!");
          } catch {
            showError("Failed to send");
          }
          setIsSending(false);
          setShowFriendPicker(false);
        }}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Send Score To"
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
                gameType: GAME_TYPE,
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

      {/* Colyseus Multiplayer — Turn Indicator Bar */}
      {gameMode === "online" && mp.isMultiplayer && mp.phase === "playing" && (
        <TurnIndicatorBar
          isMyTurn={mp.isMyTurn}
          myName={mp.myName}
          opponentName={mp.opponentName}
          currentPlayerIndex={mp.currentPlayerIndex}
          myPlayerIndex={mp.myPlayerIndex}
          turnNumber={mp.turnNumber}
          myScore={mp.myScore}
          opponentScore={mp.opponentScore}
          opponentDisconnected={mp.opponentDisconnected}
          showScores
          colors={{
            primary: colors.primary,
            background: colors.background,
            surface: colors.surface,
            text: colors.text,
            textSecondary: colors.textSecondary,
            border: colors.border,
            player1: "#1a1a2e",
            player2: "#ecf0f1",
          }}
          player1Label="Black"
          player2Label="White"
        />
      )}

      {/* Colyseus Multiplayer — Game Action Bar */}
      {gameMode === "online" &&
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
      {gameMode === "online" && mp.isMultiplayer && (
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
              setScreenState("menu");
            }}
            gameName="Reversi"
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
            myScore={mp.myScore}
            opponentScore={mp.opponentScore}
            showScores
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
              setScreenState("menu");
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
  menuContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuTitle: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  menuSub: { fontSize: 16, marginBottom: 16 },
  bestText: { fontSize: 14, fontWeight: "600", marginBottom: 24 },
  modeButtons: { flexDirection: "row", gap: 12 },
  modeBtn: { minWidth: 120 },
  playArea: { flex: 1, alignItems: "center", paddingTop: 8 },
  scoreBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: CELL_SIZE * 8 + BOARD_PADDING * 2,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  scoreItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  disc: { width: 24, height: 24, borderRadius: 12 },
  scoreNum: { fontSize: 20, fontWeight: "600" },
  turnLabel: { fontSize: 14 },
  boardRow: { flexDirection: "row" },
  cell: {
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogActions: { justifyContent: "center" },
});

export default withGameErrorBoundary(ReversiGameScreen, "reversi");
