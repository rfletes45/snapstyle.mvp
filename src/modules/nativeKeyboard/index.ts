/**
 * NativeKeyboard — Expo native module for iOS custom keyboard
 *
 * Provides:
 * - NativeComposerView: UITextView-backed composer with custom inputView keyboard
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
