/**
 * SpectatorViewScreen
 *
 * A screen for spectators to watch a live single-player game session.
 * Shows the game state in real-time as the host plays.
 *
 * @file src/screens/games/SpectatorViewScreen.tsx
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SpectatorViewBanner } from "@/components/games/SpectatorOverlay";
import { useLiveSpectatorSession } from "@/hooks/useLiveSpectatorSession";
import { useAuth } from "@/store/AuthContext";
import { GAME_METADATA, SinglePlayerGameType } from "@/types/games";
import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

interface SpectatorViewScreenRouteParams {
  liveSessionId: string;
  gameType?: SinglePlayerGameType;
  hostName?: string;
}

// =============================================================================
// Game State Renderers
// =============================================================================

// Simple score display for any game
function GenericGameView({
  gameType,
  score,
  gameState,
}: {
  gameType: SinglePlayerGameType;
  score: number;
  gameState: Record<string, unknown>;
}) {
  const theme = useTheme();
  const gameMetadata = GAME_METADATA[gameType];
  const gameName = gameMetadata?.name || gameType;
  const gameIcon = gameMetadata?.icon || "🎮";

  return (
    <View style={styles.genericGameView}>
      {/* Game Header */}
      <View style={styles.gameHeader}>
        <Text style={styles.gameIcon}>{gameIcon}</Text>
        <Text style={[styles.gameName, { color: theme.colors.onBackground }]}>
          {gameName}
        </Text>
      </View>

      {/* Score Display */}
      <Surface
        style={[
          styles.scoreCard,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
      >
        <Text
          style={[
            styles.scoreLabel,
            { color: theme.colors.onPrimaryContainer },
          ]}
        >
          SCORE
        </Text>
        <Text
          style={[
            styles.scoreValue,
            { color: theme.colors.onPrimaryContainer },
          ]}
        >
          {score.toLocaleString()}
        </Text>
      </Surface>

      {/* Game-specific details */}
      {gameState && Object.keys(gameState).length > 0 && (
        <View style={styles.gameDetails}>
          {/* Level */}
          {(gameState.level !== undefined ||
            gameState.currentLevel !== undefined) && (
            <View
              style={[
                styles.statItem,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="stairs"
                size={20}
                color={theme.colors.primary}
              />
              <Text
                style={[styles.statValue, { color: theme.colors.onSurface }]}
              >
                Level {(gameState.level ?? gameState.currentLevel) as number}
              </Text>
            </View>
          )}

          {/* Lives */}
          {gameState.lives !== undefined && (
            <View
              style={[
                styles.statItem,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="heart"
                size={20}
                color={theme.colors.error}
              />
              <Text
                style={[styles.statValue, { color: theme.colors.onSurface }]}
              >
                {gameState.lives as number} lives
              </Text>
            </View>
          )}

          {/* Ball count (for Bounce Blitz) */}
          {gameState.ballCount !== undefined && (
            <View
              style={[
                styles.statItem,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="circle"
                size={20}
                color={theme.colors.tertiary}
              />
              <Text
                style={[styles.statValue, { color: theme.colors.onSurface }]}
              >
                {gameState.ballCount as number} balls
              </Text>
            </View>
          )}

          {/* Streak (for various games) */}
          {gameState.streak !== undefined && (
            <View
              style={[
                styles.statItem,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons name="fire" size={20} color="#FF6B35" />
              <Text
                style={[styles.statValue, { color: theme.colors.onSurface }]}
              >
                {gameState.streak as number}x streak
              </Text>
            </View>
          )}

          {/* Bricks remaining (for Brick Breaker) */}
          {gameState.bricksRemaining !== undefined && (
            <View
              style={[
                styles.statItem,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="cube-outline"
                size={20}
                color={theme.colors.secondary}
              />
              <Text
                style={[styles.statValue, { color: theme.colors.onSurface }]}
              >
                {gameState.bricksRemaining as number} bricks left
              </Text>
            </View>
          )}

          {/* Phase/Status (for games with phases) */}
          {gameState.phase !== undefined && gameState.phase !== "playing" && (
            <View
              style={[
                styles.statItem,
                { backgroundColor: theme.colors.tertiaryContainer },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  gameState.phase === "levelComplete"
                    ? "check-circle"
                    : "information"
                }
                size={20}
                color={theme.colors.onTertiaryContainer}
              />
              <Text
                style={[
                  styles.statValue,
                  { color: theme.colors.onTertiaryContainer },
                ]}
              >
                {gameState.phase === "levelComplete"
                  ? "Level Complete!"
                  : String(gameState.phase)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Watching indicator */}
      <View style={styles.watchingContainer}>
        <View
          style={[styles.pulseDot, { backgroundColor: theme.colors.error }]}
        />
        <Text
          style={[
            styles.watchingText,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Watching live...
        </Text>
      </View>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function SpectatorViewScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { currentFirebaseUser } = useAuth();

  const params = route.params as SpectatorViewScreenRouteParams;
  const { liveSessionId, hostName: initialHostName } = params;

  // Connect to the live session as a spectator
  const {
    session,
    gameState,
    currentScore,
    spectators,
    isLive,
    loading,
    error,
    leaveSession,
  } = useLiveSpectatorSession({
    sessionId: liveSessionId,
    mode: "spectator",
    userId: currentFirebaseUser?.uid,
    userName: currentFirebaseUser?.displayName || "Spectator",
  });

  // Handle leaving
  const handleLeave = useCallback(async () => {
    await leaveSession();
    navigation.goBack();
  }, [leaveSession, navigation]);

  // Derive values
  const hostName = session?.hostName || initialHostName || "Player";
  const gameType = session?.gameType || params.gameType || "bounce_blitz";
  const status = session?.status || "waiting";

  // Show loading
  if (loading && !session) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            style={[styles.loadingText, { color: theme.colors.onBackground }]}
          >
            Connecting to session...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error
  if (error || !session) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.centerContent}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={64}
            color={theme.colors.error}
          />
          <Text
            style={[styles.errorText, { color: theme.colors.onBackground }]}
          >
            {error || "Session not found"}
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.goBack()}
            style={styles.button}
          >
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Show waiting state
  if (status === "waiting") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <SpectatorViewBanner hostName={hostName} onLeave={handleLeave} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            style={[styles.waitingTitle, { color: theme.colors.onBackground }]}
          >
            Waiting for {hostName} to start...
          </Text>
          <Text
            style={[
              styles.waitingSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            The game will begin shortly
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show ended state
  if (status === "completed" || status === "abandoned") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.centerContent}>
          <MaterialCommunityIcons
            name={status === "completed" ? "check-circle" : "exit-run"}
            size={64}
            color={
              status === "completed"
                ? theme.colors.primary
                : theme.colors.outline
            }
          />
          <Text
            style={[styles.endedTitle, { color: theme.colors.onBackground }]}
          >
            {status === "completed" ? "Game Complete!" : "Session Ended"}
          </Text>
          <Surface
            style={[
              styles.finalScoreCard,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Text
              style={[
                styles.finalScoreLabel,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              Final Score
            </Text>
            <Text
              style={[
                styles.finalScoreValue,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {currentScore.toLocaleString()}
            </Text>
          </Surface>
          <Button
            mode="contained"
            onPress={() => navigation.goBack()}
            style={styles.button}
          >
            Leave
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Active game - show live view
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Banner */}
      <SpectatorViewBanner hostName={hostName} onLeave={handleLeave} />

      {/* Game View */}
      <View style={styles.gameContainer}>
        <GenericGameView
          gameType={gameType}
          score={currentScore}
          gameState={gameState || {}}
        />
      </View>

      {/* Spectator count */}
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}
      >
        <View style={styles.spectatorCountContainer}>
          <MaterialCommunityIcons
            name="eye"
            size={16}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            style={[
              styles.spectatorCountText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {spectators.length + 1} watching (including you)
          </Text>
        </View>
      </View>
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
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
  },
  errorText: {
    marginTop: Spacing.md,
    fontSize: 16,
    textAlign: "center",
  },
  waitingTitle: {
    marginTop: Spacing.lg,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  waitingSubtitle: {
    marginTop: Spacing.sm,
    fontSize: 14,
    textAlign: "center",
  },
  endedTitle: {
    marginTop: Spacing.lg,
    fontSize: 24,
    fontWeight: "600",
  },
  finalScoreCard: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    minWidth: 200,
  },
  finalScoreLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  finalScoreValue: {
    fontSize: 48,
    fontWeight: "700",
    marginTop: Spacing.xs,
  },
  button: {
    marginTop: Spacing.xl,
    minWidth: 150,
  },
  gameContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  genericGameView: {
    alignItems: "center",
    width: "100%",
    maxWidth: 350,
  },
  gameHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  gameIcon: {
    fontSize: 40,
    marginRight: Spacing.sm,
  },
  gameName: {
    fontSize: 24,
    fontWeight: "600",
  },
  scoreCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    minWidth: 200,
    marginBottom: Spacing.xl,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: "700",
    marginTop: Spacing.xs,
  },
  gameDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  watchingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  watchingText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  spectatorCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  spectatorCountText: {
    fontSize: 12,
  },
});
