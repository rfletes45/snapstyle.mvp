/**
 * CurrencyChip — compact economy badge
 *
 * Shows a single currency icon + amount. Tap opens wallet / shop.
 * Dot indicator when claimable rewards exist.
 *
 * @module components/games/CurrencyChip
 */

import { BorderRadius } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

// =============================================================================
// Props
// =============================================================================

export interface CurrencyChipProps {
  /** Material Community Icon name */
  icon: string;
  /** Display value */
  amount: number;
  /** Colour accent for the icon */
  iconColor?: string;
  /** Show a small claimable dot */
  claimable?: boolean;
  /** Tap handler (e.g. open wallet) */
  onPress?: () => void;
}

// =============================================================================
// Component
// =============================================================================

function CurrencyChipBase({
  icon,
  amount,
  iconColor,
  claimable = false,
  onPress,
}: CurrencyChipProps) {
  const theme = useTheme();

  const formattedAmount =
    amount >= 10_000
      ? `${(amount / 1000).toFixed(1)}k`
      : amount.toLocaleString();

  return (
    <TouchableOpacity
      style={[styles.chip, { backgroundColor: theme.colors.surfaceVariant }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      accessibilityLabel={`${formattedAmount} ${icon}`}
      accessibilityRole="button"
    >
      <MaterialCommunityIcons
        name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={16}
        color={iconColor ?? theme.colors.primary}
      />
      <Text
        style={[styles.amount, { color: theme.colors.onSurface }]}
        numberOfLines={1}
      >
        {formattedAmount}
      </Text>
      {claimable && (
        <View style={[styles.dot, { backgroundColor: theme.colors.error }]} />
      )}
    </TouchableOpacity>
  );
}

export const CurrencyChip = memo(CurrencyChipBase);
export default CurrencyChip;

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    gap: 4,
    position: "relative",
  },
  amount: {
    fontSize: 13,
    fontWeight: "600",
  },
  dot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#121212",
  },
});
