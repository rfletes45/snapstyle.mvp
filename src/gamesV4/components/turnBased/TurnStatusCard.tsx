/**
 * TurnStatusCard — Shared status header for turn-based games
 *
 * Displays:
 * - Two PlayerChips (local and opponent)
 * - Active turn emphasis
 * - Contextual status message (your turn, waiting, game over, etc.)
 * - Subtle background surface that integrates with the game screen
 *
 * Designed for mobile-first play — concise and readable at a glance.
 */

import { Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { PlayerChip, type PlayerChipProps } from "./PlayerChip";

export interface TurnStatusCardProps {
  /** Status message, e.g. "Your turn — place X" */
  statusText: string;
  /** Optional secondary line, e.g. "Tap an empty cell" */
  subtitle?: string;
  /** Player chip config for local player */
  localPlayer: PlayerChipProps;
  /** Player chip config for opponent */
  opponentPlayer: PlayerChipProps;
  /** Whether local player has the active turn */
  isLocalTurn: boolean;
  /** Whether the game has ended */
  isTerminal: boolean;
  /** Optional status accent color override (green for win, red for loss, etc.) */
  statusColor?: string;
}

export function TurnStatusCard({
  statusText,
  subtitle,
  localPlayer,
  opponentPlayer,
  isLocalTurn,
  isTerminal,
  statusColor,
}: TurnStatusCardProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;

  const cardBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)";
  const statusTextColor = statusColor
    ? statusColor
    : isTerminal
      ? isDark
        ? "#CCC"
        : "#555"
      : isLocalTurn
        ? theme.colors.primary
        : isDark
          ? "rgba(255,255,255,0.5)"
          : "rgba(0,0,0,0.45)";

  // Fixed positions: local always left, opponent always right.
  // Active/inactive styling on the chips already indicates whose turn it is;
  // swapping their positions caused distracting layout jumps.
  const leftChip = localPlayer;
  const rightChip = opponentPlayer;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.card, { backgroundColor: cardBg }]}
    >
      {/* Player chips row */}
      <View style={styles.chipsRow}>
        <PlayerChip {...leftChip} />
        <Text style={[styles.vs, { color: isDark ? "#555" : "#CCC" }]}>vs</Text>
        <PlayerChip {...rightChip} />
      </View>

      {/* Status line */}
      <Text style={[styles.statusText, { color: statusTextColor }]}>
        {statusText}
      </Text>

      {/* Subtitle — always rendered to reserve height and prevent layout shift.
          Uses transparent color when empty so the row occupies the same space. */}
      <Text
        style={[
          styles.subtitle,
          {
            color: subtitle
              ? isDark
                ? "rgba(255,255,255,0.35)"
                : "rgba(0,0,0,0.35)"
              : "transparent",
          },
        ]}
      >
        {subtitle || " "}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 16,
    gap: 8,
    alignItems: "center",
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  vs: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
});
