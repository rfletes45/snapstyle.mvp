/**
 * OverviewCard — Shared card wrapper for profile overview cards.
 *
 * Provides a consistent card shell with title, count badge,
 * a chevron tap-to-expand affordance, and a subtle fade-in entrance.
 *
 * @module components/profile/OverviewCards/OverviewCard
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "react-native-paper";
import Animated, { FadeInUp } from "react-native-reanimated";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";

// =============================================================================
// Types
// =============================================================================

export interface OverviewCardProps {
  /** Card title (e.g. "Friends", "Badges") */
  title: string;
  /** Optional count to display next to title */
  count?: number;
  /** Whether the section is hidden from others (own profile indicator) */
  hiddenFromOthers?: boolean;
  /** Whether this section is privacy-hidden (viewing other user) */
  privacyHidden?: boolean;
  /** Privacy-hidden message override */
  privacyMessage?: string;
  /** Optional accent color for left border highlight */
  accentColor?: string;
  /** Stagger index for entrance animation delay (0-based) */
  enterIndex?: number;
  /** Callback when card is pressed */
  onPress?: () => void;
  /** Child content */
  children?: React.ReactNode;
  /** Test ID */
  testID?: string;
}

// =============================================================================
// Component
// =============================================================================

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const OverviewCard = memo(function OverviewCard({
  title,
  count,
  hiddenFromOthers,
  privacyHidden,
  privacyMessage,
  accentColor,
  enterIndex = 0,
  onPress,
  children,
  testID,
}: OverviewCardProps) {
  const colors = useColors();

  return (
    <AnimatedTouchable
      entering={FadeInUp.duration(280).delay(80 + enterIndex * 60)}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.surfaceVariant + "30",
        },
        accentColor && {
          borderLeftColor: accentColor + "60",
          borderLeftWidth: 3,
        },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}${count != null ? `, ${count}` : ""}`}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {count != null && (
            <View
              style={[
                styles.countBadge,
                { backgroundColor: colors.primary + "15" },
              ]}
            >
              <Text style={[styles.countText, { color: colors.primary }]}>
                {count}
              </Text>
            </View>
          )}
          {hiddenFromOthers && (
            <View
              style={[
                styles.hiddenBadge,
                { backgroundColor: colors.textSecondary + "12" },
              ]}
            >
              <MaterialCommunityIcons
                name="eye-off-outline"
                size={12}
                color={colors.textSecondary}
              />
              <Text
                style={[styles.hiddenText, { color: colors.textSecondary }]}
              >
                Hidden
              </Text>
            </View>
          )}
        </View>
        {onPress && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={colors.textSecondary + "80"}
          />
        )}
      </View>

      {/* Content */}
      {privacyHidden ? (
        <View style={styles.privacyContainer}>
          <MaterialCommunityIcons
            name="lock-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
            {privacyMessage || `${title} hidden`}
          </Text>
        </View>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </AnimatedTouchable>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    // Subtle shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: "center",
  },
  countText: {
    fontSize: FontSizes.xs,
    fontWeight: "700",
  },
  hiddenBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  hiddenText: {
    fontSize: FontSizes.xs,
  },
  content: {
    marginTop: Spacing.sm,
  },
  privacyContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  privacyText: {
    fontSize: FontSizes.sm,
  },
});

export default OverviewCard;
