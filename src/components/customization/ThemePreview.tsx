/**
 * ThemePreview Component
 *
 * Displays a preview of a profile theme showing its color scheme
 * and visual effects. Used in the customization modal.
 */

import { isGradient } from "@/data/profileThemes";
import type { GradientConfig, ProfileTheme } from "@/types/profile";
import { RARITY_COLORS } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface ThemePreviewProps {
  /** Theme to preview */
  theme: ProfileTheme;
  /** Whether this theme is currently selected */
  selected?: boolean;
  /** Whether user owns this theme */
  owned?: boolean;
  /** Whether this theme is equipped */
  equipped?: boolean;
  /** Handler for press */
  onPress?: () => void;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

function ThemePreviewBase({
  theme,
  selected = false,
  owned = true,
  equipped = false,
  onPress,
  compact = false,
}: ThemePreviewProps) {
  const paperTheme = useTheme();
  const rarityColor = RARITY_COLORS[theme.rarity];

  // Get gradient colors for background preview
  const getBackgroundPreviewColors = (): readonly [
    string,
    string,
    ...string[],
  ] => {
    if (isGradient(theme.colors.background)) {
      const colors = theme.colors.background.colors;
      // Ensure at least 2 colors for LinearGradient
      if (colors.length >= 2) {
        return colors as unknown as readonly [string, string, ...string[]];
      }
      return [colors[0] || theme.colors.surface, theme.colors.surface];
    }
    return [theme.colors.background, theme.colors.surface];
  };

  // Get gradient angle
  const getBackgroundAngle = (): number => {
    if (isGradient(theme.colors.background)) {
      return theme.colors.background.angle || 135;
    }
    return 135;
  };

  const renderCompact = () => (
    <TouchableOpacity
      style={[
        styles.compactContainer,
        {
          borderColor: selected ? paperTheme.colors.primary : "transparent",
          opacity: owned ? 1 : 0.5,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <LinearGradient
        colors={getBackgroundPreviewColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.compactPreview}
      >
        {/* Primary color dot */}
        <View
          style={[styles.primaryDot, { backgroundColor: theme.colors.primary }]}
        />
        {/* Secondary color dot */}
        <View
          style={[
            styles.secondaryDot,
            { backgroundColor: theme.colors.secondary },
          ]}
        />
      </LinearGradient>
      {!owned && (
        <View style={styles.lockOverlay}>
          <MaterialCommunityIcons name="lock" size={16} color="#FFFFFF" />
        </View>
      )}
      {equipped && (
        <View
          style={[
            styles.equippedBadge,
            { backgroundColor: paperTheme.colors.primary },
          ]}
        >
          <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderFull = () => (
    <TouchableOpacity
      style={[
        styles.container,
        {
          borderColor: selected
            ? paperTheme.colors.primary
            : paperTheme.colors.outline,
          opacity: owned ? 1 : 0.6,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Preview Area */}
      <LinearGradient
        colors={getBackgroundPreviewColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.previewArea}
      >
        {/* Mock header */}
        {theme.headerStyle && (
          <View style={styles.mockHeader}>
            {theme.headerStyle.type === "gradient" &&
            isGradient(theme.headerStyle.value as GradientConfig) ? (
              <LinearGradient
                colors={
                  (theme.headerStyle.value as GradientConfig)
                    .colors as unknown as readonly [string, string, ...string[]]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.mockHeaderGradient}
              />
            ) : (
              <View
                style={[
                  styles.mockHeaderGradient,
                  { backgroundColor: theme.colors.primary + "40" },
                ]}
              />
            )}
          </View>
        )}

        {/* Mock content cards */}
        <View style={styles.mockContent}>
          <View
            style={[styles.mockCard, { backgroundColor: theme.colors.surface }]}
          >
            <View
              style={[
                styles.mockText,
                { backgroundColor: theme.colors.text + "30" },
              ]}
            />
            <View
              style={[
                styles.mockTextShort,
                { backgroundColor: theme.colors.textSecondary + "30" },
              ]}
            />
          </View>
          <View style={styles.mockColorRow}>
            <View
              style={[
                styles.colorSwatch,
                { backgroundColor: theme.colors.primary },
              ]}
            />
            <View
              style={[
                styles.colorSwatch,
                { backgroundColor: theme.colors.secondary },
              ]}
            />
          </View>
        </View>

        {/* Rarity indicator */}
        <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
          <Text style={styles.rarityText}>
            {theme.rarity.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Lock overlay */}
        {!owned && (
          <View style={styles.lockOverlayFull}>
            <MaterialCommunityIcons name="lock" size={24} color="#FFFFFF" />
            {theme.unlock.priceTokens && (
              <Text style={styles.priceText}>
                {theme.unlock.priceTokens} 🪙
              </Text>
            )}
          </View>
        )}

        {/* Equipped badge */}
        {equipped && (
          <View
            style={[
              styles.equippedBadgeFull,
              { backgroundColor: paperTheme.colors.primary },
            ]}
          >
            <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
            <Text style={styles.equippedText}>Equipped</Text>
          </View>
        )}
      </LinearGradient>

      {/* Theme Info */}
      <View style={styles.infoArea}>
        <Text
          style={[styles.themeName, { color: paperTheme.colors.onSurface }]}
          numberOfLines={1}
        >
          {theme.name}
        </Text>
        <Text
          style={[
            styles.themeDesc,
            { color: paperTheme.colors.onSurfaceVariant },
          ]}
          numberOfLines={1}
        >
          {theme.description}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return compact ? renderCompact() : renderFull();
}

const styles = StyleSheet.create({
  // Full preview styles
  container: {
    width: 160,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  previewArea: {
    height: 100,
    position: "relative",
    overflow: "hidden",
  },
  mockHeader: {
    height: 24,
    marginBottom: 8,
  },
  mockHeaderGradient: {
    flex: 1,
  },
  mockContent: {
    paddingHorizontal: 8,
  },
  mockCard: {
    padding: 6,
    borderRadius: 6,
    marginBottom: 6,
  },
  mockText: {
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  mockTextShort: {
    height: 6,
    width: "60%",
    borderRadius: 3,
  },
  mockColorRow: {
    flexDirection: "row",
    gap: 4,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  rarityBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  rarityText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  lockOverlayFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  priceText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  equippedBadgeFull: {
    position: "absolute",
    bottom: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  equippedText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  infoArea: {
    padding: 8,
    backgroundColor: "#FFFFFF",
  },
  themeName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  themeDesc: {
    fontSize: 11,
  },

  // Compact preview styles
  compactContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    position: "relative",
  },
  compactPreview: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  primaryDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: "absolute",
    top: 8,
    left: 8,
  },
  secondaryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: "absolute",
    bottom: 8,
    right: 8,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  equippedBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});

export const ThemePreview = memo(ThemePreviewBase);
export default ThemePreview;
