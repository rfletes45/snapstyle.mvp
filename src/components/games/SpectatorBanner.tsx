/**
 * SpectatorBanner — Full-width banner shown to spectators
 *
 * Displays "Watching" text, spectator count, and a leave button.
 * Positioned at the top of the game screen when the user is spectating.
 *
 * @see docs/SPECTATOR_SYSTEM_PLAN.md §4.2
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

interface SpectatorBannerProps {
  /** Number of spectators watching */
  spectatorCount: number;
  /** Called when the user taps "Leave" */
  onLeave: () => void;
  /** Optional: show host name (for SP spectating) */
  hostName?: string;
}

// =============================================================================
// Component
// =============================================================================

export function SpectatorBanner({
  spectatorCount,
  onLeave,
  hostName,
}: SpectatorBannerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.primaryContainer,
          paddingTop: Math.max(insets.top, Spacing.sm),
        },
      ]}
    >
      <View style={styles.content}>
        {/* Left: Eye icon + watching text */}
        <View style={styles.leftSection}>
          <MaterialCommunityIcons
            name="eye"
            size={18}
            color={theme.colors.onPrimaryContainer}
          />
          <Text
            variant="labelLarge"
            style={[
              styles.watchingText,
              { color: theme.colors.onPrimaryContainer },
            ]}
          >
            {hostName ? `Watching ${hostName}` : "Watching"}
          </Text>
        </View>

        {/* Center: Spectator count */}
        <View style={styles.centerSection}>
          <MaterialCommunityIcons
            name="account-group"
            size={16}
            color={theme.colors.onPrimaryContainer}
            style={styles.countIcon}
          />
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onPrimaryContainer }}
          >
            {spectatorCount} {spectatorCount === 1 ? "viewer" : "viewers"}
          </Text>
        </View>

        {/* Right: Leave button */}
        <TouchableOpacity
          onPress={onLeave}
          style={[
            styles.leaveButton,
            { backgroundColor: theme.colors.errorContainer },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name="close"
            size={14}
            color={theme.colors.onErrorContainer}
          />
          <Text
            variant="labelSmall"
            style={[styles.leaveText, { color: theme.colors.onErrorContainer }]}
          >
            Leave
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    zIndex: 100,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  watchingText: {
    fontWeight: "600",
  },
  centerSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  countIcon: {
    marginRight: 4,
  },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  leaveText: {
    fontWeight: "600",
  },
});
