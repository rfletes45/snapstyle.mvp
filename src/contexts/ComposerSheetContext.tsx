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
import { useFocusEffect } from "@react-navigation/native";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dimensions, Keyboard, Platform } from "react-native";
import {
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const SCREEN_HEIGHT = Dimensions.get("window").height;

/** Sensible default keyboard height per platform (used when no keyboard has been opened yet) */
const DEFAULT_KEYBOARD_HEIGHT = Platform.select({ ios: 336, default: 280 });

// Toggle for handoff diagnostics — set to true to trace the full
// sheet→keyboard transition timeline in dev builds.
const ENABLE_HANDOFF_DIAGNOSTICS = __DEV__ && false;

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

  /** Live RKBC keyboard height (SharedValue, negative when open).
   *  Piped by ChatFooterWrapper's useAnimatedReaction so activateSheet
   *  can read the real keyboard height at call-time instead of lagging
   *  2-3 frames behind via React state. */
  liveKeyboardHeight: SharedValue<number>;

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

  /** Floor offset that holds the composer position during sheet→keyboard
   *  handoff, preventing the transient drop to baseline.  Consumed by
   *  every bottom-offset derivation as `Math.max(computed, handoffFloor)`. */
  handoffFloor: SharedValue<number>;

  /** Signal that the next deactivateSheet should capture a handoff floor
   *  because the keyboard is about to open (composer focus). */
  beginKeyboardHandoff: () => void;

  /** Dismiss ALL transient chat overlay UI: active sheet + keyboard.
   *  This is the single canonical "collapse everything" path.
   *  Used by return-to-bottom, navigation blur, and screen unmount. */
  dismissAllTransientUi: () => void;
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
  const liveKeyboardHeight = useSharedValue(0);
  const handoffFloor = useSharedValue(0);

  const [lastKeyboardHeight, setLastKbH] = useState(DEFAULT_KEYBOARD_HEIGHT);

  /** Ref to the close callback of the currently-active sheet.
   *  When a new sheet activates while another is open, we call this
   *  to dismiss the old one first (prevents stacking). */
  const activeCloseRef = useRef<(() => void) | null>(null);

  /** True while activateSheet is switching from one picker to another.
   *  Prevents deactivateSheet from resetting shared animated values (translateY,
   *  isSheetActive, etc.) so there is no visible gap between sheets. */
  const switchingRef = useRef(false);

  /** True when the next deactivateSheet should capture the current effective
   *  sheet height into handoffFloor (because the keyboard is about to open). */
  const handoffPendingRef = useRef(false);

  /** Safety timer ID — clears handoffFloor if the keyboard never arrives. */
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setLastKeyboardHeight = useCallback((h: number) => {
    if (h > 0) setLastKbH(h);
  }, []);

  const activateSheet = useCallback(
    (currentKbHeight?: number, closeCallback?: () => void) => {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[ChatTransientUi] activateSheet", {
          hasExistingSheet: !!activeCloseRef.current,
        });
      }
      // If another sheet is already open, dismiss it — but delay the
      // teardown to the next frame so both Portals overlap briefly.
      // React Native Paper's Portal uses componentDidMount/componentWillUnmount
      // → PortalManager.setState, which re-renders one frame later. Without
      // the overlap, there is a 1-frame gap where neither Portal is visible
      // (the old one unregistered, the new one not yet registered).
      if (activeCloseRef.current) {
        const prev = activeCloseRef.current;
        activeCloseRef.current = null;
        requestAnimationFrame(() => {
          switchingRef.current = true;
          prev();
          switchingRef.current = false;
        });
      }

      // Store the new sheet's close callback
      activeCloseRef.current = closeCallback ?? null;

      // Prefer the live RKBC keyboard height (SharedValue) over stale React
      // state. Reading .value on the JS thread is synchronous and always
      // returns the latest UI-thread value. This eliminates the 2-3 frame
      // lag that lastKeyboardHeight (React state) has relative to the actual
      // keyboard position, preventing the upward teleport on the first frame
      // when sheetHeight ≠ actual keyboard height.
      const liveKbH = Math.abs(liveKeyboardHeight.value);
      const kbH =
        currentKbHeight && currentKbHeight > 0
          ? currentKbHeight
          : liveKbH > 0
            ? liveKbH
            : lastKeyboardHeight;

      // Persist for future use
      if (kbH > 0) setLastKbH(kbH);

      // Clear any previous pending safety timer.  We will set a new lock
      // (handoffFloor) below that protects the keyboard→sheet transition;
      // its own catch-up logic will clear it when the sheet's own animation
      // has fully driven sheetTranslateY into place.
      if (handoffTimerRef.current) {
        clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }

      const initialSheetHeight = getKeyboardReplacementSheetHeight(kbH);

      // ── Region lock during KB → sheet handoff ────────────────────────────
      // If the keyboard is currently up, lock the bottom region at its
      // current height.  This prevents the transient chat-list teleport
      // that occurs when the picker mounts and its own animation briefly
      // resets sheetTranslateY to its starting value before animating up
      // to the pre-seeded snap.  Without this lock, for a few frames both
      // kbH (dropping) and sheetVisible (not yet driven) are near zero,
      // causing unifiedFooterOffset to drop and the chat list to fall
      // downward before being lifted back up once the picker settles.
      //
      // The lock clears in ChatFooterWrapper the moment EITHER the sheet
      // or the returning keyboard catches up to the lock height.
      if (kbH > 0) {
        handoffFloor.value = kbH;
      } else {
        handoffFloor.value = 0;
      }

      // Match the sheet's real keyboard-height snap so the composer/chat
      // stay aligned during the keyboard -> sheet handoff.
      initialSnapHeight.value = initialSheetHeight;
      isSheetActive.value = 1;

      // Pre-seed sheetTranslateY to the exact keyboard-height snap so the
      // shared animated value does not jump on the first frame.
      sheetTranslateY.value = SCREEN_HEIGHT - initialSheetHeight;

      // Safety: if the picker never mounts or never drives sheetTranslateY
      // (edge case), decay the lock after 600ms so the UI isn't stuck.
      if (kbH > 0) {
        handoffTimerRef.current = setTimeout(() => {
          handoffTimerRef.current = null;
          if (handoffFloor.value > 0) {
            handoffFloor.value = withTiming(0, { duration: 200 });
          }
        }, 600);
      }

      // Dismiss keyboard — the sheet replaces it. The shared translateY is
      // already aligned to the sheet's real initial snap, so the keyboard ->
      // sheet handoff stays visually continuous while the keyboard animates out.
      Keyboard.dismiss();
    },
    [
      lastKeyboardHeight,
      liveKeyboardHeight,
      initialSnapHeight,
      isSheetActive,
      sheetTranslateY,
      handoffFloor,
    ],
  );

  const deactivateSheet = useCallback(() => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[ChatTransientUi] deactivateSheet", {
        switching: switchingRef.current,
        handoffPending: handoffPendingRef.current,
      });
    }
    // When switching between sheets, skip ALL teardown — the new sheet's
    // close callback is already stored in activeCloseRef by activateSheet(),
    // and clearing it here would break future switches. The animated values
    // are also preserved so there is no 1-frame gap where the sheet disappears.
    if (switchingRef.current) return;

    // ── Sheet → keyboard handoff ──────────────────────────────────────────
    // When the composer is about to gain focus (keyboard opening), capture
    // the current effective sheet offset as a floor so every bottom-offset
    // derivation stays ≥ this value until the keyboard takes over.  This
    // prevents the transient drop-to-baseline frame that occurs when
    // isSheetActive resets to 0 before keyboardHeight has risen.
    if (handoffPendingRef.current) {
      const sheetVisible = Math.max(0, SCREEN_HEIGHT - sheetTranslateY.value);
      const clamped = Math.min(
        sheetVisible,
        Math.max(0, initialSnapHeight.value),
      );
      const capturedFloor = Math.max(0, clamped);
      handoffFloor.value = capturedFloor;
      handoffPendingRef.current = false;

      if (ENABLE_HANDOFF_DIAGNOSTICS) {
        // eslint-disable-next-line no-console
        console.log("[HandoffDiag] floor captured", {
          sheetVisible,
          initialSnapHeight: initialSnapHeight.value,
          clamped,
          capturedFloor,
          sheetExtraPadding: sheetExtraPadding.value,
          liveKeyboardHeight: liveKeyboardHeight.value,
        });
      }
    }

    activeCloseRef.current = null;
    isSheetActive.value = 0;
    sheetTranslateY.value = SCREEN_HEIGHT;
    initialSnapHeight.value = 0;
    // When this dismiss is NOT part of a sheet→keyboard handoff (e.g. tap-
    // to-dismiss, drag-to-dismiss, swipe-close, backdrop-tap), there is no
    // reason to keep any residual sheet state alive.  Explicitly zero out
    // sheetExtraPadding and handoffFloor so the footer/list/backdrop all
    // collapse cleanly to baseline in the same frame that isSheetActive
    // flips to 0, eliminating the "toolbar stays elevated with empty space
    // below it" race that can occur if the owning reaction in
    // ChatFooterWrapper does not re-fire for multiple frames.
    //
    // During an actual handoff (handoffPendingRef was true above) we do
    // NOT reset these values — the floor captured above is what keeps the
    // footer stable until the keyboard catches up.
    if (!handoffPendingRef.current) {
      sheetExtraPadding.value = 0;
      if (handoffFloor.value !== 0) {
        handoffFloor.value = 0;
      }
    }
  }, [
    isSheetActive,
    sheetTranslateY,
    initialSnapHeight,
    handoffFloor,
    sheetExtraPadding,
    liveKeyboardHeight,
  ]);

  const dismissActiveSheet = useCallback(() => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[ChatTransientUi] dismissActiveSheet", {
        hasActiveSheet: !!activeCloseRef.current,
      });
    }
    if (activeCloseRef.current) {
      const close = activeCloseRef.current;
      activeCloseRef.current = null;
      close();
    }
  }, []);

  const beginKeyboardHandoff = useCallback(() => {
    handoffPendingRef.current = true;

    if (ENABLE_HANDOFF_DIAGNOSTICS) {
      // eslint-disable-next-line no-console
      console.log("[HandoffDiag] beginKeyboardHandoff", {
        isSheetActive: isSheetActive.value,
        sheetTranslateY: sheetTranslateY.value,
        initialSnapHeight: initialSnapHeight.value,
        liveKeyboardHeight: liveKeyboardHeight.value,
        sheetExtraPadding: sheetExtraPadding.value,
        handoffFloor: handoffFloor.value,
        lastKeyboardHeight,
      });
    }

    // Safety: if the keyboard never opens (e.g. hardware keyboard, edge
    // case), smoothly decay the floor after 600 ms so the UI isn't stuck.
    if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current);
    handoffTimerRef.current = setTimeout(() => {
      handoffTimerRef.current = null;
      if (handoffFloor.value > 0) {
        if (ENABLE_HANDOFF_DIAGNOSTICS) {
          // eslint-disable-next-line no-console
          console.log("[HandoffDiag] safety timer clearing floor", {
            floor: handoffFloor.value,
          });
        }
        handoffFloor.value = withTiming(0, { duration: 200 });
      }
    }, 600);
  }, [
    handoffFloor,
    isSheetActive,
    sheetTranslateY,
    initialSnapHeight,
    liveKeyboardHeight,
    sheetExtraPadding,
    lastKeyboardHeight,
  ]);

  // ── Unified collapse path ───────────────────────────────────────────────
  // Single canonical function that tears down ALL transient chat overlay UI:
  // active sheet + keyboard + handoff state.  Every dismiss path (return-to-
  // bottom, navigation blur, screen unmount, tab switch) should funnel
  // through this instead of calling dismiss/deactivate individually.
  const dismissAllTransientUi = useCallback(() => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[ChatTransientUi] dismissAllTransientUi");
    }

    // 1. Dismiss active sheet (if any) via its close callback.
    //    The close callback calls deactivateSheet() internally,
    //    which resets all sheet-related shared values.
    if (activeCloseRef.current) {
      const close = activeCloseRef.current;
      activeCloseRef.current = null;
      close();
    } else {
      // No active sheet — still reset shared values defensively
      // in case of stale state from a previous incomplete teardown.
      deactivateSheet();
    }

    // 2. Clear any pending handoff floor to prevent stale offsets.
    if (handoffTimerRef.current) {
      clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = null;
    }
    handoffFloor.value = 0;
    handoffPendingRef.current = false;

    // 3. Dismiss the keyboard so no overlay remains.
    Keyboard.dismiss();
  }, [deactivateSheet, handoffFloor]);

  const value = useMemo<ComposerSheetContextValue>(
    () => ({
      sheetTranslateY,
      initialSnapHeight,
      isSheetActive,
      sheetExtraPadding,
      liveKeyboardHeight,
      lastKeyboardHeight,
      activateSheet,
      deactivateSheet,
      dismissActiveSheet,
      setLastKeyboardHeight,
      handoffFloor,
      beginKeyboardHandoff,
      dismissAllTransientUi,
    }),
    [
      sheetTranslateY,
      initialSnapHeight,
      isSheetActive,
      sheetExtraPadding,
      liveKeyboardHeight,
      lastKeyboardHeight,
      activateSheet,
      deactivateSheet,
      dismissActiveSheet,
      setLastKeyboardHeight,
      handoffFloor,
      beginKeyboardHandoff,
      dismissAllTransientUi,
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
    liveKeyboardHeight: STUB_SHARED_VALUE,
    lastKeyboardHeight: DEFAULT_KEYBOARD_HEIGHT,
    activateSheet: NOOP,
    deactivateSheet: NOOP,
    dismissActiveSheet: NOOP,
    setLastKeyboardHeight: NOOP,
    handoffFloor: STUB_SHARED_VALUE,
    beginKeyboardHandoff: NOOP,
    dismissAllTransientUi: NOOP,
  };
}

// ─── Navigation Lifecycle Hook ───────────────────────────────────────────────

/**
 * Dismiss all chat-owned transient UI (sheets, keyboard) when the owning
 * screen loses focus.  Works with `freezeOnBlur: true` because the blur
 * event fires BEFORE the screen is frozen.
 *
 * Call this hook in every chat screen (DM, GroupChat, Thread) to enforce
 * the invariant: navigating away always dismisses chat-owned overlays.
 */
export function useDismissTransientUiOnBlur(): void {
  const { dismissAllTransientUi } = useComposerSheet();

  useFocusEffect(
    useCallback(() => {
      // Focus callback — nothing to do on focus.
      return () => {
        // Blur callback — dismiss everything.
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log("[ChatTransientUi] screen blur → dismissAllTransientUi");
        }
        dismissAllTransientUi();
      };
    }, [dismissAllTransientUi]),
  );
}
