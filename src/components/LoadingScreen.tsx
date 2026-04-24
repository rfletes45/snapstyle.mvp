/**
 * LoadingScreen Component
 * Vibe branded loading UI during app hydration
 *
 * Shows a branded loading state while:
 * - Auth state is being determined
 * - User profile is being fetched
 * - Any critical data is loading
 *
 * This is the "splash" screen shown during app boot.
 * For inline loading states, use LoadingState from ui/
 */

import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { ActivityIndicator, useTheme } from "react-native-paper";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  logStartupEvent,
  logStartupMount,
  logStartupUnmount,
} from "@/utils/startupTrace";

export interface LoadingScreenProps {
  /** Optional message to show below spinner */
  message?: string;
  /** Show as full screen (default) or inline */
  fullScreen?: boolean;
  /** Diagnostic reason for startup/root loading breadcrumbs */
  diagnosticReason?: string;
  /** Extra safe diagnostic context */
  diagnosticData?: Record<string, unknown>;
}

export function LoadingScreen({
  message = "Just a moment...",
  fullScreen = true,
  diagnosticReason = "unspecified",
  diagnosticData,
}: LoadingScreenProps) {
  const theme = useTheme();

  React.useEffect(() => {
    logStartupMount("LoadingScreen", {
      message,
      fullScreen,
      diagnosticReason,
      ...(diagnosticData ?? {}),
    });

    return () => {
      logStartupUnmount("LoadingScreen", {
        message,
        diagnosticReason,
      });
    };
  }, []);

  React.useEffect(() => {
    logStartupEvent("LoadingScreen reason changed", {
      message,
      diagnosticReason,
      ...(diagnosticData ?? {}),
    });
  }, [diagnosticData, diagnosticReason, message]);

  return (
    <View
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <View style={styles.content}>
        {/* App logo - Vibe branded */}
        <View
          style={[
            styles.logoContainer,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <Text style={styles.logoText}>✨</Text>
        </View>

        <Text style={[styles.brandName, { color: theme.colors.primary }]}>
          Vibe
        </Text>

        <ActivityIndicator
          animating={true}
          size="large"
          color={theme.colors.primary}
          style={styles.spinner}
        />

        {message && (
          <Text
            style={[styles.message, { color: theme.colors.onSurfaceVariant }]}
          >
            {message}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreen: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xxl,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  logoText: {
    fontSize: 40,
  },
  brandName: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: Spacing.xl,
  },
  spinner: {
    marginBottom: Spacing.lg,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
  },
});

export default LoadingScreen;
