/**
 * NativeKeyboard View
 *
 * React component wrapping the native iOS composer view.
 * On Android or when the native view is unavailable, this renders null
 * (callers should check `isNativeComposerAvailable` first).
 *
 * NOTE: In Expo Go, `requireNativeViewManager` does NOT throw — it returns
 * a stub component that renders "Unimplemented component" text. We guard
 * against this by also checking that the native *module* loaded successfully,
 * since `requireNativeModule` does throw in Expo Go.
 */

import React from "react";
import { Platform } from "react-native";
import { isNativeKeyboardModuleAvailable } from "./NativeKeyboardModule";
import type { NativeComposerViewProps } from "./types";

let NativeViewComponent: React.ComponentType<any> | null = null;

if (Platform.OS === "ios" && isNativeKeyboardModuleAvailable) {
  try {
    const { requireNativeViewManager } = require("expo-modules-core");
    NativeViewComponent = requireNativeViewManager("NativeKeyboard");
  } catch {
    NativeViewComponent = null;
  }
}

/** Whether the native composer view is available for rendering. */
export const isNativeComposerAvailable = NativeViewComponent !== null;

/**
 * Native iOS composer view backed by UITextView + custom inputView keyboard.
 * Must only be rendered when `isNativeComposerAvailable` is true.
 */
export default function NativeComposerView(props: NativeComposerViewProps) {
  if (!NativeViewComponent) return null;
  return <NativeViewComponent {...props} />;
}
