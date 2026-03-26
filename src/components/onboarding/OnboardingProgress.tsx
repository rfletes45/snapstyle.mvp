/**
 * OnboardingProgress
 *
 * Compact, mobile-friendly step indicator for the multi-step signup flow.
 * Shows step dots with the current step highlighted and a text label.
 */

import { Spacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  /** Current step (1-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Optional label for the current step */
  label?: string;
}

export default function OnboardingProgress({
  currentStep,
  totalSteps,
  label,
}: Props) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepIndex = i + 1;
          const isCompleted = stepIndex < currentStep;
          const isCurrent = stepIndex === currentStep;

          return (
            <View
              key={stepIndex}
              style={[
                styles.dot,
                {
                  backgroundColor: isCompleted
                    ? theme.colors.primary
                    : isCurrent
                      ? theme.colors.primary
                      : theme.colors.outlineVariant,
                  opacity: isCompleted ? 0.5 : 1,
                  width: isCurrent ? 24 : 8,
                },
              ]}
            />
          );
        })}
      </View>
      {label && (
        <Text
          variant="labelSmall"
          style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
