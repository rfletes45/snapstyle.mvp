/**
 * Divider
 * Themed horizontal divider line
 */

import React from "react";
import { StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "react-native-paper";
import { Spacing } from "../../../constants/theme";

interface DividerProps {
  /** Variant: full width or with horizontal margins */
  variant?: "full" | "inset" | "middle";
  /** Vertical spacing around divider */
  spacing?: "none" | "sm" | "md" | "lg";
  /** Additional style */
  style?: StyleProp<ViewStyle>;
}

export default function Divider({
  variant = "full",
  spacing = "none",
  style,
}: DividerProps) {
  const theme = useTheme();

  const getMargins = (): ViewStyle => {
    switch (variant) {
      case "inset":
        return { marginLeft: 56 + Spacing.lg }; // After leading icon
      case "middle":
        return { marginHorizontal: Spacing.lg };
      default:
        return {};
    }
  };

  const getSpacing = (): ViewStyle => {
    switch (spacing) {
      case "sm":
        return { marginVertical: Spacing.sm };
      case "md":
        return { marginVertical: Spacing.md };
      case "lg":
        return { marginVertical: Spacing.lg };
      default:
        return {};
    }
  };

  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: theme.colors.outlineVariant },
        getMargins(),
        getSpacing(),
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
