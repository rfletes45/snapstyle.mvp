/**
 * WelcomeScreen
 * Vibe branded entry point for unauthenticated users.
 *
 * Features:
 * - App branding with logo, tagline, and value propositions
 * - "Get Started" → Signup flow
 * - "Sign In" → Login flow
 * - "Continue with Google" → OAuth (UI-ready, pending SDK)
 * - Feature highlights carousel showing app value
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { BorderRadius, Spacing } from "../../../constants/theme";

// Feature highlights shown below the CTA buttons
const FEATURES = [
  {
    icon: "message-text-outline" as const,
    title: "Chat & Connect",
    desc: "Message friends, create group chats, and share moments",
  },
  {
    icon: "gamepad-variant-outline" as const,
    title: "Play Games",
    desc: "Challenge friends to 10+ built-in games",
  },
  {
    icon: "account-group-outline" as const,
    title: "Build Your Vibe",
    desc: "Customize your avatar, earn badges, and climb leaderboards",
  },
] as const;

export default function WelcomeScreen({ navigation }: any) {
  const theme = useTheme();

  const handleGoogleSignIn = () => {
    // TODO: Will be implemented when @react-native-google-signin/google-signin is integrated
    // For now, direct users to the email sign-up flow
    navigation.navigate("Signup");
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        {/* ── Hero Section ── */}
        <View style={styles.heroSection}>
          {/* Brand Logo */}
          <View
            style={[
              styles.logoContainer,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Text style={styles.logoEmoji}>✨</Text>
          </View>

          <Text
            variant="displayMedium"
            style={[styles.appName, { color: theme.colors.primary }]}
          >
            Vibe
          </Text>

          <Text
            variant="bodyLarge"
            style={[styles.tagline, { color: theme.colors.onSurfaceVariant }]}
          >
            Moments • Connections • Play
          </Text>
        </View>

        {/* ── CTA Buttons ── */}
        <View style={styles.ctaSection}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate("Signup")}
            style={styles.primaryBtn}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
          >
            Get Started
          </Button>

          <Button
            mode="outlined"
            onPress={() => navigation.navigate("Login")}
            style={styles.outlinedBtn}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
          >
            Sign In
          </Button>

          {/* OR Divider */}
          <View style={styles.dividerRow}>
            <View
              style={[
                styles.dividerLine,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              OR
            </Text>
            <View
              style={[
                styles.dividerLine,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />
          </View>

          {/* Google Button */}
          <Button
            mode="outlined"
            onPress={handleGoogleSignIn}
            style={styles.googleBtn}
            contentStyle={styles.btnContent}
            icon={({ size }) => (
              <MaterialCommunityIcons
                name="google"
                size={size}
                color={theme.colors.onBackground}
              />
            )}
            textColor={theme.colors.onBackground}
          >
            Continue with Google
          </Button>
        </View>

        {/* ── Feature Highlights ── */}
        <View style={styles.featuresSection}>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View
                style={[
                  styles.featureIconContainer,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <MaterialCommunityIcons
                  name={feature.icon}
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.featureTextContainer}>
                <Text
                  variant="titleSmall"
                  style={{ color: theme.colors.onBackground }}
                >
                  {feature.title}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    lineHeight: 18,
                  }}
                >
                  {feature.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Footer ── */}
        <Text
          variant="bodySmall"
          style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}
        >
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === "ios" ? 80 : 60,
    paddingBottom: Spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 420,
    alignSelf: "center",
    width: "100%",
  },

  // ── Hero ──
  heroSection: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  logoEmoji: {
    fontSize: 48,
  },
  appName: {
    fontWeight: "bold",
    marginBottom: Spacing.xs,
  },
  tagline: {
    letterSpacing: 1,
  },

  // ── CTA ──
  ctaSection: {
    width: "100%",
    marginBottom: Spacing.xxl,
  },
  primaryBtn: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  outlinedBtn: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  googleBtn: {
    borderRadius: BorderRadius.md,
  },
  btnContent: {
    paddingVertical: 6,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },

  // ── Features ──
  featuresSection: {
    width: "100%",
    gap: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  featureTextContainer: {
    flex: 1,
    gap: 2,
  },

  // ── Footer ──
  footer: {
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: Spacing.lg,
  },
});
