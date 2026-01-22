/**
 * WelcomeScreen
 * Vibe branded entry point for unauthenticated users
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { Button, Title, Paragraph, useTheme } from "react-native-paper";
import { Spacing, BorderRadius } from "../../../constants/theme";

export default function WelcomeScreen({ navigation }: any) {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        {/* Brand Logo Area */}
        <View
          style={[
            styles.logoContainer,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <Title style={[styles.logoEmoji]}>✨</Title>
        </View>

        <Title style={[styles.title, { color: theme.colors.primary }]}>
          Vibe
        </Title>
        <Paragraph
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Moments • Connections • Play
        </Paragraph>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate("Signup")}
            style={styles.button}
          >
            Get Started
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("Login")}
            style={styles.button}
          >
            Sign In
          </Button>
        </View>

        <Paragraph
          style={[styles.tagline, { color: theme.colors.onSurfaceVariant }]}
        >
          Share moments, build connections
        </Paragraph>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: Spacing.xl,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.xxl,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  logoEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: Spacing.xxl,
  },
  buttonContainer: {
    width: "100%",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  button: {
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  tagline: {
    fontSize: 12,
    fontStyle: "italic",
  },
});
