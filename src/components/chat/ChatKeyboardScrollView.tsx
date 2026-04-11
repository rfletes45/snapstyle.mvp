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
import {
  isKeyboardControllerAvailable,
  KeyboardStickyView,
  KeyboardChatScrollView as OptionalKeyboardChatScrollView,
  useReanimatedKeyboardAnimationCompat,
} from "@/utils/optionalKeyboardController";
import React, { forwardRef, useCallback } from "react";
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
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FOOTER_SCREEN_HEIGHT = Dimensions.get("window").height;

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

export function ChatFooterWrapper({ children }: { children: React.ReactNode }) {
  const {
    sheetTranslateY,
    initialSnapHeight,
    isSheetActive,
    sheetExtraPadding,
  } = useComposerSheet();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimationCompat();

  // Derive the offset the composer should translate up by.
  //   sheetVisibleHeight = how much of the sheet is on-screen
  //   clamp to initialSnapHeight (keyboard-equivalent) = "follow zone"
  //   subtract keyboard contribution to avoid double-offset
  //   +2 COMPOSER_SHEET_LIFT for a small visual lift so the composer sits
  //   flush against the sheet when the keyboard is replaced.
  const COMPOSER_SHEET_LIFT = 2;
  const composerOffset = useDerivedValue(() => {
    if (isSheetActive.value === 0) return 0;

    const sheetVisible = FOOTER_SCREEN_HEIGHT - sheetTranslateY.value;
    const clamped = Math.min(
      Math.max(sheetVisible, 0),
      initialSnapHeight.value,
    );
    // keyboardHeight from Reanimated is negative when open (keyboard-controller convention)
    const kbContribution = Math.abs(keyboardHeight.value);
    const base = Math.max(0, clamped - kbContribution);
    // Lift the composer slightly so it matches the keyboard position
    return base > 0 ? base + COMPOSER_SHEET_LIFT : 0;
  }, [sheetTranslateY, initialSnapHeight, isSheetActive, keyboardHeight]);

  // Pipe composerOffset → sheetExtraPadding so KCSV shifts chat content
  useAnimatedReaction(
    () => composerOffset.value,
    (current) => {
      sheetExtraPadding.value = current;
    },
    [sheetExtraPadding],
  );

  const offsetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -composerOffset.value }],
  }));

  if (kcsvAvailable) {
    // KCSV path: KSV positions footer at keyboard top, translateY adds
    // the sheet offset so the footer sits above the composer-attached sheet.
    return (
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <Animated.View style={offsetStyle}>{children}</Animated.View>
      </KeyboardStickyView>
    );
  }

  // Fallback path: ChatKeyboardContainer's animated paddingBottom already
  // positions the footer correctly above the keyboard + sheet. No translateY
  // needed — the container padding is the single source of truth for the
  // effective bottom inset, preventing the chat-drops-when-sheet-replaces-
  // keyboard bug that occurred when KAV only tracked the keyboard.
  return <>{children}</>;
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
  const { sheetTranslateY, initialSnapHeight, isSheetActive } =
    useComposerSheet();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimationCompat();

  return useDerivedValue(() => {
    const kbH = Math.abs(keyboardHeight.value);

    if (isSheetActive.value === 0) return kbH;

    const sheetVisible = FOOTER_SCREEN_HEIGHT - sheetTranslateY.value;
    const clamped = Math.min(
      Math.max(sheetVisible, 0),
      initialSnapHeight.value,
    );
    // composerOffset = extra space the sheet occupies beyond the keyboard
    const composerOffset = Math.max(0, clamped - kbH);
    // +2 lift to match the composer lift applied in ChatFooterWrapper
    const lift = composerOffset > 0 ? 2 : 0;
    // Total = keyboard + sheet's extra contribution (always >= kbH)
    return kbH + composerOffset + lift;
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
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  // Extract backgroundColor from the style prop to use as a solid backdrop
  // behind the keyboard. This makes the area under the keyboard match the
  // theme instead of showing the default system background.
  const flatStyle = StyleSheet.flatten(style);
  const backdropColor =
    typeof flatStyle?.backgroundColor === "string"
      ? flatStyle.backgroundColor
      : undefined;

  // Solid backdrop that sits behind the keyboard at the bottom of the screen.
  // Absolutely positioned with zIndex -1 so it never affects layout or
  // intercept touches — it's purely visual.
  const backdrop = backdropColor ? (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: FOOTER_SCREEN_HEIGHT / 2,
        backgroundColor: backdropColor,
        zIndex: -1,
      }}
      pointerEvents="none"
    />
  ) : null;

  if (kcsvAvailable) {
    // KCSV handles content inset natively — no extra padding needed
    return (
      <View style={[{ flex: 1 }, style]}>
        {backdrop}
        {children}
      </View>
    );
  }

  return (
    <FallbackKeyboardContainer style={style} backdrop={backdrop}>
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
  backdrop,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backdrop?: React.ReactNode;
}) {
  const effectiveInset = useEffectiveBottomInset();

  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: effectiveInset.value,
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>
      {backdrop}
      {children}
    </Animated.View>
  );
}

export function KeyboardSafeAreaSpacer({
  backgroundColor,
}: {
  backgroundColor: string;
}) {
  const insets = useSafeAreaInsets();

  if (insets.bottom === 0) return null;

  return (
    <AnimatedSafeAreaSpacer
      height={insets.bottom}
      backgroundColor={backgroundColor}
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
  const { isSheetActive, sheetTranslateY, initialSnapHeight } =
    useComposerSheet();

  // Collapse spacer when keyboard is open OR when a composer-attached sheet
  // is active. Uses a smooth progress derived from the sheet's translate
  // so the collapse animates in sync with the sheet opening.
  const animatedStyle = useAnimatedStyle(() => {
    let sheetProgress = 0;
    if (isSheetActive.value === 1 && initialSnapHeight.value > 0) {
      const sheetVisible = FOOTER_SCREEN_HEIGHT - sheetTranslateY.value;
      sheetProgress = Math.min(
        1,
        Math.max(0, sheetVisible / initialSnapHeight.value),
      );
    }
    const factor = Math.max(progress.value, sheetProgress);
    return {
      height: interpolate(factor, [0, 1], [height, 0]),
      backgroundColor,
    };
  });

  return <Animated.View style={animatedStyle} />;
}
