/**
 * ScorecardBubble - Renders a scorecard message in chat
 */

import { formatScore, getGameDisplayName, getGameIcon } from "@/services/games";
import { GameType } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useColors } from "@/store/ThemeContext";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/ScorecardBubble");
// =============================================================================
// Types
// =============================================================================

interface ScorecardData {
  gameId: GameType;
  score: number;
  playerName: string;
}

interface ScorecardBubbleProps {
  scorecard: ScorecardData;
  isMine: boolean;
}

// =============================================================================
// Component
// =============================================================================

export default memo(function ScorecardBubble({
  scorecard,
  isMine,
}: ScorecardBubbleProps) {
  const theme = useTheme();
  const colors = useColors();
  const { gameId, score, playerName } = scorecard;
  const iconName = getGameIcon(
    gameId,
  ) as keyof typeof MaterialCommunityIcons.glyphMap;
  const gameName = getGameDisplayName(gameId);
  const formattedScore = formatScore(gameId, score);

  // Determine if lower or higher is better for display
  const isBetterLower = gameId === "reaction_tap";
  const scoreEmoji = isBetterLower
    ? score < 200
      ? "🔥"
      : score < 300
        ? "⚡"
        : "👍"
    : score > 100
      ? "🔥"
      : score > 50
        ? "⚡"
        : "👍";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surfaceVariant },
        isMine
          ? [styles.mine, { borderColor: colors.primary }]
          : [styles.theirs, { borderColor: colors.border }],
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${theme.colors.primary}20` },
          ]}
        >
          <MaterialCommunityIcons
            name={iconName}
            size={24}
            color={theme.colors.primary}
          />
        </View>
        <Text style={[styles.gameName, { color: theme.colors.primary }]}>
          {gameName}
        </Text>
      </View>

      {/* Score */}
      <View style={styles.scoreContainer}>
        <Text style={[styles.scoreValue, { color: colors.text }]}>
          {formattedScore}
        </Text>
        <Text style={styles.scoreEmoji}>{scoreEmoji}</Text>
      </View>

      {/* Player */}
      <Text style={[styles.playerName, { color: colors.textMuted }]}>
        {isMine ? "My Score" : `${playerName}'s Score`}
      </Text>

      {/* Challenge text */}
      <View
        style={[styles.challengeContainer, { borderTopColor: colors.border }]}
      >
        <MaterialCommunityIcons
          name="gamepad-variant"
          size={14}
          color={colors.textMuted}
        />
        <Text style={[styles.challengeText, { color: colors.textMuted }]}>
          {isMine ? "Can you beat this?" : "Challenge accepted?"}
        </Text>
      </View>
    </View>
  );
});

/**
 * Parse scorecard content from message
 * Returns null if parsing fails
 */
export function parseScorecardContent(content: string): ScorecardData | null {
  try {
    const data = JSON.parse(content);
    if (
      data &&
      data.gameId &&
      typeof data.score === "number" &&
      data.playerName
    ) {
      return {
        gameId: data.gameId as GameType,
        score: data.score,
        playerName: data.playerName,
      };
    }
    return null;
  } catch (error) {
    logger.error("[ScorecardBubble] Failed to parse scorecard:", error);
    return null;
  }
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    minWidth: 180,
    maxWidth: 260,
  },
  mine: {
    borderWidth: 1,
  },
  theirs: {
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 252, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  gameName: {
    fontSize: 14,
    fontWeight: "600",
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: "bold",
  },
  scoreEmoji: {
    fontSize: 24,
    marginLeft: 8,
  },
  playerName: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12,
  },
  challengeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  challengeText: {
    fontSize: 12,
    marginLeft: 6,
    fontStyle: "italic",
  },
});
