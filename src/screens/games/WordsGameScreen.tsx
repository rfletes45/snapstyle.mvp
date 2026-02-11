/**
 * WordsGameScreen — Scrabble-Lite / Word Builder
 *
 * How to play:
 * 1. You have a rack of 7 letter tiles
 * 2. Place tiles on the 9×9 board to form words
 * 3. Bonus squares multiply your score (DL, TL, DW, TW)
 * 4. First word must cross center. Subsequent words must connect.
 * 5. Play vs AI opponent
 *
 * Supports: Turn-based vs AI, future multiplayer
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import {
  ResignConfirmDialog,
  TurnBasedCountdownOverlay,
  TurnBasedGameOverOverlay,
  TurnBasedReconnectingOverlay,
  TurnBasedWaitingOverlay,
  TurnIndicatorBar,
} from "@/components/games/TurnBasedOverlay";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useSpectator } from "@/hooks/useSpectator";
import { useWordsGame } from "@/hooks/useWordsGame";
import { sendGameInvite } from "@/services/gameInvites";
import type { InviteGameType } from "@/services/gameInvites";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
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
const GAME_TYPE = "words_game";
const BOARD_SIZE = 9;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 32) / BOARD_SIZE);
const RACK_SIZE = 7;
const MAX_ROUNDS = 10;

type GameState = "menu" | "playing" | "result" | "colyseus";

interface BoardCell {
  letter: string;
  bonus: "" | "DL" | "TL" | "DW" | "TW" | "★";
  owner: "player" | "ai" | "temp" | "";
}

// Letter distribution and values
const LETTER_VALUES: Record<string, number> = {
  A: 1,
  B: 3,
  C: 3,
  D: 2,
  E: 1,
  F: 4,
  G: 2,
  H: 4,
  I: 1,
  J: 8,
  K: 5,
  L: 1,
  M: 3,
  N: 1,
  O: 1,
  P: 3,
  Q: 10,
  R: 1,
  S: 1,
  T: 1,
  U: 1,
  V: 4,
  W: 4,
  X: 8,
  Y: 4,
  Z: 10,
};

const LETTER_BAG =
  "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTTTTUUUUVVWWXYYZ".split(
    "",
  );

// Bonus square positions for 9×9 board
function getBonusSquare(r: number, c: number): BoardCell["bonus"] {
  const center = 4;
  if (r === center && c === center) return "★";
  // Triple word: corners
  if ((r === 0 || r === 8) && (c === 0 || c === 8)) return "TW";
  // Double word: sub-corners
  if ((r === 1 || r === 7) && (c === 1 || c === 7)) return "DW";
  if ((r === 2 || r === 6) && (c === 2 || c === 6)) return "DW";
  // Triple letter
  if ((r === 0 || r === 8) && c === 4) return "TL";
  if (r === 4 && (c === 0 || c === 8)) return "TL";
  // Double letter
  if ((r === 0 || r === 8) && (c === 2 || c === 6)) return "DL";
  if ((r === 2 || r === 6) && (c === 0 || c === 8)) return "DL";
  if ((r === 3 || r === 5) && (c === 3 || c === 5)) return "DL";
  return "";
}

function createBoard(): BoardCell[][] {
  return Array.from({ length: BOARD_SIZE }, (_, r) =>
    Array.from({ length: BOARD_SIZE }, (_, c) => ({
      letter: "",
      bonus: getBonusSquare(r, c),
      owner: "" as const,
    })),
  );
}

function drawTiles(
  bag: string[],
  count: number,
): { tiles: string[]; remaining: string[] } {
  const shuffled = [...bag].sort(() => Math.random() - 0.5);
  return {
    tiles: shuffled.slice(0, Math.min(count, shuffled.length)),
    remaining: shuffled.slice(Math.min(count, shuffled.length)),
  };
}

// Simple word validation (5-letter+ common words)
const VALID_WORDS = new Set([
  "THE",
  "AND",
  "FOR",
  "ARE",
  "BUT",
  "NOT",
  "YOU",
  "ALL",
  "CAN",
  "HER",
  "WAS",
  "ONE",
  "OUR",
  "OUT",
  "DAY",
  "HAD",
  "HAS",
  "HIS",
  "HOW",
  "MAN",
  "NEW",
  "NOW",
  "OLD",
  "SEE",
  "WAY",
  "WHO",
  "BOY",
  "DID",
  "GET",
  "HIM",
  "LET",
  "SAY",
  "SHE",
  "TOO",
  "USE",
  "CAT",
  "DOG",
  "RUN",
  "SIT",
  "TOP",
  "RED",
  "BIG",
  "SUN",
  "FUN",
  "RAN",
  "SET",
  "PUT",
  "GOT",
  "CUT",
  "HOT",
  "TEN",
  "BED",
  "PEN",
  "BAD",
  "SAD",
  "MAD",
  "MAP",
  "CUP",
  "HAT",
  "BAT",
  "RAT",
  "FAT",
  "SAT",
  "PIN",
  "WIN",
  "TIN",
  "BIN",
  "DIN",
  "FIN",
  "GIN",
  "AT",
  "IN",
  "ON",
  "IT",
  "IS",
  "IF",
  "OF",
  "OR",
  "UP",
  "NO",
  "SO",
  "GO",
  "TO",
  "AN",
  "AM",
  "AS",
  "BE",
  "BY",
  "DO",
  "HE",
  "ME",
  "MY",
  "WE",
  "GAME",
  "PLAY",
  "WORD",
  "TILE",
  "RACK",
  "TURN",
  "SWAP",
  "DRAW",
  "BOARD",
  "SCORE",
  "BONUS",
  "ROUND",
  "MATCH",
  "POINT",
  "PLACE",
  "SPACE",
  "THINK",
  "ABOUT",
  "AFTER",
  "AGAIN",
  "BELOW",
  "COULD",
  "EVERY",
  "FIRST",
  "FOUND",
  "GREAT",
  "HOUSE",
  "LARGE",
  "LEARN",
  "NEVER",
  "OTHER",
  "PLANT",
  "QUITE",
  "RIGHT",
  "SMALL",
  "STILL",
  "STUDY",
  "THEIR",
  "THERE",
  "THESE",
  "THREE",
  "UNDER",
  "WATER",
  "WHERE",
  "WHICH",
  "WORLD",
  "WOULD",
  "WRITE",
  "YOUNG",
  "HEART",
  "LIGHT",
  "NIGHT",
  "POWER",
  "QUEEN",
  "QUICK",
  "STORM",
]);

// =============================================================================
// Component
// =============================================================================

function WordsGameScreen({
  navigation,
  route,
}: {
  navigation: any;
  route?: any;
}) {
  const __codexGameCompletion = useGameCompletion({ gameType: "words" });
  void __codexGameCompletion;

  useGameBackHandler({ gameType: "words", isGameOver: false });
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

  const [gameState, setGameState] = useState<GameState>("menu");
  const [board, setBoard] = useState<BoardCell[][]>(createBoard());
  const [rack, setRack] = useState<string[]>([]);
  const [bag, setBag] = useState<string[]>([]);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [round, setRound] = useState(1);
  const [placedThisTurn, setPlacedThisTurn] = useState<[number, number][]>([]);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [showResignDialog, setShowResignDialog] = useState(false);
  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "words",
  });
  const hasEndedSpectatorRef = useRef(false);
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

  // ── Colyseus multiplayer hook ──────────────────────────────────────
  const mp = useWordsGame("words_game");

  // Handle incoming match from route params (invite flow)
  const { resolvedMode, firestoreGameId } = useGameConnection(
    "words_game",
    route?.params?.matchId,
  );

  useEffect(() => {
    if (resolvedMode && firestoreGameId) {
      setGameState("colyseus");
      mp.startMultiplayer({ firestoreGameId });
    }
  }, [resolvedMode, firestoreGameId]);

  const isColyseus = gameState === "colyseus";

  // Derive board from Colyseus state when in multiplayer
  const colyseusBoard: BoardCell[][] = useMemo(() => {
    if (!isColyseus || mp.board.length === 0) return createBoard();
    return Array.from({ length: BOARD_SIZE }, (_, r) =>
      Array.from({ length: BOARD_SIZE }, (_, c) => {
        const idx = r * BOARD_SIZE + c;
        const val = mp.board[idx] ?? 0;
        const ownerId = mp.boardOwners[idx] ?? "";
        const letter = val > 0 ? String.fromCharCode(64 + val) : "";
        const owner: BoardCell["owner"] =
          ownerId === String(mp.myPlayerIndex + 1)
            ? "player"
            : ownerId !== ""
              ? "ai"
              : "";
        return { letter, bonus: getBonusSquare(r, c), owner };
      }),
    );
  }, [isColyseus, mp.board, mp.boardOwners, mp.myPlayerIndex]);

  // Effective board / rack / scores for rendering
  const effectiveBoard = isColyseus ? colyseusBoard : board;
  const effectiveRack = isColyseus ? mp.rack : rack;
  const effectivePlayerScore = isColyseus ? mp.myScore : playerScore;
  const effectiveAiScore = isColyseus ? mp.opponentScore : aiScore;
  const effectiveIsPlayerTurn = isColyseus ? mp.isMyTurn : isPlayerTurn;

  useEffect(() => {
    if (gameState === "playing") {
      hasEndedSpectatorRef.current = false;
      spectatorHost.updateGameState(
        JSON.stringify({
          phase: gameState,
          board: effectiveBoard.map((row) => row.map((cell) => cell.letter)),
          rack: effectiveRack,
          round,
          isPlayerTurn: effectiveIsPlayerTurn,
        }),
        effectivePlayerScore,
        round,
        MAX_ROUNDS - round + 1,
      );
      return;
    }

    if (
      gameState === "result" &&
      !hasEndedSpectatorRef.current
    ) {
      hasEndedSpectatorRef.current = true;
      spectatorHost.endHosting(effectivePlayerScore);
    }
  }, [
    effectiveBoard,
    effectiveIsPlayerTurn,
    effectivePlayerScore,
    effectiveRack,
    gameState,
    round,
    spectatorHost.endHosting,
    spectatorHost.updateGameState,
  ]);

  // Sync Colyseus phase → local game state
  useEffect(() => {
    if (!mp.isMultiplayer) return;
    if (mp.phase === "playing" && gameState !== "colyseus") {
      setGameState("colyseus");
      setPlacedThisTurn([]);
      setSelectedTile(null);
    }
  }, [mp.phase, mp.isMultiplayer, gameState]);

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  const startGame = useCallback(() => {
    const shuffledBag = [...LETTER_BAG].sort(() => Math.random() - 0.5);
    const { tiles, remaining } = drawTiles(shuffledBag, RACK_SIZE);
    setBoard(createBoard());
    setRack(tiles);
    setBag(remaining);
    setSelectedTile(null);
    setPlayerScore(0);
    setAiScore(0);
    setRound(1);
    setPlacedThisTurn([]);
    setIsPlayerTurn(true);
    setGameState("playing");
    hasEndedSpectatorRef.current = false;
    spectatorHost.startHosting();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [spectatorHost.startHosting]);

  const handleCellTap = useCallback(
    (r: number, c: number) => {
      if (!effectiveIsPlayerTurn || selectedTile === null) return;

      const activeBoard = isColyseus ? colyseusBoard : board;
      // Also check locally-placed tiles for Colyseus
      const cellOccupied =
        activeBoard[r][c].letter !== "" ||
        (isColyseus && placedThisTurn.some(([pr, pc]) => pr === r && pc === c));
      if (cellOccupied) return;

      const activeRack = isColyseus ? mp.rack : rack;
      const letter = activeRack[selectedTile];

      if (!isColyseus) {
        const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
        newBoard[r][c] = { ...newBoard[r][c], letter, owner: "temp" };
        setBoard(newBoard);
        setRack((prev) => prev.filter((_, i) => i !== selectedTile));
      }
      // In Colyseus mode, tiles are tracked locally until submit but rack updates are visual-only
      setSelectedTile(null);
      setPlacedThisTurn((prev) => [...prev, [r, c]]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [
      board,
      rack,
      selectedTile,
      isColyseus,
      colyseusBoard,
      mp.rack,
      effectiveIsPlayerTurn,
      placedThisTurn,
    ],
  );

  const recallTiles = useCallback(() => {
    if (!isColyseus) {
      const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
      const recalled: string[] = [];
      for (const [r, c] of placedThisTurn) {
        recalled.push(newBoard[r][c].letter);
        newBoard[r][c] = { ...newBoard[r][c], letter: "", owner: "" };
      }
      setBoard(newBoard);
      setRack((prev) => [...prev, ...recalled]);
    }
    // In Colyseus mode, rack is managed by server; just clear local placement tracking
    setPlacedThisTurn([]);
    setSelectedTile(null);
  }, [board, placedThisTurn, isColyseus]);

  const scoreWord = useCallback(
    (positions: [number, number][], boardState: BoardCell[][]): number => {
      let wordScore = 0;
      let wordMultiplier = 1;

      for (const [r, c] of positions) {
        const cell = boardState[r][c];
        let letterVal = LETTER_VALUES[cell.letter] || 0;

        if (cell.bonus === "DL") letterVal *= 2;
        else if (cell.bonus === "TL") letterVal *= 3;
        else if (cell.bonus === "DW" || cell.bonus === "★") wordMultiplier *= 2;
        else if (cell.bonus === "TW") wordMultiplier *= 3;

        wordScore += letterVal;
      }

      return wordScore * wordMultiplier;
    },
    [],
  );

  const submitWord = useCallback(() => {
    if (placedThisTurn.length === 0) return;

    // ── Colyseus multiplayer branch ──
    if (isColyseus) {
      const tiles = placedThisTurn.map(([r, c]) => {
        // Find the letter that was placed here from local tracking
        const idx = placedThisTurn.indexOf(
          placedThisTurn.find(([pr, pc]) => pr === r && pc === c)!,
        );
        const letter = mp.rack[idx] ?? "";
        return { row: r, col: c, letter };
      });
      mp.submitWord(tiles);
      setPlacedThisTurn([]);
      setSelectedTile(null);
      return;
    }

    // Check if tiles are in a line
    const rows = placedThisTurn.map(([r]) => r);
    const cols = placedThisTurn.map(([, c]) => c);
    const isHorizontal = new Set(rows).size === 1;
    const isVertical = new Set(cols).size === 1;

    if (!isHorizontal && !isVertical) {
      showError("Tiles must be in a line!");
      return;
    }

    // Read the word
    const sorted = [...placedThisTurn].sort((a, b) =>
      isHorizontal ? a[1] - b[1] : a[0] - b[0],
    );

    // Include any existing tiles between placed tiles
    const allPositions: [number, number][] = [];
    if (isHorizontal) {
      const r = sorted[0][0];
      const minC = sorted[0][1];
      const maxC = sorted[sorted.length - 1][1];
      for (let c = minC; c <= maxC; c++) {
        if (board[r][c].letter) allPositions.push([r, c]);
      }
    } else {
      const c = sorted[0][1];
      const minR = sorted[0][0];
      const maxR = sorted[sorted.length - 1][0];
      for (let r = minR; r <= maxR; r++) {
        if (board[r][c].letter) allPositions.push([r, c]);
      }
    }

    const word = allPositions.map(([r, c]) => board[r][c].letter).join("");

    if (word.length < 2) {
      showError("Word must be at least 2 letters!");
      return;
    }

    // Validate word
    if (!VALID_WORDS.has(word)) {
      showError(`"${word}" is not in the dictionary!`);
      return;
    }

    // Score it
    const points = scoreWord(allPositions, board);
    setPlayerScore((prev) => prev + points);
    showSuccess(`${word} = ${points} points!`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Lock tiles
    const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
    for (const [r, c] of placedThisTurn) {
      newBoard[r][c].owner = "player";
    }
    setBoard(newBoard);
    setPlacedThisTurn([]);

    // Draw new tiles
    const { tiles, remaining } = drawTiles(bag, RACK_SIZE - rack.length);
    setRack((prev) => [...prev, ...tiles]);
    setBag(remaining);

    // AI turn
    setIsPlayerTurn(false);
    scheduleTimeout(() => {
      // Simple AI: place random letters
      const aiRack = drawTiles(remaining, RACK_SIZE);
      let aiPoints = 0;

      // AI tries to place a 2-3 letter word randomly
      const aiBoard = newBoard.map((row) => row.map((cell) => ({ ...cell })));
      const emptyCells: [number, number][] = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE - 1; c++) {
          if (aiBoard[r][c].letter === "" && aiBoard[r][c + 1].letter === "") {
            emptyCells.push([r, c]);
          }
        }
      }

      if (emptyCells.length > 0 && aiRack.tiles.length >= 2) {
        const [ar, ac] =
          emptyCells[Math.floor(Math.random() * emptyCells.length)];
        aiBoard[ar][ac] = {
          ...aiBoard[ar][ac],
          letter: aiRack.tiles[0],
          owner: "ai",
        };
        aiBoard[ar][ac + 1] = {
          ...aiBoard[ar][ac + 1],
          letter: aiRack.tiles[1],
          owner: "ai",
        };
        aiPoints =
          (LETTER_VALUES[aiRack.tiles[0]] || 1) +
          (LETTER_VALUES[aiRack.tiles[1]] || 1);
      }

      setAiScore((prev) => prev + aiPoints);
      setBoard(aiBoard);
      setBag(aiRack.remaining);
      setIsPlayerTurn(true);

      const newRound = round + 1;
      setRound(newRound);

      if (newRound > MAX_ROUNDS) {
        const finalPlayerScore = playerScore + points;
        if (currentFirebaseUser) {
          recordGameSession(currentFirebaseUser.uid, {
            gameId: GAME_TYPE,
            score: finalPlayerScore,
            duration: MAX_ROUNDS * 5000,
          });
        }
        scheduleTimeout(() => setGameState("result"), 500);
      }
    }, 800);
  }, [
    placedThisTurn,
    board,
    bag,
    rack,
    round,
    playerScore,
    scoreWord,
    showError,
    showSuccess,
    currentFirebaseUser,
    isColyseus,
    mp,
    scheduleTimeout,
  ]);

  const bonusGradient = (bonus: BoardCell["bonus"]): [string, string] => {
    switch (bonus) {
      case "DL":
        return ["#4AAEE8", "#3498DB"];
      case "TL":
        return ["#3FA0D8", "#2980B9"];
      case "DW":
        return ["#F16B6B", "#E74C3C"];
      case "TW":
        return ["#D84B4B", "#C0392B"];
      case "★":
        return ["#F5B041", "#F39C12"];
      default:
        return ["transparent", "transparent"];
    }
  };

  const bonusColor = (bonus: BoardCell["bonus"]): string => {
    switch (bonus) {
      case "DL":
        return "#3498db40";
      case "TL":
        return "#2980b960";
      case "DW":
        return "#e74c3c40";
      case "TW":
        return "#c0392b60";
      case "★":
        return "#f39c1240";
      default:
        return "transparent";
    }
  };

  // ── Colyseus actions ──────────────────────────────────────────────
  const handlePassTurn = useCallback(() => {
    if (isColyseus) {
      mp.passTurn();
    }
  }, [isColyseus, mp]);

  // Overlay colors for TurnBased components
  const overlayColors = useMemo(
    () => ({
      primary: colors.primary,
      background: colors.background,
      surface: colors.surface,
      text: colors.text,
      textSecondary: colors.textSecondary,
      border: colors.border,
    }),
    [colors],
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
        <Text style={[styles.title, { color: colors.text }]}>📝 Words</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {gameState === "playing" ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Rd {round}/{MAX_ROUNDS}
            </Text>
          ) : gameState === "colyseus" ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Turn {mp.turnNumber}
            </Text>
          ) : (
            <View style={{ width: 30 }} />
          )}
          {spectatorHost.spectatorRoomId && (
            <TouchableOpacity
              onPress={() => setShowSpectatorInvitePicker(true)}
              accessibilityLabel="Invite spectators"
            >
              <MaterialCommunityIcons
                name="eye"
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>Words</Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Build words on the board for points!
          </Text>
          {personalBest && (
            <Text style={[styles.bestText, { color: colors.primary }]}>
              Best: {personalBest.bestScore}
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

      {(gameState === "playing" || gameState === "colyseus") && (
        <ScrollView contentContainerStyle={styles.playArea}>
          {/* Colyseus turn indicator bar */}
          {isColyseus && mp.phase === "playing" && (
            <TurnIndicatorBar
              isMyTurn={mp.isMyTurn}
              myName={mp.myName}
              opponentName={mp.opponentName}
              currentPlayerIndex={
                mp.isMyTurn ? mp.myPlayerIndex : 1 - mp.myPlayerIndex
              }
              myPlayerIndex={mp.myPlayerIndex}
              turnNumber={mp.turnNumber}
              myScore={mp.myScore}
              opponentScore={mp.opponentScore}
              opponentDisconnected={mp.opponentDisconnected}
              lastMoveNotation={mp.lastMoveNotation}
              colors={overlayColors}
              showScores
            />
          )}

          {/* Score display */}
          {!isColyseus && (
            <View style={styles.scoresRow}>
              <View style={styles.scoreBox}>
                <Text
                  style={{ color: "#3498db", fontSize: 12, fontWeight: "600" }}
                >
                  You
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 20,
                    fontWeight: "800",
                  }}
                >
                  {effectivePlayerScore}
                </Text>
              </View>
              <Text style={{ color: colors.textSecondary }}>
                {effectiveIsPlayerTurn ? "Your Turn" : "AI thinking..."}
              </Text>
              <View style={styles.scoreBox}>
                <Text
                  style={{ color: "#e74c3c", fontSize: 12, fontWeight: "600" }}
                >
                  AI
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 20,
                    fontWeight: "800",
                  }}
                >
                  {effectiveAiScore}
                </Text>
              </View>
            </View>
          )}

          {/* Bag remaining (Colyseus only) */}
          {isColyseus && (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              Bag: {mp.bagRemaining} tiles remaining
            </Text>
          )}

          {/* Board */}
          <View style={[styles.boardContainer, { borderColor: colors.border }]}>
            {effectiveBoard.map((row, r) => (
              <View key={r} style={styles.boardRow}>
                {row.map((cell, c) => {
                  // In Colyseus mode, overlay locally-placed tiles
                  const localPlacement = isColyseus
                    ? placedThisTurn.findIndex(
                        ([pr, pc]) => pr === r && pc === c,
                      )
                    : -1;
                  const displayLetter =
                    localPlacement >= 0
                      ? (mp.rack[localPlacement] ?? "")
                      : cell.letter;
                  const displayOwner: BoardCell["owner"] =
                    localPlacement >= 0 ? "temp" : cell.owner;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => handleCellTap(r, c)}
                      style={[
                        styles.boardCell,
                        {
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          borderColor: "rgba(255,255,255,0.08)",
                        },
                      ]}
                      disabled={!effectiveIsPlayerTurn || displayLetter !== ""}
                    >
                      <Canvas
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                      >
                        <RoundedRect
                          x={0}
                          y={0}
                          width={CELL_SIZE - 2}
                          height={CELL_SIZE - 2}
                          r={2}
                        >
                          {cell.bonus && !displayLetter ? (
                            <>
                              <LinearGradient
                                start={vec(0, 0)}
                                end={vec(0, CELL_SIZE - 2)}
                                colors={[
                                  `${bonusGradient(cell.bonus)[0]}40`,
                                  `${bonusGradient(cell.bonus)[1]}25`,
                                ]}
                              />
                              <Shadow
                                dx={0}
                                dy={0}
                                blur={2}
                                color={`${bonusGradient(cell.bonus)[0]}30`}
                                inner
                              />
                            </>
                          ) : (
                            <>
                              <LinearGradient
                                start={vec(0, 0)}
                                end={vec(0, CELL_SIZE - 2)}
                                colors={
                                  displayLetter
                                    ? displayOwner === "temp"
                                      ? [
                                          `${colors.primary}35`,
                                          `${colors.primary}20`,
                                        ]
                                      : displayOwner === "ai"
                                        ? ["#e74c3c25", "#e74c3c15"]
                                        : ["#3498db25", "#3498db15"]
                                    : [colors.surface, colors.surface]
                                }
                              />
                              <Shadow
                                dx={0}
                                dy={1}
                                blur={1}
                                color="rgba(0,0,0,0.1)"
                                inner
                              />
                            </>
                          )}
                        </RoundedRect>
                      </Canvas>
                      {displayLetter ? (
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 16,
                            fontWeight: "800",
                          }}
                        >
                          {displayLetter}
                        </Text>
                      ) : cell.bonus ? (
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 8,
                            fontWeight: "600",
                          }}
                        >
                          {cell.bonus}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Rack */}
          <View style={styles.rackContainer}>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              Your Tiles:
            </Text>
            <View style={styles.rackRow}>
              {(isColyseus
                ? effectiveRack.filter((_, i) => i >= placedThisTurn.length)
                : effectiveRack
              ).map((letter, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedTile(selectedTile === i ? null : i)}
                  style={[
                    styles.rackTile,
                    {
                      backgroundColor:
                        selectedTile === i ? colors.primary : colors.surface,
                      borderColor:
                        selectedTile === i ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selectedTile === i ? "#fff" : colors.text,
                      fontSize: 18,
                      fontWeight: "800",
                    }}
                  >
                    {letter}
                  </Text>
                  <Text
                    style={{
                      color: selectedTile === i ? "#fff" : colors.textSecondary,
                      fontSize: 9,
                    }}
                  >
                    {LETTER_VALUES[letter]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionRow}>
            <Button
              mode="contained"
              onPress={submitWord}
              disabled={placedThisTurn.length === 0 || !effectiveIsPlayerTurn}
              style={{ backgroundColor: colors.primary }}
              labelStyle={{ color: "#fff" }}
            >
              Submit Word
            </Button>
            <Button
              mode="outlined"
              onPress={recallTiles}
              disabled={placedThisTurn.length === 0}
              style={{ borderColor: colors.border }}
            >
              Recall
            </Button>
            {isColyseus && (
              <>
                <Button
                  mode="outlined"
                  onPress={handlePassTurn}
                  disabled={!mp.isMyTurn || placedThisTurn.length > 0}
                  style={{ borderColor: colors.border }}
                >
                  Pass
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setShowResignDialog(true)}
                  style={{ borderColor: "#e74c3c" }}
                  textColor="#e74c3c"
                >
                  Resign
                </Button>
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Colyseus Overlays ── */}
      {isColyseus && mp.phase === "waiting" && (
        <TurnBasedWaitingOverlay
          colors={overlayColors}
          onCancel={() => {
            mp.cancelMultiplayer();
            setGameState("menu");
          }}
          gameName="Words"
        />
      )}
      {isColyseus && mp.phase === "countdown" && (
        <TurnBasedCountdownOverlay
          countdown={mp.countdown}
          colors={overlayColors}
        />
      )}
      {isColyseus && mp.phase === "reconnecting" && (
        <TurnBasedReconnectingOverlay colors={overlayColors} />
      )}
      {isColyseus && mp.phase === "finished" && (
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
          colors={overlayColors}
          onRematch={mp.requestRematch}
          onAcceptRematch={mp.acceptRematch}
          onMenu={() => {
            mp.cancelMultiplayer();
            setGameState("menu");
          }}
          onShare={() => setShowFriendPicker(true)}
        />
      )}
      <ResignConfirmDialog
        visible={showResignDialog}
        colors={overlayColors}
        onConfirm={() => {
          mp.resign();
          setShowResignDialog(false);
        }}
        onCancel={() => setShowResignDialog(false)}
      />

      {/* Result */}
      <Portal>
        <Dialog
          visible={gameState === "result"}
          onDismiss={() => {}}
          style={{ backgroundColor: colors.surface }}
        >
          <Dialog.Title style={{ color: colors.text, textAlign: "center" }}>
            {playerScore > aiScore
              ? "🎉 You Win!"
              : playerScore < aiScore
                ? "😞 AI Wins!"
                : "🤝 It's a Tie!"}
          </Dialog.Title>
          <Dialog.Content>
            <Text
              style={{ color: colors.text, textAlign: "center", fontSize: 18 }}
            >
              You: {playerScore} • AI: {aiScore}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={startGame}>Play Again</Button>
            {playerScore > aiScore && (
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
              score: playerScore,
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
                gameType: "words",
                hostName: profile?.displayName || profile?.username || "Player",
              }
            : null
        }
        onInviteRef={(ref) => spectatorHost.registerInviteMessage(ref)}
        onSent={(name) => showSuccess(`Spectator invite sent to ${name}!`)}
        onError={showError}
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
                gameType: GAME_TYPE as InviteGameType,
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
  menuContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuTitle: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  menuSub: { fontSize: 16, marginBottom: 16 },
  bestText: { fontSize: 14, fontWeight: "600" },
  playArea: { alignItems: "center", paddingBottom: 32 },
  scoresRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  scoreBox: { alignItems: "center" },
  boardContainer: { borderWidth: 2, borderRadius: 8, overflow: "hidden" },
  boardRow: { flexDirection: "row" },
  boardCell: {
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  rackContainer: { marginTop: 12, alignItems: "center" },
  rackRow: { flexDirection: "row", gap: 6 },
  rackTile: {
    width: 40,
    height: 48,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  dialogActions: { justifyContent: "center" },
});

export default withGameErrorBoundary(WordsGameScreen, "words");
