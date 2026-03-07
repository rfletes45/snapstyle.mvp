/**
 * PlayerChip — Compact player identity badge
 *
 * Shows a player's symbol/color + display name with an active/inactive
 * visual treatment. Used inside TurnStatusCard.
 *
 * Accessibility: never relies on color alone — always shows text label
 * and symbol alongside the color indicator.
 */

import { Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export interface PlayerChipProps {
  /** Display name (truncated automatically) */
  displayName: string;
  /** Mark label shown in the pip (e.g. "X", "O", "R", "Y") */
  markLabel: string;
  /** Color for the pip and active accent */
  markColor: string;
  /** Whether this player is the currently active turn player */
  isActive: boolean;
  /** Whether this is the local player */
  isLocal?: boolean;
  /** Optional profile picture URL — displayed in the pip when available */
  avatarUrl?: string | null;
}

export function PlayerChip({
  displayName,
  markLabel,
  markColor,
  isActive,
  isLocal,
  avatarUrl,
}: PlayerChipProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;

  const bgColor = isActive
    ? isDark
      ? "rgba(255,255,255,0.12)"
      : "rgba(0,0,0,0.07)"
    : "transparent";

  const borderColor = isActive
    ? markColor
    : isDark
      ? "rgba(255,255,255,0.08)"
      : "rgba(0,0,0,0.06)";

  const textColor = isActive
    ? isDark
      ? "#FFF"
      : "#111"
    : isDark
      ? "rgba(255,255,255,0.45)"
      : "rgba(0,0,0,0.4)";

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: isActive ? 1.5 : 1,
        },
      ]}
    >
      {/* Color pip — avatar image or mark letter */}
      <View style={[styles.pip, { backgroundColor: markColor }]}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.pipAvatar}
            accessibilityLabel={`${displayName} avatar`}
          />
        ) : (
          <Text style={styles.pipText}>{markLabel}</Text>
        )}
      </View>

      {/* Name + "you" badge */}
      <Text
        style={[styles.name, { color: textColor }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {displayName}
      </Text>

      {isLocal && (
        <Text style={[styles.youBadge, { color: textColor, opacity: 0.6 }]}>
          you
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: Spacing.xs,
    maxWidth: 160,
  },
  pip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  pipText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  pipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  name: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  youBadge: {
    fontSize: 10,
    fontWeight: "500",
    fontStyle: "italic",
  },
});
