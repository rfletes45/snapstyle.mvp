/**
 * SectionHeader — Reusable section header for Add Friends screen
 */

import { Spacing } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface SectionHeaderProps {
  title: string;
  count?: number;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

export default React.memo(function SectionHeader({
  title,
  count,
  icon,
  actionLabel,
  onAction,
  collapsed,
  onToggle,
}: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.left}
        onPress={onToggle}
        disabled={!onToggle}
        activeOpacity={onToggle ? 0.7 : 1}
        accessibilityRole={onToggle ? "button" : "header"}
        accessibilityLabel={`${title}${count != null ? `, ${count}` : ""}`}
      >
        {icon && (
          <MaterialCommunityIcons
            name={icon as any}
            size={18}
            color={colors.onSurfaceVariant}
            style={styles.icon}
          />
        )}
        <Text
          variant="labelLarge"
          style={[styles.title, { color: colors.onSurfaceVariant }]}
        >
          {title}
        </Text>
        {count != null && count > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        )}
        {onToggle && (
          <MaterialCommunityIcons
            name={collapsed ? "chevron-down" : "chevron-up"}
            size={18}
            color={colors.onSurfaceVariant}
            style={{ marginLeft: 4 }}
          />
        )}
      </TouchableOpacity>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text
            variant="labelMedium"
            style={[styles.action, { color: colors.primary }]}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  icon: {
    marginRight: 6,
  },
  title: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 12,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  action: {
    fontWeight: "600",
    fontSize: 12,
  },
});
