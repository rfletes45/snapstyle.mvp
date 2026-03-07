/**
 * BoardTray — Framed container/surface for game boards
 *
 * Provides a consistent visual wrapper that makes boards feel elevated
 * and intentionally framed rather than flat debug grids.
 *
 * Supports optional background color overrides for games that need
 * a specific board surface (e.g. Connect Four's blue board).
 */

import { Elevation, Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

export interface BoardTrayProps {
  children: React.ReactNode;
  /** Override the tray background (e.g. blue for Connect Four) */
  backgroundColor?: string;
  /** Additional style overrides */
  style?: ViewStyle;
  /** Inner padding (default: Spacing.md) */
  padding?: number;
}

export function BoardTray({
  children,
  backgroundColor,
  style,
  padding,
}: BoardTrayProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;

  const trayBg =
    backgroundColor ??
    (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.025)");

  return (
    <View
      style={[
        styles.tray,
        {
          backgroundColor: trayBg,
          ...(isDark ? Elevation.lg : Elevation.md),
        },
        padding !== undefined && { padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    borderRadius: 16,
    padding: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
