/**
 * AnimalLongPressButton
 *
 * A dual-mode animal button for the composer toolbar:
 * - Short tap: opens the lightweight animal picker bubble
 * - Hold (0.425s): arms the alternate animal picker mode
 * - Release after arming: opens the full animal customization picker
 *
 * Visual feedback:
 * - Normal state shows the equipped animal image
 * - Armed state swaps to the animal-picker icon, turns the button purple,
 *   and fires one light haptic
 *
 * Like the camera button, this child interaction cooperates with the toolbar's
 * parent edit-mode long press by using a longer item-specific slot delay.
 */

import { light as triggerLightHaptic } from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, TouchableWithoutFeedback } from "react-native";

import { AnimalIcon } from "./AnimalIcon";
import { useToolbarSlotInteraction } from "./ComposerToolbar/ToolbarSlotInteractionContext";

export const ANIMAL_ALTERNATE_PICKER_HOLD_DURATION_MS = 425;
export const ANIMAL_ALTERNATE_PICKER_ACTIVE_BACKGROUND = "#8B5CF6";
export const ANIMAL_ALTERNATE_PICKER_ICON = "paw";

const BUTTON_WIDTH = 36;
const BUTTON_HEIGHT = 40;
const DEFAULT_ANIMAL_ICON_SIZE = 25;
const ALTERNATE_ICON_SIZE = 22;
const HOLD_SCALE = 0.92;

interface Props {
  animalId?: string | null;
  onShortPress: () => void;
  onLongPress: () => void;
  disabled?: boolean;
  interactionLocked?: boolean;
  editModeActivationDurationMs?: number;
  width?: number;
  height?: number;
  animalIconSize?: number;
}

export function AnimalLongPressButton({
  animalId,
  onShortPress,
  onLongPress,
  disabled = false,
  interactionLocked = false,
  editModeActivationDurationMs,
  width = BUTTON_WIDTH,
  height = BUTTON_HEIGHT,
  animalIconSize = DEFAULT_ANIMAL_ICON_SIZE,
}: Props) {
  const slotInteraction = useToolbarSlotInteraction();
  const [isAlternatePickerArmed, setIsAlternatePickerArmed] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editModeCutoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pressActiveRef = useRef(false);
  const alternatePickerArmedRef = useRef(false);
  const suppressReleaseActionRef = useRef(false);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const clearEditModeCutoffTimer = useCallback(() => {
    if (editModeCutoffTimerRef.current) {
      clearTimeout(editModeCutoffTimerRef.current);
      editModeCutoffTimerRef.current = null;
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
      alternatePickerArmedRef.current = false;
      setIsAlternatePickerArmed(false);
      clearHoldTimer();
      clearEditModeCutoffTimer();
      animateScale(1);
    },
    [animateScale, clearEditModeCutoffTimer, clearHoldTimer],
  );

  const handlePressIn = useCallback(() => {
    if (disabled || interactionLocked) return;

    clearHoldTimer();
    pressActiveRef.current = true;
    alternatePickerArmedRef.current = false;
    suppressReleaseActionRef.current = false;
    setIsAlternatePickerArmed(false);

    Animated.spring(scaleAnim, {
      toValue: HOLD_SCALE,
      useNativeDriver: true,
      speed: 28,
      bounciness: 4,
    }).start();

    if (
      typeof editModeActivationDurationMs === "number" &&
      editModeActivationDurationMs > 0
    ) {
      editModeCutoffTimerRef.current = setTimeout(() => {
        if (!pressActiveRef.current || disabled || interactionLocked) return;

        suppressReleaseActionRef.current = true;
        alternatePickerArmedRef.current = false;
        setIsAlternatePickerArmed(false);
        clearHoldTimer();
        animateScale(1);
      }, editModeActivationDurationMs);
    }

    holdTimerRef.current = setTimeout(() => {
      if (!pressActiveRef.current || disabled || interactionLocked) return;

      alternatePickerArmedRef.current = true;
      setIsAlternatePickerArmed(true);
      animateScale(1);
      triggerLightHaptic();
    }, ANIMAL_ALTERNATE_PICKER_HOLD_DURATION_MS);
  }, [
    animateScale,
    clearHoldTimer,
    disabled,
    editModeActivationDurationMs,
    interactionLocked,
    scaleAnim,
  ]);

  const handlePressOut = useCallback(() => {
    const editModeActivationPending =
      slotInteraction?.editModeActivationSignal.value === true;
    const wasPressActive = pressActiveRef.current;
    const shouldOpenAlternatePicker =
      wasPressActive &&
      alternatePickerArmedRef.current &&
      !suppressReleaseActionRef.current &&
      !editModeActivationPending;
    const shouldOpenAnimalPicker =
      wasPressActive &&
      !alternatePickerArmedRef.current &&
      !suppressReleaseActionRef.current &&
      !editModeActivationPending;

    resetInteraction();

    if (shouldOpenAlternatePicker) {
      onLongPress();
      return;
    }

    if (shouldOpenAnimalPicker) {
      onShortPress();
    }
  }, [onLongPress, onShortPress, resetInteraction, slotInteraction]);

  useEffect(() => {
    if (!slotInteraction) return;

    slotInteraction.registerPreEditModeCancel(() => {
      resetInteraction(true);
    });

    return () => {
      slotInteraction.registerPreEditModeCancel(null);
    };
  }, [resetInteraction, slotInteraction]);

  useEffect(() => {
    return () => {
      clearHoldTimer();
      clearEditModeCutoffTimer();
    };
  }, [clearEditModeCutoffTimer, clearHoldTimer]);

  useEffect(() => {
    if (!disabled && !interactionLocked) return;
    if (!pressActiveRef.current && !alternatePickerArmedRef.current) return;
    resetInteraction(true);
  }, [disabled, interactionLocked, resetInteraction]);

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || interactionLocked}
      accessibilityLabel={
        isAlternatePickerArmed
          ? "Open alternate animal picker"
          : "Open animal picker"
      }
      accessibilityRole="button"
    >
      <Animated.View
        testID="animal-long-press-container"
        style={[
          styles.container,
          {
            width,
            height,
            opacity: disabled ? 0.35 : 1,
            transform: [{ scale: scaleAnim }],
          },
          isAlternatePickerArmed && {
            backgroundColor: ANIMAL_ALTERNATE_PICKER_ACTIVE_BACKGROUND,
            borderRadius: width / 2,
          },
        ]}
      >
        {isAlternatePickerArmed ? (
          <MaterialCommunityIcons
            testID="animal-long-press-alternate-icon"
            name={ANIMAL_ALTERNATE_PICKER_ICON}
            size={ALTERNATE_ICON_SIZE}
            color="#FFFFFF"
          />
        ) : (
          <AnimalIcon animalId={animalId} size={animalIconSize} wide />
        )}
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

export default AnimalLongPressButton;
