/**
 * OnboardingDisplayStyleScreen — Step 5 of signup (post-auth)
 *
 * Personalization step: chat layout + appearance mode selection.
 * - Chat Layout: Bubbles / Stacked
 * - Appearance: Light / Dark / Auto
 * Both have visual preview cards. Sensible defaults so the user can continue
 * quickly. Chosen settings persist after onboarding.
 */

import { ConversationDisplayMode } from "@/chat/displayMode";
import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useOnboarding } from "@/store/OnboardingContext";
import type { ThemeMode } from "@/store/ThemeContext";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Display style data
// ---------------------------------------------------------------------------

interface DisplayStyleOption {
  mode: ConversationDisplayMode;
  label: string;
  description: string;
  icon: "chat" | "format-list-text";
  previewLines: { text: string; isMine: boolean }[];
}

const DISPLAY_STYLES: DisplayStyleOption[] = [
  {
    mode: "bubbles",
    label: "Bubbles",
    description: "Classic chat bubbles",
    icon: "chat",
    previewLines: [
      { text: "Hey, what's up?", isMine: false },
      { text: "Not much, you?", isMine: true },
      { text: "Let's hang out!", isMine: false },
    ],
  },
  {
    mode: "stacked",
    label: "Stacked",
    description: "Compact & dense view",
    icon: "format-list-text",
    previewLines: [
      { text: "Hey, what's up?", isMine: false },
      { text: "Not much, you?", isMine: true },
      { text: "Let's hang out!", isMine: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// Appearance mode data
// ---------------------------------------------------------------------------

interface AppearanceOption {
  mode: ThemeMode;
  label: string;
  description: string;
  icon: "white-balance-sunny" | "weather-night" | "theme-light-dark";
}

const APPEARANCE_OPTIONS: AppearanceOption[] = [
  {
    mode: "light",
    label: "Light",
    description: "Always light background",
    icon: "white-balance-sunny",
  },
  {
    mode: "dark",
    label: "Dark",
    description: "Always dark background",
    icon: "weather-night",
  },
  {
    mode: "auto",
    label: "Auto",
    description: "Matches your device appearance",
    icon: "theme-light-dark",
  },
];

const TOTAL_STEPS = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingDisplayStyleScreen({ navigation }: any) {
  const theme = useTheme();
  const { setThemeMode: applyThemeMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const {
    displayMode,
    setDisplayMode,
    themeMode,
    setThemeMode: setOnboardingThemeMode,
  } = useOnboarding();

  const handleThemeModeChange = (mode: ThemeMode) => {
    setOnboardingThemeMode(mode);
    // Apply immediately so the user sees the preview
    applyThemeMode(mode);
  };

  // ── Chat layout card ──────────────────────────────────────────────────
  const renderDisplayCard = (option: DisplayStyleOption) => {
    const isSelected = displayMode === option.mode;
    return (
      <Pressable
        key={option.mode}
        onPress={() => setDisplayMode(option.mode)}
        style={[
          styles.card,
          {
            borderColor: isSelected
              ? theme.colors.primary
              : theme.colors.outlineVariant,
            backgroundColor: isSelected
              ? theme.colors.primaryContainer
              : theme.colors.surface,
          },
        ]}
      >
        {/* Chat preview */}
        <View
          style={[
            styles.previewBox,
            {
              backgroundColor: theme.dark
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.03)",
            },
          ]}
        >
          {option.previewLines.map((line, i) => {
            if (option.mode === "bubbles") {
              return (
                <View
                  key={i}
                  style={[
                    styles.previewBubble,
                    line.isMine
                      ? {
                          alignSelf: "flex-end",
                          backgroundColor: theme.colors.primary,
                        }
                      : {
                          alignSelf: "flex-start",
                          backgroundColor: theme.colors.surfaceVariant,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.previewText,
                      { color: line.isMine ? "#fff" : theme.colors.onSurface },
                    ]}
                    numberOfLines={1}
                  >
                    {line.text}
                  </Text>
                </View>
              );
            }
            // stacked
            return (
              <View key={i} style={styles.previewStacked}>
                <View
                  style={[
                    styles.previewDot,
                    {
                      backgroundColor: line.isMine
                        ? theme.colors.primary
                        : theme.colors.surfaceVariant,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.previewText,
                    { color: theme.colors.onSurface },
                  ]}
                  numberOfLines={1}
                >
                  {line.text}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Label row */}
        <View style={styles.labelRow}>
          <MaterialCommunityIcons
            name={option.icon}
            size={18}
            color={
              isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.cardLabel,
                {
                  color: isSelected
                    ? theme.colors.primary
                    : theme.colors.onSurface,
                },
              ]}
            >
              {option.label}
            </Text>
            <Text
              style={[
                styles.cardDesc,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {option.description}
            </Text>
          </View>
          {isSelected && (
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color={theme.colors.primary}
            />
          )}
          {!isSelected && <View style={{ width: 20, height: 20 }} />}
        </View>
      </Pressable>
    );
  };

  // ── Appearance mode chip ──────────────────────────────────────────────
  const renderAppearanceOption = (option: AppearanceOption) => {
    const isSelected = themeMode === option.mode;
    return (
      <Pressable
        key={option.mode}
        onPress={() => handleThemeModeChange(option.mode)}
        style={[
          styles.appearanceCard,
          {
            borderColor: isSelected
              ? theme.colors.primary
              : theme.colors.outlineVariant,
            backgroundColor: isSelected
              ? theme.colors.primaryContainer
              : theme.colors.surface,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={option.icon}
          size={24}
          color={
            isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant
          }
        />
        <Text
          style={[
            styles.appearanceLabel,
            {
              color: isSelected ? theme.colors.primary : theme.colors.onSurface,
            },
          ]}
        >
          {option.label}
        </Text>
        <Text
          style={[
            styles.appearanceDesc,
            { color: theme.colors.onSurfaceVariant },
          ]}
          numberOfLines={2}
        >
          {option.description}
        </Text>
        {isSelected && (
          <MaterialCommunityIcons
            name="check-circle"
            size={18}
            color={theme.colors.primary}
            style={styles.appearanceCheck}
          />
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.colors.onBackground}
          />
        </Pressable>
      </View>

      <OnboardingProgress
        currentStep={5}
        totalSteps={TOTAL_STEPS}
        label="Step 5 of 5"
      />

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.onBackground }]}
          >
            Personalize your experience
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            You can change these anytime in settings
          </Text>

          {/* Section 1: Chat Layout */}
          <Text
            variant="titleSmall"
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            CHAT LAYOUT
          </Text>
          <View style={styles.cards}>
            {DISPLAY_STYLES.map(renderDisplayCard)}
          </View>

          {/* Section 2: Appearance */}
          <Text
            variant="titleSmall"
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant, marginTop: Spacing.xxl },
            ]}
          >
            APPEARANCE
          </Text>
          <View style={styles.appearanceRow}>
            {APPEARANCE_OPTIONS.map(renderAppearanceOption)}
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}
      >
        <Button
          mode="contained"
          onPress={() => navigation.navigate("OnboardingComplete")}
          style={styles.ctaBtn}
          contentStyle={styles.ctaBtnContent}
          labelStyle={styles.ctaLabel}
        >
          Finish Setup
        </Button>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: Spacing.lg,
    alignItems: "flex-start",
  },
  backBtn: {
    padding: 8,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.lg,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  title: {
    fontWeight: "bold",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
  },
  cards: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  previewBox: {
    padding: 10,
    gap: 5,
    minHeight: 80,
    justifyContent: "center",
  },
  previewBubble: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    maxWidth: "82%",
  },
  previewStacked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  previewDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  previewText: {
    fontSize: 10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  cardDesc: {
    fontSize: 11,
  },
  // Appearance cards
  appearanceRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  appearanceCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    minHeight: 100,
    justifyContent: "center",
  },
  appearanceLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
  },
  appearanceDesc: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
    lineHeight: 13,
  },
  appearanceCheck: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  bottomSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  ctaBtn: {
    borderRadius: BorderRadius.md,
  },
  ctaBtnContent: {
    paddingVertical: 6,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});
