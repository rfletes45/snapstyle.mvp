/**
 * WordMasterGameScreen - Daily Wordle-style Game
 *
 * How to play:
 * 1. Guess the 5-letter word in 6 attempts
 * 2. Green = correct letter in correct position
 * 3. Yellow = correct letter in wrong position
 * 4. Gray = letter not in the word
 * 5. Each day has a new word!
 *
 * Features:
 * - Daily word challenge
 * - Keyboard feedback
 * - Streak tracking
 * - Share results
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import { COLYSEUS_FEATURES } from "@/constants/featureFlags";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useSpectator } from "@/hooks/useSpectator";
import {
  GuessRow,
  useWordMasterMultiplayer,
} from "@/hooks/useWordMasterMultiplayer";
import {
  DailyWordMasterState,
  loadDailyGameState,
  saveDailyGameState,
} from "@/services/dailyGamePersistence";
import { sendScorecard } from "@/services/games";
import { recordSinglePlayerSession } from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Canvas,
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";
import Animated, {
  SharedValue,
  makeMutable,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { GameOverModal } from "@/components/games/GameOverModal";
import { createLogger } from "@/utils/log";

// =============================================================================
// Types
// =============================================================================

type GameStatus = "menu" | "playing" | "won" | "lost" | "colyseus";

const isCoopAvailable =
  !!COLYSEUS_FEATURES.COLYSEUS_ENABLED && !!COLYSEUS_FEATURES.COOP_ENABLED;
type LetterState = "empty" | "filled" | "correct" | "present" | "absent";

interface LetterGuess {
  letter: string;
  state: LetterState;
  animValue: SharedValue<number>;
}

interface WordMasterGameScreenProps {
  navigation: any;
}

const logger = createLogger("screens/games/WordMasterGameScreen");

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

// Word list - a curated list of common 5-letter words
const WORD_LIST = [
  "ABOUT",
  "ABOVE",
  "ABUSE",
  "ACTOR",
  "ACUTE",
  "ADMIT",
  "ADOPT",
  "ADULT",
  "AFTER",
  "AGAIN",
  "AGENT",
  "AGREE",
  "AHEAD",
  "ALARM",
  "ALBUM",
  "ALERT",
  "ALIEN",
  "ALIGN",
  "ALIKE",
  "ALIVE",
  "ALLOW",
  "ALONE",
  "ALONG",
  "ALTER",
  "AMONG",
  "ANGEL",
  "ANGER",
  "ANGLE",
  "ANGRY",
  "APART",
  "APPLE",
  "APPLY",
  "ARENA",
  "ARGUE",
  "ARISE",
  "ARMOR",
  "ARRAY",
  "ARROW",
  "ASIDE",
  "ASSET",
  "AVOID",
  "AWARD",
  "AWARE",
  "AWFUL",
  "BASIC",
  "BEACH",
  "BEGIN",
  "BEING",
  "BELOW",
  "BENCH",
  "BIRTH",
  "BLACK",
  "BLADE",
  "BLAME",
  "BLANK",
  "BLAST",
  "BLAZE",
  "BLEND",
  "BLESS",
  "BLIND",
  "BLOCK",
  "BLOOD",
  "BOARD",
  "BOOST",
  "BRAIN",
  "BRAND",
  "BRAVE",
  "BREAD",
  "BREAK",
  "BRICK",
  "BRIEF",
  "BRING",
  "BROAD",
  "BROKE",
  "BROWN",
  "BUILD",
  "BUNCH",
  "BURST",
  "BUYER",
  "CABLE",
  "CARRY",
  "CATCH",
  "CAUSE",
  "CHAIN",
  "CHAIR",
  "CHAOS",
  "CHARM",
  "CHART",
  "CHASE",
  "CHEAP",
  "CHECK",
  "CHESS",
  "CHEST",
  "CHIEF",
  "CHILD",
  "CHINA",
  "CHOSE",
  "CIVIL",
  "CLAIM",
  "CLASS",
  "CLEAN",
  "CLEAR",
  "CLIMB",
  "CLOCK",
  "CLOSE",
  "CLOUD",
  "COACH",
  "COAST",
  "COUCH",
  "COUNT",
  "COURT",
  "COVER",
  "CRAFT",
  "CRASH",
  "CRAZY",
  "CREAM",
  "CRIME",
  "CROSS",
  "CROWD",
  "CROWN",
  "DANCE",
  "DEATH",
  "DELAY",
  "DEPTH",
  "DIRTY",
  "DOUBT",
  "DOZEN",
  "DRAFT",
  "DRAIN",
  "DRAMA",
  "DRANK",
  "DRAWN",
  "DREAM",
  "DRESS",
  "DRINK",
  "DRIVE",
  "DROVE",
  "DYING",
  "EAGER",
  "EARLY",
  "EARTH",
  "EATEN",
  "EIGHT",
  "ELECT",
  "EMPTY",
  "ENEMY",
  "ENJOY",
  "ENTER",
  "ENTRY",
  "EQUAL",
  "ERROR",
  "EVENT",
  "EVERY",
  "EXACT",
  "EXIST",
  "EXTRA",
  "FAITH",
  "FALSE",
  "FAULT",
  "FAVOR",
  "FEAST",
  "FIBER",
  "FIELD",
  "FIFTH",
  "FIFTY",
  "FIGHT",
  "FINAL",
  "FIRST",
  "FIXED",
  "FLAME",
  "FLASH",
  "FLEET",
  "FLESH",
  "FLOAT",
  "FLOOD",
  "FLOOR",
  "FLUID",
  "FOCUS",
  "FORCE",
  "FORGE",
  "FORTH",
  "FORTY",
  "FORUM",
  "FOUND",
  "FRAME",
  "FRANK",
  "FRAUD",
  "FRESH",
  "FRONT",
  "FRUIT",
  "FULLY",
  "FUNNY",
  "GHOST",
  "GIANT",
  "GIVEN",
  "GLASS",
  "GLOBE",
  "GLORY",
  "GRACE",
  "GRADE",
  "GRAIN",
  "GRAND",
  "GRANT",
  "GRAPE",
  "GRASP",
  "GRASS",
  "GRAVE",
  "GREAT",
  "GREEN",
  "GREET",
  "GRIEF",
  "GROSS",
  "GROUP",
  "GROWN",
  "GUARD",
  "GUESS",
  "GUEST",
  "GUIDE",
  "GUILT",
  "HAPPY",
  "HARDY",
  "HARSH",
  "HASTE",
  "HAVEN",
  "HEART",
  "HEAVY",
  "HELLO",
  "HENCE",
  "HORSE",
  "HOTEL",
  "HOUSE",
  "HUMAN",
  "HUMOR",
  "IDEAL",
  "IMAGE",
  "IMPLY",
  "INDEX",
  "INNER",
  "INPUT",
  "ISSUE",
  "JOINT",
  "JONES",
  "JUDGE",
  "JUICE",
  "KNOCK",
  "KNOWN",
  "LABEL",
  "LABOR",
  "LARGE",
  "LASER",
  "LATER",
  "LAUGH",
  "LAYER",
  "LEARN",
  "LEASE",
  "LEAST",
  "LEAVE",
  "LEGAL",
  "LEMON",
  "LEVEL",
  "LEVER",
  "LIGHT",
  "LIMIT",
  "LINKS",
  "LIVER",
  "LOCAL",
  "LOGIC",
  "LOOSE",
  "LOVER",
  "LOWER",
  "LOYAL",
  "LUCKY",
  "LUNCH",
  "LYING",
  "MAGIC",
  "MAJOR",
  "MAKER",
  "MANOR",
  "MARCH",
  "MARRY",
  "MATCH",
  "MAYBE",
  "MAYOR",
  "MEANT",
  "MEDIA",
  "MERCY",
  "MERGE",
  "MERIT",
  "METAL",
  "METER",
  "MIGHT",
  "MINOR",
  "MIXED",
  "MODEL",
  "MONEY",
  "MONTH",
  "MORAL",
  "MOTOR",
  "MOUNT",
  "MOUSE",
  "MOUTH",
  "MOVIE",
  "MUSIC",
  "NAKED",
  "NASTY",
  "NAVAL",
  "NERVE",
  "NEVER",
  "NIGHT",
  "NOBLE",
  "NOISE",
  "NORTH",
  "NOTED",
  "NOVEL",
  "NURSE",
  "OCCUR",
  "OCEAN",
  "OFFER",
  "OFTEN",
  "ONION",
  "ORDER",
  "OTHER",
  "OUGHT",
  "OUTER",
  "OWNER",
  "PAINT",
  "PANEL",
  "PAPER",
  "PARTY",
  "PASTA",
  "PATCH",
  "PAUSE",
  "PEACE",
  "PHASE",
  "PHONE",
  "PHOTO",
  "PIANO",
  "PIECE",
  "PILOT",
  "PITCH",
  "PIZZA",
  "PLACE",
  "PLAIN",
  "PLANE",
  "PLANT",
  "PLATE",
  "PLAZA",
  "POINT",
  "POLAR",
  "POUND",
  "POWER",
  "PRESS",
  "PRICE",
  "PRIDE",
  "PRIME",
  "PRINT",
  "PRIOR",
  "PRIZE",
  "PROOF",
  "PROUD",
  "PROVE",
  "PROXY",
  "PUPIL",
  "QUEEN",
  "QUEST",
  "QUICK",
  "QUIET",
  "QUITE",
  "QUOTE",
  "RADAR",
  "RADIO",
  "RAISE",
  "RALLY",
  "RANCH",
  "RANGE",
  "RAPID",
  "RATIO",
  "REACH",
  "REACT",
  "READY",
  "REALM",
  "REBEL",
  "REFER",
  "REIGN",
  "RELAX",
  "REPLY",
  "RIDER",
  "RIDGE",
  "RIFLE",
  "RIGHT",
  "RIGID",
  "RIVER",
  "ROBOT",
  "ROCKY",
  "ROMAN",
  "ROUGH",
  "ROUND",
  "ROUTE",
  "ROYAL",
  "RULER",
  "RURAL",
  "SAINT",
  "SALAD",
  "SALES",
  "SANDY",
  "SAUCE",
  "SAVED",
  "SCALE",
  "SCENE",
  "SCOPE",
  "SCORE",
  "SENSE",
  "SERVE",
  "SEVEN",
  "SHADE",
  "SHAKE",
  "SHALL",
  "SHAME",
  "SHAPE",
  "SHARE",
  "SHARK",
  "SHARP",
  "SHELF",
  "SHELL",
  "SHIFT",
  "SHINE",
  "SHIRT",
  "SHOCK",
  "SHOOT",
  "SHORE",
  "SHORT",
  "SHOWN",
  "SIGHT",
  "SIGMA",
  "SILLY",
  "SIMON",
  "SINCE",
  "SIXTH",
  "SIXTY",
  "SIZED",
  "SKILL",
  "SLAVE",
  "SLEEP",
  "SLICE",
  "SLIDE",
  "SLOPE",
  "SMALL",
  "SMART",
  "SMELL",
  "SMILE",
  "SMITH",
  "SMOKE",
  "SNAKE",
  "SOLAR",
  "SOLID",
  "SOLVE",
  "SORRY",
  "SOUND",
  "SOUTH",
  "SPACE",
  "SPARE",
  "SPEAK",
  "SPEED",
  "SPEND",
  "SPENT",
  "SPICY",
  "SPLIT",
  "SPOKE",
  "SPORT",
  "SPRAY",
  "STAFF",
  "STAGE",
  "STAKE",
  "STAMP",
  "STAND",
  "STARK",
  "START",
  "STATE",
  "STEAK",
  "STEAL",
  "STEAM",
  "STEEL",
  "STEEP",
  "STICK",
  "STILL",
  "STOCK",
  "STONE",
  "STOOD",
  "STORE",
  "STORM",
  "STORY",
  "STRIP",
  "STUCK",
  "STUDY",
  "STUFF",
  "STYLE",
  "SUGAR",
  "SUITE",
  "SUNNY",
  "SUPER",
  "SWEAR",
  "SWEEP",
  "SWEET",
  "SWEPT",
  "SWING",
  "SWORD",
  "TABLE",
  "TAKEN",
  "TASTE",
  "TAXES",
  "TEACH",
  "TEETH",
  "TEMPO",
  "TENSE",
  "TENTH",
  "THANK",
  "THEFT",
  "THEME",
  "THERE",
  "THESE",
  "THICK",
  "THING",
  "THINK",
  "THIRD",
  "THOSE",
  "THREE",
  "THREW",
  "THROW",
  "THUMB",
  "TIGER",
  "TIGHT",
  "TIRED",
  "TITLE",
  "TODAY",
  "TOOTH",
  "TOPIC",
  "TOTAL",
  "TOUCH",
  "TOUGH",
  "TOWER",
  "TRACE",
  "TRACK",
  "TRADE",
  "TRAIL",
  "TRAIN",
  "TRAIT",
  "TRASH",
  "TREAT",
  "TREND",
  "TRIAL",
  "TRIBE",
  "TRICK",
  "TRIED",
  "TRUCK",
  "TRULY",
  "TRUNK",
  "TRUST",
  "TRUTH",
  "TWICE",
  "TWIST",
  "ULTRA",
  "UNCLE",
  "UNDER",
  "UNFIT",
  "UNION",
  "UNITE",
  "UNITY",
  "UNTIL",
  "UPPER",
  "UPSET",
  "URBAN",
  "USAGE",
  "USUAL",
  "VALID",
  "VALUE",
  "VIDEO",
  "VIRUS",
  "VISIT",
  "VITAL",
  "VOCAL",
  "VOICE",
  "VOTER",
  "WAGON",
  "WASTE",
  "WATCH",
  "WATER",
  "WEIGH",
  "WEIRD",
  "WHALE",
  "WHEAT",
  "WHEEL",
  "WHERE",
  "WHICH",
  "WHILE",
  "WHITE",
  "WHOLE",
  "WHOSE",
  "WIDTH",
  "WOMAN",
  "WORLD",
  "WORRY",
  "WORSE",
  "WORST",
  "WORTH",
  "WOULD",
  "WOUND",
  "WRITE",
  "WRONG",
  "WROTE",
  "YIELD",
  "YOUNG",
  "YOUTH",
  "ZEBRA",
  "ZEROS",
];

// Get today's word based on date
function getTodaysWord(): string {
  const today = new Date();
  const startDate = new Date(2024, 0, 1); // Jan 1, 2024
  const daysSinceStart = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return WORD_LIST[daysSinceStart % WORD_LIST.length];
}

// Get today's date string
function getTodaysDateString(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

// Keyboard layout
const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
];

// =============================================================================
// Component
// =============================================================================

function WordMasterGameScreen({
  navigation,
}: WordMasterGameScreenProps) {
  const __codexGameCompletion = useGameCompletion({ gameType: "word_master" });
  void __codexGameCompletion;
  const __codexGameHaptics = useGameHaptics();
  void __codexGameHaptics;
  const __codexGameOverModal = (
    <GameOverModal visible={false} result="loss" stats={{}} onExit={() => {}} />
  );
  void __codexGameOverModal;

  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError, showInfo } = useSnackbar();

  // Multiplayer hook — always called (Phase 5)
  const mp = useWordMasterMultiplayer({
    gameType: "word_master",
    autoJoin: false,
  });

  // Game state
  const [status, setStatus] = useState<GameStatus>("menu");
  const [targetWord] = useState(getTodaysWord());
  const todayDateString = getTodaysDateString();
  const [guesses, setGuesses] = useState<LetterGuess[][]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [currentRow, setCurrentRow] = useState(0);
  const [keyStates, setKeyStates] = useState<Record<string, LetterState>>({});
  const [streak, setStreak] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [restoredState, setRestoredState] =
    useState<DailyWordMasterState | null>(null);
  const hasRestoredRef = useRef(false);

  // Share state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Spectator hosting — allows friends to watch via SpectatorRoom
  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "word_master",
  });
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  // Auto-start spectator hosting so invites can be sent before game starts
  useEffect(() => {
    spectatorHost.startHosting();
  }, []);

  // Animation
  const shakeAnim = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  // Timer ref for win/loss reveal cleanup
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup reveal timer on unmount
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  // Initialize empty grid
  useEffect(() => {
    const emptyGrid: LetterGuess[][] = [];
    for (let i = 0; i < MAX_GUESSES; i++) {
      const row: LetterGuess[] = [];
      for (let j = 0; j < WORD_LENGTH; j++) {
        row.push({
          letter: "",
          state: "empty",
          animValue: makeMutable(0),
        });
      }
      emptyGrid.push(row);
    }
    setGuesses(emptyGrid);
  }, []);

  // ── Restore saved daily game state ──────────────────────────────────────
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    (async () => {
      const saved = await loadDailyGameState("word_master", todayDateString);
      if (!saved) return;

      // If game was already completed, flag it and skip to the result screen
      if (saved.status === "won" || saved.status === "lost") {
        setDailyCompleted(true);
        setRestoredState(saved);

        // Rebuild the grid from saved data
        const restoredGrid: LetterGuess[][] = saved.guessRows.map((row) =>
          row.map((cell) => ({
            letter: cell.letter,
            state: cell.state as LetterState,
            animValue: makeMutable(cell.state !== "empty" ? 1 : 0),
          })),
        );
        setGuesses(restoredGrid);
        setCurrentRow(saved.currentRow);
        setKeyStates(saved.keyStates as Record<string, LetterState>);
        setStreak(saved.streak);
        setStatus(saved.status as GameStatus);
        return;
      }

      // In-progress game — restore state and jump straight to playing
      setRestoredState(saved);
      const restoredGrid: LetterGuess[][] = saved.guessRows.map((row) =>
        row.map((cell) => ({
          letter: cell.letter,
          state: cell.state as LetterState,
          animValue: makeMutable(cell.state !== "empty" ? 1 : 0),
        })),
      );
      setGuesses(restoredGrid);
      setCurrentRow(saved.currentRow);
      setCurrentGuess(saved.currentGuess || "");
      setKeyStates(saved.keyStates as Record<string, LetterState>);
      setStreak(saved.streak);
      setStatus("playing");
    })();
  }, [todayDateString]);

  // ── Auto-save state when leaving (unmount) while playing ────────────────
  const statusRef = useRef(status);
  const guessesRef = useRef(guesses);
  const currentRowRef = useRef(currentRow);
  const currentGuessRef = useRef(currentGuess);
  const keyStatesRef = useRef(keyStates);
  const streakRef = useRef(streak);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    guessesRef.current = guesses;
  }, [guesses]);
  useEffect(() => {
    currentRowRef.current = currentRow;
  }, [currentRow]);
  useEffect(() => {
    currentGuessRef.current = currentGuess;
  }, [currentGuess]);
  useEffect(() => {
    keyStatesRef.current = keyStates;
  }, [keyStates]);
  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);

  useEffect(() => {
    return () => {
      // Save on unmount if the game is in progress
      if (statusRef.current === "playing") {
        const state: DailyWordMasterState = {
          dateString: todayDateString,
          targetWord,
          status: "playing",
          guessRows: guessesRef.current.map((row) =>
            row.map((cell) => ({ letter: cell.letter, state: cell.state })),
          ),
          currentRow: currentRowRef.current,
          keyStates: keyStatesRef.current as Record<string, string>,
          currentGuess: currentGuessRef.current,
          streak: streakRef.current,
          finalScore: 0,
        };
        saveDailyGameState("word_master", state);
      }
    };
  }, [todayDateString, targetWord]);

  // Broadcast game state to spectators
  useEffect(() => {
    if (status === "playing") {
      spectatorHost.updateGameState(
        JSON.stringify({
          guesses: guesses.length,
          maxGuesses: MAX_GUESSES,
          status,
          currentRow: guesses.length,
          // Visual state for spectator renderer
          guessRows: guesses.map((row) =>
            row.map((cell) => ({ letter: cell.letter, state: cell.state })),
          ),
          wordLength: WORD_LENGTH,
          currentGuess,
        }),
        guesses.length,
        undefined,
        MAX_GUESSES - guesses.length,
      );
    }
  }, [guesses.length, status, currentGuess]);

  // Shake animation for invalid guess
  const triggerShake = useCallback(() => {
    shakeAnim.value = withSequence(
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );

    if (Platform.OS !== "web") {
      Vibration.vibrate(100);
    }
  }, [shakeAnim]);

  // Evaluate guess and update states
  const evaluateGuess = useCallback(
    (guess: string): LetterState[] => {
      const result: LetterState[] = new Array(WORD_LENGTH).fill("absent");
      const targetLetters = targetWord.split("");
      const guessLetters = guess.split("");
      const targetCounts: Record<string, number> = {};

      // Count letters in target
      targetLetters.forEach((letter) => {
        targetCounts[letter] = (targetCounts[letter] || 0) + 1;
      });

      // First pass: mark correct positions
      guessLetters.forEach((letter, i) => {
        if (letter === targetLetters[i]) {
          result[i] = "correct";
          targetCounts[letter]--;
        }
      });

      // Second pass: mark present letters
      guessLetters.forEach((letter, i) => {
        if (result[i] !== "correct" && targetCounts[letter] > 0) {
          result[i] = "present";
          targetCounts[letter]--;
        }
      });

      return result;
    },
    [targetWord],
  );

  // Submit guess
  const submitGuess = useCallback(() => {
    if (currentGuess.length !== WORD_LENGTH) {
      showInfo("Not enough letters!");
      triggerShake();
      return;
    }

    const upperGuess = currentGuess.toUpperCase();

    // Check if word is valid (must be in our word list)
    if (!WORD_LIST.includes(upperGuess)) {
      showInfo("Not in word list!");
      triggerShake();
      return;
    }

    // Evaluate the guess
    const states = evaluateGuess(upperGuess);

    // Update grid
    const newGuesses = [...guesses];
    for (let i = 0; i < WORD_LENGTH; i++) {
      newGuesses[currentRow][i] = {
        letter: upperGuess[i],
        state: states[i],
        animValue: makeMutable(0),
      };
    }
    setGuesses(newGuesses);

    // Update keyboard states
    const newKeyStates = { ...keyStates };
    for (let i = 0; i < WORD_LENGTH; i++) {
      const letter = upperGuess[i];
      const currentState = newKeyStates[letter];
      const newState = states[i];

      // Priority: correct > present > absent
      if (newState === "correct") {
        newKeyStates[letter] = "correct";
      } else if (newState === "present" && currentState !== "correct") {
        newKeyStates[letter] = "present";
      } else if (!currentState) {
        newKeyStates[letter] = newState;
      }
    }
    setKeyStates(newKeyStates);

    // Animate reveal
    states.forEach((_, i) => {
      newGuesses[currentRow][i].animValue.value = withDelay(
        i * 150,
        withTiming(1, { duration: 300 }),
      );
    });

    // Check win/loss
    if (upperGuess === targetWord) {
      revealTimerRef.current = setTimeout(
        () => {
          setStatus("won");
          setDailyCompleted(true);
          spectatorHost.endHosting(guesses.length);
          if (Platform.OS !== "web") {
            Vibration.vibrate([0, 50, 50, 50, 50, 100]);
          }
          showSuccess("🎉 Excellent!");
          setStreak((s) => s + 1);
          setIsNewBest(true);

          // Persist completed state
          const finalScore = (MAX_GUESSES - currentRow) * 100 + 500;
          saveDailyGameState("word_master", {
            dateString: todayDateString,
            targetWord,
            status: "won",
            guessRows: newGuesses.map((row) =>
              row.map((cell) => ({ letter: cell.letter, state: cell.state })),
            ),
            currentRow: currentRow + 1,
            keyStates: newKeyStates as Record<string, string>,
            currentGuess: "",
            streak: streak + 1,
            finalScore,
          });

          // Record session
          if (currentFirebaseUser) {
            recordSinglePlayerSession(currentFirebaseUser.uid, {
              gameType: "word_master",
              finalScore,
              stats: {
                gameType: "word_master",
                wordGuessed: true,
                attemptsUsed: currentRow + 1,
                hintsUsed: 0,
                streakDay: streak + 1,
              },
            }).catch((err) => {
              logger.error(
                "[WordMaster] Failed to persist completed daily state",
                err,
              );
            });
          }
        },
        WORD_LENGTH * 150 + 300,
      );
    } else if (currentRow === MAX_GUESSES - 1) {
      revealTimerRef.current = setTimeout(
        () => {
          setStatus("lost");
          setDailyCompleted(true);
          spectatorHost.endHosting(0);
          if (Platform.OS !== "web") {
            Vibration.vibrate([0, 100, 50, 100]);
          }
          showError(`The word was: ${targetWord}`);
          setStreak(0);

          // Persist completed state
          saveDailyGameState("word_master", {
            dateString: todayDateString,
            targetWord,
            status: "lost",
            guessRows: newGuesses.map((row) =>
              row.map((cell) => ({ letter: cell.letter, state: cell.state })),
            ),
            currentRow: MAX_GUESSES,
            keyStates: newKeyStates as Record<string, string>,
            currentGuess: "",
            streak: 0,
            finalScore: 0,
          });

          // Record session
          if (currentFirebaseUser) {
            recordSinglePlayerSession(currentFirebaseUser.uid, {
              gameType: "word_master",
              finalScore: 0,
              stats: {
                gameType: "word_master",
                wordGuessed: false,
                attemptsUsed: MAX_GUESSES,
                hintsUsed: 0,
                streakDay: 0,
              },
            }).catch((err) => {
              logger.error(
                "[WordMaster] Failed to persist completed daily state",
                err,
              );
            });
          }
        },
        WORD_LENGTH * 150 + 300,
      );
    } else {
      setCurrentRow((r) => r + 1);
      setCurrentGuess("");

      // Save in-progress state after each guess
      saveDailyGameState("word_master", {
        dateString: todayDateString,
        targetWord,
        status: "playing",
        guessRows: newGuesses.map((row) =>
          row.map((cell) => ({ letter: cell.letter, state: cell.state })),
        ),
        currentRow: currentRow + 1,
        keyStates: newKeyStates as Record<string, string>,
        currentGuess: "",
        streak,
        finalScore: 0,
      });
    }
  }, [
    currentGuess,
    guesses,
    currentRow,
    keyStates,
    targetWord,
    evaluateGuess,
    triggerShake,
    showInfo,
    showSuccess,
    showError,
    currentFirebaseUser,
    streak,
  ]);

  // Handle key press
  const handleKeyPress = useCallback(
    (key: string) => {
      if (status !== "playing") return;

      if (key === "ENTER") {
        submitGuess();
      } else if (key === "⌫") {
        setCurrentGuess((g) => g.slice(0, -1));
      } else if (currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((g) => g + key);
      }
    },
    [status, currentGuess, submitGuess],
  );

  // Get cell gradient colors for Skia
  const getCellGradientColors = (
    state: LetterState,
  ): [string, string, string] => {
    switch (state) {
      case "correct":
        return ["#6aaf5e", "#538d4e", "#3d6d3a"];
      case "present":
        return ["#d4b84a", "#b59f3b", "#8f7d2e"];
      case "absent":
        return ["#4a4a4e", "#3a3a3c", "#2a2a2e"];
      case "filled":
        return ["transparent", "transparent", "transparent"];
      default:
        return ["transparent", "transparent", "transparent"];
    }
  };

  // Get cell colors
  const getCellStyle = (state: LetterState) => {
    switch (state) {
      case "correct":
        return styles.cellCorrect;
      case "present":
        return styles.cellPresent;
      case "absent":
        return styles.cellAbsent;
      case "filled":
        return styles.cellFilled;
      default:
        return styles.cellEmpty;
    }
  };

  // Get key colors
  const getKeyStyle = (letter: string) => {
    const state = keyStates[letter];
    switch (state) {
      case "correct":
        return styles.keyCorrect;
      case "present":
        return styles.keyPresent;
      case "absent":
        return styles.keyAbsent;
      default:
        return styles.keyDefault;
    }
  };

  // Generate share text
  const generateShareText = (): string => {
    const date = getTodaysDateString();
    const attempts = status === "won" ? currentRow + 1 : "X";
    let text = `Word ${date}\n${attempts}/${MAX_GUESSES}\n\n`;

    for (
      let i = 0;
      i <= (status === "won" ? currentRow : MAX_GUESSES - 1);
      i++
    ) {
      if (guesses[i]) {
        text += guesses[i]
          .map((cell) => {
            if (cell.state === "correct") return "🟩";
            if (cell.state === "present") return "🟨";
            return "⬛";
          })
          .join("");
        text += "\n";
      }
    }

    return text;
  };

  // Share handlers
  const handleShare = () => setShowShareDialog(true);

  const shareToChat = () => {
    setShowShareDialog(false);
    setShowFriendPicker(true);
  };

  const handleSelectFriend = async (friend: {
    friendUid: string;
    username: string;
    displayName: string;
  }) => {
    if (!currentFirebaseUser || !profile) return;

    setIsSending(true);
    setShowFriendPicker(false);

    try {
      const score =
        status === "won" ? (MAX_GUESSES - currentRow) * 100 + 500 : 0;
      const success = await sendScorecard(
        currentFirebaseUser.uid,
        friend.friendUid,
        {
          gameId: "word_master",
          score,
          playerName: profile.displayName || profile.username || "Player",
        },
      );

      if (success) {
        showSuccess(`Score shared with ${friend.displayName}!`);
      } else {
        showError("Failed to share score. Try again.");
      }
    } catch (error) {
      showError("Failed to share score. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  const cellSize = Math.min((SCREEN_WIDTH - 60) / WORD_LENGTH, 62);

  // Back navigation (daily game — no confirmation needed)
  const { handleBack } = useGameBackHandler({
    gameType: "word_master",
    isGameOver: status === "won" || status === "lost",
  });

  return (
    <View style={[styles.container, { backgroundColor: "#121213" }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.colors.onBackground}
          />
        </TouchableOpacity>
        <Text style={styles.title}>Word</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {spectatorHost.spectatorRoomId && (
            <TouchableOpacity
              onPress={() => setShowSpectatorInvitePicker(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(83,141,78,0.3)",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <MaterialCommunityIcons name="eye" size={16} color="#538d4e" />
              <Text style={{ color: "#538d4e", fontSize: 12, marginLeft: 4 }}>
                Watch Me
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.streakBadge}>
            <MaterialCommunityIcons name="fire" size={16} color="#FF9800" />
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        </View>
      </View>

      {/* ================================================================= */}
      {/* Menu */}
      {/* ================================================================= */}
      {status === "menu" && (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              fontSize: 32,
              fontWeight: "800",
              color: "white",
              marginBottom: 8,
            }}
          >
            Word
          </Text>
          <Text style={{ color: "#818384", fontSize: 16, marginBottom: 24 }}>
            Guess the 5-letter word in 6 tries!
          </Text>
          {dailyCompleted ? (
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  color: "#538d4e",
                  fontSize: 18,
                  fontWeight: "700",
                  marginBottom: 8,
                }}
              >
                ✅ Today's word completed!
              </Text>
              <Text
                style={{ color: "#818384", fontSize: 14, marginBottom: 16 }}
              >
                Come back tomorrow for a new word.
              </Text>
            </View>
          ) : (
            <Button
              mode="contained"
              onPress={() => {
                setStatus("playing");
                spectatorHost.startHosting();
              }}
              buttonColor="#538d4e"
              style={{ marginBottom: 12 }}
            >
              Daily Word
            </Button>
          )}
        </View>
      )}

      {/* ================================================================= */}
      {/* COLYSEUS MULTIPLAYER — Phase 5 */}
      {/* ================================================================= */}
      {status === "colyseus" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: "center", paddingVertical: 16 }}
        >
          {/* --- Waiting / Connecting --- */}
          {(mp.phase === "connecting" || mp.phase === "waiting") && (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
              }}
            >
              <Text style={{ fontSize: 24, fontWeight: "800", color: "white" }}>
                Word vs Word
              </Text>
              <Text style={{ color: "#818384", marginTop: 8 }}>
                Waiting for opponent…
              </Text>
              <Button
                mode="outlined"
                onPress={async () => {
                  await mp.leave();
                  setStatus("menu");
                }}
                style={{ marginTop: 24, borderColor: "#3a3a3c" }}
                textColor="#818384"
              >
                Cancel
              </Button>
            </View>
          )}

          {/* --- Countdown --- */}
          {mp.phase === "countdown" && (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
              }}
            >
              <Text
                style={{ fontSize: 72, fontWeight: "900", color: "#538d4e" }}
              >
                {mp.countdown || "GO!"}
              </Text>
              <Text style={{ color: "#818384", marginTop: 8 }}>
                Same word — race to solve it!
              </Text>
            </View>
          )}

          {/* --- Playing --- */}
          {mp.phase === "playing" && (
            <View style={{ width: "100%", alignItems: "center" }}>
              {/* Opponent progress bar */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  paddingHorizontal: 16,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: "#818384", fontWeight: "600" }}>
                  {mp.opponentName}
                  {mp.opponentFinished ? ` (${mp.opponentStatus})` : ""}
                </Text>
                <View style={{ flexDirection: "row", gap: 3 }}>
                  {mp.opponentGuesses.map((og, i) => (
                    <View
                      key={i}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor:
                          og.status === "won"
                            ? "#538d4e"
                            : og.status === "lost"
                              ? "#e74c3c"
                              : "#b59f3b",
                      }}
                    />
                  ))}
                  {Array.from({
                    length: Math.max(
                      0,
                      MAX_GUESSES - mp.opponentGuesses.length,
                    ),
                  }).map((_, i) => (
                    <View
                      key={`empty-${i}`}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: "#3a3a3c",
                      }}
                    />
                  ))}
                </View>
              </View>

              {/* Invalid guess feedback */}
              {mp.invalidGuessReason && (
                <Text
                  style={{
                    color: "#e74c3c",
                    fontWeight: "600",
                    marginBottom: 4,
                  }}
                >
                  {mp.invalidGuessReason}
                </Text>
              )}

              {/* My grid — using mp.myGuesses + currentGuess for online play */}
              <View style={styles.gridContainer}>
                <Animated.View style={[styles.grid, shakeStyle]}>
                  {Array.from({ length: MAX_GUESSES }).map((_, rowIndex) => {
                    const guess: GuessRow | undefined = mp.myGuesses[rowIndex];
                    const isCurrentRow =
                      rowIndex === mp.myGuesses.length &&
                      mp.myStatus === "playing";
                    return (
                      <View key={rowIndex} style={styles.row}>
                        {Array.from({ length: WORD_LENGTH }).map(
                          (__, cellIndex) => {
                            let letter = "";
                            let state: LetterState = "empty";
                            if (guess) {
                              letter = guess.word[cellIndex] || "";
                              const r = guess.result[cellIndex];
                              state =
                                r === "c"
                                  ? "correct"
                                  : r === "p"
                                    ? "present"
                                    : "absent";
                            } else if (isCurrentRow) {
                              letter = currentGuess[cellIndex] || "";
                              state = letter ? "filled" : "empty";
                            }
                            return (
                              <View
                                key={cellIndex}
                                style={[
                                  styles.cell,
                                  { width: cellSize, height: cellSize },
                                  getCellStyle(state),
                                ]}
                              >
                                {(state === "correct" ||
                                  state === "present" ||
                                  state === "absent") && (
                                  <Canvas
                                    style={StyleSheet.absoluteFill}
                                    pointerEvents="none"
                                  >
                                    <RoundedRect
                                      x={0}
                                      y={0}
                                      width={cellSize}
                                      height={cellSize}
                                      r={4}
                                    >
                                      <LinearGradient
                                        start={vec(0, 0)}
                                        end={vec(0, cellSize)}
                                        colors={getCellGradientColors(state)}
                                      />
                                      <Shadow
                                        dx={0}
                                        dy={1}
                                        blur={2}
                                        color="rgba(0,0,0,0.2)"
                                        inner
                                      />
                                    </RoundedRect>
                                  </Canvas>
                                )}
                                <Text style={styles.cellText}>
                                  {letter.toUpperCase()}
                                </Text>
                              </View>
                            );
                          },
                        )}
                      </View>
                    );
                  })}
                </Animated.View>
              </View>

              {/* Keyboard for multiplayer */}
              {mp.myStatus === "playing" && (
                <View style={styles.keyboard}>
                  {KEYBOARD_ROWS.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.keyboardRow}>
                      {row.map((key) => {
                        const isWide = key === "ENTER" || key === "⌫";
                        // Determine key colour from mp guesses
                        let keyStyle = styles.keyDefault;
                        for (const g of mp.myGuesses) {
                          for (let ci = 0; ci < g.word.length; ci++) {
                            if (g.word[ci].toUpperCase() === key) {
                              const r = g.result[ci];
                              if (r === "c") keyStyle = styles.keyCorrect;
                              else if (
                                r === "p" &&
                                keyStyle !== styles.keyCorrect
                              )
                                keyStyle = styles.keyPresent;
                              else if (
                                !keyStyle ||
                                keyStyle === styles.keyDefault
                              )
                                keyStyle = styles.keyAbsent;
                            }
                          }
                        }
                        return (
                          <TouchableOpacity
                            key={key}
                            style={[
                              styles.key,
                              isWide && styles.keyWide,
                              keyStyle,
                            ]}
                            onPress={() => {
                              if (key === "ENTER") {
                                if (currentGuess.length === WORD_LENGTH) {
                                  mp.sendGuess(currentGuess.toUpperCase());
                                  setCurrentGuess("");
                                } else {
                                  triggerShake();
                                  showInfo("Not enough letters!");
                                }
                              } else if (key === "⌫") {
                                setCurrentGuess((g) => g.slice(0, -1));
                              } else if (currentGuess.length < WORD_LENGTH) {
                                setCurrentGuess((g) => g + key);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.keyText,
                                isWide && styles.keyTextSmall,
                              ]}
                            >
                              {key}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}

              {/* My result while waiting for opponent */}
              {mp.myStatus !== "playing" && (
                <View style={{ alignItems: "center", paddingVertical: 16 }}>
                  <Text
                    style={{
                      color: mp.myStatus === "won" ? "#538d4e" : "#e74c3c",
                      fontSize: 20,
                      fontWeight: "700",
                    }}
                  >
                    {mp.myStatus === "won" ? "🎉 Got it!" : "❌ Out of guesses"}
                  </Text>
                  {!mp.opponentFinished && (
                    <Text style={{ color: "#818384", marginTop: 4 }}>
                      Waiting for {mp.opponentName} to finish…
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* --- Finished --- */}
          {mp.phase === "finished" && (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                flex: 1,
              }}
            >
              <Text style={{ fontSize: 48 }}>
                {mp.isTie ? "🤝" : mp.isWinner ? "🏆" : "😔"}
              </Text>
              <Text
                style={{
                  color: mp.isTie
                    ? "white"
                    : mp.isWinner
                      ? "#538d4e"
                      : "#e74c3c",
                  fontSize: 28,
                  fontWeight: "800",
                  marginTop: 8,
                }}
              >
                {mp.isTie
                  ? "It's a Tie!"
                  : mp.isWinner
                    ? "You Win!"
                    : "You Lose"}
              </Text>

              {mp.targetWord && (
                <Text
                  style={{
                    color: "#b59f3b",
                    fontSize: 18,
                    fontWeight: "600",
                    marginTop: 8,
                  }}
                >
                  The word was: {mp.targetWord.toUpperCase()}
                </Text>
              )}

              {/* Scores */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 32,
                  marginTop: 16,
                  alignItems: "center",
                }}
              >
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "#818384" }}>You</Text>
                  <Text
                    style={{
                      color: "#538d4e",
                      fontSize: 24,
                      fontWeight: "800",
                    }}
                  >
                    {mp.myScore}
                  </Text>
                </View>
                <Text style={{ color: "#818384", fontSize: 16 }}>vs</Text>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "#818384" }}>{mp.opponentName}</Text>
                  <Text
                    style={{ color: "white", fontSize: 24, fontWeight: "800" }}
                  >
                    {mp.opponentScore}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={{ gap: 12, marginTop: 24, alignItems: "center" }}>
                {mp.rematchRequested ? (
                  <Button
                    mode="contained"
                    onPress={() => mp.acceptRematch()}
                    buttonColor="#27ae60"
                  >
                    Accept Rematch
                  </Button>
                ) : (
                  <Button
                    mode="contained"
                    onPress={() => mp.sendRematch()}
                    buttonColor="#538d4e"
                  >
                    Rematch
                  </Button>
                )}
                <Button
                  mode="outlined"
                  onPress={async () => {
                    await mp.leave();
                    setStatus("menu");
                  }}
                  style={{ borderColor: "#3a3a3c" }}
                  textColor="#818384"
                >
                  Back to Menu
                </Button>
              </View>
            </View>
          )}

          {/* --- Error --- */}
          {mp.phase === "error" && (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                flex: 1,
              }}
            >
              <Text
                style={{ color: "#e74c3c", fontSize: 18, fontWeight: "700" }}
              >
                Connection Error
              </Text>
              <Text style={{ color: "#818384", marginTop: 8 }}>
                {mp.error || "Could not connect to server"}
              </Text>
              <Button
                mode="outlined"
                onPress={() => setStatus("menu")}
                style={{ marginTop: 24, borderColor: "#3a3a3c" }}
                textColor="#818384"
              >
                Back to Menu
              </Button>
            </View>
          )}
        </ScrollView>
      )}

      {/* ================================================================= */}
      {/* Single Player Mode */}
      {/* ================================================================= */}
      {(status === "playing" || status === "won" || status === "lost") && (
        <>
          {/* Game Grid */}
          <View style={styles.gridContainer}>
            <Animated.View style={[styles.grid, shakeStyle]}>
              {guesses.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                  {row.map((cell, cellIndex) => {
                    const letter =
                      rowIndex === currentRow && cell.letter === ""
                        ? currentGuess[cellIndex] || ""
                        : cell.letter;
                    const state =
                      rowIndex === currentRow &&
                      cell.state === "empty" &&
                      letter
                        ? "filled"
                        : cell.state;

                    return (
                      <View
                        key={cellIndex}
                        style={[
                          styles.cell,
                          { width: cellSize, height: cellSize },
                          getCellStyle(state),
                        ]}
                      >
                        {(state === "correct" ||
                          state === "present" ||
                          state === "absent") && (
                          <Canvas
                            style={StyleSheet.absoluteFill}
                            pointerEvents="none"
                          >
                            <RoundedRect
                              x={0}
                              y={0}
                              width={cellSize}
                              height={cellSize}
                              r={4}
                            >
                              <LinearGradient
                                start={vec(0, 0)}
                                end={vec(0, cellSize)}
                                colors={getCellGradientColors(state)}
                              />
                              <Shadow
                                dx={0}
                                dy={1}
                                blur={2}
                                color="rgba(0,0,0,0.2)"
                                inner
                              />
                            </RoundedRect>
                            {/* Top highlight */}
                            <RoundedRect
                              x={2}
                              y={1}
                              width={cellSize - 4}
                              height={3}
                              r={1.5}
                            >
                              <LinearGradient
                                start={vec(0, 1)}
                                end={vec(0, 4)}
                                colors={[
                                  "rgba(255,255,255,0.25)",
                                  "rgba(255,255,255,0)",
                                ]}
                              />
                            </RoundedRect>
                          </Canvas>
                        )}
                        <Text style={styles.cellText}>{letter}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </Animated.View>
          </View>

          {/* Result Message */}
          {(status === "won" || status === "lost") && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultText}>
                {status === "won"
                  ? `🎉 You got it in ${currentRow + 1}!`
                  : `The word was: ${targetWord}`}
              </Text>
              <View style={styles.resultButtons}>
                <Button
                  mode="contained"
                  icon="share"
                  onPress={handleShare}
                  buttonColor="#538d4e"
                >
                  Share Result
                </Button>
              </View>
            </View>
          )}

          {/* Keyboard */}
          <View style={styles.keyboard}>
            {KEYBOARD_ROWS.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keyboardRow}>
                {row.map((key) => {
                  const isWide = key === "ENTER" || key === "⌫";
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.key,
                        isWide && styles.keyWide,
                        getKeyStyle(key),
                      ]}
                      onPress={() => handleKeyPress(key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.keyText, isWide && styles.keyTextSmall]}
                      >
                        {key}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Share Dialog */}
          <Portal>
            <Dialog
              visible={showShareDialog}
              onDismiss={() => setShowShareDialog(false)}
              style={{ backgroundColor: theme.colors.surface }}
            >
              <Dialog.Title>Share Your Result</Dialog.Title>
              <Dialog.Content>
                <Text
                  style={{
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  }}
                >
                  {generateShareText()}
                </Text>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setShowShareDialog(false)}>
                  Cancel
                </Button>
                <Button onPress={shareToChat} mode="contained">
                  Send to Friend
                </Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>

          {/* Spectator overlay — shows count of watchers */}
          {spectatorHost.spectatorCount > 0 && (
            <SpectatorOverlay spectatorCount={spectatorHost.spectatorCount} />
          )}

          {/* Friend Picker */}
          <FriendPickerModal
            key="scorecard-picker"
            visible={showFriendPicker}
            onDismiss={() => setShowFriendPicker(false)}
            onSelectFriend={handleSelectFriend}
            title="Share Result With..."
            currentUserId={currentFirebaseUser?.uid || ""}
          />
        </>
      )}

      {/* Spectator Invite Picker (Friends + Groups) — outside game-state gate
          so it works from menu / completed / playing screens alike */}
      <SpectatorInviteModal
        visible={showSpectatorInvitePicker}
        onDismiss={() => setShowSpectatorInvitePicker(false)}
        currentUserId={currentFirebaseUser?.uid || ""}
        inviteData={
          spectatorHost.spectatorRoomId
            ? {
                roomId: spectatorHost.spectatorRoomId,
                gameType: "word_master",
                hostName: profile?.displayName || profile?.username || "Player",
              }
            : null
        }
        onInviteRef={(ref) => spectatorHost.registerInviteMessage(ref)}
        onSent={(name) => showSuccess(`Spectator invite sent to ${name}!`)}
        onError={showError}
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
    paddingTop: 50,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  backButton: {
    padding: 8,
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 152, 0, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakText: {
    color: "#FF9800",
    fontSize: 14,
    fontWeight: "600",
  },
  gridContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  grid: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    gap: 6,
  },
  cell: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 4,
  },
  cellEmpty: {
    borderColor: "#3a3a3c",
    backgroundColor: "transparent",
  },
  cellFilled: {
    borderColor: "#565758",
    backgroundColor: "transparent",
  },
  cellCorrect: {
    borderColor: "#538d4e",
    backgroundColor: "#538d4e",
  },
  cellPresent: {
    borderColor: "#b59f3b",
    backgroundColor: "#b59f3b",
  },
  cellAbsent: {
    borderColor: "#3a3a3c",
    backgroundColor: "#3a3a3c",
  },
  cellText: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
  },
  resultContainer: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  resultText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  resultButtons: {
    flexDirection: "row",
    gap: 12,
  },
  keyboard: {
    paddingHorizontal: 8,
    paddingBottom: 20,
    gap: 8,
  },
  keyboardRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  key: {
    minWidth: 32,
    height: 52,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  keyWide: {
    minWidth: 50,
    paddingHorizontal: 12,
  },
  keyDefault: {
    backgroundColor: "#818384",
  },
  keyCorrect: {
    backgroundColor: "#538d4e",
  },
  keyPresent: {
    backgroundColor: "#b59f3b",
  },
  keyAbsent: {
    backgroundColor: "#3a3a3c",
  },
  keyText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  keyTextSmall: {
    fontSize: 11,
  },
});

export default withGameErrorBoundary(WordMasterGameScreen, "word_master");
