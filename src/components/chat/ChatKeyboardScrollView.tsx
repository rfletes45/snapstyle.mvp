/**
 * ChatKeyboardScrollView
 *
 * Adapter that lets FlatList use KeyboardChatScrollView (KCSV) as its
 * underlying scroll component via `renderScrollComponent`.
 *
 * KCSV (from react-native-keyboard-controller ≥ 1.20) handles
 * keyboard-synchronised chat layout:
 *  - extends scroll range via contentInset (no content-size change)
 *  - adjusts scroll position on the UI thread (no JS-thread delay)
 *  - supports inverted lists & interactive keyboard dismissal
 *
 * Architecture:
 *  PRIMARY (dev-client build): KCSV scroll + KSV footer
 *  FALLBACK (Expo Go): plain ScrollView + KAV wrapper (screen provides KAV)
 *
 * @module components/chat/ChatKeyboardScrollView
 */

import React, { forwardRef, useCallback } from "react";
import type { ScrollViewProps } from "react-native";
import { Platform, ScrollView, UIManager, View } from "react-native";
import {
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Detect whether the native KCSV view is available in this binary.
// On Android it registers as "ClippingScrollViewDecoratorView".
// On iOS it registers as "KeyboardChatScrollView" (or similar).
// If not present we fall back to a plain ScrollView so the app still runs.
// ---------------------------------------------------------------------------
let _kcsvAvailable = false;
try {
  if (Platform.OS === "android") {
    _kcsvAvailable =
      UIManager.getViewManagerConfig("ClippingScrollViewDecoratorView") != null;
  } else {
    _kcsvAvailable =
      UIManager.hasViewManagerConfig?.("KeyboardChatScrollView") ??
      UIManager.getViewManagerConfig("KeyboardChatScrollView") != null;
  }
} catch {
  _kcsvAvailable = false;
}

// Only import KCSV component when native side is ready
let KeyboardChatScrollView: any = null;
type KeyboardChatScrollViewProps = { keyboardLiftBehavior?: string };
if (_kcsvAvailable) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const kcModule = require("react-native-keyboard-controller");
    KeyboardChatScrollView = kcModule.KeyboardChatScrollView;
  } catch {
    _kcsvAvailable = false;
  }
}

/** Whether the native KeyboardChatScrollView is available in this build */
export const isKCSVAvailable = _kcsvAvailable;

// =============================================================================
// Props that the screens configure per-conversation
// =============================================================================

export interface ChatScrollViewConfig {
  /**
   * Distance (px) between the bottom of the scroll view and the bottom of
   * the screen. Typically: composerHeight + safeAreaBottom.
   * KCSV subtracts this from the keyboard height so only the *net* lift is
   * applied to content.
   */
  offset: number;
  /**
   * How to lift content when the keyboard appears.
   * - "whenAtEnd" = lift only when user is at the bottom (default, best UX)
   * - "always"    = always lift (Telegram-style)
   */
  keyboardLiftBehavior?: KeyboardChatScrollViewProps["keyboardLiftBehavior"];
  /**
   * Shared-value extra padding for dynamic composer-height changes
   * (e.g. multiline TextInput growing).
   */
  extraContentPadding?: SharedValue<number>;
}

const DEFAULT_CONFIG: ChatScrollViewConfig = {
  offset: 0,
  keyboardLiftBehavior: "whenAtEnd",
};

let _activeConfig: ChatScrollViewConfig = DEFAULT_CONFIG;

/**
 * Call this in the screen component (before the JSX) to set KCSV configuration.
 */
export function setChatScrollViewConfig(config: ChatScrollViewConfig): void {
  _activeConfig = config;
}

// =============================================================================
// Scroll component for FlatList's renderScrollComponent
// =============================================================================

export const ChatKeyboardScrollViewComponent = forwardRef<any, ScrollViewProps>(
  (props, ref) => {
    if (!_kcsvAvailable || !KeyboardChatScrollView) {
      return <ScrollView ref={ref} {...props} />;
    }

    return (
      <KeyboardChatScrollView
        ref={ref}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        inverted
        keyboardLiftBehavior={_activeConfig.keyboardLiftBehavior ?? "whenAtEnd"}
        offset={_activeConfig.offset}
        extraContentPadding={_activeConfig.extraContentPadding}
        applyWorkaroundForContentInsetHitTestBug
        {...props}
      />
    );
  },
);
ChatKeyboardScrollViewComponent.displayName = "ChatKeyboardScrollViewComponent";

/**
 * Stable callback for FlatList's renderScrollComponent prop.
 */
export function useRenderChatScrollComponent() {
  return useCallback(
    (props: ScrollViewProps): React.ReactElement<ScrollViewProps> => (
      <ChatKeyboardScrollViewComponent {...props} />
    ),
    [],
  );
}

// =============================================================================
// Footer wrapper — KSV (primary) vs bare fragment (fallback)
// =============================================================================

/**
 * Keyboard-aware footer wrapper for chat screens.
 *
 * PRIMARY (KCSV available): Wraps children in KeyboardStickyView with
 * `offset.opened = insets.bottom` so the safe-area spacer slides behind
 * the keyboard, leaving the composer flush against the keyboard top.
 *
 * FALLBACK (Expo Go, no KCSV): Renders children directly. The screen wraps
 * the entire layout in KeyboardAvoidingView to handle keyboard avoidance.
 */
export function ChatFooterWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  if (_kcsvAvailable) {
    return (
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        {children}
      </KeyboardStickyView>
    );
  }
  return <>{children}</>;
}

// =============================================================================
// Safe-area spacer — collapses when keyboard opens (fallback path)
// =============================================================================

/**
 * Safe-area bottom spacer for chat footer.
 *
 * KCSV path: Plain View — KSV `offset.opened` handles sliding it behind
 * the keyboard.
 *
 * Fallback path: Animated View — height interpolates from insets.bottom → 0
 * as keyboard opens, eliminating the gap between composer and keyboard.
 */
export function KeyboardSafeAreaSpacer({
  backgroundColor,
}: {
  backgroundColor: string;
}) {
  const insets = useSafeAreaInsets();

  if (insets.bottom === 0) return null;

  if (_kcsvAvailable) {
    return <View style={{ height: insets.bottom, backgroundColor }} />;
  }

  return (
    <FallbackAnimatedSpacer
      height={insets.bottom}
      backgroundColor={backgroundColor}
    />
  );
}

function FallbackAnimatedSpacer({
  height,
  backgroundColor,
}: {
  height: number;
  backgroundColor: string;
}) {
  const { progress } = useReanimatedKeyboardAnimation();

  const animatedStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [height, 0]),
    backgroundColor,
  }));

  return <Animated.View style={animatedStyle} />;
}
