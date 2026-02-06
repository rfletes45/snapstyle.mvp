/**
 * PlayerBar Component
 *
 * Displays player information during multiplayer games including:
 * - Avatar and display name
 * - Rating/rank
 * - Turn indicator
 * - Time remaining (for timed games)
 * - Captured pieces (for chess/checkers)
 *
 * @see constants/gamesTheme.ts for color tokens
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, ViewStyle, useColorScheme } from "react-native";
import { Avatar, Text, useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { formatDurationSeconds as formatTime } from "@/utils/time";
import {
  GAME_BORDER_RADIUS,
  GAME_SHADOWS,
  GAME_SPACING,
  GAME_TYPOGRAPHY,
  getTurnStatusColors,
} from "../../../constants/gamesTheme";

// =============================================================================
// Types
// =============================================================================

export interface PlayerInfo {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  rating?: number;
  color?: "white" | "black" | "red" | "none";
}

export interface PlayerBarProps {
  /** Player information */
  player: PlayerInfo;
  /** Position on screen */
  side: "top" | "bottom";
  /** Whether it's this player's turn */
  isCurrentTurn: boolean;
  /** Time remaining in seconds (for timed games) */
  timeRemaining?: number;
  /** Captured pieces (for display, e.g., chess) */
  capturedPieces?: string[];
  /** Material advantage (point difference) */
  materialAdvantage?: number;
  /** Whether this is the local user */
  isLocalPlayer?: boolean;
  /** Show online status indicator */
  showOnlineStatus?: boolean;
  /** Whether player is online */
  isOnline?: boolean;
  /** Custom style */
  style?: ViewStyle;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getPlayerColor(color?: PlayerInfo["color"]): string | null {
  switch (color) {
    case "white":
      return "⚪";
    case "black":
      return "⚫";
    case "red":
      return "🔴";
    default:
      return null;
  }
}

// =============================================================================
// Pulsing Turn Indicator
// =============================================================================

function TurnIndicator({ isActive }: { isActive: boolean }) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const statusColors = getTurnStatusColors(true, isDarkMode);

  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    if (isActive) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 600 }),
          withTiming(1, { duration: 600 }),
        ),
        -1,
        true,
      );
    } else {
      pulseScale.value = withSpring(1);
    }
  }, [isActive, pulseScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  if (!isActive) return null;

  return (
    <View style={styles.turnIndicatorContainer}>
      <Animated.View
        style={[
          styles.turnDot,
          { backgroundColor: statusColors.dot },
          animatedStyle,
        ]}
      />
      <Text style={[styles.turnText, { color: statusColors.text }]}>
        YOUR TURN
      </Text>
    </View>
  );
}

// =============================================================================
// Timer Component
// =============================================================================

function Timer({
  seconds,
  isActive,
  isLow,
}: {
  seconds: number;
  isActive: boolean;
  isLow: boolean;
}) {
  const theme = useTheme();

  const textColor = isLow
    ? "#F44336"
    : isActive
      ? theme.colors.onSurface
      : theme.colors.onSurfaceVariant;

  return (
    <View
      style={[
        styles.timerContainer,
        isActive && styles.timerActive,
        isLow && styles.timerLow,
      ]}
    >
      <MaterialCommunityIcons
        name="clock-outline"
        size={16}
        color={textColor}
      />
      <Text style={[styles.timerText, { color: textColor }]}>
        {formatTime(seconds)}
      </Text>
    </View>
  );
}

// =============================================================================
// Captured Pieces Display
// =============================================================================

function CapturedPieces({
  pieces,
  advantage,
}: {
  pieces: string[];
  advantage?: number;
}) {
  const theme = useTheme();

  if (pieces.length === 0) return null;

  return (
    <View style={styles.capturedContainer}>
      <Text style={styles.capturedPieces}>{pieces.join("")}</Text>
      {advantage !== undefined && advantage > 0 && (
        <Text style={[styles.advantageText, { color: theme.colors.primary }]}>
          +{advantage}
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function PlayerBar({
  player,
  side,
  isCurrentTurn,
  timeRemaining,
  capturedPieces = [],
  materialAdvantage,
  isLocalPlayer = false,
  showOnlineStatus = false,
  isOnline = false,
  style,
}: PlayerBarProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";

  const statusColors = getTurnStatusColors(
    isCurrentTurn && isLocalPlayer,
    isDarkMode,
  );

  const isTimeLow = timeRemaining !== undefined && timeRemaining < 30;
  const playerColorEmoji = getPlayerColor(player.color);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isCurrentTurn
            ? statusColors.bg
            : theme.colors.surface,
        },
        side === "top" ? styles.containerTop : styles.containerBottom,
        GAME_SHADOWS.sm,
        style,
      ]}
    >
      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrapper}>
          {player.avatarUrl ? (
            <Avatar.Image size={40} source={{ uri: player.avatarUrl }} />
          ) : (
            <Avatar.Text
              size={40}
              label={player.displayName.slice(0, 2).toUpperCase()}
            />
          )}

          {/* Online Status Indicator */}
          {showOnlineStatus && (
            <View
              style={[
                styles.onlineIndicator,
                { backgroundColor: isOnline ? "#4CAF50" : "#9E9E9E" },
              ]}
            />
          )}
        </View>

        <View style={styles.playerInfo}>
          {/* Name Row */}
          <View style={styles.nameRow}>
            <Text
              style={[styles.playerName, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {isLocalPlayer ? "You" : player.displayName}
            </Text>
            {playerColorEmoji && (
              <Text style={styles.colorEmoji}>{playerColorEmoji}</Text>
            )}
          </View>

          {/* Rating */}
          {player.rating !== undefined && (
            <Text
              style={[styles.rating, { color: theme.colors.onSurfaceVariant }]}
            >
              Rating: {player.rating}
            </Text>
          )}
        </View>
      </View>

      {/* Center Section - Turn Indicator or Captured Pieces */}
      <View style={styles.centerSection}>
        {isCurrentTurn && isLocalPlayer && <TurnIndicator isActive />}
        {!isCurrentTurn && capturedPieces.length > 0 && (
          <CapturedPieces
            pieces={capturedPieces}
            advantage={materialAdvantage}
          />
        )}
      </View>

      {/* Right Section - Timer */}
      {timeRemaining !== undefined && (
        <Timer
          seconds={timeRemaining}
          isActive={isCurrentTurn}
          isLow={isTimeLow}
        />
      )}

      {/* Status Badge for opponent */}
      {!isLocalPlayer && isCurrentTurn && (
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isDarkMode
                ? "rgba(255, 152, 0, 0.2)"
                : "rgba(255, 152, 0, 0.15)",
            },
          ]}
        >
          <Text style={styles.statusBadgeText}>THINKING...</Text>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Compact Player Bar (for smaller screens)
// =============================================================================

export interface CompactPlayerBarProps {
  player: PlayerInfo;
  isCurrentTurn: boolean;
  isLocalPlayer?: boolean;
  timeRemaining?: number;
}

export function CompactPlayerBar({
  player,
  isCurrentTurn,
  isLocalPlayer = false,
  timeRemaining,
}: CompactPlayerBarProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";

  const statusColors = getTurnStatusColors(
    isCurrentTurn && isLocalPlayer,
    isDarkMode,
  );
  const playerColorEmoji = getPlayerColor(player.color);

  return (
    <View
      style={[
        styles.compactContainer,
        {
          backgroundColor: isCurrentTurn
            ? statusColors.bg
            : theme.colors.surface,
          borderColor: isCurrentTurn
            ? statusColors.dot
            : theme.colors.outlineVariant,
        },
      ]}
    >
      {/* Turn Dot */}
      {isCurrentTurn && (
        <View
          style={[styles.compactTurnDot, { backgroundColor: statusColors.dot }]}
        />
      )}

      {/* Avatar */}
      {player.avatarUrl ? (
        <Avatar.Image size={28} source={{ uri: player.avatarUrl }} />
      ) : (
        <Avatar.Text
          size={28}
          label={player.displayName.slice(0, 1).toUpperCase()}
        />
      )}

      {/* Name */}
      <Text
        style={[styles.compactName, { color: theme.colors.onSurface }]}
        numberOfLines={1}
      >
        {isLocalPlayer ? "You" : player.displayName}
      </Text>

      {/* Color */}
      {playerColorEmoji && (
        <Text style={styles.compactColor}>{playerColorEmoji}</Text>
      )}

      {/* Timer */}
      {timeRemaining !== undefined && (
        <Text
          style={[
            styles.compactTimer,
            {
              color:
                timeRemaining < 30 ? "#F44336" : theme.colors.onSurfaceVariant,
            },
          ]}
        >
          {formatTime(timeRemaining)}
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: GAME_SPACING.md,
    paddingVertical: GAME_SPACING.sm,
    borderRadius: GAME_BORDER_RADIUS.md,
  },
  containerTop: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  containerBottom: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarWrapper: {
    position: "relative",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  playerInfo: {
    marginLeft: GAME_SPACING.sm,
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.xs,
  },
  playerName: {
    fontSize: 16,
    fontWeight: "600",
    maxWidth: 120,
  },
  colorEmoji: {
    fontSize: 14,
  },
  rating: {
    fontSize: 12,
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  turnIndicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.xs,
  },
  turnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  turnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  capturedContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.xs,
  },
  capturedPieces: {
    fontSize: 14,
    letterSpacing: -1,
  },
  advantageText: {
    fontSize: 12,
    fontWeight: "600",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: GAME_SPACING.sm,
    paddingVertical: 4,
    borderRadius: GAME_BORDER_RADIUS.sm,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  timerActive: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
  },
  timerLow: {
    backgroundColor: "rgba(244, 67, 54, 0.15)",
  },
  timerText: {
    ...GAME_TYPOGRAPHY.timer,
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: GAME_SPACING.sm,
    paddingVertical: 4,
    borderRadius: GAME_BORDER_RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FF9800",
  },

  // Compact styles
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: GAME_SPACING.sm,
    paddingVertical: GAME_SPACING.xs,
    borderRadius: GAME_BORDER_RADIUS.md,
    borderWidth: 1,
    gap: GAME_SPACING.xs,
  },
  compactTurnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactName: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    maxWidth: 80,
  },
  compactColor: {
    fontSize: 12,
  },
  compactTimer: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "monospace",
  },
});

export default PlayerBar;
