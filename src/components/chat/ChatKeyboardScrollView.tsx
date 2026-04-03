/**
 * ChatKeyboardScrollView
 *
 * Adapter that lets FlatList use KeyboardChatScrollView (KCSV) as its
 * underlying scroll component via `renderScrollComponent`.
 *
 * Architecture:
 * - PRIMARY: native keyboard-controller scroll + sticky footer
 * - FALLBACK: plain ScrollView + standard KeyboardAvoidingView wrapper
 *
 * This file must remain safe to import in Expo Go.
 */

import React, { forwardRef, useCallback } from "react";
import type { ScrollViewProps } from "react-native";
import { ScrollView, UIManager } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  isKeyboardControllerAvailable,
  KeyboardChatScrollView as OptionalKeyboardChatScrollView,
  KeyboardStickyView,
  useReanimatedKeyboardAnimationCompat,
} from "@/utils/optionalKeyboardController";

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
  if (kcsvAvailable) {
    return (
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        {children}
      </KeyboardStickyView>
    );
  }

  return <>{children}</>;
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

  const animatedStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [height, 0]),
    backgroundColor,
  }));

  return <Animated.View style={animatedStyle} />;
}
