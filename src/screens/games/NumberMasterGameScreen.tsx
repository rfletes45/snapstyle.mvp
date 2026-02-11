/**
 * NumberMasterGameScreen - Mental Math Speed Game
 *
 * How to play:
 * 1. You are given a target number and a set of available numbers + operators
 * 2. Select numbers and operators to build an expression that equals the target
 * 3. Submit your expression — correct answers advance to the next round
 * 4. Timer counts up; lower total time = better score
 * 5. 10 rounds per game, difficulty increases each round
 * 6. Total elapsed time (in seconds) is your final score (lower is better)
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import SpectatorInviteModal from "@/components/SpectatorInviteModal";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
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
  RadialGradient,
  RoundedRect,
  Shadow,
  Circle as SkiaCircle,
  vec,
} from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";


import { createLogger } from "@/utils/log";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { GameOverModal } from "@/components/games/GameOverModal";
const logger = createLogger("screens/games/NumberMasterGameScreen");
// =============================================================================
// Types
// =============================================================================

type GameState = "idle" | "playing" | "round_result" | "game_result";

type Operator = "+" | "-" | "×" | "÷";

interface ExpressionToken {
  type: "number" | "operator";
  value: string;
  /** index into the availableNumbers array (for number tokens) */
  sourceIndex?: number;
}

interface RoundData {
  target: number;
  availableNumbers: number[];
  operators: Operator[];
  difficulty: number;
}

interface NumberMasterGameScreenProps {
  navigation: any;
}

// =============================================================================
// Constants
// =============================================================================

const TOTAL_ROUNDS = 10;
const ALL_OPERATORS: Operator[] = ["+", "-", "×", "÷"];
const GAME_TYPE = "number_master";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a solvable round.
 * We build the answer backwards: pick numbers and an operator, compute the
 * target from them, then shuffle extra distractor numbers in.
 */
function generateRound(difficulty: number): RoundData {
  const numCount = Math.min(4 + Math.floor(difficulty / 3), 6);

  // Pick how many operands in the "solution path" (2 or 3)
  const solutionLen = difficulty >= 5 ? 3 : 2;

  // Difficulty-based number range
  const maxVal = difficulty <= 2 ? 12 : difficulty <= 5 ? 25 : 50;

  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  // Build a guaranteed solution
  let solutionNumbers: number[] = [];
  let target: number;

  if (solutionLen === 2) {
    const a = randInt(1, maxVal);
    const b = randInt(1, maxVal);
    const op = ALL_OPERATORS[randInt(0, ALL_OPERATORS.length - 1)];
    solutionNumbers = [a, b];
    target = evaluate(a, op, b);

    // Avoid ugly results — re-roll if needed
    let safety = 0;
    while (
      (target <= 0 || target > 999 || !Number.isInteger(target)) &&
      safety < 20
    ) {
      const na = randInt(1, maxVal);
      const nb = randInt(1, Math.max(1, maxVal));
      const nop = ALL_OPERATORS[randInt(0, ALL_OPERATORS.length - 1)];
      const res = evaluate(na, nop, nb);
      if (res > 0 && res <= 999 && Number.isInteger(res)) {
        solutionNumbers = [na, nb];
        target = res;
        break;
      }
      safety++;
    }
    if (target <= 0 || target > 999 || !Number.isInteger(target)) {
      // Fallback simple addition
      solutionNumbers = [a, b];
      target = a + b;
    }
  } else {
    // 3-operand solution
    const a = randInt(1, maxVal);
    const b = randInt(1, Math.min(maxVal, 15));
    const c = randInt(1, Math.min(maxVal, 15));
    // Use safe operators for 3-number chains
    const op1: Operator = Math.random() < 0.5 ? "+" : "-";
    const op2: Operator = Math.random() < 0.5 ? "+" : "×";
    const intermediate = evaluate(a, op1, b);
    target = evaluate(intermediate, op2, c);

    let safety = 0;
    while (
      (target <= 0 || target > 999 || !Number.isInteger(target)) &&
      safety < 20
    ) {
      const na = randInt(2, maxVal);
      const nb = randInt(1, 10);
      const nc = randInt(1, 10);
      const inter = na + nb;
      target = inter * nc;
      if (target > 0 && target <= 999) {
        solutionNumbers = [na, nb, nc];
        break;
      }
      safety++;
    }
    if (
      solutionNumbers.length === 0 ||
      target <= 0 ||
      target > 999 ||
      !Number.isInteger(target)
    ) {
      solutionNumbers = [a, b, c];
      target = a + b + c;
    } else if (solutionNumbers.length === 0) {
      solutionNumbers = [a, b, c];
    }
    if (solutionNumbers.length === 0) {
      solutionNumbers = [a, b, c];
      target = a + b + c;
    }
  }

  // Fill remaining slots with distractors
  const available = [...solutionNumbers];
  while (available.length < numCount) {
    available.push(randInt(1, maxVal));
  }

  // Shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  return {
    target,
    availableNumbers: available,
    operators: ALL_OPERATORS,
    difficulty,
  };
}

function evaluate(a: number, op: Operator, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b !== 0 ? a / b : NaN;
    default:
      return NaN;
  }
}

/**
 * Evaluate a full expression token list.
 * Respects standard operator precedence: × ÷ first, then + -.
 */
function evaluateExpression(tokens: ExpressionToken[]): number | null {
  if (tokens.length === 0) return null;

  // Must start with number, alternate number/operator, end with number
  if (tokens.length % 2 === 0) return null;
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0 && tokens[i].type !== "number") return null;
    if (i % 2 === 1 && tokens[i].type !== "operator") return null;
  }

  // Build parallel arrays for evaluation
  const nums: number[] = [];
  const ops: Operator[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) nums.push(parseFloat(tokens[i].value));
    else ops.push(tokens[i].value as Operator);
  }

  // Pass 1: resolve × and ÷
  const nums2: number[] = [nums[0]];
  const ops2: Operator[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === "×" || ops[i] === "÷") {
      const prev = nums2.pop()!;
      nums2.push(evaluate(prev, ops[i], nums[i + 1]));
    } else {
      nums2.push(nums[i + 1]);
      ops2.push(ops[i]);
    }
  }

  // Pass 2: resolve + and -
  let result = nums2[0];
  for (let i = 0; i < ops2.length; i++) {
    result = evaluate(result, ops2[i], nums2[i + 1]);
  }

  if (!isFinite(result)) return null;
  return result;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  }
  return `${seconds}.${tenths}s`;
}

// =============================================================================
// Component
// =============================================================================

function NumberMasterGameScreen({
  navigation,
}: NumberMasterGameScreenProps) {
  const __codexGameCompletion = useGameCompletion({ gameType: "number_master" });
  void __codexGameCompletion;
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

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [gameState, setGameState] = useState<GameState>("idle");
  const [round, setRound] = useState(1);
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [expression, setExpression] = useState<ExpressionToken[]>([]);
  const [usedNumberIndices, setUsedNumberIndices] = useState<Set<number>>(
    new Set(),
  );
  const [elapsed, setElapsed] = useState(0); // ms elapsed total game
  const [roundCorrect, setRoundCorrect] = useState(false);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  // Spectator hosting
  const spectatorHost = useSpectator({
    mode: "sp-host",
    gameType: "number_master",
  });
  const [showSpectatorInvitePicker, setShowSpectatorInvitePicker] =
    useState(false);

  // Auto-start spectator hosting so invites can be sent before game starts
  useEffect(() => {
    spectatorHost.startHosting();
  }, []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const accumulatedRef = useRef(0); // accumulated time from previous rounds

  // ---------------------------------------------------------------------------
  // Load personal best
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(
        setPersonalBest,
      );
    }
  }, [currentFirebaseUser]);

  // ---------------------------------------------------------------------------
  // Timer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (gameState === "playing") {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(
          accumulatedRef.current + (Date.now() - startTimeRef.current),
        );
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState]);

  // ---------------------------------------------------------------------------
  // Game Logic
  // ---------------------------------------------------------------------------

  const startGame = useCallback(() => {
    setRound(1);
    setElapsed(0);
    accumulatedRef.current = 0;
    setIsNewBest(false);
    setFinalScore(0);
    const rd = generateRound(1);
    setRoundData(rd);
    setExpression([]);
    setUsedNumberIndices(new Set());
    setGameState("playing");
    spectatorHost.startHosting();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const nextRound = useCallback(() => {
    const nextR = round + 1;
    if (nextR > TOTAL_ROUNDS) {
      endGame();
      return;
    }
    // Accumulate time
    accumulatedRef.current = elapsed;
    setRound(nextR);
    const rd = generateRound(nextR);
    setRoundData(rd);
    setExpression([]);
    setUsedNumberIndices(new Set());
    setGameState("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [round, elapsed]);

  const endGame = useCallback(async () => {
    // Freeze timer
    const finalTime =
      accumulatedRef.current + (Date.now() - startTimeRef.current);
    const scoreSeconds = Math.round(finalTime / 100) / 10; // 1 decimal
    setFinalScore(scoreSeconds);
    setElapsed(finalTime);
    setGameState("game_result");
    spectatorHost.endHosting(scoreSeconds);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Record score (lower is better for time-based)
    if (currentFirebaseUser) {
      try {
        const session = await recordGameSession(currentFirebaseUser.uid, {
          gameId: GAME_TYPE,
          score: scoreSeconds,
          duration: Math.round(finalTime),
        });
        const newBest = !personalBest || scoreSeconds < personalBest.bestScore;
        if (session && newBest) {
          setIsNewBest(true);
          setPersonalBest({
            gameId: GAME_TYPE,
            bestScore: scoreSeconds,
            achievedAt: Date.now(),
          });
          showSuccess("🎉 New personal best!");
        }
      } catch (error) {
        logger.error("Error recording game session:", error);
      }
    }
  }, [currentFirebaseUser, showSuccess]);

  // ---------------------------------------------------------------------------
  // Expression building
  // ---------------------------------------------------------------------------

  const addNumber = useCallback(
    (num: number, index: number) => {
      if (usedNumberIndices.has(index)) return;
      // Only allow number after operator or at start
      if (
        expression.length > 0 &&
        expression[expression.length - 1].type === "number"
      )
        return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setExpression((prev) => [
        ...prev,
        { type: "number", value: String(num), sourceIndex: index },
      ]);
      setUsedNumberIndices((prev) => new Set(prev).add(index));
    },
    [expression, usedNumberIndices],
  );

  const addOperator = useCallback(
    (op: Operator) => {
      // Only allow operator after number
      if (
        expression.length === 0 ||
        expression[expression.length - 1].type !== "number"
      )
        return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setExpression((prev) => [...prev, { type: "operator", value: op }]);
    },
    [expression],
  );

  const undoLast = useCallback(() => {
    if (expression.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpression((prev) => {
      const removed = prev[prev.length - 1];
      if (removed.type === "number" && removed.sourceIndex !== undefined) {
        setUsedNumberIndices((s) => {
          const next = new Set(s);
          next.delete(removed.sourceIndex!);
          return next;
        });
      }
      return prev.slice(0, -1);
    });
  }, [expression]);

  const clearExpression = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExpression([]);
    setUsedNumberIndices(new Set());
  }, []);

  const submitExpression = useCallback(() => {
    if (!roundData) return;
    const result = evaluateExpression(expression);

    if (result !== null && Math.abs(result - roundData.target) < 0.0001) {
      // Correct!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRoundCorrect(true);
      // Freeze accumulated time for this round
      accumulatedRef.current =
        accumulatedRef.current + (Date.now() - startTimeRef.current);
      setGameState("round_result");
    } else {
      // Wrong
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setRoundCorrect(false);
      setGameState("round_result");
      // Don't freeze timer on wrong — they'll retry
    }
  }, [expression, roundData]);

  const retryRound = useCallback(() => {
    setExpression([]);
    setUsedNumberIndices(new Set());
    setGameState("playing");
  }, []);

  // ---------------------------------------------------------------------------
  // Share Handlers
  // ---------------------------------------------------------------------------

  const handleShareScore = useCallback(() => {
    setShowShareDialog(true);
  }, []);

  const handleSelectFriend = useCallback(
    async (friend: {
      friendUid: string;
      username: string;
      displayName: string;
    }) => {
      if (!currentFirebaseUser || !profile) return;

      setIsSending(true);
      setShowFriendPicker(false);

      try {
        const success = await sendScorecard(
          currentFirebaseUser.uid,
          friend.friendUid,
          {
            gameId: GAME_TYPE,
            score: finalScore,
            playerName: profile.displayName || profile.username || "Player",
          },
        );
        if (success) {
          showSuccess(`Score shared with ${friend.displayName}!`);
        } else {
          showError("Failed to share score. Try again.");
        }
      } catch (error) {
        logger.error("[GameNumber] Error sharing score:", error);
        showError("Failed to share score. Try again.");
      } finally {
        setIsSending(false);
      }
    },
    [currentFirebaseUser, profile, finalScore, showSuccess, showError],
  );

  // Broadcast game state to spectators
  useEffect(() => {
    if (gameState === "playing") {
      spectatorHost.updateGameState(
        JSON.stringify({
          round,
          elapsed,
          gameState,
          // Visual state for spectator renderer
          targetNumber: roundData?.target ?? 0,
          expression: expression.map((t) => t.value).join(" "),
          totalRounds: TOTAL_ROUNDS,
        }),
        round,
        undefined,
        undefined,
      );
    }
  }, [round, elapsed, gameState, expression]);

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------
  const expressionString = expression.map((t) => t.value).join(" ");
  const currentResult = evaluateExpression(expression);
  const canSubmit =
    expression.length >= 3 &&
    expression[expression.length - 1].type === "number";

  // ---------------------------------------------------------------------------
  // Render
  // Back navigation with confirmation dialog
  const { handleBack } = useGameBackHandler({
    gameType: "number_master",
    isGameOver: gameState === "game_result" || gameState === "idle",
  });

  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Number</Text>
        <View style={styles.headerRight}>
          {spectatorHost.spectatorRoomId && (
            <TouchableOpacity
              onPress={() => setShowSpectatorInvitePicker(true)}
              style={{ marginRight: 8 }}
              accessibilityLabel="Invite spectators"
            >
              <MaterialCommunityIcons
                name="eye"
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
          {gameState !== "idle" && gameState !== "game_result" && (
            <Text style={[styles.timerText, { color: colors.primary }]}>
              {formatTime(elapsed)}
            </Text>
          )}
        </View>
      </View>

      {/* Round indicator */}
      {(gameState === "playing" || gameState === "round_result") && (
        <View style={styles.roundBar}>
          {Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
            const isCompleted = i < round - 1;
            const isCurrent = i === round - 1;
            return (
              <View key={i} style={styles.roundDot}>
                <Canvas style={{ width: 10, height: 10 }} pointerEvents="none">
                  <SkiaCircle cx={5} cy={5} r={5}>
                    <RadialGradient
                      c={vec(4, 4)}
                      r={7}
                      colors={
                        isCompleted
                          ? [colors.primary, colors.primary + "AA"]
                          : isCurrent
                            ? ["#FFE082", "#FFD700", "#FFA000"]
                            : [
                                colors.textSecondary + "40",
                                colors.textSecondary + "20",
                              ]
                      }
                    />
                  </SkiaCircle>
                </Canvas>
              </View>
            );
          })}
          <Text style={[styles.roundText, { color: colors.textSecondary }]}>
            Round {round}/{TOTAL_ROUNDS}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ================================================================= */}
        {/* IDLE STATE                                                        */}
        {/* ================================================================= */}
        {gameState === "idle" && (
          <View style={styles.centerContent}>
            <MaterialCommunityIcons
              name="calculator-variant"
              size={72}
              color={colors.primary}
              style={styles.idleIcon}
            />
            <Text style={[styles.gameTitle, { color: colors.text }]}>
              🔢 Number
            </Text>
            <Text
              style={[styles.instructions, { color: colors.textSecondary }]}
            >
              Reach the target number using the{"\n"}given numbers and
              operators.
              {"\n"}Complete 10 rounds as fast as you can!
            </Text>
            {personalBest && (
              <Text style={[styles.bestScore, { color: colors.primary }]}>
                Best: {personalBest.bestScore}s
              </Text>
            )}
            <Button
              mode="contained"
              onPress={startGame}
              style={styles.playButton}
              labelStyle={styles.playButtonLabel}
            >
              Play
            </Button>
          </View>
        )}

        {/* ================================================================= */}
        {/* PLAYING STATE                                                     */}
        {/* ================================================================= */}
        {gameState === "playing" && roundData && (
          <View style={styles.playArea}>
            {/* Target with Skia gradient */}
            <View style={[styles.targetContainer, { overflow: "hidden" }]}>
              <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                <RoundedRect x={0} y={0} width={400} height={120} r={16}>
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(400, 120)}
                    colors={[
                      colors.primary + "25",
                      colors.primary + "10",
                      colors.primary + "25",
                    ]}
                  />
                  <Shadow
                    dx={0}
                    dy={2}
                    blur={12}
                    color={colors.primary + "30"}
                    inner
                  />
                </RoundedRect>
              </Canvas>
              <Text
                style={[styles.targetLabel, { color: colors.textSecondary }]}
              >
                TARGET
              </Text>
              <Text style={[styles.targetNumber, { color: colors.primary }]}>
                {roundData.target}
              </Text>
            </View>

            {/* Expression builder */}
            <View
              style={[
                styles.expressionContainer,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.textSecondary + "30",
                },
              ]}
            >
              {expression.length === 0 ? (
                <Text
                  style={[
                    styles.expressionPlaceholder,
                    { color: colors.textSecondary },
                  ]}
                >
                  Tap numbers & operators below
                </Text>
              ) : (
                <View style={styles.expressionTokens}>
                  {expression.map((token, i) => (
                    <View
                      key={i}
                      style={[
                        styles.expressionChip,
                        {
                          backgroundColor:
                            token.type === "number"
                              ? colors.primary + "20"
                              : "#FF9800" + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.expressionChipText,
                          {
                            color:
                              token.type === "number"
                                ? colors.primary
                                : "#FF9800",
                          },
                        ]}
                      >
                        {token.value}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {currentResult !== null && expression.length >= 3 && (
                <Text
                  style={[
                    styles.expressionResult,
                    {
                      color:
                        Math.abs(currentResult - roundData.target) < 0.0001
                          ? "#4CAF50"
                          : colors.textSecondary,
                    },
                  ]}
                >
                  ={" "}
                  {Number.isInteger(currentResult)
                    ? currentResult
                    : currentResult.toFixed(2)}
                </Text>
              )}
            </View>

            {/* Expression actions */}
            <View style={styles.expressionActions}>
              <TouchableOpacity
                onPress={undoLast}
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.textSecondary + "15" },
                ]}
                disabled={expression.length === 0}
              >
                <MaterialCommunityIcons
                  name="undo"
                  size={20}
                  color={
                    expression.length === 0
                      ? colors.textSecondary + "40"
                      : colors.text
                  }
                />
                <Text
                  style={[
                    styles.actionText,
                    {
                      color:
                        expression.length === 0
                          ? colors.textSecondary + "40"
                          : colors.text,
                    },
                  ]}
                >
                  Undo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearExpression}
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.textSecondary + "15" },
                ]}
                disabled={expression.length === 0}
              >
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={20}
                  color={
                    expression.length === 0
                      ? colors.textSecondary + "40"
                      : "#F44336"
                  }
                />
                <Text
                  style={[
                    styles.actionText,
                    {
                      color:
                        expression.length === 0
                          ? colors.textSecondary + "40"
                          : "#F44336",
                    },
                  ]}
                >
                  Clear
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitExpression}
                style={[
                  styles.actionButton,
                  styles.submitButton,
                  {
                    backgroundColor: canSubmit
                      ? colors.primary
                      : colors.textSecondary + "15",
                  },
                ]}
                disabled={!canSubmit}
              >
                <MaterialCommunityIcons
                  name="check-bold"
                  size={20}
                  color={canSubmit ? "#FFF" : colors.textSecondary + "40"}
                />
                <Text
                  style={[
                    styles.actionText,
                    {
                      color: canSubmit ? "#FFF" : colors.textSecondary + "40",
                    },
                  ]}
                >
                  Submit
                </Text>
              </TouchableOpacity>
            </View>

            {/* Available numbers */}
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
            >
              Numbers
            </Text>
            <View style={styles.chipsRow}>
              {roundData.availableNumbers.map((num, idx) => {
                const used = usedNumberIndices.has(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => addNumber(num, idx)}
                    disabled={used}
                    style={[
                      styles.numberChip,
                      {
                        borderColor: used
                          ? colors.textSecondary + "30"
                          : colors.primary + "50",
                        overflow: "hidden",
                      },
                    ]}
                  >
                    <Canvas
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    >
                      <RoundedRect x={0} y={0} width={56} height={56} r={12}>
                        <LinearGradient
                          start={vec(0, 0)}
                          end={vec(56, 56)}
                          colors={
                            used
                              ? [
                                  colors.textSecondary + "15",
                                  colors.textSecondary + "08",
                                ]
                              : [
                                  colors.primary + "28",
                                  colors.primary + "10",
                                  colors.primary + "20",
                                ]
                          }
                        />
                        <Shadow
                          dx={0}
                          dy={1}
                          blur={4}
                          color={used ? "#00000000" : colors.primary + "25"}
                          inner
                        />
                      </RoundedRect>
                    </Canvas>
                    <Text
                      style={[
                        styles.numberChipText,
                        {
                          color: used
                            ? colors.textSecondary + "40"
                            : colors.primary,
                        },
                      ]}
                    >
                      {num}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Operators */}
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
            >
              Operators
            </Text>
            <View style={styles.chipsRow}>
              {roundData.operators.map((op, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => addOperator(op)}
                  style={[
                    styles.operatorChip,
                    {
                      borderColor: "#FF9800" + "50",
                      overflow: "hidden",
                    },
                  ]}
                >
                  <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                    <RoundedRect x={0} y={0} width={56} height={56} r={12}>
                      <LinearGradient
                        start={vec(0, 0)}
                        end={vec(56, 56)}
                        colors={["#FF980028", "#FF980010", "#FF980020"]}
                      />
                      <Shadow dx={0} dy={1} blur={4} color="#FF980025" inner />
                    </RoundedRect>
                  </Canvas>
                  <Text style={[styles.operatorChipText, { color: "#FF9800" }]}>
                    {op}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* ROUND RESULT                                                      */}
        {/* ================================================================= */}
        {gameState === "round_result" && roundData && (
          <View style={styles.centerContent}>
            {roundCorrect ? (
              <>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={72}
                  color="#4CAF50"
                />
                <Text style={[styles.resultTitle, { color: "#4CAF50" }]}>
                  Correct! 🎉
                </Text>
                <Text
                  style={[
                    styles.resultSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {expressionString} = {roundData.target}
                </Text>
                <Button
                  mode="contained"
                  onPress={nextRound}
                  style={styles.nextButton}
                >
                  {round >= TOTAL_ROUNDS ? "Finish" : "Next Round"}
                </Button>
              </>
            ) : (
              <>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={72}
                  color="#F44336"
                />
                <Text style={[styles.resultTitle, { color: "#F44336" }]}>
                  Not quite 🤔
                </Text>
                <Text
                  style={[
                    styles.resultSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {expressionString} ={" "}
                  {currentResult !== null
                    ? Number.isInteger(currentResult)
                      ? currentResult
                      : currentResult.toFixed(2)
                    : "?"}{" "}
                  (need {roundData.target})
                </Text>
                <View style={styles.retryRow}>
                  <Button mode="outlined" onPress={retryRound}>
                    Try Again
                  </Button>
                  <Button
                    mode="text"
                    onPress={nextRound}
                    style={styles.skipButton}
                  >
                    {round >= TOTAL_ROUNDS ? "Finish" : "Skip Round"}
                  </Button>
                </View>
              </>
            )}
          </View>
        )}

        {/* ================================================================= */}
        {/* GAME RESULT                                                       */}
        {/* ================================================================= */}
        {gameState === "game_result" && (
          <View style={styles.centerContent}>
            <MaterialCommunityIcons
              name="trophy"
              size={72}
              color={isNewBest ? "#FFD700" : colors.primary}
            />
            <Text style={[styles.gameOverTitle, { color: colors.text }]}>
              {isNewBest ? "🎉 New Best!" : "Game Over!"}
            </Text>
            <Text style={[styles.finalScoreText, { color: colors.primary }]}>
              {finalScore}s
            </Text>
            <Text
              style={[styles.finalScoreLabel, { color: colors.textSecondary }]}
            >
              Total Time
            </Text>
            {personalBest && !isNewBest && (
              <Text
                style={[styles.bestScoreSmall, { color: colors.textSecondary }]}
              >
                Personal Best: {personalBest.bestScore}s
              </Text>
            )}

            <View style={styles.gameOverActions}>
              <Button
                mode="contained"
                onPress={startGame}
                style={styles.replayButton}
              >
                Play Again
              </Button>
              <Button
                mode="outlined"
                onPress={handleShareScore}
                icon="share"
                style={styles.shareButton}
              >
                Share
              </Button>
              <Button
                mode="text"
                onPress={() => {
                  if (navigation.canGoBack()) navigation.goBack();
                  else navigation.navigate("GamesHub");
                }}
                style={styles.quitButton}
              >
                Quit
              </Button>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ================================================================= */}
      {/* Share Dialog                                                       */}
      {/* ================================================================= */}
      <Portal>
        <Dialog
          visible={showShareDialog}
          onDismiss={() => setShowShareDialog(false)}
        >
          <Dialog.Title>Share Your Score</Dialog.Title>
          <Dialog.Content>
            <Text>Share your time of {finalScore}s with a friend?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowShareDialog(false)}>Cancel</Button>
            <Button
              onPress={() => {
                setShowShareDialog(false);
                setShowFriendPicker(true);
              }}
            >
              Choose Friend
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Friend Picker */}
      {currentFirebaseUser && (
        <FriendPickerModal
          key="scorecard-picker"
          visible={showFriendPicker}
          onDismiss={() => setShowFriendPicker(false)}
          onSelectFriend={handleSelectFriend}
          currentUserId={currentFirebaseUser.uid}
          title="Send Scorecard"
        />
      )}

      {/* Spectator Overlay */}
      <SpectatorOverlay spectatorCount={spectatorHost.spectatorCount} />

      {/* Spectator Invite Picker (Friends + Groups) */}
      <SpectatorInviteModal
        visible={showSpectatorInvitePicker}
        onDismiss={() => setShowSpectatorInvitePicker(false)}
        currentUserId={currentFirebaseUser?.uid || ""}
        inviteData={
          spectatorHost.spectatorRoomId
            ? {
                roomId: spectatorHost.spectatorRoomId,
                gameType: "number_master",
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
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 12,
    zIndex: 10,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerRight: {
    minWidth: 60,
    alignItems: "flex-end",
  },
  timerText: {
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  // Round bar
  roundBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  roundDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  roundText: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: "600",
  },

  // Content
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 32,
  },

  // Idle
  idleIcon: {
    marginBottom: 16,
  },
  gameTitle: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
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
  playButton: {
    paddingHorizontal: 48,
    borderRadius: 24,
  },
  playButtonLabel: {
    fontSize: 18,
    fontWeight: "700",
  },

  // Play area
  playArea: {
    flex: 1,
    paddingTop: 8,
  },
  targetContainer: {
    alignItems: "center",
    paddingVertical: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  targetLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 4,
  },
  targetNumber: {
    fontSize: 56,
    fontWeight: "900",
  },

  // Expression
  expressionContainer: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    justifyContent: "center",
  },
  expressionPlaceholder: {
    textAlign: "center",
    fontSize: 14,
  },
  expressionTokens: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  expressionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  expressionChipText: {
    fontSize: 20,
    fontWeight: "700",
  },
  expressionResult: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "right",
  },

  // Actions
  expressionActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  submitButton: {
    flex: 1.5,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Chips
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  numberChip: {
    minWidth: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  numberChipText: {
    fontSize: 22,
    fontWeight: "800",
  },
  operatorChip: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  operatorChipText: {
    fontSize: 26,
    fontWeight: "800",
  },

  // Round result
  resultTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  nextButton: {
    paddingHorizontal: 32,
    borderRadius: 20,
  },
  retryRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  skipButton: {
    marginLeft: 4,
  },

  // Game result
  gameOverTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 8,
  },
  finalScoreText: {
    fontSize: 56,
    fontWeight: "900",
    marginBottom: 4,
  },
  finalScoreLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  bestScoreSmall: {
    fontSize: 14,
    marginBottom: 20,
  },
  gameOverActions: {
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    width: "100%",
    maxWidth: 240,
  },
  replayButton: {
    width: "100%",
    borderRadius: 20,
  },
  shareButton: {
    width: "100%",
    borderRadius: 20,
  },
  quitButton: {
    width: "100%",
  },
});

export default withGameErrorBoundary(NumberMasterGameScreen, "number_master");
