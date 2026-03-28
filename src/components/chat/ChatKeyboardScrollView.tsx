/**
 * ChatKeyboardScrollView
 *
 * Adapter that lets FlatList use KeyboardChatScrollView as its underlying
 * scroll component via `renderScrollComponent`.
 *
 * KeyboardChatScrollView (from react-native-keyboard-controller ≥ 1.20)
 * handles keyboard-synchronised chat layout:
 *  - extends scroll range via contentInset (no content-size change)
 *  - adjusts scroll position on the UI thread (no JS-thread delay)
 *  - supports inverted lists & interactive keyboard dismissal
 *
 * @module components/chat/ChatKeyboardScrollView
 */

import React, { forwardRef, useCallback } from "react";
import type { ScrollViewProps } from "react-native";
import type { KeyboardChatScrollViewProps } from "react-native-keyboard-controller";
import { KeyboardChatScrollView } from "react-native-keyboard-controller";
import type { SharedValue } from "react-native-reanimated";

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

// Default config — used when nothing is provided
const DEFAULT_CONFIG: ChatScrollViewConfig = {
  offset: 0,
  keyboardLiftBehavior: "whenAtEnd",
};

// Module-level config slot. Screens set this before the FlatList renders.
let _activeConfig: ChatScrollViewConfig = DEFAULT_CONFIG;

/**
 * Call this in the screen component (inside a useMemo or before the JSX)
 * to set the KCSV configuration for the current render.
 */
export function setChatScrollViewConfig(config: ChatScrollViewConfig): void {
  _activeConfig = config;
}

// =============================================================================
// Scroll component for FlatList's renderScrollComponent
// =============================================================================

/**
 * Drop-in scroll component for FlatList.
 *
 * Usage:
 *   setChatScrollViewConfig({ offset, keyboardLiftBehavior });
 *   <FlatList renderScrollComponent={renderChatScrollComponent} ... />
 */
export const ChatKeyboardScrollViewComponent = forwardRef<any, ScrollViewProps>(
  (props, ref) => (
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
  ),
);
ChatKeyboardScrollViewComponent.displayName = "ChatKeyboardScrollViewComponent";

/**
 * Stable callback for FlatList's renderScrollComponent prop.
 * Must be used together with setChatScrollViewConfig().
 */
export function useRenderChatScrollComponent() {
  return useCallback(
    (props: ScrollViewProps): React.ReactElement<ScrollViewProps> => (
      <ChatKeyboardScrollViewComponent {...props} />
    ),
    [],
  );
}
