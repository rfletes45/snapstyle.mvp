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
  isKeyboardControllerAvailable,
  KeyboardStickyView,
  KeyboardChatScrollView as OptionalKeyboardChatScrollView,
  useReanimatedKeyboardAnimationCompat,
} from "@/utils/optionalKeyboardController";
import React, { forwardRef, useCallback, useEffect } from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FOOTER_SCREEN_HEIGHT = Dimensions.get("window").height;
const KEYBOARD_BACKDROP_Z_INDEX = 10;
const CHAT_FOOTER_Z_INDEX = 20;
const ENABLE_KEYBOARD_BACKDROP_DEBUG = false;

// Toggle for handoff transition diagnostics — mirrors the flag in
// ComposerSheetContext.  Set to true when debugging sheet→keyboard
// handoff timing in native/TestFlight builds.
const ENABLE_HANDOFF_DIAGNOSTICS = __DEV__ && false;

let kcsvAvailable = false;
let KeyboardChatScrollView: any = null;
type KeyboardChatScrollViewProps = { keyboardLiftBehavior?: string };

try {
  const nativeView = "ClippingScrollViewDecoratorView";
  const hasNativeView =
    UIManager.hasViewManagerConfig?.(nativeView) ??
    UIManager.getViewManagerConfig(nativeView) != null;

  if (
    hasNativeView &&
    isKeyboardControllerAvailable &&
    OptionalKeyboardChatScrollView
  ) {
    try {
      require("@stream-io/react-native-webrtc");
      KeyboardChatScrollView = OptionalKeyboardChatScrollView;
      kcsvAvailable = true;
    } catch {
      kcsvAvailable = false;
    }
  }
} catch {
  kcsvAvailable = false;
}

export const isKCSVAvailable = kcsvAvailable;

export interface ChatScrollViewConfig {
  offset: number;
  keyboardLiftBehavior?: KeyboardChatScrollViewProps["keyboardLiftBehavior"];
  extraContentPadding?: SharedValue<number>;
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
        extraContentPadding={activeConfig.extraContentPadding}
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
      // During a sheet→keyboard handoff the floor keeps the backdrop tall
      // until the keyboard catches up.
      return Math.max(kbH, floor);
    }

    // Backdrop must also include the floor during KB→sheet so it doesn't
    // transiently collapse while the picker animates up and the keyboard
    // animates down.
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
      // During a sheet→keyboard handoff the floor prevents the footer
      // from dropping to baseline before the keyboard has started rising.
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
    }),
    (current) => {
      if (current.floor > 0) {
        const caughtUp =
          current.kbH >= current.floor * 0.98 ||
          current.sheetVisible >= current.floor * 0.98;
        if (caughtUp) {
          if (ENABLE_HANDOFF_DIAGNOSTICS) {
            runOnJS(logHandoffFloorCleared)(current.floor, current.kbH);
          }
          handoffFloor.value = 0;
        }
      }
    },
    [handoffFloor, keyboardHeight, sheetTranslateY],
  );

  // Pipe the sheet's extra contribution → sheetExtraPadding so KCSV shifts
  // chat content.  This is the portion of the unified offset beyond what the
  // keyboard itself contributes.
  useAnimatedReaction(
    () => {
      const kbH = Math.abs(keyboardHeight.value);
      return Math.max(0, unifiedFooterOffset.value - kbH);
    },
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
    [sheetExtraPadding, keyboardHeight, handoffFloor],
  );

  // Sheet-overlay delta — the portion of the unified footer offset that
  // exceeds the current keyboard height.  This is applied on top of
  // KeyboardStickyView's native keyboard-frame tracking.
  //
  //   • Cold keyboard open (no sheet, no floor):
  //       unifiedFooterOffset = kbH → delta = 0
  //       → Only KSV moves the footer.  KSV is frame-synced to the iOS
  //         keyboard animation at the CADisplayLink level, so the composer
  //         sits exactly on the keyboard's top edge throughout the opening
  //         animation — no visible gap ahead of the rising keyboard.
  //
  //   • Sheet active / handoff lock engaged:
  //       delta = max(0, regionHeight - kbH)
  //       KSV lift (kbH) + overlay translateY (delta) = regionHeight.
  //       The Step-A region lock holds regionHeight constant during
  //       transitions, so any 1-frame desynchronization between KSV and
  //       the Reanimated overlay is bounded to the frame-to-frame change
  //       in kbH, which is visually imperceptible when the sum is locked.
  const sheetOverlayStyle = useAnimatedStyle(() => {
    const kbH = Math.abs(keyboardHeight.value);
    const delta = Math.max(0, unifiedFooterOffset.value - kbH);
    return { transform: [{ translateY: -delta }] };
  });

  if (kcsvAvailable) {
    // KCSV path: two-layer composition.
    //
    //   [outer] KeyboardStickyView — native iOS keyboard-frame tracking
    //           (CADisplayLink-synced lift by the current keyboard height).
    //           Drives the composer's position during a pure keyboard
    //           open/close, eliminating the "composer-ahead-of-keyboard"
    //           gap that occurs when only a Reanimated shared value drives
    //           the translate (the Reanimated pipeline commits slightly
    //           after the keyboard's own animation on some devices).
    //
    //   [inner] Reanimated overlay — adds ONLY the sheet/handoff-floor
    //           delta above the keyboard.  On cold keyboard open this
    //           delta is 0, so the overlay is a no-op and KSV alone
    //           positions the composer.  During sheet transitions the
    //           Step-A region lock holds (KSV.lift + overlay.delta) at
    //           a constant sum, so the composer is stable even if the
    //           two drivers are 1 frame out of phase.
    return (
      <KeyboardStickyView
        offset={{ closed: 0, opened: 0 }}
        style={styles.footerLayer}
      >
        <Animated.View style={sheetOverlayStyle} pointerEvents="box-none">
          {children}
        </Animated.View>
      </KeyboardStickyView>
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
      // Respect handoff floor during sheet→keyboard transitions.
      return Math.max(kbH, floor);
    }

    const sheetVisible = getSheetVisibleHeight(sheetTranslateY.value);
    const clamped = clampSheetToInitialSnap(
      sheetVisible,
      initialSnapHeight.value,
    );
    // Layout lift stays clamped to the keyboard-equivalent snap so expanded
    // sheets don't keep pushing the footer/list farther upward.
    // The handoff floor is included so the KB→sheet lock holds the
    // chat list height constant while the picker's first frames race
    // against the keyboard dismissal.
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

  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: effectiveInset.value,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
      {backgroundUnderlay}
      <KeyboardBackdropLayer backgroundColor={keyboardBackdropColor} />
      {children}
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
});
