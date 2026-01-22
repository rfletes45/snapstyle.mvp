/**
 * ListRow
 * Standard list item row with leading icon/avatar, title, subtitle, and trailing content
 */

import React, { ReactNode } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Text, useTheme, ActivityIndicator } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Spacing, BorderRadius } from "../../../constants/theme";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface ListRowProps {
  /** Title text */
  title: string;
  /** Subtitle text */
  subtitle?: string;
  /** Leading icon name (MaterialCommunityIcons) */
  leadingIcon?: IconName;
  /** Leading custom element (overrides leadingIcon) */
  leading?: ReactNode;
  /** Trailing icon name or custom element */
  trailingIcon?: IconName;
  /** Trailing custom element (overrides trailingIcon) */
  trailing?: ReactNode;
  /** Show chevron on the right */
  showChevron?: boolean;
  /** Press handler */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Is this row disabled */
  disabled?: boolean;
  /** Is this row in a loading state */
  loading?: boolean;
  /** Show divider below row */
  divider?: boolean;
  /** Variant: default, danger, success */
  variant?: "default" | "danger" | "success" | "muted";
  /** Additional style */
  style?: StyleProp<ViewStyle>;
}

export default function ListRow({
  title,
  subtitle,
  leadingIcon,
  leading,
  trailingIcon,
  trailing,
  showChevron = false,
  onPress,
  onLongPress,
  disabled = false,
  loading = false,
  divider = false,
  variant = "default",
  style,
}: ListRowProps) {
  const theme = useTheme();

  const getTextColor = () => {
    if (disabled) return theme.colors.onSurfaceVariant;
    switch (variant) {
      case "danger":
        return theme.colors.error;
      case "success":
        return theme.colors.primary;
      case "muted":
        return theme.colors.onSurfaceVariant;
      default:
        return theme.colors.onSurface;
    }
  };

  const getIconColor = () => {
    if (disabled) return theme.colors.onSurfaceVariant;
    switch (variant) {
      case "danger":
        return theme.colors.error;
      case "success":
        return theme.colors.primary;
      case "muted":
        return theme.colors.onSurfaceVariant;
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  const renderLeading = () => {
    if (leading) return leading;
    if (leadingIcon) {
      return (
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <MaterialCommunityIcons
            name={leadingIcon}
            size={22}
            color={getIconColor()}
          />
        </View>
      );
    }
    return null;
  };

  const renderTrailing = () => {
    if (loading) {
      return <ActivityIndicator size="small" color={theme.colors.primary} />;
    }
    if (trailing) return trailing;
    if (trailingIcon) {
      return (
        <MaterialCommunityIcons
          name={trailingIcon}
          size={22}
          color={getIconColor()}
        />
      );
    }
    if (showChevron) {
      return (
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={theme.colors.onSurfaceVariant}
        />
      );
    }
    return null;
  };

  const content = (
    <View style={styles.inner}>
      {renderLeading() && (
        <View style={styles.leadingContainer}>{renderLeading()}</View>
      )}

      <View style={styles.content}>
        <Text
          variant="bodyLarge"
          style={[styles.title, { color: getTextColor() }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            variant="bodySmall"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {renderTrailing() && (
        <View style={styles.trailingContainer}>{renderTrailing()}</View>
      )}
    </View>
  );

  const rowStyle: StyleProp<ViewStyle> = [
    styles.container,
    { backgroundColor: theme.colors.surface },
    divider
      ? {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.outlineVariant,
        }
      : undefined,
    disabled ? styles.disabled : undefined,
    style,
  ];

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        style={rowStyle}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled || loading}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    justifyContent: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  leadingContainer: {
    marginRight: Spacing.lg,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontWeight: "500",
  },
  subtitle: {
    marginTop: 2,
  },
  trailingContainer: {
    marginLeft: Spacing.md,
  },
  disabled: {
    opacity: 0.5,
  },
});
