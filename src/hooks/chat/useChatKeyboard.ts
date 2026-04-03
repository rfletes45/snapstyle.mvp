/**
 * useChatKeyboard Hook
 *
 * Provides keyboard shared values for chat layout.
 * Falls back safely when react-native-keyboard-controller is unavailable.
 */

import { createLogger } from "@/utils/log";
import {
  useKeyboardHandlerCompat,
  useReanimatedKeyboardAnimationCompat,
} from "@/utils/optionalKeyboardController";
import { useCallback, useMemo, useState } from "react";
import { runOnJS, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const log = createLogger("useChatKeyboard");

export interface ChatKeyboardConfig {
  debug?: boolean;
}

export interface ChatKeyboardState {
  keyboardHeight: SharedValue<number>;
  keyboardProgress: SharedValue<number>;
  isKeyboardOpen: boolean;
  finalKeyboardHeight: number;
  safeAreaBottom: number;
}

export function useChatKeyboard(
  config: ChatKeyboardConfig = {},
): ChatKeyboardState {
  const { debug = false } = config;

  const insets = useSafeAreaInsets();
  const safeAreaBottom = insets.bottom;
  const [finalKeyboardHeight, setFinalKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const { height: keyboardHeight, progress: keyboardProgress } =
    useReanimatedKeyboardAnimationCompat();

  const updateKeyboardState = useCallback(
    (height: number, open: boolean) => {
      setFinalKeyboardHeight(height);
      setIsKeyboardOpen(open);

      if (debug) {
        log.debug("Keyboard state changed", {
          operation: "keyboardStateChange",
          data: { height, open },
        });
      }
    },
    [debug],
  );

  const logKeyboardStart = useCallback(
    (targetHeight: number) => {
      if (debug) {
        log.debug("Keyboard animation started", {
          operation: "onStart",
          data: { target: targetHeight },
        });
      }
    },
    [debug],
  );

  useKeyboardHandlerCompat({
    onStart: (event: { height: number }) => {
      "worklet";
      if (debug) {
        runOnJS(logKeyboardStart)(event.height);
      }
    },
    onMove: () => {
      "worklet";
    },
    onEnd: (event: { height: number }) => {
      "worklet";
      const open = event.height > 0;
      runOnJS(updateKeyboardState)(event.height, open);
    },
  });

  return useMemo(
    () => ({
      keyboardHeight,
      keyboardProgress,
      isKeyboardOpen,
      finalKeyboardHeight,
      safeAreaBottom,
    }),
    [
      keyboardHeight,
      keyboardProgress,
      isKeyboardOpen,
      finalKeyboardHeight,
      safeAreaBottom,
    ],
  );
}
