/**
 * MiniGameItem Component
 *
 * A compact game item for the ActiveGamesMini section.
 * Shows game icon, game type, opponent name, and navigation indicator.
 *
 * Layout:
 * [🎮] Game vs Opponent    [>]
 *
 * Visual Specs (per Phase 6 plan):
 * - Item height: 36px
 * - Game icon: 20px emoji
 * - Game text: 13px
 * - Opponent name: 11px, truncated
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 6
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import { AnyMatch, TurnBasedGameType } from "@/types/turnBased";
import { PLAY_SCREEN_TOKENS } from "../../../../constants/gamesTheme";

// =============================================================================
// Types
// =============================================================================

export interface MiniGameItemProps {
  /** The game match data */
  game: AnyMatch;
  /** Current user's ID */
  currentUserId: string;
  /** Called when the item is pressed */
  onPress: () => void;
  /** Optional test ID for testing */
  testID?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getGameInfo(gameType: TurnBasedGameType) {
  const metadata = GAME_METADATA[gameType as ExtendedGameType];
  if (metadata) {
    return {
      name: metadata.shortName || metadata.name,
      icon: metadata.icon,
    };
  }

  return {
    name: gameType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    icon: "🎮",
  };
}

function getOpponentName(game: AnyMatch, currentUserId: string): string {
  const isPlayer1 = game.players.player1.userId === currentUserId;
  const opponent = isPlayer1 ? game.players.player2 : game.players.player1;
  return opponent.displayName || "Opponent";
}

function truncateName(name: string, maxLength: number = 12): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 1) + "…";
}

// =============================================================================
// Component
// =============================================================================

export function MiniGameItem({
  game,
  currentUserId,
  onPress,
  testID,
}: MiniGameItemProps) {
  const { colors, isDark } = useAppTheme();
  const scale = useSharedValue(1);

  const gameInfo = getGameInfo(game.gameType);
  const opponentName = truncateName(getOpponentName(game, currentUserId));

  // Animation style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Press handlers
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, {
      damping: 15,
      stiffness: 300,
    });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        testID={testID}
        style={[
          styles.container,
          {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.03)",
          },
        ]}
      >
        {/* Game Icon */}
        <Text style={styles.gameIcon}>{gameInfo.icon}</Text>

        {/* Game Info */}
        <View style={styles.gameInfo}>
          <Text
            style={[styles.gameName, { color: colors.text }]}
            numberOfLines={1}
          >
            {gameInfo.name}
          </Text>
          <Text
            style={[styles.opponentName, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            vs {opponentName}
          </Text>
        </View>

        {/* Chevron */}
        <MaterialCommunityIcons
          name="chevron-right"
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    paddingHorizontal: 8,
    borderRadius: PLAY_SCREEN_TOKENS.borderRadius.button,
    marginBottom: 4,
  },
  gameIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  gameInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  gameName: {
    fontSize: 13,
    fontWeight: "600",
  },
  opponentName: {
    fontSize: 11,
    flexShrink: 1,
  },
});
