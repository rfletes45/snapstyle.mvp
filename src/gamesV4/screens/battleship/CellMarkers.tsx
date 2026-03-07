/**
 * Battleship — Cell Marker Components
 *
 * Distinct visual markers for each cell state. Each marker differs by
 * **shape** (not just color) for accessibility.
 *
 * - MissMarker  — small circle with ring
 * - HitMarker   — X-cross burst
 * - SunkMarker  — filled X with "SUNK" label
 * - SelectedMarker — crosshair reticle
 *
 * Animations use react-native-reanimated, gated by ReduceMotion.
 *
 * @module gamesV4/screens/battleship/CellMarkers
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { BattleshipTokens } from "./battleshipTheme";

interface MarkerProps {
  size: number;
  tokens: BattleshipTokens;
}

// =============================================================================
// MissMarker — Circle with dot (shape = circle)
// =============================================================================

export const MissMarker = React.memo(function MissMarker({
  size,
  tokens,
}: MarkerProps) {
  const dotSize = Math.max(6, size * 0.22);
  const ringSize = Math.max(12, size * 0.5);

  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.markerCenter, animStyle]}>
      {/* Outer ring */}
      <View
        style={[
          styles.missRing,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderColor: tokens.markerMissRing,
          },
        ]}
      />
      {/* Inner dot */}
      <View
        style={[
          styles.missDot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: tokens.markerMiss,
          },
        ]}
      />
    </Animated.View>
  );
});

// =============================================================================
// HitMarker — X-cross burst (shape = X)
// =============================================================================

export const HitMarker = React.memo(function HitMarker({
  size,
  tokens,
}: MarkerProps) {
  const scale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.3, {
        duration: 120,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, { damping: 8, stiffness: 180 }),
    );
    glowOpacity.value = withSequence(
      withTiming(0.7, { duration: 120 }),
      withTiming(0.25, { duration: 500 }),
    );
  }, [scale, glowOpacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const iconSize = Math.max(14, size * 0.55);

  return (
    <Animated.View style={[styles.markerCenter, animStyle]}>
      {/* Glow backdrop */}
      <Animated.View
        style={[
          styles.hitGlow,
          {
            width: size * 0.9,
            height: size * 0.9,
            borderRadius: size * 0.45,
            backgroundColor: tokens.markerHitGlow,
          },
          glowStyle,
        ]}
      />
      <MaterialCommunityIcons
        name="close-thick"
        size={iconSize}
        color={tokens.markerHit}
      />
    </Animated.View>
  );
});

// =============================================================================
// SunkMarker — Filled X with "SUNK" ribbon (shape = filled X + text)
// =============================================================================

export const SunkMarker = React.memo(function SunkMarker({
  size,
  tokens,
}: MarkerProps) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.4, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, { damping: 10, stiffness: 160 }),
    );
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconSize = Math.max(14, size * 0.5);
  // Only show "SUNK" text if cell is large enough
  const showLabel = size >= 28;

  return (
    <Animated.View style={[styles.markerCenter, animStyle]}>
      <View
        style={[
          styles.sunkBg,
          {
            width: size * 0.85,
            height: size * 0.85,
            borderRadius: 3,
            backgroundColor: tokens.markerSunk,
          },
        ]}
      />
      <MaterialCommunityIcons
        name="skull-crossbones"
        size={iconSize}
        color={tokens.markerSunkText}
      />
      {showLabel && (
        <Text
          style={[
            styles.sunkLabel,
            {
              color: tokens.markerSunkText,
              fontSize: Math.max(6, size * 0.18),
            },
          ]}
          numberOfLines={1}
        >
          SUNK
        </Text>
      )}
    </Animated.View>
  );
});

// =============================================================================
// SelectedMarker — Crosshair reticle with coordinate tooltip
// =============================================================================

interface SelectedMarkerProps extends MarkerProps {
  label?: string; // e.g., "E7"
}

export const SelectedMarker = React.memo(function SelectedMarker({
  size,
  tokens,
  label,
}: SelectedMarkerProps) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withSequence(
      withTiming(1.15, { duration: 250, reduceMotion: ReduceMotion.System }),
      withTiming(1.0, { duration: 250 }),
    );
  }, [pulse]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const iconSize = Math.max(16, size * 0.6);

  return (
    <Animated.View style={[styles.markerCenter, animStyle]}>
      <MaterialCommunityIcons
        name="crosshairs-gps"
        size={iconSize}
        color="#FFFFFF"
      />
      {label && size >= 26 && (
        <View
          style={[styles.coordBadge, { backgroundColor: tokens.cellSelected }]}
        >
          <Text style={styles.coordBadgeText}>{label}</Text>
        </View>
      )}
    </Animated.View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  markerCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  missRing: {
    position: "absolute",
    borderWidth: 1.5,
  },
  missDot: {
    position: "absolute",
  },
  hitGlow: {
    position: "absolute",
  },
  sunkBg: {
    position: "absolute",
    opacity: 0.85,
  },
  sunkLabel: {
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 1,
  },
  coordBadge: {
    position: "absolute",
    top: -10,
    right: -8,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
  },
  coordBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "700",
  },
});
