/**
 * SpectatorInviteBubble - Renders a spectator invite message in chat
 *
 * Displayed similarly to ScorecardBubble but with a "Watch Live" theme
 * instead of a score challenge. Shows the game being played, the host's
 * name, and a call-to-action to watch the game live.
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useColors } from "@/store/ThemeContext";

// =============================================================================
// Types
// =============================================================================

export interface SpectatorInviteContent {
  gameId: string;
  type: "spectator_invite";
  roomId: string;
  hostName: string;
  score: number;
  playerName: string;
  inviteMode?: "spectate" | "boost" | "expedition";
  boostSessionEndsAt?: number;
  /** Set to true when the game has ended */
  finished?: boolean;
  /** The host's final score when the game ended */
  finalScore?: number;
  /** Display-friendly game name */
  gameName?: string;
}

interface SpectatorInviteBubbleProps {
  invite: SpectatorInviteContent;
  isMine: boolean;
  /** Called when the user taps the invite bubble */
  onPress?: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

/** Map game type keys to display-friendly names */
function getSpectatorGameName(gameId: string): string {
  const names: Record<string, string> = {
    bounce_blitz: "Bounce Blitz",
    bounce_blitz_game: "Bounce Blitz",
    clicker_mine: "Clicker Mine",
    helix_drop: "Helix Drop",
    play_2048: "2048",
    play_2048_game: "2048",
    snake_master: "Snake Master",
    snake_master_game: "Snake Master",
    memory_master: "Memory Master",
    memory_master_game: "Memory Master",
    word_master: "Word Master",
    word_master_game: "Word Master",
    reaction_tap: "Reaction Tap",
    reaction_tap_game: "Reaction Tap",
    timed_tap: "Speed Tap",
    timed_tap_game: "Speed Tap",
    brick_breaker: "Brick Breaker",
    brick_breaker_game: "Brick Breaker",
    tile_slide: "Tile Slide",
    tile_slide_game: "Tile Slide",
    minesweeper_classic: "Minesweeper",
    minesweeper_game: "Minesweeper",
    number_master: "Number Master",
    number_master_game: "Number Master",
    lights_out: "Lights Out",
    lights_out_game: "Lights Out",
    pong_game: "Pong",
  };
  return names[gameId] || gameId;
}

/** Map game type keys to MaterialCommunityIcons icon names */
function getSpectatorGameIcon(gameId: string): string {
  const icons: Record<string, string> = {
    bounce_blitz: "basketball",
    bounce_blitz_game: "basketball",
    clicker_mine: "pickaxe",
    helix_drop: "blur-radial",
    play_2048: "numeric",
    play_2048_game: "numeric",
    snake_master: "snake",
    snake_master_game: "snake",
    memory_master: "cards",
    memory_master_game: "cards",
    word_master: "alphabetical-variant",
    word_master_game: "alphabetical-variant",
    reaction_tap: "lightning-bolt",
    reaction_tap_game: "lightning-bolt",
    timed_tap: "timer-outline",
    timed_tap_game: "timer-outline",
    brick_breaker: "wall",
    brick_breaker_game: "wall",
    tile_slide: "puzzle",
    tile_slide_game: "puzzle",
    minesweeper_classic: "mine",
    minesweeper_game: "mine",
    number_master: "calculator",
    number_master_game: "calculator",
    lights_out: "lightbulb-outline",
    lights_out_game: "lightbulb-outline",
    pong_game: "table-tennis",
  };
  return icons[gameId] || "gamepad-variant";
}

// =============================================================================
// Component
// =============================================================================

export default memo(function SpectatorInviteBubble({
  invite,
  isMine,
  onPress,
}: SpectatorInviteBubbleProps) {
  const theme = useTheme();
  const colors = useColors();
  const { gameId, hostName, finished, finalScore, inviteMode } = invite;
  const iconName = getSpectatorGameIcon(
    gameId,
  ) as keyof typeof MaterialCommunityIcons.glyphMap;
  const gameName = invite.gameName || getSpectatorGameName(gameId);

  // When the game is finished, don't allow navigation
  const isFinished = !!finished;
  const Wrapper = !isFinished && onPress ? TouchableOpacity : View;
  const wrapperProps =
    !isFinished && onPress ? { activeOpacity: 0.7, onPress } : {};

  return (
    <Wrapper
      {...wrapperProps}
      style={[
        styles.container,
        { backgroundColor: colors.surfaceVariant },
        isMine
          ? [
              styles.mine,
              {
                borderColor: isFinished
                  ? colors.textMuted
                  : theme.colors.tertiary || colors.primary,
              },
            ]
          : [styles.theirs, { borderColor: colors.border }],
      ]}
    >
      {/* Badge — LIVE or ENDED */}
      {isFinished ? (
        <View style={[styles.liveBadge, { backgroundColor: colors.textMuted }]}>
          <MaterialCommunityIcons
            name="flag-checkered"
            size={12}
            color="#FFFFFF"
          />
          <Text style={styles.liveBadgeText}>ENDED</Text>
        </View>
      ) : (
        <View style={[styles.liveBadge, { backgroundColor: "#E53935" }]}>
          <MaterialCommunityIcons name="broadcast" size={12} color="#FFFFFF" />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: `${theme.colors.tertiary || theme.colors.primary}20`,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={iconName}
            size={24}
            color={theme.colors.tertiary || theme.colors.primary}
          />
        </View>
        <Text
          style={[
            styles.gameName,
            { color: theme.colors.tertiary || theme.colors.primary },
          ]}
        >
          {gameName}
        </Text>
      </View>

      {/* Center area — score result or spectator icon */}
      {isFinished ? (
        <View style={styles.resultContainer}>
          <MaterialCommunityIcons name="trophy" size={28} color="#FFB300" />
          <Text
            style={[styles.finalScoreText, { color: theme.colors.onSurface }]}
          >
            {finalScore ?? invite.score}
          </Text>
          <Text style={[styles.finalScoreLabel, { color: colors.textMuted }]}>
            Final Score
          </Text>
        </View>
      ) : (
        <View style={styles.spectatorIconContainer}>
          <MaterialCommunityIcons
            name="eye"
            size={32}
            color={theme.colors.tertiary || theme.colors.primary}
          />
        </View>
      )}

      {/* Player */}
      <Text style={[styles.playerName, { color: colors.textMuted }]}>
        {isFinished
          ? isMine
            ? "Game over!"
            : `${hostName} finished playing`
          : isMine
            ? "Watch me play!"
            : `${hostName} is playing`}
      </Text>

      {/* CTA / footer */}
      <View style={[styles.ctaContainer, { borderTopColor: colors.border }]}>
        <MaterialCommunityIcons
          name={isFinished ? "check-circle-outline" : "eye-outline"}
          size={14}
          color={
            isFinished
              ? colors.textMuted
              : theme.colors.tertiary || colors.textMuted
          }
        />
        <Text
          style={[
            styles.ctaText,
            {
              color: isFinished
                ? colors.textMuted
                : theme.colors.tertiary || colors.textMuted,
            },
          ]}
        >
          {isFinished
            ? "Game has ended"
            : isMine
              ? inviteMode === "boost"
                ? "Sent boost invite"
                : inviteMode === "expedition"
                  ? "Sent expedition invite"
                  : "Sent spectator invite"
              : inviteMode === "boost"
                ? "Tap to help mine live!"
                : inviteMode === "expedition"
                  ? "Tap to join expedition!"
                  : "Tap to watch live! 👀"}
        </Text>
      </View>
    </Wrapper>
  );
});

/**
 * Parse spectator invite content from message text.
 * Returns null if the message is not a spectator invite.
 */
export function parseSpectatorInviteContent(
  content: string,
): SpectatorInviteContent | null {
  try {
    const data = JSON.parse(content);
    if (
      data &&
      data.type === "spectator_invite" &&
      data.roomId &&
      data.gameId
    ) {
      return {
        gameId: data.gameId,
        type: "spectator_invite",
        roomId: data.roomId,
        hostName: data.hostName || "Player",
        score: data.score ?? 0,
        playerName: data.playerName || data.hostName || "Player",
        inviteMode:
          data.inviteMode === "boost"
            ? "boost"
            : data.inviteMode === "expedition"
              ? "expedition"
              : "spectate",
        boostSessionEndsAt: data.boostSessionEndsAt ?? 0,
        finished: data.finished ?? false,
        finalScore: data.finalScore,
        gameName: data.gameName,
      };
    }
    return null;
  } catch {
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
    position: "relative",
  },
  mine: {
    borderWidth: 1,
  },
  theirs: {
    borderWidth: 1,
  },
  liveBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  liveBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingRight: 50, // space for live badge
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  gameName: {
    fontSize: 14,
    fontWeight: "600",
  },
  spectatorIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  resultContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    gap: 2,
  },
  finalScoreText: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  finalScoreLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  playerName: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12,
  },
  ctaContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  ctaText: {
    fontSize: 12,
    marginLeft: 6,
    fontStyle: "italic",
  },
});

