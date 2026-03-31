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
import { ScrollView, UIManager } from "react-native";
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
// Both platforms register the native view as "ClippingScrollViewDecoratorView".
// In Expo Go the JS module exists but the native view is a stub that can't
// render, so we validate by both checking UIManager AND trying to require
// the component. If either fails we fall back to a plain ScrollView.
// ---------------------------------------------------------------------------
let _kcsvAvailable = false;
let KeyboardChatScrollView: any = null;
type KeyboardChatScrollViewProps = { keyboardLiftBehavior?: string };
try {
  const NATIVE_VIEW = "ClippingScrollViewDecoratorView";
  const hasNative =
    UIManager.hasViewManagerConfig?.(NATIVE_VIEW) ??
    UIManager.getViewManagerConfig(NATIVE_VIEW) != null;
  if (hasNative) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const kcModule = require("react-native-keyboard-controller");
    if (kcModule.KeyboardChatScrollView) {
      // Final sanity check: Expo Go registers stubs that pass UIManager but
      // fail at render. Detect Expo Go via missing native WebRTC module
      // (same heuristic as CALL_FEATURES.CALLS_ENABLED).
      try {
        require("@stream-io/react-native-webrtc");
        KeyboardChatScrollView = kcModule.KeyboardChatScrollView;
        _kcsvAvailable = true;
      } catch {
        // Expo Go — native binary doesn't include custom native modules
        _kcsvAvailable = false;
      }
    }
  }
} catch {
  _kcsvAvailable = false;
}

/** Whether the native KeyboardChatScrollView is available in this build */
export const isKCSVAvailable = _kcsvAvailable;

// =============================================================================
// Props that the screens configure per-conversation
// =============================================================================

export interface ChatScrollViewConfig {
  /**
   * Offset subtracted from keyboard height for content-inset calculation.
   *
   * With the footer inside a KeyboardStickyView (offset={closed:0,opened:0})
   * the footer moves with the keyboard 1:1, so no static footer height needs
   * to be accounted for.  Set to 0 for the standard chat layout.
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
 * `offset={{ closed: 0, opened: 0 }}` so the footer tracks the keyboard
 * 1:1 on both open and close. The collapsing AnimatedSafeAreaSpacer
 * handles the safe-area gap.
 *
 * FALLBACK (Expo Go, no KCSV): Renders children directly. The screen wraps
 * the entire layout in KeyboardAvoidingView to handle keyboard avoidance.
 */
export function ChatFooterWrapper({ children }: { children: React.ReactNode }) {
  if (_kcsvAvailable) {
    return (
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
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
 * Animated View — height interpolates from insets.bottom → 0
 * as keyboard opens, collapsing the gap so the composer sits
 * flush against the keyboard top.
 */
export function KeyboardSafeAreaSpacer({
  backgroundColor,
}: {
  backgroundColor: string;
}) {
  const insets = useSafeAreaInsets();

  if (insets.bottom === 0) return null;

  // Both KCSV and fallback paths use the animated spacer so the safe-area
  // gap collapses in sync with the keyboard. With KSV offset={closed:0,
  // opened:0} the footer tracks the keyboard 1:1 and this collapsing
  // spacer removes the gap that would otherwise appear between keyboard and
  // composer.
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
  const { progress } = useReanimatedKeyboardAnimation();

  const animatedStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [height, 0]),
    backgroundColor,
  }));

  return <Animated.View style={animatedStyle} />;
}
