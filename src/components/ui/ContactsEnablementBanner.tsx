/**
 * ContactsEnablementBanner — Reusable contacts permission banner.
 *
 * Used in both the Add Friends modal and the Messages screen.
 * Adapts copy and behavior based on permission state.
 *
 * Supports:
 * - Title, subtitle, CTA, optional dismiss X button
 * - State-specific copy (undetermined, limited, denied)
 * - iOS 18+ ContactAccessButton integration for limited state
 * - Platform-correct CTA behavior
 * - Theme-consistent styling
 *
 * @module components/ui/ContactsEnablementBanner
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import type { ContactsPermissionState } from "@/hooks/useContactsPermission";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ContactAccessButton } from "expo-contacts";
import React, { memo } from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ContactsEnablementBannerProps {
  /** Current permission state — drives copy and CTA behavior. */
  permState: ContactsPermissionState;
  /** Primary CTA handler (request permission / expand / open Settings). */
  onEnable: () => void;
  /** Optional dismiss handler. If provided, shows an X button. */
  onDismiss?: () => void;
  /** Whether the CTA is loading. */
  loading?: boolean;
  /** Use large/prominent layout (default: compact). */
  prominent?: boolean;
}

// ---------------------------------------------------------------------------
// Copy per state
// ---------------------------------------------------------------------------

interface BannerCopy {
  icon: string;
  title: string;
  subtitle: string;
  cta: string;
  /** Whether CTA should open Settings instead of requesting. */
  opensSettings: boolean;
}

function getCopy(permState: ContactsPermissionState): BannerCopy {
  switch (permState) {
    case "undetermined":
      return {
        icon: "account-group-outline",
        title: "Find friends from your contacts",
        subtitle:
          "Enable contacts to see people you may know and invite friends faster.",
        cta: "Enable Contacts",
        opensSettings: false,
      };
    case "granted_limited":
      return {
        icon: "account-check-outline",
        title: "Add more contacts",
        subtitle:
          "You\u2019ve shared only some contacts. Add more to improve recommendations.",
        cta: "Manage Contacts",
        opensSettings: false,
      };
    case "denied_can_retry":
      return {
        icon: "contacts-outline",
        title: "Find friends from your contacts",
        subtitle:
          "Enable contacts to see people you may know and invite friends faster.",
        cta: "Enable Contacts",
        opensSettings: false,
      };
    case "denied_permanent":
      return {
        icon: "cog-outline",
        title: "Enable contacts in Settings",
        subtitle:
          "Contacts access was denied. You can enable it in your device settings to find friends.",
        cta: "Open Settings",
        opensSettings: true,
      };
    default:
      return {
        icon: "account-group-outline",
        title: "Find friends from your contacts",
        subtitle: "Enable contacts to find friends on SnapStyle.",
        cta: "Enable Contacts",
        opensSettings: false,
      };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ContactsEnablementBanner = memo(function ContactsEnablementBanner({
  permState,
  onEnable,
  onDismiss,
  loading = false,
  prominent = false,
}: ContactsEnablementBannerProps) {
  const { colors } = useTheme();

  // Don't render when fully granted
  if (permState === "granted_all") return null;

  const copy = getCopy(permState);

  // ── iOS 18+ limited: show native ContactAccessButton alongside CTA ──
  const showNativeAccessButton =
    Platform.OS === "ios" &&
    permState === "granted_limited" &&
    parseInt(Platform.Version as string, 10) >= 18;

  // ── Prominent layout ────────────────────────────────────────────────

  if (prominent) {
    return (
      <View
        style={[
          styles.prominentCard,
          { backgroundColor: colors.surface },
          platformShadow,
        ]}
      >
        {onDismiss && (
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Dismiss contacts banner"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="close"
              size={20}
              color={colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}

        <View
          style={[
            styles.prominentIconCircle,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <MaterialCommunityIcons
            name={copy.icon as any}
            size={40}
            color={colors.onPrimaryContainer}
          />
        </View>

        <Text
          variant="headlineSmall"
          style={[styles.prominentTitle, { color: colors.onSurface }]}
        >
          {copy.title}
        </Text>

        <Text
          variant="bodyMedium"
          style={[styles.prominentSubtitle, { color: colors.onSurfaceVariant }]}
        >
          {copy.subtitle}
        </Text>

        {/* Privacy note */}
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

        {showNativeAccessButton && (
          <View style={styles.nativeButtonWrap}>
            <ContactAccessButton
              style={styles.nativeAccessButton}
              tintColor={colors.primary}
            />
          </View>
        )}

        <Button
          mode="contained"
          onPress={onEnable}
          loading={loading}
          disabled={loading}
          style={styles.prominentCta}
          contentStyle={styles.ctaContent}
          labelStyle={styles.ctaLabel}
          icon={copy.opensSettings ? "cog-outline" : "contacts-outline"}
        >
          {copy.cta}
        </Button>
      </View>
    );
  }

  // ── Compact layout ──────────────────────────────────────────────────

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
              permState === "granted_limited"
                ? (colors.tertiaryContainer ?? colors.surfaceVariant)
                : colors.primaryContainer,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={copy.icon as any}
          size={24}
          color={
            permState === "granted_limited"
              ? (colors.onTertiaryContainer ?? colors.onSurfaceVariant)
              : colors.onPrimaryContainer
          }
        />
      </View>

      <View style={styles.compactContent}>
        <Text
          variant="titleSmall"
          style={[styles.compactTitle, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {copy.title}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: colors.onSurfaceVariant }}
          numberOfLines={2}
        >
          {copy.subtitle}
        </Text>
      </View>

      <View style={styles.compactActions}>
        <Button
          mode={copy.opensSettings ? "outlined" : "contained"}
          onPress={onEnable}
          loading={loading}
          disabled={loading}
          compact
          labelStyle={styles.compactBtnLabel}
        >
          {copy.opensSettings ? "Settings" : "Enable"}
        </Button>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="close"
              size={18}
              color={colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
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
  // ── Prominent ─────────────────────────────────────────────────

  prominentCard: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
  },
  dismissBtn: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 1,
  },
  prominentIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  prominentTitle: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  prominentSubtitle: {
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
    marginBottom: Spacing.lg,
  },
  privacyText: {
    flex: 1,
  },
  nativeButtonWrap: {
    marginBottom: Spacing.md,
    alignSelf: "center",
  },
  nativeAccessButton: {
    width: 200,
    height: 44,
  },
  prominentCta: {
    borderRadius: BorderRadius.full,
    minWidth: 200,
  },
  ctaContent: {
    paddingVertical: 6,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: "600",
  },

  // ── Compact ───────────────────────────────────────────────────

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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexShrink: 0,
  },
  compactBtnLabel: {
    fontSize: 13,
  },
});
