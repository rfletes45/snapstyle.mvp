/**
 * GameRecommendations Component
 *
 * Displays personalized game recommendations based on play history.
 * Uses rule-based recommendations (AI-based in future).
 *
 * Layout (per Phase 7 plan):
 * ┌───────────────────────────────────────────────────────────┐
 * │ 💡 Recommended for You                                    │
 * │ ┌────────────┐ ┌────────────┐ ┌────────────┐             │
 * │ │   🎯       │ │   🧩       │ │   🎲       │             │
 * │ │  Try Chess │ │   2048     │ │ Checkers   │             │
 * │ │ Based on...│ │ Popular... │ │ Friends... │             │
 * │ └────────────┘ └────────────┘ └────────────┘             │
 * └───────────────────────────────────────────────────────────┘
 *
 * Visual Specs:
 * - Horizontal carousel of recommended games
 * - Shows reason for recommendation
 * - Rule-based engine (can be AI later)
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 7
 */

import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType, GAME_METADATA, GameMetadata } from "@/types/games";
import { PLAY_SCREEN_TOKENS } from "../../../../constants/gamesTheme";

// =============================================================================
// Types
// =============================================================================

export interface GameRecommendationsProps {
  /** Called when a game is tapped */
  onGamePress: (gameType: ExtendedGameType) => void;
  /** Optional test ID for testing */
  testID?: string;
}

interface GameRecommendation {
  gameType: ExtendedGameType;
  metadata: GameMetadata;
  reason: string;
  reasonEmoji: string;
  priority: number; // Higher = more relevant
}

type RecommendationReason =
  | "friends_playing"
  | "popular"
  | "new_game"
  | "try_something_new"
  | "based_on_history"
  | "comeback";

// =============================================================================
// Constants
// =============================================================================

const CARD_WIDTH = 140;
const CARD_HEIGHT = 120;
const MAX_RECOMMENDATIONS = 6;

/** Reason labels and emojis */
const REASON_DISPLAY: Record<
  RecommendationReason,
  { emoji: string; label: string }
> = {
  friends_playing: { emoji: "👥", label: "Friends are playing" },
  popular: { emoji: "🔥", label: "Trending now" },
  new_game: { emoji: "✨", label: "New game!" },
  try_something_new: { emoji: "🎯", label: "Try something new" },
  based_on_history: { emoji: "📊", label: "Based on your play" },
  comeback: { emoji: "🔄", label: "Come back & play" },
};

// =============================================================================
// RecommendationCard Component
// =============================================================================

interface RecommendationCardProps {
  recommendation: GameRecommendation;
  onPress: () => void;
}

function RecommendationCard({
  recommendation,
  onPress,
}: RecommendationCardProps) {
  const { colors, isDark } = useAppTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const { metadata, reason, reasonEmoji } = recommendation;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : "transparent",
            ...PLAY_SCREEN_TOKENS.shadows.card,
          },
        ]}
      >
        {/* Game Icon */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <Text style={styles.gameIcon}>{metadata.icon}</Text>
        </View>

        {/* Game Name */}
        <Text
          style={[styles.gameName, { color: colors.text }]}
          numberOfLines={1}
        >
          {metadata.name}
        </Text>

        {/* Recommendation Reason */}
        <View style={styles.reasonContainer}>
          <Text style={styles.reasonEmoji}>{reasonEmoji}</Text>
          <Text
            style={[styles.reasonText, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {reason}
          </Text>
        </View>

        {/* Play Button */}
        <View style={[styles.playButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.playButtonText}>Play</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// GameRecommendations Component
// =============================================================================

export function GameRecommendations({
  onGamePress,
  testID,
}: GameRecommendationsProps) {
  const { colors, isDark } = useAppTheme();
  const { currentFirebaseUser } = useAuth();

  const [recommendations, setRecommendations] = useState<GameRecommendation[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  // Generate recommendations based on rules
  useEffect(() => {
    const generateRecommendations = async () => {
      try {
        const recs: GameRecommendation[] = [];

        // Get all available games
        const availableGames = Object.values(GAME_METADATA).filter(
          (g) => g.isAvailable && !g.comingSoon,
        );

        // Rule 1: New games get priority
        const newGames = availableGames.filter((g) => g.isNew);
        newGames.forEach((game) => {
          recs.push({
            gameType: game.id,
            metadata: game,
            reason: REASON_DISPLAY.new_game.label,
            reasonEmoji: REASON_DISPLAY.new_game.emoji,
            priority: 100,
          });
        });

        // Rule 2: Multiplayer games for engagement
        const multiplayerGames = availableGames.filter(
          (g) => g.isMultiplayer && !newGames.includes(g),
        );
        multiplayerGames.slice(0, 2).forEach((game) => {
          recs.push({
            gameType: game.id,
            metadata: game,
            reason: REASON_DISPLAY.friends_playing.label,
            reasonEmoji: REASON_DISPLAY.friends_playing.emoji,
            priority: 80,
          });
        });

        // Rule 3: Popular games (trending)
        const popularGames = availableGames.filter(
          (g) =>
            ["flappy_bird", "play_2048", "word_master"].includes(g.id) &&
            !newGames.includes(g),
        );
        popularGames.forEach((game) => {
          if (!recs.find((r) => r.gameType === game.id)) {
            recs.push({
              gameType: game.id,
              metadata: game,
              reason: REASON_DISPLAY.popular.label,
              reasonEmoji: REASON_DISPLAY.popular.emoji,
              priority: 60,
            });
          }
        });

        // Rule 4: Try something new (random from less played categories)
        const puzzleGames = availableGames.filter(
          (g) =>
            g.category === "puzzle" && !recs.find((r) => r.gameType === g.id),
        );
        if (puzzleGames.length > 0) {
          const randomPuzzle =
            puzzleGames[Math.floor(Math.random() * puzzleGames.length)];
          recs.push({
            gameType: randomPuzzle.id,
            metadata: randomPuzzle,
            reason: REASON_DISPLAY.try_something_new.label,
            reasonEmoji: REASON_DISPLAY.try_something_new.emoji,
            priority: 40,
          });
        }

        // Sort by priority and limit
        recs.sort((a, b) => b.priority - a.priority);
        setRecommendations(recs.slice(0, MAX_RECOMMENDATIONS));
      } catch (error) {
        console.error("[GameRecommendations] Error generating:", error);
      } finally {
        setLoading(false);
      }
    };

    generateRecommendations();
  }, [currentFirebaseUser?.uid]);

  const handleGamePress = useCallback(
    (gameType: ExtendedGameType) => {
      onGamePress(gameType);
    },
    [onGamePress],
  );

  const renderItem = useCallback(
    ({ item }: { item: GameRecommendation }) => (
      <RecommendationCard
        recommendation={item}
        onPress={() => handleGamePress(item.gameType)}
      />
    ),
    [handleGamePress],
  );

  const keyExtractor = useCallback(
    (item: GameRecommendation) => item.gameType,
    [],
  );

  // Don't show during initial load or if no recommendations
  if (loading || recommendations.length === 0) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300).delay(150)}
      style={styles.container}
      testID={testID}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>💡</Text>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Recommended for You
        </Text>
      </View>

      {/* Recommendations Carousel */}
      <FlatList
        data={recommendations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
      />
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: PLAY_SCREEN_TOKENS.spacing.sectionGap,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: PLAY_SCREEN_TOKENS.spacing.horizontalPadding,
    marginBottom: 12,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: PLAY_SCREEN_TOKENS.spacing.horizontalPadding,
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: PLAY_SCREEN_TOKENS.borderRadius.cardLarge,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  gameIcon: {
    fontSize: 20,
  },
  gameName: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  reasonContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reasonEmoji: {
    fontSize: 10,
  },
  reasonText: {
    fontSize: 10,
    maxWidth: 100,
  },
  playButton: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  playButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
