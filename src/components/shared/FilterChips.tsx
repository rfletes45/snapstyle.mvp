/**
 * FilterChips — Shared horizontal filter chips component
 *
 * Used by both Messages (InboxTabs) and Calls screens for visual consistency.
 * Pill-style tabs with subtle active state matching the app theme.
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import React, { memo, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export interface FilterChipOption<K extends string = string> {
  key: K;
  label: string;
}

interface FilterChipsProps<K extends string = string> {
  options: FilterChipOption<K>[];
  activeKey: K;
  onSelect: (key: K) => void;
}

function FilterChipsInner<K extends string = string>({
  options,
  activeKey,
  onSelect,
}: FilterChipsProps<K>) {
  const { colors, isDark } = useAppTheme();
  const inactiveTabBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

  const handlePress = useCallback(
    (key: K) => {
      onSelect(key);
    },
    [onSelect],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {options.map((option) => {
          const isActive = activeKey === option.key;

          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive
                    ? colors.primary + "18"
                    : inactiveTabBg,
                  borderColor: isActive ? colors.primary + "40" : "transparent",
                },
              ]}
              onPress={() => handlePress(option.key)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${option.label} filter`}
            >
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive ? "600" : "500",
                  },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export const FilterChips = memo(FilterChipsInner) as typeof FilterChipsInner;

const styles = StyleSheet.create({
  container: {
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  chipLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
});
