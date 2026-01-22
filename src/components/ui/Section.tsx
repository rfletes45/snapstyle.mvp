/**
 * Section
 * Grouped content section with optional header
 */

import React, { ReactNode } from "react";
import { StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { Spacing, BorderRadius } from "../../../constants/theme";

interface SectionProps {
  children: ReactNode;
  /** Section title */
  title?: string;
  /** Subtitle/description */
  subtitle?: string;
  /** Right accessory (e.g., "See All" link) */
  headerRight?: ReactNode;
  /** Variant affects background and spacing */
  variant?: "default" | "card" | "elevated";
  /** Additional style */
  style?: StyleProp<ViewStyle>;
  /** Content padding inside section */
  padding?: "none" | "sm" | "md" | "lg";
}

export default function Section({
  children,
  title,
  subtitle,
  headerRight,
  variant = "default",
  style,
  padding = "md",
}: SectionProps) {
  const theme = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case "card":
        return theme.colors.surface;
      case "elevated":
        return theme.colors.elevation.level2;
      default:
        return "transparent";
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

  const sectionStyle: ViewStyle = {
    backgroundColor: getBackgroundColor(),
    borderRadius: variant !== "default" ? BorderRadius.md : 0,
    padding: variant !== "default" ? getPadding() : 0,
  };

  const contentPadding: ViewStyle =
    variant === "default" ? { paddingHorizontal: getPadding() } : {};

  return (
    <View style={[styles.container, sectionStyle, style]}>
      {(title || headerRight) && (
        <View
          style={[
            styles.header,
            variant === "default" && { paddingHorizontal: getPadding() },
          ]}
        >
          <View style={styles.headerText}>
            {title && (
              <Text
                variant="titleMedium"
                style={[styles.title, { color: theme.colors.onBackground }]}
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                variant="bodySmall"
                style={[
                  styles.subtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
        </View>
      )}
      <View style={contentPadding}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: "600",
  },
  subtitle: {
    marginTop: 2,
  },
  headerRight: {
    marginLeft: Spacing.md,
  },
});
