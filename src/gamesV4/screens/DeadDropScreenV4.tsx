/**
 * Games V4 — Dead Drop Gameplay Screen
 *
 * Codenames-inspired team word game. Role-aware UI with:
 *  - Spymaster: color-coded overlay on cards + clue input
 *  - Operative: clean board + tap-to-guess + stop guessing
 *  - Phase-aware layout (clue input → guessing → game over)
 *  - Clue history sidebar, team remaining counters
 */

import type {
  CardAlignment,
  ClueEntry,
  DeadDropPrivateState,
  DeadDropPublicState,
  PlayerRole,
  PublicCard,
  TeamAssignment,
  TeamColor,
} from "@/gamesV4/adapters/deadDrop/deadDropTypes";
import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import { subscribeToPrivateState } from "@/gamesV4/services/gameServiceV4";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_COLS = 5;
const CARD_GAP = 4;
const BOARD_PAD = 8;
const CARD_WIDTH =
  (SCREEN_WIDTH - BOARD_PAD * 2 - CARD_GAP * (BOARD_COLS - 1)) / BOARD_COLS;
const CARD_HEIGHT = CARD_WIDTH * 0.7;

const TEAM_COLORS = {
  red: "#E53935",
  blue: "#1E88E5",
  neutral: "#9E9E9E",
  assassin: "#212121",
} as const;

const TEAM_BG_LIGHT: Record<string, string> = {
  red: "#FFCDD2",
  blue: "#BBDEFB",
  neutral: "#E0E0E0",
  assassin: "#424242",
};

// =============================================================================
// Helpers
// =============================================================================

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

function getTeamMember(
  teams: TeamAssignment[],
  team: TeamColor,
  role: PlayerRole,
): TeamAssignment | undefined {
  return teams.find((t) => t.team === team && t.role === role);
}

// =============================================================================
// Sub-components
// =============================================================================

/** Single card on the 5×5 board */
function BoardCard({
  card,
  keyMap,
  isSpymaster,
  isMyGuess,
  onPress,
  disabled,
}: {
  card: PublicCard;
  keyMap: Record<number, CardAlignment> | null;
  isSpymaster: boolean;
  isMyGuess: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  const revealed = card.revealed;
  let bgColor = "#F5F5F0";
  let textColor = "#333";
  let borderColor = "#CCC";

  if (revealed && card.revealedAs) {
    bgColor = TEAM_COLORS[card.revealedAs];
    textColor = card.revealedAs === "neutral" ? "#333" : "#FFF";
    borderColor = bgColor;
  } else if (isSpymaster && keyMap) {
    const alignment = keyMap[card.id];
    if (alignment) {
      bgColor = TEAM_BG_LIGHT[alignment] ?? "#F5F5F0";
      borderColor = TEAM_COLORS[alignment];
    }
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || revealed || !isMyGuess}
      style={[
        styles.card,
        {
          backgroundColor: bgColor,
          borderColor,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          opacity: revealed ? 0.6 : 1,
        },
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
      {revealed && card.revealedAs && (
        <View style={styles.revealBadge}>
          <MaterialCommunityIcons
            name={card.revealedAs === "assassin" ? "skull" : "check-circle"}
            size={14}
            color={textColor}
          />
        </View>
      )}
    </Pressable>
  );
}

/** Team score indicator */
function TeamBanner({
  team,
  remaining,
  isActive,
}: {
  team: TeamColor;
  remaining: number;
  isActive: boolean;
}) {
  return (
    <View
      style={[
        styles.teamBanner,
        { backgroundColor: TEAM_COLORS[team], opacity: isActive ? 1 : 0.5 },
      ]}
    >
      <Text style={styles.teamBannerText}>{team.toUpperCase()}</Text>
      <Text style={styles.teamBannerCount}>{remaining}</Text>
    </View>
  );
}

/** Current clue display */
function ClueDisplay({ clue }: { clue: ClueEntry | null }) {
  if (!clue) return null;
  return (
    <View style={[styles.clueBox, { borderColor: TEAM_COLORS[clue.team] }]}>
      <Text style={styles.clueWord}>{clue.word}</Text>
      <View
        style={[styles.clueBadge, { backgroundColor: TEAM_COLORS[clue.team] }]}
      >
        <Text style={styles.clueBadgeText}>
          {clue.count === -1 ? "∞" : clue.count}
        </Text>
      </View>
    </View>
  );
}

/** Clue history list */
function ClueHistory({ clues }: { clues: ClueEntry[] }) {
  if (clues.length === 0) return null;
  return (
    <View style={styles.historyContainer}>
      <Text style={styles.historyTitle}>Clue History</Text>
      {clues.map((c) => (
        <View key={c.clueId} style={styles.historyRow}>
          <View
            style={[
              styles.historyDot,
              { backgroundColor: TEAM_COLORS[c.team] },
            ]}
          />
          <Text style={styles.historyWord}>{c.word}</Text>
          <Text style={styles.historyCount}>
            {c.count === -1 ? "∞" : c.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// Clue Input Form
// =============================================================================

function ClueInputForm({
  onSubmit,
  loading,
  settings,
}: {
  onSubmit: (word: string, count: number) => void;
  loading: boolean;
  settings: DeadDropPublicState["settings"];
}) {
  const [word, setWord] = useState("");
  const [countStr, setCountStr] = useState("1");

  const handleSubmit = useCallback(() => {
    const trimmed = word.trim();
    const count = parseInt(countStr, 10);
    if (!trimmed || isNaN(count)) return;
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
    <View style={styles.clueInputContainer}>
      <Text style={styles.clueInputLabel}>Give a Clue</Text>
      <View style={styles.clueInputRow}>
        <TextInput
          style={styles.clueWordInput}
          value={word}
          onChangeText={setWord}
          placeholder="One word..."
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={30}
          editable={!loading}
        />
        <TextInput
          style={styles.clueCountInput}
          value={countStr}
          onChangeText={setCountStr}
          placeholder="#"
          keyboardType="number-pad"
          maxLength={2}
          editable={!loading}
        />
        <Pressable
          style={[
            styles.clueSubmitBtn,
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
        <Text style={styles.clueInputHint}>
          Use 0 for "zero clue"
          {settings.advancedClues === "zero_unlimited"
            ? " or -1 for unlimited"
            : ""}
        </Text>
      )}
    </View>
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
  const keyMap = isSpymaster ? (privateState?.keyMap ?? null) : null;

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
  if (state.phase === "game_over") {
    phaseText = state.winnerTeam
      ? `${state.winnerTeam.toUpperCase()} TEAM WINS!`
      : "Game Over";
  } else if (isMyCluePhase) {
    phaseText = "Your turn — give a clue!";
  } else if (isMyGuessPhase) {
    const guessesLeft =
      state.maxGuessesThisTurn > 0
        ? state.maxGuessesThisTurn - state.guessesUsedThisTurn
        : "∞";
    phaseText = `Your turn — guess! (${guessesLeft} left)`;
  } else if (state.phase === "clue_input") {
    const sm = getTeamMember(state.teams, state.turnTeam, "spymaster");
    phaseText = `Waiting for ${state.turnTeam} spymaster...`;
  } else if (state.phase === "guessing") {
    phaseText = `${state.turnTeam.toUpperCase()} team guessing...`;
  }

  const bgColor = theme.isDark ? "#121212" : "#FAFAFA";

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: bgColor }]}
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom, 16) + 80,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Team Banners */}
      <View style={styles.bannersRow}>
        <TeamBanner
          team="red"
          remaining={state.redRemaining}
          isActive={state.turnTeam === "red"}
        />
        <View style={styles.turnIndicator}>
          <Text style={[styles.turnText, { color: theme.colors.text }]}>
            Turn {state.turnNumber}
          </Text>
        </View>
        <TeamBanner
          team="blue"
          remaining={state.blueRemaining}
          isActive={state.turnTeam === "blue"}
        />
      </View>

      {/* Phase Banner */}
      <View
        style={[
          styles.phaseBanner,
          { backgroundColor: state.turnTeam === "red" ? "#FFCDD2" : "#BBDEFB" },
        ]}
      >
        <Text
          style={[styles.phaseText, { color: TEAM_COLORS[state.turnTeam] }]}
        >
          {phaseText}
        </Text>
      </View>

      {/* Role Badge */}
      {myAssignment && (
        <View style={styles.roleBadgeRow}>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: TEAM_COLORS[myAssignment.team] },
            ]}
          >
            <MaterialCommunityIcons
              name={myAssignment.role === "spymaster" ? "eye" : "magnify"}
              size={14}
              color="#FFF"
            />
            <Text style={styles.roleBadgeText}>
              {myAssignment.team.toUpperCase()}{" "}
              {myAssignment.role.toUpperCase()}
            </Text>
          </View>
        </View>
      )}

      {/* Current Clue */}
      {state.currentClue && <ClueDisplay clue={state.currentClue} />}

      {/* Board */}
      <View style={styles.boardContainer}>
        {Array.from({ length: 5 }, (_, row) => (
          <View key={row} style={styles.boardRow}>
            {state.cards
              .slice(row * BOARD_COLS, (row + 1) * BOARD_COLS)
              .map((card) => (
                <BoardCard
                  key={card.id}
                  card={card}
                  keyMap={keyMap}
                  isSpymaster={isSpymaster}
                  isMyGuess={isMyGuessPhase ?? false}
                  onPress={() => handleGuessCard(card.id)}
                  disabled={actionLoading || !isMyGuessPhase}
                />
              ))}
          </View>
        ))}
      </View>

      {/* Action Error */}
      {actionError && (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={16}
            color="#E53935"
          />
          <Text style={styles.errorText}>{actionError}</Text>
        </View>
      )}

      {/* Clue Input (spymaster, clue phase) */}
      {isMyCluePhase && (
        <ClueInputForm
          onSubmit={handleSubmitClue}
          loading={actionLoading}
          settings={state.settings}
        />
      )}

      {/* Stop Guessing Button (operative, guessing phase) */}
      {isMyGuessPhase && state.guessesUsedThisTurn > 0 && (
        <Pressable
          style={[styles.stopBtn, actionLoading && { opacity: 0.5 }]}
          onPress={handleStopGuessing}
          disabled={actionLoading}
        >
          <MaterialCommunityIcons
            name="stop-circle-outline"
            size={20}
            color="#FFF"
          />
          <Text style={styles.stopBtnText}>End Guessing</Text>
        </Pressable>
      )}

      {/* Guesses this turn info */}
      {state.phase === "guessing" && (
        <View style={styles.guessInfo}>
          <Text style={[styles.guessInfoText, { color: theme.colors.text }]}>
            Guesses: {state.guessesUsedThisTurn} /{" "}
            {state.maxGuessesThisTurn === 0 ? "∞" : state.maxGuessesThisTurn}
          </Text>
        </View>
      )}

      {/* Game Over Reveal */}
      {state.phase === "game_over" && state.endReason && (
        <View style={styles.gameOverBox}>
          <Text style={styles.gameOverReason}>
            {state.endReason === "assassin" && "The assassin was found!"}
            {state.endReason === "all_agents_found" && "All agents contacted!"}
            {state.endReason === "resign" && "A player resigned."}
            {state.endReason === "timeout" && "Time expired."}
          </Text>
        </View>
      )}

      {/* Clue History */}
      <ClueHistory clues={state.clueHistory} />
    </ScrollView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bannersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: BOARD_PAD,
    paddingTop: 8,
  },
  teamBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  teamBannerText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  teamBannerCount: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "800",
  },
  turnIndicator: {
    alignItems: "center",
  },
  turnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  phaseBanner: {
    marginHorizontal: BOARD_PAD,
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  phaseText: {
    fontSize: 14,
    fontWeight: "700",
  },
  roleBadgeRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 6,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  boardContainer: {
    paddingHorizontal: BOARD_PAD,
    paddingVertical: 8,
    gap: CARD_GAP,
  },
  boardRow: {
    flexDirection: "row",
    gap: CARD_GAP,
  },
  card: {
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
  },
  cardText: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  revealBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
  },
  clueBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: BOARD_PAD,
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    gap: 10,
  },
  clueWord: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#333",
  },
  clueBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  clueBadgeText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
  clueInputContainer: {
    marginHorizontal: BOARD_PAD,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#FFF",
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  clueInputLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    color: "#333",
  },
  clueInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  clueWordInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
    backgroundColor: "#FAFAFA",
  },
  clueCountInput: {
    width: 50,
    height: 44,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    backgroundColor: "#FAFAFA",
  },
  clueSubmitBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1E88E5",
    justifyContent: "center",
    alignItems: "center",
  },
  clueSubmitBtnDisabled: {
    opacity: 0.4,
  },
  clueInputHint: {
    marginTop: 6,
    fontSize: 11,
    color: "#999",
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: BOARD_PAD,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#FF7043",
  },
  stopBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  guessInfo: {
    alignItems: "center",
    marginTop: 6,
  },
  guessInfoText: {
    fontSize: 12,
    fontWeight: "600",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: BOARD_PAD,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
  },
  errorText: {
    color: "#C62828",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  gameOverBox: {
    alignItems: "center",
    marginHorizontal: BOARD_PAD,
    marginTop: 12,
    padding: 16,
    backgroundColor: "#212121",
    borderRadius: 12,
  },
  gameOverReason: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  historyContainer: {
    marginHorizontal: BOARD_PAD,
    marginTop: 16,
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    marginBottom: 8,
    letterSpacing: 1,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyWord: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  historyCount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
  },
});

// =============================================================================
// Export with Shell HOC
// =============================================================================

export default withGameV4Shell(DeadDropUI, "dead_drop");
