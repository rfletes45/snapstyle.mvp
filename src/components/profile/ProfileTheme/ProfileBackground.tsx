/**
 * ProfileBackground Component
 *
 * Renders the profile background based on theme configuration.
 * Supports solid colors, gradients, images, and patterns.
 *
 * @module components/profile/ProfileTheme/ProfileBackground
 */

import type { ProfileTheme } from "@/types/profile";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useMemo } from "react";
import {
  ImageBackground,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

export interface ProfileBackgroundProps {
  /** The theme to render (null for default) */
  theme: ProfileTheme | null | undefined;
  /** Children to render on top of the background */
  children?: React.ReactNode;
  /** Additional container style */
  style?: StyleProp<ViewStyle>;
  /** Whether to apply safe area padding */
  applySafeArea?: boolean;
  /** Blur amount for image backgrounds */
  blurAmount?: number;
  /** Enable pattern overlay */
  showPattern?: boolean;
  /** Test ID for testing */
  testID?: string;
}

// =============================================================================
// Pattern Component
// =============================================================================

interface PatternOverlayProps {
  pattern: ProfileTheme["backgroundPattern"];
}

const PatternOverlay = memo(function PatternOverlay({
  pattern,
}: PatternOverlayProps) {
  if (!pattern) return null;

  const patternStyle = useMemo(() => {
    switch (pattern.type) {
      case "dots":
        return {
          backgroundImage: `radial-gradient(circle, ${pattern.color} 1px, transparent 1px)`,
          backgroundSize: "16px 16px",
          opacity: pattern.opacity,
        };
      case "lines":
        return {
          backgroundImage: `repeating-linear-gradient(
            90deg,
            ${pattern.color} 0px,
            ${pattern.color} 1px,
            transparent 1px,
            transparent 16px
          )`,
          opacity: pattern.opacity,
        };
      case "grid":
        return {
          backgroundImage: `
            linear-gradient(${pattern.color} 1px, transparent 1px),
            linear-gradient(90deg, ${pattern.color} 1px, transparent 1px)
          `,
          backgroundSize: "16px 16px",
          opacity: pattern.opacity,
        };
      default:
        return {};
    }
  }, [pattern]);

  // React Native doesn't support CSS patterns directly
  // For now, render as a semi-transparent overlay
  return (
    <View
      style={[
        styles.patternOverlay,
        { backgroundColor: pattern.color, opacity: pattern.opacity * 0.3 },
      ]}
    />
  );
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if background color is a gradient config
 */
function isGradientConfig(
  color: string | { type?: string; colors: string[]; angle?: number },
): color is { type?: string; colors: string[]; angle?: number } {
  return (
    typeof color === "object" &&
    "colors" in color &&
    Array.isArray((color as { colors?: unknown }).colors)
  );
}

/**
 * Convert gradient angle to expo-linear-gradient start/end points
 */
function angleToPoints(angle: number): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  // Normalize angle to 0-360
  const normalizedAngle = ((angle % 360) + 360) % 360;

  // Convert to radians
  const rad = (normalizedAngle * Math.PI) / 180;

  // Calculate start and end points
  const x = Math.sin(rad);
  const y = -Math.cos(rad);

  return {
    start: {
      x: 0.5 - x * 0.5,
      y: 0.5 - y * 0.5,
    },
    end: {
      x: 0.5 + x * 0.5,
      y: 0.5 + y * 0.5,
    },
  };
}

// =============================================================================
// Main Component
// =============================================================================

const DEFAULT_BACKGROUND = "#1a1a2e";

export const ProfileBackground = memo(function ProfileBackground({
  theme,
  children,
  style,
  applySafeArea = false,
  showPattern = true,
  testID,
}: ProfileBackgroundProps) {
  // Handle null theme with default background
  if (!theme) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: DEFAULT_BACKGROUND },
          style,
        ]}
        testID={testID}
      >
        {children}
      </View>
    );
  }

  // Determine background type
  const backgroundConfig = theme.colors.background;
  const isGradient = isGradientConfig(backgroundConfig);
  const hasImage = !!theme.backgroundImage;
  const hasPattern = showPattern && !!theme.backgroundPattern;

  // Gradient rendering
  if (isGradient && !hasImage) {
    const { start, end } = angleToPoints(backgroundConfig.angle || 180);
    // Ensure we have at least 2 colors for the gradient
    const gradientColors =
      backgroundConfig.colors.length >= 2
        ? (backgroundConfig.colors as [string, string, ...string[]])
        : ([
            backgroundConfig.colors[0] || DEFAULT_BACKGROUND,
            backgroundConfig.colors[0] || DEFAULT_BACKGROUND,
          ] as [string, string]);

    return (
      <LinearGradient
        colors={gradientColors}
        start={start}
        end={end}
        style={[styles.container, style]}
        testID={testID}
      >
        {hasPattern && <PatternOverlay pattern={theme.backgroundPattern} />}
        {children}
      </LinearGradient>
    );
  }

  // Image background rendering
  if (hasImage) {
    return (
      <ImageBackground
        source={{ uri: theme.backgroundImage }}
        style={[styles.container, style]}
        imageStyle={styles.backgroundImage}
        blurRadius={theme.backgroundBlur}
        testID={testID}
      >
        {/* Overlay for text readability */}
        <View
          style={[
            styles.imageOverlay,
            {
              backgroundColor: isGradient
                ? backgroundConfig.colors[0]
                : (backgroundConfig as string),
              opacity: 0.7,
            },
          ]}
        />
        {hasPattern && <PatternOverlay pattern={theme.backgroundPattern} />}
        {children}
      </ImageBackground>
    );
  }

  // Solid color rendering
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: backgroundConfig as string },
        style,
      ]}
      testID={testID}
    >
      {hasPattern && <PatternOverlay pattern={theme.backgroundPattern} />}
      {children}
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  patternOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  backgroundImage: {
    resizeMode: "cover",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default ProfileBackground;
