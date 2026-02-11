/**
 * FeaturedGameBanner
 *
 * A promotional banner for highlighting new or featured games.
 *
 * Phase 4: Category & Browse Experience
 *
 * Features:
 * - 160px height, full width with 16px margins
 * - Gradient background based on game category
 * - Large centered icon
 * - Headline and subheadline text
 * - Animated CTA button
 * - Spring press animation
 * - NEW badge for new games
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 4
 */

import { ThreeHeroBanner } from "@/components/three";
import { useAppTheme } from "@/store/ThemeContext";
import { GAME_METADATA, GameCategory } from "@/types/games";
import { FeaturedGame, getCategoryColor } from "@/types/playScreen";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { THREE_JS_FEATURES } from "@/constants/featureFlags";
import { PLAY_SCREEN_TOKENS } from "@/constants/gamesTheme";

const { spacing, borderRadius, shadows, typography, animation } =
  PLAY_SCREEN_TOKENS;

// =============================================================================
// Types
// =============================================================================

export interface FeaturedGameBannerProps {
  /** Featured game configuration */
  featuredGame: FeaturedGame;
  /** Called when banner is pressed */
  onPress: () => void;
  /** Additional container styles */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

// Banner dimensions
const BANNER_HEIGHT = 160;
const BANNER_MARGIN = spacing.horizontalPadding;

// =============================================================================
// Component
// =============================================================================

function FeaturedGameBannerComponent({
  featuredGame,
  onPress,
  style,
  testID,
}: FeaturedGameBannerProps) {
  const { colors, isDark } = useAppTheme();
  const scale = useSharedValue(1);

  const metadata = GAME_METADATA[featuredGame.gameType];
  const isNew = metadata?.isNew ?? false;
  const categoryColor = getCategoryColor(
    metadata?.category as GameCategory,
    isDark,
  );

  // Calculate gradient colors
  const gradientStart = featuredGame.backgroundColor || categoryColor;
  const gradientEnd =
    featuredGame.gradientEndColor ||
    adjustColor(gradientStart, isDark ? 30 : -30);

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

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.container, animatedStyle, style]}
      testID={testID}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
      >
        <LinearGradient
          colors={[gradientStart, gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Three.js 3D hero banner (behind 2D content) */}
          {THREE_JS_FEATURES.THREE_JS_ENABLED &&
            THREE_JS_FEATURES.HERO_BANNER_3D && (
              <ThreeHeroBanner
                primaryColor={gradientStart}
                secondaryColor={gradientEnd}
                pieceCount={5}
                style={styles.threeBanner}
                testID={testID ? `${testID}-three` : undefined}
              />
            )}

          {/* NEW Badge */}
          {isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{metadata?.icon || "🎮"}</Text>
            </View>

            {/* Text Content */}
            <View style={styles.textContent}>
              <Text
                style={styles.headline}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {featuredGame.headline}
              </Text>
              <Text style={styles.subheadline} numberOfLines={2}>
                {featuredGame.subheadline}
              </Text>
            </View>

            {/* CTA Button */}
            <View style={styles.ctaButton}>
              <Text style={styles.ctaText}>Play Now</Text>
            </View>
          </View>

          {/* Decorative elements */}
          <View style={styles.decoration1} />
          <View style={styles.decoration2} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Adjust color brightness
 */
function adjustColor(color: string, amount: number): string {
  // Parse hex color
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Adjust brightness
  const newR = Math.min(255, Math.max(0, r + amount));
  const newG = Math.min(255, Math.max(0, g + amount));
  const newB = Math.min(255, Math.max(0, b + amount));

  // Convert back to hex
  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginHorizontal: BANNER_MARGIN,
    marginBottom: spacing.sectionGap,
    height: BANNER_HEIGHT,
    borderRadius: borderRadius.cardLarge,
    overflow: "hidden",
    ...shadows.card,
  },

  pressable: {
    flex: 1,
  },

  gradient: {
    flex: 1,
    padding: spacing.cardPadding,
    position: "relative",
    overflow: "hidden",
  },

  // NEW Badge
  newBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FF4757",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },

  // Content
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
  },

  // Icon
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  icon: {
    fontSize: 44,
  },

  // Text
  textContent: {
    flex: 1,
    marginRight: 12,
  },
  headline: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: "#FFFFFF",
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subheadline: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 18,
  },

  // CTA Button
  ctaButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#333333",
  },

  // Decorative elements
  decoration1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  decoration2: {
    position: "absolute",
    bottom: -30,
    left: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },

  // Three.js 3D banner overlay
  threeBanner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.cardLarge,
    opacity: 0.6,
  },
});

// =============================================================================
// Export
// =============================================================================

export const FeaturedGameBanner = memo(FeaturedGameBannerComponent);
export default FeaturedGameBanner;
