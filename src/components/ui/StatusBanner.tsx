/**
 * StatusBanner
 * Themed banner for status messages (success, warning, error, info)
 */

import React, { ReactNode } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Spacing, BorderRadius } from "../../../constants/theme";

type StatusType = "success" | "warning" | "error" | "info";
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface StatusBannerProps {
  /** Message to display */
  message: string;
  /** Type determines color scheme */
  type?: StatusType;
  /** Custom icon (optional) */
  icon?: IconName;
  /** Action button label */
  actionLabel?: string;
  /** Action press handler */
  onAction?: () => void;
  /** Dismiss handler (shows X button) */
  onDismiss?: () => void;
  /** Additional style */
  style?: StyleProp<ViewStyle>;
}

const TYPE_CONFIG: Record<
  StatusType,
  { icon: IconName; containerKey: string; textKey: string }
> = {
  success: {
    icon: "check-circle-outline",
    containerKey: "successContainer",
    textKey: "success",
  },
  warning: {
    icon: "alert-circle-outline",
    containerKey: "warningContainer",
    textKey: "warning",
  },
  error: {
    icon: "alert-octagon-outline",
    containerKey: "errorContainer",
    textKey: "error",
  },
  info: {
    icon: "information-outline",
    containerKey: "infoContainer",
    textKey: "info",
  },
};

// Color mapping for semantic colors not in Paper theme
const getSemanticColors = (type: StatusType, isDark: boolean) => {
  const colors = {
    success: {
      container: isDark ? "#2d4a2d" : "#e8f5e9",
      text: isDark ? "#a6e3a1" : "#40a02b",
    },
    warning: {
      container: isDark ? "#4a4428" : "#fff8e1",
      text: isDark ? "#f9e2af" : "#df8e1d",
    },
    error: {
      container: isDark ? "#4a2d2d" : "#ffebee",
      text: isDark ? "#f38ba8" : "#d20f39",
    },
    info: {
      container: isDark ? "#2d3d4a" : "#e3f2fd",
      text: isDark ? "#74c7ec" : "#209fb5",
    },
  };
  return colors[type];
};

export default function StatusBanner({
  message,
  type = "info",
  icon,
  actionLabel,
  onAction,
  onDismiss,
  style,
}: StatusBannerProps) {
  const theme = useTheme();
  const config = TYPE_CONFIG[type];
  const isDark = theme.dark;
  const semanticColors = getSemanticColors(type, isDark);
  const displayIcon = icon || config.icon;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: semanticColors.container },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name={displayIcon}
        size={20}
        color={semanticColors.text}
        style={styles.icon}
      />

      <Text
        variant="bodyMedium"
        style={[styles.message, { color: semanticColors.text }]}
      >
        {message}
      </Text>

      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={styles.actionButton}>
          <Text
            variant="labelMedium"
            style={[styles.actionText, { color: semanticColors.text }]}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}

      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <MaterialCommunityIcons
            name="close"
            size={18}
            color={semanticColors.text}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  message: {
    flex: 1,
    fontWeight: "500",
  },
  actionButton: {
    marginLeft: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  actionText: {
    fontWeight: "600",
  },
  dismissButton: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
});
