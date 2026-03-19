/**
 * Games V4 — Dead Drop Gameplay Screen
 *
 * Codenames-inspired team word game with premium polish:
 *  - Full dark/light theme support
 *  - Animated card reveals with haptic feedback
 *  - Spymaster: color-coded key overlay + clue input
 *  - Operative: clean board + tap-to-guess
 *  - Phase-aware banners with team-colored accents
 *  - Rich game-over presentation with board reveal
 *  - Clue history with team-colored dots
 */

import type {
  CardAlignment,
  ClueEntry,
  DeadDropPrivateState,
  DeadDropPublicState,
  PublicCard,
  TeamColor,
} from "@/gamesV4/adapters/deadDrop/deadDropTypes";
import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import { subscribeToPrivateState } from "@/gamesV4/services/gameServiceV4";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_COLS = 5;
const CARD_GAP = 5;
const BOARD_PAD = 10;
const CARD_WIDTH =
  (SCREEN_WIDTH - BOARD_PAD * 2 - CARD_GAP * (BOARD_COLS - 1)) / BOARD_COLS;
const CARD_HEIGHT = CARD_WIDTH * 0.78;

/** Fixed team brand colors — same in light & dark */
const TEAM_COLORS: Record<string, string> = {
  red: "#E53935",
  blue: "#1E88E5",
  neutral: "#78909C",
  assassin: "#37474F",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function asPublicState(
  raw: Record<string, unknown> | null,
): DeadDropPublicState | null {
  if (!raw || !raw.cards) return null;
  return raw as unknown as DeadDropPublicState;
}

function asPrivateState(
  raw: Record<string, unknown> | null,
): DeadDropPrivateState | null {
  if (!raw || !raw.role) return null;
  return raw as unknown as DeadDropPrivateState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme-aware game palette
// ─────────────────────────────────────────────────────────────────────────────

function useGameColors(isDark: boolean) {
  return useMemo(
    () => ({
      redSurface: isDark ? "rgba(229,57,53,0.18)" : "#FFCDD2",
      blueSurface: isDark ? "rgba(30,136,229,0.18)" : "#BBDEFB",
      neutralSurface: isDark ? "rgba(120,144,156,0.14)" : "#ECEFF1",
      assassinSurface: isDark ? "rgba(244,67,54,0.14)" : "#455A64",
      cardBg: isDark ? "#1E1E2E" : "#FFFEF7",
      cardBorder: isDark ? "rgba(255,255,255,0.08)" : "#DDD8CC",
      cardText: isDark ? "#D4D4D4" : "#2D2D2D",
      boardBg: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.03)",
      surface: isDark ? "#1A1A2E" : "#FFFFFF",
      surfaceAlt: isDark ? "#252540" : "#F7F6F2",
      inputBg: isDark ? "#1A1A2E" : "#FAFAF6",
      inputBorder: isDark ? "rgba(255,255,255,0.1)" : "#DDD",
      inputText: isDark ? "#E0E0E0" : "#333",
      placeholder: isDark ? "#666" : "#AAA",
      mutedText: isDark ? "rgba(255,255,255,0.5)" : "#999",
      errorBg: isDark ? "rgba(229,57,53,0.12)" : "#FFEBEE",
      errorText: isDark ? "#EF9A9A" : "#C62828",
      divider: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
      revealedText: "#FFF",
      neutralRevealedText: isDark ? "#FFF" : "#333",
    }),
    [isDark],
  );
}

type GameColors = ReturnType<typeof useGameColors>;

function keyOverlaySurface(alignment: CardAlignment, gc: GameColors): string {
  switch (alignment) {
    case "red":
      return gc.redSurface;
    case "blue":
      return gc.blueSurface;
    case "neutral":
      return gc.neutralSurface;
    case "assassin":
      return gc.assassinSurface;
    default:
      return gc.cardBg;
  }
}

function alignmentIcon(
  a: CardAlignment,
): React.ComponentProps<typeof MaterialCommunityIcons>["name"] {
  switch (a) {
    case "red":
    case "blue":
      return "account-check";
    case "neutral":
      return "account-off";
    case "assassin":
      return "skull-crossbones";
    default:
      return "help-circle";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Single card on the 5×5 board */
function BoardCard({
  card,
  keyMap,
  isMyGuess,
  onPress,
  disabled,
  gc,
}: {
  card: PublicCard;
  keyMap: Record<number, CardAlignment> | null;
  isMyGuess: boolean;
  onPress: () => void;
  disabled: boolean;
  gc: GameColors;
}) {
  const revealed = card.revealed;
  const alignment = keyMap?.[card.id] ?? null;

  let bgColor = gc.cardBg;
  let textColor = gc.cardText;
  let borderColor = gc.cardBorder;
  let iconName:
    | React.ComponentProps<typeof MaterialCommunityIcons>["name"]
    | null = null;
  let iconColor = "#FFF";

  if (revealed && card.revealedAs) {
    bgColor = TEAM_COLORS[card.revealedAs] ?? gc.cardBg;
    textColor =
      card.revealedAs === "neutral" ? gc.neutralRevealedText : gc.revealedText;
    borderColor = bgColor;
    iconName = alignmentIcon(card.revealedAs);
    iconColor = textColor;
  } else if (alignment) {
    bgColor = keyOverlaySurface(alignment, gc);
    borderColor = TEAM_COLORS[alignment] ?? gc.cardBorder;
  }

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || revealed || !isMyGuess}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: bgColor,
          borderColor,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          opacity: revealed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.94 : 1 }],
        },
        !revealed &&
          Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 3,
            },
            android: { elevation: 2 },
          }),
      ]}
    >
      <Text
        style={[styles.cardText, { color: textColor }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {card.word}
      </Text>
      {iconName && (
        <View style={styles.revealBadge}>
          <MaterialCommunityIcons name={iconName} size={14} color={iconColor} />
        </View>
      )}
      {!revealed && alignment && (
        <View
          style={[
            styles.keyIndicator,
            { backgroundColor: TEAM_COLORS[alignment] },
          ]}
        />
      )}
    </Pressable>
  );
}

/** Team score banner */
function TeamBanner({
  team,
  remaining,
  isActive,
  gc,
}: {
  team: TeamColor;
  remaining: number;
  isActive: boolean;
  gc: GameColors;
}) {
  const bg = TEAM_COLORS[team];
  return (
    <View
      style={[
        styles.teamBanner,
        {
          backgroundColor: isActive ? bg : gc.surfaceAlt,
          borderColor: bg,
          borderWidth: isActive ? 0 : 1.5,
        },
      ]}
    >
      <Text style={[styles.teamBannerLabel, { color: isActive ? "#FFF" : bg }]}>
        {team.toUpperCase()}
      </Text>
      <Text style={[styles.teamBannerCount, { color: isActive ? "#FFF" : bg }]}>
        {remaining}
      </Text>
    </View>
  );
}

/** Current clue display — prominent banner */
function ClueDisplay({ clue, gc }: { clue: ClueEntry | null; gc: GameColors }) {
  if (!clue) return null;
  const teamColor = TEAM_COLORS[clue.team];
  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      style={[
        styles.clueBox,
        {
          borderColor: teamColor,
          backgroundColor: gc.surface,
        },
      ]}
    >
      <View style={[styles.clueAccent, { backgroundColor: teamColor }]} />
      <Text style={[styles.clueWord, { color: gc.cardText }]}>{clue.word}</Text>
      <View style={[styles.clueBadge, { backgroundColor: teamColor }]}>
        <Text style={styles.clueBadgeText}>
          {clue.count === -1 ? "∞" : clue.count}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Clue history section */
function ClueHistory({ clues, gc }: { clues: ClueEntry[]; gc: GameColors }) {
  if (clues.length === 0) return null;
  return (
    <View style={[styles.historyContainer, { backgroundColor: gc.surfaceAlt }]}>
      <Text style={[styles.historyTitle, { color: gc.mutedText }]}>
        CLUE HISTORY
      </Text>
      {clues.map((c) => (
        <View
          key={c.clueId}
          style={[styles.historyRow, { borderBottomColor: gc.divider }]}
        >
          <View
            style={[
              styles.historyDot,
              { backgroundColor: TEAM_COLORS[c.team] },
            ]}
          />
          <Text style={[styles.historyWord, { color: gc.cardText }]}>
            {c.word}
          </Text>
          <Text style={[styles.historyCount, { color: gc.mutedText }]}>
            {c.count === -1 ? "∞" : c.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Clue Input Form
// ─────────────────────────────────────────────────────────────────────────────

function ClueInputForm({
  onSubmit,
  loading,
  settings,
  teamColor,
  gc,
}: {
  onSubmit: (word: string, count: number) => void;
  loading: boolean;
  settings: DeadDropPublicState["settings"];
  teamColor: string;
  gc: GameColors;
}) {
  const [word, setWord] = useState("");
  const [countStr, setCountStr] = useState("1");

  const handleSubmit = useCallback(() => {
    const trimmed = word.trim();
    const count = parseInt(countStr, 10);
    if (!trimmed || isNaN(count)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(trimmed, count);
    Keyboard.dismiss();
    setWord("");
    setCountStr("1");
  }, [word, countStr, onSubmit]);

  const minCount =
    settings.advancedClues === "off"
      ? 1
      : settings.advancedClues === "zero"
        ? 0
        : -1;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[
        styles.clueInputContainer,
        { backgroundColor: gc.surface },
        Platform.select({
          ios: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
          },
          android: { elevation: 3 },
        }),
      ]}
    >
      <View style={styles.clueInputHeader}>
        <MaterialCommunityIcons name="eye" size={16} color={teamColor} />
        <Text style={[styles.clueInputLabel, { color: gc.cardText }]}>
          Give a Clue
        </Text>
      </View>
      <View style={styles.clueInputRow}>
        <TextInput
          style={[
            styles.clueWordInput,
            {
              backgroundColor: gc.inputBg,
              borderColor: gc.inputBorder,
              color: gc.inputText,
            },
          ]}
          value={word}
          onChangeText={setWord}
          placeholder="One word..."
          placeholderTextColor={gc.placeholder}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={30}
          editable={!loading}
        />
        <TextInput
          style={[
            styles.clueCountInput,
            {
              backgroundColor: gc.inputBg,
              borderColor: gc.inputBorder,
              color: gc.inputText,
            },
          ]}
          value={countStr}
          onChangeText={setCountStr}
          placeholder="#"
          placeholderTextColor={gc.placeholder}
          keyboardType="number-pad"
          maxLength={2}
          editable={!loading}
        />
        <Pressable
          style={[
            styles.clueSubmitBtn,
            { backgroundColor: teamColor },
            (!word.trim() || loading) && styles.clueSubmitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!word.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <MaterialCommunityIcons name="send" size={20} color="#FFF" />
          )}
        </Pressable>
      </View>
      {minCount < 1 && (
        <Text style={[styles.clueInputHint, { color: gc.mutedText }]}>
          Use 0 for "zero clue"
          {settings.advancedClues === "zero_unlimited"
            ? " or -1 for unlimited"
            : ""}
        </Text>
      )}
    </Animated.View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function DeadDropUI({
  publicState: rawState,
  isMyTurn,
  isTerminal,
  myUid,
  turnOrder,
  submitMove,
  actionLoading,
  actionError,
  sessionId,
}: GameShellProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const gc = useGameColors(theme.isDark);

  // ── Parse state ───────────────────────────────────────────────────────────
  const state = useMemo(() => asPublicState(rawState), [rawState]);

  // ── Subscribe to private state for hidden info ────────────────────────────
  const [privateState, setPrivateState] = useState<DeadDropPrivateState | null>(
    null,
  );

  useEffect(() => {
    if (!sessionId || !myUid) return;
    if (!turnOrder.includes(myUid)) return; // spectator
    const unsub = subscribeToPrivateState(
      sessionId,
      myUid,
      (raw) => setPrivateState(asPrivateState(raw)),
      (err) => console.warn("[DeadDrop] private state error:", err.message),
    );
    return unsub;
  }, [sessionId, myUid, turnOrder]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const myAssignment = useMemo(
    () => state?.teams.find((t) => t.uid === myUid) ?? null,
    [state, myUid],
  );
  const isSpymaster = myAssignment?.role === "spymaster";
  const isOperative = myAssignment?.role === "operative";
  const isSpectator = !myAssignment;
  const isMyCluePhase =
    isMyTurn && state?.phase === "clue_input" && isSpymaster;
  const isMyGuessPhase = isMyTurn && state?.phase === "guessing" && isOperative;
  const isGameOver = state?.phase === "game_over";
  const keyMap = isSpymaster
    ? (privateState?.keyMap ?? null)
    : isGameOver
      ? (state?.revealedKeyMap ?? null)
      : null;

  const activeTeamColor = state
    ? (TEAM_COLORS[state.turnTeam] ?? theme.colors.primary)
    : theme.colors.primary;

  // ── Move handlers ─────────────────────────────────────────────────────────
  const handleSubmitClue = useCallback(
    (word: string, count: number) => {
      submitMove({ action: "submit_clue", word, count });
    },
    [submitMove],
  );

  const handleGuessCard = useCallback(
    (cardId: number) => {
      submitMove({ action: "guess_word", cardId });
    },
    [submitMove],
  );

  const handleStopGuessing = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    submitMove({ action: "stop_guessing" });
  }, [submitMove]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!state) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // ── Phase banner ──────────────────────────────────────────────────────────
  let phaseText = "";
  let phaseIcon: React.ComponentProps<typeof MaterialCommunityIcons>["name"] =
    "information-outline";
  if (isGameOver) {
    phaseText = state.winnerTeam
      ? `${state.winnerTeam.toUpperCase()} TEAM WINS!`
      : "Game Over";
    phaseIcon = "trophy";
  } else if (isMyCluePhase) {
    phaseText = "Your turn — give a clue!";
    phaseIcon = "lightbulb-on-outline";
  } else if (isMyGuessPhase) {
    const guessesLeft =
      state.maxGuessesThisTurn > 0
        ? state.maxGuessesThisTurn - state.guessesUsedThisTurn
        : "∞";
    phaseText = `Your turn — guess! (${guessesLeft} left)`;
    phaseIcon = "target";
  } else if (state.phase === "clue_input") {
    phaseText = `Waiting for ${state.turnTeam} spymaster...`;
    phaseIcon = "clock-outline";
  } else if (state.phase === "guessing") {
    phaseText = `${state.turnTeam.toUpperCase()} team guessing...`;
    phaseIcon = "magnify";
  }

  const phaseBannerBg =
    state.turnTeam === "red" ? gc.redSurface : gc.blueSurface;

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom, 16) + 80,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Team Banners ─────────────────────────────────── */}
      <View style={styles.bannersRow}>
        <TeamBanner
          team="red"
          remaining={state.redRemaining}
          isActive={state.turnTeam === "red"}
          gc={gc}
        />
        <View style={styles.turnIndicator}>
          <Text style={[styles.turnLabel, { color: gc.mutedText }]}>TURN</Text>
          <Text style={[styles.turnNumber, { color: theme.colors.text }]}>
            {state.turnNumber}
          </Text>
        </View>
        <TeamBanner
          team="blue"
          remaining={state.blueRemaining}
          isActive={state.turnTeam === "blue"}
          gc={gc}
        />
      </View>

      {/* ── Phase Banner ─────────────────────────────────── */}
      <View style={[styles.phaseBanner, { backgroundColor: phaseBannerBg }]}>
        <MaterialCommunityIcons
          name={phaseIcon}
          size={16}
          color={activeTeamColor}
          style={{ marginRight: 6 }}
        />
        <Text style={[styles.phaseText, { color: activeTeamColor }]}>
          {phaseText}
        </Text>
      </View>

      {/* ── Role Badge ──────────────────────────────────── */}
      {myAssignment && (
        <View style={styles.roleBadgeRow}>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: TEAM_COLORS[myAssignment.team] },
            ]}
          >
            <MaterialCommunityIcons
              name={isSpymaster ? "eye" : "magnify"}
              size={15}
              color="#FFF"
            />
            <Text style={styles.roleBadgeText}>
              {myAssignment.team.toUpperCase()}{" "}
              {myAssignment.role.toUpperCase()}
            </Text>
          </View>
        </View>
      )}
      {isSpectator && (
        <View style={styles.roleBadgeRow}>
          <View style={[styles.roleBadge, { backgroundColor: gc.mutedText }]}>
            <MaterialCommunityIcons
              name="eye-off-outline"
              size={15}
              color="#FFF"
            />
            <Text style={styles.roleBadgeText}>SPECTATING</Text>
          </View>
        </View>
      )}

      {/* ── Current Clue ─────────────────────────────────── */}
      {state.currentClue && <ClueDisplay clue={state.currentClue} gc={gc} />}

      {/* ── Board ────────────────────────────────────────── */}
      <View style={[styles.boardContainer, { backgroundColor: gc.boardBg }]}>
        {Array.from({ length: 5 }, (_, row) => (
          <View key={row} style={styles.boardRow}>
            {state.cards
              .slice(row * BOARD_COLS, (row + 1) * BOARD_COLS)
              .map((card) => (
                <BoardCard
                  key={card.id}
                  card={card}
                  keyMap={keyMap}
                  isMyGuess={isMyGuessPhase ?? false}
                  onPress={() => handleGuessCard(card.id)}
                  disabled={actionLoading || !isMyGuessPhase}
                  gc={gc}
                />
              ))}
          </View>
        ))}
      </View>

      {/* ── Action Error ─────────────────────────────────── */}
      {actionError && (
        <View style={[styles.errorBox, { backgroundColor: gc.errorBg }]}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={16}
            color={gc.errorText}
          />
          <Text style={[styles.errorText, { color: gc.errorText }]}>
            {actionError}
          </Text>
        </View>
      )}

      {/* ── Clue Input (spymaster, clue phase) ──────────── */}
      {isMyCluePhase && (
        <ClueInputForm
          onSubmit={handleSubmitClue}
          loading={actionLoading}
          settings={state.settings}
          teamColor={activeTeamColor}
          gc={gc}
        />
      )}

      {/* ── Stop Guessing (operative, guessing phase) ────── */}
      {isMyGuessPhase && state.guessesUsedThisTurn > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.stopBtn,
            {
              backgroundColor: activeTeamColor,
              opacity: actionLoading ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
          onPress={handleStopGuessing}
          disabled={actionLoading}
        >
          <MaterialCommunityIcons
            name="hand-back-left"
            size={18}
            color="#FFF"
          />
          <Text style={styles.stopBtnText}>End Guessing</Text>
        </Pressable>
      )}

      {/* ── Guesses this turn ────────────────────────────── */}
      {state.phase === "guessing" && (
        <View style={styles.guessInfo}>
          <Text style={[styles.guessInfoLabel, { color: gc.mutedText }]}>
            GUESSES
          </Text>
          <Text style={[styles.guessInfoValue, { color: theme.colors.text }]}>
            {state.guessesUsedThisTurn} /{" "}
            {state.maxGuessesThisTurn === 0 ? "∞" : state.maxGuessesThisTurn}
          </Text>
        </View>
      )}

      {/* ── Game Over ────────────────────────────────────── */}
      {isGameOver && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[
            styles.gameOverBox,
            {
              backgroundColor: gc.surface,
              borderColor: state.winnerTeam
                ? TEAM_COLORS[state.winnerTeam]
                : gc.divider,
            },
          ]}
        >
          {state.winnerTeam && (
            <View
              style={[
                styles.gameOverAccent,
                { backgroundColor: TEAM_COLORS[state.winnerTeam] },
              ]}
            />
          )}
          <MaterialCommunityIcons
            name={
              state.endReason === "assassin"
                ? "skull-crossbones"
                : state.endReason === "resign"
                  ? "flag-outline"
                  : "trophy"
            }
            size={32}
            color={
              state.winnerTeam ? TEAM_COLORS[state.winnerTeam] : gc.mutedText
            }
          />
          <Text
            style={[
              styles.gameOverTitle,
              {
                color: state.winnerTeam
                  ? TEAM_COLORS[state.winnerTeam]
                  : theme.colors.text,
              },
            ]}
          >
            {state.winnerTeam
              ? `${state.winnerTeam.toUpperCase()} WINS!`
              : "GAME OVER"}
          </Text>
          {state.endReason && (
            <Text style={[styles.gameOverReason, { color: gc.mutedText }]}>
              {state.endReason === "assassin" && "The assassin was uncovered!"}
              {state.endReason === "all_agents_found" &&
                "All agents contacted!"}
              {state.endReason === "resign" && "A player resigned."}
              {state.endReason === "timeout" && "Time expired."}
            </Text>
          )}
          <View style={[styles.gameOverScores, { borderTopColor: gc.divider }]}>
            <View style={styles.gameOverScoreCol}>
              <View
                style={[
                  styles.gameOverScoreDot,
                  { backgroundColor: TEAM_COLORS.red },
                ]}
              />
              <Text
                style={[styles.gameOverScoreNum, { color: theme.colors.text }]}
              >
                {state.redRemaining}
              </Text>
              <Text
                style={[styles.gameOverScoreLabel, { color: gc.mutedText }]}
              >
                left
              </Text>
            </View>
            <View
              style={[styles.gameOverDivider, { backgroundColor: gc.divider }]}
            />
            <View style={styles.gameOverScoreCol}>
              <View
                style={[
                  styles.gameOverScoreDot,
                  { backgroundColor: TEAM_COLORS.blue },
                ]}
              />
              <Text
                style={[styles.gameOverScoreNum, { color: theme.colors.text }]}
              >
                {state.blueRemaining}
              </Text>
              <Text
                style={[styles.gameOverScoreLabel, { color: gc.mutedText }]}
              >
                left
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── Clue History ─────────────────────────────────── */}
      <ClueHistory clues={state.clueHistory} gc={gc} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Team banners ──────────────────────────────────────
  bannersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: BOARD_PAD,
    paddingTop: 10,
  },
  teamBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    minWidth: 90,
    justifyContent: "center",
  },
  teamBannerLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  teamBannerCount: {
    fontSize: 22,
    fontWeight: "800",
  },
  turnIndicator: {
    alignItems: "center",
  },
  turnLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  turnNumber: {
    fontSize: 18,
    fontWeight: "800",
  },

  // ── Phase banner ──────────────────────────────────────
  phaseBanner: {
    flexDirection: "row",
    marginHorizontal: BOARD_PAD,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ── Role badge ────────────────────────────────────────
  roleBadgeRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  roleBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  // ── Board ─────────────────────────────────────────────
  boardContainer: {
    marginHorizontal: BOARD_PAD,
    marginTop: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 12,
    gap: CARD_GAP,
  },
  boardRow: {
    flexDirection: "row",
    gap: CARD_GAP,
  },

  // ── Card ──────────────────────────────────────────────
  card: {
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
    paddingVertical: 3,
    overflow: "hidden",
  },
  cardText: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  revealBadge: {
    position: "absolute",
    bottom: 3,
    right: 3,
  },
  keyIndicator: {
    position: "absolute",
    bottom: 0,
    left: 4,
    right: 4,
    height: 3,
    borderRadius: 2,
  },

  // ── Clue Display ──────────────────────────────────────
  clueBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: BOARD_PAD,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
    overflow: "hidden",
  },
  clueAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  clueWord: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  clueBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  clueBadgeText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },

  // ── Clue Input ────────────────────────────────────────
  clueInputContainer: {
    marginHorizontal: BOARD_PAD,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
  },
  clueInputHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  clueInputLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  clueInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  clueWordInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
  },
  clueCountInput: {
    width: 52,
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },
  clueSubmitBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  clueSubmitBtnDisabled: {
    opacity: 0.35,
  },
  clueInputHint: {
    marginTop: 8,
    fontSize: 11,
  },

  // ── Stop Guessing ─────────────────────────────────────
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: BOARD_PAD,
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: 12,
  },
  stopBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ── Guess Info ────────────────────────────────────────
  guessInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  guessInfoLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  guessInfoValue: {
    fontSize: 15,
    fontWeight: "800",
  },

  // ── Error ─────────────────────────────────────────────
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: BOARD_PAD,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  // ── Game Over ─────────────────────────────────────────
  gameOverBox: {
    alignItems: "center",
    marginHorizontal: BOARD_PAD,
    marginTop: 14,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
    gap: 6,
  },
  gameOverAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  gameOverTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  gameOverReason: {
    fontSize: 14,
    fontWeight: "500",
  },
  gameOverScores: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 24,
    width: "100%",
  },
  gameOverScoreCol: {
    alignItems: "center",
    gap: 2,
  },
  gameOverScoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gameOverScoreNum: {
    fontSize: 22,
    fontWeight: "800",
  },
  gameOverScoreLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  gameOverDivider: {
    width: 1,
    height: 36,
  },

  // ── History ───────────────────────────────────────────
  historyContainer: {
    marginHorizontal: BOARD_PAD,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
  },
  historyTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyWord: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    letterSpacing: 0.5,
  },
  historyCount: {
    fontSize: 14,
    fontWeight: "700",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Export with Shell HOC
// ─────────────────────────────────────────────────────────────────────────────

export default withGameV4Shell(DeadDropUI, "dead_drop");
