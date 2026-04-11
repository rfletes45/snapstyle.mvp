/**
 * DateDivider — Centered day separator for chat timelines.
 *
 * Discord-inspired lightweight separator with horizontal lines flanking
 * a centered date label. Adapts to the current theme automatically.
 *
 * Used by both stacked and bubble chat modes.
 *
 * @module components/chat/DateDivider
 */

import { useAppTheme } from "@/store/ThemeContext";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export interface DateDividerProps {
  /** Human-readable date label, e.g. "March 24, 2026" or "Today" */
  label: string;
}

export const DateDivider: React.FC<DateDividerProps> = React.memo(
  ({ label }) => {
    const { colors } = useAppTheme();

    return (
      <View style={styles.container}>
        <View style={[styles.line, { backgroundColor: colors.divider }]} />
        <View style={[styles.labelBox, { backgroundColor: colors.background }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {label}
          </Text>
        </View>
        <View style={[styles.line, { backgroundColor: colors.divider }]} />
      </View>
    );
  },
);

DateDivider.displayName = "DateDivider";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 4,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  labelBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginHorizontal: 12,
  },
});

export default DateDivider;
