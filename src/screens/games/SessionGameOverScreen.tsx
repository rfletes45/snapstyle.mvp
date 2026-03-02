/**
 * SessionGameOverScreen — Universal v3 Game Over Screen
 *
 * Replaces the per-game `GameOverModal` overlay with a proper navigation
 * screen that lives in the PlayStack. When a v3 session reaches a terminal
 * phase ("resolved", "abandoned", "expired"), the game screen navigates
 * here instead of showing an inline modal.
 *
 * Features:
 *   - Subscribes to session doc via `useSessionGameOver` (multiplayer)
 *   - Accepts `resultFacts` route param for adapter-provided data
 *   - Win / Loss / Draw / Abandoned result display with themed header
 *   - Scoreboard with scores and winner badge
 *   - Key performance metrics from GameResultFacts
 *   - XP earned + level-up indicator + achievements unlocked
 *   - Rematch, share, and exit actions
 *   - Confetti particles on win (reuses SkiaParticleBurst)
 *   - Accessibility announcements
 *   - Back button navigates to GamesHub (clean exit)
 *
 * Route params:
 *   - sessionId: The v3 session document ID (multiplayer)
 *   - resultFacts?: JSON-stringified GameResultFacts (from runtime shells)
 *   - isSolo?: boolean (when true, shows solo-specific UI)
 *
 * @module screens/games/SessionGameOverScreen
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  BackHandler,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { TurnSummaryCard } from "@/components/games/TurnSummaryCard";
import { GAME_SCREEN_MAP } from "@/config/gameCategories";
import { Spacing } from "@/constants/theme";
import {
  useSessionGameOver,
  type GameOverResult,
  type SessionGameOverParticipant,
} from "@/hooks/useSessionGameOver";
import { createSession } from "@/services/gameSessions";
import { useAuth } from "@/store/AuthContext";
import type { GameResultFacts } from "@/types/gameResultFacts";
import type { PlayStackParamList } from "@/types/navigation/root";
import { exitGameSession } from "@/utils/gameNavHelpers";
import { createLogger } from "@/utils/log";

const log = createLogger("SessionGameOverScreen");

type ScreenRoute = RouteProp<PlayStackParamList, "SessionGameOverScreen">;
type ScreenNav = NativeStackNavigationProp<PlayStackParamList>;

// =============================================================================
// Constants
// =============================================================================

const RESULT_CONFIG: Record<
  GameOverResult,
  { title: string; emoji: string; haptic: Haptics.NotificationFeedbackType }
> = {
  win: {
    title: "VICTORY!",
    emoji: "🏆",
    haptic: Haptics.NotificationFeedbackType.Success,
  },
  loss: {
    title: "DEFEAT",
    emoji: "💔",
    haptic: Haptics.NotificationFeedbackType.Error,
  },
  draw: {
    title: "DRAW",
    emoji: "🤝",
    haptic: Haptics.NotificationFeedbackType.Warning,
  },
  forfeit: {
    title: "FORFEIT",
    emoji: "🏳️",
    haptic: Haptics.NotificationFeedbackType.Warning,
  },
  abandoned: {
    title: "SESSION ENDED",
    emoji: "⚠️",
    haptic: Haptics.NotificationFeedbackType.Warning,
  },
};

// =============================================================================
// Performance Metric Row
// =============================================================================

function PerformanceMetricRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.metricRow}>
      {icon && (
        <MaterialCommunityIcons
          name={icon as any}
          size={16}
          color={theme.colors.onSurfaceVariant}
        />
      )}
      <Text
        style={[styles.metricLabel, { color: theme.colors.onSurfaceVariant }]}
      >
        {label}
      </Text>
      <Text style={[styles.metricValue, { color: theme.colors.onSurface }]}>
        {value}
      </Text>
    </View>
  );
}

// =============================================================================
// Participant Row
// =============================================================================

function ParticipantResultRow({
  participant,
  isCurrentUser,
}: {
  participant: SessionGameOverParticipant;
  isCurrentUser: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.participantRow,
        {
          backgroundColor: isCurrentUser
            ? theme.colors.primaryContainer
            : theme.colors.surfaceVariant,
          borderColor: participant.isWinner
            ? theme.colors.primary
            : "transparent",
        },
      ]}
    >
      <View style={styles.participantLeft}>
        {participant.isWinner && (
          <MaterialCommunityIcons
            name="crown"
            size={18}
            color={theme.colors.primary}
          />
        )}
        <Text
          style={[
            styles.participantName,
            {
              color: theme.colors.onSurface,
              fontWeight: isCurrentUser ? "700" : "500",
            },
          ]}
          numberOfLines={1}
        >
          {participant.displayName}
          {isCurrentUser ? " (You)" : ""}
        </Text>
      </View>
      {participant.score !== undefined && (
        <Text
          style={[
            styles.participantScore,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {participant.score}
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// Main Screen
// =============================================================================

export default function SessionGameOverScreen() {
  const route = useRoute<ScreenRoute>();
  const navigation = useNavigation<ScreenNav>();
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const { sessionId } = route.params;
  const rawResultFacts = (route.params as any)?.resultFacts as
    | string
    | undefined;
  const isSolo = (route.params as any)?.isSolo === true;

  // Parse result facts from route params (if provided by runtime shell)
  const parsedFacts: GameResultFacts | null = useMemo(() => {
    if (!rawResultFacts) return null;
    try {
      return JSON.parse(rawResultFacts) as GameResultFacts;
    } catch {
      log.warn("Failed to parse resultFacts from route params");
      return null;
    }
  }, [rawResultFacts]);

  // Subscribe to session doc (multiplayer path)
  const gameOver = useSessionGameOver(isSolo ? undefined : sessionId, uid);

  const [rematchLoading, setRematchLoading] = useState(false);
  const rematchLockRef = useRef(false);

  // --- Result config ---
  // Derive result from either parsedFacts or session gameOver
  const effectiveResult: GameOverResult = useMemo(() => {
    if (parsedFacts) {
      // Map GameOutcome to GameOverResult
      switch (parsedFacts.outcome) {
        case "win":
          return "win";
        case "lose":
          return "loss";
        case "draw":
          return "draw";
        case "completed":
          return "win"; // "completed" is a solo win
        default:
          return "abandoned";
      }
    }
    return gameOver?.result ?? "abandoned";
  }, [parsedFacts, gameOver]);

  const config = useMemo(
    () => RESULT_CONFIG[effectiveResult],
    [effectiveResult],
  );

  // --- Haptic on mount ---
  useEffect(() => {
    if (gameOver || parsedFacts) {
      Haptics.notificationAsync(config.haptic);
    }
  }, [effectiveResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Accessibility ---
  useEffect(() => {
    if (!gameOver && !parsedFacts) return;
    const winnerName =
      parsedFacts?.scoreboard.find((e) => e.isWinner)?.displayName ??
      gameOver?.winnerName;
    const announcement =
      effectiveResult === "win"
        ? `Game over. You won!${winnerName ? ` Winner: ${winnerName}.` : ""}`
        : effectiveResult === "loss"
          ? "Game over. You lost."
          : effectiveResult === "draw"
            ? "Game over. It's a draw."
            : `Game over. Session ended.`;
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [effectiveResult, parsedFacts, gameOver]);

  // --- Back handler → exit to GamesHub ---
  const handleExit = useCallback(() => {
    // Use exitGameSession to properly clear recovery bookmark before navigating
    exitGameSession(
      { type: "playHub" },
      { dispatch: navigation.dispatch },
    ).catch((err) => log.warn("handleExit failed", { err }));
  }, [navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleExit();
      return true;
    });
    return () => sub.remove();
  }, [handleExit]);

  // --- Rematch ---
  const handleRematch = useCallback(async () => {
    if (!uid || rematchLockRef.current) return;
    rematchLockRef.current = true;
    const sourceGameOver = gameOver;
    if (!sourceGameOver) {
      rematchLockRef.current = false;
      return;
    }
    setRematchLoading(true);
    try {
      const result = await createSession({
        gameType: sourceGameOver.gameType,
        runtimeType: sourceGameOver.session.runtimeType,
        visibility: sourceGameOver.session.visibility,
        maxParticipants: sourceGameOver.session.maxParticipants,
        conversationId: sourceGameOver.session.conversationId,
        entrySource: sourceGameOver.session.entrySource,
      });

      if (result.success && result.sessionId) {
        // Navigate to the new session lobby
        (navigation as any).replace("SessionLobbyScreen", {
          sessionId: result.sessionId,
          source: "play",
        });
      } else {
        log.error("Rematch failed", { error: result.error });
      }
    } catch (err) {
      log.error("Rematch error", { error: err });
    } finally {
      setRematchLoading(false);
      rematchLockRef.current = false;
    }
  }, [gameOver, uid, navigation]);

  // --- Play again (solo) — go to game screen directly ---
  const handlePlayAgain = useCallback(() => {
    const gameType = parsedFacts?.gameId ?? gameOver?.gameType;
    if (!gameType) return;
    const screenName =
      GAME_SCREEN_MAP[gameType as keyof typeof GAME_SCREEN_MAP];
    if (screenName) {
      (navigation as any).replace(screenName);
    } else {
      handleExit();
    }
  }, [parsedFacts, gameOver, navigation, handleExit]);

  // --- Loading ---
  if (!gameOver && !parsedFacts) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Text style={{ color: theme.colors.onSurface, textAlign: "center" }}>
          Loading results…
        </Text>
      </View>
    );
  }

  const isMultiplayer = parsedFacts
    ? parsedFacts.mode !== "solo"
    : gameOver
      ? gameOver.session.runtimeType !== "solo"
      : false;

  // XP for current user
  const currentUserXp = uid
    ? (parsedFacts?.xpAwarded?.[uid] ?? gameOver?.xpAwarded?.[uid])
    : undefined;

  // Achievements unlocked
  const achievementsUnlocked = parsedFacts?.achievementsUnlocked ?? [];

  // Outcome reason
  const outcomeReason = parsedFacts?.outcomeReason;

  // Winner name
  const winnerName =
    parsedFacts?.scoreboard.find((e) => e.isWinner)?.displayName ??
    gameOver?.winnerName;

  // Performance metrics from facts
  const performanceMetrics = parsedFacts?.performanceMetrics ?? [];

  // Turn summary (turn-based games only)
  const turnSummary = parsedFacts?.turnSummary;

  // Build participants list — prefer facts scoreboard, fall back to session
  const sortedParticipants: SessionGameOverParticipant[] = useMemo(() => {
    if (parsedFacts && parsedFacts.scoreboard.length > 0) {
      return parsedFacts.scoreboard.map((entry) => ({
        uid: entry.uid,
        displayName: entry.displayName,
        avatarUrl: entry.avatarUrl,
        score: entry.score,
        isWinner: entry.isWinner,
        role: "player",
      }));
    }
    if (gameOver) {
      return [...gameOver.participants].sort((a, b) => {
        if (a.isWinner && !b.isWinner) return -1;
        if (!a.isWinner && b.isWinner) return 1;
        return (b.score ?? 0) - (a.score ?? 0);
      });
    }
    return [];
  }, [parsedFacts, gameOver]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* === Result Header === */}
      <View
        style={[
          styles.header,
          {
            backgroundColor:
              effectiveResult === "win"
                ? theme.colors.primaryContainer
                : effectiveResult === "loss"
                  ? theme.colors.errorContainer
                  : theme.colors.surfaceVariant,
          },
        ]}
      >
        <Text style={styles.emoji}>{config.emoji}</Text>
        <Text
          style={[
            styles.title,
            {
              color:
                effectiveResult === "win"
                  ? theme.colors.onPrimaryContainer
                  : effectiveResult === "loss"
                    ? theme.colors.onErrorContainer
                    : theme.colors.onSurfaceVariant,
            },
          ]}
        >
          {config.title}
        </Text>
        {winnerName && effectiveResult !== "abandoned" && (
          <Text
            style={[
              styles.winnerText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Winner: {winnerName}
          </Text>
        )}
        {outcomeReason && (
          <Text
            style={[
              styles.outcomeReason,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {outcomeReason}
          </Text>
        )}
      </View>

      {/* === Participants / Scoreboard === */}
      {sortedParticipants.length > 0 && (
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
          >
            {isMultiplayer ? "Players" : "Results"}
          </Text>
          {sortedParticipants
            .filter((p) => p.role !== "spectator")
            .map((p) => (
              <ParticipantResultRow
                key={p.uid}
                participant={p}
                isCurrentUser={p.uid === uid}
              />
            ))}
        </View>
      )}

      {/* === Performance Metrics === */}
      {performanceMetrics.length > 0 && (
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
          >
            Stats
          </Text>
          <View
            style={[
              styles.metricsContainer,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            {performanceMetrics.map((metric, i) => (
              <PerformanceMetricRow
                key={i}
                label={metric.label}
                value={metric.value}
                icon={metric.icon}
              />
            ))}
          </View>
        </View>
      )}

      {/* === XP Earned === */}
      {turnSummary && turnSummary.length > 0 && (
        <View style={styles.section}>
          <TurnSummaryCard
            entries={turnSummary}
            durationMs={parsedFacts?.durationMs}
            totalTurns={
              (gameOver?.session as any)?.resolution?.turnCount ??
              turnSummary.reduce((sum, e) => sum + e.moveCount, 0)
            }
          />
        </View>
      )}

      {/* === XP Earned === */}
      {currentUserXp !== undefined && currentUserXp > 0 && (
        <View
          style={[
            styles.xpBanner,
            { backgroundColor: theme.colors.tertiaryContainer },
          ]}
        >
          <MaterialCommunityIcons
            name="star-four-points"
            size={20}
            color={theme.colors.onTertiaryContainer}
          />
          <Text
            style={[styles.xpText, { color: theme.colors.onTertiaryContainer }]}
          >
            +{currentUserXp} XP
          </Text>
          {parsedFacts?.didLevelUp && parsedFacts?.newLevel && (
            <Text
              style={[
                styles.levelUpText,
                { color: theme.colors.onTertiaryContainer },
              ]}
            >
              🎉 Level {parsedFacts.newLevel}!
            </Text>
          )}
        </View>
      )}

      {/* === Achievements Unlocked === */}
      {achievementsUnlocked.length > 0 && (
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
          >
            Achievements Unlocked
          </Text>
          <View
            style={[
              styles.achievementsContainer,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            {achievementsUnlocked.map((achievementId) => (
              <View key={achievementId} style={styles.achievementRow}>
                <MaterialCommunityIcons
                  name="trophy"
                  size={18}
                  color={theme.colors.primary}
                />
                <Text
                  style={[
                    styles.achievementText,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {achievementId}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* === Leaderboard Updated === */}
      {parsedFacts?.leaderboardUpdated && (
        <View
          style={[
            styles.leaderboardBanner,
            { backgroundColor: theme.colors.secondaryContainer },
          ]}
        >
          <MaterialCommunityIcons
            name="chart-bar"
            size={18}
            color={theme.colors.onSecondaryContainer}
          />
          <Text
            style={[
              styles.leaderboardText,
              { color: theme.colors.onSecondaryContainer },
            ]}
          >
            Leaderboard updated
          </Text>
        </View>
      )}

      {/* === Actions === */}
      <View style={styles.actions}>
        {isMultiplayer && effectiveResult !== "abandoned" && (
          <Button
            mode="contained"
            onPress={handleRematch}
            loading={rematchLoading}
            disabled={rematchLoading}
            icon="reload"
            style={styles.actionButton}
          >
            Rematch
          </Button>
        )}

        {!isMultiplayer && (
          <Button
            mode="contained"
            onPress={handlePlayAgain}
            icon="replay"
            style={styles.actionButton}
          >
            Play Again
          </Button>
        )}

        <Button
          mode="outlined"
          onPress={handleExit}
          icon="exit-to-app"
          style={styles.actionButton}
        >
          Exit
        </Button>
      </View>
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
  contentContainer: {
    paddingBottom: Spacing.xl * 2,
  },
  header: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    paddingHorizontal: Spacing.lg,
  },
  emoji: {
    fontSize: 64,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 2,
  },
  winnerText: {
    fontSize: 16,
    marginTop: Spacing.sm,
  },
  outcomeReason: {
    fontSize: 14,
    marginTop: Spacing.xs,
    fontStyle: "italic",
    opacity: 0.8,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: Spacing.xs,
  },
  participantLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  participantName: {
    fontSize: 16,
  },
  participantScore: {
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  xpBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  xpText: {
    fontSize: 18,
    fontWeight: "800",
  },
  levelUpText: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: Spacing.sm,
  },
  metricsContainer: {
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  metricLabel: {
    fontSize: 14,
    flex: 1,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  achievementsContainer: {
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  achievementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  achievementText: {
    fontSize: 14,
    fontWeight: "600",
  },
  leaderboardBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
  },
  leaderboardText: {
    fontSize: 14,
    fontWeight: "600",
  },
  actions: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.sm,
  },
  actionButton: {
    borderRadius: 12,
  },
});
