/**
 * useChatKeyboard Hook
 *
 * Provides keyboard shared values for chat layout.
 * Falls back safely when react-native-keyboard-controller is unavailable.
 */

import {
  isKeyboardControllerAvailable,
  useKeyboardHandlerCompat,
  useReanimatedKeyboardAnimationCompat,
} from "@/utils/optionalKeyboardController";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { scheduleOnRN } from "react-native-worklets";
import { type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ChatKeyboardState {
  keyboardHeight: SharedValue<number>;
  keyboardProgress: SharedValue<number>;
  isKeyboardOpen: boolean;
  finalKeyboardHeight: number;
  safeAreaBottom: number;
}

export function useChatKeyboard(): ChatKeyboardState {
  const insets = useSafeAreaInsets();
  const safeAreaBottom = insets.bottom;
  const [finalKeyboardHeight, setFinalKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const { height: keyboardHeight, progress: keyboardProgress } =
    useReanimatedKeyboardAnimationCompat();

  const updateKeyboardState = useCallback(
    (height: number, open: boolean) => {
      setFinalKeyboardHeight(height);
      setIsKeyboardOpen(open);
    },
    [],
  );

  useKeyboardHandlerCompat({
    onStart: () => {
      "worklet";
    },
    onMove: () => {
      "worklet";
    },
    onEnd: (event: { height: number }) => {
      "worklet";
      const open = event.height > 0;
      scheduleOnRN(updateKeyboardState, event.height, open);
    },
  });

  useEffect(() => {
    if (isKeyboardControllerAvailable) return;

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      updateKeyboardState(event.endCoordinates?.height ?? 0, true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      updateKeyboardState(0, false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [updateKeyboardState]);

  return useMemo(
    () => ({
      keyboardHeight,
      keyboardProgress,
      isKeyboardOpen,
      finalKeyboardHeight,
      safeAreaBottom,
    }),
    [
      keyboardHeight,
      keyboardProgress,
      isKeyboardOpen,
      finalKeyboardHeight,
      safeAreaBottom,
    ],
  );
}
