/**
 * Optional keyboard-controller compatibility layer.
 *
 * Expo Go and some native runtimes do not include react-native-keyboard-controller.
 * Import this module instead of importing the package directly when the app
 * must remain bootable without that native dependency.
 */

import React from "react";
import { KeyboardAvoidingView as RNKeyboardAvoidingView } from "react-native";
import { useSharedValue } from "react-native-reanimated";

type KeyboardControllerModule = typeof import("react-native-keyboard-controller");

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

function useFallbackKeyboardAnimation() {
  const height = useSharedValue(0);
  const progress = useSharedValue(0);

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
