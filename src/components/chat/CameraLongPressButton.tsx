/**
 * CameraLongPressButton
 *
 * A camera button with dual-mode functionality:
 * - Short tap: Opens camera for capture
 * - Long press (0.5s hold): Opens image picker/gallery
 *
 * Visual feedback:
 * - Icon changes to "image-multiple" when long press activates
 * - Background color pulses during hold
 * - Purple icon color when activated
 * - Haptic feedback at threshold
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { useTheme } from "react-native-paper";

const LONG_PRESS_DURATION = 500; // 0.5 seconds
const BUTTON_SIZE = 44;
const ICON_SIZE = 24;

interface Props {
  onShortPress: () => void;
  onLongPress: () => void;
  disabled?: boolean;
  size?: number;
  iconSize?: number;
}

export function CameraLongPressButton({
  onShortPress,
  onLongPress,
  disabled = false,
  size = BUTTON_SIZE,
  iconSize = ICON_SIZE,
}: Props) {
  const theme = useTheme();
  const [isHolding, setIsHolding] = useState(false);
  const [hasTriggeredLongPress, setHasTriggeredLongPress] = useState(false);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const clearTimers = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (pulseAnimation.current) {
      pulseAnimation.current.stop();
      pulseAnimation.current = null;
    }
  }, []);

  const handlePressIn = useCallback(() => {
    if (disabled) return;

    setIsHolding(true);
    setHasTriggeredLongPress(false);

    // Start scale down animation
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();

    // Start pulsing background opacity
    pulseAnimation.current = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseAnimation.current.start();

    // Long press timer
    longPressTimer.current = setTimeout(() => {
      setHasTriggeredLongPress(true);
      setIsHolding(false);
      clearTimers();

      // Reset animations
      scaleAnim.setValue(1);
      opacityAnim.setValue(0);

      // Haptic feedback at threshold
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      onLongPress();

      // Reset icon back to camera after a brief moment
      setTimeout(() => {
        setHasTriggeredLongPress(false);
      }, 300);
    }, LONG_PRESS_DURATION);
  }, [disabled, clearTimers, onLongPress, scaleAnim, opacityAnim]);

  const handlePressOut = useCallback(() => {
    const wasHolding = isHolding;
    const hadTriggeredLongPress = hasTriggeredLongPress;

    setIsHolding(false);
    clearTimers();

    // Reset animations
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
    opacityAnim.setValue(0);

    // If released before long press threshold and didn't trigger long press
    if (wasHolding && !hadTriggeredLongPress) {
      onShortPress();
    }
  }, [
    isHolding,
    hasTriggeredLongPress,
    clearTimers,
    onShortPress,
    scaleAnim,
    opacityAnim,
  ]);

  // Icon only changes to image when long press is triggered (not during hold)
  const iconName = hasTriggeredLongPress ? "image-multiple" : "camera";
  // Purple color (#9C27B0) when activated, gray otherwise
  const iconColor = disabled
    ? theme.colors.onSurfaceDisabled
    : hasTriggeredLongPress
      ? "#9C27B0"
      : "#888";

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Pulsing background */}
        <Animated.View
          style={[
            styles.pulseBackground,
            {
              backgroundColor: theme.colors.primary,
              opacity: opacityAnim,
              borderRadius: size / 2,
            },
          ]}
        />

        {/* Icon */}
        <MaterialCommunityIcons
          name={iconName}
          size={iconSize}
          color={iconColor}
        />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  pulseBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default CameraLongPressButton;
