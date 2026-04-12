/**
 * NativeKeyboard Module Bridge
 *
 * Provides imperative functions to control the native composer:
 * focus, blur, clear, and text insertion.
 *
 * These functions are no-ops on Android or when the native module
 * is unavailable (e.g. Expo Go).
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Detect Expo Go where native modules compiled from local `modules/` are
 * NOT available. Matches the pattern in constants/featureFlags.ts.
 */
const IS_EXPO_GO =
  Constants.executionEnvironment === "storeClient" ||
  Constants.appOwnership === "expo" ||
  Constants.expoVersion != null;

let mod: any = null;

if (Platform.OS === "ios" && !IS_EXPO_GO) {
  try {
    const { requireNativeModule } = require("expo-modules-core");
    mod = requireNativeModule("NativeKeyboard");
  } catch {
    // Module not available — dev build not yet created
    mod = null;
  }
}

/** Whether the native keyboard module is loaded and available. */
export const isNativeKeyboardModuleAvailable = mod !== null;

/** Make the native composer first responder (show keyboard). */
export function focus(): void {
  mod?.focus();
}

/** Resign first responder on the native composer (hide keyboard). */
export function blur(): void {
  mod?.blur();
}

/** Clear the native composer text immediately. */
export function clear(): void {
  mod?.clear();
}

/** Insert text at the native composer's current cursor position. */
export function insertTextAtCursor(text: string): void {
  mod?.insertTextAtCursor(text);
}

/** Set the cursor position in the native composer. */
export function setCursorPosition(position: number): void {
  mod?.setCursorPosition(position);
}
