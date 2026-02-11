/**
 * ModernGameCard
 *
 * A modern, sleek game card component for the Play screen.
 *
 * Phase 2: Core component for game discovery
 *
 * Features:
 * - Three variants: default (72px), compact (56px), featured (140px)
 * - Spring animation on press
 * - Play button or chevron indicator
 * - NEW badge for new games
 * - Lock icon for unavailable games
 * - Category-colored icon background
 * - Subtle shadows, tight border radius (6px)
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 3
 */

import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType, GAME_METADATA, GameCategory } from "@/types/games";
import { getCategoryColor, getCategoryLabel } from "@/types/playScreen";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { PLAY_SCREEN_TOKENS } from "@/constants/gamesTheme";

const { borderRadius, shadows, typography, animation } = PLAY_SCREEN_TOKENS;

// =============================================================================
// Types
// =============================================================================

export type GameCardVariant = "default" | "compact" | "featured";

export interface ModernGameCardProps {
  /** The game type to display */
  gameType: ExtendedGameType;
  /** Personal best score (formatted string) */
  personalBest?: string | null;
  /** Called when card is pressed */
  onPress: () => void;
  /** Called when card is long-pressed */
  onLongPress?: () => void;
  /** Card variant for different sizes */
  variant?: GameCardVariant;
  /** Show PLAY button (default) or chevron */
  showPlayButton?: boolean;
  /** Show NEW badge */
  isNew?: boolean;
  /** Show as locked/unavailable */
  isLocked?: boolean;
  /** Additional styles */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

// =============================================================================
// Component
// =============================================================================

function ModernGameCardComponent({
  gameType,
  personalBest,
  onPress,
  onLongPress,
  variant = "default",
  showPlayButton = true,
  isNew = false,
  isLocked = false,
  style,
  testID,
}: ModernGameCardProps) {
  const { colors, isDark } = useAppTheme();
  const metadata = GAME_METADATA[gameType];
  const scale = useSharedValue(1);

  // Get category color for icon background
  const categoryColor = getCategoryColor(
    metadata.category as GameCategory,
    isDark,
  );

  // Animated scale style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, animation.pressSpring);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animation.pressSpring);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (!isLocked) {
      onPress();
    }
  }, [isLocked, onPress]);

  const handleLongPress = useCallback(() => {
    if (!isLocked && onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onLongPress();
    }
  }, [isLocked, onLongPress]);

  // Render featured variant (vertical layout)
  if (variant === "featured") {
    return (
      <Animated.View style={[animatedStyle, style]}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          delayLongPress={400}
          disabled={isLocked}
          testID={testID}
          style={[
            styles.card,
            styles.cardFeatured,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? colors.border : "transparent",
            },
            isLocked && styles.cardLocked,
          ]}
        >
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              styles.iconFeatured,
              { backgroundColor: `${categoryColor}15` },
            ]}
          >
            <Text style={styles.iconEmojiFeatured}>{metadata.icon}</Text>
          </View>

          {/* Title */}
          <View style={styles.featuredTitleRow}>
            <Text style={[styles.titleFeatured, { color: colors.text }]}>
              {metadata.name}
            </Text>
            {isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
          </View>

          {/* Subtitle */}
          <Text
            style={[styles.subtitleFeatured, { color: colors.textSecondary }]}
          >
            {metadata.description}
          </Text>

          {/* Play Button */}
          {!isLocked && (
            <View
              style={[
                styles.playButtonFeatured,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.playButtonText}>PLAY NOW</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  }

  // Render default or compact variant (horizontal layout)
  const isCompact = variant === "compact";

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={400}
        disabled={isLocked}
        testID={testID}
        style={[
          styles.card,
          isCompact ? styles.cardCompact : styles.cardDefault,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : "transparent",
          },
          isLocked && styles.cardLocked,
        ]}
      >
        {/* Icon Container */}
        <View
          style={[
            styles.iconContainer,
            isCompact ? styles.iconCompact : styles.iconDefault,
            { backgroundColor: `${categoryColor}15` },
          ]}
        >
          <Text
            style={
              isCompact ? styles.iconEmojiCompact : styles.iconEmojiDefault
            }
          >
            {metadata.icon}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text
              style={[
                isCompact ? styles.titleCompact : styles.title,
                { color: colors.text },
              ]}
              numberOfLines={1}
            >
              {metadata.name}
            </Text>
            {isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
          </View>

          <Text
            style={[styles.subtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {getCategoryLabel(metadata.category as GameCategory)}
            {personalBest && ` • Best: ${personalBest}`}
          </Text>
        </View>

        {/* Action */}
        {showPlayButton && !isLocked ? (
          <View
            style={[styles.playButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.playButtonText}>PLAY</Text>
          </View>
        ) : isLocked ? (
          <MaterialCommunityIcons
            name="lock"
            size={20}
            color={colors.textMuted || colors.textSecondary}
          />
        ) : (
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={colors.textSecondary}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Card Base
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.card,
    borderWidth: 1,
    ...shadows.card,
  },
  cardDefault: {
    height: 72,
    padding: 12,
  },
  cardCompact: {
    height: 56,
    padding: 10,
  },
  cardFeatured: {
    height: 160,
    padding: 16,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.cardLarge,
  },
  cardLocked: {
    opacity: 0.6,
  },

  // Icon Container
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: borderRadius.icon,
  },
  iconDefault: {
    width: 48,
    height: 48,
    marginRight: 12,
  },
  iconCompact: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  iconFeatured: {
    width: 64,
    height: 64,
    marginBottom: 12,
  },

  // Icon Emoji
  iconEmojiDefault: {
    fontSize: 24,
  },
  iconEmojiCompact: {
    fontSize: 18,
  },
  iconEmojiFeatured: {
    fontSize: 32,
  },

  // Content
  content: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  featuredTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: typography.cardTitle.fontWeight as "600",
    lineHeight: typography.cardTitle.lineHeight,
    flexShrink: 1,
  },
  titleCompact: {
    fontSize: 14,
    fontWeight: "600" as const,
    lineHeight: 18,
    flexShrink: 1,
  },
  titleFeatured: {
    fontSize: 18,
    fontWeight: "700" as const,
    lineHeight: 22,
    textAlign: "center",
  },
  subtitle: {
    fontSize: typography.cardSubtitle.fontSize,
    fontWeight: typography.cardSubtitle.fontWeight as "400",
    lineHeight: typography.cardSubtitle.lineHeight,
    marginTop: 2,
  },
  subtitleFeatured: {
    fontSize: 13,
    fontWeight: "400" as const,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 12,
  },

  // NEW Badge
  newBadge: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700" as const,
  },

  // Play Button
  playButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.button,
    minWidth: 54,
    alignItems: "center",
  },
  playButtonFeatured: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: borderRadius.button,
    minWidth: 100,
    alignItems: "center",
  },
  playButtonText: {
    color: "#fff",
    fontSize: typography.buttonText.fontSize,
    fontWeight: typography.buttonText.fontWeight as "700",
    lineHeight: typography.buttonText.lineHeight,
  },
});

export const ModernGameCard = memo(ModernGameCardComponent);
export default ModernGameCard;
