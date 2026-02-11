/**
 * CarouselGameTile
 *
 * A compact tile component for horizontal game carousels.
 *
 * Phase 2: Core component for category browsing
 *
 * Features:
 * - Square-ish tile design (100x110px)
 * - Large centered icon
 * - Compact title and score
 * - Spring animation on press
 * - NEW badge support
 * - Category-colored background
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 4
 */

import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType, GAME_METADATA, GameCategory } from "@/types/games";
import { getCategoryColor } from "@/types/playScreen";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { PLAY_SCREEN_TOKENS } from "@/constants/gamesTheme";

const { borderRadius, shadows, animation } = PLAY_SCREEN_TOKENS;

// =============================================================================
// Types
// =============================================================================

export interface CarouselGameTileProps {
  /** The game type to display */
  gameType: ExtendedGameType;
  /** Personal best score (formatted string) */
  personalBest?: string | null;
  /** Called when tile is pressed */
  onPress: () => void;
  /** Called when tile is long-pressed */
  onLongPress?: () => void;
  /** Show NEW badge */
  isNew?: boolean;
  /** Additional styles */
  style?: ViewStyle;
  /** Custom width */
  width?: number;
  /** Custom height */
  height?: number;
  /** Test ID for testing */
  testID?: string;
}

// Default tile dimensions
const DEFAULT_TILE_WIDTH = 100;
const DEFAULT_TILE_HEIGHT = 110;

// =============================================================================
// Component
// =============================================================================

function CarouselGameTileComponent({
  gameType,
  personalBest,
  onPress,
  onLongPress,
  isNew = false,
  style,
  width = DEFAULT_TILE_WIDTH,
  height = DEFAULT_TILE_HEIGHT,
  testID,
}: CarouselGameTileProps) {
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
    scale.value = withSpring(0.95, animation.pressSpring);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animation.pressSpring);
  }, [scale]);

  const handleLongPress = useCallback(() => {
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onLongPress();
    }
  }, [onLongPress]);

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={400}
        testID={testID}
        style={[
          styles.tile,
          {
            width,
            height,
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : "transparent",
          },
        ]}
      >
        {/* NEW Badge */}
        {isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}

        {/* Icon Area */}
        <View
          style={[styles.iconArea, { backgroundColor: `${categoryColor}10` }]}
        >
          <Text style={styles.iconEmoji}>{metadata.icon}</Text>
        </View>

        {/* Text Area */}
        <View style={styles.textArea}>
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {metadata.shortName || metadata.name}
          </Text>
          {personalBest ? (
            <Text style={[styles.score, { color: colors.textSecondary }]}>
              ★ {personalBest}
            </Text>
          ) : (
            <Text style={[styles.score, { color: colors.textSecondary }]}>
              {metadata.isMultiplayer ? "👥 Multi" : "Play"}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  tile: {
    borderRadius: borderRadius.cardLarge,
    borderWidth: 1,
    overflow: "hidden",
    ...shadows.card,
  },

  // NEW Badge
  newBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#FF3B30",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    zIndex: 1,
  },
  newBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700" as const,
  },

  // Icon Area
  iconArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 8,
  },
  iconEmoji: {
    fontSize: 32,
  },

  // Text Area
  textArea: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  title: {
    fontSize: 12,
    fontWeight: "600" as const,
    textAlign: "center",
    lineHeight: 16,
  },
  score: {
    fontSize: 11,
    fontWeight: "400" as const,
    textAlign: "center",
    lineHeight: 14,
    marginTop: 2,
  },
});

export const CarouselGameTile = memo(CarouselGameTileComponent);
export default CarouselGameTile;
