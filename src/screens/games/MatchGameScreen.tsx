/**
 * MatchGameScreen — Match-3 Puzzle (Candy Crush style)
 *
 * How to play:
 * 1. Swap adjacent gems to create lines of 3+ matching colors
 * 2. Matches disappear and new gems fall from the top
 * 3. Cascading combos earn bonus points!
 * 4. Score as many points as possible in 30 moves
 *
 * Supports: Single-player puzzle, Colyseus multiplayer
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import {
  CountdownOverlay,
  GameOverOverlay,
  OpponentScoreBar,
  ReconnectingOverlay,
  WaitingOverlay,
} from "@/components/games/MultiplayerOverlay";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useMultiplayerGame } from "@/hooks/useMultiplayerGame";
import { useSpectator } from "@/hooks/useSpectator";
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
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GAME_TYPE = "match_game";
const GRID_SIZE = 7;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 48) / GRID_SIZE);
const TOTAL_MOVES = 30;
const NUM_GEM_TYPES = 6;

type GameState = "menu" | "playing" | "result";

interface GemCell {
  type: number; // 0-5 gem types
  id: number;
}

const GEM_ICONS = [
  { name: "diamond-stone", color: "#e74c3c" },
  { name: "hexagon", color: "#3498db" },
  { name: "triangle", color: "#27ae60" },
  { name: "circle", color: "#f39c12" },
  { name: "star", color: "#8e44ad" },
  { name: "square", color: "#e67e22" },
];

// =============================================================================
// Game Logic
// =============================================================================

let nextGemId = 0;

function createRandomGem(): GemCell {
  return { type: Math.floor(Math.random() * NUM_GEM_TYPES), id: nextGemId++ };
}

function createBoard(): GemCell[][] {
  nextGemId = 0;
  let board: GemCell[][];
  // Generate until no initial matches
  do {
    board = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => createRandomGem()),
    );
  } while (findMatches(board).length > 0);
  return board;
}

function findMatches(board: GemCell[][]): [number, number][] {
  const matched = new Set<string>();

  // Horizontal
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE - 2; c++) {
      if (
        board[r][c].type === board[r][c + 1].type &&
        board[r][c].type === board[r][c + 2].type
      ) {
        matched.add(`${r},${c}`);
        matched.add(`${r},${c + 1}`);
        matched.add(`${r},${c + 2}`);
      }
    }
  }

  // Vertical
  for (let r = 0; r < GRID_SIZE - 2; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (
        board[r][c].type === board[r + 1][c].type &&
        board[r][c].type === board[r + 2][c].type
      ) {
        matched.add(`${r},${c}`);
        matched.add(`${r + 1},${c}`);
        matched.add(`${r + 2},${c}`);
      }
    }
  }

  return Array.from(matched).map((s) => {
    const [r, c] = s.split(",").map(Number);
    return [r, c] as [number, number];
  });
}

function removeMatches(
  board: GemCell[][],
  matches: [number, number][],
): GemCell[][] {
  const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));

  // Mark matched cells as empty (type = -1)
  for (const [r, c] of matches) {
    newBoard[r][c] = { type: -1, id: -1 };
  }

  return newBoard;
}

function dropGems(board: GemCell[][]): GemCell[][] {
  const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));

  for (let c = 0; c < GRID_SIZE; c++) {
    // Collect non-empty gems from bottom
    const column: GemCell[] = [];
    for (let r = GRID_SIZE - 1; r >= 0; r--) {
      if (newBoard[r][c].type !== -1) {
        column.push(newBoard[r][c]);
      }
    }

    // Fill from bottom
    for (let r = GRID_SIZE - 1; r >= 0; r--) {
      const idx = GRID_SIZE - 1 - r;
      if (idx < column.length) {
        newBoard[r][c] = column[idx];
      } else {
        newBoard[r][c] = createRandomGem();
      }
    }
  }

  return newBoard;
}

function processBoard(board: GemCell[][]): {
  board: GemCell[][];
  totalMatched: number;
} {
  let currentBoard = board;
  let totalMatched = 0;

  // Keep processing cascades
  let matches = findMatches(currentBoard);
  while (matches.length > 0) {
    totalMatched += matches.length;
    currentBoard = removeMatches(currentBoard, matches);
    currentBoard = dropGems(currentBoard);
    matches = findMatches(currentBoard);
  }

  return { board: currentBoard, totalMatched };
}

function swapGems(
  board: GemCell[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): GemCell[][] {
  const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
  const temp = newBoard[r1][c1];
  newBoard[r1][c1] = newBoard[r2][c2];
  newBoard[r2][c2] = temp;
  return newBoard;
}

// =============================================================================
// Component
// =============================================================================

function MatchGameScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const __codexGameCompletion = useGameCompletion({ gameType: "match" });
  void __codexGameCompletion;
  useGameBackHandler({ gameType: "match", isGameOver: false });
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
  const { resolvedMode, firestoreGameId } = useGameConnection(
    GAME_TYPE,
    route?.params?.matchId,
  );
  const mp = useMultiplayerGame({
    gameType: GAME_TYPE,
    firestoreGameId: firestoreGameId ?? undefined,
  });

  useEffect(() => {
    if (resolvedMode === "colyseus" && firestoreGameId) {
      mp.startMultiplayer();
    }
  }, [resolvedMode, firestoreGameId]);

  const [gameState, setGameState] = useState<GameState>("menu");
  const [board, setBoard] = useState<GemCell[][]>([]);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(TOTAL_MOVES);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "match",
  });
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduleTimeout = useCallback(
    (callback: () => void, delayMs: number) => {
      const timeoutId = setTimeout(callback, delayMs);
      timeoutIdsRef.current.push(timeoutId);
      return timeoutId;
    },
    [],
  );

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current = [];
    };
  }, []);

  useEffect(() => {
    spectatorHost.startHosting();
  }, [spectatorHost.startHosting]);

  useEffect(() => {
    if (gameState !== "playing") return;
    spectatorHost.updateGameState(
      JSON.stringify({
        phase: gameState,
        board: board.map((row) => row.map((cell) => cell.type)),
        movesLeft,
      }),
      score,
      1,
      3,
    );
  }, [board, gameState, movesLeft, score, spectatorHost.updateGameState]);

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  const startGame = useCallback(() => {
    setBoard(createBoard());
    setScore(0);
    setMovesLeft(TOTAL_MOVES);
    setSelected(null);
    setIsProcessing(false);
    setGameState("playing");
    spectatorHost.startHosting();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [spectatorHost.startHosting]);

  const handleCellTap = useCallback(
    (r: number, c: number) => {
      if (gameState !== "playing" || isProcessing) return;

      if (!selected) {
        setSelected([r, c]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      const [sr, sc] = selected;

      // Must be adjacent
      const dist = Math.abs(sr - r) + Math.abs(sc - c);
      if (dist !== 1) {
        setSelected([r, c]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      // Try swap
      const swapped = swapGems(board, sr, sc, r, c);
      const matches = findMatches(swapped);

      if (matches.length === 0) {
        // Invalid swap — unselect
        setSelected(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      // Valid swap — process
      setIsProcessing(true);
      setSelected(null);
      const newMoves = movesLeft - 1;
      setMovesLeft(newMoves);

      const { board: processedBoard, totalMatched } = processBoard(swapped);
      const pointsEarned = totalMatched * 10;
      const newScore = score + pointsEarned;
      setScore(newScore);
      if (mp.isMultiplayer) mp.reportScore(newScore);
      setBoard(processedBoard);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setIsProcessing(false);

      // Check end
      if (newMoves <= 0) {
        if (currentFirebaseUser) {
          recordGameSession(currentFirebaseUser.uid, {
            gameId: GAME_TYPE,
            score: newScore,
            duration: TOTAL_MOVES * 2000,
          });
        }
        if (mp.isMultiplayer) mp.reportFinished();
        scheduleTimeout(() => {
          spectatorHost.endHosting(newScore);
          setGameState("result");
        }, 500);
      }
    },
    [
      board,
      gameState,
      selected,
      movesLeft,
      score,
      isProcessing,
      currentFirebaseUser,
      spectatorHost.endHosting,
      scheduleTimeout,
    ],
  );

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
        <Text style={[styles.title, { color: colors.text }]}>💎 Match</Text>
        {gameState === "playing" ? (
          <View style={styles.statsRow}>
            <Text style={[styles.statText, { color: colors.primary }]}>
              {movesLeft} moves
            </Text>
          </View>
        ) : spectatorHost.spectatorRoomId ? (
          <TouchableOpacity
            onPress={() => setShowSpectatorInvitePicker(true)}
            style={styles.backBtn}
            accessibilityLabel="Invite spectators"
          >
            <MaterialCommunityIcons name="eye" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>Match</Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Match 3 or more gems to score!
          </Text>
          {personalBest && (
            <Text style={[styles.bestText, { color: colors.primary }]}>
              Best: {personalBest.bestScore}
            </Text>
          )}
          <Button
            mode="contained"
            onPress={startGame}
            style={{ backgroundColor: colors.primary, marginTop: 24 }}
            labelStyle={{ color: "#fff" }}
          >
            Start Game
          </Button>
          {mp.isAvailable && (
            <Button
              mode="outlined"
              onPress={() => {
                mp.startMultiplayer().then(() => mp.sendReady());
              }}
              style={{ borderColor: colors.primary, marginTop: 12 }}
              textColor={colors.primary}
              icon="account-multiple"
            >
              Multiplayer
            </Button>
          )}
        </View>
      )}

      {gameState === "playing" && (
        <View style={styles.playArea}>
          {mp.isMultiplayer && mp.phase === "playing" && (
            <OpponentScoreBar
              opponentName={mp.opponentName}
              opponentScore={mp.opponentScore}
              myScore={score}
              timeRemaining={mp.timeRemaining}
              opponentDisconnected={mp.opponentDisconnected}
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
          {/* Score */}
          <Text style={[styles.scoreDisplay, { color: colors.text }]}>
            Score: {score}
          </Text>

          {/* Board */}
          <View style={[styles.boardContainer, { borderColor: colors.border }]}>
            {board.map((row, r) => (
              <View key={r} style={styles.boardRow}>
                {row.map((cell, c) => {
                  const isSelected =
                    selected && selected[0] === r && selected[1] === c;
                  const gem = GEM_ICONS[cell.type] || GEM_ICONS[0];
                  return (
                    <TouchableOpacity
                      key={`${cell.id}-${r}-${c}`}
                      onPress={() => handleCellTap(r, c)}
                      style={[
                        styles.gemCell,
                        {
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          borderColor: isSelected
                            ? colors.primary
                            : "rgba(255,255,255,0.08)",
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                      activeOpacity={0.6}
                    >
                      <Canvas
                        style={{ width: CELL_SIZE - 2, height: CELL_SIZE - 2 }}
                        pointerEvents="none"
                      >
                        <RoundedRect
                          x={0}
                          y={0}
                          width={CELL_SIZE - 2}
                          height={CELL_SIZE - 2}
                          r={4}
                        >
                          <LinearGradient
                            start={vec(0, 0)}
                            end={vec(0, CELL_SIZE - 2)}
                            colors={
                              isSelected
                                ? [`${colors.primary}40`, `${colors.primary}20`]
                                : [colors.surface, colors.surface]
                            }
                          />
                          <Shadow
                            dx={0}
                            dy={1}
                            blur={2}
                            color="rgba(0,0,0,0.15)"
                            inner
                          />
                        </RoundedRect>
                      </Canvas>
                      {cell.type >= 0 && (
                        <MaterialCommunityIcons
                          name={gem.name as keyof typeof MaterialCommunityIcons.glyphMap}
                          size={CELL_SIZE * 0.6}
                          color={gem.color}
                          style={{ position: "absolute" }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
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
            💎 Game Complete!
          </Dialog.Title>
          <Dialog.Content>
            <Text
              style={{
                color: colors.text,
                textAlign: "center",
                fontSize: 28,
                fontWeight: "800",
              }}
            >
              {score}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              points
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={startGame}>Play Again</Button>
            <Button onPress={() => setShowFriendPicker(true)}>Share</Button>
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
              score: score,
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
        title="Share Score With"
      />

      {spectatorHost.spectatorCount > 0 && (
        <SpectatorOverlay spectatorCount={spectatorHost.spectatorCount} />
      )}

      <SpectatorInviteModal
        visible={showSpectatorInvitePicker}
        onDismiss={() => setShowSpectatorInvitePicker(false)}
        currentUserId={currentFirebaseUser?.uid || ""}
        inviteData={
          spectatorHost.spectatorRoomId
            ? {
                roomId: spectatorHost.spectatorRoomId,
                gameType: "match",
                hostName: profile?.displayName || profile?.username || "Player",
              }
            : null
        }
        onInviteRef={(ref) => spectatorHost.registerInviteMessage(ref)}
        onSent={(name) => showSuccess(`Spectator invite sent to ${name}!`)}
        onError={showError}
      />

      <WaitingOverlay
        visible={mp.isMultiplayer && mp.phase === "waiting"}
        onCancel={mp.cancelMultiplayer}
        colors={{
          primary: colors.primary,
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        }}
      />
      <CountdownOverlay
        visible={mp.isMultiplayer && mp.phase === "countdown"}
        count={mp.countdown}
        colors={{
          primary: colors.primary,
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        }}
      />
      <ReconnectingOverlay
        visible={mp.isMultiplayer && mp.reconnecting}
        colors={{
          primary: colors.primary,
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        }}
      />
      <GameOverOverlay
        visible={mp.isMultiplayer && mp.phase === "finished"}
        isWinner={mp.isWinner}
        isTie={mp.isTie}
        winnerName={mp.winnerName}
        myScore={score}
        opponentScore={mp.opponentScore}
        opponentName={mp.opponentName}
        rematchRequested={mp.rematchRequested}
        onPlayAgain={startGame}
        onRematch={mp.requestRematch}
        onAcceptRematch={mp.acceptRematch}
        onMenu={() => {
          mp.cancelMultiplayer();
          setGameState("menu");
        }}
        onShare={() => setShowFriendPicker(true)}
        colors={{
          primary: colors.primary,
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        }}
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
  statsRow: { flexDirection: "row" },
  statText: { fontSize: 14, fontWeight: "700" },
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
  scoreDisplay: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  boardContainer: { borderWidth: 2, borderRadius: 8, overflow: "hidden" },
  boardRow: { flexDirection: "row" },
  gemCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  dialogActions: { justifyContent: "center" },
});

export default withGameErrorBoundary(MatchGameScreen, "match");
