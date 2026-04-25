import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export interface ButtonCornerBadgeProps {
  visible: boolean;
  size?: number;
  borderWidth?: number;
  backgroundColor?: string;
  badgeColor?: string;
  borderColor: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

function getCornerOffset(size: number, borderWidth: number): number {
  return -Math.max(1, Math.round((size - borderWidth) / 2));
}

export function ButtonCornerBadge({
  visible,
  size = 10,
  borderWidth = 2,
  backgroundColor,
  badgeColor,
  borderColor,
  style,
  accessibilityLabel,
}: ButtonCornerBadgeProps) {
  if (!visible) return null;

  const offset = getCornerOffset(size, borderWidth);
  const resolvedBadgeColor = badgeColor ?? backgroundColor ?? "#FF3B30";

  return (
    <View
      pointerEvents="none"
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={
        accessibilityLabel ? "yes" : "no-hide-descendants"
      }
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          top: offset,
          right: offset,
          backgroundColor: resolvedBadgeColor,
          borderColor,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    zIndex: 5,
  },
});

export default ButtonCornerBadge;
