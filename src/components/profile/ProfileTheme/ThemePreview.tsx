/**
 * ThemePreview Component
 *
 * Shows a preview of how a profile theme will look.
 * Used in the theme picker for selection.
 *
 * @module components/profile/ProfileTheme/ThemePreview
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import type { ProfileTheme } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useMemo } from "react";
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface ThemePreviewProps {
  /** The theme to preview */
  theme: ProfileTheme;
  /** Whether this theme is currently selected */
  isSelected?: boolean;
  /** Whether user owns this theme */
  isOwned?: boolean;
  /** Whether this theme is locked */
  isLocked?: boolean;
  /** Callback when theme is pressed */
  onPress?: () => void;
  /** Size variant */
  size?: "small" | "medium" | "large";
  /** Show theme name */
  showName?: boolean;
  /** Show rarity indicator */
  showRarity?: boolean;
  /** Additional style */
  style?: StyleProp<ViewStyle>;
  /** Test ID for testing */
  testID?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SIZE_CONFIG = {
  small: { width: 80, height: 100, fontSize: 10 },
  medium: { width: 120, height: 150, fontSize: 12 },
  large: { width: 160, height: 200, fontSize: 14 },
};

const RARITY_COLORS: Record<string, string> = {
  common: "#9E9E9E",
  rare: "#2196F3",
  epic: "#9C27B0",
  legendary: "#FF9800",
  mythic: "#E91E63",
};

const RARITY_GLOW: Record<string, string> = {
  common: "transparent",
  rare: "rgba(33, 150, 243, 0.3)",
  epic: "rgba(156, 39, 176, 0.3)",
  legendary: "rgba(255, 152, 0, 0.4)",
  mythic: "rgba(233, 30, 99, 0.5)",
};

// =============================================================================
// Helper Functions
// =============================================================================

function isGradientConfig(
  color: string | { type?: string; colors: string[]; angle?: number },
): color is { type?: string; colors: string[]; angle?: number } {
  return (
    typeof color === "object" &&
    "colors" in color &&
    Array.isArray((color as { colors?: unknown }).colors)
  );
}

// =============================================================================
// Main Component
// =============================================================================

export const ThemePreview = memo(function ThemePreview({
  theme,
  isSelected = false,
  isOwned = true,
  isLocked = false,
  onPress,
  size = "medium",
  showName = true,
  showRarity = true,
  style,
  testID,
}: ThemePreviewProps) {
  const paperTheme = useTheme();
  const sizeConfig = SIZE_CONFIG[size];
  const rarityColor = RARITY_COLORS[theme.rarity] || RARITY_COLORS.common;
  const glowColor = RARITY_GLOW[theme.rarity] || "transparent";

  // Determine background color/gradient
  const backgroundConfig = theme.colors.background;
  const isGradient = isGradientConfig(backgroundConfig);

  // Build preview content
  const previewContent = useMemo(() => {
    return (
      <View style={styles.previewContent}>
        {/* Simulated profile elements */}
        <View style={styles.mockHeader}>
          {/* Mock avatar circle */}
          <View
            style={[
              styles.mockAvatar,
              { backgroundColor: theme.colors.primary },
            ]}
          />
          {/* Mock text lines */}
          <View style={styles.mockTextGroup}>
            <View
              style={[
                styles.mockTextLine,
                { backgroundColor: theme.colors.text, width: "60%" },
              ]}
            />
            <View
              style={[
                styles.mockTextLineSmall,
                { backgroundColor: theme.colors.textSecondary, width: "40%" },
              ]}
            />
          </View>
        </View>

        {/* Mock content area */}
        <View
          style={[
            styles.mockContent,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <View
            style={[
              styles.mockTextLine,
              { backgroundColor: theme.colors.textSecondary },
            ]}
          />
          <View
            style={[
              styles.mockTextLine,
              { backgroundColor: theme.colors.textSecondary, width: "80%" },
            ]}
          />
        </View>
      </View>
    );
  }, [theme.colors]);

  // Render background
  const renderBackground = () => {
    if (isGradient) {
      // Ensure we have at least 2 colors for the gradient
      const gradientColors =
        backgroundConfig.colors.length >= 2
          ? (backgroundConfig.colors as [string, string, ...string[]])
          : ([
              backgroundConfig.colors[0] || "#1a1a2e",
              backgroundConfig.colors[0] || "#1a1a2e",
            ] as [string, string]);

      return (
        <LinearGradient
          colors={gradientColors}
          style={styles.background}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {previewContent}
        </LinearGradient>
      );
    }

    return (
      <View
        style={[
          styles.background,
          { backgroundColor: backgroundConfig as string },
        ]}
      >
        {previewContent}
      </View>
    );
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLocked && !isOwned}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          width: sizeConfig.width,
          height: sizeConfig.height + (showName ? 24 : 0),
          borderColor: isSelected ? paperTheme.colors.primary : "transparent",
          shadowColor: glowColor,
        },
        isSelected && styles.selected,
        style,
      ]}
      testID={testID}
    >
      {/* Theme preview card */}
      <Surface
        style={[
          styles.card,
          {
            width: sizeConfig.width,
            height: sizeConfig.height,
          },
        ]}
        elevation={isSelected ? 3 : 1}
      >
        {renderBackground()}

        {/* Rarity indicator */}
        {showRarity && (
          <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
            <MaterialCommunityIcons name="star" size={10} color="#FFFFFF" />
          </View>
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <View
            style={[
              styles.selectedBadge,
              { backgroundColor: paperTheme.colors.primary },
            ]}
          >
            <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
          </View>
        )}

        {/* Lock overlay */}
        {isLocked && !isOwned && (
          <View style={styles.lockOverlay}>
            <MaterialCommunityIcons name="lock" size={24} color="#FFFFFF" />
            {theme.unlock.priceTokens && (
              <Text style={styles.priceText}>
                {theme.unlock.priceTokens} 💎
              </Text>
            )}
          </View>
        )}
      </Surface>

      {/* Theme name */}
      {showName && (
        <Text
          style={[
            styles.themeName,
            {
              fontSize: sizeConfig.fontSize,
              color: paperTheme.colors.onSurface,
            },
          ]}
          numberOfLines={1}
        >
          {theme.name}
        </Text>
      )}
    </TouchableOpacity>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
  },
  selected: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  card: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  background: {
    flex: 1,
  },
  previewContent: {
    flex: 1,
    padding: Spacing.xs,
    justifyContent: "space-between",
  },
  mockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  mockAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  mockTextGroup: {
    flex: 1,
    gap: 2,
  },
  mockTextLine: {
    height: 6,
    borderRadius: 3,
  },
  mockTextLineSmall: {
    height: 4,
    borderRadius: 2,
  },
  mockContent: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  rarityBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  priceText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  themeName: {
    marginTop: Spacing.xs,
    fontWeight: "500",
    textAlign: "center",
  },
});

export default ThemePreview;
