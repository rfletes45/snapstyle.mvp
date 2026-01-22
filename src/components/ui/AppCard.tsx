/**
 * AppCard
 * Themed card wrapper with variants for different contexts
 */

import React, { ReactNode } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from "react-native";
import { useTheme } from "react-native-paper";
import { Spacing, BorderRadius, Elevation } from "../../../constants/theme";

interface AppCardProps {
  children: ReactNode;
  /** Card variant */
  variant?: "default" | "outlined" | "elevated" | "connection" | "request";
  /** Press handler */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional style */
  style?: StyleProp<ViewStyle>;
  /** Padding inside card */
  padding?: "none" | "sm" | "md" | "lg";
}

export default function AppCard({
  children,
  variant = "default",
  onPress,
  onLongPress,
  disabled = false,
  style,
  padding = "md",
}: AppCardProps) {
  const theme = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case "outlined":
        return "transparent";
      case "elevated":
        return theme.colors.elevation.level2;
      case "connection":
        return theme.colors.primaryContainer;
      case "request":
        return theme.colors.secondaryContainer;
      default:
        return theme.colors.surface;
    }
  };

  const getBorderStyle = (): ViewStyle => {
    switch (variant) {
      case "outlined":
        return {
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        };
      case "connection":
        return {
          borderWidth: 1,
          borderColor: theme.colors.primary,
        };
      case "request":
        return {
          borderWidth: 1,
          borderColor: theme.colors.secondary,
        };
      default:
        return {};
    }
  };

  const getPadding = () => {
    switch (padding) {
      case "none":
        return 0;
      case "sm":
        return Spacing.sm;
      case "lg":
        return Spacing.lg;
      default:
        return Spacing.md;
    }
  };

  const cardStyle: ViewStyle = {
    backgroundColor: getBackgroundColor(),
    borderRadius: BorderRadius.md,
    padding: getPadding(),
    ...getBorderStyle(),
    ...(variant === "elevated" ? Elevation.md : {}),
  };

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        style={[styles.card, cardStyle, disabled && styles.disabled, style]}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, cardStyle, disabled && styles.disabled, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
  },
  disabled: {
    opacity: 0.5,
  },
});
