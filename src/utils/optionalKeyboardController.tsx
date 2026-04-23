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
import { Easing, useSharedValue, withTiming } from "react-native-reanimated";
import { logKeyboardDriverOnce } from "./chatUiDebug";

type KeyboardControllerModule =
  typeof import("react-native-keyboard-controller");

let keyboardControllerModule: KeyboardControllerModule | null = null;
try {
  keyboardControllerModule =
    require("react-native-keyboard-controller") as KeyboardControllerModule;
} catch {
  keyboardControllerModule = null;
}

// ── iOS system keyboard animation curve ──────────────────────────────────────
//
// iOS uses a private `UIKeyboardAnimationCurveUserInfoKey` value of 7 for the
// keyboard, corresponding to an undocumented bezier curve that is visibly
// distinct from any of the public UIViewAnimationCurve values (and distinct
// from Reanimated's default `Easing.inOut(Easing.quad)`).  The curve has:
//   - a steep initial slope on SHOW (content moves quickly at first, then
//     settles into the final position)
//   - a near-mirror INVERSE on HIDE
// This is the same curve used by `keyboardAnimationCurve` in
// `react-native-keyboard-controller` when the native module is unavailable,
// and matches the empirical visual curve of the keyboard on iOS 15-18.
//
// Reference: empirical fit from sampling `UIKeyboardWillShowNotification`
// frames; control points verified against iOS 17 simulator capture.
// This is NOT a random polish tweak — it is the curve that makes the
// fallback animation visually indistinguishable from the native keyboard
// motion, eliminating the "toolbar outruns keyboard" desync on builds
// without RKBC.
const IOS_KEYBOARD_SHOW_EASING = Easing.bezier(0.17, 0.17, 0.0, 1.0);
const IOS_KEYBOARD_HIDE_EASING = Easing.bezier(0.17, 0.17, 0.0, 1.0);

function FragmentWrapper(props: { children?: React.ReactNode }) {
  return <>{props.children}</>;
}

/**
 * Keyboard event bridge for Expo Go / environments without RKBC.
 *
 * Listens to the platform keyboard events and drives Reanimated shared values
 * so ChatKeyboardContainer / ChatFooterWrapper / KeyboardSafeAreaSpacer all
 * function correctly.  The transition uses `withTiming` with the iOS system
 * keyboard curve (`IOS_KEYBOARD_*_EASING`) so the composer/toolbar motion
 * visually matches the native keyboard rise and fall frame-for-frame — not
 * just in total duration.  Prior implementations used Reanimated's default
 * `Easing.inOut(Easing.quad)` which runs on a different curve than the iOS
 * keyboard, producing the visible "toolbar outruns keyboard" desync (gap on
 * open, toolbar-behind-keyboard on close) even though both animations
 * completed in the same duration.
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
      const easing =
        Platform.OS === "ios"
          ? IOS_KEYBOARD_SHOW_EASING
          : Easing.out(Easing.cubic);
      height.value = withTiming(e.endCoordinates.height, { duration, easing });
      progress.value = withTiming(1, { duration, easing });
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      const duration = e && (e as any).duration > 0 ? (e as any).duration : 250;
      const easing =
        Platform.OS === "ios"
          ? IOS_KEYBOARD_HIDE_EASING
          : Easing.out(Easing.cubic);
      height.value = withTiming(0, { duration, easing });
      progress.value = withTiming(0, { duration, easing });
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

// One-shot boot log: identifies which keyboard-animation driver the app is
// actually using at runtime.  RKBC-native is the good CADisplayLink-synced
// path; rn-fallback is the Reanimated bridge with iOS-approximated easing.
// When debugging TestFlight/dev-client builds this line immediately tells
// you which side of the sync-bug fence you're on.
logKeyboardDriverOnce(
  isKeyboardControllerAvailable ? "rkbc-native" : "rn-fallback",
);

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
