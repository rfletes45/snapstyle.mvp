/**
 * ErrorState Component
 * Vibe Design System - Consistent error states
 * Rebranded copy: "Couldn't load that. Tap to try again."
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, Button, Icon, useTheme } from "react-native-paper";
import { Spacing, BorderRadius } from "../../../constants/theme";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({
  title = "Couldn't load that",
  message = "Something went wrong. Please try again.",
  onRetry,
  retryLabel = "Try Again",
}: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: theme.colors.errorContainer },
        ]}
      >
        <Icon
          source="alert-circle-outline"
          size={48}
          color={theme.colors.error}
        />
      </View>
      <Text
        variant="titleMedium"
        style={[styles.title, { color: theme.colors.onBackground }]}
      >
        {title}
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.message, { color: theme.colors.onSurfaceVariant }]}
      >
        {message}
      </Text>
      {onRetry && (
        <Button mode="contained" onPress={onRetry} style={styles.retryButton}>
          {retryLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    textAlign: "center",
    maxWidth: 280,
  },
  retryButton: {
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
});
