/**
 * NativeKeyboard — Expo native module for iOS composer
 *
 * Provides:
 * - NativeComposerView: UITextView-backed composer with Apple's system keyboard
 * - Imperative functions: focus, blur, clear, insertTextAtCursor
 * - Availability checks for runtime feature detection
 */

export {
  blur,
  clear,
  focus,
  insertTextAtCursor,
  isNativeKeyboardModuleAvailable,
  setCursorPosition,
} from "./NativeKeyboardModule";
export {
  isNativeComposerAvailable,
  default as NativeComposerView,
} from "./NativeKeyboardView";
export type * from "./types";
