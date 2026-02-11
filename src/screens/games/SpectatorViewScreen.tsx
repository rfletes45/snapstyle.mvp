/**
 * SpectatorViewScreen — Dedicated screen for watching single-player games
 *
 * Connects to a SpectatorRoom via Colyseus and displays the host's game
 * state in real-time. Shows score, level, lives, and the serialized game
 * state from the host.
 *
 * Route params:
 *   roomId    — Colyseus room ID of the SpectatorRoom
 *   gameType  — Game type key (for display purposes)
 *   hostName  — Display name of the host (optional)
 *
 * @see docs/SPECTATOR_SYSTEM_PLAN.md §4.4
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { SpectatorBanner } from "@/components/games/SpectatorBanner";
import { SpectatorGameRenderer } from "@/components/games/spectator-renderers";
import { useSpectator } from "@/hooks/useSpectator";
import { GAME_METADATA, type ExtendedGameType } from "@/types/games";
import { BorderRadius, Spacing } from "@/constants/theme";

// =============================================================================
// Component
// =============================================================================

export default function SpectatorViewScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { roomId, gameType, hostName: routeHostName } = route.params ?? {};

  const {
    connected,
    loading,
    error,
    spectatorCount,
    spectators,
    gameState,
    currentScore,
    currentLevel,
    lives,
    hostName,
    phase,
    leaveSpectator,
  } = useSpectator({
    mode: "sp-spectator",
    roomId,
  });

  const displayHostName = hostName || routeHostName || "Host";
  const gameName =
    GAME_METADATA[gameType as ExtendedGameType]?.name || gameType;

  const handleLeave = useCallback(async () => {
    await leaveSpectator();
    navigation.goBack();
  }, [leaveSpectator, navigation]);

  // ─── Loading State ────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            variant="bodyLarge"
            style={[styles.statusText, { color: theme.colors.onBackground }]}
          >
            Connecting to spectator room...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────────

  if (error && !connected) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.error}
          />
          <Text
            variant="bodyLarge"
            style={[styles.statusText, { color: theme.colors.error }]}
          >
            {error}
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

  // ─── Game Finished ────────────────────────────────────────────────────

  if (phase === "finished") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <SpectatorBanner
          spectatorCount={spectatorCount}
          onLeave={handleLeave}
          hostName={displayHostName}
        />
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="flag-checkered"
            size={64}
            color={theme.colors.primary}
          />
          <Text
            variant="headlineMedium"
            style={[styles.gameOverText, { color: theme.colors.onBackground }]}
          >
            Game Over
          </Text>
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {displayHostName} finished with {currentScore} points
          </Text>
          <Button mode="contained" onPress={handleLeave} style={styles.button}>
            Leave
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Active Spectating ────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["bottom", "left", "right"]}
    >
      <SpectatorBanner
        spectatorCount={spectatorCount}
        onLeave={handleLeave}
        hostName={displayHostName}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Game Info Header */}
        <Surface style={styles.infoCard} elevation={1}>
          <Text
            variant="titleLarge"
            style={{ color: theme.colors.onSurface, textAlign: "center" }}
          >
            {gameName}
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              textAlign: "center",
              marginTop: Spacing.xs,
            }}
          >
            Watching {displayHostName} play
          </Text>
        </Surface>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon="star"
            label="Score"
            value={currentScore.toString()}
            color={theme.colors.primary}
            theme={theme}
          />
          <StatCard
            icon="layers"
            label="Level"
            value={currentLevel.toString()}
            color={theme.colors.tertiary}
            theme={theme}
          />
          <StatCard
            icon="heart"
            label="Lives"
            value={lives.toString()}
            color={theme.colors.error}
            theme={theme}
          />
        </View>

        {/* Live Game View */}
        {gameState && phase !== "waiting" && (
          <View style={styles.gameRendererContainer}>
            <SpectatorGameRenderer
              gameType={gameType}
              gameState={gameState}
              width={screenWidth - Spacing.md * 2}
              score={currentScore}
              level={currentLevel}
              lives={lives}
            />
          </View>
        )}

        {/* Spectator List */}
        {spectators.length > 0 && (
          <Surface style={styles.spectatorsCard} elevation={1}>
            <Text
              variant="titleSmall"
              style={{
                color: theme.colors.onSurface,
                marginBottom: Spacing.sm,
              }}
            >
              Watching ({spectatorCount})
            </Text>
            {spectators.map((spec, idx) => (
              <View
                key={spec.sessionId || `spectator-${idx}`}
                style={styles.spectatorRow}
              >
                <MaterialCommunityIcons
                  name="account"
                  size={16}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginLeft: 8,
                  }}
                >
                  {spec.displayName}
                </Text>
              </View>
            ))}
          </Surface>
        )}

        {/* Phase indicator */}
        {phase === "waiting" && (
          <View style={styles.centered}>
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
              style={{ marginTop: Spacing.lg }}
            />
            <Text
              variant="bodyMedium"
              style={[
                styles.statusText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Waiting for {displayHostName} to start...
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

function StatCard({
  icon,
  label,
  value,
  color,
  theme,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  theme: any;
}) {
  return (
    <Surface style={styles.statCard} elevation={1}>
      <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={24} color={color} />
      <Text
        variant="headlineSmall"
        style={{ color: theme.colors.onSurface, fontWeight: "700" }}
      >
        {value}
      </Text>
      <Text
        variant="labelSmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {label}
      </Text>
    </Surface>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  statusText: {
    marginTop: Spacing.md,
    textAlign: "center",
  },
  button: {
    marginTop: Spacing.lg,
    minWidth: 120,
  },
  gameOverText: {
    fontWeight: "700",
    marginTop: Spacing.md,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  gameRendererContainer: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  spectatorsCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  spectatorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
});
