/**
 * Control Button Component (Phase 3)
 * L/R touch zones for mechanism control
 */

import React, { useCallback, useState } from "react";
import {
  DimensionValue,
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from "react-native";
import { BUTTON_CONFIG, TOUCH_ZONES } from "../data/constants";

// ============================================
// Props Interface
// ============================================

interface ControlButtonProps {
  type: "left" | "right" | "blow";
  onPressIn: () => void;
  onPressOut: () => void;
  disabled?: boolean;
  visible?: boolean;
  showLabel?: boolean;
  opacity?: number;
}

// ============================================
// Control Button Component
// ============================================

export const ControlButton: React.FC<ControlButtonProps> = ({
  type,
  onPressIn,
  onPressOut,
  disabled = false,
  visible = true,
  showLabel = true,
  opacity = 1,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePressIn = useCallback(
    (_event: GestureResponderEvent) => {
      if (disabled) return;
      setIsPressed(true);
      onPressIn();
    },
    [disabled, onPressIn],
  );

  const handlePressOut = useCallback(
    (_event: GestureResponderEvent) => {
      if (disabled) return;
      setIsPressed(false);
      onPressOut();
    },
    [disabled, onPressOut],
  );

  if (!visible) return null;

  const zone =
    type === "left"
      ? TOUCH_ZONES.leftButton
      : type === "right"
        ? TOUCH_ZONES.rightButton
        : TOUCH_ZONES.blowButton;

  const label =
    type === "left"
      ? BUTTON_CONFIG.labels.left
      : type === "right"
        ? BUTTON_CONFIG.labels.right
        : BUTTON_CONFIG.labels.blow;

  const zoneStyle: ViewStyle = {
    position: "absolute",
    left: zone.x as DimensionValue,
    top: zone.y as DimensionValue,
    width: zone.width as DimensionValue,
    height: zone.height as DimensionValue,
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <View style={[styles.touchZone, zoneStyle, { opacity }]}>
        <View
          style={[
            styles.buttonVisual,
            isPressed && styles.buttonPressed,
            disabled && styles.buttonDisabled,
          ]}
        >
          {showLabel && <Text style={styles.buttonLabel}>{label}</Text>}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  touchZone: {
    justifyContent: "center",
    alignItems: "center",
    // Debug: backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  buttonVisual: {
    width: BUTTON_CONFIG.size,
    height: BUTTON_CONFIG.size,
    borderRadius: BUTTON_CONFIG.borderRadius,
    backgroundColor: BUTTON_CONFIG.colors.idle,
    borderWidth: 2,
    borderColor: BUTTON_CONFIG.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    backgroundColor: BUTTON_CONFIG.colors.pressed,
    transform: [{ scale: 0.95 }],
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  buttonLabel: {
    color: BUTTON_CONFIG.colors.text,
    fontSize: 20,
    fontWeight: "bold",
  },
});

export default ControlButton;
