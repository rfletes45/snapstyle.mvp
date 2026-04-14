/**
 * Optional keyboard-controller compatibility layer.
 *
 * Expo Go and some native runtimes do not include react-native-keyboard-controller.
 * Import this module instead of importing the package directly when the app
 * must remain bootable without that native dependency.
 *
 * Fallback: When RKBC is unavailable the fallback hook bridges RN Keyboard
 * events into Reanimated shared values so the chat keyboard container still
 * animates (step-wise rather than 60 fps, but functional).
 */

import React, { useEffect } from "react";
import {
  Keyboard,
  Platform,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
} from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";

type KeyboardControllerModule =
  typeof import("react-native-keyboard-controller");

let keyboardControllerModule: KeyboardControllerModule | null = null;
try {
  keyboardControllerModule =
    require("react-native-keyboard-controller") as KeyboardControllerModule;
} catch {
  keyboardControllerModule = null;
}

function FragmentWrapper(props: { children?: React.ReactNode }) {
  return <>{props.children}</>;
}

/**
 * Keyboard event bridge for Expo Go / environments without RKBC.
 *
 * Listens to the platform keyboard events and drives Reanimated shared values
 * so ChatKeyboardContainer / ChatFooterWrapper / KeyboardSafeAreaSpacer all
 * function correctly.  The transition uses `withTiming` for a smooth animated
 * feel rather than an abrupt jump.
 */
function useFallbackKeyboardAnimation() {
  const height = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    // iOS: keyboardWillShow fires before animation starts (smoother).
    // Android: only keyboardDidShow is reliable.
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const duration = e.duration > 0 ? e.duration : 250;
      height.value = withTiming(e.endCoordinates.height, { duration });
      progress.value = withTiming(1, { duration });
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      const duration = e && (e as any).duration > 0 ? (e as any).duration : 250;
      height.value = withTiming(0, { duration });
      progress.value = withTiming(0, { duration });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [height, progress]);

  return { height, progress };
}

const noopKeyboardHandler = (_handlers: unknown) => {};

export const isKeyboardControllerAvailable = keyboardControllerModule !== null;

export const KeyboardProvider: React.ComponentType<any> =
  keyboardControllerModule?.KeyboardProvider ?? FragmentWrapper;

export const KeyboardAvoidingView: React.ComponentType<any> =
  keyboardControllerModule?.KeyboardAvoidingView ?? RNKeyboardAvoidingView;

export const KeyboardStickyView: React.ComponentType<any> =
  keyboardControllerModule?.KeyboardStickyView ?? FragmentWrapper;

export const KeyboardChatScrollView =
  keyboardControllerModule?.KeyboardChatScrollView ?? null;

export const useKeyboardHandlerCompat =
  keyboardControllerModule?.useKeyboardHandler ?? noopKeyboardHandler;

export const useReanimatedKeyboardAnimationCompat =
  keyboardControllerModule?.useReanimatedKeyboardAnimation ??
  useFallbackKeyboardAnimation;
