/**
 * Cart Course Controls Component (Phase 3)
 * Combined overlay for all touch controls
 */

import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { InputState, JoystickInput } from "../types/cartCourse.types";
import ControlButton from "./ControlButton";
import VirtualJoystick from "./VirtualJoystick";

// ============================================
// Props Interface
// ============================================

interface CartCourseControlsProps {
  onInputChange: (input: Partial<InputState>) => void;
  showLeftButton?: boolean;
  showRightButton?: boolean;
  showLeftJoystick?: boolean;
  showRightJoystick?: boolean;
  showBlowButton?: boolean;
  disabled?: boolean;
  controlsOpacity?: number;
}

// ============================================
// Cart Course Controls Component
// ============================================

export const CartCourseControls: React.FC<CartCourseControlsProps> = ({
  onInputChange,
  showLeftButton = true,
  showRightButton = true,
  showLeftJoystick = true,
  showRightJoystick = true,
  showBlowButton = false,
  disabled = false,
  controlsOpacity = 0.7,
}) => {
  // ============================================
  // Button Handlers
  // ============================================

  const handleLeftButtonPressIn = useCallback(() => {
    onInputChange({ leftButton: true });
  }, [onInputChange]);

  const handleLeftButtonPressOut = useCallback(() => {
    onInputChange({ leftButton: false });
  }, [onInputChange]);

  const handleRightButtonPressIn = useCallback(() => {
    onInputChange({ rightButton: true });
  }, [onInputChange]);

  const handleRightButtonPressOut = useCallback(() => {
    onInputChange({ rightButton: false });
  }, [onInputChange]);

  const handleBlowButtonPressIn = useCallback(() => {
    onInputChange({ isBlowing: true });
  }, [onInputChange]);

  const handleBlowButtonPressOut = useCallback(() => {
    onInputChange({ isBlowing: false });
  }, [onInputChange]);

  // ============================================
  // Joystick Handlers
  // ============================================

  const handleLeftJoystickMove = useCallback(
    (input: JoystickInput) => {
      onInputChange({
        leftJoystick: { angle: input.angle, magnitude: input.magnitude },
      });
    },
    [onInputChange],
  );

  const handleLeftJoystickRelease = useCallback(() => {
    onInputChange({
      leftJoystick: { angle: 0, magnitude: 0 },
    });
  }, [onInputChange]);

  const handleRightJoystickMove = useCallback(
    (input: JoystickInput) => {
      onInputChange({
        rightJoystick: { angle: input.angle, magnitude: input.magnitude },
      });
    },
    [onInputChange],
  );

  const handleRightJoystickRelease = useCallback(() => {
    onInputChange({
      rightJoystick: { angle: 0, magnitude: 0 },
    });
  }, [onInputChange]);

  // ============================================
  // Render
  // ============================================

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Left Button (L) */}
      <ControlButton
        type="left"
        onPressIn={handleLeftButtonPressIn}
        onPressOut={handleLeftButtonPressOut}
        visible={showLeftButton}
        disabled={disabled}
        opacity={controlsOpacity}
      />

      {/* Right Button (R) */}
      <ControlButton
        type="right"
        onPressIn={handleRightButtonPressIn}
        onPressOut={handleRightButtonPressOut}
        visible={showRightButton}
        disabled={disabled}
        opacity={controlsOpacity}
      />

      {/* Left Joystick */}
      <VirtualJoystick
        type="left"
        onJoystickMove={handleLeftJoystickMove}
        onJoystickRelease={handleLeftJoystickRelease}
        visible={showLeftJoystick}
        disabled={disabled}
        opacity={controlsOpacity}
      />

      {/* Right Joystick */}
      <VirtualJoystick
        type="right"
        onJoystickMove={handleRightJoystickMove}
        onJoystickRelease={handleRightJoystickRelease}
        visible={showRightJoystick}
        disabled={disabled}
        opacity={controlsOpacity}
      />

      {/* Blow Button (accessibility alternative to microphone) */}
      <ControlButton
        type="blow"
        onPressIn={handleBlowButtonPressIn}
        onPressOut={handleBlowButtonPressOut}
        visible={showBlowButton}
        disabled={disabled}
        opacity={controlsOpacity}
      />
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    // Controls overlay doesn't capture touches outside controls
  },
});

export default CartCourseControls;
