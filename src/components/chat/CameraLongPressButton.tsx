/**
 * CameraLongPressButton
 *
 * A camera button with dual-mode functionality:
 * - Short tap: Opens camera for capture
 * - Hold (0.425s) arms image-picker mode
 * - Release after arming: Opens image picker/gallery
 *
 * Visual feedback:
 * - Icon changes to "image-multiple" when image-picker mode arms
 * - Circular background turns purple while armed
 * - Light haptic feedback fires once at the arm threshold
 *
 * The toolbar can independently enter edit mode on long press. The camera item
 * uses a longer edit-mode delay, and this component cancels its armed state if
 * edit mode takes over before release.
 */

import { light as triggerLightHaptic } from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, TouchableWithoutFeedback } from "react-native";
import { useTheme } from "react-native-paper";

export const CAMERA_IMAGE_PICKER_HOLD_DURATION_MS = 425;
export const CAMERA_IMAGE_PICKER_ACTIVE_BACKGROUND = "#8B5CF6";

const BUTTON_SIZE = 44;
const ICON_SIZE = 24;
const HOLD_SCALE = 0.92;

interface Props {
  onShortPress: () => void;
  onLongPress: () => void;
  disabled?: boolean;
  interactionLocked?: boolean;
  size?: number;
  iconSize?: number;
}

export function CameraLongPressButton({
  onShortPress,
  onLongPress,
  disabled = false,
  interactionLocked = false,
  size = BUTTON_SIZE,
  iconSize = ICON_SIZE,
}: Props) {
  const theme = useTheme();
  const [isImagePickerArmed, setIsImagePickerArmed] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressActiveRef = useRef(false);
  const imagePickerArmedRef = useRef(false);
  const suppressReleaseActionRef = useRef(false);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const animateScale = useCallback(
    (toValue: number) => {
      Animated.spring(scaleAnim, {
        toValue,
        useNativeDriver: true,
        speed: 28,
        bounciness: 5,
      }).start();
    },
    [scaleAnim],
  );

  const resetInteraction = useCallback(
    (suppressReleaseAction = false) => {
      suppressReleaseActionRef.current = suppressReleaseAction;
      pressActiveRef.current = false;
      imagePickerArmedRef.current = false;
      setIsImagePickerArmed(false);
      clearHoldTimer();
      animateScale(1);
    },
    [animateScale, clearHoldTimer],
  );

  const handlePressIn = useCallback(() => {
    if (disabled || interactionLocked) return;

    clearHoldTimer();
    pressActiveRef.current = true;
    imagePickerArmedRef.current = false;
    suppressReleaseActionRef.current = false;
    setIsImagePickerArmed(false);

    Animated.spring(scaleAnim, {
      toValue: HOLD_SCALE,
      useNativeDriver: true,
      speed: 28,
      bounciness: 4,
    }).start();

    holdTimerRef.current = setTimeout(() => {
      if (!pressActiveRef.current || disabled || interactionLocked) return;

      imagePickerArmedRef.current = true;
      setIsImagePickerArmed(true);
      animateScale(1);
      triggerLightHaptic();
    }, CAMERA_IMAGE_PICKER_HOLD_DURATION_MS);
  }, [animateScale, clearHoldTimer, disabled, interactionLocked, scaleAnim]);

  const handlePressOut = useCallback(() => {
    const wasPressActive = pressActiveRef.current;
    const shouldOpenImagePicker =
      wasPressActive &&
      imagePickerArmedRef.current &&
      !suppressReleaseActionRef.current;
    const shouldOpenCamera =
      wasPressActive &&
      !imagePickerArmedRef.current &&
      !suppressReleaseActionRef.current;

    resetInteraction();

    if (shouldOpenImagePicker) {
      onLongPress();
      return;
    }

    if (shouldOpenCamera) {
      onShortPress();
    }
  }, [onLongPress, onShortPress, resetInteraction]);

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, [clearHoldTimer]);

  useEffect(() => {
    if (!disabled && !interactionLocked) return;
    if (!pressActiveRef.current && !imagePickerArmedRef.current) return;
    resetInteraction(true);
  }, [disabled, interactionLocked, resetInteraction]);

  const iconName = isImagePickerArmed ? "image-multiple" : "camera";
  const iconColor = disabled
    ? theme.colors.onSurfaceDisabled
    : isImagePickerArmed
      ? "#FFFFFF"
      : "#888";

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || interactionLocked}
      accessibilityLabel={
        isImagePickerArmed ? "Open photo library" : "Open camera"
      }
      accessibilityRole="button"
    >
      <Animated.View
        testID="camera-long-press-container"
        style={[
          styles.container,
          {
            width: size,
            height: size,
            transform: [{ scale: scaleAnim }],
          },
          isImagePickerArmed && {
            backgroundColor: CAMERA_IMAGE_PICKER_ACTIVE_BACKGROUND,
            borderRadius: size / 2,
          },
        ]}
      >
        <MaterialCommunityIcons
          testID="camera-long-press-icon"
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
  },
});

export default CameraLongPressButton;
