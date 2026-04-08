/**
 * ContactsOnboardingCard — First-run contacts-access module for Messages.
 *
 * Renders one of four variants depending on state:
 *  - prominent: large, dominant card for new users with no chats
 *  - compact: smaller header card for users who have chats or after cooldown
 *  - limited: iOS 18 limited-access follow-up ("expand access" nudge)
 *  - denied: soft "Open Settings" nudge
 *
 * All variants respect the app theme and feel native.
 *
 * @module components/chat/inbox/ContactsOnboardingCard
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import type { OnboardingCardVariant } from "@/hooks/useContactsOnboarding";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ContactsOnboardingCardProps {
  variant: OnboardingCardVariant;
  loading?: boolean;
  onEnable: () => void;
  onDismiss: () => void;
  onOpenSettings: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ContactsOnboardingCard = memo(function ContactsOnboardingCard({
  variant,
  loading = false,
  onEnable,
  onDismiss,
  onOpenSettings,
}: ContactsOnboardingCardProps) {
  const { colors } = useTheme();

  if (variant === "hidden") return null;

  // ── Prominent (large, empty-inbox dominant) ─────────────────

  if (variant === "prominent") {
    return (
      <View
        style={[
          styles.prominentCard,
          { backgroundColor: colors.surface },
          platformShadow,
        ]}
      >
        {/* Icon */}
        <View
          style={[
            styles.prominentIconCircle,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <MaterialCommunityIcons
            name="account-group-outline"
            size={44}
            color={colors.onPrimaryContainer}
          />
        </View>

        {/* Title */}
        <Text
          variant="headlineSmall"
          style={[styles.prominentTitle, { color: colors.onSurface }]}
        >
          Find your friends
        </Text>

        {/* Description */}
        <Text
          variant="bodyMedium"
          style={[styles.prominentBody, { color: colors.onSurfaceVariant }]}
        >
          See who&apos;s already here by checking your contacts.{"\n"}
          Your info stays private — never stored or shared.
        </Text>

        {/* Privacy reassurance */}
        <View
          style={[
            styles.privacyRow,
            { backgroundColor: colors.surfaceVariant },
          ]}
        >
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={16}
            color={colors.primary}
          />
          <Text
            variant="labelSmall"
            style={[styles.privacyText, { color: colors.onSurfaceVariant }]}
          >
            {Platform.OS === "ios"
              ? "You choose which contacts to share"
              : "Contacts are only used for matching"}
          </Text>
        </View>

        {/* Primary CTA */}
        <Button
          mode="contained"
          onPress={onEnable}
          loading={loading}
          disabled={loading}
          style={styles.prominentCta}
          contentStyle={styles.ctaContent}
          labelStyle={styles.ctaLabel}
          icon="contacts-outline"
        >
          Enable Contacts
        </Button>

        {/* Secondary */}
        <Button
          mode="text"
          onPress={onDismiss}
          textColor={colors.onSurfaceVariant}
          compact
          style={styles.skipBtn}
        >
          Maybe later
        </Button>
      </View>
    );
  }

  // ── Compact (above chat list) ───────────────────────────────

  if (variant === "compact") {
    return (
      <View
        style={[
          styles.compactCard,
          { backgroundColor: colors.surface },
          platformShadow,
        ]}
      >
        <View
          style={[
            styles.compactIconCircle,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <MaterialCommunityIcons
            name="account-group-outline"
            size={24}
            color={colors.onPrimaryContainer}
          />
        </View>

        <View style={styles.compactContent}>
          <Text
            variant="titleSmall"
            style={[styles.compactTitle, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            Find friends from contacts
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: colors.onSurfaceVariant }}
            numberOfLines={1}
          >
            See who&apos;s already on SnapStyle
          </Text>
        </View>

        <View style={styles.compactActions}>
          <Button
            mode="contained"
            onPress={onEnable}
            loading={loading}
            disabled={loading}
            compact
            labelStyle={{ fontSize: 13 }}
          >
            Enable
          </Button>
          <Button
            mode="text"
            onPress={onDismiss}
            textColor={colors.onSurfaceVariant}
            compact
            labelStyle={{ fontSize: 12 }}
          >
            Skip
          </Button>
        </View>
      </View>
    );
  }

  // ── Limited access (iOS 18+ follow-up) ──────────────────────

  if (variant === "limited") {
    return (
      <View
        style={[
          styles.compactCard,
          { backgroundColor: colors.surface },
          platformShadow,
        ]}
      >
        <View
          style={[
            styles.compactIconCircle,
            {
              backgroundColor:
                colors.tertiaryContainer ?? colors.surfaceVariant,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="account-check-outline"
            size={24}
            color={colors.onTertiaryContainer ?? colors.onSurfaceVariant}
          />
        </View>

        <View style={styles.compactContent}>
          <Text
            variant="titleSmall"
            style={[styles.compactTitle, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            Selected contacts shared
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: colors.onSurfaceVariant }}
            numberOfLines={2}
          >
            Share more contacts to find additional friends
          </Text>
        </View>

        <View style={styles.compactActions}>
          <Button
            mode="outlined"
            onPress={onOpenSettings}
            compact
            labelStyle={{ fontSize: 13 }}
          >
            Manage
          </Button>
          <Button
            mode="text"
            onPress={onDismiss}
            textColor={colors.onSurfaceVariant}
            compact
            labelStyle={{ fontSize: 12 }}
          >
            Dismiss
          </Button>
        </View>
      </View>
    );
  }

  // ── Denied (soft Settings nudge) ────────────────────────────

  return (
    <View
      style={[
        styles.compactCard,
        { backgroundColor: colors.surface },
        platformShadow,
      ]}
    >
      <View
        style={[
          styles.compactIconCircle,
          { backgroundColor: colors.surfaceVariant },
        ]}
      >
        <MaterialCommunityIcons
          name="contacts-outline"
          size={24}
          color={colors.onSurfaceVariant}
        />
      </View>

      <View style={styles.compactContent}>
        <Text
          variant="titleSmall"
          style={[styles.compactTitle, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          Contacts access denied
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: colors.onSurfaceVariant }}
          numberOfLines={2}
        >
          Enable in Settings to find friends in your contacts
        </Text>
      </View>

      <View style={styles.compactActions}>
        <Button
          mode="outlined"
          onPress={onOpenSettings}
          compact
          labelStyle={{ fontSize: 13 }}
        >
          Settings
        </Button>
        <Button
          mode="text"
          onPress={onDismiss}
          textColor={colors.onSurfaceVariant}
          compact
          labelStyle={{ fontSize: 12 }}
        >
          Dismiss
        </Button>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const platformShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: {
    elevation: 2,
  },
}) as object;

const styles = StyleSheet.create({
  // ── Prominent card ──────────────────────────────────────────

  prominentCard: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl ?? 32,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
  },
  prominentIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  prominentTitle: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  prominentBody: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xl,
  },
  privacyText: {
    flex: 1,
  },
  prominentCta: {
    borderRadius: BorderRadius.full,
    minWidth: 200,
    marginBottom: Spacing.sm,
  },
  ctaContent: {
    paddingVertical: 6,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  skipBtn: {
    marginTop: 2,
  },

  // ── Compact card ────────────────────────────────────────────

  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  compactIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  compactContent: {
    flex: 1,
    marginRight: 4,
  },
  compactTitle: {
    fontWeight: "700",
  },
  compactActions: {
    alignItems: "flex-end",
    gap: 2,
    flexShrink: 0,
  },
});
