/**
 * SpectatorOverlay — Floating spectator count badge
 *
 * A small, non-intrusive badge that shows the number of spectators.
 * Used on game screens for players (not spectators) to see who's watching.
 * Can be positioned anywhere on the screen.
 *
 * @see docs/SPECTATOR_SYSTEM_PLAN.md §4.2
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import type { SpectatorInfo } from "@/hooks/useSpectator";
import { BorderRadius, Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

interface SpectatorOverlayProps {
  /** Number of spectators watching */
  spectatorCount: number;
  /** List of spectators (for tooltip / expansion in future) */
  spectators?: SpectatorInfo[];
  /** Position on screen */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

// =============================================================================
// Component
// =============================================================================

export function SpectatorOverlay({
  spectatorCount,
  position = "top-right",
}: SpectatorOverlayProps) {
  const theme = useTheme();

  if (spectatorCount <= 0) return null;

  const positionStyle = getPositionStyle(position);

  return (
    <View
      style={[
        styles.container,
        positionStyle,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      <MaterialCommunityIcons
        name="eye"
        size={14}
        color={theme.colors.onSurfaceVariant}
      />
      <Text
        variant="labelSmall"
        style={[styles.countText, { color: theme.colors.onSurfaceVariant }]}
      >
        {spectatorCount}
      </Text>
    </View>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getPositionStyle(
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left",
) {
  switch (position) {
    case "top-right":
      return { top: Spacing.sm, right: Spacing.sm };
    case "top-left":
      return { top: Spacing.sm, left: Spacing.sm };
    case "bottom-right":
      return { bottom: Spacing.sm, right: Spacing.sm };
    case "bottom-left":
      return { bottom: Spacing.sm, left: Spacing.sm };
  }
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
    opacity: 0.85,
    zIndex: 50,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  countText: {
    fontWeight: "600",
  },
});
