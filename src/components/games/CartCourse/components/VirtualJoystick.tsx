/**
 * Virtual Joystick Component (Phase 3)
 * Touch-controlled joystick for mechanism control
 */

import React, { useCallback, useRef, useState } from "react";
import {
  DimensionValue,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { JOYSTICK_CONFIG, TOUCH_ZONES } from "../data/constants";
import { JoystickInput } from "../types/cartCourse.types";

// ============================================
// Props Interface
// ============================================

interface VirtualJoystickProps {
  type: "left" | "right";
  onJoystickMove: (input: JoystickInput) => void;
  onJoystickRelease: () => void;
  disabled?: boolean;
  visible?: boolean;
  opacity?: number;
}

// ============================================
// Virtual Joystick Component
// ============================================

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  type,
  onJoystickMove,
  onJoystickRelease,
  disabled = false,
  visible = true,
  opacity = 1,
}) => {
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const containerRef = useRef<View>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ width: 0, height: 0 });

  // Calculate joystick input from knob position
  const calculateInput = useCallback(
    (dx: number, dy: number): JoystickInput => {
      const { maxDisplacement, deadzone } = JOYSTICK_CONFIG;

      // Normalize to -1 to 1
      const x = Math.max(-1, Math.min(1, dx / maxDisplacement));
      const y = Math.max(-1, Math.min(1, dy / maxDisplacement));

      // Calculate magnitude (0 to 1)
      const magnitude = Math.min(1, Math.sqrt(x * x + y * y));

      // Calculate angle (radians, 0 = right, positive = clockwise)
      const angle = Math.atan2(y, x);

      // Apply deadzone
      const effectiveMagnitude = magnitude > deadzone ? magnitude : 0;

      return {
        x: effectiveMagnitude > 0 ? x : 0,
        y: effectiveMagnitude > 0 ? y : 0,
        magnitude: effectiveMagnitude,
        angle,
      };
    },
    [],
  );

  // Handle layout to get center position
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    sizeRef.current = { width, height };
    centerRef.current = { x: width / 2, y: height / 2 };
  }, []);

  // Pan responder for touch handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,

      onPanResponderGrant: (event: GestureResponderEvent) => {
        if (disabled) return;
        setIsActive(true);

        // Get touch position relative to center
        const { locationX, locationY } = event.nativeEvent;
        const dx = locationX - centerRef.current.x;
        const dy = locationY - centerRef.current.y;

        // Clamp displacement
        const { maxDisplacement } = JOYSTICK_CONFIG;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const clampedDistance = Math.min(distance, maxDisplacement);
        const angle = Math.atan2(dy, dx);

        const clampedX = Math.cos(angle) * clampedDistance;
        const clampedY = Math.sin(angle) * clampedDistance;

        setKnobPosition({ x: clampedX, y: clampedY });
        onJoystickMove(calculateInput(clampedX, clampedY));
      },

      onPanResponderMove: (event: GestureResponderEvent) => {
        if (disabled) return;

        // Get touch position relative to center
        const { locationX, locationY } = event.nativeEvent;
        const dx = locationX - centerRef.current.x;
        const dy = locationY - centerRef.current.y;

        // Clamp displacement
        const { maxDisplacement } = JOYSTICK_CONFIG;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const clampedDistance = Math.min(distance, maxDisplacement);
        const angle = Math.atan2(dy, dx);

        const clampedX = Math.cos(angle) * clampedDistance;
        const clampedY = Math.sin(angle) * clampedDistance;

        setKnobPosition({ x: clampedX, y: clampedY });
        onJoystickMove(calculateInput(clampedX, clampedY));
      },

      onPanResponderRelease: () => {
        setIsActive(false);
        setKnobPosition({ x: 0, y: 0 });
        onJoystickRelease();
        onJoystickMove({ x: 0, y: 0, magnitude: 0, angle: 0 });
      },

      onPanResponderTerminate: () => {
        setIsActive(false);
        setKnobPosition({ x: 0, y: 0 });
        onJoystickRelease();
        onJoystickMove({ x: 0, y: 0, magnitude: 0, angle: 0 });
      },
    }),
  ).current;

  if (!visible) return null;

  const zone =
    type === "left" ? TOUCH_ZONES.leftJoystick : TOUCH_ZONES.rightJoystick;

  const zoneStyle: ViewStyle = {
    position: "absolute",
    left: zone.x as DimensionValue,
    top: zone.y as DimensionValue,
    width: zone.width as DimensionValue,
    height: zone.height as DimensionValue,
  };

  const { outerRadius, innerRadius, colors } = JOYSTICK_CONFIG;

  return (
    <View
      style={[styles.touchZone, zoneStyle, { opacity }]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
      ref={containerRef}
    >
      {/* Outer ring */}
      <View
        style={[
          styles.outerRing,
          {
            width: outerRadius * 2,
            height: outerRadius * 2,
            borderRadius: outerRadius,
            backgroundColor: isActive
              ? colors.outerRingActive
              : colors.outerRing,
          },
        ]}
      >
        {/* Inner knob */}
        <View
          style={[
            styles.innerKnob,
            {
              width: innerRadius * 2,
              height: innerRadius * 2,
              borderRadius: innerRadius,
              backgroundColor: isActive
                ? colors.innerKnobActive
                : colors.innerKnob,
              transform: [
                { translateX: knobPosition.x },
                { translateY: knobPosition.y },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  touchZone: {
    justifyContent: "center",
    alignItems: "center",
    // Debug: backgroundColor: 'rgba(0, 255, 0, 0.1)',
  },
  outerRing: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  innerKnob: {
    position: "absolute",
  },
});

export default VirtualJoystick;
