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
import { chatDbg } from "@/utils/chatUiDebug";
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
const SHEET_HANDOFF_SAFETY_TIMEOUT_MS = 450;
const SHEET_HANDOFF_RELEASE_MS = 160;
const SHEET_DISMISS_DECAY_MS = 220;

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

  /** Floor offset that holds the composer position during sheet↔keyboard
   *  transitions.  Consumed by every bottom-offset derivation as
   *  `Math.max(computed, handoffFloor)`.
   *
   *  Used for three purposes:
   *    1. KB → sheet region lock — activateSheet snaps `handoffFloor = kbH`
   *       so the footer doesn't dip during the keyboard dismiss animation
   *       before the picker has driven `sheetTranslateY` up to snap.
   *    2. Sheet → KB handoff — the wasHandoff branch of deactivateSheet
   *       captures the sheet's current visible height into the floor so
   *       the footer stays put until the keyboard rises to meet it.
   *    3. Non-handoff dismiss smooth decay — deactivateSheet's non-handoff
   *       branch snapshots the current unified offset into the floor and
   *       then animates it to 0 via a short timing curve.  This makes
   *       the composer slide down smoothly instead of teleporting.
   */
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

      // ── Cancel any stale pending main-input→keyboard handoff ──────────
      // `handoffPendingRef` is set by `beginKeyboardHandoff()` when the
      // main composer input gains focus.  Opening a picker is the
      // OPPOSITE direction of a handoff (keyboard → sheet, not sheet →
      // keyboard), so any pending handoff expectation is stale and MUST
      // be cleared here.
      //
      // Without this reset, `handoffPendingRef` can latch `true` forever
      // once the user has ever focused the composer, because
      // `deactivateSheet` only clears it on the wasHandoff branch.
      // That stale flag was the root cause of the "slow drag → picker
      // closes but toolbar stays lifted" bug: a slow interactive drag
      // that took longer than the safety window to trigger `dismissActiveSheet` would hit
      // `deactivateSheet` with `handoffPendingRef === true`, take the
      // handoff branch, and capture a `handoffFloor` that no catch-up
      // reaction could clear (sheet is already dismissed, no keyboard
      // is rising to meet it).  Fast drags and taps completed inside
      // the safety timer window from the previous activateSheet,
      // which would then decay the bogus floor via `withTiming(0)` —
      // masking the bug for everything except the slow-drag path.
      const hadPendingHandoff = handoffPendingRef.current;
      if (hadPendingHandoff) {
        handoffPendingRef.current = false;
      }

      // ── Cancel in-flight floor decay (from a prior non-handoff close) ──
      // A new picker is opening.  We want it to establish its own
      // region-lock floor from scratch, not race with the decaying tail
      // of the previous dismiss animation.
      handoffFloor.value = 0;

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
      // (edge case), decay the lock so the UI isn't stuck.
      if (kbH > 0) {
        handoffTimerRef.current = setTimeout(() => {
          handoffTimerRef.current = null;
          if (handoffFloor.value > 0) {
            handoffFloor.value = withTiming(0, {
              duration: SHEET_HANDOFF_RELEASE_MS,
            });
          }
        }, SHEET_HANDOFF_SAFETY_TIMEOUT_MS);
      }

      chatDbg("activateSheet", {
        hadPendingHandoff,
        kbH: Math.round(kbH),
        liveKbH: Math.round(liveKbH),
        initialSheetHeight: Math.round(initialSheetHeight),
        hasExistingSheet: switchingRef.current,
      });

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
    if (switchingRef.current) {
      chatDbg("deactivateSheet:switching-skip", {});
      return;
    }

    // Snapshot whether this dismiss is part of a sheet→keyboard handoff
    // BEFORE the capture block mutates the ref.  The defensive-reset branch
    // below must read this snapshot, not the ref — otherwise the ref's
    // in-block reset to false makes every branch look like a non-handoff
    // dismiss and immediately erases the floor we just captured.
    const wasHandoff = handoffPendingRef.current;

    // Snapshot the pre-teardown shared-value state for debug correlation.
    const preSheetVisible = Math.max(0, SCREEN_HEIGHT - sheetTranslateY.value);
    const preKbH = Math.abs(liveKeyboardHeight.value);
    const preFloor = handoffFloor.value;
    const preSnap = initialSnapHeight.value;

    // ── Sheet → keyboard handoff ──────────────────────────────────────────
    // When the composer is about to gain focus (keyboard opening), capture
    // the current effective sheet offset as a floor so every bottom-offset
    // derivation stays ≥ this value until the keyboard takes over.  This
    // prevents the transient drop-to-baseline frame that occurs when
    // isSheetActive resets to 0 before keyboardHeight has risen.
    if (wasHandoff) {
      const clamped = Math.min(preSheetVisible, Math.max(0, preSnap));
      const capturedFloor = Math.max(0, clamped);
      handoffFloor.value = capturedFloor;
      handoffPendingRef.current = false;

      chatDbg("deactivateSheet:handoff-branch", {
        preSheetVisible: Math.round(preSheetVisible),
        preSnap: Math.round(preSnap),
        capturedFloor: Math.round(capturedFloor),
        preKbH: Math.round(preKbH),
      });

      if (ENABLE_HANDOFF_DIAGNOSTICS) {
        // eslint-disable-next-line no-console
        console.log("[HandoffDiag] floor captured", {
          sheetVisible: preSheetVisible,
          initialSnapHeight: preSnap,
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

    if (!wasHandoff) {
      // ── Non-handoff dismiss: smooth decay to baseline ──────────────────
      //
      // The user tapped outside / slow-dragged / fast-swiped the picker
      // away without requesting a composer-focus handoff.  The composer
      // must return to baseline smoothly, without teleporting.
      //
      // Strategy: capture the current effective footer offset (the visual
      // height the composer is currently lifted by) into `handoffFloor`,
      // then animate the floor to 0.  The
      // sheet-inactive branches of `useEffectiveBottomInset`,
      // `unifiedFooterOffset`, and `useKeyboardBackdropHeight` are all
      // `max(kbH, floor)` — as the floor decays the composer follows it
      // down smoothly, and if the OS keyboard is also animating down
      // (e.g. picker search TextInput blurred by Keyboard.dismiss() below)
      // the two decays run concurrently and `max()` stays smooth all the
      // way to 0.
      //
      // This replaces the previous `postDismissSuppress` approach which
      // force-clamped the offset to 0 in a single frame — a visual
      // teleport.  The animated floor decay makes every non-handoff
      // dismiss (tap, slow drag, fast drag, swipe down, backdrop tap)
      // look identical: a clean short slide to baseline.
      const currentEffectiveOffset = Math.max(
        preKbH,
        // Sheet-active branch was using max(kbH, clamped, floor).  Mirror
        // that here so the decay starts from the exact value the composer
        // was visually at the instant before we flipped isSheetActive.
        Math.min(preSheetVisible, preSnap > 0 ? preSnap : preSheetVisible),
        preFloor,
      );

      sheetExtraPadding.value = 0;

      if (currentEffectiveOffset > 0) {
        // Seed the floor to the current offset so there is no 1-frame
        // drop when isSheetActive flips to 0 (the sheet-inactive branch
        // now reads `max(kbH, floor) = currentEffectiveOffset`).  Then
        // animate the floor to 0.
        handoffFloor.value = currentEffectiveOffset;
        handoffFloor.value = withTiming(0, {
          duration: SHEET_DISMISS_DECAY_MS,
        });
      } else {
        handoffFloor.value = 0;
      }

      // Cancel the activateSheet safety timer so a stale `withTiming(0)`
      // doesn't fire later and re-animate our floor.
      if (handoffTimerRef.current) {
        clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }

      // Pickers with `keepMountedWhenClosed` (GIF, Sticker, GifSticker)
      // keep their subtree — including the search TextInput — mounted
      // after `open` flips to false.  If the user tapped that search
      // input while the picker was extended, its OS keyboard came up.
      // Dismissing here forces the picker's search input to blur and
      // the OS keyboard to retract on the next frame.  Because our
      // floor decay is driving the composer position to 0 in parallel,
      // the composer's downward animation is already committed even
      // while the OS keyboard is still retracting — no stuck toolbar.
      Keyboard.dismiss();

      chatDbg("deactivateSheet:non-handoff", {
        preKbH: Math.round(preKbH),
        preSheetVisible: Math.round(preSheetVisible),
        preSnap: Math.round(preSnap),
        preFloor: Math.round(preFloor),
        decayFrom: Math.round(currentEffectiveOffset),
        hadPendingHandoff: false,
      });
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
    chatDbg("dismissActiveSheet", {
      hasActiveSheet: !!activeCloseRef.current,
    });
    if (activeCloseRef.current) {
      const close = activeCloseRef.current;
      activeCloseRef.current = null;
      close();
    }
  }, []);

  const beginKeyboardHandoff = useCallback(() => {
    handoffPendingRef.current = true;

    chatDbg("beginKeyboardHandoff", {
      isSheetActive: isSheetActive.value,
      sheetTranslateY: Math.round(sheetTranslateY.value),
      initialSnapHeight: Math.round(initialSnapHeight.value),
      liveKeyboardHeight: Math.round(liveKeyboardHeight.value),
      handoffFloor: Math.round(handoffFloor.value),
    });

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
    // case), smoothly decay the floor so the UI isn't stuck.
    //
    // Critically: ALSO reset `handoffPendingRef` when this timer fires.
    // Without that reset, if the user never triggers a sheet dismiss
    // within the safety window, the pending-handoff flag latches `true` forever and
    // the next sheet dismiss incorrectly takes the handoff branch —
    // causing the slow-drag "toolbar stays open" bug.
    if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current);
    handoffTimerRef.current = setTimeout(() => {
      handoffTimerRef.current = null;
      const hadPending = handoffPendingRef.current;
      if (hadPending) {
        handoffPendingRef.current = false;
      }
      if (handoffFloor.value > 0) {
        if (ENABLE_HANDOFF_DIAGNOSTICS) {
          // eslint-disable-next-line no-console
          console.log("[HandoffDiag] safety timer clearing floor", {
            floor: handoffFloor.value,
          });
        }
        handoffFloor.value = withTiming(0, {
          duration: SHEET_HANDOFF_RELEASE_MS,
        });
      }
      chatDbg("beginKeyboardHandoff:safetyTimerFired", {
        clearedPending: hadPending,
        floorAtFire: Math.round(handoffFloor.value),
      });
    }, SHEET_HANDOFF_SAFETY_TIMEOUT_MS);
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
