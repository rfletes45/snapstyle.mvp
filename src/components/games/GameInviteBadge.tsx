/**
 * GameInviteBadge Component
 *
 * Displays a small numeric badge for pending game invite counts.
 * Extracted from the deprecated GameInviteCard component.
 *
 * @see src/screens/games/GamesHubScreen.tsx
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useColors } from "@/store/ThemeContext";

interface GameInviteBadgeProps {
  count: number;
}

export function GameInviteBadge({ count }: GameInviteBadgeProps) {
  const theme = useTheme();
  const colors = useColors();

  if (count === 0) return null;

  return (
    <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
      <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
});
