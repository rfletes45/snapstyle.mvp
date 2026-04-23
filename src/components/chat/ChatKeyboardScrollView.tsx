/**
 * ChatKeyboardScrollView
 *
 * Adapter that lets FlatList use KeyboardChatScrollView (KCSV) as its
 * underlying scroll component via `renderScrollComponent`.
 *
 * Architecture:
 * - PRIMARY: native keyboard-controller scroll + sticky footer
 * - FALLBACK: Animated paddingBottom container that tracks the effective
 *   bottom inset (keyboard height + composer sheet offset). This replaces
 *   the old KeyboardAvoidingView approach which only knew about the
 *   keyboard — not composer-attached sheets — causing the chat to drop
 *   when a sheet replaces the keyboard.
 *
 * This file must remain safe to import in Expo Go.
 */

import { useComposerSheet } from "@/contexts/ComposerSheetContext";
import { useAppTheme } from "@/store/ThemeContext";
import {
  KEYBOARD_TOOLBAR_SYNC_THRESHOLD_PX,
  MOTION_JUMP_THRESHOLD_PX,
  chatDbg,
  logKeyboardToolbarSync,
  reportOffsetJump,
} from "@/utils/chatUiDebug";
import {
  isKeyboardControllerAvailable,
  useReanimatedKeyboardAnimationCompat,
} from "@/utils/optionalKeyboardController";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import {
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FOOTER_SCREEN_HEIGHT = Dimensions.get("window").height;
const KEYBOARD_BACKDROP_Z_INDEX = 10;
const CHAT_FOOTER_Z_INDEX = 20;
const ENABLE_KEYBOARD_BACKDROP_DEBUG = false;

// Fixed height of the chat header (see ChatHeader.tsx → HEADER_LAYOUT.height).
// Used by the keyboard-transition interaction gate to position its overlay
// strictly below the header so header controls remain interactive while the
// keyboard is animating.  Must stay in sync with ChatHeader.
const CHAT_HEADER_HEIGHT = 46;

// Toggle for handoff transition diagnostics — mirrors the flag in
// ComposerSheetContext.  Set to true when debugging sheet→keyboard
// handoff timing in native/TestFlight builds.
const ENABLE_HANDOFF_DIAGNOSTICS = __DEV__ && false;

// KCSV (KeyboardChatScrollView) is the native-only chat-scroll component from
// react-native-keyboard-controller.  It owns contentInset + scroll-correction
// math via `useExtraContentPadding`, which on this codebase produced visible
// chat-list motion during sheet↔keyboard transitions (the scroll-correction
// reaction calls scrollTo on every `extraContentPadding` delta, and the
// `blankSpace`/lift-behavior interactions don't fully neutralize it).
//
// The fallback path — an Animated.View with a single animated `paddingBottom`
// that tracks keyboard+sheet height, wrapping a plain RN ScrollView — is
// simpler, has no scroll-correction side effects, and is what Expo Go has
// been using all along (and what the user describes as "working how I
// wanted").  Forcing kcsvAvailable = false makes TestFlight use that same
// path, unifying behavior across all builds.
//
// The RKBC `useReanimatedKeyboardAnimation` hook (via
// `useReanimatedKeyboardAnimationCompat`) is still used when available —
// that's the good, 60fps CADisplayLink-synced keyboard-height driver.
// Only the scroll-view component is disabled here.
const kcsvAvailable = false;
let KeyboardChatScrollView: any = null;
type KeyboardChatScrollViewProps = { keyboardLiftBehavior?: string };

// Intentionally no runtime detection — see block comment above.
// The previous detection logic and `require("@stream-io/react-native-webrtc")`
// probe are removed to make the disabling unconditional and side-effect-free.

export const isKCSVAvailable = kcsvAvailable;

export interface ChatScrollViewConfig {
  offset: number;
  keyboardLiftBehavior?: KeyboardChatScrollViewProps["keyboardLiftBehavior"];
  /**
   * Piped to KCSV's `blankSpace` prop — NOT `extraContentPadding`.
   *
   * KCSV computes `totalPadding = max(blankSpace, keyboardPadding + extraContentPadding)`.
   * When `blankSpace >= keyboardPadding + extraContentPadding`, KCSV's
   * `useExtraContentPadding` reaction early-returns with `effectiveDelta = 0`
   * ("blankSpace absorbed the change") and does NOT call scrollTo. This is
   * what prevents the chat list from being displaced during sheet↔keyboard
   * transitions: as long as blankSpace holds at the region height while the
   * keyboard animates up, totalPadding stays flat and the chat stays still.
   *
   * Previously this was piped to `extraContentPadding`, which fires the
   * scroll-correction reaction on every frame while the delta ramps from
   * regionHeight → 0 during the keyboard rise, producing visible chat
   * motion even though the math (padding + extra = regionHeight) was correct.
   */
  blankSpace?: SharedValue<number>;
}

const DEFAULT_CONFIG: ChatScrollViewConfig = {
  offset: 0,
  keyboardLiftBehavior: "whenAtEnd",
};

let activeConfig: ChatScrollViewConfig = DEFAULT_CONFIG;

export function setChatScrollViewConfig(config: ChatScrollViewConfig): void {
  activeConfig = config;
}

function getSheetVisibleHeight(sheetTranslateY: number): number {
  "worklet";
  return Math.max(0, FOOTER_SCREEN_HEIGHT - sheetTranslateY);
}

function clampSheetToInitialSnap(
  sheetVisibleHeight: number,
  initialSnapHeight: number,
): number {
  "worklet";
  return Math.min(sheetVisibleHeight, Math.max(0, initialSnapHeight));
}

export const ChatKeyboardScrollViewComponent = forwardRef<any, ScrollViewProps>(
  (props, ref) => {
    if (!kcsvAvailable || !KeyboardChatScrollView) {
      return <ScrollView ref={ref} {...props} />;
    }

    return (
      <KeyboardChatScrollView
        ref={ref}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        inverted
        keyboardLiftBehavior={activeConfig.keyboardLiftBehavior ?? "whenAtEnd"}
        offset={activeConfig.offset}
        blankSpace={activeConfig.blankSpace}
        applyWorkaroundForContentInsetHitTestBug
        {...props}
      />
    );
  },
);
ChatKeyboardScrollViewComponent.displayName = "ChatKeyboardScrollViewComponent";

export function useRenderChatScrollComponent() {
  return useCallback(
    (props: ScrollViewProps): React.ReactElement<ScrollViewProps> => (
      <ChatKeyboardScrollViewComponent {...props} />
    ),
    [],
  );
}

export function useKeyboardBackdropHeight(): SharedValue<number> {
  const { sheetTranslateY, isSheetActive, handoffFloor } = useComposerSheet();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimationCompat();

  return useDerivedValue(() => {
    const kbH = Math.abs(keyboardHeight.value);
    const floor = handoffFloor.value;

    if (isSheetActive.value === 0) {
      // Sheet inactive.  After a non-handoff dismiss `handoffFloor` is
      // seeded to the current effective offset then animated to 0 via
      // `withTiming(260ms)`, so `max(kbH, floor)` produces a smooth
      // backdrop collapse that tracks the composer's downward slide.
      return Math.max(kbH, floor);
    }

    // Sheet active — backdrop spans the larger of keyboard / sheet / floor.
    const sheetVisible = getSheetVisibleHeight(sheetTranslateY.value);
    return Math.max(kbH, sheetVisible, floor);
  }, [sheetTranslateY, isSheetActive, keyboardHeight, handoffFloor]);
}

interface KeyboardBackdropDebugState {
  path: "kcsv" | "fallback";
  keyboardHeight: number;
  keyboardProgress: number;
  sheetVisibleHeight: number;
  initialSnapHeight: number;
  isSheetActive: boolean;
  backdropHeight: number;
}

function logKeyboardBackdropState(state: KeyboardBackdropDebugState) {
  console.log("[KeyboardBackdrop]", state);
}

function useKeyboardBackdropDebug(backdropHeight: SharedValue<number>) {
  const { sheetTranslateY, initialSnapHeight, isSheetActive } =
    useComposerSheet();
  const { height: keyboardHeight, progress: keyboardProgress } =
    useReanimatedKeyboardAnimationCompat();

  useEffect(() => {
    if (!ENABLE_KEYBOARD_BACKDROP_DEBUG) return;

    console.log("[KeyboardBackdrop] mounted", {
      path: kcsvAvailable ? "kcsv" : "fallback",
    });
  }, []);

  useAnimatedReaction(
    () => {
      if (!ENABLE_KEYBOARD_BACKDROP_DEBUG) return null;

      return {
        path: kcsvAvailable ? ("kcsv" as const) : ("fallback" as const),
        keyboardHeight: Math.abs(keyboardHeight.value),
        keyboardProgress: keyboardProgress.value,
        sheetVisibleHeight: getSheetVisibleHeight(sheetTranslateY.value),
        initialSnapHeight: initialSnapHeight.value,
        isSheetActive: isSheetActive.value === 1,
        backdropHeight: backdropHeight.value,
      };
    },
    (current, previous) => {
      if (!current) return;

      if (
        !previous ||
        current.path !== previous.path ||
        current.isSheetActive !== previous.isSheetActive ||
        Math.abs(current.keyboardHeight - previous.keyboardHeight) > 0.5 ||
        Math.abs(current.keyboardProgress - previous.keyboardProgress) > 0.02 ||
        Math.abs(current.sheetVisibleHeight - previous.sheetVisibleHeight) >
          0.5 ||
        Math.abs(current.initialSnapHeight - previous.initialSnapHeight) >
          0.5 ||
        Math.abs(current.backdropHeight - previous.backdropHeight) > 0.5
      ) {
        runOnJS(logKeyboardBackdropState)(current);
      }
    },
    [
      backdropHeight,
      keyboardHeight,
      keyboardProgress,
      sheetTranslateY,
      initialSnapHeight,
      isSheetActive,
    ],
  );
}

export function KeyboardBackdropLayer({
  backgroundColor,
}: {
  backgroundColor: string;
}) {
  const backdropHeight = useKeyboardBackdropHeight();

  useKeyboardBackdropDebug(backdropHeight);

  const animatedStyle = useAnimatedStyle(() => ({
    height: Math.max(0, backdropHeight.value),
    opacity: backdropHeight.value > 0 ? 1 : 0,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.keyboardBackdrop, { backgroundColor }, animatedStyle]}
    />
  );
}

// ── Handoff diagnostic helpers (called from worklets via runOnJS) ─────────

function logHandoffFloorCleared(floor: number, kbH: number) {
  // eslint-disable-next-line no-console
  console.log("[HandoffDiag] floor cleared", {
    floor: Math.round(floor),
    kbH: Math.round(kbH),
    ratio: (kbH / floor).toFixed(3),
  });
}

function logSheetExtraPaddingChange(
  previous: number,
  current: number,
  kbH: number,
  floor: number,
) {
  // eslint-disable-next-line no-console
  console.log("[HandoffDiag] sheetExtraPadding", {
    from: Math.round(previous),
    to: Math.round(current),
    kbH: Math.round(kbH),
    floor: Math.round(floor),
  });
}

export function ChatFooterWrapper({ children }: { children: React.ReactNode }) {
  const {
    sheetTranslateY,
    initialSnapHeight,
    isSheetActive,
    sheetExtraPadding,
    liveKeyboardHeight,
    handoffFloor,
  } = useComposerSheet();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimationCompat();

  // Pipe RKBC keyboard height → liveKeyboardHeight on every UI-thread frame.
  // activateSheet reads this synchronously so the sheet height exactly matches
  // the current keyboard height, eliminating the 2-3 frame React-state lag
  // that previously caused an upward teleport on the first frame.
  useAnimatedReaction(
    () => keyboardHeight.value,
    (current) => {
      liveKeyboardHeight.value = current;
    },
    [liveKeyboardHeight],
  );

  // Unified footer offset — single source of truth for the footer's vertical
  // position in the KCSV path.  Combines the keyboard height and the
  // composer-attached sheet into one derived value computed in a single
  // worklet.  This eliminates the dual-driver desynchronization that
  // occurred when KeyboardStickyView and a separate composerOffset
  // translateY were in independent animation pipelines: even though
  // mathematically their sum stayed constant, a 1-frame lag between the
  // two drivers caused the footer to teleport upward and settle back down
  // during the keyboard→sheet handoff (visible in native/TestFlight).
  const unifiedFooterOffset = useDerivedValue(() => {
    const kbH = Math.abs(keyboardHeight.value);
    const floor = handoffFloor.value;

    if (isSheetActive.value === 0) {
      // Sheet inactive.  `handoffFloor` is driven by two animated
      // transitions:
      //   - sheet→KB handoff: floor captures current sheet visible,
      //     held until the rising keyboard catches up.
      //   - non-handoff dismiss: floor seeded to current effective
      //     offset, then `withTiming(0, 260ms)` animates it down —
      //     composer slides smoothly to baseline without teleporting.
      return Math.max(kbH, floor);
    }

    // Sheet is active.  Include the floor in the max so the KB→sheet
    // lock survives until the picker's own animation has driven
    // sheetVisible up to the lock height.  Without this, there is a
    // transient window on the first 1-2 frames of the handoff where
    // the picker has reset sheetTranslateY to its starting value
    // (hidden) while kbH has already started animating down, producing
    // the visible chat-list teleport.
    const sheetVisible = getSheetVisibleHeight(sheetTranslateY.value);
    const clamped = clampSheetToInitialSnap(
      sheetVisible,
      initialSnapHeight.value,
    );
    return Math.max(kbH, clamped, floor);
  }, [
    keyboardHeight,
    isSheetActive,
    sheetTranslateY,
    initialSnapHeight,
    handoffFloor,
  ]);

  // Clear the handoff lock once EITHER the keyboard or the sheet has caught
  // up to the lock height.  This supports both directions of the transition:
  //
  //   KB → sheet:  activateSheet locks at current kbH.  Keyboard animates
  //                down, picker animates up.  As soon as sheetVisible
  //                reaches the lock, the lock is no longer needed (the
  //                sheet is now the tallest thing and unifiedFooterOffset
  //                tracks it directly).  Clearing then allows the sheet
  //                to continue growing past the initial snap without
  //                the floor artificially clamping it.
  //
  //   sheet → KB:  deactivateSheet captures floor via beginKeyboardHandoff.
  //                Sheet animates down, keyboard animates up.  As soon as
  //                kbH reaches the lock, the lock is cleared and the
  //                keyboard takes over directly.
  //
  // Threshold 0.98 — the last 2% gap is imperceptible and prevents the
  // lock from lingering until exact equality (which animation curves
  // never reach cleanly).
  useAnimatedReaction(
    () => ({
      floor: handoffFloor.value,
      kbH: Math.abs(keyboardHeight.value),
      sheetVisible: getSheetVisibleHeight(sheetTranslateY.value),
      sheetActive: isSheetActive.value,
    }),
    (current) => {
      if (current.floor > 0) {
        // Rule:
        //   • Sheet active (KB→sheet handoff): clear when EITHER the
        //     returning keyboard OR the opening sheet catches up to the
        //     lock height.
        //   • Sheet INACTIVE (sheet→KB handoff): clear ONLY when the
        //     keyboard catches up.  The picker's internal translateY
        //     is still at the old snap for several frames after
        //     deactivateSheet until its close-spring begins, so
        //     `sheetVisible` would falsely satisfy the clear threshold
        //     on the very first frame of the handoff — releasing the
        //     floor before the keyboard has even started rising and
        //     causing the footer to crash to baseline for ~100ms
        //     (the visible downward teleport during sheet→KB).
        const kbCaughtUp = current.kbH >= current.floor * 0.98;
        const sheetCaughtUp =
          current.sheetActive === 1 &&
          current.sheetVisible >= current.floor * 0.98;
        if (kbCaughtUp || sheetCaughtUp) {
          if (ENABLE_HANDOFF_DIAGNOSTICS) {
            runOnJS(logHandoffFloorCleared)(current.floor, current.kbH);
          }
          handoffFloor.value = 0;
        }
      }
    },
    [handoffFloor, keyboardHeight, sheetTranslateY, isSheetActive],
  );

  // Pipe the unified footer offset → sheetExtraPadding (repurposed).
  //
  // Historical note: this SharedValue used to carry "extra content padding"
  // (max(0, unifiedFooterOffset - kbH)) and was piped into KCSV's
  // `extraContentPadding` prop. That caused visible chat-list motion during
  // sheet↔keyboard transitions because KCSV's `useExtraContentPadding`
  // useAnimatedReaction calls `scrollTo(target)` on every frame that
  // extraContentPadding changes — as the delta ramped regionHeight → 0
  // during the keyboard rise, the chat was displaced by the full ramp
  // even though `keyboardPadding + extraContentPadding` summed to a constant.
  //
  // It now carries the full target inset (unifiedFooterOffset) and is piped
  // into KCSV's `blankSpace` prop.  `totalPadding = max(blankSpace, padding +
  // extra)` means when blankSpace equals the region height, padding changes
  // (keyboard opening / closing) are absorbed by the floor and no scroll
  // correction fires — the chat stays visually still through the entire
  // transition.  The `useExtraContentPadding` reaction detects this via
  // `effectiveDelta === 0` and early-returns.
  useAnimatedReaction(
    () => unifiedFooterOffset.value,
    (current, previous) => {
      sheetExtraPadding.value = current;
      if (
        ENABLE_HANDOFF_DIAGNOSTICS &&
        previous !== null &&
        Math.abs(current - previous) > 1
      ) {
        const kbH = Math.abs(keyboardHeight.value);
        runOnJS(logSheetExtraPaddingChange)(
          previous,
          current,
          kbH,
          handoffFloor.value,
        );
      }
    },
    [sheetExtraPadding, unifiedFooterOffset, keyboardHeight, handoffFloor],
  );

  // Single-driver composer translate.
  //
  // Earlier iterations wrapped the footer in KeyboardStickyView (native
  // CADisplayLink lift by the keyboard frame) and an inner Reanimated
  // overlay (sheet/floor delta).  On paper the two transforms summed to
  // `-regionHeight`, but in practice KSV's native CAAnimation commit and
  // Reanimated's own commit are in different pipelines — during sheet↔KB
  // transitions and interactive keyboard drags the two drivers would be
  // ~1 frame out of phase, producing a visible upward teleport on
  // KB→sheet and a torn seam between the composer and the keyboard
  // backdrop during interactive dismiss.
  //
  // Using a single Reanimated driver that reads the same keyboardHeight
  // SharedValue that drives the backdrop guarantees composer and backdrop
  // commit in the same frame.  `useReanimatedKeyboardAnimation` is backed
  // by RKBC's native CADisplayLink hook and updates the SharedValue every
  // frame, so the single-driver path is still frame-synced to the iOS
  // keyboard animation.
  const footerTranslateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -unifiedFooterOffset.value }],
  }));

  if (kcsvAvailable) {
    return (
      <Animated.View
        pointerEvents="box-none"
        style={[styles.footerLayer, footerTranslateStyle]}
      >
        {children}
      </Animated.View>
    );
  }

  // Fallback path: ChatKeyboardContainer's animated paddingBottom already
  // positions the footer correctly above the keyboard + sheet. No translateY
  // needed — the container padding is the single source of truth for the
  // effective bottom inset, preventing the chat-drops-when-sheet-replaces-
  // keyboard bug that occurred when KAV only tracked the keyboard.
  return (
    <View pointerEvents="box-none" style={styles.footerLayer}>
      {children}
    </View>
  );
}

// ─── Effective Bottom Inset ──────────────────────────────────────────────────

/**
 * Computes the effective bottom inset for the chat container — the total
 * bottom space occupied by the keyboard + any active composer-attached sheet.
 *
 * During a keyboard→sheet transition the two terms are complementary:
 *   kbH drops from kbH→0, composerOffset rises from 0→kbH
 *   sum stays constant = kbH (no visual jump)
 *
 * Used by ChatKeyboardContainer's fallback path to replace KAV with a
 * Reanimated-driven paddingBottom that understands the full composer system.
 */
function useEffectiveBottomInset(): SharedValue<number> {
  const { sheetTranslateY, initialSnapHeight, isSheetActive, handoffFloor } =
    useComposerSheet();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimationCompat();

  return useDerivedValue(() => {
    const kbH = Math.abs(keyboardHeight.value);
    const floor = handoffFloor.value;

    if (isSheetActive.value === 0) {
      // Sheet inactive.  After a non-handoff dismiss `handoffFloor` is
      // seeded to the current effective inset and then animated down to
      // 0 via `withTiming(260ms)` — so `max(kbH, floor)` produces a
      // smooth composer slide to baseline regardless of whether the
      // OS keyboard is still retracting from a search-TextInput blur.
      // During a sheet→keyboard handoff the floor keeps the inset
      // stable until kbH catches up.
      return Math.max(kbH, floor);
    }

    const sheetVisible = getSheetVisibleHeight(sheetTranslateY.value);
    const clamped = clampSheetToInitialSnap(
      sheetVisible,
      initialSnapHeight.value,
    );
    return Math.max(kbH, clamped, floor);
  });
}

// ─── Chat Keyboard Container ─────────────────────────────────────────────────

/**
 * Unified keyboard-aware container for chat screens.
 *
 * Replaces KeyboardAvoidingView as the outermost layout wrapper:
 * - KCSV path: plain View (KCSV handles content inset natively via
 *   contentInset + extraContentPadding — no container padding needed).
 * - Fallback path: Animated.View whose paddingBottom tracks the effective
 *   bottom inset (keyboard + composer sheet). This ensures the FlatList
 *   height stays constant during keyboard↔sheet transitions, eliminating
 *   the visible downward chat jump that occurred with KAV.
 */
export function ChatKeyboardContainer({
  children,
  style,
  backgroundLayer,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundLayer?: React.ReactNode;
}) {
  // Use composerBackground as the single source of truth for the keyboard
  // backdrop color. This matches the ChatComposer container background,
  // ensuring the composer, safe-area spacer, and keyboard backdrop form
  // one continuous visual surface with no visible seam.
  const { colors } = useAppTheme();
  const keyboardBackdropColor = colors.composerBackground ?? colors.background;

  const backgroundUnderlay = backgroundLayer ? (
    <View pointerEvents="none" style={styles.backgroundUnderlay}>
      {backgroundLayer}
    </View>
  ) : null;

  if (kcsvAvailable) {
    // KCSV handles layout inset natively — the backdrop is visual-only.
    return (
      <View style={[styles.container, style]}>
        {backgroundUnderlay}
        <KeyboardBackdropLayer backgroundColor={keyboardBackdropColor} />
        {children}
      </View>
    );
  }

  return (
    <FallbackKeyboardContainer
      style={style}
      backgroundUnderlay={backgroundUnderlay}
      keyboardBackdropColor={keyboardBackdropColor}
    >
      {children}
    </FallbackKeyboardContainer>
  );
}

/**
 * Fallback container that uses Reanimated animated paddingBottom to track
 * the effective bottom inset. This is the single source of truth for how
 * much space the keyboard + composer sheet system occupies at the bottom.
 */
function FallbackKeyboardContainer({
  children,
  style,
  backgroundUnderlay,
  keyboardBackdropColor,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundUnderlay?: React.ReactNode;
  keyboardBackdropColor: string;
}) {
  const effectiveInset = useEffectiveBottomInset();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimationCompat();
  const { isSheetActive, handoffFloor } = useComposerSheet();
  const safeAreaTop = useSafeAreaInsets().top;

  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: effectiveInset.value,
  }));

  // ── Keyboard-transition interaction gates ────────────────────────────────
  //
  // Two independent gates are used, because the two transitions need
  // different UX:
  //
  //  • OPEN gate (`isKbOpening`) — raised on `keyboardWillShow`, released
  //    200ms after `keyboardDidShow` (or by safety timeout).  Blocks the
  //    full chat body below the header so re-taps cannot start a second
  //    overlapping transition while the keyboard is rising.
  //
  //  • CLOSE gate (`isKbClosing`) — raised on `keyboardWillHide`, released
  //    exactly at `keyboardDidHide` (no post-settle hold).  Blocks ONLY
  //    the Message box (composer region) so the user cannot re-focus the
  //    TextInput while the keyboard is dismissing; chat list + header
  //    remain interactive.
  //
  // Implementation notes:
  //  • Driven by native `Keyboard` JS events — NOT a UI-thread reaction on
  //    `keyboardHeight`.  Reason: `useAnimatedReaction` only fires while
  //    its deps are changing; once the SharedValue settles the reaction
  //    stops, so the final rest-edge can be missed and the gate would
  //    stick on (auto-open bug).
  //  • Separate safety timeouts per gate ensure each releases even if the
  //    matching `did…` event is dropped.
  //  • On Android, `willShow`/`willHide` do not fire — the gates rely on
  //    `didShow`/`didHide` and are effectively a no-op for the animation
  //    (Android system keyboard has a much shorter transition).
  const [isKbOpening, setIsKbOpening] = useState(false);
  const [isKbClosing, setIsKbClosing] = useState(false);
  const openSafetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeSafetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearOpen = () => {
      if (openSafetyRef.current != null) {
        clearTimeout(openSafetyRef.current);
        openSafetyRef.current = null;
      }
    };
    const clearClose = () => {
      if (closeSafetyRef.current != null) {
        clearTimeout(closeSafetyRef.current);
        closeSafetyRef.current = null;
      }
    };

    const raiseOpen = (e?: { duration?: number }) => {
      setIsKbOpening(true);
      clearOpen();
      // Safety: if `keyboardDidShow` never fires, release the gate after
      // native duration + slack.  If `didShow` fires first it schedules
      // its own post-settle release.
      const d = Math.max(100, Math.min(600, e?.duration ?? 250)) + 400;
      openSafetyRef.current = setTimeout(() => {
        setIsKbOpening(false);
        openSafetyRef.current = null;
      }, d);
    };
    const releaseOpen = () => {
      // Hold the gate for 20ms after the keyboard reports settled.
      // On some iOS builds the keyboard frame keeps micro-adjusting for
      // a few frames past `keyboardDidShow`; re-taps landing in that
      // window still produce the overlapping-transition desync.
      clearOpen();
      openSafetyRef.current = setTimeout(() => {
        setIsKbOpening(false);
        openSafetyRef.current = null;
      }, 20);
    };

    const raiseClose = (e?: { duration?: number }) => {
      setIsKbClosing(true);
      clearClose();
      // Safety: release the close gate by native duration + slack if
      // `keyboardDidHide` never fires.  If `didHide` fires first it
      // schedules its own post-settle release.
      const d = Math.max(100, Math.min(600, e?.duration ?? 250)) + 200;
      closeSafetyRef.current = setTimeout(() => {
        setIsKbClosing(false);
        closeSafetyRef.current = null;
      }, d);
    };
    const releaseClose = () => {
      // Hold the close gate for 20ms past `keyboardDidHide` to cover
      // any post-settle frame jitter while the composer-region block
      // drops shortly after the keyboard is fully closed.
      clearClose();
      closeSafetyRef.current = setTimeout(() => {
        setIsKbClosing(false);
        closeSafetyRef.current = null;
      }, 20);
    };

    const subs = [
      // iOS fires will* with animation duration; Android only fires did*.
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillShow", raiseOpen)
        : null,
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillHide", raiseClose)
        : null,
      Keyboard.addListener("keyboardDidShow", releaseOpen),
      Keyboard.addListener("keyboardDidHide", releaseClose),
    ];
    return () => {
      clearOpen();
      clearClose();
      subs.forEach((s) => s?.remove());
    };
  }, []);

  // ── Keyboard transition boundaries ───────────────────────────────────────
  //
  // Detect keyboard-open-start / keyboard-close-start / rest by sampling the
  // direction of `keyboardHeight.value`.  A transition between directions
  // is a meaningful state boundary to log — it lets us correlate perceived
  // rigidness ("this open was smooth, this one wasn't") with the actual
  // shared-value path.  State machine:
  //   rest  → opening (delta > 0 while prev ≈ 0 or increasing)
  //   rest  → closing (delta < 0 while prev ≈ kbH or decreasing)
  //   moving → rest   (delta ≈ 0 for ≥2 frames at kbH=0 or kbH=peak)
  const kbDirection = useSharedValue<0 | 1 | -1>(0); // 0=rest, 1=opening, -1=closing
  useAnimatedReaction(
    () => keyboardHeight.value,
    (current, previous) => {
      if (previous === null) return;
      const absCurr = Math.abs(current);
      const absPrev = Math.abs(previous);
      const delta = absCurr - absPrev;
      const prev = kbDirection.value;

      let next: 0 | 1 | -1 = prev;
      if (delta > 0.5) next = 1;
      else if (delta < -0.5) next = -1;
      else if (Math.abs(delta) < 0.1) next = 0;

      if (next !== prev) {
        kbDirection.value = next;
        const event =
          next === 1
            ? "keyboard:open-start"
            : next === -1
              ? "keyboard:close-start"
              : absCurr < 0.5
                ? "keyboard:closed-rest"
                : "keyboard:open-rest";
        runOnJS(chatDbg)(event, {
          kbH: Math.round(absCurr),
          floor: Math.round(handoffFloor.value),
          sheetActive: isSheetActive.value,
          inset: Math.round(effectiveInset.value),
        });
      }
    },
    [keyboardHeight, kbDirection, handoffFloor, isSheetActive, effectiveInset],
  );

  // ── Motion-discontinuity detector ────────────────────────────────────────
  //
  // Samples the effective bottom inset on every UI-thread commit and flags
  // any single-frame delta above `MOTION_JUMP_THRESHOLD_PX`.  This is the
  // primary signal the user perceives as toolbar "teleporting / snapping"
  // — a large jump between two consecutive values that should have been
  // interpolated smoothly.
  //
  // Context captured at the jump: keyboard height, handoff floor, sheet
  // active.  With the monotonic seq in `chatDbg` this lets us correlate
  // a jump with the preceding `activateSheet` / `deactivateSheet` /
  // `beginKeyboardHandoff` transition in the unified timeline.
  //
  // Enabled only when `chatUiDebug` is on (`setChatUiDebugEnabled(true)`).
  useAnimatedReaction(
    () => effectiveInset.value,
    (current, previous) => {
      if (previous === null) return;
      const delta = Math.abs(current - previous);
      if (delta > MOTION_JUMP_THRESHOLD_PX) {
        runOnJS(reportOffsetJump)({
          source: "effectiveInset",
          from: previous,
          to: current,
          delta,
          context: {
            kbH: Math.round(Math.abs(keyboardHeight.value)),
            floor: Math.round(handoffFloor.value),
            sheetActive: isSheetActive.value,
          },
        });
      }
    },
    [effectiveInset, keyboardHeight, handoffFloor, isSheetActive],
  );

  // ── Keyboard ↔ Toolbar sync monitor ──────────────────────────────────────
  //
  // The toolbar's visual position in the fallback path = container
  // paddingBottom = `effectiveInset.value`.  When no sheet is active and
  // no handoff floor is pending, this should equal `|keyboardHeight|`
  // EXACTLY every frame.  Any drift > 2px during active motion means the
  // toolbar and the native keyboard are running on different timelines —
  // the exact bug class this pass targets.
  //
  // Fires at the START of each motion (first frame where direction becomes
  // non-rest), at the END (settle), and at any mid-motion frame where
  // |toolbar - keyboard| exceeds the threshold.  Each event carries the
  // driver identity (`rkbc-native` vs `rn-fallback`) so a sync-bug report
  // immediately distinguishes "the fallback easing is wrong" from "the
  // native bridge itself is desynced from UIKit" without further probing.
  useAnimatedReaction(
    () => ({
      kb: Math.abs(keyboardHeight.value),
      tb: effectiveInset.value,
      dir: kbDirection.value,
      floor: handoffFloor.value,
      sheetActive: isSheetActive.value,
    }),
    (current, previous) => {
      // Only relevant when the toolbar should track the keyboard directly.
      // If a sheet is active or a non-zero floor is held, the toolbar
      // intentionally runs on `max(kbH, sheet, floor)` and drift vs kbH
      // alone is expected.
      if (current.sheetActive === 1 || current.floor > 0.5) return;

      const delta = current.tb - current.kb; // + toolbar ahead (higher), - behind
      const absDelta = Math.abs(delta);

      // Motion start: first frame where direction leaves rest.
      if (previous && previous.dir === 0 && current.dir !== 0) {
        runOnJS(logKeyboardToolbarSync)({
          event: "motion-start",
          keyboardHeight: current.kb,
          toolbarOffset: current.tb,
          delta,
          source: isKeyboardControllerAvailable ? "rkbc-native" : "rn-fallback",
          direction: current.dir === 1 ? "opening" : "closing",
          floor: current.floor,
          sheetActive: current.sheetActive,
        });
        return;
      }

      // Motion end: direction returns to rest.
      if (previous && previous.dir !== 0 && current.dir === 0) {
        runOnJS(logKeyboardToolbarSync)({
          event: "motion-end",
          keyboardHeight: current.kb,
          toolbarOffset: current.tb,
          delta,
          source: isKeyboardControllerAvailable ? "rkbc-native" : "rn-fallback",
          direction: "rest",
          floor: current.floor,
          sheetActive: current.sheetActive,
        });
        return;
      }

      // Mid-motion drift.  Only log during active motion (direction
      // non-rest) and only when drift exceeds the sync threshold —
      // otherwise we'd spam on every frame.
      if (current.dir !== 0 && absDelta > KEYBOARD_TOOLBAR_SYNC_THRESHOLD_PX) {
        runOnJS(logKeyboardToolbarSync)({
          event: delta > 0 ? "toolbar-ahead" : "toolbar-behind",
          keyboardHeight: current.kb,
          toolbarOffset: current.tb,
          delta,
          source: isKeyboardControllerAvailable ? "rkbc-native" : "rn-fallback",
          direction: current.dir === 1 ? "opening" : "closing",
          floor: current.floor,
          sheetActive: current.sheetActive,
        });
      }
    },
    [effectiveInset, keyboardHeight, kbDirection, handoffFloor, isSheetActive],
  );

  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
      {backgroundUnderlay}
      <KeyboardBackdropLayer backgroundColor={keyboardBackdropColor} />
      {children}
      {isKbOpening ? (
        // OPEN gate: transparent touch-eater covering the chat body +
        // composer while the keyboard is rising.  Positioned BELOW the
        // chat header (`top = safeArea.top + CHAT_HEADER_HEIGHT`) so the
        // header — back button, title tap, right-side actions — remains
        // interactive at all times, per product requirement.  Mounted
        // only during the open transition, so steady-state interaction
        // is unaffected.  `accessibilityElementsHidden` +
        // `importantForAccessibility` keep VoiceOver from landing on
        // the overlay during its brief lifetime.
        <View
          pointerEvents="auto"
          style={[
            StyleSheet.absoluteFill,
            { top: safeAreaTop + CHAT_HEADER_HEIGHT },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      {isKbClosing ? (
        // CLOSE gate: blocks ONLY the Message box (composer region) so
        // the user cannot re-focus the TextInput while the keyboard is
        // dismissing.  Chat list and header remain interactive.
        //
        // Positioned at `bottom: 0` with a fixed height of
        // CLOSE_GATE_COMPOSER_REGION_PX, which is sized to cover the
        // composer stack (input row + toolbar) with comfortable margin.
        // The Animated.View's `paddingBottom` = effectiveInset pushes
        // the content box up as the keyboard recedes; the composer
        // therefore sits at `bottom: 0` of that content box and this
        // overlay tracks it naturally.
        <View
          pointerEvents="auto"
          style={styles.closeGate}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </Animated.View>
  );
}

export function KeyboardSafeAreaSpacer({
  backgroundColor: backgroundColorOverride,
}: {
  /** @deprecated Prefer omitting — defaults to composerBackground for visual continuity. */
  backgroundColor?: string;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  if (insets.bottom === 0) return null;

  // Default to composerBackground so the spacer matches the composer surface.
  const resolvedColor =
    backgroundColorOverride ?? colors.composerBackground ?? colors.background;

  return (
    <AnimatedSafeAreaSpacer
      height={insets.bottom}
      backgroundColor={resolvedColor}
    />
  );
}

function AnimatedSafeAreaSpacer({
  height,
  backgroundColor,
}: {
  height: number;
  backgroundColor: string;
}) {
  const { progress } = useReanimatedKeyboardAnimationCompat();
  const { isSheetActive, sheetTranslateY, initialSnapHeight, handoffFloor } =
    useComposerSheet();

  // Collapse spacer when keyboard is open OR when a composer-attached sheet
  // is active. Uses a smooth progress derived from the sheet's translate
  // so the collapse animates in sync with the sheet opening.
  // Also stays collapsed during a sheet→keyboard handoff so the spacer
  // doesn't flicker back to full height in the gap between the two.
  const animatedStyle = useAnimatedStyle(() => {
    let sheetProgress = 0;
    if (isSheetActive.value === 1 && initialSnapHeight.value > 0) {
      const sheetVisible = getSheetVisibleHeight(sheetTranslateY.value);
      sheetProgress = Math.min(
        1,
        Math.max(0, sheetVisible / initialSnapHeight.value),
      );
    }
    // Keep collapsed during handoff so the spacer doesn't re-expand
    // in the gap before the keyboard arrives.
    const handoffProgress = handoffFloor.value > 0 ? 1 : 0;
    const factor = Math.max(progress.value, sheetProgress, handoffProgress);
    return {
      height: interpolate(factor, [0, 1], [height, 0]),
      backgroundColor,
    };
  });

  return <Animated.View style={animatedStyle} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundUnderlay: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: KEYBOARD_BACKDROP_Z_INDEX,
  },
  footerLayer: {
    position: "relative",
    zIndex: CHAT_FOOTER_Z_INDEX,
  },
  closeGate: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    // Tall enough to cover the composer stack (input row + attached
    // toolbar) with comfortable margin.  Sits at the bottom of the
    // Animated.View's content box; the animated paddingBottom tracks the
    // receding keyboard so the composer remains within this region
    // throughout the close transition.
    height: 220,
    zIndex: CHAT_FOOTER_Z_INDEX + 1,
  },
});
