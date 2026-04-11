/**
 * ComposerSheetContext
 *
 * Coordinates the composer (typing bar) position with keyboard-replacement
 * bottom sheets (emoji picker, GIF picker). Provides shared Reanimated values
 * so the footer can track the sheet position at 60fps on the UI thread.
 *
 * Flow:
 * 1. Button presses activateSheet() → captures keyboard height, dismisses keyboard
 * 2. Sheet opens to keyboard-equivalent height
 * 3. Sheet drives sheetTranslateY on every frame
 * 4. ChatFooterWrapper reads composerOffset (clamped to initial snap) and translates up
 * 5. When sheet expands past initial snap, composerOffset stays clamped
 * 6. On dismiss, deactivateSheet() resets everything
 */

import { getKeyboardReplacementSheetHeight } from "@/components/chat/bottomSheetLayout";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dimensions, Keyboard, Platform } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

const SCREEN_HEIGHT = Dimensions.get("window").height;

/** Sensible default keyboard height per platform (used when no keyboard has been opened yet) */
const DEFAULT_KEYBOARD_HEIGHT = Platform.select({ ios: 336, default: 280 });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ComposerSheetContextValue {
  /** Sheet's current translateY — driven by the active sheet on every animation frame.
   *  SCREEN_HEIGHT = fully hidden, lower = more visible. */
  sheetTranslateY: SharedValue<number>;

  /** The keyboard-equivalent height for the initial snap point.
   *  composerOffset is clamped to this value so the composer stops following
   *  once the sheet is dragged beyond this threshold. */
  initialSnapHeight: SharedValue<number>;

  /** 0 = no composer-attached sheet active, 1 = sheet is active.
   *  Used by KeyboardSafeAreaSpacer to collapse. */
  isSheetActive: SharedValue<number>;

  /** Extra content padding for KCSV — mirrors composerOffset so
   *  the chat message list shifts up to match the sheet. */
  sheetExtraPadding: SharedValue<number>;

  /** Last measured keyboard height (React state, not animated).
   *  Persists across sheet open/close cycles. */
  lastKeyboardHeight: number;

  /** Call when a composer-attached sheet is about to open.
   *  Captures the current keyboard height, dismisses the keyboard,
   *  and marks the sheet as active.
   *  If another sheet is already open, it will be dismissed first.
   *  Pass a `closeCallback` so the context can dismiss this sheet
   *  if a different picker opens later. */
  activateSheet: (
    currentKeyboardHeight?: number,
    closeCallback?: () => void,
  ) => void;

  /** Call when the sheet closes. Resets all shared values. */
  deactivateSheet: () => void;

  /** Dismiss the currently-active sheet (if any) by invoking its close callback.
   *  Used by SheetDismissLayer for tap/scroll-to-dismiss. */
  dismissActiveSheet: () => void;

  /** Update the stored keyboard height (called by the keyboard hook). */
  setLastKeyboardHeight: (height: number) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ComposerSheetContext = createContext<ComposerSheetContextValue | null>(
  null,
);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ComposerSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const sheetTranslateY = useSharedValue(SCREEN_HEIGHT);
  const initialSnapHeight = useSharedValue(0);
  const isSheetActive = useSharedValue(0);
  const sheetExtraPadding = useSharedValue(0);

  const [lastKeyboardHeight, setLastKbH] = useState(DEFAULT_KEYBOARD_HEIGHT);

  /** Ref to the close callback of the currently-active sheet.
   *  When a new sheet activates while another is open, we call this
   *  to dismiss the old one first (prevents stacking). */
  const activeCloseRef = useRef<(() => void) | null>(null);

  const setLastKeyboardHeight = useCallback((h: number) => {
    if (h > 0) setLastKbH(h);
  }, []);

  const activateSheet = useCallback(
    (currentKbHeight?: number, closeCallback?: () => void) => {
      // If another sheet is already open, dismiss it first
      if (activeCloseRef.current) {
        const prev = activeCloseRef.current;
        activeCloseRef.current = null; // clear before calling to prevent loops
        prev();
      }

      // Store the new sheet's close callback
      activeCloseRef.current = closeCallback ?? null;

      const kbH =
        currentKbHeight && currentKbHeight > 0
          ? currentKbHeight
          : lastKeyboardHeight;

      // Persist for future use
      if (kbH > 0) setLastKbH(kbH);

      const initialSheetHeight = getKeyboardReplacementSheetHeight(kbH);

      // Match the sheet's real keyboard-height snap so the composer/chat
      // stay aligned during the keyboard -> sheet handoff.
      initialSnapHeight.value = initialSheetHeight;
      isSheetActive.value = 1;

      // Pre-seed sheetTranslateY to the exact keyboard-height snap so the
      // shared animated value does not jump on the first frame.
      sheetTranslateY.value = SCREEN_HEIGHT - initialSheetHeight;

      // Dismiss keyboard — the sheet replaces it. The shared translateY is
      // already aligned to the sheet's real initial snap, so the keyboard ->
      // sheet handoff stays visually continuous while the keyboard animates out.
      Keyboard.dismiss();
    },
    [lastKeyboardHeight, initialSnapHeight, isSheetActive, sheetTranslateY],
  );

  const deactivateSheet = useCallback(() => {
    activeCloseRef.current = null;
    isSheetActive.value = 0;
    sheetTranslateY.value = SCREEN_HEIGHT;
    initialSnapHeight.value = 0;
    sheetExtraPadding.value = 0;
  }, [isSheetActive, sheetTranslateY, initialSnapHeight, sheetExtraPadding]);

  const dismissActiveSheet = useCallback(() => {
    if (activeCloseRef.current) {
      const close = activeCloseRef.current;
      activeCloseRef.current = null;
      close();
    }
  }, []);

  const value = useMemo<ComposerSheetContextValue>(
    () => ({
      sheetTranslateY,
      initialSnapHeight,
      isSheetActive,
      sheetExtraPadding,
      lastKeyboardHeight,
      activateSheet,
      deactivateSheet,
      dismissActiveSheet,
      setLastKeyboardHeight,
    }),
    [
      sheetTranslateY,
      initialSnapHeight,
      isSheetActive,
      sheetExtraPadding,
      lastKeyboardHeight,
      activateSheet,
      deactivateSheet,
      dismissActiveSheet,
      setLastKeyboardHeight,
    ],
  );

  return (
    <ComposerSheetContext.Provider value={value}>
      {children}
    </ComposerSheetContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Stub values returned when the provider is absent (non-chat contexts). */
const STUB_SHARED_VALUE = { value: 0 } as SharedValue<number>;
const STUB_TRANSLATE_Y = { value: SCREEN_HEIGHT } as SharedValue<number>;
const NOOP = () => {};

export function useComposerSheet(): ComposerSheetContextValue {
  const ctx = useContext(ComposerSheetContext);
  if (ctx) return ctx;

  // Graceful fallback — do nothing, all offsets stay 0
  return {
    sheetTranslateY: STUB_TRANSLATE_Y,
    initialSnapHeight: STUB_SHARED_VALUE,
    isSheetActive: STUB_SHARED_VALUE,
    sheetExtraPadding: STUB_SHARED_VALUE,
    lastKeyboardHeight: DEFAULT_KEYBOARD_HEIGHT,
    activateSheet: NOOP,
    deactivateSheet: NOOP,
    dismissActiveSheet: NOOP,
    setLastKeyboardHeight: NOOP,
  };
}
