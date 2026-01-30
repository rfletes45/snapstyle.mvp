/**
 * useChatKeyboard Hook
 *
 * Provides smooth keyboard-attached composer animation using react-native-keyboard-controller.
 * Returns keyboardHeight and keyboardProgress SharedValues for 60fps animations.
 *
 * Screens use these values to create their own animated styles:
 * - marginBottom: -keyboardHeight.value (pushes composer up)
 * - paddingBottom: insets.bottom * (1 - keyboardProgress.value) (animates safe area)
 *
 * @module hooks/chat/useChatKeyboard
 */

import { createLogger } from "@/utils/log";
import { useCallback, useMemo, useState } from "react";
import {
  useKeyboardHandler,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import { runOnJS, SharedValue, useDerivedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const log = createLogger("useChatKeyboard");

// =============================================================================
// Constants
// =============================================================================

/** Base height of the chat composer input area */
const COMPOSER_BASE_HEIGHT = 60;

// =============================================================================
// Types
// =============================================================================

export interface ChatKeyboardConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Base composer height for list inset calculation (default: 60) */
  composerHeight?: number;
}

export interface ChatKeyboardState {
  /** Reanimated shared value: current keyboard height (NEGATIVE when open) */
  keyboardHeight: SharedValue<number>;
  /** Reanimated shared value: keyboard animation progress 0→1 */
  keyboardProgress: SharedValue<number>;
  /** Reanimated shared value: bottom inset for message list (composer + keyboard) */
  listBottomInset: SharedValue<number>;
  /** JS boolean: whether keyboard is currently open */
  isKeyboardOpen: boolean;
  /** JS number: final keyboard height (positive, after animation completes) */
  finalKeyboardHeight: number;
  /** Safe area bottom inset */
  safeAreaBottom: number;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useChatKeyboard(
  config: ChatKeyboardConfig = {},
): ChatKeyboardState {
  const { debug = false, composerHeight = COMPOSER_BASE_HEIGHT } = config;

  const insets = useSafeAreaInsets();
  const safeAreaBottom = insets.bottom;

  // Track final keyboard height (JS state for conditional logic)
  const [finalKeyboardHeight, setFinalKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Reanimated keyboard animation values from react-native-keyboard-controller
  // Note: height is NEGATIVE when keyboard is open (e.g., -318)
  const { height: keyboardHeight, progress: keyboardProgress } =
    useReanimatedKeyboardAnimation();

  // Derived value: list bottom inset (composer height + keyboard or safe area)
  // This value animates smoothly with the keyboard for the message list padding
  // Note: keyboardHeight is NEGATIVE when keyboard is open
  const listBottomInset = useDerivedValue(() => {
    "worklet";
    // -keyboardHeight.value gives positive value when keyboard is open
    const kbHeight = -keyboardHeight.value;

    if (kbHeight > 0) {
      // Keyboard is open: use keyboard height + composer height
      return kbHeight + composerHeight;
    } else {
      // Keyboard is closed: use safe area + composer height
      return safeAreaBottom + composerHeight;
    }
  }, [keyboardHeight, composerHeight, safeAreaBottom]);

  // Callback to update JS state from worklet
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

  // Debug logging helper that can be called from worklet via runOnJS
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

  // Use keyboard handler for state updates
  useKeyboardHandler({
    onStart: (e) => {
      "worklet";
      if (debug) {
        runOnJS(logKeyboardStart)(e.height);
      }
    },
    onMove: () => {
      "worklet";
      // This fires during interactive dismiss (iOS drag)
      // The animated values are already updated by useReanimatedKeyboardAnimation
    },
    onEnd: (e) => {
      "worklet";
      const open = e.height > 0;
      runOnJS(updateKeyboardState)(e.height, open);
    },
  });

  return useMemo(
    () => ({
      keyboardHeight,
      keyboardProgress,
      listBottomInset,
      isKeyboardOpen,
      finalKeyboardHeight,
      safeAreaBottom,
    }),
    [
      keyboardHeight,
      keyboardProgress,
      listBottomInset,
      isKeyboardOpen,
      finalKeyboardHeight,
      safeAreaBottom,
    ],
  );
}
