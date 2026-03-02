/**
 * TurnSummaryCard — Post-game turn summary for turn-based games
 *
 * Renders a compact card showing per-player stats: move count, captures,
 * average turn time, and notable move highlights.
 *
 * Used on SessionGameOverScreen when `gameResultFacts.turnSummary` is present.
 *
 * @module components/games/TurnSummaryCard
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";

import type { TurnSummaryEntry } from "@/types/gameResultFacts";

// =============================================================================
// Props
// =============================================================================

interface TurnSummaryCardProps {
  /** Per-player summary entries */
  entries: TurnSummaryEntry[];
  /** Total game duration in ms (optional header stat) */
  durationMs?: number;
  /** Total turn count (optional header stat) */
  totalTurns?: number;
}

// =============================================================================
// Helpers
// =============================================================================

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatAvgTurn(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

// =============================================================================
// Component
// =============================================================================

export function TurnSummaryCard({
  entries,
  durationMs,
  totalTurns,
}: TurnSummaryCardProps) {
  const theme = useTheme();

  if (!entries || entries.length === 0) return null;

  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="clipboard-text-outline"
          size={18}
          color={theme.colors.primary}
        />
        <Text variant="titleSmall" style={styles.headerText}>
          Turn Summary
        </Text>
        {totalTurns !== undefined && (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, marginLeft: "auto" }}
          >
            {totalTurns} turns
            {durationMs ? ` · ${formatDuration(durationMs)}` : ""}
          </Text>
        )}
      </View>

      {/* Player rows */}
      {entries.map((entry) => (
        <View
          key={entry.uid}
          style={[
            styles.playerRow,
            { borderTopColor: theme.colors.outlineVariant },
          ]}
        >
          <Text
            variant="bodyMedium"
            style={styles.playerName}
            numberOfLines={1}
          >
            {entry.displayName}
          </Text>

          <View style={styles.statsRow}>
            {/* Moves */}
            <View style={styles.stat}>
              <MaterialCommunityIcons
                name="cursor-move"
                size={14}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="bodySmall" style={styles.statValue}>
                {entry.moveCount} moves
              </Text>
            </View>

            {/* Captures */}
            {entry.captures !== undefined && entry.captures > 0 && (
              <View style={styles.stat}>
                <MaterialCommunityIcons
                  name="sword-cross"
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="bodySmall" style={styles.statValue}>
                  {entry.captures} captures
                </Text>
              </View>
            )}

            {/* Avg turn time */}
            {entry.avgTurnTimeMs !== undefined && (
              <View style={styles.stat}>
                <MaterialCommunityIcons
                  name="timer-outline"
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="bodySmall" style={styles.statValue}>
                  {formatAvgTurn(entry.avgTurnTimeMs)} avg
                </Text>
              </View>
            )}
          </View>

          {/* Highlights */}
          {entry.highlights && entry.highlights.length > 0 && (
            <View style={styles.highlights}>
              {entry.highlights.slice(0, 3).map((h, i) => (
                <Text
                  key={i}
                  variant="labelSmall"
                  style={{ color: theme.colors.primary }}
                >
                  ★ {h}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
    </Surface>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginVertical: 8,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  headerText: {
    fontWeight: "600",
  },
  playerRow: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  playerName: {
    fontWeight: "600",
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    opacity: 0.7,
  },
  highlights: {
    marginTop: 6,
    gap: 2,
  },
});

export default TurnSummaryCard;
