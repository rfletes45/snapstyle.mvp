/**
 * SpectatorBanner Component
 *
 * Displays a banner at the top of game screens when in spectator mode.
 * Shows spectator count and provides a leave button.
 *
 * @example
 * <SpectatorBanner
 *   isSpectator={isSpectator}
 *   spectatorCount={spectatorCount}
 *   onLeave={leaveSpectatorMode}
 *   playerNames={["Alice", "Bob"]}
 * />
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, { SlideInUp, SlideOutUp } from "react-native-reanimated";

import { BorderRadius, Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface SpectatorBannerProps {
  /** Whether spectator mode is active */
  isSpectator: boolean;
  /** Number of spectators watching (including current user) */
  spectatorCount: number;
  /** Callback when leave button is pressed */
  onLeave: () => void;
  /** Names of the players in the game */
  playerNames?: [string, string];
  /** Whether the leave action is loading */
  loading?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function SpectatorBanner({
  isSpectator,
  spectatorCount,
  onLeave,
  playerNames,
  loading = false,
}: SpectatorBannerProps) {
  const theme = useTheme();

  if (!isSpectator) {
    return null;
  }

  const playersText =
    playerNames && playerNames.length === 2
      ? `${playerNames[0]} vs ${playerNames[1]}`
      : "Game in progress";

  return (
    <Animated.View
      entering={SlideInUp.duration(300)}
      exiting={SlideOutUp.duration(200)}
      style={[styles.container, { backgroundColor: theme.colors.primary }]}
    >
      <View style={styles.content}>
        {/* Eye icon and watching text */}
        <View style={styles.leftSection}>
          <MaterialCommunityIcons
            name="eye-outline"
            size={20}
            color={theme.colors.onPrimary}
          />
          <View style={styles.textContainer}>
            <Text
              style={[styles.watchingText, { color: theme.colors.onPrimary }]}
            >
              Watching
            </Text>
            <Text
              style={[styles.playersText, { color: theme.colors.onPrimary }]}
              numberOfLines={1}
            >
              {playersText}
            </Text>
          </View>
        </View>

        {/* Spectator count */}
        <View style={styles.centerSection}>
          <View
            style={[
              styles.countBadge,
              { backgroundColor: "rgba(255,255,255,0.2)" },
            ]}
          >
            <MaterialCommunityIcons
              name="account-group-outline"
              size={14}
              color={theme.colors.onPrimary}
            />
            <Text style={[styles.countText, { color: theme.colors.onPrimary }]}>
              {spectatorCount}
            </Text>
          </View>
        </View>

        {/* Leave button */}
        <TouchableOpacity
          style={[
            styles.leaveButton,
            { backgroundColor: "rgba(255,255,255,0.2)" },
          ]}
          onPress={onLeave}
          disabled={loading}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="exit-to-app"
            size={16}
            color={theme.colors.onPrimary}
          />
          <Text style={[styles.leaveText, { color: theme.colors.onPrimary }]}>
            Leave
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  watchingText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  playersText: {
    fontSize: 14,
    fontWeight: "500",
    opacity: 0.9,
  },
  centerSection: {
    paddingHorizontal: Spacing.sm,
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  countText: {
    fontSize: 12,
    fontWeight: "600",
  },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  leaveText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

export default SpectatorBanner;
