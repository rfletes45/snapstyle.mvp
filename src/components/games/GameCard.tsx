/**
 * GameCard Component
 *
 * Enhanced game card with category colors, stats display,
 * and visual polish for the Games Hub.
 *
 * Features:
 * - Category-based color accents
 * - Personal best display with trophy
 * - Leaderboard rank display
 * - Rating display for multiplayer games
 * - Win/Loss record
 * - "NEW" and "Coming Soon" badges
 * - Animated press states
 *
 * @see constants/gamesTheme.ts for color tokens
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
  useColorScheme,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ExtendedGameType, GAME_METADATA, GameCategory } from "@/types/games";
import {
  GAME_ANIMATIONS,
  GAME_BORDER_RADIUS,
  GAME_CATEGORY_COLORS,
  GAME_SHADOWS,
  GAME_SPACING,
  GAME_TYPOGRAPHY,
  getCategoryColor,
} from "../../../constants/gamesTheme";

// =============================================================================
// Types
// =============================================================================

export interface GameCardProps {
  /** Game type identifier */
  gameType: ExtendedGameType;
  /** Personal best score (formatted string or null) */
  personalBest?: string | null;
  /** Leaderboard rank position */
  leaderboardRank?: number | null;
  /** ELO rating for multiplayer games */
  rating?: number | null;
  /** Number of wins */
  wins?: number;
  /** Number of losses */
  losses?: number;
  /** Show as new game */
  isNew?: boolean;
  /** Show as locked/coming soon */
  isLocked?: boolean;
  /** Callback when card is pressed */
  onPress: () => void;
  /** Card style variant */
  variant?: "default" | "compact" | "large";
  /** Additional style */
  style?: ViewStyle;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getCategoryFromGameType(gameType: ExtendedGameType): GameCategory {
  const metadata = GAME_METADATA[gameType];
  return metadata?.category || "quick_play";
}

function getAccentCategory(
  category: GameCategory,
): keyof typeof GAME_CATEGORY_COLORS {
  switch (category) {
    case "quick_play":
      return "quickPlay";
    case "puzzle":
      return "puzzle";
    case "multiplayer":
      return "multiplayer";
    case "daily":
      return "quickPlay";
    default:
      return "quickPlay";
  }
}

function formatRank(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

// =============================================================================
// Animated Touchable
// =============================================================================

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// =============================================================================
// Main Component
// =============================================================================

export function GameCard({
  gameType,
  personalBest,
  leaderboardRank,
  rating,
  wins,
  losses,
  isNew = false,
  isLocked = false,
  onPress,
  variant = "default",
  style,
}: GameCardProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";

  const metadata = GAME_METADATA[gameType];
  const category = getCategoryFromGameType(gameType);
  const accentCategory = getAccentCategory(category);
  const accentColor = getCategoryColor(accentCategory, isDarkMode);

  // Animation values
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    if (!isLocked) {
      scale.value = withSpring(0.97, GAME_ANIMATIONS.spring.snappy);
      opacity.value = withSpring(0.9, GAME_ANIMATIONS.spring.snappy);
    }
  }, [isLocked, scale, opacity]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, GAME_ANIMATIONS.spring.snappy);
    opacity.value = withSpring(1, GAME_ANIMATIONS.spring.snappy);
  }, [scale, opacity]);

  if (!metadata) return null;

  const isMultiplayer = category === "multiplayer";

  // Determine card height based on variant
  const cardHeight =
    variant === "compact" ? 80 : variant === "large" ? 140 : 100;

  return (
    <AnimatedTouchable
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          height: cardHeight,
        },
        GAME_SHADOWS.sm,
        isLocked && styles.cardLocked,
        animatedStyle,
        style,
      ]}
      onPress={isLocked ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={isLocked}
    >
      {/* Accent Bar */}
      <View
        style={[
          styles.accentBar,
          {
            backgroundColor: isLocked
              ? theme.colors.surfaceDisabled
              : accentColor,
          },
        ]}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isLocked
                ? theme.colors.surfaceDisabled
                : theme.colors.surfaceVariant,
            },
          ]}
        >
          <Text style={styles.icon}>{metadata.icon}</Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                {
                  color: isLocked
                    ? theme.colors.onSurfaceDisabled
                    : theme.colors.onSurface,
                },
              ]}
              numberOfLines={1}
            >
              {metadata.name}
            </Text>

            {/* Badges */}
            {isNew && !isLocked && (
              <View style={[styles.badge, { backgroundColor: accentColor }]}>
                <Text style={styles.badgeText}>NEW</Text>
              </View>
            )}
            {isLocked && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.surfaceDisabled },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: theme.colors.onSurfaceDisabled },
                  ]}
                >
                  SOON
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          {variant !== "compact" && (
            <Text
              style={[
                styles.description,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {metadata.description}
            </Text>
          )}

          {/* Stats Row */}
          {!isLocked && (
            <View style={styles.statsRow}>
              {/* Personal Best / Rating */}
              {personalBest && !isMultiplayer && (
                <View style={styles.stat}>
                  <MaterialCommunityIcons
                    name="trophy"
                    size={14}
                    color="#FFD700"
                  />
                  <Text
                    style={[styles.statText, { color: theme.colors.onSurface }]}
                  >
                    {personalBest}
                  </Text>
                </View>
              )}

              {/* Rating for multiplayer */}
              {rating !== undefined && rating !== null && isMultiplayer && (
                <View style={styles.stat}>
                  <MaterialCommunityIcons
                    name="star"
                    size={14}
                    color={accentColor}
                  />
                  <Text
                    style={[styles.statText, { color: theme.colors.onSurface }]}
                  >
                    {rating}
                  </Text>
                </View>
              )}

              {/* Win/Loss Record */}
              {wins !== undefined && losses !== undefined && isMultiplayer && (
                <View style={styles.stat}>
                  <Text
                    style={[
                      styles.statText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    <Text style={{ color: "#4CAF50" }}>W:{wins}</Text>{" "}
                    <Text style={{ color: "#F44336" }}>L:{losses}</Text>
                  </Text>
                </View>
              )}

              {/* Leaderboard Rank */}
              {leaderboardRank !== undefined &&
                leaderboardRank !== null &&
                !isMultiplayer && (
                  <View style={styles.stat}>
                    <MaterialCommunityIcons
                      name="podium"
                      size={14}
                      color={theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.statText,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      {formatRank(leaderboardRank)}
                    </Text>
                  </View>
                )}
            </View>
          )}
        </View>

        {/* Chevron */}
        {!isLocked && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={theme.colors.onSurfaceVariant}
          />
        )}

        {/* Lock Icon */}
        {isLocked && (
          <MaterialCommunityIcons
            name="lock-outline"
            size={24}
            color={theme.colors.onSurfaceDisabled}
          />
        )}
      </View>
    </AnimatedTouchable>
  );
}

// =============================================================================
// Compact Game Card (for horizontal lists)
// =============================================================================

export interface CompactGameCardProps {
  gameType: ExtendedGameType;
  personalBest?: string | null;
  onPress: () => void;
  isLocked?: boolean;
  width?: number;
}

export function CompactGameCard({
  gameType,
  personalBest,
  onPress,
  isLocked = false,
  width = 120,
}: CompactGameCardProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";

  const metadata = GAME_METADATA[gameType];
  const category = getCategoryFromGameType(gameType);
  const accentCategory = getAccentCategory(category);
  const accentColor = getCategoryColor(accentCategory, isDarkMode);

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (!isLocked) {
      scale.value = withSpring(0.95, GAME_ANIMATIONS.spring.snappy);
    }
  }, [isLocked, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, GAME_ANIMATIONS.spring.snappy);
  }, [scale]);

  if (!metadata) return null;

  return (
    <AnimatedTouchable
      style={[
        styles.compactCard,
        {
          width,
          backgroundColor: theme.colors.surface,
        },
        GAME_SHADOWS.sm,
        isLocked && styles.cardLocked,
        animatedStyle,
      ]}
      onPress={isLocked ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={isLocked}
    >
      {/* Top Accent */}
      <View
        style={[
          styles.compactAccent,
          {
            backgroundColor: isLocked
              ? theme.colors.surfaceDisabled
              : accentColor,
          },
        ]}
      />

      {/* Icon */}
      <View
        style={[
          styles.compactIconContainer,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <Text style={styles.compactIcon}>{metadata.icon}</Text>
      </View>

      {/* Name */}
      <Text
        style={[
          styles.compactName,
          {
            color: isLocked
              ? theme.colors.onSurfaceDisabled
              : theme.colors.onSurface,
          },
        ]}
        numberOfLines={1}
      >
        {metadata.shortName || metadata.name}
      </Text>

      {/* Personal Best */}
      {personalBest && !isLocked && (
        <View style={styles.compactBest}>
          <MaterialCommunityIcons name="trophy" size={12} color="#FFD700" />
          <Text
            style={[
              styles.compactBestText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {personalBest}
          </Text>
        </View>
      )}

      {/* Coming Soon Badge */}
      {isLocked && (
        <View style={styles.compactLockBadge}>
          <MaterialCommunityIcons
            name="lock"
            size={10}
            color={theme.colors.onSurfaceDisabled}
          />
        </View>
      )}
    </AnimatedTouchable>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Default Card
  card: {
    borderRadius: GAME_BORDER_RADIUS.lg,
    marginVertical: GAME_SPACING.xs,
    overflow: "hidden",
    flexDirection: "row",
  },
  cardLocked: {
    opacity: 0.7,
  },
  accentBar: {
    width: 4,
    height: "100%",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: GAME_SPACING.md,
    paddingVertical: GAME_SPACING.sm,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: GAME_BORDER_RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: GAME_SPACING.md,
  },
  icon: {
    fontSize: 28,
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.sm,
  },
  title: {
    ...GAME_TYPOGRAPHY.gameTitle,
  },
  badge: {
    paddingHorizontal: GAME_SPACING.sm,
    paddingVertical: 2,
    borderRadius: GAME_BORDER_RADIUS.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  description: {
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: GAME_SPACING.xs,
    gap: GAME_SPACING.md,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    ...GAME_TYPOGRAPHY.statValue,
    fontSize: 13,
  },

  // Compact Card
  compactCard: {
    borderRadius: GAME_BORDER_RADIUS.lg,
    padding: GAME_SPACING.sm,
    alignItems: "center",
    marginHorizontal: GAME_SPACING.xs,
    overflow: "hidden",
  },
  compactAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  compactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: GAME_BORDER_RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: GAME_SPACING.xs,
  },
  compactIcon: {
    fontSize: 24,
  },
  compactName: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: GAME_SPACING.xs,
    textAlign: "center",
  },
  compactBest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  compactBestText: {
    fontSize: 11,
  },
  compactLockBadge: {
    marginTop: GAME_SPACING.xs,
  },
});

export default GameCard;
